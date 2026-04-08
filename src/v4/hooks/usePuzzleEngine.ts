import { useState, useCallback } from 'react';
import {
  PuzzleState,
  CreateRootShape,
  CreateGridParams,
  CreateHexGridParams,
  CreateRandomGridParams,
  MergePiecesParams,
  AddWhimsyParams,
  Operation,
} from '../types';
import {
  createRootPuzzle,
  createGridSubdivision,
  createHexGridSubdivision,
  createRandomGridSubdivision,
  mergePieces,
  addWhimsy,
  getDisplayPieces,
} from '../topologyEngine';

/**
 * Hook for managing puzzle state with undo/redo support
 */
export function usePuzzleEngine() {
  const [state, setState] = useState<PuzzleState | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [history, setHistory] = useState<PuzzleState[]>([]);

  const initializePuzzle = useCallback((width: number, height: number, shape: CreateRootShape) => {
    const newState = createRootPuzzle(width, height, shape);
    setState(newState);
    setHistory([newState]);
    setHistoryIndex(0);
  }, []);

  const addToHistory = useCallback((newState: PuzzleState) => {
    setState(newState);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const subdivideGrid = useCallback((params: CreateGridParams) => {
    if (!state) throw new Error('No puzzle initialized');
    const newState = createGridSubdivision(state, params);
    addToHistory(newState);
  }, [state, addToHistory]);

  const subdivideHexGrid = useCallback((params: CreateHexGridParams) => {
    if (!state) throw new Error('No puzzle initialized');
    const newState = createHexGridSubdivision(state, params);
    addToHistory(newState);
  }, [state, addToHistory]);

  const subdivideRandom = useCallback((params: CreateRandomGridParams) => {
    if (!state) throw new Error('No puzzle initialized');
    const newState = createRandomGridSubdivision(state, params);
    addToHistory(newState);
  }, [state, addToHistory]);

  const merge = useCallback((params: MergePiecesParams) => {
    if (!state) throw new Error('No puzzle initialized');
    const newState = mergePieces(state, params);
    addToHistory(newState);
  }, [state, addToHistory]);

  const addWhimsyPiece = useCallback((params: AddWhimsyParams) => {
    if (!state) throw new Error('No puzzle initialized');
    const newState = addWhimsy(state, params);
    addToHistory(newState);
  }, [state, addToHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setState(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setState(history[newIndex]);
    }
  }, [history, historyIndex]);

  const getDisplayPiecesData = useCallback(() => {
    if (!state) return [];
    return getDisplayPieces(state);
  }, [state]);

  return {
    state,
    initializePuzzle,
    subdivideGrid,
    subdivideHexGrid,
    subdivideRandom,
    merge,
    addWhimsyPiece,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    getDisplayPiecesData,
  };
}
