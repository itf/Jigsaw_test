import paper from 'paper';
import { Area, AreaType } from '../types';

/**
 * Validates and cleans the puzzle state.
 * Specifically, it handles pieces that have been split into non-connected parts.
 * If a piece is split, it creates new pieces for each connected part.
 */
export function validateAndCleanState(areas: Record<string, Area>): Record<string, Area> {
  const nextAreas = { ...areas };
  const pieceIds = Object.keys(nextAreas).filter(id => nextAreas[id].type === AreaType.PIECE);
  
  let stateChanged = false;

  pieceIds.forEach(id => {
    const area = nextAreas[id];
    if (!area) return;

    const boundary = area.boundary;
    
    // If it's a CompoundPath, it might have multiple disconnected parts.
    // We need to check if these parts are actually disconnected or just holes.
    if (boundary instanceof paper.CompoundPath) {
      const children = boundary.children.filter(c => c instanceof paper.Path) as paper.Path[];
      
      // A simple heuristic: if we have multiple children, and they don't contain each other,
      // they are separate pieces. If one contains another, the inner one is likely a hole.
      // However, Paper.js CompoundPath usually handles holes correctly (even/odd rule).
      // If we want to split disconnected parts, we can use PathItem.getItem() or similar,
      // but a more robust way is to use PathItem.split() or just check the children.
      
      // Better approach: use PathItem.unite() on each child individually to see if they are separate.
      // Actually, Paper.js has a way to get separate paths from a compound path if they don't overlap.
      
      // Let's try to decompose the CompoundPath into its separate connected components.
      const parts: paper.PathItem[] = [];
      
      // We can use a trick: unite each child with nothing to get a simple Path or CompoundPath.
      // Or just iterate through children and see which ones are "positive" area vs "negative" area (holes).
      
      // A more reliable way in Paper.js to split a CompoundPath into separate PathItems (each being a connected component):
      // We can use the fact that a connected component in a CompoundPath is one outer path plus its holes.
      
      const components = getDisconnectedComponents(boundary);
      
      if (components.length > 1) {
        stateChanged = true;
        const parentId = area.parentId;
        const newChildIds: string[] = [];

        components.forEach((comp, index) => {
          const newId = `${id}-part-${index}-${Math.random().toString(36).slice(2, 6)}`;
          newChildIds.push(newId);
          
          // Ensure the component is removed from the active project
          comp.remove();
          
          nextAreas[newId] = {
            ...area,
            id: newId,
            boundary: comp,
            children: []
          };
        });

        // Update parent's children list
        if (parentId && nextAreas[parentId]) {
          nextAreas[parentId] = {
            ...nextAreas[parentId],
            children: nextAreas[parentId].children.filter(cid => cid !== id).concat(newChildIds)
          };
        }

        // Remove the original split piece
        delete nextAreas[id];
      }
    }
  });

  return nextAreas;
}

/**
 * Helper to split a PathItem into its disconnected components.
 * Each component is a PathItem (Path or CompoundPath) that is internally connected.
 */
export function getDisconnectedComponents(path: paper.PathItem): paper.PathItem[] {
  if (path instanceof paper.Path) {
    return [path.clone({ insert: false })];
  }
  
  if (!(path instanceof paper.CompoundPath)) {
    return [path.clone({ insert: false })];
  }

  const children = path.children.filter(c => c instanceof paper.Path) as paper.Path[];
  if (children.length <= 1) {
    return [path.clone({ insert: false })];
  }

  // Group children into components. A component is an outer path + its holes.
  // We can determine this by checking containment.
  // This is a simplified version: we assume the largest paths are outer paths.
  
  const sortedChildren = [...children].sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const components: paper.Path[][] = [];
  
  sortedChildren.forEach(child => {
    let foundComponent = false;
    for (const comp of components) {
      // If the child is inside the first path of the component (the outer path), it's a hole.
      if (comp[0].contains(child.bounds.center)) {
        comp.push(child);
        foundComponent = true;
        break;
      }
    }
    if (!foundComponent) {
      components.push([child]);
    }
  });

  return components.map(comp => {
    if (comp.length === 1) {
      return comp[0].clone({ insert: false });
    } else {
      const cp = new paper.CompoundPath({ insert: false });
      comp.forEach(c => cp.addChild(c.clone({ insert: false })));
      return cp;
    }
  });
}
