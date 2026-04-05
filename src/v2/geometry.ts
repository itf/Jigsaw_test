import paper from 'paper';
import { Point, Area, Connector } from './types';
import { distance, getAngle, rotatePoint } from '../shared/utils';

/** Closed polygon edges as segment pairs (Paper.js path segments are polygon vertices). */
function getClosedPathSegments(path: paper.Path): [paper.Point, paper.Point][] {
  const n = path.segments.length;
  if (n < 2) return [];
  const out: [paper.Point, paper.Point][] = [];
  for (let i = 0; i < n; i++) {
    const a = path.segments[i].point;
    const b = path.segments[(i + 1) % n].point;
    if (a.getDistance(b) > 1e-9) out.push([a.clone(), b.clone()]);
  }
  return out;
}

/** Distance from p to the closed segment [a,b]. */
function distancePointToSegment(p: paper.Point, a: paper.Point, b: paper.Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-14) return p.getDistance(a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * abx;
  const py = a.y + t * aby;
  const dx = p.x - px;
  const dy = p.y - py;
  return Math.sqrt(dx * dx + dy * dy);
}

/** True if p lies on segment [a,b] within tolerance (including endpoints). */
function pointOnSegment(p: paper.Point, a: paper.Point, b: paper.Point, tol: number): boolean {
  return distancePointToSegment(p, a, b) <= tol;
}

function segmentsCollinear(
  a1: paper.Point,
  a2: paper.Point,
  b1: paper.Point,
  b2: paper.Point,
  tol: number
): boolean {
  return distancePointToSegment(b1, a1, a2) < tol && distancePointToSegment(b2, a1, a2) < tol;
}

/** Proper segment–segment intersection (endpoints included). */
function segmentIntersectionProper(
  a1: paper.Point,
  a2: paper.Point,
  b1: paper.Point,
  b2: paper.Point,
  tol: number
): paper.Point | null {
  const x1 = a1.x;
  const y1 = a1.y;
  const x2 = a2.x;
  const y2 = a2.y;
  const x3 = b1.x;
  const y3 = b1.y;
  const x4 = b2.x;
  const y4 = b2.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const px =
    ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
  const py =
    ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;
  const p = new paper.Point(px, py);
  if (!pointOnSegment(p, a1, a2, tol) || !pointOnSegment(p, b1, b2, tol)) return null;
  return p;
}

/** Endpoints of overlap when two collinear segments lie on the same line (or empty). */
function collinearSegmentOverlap(
  a1: paper.Point,
  a2: paper.Point,
  b1: paper.Point,
  b2: paper.Point,
  tol: number
): paper.Point[] {
  if (!segmentsCollinear(a1, a2, b1, b2, tol)) return [];
  const dx = a2.x - a1.x;
  const dy = a2.y - a1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-14) return [];
  const t = (p: paper.Point) => ((p.x - a1.x) * dx + (p.y - a1.y) * dy) / len2;
  const ta0 = 0;
  const ta1 = 1;
  const tbLo = Math.min(t(b1), t(b2));
  const tbHi = Math.max(t(b1), t(b2));
  const lo = Math.max(ta0, tbLo);
  const hi = Math.min(ta1, tbHi);
  if (hi - lo < 1e-4) return [];
  return [
    new paper.Point(a1.x + lo * dx, a1.y + lo * dy),
    new paper.Point(a1.x + hi * dx, a1.y + hi * dy),
  ];
}

function dedupeSharedPoints(points: paper.Point[], tol: number): paper.Point[] {
  const out: paper.Point[] = [];
  for (const p of points) {
    if (!out.some(o => o.getDistance(p) < tol * 0.6)) out.push(p.clone());
  }
  return out;
}

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
 * Hex-style seed layout on a rows×cols lattice within bounds (pointy-top stagger).
 */
export function generateHexGridPoints(
  bounds: { x: number; y: number; width: number; height: number },
  rows: number,
  cols: number,
  jitter: number = 0
): Point[] {
  const points: Point[] = [];
  if (rows < 1 || cols < 1) return points;
  const vertDist = bounds.height / rows;
  const horizDist = bounds.width / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = bounds.x + (c + 0.5) * horizDist;
      let y = bounds.y + (r + 0.5) * vertDist;
      if (c % 2 === 1) y += vertDist / 2;
      x += (Math.random() - 0.5) * jitter * horizDist * 0.15;
      y += (Math.random() - 0.5) * jitter * vertDist * 0.15;
      x = Math.min(bounds.x + bounds.width, Math.max(bounds.x, x));
      y = Math.min(bounds.y + bounds.height, Math.max(bounds.y, y));
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

  // Vertex–vertex matches (shared corners).
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

  // T-junctions / partial overlaps: a vertex of one polygon can lie in the interior of the
  // other’s edge (no matching vertex on the neighbor). Also collect segment–segment
  // crossings and collinear overlaps (shared sub-edges).
  const segsA = getClosedPathSegments(pathA);
  const segsB = getClosedPathSegments(pathB);

  for (const seg of pathA.segments) {
    const v = seg.point;
    for (const [a, b] of segsB) {
      if (pointOnSegment(v, a, b, TOLERANCE)) {
        sharedPoints.push(v.clone());
        break;
      }
    }
  }
  for (const seg of pathB.segments) {
    const v = seg.point;
    for (const [a, b] of segsA) {
      if (pointOnSegment(v, a, b, TOLERANCE)) {
        sharedPoints.push(v.clone());
        break;
      }
    }
  }

  for (const [a1, a2] of segsA) {
    for (const [b1, b2] of segsB) {
      if (segmentsCollinear(a1, a2, b1, b2, TOLERANCE)) {
        const overlap = collinearSegmentOverlap(a1, a2, b1, b2, TOLERANCE);
        for (const p of overlap) sharedPoints.push(p);
      } else {
        const hit = segmentIntersectionProper(a1, a2, b1, b2, TOLERANCE);
        if (hit) sharedPoints.push(hit);
      }
    }
  }

  pathA.remove();
  pathB.remove();

  const unique = dedupeSharedPoints(sharedPoints, TOLERANCE);
  if (unique.length < 2) return null;

  // Use the pair with greatest distance — chord along the shared interface.
  let p1 = unique[0];
  let p2 = unique[1];
  let maxDist = p1.getDistance(p2);

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const d = unique[i].getDistance(unique[j]);
      if (d > maxDist) {
        maxDist = d;
        p1 = unique[i];
        p2 = unique[j];
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
