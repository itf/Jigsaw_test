import paper from 'paper';

/**
 * Initialize or reset the paper.js project for a given canvas size.
 * This ensures a clean project state without detached projects in memory.
 * Uses an offscreen canvas to avoid rendering issues.
 */
export function setupPaperProject(width: number, height: number): void {
  if (paper.project) {
    paper.project.remove();
  }
  
  // Create an offscreen canvas for paper.js to use
  // This prevents paper.js from trying to create or find a canvas element
  const canvas = new OffscreenCanvas(width, height);
  paper.setup(canvas);
}

/**
 * Create a paper.js PathItem from SVG path data string.
 * Handles both single-contour paths and compound paths (holes, disjoint loops).
 * Uses CompoundPath for parsing, then returns a simple Path if only one child.
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
 * Export a paper.js PathItem to SVG path data string.
 * Works with both Path and CompoundPath.
 */
export function pathItemToPathData(pathItem: paper.PathItem): string {
  return pathItem.pathData;
}

/**
 * Create a rectangle path.
 */
export function createRectanglePath(width: number, height: number): paper.Path {
  const path = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(width, height));
  path.strokeColor = new paper.Color('black');
  path.fillColor = new paper.Color(1, 1, 1, 0);
  return path;
}

/**
 * Create a circle path inscribed in the given dimensions.
 */
export function createCirclePath(width: number, height: number): paper.Path {
  const radius = Math.min(width, height) / 2;
  const center = new paper.Point(width / 2, height / 2);
  const path = new paper.Path.Circle(center, radius);
  path.strokeColor = new paper.Color('black');
  path.fillColor = new paper.Color(1, 1, 1, 0);
  return path;
}

/**
 * Check if two paper.js PathItems intersect or touch.
 * Returns true if they have a meaningful overlap or edge contact.
 */
export function pathsIntersect(pathA: paper.PathItem, pathB: paper.PathItem, tol: number = 1.0): boolean {
  try {
    // Use the intersect method to find intersection paths
    const inter = pathA.intersect(pathB);
    const interLen = (inter as any).length || 0;
    inter.remove();
    
    // If they share an edge of significant length, they intersect
    if (interLen > tol) return true;
    
    // If they intersect but only at a point, they don't meaningfully intersect for merging
    if (interLen > 0) return false;
    
    // Check for boundary proximity
    const pA = pathA.getNearestPoint(pathB.bounds.center);
    if (!pA) return false;
    const pB = pathB.getNearestPoint(pA);
    if (!pB) return false;
    const dist = pA.getDistance(pB);
    
    return dist < tol;
  } catch {
    return false;
  }
}

/**
 * Unite two paper.js PathItems and return the result.
 * Removes the input paths.
 */
export function unitePaths(pathA: paper.PathItem, pathB: paper.PathItem): paper.PathItem {
  const united = pathA.unite(pathB, { insert: false });
  pathA.remove();
  pathB.remove();
  
  // Ensure result has stroke properties
  if (united instanceof paper.Path) {
    united.strokeColor = new paper.Color('black');
    united.fillColor = new paper.Color(1, 1, 1, 0);
  } else if (united instanceof paper.CompoundPath) {
    united.strokeColor = new paper.Color('black');
    united.fillColor = new paper.Color(1, 1, 1, 0);
  }
  
  return united;
}

/**
 * Subtract pathB from pathA and return the result.
 * Removes both input paths.
 */
export function subtractPaths(pathA: paper.PathItem, pathB: paper.PathItem): paper.PathItem {
  const result = pathA.subtract(pathB, { insert: false });
  pathA.remove();
  pathB.remove();
  
  // Ensure result has stroke properties
  if (result instanceof paper.Path) {
    result.strokeColor = new paper.Color('black');
    result.fillColor = new paper.Color(1, 1, 1, 0);
  } else if (result instanceof paper.CompoundPath) {
    result.strokeColor = new paper.Color('black');
    result.fillColor = new paper.Color(1, 1, 1, 0);
  }
  
  return result;
}

/**
 * Clone a paper.js PathItem (useful for preserving original boundaries).
 */
export function clonePath(pathItem: paper.PathItem): paper.PathItem {
  const cloned = pathItem.clone() as paper.PathItem;
  return cloned;
}
