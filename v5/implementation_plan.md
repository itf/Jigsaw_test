# V5 Implementation Plan

## Context
V3 stores each puzzle piece as a closed Paper.js path. The boundary between two adjacent pieces is duplicated (stored in both pieces with opposite winding). Boolean operations (intersect/unite/subtract) introduce floating-point drift that causes gaps and slivers. V5 replaces this with a planar graph where each boundary edge exists exactly once, eliminating the need for boolean operations. The approach is: Node/Edge/Face types, edge-splicing for connectors/whimsies, and face traversal (left-turn rule) to derive piece shapes from the graph topology.

**Whimsy lifecycle:** Whimsies are "floating" (above the canvas, draggable) until explicitly merged. Once merged they become graph faces and can have connectors added.

**Connector model:** Connectors are addressed by `midEdgeId + midT + direction + p1/p2/replacedSegment`. The source face is derived at runtime from `edge.leftFace`/`edge.rightFace` + `direction` — never stored in the connector.

---

## Connector Placement Model (critical design)

### Data structure
```typescript
interface ConnectorV5 {
  id: string;
  midEdgeId: string;       // edge the user clicked
  midT: number;            // [0,1] click position on that edge
  direction: 'in' | 'out';// 'out' = protrudes into edge.rightFace (source face = edge.leftFace)
                           // 'in'  = protrudes into edge.leftFace  (source face = edge.rightFace)
                           // faceId is NOT stored; derived from edge.leftFace/rightFace + direction at runtime

  // Computed at placement time, updated on remap:
  p1: { edgeId: string; t: number };
  p2: { edgeId: string; t: number };
  // Ordered edge-refs from p1 to p2 along the source face boundary (CCW).
  // All edges in this list get deleted at bake time.
  replacedSegment: Array<{ edgeId: string; reversed: boolean }>;

  // Shape params:
  widthPx: number;
  extrusion: number;
  headTemplateId: string;
  headScale: number;
  headRotationDeg: number;
  useEquidistantHeadPoint?: boolean;
  jitter?: number;
  jitterSeed?: number;
  disabled?: boolean;
  neckShape?: NeckShape;
  neckCurvature?: number;
  extrusionCurvature?: number;
}
```

### Direction and face boundary walk
- `direction: 'out'` → source face = `edge.leftFace`. Walk along that face's boundary.
- `direction: 'in'`  → source face = `edge.rightFace`. Walk along that face's boundary.

Critical at 3-way nodes: the correct boundary to walk depends on which face the connector protrudes *out from*, not which face it points into.

### Computing p1/p2 (placement time)
1. Derive source face from `midEdgeId + direction`.
2. Walk backward from `midT * edgeLength` by `widthPx / 2` along source face boundary → `p1 = { edgeId, t }` (may be on a prior edge).
3. Walk forward by `widthPx / 2` → `p2 = { edgeId, t }` (may be on a later edge).
4. `replacedSegment` = all edge-refs encountered between p1 and p2. May span multiple edges and multiple nodes.

### Connector remapping on edge split
When any operation splits edge `E` into `E_left` + `E_right`:
- Remap `p1`/`p2` if they reference `E`.
- Update any `replacedSegment` that contains `E`.
- Auto-remap, no user action needed.

---

## Bake-time Connector Splicing (`bakeConnector`)

Given connector C with `p1`, `p2`, `replacedSegment`:

