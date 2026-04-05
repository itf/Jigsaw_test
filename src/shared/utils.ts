export type Point = { x: number; y: number };

export const distance = (p1: Point, p2: Point) => 
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

export const lerp = (p1: Point, p2: Point, t: number): Point => ({
  x: p1.x + (p2.x - p1.x) * t,
  y: p1.y + (p2.y - p1.y) * t
});

export const getAngle = (p1: Point, p2: Point) => 
  Math.atan2(p2.y - p1.y, p2.x - p1.x);

export const rotatePoint = (p: Point, center: Point, angle: number): Point => {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  
  // Translate point back to origin
  const px = p.x - center.x;
  const py = p.y - center.y;
  
  // Rotate point
  const xnew = px * c - py * s;
  const ynew = px * s + py * c;
  
  // Translate point back
  return { x: xnew + center.x, y: ynew + center.y };
};
