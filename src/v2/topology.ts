import paper from 'paper';
import { Delaunay } from 'd3-delaunay';
import { Point, Area, AreaType, Operation } from './types';

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', 
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', 
  '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'
];

export function computeTopology(
  rootArea: Area, 
  history: Operation[], 
  width: number, 
  height: number
): Record<string, Area> {
  let areas: Record<string, Area> = { [rootArea.id]: rootArea };
  
  paper.setup(new paper.Size(width, height));
  
  history.forEach(op => {
    if (op.type === 'SUBDIVIDE') {
      const { parentId, points } = op.params;
      const parent = areas[parentId];
      if (!parent) return;

      const delaunay = Delaunay.from(points.map((p: Point) => [p.x, p.y]));
      const voronoi = delaunay.voronoi([0, 0, width, height]);
      
      const childIds: string[] = [];
      points.forEach((p: Point, i: number) => {
        const poly = voronoi.cellPolygon(i);
        if (!poly) return;
        
        const childId = `${parentId}-child-${i}-${op.id.slice(0, 4)}`;
        childIds.push(childId);
        
        const parentPath = new paper.Path(parent.boundary);
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
  });
  
  return areas;
}

export function computeMergedGroups(
  topology: Record<string, Area>,
  history: Operation[],
  width: number,
  height: number,
  getSharedPerimeter: (a: Area, b: Area) => paper.PathItem | null
): Record<string, string[]> {
  const leafAreas = (Object.values(topology) as Area[]).filter(a => a.isPiece);
  const dsu: Record<string, string> = {};
  
  const find = (id: string): string => {
    if (!dsu[id]) dsu[id] = id;
    if (dsu[id] === id) return id;
    return dsu[id] = find(dsu[id]);
  };
  
  const union = (id1: string, id2: string) => {
    const r1 = find(id1);
    const r2 = find(id2);
    if (r1 !== r2) dsu[r1] = r2;
  };

  const getLeafDescendants = (id: string): string[] => {
    const area = topology[id];
    if (!area) return [];
    if (area.isPiece) return [id];
    return area.children.flatMap(childId => getLeafDescendants(childId));
  };

  paper.setup(new paper.Size(width, height));
  
  history.forEach(op => {
    if (op.type === 'MERGE') {
      const { areaAId, areaBId } = op.params;
      const leavesA = getLeafDescendants(areaAId);
      const leavesB = getLeafDescendants(areaBId);
      
      const rootA = find(areaAId);
      const rootB = find(areaBId);
      const groupA = leafAreas.filter(a => find(a.id) === rootA).map(a => a.id);
      const groupB = leafAreas.filter(a => find(a.id) === rootB).map(a => a.id);
      
      const allA = Array.from(new Set([...leavesA, ...groupA]));
      const allB = Array.from(new Set([...leavesB, ...groupB]));

      allA.forEach(la => {
        allB.forEach(lb => {
          const shared = getSharedPerimeter(topology[la], topology[lb]);
          if (shared) {
            union(la, lb);
            shared.remove();
          }
        });
      });
    }
  });

  const groups: Record<string, string[]> = {};
  leafAreas.forEach(a => {
    const root = find(a.id);
    if (!groups[root]) groups[root] = [];
    groups[root].push(a.id);
  });

  return groups;
}
