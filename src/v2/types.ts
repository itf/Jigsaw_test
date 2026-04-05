import paper from 'paper';

export type Point = { x: number; y: number };

export enum AreaType {
  ROOT = 'ROOT',
  SUBDIVISION = 'SUBDIVISION',
  WHIMSY = 'WHIMSY'
}

export interface Area {
  id: string;
  parentId: string | null;
  type: AreaType;
  children: string[]; // IDs of child areas
  
  // Geometry
  boundary: string; // SVG path data for the boundary
  seedPoint: Point; // The "center" or expansion seed
  
  // State
  isPiece: boolean; // True if it's a leaf node (a cuttable piece)
  color: string;
}

export interface Connector {
  id: string;
  areaAId: string;
  areaBId: string;
  u: number; // Normalized position [0, 1] along the shared perimeter
  isFlipped: boolean; // Toggles which side the connector points towards
  type: 'TAB' | 'DOVETAIL' | 'SQUARE' | 'HEART' | 'NONE';
  size: number;
  isDormant: boolean;
  /** Boolean engine only: subtract this connector’s stamp from every other piece whose geometry overlaps it (not only the adjacent neighbor). */
  clipOverlap?: boolean;

  // Resolved geometry (calculated by the solver)
  midpoint?: Point;
  isDeleted?: boolean; // Fallback if collision can't be resolved
}

export interface PuzzleState {
  areas: Record<string, Area>;
  connectors: Connector[];
  rootAreaId: string;
  width: number;
  height: number;
}

export type WhimsyTemplateId = 'circle' | 'star';

/** Params for `ADD_WHIMSY`. Placement is canvas-based; all overlapping leaves are cut. */
export interface AddWhimsyParams {
  templateId: WhimsyTemplateId;
  center: Point;
  scale: number;
  rotationDeg: number;
  /** Legacy replay: single-parent cut only. */
  parentId?: string;
  clipBoundary?: string;
  absorbedLeafIds?: string[];
}

/** Initial puzzle region(s) before SUBDIVIDE — same boundaries apply to whimsy seed “pieces”. */
export type CreateRootShape =
  | { variant: 'rect' }
  | { variant: 'circle' }
  | { variant: 'svgContour' }
  | { variant: 'multiCircle'; count: 2 };

export type OperationType = 
  | 'CREATE_ROOT'
  | 'SUBDIVIDE'
  | 'ADD_WHIMSY'
  | 'MERGE'
  | 'MERGE_AREAS'
  | 'ADD_CONNECTOR'
  | 'RESOLVE_CONSTRAINTS'
  | 'TRANSFORM_GEOMETRY';

export interface Operation {
  id: string;
  type: OperationType;
  params: any;
  timestamp: number;
}
