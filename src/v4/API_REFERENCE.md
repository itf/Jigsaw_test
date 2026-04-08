# V4 API Reference

## types.ts

### Interfaces

#### `Area`
Core unit of the puzzle system.
```typescript
interface Area {
  id: string;
  type: AreaType;                    // 'group' | 'piece'
  parentId: string | null;
  childrenIds: string[];             // For groups
  boundary: paper.PathItem | null;   // For pieces
  color: string;
  label?: string;
}
```

#### `PuzzleState`
Complete puzzle state at a point in time.
```typescript
interface PuzzleState {
  areas: Record<string, Area>;
  rootAreaId: string;
  width: number;
  height: number;
  history: Operation[];
  selectedId: string | null;
}
```

#### `CreateGridParams`
```typescript
interface CreateGridParams {
  parentAreaId: string;
  rows: number;
  cols: number;
}
```

#### `CreateHexGridParams`
```typescript
interface CreateHexGridParams {
  parentAreaId: string;
  rows: number;
  cols: number;
}
```

#### `CreateRandomGridParams`
```typescript
interface CreateRandomGridParams {
  parentAreaId: string;
  pointCount: number;
  seed?: number;
}
```

#### `MergePiecesParams`
```typescript
interface MergePiecesParams {
  pieceAId: string;
  pieceBId: string;
}
```

#### `AddWhimsyParams`
```typescript
interface AddWhimsyParams {
  templateId: 'circle' | 'star';
  center: Point;
  scale: number;
  rotationDeg: number;
}
```

#### `Operation`
```typescript
interface Operation {
  id: string;
  type: OperationType;
  params: any;
  timestamp: number;
}
```

### Types

#### `AreaType`
```typescript
type AreaType = 'group' | 'piece';
```

#### `Point`
```typescript
type Point = { x: number; y: number };
```

#### `CreateRootShape`
```typescript
type CreateRootShape =
  | { variant: 'rect' }
  | { variant: 'circle' }
  | { variant: 'svgContour' }
  | { variant: 'multiCircle'; count: 2 };
```

#### `OperationType`
```typescript
type OperationType = 
  | 'CREATE_ROOT'
  | 'CREATE_GRID'
  | 'CREATE_HEX_GRID'
  | 'CREATE_RANDOM_GRID'
  | 'MERGE_PIECES'
  | 'ADD_WHIMSY';
```

---

## topologyEngine.ts

### Functions

#### `createRootPuzzle(width, height, shape)`
Creates a new puzzle with a single root piece.

**Parameters:**
- `width: number` - Canvas width
- `height: number` - Canvas height
- `shape: CreateRootShape` - Root shape type

**Returns:** `PuzzleState`

**Throws:** Error if shape variant is not implemented

**Example:**
```typescript
const state = createRootPuzzle(800, 600, { variant: 'rect' });
```

---

#### `createGridSubdivision(state, params)`
Subdivides a piece into a rectangular grid.

**Parameters:**
- `state: PuzzleState` - Current puzzle state
- `params: CreateGridParams` - Grid dimensions

**Returns:** `PuzzleState`

**Throws:** Error if area not found or already a group

**Behavior:**
- Converts parent piece to group
- Creates `rows × cols` child pieces
- Each cell is clipped to parent boundary

**Example:**
```typescript
const newState = createGridSubdivision(state, {
  parentAreaId: 'area_123',
  rows: 4,
  cols: 4
});
```

---

#### `createHexGridSubdivision(state, params)`
Subdivides a piece into a hexagonal grid.

**Parameters:**
- `state: PuzzleState` - Current puzzle state
- `params: CreateHexGridParams` - Hex grid dimensions

**Returns:** `PuzzleState`

**Example:**
```typescript
const newState = createHexGridSubdivision(state, {
  parentAreaId: 'area_123',
  rows: 5,
  cols: 5
});
```

---

#### `createRandomGridSubdivision(state, params)`
Subdivides a piece into random cells.

**Parameters:**
- `state: PuzzleState` - Current puzzle state
- `params: CreateRandomGridParams` - Random params

**Returns:** `PuzzleState`

**Note:** Current implementation uses simple rectangular cells around random points. Future versions may use Voronoi.

**Example:**
```typescript
const newState = createRandomGridSubdivision(state, {
  parentAreaId: 'area_123',
  pointCount: 20,
  seed: 42
});
```

