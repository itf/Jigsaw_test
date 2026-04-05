/**
 * Regression: single full-rectangle “1×1” sheet + star whimsy.
 *
 * Broken behavior (what we guard against): multiple remainder fragments from `mat.subtract(stencil)` were
 * turned into separate leaf pieces; summing their areas double-counted or left gaps vs the canvas. The
 * whimsy piece area also failed to match the reference `material ∩ stencil` boolean.
 *
 * Fix (in whimsy_cut): `unitePaperPaths` on whimsy and remainder surfaces per cluster so one leaf has
 * one coherent boundary where Paper splits the boolean result into multiple loops.
 */
import { describe, it, expect } from 'vitest';
import paper from 'paper';
import { AreaType, Operation } from './types';
import { applyAddWhimsyOp } from './whimsy_cut';
import { buildAreasFromInitialShape, cloneAreaMap } from './initial_area';
import { pathItemFromBoundaryData, resetPaperProject } from './paperProject';
import { getWhimsyTemplatePathData } from './whimsy_gallery';

function pathAbsArea(pathData: string): number {
  const p = pathItemFromBoundaryData(pathData);
  const a = Math.abs(p.area);
  p.remove();
  return a;
}

/** Coverage of the two pieces together (avoids mis-summing compound remainder paths). */
function combinedPiecesArea(
  width: number,
  height: number,
  whimsyData: string,
  remainderData: string
): number {
  resetPaperProject(width, height);
  const a = pathItemFromBoundaryData(whimsyData);
  const b = pathItemFromBoundaryData(remainderData);
  const u = a.unite(b);
  const area = Math.abs((u as paper.Path).area);
  a.remove();
  b.remove();
  u.remove();
  return area;
}

/**
 * Reference: same boolean as whimsy_cut (material ∩ stencil) for one full-rectangle cell.
 */
function referenceStarInRectArea(
  width: number,
  height: number,
  center: { x: number; y: number },
  scale: number,
  rotationDeg: number
): number {
  resetPaperProject(width, height);
  const material = new paper.Path(`M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`);
  material.reorient(true, true);
  const stem = getWhimsyTemplatePathData('star');
  const stencil = new paper.Path(stem);
  stencil.closed = true;
  stencil.scale(scale, new paper.Point(0, 0));
  stencil.rotate(rotationDeg, new paper.Point(0, 0));
  stencil.position = new paper.Point(center.x, center.y);
  stencil.reorient(true, true);
  const wRaw = material.intersect(stencil);
  material.remove();
  stencil.remove();
  if (!wRaw) return 0;
  const reduced = wRaw.reduce({ insert: false }) as paper.PathItem;
  let sum = 0;
  if (reduced instanceof paper.CompoundPath) {
    for (let i = 0; i < reduced.children.length; i++) {
      const ch = reduced.children[i] as paper.Path;
      if (ch) sum += Math.abs(ch.area);
    }
  } else if (reduced instanceof paper.Path) {
    sum = Math.abs(reduced.area);
  }
  reduced.remove();
  return sum;
}

describe('1×1 sheet (single root rect) + star whimsy', () => {
  it('two leaves; total piece area equals canvas; whimsy area matches stencil ∩ material', () => {
    const width = 400;
    const height = 300;
    resetPaperProject(width, height);
    const areas = cloneAreaMap(buildAreasFromInitialShape(width, height, { variant: 'rect' }));
    const center = { x: width / 2, y: height / 2 };
    const scale = 72;
    const rotationDeg = 0;

    const op: Operation = {
      id: 'star-1',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'star',
        center,
        scale,
        rotationDeg,
      },
      timestamp: 1,
    };

    const { warnings } = applyAddWhimsyOp(areas, op, width, height);
    expect(warnings.length).toBe(0);

    const leaves = Object.values(areas).filter(a => a.isPiece);
    expect(leaves.length).toBe(2);

    const whimsy = leaves.find(a => a.type === AreaType.WHIMSY);
    const remainder = leaves.find(a => a.type === AreaType.SUBDIVISION);
    expect(whimsy).toBeDefined();
    expect(remainder).toBeDefined();

    const canvasArea = width * height;

    const refWhimsyArea = referenceStarInRectArea(width, height, center, scale, rotationDeg);
    const whimsyArea = pathAbsArea(whimsy!.boundary);

    expect(whimsyArea).toBeCloseTo(refWhimsyArea, 0);

    const covered = combinedPiecesArea(width, height, whimsy!.boundary, remainder!.boundary);
    expect(covered).toBeCloseTo(canvasArea, 0);
  });
});
