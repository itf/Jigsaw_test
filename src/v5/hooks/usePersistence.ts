import { useEffect, useCallback, useState } from 'react';
import { PuzzleState } from '../types';
import { serializePuzzleState, deserializePuzzleState, SerializablePuzzleState } from '../utils/serializationUtils';
import { downloadFile, uploadFile } from '../utils/fileUtils';

const STORAGE_KEY = 'jigsaw_studio_v5_state';

export function usePersistence(
  puzzleState: PuzzleState,
  loadState: (state: PuzzleState) => void
) {
  const [isReady, setIsReady] = useState(false);

  // 1. Auto-save to localStorage
  useEffect(() => {
    if (!puzzleState.rootFaceId || !isReady) return;

    const timer = setTimeout(() => {
      try {
        const serialized = serializePuzzleState(puzzleState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      } catch (e) {
        console.error('Failed to auto-save to localStorage:', e);
      }
    }, 1000); // Debounce saves

    return () => clearTimeout(timer);
  }, [puzzleState, isReady]);

  // 2. Initial load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const serializable = JSON.parse(saved) as SerializablePuzzleState;
        const state = deserializePuzzleState(serializable);
        loadState(state);
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
      }
    }
    setIsReady(true);
  }, []); // Run once on mount

  // 3. Export to .puzzle file
  const exportToFile = useCallback(() => {
    try {
      const serialized = serializePuzzleState(puzzleState);
      const content = JSON.stringify(serialized, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadFile(content, `puzzle-${timestamp}.puzzle`, 'application/json');
    } catch (e) {
      console.error('Failed to export puzzle:', e);
      alert('Failed to export puzzle. Check console for details.');
    }
  }, [puzzleState]);

  // 4. Import from .puzzle file
  const importFromFile = useCallback(async () => {
    try {
      const content = await uploadFile('.puzzle');
      const serializable = JSON.parse(content) as SerializablePuzzleState;
      const state = deserializePuzzleState(serializable);
      loadState(state);
    } catch (e) {
      console.error('Failed to import puzzle:', e);
      alert('Failed to import puzzle. Ensure it is a valid .puzzle file.');
    }
  }, [loadState]);

  const clearPersistence = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    isReady,
    exportToFile,
    importFromFile,
    clearPersistence
  };
}
