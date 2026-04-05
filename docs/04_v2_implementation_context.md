# V2 Implementation Context — For Contributors & Future Work

> Last updated: 2026-04-05  
> Purpose: preserve **engineering context** that is easy to lose across sessions: how the v2 pipeline fits together, recent correctness/performance work, and where to extend without regressions.  
> **Reading order:** `01_current_state.md` (what exists) → `02_design_doc.md` (intent) → `03_next_steps.md` (backlog) → **this file** (how to change things safely).

---

## Why this document exists

The design doc describes the end state; the current-state doc lists files and features. This doc answers:

- What are the **two geometry backends** and how do they differ on **cut geometry**, **overlays**, and **`clipOverlap`**?
- Where does **Paper.js** get set up, and why does that matter for leaks and perf?
- What **caching** exists in `usePuzzleEngine` and what **invariants** must hold when you add features?
- What should you touch first for common tasks (new tab, new connector behavior, export)?

---

## Core mental model

1. **`history[]` is the source of truth.** Everything visible is derived from `(history, width, height)` plus UI-only state (selected tab, selection, engine toggle).

2. **`usePuzzleEngine`** is an ordered pipeline of `useMemo` stages (see `01_current_state.md`). **Topology and `mergedGroups` are produced together** from a single ordered walk over `history` (interleaved `SUBDIVIDE` / `MERGE`). Do not split that ordering without updating DSU replay and merge semantics.

3. **Two render paths for pieces:**
   - **`geometryEngine === 'BOOLEAN'`** — `computeBooleanGeometry` in `boolean_connector_geometry.ts`: collision resolution, **base** pieces (merged boundaries), **cut** pieces (full tab union/subtract + optional third-piece subtract), **preview** pieces (neighbor subtract; owner tab in path or overlay depending on `clipOverlap`), **connectorOverlays** (stamp paths when the tab is not solely in the overlay layer). Single Paper pipeline per update; `resetPaperProject` between phases avoids orphan projects / memory growth when dragging `u`.
   - **`geometryEngine === 'TOPOLOGICAL'`** — `TopologicalEngine`: `getMergedBoundary` + Paper **subtract** stamps from neighbor and (when bounds hit) third pieces; **`clipOverlap` is forced `true`** in the connector list for engine math. **Visualization:** `buildTopoConnectorStampOverlays` supplies **SVG stamp fills for every connector** so tabs always draw **above** piece paths (unlike boolean, where overlays may be omitted when the tab is baked into paths).

The header toggle switches between engines; both are supported for workflow and comparison.

---

## Shared perimeter and `u` (critical)

Connectors store **`u`** along the **shared interface** between two leaf areas. **`getPointAtU` applies `clampConnectorU`:** effective range **`[0.001, 0.999]`** (see `CONNECTOR_U_MIN` / `CONNECTOR_U_MAX` in `geometry.ts`). History and UI sliders use the same clamp on write.

- **`geometry.ts` — `getSharedPerimeter`:** Does **not** use `path.intersect` for the primary result (bad “double sliver” closed paths). It collects points on the shared interface via **vertex–vertex** proximity, **vertex-on-segment** tests (T-junctions: a corner lies on the middle of the neighbor’s edge), **collinear segment overlap**, and **segment–segment intersection**, then returns a **straight open path** `M p1 L p2` between the **two farthest** distinct candidate points (chord).
- **`getPointAtU`:** Arc-length parameter along that path after clamping `u`.

The **Connection tab** preview (purple anchor dots) and both engines use this chord + `getPointAtU`.

---

## Topological engine alignment with boolean/preview

`TopologicalEngine` stores shared boundaries as one or more **straight edges** in graph order. Historically, **`addConnectorToBoundary`** parameterized `u` by **total polyline length** and walked edges in **`face.edgeIds` order**, which could disagree with the chord-based `u` used elsewhere.

**Current behavior:**

- **`sortSharedEdgesAsChain`** — orders edges between two faces into a geometric chain before arc-length math.
- **`addConnectorAtAnchor`** — takes the **same** anchor point as boolean/preview (`getSharedPerimeter` + `getPointAtU`), then **projects** onto the nearest point on the topological polyline and stores the connector there. **`usePuzzleEngine`** (topological branch) uses this for each resolved connector.

If you ever change how `u` is defined (e.g. full polyline arc length everywhere), update **boolean path, preview, and `addConnectorAtAnchor`** together.

---

## Performance: topological caching in `usePuzzleEngine`

Rebuilding `initializeFromVoronoi` and calling **`getMergedBoundary` for every merged group** on every connector tweak was too slow.

**Refs (module of the hook, not React state):**

| Ref | Role |
|-----|------|
| `topoEngineCacheRef` | Holds `{ key, engine }` when the **Voronoi graph + merges** are unchanged. |
| `topoPieceCacheRef` | `Map<groupId, piece>` for **pathData** reuse. |
| `prevConnectorSigRef` / `prevConnectorAreasRef` | Detect **which** connector rows changed or were removed. |
| `lastTopoPiecesRef` | Last full `finalPieces` array for identical-frame short circuit. |

**`topoGeometryKey`:** JSON fingerprint of `width`, `height`, sorted leaf `id`+`boundary`, sorted `mergedGroups`, and MERGE history string. If it changes, the cached engine is discarded and caches are cleared.

**When only connector parameters change** (same key): still run **`clearEdgeConnectors` + reapply all connectors** so the graph is consistent, but call **`getMergedBoundary` only for merged groups that can change** — the two groups incident on each **changed** connector’s `(areaAId, areaBId)` (same pieces a tight bbox around the shared edge would pick).

