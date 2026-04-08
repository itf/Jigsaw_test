# V4 Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                     │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │  V2Canvas    │ │ V2ActionBar  │ │  V2CreateModal      │ │
│  │  (SVG Render)│ │(Subdivision/ │ │  (Initialize)       │ │
│  │              │ │ Merge/Whimsy)│ │                     │ │
│  └──────────────┘ └──────────────┘ └─────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐                         │
│  │  V2Header    │ │V2Navigation  │                         │
│  │  (Undo)      │ │(Tabs)        │                         │
│  └──────────────┘ └──────────────┘                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│               APPLICATION COMPONENT (App.tsx)               │
│  • State management                                         │
│  • Event handlers                                           │
│  • Integrates UI and engine                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│         REACT HOOK: usePuzzleEngine()                       │
│  • Manages PuzzleState                                      │
│  • Maintains history for undo/redo                          │
│  • Calls topologyEngine functions                           │
│  • Provides displayable piece data                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              TOPOLOGY ENGINE (topologyEngine.ts)            │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ createRootPuzzle()   │  │ createGridSubdiv()   │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ createHexGridSubdiv()│  │ createRandomSubdiv() │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  mergePieces()       │  │  addWhimsy()         │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────────────────────────────┐          │
│  │ getDisplayPieces() - Convert to SVG format   │          │
│  └──────────────────────────────────────────────┘          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│            PAPER.JS UTILITIES (paperUtils.ts)              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ setupPaperProject()  │  │ pathItemFromData()   │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ pathsIntersect()     │  │ unitePaths()         │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ subtractPaths()      │  │ clonePath()          │        │
│  └──────────────────────┘  └──────────────────────┘        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   PAPER.JS LIBRARY                          │
│  • Path geometry operations                                 │
│  • Boolean operations (union, subtract, intersect)          │
│  • SVG parsing and generation                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: Creating a Puzzle

```
1. User clicks "Create Puzzle" in V2CreateModal
   │
   ↓
2. V2CreateModal.onCreate(width, height, shape) called
   │
   ↓
3. App calls engine.initializePuzzle(width, height, shape)
   │
   ↓
4. usePuzzleEngine passes to topologyEngine.createRootPuzzle()
   │
   ↓
5. createRootPuzzle() creates first Area
   │
   ├─ setupPaperProject(width, height) - Initialize paper.js
   │
   ├─ createRectanglePath(width, height) - Create boundary
   │  (or createCirclePath for circle variant)
   │
   └─ Return new PuzzleState with root Area
   │
   ↓
6. usePuzzleEngine stores state in history
   │
   ↓
7. App gets new state from hook
   │
   ↓
8. App calls engine.getDisplayPiecesData()
   │
   ├─ Iterates all areas in state
   ├─ Filters for 'piece' type with boundary
   ├─ Converts boundary to pathData using pathItemToPathData()
   └─ Returns array of displayable pieces
   │
   ↓
9. V2Canvas re-renders with new pieces
   │
   ↓
10. User sees puzzle on screen!
```

## Data Flow: Merging Two Pieces

```
1. User selects two pieces and clicks "Merge"
   │
   ↓
2. App calls engine.merge({pieceAId, pieceBId})
   │
   ↓
3. usePuzzleEngine calls topologyEngine.mergePieces(state, params)
   │
   ↓
4. mergePieces() executes:
   │
   ├─ Get pieceA and pieceB from state.areas
   │
   ├─ Call pathsIntersect(pieceA.boundary, pieceB.boundary)
   │  │
   │  └─ paperUtils checks if paths touch or overlap
   │
   ├─ Clone both boundaries to preserve originals
   │  │
   │  └─ Use clonePath()
   │
   ├─ Call unitePaths(clonedA, clonedB)
   │  │
   │  ├─ paperUtils creates merged path using paper.js unite()
   │  └─ Returns unified PathItem
   │
   ├─ Create new merged Area
   │
   ├─ Update state.areas:
   │  ├─ Delete pieceA
   │  ├─ Delete pieceB
   │  └─ Add merged piece
   │
   └─ Return new PuzzleState
   │
   ↓
5. usePuzzleEngine stores new state in history
   │
   ↓
6. App gets updated state
   │
   ↓
7. App calls engine.getDisplayPiecesData()
   │
   ↓
8. V2Canvas renders new pieces (with merged piece)
   │
   ↓
9. User sees merged piece!
```

## Data Flow: Adding Whimsy

