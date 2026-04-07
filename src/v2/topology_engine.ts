import paper from 'paper';
import { Point } from './types';
import { pathItemFromBoundaryData, resetPaperProject } from './paperProject';

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

    resetPaperProject(width, height);

    // 1. Extract all segments from all paths
    const rawSegments: { p1: paper.Point; p2: paper.Point; faceId: string; pathData: string; curve: paper.Curve }[] = [];
    const allPoints: paper.Point[] = [];

    leafAreas.forEach(area => {
      const path = pathItemFromBoundaryData(area.boundary);
      const children = path instanceof paper.CompoundPath ? path.children : [path];
      
      children.forEach(child => {
        if (child instanceof paper.Path) {
          if (child.clockwise) child.reverse();

          child.curves.forEach((curve) => {
            const p1 = new paper.Point(
              Math.round(curve.point1.x * 1000) / 1000,
              Math.round(curve.point1.y * 1000) / 1000
            );
            const p2 = new paper.Point(
              Math.round(curve.point2.x * 1000) / 1000,
              Math.round(curve.point2.y * 1000) / 1000
            );

            if (p1.equals(p2)) return;

            // Store the actual curve geometry
            const curvePath = new paper.Path();
            curvePath.add(curve.segment1.clone());
            curvePath.add(curve.segment2.clone());
            const pathData = curvePath.pathData;
            curvePath.remove();

            rawSegments.push({ p1, p2, faceId: area.id, pathData, curve: curve.clone() });
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
    const finalEdges: { v1Id: string; v2Id: string; faceId: string; pathData: string }[] = [];
    const TOLERANCE = 0.05;

    rawSegments.forEach(seg => {
      const ptsOnSeg: { p: paper.Point; t: number }[] = [
        { p: seg.p1, t: 0 },
        { p: seg.p2, t: 1 }
      ];

      uniquePoints.forEach(v => {
        if (v.equals(seg.p1) || v.equals(seg.p2)) return;

        // Use Paper.js to find the closest point on the curve
        const nearest = seg.curve.getNearestPoint(v);
        if (nearest.getDistance(v) < TOLERANCE) {
          const t = seg.curve.getOffsetOf(nearest) / seg.curve.length;
          if (t > 0.001 && t < 0.999) {
            ptsOnSeg.push({ p: v, t });
          }
        }
      });

      // Sort points along the segment
      ptsOnSeg.sort((a, b) => a.t - b.t);

      // Create edges from consecutive points by dividing the curve
      for (let i = 0; i < ptsOnSeg.length - 1; i++) {
        const tStart = ptsOnSeg[i].t;
        const tEnd = ptsOnSeg[i+1].t;
        
        // Extract the sub-curve
        const subPath = new paper.Path();
        subPath.add(seg.curve.segment1.clone());
        subPath.add(seg.curve.segment2.clone());
        
        let targetCurve = subPath.curves[0];
        if (tEnd < 0.999) {
          targetCurve.divideAtTime(tEnd);
          targetCurve = subPath.curves[0];
        }
        if (tStart > 0.001) {
          const secondPart = targetCurve.divideAtTime(tStart / (tEnd || 1));
          if (secondPart) {
            targetCurve = secondPart;
          }
        }
        
        const finalSubPath = new paper.Path();
        finalSubPath.add(targetCurve.segment1.clone());
        finalSubPath.add(targetCurve.segment2.clone());
        const subPathData = finalSubPath.pathData;
        finalSubPath.remove();
        subPath.remove();

        finalEdges.push({
          v1Id: getVertexId(ptsOnSeg[i].p),
          v2Id: getVertexId(ptsOnSeg[i+1].p),
          faceId: seg.faceId,
          pathData: subPathData
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
          pathData: fe.pathData,
          faceAId: fe.faceId,
          faceBId: null,

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
   * Orders shared edges into a contiguous chain from one end vertex to the other
   * so arc-length parameterization matches geometric order along the interface.
   */
  private sortSharedEdgesAsChain(edgeIds: string[]): string[] {
    if (edgeIds.length <= 1) return [...edgeIds];

    const touchCount = new Map<string, number>();
    edgeIds.forEach(eid => {
      const e = this.edges.get(eid)!;
      touchCount.set(e.v1Id, (touchCount.get(e.v1Id) || 0) + 1);
      touchCount.set(e.v2Id, (touchCount.get(e.v2Id) || 0) + 1);
    });

    let startV: string | null = null;
    for (const [v, c] of touchCount) {
      if (c === 1) {
        startV = v;
        break;
      }
    }
    const e0 = this.edges.get(edgeIds[0])!;
    if (!startV) startV = e0.v1Id;

    const remaining = new Set(edgeIds);
    const sorted: string[] = [];
    let currentV = startV;

    while (remaining.size > 0) {
      let nextEid: string | null = null;
      for (const eid of remaining) {
        const e = this.edges.get(eid)!;
        if (e.v1Id === currentV || e.v2Id === currentV) {
          nextEid = eid;
          break;
        }
      }
      if (!nextEid) break;
      remaining.delete(nextEid);
      sorted.push(nextEid);
      const e = this.edges.get(nextEid)!;
      currentV = e.v1Id === currentV ? e.v2Id : e.v1Id;
    }

    return sorted.length === edgeIds.length ? sorted : [...edgeIds];
  }

  /** Geometry of the two degree-1 vertices of an open chain of edges (shared interface between two faces). */
  private getOpenChainEndpoints(sortedEdgeIds: string[]): { start: paper.Point; end: paper.Point } | null {
    if (sortedEdgeIds.length === 0) return null;
    const touchCount = new Map<string, number>();
    sortedEdgeIds.forEach(eid => {
      const e = this.edges.get(eid)!;
      touchCount.set(e.v1Id, (touchCount.get(e.v1Id) || 0) + 1);
      touchCount.set(e.v2Id, (touchCount.get(e.v2Id) || 0) + 1);
    });
    let startV: string | null = null;
    for (const [v, c] of touchCount) {
      if (c === 1) {
        startV = v;
        break;
      }
    }
    const e0 = this.edges.get(sortedEdgeIds[0])!;
    if (!startV) startV = e0.v1Id;

    let currentV = startV;
    for (const eid of sortedEdgeIds) {
      const e = this.edges.get(eid)!;
      currentV = e.v1Id === currentV ? e.v2Id : e.v1Id;
    }
    const endV = currentV;
    return {
      start: this.vertices.get(startV)!.point,
      end: this.vertices.get(endV)!.point,
    };
  }

  /**
   * Places a connector on the shared polyline at the point closest to `anchor`.
   * Use this when `anchor` comes from `getSharedPerimeter` + `getPointAtU` so the
   * topological cut matches the boolean engine and Connection-tab preview.
   *
   * `chordU` is the same [0,1] parameter passed to `getPointAtU` on the shared chord.
   * When the anchor lies on a vertex shared by two chain segments (common at u=0 or u=1),
   * projection distance ties; we break ties by preferring the segment whose arc position
   * matches `chordU * totalChainLength` so the stamp does not attach to the wrong edge.
   */
  addConnectorAtAnchor(
    faceAId: string,
    faceBId: string,
    anchor: paper.Point,
    stampPathData: string,
    isFlipped: boolean,
    ownerFaceId: string,
    chordU: number = 0.5,
    /** Endpoints of the shared chord from `getSharedPerimeter` (firstSegment → lastSegment, same order as `getPointAtU`). Used to align chord parameter with polyline chain direction. */
    chordEnd0?: paper.Point,
    chordEnd1?: paper.Point
  ) {
    let edgeIds = this.findEdgesBetweenFaces(faceAId, faceBId);
    if (edgeIds.length === 0) return;

    edgeIds = this.sortSharedEdgesAsChain(edgeIds);

    const DIST_TIE_EPS = 1e-3;
    const edgeLengths = edgeIds.map(eid => {
      const edge = this.edges.get(eid)!;
      const path = new paper.Path(edge.pathData);
      const len = path.length;
      path.remove();
      return len;
    });
    const totalLength = edgeLengths.reduce((a, b) => a + b, 0);

    const chainEnds = this.getOpenChainEndpoints(edgeIds);
    let targetArc = totalLength > 0 ? Math.max(0, Math.min(1, chordU)) * totalLength : 0;
    if (
      chainEnds &&
      totalLength > 0 &&
      chordEnd0 &&
      chordEnd1 &&
      !chordEnd0.equals(chordEnd1)
    ) {
      const dAlign = chordEnd0.getDistance(chainEnds.start) + chordEnd1.getDistance(chainEnds.end);
      const dFlip = chordEnd0.getDistance(chainEnds.end) + chordEnd1.getDistance(chainEnds.start);
      const u = Math.max(0, Math.min(1, chordU));
      targetArc = (dAlign <= dFlip ? u : 1 - u) * totalLength;
    }

    type Cand = { eid: string; t: number; dist: number; arcPos: number };
    const cands: Cand[] = [];
    let cumulative = 0;

    for (let i = 0; i < edgeIds.length; i++) {
      const eid = edgeIds[i];
      const edge = this.edges.get(eid)!;
      const edgePath = new paper.Path(edge.pathData);
      const len = edgePath.length;
      if (len < 1e-6) {
        edgePath.remove();
        continue;
      }

      const nearest = edgePath.getNearestPoint(anchor);
      const d = anchor.getDistance(nearest);
      const t = edgePath.getOffsetOf(nearest) / len;
      const arcPos = cumulative + t * len;
      cumulative += len;
      edgePath.remove();

      cands.push({ eid, t, dist: d, arcPos });
    }

    if (cands.length === 0) return;

    const minDist = Math.min(...cands.map(c => c.dist));
    const close = cands.filter(c => c.dist <= minDist + DIST_TIE_EPS);
    const pick =
      close.length === 1
        ? close[0]
        : close.reduce((best, c) =>
            Math.abs(c.arcPos - targetArc) < Math.abs(best.arcPos - targetArc) ? c : best
          );

    const edge = this.edges.get(pick.eid)!;
    if (!edge.connectors) edge.connectors = [];
    edge.connectors.push({ u: pick.t, stampPathData, isFlipped, ownerFaceId });
  }

  /**
   * Adds a connector to a shared boundary between two faces.
   * 'u' is relative to the total length of all shared edges (in chain order).
   * @param u Normalized position [0, 1] along the combined shared interface.
   */
  addConnectorToBoundary(faceAId: string, faceBId: string, u: number, stampPathData: string, isFlipped: boolean, ownerFaceId: string) {
    let edgeIds = this.findEdgesBetweenFaces(faceAId, faceBId);
    if (edgeIds.length === 0) return;

    edgeIds = this.sortSharedEdgesAsChain(edgeIds);

    let totalLength = 0;
    const edgeLengths = edgeIds.map(eid => {
      const edge = this.edges.get(eid)!;
      const path = new paper.Path(edge.pathData);
      const len = path.length;
      path.remove();
      return len;
    });
    edgeLengths.forEach(len => { totalLength += len; });

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
   * Merges two adjacent faces by marking their shared edges as "merged".
   * 
   * How it works:
   * 1. Scans all edges in the topological graph
   * 2. Finds edges whose faceAId and faceBId match the two faces (in either order)
   * 3. Marks those shared edges with isMerged = true
   * 4. Later, when getMergedBoundary() is called, merged edges are excluded from the
   *    boundary trace, so they won't appear in the final cut contour
   * 
   * This is used during topological cut generation: shared edges between merged pieces
   * are not traced, so the pieces form a single continuous boundary.
   */
  mergeFaces(_faceAId: string, _faceBId: string) {
    // No-op: boundary computation uses XOR logic in getMergedBoundary, not isMerged flags.
  }

  /**
   * Generates the final SVG boundary path for a set of merged faces.
   * 
   * This is the core "Traversal" step for merged group boundaries. Given a set of face IDs
   * that have been merged, it reconstructs the outer perimeter by:
   * 
   * 1. Finding all edges that touch at least one face in the group
   * 2. Filtering to only "boundary edges" — edges where exactly one side is in the group
   *    (Internal edges where both sides are in the group are omitted)
   * 3. Building an adjacency map of vertices on the boundary
   * 4. Walking the boundary edges in order, starting from an arbitrary edge
   * 5. Traversing counterclockwise (so that when multiple loops exist, they form a
   *    valid SVG path with holes)
   * 6. Splicing in any connector stamps that are attached to the boundary
   * 7. Combining all loops into a single SVG path string
   * 
   * The result is the outer cut contour of all merged pieces as a single unified shape.
   * Example: Three merged pieces might have a combined boundary that is non-convex or has holes.
   */
  getMergedBoundary(faceIds: string[]): string {
    const faceIdSet = new Set(faceIds);
    const groupEdges = new Set<string>();
    faceIdSet.forEach(fid => {
      const face = this.faces.get(fid);
      if (face) face.edgeIds.forEach(eid => groupEdges.add(eid));
    });

    /**
     * Boundary edge selection:
     * An edge belongs to the boundary if exactly one of its two faces is in the merged group.
     * - Both faces in group: internal edge, not included in boundary trace
     * - One face in group, one outside: boundary edge, should be traced
     * - No faces in group: not relevant, already filtered
     */
    const boundaryEdges = Array.from(groupEdges).filter(eid => {
      const edge = this.edges.get(eid)!;
      const faceAIn = faceIdSet.has(edge.faceAId);
      const faceBIn = edge.faceBId ? faceIdSet.has(edge.faceBId) : false;
      return faceAIn !== faceBIn;  // XOR: exactly one side is in the group
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
   *
   * Each connector stamp is an open curve whose two endpoints attach to the shared
   * edge.  The correct splice is:
   *   [edge from start → stamp_endpoint_0] + [stamp arc] + [stamp_endpoint_1 → edge end]
   *
   * The attachment offsets are found by projecting the stamp's first/last points back
   * onto the original edge path via getNearestLocation.  The edge is then sampled as
   * a polyline between those attachment points, avoiding the "shortcut gap" that
   * occurred when the old code jumped from edge-start directly to the stamp.
   */
  private getEdgePath(edgeId: string, reversed: boolean): paper.Path {
    const edge = this.edges.get(edgeId)!;

    if (!edge.connectors || edge.connectors.length === 0) {
      const path = new paper.Path(edge.pathData);
      if (reversed) path.reverse();
      return path;
    }

    const sorted = [...edge.connectors].sort((a, b) => a.u - b.u);
    const edgePath = new paper.Path(edge.pathData);
    const totalLen = edgePath.length;

    // For each connector: position the stamp and record the edge offsets of its two
    // attachment endpoints.
    type Entry = { off0: number; off1: number; stamp: paper.Path };
    const entries: Entry[] = sorted.map(c => {
      const offset = Math.max(0, Math.min(totalLen, c.u * totalLen));
      const pos     = edgePath.getPointAt(offset);
      const tangent = edgePath.getTangentAt(offset);
      const angle   = tangent.angle;

      const stamp = new paper.Path(c.stampPathData);
      const side  = (c.ownerFaceId === edge.faceAId) ? -1 : 1;
      stamp.rotate(angle - 90 * side, new paper.Point(0, 0));
      stamp.translate(pos);
      stamp.closed = false;

      // Project stamp endpoints back onto the edge to get attachment offsets.
      const loc0 = edgePath.getNearestLocation(stamp.firstSegment.point);
      const loc1 = edgePath.getNearestLocation(stamp.lastSegment.point);
      let off0 = loc0.offset;
      let off1 = loc1.offset;

      // Ensure stamp runs in the same direction as the edge (off0 < off1).
      if (off0 > off1) {
        stamp.reverse();
        [off0, off1] = [off1, off0];
      }

      return { off0, off1, stamp };
    });

    // Sample the edge as a polyline between connector attachment points, inserting
    // each stamp curve at its splice region.
    const SAMPLE_STEP = 4; // pixels between sample points on the straight edge portions

    function sampleEdge(fromOff: number, toOff: number): paper.Point[] {
      const pts: paper.Point[] = [];
      if (toOff <= fromOff) return pts;
      const n = Math.max(1, Math.round((toOff - fromOff) / SAMPLE_STEP));
      for (let i = 0; i <= n; i++) {
        const t = fromOff + (toOff - fromOff) * (i / n);
        const pt = edgePath.getPointAt(Math.max(0, Math.min(totalLen, t)));
        if (pt) pts.push(pt);
      }
      return pts;
    }

    const newPath = new paper.Path();
    let cursor = 0;

    for (const { off0, off1, stamp } of entries) {
      // Edge section before this stamp.
      const edgeSeg = sampleEdge(cursor, off0);
      for (const pt of edgeSeg) newPath.add(pt);

      // Stamp arc.
      newPath.addSegments(stamp.segments.map((s: paper.Segment) => s.clone()));
      stamp.remove();

      cursor = off1;
    }

    // Remaining edge after the last stamp.
    const tail = sampleEdge(cursor, totalLen);
    for (const pt of tail) newPath.add(pt);

    edgePath.remove();
    if (reversed) newPath.reverse();
    return newPath;
  }
}
