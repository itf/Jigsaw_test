import paper from 'paper';
import { circlePathData } from './initialArea';

export type WhimsyTemplateId = 
  | 'circle' 
  | 'star' 
  | 'square' 
  | 'triangle' 
  | 'heart' 
  | 'puzzle' 
  | 'donut' 
  | 'cloud' 
  | 'bolt'
  | 'fish'
  | 'bone'
  | 'snowman'
  | 'hexagon'
  | 'foot'
  | 'spiral';

/** Normalized path centered at (0,0). Most fit in a 2x2 box (radius 1). */
export function getWhimsyTemplatePathData(templateId: WhimsyTemplateId): string {
  switch (templateId) {
    case 'circle':
      return circlePathData(0, 0, 1, 72);
    case 'star':
      return fivePointStarPathData(1, 0.4);
    case 'square':
      return `M -1 -1 L 1 -1 L 1 1 L -1 1 Z`;
    case 'triangle':
      return `M 0 -1 L 1 1 L -1 1 Z`;
    case 'heart':
      return `M 0 -0.9 C -0.4 -1.5, -1.2 -1.1, -1.2 -0.3 C -1.2 0.5, -0.4 0.9, 0 1.5 C 0.4 0.9, 1.2 0.5, 1.2 -0.3 C 1.2 -1.1, 0.4 -1.5, 0 -0.9 Z`;
    case 'puzzle':
      return `M -1 -1 L -0.4 -1 C -0.4 -1.4, 0.4 -1.4, 0.4 -1 L 1 -1 L 1 -0.4 C 1.4 -0.4, 1.4 0.4, 1 0.4 L 1 1 L 0.4 1 C 0.4 0.6, -0.4 0.6, -0.4 1 L -1 1 L -1 0.4 C -0.6 0.4, -0.6 -0.4, -1 -0.4 Z`;
    case 'donut':
      // A circle with a hole. Outer radius 1, inner radius 0.4.
      // To ensure Paper.js treats it as a hole, the inner circle must have opposite winding (CCW).
      const outer = circlePathData(0, 0, 1, 72, true);
      const inner = circlePathData(0, 0, 0.4, 36, false); // Inner hole CCW
      return `${outer} ${inner}`;
    case 'cloud':
      return `M -0.9 0.2 C -1.3 0.2, -1.3 -0.4, -0.9 -0.4 C -0.9 -1, -0.1 -1, 0.1 -0.6 C 0.5 -1, 1.1 -0.8, 1.1 -0.2 C 1.3 -0.2, 1.3 0.4, 0.9 0.4 C 0.9 1, -0.1 1, -0.3 0.6 C -0.7 1, -1.3 0.8, -0.9 0.2 Z`;
    case 'bolt':
      return `M 0.2 -1 L -0.8 0.2 L -0.2 0.2 L -0.2 1 L 0.8 -0.2 L 0.2 -0.2 Z`;
    case 'fish':
      // Improved fish path with a better tail and no self-intersections
      return `M -1 0 C -1 -0.7, -0.2 -0.8, 0.4 -0.4 C 0.6 -0.6, 1.2 -0.8, 1.4 -0.4 L 1 0 L 1.4 0.4 C 1.2 0.8, 0.6 0.6, 0.4 0.4 C -0.2 0.8, -1 0.7, -1 0 Z`;
    case 'bone':
      return `M -0.6 -0.15 L 0.6 -0.15 C 0.6 -0.4, 1.0 -0.4, 1.0 -0.15 C 1.2 -0.15, 1.2 0.15, 1.0 0.15 C 1.0 0.4, 0.6 0.4, 0.6 0.15 L -0.6 0.15 C -0.6 0.4, -1.0 0.4, -1.0 0.15 C -1.2 0.15, -1.2 -0.15, -1.0 -0.15 C -1.0 -0.4, -0.6 -0.4, -0.6 -0.15 Z`;
    case 'snowman': {
      // Use Paper.js to unite two circles for a clean outline without self-intersections
      const top = new paper.Path.Circle({ center: [0, -0.45], radius: 0.4, insert: false });
      const bottom = new paper.Path.Circle({ center: [0, 0.35], radius: 0.65, insert: false });
      const united = bottom.unite(top);
      const data = united.pathData;
      top.remove();
      bottom.remove();
      united.remove();
      return data;
    }
    case 'hexagon':
      return hexagonPathData(1);
    case 'foot':
      return `M -0.2 0.8 C -0.5 0.8, -0.6 0.4, -0.6 0 C -0.6 -0.4, -0.4 -0.6, 0 -0.6 C 0.4 -0.6, 0.6 -0.4, 0.6 0 C 0.6 0.4, 0.5 0.8, 0.2 0.8 Z`;
    case 'spiral':
      return spiralPathData(1, 3);
    default:
      return '';
  }
}

export const DEFAULT_WHIMSIES: { id: WhimsyTemplateId, name: string, category: string }[] = [
  { id: 'circle', name: 'Circle', category: 'Basic' },
  { id: 'star', name: 'Star', category: 'Basic' },
  { id: 'square', name: 'Square', category: 'Basic' },
  { id: 'triangle', name: 'Triangle', category: 'Basic' },
  { id: 'heart', name: 'Heart', category: 'Shapes' },
  { id: 'puzzle', name: 'Puzzle', category: 'Shapes' },
  { id: 'donut', name: 'Donut (Hole)', category: 'Test' },
  { id: 'cloud', name: 'Cloud', category: 'Nature' },
  { id: 'bolt', name: 'Bolt', category: 'Nature' },
  { id: 'fish', name: 'Fish', category: 'Nature' },
  { id: 'bone', name: 'Bone', category: 'Shapes' },
  { id: 'snowman', name: 'Snowman', category: 'Shapes' },
  { id: 'hexagon', name: 'Hexagon', category: 'Shapes' },
  { id: 'foot', name: 'Foot', category: 'Nature' },
  { id: 'spiral', name: 'Spiral', category: 'Shapes' },
];

/** 5-point star, outer radius `outerR`, inner `innerR`, centered at origin. */
function fivePointStarPathData(outerR: number, innerR: number): string {
  const n = 5;
  const step = (Math.PI * 2) / n;
  const rot = -Math.PI / 2;
  const parts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rot + (i * step) / 2;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    parts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function hexagonPathData(r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6 - Math.PI / 2;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    parts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function spiralPathData(radius: number, turns: number): string {
  const parts: string[] = [];
  const steps = 100;
  // Outer spiral
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns;
    const r = t * radius;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    parts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  // Inner spiral (offset slightly to give thickness)
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns;
    const r = Math.max(0, t * radius - 0.15);
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    parts.push(`L ${x} ${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}
