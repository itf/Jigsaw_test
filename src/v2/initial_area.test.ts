import { describe, it, expect } from 'vitest';
import paper from 'paper';
import { buildAreasFromInitialShape, circlePathData } from './initial_area';

describe('circlePathData', () => {
  it('returns a closed path with positive area', () => {
    const d = circlePathData(100, 50, 40);
    const p = new paper.Path(d);
    const area = Math.abs(p.area);
    p.remove();
    expect(area).toBeGreaterThan(0);
  });
});

describe('buildAreasFromInitialShape', () => {
  it('rect: single leaf root', () => {
    const m = buildAreasFromInitialShape(400, 300, { variant: 'rect' });
    expect(Object.keys(m)).toEqual(['root']);
    expect(m.root.isPiece).toBe(true);
    expect(m.root.boundary).toContain('M 0 0');
  });

  it('circle: single leaf root with circular boundary', () => {
    const m = buildAreasFromInitialShape(200, 200, { variant: 'circle' });
    expect(m.root.isPiece).toBe(true);
    const p = new paper.Path(m.root.boundary);
    const area = Math.abs(p.area);
    p.remove();
    expect(area).toBeGreaterThan(1000);
  });

  it('multiCircle: container root and two leaf pieces', () => {
    const m = buildAreasFromInitialShape(800, 600, { variant: 'multiCircle', count: 2 });
    expect(m.root.isPiece).toBe(false);
    expect(m.root.children).toHaveLength(2);
    const a = m['root-r0'];
    const b = m['root-r1'];
    expect(a?.isPiece && b?.isPiece).toBe(true);
    expect(a?.parentId).toBe('root');
    expect(b?.parentId).toBe('root');
  });
});
