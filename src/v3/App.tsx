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
import paper from 'paper';

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
  const [connectorWidthPx, setConnectorWidthPx] = useState(24);
  const [connectorExtrusion, setConnectorExtrusion] = useState(20);
  const [connectorHeadTemplate, setConnectorHeadTemplate] = useState('circle');
  const [connectorHeadScale, setConnectorHeadScale] = useState(1.0);
  const [connectorHeadRotation, setConnectorHeadRotation] = useState(0);
  const [connectorHeadOffset, setConnectorHeadOffset] = useState(0);
  const [useEquidistantHeadPoint, setUseEquidistantHeadPoint] = useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const lastConnectorClickTime = useRef(0);

  const { 
    puzzleState, 
    createRoot, 
    subdivideGrid, 
    mergePieces, 
    addWhimsy,
    addConnector,
    updateConnector,
    removeConnector,
    validateGrid,
    cleanPuzzle,
    reset 
  } = usePuzzleEngineV3();

  const { areas, connectors, width, height } = puzzleState;

  // Sync connection parameters when a connector is selected
  useEffect(() => {
    if (selectedConnectorId && connectors[selectedConnectorId]) {
      const c = connectors[selectedConnectorId];
      setConnectionT(c.midT);
      setConnectionPathIndex(c.pathIndex);
      setConnectorWidthPx(c.widthPx);
      setConnectorExtrusion(c.extrusion);
      setConnectorHeadTemplate(c.headTemplateId);
      setConnectorHeadScale(c.headScale);
      setConnectorHeadRotation(c.headRotationDeg);
      setConnectorHeadOffset(c.headOffset);
      setUseEquidistantHeadPoint(c.useEquidistantHeadPoint || false);
    }
  }, [selectedConnectorId]); // Only sync when selection changes

  // Update selected connector when parameters change
  useEffect(() => {
    if (selectedConnectorId && connectors[selectedConnectorId]) {
      updateConnector(selectedConnectorId, {
        midT: connectionT,
        pathIndex: connectionPathIndex,
        widthPx: connectorWidthPx,
        extrusion: connectorExtrusion,
        headTemplateId: connectorHeadTemplate,
        headScale: connectorHeadScale,
        headRotationDeg: connectorHeadRotation,
        headOffset: connectorHeadOffset,
        useEquidistantHeadPoint: useEquidistantHeadPoint
      });
    }
  }, [selectedConnectorId, connectionT, connectionPathIndex, connectorWidthPx, connectorExtrusion, connectorHeadTemplate, connectorHeadScale, connectorHeadRotation, connectorHeadOffset, useEquidistantHeadPoint, updateConnector]);

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
    // Prevent piece click from firing immediately after a connector click
    if (Date.now() - lastConnectorClickTime.current < 150) return;

    if (activeTab === 'CONNECTION') {
      if (!id) {
        setSelectedIds([]);
        setSelectedConnectorId(null);
        return;
      }
      setSelectedIds([id]);
      setSelectedConnectorId(null); // Deselect connector when clicking a piece
      if (pt) {
        const piece = areas[id];
        if (piece && piece.type === AreaType.PIECE) {
          const { t, pathIndex } = getClosestLocationOnBoundary(piece.boundary, new paper.Point(pt.x, pt.y));
          setConnectionT(t);
          setConnectionPathIndex(pathIndex);
        }
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

  const handleConnectorSelect = useCallback((id: string | null) => {
    lastConnectorClickTime.current = Date.now();
    setSelectedConnectorId(id);
  }, []);

  const handleAddConnector = useCallback(() => {
    if (selectedIds.length !== 1) return;
    const pieceId = selectedIds[0];
    addConnector({
      pieceId,
      pathIndex: connectionPathIndex,
      midT: connectionT,
      widthPx: connectorWidthPx,
      extrusion: connectorExtrusion,
      headTemplateId: connectorHeadTemplate,
      headScale: connectorHeadScale,
      headRotationDeg: connectorHeadRotation,
      headOffset: connectorHeadOffset,
      useEquidistantHeadPoint: useEquidistantHeadPoint
    });
  }, [selectedIds, connectionT, connectionPathIndex, connectorWidthPx, connectorExtrusion, connectorHeadTemplate, connectorHeadScale, connectorHeadRotation, connectorHeadOffset, useEquidistantHeadPoint, addConnector]);

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
        connectorWidthPx={connectorWidthPx}
        setConnectorWidthPx={setConnectorWidthPx}
        connectorExtrusion={connectorExtrusion}
        setConnectorExtrusion={setConnectorExtrusion}
        connectorHeadTemplate={connectorHeadTemplate}
        setConnectorHeadTemplate={setConnectorHeadTemplate}
        connectorHeadScale={connectorHeadScale}
        setConnectorHeadScale={setConnectorHeadScale}
        connectorHeadRotation={connectorHeadRotation}
        setConnectorHeadRotation={setConnectorHeadRotation}
        connectorHeadOffset={connectorHeadOffset}
        setConnectorHeadOffset={setConnectorHeadOffset}
        useEquidistantHeadPoint={useEquidistantHeadPoint}
        setUseEquidistantHeadPoint={setUseEquidistantHeadPoint}
        onAddConnector={handleAddConnector}
        selectedConnectorId={selectedConnectorId}
        onRemoveConnector={removeConnector}
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
          connectorWidthPx={connectorWidthPx}
          setConnectorWidthPx={setConnectorWidthPx}
          connectorExtrusion={connectorExtrusion}
          connectorHeadTemplate={connectorHeadTemplate}
          connectorHeadScale={connectorHeadScale}
          connectorHeadRotation={connectorHeadRotation}
          connectorHeadOffset={connectorHeadOffset}
          useEquidistantHeadPoint={useEquidistantHeadPoint}
          selectedConnectorId={selectedConnectorId}
          onConnectorSelect={handleConnectorSelect}
          onConnectorUpdate={updateConnector}
        />
      </main>
    </div>
  );
}
