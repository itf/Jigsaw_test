import React from 'react';
import { Grid, Hexagon, Shuffle, Link as LinkIcon, Download, RefreshCw, Trash2, X, Layers, Merge, Circle, Star, Sparkles, Plus } from 'lucide-react';
import { Tab } from '../../v2/constants';

interface V3ActionBarProps {
  activeTab: Tab;
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
  jitter: number;
  setJitter: (val: number) => void;
  onSubdivide: () => void;
  onValidateGrid: () => void;
  onCleanPuzzle: () => void;
  selectedIds: string[];
  onMerge: () => void;
  whimsyTemplate: 'circle' | 'star';
  setWhimsyTemplate: (t: 'circle' | 'star') => void;
  whimsyScale: number;
  setWhimsyScale: (v: number) => void;
  whimsyRotationDeg: number;
  setWhimsyRotationDeg: (v: number) => void;
  whimsyPlacementActive: boolean;
  startWhimsyPlacement: () => void;
  cancelWhimsyPlacement: () => void;
  connectionT: number;
  setConnectionT: (v: number) => void;
  connectionPathIndex: number;
  setConnectionPathIndex: (v: number) => void;
  maxPathIndex: number;
  connectorWidthPx: number;
  setConnectorWidthPx: (v: number) => void;
  connectorExtrusion: number;
  setConnectorExtrusion: (v: number) => void;
  connectorHeadTemplate: string;
  setConnectorHeadTemplate: (v: string) => void;
  connectorHeadScale: number;
  setConnectorHeadScale: (v: number) => void;
  connectorHeadRotation: number;
  setConnectorHeadRotation: (v: number) => void;
  connectorHeadOffset: number;
  setConnectorHeadOffset: (v: number) => void;
  useEquidistantHeadPoint: boolean;
  setUseEquidistantHeadPoint: (v: boolean) => void;
  onAddConnector: () => void;
  selectedConnectorId: string | null;
  onRemoveConnector: (id: string) => void;
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
    className={`${width} h-7 bg-slate-50 rounded-lg text-center text-[10px] font-bold border border-slate-100 outline-none focus:ring-1 focus:ring-indigo-500`}
  />
);

const Divider = () => <div className="w-px h-5 bg-slate-100 shrink-0" />;

