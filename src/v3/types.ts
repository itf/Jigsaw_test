import paper from 'paper';
import { StampSource } from './types/groupTemplateTypes';

export type Point = { x: number; y: number };

export enum AreaType {
  GROUP = 'GROUP',   // spatial container — subdivision result OR stamp source
  PIECE = 'PIECE',   // leaf piece
  STAMP = 'STAMP'    // placed instance of a source GROUP area
}

export interface Area {
  id: string;
  /** IDs of GROUP areas this area belongs to (replaces parentId). */
  groupMemberships: string[];
  type: AreaType;
  children: string[]; // IDs of child areas (for GROUP and STAMP)
  boundary: paper.PathItem; // Paper.js PathItem representing the boundary
  color: string;
  seedPoint?: Point; // Optional, useful for grids

  // --- STAMP areas only ---
  /** Present only on STAMP areas. References the source GROUP area. */
  stampSource?: StampSource;

  // --- Stamp-source GROUP areas only ---
  /** If set, this GROUP is a stamp source with this display name. */
  stampName?: string;
  /** When true, non-adjacent inward connectors are also subtracted from the boundary. */
  includeNonAdjacentConnectors?: boolean;
  /** Cached baked-connector boundary SVG path data. Recomputed when nearby connectors/whimsies change. */
  cachedBoundaryPathData?: string;
  /** Bounding box of cachedBoundaryPathData — stored so the canvas doesn't need Paper.js at render time. */
  cachedBounds?: { x: number; y: number; width: number; height: number };
}

export interface Connector {
  id: string;
  pieceId: string;
  pathIndex: number;
  midT: number;
  widthPx: number;
  extrusion: number;
  headTemplateId: string;
  headScale: number;
  headRotationDeg: number;
  useEquidistantHeadPoint?: boolean;
  jitter?: number;
  jitterSeed?: number;
  disabled?: boolean;
}

export interface Whimsy {
  id: string;
  name: string;
  svgData: string; // SVG path data (d attribute)
  category?: string;
}

export interface PuzzleState {
  areas: Record<string, Area>;
  connectors: Record<string, Connector>;
  whimsies: Whimsy[]; // Library of available whimsies
  rootAreaId: string;
  width: number;
  height: number;
}

export type OperationType =
  | 'CREATE_ROOT'
  | 'SUBDIVIDE_GRID'
  | 'MERGE_PIECES'
  | 'ADD_WHIMSY';

export interface Operation {
  id: string;
  type: OperationType;
  params: any;
  timestamp: number;
}
