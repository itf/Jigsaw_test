import paper from 'paper';
import { Point } from './types';

/**
 * A Topological Graph represents the puzzle as a collection of shared edges and faces.
 * This avoids the precision issues of boolean polygon operations.
 */

export interface TopoVertex {
  id: string;
  point: paper.Point;
}

export interface TopoEdge {
  id: string;
  v1Id: string;
  v2Id: string;
  pathData: string; // The geometric path (can be a line, arc, or complex whimsy)
  faceAId: string;
  faceBId: string | null; // null if it's a boundary edge
  isMerged: boolean; // If true, this edge is "internal" to a merged group
  connectors?: { u: number; stampPathData: string; isFlipped: boolean; ownerFaceId: string }[];
}

export interface TopoFace {
  id: string;
  edgeIds: string[]; // Ordered or unordered? Ordered is better for traversal.
  seedPoint: Point;
  color: string;
}

/**
 * TopologicalEngine manages the puzzle geometry using a face-edge-vertex graph.
 * This approach is more robust than boolean operations for complex tiling
 * and ensures that shared edges are perfectly aligned.
 */
export class TopologicalEngine {
  vertices: Map<string, TopoVertex> = new Map();
  edges: Map<string, TopoEdge> = new Map();
  faces: Map<string, TopoFace> = new Map();

  constructor() {}

  /**
   * Initializes the graph from a set of Voronoi cells.
   * This version handles T-junctions by splitting edges where vertices lie on them.
   */
  initializeFromVoronoi(leafAreas: any[], width: number, height: number) {
    this.vertices.clear();
    this.edges.clear();
    this.faces.clear();

    paper.setup(new paper.Size(width, height));

    // 1. Extract all segments from all paths
    const rawSegments: { p1: paper.Point; p2: paper.Point; faceId: string }[] = [];
    const allPoints: paper.Point[] = [];

    leafAreas.forEach(area => {
      const path = new paper.Path(area.boundary);
      const children = path instanceof paper.CompoundPath ? path.children : [path];
      
      children.forEach(child => {
        if (child instanceof paper.Path) {
          if (child.clockwise) child.reverse();

          child.segments.forEach((seg, i) => {
            const nextSeg = child.segments[(i + 1) % child.segments.length];
            const p1 = new paper.Point(
              Math.round(seg.point.x * 1000) / 1000,
              Math.round(seg.point.y * 1000) / 1000
            );
            const p2 = new paper.Point(
              Math.round(nextSeg.point.x * 1000) / 1000,
              Math.round(nextSeg.point.y * 1000) / 1000
            );

            if (p1.equals(p2)) return;

            rawSegments.push({ p1, p2, faceId: area.id });
            allPoints.push(p1);
          });
        }
      });
      
      this.faces.set(area.id, {
        id: area.id,
        edgeIds: [],
        seedPoint: area.seedPoint,
        color: area.color
      });
      path.remove();
    });

    // 2. Deduplicate vertices
    const getVertexId = (p: paper.Point) => `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000}`;
    const uniquePointsMap = new Map<string, paper.Point>();
    allPoints.forEach(p => {
      const id = getVertexId(p);
      if (!uniquePointsMap.has(id)) {
        uniquePointsMap.set(id, p);
        this.vertices.set(id, { id, point: p });
      }
    });
    const uniquePoints = Array.from(uniquePointsMap.values());

    // 3. Split segments at T-junctions
    const finalEdges: { v1Id: string; v2Id: string; faceId: string }[] = [];
    const TOLERANCE = 0.01;

    rawSegments.forEach(seg => {
      const ptsOnSeg: { p: paper.Point; t: number }[] = [
        { p: seg.p1, t: 0 },
        { p: seg.p2, t: 1 }
      ];

      const vec = seg.p2.subtract(seg.p1);
      const lenSq = vec.x * vec.x + vec.y * vec.y;

      uniquePoints.forEach(v => {
        if (v.equals(seg.p1) || v.equals(seg.p2)) return;

        // Check if v lies on segment p1p2
        // Projection t = (v - p1) . (p2 - p1) / |p2 - p1|^2
        const t = v.subtract(seg.p1).dot(vec) / lenSq;
        if (t > 0.0001 && t < 0.9999) {
          const projection = seg.p1.add(vec.multiply(t));
          if (projection.getDistance(v) < TOLERANCE) {
            ptsOnSeg.push({ p: v, t });
          }
        }
      });

      // Sort points along the segment
      ptsOnSeg.sort((a, b) => a.t - b.t);

      // Create edges from consecutive points
      for (let i = 0; i < ptsOnSeg.length - 1; i++) {
        finalEdges.push({
          v1Id: getVertexId(ptsOnSeg[i].p),
          v2Id: getVertexId(ptsOnSeg[i+1].p),
          faceId: seg.faceId
        });
      }
    });

    // 4. Deduplicate edges and assign to faces
    const edgeMap: Map<string, TopoEdge> = new Map();

    finalEdges.forEach(fe => {
      const sortedIds = [fe.v1Id, fe.v2Id].sort();
      const edgeKey = sortedIds.join('|');

      if (edgeMap.has(edgeKey)) {
        const existing = edgeMap.get(edgeKey)!;
        if (fe.v1Id === existing.v1Id) {
          existing.faceAId = fe.faceId;
        } else {
          existing.faceBId = fe.faceId;
        }
      } else {
        const edge: TopoEdge = {
          id: edgeKey,
          v1Id: fe.v1Id,
          v2Id: fe.v2Id,
          pathData: `M ${this.vertices.get(fe.v1Id)!.point.x} ${this.vertices.get(fe.v1Id)!.point.y} L ${this.vertices.get(fe.v2Id)!.point.x} ${this.vertices.get(fe.v2Id)!.point.y}`,
          faceAId: fe.faceId,
          faceBId: null,
          isMerged: false
        };
        edgeMap.set(edgeKey, edge);
      }
      
      const face = this.faces.get(fe.faceId);
      if (face) face.edgeIds.push(edgeKey);
    });

    this.edges = edgeMap;
  }

