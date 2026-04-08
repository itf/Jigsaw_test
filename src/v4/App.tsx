import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';

import { Point, CreateRootShape } from './types';
import { usePuzzleEngine } from './hooks/usePuzzleEngine';
import { pathItemToPathData } from './paperUtils';
import { V2Header, V2Navigation, V2ActionBar, V2Canvas, V2CreateModal } from './components';
import { Tab } from './constants';

/**
 * V4App is a simplified version focused on the topology tab.
 * It reuses the v2 UI components but uses the new v4 topology engine.
 */
export default function V4App() {
  // --- State ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('TOPOLOGY');
  const [showCreateModal, setShowCreateModal] = useState(true);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [initialShape, setInitialShape] = useState<CreateRootShape>({ variant: 'rect' });
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight - 168 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'AREA' | 'CONNECTOR' | 'NONE'>('NONE');

  // Subdivision Parameters
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(4);
  const [hexRows, setHexRows] = useState(4);
  const [hexCols, setHexCols] = useState(4);
  const [randomPoints, setRandomPoints] = useState(12);
  const [splitPattern, setSplitPattern] = useState<'GRID' | 'HEX' | 'RANDOM'>('GRID');
  const [mergePickIds, setMergePickIds] = useState<string[]>([]);

  // Whimsy Parameters
  const [whimsyTemplate, setWhimsyTemplate] = useState<'circle' | 'star'>('circle');
  const [whimsyScale, setWhimsyScale] = useState(56);
  const [whimsyRotationDeg, setWhimsyRotationDeg] = useState(0);
  const [whimsyPlacementActive, setWhimsyPlacementActive] = useState(false);
  const [whimsyPreviewCenter, setWhimsyPreviewCenter] = useState<Point>({ x: 400, y: 300 });

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // --- Puzzle Engine Hook ---
  const engine = usePuzzleEngine();

  // --- Effects ---
  useEffect(() => {
    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [activeTab]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        setContainerSize({ w: newW, h: newH });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [engine.state?.areas]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!whimsyPlacementActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWhimsyPlacementActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [whimsyPlacementActive]);

  useEffect(() => {
    if (whimsyPlacementActive) {
      setWhimsyPreviewCenter({ x: width / 2, y: height / 2 });
    }
  }, [whimsyPlacementActive, width, height]);

  // --- Engine Initialization ---
  // Memoize displayPieces by using a stable reference to the state itself, not just areas
  const displayPieces = useMemo(() => {
    if (!engine.state) return [];
    try {
      return engine.getDisplayPiecesData();
    } catch (error) {
      console.error('Error getting display pieces:', error);
      return [];
    }
  }, [engine.state]);

  // --- Event Handlers ---
  const handleAreaClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Clicking piece ${id.slice(-8)}, current mergePickIds:`, mergePickIds.map(x => x.slice(-8)));
    
    const isCurrentlySelected = mergePickIds.includes(id);
    let newMergeIds: string[];
    let newSelectedId: string | null;
    let newSelectedType: 'AREA' | 'NONE';
    
    if (isCurrentlySelected) {
      // Deselect this item
      newMergeIds = mergePickIds.filter(x => x !== id);
      newSelectedId = newMergeIds[0] ?? null;
      newSelectedType = newMergeIds.length === 0 ? 'NONE' : 'AREA';
    } else {
      // Select this item
      newMergeIds = [...mergePickIds, id];
      newSelectedId = id;
      newSelectedType = 'AREA';
    }
    
    console.log(`After click, newMergeIds:`, newMergeIds.map(x => x.slice(-8)));
    
    // Update all state at once
    setMergePickIds(newMergeIds);
    setSelectedId(newSelectedId);
    setSelectedType(newSelectedType);
  };

  const subdivideSelectedPieces = useCallback(() => {
    if (mergePickIds.length === 0) return;
    
    mergePickIds.forEach((pieceId) => {
      if (splitPattern === 'GRID') {
        engine.subdivideGrid({ parentAreaId: pieceId, rows: gridRows, cols: gridCols });
      } else if (splitPattern === 'HEX') {
        engine.subdivideHexGrid({ parentAreaId: pieceId, rows: hexRows, cols: hexCols });
      } else if (splitPattern === 'RANDOM') {
        engine.subdivideRandom({ parentAreaId: pieceId, pointCount: randomPoints });
      }
    });

    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [mergePickIds, splitPattern, gridRows, gridCols, hexRows, hexCols, randomPoints, engine]);

  const mergeSelectedPieces = useCallback(() => {
    if (mergePickIds.length < 2) return;
    
    let acc = mergePickIds[0];
    for (let i = 1; i < mergePickIds.length; i++) {
      engine.merge({ pieceAId: acc, pieceBId: mergePickIds[i] });
    }

    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [mergePickIds, engine]);

  const commitWhimsyAt = useCallback(
    (center: Point) => {
      engine.addWhimsyPiece({
        templateId: whimsyTemplate,
        center,
        scale: whimsyScale,
        rotationDeg: whimsyRotationDeg,
      });
      setWhimsyPlacementActive(false);
      setMergePickIds([]);
      setSelectedId(null);
      setSelectedType('NONE');
    },
    [whimsyTemplate, whimsyScale, whimsyRotationDeg, engine]
  );

  const scale = Math.min(containerSize.w / width, containerSize.h / height) * 0.9;

  const canSubdivideTopology = useMemo(() => {
    if (mergePickIds.length === 0 || !engine.state) return false;
    return mergePickIds.every(id => {
      const area = engine.state!.areas[id];
      return area && area.type === 'piece';
    });
  }, [mergePickIds, engine.state?.areas]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans selection:bg-indigo-100">
      {showCreateModal && (
        <V2CreateModal
          onCreate={(w, h, shape) => {
            setWidth(w);
            setHeight(h);
            setInitialShape(shape);
            setShowCreateModal(false);
            engine.initializePuzzle(w, h, shape);
          }}
        />
      )}

      <V2Header undo={engine.undo} canUndo={engine.canUndo} />

      <V2Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <V2ActionBar
        activeTab={activeTab}
        splittingHint={
          mergePickIds.length === 0 ? null : 
          mergePickIds.length === 1 ? mergePickIds[0].slice(-8) :
          `${mergePickIds.length} pieces`
        }
        canSubdivide={canSubdivideTopology}
        splitPattern={splitPattern}
        setSplitPattern={setSplitPattern}
        gridRows={gridRows}
        setGridRows={setGridRows}
        gridCols={gridCols}
        setGridCols={setGridCols}
        hexRows={hexRows}
        setHexRows={setHexRows}
        hexCols={hexCols}
        setHexCols={setHexCols}
        randomPoints={randomPoints}
        setRandomPoints={setRandomPoints}
        subdivideSelectedPieces={subdivideSelectedPieces}
        selectedId={selectedId}
        selectedType={selectedType}
        mergePickIds={mergePickIds}
        mergeSelectedPieces={mergeSelectedPieces}
        onClearSelection={() => {
          setSelectedId(null);
          setSelectedType('NONE');
          setMergePickIds([]);
        }}
        whimsyTemplate={whimsyTemplate}
        setWhimsyTemplate={setWhimsyTemplate}
        whimsyScale={whimsyScale}
        setWhimsyScale={setWhimsyScale}
        whimsyRotationDeg={whimsyRotationDeg}
        setWhimsyRotationDeg={setWhimsyRotationDeg}
        whimsyPlacementActive={whimsyPlacementActive}
        startWhimsyPlacement={() => setWhimsyPlacementActive(true)}
        cancelWhimsyPlacement={() => setWhimsyPlacementActive(false)}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col" ref={containerRef}>
        <V2Canvas
          width={width}
          height={height}
          fitScale={scale}
          isMobile={isMobile}
          activeTab={activeTab}
          displayPieces={displayPieces}
          selectedId={selectedId}
          mergePickIds={mergePickIds}
          sharedEdges={[]}
          resolvedConnectors={[]}
          setHoveredId={setHoveredId}
          setHoveredType={() => {}}
          handleAreaClick={handleAreaClick}
          addConnector={() => {}}
          setSelectedId={setSelectedId}
          setSelectedType={setSelectedType}
          longPressProps={{}}
          whimsyPlacementActive={whimsyPlacementActive && activeTab === 'TOPOLOGY'}
          whimsyPreviewPathData={null}
          onWhimsyBoardPointerMove={setWhimsyPreviewCenter}
          onWhimsyCommit={commitWhimsyAt}
          onBackgroundClick={() => {
            if (activeTab === 'TOPOLOGY') {
              setMergePickIds([]);
              setSelectedId(null);
              setSelectedType('NONE');
            }
          }}
        />
      </main>
    </div>
  );
}
