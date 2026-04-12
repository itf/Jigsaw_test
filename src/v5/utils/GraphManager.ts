import paper from 'paper';
import { Node, Edge, Face, FaceEdge, Point, Connector } from '../types';
import { generateConnectorPath } from '../../v3/utils/connectorUtils';
import { getExactSegment } from '../../v3/utils/pathMergeUtils';
import { generateHexGridPoints, generateRandomPoints } from '../../v3/utils/gridUtils';
import { Delaunay } from 'd3-delaunay';

export class GraphManager {
  private nodes: Record<string, Node> = {};
  private edges: Record<string, Edge> = {};
  private faces: Record<string, Face> = {};

  constructor(nodes: Record<string, Node> = {}, edges: Record<string, Edge> = {}, faces: Record<string, Face> = {}) {
    this.nodes = nodes;
    this.edges = edges;
    this.faces = faces;
  }

  public getNodes() { return this.nodes; }
  public getEdges() { return this.edges; }
  public getFaces() { return this.faces; }

  /**
   * Slices a connector or whimsy into the graph.
   * Implements the logic described in DESIGN.md
   */
  public spliceGeometry(path: paper.PathItem, targetEdgeId: string) {
    const edge = this.edges[targetEdgeId];
    if (!edge) return;

    const edgePath = new paper.Path(edge.pathData);
    const intersections = edgePath.getIntersections(path);

    if (intersections.length < 2) {
      // Case 1: Single intersection or none
      // Handle tangential split if necessary
      return;
    }

    // Sort intersections along the edge path
    intersections.sort((a, b) => a.offset - b.offset);

    const firstInt = intersections[0];
    const lastInt = intersections[intersections.length - 1];

    // Case 3: Multiple intersections
    // Split the original edge into two new edges and a connector segment
    // (This is a simplified sketch of the logic)
    
    // 1. Create new nodes at intersection points
    const nodeAId = `node-${Math.random().toString(36).slice(2, 6)}`;
    const nodeBId = `node-${Math.random().toString(36).slice(2, 6)}`;

    this.nodes[nodeAId] = {
      id: nodeAId,
      point: { x: firstInt.point.x, y: firstInt.point.y },
      incidentEdges: []
    };

    this.nodes[nodeBId] = {
      id: nodeBId,
      point: { x: lastInt.point.x, y: lastInt.point.y },
      incidentEdges: []
    };

    // 2. Split edge into 3 parts: [Start -> NodeA], [NodeA -> NodeB (deleted)], [NodeB -> End]
    // ... logic to update edges and faces ...
  }

  /**
   * Sorts incident edges of a node by their starting angle.
   */
  private getSortedIncidentEdges(nodeId: string): string[] {
    const node = this.nodes[nodeId];
    if (!node) return [];

    return [...node.incidentEdges].sort((aId, bId) => {
      const edgeA = this.edges[aId];
      const edgeB = this.edges[bId];
      
      const angleA = this.getEdgeAngleAtNode(edgeA, nodeId);
      const angleB = this.getEdgeAngleAtNode(edgeB, nodeId);
      
      return angleA - angleB;
    });
  }

  /**
   * Calculates the tangent angle of an edge at a specific node.
   */
  private getEdgeAngleAtNode(edge: Edge, nodeId: string): number {
    const path = new paper.Path(edge.pathData);
    let tangent: paper.Point | null = null;
    
    if (edge.fromNode === nodeId) {
      tangent = path.getTangentAt(0);
    } else {
      const t = path.getTangentAt(path.length);
      if (t) tangent = t.multiply(-1);
    }
    
    const angle = tangent ? tangent.angle : 0;
    path.remove();
    return angle;
  }

