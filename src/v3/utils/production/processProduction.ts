import paper from 'paper';
import { AreaType, PuzzleState } from '../../types';
import { cleanPath } from '../paperUtils';
import { getDisconnectedComponents } from '../puzzleValidation';
import { subtractStampsFromPieces } from '../groupTemplateUtils';
import { mergeAllConnectorsForPiece } from './connectorMerging';

export interface ProductionArea {
  id: string;
  pathData: string;
  color: string;
  area: number;
}

/**
 * Processes the puzzle state for production:
 * 1. Flatten curves (optional) for reliable boolean ops.
 * 2. Subtract STAMP boundaries from overlapping pieces.
 * 3. Sequential piece-by-piece processing:
 *    A. Merge all connectors into the piece's current state.
 *    B. Subtract the expanded piece from all other pieces.
 * 4. Handle any resulting piece splits.
 */
export interface ProcessProductionOptions {
  flattenCurves?: boolean;
  flattenTolerance?: number;
  useLegacyMerge?: boolean;
}

export function processProductionState(puzzleState: PuzzleState, options: ProcessProductionOptions = {}): ProductionArea[] {
  const { flattenCurves = true, flattenTolerance = 0.5, useLegacyMerge = false } = options;
  const { areas, connectors, width, height } = puzzleState;
  const ps = puzzleState as any;

  // Initialize a temporary Paper.js project for processing
  const canvas = document.createElement('canvas');
  paper.setup(canvas);
  paper.view.viewSize = new paper.Size(width, height);

  // 1. Create Paper.js paths for all pieces (original state)
  const piecePaths: Record<string, paper.PathItem> = {};
  const pieceColors: Record<string, string> = {};
  const originalPiecePaths: Record<string, paper.PathItem> = {};

  if (ps.useGraphMode) {
    Object.values(ps.faces || {}).forEach((face: any) => {
      const boundary = new paper.Path();
      (face.edges || []).forEach((eInfo: any) => {
        const edge = ps.edges[eInfo.id];
        if (edge) {
          const temp = new paper.Path(edge.pathData);
          if (eInfo.reversed) temp.reverse();
          boundary.addSegments(temp.segments);
          temp.remove();
        }
      });
      boundary.closed = true;
      piecePaths[face.id] = boundary;
      pieceColors[face.id] = face.color;
      originalPiecePaths[face.id] = boundary.clone({ insert: false });
    });
    
    // Also include whimsies in graph mode
    Object.values(areas).forEach(area => {
      if (area.id.startsWith('whimsy-')) {
        const path = area.boundary.clone({ insert: false });
        piecePaths[area.id] = path;
        pieceColors[area.id] = area.color;
        originalPiecePaths[area.id] = path.clone({ insert: false });
      }
    });
  } else {

  /* 
     TODO: Data Scaling Implementation
     Before performing boolean operations, we should upscale all paths and coordinates 
     (e.g., by a factor of 2.5 to reach a 2000x2000 coordinate space).
     This increases numerical precision for Paper.js boolean operations, 
     reducing errors like "Zero-length paths" or missing intersections.
     After processing, we can either scale back down for display or keep the 
     upscaled version for high-resolution SVG export.
  */

  Object.values(areas).forEach(area => {
    if (area.type === AreaType.PIECE || (area.type === AreaType.STAMP && area.children.length === 0)) {
      // Clone the existing boundary directly to preserve CompoundPath structure and holes
      const path = area.boundary.clone({ insert: false });
      piecePaths[area.id] = path;
      pieceColors[area.id] = area.color;

      // Keep a copy of the original for pre-calculating connectors
      originalPiecePaths[area.id] = path.clone({ insert: false });
    }
  });
  }

  // 1b. Flatten curves to straight segments for more reliable boolean ops
  if (flattenCurves) {
    Object.keys(piecePaths).forEach(id => {
      piecePaths[id].flatten(flattenTolerance);
      originalPiecePaths[id].flatten(flattenTolerance);
    });
  }

  // 1c. Subtract STAMP instance boundaries from overlapping non-stamp pieces
  subtractStampsFromPieces(piecePaths, areas, flattenCurves ? flattenTolerance : undefined);

  const pieceIds = Object.keys(piecePaths);
  const allConnectors = Object.values(connectors).filter(c => !c.disabled);

  // Sequential piece-by-piece processing:
  // For each piece:
  //   A. Merge all its connectors into its CURRENT state (which may have notches from prior pieces).
  //   B. Subtract this expanded piece from ALL other pieces.
  // This ensures every piece interlocks perfectly and no notches are lost.
  pieceIds.forEach(pieceId => {
    const originalPath = originalPiecePaths[pieceId];
    const pieceConnectors = allConnectors.filter(c => c.pieceId === pieceId);
    
    // A. Expand piece with its connectors
    const currentPath = piecePaths[pieceId];
    const expandedPiece = mergeAllConnectorsForPiece(
      currentPath, 
      originalPath, 
      pieceConnectors, 
      puzzleState.whimsies, 
      flattenCurves ? flattenTolerance : undefined,
      useLegacyMerge
    );
    currentPath.remove();
    piecePaths[pieceId] = expandedPiece;

    // B. Subtract this expanded piece from all other pieces
    const expandedBounds = expandedPiece.bounds;
    pieceIds.forEach(otherId => {
      if (otherId === pieceId) return;
      const otherPiece = piecePaths[otherId];
      if (!otherPiece.bounds.intersects(expandedBounds)) return;
      const subtracted = otherPiece.subtract(expandedPiece, { insert: false });
      otherPiece.remove();
      piecePaths[otherId] = cleanPath(subtracted);
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
      const area = Math.abs((comp as any).area || 0);
      // Filter out tiny debris components (area < 0.5px)
      if (area < 0.5) {
        comp.remove();
        return;
      }

      finalAreas.push({
        id: components.length > 1 ? `${id}-part-${index}` : id,
        pathData: comp.pathData,
        color: pieceColors[id],
        area: area
      });
      comp.remove();
    });

    path.remove();
  });

  return finalAreas;
}
