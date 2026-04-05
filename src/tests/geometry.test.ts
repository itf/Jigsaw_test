import { describe, it, expect } from 'vitest';
import { createWhimsyPath, isPointInPath } from '../v1/geometry';
import paper from 'paper';

describe('Geometry Utilities', () => {
  it('should correctly identify points inside a square whimsy', () => {
    const center = { x: 100, y: 100 };
    const size = 50;
    const path = createWhimsyPath('SQUARE', center, size);
    
    // Inside
    expect(isPointInPath({ x: 100, y: 100 }, path)).toBe(true);
    expect(isPointInPath({ x: 140, y: 140 }, path)).toBe(true);
    
    // Outside
    expect(isPointInPath({ x: 160, y: 160 }, path)).toBe(false);
    expect(isPointInPath({ x: 40, y: 40 }, path)).toBe(false);
    
    path.remove();
  });

  it('should correctly identify points inside a heart whimsy', () => {
    const center = { x: 100, y: 100 };
    const size = 50;
    const path = createWhimsyPath('HEART', center, size);
    
    // Center point should be inside
    expect(isPointInPath(center, path)).toBe(true);
    
    // Far away point should be outside
    expect(isPointInPath({ x: 0, y: 0 }, path)).toBe(false);
    
    path.remove();
  });
});
