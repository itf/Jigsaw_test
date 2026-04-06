import { useMemo, useRef } from 'react';
import paper from 'paper';
import { Delaunay } from 'd3-delaunay';
import { Point, Area, AreaType, Connector, Operation, CreateRootShape } from '../types';
import { buildAreasFromInitialShape, cloneAreaMap } from '../initial_area';
import { applyAddWhimsyOp } from '../whimsy_cut';
import {
  getSharedPerimeter,
  getPointAtU,
  createConnectorStamp,
  resolveCollisions,
  connectorOwnerNeighborLeafIds,
  orientConnectorNormalTowardNeighbor,
  clampConnectorU,
  findNeighborAt,
} from '../geometry';
import {
  computeBooleanGeometry,
  buildTopoConnectorStampOverlays,
  type ConnectorOverlay,
} from '../boolean_connector_geometry';
import { pathItemFromBoundaryData, resetPaperProject } from '../paperProject';
import { TopologicalEngine } from '../topology_engine';
import { COLORS, Tab } from '../constants';

interface PuzzleEngineProps {
  width: number;
  height: number;
  /** Initial region shape(s) before history; same model as a whimsy seed piece. */
  initialShape: CreateRootShape;
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
    !!c.clipOverlap,
    c.areaAId,
    c.areaBId,
  ].join('|');
}

/** SUBDIVIDE / MERGE / ADD_WHIMSY only — replaying these rebuilds `topology`; ADD_CONNECTOR etc. must not invalidate this key. */
function topologyAffectingHistoryKey(history: Operation[]): string {
  return JSON.stringify(
    history.filter(
      op => op.type === 'MERGE' || op.type === 'SUBDIVIDE' || op.type === 'ADD_WHIMSY'
    )
  );
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
  /** Messages from ADD_WHIMSY (small fragments, failed placement). */
  whimsyWarnings: string[];
  sharedEdges: { id: string; areaAId: string; areaBId: string; pathData: string; isMerged: boolean }[];
  connectors: Connector[];
  resolvedConnectors: Connector[];
  /** Cut geometry: full booleans (union on owner) — use for Production / laser export. */
  finalPieces: { id: string; pathData: string; color: string }[];
  /** BOOLEAN preview: neighbor/third subtracts only; tabs drawn via `connectorOverlays`. TOPO: same as `finalPieces`. */
  previewPieces: { id: string; pathData: string; color: string }[];
  connectorOverlays: ConnectorOverlay[];
}

