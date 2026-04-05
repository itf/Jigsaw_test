import paper from 'paper';
import { TopologicalEngine } from '../topology_engine';
import { Area, AreaType } from '../types';

export interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  message: string;
}

export function runTopologicalTests(): TestResult[] {
  const results: TestResult[] = [];
  
  // Test 1: 3x3 Grid Merge
  try {
    const testEngine = new TopologicalEngine();
    const testWidth = 300;
    const testHeight = 300;
    
    const testAreas: Area[] = [];
    const dx = testWidth / 3;
    const dy = testHeight / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = c * dx;
        const y = r * dy;
        testAreas.push({
          id: `piece-${r}-${c}`,
          parentId: 'root',
          type: AreaType.SUBDIVISION,
          children: [],
          boundary: `M ${x} ${y} L ${x + dx} ${y} L ${x + dx} ${y + dy} L ${x} ${y + dy} Z`,
          seedPoint: { x: x + dx/2, y: y + dy/2 },
          isPiece: true,
          color: '#000'
        });
      }
    }
    
    testEngine.initializeFromVoronoi(testAreas, testWidth, testHeight);
    
    for (let i = 0; i < testAreas.length - 1; i++) {
      testEngine.mergeFaces(testAreas[i].id, testAreas[i+1].id);
    }
    
    const mergedPathData = testEngine.getMergedBoundary(testAreas.map(a => a.id));
    
    paper.setup(new paper.Size(testWidth, testHeight));
    const resultPath = new paper.Path(mergedPathData);
    const expectedPath = new paper.Path(`M 0 0 L 300 0 L 300 300 L 0 300 Z`);
    
    const isMatch = resultPath.bounds.equals(expectedPath.bounds) && Math.abs(resultPath.area - expectedPath.area) < 1;
    
    if (isMatch) {
      results.push({ name: '3x3 Grid Merge', status: 'PASS', message: 'All 9 pieces merged into a single outer boundary.' });
    } else {
      results.push({ name: '3x3 Grid Merge', status: 'FAIL', message: `Area match: ${isMatch}` });
    }
    
    resultPath.remove();
    expectedPath.remove();
  } catch (e) {
    results.push({ name: '3x3 Grid Merge', status: 'FAIL', message: `Error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // Test 2: Connector Integration
  try {
    const testEngine = new TopologicalEngine();
    const testWidth = 200;
    const testHeight = 100;
    
    const areaA: Area = {
      id: 'A', parentId: 'root', type: AreaType.SUBDIVISION, children: [],
      boundary: `M 0 0 L 100 0 L 100 100 L 0 100 Z`,
      seedPoint: { x: 50, y: 50 }, isPiece: true, color: '#f00'
    };
    const areaB: Area = {
      id: 'B', parentId: 'root', type: AreaType.SUBDIVISION, children: [],
      boundary: `M 100 0 L 200 0 L 200 100 L 100 100 Z`,
      seedPoint: { x: 150, y: 50 }, isPiece: true, color: '#0f0'
    };
    
    testEngine.initializeFromVoronoi([areaA, areaB], testWidth, testHeight);
    
    const edges = testEngine.findEdgesBetweenFaces('A', 'B');
    if (edges.length === 0) throw new Error("Could not find edge between A and B");
    
    const stampData = "M 100 40 L 110 50 L 100 60 Z";
    testEngine.addConnectorToBoundary('A', 'B', 0.5, stampData, false, 'A');
    
    const boundaryA = testEngine.getMergedBoundary(['A']);
    const boundaryB = testEngine.getMergedBoundary(['B']);
    
    if (boundaryA.includes("110 50") && boundaryB.includes("110 50")) {
      results.push({ name: 'Connector Integration', status: 'PASS', message: 'Connector geometry present in both adjacent pieces.' });
    } else {
      results.push({ name: 'Connector Integration', status: 'FAIL', message: 'Connector geometry missing from piece boundaries.' });
    }
  } catch (e) {
    results.push({ name: 'Connector Integration', status: 'FAIL', message: `Error: ${e instanceof Error ? e.message : String(e)}` });
  }

  return results;
}
