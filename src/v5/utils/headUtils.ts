import paper from 'paper';
import { cleanPath } from './paperUtils';
import { mergePathsAtPoints } from './pathMergeUtils';

/**
 * Attaches a head to a neck.
 * Uses splicing (mergePathsAtPoints) for a clean join, 
 * but falls back to the head alone if the neck is swallowed.
 */
export function attachHead(
  neck: paper.Path,
  head: paper.PathItem,
  pt1Head: paper.Point,
  pt2Head: paper.Point,
  chordMidPoint: paper.Point,
  rayDir: paper.Point,
  p1: paper.Point,
  p2: paper.Point
): paper.PathItem {
  const neckClosed = neck.clone({ insert: false });
  neckClosed.closePath();

  // 1. Check if the neck is "swallowed" by the head.
  // We check if both base points (p1, p2) are inside the head.
  // If only one is inside, we still try to splice.
  const isSwallowed = head.contains(p1) && head.contains(p2);

  if (isSwallowed) {
    neckClosed.remove();
    const result = head.clone({ insert: false });
    result.reorient(true, true);
    return result;
  }

  // 2. Try to splice them for a clean geometric join
  try {
    // Ensure consistent winding for splicing
    neckClosed.reorient(true, true);
    head.reorient(true, true);

    const merged = mergePathsAtPoints(neckClosed, head, pt1Head, pt2Head);
    neckClosed.remove();
    
    const cleaned = cleanPath(merged);
    cleaned.reorient(true, true);
    return cleaned;
  } catch (e) {
    // Fallback to unite if splicing fails (e.g. complex self-intersections)
    const united = neckClosed.unite(head, { insert: false });
    neckClosed.remove();
    
    const cleaned = cleanPath(united);
    cleaned.reorient(true, true);
    return cleaned;
  }
}
