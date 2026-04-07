# Merging Quick Reference

## The Three Ways to Merge

### 1. Single Merge: `mergeAreas(areaAId, areaBId)`
```typescript
// File: src/v2/App.tsx
mergeAreas('piece-1', 'piece-2');  // Merge two pieces
```
Creates one MERGE operation. Use for programmatic merges.

### 2. Multi-Merge: `mergeSelectedPieces()`
```typescript
// File: src/v2/App.tsx
// User selects [A, B, C] pieces in UI
mergeSelectedPieces();  // Chains: A↔B, B↔C
```
Chains bilateral merges. All pieces end up in same group via DSU transitivity.

### 3. Delete Merge: `deletePiece(pieceId)`
```typescript
// File: src/v2/App.tsx
deletePiece('piece-1');  // Merges all neighbors of piece-1
```
Finds neighbors and absorbs piece into them.

---

## The DSU (Disjoint Set Union)

**What**: A data structure tracking which pieces are grouped together

**Where**: `src/v2/hooks/usePuzzleEngine.ts` lines 138-155

**How**:
```typescript
const dsu: Record<string, string> = {};  // Each piece → its root

find(id)  // Returns the root of a piece's group
union(id1, id2)  // Connects two roots
```

**Key Property**: All pieces with the same `find(id)` result are merged together

---

## The Processing Pipeline

```
1. User Action (UI)
   ↓ mergeSelectedPieces()
   ↓ mergeAreas() × N
   ↓ Add to history[]

2. usePuzzleEngine Detects Change
   ↓ topologyKey changed
   ↓ Recompute topology memoization

3. Process MERGE Operations (in order)
   ↓ applyMerge() for each MERGE op
   ↓ For each pair of touching pieces:
     • Check if they share perimeter
     • If yes: union() in DSU, delete boundary
   ↓

4. Build mergedGroups from DSU State
   ↓ For each leaf piece:
     • Find its DSU root
     • Add to groups[root]

5. Final Result
   ↓ topology = areas with deleted boundaries
   ↓ mergedGroups = { root: [pieces...] }
```

---

## applyMerge() in Detail

**What it does**: Processes a single MERGE operation

**Where**: `src/v2/hooks/usePuzzleEngine.ts` lines 168-232

**Steps**:
1. Extract areaAId and areaBId from operation
2. Find all leaf descendants of each area
3. Find all pieces already grouped with each area (DSU lookup)
4. Combine into allA and allB (deduped)
5. For each (la, lb) pair:
   - Check if they share a perimeter
   - If yes: union(la, lb), delete shared boundary

**Result**: All pieces in allA and allB now have same DSU root

---

## mergedGroups Map

**What**: `Record<string, string[]>` mapping roots → piece IDs

**Where**: Output of usePuzzleEngine, stored in hook state

**Example**:
```typescript
mergedGroups = {
  "piece-1": ["piece-1"],           // Ungrouped
  "piece-3": ["piece-3", "piece-4", "piece-5"],  // Merged triple
  "root": ["root-child-0", "root-child-1"]      // Merged pair
}
```

**Used by**:
- UI: Coloring pieces (same group = same color)
- Geometry: Computing merged boundaries
- Subdivision: Determining clip regions

---

## Geometry Integration

### Shared Edges (`sharedEdges` array)
```typescript
{
  id: "piece-3::piece-4",
  areaAId: "piece-3",
  areaBId: "piece-4",
  pathData: "M10,10 L20,20...",
  isMerged: true  // ← Set to true if both in same group
}
```

**isMerged is true when**: `getGroupId(areaA) === getGroupId(areaB)`

### TopologicalEngine.mergeFaces()
Marks edges in topo graph as `isMerged = true` → excluded from boundary trace

### TopologicalEngine.getMergedBoundary()
Traces boundary of merged group by:
1. Finding boundary edges (exactly one side in group)
2. Walking edges in order to form closed loops
3. Splicing connector stamps
4. Outputting final SVG path

---

## Why This Design?

### ❌ Not Just Boolean Union
Could compute merged geometry as union of piece boundaries, but:
- Geometry changes with each operation (SUBDIVIDE, ADD_WHIMSY)
- MERGE order matters—must use geometry at that point
- Would require O(n²) recomputation

### ✅ DSU + Deferred Geometry
Instead:
- Track grouping efficiently with DSU (O(n) per op)
- Compute final geometry only when needed
- Clear intent: "these pieces are grouped"
- Flexible: handles complex piece structures

---

## Common Questions

### Q: What if I merge A↔B, then B↔C?
**A**: DSU ensures find(A) = find(B) = find(C) = same root. All three are grouped.

### Q: Can I merge pieces that don't touch?
**A**: Yes, `union()` will succeed, but applyMerge() only deletes shared boundaries if they exist. Non-touching pieces stay separate geometrically.

### Q: Does MERGE order matter?
**A**: Yes! Each MERGE uses the geometry as it exists at that point in history (after previous SUBDIVIDE, ADD_WHIMSY, MERGE ops).

### Q: What shows up in final cut?
**A**: Only boundary edges (where one side is in group). Merged/internal edges are excluded. ConnectorEngine adds cut stamps.

### Q: How do I check if two pieces are merged?
**A**: Look up both piece IDs in mergedGroups and see if they have the same root value.

---

## Code Navigation

| Concept | File | Lines |
|---------|------|-------|
| MERGE operation creation | App.tsx | 147-167 |
| Chain multiple merges | App.tsx | 345-359 |
| Delete piece (auto-merge) | App.tsx | 169-206 |
| DSU implementation | usePuzzleEngine.ts | 138-155 |
| Process single MERGE | usePuzzleEngine.ts | 168-232 |
| Build mergedGroups | usePuzzleEngine.ts | 323-341 |
| Shared edges vis | usePuzzleEngine.ts | 342-420 |
| Mark topo edges merged | topology_engine.ts | 440-453 |
| Trace merged boundary | topology_engine.ts | 460-525 |

