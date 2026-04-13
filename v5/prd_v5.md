# PRD: Jigsaw Studio V5 — Graph-Based Puzzle Engine

## 1. Motivation

In V3/V4, each puzzle piece is a closed path. The boundary shared between two adjacent pieces is stored twice — once in each piece's path, in opposite winding directions. Boolean operations (intersect, unite, subtract) are used to subdivide pieces, add connectors, and add whimsies. Due to floating-point error in Bezier curve intersection, these duplicated boundaries drift apart over time, causing gaps, slivers, and self-intersections that break the puzzle geometry.

V5 eliminates this by representing the puzzle as a **planar graph**. Each shared boundary exists exactly once, as an edge. Pieces (faces) are derived from the graph topology, not stored as independent paths.

---

## 2. Core Data Model

### Node
A point in 2D space where two or more edges meet.
```typescript
interface Node {
  id: string;
  point: paper.Point;
  incidentEdges: string[]; // IDs of edges connected to this node
}
```

### Edge
A directed open path between two nodes. Its geometry can be any Bezier curve.
```typescript
interface Edge {
  id: string;
  fromNode: string;
  toNode: string;
  path: paper.Path;   // open path, not closed
  leftFace: string;   // face ID to the left when traversing from→to
  rightFace: string;  // face ID to the right
}
```

### Face (Piece)
An ordered list of edges (with direction) that form a closed boundary. A face does **not** store its own geometry — it is derived from its edges.
```typescript
interface Face {
  id: string;
  edgeRefs: Array<{ edgeId: string; reversed: boolean }>;
  // Derived (cached):
  //   path: paper.Path  — built by concatenating edge paths
}
```

A piece is described as "a list of directed edge references, where following them in order traces a closed loop."

---

## 3. Splicing Operations

The operation of inserting a connector or whimsy into the graph is called **splicing**. It modifies edge geometry and/or graph topology without ever performing a boolean union or intersection between closed paths.

### 3.1 Basic Connector Splice (No Node Deletion)

**Example:** A Z-shaped connector crosses a shared edge three times.

1. Intersect the connector path with the target edge. Record all intersection parameters `t` along the edge.
2. Take only the **first** (`t_min`) and **last** (`t_max`) intersection. The middle crossing is ignored — the connector's path "owns" that region and the middle crossing is an internal detail of the connector shape.
3. Split the target edge at `t_min` and `t_max`, creating two new nodes: `N_enter` and `N_exit`.
4. Delete the segment of the original edge between `N_enter` and `N_exit`.
5. Insert the connector's path as a new edge from `N_enter` to `N_exit`.
6. Update `leftFace`/`rightFace` on all new and modified edges.
7. Re-derive affected faces by traversal.

### 3.2 Node Deletion (Connector Footprint Contains an Existing Node)

If the connector's interior contains an existing node `A` (a junction of edges 1, 2, 3, ...):

1. Mark node `A` for deletion.
2. For each edge incident to `A`, intersect the connector boundary with that edge.
   - Edge 1 intersects the connector at point `P1` → create node `N1`.
   - Edge 2 intersects the connector at point `P2` → create node `N2`.
   - Edge 3 intersects the connector at point `P3` → create node `N3`.
3. Truncate each edge: the portion from the new intersection node into the deleted node is removed.
4. The connector boundary is split at `N1`, `N2`, `N3` into arc segments, each becoming a new edge with appropriate `leftFace`/`rightFace`.
5. Delete node `A`. All former incident edges now terminate at their respective intersection nodes.
6. Re-run face traversal to rebuild affected faces.

This also handles the case where a connector spans two previously separate nodes — both get deleted by the above procedure, each edge incident to either node is trimmed to its intersection with the connector.

### 3.3 Adjacent Edge Interactions

Whimsies and connectors often overlap edges they were not explicitly targeting. Each overlapping edge is resolved by one of three cases:

#### Case 1 — Single / Tangential Intersection
The connector intersects the edge exactly once (tangential touch, or intersection exactly at a node).
- **Action:** Split the edge at the intersection point, inserting a new node. No geometry is removed.
- **When:** Rare. Occurs only when the connector or whimsy is tangent to the edge.

#### Case 2 — Connector Contains an End Node
The connector's footprint swallows one terminal node of the edge.
- **Action:** Apply the node-deletion procedure (§3.2) for the swallowed node. The edge segment between the swallowed node and the first intersection from that direction is deleted. The surviving portion of the edge now ends at the new intersection node. If additional intersections remain further along the edge (away from the swallowed node), treat them with Case 3.

#### Case 3 — Multiple Crossings, End Nodes Outside
The connector crosses the edge more than once, but both terminal nodes of the edge remain outside the connector.
- **Action:**
  1. Find the first intersection `P_first` and last intersection `P_last` along the edge's parameter space.
  2. Delete the original edge.
  3. Create edge A: `startNode → P_first` (sub-path from original edge start to `P_first`).
  4. Create edge B: `P_last → endNode` (sub-path from `P_last` to original edge end).
  5. The segment between `P_first` and `P_last` is now "owned" by the connector/whimsy boundary.

