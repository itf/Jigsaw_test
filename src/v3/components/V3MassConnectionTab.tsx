import React, { useState } from 'react';
import { Label } from './ui/Label';
import { WhimsyLibrary } from './WhimsyLibrary';
import { Whimsy } from '../types';
import { Network, Plus, Zap, ChevronDown, X } from 'lucide-react';

interface V3MassConnectionTabProps {
  selectedIds: string[];
  whimsies: Whimsy[];
  connectorHeadTemplate: string;
  setConnectorHeadTemplate: (id: string) => void;
  onAddMassConnectors: (params: {
    pieceIds: string[],
    widthRange: [number, number],
    extrusionRange: [number, number],
    positionOffsetRange: [number, number],
    headTemplateId: string,
    headScaleRange: [number, number],
    headRotationRange: [number, number],
    jitterRange: [number, number]
  }) => void;
  onResolveConflicts: () => void;
}

export const V3MassConnectionTab: React.FC<V3MassConnectionTabProps> = ({
  selectedIds,
  whimsies,
  connectorHeadTemplate,
  setConnectorHeadTemplate,
  onAddMassConnectors,
  onResolveConflicts,
}) => {
  const [widthRange, setWidthRange] = useState<[number, number]>([12, 20]);
  const [extrusionRange, setExtrusionRange] = useState<[number, number]>([15, 25]);
  const [positionOffsetRange, setPositionOffsetRange] = useState<[number, number]>([0, 0.2]);
  const [headScaleRange, setHeadScaleRange] = useState<[number, number]>([0.8, 1.2]);
  const [headRotationRange, setHeadRotationRange] = useState<[number, number]>([0, 0]);
  const [jitterRange, setJitterRange] = useState<[number, number]>([0, 2]);
  const [showHeadLibrary, setShowHeadLibrary] = useState(false);

  const currentConnectorHead = whimsies.find(w => w.id === connectorHeadTemplate);

  const handleAdd = () => {
    onAddMassConnectors({
      pieceIds: selectedIds,
      widthRange,
      extrusionRange,
      positionOffsetRange,
      headTemplateId: connectorHeadTemplate,
      headScaleRange,
      headRotationRange,
      jitterRange
    });
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 flex-wrap bg-slate-50/50 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Mass Connect</span>
          <span className="text-[9px] text-slate-500">{selectedIds.length} pieces selected</span>
        </div>

        <div className="h-8 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-4">
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
            <Label>Pos Jitter</Label>
            <input 
              type="number" 
              value={positionOffsetRange[1]} 
              onChange={e => setPositionOffsetRange([0, Number(e.target.value)])}
              className="w-12 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-indigo-500"
              step="0.05"
            />
          </div>

          <div className="flex flex-col gap-1 relative">
            <Label>Head</Label>
            <button 
              onClick={() => setShowHeadLibrary(!showHeadLibrary)}
              className="h-7 px-2 flex items-center gap-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-all"
            >
              <div className="w-4 h-4 text-slate-600">
                <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-full h-full">
                  <path d={currentConnectorHead?.svgData} fill="currentColor" />
                </svg>
              </div>
              <span className="text-[10px] font-bold text-slate-700 truncate max-w-[60px]">
                {currentConnectorHead?.name || 'Select'}
              </span>
              <ChevronDown size={10} className="text-slate-400" />
            </button>

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
                    setConnectorHeadTemplate(w.id);
                    setShowHeadLibrary(false);
                  }}
                  onUpload={() => {}} // Handled in App
                  onRemove={() => {}} // Handled in App
                  selectedId={connectorHeadTemplate}
                />
              </div>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={selectedIds.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-all shadow-sm shadow-indigo-200"
          >
            <Plus size={14} />
            <span className="text-xs font-bold">Add Connectors</span>
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
