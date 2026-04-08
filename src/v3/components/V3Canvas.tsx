import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { PuzzleState, AreaType, Point, Area, Connector } from '../types';
import { getWhimsyTemplatePathData, WhimsyTemplateId } from '../utils/whimsyGallery';
import { 
  getPointOnBoundary, 
  getNormalOnBoundary, 
  getClosestLocationOnBoundary,
} from '../utils/paperUtils';
import { 
  findNeighborPiece, 
  generateConnectorPath 
} from '../utils/connectorUtils';
import paper from 'paper';

interface V3CanvasProps {
  puzzleState: PuzzleState;
  selectedIds: string[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onClick: (id: string | null, point?: Point) => void;
  fitScale: number;
  whimsyPlacementActive: boolean;
  whimsyTemplate: string;
  whimsyScale: number;
  whimsyRotationDeg: number;
  onWhimsyCommit: (p: Point) => void;
  activeTab: string;
  connectionT: number;
  connectionPathIndex: number;
  onConnectionUpdate: (t: number, pathIndex: number) => void;
  connectorWidthPx: number;
  connectorExtrusion: number;
  connectorHeadTemplate: string;
  connectorHeadScale: number;
  connectorHeadRotation: number;
  connectorJitter: number;
  connectorJitterSeed: number;
  useEquidistantHeadPoint: boolean;
  selectedConnectorId: string | null;
  onConnectorSelect: (id: string | null) => void;
  onConnectorUpdate: (id: string, updates: Partial<Connector>) => void;
  rectSelectMode: boolean;
  rectStart: Point | null;
  onRectPoint: (pt: Point) => void;
  previewConnectors: Record<string, Connector>;
}

export const V3Canvas: React.FC<V3CanvasProps> = ({ 
  puzzleState, 
  selectedIds, 
  hoveredId, 
  onHover, 
  onClick,
  fitScale,
  whimsyPlacementActive,
  whimsyTemplate,
  whimsyScale,
  whimsyRotationDeg,
  onWhimsyCommit,
  activeTab,
  connectionT,
  connectionPathIndex,
  onConnectionUpdate,
  connectorWidthPx,
  connectorExtrusion,
  connectorHeadTemplate,
  connectorHeadScale,
  connectorHeadRotation,
  connectorJitter,
  connectorJitterSeed,
  useEquidistantHeadPoint,
  selectedConnectorId,
  onConnectorSelect,
  onConnectorUpdate,
  rectSelectMode,
  rectStart,
  onRectPoint,
  previewConnectors,
}) => {
  const { areas, connectors, whimsies, width, height } = puzzleState;
  const outerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(fitScale);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingConnectorId, setDraggingConnectorId] = useState<string | null>(null);
  const [isDraggingNewHandler, setIsDraggingNewHandler] = useState(false);

  const viewRef = useRef({ zoom, pan });
  useEffect(() => { viewRef.current = { zoom, pan }; }, [zoom, pan]);

