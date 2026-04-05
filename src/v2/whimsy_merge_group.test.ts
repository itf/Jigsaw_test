import { describe, it, expect } from 'vitest';
import paper from 'paper';
import { AreaType, Operation, Area } from './types';
import { COLORS } from './constants';
import { applyAddWhimsyOp } from './whimsy_cut';
import { cloneAreaMap } from './initial_area';
import { resetPaperProject } from './paperProject';

/**
 * Whimsy cut + merge-group replay (`find` from the puzzle DSU).
 *
 * **Full flow you care about (product):**
 * 1. **First** `ADD_WHIMSY` on a bare 2×2 grid (`find` = per-cell identity): **five** leaves—one whimsy
 *    disc plus **four** remainders (one boolean cut per cell).
 * 2. **Delete** the whimsy and heal/merge so the board is **one** leaf (outer boundary only).
 * 3. **Second** `ADD_WHIMSY` (same circle): the base material is now **one** merge group in the DSU.
 *    **Intended outcome: exactly two leaves**—the new whimsy piece, and **one** remainder region
 *    (all non-whimsy material merged), not four separate frame pieces again.
 *
 * These tests only call `applyAddWhimsyOp` in isolation (no history stack, no delete op). They document
 * that story so each case is explicit about what it simulates and what it does **not** prove.
 *
 * **`find` models DSU state:** `id => id` = four separate clusters (first cut on fresh grid);
 * `() => 'merged'` = every quadrant maps to the same representative (approximates “one sheet” / post-delete
 * state before the **second** whimsy add).
 */

/** Four 50×50 tiles in a 100×100 canvas sharing edges (2×2 grid). */
function fourQuadrantAreas(): Record<string, Area> {
  const root = {
    id: 'root',
    parentId: null,
    type: AreaType.ROOT,
    children: ['q1', 'q2', 'q3', 'q4'] as string[],
    boundary: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
    seedPoint: { x: 50, y: 50 },
    isPiece: false,
    color: '#eee',
  };
  const mk = (id: string, x: number, y: number, color: string) => ({
    id,
    parentId: 'root' as const,
    type: AreaType.SUBDIVISION as const,
    children: [] as string[],
    boundary: `M ${x} ${y} L ${x + 50} ${y} L ${x + 50} ${y + 50} L ${x} ${y + 50} Z`,
    seedPoint: { x: x + 25, y: y + 25 },
    isPiece: true,
    color,
  });
  return {
    root,
    q1: mk('q1', 0, 0, COLORS[0]),
    q2: mk('q2', 50, 0, COLORS[1]),
    q3: mk('q3', 0, 50, COLORS[2]),
    q4: mk('q4', 50, 50, COLORS[3]),
  };
}

/** Matches `usePuzzleEngine` replay: union new remainder ids per cluster after each `ADD_WHIMSY`. */
function applyWhimsyLikeEngine(
  areas: Record<string, Area>,
  op: Operation,
  w: number,
  h: number,
  dsu: Record<string, string>,
  find: (id: string) => string,
  union: (a: string, b: string) => void
) {
  const { warnings, remainderClusters } = applyAddWhimsyOp(areas, op, w, h, find);
  for (const { anchorRep, remainderIds } of remainderClusters) {
    for (const id of remainderIds) union(anchorRep, id);
  }
  return warnings;
}

