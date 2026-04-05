import React from 'react';
import paper from 'paper';
import { Tab } from '../constants';
import { Area, Connector } from '../types';
import { getSharedPerimeter, getPointAtU } from '../geometry';

interface V2CanvasProps {
  width: number;
  height: number;
  scale: number;
  isMobile: boolean;
  activeTab: Tab;
  displayPieces: { id: string; pathData: string; color: string }[];
  selectedId: string | null;
  mergeSelection: string | null;
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
}

export const V2Canvas: React.FC<V2CanvasProps> = ({
  width,
  height,
  scale,
  isMobile,
  activeTab,
  displayPieces,
  selectedId,
  mergeSelection,
  sharedEdges,
  resolvedConnectors,
  topology,
  setHoveredId,
  setHoveredType,
  handleAreaClick,
  addConnector,
  setSelectedId,
  setSelectedType,
  longPressProps
}) => {
  return (
    <div 
      className={`min-h-[85vh] ${isMobile ? 'bg-white' : 'bg-slate-100'} relative flex items-center justify-center p-8 sm:p-12`} 
      {...longPressProps}
      onClick={() => {
        setSelectedId(null);
        setSelectedType('NONE');
      }}
    >
      <div 
        className={`${isMobile ? '' : 'bg-white shadow-2xl rounded-sm'} overflow-hidden relative origin-center shrink-0`}
        style={{ 
          width, 
          height,
          transform: `scale(${scale})`
        }}
      >
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
        >
          <g>
            {displayPieces.map(piece => (
              <path
                key={piece.id}
                d={piece.pathData}
                fill={piece.color}
                fillRule="evenodd"
                stroke={activeTab === 'PRODUCTION' ? "none" : (activeTab === 'MODIFICATION' ? "none" : (selectedId === piece.id ? "#6366f1" : mergeSelection === piece.id ? "#f59e0b" : "#000"))}
                strokeWidth={activeTab === 'PRODUCTION' ? "0" : (selectedId === piece.id || mergeSelection === piece.id ? "3" : "1")}
                strokeDasharray={mergeSelection === piece.id ? "4 2" : "none"}
                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                onMouseEnter={() => setHoveredId(piece.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => handleAreaClick(piece.id, e)}
              />
            ))}
          </g>

          {/* Shared Edges (Topological View) */}
          {(activeTab === 'TOPOLOGY' || activeTab === 'MODIFICATION' || activeTab === 'CONNECTION') && (
            <g>
              {sharedEdges.map(edge => (
                <path
                  key={edge.id}
                  d={edge.pathData}
                  fill="none"
                  stroke={edge.isMerged ? "none" : (selectedId === edge.id ? "#6366f1" : "#000")}
                  strokeWidth={selectedId === edge.id ? "3" : "1"}
                  strokeLinecap="round"
                  className={activeTab === 'CONNECTION' ? "cursor-crosshair" : "pointer-events-none"}
                  style={{ 
                    opacity: edge.isMerged ? 0 : (activeTab === 'CONNECTION' ? 0.8 : 0.2),
                    pointerEvents: activeTab === 'CONNECTION' ? 'all' : 'none'
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
                    
                    paper.setup(new paper.Size(width, height));
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
              {resolvedConnectors.map(c => {
                const areaA = topology[c.areaAId];
                const areaB = topology[c.areaBId];
                const shared = getSharedPerimeter(areaA, areaB);
                if (!shared) return null;
                const pos = getPointAtU(shared, c.u);
                shared.remove();
                if (!pos) return null;

                return (
                  <g 
                    key={c.id} 
                    opacity={c.isDeleted ? 0.3 : 1}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(c.id);
                      setSelectedType('CONNECTOR');
                    }}
                  >
                    <circle 
                      cx={pos.point.x} 
                      cy={pos.point.y} 
                      r={selectedId === c.id ? 8 : 6} 
                      fill={c.isDeleted ? "#ef4444" : "#6366f1"} 
                      stroke="white"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