  /**
   * Finds all edges shared by two faces.
   */
  findEdgesBetweenFaces(faceAId: string, faceBId: string): string[] {
    const faceA = this.faces.get(faceAId);
    if (!faceA) return [];
    
    return faceA.edgeIds.filter(eid => {
      const edge = this.edges.get(eid)!;
      return (edge.faceAId === faceAId && edge.faceBId === faceBId) ||
             (edge.faceAId === faceBId && edge.faceBId === faceAId);
    });
  }

  /**
   * Adds a connector to a shared boundary between two faces.
   * 'u' is relative to the total length of all shared edges.
   */
  /**
   * Adds a connector (tab/blank) to a shared edge between two faces.
   * @param u Normalized position [0, 1] along the edge.
   * @param stampPathData SVG path data for the connector shape.
   * @param isFlipped Toggles the side of the connector.
   * @param ownerFaceId The face that "owns" the tab (it sticks out of this face).
   */
  addConnectorToBoundary(faceAId: string, faceBId: string, u: number, stampPathData: string, isFlipped: boolean, ownerFaceId: string) {
    const edgeIds = this.findEdgesBetweenFaces(faceAId, faceBId);
    if (edgeIds.length === 0) return;

    // Calculate total length
    let totalLength = 0;
    const edgeLengths = edgeIds.map(eid => {
      const edge = this.edges.get(eid)!;
      const v1 = this.vertices.get(edge.v1Id)!.point;
      const v2 = this.vertices.get(edge.v2Id)!.point;
      const len = v1.getDistance(v2);
      totalLength += len;
      return len;
    });

    if (totalLength === 0) return;

    const targetOffset = u * totalLength;
    let currentOffset = 0;
    
    for (let i = 0; i < edgeIds.length; i++) {
      const len = edgeLengths[i];
      if (targetOffset >= currentOffset && targetOffset <= currentOffset + len + 0.001) {
        const localU = (targetOffset - currentOffset) / len;
        const edge = this.edges.get(edgeIds[i])!;
        if (!edge.connectors) edge.connectors = [];
        edge.connectors.push({ u: localU, stampPathData, isFlipped, ownerFaceId });
        return;
      }
      currentOffset += len;
    }
  }

