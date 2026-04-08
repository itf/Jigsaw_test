# V4 Quick Start Guide

## Overview

V4 is a simplified puzzle engine that focuses on **topology operations**: creating puzzles, subdividing them, merging pieces, and adding whimsies.

## Getting Started

### 1. Launch the V4 App

```tsx
import V4App from './src/v4/App';

ReactDOM.render(<V4App />, document.getElementById('root'));
```

### 2. Create a New Puzzle

When the app loads, you'll see the creation modal:

1. **Select a shape**: Rectangle (full canvas) or Circle (inscribed)
2. **Choose size**: Use presets or enter custom dimensions
3. **Click "Create Puzzle"**

The canvas will now show your puzzle boundary as a single piece.

## Basic Operations

### Create a Grid

1. **Click on the canvas** to select the root piece
2. **Choose pattern**: Grid, Hex, or Random
3. **Set dimensions**: 
   - Grid: Rows × Cols (e.g., 4×4)
   - Hex: Rows × Cols
   - Random: Number of points
4. **Click "Subdivide"**

The piece will now be divided into a grid of smaller pieces.

### Merge Pieces

1. **Click multiple pieces** to select them (they'll highlight)
2. **Click "Merge"** button
3. Selected pieces will be combined into one

Note: You can only merge pieces that are adjacent (intersecting boundaries).

### Add a Whimsy

1. **Choose whimsy type**: Circle or Star
2. **Adjust parameters**:
   - Scale: How big the whimsy is
   - Rotation: How it's rotated
3. **Click "Place Whimsy"**
4. **Move your cursor** to see the preview
5. **Click on the canvas** to place the whimsy

The whimsy will be subtracted from all pieces it intersects with, creating holes in your puzzle.

### Undo/Redo

- **Click "Undo"** button (top right) to undo the last operation
- Subsequent operations will be re-enabled if you undo

## Key Concepts

### Pieces vs Groups

- **Piece**: An individual puzzle part with a visible boundary (can be subdivided or merged)
- **Group**: A container for other pieces (created when you subdivide)
  - Groups can contain pieces or other groups
  - You cannot directly render or select a group

### Whimsies

Whimsies are decorative shapes that:
- Subtract themselves from all intersecting pieces
- Create distinctive holes in the puzzle
- Can overlap multiple pieces
- Don't merge with other pieces (they stay as-is)

### Colors

Each piece gets a random color from a palette. Adjacent pieces in a grid will have different colors.

## Advanced Workflows

### Create a Nested Puzzle

1. Subdivide root into 4×4 grid (16 pieces)
2. Select 4 adjacent pieces in the top-left corner
3. Subdivide those 4 pieces again (becomes a 2×2 sub-grid)
4. Result: 1 large grid with 4 smaller grids within it

### Complex Whimsy Pattern

1. Create a 5×5 grid (25 pieces)
2. Add a circle whimsy in the center
3. Add another star whimsy overlapping it
4. Add a third whimsy in a corner
5. All pieces that intersect any whimsy will have holes

### Merge to Simplify

1. Create a 10×10 grid (100 pieces)
2. Select all pieces in a row and merge them
3. Result: 10 pieces (one per remaining row)

## Troubleshooting

### "Cannot subdivide" error
- Make sure you selected a piece (not already subdivided)
- Check that rows and columns are positive integers

### Merge button is disabled
- You need to select at least 2 pieces
- Pieces must be intersecting (adjacent)

### Whimsy didn't create holes
- Make sure the whimsy overlaps some pieces
- The whimsy should intersect at least one piece

### Canvas is very zoomed in/out
- This is normal - the canvas auto-fits the window
- The piece is still correctly positioned

## File Organization

```
src/v4/
├── App.tsx                 # Main app component
├── types.ts               # Data types
├── topologyEngine.ts      # Core operations
├── paperUtils.ts          # Paper.js utilities
├── constants.ts           # Colors and constants
├── hooks/
│   └── usePuzzleEngine.ts # State management
├── components/
│   ├── V2Header.tsx
│   ├── V2Navigation.tsx
│   ├── V2ActionBar.tsx
│   ├── V2Canvas.tsx
│   └── V2CreateModal.tsx
└── [Documentation files]
    ├── DESIGN.md
    ├── IMPLEMENTATION.md
    ├── API_REFERENCE.md
    └── QUICK_START.md (this file)
```

## How the Data Flows

```
User Action
    ↓
App Component
    ↓
Calls engine method (subdivideGrid, merge, addWhimsy, etc.)
    ↓
usePuzzleEngine hook
    ↓
Calls topologyEngine function
    ↓
New PuzzleState created
    ↓
usePuzzleEngine stores it in history
    ↓
App gets new state via hook
    ↓
getDisplayPiecesData() converts to renderable format
    ↓
V2Canvas renders as SVG
    ↓
User sees updated puzzle
```

## Examples

### Programmatic Puzzle Creation

```typescript
import { usePuzzleEngine } from './src/v4';

function MyPuzzleBuilder() {
  const engine = usePuzzleEngine();

  const buildPuzzle = () => {
    // Create 800×600 rectangle
    engine.initializePuzzle(800, 600, { variant: 'rect' });
    
    // Get root ID
    const rootId = engine.state?.rootAreaId!;

    // Create 4×4 grid
    engine.subdivideGrid({
      parentAreaId: rootId,
      rows: 4,
      cols: 4
    });

    // Add a circle in the middle
    engine.addWhimsyPiece({
      templateId: 'circle',
      center: { x: 400, y: 300 },
      scale: 100,
      rotationDeg: 0
    });

    // Get pieces for export/display
    const pieces = engine.getDisplayPiecesData();
    console.log(`Created puzzle with ${pieces.length} pieces`);
  };

  return <button onClick={buildPuzzle}>Build Puzzle</button>;
}
```

### Custom Grid Dimensions

```typescript
// Create 10×5 grid instead of 4×4
engine.subdivideGrid({
  parentAreaId: rootId,
  rows: 10,
  cols: 5
});
```

### Random Puzzle

```typescript
// Create random subdivision with 20 points
engine.subdivideRandom({
  parentAreaId: rootId,
  pointCount: 20
});
```

### Merge Multiple Pieces

```typescript
// Select pieces
setMergePickIds(['area_1', 'area_2', 'area_3']);

// Merge them
let acc = 'area_1';
for (let i = 1; i < 3; i++) {
  engine.merge({ 
    pieceAId: acc, 
    pieceBId: `area_${i+1}` 
  });
}
```

## Tips & Tricks

1. **Large grids may be slow** - Start with 10×10 and work up
2. **Whimsy placement** - Use crosshair to aim precisely
3. **Undo is unlimited** - Undo frequently while experimenting
4. **Colors help debugging** - Different colors = different pieces
5. **Test with circles** - Circles are more interesting than rectangles

## Next Steps

- Read `DESIGN.md` for architecture details
- Read `API_REFERENCE.md` for detailed function documentation
- Check `topologyEngine.ts` for implementation details
- Look at `usePuzzleEngine.ts` for state management patterns

## Limitations

- Currently supports topology only (no connectors)
- No PDF/print export yet
- No undo/redo visualization
- Limited whimsy templates (circle, star)
- No Voronoi subdivision (random is simple rectangular cells)

## Need Help?

- Check `IMPLEMENTATION.md` for what's implemented
- Review function errors - they're descriptive
- Look at App.tsx to see how hooks are used
- Check V2Canvas for rendering patterns
