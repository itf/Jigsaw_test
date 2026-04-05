import React from 'react';
import { Grid, Hexagon, Shuffle, Link as LinkIcon, Zap, Download, RefreshCw, Trash2, X } from 'lucide-react';
import { Tab } from '../constants';
import { Connector } from '../types';

interface V2ActionBarProps {
  activeTab: Tab;
  isMobile: boolean;
  // Subdivision
  subdivideTargetId: string;     // which area the split buttons will act on
  canSubdivide: boolean;         // false if target already has children
  gridRows: number;
  setGridRows: (val: number) => void;
  gridCols: number;
  setGridCols: (val: number) => void;
  hexSize: number;
  setHexSize: (val: number) => void;
  randomPoints: number;
  setRandomPoints: (val: number) => void;
  subdivide: (parentId: string, pattern: string) => void;
  // Selection
  selectedId: string | null;
  selectedType: 'AREA' | 'CONNECTOR' | 'NONE';
  selectionData: any;
  mergeSelection: string | null;
  setMergeSelection: (val: string | null) => void;
  onUpdateConnector: (id: string, updates: Partial<Connector>) => void;
  onDeleteOperation: (id: string) => void;
  onClearSelection: () => void;
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter whitespace-nowrap">{children}</span>
);

const NumberInput: React.FC<{
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; width?: string;
}> = ({ value, onChange, min, max, width = 'w-14' }) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    onChange={e => onChange(Number(e.target.value))}
    className={`${width} h-7 bg-slate-50 rounded-lg text-center text-[10px] font-bold border border-slate-100`}
  />
);

const Divider = () => <div className="w-px h-5 bg-slate-100 shrink-0" />;

