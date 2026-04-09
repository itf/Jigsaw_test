import React, { useState } from 'react';
import { Label } from './ui/Label';
import { WhimsyLibrary } from './WhimsyLibrary';
import { Whimsy } from '../types';
import { Network, Plus, Zap, ChevronDown, X, Layers, Crop } from 'lucide-react';
import { RangeSlider } from './controls/RangeSlider';

interface V3MassConnectionTabProps {
  selectedIds: string[];
  whimsies: Whimsy[];
  selectedHeadIds: string[];
  setSelectedHeadIds: (ids: string[]) => void;
  widthRange: [number, number];
  setWidthRange: (val: [number, number]) => void;
  widthRelative: boolean;
  setWidthRelative: (val: boolean) => void;
  extrusionRange: [number, number];
  setExtrusionRange: (val: [number, number]) => void;
  extrusionRelative: boolean;
  setExtrusionRelative: (val: boolean) => void;
  positionRange: [number, number];
  setPositionRange: (val: [number, number]) => void;
  headScaleRange: [number, number];
  setHeadScaleRange: (val: [number, number]) => void;
  headScaleRelative: boolean;
  setHeadScaleRelative: (val: boolean) => void;
  useActualAreaForScale: boolean;
  setUseActualAreaForScale: (val: boolean) => void;
  headRotationRange: [number, number];
  setHeadRotationRange: (val: [number, number]) => void;
  jitterRange: [number, number];
  setJitterRange: (val: [number, number]) => void;
  onAddMassConnectors: (params: {
    pieceIds: string[],
    widthRange: [number, number],
    widthRelative: boolean,
    extrusionRange: [number, number],
    extrusionRelative: boolean,
    positionRange: [number, number],
    headTemplateIds: string[],
    headScaleRange: [number, number],
    headScaleRelative: boolean,
    useActualAreaForScale: boolean,
    headRotationRange: [number, number],
    jitterRange: [number, number]
  }) => void;
  onPreviewMassConnectors: (params: {
    pieceIds: string[],
    widthRange: [number, number],
    widthRelative: boolean,
    extrusionRange: [number, number],
    extrusionRelative: boolean,
    positionRange: [number, number],
    headTemplateIds: string[],
    headScaleRange: [number, number],
    headScaleRelative: boolean,
    useActualAreaForScale: boolean,
    headRotationRange: [number, number],
    jitterRange: [number, number]
  }) => void;
  onCommitPreviewConnectors: () => void;
  hasPreview: boolean;
  onResolveConflicts: () => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
  rectSelectMode: boolean;
  onToggleRectSelect: () => void;
}

