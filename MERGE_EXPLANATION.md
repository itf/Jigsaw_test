# How Merging Works in V2

## Overview

Merging in the v2 puzzle engine is the process of combining two or more puzzle pieces into a single larger piece. When pieces are merged, their shared internal boundaries are deleted, so they appear and function as one unified piece.

## User-Level Merge Operations

### Single Merge: `mergeAreas(areaAId, areaBId)`

**Location**: `src/v2/App.tsx` (lines 147-167)

**What it does**: Creates a single MERGE operation to combine two areas.

```typescript
const mergeAreas = useCallback((areaAId: string, areaBId: string) => {
  const op: Operation = {
    id: `merge-${Date.now()}`,
    type: 'MERGE',
    params: { areaAId, areaBId },
    timestamp: Date.now()
  };
  setHistory(prev => [...prev, op]);
}, []);
```

**How it works**:
1. Creates an Operation object with type='MERGE'
2. Stores the two area IDs to merge in params
3. Adds the operation to the history array
4. The actual geometry processing happens asynchronously in the usePuzzleEngine hook

### Multi-Piece Merge: `mergeSelectedPieces()`

**Location**: `src/v2/App.tsx` (lines 328-342)

**What it does**: Merges multiple selected pieces by chaining MERGE operations.

```typescript
const mergeSelectedPieces = useCallback(() => {
  if (mergePickIds.length < 2) return;
  
  // Merge all selected pieces together by chaining MERGE operations
  // Start with the first piece and merge each subsequent piece into it
  let acc = mergePickIds[0];
  for (let i = 1; i < mergePickIds.length; i++) {
    mergeAreas(acc, mergePickIds[i]);
  }
  
  setMergePickIds([]);
  setSelectedId(null);
  setSelectedType('NONE');
}, [mergePickIds, mergeAreas]);
```

**How it works**:
1. Takes an array of selected piece IDs: `[A, B, C, D]`
2. Creates a chain of bilateral merges:
   - Merge A ↔ B
   - Merge result ↔ C
   - Merge result ↔ D
3. The DSU (Disjoint Set Union) ensures transitive grouping: all pieces end up in the same group
4. Clears the selection UI after completion

### Automatic Neighbor Merge: `deletePiece(pieceId)`

**Location**: `src/v2/App.tsx` (lines 169-206)

**What it does**: Deletes a piece by merging it with all its neighbors.

**Process**:
1. Finds all pieces in the same merged group as the target
2. Uses Paper.js to compute the unified boundary of the group
3. Checks which other pieces touch this boundary (using `pathsTouch()`)
4. Merges the group representative with each neighbor
5. Effectively "absorbs" the piece into surrounding pieces

---

## Engine-Level Merge Processing

### The Disjoint Set Union (DSU)

**Location**: `src/v2/hooks/usePuzzleEngine.ts` (lines 138-165)

The DSU is a data structure that tracks which pieces are grouped together.

```typescript
const dsu: Record<string, string> = {};

const find = (id: string): string => {
  if (!dsu[id]) dsu[id] = id;
  if (dsu[id] === id) return id;
  return dsu[id] = find(dsu[id]);  // Path compression
};

const union = (id1: string, id2: string) => {
  const r1 = find(id1);
  const r2 = find(id2);
  if (r1 !== r2) dsu[r1] = r2;  // Unite two components
};
```

**How it works**:
- Each piece has a "root" in the DSU (initially itself)
- `find(id)` returns the root representative of a piece's group
- `union(id1, id2)` connects the two roots, making them part of the same group
- All pieces with the same root are considered merged

### Processing MERGE Operations: `applyMerge(op)`

**Location**: `src/v2/hooks/usePuzzleEngine.ts` (lines 168-232)

**Called during**: The useMemo for computing topology and mergedGroups

**What it does**: Processes a single MERGE operation by:
1. Extracting the two areas to merge
2. Finding all leaf pieces (cuttable pieces) that belong to each area
3. Checking which leaf pairs actually share a boundary
4. Union-ing those pairs in the DSU
5. Deleting the shared boundary geometry

```typescript
const applyMerge = (op: Operation) => {
  const { areaAId, areaBId } = op.params;
  const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
  
  // Get all descendants and already-grouped pieces
  const leavesA = getLeafDescendants(areaAId);
  const leavesB = getLeafDescendants(areaBId);
  const rootA = find(areaAId);
  const rootB = find(areaBId);
  const groupA = leafAreas.filter(a => find(a.id) === rootA).map(a => a.id);
  const groupB = leafAreas.filter(a => find(a.id) === rootB).map(a => a.id);
  const allA = Array.from(new Set([...leavesA, ...groupA]));
  const allB = Array.from(new Set([...leavesB, ...groupB]));

  // Try to merge each pair of pieces from the two groups
  allA.forEach(la => {
    allB.forEach(lb => {
      const a = areas[la];
      const b = areas[lb];
      if (!a || !b) return;
      
      // Check if they share a boundary
      const shared = getSharedPerimeter(a, b);
      if (shared) {
        union(la, lb);           // Union in DSU
        shared.remove();         // Delete shared boundary
      }
    });
  });
};
```

### Building mergedGroups

**Location**: `src/v2/hooks/usePuzzleEngine.ts` (lines 323-341)

After all MERGE operations are processed, the DSU state is converted into the `mergedGroups` map:

```typescript
const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
const groups: Record<string, string[]> = {};
leafAreas.forEach(a => {
  const root = find(a.id);              // Get this piece's group root
  if (!groups[root]) groups[root] = [];
  groups[root].push(a.id);              // Add piece to its group's array
});

return { topology: areas, mergedGroups: groups, whimsyWarnings };
```

