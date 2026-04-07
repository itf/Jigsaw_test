import paper from 'paper';
import { Area, AreaType, Operation, AddWhimsyParams, Point, WhimsyTemplateId } from './types';
import { COLORS } from './constants';
import { getWhimsyTemplatePathData } from './whimsy_gallery';
import { pathItemFromBoundaryData, resetPaperProject } from './paperProject';

const EPS_AREA = 1e-3;
export const WHIMSY_MIN_AREA_ABS = 400;
export const WHIMSY_MIN_FRAC_OF_MATERIAL = 0.003;
export const WHIMSY_WARN_REMAINDER_FRAC_OF_CANVAS = 0.012;

/**
 * Gets the absolute area of a PathItem (Path or CompoundPath).
 * Why: Paper.js areas can be negative or positive depending on winding order;
 * we always need the magnitude for area comparisons and validations.
 */
function absPathItemArea(item: paper.PathItem): number {
  return Math.abs((item as paper.Path | paper.CompoundPath).area);
}

/**
 * Calculates the centroid (center point) of a PathItem's bounding box.
 * Why: Used as a seed point for puzzle pieces to enable region detection and polygon fill logic.
 */
function pathCentroid(item: paper.PathItem): Point {
  const b = item.bounds;
  return { x: b.center.x, y: b.center.y };
}

/**
 * Creates a whimsy stencil (cutting template) by transforming a template shape.
 * What: Loads a template path, scales it, rotates it, and positions it at the given center.
 * Why: The stencil is the shape that will be added and subtracted from puzzle pieces.
 */
function makeStencil(templateId: WhimsyTemplateId, center: Point, scale: number, rotationDeg: number): paper.Path {
  const stem = getWhimsyTemplatePathData(templateId);
  const stencil = new paper.Path(stem);
  stencil.closed = true;
  stencil.scale(scale, new paper.Point(0, 0));
  stencil.rotate(rotationDeg, new paper.Point(0, 0));
  stencil.position = new paper.Point(center.x, center.y);
  stencil.reorient(true, true);
  return stencil;
}

/**
 * Converts a boolean operation result into valid PathItem(s), filtering out negligible areas.
 * What: Takes the raw result from Paper.js boolean operations (which may be Path or CompoundPath)
 *       and converts to standardized boundary data, removing any degenerate geometry.
 * Why: Ensures all geometry is properly normalized and has meaningful area before proceeding.
 *      CompoundPaths preserve holes and disjoint regions exactly as Paper.js produced them.
 */
function collectAreas(item: paper.PathItem | null): paper.PathItem[] {
  if (!item) return [];
  const reduced = item.reduce({ insert: false }) as paper.PathItem;
  if (Math.abs((reduced as paper.Path | paper.CompoundPath).area) <= EPS_AREA) {
    reduced.remove();
    return [];
  }
  if (reduced instanceof paper.Path) {
    const out = pathItemFromBoundaryData(reduced.pathData);
    reduced.remove();
    return [out];
  }
  if (reduced instanceof paper.CompoundPath) {
    // Keep hole/disjoint topology exactly as Paper produced it.
    const out = pathItemFromBoundaryData(reduced.pathData);
    reduced.remove();
    return Math.abs((out as paper.Path | paper.CompoundPath).area) > EPS_AREA ? [out] : [];
  }
  reduced.remove();
  return [];
}

/**
 * Merges multiple paths into a single unified path via boolean union.
 * What: Iteratively unions all input paths into one combined shape.
 * Why: After cutting the whimsy from multiple pieces, we need to combine all the
 *      intersection results into a single whimsy piece for the puzzle.
 */
function unionAll(paths: paper.PathItem[]): paper.PathItem | null {
  if (paths.length === 0) return null;
  let acc = paths[0];
  for (let i = 1; i < paths.length; i++) {
    const next = acc.unite(paths[i]);
    acc.remove();
    paths[i].remove();
    acc = next;
  }
  const reduced = acc.reduce({ insert: false }) as paper.PathItem;
  const out = pathItemFromBoundaryData(reduced.pathData);
  acc.remove();
  reduced.remove();
  return out;
}

