import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { PuzzleState, AreaType, Point, Area, Connector, NeckShape, Node, Edge, Face } from '../types';
import { getWhimsyTemplatePathData, WhimsyTemplateId } from '../../v3/utils/whimsyGallery';
import { 
  getPointOnBoundary, 
  getNormalOnBoundary, 
  getClosestLocationOnBoundary,
} from '../../v3/utils/paperUtils';
import { 
  findNeighborPiece, 
  generateConnectorPath 
} from '../../v3/utils/connectorUtils';
import paper from 'paper';

interface V5CanvasProps {
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
  stampPlacementActive: boolean;
  activeStampSourceId: string | null;
  onStampCommit: (p: Point) => void;
  onStampCancelPlacement?: () => void;
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
  connectorNeckShape: NeckShape;
  connectorNeckCurvature: number;
  connectorExtrusionCurvature: number;
  useEquidistantHeadPoint: boolean;
  selectedConnectorId: string | null;
  onConnectorSelect: (id: string | null) => void;
  onConnectorUpdate: (id: string, updates: Partial<Connector>) => void;
  rectSelectMode: boolean;
  rectStart: Point | null;
  onRectPoint: (pt: Point) => void;
  previewConnectors: Record<string, Connector>;
}

export const V5Canvas: React.FC<V5CanvasProps> = ({ 
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
  stampPlacementActive,
  activeStampSourceId,
  onStampCommit,
  onStampCancelPlacement,
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
  connectorNeckShape,
  connectorNeckCurvature,
  connectorExtrusionCurvature,
  useEquidistantHeadPoint,
  selectedConnectorId,
  onConnectorSelect,
  onConnectorUpdate,
  rectSelectMode,
  rectStart,
  onRectPoint,
  previewConnectors,
}) => {
  const { areas, connectors, whimsies, width, height, nodes, edges, faces, useGraphMode } = puzzleState;
  const outerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(fitScale);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number, y: number, panX: number, panY: number } | null>(null);

  const viewRef = useRef({ zoom, pan });
  useEffect(() => { viewRef.current = { zoom, pan }; }, [zoom, pan]);

  const fitToScreen = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const paddingBottom = 60; 
    const availableHeight = rect.height - paddingBottom;
    setZoom(fitScale);
    setPan({
      x: (rect.width - width * fitScale) / 2,
      y: Math.max(0, (availableHeight - height * fitScale) / 2),
    });
  }, [fitScale, width, height]);

  useEffect(() => { fitToScreen(); }, [fitScale, width, height, fitToScreen]);

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

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    if (isPanning && panStartRef.current) {
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      });
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.target === e.currentTarget)) {
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y
      };
      setIsPanning(true);
    }
  };

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove as any);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove as any);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={outerRef}
      className="flex-1 overflow-hidden relative bg-slate-100 select-none"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute top-0 left-0 origin-top-left bg-white shadow-2xl rounded-sm overflow-hidden"
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
          {/* Background Click Handler */}
          <rect
            width={width}
            height={height}
            fill="transparent"
            onClick={(e) => {
              e.stopPropagation();
              const pt = clientToBoard(e.clientX, e.clientY);
              if (whimsyPlacementActive) {
                onWhimsyCommit(pt);
              } else if (stampPlacementActive) {
                onStampCommit(pt);
              } else {
                onClick(null);
              }
            }}
          />

          {/* Render Graph Faces */}
          {Object.values(faces).map((face: Face) => {
            const isSelected = selectedIds.includes(face.id);
            const isHovered = hoveredId === face.id;
            
            // Build path data for the face using paper.js for reliability
            const boundary = new paper.Path();
            
            face.edges.forEach((eInfo) => {
              const edge = edges[eInfo.id];
              if (!edge) return;
              
              const edgePath = new paper.Path(edge.pathData);
              if (eInfo.reversed) {
                edgePath.reverse();
              }
              boundary.addSegments(edgePath.segments);
              edgePath.remove();
            });
            
            boundary.closed = true;
            const pathData = boundary.pathData;
            boundary.remove();

            return (
              <path
                key={face.id}
                d={pathData}
                fill={isSelected ? 'rgba(99, 102, 241, 0.4)' : face.color}
                stroke={isSelected ? '#4f46e5' : 'none'}
                strokeWidth={isSelected ? 3 : 0}
                fillRule="evenodd"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onMouseEnter={() => onHover(face.id)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(face.id, clientToBoard(e.clientX, e.clientY));
                }}
              />
            );
          })}

          {/* Render Whimsies */}
          {(Object.values(areas) as Area[]).filter(a => a.id.startsWith('whimsy-')).map((whimsy) => {
            const isSelected = selectedIds.includes(whimsy.id);
            return (
              <path
                key={whimsy.id}
                d={whimsy.boundary.pathData}
                fill={isSelected ? 'rgba(99, 102, 241, 0.4)' : whimsy.color}
                stroke={isSelected ? '#4f46e5' : '#000'}
                strokeWidth={isSelected ? 2 : 1}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(whimsy.id, clientToBoard(e.clientX, e.clientY));
                }}
              />
            );
          })}

          {/* Render Graph Edges */}
          {Object.values(edges).map((edge: Edge) => {
            const isSelected = selectedIds.includes(edge.id);
            return (
              <g key={edge.id}>
                {/* Hit test area (wider, invisible) */}
                <path
                  d={edge.pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  strokeLinecap="round"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(edge.id, clientToBoard(e.clientX, e.clientY));
                  }}
                />
                <path
                  d={edge.pathData}
                  fill="none"
                  stroke={isSelected ? '#4f46e5' : '#000'}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeLinecap="round"
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {/* Render Connectors */}
          {[...Object.values(connectors), ...Object.values(previewConnectors)].map((c: Connector) => {
            if (c.disabled) return null;
            
            let boundary: paper.PathItem | null = null;
            let pathIndex = c.pathIndex;
            let midT = c.midT;

            if (useGraphMode && c.pieceId.startsWith('face-')) {
              const face = faces[c.pieceId];
              if (face && face.edges[c.pathIndex]) {
                const edge = edges[face.edges[c.pathIndex].id];
                if (edge) {
                  boundary = new paper.Path(edge.pathData);
                  pathIndex = 0;
                  if (face.edges[c.pathIndex].reversed) {
                    midT = 1 - c.midT;
                    boundary.reverse();
                  }
                }
              }
            } else {
              const piece = areas[c.pieceId];
              if (piece) boundary = piece.boundary;
            }

            if (!boundary) return null;

            const { pathData } = generateConnectorPath(
              boundary,
              pathIndex,
              midT,
              c.widthPx,
              c.extrusion,
              c.headTemplateId,
              c.headScale,
              c.headRotationDeg,
              c.useEquidistantHeadPoint,
              whimsies,
              c.jitter,
              c.jitterSeed,
              c.neckShape,
              c.neckCurvature,
              c.extrusionCurvature
            );

            if (useGraphMode && c.pieceId.startsWith('face-')) {
              boundary.remove();
            }

            const isSelected = selectedConnectorId === c.id;
            const isPreview = !connectors[c.id];

            return (
              <path
                key={c.id}
                d={pathData}
                fill={isPreview ? 'rgba(99, 102, 241, 0.2)' : '#fff'}
                stroke={isSelected ? '#4f46e5' : (isPreview ? '#94a3b8' : '#000')}
                strokeWidth={isSelected ? 3 : 1}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectorSelect(c.id);
                }}
              />
            );
          })}

          {/* Render Graph Nodes */}
          {Object.values(nodes).map((node: Node) => (
            <circle
              key={node.id}
              cx={node.point.x}
              cy={node.point.y}
              r={4}
              fill="#ef4444"
              className="hover:r-6 transition-all cursor-pointer"
            />
          ))}

          {/* Render Graph Faces (Labels) */}
          {Object.values(faces).map((face: Face) => {
            // Simple centroid calculation for label
            let cx = 0, cy = 0, count = 0;
            face.edges.forEach(eInfo => {
              const edge = edges[eInfo.id];
              if (!edge) return;
              const n1 = nodes[edge.fromNode];
              const n2 = nodes[edge.toNode];
              if (!n1 || !n2) return;
              cx += n1.point.x + n2.point.x;
              cy += n1.point.y + n2.point.y;
              count += 2;
            });
            return (
              <text
                key={face.id}
                x={cx / count}
                y={cy / count}
                fontSize="12"
                fill="#6366f1"
                textAnchor="middle"
                className="pointer-events-none font-bold"
              >
                {face.id}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button 
          onClick={() => setZoom(z => Math.min(z * 1.2, 10))}
          className="p-3 bg-white shadow-lg rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))}
          className="p-3 bg-white shadow-lg rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
        >
          <Minus className="w-5 h-5" />
        </button>
        <button 
          onClick={fitToScreen}
          className="p-3 bg-white shadow-lg rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
