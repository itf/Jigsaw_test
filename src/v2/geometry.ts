import paper from 'paper';
import { Point, Area, Connector } from './types';
import { distance, getAngle, rotatePoint } from '../shared/utils';
import { pathItemFromBoundaryData } from './paperProject';

/**
 * `CompoundPath` (multi-contour boundaries, e.g. piece with a hole) has no iterable root `.segments`;
 * shared-perimeter logic runs on each child `Path`.
 */
function contourPathsForSegments(p: paper.PathItem): paper.Path[] {
  if (p instanceof paper.CompoundPath) {
    const out: paper.Path[] = [];
    for (let i = 0; i < p.children.length; i++) {
      const ch = p.children[i];
      if (ch instanceof paper.Path) out.push(ch);
    }
    return out.length > 0 ? out : [];
  }
  return [p as paper.Path];
}

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
      // Use high precision for grid centers to ensure Voronoi produces clean squares
      const baseX = offsetX + (c + 0.5) * dx;
      const baseY = offsetY + (r + 0.5) * dy;
      
      const x = baseX + (Math.random() - 0.5) * jitter * dx;
      const y = baseY + (Math.random() - 0.5) * jitter * dy;
      
      points.push({ 
        x: Math.round(x * 1000) / 1000, 
        y: Math.round(y * 1000) / 1000 
      });
    }
  }
  return points;
}

const SUBDIVIDE_BLEED_EPS = 0.75;

/**
 * When merging multiple leaf boundaries for SUBDIVIDE, Paper.js often returns a compound path whose
 * bounds are the full puzzle rectangle but the geometry still has a hole (e.g. four frame pieces
 * around a whimsy cut without the disc in the merge set). Voronoi seeds use the outer bounds, but
 * intersect(cell, clip) then clips to a ring — cells are not equal quarters. If the union clearly
 * bleeds the canvas but net area is below the full rectangle, use a solid outer rectangle as clip.
 */
