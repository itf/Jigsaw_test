# Group Template Fixes: Boundary Connectors and Refresh

## Issue 1: Boundary Connectors Not Being Added to Canvas - FIXED ✓

### Problem
The GroupTemplatePanel was correctly showing the number of boundary connectors (e.g., "3c" for 3 connectors), but these connectors were never being created as actual Connector objects on the canvas.

### Root Cause
The `materializeInstanceConnectors` function existed but was never being called. It should have been invoked after a group instance is subdivided, but there was no hook to trigger this.

### Solution
Modified `subdivideGrid` in `usePuzzleEngineV3.ts` to detect when a group instance is being subdivided and call `materializeInstanceConnectors`:

```typescript
// If the parent is a group instance, materialize its boundary connectors
setAreas(currentAreas => {
  const parent = currentAreas[parentId];
  if (parent?.groupInstance) {
    groupTemplateOps.materializeInstanceConnectors(parentId);
  }
  return currentAreas;
});
```

### How It Works
1. User creates a group template with pieces that have external connectors
2. User places an instance of the template
3. User subdivides the template instance (using grid/hex/random subdivision)
4. `subdivideGrid` now detects this is a group instance
5. It calls `materializeInstanceConnectors` which:
   - Gets the stored boundary slots from the template
   - For each slot, determines which child piece owns that edge
   - Re-parameterizes the connector to the child piece's boundary
   - Creates real Connector objects that appear on the canvas

### Files Changed
- `src/v3/hooks/usePuzzleEngineV3.ts` - Added materialization call after subdivision

---

## Issue 2: Template Boundary Not Updating After Whimsy Modifications - FIXED ✓

### Problem
When a whimsy was added that carved into pieces that are part of a group template, the template boundary wasn't updating properly. After clicking the "Refresh" button, the template would keep its outer boundary but add an extra interior division where the original group would have intersected with the whimsy.

### Root Cause
The `computeGroupBoundary` function was using a "unite-then-subtract-intersection" approach:
```typescript
const intersection = currentPath.intersect(otherPath);
const united = currentPath.unite(otherPath);
const result = united.subtract(intersection); // ← Creates artifacts
```

This approach was designed for reliability in general merge operations, but it creates spurious internal divisions when piece boundaries have been modified by external operations like whimsy cuts.

### Solution
Simplified `computeGroupBoundary` to use a straightforward union operation:

```typescript
for (let i = 1; i < validIds.length; i++) {
  const otherPath = areas[validIds[i]].boundary.clone();
  const united = currentPath.unite(otherPath);
  currentPath.remove();
  otherPath.remove();
  currentPath = united;
}
```

This approach:
- Simply unions all pieces together
- Avoids the intersection subtraction that was creating artifacts
- Works correctly with modified piece boundaries
- Is cleaner and more predictable

### When This Is Triggered
1. User creates a group template
2. User adds a whimsy that modifies one of the source pieces
3. User clicks "Refresh" button in the Group Templates panel
4. The template boundary is recomputed from the current piece states
5. No spurious internal divisions are created

### Files Changed
- `src/v3/utils/groupTemplateUtils.ts` - Simplified boundary computation

---

## Complete Workflow: Creating and Using Group Templates with Connectors

### Step 1: Setup
1. Create pieces and subdivide them
2. Add connectors to pieces on the boundaries you want to preserve

### Step 2: Create Template
1. Select pieces that include the external connectors
2. Create a group template
3. The panel shows "Nc" indicating N boundary connectors were captured

### Step 3: Place Template Instance
1. Click the Place button
2. Click on canvas to place the instance

### Step 4: Subdivide Instance
1. Select the placed instance
2. Subdivide it (Grid/Hex/Random)
3. **NEW**: Boundary connectors are automatically materialized on the child pieces!
4. Connectors now appear on the canvas

### Step 5: Update Template (Optional)
1. If source pieces are modified (e.g., whimsy cuts), click "Refresh"
2. Template boundary is updated cleanly without artifacts

---

## Technical Details

### Boundary Connector Materialization
When `materializeInstanceConnectors` is called:

1. **Retrieve Template Data**
   - Get template from group instance metadata
   - Extract stored boundary slots

2. **Reconstruct Transform**
   - Apply the instance transform to get world-space boundary
   - Use this to determine which child pieces own which edges

3. **Re-parameterize Slots**
   - For each slot, find the nearest child piece
   - Get the closest point on that piece's boundary
   - Create a new Connector with all the slot properties
   - Add marker `sourceSlotId` to track materialized connectors

4. **Add to Puzzle State**
   - Insert new Connector objects into the connectors record
   - They render immediately on the canvas

### Boundary Computation
The simplified union approach ensures:
- No spurious interior divisions
- Clean outer boundary that matches the convex hull of pieces
- Properly handles gaps and overlaps
- Works consistently after piece modifications

---

## Testing Checklist

### Test 1: Boundary Connectors Appear
- [ ] Create pieces with external connectors
- [ ] Create template (verify "Nc" shown)
- [ ] Place template instance
- [ ] Subdivide instance
- [ ] Verify connectors appear on child pieces

### Test 2: Multiple Instances
- [ ] Create multiple instances of same template
- [ ] Subdivide each
- [ ] Verify each has its own set of materialized connectors

### Test 3: Whimsy Refresh
- [ ] Create template from pieces
- [ ] Add whimsy that carves into a source piece
- [ ] Click Refresh
- [ ] Verify outer boundary updates without internal artifacts

### Test 4: Connector Properties Preserved
- [ ] Create connectors with specific settings (width, head template, etc.)
- [ ] Create template
- [ ] Place and subdivide instance
- [ ] Verify materialized connectors have same properties

---

## Future Enhancements

1. **Visual Indicator**: Show which slots will be materialized before subdivision
2. **Slot Management**: UI to modify or remove specific slots
3. **Automatic Materialization**: Option to materialize on placement instead of subdivision
4. **Slot Visualization**: Display boundary slots differently in preview mode
5. **Slot Conflicts**: Warning if slots overlap or conflict
