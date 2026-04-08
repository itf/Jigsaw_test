import React from 'react';
import { Tab } from '../constants';
import { Area } from '../types';

interface V2ActionBarProps {
  activeTab: Tab;
  splittingHint: string | null;
  canSubdivide: boolean;
  splitPattern: 'GRID' | 'HEX' | 'RANDOM';
  setSplitPattern: (pattern: 'GRID' | 'HEX' | 'RANDOM') => void;
  gridRows: number;
  setGridRows: (rows: number) => void;
  gridCols: number;
  setGridCols: (cols: number) => void;
  hexRows: number;
  setHexRows: (rows: number) => void;
  hexCols: number;
  setHexCols: (cols: number) => void;
  randomPoints: number;
  setRandomPoints: (count: number) => void;
  subdivideSelectedPieces: () => void;
  selectedId: string | null;
  selectedType: 'AREA' | 'CONNECTOR' | 'NONE';
  mergePickIds: string[];
  mergeSelectedPieces: () => void;
  onClearSelection: () => void;
  whimsyTemplate: 'circle' | 'star';
  setWhimsyTemplate: (template: 'circle' | 'star') => void;
  whimsyScale: number;
  setWhimsyScale: (scale: number) => void;
  whimsyRotationDeg: number;
  setWhimsyRotationDeg: (rotation: number) => void;
  whimsyPlacementActive: boolean;
  startWhimsyPlacement: () => void;
  cancelWhimsyPlacement: () => void;
}

export const V2ActionBar: React.FC<V2ActionBarProps> = ({
  activeTab,
  splittingHint,
  canSubdivide,
  splitPattern,
  setSplitPattern,
  gridRows,
  setGridRows,
  gridCols,
  setGridCols,
  hexRows,
  setHexRows,
  hexCols,
  setHexCols,
  randomPoints,
  setRandomPoints,
  subdivideSelectedPieces,
  mergePickIds,
  mergeSelectedPieces,
  onClearSelection,
  whimsyTemplate,
  setWhimsyTemplate,
  whimsyScale,
  setWhimsyScale,
  whimsyRotationDeg,
  setWhimsyRotationDeg,
  whimsyPlacementActive,
  startWhimsyPlacement,
  cancelWhimsyPlacement,
}) => {
  return (
    <div className="shrink-0 px-4 py-3 bg-white border-b border-slate-200 space-y-3">
      {/* Subdivision Controls */}
      {activeTab === 'TOPOLOGY' && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Pattern:</label>
            <select
              value={splitPattern}
              onChange={(e) => setSplitPattern(e.target.value as any)}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="GRID">Grid</option>
              <option value="HEX">Hexagon</option>
              <option value="RANDOM">Random</option>
            </select>
          </div>

          {splitPattern === 'GRID' && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Rows:</label>
                <input
                  type="number"
                  value={gridRows}
                  onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="20"
                  className="w-12 px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Cols:</label>
                <input
                  type="number"
                  value={gridCols}
                  onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="20"
                  className="w-12 px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
            </>
          )}

          {splitPattern === 'HEX' && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Rows:</label>
                <input
                  type="number"
                  value={hexRows}
                  onChange={(e) => setHexRows(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="20"
                  className="w-12 px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Cols:</label>
                <input
                  type="number"
                  value={hexCols}
                  onChange={(e) => setHexCols(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="20"
                  className="w-12 px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
            </>
          )}

          {splitPattern === 'RANDOM' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Points:</label>
              <input
                type="number"
                value={randomPoints}
                onChange={(e) => setRandomPoints(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
                className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
          )}

          <button
            type="button"
            disabled={!canSubdivide}
            onClick={subdivideSelectedPieces}
            className={`px-3 py-1 rounded text-xs font-bold ${
              canSubdivide
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Subdivide {splittingHint && `(${splittingHint})`}
          </button>

          <button
            type="button"
            disabled={mergePickIds.length < 2}
            onClick={mergeSelectedPieces}
            className={`px-3 py-1 rounded text-xs font-bold ${
              mergePickIds.length >= 2
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Merge ({mergePickIds.length})
          </button>

          {mergePickIds.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="px-2 py-1 rounded text-xs font-bold text-slate-600 hover:bg-slate-200"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Whimsy Controls */}
      {activeTab === 'TOPOLOGY' && (
        <div className="flex items-center gap-4 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Whimsy:</label>
            <select
              value={whimsyTemplate}
              onChange={(e) => setWhimsyTemplate(e.target.value as any)}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="circle">Circle</option>
              <option value="star">Star</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Scale:</label>
            <input
              type="range"
              value={whimsyScale}
              onChange={(e) => setWhimsyScale(parseInt(e.target.value))}
              min="10"
              max="200"
              className="w-32"
            />
            <span className="text-xs text-slate-600">{whimsyScale}</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Rotation:</label>
            <input
              type="range"
              value={whimsyRotationDeg}
              onChange={(e) => setWhimsyRotationDeg(parseInt(e.target.value))}
              min="0"
              max="360"
              className="w-32"
            />
            <span className="text-xs text-slate-600">{whimsyRotationDeg}°</span>
          </div>

          {!whimsyPlacementActive ? (
            <button
              type="button"
              onClick={startWhimsyPlacement}
              className="px-3 py-1 rounded text-xs font-bold bg-purple-600 text-white hover:bg-purple-700"
            >
              Place Whimsy
            </button>
          ) : (
            <button
              type="button"
              onClick={cancelWhimsyPlacement}
              className="px-3 py-1 rounded text-xs font-bold bg-slate-400 text-white hover:bg-slate-500"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};
