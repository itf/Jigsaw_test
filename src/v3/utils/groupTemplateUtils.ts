import paper from 'paper';
import { Area, AreaType, Connector, Whimsy, Point } from '../types';
import { BoundaryConnectorSlot, GroupTemplate } from '../types/groupTemplateTypes';
import { getClosestLocationOnBoundary, getPointOnBoundary, getNormalOnBoundary, cleanPath } from './paperUtils';
import { findNeighborPiece } from './connectorUtils';

/**
 * Computes the outer boundary of a set of pieces by iteratively uniting them.
 * Uses the same unite-then-subtract-intersection trick as mergePieces for Paper.js reliability.
 *
 * Returns the SVG pathData string for the boundary.
 * Caller must ensure Paper.js project is initialized.
 */
export function computeGroupBoundary(
  pieceIds: string[],
  areas: Record<string, Area>
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

  return {
    pathData: currentPath.pathData,
    boundary: currentPath
  };
}

/**
 * Extracts external connector slots from a set of pieces.
 *
 * A connector is "external" if its neighbor is outside the given piece set (or has no neighbor).
 * Each external connector is re-parameterized relative to the group boundary.
 */
export function extractBoundarySlots(
  pieceIds: string[],
  areas: Record<string, Area>,
  connectors: Record<string, Connector>,
  groupBoundary: paper.PathItem
): BoundaryConnectorSlot[] {
  const pieceIdSet = new Set(pieceIds);
  const slots: BoundaryConnectorSlot[] = [];

  for (const connector of Object.values(connectors)) {
    if (!pieceIdSet.has(connector.pieceId)) continue;

    const piece = areas[connector.pieceId];
    if (!piece) continue;

    // Get the connector's midpoint on its piece boundary
    const midPoint = getPointOnBoundary(piece.boundary, connector.midT, connector.pathIndex);
    const normal = getNormalOnBoundary(piece.boundary, connector.midT, connector.pathIndex);

    // Find the neighbor
    const neighborId = findNeighborPiece(areas, connector.pieceId, midPoint, normal);

    // If neighbor is inside the group, this is an internal connector — skip
    if (neighborId && pieceIdSet.has(neighborId)) continue;

    // Re-parameterize relative to the group boundary
    const loc = getClosestLocationOnBoundary(groupBoundary, midPoint);

    const slot: BoundaryConnectorSlot = {
      id: `slot-${connector.id}`,
      pathIndex: loc.pathIndex,
      midT: loc.t,
      worldPoint: { x: midPoint.x, y: midPoint.y },
      widthPx: connector.widthPx,
      extrusion: connector.extrusion,
      headTemplateId: connector.headTemplateId,
      headScale: connector.headScale,
      headRotationDeg: connector.headRotationDeg,
      useEquidistantHeadPoint: connector.useEquidistantHeadPoint,
      jitter: connector.jitter,
      jitterSeed: connector.jitterSeed
    };

    slots.push(slot);
  }

  return slots;
}

/**
 * Refreshes a template's cached boundary and slots from the current state
 * of its source pieces.
 *
 * Returns a new GroupTemplate with updated cache, or null if the source pieces
 * are no longer valid.
 */
export function refreshTemplateCache(
  template: GroupTemplate,
  areas: Record<string, Area>,
  connectors: Record<string, Connector>
): GroupTemplate | null {
  const validIds = template.sourcePieceIds.filter(id => areas[id] && areas[id].type === AreaType.PIECE);
  if (validIds.length === 0) return null;

  const { pathData, boundary } = computeGroupBoundary(validIds, areas);
  const boundarySlots = extractBoundarySlots(validIds, areas, connectors, boundary);
  boundary.remove();

  return {
    ...template,
    sourcePieceIds: validIds,
    cachedBoundaryPathData: pathData,
    boundarySlots
  };
}

/**
 * Materializes boundary connector slots as real Connector objects assigned
 * to the appropriate child pieces of a group instance.
 *
 * For each slot, samples slightly inward from the group boundary to determine
 * which child piece owns that edge segment, then re-parameterizes the slot
 * to that child piece's boundary.
 */
export function materializeBoundarySlots(
  template: GroupTemplate,
  childPieces: Area[],
  groupBoundary: paper.PathItem
): Connector[] {
  const connectors: Connector[] = [];

  for (const slot of template.boundarySlots) {
    // Get the world-space point on the group boundary
    const point = getPointOnBoundary(groupBoundary, slot.midT, slot.pathIndex);
    const normal = getNormalOnBoundary(groupBoundary, slot.midT, slot.pathIndex);

    // Sample slightly inward (opposite of normal, which points outward)
    const inwardPoint = point.subtract(normal.multiply(1.0));

    // Find which child piece contains the inward sample point
    let ownerPiece: Area | null = null;
    for (const child of childPieces) {
      if (child.boundary.contains(inwardPoint)) {
        ownerPiece = child;
        break;
      }
    }

    if (!ownerPiece) {
      // Fallback: try using the stored world point
      const fallbackPoint = new paper.Point(slot.worldPoint.x, slot.worldPoint.y);
      const fallbackInward = fallbackPoint.subtract(normal.multiply(1.0));
      for (const child of childPieces) {
        if (child.boundary.contains(fallbackInward)) {
          ownerPiece = child;
          break;
        }
      }
    }

    if (!ownerPiece) {
      // Last resort: find the nearest child piece boundary
      let minDist = Infinity;
      for (const child of childPieces) {
        const nearest = child.boundary.getNearestPoint(point);
        const dist = nearest.getDistance(point);
        if (dist < minDist) {
          minDist = dist;
          ownerPiece = child;
        }
      }
    }

    if (!ownerPiece) continue;

    // Re-parameterize to the owner piece's boundary
    const loc = getClosestLocationOnBoundary(ownerPiece.boundary, point);

    connectors.push({
      id: `materialized-${slot.id}-${Math.random().toString(36).slice(2, 6)}`,
      pieceId: ownerPiece.id,
      pathIndex: loc.pathIndex,
      midT: loc.t,
      widthPx: slot.widthPx,
      extrusion: slot.extrusion,
      headTemplateId: slot.headTemplateId,
      headScale: slot.headScale,
      headRotationDeg: slot.headRotationDeg,
      useEquidistantHeadPoint: slot.useEquidistantHeadPoint,
      jitter: slot.jitter,
      jitterSeed: slot.jitterSeed,
      sourceSlotId: slot.id
    });
  }

  return connectors;
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
