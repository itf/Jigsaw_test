# Next Steps & Implementation Plan

> Reading order: read `01_current_state.md` and `02_design_doc.md` first.

Each work item is labelled with an estimated complexity bracket:
- **S** — a few hours / self-contained
- **M** — 1–3 days
- **L** — 3–7 days

Items are roughly ordered by dependency; later items generally depend on earlier ones.

---

## Phase 1 · Harden the Existing Core

These items fix correctness gaps in the already-implemented topology pipeline before building on top of it.

### 1.1 Fix the `getSharedPerimeter` / DSU mismatch  (S)
**Problem**: `mergedGroups` (Stage 3) calls `getSharedPerimeter` on raw leaf areas. If two leaves were brought together by a series of MERGE ops rather than being directly adjacent, the DSU might miss the union.  
**Fix**: Run `getSharedPerimeter` only between leaves that the DSU might plausibly merge — i.e., limit the cross-product to leaves whose bounding boxes overlap. Also consolidate `MERGE_AREAS` into `MERGE` (the duplicate op type).

### 1.2 Seed all random patterns  (S)
**Problem**: `Math.random()` is called in `generateGridPoints`, `generateHexPoints`, and the RANDOM pattern, so the same history produces different geometry on replay.  
**Fix**: Add a `seed` field to each `SUBDIVIDE` operation and pass it to a seeded PRNG (e.g. a simple mulberry32 or xoshiro128 implementation in `shared/utils.ts`). Use the seed for jitter and random point placement.

### 1.3 Add Poisson-disc and spiral seed patterns  (M)
The design calls for these two patterns. Bridson's algorithm for Poisson-disc is well understood and ~50 lines. Fermat spiral is ~10 lines. Both should live in `geometry.ts` alongside `generateGridPoints`.

### 1.4 Replace O(n²) shared-edge scan with a spatial index  (M)
**Problem**: Stage 4 (shared edges) is O(n²) and is already gated behind a 200-piece limit. Stage 3 DSU also calls `getSharedPerimeter` in an O(n²) cross-product.  
**Fix**: Build a lightweight AABB index over leaf-area bounding boxes (a flat 2D grid bucket is sufficient). Only test pairs whose bounding box cells overlap. This should push the practical limit to ~2000 pieces without perceptible lag.

### 1.5 Correct connector splice orientation  (M)
**Problem**: The current `getEdgePath` splicing logic in `topology_engine.ts` always adds the full stamp path including its base segment, which may create small self-intersecting loops at the connector anchor points. The logic for determining `reversed` also needs a right-hand-rule check against the enclosed face.  
**Fix**: In `getEdgePath`, after rotating and translating the stamp, trim the first and last point of the stamp where they coincide with the edge (within epsilon), so the splice is seamless. Add a unit test that checks the resulting boundary has no self-intersections.

---

## Phase 2 · Connector Resolution (Elastic Solver)

This is the most algorithmically complex unimplemented piece.

### 2.1 Implement `Connector.midpoint` population  (S)
The `midpoint` field is declared in `types.ts` but never set. Before implementing the solver, wire it up: after `createConnectorStamp` runs, record the midpoint (neck centre) and store it back on the `Connector` object in `resolveCollisions`.

### 2.2 Implement the Warp Engine  (M)
Generates a deterministically randomised "ideal" shape for each connector given only its ID and a global seed:
- Jitter Bézier control points for neck and head within ±15 % of nominal.
- Scale head ±20 %.
- Store jitter parameters in the Connector record so they survive history replay.

Location: new file `src/v2/warp_engine.ts`.

### 2.3 Implement the 3-point Elastic Solver  (L)

Replace the deletion-only `resolveCollisions` in `geometry.ts` with the iterative repulsion algorithm described in `02_design_doc.md §4.4`.

Key sub-tasks:
1. Model each connector as anchor (fixed) + midpoint (free) + tip (computed from head geometry).
2. Segment-segment intersection test for pairs (can reuse Paper.js `PathItem.getIntersections`).
3. Repulsion force: push midpoints apart along the overlap vector.
4. Constraint enforcement: boundary clamp (point-in-polygon using Paper.js `path.contains`) and 45° angle cap.
5. Three-way deadlock fix: shuffle pair order each iteration using the seeded RNG.
6. Fallback sequence: scale-down → `u`-shift → deletion (log each deletion to history).
7. Record shuffle seed in the `RESOLVE_CONSTRAINTS` history entry.

Tests to add:
- Two connectors on adjacent parallel edges that would overlap without the solver → after solving they do not intersect.
- Three connectors in a tight triangle → solver either resolves or falls back gracefully.
- Solver output is identical given the same seed.

### 2.4 Expose RESOLUTION tab visualisation  (S)
After the solver runs, render each connector's actual bent shape (not just a circle anchor). Show deleted connectors in red with a tooltip. Allow the user to click a deleted connector and manually re-enable it or adjust its `u` position.

---

## Phase 3 · Additional Connector Types

### 3.1 Implement SQUARE, DOVETAIL, HEART types  (M each)
Each type needs:
1. A stamp generator function in `geometry.ts` (parallel to the existing `TAB` branch in `createConnectorStamp`).
2. Visual preview in the connector editor.
3. At least one unit test verifying the stamp is closed and has the expected bounding box proportions.

**SQUARE**: simple rectangle, no curves.  
**DOVETAIL**: trapezoidal — narrow at base, wide at head, straight sides.  
**HEART**: parametric heart curve using Bézier approximation.

---

## Phase 4 · Whimsy Pieces

