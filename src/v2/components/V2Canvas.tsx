import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import paper from 'paper';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { Tab } from '../constants';
import { Area, Connector, Point } from '../types';
import { getSharedPerimeter, getPointAtU } from '../geometry';
import { resetPaperProject } from '../paperProject';
import type { ConnectorOverlay } from '../boolean_connector_geometry';

function sanitizeSvgId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface V2CanvasProps {
  width: number;
  height: number;
  fitScale: number;
  isMobile: boolean;
  activeTab: Tab;
  displayPieces: { id: string; pathData: string; color: string }[];
  /** BOOLEAN preview: tab fills above pieces when clip overlap is off (tab is baked into paths when on). */
  connectorOverlays?: ConnectorOverlay[];
  selectedId: string | null;
  mergePickIds: string[];
  sharedEdges: { id: string; areaAId: string; areaBId: string; pathData: string; isMerged: boolean }[];
  resolvedConnectors: Connector[];
  topology: Record<string, Area>;
  setHoveredId: (id: string | null) => void;
  setHoveredType: (type: 'AREA' | 'CONNECTOR' | 'EDGE' | 'NONE') => void;
  handleAreaClick: (id: string, e: React.MouseEvent) => void;
  addConnector: (areaAId: string, areaBId: string, u: number) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedType: (type: 'AREA' | 'CONNECTOR' | 'NONE') => void;
  longPressProps: any;
  onBackgroundClick?: () => void;
  /** Semi-transparent preview + click-to-place (Topology). */
  whimsyPlacementActive?: boolean;
  whimsyPreviewPathData?: string | null;
  onWhimsyBoardPointerMove?: (p: Point) => void;
  onWhimsyCommit?: (p: Point) => void;
}

