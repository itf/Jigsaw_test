import paper from 'paper';
import { Node, Edge, Face, FaceEdge, Point, FloatingWhimsy, ConnectorV5 } from '../types';
import { generateConnectorPath } from './connectorUtils';
import { getExactSegment } from './pathMergeUtils';
import { generateGridPoints, generateHexGridPoints, generateRandomPoints } from './gridUtils';
import { Delaunay } from 'd3-delaunay';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Build a closed face path from ordered edge refs. Caller must remove the path. */
function buildFacePath(face: Face, edges: Record<string, Edge>): paper.Path {
  const path = new paper.Path();
  face.edges.forEach(eInfo => {
    const edge = edges[eInfo.id];
    if (!edge) return;
    const tmp = edge.path.clone({ insert: false });
    if (eInfo.reversed) tmp.reverse();
    path.addSegments(tmp.segments);
    tmp.remove();
  });
  path.closed = true;
  return path;
}

// ---------------------------------------------------------------------------
// GraphManager
// ---------------------------------------------------------------------------

export class GraphManager {
  private nodes: Record<string, Node> = {};
  private edges: Record<string, Edge> = {};
  private faces: Record<string, Face> = {};
  private connectors: Record<string, ConnectorV5> = {};

  constructor(
    nodes: Record<string, Node> = {},
    edges: Record<string, Edge> = {},
    faces: Record<string, Face> = {},
    connectors: Record<string, ConnectorV5> = {}
  ) {
    // Deep-copy primitives, but we must handle paper.Path specially if they are already paths
    this.nodes = JSON.parse(JSON.stringify(nodes));
    this.faces = JSON.parse(JSON.stringify(faces));
    this.connectors = JSON.parse(JSON.stringify(connectors));

    // Reconstruct edges with live paths
    for (const [id, e] of Object.entries(edges)) {
      this.edges[id] = {
        ...e,
        path: e.path instanceof paper.Path ? e.path.clone({ insert: false }) : new paper.Path((e as any).pathData)
      };
    }
  }

  public getNodes() { return this.nodes; }
  public getEdges() { return this.edges; }
  public getFaces() { return this.faces; }
  public getConnectors() { return this.connectors; }

  // -------------------------------------------------------------------------
  // Public Builders
  // -------------------------------------------------------------------------

  public addNode(point: Point): string {
    const id = uid('node');
    this.nodes[id] = { id, point, incidentEdges: [] };
    return id;
  }

  public addEdge(fromNode: string, toNode: string, pathDataOrPath: string | paper.Path): string {
    const id = uid('edge');
    const path = typeof pathDataOrPath === 'string' 
      ? new paper.Path(pathDataOrPath) 
      : pathDataOrPath.clone({ insert: false });
    
    this.edges[id] = {
      id,
      fromNode,
      toNode,
      path,
      leftFace: '',
      rightFace: '',
    };
    if (this.nodes[fromNode]) this.nodes[fromNode].incidentEdges.push(id);
    if (this.nodes[toNode] && fromNode !== toNode) this.nodes[toNode].incidentEdges.push(id);
    return id;
  }

