import React, { useState, useCallback, useEffect, useRef } from 'react';
import { usePuzzleEngineV5 } from './hooks/usePuzzleEngineV5';
import { V5Canvas } from './components/V5Canvas';
import { usePersistence } from './hooks/usePersistence';
import { Tab } from '../v2/constants';
import { Point, NeckShape, ConnectorV5, Face } from './types';

// ---- Minimal inline UI components ----
const Header: React.FC<{ onReset: () => void; onSave: () => void; onLoad: () => void }> = ({ onReset, onSave, onLoad }) => (
  <header className="bg-white border-b border-slate-200 flex items-center justify-between gap-2 px-4 py-2 z-30 shrink-0">
    <span className="font-bold text-slate-900">Puzzle Engine V5</span>
    <div className="flex gap-2">
      <button onClick={onLoad} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100">Load</button>
      <button onClick={onSave} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Save</button>
      <button onClick={onReset} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100">Reset</button>
    </div>
  </header>
);

const NavTabs: React.FC<{ active: Tab; onSet: (t: Tab) => void }> = ({ active, onSet }) => {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'TOPOLOGY', label: 'Topology' },
    { id: 'CONNECTION', label: 'Connection' },
    { id: 'PRODUCTION', label: 'Production' },
  ];
  return (
    <nav className="bg-white border-b border-slate-200 px-4 py-1 flex gap-1 z-20 shrink-0">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onSet(t.id)}
          className={`px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all ${active === t.id ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
};

const CreateModal: React.FC<{ onCreate: (shape: 'RECT' | 'CIRCLE' | 'HEX') => void }> = ({ onCreate }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-4 items-center">
      <h2 className="font-bold text-xl text-slate-800">Create Puzzle</h2>
      <div className="flex gap-3">
        {(['RECT', 'CIRCLE', 'HEX'] as const).map(s => (
          <button key={s} onClick={() => onCreate(s)} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">{s}</button>
        ))}
      </div>
    </div>
  </div>
);

// ---- ActionBar per tab ----
const TopologyBar: React.FC<{
  selectedIds: string[];
  splitPattern: 'GRID' | 'HEX' | 'RANDOM';
  setSplitPattern: (p: 'GRID' | 'HEX' | 'RANDOM') => void;
  gridRows: number; setGridRows: (v: number) => void;
  gridCols: number; setGridCols: (v: number) => void;
  hexRows: number; setHexRows: (v: number) => void;
  hexCols: number; setHexCols: (v: number) => void;
  randomPoints: number; setRandomPoints: (v: number) => void;
  jitter: number; setJitter: (v: number) => void;
  onSubdivide: () => void;
  onMerge: () => void;
  whimsyTemplate: string; setWhimsyTemplate: (t: string) => void;
  whimsyScale: number; setWhimsyScale: (v: number) => void;
  whimsyRotationDeg: number; setWhimsyRotationDeg: (v: number) => void;
  whimsyPlacementActive: boolean;
  startWhimsyPlacement: () => void;
  cancelWhimsyPlacement: () => void;
  selectedFloatingWhimsyId: string | null;
  onMergeWhimsy: () => void;
}> = (p) => {
  const N = ({ label, value, onChange, min = 1, max = 50 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
    <label className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] uppercase font-bold text-slate-400">{label}</span>
      <input type="number" value={value} min={min} max={max} onChange={e => onChange(Number(e.target.value))}
        className="w-14 h-7 bg-slate-50 rounded text-center text-xs border border-slate-100 outline-none" />
    </label>
  );
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 flex-wrap text-xs z-10 shrink-0">
      <select value={p.splitPattern} onChange={e => p.setSplitPattern(e.target.value as any)} className="h-8 px-2 bg-slate-50 rounded-lg border border-slate-100 text-xs font-bold">
        <option value="GRID">Grid</option>
        <option value="HEX">Hex</option>
        <option value="RANDOM">Random</option>
      </select>
      {p.splitPattern === 'GRID' && <><N label="Rows" value={p.gridRows} onChange={p.setGridRows} /><N label="Cols" value={p.gridCols} onChange={p.setGridCols} /></>}
      {p.splitPattern === 'HEX' && <><N label="Rows" value={p.hexRows} onChange={p.setHexRows} /><N label="Cols" value={p.hexCols} onChange={p.setHexCols} /></>}
      {p.splitPattern === 'RANDOM' && <><N label="Points" value={p.randomPoints} onChange={p.setRandomPoints} /><N label="Jitter" value={p.jitter} onChange={p.setJitter} min={0} max={100} /></>}
      <button onClick={p.onSubdivide} disabled={p.selectedIds.length === 0} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-40">Subdivide</button>
      <div className="w-px h-5 bg-slate-100" />
      <button onClick={p.onMerge} disabled={p.selectedIds.length < 2} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold disabled:opacity-40">Merge</button>
      <div className="w-px h-5 bg-slate-100" />
      <span className="text-[9px] font-bold text-slate-400 uppercase">Whimsy</span>
      <select value={p.whimsyTemplate} onChange={e => p.setWhimsyTemplate(e.target.value)} className="h-8 px-2 bg-slate-50 rounded-lg border border-slate-100 text-xs font-bold">
        {['circle', 'star', 'heart', 'butterfly'].map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <N label="Scale" value={p.whimsyScale} onChange={p.setWhimsyScale} min={10} max={500} />
      <N label="Rotate°" value={p.whimsyRotationDeg} onChange={p.setWhimsyRotationDeg} min={0} max={360} />
      {!p.whimsyPlacementActive
        ? <button onClick={p.startWhimsyPlacement} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold">Place Whimsy</button>
        : <button onClick={p.cancelWhimsyPlacement} className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg font-bold">Cancel</button>}
      {p.selectedFloatingWhimsyId && (
        <button onClick={p.onMergeWhimsy} className="px-3 py-1.5 bg-green-600 text-white rounded-lg font-bold">Merge Whimsy</button>
      )}
    </div>
  );
};

const ConnectionBar: React.FC<{
  selectedEdgeId: string | null;
  connectionT: number; setConnectionT: (v: number) => void;
  direction: 'in' | 'out'; setDirection: (d: 'in' | 'out') => void;
  connectorWidthPx: number; setConnectorWidthPx: (v: number) => void;
  connectorExtrusion: number; setConnectorExtrusion: (v: number) => void;
  connectorHeadTemplate: string; setConnectorHeadTemplate: (v: string) => void;
  connectorHeadScale: number; setConnectorHeadScale: (v: number) => void;
  connectorHeadRotation: number; setConnectorHeadRotation: (v: number) => void;
  connectorJitter: number; setConnectorJitter: (v: number) => void;
  connectorNeckShape: NeckShape; setConnectorNeckShape: (v: NeckShape) => void;
  connectorNeckCurvature: number; setConnectorNeckCurvature: (v: number) => void;
  connectorExtrusionCurvature: number; setConnectorExtrusionCurvature: (v: number) => void;
  useEquidistantHeadPoint: boolean; setUseEquidistantHeadPoint: (v: boolean) => void;
  onAddConnector: () => void;
  selectedConnectorId: string | null;
  onRemoveConnector: (id: string) => void;
}> = (p) => {
  const N = ({ label, value, onChange, min = 0, max = 200, step = 1 }: any) => (
    <label className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] uppercase font-bold text-slate-400">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))}
        className="w-14 h-7 bg-slate-50 rounded text-center text-xs border border-slate-100 outline-none" />
    </label>
  );
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 flex-wrap text-xs z-10 shrink-0">
      <span className="text-slate-500 text-xs">{p.selectedEdgeId ? `Edge: ${p.selectedEdgeId.slice(0, 8)}` : 'Click an edge'}</span>
      <N label="T" value={p.connectionT} onChange={p.setConnectionT} min={0} max={1} step={0.01} />
      <select value={p.direction} onChange={e => p.setDirection(e.target.value as 'in' | 'out')} className="h-8 px-2 bg-slate-50 rounded-lg border border-slate-100 text-xs font-bold">
        <option value="out">Out (→ right face)</option>
        <option value="in">In (→ left face)</option>
      </select>
      <div className="w-px h-5 bg-slate-100" />
      <N label="Width px" value={p.connectorWidthPx} onChange={p.setConnectorWidthPx} min={4} max={200} />
      <N label="Extrusion" value={p.connectorExtrusion} onChange={p.setConnectorExtrusion} min={1} max={200} />
      <select value={p.connectorHeadTemplate} onChange={e => p.setConnectorHeadTemplate(e.target.value)} className="h-8 px-2 bg-slate-50 rounded-lg border border-slate-100 text-xs font-bold">
        {['circle', 'star', 'heart', 'butterfly', 'crown'].map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <N label="Head Scale" value={p.connectorHeadScale} onChange={p.setConnectorHeadScale} min={0.1} max={5} step={0.1} />
      <N label="Head Rot°" value={p.connectorHeadRotation} onChange={p.setConnectorHeadRotation} min={0} max={360} />
      <N label="Jitter" value={p.connectorJitter} onChange={p.setConnectorJitter} min={0} max={20} />
      <select value={p.connectorNeckShape} onChange={e => p.setConnectorNeckShape(e.target.value as NeckShape)} className="h-8 px-2 bg-slate-50 rounded-lg border border-slate-100 text-xs font-bold">
        {Object.values(NeckShape).map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <N label="Neck Curv" value={p.connectorNeckCurvature} onChange={p.setConnectorNeckCurvature} min={-1} max={1} step={0.05} />
      <N label="Ext Curv" value={p.connectorExtrusionCurvature} onChange={p.setConnectorExtrusionCurvature} min={-1} max={1} step={0.05} />
      <label className="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" checked={p.useEquidistantHeadPoint} onChange={e => p.setUseEquidistantHeadPoint(e.target.checked)} />
        <span className="text-[9px] uppercase font-bold text-slate-400">Equidist</span>
      </label>
      <button
        onClick={p.onAddConnector}
        disabled={!p.selectedEdgeId}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-40"
      >
        Add Connector
      </button>
      {p.selectedConnectorId && (
        <button onClick={() => p.onRemoveConnector(p.selectedConnectorId!)} className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg font-bold">
          Remove
        </button>
      )}
    </div>
  );
};

// ---- Main V5 App ----
export default function V5App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('TOPOLOGY');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight - 168 });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rectSelectMode, setRectSelectMode] = useState(false);
  const [rectStart, setRectStart] = useState<Point | null>(null);

  // Subdivision
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(4);
  const [hexRows, setHexRows] = useState(4);
  const [hexCols, setHexCols] = useState(4);
  const [randomPoints, setRandomPoints] = useState(12);
  const [jitter, setJitter] = useState(0);
  const [splitPattern, setSplitPattern] = useState<'GRID' | 'HEX' | 'RANDOM'>('GRID');

  // Whimsy
  const [whimsyTemplate, setWhimsyTemplate] = useState<string>('circle');
  const [whimsyScale, setWhimsyScale] = useState(56);
  const [whimsyRotationDeg, setWhimsyRotationDeg] = useState(0);
  const [whimsyPlacementActive, setWhimsyPlacementActive] = useState(false);

  // Connection
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectionT, setConnectionT] = useState(0.5);
  const [connectorDirection, setConnectorDirection] = useState<'in' | 'out'>('out');
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
  const [previewConnectors] = useState<Record<string, ConnectorV5>>({});
  const jitterSeedRef = useRef<number>((Math.random() * 0xffffffff) >>> 0);

  const {
    puzzleState,
    createRoot,
    subdivideGrid,
    mergePieces,
    placeFloatingWhimsy,
    moveFloatingWhimsy,
    mergeWhimsy,
    addConnector,
    updateConnector,
    removeConnector,
    bakeConnectors,
    loadState,
    reset,
  } = usePuzzleEngineV5();

  const { isReady, exportToFile, importFromFile, clearPersistence } = usePersistence(puzzleState, loadState);

  const { width, height, connectors, floatingWhimsies } = puzzleState;

  useEffect(() => {
    if (isReady && !puzzleState.rootFaceId) setShowCreateModal(true);
  }, [isReady, puzzleState.rootFaceId]);

  // Sync connector params from selected connector
  useEffect(() => {
    if (selectedConnectorId && connectors[selectedConnectorId]) {
      const c = connectors[selectedConnectorId];
      setSelectedEdgeId(c.midEdgeId);
      setConnectionT(c.midT);
      setConnectorDirection(c.direction);
      setConnectorWidthPx(c.widthPx);
      setConnectorExtrusion(c.extrusion);
      setConnectorHeadTemplate(c.headTemplateId);
      setConnectorHeadScale(c.headScale);
      setConnectorHeadRotation(c.headRotationDeg);
      setConnectorJitter(c.jitter || 0);
      setConnectorNeckShape(c.neckShape || NeckShape.STANDARD);
      setConnectorNeckCurvature(c.neckCurvature || 0);
      setConnectorExtrusionCurvature(c.extrusionCurvature || 0);
      setUseEquidistantHeadPoint(c.useEquidistantHeadPoint ?? true);
    }
  }, [selectedConnectorId, connectors]);

  // Live-update selected connector when params change
  useEffect(() => {
    if (!selectedConnectorId || !connectors[selectedConnectorId]) return;
    updateConnector(selectedConnectorId, {
      midT: connectionT,
      widthPx: connectorWidthPx,
      extrusion: connectorExtrusion,
      headTemplateId: connectorHeadTemplate,
      headScale: connectorHeadScale,
      headRotationDeg: connectorHeadRotation,
      jitter: connectorJitter,
      neckShape: connectorNeckShape,
      neckCurvature: connectorNeckCurvature,
      extrusionCurvature: connectorExtrusionCurvature,
      useEquidistantHeadPoint,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionT, connectorWidthPx, connectorExtrusion, connectorHeadTemplate, connectorHeadScale, connectorHeadRotation, connectorJitter, connectorNeckShape, connectorNeckCurvature, connectorExtrusionCurvature, useEquidistantHeadPoint]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const e of entries) {
        setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleCreate = useCallback((shape: 'RECT' | 'CIRCLE' | 'HEX') => {
    createRoot(2000, 2000, shape);
    setShowCreateModal(false);
  }, [createRoot]);

  const handleSubdivide = useCallback(() => {
    selectedIds.forEach(id => {
      subdivideGrid({ parentId: id, pattern: splitPattern, rows: splitPattern === 'GRID' ? gridRows : hexRows, cols: splitPattern === 'GRID' ? gridCols : hexCols, count: randomPoints, jitter });
    });
    setSelectedIds([]);
  }, [selectedIds, splitPattern, gridRows, gridCols, hexRows, hexCols, randomPoints, jitter, subdivideGrid]);

  const handleMerge = useCallback(() => {
    if (selectedIds.length < 2) return;
    mergePieces(selectedIds);
    setSelectedIds([]);
  }, [selectedIds, mergePieces]);

  const handleWhimsyCommit = useCallback((p: Point) => {
    placeFloatingWhimsy({ templateId: whimsyTemplate, center: p, scale: whimsyScale, rotationDeg: whimsyRotationDeg });
    setWhimsyPlacementActive(false);
  }, [whimsyTemplate, whimsyScale, whimsyRotationDeg, placeFloatingWhimsy]);

  const selectedFloatingWhimsyId = selectedIds.length === 1 && floatingWhimsies.some(fw => fw.id === selectedIds[0]) ? selectedIds[0] : null;

  const handleMergeWhimsy = useCallback(() => {
    if (selectedFloatingWhimsyId) {
      mergeWhimsy(selectedFloatingWhimsyId);
      setSelectedIds([]);
    }
  }, [selectedFloatingWhimsyId, mergeWhimsy]);

  const handleClick = useCallback((id: string | null, pt?: Point) => {
    if (whimsyPlacementActive && pt) { handleWhimsyCommit(pt); return; }
    if (!id) { setSelectedIds([]); setSelectedConnectorId(null); return; }
    // If in CONNECTION tab, edge click is handled by onConnectionUpdate — face clicks just select
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, [whimsyPlacementActive, handleWhimsyCommit]);

  const handleConnectionUpdate = useCallback((edgeId: string, t: number) => {
    setSelectedEdgeId(edgeId);
    setConnectionT(t);
    setSelectedConnectorId(null);
  }, []);

  const handleAddConnector = useCallback(() => {
    if (!selectedEdgeId) return;
    addConnector({
      midEdgeId: selectedEdgeId,
      midT: connectionT,
      direction: connectorDirection,
      widthPx: connectorWidthPx,
      extrusion: connectorExtrusion,
      headTemplateId: connectorHeadTemplate,
      headScale: connectorHeadScale,
      headRotationDeg: connectorHeadRotation,
      jitter: connectorJitter,
      jitterSeed: jitterSeedRef.current,
      neckShape: connectorNeckShape,
      neckCurvature: connectorNeckCurvature,
      extrusionCurvature: connectorExtrusionCurvature,
      useEquidistantHeadPoint,
    });
    jitterSeedRef.current = (Math.random() * 0xffffffff) >>> 0;
  }, [selectedEdgeId, connectionT, connectorDirection, connectorWidthPx, connectorExtrusion, connectorHeadTemplate, connectorHeadScale, connectorHeadRotation, connectorJitter, connectorNeckShape, connectorNeckCurvature, connectorExtrusionCurvature, useEquidistantHeadPoint, addConnector]);

  const handleSetActiveTab = useCallback((tab: Tab) => {
    if (tab === 'PRODUCTION') bakeConnectors();
    setActiveTab(tab);
  }, [bakeConnectors]);

  const handleRectSelect = useCallback((start: Point, end: Point) => {
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    const ids = (Object.values(puzzleState.faces) as Face[])
      .filter(face => {
        if (!face.edges.length) return false;
        // Use seedPoint if available, otherwise use first node centroid
        if (face.seedPoint) {
          return face.seedPoint.x >= minX && face.seedPoint.x <= maxX && face.seedPoint.y >= minY && face.seedPoint.y <= maxY;
        }
        return false;
      })
      .map(f => f.id);
    setSelectedIds(ids);
    setRectSelectMode(false);
    setRectStart(null);
  }, [puzzleState.faces]);

  const fitScale = Math.max(0.05, Math.min(containerSize.w / (width || 800), (containerSize.h - 60) / (height || 600)) * 0.9);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 overflow-y-auto font-sans">
      {showCreateModal && <CreateModal onCreate={handleCreate} />}

      <Header
        onReset={() => { clearPersistence(); reset(); setShowCreateModal(true); }}
        onSave={exportToFile}
        onLoad={importFromFile}
      />

      <NavTabs active={activeTab} onSet={handleSetActiveTab} />

      {activeTab === 'TOPOLOGY' && (
        <TopologyBar
          selectedIds={selectedIds}
          splitPattern={splitPattern} setSplitPattern={setSplitPattern}
          gridRows={gridRows} setGridRows={setGridRows}
          gridCols={gridCols} setGridCols={setGridCols}
          hexRows={hexRows} setHexRows={setHexRows}
          hexCols={hexCols} setHexCols={setHexCols}
          randomPoints={randomPoints} setRandomPoints={setRandomPoints}
          jitter={jitter} setJitter={setJitter}
          onSubdivide={handleSubdivide}
          onMerge={handleMerge}
          whimsyTemplate={whimsyTemplate} setWhimsyTemplate={setWhimsyTemplate}
          whimsyScale={whimsyScale} setWhimsyScale={setWhimsyScale}
          whimsyRotationDeg={whimsyRotationDeg} setWhimsyRotationDeg={setWhimsyRotationDeg}
          whimsyPlacementActive={whimsyPlacementActive}
          startWhimsyPlacement={() => setWhimsyPlacementActive(true)}
          cancelWhimsyPlacement={() => setWhimsyPlacementActive(false)}
          selectedFloatingWhimsyId={selectedFloatingWhimsyId}
          onMergeWhimsy={handleMergeWhimsy}
        />
      )}

      {activeTab === 'CONNECTION' && (
        <ConnectionBar
          selectedEdgeId={selectedEdgeId}
          connectionT={connectionT} setConnectionT={setConnectionT}
          direction={connectorDirection} setDirection={setConnectorDirection}
          connectorWidthPx={connectorWidthPx} setConnectorWidthPx={setConnectorWidthPx}
          connectorExtrusion={connectorExtrusion} setConnectorExtrusion={setConnectorExtrusion}
          connectorHeadTemplate={connectorHeadTemplate} setConnectorHeadTemplate={setConnectorHeadTemplate}
          connectorHeadScale={connectorHeadScale} setConnectorHeadScale={setConnectorHeadScale}
          connectorHeadRotation={connectorHeadRotation} setConnectorHeadRotation={setConnectorHeadRotation}
          connectorJitter={connectorJitter} setConnectorJitter={setConnectorJitter}
          connectorNeckShape={connectorNeckShape} setConnectorNeckShape={setConnectorNeckShape}
          connectorNeckCurvature={connectorNeckCurvature} setConnectorNeckCurvature={setConnectorNeckCurvature}
          connectorExtrusionCurvature={connectorExtrusionCurvature} setConnectorExtrusionCurvature={setConnectorExtrusionCurvature}
          useEquidistantHeadPoint={useEquidistantHeadPoint} setUseEquidistantHeadPoint={setUseEquidistantHeadPoint}
          onAddConnector={handleAddConnector}
          selectedConnectorId={selectedConnectorId}
          onRemoveConnector={removeConnector}
        />
      )}

      <main className="flex-1 relative min-h-[50vh] flex flex-col" ref={containerRef}>
        <V5Canvas
          puzzleState={puzzleState}
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onClick={handleClick}
          fitScale={fitScale}
          whimsyPlacementActive={whimsyPlacementActive}
          whimsyTemplate={whimsyTemplate}
          whimsyScale={whimsyScale}
          whimsyRotationDeg={whimsyRotationDeg}
          onWhimsyCommit={handleWhimsyCommit}
          onFloatingWhimsyMove={moveFloatingWhimsy}
          onMergeWhimsy={mergeWhimsy}
          activeTab={activeTab}
          selectedEdgeId={selectedEdgeId}
          connectionT={connectionT}
          onConnectionUpdate={handleConnectionUpdate}
          connectorWidthPx={connectorWidthPx}
          connectorExtrusion={connectorExtrusion}
          connectorHeadTemplate={connectorHeadTemplate}
          connectorHeadScale={connectorHeadScale}
          connectorHeadRotation={connectorHeadRotation}
          connectorJitter={connectorJitter}
          connectorJitterSeed={jitterSeedRef.current}
          connectorNeckShape={connectorNeckShape}
          connectorNeckCurvature={connectorNeckCurvature}
          connectorExtrusionCurvature={connectorExtrusionCurvature}
          useEquidistantHeadPoint={useEquidistantHeadPoint}
          connectorDirection={connectorDirection}
          selectedConnectorId={selectedConnectorId}
          onConnectorSelect={setSelectedConnectorId}
          previewConnectors={previewConnectors}
          rectSelectMode={rectSelectMode}
          rectStart={rectStart}
          onRectPoint={(pt: Point) => {
            if (!rectStart) setRectStart(pt);
            else handleRectSelect(rectStart, pt);
          }}
        />
      </main>
    </div>
  );
}
