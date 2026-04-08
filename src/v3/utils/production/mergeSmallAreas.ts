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
          // unite then subtracting intersect is redundant, but makes paper js work much better
          const united = p1.unite(p2).subtract((p1.intersect(p2,{insert:false})), {insert:false});
          
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
 * Finds the index of the neighbor that shares the most boundary with the given area.
 */
function findBestNeighbor(area: ProductionArea, allAreas: ProductionArea[], currentIndex: number): number {
  const path = new paper.CompoundPath({ pathData: area.pathData, insert: false });

  // Expand the path slightly to find neighbors
  // We'll use a simple trick: check points along the boundary and see which neighbor contains them
  const steps = 20;
  const neighborHits: Record<number, number> = {};

  // We need to find the outer path for sampling points
  const sourcePath = (path instanceof paper.CompoundPath
    ? (path.children.find(c => (c as paper.Path).clockwise) || path.children[0])
    : path) as paper.Path;

  for (let i = 0; i < steps; i++) {
    const pt = sourcePath.getPointAt(sourcePath.length * (i / steps));
    const normal = sourcePath.getNormalAt(sourcePath.length * (i / steps));

    // Look slightly outside
    if (!pt || !normal) continue;
    
    const testPt = pt.add(normal.multiply(1.5));
    
    for (let j = 0; j < allAreas.length; j++) {
      if (j === currentIndex) continue;
      
      const neighborPath = new paper.CompoundPath({ pathData: allAreas[j].pathData, insert: false });
      
      if (neighborPath.contains(testPt)) {
        neighborHits[j] = (neighborHits[j] || 0) + 1;
        neighborPath.remove();
        break;
      }
      neighborPath.remove();
    }
  }
  
  path.remove();
  
  // Find the neighbor with the most hits
  let bestIndex = -1;
  let maxHits = 0;
  
  for (const indexStr in neighborHits) {
    const index = parseInt(indexStr);
    if (neighborHits[index] > maxHits) {
      maxHits = neighborHits[index];
      bestIndex = index;
    }
  }
  
  return bestIndex;
}
