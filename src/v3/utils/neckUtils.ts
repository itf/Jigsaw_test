import paper from 'paper';
import { NeckShape } from '../types';

/**
 * Extracts the exact Bezier segment of a path between two offsets.
 */
function getExactSegment(path: paper.Path, offset1: number, offset2: number, reverse: boolean = false): paper.Path {
  const len = path.length;
  const o1 = (offset1 + len * 2) % len;
  const o2 = (offset2 + len * 2) % len;

  const clone = path.clone({ insert: false });
  if (clone.closed) {
    // Opening a closed path at o1 makes it an open path starting/ending at o1
    clone.splitAt(o1);
  } else {
    // For open paths, we might need to handle wrapping manually or just split
    // But piece/head boundaries are usually closed.
  }

  // Now the path starts at o1. Find the new relative offset for o2.
  let newO2 = (o2 - o1 + len) % len;
  if (newO2 === 0 && offset1 !== offset2) newO2 = len;

  const secondPart = clone.splitAt(newO2);
  if (secondPart) secondPart.remove();
  
  if (reverse) clone.reverse();
  return clone;
}

/**
 * Generates a neck path and a cleaning polygon based on the 4 contact points.
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
  head: paper.PathItem,
  chordMidPoint: paper.Point,
  rayDir: paper.Point
): { neck: paper.PathItem, basePathData: string } {
  const neck = new paper.Path({ insert: false });
  
  // A. Bottom edge: Exact segment from piece boundary
  const pieceLen = sourcePath.length;
  const pieceSegment = getExactSegment(sourcePath, t1 * pieceLen, t2 * pieceLen);
  const basePathData = pieceSegment.pathData;
  
  // Push into piece for robustness (Commented out for testing)
  // pieceSegment.translate(rayDir.multiply(-1));
  
  // Add piece segment to neck
  neck.addSegments(pieceSegment.segments);
  pieceSegment.remove();

  const curveDir = p2.subtract(p1).normalize();

  // B. Side 1: p2 to pt2Head
  // addNeckSide(neck, p2.subtract(rayDir), pt2Head.add(rayDir), p1, neckShape, neckCurvature, widthPx, curveDir);
  addNeckSide(neck, p2, pt2Head, p1, neckShape, neckCurvature, widthPx, curveDir);
  
  // C. Top edge: Exact segment from head boundary
  const headPath = (head instanceof paper.CompoundPath ? head.children[0] : head) as paper.Path;
  if (headPath && headPath.length > 0) {
    const loc1 = headPath.getNearestLocation(pt1Head);
    const loc2 = headPath.getNearestLocation(pt2Head);
    const offset1 = loc1.offset;
    const offset2 = loc2.offset;
    const hLen = headPath.length;

    let distCW = offset1 - offset2;
    if (distCW < 0) distCW += hLen;
    let distCCW = distCW - hLen;

    const midCW = headPath.getPointAt((offset2 + distCW / 2) % hLen);
    const midCCW = headPath.getPointAt((offset2 + distCCW / 2 + hLen) % hLen);

    const useCW = midCW.getDistance(chordMidPoint) < midCCW.getDistance(chordMidPoint);
    
    // Extract exact segment
    const headSegment = useCW 
      ? getExactSegment(headPath, offset2, offset1, false)
      : getExactSegment(headPath, offset1, offset2, true);
    
    // Push into head for robustness (Commented out for testing)
    // headSegment.translate(rayDir.multiply(1));
    
    neck.join(headSegment);
  } else {
    // neck.add(pt1Head.add(rayDir));
    neck.add(pt1Head);
  }

  // D. Side 2: pt1Head to p1
  // addNeckSide(neck, pt1Head.add(rayDir), p1.subtract(rayDir), p2, neckShape, neckCurvature, widthPx, curveDir);
  addNeckSide(neck, pt1Head, p1, p2, neckShape, neckCurvature, widthPx, curveDir);

  neck.closed = true;

  // 6. Cleaning polygon (using the same logic)
  const cleaningPoly = new paper.Path({ insert: false });
  // cleaningPoly.add(p1.subtract(rayDir));
  // cleaningPoly.lineTo(p2.subtract(rayDir));
  // addNeckSide(cleaningPoly, p2.subtract(rayDir), pt2Head.add(rayDir), p1, neckShape, neckCurvature, widthPx, curveDir);
  // cleaningPoly.lineTo(pt1Head.add(rayDir));
  // addNeckSide(cleaningPoly, pt1Head.add(rayDir), p1.subtract(rayDir), p2, neckShape, neckCurvature, widthPx, curveDir);
  
  cleaningPoly.add(p1);
  cleaningPoly.lineTo(p2);
  addNeckSide(cleaningPoly, p2, pt2Head, p1, neckShape, neckCurvature, widthPx, curveDir);
  cleaningPoly.lineTo(pt1Head);
  addNeckSide(cleaningPoly, pt1Head, p1, p2, neckShape, neckCurvature, widthPx, curveDir);
  cleaningPoly.closed = true;
  
  const robustNeck = neck.unite(cleaningPoly);
  neck.remove();
  cleaningPoly.remove();

  return { neck: robustNeck, basePathData };
}

function addNeckSide(
  path: paper.Path,
  start: paper.Point,
  end: paper.Point,
  oppositeBase: paper.Point,
  shape: NeckShape,
  curvature: number,
  widthPx: number,
  curveDir: paper.Point
) {
  if (shape === NeckShape.STANDARD) {
    path.lineTo(end);
  } else if (shape === NeckShape.TAPERED) {
    const mid = start.add(end).divide(2);
    // For tapered, we bow inward towards the center of the neck.
    // Side 1 (p2 to pt2Head) bows towards p1.
    // Side 2 (pt1Head to p1) bows towards p2.
    const inwardNormal = oppositeBase.subtract(start).normalize();
    const control = mid.add(inwardNormal.multiply(widthPx * 0.25));
    path.quadraticCurveTo(control, end);
  } else if (shape === NeckShape.CURVED) {
    const mid = start.add(end).divide(2);
    // Both sides curve in the same direction (curveDir = p2 - p1)
    const control = mid.add(curveDir.multiply(widthPx * 0.5 * curvature));
    path.quadraticCurveTo(control, end);
  }
}