```
1. User configures whimsy and clicks placement mode
   │
   ↓
2. User moves cursor - V2Canvas calls onWhimsyBoardPointerMove()
   │
   ├─ Updates whimsyPreviewCenter
   └─ V2Canvas re-renders with preview (dashed outline)
   │
   ↓
3. User clicks on canvas - V2Canvas calls onWhimsyCommit(point)
   │
   ↓
4. App calls engine.addWhimsyPiece(params)
   │
   ↓
5. usePuzzleEngine calls topologyEngine.addWhimsy()
   │
   ↓
6. addWhimsy() executes:
   │
   ├─ Create whimsy shape (circle or star)
   │  │
   │  ├─ If 'circle': new paper.Path.Circle(center, scale)
   │  └─ If 'star': createStarPath(center, scale, 5, rotation)
   │
   ├─ For each piece in state.areas:
   │  │
   │  ├─ If type === 'piece' AND has boundary:
   │  │  │
   │  │  ├─ Call pathsIntersect(piece.boundary, whimsyPath)
   │  │  │
   │  │  └─ If they intersect:
   │  │     │
   │  │     ├─ Clone both paths
   │  │     │
   │  │     ├─ Call subtractPaths(clonedPiece, clonedWhimsy)
   │  │     │  │
   │  │     │  └─ paperUtils uses paper.js subtract()
   │  │     │
   │  │     └─ Update piece.boundary with result
   │  │
   │  └─ Non-intersecting pieces unchanged
   │
   ├─ Create new whimsy Area
   │
   ├─ Add whimsy to state.areas (as standalone piece)
   │
   └─ Return new PuzzleState
   │
   ↓
7. usePuzzleEngine stores new state in history
   │
   ↓
8. App gets updated state
   │
   ↓
9. App calls engine.getDisplayPiecesData()
   │
   ├─ Converts all piece boundaries to SVG paths
   └─ (Pieces now have holes where whimsy intersected)
   │
   ↓
10. V2Canvas renders all pieces (with holes)
   │
   ↓
11. User sees whimsy subtracted from pieces!
```

## Area Hierarchy: Before and After Subdivision

### Before (Single Piece)

```
state.areas = {
  'root': {
    id: 'root',
    type: 'piece',
    parentId: null,
    boundary: paper.Path (full canvas rectangle)
  }
}
```

### After Grid Subdivision (4x2)

```
state.areas = {
  'root': {
    id: 'root',
    type: 'group',         ← Changed from 'piece' to 'group'!
    parentId: null,
    childrenIds: ['area_1', 'area_2', 'area_3', 'area_4', ...],
    boundary: null         ← Removed (groups don't have geometry)
  },
  'area_1': {
    type: 'piece',
    parentId: 'root',
    boundary: paper.Path (top-left cell)
  },
  'area_2': {
    type: 'piece',
    parentId: 'root',
    boundary: paper.Path (top-middle cell)
  },
  ...
}
```

## Component Dependency Graph

```
App.tsx
├── imports usePuzzleEngine from hooks/
├── imports V2* from components/
├── imports types from types.ts
└── imports constants from constants.ts

usePuzzleEngine.ts
├── imports types from types.ts
├── imports createRootPuzzle from topologyEngine.ts
├── imports createGridSubdivision from topologyEngine.ts
├── imports createHexGridSubdivision from topologyEngine.ts
├── imports createRandomGridSubdivision from topologyEngine.ts
├── imports mergePieces from topologyEngine.ts
├── imports addWhimsy from topologyEngine.ts
└── imports getDisplayPieces from topologyEngine.ts

topologyEngine.ts
├── imports types from types.ts
├── imports setupPaperProject from paperUtils.ts
├── imports pathItemFromBoundaryData from paperUtils.ts
├── imports pathItemToPathData from paperUtils.ts
├── imports pathsIntersect from paperUtils.ts
├── imports unitePaths from paperUtils.ts
├── imports subtractPaths from paperUtils.ts
├── imports clonePath from paperUtils.ts
├── imports COLORS from constants.ts
└── imports paper from 'paper'

paperUtils.ts
└── imports paper from 'paper'

V2Canvas.tsx
├── imports Area, Point, Connector from types.ts
└── imports Tab from constants.ts

V2ActionBar.tsx
├── imports Tab from constants.ts
└── imports Area from types.ts

V2CreateModal.tsx
└── imports CreateRootShape from types.ts
```

## State Immutability Pattern

```
Old State (s1)
  areas: { 'root': piece, 'area_1': piece, ... }
  
  ↓ (call subdivideGrid)
  
  topologyEngine.createGridSubdivision(s1, params)
  
  ↓ Creates new object
  
  New State (s2)
    areas: { 'root': group, 'area_1': piece, 'sub_1': piece, ... }
    
    ↓ (call merge)
    
    topologyEngine.mergePieces(s2, params)
    
    ↓ Creates new object
    
    New State (s3)
      areas: { 'root': group, 'area_1': merged_piece, ... }
```

All states stored in history array:
```
history = [s0, s1, s2, s3, ...]
         ↑           ↑
      initial   current (can undo to s2 or s1)
```

## Paper.js Integration Points

```
Paper.js Library
├── Path Representation
│  └── paper.PathItem = paper.Path | paper.CompoundPath
│
├── Boolean Operations
│  ├── path.unite(other) → PathItem
│  ├── path.subtract(other) → PathItem
│  └── path.intersect(other) → PathItem
│
├── Intersection Detection
│  └── path.getIntersections(other) → CurveLocation[]
│
├── Boundary Operations
│  ├── path.bounds → Rectangle
│  ├── path.pathData → string (SVG)
│  └── new Path(svgData) ← string
│
└── Project Management
   ├── paper.setup(size) → Initialize
   ├── paper.project.remove() → Cleanup
   └── paper.Point, paper.Size → Geometry
```

## Error Handling Flow

```
User Action
  │
  ↓
App Component
  │
  ├─ Try to call engine method
  │
  └─ Catch Error
     │
     ├─ If merge: "Cannot merge: pieces do not intersect"
     ├─ If subdivide: "Cannot subdivide area: already a group"
     └─ Display to user (UI responsibility)
```

---

This architecture ensures:
- ✅ Clear separation of concerns
- ✅ Testable pure functions in engine
- ✅ React integration via hooks
- ✅ Paper.js geometry abstraction
- ✅ Immutable state for undo/redo
- ✅ Reusable UI components
