import { useMemo } from 'react';
import paper from 'paper';
import { Delaunay } from 'd3-delaunay';
import { Point, Area, AreaType, Connector, Operation } from '../types';
import { getSharedPerimeter, getPointAtU, createConnectorStamp, resolveCollisions } from '../geometry';
import { TopologicalEngine } from '../topology_engine';
import { COLORS, Tab } from '../constants';

interface PuzzleEngineProps {
  width: number;
  height: number;
  history: Operation[];
  activeTab: Tab;
  geometryEngine: 'BOOLEAN' | 'TOPOLOGICAL';
}

/**
 * usePuzzleEngine encapsulates the complex geometric pipeline for the puzzle.
 * It processes the history of operations into a final set of pieces with connectors.
 */
export function usePuzzleEngine({ width, height, history, activeTab, geometryEngine }: PuzzleEngineProps) {
  
  // 1. Root Area: The base rectangle for the puzzle
  const rootArea = useMemo<Area>(() => ({
    id: 'root',
    parentId: null,
    type: AreaType.ROOT,
    children: [],
    boundary: `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`,
    seedPoint: { x: width / 2, y: height / 2 },
    isPiece: true,
    color: '#f1f5f9'
  }), [width, height]);

  // 2. Topology Generation: Recursive Subdivision via Voronoi
  const topology = useMemo(() => {
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
  }, [rootArea, history, width, height]);

  // 3. Merged Groups: The "DSU" solver for adjacent pieces that should be joined
  const mergedGroups = useMemo<Record<string, string[]>>(() => {
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
  }, [topology, history, width, height]);

  // 4. Shared Edges: For visualization and connector placement
  const sharedEdges = useMemo(() => {
    const leafAreas = (Object.values(topology) as Area[]).filter(a => a.isPiece);
    const edges: { id: string; areaAId: string; areaBId: string; pathData: string; isMerged: boolean }[] = [];
    
    if (leafAreas.length > 200) return [];

    paper.setup(new paper.Size(width, height));
    
    const getGroupId = (areaId: string) => {
      for (const [groupId, ids] of Object.entries(mergedGroups as Record<string, string[]>)) {
        if (ids.includes(areaId)) return groupId;
      }
      return areaId;
    };

    for (let i = 0; i < leafAreas.length; i++) {
      for (let j = i + 1; j < leafAreas.length; j++) {
        const areaA = leafAreas[i];
        const areaB = leafAreas[j];
        
        const groupA = getGroupId(areaA.id);
        const groupB = getGroupId(areaB.id);
        const isMerged = groupA === groupB;

        const shared = getSharedPerimeter(areaA, areaB);
        if (shared) {
          if ((shared as paper.Path).length > 5) {
            edges.push({
              id: `${areaA.id}-${areaB.id}`,
              areaAId: areaA.id,
              areaBId: areaB.id,
              pathData: shared.pathData,
              isMerged
            });
          }
          shared.remove();
        }
      }
    }
    return edges;
  }, [topology, mergedGroups, width, height]);

  // 5. Connectors: The list of tabs to be applied
  const connectors = useMemo<Connector[]>(() => {
    let connList: Connector[] = [];
    if (activeTab === 'TOPOLOGY' || activeTab === 'MODIFICATION') return [];

    history.forEach(op => {
      if (op.type === 'ADD_CONNECTOR') {
        connList.push({
          id: op.id,
          areaAId: op.params.areaAId,
          areaBId: op.params.areaBId,
          u: op.params.u,
          isFlipped: op.params.isFlipped || false,
          type: op.params.type || 'TAB',
          size: op.params.size || 20,
          isDormant: false
        });
      }
    });
    
    return connList;
  }, [history, activeTab]);

  // 6. Resolved Connectors: Collision-checked connectors
  const resolvedConnectors = useMemo(() => {
    if (activeTab === 'TOPOLOGY' || activeTab === 'MODIFICATION') return [];
    paper.setup(new paper.Size(width, height));
    return resolveCollisions(connectors, topology);
  }, [connectors, topology, activeTab, width, height]);

  // 7. Final Pieces: The base geometry of each piece (merged or single)
  const finalPieces = useMemo(() => {
    if (Object.keys(topology).length === 0) return [];
    
    if (geometryEngine === 'BOOLEAN') {
      paper.setup(new paper.Size(width, height));
      const pieces: { id: string; pathData: string; color: string }[] = [];
      
      Object.entries(mergedGroups as Record<string, string[]>).forEach(([groupId, areaIds]) => {
        if (areaIds.length === 1) {
          const area = topology[areaIds[0]];
          pieces.push({ id: area.id, pathData: area.boundary, color: area.color });
        } else {
          let mergedPath: paper.PathItem | null = null;
          areaIds.forEach(id => {
            const area = topology[id];
            const path = new paper.Path(area.boundary);
            path.clockwise = true;
            if (!mergedPath) {
              mergedPath = path;
            } else {
              const next = mergedPath.unite(path);
              mergedPath.remove();
              path.remove();
              mergedPath = next;
            }
          });
          if (mergedPath) {
            const cleaned = (mergedPath as paper.PathItem).reduce({ insert: false }) as paper.PathItem;
            cleaned.reorient(true, true);
            pieces.push({ 
              id: groupId, 
              pathData: cleaned.pathData, 
              color: topology[areaIds[0]].color 
            });
            cleaned.remove();
          }
        }
      });
      return pieces;
    } else {
      // Topological Engine
      const engine = new TopologicalEngine();
      const leafAreas = (Object.values(topology) as Area[]).filter(a => a.isPiece);
      engine.initializeFromVoronoi(leafAreas, width, height);

      history.forEach(op => {
        if (op.type === 'MERGE') {
          const { areaAId, areaBId } = op.params;
          engine.mergeFaces(areaAId, areaBId);
        }
      });

      resolvedConnectors.forEach(c => {
        if (c.isDeleted || c.isDormant) return;
        
        const areaA = topology[c.areaAId];
        const areaB = topology[c.areaBId];
        if (!areaA || !areaB) return;

        const rawStamp = createConnectorStamp(new paper.Point(0, 0), new paper.Point(1, 0), c.type, c.size, undefined, 0.5);
        
        // Correct owner logic: if flipped, areaB owns it (sticks out of B into A)
        const ownerFaceId = c.isFlipped ? c.areaBId : c.areaAId;
        engine.addConnectorToBoundary(c.areaAId, c.areaBId, c.u, rawStamp.pathData, c.isFlipped, ownerFaceId);
        
        rawStamp.remove();
      });

      const pieces: { id: string; pathData: string; color: string }[] = [];
      Object.entries(mergedGroups as Record<string, string[]>).forEach(([groupId, areaIds]) => {
        const boundary = engine.getMergedBoundary(areaIds);
        pieces.push({ 
          id: groupId, 
          pathData: boundary, 
          color: topology[areaIds[0]]?.color || '#f1f5f9'
        });
      });
      
      return pieces;
    }
  }, [topology, mergedGroups, width, height, history, resolvedConnectors, geometryEngine]);

  // 8. Final Pieces with Connectors (Boolean Engine specific)
  const finalPiecesWithConnectors = useMemo(() => {
    if (geometryEngine === 'TOPOLOGICAL') return finalPieces;

    paper.setup(new paper.Size(width, height));
    const pieces: { id: string; pathData: string; color: string }[] = [];
    
    const getGroupId = (areaId: string) => {
      for (const [groupId, ids] of Object.entries(mergedGroups as Record<string, string[]>)) {
        if (ids.includes(areaId)) return groupId;
      }
      return areaId;
    };

    const stamps = resolvedConnectors
      .filter(c => !c.isDeleted && !c.isDormant)
      .map(c => {
        const areaA = topology[c.areaAId];
        const areaB = topology[c.areaBId];
        const shared = getSharedPerimeter(areaA, areaB);
        if (!shared) return null;
        
        const pos = getPointAtU(shared, c.u);
        shared.remove();
        if (!pos) return null;
        
        const normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
        const stamp = createConnectorStamp(pos.point, normal, c.type, c.size);
        
        const pathA = new paper.Path(areaA.boundary);
        const pathB = new paper.Path(areaB.boundary);
        const testPoint = pos.point.add(normal.multiply(c.size * 0.5));
        
        let ownerGroupId = '';
        if (pathB.contains(testPoint)) {
          ownerGroupId = getGroupId(c.areaAId);
        } else if (pathA.contains(testPoint)) {
          ownerGroupId = getGroupId(c.areaBId);
        } else {
          ownerGroupId = getGroupId(c.areaAId);
        }
        
        pathA.remove();
        pathB.remove();

        const groupA = getGroupId(c.areaAId);
        const groupB = getGroupId(c.areaBId);

        return {
          stamp,
          ownerGroupId,
          neighborGroupId: groupA === ownerGroupId ? groupB : groupA,
          isInternal: groupA === groupB
        };
      })
      .filter((s): s is { stamp: paper.PathItem; ownerGroupId: string; neighborGroupId: string; isInternal: boolean } => s !== null);

    finalPieces.forEach(piece => {
      let piecePath: paper.PathItem | null = new paper.Path(piece.pathData);
      
      stamps.forEach(({ stamp, ownerGroupId, neighborGroupId, isInternal }) => {
        if (isInternal || !piecePath) return;
        
        if (ownerGroupId === piece.id) {
          const next = piecePath.unite(stamp);
          if (next) {
            piecePath.remove();
            piecePath = next;
          }
        } else if (neighborGroupId === piece.id) {
          const next = piecePath.subtract(stamp);
          if (next) {
            piecePath.remove();
            piecePath = next;
          }
        }
      });
      
      if (piecePath) {
        pieces.push({ id: piece.id, pathData: piecePath.pathData, color: piece.color });
        piecePath.remove();
      } else {
        pieces.push(piece);
      }
    });
    
    stamps.forEach(s => s.stamp.remove());
    
    return pieces;
  }, [topology, finalPieces, mergedGroups, resolvedConnectors, activeTab, width, height, geometryEngine]);

  return {
    topology,
    mergedGroups,
    sharedEdges,
    connectors,
    resolvedConnectors,
    finalPieces: finalPiecesWithConnectors
  };
}
