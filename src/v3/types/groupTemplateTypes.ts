/**
 * A group template captures the outer boundary of a set of pieces
 * with connector geometry baked in (outward connectors united, inward
 * connectors subtracted). Multiple instances can reference the same template.
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
  /** Cached SVG path data — includes baked connector geometry */
  cachedBoundaryPathData: string;
  /** Bounds of the template boundary for centering on cursor during placement */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** When true, also subtract non-adjacent connectors whose bounding box overlaps the group */
  includeNonAdjacentConnectors?: boolean;
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