export function usePuzzleEngine({
  width,
  height,
  initialShape,
  history,
  activeTab,
  geometryEngine,
}: PuzzleEngineProps): PuzzleEngineResult {
  // Topological engine: reuse graph across connector param changes; partial getMergedBoundary.
  const topoEngineCacheRef = useRef<{ key: string; engine: TopologicalEngine } | null>(null);
  const topoPieceCacheRef = useRef<Map<string, { id: string; pathData: string; color: string }>>(new Map());
  const prevConnectorSigRef = useRef<Record<string, string>>({});
  const prevConnectorAreasRef = useRef<Record<string, { areaAId: string; areaBId: string }>>({});
  const lastTopoPiecesRef = useRef<{ id: string; pathData: string; color: string }[] | null>(null);

  const baseAreas = useMemo(
    () => buildAreasFromInitialShape(width, height, initialShape),
    [width, height, initialShape]
  );

  const topologyKey = useMemo(() => topologyAffectingHistoryKey(history), [history]);

  // 2–3. Topology + merged groups: history order matters (MERGE uses geometry at that moment).
  // Depends on topologyKey, not full history, so ADD_CONNECTOR / RESOLVE / etc. do not replay Voronoi + O(n²) merges.
  const { topology, mergedGroups, whimsyWarnings } = useMemo((): {
    topology: Record<string, Area>;
    mergedGroups: Record<string, string[]>;
    whimsyWarnings: string[];
  } => {
    const areas = cloneAreaMap(baseAreas);
    resetPaperProject(width, height);
    const whimsyWarnings: string[] = [];

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

    const topologyOps = history.filter(
      op => op.type === 'MERGE' || op.type === 'SUBDIVIDE' || op.type === 'ADD_WHIMSY'
    );

    topologyOps.forEach(op => {
      if (op.type === 'MERGE') {
        applyMerge(op);
        return;
      }
      if (op.type === 'SUBDIVIDE') {
        const { parentId, points, clipBoundary, absorbedLeafIds } = op.params;
        const parent = areas[parentId];
        if (!parent) return;

        const boundaryData = (clipBoundary as string | undefined) ?? parent.boundary;
        const parentPath0 = pathItemFromBoundaryData(boundaryData);
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

        const absorbed = absorbedLeafIds as string[] | undefined;
        if (absorbed?.length) {
          absorbed.forEach(id => {
            delete areas[id];
          });
        }
        return;
      }
      if (op.type === 'ADD_WHIMSY') {
        const { warnings, remainderClusters } = applyAddWhimsyOp(areas, op, width, height, find);
        whimsyWarnings.push(...warnings);
        for (const { anchorRep, remainderIds } of remainderClusters) {
          for (const id of remainderIds) union(anchorRep, id);
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

    return { topology: areas, mergedGroups: groups, whimsyWarnings };
    // topologyKey captures topology-affecting ops; `history` is read from the render when the key changes (omit from deps).
  }, [baseAreas, topologyKey, width, height]);

    // 4. Shared Edges: For visualization and connector placement
    const sharedEdges = useMemo(() => {
      const leafAreas = (Object.values(topology) as Area[]).filter(a => a.isPiece);
      const edges: { id: string; areaAId: string; areaBId: string; pathData: string; isMerged: boolean }[] = [];

      if (leafAreas.length > 200) return [];

      resetPaperProject(width, height);

      const whimsyAreas = leafAreas.filter(a => a.type === AreaType.WHIMSY);

      const getGroupId = (areaId: string) => {
        for (const [groupId, ids] of Object.entries(mergedGroups as Record<string, string[]>)) {
          if (ids.includes(areaId)) return groupId;
        }
        return areaId;
      };

      // Group shared perimeters by (groupA, groupB)
      const groupSharedMap = new Map<string, { areaAId: string; areaBId: string; paths: paper.PathItem[]; isMerged: boolean }>();

      for (let i = 0; i < leafAreas.length; i++) {
        for (let j = i + 1; j < leafAreas.length; j++) {
          const areaA = leafAreas[i];
          const areaB = leafAreas[j];

          const shared = getSharedPerimeter(areaA, areaB);
          if (!shared) continue;

          const groupA = getGroupId(areaA.id);
          const groupB = getGroupId(areaB.id);
          const isMerged = groupA === groupB;

          const key = [groupA, groupB].sort().join('::');
          if (!groupSharedMap.has(key)) {
            groupSharedMap.set(key, { areaAId: areaA.id, areaBId: areaB.id, paths: [], isMerged });
          }
          groupSharedMap.get(key)!.paths.push(shared);
        }
      }

      for (const [key, data] of groupSharedMap.entries()) {
        const { areaAId, areaBId, paths, isMerged } = data;
        
        // Combine all paths for this group pair
        let combined: paper.PathItem | null = null;
        for (const p of paths) {
          if (!combined) {
            combined = p;
          } else {
            const next = combined.unite(p);
            combined.remove();
            p.remove();
            combined = next;
          }
        }

        if (!combined || (combined as any).length < 0.05) {
          combined?.remove();
          continue;
        }

        // Clip against whimsies if not a whimsy itself
        const areaA = topology[areaAId];
        const areaB = topology[areaBId];
        if (areaA.type !== AreaType.WHIMSY && areaB.type !== AreaType.WHIMSY) {
          for (const w of whimsyAreas) {
            const wPath = pathItemFromBoundaryData(w.boundary);
            const clipped = combined.subtract(wPath);
            wPath.remove();
            combined.remove();
            combined = clipped;
            if (!combined || (combined as any).length < 0.05) break;
          }
        }

        if (combined && (combined as any).length > 0.05) {
          edges.push({
            id: key,
            areaAId,
            areaBId,
            pathData: (combined as any).pathData,
            isMerged
          });
        }
        combined?.remove();
      }

      return edges;
    }, [topology, mergedGroups, width, height]);

  // 5. Connectors: The list of tabs to be applied
  const connectors = useMemo<Connector[]>(() => {
    let connList: Connector[] = [];
    if (activeTab === 'TOPOLOGY' || activeTab === 'MODIFICATION') return [];

    history.forEach(op => {
      if (op.type === 'ADD_CONNECTOR') {
        const aId = op.params.areaAId as string;
        const bId = op.params.areaBId as string;
        if (!topology[aId] || !topology[bId]) return;
        connList.push({
          id: op.id,
          areaAId: aId,
          areaBId: bId,
          u: clampConnectorU(op.params.u),
          isFlipped: op.params.isFlipped || false,
          type: op.params.type || 'TAB',
          size: op.params.size || 20,
          isDormant: false,
          clipOverlap: geometryEngine === 'TOPOLOGICAL' ? true : !!op.params.clipOverlap,
        });
      }
    });
    
    return connList;
  }, [history, activeTab, geometryEngine, topology]);

  // Re-anchor connectors to their actual neighbor at position 'u'
  const reanchoredConnectors = useMemo(() => {
    if (Object.keys(topology).length === 0) return connectors;
    resetPaperProject(width, height);
    return connectors.map(c => {
      const areaA = topology[c.areaAId];
      if (!areaA) return c;
      const actualNeighborId = findNeighborAt(areaA, c.u, topology, width, height);
      if (actualNeighborId && actualNeighborId !== c.areaBId) {
        return { ...c, areaBId: actualNeighborId };
      }
      return c;
    });
  }, [connectors, topology, width, height]);

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

  /** BOOLEAN: collision resolve + one Paper pipeline (no duplicate resolve+reset before this memo). */
  const booleanGeometry = useMemo(() => {
    if (geometryEngine !== 'BOOLEAN' || Object.keys(topology).length === 0) return null;
    return computeBooleanGeometry(
      width,
      height,
      topology,
      mergedGroups as Record<string, string[]>,
      reanchoredConnectors
    );
  }, [topology, mergedGroups, reanchoredConnectors, width, height, geometryEngine]);

  // Resolved connectors: re-anchor to current neighbor at position 'u' before resolving collisions.
  const resolvedConnectors = useMemo(() => {
    if (activeTab === 'TOPOLOGY' || activeTab === 'MODIFICATION') return [];
    
    if (geometryEngine === 'BOOLEAN') {
      // BOOLEAN reuses collision result from computeBooleanGeometry
      return booleanGeometry?.resolvedConnectors ?? [];
    }
    
    resetPaperProject(width, height);
    return resolveCollisions(reanchoredConnectors, topology);
  }, [reanchoredConnectors, topology, activeTab, width, height, geometryEngine, booleanGeometry]);

  // 7. Final Pieces: The base geometry of each piece (merged or single)
  const finalPieces = useMemo(() => {
    if (Object.keys(topology).length === 0) return [];

    if (geometryEngine === 'BOOLEAN') {
      return booleanGeometry?.basePieces ?? [];
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

      // Which merged groups need recomputing? Edge pieces for changed connectors; **all** groups when any
      // connector param changes — clipOverlap toggles third-party subtracts and must not reuse stale cache.
      const affectedGroups = new Set<string>();
      let anyConnectorSigChanged = false;
      if (!engineRebuilt) {
        for (const c of resolvedConnectors) {
          const sig = connectorSignature(c);
          if (prevConnectorSigRef.current[c.id] !== sig) {
            anyConnectorSigChanged = true;
            affectedGroups.add(getGroupId(c.areaAId));
            affectedGroups.add(getGroupId(c.areaBId));
          }
        }
        for (const oldId of Object.keys(prevConnectorSigRef.current)) {
          if (!resolvedConnectors.some(c => c.id === oldId)) {
            const meta = prevConnectorAreasRef.current[oldId];
            if (meta) {
              anyConnectorSigChanged = true;
              affectedGroups.add(getGroupId(meta.areaAId));
              affectedGroups.add(getGroupId(meta.areaBId));
            }
          }
        }
        if (anyConnectorSigChanged) {
          mergedEntries.forEach(([groupId]) => affectedGroups.add(groupId));
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

        const pathA = pathItemFromBoundaryData(areaA.boundary);
        const pos = getPointAtU(pathA, c.u);
        pathA.remove();
        if (!pos) return;

        const shared = getSharedPerimeter(areaA, areaB);
        let chordEnd0: paper.Point | undefined;
        let chordEnd1: paper.Point | undefined;
        let sharedU = 0.5;

        if (shared) {
          const chordPath = shared as paper.Path;
          chordEnd0 = chordPath.firstSegment.point.clone();
          chordEnd1 = chordPath.lastSegment.point.clone();

          const nearestOnShared = chordPath.getNearestPoint(pos.point);
          sharedU = chordPath.getOffsetOf(nearestOnShared) / chordPath.length;
          shared.remove();
        }

        const ownerFaceId = c.isFlipped ? c.areaBId : c.areaAId;
        engine.addConnectorAtAnchor(
          c.areaAId,
          c.areaBId,
          pos.point,
          stampPathData,
          c.isFlipped,
          ownerFaceId,
          sharedU, // Use shared-edge-relative u for tie-breaking
          chordEnd0,
          chordEnd1
        );
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

      const hasActiveConnectors = resolvedConnectors.some(c => !c.isDeleted && !c.isDormant);
      if (hasActiveConnectors) {
        resetPaperProject(width, height);
      }

      for (const [groupId, areaIds] of mergedEntries) {
        const color = topology[areaIds[0]]?.color || '#f1f5f9';

        if (!needFullPass && affectedGroups.size > 0 && !affectedGroups.has(groupId)) {
          const cached = topoPieceCacheRef.current.get(groupId);
          if (cached) {
            pieces.push(cached);
            continue;
          }
        }

        // The topological engine assumes adjacent faces share edges in opposite traversal
        // directions (standard planar graph property). WHIMSY pieces break this: the whimsy's
        // outer circle boundary and the remainder's inner circle hole both traverse the shared
        // edge CCW after the engine's reversal step, so edge deduplication overwrites faceAId
        // with the remainder's id — the whimsy face disappears from the graph. Fall back to
        // boolean union of area.boundary values (same as the boolean engine) for any group
        // that contains a WHIMSY area. This also fixes the "leftover perimeter" bug when the
        // whimsy is deleted (merged with its neighbors), because the union correctly cancels
        // the circular hole.
        const hasWhimsy = areaIds.some(id => topology[id]?.type === AreaType.WHIMSY);
        let boundaryData: string;
        if (hasWhimsy) {
          let mergedPath: paper.PathItem | null = null;
          for (const id of areaIds) {
            const area = topology[id];
            if (!area) continue;
            const path = pathItemFromBoundaryData(area.boundary);
            if (!mergedPath) {
              mergedPath = path;
            } else {
              const next = mergedPath.unite(path);
              mergedPath.remove();
              path.remove();
              mergedPath = next;
            }
          }
          if (mergedPath) {
            const cleaned = (mergedPath as paper.PathItem).reduce({ insert: false }) as paper.PathItem;
            cleaned.reorient(true, true);
            boundaryData = cleaned.pathData;
            cleaned.remove();
            mergedPath.remove();
          } else {
            boundaryData = '';
          }
        } else {
          boundaryData = engine.getMergedBoundary(areaIds);
        }

        // Graph splice puts the same tab outline on both sides of a shared edge; subtract the stamp
        // from neighbor pieces so material matches boolean (tab on owner only, socket on neighbor).
        if (boundaryData && hasActiveConnectors) {
          let piecePath: paper.PathItem | null = pathItemFromBoundaryData(boundaryData);

          resolvedConnectors.forEach(c => {
            if (c.isDeleted || c.isDormant || !piecePath) return;
            const areaA = topology[c.areaAId];
            const areaB = topology[c.areaBId];
            if (!areaA || !areaB) return;

            const pathA = pathItemFromBoundaryData(areaA.boundary);
            const pos = getPointAtU(pathA, c.u);
            pathA.remove();
            if (!pos) return;

            const { ownerLeafId, neighborLeafId } = connectorOwnerNeighborLeafIds(c);
            let normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
            const nb = topology[neighborLeafId]?.boundary;
            if (nb) normal = orientConnectorNormalTowardNeighbor(pos.point, normal, nb);
            const stamp = createConnectorStamp(pos.point, normal, c.type, c.size);

            const ownerGroupId = getGroupId(ownerLeafId);
            const neighborGroupId = getGroupId(neighborLeafId);

            if (ownerGroupId === neighborGroupId) {
              stamp.remove();
              return;
            }

            const isNeighbor = neighborGroupId === groupId;
            const isThirdPartyClip =
              !!c.clipOverlap &&
              groupId !== ownerGroupId &&
              groupId !== neighborGroupId &&
              stamp.bounds.intersects(piecePath.bounds);

            if (!isNeighbor && !isThirdPartyClip) {
              stamp.remove();
              return;
            }

            const stampOp = stamp.clone();
            const next = piecePath.subtract(stampOp);
            stampOp.remove();
            stamp.remove();
            if (next) {
              piecePath.remove();
              piecePath = next;
            }
          });

          if (piecePath) {
            boundaryData = piecePath.pathData;
            piecePath.remove();
          }
        }

        const p = { id: groupId, pathData: boundaryData, color };
        topoPieceCacheRef.current.set(groupId, p);
        pieces.push(p);
      }

      lastTopoPiecesRef.current = pieces;
      return pieces;
    }
  }, [
    topology,
    mergedGroups,
    width,
    height,
    history,
    resolvedConnectors,
    geometryEngine,
    topoGeometryKeyMemo,
    booleanGeometry,
  ]);

  // 8. Cut pieces (full booleans — laser / production truth)
  const finalPiecesWithConnectors = useMemo(() => {
    if (geometryEngine === 'TOPOLOGICAL') return finalPieces;
    return booleanGeometry?.cutPieces ?? [];
  }, [geometryEngine, finalPieces, booleanGeometry]);

  // Canvas preview (BOOLEAN): no owner union; tabs in `connectorOverlays`
  const previewPiecesWithConnectors = useMemo(() => {
    if (geometryEngine !== 'BOOLEAN') return finalPiecesWithConnectors;
    return booleanGeometry?.previewPieces ?? finalPiecesWithConnectors;
  }, [geometryEngine, finalPiecesWithConnectors, booleanGeometry]);

  const connectorOverlays = useMemo((): ConnectorOverlay[] => {
    if (geometryEngine === 'TOPOLOGICAL') {
      if (Object.keys(topology).length === 0) return [];
      if (activeTab === 'TOPOLOGY' || activeTab === 'MODIFICATION') return [];
      return buildTopoConnectorStampOverlays(width, height, topology, resolvedConnectors);
    }
    if (geometryEngine !== 'BOOLEAN') return [];
    return booleanGeometry?.connectorOverlays ?? [];
  }, [geometryEngine, topology, width, height, resolvedConnectors, booleanGeometry, activeTab]);

  return {
    topology,
    mergedGroups,
    whimsyWarnings,
    sharedEdges,
    connectors,
    resolvedConnectors,
    finalPieces: finalPiecesWithConnectors,
    previewPieces: previewPiecesWithConnectors,
    connectorOverlays,
  };
}
