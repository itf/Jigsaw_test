# Group Template Placement - Technical Architecture

## Component Integration

```
App.tsx (State Management)
  ↓
  ├─ groupTemplatePlacementActive (boolean)
  ├─ activeGroupTemplateId (string | null)
  ├─ handleGroupTemplateCommit() → calls placeGroupTemplate()
  ├─ handleGroupTemplateCancelPlacement() → resets state
  │
  └─→ V3Canvas.tsx (Rendering & Interaction)
      ├─ Receives:
      │  ├─ groupTemplatePlacementActive
      │  ├─ activeGroupTemplateId
      │  ├─ onGroupTemplateCommit
      │  ├─ onGroupTemplateCancelPlacement
      │  └─ groupTemplates from puzzleState
      │
      ├─ Tracks:
      │  └─ mousePos (updated via handleMouseMove)
      │
      └─ Renders:
         ├─ Template Preview (SVG path)
         ├─ Placement Overlay (transparent rect)
         └─ Keyboard Handler (ESC support)
```

## Data Flow

### Placement Activation
```
User clicks "Place" button
    ↓
GroupTemplatePanel.onPlaceTemplate(templateId)
    ↓
App.tsx: setActiveGroupTemplateId(templateId)
    ↓
App.tsx: setGroupTemplatePlacementActive(true)
    ↓
V3Canvas receives updated props
    ↓
Canvas renders preview and enters placement mode
```

### Placement Confirmation
```
User clicks on canvas
    ↓
V3Canvas: onGroupTemplateCommit(point)
    ↓
App.tsx: groupTemplateOps.placeGroupTemplate(templateId, rootId, transform)
    ↓
Creates new GroupInstance area in puzzle state
    ↓
App.tsx: setGroupTemplatePlacementActive(false)
    ↓
Canvas exits placement mode
```

### Placement Cancellation
```
User presses ESC
    ↓
V3Canvas keyboard handler detects ESC
    ↓
V3Canvas: onGroupTemplateCancelPlacement()
    ↓
App.tsx: setGroupTemplatePlacementActive(false)
    ↓
App.tsx: setActiveGroupTemplateId(null)
    ↓
Canvas exits placement mode without creating instance
```

## Key Implementation Details

### Preview Rendering
```tsx
{groupTemplatePlacementActive && activeGroupTemplateId && groupTemplates[activeGroupTemplateId] && (
  <g transform={`translate(${mousePos.x}, ${mousePos.y})`}>
    <path
      d={groupTemplates[activeGroupTemplateId].cachedBoundaryPathData}
      fill="rgba(124, 58, 247, 0.15)"
      stroke="rgba(109, 40, 217, 0.8)"
      strokeWidth={2}
      strokeLinejoin="round"
      fillRule="evenodd"
    />
  </g>
)}
```

### Mouse Position Tracking
- `mousePos` state updated in `handleMouseMove`
- Fires on mouse/touch move events
- Only updates when `groupTemplatePlacementActive` is true

### Coordinate System
- Canvas uses SVG viewport coordinates
- `clientToBoard()` converts screen coordinates to board coordinates
- Transform applied with simple translation:
  ```typescript
  {
    translateX: point.x,
    translateY: point.y,
    rotation: 0,
    flipX: false
  }
  ```

### Visual Styling
- **Preview Fill**: `rgba(124, 58, 247, 0.15)` - Subtle violet background
- **Preview Stroke**: `rgba(109, 40, 217, 0.8)` - Darker violet outline
- **Cursor**: `cursor-crosshair` class for visual feedback
- **Overlay**: Transparent rect with `pointer-events: 'all'` to capture events

## State Management Flow

### In App.tsx
```typescript
// Placement mode activation
const [groupTemplatePlacementActive, setGroupTemplatePlacementActive] = useState(false);
const [activeGroupTemplateId, setActiveGroupTemplateId] = useState<string | null>(null);

// Handlers
const handleGroupTemplateCommit = useCallback((p: Point) => {
  groupTemplateOps.placeGroupTemplate(activeGroupTemplateId, puzzleState.rootAreaId, {
    translateX: p.x, 
    translateY: p.y, 
    rotation: 0, 
    flipX: false
  });
  setGroupTemplatePlacementActive(false);
  setActiveGroupTemplateId(null);
}, [activeGroupTemplateId, groupTemplateOps, puzzleState.rootAreaId]);

const handleGroupTemplateCancelPlacement = useCallback(() => {
  setGroupTemplatePlacementActive(false);
  setActiveGroupTemplateId(null);
}, []);
```

### In V3Canvas.tsx
```typescript
// Props received from App
interface V3CanvasProps {
  groupTemplatePlacementActive: boolean;
  activeGroupTemplateId: string | null;
  onGroupTemplateCommit: (p: Point) => void;
  onGroupTemplateCancelPlacement?: () => void;
  // ... other props
}

// Keyboard handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && groupTemplatePlacementActive && onGroupTemplateCancelPlacement) {
      e.preventDefault();
      onGroupTemplateCancelPlacement();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [groupTemplatePlacementActive, onGroupTemplateCancelPlacement]);
```

## Type Safety
- Uses TypeScript interfaces for type checking
- `GroupTemplate` type from `groupTemplateTypes.ts`
- `Point` type for coordinates
- `PuzzleState` type includes `groupTemplates` record

## Performance Considerations
1. **Template Boundary Caching**: Uses `cachedBoundaryPathData` to avoid recomputing SVG paths
2. **Mouse Position Updates**: Only when placement mode is active
3. **Minimal Re-renders**: State changes only affect necessary components
4. **Efficient SVG Rendering**: Single `<g>` element with transform for smooth following

## Integration with Existing Systems
- **GroupTemplateOps**: Provides `placeGroupTemplate()` method
- **PuzzleState**: Stores all group templates in `groupTemplates` record
- **V3Canvas**: Already had similar patterns for whimsy placement
- **App.tsx**: Coordinates state between all components

## Error Handling
- Checks for `activeGroupTemplateId` before accessing templates
- Verifies template exists in `groupTemplates` record
- Optional `onGroupTemplateCancelPlacement` callback for safety

## Future Extensibility
The current design allows for easy additions:
- **Rotation**: Pass rotation value during placement
- **Scaling**: Could add scale parameter to transform
- **Flipping**: Already support `flipX` in transform
- **Snapping**: Could implement grid snapping in coordinate conversion
- **Validation**: Could add placement validation logic before commit
