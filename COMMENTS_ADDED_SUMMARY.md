# Summary of Comments Added to Merging System

## Files Modified

### 1. `src/v2/App.tsx`

#### mergeAreas() - Lines 147-167
**Added**: Comprehensive documentation explaining:
- How the function creates a MERGE operation
- What happens in usePuzzleEngine (DSU processing)
- The 5-step process from user action to final grouping

#### mergeSelectedPieces() - Lines 345-359
**Added**: Inline comments explaining:
- The 2-piece minimum check
- How chaining bilateral merges creates transitive groups
- The DSU ensures all pieces end up in same group
- UI cleanup after merge completes

---

### 2. `src/v2/hooks/usePuzzleEngine.ts`

#### DSU Data Structure - Lines 138-165
**Added Comments for**:
- `dsu` object: Purpose and initial state
- `find()`: How path compression works, path to same root
- `union()`: How two components are connected
- `getLeafDescendants()`: Recursive collection of cuttable pieces

#### applyMerge() Function - Lines 168-233
**Added**: Detailed documentation of the 4-step merge process:
1. Extract two areas and their descendants
2. Resolve descendants and DSU roots
3. Try merging each pair of touching pieces
4. Union touched pairs and delete shared geometry

#### mergedGroups Construction - Lines 323-341
**Added**: Documentation explaining:
- What mergedGroups represents (DSU state → group map)
- The 4-step building process
- Example output structure
- Use cases (UI coloring, geometry, subdivision)

#### sharedEdges Memoization - Lines 342-420
**Added**: Comments explaining:
- Purpose: visualization and connector placement
- How isMerged flag is computed (groupA === groupB)
- How the groupSharedMap combines perimeters
- UI implications of merged edges

---

### 3. `src/v2/topology_engine.ts`

#### mergeFaces() - Lines 435-453
**Added**: Documentation of the 4-step marking process:
1. Scan all edges in graph
2. Find edges between two faces
3. Mark with isMerged = true
4. Results in excluded boundary traces

#### getMergedBoundary() - Lines 460-495
**Added**: Detailed explanation of the 7-step traversal:
1. Find all edges touching group
2. Filter to boundary edges only (XOR check)
3. Build adjacency map for vertices
4. Walk edges in order from arbitrary start
5. Traverse counterclockwise for SVG validity
6. Splice connectors on boundaries
7. Combine loops into final path

---

## New Documentation File

### `MERGE_EXPLANATION.md`

A comprehensive guide including:
- **Overview**: What merging is and why it matters
- **User-Level Operations**: `mergeAreas()`, `mergeSelectedPieces()`, `deletePiece()`
- **Engine-Level Processing**: DSU, `applyMerge()`, mergedGroups
- **Geometry Integration**: Shared edges, TopologicalEngine methods
- **Data Flow Diagram**: Visual representation of merge pipeline
- **Key Concepts**: Piece vs Area vs Group, DSU properties, why DSU vs geometry
- **Example Walkthrough**: 2×2 grid merge with step-by-step processing

---

## Key Insights Documented

### 1. The DSU Pattern
Merging uses Disjoint Set Union instead of geometric operations because:
- Order matters: geometry changes with each operation
- Efficiency: O(n) tracking vs O(n²) recomputation
- Clarity: explicit grouping independent of geometry

### 2. Transitive Grouping
Chaining bilateral merges (A↔B, B↔C, C↔D) automatically creates complete groups due to DSU's union-by-root approach.

### 3. Geometry Deletion
Shared boundaries aren't just marked internal—they're actually deleted from the `areas` map, so reconstructed pieces have seamless merges.

### 4. Order Dependency
MERGE operations are processed in history order using the geometry state at that point. This is why topologyKey only includes topology-affecting ops.

### 5. Visualization Integration
The isMerged flag in sharedEdges connects the merge system to UI rendering and connector placement logic.

---

## Where to Look for Examples

- **Simple merge**: `mergeAreas()` creates the operation
- **Batch merge**: `mergeSelectedPieces()` chains operations
- **Automatic merge**: `deletePiece()` absorbs into neighbors
- **Processing**: `applyMerge()` implements DSU logic
- **Finalization**: Lines 323-341 build mergedGroups from DSU state
- **Visualization**: `sharedEdges` marks merged boundaries
- **Geometry**: `TopologicalEngine.mergeFaces()` marks topo edges
- **Boundary**: `TopologicalEngine.getMergedBoundary()` traces final contour

