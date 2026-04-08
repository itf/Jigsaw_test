import paper from 'paper';
import { Area, AreaType, Connector, Whimsy } from '../types';
import { cleanPath } from './paperUtils';
import { findNeighborPiece, generateConnectorPath } from './connectorUtils';
import { getDisconnectedComponents } from './puzzleValidation';

/**
 * Computes the outer boundary of a set of pieces by iteratively uniting them,
 * then bakes connector geometry in:
 *   - Outward connectors (owned by group pieces, neighbor outside) → united in
 *   - Inward connectors (owned by neighbor pieces, neighbor inside group) → subtracted
 *
 * Uses the same unite-then-subtract-intersection trick as mergePieces for Paper.js reliability.
 * Caller must ensure Paper.js project is initialized.
 */
export function computeGroupBoundary(
  pieceIds: string[],
  areas: Record<string, Area>,
  connectors?: Record<string, Connector>,
  whimsies?: Whimsy[],
  includeNonAdjacent?: boolean
): { pathData: string; boundary: paper.PathItem } {
  const validIds = pieceIds.filter(id => areas[id] && areas[id].type === AreaType.PIECE);
  if (validIds.length === 0) {
    throw new Error('No valid pieces to compute group boundary from');
  }

  let currentPath = areas[validIds[0]].boundary.clone({ insert: false });

  for (let i = 1; i < validIds.length; i++) {
    const otherPath = areas[validIds[i]].boundary.clone({ insert: false });

    // unite-then-subtract-intersection for Paper.js reliability (same as mergePieces)
    const intersection = currentPath.intersect(otherPath, { insert: false });
    const united = currentPath.unite(otherPath, { insert: false });
    const result = united.subtract(intersection, { insert: false });

    intersection.remove();
    united.remove();
    currentPath.remove();
    otherPath.remove();

    currentPath = result;
  }

  currentPath = cleanPath(currentPath);

  if (connectors) {
    currentPath = applyConnectorsToBoundary(
      currentPath,
      new Set(validIds),
      areas,
      connectors,
      whimsies ?? [],
      includeNonAdjacent ?? false
    );
  }

  return {
    pathData: currentPath.pathData,
    boundary: currentPath
  };
}

/**
 * Applies connector geometry to the group boundary, mirroring processProductionState():
 *   - Connectors owned by group pieces that point outward → united into boundary
 *   - Connectors owned by non-group pieces that point into the group → subtracted from boundary
 */
function applyConnectorsToBoundary(
  boundary: paper.PathItem,
  pieceIdSet: Set<string>,
  areas: Record<string, Area>,
  connectors: Record<string, Connector>,
  whimsies: Whimsy[],
  includeNonAdjacent: boolean
): paper.PathItem {
  const originalPiecePaths: Record<string, paper.PathItem> = {};
  for (const id of Object.keys(areas)) {
    if (areas[id]?.type === AreaType.PIECE) {
      originalPiecePaths[id] = areas[id].boundary.clone({ insert: false });
    }
  }

  interface CalcConnector {
    connector: Connector;
    path: paper.PathItem;
    neighborId: string | null;
  }

  const calculated: CalcConnector[] = [];

  for (const connector of Object.values(connectors)) {
    if (connector.disabled) continue;
    const parentPath = originalPiecePaths[connector.pieceId];
    if (!parentPath) continue;

    try {
      const result = generateConnectorPath(
        parentPath,
        connector.pathIndex,
        connector.midT,
        connector.widthPx,
        connector.extrusion,
        connector.headTemplateId,
        connector.headScale,
        connector.headRotationDeg,
        connector.useEquidistantHeadPoint,
        whimsies,
        connector.jitter,
        connector.jitterSeed ?? 0
      );

      const connectorPath = new paper.CompoundPath({
        pathData: result.pathData,
        insert: false
      });

      const sourcePath = (parentPath instanceof paper.CompoundPath
        ? parentPath.children[connector.pathIndex]
        : parentPath) as paper.Path;
      const pt = sourcePath.getPointAt(sourcePath.length * connector.midT);
      const normal = sourcePath.getNormalAt(sourcePath.length * connector.midT);
      const neighborId = findNeighborPiece(areas, connector.pieceId, pt, normal);

      calculated.push({ connector, path: connectorPath, neighborId });
    } catch (e) {
      console.error('Error computing connector path for group boundary:', e);
    }
  }

  for (const { connector, path, neighborId } of calculated) {
    const ownedByGroup = pieceIdSet.has(connector.pieceId);

    if (ownedByGroup) {
      const neighborInGroup = neighborId && pieceIdSet.has(neighborId);
      if (!neighborInGroup) {
        const united = boundary.unite(path, { insert: false });
        boundary.remove();
        boundary = cleanPath(united);
      }
    } else {
      const neighborInGroup = neighborId && pieceIdSet.has(neighborId);
      if (neighborInGroup) {
        const subtracted = boundary.subtract(path, { insert: false });
        boundary.remove();
        boundary = cleanPath(subtracted);
      } else if (includeNonAdjacent && path.bounds.intersects(boundary.bounds)) {
        const subtracted = boundary.subtract(path, { insert: false });
        boundary.remove();
        boundary = cleanPath(subtracted);
      }
    }

    path.remove();
  }

  for (const p of Object.values(originalPiecePaths)) {
    p.remove();
  }

  return boundary;
}