### 4.1 Whimsy boundary definition  (M)
Allow the user to draw or import a custom SVG path as a whimsy boundary. Store the path data in a new `ADD_WHIMSY` operation:
```json
{ "type": "ADD_WHIMSY", "params": { "parentId": "root", "boundary": "<svg path>", "seedPoint": {...} } }
```

### 4.2 Whimsy inner/outer clipping  (L)
When a whimsy Area is added:
- Adjacent external pieces clip to the whimsy's _outer_ boundary.
- Any further subdivision inside the whimsy clips to its _inner_ boundary.
This requires tracking two boundary paths per WHIMSY area and adjusting the clip step in Stage 2 of `usePuzzleEngine`.

### 4.3 Whimsy in the topological engine  (M)
Whimsy boundaries are curved Bézier paths, not polygon outlines. The `initializeFromVoronoi` function currently only creates straight-line edges. The engine needs to store full Bézier path data per edge (`pathData` field already exists but is always a straight `M … L …`). Populate it from the clipped boundary segments.

---

## Phase 5 · Spatial Transformations

### 5.1 Conformal / polar transforms  (L)
After `getMergedBoundary` returns SVG paths, apply a vertex-level mapping:
- **Polar**: `(x, y) → (r·cos θ, r·sin θ)` with `r = y/H`, `θ = 2π·x/W`.
- **Conformal spiral**: complex logarithm `w = log(z)` in the complex plane.

Both operate on the raw segment points and control points of the path. Implement in a new `src/v2/transforms.ts` module. Apply in Stage 7 when the `TRANSFORM_GEOMETRY` op is present in history.

### 5.2 Transformation UI  (M)
Tab 5 shows a picker for transform type and parameters (scale, centre, rotation). Changes append a `TRANSFORM_GEOMETRY` operation (replacing any previous one).

---

## Phase 6 · Production Export

### 6.1 Single-path extraction  (M)
Walk the edge graph. Each edge that is a boundary edge (one adjacent face) is emitted once as a cut path. Internal edges (two adjacent faces) are emitted as score or engrave paths if desired. Output as a flat SVG `<path>` with no fills.

### 6.2 Kerf compensation  (S)
Apply a path offset of `kerf/2` outward on exterior boundary edges and inward on interior edges using Paper.js path offsetting. Expose a `kerf` parameter (default 0.1 mm) in the Production tab.

### 6.3 SVG layer export  (S)
Emit an SVG file with named `<g>` layers: `outer-boundary`, `internal-cuts`, `whimsy-outlines`, `engrave`. Include a viewBox in mm (requires knowing the physical scale: px-per-mm parameter in Production tab).

---

## Testing Plan

### Unit Tests (Vitest, headless Paper.js)

| Test file | What to cover |
|---|---|
| `topology_engine.test.ts` (extend existing) | T-junction in Voronoi output; merging non-adjacent areas correctly rejected; compound-face (whimsy hole) boundary traversal |
| `geometry.test.ts` | Each seed pattern produces points within the bounding rect; `getPointAtU` at `u=0`, `u=0.5`, `u=1`; connector stamp closes correctly; DOVETAIL / SQUARE / HEART stamps have expected aspect ratios |
| `elastic_solver.test.ts` (new) | Two overlapping connectors resolve without intersection; determinism given seed; deletion fallback when too cramped; three-connector triangle |
| `warp_engine.test.ts` (new) | Same connector ID + seed → identical jitter; jitter stays within allowed range |
| `transforms.test.ts` (new) | Polar transform of a rectangle has correct area; conformal map is bijective on a test polygon |
| `export.test.ts` (new) | Each edge appears at most once in single-path output; kerf-compensated path is offset by exactly `kerf/2` |

### Integration Tests

| Scenario | Assertion |
|---|---|
| 4×4 grid subdivide → merge pairs → add connectors → resolve | No deleted connectors; total path area = puzzle area |
| Full pipeline on hex grid with conformal transform | SVG output is valid; no self-intersecting paths |
| History serialise → deserialise → re-replay | Identical `finalPieces` output |

### Visual / Manual Tests

- Open the app, subdivide with Hex, switch to BOOLEAN and TOPOLOGICAL: pieces should look identical.
- Add 5 connectors on a small grid, enable RESOLUTION: check solver bends tabs visually.
- Subdivide a piece recursively (child of a child): verify grandchild areas render correctly.

### Performance Benchmarks (target baselines)

| Scenario | Max latency |
|---|---|
| 200 pieces subdivide | < 500 ms |
| 1000 pieces with spatial index (Phase 1.4) | < 2 s |
| Elastic solver, 50 connectors, 100 iterations | < 200 ms |

---

## Suggested Order of Work

```
Phase 1 (1–2 weeks)
  1.1 Fix DSU / merge correctness
  1.2 Seed random patterns
  1.4 Spatial index for shared-edge scan
  1.5 Connector splice orientation fix
  1.3 Poisson-disc + spiral patterns

Phase 2 (2–3 weeks)
  2.1 Populate midpoint
  2.2 Warp engine
  2.3 Elastic solver (core + fallbacks)
  2.4 Resolution tab visualisation

Phase 3 (1 week)
  3.1 SQUARE, DOVETAIL, HEART connector types

Phase 4 (2–3 weeks)
  4.1 Whimsy boundary definition
  4.2 Whimsy clipping
  4.3 Bézier edges in topological engine

Phase 5 (1–2 weeks)
  5.1 Conformal + polar transforms
  5.2 Transformation UI

Phase 6 (1 week)
  6.1 Single-path extraction
  6.2 Kerf compensation
  6.3 SVG layer export
```

Total estimated range: **8–13 weeks** of focused engineering.
