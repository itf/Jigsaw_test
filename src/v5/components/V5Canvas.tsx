import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { PuzzleState, Point, ConnectorV5, NeckShape, Node, Edge, Face, FloatingWhimsy } from '../types';
import { getWhimsyTemplatePathData } from '../utils/whimsyGallery';
import { generateConnectorPath } from '../utils/connectorUtils';
import paper from 'paper';

interface V5CanvasProps {
  puzzleState: PuzzleState;
  selectedIds: string[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onClick: (id: string | null, point?: Point) => void;
  fitScale: number;
  // Floating whimsy placement
  whimsyPlacementActive: boolean;
  whimsyTemplate: string;
  whimsyScale: number;
  whimsyRotationDeg: number;
  onWhimsyCommit: (p: Point) => void;
  onFloatingWhimsyMove?: (id: string, center: Point) => void;
  onMergeWhimsy?: (id: string) => void;
  // Connection / connector state
  activeTab: string;
  selectedEdgeId: string | null;
  connectionT: number;
  onConnectionUpdate: (edgeId: string, t: number) => void;
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
  connectorDirection: 'in' | 'out';
  selectedConnectorId: string | null;
  onConnectorSelect: (id: string | null) => void;
  previewConnectors: Record<string, ConnectorV5>;
  // Rect select
  rectSelectMode: boolean;
  rectStart: Point | null;
  onRectPoint: (pt: Point) => void;
  // Debug
  showNodes?: boolean;
  showFaceLabels?: boolean;
}

/** Build a face closed path from edge list */
function buildFacePathData(face: Face, edges: Record<string, Edge>): string {
  const boundary = new paper.Path();
  face.edges.forEach((eInfo) => {
    const edge = edges[eInfo.id];
    if (!edge) return;
    const edgePath = edge.path.clone({ insert: false });
    if (eInfo.reversed) edgePath.reverse();
    boundary.addSegments(edgePath.segments);
    edgePath.remove();
  });
  boundary.closed = true;
  const pd = boundary.pathData;
  boundary.remove();
  return pd;
}

/** Render a ConnectorV5 using midEdgeId + midT + direction */
function renderConnectorPath(
  c: ConnectorV5,
  edges: Record<string, Edge>,
  widthPx: number,
  extrusion: number,
  headTemplateId: string,
  headScale: number,
  headRotationDeg: number,
  useEquidistantHeadPoint: boolean,
  jitter: number | undefined,
  jitterSeed: number | undefined,
  neckShape: NeckShape | undefined,
  neckCurvature: number | undefined,
  extrusionCurvature: number | undefined
): string | null {
  const edge = edges[c.midEdgeId];
  if (!edge) return null;
  const edgePath = edge.path.clone({ insert: false });
  // 'in' → protrude into leftFace → flip normal → reverse path
  if (c.direction === 'in') edgePath.reverse();
  const result = generateConnectorPath(
    edgePath,
    0, // pathIndex always 0 — we pass the individual edge path
    c.midT,
    widthPx,
    extrusion,
    headTemplateId,
    headScale,
    headRotationDeg,
    useEquidistantHeadPoint,
    [], // no legacy whimsies
    jitter,
    jitterSeed,
    neckShape,
    neckCurvature,
    extrusionCurvature
  );
  edgePath.remove();
  return result.pathData;
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
  onFloatingWhimsyMove,
  onMergeWhimsy,
  activeTab,
  selectedEdgeId,
  connectionT,
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
  connectorDirection,
  selectedConnectorId,
  onConnectorSelect,
  previewConnectors,
  rectSelectMode,
  rectStart,
  onRectPoint,
  showNodes = false,
  showFaceLabels = false,
}) => {
  const { connectors, floatingWhimsies, width, height, nodes, edges, faces } = puzzleState;
  const outerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(fitScale);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  // Dragging a floating whimsy
  const draggingWhimsyRef = useRef<{ id: string; startCenter: Point; startMouse: Point } | null>(null);

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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    }
    if (draggingWhimsyRef.current && onFloatingWhimsyMove) {
      const board = clientToBoard(e.clientX, e.clientY);
      const { id, startCenter, startMouse } = draggingWhimsyRef.current;
      onFloatingWhimsyMove(id, {
        x: startCenter.x + (board.x - startMouse.x),
        y: startCenter.y + (board.y - startMouse.y),
      });
    }
  }, [isPanning, clientToBoard, onFloatingWhimsyMove]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
    draggingWhimsyRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Sort faces by bounding-box area descending so nested (small) faces render on top
  const sortedFaces = (Object.values(faces) as Face[]).sort((a, b) => {
    const aPath = new paper.Path(buildFacePathData(a, edges));
    const bPath = new paper.Path(buildFacePathData(b, edges));
    const diff = bPath.area - aPath.area;
    aPath.remove(); bPath.remove();
    return diff;
  });

  // Build preview connector if we're in CONNECTION tab and an edge is selected
  const previewConnectorEl = (() => {
    if (activeTab !== 'CONNECTION' || !selectedEdgeId || selectedConnectorId) return null;
    const previewC: ConnectorV5 = {
      id: '__preview__',
      midEdgeId: selectedEdgeId,
      midT: connectionT,
      direction: connectorDirection,
      p1: { edgeId: selectedEdgeId, t: 0 },
      p2: { edgeId: selectedEdgeId, t: 1 },
      replacedSegment: [],
      widthPx: connectorWidthPx,
      extrusion: connectorExtrusion,
      headTemplateId: connectorHeadTemplate,
      headScale: connectorHeadScale,
      headRotationDeg: connectorHeadRotation,
      jitter: connectorJitter,
      jitterSeed: connectorJitterSeed,
      neckShape: connectorNeckShape,
      neckCurvature: connectorNeckCurvature,
      extrusionCurvature: connectorExtrusionCurvature,
      useEquidistantHeadPoint,
    };
    const pd = renderConnectorPath(
      previewC, edges,
      connectorWidthPx, connectorExtrusion, connectorHeadTemplate,
      connectorHeadScale, connectorHeadRotation, useEquidistantHeadPoint,
      connectorJitter, connectorJitterSeed, connectorNeckShape,
      connectorNeckCurvature, connectorExtrusionCurvature
    );
    if (!pd) return null;
    return <path key="__preview__" d={pd} fill="rgba(99,102,241,0.2)" stroke="#94a3b8" strokeWidth={1} className="pointer-events-none" />;
  })();

  return (
    <div
      ref={outerRef}
      className="flex-1 overflow-hidden relative bg-slate-100 select-none"
      onMouseDown={(e) => {
        if (e.button === 1 || e.target === e.currentTarget) {
          panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
          setIsPanning(true);
        }
      }}
      onWheel={(e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(z => Math.max(0.05, Math.min(z * factor, 20)));
      }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left bg-white shadow-2xl rounded-sm overflow-hidden"
        style={{ width, height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
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
              } else if (rectSelectMode) {
                onRectPoint(pt);
              } else {
                onClick(null);
              }
            }}
          />

          {/* Layer 1: Face fills (sorted by area desc so nested faces render last = on top) */}
          {sortedFaces.map((face: Face) => {
            if (face.id === 'outer') return null;
            const isSelected = selectedIds.includes(face.id);
            const isHovered = hoveredId === face.id;
            const pathData = buildFacePathData(face, edges);
            return (
              <path
                key={face.id}
                d={pathData}
                fill={isSelected ? 'rgba(99,102,241,0.4)' : face.color}
                stroke={isSelected ? '#4f46e5' : (isHovered ? '#818cf8' : 'none')}
                strokeWidth={isSelected ? 3 : isHovered ? 1 : 0}
                fillRule="evenodd"
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => onHover(face.id)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(face.id, clientToBoard(e.clientX, e.clientY));
                }}
              />
            );
          })}

          {/* Layer 2: Edge strokes */}
          {Object.values(edges).map((edge: Edge) => {
            const isSelected = selectedIds.includes(edge.id) || edge.id === selectedEdgeId;
            return (
              <g key={edge.id}>
                {/* Wide invisible hit area */}
                <path
                  d={edge.path.pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  strokeLinecap="round"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    const pt = clientToBoard(e.clientX, e.clientY);
                    if (activeTab === 'CONNECTION') {
                      // Compute t along edge
                      const ep = edge.path.clone({ insert: false });
                      const nearest = ep.getNearestLocation(new paper.Point(pt.x, pt.y));
                      const t = ep.length > 0 ? nearest.offset / ep.length : 0;
                      ep.remove();
                      onConnectionUpdate(edge.id, t);
                    } else {
                      onClick(edge.id, pt);
                    }
                  }}
                />
                <path
                  d={edge.path.pathData}
                  fill="none"
                  stroke={isSelected ? '#4f46e5' : '#1e293b'}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeLinecap="round"
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {/* Layer 3: Nodes (debug) */}
          {showNodes && Object.values(nodes).map((node: Node) => (
            <circle
              key={node.id}
              cx={node.point.x}
              cy={node.point.y}
              r={4}
              fill="#ef4444"
              className="pointer-events-none"
            />
          ))}

          {/* Layer 4: Floating whimsies (overlay, draggable) */}
          {floatingWhimsies.map((fw: FloatingWhimsy) => {
            const svgData = fw.svgData || getWhimsyTemplatePathData(fw.templateId as any) || '';
            const isSelected = selectedIds.includes(fw.id);
            return (
              <g
                key={fw.id}
                transform={`translate(${fw.center.x}, ${fw.center.y}) rotate(${fw.rotationDeg}) scale(${fw.scale / 56})`}
                className="cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  draggingWhimsyRef.current = {
                    id: fw.id,
                    startCenter: fw.center,
                    startMouse: clientToBoard(e.clientX, e.clientY),
                  };
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(fw.id);
                }}
              >
                <path
                  d={svgData}
                  fill={isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.7)'}
                  stroke={isSelected ? '#4f46e5' : '#64748b'}
                  strokeWidth={2}
                  strokeDasharray={isSelected ? undefined : '4 3'}
                />
              </g>
            );
          })}

          {/* Layer 5: Connectors */}
          {[...Object.values(connectors), ...Object.values(previewConnectors)].map((c: ConnectorV5) => {
            if (c.disabled) return null;
            const pd = renderConnectorPath(
              c, edges,
              c.widthPx, c.extrusion, c.headTemplateId, c.headScale, c.headRotationDeg,
              c.useEquidistantHeadPoint ?? true,
              c.jitter, c.jitterSeed, c.neckShape, c.neckCurvature, c.extrusionCurvature
            );
            if (!pd) return null;
            const isSelected = selectedConnectorId === c.id;
            const isPreview = !connectors[c.id];
            return (
              <path
                key={c.id}
                d={pd}
                fill={isPreview ? 'rgba(99,102,241,0.15)' : '#fff'}
                stroke={isSelected ? '#4f46e5' : (isPreview ? '#94a3b8' : '#1e293b')}
                strokeWidth={isSelected ? 2.5 : 1}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectorSelect(c.id);
                }}
              />
            );
          })}

          {/* Connection preview connector */}
          {previewConnectorEl}

          {/* Face labels (debug) */}
          {showFaceLabels && Object.values(faces).map((face: Face) => {
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
            if (count === 0) return null;
            return (
              <text key={face.id} x={cx / count} y={cy / count} fontSize="10" fill="#6366f1" textAnchor="middle" className="pointer-events-none">
                {face.id.slice(0, 8)}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button onClick={() => setZoom(z => Math.min(z * 1.2, 20))} className="p-3 bg-white shadow-lg rounded-xl hover:bg-slate-50 transition-colors text-slate-600">
          <Plus className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.05))} className="p-3 bg-white shadow-lg rounded-xl hover:bg-slate-50 transition-colors text-slate-600">
          <Minus className="w-5 h-5" />
        </button>
        <button onClick={fitToScreen} className="p-3 bg-white shadow-lg rounded-xl hover:bg-slate-50 transition-colors text-slate-600">
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