  const fitToScreen = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setZoom(fitScale);
    setPan({
      x: (rect.width - width * fitScale) / 2,
      y: (rect.height - height * fitScale) / 2,
    });
  }, [fitScale, width, height]);

  useEffect(() => { fitToScreen(); }, [fitScale, width, height, fitToScreen]);

  const applyZoom = useCallback((newZoom: number) => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const clamped = Math.min(fitScale * 10, Math.max(fitScale * 0.1, newZoom));
    const ratio = clamped / viewRef.current.zoom;
    const newPan = { 
      x: cx - (cx - viewRef.current.pan.x) * ratio, 
      y: cy - (cy - viewRef.current.pan.y) * ratio 
    };
    setPan(newPan);
    setZoom(clamped);
  }, [fitScale]);

  const clientToBoard = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const leafPieces = useMemo(() => {
    return (Object.values(areas) as Area[]).filter(a => a.type === AreaType.PIECE);
  }, [areas]);

  const whimsyPreviewPathData = useMemo(() => {
    if (!whimsyPlacementActive) return null;
    const whimsy = whimsies.find(w => w.id === whimsyTemplate);
    if (whimsy) return whimsy.svgData;
    return getWhimsyTemplatePathData(whimsyTemplate as WhimsyTemplateId);
  }, [whimsyPlacementActive, whimsyTemplate, whimsies]);

  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  const connectionData = useMemo(() => {
    if (activeTab !== 'CONNECTION' || selectedIds.length !== 1 || selectedConnectorId) return null;
    const piece = areas[selectedIds[0]];
    if (!piece || piece.type !== AreaType.PIECE) return null;
    try {
      const pt = getPointOnBoundary(piece.boundary, connectionT, connectionPathIndex);
      const normal = getNormalOnBoundary(piece.boundary, connectionT, connectionPathIndex);
      const neighborId = findNeighborPiece(areas, piece.id, pt, normal);
      
      // Generate preview connector using the stable preview seed
      const preview = generateConnectorPath(
        piece.boundary,
        connectionPathIndex,
        connectionT,
        connectorWidthPx,
        connectorExtrusion,
        connectorHeadTemplate,
        connectorHeadScale,
        connectorHeadRotation,
        useEquidistantHeadPoint,
        whimsies,
        connectorJitter,
        connectorJitterSeed
      );

      return { 
        point: { x: pt.x, y: pt.y }, 
        normal: { x: normal.x, y: normal.y },
        neighborId,
        boundary: piece.boundary,
        previewPath: preview.pathData,
        basePathData: preview.basePathData,
      };
    } catch (e) {
      console.error('Failed to get connection data:', e);
      return null;
    }
  }, [activeTab, selectedIds, areas, connectionT, connectionPathIndex, connectorWidthPx, connectorExtrusion, connectorHeadTemplate, connectorHeadScale, connectorHeadRotation, connectorJitter, connectorJitterSeed, whimsies]);

  // Cache rendered connector geometry per connector ID, keyed by a hash of inputs.
  // This avoids recomputing all connectors when only one changes (e.g. during drag).
  const connectorCacheRef = useRef<Record<string, { key: string; result: { id: string; pieceId: string; pathData: string; basePathData: string; color: string; point: { x: number; y: number }; normal: { x: number; y: number }; boundary: paper.PathItem } }>>({});

  const renderedConnectors = useMemo(() => {
    const cache = connectorCacheRef.current;
    // Remove stale entries for deleted connectors
    for (const id in cache) {
      if (!connectors[id]) delete cache[id];
    }

    return (Object.values(connectors) as Connector[]).map(c => {
      const piece = areas[c.pieceId];
      if (!piece) return null;

      // Build a stable key from all inputs that affect geometry
      const key = `${c.pieceId}|${c.pathIndex}|${c.midT}|${c.widthPx}|${c.extrusion}|${c.headTemplateId}|${c.headScale}|${c.headRotationDeg}|${c.useEquidistantHeadPoint}|${c.jitter || 0}|${c.jitterSeed || 0}`;
      const cached = cache[c.id];
      if (cached && cached.key === key) {
        return cached.result;
      }

      try {
        const result = generateConnectorPath(
          piece.boundary,
          c.pathIndex,
          c.midT,
          c.widthPx,
          c.extrusion,
          c.headTemplateId,
          c.headScale,
          c.headRotationDeg,
          c.useEquidistantHeadPoint,
          whimsies,
          c.jitter || 0,
          c.jitterSeed || 0
        );
        const pt = getPointOnBoundary(piece.boundary, c.midT, c.pathIndex);
        const normal = getNormalOnBoundary(piece.boundary, c.midT, c.pathIndex);

        const entry = {
          id: c.id,
          pieceId: c.pieceId,
          pathData: result.pathData,
          basePathData: result.basePathData,
          color: piece.color,
          point: { x: pt.x, y: pt.y },
          normal: { x: normal.x, y: normal.y },
          boundary: piece.boundary
        };
        cache[c.id] = { key, result: entry };
        return entry;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }, [connectors, areas, whimsies]);

  const renderedPreviewConnectors = useMemo(() => {
    return (Object.values(previewConnectors) as Connector[]).map(c => {
      const piece = areas[c.pieceId];
      if (!piece) return null;
      try {
        const result = generateConnectorPath(
          piece.boundary,
          c.pathIndex,
          c.midT,
          c.widthPx,
          c.extrusion,
          c.headTemplateId,
          c.headScale,
          c.headRotationDeg,
          c.useEquidistantHeadPoint,
          whimsies,
          c.jitter || 0,
          c.jitterSeed || 0
        );
        return { id: c.id, pieceId: c.pieceId, pathData: result.pathData, color: piece.color };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }, [previewConnectors, areas, whimsies]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const boardPt = clientToBoard(clientX, clientY);
    if (whimsyPlacementActive || rectSelectMode) {
      setMousePos(boardPt);
    }
    if (isDraggingNewHandler && connectionData) {
      const { t, pathIndex } = getClosestLocationOnBoundary(connectionData.boundary, new paper.Point(boardPt.x, boardPt.y));
      onConnectionUpdate(t, pathIndex);
    }
    if (draggingConnectorId) {
      const connector = renderedConnectors.find(c => c!.id === draggingConnectorId);
      if (connector) {
        const { t, pathIndex } = getClosestLocationOnBoundary(connector.boundary, new paper.Point(boardPt.x, boardPt.y));
        onConnectorUpdate(draggingConnectorId, { midT: t, pathIndex });
      }
    }
  }, [whimsyPlacementActive, rectSelectMode, isDraggingNewHandler, draggingConnectorId, connectionData, renderedConnectors, clientToBoard, onConnectionUpdate, onConnectorUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingNewHandler(false);
    setDraggingConnectorId(null);
  }, []);

  useEffect(() => {
    if (isDraggingNewHandler || draggingConnectorId) {
      window.addEventListener('mousemove', handleMouseMove as any);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove as any, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove as any);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove as any);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingNewHandler, draggingConnectorId, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={outerRef}
      className="flex-1 overflow-hidden relative bg-slate-100 select-none"
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
    >
      <div
        className="absolute origin-top-left bg-white shadow-2xl rounded-sm overflow-hidden"
        style={{
          width,
          height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
        >
          <defs>
            <filter id="piece-selection-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
              <feFlood floodColor="#4338ca" floodOpacity="0.75" result="glowColor" />
              <feComposite in="glowColor" in2="blur" operator="in" result="softGlow" />
              <feMerge>
                <feMergeNode in="softGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Click Handler */}
          <rect
            width={width}
            height={height}
            fill="transparent"
            onClick={(e) => {
              e.stopPropagation();
              if (rectSelectMode) {
                onRectPoint(clientToBoard(e.clientX, e.clientY));
              } else {
                onClick(null);
              }
            }}
          />

          {leafPieces.map((piece) => {
            const isSelected = selectedIds.includes(piece.id);
            const isHovered = hoveredId === piece.id;
            const isNeighbor = connectionData?.neighborId === piece.id;

            return (
              <g key={piece.id}>
                <path
                  d={piece.boundary.pathData}
                  fill={piece.color}
                  fillRule="evenodd"
                  stroke={isSelected ? (activeTab === 'CONNECTION' ? '#10b981' : '#4f46e5') : isNeighbor ? '#fbbf24' : isHovered ? '#6366f1' : '#000'}
                  strokeWidth={isSelected ? 4 : isNeighbor ? 3 : isHovered ? 2 : 1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter={isSelected ? 'url(#piece-selection-glow)' : undefined}
                  className={`transition-all ${rectSelectMode ? 'cursor-crosshair' : 'cursor-pointer hover:opacity-90'}`}
                  onMouseEnter={() => onHover(piece.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (rectSelectMode) {
                      onRectPoint(clientToBoard(e.clientX, e.clientY));
                    } else {
                      onClick(piece.id, clientToBoard(e.clientX, e.clientY));
                    }
                  }}
                />
                {isSelected && (
                  <>
                    <path
                      d={piece.boundary.pathData}
                      fill="rgba(99, 102, 241, 0.18)"
                      fillRule="evenodd"
                      className="pointer-events-none"
                    />
                    <path
                      d={piece.boundary.pathData}
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      fillRule="evenodd"
                      strokeLinejoin="round"
                      className="pointer-events-none"
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* Render Connectors */}
          {renderedConnectors.map(c => {
            const isSelected = selectedConnectorId === c!.id;
            const isDisabled = connectors[c!.id]?.disabled;
            const isPieceSelected = selectedIds.includes(c!.pieceId);
            // Show handle if:
            // 1. The connector itself is selected
            // 2. OR if no connector is selected, it's the connection tab, and the piece is selected
            const showHandle = (activeTab === 'CONNECTION' || activeTab === 'MASS_CONNECTION') && (isSelected || (isPieceSelected && !selectedConnectorId));

            if (isDisabled && activeTab !== 'CONNECTION' && activeTab !== 'MASS_CONNECTION') return null;

            return (
              <g
                key={c!.id}
                className={(activeTab === 'CONNECTION' || activeTab === 'MASS_CONNECTION') ? 'cursor-pointer' : 'pointer-events-none'}
                opacity={isDisabled ? 0.3 : 1}
                onClick={(e) => {
                  if (activeTab === 'CONNECTION' || activeTab === 'MASS_CONNECTION') {
                    e.stopPropagation();
                    onConnectorSelect(c!.id);
                  }
                }}
              >
                <path
                  d={c!.pathData}
                  fill={c!.color}
                  stroke={isSelected ? '#10b981' : '#000'}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeLinejoin="round"
                />
                <path
                  d={c!.basePathData}
                  fill="none"
                  stroke={c!.color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
                
                {showHandle && (
                  <g 
                    className="cursor-move"
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      setDraggingConnectorId(c!.id); 
                      onConnectorSelect(c!.id); 
                    }}
                    onTouchStart={(e) => { 
                      e.stopPropagation(); 
                      setDraggingConnectorId(c!.id); 
                      onConnectorSelect(c!.id); 
                    }}
                  >
                    <circle
                      cx={c!.point.x}
                      cy={c!.point.y}
                      r={10}
                      fill="transparent"
                    />
                    <circle
                      cx={c!.point.x}
                      cy={c!.point.y}
                      r={isSelected ? 6 : 4}
                      fill={isSelected ? '#10b981' : '#64748b'}
                      stroke="white"
                      strokeWidth={2}
                      className={draggingConnectorId === c!.id ? '' : 'animate-pulse'}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Preview connectors (mass tab) — rendered ghosted */}
          {renderedPreviewConnectors.map(c => (
            <path
              key={c!.id}
              d={c!.pathData}
              fill={c!.color}
              fillOpacity={0.5}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
          ))}

          {connectionData && (
            <g>
              {/* Connector Preview */}
              <path
                d={connectionData.previewPath}
                fill={areas[selectedIds[0]].color}
                stroke="#10b981"
                strokeWidth={2}
                opacity={0.8}
                className="pointer-events-none"
              />
              <path
                d={connectionData.basePathData}
                fill="none"
                stroke={areas[selectedIds[0]].color}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.8}
                className="pointer-events-none"
              />
              
              <g 
                className="cursor-move"
                onMouseDown={(e) => { e.stopPropagation(); setIsDraggingNewHandler(true); }}
                onTouchStart={(e) => { e.stopPropagation(); setIsDraggingNewHandler(true); }}
              >
              <circle
                cx={connectionData.point.x}
                cy={connectionData.point.y}
                r={10}
                fill="transparent"
                className="pointer-events-all"
              />
              <circle
                cx={connectionData.point.x}
                cy={connectionData.point.y}
                r={6}
                fill="#10b981"
                stroke="white"
                strokeWidth={2}
                className={isDraggingNewHandler ? '' : 'animate-pulse'}
              />
              {/* Arrow indicating normal */}
              <line
                x1={connectionData.point.x}
                y1={connectionData.point.y}
                x2={connectionData.point.x + connectionData.normal.x * 15}
                y2={connectionData.point.y + connectionData.normal.y * 15}
                stroke="#10b981"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <path
                d={`M ${connectionData.point.x + connectionData.normal.x * 15} ${connectionData.point.y + connectionData.normal.y * 15} 
                   L ${connectionData.point.x + connectionData.normal.x * 10 + connectionData.normal.y * 4} ${connectionData.point.y + connectionData.normal.y * 10 - connectionData.normal.x * 4}
                   M ${connectionData.point.x + connectionData.normal.x * 15} ${connectionData.point.y + connectionData.normal.y * 15}
                   L ${connectionData.point.x + connectionData.normal.x * 10 - connectionData.normal.y * 4} ${connectionData.point.y + connectionData.normal.y * 10 + connectionData.normal.x * 4}`}
                stroke="#10b981"
                strokeWidth={2}
                strokeLinecap="round"
              />
              
              {/* Neighbor Indicator */}
              {connectionData.neighborId && (
                <text
                  x={connectionData.point.x + connectionData.normal.x * 25}
                  y={connectionData.point.y + connectionData.normal.y * 25}
                  fontSize="8"
                  fontWeight="bold"
                  fill="#d97706"
                  textAnchor="middle"
                  className="pointer-events-none drop-shadow-sm"
                >
                  Neighbor
                </text>
              )}
            </g>
          </g>
        )}

          {rectSelectMode && rectStart && (
            <rect
              x={Math.min(rectStart.x, mousePos.x)}
              y={Math.min(rectStart.y, mousePos.y)}
              width={Math.abs(mousePos.x - rectStart.x)}
              height={Math.abs(mousePos.y - rectStart.y)}
              fill="rgba(99, 102, 241, 0.1)"
              stroke="#6366f1"
              strokeWidth={1}
              strokeDasharray="4 2"
              className="pointer-events-none"
            />
          )}

          {whimsyPlacementActive && whimsyPreviewPathData && (
            <g 
              className="pointer-events-none" 
              transform={`translate(${mousePos.x}, ${mousePos.y}) scale(${whimsyScale}) rotate(${whimsyRotationDeg})`}
            >
              <path
                d={whimsyPreviewPathData}
                fill="rgba(168, 85, 247, 0.2)"
                stroke="rgba(109, 40, 217, 0.95)"
                strokeWidth={2 / whimsyScale}
                strokeLinejoin="round"
                fillRule="evenodd"
              />
            </g>
          )}

          {whimsyPlacementActive && (
            <rect
              width={width}
              height={height}
              fill="transparent"
              className="cursor-crosshair"
              style={{ pointerEvents: 'all' }}
              onMouseMove={(e) => {
                setMousePos(clientToBoard(e.clientX, e.clientY));
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onWhimsyCommit(clientToBoard(e.clientX, e.clientY));
              }}
            />
          )}
        </svg>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white rounded-xl shadow-md px-3 py-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); applyZoom(zoom / 1.25); }}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          title="Zoom out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="range"
          min={fitScale * 0.1}
          max={fitScale * 10}
          step={(fitScale * 10 - fitScale * 0.1) / 200}
          value={zoom}
          onChange={e => applyZoom(Number(e.target.value))}
          className="w-24 h-1 accent-indigo-500 cursor-pointer"
          title="Zoom"
        />
        <button
          onClick={(e) => { e.stopPropagation(); applyZoom(zoom * 1.25); }}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          title="Zoom in"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-bold text-slate-400 w-9 text-right tabular-nums">
          {Math.round((zoom / fitScale) * 100)}%
        </span>
        <div className="w-px h-4 bg-slate-100 mx-1" />
        <button
          onClick={(e) => { e.stopPropagation(); fitToScreen(); }}
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
          title="Fit to screen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
