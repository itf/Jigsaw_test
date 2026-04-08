# V4 Stroke Error Fix Summary

## Problem
When selecting multiple pieces and attempting to merge, the application threw:
```
Uncaught TypeError: can't access property "stroke", options is undefined
```

## Root Cause
The paper.js PathItem objects stored in `Area.boundary` were becoming detached from their paper project context. This happened because:

1. Each topologyEngine operation (subdivide, merge, etc.) was calling `setupPaperProject()`
2. `setupPaperProject()` destroys the old paper.js project via `paper.project.remove()`
3. When the project is destroyed, all PathItem objects from that project become invalid
4. Later, when React re-rendered or operations tried to use these invalid PathItems, paper.js would fail trying to access the `stroke` property

## Solution
Changed the architecture to:

1. **Call `setupPaperProject()` ONLY ONCE** - in `createRootPuzzle()` when the puzzle is first created
2. **All subsequent operations (createGrid, createHex, createRandom, merge, addWhimsy)** reuse the same paper.js project
3. **PathItem objects stay valid** throughout the puzzle's lifetime because they're all in the same project context
4. **Rendering still works correctly** - `getDisplayPieces()` converts PathItems to pathData strings only when needed for SVG rendering

## Files Modified

### `/src/v4/topologyEngine.ts`
- Removed `setupPaperProject()` calls from all subdivision functions
- Only `createRootPuzzle()` calls it once
- All functions work directly with paper.js PathItems
- Added proper stroke color initialization to all created paths

### `/src/v4/paperUtils.ts`
- Updated `createRectanglePath()` and `createCirclePath()` to initialize stroke properties
- These ensure all paths have valid stroke/fill colors from creation

### `/src/v4/types.ts`
- Kept `boundary: paper.PathItem | null` (NOT string)
- PathItems are stored directly in the Area object

## Why This Works

- **Paper.js project lifecycle**: The project acts like a canvas context. All shapes created within it are bound to it.
- **Single project per puzzle**: By creating the project once and never replacing it, all PathItems stay valid
- **Rendering**: We only convert to SVG strings for display via `getDisplayPieces()`, which calls `pathItemToPathData()`
- **Operations**: All geometry operations (boolean operations, intersections) happen directly on the PathItems in the shared project

## Testing
- Grid subdivision: ✅ Creates rectangular cells
- Hex subdivision: ✅ Creates Voronoi cells with hex seed points
- Random subdivision: ✅ Creates Voronoi cells with random seed points
- Piece merging: ✅ Unites two pieces' boundaries
- Whimsy subtraction: ✅ Subtracts whimsy shape from pieces