  public addFace(edges: FaceEdge[], color: string = '#e2e8f0'): string {
    const id = uid('face');
    this.faces[id] = {
      id,
      edges,
      color,
      groupMemberships: [],
    };
    // Update edges' face references
    edges.forEach(fe => {
      const edge = this.edges[fe.id];
      if (!edge) return;
      if (fe.reversed) edge.rightFace = id;
      else edge.leftFace = id;
    });
    return id;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private isNodeInsidePath(point: Point, path: paper.PathItem): boolean {
    return path.contains(new paper.Point(point.x, point.y));
  }

  private findClosestPointOnPath(path: paper.PathItem, point: Point): paper.Point {
    const loc = path.getNearestLocation(new paper.Point(point.x, point.y));
    return loc.point;
  }

  /** Angle at which an edge leaves a given node (for face traversal sorting). */
  private getEdgeAngleAtNode(edge: Edge, nodeId: string): number {
    const path = edge.path;
    let tangent: paper.Point | null = null;
    if (edge.fromNode === nodeId) {
      tangent = path.length > 0 ? path.getTangentAt(0) : null;
    } else {
      tangent = path.length > 0 ? path.getTangentAt(path.length).multiply(-1) : null;
    }
    const angle = tangent ? tangent.angle : 0;
    return angle;
  }

  /** Returns incident edges of a node sorted by departure angle (CCW). */
  private getSortedIncidentEdges(nodeId: string): string[] {
    const node = this.nodes[nodeId];
    if (!node) return [];
    return [...node.incidentEdges].sort((a, b) => {
      const ea = this.edges[a];
      const eb = this.edges[b];
      if (!ea || !eb) return 0;
      return this.getEdgeAngleAtNode(ea, nodeId) - this.getEdgeAngleAtNode(eb, nodeId);
    });
  }

  /** Remap connectors that reference oldEdgeId after a split into left/right sub-edges. */
  private remapConnectorsAfterSplit(
    oldEdgeId: string,
    leftEdgeId: string,  // fromNode → splitNode
    leftLength: number,
    rightEdgeId: string, // splitNode → toNode
    _rightLength: number,
    totalLength: number
  ): void {
    const splitOffset = leftLength;

    for (const c of Object.values(this.connectors)) {
      const p1Offset = c.p1.edgeId === oldEdgeId ? c.p1.t * totalLength : -1;
      const p2Offset = c.p2.edgeId === oldEdgeId ? c.p2.t * totalLength : -1;

      // Remap p1
      if (c.p1.edgeId === oldEdgeId) {
        const offset = c.p1.t * totalLength;
        if (offset <= leftLength) {
          c.p1 = { edgeId: leftEdgeId, t: leftLength > 0 ? offset / leftLength : 0 };
        } else {
          c.p1 = { edgeId: rightEdgeId, t: _rightLength > 0 ? (offset - leftLength) / _rightLength : 0 };
        }
      }
      // Remap p2
      if (c.p2.edgeId === oldEdgeId) {
        const offset = c.p2.t * totalLength;
        if (offset <= leftLength) {
          c.p2 = { edgeId: leftEdgeId, t: leftLength > 0 ? offset / leftLength : 0 };
        } else {
          c.p2 = { edgeId: rightEdgeId, t: _rightLength > 0 ? (offset - leftLength) / _rightLength : 0 };
        }
      }
      // Remap midEdgeId
      if (c.midEdgeId === oldEdgeId) {
        const offset = c.midT * totalLength;
        if (offset <= leftLength) {
          c.midEdgeId = leftEdgeId;
          c.midT = leftLength > 0 ? offset / leftLength : 0;
        } else {
          c.midEdgeId = rightEdgeId;
          c.midT = _rightLength > 0 ? (offset - leftLength) / _rightLength : 0;
        }
      }
      // Remap replacedSegment entries
      c.replacedSegment = c.replacedSegment.flatMap(ref => {
        if (ref.edgeId !== oldEdgeId) return [ref];
        
        const isAtP1 = Math.abs(splitOffset - p1Offset) < 0.001;
        const isAtP2 = Math.abs(splitOffset - p2Offset) < 0.001;

        if (isAtP1 && isAtP2) return [];

        if (isAtP1) {
          return ref.reversed 
            ? [{ edgeId: leftEdgeId, reversed: true }]
            : [{ edgeId: rightEdgeId, reversed: false }];
        }
        if (isAtP2) {
          return ref.reversed
            ? [{ edgeId: rightEdgeId, reversed: true }]
            : [{ edgeId: leftEdgeId, reversed: false }];
        }

        // Split in the middle of a replaced segment
        if (ref.reversed) {
          return [
            { edgeId: rightEdgeId, reversed: true },
            { edgeId: leftEdgeId, reversed: true },
          ];
        } else {
          return [
            { edgeId: leftEdgeId, reversed: false },
            { edgeId: rightEdgeId, reversed: false },
          ];
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // Face traversal
  // -------------------------------------------------------------------------

  /**
   * Traverses the planar graph from startEdge/fromNode, following the leftmost
   * turn at each node, until the starting half-edge is revisited.
   * Returns the ordered FaceEdge list and assigns faceId to each edge's left/right face.
   */
  public traverseFace(startEdgeId: string, fromNodeId: string, faceId: string): FaceEdge[] {
    const faceEdges: FaceEdge[] = [];
    let currentEdgeId = startEdgeId;
    let currentNodeId = fromNodeId;

    const startEdge = this.edges[startEdgeId];
    if (!startEdge) return [];

    const visited = new Set<string>();

    for (let guard = 0; guard < 2000; guard++) {
      const key = `${currentEdgeId}-${currentNodeId}`;
      if (visited.has(key)) break;
      visited.add(key);

      const currentEdge = this.edges[currentEdgeId];
      if (!currentEdge) break;

      // Which side of the edge are we walking on?
      const isReversed = currentEdge.toNode === currentNodeId;
      faceEdges.push({ id: currentEdgeId, reversed: isReversed });

      if (isReversed) {
        currentEdge.rightFace = faceId;
      } else {
        currentEdge.leftFace = faceId;
      }

      // Advance to the other end of this edge
      const nextNodeId = isReversed ? currentEdge.fromNode : currentEdge.toNode;

      // At nextNode, pick the next edge in the sorted order (left-turn = previous in CCW list)
      const sorted = this.getSortedIncidentEdges(nextNodeId);
      const idx = sorted.indexOf(currentEdgeId);
      const nextIdx = (idx - 1 + sorted.length) % sorted.length;
      const nextEdgeId = sorted[nextIdx];

      if (!nextEdgeId || !this.edges[nextEdgeId]) break;

      currentNodeId = nextNodeId;
      currentEdgeId = nextEdgeId;

      if (currentEdgeId === startEdgeId && currentNodeId === fromNodeId) break;
    }

    return faceEdges;
  }

  // -------------------------------------------------------------------------
  // Edge splitting
  // -------------------------------------------------------------------------

  /**
   * Splits an edge at the point nearest to `point`, creating a new node.
   * Returns the new node's id (or the existing endpoint id if the split is
   * too close to an endpoint).
   *
   * paper.Path.splitAt(offset) truncates the path to [start → offset] in-place
   * and returns the remainder [offset → end].
   */
  public splitEdgeAtPoint(edgeId: string, point: Point): string {
    const edge = this.edges[edgeId];
    if (!edge) return '';

    const edgePath = edge.path.clone({ insert: false });
    const loc = edgePath.getNearestLocation(new paper.Point(point.x, point.y));
    const totalLength = edgePath.length;

    // Snap to existing endpoints if very close
    if (loc.offset < 0.5) { edgePath.remove(); return edge.fromNode; }
    if (loc.offset > totalLength - 0.5) { edgePath.remove(); return edge.toNode; }

    const splitOffset = loc.offset;
    const newNodeId = uid('node');
    this.nodes[newNodeId] = {
      id: newNodeId,
      point: { x: loc.point.x, y: loc.point.y },
      incidentEdges: [],
    };

    // After splitAt: edgePath = [start → split], remainder = [split → end]
    const remainder = edgePath.splitAt(splitOffset);
    const leftLength = edgePath.length;
    const rightLength = remainder ? remainder.length : 0;

    const leftId = uid('edge');
    const rightId = uid('edge');

    this.edges[leftId] = {
      id: leftId,
      fromNode: edge.fromNode,
      toNode: newNodeId,
      path: edgePath,
      leftFace: edge.leftFace,
      rightFace: edge.rightFace,
    };

    this.edges[rightId] = {
      id: rightId,
      fromNode: newNodeId,
      toNode: edge.toNode,
      path: remainder || new paper.Path(),
      leftFace: edge.leftFace,
      rightFace: edge.rightFace,
    };

    // Update node incidence
    this.nodes[edge.fromNode].incidentEdges = this.nodes[edge.fromNode].incidentEdges
      .filter(id => id !== edgeId).concat(leftId);
    this.nodes[edge.toNode].incidentEdges = this.nodes[edge.toNode].incidentEdges
      .filter(id => id !== edgeId).concat(rightId);
    this.nodes[newNodeId].incidentEdges = [leftId, rightId];

    // Update face edge lists
    for (const face of Object.values(this.faces)) {
      const idx = face.edges.findIndex(e => e.id === edgeId);
      if (idx === -1) continue;
      const { reversed } = face.edges[idx];
      if (reversed) {
        face.edges.splice(idx, 1,
          { id: rightId, reversed: true },
          { id: leftId, reversed: true },
        );
      } else {
        face.edges.splice(idx, 1,
          { id: leftId, reversed: false },
          { id: rightId, reversed: false },
        );
      }
    }

    // Remap connectors
    this.remapConnectorsAfterSplit(edgeId, leftId, leftLength, rightId, rightLength, totalLength);

    delete this.edges[edgeId];
    edgePath.remove();
    remainder?.remove();

    return newNodeId;
  }

  // -------------------------------------------------------------------------
  // Edge splicing (all 4 cases)
  // -------------------------------------------------------------------------

  /**
   * Splices `splicePath` into edge `edgeId`.
   * If 2+ intersections: replaces the segment between first and last.
   * If 1 intersection: splits the edge and returns the new node.
   */
  public spliceEdge(edgeId: string, splicePath: paper.PathItem): string[] {
    const edge = this.edges[edgeId];
    if (!edge) return [];

    const edgePath = edge.path.clone({ insert: false });
    const intersections = edgePath.getIntersections(splicePath);
    
    if (intersections.length === 0) {
      const midPoint = edgePath.length > 0 ? edgePath.getPointAt(edgePath.length / 2) : null;
      if (midPoint && this.isNodeInsidePath({ x: midPoint.x, y: midPoint.y }, splicePath)) {
        this._removeEdgeFromGraph(edgeId);
        edgePath.remove();
        return [];
      }
      edgePath.remove();
      return [];
    }

    if (intersections.length === 1) {
      const newNodeId = this.splitEdgeAtPoint(edgeId, intersections[0].point);
      edgePath.remove();
      return [newNodeId];
    }

    intersections.sort((a, b) => a.offset - b.offset);
    const firstInt = intersections[0];
    const lastInt = intersections[intersections.length - 1];

    const nodeAId = this.addNode({ x: firstInt.point.x, y: firstInt.point.y });
    const nodeBId = this.addNode({ x: lastInt.point.x, y: lastInt.point.y });

    // Determine which part to replace by checking midpoints
    const midOffset = (firstInt.offset + lastInt.offset) / 2;
    const midPoint = edgePath.length > 0 ? edgePath.getPointAt(midOffset) : null;
    // For open paths, "inside" is tricky. We'll assume we want to replace the segment if it's a connector.
    // If it's a closed path, we check containment.
    let isMiddleInside = midPoint ? this.isNodeInsidePath({ x: midPoint.x, y: midPoint.y }, splicePath) : false;
    const isClosed = (splicePath as any).closed === true;
    if (!isClosed && intersections.length >= 2) {
      // For 2-point open path splice, we almost always want to replace the segment between them
      isMiddleInside = true;
    }

    const leftId = uid('edge');
    const rightId = uid('edge');
    const spliceId = uid('edge');

    if (isMiddleInside) {
      // Standard case: replace middle segment [first -> last]
      const leftPart = getExactSegment(edgePath, 0, firstInt.offset);
      const rightPart = getExactSegment(edgePath, lastInt.offset, edgePath.length);

      this.edges[leftId] = {
        id: leftId,
        fromNode: edge.fromNode,
        toNode: nodeAId,
        path: leftPart,
        leftFace: edge.leftFace,
        rightFace: edge.rightFace,
      };
      this.edges[rightId] = {
        id: rightId,
        fromNode: nodeBId,
        toNode: edge.toNode,
        path: rightPart,
        leftFace: edge.leftFace,
        rightFace: edge.rightFace,
      };

      // For the splice edge, we need to make sure the path data starts at nodeA and ends at nodeB
      // If splicePath is open, we might need to extract the segment between the intersections
      let finalSplicePath: paper.Path;
      if (isClosed) {
        const loc1 = splicePath.getNearestLocation(firstInt.point);
        const loc2 = splicePath.getNearestLocation(lastInt.point);
        if (loc1 && loc2) {
          // There are two segments. We want the one that is NOT the base.
          // The base is the one that is closer to the edge segment we are replacing.
          const seg1 = getExactSegment(splicePath as paper.Path, loc1.offset, loc2.offset);
          const seg2 = getExactSegment(splicePath as paper.Path, loc2.offset, loc1.offset);
          
          const mid1 = seg1.length > 0 ? seg1.getPointAt(seg1.length / 2) : null;
          const mid2 = seg2.length > 0 ? seg2.getPointAt(seg2.length / 2) : null;
          
          if (mid1 && mid2 && midPoint) {
            const dist1 = mid1.getDistance(midPoint);
            const dist2 = mid2.getDistance(midPoint);
            
            if (dist1 > dist2) {
              finalSplicePath = seg1;
              seg2.remove();
            } else {
              finalSplicePath = seg2;
              seg1.remove();
            }
          } else {
            finalSplicePath = seg1; // Fallback
            seg2.remove();
          }
        } else {
          finalSplicePath = new paper.Path();
        }
      } else {
        const loc1 = splicePath.getNearestLocation(firstInt.point);
        const loc2 = splicePath.getNearestLocation(lastInt.point);
        if (loc1 && loc2) {
          finalSplicePath = getExactSegment(splicePath as paper.Path, loc1.offset, loc2.offset);
        } else {
          finalSplicePath = new paper.Path();
        }
      }

      this.edges[spliceId] = {
        id: spliceId,
        fromNode: nodeAId,
        toNode: nodeBId,
        path: finalSplicePath,
        leftFace: edge.leftFace,
        rightFace: edge.rightFace,
      };

      this.nodes[edge.fromNode].incidentEdges = this.nodes[edge.fromNode].incidentEdges.filter(id => id !== edgeId).concat(leftId);
      this.nodes[edge.toNode].incidentEdges = this.nodes[edge.toNode].incidentEdges.filter(id => id !== edgeId).concat(rightId);
      this.nodes[nodeAId].incidentEdges = [leftId, spliceId];
      this.nodes[nodeBId].incidentEdges = [spliceId, rightId];

      this._replaceFaceEdgeRef(edgeId, [
        { id: leftId, reversed: false },
        { id: spliceId, reversed: false },
        { id: rightId, reversed: false },
      ]);

      leftPart.remove();
      rightPart.remove();
    } else {
      // Swallowed ends case: replace ends [0 -> first] and [last -> end]
      const middlePart = getExactSegment(edgePath, firstInt.offset, lastInt.offset);

      this.edges[leftId] = {
        id: leftId,
        fromNode: nodeAId,
        toNode: nodeBId,
        path: middlePart,
        leftFace: edge.leftFace,
        rightFace: edge.rightFace,
      };
      this.edges[spliceId] = {
        id: spliceId,
        fromNode: nodeBId,
        toNode: nodeAId,
        path: splicePath.clone({ insert: false }) as paper.Path,
        leftFace: edge.leftFace,
        rightFace: edge.rightFace,
      };

      this.nodes[edge.fromNode].incidentEdges = this.nodes[edge.fromNode].incidentEdges.filter(id => id !== edgeId);
      this.nodes[edge.toNode].incidentEdges = this.nodes[edge.toNode].incidentEdges.filter(id => id !== edgeId);
      this.nodes[nodeAId].incidentEdges = [leftId, spliceId];
      this.nodes[nodeBId].incidentEdges = [leftId, spliceId];

      this._replaceFaceEdgeRef(edgeId, [
        { id: spliceId, reversed: false },
        { id: leftId, reversed: false },
      ]);

      middlePart.remove();
    }

    this._removeEdgeFromGraph(edgeId);
    edgePath.remove();
    return [nodeAId, nodeBId];
  }


  /** Replace all face references to oldEdgeId with the given new refs. */
  private _replaceFaceEdgeRef(oldEdgeId: string, newRefs: FaceEdge[]): void {
    for (const face of Object.values(this.faces)) {
      const idx = face.edges.findIndex(e => e.id === oldEdgeId);
      if (idx === -1) continue;
      const { reversed } = face.edges[idx];
      const refs = reversed
        ? [...newRefs].reverse().map(r => ({ id: r.id, reversed: !r.reversed }))
        : newRefs;
      face.edges.splice(idx, 1, ...refs);
    }
  }

  public removeEdge(edgeId: string): void {
    this._removeEdgeFromGraph(edgeId);
  }

  /** Remove an edge from nodes and face lists and delete it. */
  private _removeEdgeFromGraph(edgeId: string): void {
    const edge = this.edges[edgeId];
    if (!edge) return;
    if (this.nodes[edge.fromNode])
      this.nodes[edge.fromNode].incidentEdges = this.nodes[edge.fromNode].incidentEdges.filter(id => id !== edgeId);
    if (this.nodes[edge.toNode])
      this.nodes[edge.toNode].incidentEdges = this.nodes[edge.toNode].incidentEdges.filter(id => id !== edgeId);
    for (const face of Object.values(this.faces)) {
      face.edges = face.edges.filter(e => e.id !== edgeId);
    }
    delete this.edges[edgeId];
  }

  public deleteEdge(edgeId: string): void {
    this._removeEdgeFromGraph(edgeId);
  }

  // -------------------------------------------------------------------------
  // Whimsy splicing
  // -------------------------------------------------------------------------

  /**
   * Merges a floating whimsy into the graph.
   * The whimsy boundary becomes new graph edges; affected edges are trimmed.
   * Returns the id of the inner (whimsy) face, or '' on failure.
   */
  public spliceWhimsy(whimsy: FloatingWhimsy, whimsyPath: paper.PathItem): string {
    // 1. Find all edges that interact with the whimsy boundary
    const edgeIds = Object.keys(this.edges);
    const boundaryNodeIds: string[] = [];

    for (const eid of edgeIds) {
      const edge = this.edges[eid];
      if (!edge) continue;

      const edgePath = edge.path.clone({ insert: false });
      const intersections = edgePath.getIntersections(whimsyPath);
      
      if (intersections.length === 0) {
        const midPoint = edgePath.length > 0 ? edgePath.getPointAt(edgePath.length / 2) : null;
        if (midPoint && this.isNodeInsidePath({ x: midPoint.x, y: midPoint.y }, whimsyPath)) {
          this._removeEdgeFromGraph(eid);
        }
        edgePath.remove();
        continue;
      }

      intersections.sort((a, b) => a.offset - b.offset);
      const intNodes: string[] = intersections.map(int => this.addNode({ x: int.point.x, y: int.point.y }));
      boundaryNodeIds.push(...intNodes);

      const nodes = [edge.fromNode, ...intNodes, edge.toNode];
      const offsets = [0, ...intersections.map(i => i.offset), edgePath.length];
      const newEdgeRefs: FaceEdge[] = [];

      for (let i = 0; i < offsets.length - 1; i++) {
        const start = offsets[i];
        const end = offsets[i+1];
        if (Math.abs(end - start) < 0.001) continue;

        const mid = (start + end) / 2;
        const midPt = edgePath.length > 0 ? edgePath.getPointAt(mid) : null;
        if (midPt && !this.isNodeInsidePath({ x: midPt.x, y: midPt.y }, whimsyPath)) {
          const seg = getExactSegment(edgePath, start, end);
          const nid = this.addEdge(nodes[i], nodes[i+1], seg);
          newEdgeRefs.push({ id: nid, reversed: false });
          seg.remove();
        }
      }

      this._replaceFaceEdgeRef(eid, newEdgeRefs);
      this._removeEdgeFromGraph(eid);
      edgePath.remove();
    }

    // 2. Build whimsy boundary edges
    const whimsyPathClosed = whimsyPath instanceof paper.Path
      ? whimsyPath as paper.Path
      : (whimsyPath as paper.CompoundPath).children[0] as paper.Path;

    const sorted = boundaryNodeIds
      .filter(nid => this.nodes[nid])
      .map(nid => {
        const node = this.nodes[nid];
        const loc = whimsyPathClosed.getNearestLocation(new paper.Point(node.point.x, node.point.y));
        return { nid, offset: loc.offset };
      })
      .sort((a, b) => a.offset - b.offset);

    if (sorted.length >= 2) {
      for (let i = 0; i < sorted.length; i++) {
        const next = (i + 1) % sorted.length;
        const fromNid = sorted[i].nid;
        const toNid = sorted[next].nid;
        const arcSegment = getExactSegment(whimsyPathClosed.clone() as paper.Path, sorted[i].offset, sorted[next].offset);
        const arcEdgeId = this.addEdge(fromNid, toNid, arcSegment);
        arcSegment.remove();
        arcSegment.remove();
      }
    } else if (boundaryNodeIds.length === 0) {
      // Whimsy fully inside a face
      const closedNodeId = this.addNode({ x: whimsyPathClosed.firstSegment.point.x, y: whimsyPathClosed.firstSegment.point.y });
      this.addEdge(closedNodeId, closedNodeId, whimsyPathClosed.pathData);
    }

    // 3. Re-derive affected faces and find new ones
    const boundaryEdgeIds = Object.values(this.edges)
      .filter(e => !e.leftFace || !e.rightFace)
      .map(e => e.id);

    let whimsyFaceId = '';
    for (const eid of boundaryEdgeIds) {
      const edge = this.edges[eid];
      if (!edge.leftFace) {
        const fid = uid('face');
        const edges = this.traverseFace(eid, edge.fromNode, fid);
        if (edges.length > 0) {
          this.faces[fid] = { id: fid, edges, color: this.getRandomColor(), groupMemberships: [] };
          // Check if this is the whimsy face (its midpoint should be inside whimsyPath)
          const fPath = buildFacePath(this.faces[fid], this.edges);
          const fMid = fPath.bounds.center;
          if (this.isNodeInsidePath({ x: fMid.x, y: fMid.y }, whimsyPath)) whimsyFaceId = fid;
          fPath.remove();
        }
      }
      if (!edge.rightFace) {
        const fid = uid('face');
        const edges = this.traverseFace(eid, edge.toNode, fid);
        if (edges.length > 0) {
          this.faces[fid] = { id: fid, edges, color: this.getRandomColor(), groupMemberships: [] };
          const fPath = buildFacePath(this.faces[fid], this.edges);
          const fMid = fPath.bounds.center;
          if (this.isNodeInsidePath({ x: fMid.x, y: fMid.y }, whimsyPath)) whimsyFaceId = fid;
          fPath.remove();
        }
      }
    }

    return whimsyFaceId;
  }

  private getRandomColor(): string {
    const COLORS = ['#a5f3fc', '#bbf7d0', '#fde68a', '#fca5a5', '#c4b5fd', '#f9a8d4'];
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  // -------------------------------------------------------------------------
  // Connector baking
  // -------------------------------------------------------------------------

  /**
   * Bake a single connector into the graph.
   * Splices the connector path along the replacedSegment, deleting the old
   * boundary segment and inserting the connector geometry as a new edge.
   */
  public bakeConnector(c: ConnectorV5): void {
    if (c.disabled) return;

    // Ensure the connector is in our record so it gets remapped during splits
    const wasAlreadyInRecord = !!this.connectors[c.id];
    if (!wasAlreadyInRecord) {
      this.connectors[c.id] = c;
    }

    const cleanup = () => {
      if (!wasAlreadyInRecord) delete this.connectors[c.id];
    };

    const midEdge = this.edges[c.midEdgeId];
    if (!midEdge) { cleanup(); return; }

    // Build the edge path for the source face direction
    const edgePath = midEdge.path.clone({ insert: false });
    if (c.direction === 'in') edgePath.reverse();

    const { pathData: connPathData, p1: cp1, p2: cp2 } = generateConnectorPath(
      edgePath,
      0,
      c.midT,
      c.widthPx,
      c.extrusion,
      c.headTemplateId,
      c.headScale,
      c.headRotationDeg,
      c.useEquidistantHeadPoint,
      [],
      c.jitter,
      c.jitterSeed,
      c.neckShape,
      c.neckCurvature,
      c.extrusionCurvature,
    );
    edgePath.remove();

    const connPath = new paper.Path(connPathData);
    const loc1 = connPath.getNearestLocation(cp1);
    const loc2 = connPath.getNearestLocation(cp2);
    if (!loc1 || !loc2) { 
      connPath.remove(); 
      cleanup();
      return; 
    }

    // Extract the open path from p1→p2 through the connector (the splice geometry)
    const openPath = getExactSegment(connPath, loc1.offset, loc2.offset);
    connPath.remove();

    // Split p1.edgeId at p1.t to get N1
    const p1Edge = this.edges[c.p1.edgeId];
    if (!p1Edge) { openPath.remove(); cleanup(); return; }
    const p1PtRaw = p1Edge.path.length > 0 ? p1Edge.path.getPointAt(c.p1.t * p1Edge.path.length) : null;
    if (!p1PtRaw) { openPath.remove(); cleanup(); return; }
    const p1Pt = { x: p1PtRaw.x, y: p1PtRaw.y };
    const n1 = this.splitEdgeAtPoint(c.p1.edgeId, p1Pt);

    // Split p2.edgeId at p2.t to get N2
    // IMPORTANT: c.p2 might have been remapped if it was on the same edge as p1!
    const p2Edge = this.edges[c.p2.edgeId];
    if (!p2Edge) { openPath.remove(); cleanup(); return; }
    const p2PtRaw = p2Edge.path.length > 0 ? p2Edge.path.getPointAt(c.p2.t * p2Edge.path.length) : null;
    if (!p2PtRaw) { openPath.remove(); cleanup(); return; }
    const p2Pt = { x: p2PtRaw.x, y: p2PtRaw.y };
    const n2 = this.splitEdgeAtPoint(c.p2.edgeId, p2Pt);

    if (!n1 || !n2) { openPath.remove(); cleanup(); return; }

    const pieceFaceId = c.direction === 'out' ? midEdge.leftFace : midEdge.rightFace;
    const otherFaceId = c.direction === 'out' ? midEdge.rightFace : midEdge.leftFace;
    const face = this.faces[pieceFaceId];
    if (!face) { openPath.remove(); cleanup(); return; }

    const edgesToRemove: string[] = [];
    let insertIdx = -1;
    let currentIdx = face.edges.findIndex(eRef => {
      const edge = this.edges[eRef.id];
      if (!edge) return false;
      const startNode = eRef.reversed ? edge.toNode : edge.fromNode;
      return startNode === n1;
    });

    if (currentIdx === -1) {
      openPath.remove();
      cleanup();
      return;
    }

    insertIdx = currentIdx;
    let safety = 0;
    while (safety < 1000) {
      safety++;
      const eRef = face.edges[currentIdx];
      edgesToRemove.push(eRef.id);
      const edge = this.edges[eRef.id];
      const endNode = eRef.reversed ? edge.fromNode : edge.toNode;
      if (endNode === n2) break;
      currentIdx = (currentIdx + 1) % face.edges.length;
      if (safety === 1000) console.error('BakeConnector: Infinite loop detected while walking face');
    }

    // Remove old edges from graph (this also removes them from all face lists)
    for (const eid of edgesToRemove) {
      this._removeEdgeFromGraph(eid);
    }

    // Insert connector edge
    const connEdgeId = uid('edge');
    this.edges[connEdgeId] = {
      id: connEdgeId,
      fromNode: n1,
      toNode: n2,
      path: openPath,
      leftFace: pieceFaceId,
      rightFace: otherFaceId,
    };
    if (this.nodes[n1]) this.nodes[n1].incidentEdges.push(connEdgeId);
    if (this.nodes[n2]) this.nodes[n2].incidentEdges.push(connEdgeId);

    // Manually update face lists to include the new edge
    // For the piece face, we insert it where we removed the edges
    if (insertIdx !== -1 && this.faces[pieceFaceId]) {
      this.faces[pieceFaceId].edges.splice(insertIdx, 0, { id: connEdgeId, reversed: false });
    }

    // For the other face, we need to find where it was and insert it in reverse
    if (otherFaceId && this.faces[otherFaceId]) {
      const otherFace = this.faces[otherFaceId];
      const otherIdx = otherFace.edges.findIndex(eRef => {
        const edge = this.edges[eRef.id];
        if (!edge) return false;
        const startNode = eRef.reversed ? edge.toNode : edge.fromNode;
        return startNode === n2;
      });
      if (otherIdx !== -1) {
        otherFace.edges.splice(otherIdx, 0, { id: connEdgeId, reversed: true });
      } else {
        otherFace.edges.push({ id: connEdgeId, reversed: true });
      }
    }

    cleanup();
  }

  /** Bake all connectors and remove them from the connector record. */
  public bakeConnectors(connectors: Record<string, ConnectorV5>): void {
    for (const c of Object.values(connectors)) {
      this.bakeConnector(c);
    }
  }

  // -------------------------------------------------------------------------
  // Face splitting helpers
  // -------------------------------------------------------------------------

  /**
   * Splits a face by inserting a new straight edge between two existing nodes.
   * Returns the ids of the two new faces.
   */
  public splitFace(faceId: string, nodeAId: string, nodeBId: string, pathDataOrPath: string | paper.Path): string[] {
    const face = this.faces[faceId];
    if (!face) return [];

    const newEdgeId = uid('edge');
    const path = typeof pathDataOrPath === 'string' ? new paper.Path(pathDataOrPath) : pathDataOrPath.clone({ insert: false });
    this.edges[newEdgeId] = {
      id: newEdgeId,
      fromNode: nodeAId,
      toNode: nodeBId,
      path,
      leftFace: '',
      rightFace: '',
    };
    this.nodes[nodeAId]?.incidentEdges.push(newEdgeId);
    this.nodes[nodeBId]?.incidentEdges.push(newEdgeId);

    const face1Id = uid('face');
    const face2Id = uid('face');

    const COLORS = ['#e0f2fe', '#dcfce7', '#fef9c3', '#fee2e2', '#ede9fe', '#fce7f3'];
    const used = new Set(Object.values(this.faces).map(f => f.color));
    const pickColor = () => COLORS.find(c => !used.has(c)) ?? face.color;

    const face1Edges = this.traverseFace(newEdgeId, nodeAId, face1Id);
    used.add(face.color);
    const face2Edges = this.traverseFace(newEdgeId, nodeBId, face2Id);

    this.faces[face1Id] = { id: face1Id, edges: face1Edges, color: pickColor(), groupMemberships: [...face.groupMemberships] };
    used.add(this.faces[face1Id].color);
    this.faces[face2Id] = { id: face2Id, edges: face2Edges, color: pickColor(), groupMemberships: [...face.groupMemberships] };

    delete this.faces[faceId];
    return [face1Id, face2Id];
  }

  public splitFaceAtPoints(faceId: string, ptA: Point, ptB: Point): string[] {
    const face = this.faces[faceId];
    if (!face) return [];

    const fPath = buildFacePath(face, this.edges);
    const locA = fPath.getNearestLocation(new paper.Point(ptA.x, ptA.y));
    const locB = fPath.getNearestLocation(new paper.Point(ptB.x, ptB.y));

    // Find which edges these points are on
    const findEdgeAtOffset = (offset: number) => {
      let curr = 0;
      for (const fe of face.edges) {
        const edge = this.edges[fe.id];
        const len = edge.path.length;
        if (offset >= curr && offset <= curr + len) {
          return { edgeId: fe.id, t: (offset - curr) / len };
        }
        curr += len;
      }
      return null;
    };

    const refA = findEdgeAtOffset(locA.offset);
    const refB = findEdgeAtOffset(locB.offset);
    if (!refA || !refB) { fPath.remove(); return []; }

    const nA = this.splitEdgeAtPoint(refA.edgeId, { x: locA.point.x, y: locA.point.y });
    const nB = this.splitEdgeAtPoint(refB.edgeId, { x: locB.point.x, y: locB.point.y });

    const line = new paper.Path.Line(locA.point, locB.point);
    const res = this.splitFace(faceId, nA, nB, line.pathData);
    line.remove();
    fPath.remove();
    return res;
  }

  public getPointAtT(edgeId: string, t: number): Point {
    const edge = this.edges[edgeId];
    if (!edge) return { x: 0, y: 0 };
    const pt = edge.path.length > 0 ? edge.path.getPointAt(t * edge.path.length) : null;
    if (!pt) {
      // Fallback to first or last segment
      if (t <= 0.5) return { x: edge.path.firstSegment.point.x, y: edge.path.firstSegment.point.y };
      return { x: edge.path.lastSegment.point.x, y: edge.path.lastSegment.point.y };
    }
    return { x: pt.x, y: pt.y };
  }

  public rederiveFaces(): void {
    // Simple face derivation: find all cycles
    // For now, we'll just clear and rebuild if it's a simple planar graph
    // But that's hard. Let's just update the face that was modified.
    // Actually, for the debug scenarios, we can just rebuild the whole thing if needed.
  }
  public computeConnectorEndpoints(params: { midEdgeId: string; midT: number; widthPx: number; direction: 'in' | 'out' }): { p1: { edgeId: string, t: number }, p2: { edgeId: string, t: number }, replacedSegment: Array<{ edgeId: string, reversed: boolean }> } {
    const { midEdgeId, midT, widthPx, direction } = params;
    const midEdge = this.edges[midEdgeId];
    if (!midEdge) throw new Error('Edge not found');

    const faceId = direction === 'out' ? midEdge.leftFace : midEdge.rightFace;
    const face = this.faces[faceId];
    if (!face) throw new Error('Face not found');

    const edgePath = midEdge.path.clone({ insert: false });
    const isReversed = face.edges.find(e => e.id === midEdgeId)?.reversed;
    if (isReversed) edgePath.reverse();

    const totalLength = edgePath.length;
    if (totalLength < 0.001) {
      edgePath.remove();
      return { p1: { edgeId: midEdgeId, t: midT }, p2: { edgeId: midEdgeId, t: midT }, replacedSegment: [] };
    }

    // If reversed, the midT on the original edge corresponds to (1 - midT) on the face-traversal path
    const effectiveMidT = isReversed ? 1 - midT : midT;
    const midOffset = effectiveMidT * totalLength;
    const halfWidth = widthPx / 2;

    const p1Offset = midOffset - halfWidth;
    const p2Offset = midOffset + halfWidth;

    const getRefAtOffset = (offset: number): { edgeId: string, t: number } => {
      if (offset >= 0 && offset <= totalLength) {
        const t = offset / totalLength;
        return { edgeId: midEdgeId, t: isReversed ? 1 - t : t };
      }
      // Walk around face
      let currentOffset = offset;
      const faceEdges = face.edges;
      const midIdx = faceEdges.findIndex(e => e.id === midEdgeId);

      if (offset < 0) {
        let idx = midIdx;
        let safety = 0;
        while (currentOffset < 0 && safety < 1000) {
          safety++;
          idx = (idx - 1 + faceEdges.length) % faceEdges.length;
          const edge = this.edges[faceEdges[idx].id];
          const len = edge.path.length;
          if (len < 0.001) continue;
          if (currentOffset + len >= 0) {
            const t = (currentOffset + len) / len;
            return { edgeId: edge.id, t: faceEdges[idx].reversed ? 1 - t : t };
          }
          currentOffset += len;
        }
      } else {
        let idx = midIdx;
        let remaining = offset - totalLength;
        let safety = 0;
        while (remaining > 0 && safety < 1000) {
          safety++;
          idx = (idx + 1) % faceEdges.length;
          const edge = this.edges[faceEdges[idx].id];
          const len = edge.path.length;
          if (len < 0.001) continue;
          if (remaining <= len) {
            const t = remaining / len;
            return { edgeId: edge.id, t: faceEdges[idx].reversed ? 1 - t : t };
          }
          remaining -= len;
        }
      }
      return { edgeId: midEdgeId, t: midT };
    };

    const p1 = getRefAtOffset(p1Offset);
    const p2 = getRefAtOffset(p2Offset);

    // Find replacedSegment
    const replacedSegment: Array<{ edgeId: string, reversed: boolean }> = [];
    const faceEdges = face.edges;
    const midIdx = faceEdges.findIndex(e => e.id === midEdgeId);

    if (p1Offset >= 0 && p2Offset <= totalLength) {
      replacedSegment.push({ edgeId: faceEdges[midIdx].id, reversed: faceEdges[midIdx].reversed });
    } else {
      let startIdx = midIdx;
      let curr = p1Offset;
      while (curr < 0) {
        startIdx = (startIdx - 1 + faceEdges.length) % faceEdges.length;
        const len = this.edges[faceEdges[startIdx].id].path.length;
        curr += len;
      }
      let endIdx = midIdx;
      let rem = p2Offset - totalLength;
      while (rem > 0) {
        endIdx = (endIdx + 1) % faceEdges.length;
        const len = this.edges[faceEdges[endIdx].id].path.length;
        if (rem <= len) break;
        rem -= len;
      }
      
      let i = startIdx;
      while (true) {
        replacedSegment.push({ edgeId: faceEdges[i].id, reversed: faceEdges[i].reversed });
        if (i === endIdx) break;
        i = (i + 1) % faceEdges.length;
      }
    }

    edgePath.remove();
    return { p1, p2, replacedSegment };
  }

  // -------------------------------------------------------------------------
  // Subdivision
  // -------------------------------------------------------------------------

  public subdivideGrid(faceId: string, rows: number, cols: number): void {
    const face = this.faces[faceId];
    if (!face) return;
    const fPath = buildFacePath(face, this.edges);
    const bounds = fPath.bounds;
    const points = generateGridPoints(bounds.width, bounds.height, rows, cols, 0, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    this._subdivideWithPoints(faceId, points);
    fPath.remove();
  }

  public subdivideHex(faceId: string, rows: number, cols: number, jitter: number): void {
    const face = this.faces[faceId];
    if (!face) return;
    const fPath = buildFacePath(face, this.edges);
    const bounds = fPath.bounds;
    const points = generateHexGridPoints(bounds.width, bounds.height, rows, cols, jitter, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    this._subdivideWithPoints(faceId, points);
    fPath.remove();
  }

  public subdivideRandom(faceId: string, count: number, jitter: number): void {
    const face = this.faces[faceId];
    if (!face) return;
    const fPath = buildFacePath(face, this.edges);
    const bounds = fPath.bounds;
    const points = generateRandomPoints(bounds.width, bounds.height, count, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    this._subdivideWithPoints(faceId, points);
    fPath.remove();
  }

  private _subdivideWithPoints(faceId: string, points: Point[]): void {
    const face = this.faces[faceId];
    if (!face) return;
    const fPath = buildFacePath(face, this.edges);
    const bounds = fPath.bounds;

    // Filter points to be inside the face
    const insidePoints = points.filter(p => fPath.contains(new paper.Point(p.x, p.y)));
    // Need at least 2 points for Voronoi to make sense, but we can handle 1 or 0 gracefully
    if (insidePoints.length < 2) { fPath.remove(); return; }

    const delaunay = Delaunay.from(insidePoints.map(p => [p.x, p.y]));
    // Add a small buffer to the bounds to ensure clipping works correctly
    const voronoi = delaunay.voronoi([bounds.x - 1, bounds.y - 1, bounds.x + bounds.width + 1, bounds.y + bounds.height + 1]);

    for (let i = 0; i < insidePoints.length; i++) {
      const cellPolygon = voronoi.cellPolygon(i);
      if (!cellPolygon) continue;

      const cellPath = new paper.Path();
      cellPolygon.forEach(p => cellPath.add(new paper.Point(p[0], p[1])));
      cellPath.closed = true;

      const clipped = fPath.intersect(cellPath) as paper.PathItem;
      if (clipped && !clipped.isEmpty()) {
        // Use a simplified version of spliceWhimsy that doesn't rely on the full whimsy logic
        // but correctly adds the clipped cell boundary to the graph.
        // For now, we'll keep using spliceWhimsy but ensure it's robust.
        this.spliceWhimsy({ 
          id: uid('w'), 
          center: insidePoints[i], 
          rotationDeg: 0, 
          scale: 1, 
          svgData: clipped.pathData, 
          templateId: 'cell' 
        }, clipped);
      }
      cellPath.remove();
      if (clipped) clipped.remove();
    }
    fPath.remove();
  }
}