export const V3MassConnectionTab: React.FC<V3MassConnectionTabProps> = ({
  selectedIds,
  whimsies,
  selectedHeadIds,
  setSelectedHeadIds,
  onAddMassConnectors,
  onPreviewMassConnectors,
  onCommitPreviewConnectors,
  hasPreview,
  onResolveConflicts,
  onSelectAll,
  onUnselectAll,
  rectSelectMode,
  onToggleRectSelect,
  widthRange,
  setWidthRange,
  widthRelative,
  setWidthRelative,
  extrusionRange,
  setExtrusionRange,
  extrusionRelative,
  setExtrusionRelative,
  positionRange,
  setPositionRange,
  headScaleRange,
  setHeadScaleRange,
  headScaleRelative,
  setHeadScaleRelative,
  useActualAreaForScale,
  setUseActualAreaForScale,
  headRotationRange,
  setHeadRotationRange,
  jitterRange,
  setJitterRange,
}) => {
  const [showHeadLibrary, setShowHeadLibrary] = useState(false);

  const handleToggleHead = (id: string) => {
    if (selectedHeadIds.includes(id)) {
      if (selectedHeadIds.length === 1) return; // keep at least one
      setSelectedHeadIds(selectedHeadIds.filter(h => h !== id));
    } else {
      setSelectedHeadIds([...selectedHeadIds, id]);
    }
  };

  const getParams = () => ({
    pieceIds: selectedIds,
    widthRange,
    widthRelative,
    extrusionRange,
    extrusionRelative,
    positionRange,
    headTemplateIds: selectedHeadIds,
    headScaleRange,
    headScaleRelative,
    useActualAreaForScale,
    headRotationRange,
    jitterRange,
  });

  const handlePreview = () => onPreviewMassConnectors(getParams());
  const handleAdd = () => onAddMassConnectors(getParams());

  return (
    <div className="flex flex-col gap-4 px-4 py-4 bg-slate-50 border-b border-slate-200">
      {/* Top Row: Selection */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Mass Connect</span>
            <span className="text-[9px] text-slate-500">{selectedIds.length} pieces selected</span>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSelectAll}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Layers size={10} />
              <span className="text-[10px] font-bold uppercase">All</span>
            </button>
            <button
              type="button"
              onClick={onUnselectAll}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <X size={10} />
              <span className="text-[10px] font-bold uppercase">None</span>
            </button>
            <button
              type="button"
              onClick={onToggleRectSelect}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all shrink-0 ${rectSelectMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Crop size={10} />
              <span className="text-[10px] font-bold uppercase">Rect</span>
            </button>
          </div>
        </div>
      </div>

      {/* Middle Row: Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label>Width</Label>
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-slate-400 uppercase font-bold">Rel</span>
              <input 
                type="checkbox" 
                checked={widthRelative} 
                onChange={e => {
                  setWidthRelative(e.target.checked);
                  setWidthRange(e.target.checked ? [0.1, 0.3] : [12, 20]);
                }}
                className="w-3 h-3 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
          <RangeSlider
            min={widthRelative ? 0.1 : 5}
            max={widthRelative ? 0.6 : 100}
            step={widthRelative ? 0.01 : 1}
            value={widthRange}
            onChange={setWidthRange}
            unit={widthRelative ? "%" : "px"}
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label>Extrusion</Label>
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-slate-400 uppercase font-bold">Rel</span>
              <input 
                type="checkbox" 
                checked={extrusionRelative} 
                onChange={e => {
                  setExtrusionRelative(e.target.checked);
                  setExtrusionRange(e.target.checked ? [15, 25] : [15, 25]);
                }}
                className="w-3 h-3 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
          <RangeSlider
            min={extrusionRelative ? 0 : 5}
            max={extrusionRelative ? 100 : 200}
            step={1}
            value={extrusionRange}
            onChange={setExtrusionRange}
            unit={extrusionRelative ? "%" : "px"}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label>Position</Label>
          <RangeSlider
            min={0}
            max={100}
            step={1}
            value={positionRange}
            onChange={setPositionRange}
            unit="%"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label>Scale</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-slate-400 uppercase font-bold">Rel</span>
                <input 
                  type="checkbox" 
                  checked={headScaleRelative} 
                  onChange={e => {
                    setHeadScaleRelative(e.target.checked);
                    setHeadScaleRange(e.target.checked ? [5, 15] : [0.8, 1.2]);
                  }}
                  className="w-3 h-3 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              {headScaleRelative && (
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-slate-400 uppercase font-bold">Actual</span>
                  <input 
                    type="checkbox" 
                    checked={useActualAreaForScale} 
                    onChange={e => setUseActualAreaForScale(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>
          <RangeSlider
            min={headScaleRelative ? 1 : 0.1}
            max={headScaleRelative ? 40 : 5}
            step={headScaleRelative ? 1 : 0.01}
            value={headScaleRange}
            onChange={setHeadScaleRange}
            unit={headScaleRelative ? "% area" : ""}
          />
        </div>

        <RangeSlider
          label="Rotation"
          min={-180}
          max={180}
          value={headRotationRange}
          onChange={setHeadRotationRange}
          unit="°"
        />

        <RangeSlider
          label="Jitter"
          min={0}
          max={10}
          step={0.5}
          value={jitterRange}
          onChange={setJitterRange}
        />

        {/* Heads Selection */}
        <div className="flex flex-col gap-1 relative">
          <Label>Heads ({selectedHeadIds.length})</Label>
          <div className="flex items-center gap-1 flex-wrap">
            {selectedHeadIds.map(id => {
              const w = whimsies.find(w => w.id === id);
              if (!w) return null;
              return (
                <button
                  key={id}
                  onClick={() => handleToggleHead(id)}
                  title={`Remove ${w.name}`}
                  className="w-7 h-7 flex items-center justify-center bg-indigo-50 border-2 border-indigo-400 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all"
                >
                  <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-4 h-4 text-indigo-600">
                    <path d={w.svgData} fill="currentColor" />
                  </svg>
                </button>
              );
            })}
            <button
              onClick={() => setShowHeadLibrary(!showHeadLibrary)}
              className="h-7 px-2 flex items-center gap-1 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-all"
            >
              <Plus size={10} className="text-slate-400" />
              <ChevronDown size={10} className="text-slate-400" />
            </button>
          </div>

          {showHeadLibrary && (
            <div className="absolute top-full left-0 mt-1 w-64 h-80 z-50 shadow-xl border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="absolute top-2 right-2 z-10">
                <button onClick={() => setShowHeadLibrary(false)} className="p-1 bg-white/80 backdrop-blur rounded-full hover:bg-white shadow-sm">
                  <X size={12} />
                </button>
              </div>
              <WhimsyLibrary
                whimsies={whimsies}
                onSelect={(w) => {
                  handleToggleHead(w.id);
                }}
                onUpload={() => {}}
                onRemove={() => {}}
                selectedIds={selectedHeadIds}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Actions */}
      <div className="flex items-center gap-2 w-full justify-end mt-2">
        <button
          onClick={handlePreview}
          disabled={selectedIds.length < 2}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl transition-all shadow-sm shadow-amber-200"
        >
          <Plus size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">Preview</span>
        </button>

        <button
          onClick={onCommitPreviewConnectors}
          disabled={!hasPreview}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-all shadow-sm shadow-indigo-200"
        >
          <Plus size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">Add</span>
        </button>

        <button
          onClick={onResolveConflicts}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm shadow-emerald-200"
        >
          <Zap size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">Resolve</span>
        </button>
      </div>
    </div>
  );
};