---

#### `mergePieces(state, params)`
Merges two intersecting pieces into one.

**Parameters:**
- `state: PuzzleState` - Current puzzle state
- `params: MergePiecesParams` - Piece IDs to merge

**Returns:** `PuzzleState`

**Throws:** 
- Error if either piece not found
- Error if pieces have no boundary
- Error if pieces don't intersect

**Behavior:**
- Uses paper.js `unite()` to combine boundaries
- Creates new merged piece
- Deletes original pieces
- Updates parent group's childrenIds

**Example:**
```typescript
const newState = mergePieces(state, {
  pieceAId: 'area_123',
  pieceBId: 'area_456'
});
```

---

#### `addWhimsy(state, params)`
Adds a whimsy shape and subtracts it from intersecting pieces.

**Parameters:**
- `state: PuzzleState` - Current puzzle state
- `params: AddWhimsyParams` - Whimsy configuration

**Returns:** `PuzzleState`

**Behavior:**
- Creates whimsy shape (circle or star)
- Finds all pieces that intersect the whimsy
- Subtracts whimsy from each intersecting piece using `subtract()`
- Creates whimsy as new standalone piece
- Whimsy is NOT subtracted from itself

**Example:**
```typescript
const newState = addWhimsy(state, {
  templateId: 'circle',
  center: { x: 400, y: 300 },
  scale: 50,
  rotationDeg: 0
});
```

---

#### `getDisplayPieces(state)`
Gets all pieces in displayable format for rendering.

**Parameters:**
- `state: PuzzleState` - Current puzzle state

**Returns:** `Array<{ id: string; pathData: string; color: string; label?: string }>`

**Note:** Only returns `piece` type areas with boundaries. Groups are not displayed.

**Example:**
```typescript
const pieces = getDisplayPieces(state);
// pieces = [
//   { id: 'area_1', pathData: 'M 0 0 L 100 0 ...', color: '#f87171' },
//   ...
// ]
```

---

## paperUtils.ts

### Functions

#### `setupPaperProject(width, height)`
Initialize or reset paper.js project.

**Parameters:**
- `width: number`
- `height: number`

**Example:**
```typescript
setupPaperProject(800, 600);
```

---

#### `pathItemFromBoundaryData(data)`
Convert SVG path data string to paper.js PathItem.

**Parameters:**
- `data: string` - SVG path data

**Returns:** `paper.PathItem` (Path or CompoundPath)

**Example:**
```typescript
const path = pathItemFromBoundaryData('M 0 0 L 100 0 L 100 100 Z');
```

---

#### `pathItemToPathData(pathItem)`
Convert paper.js PathItem to SVG path data string.

**Parameters:**
- `pathItem: paper.PathItem`

**Returns:** `string` - SVG path data

**Example:**
```typescript
const data = pathItemToPathData(path);
```

---

#### `createRectanglePath(width, height)`
Create a rectangle path.

**Returns:** `paper.Path`

---

#### `createCirclePath(width, height)`
Create a circle inscribed in the given dimensions.

**Returns:** `paper.Path`

---

#### `pathsIntersect(pathA, pathB, tol?)`
Check if two paths intersect or touch.

**Parameters:**
- `pathA: paper.PathItem`
- `pathB: paper.PathItem`
- `tol: number` (default: 1.0) - Tolerance in pixels

**Returns:** `boolean`

**Example:**
```typescript
if (pathsIntersect(pieceA.boundary!, pieceB.boundary!)) {
  // They can be merged
}
```

---

#### `unitePaths(pathA, pathB)`
Combine two paths using boolean union.

**Parameters:**
- `pathA: paper.PathItem`
- `pathB: paper.PathItem`

**Returns:** `paper.PathItem` - Unified path

**Note:** Removes input paths

---

#### `subtractPaths(pathA, pathB)`
Subtract pathB from pathA.

**Parameters:**
- `pathA: paper.PathItem`
- `pathB: paper.PathItem`

**Returns:** `paper.PathItem` - Result path

**Note:** Removes input paths

---

#### `clonePath(pathItem)`
Deep clone a path.

**Parameters:**
- `pathItem: paper.PathItem`

**Returns:** `paper.PathItem` - Cloned path

---

## hooks/usePuzzleEngine.ts

### Hook

#### `usePuzzleEngine()`
React hook for puzzle state management.

