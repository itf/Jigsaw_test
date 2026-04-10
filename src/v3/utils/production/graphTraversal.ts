import paper from 'paper';
import { ProductionArea } from './processProduction';

export interface GraphNode {
  id: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: number;
  fromId: number;
  toId: number;
}

export interface GraphPath {
  id: number;
  points: [number, number][];
  svgPathData: string;
  color: string;
}

const DIRECTION_BREAK_THRESHOLD_DEG = 135;

const GRAPH_PATH_COLORS = [
  '#e63946', '#2a9d8f', '#e9c46a', '#457b9d', '#f4a261',
  '#6a4c93', '#1982c4', '#8ac926', '#ff595e', '#6a0572',
  '#ffca3a', '#06d6a0'
];

function gridKey(x: number, y: number, tolerance: number): string {
  return `${Math.round(x / tolerance)},${Math.round(y / tolerance)}`;
}

function angleBetweenDeg(dx1: number, dy1: number, dx2: number, dy2: number): number {
  const dot = dx1 * dx2 + dy1 * dy2;
  const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos) * (180 / Math.PI);
}

/**
 * Builds direction-aware continuous graph paths from production areas.
 *
 * 1. Combines all piece pathData into a CompoundPath and uses Paper.js
 *    self-intersection detection to subdivide at all crossing points.
 * 2. Deduplicates segments by sorted endpoint grid-key (removes double edges
 *    at shared piece boundaries).
 * 3. Traverses the resulting graph greedily, preferring edges that continue
 *    in the same direction. Starts a new path on sharp direction changes or
 *    dead ends.
 */
