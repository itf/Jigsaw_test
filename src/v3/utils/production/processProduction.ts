import paper from 'paper';
import { Area, AreaType, Connector, PuzzleState } from '../../types';
import { generateConnectorPath, findNeighborPiece } from '../connectorUtils';
import { cleanPath } from '../paperUtils';
import { getDisconnectedComponents } from '../puzzleValidation';
import { subtractStampsFromPieces } from '../groupTemplateUtils';
import { mergePathsAtPoints } from '../pathMergeUtils';
import { mergeAllConnectorsForPiece } from './connectorMerging';

export interface ProductionArea {
  id: string;
  pathData: string;
  color: string;
  area: number;
}

/**
 * Processes the puzzle state for production:
 * 1. Pre-calculates all connector paths using original boundaries.
 * 2. Unites ALL connectors with their parent pieces (Pass 1).
 * 3. Subtracts pieces from each other to create the interlocking effect (Pass 2).
 * 4. Handles any resulting piece splits.
 */
export function processProductionState(puzzleState: PuzzleState): ProductionArea[] {
  const { areas, connectors, width, height } = puzzleState;
  
  // Initialize a temporary Paper.js project for processing
  const canvas = document.createElement('canvas');
  paper.setup(canvas);
  paper.view.viewSize = new paper.Size(width, height);

  // 1. Create Paper.js paths for all pieces (original state)
  const piecePaths: Record<string, paper.PathItem> = {};
  const pieceColors: Record<string, string> = {};
  const originalPiecePaths: Record<string, paper.PathItem> = {};
  
  Object.values(areas).forEach(area => {
    if (area.type === AreaType.PIECE) {
      // Clone the existing boundary directly to preserve CompoundPath structure and holes
      const path = area.boundary.clone({ insert: false });
      piecePaths[area.id] = path;
      pieceColors[area.id] = area.color;
      
      // Keep a copy of the original for pre-calculating connectors
      originalPiecePaths[area.id] = path.clone({ insert: false });
    }
  });

  // 1b. Subtract STAMP instance boundaries from overlapping non-stamp pieces
  subtractStampsFromPieces(piecePaths, areas);

  // 2. Sequential Piece-by-Piece Processing
  // For each piece:
  //   A. Merge all its connectors into its CURRENT state (which may have notches).
  //   B. Subtract this expanded piece from ALL other pieces.
  // This ensures that every piece interlocks perfectly and no notches are lost.
  const pieceIds = Object.keys(piecePaths);
  const allConnectors = Object.values(connectors).filter(c => !c.disabled);

  pieceIds.forEach(pieceId => {
    const originalPath = originalPiecePaths[pieceId];
    const pieceConnectors = allConnectors.filter(c => c.pieceId === pieceId);
    
    // A. Merge all connectors into the CURRENT piece path (which might have notches)
    // We use the originalPath for stable calculation of connector positions.
    const currentPath = piecePaths[pieceId];
    const expandedPiece = mergeAllConnectorsForPiece(currentPath, originalPath, pieceConnectors, puzzleState.whimsies);
    
    currentPath.remove();
    piecePaths[pieceId] = expandedPiece;

    // B. Subtract this expanded piece from ALL other pieces
    const expandedBounds = expandedPiece.bounds;
    pieceIds.forEach(otherId => {
      if (otherId === pieceId) return;
      const otherPiece = piecePaths[otherId];
      
      // Only subtract if bounds intersect to save performance
      if (otherPiece.bounds.intersects(expandedBounds)) {
        const subtracted = otherPiece.subtract(expandedPiece);
        otherPiece.remove();
        piecePaths[otherId] = cleanPath(subtracted);
      }
    });
  });

  // Cleanup
  Object.values(originalPiecePaths).forEach(p => p.remove());

  // 5. Handle splits and convert to final ProductionArea format
  const finalAreas: ProductionArea[] = [];
  
  Object.keys(piecePaths).forEach(id => {
    const path = piecePaths[id];
    const components = getDisconnectedComponents(path);
    
    components.forEach((comp, index) => {
      finalAreas.push({
        id: components.length > 1 ? `${id}-part-${index}` : id,
        pathData: comp.pathData,
        color: pieceColors[id],
        area: Math.abs((comp as any).area || 0)
      });
      comp.remove();
    });
    
    path.remove();
  });

  return finalAreas;
}
