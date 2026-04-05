# Design Document & PRD — Puzzle Designer Application

> Status: working draft  
> Last updated: 2026-04-05  
> Scope: describes the intended full system. Cross-reference `01_current_state.md` for what is already built.

---

## 1. Vision

A deterministic, action-based web application for designing custom jigsaw puzzles — including traditional interlocking pieces, whimsy pieces, and recursive subdivisions — producing laser-cutter-ready SVG output.

The system is built around three core principles:

1. **History as source of truth.** Every user action is an immutable record. The scene is always a pure function of the history array. This enables perfect undo, reproducibility, and serialisation.
2. **Topology over booleans.** The geometry engine maintains a face-edge-vertex graph rather than repeatedly unioning/subtracting paths. This eliminates floating-point drift and avoids double-cut artifacts.
3. **Tab-gated pipeline.** The six-tab layout gates later operations behind earlier ones, guiding the designer through a deterministic production workflow.

---

## 2. Core Concepts

### 2.1 The Area Hierarchy

- **Area** is the universal unit. The root Area is the entire puzzle board.
- Every Area except the root has a parent. A "piece" is a **leaf Area** (`isPiece === true`).
- Areas form a tree; any node can be subdivided, creating children and demoting itself to a non-leaf.
- **Whimsy**: an Area with a custom SVG boundary. It acts as a hard constraint — internal pieces expand only to its inner boundary; external pieces only to its outer boundary. A whimsy can itself be further subdivided.

### 2.2 Expansion & Subdivision

- **Seed patterns**: Grid (implemented), Hexagonal (implemented), Random (implemented), Poisson-disc (planned), Spiral (planned), Manual placement (planned).
- **Voronoi**: seed points generate initial cell shapes via Delaunay triangulation (d3-delaunay).
- **Clipping**: each cell is clipped to its parent Area boundary using Paper.js path intersection.
- **Voronoi extent**: the Voronoi diagram is computed over the parent area's own bounding box, not the full puzzle, so cells are tightly placed inside the target region.
- **Merging**: the edge between two siblings can be set to `none`, functionally joining them. The topological engine marks the shared edge as interior; the connector on that edge becomes dormant.
- **Subdivide target**: subdivision always applies to the currently selected area (if it is a leaf). The root area starts as the only selectable piece.

### 2.3 Connectors — the Perimeter Model

A Connector is a first-class entity defined by the relationship between two specific Areas.

- **Shared Perimeter Coordinate (`u`)**: the total shared boundary interface is normalised to `[0, 1]`. The anchor sits at position `u` along that interface. `u=0 → p1`, `u=0.5 → geometric midpoint`, `u=1 → p2` (guaranteed by the vertex-matching implementation of `getSharedPerimeter`).
- **Multi-area boolean logic**: the connector shape is _added_ (union) to its owner piece and _subtracted_ (difference) from every other Area it overlaps.
- **Dormancy**: if two areas are merged the connector's shared perimeter vanishes. It remains in the history log as dormant and is excluded from SVG output. It reappears if the merge is undone.
- **Flip**: `isFlipped = true` means the tab protrudes into `areaA` instead of `areaB`.

### 2.4 Connector Types

| Type | Description | Status |
|---|---|---|
| TAB | Classic rounded interlocking jigsaw tab (cubic Bézier neck + head) | Implemented |
| DOVETAIL | Trapezoidal / dovetail shape | Stub only |
| SQUARE | Rectangular tab | Stub only |
| HEART | Heart-shaped whimsy tab | Stub only |
| NONE | Edge only — no connector | Stub only |

### 2.5 Graph-Based Rendering Model (Topological Engine)

The renderer tracks a global network of unique vertices and edges. A shared edge between two adjacent pieces is stored exactly once. This prevents double-cut paths in laser output and eliminates Z-fighting artifacts in the SVG preview.

The topological engine is the **canonical and preferred backend**. The boolean engine is retained for debugging comparison only.

---

## 3. Tab-Based Pipeline

| Tab | Operations processed | Visualisation |
|---|---|---|
| **1 · Topology** | CREATE_ROOT → SUBDIVIDE | Raw Voronoi fills, seed points |
| **2 · Modification** | SUBDIVIDE → MERGE | Boundary paths (no connectors); merged edges dimmed |
| **3 · Connection** | MERGE → ADD_CONNECTOR | Connector anchors, type/size editor |
| **4 · Resolution** | ADD_CONNECTOR → RESOLVE_CONSTRAINTS | Connector shapes after elastic solver; deleted connectors shown in red |
| **5 · Transformation** | RESOLVE → TRANSFORM_GEOMETRY | Warped final SVG (conformal, polar, etc.) |
| **6 · Production** | TRANSFORM → Export | Kerf-offset paths; single-path extraction; export controls |

