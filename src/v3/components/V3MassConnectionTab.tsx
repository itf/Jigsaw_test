import React, { useState } from 'react';
import { Label } from './ui/Label';
import { WhimsyLibrary } from './WhimsyLibrary';
import { Whimsy } from '../types';
import { Network, Plus, Zap, ChevronDown, X, Layers, Crop } from 'lucide-react';

interface V3MassConnectionTabProps {
  selectedIds: string[];
  whimsies: Whimsy[];
  selectedHeadIds: string[];
  setSelectedHeadIds: (ids: string[]) => void;
  onAddMassConnectors: (params: {
    pieceIds: string[],
    widthRange: [number, number],
    extrusionRange: [number, number],
    positionOffsetRange: [number, number],
    headTemplateIds: string[],
    headScaleRange: [number, number],
    headRotationRange: [number, number],
    jitterRange: [number, number]
  }) => void;
  onPreviewMassConnectors: (params: {
    pieceIds: string[],
    widthRange: [number, number],
    extrusionRange: [number, number],
    positionOffsetRange: [number, number],
    headTemplateIds: string[],
    headScaleRange: [number, number],
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
}) => {
  const [widthRange, setWidthRange] = useState<[number, number]>([12, 20]);
  const [extrusionRange, setExtrusionRange] = useState<[number, number]>([15, 25]);
  const [positionOffsetRange, setPositionOffsetRange] = useState<[number, number]>([0, 20]);
  const [headScaleRange, setHeadScaleRange] = useState<[number, number]>([0.8, 1.2]);
  const [headRotationRange, setHeadRotationRange] = useState<[number, number]>([0, 0]);
  const [jitterRange, setJitterRange] = useState<[number, number]>([0, 2]);
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
    extrusionRange,
    positionOffsetRange,
    headTemplateIds: selectedHeadIds,
    headScaleRange,
    headRotationRange,
    jitterRange,
  });

  const handlePreview = () => onPreviewMassConnectors(getParams());
  const handleAdd = () => onAddMassConnectors(getParams());

  return (
    <div className="flex items-center gap-4 px-4 py-2 flex-wrap bg-slate-50/50 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Mass Connect</span>
          <span className="text-[9px] text-slate-500">{selectedIds.length} pieces selected</span>
        </div>

        <div className="h-8 w-px bg-slate-200 mx-1" />

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

        <div className="h-8 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label>Width Range</Label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={widthRange[0]}
                onChange={e => setWidthRange([Number(e.target.value), widthRange[1]])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-300">-</span>
              <input
                type="number"
                value={widthRange[1]}
                onChange={e => setWidthRange([widthRange[0], Number(e.target.value)])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Extrusion Range</Label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={extrusionRange[0]}
                onChange={e => setExtrusionRange([Number(e.target.value), extrusionRange[1]])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-300">-</span>
              <input
                type="number"
                value={extrusionRange[1]}
                onChange={e => setExtrusionRange([extrusionRange[0], Number(e.target.value)])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Pos Jitter px</Label>
            <input
              type="number"
              value={positionOffsetRange[1]}
              onChange={e => setPositionOffsetRange([0, Number(e.target.value)])}
              className="w-12 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              step="1"
              min="0"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label>Scale Range</Label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={headScaleRange[0]}
                onChange={e => setHeadScaleRange([Number(e.target.value), headScaleRange[1]])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.1"
              />
              <span className="text-slate-300">-</span>
              <input
                type="number"
                value={headScaleRange[1]}
                onChange={e => setHeadScaleRange([headScaleRange[0], Number(e.target.value)])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.1"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Rotation Range</Label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={headRotationRange[0]}
                onChange={e => setHeadRotationRange([Number(e.target.value), headRotationRange[1]])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-300">-</span>
              <input
                type="number"
                value={headRotationRange[1]}
                onChange={e => setHeadRotationRange([headRotationRange[0], Number(e.target.value)])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Jitter Range</Label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={jitterRange[0]}
                onChange={e => setJitterRange([Number(e.target.value), jitterRange[1]])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.5"
              />
              <span className="text-slate-300">-</span>
              <input
                type="number"
                value={jitterRange[1]}
                onChange={e => setJitterRange([jitterRange[0], Number(e.target.value)])}
                className="w-10 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
                step="0.5"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 relative">
            <Label>Heads ({selectedHeadIds.length})</Label>
            <div className="flex items-center gap-1 flex-wrap">
              {/* Selected heads as toggleable thumbnails */}
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
              {/* Button to open library and add more */}
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
                    if (!selectedHeadIds.includes(w.id)) {
                      setSelectedHeadIds([...selectedHeadIds, w.id]);
                    }
                    setShowHeadLibrary(false);
                  }}
                  onUpload={() => {}}
                  onRemove={() => {}}
                  selectedId={selectedHeadIds[0]}
                />
              </div>
            )}
          </div>

          <button
            onClick={handlePreview}
            disabled={selectedIds.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl transition-all shadow-sm shadow-amber-200"
          >
            <Plus size={14} />
            <span className="text-xs font-bold">Preview</span>
          </button>

          <button
            onClick={onCommitPreviewConnectors}
            disabled={!hasPreview}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-all shadow-sm shadow-indigo-200"
          >
            <Plus size={14} />
            <span className="text-xs font-bold">Add</span>
          </button>

          <button
            onClick={onResolveConflicts}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm shadow-emerald-200"
          >
            <Zap size={14} />
            <span className="text-xs font-bold">Resolve Conflicts</span>
          </button>
        </div>
      </div>
    </div>
  );
};
