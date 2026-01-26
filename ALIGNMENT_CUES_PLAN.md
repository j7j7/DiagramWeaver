# Visual Alignment Cues - Implementation Plan

## Overview
Add visual alignment guides that appear when dragging objects on the canvas to help with manual alignment. Green semi-transparent lines should appear when objects align horizontally or vertically with other objects.

## Requirements Analysis

### Scenario
1. User has a rectangle object on the canvas
2. User drags a node item onto the canvas next to it
3. User resizes the rectangle to be a larger container
4. User drags the node icon towards and inside the rectangle
5. **When node center aligns with rectangle center (horizontal or vertical)**: Show green semi-transparent line
6. **When node is dead center (both H and V aligned)**: Show both horizontal and vertical green lines

### Scope
- Works for all draggable objects: nodes (icons, shapes, text, textbox), zones, rectangles
- Shows alignment to ANY other object on canvas (not just parent zones)
- Real-time visual feedback during drag operations
- Non-intrusive (semi-transparent green lines)

## Technical Architecture

### 1. Data Structures

#### Alignment Guide Definition
```typescript
interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number; // Y coordinate for horizontal, X coordinate for vertical
  referenceItemId: string; // ID of the item we're aligning to
  alignmentType: 'center' | 'top' | 'bottom' | 'left' | 'right'; // Type of alignment
}
```

#### Bounding Box Helper
```typescript
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}
```

### 2. Core Algorithm

#### Step 1: Calculate Bounding Boxes
For each object on canvas, calculate its bounding box including:
- Position (x, y)
- Dimensions (width, height)
- Center point (centerX, centerY)
- Edges (top, bottom, left, right)

Objects to consider:
- All nodes (use `measureNodeDims` from canvas-constants.ts)
- All zones
- Exclude: currently dragged item(s), hidden/locked items

#### Step 2: Detect Alignments During Drag
When dragging an item, check if its center/edges align with any other item's center/edges within a **tolerance threshold** (e.g., 5 pixels in diagram space).

Alignment types to detect:
1. **Vertical Center Alignment**: Dragged item's centerX ≈ Other item's centerX
2. **Horizontal Center Alignment**: Dragged item's centerY ≈ Other item's centerY
3. **Top Edge Alignment**: Dragged item's top ≈ Other item's top
4. **Bottom Edge Alignment**: Dragged item's bottom ≈ Other item's bottom
5. **Left Edge Alignment**: Dragged item's left ≈ Other item's left
6. **Right Edge Alignment**: Dragged item's right ≈ Other item's right

#### Step 3: Prioritize and Filter
- **Priority**: Center alignments > Edge alignments
- **Multiple alignments**: Show multiple guides if aligned to different objects
- **Same axis**: If multiple items align on same axis, show the guide to the nearest item
- **Performance**: Only check visible items within viewport

### 3. Implementation Files

#### New File: `src/hooks/use-alignment-guides.ts`
Custom hook to calculate alignment guides during drag operations.

**Responsibilities:**
- Calculate bounding boxes for all relevant items
- Detect alignments during drag
- Return active alignment guides

**Hook Signature:**
```typescript
interface UseAlignmentGuidesOptions {
  diagramData: DiagramData;
  displayNodesById: Record<string, PositionedNode>;
  displayZonesById: Record<string, PositionedGroup>;
  draggedItemId: string | null;
  draggedItemIds: Set<string>; // For multi-select drag
  transform: { x: number; y: number; k: number };
  enabled: boolean; // Feature flag
}

interface UseAlignmentGuidesReturn {
  guides: AlignmentGuide[];
}

export function useAlignmentGuides(options: UseAlignmentGuidesOptions): UseAlignmentGuidesReturn
```

#### New Component: `src/components/editor/canvas-alignment-guides.tsx`
Renders the visual alignment guide lines.

**Responsibilities:**
- Render green semi-transparent SVG lines
- Position lines correctly in diagram space
- Handle transform (zoom/pan) correctly

