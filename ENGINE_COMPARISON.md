# Boolean vs Topological Merge Comparison

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Action                             │
│                  (Select pieces, click "Merge")              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   usePuzzleEngine Hook       │
         │  (DSU-based Processing)      │
         │  - applyMerge()              │
         │  - buildMergedGroups()       │
         └──────────┬────────────────────┘
                    │
         ┌──────────▼──────────┐
         │   Output:           │
         │  - topology         │
         │  - mergedGroups     │
         └──────┬───────┬──────┘
                │       │
         ┌──────▼──┐  ┌─▼───────────────────┐
         │ TOPOLOGY│  │    BOOLEAN ENGINE    │
         │ ENGINE  │  │ (boolean_connector   │
         │         │  │  _geometry.ts)       │
         │ Marks   │  │                      │
         │ merged  │  │ Computes unified     │
         │ edges   │  │ geometry via union   │
         └──────┬──┘  └─┬────────────────────┘
                │       │
         ┌──────▼──┐  ┌─▼───────────────────┐
         │ Output: │  │ Output:             │
         │ Pieces  │  │ Pieces with         │
         │ with    │  │ unified geometry    │
         │ marked  │  │ (no internal edges) │
         │ merged  │  │                     │
         │ edges   │  │                     │
         └─────────┘  └─────────────────────┘
                │       │
         ┌──────▼───────▼────────────┐
         │  UI Rendering             │
         │  (Show to user)           │
         └───────────────────────────┘
```

---

## Detailed Processing Comparison

### Phase 1: DSU Processing (Both Engines Use This)

**File**: `src/v2/hooks/usePuzzleEngine.ts` (lines 128-341)

**Code**:
```typescript
// Initialize DSU
const dsu: Record<string, string> = {};

// Process MERGE operations
const applyMerge = (op: Operation) => {
  // For each pair of touching pieces
  const shared = getSharedPerimeter(a, b);
  if (shared) {
    union(la, lb);       // DSU union
    shared.remove();     // Delete shared boundary from areas
  }
};

// Build mergedGroups from DSU final state
const groups: Record<string, string[]> = {};
leafAreas.forEach(a => {
  const root = find(a.id);
  if (!groups[root]) groups[root] = [];
  groups[root].push(a.id);
});
```

**Output**:
```typescript
topology = {
  "piece-1": { boundary: "M...", isPiece: true },
  "piece-3": { boundary: "M...", isPiece: true },
  "piece-4": { boundary: "M...", isPiece: true }
  // shared boundary between piece-3 and piece-4 is DELETED
}

mergedGroups = {
  "piece-1": ["piece-1"],
  "root": ["piece-3", "piece-4"]  // Both in same group
}
```

**Key Point**: The topology `areas` actually have the shared boundary **deleted** by `shared.remove()`

---

### Phase 2a: Topological Engine

**File**: `src/v2/topology_engine.ts`

**Process**:
```typescript
// Mark merged edges in the topo graph
mergeFaces(faceAId: string, faceBId: string) {
  this.edges.forEach(edge => {
    if ((edge.faceAId === faceAId && edge.faceBId === faceBId) ||
        (edge.faceAId === faceBId && edge.faceBId === faceAId)) {
      edge.isMerged = true;  // Mark as internal
    }
  });
}

