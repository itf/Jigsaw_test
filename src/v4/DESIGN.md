# V4 Architecture Document

## Overview

V4 is a simplified puzzle engine focused on **topology operations only**. It reuses the V2 UI components but replaces the complex boolean geometry engine with a straightforward area-based topology system.

## Data Model

### Core Concept: Areas

The entire puzzle is built on **Areas**. Each area is one of two types:

- **`piece`**: A leaf node with a paper.js `PathItem` boundary that can be displayed or merged
- **`group`**: A container for other areas, created when subdividing

```typescript
interface Area {
  id: string;
  type: 'group' | 'piece';
  parentId: string | null;
  childrenIds: string[];        // Only populated for 'group' type
  boundary: paper.PathItem | null; // Only exists for 'piece' type
  color: string;
  label?: string;
}
```

### Key Insight: Hierarchy

- The root area starts as a `piece`
- When subdivided, it becomes a `group` with child `pieces`
- Pieces can be merged back together
- Whimsies are always `pieces` but are not children of any group

## Core Operations

### 1. Create Root Puzzle

```typescript
createRootPuzzle(width: number, height: number, shape: CreateRootShape)
```

**What it does:**
- Initializes a new puzzle with a single root area
- The root can be a rectangle, circle, or multi-circle shape
- Sets up paper.js project for the given dimensions

**Result:**
- `PuzzleState` with one root `piece` area

### 2. Subdivide (Grid, Hex, Random)

```typescript
createGridSubdivision(state, params)
createHexGridSubdivision(state, params)
createRandomGridSubdivision(state, params)
```

**What it does:**
- Takes a `piece` area and divides it into smaller `pieces`
- Creates a grid pattern (rectangular or hexagonal)
- For random, generates random points and creates cells around them
- **Converts the parent from `piece` to `group`**

**Key mechanics:**
- Each cell is clipped to the parent boundary using `intersect()`
- Each cell becomes a new `piece` child of the parent group
- Parent's `boundary` is set to `null` (groups don't have geometry)

**Result:**
- Parent becomes a `group` with `childrenIds` pointing to the new pieces

### 3. Merge Pieces

```typescript
mergePieces(state, { pieceAId: string, pieceBId: string })
```

**What it does:**
- Checks if two pieces intersect using paper.js
- Uses `unite()` to combine their boundaries
- Creates a new merged `piece`
- Deletes the original pieces

**Safety:**
- Throws error if pieces don't intersect
- Only works on `piece` type areas (not groups)

**Result:**
- New merged piece replaces both originals
- Parent group's `childrenIds` is updated

### 4. Add Whimsy

```typescript
addWhimsy(state, params)
```

**What it does:**
- Creates a whimsy shape (circle, star) at a given position
- **Subtracts the whimsy from all intersecting pieces**
- Creates the whimsy as a new standalone `piece`

**Key mechanics:**
- For each piece that intersects the whimsy:
  - Clone the whimsy path
  - Use `subtract()` to remove it from the piece boundary
  - Update the piece's boundary data
- The whimsy itself remains unchanged (not subtracted from)
- Whimsy is a standalone piece, not child of any group

**Result:**
- All intersecting pieces have holes where the whimsy is
- New whimsy piece added to the puzzle

## File Structure

```
v4/
├── types.ts              # Core data types (Area, PuzzleState, etc.)
├── constants.ts          # Colors, Tab enum
├── topologyEngine.ts     # Core operations (create, subdivide, merge, whimsy)
├── paperUtils.ts         # Paper.js wrappers (paths, boolean ops)
├── App.tsx               # Main React component
├── index.ts              # Module exports
├── hooks/
│   └── usePuzzleEngine.ts # React hook for state management + undo/redo
└── components/
    ├── V2Header.tsx      # Header with undo button
    ├── V2Navigation.tsx  # Tab navigation (topology only)
    ├── V2ActionBar.tsx   # Subdivision and whimsy controls
    ├── V2Canvas.tsx      # SVG canvas rendering
    └── V2CreateModal.tsx # Initial puzzle creation dialog
```

## UI Components

All components are simplified versions of V2, but reuse the same structure:

### V2CreateModal
- Asks user to choose canvas size and initial shape
- Calls `engine.initializePuzzle(width, height, shape)`

### V2ActionBar
- **Subdivision controls**: Pattern (Grid/Hex/Random), grid dimensions
- **Merge button**: Merges all selected pieces
- **Whimsy controls**: Template (Circle/Star), scale, rotation

### V2Canvas
- Displays pieces as SVG paths
- Handles click-to-select and multi-select
- Shows whimsy preview when in placement mode
- Supports click-to-place whimsies

## State Management

The `usePuzzleEngine` hook manages:

```typescript
{
  state: PuzzleState | null,           // Current puzzle state
  initializePuzzle(...),               // Create new puzzle
  subdivideGrid(...),                  // Grid subdivision
  subdivideHexGrid(...),               // Hex subdivision
  subdivideRandom(...),                // Random subdivision
  merge(...),                          // Merge two pieces
  addWhimsyPiece(...),                 // Add whimsy
  undo(),                              // Undo last operation
  redo(),                              // Redo last operation
  canUndo: boolean,
  canRedo: boolean,
  getDisplayPiecesData()               // Get pieces for rendering
}
```

The hook stores full history, allowing complete undo/redo of any operation.

## Paper.js Integration

Key utility functions in `paperUtils.ts`:

```typescript
setupPaperProject(width, height)      // Initialize paper.js
pathItemFromBoundaryData(data)        // SVG string → paper.PathItem
pathItemToPathData(pathItem)          // paper.PathItem → SVG string
pathsIntersect(a, b)                  // Check if paths touch/overlap
unitePaths(a, b)                      // Combine two paths
subtractPaths(a, b)                   // Subtract b from a
clonePath(pathItem)                   // Deep clone a path
```

## Workflow Example

1. **Create puzzle**: User selects size (800×600) and shape (rectangle)
   - `initializePuzzle(800, 600, { variant: 'rect' })`
   - Creates root area with full canvas boundary

2. **Subdivide root**: User selects grid pattern (4×4)
   - `subdivideGrid({ parentAreaId: rootId, rows: 4, cols: 4 })`
   - Root becomes a group with 16 piece children
   - Each piece is a rectangular cell with clipped boundary

3. **Merge two pieces**: User selects two adjacent pieces and clicks merge
   - `merge({ pieceAId: 'area_xxx', pieceBId: 'area_yyy' })`
   - Two pieces are united into one
   - Original pieces deleted, new merged piece replaces them

4. **Add whimsy**: User selects circle, adjusts scale, clicks to place
   - `addWhimsyPiece({ templateId: 'circle', center: {x: 400, y: 300}, scale: 50, rotationDeg: 0 })`
   - All pieces intersecting the circle are subtracted
   - Circle whimsy piece created as standalone piece

## Future Enhancements

- SVG contour import for CreateRootShape
- Multi-circle support
- Voronoi-based random subdivision
- Connector system (non-functional UI stub in place)
- Additional whimsy templates
- Seed-based random generation for reproducibility
