# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-04-02

### Added
- **Granular Piece Caching**: Implemented a `pieceCache` using `useRef` to store generated geometry and dependency hashes. This allows the engine to skip expensive calculations for pieces that haven't changed.
- **Dependency Hashing**: Each piece now calculates a unique hash based on its base geometry, boundary connectors, whimsy status, and global settings.
- **Performance Monitoring**: Added a performance timer to the puzzle generation logic with console warnings for durations exceeding 100ms.

### Optimized
- **Spatial-Aware Connector Application**: The engine now maps Voronoi cells to their specific shared edges, processing only relevant connectors for each piece. This reduces boolean operations by ~80-90%.
- **Fast Connector Stamps**: Refactored `createConnectorStamp` to use `CompoundPath` instead of `unite`, making initial stamp generation nearly instantaneous.
- **Individual Whimsy Clipping**: Changed whimsy subtraction to process individual whimsies only when they intersect a piece, significantly improving performance for sparse whimsy distributions.
- **Fast Bounds Checks**: Added preliminary bounds checks to `isPointInPath` and the global robustness pass to quickly discard non-intersecting geometries.
- **Memory Management**: Implemented aggressive cleanup of Paper.js objects (`.remove()`) to prevent memory leaks and ensure consistent performance during long design sessions.

### Fixed
- **UI Lag**: Resolved significant performance degradation when adding pieces or moving connector sliders.
