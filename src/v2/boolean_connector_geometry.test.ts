import { describe, it, expect } from 'vitest';
import paper from 'paper';
import { Area, AreaType, Connector } from './types';
import {
  applyBooleanConnectorStampsToPieces,
  buildBooleanBasePieces,
  intersectionArea,
} from './boolean_connector_geometry';
import {
  getSharedPerimeter,
  getPointAtU,
  createConnectorStamp,
  connectorOwnerNeighborLeafIds,
  orientConnectorNormalTowardNeighbor,
} from './geometry';
import { pathItemFromBoundaryData } from './paperProject';

const W = 400;
const H = 400;

/** Left | narrow middle | right — tab from a–b (not flipped) extends into b and can cross into c. */
function threeStripTopology(): Record<string, Area> {
  return {
    a: {
      id: 'a',
      parentId: null,
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: 'M 0 0 L 80 0 L 80 400 L 0 400 Z',
      seedPoint: { x: 40, y: 200 },
      isPiece: true,
      color: '#f00',
    },
    b: {
      id: 'b',
      parentId: null,
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: 'M 80 0 L 160 0 L 160 400 L 80 400 Z',
      seedPoint: { x: 120, y: 200 },
      isPiece: true,
      color: '#0f0',
    },
    c: {
      id: 'c',
      parentId: null,
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: 'M 160 0 L 400 0 L 400 400 L 160 400 Z',
      seedPoint: { x: 280, y: 200 },
      isPiece: true,
      color: '#00f',
    },
  };
}

const mergedSingletons: Record<string, string[]> = {
  a: ['a'],
  b: ['b'],
  c: ['c'],
};

/** 2×3 grid (labels match layout): p1 p2 p3 / p4 p5 p6 — connector on horizontal seam p2–p5.
 * Columns must be narrower than ~2×(tab half-width along the edge) so the stamp extends past p2 into p1/p3 (and similarly into p4/p6). */
const GRID_CW = 70;
const GRID_CH = 150;
const GRID_PAPER_W = 260;
const GRID_PAPER_H = 340;

function grid2x3Topology(): Record<string, Area> {
  const cw = GRID_CW;
  const ch = GRID_CH;
  const mk = (
    id: string,
    x0: number,
    y0: number,
    color: string,
    seed: { x: number; y: number }
  ): Area => ({
    id,
    parentId: null,
    type: AreaType.SUBDIVISION,
    children: [],
    boundary: `M ${x0} ${y0} L ${x0 + cw} ${y0} L ${x0 + cw} ${y0 + ch} L ${x0} ${y0 + ch} Z`,
    seedPoint: seed,
    isPiece: true,
    color,
  });
  return {
    p1: mk('p1', 0, 0, '#111', { x: cw / 2, y: ch / 2 }),
    p2: mk('p2', cw, 0, '#222', { x: cw + cw / 2, y: ch / 2 }),
    p3: mk('p3', 2 * cw, 0, '#333', { x: 2 * cw + cw / 2, y: ch / 2 }),
    p4: mk('p4', 0, ch, '#444', { x: cw / 2, y: ch + ch / 2 }),
    p5: mk('p5', cw, ch, '#555', { x: cw + cw / 2, y: ch + ch / 2 }),
    p6: mk('p6', 2 * cw, ch, '#666', { x: 2 * cw + cw / 2, y: ch + ch / 2 }),
  };
}

const gridMergedSingletons: Record<string, string[]> = {
  p1: ['p1'],
  p2: ['p2'],
  p3: ['p3'],
  p4: ['p4'],
  p5: ['p5'],
  p6: ['p6'],
};

const GRID_PIECE_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

function basePiecesFromGrid(topology: Record<string, Area>) {
  return GRID_PIECE_IDS.map(id => ({
    id,
    pathData: topology[id].boundary,
    color: topology[id].color,
  }));
}

function basePiecesFromTopology(topology: Record<string, Area>) {
  return (['a', 'b', 'c'] as const).map(id => ({
    id,
    pathData: topology[id].boundary,
    color: topology[id].color,
  }));
}

function absArea(pathData: string): number {
  const p = new paper.Path(pathData);
  const a = Math.abs(p.area);
  p.remove();
  return a;
}

function stampBoundsHitPiece(stampData: string, piecePathData: string): boolean {
  const sb = new paper.Path(stampData);
  const pb = new paper.Path(piecePathData);
  const hit = sb.bounds.intersects(pb.bounds);
  sb.remove();
  pb.remove();
  return hit;
}

/**
 * Mirrors the engine's stamp-position logic exactly: u is a fraction of areaA's full
 * boundary perimeter (as stored when the user clicks in V2Canvas), not the shared chord.
 */
