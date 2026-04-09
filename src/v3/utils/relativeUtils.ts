import paper from 'paper';

/**
 * Calculates the total length of the shared boundary between two path items.
 */
export function getSharedBoundaryLength(boundaryA: paper.PathItem, boundaryB: paper.PathItem): number {
  // We use a small stroke expansion to find the intersection of boundaries
  // because exact intersection of lines can be numerically unstable.
  const strokeA = new paper.Path(boundaryA.pathData);
  strokeA.strokeWidth = 0.1;
  const strokeB = new paper.Path(boundaryB.pathData);
  strokeB.strokeWidth = 0.1;
  
  const intersection = strokeA.intersect(strokeB);
  const area = Math.abs((intersection as any).area || 0);
  
  strokeA.remove();
  strokeB.remove();
  intersection.remove();
  
  // Area of intersection of two 0.1 width strokes is roughly length * 0.1
  return area / 0.1;
}

/**
 * Calculates the depth of a neighbor piece along a normal vector from a point.
 */
export function getNeighborDepth(neighborBoundary: paper.PathItem, point: paper.Point, normal: paper.Point): number {
  // Cast a ray from the point along the normal
  const rayEnd = point.add(normal.multiply(10000)); // Long enough ray
  const ray = new paper.Path.Line(point, rayEnd);
  
  const intersections = ray.getIntersections(neighborBoundary);
  ray.remove();
  
  if (intersections.length === 0) return 100; // Fallback
  
  // Find the intersection furthest from the start point that is still "forward"
  let maxDist = 0;
  for (const inter of intersections) {
    const dist = inter.point.getDistance(point);
    if (dist > maxDist) {
      maxDist = dist;
    }
  }
  
  return maxDist > 0 ? maxDist : 100;
}

/**
 * Calculates the area of a path item.
 */
export function getPathArea(pathItem: paper.PathItem): number {
  return Math.abs((pathItem as any).area || 0);
}

/**
 * Calculates the area of a whimsy template at a given scale.
 */
export function getWhimsyArea(svgData: string, scale: number): number {
  const path = new paper.CompoundPath(svgData);
  path.scale(scale);
  const area = Math.abs((path as any).area || 0);
  path.remove();
  return area;
}
