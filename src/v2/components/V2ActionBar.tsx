import React from 'react';
import { Grid, Hexagon, Shuffle, Link as LinkIcon, Download, RefreshCw, Trash2, X, Layers, Merge } from 'lucide-react';
import { Tab } from '../constants';
import { Connector } from '../types';

interface V2ActionBarProps {
  activeTab: Tab;
  splittingHint: string | null;
  canSubdivide: boolean;
  splitPattern: 'GRID' | 'HEX' | 'RANDOM';
  setSplitPattern: (p: 'GRID' | 'HEX' | 'RANDOM') => void;
  gridRows: number;
  setGridRows: (val: number) => void;
  gridCols: number;
  setGridCols: (val: number) => void;
  hexRows: number;
  setHexRows: (val: number) => void;
  hexCols: number;
  setHexCols: (val: number) => void;
  randomPoints: number;
  setRandomPoints: (val: number) => void;
  subdivideSelectedPieces: () => void;
  selectedId: string | null;
  selectedType: 'AREA' | 'CONNECTOR' | 'NONE';
  selectionData: any;
  mergePickIds: string[];
  mergeSelectedPieces: () => void;
  deletePiece: (areaId: string) => void;
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
  splittingHint,
  canSubdivide,
  splitPattern,
  setSplitPattern,
  gridRows, setGridRows,
  gridCols, setGridCols,
  hexRows, setHexRows,
  hexCols, setHexCols,
  randomPoints, setRandomPoints,
  subdivideSelectedPieces,
  selectedId,
  selectedType,
  selectionData,
  mergePickIds,
  mergeSelectedPieces,
  deletePiece,
  onUpdateConnector,
  onDeleteOperation,
  onClearSelection,
}) => {
  const runSplit = () => {
    if (canSubdivide) subdivideSelectedPieces();
  };

  return (
    <div className="bg-white border-b border-slate-200 z-30 shrink-0">

      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">

        {activeTab === 'TOPOLOGY' && (
          <>
            <div className="flex items-center gap-2 shrink-0">
              <Label>Split</Label>
              <select
                value={splitPattern}
                onChange={e => setSplitPattern(e.target.value as 'GRID' | 'HEX' | 'RANDOM')}
                className="h-7 px-2 rounded-lg text-[10px] font-bold border border-slate-100 bg-slate-50 text-slate-700"
              >
                <option value="GRID">Grid</option>
                <option value="HEX">Hex lattice</option>
                <option value="RANDOM">Random</option>
              </select>
            </div>

            {splitPattern === 'GRID' && (
              <div className="flex items-center gap-2">
                <Label>Size</Label>
                <NumberInput value={gridRows} onChange={setGridRows} min={1} max={50} width="w-8" />
                <span className="text-slate-300 text-[10px]">×</span>
                <NumberInput value={gridCols} onChange={setGridCols} min={1} max={50} width="w-8" />
              </div>
            )}

            {splitPattern === 'HEX' && (
              <div className="flex items-center gap-2">
                <Label>Size</Label>
                <NumberInput value={hexRows} onChange={setHexRows} min={1} max={50} width="w-8" />
                <span className="text-slate-300 text-[10px]">×</span>
                <NumberInput value={hexCols} onChange={setHexCols} min={1} max={50} width="w-8" />
              </div>
            )}

            {splitPattern === 'RANDOM' && (
              <div className="flex items-center gap-2">
                <Label>Points</Label>
                <NumberInput value={randomPoints} onChange={setRandomPoints} min={2} max={500} width="w-10" />
              </div>
            )}

            <Divider />

            <button
              type="button"
              onClick={runSplit}
              disabled={!canSubdivide}
              title={!canSubdivide ? 'Tap leaf pieces to select, then split (applies to each selected)' : undefined}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800"
            >
              {splitPattern === 'GRID' && <Grid className="w-3 h-3" />}
              {splitPattern === 'HEX' && <Hexagon className="w-3 h-3" />}
              {splitPattern === 'RANDOM' && <Shuffle className="w-3 h-3" />}
              <span className="text-[10px] font-bold uppercase">Split</span>
            </button>

            <Divider />

            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="flex items-center gap-2 px-3 py-1.5 text-amber-700 bg-amber-50 rounded-xl shrink-0 max-w-[min(100%,420px)]">
                <Merge className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] font-semibold leading-snug">
                  Tap a piece to select; tap again to deselect. Split runs on every selected piece. Merge needs two or more selected.
                </span>
              </div>
              <button
                type="button"
                onClick={mergeSelectedPieces}
                disabled={mergePickIds.length < 2}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 bg-amber-600 text-white text-[10px] font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-500"
              >
                <Merge className="w-3 h-3" />
                Merge
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = selectedId ?? (mergePickIds.length === 1 ? mergePickIds[0] : null);
                  if (t) deletePiece(t);
                }}
                disabled={!selectedId && mergePickIds.length !== 1}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 bg-slate-700 text-white text-[10px] font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600"
                title="Merge the chosen piece with all neighboring pieces (removes its internal edges)"
              >
                <Trash2 className="w-3 h-3" />
                Delete piece
              </button>
            </div>

            {mergePickIds.length > 0 && splittingHint && (
              <>
                <Divider />
                <span className="text-[9px] text-slate-400">
                  split target{mergePickIds.length > 1 ? 's' : ''}:{' '}
                  <span className="font-bold text-indigo-600 font-mono">{splittingHint}</span>
                </span>
              </>
            )}
          </>
        )}

        {activeTab === 'MODIFICATION' && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-slate-600 bg-slate-50 rounded-xl shrink-0">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-tight">Modification</span>
          </div>
        )}

        {activeTab === 'CONNECTION' && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-emerald-600 bg-emerald-50 rounded-xl shrink-0">
            <LinkIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-tight">Click edges to add tabs</span>
          </div>
        )}

        {activeTab === 'PRODUCTION' && (
          <button type="button" className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> Export SVG
          </button>
        )}
      </div>

      {selectedId && selectedType !== 'NONE' && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-2 h-2 rounded-full ${selectedType === 'AREA' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {selectedType === 'AREA' ? 'Area' : 'Connector'}
            </span>
            <button type="button" onClick={onClearSelection} className="p-1 hover:bg-slate-200 rounded-full text-slate-400">
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

              {activeTab === 'TOPOLOGY' && selectionData?.isPiece && (
                <>
                  <Divider />
                  <button
                    type="button"
                    onClick={() => deletePiece(selectedId!)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase">Delete piece</span>
                  </button>
                </>
              )}
            </>
          ) : (
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
                type="button"
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
                type="button"
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
