import paper from 'paper';
import { NeckShape } from '../types';
import { getExactSegment } from './pathMergeUtils';

/**
 * Generates a neck path based on the 4 contact points.
 */
export function generateNeck(
  p1: paper.Point,
  p2: paper.Point,
  pt1Head: paper.Point,
  pt2Head: paper.Point,
  neckShape: NeckShape,
  neckCurvature: number,
  widthPx: number,
  t1: number,
  t2: number,
  sourcePath: paper.Path,
  rayDir: paper.Point
): { neck: paper.Path, basePath: paper.Path } {
  const neck = new paper.Path({ insert: false });

  // A. Bottom edge: Exact segment from piece boundary
  const pieceLen = sourcePath.length;
  const pieceSegment = getExactSegment(sourcePath, t1 * pieceLen, t2 * pieceLen);

  // B. Side 2: pt1Head to p1 (Left side when looking from base to head)
  neck.add(pt1Head);
  // The inward direction for Side 2 is perpendicular to rayDir (pointing right)
  const inwardDir2 = new paper.Point(rayDir.y, -rayDir.x);
  addNeckSide(neck, pt1Head, p1, neckShape, neckCurvature, widthPx, inwardDir2);

  // C. Bottom: p1 to p2
  // Zero out endpoint handles so adjacent neck sides are not curved by
  // bezier handles inherited from the piece boundary at p1 and p2.
  if (pieceSegment.segments.length > 0) {
    pieceSegment.firstSegment.handleIn = new paper.Point(0, 0);
    pieceSegment.lastSegment.handleOut = new paper.Point(0, 0);
  }
  // Clone after handle modification so basePath matches exactly what joins the neck
  const basePath = pieceSegment.clone({ insert: false }) as paper.Path;
  neck.join(pieceSegment);

  // D. Side 1: p2 to pt2Head (Right side when looking from base to head)
  // The inward direction for Side 1 is the opposite (pointing left)
  const inwardDir1 = new paper.Point(-rayDir.y, rayDir.x);
  addNeckSide(neck, p2, pt2Head, neckShape, neckCurvature, widthPx, inwardDir1);

  // Return open path pt1Head -> ... -> pt2Head
  return { neck, basePath };
}

function addNeckSide(
  path: paper.Path,
  start: paper.Point,
  end: paper.Point,
  shape: NeckShape,
  curvature: number,
  widthPx: number,
  inwardDir: paper.Point
) {
  if (shape === NeckShape.STANDARD) {
    path.lineTo(end);
  } else if (shape === NeckShape.TAPERED) {
    const mid = start.add(end).divide(2);
    // Bow inward towards the center of the neck.
    const control = mid.add(inwardDir.multiply(widthPx * 0.25));
    path.quadraticCurveTo(control, end);
  } else if (shape === NeckShape.CURVED) {
    const mid = start.add(end).divide(2);
    // Both sides curve in the same direction (inwardDir for Side 1 is outward for Side 2)
    // We use inwardDir as a reference.
    path.quadraticCurveTo(mid.add(inwardDir.multiply(widthPx * 0.5 * curvature)), end);
  }
}