**Result**: A map like:
```typescript
mergedGroups = {
  "piece-1": ["piece-1"],           // Ungrouped single piece
  "piece-2": ["piece-2"],
  "piece-3": ["piece-3", "piece-4", "piece-5"],  // Three merged pieces
  "root": ["root-child-0", "root-child-1"]
}
```

### Key Insight: Order Matters

MERGE operations are processed in **order** (as they appear in the history):
- Piece geometries may change between operations (SUBDIVIDE, ADD_WHIMSY)
- A MERGE operation uses the piece geometries as they exist **at that point in the history**
- This is why the topologyKey depends only on topology-affecting ops (MERGE, SUBDIVIDE, ADD_WHIMSY)
- Connector parameter changes don't require reprocessing merges

---

## Geometry Integration

### Shared Edges Visualization

**Location**: `src/v2/hooks/usePuzzleEngine.ts` (lines 342-420)

For each pair of pieces, sharedEdges computes their shared boundary and marks it:

```typescript
const groupA = getGroupId(areaA.id);
const groupB = getGroupId(areaB.id);
const isMerged = groupA === groupB;  // True if both in same merged group
```

**Usage**:
- UI renders merged edges differently (faded, dotted, or hidden)
- Prevents connector placement on merged (internal) edges
- Shows visual distinction between active boundaries and merged-away boundaries

### TopologicalEngine.mergeFaces()

**Location**: `src/v2/topology_engine.ts` (lines 440-453)

Marks edges as "merged" in the topological graph:

```typescript
mergeFaces(faceAId: string, faceBId: string) {
  this.edges.forEach(edge => {
    if ((edge.faceAId === faceAId && edge.faceBId === faceBId) ||
        (edge.faceAId === faceBId && edge.faceBId === faceAId)) {
      edge.isMerged = true;
    }
  });
}
```

### TopologicalEngine.getMergedBoundary()

**Location**: `src/v2/topology_engine.ts` (lines 460-525)

Generates the cut contour for a merged group by:
1. Finding all boundary edges (where exactly one face is in the group)
2. **Excluding** merged edges (both faces in group)
3. Tracing the boundary in order to form closed loops
4. Splicing in connector stamps

**Result**: A single SVG path representing the outer perimeter of all merged pieces combined.

---

## Data Flow Diagram

```
User Action: Select pieces [A, B, C] → Click "Merge"
       ↓
mergeSelectedPieces()
       ↓
mergeAreas(A, B)  →  Operation { type: 'MERGE', params: {A, B} }
mergeAreas(B', C) →  Operation { type: 'MERGE', params: {B', C} }
       ↓
Add to history[]
       ↓
usePuzzleEngine detects topologyKey changed
       ↓
Compute topology:
  1. Clone base areas
  2. Initialize DSU
  3. Process all MERGE ops in order:
     - applyMerge({A, B}):
       * Find leaves in A and B
       * For each pair: if they touch, union() in DSU
       * Delete shared perimeter geometry
     - applyMerge({B', C}):
       * Find leaves in B' and C
       * Union touching pairs
  4. Build mergedGroups from DSU final state
       ↓
Result:
  topology = { ...updated areas with deleted boundaries... }
  mergedGroups = { "root": [A, B, C] }
       ↓
Shared edges computed (marks merged edges)
       ↓
Final pieces rendered:
  - Single unified boundary for merged group
  - Merged edges not shown (or faded)
  - Connectors only on external boundaries
```

---

## Key Concepts

### Piece vs. Area vs. Group

- **Piece** (isPiece=true): A leaf node that can be physically cut
- **Area**: Any node in the tree (piece, subdivision parent, whimsy parent)
- **Group** (mergedGroups): Multiple pieces unified via MERGE operations

### DSU Transitive Property

If you merge A↔B and then B↔C, the DSU ensures:
- find(A) = find(B) = find(C) = same root
- All three pieces are in the same group
- They will have a single unified boundary

### Why Not Simple Boolean Union?

The system could have just computed the union of piece geometries, but instead uses DSU because:
1. **Order matters**: Geometry changes with each operation, so MERGE must use the geometry at that point in history
2. **Efficiency**: DSU tracking is O(n) per merge; recomputing unions for all pieces would be O(n²)
3. **Clarity**: DSU explicitly tracks which pieces are grouped, independent of geometry

### Shared Perimeter Detection

`getSharedPerimeter(a, b)` returns the overlapping boundary between two pieces.
- If it exists and has nonzero length, the pieces are adjacent
- MERGE operations delete this boundary, making them seamless

---

## Example: Merging a 2×2 Grid

Initial state:
```
+---+---+
| A | B |
+---+---+
| C | D |
+---+---+
```

User selects all 4 and clicks merge:
```
mergeSelectedPieces([A, B, C, D])
  → mergeAreas(A, B)
  → mergeAreas(B', C)
  → mergeAreas(C', D)
```

Processing:
1. **applyMerge({A, B})**:
   - A and B share a vertical edge
   - union(A, B) → find(A) = find(B) = B
   - Delete A-B boundary

2. **applyMerge({B, C})**:
   - B and C share a horizontal edge
   - union(B, C) → find(B) = find(C) = C
   - Delete B-C boundary

3. **applyMerge({C, D})**:
   - C and D share a vertical edge
   - union(C, D) → find(C) = find(D) = D
   - Delete C-D boundary

Final DSU: find(A) = find(B) = find(C) = find(D) = D

mergedGroups: `{ "D": [A, B, C, D] }`

Result:
```
+-------+
|       |
|  ALL  |
|       |
+-------+
```
Single merged piece with the outer rectangle boundary.

