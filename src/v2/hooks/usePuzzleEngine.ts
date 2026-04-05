import { useMemo, useRef } from 'react';
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

/** Stable hash for Voronoi graph + merges (anything that forces initializeFromVoronoi / mergeFaces). */
function topoGeometryKey(
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>,
  width: number,
  height: number,
  mergeHistory: string
): string {
  const leaves = (Object.values(topology) as Area[]).filter(a => a.isPiece);
  leaves.sort((a, b) => a.id.localeCompare(b.id));
  const groups = Object.entries(mergedGroups).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({
    w: width,
    h: height,
    mergeHistory,
    leaves: leaves.map(a => [a.id, a.boundary]),
    groups,
  });
}

function connectorSignature(c: Connector): string {
  return [
    c.u,
    c.size,
    c.isFlipped,
    c.type,
    !!c.isDeleted,
    !!c.isDormant,
    c.areaAId,
    c.areaBId,
  ].join('|');
}

function clearEdgeConnectors(engine: TopologicalEngine) {
  engine.edges.forEach(e => {
    e.connectors = undefined;
  });
}

/**
 * usePuzzleEngine encapsulates the complex geometric pipeline for the puzzle.
 * It processes the history of operations into a final set of pieces with connectors.
 */
export interface PuzzleEngineResult {
  topology: Record<string, Area>;
  mergedGroups: Record<string, string[]>;
  sharedEdges: { id: string; areaAId: string; areaBId: string; pathData: string; isMerged: boolean }[];
  connectors: Connector[];
  resolvedConnectors: Connector[];
  finalPieces: { id: string; pathData: string; color: string }[];
}

