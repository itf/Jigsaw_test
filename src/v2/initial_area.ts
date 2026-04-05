import { Area, AreaType, CreateRootShape } from './types';
import { COLORS } from './constants';

/** Closed SVG path approximating a circle (CCW), reusable for whimsy / seed regions. */
export function circlePathData(cx: number, cy: number, r: number, segments = 72): string {
  if (r <= 0) return `M ${cx} ${cy} Z`;
  const parts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    parts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Deep-enough copy so SUBDIVIDE can mutate `children` and replace entries without aliasing base state. */
export function cloneAreaMap(areas: Record<string, Area>): Record<string, Area> {
  return Object.fromEntries(
    Object.entries(areas).map(([k, v]) => [k, { ...v, children: [...v.children] }])
  ) as Record<string, Area>;
}

/**
 * Builds the initial `areas` map before any SUBDIVIDE / MERGE history.
 * Same boundaries can seed whimsy “pieces” before further splitting.
 */
export function buildAreasFromInitialShape(
  width: number,
  height: number,
  shape: CreateRootShape
): Record<string, Area> {
  const rectBoundary = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;

  switch (shape.variant) {
    case 'rect':
      return {
        root: {
          id: 'root',
          parentId: null,
          type: AreaType.ROOT,
          children: [],
          boundary: rectBoundary,
          seedPoint: { x: width / 2, y: height / 2 },
          isPiece: true,
          color: '#f1f5f9',
        },
      };

    case 'circle': {
      const r = Math.min(width, height) / 2;
      const cx = width / 2;
      const cy = height / 2;
      return {
        root: {
          id: 'root',
          parentId: null,
          type: AreaType.ROOT,
          children: [],
          boundary: circlePathData(cx, cy, r),
          seedPoint: { x: cx, y: cy },
          isPiece: true,
          color: '#f1f5f9',
        },
      };
    }

    case 'svgContour':
      return buildAreasFromInitialShape(width, height, { variant: 'rect' });

    case 'multiCircle': {
      const rRaw = Math.min(width / 4, height / 2);
      const r = rRaw * 0.9;
      const cx0 = width / 4;
      const cx1 = (3 * width) / 4;
      const cy = height / 2;
      const id0 = 'root-r0';
      const id1 = 'root-r1';
      return {
        root: {
          id: 'root',
          parentId: null,
          type: AreaType.ROOT,
          children: [id0, id1],
          boundary: rectBoundary,
          seedPoint: { x: width / 2, y: height / 2 },
          isPiece: false,
          color: '#f1f5f9',
        },
        [id0]: {
          id: id0,
          parentId: 'root',
          type: AreaType.SUBDIVISION,
          children: [],
          boundary: circlePathData(cx0, cy, r),
          seedPoint: { x: cx0, y: cy },
          isPiece: true,
          color: COLORS[0],
        },
        [id1]: {
          id: id1,
          parentId: 'root',
          type: AreaType.SUBDIVISION,
          children: [],
          boundary: circlePathData(cx1, cy, r),
          seedPoint: { x: cx1, y: cy },
          isPiece: true,
          color: COLORS[1],
        },
      };
    }
  }
}
