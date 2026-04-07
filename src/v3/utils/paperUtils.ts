import paper from 'paper';
import { Area, AreaType } from '../types';

/**
 * Parse stored SVG path data from `Area.boundary` (or merged boundaries).
 * Multi-subpath strings (holes, disjoint loops) must use CompoundPath.
 * Single-contour data is returned as a plain `Path`.
 */
export function pathItemFromBoundaryData(data: string): paper.PathItem {
  const item = new paper.CompoundPath(data);
  item.reorient(true, true);
  if (item.children.length === 1) {
    const only = item.children[0] as paper.Path;
    const p = new paper.Path(only.pathData);
    item.remove();
    p.reorient(true, true);
    return p;
  }
  return item;
}

/**
 * Reset the active Paper.js project.
 */
export function resetPaperProject(width: number, height: number) {
  try {
    if (paper.project) {
      paper.project.remove();
    }
    // Create a hidden canvas if we're in a browser but no canvas is provided
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paper.setup(canvas);
  } catch (e) {
    console.warn('Paper.js setup failed, falling back to headless mode:', e);
    paper.setup(new paper.Size(width, height));
  }
}

/**
 * Returns the number of sub-paths in a PathItem.
 */
export function getPathCount(boundary: paper.PathItem): number {
  if (boundary instanceof paper.Path) return 1;
  if (boundary instanceof paper.CompoundPath) return boundary.children.length;
  return 0;
}

/**
 * Given a PathItem (Path or CompoundPath), returns a point on its boundary
 * based on a normalized value t (0 to 1) and a path index.
 */
export function getPointOnBoundary(boundary: paper.PathItem, t: number, pathIndex: number = 0): paper.Point {
  if (boundary instanceof paper.Path) {
    return boundary.getPointAt(boundary.length * t);
  } else if (boundary instanceof paper.CompoundPath) {
    const children = boundary.children.filter(c => c instanceof paper.Path) as paper.Path[];
    if (children.length === 0) return new paper.Point(0, 0);
    const idx = Math.max(0, Math.min(pathIndex, children.length - 1));
    const path = children[idx];
    return path.getPointAt(path.length * t);
  }
  return new paper.Point(0, 0);
}

/**
 * Returns the normal vector at a given point on the boundary.
 */
export function getNormalOnBoundary(boundary: paper.PathItem, t: number, pathIndex: number = 0): paper.Point {
  if (boundary instanceof paper.Path) {
    return boundary.getNormalAt(boundary.length * t);
  } else if (boundary instanceof paper.CompoundPath) {
    const children = boundary.children.filter(c => c instanceof paper.Path) as paper.Path[];
    if (children.length === 0) return new paper.Point(0, 1);
    const idx = Math.max(0, Math.min(pathIndex, children.length - 1));
    const path = children[idx];
    return path.getNormalAt(path.length * t);
  }
  return new paper.Point(0, 1);
}

/**
 * Finds the closest location on the boundary to a given point.
 * Returns { t, pathIndex, point }
 */
export function getClosestLocationOnBoundary(boundary: paper.PathItem, targetPoint: paper.Point): { t: number, pathIndex: number, point: paper.Point } {
  const location = boundary.getNearestLocation(targetPoint);
  if (!location) return { t: 0, pathIndex: 0, point: new paper.Point(0, 0) };

  let pathIndex = 0;
  let path = location.path;
  
  if (boundary instanceof paper.CompoundPath) {
    const children = boundary.children.filter(c => c instanceof paper.Path) as paper.Path[];
    pathIndex = children.indexOf(path as paper.Path);
    if (pathIndex === -1) pathIndex = 0;
  }

  const t = path.length > 0 ? location.offset / path.length : 0;
  return { t, pathIndex, point: location.point };
}

/**
 * Finds a neighbor piece by sampling a point slightly outside the current piece's boundary.
 */
export function findNeighborPiece(
  areas: Record<string, Area>,
  currentPieceId: string,
  point: paper.Point,
  normal: paper.Point
): string | null {
  // Offset slightly along the normal to "look" into the neighbor
  const testPoint = point.add(normal.multiply(0.5));
  
  for (const id in areas) {
    if (id === currentPieceId) continue;
    const area = areas[id];
    if (area.type === AreaType.PIECE) {
      if (area.boundary.contains(testPoint)) {
        return id;
      }
    }
  }
  return null;
}
