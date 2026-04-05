import { describe, it, expect } from 'vitest';
import paper from 'paper';
import { AreaType, Operation, Area } from './types';
import { COLORS } from './constants';
import { applyAddWhimsyOp } from './whimsy_cut';
import { buildAreasFromInitialShape, cloneAreaMap } from './initial_area';
import { pathItemFromBoundaryData, resetPaperProject } from './paperProject';
import { getSharedPerimeter } from './geometry';

describe('applyAddWhimsyOp', () => {
  it('creates a new WHIMSY leaf (intersect) plus SUBDIVISION remainder(s) from material subtract', () => {
    const areas = cloneAreaMap(buildAreasFromInitialShape(400, 300, { variant: 'rect' }));
    expect(Object.values(areas).filter(a => a.isPiece).length).toBe(1);

    const op: Operation = {
      id: 'w1',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 200, y: 150 },
        scale: 48,
        rotationDeg: 0,
      },
      timestamp: 1,
    };
    const { warnings, remainderClusters } = applyAddWhimsyOp(areas, op, 400, 300);
    expect(warnings.length).toBe(0);
    expect(remainderClusters.some(c => c.remainderIds.length > 0)).toBe(true);

    const pieces = Object.values(areas).filter(a => a.isPiece);
    const whimsies = pieces.filter(a => a.type === AreaType.WHIMSY);
    const remainders = pieces.filter(a => a.type === AreaType.SUBDIVISION);

    expect(pieces.length).toBe(2);
    expect(whimsies.length).toBe(1);
    expect(remainders.length).toBe(1);
    expect(whimsies[0].id.startsWith('whimsy-')).toBe(true);

    // Placement center lies in the whimsy piece (material ∩ stencil), not in the ring remainder (hole).
    const centerPt = new paper.Point(op.params.center.x, op.params.center.y);
    resetPaperProject(400, 300);
    const whimsyPath = pathItemFromBoundaryData(whimsies[0].boundary);
    const remainderPath = pathItemFromBoundaryData(remainders[0].boundary);
    expect(whimsyPath.contains(centerPt)).toBe(true);
    expect(remainderPath.contains(centerPt)).toBe(false);
    expect(Math.abs((whimsyPath as paper.Path).area)).toBeGreaterThan(100);
    whimsyPath.remove();
    remainderPath.remove();
  });

  it('cuts a circle whimsy from overlapping pieces (canvas placement)', () => {
    const areas = cloneAreaMap(buildAreasFromInitialShape(400, 300, { variant: 'rect' }));
    const op: Operation = {
      id: 'w1b',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 200, y: 150 },
        scale: 48,
        rotationDeg: 0,
      },
      timestamp: 1,
    };
    const { warnings } = applyAddWhimsyOp(areas, op, 400, 300);
    expect(areas.root.isPiece).toBe(false);
    expect(areas.root.children.length).toBeGreaterThanOrEqual(2);
    const whimsy = Object.values(areas).find(a => a.type === AreaType.WHIMSY);
    expect(whimsy).toBeDefined();
    expect(warnings.length).toBe(0);
  });

  it('legacy: warns when single-parent overlap is too small', () => {
    const areas = cloneAreaMap(buildAreasFromInitialShape(400, 300, { variant: 'rect' }));
    const op: Operation = {
      id: 'w2',
      type: 'ADD_WHIMSY',
      params: {
        parentId: 'root',
        templateId: 'circle',
        center: { x: 200, y: 150 },
        scale: 4,
        rotationDeg: 0,
      },
      timestamp: 2,
    };
    const { warnings } = applyAddWhimsyOp(areas, op, 400, 300);
    expect(warnings.some(m => m.includes('too small'))).toBe(true);
    expect(areas.root.isPiece).toBe(true);
  });
});

describe('shared edges after whimsy cut', () => {
  /** 2×2 grid of 50×50 tiles in a 100×100 canvas. */
  function fourQuadrantAreas(): Record<string, Area> {
    const mk = (id: string, x: number, y: number): Area => ({
      id,
      parentId: 'root',
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: `M ${x} ${y} L ${x + 50} ${y} L ${x + 50} ${y + 50} L ${x} ${y + 50} Z`,
      seedPoint: { x: x + 25, y: y + 25 },
      isPiece: true,
      color: COLORS[0],
    });
    return {
      root: {
        id: 'root', parentId: null, type: AreaType.ROOT, children: ['q1','q2','q3','q4'],
        boundary: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', seedPoint: { x: 50, y: 50 },
        isPiece: false, color: '#eee',
      },
      q1: mk('q1', 0, 0),
      q2: mk('q2', 50, 0),
      q3: mk('q3', 0, 50),
      q4: mk('q4', 50, 50),
    };
  }

  it('2x2 grid + center circle: no remainder shared-edge chord passes through the whimsy', () => {
    // Regression: getSharedPerimeter between two opposite remainders (e.g. q1-rest and q4-rest) used
    // to pick the farthest candidate points spanning the full original diagonal, producing a chord
    // through the whimsy circle. The sharedEdges computation now subtracts whimsy boundaries from
    // the chord; this test verifies the remainder pieces themselves have no shared boundary that
    // passes through the whimsy center.
    resetPaperProject(100, 100);
    const areas = cloneAreaMap(fourQuadrantAreas());
    const op: Operation = {
      id: 'w-edges',
      type: 'ADD_WHIMSY',
      params: { templateId: 'circle', center: { x: 50, y: 50 }, scale: 35, rotationDeg: 0 },
      timestamp: 1,
    };
    applyAddWhimsyOp(areas, op, 100, 100, id => id);

    const leaves = Object.values(areas).filter(a => a.isPiece);
    const whimsyLeaves = leaves.filter(a => a.type === AreaType.WHIMSY);
    const remainderLeaves = leaves.filter(a => a.type !== AreaType.WHIMSY);
    expect(whimsyLeaves.length).toBe(1);

    const whimsyCenter = new paper.Point(50, 50);
    resetPaperProject(100, 100);

    // Build whimsy paths for clipping
    const whimsyPaths = whimsyLeaves.map(w => pathItemFromBoundaryData(w.boundary));

    let crossingEdgesFound = 0;
    for (let i = 0; i < remainderLeaves.length; i++) {
      for (let j = i + 1; j < remainderLeaves.length; j++) {
        const shared = getSharedPerimeter(remainderLeaves[i], remainderLeaves[j]);
        if (!shared) continue;

        // Clip the chord against the whimsy (same logic as sharedEdges computation in usePuzzleEngine)
        let edgePath: paper.PathItem = shared;
        for (const wp of whimsyPaths) {
          const clipped = edgePath.subtract(wp);
          edgePath.remove();
          edgePath = clipped;
        }

        // After clipping, the edge must not contain the whimsy center
        if (edgePath instanceof paper.Path && edgePath.length > 0.05) {
          if (edgePath.contains(whimsyCenter)) crossingEdgesFound++;
        }
        edgePath.remove();
      }
    }
    whimsyPaths.forEach(p => p.remove());

    expect(crossingEdgesFound).toBe(0);
  });
});