export function resolveSubdivideClipBoundary(
  cleaned: paper.PathItem,
  canvasW: number,
  canvasH: number
): { clipPathData: string; bounds: { x: number; y: number; width: number; height: number } } {
  const b = cleaned.bounds;
  const fullArea = canvasW * canvasH;
  const bleedsCanvas =
    Math.abs(b.x) < SUBDIVIDE_BLEED_EPS &&
    Math.abs(b.y) < SUBDIVIDE_BLEED_EPS &&
    Math.abs(b.width - canvasW) < SUBDIVIDE_BLEED_EPS &&
    Math.abs(b.height - canvasH) < SUBDIVIDE_BLEED_EPS;

  let netArea = 0;
  if (cleaned instanceof paper.CompoundPath) {
    for (let i = 0; i < cleaned.children.length; i++) {
      const ch = cleaned.children[i];
      if (ch instanceof paper.Path) netArea += ch.area;
    }
  } else if (cleaned instanceof paper.Path) {
    netArea = cleaned.area;
  }

  const hasSignificantHole = bleedsCanvas && Math.abs(netArea) < fullArea * 0.99;

  if (hasSignificantHole) {
    return {
      clipPathData: `M 0 0 L ${canvasW} 0 L ${canvasW} ${canvasH} L 0 ${canvasH} Z`,
      bounds: { x: 0, y: 0, width: canvasW, height: canvasH },
    };
  }

  return {
    clipPathData: cleaned.pathData,
    bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
  };
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
function sharedPerimeterFromCurveIntersections(areaA: Area, areaB: Area, tol: number): paper.Path | null {
  const topA = pathItemFromBoundaryData(areaA.boundary);
  const topB = pathItemFromBoundaryData(areaB.boundary);
  const pathsA = contourPathsForSegments(topA);
  const pathsB = contourPathsForSegments(topB);
  pathsA.forEach(p => p.flatten(2));
  pathsB.forEach(p => p.flatten(2));
  const locs: paper.CurveLocation[] = [];
  for (const pa of pathsA) {
    for (const pb of pathsB) {
      locs.push(...pa.getIntersections(pb));
    }
  }
  topA.remove();
  topB.remove();
  if (locs.length < 2) return null;
  const pts = locs.map(l => l.point);
  const unique = dedupeSharedPoints(pts, tol);
  if (unique.length < 2) return null;
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
  const result = new paper.Path();
  result.add(p1);
  result.add(p2);
  return result;
}

/**
 * Gets the total offset of a location along a PathItem (handles CompoundPath).
 */
export function getTotalOffset(path: paper.PathItem, loc: paper.CurveLocation | null): number {
  if (!loc) return 0;
  if (path instanceof paper.Path) return loc.offset;
  if (path instanceof paper.CompoundPath) {
    let total = 0;
    const children = path.children.filter(c => c instanceof paper.Path) as paper.Path[];
    for (const child of children) {
      if (child === loc.path) return total + loc.offset;
      total += child.length;
    }
  }
  return loc.offset;
}

/**
 * Splits a path into multiple segments at the given points.
 */
function splitPathAtPoints(path: paper.Path, points: paper.Point[], tol: number): paper.Path[] {
  const temp = path.clone() as paper.Path;
  let locs = points
    .map(pt => temp.getNearestLocation(pt))
    .filter(l => l !== null)
    .sort((a, b) => a.offset - b.offset);

  // Dedupe locations by offset
  const uniqueLocs: paper.CurveLocation[] = [];
  for (const loc of locs) {
    if (!uniqueLocs.some(ul => Math.abs(ul.offset - loc.offset) < tol)) {
      uniqueLocs.push(loc);
    }
  }

  if (temp.closed && uniqueLocs.length > 0) {
    // Open the path at the first split point
    const first = uniqueLocs[0];
    temp.splitAt(first);
    // Re-calculate locations on the now-open path
    const pts = uniqueLocs.map(l => l.point);
    const newLocs = pts
      .map(pt => temp.getNearestLocation(pt))
      .filter(l => l !== null)
      .sort((a, b) => b.offset - a.offset); // Descending for splitting open path
    
    const parts: paper.Path[] = [];
    let current = temp;
    for (const loc of newLocs) {
      if (loc.offset < 0.01 || loc.offset > current.length - 0.01) continue;
      const tail = current.splitAt(loc);
      if (tail) parts.push(tail);
    }
    parts.push(current);
    return parts;
  } else {
    // Already open path
    const sortedLocs = uniqueLocs.sort((a, b) => b.offset - a.offset);
    const parts: paper.Path[] = [];
    let current = temp;
    for (const loc of sortedLocs) {
      if (loc.offset < 0.01 || loc.offset > current.length - 0.01) continue;
      const tail = current.splitAt(loc);
      if (tail) parts.push(tail);
    }
    parts.push(current);
    return parts;
  }
}

export function getSharedPerimeter(areaA: Area, areaB: Area): paper.PathItem | null {
  const topA = pathItemFromBoundaryData(areaA.boundary);
  const topB = pathItemFromBoundaryData(areaB.boundary);
  
  if (!topA || !topB) {
    topA?.remove();
    topB?.remove();
    return null;
  }

  const TOLERANCE = 1.5;
  if (!topA.bounds.clone().expand(TOLERANCE * 2).intersects(topB.bounds)) {
    topA.remove();
    topB.remove();
    return null;
  }

  const pathsA = contourPathsForSegments(topA);
  const pathsB = contourPathsForSegments(topB);
  
  const splitPoints: paper.Point[] = [];

  for (const pA of pathsA) {
    for (const pB of pathsB) {
      // 1. Intersections
      const intersections = pA.getIntersections(pB);
      for (const is of intersections) splitPoints.push(is.point);
      
      // 2. Vertices of A on B
      for (const seg of pA.segments) {
        for (const targetB of pathsB) {
          const nearest = targetB.getNearestPoint(seg.point);
          if (nearest.getDistance(seg.point) < TOLERANCE) {
            splitPoints.push(seg.point);
            break;
          }
        }
      }
      // 3. Vertices of B on A
      for (const seg of pB.segments) {
        for (const targetA of pathsA) {
          const nearest = targetA.getNearestPoint(seg.point);
          if (nearest.getDistance(seg.point) < TOLERANCE) {
            splitPoints.push(seg.point);
            break;
          }
        }
      }
    }
  }

  const sharedPaths: paper.Path[] = [];

  for (const pA of pathsA) {
    const localSplits = splitPoints.filter(pt => pA.getNearestPoint(pt).getDistance(pt) < TOLERANCE);
    const parts = splitPathAtPoints(pA, localSplits, 0.1);

    for (const part of parts) {
      if (part.length < 0.1) {
        part.remove();
        continue;
      }
      const mid = part.getPointAt(part.length / 2);
      let isOnB = false;
      for (const pB of pathsB) {
        if (pB.getNearestPoint(mid).getDistance(mid) < TOLERANCE) {
          isOnB = true;
          break;
        }
      }
      if (isOnB) {
        sharedPaths.push(part);
      } else {
        part.remove();
      }
    }
  }

  topA.remove();
  topB.remove();

  if (sharedPaths.length === 0) return null;

  // Sort sharedPaths based on their position on the original areaA boundary
  const originalTopA = pathItemFromBoundaryData(areaA.boundary);
  sharedPaths.sort((a, b) => {
    const midA = a.getPointAt(a.length / 2);
    const midB = b.getPointAt(b.length / 2);
    const locA = originalTopA.getNearestLocation(midA);
    const locB = originalTopA.getNearestLocation(midB);
    return getTotalOffset(originalTopA, locA) - getTotalOffset(originalTopA, locB);
  });
  originalTopA.remove();

  // Join contiguous segments
  let joined = true;
  while (joined && sharedPaths.length > 1) {
    joined = false;
    for (let i = 0; i < sharedPaths.length; i++) {
      for (let j = 0; j < sharedPaths.length; j++) {
        if (i === j) continue;
        const p1 = sharedPaths[i];
        const p2 = sharedPaths[j];
        
        // Check all 4 connection possibilities (p1-end to p2-start, p1-end to p2-end, etc.)
        if (p1.lastSegment.point.getDistance(p2.firstSegment.point) < 0.1) {
          p1.join(p2);
          sharedPaths.splice(j, 1);
          joined = true;
          break;
        } else if (p1.lastSegment.point.getDistance(p2.lastSegment.point) < 0.1) {
          p2.reverse();
          p1.join(p2);
          sharedPaths.splice(j, 1);
          joined = true;
          break;
        } else if (p1.firstSegment.point.getDistance(p2.firstSegment.point) < 0.1) {
          p1.reverse();
          p1.join(p2);
          sharedPaths.splice(j, 1);
          joined = true;
          break;
        } else if (p1.firstSegment.point.getDistance(p2.lastSegment.point) < 0.1) {
          p2.join(p1);
          sharedPaths.splice(i, 1);
          joined = true;
          break;
        }
      }
      if (joined) break;
    }
  }

  // Wrap-around join for closed paths
  if (sharedPaths.length === 1) {
    const p = sharedPaths[0];
    if (p.firstSegment.point.getDistance(p.lastSegment.point) < 0.1) {
      p.closed = true;
    }
  }

  if (sharedPaths.length === 1) return sharedPaths[0];
  
  const compound = new paper.CompoundPath({});
  compound.addChildren(sharedPaths);
  return compound;
}

/** Avoid u at exact endpoints of shared perimeters (topo engine / sampling edge cases). */
export const CONNECTOR_U_MIN = 0.001;
export const CONNECTOR_U_MAX = 0.999;

export function clampConnectorU(u: number): number {
  if (!Number.isFinite(u)) return 0.5;
  return Math.max(CONNECTOR_U_MIN, Math.min(CONNECTOR_U_MAX, u));
}

/**
 * Chord normals from getPointAtU can point either perpendicular direction; the tab must extend into the
 * neighbor piece. Flip the normal when a short step along it does not land inside the neighbor boundary.
 * Requires an active Paper.js project (same scope as shared-perimeter / stamp booleans).
 */
export function orientConnectorNormalTowardNeighbor(
  anchor: paper.Point,
  normal: paper.Point,
  neighborBoundarySvg: string
): paper.Point {
  const np = pathItemFromBoundaryData(neighborBoundarySvg);
  const step = 5;
  const along = anchor.add(normal.multiply(step));
  const opposite = anchor.add(normal.multiply(-step));
  const alongIn = np.contains(along);
  const oppIn = np.contains(opposite);
  np.remove();
  if (alongIn && !oppIn) return normal;
  if (oppIn && !alongIn) return normal.multiply(-1);
  return normal;
}

/**
 * Sorts the children of a CompoundPath such that their order matches their position along an original path.
 * This ensures that the normalized 'u' value moves intuitively along the boundary.
 */
export function sortCompoundPathChildren(compound: paper.CompoundPath, original: paper.PathItem): paper.CompoundPath {
  const children = compound.children.filter(c => c instanceof paper.Path) as paper.Path[];
  children.sort((a, b) => {
    const midA = a.getPointAt(a.length / 2);
    const midB = b.getPointAt(b.length / 2);
    const locA = original.getNearestLocation(midA);
    const locB = original.getNearestLocation(midB);
    return getTotalOffset(original, locA) - getTotalOffset(original, locB);
  });
  compound.removeChildren();
  compound.addChildren(children);
  return compound;
}

/**
 * Gets the point and normal at a normalized position 'u' along a path.
 */
export function getPointAtU(path: paper.PathItem, u: number): { point: paper.Point; normal: paper.Point } | null {
  if (!path || path.isEmpty()) return null;
  
  const uu = clampConnectorU(u);
  
  if (path instanceof paper.CompoundPath) {
    const children = path.children.filter(c => c instanceof paper.Path) as paper.Path[];
    if (children.length === 0) return null;
    
    const lengths = children.map(c => c.length);
    const totalLen = lengths.reduce((a, b) => a + b, 0);
    let offset = uu * totalLen;
    
    for (let i = 0; i < children.length; i++) {
      if (offset <= lengths[i] + 0.0001) {
        // Ensure offset is within child bounds
        const childOffset = Math.max(0, Math.min(children[i].length, offset));
        return {
          point: children[i].getPointAt(childOffset),
          normal: children[i].getNormalAt(childOffset)
        };
      }
      offset -= lengths[i];
    }
    // Fallback to last point of last child
    const last = children[children.length - 1];
    return { point: last.lastSegment.point, normal: last.getNormalAt(last.length) };
  } else {
    const p = path as paper.Path;
    const offset = uu * p.length;
    return {
      point: p.getPointAt(offset),
      normal: p.getNormalAt(offset)
    };
  }
}

/**
 * Checks if two paths are touching or intersecting within a tolerance.
 * It avoids returning true for paths that only share a single point (diagonal touch).
 */
export function pathsTouch(a: paper.PathItem, b: paper.PathItem, tol: number = 1.0): boolean {
  // 1. Check boolean intersection length
  const inter = a.intersect(b);
  const interLen = (inter as any).length || 0;
  inter.remove();
  
  // If they share an edge of significant length, they touch.
  if (interLen > tol) return true;
  
  // If they intersect but only at a point (or very short segment), they don't "touch" for merging.
  if (interLen > 0) return false;

  // 2. Check for parallel gap (they don't intersect)
  // We use the center of the bounds as a hint for the nearest point search
  const pA = a.getNearestPoint(b.bounds.center);
  if (!pA) return false;
  const pB = b.getNearestPoint(pA);
  if (!pB) return false;
  const dist = pA.getDistance(pB);
  
  if (dist < tol) {
    // They are close at at least one point.
    // Check if they are close along an edge by sampling nearby points along the boundary.
    const loc = a.getNearestLocation(pA);
    if (loc && loc.path) {
      const path = loc.path;
      const offset = loc.offset;
      // Sample 2px away in both directions
      const testOffsets = [offset - 2, offset + 2];
      let closeCount = 0;
      for (const off of testOffsets) {
        let tOff = off;
        if (path.closed) {
          tOff = (off + path.length) % path.length;
        } else {
          tOff = Math.max(0, Math.min(path.length, off));
        }
        const pTest = path.getPointAt(tOff);
        const nearestOnB = b.getNearestPoint(pTest);
        if (nearestOnB && nearestOnB.getDistance(pTest) < tol + 0.5) {
          closeCount++;
        }
      }
      // If both nearby points are also close, it's an edge gap.
      if (closeCount >= 2) return true;
    }
  }

  return false;
}

/**
 * Finds the neighbor piece at a specific position 'u' along areaA's boundary.
 */
export function findNeighborAt(
  areaA: Area,
  u: number,
  topology: Record<string, Area>,
  width: number,
  height: number
): string | null {
  const pathA = pathItemFromBoundaryData(areaA.boundary);
  const pos = getPointAtU(pathA, u);
  pathA.remove();
  if (!pos) return null;

  const testPoint = pos.point;
  const leafAreas = Object.values(topology).filter(a => a.isPiece && a.id !== areaA.id);

  let bestNeighbor: string | null = null;
  let minDist = 2.0; // Tolerance in pixels

  for (const areaB of leafAreas) {
    const pathB = pathItemFromBoundaryData(areaB.boundary);
    const nearest = pathB.getNearestPoint(testPoint);
    const dist = nearest.getDistance(testPoint);
    pathB.remove();
    
    if (dist < minDist) {
      minDist = dist;
      bestNeighbor = areaB.id;
    }
  }
  
  return bestNeighbor;
}

/**
 * Leaf pieces that receive boolean union (owner) vs subtract (neighbor) for this connector.
 * Default: tab protrudes into areaB → owner areaA, neighbor areaB. Flipped: into areaA → owner areaB.
 * This matches `Connector.isFlipped` and avoids `path.contains(testPoint)` failures on vertical/horizontal chords and at many u values.
 */
export function connectorOwnerNeighborLeafIds(
  c: Pick<Connector, 'isFlipped' | 'areaAId' | 'areaBId'>
): { ownerLeafId: string; neighborLeafId: string } {
  return c.isFlipped
    ? { ownerLeafId: c.areaBId, neighborLeafId: c.areaAId }
    : { ownerLeafId: c.areaAId, neighborLeafId: c.areaBId };
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
    if (!areaA) return null;
    
    const pathA = pathItemFromBoundaryData(areaA.boundary);
    const pos = getPointAtU(pathA, c.u);
    pathA.remove();
    if (!pos) return null;
    
    const { neighborLeafId } = connectorOwnerNeighborLeafIds(c);
    let normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
    const nb = areas[neighborLeafId]?.boundary;
    if (nb) normal = orientConnectorNormalTowardNeighbor(pos.point, normal, nb);
    
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