describe('applyAddWhimsyOp merge clusters (DSU find)', () => {
  it('when every quadrant shares one merge representative, does not replay four separate cuts (piece count < 5)', () => {
    /**
     * **Simulates:** step (3) above—the **second** whimsy placement after the puzzle has been merged into
     * one sheet (delete healed the hole; DSU treats all former cells as one group). `find` maps every
     * quadrant id to the same representative so `applyAddWhimsyOp` must **union** the four boundaries and
     * run **one** cut, not four.
     *
     * **Product target:** **exactly 2** leaf pieces (one `WHIMSY`, one remainder ring). This test does not
     * assert `=== 2` yet: Paper.js may split the remainder into multiple paths in edge cases; we **do**
     * assert the regression we must never reintroduce: **fewer than 5** leaves (five means four spurious
     * per-cell remainders plus whimsy, i.e. the “grid came back” bug).
     */
    resetPaperProject(100, 100);
    const areas = cloneAreaMap(fourQuadrantAreas());
    const find = (_id: string) => 'merged';
    const op: Operation = {
      id: 'w-merge',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 50, y: 50 },
        scale: 35,
        rotationDeg: 0,
      },
      timestamp: 1,
    };
    const { warnings } = applyAddWhimsyOp(areas, op, 100, 100, find);
    const leaves = Object.values(areas).filter(a => a.isPiece);
    expect(warnings.length).toBe(0);
    expect(leaves.some(a => a.type === AreaType.WHIMSY)).toBe(true);
    // If we wrongly cut each leaf on its own, we get 5 pieces (see next test). Merged material must not.
    expect(leaves.length).toBeLessThan(5);
  });

  it('merged find + off-center circle (still overlaps all four cells): still fewer than five leaves', () => {
    /**
     * **Simulates:** same “second whimsy” / merged-DSU case as the centered test, but the circle is
     * **slightly off-center** (still overlaps every quadrant—e.g. placement nudged after delete/re-add).
     * Guards that merge-group cutting does not depend on perfect centering at (50, 50).
     */
    resetPaperProject(100, 100);
    const areas = cloneAreaMap(fourQuadrantAreas());
    const find = (_id: string) => 'merged';
    const op: Operation = {
      id: 'w-merge-off',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 54, y: 46 },
        scale: 35,
        rotationDeg: 0,
      },
      timestamp: 5,
    };
    const { warnings } = applyAddWhimsyOp(areas, op, 100, 100, find);
    const leaves = Object.values(areas).filter(a => a.isPiece);
    expect(warnings.length).toBe(0);
    expect(leaves.some(a => a.type === AreaType.WHIMSY)).toBe(true);
    expect(leaves.length).toBeLessThan(5);
  });

  it('identity find: 2×2 grid + centered circle → five leaf pieces (one whimsy + four remainders)', () => {
    /**
     * **Simulates:** step (1)—**first** whimsy on a fresh 2×2 with **no** merges (`find` = identity). Each
     * cell is its own cluster, so the implementation performs **four** independent cuts → four remainder
     * leaves plus one whimsy.
     *
     * **What is tested:** leaf count **5**, exactly one `WHIMSY`. Contrasts with the merged-`find` case
     * (previous test), which must not reproduce this five-piece outcome.
     */
    resetPaperProject(100, 100);
    const areas = cloneAreaMap(fourQuadrantAreas());
    const find = (id: string) => id;
    const op: Operation = {
      id: 'w-id',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 50, y: 50 },
        scale: 35,
        rotationDeg: 0,
      },
      timestamp: 2,
    };
    applyAddWhimsyOp(areas, op, 100, 100, find);
    const leaves = Object.values(areas).filter(a => a.isPiece);
    expect(leaves.length).toBe(5);
    expect(leaves.filter(a => a.type === AreaType.WHIMSY).length).toBe(1);
  });

  it('same ADD_WHIMSY params: merged find yields fewer leaves than identity find (regression guard)', () => {
    /**
     * **Simulates:** same circle params as step (1) vs step (3)—only `find` differs. Same `ADD_WHIMSY`
     * geometry, two DSU states: identity (four clusters) vs merged (one cluster).
     *
     * **What is tested:** identity replay produces **more** leaf pieces than merged replay. Locks in the
     * relationship “first cut on grid ≠ second cut on unified sheet” without depending on exact counts
     * like 5 vs 2.
     */
    const op: Operation = {
      id: 'w-cmp',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 50, y: 50 },
        scale: 35,
        rotationDeg: 0,
      },
      timestamp: 3,
    };
    resetPaperProject(100, 100);
    const mergedAreas = cloneAreaMap(fourQuadrantAreas());
    applyAddWhimsyOp(mergedAreas, op, 100, 100, () => 'merged');
    resetPaperProject(100, 100);
    const identityAreas = cloneAreaMap(fourQuadrantAreas());
    applyAddWhimsyOp(identityAreas, op, 100, 100, id => id);
    const nMerged = Object.values(mergedAreas).filter(a => a.isPiece).length;
    const nIdentity = Object.values(identityAreas).filter(a => a.isPiece).length;
    expect(nIdentity).toBe(5);
    expect(nMerged).toBeLessThan(nIdentity);
  });

  it('after centered whimsy on 2×2, the five leaves unite to the puzzle outer boundary only (no separate hole)', () => {
    /**
     * **Simulates:** step (1) only (identity `find`, five leaves). **Does not** run delete or a second add.
     *
     * **What is tested:** geometric consistency—the five disjoint leaf boundaries **unite** (Paper boolean)
     * to the same **area** as the root outer rectangle. That matches the idea that after delete/merge,
     * non-whimsy material should fill the board to a single outer contour; here we only check that the
     * five pieces from the **first** cut jointly account for the full puzzle footprint (no missing area).
     */
    resetPaperProject(100, 100);
    const base = cloneAreaMap(fourQuadrantAreas());
    const outerBoundary = base.root.boundary;
    const op: Operation = {
      id: 'w-union',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 50, y: 50 },
        scale: 35,
        rotationDeg: 0,
      },
      timestamp: 4,
    };
    applyAddWhimsyOp(base, op, 100, 100, id => id);
    const leaves = Object.values(base).filter(a => a.isPiece);
    expect(leaves.length).toBe(5);

    let merged: paper.PathItem | null = null;
    for (const leaf of leaves) {
      const p = new paper.Path(leaf.boundary);
      p.reorient(true, true);
      if (!merged) {
        merged = p;
      } else {
        const next = merged.unite(p);
        merged.remove();
        p.remove();
        merged = next;
      }
    }
    expect(merged).not.toBeNull();
    const reduced = merged!.reduce({ insert: false }) as paper.PathItem;
    reduced.reorient(true, true);
    const outer = new paper.Path(outerBoundary);
    outer.reorient(true, true);
    const rArea = Math.abs((reduced as paper.Path).area);
    const oArea = Math.abs((outer as paper.Path).area);
    expect(rArea).toBeCloseTo(oArea, 0);
    reduced.remove();
    outer.remove();
  });

  it('simulated UI replay: first whimsy, MERGE-all in DSU, second whimsy + remainderClusters union → two merge groups', () => {
    /**
     * Exercises the bugfix: MERGE ops union **old** leaf ids, but each new `ADD_WHIMSY` replaces ids;
     * the engine must union `remainderClusters` so the second cut still sees one material group.
     */
    resetPaperProject(100, 100);
    const dsu: Record<string, string> = {};
    const find = (id: string): string => {
      if (!dsu[id]) dsu[id] = id;
      if (dsu[id] === id) return id;
      return (dsu[id] = find(dsu[id]));
    };
    const union = (a: string, b: string) => {
      const r1 = find(a);
      const r2 = find(b);
      if (r1 !== r2) dsu[r1] = r2;
    };

    const areas = cloneAreaMap(fourQuadrantAreas());
    const op1: Operation = {
      id: 'w-first',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 50, y: 50 },
        scale: 35,
        rotationDeg: 0,
      },
      timestamp: 1,
    };
    applyWhimsyLikeEngine(areas, op1, 100, 100, dsu, find, union);
    expect(Object.values(areas).filter(a => a.isPiece).length).toBe(5);

    const afterFirst = Object.values(areas).filter(a => a.isPiece);
    const rep = afterFirst[0]!.id;
    afterFirst.forEach(l => union(rep, l.id));
    expect(new Set(afterFirst.map(l => find(l.id))).size).toBe(1);

    const op2: Operation = {
      id: 'w-second',
      type: 'ADD_WHIMSY',
      params: {
        templateId: 'circle',
        center: { x: 52, y: 48 },
        scale: 35,
        rotationDeg: 0,
      },
      timestamp: 2,
    };
    applyWhimsyLikeEngine(areas, op2, 100, 100, dsu, find, union);

    const leaves = Object.values(areas).filter(a => a.isPiece);
    const roots = new Set(leaves.map(l => find(l.id)));
    expect(roots.size).toBe(2);
  });
});
