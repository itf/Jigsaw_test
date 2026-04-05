# Current State of the System

> Last updated: 2026-04-05  
> Focus: `src/v2/` — the active implementation. `src/v1/` is legacy and not described here.

---

## Tech Stack

| Layer | Library / Tool |
|---|---|
| UI framework | React 19, TypeScript 5.8 |
| 2D geometry | Paper.js |
| Voronoi / Delaunay | d3-delaunay |
| Styling | Tailwind CSS |
| Animations | Motion (Framer Motion successor) |
| Icons | Lucide-React |
| Build | Vite |
| Tests | Vitest |

---

## Architecture Overview

The application is organised as a **history-replay pipeline**. Every user action appends an immutable `Operation` object to an array. On each change, `usePuzzleEngine` re-runs the entire history to recompute the scene. The pipeline has eight memoised stages (each a `useMemo` call):

```
1. rootArea            – static 500×500 rectangle
2. topology            – Voronoi subdivision for each SUBDIVIDE op
3. mergedGroups        – Disjoint Set Union for MERGE ops
4. sharedEdges         – adjacency list for visualisation
5. connectors          – raw connector list from ADD_CONNECTOR ops
6. resolvedConnectors  – collision-checked connector list
7. finalPieces         – piece geometry (no connectors yet)
8. finalPiecesWithConnectors – geometry with connectors applied (BOOLEAN path only)
```

---

## Data Model (`src/v2/types.ts`)

### `Area`
```
id, parentId, type (ROOT | SUBDIVISION | WHIMSY)
children[]       – IDs of child Areas
boundary         – SVG path string
seedPoint        – Voronoi seed / expansion origin
isPiece          – true when it is a leaf node (a cuttable piece)
color
```

### `Connector`
```
id
areaAId, areaBId   – the two adjacent Areas
u                  – normalised position [0, 1] along the shared perimeter
isFlipped          – toggles which side the tab protrudes
type               – TAB | DOVETAIL | SQUARE | HEART | NONE
size
isDormant
midpoint?          – resolved geometry (from solver, not yet populated)
isDeleted?         – set by collision fallback
```

### `Operation`
```
id, type, params, timestamp
```
Operation types: `CREATE_ROOT`, `SUBDIVIDE`, `ADD_WHIMSY`, `MERGE`, `MERGE_AREAS`, `ADD_CONNECTOR`, `RESOLVE_CONSTRAINTS`, `TRANSFORM_GEOMETRY`

---

## Pipeline Stages — Details

### Stage 2 · Voronoi Subdivision
- Input: `SUBDIVIDE` operations carrying a `points` array and `parentId`.
- Uses `d3-delaunay` to compute Voronoi cells, then clips each cell to the parent boundary with `paper.Path.intersect()`.
- Creates one child `Area` per seed point.
- Supported seed patterns: **Grid**, **Hex**, **Random** (uniform random). Jitter is wired in `generateGridPoints` but not yet exposed in the UI.

### Stage 3 · Merge (DSU)
- Input: `MERGE` operations with `areaAId` / `areaBId`.
- Walks down to leaf Areas (descendants of both IDs).
- Calls `getSharedPerimeter()` to confirm adjacency before unioning them in the DSU.
- Output: `mergedGroups` — a map from group-root-ID to list of leaf IDs.

### Stage 4 · Shared Edges
- Computed only when ≤ 200 leaf areas (performance gate).
- O(n²) pair scan using `getSharedPerimeter()`.
- Each edge carries `isMerged` flag (used to dim merged edges in the UI).

### Stage 5–6 · Connectors & Collision Resolution
- Connectors become active only from the `CONNECTION` tab onward.
- `resolveCollisions()` does a **bounding-box overlap test** only. If two connector stamps' AABBs overlap, the second one is deleted. No bending or shifting is implemented yet.

### Stage 7 · Final Pieces — two engines

#### BOOLEAN engine
- Iterates `mergedGroups`; for single-area groups uses the boundary as-is; for multi-area groups calls `paper.Path.unite()` repeatedly.
- Applies connectors in Stage 8 by unioning/subtracting stamp shapes.