/**
 * Recursively collects all leaf PIECE descendants of an area.
 */
export function collectLeafPieceIds(id: string, areas: Record<string, Area>): string[] {
  const area = areas[id];
  if (!area) return [];
  if (area.type === AreaType.PIECE) return [id];
  return area.children.flatMap(childId => collectLeafPieceIds(childId, areas));
}

/**
 * Refreshes a stamp-source GROUP area's cached boundary from its current leaf pieces.
 * If a child piece has been subdivided into a GROUP, its leaf PIECE descendants are used.
 * Returns the new pathData and old pathData, or null if no valid pieces remain.
 */
export function refreshStampCache(
  sourceGroup: Area,
  areas: Record<string, Area>,
  connectors: Record<string, Connector>,
  whimsies: Whimsy[]
): { pathData: string; bounds: { x: number; y: number; width: number; height: number }; oldPathData: string } | null {
  const leafIds = sourceGroup.children
    .flatMap(id => (areas[id] ? collectLeafPieceIds(id, areas) : []))
    .filter((id, i, arr) => arr.indexOf(id) === i);

  if (leafIds.length === 0) return null;

  const { pathData, boundary } = computeGroupBoundary(
    leafIds,
    areas,
    connectors,
    whimsies,
    sourceGroup.includeNonAdjacentConnectors
  );

  const b = boundary.bounds;
  const bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  boundary.remove();

  return {
    pathData,
    bounds,
    oldPathData: sourceGroup.cachedBoundaryPathData ?? ''
  };
}

/**
 * Updates the children of a subdivided STAMP instance when the source boundary changes.
 *
 * 1. Clips existing child pieces to the new boundary (preserves subdivision work)
 * 2. Adds delta regions (new area not in old boundary) as new child pieces
 */
