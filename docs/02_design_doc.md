# Design Document & PRD — Puzzle Designer Application

> Status: working draft  
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

- **Seed patterns**: Poisson-disc (primary), square grid, hexagonal grid, spiral, manual placement.
- **Voronoi**: seed points generate initial cell shapes via Delaunay triangulation.
- **Clipping**: each cell is clipped to its parent Area boundary using Paper.js path intersection.
- **Merging**: the edge between two siblings can be set to `none`, functionally joining them. The topological engine marks the shared edge as interior; the connector on that edge becomes dormant.

### 2.3 Connectors — the Perimeter Model

A Connector is a first-class entity defined by the relationship between two specific Areas.

- **Shared Perimeter Coordinate (`u`)**: the total shared boundary interface is normalised to `[0, 1]`. The anchor sits at position `u` along that interface.
- **Multi-area boolean logic**: the connector shape is _added_ (union) to its owner piece and _subtracted_ (difference) from every other Area it overlaps.
- **Dormancy**: if two areas are merged the connector's shared perimeter vanishes. It remains in the history log as dormant and is excluded from SVG output. It reappears if the merge is undone.

### 2.4 Connector Types

| Type | Description |
|---|---|
| TAB | Classic rounded interlocking jigsaw tab (implemented) |
| DOVETAIL | Trapezoidal / dovetail shape |
| SQUARE | Rectangular tab |
| HEART | Heart-shaped whimsy tab |
| NONE | Edge only — no connector |

### 2.5 Graph-Based Rendering Model

The renderer tracks a global network of unique vertices and edges. A shared edge between two adjacent pieces is stored exactly once. This prevents double-cut paths in laser output and eliminates Z-fighting artifacts in the SVG preview.

**Edge AABB for boolean impact isolation**: before running a Paper.js boolean operation, the system queries a spatial index of edge bounding boxes (including Bézier curve extrema, not just control-point bounds) to identify the minimal Impact Zone. Paper.js boolean math runs only on those edges.

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

---

## 4. Algorithms

### 4.1 Point Distribution

| Pattern | Algorithm | Parameters |
|---|---|---|
| Grid | Regular cell-centred grid with optional jitter | rows, cols, jitter |
| Hex | Offset-column hexagonal packing with optional jitter | size, jitter |
| Poisson-disc | Mitchell's best-candidate or Bridson's algorithm | min-distance, seed |
| Spiral | Fermat / sunflower spiral | count, scale |
| Manual | User click-placed points | — |

All patterns accept a seed for deterministic replay.

### 4.2 Topological Engine — Edge Graph

See `01_current_state.md §TopologicalEngine` for the current implementation. The full target adds:

- **Bézier edges**: edges store full Bézier path data, not just straight lines, so whimsy boundaries curve correctly through the graph.
- **Spatial indexing**: an R-tree (or QuadTree) over edge AABBs for O(log n) adjacency queries replacing the current O(n²) scan.
- **Compound paths**: faces can have holes (whimsy inner boundaries); the graph handles multiple loops per face.

### 4.3 Warp Engine

Generates a unique "ideal" connector shape for each connector ID and a known seed, without considering local geometry:

- Jitters the Bézier control points of the neck and head within allowable ranges.
- Scales the head slightly (±20 %) for visual variety.
- Output is a stamped path centred at the origin pointing rightward — rotation and translation are applied later.

### 4.4 2D Global Elastic Solver

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

#### Complexity

Naïve pairwise: O(n²) per iteration — acceptable for typical piece counts. A spatial broadphase (grid or AABB tree) can reduce this for large puzzles.

### 4.5 Boolean Impact Zone Isolation (Graph-Based)

When a boolean operation (connector union/subtract) is needed:

1. **Build edge AABBs**: for Bézier edges, use Paper.js `curve.bounds` (finds derivative roots) for tight bounds.
2. **Spatial query**: find all edges whose AABB overlaps the tool shape's AABB.
3. **Loop tracing**: DFS right-hand-rule traversal of the isolated sub-graph to form closed Paper.js paths.
4. **Paper.js operation**: run the union or subtract on the minimal path set.
5. **Re-integration**: decompose the result into vertices and edges; deduplicate against the global graph using a spatial hash (epsilon = 0.001 px); remove obsolete edges.

### 4.6 Spatial Transformations (Terminal Step)

Transformations operate on final merged SVG paths _after_ connectors are embedded. The `u`-coordinate system no longer exists after this stage; it is a terminal, non-parametric step.

| Transform | Description |
|---|---|
| Conformal spiral | Complex-plane logarithm / Möbius map |
| Polar warp | Rectangular → polar coordinate remap |
| Free-form mesh | User-defined control-point mesh warp |

### 4.7 Production — Kerf & Export

- **Single-path extraction**: walk the global edge graph and emit each edge exactly once, regardless of how many faces share it.
- **Kerf compensation**: offset each boundary path outward or inward by half the laser beam width using Paper.js `path.offset()` (or equivalent).
- **Layer separation**: outer boundary, internal cuts, whimsy outlines on separate SVG layers.
- **Export formats**: SVG (primary), PDF, DXF (future).

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

All computed state is derived from `(history, width, height)`. Nothing persistent is stored outside the history.

---

## 6. UI / UX

### 6.1 Interaction Model

| Tab | Primary interaction |
|---|---|
| Topology | Click canvas → subdivide parent area at cursor; or use action bar presets |
| Modification | Click area A → click area B → merge |
| Connection | Click shared edge at desired `u` → connector is placed |
| Resolution | Read-only preview of solver output |
| Transformation | (future) drag control points |
| Production | Export button |

### 6.2 Selection & Editing

- **Area selection**: click fills the action bar with area info and subdivision options.
- **Connector selection**: click a connector anchor to open the connector editor (type, size, flip, delete).
- **Undo**: pops the last operation from history; works across all tabs.
- **Delete operation**: any operation can be individually removed from history (re-replay handles cascading effects).

### 6.3 Engine Toggle

The header exposes a `BOOLEAN / TOPOLOGICAL` toggle during development. The topological engine is the default. The boolean engine remains for debugging comparison.

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Re-render latency | ≤ 100 ms for ≤ 200 pieces |
| Determinism | Same history → identical SVG output (requires seeded RNG) |
| Correctness | Total piece area = puzzle area (verified by tests) |
| No double paths | Each internal edge appears exactly once in laser output |
| Kerf precision | ±0.01 mm |

---

## 8. Out of Scope (v1 of this system)

- Post-warp parametric connector editing (connectors are fixed geometry after transformation).
- Multi-layer / 3D puzzle support.
- Cloud save / collaboration.
- Mobile touch-based drawing of whimsy boundaries (keyboard-less input for shape creation).