  /**
   * Traverses the graph to find a closed face starting from an edge and a direction.
   */
  public traverseFace(startEdgeId: string, fromNodeId: string, faceId: string): FaceEdge[] {
    const faceEdges: FaceEdge[] = [];
    let currentEdgeId = startEdgeId;
    let currentNodeId = fromNodeId;
    
    const edge = this.edges[currentEdgeId];
    if (!edge) return [];

    let nextNodeId = edge.fromNode === currentNodeId ? edge.toNode : edge.fromNode;

    const visited = new Set<string>();

    while (!visited.has(`${currentEdgeId}-${currentNodeId}`)) {
      visited.add(`${currentEdgeId}-${currentNodeId}`);
      
      const currentEdge = this.edges[currentEdgeId];
      const isReversed = currentEdge.toNode === currentNodeId;
      
      faceEdges.push({ id: currentEdgeId, reversed: isReversed });

      if (isReversed) {
        currentEdge.rightFace = faceId;
      } else {
        currentEdge.leftFace = faceId;
      }

      // Move to next node
      currentNodeId = nextNodeId;
      
      // Find the next edge at currentNodeId
      const sortedEdges = this.getSortedIncidentEdges(currentNodeId);
      const currentIndex = sortedEdges.indexOf(currentEdgeId);
      
      // To go counter-clockwise, we pick the previous edge in the sorted list
      // Since getSortedIncidentEdges sorts by angle (CW), the "left" turn is the previous one.
      const nextIndex = (currentIndex - 1 + sortedEdges.length) % sortedEdges.length;
      currentEdgeId = sortedEdges[nextIndex];
      
      const nextEdge = this.edges[currentEdgeId];
      if (!nextEdge) break;

      // Determine nextNodeId for the next iteration
      nextNodeId = nextEdge.fromNode === currentNodeId ? nextEdge.toNode : nextEdge.fromNode;

      if (currentEdgeId === startEdgeId && currentNodeId === fromNodeId) {
        break;
      }
      
      // Safety break for infinite loops
      if (faceEdges.length > 1000) break;
    }

    return faceEdges;
  }

  /**
   * Splits a face by adding an edge between two nodes.
   */
  public splitFace(faceId: string, nodeAId: string, nodeBId: string, pathData: string): string[] {
    const face = this.faces[faceId];
    if (!face) return [];

    // 1. Create the new edge
    const newEdgeId = `edge-${Math.random().toString(36).slice(2, 6)}`;
    const newEdge: Edge = {
      id: newEdgeId,
      fromNode: nodeAId,
      toNode: nodeBId,
      pathData,
      leftFace: '', 
      rightFace: '' 
    };
    this.edges[newEdgeId] = newEdge;
    this.nodes[nodeAId].incidentEdges.push(newEdgeId);
    this.nodes[nodeBId].incidentEdges.push(newEdgeId);

    // 2. Re-traverse faces from the new edge
    const newFace1Id = `face-${Math.random().toString(36).slice(2, 6)}`;
    const newFace2Id = `face-${Math.random().toString(36).slice(2, 6)}`;

    const face1Edges = this.traverseFace(newEdgeId, nodeAId, newFace1Id);
    const face2Edges = this.traverseFace(newEdgeId, nodeBId, newFace2Id);

    // 3. Update face records
    this.faces[newFace1Id] = {
      id: newFace1Id,
      edges: face1Edges,
      color: face.color,
      groupMemberships: [...face.groupMemberships]
    };

    this.faces[newFace2Id] = {
      id: newFace2Id,
      edges: face2Edges,
      color: face.color, 
      groupMemberships: [...face.groupMemberships]
    };

    delete this.faces[faceId];
    return [newFace1Id, newFace2Id];
  }

  /**
   * Merges two faces by deleting the edge between them.
   */
  public deleteEdge(edgeId: string): string | null {
    const edge = this.edges[edgeId];
    if (!edge) return null;

    const faceLId = edge.leftFace;
    const faceRId = edge.rightFace;

    // Remove edge from nodes
    this.nodes[edge.fromNode].incidentEdges = this.nodes[edge.fromNode].incidentEdges.filter(id => id !== edgeId);
    this.nodes[edge.toNode].incidentEdges = this.nodes[edge.toNode].incidentEdges.filter(id => id !== edgeId);

    // If it separates two faces, merge them
    if (faceLId && faceRId && faceLId !== faceRId) {
       const faceL = this.faces[faceLId];
       const remainingEdge = faceL.edges.find(e => e.id !== edgeId);
       if (remainingEdge) {
         const newFaceId = `face-${Math.random().toString(36).slice(2, 6)}`;
         const edgeObj = this.edges[remainingEdge.id];
         const startNodeId = remainingEdge.reversed ? edgeObj.toNode : edgeObj.fromNode;
         const newFaceEdges = this.traverseFace(remainingEdge.id, startNodeId, newFaceId);
         
         this.faces[newFaceId] = {
           id: newFaceId,
           edges: newFaceEdges,
           color: faceL.color,
           groupMemberships: [...faceL.groupMemberships]
         };
         
         delete this.faces[faceLId];
         delete this.faces[faceRId];
         delete this.edges[edgeId];
         return newFaceId;
       }
    }

    delete this.edges[edgeId];
    return null;
  }

