import paper from 'paper';
import { Area, AreaType, Connector } from '../types';

/**
 * Finds a neighbor piece by sampling a point slightly outside the current piece's boundary.
 */
export function findNeighborPiece(
  areas: Record<string, Area>,
  currentPieceId: string,
  point: paper.Point,
  normal: paper.Point
): string | null {
  // Offset slightly along the normal to "look" into the neighbor
  const testPoint = point.add(normal.multiply(0.5));
  
  for (const id in areas) {
    if (id === currentPieceId) continue;
    const area = areas[id];
    if (area.type === AreaType.PIECE) {
      if (area.boundary.contains(testPoint)) {
        return id;
      }
    }
  }
  return null;
}

/**
 * Generates a connector path based on piece boundary and parameters.
 */
export function generateConnectorPath(
  boundary: paper.PathItem,
  pathIndex: number,
  midT: number,
  widthPx: number,
  extrusion: number,
  headTemplateId: string,
  headScale: number,
  headRotationDeg: number,
  headOffset: number,
  useEquidistantHeadPoint: boolean = true
): { path: paper.PathItem, basePathData: string, headCenter: paper.Point } {
  const children = boundary instanceof paper.CompoundPath 
    ? (boundary.children.filter(c => c instanceof paper.Path) as paper.Path[])
    : [boundary as paper.Path];
  
  const idx = Math.max(0, Math.min(pathIndex, children.length - 1));
  const sourcePath = children[idx];
  
  // 1. Calculate piece boundary points
  const halfWidthT = (widthPx / 2) / sourcePath.length;
  const t1 = midT - halfWidthT;
  const t2 = midT + halfWidthT;
  
  const p1 = sourcePath.getPointAt(sourcePath.length * Math.max(0, Math.min(1, t1)));
  const p2 = sourcePath.getPointAt(sourcePath.length * Math.max(0, Math.min(1, t2)));
  
  // 2. Calculate extrusion direction (normal to chord p1-p2)
  const chord = p2.subtract(p1); // Points from p1 to p2. If chordNormal is UP, chord is LEFT.
  const chordMidPoint = p1.add(p2).divide(2);
  const midPoint = sourcePath.getPointAt(sourcePath.length * midT);
  const midNormal = sourcePath.getNormalAt(sourcePath.length * midT);
  
  // We want the normal to the chord that points in the same general direction as the boundary normal
  let chordNormal = new paper.Point(-chord.y, chord.x).normalize();
  if (chordNormal.dot(midNormal) < 0) {
    chordNormal = chordNormal.multiply(-1);
  }
  
  const headCenter = midPoint.add(chordNormal.multiply(extrusion + headOffset));
  
  let head: paper.PathItem;
  if (headTemplateId === 'star') {
    head = new paper.Path.Star({
      center: headCenter,
      points: 5,
      radius1: 15 * headScale,
      radius2: 7 * headScale,
      insert: false
    });
  } else if (headTemplateId === 'square') {
    head = new paper.Path.Rectangle({
      center: headCenter,
      size: [20 * headScale, 20 * headScale],
      insert: false
    });
  } else if (headTemplateId === 'triangle') {
    head = new paper.Path.RegularPolygon({
      center: headCenter,
      sides: 3,
      radius: 15 * headScale,
      insert: false
    });
  } else {
    head = new paper.Path.Circle({
      center: headCenter,
      radius: 12 * headScale,
      insert: false
    });
  }

  // Rotate head to align with chordNormal (neck direction)
  // Standard "up" for these shapes is (0, -1), which is -90 degrees.
  const baseRotation = chordNormal.angle + 90;
  head.rotate(baseRotation + headRotationDeg, headCenter);
  
  // 3. Find contact points on head
  const headPath = (head instanceof paper.CompoundPath ? head.children[0] : head) as paper.Path;
  
  let hMidOffset: number;
  if (useEquidistantHeadPoint) {
    // Find intersection of normal ray from chordMidPoint with head boundary
    const rayLine = new paper.Path.Line(chordMidPoint, chordMidPoint.add(chordNormal.multiply(2000)));
    const intersections = headPath.getIntersections(rayLine);
    rayLine.remove();
    
    if (intersections.length > 0) {
      // Sort by distance from chordMidPoint
      intersections.sort((a, b) => a.point.getDistance(chordMidPoint) - b.point.getDistance(chordMidPoint));
      hMidOffset = headPath.getOffsetOf(intersections[0].point);
    } else {
      hMidOffset = headPath.getNearestLocation(midPoint).offset;
    }
  } else {
    hMidOffset = headPath.getNearestLocation(midPoint).offset;
  }
  
  // We want the neck width on the head to be similar to widthPx
  const hOffset1 = (hMidOffset - widthPx / 2 + headPath.length) % headPath.length;
  const hOffset2 = (hMidOffset + widthPx / 2) % headPath.length;
  
  const pt1Head = headPath.getPointAt(hOffset1);
  const pt2Head = headPath.getPointAt(hOffset2);
  
  // Identify which head point is "left" (towards p2) and which is "right" (towards p1)
  // chord points from p1 (right) to p2 (left).
  const isPt1Left = pt1Head.subtract(headCenter).dot(chord) > pt2Head.subtract(headCenter).dot(chord);
  
  const leftHeadPt = isPt1Left ? pt1Head : pt2Head;
  const rightHeadPt = isPt1Left ? pt2Head : pt1Head;
  const leftHeadOffset = isPt1Left ? hOffset1 : hOffset2;
  const rightHeadOffset = isPt1Left ? hOffset2 : hOffset1;

  // 4. Construct neck
  const neck = new paper.Path({ insert: false });
  
  // Bottom edge (along piece boundary from p1 to p2)
  const steps = 12;
  const baseOnly = new paper.Path({ insert: false });
  for (let i = 0; i <= steps; i++) {
    const t = t1 + (t2 - t1) * (i / steps);
    const pt = sourcePath.getPointAt(sourcePath.length * Math.max(0, Math.min(1, t)));
    neck.add(pt);
    baseOnly.add(pt);
  }
  const basePathData = baseOnly.pathData;
  baseOnly.remove();
  
  // Side edge 1: p2 (left) to leftHeadPt
  neck.add(leftHeadPt);
  
  // Top edge (along head boundary, from leftHeadPt to rightHeadPt)
  let diff = rightHeadOffset - leftHeadOffset;
  if (Math.abs(diff) > headPath.length / 2) {
    diff = diff > 0 ? diff - headPath.length : diff + headPath.length;
  }
  
  for (let i = 1; i < steps; i++) {
    const offset = leftHeadOffset + diff * (i / steps);
    let wrappedOffset = offset % headPath.length;
    if (wrappedOffset < 0) wrappedOffset += headPath.length;
    neck.add(headPath.getPointAt(wrappedOffset));
  }
  
  // Side edge 2: rightHeadPt to p1 (handled by closing the path)
  neck.add(rightHeadPt);
  neck.closed = true;
  
  // 5. Combine
  const combined = neck.unite(head);
  combined.remove();
  
  neck.remove();
  head.remove();
  
  return { path: combined, basePathData, headCenter };
}
