import paper from 'paper';

/**
 * Extracts the exact Bezier segment of a path between two offsets.
 */
export function getExactSegment(path: paper.Path, offset1: number, offset2: number, reverse: boolean = false): paper.Path {
  const len = path.length;
  if (len === 0) return path.clone({ insert: false });

  const o1 = ((offset1 % len) + len) % len;
  const o2 = ((offset2 % len) + len) % len;

  const clone = path.clone({ insert: false });
  
  if (clone.closed) {
    clone.splitAt(o1);
  }

  let newO2 = (o2 - o1 + len) % len;
  // If offsets were different but wrapped to the same value, we want the full loop
  if (Math.abs(newO2) < 0.00001 && Math.abs(offset1 - offset2) > 0.00001) {
    newO2 = len;
  }

  if (newO2 > 0 && newO2 < len - 0.001) {
    const secondPart = clone.splitAt(newO2);
    if (secondPart) secondPart.remove();
  }
  
  if (reverse) clone.reverse();
  return clone;
}

/**
 * Merges a subPath (connector) into a mainPath (piece) by splicing them at p1 and p2.
 * This avoids floating point errors and "leftover edges" from boolean unite.
 * 
 * Assumes:
 * - mainPath is closed.
 * - subPath is closed.
 * - p1 and p2 are points that exist on both boundaries (or very close).
 */
