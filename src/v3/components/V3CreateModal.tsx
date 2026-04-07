import React, { useState } from 'react';
import { Maximize2, Move } from 'lucide-react';

interface V3CreateModalProps {
  onCreate: (width: number, height: number) => void;
}

export const V3CreateModal: React.FC<V3CreateModalProps> = ({ onCreate }) => {
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-600 px-6 py-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">Create New Puzzle V3</h2>
            <p className="text-indigo-100 text-sm">Set your canvas dimensions to begin.</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Maximize2 className="w-3 h-3" /> Width (px)
              </label>
              <input 
                type="number" 
                value={width} 
                onChange={e => setWidth(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Move className="w-3 h-3 rotate-90" /> Height (px)
              </label>
              <input 
                type="number" 
                value={height} 
                onChange={e => setHeight(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              onClick={() => {
                console.log('V3CreateModal: Initialize Engine clicked', width, height);
                onCreate(width, height);
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
            >
              Initialize Engine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