1. **Split edges at p1 and p2** → create nodes `N1`, `N2`. Update `replacedSegment`.
2. **Intersect connector with adjacent edges** that partially overlap connector geometry. Apply Case 2/3 splice.
3. **Delete swallowed intermediate nodes:**
   - For each intermediate node `N_mid`: if connector path contains it, intersect all incident edges with connector boundary and update their endpoints. Then delete `N_mid`.
   - **Edge case:** if an edge still references `N_mid` after intersecting (connector geometry doesn't reach it), find closest point on connector, create `N_new` there, split connector path at `N_new`, add bridging edge from `N_mid` to `N_new`.
4. **Delete replaced edges** (now just portions between N1 and N2).
5. **Insert connector edge** from `N1` to `N2`, inheriting `leftFace`/`rightFace`.
6. **Update faces** whose edge lists contained deleted edges.

---

## Phase 1: Copy Files → `src/v5/` (self-contained)

All copies use `cp` / `cp -r` in terminal:

```
src/v3/components/V3Header.tsx           → src/v5/components/V5Header.tsx
src/v3/components/V3Navigation.tsx       → src/v5/components/V5Navigation.tsx
src/v3/components/V3ActionBar.tsx        → src/v5/components/V5ActionBar.tsx
src/v3/components/V3CreateModal.tsx      → src/v5/components/V5CreateModal.tsx
src/v3/components/V3ProductionTab.tsx    → src/v5/components/V5ProductionTab.tsx
src/v3/components/V3DebugPage.tsx        → src/v5/components/V5DebugPage.tsx  (rewritten Phase 7)
src/v3/components/StampPanel.tsx         → src/v5/components/StampPanel.tsx
src/v3/components/WhimsyLibrary.tsx      → src/v5/components/WhimsyLibrary.tsx
src/v3/components/GroupTemplatePanel.tsx → src/v5/components/GroupTemplatePanel.tsx
src/v3/components/controls/             → src/v5/components/controls/
src/v3/components/ui/                   → src/v5/components/ui/
src/v3/hooks/usePersistence.ts          → src/v5/hooks/usePersistence.ts
src/v3/utils/connectorUtils.ts          → src/v5/utils/connectorUtils.ts
src/v3/utils/headUtils.ts               → src/v5/utils/headUtils.ts
src/v3/utils/neckUtils.ts               → src/v5/utils/neckUtils.ts
src/v3/utils/paperUtils.ts              → src/v5/utils/paperUtils.ts
src/v3/utils/gridUtils.ts               → src/v5/utils/gridUtils.ts
src/v3/utils/whimsyGallery.ts           → src/v5/utils/whimsyGallery.ts
src/v3/utils/initialArea.ts             → src/v5/utils/initialArea.ts
src/v3/utils/pathMergeUtils.ts          → src/v5/utils/pathMergeUtils.ts
src/v3/utils/serializationUtils.ts      → src/v5/utils/serializationUtils.ts  (rewritten Phase 9)
src/v3/utils/fileUtils.ts               → src/v5/utils/fileUtils.ts
src/v3/types/groupTemplateTypes.ts      → src/v5/types/groupTemplateTypes.ts
src/v3/utils/production/               → src/v5/utils/production/
```

Post-copy fixes:
- All `../../v3/...` / `../v3/...` imports → local v5 paths
- Rename `V3Xxx` exports → `V5Xxx` in file body and export name
- `usePersistence.ts`: key `'jigsaw_studio_v3_state'` → `'jigsaw_studio_v5_state'`; guard on `rootFaceId`
- `GraphManager.ts`: update its imports of connectorUtils and pathMergeUtils to `./` paths

---

## Phase 2: Rewrite `src/v5/types.ts` (graph-only)

**Remove:** `Area`, `AreaType`, old `Connector`, old `Whimsy`, hybrid `PuzzleState`.

**Keep:** `Point`, `Node`, `Edge`, `FaceEdge`, `Face`, `NeckShape`.

**Add:**
```typescript
interface FloatingWhimsy {
  id: string;
  templateId: string;
  svgData: string;       // from whimsyGallery, not yet transformed
  center: Point;
  scale: number;
  rotationDeg: number;
}

interface PuzzleState {
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
  faces: Record<string, Face>;
  floatingWhimsies: FloatingWhimsy[];
  connectors: Record<string, ConnectorV5>;
  rootFaceId: string;
  width: number;
  height: number;
}
```

All geometry stored as `pathData: string`. No paper.js objects in state. Serialization = plain JSON.

---

## Phase 3: Complete `src/v5/utils/GraphManager.ts`

Constructor gains optional `connectors` parameter. All split/splice operations mutate `this.connectors` in-place for auto-remapping.

### 3a: Fix `spliceEdge` variable naming bug
`paper.Path.splitAt(offset)` truncates `path` in-place to `[start→offset]` and returns `[offset→end]`.
Current code names are inverted. After fix:
- `edgePath` = `[start → firstInt]`
- `middlePart` = `[firstInt → lastInt]`  
- `endPart` = `[lastInt → end]`
Verify edge1/connectorEdge/edge2 assignments match this.

### 3b: Add helpers
```typescript
private isNodeInsidePath(nodeId: string, path: paper.PathItem): boolean
private findClosestPointOnPath(path: paper.PathItem, point: Point): paper.Point
```

### 3c: Complete `spliceEdge` — all 4 cases
- **Case 1 (tangential, 1 intersection):** `splitEdgeAtPoint` only.
- **Case 2 (one node swallowed):** keep outside segment, discard inside. Inside absorbed by splicePath.
- **Case 3 (both nodes outside, 2+ crossings):** use only `intersections[0]` and `intersections[last]`. Middle crossings ignored (Z-connector design).
- **Case 4 (both nodes swallowed):** delete entire edge, absorbed by splicePath boundary.

After every split: remap all connectors referencing the old edge.

### 3d: Add `spliceWhimsy(whimsy: FloatingWhimsy, whimsyPath: paper.PathItem): string`
1. Find all edges intersecting whimsyPath or with nodes inside it.
2. Process Case 4 first, then Case 2, then Case 3.
3. For each swallowed node: after processing incident edges, apply edge-case bridging fix if any edge still references the node.
4. Add whimsy boundary as new CCW edges between intersection nodes.
5. Re-run `traverseFace` for affected faces.
6. Return inner whimsy face id (centroid inside whimsyPath).

### 3e–3f: Add `bakeConnector(c: ConnectorV5)` and `bakeConnectors(record)`
Implement the 6-step bake algorithm above. `bakeConnectors` iterates all non-disabled connectors then clears them.

---

## Phase 4: Rewrite `src/v5/hooks/usePuzzleEngineV5.ts`

Graph-only. Remove all `Area`, `AreaType`, `useGraphMode`, `useStamps`.

**Operations exposed:**

| Function | Description |
|---|---|
| `createRoot(w, h, shape)` | Build root graph (4-node square, or circle/hex from paper.js path decomposition) |
| `subdivideGrid(params)` | GraphManager → subdivide* → extract state |
| `mergePieces(ids)` | Find shared edge between face pair → `deleteEdge` |
| `placeFloatingWhimsy(params)` | Push to `floatingWhimsies` (no graph change) |
| `moveFloatingWhimsy(id, center)` | Update center |
| `mergeWhimsy(id)` | Build paper.js path → `spliceWhimsy` → remove from list |
| `addConnector(params)` | Derive source face from edge+direction, walk ±width/2, compute p1/p2/replacedSegment |
| `updateConnector(id, updates)` | Patch; recompute p1/p2/replacedSegment if width/direction changed |
| `removeConnector(id)` | Delete |
| `bakeConnectors()` | GraphManager.bakeConnectors → extract state |
| `loadState(state)` | Replace all atoms |
| `reset()` | Clear all |

---

## Phase 5: Update `src/v5/App.tsx`

- Replace all V3 component imports with V5 equivalents.
- Remove `areas`, `useGraphMode`, `rootAreaId`.
- `handleWhimsyCommit` → `placeFloatingWhimsy`.
- Add `handleMergeWhimsy(id)` → `mergeWhimsy(id)`.
- Connection tab: `selectedEdgeId + midT + direction` replaces `pieceId + pathIndex`.
- Add "Merge Whimsy" button when a floating whimsy is selected.

---

## Phase 6: Update `src/v5/components/V5Canvas.tsx`

**Rendering layers (bottom to top):**
1. Face fills (SVG `<path>` from edge list)
2. Edge strokes (thin visible + wide invisible hit area)
3. Node circles (debug toggle)
4. Floating whimsies (`<path>` with transform, dashed, draggable)
5. Connectors (from `midEdgeId + midT + direction`)
6. Selection overlay

**Connector preview:**
```ts
const edgePath = new paper.Path(edges[c.midEdgeId].pathData);
if (c.direction === 'in') edgePath.reverse(); // flip normal direction
generateConnectorPath(edgePath, 0, c.midT, c.widthPx, c.extrusion, ...)
```

**Z-order:** Sort faces by bounding-box area descending before rendering (inner nested faces on top).

---

## Phase 7: Rewrite `src/v5/components/V5DebugPage.tsx`

5 scenario panels, each with live 200×200 SVG preview and pass/fail badge:

1. **Square display** — 4 nodes + 4 edges + traverseFace → 1 face
2. **Split square** — `splitFaceByLine` → 2 colored rectangles
3. **Whimsy inside square** — circle (r=40) fully inside → `spliceWhimsy` → outer ring + inner circle
4. **Connector bake** — 2-face graph, connector at shared edge midpoint → `bakeConnectors` → 3-part edge
5. **Whimsy crossing edge** — circle at (200,100) r=40, overlaps right edge → Case 3 splice → 2 crossing nodes

---

## Phase 8: Update `src/v5/utils/GraphManager.test.ts` (Vitest)

Square fixture function reused across all tests.

1. `traverseFace` → 4 FaceEdge entries (fix if broken)
2. `splitFaceByLine` → 2 faces × 4 edges (fix if broken)
3. `spliceWhimsy` circle inside → 2 faces, inner centroid inside circle (new)
4. `bakeConnectors` → original edge gone, 3 new edges (new)
5. `spliceWhimsy` circle crossing right edge → 2 crossing nodes, arc edge inserted (new)

---

## Phase 9: Rewrite `src/v5/utils/serializationUtils.ts`

V5 state is pure JSON (no paper.js objects). Serialize = `JSON.stringify` + `version: '5.0.0'`. Deserialize = `JSON.parse` + version check. No paper.js reconstruction step needed.

---

## Critical Files

| File | Action |
|---|---|
| `src/v5/types.ts` | Rewrite (Phase 2) |
| `src/v5/utils/GraphManager.ts` | Fix bugs, complete splice, add spliceWhimsy + bakeConnector (Phase 3) |
| `src/v5/hooks/usePuzzleEngineV5.ts` | Rewrite graph-only (Phase 4) |
| `src/v5/App.tsx` | Update imports + flow (Phase 5) |
| `src/v5/components/V5Canvas.tsx` | Floating whimsy layer, connector rendering (Phase 6) |
| `src/v5/components/V5DebugPage.tsx` | Rewrite 5 scenarios (Phase 7) |
| `src/v5/utils/GraphManager.test.ts` | Fix 2 + add 3 tests (Phase 8) |
| `src/v5/utils/serializationUtils.ts` | Rewrite (Phase 9) |
| `src/v5/hooks/usePersistence.ts` | Key + guard fix after copy (Phase 1) |

## Reused utilities (copy only, no logic changes needed)
- `connectorUtils.ts` — `generateConnectorPath`
- `pathMergeUtils.ts` — `getExactSegment`
- `gridUtils.ts` — point generation
- `whimsyGallery.ts` — shape templates
- `paperUtils.ts` — path helpers
- `headUtils.ts`, `neckUtils.ts` — connector geometry

---

## Verification

1. `vitest run src/v5/utils/GraphManager.test.ts` → all 5 pass
2. Dev server → V5 → create 2000×2000 rectangle → 16-piece grid, no gaps
3. Merge 2 adjacent faces → 1 face, shared edge gone
4. Place whimsy, drag, merge → inner face renders above outer
5. Click edge → connector preview at correct position
6. Production tab → bakeConnectors → connector geometry in graph
7. Save/reload → V5 storage key, state restored
8. Debug page → all 5 scenario panels green
