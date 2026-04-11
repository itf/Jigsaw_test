import paper from 'paper';

export interface PathWithId {
  id: string | number;
  pathData: string;
}

/**
 * Finds the closest path to a given point among a list of paths.
 * Returns the ID of the closest path and the distance to it.
 */
export function findClosestPath(
  point: { x: number; y: number },
  paths: PathWithId[],
  maxDistance: number = 100
): { id: string | number | null; distance: number } {
  if (paths.length === 0) return { id: null, distance: Infinity };

  let minDistance = Infinity;
  let closestId: string | number | null = null;

  // We use a temporary paper scope to perform geometry calculations
  // without interfering with the main canvas project.
  const scope = new paper.PaperScope();
  const canvas = document.createElement('canvas');
  scope.setup(canvas);

  const pPoint = new scope.Point(point.x, point.y);

  for (const p of paths) {
    try {
      const path = new scope.Path(p.pathData);
      const nearest = path.getNearestPoint(pPoint);
      const dist = pPoint.getDistance(nearest);
      
      if (dist < minDistance) {
        minDistance = dist;
        closestId = p.id;
      }
      path.remove();
    } catch (e) {
      // Silently ignore invalid path data
    }
  }

  // Only return if within reasonable distance
  if (minDistance > maxDistance) {
    return { id: null, distance: minDistance };
  }

  return { id: closestId, distance: minDistance };
}