  /**
   * Bakes connectors into the graph.
   */
  public bakeConnectors(connectors: Connector[], whimsies: any[]) {
    connectors.forEach(c => {
      if (c.disabled) return;
      
      const face = this.faces[c.pieceId];
      if (!face) return;

      // Find the target edge
      const edgeInfo = face.edges[c.pathIndex];
      if (!edgeInfo) return;
      const edgeId = edgeInfo.id;
      const edge = this.edges[edgeId];
      if (!edge) return;

      // Generate connector path
      const edgePath = new paper.Path(edge.pathData);
      let midT = c.midT;
      if (edgeInfo.reversed) {
        edgePath.reverse();
        midT = 1 - c.midT;
      }
      
      const { pathData, p1, p2 } = generateConnectorPath(
        edgePath,
        0, // We are passing the specific edge path, so pathIndex is 0
        midT,
        c.widthPx,
        c.extrusion,
        c.headTemplateId,
        c.headScale,
        c.headRotationDeg,
        c.useEquidistantHeadPoint,
        whimsies,
        c.jitter,
        c.jitterSeed,
        c.neckShape,
        c.neckCurvature,
        c.extrusionCurvature
      );
      
      const connectorPath = new paper.Path(pathData);
      
      // For graph mode, we need the open path from p1 to p2 that goes through the connector
      // generateConnectorPath returns a closed path (neck + head + base segment)
      // We want to extract the segment that replaces the base segment.
      const loc1 = connectorPath.getNearestLocation(p1);
      const loc2 = connectorPath.getNearestLocation(p2);
      
      if (loc1 && loc2) {
        const openPath = getExactSegment(connectorPath, loc1.offset, loc2.offset);
        this.spliceEdge(edgeId, openPath);
        openPath.remove();
      }
      
      connectorPath.remove();
      edgePath.remove();
    });
  }

  /**
   * Splicies a path into an edge.
   */
  public spliceEdge(edgeId: string, splicePath: paper.PathItem): void {
    const edge = this.edges[edgeId];
    if (!edge) return;

    const edgePath = new paper.Path(edge.pathData);
    const intersections = edgePath.getIntersections(splicePath);

    if (intersections.length < 2) {
      edgePath.remove();
      return;
    }

    // Sort intersections along the edge path
    intersections.sort((a, b) => a.offset - b.offset);

    const firstInt = intersections[0];
    const lastInt = intersections[intersections.length - 1];

    // 1. Create new nodes at intersection points
    const nodeAId = `node-${Math.random().toString(36).slice(2, 6)}`;
    const nodeBId = `node-${Math.random().toString(36).slice(2, 6)}`;

    this.nodes[nodeAId] = {
      id: nodeAId,
      point: { x: firstInt.point.x, y: firstInt.point.y },
      incidentEdges: []
    };

    this.nodes[nodeBId] = {
      id: nodeBId,
      point: { x: lastInt.point.x, y: lastInt.point.y },
      incidentEdges: []
    };

    // 2. Split the edge into 3 parts: [Start -> NodeA], [NodeA -> NodeB (deleted)], [NodeB -> End]
    const startPart = edgePath.splitAt(firstInt.offset);
    const secondSplitOffset = lastInt.offset - firstInt.offset;
    const endPart = startPart.splitAt(secondSplitOffset);

    // Create new edges
    const edge1Id = `edge-${Math.random().toString(36).slice(2, 6)}`;
    const edge2Id = `edge-${Math.random().toString(36).slice(2, 6)}`;
    const connectorEdgeId = `edge-${Math.random().toString(36).slice(2, 6)}`;

    // Edge 1: Start -> NodeA
    this.edges[edge1Id] = {
      id: edge1Id,
      fromNode: edge.fromNode,
      toNode: nodeAId,
      pathData: edgePath.pathData,
      leftFace: edge.leftFace,
      rightFace: edge.rightFace
    };

    // Edge 2: NodeB -> End
    this.edges[edge2Id] = {
      id: edge2Id,
      fromNode: nodeBId,
      toNode: edge.toNode,
      pathData: endPart.pathData,
      leftFace: edge.leftFace,
      rightFace: edge.rightFace
    };

    // Connector Edge: NodeA -> NodeB
    // Use the splicePath itself for the connector segment
    // We need to extract the part of splicePath between NodeA and NodeB
    // But generateConnectorPath already gives us the path from p1 to p2
    this.edges[connectorEdgeId] = {
      id: connectorEdgeId,
      fromNode: nodeAId,
      toNode: nodeBId,
      pathData: splicePath.pathData,
      leftFace: edge.leftFace,
      rightFace: edge.rightFace
    };

    // Update nodes
    this.nodes[edge.fromNode].incidentEdges = this.nodes[edge.fromNode].incidentEdges.filter(id => id !== edgeId).concat(edge1Id);
    this.nodes[edge.toNode].incidentEdges = this.nodes[edge.toNode].incidentEdges.filter(id => id !== edgeId).concat(edge2Id);
    this.nodes[nodeAId].incidentEdges = [edge1Id, connectorEdgeId];
    this.nodes[nodeBId].incidentEdges = [edge2Id, connectorEdgeId];

    // Update faces
    Object.values(this.faces).forEach(face => {
      const idx = face.edges.findIndex(e => e.id === edgeId);
      if (idx !== -1) {
        const original = face.edges[idx];
        if (original.reversed) {
          face.edges.splice(idx, 1, 
            { id: edge2Id, reversed: true }, 
            { id: connectorEdgeId, reversed: true }, 
            { id: edge1Id, reversed: true }
          );
        } else {
          face.edges.splice(idx, 1, 
            { id: edge1Id, reversed: false }, 
            { id: connectorEdgeId, reversed: false }, 
            { id: edge2Id, reversed: false }
          );
        }
      }
    });

    // Cleanup
    delete this.edges[edgeId];
    edgePath.remove();
    startPart.remove();
    endPart.remove();
  }