  /**
   * Merges two faces by marking their shared edges as "merged".
   */
  /**
   * Merges two adjacent faces into one.
   * The shared edge between them is marked as merged and will be ignored
   * during boundary generation.
   */
  mergeFaces(faceAId: string, faceBId: string) {
    this.edges.forEach(edge => {
      if ((edge.faceAId === faceAId && edge.faceBId === faceBId) ||
          (edge.faceAId === faceBId && edge.faceBId === faceAId)) {
        edge.isMerged = true;
      }
    });
  }

  /**
   * Returns the boundary path for a group of merged faces.
   * This is the "Traversal" step.
   */
  /**
   * Generates the final SVG boundary path for a set of merged faces.
   * It traverses the outer boundary of the group, splicing in any connectors.
   */
  getMergedBoundary(faceIds: string[]): string {
    const faceIdSet = new Set(faceIds);
    const groupEdges = new Set<string>();
    faceIdSet.forEach(fid => {
      const face = this.faces.get(fid);
      if (face) face.edgeIds.forEach(eid => groupEdges.add(eid));
    });

    // An edge is on the boundary if exactly one of its faces is in the group
    const boundaryEdges = Array.from(groupEdges).filter(eid => {
      const edge = this.edges.get(eid)!;
      const faceAIn = faceIdSet.has(edge.faceAId);
      const faceBIn = edge.faceBId ? faceIdSet.has(edge.faceBId) : false;
      return faceAIn !== faceBIn;
    });

    if (boundaryEdges.length === 0) return '';

    // Build adjacency map for vertices on the boundary
    const adj = new Map<string, string[]>();
    boundaryEdges.forEach(eid => {
      const edge = this.edges.get(eid)!;
      if (!adj.has(edge.v1Id)) adj.set(edge.v1Id, []);
      if (!adj.has(edge.v2Id)) adj.set(edge.v2Id, []);
      adj.get(edge.v1Id)!.push(eid);
      adj.get(edge.v2Id)!.push(eid);
    });

    const loops: paper.Path[] = [];
    const remainingEdges = new Set(boundaryEdges);

    while (remainingEdges.size > 0) {
      const startEdgeId = remainingEdges.values().next().value;
      const startEdge = this.edges.get(startEdgeId)!;
      remainingEdges.delete(startEdgeId);

      const faceAIn = faceIdSet.has(startEdge.faceAId);
      
      const currentLoop = new paper.Path();
      const startPath = this.getEdgePath(startEdgeId, !faceAIn);
      currentLoop.addSegments(startPath.segments.map(s => s.clone()));
      
      let currentVId = faceAIn ? startEdge.v2Id : startEdge.v1Id;
      let startVId = faceAIn ? startEdge.v1Id : startEdge.v2Id;
      startPath.remove();

      let foundNext = true;
      while (foundNext && currentVId !== startVId) {
        foundNext = false;
        const possibleEdges = adj.get(currentVId) || [];
        for (const eid of possibleEdges) {
          if (remainingEdges.has(eid)) {
            const edge = this.edges.get(eid)!;
            const faceAIn = faceIdSet.has(edge.faceAId);
            
            let nextPath: paper.Path | null = null;
            if (edge.v1Id === currentVId && faceAIn) {
              nextPath = this.getEdgePath(eid, false);
              currentVId = edge.v2Id;
            } else if (edge.v2Id === currentVId && !faceAIn) {
              nextPath = this.getEdgePath(eid, true);
              currentVId = edge.v1Id;
            }

            if (nextPath) {
              // Add all segments except the first one (which is redundant with the last one of currentLoop)
              // But we need to make sure the last segment of currentLoop gets the handleIn from the first segment of nextPath?
              // Actually, in paper.js, if we use addSegments, it just adds them.
              // If the points are identical, we should probably merge them or just skip the first point.
              // To preserve handles correctly, we should update the last segment of currentLoop with the handleOut of the first segment of nextPath.
              const firstSeg = nextPath.segments[0];
              const lastSeg = currentLoop.lastSegment;
              lastSeg.handleOut = firstSeg.handleOut.clone();
              
              currentLoop.addSegments(nextPath.segments.slice(1).map(s => s.clone()));
              nextPath.remove();
              remainingEdges.delete(eid);
              foundNext = true;
              break;
            }
          }
        }
      }
      
      // Close the loop correctly: the last segment's handleOut should go to the first segment's handleIn
      if (currentLoop.segments.length > 2) {
        const firstSeg = currentLoop.firstSegment;
        const lastSeg = currentLoop.lastSegment;
        if (firstSeg.point.getDistance(lastSeg.point) < 0.001) {
          firstSeg.handleIn = lastSeg.handleIn.clone();
          lastSeg.remove();
        }
        currentLoop.closePath();
        loops.push(currentLoop);
      } else {
        currentLoop.remove();
      }
    }

    if (loops.length === 0) return '';
    
    // Combine all loops into a single path data string
    let finalPathData = "";
    loops.forEach(l => {
      finalPathData += (finalPathData ? " " : "") + l.pathData;
      l.remove();
    });
    
    return finalPathData;
  }

