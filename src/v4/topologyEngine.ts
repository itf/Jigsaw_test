import paper from 'paper';
import { Delaunay } from 'd3-delaunay';
import {
  Area,
  AreaType,
  PuzzleState,
  CreateRootShape,
  CreateGridParams,
  CreateHexGridParams,
  CreateRandomGridParams,
  MergePiecesParams,
  AddWhimsyParams,
  Point,
} from './types';
import {
  setupPaperProject,
  pathItemFromBoundaryData,
  pathItemToPathData,
  createRectanglePath,
  createCirclePath,
  pathsIntersect,
  unitePaths,
  subtractPaths,
  clonePath,
} from './paperUtils';

/**
 * Color palette for puzzle pieces
 */
const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80',
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8',
  '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'
];

/**
 * Initialize a new puzzle with the given root shape and dimensions.
 * This sets up the paper.js project once for all subsequent operations.
 */
export function createRootPuzzle(
  width: number,
  height: number,
  shape: CreateRootShape
): PuzzleState {
  // Setup paper project ONCE - all operations will use this project
  setupPaperProject(width, height);

  const rootId = generateId();
  let rootPath: paper.PathItem;

  switch (shape.variant) {
    case 'rect':
      rootPath = createRectanglePath(width, height);
      break;
    case 'circle':
      rootPath = createCirclePath(width, height);
      break;
    case 'multiCircle':
      // For now, we'll create the first circle
      // TODO: implement multi-circle support
      rootPath = createCirclePath(width, height);
      break;
    case 'svgContour':
      // TODO: implement SVG contour import
      rootPath = createRectanglePath(width, height);
      break;
  }

  const rootArea: Area = {
    id: rootId,
    type: 'piece',
    parentId: null,
    childrenIds: [],
    boundary: rootPath,
    boundaryPathData: pathItemToPathData(rootPath),
    color: COLORS[0],
  };

  return {
    areas: { [rootId]: rootArea },
    rootAreaId: rootId,
    width,
    height,
    history: [],
    selectedId: null,
  };
}

/**
 * Subdivide an area into a rectangular grid.
 * This turns the parent area into a 'group' and creates 'piece' areas inside it.
 */
export function createGridSubdivision(
  state: PuzzleState,
  params: CreateGridParams
): PuzzleState {
  const parent = state.areas[params.parentAreaId];
  if (!parent || !parent.boundary) {
    throw new Error(`Cannot subdivide area ${params.parentAreaId}: not a piece or not found`);
  }

  if (parent.type === 'group') {
    throw new Error(`Cannot subdivide area ${params.parentAreaId}: already a group`);
  }

  const bounds = parent.boundary.bounds;
  const cellWidth = bounds.width / params.cols;
  const cellHeight = bounds.height / params.rows;

  const newAreas: Record<string, Area> = { ...state.areas };
  const childrenIds: string[] = [];

  // Create grid cells
  for (let row = 0; row < params.rows; row++) {
    for (let col = 0; col < params.cols; col++) {
      const cellId = generateId();
      const x = bounds.x + col * cellWidth;
      const y = bounds.y + row * cellHeight;

      // Create a rectangular cell
      const cellPath = new paper.Path.Rectangle(
        new paper.Point(x, y),
        new paper.Size(cellWidth, cellHeight)
      );

      // Intersect with parent boundary to get actual cell geometry
      let clippedPath: paper.PathItem | null = null;
      try {
        const intersectResult = cellPath.intersect(parent.boundary, { insert: false });
        clippedPath = intersectResult as paper.PathItem;
      } catch (e) {
        console.error(`Intersection failed for cell at ${row},${col}:`, e);
      } finally {
        cellPath.remove();
      }

      if (clippedPath && !clippedPath.isEmpty?.()) {
        // Ensure clipped path has stroke properties
        try {
          clippedPath.strokeColor = new paper.Color('black');
          clippedPath.fillColor = new paper.Color(1, 1, 1, 0);
        } catch (e) {
          console.error(`Could not set stroke/fill for cell ${cellId}:`, e);
        }

        // Cache pathData immediately
        let pathDataStr = '';
        try {
          pathDataStr = pathItemToPathData(clippedPath);
          console.log(`✓ Cached pathData for grid cell ${cellId.slice(-8)}, length: ${pathDataStr.length}`);
        } catch (e) {
          console.error(`Could not cache pathData for cell ${cellId}:`, e);
        }

        const cellArea: Area = {
          id: cellId,
          type: 'piece',
          parentId: params.parentAreaId,
          childrenIds: [],
          boundary: clippedPath,
          boundaryPathData: pathDataStr,
          color: COLORS[(childrenIds.length) % COLORS.length],
        };

        newAreas[cellId] = cellArea;
        childrenIds.push(cellId);
      }
    }
  }

  // Convert parent to group
  const parentCopy = newAreas[params.parentAreaId];
  parentCopy.type = 'group';
  parentCopy.childrenIds = childrenIds;
  parentCopy.boundary = null;

  return {
    ...state,
    areas: newAreas,
  };
}