  /**
   * Splits an edge at a specific point, creating a new node.
   */
  public splitEdgeAtPoint(edgeId: string, point: Point): string {
    const edge = this.edges[edgeId];
    if (!edge) return '';

    const edgePath = new paper.Path(edge.pathData);
    const location = edgePath.getNearestLocation(new paper.Point(point.x, point.y));
    
    if (location.offset < 0.1) {
      edgePath.remove();
      return edge.fromNode;
    }
    if (location.offset > edgePath.length - 0.1) {
      edgePath.remove();
      return edge.toNode;
    }

    const newNodeId = `node-${Math.random().toString(36).slice(2, 6)}`;
    this.nodes[newNodeId] = {
      id: newNodeId,
      point: { x: location.point.x, y: location.point.y },
      incidentEdges: []
    };

    const startPart = edgePath.splitAt(location.offset);
    
    const edge1Id = `edge-${Math.random().toString(36).slice(2, 6)}`;
    const edge2Id = `edge-${Math.random().toString(36).slice(2, 6)}`;

    this.edges[edge1Id] = {
      id: edge1Id,
      fromNode: edge.fromNode,
      toNode: newNodeId,
      pathData: edgePath.pathData,
      leftFace: edge.leftFace,
      rightFace: edge.rightFace
    };

    this.edges[edge2Id] = {
      id: edge2Id,
      fromNode: newNodeId,
      toNode: edge.toNode,
      pathData: startPart.pathData,
      leftFace: edge.leftFace,
      rightFace: edge.rightFace
    };

    // Update nodes
    this.nodes[edge.fromNode].incidentEdges = this.nodes[edge.fromNode].incidentEdges.filter(id => id !== edgeId).concat(edge1Id);
    this.nodes[edge.toNode].incidentEdges = this.nodes[edge.toNode].incidentEdges.filter(id => id !== edgeId).concat(edge2Id);
    this.nodes[newNodeId].incidentEdges = [edge1Id, edge2Id];

    // Update faces that used this edge
    Object.values(this.faces).forEach(face => {
      const idx = face.edges.findIndex(e => e.id === edgeId);
      if (idx !== -1) {
        const original = face.edges[idx];
        if (original.reversed) {
          face.edges.splice(idx, 1, 
            { id: edge2Id, reversed: true }, 
            { id: edge1Id, reversed: true }
          );
        } else {
          face.edges.splice(idx, 1, 
            { id: edge1Id, reversed: false }, 
            { id: edge2Id, reversed: false }
          );
        }
      }
    });

    delete this.edges[edgeId];
    edgePath.remove();
    startPart.remove();
    
    return newNodeId;
  }

