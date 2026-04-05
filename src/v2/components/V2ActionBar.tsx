import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Grid, Shuffle, Link as LinkIcon, Zap, Download, RefreshCw, Trash2, X } from 'lucide-react';
import { Tab } from '../constants';
import { Connector } from '../types';

interface V2ActionBarProps {
  activeTab: Tab;
  isMobile: boolean;
  gridRows: number;
  setGridRows: (val: number) => void;
  gridCols: number;
  setGridCols: (val: number) => void;
  randomPoints: number;
  setRandomPoints: (val: number) => void;
  subdivide: (parentId: string, pattern: string) => void;
  selectedId: string | null;
  selectedType: 'AREA' | 'CONNECTOR' | 'NONE';
  selectionData: any;
  mergeSelection: string | null;
  setMergeSelection: (val: string | null) => void;
  onUpdateConnector: (id: string, updates: Partial<Connector>) => void;
  onDeleteOperation: (id: string) => void;
  onClearSelection: () => void;
}

export const V2ActionBar: React.FC<V2ActionBarProps> = ({
  activeTab,
  isMobile,
  gridRows,
  setGridRows,
  gridCols,
  setGridCols,
  randomPoints,
  setRandomPoints,
  subdivide,
  selectedId,
  selectedType,
  selectionData,
  mergeSelection,
  setMergeSelection,
  onUpdateConnector,
  onDeleteOperation,
  onClearSelection
}) => {
  return (
    <div className="bg-white border-b border-slate-200 z-30 min-h-[56px] flex items-center px-4">
      <AnimatePresence mode="wait">
        {selectedId && selectedType !== 'NONE' ? (
          <motion.div 
            key="selection"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex items-center gap-4 w-full"
          >
            <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
              <div className={`w-2 h-2 rounded-full ${selectedType === 'AREA' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                {selectedType === 'AREA' ? 'Area' : 'Connector'}
              </span>
              <button onClick={onClearSelection} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                <X size={14} />
              </button>
            </div>

            {selectedType === 'AREA' ? (
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-400 uppercase font-bold">ID</span>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 truncate max-w-[100px]">{selectedId}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-400 uppercase font-bold">Status</span>
                  <span className={`text-[10px] font-bold ${selectionData?.isPiece ? 'text-green-600' : 'text-amber-600'}`}>
                    {selectionData?.isPiece ? 'Piece' : 'Subdivided'}
                  </span>
                </div>
                {activeTab === 'TOPOLOGY' && (
                  <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
                    <button onClick={() => subdivide(selectedId, 'GRID')} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all shrink-0">
                      <Grid className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase">Grid</span>
                    </button>
                    <button onClick={() => subdivide(selectedId, 'RANDOM')} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all shrink-0">
                      <Shuffle className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase">Random</span>
                    </button>
                  </div>
                )}
                {activeTab === 'MODIFICATION' && (
                  <button 
                    onClick={() => setMergeSelection(selectedId)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 ${mergeSelection === selectedId ? 'bg-amber-100 text-amber-600' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                  >
                    <Zap className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase">{mergeSelection === selectedId ? 'Merging...' : 'Merge'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-6 w-full overflow-x-auto no-scrollbar py-1">
                <div className="flex items-center gap-3 min-w-[150px]">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Pos</span>
                  <input 
                    type="range" min="0" max="1" step="0.01"
                    value={selectionData?.u || 0} 
                    onChange={(e) => onUpdateConnector(selectedId, { u: Number(e.target.value) })}
                    className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[10px] font-mono font-bold text-emerald-600">{(selectionData?.u || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3 min-w-[120px]">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Size</span>
                  <input 
                    type="range" min="10" max="100" step="1"
                    value={selectionData?.size || 20} 
                    onChange={(e) => onUpdateConnector(selectedId, { size: Number(e.target.value) })}
                    className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[10px] font-mono font-bold text-emerald-600">{selectionData?.size}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateConnector(selectedId, { isFlipped: !selectionData?.isFlipped })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${selectionData?.isFlipped ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400 hover:text-emerald-500'}`}
                  >
                    <RefreshCw size={12} /> <span className="text-[10px] font-bold uppercase">Flip</span>
                  </button>
                  <button 
                    onClick={() => onDeleteOperation(selectedId)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"
                  >
                    <Trash2 size={12} /> <span className="text-[10px] font-bold uppercase">Delete</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-2 w-full"
          >
            {activeTab === 'TOPOLOGY' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Grid</span>
                  <div className="flex items-center gap-1">
                    <input type="number" value={gridRows} onChange={e => setGridRows(Number(e.target.value))} className="w-8 h-8 bg-slate-50 rounded-lg text-center text-[10px] font-bold border border-slate-100" />
                    <span className="text-slate-300 text-[10px]">×</span>
                    <input type="number" value={gridCols} onChange={e => setGridCols(Number(e.target.value))} className="w-8 h-8 bg-slate-50 rounded-lg text-center text-[10px] font-bold border border-slate-100" />
                  </div>
                </div>
                <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Random</span>
                  <input type="number" value={randomPoints} onChange={e => setRandomPoints(Number(e.target.value))} className="w-10 h-8 bg-slate-50 rounded-lg text-center text-[10px] font-bold border border-slate-100" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => subdivide('root', 'GRID')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-all shrink-0">
                    <Grid className="w-3.5 h-3.5" /> <span className="text-xs font-bold uppercase tracking-tight">Split Grid</span>
                  </button>
                  <button onClick={() => subdivide('root', 'RANDOM')} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shrink-0">
                    <Shuffle className="w-3.5 h-3.5" /> <span className="text-xs font-bold uppercase tracking-tight">Split Random</span>
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'CONNECTION' && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-emerald-600 bg-emerald-50 rounded-xl shrink-0">
                <LinkIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-tight">Click edges to add tabs</span>
              </div>
            )}
            {activeTab === 'MODIFICATION' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 text-amber-600 bg-amber-50 rounded-xl shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase tracking-tight">
                    {mergeSelection ? 'Select second area to merge' : 'Select area to merge'}
                  </span>
                </div>
                {mergeSelection && (
                  <button 
                    onClick={() => setMergeSelection(null)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
            {activeTab === 'PRODUCTION' && (
              <button className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all flex items-center justify-center gap-2">
                <Download className="w-3.5 h-3.5" /> Export SVG
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
