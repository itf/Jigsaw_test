# Jigsaw Studio - Implementation Plan

## Phase 1: Foundation (Completed)
- [x] Basic UI Layout (Canvas + Sidebar)
- [x] Operation Log System (Redux-like state for replayability)
- [x] Basic Voronoi Generation using `d3-delaunay`
- [x] SVG Rendering of pieces
- [x] Interlocking tab generation (classic puzzle shape)
- [x] Whimsy pieces (Heart, Star) with boolean operations
- [x] Responsive layout (mobile-friendly)
- [x] SVG Export optimized for laser cutters

## Phase 2: Manual Control & Selection (Completed)
- [x] **Manual Point Addition**: Add points anywhere on the canvas.
- [x] **Piece Selection**: Select and highlight pieces.
- [x] **Piece Deletion**: Remove Voronoi or Whimsy pieces.
- [x] **Piece Merging**: Unite adjacent Voronoi cells.

## Phase 3: Advanced Customization (In Progress)
- [x] **Custom Connectors**: Ball, Dovetail, Zigzag, Wave, Square, None.
- [x] **Per-piece Warping**: Toggle edge randomization per piece.
- [x] **SVG Whimsy Library**:
    - [x] Support for uploading custom SVGs.
    - [x] Categorized library (Stars, Trees, Animals).
    - [x] SVG path extraction and normalization.
- [x] **Whimsy Transformation**:
    - [x] Preview whimsy that follows the cursor.
    - [x] Scale and Rotate whimsies using mouse wheel/keyboard before placement.
- [ ] **Multi-Assembly Support (Brainstorming & Planning)**:
    - [ ] **Boundary Segments**: Implement a tool to select a sequence of shared edges. Group these into "Boundary Segments" that can be named and reused.
    - [ ] **Segment Syncing**: Create a mechanism to link two Boundary Segments. Any change to one (connector type, warping, etc.) will automatically update the linked segment, supporting mirroring and rotation.
    - [ ] **Alternative Connections**: Allow a piece to have multiple segments that are compatible with a single target segment, enabling puzzles that can be assembled in multiple valid ways.
    - [ ] **Sub-Assembly Operations**: Enable grouping multiple pieces into a "Sub-Assembly" that can be treated as a single unit for movement or transformation during the design phase.

## Phase 4: Polish & Persistence
- [ ] **Undo/Redo System**: Implement a robust command pattern for all puzzle modifications.
- [ ] **Save/Load Functionality**: Support exporting/importing the full puzzle state as JSON.
- [ ] **Advanced Mobile Optimizations**: Refine radial menu and touch interactions for smaller screens.
- [x] **Performance Optimization**: 
    - [x] Granular piece caching with dependency hashes.
    - [x] Spatial-aware connector application.
    - [x] Optimized connector stamps and bounds checks.
    - [ ] Offload heavy geometry calculations to Web Workers to ensure a smooth UI.
- [ ] **Conformal Mappings**: Artistic global distortions for unique puzzle shapes.
