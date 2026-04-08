import { Point } from '../types';

/**
 * A connector slot positioned relative to a group's outer boundary.
 * These survive interior re-subdivision because they reference the group boundary,
 * not any individual piece.
 */
export interface BoundaryConnectorSlot {
  id: string;
  /** Sub-path index on the group boundary (for CompoundPath) */
  pathIndex: number;
  /** Normalized 0-1 position on that sub-path */
  midT: number;
  /** World-space position — fallback for re-parameterization at corners */
  worldPoint: Point;
  widthPx: number;
  extrusion: number;
  headTemplateId: string;
  headScale: number;
  headRotationDeg: number;
  useEquidistantHeadPoint?: boolean;
  jitter?: number;
  jitterSeed?: number;
}

/**
 * A group template captures the outer boundary of a set of pieces
 * plus the connector slots on that boundary. Multiple instances can
 * reference the same template.
 *
 * The boundary is live-linked: stored as source piece IDs and recomputed
 * when those pieces change. The cached pathData avoids recomputation on
 * every render.
 */
export interface GroupTemplate {
  id: string;
  name: string;
  /** IDs of the pieces whose union defines the boundary */
  sourcePieceIds: string[];
  /** Cached SVG path data — recomputed when source pieces change */
  cachedBoundaryPathData: string;
  /** Connector slots on the outer boundary — also recomputed with the cache */
  boundarySlots: BoundaryConnectorSlot[];
}

/**
 * Metadata on an Area that marks it as an instance of a GroupTemplate.
 * The instance boundary matches the template boundary (transformed).
 */
export interface GroupInstance {
  templateId: string;
  transform: {
    translateX: number;
    translateY: number;
    rotation: number;
    flipX: boolean;
  };
}
