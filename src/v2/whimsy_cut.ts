import paper from 'paper';
import { Area, AreaType, Operation, AddWhimsyParams, Point, WhimsyTemplateId } from './types';
import { COLORS } from './constants';
import { getWhimsyTemplatePathData } from './whimsy_gallery';
import { pathItemFromBoundaryData, resetPaperProject } from './paperProject';

function absPathItemArea(item: paper.PathItem): number {
  return Math.abs((item as paper.Path).area);
}

/** Ignore dust-sized boolean results (px²). */
const EPS_AREA = 1e-3;

/** Whimsy piece must be at least this area (px²) or op is skipped. */
export const WHIMSY_MIN_AREA_ABS = 400;

/** Whimsy must be at least this fraction of combined participating leaf area. */
export const WHIMSY_MIN_FRAC_OF_MATERIAL = 0.003;

/** Warn when a remainder fragment is smaller than this fraction of canvas (w×h). */
export const WHIMSY_WARN_REMAINDER_FRAC_OF_CANVAS = 0.012;

export function buildWhimsyStencilPathData(
  templateId: WhimsyTemplateId,
  center: Point,
  scale: number,
  rotationDeg: number,
  width: number,
  height: number
): string {
  resetPaperProject(width, height);
  const stem = getWhimsyTemplatePathData(templateId);
  const stencil = new paper.Path(stem);
  stencil.closed = true;
  stencil.scale(scale, new paper.Point(0, 0));
  stencil.rotate(rotationDeg, new paper.Point(0, 0));
  stencil.position = new paper.Point(center.x, center.y);
  stencil.reorient(true, true);
  const d = stencil.pathData;
  stencil.remove();
  return d;
}

/** Boolean ops on stars / complex stencils can return several disjoint surfaces; unite into one path per role. */
function unitePaperPaths(paths: paper.PathItem[]): paper.PathItem[] {
  if (paths.length <= 1) return paths;
  let acc = paths[0];
  for (let i = 1; i < paths.length; i++) {
    const u = acc.unite(paths[i]);
    acc.remove();
    paths[i].remove();
    acc = u;
  }
  return [acc];
}

/**
 * `material.subtract(stencil)` can be (1) one region with holes (square minus circle) or (2) several
 * disjoint positive fragments (star remainder). Splitting a compound into children and then
 * boolean-uniting them fills holes — outer ∪ inner loop becomes a solid. Preserve full `pathData`
 * when we detect hole topology; only unite disjoint all-positive fragments.
 */
function collectRemainderPathsFromSubtract(item: paper.PathItem | null): paper.PathItem[] {
  if (!item) return [];
  const reduced = item.reduce({ insert: false }) as paper.PathItem;

  if (reduced instanceof paper.CompoundPath) {
    const n = reduced.children.length;
    let sumAbs = 0;
    let hasNegativeAreaChild = false;
    for (let i = 0; i < n; i++) {
      const ch = reduced.children[i] as paper.Path;
      if (!ch) continue;
      sumAbs += Math.abs(ch.area);
      if (ch.area < -EPS_AREA) hasNegativeAreaChild = true;
    }
    const netAbs = Math.abs(reduced.area);
    const looksLikeRingOrHole = n >= 2 && netAbs < sumAbs - EPS_AREA;

    if (hasNegativeAreaChild || looksLikeRingOrHole || n === 1) {
      const pathData = reduced.pathData;
      reduced.remove();
      return [pathItemFromBoundaryData(pathData)];
    }

    const split: paper.Path[] = [];
    for (let i = 0; i < n; i++) {
      const ch = reduced.children[i] as paper.Path;
      if (ch && Math.abs(ch.area) > EPS_AREA) split.push(new paper.Path(ch.pathData));
    }
    reduced.remove();
    return unitePaperPaths(split);
  }

  if (reduced instanceof paper.Path) {
    if (Math.abs(reduced.area) <= EPS_AREA) {
      reduced.remove();
      return [];
    }
    const pathData = reduced.pathData;
    reduced.remove();
    return [pathItemFromBoundaryData(pathData)];
  }
  reduced.remove();
  return [];
}

