import paper from 'paper';
import { PuzzleState, Area, Connector, AreaType } from '../types';
import { pathItemFromBoundaryData } from './paperUtils';

export interface SerializableArea {
  id: string;
  groupMemberships: string[];
  type: AreaType;
  children: string[];
  boundaryData: string;
  color: string;
  seedPoint?: { x: number; y: number };
  stampSource?: any;
  stampName?: string;
  includeNonAdjacentConnectors?: boolean;
  cachedBoundaryPathData?: string;
  cachedBounds?: { x: number; y: number; width: number; height: number };
}

export interface SerializablePuzzleState {
  version: string;
  areas: Record<string, SerializableArea>;
  connectors: Record<string, Connector>;
  whimsies: any[];
  rootAreaId: string;
  width: number;
  height: number;
}

/**
 * Converts the runtime PuzzleState (with Paper.js objects) to a serializable JSON object.
 */
export function serializePuzzleState(state: PuzzleState): SerializablePuzzleState {
  const serializableAreas: Record<string, SerializableArea> = {};

  Object.entries(state.areas).forEach(([id, area]) => {
    const { boundary, ...rest } = area;
    serializableAreas[id] = {
      ...rest,
      boundaryData: boundary.pathData
    };
  });

  return {
    version: '3.0.0',
    areas: serializableAreas,
    connectors: state.connectors,
    whimsies: state.whimsies,
    rootAreaId: state.rootAreaId,
    width: state.width,
    height: state.height
  };
}

/**
 * Converts a serializable JSON object back to the runtime PuzzleState.
 */
export function deserializePuzzleState(serializable: SerializablePuzzleState): PuzzleState {
  const runtimeAreas: Record<string, Area> = {};

  Object.entries(serializable.areas).forEach(([id, sArea]) => {
    runtimeAreas[id] = {
      ...sArea,
      boundary: pathItemFromBoundaryData(sArea.boundaryData)
    };
  });

  return {
    areas: runtimeAreas,
    connectors: serializable.connectors,
    whimsies: serializable.whimsies,
    rootAreaId: serializable.rootAreaId,
    width: serializable.width,
    height: serializable.height
  };
}
