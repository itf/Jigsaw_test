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

---

## 3. Connector & Whimsy Splicing Logic

In V5, adding a connector or whimsy is an **Edge Splicing** operation. This is similar to the V3 approach of finding two points and removing the path between them, but applied to the graph topology.

### 3.1 Basic Splicing (The "Z" Connector Example)
When adding a connector (e.g., a zigzag "Z" shape) to an edge:
1.  **Find Intersections**: Intersect the connector path with the target edge.
2.  **Identify Entry/Exit**: We look for the "first" and "last" intersection points along the edge's parameter space.
3.  **Ignore Middle Intersections**: If a connector is shaped like a "Z" and crosses the edge 3 times, we only care about the first and last points. The "middle" crossing is ignored because the connector's geometry effectively "overwrites" that section of the boundary.
4.  **Splicing**: The segment of the edge between the first and last intersection is removed, and the connector's path is spliced in.

### 3.2 Node Deletion & Multi-Edge Intersection
If a connector is placed such that it "covers" an existing node (a point where 3+ edges meet):
1.  **Node Deletion**: The node inside the connector's footprint is marked for deletion.
2.  **Edge Intersection**: We must intersect the connector with **all** edges that were incident to that node.
3.  **New Nodes**: If edges 1, 2, and 3 all met at the deleted node, we find where the connector intersects each of them. This creates 3 new nodes on the connector's boundary.
4.  **Re-routing**: Edge 1 now ends at its intersection with the connector. Edge 2 ends at its intersection, and so on. The connector boundary itself is split into segments between these new nodes.

### 3.3 Whimsies & Connectors Touching Other Edges
Whimsies and connectors often overlap multiple edges. We handle these interactions based on three cases:

#### Case 1: Single Intersection (Tangential)
The whimsy/connector intersects the edge only once (or only at a node) without containing any part of the edge.
*   **Action**: This is a simple split. Create a new node at the intersection point and split the edge into two. (Rare, usually only for tangential touches).

#### Case 2: Node Containment
The whimsy/connector "swallows" one of the end nodes of an edge.
*   **Action**: Similar to Node Deletion. The part of the edge between the swallowed node and the first intersection point is deleted. The remaining part of the edge is updated to end at the new intersection node.

#### Case 3: Multiple Intersections (No Node Containment)
The whimsy/connector crosses an edge multiple times but both end nodes of the edge remain outside.
*   **Action**: 
    1. Find the first and last intersection points along the edge.
    2. Delete the original edge.
    3. Create two new edges: one from the original `startNode` to the `firstIntersection`, and another from the `lastIntersection` to the original `endNode`.
    4. The space between the intersections is now part of the whimsy/connector boundary.

---

## 4. Implementation Strategy

*   **Geometry Engine**: Continue using Paper.js for individual edge geometry (Bezier curves, length calculations, offsets).
*   **Topology Manager**: A custom class to manage the Node/Edge/Face relationships.
*   **Baking**: A process to convert the graph faces into SVG `d` attributes for rendering (only needed when geometry changes).

## 4. V5 Migration Plan

This plan outlines the steps to transition from the V3 Boolean Engine to the V5 Graph Engine.

### Phase 1: Core Topology Logic (Current)
- [x] Define V5 Types (Node, Edge, Face)
- [x] Implement `GraphManager` skeleton
- [ ] Implement Edge Splitting logic (splitting an edge at a point/intersection)
- [ ] Implement **Face Traversal Algorithm**:
    - For each node, sort incident edges by angle.
    - Traverse from node A to B along edge E.
    - At node B, pick the "next" edge in clockwise/counter-clockwise order.
    - Close the loop to form a `Face`.
- [ ] Implement `TopologyManager` to coordinate nodes, edges, and faces.

### Phase 2: Geometric Operations
- [ ] Implement **Connector Splicing**:
    - Intersect connector path with existing edges.
    - Split edges at intersection points.
    - Insert new edges for the connector boundary.
    - Re-run face traversal to update affected pieces.
- [ ] Implement **Whimsy Splicing**:
    - Similar to connectors, but handles closed loops and potential "hole" faces.
- [ ] Implement **Subdivision (Grid/Hex/Random)**:
    - Generate seed points.
    - Construct Voronoi/Grid edges as graph edges.
    - Clip edges against the parent face boundary.

### Phase 3: UI & Integration
- [ ] Update `V5Canvas` to render graph edges and faces.
- [ ] Implement selection logic for graph entities.
- [ ] Adapt V3 tools (Subdivide, Merge, Connect) to call `TopologyManager` methods.
- [ ] Implement "Production Flattening" for the graph model.

### Phase 4: Validation & Cleanup
- [ ] Verify topological consistency (Euler characteristic, no dangling edges).
- [ ] Compare performance with V3 for large puzzles.
- [ ] Remove V3 legacy code once V5 is stable.

---

## 5. Why V5?
V5 will allow for **infinite undo/redo** of topological changes with near-zero geometric cost. It also enables features like "live dragging" of a single node that updates all four surrounding pieces simultaneously and perfectly.