function collectSurfacePaths(item: paper.PathItem | null): paper.PathItem[] {
  if (!item) return [];
  const reduced = item.reduce({ insert: false }) as paper.PathItem;
  if (reduced instanceof paper.CompoundPath) {
    const n = reduced.children.length;
    let sumAbs = 0;
    let hasNegativeAreaChild = false;
    for (let i = 0; i < n; i++) {
      const ch = reduced.children[i] as paper.Path;
      if (!ch) continue;
      sumAbs += Math.abs(ch.area);
      if (ch.area < -EPS_AREA) hasNegativeAreaChild = true;
    }
    const netAbs = Math.abs(reduced.area);
    const looksLikeRingOrHole = n >= 2 && netAbs < sumAbs - EPS_AREA;

    if (hasNegativeAreaChild || looksLikeRingOrHole || n === 1) {
      const pathData = reduced.pathData;
      reduced.remove();
      return [pathItemFromBoundaryData(pathData)];
    }

    const out: paper.Path[] = [];
    for (let i = 0; i < reduced.children.length; i++) {
      const ch = reduced.children[i] as paper.Path;
      if (ch && Math.abs(ch.area) > EPS_AREA) {
        out.push(new paper.Path(ch.pathData));
      }
    }
    reduced.remove();
    return unitePaperPaths(out);
  }
  if (reduced instanceof paper.Path) {
    if (Math.abs(reduced.area) <= EPS_AREA) {
      reduced.remove();
      return [];
    }
    const pathData = reduced.pathData;
    reduced.remove();
    return [pathItemFromBoundaryData(pathData)];
  }
  reduced.remove();
  return [];
}

function pathCentroid(p: paper.PathItem): Point {
  const b = p.bounds;
  return { x: b.center.x, y: b.center.y };
}

function lowestCommonAncestor(areas: Record<string, Area>, leafIds: string[]): string {
  if (leafIds.length === 0) return 'root';
  if (leafIds.length === 1) {
    const id = leafIds[0];
    const p = areas[id]?.parentId;
    // Root-only leaf: attach new pieces under this node (it becomes the container).
    if (p == null) return id;
    return p;
  }
  const paths = leafIds.map(id => {
    const chain: string[] = [];
    let x: string | undefined = id;
    while (x) {
      chain.unshift(x);
      x = areas[x]?.parentId ?? undefined;
    }
    return chain;
  });
  const minL = Math.min(...paths.map(p => p.length));
  let depth = 0;
  for (; depth < minL; depth++) {
    const id0 = paths[0][depth];
    if (!paths.every(p => p[depth] === id0)) break;
  }
  return depth === 0 ? paths[0][0] : paths[0][depth - 1];
}

function unionClusterBoundaries(leaves: Area[]): paper.PathItem {
  let mergedPath: paper.PathItem | null = null;
  for (const leaf of leaves) {
    const path = pathItemFromBoundaryData(leaf.boundary);
    if (!mergedPath) {
      mergedPath = path;
    } else {
      const next = mergedPath.unite(path);
      mergedPath.remove();
      path.remove();
      mergedPath = next;
    }
  }
  if (!mergedPath) throw new Error('unionClusterBoundaries: empty cluster');
  const cleaned = mergedPath.reduce({ insert: false }) as paper.PathItem;
  const out = pathItemFromBoundaryData(cleaned.pathData);
  mergedPath.remove();
  cleaned.remove();
  return out;
}

/**
 * True if the leaf's filled region overlaps the stencil with positive area.
 * Paper.js boolean `intersect` often returns ~0 area for arc / high-segment circles even when the
 * regions overlap; we fall back to sampling the overlap bbox and to boundary crossings.
 */
function leafOverlapsStencil(leaf: Area, stencil: paper.Path): boolean {
  const lp = pathItemFromBoundaryData(leaf.boundary);
  const sb = stencil.bounds.clone().expand(1);
  if (!lp.bounds.intersects(sb)) {
    lp.remove();
    return false;
  }
  const st = stencil.clone({ insert: true }) as paper.Path;
  const hit = lp.intersect(st);
  let area = 0;
  if (hit) {
    if (hit instanceof paper.CompoundPath) {
      hit.children.forEach(ch => {
        area += Math.abs((ch as paper.Path).area);
      });
    } else if (hit instanceof paper.Path) {
      area = Math.abs(hit.area);
    }
    hit.remove();
  }
  if (area > EPS_AREA) {
    lp.remove();
    st.remove();
    return true;
  }

  const ib = lp.bounds.intersect(st.bounds);
  if (ib != null && ib.width > 0 && ib.height > 0) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = ib.left + ((i + 0.5) / n) * ib.width;
        const y = ib.top + ((j + 0.5) / n) * ib.height;
        const pt = new paper.Point(x, y);
        if (st.contains(pt) && lp.contains(pt)) {
          lp.remove();
          st.remove();
          return true;
        }
      }
    }
  }

  // Two overlapping simple closed curves usually meet at ≥2 boundary crossings; catches boolean gaps.
  if (lp.getIntersections(st).length >= 2) {
    lp.remove();
    st.remove();
    return true;
  }

  lp.remove();
  st.remove();
  return false;
}

