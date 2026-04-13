import React from 'react';
import { Layers, RefreshCw, RotateCcw, Download, Upload, Save } from 'lucide-react';

interface V3HeaderProps {
  onReset: () => void;
  onSave: () => void;
  onLoad: () => void;
}

export const V3Header: React.FC<V3HeaderProps> = ({ onReset, onSave, onLoad }) => {
  return (
    <header className="bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 px-4 py-2 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-md shadow-indigo-100">
          <Layers className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="text-slate-900 font-bold truncate max-w-[120px] sm:max-w-none">Puzzle Engine V3</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
        <button 
          onClick={onLoad}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors"
          title="Load .puzzle file"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Load</span>
        </button>
        <button 
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
          title="Reset Puzzle"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Undo (Coming Soon)">
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button 
          onClick={onSave}
          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
          title="Save as .puzzle file"
        >
          <Save className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Save</span>
        </button>
      </div>
    </header>
  );
};
