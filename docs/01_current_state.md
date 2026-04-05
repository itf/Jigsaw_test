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
npm test           # Vitest (see Test suite)
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
    ├── geometry.ts             Point generators, getSharedPerimeter, connector stamps, clampConnectorU
    ├── boolean_connector_geometry.ts  Paper.js booleans: base pieces, cut/preview, overlays, computeBooleanGeometry
    ├── paperProject.ts         resetPaperProject — one active Paper project; avoids leaks when params change every frame
    ├── topology_engine.ts      Face-edge-vertex graph (topological engine)
    ├── topology.ts             Old alternative — likely to be removed
    ├── hooks/
    │   └── usePuzzleEngine.ts  Memoised pipeline (boolean + topological branches)
    ├── components/
    │   ├── V2Canvas.tsx        SVG renderer + zoom/pan
    │   ├── V2ActionBar.tsx     Topology split/merge/delete + other tab hints; selection row
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
u           number     — position along the shared perimeter; **clamped to [0.001, 0.999]** in geometry and UI (avoids endpoint bugs)
isFlipped   boolean    — tab points toward areaA instead of areaB
type        'TAB' | 'DOVETAIL' | 'SQUARE' | 'HEART' | 'NONE'
size        number     — px
isDormant   boolean
clipOverlap? boolean   — Boolean engine: when true, subtract stamp from overlapping “third” pieces; when false, stamp is intersected with (owner ∪ neighbor) before booleans. **Topological engine: always treated as true** (UI checkbox disabled).
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

## The pipeline (`usePuzzleEngine.ts`)

Stages are `useMemo`s (later stages depend on earlier ones). **Topology and merged groups are built in one ordered pass** over `history`: `SUBDIVIDE` updates the `areas` map; `MERGE` updates the DSU using **current** leaf geometry so order matches reality (merge-then-split and correct shared-edge tests).

```
Stage 1  rootArea           Static {id:"root", boundary: full rect, isPiece:true}
Stage 2  topology + mergedGroups   SUBDIVIDE → Voronoi cells; MERGE → DSU (interleaved in history order)
Stage 3  sharedEdges        O(n²) adjacency scan → edges for visualisation
Stage 4  connectors         ADD_CONNECTOR ops → raw connector list (u clamped; topo forces clipOverlap)
Stage 5  booleanGeometry    BOOLEAN only: computeBooleanGeometry — collision resolve + base + cut + preview + overlays (single Paper lifecycle per update)
Stage 6  resolvedConnectors Collision resolve embedded in booleanGeometry for BOOLEAN; TOPO: resetPaperProject + resolveCollisions
Stage 7  finalPieces        BOOLEAN: base pieces from booleanGeometry; TOPO: TopologicalEngine + getMergedBoundary + Paper subtract stamps per rules
Stage 8  finalPiecesWithConnectors / previewPieces  BOOLEAN: cutPieces / previewPieces from booleanGeometry; TOPO: same as finalPieces
Stage 9  connectorOverlays  BOOLEAN: stamp overlays when tab not baked into path; TOPO: buildTopoConnectorStampOverlays (every connector drawn on top)
```

The hook returns **`PuzzleEngineResult`** (`topology`, `mergedGroups`, `sharedEdges`, `connectors`, `resolvedConnectors`, `finalPieces`, `previewPieces`, `connectorOverlays`).

**SUBDIVIDE params (relevant):** `parentId`, `points`, `pattern`, optional **`clipBoundary`** (boolean union of merged leaves when splitting a merged group), optional **`absorbedLeafIds`** (other leaves in that merge group removed from the areas map after children are created). Built in `App.tsx` (`buildSubdivideOperation`).

**Voronoi extent:** The diagram uses the **clipping** boundary’s bounding box (single parent or merged union), not always `[0,0,W,H]`.

**Topological replay:** `MERGE` ops replay as `mergeFaces` on `TopologicalEngine`; if a face id no longer exists (e.g. after absorb), that merge is **skipped** — history and current leaf set must stay consistent.

### Boolean engine (`boolean_connector_geometry.ts`)

Used when **`geometryEngine === 'BOOLEAN'`**. **`computeBooleanGeometry`** runs one pipeline: `resetPaperProject` → collision resolution → base pieces → cut pieces (full union/subtract, optional third-piece subtract) → preview paths → connector stamp overlays (only where the tab is not already in the piece path). **`paperProject.ts`** replaces the active Paper project before `paper.setup` so dragging connector parameters does not accumulate orphan projects.

### Topological engine (vs boolean)

When **`geometryEngine === 'TOPOLOGICAL'`**, piece paths come from **`TopologicalEngine.getMergedBoundary`** with neighbor/third-piece subtracts using **`clipOverlap` always true**. Canvas **tab fills** are separate **SVG overlays** (`connectorOverlays`) so connectors always render **above** piece fills. The header toggle switches engines for comparison and workflow choice.

---

## Topological engine (`topology_engine.ts`)

Represents the puzzle as a face-edge-vertex graph (used when **`geometryEngine === 'TOPOLOGICAL'`**).

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