function stampPathData(
  topology: Record<string, Area>,
  c: Pick<Connector, 'areaAId' | 'areaBId' | 'u' | 'isFlipped' | 'type' | 'size'>
): string | null {
  const areaA = topology[c.areaAId];
  const areaB = topology[c.areaBId];
  if (!areaA || !areaB) return null;
  const pathA = pathItemFromBoundaryData(areaA.boundary);
  const pos = getPointAtU(pathA, c.u);
  pathA.remove();
  if (!pos) return null;
  let normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
  normal = orientConnectorNormalTowardNeighbor(pos.point, normal, areaB.boundary);
  const stamp = createConnectorStamp(pos.point, normal, c.type, c.size);
  const d = stamp.pathData;
  stamp.remove();
  return d;
}

/**
 * Converts a fraction along the areaA–areaB shared perimeter into the corresponding
 * u-value along areaA's full boundary.  Use this to build connectors that land at a
 * known, geometrically meaningful position (e.g. start/middle/end of the shared edge)
 * while respecting the engine's full-boundary parameterisation of `u`.
 */
function uOnSharedEdge(areaA: Area, areaB: Area, fractionAlongShared: number): number {
  const shared = getSharedPerimeter(areaA, areaB);
  if (!shared) return fractionAlongShared;
  const pos = getPointAtU(shared, fractionAlongShared);
  shared.remove();
  if (!pos) return fractionAlongShared;
  const pathA = pathItemFromBoundaryData(areaA.boundary);
  const loc = pathA.getNearestLocation(pos.point);
  const pathLen = (pathA as paper.Path).length;
  const result = loc.offset / pathLen;
  pathA.remove();
  return result;
}

describe('applyBooleanConnectorStampsToPieces — full matrix u∈{0,1} × flip × clipOverlap', () => {
  const topology = threeStripTopology();
  const base = basePiecesFromTopology(topology);
  const baseA = absArea(base[0].pathData);
  const baseB = absArea(base[1].pathData);
  const baseC = absArea(base[2].pathData);
  const size = 90;

  for (const u of [0, 1] as const) {
    for (const isFlipped of [false, true] as const) {
      for (const clipOverlap of [false, true] as const) {
        it(`u=${u} isFlipped=${isFlipped} clipOverlap=${clipOverlap} — owner/neighbor roles and geometry`, () => {
          paper.setup(new paper.Size(W, H));

          const connector: Connector = {
            id: 'conn',
            areaAId: 'a',
            areaBId: 'b',
            u,
            isFlipped,
            type: 'TAB',
            size,
            isDormant: false,
            clipOverlap,
          };

          const { ownerLeafId, neighborLeafId } = connectorOwnerNeighborLeafIds(connector);
          expect(ownerLeafId).toBe(isFlipped ? 'b' : 'a');
          expect(neighborLeafId).toBe(isFlipped ? 'a' : 'b');

          const out = applyBooleanConnectorStampsToPieces(
            W,
            H,
            topology,
            mergedSingletons,
            base,
            [connector]
          );

          const pathOwner = out.find(p => p.id === ownerLeafId)!;
          const pathNeighbor = out.find(p => p.id === neighborLeafId)!;
          const pathC = out.find(p => p.id === 'c')!;

          const ownerBase = ownerLeafId === 'a' ? baseA : baseB;
          const neighborBase = neighborLeafId === 'a' ? baseA : baseB;

          expect(absArea(pathOwner.pathData)).toBeGreaterThan(ownerBase - 2);
          expect(absArea(pathNeighbor.pathData)).toBeLessThan(neighborBase + 2);

          const stampData = stampPathData(topology, connector);
          expect(stampData).not.toBeNull();

          const sb = new paper.Path(stampData!);
          const cb = new paper.Path(base[2].pathData);
          const boundsHit = sb.bounds.intersects(cb.bounds);
          sb.remove();
          cb.remove();

          /** Stamp ∩ original c — use this, not stamp ∩ result pathC: after subtract the overlap can be tiny while area still dropped. */
          const overlapStampBaseC = intersectionArea(stampData!, base[2].pathData);

          // Third-piece subtract runs only when clipOverlap and bounds intersect (see boolean_connector_geometry).
          if (clipOverlap && boundsHit) {
            const noClip = applyBooleanConnectorStampsToPieces(W, H, topology, mergedSingletons, base, [
              { ...connector, clipOverlap: false },
            ]);
            const yesClip = applyBooleanConnectorStampsToPieces(W, H, topology, mergedSingletons, base, [
              { ...connector, clipOverlap: true },
            ]);
            const cNo = noClip.find(p => p.id === 'c')!;
            const cYes = yesClip.find(p => p.id === 'c')!;

            const interNo = intersectionArea(stampData!, cNo.pathData);
            const interYes = intersectionArea(stampData!, cYes.pathData);

            expect(absArea(cYes.pathData)).toBeLessThanOrEqual(absArea(cNo.pathData) + 0.5);
            if (overlapStampBaseC > 5) {
              expect(interNo).toBeGreaterThan(4);
              expect(interYes).toBeLessThanOrEqual(interNo + 0.5);
            }
          } else {
            expect(absArea(pathC.pathData)).toBeCloseTo(baseC, 0);
          }
        });
      }
    }
  }
});