export const V2ActionBar: React.FC<V2ActionBarProps> = ({
  activeTab,
  isMobile,
  subdivideTargetId,
  canSubdivide,
  gridRows, setGridRows,
  gridCols, setGridCols,
  hexSize, setHexSize,
  randomPoints, setRandomPoints,
  subdivide,
  selectedId,
  selectedType,
  selectionData,
  mergeSelection,
  setMergeSelection,
  onUpdateConnector,
  onDeleteOperation,
  onClearSelection,
}) => {
  const splitBtn = (pattern: string, icon: React.ReactNode, label: string, primary = false) => (
    <button
      onClick={() => canSubdivide && subdivide(subdivideTargetId, pattern)}
      disabled={!canSubdivide}
      title={!canSubdivide ? 'Selected area is already subdivided' : undefined}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
        primary
          ? 'bg-slate-900 text-white hover:bg-slate-800'
          : 'hover:bg-indigo-50 text-indigo-600'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );

  return (
    <div className="bg-white border-b border-slate-200 z-30 shrink-0">

      {/* ── Row 1: Tab-level controls (always visible) ── */}
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">

        {activeTab === 'TOPOLOGY' && (
          <>
            <div className="flex items-center gap-2">
              <Label>Grid</Label>
              <NumberInput value={gridRows} onChange={setGridRows} min={1} max={50} width="w-8" />
              <span className="text-slate-300 text-[10px]">×</span>
              <NumberInput value={gridCols} onChange={setGridCols} min={1} max={50} width="w-8" />
              {splitBtn('GRID', <Grid className="w-3 h-3" />, 'Split')}
            </div>

            <Divider />

            <div className="flex items-center gap-2">
              <Label>Hex</Label>
              <NumberInput value={hexSize} onChange={setHexSize} min={10} max={300} width="w-10" />
              {splitBtn('HEX', <Hexagon className="w-3 h-3" />, 'Split')}
            </div>

            <Divider />

            <div className="flex items-center gap-2">
              <Label>Random</Label>
              <NumberInput value={randomPoints} onChange={setRandomPoints} min={2} max={500} width="w-10" />
              {splitBtn('RANDOM', <Shuffle className="w-3 h-3" />, 'Split', true)}
            </div>

            {/* Show which area will be subdivided */}
            {selectedType === 'AREA' && (
              <>
                <Divider />
                <span className="text-[9px] text-slate-400">
                  splitting <span className="font-bold text-indigo-600 font-mono">{subdivideTargetId === 'root' ? 'root' : subdivideTargetId.split('-').slice(-2).join('-')}</span>
                </span>
              </>
            )}
          </>
        )}

        {activeTab === 'MODIFICATION' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 text-amber-600 bg-amber-50 rounded-xl shrink-0">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-tight">
                {mergeSelection ? 'Select second area to merge' : 'Click two areas to merge them'}
              </span>
            </div>
            {mergeSelection && (
              <button
                onClick={() => setMergeSelection(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {activeTab === 'CONNECTION' && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-emerald-600 bg-emerald-50 rounded-xl shrink-0">
            <LinkIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-tight">Click edges to add tabs</span>
          </div>
        )}

        {activeTab === 'PRODUCTION' && (
          <button className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> Export SVG
          </button>
        )}
      </div>

      {/* ── Row 2: Selection panel (only when something is selected) ── */}
      {selectedId && selectedType !== 'NONE' && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50 flex-wrap">
          {/* Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-2 h-2 rounded-full ${selectedType === 'AREA' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {selectedType === 'AREA' ? 'Area' : 'Connector'}
            </span>
            <button onClick={onClearSelection} className="p-1 hover:bg-slate-200 rounded-full text-slate-400">
              <X size={12} />
            </button>
          </div>

          <Divider />

          {selectedType === 'AREA' ? (
            <>
              <div className="flex flex-col shrink-0">
                <span className="text-[8px] text-slate-400 uppercase font-bold">ID</span>
                <span className="text-[10px] font-mono font-bold text-indigo-600 truncate max-w-[140px]">{selectedId}</span>
              </div>
              <div className="flex flex-col shrink-0">
                <span className="text-[8px] text-slate-400 uppercase font-bold">Status</span>
                <span className={`text-[10px] font-bold ${selectionData?.isPiece ? 'text-green-600' : 'text-amber-600'}`}>
                  {selectionData?.isPiece ? 'Leaf (splittable)' : 'Has children'}
                </span>
              </div>

              {activeTab === 'MODIFICATION' && (
                <>
                  <Divider />
                  <button
                    onClick={() => setMergeSelection(selectedId)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 ${
                      mergeSelection === selectedId
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase">
                      {mergeSelection === selectedId ? 'Merging…' : 'Merge'}
                    </span>
                  </button>
                </>
              )}
            </>
          ) : (
            /* Connector editor */
            <>
              <div className="flex items-center gap-3 min-w-[160px]">
                <Label>Pos</Label>
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={selectionData?.u || 0}
                  onChange={e => onUpdateConnector(selectedId, { u: Number(e.target.value) })}
                  className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[10px] font-mono font-bold text-emerald-600 w-8">
                  {(selectionData?.u || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-3 min-w-[140px]">
                <Label>Size</Label>
                <input
                  type="range" min="10" max="100" step="1"
                  value={selectionData?.size || 20}
                  onChange={e => onUpdateConnector(selectedId, { size: Number(e.target.value) })}
                  className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[10px] font-mono font-bold text-emerald-600 w-10">
                  {selectionData?.size}px
                </span>
              </div>
              <Divider />
              <button
                onClick={() => onUpdateConnector(selectedId, { isFlipped: !selectionData?.isFlipped })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 ${
                  selectionData?.isFlipped
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 text-slate-500 hover:text-emerald-500'
                }`}
              >
                <RefreshCw size={12} />
                <span className="text-[10px] font-bold uppercase">Flip</span>
              </button>
              <button
                onClick={() => onDeleteOperation(selectedId)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all shrink-0"
              >
                <Trash2 size={12} />
                <span className="text-[10px] font-bold uppercase">Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