Used everywhere an adjacent pair of areas needs a **shared interface** chord (merge DSU, connector preview, boolean path).

**Not used:** `pathA.intersect(pathB)` as the primary boundary (it produced zero-area “double sliver” closed paths for adjacent cells).

**Current approach:** build a set of **candidate points** on the shared interface, then return the **open** path `M p1 L p2` between the **two farthest** distinct points (chord). `getPointAtU` is arc length on that segment.

1. **Vertex–vertex:** vertices of A within tolerance of vertices of B (≈1.5 px).
2. **T-junctions / partial edges:** each vertex of A tested against every **segment** of B’s closed polygon (and vice versa). Catches corners that lie **on the interior** of the neighbor’s long edge (no matching vertex there).
3. **Segment pairs:** collinear **overlap** endpoints; or proper **segment–segment intersection** when not parallel.
4. Deduplicate nearby points; require at least two distinct points with separation > 1 px.

This keeps connector `u` and merge adjacency consistent when subpieces only share a **sub-edge** of a neighbor (common after `SUBDIVIDE`).

---

## `geometry.ts` — other key functions

### Point generators
| Function | Parameters | Notes |
|---|---|---|
| `generateGridPoints(W, H, rows, cols, jitter, bounds?)` | `bounds` overrides placement region | jitter not exposed in UI yet |
| `generateHexGridPoints(bounds, rows, cols, jitter?)` | lattice inside `bounds` | used by Topology “Hex lattice” split |
| `generateHexPoints(W, H, size, jitter?)` | offset-column hex packing | still in file; UI uses `generateHexGridPoints` |

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
- **Split:** dropdown (**Grid** / **Hex lattice** / **Random**), size inputs (grid rows×cols, hex rows×cols, or random point count), then **Split**.
- **Merge / Delete:** short instructions; **Merge** chains `MERGE` for all picked pieces (≥2). **Delete piece** merges the target with **all neighbors** (same as repeated merges along the boundary).
- **Selection:** tap a **display piece** to toggle it in the selection set; tap again to remove. **Split** runs **one `SUBDIVIDE` per selected leaf** (batched in history). After **split, merge, or delete**, selection is **cleared** so stale ids (e.g. parents after a split) do not block the next action.
- Split is enabled when at least one piece is selected and **every** selected id is a leaf (`isPiece`).
- Merged-group split uses union **clip** and seed **bounds** from the merged geometry (see `buildSubdivideOperation` in `App.tsx`).

### V2Canvas — Production tab
Piece paths are drawn as **stroke-only contours** (laser-oriented). **No** connector overlay layer (cut geometry is authoritative).

### V2Canvas — connector overlays (Connection / Resolution / etc., not Production)
**Boolean:** tab-shaped fills above pieces when `clipOverlap` is off; when on, the tab is baked into preview paths and overlays are omitted for those connectors. **Topological:** every connector gets a stamp overlay so the tab is always **on top** of piece fills.

### V2Canvas — selection (Topology)
Selected pieces use a **violet multiply overlay**, **thick indigo stroke**, and a light **SVG glow** filter so selection is obvious on any fill colour.

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
| TOPOLOGY | Split pattern + sizes + Split; merge/delete hints + actions | Area id, leaf status, delete piece when applicable |
| MODIFICATION | Placeholder label | — |
| CONNECTION | "Click edges to add tabs" hint | Connector editor (pos, size, flip, delete) |
| RESOLUTION | (empty) | Connector editor |
| TRANSFORMATION | (placeholder) | — |
| PRODUCTION | **Export SVG** — `puzzle-cut.svg`: stroke-only paths from hook `finalPieces` (boolean = cut booleans; topo = merged boundaries with connector subtracts). No tab overlay on canvas. | — |

---

## Test suite

All tests run headlessly against Paper.js in Node (no DOM needed).

| File | Covers |
|---|---|
| `src/v2/merge_repro.test.ts` | Rect/hex merge area, connector on boundary, T-junction scenario, Voronoi clip |
| `src/v2/topological_engine.test.ts` | Hex grid + connectors — area conservation |
| `src/v2/getSharedPerimeter.test.ts` | T-junction: subpiece vertices on interior of neighbor edge |
| `src/v2/boolean_connector_geometry.test.ts` | Boolean stamps, clip-overlap vs pre-clip, grid third-piece behaviour |
| `src/tests/geometry.test.ts` | v1 whimsy path helpers (legacy) |

Run with `npm test`.

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
| SVG export | **Basic export implemented** — stroke-only paths from `finalPieces`; kerf / layers / single-edge walk still future (`03_next_steps.md` Phase 6) |
| `MERGE_AREAS` op type | Declared alongside `MERGE` — appears to be a duplicate, should be removed |
| Shared-edge scan | O(n²); gated at 200 pieces; no spatial index |
| Determinism | `RANDOM` pattern uses `Math.random()` — not seeded |
| `topology.ts` | Likely dead code — should be audited and removed |
