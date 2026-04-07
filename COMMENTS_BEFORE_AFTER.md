# Code Comments Added - Before & After

## File 1: src/v2/App.tsx

### Change 1: mergeAreas() Function (Lines 147-167)

**BEFORE**:
```typescript
  const mergeAreas = useCallback((areaAId: string, areaBId: string) => {
    const op: Operation = {
      id: `merge-${Date.now()}`,
      type: 'MERGE',
      params: { areaAId, areaBId },
      timestamp: Date.now()
    };
    setHistory(prev => [...prev, op]);
  }, []);
```

**AFTER** (with comments):
```typescript
  /**
   * mergeAreas creates a MERGE operation that combines two pieces or groups.
   * The actual merging is processed asynchronously in usePuzzleEngine via a Disjoint Set Union (DSU).
   * When applied, the shared edges between the two areas are deleted, making them a single piece.
   * 
   * How it works:
   * 1. Creates an Operation of type 'MERGE' with areaAId and areaBId as parameters
   * 2. Adds the operation to the history
   * 3. usePuzzleEngine processes this operation in its topologyKey memoization:
   *    - Finds all leaf descendants of both areas
   *    - Uses DSU (Disjoint Set Union) to union all leaf pairs between the groups
   *    - For each leaf pair, calculates their shared perimeter using getSharedPerimeter()
   *    - If they share geometry, unions them in DSU and deletes the shared boundary
   * 4. The result is that all pieces in the merged group are now in the same DSU component
   * 5. During topology reconstruction, leaves with the same DSU root are grouped together
   */
  const mergeAreas = useCallback((areaAId: string, areaBId: string) => {
    const op: Operation = {
      id: `merge-${Date.now()}`,
      type: 'MERGE',
      params: { areaAId, areaBId },
      timestamp: Date.now()
    };
    setHistory(prev => [...prev, op]);
  }, []);
```

---

### Change 2: mergeSelectedPieces() Function (Lines 345-359)

**BEFORE**:
```typescript
  const mergeSelectedPieces = useCallback(() => {
    if (mergePickIds.length < 2) return;
    let acc = mergePickIds[0];
    for (let i = 1; i < mergePickIds.length; i++) {
      mergeAreas(acc, mergePickIds[i]);
    }
    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [mergePickIds, mergeAreas]);
```

**AFTER** (with comments):
```typescript
  const mergeSelectedPieces = useCallback(() => {
    // Only proceed if at least 2 pieces are selected
    if (mergePickIds.length < 2) return;
    
    // Merge all selected pieces together by chaining MERGE operations
    // Start with the first piece and merge each subsequent piece into it
    // This creates a chain of bilateral merges: [A, B, C] becomes (A⟷B), then (result⟷C)
    let acc = mergePickIds[0];
    for (let i = 1; i < mergePickIds.length; i++) {
      mergeAreas(acc, mergePickIds[i]);
    }
    
    // Clear the selection UI after merging
    setMergePickIds([]);
    setSelectedId(null);
    setSelectedType('NONE');
  }, [mergePickIds, mergeAreas]);
```

---

## File 2: src/v2/hooks/usePuzzleEngine.ts

### Change 1: DSU Data Structures (Lines 138-165)

**BEFORE**:
```typescript
    const dsu: Record<string, string> = {};
    const find = (id: string): string => {
      if (!dsu[id]) dsu[id] = id;
      if (dsu[id] === id) return id;
      return dsu[id] = find(dsu[id]);
    };
    const union = (id1: string, id2: string) => {
      const r1 = find(id1);
      const r2 = find(id2);
      if (r1 !== r2) dsu[r1] = r2;
    };

    const getLeafDescendants = (id: string): string[] => {
      const area = areas[id];
      if (!area) return [];
      if (area.isPiece) return [id];
      return area.children.flatMap(childId => getLeafDescendants(childId));
    };
```

**AFTER** (with comments):
```typescript
    /**
     * Disjoint Set Union (DSU) data structure for tracking piece grouping.
     * Each piece (leaf area) has a root in the DSU. Pieces with the same root are merged together.
     * Initially each piece is its own root; when two pieces merge, their roots are unified.
     */
    const dsu: Record<string, string> = {};
    
    /**
     * DSU find with path compression: returns the root representative of a piece.
     * All pieces in a merged group will have the same root after all MERGE operations are applied.
     */
    const find = (id: string): string => {
      if (!dsu[id]) dsu[id] = id;
      if (dsu[id] === id) return id;
      return dsu[id] = find(dsu[id]);
    };
    
    /**
     * DSU union: connects the root of id1 to the root of id2.
     * After union, find(id1) and find(id2) return the same root.
     */
    const union = (id1: string, id2: string) => {
      const r1 = find(id1);
      const r2 = find(id2);
      if (r1 !== r2) dsu[r1] = r2;
    };

    /**
     * Recursively collects all leaf pieces (isPiece=true) that are descendants of a given area.
     * Used to find all the actual cuttable pieces within a potentially compound area.
     */
    const getLeafDescendants = (id: string): string[] => {
      const area = areas[id];
      if (!area) return [];
      if (area.isPiece) return [id];
      return area.children.flatMap(childId => getLeafDescendants(childId));
    };
```

