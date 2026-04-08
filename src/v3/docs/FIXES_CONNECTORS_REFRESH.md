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

## Issue 3: Connectors Not Added When Placing Unsplit Instance - FIXED ✓

### Problem
When a group template instance was placed without subdivision, the connectors from the boundary slots were not appearing on the instance piece.

### Root Cause
The `materializeInstanceConnectors` function requires child pieces to exist (it's designed to materialize connectors onto subdivided pieces). For a single-piece instance, there were no child pieces to add connectors to.

### Solution
Created a new function `materializeBoundarySlotsForSinglePiece` that:
1. Takes a single-piece group instance
2. Creates connectors directly on that piece's boundary
3. Uses the instance's transform to adjust slot positions

Updated `placeGroupTemplate` to call this function immediately after placing an instance:

```typescript
// For unsplit instances, materialize connectors immediately
materializeBoundarySlotsForSinglePiece(instanceId, newConnectors);
```

### Files Changed
- `src/v3/utils/groupTemplateUtils.ts` - Added `materializeBoundarySlotsForSinglePiece`
- `src/v3/hooks/useGroupTemplates.ts` - Updated `placeGroupTemplate` to materialize immediately

---

## Issue 4: Connectors Not Updating When Template is Refreshed - FIXED ✓

### Problem
When new connectors were added to source pieces and the template was refreshed, the template's `boundarySlots` were updated, but existing template instances didn't get the new connectors.

### Solution
Modified `refreshAllTemplateCaches` to:
1. Update template boundary and slots (already did this)
2. For each instance of the template:
   - Remove old materialized connectors
   - Call `materializeInstanceConnectors` to create new ones with updated slots

```typescript
// Re-materialize connectors on all instances
Object.entries(nextAreas).forEach(([areaId, area]) => {
  if (area.groupInstance?.templateId === templateId) {
    groupTemplateOps.materializeInstanceConnectors(areaId);
  }
});
```

### Files Changed
- `src/v3/hooks/useGroupTemplates.ts` - Updated `refreshAllTemplateCaches`

---

## Issue 5: Connector Position Updates Not Reflected in Templates - FIXED ✓

### Problem
When a connector on a source piece was moved or edited, template instances with materialized connectors from that slot didn't get the update.

### Solution
Enhanced `updateConnector` in `usePuzzleEngineV3.ts` to:
1. Check if the connector has a `sourceSlotId` (marking it as materialized from a template)
2. If so, update the corresponding slot in the template
3. Re-materialize connectors on all instances of that template

```typescript
// If this is a materialized connector from a slot, update the source slot
if (connector.sourceSlotId) {
  // Find the template containing this slot
  const template = Object.values(groupTemplates.groupTemplates).find(t => 
    t.boundarySlots.some(s => s.id === connector.sourceSlotId)
  );
  
  if (template) {
    // Update the slot properties
    groupTemplateOps.updateTemplateSlot(template.id, connector.sourceSlotId, connector);
  }
}
```

### Files Changed
- `src/v3/hooks/usePuzzleEngineV3.ts` - Enhanced `updateConnector`
- `src/v3/hooks/useGroupTemplates.ts` - Added `updateTemplateSlot` function

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
3. **NEW**: Connectors appear immediately, even without subdivision!

### Step 4: Subdivide Instance (Optional)
1. Select the placed instance
2. Subdivide it (Grid/Hex/Random)
3. Boundary connectors are on the outer edges of subdivided pieces

### Step 5: Update Template (Optional)
1. Edit source pieces or add new connectors
2. Click "Refresh"
3. **NEW**: All instances get new connectors automatically!

### Step 6: Move Connectors (Optional)
1. Move a connector on a source piece
2. **NEW**: The change reflects in the template and all instances!

---

## Testing Checklist

### Test 1: Connectors on Unsplit Instance
- [ ] Create pieces with external connectors
- [ ] Create template (verify "Nc" shown)
- [ ] Place template instance
- [ ] **Without subdividing**, verify connectors appear on instance piece

### Test 2: Connectors on Subdivided Instance
- [ ] Subdivide the placed instance
- [ ] Verify connectors appear on the outer edges of child pieces

### Test 3: Multiple Instances
- [ ] Create multiple instances of same template
- [ ] Verify each shows connectors
- [ ] Verify each has independent connector sets

### Test 4: Whimsy Refresh
- [ ] Create template from pieces
- [ ] Add whimsy that modifies a source piece
- [ ] Click Refresh
- [ ] Verify connectors update on all instances

### Test 5: Connector Editing
- [ ] Create template with connectors
- [ ] Place instance
- [ ] Edit a connector on the source piece
- [ ] Verify change appears on instance connector

---

## Future Enhancements

1. **Visual Indicator**: Show which slots will be materialized in preview
2. **Slot Management**: UI to modify or remove specific slots
3. **Undo/Redo**: Track materialization changes
4. **Batch Updates**: Optimize when many instances need updates
5. **Conflict Resolution**: Handle overlapping connector slots