// Trace outer boundary (skip merged edges)
getMergedBoundary(faceIds: string[]): string {
  const boundaryEdges = Array.from(groupEdges).filter(eid => {
    const edge = this.edges.get(eid)!;
    const faceAIn = faceIdSet.has(edge.faceAId);
    const faceBIn = edge.faceBId ? faceIdSet.has(edge.faceBId) : false;
    return faceAIn !== faceBIn;  // Only edges where one side is in group
  });
  // ... trace boundary from boundaryEdges ...
}
```

**Output**:
```typescript
finalPieces = [
  {
    id: "piece-1",
    pathData: "M10,10 L20,10 L20,20 L10,20 Z",  // unchanged
    color: "red"
  },
  {
    id: "piece-3", 
    pathData: "M20,10 L30,10 L30,20 L20,20 Z",  // unchanged (still separate)
    color: "blue"
  },
  {
    id: "piece-4",
    pathData: "M30,10 L40,10 L40,20 L30,20 Z",  // unchanged (still separate)
    color: "green"
  }
]
```

**Note**: Pieces remain **geometrically separate** even though logically merged!

---

### Phase 2b: Boolean Engine

**File**: `src/v2/boolean_connector_geometry.ts`

**Step 1: buildBooleanBasePiecesCore()**
```typescript
Object.entries(mergedGroups).forEach(([groupId, areaIds]) => {
  if (areaIds.length === 1) {
    // Single piece: use as-is
    pieces.push({ id: area.id, pathData: area.boundary });
  } else {
    // Merged pieces: union them
    let mergedPath = pathItemFromBoundaryData(areaIds[0].boundary);
    for (let i = 1; i < areaIds.length; i++) {
      const path = pathItemFromBoundaryData(areaIds[i].boundary);
      mergedPath = mergedPath.unite(path);  // BOOLEAN UNION
      path.remove();
    }
    // Clean up
    const cleaned = mergedPath.reduce({ insert: false });
    cleaned.reorient(true, true);
    pieces.push({ id: groupId, pathData: cleaned.pathData });
  }
});
```

**Intermediate Output** (base pieces):
```typescript
basePieces = [
  {
    id: "piece-1",
    pathData: "M10,10 L20,10 L20,20 L10,20 Z",
    color: "red"
  },
  {
    id: "root",
    pathData: "M20,10 L40,10 L40,20 L20,20 Z",  // UNIFIED! piece-3 + piece-4
    color: "blue"
  }
]
```

**Step 2: applyBooleanConnectorStampsToPiecesCore()**
```typescript
stamps.forEach(({ stamp, ownerGroupId, neighborGroupId, isInternal }) => {
  const isInternal = groupA === groupB;  // Both in same merged group?
  
  if (isInternal) {
    return;  // Skip! No boundary between merged pieces
  }
  
  // Apply stamps
  if (ownerGroupId === piece.id) {
    piecePath = piecePath.unite(stamp);  // Add tab to owner
  } else if (neighborGroupId === piece.id) {
    piecePath = piecePath.subtract(stamp);  // Add socket to neighbor
  }
});
```

**Final Output** (with connectors):
```typescript
finalPieces = [
  {
    id: "piece-1",
    pathData: "M10,10 L20,10 L20,20 L10,20 Z [+ tab geometry]",
    color: "red"
  },
  {
    id: "root",
    pathData: "M20,10 L40,10 L40,20 L20,20 Z [+ socket geometry]",
    color: "blue"
  }
]
```

**Note**: Only 2 pieces! piece-3 and piece-4 are **geometrically unified**

---

## Side-by-Side Comparison

### Example: Merge piece-3 and piece-4

| Aspect | Topological Engine | Boolean Engine |
|--------|-------------------|-----------------|
| **Input** | topology, mergedGroups | topology, mergedGroups |
| **Merge Processing** | Mark edges as `isMerged=true` | Boolean union paths |
| **Output Piece Count** | 3 (piece-1, piece-3, piece-4) | 2 (piece-1, root) |
| **piece-3 Geometry** | "M20,10 L30,10..." (unchanged) | Gone (merged into root) |
| **piece-4 Geometry** | "M30,10 L40,10..." (unchanged) | Gone (merged into root) |
| **root Geometry** | N/A | "M20,10 L40,10..." (union) |
| **Internal Connector** | Still placed on marked edge | Skipped entirely |
| **External Connector** | Placed normally | Placed normally |
| **Edit After Merge** | Can unmerge by removing MERGE op | Must recompute |
| **Use Case** | Real-time, interactive | Production, final cuts |

---

## Connector Behavior Comparison

### Scenario: Two merged pieces with a connector between them

```
Before merge:
  piece-3 ↔ piece-4
  
After merge in DSU:
  mergedGroups = { "root": ["piece-3", "piece-4"] }
```

#### Topological Engine
```
1. Mark edge between piece-3 and piece-4 as isMerged=true
2. Still calculates connector geometry
3. But marks it as "internal" in visualization
4. Users can see it's merged but can undo
```

#### Boolean Engine
```
1. Check: isInternal = (groupA === groupB) = true
2. Skip connector entirely
3. Unified geometry has no internal boundary
4. No connector ever shown
5. When piece is cut, no tab/socket between the merged pieces
```

---

## When Each Engine Is Used

### Topological Engine (src/v2/topology_engine.ts)

**Used when**: `activeTab !== 'PRODUCTION'` or `geometryEngine === 'TOPOLOGICAL'`

```typescript
// In App.tsx
if (activeTab === 'TOPOLOGY' || activeTab === 'BOOLEAN') {
  use TopologicalEngine for preview
}
```

**Output**: `previewPieces` in usePuzzleEngine

**Characteristics**:
- Shows pieces separately
- Marks merged edges visually
- Allows real-time interaction
- Can undo merges

### Boolean Engine (src/v2/boolean_connector_geometry.ts)

**Used when**: `activeTab === 'PRODUCTION'` or `geometryEngine === 'BOOLEAN'`

```typescript
// In App.tsx
if (activeTab === 'PRODUCTION') {
  use Boolean Engine
}
```

**Output**: `finalPieces` in usePuzzleEngine

**Characteristics**:
- Shows unified merged geometry
- No internal boundaries
- Ready for laser cutting
- "Baked in" merges

---

## Key Insight: The Divergence Point

Both engines start with the same `mergedGroups` and `topology`, but:

```
Input: mergedGroups = { "root": ["piece-3", "piece-4"] }

Topological Path:
  └─ Keep pieces separate
     └─ Mark shared edge as "merged"
        └─ Show them as merged visually
           └─ User can still undo

Boolean Path:
  └─ Union piece boundaries
     └─ Create one unified path
        └─ No internal edges
           └─ Ready for laser cutting
```

This design allows the same data structure (mergedGroups) to be used for two different representations of the same logical state!

