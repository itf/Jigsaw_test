import paper from 'paper';
import { Point, ConnectorType, ConnectorConfig } from './types';

// Initialize paper.js in a headless mode
paper.setup(new paper.Size(2000, 2000));

const STAMP_SHAPES: Record<string, string> = {
  'STAR': 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z',
  'HEART': 'M 50 30 C 20 -10 0 20 50 90 C 100 20 80 -10 50 30 Z',
  'BONE': 'M 20 40 C 0 40 0 20 20 20 C 30 20 30 40 40 40 L 60 40 C 70 40 70 20 80 20 C 100 20 100 40 80 40 C 80 50 80 50 80 60 C 100 60 100 80 80 80 C 70 80 70 60 60 60 L 40 60 C 30 60 30 80 20 80 C 0 80 0 60 20 60 C 20 50 20 50 20 40 Z',
  'PUZZLE': 'M 40 40 L 40 20 C 40 10 60 10 60 20 L 60 40 L 80 40 C 90 40 90 60 80 60 L 60 60 L 60 80 C 60 90 40 90 40 80 L 40 60 L 20 60 C 10 60 10 40 20 40 Z'
};

export const createWhimsyPath = (type: 'HEART' | 'STAR' | 'CUSTOM' | 'SQUARE', center: Point, size: number, rotation: number = 0, scale: number = 1, customPathData?: string) => {
// ... (rest of createWhimsyPath remains the same)
  let path: paper.PathItem;
  
  if (type === 'CUSTOM' && customPathData) {
    const imported = paper.project.importSVG(`<path d="${customPathData}" />`);
    if (imported instanceof paper.Path || imported instanceof paper.CompoundPath) {
      path = imported as any;
      path.position = new paper.Point(center.x, center.y);
      // Normalize size
      const bounds = path.bounds;
      const maxDim = Math.max(bounds.width, bounds.height);
      if (maxDim > 0) {
        path.scale((size * 2) / maxDim);
      }
    } else {
      path = new paper.Path();
    }
  } else if (type === 'HEART') {
    path = new paper.Path();
    path.moveTo(new paper.Point(center.x, center.y + size * 0.3));
    path.cubicCurveTo(
      new paper.Point(center.x - size, center.y - size),
      new paper.Point(center.x - size * 0.5, center.y - size * 1.5),
      new paper.Point(center.x, center.y - size * 0.5)
    );
    path.cubicCurveTo(
      new paper.Point(center.x + size * 0.5, center.y - size * 1.5),
      new paper.Point(center.x + size, center.y - size),
      new paper.Point(center.x, center.y + size * 0.3)
    );
  } else if (type === 'SQUARE') {
    path = new paper.Path.Rectangle({
      center: [center.x, center.y],
      size: [size * 2, size * 2]
    });
  } else {
    // Star
    const points = 5;
    const innerRadius = size * 0.4;
    const outerRadius = size;
    path = new paper.Path();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / points;
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r;
      if (i === 0) (path as paper.Path).moveTo(new paper.Point(x, y));
      else (path as paper.Path).lineTo(new paper.Point(x, y));
    }
  }
  if (path instanceof paper.Path) {
    path.closed = true;
  }
  
  if (rotation !== 0) path.rotate(rotation, new paper.Point(center.x, center.y));
  if (scale !== 1) path.scale(scale, new paper.Point(center.x, center.y));

  return path;
};

export const getWhimsyPathData = (type: 'HEART' | 'STAR' | 'CUSTOM' | 'SQUARE', center: Point, size: number, rotation: number = 0, scale: number = 1, customPathData?: string) => {
  const path = createWhimsyPath(type, center, size, rotation, scale, customPathData);
  const data = path.pathData;
  path.remove();
  return data;
};

export const isPointInPath = (point: Point, path: paper.PathItem) => {
  if (!path || path.isEmpty()) return false;
  const p = new paper.Point(point.x, point.y);
  
  // PERFORMANCE: Quick bounds check before expensive path operations
  if (!path.bounds.contains(p)) return false;
  
  // Standard contains check
  if (path.contains(p)) return true;
  
  // Tolerance check for points exactly on the edge
  // PERFORMANCE: getNearestPoint is expensive, only call if point is near bounds
  const nearest = path.getNearestPoint(p);
  if (nearest) {
    const dist = nearest.getDistance(p);
    return dist < 0.5; // 0.5 pixel tolerance
  }
  
  return false;
};

