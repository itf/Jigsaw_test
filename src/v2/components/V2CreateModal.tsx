import React, { useState } from 'react';
import { Circle, Layers, Shapes, VectorSquare } from 'lucide-react';
import { CreateRootShape } from '../types';

interface Preset {
  label: string;
  w: number;
  h: number;
}

const PRESETS: Preset[] = [
  { label: 'Square', w: 600, h: 600 },
  { label: 'A4 land', w: 842, h: 595 },
  { label: 'A4 port', w: 595, h: 842 },
  { label: '4:3', w: 800, h: 600 },
  { label: '16:9', w: 960, h: 540 },
];

type ShapeOption = {
  id: CreateRootShape['variant'];
  label: string;
  description: string;
  shape: CreateRootShape;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledHint?: string;
};

const SHAPE_OPTIONS: ShapeOption[] = [
  {
    id: 'rect',
    label: 'Rectangle',
    description: 'Full canvas',
    shape: { variant: 'rect' },
    icon: <VectorSquare className="w-4 h-4" />,
  },
  {
    id: 'circle',
    label: 'Circle',
    description: 'Inscribed in canvas',
    shape: { variant: 'circle' },
    icon: <Circle className="w-4 h-4" />,
  },
  {
    id: 'svgContour',
    label: 'SVG contour',
    description: 'Import a path',
    shape: { variant: 'svgContour' },
    icon: <Shapes className="w-4 h-4" />,
    disabled: true,
    disabledHint: 'Not implemented yet',
  },
  {
    id: 'multiCircle',
    label: 'Two circles',
    description: 'Two separate regions',
    shape: { variant: 'multiCircle', count: 2 },
    icon: (
      <span className="flex gap-0.5">
        <Circle className="w-3.5 h-3.5" />
        <Circle className="w-3.5 h-3.5" />
      </span>
    ),
  },
];

interface V2CreateModalProps {
  onCreate: (w: number, h: number, shape: CreateRootShape) => void;
}

export const V2CreateModal: React.FC<V2CreateModalProps> = ({ onCreate }) => {
  const [w, setW] = useState(800);
  const [h, setH] = useState(600);
  const [shape, setShape] = useState<CreateRootShape>({ variant: 'rect' });

  const apply = (preset: Preset) => {
    setW(preset.w);
    setH(preset.h);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-6 max-h-[min(90vh,720px)] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Puzzle</h2>
            <p className="text-xs text-slate-400">Canvas size and initial region shape</p>
          </div>
        </div>

        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Initial region</span>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {SHAPE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                disabled={opt.disabled}
                title={opt.disabled ? opt.disabledHint : undefined}
                onClick={() => !opt.disabled && setShape(opt.shape)}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  opt.disabled
                    ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50'
                    : shape.variant === opt.id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-200'
                }`}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="text-indigo-600">{opt.icon}</span>
                  {opt.label}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

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

        <button
          type="button"
          onClick={() => onCreate(w, h, shape)}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          Create Puzzle
        </button>
      </div>
    </div>
  );
};
