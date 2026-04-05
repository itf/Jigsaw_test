# Best Practices: Jigsaw Studio

## 1. Geometry & Path Manipulation

### 1.1 Deterministic Tab Generation
When generating interlocking tabs, the "tab" and "socket" must match exactly. To achieve this, the tab's direction and shape must be deterministic based on the edge's coordinates, regardless of the order of points (`p1` to `p2` or `p2` to `p1`).
- **Use a Hash Function**: Generate a seed from the sorted coordinates to ensure consistent "warp" or "random" offsets.
- **Consistent Direction**: Always point the tab in a direction relative to the sorted order of points.

### 1.2 Paper.js Memory Management
`paper.js` objects (Paths, Points, etc.) are kept in memory until explicitly removed.
- **Cleanup**: Always call `.remove()` on temporary `paper.Path` or `paper.PathItem` objects after extracting their `pathData`.
- **Headless Mode**: Use `paper.setup()` with a fixed size for headless geometry calculations if not using a canvas-based view.

### 1.3 Floating-Point Precision
When checking if a point lies on a boundary (e.g., `x === 0`), use a small epsilon (e.g., `0.1`) to account for floating-point inaccuracies.
- **Example**: `Math.abs(p.x) < 0.1` instead of `p.x === 0`.

### 1.4 Granular Caching
Geometry calculations are the primary bottleneck. Use a persistent cache to skip redundant work.
- **Dependency Hashing**: Generate a unique hash for each piece based on its specific geometry, connectors, and whimsy status.
- **Selective Re-generation**: Check the cache before performing boolean operations. If the hash matches, reuse the existing `pathData`.

### 1.5 Spatial-Aware Boolean Operations
Avoid global operations that process the entire puzzle at once.
- **Localize Connectors**: Map each Voronoi cell to its specific shared edges. Only process connectors that are physically attached to the piece being generated.
- **Bounds Checks**: Use `path.bounds.intersects()` to quickly discard non-intersecting geometries before performing expensive boolean operations.

## 2. State Management & Performance

### 2.1 Operation Log
Maintain a flat list of operations (`Operation[]`) instead of just the final state. This enables:
- **Replayability**: Re-run operations to regenerate the puzzle with different parameters.
- **Undo/Redo**: Easily traverse the history of changes.

### 2.2 Memoization
Geometry calculations (Voronoi, piece clipping) are computationally expensive.
- **useMemo**: Wrap the Voronoi generation and piece path calculations in `useMemo` to prevent redundant work on every render.
- **useCallback**: Use `useCallback` for rendering functions that are passed down or used in effects.

## 3. UI/UX Design

### 3.1 Responsive Layout
- **Mobile-First**: Use Tailwind's responsive prefixes (`lg:`, `md:`) to handle different screen sizes.
- **Collapsible Sidebar**: Provide a way to hide settings to maximize the canvas workspace, especially on smaller screens.
- **Visual Feedback**: Use hover states and subtle animations (`motion`) to guide the user's attention.

### 3.2 SVG Export
- **Clean Paths**: Ensure the exported SVG contains only the necessary paths for cutting.
- **ViewBox**: Correctly set the `viewBox` and `width`/`height` attributes to match the design's dimensions.

## 4. Code Quality

### 4.1 TypeScript
- **Strong Typing**: Use interfaces for core data structures (`Point`, `Operation`, `Piece`).
- **Avoid `any`**: Minimize the use of `any`, especially when working with external libraries like `d3-delaunay` or `paper.js`.

### 4.2 Component Structure
- **Separation of Concerns**: Keep geometry logic in a separate file (`geometry.ts`) and UI logic in `App.tsx`.
- **Reusable Components**: Break down complex UI sections into smaller, manageable components.
