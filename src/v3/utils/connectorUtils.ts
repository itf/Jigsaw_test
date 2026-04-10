import paper from 'paper';
import { Area, AreaType, Connector, Whimsy, NeckShape } from '../types';
import { generateNeck } from './neckUtils';
import { attachHead } from './headUtils';

/** Simple seeded pseudo-random number generator (mulberry32). Returns values in [0, 1). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Finds the point on a path that is closest to a line defined by a start point and a direction normal.
 * 
 * Algorithm:
 * Reuses the "closest to point" logic (getNearestPoint) by projecting a search point 
 * far along the normal. This finds the point on the path that is most "in front" 
 * of the starting point in the given direction.
 */
function getClosestPointOnPathToLine(
  path: paper.PathItem, 
  lineStart: paper.Point, 
  lineNormal: paper.Point
): paper.Point {
  // 1. Try ray intersection first (most accurate for "parallel" neck sides)
  // This ensures the neck follows the exact direction of the normal from the base points.
  const farPoint = lineStart.add(lineNormal.multiply(2000));
  const ray = new paper.Path.Line(lineStart, farPoint);
  const intersections = path.getIntersections(ray);

  if (intersections.length > 0) {
    // Sort by distance from lineStart and pick the closest one
    intersections.sort((a, b) => 
      lineStart.getDistance(a.point) - lineStart.getDistance(b.point)
    );
    const result = intersections[0].point;
    ray.remove();
    return result;
  }

  // 2. Fallback: If ray misses, find the point on the path that is closest to the infinite line.
  // We use the ray itself to find the nearest point on the path to that line.
  // Since paper.js getNearestPoint only takes a point, we find the point on the line
  // that is closest to the path's center, and then find the nearest point on the path to that.
  const nearestOnRay = ray.getNearestPoint(path.bounds.center);
  const result = path.getNearestPoint(nearestOnRay);
  ray.remove();
  return result;
}

/**
 * Finds a neighbor piece by sampling a point slightly outside the current piece's boundary.
 */
