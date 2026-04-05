import { describe, test, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { Area, AreaType, Operation } from './types';
import { getSharedPerimeter, getPointAtU, generateGridPoints } from './geometry';
import { resetPaperProject, pathItemFromBoundaryData } from './paperProject';
import { Delaunay } from 'd3-delaunay';
import { COLORS } from './constants';

describe('3x3 Grid Subdivide Test', () => {
  beforeEach(() => {
    resetPaperProject(800, 600);
  });

  function applySubdivide(areas: Record<string, Area>, op: Operation, width: number, height: number) {
    const { parentId, points, clipBoundary, absorbedLeafIds } = op.params;
    const parent = areas[parentId];
    if (!parent) return;

    const boundaryData = (clipBoundary as string | undefined) ?? parent.boundary;
    const parentPath0 = pathItemFromBoundaryData(boundaryData);
    const pb = parentPath0.bounds;
    parentPath0.remove();
    const delaunay = Delaunay.from(points.map((p: any) => [p.x, p.y]));
    const voronoi = delaunay.voronoi([pb.x, pb.y, pb.x + pb.width, pb.y + pb.height]);

    const childIds: string[] = [];
    points.forEach((p: any, i: number) => {
      const poly = voronoi.cellPolygon(i);
      if (!poly) return;

      const childId = `${parentId}-child-${i}`;
      childIds.push(childId);

      const parentPath = pathItemFromBoundaryData(boundaryData);
      const cellPath = new paper.Path();
      poly.forEach((pt, j) => {
        if (j === 0) cellPath.moveTo(new paper.Point(pt[0], pt[1]));
        else cellPath.lineTo(new paper.Point(pt[0], pt[1]));
      });
      cellPath.closePath();

      const clipped = parentPath.intersect(cellPath);
      const boundary = clipped.pathData;

      areas[childId] = {
        id: childId,
        parentId,
        type: AreaType.SUBDIVISION,
        children: [],
        boundary,
        seedPoint: p,
        isPiece: true,
        color: COLORS[i % COLORS.length]
      };

      parentPath.remove();
      cellPath.remove();
      clipped.remove();
    });

    areas[parentId] = { ...parent, children: childIds, isPiece: false };
  }

  test('3x3 grid middle square shared perimeter with subdivide', () => {
    const width = 300;
    const height = 300;
    const root: Area = {
      id: 'root',
      parentId: '',
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(width, height)).pathData,
      seedPoint: { x: 150, y: 150 },
      isPiece: true,
      color: '#ffffff'
    };

    const areas: Record<string, Area> = { root };
    const points = generateGridPoints(width, height, 3, 3, 0);
    
    const op: Operation = {
      id: 'sub-1',
      type: 'SUBDIVIDE',
      params: { parentId: 'root', points },
      timestamp: Date.now()
    };

    applySubdivide(areas, op, width, height);

    // Middle square should be child 4
    const pE = areas['root-child-4'];
    expect(pE).toBeDefined();

    // Ensure it's CCW (Voronoi usually is)
    const pEPath = pathItemFromBoundaryData(pE.boundary) as paper.Path;
    if (pEPath.clockwise) pEPath.reverse();
    pE.boundary = pEPath.pathData;
    pEPath.remove();

    // Neighbors are 1, 3, 5, 7
    const neighbors = ['root-child-1', 'root-child-3', 'root-child-5', 'root-child-7'].map(id => areas[id]);
    
    // Combine neighbors into one boundary for testing
    resetPaperProject(width, height);
    let combinedPath: paper.PathItem | null = null;
    neighbors.forEach(n => {
      const p = pathItemFromBoundaryData(n.boundary);
      if (!combinedPath) combinedPath = p;
      else {
        const next = combinedPath.unite(p);
        combinedPath.remove();
        p.remove();
        combinedPath = next;
      }
    });

    const pNeighbors: Area = {
      id: 'neighbors',
      parentId: 'root',
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: combinedPath!.pathData,
      seedPoint: { x: 0, y: 0 },
      isPiece: false,
      color: '#0000ff'
    };
    combinedPath!.remove();

    const shared = getSharedPerimeter(pE, pNeighbors);
    expect(shared).not.toBeNull();
    if (shared) {
      console.log('Shared perimeter type:', shared.className);
      if (shared instanceof paper.CompoundPath) {
        console.log('Children lengths:', shared.children.map(c => (c as paper.Path).length));
      } else {
        console.log('Path length:', (shared as paper.Path).length);
      }
      const len = (shared as paper.Path | paper.CompoundPath).length;
      expect(Math.abs(len - 400)).toBeLessThan(2.0);

      const uValues = [0, 0.25, 0.5, 0.75, 1];
      const points = uValues.map(u => getPointAtU(shared, u)!.point);

      console.log('3x3 Subdivide Middle Square Points:');
      uValues.forEach((u, i) => {
        console.log(`u=${u}: (${points[i].x}, ${points[i].y})`);
      });

      // Check if u=0.5 is at a corner
      const corners = [
        new paper.Point(100, 100),
        new paper.Point(200, 100),
        new paper.Point(200, 200),
        new paper.Point(100, 200)
      ];

      const distToClosestCorner = (p: paper.Point) => Math.min(...corners.map(c => p.getDistance(c)));
      
      // --- NEW TEST: Piece-relative u parameterization on E ---
      const pathE = pathItemFromBoundaryData(pE.boundary);
      uValues.forEach(u => {
        const pos = getPointAtU(pathE, u);
        expect(distToClosestCorner(pos!.point)).toBeLessThan(2.0);
      });
      const pE_u0625 = getPointAtU(pathE, 0.625);
      expect(pE_u0625?.point.x).toBeCloseTo(150, 0);
      expect(pE_u0625?.point.y).toBeCloseTo(200, 0);

      pathE.remove();

      // --- NEW TEST: Shared perimeter between E and H (Bottom neighbor) ---
      const pH = areas['root-child-7']; // Bottom neighbor
      const sharedEH = getSharedPerimeter(pE, pH);
      expect(sharedEH).not.toBeNull();
      if (sharedEH) {
        const lenEH = sharedEH instanceof paper.Path ? sharedEH.length : (sharedEH as paper.CompoundPath).length;
        
        // For a 100x100 square, the shared edge should be exactly 100 units
        expect(Math.abs(lenEH - 100)).toBeLessThan(1);

        const midEH = getPointAtU(sharedEH, 0.5).point;
        // Middle of bottom edge should be (150, 200)
        expect(Math.abs(midEH.x - 150)).toBeLessThan(1);
        expect(Math.abs(midEH.y - 200)).toBeLessThan(1);
        sharedEH.remove();
      }
    }
  });
});
