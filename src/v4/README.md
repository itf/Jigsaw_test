# V4 Module Overview

This document provides a high-level overview of the V4 puzzle engine and its structure.

## What is V4?

**V4** is a simplified, topology-focused version of the puzzle engine. It strips away the complex boolean geometry system from V2 and replaces it with a straightforward area-based topology system.

### Key Differences from V2

| Aspect | V2 | V4 |
|--------|----|----|
| **Geometry Engine** | Boolean-based (complex) | Topology-based (simple) |
| **Data Model** | Connectors, boundaries, edges | Areas (pieces/groups) |
| **Operations** | 7 different geometry types | Simple piece operations |
| **Merging** | Complex DSU algorithm | Direct path union |
| **Whimsies** | Embedded in topology | Independent pieces |
| **Focus** | Full puzzle production | Core topology only |
| **UI Tabs** | 7 tabs (TOPOLOGY, MODIFICATION, etc.) | 1 tab (TOPOLOGY) |

### When to Use V4

- ✅ Learning the puzzle engine
- ✅ Simple grid/hex puzzles
- ✅ Rapid prototyping
- ✅ Whimsy-based designs
- ✅ Clear, simple code

When to use V2:
- ❌ Complex connector system
- ❌ Advanced geometric shapes
- ❌ Multiple geometry types
- ❌ Full production workflow

## Architecture at a Glance

### The Area Model

Everything in V4 is an **Area** - either a **piece** (leaf with geometry) or a **group** (container).

```
Root Area (piece)
  ├─ Piece 1 (after subdivide)
  ├─ Piece 2
  ├─ Piece 3
  └─ Piece 4
```

When you subdivide a piece, it becomes a group:

```
Root Area (group) ← converted from piece
  ├─ Piece 1
  ├─ Piece 2
  ├─ Piece 3
  ├─ Piece 4
  ├─ Group A (subdivided piece from above)
  │  ├─ Piece 4.1
  │  ├─ Piece 4.2
  │  ├─ Piece 4.3
  │  └─ Piece 4.4
  └─ Piece 5
```

### Core Operations

1. **Subdivide** - Turn a piece into a group with smaller pieces
   - Grid: Rectangular cells
   - Hex: Hexagonal cells
   - Random: Random point-based cells

2. **Merge** - Combine two pieces into one
   - Uses paper.js `unite()`
   - Only works on intersecting pieces

3. **Add Whimsy** - Place a shape that creates holes in intersecting pieces
   - Circle or Star template
   - Subtracts from all intersecting pieces
   - Whimsy itself stays intact

### Paper.js Integration