export function findNeighborPiece(
  areas: Record<string, Area>,
  currentPieceId: string,
  point: paper.Point,
  normal: paper.Point
): string | null {
  if (!point || !normal) return null;
  // Offset slightly along the normal to "look" into the neighbor
  const testPoint = point.add(normal.multiply(0.5));
  
  for (const id in areas) {
    if (id === currentPieceId) continue;
    const area = areas[id];
    if (area.type === AreaType.PIECE) {
      if (area.boundary.bounds.contains(testPoint) && area.boundary.contains(testPoint)) {
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
  useEquidistantHeadPoint: boolean = true,
  whimsies: Whimsy[] = [],
  jitter: number = 0,
  jitterSeed: number = 0,
  neckShape: NeckShape = NeckShape.STANDARD,
  neckCurvature: number = 0,
  extrusionCurvature: number = 0
): { pathData: string, basePathData: string, headCenter: paper.Point, p1: paper.Point, p2: paper.Point } {
  const children = boundary instanceof paper.CompoundPath 
    ? (boundary.children.filter(c => c instanceof paper.Path) as paper.Path[])
    : [boundary as paper.Path];
  
  const idx = Math.max(0, Math.min(pathIndex, children.length - 1));
  const sourcePath = children[idx];
  
  // 1. Calculate piece boundary points
  const halfWidthT = (widthPx / 2) / sourcePath.length;
  const t1 = midT - halfWidthT;
  const t2 = midT + halfWidthT;
  
  const getWrappedPoint = (t: number) => {
    const wrappedT = (t + 100) % 1; // Handle negative t
    return sourcePath.getPointAt(sourcePath.length * wrappedT);
  };
  const getWrappedNormal = (t: number) => {
    const wrappedT = (t + 100) % 1;
    return sourcePath.getNormalAt(sourcePath.length * wrappedT);
  };

  let p1 = getWrappedPoint(t1);
  let p2 = getWrappedPoint(t2);
  let currentT1 = t1;
  let currentT2 = t2;
  const n1 = getWrappedNormal(t1);
  const n2 = getWrappedNormal(t2);
  
  if (!p1 || !p2 || !n1 || !n2) {
    // Fallback if points can't be found
    const zero = new paper.Point(0, 0);
    return { pathData: '', basePathData: '', headCenter: zero, p1: zero, p2: zero };
  }
  
  // 2. Calculate extrusion direction (normal to chord p1-p2)
  const chord = p2.subtract(p1); // Points from p1 to p2. If chordNormal is UP, chord is LEFT.
  const chordMidPoint = p1.add(p2).divide(2);
  const midPoint = sourcePath.getPointAt(sourcePath.length * midT);
  const midNormal = sourcePath.getNormalAt(sourcePath.length * midT);
  
  if (!midPoint || !midNormal) {
    const zero = new paper.Point(0, 0);
    return { pathData: '', basePathData: '', headCenter: zero, p1: zero, p2: zero };
  }
  
  // We want the normal to the chord that points in the same general direction as the boundary normal
  let chordNormal = new paper.Point(-chord.y, chord.x).normalize();
  if (chordNormal.dot(midNormal) < 0) {
    chordNormal = chordNormal.multiply(-1);
  }

  // Support curved extrusion
  const extrusionTangent = new paper.Point(-chordNormal.y, chordNormal.x);
  const headCenter = midPoint
    .add(chordNormal.multiply(extrusion))
    .add(extrusionTangent.multiply(extrusion * extrusionCurvature));
  
  let head: paper.PathItem;
  const whimsy = whimsies.find(w => w.id === headTemplateId);

  if (whimsy) {
    head = new paper.CompoundPath({
      pathData: whimsy.svgData,
      insert: false
    });
    // Whimsies are normalized to radius 1 (approx 2x2 box)
    // We want them to be roughly 24px wide at scale 1.0
    head.scale(12 * headScale, new paper.Point(0, 0));
    const hb = head.bounds;
    head.translate(new paper.Point(
      headCenter.x - (hb.x + hb.width / 2),
      headCenter.y - (hb.y + hb.height / 2)
    ));
  } else {
    // Fallback for legacy templates
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
  }

  // Rotate head to align with the local normal at the midPoint
  const baseRotation = midNormal.angle + 90;
  head.rotate(baseRotation + headRotationDeg, headCenter);
  
  // 3. Apply jitter to head before calculating contact points
  if (jitter > 0) {
    const rng = makeRng(jitterSeed);
    const applyJitter = (path: paper.Path) => {
      path.segments.forEach(seg => {
        seg.point = seg.point.add(new paper.Point(
          (rng() - 0.5) * jitter,
          (rng() - 0.5) * jitter
        ));
      });
    };
    if (head instanceof paper.Path) {
      applyJitter(head);
    } else if (head instanceof paper.CompoundPath) {
      head.children.forEach(child => {
        if (child instanceof paper.Path) applyJitter(child);
      });
    }
  }

  // 4. Find contact points on head
  let pt1Head: paper.Point;
  let pt2Head: paper.Point;

  // Use the chord normal (perpendicular to the p1-p2 chord) as the ray direction.
  // This keeps the neck sides parallel regardless of boundary curvature or corners.
  // chordNormal already points outward (same side as midNormal) from the computation above.
  let rayDir = chordNormal;

  // Handle partial overlap by extending p1/p2 if one is inside the head
  const p1Inside = head.contains(p1);
  const p2Inside = head.contains(p2);

  if (p1Inside && !p2Inside) {
    // p1 is inside, p2 is outside.
    // Find intersections between sourcePath and head to stay on the curved boundary
    const intersections = sourcePath.getIntersections(head);
    if (intersections.length > 0) {
      // Find the intersection whose offset is closest to the original t1
      const t1Offset = t1 * sourcePath.length;
      intersections.sort((a, b) => {
        const d1 = Math.min(Math.abs(a.offset - t1Offset), sourcePath.length - Math.abs(a.offset - t1Offset));
        const d2 = Math.min(Math.abs(b.offset - t1Offset), sourcePath.length - Math.abs(b.offset - t1Offset));
        return d1 - d2;
      });
      p1 = intersections[0].point;
      currentT1 = intersections[0].offset / sourcePath.length;
    }
  } else if (p2Inside && !p1Inside) {
    // p2 is inside, p1 is outside.
    const intersections = sourcePath.getIntersections(head);
    if (intersections.length > 0) {
      // Find the intersection whose offset is closest to the original t2
      const t2Offset = t2 * sourcePath.length;
      intersections.sort((a, b) => {
        const d1 = Math.min(Math.abs(a.offset - t2Offset), sourcePath.length - Math.abs(a.offset - t2Offset));
        const d2 = Math.min(Math.abs(b.offset - t2Offset), sourcePath.length - Math.abs(b.offset - t2Offset));
        return d1 - d2;
      });
      p2 = intersections[0].point;
      currentT2 = intersections[0].offset / sourcePath.length;
    }
  }

  // If extrusion is curved, we adjust the ray direction to point towards the head center
  if (extrusionCurvature !== 0) {
    const newChordMidPoint = p1.add(p2).divide(2);
    rayDir = headCenter.subtract(newChordMidPoint).normalize();
  }

  if (useEquidistantHeadPoint) {
    // New algorithm: Use ray intersection to find where the parallel sides of the neck
    // hit the head. This ensures the neck follows the normal direction exactly.
    pt1Head = getClosestPointOnPathToLine(head, p1, rayDir);
    pt2Head = getClosestPointOnPathToLine(head, p2, rayDir);
  } else {
    // Legacy/Fallback: We want the neck width on the head to be similar to widthPx
    const headPath = (head instanceof paper.CompoundPath ? head.children[0] : head) as paper.Path;
    let hMidOffset: number;
    hMidOffset = headPath.getNearestLocation(midPoint).offset;
    
    const hOffset1 = (hMidOffset - widthPx / 2 + headPath.length) % headPath.length;
    const hOffset2 = (hMidOffset + widthPx / 2) % headPath.length;
    
    pt1Head = headPath.getPointAt(hOffset1);
    pt2Head = headPath.getPointAt(hOffset2);

    // Ensure pt1Head is the one closer to p1 and pt2Head is closer to p2
    // to prevent the neck sides from crossing.
    const distNormal = p1.getDistance(pt1Head) + p2.getDistance(pt2Head);
    const distSwapped = p1.getDistance(pt2Head) + p2.getDistance(pt1Head);
    if (distSwapped < distNormal) {
      const temp = pt1Head;
      pt1Head = pt2Head;
      pt2Head = temp;
    }
  }
  
  // 5. Construct neck
  const { neck: robustNeck, basePath } = generateNeck(
    p1, p2, pt1Head, pt2Head,
    neckShape, neckCurvature, widthPx,
    currentT1, currentT2, sourcePath,
    rayDir
  );

  // 6. Attach head
  const combined = attachHead(robustNeck, head, pt1Head, pt2Head, chordMidPoint, rayDir, p1, p2);

  const pathData = combined.pathData;
  const basePathData = basePath.pathData;

  // Cleanup
  robustNeck.remove();
  head.remove();
  combined.remove();
  basePath.remove();

  return { pathData, basePathData, headCenter, p1, p2 };
}