/**
 * Every leaf whose merge-group representative overlaps the stencil must be re-cut together
 * (union material, then subtract stencil). Other leaves are left unchanged.
 */
function expandParticipatingByMergeGroup(
  leaves: Area[],
  overlapSeeds: Area[],
  find: (id: string) => string
): Area[] {
  if (overlapSeeds.length === 0) return [];
  const repSet = new Set(overlapSeeds.map(l => find(l.id)));
  return leaves.filter(l => repSet.has(find(l.id))).sort((a, b) => a.id.localeCompare(b.id));
}

export type ApplyAddWhimsyResult = {
  warnings: string[];
  /**
   * Per material cluster: `anchorRep` is `find(cluster[0].id)` before any deletes — ties new remainder
   * leaf ids to the pre-cut merge group. `remainderIds` are the new SUBDIVISION leaves from that cut.
   */
  remainderClusters: { anchorRep: string; remainderIds: string[] }[];
};

/** Legacy: single parent material (optional merged clip). */
function applyAddWhimsyOpLegacy(
  areas: Record<string, Area>,
  op: Operation,
  width: number,
  height: number,
  params: AddWhimsyParams,
  find: (id: string) => string
): ApplyAddWhimsyResult {
  const warnings: string[] = [];
  const { parentId, templateId, center, scale, rotationDeg, clipBoundary, absorbedLeafIds } = params;
  const parent = areas[parentId!];
  if (!parent?.isPiece) return { warnings, remainderClusters: [] };

  const boundaryData = clipBoundary ?? parent.boundary;
  const canvasArea = width * height;

  resetPaperProject(width, height);

  const material = pathItemFromBoundaryData(boundaryData);
  const materialArea = absPathItemArea(material);
  if (materialArea <= EPS_AREA) {
    material.remove();
    warnings.push('Parent material has no area; whimsy not added.');
    return { warnings, remainderClusters: [] };
  }

  const stem = getWhimsyTemplatePathData(templateId);
  const stencil = new paper.Path(stem);
  stencil.closed = true;
  stencil.scale(scale, new paper.Point(0, 0));
  stencil.rotate(rotationDeg, new paper.Point(0, 0));
  stencil.position = new paper.Point(center.x, center.y);
  stencil.reorient(true, true);

  const matForWhimsy = material.clone({ insert: true }) as paper.PathItem;
  const matForRemain = material.clone({ insert: true }) as paper.PathItem;
  const stForWhimsy = stencil.clone({ insert: true }) as paper.Path;
  const stForRemain = stencil.clone({ insert: true }) as paper.Path;

  const whimsyRaw = matForWhimsy.intersect(stForWhimsy);
  const remainderRaw = matForRemain.subtract(stForRemain);

  material.remove();
  stencil.remove();

  if (!whimsyRaw) {
    if (remainderRaw) remainderRaw.remove();
    warnings.push('Whimsy does not overlap the selected piece; nothing added.');
    return { warnings, remainderClusters: [] };
  }

  let whimsyPaths = collectSurfacePaths(whimsyRaw);
  whimsyPaths = unitePaperPaths(whimsyPaths);

  if (whimsyPaths.length === 0) {
    if (remainderRaw) remainderRaw.remove();
    warnings.push('Whimsy does not overlap the selected piece; nothing added.');
    return { warnings, remainderClusters: [] };
  }

  const whimsyPath = whimsyPaths[0];
  const whimsyArea = Math.abs((whimsyPath as paper.Path).area);
  const minAllowed = Math.max(WHIMSY_MIN_AREA_ABS, materialArea * WHIMSY_MIN_FRAC_OF_MATERIAL);

  if (whimsyArea < minAllowed) {
    whimsyPath.remove();
    if (remainderRaw) remainderRaw.remove();
    warnings.push(
      `Whimsy overlap is too small (≈${Math.round(whimsyArea)} px², need ≥${Math.round(minAllowed)} px²). Increase scale or move center.`
    );
    return { warnings, remainderClusters: [] };
  }

  const remainderPaths = collectRemainderPathsFromSubtract(remainderRaw);

  remainderPaths.forEach((rp, idx) => {
    const a = absPathItemArea(rp);
    const thr = canvasArea * WHIMSY_WARN_REMAINDER_FRAC_OF_CANVAS;
    if (a > EPS_AREA && a < thr) {
      warnings.push(
        `Remainder region ${idx + 1} is very small (≈${Math.round(a)} px²); consider merging or resizing.`
      );
    }
  });

  const opShort = op.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'wh';
  const whimsyId = `${parentId}-whimsy-${opShort}`;
  const childIds: string[] = [];

  const whimsyBoundary = whimsyPath.pathData;
  const wSeed = pathCentroid(whimsyPath);
  whimsyPath.remove();

  areas[whimsyId] = {
    id: whimsyId,
    parentId,
    type: AreaType.WHIMSY,
    children: [],
    boundary: whimsyBoundary,
    seedPoint: wSeed,
    isPiece: true,
    color: '#a855f7',
  };
  childIds.push(whimsyId);

  const remainderIds: string[] = [];
  remainderPaths.forEach((rp, i) => {
    const rid = `${parentId}-rest-${i}-${opShort}`;
    remainderIds.push(rid);
    rp.reorient(true, true);
    areas[rid] = {
      id: rid,
      parentId,
      type: AreaType.SUBDIVISION,
      children: [],
      boundary: rp.pathData,
      seedPoint: pathCentroid(rp),
      isPiece: true,
      color: COLORS[(op.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + i) % COLORS.length],
    };
    rp.remove();
    childIds.push(rid);
  });

  areas[parentId!] = {
    ...parent,
    children: childIds,
    isPiece: false,
  };

  if (absorbedLeafIds?.length) {
    absorbedLeafIds.forEach(id => {
      if (id !== parentId) delete areas[id];
    });
  }

  return {
    warnings,
    remainderClusters: remainderIds.length ? [{ anchorRep: find(parentId!), remainderIds }] : [],
  };
}

