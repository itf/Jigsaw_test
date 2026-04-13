import React, { useState } from 'react';
import { Copy, Trash2, Plus, RefreshCw, Stamp } from 'lucide-react';
// V3-only component — types removed for V5 compatibility
type Area = any;
const AreaType = { PIECE: 'PIECE', GROUP: 'GROUP', STAMP: 'STAMP' } as const;

interface StampPanelProps {
  areas: Record<string, Area>;
  selectedIds: string[];
  onCreateStamp: (name: string, pieceIds: string[], includeNonAdjacentConnectors: boolean) => void;
  onPlaceStamp: (sourceGroupId: string) => void;
  onDeleteStampSource: (sourceGroupId: string, mode: 'delete' | 'convert') => void;
  onRefreshStamps: () => void;
}

export const StampPanel: React.FC<StampPanelProps> = ({
  areas,
  selectedIds,
  onCreateStamp,
  onPlaceStamp,
  onDeleteStampSource,
  onRefreshStamps
}) => {
  const [stampName, setStampName] = useState('');
  const [includeNonAdjacent, setIncludeNonAdjacent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const stampSources = (Object.values(areas) as Area[]).filter(
    a => a.type === AreaType.GROUP && a.stampName
  );

  const selectedPieces = selectedIds.filter(
    id => areas[id] && (areas[id] as Area).type === AreaType.PIECE
  );

  const handleCreate = () => {
    if (selectedPieces.length < 1) return;
    const stampCount = stampSources.length;
    const name = stampName.trim() || `Stamp ${stampCount + 1}`;
    onCreateStamp(name, selectedPieces, includeNonAdjacent);
    setStampName('');
  };

  const handleDeleteClick = (groupId: string) => {
    setDeleteConfirm(groupId);
  };

  const handleDeleteConfirm = (groupId: string, mode: 'delete' | 'convert') => {
    onDeleteStampSource(groupId, mode);
    setDeleteConfirm(null);
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm max-w-xs">
      <div className="flex items-center gap-2 text-violet-600">
        <Stamp className="w-3.5 h-3.5" />
        <span className="text-xs font-bold uppercase tracking-tight">Stamps</span>
      </div>

      {/* Create stamp from selection */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={stampName}
          onChange={e => setStampName(e.target.value)}
          placeholder="Stamp name..."
          className="flex-1 h-7 px-2 rounded-lg text-[10px] border border-slate-100 bg-slate-50 outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          onClick={handleCreate}
          disabled={selectedPieces.length < 1}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={selectedPieces.length < 1 ? 'Select 1+ pieces first' : 'Create stamp from selection'}
        >
          <Plus className="w-3 h-3" />
          Create
        </button>
      </div>

      {/* Include non-adjacent connectors option */}
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeNonAdjacent}
          onChange={e => setIncludeNonAdjacent(e.target.checked)}
          className="w-3 h-3 accent-violet-600"
        />
        <span className="text-[9px] text-slate-500">Include non-adjacent inward connectors</span>
      </label>

      {selectedPieces.length < 1 && (
        <p className="text-[9px] text-slate-400 italic">Select 1+ pieces to create a stamp</p>
      )}

      {/* Stamp source list */}
      {stampSources.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
              Stamps ({stampSources.length})
            </span>
            <button
              onClick={onRefreshStamps}
              className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-violet-600 transition-colors"
              title="Refresh all stamp boundaries from source pieces"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Refresh
            </button>
          </div>

          {stampSources.map(group => (
            <div key={group.id}>
              {deleteConfirm === group.id ? (
                <div className="flex flex-col gap-1 py-1 px-2 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-[9px] text-red-600 font-semibold">Delete stamp instances or convert?</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDeleteConfirm(group.id, 'delete')}
                      className="flex-1 h-6 rounded text-[9px] font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      Delete all
                    </button>
                    <button
                      onClick={() => handleDeleteConfirm(group.id, 'convert')}
                      className="flex-1 h-6 rounded text-[9px] font-bold bg-slate-500 text-white hover:bg-slate-600 transition-colors"
                    >
                      Convert
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="h-6 px-2 rounded text-[9px] text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 py-1 px-2 bg-slate-50 rounded-lg">
                  <span className="flex-1 text-[10px] font-semibold text-slate-700 truncate">
                    {group.stampName}
                  </span>
                  <span className="text-[9px] text-slate-400">{group.children.length}p</span>
                  <button
                    onClick={() => onPlaceStamp(group.id)}
                    className="p-1 rounded hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
                    title="Click to enter drag-and-drop placement mode"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(group.id)}
                    className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete stamp source"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