/**
 * Subdivide an area into a hexagonal grid.
 * This turns the parent area into a 'group' and creates 'piece' areas inside it.
 */
export function createHexGridSubdivision(
  state: PuzzleState,
  params: CreateHexGridParams
): PuzzleState {
  const parent = state.areas[params.parentAreaId];
  if (!parent || !parent.boundary) {
    throw new Error(`Cannot subdivide area ${params.parentAreaId}: not a piece or not found`);
  }

  if (parent.type === 'group') {
    throw new Error(`Cannot subdivide area ${params.parentAreaId}: already a group`);
  }

  // Generate hex grid points using v2's approach
  const bounds = parent.boundary.bounds;
  const points = generateHexGridPoints(
    { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    params.rows,
    params.cols
  );

  // Create Voronoi diagram to get cells
  const cells = createVoronoiCells(points, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, parent.boundary);

  const newAreas: Record<string, Area> = { ...state.areas };
  const childrenIds: string[] = [];

  // Create hex cells
  for (let i = 0; i < cells.length; i++) {
    const cellId = generateId();
    const clippedPath = cells[i];

    if (!clippedPath || clippedPath.isEmpty?.()) {
      clippedPath.remove();
      continue;
    }

    // Cache pathData immediately
    let pathDataStr = '';
    try {
      pathDataStr = pathItemToPathData(clippedPath);
    } catch (e) {
      console.error(`Could not cache pathData for hex cell ${cellId}:`, e);
    }

    const cellArea: Area = {
      id: cellId,
      type: 'piece',
      parentId: params.parentAreaId,
      childrenIds: [],
      boundary: clippedPath,
      boundaryPathData: pathDataStr,
      color: COLORS[(childrenIds.length) % COLORS.length],
    };

    newAreas[cellId] = cellArea;
    childrenIds.push(cellId);
  }

  // Convert parent to group
  const parentCopy = newAreas[params.parentAreaId];
  parentCopy.type = 'group';
  parentCopy.childrenIds = childrenIds;
  parentCopy.boundary = null;

  return {
    ...state,
    areas: newAreas,
  };
}

/**
 * Subdivide an area into random cells using Voronoi-like subdivision.
 */
export function createRandomGridSubdivision(
  state: PuzzleState,
  params: CreateRandomGridParams
): PuzzleState {
  const parent = state.areas[params.parentAreaId];
  if (!parent || !parent.boundary) {
    throw new Error(`Cannot subdivide area ${params.parentAreaId}: not a piece or not found`);
  }

  if (parent.type === 'group') {
    throw new Error(`Cannot subdivide area ${params.parentAreaId}: already a group`);
  }

  const bounds = parent.boundary.bounds;
  
  // Generate random seed points with optional jitter (v2-style approach)
  const points = generateGridPoints(
    { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    Math.max(1, Math.floor(Math.sqrt(params.pointCount / 2))),
    Math.max(1, Math.floor(Math.sqrt(params.pointCount / 2))),
    1.0  // Full jitter for randomness
  );

  // Create Voronoi diagram to get cells
  const cells = createVoronoiCells(points, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, parent.boundary);

  const newAreas: Record<string, Area> = { ...state.areas };
  const childrenIds: string[] = [];

  // Create random cells
  for (let i = 0; i < cells.length; i++) {
    const cellId = generateId();
    const clippedPath = cells[i];

    if (!clippedPath || clippedPath.isEmpty?.()) {
      clippedPath.remove();
      continue;
    }

    // Cache pathData immediately
    let pathDataStr = '';
    try {
      pathDataStr = pathItemToPathData(clippedPath);
    } catch (e) {
      console.error(`Could not cache pathData for random cell ${cellId}:`, e);
    }

    const cellArea: Area = {
      id: cellId,
      type: 'piece',
      parentId: params.parentAreaId,
      childrenIds: [],
      boundary: clippedPath,
      boundaryPathData: pathDataStr,
      color: COLORS[(childrenIds.length) % COLORS.length],
    };

    newAreas[cellId] = cellArea;
    childrenIds.push(cellId);
  }

  // Convert parent to group
  const parentCopy = newAreas[params.parentAreaId];
  parentCopy.type = 'group';
  parentCopy.childrenIds = childrenIds;
  parentCopy.boundary = null;

  return {
    ...state,
    areas: newAreas,
  };
}

/**
 * Merge two pieces by uniting their boundaries and deleting the originals.
 */
export function mergePieces(
  state: PuzzleState,
  params: MergePiecesParams
): PuzzleState {
  const pieceA = state.areas[params.pieceAId];
  const pieceB = state.areas[params.pieceBId];

  if (!pieceA || !pieceB || !pieceA.boundary || !pieceB.boundary) {
    throw new Error('Cannot merge: one or both pieces not found or have no boundary');
  }

  if (pieceA.type !== 'piece' || pieceB.type !== 'piece') {
    throw new Error('Cannot merge: both areas must be pieces');
  }

  // Check if they intersect
  if (!pathsIntersect(pieceA.boundary, pieceB.boundary)) {
    throw new Error('Cannot merge: pieces do not intersect');
  }

  // Unite the boundaries
  let unifiedPath: paper.PathItem;
  try {
    unifiedPath = pieceA.boundary.unite(pieceB.boundary, { insert: false }) as paper.PathItem;
  } catch (e) {
    console.error(`Union operation failed for pieces ${params.pieceAId} and ${params.pieceBId}:`, e);
    throw new Error(`Cannot merge: union operation failed`);
  }

  // Ensure unified path has stroke properties
  try {
    unifiedPath.strokeColor = new paper.Color('black');
    unifiedPath.fillColor = new paper.Color(1, 1, 1, 0);
  } catch (e) {
    console.error(`Could not set stroke/fill for merged piece:`, e);
  }

  const mergedId = generateId();
  const newAreas = { ...state.areas };

  // Delete the original pieces
  delete newAreas[params.pieceAId];
  delete newAreas[params.pieceBId];

  // Cache pathData for merged piece
  let mergedPathData = '';
  try {
    mergedPathData = pathItemToPathData(unifiedPath);
  } catch (e) {
    console.error(`Could not cache pathData for merged piece:`, e);
  }

  // Create the merged piece
  const mergedPiece: Area = {
    id: mergedId,
    type: 'piece',
    parentId: pieceA.parentId,
    childrenIds: [],
    boundary: unifiedPath,
    boundaryPathData: mergedPathData,
    color: pieceA.color,
  };

  newAreas[mergedId] = mergedPiece;

  // Update parent's children list if they have a common parent
  if (pieceA.parentId === pieceB.parentId && pieceA.parentId) {
    const parent = newAreas[pieceA.parentId];
    if (parent && parent.type === 'group') {
      parent.childrenIds = parent.childrenIds.filter(
        (id) => id !== params.pieceAId && id !== params.pieceBId
      );
      parent.childrenIds.push(mergedId);
    }
  }

  return {
    ...state,
    areas: newAreas,
  };
}

/**
 * Add a whimsy (subtract it from all intersecting pieces).
 */
export function addWhimsy(
  state: PuzzleState,
  params: AddWhimsyParams
): PuzzleState {
  const whimsyId = generateId();
  let whimsyPath: paper.PathItem;

  // Create whimsy path based on template
  switch (params.templateId) {
    case 'circle':
      whimsyPath = new paper.Path.Circle(
        new paper.Point(params.center.x, params.center.y),
        params.scale
      );
      break;
    case 'star':
      whimsyPath = createStarPath(
        new paper.Point(params.center.x, params.center.y),
        params.scale,
        5,
        params.rotationDeg
      );
      break;
  }

  const newAreas = { ...state.areas };

  // Find all pieces that intersect with the whimsy
  const intersectingPieceIds: string[] = [];
  for (const [areaId, area] of Object.entries(newAreas)) {
    if (area.type === 'piece' && area.boundary && pathsIntersect(area.boundary, whimsyPath)) {
      intersectingPieceIds.push(areaId);
    }
  }

  // Subtract whimsy from all intersecting pieces
  for (const pieceId of intersectingPieceIds) {
    const piece = newAreas[pieceId];
    if (piece && piece.boundary) {
      // Clone the whimsy path for each subtraction
      const whimsyClone = whimsyPath.clone() as paper.PathItem;
      let resultPath: paper.PathItem;
      
      try {
        resultPath = piece.boundary.subtract(whimsyClone, { insert: false }) as paper.PathItem;
      } catch (e) {
        console.error(`Subtraction failed for piece ${pieceId}:`, e);
        whimsyClone.remove();
        continue;
      }
      
      whimsyClone.remove();

      // Ensure result path has stroke properties
      try {
        resultPath.strokeColor = new paper.Color('black');
        resultPath.fillColor = new paper.Color(1, 1, 1, 0);
      } catch (e) {
        console.error(`Could not set stroke/fill for piece ${pieceId} after whimsy subtraction:`, e);
      }

      // Cache pathData for the modified piece
      let resultPathData = '';
      try {
        resultPathData = pathItemToPathData(resultPath);
      } catch (e) {
        console.error(`Could not cache pathData for piece ${pieceId} after whimsy:`, e);
      }

      piece.boundary = resultPath;
      piece.boundaryPathData = resultPathData;
    }
  }

  // Create the whimsy piece (keep it as-is, don't modify its boundary)
  let whimsyPathData = '';
  try {
    whimsyPathData = pathItemToPathData(whimsyPath);
  } catch (e) {
    console.error(`Could not cache pathData for whimsy piece:`, e);
  }

  const whimsy: Area = {
    id: whimsyId,
    type: 'piece',
    parentId: null, // Whimsies are not children of subdivisions
    childrenIds: [],
    boundary: whimsyPath,
    boundaryPathData: whimsyPathData,
    color: COLORS[COLORS.length - 1], // Use a distinct color
    label: 'whimsy',
  };
  newAreas[whimsyId] = whimsy;

  return {
    ...state,
    areas: newAreas,
  };
}

/**
 * Get all displayable pieces (leaf nodes with boundaries) from the puzzle state.
 */
export function getDisplayPieces(
  state: PuzzleState
): Array<{ id: string; pathData: string; color: string; label?: string }> {
  const pieces: Array<{ id: string; pathData: string; color: string; label?: string }> = [];
  console.log(`getDisplayPieces called with ${Object.keys(state.areas).length} total areas`);

  for (const [areaId, area] of Object.entries(state.areas)) {
    if (area.type === 'piece' && area.boundary) {
      try {
        // ONLY use cached pathData - NEVER access paper.js during render!
        const pathData = area.boundaryPathData;
        
        if (!pathData || typeof pathData !== 'string' || pathData.trim() === '') {
          console.error(`Missing or empty cached pathData for piece ${areaId.slice(-8)}`);
          // Skip this piece - don't try to compute it
          continue;
        }
        
        pieces.push({
          id: areaId,
          pathData,
          color: area.color,
          label: area.label,
        });
      } catch (error) {
        console.error(`Error processing piece ${areaId.slice(-8)}:`, error);
        // Skip this piece if we can't process it
        continue;
      }
    }
  }

  console.log(`getDisplayPieces returning ${pieces.length} displayable pieces`);
  return pieces;
}

/**
 * Helper: Clip a path to a boundary using intersection.
 */
function clipPathToBoundary(
  path: paper.PathItem,
  boundary: paper.PathItem
): paper.PathItem {
  const clipped = path.intersect(boundary, { insert: false });
  path.remove();
  
  // Ensure clipped path has stroke properties
  if (clipped instanceof paper.Path) {
    clipped.strokeColor = new paper.Color('black');
    clipped.fillColor = new paper.Color(1, 1, 1, 0);
  } else if (clipped instanceof paper.CompoundPath) {
    clipped.strokeColor = new paper.Color('black');
    clipped.fillColor = new paper.Color(1, 1, 1, 0);
  }
  
  return clipped;
}

/**
 * Helper: Create a hexagon path.
 */
function createHexagonPath(center: paper.Point, radius: number): paper.Path {
  const points: paper.Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    points.push(
      center.add(
        new paper.Point(radius * Math.cos(angle), radius * Math.sin(angle))
      )
    );
  }
  return new paper.Path(points);
}

/**
 * Helper: Create a star path.
 */
function createStarPath(
  center: paper.Point,
  radius: number,
  points: number,
  rotationDeg: number = 0
): paper.Path {
  const starPoints: paper.Point[] = [];
  const angleStep = (360 / points) * (Math.PI / 180);
  const rotation = (rotationDeg * Math.PI) / 180;

  for (let i = 0; i < points * 2; i++) {
    const angle = i * (angleStep / 2) + rotation;
    const r = i % 2 === 0 ? radius : radius / 2;
    starPoints.push(
      center.add(new paper.Point(r * Math.cos(angle), r * Math.sin(angle)))
    );
  }

  return new paper.Path(starPoints);
}

/**
 * Helper: Generate random points within bounds.
 */
function generateRandomPoints(
  bounds: paper.Rectangle,
  count: number,
  seed?: number
): Point[] {
  // Simple random generation (seeded if provided)
  const rng = seed ? seededRandom(seed) : Math.random;
  const points: Point[] = [];

  for (let i = 0; i < count; i++) {
    points.push({
      x: bounds.x + rng() * bounds.width,
      y: bounds.y + rng() * bounds.height,
    });
  }

  return points;
}

/**
 * Helper: Seeded random number generator (simple LCG).
 */
function seededRandom(seed: number) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/**
 * Generate hex grid seed points (similar to v2's generateHexGridPoints)
 */
function generateHexGridPoints(
  bounds: { x: number; y: number; width: number; height: number },
  rows: number,
  cols: number,
  jitter: number = 0
): Point[] {
  const points: Point[] = [];
  if (rows < 1 || cols < 1) return points;
  
  const vertDist = bounds.height / rows;
  const horizDist = bounds.width / cols;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = bounds.x + (c + 0.5) * horizDist;
      let y = bounds.y + (r + 0.5) * vertDist;
      
      // Stagger columns for hex pattern
      if (c % 2 === 1) y += vertDist / 2;
      
      // Optional jitter
      x += (Math.random() - 0.5) * jitter * horizDist * 0.15;
      y += (Math.random() - 0.5) * jitter * vertDist * 0.15;
      
      // Clamp to bounds
      x = Math.min(bounds.x + bounds.width, Math.max(bounds.x, x));
      y = Math.min(bounds.y + bounds.height, Math.max(bounds.y, y));
      
      points.push({ x, y });
    }
  }
  
  return points;
}

