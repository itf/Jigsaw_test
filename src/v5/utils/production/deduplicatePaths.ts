import paper from 'paper';
import { ProductionArea } from './processProduction';
import { cleanPath } from '../paperUtils';

/**
 * Deduplicates paths in a set of production areas.
 * This ensures that shared boundaries between pieces are only traversed once in the final SVG.
 * 
 * Logic:
 * 1. Start with an empty "combined area".
 * 2. For each piece:
 *    a. Take its boundary path.
 *    b. Subtract the current "combined area" from this path.
 *    c. The result is the set of edges that are unique to this piece (not shared with previous pieces).
 *    d. Add the result to our collection of cut lines.
 *    e. Update the "combined area" by uniting it with the current piece.
 */
export function deduplicateProductionPaths(areas: ProductionArea[]): string[] {
  // Initialize a temporary Paper.js project
  const canvas = document.createElement('canvas');
  paper.setup(canvas);
  
  const resultPathData: string[] = [];
  let combinedArea: paper.PathItem | null = null;
  
  // Sort areas to ensure deterministic results
  const sortedAreas = [...areas].sort((a, b) => a.id.localeCompare(b.id));
  
  try {
    for (const area of sortedAreas) {
      // Use CompoundPath to safely handle both single and multiple contours (holes)
      const piecePath = new paper.CompoundPath({
        pathData: area.pathData,
        insert: false
      });
      
      if (!combinedArea) {
        // First piece: all edges are unique
        resultPathData.push(piecePath.pathData);
        combinedArea = piecePath.clone({ insert: false });
      } else {
        // Subtract the already processed area from the current piece's boundary.
        // Paper.js boolean operations on a Path vs an Area will return the 
        // segments of the path that lie outside the area.
        // Shared edges are considered "inside" or "on the boundary" and thus removed.
        const uniqueEdges = piecePath.subtract(combinedArea);
        
        if (uniqueEdges && !uniqueEdges.isEmpty()) {
          resultPathData.push(uniqueEdges.pathData);
        }
        
        // Update the combined area for the next iteration
        const nextCombined = combinedArea.unite(piecePath);
        combinedArea.remove();
        combinedArea = nextCombined;
        
        if (uniqueEdges) uniqueEdges.remove();
      }
      
      piecePath.remove();
    }
  } catch (err) {
    console.error('Error during path deduplication:', err);
    // Fallback: return original paths if deduplication fails
    return areas.map(a => a.pathData);
  } finally {
    if (combinedArea) combinedArea.remove();
  }
  
  return resultPathData;
}
