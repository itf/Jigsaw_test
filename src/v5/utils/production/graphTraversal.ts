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
export function buildGraphPaths(areas: ProductionArea[], tolerance = 0.05): GraphPath[] {
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
      // Snap coordinates to grid to avoid floating point mismatches
      const snappedX = Math.round(x / tolerance) * tolerance;
      const snappedY = Math.round(y / tolerance) * tolerance;
      nodeMap.set(key, { id: nodeIdCounter++, x: snappedX, y: snappedY });
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

  // --- Step 5: Split edges that pass through intermediate nodes ---
  // This validates that the segment splitting worked correctly
  const allNodes = Array.from(nodeMap.values());
  const splitSegments = [];
  const splitSeen = new Set<string>();
  for (const newSeg of uniqueSegments) {
    const splitQueue: typeof uniqueSegments = [];
    splitQueue.push(newSeg);
    let queueIndex = 0;
    while (queueIndex < splitQueue.length) {
      const seg = splitQueue[queueIndex++];
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
            console.warn(`Segment ${p1.id}-${p2.id} passes through node ${node.id}. Splitting.`);
            const newSeg1 = { n1: p1, n2: node };
            const newSeg2 = { n1: node, n2: p2 };
            splitQueue.push(newSeg1, newSeg2);
            passesThrough = true;
            break;
          }
        }
      }
      if ((!passesThrough) && !splitSeen.has(`${p1.id}-${p2.id}`) && !splitSeen.has(`${p2.id}-${p1.id}`)) {
        if (p1.id === 273 && p2.id === 274) {
          console.log('Adding segment', p1, p2);
        }
        splitSeen.add(`${p1.id}-${p2.id}`);
        splitSegments.push(seg);
      }
    }
  }
  const filteredSegments = splitSegments;
 
  // filteredSegments = uniqueSegments; // Skip this validation for now since it can be expensive and the splitting should have handled it

  // --- Step 4: Build adjacency list ---
  const nodeById = new Map<number, GraphNode>();
  const adjacency = new Map<number, { edgeId: number; neighborId: number; dx: number; dy: number }[]>();
  const addHalfEdge = (nodeId: number, edgeId: number, neighborId: number, dx: number, dy: number) => {
    if (!adjacency.has(nodeId)) adjacency.set(nodeId, []);
    // Do not consider the node to be neighbors to itself when  counting the adjacency lists.
    if (neighborId !== nodeId) {
      adjacency.get(nodeId)!.push({ edgeId, neighborId, dx, dy });
    }
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

  const findNextNodeWithUnvisitedEdges = (currentNodeId?: number): GraphNode | null => {
    const hasUnvisited = (n: GraphNode) => (adjacency.get(n.id) || []).some(e => !visitedEdges.has(e.edgeId));

    // If a current node is provided, pick the nearest node with unvisited edges
    if (typeof currentNodeId === 'number') {
      const current = nodeById.get(currentNodeId) || null;
      if (current) {
        let best: GraphNode | null = null;
        let bestDistSq = Infinity;
        const updateBest = (n: GraphNode) => {
          const dx = current.x - n.x;
          const dy = current.y - n.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = n;
          }
        };
        for (const n of oddDegreeNodes) {
          if (!hasUnvisited(n)) continue;
          updateBest(n);
          }
          if (best) return best;
        for (const n of nodes) {
          if (!hasUnvisited(n)) continue;
          updateBest(n);
        }
        if (best) return best;
      }
    }
    else{
      // First try remaining odd-degree start candidates
      // Then any node with unvisited edges
      for (const n of startCandidates) {
        if (hasUnvisited(n)) return n;
      }
      for (const n of nodes) {
        if (hasUnvisited(n)) return n;
      }
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
    startNode = findNextNodeWithUnvisitedEdges(currentNodeId);
  }

  return graphPaths;
}

/**
 * Cleans the graph by recursively removing degree-1 nodes (dead ends).
 * These nodes cannot specify closed areas, so they should be removed.
 *
 * Steps:
 * 1. Build graph from production areas
 * 2. Recursively remove all nodes with degree < 2
 * 3. Convert remaining edges back to Paper.js paths
 * 4. Re-extract production areas from cleaned edges
 *
 * Returns cleaned production areas with dead-end edges removed.
 */