**Component Signature:**
```typescript
interface CanvasAlignmentGuidesProps {
  guides: AlignmentGuide[];
  width: number;
  height: number;
  transform: { x: number; y: number; k: number };
}

export function CanvasAlignmentGuides(props: CanvasAlignmentGuidesProps): JSX.Element
```

#### Modified File: `src/components/editor/editor-canvas.tsx`
Integrate alignment guides into the canvas.

**Changes:**
1. Import and use `useAlignmentGuides` hook
2. Pass calculated guides to `CanvasAlignmentGuides` component
3. Add feature flag for enabling/disabling (default: enabled)

### 4. Visual Design

#### Guide Line Appearance
- **Color**: `rgb(34, 197, 94)` (Tailwind green-500)
- **Opacity**: 0.5 (semi-transparent)
- **Width**: 1.5px (visible but not intrusive)
- **Style**: Solid line
- **Z-index**: Above zones, below nodes (z-10)

#### Line Extent
- **Vertical lines**: Span full canvas height
- **Horizontal lines**: Span full canvas width
- **Alternative**: Span only between aligned items (less intrusive)

### 5. Performance Considerations

#### Optimization Strategies
1. **Throttle calculations**: Run alignment detection at most every 16ms (60fps)
2. **Spatial partitioning**: Only check items within reasonable distance (e.g., 500px)
3. **Memoization**: Cache bounding boxes when items haven't moved
4. **Early exit**: Stop checking once sufficient guides found (max 2-3 guides)
5. **Viewport culling**: Ignore items outside viewport

#### Performance Targets
- No noticeable lag during drag operations
- Smooth 60fps rendering
- Memory efficient (no memory leaks)

### 6. Edge Cases and Constraints

#### Multi-Select Drag
- Calculate bounding box of entire selection (union of all selected items)
- Show guides relative to the selection's center/edges

#### Nested Zones
- Show guides for alignment with both parent zone and sibling items
- Prioritize sibling alignments over parent alignments

#### Line Nodes
- Use actual line bounds (min/max of startPos/endPos)
- Align to line center point, not container position

#### Rotated Objects
- Calculate axis-aligned bounding box (AABB) for rotated items
- Alignment based on AABB, not rotated bounds

