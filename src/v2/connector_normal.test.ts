import { describe, it, expect } from 'vitest';
import paper from 'paper';
import { orientConnectorNormalTowardNeighbor } from './geometry';
import { resetPaperProject } from './paperProject';

describe('orientConnectorNormalTowardNeighbor', () => {
  it('flips a chord normal that points away from the neighbor so a step lands inside the neighbor', () => {
    resetPaperProject(200, 200);
    const neighborBoundary = 'M 50 0 L 100 0 L 100 100 L 50 100 Z';
    const anchor = new paper.Point(50, 50);
    const wrongWay = new paper.Point(-1, 0);
    const n = orientConnectorNormalTowardNeighbor(anchor, wrongWay, neighborBoundary);
    const testPt = anchor.add(n.multiply(8));
    const p = new paper.Path(neighborBoundary);
    p.reorient(true, true);
    expect(p.contains(testPt)).toBe(true);
    p.remove();
  });

  it('keeps a normal that already points into the neighbor', () => {
    resetPaperProject(200, 200);
    const neighborBoundary = 'M 50 0 L 100 0 L 100 100 L 50 100 Z';
    const anchor = new paper.Point(50, 50);
    const already = new paper.Point(1, 0);
    const n = orientConnectorNormalTowardNeighbor(anchor, already, neighborBoundary);
    const testPt = anchor.add(n.multiply(8));
    const p = new paper.Path(neighborBoundary);
    p.reorient(true, true);
    expect(p.contains(testPt)).toBe(true);
    p.remove();
  });
});
