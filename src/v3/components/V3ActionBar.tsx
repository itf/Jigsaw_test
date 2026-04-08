import React, { useState } from 'react';
import { Grid, Hexagon, Shuffle, Link as LinkIcon, Download, RefreshCw, Trash2, X, Layers, Merge, Circle, Star, Sparkles, Plus, Book, Network, Crop } from 'lucide-react';
import { Tab } from '../../v2/constants';
import { WheelSlider } from './ui/WheelSlider';
import { WhimsyLibrary } from './WhimsyLibrary';
import { Whimsy } from '../types';
import { V3MassConnectionTab } from './V3MassConnectionTab';

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
  whimsyTemplate: string;
  setWhimsyTemplate: (t: string) => void;
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
  useEquidistantHeadPoint: boolean;
  setUseEquidistantHeadPoint: (v: boolean) => void;
  onAddConnector: () => void;
  selectedConnectorId: string | null;
  onRemoveConnector: (id: string) => void;
  connectorJitter: number;
  setConnectorJitter: (v: number) => void;
  onAddMassConnectors: (params: any) => void;
  onPreviewMassConnectors: (params: any) => void;
  onCommitPreviewConnectors: () => void;
  hasPreview: boolean;
  onResolveConflicts: () => void;
  whimsies: Whimsy[];
  onUploadWhimsy: (w: Whimsy) => void;
  onRemoveWhimsy: (id: string) => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
  rectSelectMode: boolean;
  onToggleRectSelect: () => void;
  massHeadIds: string[];
  setMassHeadIds: (ids: string[]) => void;
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
  useEquidistantHeadPoint,
  setUseEquidistantHeadPoint,
  onAddConnector,
  selectedConnectorId,
  onRemoveConnector,
  connectorJitter,
  setConnectorJitter,
  onAddMassConnectors,
  onPreviewMassConnectors,
  onCommitPreviewConnectors,
  hasPreview,
  onResolveConflicts,
  whimsies,
  onUploadWhimsy,
  onRemoveWhimsy,
  onSelectAll,
  onUnselectAll,
  rectSelectMode,
  onToggleRectSelect,
  massHeadIds,
  setMassHeadIds,
}) => {
  const [showWhimsyLibrary, setShowWhimsyLibrary] = useState(false);
  const [libraryMode, setLibraryMode] = useState<'WHIMSY' | 'CONNECTOR'>('WHIMSY');

  const canSubdivide = selectedIds.length > 0;

  const currentWhimsy = whimsies.find(w => w.id === whimsyTemplate);
  const currentConnectorHead = whimsies.find(w => w.id === connectorHeadTemplate);

  return (
    <div className="bg-white border-b border-slate-200 z-30 shrink-0 relative">
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
                step="0.01" 
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
            <button
              type="button"
              onClick={onSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Layers className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">All</span>
            </button>
            <button
              type="button"
              onClick={onUnselectAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <X className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">None</span>
            </button>
            <button
              type="button"
              onClick={onToggleRectSelect}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 ${rectSelectMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Crop className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Rect</span>
            </button>

            <Divider />

            <div className="flex items-center gap-4 flex-wrap shrink-0">
              <div className="flex items-center gap-2">
                <Label>Whimsy</Label>
                <button
                  type="button"
                  onClick={() => { setShowWhimsyLibrary(!showWhimsyLibrary); setLibraryMode('WHIMSY'); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                    showWhimsyLibrary && libraryMode === 'WHIMSY'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {currentWhimsy ? (
                    <svg viewBox="0 0 100 100" className="w-3 h-3">
                      <path d={currentWhimsy.svgData} fill="currentColor" />
                    </svg>
                  ) : <Book className="w-3 h-3" />}
                  {currentWhimsy?.name || 'Library'}
                </button>
              </div>

              <WheelSlider 
                label="Scale" 
                value={whimsyScale} 
                onChange={setWhimsyScale} 
                min={8} 
                max={800} 
                width="w-36" 
              />
              
              <div className="flex items-center gap-2">
                <Label>Rotation</Label>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  step="1" 
                  value={whimsyRotationDeg} 
                  onChange={e => setWhimsyRotationDeg(Number(e.target.value))}
                  className="w-16 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-[9px] font-mono font-bold text-slate-400 w-8">{whimsyRotationDeg}°</span>
              </div>

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
          <div className="flex items-center gap-4 flex-wrap">
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
                className="w-20 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <span className="text-[9px] font-mono font-bold text-slate-400 w-8">{connectionT.toFixed(3)}</span>
            </div>

            <WheelSlider 
              label="Width" 
              value={connectorWidthPx} 
              onChange={setConnectorWidthPx} 
              min={4} 
              max={200} 
              unit="px"
              width="w-36" 
            />

            <WheelSlider 
              label="Extrude" 
              value={connectorExtrusion} 
              onChange={setConnectorExtrusion} 
              min={1} 
              max={200} 
              width="w-36" 
            />

            <div className="flex items-center gap-2">
              <Label>Head</Label>
              <button
                type="button"
                onClick={() => { setShowWhimsyLibrary(!showWhimsyLibrary); setLibraryMode('CONNECTOR'); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                  showWhimsyLibrary && libraryMode === 'CONNECTOR'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                }`}
              >
                {currentConnectorHead ? (
                  <svg viewBox="0 0 100 100" className="w-3 h-3">
                    <path d={currentConnectorHead.svgData} fill="currentColor" />
                  </svg>
                ) : <Book className="w-3 h-3" />}
                {currentConnectorHead?.name || 'Library'}
              </button>
            </div>

            <WheelSlider 
              label="Scale" 
              value={connectorHeadScale} 
              onChange={setConnectorHeadScale} 
              min={0.1} 
              max={5} 
              step={0.1}
              width="w-36" 
            />

            <div className="flex items-center gap-2">
              <Label>Rotation</Label>
              <input 
                type="range" 
                min="0" 
                max="360" 
                step="1" 
                value={connectorHeadRotation} 
                onChange={e => setConnectorHeadRotation(Number(e.target.value))}
                className="w-16 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <span className="text-[9px] font-mono font-bold text-slate-400 w-8">{connectorHeadRotation}°</span>
            </div>

            <div className="flex items-center gap-2">
              <Label>Jitter</Label>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.1" 
                value={connectorJitter} 
                onChange={e => setConnectorJitter(Number(e.target.value))}
                className="w-16 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <span className="text-[9px] font-mono font-bold text-slate-400 w-8">{connectorJitter.toFixed(1)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Label>Closest Point</Label>
              <input 
                type="checkbox" 
                checked={!useEquidistantHeadPoint} 
                onChange={e => setUseEquidistantHeadPoint(!e.target.checked)}
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
          <div className="flex items-center gap-2 px-3 py-1.5 text-emerald-600 bg-emerald-50 rounded-xl shrink-0">
            <Download className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-tight">Production</span>
          </div>
        )}
      </div>

      {/* Whimsy Library Popover */}
      {showWhimsyLibrary && (
        <div className="absolute top-full left-4 mt-2 w-72 h-96 z-50 shadow-2xl">
          <WhimsyLibrary 
            whimsies={whimsies}
            selectedId={libraryMode === 'WHIMSY' ? whimsyTemplate : connectorHeadTemplate}
            onSelect={(w) => {
              if (libraryMode === 'WHIMSY') setWhimsyTemplate(w.id);
              else setConnectorHeadTemplate(w.id);
              setShowWhimsyLibrary(false);
            }}
            onUpload={onUploadWhimsy}
            onRemove={onRemoveWhimsy}
          />
        </div>
      )}

      {activeTab === 'MASS_CONNECTION' && (
        <V3MassConnectionTab
          selectedIds={selectedIds}
          whimsies={whimsies}
          selectedHeadIds={massHeadIds}
          setSelectedHeadIds={setMassHeadIds}
          onAddMassConnectors={onAddMassConnectors}
          onPreviewMassConnectors={onPreviewMassConnectors}
          onCommitPreviewConnectors={onCommitPreviewConnectors}
          hasPreview={hasPreview}
          onResolveConflicts={onResolveConflicts}
          onSelectAll={onSelectAll}
          onUnselectAll={onUnselectAll}
          rectSelectMode={rectSelectMode}
          onToggleRectSelect={onToggleRectSelect}
        />
      )}

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