  /**
   * Gets the path for an edge, optionally reversed, and with connectors applied.
   */
  private getEdgePath(edgeId: string, reversed: boolean): paper.Path {
    const edge = this.edges.get(edgeId)!;
    const v1 = this.vertices.get(edge.v1Id)!.point;
    const v2 = this.vertices.get(edge.v2Id)!.point;
    
    if (!edge.connectors || edge.connectors.length === 0) {
      const path = new paper.Path();
      path.add(v1);
      path.add(v2);
      if (reversed) path.reverse();
      return path;
    }

    // Sort connectors by position along the edge
    const sorted = [...edge.connectors].sort((a, b) => a.u - b.u);
    
    // We'll build a new path by splicing connectors into the original edge
    const newPath = new paper.Path();
    newPath.add(v1);
    
    const vec = v2.subtract(v1);
    const tangent = vec.normalize();
    const angle = tangent.angle;

    sorted.forEach(c => {
      const pos = v1.add(vec.multiply(c.u));
      const stamp = new paper.Path(c.stampPathData);
      
      // Convention: raw stamp points RIGHT (0 degrees)
      // side = 1 means point into A (-90 relative to tangent)
      // side = -1 means point into B (+90 relative to tangent)
      // If owner is Face A, it should point into Face B, so side = -1.
      // If owner is Face B, it should point into Face A, so side = 1.
      let side = (c.ownerFaceId === edge.faceAId) ? -1 : 1;
      
      const rotation = angle - 90 * side;
      stamp.rotate(rotation, new paper.Point(0, 0));
      stamp.translate(pos);
      
      // Ensure the stamp is open and remove the base segment for splicing
      stamp.closed = false;
      
      // Determine which end of the stamp is closer to our current position
      const d1 = stamp.firstSegment.point.getDistance(newPath.lastSegment.point);
      const d2 = stamp.lastSegment.point.getDistance(newPath.lastSegment.point);
      
      if (d2 < d1) {
        stamp.reverse();
      }
      
      // Now stamp is oriented correctly: firstSegment is entry, lastSegment is exit
      // We want to add all segments of the stamp to our edge path
      // IMPORTANT: We use addSegments to preserve all handles and curve information.
      // We clone the segments to avoid modifying the original stamp.
      const segmentsToAdd = stamp.segments.map(s => s.clone());
      newPath.addSegments(segmentsToAdd);
      
      stamp.remove();
    });
    
    // Add the final segment to the end of the edge
    newPath.add(v2);
    
    if (reversed) newPath.reverse();
    return newPath;
  }
}
