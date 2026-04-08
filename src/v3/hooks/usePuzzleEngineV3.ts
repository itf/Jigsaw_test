import { useState, useCallback, useMemo, useEffect } from 'react';
import paper from 'paper';
import { Delaunay } from 'd3-delaunay';
import { Area, AreaType, Operation, OperationType, PuzzleState, Point, Connector, Whimsy } from '../types';
import { resetPaperProject } from '../utils/paperUtils';
import { generateGridPoints, generateHexGridPoints, generateRandomPoints } from '../utils/gridUtils';
import { getWhimsyTemplatePathData, WhimsyTemplateId } from '../utils/whimsyGallery';
import { validateAndCleanState } from '../utils/puzzleValidation';
import { findNeighborPiece, generateConnectorPath } from '../utils/connectorUtils';
import { useGroupTemplates } from './useGroupTemplates';

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', 
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', 
  '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'
];

function generateSafeRandomColor(): string {
  // Generate a color that is not too dark (< 50) or too light (> 240)
  const r = Math.floor(Math.random() * 190) + 50;
  const g = Math.floor(Math.random() * 190) + 50;
  const b = Math.floor(Math.random() * 190) + 50;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getNeighborColors(areas: Record<string, Area>, boundary: paper.PathItem, excludeIds: string[] = []): Set<string> {
  const neighborColors = new Set<string>();
  
  Object.values(areas).forEach(other => {
    if (excludeIds.includes(other.id) || other.type !== AreaType.PIECE) return;
    
    const otherPath = other.boundary;
    // Check for intersection or very close proximity
    if (boundary.intersects(otherPath)) {
      neighborColors.add(other.color);
    } else {
      const p1 = boundary.getNearestPoint(otherPath.bounds.center);
      const p2 = otherPath.getNearestPoint(p1);
      if (p1.getDistance(p2) < 2) {
        neighborColors.add(other.color);
      }
    }
  });

  return neighborColors;
}

function pickUniqueColor(neighborColors: Set<string>): string {
  const available = COLORS.filter(c => !neighborColors.has(c));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return generateSafeRandomColor();
}

type MassConnectorParams = {
  pieceIds: string[];
  widthRange: [number, number];
  extrusionRange: [number, number];
  positionOffsetRange: [number, number];
  headTemplateIds: string[];
  headScaleRange: [number, number];
  headRotationRange: [number, number];
  jitterRange: [number, number];
};

export function usePuzzleEngineV3(): {
  puzzleState: PuzzleState;
  createRoot: (w: number, h: number) => void;
  subdivideGrid: (params: any) => void;
  mergePieces: (ids: string[]) => void;
  addWhimsy: (params: any) => void;
  addConnector: (connector: Omit<Connector, 'id'>) => void;
  updateConnector: (id: string, updates: Partial<Connector>) => void;
  removeConnector: (id: string) => void;
  addWhimsyToLibrary: (w: Whimsy) => void;
  removeWhimsyFromLibrary: (id: string) => void;
  addMassConnectors: (params: MassConnectorParams) => void;
  generateMassConnectors: (params: MassConnectorParams) => Record<string, Connector>;
  commitPreviewConnectors: (previewConnectors: Record<string, Connector>) => void;
  resolveConnectorConflicts: () => void;
  validateGrid: () => void;
  cleanPuzzle: () => void;
  reset: () => void;
  // Group template operations
  groupTemplates: ReturnType<typeof useGroupTemplates>;
} {
  const [areas, setAreas] = useState<Record<string, Area>>({});
  const [connectors, setConnectors] = useState<Record<string, Connector>>({});
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [rootAreaId, setRootAreaId] = useState<string | null>(null);
  const [processedMaterializationIds, setProcessedMaterializationIds] = useState<Set<string>>(new Set());
  const [whimsies, setWhimsies] = useState<Whimsy[]>([
    { id: 'circle', name: 'Circle', svgData: getWhimsyTemplatePathData('circle'), category: 'Basic' },
    { id: 'star', name: 'Star', svgData: getWhimsyTemplatePathData('star'), category: 'Basic' },
    { id: 'square', name: 'Square', svgData: getWhimsyTemplatePathData('square'), category: 'Basic' },
    { id: 'triangle', name: 'Triangle', svgData: getWhimsyTemplatePathData('triangle'), category: 'Basic' },
  ]);

  const groupTemplateOps = useGroupTemplates(areas, setAreas, connectors, setConnectors, width, height);

  const createRoot = useCallback((w: number, h: number) => {
    console.log('usePuzzleEngineV3: createRoot', w, h);
    resetPaperProject(w, h);
    const id = 'root';
    const boundary = new paper.Path.Rectangle({
      point: [0, 0],
      size: [w, h],
      insert: false
    });
    
    const newAreas: Record<string, Area> = {
      [id]: {
        id,
        parentId: null,
        type: AreaType.PIECE,
        children: [],
        boundary,
        color: '#f8fafc'
      }
    };
    setAreas(newAreas);
    setConnectors({});
    setRootAreaId(id);
    setWidth(w);
    setHeight(h);
  }, []);

  const subdivideGrid = useCallback((params: { parentId: string, pattern: string, rows: number, cols: number, count: number, jitter: number }) => {
    const { parentId, pattern, rows, cols, count, jitter } = params;
    
    const isGroupInstance = (parentId: string, currentAreas: Record<string, Area>) => {
      return currentAreas[parentId]?.groupInstance !== undefined;
    };
    
    setAreas(prev => {
      const parent = prev[parentId];
      if (!parent || parent.type !== AreaType.PIECE) return prev;

      resetPaperProject(width, height);
      const parentPath = parent.boundary.clone();
      const bounds = parentPath.bounds;
      
      const nextAreas = { ...prev };
      const childIds: string[] = [];

      // Special case for perfect rectangular grid
      if (pattern === 'GRID' && jitter === 0) {
        const dx = bounds.width / cols;
        const dy = bounds.height / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const rect = new paper.Path.Rectangle({
              point: [bounds.x + c * dx, bounds.y + r * dy],
              size: [dx, dy],
              insert: false
            });
            const clipped = parentPath.intersect(rect);
            rect.remove();

            if (!clipped.isEmpty()) {
              const childId = `${parentId}-child-${r}-${c}-${Math.random().toString(36).slice(2, 6)}`;
              childIds.push(childId);
              clipped.remove(); // Keep it out of the active project
              
              // Color picking: check against all existing pieces (except the parent being split)
              // and also against already created children in this batch.
              const neighborColors = getNeighborColors(nextAreas, clipped, [parentId]);

              nextAreas[childId] = {
                id: childId,
                parentId,
                type: AreaType.PIECE,
                children: [],
                boundary: clipped,
                color: pickUniqueColor(neighborColors),
                seedPoint: { x: bounds.x + (c + 0.5) * dx, y: bounds.y + (r + 0.5) * dy }
              };
            } else {
              clipped.remove();
            }
          }
        }
      } else {
        // Voronoi for organic/jittered grids
        let points: Point[] = [];
        if (pattern === 'GRID') points = generateGridPoints(width, height, rows, cols, jitter, bounds);
        else if (pattern === 'HEX') points = generateHexGridPoints(width, height, rows, cols, jitter, bounds);
        else if (pattern === 'RANDOM') points = generateRandomPoints(width, height, count, bounds);

        if (points.length === 0) {
          parentPath.remove();
          return prev;
        }

        const delaunay = Delaunay.from(points.map(p => [p.x, p.y]));
        const voronoi = delaunay.voronoi([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height]);

        points.forEach((p, i) => {
          const poly = voronoi.cellPolygon(i);
          if (!poly) return;

          const cellPath = new paper.Path();
          poly.forEach((pt, j) => {
            if (j === 0) cellPath.moveTo(new paper.Point(pt[0], pt[1]));
            else cellPath.lineTo(new paper.Point(pt[0], pt[1]));
          });
          cellPath.closePath();

          const clipped = parentPath.intersect(cellPath);
          cellPath.remove();

          if (!clipped.isEmpty()) {
            const childId = `${parentId}-child-${i}-${Math.random().toString(36).slice(2, 6)}`;
            childIds.push(childId);
            clipped.remove();
            
            // For Voronoi, check against all other pieces and new children
            const neighborColors = getNeighborColors(nextAreas, clipped, [parentId]);

            nextAreas[childId] = {
              id: childId,
              parentId,
              type: AreaType.PIECE,
              children: [],
              boundary: clipped,
              color: pickUniqueColor(neighborColors),
              seedPoint: p
            };
          } else {
            clipped.remove();
          }
        });
      }

      parentPath.remove();
      
      nextAreas[parentId] = {
        ...parent,
        type: AreaType.GROUP,
        children: childIds
      };

      // After updating areas, if this is a group instance, mark it for materialization
      if (isGroupInstance(parentId, nextAreas)) {
        (nextAreas as any).__pendingMaterializationId = parentId;
      }

      return nextAreas;
    });
  }, [width, height]);

  const mergePieces = useCallback((ids: string[]) => {
    if (ids.length < 2) return;

    setAreas(prev => {
      const validIds = ids.filter(id => prev[id] && prev[id].type === AreaType.PIECE);
      if (validIds.length < 2) return prev;

      resetPaperProject(width, height);
      const nextAreas = { ...prev };
      
      const toMerge = [...validIds];
      const mergedResults: Area[] = [];

      while (toMerge.length > 0) {
        const startId = toMerge.shift()!;
        const startArea = nextAreas[startId];
        let currentPath = startArea.boundary.clone();
        let currentColor = startArea.color;
        let currentParentId = startArea.parentId;
        const mergedIds = [startId];
        
        let foundAny = true;
        while (foundAny) {
          foundAny = false;
          for (let i = 0; i < toMerge.length; i++) {
            const otherId = toMerge[i];
            const otherArea = nextAreas[otherId];
            const otherPath = otherArea.boundary.clone();
            
            const pA = currentPath.getNearestPoint(otherPath.bounds.center);
            const pB = otherPath.getNearestPoint(pA);
            const dist = pA.getDistance(pB);
            
            if (currentPath.intersects(otherPath) || dist < 2) {
              // In theory, unite then subtracting the intersection is completely redundant.
              // in practice, this makes paper js much more reliable
              const united = currentPath.unite(otherPath).subtract((currentPath.intersect(otherPath, {insert:false})),  {insert:false});
              currentPath.remove();
              currentPath = united;
              mergedIds.push(otherId);
              toMerge.splice(i, 1);
              i--;
              foundAny = true;
            }
            otherPath.remove();
          }
        }

        if (mergedIds.length > 1) {
          const newId = `merged-${Math.random().toString(36).slice(2, 6)}`;
          currentPath.remove(); // Keep it out of project
          
          // Find neighbors of the new merged piece to pick a unique color
          // Exclude the pieces that are being merged
          const neighborColors = getNeighborColors(nextAreas, currentPath, mergedIds);

          const newArea: Area = {
            id: newId,
            parentId: currentParentId,
            type: AreaType.PIECE,
            children: [],
            boundary: currentPath,
            color: pickUniqueColor(neighborColors)
          };
          mergedResults.push(newArea);
          
          // Update parent
          if (currentParentId && nextAreas[currentParentId]) {
            nextAreas[currentParentId] = {
              ...nextAreas[currentParentId],
              children: nextAreas[currentParentId].children.filter(id => !mergedIds.includes(id)).concat(newId)
            };
          }
          
          // Delete old pieces
          mergedIds.forEach(id => delete nextAreas[id]);
          nextAreas[newId] = newArea;
        } else {
          currentPath.remove();
        }
      }

      return nextAreas;
    });
  }, [width, height]);

  const addWhimsy = useCallback((params: { templateId: string, center: Point, scale: number, rotationDeg: number, color?: string }) => {
    const { templateId, center, scale, rotationDeg, color } = params;
    
    setAreas(prev => {
      resetPaperProject(width, height);
      const whimsy = whimsies.find(w => w.id === templateId);
      const stem = whimsy ? whimsy.svgData : getWhimsyTemplatePathData(templateId as WhimsyTemplateId);
      
      const whimsyPath = new paper.CompoundPath({
        pathData: stem,
        insert: false
      });
      whimsyPath.closed = true;
      whimsyPath.scale(scale, new paper.Point(0, 0));
      whimsyPath.rotate(rotationDeg, new paper.Point(0, 0));
      whimsyPath.position = new paper.Point(center.x, center.y);
      whimsyPath.reorient(true, true);
      whimsyPath.remove();
      
      let nextAreas = { ...prev };
      
      Object.keys(nextAreas).forEach(id => {
        const area = nextAreas[id];
        if (area.type === AreaType.PIECE) {
          const piecePath = area.boundary.clone();
          if (piecePath.intersects(whimsyPath) || piecePath.contains(whimsyPath.bounds.center)) {
            const subtracted = piecePath.subtract(whimsyPath);
            subtracted.remove();
            nextAreas[id] = {
              ...area,
              boundary: subtracted
            };
          }
          piecePath.remove();
        }
      });

      const whimsyId = `whimsy-${Math.random().toString(36).slice(2, 6)}`;
      whimsyPath.remove();
      
      // Pick unique color for whimsy
      const neighborColors = getNeighborColors(nextAreas, whimsyPath);

      nextAreas[whimsyId] = {
        id: whimsyId,
        parentId: null,
        type: AreaType.PIECE,
        children: [],
        boundary: whimsyPath,
        color: color || pickUniqueColor(neighborColors),
        seedPoint: center
      };

      // After adding whimsy, validate and clean state to handle split pieces
      nextAreas = validateAndCleanState(nextAreas);

      return nextAreas;
    });
  }, [width, height]);

  const validateGrid = useCallback(() => {
    const results: string[] = [];
    (Object.entries(areas) as [string, Area][]).forEach(([id, area]) => {
      if (area.type === AreaType.PIECE) {
        const path = area.boundary;
        if (path instanceof paper.Path) {
          const isRect = path.segments.length === 4;
          if (isRect) {
            for (let i = 0; i < 4; i++) {
              const p1 = path.segments[i].point;
              const p2 = path.segments[(i + 1) % 4].point;
              const p3 = path.segments[(i + 2) % 4].point;
              const v1 = p1.subtract(p2);
              const v2 = p3.subtract(p2);
              const dot = v1.normalize().dot(v2.normalize());
              if (Math.abs(dot) > 0.01) {
                results.push(`Piece ${id} is not perfectly rectangular (dot product: ${dot.toFixed(4)})`);
              }
            }
          } else {
            results.push(`Piece ${id} does not have 4 segments (count: ${path.segments.length})`);
          }
        }
      }
    });
    if (results.length === 0) {
      console.log('Grid Validation: All pieces are perfectly rectangular!');
      alert('Grid Validation: All pieces are perfectly rectangular!');
    } else {
      console.warn('Grid Validation Failures:', results);
      alert(`Grid Validation Failures: ${results.length} issues found. Check console.`);
    }
  }, [areas]);

  const cleanPuzzle = useCallback(() => {
    setAreas(prev => validateAndCleanState(prev));
  }, []);

  const addConnector = useCallback((connector: Omit<Connector, 'id'>) => {
    const id = `connector-${Math.random().toString(36).slice(2, 6)}`;
    setConnectors(prev => ({
      ...prev,
      [id]: { ...connector, id, jitterSeed: (Math.random() * 0xffffffff) >>> 0 }
    }));
  }, []);

  const updateConnector = useCallback((id: string, updates: Partial<Connector>) => {
    setConnectors(prev => {
      const current = prev[id];
      if (!current) return prev;
      
      // Check if anything actually changed
      const hasChanges = Object.entries(updates).some(([key, value]) => {
        return current[key as keyof Connector] !== value;
      });
      
      if (!hasChanges) return prev;
      
      return {
        ...prev,
        [id]: { ...current, ...updates }
      };
    });
  }, []);

  const removeConnector = useCallback((id: string) => {
    setConnectors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const addWhimsyToLibrary = useCallback((whimsy: Whimsy) => {
    setWhimsies(prev => [...prev, whimsy]);
  }, []);

  const removeWhimsyFromLibrary = useCallback((id: string) => {
    setWhimsies(prev => prev.filter(w => w.id !== id));
  }, []);

  const generateMassConnectors = useCallback((params: {
    pieceIds: string[],
    widthRange: [number, number],
    extrusionRange: [number, number],
    positionOffsetRange: [number, number],
    headTemplateIds: string[],
    headScaleRange: [number, number],
    headRotationRange: [number, number],
    jitterRange: [number, number]
  }): Record<string, Connector> => {
    const {
      pieceIds,
      widthRange,
      extrusionRange,
      positionOffsetRange,
      headTemplateIds,
      headScaleRange,
      headRotationRange,
      jitterRange
    } = params;

    const generated: Record<string, Connector> = {};

    pieceIds.forEach(id => {
      const area = areas[id];
      if (!area || area.type !== AreaType.PIECE) return;

      const boundary = area.boundary;
      const children = boundary instanceof paper.CompoundPath
        ? (boundary.children.filter(c => c instanceof paper.Path) as paper.Path[])
        : [boundary as paper.Path];

      children.forEach((path, pathIndex) => {
        const samples = 20;
        const neighborSegments = new Map<string, { tStart: number, tEnd: number }[]>();

        let currentNeighbor: string | null = null;
        let segmentStart = 0;

        for (let i = 0; i <= samples; i++) {
          const t = i / samples;
          const pt = path.getPointAt(path.length * t);
          const normal = path.getNormalAt(path.length * t);
          const neighborId = findNeighborPiece(areas, id, pt, normal);

          if (neighborId !== currentNeighbor) {
            if (currentNeighbor && pieceIds.includes(currentNeighbor)) {
              if (!neighborSegments.has(currentNeighbor)) neighborSegments.set(currentNeighbor, []);
              neighborSegments.get(currentNeighbor)!.push({ tStart: segmentStart, tEnd: t });
            }
            currentNeighbor = neighborId;
            segmentStart = t;
          }
        }

        neighborSegments.forEach((segments, neighborId) => {
          if (id > neighborId) return;

          segments.forEach(seg => {
            const baseMidT = (seg.tStart + seg.tEnd) / 2;
            const rand = (range: [number, number]) => range[0] + Math.random() * (range[1] - range[0]);

            const jitterPx = rand(positionOffsetRange);
            const jitterT = path.length > 0 ? jitterPx / path.length : 0;
            let midT = baseMidT + (Math.random() - 0.5) * 2 * jitterT;
            midT = ((midT % 1) + 1) % 1;

            const headTemplateId = headTemplateIds[Math.floor(Math.random() * headTemplateIds.length)];
            const connectorId = `connector-${Math.random().toString(36).slice(2, 6)}`;

            generated[connectorId] = {
              id: connectorId,
              pieceId: id,
              pathIndex,
              midT,
              widthPx: rand(widthRange),
              extrusion: rand(extrusionRange),
              headTemplateId,
              headScale: rand(headScaleRange),
              headRotationDeg: rand(headRotationRange),
              jitter: rand(jitterRange),
              jitterSeed: (Math.random() * 0xffffffff) >>> 0,
              useEquidistantHeadPoint: true
            };
          });
        });
      });
    });

    return generated;
  }, [areas]);

  const addMassConnectors = useCallback((params: {
    pieceIds: string[],
    widthRange: [number, number],
    extrusionRange: [number, number],
    positionOffsetRange: [number, number],
    headTemplateIds: string[],
    headScaleRange: [number, number],
    headRotationRange: [number, number],
    jitterRange: [number, number]
  }) => {
    const generated = generateMassConnectors(params);
    setConnectors(prev => ({ ...prev, ...generated }));
  }, [generateMassConnectors]);

  const commitPreviewConnectors = useCallback((previewConnectors: Record<string, Connector>) => {
    setConnectors(prev => ({ ...prev, ...previewConnectors }));
  }, []);

  const resolveConnectorConflicts = useCallback(() => {
    setConnectors(prev => {
      const next = { ...prev };
      const connectorList = Object.values(next) as Connector[];
      
      // Reset all to enabled first
      connectorList.forEach(c => c.disabled = false);

      // Pre-calculate paths for all connectors
      const paths: Record<string, paper.PathItem> = {};
      connectorList.forEach(c => {
        const area = areas[c.pieceId];
        if (!area) return;
        try {
          const result = generateConnectorPath(
            area.boundary,
            c.pathIndex,
            c.midT,
            c.widthPx,
            c.extrusion,
            c.headTemplateId,
            c.headScale,
            c.headRotationDeg,
            c.useEquidistantHeadPoint,
            whimsies,
            c.jitter,
            c.jitterSeed || 0
          );
          paths[c.id] = new paper.CompoundPath({ pathData: result.pathData, insert: false });
        } catch (e) {
          console.error('Error calculating path for conflict resolution:', e);
        }
      });

      // Check for intersections
      for (let i = 0; i < connectorList.length; i++) {
        const c1 = connectorList[i];
        const p1 = paths[c1.id];
        if (!p1) continue;

        for (let j = i + 1; j < connectorList.length; j++) {
          const c2 = connectorList[j];
          const p2 = paths[c2.id];
          if (!p2) continue;

          if (p1.intersects(p2)) {
            // Disable one of them (the one with the "smaller" ID to be deterministic)
            if (c1.id < c2.id) {
              next[c1.id].disabled = true;
            } else {
              next[c2.id].disabled = true;
            }
          }
        }
      }

      // Cleanup
      Object.values(paths).forEach(p => p.remove());
      return next;
    });
  }, [areas, whimsies]);

  // Handle pending materializations after subdivision
  useEffect(() => {
    const pendingId = (areas as any).__pendingMaterializationId;
    if (pendingId && areas[pendingId] && !processedMaterializationIds.has(pendingId)) {
      const groupArea = areas[pendingId];
      if (groupArea.type === AreaType.GROUP && groupArea.children && groupArea.children.length > 0) {
        // Call materialization
        groupTemplateOps.materializeInstanceConnectors(pendingId);
        // Mark as processed
        setProcessedMaterializationIds(prev => new Set(prev).add(pendingId));
        // Clear the pending flag
        delete (areas as any).__pendingMaterializationId;
      }
    }
  }, [areas, processedMaterializationIds]);

  const puzzleState = useMemo(() => ({
    areas,
    connectors,
    whimsies,
    groupTemplates: groupTemplateOps.groupTemplates,
    rootAreaId: rootAreaId || '',
    width,
    height
  }), [areas, connectors, whimsies, groupTemplateOps.groupTemplates, rootAreaId, width, height]);

  return {
    puzzleState,
    createRoot,
    subdivideGrid,
    mergePieces,
    addWhimsy,
    addConnector,
    updateConnector,
    removeConnector,
    addWhimsyToLibrary,
    removeWhimsyFromLibrary,
    addMassConnectors,
    generateMassConnectors,
    commitPreviewConnectors,
    resolveConnectorConflicts,
    validateGrid,
    cleanPuzzle,
    reset: () => { setAreas({}); setConnectors({}); setRootAreaId(null); groupTemplateOps.setGroupTemplates({}); },
    groupTemplates: groupTemplateOps
  };
}
