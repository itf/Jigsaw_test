import React, { useState } from 'react';
import { Copy, Trash2, Plus, RefreshCw, Layers } from 'lucide-react';
import { GroupTemplate } from '../types/groupTemplateTypes';

interface GroupTemplatePanelProps {
  groupTemplates: Record<string, GroupTemplate>;
  selectedIds: string[];
  onCreateTemplate: (name: string, pieceIds: string[]) => void;
  onPlaceTemplate: (templateId: string) => void;
  onRemoveTemplate: (templateId: string) => void;
  onRefreshCaches: () => void;
}

export const GroupTemplatePanel: React.FC<GroupTemplatePanelProps> = ({
  groupTemplates,
  selectedIds,
  onCreateTemplate,
  onPlaceTemplate,
  onRemoveTemplate,
  onRefreshCaches
}) => {
  const [templateName, setTemplateName] = useState('');
  const templates: GroupTemplate[] = Object.values(groupTemplates);

  const handleCreate = () => {
    if (selectedIds.length < 2) return;
    const name = templateName.trim() || `Group ${templates.length + 1}`;
    onCreateTemplate(name, selectedIds);
    setTemplateName('');
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm max-w-xs">
      <div className="flex items-center gap-2 text-violet-600">
        <Layers className="w-3.5 h-3.5" />
        <span className="text-xs font-bold uppercase tracking-tight">Group Templates</span>
      </div>

      {/* Create template from selection */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          placeholder="Template name..."
          className="flex-1 h-7 px-2 rounded-lg text-[10px] border border-slate-100 bg-slate-50 outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          onClick={handleCreate}
          disabled={selectedIds.length < 2}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={selectedIds.length < 2 ? 'Select 2+ pieces first' : 'Create template from selection'}
        >
          <Plus className="w-3 h-3" />
          Create
        </button>
      </div>

      {selectedIds.length < 2 && (
        <p className="text-[9px] text-slate-400 italic">Select 2+ adjacent pieces to create a template</p>
      )}

      {/* Template list */}
      {templates.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Templates ({templates.length})</span>
            <button
              onClick={onRefreshCaches}
              className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-violet-600 transition-colors"
              title="Refresh all template boundaries from source pieces"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Refresh
            </button>
          </div>

          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-1.5 py-1 px-2 bg-slate-50 rounded-lg">
              <span className="flex-1 text-[10px] font-semibold text-slate-700 truncate">{t.name}</span>
              <span className="text-[9px] text-slate-400">{t.sourcePieceIds.length}p · {t.boundarySlots.length}c</span>
              <button
                onClick={() => onPlaceTemplate(t.id)}
                className="p-1 rounded hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
                title="Click to enter drag-and-drop placement mode"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => onRemoveTemplate(t.id)}
                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                title="Delete template and all instances"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