export function usePuzzleEngine({ width, height, history, activeTab, geometryEngine }: PuzzleEngineProps): PuzzleEngineResult {
  // Topological engine: reuse graph across connector param changes; partial getMergedBoundary.
  const topoEngineCacheRef = useRef<{ key: string; engine: TopologicalEngine } | null>(null);
  const topoPieceCacheRef = useRef<Map<string, { id: string; pathData: string; color: string }>>(new Map());
  const prevConnectorSigRef = useRef<Record<string, string>>({});
  const prevConnectorAreasRef = useRef<Record<string, { areaAId: string; areaBId: string }>>({});
  const lastTopoPiecesRef = useRef<{ id: string; pathData: string; color: string }[] | null>(null);

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

  // 2–3. Topology + merged groups: history order matters (MERGE uses geometry at that moment).
  const { topology, mergedGroups } = useMemo((): {
    topology: Record<string, Area>;
    mergedGroups: Record<string, string[]>;
  } => {
    const areas: Record<string, Area> = { [rootArea.id]: rootArea };
    paper.setup(new paper.Size(width, height));

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
      const area = areas[id];
      if (!area) return [];
      if (area.isPiece) return [id];
      return area.children.flatMap(childId => getLeafDescendants(childId));
    };

    const applyMerge = (op: Operation) => {
      if (op.type !== 'MERGE') return;
      const { areaAId, areaBId } = op.params;
      const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
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
          const a = areas[la];
          const b = areas[lb];
          if (!a || !b) return;
          const shared = getSharedPerimeter(a, b);
          if (shared) {
            union(la, lb);
            shared.remove();
          }
        });
      });
    };

    history.forEach(op => {
      if (op.type === 'MERGE') {
        applyMerge(op);
        return;
      }
      if (op.type === 'SUBDIVIDE') {
        const { parentId, points, clipBoundary, absorbedLeafIds } = op.params;
        const parent = areas[parentId];
        if (!parent) return;

        const boundaryData = (clipBoundary as string | undefined) ?? parent.boundary;
        const parentPath0 = new paper.Path(boundaryData);
        const pb = parentPath0.bounds;
        parentPath0.remove();
        const delaunay = Delaunay.from(points.map((p: Point) => [p.x, p.y]));
        const voronoi = delaunay.voronoi([pb.x, pb.y, pb.x + pb.width, pb.y + pb.height]);

        const childIds: string[] = [];
        points.forEach((p: Point, i: number) => {
          const poly = voronoi.cellPolygon(i);
          if (!poly) return;

          const childId = `${parentId}-child-${i}-${op.id.slice(0, 4)}`;
          childIds.push(childId);

          const parentPath = new paper.Path(boundaryData);
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

        const absorbed = absorbedLeafIds as string[] | undefined;
        if (absorbed?.length) {
          absorbed.forEach(id => {
            delete areas[id];
          });
        }
      }
    });

    const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
    const groups: Record<string, string[]> = {};
    leafAreas.forEach(a => {
      const root = find(a.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(a.id);
    });

    return { topology: areas, mergedGroups: groups };
  }, [rootArea, history, width, height]);

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

  const mergeHistorySig = useMemo(
    () =>
      history
        .filter((o): o is Operation & { type: 'MERGE' } => o.type === 'MERGE')
        .map(o => `${o.params.areaAId}-${o.params.areaBId}`)
        .join('>'),
    [history]
  );

  const topoGeometryKeyMemo = useMemo(
    () => topoGeometryKey(topology, mergedGroups as Record<string, string[]>, width, height, mergeHistorySig),
    [topology, mergedGroups, width, height, mergeHistorySig]
  );

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
      // Topological Engine — reuse face-edge graph when only connector params change.
      const mg = mergedGroups as Record<string, string[]>;
      const mergedEntries = Object.entries(mg);

      const getGroupId = (areaId: string) => {
        for (const [groupId, ids] of Object.entries(mg)) {
          if (ids.includes(areaId)) return groupId;
        }
        return areaId;
      };

      const topoKey = topoGeometryKeyMemo;
      let engine: TopologicalEngine;
      let engineRebuilt = false;

      if (!topoEngineCacheRef.current || topoEngineCacheRef.current.key !== topoKey) {
        engine = new TopologicalEngine();
        const leafAreas = (Object.values(topology) as Area[]).filter(a => a.isPiece);
        engine.initializeFromVoronoi(leafAreas, width, height);

        history.forEach(op => {
          if (op.type === 'MERGE') {
            const { areaAId, areaBId } = op.params;
            if (!engine.faces.has(areaAId) || !engine.faces.has(areaBId)) return;
            engine.mergeFaces(areaAId, areaBId);
          }
        });

        topoEngineCacheRef.current = { key: topoKey, engine };
        topoPieceCacheRef.current.clear();
        prevConnectorSigRef.current = {};
        prevConnectorAreasRef.current = {};
        lastTopoPiecesRef.current = null;
        engineRebuilt = true;
      } else {
        engine = topoEngineCacheRef.current.engine;
      }

      // Which merged groups can a connector affect? Only the two leaf areas on its edge,
      // mapped through mergedGroups — same pieces a bbox query would pick (the shared edge
      // cannot touch any other piece’s interior without crossing those two).
      const affectedGroups = new Set<string>();
      if (!engineRebuilt) {
        for (const c of resolvedConnectors) {
          const sig = connectorSignature(c);
          if (prevConnectorSigRef.current[c.id] !== sig) {
            affectedGroups.add(getGroupId(c.areaAId));
            affectedGroups.add(getGroupId(c.areaBId));
          }
        }
        for (const oldId of Object.keys(prevConnectorSigRef.current)) {
          if (!resolvedConnectors.some(c => c.id === oldId)) {
            const meta = prevConnectorAreasRef.current[oldId];
            if (meta) {
              affectedGroups.add(getGroupId(meta.areaAId));
              affectedGroups.add(getGroupId(meta.areaBId));
            }
          }
        }
      }

      const groupCount = mergedEntries.length;
      const cacheComplete = topoPieceCacheRef.current.size >= groupCount && groupCount > 0;

      if (!engineRebuilt && affectedGroups.size === 0 && cacheComplete && lastTopoPiecesRef.current) {
        return lastTopoPiecesRef.current;
      }

      clearEdgeConnectors(engine);

      resolvedConnectors.forEach(c => {
        if (c.isDeleted || c.isDormant) return;

        const areaA = topology[c.areaAId];
        const areaB = topology[c.areaBId];
        if (!areaA || !areaB) return;

        const rawStamp = createConnectorStamp(new paper.Point(0, 0), new paper.Point(1, 0), c.type, c.size, undefined, 0.5);
        const stampPathData = rawStamp.pathData;
        rawStamp.remove();

        const shared = getSharedPerimeter(areaA, areaB);
        if (!shared) return;
        const pos = getPointAtU(shared, c.u);
        shared.remove();
        if (!pos) return;

        const ownerFaceId = c.isFlipped ? c.areaBId : c.areaAId;
        engine.addConnectorAtAnchor(c.areaAId, c.areaBId, pos.point, stampPathData, c.isFlipped, ownerFaceId);
      });

      for (const c of resolvedConnectors) {
        prevConnectorSigRef.current[c.id] = connectorSignature(c);
        prevConnectorAreasRef.current[c.id] = { areaAId: c.areaAId, areaBId: c.areaBId };
      }
      for (const id of Object.keys(prevConnectorSigRef.current)) {
        if (!resolvedConnectors.some(c => c.id === id)) {
          delete prevConnectorSigRef.current[id];
          delete prevConnectorAreasRef.current[id];
        }
      }

      const needFullPass = engineRebuilt || !cacheComplete || affectedGroups.size === 0;
      const pieces: { id: string; pathData: string; color: string }[] = [];

      for (const [groupId, areaIds] of mergedEntries) {
        const color = topology[areaIds[0]]?.color || '#f1f5f9';

        if (!needFullPass && affectedGroups.size > 0 && !affectedGroups.has(groupId)) {
          const cached = topoPieceCacheRef.current.get(groupId);
          if (cached) {
            pieces.push(cached);
            continue;
          }
        }

        const boundary = engine.getMergedBoundary(areaIds);
        const p = { id: groupId, pathData: boundary, color };
        topoPieceCacheRef.current.set(groupId, p);
        pieces.push(p);
      }

      lastTopoPiecesRef.current = pieces;
      return pieces;
    }
  }, [topology, mergedGroups, width, height, history, resolvedConnectors, geometryEngine, topoGeometryKeyMemo]);

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