Each tab re-executes the history up to its own stage. Earlier operations are locked (read-only) in later tabs.

Stage 5 (`connectors`) early-returns an empty list on TOPOLOGY and MODIFICATION tabs to avoid unnecessary geometry work.

---

## 4. Algorithms

### 4.1 Point Distribution

| Pattern | Algorithm | Parameters | Status |
|---|---|---|---|
| Grid | Regular cell-centred grid with optional jitter | rows, cols, jitter | Implemented |
| Hex | Offset-column hexagonal packing with optional jitter | size, jitter | Implemented |
| Random | Uniform random within bounds | count | Implemented (unseeded) |
| Poisson-disc | Bridson's algorithm | min-distance, seed | Planned |
| Spiral | Fermat / sunflower spiral | count, scale | Planned |
| Manual | User click-placed points | — | Planned |

All patterns should accept a seed for deterministic replay (currently `Math.random()` is used — not seeded).

### 4.2 Topological Engine — Edge Graph

See `01_current_state.md §Topological engine` for the current implementation detail. The full target adds:

- **Bézier edges**: edges store full Bézier path data, not just straight lines, so whimsy boundaries curve correctly through the graph.
- **Spatial indexing**: an R-tree (or QuadTree) over edge AABBs for O(log n) adjacency queries replacing the current O(n²) scan.
- **Compound paths**: faces can have holes (whimsy inner boundaries); the graph handles multiple loops per face.

### 4.3 `getSharedPerimeter` — Vertex Matching

The canonical approach for finding the shared boundary between two adjacent areas (implemented in `geometry.ts`):

1. Iterate all segments of both boundary paths.
2. Collect vertices from A within 1.5 px of any vertex in B (these are the shared corner points).
3. Take the pair with the greatest distance — that is the actual shared edge span.
4. Return a clean open path `M p1 L p2`.

This sidesteps the Paper.js intersection approach, which produced an ambiguously-oriented "double-edge sliver" closed path — a closed path traversing the same edge twice in both directions, with an arbitrary start vertex. That approach made `u=0.5` land at a corner rather than the geometric midpoint.

### 4.4 Warp Engine

Generates a unique "ideal" connector shape for each connector ID and a known seed, without considering local geometry:

- Jitters the Bézier control points of the neck and head within allowable ranges.
- Scales the head slightly (±20 %) for visual variety.
- Output is a stamped path centred at the origin pointing rightward — rotation and translation are applied later.

Location: new file `src/v2/warp_engine.ts` (not yet implemented).

### 4.5 2D Global Elastic Solver

Resolves physical collisions between connector shapes before boolean operations are applied.

#### Connector Representation

Each connector is modelled as a **3-point polyline**: `anchor → midpoint → tip`.

- The **anchor** is fixed at its `u` position on the shared perimeter and does not move.
- The **midpoint** is the single degree of freedom — displacing it bows the connector visually.
- The **tip** direction is determined by the head geometry.

#### Iterative Repulsion Algorithm

```
for each iteration (max N = 100):
  shuffle connector order (seeded for determinism)
  for each pair (A, B):
    if segments of A and B intersect, or any point is within threshold T:
      V = midpoint(B) - midpoint(A)
      push midpoint(A) by -δ along V
      push midpoint(B) by +δ along V
      enforce constraints:
        1. Boundary clamp: midpoint must stay inside parent Area
        2. Angle cap: bend angle at anchor ≤ 45°
  if no collisions remain: break
```

Three-way deadlocks are broken by the random shuffle each iteration; the shuffle seed is recorded in the history log for determinism.

#### Fallback Sequence

| Step | Action |
|---|---|
| 1 | Reduce connector head scale |
| 2 | Shift anchor `u` slightly along the perimeter |
| 3 | Delete connector; log deletion to history |

**Current implementation**: deletion-only (bounding-box overlap → delete second connector). Full elastic solver not yet implemented.

### 4.6 Spatial Transformations (Terminal Step)

Transformations operate on final merged SVG paths _after_ connectors are embedded. The `u`-coordinate system no longer exists after this stage; it is a terminal, non-parametric step.

| Transform | Description |
|---|---|
| Conformal spiral | Complex-plane logarithm / Möbius map |
| Polar warp | Rectangular → polar coordinate remap |
| Free-form mesh | User-defined control-point mesh warp |

Not yet implemented.

### 4.7 Production — Kerf & Export

