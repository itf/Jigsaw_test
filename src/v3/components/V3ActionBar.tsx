import React, { useState } from 'react';
import { Grid, Hexagon, Shuffle, Link as LinkIcon, Download, RefreshCw, Trash2, X, Layers, Merge, Circle, Star, Sparkles, Plus, Book, Network, Crop, Copy } from 'lucide-react';
import { Tab } from '../../v2/constants';
import { InfiniteSlider } from './controls/InfiniteSlider';
import { WhimsyLibrary } from './WhimsyLibrary';
import { Whimsy, NeckShape } from '../types';
import { V3MassConnectionTab } from './V3MassConnectionTab';
import { StampPanel } from './StampPanel';
import { Area } from '../types';

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
  connectorNeckShape: NeckShape;
  setConnectorNeckShape: (v: NeckShape) => void;
  connectorNeckCurvature: number;
  setConnectorNeckCurvature: (v: number) => void;
  connectorExtrusionCurvature: number;
  setConnectorExtrusionCurvature: (v: number) => void;
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
  massWidthRange: [number, number];
  setMassWidthRange: (val: [number, number]) => void;
  massWidthRelative: boolean;
  setMassWidthRelative: (val: boolean) => void;
  massExtrusionRange: [number, number];
  setMassExtrusionRange: (val: [number, number]) => void;
  massExtrusionRelative: boolean;
  setMassExtrusionRelative: (val: boolean) => void;
  massPositionRange: [number, number];
  setMassPositionRange: (val: [number, number]) => void;
  massHeadScaleRange: [number, number];
  setMassHeadScaleRange: (val: [number, number]) => void;
  massHeadScaleRelative: boolean;
  setMassHeadScaleRelative: (val: boolean) => void;
  massUseActualAreaForScale: boolean;
  setMassUseActualAreaForScale: (val: boolean) => void;
  massHeadRotationRange: [number, number];
  setMassHeadRotationRange: (val: [number, number]) => void;
  massJitterRange: [number, number];
  setMassJitterRange: (val: [number, number]) => void;
  massNeckShapes: NeckShape[];
  setMassNeckShapes: (val: NeckShape[]) => void;
  // Stamp props
  areas: Record<string, Area>;
  onCreateStamp: (name: string, pieceIds: string[], includeNonAdjacentConnectors: boolean) => void;
  onPlaceStamp: (sourceGroupId: string) => void;
  onDeleteStampSource: (sourceGroupId: string, mode: 'delete' | 'convert') => void;
  onRefreshStamps: () => void;
  // V5 Graph props
  useGraphMode?: boolean;
  onDeleteEdge?: (id: string) => void;
  onSplitFace?: (faceId: string, direction: 'HORIZONTAL' | 'VERTICAL') => void;
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
  connectorNeckShape,
  setConnectorNeckShape,
  connectorNeckCurvature,
  setConnectorNeckCurvature,
  connectorExtrusionCurvature,
  setConnectorExtrusionCurvature,
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
  massWidthRange,
  setMassWidthRange,
  massWidthRelative,
  setMassWidthRelative,
  massExtrusionRange,
  setMassExtrusionRange,
  massExtrusionRelative,
  setMassExtrusionRelative,
  massPositionRange,
  setMassPositionRange,
  massHeadScaleRange,
  setMassHeadScaleRange,
  massHeadScaleRelative,
  setMassHeadScaleRelative,
  massUseActualAreaForScale,
  setMassUseActualAreaForScale,
  massHeadRotationRange,
  setMassHeadRotationRange,
  massJitterRange,
  setMassJitterRange,
  massNeckShapes,
  setMassNeckShapes,
  areas,
  onCreateStamp,
  onPlaceStamp,
  onDeleteStampSource,
  onRefreshStamps,
  useGraphMode,
  onDeleteEdge,
  onSplitFace,
}) => {
  const [showWhimsyLibrary, setShowWhimsyLibrary] = useState(false);
  const [libraryMode, setLibraryMode] = useState<'WHIMSY' | 'CONNECTOR'>('WHIMSY');
  const [showStampPanel, setShowStampPanel] = useState(false);

  const canSubdivide = selectedIds.length > 0;

  const currentWhimsy = whimsies.find(w => w.id === whimsyTemplate);
  const currentConnectorHead = whimsies.find(w => w.id === connectorHeadTemplate);

  return (
    <div className="bg-white border-b border-slate-200 z-30 shrink-0 relative">
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">
        {activeTab === 'TOPOLOGY' && (
          <>
            <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800"
            >
              {splitPattern === 'GRID' && <Grid className="w-3 h-3" />}
              {splitPattern === 'HEX' && <Hexagon className="w-3 h-3" />}
              {splitPattern === 'RANDOM' && <Shuffle className="w-3 h-3" />}
              <span className="text-[10px] font-bold uppercase">Split</span>
            </button>

            <button
              type="button"
              onClick={onValidateGrid}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Validate</span>
            </button>

            <button
              type="button"
              onClick={onCleanPuzzle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Clean</span>
            </button>

            <Divider />
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-1 py-0.5">
              <button
                type="button"
                onClick={onSelectAll}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:bg-white hover:shadow-sm text-slate-700"
                title="Select All"
              >
                <Layers className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase">All</span>
              </button>
              <button
                type="button"
                onClick={onUnselectAll}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:bg-white hover:shadow-sm text-slate-700"
                title="Unselect All"
              >
                <X className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase">None</span>
              </button>
              <button
                type="button"
                onClick={onToggleRectSelect}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${rectSelectMode ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-white hover:shadow-sm text-slate-700'}`}
                title="Rectangle Select"
              >
                <Crop className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase">Rect</span>
              </button>
              
              {selectedIds.length > 0 && (
                <>
                  <div className="w-px h-3 bg-slate-200 mx-0.5" />
                  <div className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black">{selectedIds.length}</span>
                  </div>
                </>
              )}
            </div>

            <Divider />

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 relative">
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
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {currentWhimsy ? (
                      <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-full h-full">
                        <path d={currentWhimsy.svgData} fill="currentColor" />
                      </svg>
                    ) : <Book className="w-3 h-3" />}
                  </div>
                  <span className="truncate max-w-[80px]">{currentWhimsy?.name || 'Library'}</span>
                </button>

                {showWhimsyLibrary && libraryMode === 'WHIMSY' && (
                  <div className="absolute top-full left-0 mt-2 w-72 h-96 z-50 shadow-2xl">
                    <WhimsyLibrary 
                      whimsies={whimsies}
                      selectedId={whimsyTemplate}
                      onSelect={(w) => {
                        setWhimsyTemplate(w.id);
                        startWhimsyPlacement();
                        setShowWhimsyLibrary(false);
                      }}
                      onUpload={onUploadWhimsy}
                      onRemove={onRemoveWhimsy}
                    />
                  </div>
                )}
              </div>

              <InfiniteSlider 
                label="Scale" 
                value={whimsyScale} 
                onChange={setWhimsyScale} 
                min={8} 
                max={800} 
                width="w-32" 
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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold uppercase hover:bg-violet-500"
                >
                  <Sparkles className="w-3 h-3 opacity-90" />
                  Add whimsy
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-violet-700 font-semibold max-w-[140px] leading-tight">
                    Move over puzzle · click to place · Esc
                  </span>
                  <button
                    type="button"
                    onClick={cancelWhimsyPlacement}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-[10px] font-bold uppercase hover:bg-slate-300"
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-500"
              >
                <Merge className="w-3 h-3" />
                Merge
              </button>

              {useGraphMode && selectedIds.length === 1 && selectedIds[0].startsWith('edge-') && (
                <button
                  type="button"
                  onClick={() => onDeleteEdge?.(selectedIds[0])}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold uppercase hover:bg-rose-500"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Edge
                </button>
              )}

              {useGraphMode && selectedIds.length === 1 && selectedIds[0].startsWith('face-') && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSplitFace?.(selectedIds[0], 'HORIZONTAL')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase hover:bg-indigo-500"
                  >
                    Split H
                  </button>
                  <button
                    type="button"
                    onClick={() => onSplitFace?.(selectedIds[0], 'VERTICAL')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase hover:bg-indigo-500"
                  >
                    Split V
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'MODIFICATION' && (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 text-slate-600 bg-slate-50 rounded-xl shrink-0">
              <Layers className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-tight">Modification</span>
            </div>

            <Divider />

            <div className="relative">
              <button
                onClick={() => setShowStampPanel(prev => !prev)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[10px] font-bold transition-colors ${
                  showStampPanel
                    ? 'bg-violet-600 text-white'
                    : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                }`}
              >
                <Copy className="w-3 h-3" />
                Stamps ({(Object.values(areas) as Area[]).filter(a => a.stampName).length})
              </button>

              {showStampPanel && activeTab === 'MODIFICATION' && (
                <div className="absolute top-full left-0 mt-2 z-50 shadow-2xl">
                  <StampPanel
                    areas={areas}
                    selectedIds={selectedIds}
                    onCreateStamp={onCreateStamp}
                    onPlaceStamp={onPlaceStamp}
                    onDeleteStampSource={onDeleteStampSource}
                    onRefreshStamps={onRefreshStamps}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'CONNECTION' && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 text-emerald-600 bg-emerald-50 rounded-xl">
              <LinkIcon className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-tight">Connectors</span>
            </div>

            <Divider />

            <div className="flex items-center gap-2">
              <Label>Position</Label>
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

            <InfiniteSlider 
              label="Width" 
              value={connectorWidthPx} 
              onChange={setConnectorWidthPx} 
              min={4} 
              max={500} 
              unit="px"
              width="w-24" 
            />

            <InfiniteSlider 
              label="Extrude" 
              value={connectorExtrusion} 
              onChange={setConnectorExtrusion} 
              min={1} 
              max={500} 
              width="w-24" 
              unit="px"
            />

            <div className="flex items-center gap-2 relative">
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
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {currentConnectorHead ? (
                    <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-full h-full">
                      <path d={currentConnectorHead.svgData} fill="currentColor" />
                    </svg>
                  ) : <Book className="w-3 h-3" />}
                </div>
                <span className="truncate max-w-[80px]">{currentConnectorHead?.name || 'Library'}</span>
              </button>

              {showWhimsyLibrary && libraryMode === 'CONNECTOR' && (
                <div className="absolute top-full left-0 mt-2 w-72 h-96 z-50 shadow-2xl">
                  <WhimsyLibrary 
                    whimsies={whimsies}
                    selectedId={connectorHeadTemplate}
                    onSelect={(w) => {
                      setConnectorHeadTemplate(w.id);
                      setShowWhimsyLibrary(false);
                    }}
                    onUpload={onUploadWhimsy}
                    onRemove={onRemoveWhimsy}
                  />
                </div>
              )}
            </div>

            <InfiniteSlider 
              label="Scale" 
              value={connectorHeadScale} 
              onChange={setConnectorHeadScale} 
              min={0.1} 
              max={20} 
              step={0.1}
              width="w-24" 
              sensitivity={0.05}
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
              <Label>Neck</Label>
              <select
                value={connectorNeckShape}
                onChange={e => setConnectorNeckShape(e.target.value as NeckShape)}
                className="h-7 px-2 rounded-lg text-[10px] font-bold border border-slate-100 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value={NeckShape.STANDARD}>Standard</option>
                <option value={NeckShape.TAPERED}>Tapered</option>
                <option value={NeckShape.CURVED}>Curved</option>
              </select>
            </div>

            {connectorNeckShape === NeckShape.CURVED && (
              <div className="flex items-center gap-2">
                <Label>Neck Curve</Label>
                <input 
                  type="range" 
                  min="-1" 
                  max="1" 
                  step="0.01" 
                  value={connectorNeckCurvature} 
                  onChange={e => setConnectorNeckCurvature(Number(e.target.value))}
                  className="w-16 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <span className="text-[9px] font-mono font-bold text-slate-400 w-8">{connectorNeckCurvature.toFixed(2)}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Label>Extrude Curve</Label>
              <div className="flex items-center gap-1">
                <input 
                  type="range" 
                  min="-1" 
                  max="1" 
                  step="0.01" 
                  value={connectorExtrusionCurvature} 
                  onChange={e => setConnectorExtrusionCurvature(Number(e.target.value))}
                  className="w-16 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <button
                  onClick={() => setConnectorExtrusionCurvature(0)}
                  className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Reset to 0"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
                <span className="text-[9px] font-mono font-bold text-slate-400 w-8 ml-0.5">{connectorExtrusionCurvature.toFixed(2)}</span>
              </div>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-500"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>

            {selectedConnectorId && (
              <button
                type="button"
                onClick={() => onRemoveConnector(selectedConnectorId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold uppercase hover:bg-rose-500"
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

      {/* Stamp Panel Popover removed from here, moved to local buttons */}

      {activeTab === 'MASS_CONNECTION' && (
        <V3MassConnectionTab
          selectedIds={selectedIds}
          whimsies={whimsies}
          selectedHeadIds={massHeadIds}
          setSelectedHeadIds={setMassHeadIds}
          widthRange={massWidthRange}
          setWidthRange={setMassWidthRange}
          widthRelative={massWidthRelative}
          setWidthRelative={setMassWidthRelative}
          extrusionRange={massExtrusionRange}
          setExtrusionRange={setMassExtrusionRange}
          extrusionRelative={massExtrusionRelative}
          setExtrusionRelative={setMassExtrusionRelative}
          positionRange={massPositionRange}
          setPositionRange={setMassPositionRange}
          headScaleRange={massHeadScaleRange}
          setHeadScaleRange={setMassHeadScaleRange}
          headScaleRelative={massHeadScaleRelative}
          setHeadScaleRelative={setMassHeadScaleRelative}
          useActualAreaForScale={massUseActualAreaForScale}
          setUseActualAreaForScale={setMassUseActualAreaForScale}
          headRotationRange={massHeadRotationRange}
          setHeadRotationRange={setMassHeadRotationRange}
          jitterRange={massJitterRange}
          setJitterRange={setMassJitterRange}
          massNeckShapes={massNeckShapes}
          setMassNeckShapes={setMassNeckShapes}
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

      {/* Selection ID bar removed as per request */}
    </div>
  );
};
