import paper from 'paper';
import { Area, Connector } from './types';
import { pathItemFromBoundaryData, resetPaperProject } from './paperProject';
import {
  getPointAtU,
  createConnectorStamp,
  connectorOwnerNeighborLeafIds,
  orientConnectorNormalTowardNeighbor,
  resolveCollisions,
} from './geometry';

export type BooleanPiece = { id: string; pathData: string; color: string };

/** Union of owner and neighbor base piece paths (before tabs). Used to clip stamp when clipOverlap is off. */
function unionOwnerNeighborBasePaths(
  basePieces: BooleanPiece[],
  ownerGroupId: string,
  neighborGroupId: string
): paper.PathItem | null {
  const op = basePieces.find(p => p.id === ownerGroupId);
  const np = basePieces.find(p => p.id === neighborGroupId);
  if (!op || !np) return null;
  const a = pathItemFromBoundaryData(op.pathData);
  const b = pathItemFromBoundaryData(np.pathData);
  const u = a.unite(b) as paper.PathItem | null;
  a.remove();
  b.remove();
  return u ?? null;
}

function buildBooleanBasePiecesCore(
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>
): BooleanPiece[] {
  const pieces: BooleanPiece[] = [];

  Object.entries(mergedGroups).forEach(([groupId, areaIds]) => {
    if (areaIds.length === 1) {
      const area = topology[areaIds[0]];
      if (!area) return;
      pieces.push({ id: area.id, pathData: area.boundary, color: area.color });
    } else {
      let mergedPath: paper.PathItem | null = null;
      areaIds.forEach(id => {
        const area = topology[id];
        if (!area) return;
        const path = pathItemFromBoundaryData(area.boundary);
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
          color: topology[areaIds[0]]!.color,
        });
        cleaned.remove();
      }
    }
  });

  return pieces;
}

/**
 * Base piece paths before connector booleans — same as `usePuzzleEngine` BOOLEAN `finalPieces`
 * (singleton boundaries or merged unite+reduce per group).
 */
export function buildBooleanBasePieces(
  width: number,
  height: number,
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>
): BooleanPiece[] {
  resetPaperProject(width, height);
  return buildBooleanBasePiecesCore(topology, mergedGroups);
}

function applyBooleanConnectorStampsToPiecesCore(
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>,
  basePieces: BooleanPiece[],
  connectors: Connector[]
): BooleanPiece[] {
  const pieces: BooleanPiece[] = [];

  const getGroupId = (areaId: string) => {
    for (const [groupId, ids] of Object.entries(mergedGroups)) {
      if (ids.includes(areaId)) return groupId;
    }
    return areaId;
  };

  const resolved = connectors.filter(c => !c.isDeleted && !c.isDormant);

  const stamps = resolved
    .map(c => {
      const areaA = topology[c.areaAId];
      const areaB = topology[c.areaBId];
      if (!areaA || !areaB) return null;

      const pathA = pathItemFromBoundaryData(areaA.boundary);
      const pos = getPointAtU(pathA, c.u);
      pathA.remove();
      if (!pos) return null;

      const { ownerLeafId, neighborLeafId } = connectorOwnerNeighborLeafIds(c);
      let normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
      const nb = topology[neighborLeafId]?.boundary;
      if (nb) normal = orientConnectorNormalTowardNeighbor(pos.point, normal, nb);
      const stamp = createConnectorStamp(pos.point, normal, c.type, c.size);

      const ownerGroupId = getGroupId(ownerLeafId);
      const neighborGroupId = getGroupId(neighborLeafId);

      const groupA = getGroupId(c.areaAId);
      const groupB = getGroupId(c.areaBId);
      const isInternal = groupA === groupB;

      let stampForBool: paper.PathItem = stamp;
      if (!c.clipOverlap && !isInternal) {
        const obn = unionOwnerNeighborBasePaths(basePieces, ownerGroupId, neighborGroupId);
        if (obn) {
          const clipped = stampForBool.intersect(obn);
          obn.remove();
          if (clipped && !clipped.isEmpty()) {
            stampForBool.remove();
            stampForBool = clipped;
          }
        }
      }

      return {
        stamp: stampForBool,
        ownerGroupId,
        neighborGroupId,
        isInternal,
        clipOverlap: !!c.clipOverlap,
      };
    })
    .filter(
      (s): s is {
        stamp: paper.PathItem;
        ownerGroupId: string;
        neighborGroupId: string;
        isInternal: boolean;
        clipOverlap: boolean;
      } => s !== null
    );

  basePieces.forEach(piece => {
    let piecePath: paper.PathItem | null = pathItemFromBoundaryData(piece.pathData);

    stamps.forEach(({ stamp, ownerGroupId, neighborGroupId, isInternal, clipOverlap }) => {
      if (isInternal || !piecePath) return;

      const stampOp = stamp.clone();
      try {
        if (ownerGroupId === piece.id) {
          const next = piecePath.unite(stampOp);
          if (next) {
            piecePath.remove();
            piecePath = next;
          }
        } else if (neighborGroupId === piece.id) {
          const next = piecePath.subtract(stampOp);
          if (next) {
            piecePath.remove();
            piecePath = next;
          }
        } else if (clipOverlap && stampOp.bounds.intersects(piecePath.bounds)) {
          const next = piecePath.subtract(stampOp);
          if (next) {
            piecePath.remove();
            piecePath = next;
          }
        }
      } finally {
        stampOp.remove();
      }
    });

    if (piecePath) {
      const empty = new paper.Path();
      const united = piecePath.unite(empty) as paper.PathItem;
      empty.remove();
      piecePath.remove();
      pieces.push({ id: piece.id, pathData: united.pathData, color: piece.color });
      united.remove();
    } else {
      pieces.push(piece);
    }
  });

  stamps.forEach(s => s.stamp.remove());

  return pieces;
}

