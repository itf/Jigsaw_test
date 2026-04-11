import { useState, useCallback, useMemo } from 'react';
import paper from 'paper';
import { Delaunay } from 'd3-delaunay';
import { Area, AreaType, Operation, OperationType, PuzzleState, Point, Connector, Whimsy, NeckShape } from '../types';
import { resetPaperProject } from '../utils/paperUtils';
import { generateGridPoints, generateHexGridPoints, generateRandomPoints } from '../utils/gridUtils';
import { getWhimsyTemplatePathData, WhimsyTemplateId, DEFAULT_WHIMSIES } from '../utils/whimsyGallery';
import { validateAndCleanState } from '../utils/puzzleValidation';
import { findNeighborPiece, generateConnectorPath } from '../utils/connectorUtils';
import { useStamps } from './useStamps';

import { getNeighborDepth } from '../utils/relativeUtils';

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80',
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8',
  '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'
];

function generateSafeRandomColor(): string {
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
  widthRelative: boolean;
  extrusionRange: [number, number];
  extrusionRelative: boolean;
  positionRange: [number, number];
  headTemplateIds: string[];
  headScaleRange: [number, number];
  headScaleRelative: boolean;
  useActualAreaForScale: boolean;
  headRotationRange: [number, number];
  jitterRange: [number, number];
  neckShapes: NeckShape[];
};

