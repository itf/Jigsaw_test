import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MousePointer2, 
  Plus, 
  Zap, 
  Heart, 
  X,
  Maximize2,
  Minimize2,
  Trash2,
  Layers,
  Settings2,
  Info,
  RefreshCw,
  Scissors
} from 'lucide-react';

interface RadialMenuProps {
  x: number;
  y: number;
  onSelect: (mode: any) => void;
  onClose: () => void;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({ x, y, onSelect, onClose }) => {
  const items = [
    { id: 'SELECT', icon: <MousePointer2 className="w-5 h-5" />, label: 'Select' },
    { id: 'SUBDIVIDE', icon: <Plus className="w-5 h-5" />, label: 'Subdivide' },
    { id: 'MERGE', icon: <Zap className="w-5 h-5" />, label: 'Merge' },
    { id: 'WHIMSY', icon: <Heart className="w-5 h-5" />, label: 'Whimsy' },
  ];

  const radius = 80;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="absolute w-1 h-1"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-zinc-900 border-2 border-indigo-500 rounded-full flex items-center justify-center shadow-xl z-10 pointer-events-none">
          <X className="w-6 h-6 text-indigo-400" />
        </div>

        {items.map((item, index) => {
          const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
          const tx = Math.cos(angle) * radius;
          const ty = Math.sin(angle) * radius;

          return (
            <motion.button
              key={item.id}
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{ x: tx, y: ty, opacity: 1 }}
              whileHover={{ scale: 1.1, backgroundColor: '#1e1b4b' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
                onClose();
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-full flex flex-col items-center justify-center shadow-lg group transition-colors z-20"
            >
              <div className="text-zinc-400 group-hover:text-indigo-400 transition-colors">
                {item.icon}
              </div>
              <span className="absolute top-14 text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-zinc-300 whitespace-nowrap">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

interface ContextPanelProps {
  stats: {
    pieces: number;
    whimsies: number;
    area: number;
    toolMode: string;
  };
  selection: {
    id: string | null;
    type: 'EDGE' | 'WHIMSY' | 'PIECE' | 'NONE';
    data?: any;
  };
  onUpdateWhimsy: (id: string, updates: any) => void;
  onUpdateConnector: (edgeKey: string, updates: any) => void;
  onDelete: () => void;
  onToggleWarp: () => void;
  onTestEdgeHandles: () => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ 
  stats, 
  selection, 
  onUpdateWhimsy, 
  onUpdateConnector, 
  onDelete, 
  onToggleWarp,
  onTestEdgeHandles
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-4 w-full max-w-2xl px-6 pointer-events-none">
      <AnimatePresence>
        {selection.type !== 'NONE' && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-2xl pointer-events-auto"
          >
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  {selection.type === 'EDGE' ? <RefreshCw className="w-5 h-5 text-indigo-400" /> :
                   selection.type === 'WHIMSY' ? <Heart className="w-5 h-5 text-indigo-400" /> :
                   <Layers className="w-5 h-5 text-indigo-400" />}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Selected {selection.type}</div>
                  <div className="text-sm font-mono text-zinc-300">{selection.id}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selection.type === 'PIECE' && (
                  <button 
                    onClick={onToggleWarp}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selection.data?.isWarped ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    {selection.data?.isWarped ? 'Unwarp' : 'Warp'}
                  </button>
                )}
                
                {selection.type === 'WHIMSY' && (
                  <div className="flex items-center gap-4 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-zinc-500 uppercase">Rotation</span>
                      <input 
                        type="range" min="0" max="360" 
                        value={selection.data?.rotation || 0}
                        onChange={(e) => onUpdateWhimsy(selection.data.id, { rotation: Number(e.target.value) })}
                        className="w-24 accent-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {selection.type === 'EDGE' && (
                  <div className="flex items-center gap-4 px-4">
                    <select 
                      value={selection.data?.config?.type || 'TAB'}
                      onChange={(e) => onUpdateConnector(selection.data.edgeKey, { type: e.target.value })}
                      className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300"
                    >
                      <option value="TAB">Tab</option>
                      <option value="BLANK">Blank</option>
                      <option value="WAVE">Wave</option>
                      <option value="SQUARE">Square</option>
                    </select>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-zinc-500 uppercase">Offset</span>
                      <input 
                        type="range" min="0" max="1" step="0.01"
                        value={selection.data?.config?.offset || 0.5}
                        onChange={(e) => onUpdateConnector(selection.data.edgeKey, { offset: Number(e.target.value) })}
                        className="w-24 accent-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={onDelete}
                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-full px-6 py-2 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">Pieces</span>
            <span className="text-xs font-mono text-indigo-400">{stats.pieces}</span>
          </div>
          <div className="flex flex-col border-l border-zinc-800 pl-6">
            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">Whimsies</span>
            <span className="text-xs font-mono text-emerald-400">{stats.whimsies}</span>
          </div>
          <div className="flex flex-col border-l border-zinc-800 pl-6">
            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">Mode</span>
            <span className="text-xs font-mono text-amber-400">{stats.toolMode}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Engine</span>
        </div>
      </div>
    </div>
  );
};
