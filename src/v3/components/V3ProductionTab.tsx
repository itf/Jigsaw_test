import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Download, Layers, Trash2 } from 'lucide-react';
import { PuzzleState } from '../types';
import { processProductionState, ProductionArea } from '../utils/production/processProduction';

import { mergeSmallAreas } from '../utils/production/mergeSmallAreas';
import { deduplicateProductionPaths } from '../utils/production/deduplicatePaths';
import { buildGraphPaths, GraphPath, cleanGraphAreas } from '../utils/production/graphTraversal';
import { AlertCircle, Info, Scissors, Zap } from 'lucide-react';

interface V3ProductionTabProps {
  puzzleState: PuzzleState;
  onResolveConflicts: () => void;
}

export const V3ProductionTab: React.FC<V3ProductionTabProps> = ({ puzzleState, onResolveConflicts }) => {
  const [productionAreas, setProductionAreas] = useState<ProductionArea[]>([]);
  const [mergeThreshold, setMergeThreshold] = useState(100);
  const [deduplicate, setDeduplicate] = useState(true);
  const [flattenCurves, setFlattenCurves] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [graphPaths, setGraphPaths] = useState<GraphPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);
  const [singleLineMode, setSingleLineMode] = useState<'graph' | 'boolean'>('graph');
  const [booleanPaths, setBooleanPaths] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleReload = useCallback(() => {
    setIsProcessing(true);
    // Use setTimeout to allow UI to update before heavy processing
    setTimeout(() => {
      try {
        const processed = processProductionState(puzzleState, { flattenCurves });
        setProductionAreas(processed);
      } catch (e) {
        console.error('Production processing failed:', e);
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  }, [puzzleState, flattenCurves]);

  // Recompute single-line paths whenever areas, deduplicate, or mode changes
  useEffect(() => {
    if (!deduplicate || productionAreas.length === 0) {
      setGraphPaths([]);
      setBooleanPaths([]);
      setSelectedPathId(null);
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      try {
        if (singleLineMode === 'graph') {
          setGraphPaths(buildGraphPaths(productionAreas));
          setBooleanPaths([]);
        } else {
          setBooleanPaths(deduplicateProductionPaths(productionAreas));
          setGraphPaths([]);
        }
        setSelectedPathId(null);
      } catch (e) {
        console.error('Single-line processing failed:', e);
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  }, [productionAreas, deduplicate, singleLineMode]);

  const handleMerge = useCallback(() => {
    if (productionAreas.length === 0) return;
    const merged = mergeSmallAreas(productionAreas, mergeThreshold);
    setProductionAreas(merged);
  }, [productionAreas, mergeThreshold]);
  
  const handleCleanGraph = useCallback(() => {
    if (productionAreas.length === 0) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const cleaned = cleanGraphAreas(productionAreas);
        setProductionAreas(cleaned);
      } catch (e) {
        console.error('Graph cleaning failed:', e);
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  }, [productionAreas]);

  const handleDownloadSVG = useCallback(() => {
    if (productionAreas.length === 0) return;

    let pathsToExport: string[];

    if (deduplicate && singleLineMode === 'graph' && graphPaths.length > 0) {
      pathsToExport = graphPaths.map(gp => gp.svgPathData);
    } else if (deduplicate && singleLineMode === 'boolean' && booleanPaths.length > 0) {
      pathsToExport = booleanPaths;
    } else if (deduplicate) {
      pathsToExport = deduplicateProductionPaths(productionAreas); // fallback
    } else {
      pathsToExport = productionAreas.map(a => a.pathData);
    }

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${puzzleState.width} ${puzzleState.height}">
  <g fill="none" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    ${pathsToExport.map(pathData => `<path d="${pathData}" />`).join('\n    ')}
  </g>
</svg>
    `.trim();

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'puzzle-boundaries.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [productionAreas, puzzleState.width, puzzleState.height]);

  // Initial load
  useEffect(() => {
    if (productionAreas.length === 0 && Object.keys(puzzleState.areas).length > 0) {
      handleReload();
    }
  }, [handleReload, puzzleState.areas, productionAreas.length]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={handleReload}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing...' : 'Reload & Process'}
          </button>

          <div className="h-8 w-px bg-slate-200 mx-2" />

          <div className="flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={flattenCurves}
                onChange={e => setFlattenCurves(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">
                Flatten Curves
              </span>
            </label>

            <div className="w-px h-4 bg-slate-300" />

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={e => setDeduplicate(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">
                Single-line export
              </span>
            </label>

            {deduplicate && (
              <select
                value={singleLineMode}
                onChange={e => setSingleLineMode(e.target.value as 'graph' | 'boolean')}
                className="text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="graph">Graph traversal</option>
                <option value="boolean">Boolean dedup</option>
              </select>
            )}

            <div className="w-px h-4 bg-slate-300" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Merge Threshold</span>
              <input
                type="number"
                value={mergeThreshold}
                onChange={e => setMergeThreshold(Number(e.target.value))}
                className="w-20 px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={handleMerge}
                className="px-3 py-1 text-xs font-bold bg-slate-800 text-white rounded hover:bg-slate-900 transition-colors"
              >
                Merge Small
              </button>
            </div>

            <div className="w-px h-4 bg-slate-300" />

            <button
              onClick={handleCleanGraph}
              disabled={isProcessing || productionAreas.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-all text-xs font-bold uppercase tracking-wider"
              title="Remove dead-end edges (degree-1 nodes)"
            >
              <Scissors className="w-3.5 h-3.5" />
              Clean Graph
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right mr-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pieces</div>
            <div className="text-lg font-bold text-slate-700 tabular-nums">{productionAreas.length}</div>
          </div>
          <button
            onClick={onResolveConflicts}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all shadow-sm font-medium"
          >
            <Zap className="w-4 h-4" />
            Resolve Conflicts
          </button>
          <button
            onClick={handleDownloadSVG}
            disabled={productionAreas.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download SVG
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar: Stats & Info */}
        <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto p-4 shrink-0">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Production Stats</h3>
          
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pieces</div>
              <div className="text-2xl font-bold text-slate-700 tabular-nums">{productionAreas.length}</div>
            </div>

            {productionAreas.filter(a => a.area < mergeThreshold).length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Small Areas</div>
                </div>
                <div className="text-2xl font-bold text-amber-700 tabular-nums">
                  {productionAreas.filter(a => a.area < mergeThreshold).length}
                </div>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                  {productionAreas
                    .filter(a => a.area < mergeThreshold)
                    .sort((a, b) => a.area - b.area)
                    .map(a => (
                      <div key={a.id} className="text-[10px] flex justify-between text-amber-800 bg-white/50 px-1.5 py-0.5 rounded">
                        <span className="truncate mr-2">{a.id}</span>
                        <span className="font-mono">{Math.round(a.area)}px²</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3 h-3 text-indigo-600" />
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Export Info</div>
              </div>
              <p className="text-[10px] text-indigo-700 leading-relaxed">
                {deduplicate && graphPaths.length > 0
                  ? `Graph traversal found ${graphPaths.length} continuous paths. Click a path to highlight it.`
                  : deduplicate
                  ? "Single-line export enabled. Computing paths..."
                  : "Standard export enabled. Each piece is a closed loop (double lines on shared edges)."}
              </p>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-slate-100">
          <div className="relative bg-white shadow-2xl rounded-lg border border-slate-200 overflow-hidden" style={{ width: puzzleState.width, height: puzzleState.height }}>
          <svg
            width={puzzleState.width}
            height={puzzleState.height}
            viewBox={`0 0 ${puzzleState.width} ${puzzleState.height}`}
            className="w-full h-full"
          >
            <rect width={puzzleState.width} height={puzzleState.height} fill="#fff" />
            {deduplicate && singleLineMode === 'graph' && graphPaths.length > 0 ? (
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                {/* Invisible hit targets for easier clicking */}
                {graphPaths.map(gp => (
                  <path
                    key={`hit-${gp.id}`}
                    d={gp.svgPathData}
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onClick={() => setSelectedPathId(prev => prev === gp.id ? null : gp.id)}
                  />
                ))}
                {/* Visible paths */}
                {graphPaths.map(gp => {
                  const isSelected = selectedPathId === gp.id;
                  return (
                    <path
                      key={gp.id}
                      d={gp.svgPathData}
                      stroke={isSelected ? '#1e293b' : gp.color}
                      strokeWidth={isSelected ? 4 : 1.5}
                      style={{
                        cursor: 'pointer',
                        pointerEvents: 'none',
                        filter: isSelected ? 'drop-shadow(0 0 8px rgba(30, 41, 59, 0.8)) drop-shadow(0 0 12px rgba(30, 41, 59, 0.5))' : undefined
                      }}
                    />
                  );
                })}
              </g>
            ) : deduplicate && singleLineMode === 'boolean' && booleanPaths.length > 0 ? (
              <g fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {booleanPaths.map((d, i) => (
                  <path key={i} d={d} className="hover:stroke-indigo-500 hover:stroke-[3] transition-all cursor-help" />
                ))}
              </g>
            ) : (
              <g fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {productionAreas.map(area => (
                  <path
                    key={area.id}
                    d={area.pathData}
                    className="hover:stroke-indigo-500 hover:stroke-[3] transition-all cursor-help"
                  />
                ))}
              </g>
            )}
          </svg>
          
          {isProcessing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-bold text-slate-600 animate-pulse">Processing Geometry...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};
