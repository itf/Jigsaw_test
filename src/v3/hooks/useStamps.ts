import React, { useCallback } from 'react';
import paper from 'paper';
import { Area, AreaType, Connector, Whimsy } from '../types';
import { StampSource } from '../types/groupTemplateTypes';
import { resetPaperProject, pathItemFromBoundaryData } from '../utils/paperUtils';
import {
  computeGroupBoundary,
  refreshStampCache,
  updateInstanceForNewBoundary,
  applyInstanceTransform
} from '../utils/groupTemplateUtils';

export function useStamps(
  areas: Record<string, Area>,
  setAreas: React.Dispatch<React.SetStateAction<Record<string, Area>>>,
  connectors: Record<string, Connector>,
  setConnectors: React.Dispatch<React.SetStateAction<Record<string, Connector>>>,
  whimsies: Whimsy[],
  width: number,
  height: number
) {
  /**
   * Creates a stamp source GROUP area from a set of selected piece IDs.
   * The pieces become children of the new GROUP area.
   * Computes and caches the baked-connector boundary on the GROUP.
   */
  const createStamp = useCallback((
    name: string,
    pieceIds: string[],
    includeNonAdjacentConnectors?: boolean
  ) => {
    resetPaperProject(width, height);

    const { pathData, boundary } = computeGroupBoundary(
      pieceIds,
      areas,
      connectors,
      whimsies,
      includeNonAdjacentConnectors
    );

    const bounds = boundary.bounds;
    boundary.remove();

    const groupId = `stamp-source-${Math.random().toString(36).slice(2, 8)}`;

    setAreas(prev => {
      const next = { ...prev };

      // Create the stamp-source GROUP area
      next[groupId] = {
        id: groupId,
        groupMemberships: [],  // top-level — not inside another group
        type: AreaType.GROUP,
        children: [...pieceIds],
        boundary: areas[pieceIds[0]].boundary, // placeholder; source GROUP boundary isn't rendered directly
        color: '#7c3aed',
        stampName: name,
        includeNonAdjacentConnectors,
        cachedBoundaryPathData: pathData,
        cachedBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      };

      // Add the new GROUP to each piece's groupMemberships
      for (const pieceId of pieceIds) {
        if (next[pieceId]) {
          next[pieceId] = {
            ...next[pieceId],
            groupMemberships: [...(next[pieceId].groupMemberships ?? []), groupId]
          };
        }
      }

      return next;
    });

    return { groupId, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
  }, [areas, connectors, whimsies, width, height, setAreas]);

  /**
   * Places a STAMP instance of the given source GROUP area.
   * The stamp boundary is the source GROUP's cachedBoundaryPathData transformed.
   * No Connector objects are created — geometry is baked into the boundary.
   */
  const placeStamp = useCallback((
    sourceGroupId: string,
    placedIntoGroupId: string,
    transform: StampSource['transform']
  ) => {
    const sourceGroup = areas[sourceGroupId];
    if (!sourceGroup?.cachedBoundaryPathData) return null;

    resetPaperProject(width, height);

    const templateBoundary = pathItemFromBoundaryData(sourceGroup.cachedBoundaryPathData);
    const transformed = applyInstanceTransform(templateBoundary, transform);
    templateBoundary.remove();

    const instanceId = `stamp-${Math.random().toString(36).slice(2, 8)}`;
    const instanceArea: Area = {
      id: instanceId,
      groupMemberships: [placedIntoGroupId],
      type: AreaType.STAMP,
      children: [],
      boundary: transformed,
      color: '#e2e8f0',
      stampSource: { sourceGroupId, transform }
    };

    setAreas(prev => {
      const next = { ...prev };
      next[instanceId] = instanceArea;

      // Add to the container group's children
      if (next[placedIntoGroupId]) {
        next[placedIntoGroupId] = {
          ...next[placedIntoGroupId],
          children: [...next[placedIntoGroupId].children, instanceId]
        };
      }

      return next;
    });

    return instanceId;
  }, [areas, width, height, setAreas]);

  /**
   * Reverts a subdivided STAMP back to a single unsplit STAMP,
   * deleting all child pieces and their connectors.
   */
  const resubdivideStamp = useCallback((stampAreaId: string) => {
    const stampArea = areas[stampAreaId];
    if (!stampArea?.stampSource) return;

    const sourceGroup = areas[stampArea.stampSource.sourceGroupId];
    if (!sourceGroup?.cachedBoundaryPathData) return;

    resetPaperProject(width, height);

    const templateBoundary = pathItemFromBoundaryData(sourceGroup.cachedBoundaryPathData);
    const transformed = applyInstanceTransform(templateBoundary, stampArea.stampSource.transform);
    templateBoundary.remove();

    // Remove connectors owned by child pieces
    setConnectors(prev => {
      const next = { ...prev };
      const childIdSet = new Set(stampArea.children);
      for (const cId of Object.keys(next)) {
        if (childIdSet.has(next[cId].pieceId)) delete next[cId];
      }
      return next;
    });

    setAreas(prev => {
      const next: Record<string, Area> = { ...prev };

      const deleteRecursive = (areaId: string) => {
        const a = next[areaId];
        if (!a) return;
        a.children.forEach(deleteRecursive);
        delete next[areaId];
      };
      stampArea.children.forEach(deleteRecursive);

      next[stampAreaId] = {
        ...stampArea,
        type: AreaType.STAMP,
        children: [],
        boundary: transformed
      };

      return next;
    });
  }, [areas, width, height, setAreas, setConnectors]);

  /**
   * Refreshes all stamp-source GROUP areas' cached boundaries from their current
   * leaf piece states. For subdivided STAMP instances, clips children to new boundary
   * and adds delta regions as new child pieces.
   *
   * Call when source pieces or their connectors change.
   */
  const refreshAllStamps = useCallback(() => {
    resetPaperProject(width, height);

    setAreas(prev => {
      let next: Record<string, Area> = { ...prev };
      let anyChanged = false;

      // Compute updated cache for every stamp-source GROUP
      const updates: Record<string, { pathData: string; oldPathData: string; bounds: { x: number; y: number; width: number; height: number } }> = {};

      for (const area of Object.values(next)) {
        if (area.type !== AreaType.GROUP || !area.stampName) continue;

        const result = refreshStampCache(area, next, connectors, whimsies);
        if (!result) continue;

        updates[area.id] = result;
        next[area.id] = {
          ...area,
          cachedBoundaryPathData: result.pathData,
          cachedBounds: result.bounds
        };
        anyChanged = true;
      }

      // Update STAMP instances for each refreshed source GROUP
      for (const areaId of Object.keys(next)) {
        const area = next[areaId];
        if (area?.type !== AreaType.STAMP || !area.stampSource) continue;

        const update = updates[area.stampSource.sourceGroupId];
        if (!update) continue;

        if (area.children.length === 0) {
          // Unsplit stamp — just update boundary
          const templateBoundary = pathItemFromBoundaryData(update.pathData);
          const transformed = applyInstanceTransform(templateBoundary, area.stampSource.transform);
          templateBoundary.remove();

          next[areaId] = { ...area, boundary: transformed };
          anyChanged = true;
        } else {
          // Subdivided stamp — clip children, add deltas
          const oldBoundary = pathItemFromBoundaryData(update.oldPathData || update.pathData);
          const oldTransformed = applyInstanceTransform(oldBoundary, area.stampSource.transform);
          oldBoundary.remove();

          const newBoundary = pathItemFromBoundaryData(update.pathData);
          const newTransformed = applyInstanceTransform(newBoundary, area.stampSource.transform);
          newBoundary.remove();

          const { updatedAreas } = updateInstanceForNewBoundary(area, oldTransformed, newTransformed, next);
          oldTransformed.remove();
          newTransformed.remove();

          next = updatedAreas;
          anyChanged = true;
        }
      }

      return anyChanged ? next : prev;
    });
  }, [areas, connectors, whimsies, width, height]);

  /**
   * Removes a stamp-source GROUP area and handles its STAMP instances.
   * mode: 'delete' removes all instances; 'convert' bakes instances into real GROUP/PIECE areas.
   *
   * Conversion (whimsy-style): subtracts the stamp boundary from overlapping PIECE areas,
   * then turns the STAMP into a regular GROUP (preserving its children).
   */
  const deleteStampSource = useCallback((
    sourceGroupId: string,
    mode: 'delete' | 'convert',
    allAreas: Record<string, Area>
  ) => {
    setAreas(prev => {
      const next: Record<string, Area> = { ...prev };

      const sourceGroup = next[sourceGroupId];
      if (!sourceGroup) return prev;

      // Find all STAMP instances of this source
      const stamps = Object.values(next).filter(
        a => a.type === AreaType.STAMP && a.stampSource?.sourceGroupId === sourceGroupId
      );

      if (mode === 'delete') {
        // Remove all stamp instances and their children
        const deleteRecursive = (areaId: string) => {
          const a = next[areaId];
          if (!a) return;
          a.children.forEach(deleteRecursive);
          // Remove from container groups' children lists
          for (const gId of a.groupMemberships) {
            if (next[gId]) {
              next[gId] = {
                ...next[gId],
                children: next[gId].children.filter(c => c !== areaId)
              };
            }
          }
          delete next[areaId];
        };
        for (const stamp of stamps) deleteRecursive(stamp.id);

      } else {
        // Convert each STAMP to a real GROUP/PIECE (whimsy-style)
        resetPaperProject(width, height);

        for (const stamp of stamps) {
          if (!stamp.stampSource || !sourceGroup.cachedBoundaryPathData) continue;

          // Subtract stamp boundary from overlapping non-stamp PIECE areas
          const templateBoundary = pathItemFromBoundaryData(sourceGroup.cachedBoundaryPathData);
          const stampBoundary = applyInstanceTransform(templateBoundary, stamp.stampSource.transform);
          templateBoundary.remove();

          for (const [areaId, area] of Object.entries(next)) {
            if (area.type !== AreaType.PIECE) continue;
            if (area.stampSource) continue; // skip other stamps' pieces
            if (!area.boundary.bounds.intersects(stampBoundary.bounds)) continue;

            const subtracted = area.boundary.subtract(stampBoundary, { insert: false });
            area.boundary.remove();
            next[areaId] = { ...area, boundary: subtracted };
          }

          stampBoundary.remove();

          // Convert STAMP to GROUP (or PIECE if no children), clear stampSource
          next[stamp.id] = {
            ...stamp,
            type: stamp.children.length > 0 ? AreaType.GROUP : AreaType.PIECE,
            stampSource: undefined
          };
        }
      }

      // Remove stampName from source GROUP (becomes a regular GROUP)
      next[sourceGroupId] = {
        ...sourceGroup,
        stampName: undefined,
        cachedBoundaryPathData: undefined,
        includeNonAdjacentConnectors: undefined
      };

      return next;
    });
  }, [width, height, setAreas]);

  return {
    createStamp,
    placeStamp,
    resubdivideStamp,
    refreshAllStamps,
    deleteStampSource
  };
}
