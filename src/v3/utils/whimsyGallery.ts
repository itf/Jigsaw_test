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
  | 'bolt';

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
      // Note: Paper.js CompoundPath handles holes via winding or explicit children.
      // In SVG path data, we can just concatenate the paths.
      const outer = circlePathData(0, 0, 1, 72);
      const inner = circlePathData(0, 0, 0.4, 36); // Inner hole
      return `${outer} ${inner}`;
    case 'cloud':
      return `M -0.9 0.2 C -1.3 0.2, -1.3 -0.4, -0.9 -0.4 C -0.9 -1, -0.1 -1, 0.1 -0.6 C 0.5 -1, 1.1 -0.8, 1.1 -0.2 C 1.3 -0.2, 1.3 0.4, 0.9 0.4 C 0.9 1, -0.1 1, -0.3 0.6 C -0.7 1, -1.3 0.8, -0.9 0.2 Z`;
    case 'bolt':
      return `M 0.2 -1 L -0.8 0.2 L -0.2 0.2 L -0.2 1 L 0.8 -0.2 L 0.2 -0.2 Z`;
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