export function buildGraphPaths(areas: ProductionArea[], tolerance = 0.5): GraphPath[] {
  paper.setup(new paper.Size(1, 1));

  // --- Step 1: Combine all paths and subdivide at intersections ---

  // Load each area as individual Paper.js paths (not a single CompoundPath,
  // since getIntersections needs to find crossings between sub-paths)
  const allPaths: paper.Path[] = [];

  areas.forEach(area => {
    const cp = new paper.CompoundPath({ pathData: area.pathData, insert: false });
    const flatten = (item: paper.Item) => {
      if (item instanceof paper.Path && item.length > 0.001) {
        allPaths.push(item.clone() as paper.Path);
      } else if ((item as any).children) {
        [...(item as any).children].forEach(flatten);
      }
    };
    flatten(cp);
    cp.remove();
  });

  // Find intersections between all path pairs
  const intersectionPoints = new Map<paper.Path, paper.Point[]>();
  for (let i = 0; i < allPaths.length; i++) {
    for (let j = i + 1; j < allPaths.length; j++) {
      const inters = allPaths[i].getIntersections(allPaths[j]);
      inters.forEach(inter => {
        if (!intersectionPoints.has(allPaths[i])) intersectionPoints.set(allPaths[i], []);
        if (!intersectionPoints.has(allPaths[j])) intersectionPoints.set(allPaths[j], []);
        intersectionPoints.get(allPaths[i])!.push(inter.point);
        intersectionPoints.get(allPaths[j])!.push(inter.point);
      });
    }
  }

  // Extract segments curve-by-curve from each path.
  // Each curve (edge) of each closed piece boundary becomes its own segment.
  // If an intersection point falls within a curve, that curve is split at that point.
  // This avoids Paper.js splitAt quirks with closed paths.
  const rawSegments: paper.Path[] = [];
  allPaths.forEach(p => {
    const interPoints = intersectionPoints.get(p) || [];

    for (const curve of p.curves) {
      // Find intersection offsets within this specific curve
      const splitOffsets: number[] = [];
      for (const pt of interPoints) {
        const loc = curve.getNearestLocation(pt);
        if (loc && loc.distance < tolerance * 2) {
          if (loc.offset > 0.01 && loc.offset < curve.length - 0.01) {
            splitOffsets.push(loc.offset);
          }
        }
      }
      splitOffsets.sort((a, b) => b - a); // descending for safe splitAt

      // Build a path from this curve's endpoints
      let seg = new paper.Path({ insert: false });
      seg.moveTo(curve.point1);
      if (!curve.handle1.isZero() || !curve.handle2.isZero()) {
        // Bezier curve — use cubicCurveTo
        seg.cubicCurveTo(
          curve.point1.add(curve.handle1),
          curve.point2.add(curve.handle2),
          curve.point2
        );
      } else {
        seg.lineTo(curve.point2);
      }

      for (const o of splitOffsets) {
        if (o > 0.01 && o < seg.length - 0.01) {
          const second = seg.splitAt(o);
          if (second) rawSegments.push(second as paper.Path);
        }
      }
      rawSegments.push(seg);
    }
  });

  // --- Step 2: Deduplicate collinear overlapping segments (shared boundaries) ---
  // Two segments on the same line that overlap should be merged or kept once only
  const deduplicatedRawSegments: paper.Path[] = [];
  const seenSegmentKeys = new Set<string>();

  rawSegments.forEach(s => {
    if (s.isEmpty() || s.length < 0.01) return;
    const p1 = s.firstSegment.point;
    const p2 = s.lastSegment.point;

    // Create a key based on rounded endpoints (using graph tolerance)
    // to detect segments that are on the same line
    const k1 = gridKey(p1.x, p1.y, tolerance);
    const k2 = gridKey(p2.x, p2.y, tolerance);
    const key = [k1, k2].sort().join('|');

    if (!seenSegmentKeys.has(key)) {
      seenSegmentKeys.add(key);
      deduplicatedRawSegments.push(s);
    }
  });

  // --- Step 3: Build nodes and snap segments to them ---
  const nodeMap = new Map<string, GraphNode>();
  let nodeIdCounter = 0;

  const getOrCreateNode = (x: number, y: number): GraphNode => {
    const key = gridKey(x, y, tolerance);
    if (!nodeMap.has(key)) {
      nodeMap.set(key, { id: nodeIdCounter++, x, y });
    }
    return nodeMap.get(key)!;
  };

  // Snap all segment endpoints to nodes
  const snappedSegments: Array<{ n1: GraphNode; n2: GraphNode }> = [];
  deduplicatedRawSegments.forEach(s => {
    const p1 = s.firstSegment.point;
    const p2 = s.lastSegment.point;
    const n1 = getOrCreateNode(p1.x, p1.y);
    const n2 = getOrCreateNode(p2.x, p2.y);
    if (n1.id !== n2.id) {
      snappedSegments.push({ n1, n2 });
    }
  });

  // --- Step 4: Remove duplicate node-ID pairs (same edge added twice) ---
  const uniqueSegments: Array<{ n1: GraphNode; n2: GraphNode }> = [];
  const seenEdges = new Set<string>();

  snappedSegments.forEach(seg => {
    const key = [seg.n1.id, seg.n2.id].sort().join('|');
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      uniqueSegments.push(seg);
    }
  });

  // --- Step 5: Remove edges that pass through intermediate nodes ---
  // This validates that the segment splitting worked correctly
  const allNodes = Array.from(nodeMap.values());
  const filteredSegments: typeof uniqueSegments = [];

  for (const seg of uniqueSegments) {
    const p1 = seg.n1;
    const p2 = seg.n2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (segLen < 0.01) continue; // Skip zero-length segments

    let passesThrough = false;

    for (const node of allNodes) {
      if (node.id === p1.id || node.id === p2.id) continue;

      // Check if node lies on segment (within tolerance)
      const t = ((node.x - p1.x) * dx + (node.y - p1.y) * dy) / (segLen * segLen);
      if (t > 0.01 && t < 0.99) {
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        const dist = Math.sqrt((node.x - closestX) ** 2 + (node.y - closestY) ** 2);
        if (dist < tolerance) {
          console.warn(`Segment ${p1.id}-${p2.id} passes through node ${node.id}. Skipping.`);
          passesThrough = true;
          break;
        }
      }
    }

    if (!passesThrough) {
      filteredSegments.push(seg);
    }
  }

  // --- Step 4: Build adjacency list ---
  const nodeById = new Map<number, GraphNode>();
  const adjacency = new Map<number, { edgeId: number; neighborId: number; dx: number; dy: number }[]>();
  const addHalfEdge = (nodeId: number, edgeId: number, neighborId: number, dx: number, dy: number) => {
    if (!adjacency.has(nodeId)) adjacency.set(nodeId, []);
    adjacency.get(nodeId)!.push({ edgeId, neighborId, dx, dy });
  };

  let edgeIdCounter = 0;
  filteredSegments.forEach(seg => {
    const edgeId = edgeIdCounter++;
    const dx = seg.n2.x - seg.n1.x;
    const dy = seg.n2.y - seg.n1.y;
    addHalfEdge(seg.n1.id, edgeId, seg.n2.id, dx, dy);
    addHalfEdge(seg.n2.id, edgeId, seg.n1.id, -dx, -dy);
  });

  paper.project.clear();

  // --- Validation: Check that no segment passes through another segment's intermediate nodes ---
  const nodes = Array.from(nodeMap.values());
  const validateSegmentSplits = () => {
    for (let i = 0; i < filteredSegments.length; i++) {
      const seg = filteredSegments[i];
      const p1 = seg.n1;
      const p2 = seg.n2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 0.01) continue;

      for (const node of nodes) {
        if (node.id === p1.id || node.id === p2.id) continue;
        // Check if node lies on segment
        const t = ((node.x - p1.x) * dx + (node.y - p1.y) * dy) / (segLen * segLen);
        if (t > 0.01 && t < 0.99) {
          const closestX = p1.x + t * dx;
          const closestY = p1.y + t * dy;
          const dist = Math.sqrt((node.x - closestX) ** 2 + (node.y - closestY) ** 2);
          if (dist < tolerance) {
            console.warn(`Segment ${p1.id}-${p2.id} passes through node ${node.id}. Should have been split.`);
          }
        }
      }
    }
  };
  validateSegmentSplits();

  // --- Step 4: Direction-aware greedy traversal ---
  const visitedEdges = new Set<number>();
  const graphPaths: GraphPath[] = [];

  // Rebuild nodeById after all nodes are created
  nodeMap.forEach(n => nodeById.set(n.id, n));
  const oddDegreeNodes = nodes.filter(n => ((adjacency.get(n.id) || []).length % 2) === 1);
  const startCandidates = oddDegreeNodes.length > 0 ? oddDegreeNodes : nodes;

  const findNextNodeWithUnvisitedEdges = (): GraphNode | null => {
    // First try remaining odd-degree start candidates
    for (const n of startCandidates) {
      const edges = adjacency.get(n.id) || [];
      if (edges.some(e => !visitedEdges.has(e.edgeId))) return n;
    }
    // Then any node with unvisited edges
    for (const n of nodes) {
      const edges = adjacency.get(n.id) || [];
      if (edges.some(e => !visitedEdges.has(e.edgeId))) return n;
    }
    return null;
  };

  // Simple greedy traversal: at each step pick the neighbor with smallest angle,
  // when stuck find the nearest node with unvisited edges and jump to it (start new path)
  let startNode = findNextNodeWithUnvisitedEdges();
  while (startNode !== null) {
    const points: [number, number][] = [[startNode.x, startNode.y]];
    let currentNodeId = startNode.id;
    let dirDx: number | null = null;
    let dirDy: number | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidates = (adjacency.get(currentNodeId) || []).filter(e => !visitedEdges.has(e.edgeId));
      if (candidates.length === 0) {
        // Dead end: save this path and jump to nearest node with unvisited edges
        break;
      }

      // Pick edge with smallest angle to current direction
      let bestEdge = candidates[0];
      if (dirDx !== null && dirDy !== null) {
        let bestAngle = angleBetweenDeg(dirDx, dirDy, candidates[0].dx, candidates[0].dy);
        for (let i = 1; i < candidates.length; i++) {
          const angle = angleBetweenDeg(dirDx, dirDy, candidates[i].dx, candidates[i].dy);
          if (angle < bestAngle) {
            bestAngle = angle;
            bestEdge = candidates[i];
          }
        }
      }

      visitedEdges.add(bestEdge.edgeId);
      const neighborNode = nodeById.get(bestEdge.neighborId)!;
      points.push([neighborNode.x, neighborNode.y]);
      dirDx = bestEdge.dx;
      dirDy = bestEdge.dy;
      currentNodeId = bestEdge.neighborId;
    }

    // Save this path if it has at least 2 points
    if (points.length >= 2) {
      const color = GRAPH_PATH_COLORS[graphPaths.length % GRAPH_PATH_COLORS.length];
      const svgPathData = `M ${points[0][0]} ${points[0][1]}` +
        points.slice(1).map(([x, y]) => ` L ${x} ${y}`).join('');
      graphPaths.push({ id: graphPaths.length, points, svgPathData, color });
    }

    // Find next node with unvisited edges to continue
    startNode = findNextNodeWithUnvisitedEdges();
  }

  return graphPaths;
}