All geometry operations use [paper.js](http://paperjs.org/):

- Paths are stored as `paper.PathItem`
- Boolean operations: `unite()`, `subtract()`, `intersect()`
- Boundary operations: clipping, offsetting
- Intersection detection

## Module Structure

```
v4/
├── DESIGN.md                    # Architecture design
├── IMPLEMENTATION.md            # What's implemented
├── API_REFERENCE.md             # Detailed API docs
├── QUICK_START.md              # Getting started guide
├── README.md                   # Module overview (this file)
│
├── types.ts                    # Core data types
│  ├── Area, AreaType
│  ├── PuzzleState
│  ├── CreateRootShape, CreateGridParams, etc.
│  └── Operation types
│
├── constants.ts                # Colors, Tab enum
│
├── topologyEngine.ts           # Core algorithm
│  ├── createRootPuzzle()
│  ├── createGridSubdivision()
│  ├── createHexGridSubdivision()
│  ├── createRandomGridSubdivision()
│  ├── mergePieces()
│  ├── addWhimsy()
│  └── getDisplayPieces()
│
├── paperUtils.ts               # Paper.js wrappers
│  ├── setupPaperProject()
│  ├── pathItemFromBoundaryData()
│  ├── pathsIntersect()
│  ├── unitePaths()
│  ├── subtractPaths()
│  └── clonePath()
│
├── App.tsx                     # Main React component
│  └── Coordinates UI and engine
│
├── hooks/
│  └── usePuzzleEngine.ts       # State management + undo/redo
│
└── components/
    ├── V2Header.tsx           # Header with undo button
    ├── V2Navigation.tsx       # Tab navigation
    ├── V2ActionBar.tsx        # Subdivision/merge/whimsy controls
    ├── V2Canvas.tsx           # SVG canvas with pieces
    ├── V2CreateModal.tsx      # Puzzle creation dialog
    └── index.ts              # Component exports
```

## Data Flow

```
User Interface
    ↓
V2ActionBar / V2Canvas (handle user actions)
    ↓
App.tsx (updates state, calls engine methods)
    ↓
usePuzzleEngine (manages state + history)
    ↓
topologyEngine (performs operations)
    ↓
paperUtils (paper.js operations)
    ↓
paper.js library (geometry)
    ↓
New PuzzleState created and stored in history
    ↓
App renders new state
    ↓
V2Canvas displays pieces
    ↓
User sees updated puzzle
```

## Implementation Details

### 1. Immutable State

Every operation creates a new `PuzzleState`:

```typescript
const newState = createGridSubdivision(oldState, params);
// oldState is unchanged
// newState contains the updated areas
```

This enables:
- Easy undo/redo (store all states in history)
- Predictable updates
- No accidental mutations

### 2. Area Hierarchy

Areas form a tree:

```typescript
// After creating and subdividing
state.areas = {
  'root': { type: 'group', childrenIds: ['area_1', 'area_2', ...] },
  'area_1': { type: 'piece', parentId: 'root', boundary: PathItem },
  'area_2': { type: 'piece', parentId: 'root', boundary: PathItem },
  ...
}
```

### 3. Paper.js Boundary Storage

Each piece stores its boundary as a paper.js `PathItem`:

```typescript
piece.boundary // = paper.Path or paper.CompoundPath
```

For serialization, convert to SVG path data:

```typescript
const pathData = pathItemToPathData(piece.boundary);
// pathData = "M 0 0 L 100 0 L 100 100 Z"
```

### 4. Merge Operation

When merging two pieces:

1. Check they intersect using `pathsIntersect()`
2. Clone both boundaries (preserve originals)
3. Unite them using `unitePaths()`
4. Create new merged piece
5. Delete original pieces
6. Update parent group's childrenIds

### 5. Whimsy Operation

When adding a whimsy:

1. Create whimsy shape (circle or star)
2. For each piece in the puzzle:
   - Check if it intersects the whimsy
   - If yes, clone both boundaries
   - Subtract whimsy from piece using `subtractPaths()`
   - Update piece boundary
3. Create whimsy as new standalone piece
4. Whimsy is NOT subtracted from itself

## Key Design Decisions

### Why Immutable State?

Enables simple undo/redo and makes debugging easier.

### Why Paper.js?

- Excellent SVG/geometry support
- Boolean operations built-in
- Active community

### Why Separate Engine + Hook?

- `topologyEngine.ts` is pure functions (testable)
- `usePuzzleEngine.ts` adds React integration
- Easy to use in non-React contexts

### Why "Area" Instead of "Piece"?

- More general term
- Covers both groups and pieces
- Aligns with common terminology

## Performance Considerations

### Current Limitations

- Paper.js operations can be slow on large grids
- No spatial indexing for intersection detection
- No lazy rendering of canvas

### When Performance Matters

- 20×20+ grids: may feel slow
- Many whimsies: can cause lag
- Complex shapes: increase computation

### Future Optimizations

- Quadtree for spatial partitioning
- Lazy SVG rendering
- Worker threads for heavy operations
- Memoization of intersection results

## Future Enhancements

### Phase 1 (Core Functionality)
- ✅ Grid subdivision
- ✅ Hex subdivision
- ✅ Random subdivision
- ✅ Piece merging
- ✅ Whimsy shapes

### Phase 2 (Quality of Life)
- Voronoi-based subdivision
- More whimsy templates
- Seed-based random generation
- Better UI feedback

### Phase 3 (Advanced)
- Connector system
- PDF/print export
- Undo visualization
- Performance optimization

### Phase 4 (Production)
- Puzzle validation
- Cutting service export
- Material simulation
- 3D preview

## Testing

No tests are implemented yet. Future test plan:

- **Unit tests**: Each function in `topologyEngine.ts`
- **Integration tests**: Full workflows (create → subdivide → merge)
- **Snapshot tests**: Piece geometries after operations
- **Performance tests**: Grid sizes and operation times

## Debugging Tips

### Check State Structure

```typescript
console.log(engine.state);
// Shows current areas, root ID, dimensions
```

### Verify Piece Boundaries

```typescript
const pieces = engine.getDisplayPiecesData();
console.log(pieces.map(p => ({ id: p.id, pathData: p.pathData.slice(0, 50) })));
```

### Trace Operation Flow

1. Check V2ActionBar handler is called
2. Verify App calls engine method
3. Confirm usePuzzleEngine calls topologyEngine
4. Review topologyEngine function logic
5. Check paper.js operations

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Merge disabled | Pieces don't intersect | Check boundaries overlap |
| Whimsy creates no holes | Doesn't intersect pieces | Adjust position/scale |
| Large grids slow | Paper.js overhead | Use smaller grids |
| State seems old | Hook not re-rendering | Check dependency arrays |

## Summary

**V4** is a clean, focused implementation of puzzle topology operations:

- **Simple data model** (Areas: pieces + groups)
- **Clear operations** (subdivide, merge, whimsy)
- **Easy to understand** (pure functions + React hooks)
- **Built on paper.js** (mature, tested)

Perfect for learning the puzzle system or building simple topology-based puzzles.

For detailed information, see:
- `DESIGN.md` - Architecture and design decisions
- `API_REFERENCE.md` - Function documentation
- `QUICK_START.md` - Getting started guide
- `IMPLEMENTATION.md` - What's implemented and what's not

---

**Version:** 1.0
**Status:** Core topology operations complete
**Last Updated:** April 2026