/**
 * Boolean engine: union connector stamps onto owner pieces and subtract from neighbors,
 * optionally subtracting from any other piece whose bounds intersect the stamp (clipOverlap).
 * Extracted for unit tests; must match usePuzzleEngine finalPiecesWithConnectors behavior.
 */
export function applyBooleanConnectorStampsToPieces(
  width: number,
  height: number,
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>,
  basePieces: BooleanPiece[],
  connectors: Connector[]
): BooleanPiece[] {
  resetPaperProject(width, height);
  return applyBooleanConnectorStampsToPiecesCore(topology, mergedGroups, basePieces, connectors);
}

/**
 * Canvas preview (BOOLEAN): neighbor socket subtract always. When `clipOverlap`, match cut: owner union + third-piece
 * subtract; tab is not duplicated in {@link buildConnectorOverlays} for those connectors. When `clipOverlap` is off,
 * owner tab is {@link buildConnectorOverlays} only.
 */
function applyBooleanConnectorDisplayPiecesCore(
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>,
  basePieces: BooleanPiece[],
  connectors: Connector[]
): BooleanPiece[] {
  const pieces: BooleanPiece[] = [];

  const getGroupId = (areaId: string) => {
    for (const [groupId, ids] of Object.entries(mergedGroups)) {
      if (ids.includes(areaId)) return groupId;
    }
    return areaId;
  };

  const resolved = connectors.filter(c => !c.isDeleted && !c.isDormant);

  const stamps = resolved
    .map(c => {
      const areaA = topology[c.areaAId];
      const areaB = topology[c.areaBId];
      if (!areaA || !areaB) return null;

      const pathA = pathItemFromBoundaryData(areaA.boundary);
      const pos = getPointAtU(pathA, c.u);
      pathA.remove();
      if (!pos) return null;

      const { ownerLeafId, neighborLeafId } = connectorOwnerNeighborLeafIds(c);
      let normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
      const nb = topology[neighborLeafId]?.boundary;
      if (nb) normal = orientConnectorNormalTowardNeighbor(pos.point, normal, nb);
      const stamp = createConnectorStamp(pos.point, normal, c.type, c.size);

      const ownerGroupId = getGroupId(ownerLeafId);
      const neighborGroupId = getGroupId(neighborLeafId);

      const groupA = getGroupId(c.areaAId);
      const groupB = getGroupId(c.areaBId);

      return {
        stamp,
        ownerGroupId,
        neighborGroupId,
        isInternal: groupA === groupB,
        clipOverlap: !!c.clipOverlap,
      };
    })
    .filter(
      (s): s is {
        stamp: paper.Path;
        ownerGroupId: string;
        neighborGroupId: string;
        isInternal: boolean;
        clipOverlap: boolean;
      } => s !== null
    );

  basePieces.forEach(piece => {
    let piecePath: paper.PathItem | null = pathItemFromBoundaryData(piece.pathData);

    stamps.forEach(({ stamp, ownerGroupId, neighborGroupId, isInternal, clipOverlap }) => {
      if (isInternal || !piecePath) return;

      const stampOp = stamp.clone();
      try {
        if (ownerGroupId === piece.id) {
          if (clipOverlap) {
            const next = piecePath.unite(stampOp);
            if (next) {
              piecePath.remove();
              piecePath = next;
            }
          }
        } else if (neighborGroupId === piece.id) {
          const next = piecePath.subtract(stampOp);
          if (next) {
            piecePath.remove();
            piecePath = next;
          }
        } else if (clipOverlap && stampOp.bounds.intersects(piecePath.bounds)) {
          const next = piecePath.subtract(stampOp);
          if (next) {
            piecePath.remove();
            piecePath = next;
          }
        }
      } finally {
        stampOp.remove();
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
}

export function applyBooleanConnectorDisplayPieces(
  width: number,
  height: number,
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>,
  basePieces: BooleanPiece[],
  connectors: Connector[]
): BooleanPiece[] {
  resetPaperProject(width, height);
  return applyBooleanConnectorDisplayPiecesCore(topology, mergedGroups, basePieces, connectors);
}

export type ConnectorOverlay = {
  connectorId: string;
  stampPathData: string;
  fillColor: string;
  /** Reserved; boolean preview no longer clips the overlay (clip overlap is shown on piece paths). */
  clipPathData: string | null;
};

/**
 * Tab stamps above piece paths. Boolean preview omits `clipOverlap` connectors (tab is in the path). Topological
 * mode passes `allConnectorsAsOverlays` so every stamp is drawn on top.
 */
function buildConnectorOverlaysCore(
  topology: Record<string, Area>,
  connectors: Connector[],
  allConnectorsAsOverlays: boolean
): ConnectorOverlay[] {
  const out: ConnectorOverlay[] = [];

  for (const c of connectors) {
    if (c.isDeleted || c.isDormant) continue;
    if (!allConnectorsAsOverlays && c.clipOverlap) continue;
    const areaA = topology[c.areaAId];
    const areaB = topology[c.areaBId];
    if (!areaA || !areaB) continue;

    const pathA = pathItemFromBoundaryData(areaA.boundary);
    const pos = getPointAtU(pathA, c.u);
    pathA.remove();
    if (!pos) continue;

    const { ownerLeafId, neighborLeafId } = connectorOwnerNeighborLeafIds(c);
    let normal = c.isFlipped ? pos.normal.multiply(-1) : pos.normal;
    const nb = topology[neighborLeafId]?.boundary;
    if (nb) normal = orientConnectorNormalTowardNeighbor(pos.point, normal, nb);
    const stamp = createConnectorStamp(pos.point, normal, c.type, c.size);

    const ownerArea = topology[ownerLeafId];
    const fillColor = ownerArea?.color ?? '#94a3b8';

    out.push({
      connectorId: c.id,
      stampPathData: stamp.pathData,
      fillColor,
      clipPathData: null,
    });
    stamp.remove();
  }

  return out;
}

export function buildConnectorOverlays(
  width: number,
  height: number,
  topology: Record<string, Area>,
  _mergedGroups: Record<string, string[]>,
  _basePieces: BooleanPiece[],
  connectors: Connector[]
): ConnectorOverlay[] {
  resetPaperProject(width, height);
  return buildConnectorOverlaysCore(topology, connectors, false);
}

/** Topological engine preview: one stamp overlay per connector, always above piece fills. */
export function buildTopoConnectorStampOverlays(
  width: number,
  height: number,
  topology: Record<string, Area>,
  connectors: Connector[]
): ConnectorOverlay[] {
  resetPaperProject(width, height);
  return buildConnectorOverlaysCore(topology, connectors, true);
}

/**
 * Single Paper project lifecycle: resolve collisions → base → cut → preview → overlays (resets between phases).
 * Collision resolution runs once here so the hook does not call `resetPaperProject` + `resolveCollisions` and then
 * this pipeline again (duplicate projects per frame during connector drags).
 */
export function computeBooleanGeometry(
  width: number,
  height: number,
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>,
  connectors: Connector[]
): {
  basePieces: BooleanPiece[];
  cutPieces: BooleanPiece[];
  previewPieces: BooleanPiece[];
  connectorOverlays: ConnectorOverlay[];
  resolvedConnectors: Connector[];
} {
  resetPaperProject(width, height);
  const resolvedConnectors = resolveCollisions([...connectors], topology);
  const basePieces = buildBooleanBasePiecesCore(topology, mergedGroups);

  const cutPieces = applyBooleanConnectorStampsToPiecesCore(
    topology,
    mergedGroups,
    basePieces,
    resolvedConnectors
  );

  resetPaperProject(width, height);
  const previewPieces = applyBooleanConnectorDisplayPiecesCore(
    topology,
    mergedGroups,
    basePieces,
    resolvedConnectors
  );

  resetPaperProject(width, height);
  const connectorOverlays = buildConnectorOverlaysCore(topology, resolvedConnectors, false);

  return { basePieces, cutPieces, previewPieces, connectorOverlays, resolvedConnectors };
}

/** Intersection area between two path datas (absolute value). Caller must paper.setup first or pass active project. */
export function intersectionArea(pathDataA: string, pathDataB: string): number {
  const a = pathItemFromBoundaryData(pathDataA);
  const b = pathItemFromBoundaryData(pathDataB);
  const x = a.intersect(b) as paper.PathItem | paper.CompoundPath | null;
  let area = 0;
  if (x) {
    if (x instanceof paper.CompoundPath) {
      x.children.forEach(ch => {
        area += Math.abs((ch as paper.Path).area);
      });
    } else if (x instanceof paper.Path) {
      area = Math.abs(x.area);
    }
    x.remove();
  }
  a.remove();
  b.remove();
  return area;
}
