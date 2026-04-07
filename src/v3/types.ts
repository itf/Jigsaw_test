import paper from 'paper';

export type Point = { x: number; y: number };

export enum AreaType {
  GROUP = 'GROUP',
  PIECE = 'PIECE'
}

export interface Area {
  id: string;
  parentId: string | null;
  type: AreaType;
  children: string[]; // IDs of child areas (for GROUP)
  boundary: paper.PathItem; // Paper.js PathItem representing the boundary
  color: string;
  seedPoint?: Point; // Optional, useful for grids
}

export interface PuzzleState {
  areas: Record<string, Area>;
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
