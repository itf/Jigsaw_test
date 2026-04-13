import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { GraphManager } from './GraphManager';
import { NeckShape, ConnectorV5 } from '../types';

describe('GraphManager Connector Scenarios', () => {
  beforeEach(() => {
    // Paper is already setup in src/tests/setup.ts
    // but we might want to clear the project
    paper.project.clear();
  });

  it('Scenario 5: Outward square connector on corner', () => {
    const gm = new GraphManager();
    const n1 = gm.addNode({ x: 50, y: 50 });
    const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
    gm.addFace([{ id: e1, reversed: true }]); // Piece is rightFace

    const params = {
      midEdgeId: e1,
      midT: 0.25, // Corner at (150, 50)
      widthPx: 20,
      direction: 'in' as const // Protrude from rightFace into leftFace (outward)
    };

    const endpoints = gm.computeConnectorEndpoints(params);
    
    // Verify endpoints are on different segments but same original edge
    // p1Offset = 290 on reversed path -> t = 1 - 290/400 = 0.275
    // p2Offset = 310 on reversed path -> t = 1 - 310/400 = 0.225
    expect(endpoints.p1.edgeId).toBe(e1);
    expect(endpoints.p2.edgeId).toBe(e1);
    expect(endpoints.p1.t).toBeCloseTo(0.275);
    expect(endpoints.p2.t).toBeCloseTo(0.225);

    const connector: ConnectorV5 = {
      id: 'conn-5',
      midEdgeId: e1,
      midT: 0.25,
      direction: 'in',
      p1: endpoints.p1,
      p2: endpoints.p2,
      replacedSegment: endpoints.replacedSegment,
      widthPx: 20,
      extrusion: 20,
      headTemplateId: 'square',
      headScale: 1,
      headRotationDeg: 0,
      neckShape: NeckShape.STANDARD
    };

    gm.bakeConnector(connector);

    const edges = gm.getEdges();
    const edgeIds = Object.keys(edges);
    const faces = gm.getFaces();
    const nodes = gm.getNodes();

    expect(edgeIds.length).toBe(3);
    
    // Verify graph is still closed
    for (const node of Object.values(nodes)) {
      expect(node.incidentEdges.length).toBe(2);
    }

    // Verify faces
    for (const face of Object.values(faces)) {
      expect(face.edges.length).toBe(3);
    }
  });

  it('Scenario 7: Inward square connector on corner', () => {
    const gm = new GraphManager();
    const n1 = gm.addNode({ x: 50, y: 50 });
    const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
    gm.addFace([{ id: e1, reversed: true }]);

    const params = {
      midEdgeId: e1,
      midT: 0.25,
      widthPx: 20,
      direction: 'in' as const
    };

    const endpoints = gm.computeConnectorEndpoints(params);
    
    const connector: ConnectorV5 = {
      id: 'conn-7',
      midEdgeId: e1,
      midT: 0.25,
      direction: 'in',
      p1: endpoints.p1,
      p2: endpoints.p2,
      replacedSegment: endpoints.replacedSegment,
      widthPx: 20,
      extrusion: -20, // Inward
      headTemplateId: 'square',
      headScale: 1,
      headRotationDeg: 0,
      neckShape: NeckShape.STANDARD
    };

    gm.bakeConnector(connector);

    const edges = gm.getEdges();
    expect(Object.keys(edges).length).toBeGreaterThan(1);
    
    const nodes = gm.getNodes();
    for (const node of Object.values(nodes)) {
      expect(node.incidentEdges.length).toBeGreaterThanOrEqual(2);
    }
  });
});