export function mergePathsAtPoints(
  mainPath: paper.PathItem,
  subPath: paper.PathItem,
  p1: paper.Point,
  p2: paper.Point,
  mainPathIndex?: number
): paper.PathItem {
  // 1. Clone the main path to avoid side effects
  const resultPath = mainPath.clone({ insert: false });
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[mergePathsAtPoints] Piece: ${mainPath.name || 'unnamed'}, Sub-paths: ${resultPath instanceof paper.CompoundPath ? resultPath.children.length : 1}, Target Index: ${mainPathIndex}`);
  }

  // 2. Identify the specific sub-path to merge into
  let main: paper.Path;
  if (resultPath instanceof paper.CompoundPath) {
    const children = resultPath.children;
    let idx = -1;
    if (mainPathIndex !== undefined) {
      idx = Math.max(0, Math.min(mainPathIndex, children.length - 1));
    } else {
      const loc = resultPath.getNearestLocation(p1);
      if (!loc) return resultPath;
      idx = children.indexOf(loc.path);
    }
    if (idx === -1 || !(children[idx] instanceof paper.Path)) {
      // Fallback: find closest path if index is invalid or not a path
      const loc = resultPath.getNearestLocation(p1);
      if (!loc) return resultPath;
      main = loc.path as paper.Path;
    } else {
      main = children[idx] as paper.Path;
    }
  } else {
    main = resultPath as paper.Path;
  }

  // 3. Prepare the sub-path (connector)
  const locSub = subPath.getNearestLocation(p1);
  if (!locSub) return resultPath;
  const subOriginal = locSub.path as paper.Path;
  const sub = subOriginal.clone({ insert: false }) as paper.Path;

  const wasClockwise = main.clockwise;

  // 4. Ensure consistent winding (CW) before splicing.
  // We always work in CW space for the splicing logic, but we must account for
  // the original winding when choosing which arc to keep from main.
  // If main was CCW (a hole), reversing it to CW swaps which arc is "p2→p1 the long way".
  // We compensate by swapping the extraction order for main when it was CCW.
  main.reorient(true, true);
  sub.reorient(true, true);

  // 5. Find offsets on both paths
  const loc1Main = main.getNearestLocation(p1);
  const loc2Main = main.getNearestLocation(p2);
  const loc1Sub = sub.getNearestLocation(p1);
  const loc2Sub = sub.getNearestLocation(p2);

  if (!loc1Main || !loc2Main || !loc1Sub || !loc2Sub) {
    sub.remove();
    return resultPath;
  }

  // 6. Extract segments and join
  // For a CW main path: keep the segment from p2 back to p1 (CW traversal = "keep most of boundary")
  // For a CCW main path that was forced to CW: the traversal direction is reversed, so to keep
  // the majority of the original boundary we must extract p1 to p2 instead (then reverse it).
  let mainSegment: paper.Path;
  if (wasClockwise) {
    // CW: keep p2 → p1 (the "long way" around in CW direction)
    mainSegment = getExactSegment(main, loc2Main.offset, loc1Main.offset);
  } else {
    // Was CCW (hole): after forcing to CW, the long arc from p2→p1 (original CCW)
    // is now the short arc p1→p2 in CW space. Extract p1→p2 then reverse to get CCW.
    mainSegment = getExactSegment(main, loc1Main.offset, loc2Main.offset, true);
  }
  // Sub: segment from p1 to p2 CW (the connector outline from p1 to p2)
  const subSegment = getExactSegment(sub, loc1Sub.offset, loc2Sub.offset);

  // Ensure the endpoints match exactly to avoid tiny gaps or overlaps
  if (mainSegment.lastSegment && subSegment.firstSegment) {
    subSegment.firstSegment.point = mainSegment.lastSegment.point.clone();
  }
  if (mainSegment.firstSegment && subSegment.lastSegment) {
    subSegment.lastSegment.point = mainSegment.firstSegment.point.clone();
  }

  let merged: paper.PathItem = mainSegment;
  (merged as paper.Path).join(subSegment);
  (merged as paper.Path).closed = true;
  
  // Clean up redundant segments and handles that can cause resolveCrossings to fail or create debris
  try {
    (merged as any).reduce();
  } catch (e) {
    // Ignore reduce errors
  }
  
  subSegment.remove();
  sub.remove();

  // 7. Restore original winding
  if (!wasClockwise) {
    (merged as paper.Path).reverse();
  }

  // 8. Clean up the spliced path
  try {
    const resolved = (merged as any).resolveCrossings();
    if (resolved) {
      if (resolved instanceof paper.CompoundPath) {
        // If resolveCrossings returned multiple paths, filter out degenerate or tiny debris paths
        const validChildren = resolved.children.filter(c => {
          if (!(c instanceof paper.Path)) {
            c.remove();
            return false;
          }
          const p = c as paper.Path;
          // Debris usually has very small length or area
          const hasLength = p.length > 1.0;
          const hasArea = Math.abs(p.area) > 0.5;
          if (hasLength && hasArea) return true;
          
          c.remove();
          return false;
        }) as paper.Path[];

        if (validChildren.length === 1) {
          const first = validChildren[0];
          merged.remove();
          merged = first;
        } else if (validChildren.length > 1) {
          // If we have multiple "valid" paths, the one with the largest area is 
          // almost certainly the intended boundary.
          validChildren.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
          const best = validChildren[0];
          // Remove the others (debris that passed the initial filter)
          for (let i = 1; i < validChildren.length; i++) {
            validChildren[i].remove();
          }
          merged.remove();
          merged = best;
        } else {
          // All children were degenerate? Keep original merged but it might be broken
          resolved.remove();
        }
      } else if (resolved !== merged) {
        const old = merged;
        merged = resolved;
        old.remove();
      }
    }
  } catch (e) {
    // Ignore resolveCrossings errors
  }

  // 9. Replace the original sub-path with the merged result
  if (resultPath instanceof paper.CompoundPath) {
    // Ensure we don't nest CompoundPaths. Children of CompoundPath should be Paths.
    const mergedPaths: paper.Path[] = [];
    if (merged instanceof paper.CompoundPath) {
      mergedPaths.push(...(merged.children.filter(c => c instanceof paper.Path) as paper.Path[]));
    } else {
      mergedPaths.push(merged as paper.Path);
    }

    if (mergedPaths.length > 0) {
      // Replace the original sub-path with the first merged path
      // We use the original child index to ensure we don't shift things if possible
      const children = resultPath.children;
      const childIdx = children.indexOf(main);
      
      if (childIdx !== -1) {
        main.replaceWith(mergedPaths[0]);
        // Restore original winding: holes must remain CCW for even-odd fill to work
        if (mergedPaths[0] instanceof paper.Path) {
          mergedPaths[0].clockwise = wasClockwise;
        }
        // Add any additional paths resulting from the merge (e.g. if a hole was split)
        // We insert them immediately after the first one to keep related paths together
        for (let i = 1; i < mergedPaths.length; i++) {
          resultPath.insertChild(childIdx + i, mergedPaths[i]);
        }
      } else {
        // Fallback if replaceWith failed for some reason
        resultPath.addChild(mergedPaths[0]);
      }
    }

    // Also add any other sub-paths from the connector (e.g. holes in a whimsy head)
    if (subPath instanceof paper.CompoundPath) {
      const subChildren = subPath.children.filter(c => c instanceof paper.Path) as paper.Path[];
      const subIdx = subChildren.indexOf(subOriginal);
      for (let i = 0; i < subChildren.length; i++) {
        if (i !== subIdx) {
          resultPath.addChild(subChildren[i].clone({ insert: false }));
        }
      }
    }
    
    // Cleanup if merged was a CompoundPath
    if (merged instanceof paper.CompoundPath) {
      merged.remove();
    }
  } else {
    // If it was a single path, but the connector or merge resulted in multiple paths, 
    // we must return a CompoundPath
    const finalChildren: paper.Path[] = [];
    if (merged instanceof paper.CompoundPath) {
      finalChildren.push(...(merged.children.filter(c => c instanceof paper.Path) as paper.Path[]));
    } else {
      finalChildren.push(merged as paper.Path);
    }

    if (subPath instanceof paper.CompoundPath && subPath.children.length > 1) {
      const subChildren = subPath.children.filter(c => c instanceof paper.Path) as paper.Path[];
      const subIdx = subChildren.indexOf(subOriginal);
      for (let i = 0; i < subChildren.length; i++) {
        if (i !== subIdx) {
          finalChildren.push(subChildren[i].clone({ insert: false }) as paper.Path);
        }
      }
    }

    if (finalChildren.length > 1) {
      const cp = new paper.CompoundPath({ children: finalChildren, insert: false });
      if (merged instanceof paper.CompoundPath) merged.remove();
      return cp;
    }
    
    if (merged instanceof paper.CompoundPath) {
      const first = finalChildren[0];
      merged.remove();
      return first;
    }
    return merged;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[mergePathsAtPoints] Result Sub-paths: ${resultPath instanceof paper.CompoundPath ? resultPath.children.length : 1}`);
  }

  return resultPath;
}