/**
 * Applies ADD_WHIMSY: new whimsy = stencil ∩ (union of participating material); each merge-group cluster
 * gets remainder = material − stencil. Participating leaves are overlap seeds plus all leaves in the same
 * merge group (DSU). Legacy: if `parentId` is set, uses single-material cut only.
 */
export function applyAddWhimsyOp(
  areas: Record<string, Area>,
  op: Operation,
  width: number,
  height: number,
  find: (id: string) => string = id => id
): ApplyAddWhimsyResult {
  const warnings: string[] = [];
  if (op.type !== 'ADD_WHIMSY') return { warnings, remainderClusters: [] };

  const params = op.params as AddWhimsyParams;
  if (params.parentId) {
    return applyAddWhimsyOpLegacy(areas, op, width, height, params, find);
  }

  const { templateId, center, scale, rotationDeg } = params;
  const canvasArea = width * height;

  resetPaperProject(width, height);

  const stem = getWhimsyTemplatePathData(templateId);
  const stencil = new paper.Path(stem);
  stencil.closed = true;
  stencil.scale(scale, new paper.Point(0, 0));
  stencil.rotate(rotationDeg, new paper.Point(0, 0));
  stencil.position = new paper.Point(center.x, center.y);
  stencil.reorient(true, true);

  const leaves = (Object.values(areas) as Area[]).filter(a => a.isPiece);
  const participatingSeeds = leaves.filter(l => leafOverlapsStencil(l, stencil));
  const originalStencilOverlap = new Set(participatingSeeds.map(l => l.id));
  const participating = expandParticipatingByMergeGroup(leaves, participatingSeeds, find);

  if (participating.length === 0) {
    stencil.remove();
    warnings.push('Whimsy does not overlap any piece; nothing added.');
    return { warnings, remainderClusters: [] };
  }

  // Create the whimsy piece by intersecting the stencil with the union of ALL participating material.
  // This prevents internal edges (the "cross" inside a circle) when the whimsy spans multiple pieces.
  const totalMaterial = unionClusterBoundaries(participating);
  const stForWhimsy = stencil.clone({ insert: true }) as paper.Path;
  const whimsyRaw = totalMaterial.intersect(stForWhimsy);
  totalMaterial.remove();
  stForWhimsy.remove();

  if (!whimsyRaw || whimsyRaw.isEmpty()) {
    whimsyRaw?.remove();
    stencil.remove();
    warnings.push('Whimsy overlap was empty after boolean ops.');
    return { warnings, remainderClusters: [] };
  }

  let whimsyPaths = collectSurfacePaths(whimsyRaw);
  whimsyPaths = unitePaperPaths(whimsyPaths);
  const whimsyUnified = whimsyPaths[0];

  if (!whimsyUnified) {
    whimsyRaw.remove();
    stencil.remove();
    warnings.push('Whimsy overlap was empty after boolean ops.');
    return { warnings, remainderClusters: [] };
  }

  const whimsyArea = (whimsyUnified instanceof paper.CompoundPath)
    ? whimsyUnified.children.reduce((acc, ch) => acc + Math.abs((ch as paper.Path).area), 0)
    : Math.abs((whimsyUnified as paper.Path).area);
  const minAllowed = WHIMSY_MIN_AREA_ABS;
  if (whimsyArea < minAllowed) {
    whimsyUnified.remove();
    whimsyRaw.remove();
    stencil.remove();
    warnings.push(
      `Whimsy overlap is too small (≈${Math.round(whimsyArea)} px², need ≥${Math.round(minAllowed)} px²). Increase scale or move center.`
    );
    return { warnings, remainderClusters: [] };
  }

  const clusterMap = new Map<string, Area[]>();
  for (const leaf of participating) {
    const r = find(leaf.id);
    if (!clusterMap.has(r)) clusterMap.set(r, []);
    clusterMap.get(r)!.push(leaf);
  }
  const clusters = Array.from(clusterMap.values())
    .map(c => c.sort((a, b) => a.id.localeCompare(b.id)))
    .sort((a, b) => a[0].id.localeCompare(b[0].id));

  clusters.sort((a, b) => {
    const ao = a.some(l => originalStencilOverlap.has(l.id)) ? 1 : 0;
    const bo = b.some(l => originalStencilOverlap.has(l.id)) ? 1 : 0;
    return bo - ao;
  });

  const clusterAnchorReps = clusters.map(c => find(c[0].id));

  const remainderSpecs: { parentId: string; path: paper.PathItem; clusterIndex: number; originalType?: AreaType }[] = [];

  for (let ci = 0; ci < clusters.length; ci++) {
    const cluster = clusters[ci];
    const parentForRemainder = lowestCommonAncestor(areas, cluster.map(l => l.id));
    const originalType = cluster.length === 1 && cluster[0].type === AreaType.WHIMSY
      ? AreaType.WHIMSY
      : undefined;

    const mat =
      cluster.length === 1
        ? pathItemFromBoundaryData(cluster[0].boundary)
        : unionClusterBoundaries(cluster);
    const st2 = stencil.clone({ insert: true }) as paper.Path;
    const rRaw = mat.subtract(st2);
    mat.remove();
    st2.remove();

    const rPaths = collectRemainderPathsFromSubtract(rRaw);
    rPaths.forEach(rp => {
      remainderSpecs.push({ parentId: parentForRemainder, path: rp, clusterIndex: ci, originalType });
    });
  }

  stencil.remove();

  remainderSpecs.forEach((s, idx) => {
    const a = absPathItemArea(s.path);
    const thr = canvasArea * WHIMSY_WARN_REMAINDER_FRAC_OF_CANVAS;
    if (a > EPS_AREA && a < thr) {
      warnings.push(
        `Remainder region ${idx + 1} is very small (≈${Math.round(a)} px²); consider merging or resizing.`
      );
    }
  });

  const opShort = op.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'wh';
  const participatingIds = new Set(participating.map(p => p.id));
  const lcaId = lowestCommonAncestor(areas, participating.map(p => p.id));

  participatingIds.forEach(id => {
    if (id === lcaId) return;
    delete areas[id];
  });

  (Object.values(areas) as Area[]).forEach(a => {
    if (a.children?.length) {
      a.children = a.children.filter(cid => !participatingIds.has(cid));
    }
  });

  const whimsyId = `whimsy-${opShort}`;
  whimsyUnified.reorient(true, true);
  areas[whimsyId] = {
    id: whimsyId,
    parentId: lcaId,
    type: AreaType.WHIMSY,
    children: [],
    boundary: whimsyUnified.pathData,
    seedPoint: pathCentroid(whimsyUnified),
    isPiece: true,
    color: '#a855f7',
  };
  whimsyUnified.remove();

  const parentLca = areas[lcaId];
  if (parentLca) {
    parentLca.isPiece = false;
    parentLca.children = [...parentLca.children, whimsyId];
  }

  const remainderClusters: { anchorRep: string; remainderIds: string[] }[] = clusterAnchorReps.map(
    anchorRep => ({
      anchorRep,
      remainderIds: [] as string[],
    })
  );

  remainderSpecs.forEach((spec, i) => {
    const rid = `rest-${opShort}-${i}`;
    remainderClusters[spec.clusterIndex].remainderIds.push(rid);
    spec.path.reorient(true, true);
    areas[rid] = {
      id: rid,
      parentId: spec.parentId,
      type: spec.originalType ?? AreaType.SUBDIVISION,
      children: [],
      boundary: spec.path.pathData,
      seedPoint: pathCentroid(spec.path),
      isPiece: true,
      color: COLORS[(op.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + i) % COLORS.length],
    };
    spec.path.remove();
    const par = areas[spec.parentId];
    if (par) par.children = [...par.children, rid];
  });

  return { warnings, remainderClusters };
}