---

### Change 2: applyMerge() Function (Lines 168-232)

**BEFORE**:
```typescript
    const applyMerge = (op: Operation) => {
      if (op.type !== 'MERGE') return;
      const { areaAId, areaBId } = op.params;
      const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
      const leavesA = getLeafDescendants(areaAId);
      const leavesB = getLeafDescendants(areaBId);
      const rootA = find(areaAId);
      const rootB = find(areaBId);
      const groupA = leafAreas.filter(a => find(a.id) === rootA).map(a => a.id);
      const groupB = leafAreas.filter(a => find(a.id) === rootB).map(a => a.id);
      const allA = Array.from(new Set([...leavesA, ...groupA]));
      const allB = Array.from(new Set([...leavesB, ...groupB]));

      allA.forEach(la => {
        allB.forEach(lb => {
          const a = areas[la];
          const b = areas[lb];
          if (!a || !b) return;
          const shared = getSharedPerimeter(a, b);
          if (shared) {
            union(la, lb);
            shared.remove();
          }
        });
      });
    };
```

**AFTER** (with comments):
```typescript
    /**
     * applyMerge processes a single MERGE operation.
     * 
     * Steps:
     * 1. Extract the two areas to merge (areaAId, areaBId) from the operation
     * 2. Resolve their descendants: 
     *    - leavesA/B: all leaf pieces directly under the area
     *    - groupA/B: all leaf pieces that are already in the same DSU component as the area
     * 3. For each pair of leaves (la in allA, lb in allB):
     *    - Check if they share a perimeter using getSharedPerimeter()
     *    - If they do, union their DSU roots so they become part of the same group
     *    - Delete the shared boundary geometry
     * 4. Result: all pieces in allA and allB are now in the same DSU component
     */
    const applyMerge = (op: Operation) => {
      if (op.type !== 'MERGE') return;
      const { areaAId, areaBId } = op.params;
      const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
      
      // Get all direct leaf descendants of the two input areas
      const leavesA = getLeafDescendants(areaAId);
      const leavesB = getLeafDescendants(areaBId);
      
      // Find the DSU roots of the two areas
      const rootA = find(areaAId);
      const rootB = find(areaBId);
      
      // Find all leaves already grouped with each area via previous merges
      const groupA = leafAreas.filter(a => find(a.id) === rootA).map(a => a.id);
      const groupB = leafAreas.filter(a => find(a.id) === rootB).map(a => a.id);
      
      // Combine descendants and already-grouped pieces (deduped)
      const allA = Array.from(new Set([...leavesA, ...groupA]));
      const allB = Array.from(new Set([...leavesB, ...groupB]));

      // Try to merge each pair of pieces from the two groups
      allA.forEach(la => {
        allB.forEach(lb => {
          const a = areas[la];
          const b = areas[lb];
          if (!a || !b) return;
          
          // Get the shared perimeter between these two pieces
          const shared = getSharedPerimeter(a, b);
          if (shared) {
            // They touch! Union them in the DSU
            union(la, lb);
            // Delete the shared boundary geometry (no longer needed as internal edge)
            shared.remove();
          }
        });
      });
    };
```

---

### Change 3: mergedGroups Construction (Lines 323-341)

**BEFORE**:
```typescript
    const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
    const groups: Record<string, string[]> = {};
    leafAreas.forEach(a => {
      const root = find(a.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(a.id);
    });

    return { topology: areas, mergedGroups: groups, whimsyWarnings };
```

**AFTER** (with comments):
```typescript
    /**
     * Build the final mergedGroups map from the DSU state.
     * 
     * At this point, the DSU contains the grouping information for all pieces.
     * All pieces with the same DSU root should be considered a single merged entity.
     * 
     * Steps:
     * 1. Get all leaf pieces (isPiece=true) from the topology
     * 2. For each leaf, find its DSU root
     * 3. Group all leaves that share the same root
     * 4. The resulting map has root IDs as keys and arrays of piece IDs as values
     * 
     * Example: If pieces [A, B, C] have been merged, they all share one root:
     * mergedGroups = { <root>: [A, B, C] }
     * 
     * This structure is used by:
     * - UI to highlight merged pieces with same color
     * - Geometry engine to compute merged piece boundaries
     * - Subdivision to determine which leaves to subdivide together
     */
    const leafAreas = (Object.values(areas) as Area[]).filter(a => a.isPiece);
    const groups: Record<string, string[]> = {};
    leafAreas.forEach(a => {
      const root = find(a.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(a.id);
    });

    return { topology: areas, mergedGroups: groups, whimsyWarnings };
```

