# Jigsaw Studio V2 — Hierarchical Area Design Document

## 1. Overview

This document outlines the architecture for a deterministic, action-based puzzle design application. The system uses a hierarchical **Area** model and a persistent event-log to generate complex geometries (traditional jigsaws, whimsies, and recursive subdivisions) optimized for laser cutting.

---

## 2. Core Concepts & Data Representation

### 2.1. The Area Hierarchy

- **The Universal Unit:** The **Area** is the fundamental block of the puzzle. The entire puzzle is the root Area.
- **Tree Structure:** Every Area (except the root) has a parent. A "Piece" is simply a leaf-node Area.
- **Whimsy Implementation:** A whimsy is an Area with a custom SVG boundary. It acts as a hard constraint:
  - **Internal pieces** expand only to the whimsy's inner boundary.
  - **External pieces** expand only to the whimsy's outer boundary.
- **Recursive Subdivision:** Any Area (including a whimsy) can be further subdivided into child Areas, inheriting the parent's boundary constraints and transformations.

### 2.2. Expansion & Generation Logic

The subdivision of space follows a deterministic expansion rule:

- **Point Distribution:** Generation begins with seeds placed in specific patterns (Poisson Disc, Square Grid, Hex Grid centers, Spirals, or Manual placement).
- **Voronoi Foundation:** Initial shapes are generated via a Voronoi diagram based on these seeds.
- **Expansion Rule:** Pieces are represented by a point; they conceptually "expand" from that seed until they reach the boundary of their **Parent Area** or the edge of a **Sibling Area**.
- **Edge States:** The edge between two siblings can be set to `none`, which functionally merges the two areas into one.

> **Note on boundary clipping:** Voronoi cells that extend beyond the root Area boundary must be clipped. How this clipping interacts with the perimeter coordinate system for edge pieces should be handled explicitly — edge pieces will have one or more sides whose shared perimeter is the puzzle boundary itself, and connectors should not be placed on those sides.

### 2.3. Connectors (The "Perimeter" Model)

Connectors are first-class entities defined by the relationship between two specific Areas.

- **Shared Perimeter Coordinate System:** The system identifies the total shared boundary interface **P**. The total length of **P** is normalized to `[0, 1]` (the `u` coordinate).
- **Anchoring:** A connector is anchored at a specific `u` value. If the areas are non-convex or contain holes, the connector remains anchored to the shared perimeter regardless of shape complexity.
- **Multi-Area Boolean Logic:** A connector is **added** (union) to its owner piece and **subtracted** (difference) from *every* other Area it overlaps. This ensures clean cuts even when a connector sits on a corner junction of multiple pieces.
- **Dormancy:** If two areas are merged (edge = `none`), the shared perimeter **P** vanishes. The connector remains in the history log as "dormant" and is omitted from the SVG output. It reappears if the merge is undone.

---

## 3. Tab-Based Pipeline Architecture

The application is organized into specialized tabs that execute the history stack in order.

| Tab | Action Range | Focus | Visualization |
|:----|:-------------|:------|:--------------|
| **1. Topology** | Create → Subdivide | Grids, Spirals, Whimsy placement | Raw paths, seed points |
| **2. Modification** | Subdivide → Merge | Nesting areas, merging pieces | Boundary paths (no tabs) |
| **3. Connection** | Merge → Add/Warp | Placement, head types, aesthetic warping | Symbols & Anchors |
| **4. Resolution** | Add → Elastic Solver | 2D Global Collision fixing, rod bending | Warped shapes + Bending |
| **5. Transformation** | Resolve → Warp | Conformal mappings, Distortions | Warped final SVG paths |
| **6. Production** | Warp → Export | Kerf offsets, Path extraction | Final Cut Geometry |

> **Pipeline re-entry:** The tabs imply a strict ordering. If a user modifies a connector in Tab 3 after Tab 5 has already run, all downstream tabs (4, 5, 6) are invalidated and must be re-executed. The UI should clearly indicate which tabs are stale and require re-running, to avoid confusion from outdated geometry being shown.

---

## 4. Algorithms & Operations

### 4.1. The Warp Engine & 2D Global Elastic Solver

This stage defines the physical form and location of the connectors before final boolean operations.

#### Warp Engine

Generates a unique "ideal" shape for each connector (jittering vertices and scaling the head) based on the connector ID and a known seed. It does not consider local geometry at this step.

#### 2D Global Elastic Solver

Unlike a simple 1D slider, this solver treats connectors as physical entities capable of interacting across the entire Area.

