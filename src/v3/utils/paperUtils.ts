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
    const p = only.clone({ insert: false });
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
 * Cleans a path by removing redundant segments and tiny artifacts.
 */
export function cleanPath(path: paper.PathItem): paper.PathItem {
  if (!path || path.isEmpty()) return path;
  
  // resolveCrossings() is a powerful Paper.js method that cleans up 
  // self-intersections and overlapping segments.
  if (path instanceof paper.Path || path instanceof paper.CompoundPath) {
    try {
      // resolveCrossings can sometimes fail on extremely complex paths, so we wrap it
      const resolved = (path as any).resolveCrossings();
      if (resolved && resolved !== path) {
        path.remove();
        path = resolved;
      }
    } catch (e) {
      console.warn('resolveCrossings failed, skipping...', e);
    }
  }

  // We manually remove extremely small segments that boolean ops sometimes leave
  const removeTiny = (p: paper.Path) => {
    for (let i = p.segments.length - 1; i >= 0; i--) {
      const seg = p.segments[i];
      const next = p.segments[(i + 1) % p.segments.length];
      if (seg.point.getDistance(next.point) < 0.01) {
        p.removeSegment(i);
      }
    }
  };

  if (path instanceof paper.Path) {
    removeTiny(path);
  } else if (path instanceof paper.CompoundPath) {
    path.children.forEach(child => {
      if (child instanceof paper.Path) removeTiny(child);
    });
  }
  
  return path;
}

/**
 * Removes dangling edges (dead-ends) from a set of paths.
 * This is useful for cleaning up artifacts from boolean operations.
 */
export function removeDanglingEdges(pathData: string[], tolerance: number = 0.05): string[] {
  // Setup a temporary project
  const canvas = document.createElement('canvas');
  paper.setup(canvas);

  // 1. Load all paths and flatten them into individual Path objects
  pathData.forEach(d => {
    const item = new paper.CompoundPath({ pathData: d, insert: false });
    const flatten = (it: paper.Item) => {
      if (it instanceof paper.Path) {
        if (it.length > 0.001) {
          const clone = it.clone();
          paper.project.activeLayer.addChild(clone);
        }
      } else if (it.children) {
        [...it.children].forEach(flatten);
      }
    };
    flatten(item);
    item.remove();
  });
  
  // 2. Split all segments at all intersections
  const initialPaths = paper.project.activeLayer.getItems({ class: paper.Path }) as paper.Path[];
  const pathIntersections = new Map<paper.Path, paper.Point[]>();

  for (let i = 0; i < initialPaths.length; i++) {
    for (let j = i + 1; j < initialPaths.length; j++) {
      const inters = initialPaths[i].getIntersections(initialPaths[j]);
      inters.forEach(inter => {
        if (!pathIntersections.has(initialPaths[i])) pathIntersections.set(initialPaths[i], []);
        if (!pathIntersections.has(initialPaths[j])) pathIntersections.set(initialPaths[j], []);
        pathIntersections.get(initialPaths[i])!.push(inter.point);
        pathIntersections.get(initialPaths[j])!.push(inter.point);
      });
    }
  }

  // Split each path at its intersection points
  const allSegments: paper.Path[] = [];
  initialPaths.forEach(p => {
    const points = pathIntersections.get(p) || [];
    const offsets = points.map(pt => p.getNearestLocation(pt).offset);
    const uniqueOffsets = Array.from(new Set(offsets.map(o => Math.round(o * 1000) / 1000)));
    uniqueOffsets.sort((a, b) => b - a);

    let current = p;
    uniqueOffsets.forEach(o => {
      if (o > 0.01 && o < current.length - 0.01) {
        const secondHalf = current.splitAt(o);
        if (secondHalf) allSegments.push(secondHalf as paper.Path);
      }
    });
    allSegments.push(current);
  });

  // 3. Iteratively remove segments that have a "dead end"
  let segments = allSegments;
  
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;
    
    const grid = new Map<string, number>();
    const getGridKey = (pt: paper.Point) => `${Math.round(pt.x / tolerance)},${Math.round(pt.y / tolerance)}`;
    
    segments.forEach(s => {
      if (s.isEmpty()) return;
      const k1 = getGridKey(s.firstSegment.point);
      const k2 = getGridKey(s.lastSegment.point);
      grid.set(k1, (grid.get(k1) || 0) + 1);
      grid.set(k2, (grid.get(k2) || 0) + 1);
    });

    const nextSegments: paper.Path[] = [];
    for (const s of segments) {
      if (s.isEmpty()) continue;
      
      const k1 = getGridKey(s.firstSegment.point);
      const k2 = getGridKey(s.lastSegment.point);
      const d1 = grid.get(k1) || 0;
      const d2 = grid.get(k2) || 0;

      const isLoop = k1 === k2;
      
      // A segment is dangling if it's not closed, not a loop, and either end has degree 1
      if (!s.closed && !isLoop && (d1 === 1 || d2 === 1)) {
        s.remove();
        changed = true;
      } else {
        nextSegments.push(s);
      }
    }
    segments = nextSegments;
  }

  const result = segments.map(s => s.pathData).filter(d => d.length > 0);
  
  // 4. Final deduplication of overlapping segments (the "adds new edges" fix)
  // Sometimes splitting creates identical segments.
  const finalPaths: string[] = [];
  const seenSegments = new Set<string>();

  result.forEach(d => {
    const s = new paper.Path({ pathData: d, insert: false });
    if (s.isEmpty()) return;
    const p1 = s.firstSegment.point;
    const p2 = s.lastSegment.point;
    const k1 = `${Math.round(p1.x / tolerance)},${Math.round(p1.y / tolerance)}`;
    const k2 = `${Math.round(p2.x / tolerance)},${Math.round(p2.y / tolerance)}`;
    const key = [k1, k2].sort().join('|');
    
    if (!seenSegments.has(key)) {
      seenSegments.add(key);
      finalPaths.push(d);
    }
    s.remove();
  });

  // Cleanup
  paper.project.clear();
  
  return finalPaths;
}