  /**
   * Splits a face by adding an edge between two points on its boundary.
   */
  public splitFaceAtPoints(faceId: string, ptA: Point, ptB: Point): string[] {
    const face = this.faces[faceId];
    if (!face) return [];

    // Find edges containing ptA and ptB
    let edgeAId = '';
    let edgeBId = '';
    let minDistA = Infinity;
    let minDistB = Infinity;

    face.edges.forEach(eInfo => {
      const edge = this.edges[eInfo.id];
      if (!edge) return;
      const path = new paper.Path(edge.pathData);
      const locA = path.getNearestLocation(new paper.Point(ptA.x, ptA.y));
      const locB = path.getNearestLocation(new paper.Point(ptB.x, ptB.y));
      
      if (locA.distance < minDistA) {
        minDistA = locA.distance;
        edgeAId = eInfo.id;
      }
      if (locB.distance < minDistB) {
        minDistB = locB.distance;
        edgeBId = eInfo.id;
      }
      path.remove();
    });

    if (!edgeAId || !edgeBId || minDistA > 5 || minDistB > 5) return [faceId];

    const nodeAId = this.splitEdgeAtPoint(edgeAId, ptA);
    
    // If ptB was on the same edge, we need to find which of the two new edges it's on now
    let finalEdgeBId = edgeBId;
    if (edgeAId === edgeBId) {
      // Find which new edge contains ptB
      // We know splitEdgeAtPoint created two new edges. 
      // We can search the face's updated edges.
      const updatedFace = this.faces[faceId]; // splitEdgeAtPoint updates this.faces
      updatedFace.edges.forEach(eInfo => {
        const edge = this.edges[eInfo.id];
        const path = new paper.Path(edge.pathData);
        if (path.getNearestLocation(new paper.Point(ptB.x, ptB.y)).distance < 1) {
          finalEdgeBId = eInfo.id;
        }
        path.remove();
      });
    }

    const nodeBId = this.splitEdgeAtPoint(finalEdgeBId, ptB);

    const line = new paper.Path.Line(ptA, ptB);
    const newFaceIds = this.splitFace(faceId, nodeAId, nodeBId, line.pathData);
    line.remove();
    return newFaceIds;
  }

  /**
   * Splits a face by a line defined by two points.
   * Returns the IDs of the new faces created.
   */
  public splitFaceByLine(faceId: string, ptA: Point, ptB: Point): string[] {
    const face = this.faces[faceId];
    if (!face) return [];

    // Build face path
    const facePath = new paper.Path();
    face.edges.forEach(eInfo => {
      const edge = this.edges[eInfo.id];
      if (edge) {
        const temp = new paper.Path(edge.pathData);
        if (eInfo.reversed) temp.reverse();
        facePath.addSegments(temp.segments);
        temp.remove();
      }
    });
    facePath.closed = true;

    const line = new paper.Path.Line(new paper.Point(ptA.x, ptA.y), new paper.Point(ptB.x, ptB.y));
    const intersections = facePath.getIntersections(line);
    line.remove();
    facePath.remove();

    if (intersections.length < 2) return [faceId];

    // For now, just take the first two intersections
    const p1 = intersections[0].point;
    const p2 = intersections[intersections.length - 1].point;

    const newFaceIds = this.splitFaceAtPoints(faceId, p1, p2);
    return newFaceIds;
  }

  /**
   * Subdivides a face into a grid.
   */
  public subdivideGrid(faceId: string, rows: number, cols: number): void {
    const face = this.faces[faceId];
    if (!face) return;

    // Build face path to find bounds
    const facePath = new paper.Path();
    face.edges.forEach(eInfo => {
      const edge = this.edges[eInfo.id];
      if (edge) {
        const temp = new paper.Path(edge.pathData);
        if (eInfo.reversed) temp.reverse();
        facePath.addSegments(temp.segments);
        temp.remove();
      }
    });
    facePath.closed = true;
    const bounds = facePath.bounds;
    facePath.remove();

    let currentFaces = [faceId];

    // Horizontal splits
    for (let r = 1; r < rows; r++) {
      const y = bounds.top + (r / rows) * bounds.height;
      const nextFaces: string[] = [];
      for (const fId of currentFaces) {
        const splitResult = this.splitFaceByLine(fId, { x: bounds.left - 10, y }, { x: bounds.right + 10, y });
        nextFaces.push(...splitResult);
      }
      currentFaces = nextFaces;
    }

    // Vertical splits
    for (let c = 1; c < cols; c++) {
      const x = bounds.left + (c / cols) * bounds.width;
      const nextFaces: string[] = [];
      for (const fId of currentFaces) {
        const splitResult = this.splitFaceByLine(fId, { x, y: bounds.top - 10 }, { x, y: bounds.bottom + 10 });
        nextFaces.push(...splitResult);
      }
      currentFaces = nextFaces;
    }
  }

