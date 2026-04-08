# Group Template Drag-and-Drop: Bug Fixes

## Issue 1: Cursor Offset - FIXED ✓

### Problem
When dragging a group template, the template was positioned with (0,0) at the cursor instead of being centered on the cursor. This caused the template to appear offset from where the user was pointing.

### Root Cause
The preview transform was using direct translation without accounting for the template's bounding box:
```tsx
// BEFORE: cursor at top-left of template
transform={`translate(${mousePos.x}, ${mousePos.y})`}
```

### Solution
1. Added `bounds` field to `GroupTemplate` type to store the template's bounding rectangle
2. Updated `createGroupTemplate` to compute and cache the bounds when creating the template
3. Updated `refreshTemplateCache` to recompute bounds when template is refreshed
4. Modified preview rendering to center the template on the cursor:
```tsx
// AFTER: cursor at center of template
transform={`translate(${mousePos.x - bounds.x - bounds.width / 2}, ${mousePos.y - bounds.y - bounds.height / 2})`}
```
5. Updated placement coordinate adjustment in `handleGroupTemplateCommit` to reverse the centering offset

### Files Modified
- `src/v3/types/groupTemplateTypes.ts` - Added bounds field
- `src/v3/hooks/useGroupTemplates.ts` - Updated createGroupTemplate
- `src/v3/utils/groupTemplateUtils.ts` - Updated refreshTemplateCache
- `src/v3/components/V3Canvas.tsx` - Fixed preview rendering
- `src/v3/App.tsx` - Fixed placement coordinate calculation

---

## Issue 2: Boundary Connectors Not Being Included

### Status
The implementation already includes boundary connector extraction. Here's how it works:

### How Boundary Connectors are Captured

When you create a group template with `createGroupTemplate`:

1. **Boundary Computation**: The outer boundary is computed by unioning all selected pieces
2. **Connector Extraction**: `extractBoundarySlots` analyzes all connectors and identifies "external" ones:
   - A connector is "external" if its neighbor piece is **outside** the group
   - OR if it has no neighbor (edge connector)
   - Internal connectors (neighbors inside the group) are skipped

3. **Re-parameterization**: External connectors are transformed to be relative to the group's outer boundary instead of the individual piece boundary

4. **Storage**: These boundary slots are stored in `template.boundarySlots`

### Code Flow
```typescript
// In useGroupTemplates.ts createGroupTemplate
const { pathData, boundary } = computeGroupBoundary(pieceIds, areas);
const boundarySlots = extractBoundarySlots(pieceIds, areas, connectors, boundary);
// ^ This captures all external connectors and re-parameterizes them
```

### Verification Checklist
If boundary connectors are not appearing:

1. ✓ Verify connectors exist on the source pieces before template creation
2. ✓ Check that connector neighbors are correctly computed (should be outside the group)
3. ✓ Verify `boundarySlots.length > 0` in the created template
4. ✓ Check that slots are being materialized when instances are subdivided

### Materialization Process
After a template instance is subdivided, boundary connectors are "materialized" as real Connector objects:

1. For each boundary slot, find which child piece owns that edge
2. Re-parameterize the connector to the child piece's boundary
3. Create a real Connector object

See `materializeBoundarySlots` in `groupTemplateUtils.ts`

---

## Implementation Details

### Bounds Structure
```typescript
bounds: {
  x: number;      // Top-left x coordinate
  y: number;      // Top-left y coordinate
  width: number;  // Template width
  height: number; // Template height
}
```

### Centering Calculation
```typescript
// Preview transform (V3Canvas)
const centerOffsetX = mousePos.x - bounds.x - bounds.width / 2;
const centerOffsetY = mousePos.y - bounds.y - bounds.height / 2;

// Placement adjustment (App.tsx)
const adjustedX = p.x - bounds.x - bounds.width / 2;
const adjustedY = p.y - bounds.y - bounds.height / 2;
```

### Boundary Slot Extraction Logic
```typescript
for (const connector of connectors) {
  // Skip if connector's piece not in group
  if (!pieceIdSet.has(connector.pieceId)) continue;
  
  // Find connector's neighbor
  const neighborId = findNeighborPiece(...);
  
  // Skip if neighbor is inside group (internal connector)
  if (neighborId && pieceIdSet.has(neighborId)) continue;
  
  // This is external - include it as a boundary slot
  slots.push(slot);
}
```

---

## Testing

### Test Case 1: Centering
1. Create a group template from several pieces
2. Click "Place" button
3. Move cursor to center of canvas
4. Verify template outline centers on cursor (not offset)
5. Click to place
6. Verify placed instance is centered where you clicked

### Test Case 2: Boundary Connectors
1. Create connectors on pieces
2. Select pieces including those with external connectors
3. Create group template
4. Check template's `boundarySlots` array (should have entries)
5. Place template instance
6. Subdivide the instance
7. Verify connectors appear on the outer boundary of the subdivided instance

---

## Future Enhancements
- Add visual indicator showing which connectors will become boundary slots during template preview
- Add tooltip showing number of boundary slots
- Add validation warning if templates have no boundary slots
- Support rotation/flip during placement (already in transform structure)
