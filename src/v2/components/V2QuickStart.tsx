import React from 'react';
import { motion } from 'motion/react';
import { Plus, Grid, Hexagon, Shuffle } from 'lucide-react';

interface V2QuickStartProps {
  subdivide: (parentId: string, pattern: string) => void;
}

export const V2QuickStart: React.FC<V2QuickStartProps> = ({ subdivide }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/30 backdrop-blur-[2px] z-30 p-4 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[300px] w-full p-6 bg-white rounded-3xl shadow-2xl border border-slate-100 text-center space-y-4 pointer-events-auto"
      >
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-100">
          <Plus className="w-7 h-7 text-white" />
        </div>
        
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 leading-tight">Start Your Design</h2>
          <p className="text-slate-500 text-xs leading-relaxed px-2">Choose a pattern to subdivide the root area and begin your puzzle.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => subdivide('root', 'GRID')} className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-50 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group">
            <Grid className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
            <span className="text-[10px] font-bold text-slate-600">Grid</span>
          </button>
          <button onClick={() => subdivide('root', 'HEX')} className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-50 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group">
            <Hexagon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
            <span className="text-[10px] font-bold text-slate-600">Hex</span>
          </button>
          <button onClick={() => subdivide('root', 'RANDOM')} className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-50 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group">
            <Shuffle className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
            <span className="text-[10px] font-bold text-slate-600">Rand</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
