import { Point } from '../types';

/**
 * Generates points in a grid pattern within a rectangle.
 */
export function generateGridPoints(width: number, height: number, rows: number, cols: number, jitter: number = 0, bounds?: { x: number, y: number, width: number, height: number }): Point[] {
  const points: Point[] = [];
  const targetWidth = bounds ? bounds.width : width;
  const targetHeight = bounds ? bounds.height : height;
  const offsetX = bounds ? bounds.x : 0;
  const offsetY = bounds ? bounds.y : 0;
  
  const dx = targetWidth / cols;
  const dy = targetHeight / rows;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseX = offsetX + (c + 0.5) * dx;
      const baseY = offsetY + (r + 0.5) * dy;
      
      const x = baseX + (Math.random() - 0.5) * jitter * dx;
      const y = baseY + (Math.random() - 0.5) * jitter * dy;
      
      points.push({ 
        x: Math.round(x * 1000) / 1000, 
        y: Math.round(y * 1000) / 1000 
      });
    }
  }
  return points;
}

/**
 * Generates points in a hex grid pattern.
 */
export function generateHexGridPoints(width: number, height: number, rows: number, cols: number, jitter: number = 0, bounds?: { x: number, y: number, width: number, height: number }): Point[] {
  const points: Point[] = [];
  const targetWidth = bounds ? bounds.width : width;
  const targetHeight = bounds ? bounds.height : height;
  const offsetX = bounds ? bounds.x : 0;
  const offsetY = bounds ? bounds.y : 0;

  const dx = targetWidth / cols;
  const dy = targetHeight / rows;

  for (let r = 0; r < rows; r++) {
    const rowOffset = (r % 2 === 0) ? 0 : dx / 2;
    for (let c = 0; c < cols; c++) {
      const baseX = offsetX + c * dx + rowOffset + dx / 2;
      const baseY = offsetY + (r + 0.5) * dy;

      const x = baseX + (Math.random() - 0.5) * jitter * dx;
      const y = baseY + (Math.random() - 0.5) * jitter * dy;

      points.push({ 
        x: Math.round(x * 1000) / 1000, 
        y: Math.round(y * 1000) / 1000 
      });
    }
  }
  return points;
}

/**
 * Generates random points for a Voronoi subdivision.
 */
export function generateRandomPoints(width: number, height: number, count: number, bounds?: { x: number, y: number, width: number, height: number }): Point[] {
  const points: Point[] = [];
  const targetWidth = bounds ? bounds.width : width;
  const targetHeight = bounds ? bounds.height : height;
  const offsetX = bounds ? bounds.x : 0;
  const offsetY = bounds ? bounds.y : 0;

  for (let i = 0; i < count; i++) {
    points.push({
      x: offsetX + Math.random() * targetWidth,
      y: offsetY + Math.random() * targetHeight
    });
  }
  return points;
}
