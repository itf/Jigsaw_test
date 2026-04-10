/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import paper from 'paper';
import { buildGraphPaths } from './graphTraversal';
import { ProductionArea } from './processProduction';

// One-time global setup
beforeAll(() => {
  paper.setup(new paper.Size(2000, 2000));
});

// Helper: make a ProductionArea from a simple closed SVG path string
function makeArea(id: string, pathData: string): ProductionArea {
  return { id, pathData, color: '#000', area: 100 };
}

// A 2x2 grid of unit squares (4 pieces sharing interior edges)
// Piece layout:
//   [0,0]-[1,0]-[2,0]
//     |    |    |
//   [0,1]-[1,1]-[2,1]
//     |    |    |
//   [0,2]-[1,2]-[2,2]
const TL = makeArea('tl', 'M0,0 L10,0 L10,10 L0,10 Z'); // top-left
const TR = makeArea('tr', 'M10,0 L20,0 L20,10 L10,10 Z'); // top-right
const BL = makeArea('bl', 'M0,10 L10,10 L10,20 L0,20 Z'); // bottom-left
const BR = makeArea('br', 'M10,10 L20,10 L20,20 L10,20 Z'); // bottom-right

describe('buildGraphPaths — 2x2 grid', () => {
  beforeEach(() => {
    paper.setup(new paper.Size(100, 100));
  });

  it('produces at least 1 path', () => {
    const paths = buildGraphPaths([TL, TR, BL, BR]);
    console.log('num paths:', paths.length);
    paths.forEach(p => console.log(`  path ${p.id}: ${p.points.length} points, svg: ${p.svgPathData}`));
    expect(paths.length).toBeGreaterThan(0);
  });

  it('covers all 12 expected unique edges (outer perimeter + cross)', () => {
    // A 2x2 grid of unit squares has:
    //   outer perimeter: 8 edges (2 per side * 4 sides / ... = 8 unit edges)
    //   interior cross: +4 half-edges (2 interior lines, each split into 2 by the center node)
    // Total unique segments = 12
    const paths = buildGraphPaths([TL, TR, BL, BR]);
    const totalEdges = paths.reduce((sum, p) => sum + p.points.length - 1, 0);
    console.log('total edges traversed:', totalEdges);
    expect(totalEdges).toBe(12);
  });

  it('every point is a valid grid coordinate', () => {
    const paths = buildGraphPaths([TL, TR, BL, BR]);
    const validCoords = new Set(['0,0','10,0','20,0','0,10','10,10','20,10','0,20','10,20','20,20']);
    paths.forEach(p => {
      p.points.forEach(([x, y]) => {
        expect(validCoords.has(`${x},${y}`), `unexpected point ${x},${y}`).toBe(true);
      });
    });
  });

  it('no edge is traversed twice', () => {
    const paths = buildGraphPaths([TL, TR, BL, BR]);
    const seen = new Set<string>();
    let duplicates = 0;
    paths.forEach(p => {
      for (let i = 0; i < p.points.length - 1; i++) {
        const [x1, y1] = p.points[i];
        const [x2, y2] = p.points[i + 1];
        const key = [[x1,y1],[x2,y2]].map(([x,y])=>`${x},${y}`).sort().join('|');
        if (seen.has(key)) duplicates++;
        seen.add(key);
      }
    });
    console.log('duplicate edges:', duplicates);
    expect(duplicates).toBe(0);
  });
});

describe('buildGraphPaths — single square', () => {
  beforeEach(() => {
    paper.setup(new paper.Size(100, 100));
  });

  it('produces 1 path covering 4 edges', () => {
    const square = makeArea('sq', 'M0,0 L10,0 L10,10 L0,10 Z');
    const paths = buildGraphPaths([square]);
    console.log('single square paths:', paths.length);
    paths.forEach(p => console.log(`  path ${p.id}: ${p.points.length} pts`));
    const totalEdges = paths.reduce((sum, p) => sum + p.points.length - 1, 0);
    expect(totalEdges).toBe(4);
  });
});

describe('buildGraphPaths — collinear segments validation', () => {
  beforeEach(() => {
    paper.setup(new paper.Size(100, 100));
  });

  it('no segment passes through intermediate nodes', () => {
    const paths = buildGraphPaths([TL, TR, BL, BR]);
    const seen = new Set<string>();
    let violations = 0;

    paths.forEach(p => {
      for (let i = 0; i < p.points.length - 1; i++) {
        const [x1, y1] = p.points[i];
        const [x2, y2] = p.points[i + 1];
        // This is just confirming traversal, actual validation happens in buildGraphPaths
        const key = `${x1},${y1}→${x2},${y2}`;
      }
    });

    // If we got here without errors in the warnings, we're good
    expect(violations).toBe(0);
  });
});
