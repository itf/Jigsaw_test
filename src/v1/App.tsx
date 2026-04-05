/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import paper from 'paper';
import { Delaunay } from 'd3-delaunay';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Download, 
  Plus, 
  RotateCcw, 
  Layers, 
  Scissors, 
  History,
  Trash2,
  RefreshCw,
  Heart,
  Star,
  MousePointer2,
  Link as LinkIcon,
  Zap,
  Play,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Point, Operation, PuzzleState, ConnectorConfig, ConnectorType, Piece } from './types';
import { createWhimsyPath, isPointInPath, createCellPath, getWhimsyPathData, createConnectorStamp } from './geometry';
import { useLongPress } from './hooks/useLongPress';
import { RadialMenu, ContextPanel } from './components/PuzzleMenu';

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', 
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', 
  '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'
];

const MIN_PIECE_AREA = 400; // Square pixels

export default function App() {
  // --- State ---
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [points, setPoints] = useState<Point[]>([]);
  const [whimsies, setWhimsies] = useState<{ 
    id: string; 
    type: 'HEART' | 'STAR' | 'CUSTOM' | 'SQUARE'; 
    center: Point; 
    size: number;
    rotation?: number;
    scale?: number;
    customPathData?: string;
  }[]>([]);
  const [log, setLog] = useState<Operation[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [tabRadius, setTabRadius] = useState(12);
  const [localTabRadius, setLocalTabRadius] = useState(12);
  
  // Sync localTabRadius with tabRadius when tabRadius changes externally
  useEffect(() => {
    setLocalTabRadius(tabRadius);
  }, [tabRadius]);

  const [showPoints, setShowPoints] = useState(false);
  const [showColors, setShowColors] = useState(true);
  const [warpEdges, setWarpEdges] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toolMode, setToolMode] = useState<'SELECT' | 'ADD_POINT' | 'MERGE' | 'ADD_WHIMSY'>('SELECT');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [customConnectors, setCustomConnectors] = useState<Record<string, ConnectorConfig>>({});
  const [mergedGroups, setMergedGroups] = useState<number[][]>([]);
  const [warpedPieceIds, setWarpedPieceIds] = useState<Set<string>>(new Set());
  const [radialMenu, setRadialMenu] = useState<{ x: number; y: number } | null>(null);
  
  const [customWhimsies, setCustomWhimsies] = useState<{ id: string; name: string; pathData?: string; type: 'HEART' | 'STAR' | 'CUSTOM' | 'SQUARE'; category: string }[]>([
    { id: 'heart', name: 'Heart', type: 'HEART', category: 'Shapes' },
    { id: 'star', name: 'Star', type: 'STAR', category: 'Shapes' },
    { id: 'square', name: 'Square', type: 'SQUARE', category: 'Shapes' },
  ]);
  const [selectedCustomWhimsyId, setSelectedCustomWhimsyId] = useState<string | null>('heart');
  const [whimsyRotation, setWhimsyRotation] = useState(0);
  const [whimsyScale, setWhimsyScale] = useState(1);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const lastPointTime = useRef<number>(0);
  
  // Cache for generated pieces to avoid full re-generation on single connector changes
  const pieceCache = useRef<Map<string, { hash: string; pieces: Piece[] }>>(new Map());

  // --- Effects & Shortcuts ---
  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 's': setToolMode('SELECT'); break;
        case 'p': setToolMode('ADD_POINT'); break;
        case 'm': setToolMode('MERGE'); break;
        case 'w': setToolMode('ADD_WHIMSY'); break;
        case 'r': setWhimsyRotation(prev => (prev + 15) % 360); break;
        case 'q': setWhimsyRotation(prev => (prev - 15 + 360) % 360); break;
        case 'delete':
        case 'backspace':
          if (selectedPieceId) deleteSelectedPiece();
          break;
        case 'escape':
          setSelectedPieceId(null);
          setToolMode('SELECT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPieceId]);

  // Handle wheel for scaling/rotation
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (toolMode.startsWith('ADD_')) {
        e.preventDefault();
        if (e.shiftKey) {
          setWhimsyRotation(prev => (prev + (e.deltaY > 0 ? 5 : -5) + 360) % 360);
        } else {
          setWhimsyScale(prev => Math.max(0.2, Math.min(5, prev + (e.deltaY > 0 ? -0.1 : 0.1))));
        }
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [toolMode]);

  // --- Core Logic ---
  // Generate initial random points
  const generateRandomPoints = useCallback((count: number) => {
    const newPoints: Point[] = [];
    const whimsyPaths = whimsies.map(w => createWhimsyPath(w.type as any, w.center, w.size, w.rotation || 0, w.scale || 1, w.customPathData));

    for (let i = 0; i < count; i++) {
      let p: Point = { x: 0, y: 0 };
      let valid = false;
      let attempts = 0;
      
      while (!valid && attempts < 100) {
        p = { x: Math.random() * width, y: Math.random() * height };
        const insideAny = whimsyPaths.some(path => isPointInPath(p, path));
        
        if (!insideAny) {
          newPoints.push(p);
          valid = true;
        }
        attempts++;
      }
    }
    
    // Cleanup
    whimsyPaths.forEach(w => w.remove());

    const op: Operation = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'GENERATE_RANDOM_POINTS',
      params: { count, width, height, seed: Math.random() },
      timestamp: Date.now()
    };

    setPoints(prev => [...prev, ...newPoints]);
    setLog(prev => [...prev, op]);
  }, [width, height, whimsies]);

  const addWhimsy = (type: 'HEART' | 'STAR' | 'CUSTOM', center: Point) => {
    const size = 60;
    const customPath = type === 'CUSTOM' ? customWhimsies.find(w => w.id === selectedCustomWhimsyId)?.pathData : undefined;
    const newWhimsy = { 
      id: Math.random().toString(36).substr(2, 9), 
      type, 
      center, 
      size,
      rotation: whimsyRotation,
      scale: whimsyScale,
      customPathData: customPath
    };
    
    const path = createWhimsyPath(type, center, size, whimsyRotation, whimsyScale, customPath);

    // Filter out existing points that are now inside the new whimsy
    setPoints(prev => prev.filter(p => !isPointInPath(p, path as paper.Path)));
    
    setWhimsies(prev => [...prev, newWhimsy]);
    setLog(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: 'ADD_WHIMSY',
      params: { type, center, size, rotation: whimsyRotation, scale: whimsyScale },
      timestamp: Date.now()
    }]);
    setToolMode('SELECT');
    path.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'image/svg+xml');
      const pathElement = doc.querySelector('path');
      if (pathElement) {
        const d = pathElement.getAttribute('d');
        if (d) {
          const newWhimsy: { id: string; name: string; pathData: string; type: 'CUSTOM'; category: string } = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name.replace('.svg', ''),
            pathData: d,
            type: 'CUSTOM',
            category: 'Uploaded'
          };
          setCustomWhimsies(prev => [...prev, newWhimsy]);
          setSelectedCustomWhimsyId(newWhimsy.id);
          setToolMode('ADD_WHIMSY');
        }
      }
    };
    reader.readAsText(file);
  };

  const addManualPoint = (p: Point) => {
    const now = Date.now();
    if (now - lastPointTime.current < 100) {
      console.log("Throttled point creation");
      return;
    }
    lastPointTime.current = now;

    setPoints(prev => [...prev, p]);
    setLog(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: 'ADD_MANUAL_POINT',
      params: { x: p.x, y: p.y },
      timestamp: Date.now()
    }]);
  };

  // Initial generation
  useEffect(() => {
    if (points.length === 0) {
      generateRandomPoints(40);
    }
  }, []);

  const voronoi = useMemo(() => {
    if (points.length === 0) return null;
    const delaunay = Delaunay.from(points.map(p => [p.x, p.y]));
    return delaunay.voronoi([0, 0, width, height]);
  }, [points, width, height]);

  const basePolygons = useMemo(() => {
    if (!voronoi) return [];
    
    // Create temporary paths for whimsies to check containment
    const whimsyPaths = whimsies.map(w => ({
      id: w.id,
      path: createWhimsyPath(w.type as any, w.center, w.size, w.rotation || 0, w.scale || 1, w.customPathData)
    }));

    const polys = points.map((_, i) => {
      const poly = voronoi.cellPolygon(i);
      if (!poly) return null;
      
      const p = points[i];
      const whimsyId = whimsyPaths.find(wp => isPointInPath(p, wp.path))?.id;
      
      return {
        index: i,
        polygon: poly,
        whimsyId,
        neighbors: Array.from(voronoi.neighbors(i)) as number[]
      };
    });

    // Cleanup temp paths
    whimsyPaths.forEach(wp => wp.path.remove());
    return polys;
  }, [voronoi, whimsies, points]);

  const edges = useMemo(() => {
    if (basePolygons.length === 0) return new Map<string, { v1: Point, v2: Point }>();
    
    const edgeMap = new Map<string, { v1: Point, v2: Point }>();
    
    basePolygons.forEach(p => {
      if (!p) return;
      p.neighbors.forEach(njIdx => {
        const edgeKey = [p.index, njIdx].sort((a, b) => a - b).join('-');
        if (edgeMap.has(edgeKey)) return;

        const nj = basePolygons[njIdx];
        if (!nj) return;

        const masterIdx = Math.min(p.index, njIdx);
        const slaveIdx = Math.max(p.index, njIdx);
        
        // We want the edge vertices in CCW order from the perspective of the master piece
        const masterPoly = basePolygons[masterIdx]?.polygon;
        const slavePoly = basePolygons[slaveIdx]?.polygon;
        if (!masterPoly || !slavePoly) return;

        let edgeV1 = points[masterIdx]; 
        let edgeV2 = points[slaveIdx];
        
        for (let i = 0; i < masterPoly.length - 1; i++) {
          const v1 = { x: masterPoly[i][0], y: masterPoly[i][1] };
          const v2 = { x: masterPoly[i+1][0], y: masterPoly[i+1][1] };
          
          const hasV1 = slavePoly.some(v => Math.hypot(v[0] - v1.x, v[1] - v1.y) < 0.1);
          const hasV2 = slavePoly.some(v => Math.hypot(v[0] - v2.x, v[1] - v2.y) < 0.1);
          
          if (hasV1 && hasV2) {
            edgeV1 = v1;
            edgeV2 = v2;
            break;
          }
        }
        
        edgeMap.set(edgeKey, { v1: edgeV1, v2: edgeV2 });
      });
    });
    
    return edgeMap;
  }, [basePolygons, points]);

  /**
   * Main piece generation logic.
   * PERFORMANCE NOTE: This is the most expensive operation in the app.
   * We optimize it by:
   * 1. Caching base polygons and shared edges (handled by previous useMemos).
   * 2. Using a spatial-aware approach for connector application (only checking relevant stamps).
   * 3. Batching boolean operations where possible.
   * 4. Minimizing paper.js object creation and ensuring aggressive cleanup.
   */
  const pieces = useMemo(() => {
    if (points.length === 0 || basePolygons.length === 0) return [];
    
    const startTime = performance.now();
    try {
      // Clear the global paper.js project to avoid memory leaks and state corruption
      paper.project.clear();
      
      const whimsyPaths = whimsies.map(w => ({
        id: w.id,
        path: createWhimsyPath(w.type as any, w.center, w.size, w.rotation || 0, w.scale || 1, w.customPathData)
      }));

      // 3. Pre-generate all unique connector stamps
      const stamps = new Map<string, { stamp: paper.Path, ownerIdx: number, neighborIdx: number, direction: 'OUT' | 'IN' }>();
      const cellToStamps = new Map<number, string[]>();
      
      basePolygons.forEach(p => {
        if (!p) return;
        p.neighbors.forEach(njIdx => {
          const edgeKey = [p.index, njIdx].sort((a, b) => a - b).join('-');
          if (stamps.has(edgeKey)) return;

          const config = customConnectors[edgeKey] || 'TAB';
          const cfg: ConnectorConfig = typeof config === 'string' 
            ? { type: config, offset: 0.5, depth: 1, direction: 'OUT', scale: 1 } 
            : config;

          if (cfg.type === 'NONE') return;

          const edge = edges.get(edgeKey);
          if (!edge) return;

          const masterIdx = Math.min(p.index, njIdx);
          const slaveIdx = Math.max(p.index, njIdx);
          
          const stamp = createConnectorStamp(edge.v1, edge.v2, cfg, tabRadius, warpEdges);
          
          stamps.set(edgeKey, {
            stamp,
            ownerIdx: masterIdx,
            neighborIdx: slaveIdx,
            direction: cfg.direction
          });

          // PERFORMANCE: Map cells to their relevant stamps for faster lookup during piece generation
          if (!cellToStamps.has(masterIdx)) cellToStamps.set(masterIdx, []);
          if (!cellToStamps.has(slaveIdx)) cellToStamps.set(slaveIdx, []);
          cellToStamps.get(masterIdx)!.push(edgeKey);
          cellToStamps.get(slaveIdx)!.push(edgeKey);
        });
      });

      const finalPieces: Piece[] = [];
      const processedIndices = new Set<number>();
      const nextCache = new Map<string, { hash: string; pieces: Piece[] }>();

      /**
       * Helper to process a group of indices into one or more pieces.
       * PERFORMANCE: This function uses boolean operations (unite/subtract) which are O(N log N) 
       * relative to the number of segments. We minimize calls by only checking relevant connectors.
       */
      const processGroup = (indices: number[], id: string, color: string) => {
        // 1. Calculate dependency hash for this piece
        const relevantStampKeys = new Set<string>();
        indices.forEach(idx => {
          cellToStamps.get(idx)?.forEach(key => relevantStampKeys.add(key));
        });

        // The hash includes everything that affects the geometry of this specific piece
        const pieceHash = JSON.stringify({
          indices: [...indices].sort(),
          // We include the polygon coords to detect Voronoi changes
          polygons: indices.map(idx => basePolygons[idx]?.polygon),
          // We include the connector configs for all boundary edges
          connectors: Array.from(relevantStampKeys).map(key => ({
            key,
            config: customConnectors[key] || 'TAB'
          })),
          tabRadius,
          warpEdges,
          whimsyId: basePolygons[indices[0]]?.whimsyId,
          isWarped: indices.some(idx => warpedPieceIds.has(`v-${idx}`))
        });

        // 2. Check cache
        const cached = pieceCache.current.get(id);
        if (cached && cached.hash === pieceHash) {
          cached.pieces.forEach(p => finalPieces.push(p));
          nextCache.set(id, cached);
          return;
        }

        let groupPath: paper.PathItem | null = null;
        
        // 1. Build the base geometry by uniting cell polygons
        indices.forEach(idx => {
          const bp = basePolygons[idx];
          if (!bp) return;

          let cellPath: paper.PathItem = new paper.Path();
          bp.polygon.forEach((pt, i) => {
            if (i === 0) (cellPath as paper.Path).moveTo(new paper.Point(pt[0], pt[1]));
            else (cellPath as paper.Path).lineTo(new paper.Point(pt[0], pt[1]));
          });
          (cellPath as paper.Path).closePath();

          if (!groupPath) groupPath = cellPath;
          else {
            const united = groupPath.unite(cellPath);
            groupPath.remove();
            cellPath.remove();
            groupPath = united;
          }
        });

        if (!groupPath) return;

        // 2. Apply connectors
        relevantStampKeys.forEach(key => {
          const sInfo = stamps.get(key)!;
          const { stamp, ownerIdx, neighborIdx, direction } = sInfo;
          const isOwner = indices.includes(ownerIdx);
          const isNeighbor = indices.includes(neighborIdx);
          
          // Internal edges don't need connectors
          if (isOwner && isNeighbor) return;

          const s = stamp.clone() as paper.Path;
          let next: paper.PathItem;
          
          if (isOwner) {
            next = direction === 'OUT' ? groupPath!.unite(s) : groupPath!.subtract(s);
          } else {
            // isNeighbor
            next = direction === 'OUT' ? groupPath!.subtract(s) : groupPath!.unite(s);
          }
          
          groupPath!.remove();
          s.remove();
          groupPath = next;
        });

        // 3. Global Robustness Check (Optional but kept for edge cases, now optimized with bounds check)
        // Only check "OUT" stamps that might poke into this piece from non-adjacent neighbors
        stamps.forEach((sInfo, key) => {
          if (relevantStampKeys.has(key)) return; // Already handled
          if (sInfo.direction === 'OUT' && groupPath!.bounds.intersects(sInfo.stamp.bounds)) {
            const s = sInfo.stamp.clone() as paper.Path;
            const next = groupPath!.subtract(s);
            groupPath!.remove();
            s.remove();
            groupPath = next;
          }
        });

        // 4. Whimsy clipping
        const firstIdx = indices[0];
        const whimsyId = basePolygons[firstIdx]?.whimsyId;
        if (whimsyId) {
          const wp = whimsyPaths.find(w => w.id === whimsyId);
          if (wp) {
            const clipped = groupPath.intersect(wp.path);
            groupPath.remove();
            groupPath = clipped;
          }
        } else {
          // PERFORMANCE: Subtracting individual whimsies is often faster than a single complex union
          // especially when whimsies are sparse.
          whimsyPaths.forEach(wp => {
            if (groupPath && groupPath.bounds.intersects(wp.path.bounds)) {
              const subtracted = groupPath.subtract(wp.path);
              groupPath.remove();
              groupPath = subtracted;
            }
          });
        }

        // 5. Finalize piece data
        const isWarped = warpEdges || indices.some(idx => warpedPieceIds.has(`v-${idx}`));
        const groupPieces: Piece[] = [];
        
        if (groupPath instanceof paper.CompoundPath) {
          groupPath.children.forEach((child, j) => {
            if (child instanceof paper.Path && !child.isEmpty() && Math.abs(child.area) > 1) {
              const p = {
                id: `${id}-${j}`,
                seedIndices: indices,
                pathData: child.pathData,
                color,
                isWhimsy: false,
                isWarped
              };
              groupPieces.push(p);
              finalPieces.push(p);
            }
          });
        } else if (groupPath instanceof paper.Path && !groupPath.isEmpty() && Math.abs(groupPath.area) > 1) {
          const p = {
            id,
            seedIndices: indices,
            pathData: groupPath.pathData,
            color,
            isWhimsy: false,
            isWarped
          };
          groupPieces.push(p);
          finalPieces.push(p);
        }
        
        // Update cache for this piece
        nextCache.set(id, { hash: pieceHash, pieces: groupPieces });
        groupPath.remove();
      };

      // Process merged groups
      mergedGroups.forEach((group, i) => {
        const color = COLORS[i % COLORS.length];
        processGroup(group, `m-${i}`, color);
        group.forEach(idx => processedIndices.add(idx));
      });

      // Process remaining individual pieces
      basePolygons.forEach(bp => {
        if (!bp || processedIndices.has(bp.index)) return;
        const color = COLORS[bp.index % COLORS.length];
        processGroup([bp.index], `v-${bp.index}`, color);
      });

      // Add standalone whimsies (those with no points inside)
      whimsyPaths.forEach((wp, i) => {
        const hasPoints = points.some(p => isPointInPath(p, wp.path));
        if (!hasPoints) {
          finalPieces.push({
            id: `w-${wp.id}`,
            pathData: wp.path.pathData,
            color: COLORS[(finalPieces.length + i) % COLORS.length],
            isWhimsy: true,
            isWarped: false
          });
        }
      });

      // Final cleanup
      whimsyPaths.forEach(wp => wp.path.remove());
      stamps.forEach(s => s.stamp.remove());

      // Update the persistent cache with the results from this run
      pieceCache.current = nextCache;

      const endTime = performance.now();
      if (endTime - startTime > 100) {
        console.warn(`Puzzle generation took ${Math.round(endTime - startTime)}ms`);
      }

      return finalPieces;
    } catch (err) {
      console.error("Error generating puzzle pieces:", err);
      return [];
    }
  }, [points, whimsies, width, height, tabRadius, warpEdges, customConnectors, mergedGroups, warpedPieceIds]);

  // --- Handlers ---
  const mergeSmallPieces = () => {
    if (!voronoi || pieces.length === 0) return;

    const smallPieces = pieces.filter(p => {
      const path = new paper.Path(p.pathData);
      const area = Math.abs(path.area);
      path.remove();
      return area < MIN_PIECE_AREA && !p.isWhimsy;
    });

    if (smallPieces.length === 0) return;

    setMergedGroups(prev => {
      let next = [...prev];
      smallPieces.forEach(small => {
        const smallPath = new paper.Path(small.pathData);
        let maxIntersectionLength = 0;
        let bestNeighborSeedIndex = -1;

        pieces.forEach(large => {
          if (large.id === small.id || large.isWhimsy) return;
          const largePath = new paper.Path(large.pathData);
          const intersection = smallPath.intersect(largePath) as paper.Path;
          if (intersection && !intersection.isEmpty()) {
            const len = intersection.length || 0;
            if (len > maxIntersectionLength) {
              maxIntersectionLength = len;
              bestNeighborSeedIndex = large.seedIndex !== undefined ? large.seedIndex : large.seedIndices?.[0];
            }
          }
          largePath.remove();
          if (intersection) intersection.remove();
        });

        if (bestNeighborSeedIndex !== -1) {
          const mySeedIndex = small.seedIndex !== undefined ? small.seedIndex : small.seedIndices?.[0];
          if (mySeedIndex !== undefined && mySeedIndex !== bestNeighborSeedIndex) {
            // Find existing groups or create new one
            const myGroupIdx = next.findIndex(g => g.includes(mySeedIndex));
            const neighborGroupIdx = next.findIndex(g => g.includes(bestNeighborSeedIndex));

            if (myGroupIdx !== -1 && neighborGroupIdx !== -1) {
              if (myGroupIdx !== neighborGroupIdx) {
                // Merge two groups
                const newGroup = [...new Set([...next[myGroupIdx], ...next[neighborGroupIdx]])];
                next = next.filter((_, idx) => idx !== myGroupIdx && idx !== neighborGroupIdx);
                next.push(newGroup);
              }
            } else if (myGroupIdx !== -1) {
              next[myGroupIdx] = [...new Set([...next[myGroupIdx], bestNeighborSeedIndex])];
            } else if (neighborGroupIdx !== -1) {
              next[neighborGroupIdx] = [...new Set([...next[neighborGroupIdx], mySeedIndex])];
            } else {
              next.push([mySeedIndex, bestNeighborSeedIndex]);
            }
          }
        }
        smallPath.remove();
      });
      return next;
    });
  };

  const exportSVG = () => {
    if (pieces.length === 0) return;
    const svgContent = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="none" stroke="black" stroke-width="2" />
        ${pieces.map(p => `
          <path d="${p.pathData}" fill="none" stroke="black" stroke-width="1" />
        `).join('')}
        ${whimsies.map(w => `
          <path d="${getWhimsyPathData(w.type as any, w.center, w.size, w.rotation || 0, w.scale || 1, w.customPathData)}" fill="none" stroke="black" stroke-width="1" />
        `).join('')}
      </svg>
    `;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `puzzle-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetPuzzle = () => {
    setPoints([]);
    setWhimsies([]);
    setLog([]);
    generateRandomPoints(40);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  const handleCanvasClick = (e: any) => {
    console.log("Canvas clicked at mode:", toolMode);
    const rect = e.currentTarget?.getBoundingClientRect();
    if (!rect) return;
    
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    // Handle touch events
    if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    if (clientX === undefined || clientY === undefined) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    console.log("Coords:", x, y);

    if (toolMode === 'ADD_WHIMSY') {
      const selectedWhimsy = customWhimsies.find(w => w.id === selectedCustomWhimsyId);
      if (selectedWhimsy) {
        addWhimsy(selectedWhimsy.type, { x, y });
      }
    } else if (toolMode === 'ADD_POINT') {
      addManualPoint({ x, y });
    } else if (toolMode === 'SELECT') {
      // Find piece or whimsy at click location
      const paperPoint = new paper.Point(x, y);
      
      // Check whimsies first (they are usually smaller/on top)
      const clickedWhimsy = whimsies.find(w => {
        const path = createWhimsyPath(w.type as any, w.center, w.size, w.rotation || 0, w.scale || 1, w.customPathData);
        const contains = path.contains(paperPoint);
        path.remove();
        return contains;
      });

      if (clickedWhimsy) {
        setSelectedPieceId(`w-${clickedWhimsy.id}`);
        setSelectedEdgeKey(null);
        return;
      }

      const clickedPiece = pieces.find(p => {
        const path = new paper.Path(p.pathData);
        const contains = path.contains(paperPoint);
        path.remove();
        return contains;
      });
      if (clickedPiece) {
        setSelectedPieceId(clickedPiece.id);
      } else {
        setSelectedPieceId(null);
        setSelectedEdgeKey(null);
      }
    } else if (toolMode === 'MERGE') {
      const paperPoint = new paper.Point(x, y);
      const clickedPiece = pieces.find(p => {
        const path = new paper.Path(p.pathData);
        const contains = path.contains(paperPoint);
        path.remove();
        return contains;
      });

      if (clickedPiece && !clickedPiece.isWhimsy) {
        const seedIndex = clickedPiece.seedIndex !== undefined ? clickedPiece.seedIndex : clickedPiece.seedIndices?.[0];
        if (seedIndex !== undefined) {
          if (selectedPieceId && (selectedPieceId.startsWith('v-') || selectedPieceId?.startsWith('m-'))) {
            const prevPiece = pieces.find(p => p.id === selectedPieceId);
            const prevSeedIndex = prevPiece?.seedIndex !== undefined ? prevPiece.seedIndex : prevPiece?.seedIndices?.[0];
            
            if (prevSeedIndex !== undefined && prevSeedIndex !== seedIndex) {
              // Merge them
              setMergedGroups(prev => {
                const myGroupIdx = prev.findIndex(g => g.includes(seedIndex));
                const prevGroupIdx = prev.findIndex(g => g.includes(prevSeedIndex));

                const next = [...prev];

                if (myGroupIdx !== -1 && prevGroupIdx !== -1) {
                  if (myGroupIdx !== prevGroupIdx) {
                    // Merge two existing groups
                    const newGroup = [...new Set([...next[myGroupIdx], ...next[prevGroupIdx]])];
                    const filtered = next.filter((_, idx) => idx !== myGroupIdx && idx !== prevGroupIdx);
                    return [...filtered, newGroup];
                  }
                  return next; // Already in same group
                } else if (myGroupIdx !== -1) {
                  // Add prevSeedIndex to my group
                  next[myGroupIdx] = [...new Set([...next[myGroupIdx], prevSeedIndex])];
                  return next;
                } else if (prevGroupIdx !== -1) {
                  // Add seedIndex to prev group
                  next[prevGroupIdx] = [...new Set([...next[prevGroupIdx], seedIndex])];
                  return next;
                } else {
                  // Create new group
                  return [...next, [prevSeedIndex, seedIndex]];
                }
              });
              setSelectedPieceId(null);
              setToolMode('SELECT');
            }
          } else {
            setSelectedPieceId(clickedPiece.id);
          }
        }
      }
    }
  };

  const longPressProps = useLongPress(
    (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX !== undefined && clientY !== undefined) {
        setRadialMenu({ x: clientX, y: clientY });
      }
    },
    (e) => handleCanvasClick(e),
    { delay: 500, shouldPreventDefault: false }
  );

  const deleteSelectedPiece = () => {
    if (!selectedPieceId) return;

    if (selectedPieceId.startsWith('v-')) {
      const parts = selectedPieceId.split('-');
      const index = parseInt(parts[1]);
      setPoints(prev => prev.filter((_, i) => i !== index));
      // Clean up merged groups
      setMergedGroups(prev => prev.map(g => g.filter(s => s !== index)).filter(g => g.length > 1));
      // Also clean up connectors
      setCustomConnectors(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (key.split('-').includes(index.toString())) {
            delete next[key];
          }
        });
        return next;
      });
    } else if (selectedPieceId.startsWith('m-')) {
      const parts = selectedPieceId.split('-');
      const groupIdx = parseInt(parts[1]);
      const group = mergedGroups[groupIdx];
      setPoints(prev => prev.filter((_, i) => !group.includes(i)));
      setMergedGroups(prev => prev.filter((_, i) => i !== groupIdx));
    } else if (selectedPieceId.startsWith('w-')) {
      const id = selectedPieceId.split('-')[1];
      setWhimsies(prev => prev.filter(w => w.id !== id));
    }

    setLog(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: 'DELETE_PIECE',
      params: { id: selectedPieceId },
      timestamp: Date.now()
    }]);
    setSelectedPieceId(null);
  };

  const updateConnector = (edgeKey: string, updates: Partial<ConnectorConfig>) => {
    setCustomConnectors(prev => {
      const raw = prev[edgeKey] || 'TAB';
      const current = typeof raw === 'string' 
        ? { type: raw as ConnectorType, offset: 0.5, depth: 1, direction: 'OUT', scale: 1 } 
        : raw;
      return {
        ...prev,
        [edgeKey]: { ...current, ...updates } as ConnectorConfig
      };
    });
    
    setLog(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: 'UPDATE_CONNECTOR',
      params: { edgeKey, ...updates },
      timestamp: Date.now()
    }]);
  };

  const updateWhimsy = (id: string, updates: Partial<{ rotation: number; scale: number; size: number }>) => {
    setWhimsies(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    setLog(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: 'UPDATE_WHIMSY',
      params: { id, updates },
      timestamp: Date.now()
    }]);
  };

  const togglePieceWarp = () => {
    if (!selectedPieceId) return;
    
    // Normalize ID (remove sub-piece suffix if any)
    const baseId = selectedPieceId.split('-').slice(0, 2).join('-');
    
    setWarpedPieceIds(prev => {
      const next = new Set(prev);
      if (next.has(baseId)) next.delete(baseId);
      else next.add(baseId);
      return next;
    });

    setLog(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: 'TOGGLE_PIECE_WARP',
      params: { id: baseId },
      timestamp: Date.now()
    }]);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row font-sans overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-indigo-500" />
          <span className="font-bold tracking-tight">Jigsaw Studio</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 w-80 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col gap-8 overflow-y-auto transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}
        `}
      >
        <div className="hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Jigsaw Studio</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
            <Settings className="w-4 h-4" />
            Canvas Settings
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500">Width</label>
              <input 
                type="number" 
                value={width} 
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500">Height</label>
              <input 
                type="number" 
                value={height} 
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Show Points</label>
            <button 
              onClick={() => setShowPoints(!showPoints)}
              className={`w-10 h-5 rounded-full transition-colors relative ${showPoints ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showPoints ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Show Colors</label>
            <button 
              onClick={() => setShowColors(!showColors)}
              className={`w-10 h-5 rounded-full transition-colors relative ${showColors ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showColors ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
            <LinkIcon className="w-4 h-4" />
            Connectors
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Tab Size</span>
              <span>{localTabRadius}px</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="30" 
              value={localTabRadius} 
              onChange={(e) => setLocalTabRadius(Number(e.target.value))}
              onMouseUp={() => setTabRadius(localTabRadius)}
              onTouchEnd={() => setTabRadius(localTabRadius)}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            Transformations
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Warp Edges</label>
            <button 
              onClick={() => setWarpEdges(!warpEdges)}
              className={`w-10 h-5 rounded-full transition-colors relative ${warpEdges ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${warpEdges ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
            <MousePointer2 className="w-4 h-4" />
            Tools
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setToolMode('SELECT')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-medium border ${toolMode === 'SELECT' ? 'bg-zinc-800 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <MousePointer2 className="w-4 h-4" />
              Select
            </button>
            <button 
              onClick={() => setToolMode('ADD_POINT')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-medium border ${toolMode === 'ADD_POINT' ? 'bg-zinc-800 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Plus className="w-4 h-4" />
              Add Point
            </button>
            <button 
              onClick={() => setToolMode('MERGE')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-medium border ${toolMode === 'MERGE' ? 'bg-zinc-800 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Zap className="w-4 h-4" />
              Merge
            </button>
            <button 
              onClick={() => setToolMode('ADD_WHIMSY')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-medium border ${toolMode === 'ADD_WHIMSY' ? 'bg-zinc-800 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Heart className="w-4 h-4" />
              Whimsy
            </button>
          </div>

          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Whimsy Library</div>
              <label className="cursor-pointer p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700">
                <Plus className="w-3 h-3 text-zinc-300" />
                <input type="file" accept=".svg" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            
            <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
              {customWhimsies.map(w => (
                <button
                  key={w.id}
                  onClick={() => {
                    setSelectedCustomWhimsyId(w.id);
                    setToolMode('ADD_WHIMSY');
                  }}
                  className={`aspect-square rounded-lg border flex items-center justify-center p-1 transition-all ${selectedCustomWhimsyId === w.id && toolMode === 'ADD_WHIMSY' ? 'bg-indigo-500/20 border-indigo-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                  title={w.name}
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-400">
                    <path 
                      d={getWhimsyPathData(w.type, { x: 50, y: 50 }, 40, 0, 1, w.pathData)} 
                      fill="currentColor" 
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {toolMode !== 'SELECT' && (
            <div className="flex flex-col gap-2 bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
              <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse">
                <Zap className="w-3 h-3" />
                {toolMode === 'ADD_POINT' ? 'Click to add a point' : 
                 toolMode === 'MERGE' ? 'Click two pieces to merge' : 'Click to place whimsy'}
              </div>
              {toolMode.startsWith('ADD_') && (
                <div className="text-[10px] text-zinc-500 flex flex-col gap-1">
                  <span>• Scroll to Scale ({Math.round(whimsyScale * 100)}%)</span>
                  <span>• Shift + Scroll to Rotate ({whimsyRotation}°)</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Selection controls moved to ContextPanel */}


        <section className="space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            Generation
          </div>
          <div className="space-y-2">
            <button 
              onClick={() => {
                setPoints([]);
                generateRandomPoints(points.length || 40);
              }}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate Pattern
            </button>
            <button 
              onClick={() => generateRandomPoints(10)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add 10 Pieces
            </button>
            <button 
              onClick={mergeSmallPieces}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-lg transition-colors text-sm font-medium border border-zinc-700"
            >
              <Zap className="w-4 h-4" />
              Merge Small Pieces
            </button>
            <button 
              onClick={() => {
                setPoints([]);
                setWhimsies([]);
                setMergedGroups([]);
                setCustomConnectors({});
                setWarpedPieceIds(new Set());
                setSelectedPieceId(null);
              }}
              className="w-full flex items-center justify-center gap-2 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 py-2.5 rounded-lg transition-colors text-sm font-medium border border-rose-900/50"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </section>

        <div className="mt-auto pt-6 border-t border-zinc-800 space-y-3">
          <button 
            onClick={() => setShowLog(!showLog)}
            className="w-full flex items-center justify-between px-4 py-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-all text-sm"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Operation Log
            </div>
            <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{log.length}</span>
          </button>
          <button 
            onClick={exportSVG}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl transition-all font-semibold shadow-lg shadow-emerald-900/20"
          >
            <Download className="w-5 h-5" />
            Export SVG
          </button>
          <button 
            onClick={resetPuzzle}
            className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-red-400 py-2 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Reset All
          </button>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative overflow-auto bg-zinc-950 flex items-center justify-center p-4 lg:p-12">
        {/* Desktop Toggle Button (when sidebar is closed) */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="hidden lg:flex absolute left-4 top-4 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all z-30"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div 
          className="relative bg-white shadow-2xl shadow-indigo-900/10 rounded-sm overflow-hidden shrink-0"
          style={{ width, height }}
        >
          <svg 
            width={width} 
            height={height} 
            viewBox={`0 0 ${width} ${height}`}
            className={`absolute inset-0 ${toolMode !== 'SELECT' ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseMove={handleCanvasMouseMove}
            {...longPressProps}
          >
            {/* Whimsy Preview */}
            {toolMode === 'ADD_WHIMSY' && (
              <g 
                className="pointer-events-none opacity-50"
                transform={`translate(${mousePos.x}, ${mousePos.y}) rotate(${whimsyRotation}) scale(${whimsyScale}) translate(${-mousePos.x}, ${-mousePos.y})`}
              >
                <path 
                  d={getWhimsyPathData(
                    customWhimsies.find(w => w.id === selectedCustomWhimsyId)?.type || 'HEART', 
                    mousePos, 
                    60, 
                    whimsyRotation, 
                    whimsyScale,
                    customWhimsies.find(w => w.id === selectedCustomWhimsyId)?.pathData
                  )}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              </g>
            )}

            {/* Puzzle Pieces */}
            {pieces.map((piece) => (
              <g key={piece.id}>
                <path
                  d={piece.pathData}
                  fill={showColors ? piece.color : 'white'}
                  fillOpacity={showColors ? (selectedPieceId === piece.id ? 0.8 : 0.4) : 1}
                  stroke={selectedPieceId === piece.id ? "#6366f1" : (piece.isWhimsy ? "#ef4444" : "#334155")}
                  strokeWidth={selectedPieceId === piece.id ? "3" : (piece.isWhimsy ? "2" : "1.5")}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-200"
                />
                {/* Hover Interaction */}
                <motion.path
                  d={piece.pathData}
                  fill="transparent"
                  stroke="transparent"
                  whileHover={{ fill: 'rgba(79, 70, 229, 0.1)', stroke: '#4f46e5', strokeWidth: 2.5 }}
                  transition={{ duration: 0.2 }}
                />
              </g>
            ))}

            {/* Whimsies Indicator (for visual clarity during placement) */}
            {toolMode !== 'SELECT' && (
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-indigo-500/30" />
            )}

            {/* Whimsies */}
            {whimsies.map((w) => (
              <path
                key={w.id}
                d={getWhimsyPathData(w.type as any, w.center, w.size, w.rotation || 0, w.scale || 1, w.customPathData)}
                fill={selectedPieceId === `w-${w.id}` ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.1)"}
                stroke="#ef4444"
                strokeWidth={selectedPieceId === `w-${w.id}` ? "3" : "2"}
                strokeDasharray={selectedPieceId === `w-${w.id}` ? "none" : "4 2"}
                className="cursor-pointer transition-all duration-200"
                onClick={(e) => {
                  if (toolMode === 'SELECT') {
                    e.stopPropagation();
                    setSelectedPieceId(`w-${w.id}`);
                  }
                }}
              />
            ))}

            {/* Points */}
            {showPoints && points.map((p, i) => (
              <circle 
                key={i} 
                cx={p.x} 
                cy={p.y} 
                r="2" 
                fill="#6366f1" 
                className="opacity-40 pointer-events-none"
              />
            ))}

            {/* Edge Handles for Connector Editing */}
            {selectedPieceId && (selectedPieceId.startsWith('v-') || selectedPieceId.startsWith('m-')) && voronoi && (
              <g>
                {(() => {
                  let myIndices: number[] = [];
                  if (selectedPieceId.startsWith('v-')) {
                    myIndices = [parseInt(selectedPieceId.split('-')[1])];
                  } else {
                    const groupIdx = parseInt(selectedPieceId.split('-')[1]);
                    myIndices = mergedGroups[groupIdx] || [];
                  }
                  
                  const edgeHandles: React.ReactNode[] = [];
                  const processedEdges = new Set<string>();

                  myIndices.forEach(myIndex => {
                    const myPoint = points[myIndex];
                    const neighbors = Array.from(voronoi.neighbors(myIndex)) as number[];
                    
                    neighbors.forEach(neighborIndex => {
                      // Don't show handles for internal edges of a merged group
                      if (myIndices.includes(neighborIndex)) return;

                      const edgeKey = [myIndex, neighborIndex].sort((a, b) => a - b).join('-');
                      if (processedEdges.has(edgeKey)) return;
                      processedEdges.add(edgeKey);

                      const edge = edges.get(edgeKey);
                      if (!edge) return null;

                      const p1 = edge.v1;
                      const p2 = edge.v2;
                      const rawConfig = customConnectors[edgeKey] || 'TAB';
                      const config = typeof rawConfig === 'string' 
                        ? { type: rawConfig as ConnectorType, offset: 0.5, depth: 1, direction: 'OUT' as const, scale: 1 } 
                        : rawConfig;
                      
                      const offset = config.offset;
                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const len = Math.sqrt(dx * dx + dy * dy);
                      
                      // Outward normal for CCW polygon: (dy, -dx)
                      const nx = dy / len;
                      const ny = -dx / len;
                      
                      const midX = p1.x + dx * offset;
                      const midY = p1.y + dy * offset;
                      
                      const r = tabRadius * config.scale;
                      const depthSign = config.direction === 'OUT' ? 1 : -1;
                      const dOffset = config.depth * r * 0.95 * depthSign;
                      
                      // Handle position follows the connector center
                      const handleX = midX + nx * dOffset;
                      const handleY = midY + ny * dOffset;
                      
                      edgeHandles.push(
                        <g key={edgeKey} className="cursor-pointer group">
                          {/* Dashed line to edge */}
                          <line 
                            x1={midX} y1={midY} x2={handleX} y2={handleY} 
                            stroke="#6366f1" strokeWidth="1" strokeDasharray="2,2" 
                            className="opacity-40"
                          />
                          <circle 
                            cx={handleX} 
                            cy={handleY} 
                            r={selectedEdgeKey === edgeKey ? "10" : "6"} 
                            fill={selectedEdgeKey === edgeKey ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.2)"} 
                            stroke={selectedEdgeKey === edgeKey ? "#10b981" : "#6366f1"} 
                            strokeWidth={selectedEdgeKey === edgeKey ? "2" : "1"}
                            className="hover:fill-indigo-500/40 transition-all"
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEdgeKey(edgeKey);
                            }}
                          />
                          <text 
                            x={midX} 
                            y={midY} 
                            dy=".3em" 
                            textAnchor="middle" 
                            className={`text-[8px] font-bold pointer-events-none select-none ${selectedEdgeKey === edgeKey ? 'fill-emerald-400' : 'fill-indigo-400'}`}
                          >
                            {config.type.charAt(0)}
                          </text>
                        </g>
                      );
                    });
                  });
                  return edgeHandles;
                })()}
              </g>
            )}
          </svg>
        </div>

        {/* Log Overlay */}
        <AnimatePresence>
          {showLog && (
            <motion.div 
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 shadow-2xl p-6 z-50 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  History
                </h2>
                <button onClick={() => setShowLog(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {log.slice().reverse().map((op) => (
                  <div key={op.id} className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 text-xs">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-indigo-400">{op.type}</span>
                      <span className="text-zinc-500">{new Date(op.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-zinc-400 overflow-x-auto">
                      {JSON.stringify(op.params, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </main>

      {/* Radial Menu Overlay */}
      <AnimatePresence>
        {radialMenu && (
          <RadialMenu 
            x={radialMenu.x} 
            y={radialMenu.y} 
            onSelect={(mode) => setToolMode(mode)} 
            onClose={() => setRadialMenu(null)} 
          />
        )}
      </AnimatePresence>

      {/* Contextual Panel */}
      <ContextPanel 
        stats={{
          pieces: pieces.length,
          whimsies: whimsies.length,
          area: width * height,
          toolMode: toolMode
        }}
        selection={{
          id: selectedEdgeKey || selectedPieceId,
          type: selectedEdgeKey ? 'EDGE' : selectedPieceId ? (selectedPieceId.startsWith('w-') ? 'WHIMSY' : 'PIECE') : 'NONE',
          data: selectedEdgeKey 
            ? { edgeKey: selectedEdgeKey, config: customConnectors[selectedEdgeKey] || { type: 'TAB', offset: 0.5, depth: 1, scale: 1 } }
            : selectedPieceId?.startsWith('w-') 
              ? whimsies.find(w => w.id === selectedPieceId.split('-')[1])
              : selectedPieceId ? { isWarped: warpedPieceIds.has(selectedPieceId.split('-').slice(0, 2).join('-')) } : undefined
        }}
        onUpdateWhimsy={updateWhimsy}
        onUpdateConnector={updateConnector}
        onDelete={deleteSelectedPiece}
        onToggleWarp={togglePieceWarp}
        onTestEdgeHandles={() => {
          console.log("Testing Edge Handles...");
          Object.entries(customConnectors).forEach(([key, config]) => {
            const [i, j] = key.split('-').map(Number);
            const p1 = points[i];
            const p2 = points[j];
            const cfg = config as ConnectorConfig | string;
            const offset = typeof cfg === 'string' ? 0.5 : cfg.offset;
            const midX = p1.x + (p2.x - p1.x) * offset;
            const midY = p1.y + (p2.y - p1.y) * offset;
            console.log(`Edge ${key}: Handle at (${midX.toFixed(2)}, ${midY.toFixed(2)}) with offset ${offset}`);
          });
        }}
      />
    </div>
  );
}





