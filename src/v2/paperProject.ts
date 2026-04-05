import paper from 'paper';

/**
 * Replace the active Paper.js project. Without this, each `paper.setup()` leaves a
 * detached Project in memory — noticeable when connector params change every frame (e.g. dragging u).
 */
export function resetPaperProject(width: number, height: number) {
  if (paper.project) {
    paper.project.remove();
  }
  paper.setup(new paper.Size(width, height));
}

/**
 * Parse stored SVG path data from `Area.boundary` (or merged boundaries). Multi-subpath strings
 * (holes, disjoint loops) must use CompoundPath — `new paper.Path(data)` mis-parses area.
 * Single-contour data is returned as a plain `Path` so callers that iterate `.segments` (e.g.
 * `getSharedPerimeter`) keep working.
 */
export function pathItemFromBoundaryData(data: string): paper.PathItem {
  const item = new paper.CompoundPath(data);
  item.reorient(true, true);
  if (item.children.length === 1) {
    const only = item.children[0] as paper.Path;
    const p = new paper.Path(only.pathData);
    item.remove();
    p.reorient(true, true);
    return p;
  }
  return item;
}
