import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { GraphManager } from './GraphManager';
import { Node, Edge, Face, FaceEdge } from '../types';

describe('GraphManager', () => {
  beforeEach(() => {
    paper.setup(new paper.Size(800, 600));
  });

  it('should traverse a simple rectangular face correctly', () => {
    const nodes: Record<string, Node> = {
      'n0': { id: 'n0', point: { x: 0, y: 0 }, incidentEdges: ['e0', 'e3'] },
      'n1': { id: 'n1', point: { x: 100, y: 0 }, incidentEdges: ['e0', 'e1'] },
      'n2': { id: 'n2', point: { x: 100, y: 100 }, incidentEdges: ['e1', 'e2'] },
      'n3': { id: 'n3', point: { x: 0, y: 100 }, incidentEdges: ['e2', 'e3'] },
    };

    const edges: Record<string, Edge> = {
      'e0': { id: 'e0', fromNode: 'n0', toNode: 'n1', pathData: 'M 0 0 L 100 0', leftFace: 'f1', rightFace: 'external' },
      'e1': { id: 'e1', fromNode: 'n1', toNode: 'n2', pathData: 'M 100 0 L 100 100', leftFace: 'f1', rightFace: 'external' },
      'e2': { id: 'e2', fromNode: 'n2', toNode: 'n3', pathData: 'M 100 100 L 0 100', leftFace: 'f1', rightFace: 'external' },
      'e3': { id: 'e3', fromNode: 'n3', toNode: 'n0', pathData: 'M 0 100 L 0 0', leftFace: 'f1', rightFace: 'external' },
    };

    const manager = new GraphManager(nodes, edges, {});
    const faceEdges = manager.traverseFace('e0', 'n0', 'f1');

    expect(faceEdges).toHaveLength(4);
    expect(faceEdges[0]).toEqual({ id: 'e0', reversed: false });
    expect(faceEdges[1]).toEqual({ id: 'e1', reversed: false });
    expect(faceEdges[2]).toEqual({ id: 'e2', reversed: false });
    expect(faceEdges[3]).toEqual({ id: 'e3', reversed: false });
  });

  it('should handle reversed edges in face traversal', () => {
    // Same rectangle but e2 is reversed (n3 -> n2)
    const nodes: Record<string, Node> = {
      'n0': { id: 'n0', point: { x: 0, y: 0 }, incidentEdges: ['e0', 'e3'] },
      'n1': { id: 'n1', point: { x: 100, y: 0 }, incidentEdges: ['e0', 'e1'] },
      'n2': { id: 'n2', point: { x: 100, y: 100 }, incidentEdges: ['e1', 'e2'] },
      'n3': { id: 'n3', point: { x: 0, y: 100 }, incidentEdges: ['e2', 'e3'] },
    };

    const edges: Record<string, Edge> = {
      'e0': { id: 'e0', fromNode: 'n0', toNode: 'n1', pathData: 'M 0 0 L 100 0', leftFace: 'f1', rightFace: 'external' },
      'e1': { id: 'e1', fromNode: 'n1', toNode: 'n2', pathData: 'M 100 0 L 100 100', leftFace: 'f1', rightFace: 'external' },
      'e2': { id: 'e2', fromNode: 'n3', toNode: 'n2', pathData: 'M 0 100 L 100 100', leftFace: 'external', rightFace: 'f1' },
      'e3': { id: 'e3', fromNode: 'n3', toNode: 'n0', pathData: 'M 0 100 L 0 0', leftFace: 'f1', rightFace: 'external' },
    };

    const manager = new GraphManager(nodes, edges, {});
    const faceEdges = manager.traverseFace('e0', 'n0', 'f1');

    expect(faceEdges).toHaveLength(4);
    expect(faceEdges[0]).toEqual({ id: 'e0', reversed: false });
    expect(faceEdges[1]).toEqual({ id: 'e1', reversed: false });
    expect(faceEdges[2]).toEqual({ id: 'e2', reversed: true });
    expect(faceEdges[3]).toEqual({ id: 'e3', reversed: false });
  });

  it('should split a face at two points on its boundary', () => {
    const nodes: Record<string, Node> = {
      'n0': { id: 'n0', point: { x: 0, y: 0 }, incidentEdges: ['e0', 'e3'] },
      'n1': { id: 'n1', point: { x: 100, y: 0 }, incidentEdges: ['e0', 'e1'] },
      'n2': { id: 'n2', point: { x: 100, y: 100 }, incidentEdges: ['e1', 'e2'] },
      'n3': { id: 'n3', point: { x: 0, y: 100 }, incidentEdges: ['e2', 'e3'] },
    };

    const edges: Record<string, Edge> = {
      'e0': { id: 'e0', fromNode: 'n0', toNode: 'n1', pathData: 'M 0 0 L 100 0', leftFace: 'f1', rightFace: 'external' },
      'e1': { id: 'e1', fromNode: 'n1', toNode: 'n2', pathData: 'M 100 0 L 100 100', leftFace: 'f1', rightFace: 'external' },
      'e2': { id: 'e2', fromNode: 'n2', toNode: 'n3', pathData: 'M 100 100 L 0 100', leftFace: 'f1', rightFace: 'external' },
      'e3': { id: 'e3', fromNode: 'n3', toNode: 'n0', pathData: 'M 0 100 L 0 0', leftFace: 'f1', rightFace: 'external' },
    };

    const faces: Record<string, Face> = {
      'f1': {
        id: 'f1',
        edges: [
          { id: 'e0', reversed: false },
          { id: 'e1', reversed: false },
          { id: 'e2', reversed: false },
          { id: 'e3', reversed: false }
        ],
        color: '#fff',
        groupMemberships: []
      }
    };

    const manager = new GraphManager(nodes, edges, faces);
    
    // Split vertically in the middle
    const ptA = { x: 50, y: 0 };
    const ptB = { x: 50, y: 100 };
    
    manager.splitFaceAtPoints('f1', ptA, ptB);

    const updatedFaces = manager.getFaces();
    expect(Object.keys(updatedFaces)).toHaveLength(2);
    
    // Each new face should have 4 edges
    Object.values(updatedFaces).forEach(face => {
      expect(face.edges).toHaveLength(4);
    });
  });

  it('should subdivide a face into a grid', () => {
    const nodes: Record<string, Node> = {
      'n0': { id: 'n0', point: { x: 0, y: 0 }, incidentEdges: ['e0', 'e3'] },
      'n1': { id: 'n1', point: { x: 100, y: 0 }, incidentEdges: ['e0', 'e1'] },
      'n2': { id: 'n2', point: { x: 100, y: 100 }, incidentEdges: ['e1', 'e2'] },
      'n3': { id: 'n3', point: { x: 0, y: 100 }, incidentEdges: ['e2', 'e3'] },
    };

    const edges: Record<string, Edge> = {
      'e0': { id: 'e0', fromNode: 'n0', toNode: 'n1', pathData: 'M 0 0 L 100 0', leftFace: 'f1', rightFace: 'external' },
      'e1': { id: 'e1', fromNode: 'n1', toNode: 'n2', pathData: 'M 100 0 L 100 100', leftFace: 'f1', rightFace: 'external' },
      'e2': { id: 'e2', fromNode: 'n2', toNode: 'n3', pathData: 'M 100 100 L 0 100', leftFace: 'f1', rightFace: 'external' },
      'e3': { id: 'e3', fromNode: 'n3', toNode: 'n0', pathData: 'M 0 100 L 0 0', leftFace: 'f1', rightFace: 'external' },
    };

    const faces: Record<string, Face> = {
      'f1': {
        id: 'f1',
        edges: [
          { id: 'e0', reversed: false },
          { id: 'e1', reversed: false },
          { id: 'e2', reversed: false },
          { id: 'e3', reversed: false }
        ],
        color: '#fff',
        groupMemberships: []
      }
    };

    const manager = new GraphManager(nodes, edges, faces);
    
    // Subdivide into 2x2 grid
    manager.subdivideGrid('f1', 2, 2);

    const updatedFaces = manager.getFaces();
    expect(Object.keys(updatedFaces)).toHaveLength(4);
  });

  it('should split a circle face horizontally', () => {
    // Create a circle root
    const center = { x: 100, y: 100 };
    const radius = 50;
    const boundary = new paper.Path.Circle(new paper.Point(center.x, center.y), radius);
    
    const nodes: Record<string, Node> = {};
    const edges: Record<string, Edge> = {};
    const faceEdges: FaceEdge[] = [];

    boundary.curves.forEach((curve, i) => {
      const fromId = `n${i}`;
      const toId = `n${(i + 1) % boundary.segments.length}`;
      const edgeId = `e${i}`;
      
      nodes[fromId] = { id: fromId, point: curve.segment1.point, incidentEdges: [edgeId] };
      if (!nodes[toId]) nodes[toId] = { id: toId, point: curve.segment2.point, incidentEdges: [edgeId] };
      else nodes[toId].incidentEdges.push(edgeId);
      nodes[fromId].incidentEdges.push(edgeId);

      const edgePath = new paper.Path({
        segments: [curve.segment1, curve.segment2],
        insert: false
      });

      edges[edgeId] = {
        id: edgeId,
        fromNode: fromId,
        toNode: toId,
        pathData: edgePath.pathData,
        leftFace: 'f1',
        rightFace: 'external'
      };
      faceEdges.push({ id: edgeId, reversed: false });
      edgePath.remove();
    });

    const faces: Record<string, Face> = {
      'f1': {
        id: 'f1',
        edges: faceEdges,
        color: '#fff',
        groupMemberships: []
      }
    };

    const manager = new GraphManager(nodes, edges, faces);
    const bounds = boundary.bounds;
    
    // Split horizontally at middle
    const ptA = { x: bounds.left, y: bounds.top + bounds.height / 2 };
    const ptB = { x: bounds.right, y: bounds.top + bounds.height / 2 };
    
    manager.splitFaceAtPoints('f1', ptA, ptB);

    const updatedFaces = manager.getFaces();
    expect(Object.keys(updatedFaces)).toHaveLength(2);
    boundary.remove();
  });
});