**Fast path:** No connector signature change + cache complete → return `lastTopoPiecesRef` without touching Paper.

**Invariant:** Partial reuse assumes **unchanged** groups’ boundaries do not depend on connectors on **other** edges. That holds for disjoint shared edges.

---

## UI: `V2Canvas` connector previews

Connector anchor circles used to call `getSharedPerimeter` **per connector per render**, which amplified cost when pan/zoom/hover re-rendered the parent.

**`connectorAnchors`** is computed in **`useMemo`** from `resolvedConnectors`, `topology`, and dimensions so preview geometry only recomputes when connector data or topology changes.

## UI: Topology selection and operations (`App.tsx` / `V2ActionBar`)

- Piece selection is **`mergePickIds`** (toggle taps on canvas pieces). **Split** applies **`subdivideSelectedPieces`**: one **`SUBDIVIDE` op per selected leaf**, appended in one `setHistory` batch.
- **Merged pieces:** `buildSubdivideOperation` supplies **`clipBoundary`** (boolean union of group leaves) and **`absorbedLeafIds`**; seed **bounds** for grid/hex/random use that union’s bbox, not a single leaf only.
- After **split, merge, or delete-piece**, selection is **cleared** to avoid stale ids (e.g. a subdivided parent is no longer `isPiece`).

---

## Paper.js usage notes

- **`resetPaperProject(width, height)`** (`paperProject.ts`) removes the active `paper.project` (if any) then **`paper.setup(new paper.Size(width, height))`**. Call it before any memo that builds paths so **dragging connector parameters** does not leave detached Paper projects (boolean mode was particularly sensitive).
- Paths created for intermediate geometry should be **`remove()`**d when done (the codebase generally does this; keep the pattern when adding code).
- Avoid creating unbounded Paper objects in **render** without memoization.

---

## Tabs and connector visibility

Stages **5–6** (`connectors`, `resolvedConnectors`) early-exit empty on **TOPOLOGY** and **MODIFICATION** tabs to avoid work where the UI does not show connectors (`01_current_state.md`). If you add operations that must run earlier, check `activeTab` gating.

---

## Production tab and export

- **Canvas:** `finalPieces` only, drawn as **stroke-only** contours in `V2Canvas` (no fills). **`connectorOverlays` passed as `[]`** from `App.tsx` on Production so tab graphics do not sit above cut lines.
- **Download:** `exportCutSvg` in `App.tsx` builds an SVG with **`fill="none"`** and **stroke** per piece from `finalPieces` (same geometry as Production preview).

---

## Boolean vs topological — connector preview summary

| Aspect | BOOLEAN | TOPOLOGICAL |
|--------|---------|-------------|
| `clipOverlap` in history | Honoured (`true` / `false`) | **Forced `true`** for engine; checkbox disabled in action bar |
| Cut / `finalPieces` | `booleanGeometry.cutPieces` | Topo merged boundary + subtracts |
| Tab on canvas | Mix of path + `connectorOverlays` (see `buildConnectorOverlaysCore`) | **Always** full stamp overlays via `buildTopoConnectorStampOverlays` |
| Production | Stroke contours, no overlay | Same |

---

## How to extend v2 (practical map)

| Goal | First places to read / edit |
|------|-------------------------------|
| New seed pattern | `geometry.ts` point generators, `SUBDIVIDE` handling in `usePuzzleEngine`, `V2ActionBar` |
| Merge / DSU behavior | `mergedGroups` memo, `TopologicalEngine.mergeFaces` |
| Connector shape / solver | `geometry.ts` (`createConnectorStamp`, `resolveCollisions`), future `warp_engine` / elastic solver (`03_next_steps.md`) |
| Topological boundary / splice | `topology_engine.ts` (`getMergedBoundary`, `getEdgePath`) |
| Export / production | **Stroke SVG export** from `finalPieces` (`App.tsx`); kerf / edge-walk / layers — `03_next_steps.md` Phase 6 |
| Perf (slider drag) | Optional **throttle** on `updateConnector` in `App.tsx` / `V2ActionBar` — history updates would fire less often while dragging `u` |

---

## Tests and lint

```bash
npm test   # Vitest, node environment
npm run lint  # tsc --noEmit
```

Geometry-heavy tests live under `src/v2/*.test.ts`. When changing `getSharedPerimeter`, connector placement, or `TopologicalEngine`, add or extend a test if behavior is non-obvious.

---

## Gaps explicitly left for later

- **Throttle / debounce** connector `u` updates while dragging the slider (UX/perf).
- **Single `u` semantics on a bent multi-segment shared boundary** — chord (current `getSharedPerimeter`) vs full polyline length; if you unify on polyline, update all three consumers (boolean, preview, topo).
- **Spatial index** for shared-edge discovery (still O(n²) in places) — `03_next_steps.md` Phase 1.5.
- **Seeded RNG** for random subdivide — `03_next_steps.md` Phase 1.1.

These are intentionally out of scope for small fixes; track them in `03_next_steps.md` or issues.

---

## Summary

V2 progress stays fast and correct when you: (1) treat **history** as canonical, (2) keep **boolean / preview / `addConnectorAtAnchor`** agreeing on connector anchors and **`u` clamping**, (3) preserve **topological caching invariants** when changing `getMergedBoundary` or connector application order, (4) avoid **Paper churn in render** without `useMemo` or pipeline-level caching, and (5) use **`resetPaperProject`** when entering any `useMemo` that runs Paper booleans.