#### TOPOLOGICAL engine (default, recommended)
- Creates a `TopologicalEngine` instance.
- `initializeFromVoronoi()` builds a face-edge-vertex graph from all leaf area boundaries.
- `mergeFaces()` marks shared edges as interior.
- `addConnectorToBoundary()` stores stamp data on edges at the given `u` offset.
- `getMergedBoundary()` traverses the outer boundary loop and splices connector stamps in place.
- **No Stage 8 needed** — connectors are already woven into the boundary path.

---

## TopologicalEngine (`src/v2/topology_engine.ts`)

The graph has three collections:

| Collection | Key | Value |
|---|---|---|
| `vertices` | `"x,y"` string | `{ id, point: paper.Point }` |
| `edges` | `"v1\|v2"` sorted string | `{ id, v1Id, v2Id, pathData, faceAId, faceBId, isMerged, connectors? }` |
| `faces` | area ID | `{ id, edgeIds[], seedPoint, color }` |

### T-Junction Handling
During `initializeFromVoronoi`, after collecting all raw segments, the engine checks every vertex against every segment to detect vertices that lie on (but are not endpoints of) a segment. Any such vertex splits the segment into two sub-edges. This ensures that when face C has a long edge that A and B individually touch at a midpoint, the graph still records the correct split.

### Boundary Traversal
`getMergedBoundary(faceIds)`:
1. Collects all edges whose faces are in the group.
2. Filters to **boundary edges** — those where exactly one face is inside the group.
3. Builds a vertex-adjacency map over boundary edges.
4. Walks the loop from an arbitrary start edge, honouring face orientation (CCW for interior, CW reversed).
5. Splices connector stamps by calling `getEdgePath()` which inserts stamp segments at the correct `u` position along the edge, oriented to the edge tangent.

---

## Connector Stamp Generation (`src/v2/geometry.ts · createConnectorStamp`)

Only `TAB` type is fully implemented. The shape is a closed cubic-bezier curve that forms a classic jigsaw tab:
- Neck width: `size × 0.6`
- Head width: `size × 1.2`
- Depth: `size × 1.0`
- An `overlap` extension (default 0.5 px) prevents gaps at the base.

Other types (`DOVETAIL`, `SQUARE`, `HEART`, `NONE`) fall through to a rectangular stub.

---

## UI Structure

```
V2App (App.tsx)
├── V2Header        — engine toggle (BOOLEAN / TOPOLOGICAL), Undo, Run Tests
├── V2Navigation    — six tab buttons
├── V2ActionBar     — context-sensitive controls (grid params, connector editor)
└── V2Canvas        — SVG renderer
    ├── Piece paths (finalPieces)
    ├── Shared edges (topology / modification tabs)
    └── Connector preview circles (connection / resolution tabs)
```

### Tabs
| Tab | What is shown / enabled |
|---|---|
| TOPOLOGY | Subdivide actions; raw Voronoi cell fills |
| MODIFICATION | Merge mode (two-click); merged edges dimmed |
| CONNECTION | Click shared edge to add connector; connector edit panel |
| RESOLUTION | Resolved/deleted connectors highlighted |
| TRANSFORMATION | (placeholder — no spatial transforms implemented) |
| PRODUCTION | (placeholder — no export implemented) |

---

## Test Coverage

| File | Tests | What they cover |
|---|---|---|
| `src/v2/merge_repro.test.ts` | 4 | 3×3 grid merge area, hex merge area, connector integration, T-junction |
| `src/v2/topological_engine.test.ts` | 1 | Hex grid with connectors — total area conservation + no holes |
| `src/tests/geometry.test.ts` | (exists) | Not reviewed in detail |

All tests use Vitest and run headlessly against Paper.js.

---

## Known Gaps / Limitations

| Area | Status |
|---|---|
| Collision resolution | Deletion fallback only — no bending, no `u`-shifting |
| Connector types | Only `TAB` is geometrically implemented |
| Whimsy areas | Type enum exists; no generation or clipping logic |
| Point distribution | Poisson-disc, spiral, manual placement not implemented |
| Spatial transforms | Tab exists; no conformal / polar mapping |
| SVG export / kerf | Not implemented |
| Connector `midpoint` | Field declared but never populated |
| `MERGE_AREAS` op type | Declared alongside `MERGE` — appears to be a duplicate |
| Performance | Shared-edge scan is O(n²); no spatial index |
| Determinism | Random patterns use `Math.random()` — not seeded |
