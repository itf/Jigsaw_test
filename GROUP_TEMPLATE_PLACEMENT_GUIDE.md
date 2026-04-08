# Group Template Placement - Usage Guide

## Feature Overview
You can now drag-and-drop group templates to position them on the canvas, similar to how you place whimsies.

## How to Use

### Step 1: Create a Template
1. Select 2 or more adjacent pieces on the canvas
2. In the "Group Templates" panel, enter a name (optional)
3. Click the "Create" button
4. Your template is now saved and appears in the Templates list

### Step 2: Place a Template Instance
1. Click the **copy icon** (📋) next to your template name
2. The canvas enters **placement mode**:
   - Your cursor changes to a **crosshair**
   - A **violet preview** of the template boundary appears under your cursor
   - The entire canvas becomes interactive

### Step 3: Position and Confirm
1. **Move your mouse** to position the template where you want it
2. **Click** to place it at that location
3. The template instance is created at the clicked position

### Cancel Placement
- Press **ESC** at any time to cancel placement without creating an instance

## Visual Indicators
- **Template Preview**: Semi-transparent violet outline that follows your cursor
- **Crosshair Cursor**: Indicates placement mode is active
- **Active State**: The copy button shows your intention to place

## Technical Details
- Templates are placed at absolute coordinates on the canvas
- Each instance is independent - you can place the same template multiple times
- Instances are non-destructive overlays that don't modify underlying pieces
- All connector slots from the template are preserved on each instance

## Tips & Tricks
- You can immediately place another copy by clicking the template button again
- Edit source pieces and click "Refresh" to update all template instances
- Each instance maintains the same boundary and connector structure
- Templates work best with regularly subdivided pieces for clean boundaries

## Comparison with Other Placement Modes

### Whimsy Placement
- Fixed scale and rotation
- Can place multiple whimsies on pieces
- Decorative elements

### Group Template Placement (NEW)
- Scale matches template exactly
- Creates a group instance with shared boundary
- Preserves connector slots for connections
- Can be further subdivided

### Connector Placement
- Applied to individual piece boundaries
- Positioned using normalized path parameters (t-value)
- For connection features
