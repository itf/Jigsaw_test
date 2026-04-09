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
 * 1. Pre-calculates all connector paths using original boundaries.
 * 2. Unites ALL connectors with their parent pieces (Pass 1).
 * 3. Subtracts pieces from each other to create the interlocking effect (Pass 2).
 * 4. Handles any resulting piece splits.
 */
export interface ProcessProductionOptions {
  flattenCurves?: boolean;
  flattenTolerance?: number;
}

export function processProductionState(puzzleState: PuzzleState, options: ProcessProductionOptions = {}): ProductionArea[] {
  const { flattenCurves = true, flattenTolerance = 0.5 } = options;
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

  // 1b. Flatten curves to straight segments for more reliable boolean ops
  if (flattenCurves) {
    Object.keys(piecePaths).forEach(id => {
      piecePaths[id].flatten(flattenTolerance);
      originalPiecePaths[id].flatten(flattenTolerance);
    });
  }

  // 1c. Subtract STAMP instance boundaries from overlapping non-stamp pieces
  subtractStampsFromPieces(piecePaths, areas);

  const pieceIds = Object.keys(piecePaths);
  const allConnectors = Object.values(connectors).filter(c => !c.disabled);

  // Pass 1: Expand each piece that has connectors, and compute the notch shape
  // (expandedA ∩ originalB) for every neighbor B. All intersections are computed
  // against unmodified originals so the result is order-independent.
  const notches: Record<string, paper.PathItem[]> = {};

  pieceIds.forEach(pieceId => {
    const originalPath = originalPiecePaths[pieceId];
    const pieceConnectors = allConnectors.filter(c => c.pieceId === pieceId);
    if (pieceConnectors.length === 0) return; // nothing to expand

    const currentPath = piecePaths[pieceId];
    const expandedPiece = mergeAllConnectorsForPiece(currentPath, originalPath, pieceConnectors, puzzleState.whimsies, flattenCurves ? flattenTolerance : undefined);
    currentPath.remove();
    piecePaths[pieceId] = expandedPiece;

    const expandedBounds = expandedPiece.bounds;
    pieceIds.forEach(otherId => {
      if (otherId === pieceId) return;
      const originalOther = originalPiecePaths[otherId];
      if (!originalOther.bounds.intersects(expandedBounds)) return;
      const notch = expandedPiece.intersect(originalOther, { insert: false });
      if (!notch.isEmpty()) {
        if (!notches[otherId]) notches[otherId] = [];
        notches[otherId].push(notch);
      }
    });
  });

  // Pass 2: Subtract all accumulated notches from each affected piece.
  Object.entries(notches).forEach(([pieceId, pieceNotches]) => {
    let current = piecePaths[pieceId];
    for (const notch of pieceNotches) {
      const next = current.subtract(notch, { insert: false });
      current.remove();
      notch.remove();
      current = cleanPath(next);
    }
    piecePaths[pieceId] = current;
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