---

## 4. Connector Placement Model

In V3, connectors are assigned to a face. In V5, connectors are positioned relative to edges:

```typescript
interface ConnectorPlacement {
  edgeId: string;
  // Position along the edge: 0.0 = fromNode, 1.0 = toNode
  t: number;
  // Direction relative to the edge's left face:
  //   'out' = connector protrudes into the rightFace (tab)
  //   'in'  = connector protrudes into the leftFace (blank)
  direction: 'in' | 'out';
}
```

Alternatively, connectors can be placed by absolute world position and snapped to the nearest edge at startup. The `direction` field is critical for non-convex arrangements (e.g., a connector pointing inward into a circular whimsy piece that sits inside a square face).

---

## 5. Whimsy Handling

A whimsy is a closed shape placed inside a face. After splicing:
- The whimsy boundary edges become part of the graph.
- The face that previously occupied that region is split: the outer ring becomes one face, and the whimsy interior is a new, nested face.
- The nested face is rendered **above** the outer face in z-order.
- Hit-testing and pointer events respect z-order (inner face takes priority).

---

## 6. Face Traversal Algorithm

Faces are derived from the graph by the following algorithm:

1. For each node, sort its incident edges by angle (counter-clockwise).
2. To traverse: arriving at node `B` along edge `E` (from→to), the **next** edge at `B` is the one immediately clockwise from `E`'s arrival direction. This is the "next left turn" rule that recovers planar faces.
3. Follow edges until the starting edge is revisited — this closes a face.
4. Run for all half-edges to recover all faces, including the outer (unbounded) face.

---

## 7. V5 Migration Plan

### Phase 0: Setup
- [ ] Copy `v3/` into `v5/` (`cp -r v3/ v5/`)
- [ ] Remove V3-specific files not applicable to V5 (boolean-op utilities, Area classes)
- [ ] Add V5 entry point to the front page / router

### Phase 1: Core Graph Engine (with Tests)
Tests are written first, implementation follows.

**Test 1 — Square face display:**
- Construct a graph with 4 nodes (corners of a square) and 4 edges.
- Run face traversal; confirm exactly one inner face is found.
- Render it on the debug canvas; confirm it displays as a filled square.

**Test 2 — Split in the middle:**
- Take the square graph from Test 1.
- Add a horizontal edge splitting it into two rectangles (2 new nodes on left/right edges, 1 new interior edge).
- Run face traversal; confirm exactly two inner faces.
- Render; confirm two distinct filled rectangles.

**Test 3 — Whimsy inside a piece:**
- Start with a square face.
- Add a circular whimsy entirely inside the square.
- Splice the circle into the graph: the circle boundary becomes edges, and the original square edges that overlap are trimmed per §3.3.
- Run face traversal; confirm: (a) the outer face (square minus circle) and (b) the inner face (circle).
- Render: inner face renders above outer face; confirm correct z-order and hit-testing.

**Test 4 — Connector splice (no node deletion):**
- Start with two adjacent rectangles sharing one vertical edge.
- Add a Z-shaped connector that crosses the shared edge.
- Run splice; confirm the shared edge is split into three sub-edges (above connector, connector itself, below connector).
- Run face traversal; confirm both faces update correctly.
- Render; confirm connector geometry is visible on the shared boundary.

**Test 5 — Whimsy intersecting an edge:**
- Start with a square.
- Add a circle whose center is outside the square but whose arc crosses the right edge.
- Splice; confirm the right edge is trimmed per Case 3 (§3.3), and new arc edges are inserted.
- Run face traversal; confirm face geometry is correct.

### Phase 2: Geometric Operations
- [ ] Implement full connector splicing (§3.1, §3.2, §3.3)
- [ ] Implement whimsy splicing (closed-loop case, nested face detection)
- [ ] Implement grid / Voronoi subdivision via edge insertion

### Phase 3: UI & Integration
- [ ] V5 debug page rendering graph edges and faces
- [ ] Selection model for nodes, edges, faces
- [ ] Adapt V3 tools (Subdivide, Merge, Connect) to call graph operations
- [ ] Production flattening: convert graph to SVG `d` paths per face

### Phase 4: Validation & Cleanup
- [ ] Topological consistency checks (Euler characteristic: V − E + F = 2)
- [ ] Performance comparison with V3 for 100-piece puzzles
- [ ] Remove V3 legacy code

---

## 8. Key Invariants

1. **No duplicate boundaries.** Every shared boundary between two faces exists as exactly one edge.
2. **No boolean operations on closed paths.** All geometry modification is done by splitting and splicing open paths.
3. **Edge geometry is independent of topology.** You can reshape an edge's Bezier path freely, as long as it does not intersect other edges. The face structure does not change.
4. **Faces are derived, not stored.** A face's closed path is always recomputed from its edge list. Caching is allowed but must be invalidated on any edge modification.
5. **Splicing always produces a valid planar graph.** After any splice, every edge has valid `leftFace` and `rightFace`, and face traversal recovers all faces. The only exception is the outer edges of the root faces, which one side will be pointing to no face. We create a special face to represent the space outside the outer edge. 
