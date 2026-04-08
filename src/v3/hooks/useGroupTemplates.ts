import React, { useState, useCallback } from 'react';
import paper from 'paper';
import { Area, AreaType, Connector } from '../types';
import { GroupTemplate, GroupInstance } from '../types/groupTemplateTypes';
import { resetPaperProject, pathItemFromBoundaryData } from '../utils/paperUtils';
import {
  computeGroupBoundary,
  extractBoundarySlots,
  refreshTemplateCache,
  materializeBoundarySlots,
  applyInstanceTransform
} from '../utils/groupTemplateUtils';

export function useGroupTemplates(
  areas: Record<string, Area>,
  setAreas: React.Dispatch<React.SetStateAction<Record<string, Area>>>,
  connectors: Record<string, Connector>,
  setConnectors: React.Dispatch<React.SetStateAction<Record<string, Connector>>>,
  width: number,
  height: number
) {
  const [groupTemplates, setGroupTemplates] = useState<Record<string, GroupTemplate>>({});

  /**
   * Creates a group template from a set of selected piece IDs.
   * Computes the outer boundary and extracts external connector slots.
   */
  const createGroupTemplate = useCallback((name: string, pieceIds: string[]) => {
    resetPaperProject(width, height);

    const { pathData, boundary } = computeGroupBoundary(pieceIds, areas);
    const boundarySlots = extractBoundarySlots(pieceIds, areas, connectors, boundary);
    boundary.remove();

    const id = `template-${Math.random().toString(36).slice(2, 8)}`;
    const template: GroupTemplate = {
      id,
      name,
      sourcePieceIds: pieceIds,
      cachedBoundaryPathData: pathData,
      boundarySlots
    };

    setGroupTemplates(prev => ({ ...prev, [id]: template }));
    return template;
  }, [areas, connectors, width, height]);

  /**
   * Places a group template instance at the given transform.
   * Creates a new PIECE area with the template boundary (transformed).
   * Does NOT subtract from surrounding pieces (non-destructive overlay).
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
   * Materializes boundary connector slots after an instance has been subdivided.
   * Call this after subdivideGrid on a group instance.
   */
  const materializeInstanceConnectors = useCallback((instanceAreaId: string) => {
    const instanceArea = areas[instanceAreaId];
    if (!instanceArea?.groupInstance) return;

    const template = groupTemplates[instanceArea.groupInstance.templateId];
    if (!template) return;

    resetPaperProject(width, height);

    // Get child pieces
    const childPieces = instanceArea.children
      .map(id => areas[id])
      .filter((a): a is Area => !!a && a.type === AreaType.PIECE);

    if (childPieces.length === 0) return;

    // Reconstruct group boundary
    const groupBoundary = pathItemFromBoundaryData(template.cachedBoundaryPathData);
    const transformed = applyInstanceTransform(groupBoundary, instanceArea.groupInstance.transform);
    groupBoundary.remove();

    const newConnectors = materializeBoundarySlots(template, childPieces, transformed);
    transformed.remove();

    if (newConnectors.length > 0) {
      setConnectors(prev => {
        const next = { ...prev };
        for (const c of newConnectors) {
          next[c.id] = c;
        }
        return next;
      });
    }
  }, [areas, groupTemplates, width, height, setConnectors]);

  /**
   * Reverts a subdivided group instance back to a single PIECE,
   * deleting all child pieces and materialized boundary connectors.
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

    // Remove child pieces and their connectors
    setConnectors(prev => {
      const next = { ...prev };
      const childIdSet = new Set(instanceArea.children);

      // Remove connectors owned by children or materialized from slots
      for (const cId of Object.keys(next)) {
        const c = next[cId];
        if (childIdSet.has(c.pieceId) || c.sourceSlotId) {
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
   * Call when source pieces change.
   */
  const refreshAllTemplateCaches = useCallback(() => {
    resetPaperProject(width, height);

    setGroupTemplates(prev => {
      const next: Record<string, GroupTemplate> = { ...prev };
      let anyChanged = false;

      for (const id of Object.keys(next)) {
        const refreshed = refreshTemplateCache(next[id], areas, connectors);
        if (refreshed) {
          next[id] = refreshed;
          anyChanged = true;
        } else {
          // Source pieces no longer exist — remove template
          delete next[id];
          anyChanged = true;
        }
      }

      return anyChanged ? next : prev;
    });

    // Update all instance boundaries to match refreshed templates
    setAreas(prev => {
      const next: Record<string, Area> = { ...prev };
      let anyChanged = false;

      for (const areaId of Object.keys(next)) {
        const area = next[areaId];
        if (!area.groupInstance) continue;

        const template = groupTemplates[area.groupInstance.templateId];
        if (!template) continue;

        const templateBoundary = pathItemFromBoundaryData(template.cachedBoundaryPathData);
        const transformed = applyInstanceTransform(templateBoundary, area.groupInstance.transform);
        templateBoundary.remove();

        next[areaId] = { ...area, boundary: transformed };
        anyChanged = true;
      }

      return anyChanged ? next : prev;
    });
  }, [areas, connectors, width, height, groupTemplates, setAreas]);

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

    // Remove connectors belonging to removed instances
    setConnectors(prev => {
      const next: Record<string, Connector> = { ...prev };
      for (const cId of Object.keys(next)) {
        if (next[cId].sourceSlotId) {
          delete next[cId];
        }
      }
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
    materializeInstanceConnectors,
    resubdivideInstance,
    refreshAllTemplateCaches,
    removeGroupTemplate
  };
}
