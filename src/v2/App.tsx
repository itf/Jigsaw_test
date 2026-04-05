import React, { useState, useCallback, useEffect, useRef } from 'react';
import paper from 'paper';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  RotateCcw, 
  Layers, 
  RefreshCw,
  Link as LinkIcon,
  Zap,
  Move,
  Type,
  Grid,
  Hexagon,
  Shuffle
} from 'lucide-react';

import { Point, AreaType, Connector, Operation } from './types';
import { generateGridPoints, generateHexPoints } from './geometry';
import { useLongPress } from '../v1/hooks/useLongPress';

import { usePuzzleEngine } from './hooks/usePuzzleEngine';
import { V2Header } from './components/V2Header';
import { V2Navigation } from './components/V2Navigation';
import { V2ActionBar } from './components/V2ActionBar';
import { V2Canvas } from './components/V2Canvas';
import { V2QuickStart } from './components/V2QuickStart';
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
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight - 168);
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight - 168 });
  const [history, setHistory] = useState<Operation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'AREA' | 'CONNECTOR' | 'NONE'>('NONE');
  
  // Subdivision Parameters
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(4);
  const [randomPoints, setRandomPoints] = useState(12);
  const [hexSize, setHexSize] = useState(60);
  const [mergeSelection, setMergeSelection] = useState<string | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<'AREA' | 'CONNECTOR' | 'EDGE' | 'NONE'>('NONE');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // --- Effects ---
  useEffect(() => {
    setMergeSelection(null);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [activeTab]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        setContainerSize({ w: newW, h: newH });
        
        // Only update base dimensions if no work has started
        if (history.length === 0) {
          setWidth(newW);
          setHeight(newH);
        }
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
  const subdivide = useCallback((parentId: string, pattern: string) => {
    let points: Point[] = [];
    const parent = topology[parentId];
    let bounds = { x: 0, y: 0, width, height };
    
    if (parent) {
      paper.setup(new paper.Size(width, height));
      const path = new paper.Path(parent.boundary);
      const b = path.bounds;
      bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
      path.remove();
    }

    if (pattern === 'GRID') {
      points = generateGridPoints(width, height, gridRows, gridCols, 0, bounds);
    } else if (pattern === 'HEX') {
      points = generateHexPoints(bounds.width, bounds.height, hexSize);
      // Offset hex points by bounds origin
      points = points.map(p => ({ x: p.x + bounds.x, y: p.y + bounds.y }));
    } else if (pattern === 'RANDOM') {
      for (let i = 0; i < randomPoints; i++) {
        points.push({ 
          x: bounds.x + Math.random() * bounds.width, 
          y: bounds.y + Math.random() * bounds.height 
        });
      }
    }

    const op: Operation = {
      id: `subdivide-${Date.now()}`,
      type: 'SUBDIVIDE',
      params: { parentId, points, pattern },
      timestamp: Date.now()
    };
    setHistory(prev => [...prev, op]);
  }, [width, height, gridRows, gridCols, randomPoints, hexSize]);

  const mergeAreas = useCallback((areaAId: string, areaBId: string) => {
    const op: Operation = {
      id: `merge-${Date.now()}`,
      type: 'MERGE',
      params: { areaAId, areaBId },
      timestamp: Date.now()
    };
    setHistory(prev => [...prev, op]);
  }, []);

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
    if (activeTab === 'MODIFICATION') {
      if (!mergeSelection) {
        setMergeSelection(id);
      } else if (mergeSelection !== id) {
        mergeAreas(mergeSelection, id);
        setMergeSelection(null);
      }
    } else {
      setSelectedId(id);
      setSelectedType('AREA');
    }
  };

  const longPressProps = useLongPress(
    (e: any) => {
      // Radial menu removed
    },
    () => {},
    { delay: 500 }
  );

  const scale = Math.min(containerSize.w / width, containerSize.h / height) * 0.9;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans selection:bg-indigo-100">
      <V2Header 
        geometryEngine={geometryEngine}
        setGeometryEngine={setGeometryEngine}
        runTests={() => setTestResults(runTopologicalTests())}
        undo={undo}
      />

      <V2Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <V2ActionBar 
        activeTab={activeTab}
        isMobile={isMobile}
        gridRows={gridRows}
        setGridRows={setGridRows}
        gridCols={gridCols}
        setGridCols={setGridCols}
        randomPoints={randomPoints}
        setRandomPoints={setRandomPoints}
        subdivide={subdivide}
        selectedId={selectedId}
        selectedType={selectedType}
        selectionData={selectedType === 'AREA' ? topology[selectedId!] : resolvedConnectors.find(c => c.id === selectedId)}
        mergeSelection={mergeSelection}
        setMergeSelection={setMergeSelection}
        onUpdateConnector={updateConnector}
        onDeleteOperation={deleteOperation}
        onClearSelection={() => {
          setSelectedId(null);
          setSelectedType('NONE');
        }}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col" ref={containerRef}>
        <V2Canvas 
          width={width}
          height={height}
          scale={scale}
          isMobile={isMobile}
          activeTab={activeTab}
          displayPieces={finalPieces}
          selectedId={selectedId}
          mergeSelection={mergeSelection}
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
        />

        {history.length === 0 && <V2QuickStart subdivide={subdivide} />}

        <V2TestResults testResults={testResults} onClose={() => setTestResults([])} />
      </main>
    </div>
  );
}
