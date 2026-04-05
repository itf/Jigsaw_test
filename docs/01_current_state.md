# Current State of the System

> Last updated: 2026-04-05  
> Focus: `src/v2/` — the active implementation.  
> `src/v1/` is a legacy prototype; ignore it.

---

## Quick start (local dev)

```bash
npm install
# If @tailwindcss/oxide native binding is missing (common after env switches):
npm install @tailwindcss/oxide-linux-x64-gnu
npm run dev        # http://localhost:3000
npm test           # 8 passing tests
npm run lint       # tsc --noEmit
```

---

## Tech stack

| Layer | Library |
|---|---|
| UI framework | React 19, TypeScript 5.8 |
| 2D geometry | Paper.js 0.12 |
| Voronoi / Delaunay | d3-delaunay 6 |
| Styling | Tailwind CSS 4 |
| Animations | Motion (Framer successor) |
| Icons | Lucide-React |
| Build | Vite 6 |
| Tests | Vitest 4 (environment: `node`) |

> **Note on tests**: the test environment was changed from `jsdom` to `node` because jsdom@29 depends on `@exodus/bytes` (ESM-only) which conflicts with `html-encoding-sniffer` (CJS). None of the geometry tests need a DOM.

---

## Directory map

```
src/
├── v1/                        Legacy version — ignore
└── v2/
    ├── App.tsx                 App root: state, actions, layout
    ├── types.ts                Core data structures
    ├── constants.ts            Tab enum, colour palette
    ├── geometry.ts             Point generators, getSharedPerimeter, connector stamps
    ├── topology_engine.ts      Face-edge-vertex graph (the canonical engine)
    ├── topology.ts             Old alternative — likely to be removed
    ├── hooks/
    │   └── usePuzzleEngine.ts  8-stage memoised pipeline
    ├── components/
    │   ├── V2Canvas.tsx        SVG renderer + zoom/pan
    │   ├── V2ActionBar.tsx     Two-row toolbar (tab controls + selection panel)
    │   ├── V2Header.tsx        Logo, engine toggle, undo, run-tests, export
    │   ├── V2Navigation.tsx    Six tab buttons
    │   ├── V2CreateModal.tsx   New-puzzle modal (size picker)
    │   ├── V2Menu.tsx          Context menu (unused for now)
    │   ├── V2TestResults.tsx   In-app test results overlay
    │   └── V2QuickStart.tsx    Deprecated — replaced by V2CreateModal
    └── utils/
        └── tests.ts            Headless test runner (for in-app "Run Tests" button)
```

---

## Data model (`types.ts`)

### `Area`
```
id          string   — unique, e.g. "root-child-2-a1b2"
parentId    string | null
type        ROOT | SUBDIVISION | WHIMSY
children    string[]   — IDs of child Areas (empty = leaf = piece)
boundary    string     — SVG path data
seedPoint   {x,y}      — Voronoi seed / visual centre
isPiece     boolean    — true when leaf node (cuttable piece)
color       string
```

### `Connector`
```
id          string
areaAId     string
areaBId     string
u           number     — position [0,1] along the shared perimeter
isFlipped   boolean    — tab points toward areaA instead of areaB
type        'TAB' | 'DOVETAIL' | 'SQUARE' | 'HEART' | 'NONE'
size        number     — px
isDormant   boolean
midpoint?   {x,y}      — declared, not yet populated by solver
isDeleted?  boolean    — set by collision fallback
```

### `Operation` (history entries)
```
id          string
type        'CREATE_ROOT' | 'SUBDIVIDE' | 'ADD_WHIMSY' | 'MERGE' |
            'MERGE_AREAS' | 'ADD_CONNECTOR' | 'RESOLVE_CONSTRAINTS' |
            'TRANSFORM_GEOMETRY'
params      any
timestamp   number
```

The entire scene is a pure function of `(history[], width, height)`.

---

## The 8-stage pipeline (`usePuzzleEngine.ts`)

Each stage is a `useMemo`. Later stages depend on earlier ones.

