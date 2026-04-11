import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePuzzleEngineV3 } from './hooks/usePuzzleEngineV3';
import { V3Header } from './components/V3Header';
import { V3Navigation } from './components/V3Navigation';
import { V3ActionBar } from './components/V3ActionBar';
import { V3Canvas } from './components/V3Canvas';
import { V3ProductionTab } from './components/V3ProductionTab';
import { V3CreateModal } from './components/V3CreateModal';
import { usePersistence } from './hooks/usePersistence';
import { Tab } from '../v2/constants';
import { Point, AreaType, Connector, NeckShape } from './types';
import { getPathCount, getClosestLocationOnBoundary } from './utils/paperUtils';
import paper from 'paper';

export default function V3App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('TOPOLOGY');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight - 168 });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rectSelectMode, setRectSelectMode] = useState(false);
  const [rectStart, setRectStart] = useState<Point | null>(null);

  // Subdivision Parameters
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(4);
  const [hexRows, setHexRows] = useState(4);
  const [hexCols, setHexCols] = useState(4);
  const [randomPoints, setRandomPoints] = useState(12);
  const [jitter, setJitter] = useState(0);
  const [splitPattern, setSplitPattern] = useState<'GRID' | 'HEX' | 'RANDOM'>('GRID');

  // Whimsy Parameters
  const [whimsyTemplate, setWhimsyTemplate] = useState<string>('circle');
  const [whimsyScale, setWhimsyScale] = useState(56);
  const [whimsyRotationDeg, setWhimsyRotationDeg] = useState(0);
  const [whimsyPlacementActive, setWhimsyPlacementActive] = useState(false);

  // Stamp Parameters
  const [stampPlacementActive, setStampPlacementActive] = useState(false);
  const [activeStampSourceId, setActiveStampSourceId] = useState<string | null>(null);

  // Connection Parameters
  const [connectionT, setConnectionT] = useState(0.5);
  const [connectionPathIndex, setConnectionPathIndex] = useState(0);
  const [connectorWidthPx, setConnectorWidthPx] = useState(24);
  const [connectorExtrusion, setConnectorExtrusion] = useState(20);
  const [connectorHeadTemplate, setConnectorHeadTemplate] = useState('circle');
  const [connectorHeadScale, setConnectorHeadScale] = useState(1.0);
  const [connectorHeadRotation, setConnectorHeadRotation] = useState(0);
  const [connectorJitter, setConnectorJitter] = useState(0);
  const [connectorNeckShape, setConnectorNeckShape] = useState<NeckShape>(NeckShape.STANDARD);
  const [connectorNeckCurvature, setConnectorNeckCurvature] = useState(0);
  const [connectorExtrusionCurvature, setConnectorExtrusionCurvature] = useState(0);
  const [useEquidistantHeadPoint, setUseEquidistantHeadPoint] = useState(true);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const lastConnectorClickTime = useRef(0);
  const [massHeadIds, setMassHeadIds] = useState<string[]>(['circle']);

  // Mass Connection Parameters (Persistent)
  const [massWidthRange, setMassWidthRange] = useState<[number, number]>([0.15, 0.25]);
  const [massWidthRelative, setMassWidthRelative] = useState(true);
  const [massExtrusionRange, setMassExtrusionRange] = useState<[number, number]>([15, 25]);
  const [massExtrusionRelative, setMassExtrusionRelative] = useState(true);
  const [massPositionRange, setMassPositionRange] = useState<[number, number]>([45, 55]);
  const [massHeadScaleRange, setMassHeadScaleRange] = useState<[number, number]>([5, 15]);
  const [massHeadScaleRelative, setMassHeadScaleRelative] = useState(true);
  const [massUseActualAreaForScale, setMassUseActualAreaForScale] = useState(false);
  const [massHeadRotationRange, setMassHeadRotationRange] = useState<[number, number]>([0, 0]);
  const [massJitterRange, setMassJitterRange] = useState<[number, number]>([0, 2]);
  const [massNeckShapes, setMassNeckShapes] = useState<NeckShape[]>([NeckShape.STANDARD]);

  // Preview state
  const [previewConnectors, setPreviewConnectors] = useState<Record<string, Connector>>({});
  // Stable seed for the CONNECTION tab single-connector preview (regenerated when piece selection changes)
  const [previewJitterSeed, setPreviewJitterSeed] = useState<number>(() => (Math.random() * 0xffffffff) >>> 0);
  const previewJitterSeedRef = useRef<number>(previewJitterSeed);

  const {
    puzzleState,
    createRoot,
    subdivideGrid,
    mergePieces,
    addWhimsy,
    addConnector,
    updateConnector,
    removeConnector,
    addWhimsyToLibrary,
    removeWhimsyFromLibrary,
    addMassConnectors,
    generateMassConnectors,
    commitPreviewConnectors,
    resolveConnectorConflicts,
    validateGrid,
    cleanPuzzle,
    reset,
    loadState,
    stamps: stampOps
  } = usePuzzleEngineV3();

  const { isReady, exportToFile, importFromFile, clearPersistence } = usePersistence(puzzleState, loadState);

  const { areas, connectors, whimsies, width, height } = puzzleState;

  // Show modal only if no puzzle is loaded after persistence check
  useEffect(() => {
    if (isReady && !puzzleState.rootAreaId) {
      setShowCreateModal(true);
    }
  }, [isReady, puzzleState.rootAreaId]);

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
      setConnectorJitter(c.jitter || 0);
      setConnectorNeckShape(c.neckShape || NeckShape.STANDARD);
      setConnectorNeckCurvature(c.neckCurvature || 0);
      setConnectorExtrusionCurvature(c.extrusionCurvature || 0);
      setUseEquidistantHeadPoint(c.useEquidistantHeadPoint !== undefined ? c.useEquidistantHeadPoint : true);
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
        jitter: connectorJitter,
        neckShape: connectorNeckShape,
        neckCurvature: connectorNeckCurvature,
        extrusionCurvature: connectorExtrusionCurvature,
        useEquidistantHeadPoint: useEquidistantHeadPoint
      });
    }
  }, [selectedConnectorId, connectionT, connectionPathIndex, connectorWidthPx, connectorExtrusion, connectorHeadTemplate, connectorHeadScale, connectorHeadRotation, connectorJitter, connectorNeckShape, connectorNeckCurvature, connectorExtrusionCurvature, useEquidistantHeadPoint, updateConnector]);

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

  const handleCreate = useCallback((shape: 'RECT' | 'CIRCLE' | 'HEX') => {
    console.log('Initializing V3 Engine with shape:', shape);
    try {
      createRoot(2000, 2000, shape);
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

  const handleSelectAll = useCallback(() => {
    const allIds = (Object.values(areas) as any[])
      .filter(a => a.type === AreaType.PIECE)
      .map(a => a.id);
    setSelectedIds(allIds);
  }, [areas]);

  const handleRectSelect = useCallback((start: Point, end: Point) => {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const ids = (Object.values(areas) as any[])
      .filter(a => a.type === AreaType.PIECE)
      .filter(a => {
        const b = a.boundary.bounds;
        // Include piece if its center is inside the rect
        const cx = (b.x + b.width / 2);
        const cy = (b.y + b.height / 2);
        return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
      })
      .map(a => a.id);
    setSelectedIds(ids);
    setRectSelectMode(false);
    setRectStart(null);
  }, [areas]);

  const handleWhimsyCommit = useCallback((p: Point) => {
    addWhimsy({
      templateId: whimsyTemplate,
      center: p,
      scale: whimsyScale,
      rotationDeg: whimsyRotationDeg
    });
    setWhimsyPlacementActive(false);
  }, [whimsyTemplate, whimsyScale, whimsyRotationDeg, addWhimsy]);

  const handleStampCommit = useCallback((p: Point) => {
    if (!activeStampSourceId) return;
    const src = areas[activeStampSourceId];
    if (!src?.cachedBoundaryPathData) return;

    const bounds = src.cachedBounds ?? { x: 0, y: 0, width: 100, height: 100 };
    const adjustedX = p.x - bounds.x - bounds.width / 2;
    const adjustedY = p.y - bounds.y - bounds.height / 2;

    stampOps.placeStamp(activeStampSourceId, puzzleState.rootAreaId, {
      translateX: adjustedX,
      translateY: adjustedY,
      rotation: 0,
      flipX: false
    });
    setStampPlacementActive(false);
    setActiveStampSourceId(null);
  }, [activeStampSourceId, areas, stampOps, puzzleState.rootAreaId]);

  const handleStampCancelPlacement = useCallback(() => {
    setStampPlacementActive(false);
    setActiveStampSourceId(null);
  }, []);

  const handlePieceClick = useCallback((id: string | null, pt?: Point) => {
    // Prevent piece click from firing immediately after a connector click
    if (Date.now() - lastConnectorClickTime.current < 200) return;

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
    if (id) {
      const c = connectors[id];
      if (c && !selectedIds.includes(c.pieceId)) {
        setSelectedIds([c.pieceId]);
      }
    }
  }, [connectors, selectedIds]);

  // Regenerate the preview jitter seed whenever the selected piece changes (CONNECTION tab)
  const selectedPiece = selectedIds.length === 1 ? selectedIds[0] : null;
  useEffect(() => {
    const newSeed = (Math.random() * 0xffffffff) >>> 0;
    setPreviewJitterSeed(newSeed);
    previewJitterSeedRef.current = newSeed;
  }, [selectedPiece]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddConnector = useCallback(() => {
    if (selectedIds.length !== 1) return;
    const pieceId = selectedIds[0];
    // Commit with the same seed that was shown in preview
    addConnector({
      pieceId,
      pathIndex: connectionPathIndex,
      midT: connectionT,
      widthPx: connectorWidthPx,
      extrusion: connectorExtrusion,
      headTemplateId: connectorHeadTemplate,
      headScale: connectorHeadScale,
      headRotationDeg: connectorHeadRotation,
      jitter: connectorJitter,
      jitterSeed: previewJitterSeedRef.current,
      neckShape: connectorNeckShape,
      neckCurvature: connectorNeckCurvature,
      extrusionCurvature: connectorExtrusionCurvature,
      useEquidistantHeadPoint: useEquidistantHeadPoint
    });
    // Regenerate seed so next preview has a different jitter
    const newSeed = (Math.random() * 0xffffffff) >>> 0;
    setPreviewJitterSeed(newSeed);
    previewJitterSeedRef.current = newSeed;
  }, [selectedIds, connectionT, connectionPathIndex, connectorWidthPx, connectorExtrusion, connectorHeadTemplate, connectorHeadScale, connectorHeadRotation, connectorJitter, useEquidistantHeadPoint, addConnector]);

  // Mass preview handlers
  const handlePreviewMassConnectors = useCallback((params: Parameters<typeof addMassConnectors>[0]) => {
    const generated = generateMassConnectors(params);
    setPreviewConnectors(generated);
  }, [generateMassConnectors]);

  const handleCommitPreviewConnectors = useCallback(() => {
    commitPreviewConnectors(previewConnectors);
    setPreviewConnectors({});
  }, [commitPreviewConnectors, previewConnectors]);

  // Clear preview when tab changes
  const handleSetActiveTab = useCallback((tab: Tab) => {
    setPreviewConnectors({});
    setActiveTab(tab);
  }, []);

  const fitScale = Math.max(0.1, Math.min(containerSize.w / (width || 800), (containerSize.h - 60) / (height || 600)) * 0.9);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 overflow-y-auto font-sans selection:bg-indigo-100">
      {showCreateModal && (
        <V3CreateModal onCreate={handleCreate} />
      )}

      <V3Header 
        onReset={() => { 
          clearPersistence();
          reset(); 
          setShowCreateModal(true); 
        }} 
        onSave={exportToFile}
        onLoad={importFromFile}
      />

      <V3Navigation activeTab={activeTab} setActiveTab={handleSetActiveTab} />

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
        useEquidistantHeadPoint={useEquidistantHeadPoint}
        setUseEquidistantHeadPoint={setUseEquidistantHeadPoint}
        onAddConnector={handleAddConnector}
        selectedConnectorId={selectedConnectorId}
        onRemoveConnector={removeConnector}
        connectorJitter={connectorJitter}
        setConnectorJitter={setConnectorJitter}
        connectorNeckShape={connectorNeckShape}
        setConnectorNeckShape={setConnectorNeckShape}
        connectorNeckCurvature={connectorNeckCurvature}
        setConnectorNeckCurvature={setConnectorNeckCurvature}
        connectorExtrusionCurvature={connectorExtrusionCurvature}
        setConnectorExtrusionCurvature={setConnectorExtrusionCurvature}
        onAddMassConnectors={addMassConnectors}
        onPreviewMassConnectors={handlePreviewMassConnectors}
        onCommitPreviewConnectors={handleCommitPreviewConnectors}
        hasPreview={Object.keys(previewConnectors).length > 0}
        onResolveConflicts={resolveConnectorConflicts}
        whimsies={whimsies}
        onUploadWhimsy={addWhimsyToLibrary}
        onRemoveWhimsy={removeWhimsyFromLibrary}
        onSelectAll={handleSelectAll}
        onUnselectAll={() => setSelectedIds([])}
        rectSelectMode={rectSelectMode}
        onToggleRectSelect={() => {
          setRectSelectMode(prev => !prev);
          setRectStart(null);
        }}
        massHeadIds={massHeadIds}
        setMassHeadIds={setMassHeadIds}
        massWidthRange={massWidthRange}
        setMassWidthRange={setMassWidthRange}
        massWidthRelative={massWidthRelative}
        setMassWidthRelative={setMassWidthRelative}
        massExtrusionRange={massExtrusionRange}
        setMassExtrusionRange={setMassExtrusionRange}
        massExtrusionRelative={massExtrusionRelative}
        setMassExtrusionRelative={setMassExtrusionRelative}
        massPositionRange={massPositionRange}
        setMassPositionRange={setMassPositionRange}
        massHeadScaleRange={massHeadScaleRange}
        setMassHeadScaleRange={setMassHeadScaleRange}
        massHeadScaleRelative={massHeadScaleRelative}
        setMassHeadScaleRelative={setMassHeadScaleRelative}
        massUseActualAreaForScale={massUseActualAreaForScale}
        setMassUseActualAreaForScale={setMassUseActualAreaForScale}
        massHeadRotationRange={massHeadRotationRange}
        setMassHeadRotationRange={setMassHeadRotationRange}
        massJitterRange={massJitterRange}
        setMassJitterRange={setMassJitterRange}
        massNeckShapes={massNeckShapes}
        setMassNeckShapes={setMassNeckShapes}
        areas={areas}
        onCreateStamp={stampOps.createStamp}
        onPlaceStamp={(sourceGroupId) => {
          setActiveStampSourceId(sourceGroupId);
          setStampPlacementActive(true);
        }}
        onDeleteStampSource={stampOps.deleteStampSource}
        onRefreshStamps={stampOps.refreshAllStamps}
      />

      <main className="flex-1 relative min-h-[50vh] flex flex-col" ref={containerRef}>
        {activeTab === 'PRODUCTION' ? (
          <V3ProductionTab puzzleState={puzzleState} onResolveConflicts={resolveConnectorConflicts} />
        ) : (
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
            stampPlacementActive={stampPlacementActive}
            activeStampSourceId={activeStampSourceId}
            onStampCommit={handleStampCommit}
            onStampCancelPlacement={handleStampCancelPlacement}
            activeTab={activeTab}
            connectionT={connectionT}
            connectionPathIndex={connectionPathIndex}
            onConnectionUpdate={handleConnectionUpdate}
            connectorWidthPx={connectorWidthPx}
            connectorExtrusion={connectorExtrusion}
            connectorHeadTemplate={connectorHeadTemplate}
            connectorHeadScale={connectorHeadScale}
            connectorHeadRotation={connectorHeadRotation}
            connectorJitter={connectorJitter}
            connectorJitterSeed={previewJitterSeed}
            connectorNeckShape={connectorNeckShape}
            connectorNeckCurvature={connectorNeckCurvature}
            connectorExtrusionCurvature={connectorExtrusionCurvature}
            useEquidistantHeadPoint={useEquidistantHeadPoint}
            selectedConnectorId={selectedConnectorId}
            previewConnectors={previewConnectors}
            onConnectorSelect={handleConnectorSelect}
            onConnectorUpdate={updateConnector}
            rectSelectMode={rectSelectMode}
            rectStart={rectStart}
            onRectPoint={(pt: Point) => {
              if (!rectStart) {
                setRectStart(pt);
              } else {
                handleRectSelect(rectStart, pt);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