export function usePuzzleEngineV3(): {
  puzzleState: PuzzleState;
  createRoot: (w: number, h: number, shape?: 'RECT' | 'CIRCLE' | 'HEX') => void;
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
  loadState: (state: PuzzleState) => void;
  reset: () => void;
  stamps: ReturnType<typeof useStamps>;
} {
  const [areas, setAreas] = useState<Record<string, Area>>({});
  const [connectors, setConnectors] = useState<Record<string, Connector>>({});
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [rootAreaId, setRootAreaId] = useState<string | null>(null);
  const [whimsies, setWhimsies] = useState<Whimsy[]>(() => 
    DEFAULT_WHIMSIES.map(w => ({
      id: w.id,
      name: w.name,
      svgData: getWhimsyTemplatePathData(w.id as WhimsyTemplateId),
      category: w.category
    }))
  );

  // Memoized head metrics to avoid constant recalculation
  const headMetricsCache = useMemo(() => {
    const cache: Record<string, { actualArea: number, bboxArea: number, bboxWidth: number, bboxHeight: number }> = {};
    
    const calculate = (id: string, svgData: string) => {
      const path = new paper.CompoundPath({ pathData: svgData, insert: false });
      const actualArea = Math.abs((path as any).area || 0);
      const bounds = path.bounds;
      const bboxArea = bounds.width * bounds.height;
      path.remove();
      return { actualArea, bboxArea, bboxWidth: bounds.width, bboxHeight: bounds.height };
    };

    whimsies.forEach(w => {
      cache[w.id] = calculate(w.id, w.svgData);
    });

    return cache;
  }, [whimsies]);

  const stampOps = useStamps(areas, setAreas, connectors, setConnectors, whimsies, width, height);

  const createRoot = useCallback((w: number, h: number, shape: 'RECT' | 'CIRCLE' | 'HEX' = 'RECT') => {
    console.log('usePuzzleEngineV3: createRoot', w, h, shape);
    resetPaperProject(w, h);
    const id = 'root';
    
    let boundary: paper.PathItem;
    if (shape === 'CIRCLE') {
      boundary = new paper.Path.Circle({
        center: [w / 2, h / 2],
        radius: Math.min(w, h) / 2,
        insert: false
      });
    } else if (shape === 'HEX') {
      boundary = new paper.Path.RegularPolygon({
        center: [w / 2, h / 2],
        sides: 6,
        radius: Math.min(w, h) / 2,
        insert: false
      });
    } else {
      boundary = new paper.Path.Rectangle({
        point: [0, 0],
        size: [w, h],
        insert: false
      });
    }

    const newAreas: Record<string, Area> = {
      [id]: {
        id,
        groupMemberships: [],
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

    setAreas(prev => {
      const parent = prev[parentId];
      if (!parent || (parent.type !== AreaType.PIECE && parent.type !== AreaType.STAMP)) return prev;

      resetPaperProject(width, height);
      const parentPath = parent.boundary.clone();
      const bounds = parentPath.bounds;

      const nextAreas = { ...prev };
      const childIds: string[] = [];

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
              clipped.remove();

              const neighborColors = getNeighborColors(nextAreas, clipped, [parentId]);

              nextAreas[childId] = {
                id: childId,
                groupMemberships: [parentId],
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

            const neighborColors = getNeighborColors(nextAreas, clipped, [parentId]);

            nextAreas[childId] = {
              id: childId,
              groupMemberships: [parentId],
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
        // Use first piece's groupMemberships for the merged result
        const currentMemberships = startArea.groupMemberships;
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
              const united = currentPath.unite(otherPath).subtract((currentPath.intersect(otherPath, {insert:false})), {insert:false});
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
          currentPath.remove();

          const neighborColors = getNeighborColors(nextAreas, currentPath, mergedIds);

          const newArea: Area = {
            id: newId,
            groupMemberships: currentMemberships,
            type: AreaType.PIECE,
            children: [],
            boundary: currentPath,
            color: pickUniqueColor(neighborColors)
          };
          mergedResults.push(newArea);

          // Update all groups that contained any of the merged pieces
          const affectedGroupIds = new Set(mergedIds.flatMap(id => nextAreas[id]?.groupMemberships ?? []));
          for (const groupId of affectedGroupIds) {
            if (nextAreas[groupId]) {
              nextAreas[groupId] = {
                ...nextAreas[groupId],
                children: nextAreas[groupId].children.filter(id => !mergedIds.includes(id)).concat(newId)
              };
            }
          }

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
      const wb = whimsyPath.bounds;
      whimsyPath.translate(new paper.Point(
        center.x - (wb.x + wb.width / 2),
        center.y - (wb.y + wb.height / 2)
      ));
      whimsyPath.reorient(true, true);
      whimsyPath.remove();

      let nextAreas = { ...prev };

      // 1. Prepare the whimsy geometry
      let filledPath: paper.PathItem = whimsyPath.clone();
      if (filledPath instanceof paper.CompoundPath) {
        const filled = (filledPath as paper.CompoundPath).children.reduce((acc, child) => {
          const pathChild = child as paper.PathItem;
          if (!acc) return pathChild.clone();
          return (acc as paper.PathItem).unite(pathChild);
        }, null as paper.PathItem | null) as paper.PathItem | null;
        if (filled) {
          filledPath.remove();
          filledPath = filled;
        }
      }
      
      const holePath = filledPath.subtract(whimsyPath);

      // 2. Process existing pieces
      const pieceIds = Object.keys(nextAreas).filter(id => nextAreas[id].type === AreaType.PIECE);
      
      pieceIds.forEach(id => {
        const area = nextAreas[id];
        const piecePath = area.boundary.clone();
        
        // Check if whimsy affects this piece
        if (piecePath.intersects(filledPath) || piecePath.contains(filledPath.bounds.center) || filledPath.contains(piecePath.bounds.center)) {
          const outside = piecePath.subtract(filledPath);
          const inside = piecePath.intersect(holePath);
          
          if (outside.isEmpty()) {
            delete nextAreas[id];
          } else {
            nextAreas[id] = { ...area, boundary: outside };
          }
          
          if (!inside.isEmpty()) {
            const holePieceId = `hole-${id}-${Math.random().toString(36).slice(2, 6)}`;
            nextAreas[holePieceId] = {
              ...area, // Inherit group memberships
              id: holePieceId,
              boundary: inside,
              color: area.color, 
              seedPoint: inside.bounds.center
            };

            // Update parent groups to include the new hole piece
            area.groupMemberships.forEach(groupId => {
              if (nextAreas[groupId]) {
                nextAreas[groupId] = {
                  ...nextAreas[groupId],
                  children: [...nextAreas[groupId].children, holePieceId]
                };
              }
            });
          } else {
            inside.remove();
          }
        }
        piecePath.remove();
      });

      filledPath.remove();
      holePath.remove();

      const whimsyId = `whimsy-${Math.random().toString(36).slice(2, 6)}`;
      whimsyPath.remove();

      const neighborColors = getNeighborColors(nextAreas, whimsyPath);

      nextAreas[whimsyId] = {
        id: whimsyId,
        groupMemberships: [],
        type: AreaType.PIECE,
        children: [],
        boundary: whimsyPath,
        color: color || pickUniqueColor(neighborColors),
        seedPoint: center
      };

      nextAreas = validateAndCleanState(nextAreas);

      return nextAreas;
    });
  }, [width, height, whimsies]);

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

  const loadState = useCallback((state: PuzzleState) => {
    setAreas(state.areas);
    setConnectors(state.connectors);
    
    // Merge persisted whimsies with default ones to ensure new templates are available
    setWhimsies(prev => {
      const defaultWhimsies = DEFAULT_WHIMSIES.map(w => ({
        id: w.id,
        name: w.name,
        svgData: getWhimsyTemplatePathData(w.id as WhimsyTemplateId),
        category: w.category
      }));
      
      const existingIds = new Set<string>(defaultWhimsies.map(w => w.id));
      const persistedWhimsies = state.whimsies.filter(w => !existingIds.has(w.id));
      
      return [...defaultWhimsies, ...persistedWhimsies];
    });
    
    setRootAreaId(state.rootAreaId);
    setWidth(state.width);
    setHeight(state.height);
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

  const generateMassConnectors = useCallback((params: MassConnectorParams): Record<string, Connector> => {
    const {
      pieceIds,
      widthRange,
      widthRelative,
      extrusionRange,
      extrusionRelative,
      positionRange,
      headTemplateIds,
      headScaleRange,
      headScaleRelative,
      useActualAreaForScale,
      headRotationRange,
      jitterRange,
      neckShapes
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
        const samples = 200;
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
          const neighborArea = areas[neighborId];
          if (!neighborArea) return;

          segments.forEach(seg => {
            const rand = (range: [number, number]) => range[0] + Math.random() * (range[1] - range[0]);

            // Calculate shared boundary length if needed
            let sharedLen = 0;
            if (widthRelative) { 
              // Relative width is now based on 1/4 of the piece's boundary length
              sharedLen = path.length / 4;
            }

            // Position (0 to 1 range, 0.5 is middle)
            const posVal = rand(positionRange) / 100; 
            let midT = seg.tStart + posVal * (seg.tEnd - seg.tStart);
            midT = ((midT % 1) + 1) % 1;

            const headTemplateId = headTemplateIds[Math.floor(Math.random() * headTemplateIds.length)];
            const neckShape = neckShapes[Math.floor(Math.random() * neckShapes.length)];
            const connectorId = `connector-${Math.random().toString(36).slice(2, 6)}`;

            // Width
            let widthPx = rand(widthRange);
            if (widthRelative) {
              widthPx = widthPx * sharedLen;
            }

            // Extrusion
            let extrusion = rand(extrusionRange);
            if (extrusionRelative) {
              const pt = path.getPointAt(path.length * midT);
              const normal = path.getNormalAt(path.length * midT);
              const depth = getNeighborDepth(neighborArea.boundary, pt, normal);
              extrusion = (extrusion / 100) * depth;
            }

            // Scale
            let headScale = rand(headScaleRange);
            if (headScaleRelative) {
              const metrics = headMetricsCache[headTemplateId];
              const neighborAreaVal = Math.abs(neighborArea.boundary.area);
              
              if (metrics) {
                const baseArea = useActualAreaForScale ? metrics.actualArea : metrics.bboxArea;
                if (baseArea > 0) {
                  // targetArea = (headScale / 100) * neighborAreaVal
                  // targetArea = baseArea * (12 * actualScale)^2
                  // actualScale = sqrt(targetArea / (144 * baseArea))
                  headScale = Math.sqrt(((headScale / 100) * neighborAreaVal) / (144 * baseArea));
                }
              }
            }

            // Relative Jitter
            const jitterVal = rand(jitterRange);
            let finalJitter = jitterVal;
            const metrics = headMetricsCache[headTemplateId];
            if (metrics) {
              // Proportional to bounding box size * scale
              // avgDim is ~2 for normalized heads. 
              // We want jitterVal=10 to be ~100% of head size (points move +/- 50%)
              const avgDim = (metrics.bboxWidth + metrics.bboxHeight) / 2;
              finalJitter = jitterVal * avgDim * 1.2 * headScale; 
            }

            generated[connectorId] = {
              id: connectorId,
              pieceId: id,
              pathIndex,
              midT,
              widthPx,
              extrusion,
              headTemplateId,
              headScale,
              headRotationDeg: rand(headRotationRange),
              jitter: finalJitter,
              jitterSeed: (Math.random() * 0xffffffff) >>> 0,
              useEquidistantHeadPoint: true,
              neckShape
            };
          });
        });
      });
    });

    return generated;
  }, [areas, whimsies, headMetricsCache]);

  const addMassConnectors = useCallback((params: MassConnectorParams) => {
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

      connectorList.forEach(c => c.disabled = false);

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

      for (let i = 0; i < connectorList.length; i++) {
        const c1 = connectorList[i];
        const p1 = paths[c1.id];
        if (!p1) continue;

        for (let j = i + 1; j < connectorList.length; j++) {
          const c2 = connectorList[j];
          const p2 = paths[c2.id];
          if (!p2) continue;

          if (p1.intersects(p2)) {
            if (c1.id < c2.id) {
              next[c1.id].disabled = true;
            } else {
              next[c2.id].disabled = true;
            }
          }
        }
      }

      Object.values(paths).forEach(p => p.remove());
      return next;
    });
  }, [areas, whimsies]);

  const puzzleState = useMemo(() => ({
    areas,
    connectors,
    whimsies,
    rootAreaId: rootAreaId || '',
    width,
    height
  }), [areas, connectors, whimsies, rootAreaId, width, height]);

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
    loadState,
    reset: () => { setAreas({}); setConnectors({}); setRootAreaId(null); },
    stamps: stampOps
  };
}