/**
 * Finds the lowest common ancestor in the area hierarchy tree.
 * What: Given a list of leaf area IDs, traces each back to the root and finds their
 *       first common ancestor in the puzzle piece hierarchy.
 * Why: When a whimsy cut affects multiple pieces from the same parent, we assign the
 *      new whimsy piece to that parent to maintain the hierarchical structure.
 */
function lowestCommonAncestor(areas: Record<string, Area>, leafIds: string[]): string {
  if (leafIds.length === 0) return 'root';
  if (leafIds.length === 1) return areas[leafIds[0]]?.parentId ?? leafIds[0];
  const chains = leafIds.map(id => {
    const out: string[] = [];
    let cur: string | undefined = id;
    while (cur) {
      out.unshift(cur);
      cur = areas[cur]?.parentId ?? undefined;
    }
    return out;
  });
  const depthMax = Math.min(...chains.map(c => c.length));
  let depth = 0;
  for (; depth < depthMax; depth++) {
    const id0 = chains[0][depth];
    if (!chains.every(c => c[depth] === id0)) break;
  }
  return depth === 0 ? chains[0][0] : chains[0][depth - 1];
}

/**
 * Builds the SVG path data for a whimsy stencil without modifying the puzzle state.
 * What: Creates a stencil at the specified position, scale, and rotation, returning its path data.
 * Why: Used to preview the stencil shape before actually applying the cut operation.
 * Returns: SVG path data string representing the stencil's boundary.
 */
export function buildWhimsyStencilPathData(
  templateId: WhimsyTemplateId,
  center: Point,
  scale: number,
  rotationDeg: number,
  width: number,
  height: number
): string {
  resetPaperProject(width, height);
  const stencil = makeStencil(templateId, center, scale, rotationDeg);
  const d = stencil.pathData;
  stencil.remove();
  return d;
}

/**
 * CORE WHIMSY OPERATION: Adds a whimsy shape to the puzzle and subtracts it from intersecting pieces.
 *
 * WHAT THIS DOES:
 * 1. Creates a stencil (cutting shape) at the specified position, scale, and rotation
 * 2. For each affected piece:
 *    - Calculates the intersection of the stencil with the piece (the "hit" part)
 *    - Calculates the remainder (piece minus stencil)
 * 4. Updates the area hierarchy to reflect the cuts
 *
 * WHY WE DO THIS:
 * - Whimsies are decorative/functional cut-outs in puzzle pieces (e.g., stars, crescents)
 * - Cutting them involves adding a new piece (the whimsy itself) and removing it from
 *   the pieces it overlaps with (subtracting from intersecting areas)
 * - The hierarchy tracks parent-child relationships; we update parents when pieces change
 *
 * RETURNS:
 * - warnings: User-facing messages about validation failures or small remainder pieces
 * - remainderClusters: Groups of remainder pieces grouped by their original piece
 */
export type ApplyAddWhimsyResult = {
  warnings: string[];
  remainderClusters: { anchorRep: string; remainderIds: string[] }[];
};

/**
 * Applies the ADD_WHIMSY operation to the puzzle area state.
 *
 * OPERATION FLOW:
 * 1. Validate input and create the stencil
 * 2. Identify target pieces (either specific parent or all pieces)
 * 3. For each target piece:
 *    a. Intersect stencil with piece → "hit" regions (what becomes the whimsy)
 *    b. Subtract stencil from piece → "remainder" regions (what's left of the piece)
 * 4. Union all hit regions into one whimsy piece
 * 5. Validate the whimsy (minimum area constraints)
 * 6. Update the area hierarchy:
 *    - Remove affected pieces from their parents
 *    - Create new whimsy piece as sibling to affected pieces
 *    - Create remainder pieces as siblings to affected pieces
 *
 * WHY THIS MATTERS:
 * - The core puzzle operation: "add an area and subtract it from every area that it intersects"
 * - Validates that the result is meaningful (not too small)
 * - Maintains tree structure so hierarchical operations still work
 * - Warns about tiny remainder pieces that might need manual cleanup
 *
 * @param areas - Mutable record of all puzzle pieces
 * @param op - The operation descriptor containing whimsy parameters
 * @param width, height - Canvas dimensions for Paper.js context
 * @param find - Optional function to find canonical IDs (for grouping)
 * @returns Warnings and remainder piece groupings for post-processing
 */
