import paper from 'paper';
import { Area, AreaType } from '../types';

// Extend Paper.js prototype to include reorient if missing
if (!(paper as any).Item.prototype.reorient) {
  (paper as any).Item.prototype.reorient = function(this: paper.Item, clockwise: boolean, resolve: boolean) {
    if (this instanceof paper.Path) {
      this.clockwise = clockwise;
      if (resolve) {
        try {
          const resolved = (this as any).resolveCrossings();
          if (resolved && resolved !== this) {
            this.replaceWith(resolved);
          }
        } catch (e) {
          // Ignore resolve errors
        }
      }
    } else if (this instanceof paper.CompoundPath) {
      // For CompoundPath, we want the outer boundary to be CW and holes to be CCW (if clockwise=true)
      // Paper.js usually handles this if we set clockwise on children
      this.children.forEach((child: any) => {
        if (child instanceof paper.Path) {
          // This is a simplified version of reorientation
          child.clockwise = clockwise;
        }
      });
    }
    return this;
  };
}

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
  // Create a new active project without removing the old one.
  // Path objects stored in React state are tied to their originating project;
  // removing that project would orphan them and break .clone() / boolean ops.
  paper.setup(new paper.Size(width, height));
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
  
  let result = path;

  // 1. Resolve crossings and handle CompoundPath debris
  if (result instanceof paper.Path || result instanceof paper.CompoundPath) {
    try {
      // Ensure basic orientation before resolving
      if (result instanceof paper.Path) {
        result.clockwise = true;
      }

      const resolved = (result as any).resolveCrossings();
      if (resolved) {
        if (resolved instanceof paper.CompoundPath) {
          // Filter out ONLY extremely small debris that is likely a boolean artifact.
          // We must be very conservative to avoid eating small holes (like in a donut).
          const validChildren = resolved.children.filter(c => {
            if (!(c instanceof paper.Path)) {
              c.remove();
              return false;
            }
            const p = c as paper.Path;
            // Very small threshold: 0.01px area is tiny, but a donut hole (r=0.4) is ~0.5.
            const hasLength = p.length > 0.01;
            const hasArea = Math.abs(p.area) > 0.001;
            
            // Also check for "spikes" - segments that are nearly identical
            if (p.segments.length < 2) {
              c.remove();
              return false;
            }

            if (hasLength && hasArea) return true;
            
            c.remove();
            return false;
          }) as paper.Path[];

          if (validChildren.length === 1) {
            const only = validChildren[0];
            const cloned = only.clone({ insert: false });
            result.remove();
            resolved.remove();
            result = cloned;
          } else if (validChildren.length > 1) {
            const cp = new paper.CompoundPath({ children: validChildren.map(c => c.clone({ insert: false })), insert: false });
            result.remove();
            resolved.remove();
            result = cp;
          } else {
            resolved.remove();
          }
        } else if (resolved !== result) {
          const old = result;
          result = resolved.clone({ insert: false });
          old.remove();
          resolved.remove();
        }
      }
    } catch (e) {
      console.warn('resolveCrossings failed, skipping...', e);
    }
  }

  // 2. Gentle segment cleanup and spike removal
  let changed = true;
  let iters = 0;

  const cleanup = (p: paper.Path): boolean => {
    let localChanged = false;
    // Remove zero-length segments
    for (let i = p.segments.length - 1; i >= 0; i--) {
      const seg = p.segments[i];
      const next = p.segments[(i + 1) % p.segments.length];
      if (seg.point.getDistance(next.point) < 1e-6) {
        p.removeSegment(i);
        localChanged = true;
      }
    }

    // Remove "spikes" (A -> B -> A)
    if (p.segments.length > 2) {
      for (let i = p.segments.length - 1; i >= 0; i--) {
        if (p.segments.length <= 2) break;
        const prev = p.segments[(i - 1 + p.segments.length) % p.segments.length];
        const curr = p.segments[i];
        const next = p.segments[(i + 1) % p.segments.length];
        
        const v1 = curr.point.subtract(prev.point);
        const v2 = next.point.subtract(curr.point);
        
        // If vectors are opposite and nearly same length, it's a spike
        if (v1.length > 0.1 && v2.length > 0.1) {
          const dot = v1.normalize().dot(v2.normalize());
          if (dot < -0.999 && Math.abs(v1.length - v2.length) < 0.1) {
            p.removeSegment(i);
            localChanged = true;
          }
        }
      }
    }
    return localChanged;
  };

  while (changed && iters < 5) {
    changed = false;
    iters++;
    if (result instanceof paper.Path) {
      if (cleanup(result)) changed = true;
    } else if (result instanceof paper.CompoundPath) {
      result.children.forEach(child => {
        if (child instanceof paper.Path) {
          if (cleanup(child)) changed = true;
        }
      });
    }
  }
  
  return result;
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
