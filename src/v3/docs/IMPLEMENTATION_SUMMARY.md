# Group Template Drag-and-Drop Placement Implementation

## Overview
Added drag-and-drop placement capability for group templates in v3, mirroring the existing whimsy placement workflow.

## Changes Made

### 1. **App.tsx** - State Management & Coordination
- Added state variables:
  - `groupTemplatePlacementActive`: Boolean flag to enable/disable placement mode
  - `activeGroupTemplateId`: Tracks which template is being placed
  
- Added handler functions:
  - `handleGroupTemplateCommit(p: Point)`: Places the template at the clicked position
  - `handleGroupTemplateCancelPlacement()`: Cancels placement mode (triggered by ESC key)

- Updated template placement flow:
  - Changed `onPlaceGroupTemplate` callback to activate placement mode instead of immediately placing at origin
  - Now calls `setGroupTemplatePlacementActive(true)` and stores the template ID for drag placement
  - On commit, uses the clicked point as `translateX` and `translateY` in the transform

### 2. **V3Canvas.tsx** - Rendering & Interaction
- Updated props interface:
  - Added `groupTemplatePlacementActive: boolean`
  - Added `activeGroupTemplateId: string | null`
  - Added `onGroupTemplateCommit: (p: Point) => void`
  - Added `onGroupTemplateCancelPlacement?: () => void` (optional)

- Updated destructuring to extract group templates from `puzzleState`

- Added rendering logic:
  - **Group Template Preview**: Renders the template boundary as a semi-transparent violet shape that follows the mouse cursor
  - **Placement Overlay**: Transparent rect that captures mouse events during placement mode
  - Shows template with:
    - Fill: `rgba(124, 58, 247, 0.15)` (light violet)
    - Stroke: `rgba(109, 40, 217, 0.8)` (darker violet)
    - Stroke width: 2px
    - Follows mouse position in real-time

- Updated mouse tracking:
  - Extended `handleMouseMove` to track mouse position when `groupTemplatePlacementActive` is true
  - Updated dependency arrays to include `groupTemplatePlacementActive`

- Added keyboard support:
  - ESC key cancels placement mode and returns to normal editing
  - Triggers `onGroupTemplateCancelPlacement()` callback

### 3. **GroupTemplatePanel.tsx** - User Guidance
- Updated button title from "Place instance of this template" to "Click to enter drag-and-drop placement mode"
- Clarifies the new interaction pattern for users

## User Experience Flow

### Placing a Group Template:
1. User creates a group template from selected pieces
2. User clicks the "Place" button (copy icon) on the template
3. Canvas enters placement mode:
   - Crosshair cursor appears
   - Template boundary preview shows under cursor
   - Canvas becomes interactive
4. User moves mouse to desired location
5. User clicks to place the template at that location
   - OR presses ESC to cancel placement

### Technical Details
- Placement uses coordinate translation (`translateX`, `translateY`) with identity rotation
- Template boundary is cached in `GroupTemplate.cachedBoundaryPathData` for efficient rendering
- No collision detection or snapping - allows free placement similar to whimsy
- Templates placed as non-destructive overlays (group instances)

## Consistency with Existing Patterns
- Follows the same UX pattern as whimsy placement
- Uses similar visual styling (semi-transparent preview, crosshair cursor)
- Supports ESC key cancellation like other modes
- Integrates seamlessly with existing v3 UI

## Future Enhancements
Potential improvements could include:
- Rotation controls during placement
- Flip/mirror options
- Snap-to-grid during placement
- Snap-to-adjacent-templates
- Visual feedback on valid/invalid placement areas
- Undo/redo integration for placement