```
Stage 1  rootArea           Static {id:"root", boundary: full rect, isPiece:true}
Stage 2  topology           SUBDIVIDE ops → Voronoi cells clipped to parent boundary
Stage 3  mergedGroups       MERGE ops → Disjoint Set Union on leaf areas
Stage 4  sharedEdges        O(n²) adjacency scan → edges for visualisation
Stage 5  connectors         ADD_CONNECTOR ops → raw connector list
Stage 6  resolvedConnectors Collision check → marks overlapping connectors isDeleted
Stage 7  finalPieces        Geometry per merged group (Boolean OR Topological)
Stage 8  finalPiecesWithConnectors  Boolean only: union/subtract connector stamps
```

**Critical bug fixed (2026-04-05):** `subdivide()` had `topology` missing from its `useCallback` deps, so the boundary computation used a stale closure. Fixed by adding `topology` to the dep array.

**Voronoi bounds fixed (2026-04-05):** The Voronoi diagram was computed over `[0,0,W,H]` even when subdividing a small child area. It now uses the parent area's own bounding box so cells are tightly placed inside the target region.

---

## Topological engine (`topology_engine.ts`)

The preferred geometry backend. Represents the puzzle as a face-edge-vertex graph.

### Data structures
```
vertices  Map<"x,y", TopoVertex>       — deduplicated at 3 decimal places
edges     Map<"v1|v2", TopoEdge>       — key is sorted vertex IDs
faces     Map<areaId, TopoFace>
```

`TopoEdge`:
```
id, v1Id, v2Id
pathData        — straight "M x1 y1 L x2 y2" (bezier support is future work)
faceAId
faceBId         — null if boundary edge
isMerged        — true when the edge is interior to a merged group
connectors?     — [{u, stampPathData, isFlipped, ownerFaceId}]
```

### Key methods

| Method | What it does |
|---|---|
| `initializeFromVoronoi(areas, W, H)` | Parses all area boundaries, deduplicates vertices, detects T-junctions and splits edges there, assigns edges to faces |
| `findEdgesBetweenFaces(A, B)` | Returns all edge IDs shared by two faces |
| `mergeFaces(A, B)` | Marks shared edges as `isMerged = true` |
| `addConnectorToBoundary(A, B, u, stamp, flipped, owner)` | Distributes `u` over shared edges by arc length, stores stamp on the edge |
| `getMergedBoundary(faceIds[])` | Traverses the outer boundary loop of a group, splices connector stamps in, returns SVG path string |

### T-junction handling
When Voronoi cell C has a long edge that cells A and B each touch at its midpoint, the raw segments include a vertex lying on (not at the end of) C's edge. `initializeFromVoronoi` detects this via a projection test and splits the segment, ensuring the graph is topologically consistent.

### Connector splicing (`getEdgePath`)
For each connector on an edge, the stamp (a raw path pointing rightward at the origin) is:
1. Rotated to match the edge's tangent direction
2. Translated to the connector's anchor position on the edge
3. Oriented so it protrudes into the correct face
4. Spliced into the path by replacing the base segment with the stamp's segments

---

## `getSharedPerimeter` (geometry.ts) — critical function

Used everywhere an adjacent pair of areas needs its shared edge.

**Previous approach (buggy):** called `pathA.intersect(pathB)`. For exactly-adjacent Voronoi cells this produces a zero-area "double-edge sliver" (a closed path traversing the edge twice). The code tried to split it at `length/2` to get one traversal, but Paper.js assigns the starting vertex of the closed path arbitrarily — if it started mid-edge, the split landed at a corner, not the midpoint.

**Current approach (2026-04-05):** vertex matching.
1. Iterate all segments of both boundary paths.
2. Collect vertices from A that are within 1.5 px of any vertex in B.
3. Take the pair with greatest distance (= the actual shared edge endpoints).
4. Return a clean open path `M p1 L p2`.

This gives a path where `u=0 → p1`, `u=0.5 → geometric midpoint`, `u=1 → p2`, fixing the connector position discrepancy between the Boolean and Topological engines.

---

## `geometry.ts` — other key functions

### Point generators
| Function | Parameters | Notes |
|---|---|---|
| `generateGridPoints(W, H, rows, cols, jitter, bounds?)` | `bounds` overrides placement region | jitter not exposed in UI yet |
| `generateHexPoints(W, H, size, jitter?)` | offset-column hex packing | |

### `createConnectorStamp(anchor, normal, type, size, midpointOffset?, overlap?)`
Builds the tab shape as a Paper.js Path centred at origin pointing right.
- Only `TAB` is geometrically implemented (cubic bezier neck+head).
- Other types (`DOVETAIL`, `SQUARE`, `HEART`, `NONE`) fall back to a rectangle stub.
- `overlap` (default 0.5 px) extends the base slightly to prevent Boolean gaps.

