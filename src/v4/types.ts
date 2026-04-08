import paper from 'paper';

export type Point = { x: number; y: number };

/**
 * Base area type that represents either a group or a piece.
 * Each area can be one of two types:
 * - 'group': A container for other areas (result of subdivisions)
 * - 'piece': A leaf node with a paper.js PathItem boundary
 */
export type AreaType = 'group' | 'piece';

/**
 * An Area represents either a group of other areas or a single piece.
 * Groups are created when subdividing, and pieces are the individual puzzle parts.
 */
export interface Area {
  id: string;
  type: AreaType;
  
  // Hierarchy
  parentId: string | null;
  childrenIds: string[]; // Only for 'group' type
  
  // Geometry (for 'piece' type, null for 'group')
  boundary: paper.PathItem | null; // paper.js PathItem for operations
  boundaryPathData?: string;        // Cached SVG path data string for rendering
  
  // Metadata
  color: string;
  label?: string;
}

/**
 * Operation types that can be performed on the puzzle state
 */
export type OperationType = 
  | 'CREATE_ROOT'
  | 'CREATE_GRID'
  | 'CREATE_HEX_GRID'
  | 'CREATE_RANDOM_GRID'
  | 'MERGE_PIECES'
  | 'ADD_WHIMSY';

/**
 * Operation record for undo/redo
 */
export interface Operation {
  id: string;
  type: OperationType;
  params: any;
  timestamp: number;
}

/**
 * The root shape for creating a new puzzle
 */
export type CreateRootShape =
  | { variant: 'rect' }
  | { variant: 'circle' }
  | { variant: 'svgContour' }
  | { variant: 'multiCircle'; count: 2 };

/**
 * Parameters for creating a grid subdivision
 */
export interface CreateGridParams {
  parentAreaId: string;
  rows: number;
  cols: number;
}

/**
 * Parameters for creating a hexagonal grid subdivision
 */
export interface CreateHexGridParams {
  parentAreaId: string;
  rows: number;
  cols: number;
}

/**
 * Parameters for creating a random grid subdivision
 */
export interface CreateRandomGridParams {
  parentAreaId: string;
  pointCount: number;
  seed?: number;
}

/**
 * Parameters for merging two pieces
 */
export interface MergePiecesParams {
  pieceAId: string;
  pieceBId: string;
}

/**
 * Whimsy type identifiers
 */
export type WhimsyTemplateId = 'circle' | 'star';

/**
 * Parameters for adding a whimsy
 */
export interface AddWhimsyParams {
  templateId: WhimsyTemplateId;
  center: Point;
  scale: number;
  rotationDeg: number;
}

/**
 * Complete puzzle state
 */
export interface PuzzleState {
  areas: Record<string, Area>;
  rootAreaId: string;
  width: number;
  height: number;
  history: Operation[];
  selectedId: string | null;
}

/**
 * Connector stub for future implementation
 */
export interface Connector {
  id: string;
  type: 'TAB' | 'DOVETAIL' | 'SQUARE' | 'HEART' | 'NONE';
}