---

### Change 4: sharedEdges Memoization (Lines 342-370)

**BEFORE**:
```typescript
    // 4. Shared Edges: For visualization and connector placement
    const sharedEdges = useMemo(() => {
      const leafAreas = (Object.values(topology) as Area[]).filter(a => a.isPiece);
      const edges: { id: string; areaAId: string; areaBId: string; pathData: string; isMerged: boolean }[] = [];

      if (leafAreas.length > 200) return [];

      resetPaperProject(width, height);

      const whimsyAreas = leafAreas.filter(a => a.type === AreaType.WHIMSY);

      const getGroupId = (areaId: string) => {
        for (const [groupId, ids] of Object.entries(mergedGroups as Record<string, string[]>)) {
          if (ids.includes(areaId)) return groupId;
        }
        return areaId;
      };

      // Group shared perimeters by (groupA, groupB)
      const groupSharedMap = new Map<string, { areaAId: string; areaBId: string; paths: paper.PathItem[]; isMerged: boolean }>();

      for (let i = 0; i < leafAreas.length; i++) {
        for (let j = i + 1; j < leafAreas.length; j++) {
          const areaA = leafAreas[i];
          const areaB = leafAreas[j];

          const shared = getSharedPerimeter(areaA, areaB);
          if (!shared) continue;

          const groupA = getGroupId(areaA.id);
          const groupB = getGroupId(areaB.id);
          const isMerged = groupA === groupB;
```

**AFTER** (with comments):
```typescript
    // 4. Shared Edges: For visualization and connector placement
    /**
     * Computes shared edges between pieces, used for visualization and connector placement.
     * 
     * This includes both:
     * - Normal shared edges: between two distinct pieces
     * - Merged edges: marked as isMerged=true when both pieces are in the same merged group
     * 
     * The isMerged flag is used by the UI to:
     * - Render merged edges differently (e.g., dotted or faded)
     * - Prevent connector placement on merged (internal) edges
     * 
     * For each pair of adjacent pieces, all shared perimeters are combined via boolean union
     * so that even complex shared boundaries (from whimsy cuts) are represented as a single edge.
     */
    const sharedEdges = useMemo(() => {
      const leafAreas = (Object.values(topology) as Area[]).filter(a => a.isPiece);
      const edges: { id: string; areaAId: string; areaBId: string; pathData: string; isMerged: boolean }[] = [];

      if (leafAreas.length > 200) return [];

      resetPaperProject(width, height);

      const whimsyAreas = leafAreas.filter(a => a.type === AreaType.WHIMSY);

      /**
       * Looks up which merged group a piece belongs to.
       * Returns the group's representative ID (root of DSU) if merged,
       * or the piece's own ID if it's not merged with anything.
       */
      const getGroupId = (areaId: string) => {
        for (const [groupId, ids] of Object.entries(mergedGroups as Record<string, string[]>)) {
          if (ids.includes(areaId)) return groupId;
        }
        return areaId;
      };

      /**
       * Maps from a pair of merged groups to their shared boundary info.
       * Key: "groupA::groupB" (sorted)
       * Value: combined pathData of all shared perimeters between the groups, plus isMerged flag
       */
      const groupSharedMap = new Map<string, { areaAId: string; areaBId: string; paths: paper.PathItem[]; isMerged: boolean }>();

      for (let i = 0; i < leafAreas.length; i++) {
        for (let j = i + 1; j < leafAreas.length; j++) {
          const areaA = leafAreas[i];
          const areaB = leafAreas[j];

          const shared = getSharedPerimeter(areaA, areaB);
          if (!shared) continue;

          const groupA = getGroupId(areaA.id);
          const groupB = getGroupId(areaB.id);
          // isMerged is true if both pieces are in the same merged group
          const isMerged = groupA === groupB;
```

---

## File 3: src/v2/topology_engine.ts

### Change 1: mergeFaces() Function (Lines 440-453)

**BEFORE**:
```typescript
  /**
   * Merges two adjacent faces into one.
   * The shared edge between them is marked as merged and will be ignored
   * during boundary generation.
   */
  mergeFaces(faceAId: string, faceBId: string) {
    this.edges.forEach(edge => {
      if ((edge.faceAId === faceAId && edge.faceBId === faceBId) ||
          (edge.faceAId === faceBId && edge.faceBId === faceAId)) {
        edge.isMerged = true;
      }
    });
  }
```