describe('applyBooleanConnectorStampsToPieces — third piece clip when stamp overlaps c', () => {
  it('with clipOverlap subtracts more stamp from c than without (midpoint of shared edge, not flipped)', () => {
    paper.setup(new paper.Size(W, H));
    const topology = threeStripTopology();
    const base = basePiecesFromTopology(topology);

    // u = position on A's full boundary that corresponds to the midpoint of the A–B shared edge.
    // With A = 0,0–80,400 and B = 80,0–160,400 the shared edge midpoint is (80, 200).
    const u = uOnSharedEdge(topology.a, topology.b, 0.5);

    const connector: Connector = {
      id: 'x',
      areaAId: 'a',
      areaBId: 'b',
      u,
      isFlipped: false,
      type: 'TAB',
      size: 90,
      isDormant: false,
      clipOverlap: false,
    };

    const stampData = stampPathData(topology, connector)!;
    expect(intersectionArea(stampData, base[2].pathData)).toBeGreaterThan(10);

    const noClip = applyBooleanConnectorStampsToPieces(W, H, topology, mergedSingletons, base, [
      { ...connector, clipOverlap: false },
    ]);
    const withClip = applyBooleanConnectorStampsToPieces(W, H, topology, mergedSingletons, base, [
      { ...connector, clipOverlap: true },
    ]);

    const cNo = noClip.find(p => p.id === 'c')!;
    const cYes = withClip.find(p => p.id === 'c')!;

    expect(intersectionArea(stampData, cNo.pathData)).toBeGreaterThan(4);
    expect(intersectionArea(stampData, cYes.pathData)).toBeLessThan(intersectionArea(stampData, cNo.pathData));
    expect(absArea(cYes.pathData)).toBeLessThan(absArea(cNo.pathData));
  });
});

/**
 * Layout: p1 p2 p3 / p4 p5 p6. Connector on the **horizontal** seam p2–p5: the tab extends along the seam
 * (sideways in x) and into p2/p5 along the normal — so it can overlap **p1, p3, p4, p6** depending on u.
 * u values are derived from uOnSharedEdge so they correspond to actual positions on the p2–p5 shared edge.
 */
describe('applyBooleanConnectorStampsToPieces — 2×3 grid, connector p2–p5 (sideways third-piece clip)', () => {
  const sideIds = ['p1', 'p3', 'p4', 'p6'] as const;
  /** Large enough that head width along the seam exceeds middle column width (see GRID_CW). */
  const size = 110;

  for (const sharedFraction of [0, 0.5, 1] as const) {
    it(`shared-fraction=${sharedFraction}: clipOverlap only reduces side pieces whose bounds intersect the stamp`, () => {
      paper.setup(new paper.Size(GRID_PAPER_W, GRID_PAPER_H));
      const topology = grid2x3Topology();
      const base = basePiecesFromGrid(topology);
      const baseArea = Object.fromEntries(
        GRID_PIECE_IDS.map(id => [id, absArea(topology[id].boundary)])
      ) as Record<(typeof GRID_PIECE_IDS)[number], number>;

      // Convert shared-edge fraction to full-boundary u (as stored when user clicks in the UI).
      const u = uOnSharedEdge(topology.p2, topology.p5, sharedFraction);

      const connector: Connector = {
        id: 'p2p5',
        areaAId: 'p2',
        areaBId: 'p5',
        u,
        isFlipped: false,
        type: 'TAB',
        size,
        isDormant: false,
        clipOverlap: true,
      };

      const stampData = stampPathData(topology, connector);
      expect(stampData).not.toBeNull();

      const noClip = applyBooleanConnectorStampsToPieces(
        GRID_PAPER_W,
        GRID_PAPER_H,
        topology,
        gridMergedSingletons,
        base,
        [{ ...connector, clipOverlap: false }]
      );
      const yesClip = applyBooleanConnectorStampsToPieces(
        GRID_PAPER_W,
        GRID_PAPER_H,
        topology,
        gridMergedSingletons,
        base,
        [{ ...connector, clipOverlap: true }]
      );

      for (const sid of sideIds) {
        const boundary = topology[sid].boundary;
        const boundsHit = stampBoundsHitPiece(stampData!, boundary);
        const material = intersectionArea(stampData!, boundary);
        const aNo = absArea(noClip.find(p => p.id === sid)!.pathData);
        const aYes = absArea(yesClip.find(p => p.id === sid)!.pathData);

        expect(aNo).toBeCloseTo(baseArea[sid], 0);

        if (boundsHit && material > 8) {
          expect(aYes).toBeLessThan(aNo - 0.5);
        } else if (boundsHit) {
          expect(aYes).toBeLessThanOrEqual(aNo + 0.5);
        } else {
          expect(aYes).toBeCloseTo(baseArea[sid], 0);
        }
      }

      // noClip intersects the stamp with (owner ∪ neighbor) before booleans; yesClip uses the full stamp on
      // owner/neighbor and subtracts third pieces — p2/p5 areas need not match when the full stamp spills.
    });
  }

  it('at each endpoint of the shared edge, all four side pieces have material stamp overlap across the two endpoints (regression: endpoint asymmetry)', () => {
    paper.setup(new paper.Size(GRID_PAPER_W, GRID_PAPER_H));
    const topology = grid2x3Topology();
    const connectorBase = {
      id: 'p2p5',
      areaAId: 'p2' as const,
      areaBId: 'p5' as const,
      isFlipped: false,
      type: 'TAB' as const,
      size,
      isDormant: false,
      clipOverlap: true,
    };

    const hadMaterial = { p1: false, p3: false, p4: false, p6: false };
    // Check both endpoints of the p2-p5 shared edge (fraction=0 and fraction=1).
    for (const sharedFraction of [0, 1] as const) {
      const u = uOnSharedEdge(topology.p2, topology.p5, sharedFraction);
      const stampData = stampPathData(topology, { ...connectorBase, u })!;
      for (const sid of sideIds) {
        if (intersectionArea(stampData, topology[sid].boundary) > 8) {
          hadMaterial[sid] = true;
        }
      }
    }
    expect(hadMaterial).toEqual({ p1: true, p3: true, p4: true, p6: true });
  });
});

