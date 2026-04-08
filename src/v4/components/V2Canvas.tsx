import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Tab } from '../constants';
import { Area, Point, Connector } from '../types';

interface V2CanvasProps {
  width: number;
  height: number;
  fitScale: number;
  isMobile: boolean;
  activeTab: Tab;
  displayPieces: { id: string; pathData: string; color: string; label?: string }[];
  selectedId: string | null;
  mergePickIds: string[];
  sharedEdges: any[];
  resolvedConnectors: Connector[];
  setHoveredId: (id: string | null) => void;
  setHoveredType: (type: 'AREA' | 'CONNECTOR' | 'EDGE' | 'NONE') => void;
  handleAreaClick: (id: string, e: React.MouseEvent) => void;
  addConnector: (areaAId: string, areaBId: string, u: number) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedType: (type: 'AREA' | 'CONNECTOR' | 'NONE') => void;
  longPressProps: any;
  onBackgroundClick?: () => void;
  whimsyPlacementActive?: boolean;
  whimsyPreviewPathData?: string | null;
  onWhimsyBoardPointerMove?: (p: Point) => void;
  onWhimsyCommit?: (p: Point) => void;
}

function sanitizeSvgId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export const V2Canvas: React.FC<V2CanvasProps> = ({
  width,
  height,
  fitScale,
  isMobile,
  activeTab,
  displayPieces,
  selectedId,
  mergePickIds,
  setHoveredId,
  setHoveredType,
  handleAreaClick,
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

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (whimsyPlacementActive && onWhimsyBoardPointerMove) {
        const p = clientToBoard(e.clientX, e.clientY);
        onWhimsyBoardPointerMove(p);
      }
    },
    [whimsyPlacementActive, onWhimsyBoardPointerMove, clientToBoard]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (whimsyPlacementActive && onWhimsyCommit && e.target === svgRef.current) {
        const p = clientToBoard(e.clientX, e.clientY);
        onWhimsyCommit(p);
        return;
      }

      if ((e.target as SVGElement).getAttribute('data-piece-id')) {
        const pieceId = (e.target as SVGElement).getAttribute('data-piece-id');
        if (pieceId) {
          handleAreaClick(pieceId, e);
        }
      } else if (e.target === svgRef.current && onBackgroundClick) {
        onBackgroundClick();
      }
    },
    [whimsyPlacementActive, onWhimsyCommit, clientToBoard, handleAreaClick, onBackgroundClick]
  );

  return (
    <div
      ref={outerRef}
      className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden"
      {...longPressProps}
    >
      <svg
        ref={svgRef}
        width={width * fitScale}
        height={height * fitScale}
        viewBox={`0 0 ${width} ${height}`}
        className="cursor-crosshair"
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        {/* Background */}
        <rect width={width} height={height} fill="white" />

        {/* Pieces */}
        {displayPieces.map((piece) => {
          if (!piece || !piece.id || !piece.pathData) {
            console.warn('Invalid piece in displayPieces:', piece);
            return null;
          }
          
          const isSelected = selectedId === piece.id || mergePickIds.includes(piece.id);
          
          return (
            <path
              key={piece.id}
              id={sanitizeSvgId(piece.id)}
              d={piece.pathData}
              fill={piece.color}
              stroke={isSelected ? '#000000' : '#e5e7eb'}
              strokeWidth={isSelected ? 2 : 0.5}
              opacity={whimsyPlacementActive ? 0.7 : 1}
              data-piece-id={piece.id}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Whimsy Preview */}
        {whimsyPlacementActive && whimsyPreviewPathData && (
          <g opacity={0.5}>
            <path
              d={whimsyPreviewPathData}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
