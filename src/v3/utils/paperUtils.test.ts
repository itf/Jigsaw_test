import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { removeDanglingEdges } from './paperUtils';

describe('removeDanglingEdges', () => {
  beforeEach(() => {
    const canvas = document.createElement('canvas');
    paper.setup(canvas);
  });

  it('should not remove a circle inside a square (hole)', () => {
    // Square: M0,0 L100,0 L100,100 L0,100 Z
    // Circle inside: M50,25 A25,25 0 1,1 50,75 A25,25 0 1,1 50,25 Z
    const square = 'M0,0 L100,0 L100,100 L0,100 Z';
    const circle = 'M50,25 A25,25 0 1,1 50,75 A25,25 0 1,1 50,25 Z';
    
    // We pass them as separate paths or as one compound path string
    const result = removeDanglingEdges([square, circle]);
    
    // We expect both to be preserved. 
    // The result might be a list of path data strings.
    expect(result.length).toBeGreaterThanOrEqual(2);
    
    // Check if we still have a "circle-like" path and a "square-like" path
    const combined = result.join(' ');
    expect(combined).toContain('M0,0'); // Square start
    expect(combined).toContain('M50,25'); // Circle start
  });

  it('should remove a single dangling line', () => {
    const line = 'M0,0 L100,100';
    const result = removeDanglingEdges([line]);
    expect(result.length).toBe(0);
  });

  it('should preserve a 3x3 grid and all its vertices', () => {
    // 3x3 grid: 4 horizontal lines, 4 vertical lines
    const paths: string[] = [];
    // Vertical lines
    for (let i = 0; i <= 3; i++) paths.push(`M${i * 10},0 L${i * 10},30`);
    // Horizontal lines
    for (let i = 0; i <= 3; i++) paths.push(`M0,${i * 10} L30,${i * 10}`);

    const result = removeDanglingEdges(paths);
    
    // Total length should be 4 * 30 + 4 * 30 = 240.
    const canvas = document.createElement('canvas');
    paper.setup(canvas);
    const item = new paper.CompoundPath(result.join(' '));
    expect(item.length).toBeCloseTo(240, 0);

    // Check vertices: all grid points should be present
    const vertices = new Set<string>();
    const getGridKey = (pt: paper.Point) => `${Math.round(pt.x)},${Math.round(pt.y)}`;
    
    item.children.forEach(child => {
      if (child instanceof paper.Path) {
        child.segments.forEach(seg => vertices.add(getGridKey(seg.point)));
      }
    });

    for (let x = 0; x <= 3; x++) {
      for (let y = 0; y <= 3; y++) {
        expect(vertices.has(`${x * 10},${y * 10}`)).toBe(true);
      }
    }
  });

  it('should not remove a square inside another square (separate paths)', () => {
    const outer = 'M0,0 L100,0 L100,100 L0,100 Z';
    const inner = 'M25,25 L75,25 L75,75 L25,75 Z';
    
    const result = removeDanglingEdges([outer, inner]);
    expect(result.length).toBeGreaterThanOrEqual(2);
    
    const combined = result.join(' ');
    expect(combined).toContain('M0,0');
    expect(combined).toContain('M25,25');
  });

  it('should deduplicate identical overlapping lines', () => {
    // Create a square with two identical top edges
    const top1 = 'M0,0 L100,0';
    const top2 = 'M0,0 L100,0';
    const right = 'M100,0 L100,100';
    const bottom = 'M100,100 L0,100';
    const left = 'M0,100 L0,0';
    
    const result = removeDanglingEdges([top1, top2, right, bottom, left]);
    
    // Should have 4 segments (one for each side of the square)
    expect(result.length).toBe(4);
    
    // Total length should be 400
    const canvas = document.createElement('canvas');
    paper.setup(canvas);
    const item = new paper.CompoundPath(result.join(' '));
    expect(item.length).toBeCloseTo(400, 0);
  });
});
