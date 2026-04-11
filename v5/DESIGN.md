# Jigsaw Studio V5: Graph-Based Architecture Design

## 1. Current Architecture (V3/V4) Analysis

### How it works: Closed Path Booleans
In the current version, every puzzle piece is represented as a **closed path** (using Paper.js `Path` or `CompoundPath`). 

#### Subdivision
When a piece is split (e.g., by a grid or Voronoi), we perform a **Boolean Intersection**:
1.  Create a "cutter" path (e.g., a rectangle for a grid cell).
2.  `newPiece = originalPiece.intersect(cutter)`.
3.  Repeat for all cells.

#### Merging
When two pieces are merged:
1.  `mergedPiece = pieceA.unite(pieceB)`.

#### Whimsies & Connectors
*   **Whimsies**: `piece = piece.subtract(whimsy)`.
*   **Connectors**: We generate a complex path for the connector and use `unite` and `subtract` to attach it to the respective pieces.

### Limitations of the Current Approach

1.  **Numerical Instability**: Boolean operations on complex Bezier curves are notoriously difficult. Small floating-point errors can lead to "slivers," self-intersections, or paths that fail to close.
2.  **Redundancy**: The boundary between two adjacent pieces is stored twice (once in each piece's path). If you modify one, you must perfectly modify the other to avoid gaps.
3.  **Performance**: Boolean operations are $O(N \log N)$ or worse relative to the number of segments. Subdividing a large puzzle into 500 pieces requires 500 intersection operations.
4.  **Loss of Topology**: The system doesn't "know" which pieces are neighbors without performing expensive intersection tests.

---

## 2. Proposed Architecture: Planar Graph Representation

Instead of pieces being the primary unit of geometry, the **Edge** becomes the primary unit.

### Core Entities

#### Node
A point in 2D space where two or more edges meet.
```typescript
interface Node {
  id: string;
  point: paper.Point;
  incidentEdges: string[]; // IDs of edges connected to this node
}
```

#### Edge
A directed path (line or curve) between two nodes.
```typescript
interface Edge {
  id: string;
  fromNode: string;
  toNode: string;
  path: paper.Path; // The geometry (can be a complex curve with connectors)
  leftFace: string; // ID of the piece to the left
  rightFace: string; // ID of the piece to the right
}
```

#### Face (Piece)
A collection of edges that form a closed loop.
```typescript
interface Face {
  id: string;
  edges: string[]; // Ordered list of edges forming the boundary
  color: string;
  // Metadata...
}
```

### How Merging Works in V5

In a graph-based system, merging two pieces is a **Graph Simplification** operation rather than a geometric one:

1.  **Identify the Shared Edges**: Find all edges where `edge.leftFace === pieceA && edge.rightFace === pieceB` (or vice versa).
2.  **Remove Shared Edges**: Delete these edges from the graph.
3.  **Update Nodes**: If a node now has only 2 incident edges, it can potentially be simplified (merged into a single edge) if the geometry allows.
4.  **Re-wire Faces**: Update the edge lists for the remaining face.

**Geometric Benefit**: There is no `unite()` operation. We simply stop rendering the line between the two pieces. The outer boundary remains exactly as it was, with zero risk of gaps or slivers.

### How Subdivision Works in V5

1.  **Calculate Intersection Points**: Find where the "cut line" intersects existing edges.
2.  **Split Edges**: For every intersection, split the existing edge into two edges and create a new Node.
3.  **Add New Edges**: Create new edges along the cut line between the new nodes.
4.  **Traverse Faces**: Use a "Left-Face" traversal algorithm to identify the new closed loops and create the new Face entities.

---

## 3. Implementation Strategy

*   **Geometry Engine**: Continue using Paper.js for individual edge geometry (Bezier curves, length calculations, offsets).
*   **Topology Manager**: A custom class to manage the Node/Edge/Face relationships.
*   **Baking**: A process to convert the graph faces into SVG `d` attributes for rendering (only needed when geometry changes).

## 4. Why V5?
V5 will allow for **infinite undo/redo** of topological changes with near-zero geometric cost. It also enables features like "live dragging" of a single node that updates all four surrounding pieces simultaneously and perfectly.
