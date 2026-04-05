import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { getSharedPerimeter, connectorOwnerNeighborLeafIds } from './geometry';
import { Area, AreaType } from './types';

describe('getSharedPerimeter', () => {
  beforeEach(() => {
    paper.setup(new paper.Size(500, 500));
  });

  it('detects shared boundary when subpiece vertices lie on interior of neighbor edge (T-junction)', () => {
    const neighbor: Area = {
      id: 'N',
      parentId: null,
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: 'M 0 0 L 100 0 L 100 50 L 0 50 Z',
      seedPoint: { x: 50, y: 25 },
      isPiece: true,
      color: '#ccc',
    };
    const sub: Area = {
      id: 'S',
      parentId: null,
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: 'M 30 0 L 70 0 L 70 25 L 30 25 Z',
      seedPoint: { x: 50, y: 12 },
      isPiece: true,
      color: '#aaa',
    };
    const shared = getSharedPerimeter(neighbor, sub);
    expect(shared).not.toBeNull();
    expect((shared as paper.Path).length).toBeGreaterThan(1);
    shared!.remove();
  });
});

describe('connectorOwnerNeighborLeafIds', () => {
  it('maps isFlipped to owner/neighbor without geometry', () => {
    expect(
      connectorOwnerNeighborLeafIds({
        isFlipped: false,
        areaAId: 'A',
        areaBId: 'B',
      })
    ).toEqual({ ownerLeafId: 'A', neighborLeafId: 'B' });

    expect(
      connectorOwnerNeighborLeafIds({
        isFlipped: true,
        areaAId: 'A',
        areaBId: 'B',
      })
    ).toEqual({ ownerLeafId: 'B', neighborLeafId: 'A' });
  });
});
