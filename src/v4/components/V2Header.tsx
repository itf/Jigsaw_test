import React from 'react';

interface V2HeaderProps {
  undo?: () => void;
  canUndo?: boolean;
}

export const V2Header: React.FC<V2HeaderProps> = ({ undo, canUndo }) => {
  return (
    <header className="shrink-0 px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-slate-900">Jigsaw Puzzle Editor</h1>
      </div>
      {undo && (
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
        >
          Undo
        </button>
      )}
    </header>
  );
};
