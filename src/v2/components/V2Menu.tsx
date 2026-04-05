import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MousePointer2, 
  Plus, 
  Zap, 
  Heart, 
  X,
  Maximize2,
  Minimize2,
  RotateCw,
  Scaling,
  Move,
  Trash2,
  Layers,
  Grid,
  Hexagon,
  Wind,
  Shuffle,
  Link as LinkIcon,
  Settings2,
  Info,
  RefreshCw
} from 'lucide-react';
import { Area, Connector } from '../types';

interface RadialMenuProps {
  x: number;
  y: number;
  onSelect: (mode: string, params?: any) => void;
  onClose: () => void;
  context: 'CANVAS' | 'AREA' | 'EDGE';
  activeTab: string;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({ x, y, onSelect, onClose, context, activeTab }) => {
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const isMobile = window.innerWidth < 768;

  const mainItems = context === 'AREA' ? [
    ...(activeTab === 'TOPOLOGY' ? [{ id: 'SUBDIVIDE', icon: <Plus className="w-5 h-5" />, label: 'Subdivide' }] : []),
    ...(activeTab === 'MODIFICATION' ? [{ id: 'MERGE', icon: <Zap className="w-5 h-5" />, label: 'Merge' }] : []),
    ...(activeTab === 'TOPOLOGY' ? [{ id: 'ADD_WHIMSY', icon: <Heart className="w-5 h-5" />, label: 'Whimsy' }] : []),
    { id: 'PROPERTIES', icon: <Info className="w-5 h-5" />, label: 'Info' },
  ] : context === 'EDGE' ? [
    ...(activeTab === 'CONNECTION' ? [{ id: 'ADD_CONNECTOR', icon: <LinkIcon className="w-5 h-5" />, label: 'Add Tab' }] : []),
    ...(activeTab === 'MODIFICATION' ? [{ id: 'MERGE_EDGE', icon: <Zap className="w-5 h-5" />, label: 'Merge Edge' }] : []),
  ] : [
    ...(activeTab === 'TOPOLOGY' ? [{ id: 'SUBDIVIDE_ROOT', icon: <Plus className="w-5 h-5" />, label: 'Subdivide' }] : []),
    { id: 'SETTINGS', icon: <Settings2 className="w-5 h-5" />, label: 'Settings' },
  ];

  const subMenuItems: Record<string, any[]> = {
    'SUBDIVIDE': [
      { id: 'GRID', icon: <Grid className="w-4 h-4" />, label: 'Grid' },
      { id: 'HEX', icon: <Hexagon className="w-4 h-4" />, label: 'Hex' },
      { id: 'SPIRAL', icon: <Wind className="w-4 h-4" />, label: 'Spiral' },
      { id: 'RANDOM', icon: <Shuffle className="w-4 h-4" />, label: 'Random' },
    ]
  };

  const radius = isMobile ? 65 : 80;
  const activeItems = subMenu ? subMenuItems[subMenu] : mainItems;

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
        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 border-2 border-indigo-500 rounded-full flex items-center justify-center shadow-xl z-10 pointer-events-none">
          {subMenu ? <ChevronLeft className="w-6 h-6 text-indigo-400" /> : <X className="w-6 h-6 text-indigo-400" />}
        </div>

        {activeItems.map((item, index) => {
          const angle = (index / activeItems.length) * Math.PI * 2 - Math.PI / 2;
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
                if (subMenuItems[item.id]) {
                  setSubMenu(item.id);
                } else {
                  onSelect(item.id, subMenu ? { type: subMenu } : undefined);
                  onClose();
                }
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-slate-800 border border-slate-700 rounded-full flex flex-col items-center justify-center shadow-lg group transition-colors z-20`}
            >
              <div className={`text-slate-300 group-hover:text-white ${isMobile ? 'scale-75' : ''}`}>
                {item.icon}
              </div>
              <span className={`absolute top-full mt-1 text-[10px] font-bold text-slate-400 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} whitespace-nowrap`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

interface ContextPanelProps {
  selection: {
    id: string | null;
    type: 'AREA' | 'CONNECTOR' | 'NONE';
    data?: any;
  };
  onUpdateConnector?: (id: string, updates: Partial<Connector>) => void;
  onDelete?: () => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ selection, onUpdateConnector, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isMobile = window.innerWidth < 768;

  if (selection.type === 'NONE') return null;

  return (
    <motion.div
      layout
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full max-w-md mx-auto`}
    >
      <div 
        className="p-3 border-b border-slate-100 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${selection.type === 'AREA' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {selection.type === 'AREA' ? 'Area Inspector' : 'Connector Editor'}
          </span>
        </div>
        {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-slate-400" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-400" />}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-4 space-y-4"
          >
            {selection.type === 'AREA' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">ID</span>
                  <div className="text-xs font-mono font-bold text-indigo-600 truncate">{selection.id}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Type</span>
                  <div className="text-xs font-bold text-slate-700">{selection.data?.type}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Status</span>
                  <div className={`text-xs font-bold ${selection.data?.isPiece ? 'text-green-600' : 'text-amber-600'}`}>
                    {selection.data?.isPiece ? 'Piece' : 'Subdivided'}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Color</span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: selection.data?.color }} />
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{selection.data?.color}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                    <span>Position & Side</span>
                    <span className="text-emerald-600">{(selection.data?.u || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" min="0.001" max="0.999" step="0.001"
                      value={selection.data?.u || 0} 
                      onChange={(e) => onUpdateConnector?.(selection.id!, { u: Number(e.target.value) })}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <button
                      onClick={() => onUpdateConnector?.(selection.id!, { isFlipped: !selection.data?.isFlipped })}
                      className={`p-1.5 rounded-lg transition-colors ${selection.data?.isFlipped ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-100 text-slate-400 hover:text-emerald-500'}`}
                      title="Flip Side"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                    <span>Start</span>
                    <span>Center</span>
                    <span>End</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                    <span>Size</span>
                    <span className="text-emerald-600">{selection.data?.size}px</span>
                  </div>
                  <input 
                    type="range" min="10" max="100" step="1"
                    value={selection.data?.size || 20} 
                    onChange={(e) => onUpdateConnector?.(selection.id!, { size: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <button 
                  onClick={onDelete}
                  className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-500 text-[10px] font-bold rounded-xl transition-all border border-red-100 uppercase tracking-widest"
                >
                  Delete Connector
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