  /**
   * Subdivides a face using Voronoi cells from provided points.
   */
  public subdivideVoronoi(faceId: string, points: Point[]): void {
    const face = this.faces[faceId];
    if (!face || points.length === 0) return;

    // Build face path to find bounds
    const facePath = new paper.Path();
    face.edges.forEach(eInfo => {
      const edge = this.edges[eInfo.id];
      if (edge) {
        const temp = new paper.Path(edge.pathData);
        if (eInfo.reversed) temp.reverse();
        facePath.addSegments(temp.segments);
        temp.remove();
      }
    });
    facePath.closed = true;
    const bounds = facePath.bounds;
    
    const delaunay = Delaunay.from(points.map(p => [p.x, p.y]));
    const voronoi = delaunay.voronoi([bounds.x - 10, bounds.y - 10, bounds.x + bounds.width + 10, bounds.y + bounds.height + 10]);

    // For each Voronoi edge that intersects the face, split the face
    // This is complex. A simpler way is to use the Voronoi cell boundaries to split.
    // But Voronoi cells can be complex.
    
    // Alternative: Just use splitFaceByLine for each Voronoi edge.
    const processedEdges = new Set<string>();
    
    for (let i = 0; i < points.length; i++) {
      const neighbors = delaunay.neighbors(i);
      for (const neighbor of neighbors) {
        const edgeKey = [i, neighbor].sort().join('-');
        if (processedEdges.has(edgeKey)) continue;
        processedEdges.add(edgeKey);
        
        // The Voronoi edge is the perpendicular bisector of the Delaunay edge
        const p1 = points[i];
        const p2 = points[neighbor];
        
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        // Normal to Delaunay edge
        const nx = -dy;
        const ny = dx;
        
        // Split all current faces by this line
        const currentFaceIds = Object.keys(this.faces);
        for (const fId of currentFaceIds) {
          this.splitFaceByLine(fId, { x: mid.x - nx * 100, y: mid.y - ny * 100 }, { x: mid.x + nx * 100, y: mid.y + ny * 100 });
        }
      }
    }
    
    facePath.remove();
  }

  /**
   * Subdivides a face into a hex grid.
   */
  public subdivideHex(faceId: string, rows: number, cols: number, jitter: number): void {
    const face = this.faces[faceId];
    if (!face) return;

    const facePath = new paper.Path();
    face.edges.forEach(eInfo => {
      const edge = this.edges[eInfo.id];
      if (edge) {
        const temp = new paper.Path(edge.pathData);
        if (eInfo.reversed) temp.reverse();
        facePath.addSegments(temp.segments);
        temp.remove();
      }
    });
    facePath.closed = true;
    const bounds = facePath.bounds;
    facePath.remove();

    const points = generateHexGridPoints(bounds.width, bounds.height, rows, cols, jitter, bounds);
    this.subdivideVoronoi(faceId, points);
  }

  /**
   * Subdivides a face into random pieces.
   */
  public subdivideRandom(faceId: string, count: number, jitter: number): void {
    const face = this.faces[faceId];
    if (!face) return;

    const facePath = new paper.Path();
    face.edges.forEach(eInfo => {
      const edge = this.edges[eInfo.id];
      if (edge) {
        const temp = new paper.Path(edge.pathData);
        if (eInfo.reversed) temp.reverse();
        facePath.addSegments(temp.segments);
        temp.remove();
      }
    });
    facePath.closed = true;
    const bounds = facePath.bounds;
    facePath.remove();

    const points = generateRandomPoints(bounds.width, bounds.height, count, bounds);
    this.subdivideVoronoi(faceId, points);
  }
}
