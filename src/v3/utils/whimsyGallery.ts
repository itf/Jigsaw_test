import { circlePathData } from './initialArea';

export type WhimsyTemplateId = 'circle' | 'star';

/** Normalized path centered at (0,0). Circle: radius 1. Star: outer radius 1. */
export function getWhimsyTemplatePathData(templateId: WhimsyTemplateId): string {
  switch (templateId) {
    case 'circle':
      return circlePathData(0, 0, 1, 72);
    case 'star':
      return fivePointStarPathData(1, 0.38);
    default:
      return '';
  }
}

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
