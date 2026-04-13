import { useState, useCallback } from 'react';
import paper from 'paper';
import {
  PuzzleState, Node, Edge, Face, FloatingWhimsy, ConnectorV5, NeckShape, Point
} from '../types';
import { GraphManager } from '../utils/GraphManager';
import { resetPaperProject } from '../utils/paperUtils';
import { getWhimsyTemplatePathData } from '../utils/whimsyGallery';

const FACE_COLORS = [
  '#e0f2fe', '#dcfce7', '#fef9c3', '#fee2e2', '#ede9fe', '#fce7f3',
  '#d1fae5', '#fde8c8', '#dbeafe', '#f0fdf4', '#fff7ed', '#f5f3ff',
];
let colorIdx = 0;
function nextColor(): string { return FACE_COLORS[colorIdx++ % FACE_COLORS.length]; }
function uid(prefix: string): string { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
function emptyState(): PuzzleState {
  return { nodes: {}, edges: {}, faces: {}, floatingWhimsies: [], connectors: {}, rootFaceId: '', width: 2000, height: 2000 };
}

export function usePuzzleEngineV5() {
  const [puzzleState, setPuzzleState] = useState<PuzzleState>(emptyState);

  const createRoot = useCallback((width: number, height: number, shape: 'RECT' | 'CIRCLE' | 'HEX') => {
    resetPaperProject(width, height);
    const nodes: Record<string, Node> = {};
    const edges: Record<string, Edge> = {};
    const faces: Record<string, Face> = {};
    colorIdx = 0;
    const rootFaceId = uid('face');
    const outerFaceId = 'outer';

    if (shape === 'RECT') {
      const n0 = uid('node'); const n1 = uid('node'); const n2 = uid('node'); const n3 = uid('node');
      nodes[n0] = { id: n0, point: { x: 0, y: 0 }, incidentEdges: [] };
      nodes[n1] = { id: n1, point: { x: width, y: 0 }, incidentEdges: [] };
      nodes[n2] = { id: n2, point: { x: width, y: height }, incidentEdges: [] };
      nodes[n3] = { id: n3, point: { x: 0, y: height }, incidentEdges: [] };
      const makeEdge = (from: string, to: string): string => {
        const id = uid('edge');
        const p = new paper.Path.Line(new paper.Point(nodes[from].point.x, nodes[from].point.y), new paper.Point(nodes[to].point.x, nodes[to].point.y));
        edges[id] = { id, fromNode: from, toNode: to, path: p, leftFace: rootFaceId, rightFace: outerFaceId };
        nodes[from].incidentEdges.push(id); nodes[to].incidentEdges.push(id); return id;
      };
      const e0 = makeEdge(n0, n1), e1 = makeEdge(n1, n2), e2 = makeEdge(n2, n3), e3 = makeEdge(n3, n0);
      faces[rootFaceId] = { id: rootFaceId, edges: [{id:e0,reversed:false},{id:e1,reversed:false},{id:e2,reversed:false},{id:e3,reversed:false}], color: nextColor(), groupMemberships: [] };
    } else {
      let shapePath: paper.Path;
      if (shape === 'CIRCLE') {
        shapePath = new paper.Path.Circle(new paper.Point(width/2, height/2), Math.min(width,height)/2);
      } else {
        shapePath = new paper.Path.RegularPolygon(new paper.Point(width/2, height/2), 6, Math.min(width,height)/2);
      }
      const segs = shapePath.segments;
      const nodeIds = segs.map(seg => { const nid=uid('node'); nodes[nid]={id:nid,point:{x:seg.point.x,y:seg.point.y},incidentEdges:[]}; return nid; });
      const edgeIds: string[] = [];
      for (let i=0; i<segs.length; i++) {
        const from=nodeIds[i], to=nodeIds[(i+1)%segs.length];
        const cp = new paper.Path(); cp.add(segs[i].clone()); cp.add(segs[(i+1)%segs.length].clone());
        const eid=uid('edge');
        edges[eid]={id:eid,fromNode:from,toNode:to,path:cp,leftFace:rootFaceId,rightFace:outerFaceId};
        nodes[from].incidentEdges.push(eid); nodes[to].incidentEdges.push(eid); edgeIds.push(eid);
      }
      faces[rootFaceId]={id:rootFaceId,edges:edgeIds.map(id=>({id,reversed:false})),color:nextColor(),groupMemberships:[]};
      shapePath.remove();
    }
    setPuzzleState({nodes,edges,faces,floatingWhimsies:[],connectors:{},rootFaceId,width,height});
  }, []);

  const subdivideGrid = useCallback((params: {parentId:string;pattern:'GRID'|'HEX'|'RANDOM';rows?:number;cols?:number;count?:number;jitter?:number}) => {
    setPuzzleState(prev => {
      const m = new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors);
      const {parentId,pattern,rows=4,cols=4,count=12,jitter=0}=params;
      if(pattern==='GRID') m.subdivideGrid(parentId,rows,cols);
      else if(pattern==='HEX') m.subdivideHex(parentId,rows,cols,jitter);
      else m.subdivideRandom(parentId,count,jitter);
      return {...prev,nodes:m.getNodes(),edges:m.getEdges(),faces:m.getFaces(),connectors:m.getConnectors()};
    });
  }, []);

  const mergePieces = useCallback((faceIds: string[]) => {
    setPuzzleState(prev => {
      const m = new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors);
      for(const edge of Object.values(prev.edges) as import('../types').Edge[]) {
        if(faceIds.includes(edge.leftFace)&&faceIds.includes(edge.rightFace)&&edge.leftFace!==edge.rightFace) m.deleteEdge(edge.id);
      }
      return {...prev,nodes:m.getNodes(),edges:m.getEdges(),faces:m.getFaces(),connectors:m.getConnectors()};
    });
  }, []);

  const placeFloatingWhimsy = useCallback((params:{templateId:string;center:Point;scale:number;rotationDeg:number}) => {
    const svgData=getWhimsyTemplatePathData(params.templateId as any);
    const fw:FloatingWhimsy={id:uid('floating-whimsy'),templateId:params.templateId,svgData,center:params.center,scale:params.scale,rotationDeg:params.rotationDeg};
    setPuzzleState(prev=>({...prev,floatingWhimsies:[...prev.floatingWhimsies,fw]}));
  }, []);

  const moveFloatingWhimsy = useCallback((id:string,center:Point) => {
    setPuzzleState(prev=>({...prev,floatingWhimsies:prev.floatingWhimsies.map(fw=>fw.id===id?{...fw,center}:fw)}));
  }, []);

  const mergeWhimsy = useCallback((whimsyId:string) => {
    setPuzzleState(prev => {
      const fw=prev.floatingWhimsies.find(w=>w.id===whimsyId);
      if(!fw) return prev;
      const rawPath=new paper.CompoundPath({pathData:fw.svgData,insert:false});
      const rb=rawPath.bounds;
      const sf=fw.scale/Math.max(rb.width,rb.height,1);
      rawPath.scale(sf,rawPath.position);
      rawPath.rotate(fw.rotationDeg,rawPath.position);
      rawPath.position=new paper.Point(fw.center.x,fw.center.y);
      const m=new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors);
      m.spliceWhimsy(fw,rawPath);
      rawPath.remove();
      return {...prev,nodes:m.getNodes(),edges:m.getEdges(),faces:m.getFaces(),connectors:m.getConnectors(),floatingWhimsies:prev.floatingWhimsies.filter(w=>w.id!==whimsyId)};
    });
  }, []);

  const addConnector = useCallback((params:{midEdgeId:string;midT:number;direction:'in'|'out';widthPx:number;extrusion:number;headTemplateId:string;headScale:number;headRotationDeg:number;useEquidistantHeadPoint?:boolean;jitter?:number;jitterSeed?:number;neckShape?:NeckShape;neckCurvature?:number;extrusionCurvature?:number}) => {
    setPuzzleState(prev => {
      if(!prev.edges[params.midEdgeId]) return prev;
      const m=new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors);
      const {p1,p2,replacedSegment}=m.computeConnectorEndpoints(params);
      const connector:ConnectorV5={id:uid('connector'),...params,p1,p2,replacedSegment};
      return {...prev,connectors:{...prev.connectors,[connector.id]:connector}};
    });
  }, []);

  const updateConnector = useCallback((id:string,updates:Partial<ConnectorV5>) => {
    setPuzzleState(prev => {
      const existing=prev.connectors[id]; if(!existing) return prev;
      const updated={...existing,...updates};
      if(updates.widthPx!==undefined||updates.direction!==undefined||updates.midEdgeId!==undefined||updates.midT!==undefined) {
        const m=new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors);
        const {p1,p2,replacedSegment}=m.computeConnectorEndpoints(updated);
        updated.p1=p1; updated.p2=p2; updated.replacedSegment=replacedSegment;
      }
      return {...prev,connectors:{...prev.connectors,[id]:updated}};
    });
  }, []);

  const removeConnector = useCallback((id:string) => {
    setPuzzleState(prev => { const {[id]:_,...rest}=prev.connectors; return {...prev,connectors:rest}; });
  }, []);

  const bakeConnectors = useCallback(() => {
    setPuzzleState(prev => {
      const m=new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors);
      m.bakeConnectors(prev.connectors);
      return {...prev,nodes:m.getNodes(),edges:m.getEdges(),faces:m.getFaces(),connectors:{}};
    });
  }, []);

  const splitFace = useCallback((faceId:string,nodeAId:string,nodeBId:string,pathData:string) => {
    setPuzzleState(prev => { const m=new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors); m.splitFace(faceId,nodeAId,nodeBId,pathData); return {...prev,nodes:m.getNodes(),edges:m.getEdges(),faces:m.getFaces(),connectors:m.getConnectors()}; });
  }, []);

  const splitFaceAtPoints = useCallback((faceId:string,ptA:Point,ptB:Point) => {
    setPuzzleState(prev => { const m=new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors); m.splitFaceAtPoints(faceId,ptA,ptB); return {...prev,nodes:m.getNodes(),edges:m.getEdges(),faces:m.getFaces(),connectors:m.getConnectors()}; });
  }, []);

  const deleteEdge = useCallback((edgeId:string) => {
    setPuzzleState(prev => { const m=new GraphManager(prev.nodes,prev.edges,prev.faces,prev.connectors); m.deleteEdge(edgeId); return {...prev,nodes:m.getNodes(),edges:m.getEdges(),faces:m.getFaces(),connectors:m.getConnectors()}; });
  }, []);

  const loadState = useCallback((state:PuzzleState) => { setPuzzleState(state); }, []);
  const reset = useCallback(() => { setPuzzleState(emptyState()); }, []);
  const validateGrid = useCallback(() => { console.log('V5: validateGrid stub'); }, []);
  const cleanPuzzle = useCallback(() => { console.log('V5: cleanPuzzle stub'); }, []);
  const addMassConnectors = useCallback((_params:any) => { console.log('V5: addMassConnectors stub'); }, []);
  const generateMassConnectors = useCallback((_params:any):Record<string,ConnectorV5>=>({}), []);
  const commitPreviewConnectors = useCallback((preview:Record<string,ConnectorV5>) => {
    setPuzzleState(prev=>({...prev,connectors:{...prev.connectors,...preview}}));
  }, []);
  const resolveConnectorConflicts = useCallback(() => { console.log('V5: resolveConnectorConflicts stub'); }, []);

  return {
    puzzleState, createRoot, subdivideGrid, mergePieces,
    placeFloatingWhimsy, moveFloatingWhimsy, mergeWhimsy,
    addConnector, updateConnector, removeConnector, bakeConnectors,
    splitFace, splitFaceAtPoints, deleteEdge,
    loadState, reset, validateGrid, cleanPuzzle,
    addMassConnectors, generateMassConnectors, commitPreviewConnectors, resolveConnectorConflicts,
  };
}