- **Scope:** Resolves overlaps for *any* connectors that collide, regardless of whether they share a perimeter. This addresses cases where pieces are thin and connectors from opposite sides overlap in the center.
- **Elastic Rod Physics:** Connector rods are treated as flexible segments.
- **Bending & Shifting:** If a collision is detected, the solver applies repulsive forces to bend the rod or shift the anchor `u` coordinate along the perimeter to find a collision-free equilibrium.
- **Deletion Fallback:** If the local geometry is too cramped to resolve through bending/shifting, the connector is scaled down or deleted to maintain a valid cut-path.

See **Section 4.3** for the full collision resolution algorithm.

### 4.2. Spatial Transformations (Terminal SVG Step)

Transformations are applied as the final terminal step in the geometry pipeline, operating directly on the resulting SVG paths of the pieces and their connectors.

- **Path-Level Distortion:** Mappings (Conformal, Polar, etc.) operate on the raw vertex data of the final merged SVG paths after the connectors have been added/subtracted.
- **Loss of Parametrics:** Once transformed at this stage, the concept of the `u` coordinate for connector placement is lost; the connectors are now integrated, warped components of the piece geometry. Post-warp connector editing is therefore a manual SVG operation and is considered out of scope for the parametric pipeline.
- **Warping Outcomes:** This ensures the connectors "flow" with the overall distortion of the puzzle (e.g., curved along with a conformal spiral), ensuring mathematical and visual alignment.

---

### 4.3. Connector Collision Resolution

This section describes the iterative repulsion algorithm used to resolve overlapping connectors before boolean operations are applied.

#### Connector Representation

Each connector is modelled as a **3-point polyline**:

```
anchor → midpoint → tip
```

- The **anchor** is fixed at its `u` position on the shared perimeter and does not move.
- The **tip** direction is determined by the connector head geometry.
- The **midpoint** is the single degree of freedom manipulated by the solver. Displacing it causes the connector to visually "bow" to one side, producing a natural-looking bent tab.

#### Algorithm

```
for each iteration (max N):
    for each pair of connectors (A, B):
        if segments of A and B intersect, or any point is within threshold T:
            compute vector V from midpoint(A) to midpoint(B)
            push midpoint(A) by -δ along V
            push midpoint(B) by +δ along V
    if no collisions remain:
        break
```

After each midpoint displacement, two constraints are enforced:

1. **Boundary clamp:** The midpoint must remain inside the parent Area. If the displacement would push it outside, it is clamped to the boundary.
2. **Angle cap:** The bend angle at the anchor must not exceed a maximum (e.g., 45°). This prevents connectors from folding back on themselves and producing invalid cut geometry.

#### Fallback Sequence

If the solver reaches the maximum iteration count and collisions remain unresolved, the following fallback steps are applied in order:

| Step | Action |
|:-----|:-------|
| 1 | Reduce connector head scale |
| 2 | Shift anchor `u` slightly along the perimeter |
| 3 | Delete the connector entirely |

Deletion is logged to the history stack so it can be inspected and overridden manually.

#### Three-Way Collision Handling

Pairwise repulsion can oscillate when three or more connectors converge in a tight area, as each pair's push may counteract another. The practical fix is to **shuffle the resolution order randomly at the start of each iteration**. This breaks the symmetric deadlock and allows the system to reach equilibrium in practice, though it introduces minor non-determinism in the final midpoint positions. If strict determinism is required, the shuffle seed can be fixed and recorded in the history log.

#### Complexity Note

The naive pairwise check is O(n²) per iteration. For typical puzzle piece counts this is negligible, but if large puzzles with hundreds of connectors per area are supported, a spatial index (e.g., a grid or bounding-box broadphase) can be used to reduce the collision candidate set before the detailed segment tests.

---

## 5. State Management & Output

### 5.1. History Stack (JSON Representation)

Every action is recorded to allow full deterministic replay.

```json
[
  { "id": "01", "action": "CREATE_ROOT",         "params": { "shape": "rect", "w": 500, "h": 500 } },
  { "id": "02", "action": "SUBDIVIDE",            "params": { "parent": "01", "type": "hex_grid", "seed": 42 } },
  { "id": "03", "action": "ADD_CONNECTOR",        "params": { "between": ["p1", "p2"], "u": 0.5, "head": "heart" } },
  { "id": "04", "action": "RESOLVE_CONSTRAINTS",  "params": { "mode": "elastic_2d", "shuffle_seed": 7 } },
  { "id": "05", "action": "TRANSFORM_GEOMETRY",   "params": { "type": "conformal", "map": "spiral" } }
]
```

> The `shuffle_seed` parameter in `RESOLVE_CONSTRAINTS` preserves determinism when the three-way collision shuffle is used (see Section 4.3).

### 5.2. Output Optimization

- **Single-Path Extraction:** Extracts unique resolved edges to prevent double-cutting.
- **Kerf Compensation:** Optional path offsetting to account for the laser beam width.