export const V3ActionBar: React.FC<V3ActionBarProps> = ({
  activeTab,
  splitPattern,
  setSplitPattern,
  gridRows, setGridRows,
  gridCols, setGridCols,
  hexRows, setHexRows,
  hexCols, setHexCols,
  randomPoints, setRandomPoints,
  jitter, setJitter,
  onSubdivide,
  onValidateGrid,
  onCleanPuzzle,
  selectedIds,
  onMerge,
  whimsyTemplate,
  setWhimsyTemplate,
  whimsyScale,
  setWhimsyScale,
  whimsyRotationDeg,
  setWhimsyRotationDeg,
  whimsyPlacementActive,
  startWhimsyPlacement,
  cancelWhimsyPlacement,
  connectionT,
  setConnectionT,
  connectionPathIndex,
  setConnectionPathIndex,
  maxPathIndex,
  connectorWidthPx,
  setConnectorWidthPx,
  connectorExtrusion,
  setConnectorExtrusion,
  connectorHeadTemplate,
  setConnectorHeadTemplate,
  connectorHeadScale,
  setConnectorHeadScale,
  connectorHeadRotation,
  setConnectorHeadRotation,
  connectorHeadOffset,
  setConnectorHeadOffset,
  useEquidistantHeadPoint,
  setUseEquidistantHeadPoint,
  onAddConnector,
  selectedConnectorId,
  onRemoveConnector,
}) => {
  const canSubdivide = selectedIds.length > 0;

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
                className="h-7 px-2 rounded-lg text-[10px] font-bold border border-slate-100 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
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

            <div className="flex items-center gap-2">
              <Label>Jitter</Label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={jitter} 
                onChange={e => setJitter(Number(e.target.value))}
                className="w-16 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-[9px] font-mono font-bold text-slate-400 w-6">{jitter.toFixed(2)}</span>
            </div>

            <Divider />

            <button
              type="button"
              onClick={onSubdivide}
              disabled={!canSubdivide}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800"
            >
              {splitPattern === 'GRID' && <Grid className="w-3 h-3" />}
              {splitPattern === 'HEX' && <Hexagon className="w-3 h-3" />}
              {splitPattern === 'RANDOM' && <Shuffle className="w-3 h-3" />}
              <span className="text-[10px] font-bold uppercase">Split</span>
            </button>

            <button
              type="button"
              onClick={onValidateGrid}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Validate</span>
            </button>

            <button
              type="button"
              onClick={onCleanPuzzle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Clean</span>
            </button>

            <Divider />

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Label>Whimsy</Label>
              <button
                type="button"
                onClick={() => setWhimsyTemplate('circle')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all ${
                  whimsyTemplate === 'circle'
                    ? 'bg-violet-100 border-violet-400 text-violet-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-violet-300'
                }`}
              >
                <Circle className="w-3 h-3" />
                Circle
              </button>
              <button
                type="button"
                onClick={() => setWhimsyTemplate('star')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all ${
                  whimsyTemplate === 'star'
                    ? 'bg-violet-100 border-violet-400 text-violet-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-violet-300'
                }`}
              >
                <Star className="w-3 h-3" />
                Star
              </button>
              <Label>Scale</Label>
              <NumberInput value={whimsyScale} onChange={setWhimsyScale} min={8} max={800} width="w-12" />
              <Label>Rot°</Label>
              <NumberInput value={whimsyRotationDeg} onChange={setWhimsyRotationDeg} min={-360} max={360} width="w-12" />
              {!whimsyPlacementActive ? (
                <button
                  type="button"
                  onClick={startWhimsyPlacement}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 bg-violet-600 text-white text-[10px] font-bold uppercase hover:bg-violet-500"
                >
                  <Sparkles className="w-3 h-3 opacity-90" />
                  Add whimsy
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-violet-700 font-semibold max-w-[140px] leading-tight">
                    Move over puzzle · click to place · Esc
                  </span>
                  <button
                    type="button"
                    onClick={cancelWhimsyPlacement}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 bg-slate-200 text-slate-800 text-[10px] font-bold uppercase hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <Divider />

            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <button
                type="button"
                onClick={onMerge}
                disabled={selectedIds.length < 2}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 bg-amber-600 text-white text-[10px] font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-500"
              >
                <Merge className="w-3 h-3" />
                Merge
              </button>
            </div>
          </>
        )}

        {activeTab === 'MODIFICATION' && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-slate-600 bg-slate-50 rounded-xl shrink-0">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-tight">Modification</span>
          </div>
        )}

        {activeTab === 'CONNECTION' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 text-emerald-600 bg-emerald-50 rounded-xl shrink-0">
              <LinkIcon className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-tight">Connectors</span>
            </div>

            <Divider />

            <div className="flex items-center gap-2">
              <Label>Position (t)</Label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.001" 
                value={connectionT} 
                onChange={e => setConnectionT(Number(e.target.value))}
                className="w-24 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <span className="text-[9px] font-mono font-bold text-slate-400 w-8">{connectionT.toFixed(3)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Label>Width (px)</Label>
              <NumberInput value={connectorWidthPx} onChange={setConnectorWidthPx} min={4} max={200} width="w-12" />
            </div>

            <div className="flex items-center gap-2">
              <Label>Extrude</Label>
              <NumberInput value={connectorExtrusion} onChange={setConnectorExtrusion} min={1} max={200} width="w-10" />
            </div>

            <div className="flex items-center gap-2">
              <Label>Head</Label>
              <select
                value={connectorHeadTemplate}
                onChange={e => setConnectorHeadTemplate(e.target.value)}
                className="h-7 px-2 rounded-lg text-[10px] font-bold border border-slate-100 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="circle">Circle</option>
                <option value="star">Star</option>
                <option value="square">Square</option>
                <option value="triangle">Triangle</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label>Scale</Label>
              <NumberInput value={connectorHeadScale} onChange={setConnectorHeadScale} min={0.1} max={5} width="w-10" />
            </div>

            <div className="flex items-center gap-2">
              <Label>Rot°</Label>
              <NumberInput value={connectorHeadRotation} onChange={setConnectorHeadRotation} min={-360} max={360} width="w-10" />
            </div>

            <div className="flex items-center gap-2">
              <Label>Offset</Label>
              <NumberInput value={connectorHeadOffset} onChange={setConnectorHeadOffset} min={-100} max={100} width="w-10" />
            </div>

            <div className="flex items-center gap-2">
              <Label>Equidistant</Label>
              <input 
                type="checkbox" 
                checked={useEquidistantHeadPoint} 
                onChange={e => setUseEquidistantHeadPoint(e.target.checked)}
                className="w-4 h-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {maxPathIndex > 0 && (
              <div className="flex items-center gap-2">
                <Label>Path</Label>
                <NumberInput 
                  value={connectionPathIndex} 
                  onChange={setConnectionPathIndex} 
                  min={0} 
                  max={maxPathIndex} 
                  width="w-8" 
                />
              </div>
            )}

            <button
              type="button"
              onClick={onAddConnector}
              disabled={selectedIds.length !== 1 || !!selectedConnectorId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0 bg-emerald-600 text-white text-[10px] font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-500"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>

            {selectedConnectorId && (
              <button
                type="button"
                onClick={() => onRemoveConnector(selectedConnectorId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0 bg-rose-600 text-white text-[10px] font-bold uppercase hover:bg-rose-500"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>
        )}

        {activeTab === 'PRODUCTION' && (
          <button
            type="button"
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> Export SVG (Coming Soon)
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Selection ({selectedIds.length})
            </span>
            <button type="button" className="p-1 hover:bg-slate-200 rounded-full text-slate-400">
              <X size={12} />
            </button>
          </div>
          <Divider />
          <div className="flex flex-col shrink-0">
            <span className="text-[8px] text-slate-400 uppercase font-bold">IDs</span>
            <span className="text-[10px] font-mono font-bold text-indigo-600 truncate max-w-[300px]">
              {selectedIds.join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
