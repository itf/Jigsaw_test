import React, { useState } from 'react';
import { Square, Circle, Hexagon } from 'lucide-react';

interface V3CreateModalProps {
  onCreate: (shape: 'RECT' | 'CIRCLE' | 'HEX') => void;
}

export const V3CreateModal: React.FC<V3CreateModalProps> = ({ onCreate }) => {
  const [selectedShape, setSelectedShape] = useState<'RECT' | 'CIRCLE' | 'HEX'>('RECT');

  const shapes = [
    { id: 'RECT', name: 'Rectangle', icon: Square },
    { id: 'CIRCLE', name: 'Circle', icon: Circle },
    { id: 'HEX', name: 'Hexagon', icon: Hexagon },
  ] as const;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-600 px-6 py-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">Create New Puzzle</h2>
            <p className="text-indigo-100 text-sm">Choose the base shape for your puzzle.</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {shapes.map((shape) => (
              <button
                key={shape.id}
                onClick={() => setSelectedShape(shape.id)}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  selectedShape === shape.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-100'
                }`}
              >
                <shape.icon className="w-8 h-8" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{shape.name}</span>
              </button>
            ))}
          </div>

          <div className="pt-2">
            <button 
              onClick={() => onCreate(selectedShape)}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
            >
              Start Creating
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
