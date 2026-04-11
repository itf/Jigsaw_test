import React, { useEffect, useRef, useState } from 'react';
import paper from 'paper';
import { mergePathsAtPoints } from '../utils/pathMergeUtils';
import { generateConnectorPath } from '../utils/connectorUtils';
import { getDisconnectedComponents } from '../utils/puzzleValidation';
import { getWhimsyTemplatePathData } from '../utils/whimsyGallery';
import { NeckShape } from '../types';
import { ChevronLeft, Bug, Info, RefreshCw } from 'lucide-react';

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

export default function V3DebugPage({ onBack }: { onBack: () => void }) {
  const [testResults, setTestResults] = useState<{ name: string; pathData: string; originalMain: string; originalSub: string; p1: [number, number]; p2: [number, number]; wasClockwise: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

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

    let main: paper.PathItem;
    if (liveParams.shape === 'square') {
      main = new paper.Path.Rectangle({ point: [50, 50], size: [100, 100], insert: false });
    } else if (liveParams.shape === 'circle') {
      main = new paper.Path.Circle({ center: [100, 100], radius: 60, insert: false });
    } else if (liveParams.shape === 'donut') {
      const outer = new paper.Path.Circle({ center: [100, 100], radius: 80, insert: false });
      const inner = new paper.Path.Circle({ center: [100, 100], radius: 40, insert: false });
      inner.reverse();
      main = new paper.CompoundPath({ children: [outer, inner], insert: false });
    } else if (liveParams.shape === 'square-hole') {
      const outer = new paper.Path.Rectangle({ point: [20, 20], size: [160, 160], insert: false });
      const inner = new paper.Path.Rectangle({ point: [60, 60], size: [80, 80], insert: false });
      inner.reverse();
      main = new paper.CompoundPath({ children: [outer, inner], insert: false });
    } else {
      const outer = new paper.Path.Rectangle({ point: [10, 10], size: [180, 180], insert: false });
      const hole1 = new paper.Path.Circle({ center: [60, 100], radius: 30, insert: false });
      hole1.reverse();
      const hole2 = new paper.Path.Circle({ center: [140, 100], radius: 30, insert: false });
      hole2.reverse();
      main = new paper.CompoundPath({ children: [outer, hole1, hole2], insert: false });
    }

    try {
      const result = generateConnectorPath(
        main, liveParams.pathIndex, liveParams.midT, liveParams.width, liveParams.extrusion, 
        liveParams.headType, liveParams.headScale, liveParams.headRotation, true, [], 0, 0, 
        NeckShape.STANDARD, 0, 0
      );
      
      const sub = new paper.CompoundPath({ pathData: result.pathData, insert: false });
      
      let wasClockwise = true;
      if (main instanceof paper.CompoundPath) {
        const children = main.children.filter(c => c instanceof paper.Path) as paper.Path[];
        if (children[liveParams.pathIndex]) wasClockwise = children[liveParams.pathIndex].clockwise;
      } else {
        wasClockwise = (main as paper.Path).clockwise;
      }

      const merged = mergePathsAtPoints(main, sub, result.p1, result.p2, liveParams.pathIndex);
      
      setLiveResult({
        pathData: merged.pathData,
        originalMain: main.pathData,
        originalSub: sub.pathData,
        p1: [result.p1.x, result.p1.y],
        p2: [result.p2.x, result.p2.y],
        wasClockwise
      });

      main.remove();
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
        name: "Square Piece + Square Connector",
        description: "Simple merge of a square connector into a square piece.",
        setup: () => {
          const main = new paper.Path.Rectangle({
            point: [50, 50],
            size: [100, 100],
            insert: false
          });
          main.name = "Square Piece";
          
          const result = generateConnectorPath(
            main, 0, 0.5, 20, 15, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          
          const sub = new paper.CompoundPath({
            pathData: result.pathData,
            insert: false
          });
          
          return { main, sub, p1: result.p1, p2: result.p2, mainPathIndex: 0 };
        }
      },
      {
        name: "Circular Piece + Square Connector",
        description: "Merging into a curved boundary.",
        setup: () => {
          const main = new paper.Path.Circle({
            center: [100, 100],
            radius: 50,
            insert: false
          });
          main.name = "Circular Piece";
          
          const result = generateConnectorPath(
            main, 0, 0.25, 20, 15, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          
          const sub = new paper.CompoundPath({
            pathData: result.pathData,
            insert: false
          });
          
          return { main, sub, p1: result.p1, p2: result.p2, mainPathIndex: 0 };
        }
      },
      {
        name: "Square with Square Hole (Inward)",
        description: "Connector pointing into a hole. Tests CCW winding handling.",
        setup: () => {
          const outer = new paper.Path.Rectangle({
            point: [20, 20],
            size: [160, 160],
            insert: false
          });
          const inner = new paper.Path.Rectangle({
            point: [60, 60],
            size: [80, 80],
            insert: false
          });
          inner.reverse(); // Ensure it's a hole (CCW)
          
          const main = new paper.CompoundPath({
            children: [outer, inner],
            insert: false
          });
          main.name = "Square with Hole";
          
          // Connector on the hole (index 1), pointing INWARDS (towards the hole center)
          // For both CW and CCW paths, positive extrusion points OUT.
          // So to point INTO the hole, we need NEGATIVE extrusion.
          const result = generateConnectorPath(
            main, 1, 0.5, 20, -15, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          
          const sub = new paper.CompoundPath({
            pathData: result.pathData,
            insert: false
          });
          
          return { main, sub, p1: result.p1, p2: result.p2, mainPathIndex: 1 };
        }
      },
      {
        name: "Donut (Circle Hole, Inward)",
        description: "Circular hole with inward connector.",
        setup: () => {
          const outer = new paper.Path.Circle({
            center: [100, 100],
            radius: 80,
            insert: false
          });
          const inner = new paper.Path.Circle({
            center: [100, 100],
            radius: 40,
            insert: false
          });
          inner.reverse();
          
          const main = new paper.CompoundPath({
            children: [outer, inner],
            insert: false
          });
          main.name = "Donut";
          
          const result = generateConnectorPath(
            main, 1, 0.75, 20, -15, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          
          const sub = new paper.CompoundPath({
            pathData: result.pathData,
            insert: false
          });
          
          return { main, sub, p1: result.p1, p2: result.p2, mainPathIndex: 1 };
        }
      },
      {
        name: "Square with 2 Holes (In & Out)",
        description: "Multiple holes, connectors pointing both ways.",
        setup: () => {
          const outer = new paper.Path.Rectangle({
            point: [10, 10],
            size: [180, 180],
            insert: false
          });
          const hole1 = new paper.Path.Circle({
            center: [60, 100],
            radius: 30,
            insert: false
          });
          hole1.reverse();
          const hole2 = new paper.Path.Circle({
            center: [140, 100],
            radius: 30,
            insert: false
          });
          hole2.reverse();
          
          const main = new paper.CompoundPath({
            children: [outer, hole1, hole2],
            insert: false
          });
          main.name = "Square with 2 Holes";
          
          // Connector on hole 1 pointing IN
          const result1 = generateConnectorPath(
            main, 1, 0.5, 15, -10, 'circle', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          const sub1 = new paper.CompoundPath({ pathData: result1.pathData, insert: false });
          
          // Merge first one
          const intermediate = mergePathsAtPoints(main, sub1, result1.p1, result1.p2, 1);
          
          // Connector on hole 2 pointing OUT (into the solid part)
          const result2 = generateConnectorPath(
            intermediate, 2, 0.5, 15, 10, 'circle', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          const sub2 = new paper.CompoundPath({ pathData: result2.pathData, insert: false });
          
          return { main: intermediate, sub: sub2, p1: result2.p1, p2: result2.p2, mainPathIndex: 2 };
        }
      },
      {
        name: "Donut (User Reported Issue)",
        description: "midT: 0.23, extrusion: 36, width: 30. Tests for debris and arc artifacts.",
        setup: () => {
          const outer = new paper.Path.Circle({ center: [100, 100], radius: 80, insert: false });
          const inner = new paper.Path.Circle({ center: [100, 100], radius: 40, insert: false });
          inner.reverse();
          
          const main = new paper.CompoundPath({
            children: [outer, inner],
            insert: false
          });
          main.name = "Donut Debug";
          
          const result = generateConnectorPath(
            main, 1, 0.23, 30, 36, 'triangle', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          
          const sub = new paper.CompoundPath({
            pathData: result.pathData,
            insert: false
          });
          
          return { main, sub, p1: result.p1, p2: result.p2, mainPathIndex: 1 };
        }
      },
      {
        name: "Donut (Arc Artifact Case)",
        description: "midT: 0.70, extrusion: 28, width: 35. Tests for circle arc staying under connector.",
        setup: () => {
          const outer = new paper.Path.Circle({ center: [100, 100], radius: 80, insert: false });
          const inner = new paper.Path.Circle({ center: [100, 100], radius: 60, insert: false });
          inner.reverse();
          
          const main = new paper.CompoundPath({
            children: [outer, inner],
            insert: false
          });
          main.name = "Donut Arc Debug";
          
          const result = generateConnectorPath(
            main, 1, 0.70, 35, 28, 'square', 1, 0, true, [], 0, 0, NeckShape.STANDARD, 0, 0
          );
          
          const sub = new paper.CompoundPath({
            pathData: result.pathData,
            insert: false
          });
          
          return { main, sub, p1: result.p1, p2: result.p2, mainPathIndex: 1 };
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Path Index</label>
                  <input 
                    type="number" min="0" max="2"
                    value={liveParams.pathIndex} 
                    onChange={e => setLiveParams(p => ({ ...p, pathIndex: parseInt(e.target.value) }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
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
