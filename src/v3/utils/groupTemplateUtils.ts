import paper from 'paper';
import { Area, AreaType, Connector, Whimsy } from '../types';
import { GroupTemplate } from '../types/groupTemplateTypes';
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
 *
 * Uses originalPiecePaths (unmodified) to generate connector paths, same as production does.
 */
function applyConnectorsToBoundary(
  boundary: paper.PathItem,
  pieceIdSet: Set<string>,
  areas: Record<string, Area>,
  connectors: Record<string, Connector>,
  whimsies: Whimsy[],
  includeNonAdjacent: boolean
): paper.PathItem {
  // Snapshot original piece boundaries before any modification (mirrors production pattern)
  const originalPiecePaths: Record<string, paper.PathItem> = {};
  for (const id of Object.keys(areas)) {
    if (areas[id]?.type === AreaType.PIECE) {
      originalPiecePaths[id] = areas[id].boundary.clone({ insert: false });
    }
  }

  // Pre-compute all connector paths using original boundaries
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

      // Determine neighbor using original source path
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

  // Apply unions (outward) and subtractions (inward)
  for (const { connector, path, neighborId } of calculated) {
    const ownedByGroup = pieceIdSet.has(connector.pieceId);

    if (ownedByGroup) {
      // Outward connector: neighbor is outside the group (or no neighbor)
      const neighborInGroup = neighborId && pieceIdSet.has(neighborId);
      if (!neighborInGroup) {
        const united = boundary.unite(path, { insert: false });
        boundary.remove();
        boundary = cleanPath(united);
      }
      // Internal connectors (both endpoints in group) are ignored
    } else {
      // Connector owned by a non-group piece — check if it points into the group
      const neighborInGroup = neighborId && pieceIdSet.has(neighborId);

      if (neighborInGroup) {
        // Direct neighbor is in the group → subtract
        const subtracted = boundary.subtract(path, { insert: false });
        boundary.remove();
        boundary = cleanPath(subtracted);
      } else if (includeNonAdjacent) {
        // Non-adjacent mode: subtract if bounding boxes overlap
        if (path.bounds.intersects(boundary.bounds)) {
          const subtracted = boundary.subtract(path, { insert: false });
          boundary.remove();
          boundary = cleanPath(subtracted);
        }
      }
    }

    path.remove();
  }

  // Cleanup snapshots
  for (const p of Object.values(originalPiecePaths)) {
    p.remove();
  }

  return boundary;
}

/**
 * Recursively collects all leaf PIECE descendants of an area.
 * If the area is itself a PIECE, returns [id].
 * If it's a GROUP, recurses into children.
 */
function collectLeafPieceIds(id: string, areas: Record<string, Area>): string[] {
  const area = areas[id];
  if (!area) return [];
  if (area.type === AreaType.PIECE) return [id];
  return area.children.flatMap(childId => collectLeafPieceIds(childId, areas));
}

/**
 * Refreshes a template's cached boundary from the current state of its source pieces.
 * If a source piece has been subdivided into a GROUP, its leaf PIECE descendants are used instead.
 * Captures the old boundary path data so callers can compute the delta for instance updates.
 *
 * Returns { updated template, oldBoundaryPathData } or null if source pieces are gone.
 */
export function refreshTemplateCache(
  template: GroupTemplate,
  areas: Record<string, Area>,
  connectors: Record<string, Connector>,
  whimsies: Whimsy[]
): { template: GroupTemplate; oldBoundaryPathData: string } | null {
  // Resolve each source piece ID to its current leaf PIECE descendants
  const validIds = template.sourcePieceIds
    .flatMap(id => areas[id] ? collectLeafPieceIds(id, areas) : [])
    .filter((id, i, arr) => arr.indexOf(id) === i); // deduplicate

  if (validIds.length === 0) return null;

  const { pathData, boundary } = computeGroupBoundary(
    validIds,
    areas,
    connectors,
    whimsies,
    template.includeNonAdjacentConnectors
  );

  const bounds = boundary.bounds;
  const templateBounds = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };

  boundary.remove();

  const oldBoundaryPathData = template.cachedBoundaryPathData;

  return {
    template: {
      ...template,
      sourcePieceIds: validIds,
      cachedBoundaryPathData: pathData,
      bounds: templateBounds
    },
    oldBoundaryPathData
  };
}

