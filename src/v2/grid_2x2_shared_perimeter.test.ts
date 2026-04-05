import { describe, test, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { Area, AreaType } from './types';
import { getSharedPerimeter, getPointAtU } from './geometry';
import { resetPaperProject } from './paperProject';

describe('getSharedPerimeter 2x2 Grid Test', () => {
  beforeEach(() => {
    resetPaperProject(800, 600);
  });

  function createSquare(id: string, x: number, y: number, size: number): Area {
    const path = new paper.Path.Rectangle(new paper.Point(x, y), new paper.Size(size, size));
    const boundary = path.pathData;
    path.remove();
    return {
      id,
      parentId: 'root',
      type: AreaType.SUBDIVISION,
      children: [],
      boundary,
      seedPoint: { x: x + size / 2, y: y + size / 2 },
      isPiece: true,
      color: '#ff0000'
    };
  }

  test('2x2 grid shared edges and u-value ordering', () => {
    const size = 100;
    const p00 = createSquare('p00', 0, 0, size);
    const p10 = createSquare('p10', size, 0, size);
    const p01 = createSquare('p01', 0, size, size);
    const p11 = createSquare('p11', size, size, size);

    const testPairs = [
      { a: p00, b: p10, name: 'p00-p10 (Vertical Edge)' },
      { a: p00, b: p01, name: 'p00-p01 (Horizontal Edge)' },
      { a: p10, b: p11, name: 'p10-p11 (Horizontal Edge)' },
      { a: p01, b: p11, name: 'p01-p11 (Vertical Edge)' },
    ];

    testPairs.forEach(({ a, b }) => {
      const shared = getSharedPerimeter(a, b);
      expect(shared).not.toBeNull();
      if (!shared) return;

      const totalLength = (shared as paper.Path | paper.CompoundPath).length;

      // Test 8 values of u
      const points: paper.Point[] = [];
      for (let i = 0; i <= 7; i++) {
        const u = i / 7;
        const res = getPointAtU(shared, u);
        expect(res).not.toBeNull();
        if (res) {
          points.push(res.point);
        }
      }

      expect(points.length).toBe(8);

      // Verify ordering: points should move monotonically along one axis
      for (let i = 1; i < points.length; i++) {
        const d = points[i].getDistance(points[i - 1]);
        expect(d).toBeGreaterThan(0);
        
        const expectedDist = totalLength / 7;
        expect(Math.abs(d - expectedDist)).toBeLessThan(1.0);
      }

      shared.remove();
    });
  });

  test('T-junction shared edges', () => {
    // Piece A: Wide rectangle on top (200x100)
    const pA = createSquare('pA', 0, 0, 200);
    pA.boundary = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(200, 100)).pathData;
    
    // Piece B: Small square on bottom left (100x100)
    const pB = createSquare('pB', 0, 100, 100);
    
    // Piece C: Small square on bottom right (100x100)
    const pC = createSquare('pC', 100, 100, 100);

    // A shares half its bottom edge with B
    const sharedAB = getSharedPerimeter(pA, pB);
    expect(sharedAB).not.toBeNull();
    if (sharedAB) {
      const len = (sharedAB as paper.Path | paper.CompoundPath).length;
      expect(Math.abs(len - 100)).toBeLessThan(1.0);
      sharedAB.remove();
    }

    // A shares the other half with C
    const sharedAC = getSharedPerimeter(pA, pC);
    expect(sharedAC).not.toBeNull();
    if (sharedAC) {
      const len = (sharedAC as paper.Path | paper.CompoundPath).length;
      expect(Math.abs(len - 100)).toBeLessThan(1.0);
      sharedAC.remove();
    }

    // B and C share a vertical edge
    const sharedBC = getSharedPerimeter(pB, pC);
    expect(sharedBC).not.toBeNull();
    if (sharedBC) {
      const len = (sharedBC as paper.Path | paper.CompoundPath).length;
      expect(Math.abs(len - 100)).toBeLessThan(1.0);
      sharedBC.remove();
    }
  });

  test('getPointAtU with CompoundPath segments', () => {
    const p1 = new paper.Path.Line(new paper.Point(0, 0), new paper.Point(100, 0));
    const p2 = new paper.Path.Line(new paper.Point(200, 0), new paper.Point(300, 0));
    const compound = new paper.CompoundPath({ children: [p1, p2] });
    
    // Total length should be 200
    expect(compound.length).toBe(200);
    
    // u = 0.25 should be at (50, 0)
    const res1 = getPointAtU(compound, 0.25);
    expect(res1?.point.x).toBeCloseTo(50);
    
    // u = 0.5 should be at (100, 0)
    const res2 = getPointAtU(compound, 0.5);
    expect(res2?.point.x).toBeCloseTo(100);
    
    // u = 0.75 should be at (250, 0)
    const res3 = getPointAtU(compound, 0.75);
    expect(res3?.point.x).toBeCloseTo(250);
    
    compound.remove();
  });

  test('L-shape shared perimeter (corner)', () => {
    // Piece A: Square at (0,0)
    const pA = createSquare('pA', 0, 0, 100);
    
    // Piece B: L-shape that wraps around A's right and bottom sides
    const pB = {
      id: 'pB',
      parentId: 'root',
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: new paper.Path({
        segments: [
          [100, 0], [200, 0], [200, 200], [0, 200], [0, 100], [100, 100]
        ],
        closed: true
      }).pathData,
      seedPoint: { x: 150, y: 150 },
      isPiece: true,
      color: '#00ff00'
    };

    // A shares its right edge (x=100, y=0..100) and bottom edge (y=100, x=0..100) with B
    const shared = getSharedPerimeter(pA, pB);
    expect(shared).not.toBeNull();
    if (shared) {
      const len = (shared as paper.Path | paper.CompoundPath).length;
      expect(Math.abs(len - 200)).toBeLessThan(1.0);
      
      // Test u values
      const p0 = getPointAtU(shared, 0.01); // Near start
      const pMid = getPointAtU(shared, 0.5); // Near corner
      const pEnd = getPointAtU(shared, 0.99); // Near end
      
      expect(p0).not.toBeNull();
      expect(pMid).not.toBeNull();
      expect(pEnd).not.toBeNull();
      
      // Verify they are distinct
      expect(p0!.point.getDistance(pMid!.point)).toBeGreaterThan(50);
      expect(pMid!.point.getDistance(pEnd!.point)).toBeGreaterThan(50);
      
      shared.remove();
    }
  });

  test('3x3 grid middle square shared perimeter', () => {
    const size = 100;
    // Middle square E: (100, 100) to (200, 200)
    const pE = createSquare('pE', size, size, size);
    
    // Neighbors: Top, Bottom, Left, Right
    const bB = new paper.Path.Rectangle(new paper.Point(size, 0), new paper.Size(size, size));
    const bH = new paper.Path.Rectangle(new paper.Point(size, 2 * size), new paper.Size(size, size));
    const bD = new paper.Path.Rectangle(new paper.Point(0, size), new paper.Size(size, size));
    const bF = new paper.Path.Rectangle(new paper.Point(2 * size, size), new paper.Size(size, size));
    
    const combinedBoundary = new paper.CompoundPath({
      children: [bB, bH, bD, bF]
    });
    
    const pNeighbors: Area = {
      id: 'neighbors',
      parentId: 'root',
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: combinedBoundary.pathData,
      seedPoint: { x: 0, y: 0 },
      isPiece: false,
      color: '#0000ff'
    };
    
    combinedBoundary.remove();

    const shared = getSharedPerimeter(pE, pNeighbors);
    expect(shared).not.toBeNull();
    if (shared) {
      const len = (shared as paper.Path | paper.CompoundPath).length;
      // Should be 4 * 100 = 400
      expect(Math.abs(len - 400)).toBeLessThan(2.0);
      
      // u = 0, 0.25, 0.5, 0.75, 1 should be corners
      const uValues = [0, 0.25, 0.5, 0.75, 1];
      // paper.Path.Rectangle starts at top-left and goes clockwise
      const corners = [
        new paper.Point(size, size),         // TL: (100, 100)
        new paper.Point(2 * size, size),     // TR: (200, 100)
        new paper.Point(2 * size, 2 * size), // BR: (200, 200)
        new paper.Point(size, 2 * size)      // BL: (100, 200)
      ];
      
      const points = uValues.map(u => getPointAtU(shared, u)!.point);
      
      // Find which corner matches points[0]
      const startCornerIndex = corners.findIndex(c => points[0].getDistance(c) < 2.0);
      expect(startCornerIndex).not.toBe(-1);
      
      uValues.forEach((u, i) => {
        const expectedCorner = corners[(startCornerIndex + i) % 4];
        const dist = points[i].getDistance(expectedCorner);
        expect(dist).toBeLessThan(2.0);
      });
      
      shared.remove();
    }
  });
});
