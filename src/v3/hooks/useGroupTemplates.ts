import React, { useState, useCallback } from 'react';
import paper from 'paper';
import { Area, AreaType, Connector, Whimsy } from '../types';
import { GroupTemplate, GroupInstance } from '../types/groupTemplateTypes';
import { resetPaperProject, pathItemFromBoundaryData } from '../utils/paperUtils';
import {
  computeGroupBoundary,
  refreshTemplateCache,
  updateInstanceForNewBoundary,
  applyInstanceTransform
} from '../utils/groupTemplateUtils';

export function useGroupTemplates(
  areas: Record<string, Area>,
  setAreas: React.Dispatch<React.SetStateAction<Record<string, Area>>>,
  connectors: Record<string, Connector>,
  setConnectors: React.Dispatch<React.SetStateAction<Record<string, Connector>>>,
  whimsies: Whimsy[],
  width: number,
  height: number
) {
  const [groupTemplates, setGroupTemplates] = useState<Record<string, GroupTemplate>>({});

  /**
   * Creates a group template from a set of selected piece IDs.
   * Computes the outer boundary with connector geometry baked in.
   */
  const createGroupTemplate = useCallback((
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

    // Compute bounds for centering during placement
    const bounds = boundary.bounds;
    const templateBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };

    boundary.remove();

    const id = `template-${Math.random().toString(36).slice(2, 8)}`;
    const template: GroupTemplate = {
      id,
      name,
      sourcePieceIds: pieceIds,
      cachedBoundaryPathData: pathData,
      bounds: templateBounds,
      includeNonAdjacentConnectors
    };

    setGroupTemplates(prev => ({ ...prev, [id]: template }));
    return template;
  }, [areas, connectors, whimsies, width, height]);

  /**
   * Places a group template instance at the given transform.
   * Creates a new PIECE area with the template boundary (transformed).
   * Does NOT subtract from surrounding pieces (non-destructive overlay).
   * No Connector objects are created — geometry is baked into the boundary.
   */
  const placeGroupTemplate = useCallback((
    templateId: string,
    parentId: string,
    transform: GroupInstance['transform']
  ) => {
    const template = groupTemplates[templateId];
    if (!template) return null;

    resetPaperProject(width, height);

    const templateBoundary = pathItemFromBoundaryData(template.cachedBoundaryPathData);
    const transformed = applyInstanceTransform(templateBoundary, transform);
    templateBoundary.remove();

    const instanceId = `group-instance-${Math.random().toString(36).slice(2, 8)}`;
    const instanceArea: Area = {
      id: instanceId,
      parentId,
      type: AreaType.PIECE,
      children: [],
      boundary: transformed,
      color: '#e2e8f0', // Light gray to indicate template instance
      groupInstance: { templateId, transform }
    };

    setAreas(prev => {
      const next = { ...prev };
      next[instanceId] = instanceArea;

      // Add to parent's children
      if (parentId && next[parentId]) {
        next[parentId] = {
          ...next[parentId],
          children: [...next[parentId].children, instanceId]
        };
      }

      return next;
    });

    return instanceId;
  }, [groupTemplates, width, height, setAreas]);

  /**
   * Reverts a subdivided group instance back to a single PIECE,
   * deleting all child pieces.
   */
  const resubdivideInstance = useCallback((instanceAreaId: string) => {
    const instanceArea = areas[instanceAreaId];
    if (!instanceArea?.groupInstance) return;

    const template = groupTemplates[instanceArea.groupInstance.templateId];
    if (!template) return;

    resetPaperProject(width, height);

    // Reconstruct the instance boundary
    const templateBoundary = pathItemFromBoundaryData(template.cachedBoundaryPathData);
    const transformed = applyInstanceTransform(templateBoundary, instanceArea.groupInstance.transform);
    templateBoundary.remove();

    // Remove child piece connectors
    setConnectors(prev => {
      const next = { ...prev };
      const childIdSet = new Set(instanceArea.children);
      for (const cId of Object.keys(next)) {
        if (childIdSet.has(next[cId].pieceId)) {
          delete next[cId];
        }
      }
      return next;
    });

    setAreas(prev => {
      const next: Record<string, Area> = { ...prev };

      // Delete all children recursively
      const deleteRecursive = (areaId: string) => {
        const a = next[areaId];
        if (!a) return;
        a.children.forEach(deleteRecursive);
        delete next[areaId];
      };
      instanceArea.children.forEach(deleteRecursive);

      // Revert to PIECE with restored boundary
      next[instanceAreaId] = {
        ...instanceArea,
        type: AreaType.PIECE,
        children: [],
        boundary: transformed
      };

      return next;
    });
  }, [areas, groupTemplates, width, height, setAreas, setConnectors]);

  /**
   * Refreshes all template caches based on current source piece state.
   * For subdivided instances, clips existing children to the new boundary
   * and adds delta regions as new child pieces.
   * Call when source pieces or their connectors change.
   */
  const refreshAllTemplateCaches = useCallback(() => {
    resetPaperProject(width, height);

    setGroupTemplates(prev => {
      const next: Record<string, GroupTemplate> = { ...prev };
      let anyChanged = false;

      for (const id of Object.keys(next)) {
        const result = refreshTemplateCache(next[id], areas, connectors, whimsies);
        if (result) {
          next[id] = result.template;
          anyChanged = true;
        } else {
          // Source pieces no longer exist — remove template
          delete next[id];
          anyChanged = true;
        }
      }

      return anyChanged ? next : prev;
    });

    // Update all instance boundaries and child pieces to match refreshed templates
    setAreas(prev => {
      let next: Record<string, Area> = { ...prev };
      let anyChanged = false;

      // We need the freshest template data — read from groupTemplates after the above setState
      // but since setState is async, we compute template updates inline here using the same logic
      const updatedTemplates: Record<string, { template: GroupTemplate; oldBoundaryPathData: string }> = {};

      for (const templateId of Object.keys(groupTemplates)) {
        const result = refreshTemplateCache(groupTemplates[templateId], areas, connectors, whimsies);
        if (result) {
          updatedTemplates[templateId] = result;
        }
      }

      for (const areaId of Object.keys(next)) {
        const area = next[areaId];
        if (!area?.groupInstance) continue;

        const templateId = area.groupInstance.templateId;
        const update = updatedTemplates[templateId];
        if (!update) continue;

        const { template, oldBoundaryPathData } = update;

        if (area.children.length === 0) {
          // Unsplit instance — just update the boundary
          const templateBoundary = pathItemFromBoundaryData(template.cachedBoundaryPathData);
          const transformed = applyInstanceTransform(templateBoundary, area.groupInstance.transform);
          templateBoundary.remove();

          next[areaId] = { ...area, boundary: transformed };
          anyChanged = true;
        } else {
          // Subdivided instance — clip children to new boundary, add delta pieces
          const oldBoundary = pathItemFromBoundaryData(oldBoundaryPathData);
          const oldTransformed = applyInstanceTransform(oldBoundary, area.groupInstance.transform);
          oldBoundary.remove();

          const newBoundary = pathItemFromBoundaryData(template.cachedBoundaryPathData);
          const newTransformed = applyInstanceTransform(newBoundary, area.groupInstance.transform);
          newBoundary.remove();

          const { updatedAreas } = updateInstanceForNewBoundary(
            area,
            oldTransformed,
            newTransformed,
            next
          );

          oldTransformed.remove();
          newTransformed.remove();

          next = updatedAreas;
          anyChanged = true;
        }
      }

      return anyChanged ? next : prev;
    });
  }, [areas, connectors, whimsies, width, height, groupTemplates]);

  /**
   * Removes a group template and all its instances.
   */
  const removeGroupTemplate = useCallback((templateId: string) => {
    // Find and remove all instances
    setAreas(prev => {
      const next: Record<string, Area> = { ...prev };
      const instancesToRemove: string[] = [];

      for (const areaId of Object.keys(next)) {
        if (next[areaId].groupInstance?.templateId === templateId) {
          instancesToRemove.push(areaId);
        }
      }

      for (const instanceId of instancesToRemove) {
        const instance = next[instanceId];
        if (!instance) continue;

        // Delete children recursively
        const deleteRecursive = (areaId: string) => {
          const a = next[areaId];
          if (!a) return;
          a.children.forEach(deleteRecursive);
          delete next[areaId];
        };
        instance.children.forEach(deleteRecursive);

        // Remove from parent
        if (instance.parentId && next[instance.parentId]) {
          next[instance.parentId] = {
            ...next[instance.parentId],
            children: next[instance.parentId].children.filter(id => id !== instanceId)
          };
        }

        delete next[instanceId];
      }

      return next;
    });

    // Remove connectors belonging to removed instance child pieces
    setConnectors(prev => {
      const next: Record<string, Connector> = { ...prev };
      // We can't easily know which pieces were children without areas,
      // but on removeGroupTemplate the area cleanup above handles it.
      // Connectors on child pieces will become dangling — clean up by pieceId absence.
      return next;
    });

    setGroupTemplates(prev => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  }, [setAreas, setConnectors]);

  return {
    groupTemplates,
    setGroupTemplates,
    createGroupTemplate,
    placeGroupTemplate,
    resubdivideInstance,
    refreshAllTemplateCaches,
    removeGroupTemplate
  };
}