// Simple hash function for deterministic random values
const hashCoords = (p1: Point, p2: Point) => {
  const s = `${Math.min(p1.x, p2.x).toFixed(2)},${Math.min(p1.y, p2.y).toFixed(2)},${Math.max(p1.x, p2.x).toFixed(2)},${Math.max(p1.y, p2.y).toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return (hash % 1000) / 1000;
};

export const createConnectorStamp = (p1: Point, p2: Point, config: ConnectorConfig | ConnectorType = 'TAB', radius: number = 10, warp: boolean = false, rootPoint?: Point) => {
  const cfg: ConnectorConfig = typeof config === 'string' ? { type: config, offset: 0.5, depth: 1, direction: 'OUT', scale: 1 } : config;
  
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const midX = p1.x + dx * cfg.offset;
  const midY = p1.y + dy * cfg.offset;
  
  // Outward normal for CCW polygon: (dy, -dx)
  const nx = dy / len;
  const ny = -dx / len;
  const r = radius * cfg.scale;

  let stamp: paper.Path;

  if (cfg.type === 'STAMP' && cfg.shapeId) {
    const shapeData = STAMP_SHAPES[cfg.shapeId] || STAMP_SHAPES['PUZZLE'];
    stamp = new paper.Path(shapeData);
  } else if (cfg.type === 'BALL' || cfg.type === 'TAB') {
    stamp = new paper.Path.Circle(new paper.Point(50, 50), 50);
    if (cfg.type === 'TAB') {
      stamp.scale(1.2, 0.8);
    }
  } else if (cfg.type === 'SQUARE') {
    stamp = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(100, 100));
  } else if (cfg.type === 'DOVETAIL') {
    stamp = new paper.Path({
      segments: [[20, 100], [80, 100], [100, 0], [0, 0]],
      closed: true
    });
  } else if (cfg.type === 'ZIGZAG') {
    stamp = new paper.Path({
      segments: [[50, 100], [100, 0], [0, 0]],
      closed: true
    });
  } else if (cfg.type === 'WAVE') {
    stamp = new paper.Path({
      segments: [
        new paper.Point(0, 50),
        new paper.Point(25, 100),
        new paper.Point(50, 50),
        new paper.Point(75, 0),
        new paper.Point(100, 50)
      ],
      closed: true
    });
    stamp.segments.forEach(s => s.handleIn = s.handleOut = new paper.Point(0, 0));
    stamp.smooth({ type: 'catmull-rom' });
  } else {
    stamp = new paper.Path.Circle(new paper.Point(50, 50), 50);
  }

  // Normalize stamp to be centered at 0,0 and have size ~100x100
  const bounds = stamp.bounds;
  stamp.translate(new paper.Point(-bounds.center.x, -bounds.center.y));
  
  // Scale to desired radius (radius is distance from edge to peak)
  stamp.scale(r / 50);

  // Add a "bridge" (stem) to ensure the connector is always attached to the piece
  const depthSign = cfg.direction === 'OUT' ? 1 : -1;
  const dOffset = cfg.depth * r * 0.95 * depthSign;
  const stampPos = new paper.Point(midX + nx * dOffset, midY + ny * dOffset);
  
  const bridgeWidth = r * 0.9;
  const bridgeHeight = Math.abs(dOffset) + r * 1.5; // Deep enough to penetrate the piece
  
  // The bridge connects the stamp (at 0,0) back to the edge (at -dOffset)
  // In local coords, +Y is forward (outward for OUT)
  const bridge = new paper.Path.Rectangle({
    point: new paper.Point(-bridgeWidth / 2, dOffset > 0 ? -dOffset - r * 1.5 : -r * 0.1),
    size: [bridgeWidth, bridgeHeight] 
  });
  
  // PERFORMANCE: Using CompoundPath is much faster than unite() 
  // and works just as well for subsequent boolean operations on the piece.
  const combined = new paper.CompoundPath({
    children: [stamp, bridge]
  });
  stamp = combined as any;

  // Rotate to align with edge normal (stamp's +Y is forward)
  const angle = (Math.atan2(ny, nx) * (180 / Math.PI)) - 90;
  stamp.rotate(angle, new paper.Point(0, 0));

  // Position on edge
  stamp.translate(stampPos);

  // Deterministic variation
  if (warp) {
    const seed = cfg.variationSeed || hashCoords(p1, p2);
    stamp.segments.forEach((seg, i) => {
      const wobble = Math.sin(seed * 10 + i) * (r * 0.1);
      seg.point.x += nx * wobble;
      seg.point.y += ny * wobble;
    });
  }

  return stamp;
};

/**
 * Creates a puzzle piece path by applying connectors to a base polygon.
 */
export const createCellPath = (
  polygon: number[][], 
  width: number, 
  height: number, 
  tabRadius: number, 
  warp: boolean,
  edgeConnectors?: (ConnectorConfig | ConnectorType | undefined)[],
  edgeStamps?: (paper.Path | null)[],
  neighborPolygons?: (number[][] | null)[]
): paper.PathItem => {
  if (!polygon || polygon.length < 3) return new paper.Path();
  
  // 1. Create base polygon
  let piecePath: paper.PathItem = new paper.Path();
  polygon.forEach((p, i) => {
    if (i === 0) (piecePath as paper.Path).moveTo(new paper.Point(p[0], p[1]));
    else (piecePath as paper.Path).lineTo(new paper.Point(p[0], p[1]));
  });
  (piecePath as paper.Path).closePath();

  // 2. Apply connectors via boolean operations
  for (let i = 0; i < polygon.length - 1; i++) {
    const config = edgeConnectors?.[i];
    if (!config || config === 'NONE') continue;

    const cfg: ConnectorConfig = typeof config === 'string' 
      ? { type: config, offset: 0.5, depth: 1, direction: 'OUT', scale: 1 } 
      : config;
    
    if (cfg.type === 'NONE') continue;

    const p1 = { x: polygon[i][0], y: polygon[i][1] };
    const p2 = { x: polygon[i+1][0], y: polygon[i+1][1] };
    
    // Skip boundary edges
    const isBoundary = 
      (Math.abs(p1.x) < 0.1 && Math.abs(p2.x) < 0.1) || 
      (Math.abs(p1.x - width) < 0.1 && Math.abs(p2.x - width) < 0.1) || 
      (Math.abs(p1.y) < 0.1 && Math.abs(p2.y) < 0.1) || 
      (Math.abs(p1.y - height) < 0.1 && Math.abs(p2.y - height) < 0.1);

    if (isBoundary) continue;

    // Use pre-generated stamp if available, otherwise create one
    let stamp: paper.Path;
    if (edgeStamps && edgeStamps[i]) {
      stamp = edgeStamps[i]!.clone() as paper.Path;
    } else {
      stamp = createConnectorStamp(p1, p2, cfg, tabRadius, warp);
    }
    
    const isAdding = cfg.direction === 'OUT';
    
    // Clip connector to ensure it doesn't overlap non-neighbors
    let processedStamp: paper.PathItem = stamp;
    if (isAdding && neighborPolygons && neighborPolygons[i]) {
      const neighborPath = new paper.Path();
      neighborPolygons[i]!.forEach((p, idx) => {
        if (idx === 0) neighborPath.moveTo(new paper.Point(p[0], p[1]));
        else neighborPath.lineTo(new paper.Point(p[0], p[1]));
      });
      neighborPath.closePath();
      
      processedStamp = stamp.intersect(neighborPath);
      stamp.remove();
      neighborPath.remove();
    } else if (!isAdding) {
      // For holes, ensure they stay within the current piece
      processedStamp = stamp.intersect(piecePath);
      stamp.remove();
    }

    // Apply boolean operation
    const newPath = isAdding 
      ? piecePath.unite(processedStamp) 
      : piecePath.subtract(processedStamp);
    
    piecePath.remove();
    processedStamp.remove();
    piecePath = newPath;
  }

  return piecePath;
};
