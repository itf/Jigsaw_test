import paper from 'paper';
import { ProductionArea } from './processProduction';

/**
 * Merges small areas (below a threshold) with their neighbor that shares the longest boundary.
 */
export function mergeSmallAreas(areas: ProductionArea[], threshold: number): ProductionArea[] {
  // First, remove any areas with zero or negative size
  let nextAreas = areas.filter(area => area.area > 0);
  let stateChanged = true;

  // We loop until no more merges can be made (or we hit a limit)
  let iterations = 0;
  while (stateChanged && iterations < 5) {
    stateChanged = false;
    iterations++;

    for (let i = 0; i < nextAreas.length; i++) {
      const area = nextAreas[i];
      if (area.area < threshold) {
        const neighborIndex = findBestNeighbor(area, nextAreas, i);
        if (neighborIndex !== -1) {
          const neighbor = nextAreas[neighborIndex];
          
          // Unite the paths
          const p1 = new paper.CompoundPath({ pathData: area.pathData, insert: false });
          const p2 = new paper.CompoundPath({ pathData: neighbor.pathData, insert: false });
          
          // Unite and subtract intersection as this helps paper js remove lines
          const united = p1.unite(p2).subtract(p1.intersect(p2,{insert:false}),{insert:false});
          
          
          // Update neighbor
          nextAreas[neighborIndex] = {
            ...neighbor,
            pathData: united.pathData,
            area: Math.abs((united as any).area || 0)
          };
          
          // Remove current small area
          nextAreas.splice(i, 1);
          
          // Cleanup
          p1.remove();
          p2.remove();
          united.remove();
          
          stateChanged = true;
          i--; // Adjust index after splice
        }
      }
    }
  }

  return nextAreas;
}

/**
 * Finds the index of the neighbor that shares the longest boundary (most sampling hits).
 */
function findBestNeighbor(area: ProductionArea, allAreas: ProductionArea[], currentIndex: number): number {
  const path = new paper.CompoundPath({ pathData: area.pathData, insert: false });
  const steps = 40; // More steps for better boundary length estimation
  
  // Create neighbor paths once for efficient testing
  const neighborPaths = allAreas.map((a, idx) => 
    idx === currentIndex ? null : new paper.CompoundPath({ pathData: a.pathData, insert: false })
  );

  const neighborHits = new Map<number, number>();
  const sourcePath = (path instanceof paper.CompoundPath
    ? (path.children.find(c => (c as paper.Path).clockwise) || path.children[0])
    : path) as paper.Path;

  if (sourcePath && sourcePath.length > 0) {
    for (let i = 0; i < steps; i++) {
      const pt = sourcePath.getPointAt(sourcePath.length * (i / steps));
      const normal = sourcePath.getNormalAt(sourcePath.length * (i / steps));
      if (!pt || !normal) continue;
      
      // Look slightly outside the piece to find the neighbor
      const testPt = pt.add(normal.multiply(1.5));
      
      for (let j = 0; j < neighborPaths.length; j++) {
        const np = neighborPaths[j];
        if (np && np.contains(testPt)) {
          neighborHits.set(j, (neighborHits.get(j) || 0) + 1);
          break;
        }
      }
    }
  }
  
  // Cleanup
  path.remove();
  neighborPaths.forEach(p => p?.remove());
  
  // Find the neighbor with the most hits (longest shared boundary)
  let bestIndex = -1;
  let maxHits = 0;
  
  neighborHits.forEach((hits, index) => {
    if (hits > maxHits) {
      maxHits = hits;
      bestIndex = index;
    }
  });
  
  return bestIndex;
}
