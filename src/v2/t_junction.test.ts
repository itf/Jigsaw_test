import paper from 'paper';
import { describe, it, expect, beforeAll } from 'vitest';
import { pathItemFromBoundaryData, pathsTouch } from './geometry';

describe('T-Junction Adjacency Test', () => {
  beforeAll(() => {
    paper.setup(new paper.Size(1000, 1000));
  });

  it('should detect adjacency in a T-junction', () => {
    // Piece A: 0,0 to 100,200
    const areaA = {
      boundary: 'M0,0 L100,0 L100,200 L0,200 Z'
    };
    // Piece B1: 100,0 to 200,100 (Top half of A's right side)
    const areaB1 = {
      boundary: 'M100,0 L200,0 L200,100 L100,100 Z'
    };
    // Piece B2: 100,100 to 200,200 (Bottom half of A's right side)
    const areaB2 = {
      boundary: 'M100,100 L200,100 L200,200 L100,200 Z'
    };

    const pathA = pathItemFromBoundaryData(areaA.boundary);
    const pathB1 = pathItemFromBoundaryData(areaB1.boundary);
    const pathB2 = pathItemFromBoundaryData(areaB2.boundary);

    const touchA_B1 = pathsTouch(pathA, pathB1, 1.0);
    const touchA_B2 = pathsTouch(pathA, pathB2, 1.0);
    const touchB1_B2 = pathsTouch(pathB1, pathB2, 1.0);

    console.log('A touches B1:', touchA_B1);
    console.log('A touches B2:', touchA_B2);
    console.log('B1 touches B2:', touchB1_B2);

    // Verify intersection length
    const interA_B1 = pathA.intersect(pathB1);
    console.log('A intersect B1 length:', (interA_B1 as any).length);
    interA_B1.remove();

    expect(touchA_B1).toBe(true);
    expect(touchA_B2).toBe(true);
    expect(touchB1_B2).toBe(true);

    pathA.remove();
    pathB1.remove();
    pathB2.remove();
  });
});
