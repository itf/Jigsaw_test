import paper from 'paper';
import { Point, Area, Connector } from './types';
import { distance, getAngle, rotatePoint } from '../shared/utils';

/**
 * Generates points in a grid pattern within a rectangle.
 */
export function generateGridPoints(width: number, height: number, rows: number, cols: number, jitter: number = 0, bounds?: { x: number, y: number, width: number, height: number }): Point[] {
  const points: Point[] = [];
  const targetWidth = bounds ? bounds.width : width;
  const targetHeight = bounds ? bounds.height : height;
  const offsetX = bounds ? bounds.x : 0;
  const offsetY = bounds ? bounds.y : 0;
  
  const dx = targetWidth / cols;
  const dy = targetHeight / rows;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offsetX + (c + 0.5) * dx + (Math.random() - 0.5) * jitter * dx;
      const y = offsetY + (r + 0.5) * dy + (Math.random() - 0.5) * jitter * dy;
      points.push({ x, y });
    }
  }
  return points;
}

/**
 * Generates points in a hexagonal pattern.
 */
export function generateHexPoints(width: number, height: number, size: number, jitter: number = 0): Point[] {
  const points: Point[] = [];
  const h = size * Math.sqrt(3);
  const w = size * 2;
  const vertDist = h;
  const horizDist = w * 0.75;
  
  const cols = Math.ceil(width / horizDist) + 1;
  const rows = Math.ceil(height / vertDist) + 1;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = c * horizDist;
      let y = r * vertDist;
      if (c % 2 === 1) y += vertDist / 2;
      
      x += (Math.random() - 0.5) * jitter * size;
      y += (Math.random() - 0.5) * jitter * size;
      
      if (x >= 0 && x <= width && y >= 0 && y <= height) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

/**
 * Finds the shared boundary between two areas.
 * Returns a PathItem representing the shared segments.
 */
export function getSharedPerimeter(areaA: Area, areaB: Area): paper.PathItem | null {
  // Quick bounding-box pre-check
  const pathA = new paper.Path(areaA.boundary);
  const pathB = new paper.Path(areaB.boundary);
  const expandedA = pathA.bounds.clone().expand(2);
  if (!expandedA.intersects(pathB.bounds)) {
    pathA.remove();
    pathB.remove();
    return null;
  }

  // Find vertices that appear in both boundaries (within tolerance).
  // This is robust against the Paper.js "double-edge sliver" problem: instead of
  // relying on path intersection (which returns an ambiguously-oriented closed sliver),
  // we just locate the two shared corner points directly.
  const TOLERANCE = 1.5;
  const sharedPoints: paper.Point[] = [];

  for (const segA of pathA.segments) {
    for (const segB of pathB.segments) {
      if (segA.point.getDistance(segB.point) < TOLERANCE) {
        sharedPoints.push(segA.point.clone());
        break;
      }
    }
  }

  pathA.remove();
  pathB.remove();

  if (sharedPoints.length < 2) return null;

  // If more than 2 vertices matched (e.g. compound whimsy boundaries), use the
  // pair with the greatest distance — that is the actual shared edge.
  let p1 = sharedPoints[0];
  let p2 = sharedPoints[1];
  let maxDist = p1.getDistance(p2);

  for (let i = 0; i < sharedPoints.length; i++) {
    for (let j = i + 1; j < sharedPoints.length; j++) {
      const d = sharedPoints[i].getDistance(sharedPoints[j]);
      if (d > maxDist) {
        maxDist = d;
        p1 = sharedPoints[i];
        p2 = sharedPoints[j];
      }
    }
  }

  if (maxDist < 1) return null;

  // Return a clean, open straight path from p1 → p2.
  // getPointAtU on this path is a simple arc-length fraction of a straight line,
  // so u=0 → p1, u=0.5 → midpoint, u=1 → p2.
  const result = new paper.Path();
  result.add(p1);
  result.add(p2);
  return result;
}

/**
 * Gets the point and normal at a normalized position 'u' along a path.
 */
export function getPointAtU(path: paper.PathItem, u: number): { point: paper.Point; normal: paper.Point } | null {
  if (!path || path.isEmpty()) return null;
  
  // Cast to Path or CompoundPath to access length and getPointAt
  const p = path as paper.Path;
  const length = p.length;
  const offset = u * length;
  const point = p.getPointAt(offset);
  const normal = p.getNormalAt(offset);
  
  return { point, normal };
}

/**
 * Generates a connector stamp (the shape to union/subtract).
 */
export function createConnectorStamp(
  anchor: paper.Point,
  normal: paper.Point,
  type: string,
  size: number,
  midpointOffset?: paper.Point, // From the solver
  overlap: number = 0.5 // Overlap to prevent gaps in boolean
): paper.Path {
  const angle = normal.angle;
  const stamp = new paper.Path();
  
  // Basic Tab shape
  if (type === 'TAB') {
    const neckWidth = size * 0.6;
    const headWidth = size * 1.2;
    const depth = size * 1.0;
    
    // Points relative to anchor (0,0) pointing along normal (depth)
    // If midpointOffset is provided, we "bend" the neck
    const p0 = new paper.Point(-overlap, -neckWidth / 2);
    const p1 = midpointOffset ? midpointOffset.add(new paper.Point(-neckWidth / 2, 0)) : new paper.Point(depth * 0.4, -neckWidth / 2);
    const p2 = midpointOffset ? midpointOffset.add(new paper.Point(-headWidth / 2, depth * 0.3)) : new paper.Point(depth * 0.7, -headWidth / 2);
    const p3 = new paper.Point(depth, 0);
    const p4 = midpointOffset ? midpointOffset.add(new paper.Point(headWidth / 2, depth * 0.3)) : new paper.Point(depth * 0.7, headWidth / 2);
    const p5 = midpointOffset ? midpointOffset.add(new paper.Point(neckWidth / 2, 0)) : new paper.Point(depth * 0.4, neckWidth / 2);
    const p6 = new paper.Point(-overlap, neckWidth / 2);

    stamp.add(p0);
    stamp.cubicCurveTo(p1, p2, p3);
    stamp.cubicCurveTo(p4, p5, p6);
    stamp.closePath();
  } else {
    // Fallback square
    stamp.add(new paper.Point(-overlap, -size/2));
    stamp.lineTo(new paper.Point(size, -size/2));
    stamp.lineTo(new paper.Point(size, size/2));
    stamp.lineTo(new paper.Point(-overlap, size/2));
    stamp.closePath();
  }

  // Rotate and translate to anchor
  stamp.rotate(angle, new paper.Point(0, 0));
  stamp.translate(anchor);
  
  return stamp;
}

/**
 * Simplified Collision Solver
 * Detects overlaps and marks connectors for deletion if they collide.
 * TODO: Implement the full Elastic Rod Solver with bending and shifting.
 */
export function resolveCollisions(connectors: Connector[], areas: Record<string, Area>): Connector[] {
  const resolved = [...connectors];
  
  // 1. Calculate bounding boxes for all connectors
  // We'll use a temporary paper.js project for this
  const stamps = resolved.map(c => {
    if (c.isDormant) return null;
    
    const areaA = areas[c.areaAId];
    const areaB = areas[c.areaBId];
    const shared = getSharedPerimeter(areaA, areaB);
    if (!shared) return null;
    
    const pos = getPointAtU(shared, c.u);
    shared.remove();
    if (!pos) return null;
    
    // Use isFlipped to determine direction
    const normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
    const stamp = createConnectorStamp(pos.point, normal, c.type, c.size);
    const bounds = stamp.bounds.clone();
    stamp.remove();
    
    return { id: c.id, bounds };
  });

  // 2. Check for overlaps
  for (let i = 0; i < stamps.length; i++) {
    const sA = stamps[i];
    if (!sA) continue;
    
    for (let j = i + 1; j < stamps.length; j++) {
      const sB = stamps[j];
      if (!sB) continue;
      
      if (sA.bounds.intersects(sB.bounds)) {
        // Collision detected!
        // Arbitrarily remove the second one for now
        const connectorB = resolved.find(c => c.id === sB.id);
        if (connectorB) {
          connectorB.isDeleted = true;
          console.warn(`Collision detected between ${sA.id} and ${sB.id}. Deleting ${sB.id}.`);
        }
      }
    }
  }
  
  return resolved;
}
