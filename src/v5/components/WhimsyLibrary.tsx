import React, { useState, useRef } from 'react';
import { Search, Upload, X, Grid, List, Trash2, Plus, Star, Circle, Square, Triangle } from 'lucide-react';
// V3-only component
type Whimsy = { id: string; name: string; svgData: string; category?: string };
import paper from 'paper';

interface WhimsyLibraryProps {
  whimsies: Whimsy[];
  onSelect: (whimsy: Whimsy) => void;
  onUpload: (whimsy: Whimsy) => void;
  onRemove: (id: string) => void;
  selectedId?: string;
  selectedIds?: string[];
}

export const WhimsyLibrary: React.FC<WhimsyLibraryProps> = ({
  whimsies,
  onSelect,
  onUpload,
  onRemove,
  selectedId,
  selectedIds = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSelected = (id: string) => {
    if (selectedId && selectedId === id) return true;
    return selectedIds.includes(id);
  };

  const filteredWhimsies = whimsies.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      // Extract all path data (d attribute) from the SVG
      const pathMatches = content.matchAll(/<path[^>]*d="([^"]*)"/g);
      const paths = Array.from(pathMatches).map(m => m[1]);
      
      if (paths.length > 0) {
        // Normalize path data using paper.js
        const canvas = document.createElement('canvas');
        const project = new paper.Project(canvas);
        const item = new paper.CompoundPath({ pathData: paths.join(' '), insert: false });
        const bounds = item.bounds;
        const maxDim = Math.max(bounds.width, bounds.height);
        if (maxDim > 0) {
          item.scale(2 / maxDim, bounds.center);
          item.position = new paper.Point(0, 0);
        }
        const normalizedData = item.pathData;
        item.remove();
        project.remove();

        const newWhimsy: Whimsy = {
          id: `whimsy-${Date.now()}`,
          name: file.name.replace('.svg', ''),
          svgData: normalizedData,
          category: 'Uploaded'
        };
        onUpload(newWhimsy);
      } else {
        alert('Could not find any path data in SVG. Please ensure it has <path> elements with "d" attributes.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Whimsy Library</h3>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
          title="Upload SVG"
        >
          <Upload size={16} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".svg" 
          className="hidden" 
        />
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search whimsies..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 auto-rows-max">
        {filteredWhimsies.map(whimsy => {
          const active = isSelected(whimsy.id);
          return (
            <button
              key={whimsy.id}
              onClick={() => onSelect(whimsy)}
              className={`group relative aspect-square flex flex-col items-center justify-center rounded-xl border transition-all ${
                active 
                  ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20' 
                  : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:bg-white'
              }`}
            >
              <svg 
                viewBox="-1.2 -1.2 2.4 2.4" 
                className={`w-10 h-10 ${active ? 'text-indigo-600' : 'text-slate-500 group-hover:text-indigo-500'}`}
              >
                <path d={whimsy.svgData} fill="currentColor" />
              </svg>
              <span className="mt-1 text-[8px] font-bold text-slate-400 uppercase truncate w-full px-1 text-center">
                {whimsy.name}
              </span>

              {/* Delete button (only for uploaded ones) */}
              {whimsy.category === 'Uploaded' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(whimsy.id);
                  }}
                  className="absolute -top-1 -right-1 p-1 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X size={10} />
                </button>
              )}
            </button>
          );
        })}
        
        {filteredWhimsies.length === 0 && (
          <div className="col-span-3 py-8 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">No whimsies found</p>
          </div>
        )}
      </div>
    </div>
  );
};