/**
 * When flipped, owner becomes p5. With clipOverlap off, the stamp is intersected with (p2 ∪ p5) before
 * booleans so the tab does not extend into non-adjacent cells (e.g. p1); p1’s area stays base and
 * owner p5 should not geometrically overlap p1’s rectangle.
 */
describe('buildBooleanBasePieces + applyBooleanConnectorStampsToPieces (same as UI BOOLEAN pipeline)', () => {
  const size = 110;

  it('flipped u≈1: p1 area unchanged without clip; owner p5 union stays inside owner∪neighbor (no spill into p1)', () => {
    paper.setup(new paper.Size(GRID_PAPER_W, GRID_PAPER_H));
    const topology = grid2x3Topology();
    const base = buildBooleanBasePieces(GRID_PAPER_W, GRID_PAPER_H, topology, gridMergedSingletons);

    expect(base.find(p => p.id === 'p1')!.pathData).toBe(topology.p1.boundary);

    const connector: Connector = {
      id: 'p2p5',
      areaAId: 'p2',
      areaBId: 'p5',
      u: 0.999,
      isFlipped: true,
      type: 'TAB',
      size,
      isDormant: false,
      clipOverlap: false,
    };

    const out = applyBooleanConnectorStampsToPieces(
      GRID_PAPER_W,
      GRID_PAPER_H,
      topology,
      gridMergedSingletons,
      base,
      [connector]
    );

    const baseP1 = absArea(topology.p1.boundary);
    expect(absArea(out.find(p => p.id === 'p1')!.pathData)).toBeCloseTo(baseP1, 0);

    const ownerP5 = out.find(p => p.id === 'p5')!;
    expect(intersectionArea(ownerP5.pathData, topology.p1.boundary)).toBeLessThan(50);
  });

  it('same setup not flipped u=1: owner p2 union barely overlaps p1 cell (contrast)', () => {
    paper.setup(new paper.Size(GRID_PAPER_W, GRID_PAPER_H));
    const topology = grid2x3Topology();
    const base = buildBooleanBasePieces(GRID_PAPER_W, GRID_PAPER_H, topology, gridMergedSingletons);

    const connector: Connector = {
      id: 'p2p5',
      areaAId: 'p2',
      areaBId: 'p5',
      u: 0.999,
      isFlipped: false,
      type: 'TAB',
      size,
      isDormant: false,
      clipOverlap: false,
    };

    const out = applyBooleanConnectorStampsToPieces(
      GRID_PAPER_W,
      GRID_PAPER_H,
      topology,
      gridMergedSingletons,
      base,
      [connector]
    );

    const ownerP2 = out.find(p => p.id === 'p2')!;
    expect(intersectionArea(ownerP2.pathData, topology.p1.boundary)).toBeLessThan(100);
  });
});
