import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePuzzleEngineV3 } from './hooks/usePuzzleEngineV3';
import { V3Header } from './components/V3Header';
import { V3Navigation } from './components/V3Navigation';
import { V3ActionBar } from './components/V3ActionBar';
import { V3Canvas } from './components/V3Canvas';
import { V3CreateModal } from './components/V3CreateModal';
import { Tab } from '../v2/constants';
import { Point, AreaType } from './types';
import { getPathCount, getClosestLocationOnBoundary } from './utils/paperUtils';

export default function V3App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('TOPOLOGY');
  const [showCreateModal, setShowCreateModal] = useState(true);
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight - 168 });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Subdivision Parameters
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(4);
  const [hexRows, setHexRows] = useState(4);
  const [hexCols, setHexCols] = useState(4);
  const [randomPoints, setRandomPoints] = useState(12);
  const [jitter, setJitter] = useState(0);
  const [splitPattern, setSplitPattern] = useState<'GRID' | 'HEX' | 'RANDOM'>('GRID');

  // Whimsy Parameters
  const [whimsyTemplate, setWhimsyTemplate] = useState<'circle' | 'star'>('circle');
  const [whimsyScale, setWhimsyScale] = useState(56);
  const [whimsyRotationDeg, setWhimsyRotationDeg] = useState(0);
  const [whimsyPlacementActive, setWhimsyPlacementActive] = useState(false);

  // Connection Parameters
  const [connectionT, setConnectionT] = useState(0.5);
  const [connectionPathIndex, setConnectionPathIndex] = useState(0);

  const { 
    puzzleState, 
    createRoot, 
    subdivideGrid, 
    mergePieces, 
    addWhimsy,
    validateGrid,
    cleanPuzzle,
    reset 
  } = usePuzzleEngineV3();

  const { areas, width, height } = puzzleState;

  const maxPathIndex = useMemo(() => {
    if (selectedIds.length !== 1) return 0;
    const piece = areas[selectedIds[0]];
    if (!piece) return 0;
    return Math.max(0, getPathCount(piece.boundary) - 1);
  }, [selectedIds, areas]);

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
  }, []);

  const handleCreate = useCallback((w: number, h: number) => {
    console.log('Initializing V3 Engine with:', w, h);
    try {
      createRoot(w, h);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to initialize V3 Engine:', err);
    }
  }, [createRoot]);

  const handleSubdivide = useCallback(() => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      subdivideGrid({
        parentId: id,
        pattern: splitPattern,
        rows: splitPattern === 'GRID' ? gridRows : hexRows,
        cols: splitPattern === 'GRID' ? gridCols : hexCols,
        count: randomPoints,
        jitter: jitter
      });
    });
    setSelectedIds([]);
  }, [selectedIds, splitPattern, gridRows, gridCols, hexRows, hexCols, randomPoints, jitter, subdivideGrid]);

  const handleMerge = useCallback(() => {
    if (selectedIds.length < 2) return;
    mergePieces(selectedIds);
    setSelectedIds([]);
  }, [selectedIds, mergePieces]);

  const handleWhimsyCommit = useCallback((p: Point) => {
    addWhimsy({
      templateId: whimsyTemplate,
      center: p,
      scale: whimsyScale,
      rotationDeg: whimsyRotationDeg
    });
    setWhimsyPlacementActive(false);
  }, [whimsyTemplate, whimsyScale, whimsyRotationDeg, addWhimsy]);

  const handlePieceClick = useCallback((id: string | null, pt?: Point) => {
    if (activeTab === 'CONNECTION') {
      setSelectedIds(id ? [id] : []);
      if (id && pt) {
        const piece = areas[id];
        if (piece && piece.type === AreaType.PIECE) {
          const { t, pathIndex } = getClosestLocationOnBoundary(piece.boundary, new paper.Point(pt.x, pt.y));
          setConnectionT(t);
          setConnectionPathIndex(pathIndex);
        }
      } else {
        setConnectionPathIndex(0);
      }
    } else {
      if (!id) {
        setSelectedIds([]);
        return;
      }
      setSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        return [...prev, id];
      });
    }
  }, [activeTab, areas]);

  const handleConnectionUpdate = useCallback((t: number, pathIndex: number) => {
    setConnectionT(t);
    setConnectionPathIndex(pathIndex);
  }, []);

  const fitScale = Math.max(0.1, Math.min(containerSize.w / (width || 800), containerSize.h / (height || 600)) * 0.9);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans selection:bg-indigo-100">
      {showCreateModal && (
        <V3CreateModal onCreate={handleCreate} />
      )}

      <V3Header onReset={() => { reset(); setShowCreateModal(true); }} />

      <V3Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <V3ActionBar 
        activeTab={activeTab}
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
        jitter={jitter}
        setJitter={setJitter}
        onSubdivide={handleSubdivide}
        onValidateGrid={validateGrid}
        onCleanPuzzle={cleanPuzzle}
        selectedIds={selectedIds}
        onMerge={handleMerge}
        whimsyTemplate={whimsyTemplate}
        setWhimsyTemplate={setWhimsyTemplate}
        whimsyScale={whimsyScale}
        setWhimsyScale={setWhimsyScale}
        whimsyRotationDeg={whimsyRotationDeg}
        setWhimsyRotationDeg={setWhimsyRotationDeg}
        whimsyPlacementActive={whimsyPlacementActive}
        startWhimsyPlacement={() => setWhimsyPlacementActive(true)}
        cancelWhimsyPlacement={() => setWhimsyPlacementActive(false)}
        connectionT={connectionT}
        setConnectionT={setConnectionT}
        connectionPathIndex={connectionPathIndex}
        setConnectionPathIndex={setConnectionPathIndex}
        maxPathIndex={maxPathIndex}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col" ref={containerRef}>
        <V3Canvas 
          puzzleState={puzzleState}
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onClick={handlePieceClick}
          fitScale={fitScale}
          whimsyPlacementActive={whimsyPlacementActive}
          whimsyTemplate={whimsyTemplate}
          whimsyScale={whimsyScale}
          whimsyRotationDeg={whimsyRotationDeg}
          onWhimsyCommit={handleWhimsyCommit}
          activeTab={activeTab}
          connectionT={connectionT}
          connectionPathIndex={connectionPathIndex}
          onConnectionUpdate={handleConnectionUpdate}
        />
      </main>
    </div>
  );
}