### `resolveCollisions(connectors, areas)`
Current implementation: bounding-box overlap → delete the second connector.  
**Not yet implemented:** elastic rod bending, `u`-shifting fallback.

---

## UI layout

```
┌─────────────────────── V2Header ────────────────────────────┐
│  Logo | Engine toggle (Boolean/Topo) | Undo | Run Tests | Export │
├─────────────────────── V2Navigation ────────────────────────┤
│  Topology | Modification | Connection | Resolution | … | Production │
├─────────────────────── V2ActionBar ─────────────────────────┤
│  Row 1 (always): tab-level controls                          │
│  Row 2 (conditional): selection info (never overlaps row 1)  │
├─────────────────────── V2Canvas ────────────────────────────┤
│                                                              │
│   SVG puzzle board (pan + zoom)                              │
│                                                              │
│   [− ████░ +  100%  ⤢]  ← zoom controls (bottom-left)      │
└──────────────────────────────────────────────────────────────┘
```

### V2CreateModal
Shown on first load (before any history exists).  
Offers presets: Square 600×600, A4 landscape/portrait, 4:3 800×600, 16:9 960×540.  
Custom W×H inputs (100–4000 px). Dismissed via "Create Puzzle" → sets `width`/`height` state.

### ActionBar — Topology tab
- **Row 1:** Grid (rows × cols + Split), Hex (size + Split), Random (count + Split)
- **Row 2 (when area selected):** area ID, leaf/children status
- Split buttons are **disabled** unless an area is selected AND `isPiece === true`.
- Splitting always targets the selected area; root can only be split once (it becomes non-leaf).

### V2Canvas — zoom/pan
- **Scroll wheel** → pan (non-passive, `preventDefault` to avoid page scroll)
- **Left drag** on background → pan
- **Middle mouse** anywhere → pan
- **Drag vs click** distinguished by 4 px move threshold
- **Zoom slider** (bottom-left): `−` / slider / `+` / fit-icon; zoom is centred on viewport centre
- **Pan clamping**: at least 120 px of the puzzle always stays inside the viewport
- **Mobile**: no custom behaviour; browser native pinch/scroll works

---

## Tabs and what they do

| Tab | Row 1 controls | Selection row behaviour |
|---|---|---|
| TOPOLOGY | Grid/Hex/Random split buttons | Area info; split buttons disabled if area already has children |
| MODIFICATION | "Click two areas to merge" hint | Merge button for selected area |
| CONNECTION | "Click edges to add tabs" hint | Connector editor (pos, size, flip, delete) |
| RESOLUTION | (empty) | Connector editor |
| TRANSFORMATION | (placeholder) | — |
| PRODUCTION | Export SVG button | — |

---

## Test suite

All tests run headlessly against Paper.js in Node (no DOM needed).

| File | Tests | Covers |
|---|---|---|
| `src/v2/merge_repro.test.ts` | 4 | 3×3 rect grid merge area, hex grid merge area, connector integration, T-junction |
| `src/v2/topological_engine.test.ts` | 1 | Hex grid with connectors — total area conservation + no holes in union |
| `src/tests/geometry.test.ts` | 3 | v1 whimsy path helpers (legacy) |

Run with `npm test`. All 8 pass as of 2026-04-05.

---

## Known gaps / limitations

| Area | Status |
|---|---|
| Connector types | Only `TAB` is geometrically real; others are rectangle stubs |
| Collision resolution | Deletion fallback only — no elastic bending, no `u`-shifting |
| `Connector.midpoint` | Field declared; never populated |
| Whimsy areas | Type enum exists; no generation or clipping logic implemented |
| Point distribution | Poisson-disc, spiral, manual placement — not implemented |
| Spatial transforms | Tab exists; no conformal/polar mapping |
| SVG export | Production tab button exists; no actual export logic |
| `MERGE_AREAS` op type | Declared alongside `MERGE` — appears to be a duplicate, should be removed |
| Shared-edge scan | O(n²); gated at 200 pieces; no spatial index |
| Determinism | `RANDOM` pattern uses `Math.random()` — not seeded |
| `topology.ts` | Likely dead code — should be audited and removed |