export function applyAddWhimsyOp(
  areas: Record<string, Area>,
  op: Operation,
  width: number,
  height: number,
  find: (id: string) => string = id => id
): ApplyAddWhimsyResult {
  const warnings: string[] = [];
  if (op.type !== 'ADD_WHIMSY') return { warnings, remainderClusters: [] };

  // Extract operation parameters
  const params = op.params as AddWhimsyParams;
  const { templateId, center, scale, rotationDeg } = params;
  const canvasArea = width * height;

  // Initialize Paper.js workspace and create the cutting stencil
  // The stencil is the shape that defines what gets added and subtracted
  resetPaperProject(width, height);
  const stencil = makeStencil(templateId, center, scale, rotationDeg);

  // Identify target pieces: either a specific parent piece or all pieces in the puzzle
  const allLeaves = (Object.values(areas) as Area[]).filter(a => a.isPiece);
  const leaves = params.parentId
    ? allLeaves.filter(a => a.id === params.parentId)
    : allLeaves;

  type Cut = { leaf: Area; hit: paper.PathItem[]; remainder: paper.PathItem[] };
  const cuts: Cut[] = [];

  // === PHASE 1: Cut each leaf piece into "hit" (intersection) and "remainder" (what's left)
  // This is where the core operation happens: add the stencil AND subtract it from intersections
  for (const leaf of leaves) {
    // === BOUNDARY SELECTION LOGIC ===
    // This line decides which geometry to use as the "material" being cut:
    //   - If params.parentId is set: use clipBoundary (if provided) OR fall back to leaf.boundary
    //     This allows cutting a specific region within a parent piece
    //   - If params.parentId is NOT set: always use leaf.boundary (the full piece)
    // BUG POSSIBILITY #1: If clipBoundary is malformed or has precision issues, the subtract
    // might fail to properly remove the stencil since it's working on wrong geometry
    const boundary = params.parentId ? (params.clipBoundary ?? leaf.boundary) : leaf.boundary;
    
    // Convert boundary string (SVG path data) into a Paper.js PathItem object
    // This is where boundary data is parsed - any issues here propagate to boolean ops
    const materialA = pathItemFromBoundaryData(boundary);
    
    // Quick bounds check: if stencil doesn't even touch this piece, skip it
    // This is an optimization - no point doing expensive boolean ops if bounds don't intersect
    // BUG POSSIBILITY #2: If bounds check is too generous (expand(1)), it might skip pieces
    // that should be cut, or if bounds are computed wrong, it might include wrong pieces
    if (!materialA.bounds.intersects(stencil.bounds.clone().expand(1))) {
      materialA.remove();
      continue;
    }

    // === STEP 1A: Calculate the HIT (intersection) - what the stencil overlaps
    // This becomes part of the new whimsy piece
    // Clone the stencil for this operation (we need a fresh copy for each piece)
    // insert: true means Paper.js adds it to the canvas temporarily for boolean ops
    const stHit = stencil.clone({ insert: true }) as paper.Path;
    // Intersect the piece with the stencil - gets only the overlapping region
    const hitRaw = materialA.intersect(stHit);
    // Clean up the cloned stencil (no longer needed)
    stHit.remove();
    // Convert intersection result to standardized boundary data (handles Path vs CompoundPath)
    const hitAreas = collectAreas(hitRaw);
    // Sum up total area of all hit regions across the piece
    const hitArea = hitAreas.reduce((sum, p) => sum + absPathItemArea(p), 0);
    // Clean up the material we used for intersection
    materialA.remove();
    
    // If intersection is negligible (numerical noise), skip this piece
    // This avoids creating tiny, meaningless pieces from floating point artifacts
    if (hitArea <= EPS_AREA) {
      hitAreas.forEach(p => p.remove());
      continue;
    }

    // === STEP 1B: Calculate the REMAINDER (subtraction) - what's left after cutting out stencil
    // CRITICAL BUG LOCATION: Sometimes edges or small geometry survive inside the stencil bounds
    // This is where to focus debugging!
    
    // Create a SECOND copy of the material for subtraction (we need a fresh one, not the one used above)
    // Each boolean operation in Paper.js may modify or consume its inputs unpredictably
    // BUG POSSIBILITY #3: If we reuse materialA from the intersect op, it might be corrupted
    const materialB = pathItemFromBoundaryData(boundary);
    
    // Clone the stencil again for the subtract operation
    // Each boolean operation needs a fresh stencil to avoid state contamination
    const stRem = stencil.clone({ insert: true }) as paper.Path;
    
    // SUBTRACT operation: piece minus stencil = what should remain
    // This is the critical operation that should remove everything touched by stencil
    // BUG POSSIBILITY #4: Paper.js subtract() might not properly handle:
    //   - Self-intersecting boundaries (if boundary data is malformed)
    //   - Holes inside the piece (if topology is complex)
    //   - Floating point precision at the boundary between hit and remainder
    //   - Winding order mismatches (though reorient should fix this)
    const remRaw = materialB.subtract(stRem);
    
    // Clean up the cloned stencil used for subtract
    stRem.remove();
    
    // Clean up the material we used for subtraction
    materialB.remove();
    
    // Convert subtract result to standardized boundary data
    // BUG POSSIBILITY #5: collectAreas might not be removing tiny slivers that survived subtract
    // If a remainder piece has points that are technically inside the stencil bounds,
    // collectAreas won't catch this because it only checks area > EPS_AREA
    const remAreas = collectAreas(remRaw);
    
    // TODO: Add validation here to check if any remAreas have points inside stencil bounds
    // This could help detect when geometry improperly survives the subtract operation
    // You might want to log/warn if a remainder piece is very close to the stencil boundary
    // 
    // DEBUGGING SUGGESTION: After collectAreas, check each remainder:
    //   for (const rem of remAreas) {
    //     const remBounds = rem.bounds;
    //     const stBounds = stencil.bounds;
    //     if (remBounds.intersects(stBounds)) {
    //       console.warn('EDGE SURVIVAL DETECTED:', {
    //         remainderBounds: remBounds,
    //         stencilBounds: stBounds,
    //         intersection: remBounds.intersect(stBounds),
    //         remArea: absPathItemArea(rem)
    //       });
    //     }
    //   }

    cuts.push({ leaf, hit: hitAreas, remainder: remAreas });
  }

  if (cuts.length === 0) {
    stencil.remove();
    warnings.push('Whimsy does not overlap any piece; nothing added.');
    return { warnings, remainderClusters: [] };
  }

  // === PHASE 2: Create the whimsy piece from the stencil directly 
  
  // Use the stencil directly as the whimsy piece.
  // Clone and convert to standardized boundary format
  const whimsyUnified = stencil.clone({ insert: false }) as paper.Path;
  const whimsyUnifiedConverted = pathItemFromBoundaryData(whimsyUnified.pathData);
  whimsyUnified.remove();
  
  if (!whimsyUnifiedConverted || absPathItemArea(whimsyUnifiedConverted) <= EPS_AREA) {
    if (whimsyUnifiedConverted) whimsyUnifiedConverted.remove();
    cuts.forEach(c => c.remainder.forEach(p => p.remove()));
    stencil.remove();
    warnings.push('Whimsy stencil is empty or too small.');
    return { warnings, remainderClusters: [] };
  }
  
  // === ORIGINAL APPROACH (COMMENTED OUT FOR TESTING. This is equivalent to using the stencil) ===
  // const whimsyRawParts = cuts.flatMap(c => c.hit);
  // const whimsyUnified = unionAll(whimsyRawParts);
  // if (!whimsyUnified || absPathItemArea(whimsyUnified) <= EPS_AREA) {
  //   if (whimsyUnified) whimsyUnified.remove();
  //   cuts.forEach(c => c.remainder.forEach(p => p.remove()));
  //   stencil.remove();
  //   warnings.push('Whimsy overlap was empty after boolean ops.');
  //   return { warnings, remainderClusters: [] };
  // }

  // === PHASE 3: Validate the whimsy piece meets minimum size requirements
  // A whimsy that's too small doesn't make sense visually or functionally
  const materialArea = cuts.reduce((sum, c) => {
    const b = params.parentId ? (params.clipBoundary ?? c.leaf.boundary) : c.leaf.boundary;
    const p = pathItemFromBoundaryData(b);
    const a = absPathItemArea(p);
    p.remove();
    return sum + a;
  }, 0);
  const whimsyArea = absPathItemArea(whimsyUnifiedConverted);
  const minAllowed = Math.max(WHIMSY_MIN_AREA_ABS, materialArea * WHIMSY_MIN_FRAC_OF_MATERIAL);
  if (whimsyArea < minAllowed) {
    whimsyUnifiedConverted.remove();
    cuts.forEach(c => c.remainder.forEach(p => p.remove()));
    stencil.remove();
    warnings.push(
      `Whimsy overlap is too small (≈${Math.round(whimsyArea)} px², need ≥${Math.round(minAllowed)} px²). Increase scale or move center.`
    );
    return { warnings, remainderClusters: [] };
  }

  // === PHASE 4: Update the area hierarchy
  // Remove the affected leaf pieces from the tree and replace with whimsy + remainders
  const affectedIds = cuts.map(c => c.leaf.id);
  const lcaId = params.parentId ?? lowestCommonAncestor(areas, affectedIds);

  // Remove affected IDs from their parents' children lists
  for (const a of Object.values(areas) as Area[]) {
    if (a.children?.length) a.children = a.children.filter(id => !affectedIds.includes(id));
  }
  // Delete the affected pieces themselves (they're being replaced)
  for (const id of affectedIds) {
    if (id !== lcaId) delete areas[id];
  }

  // === PHASE 5: Create the new whimsy piece entry in the area map
  const opShort = op.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'wh';
  const whimsyId = `whimsy-${opShort}`;
  whimsyUnifiedConverted.reorient(true, true);
  areas[whimsyId] = {
    id: whimsyId,
    parentId: lcaId,
    type: AreaType.WHIMSY,
    children: [],
    boundary: whimsyUnifiedConverted.pathData,
    seedPoint: pathCentroid(whimsyUnifiedConverted),
    isPiece: true,
    color: '#a855f7',
  };
  whimsyUnifiedConverted.remove();

  // Update the parent to reflect that it now has this whimsy as a child
  // and it's no longer a piece itself (it's now a container)
  if (areas[lcaId]) {
    areas[lcaId].isPiece = false;
    areas[lcaId].children = [...areas[lcaId].children, whimsyId];
  }

  // === PHASE 6: Create remainder pieces from the cutoff regions
  // Set up clustering to group remainders by their source piece
  const clusters = new Map<string, string[]>();
  cuts.forEach(c => {
    const rep = find(c.leaf.id);
    if (!clusters.has(rep)) clusters.set(rep, []);
  });

  let remIdx = 0;
  for (const cut of cuts) {
    const parentId = cut.leaf.parentId ?? lcaId;
    for (const rp of cut.remainder) {
      const area = absPathItemArea(rp);
      // Warn about very small remainder pieces that might be hard to handle
      if (area > EPS_AREA && area < canvasArea * WHIMSY_WARN_REMAINDER_FRAC_OF_CANVAS) {
        warnings.push(
          `Remainder region ${remIdx + 1} is very small (≈${Math.round(area)} px²); consider merging or resizing.`
        );
      }
      const rid = `rest-${opShort}-${remIdx++}`;
      rp.reorient(true, true);
      areas[rid] = {
        id: rid,
        parentId,
        type: cut.leaf.type === AreaType.WHIMSY ? AreaType.WHIMSY : AreaType.SUBDIVISION,
        children: [],
        boundary: rp.pathData,
        seedPoint: pathCentroid(rp),
        isPiece: true,
        color: COLORS[(op.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + remIdx) % COLORS.length],
      };
      rp.remove();
      // Add remainder to parent's children list
      if (areas[parentId]) {
        areas[parentId].children = [...areas[parentId].children, rid];
      }
      // Track remainder for grouping
      const rep = find(cut.leaf.id);
      clusters.get(rep)?.push(rid);
    }
  }

  if (params.absorbedLeafIds?.length) {
    params.absorbedLeafIds.forEach(id => {
      if (id !== lcaId && id !== whimsyId) delete areas[id];
    });
  }

  stencil.remove();

  return {
    warnings,
    remainderClusters: Array.from(clusters.entries()).map(([anchorRep, remainderIds]) => ({
      anchorRep,
      remainderIds,
    })),
  };
}
