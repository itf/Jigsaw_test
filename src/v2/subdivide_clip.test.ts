import { describe, it, expect } from 'vitest';
import paper from 'paper';
import { resolveSubdivideClipBoundary } from './geometry';
import { resetPaperProject } from './paperProject';

describe('resolveSubdivideClipBoundary', () => {
  it('replaces a full-bleed path with a hole by solid canvas rectangle (equal grid subdivide)', () => {
    resetPaperProject(100, 100);
    const outer = new paper.Path('M 0 0 L 100 0 L 100 100 L 0 100 Z');
    const hole = new paper.Path('M 40 40 L 60 40 L 60 60 L 40 60 Z');
    hole.clockwise = true;
    const diff = outer.subtract(hole);
    outer.remove();
    hole.remove();
    const cleaned = diff!.reduce({ insert: false }) as paper.PathItem;
    cleaned.reorient(true, true);
    const r = resolveSubdivideClipBoundary(cleaned, 100, 100);
    expect(r.bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(r.clipPathData).toMatch(/^M 0 0 L 100 0 L 100 100 L 0 100 Z$/);
    cleaned.remove();
  });

  it('keeps arbitrary material when bounds do not bleed the canvas', () => {
    resetPaperProject(200, 200);
    const small = new paper.Path('M 10 10 L 50 10 L 50 50 L 10 50 Z');
    const r = resolveSubdivideClipBoundary(small, 200, 200);
    expect(r.clipPathData).toBe(small.pathData);
    expect(r.bounds.x).toBeCloseTo(10, 2);
    small.remove();
  });
});