#### Zoomed Canvas
- All calculations in diagram space (before zoom transform)
- Render guides in diagram space (they'll scale with zoom)

### 7. User Preferences

#### Feature Flag
- Add setting in preferences: "Show Alignment Guides" (default: true)
- Store in localStorage: `dw:alignmentGuides:enabled`
- Toggle via View menu or keyboard shortcut (Cmd/Ctrl+Shift+A)

#### Customization Options (Future)
- Guide color
- Tolerance threshold (5-20px)
- Guide style (solid, dashed)
- Show edge alignments vs. center only

### 8. Testing Plan

#### Manual Testing Scenarios
1. **Basic alignment**: Drag node to align with rectangle center (horizontal and vertical)
2. **Multiple objects**: Drag node with 3+ objects on canvas, verify correct alignment detection
3. **Multi-select**: Drag multiple selected items, verify alignment of selection group
4. **Nested zones**: Drag item into zone, verify alignment with zone and siblings
5. **Line objects**: Drag line node, verify alignment works correctly
6. **Rotated objects**: Drag rotated shapes, verify alignment still works
7. **Zoomed canvas**: Test at various zoom levels (50%, 100%, 200%)
8. **Performance**: Test with 50+ objects on canvas

#### Validation Checks
- ✅ Guides appear/disappear smoothly without flickering
- ✅ Guides are pixel-perfect aligned
- ✅ No performance degradation during drag
- ✅ Works with keyboard nudging (arrow keys)
- ✅ Guides respect viewport bounds
- ✅ Feature flag works correctly

### 9. Implementation Steps

#### Phase 1: Core Hook (2-3 hours)
1. Create `use-alignment-guides.ts`
2. Implement bounding box calculation
3. Implement alignment detection algorithm
4. Add tolerance threshold and filtering
5. Write unit tests for alignment logic

#### Phase 2: Visual Component (1-2 hours)
1. Create `canvas-alignment-guides.tsx`
2. Implement SVG line rendering
3. Handle transform calculations
4. Style guides (color, opacity, width)
5. Test rendering at various zoom levels

#### Phase 3: Integration (1-2 hours)
1. Modify `editor-canvas.tsx`
2. Wire up hook and component
3. Add feature flag
4. Handle multi-select case
5. Test with existing drag operations

#### Phase 4: Polish and Optimization (1-2 hours)
1. Add throttling/debouncing
2. Implement spatial partitioning
3. Add viewport culling
4. Performance profiling
5. Fix any edge cases

#### Phase 5: User Preferences (1 hour)
1. Add localStorage persistence
2. Add menu toggle
3. Add keyboard shortcut
4. Update documentation

**Total Estimated Time: 6-10 hours**

## Implementation Priority

### Must Have (MVP)
✅ Center-to-center alignment (horizontal and vertical)
✅ Works for nodes and zones
✅ Green semi-transparent lines
✅ Appears during drag operations

### Should Have
✅ Edge alignment (top, bottom, left, right)
✅ Multi-select support
✅ Feature flag / preferences
✅ Performance optimization

### Nice to Have (Future)
- Snap-to-guide (magnetic alignment)
- Distance labels on guides
- Multiple guide colors for different alignment types
- Keyboard shortcut to temporarily disable guides
- Smart guide prioritization (show most relevant only)

## Dependencies

### Existing Code to Leverage
- ✅ `measureNodeDims()` from `canvas-constants.ts` - Calculate node dimensions
- ✅ `displayNodesById` and `displayZonesById` - Already includes drag position overrides
- ✅ `dragPosition` and `multiDragPositions` from `useCanvasDragDrop` - Track drag state
- ✅ `transform` - Canvas zoom/pan state
- ✅ Existing SVG rendering pattern from `CanvasConnections` component

### No Breaking Changes
- Implementation is additive (new hook + component)
- Existing drag logic unchanged
- Existing rendering order maintained
- Feature flag allows disabling if issues arise

## Success Criteria

1. ✅ Visual guides appear when objects align during drag
2. ✅ Guides are smooth and non-flickering
3. ✅ No performance impact on drag operations
4. ✅ Works with all object types (nodes, zones, shapes, text, lines)
5. ✅ Works correctly with multi-select
6. ✅ Respects zoom/pan transformations
7. ✅ User can enable/disable feature
8. ✅ No breaking changes to existing functionality

## Risks and Mitigations

### Risk: Performance Impact
**Mitigation**: 
- Implement throttling and spatial partitioning
- Profile with large diagrams (50+ objects)
- Add feature flag for easy disable

### Risk: Visual Clutter
**Mitigation**:
- Use semi-transparent lines
- Show only most relevant guides (limit to 2-3)
- Prioritize center alignments over edges

### Risk: Inaccurate Alignment Detection
**Mitigation**:
- Careful bounding box calculation for all node types
- Handle rotated objects correctly (use AABB)
- Test with all object types

### Risk: Breaking Existing Drag Behavior
**Mitigation**:
- Keep implementation isolated (new hook + component)
- No changes to drag position calculation
- Extensive testing with existing features

## Future Enhancements

1. **Snap-to-Guide**: Magnetic alignment that snaps items to guides
2. **Smart Guides**: AI-powered guide suggestions based on common layouts
3. **Distribution Guides**: Show equal spacing between multiple items
4. **Dimension Display**: Show distances and dimensions near guides
5. **Guide Presets**: Save and load custom guide configurations
6. **Polar Coordinates**: Radial alignment guides for circular layouts
7. **Grid Alignment**: Align to virtual grid points
8. **Multi-Object Alignment**: Show guides when multiple items form patterns
