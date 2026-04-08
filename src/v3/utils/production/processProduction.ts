import paper from 'paper';
import { Area, AreaType, Connector, PuzzleState } from '../../types';
import { generateConnectorPath, findNeighborPiece } from '../connectorUtils';
import { cleanPath } from '../paperUtils';
import { getDisconnectedComponents } from '../puzzleValidation';

export interface ProductionArea {
  id: string;
  pathData: string;
  color: string;
  area: number;
}

/**
 * Processes the puzzle state for production:
 * 1. Pre-calculates all connector paths using original boundaries.
 * 2. Unites connectors with their parent pieces.
 * 3. Subtracts connectors from neighboring pieces (either all or clipped to neighbor).
 * 4. Handles any resulting piece splits.
 */
export function processProductionState(puzzleState: PuzzleState, clipToNeighbors: boolean = false): ProductionArea[] {
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

  // 2. Pre-calculate all connector paths using ORIGINAL boundaries (skip disabled connectors)
  const calculatedConnectors = Object.values(connectors).filter(c => !c.disabled).map(c => {
    const parentPiece = originalPiecePaths[c.pieceId];
    if (!parentPiece) return null;

    try {
      const result = generateConnectorPath(
        parentPiece,
        c.pathIndex,
        c.midT,
        c.widthPx,
        c.extrusion,
        c.headTemplateId,
        c.headScale,
        c.headRotationDeg,
        c.useEquidistantHeadPoint,
        puzzleState.whimsies,
        c.jitter,
        c.jitterSeed || 0
      );

      const connectorPath = new paper.CompoundPath({
        pathData: result.pathData,
        insert: false
      });

      // Find neighbor piece
      const sourcePath = (parentPiece instanceof paper.CompoundPath 
        ? parentPiece.children[c.pathIndex] 
        : parentPiece) as paper.Path;
      
      const pt = sourcePath.getPointAt(sourcePath.length * c.midT);
      const normal = sourcePath.getNormalAt(sourcePath.length * c.midT);
      const neighborId = findNeighborPiece(areas, c.pieceId, pt, normal);

      return {
        id: c.id,
        pieceId: c.pieceId,
        neighborId,
        path: connectorPath
      };
    } catch (e) {
      console.error('Error pre-calculating connector:', e);
      return null;
    }
  }).filter(c => c !== null) as { id: string, pieceId: string, neighborId: string | null, path: paper.PathItem }[];

  // 3. Process unions and subtractions
  calculatedConnectors.forEach(c => {
    const parentPiece = piecePaths[c.pieceId];
    if (!parentPiece) return;

    let connectorToUse = c.path;

    // Strategy: Clip to neighbor if requested
    if (clipToNeighbors && c.neighborId && piecePaths[c.neighborId]) {
      const neighborPiece = piecePaths[c.neighborId];
      // Clip connector to the union of parent and neighbor so it doesn't bleed
      const mask = parentPiece.unite(neighborPiece);
      const clipped = connectorToUse.intersect(mask);
      mask.remove();
      connectorToUse = clipped;
    }

    // Unite with parent
    const united = parentPiece.unite(connectorToUse);
    parentPiece.remove();
    piecePaths[c.pieceId] = cleanPath(united);

    // Subtract from neighbors
    if (!clipToNeighbors) {
      // Subtract from EVERY other piece (Default), using bbox pre-filter
      const connectorBounds = connectorToUse.bounds;
      Object.keys(piecePaths).forEach(otherId => {
        if (otherId === c.pieceId) return;
        const otherPiece = piecePaths[otherId];
        // Fast reject: skip if bounding boxes don't intersect
        if (!otherPiece.bounds.intersects(connectorBounds)) return;
        const subtracted = otherPiece.subtract(connectorToUse);
        otherPiece.remove();
        piecePaths[otherId] = cleanPath(subtracted);
      });
    } else if (c.neighborId && piecePaths[c.neighborId]) {
      // Subtract only from the direct neighbor
      const neighborPiece = piecePaths[c.neighborId];
      const subtracted = neighborPiece.subtract(connectorToUse);
      neighborPiece.remove();
      piecePaths[c.neighborId] = cleanPath(subtracted);
    }

    // If we created a clipped copy, remove it
    if (connectorToUse !== c.path) {
      connectorToUse.remove();
    }
  });

  // Cleanup pre-calculated paths and original copies
  calculatedConnectors.forEach(c => c.path.remove());
  Object.values(originalPiecePaths).forEach(p => p.remove());

  // 4. Handle splits and convert to final ProductionArea format
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