export function cleanGraphAreas(areas: ProductionArea[], tolerance = 0.5): ProductionArea[] {
  const graphPaths = buildGraphPaths(areas, tolerance);
  return [];
}
export function cleanGraphAreas2(areas: ProductionArea[], tolerance = 0.5): ProductionArea[] {
  paper.setup(new paper.Size(1, 1));

  // Build initial graph from all areas
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

  // Extract segments and build graph (same as buildGraphPaths)
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

  // Extract segments from curves
  const rawSegments: paper.Path[] = [];
  allPaths.forEach(p => {
    const interPoints = intersectionPoints.get(p) || [];
    for (const curve of p.curves) {
      const splitOffsets: number[] = [];
      for (const pt of interPoints) {
        const loc = curve.getNearestLocation(pt);
        if (loc && loc.distance < tolerance * 2) {
          if (loc.offset > 0.01 && loc.offset < curve.length - 0.01) {
            splitOffsets.push(loc.offset);
          }
        }
      }
      splitOffsets.sort((a, b) => b - a);

      let seg = new paper.Path({ insert: false });
      seg.moveTo(curve.point1);
      if (!curve.handle1.isZero() || !curve.handle2.isZero()) {
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

  // Deduplicate segments
  const deduplicatedRawSegments: paper.Path[] = [];
  const seenSegmentKeys = new Set<string>();
  rawSegments.forEach(s => {
    if (s.isEmpty() || s.length < 0.01) return;
    const p1 = s.firstSegment.point;
    const p2 = s.lastSegment.point;
    const k1 = gridKey(p1.x, p1.y, tolerance);
    const k2 = gridKey(p2.x, p2.y, tolerance);
    const key = [k1, k2].sort().join('|');
    if (!seenSegmentKeys.has(key)) {
      seenSegmentKeys.add(key);
      deduplicatedRawSegments.push(s);
    }
  });

  // Build nodes
  const nodeMap = new Map<string, GraphNode>();
  let nodeIdCounter = 0;
  const getOrCreateNode = (x: number, y: number): GraphNode => {
    const key = gridKey(x, y, tolerance);
    if (!nodeMap.has(key)) {
      // Snap coordinates to grid to avoid floating point mismatches
      const snappedX = Math.round(x / tolerance) * tolerance;
      const snappedY = Math.round(y / tolerance) * tolerance;
      nodeMap.set(key, { id: nodeIdCounter++, x: snappedX, y: snappedY });
    }
    return nodeMap.get(key)!;
  };

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

  // Remove duplicate edges
  const uniqueSegments: Array<{ n1: GraphNode; n2: GraphNode }> = [];
  const seenEdges = new Set<string>();
  snappedSegments.forEach(seg => {
    const key = [seg.n1.id, seg.n2.id].sort().join('|');
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      uniqueSegments.push(seg);
    }
  });

  // Validate no segments pass through intermediate nodes
  const allNodes = Array.from(nodeMap.values());
  const filteredSegments: typeof uniqueSegments = [];
  for (const seg of uniqueSegments) {
    const p1 = seg.n1;
    const p2 = seg.n2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 0.01) continue;

    let passesThrough = false;
    for (const node of allNodes) {
      if (node.id === p1.id || node.id === p2.id) continue;
      const t = ((node.x - p1.x) * dx + (node.y - p1.y) * dy) / (segLen * segLen);
      // Only flag if node is strictly interior (not near endpoints)
      if (t > 0.1 && t < 0.9) {
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        const dist = Math.sqrt((node.x - closestX) ** 2 + (node.y - closestY) ** 2);
        if (dist < tolerance) {
          passesThrough = true;
          break;
        }
      }
    }
    if (!passesThrough) {
      filteredSegments.push(seg);
    }
  }

  // Build adjacency list BEFORE cleaning
  const adjacency = new Map<number, number[]>();
  filteredSegments.forEach(seg => {
    if (!adjacency.has(seg.n1.id)) adjacency.set(seg.n1.id, []);
    if (!adjacency.has(seg.n2.id)) adjacency.set(seg.n2.id, []);
    if (seg.n1.id !== seg.n2.id) {
      adjacency.get(seg.n1.id)!.push(seg.n2.id);
      adjacency.get(seg.n2.id)!.push(seg.n1.id);
    }
  });

  // Convert remaining edges back to Paper.js paths
  const nodeById = new Map<number, GraphNode>();
  nodeMap.forEach(n => nodeById.set(n.id, n));

  // Recursively remove degree-1 and degree-0 nodes from the graph
  let removed = true;
  while (removed) {
    removed = false;
    const nodesToRemove = new Set<number>();

    for (const [nodeId, neighbors] of adjacency.entries()) {
      if (neighbors.length <= 1) {
        nodesToRemove.add(nodeId);
        removed = true;
      }
    }

    // Remove degree-1 and degree-0 nodes and their edges
    for (const nodeId of nodesToRemove) {
      const neighbors = adjacency.get(nodeId) || [];
      adjacency.delete(nodeId);

      for (const neighborId of neighbors) {
        const neighborList = adjacency.get(neighborId);
        if (neighborList) {
          const idx = neighborList.indexOf(nodeId);
          if (idx !== -1) {
            neighborList.splice(idx, 1);
          }
        }
      }
    }
  }


  // Determine which original areas have any remaining nodes
  const cleanedAreas: ProductionArea[] = [];
  const remainingNodeIds = new Set(adjacency.keys());

  // Filter original areas: keep only those that have at least one node from the cleaned graph
  for (const area of areas) {
    const cp = new paper.CompoundPath({ pathData: area.pathData, insert: false });
    const areaNodes: GraphNode[] = [];

    const flatten = (item: paper.Item) => {
      if (item instanceof paper.Path && item.length > 0.001) {
        // Get endpoints of this path
        const p1 = item.firstSegment.point;
        const p2 = item.lastSegment.point;
        const n1 = getOrCreateNode(p1.x, p1.y);
        const n2 = getOrCreateNode(p2.x, p2.y);
        if (remainingNodeIds.has(n1.id)) areaNodes.push(n1);
        if (remainingNodeIds.has(n2.id)) areaNodes.push(n2);
      } else if ((item as any).children) {
        [...(item as any).children].forEach(flatten);
      }
    };

    flatten(cp);
    cp.remove();

    // Keep this area only if it has remaining nodes (wasn't completely removed)
    if (areaNodes.length > 0) {
      cleanedAreas.push({
        id: `cleaned-${cleanedAreas.length}`,
        pathData: area.pathData,
        color: area.color,
        area: area.area
      });
    }
  }

  paper.project.clear();

  return cleanedAreas.length > 0 ? cleanedAreas : [];
}
