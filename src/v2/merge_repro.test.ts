import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { TopologicalEngine } from './topology_engine';
import { Delaunay } from 'd3-delaunay';
import { getSharedPerimeter, getPointAtU } from './geometry';

describe('TopologicalEngine 3x3 Grid Merge', () => {
  let engine: TopologicalEngine;

  beforeEach(() => {
    engine = new TopologicalEngine();
  });

  it('should have matching area after merging a 3x3 hexagonal grid', () => {
    const width = 500;
    const height = 500;
    const radius = 50;
    
    // Generate hexagonal grid points
    const points: [number, number][] = [];
    const hexWidth = radius * Math.sqrt(3);
    const hexHeight = radius * 1.5;
    
    for (let y = 0; y < height + radius; y += hexHeight) {
      const offset = (Math.round(y / hexHeight) % 2) * (hexWidth / 2);
      for (let x = 0; x < width + radius; x += hexWidth) {
        points.push([x + offset, y]);
      }
    }

    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    
    const areas = Array.from(voronoi.cellPolygons()).map((poly, i) => {
      const pathData = "M " + poly.map(p => p.join(",")).join(" L ") + " Z";
      return {
        id: `cell-${i}`,
        boundary: pathData,
        seedPoint: { x: points[i][0], y: points[i][1] },
        color: '#ff0000'
      };
    });

    engine.initializeFromVoronoi(areas, width, height);

    const faceIds = areas.map(a => a.id);
    const mergedBoundary = engine.getMergedBoundary(faceIds);
    
    const path = new paper.Path(mergedBoundary);
    const area = Math.abs(path.area);
    
    console.log(`Hex Merged Area: ${area}`);
    console.log(`Expected Area: ${width * height}`);
    
    // The total area should be close to width * height
    expect(Math.abs(area - width * height)).toBeLessThan(1);
    
    path.remove();
  });

  it('should have matching area after merging a 3x3 grid', () => {
    const width = 300;
    const height = 300;
    const cellSize = 100;
    
    const areas: any[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const id = `cell-${x}-${y}`;
        const x0 = x * cellSize;
        const y0 = y * cellSize;
        const x1 = x0 + cellSize;
        const y1 = y0 + cellSize;
        const boundary = `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
        areas.push({
          id,
          boundary,
          seedPoint: { x: x0 + 50, y: y0 + 50 },
          color: '#ff0000'
        });
      }
    }

    engine.initializeFromVoronoi(areas, width, height);

    // Merge all faces
    const faceIds = areas.map(a => a.id);
    const mergedBoundary = engine.getMergedBoundary(faceIds);
    
    const path = new paper.Path(mergedBoundary);
    const area = Math.abs(path.area);
    
    console.log(`Merged Area: ${area}`);
    expect(area).toBeCloseTo(width * height, 1);
    
    path.remove();
  });

  it('should include connectors in piece boundaries', () => {
    const areas = [
      {
        id: 'A',
        boundary: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
        seedPoint: { x: 50, y: 50 },
        color: '#ff0000'
      },
      {
        id: 'B',
        boundary: 'M 100 0 L 200 0 L 200 100 L 100 100 Z',
        seedPoint: { x: 150, y: 50 },
        color: '#00ff00'
      }
    ];

    engine.initializeFromVoronoi(areas, 200, 100);

    // Find shared edges
    const edges = engine.findEdgesBetweenFaces('A', 'B');
    expect(edges.length).toBeGreaterThan(0);

    // Add a connector
    // Use a raw stamp (at 0,0 pointing right)
    const rawStamp = 'M 0 -5 L 10 -5 L 10 5 L 0 5 Z';
    engine.addConnectorToBoundary('A', 'B', 0.5, rawStamp, false, 'A');

    // Check boundary of A
    const boundaryA = engine.getMergedBoundary(['A']);
    const pathA = new paper.Path(boundaryA);
    
    console.log(`Path A segments: ${pathA.segments.length}`);
    
    // Original square has 4 segments. 
    // Adding a connector (4 points) replacing 1 segment should result in 4 - 1 + 4 = 7 segments?
    // Let's just check if it's > 4.
    expect(pathA.segments.length).toBeGreaterThan(4);
    
    pathA.remove();
  });

  it('should handle T-junctions during merging', () => {
    // Piece A: (0,0) -> (100,0) -> (100,100) -> (0,100)
    // Piece B: (100,0) -> (200,0) -> (200,100) -> (100,100)
    // Piece C: (0,100) -> (200,100) -> (200,200) -> (0,200)
    
    // But Piece C has a T-junction at (100,100) because of how it was subdivided
    const areas = [
      {
        id: 'A',
        boundary: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
        seedPoint: { x: 50, y: 50 },
        color: '#ff0000'
      },
      {
        id: 'B',
        boundary: 'M 100 0 L 200 0 L 200 100 L 100 100 Z',
        seedPoint: { x: 150, y: 50 },
        color: '#00ff00'
      },
      {
        id: 'C',
        // NO extra point at (100,100). This is a TRUE T-junction.
        boundary: 'M 0 100 L 200 100 L 200 200 L 0 200 Z',
        seedPoint: { x: 100, y: 150 },
        color: '#0000ff'
      }
    ];

    engine.initializeFromVoronoi(areas, 200, 200);

    // Merge all faces
    const faceIds = ['A', 'B', 'C'];
    const mergedBoundary = engine.getMergedBoundary(faceIds);
    
    const path = new paper.Path(mergedBoundary);
    console.log(`T-Junction Merged Area: ${path.area}`);
    console.log(`T-Junction Path Data: ${mergedBoundary}`);
    
    // If T-junctions are NOT handled, the edge (100,100)-(200,100) from B 
    // won't match the segment (100,100)-(200,100) from C? 
    // Wait, in this case they DO match because C has that segment explicitly.
    
    // What if C DOES NOT have the segment?
    // Piece C: (0,100) -> (200,100) -> (200,200) -> (0,200)
    // Piece A: (0,0) -> (100,0) -> (100,100) -> (0,100)
    // Piece B: (100,0) -> (200,0) -> (200,100) -> (100,100)
    // The edge (0,100)-(200,100) is shared by C and (A+B).
    // But A only has (0,100)-(100,100) and B only has (100,100)-(200,100).
    
    expect(Math.abs(path.area)).toBeCloseTo(200 * 200, 1);
    path.remove();
  });

  it('should handle a realistic 3x3 grid from Voronoi and Intersect', () => {
    const width = 300;
    const height = 300;
    
    // 3x3 grid points
    const points: [number, number][] = [];
    for (let y = 50; y < 300; y += 100) {
      for (let x = 50; x < 300; x += 100) {
        points.push([x, y]);
      }
    }

    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    
    paper.setup(new paper.Size(width, height));
    const rootPath = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(width, height));

    const areas = points.map((p, i) => {
      const poly = voronoi.cellPolygon(i);
      const cellPath = new paper.Path();
      poly.forEach((pt, j) => {
        if (j === 0) cellPath.moveTo(new paper.Point(pt[0], pt[1]));
        else cellPath.lineTo(new paper.Point(pt[0], pt[1]));
      });
      cellPath.closePath();
      
      const clipped = rootPath.intersect(cellPath);
      const boundary = clipped.pathData;
      
      cellPath.remove();
      const res = {
        id: `cell-${i}`,
        boundary,
        seedPoint: { x: p[0], y: p[1] },
        color: '#ff0000'
      };
      clipped.remove();
      return res;
    });

    engine.initializeFromVoronoi(areas, width, height);

    const faceIds = areas.map(a => a.id);
    const mergedBoundary = engine.getMergedBoundary(faceIds);
    
    const path = new paper.Path(mergedBoundary);
    console.log(`Realistic Grid Merged Area: ${path.area}`);
    
    expect(Math.abs(path.area)).toBeCloseTo(width * height, 1);
    path.remove();
    rootPath.remove();
  });

  it('3x3 Voronoi grid: connector at chord u=0 and u=1 maps to chain endpoints (middle cell vs right neighbor)', () => {
    const width = 300;
    const height = 300;
    const points: [number, number][] = [];
    for (let y = 50; y < 300; y += 100) {
      for (let x = 50; x < 300; x += 100) {
        points.push([x, y]);
      }
    }

    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);

    paper.setup(new paper.Size(width, height));
    const rootPath = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(width, height));

    const areas = points.map((p, i) => {
      const poly = voronoi.cellPolygon(i);
      const cellPath = new paper.Path();
      poly.forEach((pt, j) => {
        if (j === 0) cellPath.moveTo(new paper.Point(pt[0], pt[1]));
        else cellPath.lineTo(new paper.Point(pt[0], pt[1]));
      });
      cellPath.closePath();

      const clipped = rootPath.intersect(cellPath);
      const boundary = clipped.pathData;
      cellPath.remove();
      const res = {
        id: `cell-${i}`,
        boundary,
        seedPoint: { x: p[0], y: p[1] },
        color: '#ff0000',
      };
      clipped.remove();
      return res;
    });
    rootPath.remove();

    const engine = new TopologicalEngine();
    engine.initializeFromVoronoi(areas, width, height);

    const middleId = 'cell-4';
    const rightId = 'cell-5';
    const a = areas[4];
    const b = areas[5];

    const shared = getSharedPerimeter(a as any, b as any);
    expect(shared).not.toBeNull();

    const stamp = 'M 0 -2 L 4 -2 L 4 2 L 0 2 Z';

    const chordPath = shared! as paper.Path;
    const chordEnd0 = chordPath.firstSegment.point;
    const chordEnd1 = chordPath.lastSegment.point;

    /** Connector `u` on an edge segment must match the chord anchor (same as boolean preview). */
    const expectAnchorMatchesChord = (chordU: number) => {
      engine.edges.forEach(e => {
        e.connectors = undefined;
      });
      const expected = getPointAtU(shared!, chordU)!.point;
      engine.addConnectorAtAnchor(
        middleId,
        rightId,
        expected,
        stamp,
        false,
        middleId,
        chordU,
        chordEnd0,
        chordEnd1
      );
      let dist = Infinity;
      engine.edges.forEach(e => {
        if (!e.connectors?.length) return;
        const c = e.connectors[0];
        const v1 = engine.vertices.get(e.v1Id)!.point;
        const v2 = engine.vertices.get(e.v2Id)!.point;
        const placed = v1.add(v2.subtract(v1).multiply(c.u));
        const d = placed.getDistance(expected);
        if (d < dist) dist = d;
      });
      expect(dist).toBeLessThan(0.5);
    };

    expectAnchorMatchesChord(0);
    expectAnchorMatchesChord(1);
    // Single-segment interfaces often map chord u=0 / u=1 to local t=1 / t=0 when the chord
    // is oriented opposite to the topo chain; that is still correct if the anchor matches.
    shared!.remove();
  });
});
