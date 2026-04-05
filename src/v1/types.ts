export interface Point {
  x: number;
  y: number;
}

export type OperationType = 
  | 'SET_DIMENSIONS'
  | 'ADD_POINTS'
  | 'GENERATE_RANDOM_POINTS'
  | 'ADD_WHIMSY'
  | 'ADD_CONNECTOR'
  | 'APPLY_TRANSFORMATION';

export interface Operation {
  id: string;
  type: OperationType;
  params: any;
  timestamp: number;
}

export type ConnectorType = 'TAB' | 'BALL' | 'SQUARE' | 'DOVETAIL' | 'ZIGZAG' | 'WAVE' | 'NONE' | 'STAMP';

export interface ConnectorConfig {
  type: ConnectorType;
  shapeId?: string;      // e.g., 'star', 'heart'
  offset: number;       // 0.0 to 1.0
  depth: number;        // 0.0 to 1.0 (magnitude)
  direction: 'IN' | 'OUT';
  scale: number;        // 0.5 to 2.0
  variationSeed?: number;
  isSlave?: boolean;
}

export interface Piece {
  id: string;
  seedIndex?: number;
  seedIndices?: number[];
  pathData: string;
  color: string;
  isWhimsy: boolean;
  isWarped: boolean;
}

export interface PuzzleState {
  width: number;
  height: number;
  points: Point[];
  whimsies: any[]; // SVG paths or contours
  connectors: any[];
  log: Operation[];
}
