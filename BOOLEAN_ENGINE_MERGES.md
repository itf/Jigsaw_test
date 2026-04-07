# Boolean Engine Merge Processing

## Overview

The **boolean engine** handles merges **differently** from the topological engine:

- **Topological Engine**: Uses DSU to track grouping, marks shared edges as merged, traces outer boundaries
- **Boolean Engine**: Performs **geometric boolean operations** (union) to combine merged piece boundaries

The key difference: **the boolean engine actually computes the unified geometry by unioning piece paths**, while the topo engine keeps pieces separate and marks internal edges.

---

## Where Boolean Merges Happen

### File: `src/v2/boolean_connector_geometry.ts`

### Function 1: `buildBooleanBasePiecesCore()` (Lines 31-69)

**Purpose**: Create base pieces from topology and mergedGroups using boolean union

**Location**: Lines 31-69

```typescript
function buildBooleanBasePiecesCore(
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>
): BooleanPiece[] {
  const pieces: BooleanPiece[] = [];

  Object.entries(mergedGroups).forEach(([groupId, areaIds]) => {
    // CASE 1: Single piece, not merged
    if (areaIds.length === 1) {
      const area = topology[areaIds[0]];
      if (!area) return;
      pieces.push({ id: area.id, pathData: area.boundary, color: area.color });
    } 
    // CASE 2: Multiple pieces, merged together
    else {
      let mergedPath: paper.PathItem | null = null;
      areaIds.forEach(id => {
        const area = topology[id];
        if (!area) return;
        const path = pathItemFromBoundaryData(area.boundary);
        if (!mergedPath) {
          mergedPath = path;
        } else {
          // Boolean union the paths
          const next = mergedPath.unite(path);
          mergedPath.remove();
          path.remove();
          mergedPath = next;
        }
      });
      if (mergedPath) {
        // Clean up self-intersections and orient
        const cleaned = (mergedPath as paper.PathItem).reduce({ insert: false }) as paper.PathItem;
        cleaned.reorient(true, true);
        pieces.push({
          id: groupId,
          pathData: cleaned.pathData,
          color: topology[areaIds[0]]!.color,
        });
        cleaned.remove();
      }
    }
  });

  return pieces;
}
```

**How it works**:
1. Iterates through `mergedGroups` entries (root → [piece IDs])
2. **If single piece**: Just use its boundary as-is
3. **If multiple pieces (merged)**:
   - Take the first piece's path
   - Union it with the second piece's path
   - Remove both originals, keep the union result
   - Repeat for all pieces in the group
   - Clean up self-intersections with `.reduce()`
   - Reorient to ensure correct winding
   - Return the unified boundary

**Result**: A `BooleanPiece` with unified geometry for the entire merged group

**Key Operations**:
- `mergedPath.unite(path)` — Paper.js boolean union
- `reduce({ insert: false })` — Remove self-intersections
- `reorient(true, true)` — Correct winding for SVG validity

---

### Function 2: `applyBooleanConnectorStampsToPiecesCore()` (Lines 85-191)

**Purpose**: Apply connector stamps (tabs/dovetails) to base pieces

**Location**: Lines 85-191

**How it handles merges**:

```typescript
function applyBooleanConnectorStampsToPiecesCore(
  topology: Record<string, Area>,
  mergedGroups: Record<string, string[]>,
  basePieces: BooleanPiece[],
  connectors: Connector[]
): BooleanPiece[] {
  // ... setup ...

  stamps.forEach(s => {
    // Check if this connector is internal (both pieces in same merged group)
    const groupA = getGroupId(c.areaAId);
    const groupB = getGroupId(c.areaBId);
    const isInternal = groupA === groupB;  // ← MERGE CHECK

    // If internal, skip this stamp entirely
    if (isInternal || !piecePath) return;

    // ... apply stamp to owner and neighbor ...
  });
}
```

**Critical Line**: `const isInternal = groupA === groupB;`

**What it does**:
- If a connector connects two pieces in the **same merged group**, it's **internal**
- Internal connectors are **skipped** (not applied as stamps)
- Why? Because merged pieces have no external boundary between them anymore!

**Stamp Application**:
```typescript
if (ownerGroupId === piece.id) {
  // Union the stamp onto the owner (add tab)
  const next = piecePath.unite(stampOp);
  piecePath = next;
} else if (neighborGroupId === piece.id) {
  // Subtract the stamp from the neighbor (create socket)
  const next = piecePath.subtract(stampOp);
  piecePath = next;
}
```

---

### Function 3: `applyBooleanConnectorDisplayPiecesCore()` (Lines 336-409)

**Purpose**: Similar to above, but for canvas preview rendering

**Same merge logic**: Checks `const isInternal = groupA === groupB;` to skip internal connectors

---

## The Boolean Engine Merge Pipeline

