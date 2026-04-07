import React from 'react';
import { Operation } from '../types';

interface V2HistoryPanelProps {
  history: Operation[];
  width: number;
  height: number;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatParams(op: Operation): React.ReactNode {
  const p = op.params;
  switch (op.type) {
    case 'MERGE':
    case 'MERGE_AREAS':
      return (
        <span>
          <Chip label={shortId(p.areaAId)} /> + <Chip label={shortId(p.areaBId)} />
        </span>
      );
    case 'SUBDIVIDE':
      return (
        <span>
          parent <Chip label={shortId(p.parentId)} />{' '}
          pattern <Chip label={p.pattern} />{' '}
          {p.points?.length != null && <><Chip label={`${p.points.length} pts`} /></>}
          {p.absorbedLeafIds?.length > 0 && <> absorbed <Chip label={`${p.absorbedLeafIds.length}`} /></>}
        </span>
      );
    case 'ADD_WHIMSY':
      return (
        <span>
          <Chip label={p.templateId} />{' '}
          @ ({Math.round(p.center?.x ?? 0)}, {Math.round(p.center?.y ?? 0)}){' '}
          scale <Chip label={String(p.scale)} />{' '}
          rot <Chip label={`${p.rotationDeg}°`} />
        </span>
      );
    case 'ADD_CONNECTOR':
      return (
        <span>
          <Chip label={shortId(p.areaAId)} /> ↔ <Chip label={shortId(p.areaBId)} />{' '}
          u=<Chip label={p.u?.toFixed(3)} />{' '}
          <Chip label={p.type} />{' '}
          size <Chip label={String(p.size)} />
          {p.isFlipped && <> <Chip label="flipped" color="amber" /></>}
          {p.clipOverlap && <> <Chip label="clip" color="amber" /></>}
        </span>
      );
    case 'RESOLVE_CONSTRAINTS':
      return <span className="text-slate-400 italic">—</span>;
    case 'TRANSFORM_GEOMETRY':
      return <span className="text-slate-400 italic">{JSON.stringify(p)}</span>;
    default:
      return <span className="text-slate-400 font-mono text-xs">{JSON.stringify(p)}</span>;
  }
}

function shortId(id: string | undefined): string {
  if (!id) return '?';
  const parts = id.split('-');
  // Keep last 2 segments for readability
  return parts.slice(-2).join('-');
}

function Chip({ label, color = 'indigo' }: { label: string; color?: 'indigo' | 'amber' }) {
  const cls =
    color === 'amber'
      ? 'bg-amber-100 text-amber-800 border border-amber-200'
      : 'bg-indigo-50 text-indigo-700 border border-indigo-100';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${cls}`}>{label}</span>;
}

const TYPE_COLORS: Record<string, string> = {
  MERGE: 'bg-rose-100 text-rose-700',
  MERGE_AREAS: 'bg-rose-100 text-rose-700',
  SUBDIVIDE: 'bg-blue-100 text-blue-700',
  ADD_WHIMSY: 'bg-purple-100 text-purple-700',
  ADD_CONNECTOR: 'bg-green-100 text-green-700',
  RESOLVE_CONSTRAINTS: 'bg-slate-100 text-slate-600',
  TRANSFORM_GEOMETRY: 'bg-orange-100 text-orange-700',
  CREATE_ROOT: 'bg-slate-100 text-slate-600',
};

export const V2HistoryPanel: React.FC<V2HistoryPanelProps> = ({ history, width, height }) => {
  const exportJson = () => {
    const payload = JSON.stringify({ width, height, history }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'puzzle-history.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-slate-700">Operation History</span>
          <span className="ml-2 text-xs text-slate-400">{history.length} operation{history.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{width} × {height} px</span>
          <button
            onClick={exportJson}
            className="px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium transition-colors"
          >
            Export JSON
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No operations yet.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-slate-500 w-8">#</th>
                <th className="text-left px-2 py-2 font-semibold text-slate-500 w-36">Type</th>
                <th className="text-left px-2 py-2 font-semibold text-slate-500">Parameters</th>
                <th className="text-left px-2 py-2 font-semibold text-slate-500 w-24">Time</th>
                <th className="text-left px-2 py-2 font-semibold text-slate-500 w-48">ID</th>
              </tr>
            </thead>
            <tbody>
              {history.map((op, i) => (
                <tr key={op.id} className="border-b border-slate-100 hover:bg-white transition-colors">
                  <td className="px-4 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] leading-snug ${TYPE_COLORS[op.type] ?? 'bg-slate-100 text-slate-600'}`}>
                      {op.type}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-slate-600 leading-relaxed">{formatParams(op)}</td>
                  <td className="px-2 py-2 text-slate-400 tabular-nums">{formatTimestamp(op.timestamp)}</td>
                  <td className="px-2 py-2 font-mono text-slate-300 text-[10px] truncate max-w-[12rem]" title={op.id}>{op.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
