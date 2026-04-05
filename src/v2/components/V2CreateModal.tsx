import React, { useState } from 'react';
import { Layers } from 'lucide-react';

interface Preset { label: string; w: number; h: number }

const PRESETS: Preset[] = [
  { label: 'Square',  w: 600,  h: 600  },
  { label: 'A4 land', w: 842,  h: 595  },
  { label: 'A4 port', w: 595,  h: 842  },
  { label: '4:3',     w: 800,  h: 600  },
  { label: '16:9',    w: 960,  h: 540  },
];

interface V2CreateModalProps {
  onCreate: (w: number, h: number) => void;
}

export const V2CreateModal: React.FC<V2CreateModalProps> = ({ onCreate }) => {
  const [w, setW] = useState(800);
  const [h, setH] = useState(600);

  const apply = (preset: Preset) => { setW(preset.w); setH(preset.h); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Puzzle</h2>
            <p className="text-xs text-slate-400">Set the canvas size to get started</p>
          </div>
        </div>

        {/* Presets */}
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Presets</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => apply(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  w === p.w && h === p.h
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {p.label} <span className="font-normal opacity-60">{p.w}×{p.h}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom size */}
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Custom size (px)</span>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1">
              <label className="text-[9px] text-slate-400 font-bold uppercase">Width</label>
              <input
                type="number"
                value={w}
                min={100}
                max={4000}
                onChange={e => setW(Math.max(100, Number(e.target.value)))}
                className="w-full mt-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <span className="text-slate-300 mt-5">×</span>
            <div className="flex-1">
              <label className="text-[9px] text-slate-400 font-bold uppercase">Height</label>
              <input
                type="number"
                value={h}
                min={100}
                max={4000}
                onChange={e => setH(Math.max(100, Number(e.target.value)))}
                className="w-full mt-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={() => onCreate(w, h)}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          Create Puzzle
        </button>
      </div>
    </div>
  );
};