/**
 * Generate grid seed points with optional jitter (similar to v2's generateGridPoints)
 */
function generateGridPoints(
  bounds: { x: number; y: number; width: number; height: number },
  rows: number,
  cols: number,
  jitter: number = 0
): Point[] {
  const points: Point[] = [];
  if (rows < 1 || cols < 1) return points;
  
  const vertDist = bounds.height / rows;
  const horizDist = bounds.width / cols;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = bounds.x + (c + 0.5) * horizDist;
      let y = bounds.y + (r + 0.5) * vertDist;
      
      // Apply jitter
      x += (Math.random() - 0.5) * jitter * horizDist * 0.15;
      y += (Math.random() - 0.5) * jitter * vertDist * 0.15;
      
      // Clamp to bounds
      x = Math.min(bounds.x + bounds.width, Math.max(bounds.x, x));
      y = Math.min(bounds.y + bounds.height, Math.max(bounds.y, y));
      
      points.push({ x, y });
    }
  }
  
  return points;
}

/**
 * Create Voronoi cells from seed points (similar to v2 approach)
 */
function createVoronoiCells(
  points: Point[],
  bounds: { x: number; y: number; width: number; height: number },
  parentBoundary: paper.PathItem
): paper.PathItem[] {
  if (points.length === 0) return [];
  
  const delaunay = Delaunay.from(points.map((p: Point) => [p.x, p.y]));
  const voronoi = delaunay.voronoi([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height]);
  
  const cells: paper.PathItem[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const poly = voronoi.cellPolygon(i);
    if (!poly || poly.length < 3) continue;
    
    // Create path from polygon
    const cellPath = new paper.Path();
    cellPath.strokeColor = new paper.Color('black');
    cellPath.fillColor = new paper.Color(1, 1, 1, 0);
    
    poly.forEach((pt, j) => {
      if (j === 0) cellPath.moveTo(new paper.Point(pt[0], pt[1]));
      else cellPath.lineTo(new paper.Point(pt[0], pt[1]));
    });
    cellPath.closePath();
    
    // Intersect with parent boundary to get actual geometry
    let clipped: paper.PathItem | null = null;
    try {
      clipped = parentBoundary.intersect(cellPath, { insert: false }) as paper.PathItem;
    } catch (e) {
      console.error(`Intersection failed for Voronoi cell ${i}:`, e);
    } finally {
      cellPath.remove();
    }
    
    if (clipped && !clipped.isEmpty?.()) {
      // Ensure clipped path has stroke properties
      try {
        clipped.strokeColor = new paper.Color('black');
        clipped.fillColor = new paper.Color(1, 1, 1, 0);
      } catch (e) {
        console.error(`Could not set stroke/fill for Voronoi cell ${i}:`, e);
      }
      cells.push(clipped);
    }
  }
  
  return cells;
}

/**
 * Helper: Generate a unique ID.
 */
function generateId(): string {
  return `area_${Math.random().toString(36).substr(2, 9)}`;
}
