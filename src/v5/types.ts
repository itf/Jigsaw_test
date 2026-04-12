import paper from 'paper';
import { StampSource } from '../v3/types/groupTemplateTypes';

export type Point = { x: number; y: number };

export enum AreaType {
  GROUP = 'GROUP',
  PIECE = 'PIECE',
  STAMP = 'STAMP'
}

/**
 * V5 Graph-based structures
 */

export interface Node {
  id: string;
  point: Point;
  incidentEdges: string[]; // IDs of edges connected to this node
}

export interface Edge {
  id: string;
  fromNode: string;
  toNode: string;
  pathData: string; // SVG path data for the edge geometry
  leftFace: string; // ID of the piece to the left
  rightFace: string; // ID of the piece to the right
}

export interface FaceEdge {
  id: string;
  reversed: boolean;
}

export interface Face {
  id: string;
  edges: FaceEdge[]; // Ordered list of edges with orientation forming the boundary
  color: string;
  groupMemberships: string[];
  seedPoint?: Point;
}

export interface Area {
  id: string;
  groupMemberships: string[];
  type: AreaType;
  children: string[]; 
  boundary: paper.PathItem; 
  color: string;
  seedPoint?: Point;

  // --- STAMP areas only ---
  stampSource?: StampSource;

  // --- Stamp-source GROUP areas only ---
  stampName?: string;
  includeNonAdjacentConnectors?: boolean;
  cachedBoundaryPathData?: string;
  cachedBounds?: { x: number; y: number; width: number; height: number };
}

export enum NeckShape {
  STANDARD = 'STANDARD',
  TAPERED = 'TAPERED',
  CURVED = 'CURVED'
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
  neckShape?: NeckShape;
  neckCurvature?: number;
  extrusionCurvature?: number;
}

export interface Whimsy {
  id: string;
  name: string;
  svgData: string;
  category?: string;
}

export interface PuzzleState {
  areas: Record<string, Area>;
  connectors: Record<string, Connector>;
  whimsies: Whimsy[];
  rootAreaId: string;
  width: number;
  height: number;
  
  // V5 Graph State
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
  faces: Record<string, Face>;
  useGraphMode: boolean;
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