export function updateInstanceForNewBoundary(
  instanceArea: Area,
  oldBoundaryPath: paper.PathItem,
  newBoundaryPath: paper.PathItem,
  areas: Record<string, Area>
): { updatedAreas: Record<string, Area>; newPieceIds: string[] } {
  const updatedAreas: Record<string, Area> = { ...areas };
  const newPieceIds: string[] = [];
  const survivingChildIds: string[] = [];

  for (const childId of instanceArea.children) {
    const child = areas[childId];
    if (!child || child.type !== AreaType.PIECE) continue;

    const clipped = child.boundary.intersect(newBoundaryPath, { insert: false });
    const components = getDisconnectedComponents(clipped);
    clipped.remove();

    const validComponents = components.filter(c => Math.abs((c as any).area ?? 0) > 0.1);

    if (validComponents.length === 0) {
      delete updatedAreas[childId];
      continue;
    }

    updatedAreas[childId] = { ...child, boundary: validComponents[0] };
    survivingChildIds.push(childId);

    for (let i = 1; i < validComponents.length; i++) {
      const newId = `${childId}-split-${i}-${Math.random().toString(36).slice(2, 6)}`;
      updatedAreas[newId] = {
        ...child,
        id: newId,
        boundary: validComponents[i]
      };
      survivingChildIds.push(newId);
      newPieceIds.push(newId);
    }
  }

  // Delta: new area not in old boundary
  const delta = newBoundaryPath.subtract(oldBoundaryPath, { insert: false });
  const deltaComponents = getDisconnectedComponents(delta);
  delta.remove();

  for (const comp of deltaComponents) {
    if (Math.abs((comp as any).area ?? 0) < 0.1) { comp.remove(); continue; }

    const newId = `delta-${instanceArea.id}-${Math.random().toString(36).slice(2, 6)}`;
    updatedAreas[newId] = {
      id: newId,
      groupMemberships: [instanceArea.id],
      type: AreaType.PIECE,
      children: [],
      boundary: comp,
      color: instanceArea.color
    };
    survivingChildIds.push(newId);
    newPieceIds.push(newId);
  }

  updatedAreas[instanceArea.id] = { ...instanceArea, children: survivingChildIds };

  return { updatedAreas, newPieceIds };
}

/**
 * Applies a stamp transform to a Paper.js PathItem.
 * Returns a new (cloned + transformed) PathItem.
 */
export function applyInstanceTransform(
  boundary: paper.PathItem,
  transform: { translateX: number; translateY: number; rotation: number; flipX: boolean }
): paper.PathItem {
  const clone = boundary.clone({ insert: false });

  if (transform.flipX) {
    clone.scale(-1, 1);
  }

  if (transform.rotation !== 0) {
    clone.rotate(transform.rotation);
  }

  clone.translate(new paper.Point(transform.translateX, transform.translateY));

  return clone;
}

/**
 * Subtracts all STAMP instance boundaries from overlapping non-stamp PIECE areas.
 * Used during production processing only.
 */
export function subtractStampsFromPieces(
  piecePaths: Record<string, paper.PathItem>,
  areas: Record<string, Area>
): Record<string, paper.PathItem> {
  const stampPieceIds = new Set<string>();
  const stampBoundaries: paper.PathItem[] = [];

  for (const area of Object.values(areas)) {
    if (area.type !== AreaType.STAMP) continue;
    if (!area.stampSource) continue;

    const sourceGroup = areas[area.stampSource.sourceGroupId];
    if (!sourceGroup?.cachedBoundaryPathData) continue;

    // Collect all child pieces of this stamp instance
    const collectChildren = (areaId: string) => {
      const a = areas[areaId];
      if (!a) return;
      if (a.type === AreaType.PIECE) {
        stampPieceIds.add(areaId);
      } else {
        a.children.forEach(collectChildren);
      }
    };

    if (area.children.length > 0) {
      area.children.forEach(collectChildren);
    } else {
      stampPieceIds.add(area.id);
    }

    const templateBoundary = new paper.CompoundPath({
      pathData: sourceGroup.cachedBoundaryPathData,
      insert: false
    });
    const transformed = applyInstanceTransform(templateBoundary, area.stampSource.transform);
    templateBoundary.remove();
    stampBoundaries.push(transformed);
  }

  for (const boundary of stampBoundaries) {
    const boundaryBounds = boundary.bounds;

    for (const [pieceId, piecePath] of Object.entries(piecePaths)) {
      if (stampPieceIds.has(pieceId)) continue;
      if (!piecePath.bounds.intersects(boundaryBounds)) continue;

      const subtracted = piecePath.subtract(boundary, { insert: false });
      piecePath.remove();
      piecePaths[pieceId] = cleanPath(subtracted);
    }
  }

  stampBoundaries.forEach(b => b.remove());

  return piecePaths;
}
