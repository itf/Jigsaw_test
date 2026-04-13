import { PuzzleState, Node, Edge, Face, FloatingWhimsy, ConnectorV5 } from '../types';

export interface SerializablePuzzleState {
  version: '5.0.0';
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
  faces: Record<string, Face>;
  floatingWhimsies: FloatingWhimsy[];
  connectors: Record<string, ConnectorV5>;
  rootFaceId: string;
  width: number;
  height: number;
}

/**
 * Serialize PuzzleState to a plain JSON-compatible object.
 * V5 state contains no paper.js objects — pathData is already a string — so
 * this is a straight structural copy with a version tag.
 */
export function serializePuzzleState(state: PuzzleState): SerializablePuzzleState {
  return {
    version: '5.0.0',
    nodes: state.nodes,
    edges: state.edges,
    faces: state.faces,
    floatingWhimsies: state.floatingWhimsies,
    connectors: state.connectors,
    rootFaceId: state.rootFaceId,
    width: state.width,
    height: state.height,
  };
}

/**
 * Deserialize a saved state back to PuzzleState.
 * No paper.js reconstruction needed — edges store pathData as strings.
 */
export function deserializePuzzleState(serialized: SerializablePuzzleState): PuzzleState {
  if (serialized.version !== '5.0.0') {
    throw new Error(`Unsupported puzzle version: ${(serialized as any).version}. Expected 5.0.0`);
  }
  return {
    nodes: serialized.nodes ?? {},
    edges: serialized.edges ?? {},
    faces: serialized.faces ?? {},
    floatingWhimsies: serialized.floatingWhimsies ?? [],
    connectors: serialized.connectors ?? {},
    rootFaceId: serialized.rootFaceId ?? '',
    width: serialized.width ?? 2000,
    height: serialized.height ?? 2000,
  };
}
