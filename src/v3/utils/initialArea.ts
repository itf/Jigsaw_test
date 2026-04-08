/**
 * Generates SVG path data for a circle approximation.
 */
export function circlePathData(cx: number, cy: number, r: number, segments: number = 72): string {
  // Move to the rightmost point of the circle
  const startX = cx + r;
  const startY = cy;

  // Use two arc commands to draw a complete circle (SVG can't draw a full circle with one arc)
  // First arc: top half of circle
  // Second arc: bottom half of circle
  return `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${startX} ${startY} Z`;
}