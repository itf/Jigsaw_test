# Product Requirements Document: Jigsaw Studio

## 1. Overview
Jigsaw Studio is a professional-grade web application for designing custom jigsaw puzzles. It allows users to generate complex interlocking patterns using Voronoi diagrams, add custom "whimsy" shapes, and export the final design as a production-ready SVG for laser cutting.

## 2. Target Audience
- Puzzle hobbyists and makers.
- Laser cutting enthusiasts.
- Custom puzzle manufacturers.

## 3. Key Features

### 3.1 Voronoi Pattern Generation
- **Dynamic Grid**: Generate patterns based on a configurable number of points.
- **Interlocking Tabs**: Automatically generate classic puzzle "tabs" and "sockets" on all internal edges.
- **Deterministic Fit**: Tabs are generated deterministically so that adjacent pieces always fit perfectly.

### 3.2 Whimsy Pieces
- **Custom Shapes**: Support for adding special "whimsy" shapes (e.g., Hearts, Stars) that act as obstacles in the pattern.
- **Clipping & Boolean Ops**: Pieces are automatically clipped to stay within or wrap around whimsy shapes using `paper.js`.

### 3.3 Advanced Geometry
- **Edge Warping**: Optional randomization of tab control points for a more organic, hand-cut look.
- **Tab Size Control**: Adjustable tab radius to suit different material thicknesses and puzzle sizes.

### 3.4 High-Performance Geometry Engine
- **Granular Caching**: Selective re-generation of pieces using dependency hashes to ensure smooth real-time adjustments.
- **Spatial-Aware Processing**: Optimized boolean operations that only process relevant local connectors.
- **Memory Management**: Aggressive cleanup of geometry objects to maintain performance during long sessions.

### 3.5 User Interface
- **Responsive Design**: Collapsible sidebar and mobile-friendly layout for designing on any device.
- **Visual Feedback**: Real-time preview with cell coloring, hover highlights, and point visibility toggles.
- **Operation Log**: A history of all actions performed, enabling future replayability features.

### 3.5 Export
- **Laser-Ready SVG**: Export clean, single-path SVG files compatible with standard laser cutting software.

## 4. Technical Stack
- **Frontend**: React 19, Vite, Tailwind CSS (v4).
- **Geometry Engine**: `d3-delaunay` for Voronoi, `paper.js` for complex boolean operations and path manipulation.
- **Icons & UI**: `lucide-react` for iconography, `motion` for smooth transitions.

## 5. Future Roadmap
- **Custom Whimsy Upload**: Allow users to upload their own SVG contours as whimsy pieces.
- **Conformal Mappings**: Implement advanced geometric transformations for artistic distortions.
- **Undo/Redo**: Full state management for undoing and redoing operations.
- **Cloud Storage**: Save and load puzzle designs from a user account.
