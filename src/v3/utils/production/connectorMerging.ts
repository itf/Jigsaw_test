import paper from 'paper';
import { Connector, Whimsy } from '../../types';
import { generateConnectorPath } from '../connectorUtils';
import { mergePathsAtPoints } from '../pathMergeUtils';
import { cleanPath } from '../paperUtils';

/**
 * Merges all connectors belonging to a piece into a target boundary.
 * Crucially, it pre-calculates all connector geometries using the ORIGINAL path
 * to avoid "t-shifting" issues, but applies the merge to the TARGET path
 * (which may already contain notches from other pieces).
 */
export function mergeAllConnectorsForPiece(
  targetPath: paper.PathItem,
  originalPath: paper.PathItem,
  pieceConnectors: Connector[],
  whimsies: Whimsy[],
  flattenTolerance?: number,
  useLegacyBooleanMerge?: boolean
): paper.PathItem {
  if (pieceConnectors.length === 0) return targetPath.clone({ insert: false });

  // 1. Pre-calculate all connector geometries using the ORIGINAL path for stable placement
  const calculated = pieceConnectors.map(c => {
    try {
      const result = generateConnectorPath(
        originalPath,
        c.pathIndex,
        c.midT,
        c.widthPx,
        c.extrusion,
        c.headTemplateId,
        c.headScale,
        c.headRotationDeg,
        c.useEquidistantHeadPoint,
        whimsies,
        c.jitter,
        c.jitterSeed || 0,
        c.neckShape,
        c.neckCurvature,
        c.extrusionCurvature
      );

      const connectorPath = new paper.CompoundPath({
        pathData: result.pathData,
        insert: false
      });

      if (flattenTolerance !== undefined) {
        connectorPath.flatten(flattenTolerance);
      }

      return {
        path: connectorPath,
        p1: result.p1,
        p2: result.p2,
        pathIndex: c.pathIndex
      };
    } catch (e) {
      console.error(`Error calculating connector ${c.id} for piece ${c.pieceId}:`, e);
      return null;
    }
  }).filter(c => c !== null) as { path: paper.PathItem, p1: paper.Point, p2: paper.Point, pathIndex: number }[];

  // 2. Iteratively merge the pre-calculated geometries into the target path.
  let currentPath = targetPath.clone({ insert: false });
  
  for (const c of calculated) {
    let nextPath: paper.PathItem;
    if (useLegacyBooleanMerge) {
      nextPath = currentPath.unite(c.path, { insert: false });
    } else {
      // Find the actual points on the current boundary to use as the merge basis.
      // We must ensure both p1 and p2 snap to the SAME sub-path to avoid 
      // "jumping" across split pieces or holes.
      const midPoint = c.p1.add(c.p2).divide(2);
      const locMid = currentPath.getNearestLocation(midPoint);
      if (!locMid) {
        // Fallback to original points if something is very wrong
        nextPath = mergePathsAtPoints(currentPath, c.path, c.p1, c.p2, c.pathIndex);
      } else {
        const targetSubPath = locMid.path as paper.Path;
        const loc1 = targetSubPath.getNearestLocation(c.p1);
        const loc2 = targetSubPath.getNearestLocation(c.p2);
        
        const p1 = loc1 ? loc1.point : c.p1;
        const p2 = loc2 ? loc2.point : c.p2;

        // Find the index of this sub-path in the currentPath
        let subPathIndex = c.pathIndex;
        if (currentPath instanceof paper.CompoundPath) {
          subPathIndex = currentPath.children.indexOf(targetSubPath);
        }

        nextPath = mergePathsAtPoints(
          currentPath,
          c.path,
          p1,
          p2,
          subPathIndex
        );
      }
    }
    currentPath.remove();
    currentPath = cleanPath(nextPath);
    c.path.remove();
  }

  // Final cleanup to ensure no tiny artifacts remain from the sequence of merges
  const finalPath = cleanPath(currentPath);
  if (finalPath !== currentPath) {
    currentPath.remove();
  }

  return finalPath;
}
