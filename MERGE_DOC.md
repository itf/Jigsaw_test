# Robust Topological Merging in Jigsaw Studio

## The Problem: Boolean Imprecision
Traditional jigsaw puzzle software often relies on boolean operations (like `unite` or `subtract`) to merge pieces. However, boolean operations are sensitive to floating-point errors and "pixel gaps." If two pieces don't perfectly touch, `unite` might fail or create tiny artifacts (slivers).

## The Solution: Topological Graph Engine
Jigsaw Studio V2 now uses a **Topological Graph** approach. Instead of each piece "owning" its boundary, the puzzle is represented as a network of shared vertices and edges.

### 1. Unique Edges
When the puzzle is subdivided (e.g., via Voronoi), we extract every segment and deduplicate it. Each edge in the graph knows exactly which two pieces (faces) it separates. We round vertex coordinates to 3 decimal places to handle floating-point drift.

### 2. Logical Merging
Merging two pieces is a pure logical operation: we simply mark the edge between them as "internal." This doesn't change any geometry, so it's 100% robust and instantaneous.

### 3. Boundary Traversal
To render a piece (or a group of merged pieces), we traverse only the "external" edges. We start at a vertex and follow edges that are not marked as internal until we return to the start. This naturally handles holes (compound paths) by finding multiple disconnected loops.

### 4. Robust Connectors
Connectors are integrated directly into the graph. When a connector is added to an edge, that edge's geometry is "warped" in the graph. Since the edge is shared, both adjacent pieces automatically see the same connector geometry, ensuring a perfect fit with zero-pixel tolerance.

## 3x3 Grid Cycle Test
The **"Test 3x3"** button in the header verifies this strategy:
1.  **Subdivide**: It creates a 3x3 grid (9 pieces).
2.  **Merge**: It merges the 8 outer pieces into a single ring.
3.  **Verify**: 
    *   It checks that exactly 2 pieces exist (the ring and the center).
    *   It verifies the ring is a **Compound Path** (containing multiple 'M' commands in SVG).
    *   It confirms the center piece remains isolated and fits the hole perfectly.

This test confirms that the topological engine correctly handles complex cycles and holes, which are the most common failure points for boolean-based merging.

## Comparing Approaches
You can toggle between the **Boolean** and **Topo** engines in the header to compare results. The Topological engine is the default as it provides superior robustness for complex topological scenarios.