- **Single-path extraction**: walk the global edge graph and emit each edge exactly once, regardless of how many faces share it.
- **Kerf compensation**: offset each boundary path outward or inward by half the laser beam width using Paper.js `path.offset()` (or equivalent).
- **Layer separation**: outer boundary, internal cuts, whimsy outlines on separate SVG layers.
- **Export formats**: SVG (primary), PDF, DXF (future).

Not yet implemented (button exists in UI, no logic).

---

## 5. State Management

### 5.1 History Stack (JSON)

```json
[
  { "id": "01", "type": "CREATE_ROOT",         "params": { "shape": "rect", "w": 500, "h": 500 } },
  { "id": "02", "type": "SUBDIVIDE",           "params": { "parentId": "root", "pattern": "hex_grid", "seed": 42, "points": [...] } },
  { "id": "03", "type": "MERGE",               "params": { "areaAId": "p1", "areaBId": "p2" } },
  { "id": "04", "type": "ADD_CONNECTOR",       "params": { "areaAId": "p1", "areaBId": "p3", "u": 0.5, "type": "TAB", "size": 20 } },
  { "id": "05", "type": "RESOLVE_CONSTRAINTS", "params": { "mode": "elastic_2d", "seed": 7 } },
  { "id": "06", "type": "TRANSFORM_GEOMETRY",  "params": { "type": "conformal", "map": "spiral" } }
]
```

The history array is the canonical save format. Any session can be resumed by loading it.

### 5.2 Derived State

All computed state is derived from `(history, width, height)`. Nothing persistent is stored outside the history. The 8-stage `usePuzzleEngine` hook implements this as a chain of `useMemo` calls — see `01_current_state.md §The 8-stage pipeline`.

### 5.3 Known Non-Determinism

`Math.random()` is currently used in all three seed patterns (grid jitter, hex jitter, random placement). The same `SUBDIVIDE` operation produces different geometry on replay. Adding a `seed` field to `SUBDIVIDE` and using a seeded PRNG is a planned hardening item.

---

## 6. UI / UX

### 6.1 Creation Modal

On first load, a modal prompts the user to set puzzle dimensions. Presets: Square 600×600, A4 landscape/portrait, 4:3 800×600, 16:9 960×540. Custom W×H (100–4000 px range). Dismisses to the main editor and cannot be re-opened without reloading.

### 6.2 Interaction Model

| Tab | Primary interaction |
|---|---|
| Topology | Select an area → click Split button in action bar to subdivide it |
| Modification | Click area A → click area B → merge |
| Connection | Click a shared edge at the desired position → connector is placed at `u` |
| Resolution | Read-only preview of solver output |
| Transformation | (future) drag control points |
| Production | Export button |

### 6.3 Selection & Editing

- **Area selection**: click fills the action bar with area info and subdivision options.
- **Split buttons disabled** when nothing is selected or the area already has children (`isPiece === false`).
- **Connector selection**: click a connector anchor to open the connector editor (type, size, flip, delete).
- **Undo**: pops the last operation from history; works across all tabs.
- **Delete operation**: any operation can be individually removed from history (re-replay handles cascading effects).

### 6.4 Action Bar Layout

Two permanent rows — the selection row never replaces the tab-controls row:

- **Row 1 (always visible)**: tab-level controls — split pattern inputs and buttons.
- **Row 2 (conditional)**: selection panel showing info about the currently selected area or connector.

This prevents the selection row from covering the split buttons.

### 6.5 Zoom & Pan

Desktop only (mobile uses browser-native gestures):

- **Scroll wheel** → pan (`deltaX`, `deltaY`). Non-passive listener, `preventDefault` to block page scroll.
- **Left drag** on canvas background → pan (4 px move threshold to distinguish from click).
- **Middle mouse** anywhere → pan.
- **Zoom slider** (bottom-left overlay): `−` / range slider / `+` / fit icon.
- **Zoom anchors** to viewport centre.
- **Pan clamping**: at least 120 px of the puzzle always stays inside the viewport.

### 6.6 Engine Toggle

The header exposes a `BOOLEAN / TOPOLOGICAL` toggle during development. The topological engine is the default. The boolean engine remains for debugging comparison.

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Re-render latency | ≤ 100 ms for ≤ 200 pieces |
| Determinism | Same history → identical SVG output (requires seeded RNG — not yet met) |
| Correctness | Total piece area = puzzle area (verified by tests) |
| No double paths | Each internal edge appears exactly once in laser output |
| Kerf precision | ±0.01 mm |

---

## 8. Out of Scope (v1 of this system)

- Post-warp parametric connector editing (connectors are fixed geometry after transformation).
- Multi-layer / 3D puzzle support.
- Cloud save / collaboration.
- Mobile touch-based drawing of whimsy boundaries (keyboard-less input for shape creation).
