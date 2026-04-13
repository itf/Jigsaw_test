import React, { useEffect, useRef, useState } from 'react';
import paper from 'paper';
import { mergePathsAtPoints, getExactSegment } from '../utils/pathMergeUtils';
import { generateConnectorPath } from '../utils/connectorUtils';
const getDisconnectedComponents = (..._args: any[]) => [];
import { getWhimsyTemplatePathData } from '../utils/whimsyGallery';
import { NeckShape, Point as V5Point, FloatingWhimsy, ConnectorV5 } from '../types';
import { GraphManager } from '../utils/GraphManager';
import { ChevronLeft, Bug, Info, RefreshCw, Layers } from 'lucide-react';

interface TestCase {
  name: string;
  description: string;
  setup: () => {
    main: paper.PathItem;
    sub: paper.PathItem;
    p1: paper.Point;
    p2: paper.Point;
    mainPathIndex?: number;
  };
}

export default function V5DebugPage({ onBack }: { onBack: () => void }) {
  const [testResults, setTestResults] = useState<{ name: string; pathData: string; originalMain: string; originalSub: string; p1: [number, number]; p2: [number, number]; wasClockwise: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // V5 Scenarios State
  const [v5Scenario, setV5Scenario] = useState<number>(0);
  const [v5Graph, setV5Graph] = useState<{ nodes: any; edges: any; faces: any } | null>(null);

  const runV5Scenario = (index: number) => {
    const gm = new GraphManager();
    const canvas = document.createElement('canvas');
    paper.setup(canvas);

    try {
      if (index === 1) {
        // 1- Single Square (1 node, 1 edge)
        const n1 = gm.addNode({ x: 50, y: 50 });
        const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
        gm.addFace([{ id: e1, reversed: true }]);
      } 
      else if (index === 2) {
        // 2- Square inside Square
        const n1 = gm.addNode({ x: 50, y: 50 });
        const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
        gm.addFace([{ id: e1, reversed: true }]);

        const whimsy: FloatingWhimsy = {
          id: 'w1',
          templateId: 'square',
          center: { x: 100, y: 100 },
          rotationDeg: 0,
          scale: 50,
          svgData: 'M0,0 L1,0 L1,1 L0,1 Z'
        };
        const whimsyPath = new paper.Path('M75,75 L125,75 L125,125 L75,125 Z');
        whimsyPath.reverse(); // Hole
        gm.spliceWhimsy(whimsy, whimsyPath);
        whimsyPath.remove();
      }
      else if (index === 3) {
        // 3- Intersecting Squares using spliceWhimsy
        const n1 = gm.addNode({ x: 50, y: 50 });
        const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
        gm.addFace([{ id: e1, reversed: true }]);

        const whimsy: FloatingWhimsy = {
          id: 'w1',
          templateId: 'square',
          center: { x: 130, y: 130 },
          rotationDeg: 0,
          scale: 100,
          svgData: 'M0,0 L1,0 L1,1 L0,1 Z'
        };
        const whimsyPath = new paper.Path('M80,80 L180,80 L180,180 L80,180 Z');
        gm.spliceWhimsy(whimsy, whimsyPath);
        whimsyPath.remove();
      }
      else if (index === 4) {
        // 4- 3-sided square connector on side
        const n1 = gm.addNode({ x: 50, y: 50 });
        const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
        gm.addFace([{ id: e1, reversed: true }]);

        const connPath = new paper.Path('M90,50 L90,30 L110,30 L110,50');
        gm.spliceEdge(e1, connPath);
        connPath.remove();
      }
      else if (index === 5) {
        // 5- Outward square connector on corner (using engine functions)
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
      }
      else if (index === 6) {
        // 6- Inward connector on side
        const n1 = gm.addNode({ x: 50, y: 50 });
        const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
        gm.addFace([{ id: e1, reversed: true }]);

        const connPath = new paper.Path('M90,50 L90,70 L110,70 L110,50');
        gm.spliceEdge(e1, connPath);
        connPath.remove();
      }
      else if (index === 7) {
        // 7- Inward square connector on corner (using engine functions)
        const n1 = gm.addNode({ x: 50, y: 50 });
        const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
        gm.addFace([{ id: e1, reversed: true }]); // Piece is rightFace

        const params = {
          midEdgeId: e1,
          midT: 0.25, // Corner at (150, 50)
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
      }
      else if (index === 8) {
        // 8- Split multi-segment edge
        const n1 = gm.addNode({ x: 0, y: 0 });
        const n2 = gm.addNode({ x: 200, y: 200 });
        // Edge with 3 segments: (0,0)->(100,0)->(100,100)->(200,200)
        const e1 = gm.addEdge(n1, n2, 'M0,0 L100,0 L100,100 L200,200');
        
        // Split in the middle of the second segment (100, 50)
        gm.splitEdgeAtPoint(e1, { x: 100, y: 50 });
      }

      setV5Graph({
        nodes: gm.getNodes(),
        edges: gm.getEdges(),
        faces: gm.getFaces()
      });
      setV5Scenario(index);
    } catch (e) {
      console.error("V5 Scenario failed:", e);
    }
  };


  // Live Debug State
  const [liveParams, setLiveParams] = useState({
    midT: 0.5,
    extrusion: 20,
    width: 30,
    headScale: 1,
    headRotation: 0,
    pathIndex: 1,
    shape: 'donut' as 'square' | 'circle' | 'donut' | 'square-hole' | 'square-2-holes',
    headType: 'square' as 'square' | 'circle' | 'star' | 'triangle',
    direction: 'out' as 'in' | 'out',
  });

  const [selectionDebug, setSelectionDebug] = useState({
    overlayOpacity: 0.4,
    strokeWidth: 5,
    glowIntensity: 8,
    dashLength: 8,
    blueColor: '#312e81',
    purpleColor: '#581c87',
    overlayColor: 'rgba(30, 27, 75, 0.4)'
  });

  const [liveResult, setLiveResult] = useState<{ pathData: string; originalMain: string; originalSub: string; p1: [number, number]; p2: [number, number]; wasClockwise: boolean } | null>(null);

  const runLiveTest = () => {
    const canvas = document.createElement('canvas');
    paper.setup(canvas);

    const gm = new GraphManager();
    let targetEdgeId = '';

    if (liveParams.shape === 'square') {
      const n1 = gm.addNode({ x: 50, y: 50 });
      targetEdgeId = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
      gm.addFace([{ id: targetEdgeId, reversed: true }]);
    } else if (liveParams.shape === 'circle') {
      const n1 = gm.addNode({ x: 40, y: 100 });
      targetEdgeId = gm.addEdge(n1, n1, 'M40,100 A60,60 0 1,1 160,100 A60,60 0 1,1 40,100 Z');
      gm.addFace([{ id: targetEdgeId, reversed: true }]);
    } else if (liveParams.shape === 'donut') {
      const n1 = gm.addNode({ x: 20, y: 100 });
      const e1 = gm.addEdge(n1, n1, 'M20,100 A80,80 0 1,1 180,100 A80,80 0 1,1 20,100 Z');
      gm.addFace([{ id: e1, reversed: true }]);
      
      const n2 = gm.addNode({ x: 60, y: 100 });
      const e2 = gm.addEdge(n2, n2, 'M60,100 A40,40 0 1,1 140,100 A40,40 0 1,1 60,100 Z');
      gm.addFace([{ id: e2, reversed: true }]);
      targetEdgeId = liveParams.pathIndex === 0 ? e1 : e2;
    } else if (liveParams.shape === 'square-hole') {
      const n1 = gm.addNode({ x: 20, y: 20 });
      const e1 = gm.addEdge(n1, n1, 'M20,20 L180,20 L180,180 L20,180 Z');
      gm.addFace([{ id: e1, reversed: true }]);

      const n2 = gm.addNode({ x: 60, y: 60 });
      const e2 = gm.addEdge(n2, n2, 'M60,60 L60,140 L140,140 L140,60 Z'); // CCW hole
      gm.addFace([{ id: e2, reversed: false }]);
      targetEdgeId = liveParams.pathIndex === 0 ? e1 : e2;
    } else {
      const n1 = gm.addNode({ x: 10, y: 10 });
      const e1 = gm.addEdge(n1, n1, 'M10,10 L190,10 L190,190 L10,190 Z');
      gm.addFace([{ id: e1, reversed: true }]);

      const n2 = gm.addNode({ x: 30, y: 100 });
      const e2 = gm.addEdge(n2, n2, 'M30,100 A30,30 0 1,0 90,100 A30,30 0 1,0 30,100 Z');
      gm.addFace([{ id: e2, reversed: false }]);

      const n3 = gm.addNode({ x: 110, y: 100 });
      const e3 = gm.addEdge(n3, n3, 'M110,100 A30,30 0 1,0 170,100 A30,30 0 1,0 110,100 Z');
      gm.addFace([{ id: e3, reversed: false }]);
      
      targetEdgeId = liveParams.pathIndex === 0 ? e1 : (liveParams.pathIndex === 1 ? e2 : e3);
    }

    try {
      // Build a temporary paper path for generateConnectorPath
      const tempPath = gm.getEdges()[targetEdgeId].path.clone({ insert: false });
      const face = Object.values(gm.getFaces()).find(f => f.edges.some(e => e.id === targetEdgeId));
      const isReversed = face?.edges.find(e => e.id === targetEdgeId)?.reversed;
      if (isReversed) tempPath.reverse();

      const result = generateConnectorPath(
        tempPath, 0, liveParams.midT, liveParams.width, 
        liveParams.direction === 'out' ? Math.abs(liveParams.extrusion) : -Math.abs(liveParams.extrusion), 
        liveParams.headType, liveParams.headScale, liveParams.headRotation, true, [], 0, 0, 
        NeckShape.STANDARD, 0, 0
      );
      
      const sub = new paper.CompoundPath({ pathData: result.pathData, insert: false });
      gm.spliceEdge(targetEdgeId, sub);
      
      // Reconstruct the result path from faces
      const paths = Object.values(gm.getFaces()).map(f => {
        const p = new paper.Path();
        f.edges.forEach((fe: any) => {
          const edge = gm.getEdges()[fe.id];
          const tmp = edge.path.clone({ insert: false });
          if (fe.reversed) tmp.reverse();
          p.addSegments(tmp.segments);
          tmp.remove();
        });
        p.closed = true;
        return p;
      });

      const merged = new paper.CompoundPath({ children: paths, insert: false });
      
      setLiveResult({
        pathData: merged.pathData,
        originalMain: tempPath.pathData,
        originalSub: sub.pathData,
        p1: [result.p1.x, result.p1.y],
        p2: [result.p2.x, result.p2.y],
        wasClockwise: !isReversed
      });

      tempPath.remove();
      sub.remove();
      merged.remove();
    } catch (e) {
      console.error("Live test failed:", e);
    }
  };

  const runTests = () => {
    // Initialize paper in a hidden canvas for processing
    const canvas = document.createElement('canvas');
    paper.setup(canvas);

    const testCases: TestCase[] = [
      {
        name: "Square Piece + Square Connector (Graph)",
        description: "Simple merge of a square connector into a square piece using GraphManager.",
        setup: () => {
          const gm = new GraphManager();
          const n1 = gm.addNode({ x: 50, y: 50 });
          const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
          gm.addFace([{ id: e1, reversed: true }]);

          const main = new paper.Path.Rectangle({ point: [50, 50], size: [100, 100], insert: false });
          const result = generateConnectorPath(main, 0, 0.5, 20, 15, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0);
          const sub = new paper.CompoundPath({ pathData: result.pathData, insert: false });
          
          gm.spliceEdge(e1, sub);
          
          const face = Object.values(gm.getFaces())[0] as any;
          const path = new paper.Path();
          face.edges.forEach((fe: any) => {
            const edge = gm.getEdges()[fe.id];
            const tmp = edge.path.clone({ insert: false });
            if (fe.reversed) tmp.reverse();
            path.addSegments(tmp.segments);
            tmp.remove();
          });
          path.closed = true;
          
          const res = { main: path, sub, p1: result.p1, p2: result.p2, mainPathIndex: 0 };
          main.remove();
          return res;
        }
      },
      {
        name: "Square Piece + Inward Connector (Graph)",
        description: "Inward connector using GraphManager.",
        setup: () => {
          const gm = new GraphManager();
          const n1 = gm.addNode({ x: 50, y: 50 });
          const e1 = gm.addEdge(n1, n1, 'M50,50 L150,50 L150,150 L50,150 Z');
          gm.addFace([{ id: e1, reversed: true }]);

          const main = new paper.Path.Rectangle({ point: [50, 50], size: [100, 100], insert: false });
          const result = generateConnectorPath(main, 0, 0.5, 20, -15, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0);
          const sub = new paper.CompoundPath({ pathData: result.pathData, insert: false });
          
          gm.spliceEdge(e1, sub);
          
          const face = Object.values(gm.getFaces())[0] as any;
          const path = new paper.Path();
          face.edges.forEach((fe: any) => {
            const edge = gm.getEdges()[fe.id];
            const tmp = edge.path.clone({ insert: false });
            if (fe.reversed) tmp.reverse();
            path.addSegments(tmp.segments);
            tmp.remove();
          });
          path.closed = true;
          
          const res = { main: path, sub, p1: result.p1, p2: result.p2, mainPathIndex: 0 };
          main.remove();
          return res;
        }
      },
      {
        name: "Donut (Graph)",
        description: "Connector on a hole using GraphManager.",
        setup: () => {
          const gm = new GraphManager();
          // Outer circle
          const n1 = gm.addNode({ x: 20, y: 100 });
          const e1 = gm.addEdge(n1, n1, 'M20,100 A80,80 0 1,1 180,100 A80,80 0 1,1 20,100 Z');
          gm.addFace([{ id: e1, reversed: true }]);
          
          // Inner circle (hole)
          const n2 = gm.addNode({ x: 60, y: 100 });
          const e2 = gm.addEdge(n2, n2, 'M60,100 A40,40 0 1,0 140,100 A40,40 0 1,0 60,100 Z');
          gm.addFace([{ id: e2, reversed: false }]); // Hole is CCW

          const outer = new paper.Path.Circle({ center: [100, 100], radius: 80, insert: false });
          const inner = new paper.Path.Circle({ center: [100, 100], radius: 40, insert: false });
          inner.reverse();
          const main = new paper.CompoundPath({ children: [outer, inner], insert: false });
          
          const result = generateConnectorPath(main, 1, 0.5, 20, -15, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0);
          const sub = new paper.CompoundPath({ pathData: result.pathData, insert: false });
          
          gm.spliceEdge(e2, sub);
          
          // Reconstruct the compound path from faces
          const paths = Object.values(gm.getFaces()).map(face => {
            const p = new paper.Path();
            face.edges.forEach((fe: any) => {
              const edge = gm.getEdges()[fe.id];
              const tmp = edge.path.clone({ insert: false });
              if (fe.reversed) tmp.reverse();
              p.addSegments(tmp.segments);
              tmp.remove();
            });
            p.closed = true;
            return p;
          });
          
          const res = { main: new paper.CompoundPath({ children: paths, insert: false }), sub, p1: result.p1, p2: result.p2, mainPathIndex: 1 };
          main.remove();
          return res;
        }
      }
    ];

    try {
      const results = testCases.map(tc => {
        const { main, sub, p1, p2, mainPathIndex } = tc.setup();
        
        // Find if the target sub-path is clockwise
        let wasClockwise = true;
        if (main instanceof paper.CompoundPath) {
          const children = main.children.filter(c => c instanceof paper.Path) as paper.Path[];
          const idx = mainPathIndex ?? 0;
          if (children[idx]) wasClockwise = children[idx].clockwise;
        } else {
          wasClockwise = (main as paper.Path).clockwise;
        }

        const merged = mergePathsAtPoints(main, sub, p1, p2, mainPathIndex);
        
        const res = {
          name: tc.name,
          pathData: merged.pathData,
          originalMain: main.pathData,
          originalSub: sub.pathData,
          p1: [p1.x, p1.y] as [number, number],
          p2: [p2.x, p2.y] as [number, number],
          wasClockwise
        };

        main.remove();
        sub.remove();
        merged.remove();
        return res;
      });

      setTestResults(results);
      setError(null);
    } catch (e) {
      console.error("Debug tests failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  useEffect(() => {
    runLiveTest();
  }, [liveParams]);

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Bug className="w-8 h-8 text-indigo-600" />
                V3 Path Merging Debug
              </h1>
              <p className="text-slate-500">Testing <code>mergePathsAtPoints</code> with various geometries and winding orders.</p>
            </div>
          </div>
          <button 
            onClick={runTests}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <RefreshCw className="w-4 h-4" />
            Re-run Static Tests
          </button>
        </header>

        {/* V5 Graph Engine Scenarios */}
        <section className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-purple-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">V5 Graph Engine Scenarios</h2>
              <p className="text-sm text-slate-500">Testing core graph operations: splicing, whimsies, and connectors.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <button
                  key={i}
                  onClick={() => runV5Scenario(i)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${v5Scenario === i ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  Scenario {i}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8 flex flex-col lg:flex-row gap-8">
            <div className="flex-1 aspect-square bg-slate-50 rounded-2xl border border-slate-200 relative overflow-hidden flex items-center justify-center">
              {v5Graph ? (
                <svg viewBox="0 0 250 250" className="w-full h-full p-4">
                  <defs>
                    <pattern id="grid-v5" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="250" height="250" fill="url(#grid-v5)" />
                  
                  {/* Faces */}
                  {Object.values(v5Graph.faces).map((face: any) => {
                    const path = new paper.Path();
                    face.edges.forEach((fe: any) => {
                      const edge = v5Graph.edges[fe.id];
                      if (!edge) return;
                      const tmp = edge.path.clone({ insert: false });
                      if (fe.reversed) tmp.reverse();
                      path.addSegments(tmp.segments);
                      tmp.remove();
                    });
                    path.closed = true;
                    const d = path.pathData;
                    path.remove();
                    return (
                      <path 
                        key={face.id} 
                        d={d} 
                        fill={face.color} 
                        fillOpacity="0.3" 
                        stroke="none"
                        fillRule="evenodd"
                      />
                    );
                  })}

                  {/* Edges */}
                  {Object.values(v5Graph.edges).map((edge: any) => (
                    <path 
                      key={edge.id} 
                      d={edge.path.pathData} 
                      fill="none" 
                      stroke="#4f46e5" 
                      strokeWidth="2" 
                      strokeLinecap="round"
                    />
                  ))}

                  {/* Nodes */}
                  {Object.values(v5Graph.nodes).map((node: any) => (
                    <circle 
                      key={node.id} 
                      cx={node.point.x} 
                      cy={node.point.y} 
                      r="3" 
                      fill="#ef4444" 
                    />
                  ))}
                </svg>
              ) : (
                <div className="text-slate-400 text-center">
                  <Layers className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>Select a scenario to visualize the graph</p>
                </div>
              )}
            </div>

            <div className="w-full lg:w-80 space-y-4">
              <div className="bg-slate-900 rounded-xl p-4 text-[10px] font-mono text-slate-400 h-[400px] overflow-y-auto relative group">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-white font-bold uppercase tracking-widest text-[11px]">Graph State</h3>
                  <button 
                    onClick={() => {
                      const serializable = {
                        ...v5Graph,
                        edges: Object.fromEntries(
                          Object.entries(v5Graph.edges).map(([id, e]: [string, any]) => [
                            id, 
                            { ...e, pathData: e.path.pathData, path: undefined }
                          ])
                        )
                      };
                      navigator.clipboard.writeText(JSON.stringify(serializable, null, 2));
                      alert('Graph state copied to clipboard');
                    }}
                    className="px-2 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Copy JSON
                  </button>
                </div>
                {v5Graph ? (
                  <pre>{JSON.stringify({
                    ...v5Graph,
                    edges: Object.fromEntries(
                      Object.entries(v5Graph.edges).map(([id, e]: [string, any]) => [
                        id, 
                        { ...e, pathData: e.path.pathData, path: undefined }
                      ])
                    )
                  }, null, 2)}</pre>
                ) : (
                  <p>No graph data</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Live Debug Section */}
        <section className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Live Interactive Debug</h2>
              <p className="text-sm text-slate-500">Tweak parameters in real-time to see how the merge behaves.</p>
            </div>
            <div className="flex gap-2">
              {(['square', 'circle', 'donut', 'square-hole', 'square-2-holes'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setLiveParams(p => ({ ...p, shape: s, pathIndex: (s === 'donut' || s === 'square-hole' || s === 'square-2-holes') ? 1 : 0 }))}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${liveParams.shape === s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  {s.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-0">
            {/* Controls */}
            <div className="p-8 space-y-6 border-r border-slate-100">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Position (midT)</label>
                  <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{liveParams.midT.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.01" 
                  value={liveParams.midT} 
                  onChange={e => setLiveParams(p => ({ ...p, midT: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Extrusion</label>
                  <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{liveParams.extrusion}px</span>
                </div>
                <input 
                  type="range" min="-50" max="50" step="1" 
                  value={liveParams.extrusion} 
                  onChange={e => setLiveParams(p => ({ ...p, extrusion: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-[10px] text-slate-400 italic">Positive = Outward (CW) / Inward (CCW)</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Width</label>
                  <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{liveParams.width}px</span>
                </div>
                <input 
                  type="range" min="5" max="60" step="1" 
                  value={liveParams.width} 
                  onChange={e => setLiveParams(p => ({ ...p, width: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Head Type</label>
                  <select 
                    value={liveParams.headType}
                    onChange={e => setLiveParams(p => ({ ...p, headType: e.target.value as any }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                    <option value="star">Star</option>
                    <option value="triangle">Triangle</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Direction</label>
                  <select 
                    value={liveParams.direction}
                    onChange={e => setLiveParams(p => ({ ...p, direction: e.target.value as any }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="out">Outward</option>
                    <option value="in">Inward</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {liveParams.shape === 'donut' ? 'Target Circle' : 'Path Index'}
                </label>
                {liveParams.shape === 'donut' ? (
                  <select 
                    value={liveParams.pathIndex}
                    onChange={e => setLiveParams(p => ({ ...p, pathIndex: parseInt(e.target.value) }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={0}>Outer Circle</option>
                    <option value={1}>Inner Circle</option>
                  </select>
                ) : (
                  <input 
                    type="number" min="0" max="2"
                    value={liveParams.pathIndex} 
                    onChange={e => setLiveParams(p => ({ ...p, pathIndex: parseInt(e.target.value) }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
            </div>

            {/* Visualization */}
            <div className="lg:col-span-2 bg-slate-50/50 p-8 flex items-center justify-center min-h-[400px]">
              {liveResult ? (
                <div className="w-full max-w-md aspect-square bg-white rounded-2xl shadow-inner border border-slate-100 relative group">
                  <svg viewBox="0 0 200 200" className="w-full h-full p-8 drop-shadow-2xl">
                    <defs>
                      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f1f5f9" strokeWidth="0.5"/>
                      </pattern>
                    </defs>
                    <rect width="200" height="200" fill="url(#grid)" />
                    
                    {/* Original Main (Ghost) */}
                    <path 
                      d={liveResult.originalMain} 
                      fill="none" 
                      stroke="#e2e8f0" 
                      strokeWidth="1" 
                      strokeDasharray="4 2"
                    />
                    
                    {/* Merged Result */}
                    <path 
                      d={liveResult.pathData} 
                      fill="#6366f1" 
                      fillOpacity="0.15" 
                      stroke="#4f46e5" 
                      strokeWidth="2.5" 
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />

                    {/* Connector Outline (Ghost) */}
                    <path 
                      d={liveResult.originalSub} 
                      fill="none" 
                      stroke="#f43f5e" 
                      strokeWidth="1" 
                      strokeDasharray="2 2"
                      opacity="0.4"
                    />

                    {/* Debug Points */}
                    <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <circle cx={liveResult.p1[0]} cy={liveResult.p1[1]} r="4" fill="#ef4444" className="animate-pulse" />
                      <text x={liveResult.p1[0] + 6} y={liveResult.p1[1] - 6} fontSize="10" fill="#ef4444" fontWeight="bold">p1</text>
                      
                      <circle cx={liveResult.p2[0]} cy={liveResult.p2[1]} r="4" fill="#10b981" className="animate-pulse" />
                      <text x={liveResult.p2[0] + 6} y={liveResult.p2[1] - 6} fontSize="10" fill="#10b981" fontWeight="bold">p2</text>
                    </g>
                  </svg>
                  
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest shadow-sm ${liveResult.wasClockwise ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}>
                      {liveResult.wasClockwise ? 'Solid (CW)' : 'Hole (CCW)'}
                    </span>
                    <div className="text-[10px] font-mono text-slate-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-100">
                      p1: {liveResult.p1[0].toFixed(1)}, {liveResult.p1[1].toFixed(1)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
                  <span className="text-sm font-medium">Computing live result...</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Result Path Data</span>
              <button 
                onClick={() => navigator.clipboard.writeText(liveResult?.pathData || '')}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
            <div className="text-[10px] font-mono text-slate-400 break-all max-h-24 overflow-y-auto">
              {liveResult?.pathData || 'No result'}
            </div>
          </div>
        </section>
        
        {/* Selection Visuals Debug Section */}
        <section className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800">Selection Visuals Debug</h2>
            <p className="text-sm text-slate-500">Test and refine the selection appearance.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-0">
            <div className="p-8 space-y-6 border-r border-slate-100">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Overlay Opacity</label>
                  <span className="text-xs font-mono text-indigo-600">{selectionDebug.overlayOpacity}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={selectionDebug.overlayOpacity}
                  onChange={e => setSelectionDebug(p => ({ ...p, overlayOpacity: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stroke Width</label>
                  <span className="text-xs font-mono text-indigo-600">{selectionDebug.strokeWidth}px</span>
                </div>
                <input 
                  type="range" min="1" max="10" step="1" 
                  value={selectionDebug.strokeWidth}
                  onChange={e => setSelectionDebug(p => ({ ...p, strokeWidth: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Glow Intensity</label>
                  <span className="text-xs font-mono text-indigo-600">{selectionDebug.glowIntensity}</span>
                </div>
                <input 
                  type="range" min="0" max="20" step="1" 
                  value={selectionDebug.glowIntensity}
                  onChange={e => setSelectionDebug(p => ({ ...p, glowIntensity: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dash Length</label>
                  <span className="text-xs font-mono text-indigo-600">{selectionDebug.dashLength}</span>
                </div>
                <input 
                  type="range" min="2" max="20" step="1" 
                  value={selectionDebug.dashLength}
                  onChange={e => setSelectionDebug(p => ({ ...p, dashLength: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-slate-50/50 p-8 flex items-center justify-center">
              <div className="w-full max-w-md aspect-square bg-white rounded-2xl shadow-inner border border-slate-100 relative p-8">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <defs>
                    <filter id="debug-selection-glow" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur in="SourceAlpha" stdDeviation={selectionDebug.glowIntensity} />
                      <feFlood floodColor="#4f46e5" floodOpacity="0.6" />
                      <feComposite operator="in" in2="SourceAlpha" />
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="debug-inner-shadow">
                      <feComponentTransfer in="SourceAlpha">
                        <feFuncA type="table" tableValues="1 0" />
                      </feComponentTransfer>
                      <feGaussianBlur stdDeviation="3" />
                      <feOffset dx="0" dy="0" result="offsetblur" />
                      <feFlood floodColor="black" floodOpacity="0.5" result="color" />
                      <feComposite in2="offsetblur" operator="in" />
                      <feComposite in2="SourceAlpha" operator="in" />
                      <feMerge>
                        <feMergeNode in="SourceGraphic" />
                        <feMergeNode />
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Sample Piece */}
                  <path
                    d="M 50 50 L 150 50 L 150 150 L 50 150 Z"
                    fill="#e2e8f0"
                    stroke="#1e1b4b"
                    strokeWidth={selectionDebug.strokeWidth}
                    strokeLinejoin="round"
                    filter="url(#debug-selection-glow)"
                  />
                  
                  {/* Overlay */}
                  <path
                    d="M 50 50 L 150 50 L 150 150 L 50 150 Z"
                    fill={`rgba(30, 27, 75, ${selectionDebug.overlayOpacity})`}
                    filter="url(#debug-inner-shadow)"
                  />
                  
                  {/* Dashes */}
                  <path
                    d="M 50 50 L 150 50 L 150 150 L 50 150 Z"
                    fill="none"
                    stroke={selectionDebug.blueColor}
                    strokeWidth={selectionDebug.strokeWidth * 0.6}
                    strokeDasharray={`${selectionDebug.dashLength} ${selectionDebug.dashLength}`}
                  />
                  <path
                    d="M 50 50 L 150 50 L 150 150 L 50 150 Z"
                    fill="none"
                    stroke={selectionDebug.purpleColor}
                    strokeWidth={selectionDebug.strokeWidth * 0.6}
                    strokeDasharray={`${selectionDebug.dashLength} ${selectionDebug.dashLength}`}
                    strokeDashoffset={selectionDebug.dashLength}
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Whimsy Insertion Test Section */}
        <section className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Whimsy Insertion Test</h2>
              <p className="text-sm text-slate-500">Test how whimsies (especially donuts) are inserted and split.</p>
            </div>
            <div className="flex gap-2">
              {(['donut', 'fish', 'bone', 'snowman', 'hexagon', 'spiral'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setLiveParams(p => ({ ...p, headType: t as any }))}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${liveParams.headType === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-8 flex flex-col items-center gap-6">
            <div className="w-full max-w-2xl aspect-video bg-slate-50 rounded-2xl border border-slate-200 relative overflow-hidden flex items-center justify-center">
              <svg viewBox="0 0 400 225" className="w-full h-full">
                <defs>
                  <pattern id="grid-debug" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="400" height="225" fill="url(#grid-debug)" />
                
                {/* We'll simulate the insertion here */}
                {(() => {
                  const templateId = liveParams.headType as any;
                  const stem = getWhimsyTemplatePathData(templateId);
                  
                  // Create a mock piece (a large rectangle)
                  const pieceRect = new paper.Path.Rectangle({
                    point: [50, 25],
                    size: [300, 175],
                    insert: false
                  });
                  
                  const whimsyPath = new paper.CompoundPath({
                    pathData: stem,
                    insert: false
                  });
                  whimsyPath.scale(60, new paper.Point(0, 0));
                  const wb = whimsyPath.bounds;
                  whimsyPath.translate(new paper.Point(
                    200 - (wb.x + wb.width / 2),
                    112.5 - (wb.y + wb.height / 2)
                  ));
                  
                  // Perform subtraction
                  const subtracted = pieceRect.subtract(whimsyPath);
                  
                  // Get components of the subtracted piece
                  const components = getDisconnectedComponents(subtracted);
                  
                  // Get components of the whimsy itself
                  const whimsyComponents = getDisconnectedComponents(whimsyPath);
                  
                  const result = (
                    <g>
                      {/* Subtracted Piece */}
                      {components.map((comp, i) => (
                        <path 
                          key={`piece-${i}`}
                          d={comp.pathData}
                          fill="#f1f5f9"
                          stroke="#94a3b8"
                          strokeWidth="1"
                          fillRule="evenodd"
                        />
                      ))}
                      
                      {/* Whimsy Piece */}
                      {whimsyComponents.map((comp, i) => (
                        <path 
                          key={`whimsy-${i}`}
                          d={comp.pathData}
                          fill="#6366f1"
                          fillOpacity="0.2"
                          stroke="#4f46e5"
                          strokeWidth="2"
                          fillRule="evenodd"
                        />
                      ))}
                    </g>
                  );
                  
                  pieceRect.remove();
                  whimsyPath.remove();
                  subtracted.remove();
                  components.forEach(c => c.remove());
                  whimsyComponents.forEach(c => c.remove());
                  
                  return result;
                })()}
              </svg>
            </div>
            <div className="text-sm text-slate-500 max-w-xl text-center">
              This visualization shows the result of <code>piece.subtract(whimsy)</code> and then <code>getDisconnectedComponents()</code>. 
              If the donut hole is preserved, you should see the center of the donut as empty space (the background grid).
            </div>
          </div>
        </section>

        <div className="pt-8 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Static Regression Tests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testResults.map((res, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-xl shadow-slate-200 overflow-hidden border border-slate-100 flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800">{res.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${res.wasClockwise ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {res.wasClockwise ? 'Clockwise (Solid)' : 'Counter-CW (Hole)'}
                    </span>
                  </div>
                </div>
                
                <div className="relative aspect-square bg-slate-50 p-4">
                  <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-sm">
                    {/* Original Main (Ghost) */}
                    <path 
                      d={res.originalMain} 
                      fill="none" 
                      stroke="#e2e8f0" 
                      strokeWidth="1" 
                      strokeDasharray="4 2"
                    />
                    
                    {/* Merged Result */}
                    <path 
                      d={res.pathData} 
                      fill="#6366f1" 
                      fillOpacity="0.1" 
                      stroke="#4f46e5" 
                      strokeWidth="2" 
                      strokeLinejoin="round"
                    />

                    {/* Connector Outline (Ghost) */}
                    <path 
                      d={res.originalSub} 
                      fill="none" 
                      stroke="#f43f5e" 
                      strokeWidth="1" 
                      strokeDasharray="2 2"
                      opacity="0.5"
                    />

                    {/* Debug Points */}
                    <circle cx={res.p1[0]} cy={res.p1[1]} r="3" fill="#ef4444" />
                    <text x={res.p1[0] + 5} y={res.p1[1] - 5} fontSize="8" fill="#ef4444" fontWeight="bold">p1</text>
                    
                    <circle cx={res.p2[0]} cy={res.p2[1]} r="3" fill="#10b981" />
                    <text x={res.p2[0] + 5} y={res.p2[1] - 5} fontSize="8" fill="#10b981" fontWeight="bold">p2</text>
                  </svg>
                </div>

                <div className="p-4 bg-slate-900 text-[10px] font-mono text-slate-400 overflow-auto max-h-32">
                  <div className="text-slate-500 mb-1 uppercase tracking-widest text-[8px]">Path Data Snippet</div>
                  {res.pathData.substring(0, 200)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
