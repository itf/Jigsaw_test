import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import paper from 'paper';

import { Point, AreaType, Connector, Operation } from './types';
import { generateGridPoints, generateHexGridPoints } from './geometry';
import { useLongPress } from '../v1/hooks/useLongPress';

import { usePuzzleEngine } from './hooks/usePuzzleEngine';
import { V2Header } from './components/V2Header';
import { V2Navigation } from './components/V2Navigation';
import { V2ActionBar } from './components/V2ActionBar';
import { V2Canvas } from './components/V2Canvas';
import { V2CreateModal } from './components/V2CreateModal';
import { V2TestResults } from './components/V2TestResults';
import { Tab, COLORS } from './constants';
import { runTopologicalTests, TestResult } from './utils/tests';

/**
 * V2App is the main entry point for the second version of the puzzle engine.
 * It manages the high-level state, user interactions, and coordinates the 
 * geometric processing via the usePuzzleEngine hook.
 */
export default function V2App() {
  // --- State ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('TOPOLOGY');
  const [geometryEngine, setGeometryEngine] = useState<'BOOLEAN' | 'TOPOLOGICAL'>('TOPOLOGICAL');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  // Puzzle canvas dimensions — set once via creation modal
  const [showCreateModal, setShowCreateModal] = useState(true);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight - 168 });
  const [history, setHistory] = useState<Operation[]>([]);
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

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<'AREA' | 'CONNECTOR' | 'EDGE' | 'NONE'>('NONE');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

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
  }, [history.length]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Engine Hook ---
  const {
    topology,
    mergedGroups,
    sharedEdges,
    connectors,
    resolvedConnectors,
    finalPieces
  } = usePuzzleEngine({ width, height, history, activeTab, geometryEngine });

  // --- Actions ---
  const mergeAreas = useCallback((areaAId: string, areaBId: string) => {
    const op: Operation = {
      id: `merge-${Date.now()}`,
      type: 'MERGE',
      params: { areaAId, areaBId },
      timestamp: Date.now()
    };
    setHistory(prev => [...prev, op]);
  }, []);

  const deletePiece = useCallback((pieceId: string) => {
    let members = mergedGroups[pieceId];
    if (!members) {
      for (const ids of Object.values(mergedGroups)) {
        if (ids.includes(pieceId)) {
          members = ids;
          break;
        }
      }
    }
    const group = members ?? [pieceId];
    const rep = group[0];
    const memberSet = new Set(group);
    const neighbors = new Set<string>();
    for (const e of sharedEdges) {
      if (e.isMerged) continue;
      const aIn = memberSet.has(e.areaAId);
      const bIn = memberSet.has(e.areaBId);
      if (aIn && !bIn) neighbors.add(e.areaBId);
      if (bIn && !aIn) neighbors.add(e.areaAId);
    }
    neighbors.forEach(n => mergeAreas(rep, n));
    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [sharedEdges, mergedGroups, mergeAreas]);

  const buildSubdivideOperation = useCallback((parentId: string, pattern: string, opId: string): Operation | null => {
    const parent = topology[parentId];
    if (!parent) return null;

    let groupMembers: string[] | undefined = mergedGroups[parentId];
    if (!groupMembers) {
      for (const ids of Object.values(mergedGroups)) {
        if (ids.includes(parentId)) {
          groupMembers = ids;
          break;
        }
      }
    }
    groupMembers = groupMembers ?? [parentId];

    let bounds = { x: 0, y: 0, width, height };
    let clipBoundary: string | undefined;
    let absorbedLeafIds: string[] | undefined;

    paper.setup(new paper.Size(width, height));

    if (groupMembers.length > 1) {
      let mergedPath: paper.PathItem | null = null;
      groupMembers.forEach(id => {
        const area = topology[id];
        if (!area) return;
        const path = new paper.Path(area.boundary);
        path.clockwise = true;
        if (!mergedPath) {
          mergedPath = path;
        } else {
          const next = mergedPath.unite(path);
          mergedPath.remove();
          path.remove();
          mergedPath = next;
        }
      });
      if (mergedPath) {
        const cleaned = (mergedPath as paper.PathItem).reduce({ insert: false }) as paper.PathItem;
        cleaned.reorient(true, true);
        clipBoundary = cleaned.pathData;
        const ub = cleaned.bounds;
        bounds = { x: ub.x, y: ub.y, width: ub.width, height: ub.height };
        cleaned.remove();
      } else {
        const path0 = new paper.Path(parent.boundary);
        const b = path0.bounds;
        bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
        path0.remove();
      }
      absorbedLeafIds = groupMembers.filter(id => id !== parentId);
    } else {
      const path0 = new paper.Path(parent.boundary);
      const b = path0.bounds;
      bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
      path0.remove();
    }

    let points: Point[] = [];
    if (pattern === 'GRID') {
      points = generateGridPoints(width, height, gridRows, gridCols, 0, bounds);
    } else if (pattern === 'HEX') {
      points = generateHexGridPoints(bounds, hexRows, hexCols);
    } else if (pattern === 'RANDOM') {
      for (let i = 0; i < randomPoints; i++) {
        points.push({
          x: bounds.x + Math.random() * bounds.width,
          y: bounds.y + Math.random() * bounds.height
        });
      }
    }

    return {
      id: opId,
      type: 'SUBDIVIDE',
      params: { parentId, points, pattern, clipBoundary, absorbedLeafIds },
      timestamp: Date.now()
    };
  }, [topology, mergedGroups, width, height, gridRows, gridCols, randomPoints, hexRows, hexCols]);

  const subdivideSelectedPieces = useCallback(() => {
    const targets = mergePickIds.filter(id => topology[id]?.isPiece);
    if (targets.length === 0) return;
    const t0 = Date.now();
    const ops: Operation[] = [];
    targets.forEach((pid, i) => {
      const op = buildSubdivideOperation(pid, splitPattern, `subdivide-${t0}-${i}`);
      if (op) ops.push(op);
    });
    if (ops.length === 0) return;
    setHistory(prev => [...prev, ...ops]);
    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [mergePickIds, topology, splitPattern, buildSubdivideOperation]);

  const mergeSelectedPieces = useCallback(() => {
    if (mergePickIds.length < 2) return;
    let acc = mergePickIds[0];
    for (let i = 1; i < mergePickIds.length; i++) {
      mergeAreas(acc, mergePickIds[i]);
    }
    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [mergePickIds, mergeAreas]);

  const addConnector = useCallback((areaAId: string, areaBId: string, u: number) => {
    const op: Operation = {
      id: `connector-${Date.now()}`,
      type: 'ADD_CONNECTOR',
      params: { areaAId, areaBId, u, type: 'TAB', size: 20, isFlipped: false },
      timestamp: Date.now()
    };
    setHistory(prev => [...prev, op]);
    setSelectedId(op.id);
    setSelectedType('CONNECTOR');
  }, []);

  const updateConnector = useCallback((id: string, updates: Partial<Connector>) => {
    setHistory(prev => prev.map(op => {
      if (op.id === id && op.type === 'ADD_CONNECTOR') {
        return { ...op, params: { ...op.params, ...updates } };
      }
      return op;
    }));
  }, []);

  const deleteOperation = useCallback((id: string) => {
    setHistory(prev => prev.filter(op => op.id !== id));
    setSelectedId(null);
    setSelectedType('NONE');
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => prev.slice(0, -1));
  }, []);

  // --- Interaction Handlers ---
  const handleAreaClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTab === 'TOPOLOGY') {
      setMergePickIds(prev => {
        const next = new Set(prev);
        const wasOn = next.has(id);
        if (wasOn) {
          next.delete(id);
          const arr = Array.from(next);
          setSelectedId(cur => (cur === id ? (arr[0] ?? null) : cur));
          if (arr.length === 0) setSelectedType('NONE');
          return arr;
        }
        next.add(id);
        setSelectedId(id);
        setSelectedType('AREA');
        return Array.from(next);
      });
      return;
    }
    setSelectedId(id);
    setSelectedType('AREA');
  };

  const longPressProps = useLongPress(
    (e: any) => {
      // Radial menu removed
    },
    () => {},
    { delay: 500 }
  );

  const scale = Math.min(containerSize.w / width, containerSize.h / height) * 0.9;

  const canSubdivideTopology =
    mergePickIds.length > 0 && mergePickIds.every(id => topology[id]?.isPiece);

  const splittingHint = useMemo(() => {
    if (mergePickIds.length === 0) return null;
    if (mergePickIds.length === 1) {
      const t = mergePickIds[0];
      return t === 'root' ? 'root' : t.split('-').slice(-2).join('-');
    }
    return `${mergePickIds.length} pieces`;
  }, [mergePickIds]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans selection:bg-indigo-100">
      {showCreateModal && (
        <V2CreateModal
          onCreate={(w, h) => {
            setWidth(w);
            setHeight(h);
            setShowCreateModal(false);
          }}
        />
      )}

      <V2Header
        geometryEngine={geometryEngine}
        setGeometryEngine={setGeometryEngine}
        runTests={() => setTestResults(runTopologicalTests())}
        undo={undo}
      />

      <V2Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <V2ActionBar
        activeTab={activeTab}
        splittingHint={splittingHint}
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
        selectionData={selectedType === 'AREA' ? topology[selectedId!] : resolvedConnectors.find(c => c.id === selectedId)}
        mergePickIds={mergePickIds}
        mergeSelectedPieces={mergeSelectedPieces}
        deletePiece={deletePiece}
        onUpdateConnector={updateConnector}
        onDeleteOperation={deleteOperation}
        onClearSelection={() => {
          setSelectedId(null);
          setSelectedType('NONE');
          setMergePickIds([]);
        }}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col" ref={containerRef}>
        <V2Canvas
          width={width}
          height={height}
          fitScale={scale}
          isMobile={isMobile}
          activeTab={activeTab}
          displayPieces={finalPieces}
          selectedId={selectedId}
          mergePickIds={mergePickIds}
          sharedEdges={sharedEdges}
          resolvedConnectors={resolvedConnectors}
          topology={topology}
          setHoveredId={setHoveredId}
          setHoveredType={setHoveredType}
          handleAreaClick={handleAreaClick}
          addConnector={addConnector}
          setSelectedId={setSelectedId}
          setSelectedType={setSelectedType}
          longPressProps={longPressProps}
          onBackgroundClick={() => {
            if (activeTab === 'TOPOLOGY') {
              setMergePickIds([]);
              setSelectedId(null);
              setSelectedType('NONE');
            }
          }}
        />

        <V2TestResults testResults={testResults} onClose={() => setTestResults([])} />
      </main>
    </div>
  );
}
