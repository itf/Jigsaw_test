import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { TopologicalEngine } from './topology_engine';
import * as d3 from 'd3-delaunay';

describe('TopologicalEngine Hexagonal Grid', () => {
  let engine: TopologicalEngine;

  beforeEach(() => {
    engine = new TopologicalEngine();
  });

  it('should not have gaps in a hexagonal grid with connectors', () => {
    const width = 500;
    const height = 500;
    const radius = 50;
    
    // Generate hexagonal grid points
    const points: { x: number; y: number }[] = [];
    const hexWidth = radius * Math.sqrt(3);
    const hexHeight = radius * 1.5;
    
    for (let y = 0; y < height + radius; y += hexHeight) {
      const offset = (Math.round(y / hexHeight) % 2) * (hexWidth / 2);
      for (let x = 0; x < width + radius; x += hexWidth) {
        points.push({ x: x + offset, y: y });
      }
    }

    const delaunay = d3.Delaunay.from(points.map(p => [p.x, p.y]));
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    
    const areas = Array.from(voronoi.cellPolygons()).map((poly, i) => {
      const pathData = "M " + poly.map(p => p.join(",")).join(" L ") + " Z";
      return {
        id: `cell-${i}`,
        boundary: pathData,
        seedPoint: { x: points[i].x, y: points[i].y },
        color: '#ff0000'
      };
    });

    engine.initializeFromVoronoi(areas, width, height);

    // Add some connectors to random internal edges
    const internalEdges = Array.from(engine.edges.values()).filter(e => e.faceBId !== null);
    internalEdges.slice(0, 20).forEach(edge => {
      edge.connectors = [{
        u: 0.5,
        stampPathData: "M -10 0 A 10 10 0 1 1 10 0", // A simple semicircular tab
        isFlipped: false,
        ownerFaceId: edge.faceAId
      }];
    });

    let totalArea = 0;
    const piecePaths: paper.Path[] = [];
    
    engine.faces.forEach(face => {
      const pathData = engine.getMergedBoundary([face.id]);
      const path = new paper.Path(pathData);
      totalArea += Math.abs(path.area);
      piecePaths.push(path);
    });

    console.log(`Total Area: ${totalArea}`);
    console.log(`Expected Area: ${width * height}`);

    // The total area should be very close to width * height
    // Note: Connectors add/subtract area, but since they are shared, 
    // the total area of all pieces should still equal the total grid area.
    expect(Math.abs(totalArea - width * height)).toBeLessThan(5); // Slightly larger tolerance for complex paths

    // Union of all pieces should be the outer boundary (a rectangle)
    let unionPath = piecePaths[0];
    for (let i = 1; i < piecePaths.length; i++) {
      const nextUnion = unionPath.unite(piecePaths[i]) as paper.Path;
      unionPath.remove();
      unionPath = nextUnion;
    }
    
    // The union area might have small precision errors, but should be close
    expect(Math.abs(unionPath.area - width * height)).toBeLessThan(50);
    
    // Check for gaps (union path should have no significant holes)
    if (unionPath instanceof paper.CompoundPath) {
      // In a compound path, children are loops. One outer, others are holes.
      const holes = unionPath.children.slice(1);
      const significantHoles = holes.filter(h => Math.abs((h as paper.Path).area) > 0.1);
      expect(significantHoles.length).toBe(0);
    } else {
      // If it's a simple Path, it's just the outer boundary.
      expect(unionPath instanceof paper.Path).toBe(true);
    }
    
    unionPath.remove();
    piecePaths.forEach(p => p.remove());
  });
});
