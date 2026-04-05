import React from 'react';
import { Layers, RefreshCw, RotateCcw, Download } from 'lucide-react';

interface V2HeaderProps {
  geometryEngine: 'BOOLEAN' | 'TOPOLOGICAL';
  setGeometryEngine: (engine: 'BOOLEAN' | 'TOPOLOGICAL') => void;
  runTests: () => void;
  undo: () => void;
}

export const V2Header: React.FC<V2HeaderProps> = ({ 
  geometryEngine, 
  setGeometryEngine, 
  runTests, 
  undo 
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-md shadow-indigo-100">
          <Layers className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="text-slate-900 font-bold truncate max-w-[120px] sm:max-w-none">Untitled Puzzle V2</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 mr-2">
          <button 
            onClick={() => setGeometryEngine('BOOLEAN')}
            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${geometryEngine === 'BOOLEAN' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >
            Boolean
          </button>
          <button 
            onClick={() => setGeometryEngine('TOPOLOGICAL')}
            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${geometryEngine === 'TOPOLOGICAL' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
          >
            Topo
          </button>
        </div>
        <button 
          onClick={runTests}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
          title="Run Topological Engine Tests"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Run Tests</span>
        </button>
        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Undo" onClick={undo}>
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200">
          <Download className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Export</span>
        </button>
      </div>
    </header>
  );
};