**Returns:**
```typescript
{
  state: PuzzleState | null;
  initializePuzzle(width, height, shape): void;
  subdivideGrid(params): void;
  subdivideHexGrid(params): void;
  subdivideRandom(params): void;
  merge(params): void;
  addWhimsyPiece(params): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  getDisplayPiecesData(): Array<{...}>;
}
```

**Example:**
```typescript
const engine = usePuzzleEngine();

engine.initializePuzzle(800, 600, { variant: 'rect' });
engine.subdivideGrid({ parentAreaId: engine.state!.rootAreaId, rows: 4, cols: 4 });
```

---

## constants.ts

### Constants

#### `COLORS`
```typescript
const COLORS: string[] = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80',
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8',
  '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'
];
```

Used for coloring pieces. Colors are assigned sequentially.

### Types

#### `Tab`
```typescript
type Tab = 'TOPOLOGY' | 'MODIFICATION' | 'CONNECTION' | 'RESOLUTION' | 'TRANSFORMATION' | 'PRODUCTION' | 'HISTORY';
```

Currently only 'TOPOLOGY' is implemented.

---

## Components

### V2CreateModal

**Props:**
```typescript
interface V2CreateModalProps {
  onCreate: (w: number, h: number, shape: CreateRootShape) => void;
}
```

**Features:**
- Shape selection (rect, circle, multi-circle, SVG contour)
- Size presets (Square, A4, 4:3, 16:9)
- Custom size input

---

### V2Canvas

**Props:**
```typescript
interface V2CanvasProps {
  width: number;
  height: number;
  fitScale: number;
  isMobile: boolean;
  activeTab: Tab;
  displayPieces: Array<{id, pathData, color, label?}>;
  selectedId: string | null;
  mergePickIds: string[];
  sharedEdges: any[];
  resolvedConnectors: Connector[];
  topology: Record<string, Area>;
  setHoveredId: (id: string | null) => void;
  setHoveredType: (type) => void;
  handleAreaClick: (id: string, e: React.MouseEvent) => void;
  addConnector: (areaAId, areaBId, u) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedType: (type) => void;
  longPressProps: any;
  onBackgroundClick?: () => void;
  whimsyPlacementActive?: boolean;
  whimsyPreviewPathData?: string | null;
  onWhimsyBoardPointerMove?: (p: Point) => void;
  onWhimsyCommit?: (p: Point) => void;
}
```

**Features:**
- SVG rendering of pieces
- Click to select/deselect pieces
- Whimsy preview with crosshair
- Click to place whimsy

---

### V2ActionBar

**Props:**
```typescript
interface V2ActionBarProps {
  activeTab: Tab;
  splittingHint: string | null;
  canSubdivide: boolean;
  splitPattern: 'GRID' | 'HEX' | 'RANDOM';
  setSplitPattern: (pattern) => void;
  gridRows: number;
  setGridRows: (rows) => void;
  gridCols: number;
  setGridCols: (cols) => void;
  hexRows: number;
  setHexRows: (rows) => void;
  hexCols: number;
  setHexCols: (cols) => void;
  randomPoints: number;
  setRandomPoints: (count) => void;
  subdivideSelectedPieces: () => void;
  selectedId: string | null;
  selectedType: 'AREA' | 'CONNECTOR' | 'NONE';
  selectionData?: Area;
  mergePickIds: string[];
  mergeSelectedPieces: () => void;
  onClearSelection: () => void;
  whimsyTemplate: 'circle' | 'star';
  setWhimsyTemplate: (template) => void;
  whimsyScale: number;
  setWhimsyScale: (scale) => void;
  whimsyRotationDeg: number;
  setWhimsyRotationDeg: (rotation) => void;
  whimsyPlacementActive: boolean;
  startWhimsyPlacement: () => void;
  cancelWhimsyPlacement: () => void;
}
```

---

## Error Handling

All operations throw descriptive errors:

```typescript
try {
  mergePieces(state, { pieceAId: 'bad_id', pieceBId: 'area_456' });
} catch (e) {
  console.error(e.message); // "Cannot merge: one or both pieces not found..."
}
```

Common errors:
- `Cannot subdivide area X: not a piece or not found`
- `Cannot subdivide area X: already a group`
- `Cannot merge: one or both pieces not found or have no boundary`
- `Cannot merge: both areas must be pieces`
- `Cannot merge: pieces do not intersect`
