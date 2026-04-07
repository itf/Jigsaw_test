/**
 * Generates SVG path data for a circle approximation.
 */
export function circlePathData(cx: number, cy: number, r: number, segments: number = 72): string {
  const parts: string[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i * 2 * Math.PI) / segments;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    parts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}