/**
 * Updates the children of a subdivided group instance when the template boundary changes.
 *
 * Strategy:
 *   1. Clip all existing child pieces to the new boundary (preserves user's subdivision work)
 *   2. Compute the delta (new area not in old boundary) and add each disjoint part as a new child piece
 *
 * Returns updated areas map and the IDs of newly created delta pieces.
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

  // Step 1: Clip existing children to new boundary
  for (const childId of instanceArea.children) {
    const child = areas[childId];
    if (!child || child.type !== AreaType.PIECE) continue;

    const clipped = child.boundary.intersect(newBoundaryPath, { insert: false });
    const components = getDisconnectedComponents(clipped);
    clipped.remove();

    // Filter out empty/degenerate components
    const validComponents = components.filter(c => {
      const area = Math.abs((c as any).area ?? 0);
      return area > 0.1;
    });

    if (validComponents.length === 0) {
      // Child fully removed — delete it
      delete updatedAreas[childId];
      validComponents.forEach(c => c.remove());
      continue;
    }

    if (validComponents.length === 1) {
      // Child clipped but still one piece — update boundary in-place
      updatedAreas[childId] = { ...child, boundary: validComponents[0] };
      survivingChildIds.push(childId);
    } else {
      // Child split into multiple parts — first part reuses existing ID, rest get new IDs
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
  }

  // Step 2: Compute delta — new area not covered by old boundary
  const delta = newBoundaryPath.subtract(oldBoundaryPath, { insert: false });
  const deltaComponents = getDisconnectedComponents(delta);
  delta.remove();

  for (const comp of deltaComponents) {
    const area = Math.abs((comp as any).area ?? 0);
    if (area < 0.1) {
      comp.remove();
      continue;
    }

    const newId = `delta-${instanceArea.id}-${Math.random().toString(36).slice(2, 6)}`;
    updatedAreas[newId] = {
      id: newId,
      parentId: instanceArea.id,
      type: AreaType.PIECE,
      children: [],
      boundary: comp,
      color: instanceArea.color
    };
    survivingChildIds.push(newId);
    newPieceIds.push(newId);
  }

  // Update the instance's children list
  updatedAreas[instanceArea.id] = {
    ...instanceArea,
    children: survivingChildIds
  };

  return { updatedAreas, newPieceIds };
}

/**
 * Applies a GroupInstance transform to a Paper.js PathItem.
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
 * Validates that a target boundary matches a template boundary within tolerance.
 * Uses symmetric difference area — if it's near zero, the shapes match.
 */
export function validateTemplatePlacement(
  templateBoundary: paper.PathItem,
  targetBoundary: paper.PathItem,
  tolerance: number = 1.0
): boolean {
  // Symmetric difference = (A unite B) subtract (A intersect B)
  const union = templateBoundary.unite(targetBoundary, { insert: false });
  const intersection = templateBoundary.intersect(targetBoundary, { insert: false });
  const symDiff = union.subtract(intersection, { insert: false });

  const diffArea = Math.abs((symDiff as any).area || 0);

  symDiff.remove();
  union.remove();
  intersection.remove();

  return diffArea < tolerance;
}

/**
 * Subtracts all group instance boundaries from overlapping non-instance pieces.
 * Used during production processing only.
 *
 * Returns updated piece paths map.
 */
export function subtractGroupInstancesFromPieces(
  piecePaths: Record<string, paper.PathItem>,
  areas: Record<string, Area>,
  groupTemplates: Record<string, GroupTemplate>
): Record<string, paper.PathItem> {
  // Collect all group instance area IDs and their child piece IDs
  const instancePieceIds = new Set<string>();
  const instanceBoundaries: paper.PathItem[] = [];

  for (const area of Object.values(areas)) {
    if (!area.groupInstance) continue;

    const template = groupTemplates[area.groupInstance.templateId];
    if (!template) continue;

    // Collect all child pieces of this instance (if subdivided)
    if (area.type === AreaType.GROUP) {
      const collectChildren = (areaId: string) => {
        const a = areas[areaId];
        if (!a) return;
        if (a.type === AreaType.PIECE) {
          instancePieceIds.add(areaId);
        } else {
          a.children.forEach(collectChildren);
        }
      };
      area.children.forEach(collectChildren);
    } else {
      // Not yet subdivided — the instance itself is the piece
      instancePieceIds.add(area.id);
    }

    // Build the instance boundary
    const templateBoundary = new paper.CompoundPath({
      pathData: template.cachedBoundaryPathData,
      insert: false
    });
    const transformed = applyInstanceTransform(templateBoundary, area.groupInstance.transform);
    templateBoundary.remove();
    instanceBoundaries.push(transformed);
  }

  // Subtract each instance boundary from every non-instance piece
  for (const boundary of instanceBoundaries) {
    const boundaryBounds = boundary.bounds;

    for (const [pieceId, piecePath] of Object.entries(piecePaths)) {
      if (instancePieceIds.has(pieceId)) continue;

      // Fast reject: skip if bounding boxes don't intersect
      if (!piecePath.bounds.intersects(boundaryBounds)) continue;

      const subtracted = piecePath.subtract(boundary, { insert: false });
      piecePath.remove();
      piecePaths[pieceId] = cleanPath(subtracted);
    }
  }

  // Cleanup
  instanceBoundaries.forEach(b => b.remove());

  return piecePaths;
}