export const V2Canvas: React.FC<V2CanvasProps> = ({
  width,
  height,
  fitScale,
  isMobile,
  activeTab,
  displayPieces,
  connectorOverlays = [],
  selectedId,
  mergePickIds,
  sharedEdges,
  resolvedConnectors,
  topology,
  setHoveredId,
  setHoveredType,
  handleAreaClick,
  addConnector,
  setSelectedId,
  setSelectedType,
  longPressProps,
  onBackgroundClick,
  whimsyPlacementActive = false,
  whimsyPreviewPathData = null,
  onWhimsyBoardPointerMove,
  onWhimsyCommit,
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  // ── View state ────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(fitScale);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Stable ref so non-React event listeners always read current values
  const viewRef = useRef({ zoom, pan });
  useEffect(() => { viewRef.current = { zoom, pan }; }, [zoom, pan]);

  // ── Pan clamping ──────────────────────────────────────────────────────────
  // At least MARGIN px of the puzzle must stay inside the viewport.
  const MARGIN = 120;
  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    const el = outerRef.current;
    if (!el) return p;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    return {
      x: Math.min(cw - MARGIN, Math.max(MARGIN - width * z, p.x)),
      y: Math.min(ch - MARGIN, Math.max(MARGIN - height * z, p.y)),
    };
  }, [width, height]);

  // ── Fit to screen ─────────────────────────────────────────────────────────
  const fitToScreen = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setZoom(fitScale);
    setPan({
      x: (rect.width  - width  * fitScale) / 2,
      y: (rect.height - height * fitScale) / 2,
    });
  }, [fitScale, width, height]);

  // Center on first mount only
  useEffect(() => { fitToScreen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const MIN_ZOOM = fitScale * 0.1;
  const MAX_ZOOM = fitScale * 10;

  // Change zoom keeping viewport centre fixed
  const applyZoom = useCallback((newZoom: number) => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width  / 2;
    const cy = rect.height / 2;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    const ratio = clamped / viewRef.current.zoom;
    const newPan = { x: cx - (cx - viewRef.current.pan.x) * ratio, y: cy - (cy - viewRef.current.pan.y) * ratio };
    setPan(clampPan(newPan, clamped));
    setZoom(clamped);
  }, [MAX_ZOOM, MIN_ZOOM, clampPan]);

  // ── Scroll = pan (non-passive so we can preventDefault) ───────────────────
  useEffect(() => {
    if (isMobile) return; // leave mobile scroll alone
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { pan: p, zoom: z } = viewRef.current;
      const proposed = { x: p.x - e.deltaX, y: p.y - e.deltaY };
      // clampPan reads outerRef directly so it's safe to call here
      const rect = el.getBoundingClientRect();
      const cw = rect.width, ch = rect.height;
      setPan({
        x: Math.min(cw - MARGIN, Math.max(MARGIN - width * z, proposed.x)),
        y: Math.min(ch - MARGIN, Math.max(MARGIN - height * z, proposed.y)),
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isMobile, width, height]);

  // ── Drag-to-pan ───────────────────────────────────────────────────────────
  const dragRef = useRef({
    active: false,
    startX: 0, startY: 0,
    startPanX: 0, startPanY: 0,
    moved: false,
  });
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (whimsyPlacementActive) return;
    // Left-button drag anywhere in the canvas, or middle-button on anything
    if (e.button !== 0 && e.button !== 1) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: viewRef.current.pan.x,
      startPanY: viewRef.current.pan.y,
      moved: false,
    };
  };

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) > 4) {
        d.moved = true;
        setIsDragging(true);
      }
      if (d.moved) {
        setPan(clampPan(
          { x: d.startPanX + dx, y: d.startPanY + dy },
          viewRef.current.zoom
        ));
      }
    };
    const onUp = () => {
      dragRef.current.active = false;
      setIsDragging(false);
      // Note: deselection on background click is handled by onOuterClick below
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isMobile]);

  // Background click = deselect (only when not finishing a drag)
  const onOuterClick = (e: React.MouseEvent) => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    // Pieces stop propagation, so if we're here it's a genuine background click
    setSelectedId(null);
    setSelectedType('NONE');
    onBackgroundClick?.();
  };

  const pctLabel = Math.round((zoom / fitScale) * 100);

  // One Paper pass per connector data change — avoids getSharedPerimeter N× per React render
  // (e.g. dragging the u slider was rebuilding paths every frame).
  const connectorAnchors = useMemo(() => {
    if (activeTab !== 'CONNECTION' && activeTab !== 'RESOLUTION') return [];
    resetPaperProject(width, height);
    const out: { id: string; x: number; y: number; isDeleted: boolean }[] = [];
    for (const c of resolvedConnectors) {
      const areaA = topology[c.areaAId];
      const areaB = topology[c.areaBId];
      if (!areaA || !areaB) continue;
      const shared = getSharedPerimeter(areaA, areaB);
      if (!shared) continue;
      const pos = getPointAtU(shared, c.u);
      shared.remove();
      if (!pos) continue;
      out.push({ id: c.id, x: pos.point.x, y: pos.point.y, isDeleted: !!c.isDeleted });
    }
    return out;
  }, [activeTab, resolvedConnectors, topology, width, height]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={outerRef}
      className="flex-1 overflow-hidden relative bg-slate-100 select-none"
      style={{ cursor: isMobile ? undefined : isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onClick={onOuterClick}
      {...longPressProps}
    >
      {/* Puzzle board */}
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
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
              <feFlood floodColor="#4338ca" floodOpacity="0.55" result="glowColor" />
              <feComposite in="glowColor" in2="blur" operator="in" result="softGlow" />
              <feMerge>
                <feMergeNode in="softGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {connectorOverlays.map(o =>
              o.clipPathData ? (
                <clipPath key={`co-clip-def-${o.connectorId}`} id={`co-clip-${sanitizeSvgId(o.connectorId)}`}>
                  <path d={o.clipPathData} fillRule="evenodd" />
                </clipPath>
              ) : null
            )}
          </defs>
          {/* Pieces */}
          <g>
            {displayPieces.map(piece => {
              if (activeTab === 'PRODUCTION') {
                return (
                  <path
                    key={piece.id}
                    d={piece.pathData}
                    fill="none"
                    stroke={piece.color}
                    strokeWidth={1}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fillRule="evenodd"
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                    onMouseEnter={() => setHoveredId(piece.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={(e) => { e.stopPropagation(); handleAreaClick(piece.id, e); }}
                  />
                );
              }
              if (activeTab === 'MODIFICATION') {
                return (
                  <path
                    key={piece.id}
                    d={piece.pathData}
                    fill={piece.color}
                    fillRule="evenodd"
                    stroke="none"
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                    onMouseEnter={() => setHoveredId(piece.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={(e) => { e.stopPropagation(); handleAreaClick(piece.id, e); }}
                  />
                );
              }

              const isTopo = activeTab === 'TOPOLOGY';
              const picked = isTopo && mergePickIds.includes(piece.id);
              const focused = isTopo && selectedId === piece.id;

              let stroke = '#000';
              let strokeWidth = 1;
              let filter: string | undefined;
              let highlight: React.ReactNode = null;

              if (isTopo) {
                if (picked) {
                  stroke = '#1e1b4b';
                  strokeWidth = focused ? 6 : 5;
                  filter = 'url(#piece-selection-glow)';
                  highlight = (
                    <path
                      d={piece.pathData}
                      fill="rgba(79, 70, 229, 0.42)"
                      fillRule="evenodd"
                      className="pointer-events-none"
                      style={{ mixBlendMode: 'multiply' }}
                      aria-hidden
                    />
                  );
                } else if (focused) {
                  stroke = '#4f46e5';
                  strokeWidth = 4;
                }
              } else {
                stroke = selectedId === piece.id ? '#6366f1' : '#000';
                strokeWidth = selectedId === piece.id ? 3 : 1;
              }

              return (
                <g key={piece.id}>
                  <path
                    d={piece.pathData}
                    fill={piece.color}
                    fillRule="evenodd"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter={filter}
                    className="transition-all duration-200 hover:opacity-90 cursor-pointer"
                    onMouseEnter={() => setHoveredId(piece.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={(e) => { e.stopPropagation(); handleAreaClick(piece.id, e); }}
                  />
                  {highlight}
                </g>
              );
            })}
          </g>

          {/* Connector tab fills (Boolean / topological preview) — above piece paths */}
          {connectorOverlays.length > 0 && (
            <g className="pointer-events-none" aria-hidden>
              {connectorOverlays.map(o => (
                <path
                  key={o.connectorId}
                  d={o.stampPathData}
                  fill={o.fillColor}
                  fillOpacity={0.92}
                  fillRule="evenodd"
                  style={{
                    clipPath: o.clipPathData ? `url(#co-clip-${sanitizeSvgId(o.connectorId)})` : undefined,
                  }}
                />
              ))}
            </g>
          )}

          {/* Shared Edges */}
          {(activeTab === 'TOPOLOGY' || activeTab === 'MODIFICATION' || activeTab === 'CONNECTION') && (
            <g>
              {sharedEdges.map(edge => (
                <path
                  key={edge.id}
                  d={edge.pathData}
                  fill="none"
                  stroke={edge.isMerged ? 'none' : selectedId === edge.id ? '#6366f1' : '#000'}
                  strokeWidth={selectedId === edge.id ? '3' : '1'}
                  strokeLinecap="round"
                  style={{
                    opacity: edge.isMerged ? 0 : activeTab === 'CONNECTION' ? 0.8 : 0.2,
                    pointerEvents: activeTab === 'CONNECTION' ? 'all' : 'none',
                    cursor: activeTab === 'CONNECTION' ? 'crosshair' : undefined,
                  }}
                  onMouseEnter={() => { if (activeTab === 'CONNECTION') { setHoveredId(edge.id); setHoveredType('EDGE'); } }}
                  onMouseLeave={() => { if (activeTab === 'CONNECTION') { setHoveredId(null); setHoveredType('NONE'); } }}
                  onClick={(e) => {
                    if (activeTab !== 'CONNECTION') return;
                    e.stopPropagation();
                    const svg = e.currentTarget.ownerSVGElement;
                    if (!svg) return;
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const localPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                    resetPaperProject(width, height);
                    const path = new paper.Path(edge.pathData);
                    const nearest = path.getNearestLocation(new paper.Point(localPt.x, localPt.y));
                    const u = nearest.offset / path.length;
                    path.remove();
                    addConnector(edge.areaAId, edge.areaBId, u);
                  }}
                />
              ))}
            </g>
          )}

          {/* Connector Previews */}
          {(activeTab === 'CONNECTION' || activeTab === 'RESOLUTION') && (
            <g>
              {connectorAnchors.map(a => (
                <g
                  key={a.id}
                  opacity={a.isDeleted ? 0.3 : 1}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(a.id); setSelectedType('CONNECTOR'); }}
                >
                  <circle
                    cx={a.x}
                    cy={a.y}
                    r={selectedId === a.id ? 8 : 6}
                    fill={a.isDeleted ? '#ef4444' : '#6366f1'}
                    stroke="white"
                    strokeWidth="2"
                  />
                </g>
              ))}
            </g>
          )}

          {whimsyPlacementActive && whimsyPreviewPathData && (
            <g className="pointer-events-none" aria-hidden>
              <path
                d={whimsyPreviewPathData}
                fill="rgba(168, 85, 247, 0.2)"
                stroke="rgba(109, 40, 217, 0.95)"
                strokeWidth={2}
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
              aria-label="Click to place whimsy"
              onMouseMove={e => {
                onWhimsyBoardPointerMove?.(clientToBoard(e.clientX, e.clientY));
              }}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onWhimsyCommit?.(clientToBoard(e.clientX, e.clientY));
              }}
            />
          )}
        </svg>
      </div>

      {/* ── Zoom controls (desktop only) ─────────────────────────────── */}
      {!isMobile && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white rounded-xl shadow-md px-3 py-2 z-10">
          <button
            onClick={() => applyZoom(zoom / 1.25)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            title="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={(MAX_ZOOM - MIN_ZOOM) / 200}
            value={zoom}
            onChange={e => applyZoom(Number(e.target.value))}
            className="w-24 h-1 accent-indigo-500 cursor-pointer"
            title="Zoom"
          />

          <button
            onClick={() => applyZoom(zoom * 1.25)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            title="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] font-bold text-slate-400 w-9 text-right tabular-nums">
            {pctLabel}%
          </span>

          <div className="w-px h-4 bg-slate-100" />

          <button
            onClick={fitToScreen}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Fit to screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