```
1. Receive MERGE operations from history
   ↓
2. usePuzzleEngine processes via DSU
   ↓ topology = areas with deleted boundaries
   ↓ mergedGroups = { root: [pieces...] }

3. Boolean Engine Takes Over
   ↓
4. buildBooleanBasePiecesCore():
   - For each merged group in mergedGroups
   - Union all piece boundaries together
   - Result: One unified geometric path per group
   ↓
5. applyBooleanConnectorStampsToPiecesCore():
   - For each connector
   - Check if isInternal = (both pieces in same group)
   - If internal: skip (no boundary between them)
   - If external: apply stamp (union on owner, subtract on neighbor)
   ↓
6. Final result: pieces with connector tabs/sockets
```

---

## Key Differences: Boolean vs Topological

| Aspect | Boolean Engine | Topological Engine |
|--------|---|---|
| **Merge Representation** | Geometric union of paths | DSU grouping + marked edges |
| **Merge Geometry** | Actually combines boundaries | Boundaries kept, marked "merged" |
| **Connector on Merged Pieces** | Skipped entirely (isInternal) | Still placed but on "merged" edges |
| **Output** | Single unified piece path | Separate pieces + edge markings |
| **Use Case** | Production cuts, final geometry | Real-time interaction, flexibility |

---

## Flowchart: Boolean Engine Merge Processing

```
Input: topology + mergedGroups

buildBooleanBasePiecesCore()
│
├─ For each group in mergedGroups:
│  │
│  ├─ If areaIds.length === 1:
│  │  └─ Use area.boundary as-is
│  │
│  └─ If areaIds.length > 1:
│     ├─ Take first piece path
│     ├─ Unite with second: path = path.unite(path2)
│     ├─ Repeat for all pieces in group
│     ├─ Reduce to remove self-intersections
│     ├─ Reorient for SVG
│     └─ Push unified boundary
│
└─ Return: BooleanPiece[] (one per group)

applyBooleanConnectorStampsToPiecesCore()
│
├─ For each connector:
│  │
│  ├─ Check: isInternal = (groupA === groupB)
│  │
│  ├─ If isInternal:
│  │  └─ Skip this connector (no boundary to cut)
│  │
│  └─ If external:
│     ├─ Create stamp shape
│     ├─ Union onto owner piece
│     └─ Subtract from neighbor piece
│
└─ Return: BooleanPiece[] with stamps applied
```

---

## Code Locations

| Operation | File | Lines | Function |
|-----------|------|-------|----------|
| Create merged base pieces | boolean_connector_geometry.ts | 31-69 | buildBooleanBasePiecesCore() |
| Export merged base pieces | boolean_connector_geometry.ts | 77-87 | buildBooleanBasePieces() |
| Apply stamps to merged pieces | boolean_connector_geometry.ts | 85-191 | applyBooleanConnectorStampsToPiecesCore() |
| Export stamp application | boolean_connector_geometry.ts | 205-223 | applyBooleanConnectorStampsToPieces() |
| Apply stamps for display | boolean_connector_geometry.ts | 336-409 | applyBooleanConnectorDisplayPiecesCore() |
| Export display stamps | boolean_connector_geometry.ts | 425-453 | applyBooleanConnectorDisplayPieces() |

---

## Example: Merging Two Pieces Geometrically

**Input State**:
```
mergedGroups = {
  "piece-1": ["piece-1"],
  "root": ["piece-3", "piece-4"]  // Merged pair
}

topology = {
  "piece-1": { boundary: "M10,10 L20,10 L20,20 L10,20 Z", ... },
  "piece-3": { boundary: "M20,10 L30,10 L30,20 L20,20 Z", ... },
  "piece-4": { boundary: "M30,10 L40,10 L40,20 L30,20 Z", ... }
}
```

**Processing**:

1. **buildBooleanBasePiecesCore()**:
   ```typescript
   // Process group "piece-1" (single)
   → pieces.push({ id: "piece-1", pathData: "M10,10 L20,10..." })
   
   // Process group "root" (merged pair)
   → path1 = piece-3 boundary
   → path2 = piece-4 boundary
   → mergedPath = path1.unite(path2)
   → cleaned = mergedPath.reduce() + reorient()
   → pieces.push({ id: "root", pathData: "M20,10 L40,10..." })
   ```

2. **applyBooleanConnectorStampsToPiecesCore()**:
   ```typescript
   // If connector connects piece-3 and piece-4:
   → groupA = "root"
   → groupB = "root"
   → isInternal = true
   → Skip this connector! (no tab/socket needed)
   
   // If connector connects piece-1 and piece-3:
   → groupA = "piece-1"
   → groupB = "root"
   → isInternal = false
   → Apply stamp: union on piece-1, subtract on root
   ```

3. **Result**:
   - Single unified path for root (piece-3 + piece-4)
   - No internal connector between piece-3 and piece-4
   - External connector between piece-1 and root with proper tab/socket

---

## Why Two Engines?

### Boolean Engine (for Production)
- **Pros**: Final cut geometry, no internal boundaries, realistic laser output
- **Cons**: Can't easily undo merges, geometry is "baked in"
- **Use**: Final cuts, SVG export, production

### Topological Engine (for Interaction)
- **Pros**: Flexible, can undo/redo, pieces remain distinct
- **Cons**: More complex, internal edges still exist
- **Use**: Real-time UI, interactive merging/unmerging

Both engines use the same `mergedGroups` structure created by the DSU, but process it differently downstream.

