# Current Functionality: Jigsaw Studio

## 1. Core Puzzle Generation
- **Voronoi-Based Patterns**: Automatically generates puzzle patterns using Voronoi diagrams powered by `d3-delaunay`.
- **Interlocking Tabs**: All internal edges feature classic jigsaw "tabs" and "sockets" for a secure fit.
- **Deterministic Geometry**: Tabs are generated based on edge coordinates, ensuring that adjacent pieces always match perfectly.
- **Adjustable Parameters**:
    - **Canvas Size**: Customize the width and height of the puzzle.
    - **Piece Count**: Add pieces in increments or regenerate the entire pattern.
    - **Tab Size**: Adjust the radius of the interlocking tabs.
    - **Edge Warping**: Toggle randomized offsets for a more organic, hand-cut appearance.

## 2. Whimsy Pieces
- **Special Shapes**: Support for adding "Heart" and "Star" whimsy pieces.
- **Dynamic Adaptation**: 
    - Placing a whimsy automatically removes any Voronoi points inside it.
    - Surrounding Voronoi cells expand to fill the space and are then clipped by the whimsy shape.
- **Separate Pieces**: Whimsies are treated as individual, cuttable puzzle pieces with their own colors.
- **Split Piece Handling**: If a whimsy divides a Voronoi cell into multiple disconnected parts, each part is automatically converted into a separate piece.

## 3. User Interface & Experience
- **Responsive Design**: 
    - **Desktop**: Collapsible sidebar for a focused workspace.
    - **Mobile**: Slide-over menu and mobile-friendly header.
- **Visual Feedback**:
    - **Cell Coloring**: Vibrant colors to easily differentiate between pieces.
    - **Hover Highlights**: Interactive highlighting of the full interlocking piece shape.
    - **Point Visibility**: Toggle the display of the underlying Voronoi points.
- **Operation Log**: A detailed history of all actions (generating points, adding whimsies) for tracking and future replayability.

## 4. Export Capabilities
- **SVG Export**: Generates a clean, single-path SVG file ready for laser cutting or professional printing.
- **Boundary Handling**: Correctly identifies and renders straight edges for the puzzle's outer boundary.

## 5. Performance & Optimization
- **Granular Piece Caching**: 
    - Uses a `useRef` to store generated geometry and dependency hashes for each piece.
    - Skips expensive Paper.js boolean operations for pieces that haven't changed (e.g., when moving a single connector).
- **Spatial-Aware Connector Application**: 
    - Maps Voronoi cells to their specific shared edges.
    - Each piece only processes the connectors that are physically attached to it, reducing boolean operations by ~80-90%.
- **Optimized Connector Stamps**: 
    - Refactored `createConnectorStamp` to use `CompoundPath` instead of `unite`.
    - Initial stamp generation is nearly instantaneous, making real-time adjustments feel much smoother.
- **Fast Bounds Checks**: 
    - Preliminary bounds checks in `isPointInPath` and the global robustness pass to quickly discard non-intersecting geometries.
- **Memory Management**: 
    - Aggressive cleanup of Paper.js objects (`.remove()`) to prevent memory leaks and ensure consistent performance.

## 6. Technical Foundation
- **React 19 & Vite**: Modern, fast development environment.
- **Paper.js**: Robust geometry engine for complex boolean operations (unions, subtractions, intersections).
- **Tailwind CSS (v4)**: Utility-first styling for a polished, modern look.
- **Lucide React**: High-quality iconography.
- **Motion**: Smooth UI transitions and animations.
