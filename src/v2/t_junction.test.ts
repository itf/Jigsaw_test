import paper from 'paper';
import { describe, it, expect, beforeAll } from 'vitest';
import { AreaType } from './types';
import { getSharedPerimeter } from './geometry';
import { pathItemFromBoundaryData } from './paperProject';

function mkArea(id: string, boundary: string) {
  return {
    id,
    parentId: null,
    type: AreaType.SUBDIVISION,
    children: [],
    boundary,
    seedPoint: { x: 0, y: 0 },
    isPiece: true,
    color: '#000',
  };
}

describe('T-Junction Adjacency — getSharedPerimeter', () => {
  beforeAll(() => {
    paper.setup(new paper.Size(1000, 1000));
  });

  /**
   * Layout:
   *   A:  0,0–100,200  (tall left piece)
   *   B1: 100,0–200,100  (top-right:    shares TOP HALF of A's right edge)
   *   B2: 100,100–200,200 (bottom-right: shares BOTTOM HALF of A's right edge)
   *
   * T-junction: A's right edge is split between B1 and B2 — neither shares the whole edge.
   */
  it('A–B1: partial shared edge (T-junction, top half)', () => {
    const a  = mkArea('a',  'M0,0 L100,0 L100,200 L0,200 Z');
    const b1 = mkArea('b1', 'M100,0 L200,0 L200,100 L100,100 Z');
    const shared = getSharedPerimeter(a, b1);
    expect(shared).not.toBeNull();
    expect((shared as paper.Path).length).toBeGreaterThan(5);
    shared?.remove();
  });

  it('A–B2: partial shared edge (T-junction, bottom half)', () => {
    const a  = mkArea('a',  'M0,0 L100,0 L100,200 L0,200 Z');
    const b2 = mkArea('b2', 'M100,100 L200,100 L200,200 L100,200 Z');
    const shared = getSharedPerimeter(a, b2);
    expect(shared).not.toBeNull();
    expect((shared as paper.Path).length).toBeGreaterThan(5);
    shared?.remove();
  });

  it('B1–B2: full shared edge (stacked, same width)', () => {
    const b1 = mkArea('b1', 'M100,0 L200,0 L200,100 L100,100 Z');
    const b2 = mkArea('b2', 'M100,100 L200,100 L200,200 L100,200 Z');
    const shared = getSharedPerimeter(b1, b2);
    expect(shared).not.toBeNull();
    expect((shared as paper.Path).length).toBeGreaterThan(5);
    shared?.remove();
  });

  it('no shared edge for non-adjacent pieces', () => {
    const a = mkArea('a', 'M0,0 L100,0 L100,100 L0,100 Z');
    const b = mkArea('b', 'M200,0 L300,0 L300,100 L200,100 Z');
    const shared = getSharedPerimeter(a, b);
    // Pieces are 100px apart — must not produce a false shared edge
    expect(shared).toBeNull();
  });

  it('small piece T-junctioned against the middle of a long edge', () => {
    // Large: 0,0–400,100; Small: 100,100–200,200 — shares only x=100–200 of the large bottom edge
    const large = mkArea('large', 'M0,0 L400,0 L400,100 L0,100 Z');
    const small = mkArea('small', 'M100,100 L200,100 L200,200 L100,200 Z');
    const shared = getSharedPerimeter(large, small);
    expect(shared).not.toBeNull();
    // Shared chord length ≈ 100 (the overlap segment)
    expect((shared as paper.Path).length).toBeCloseTo(100, 0);
    shared?.remove();
  });

  it('pathItemFromBoundaryData round-trips SVG path data', () => {
    const d = 'M10,20 L110,20 L110,120 L10,120 Z';
    const p = pathItemFromBoundaryData(d);
    expect(p).toBeDefined();
    expect(Math.abs((p as paper.Path).area)).toBeGreaterThan(100);
    p.remove();
  });
});
