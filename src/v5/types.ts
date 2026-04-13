export type Point = { x: number; y: number };

// ---------------------------------------------------------------------------
// Graph primitives
// ---------------------------------------------------------------------------

export interface Node {
  id: string;
  point: Point;
  incidentEdges: string[];
}

export interface Edge {
  id: string;
  fromNode: string;
  toNode: string;
  path: paper.Path; // Live paper.js path
  leftFace: string;
  rightFace: string;
}

export interface FaceEdge {
  id: string;
  reversed: boolean;
}

export interface Face {
  id: string;
  edges: FaceEdge[];
  color: string;
  groupMemberships: string[];
  seedPoint?: Point;
}

// ---------------------------------------------------------------------------
// Whimsies
// ---------------------------------------------------------------------------

/** A whimsy that has been placed on the canvas but not yet merged into the graph. */
export interface FloatingWhimsy {
  id: string;
  templateId: string;
  svgData: string;     // raw SVG path data from whimsyGallery (normalized, not transformed)
  center: Point;
  scale: number;
  rotationDeg: number;
}

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

export enum NeckShape {
  STANDARD = 'STANDARD',
  TAPERED = 'TAPERED',
  CURVED = 'CURVED',
}

export interface ConnectorV5 {
  id: string;

  /** Edge the user clicked to place the connector midpoint. */
  midEdgeId: string;
  /** [0,1] position along midEdge where user clicked. */
  midT: number;
  /**
   * 'out' → connector protrudes into edge.rightFace  (source face = edge.leftFace)
   * 'in'  → connector protrudes into edge.leftFace   (source face = edge.rightFace)
   * The source faceId is NEVER stored; always derived at runtime from edge + direction.
   */
  direction: 'in' | 'out';

  // Computed at placement time; auto-remapped when edges are split:
  p1: { edgeId: string; t: number };
  p2: { edgeId: string; t: number };
  /** Edge-refs from p1→p2 along the source face boundary. Deleted at bake time. */
  replacedSegment: Array<{ edgeId: string; reversed: boolean }>;

  // Shape parameters (same as V3 Connector):
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

// ---------------------------------------------------------------------------
// Puzzle state
// ---------------------------------------------------------------------------

export interface PuzzleState {
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
  faces: Record<string, Face>;
  /** Whimsies placed on the canvas but not yet merged into the graph. */
  floatingWhimsies: FloatingWhimsy[];
  connectors: Record<string, ConnectorV5>;
  /** ID of the root (outer boundary) face. '' when no puzzle is loaded. */
  rootFaceId: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Whimsy library entry (for the gallery picker — not the same as FloatingWhimsy)
// ---------------------------------------------------------------------------

export interface WhimsyLibraryEntry {
  id: string;
  name: string;
  svgData: string;
  category?: string;
}