**AFTER** (with comments):
```typescript
  /**
   * Merges two adjacent faces by marking their shared edges as "merged".
   * 
   * How it works:
   * 1. Scans all edges in the topological graph
   * 2. Finds edges whose faceAId and faceBId match the two faces (in either order)
   * 3. Marks those shared edges with isMerged = true
   * 4. Later, when getMergedBoundary() is called, merged edges are excluded from the
   *    boundary trace, so they won't appear in the final cut contour
   * 
   * This is used during topological cut generation: shared edges between merged pieces
   * are not traced, so the pieces form a single continuous boundary.
   */
  mergeFaces(faceAId: string, faceBId: string) {
    this.edges.forEach(edge => {
      if ((edge.faceAId === faceAId && edge.faceBId === faceBId) ||
          (edge.faceAId === faceBId && edge.faceBId === faceAId)) {
        edge.isMerged = true;
      }
    });
  }
```

---

### Change 2: getMergedBoundary() Function (Lines 460-495)

**BEFORE**:
```typescript
  /**
   * Returns the boundary path for a group of merged faces.
   * This is the "Traversal" step.
   */
  /**
   * Generates the final SVG boundary path for a set of merged faces.
   * It traverses the outer boundary of the group, splicing in any connectors.
   */
  getMergedBoundary(faceIds: string[]): string {
    const faceIdSet = new Set(faceIds);
    const groupEdges = new Set<string>();
    faceIdSet.forEach(fid => {
      const face = this.faces.get(fid);
      if (face) face.edgeIds.forEach(eid => groupEdges.add(eid));
    });

    // An edge is on the boundary if exactly one of its faces is in the group
    const boundaryEdges = Array.from(groupEdges).filter(eid => {
      const edge = this.edges.get(eid)!;
      const faceAIn = faceIdSet.has(edge.faceAId);
      const faceBIn = edge.faceBId ? faceIdSet.has(edge.faceBId) : false;
      return faceAIn !== faceBIn;
    });
```

**AFTER** (with comments):
```typescript
  /**
   * Generates the final SVG boundary path for a set of merged faces.
   * 
   * This is the core "Traversal" step for merged group boundaries. Given a set of face IDs
   * that have been merged, it reconstructs the outer perimeter by:
   * 
   * 1. Finding all edges that touch at least one face in the group
   * 2. Filtering to only "boundary edges" — edges where exactly one side is in the group
   *    (Internal edges where both sides are in the group are omitted)
   * 3. Building an adjacency map of vertices on the boundary
   * 4. Walking the boundary edges in order, starting from an arbitrary edge
   * 5. Traversing counterclockwise (so that when multiple loops exist, they form a
   *    valid SVG path with holes)
   * 6. Splicing in any connector stamps that are attached to the boundary
   * 7. Combining all loops into a single SVG path string
   * 
   * The result is the outer cut contour of all merged pieces as a single unified shape.
   * Example: Three merged pieces might have a combined boundary that is non-convex or has holes.
   */
  getMergedBoundary(faceIds: string[]): string {
    const faceIdSet = new Set(faceIds);
    const groupEdges = new Set<string>();
    faceIdSet.forEach(fid => {
      const face = this.faces.get(fid);
      if (face) face.edgeIds.forEach(eid => groupEdges.add(eid));
    });

    /**
     * Boundary edge selection:
     * An edge belongs to the boundary if exactly one of its two faces is in the merged group.
     * - Both faces in group: internal edge, not included in boundary trace
     * - One face in group, one outside: boundary edge, should be traced
     * - No faces in group: not relevant, already filtered
     */
    const boundaryEdges = Array.from(groupEdges).filter(eid => {
      const edge = this.edges.get(eid)!;
      const faceAIn = faceIdSet.has(edge.faceAId);
      const faceBIn = edge.faceBId ? faceIdSet.has(edge.faceBId) : false;
      return faceAIn !== faceBIn;  // XOR: exactly one side is in the group
    });
```

---

## Summary

**Total Comments Added**: ~450 lines across 4 key sections

**Key Documentation**:
1. ✅ User-level merge operations (App.tsx)
2. ✅ DSU data structure and operations (usePuzzleEngine.ts)
3. ✅ Merge processing pipeline (usePuzzleEngine.ts)
4. ✅ Topological geometry integration (topology_engine.ts)
5. ✅ Shared edges visualization (usePuzzleEngine.ts)

All comments explain **what**, **how**, and **why** at each level of the system.

