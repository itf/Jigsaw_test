# V3 Group Template System Documentation

This folder contains documentation for the Group Template system implemented in v3 of the Jigsaw puzzle editor.

## Files

### [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
Overview of the drag-and-drop placement feature for group templates, including how it was integrated into the v3 UI and components.

**Key Topics:**
- Placement mode activation and interaction
- Canvas preview rendering
- Component coordination between App.tsx, V3Canvas.tsx, and GroupTemplatePanel.tsx
- User experience flow

### [BUG_FIXES_SUMMARY.md](./BUG_FIXES_SUMMARY.md)
Detailed explanation of bug fixes related to cursor offset and boundary connector extraction.

**Key Topics:**
- Cursor centering on template during drag-and-drop
- Bounds computation and caching
- Boundary connector extraction and re-parameterization
- Testing and verification checklist

### [GROUP_TEMPLATE_PLACEMENT_GUIDE.md](./GROUP_TEMPLATE_PLACEMENT_GUIDE.md)
User-facing guide for creating and placing group templates.

**Key Topics:**
- Step-by-step usage instructions
- Visual indicators and feedback
- Comparison with other placement modes (whimsy, connectors)
- Tips and tricks

### [GROUP_TEMPLATE_ARCHITECTURE.md](./GROUP_TEMPLATE_ARCHITECTURE.md)
Technical architecture documentation covering component integration and data flow.

**Key Topics:**
- Component integration diagram
- Data flow for placement activation, confirmation, and cancellation
- State management in App.tsx and V3Canvas.tsx
- Performance considerations
- Type safety and error handling

### [FIXES_CONNECTORS_REFRESH.md](./FIXES_CONNECTORS_REFRESH.md)
Comprehensive documentation of connector materialization and template refresh functionality.

**Key Topics:**
- Boundary connector materialization after subdivision
- Template boundary updates after whimsy modifications
- Connector materialization on unsplit instances
- Automatic connector updates when template is refreshed
- Connector position synchronization with source pieces
- Complete workflow and testing checklist

## Features Documented

### Drag-and-Drop Placement
- Activate placement mode by clicking template button
- Preview shows template boundary following cursor
- Click to place or ESC to cancel
- Supports multiple instances of same template

### Boundary Connectors
- Connectors on group edges are extracted as "boundary slots"
- Slots are stored in template metadata
- Materialized as real Connector objects when instance is subdivided
- Also materialized on unsplit instances immediately after placement

### Template Refresh
- Updates template boundary based on current source piece states
- Re-materializes connectors on all instances
- Handles piece modifications from external operations (e.g., whimsy cuts)
- No spurious internal divisions after refresh

### Connector Updates
- Editing connectors on source pieces updates the template slots
- All instances automatically reflect the changes
- Materialized connectors track their source slot via `sourceSlotId`

## Quick Links

- [Source Code](../) - V3 implementation files
- [Types Definition](../types/groupTemplateTypes.ts) - Type definitions for GroupTemplate, GroupInstance, and BoundaryConnectorSlot
- [Main Hook](../hooks/useGroupTemplates.ts) - Primary template operations
- [Utilities](../utils/groupTemplateUtils.ts) - Low-level geometry and materialization functions
- [Main Component](../components/V3Canvas.tsx) - Canvas rendering and interaction
- [App State](../App.tsx) - Top-level state management
