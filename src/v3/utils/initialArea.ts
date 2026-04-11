/**
 * Generates SVG path data for a circle approximation.
 */
export function circlePathData(cx: number, cy: number, r: number, segments: number = 72, clockwise: boolean = true): string {
  // Move to the rightmost point of the circle
  const startX = cx + r;
  const startY = cy;

  const sweep = clockwise ? 1 : 0;

  // Use two arc commands to draw a complete circle
  return `M ${startX} ${startY} A ${r} ${r} 0 0 ${sweep} ${cx - r} ${cy} A ${r} ${r} 0 0 ${sweep} ${startX} ${startY} Z`;
}
