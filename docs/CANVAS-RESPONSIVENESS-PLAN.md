# Canvas Editor Responsiveness Optimization Plan

Optimizations to implement one at a time. Build → test → move to next.

---

## Status

| # | Optimization | Done |
|---|--------------|------|
| 1 | Debounce context toolbar label updates | ☑ |
| 2 | Throttle drag position updates | ☑ |
| 3 | Memoize DiagramNode | ☑ |
| 4 | Stabilize callback references in editor-canvas | ☑ |
| 5 | Memoize CanvasConnections | ☑ |
| 6 | Memoize CanvasArrowToggles | ☑ |
| 7 | Memoize CanvasConnectionText | ☑ |
| 8 | Use React.startTransition for label updates | ☑ |
| 9 | Throttle alignment guide calculation | ☐ (reverted: RAF+setState caused infinite loop)
| 10 | Memoize layout / connection slots | ☑ |
| 11 | Selection animation: reduce update rate | ☐ |
| 12 | Memoize layers getFilteredDiagramData | ☑ |
| 13 | Throttle resize updates (text/shapes) | ☑ |

---

## 1. Debounce context toolbar label updates

**File**: `src/components/editor/context-toolbar.tsx`

**Tasks**:
- Add local state `labelInputValue` for the label field
- Sync `labelInputValue` from `selectedItem?.label` when selection changes
- On `onChange`: update `labelInputValue` immediately; debounce (350ms) the call to `onItemUpdate`
- On `onBlur` and Enter: flush debounced value immediately
- Clean up debounce on unmount

---

## 2. Throttle drag position updates

**File**: `src/hooks/use-canvas-drag-drop.ts`

**Tasks**:
- Add ref for pending position; add ref for `requestAnimationFrame` id
- In `hover` callback: compute position, store in ref; schedule RAF if not already scheduled
- RAF callback: read ref, call `setDragPosition`/`setMultiDragPositions`, clear RAF id
- On `drop`: apply final position; cancel any pending RAF
- Clean up RAF on unmount

---

## 3. Memoize DiagramNode

**File**: `src/components/diagram/diagram-node.tsx`

**Tasks**:
- Create `arePropsEqual` comparator (node.id, node.x, node.y, node.label, node.width, node.height, isSelected, isMultiSelected, stackZIndex)
- Wrap component in `React.memo(DiagramNode, arePropsEqual)`
- Export memoized version (Optimization 4 must be done first for memo to be effective)

---

## 4. Stabilize callback references in editor-canvas

**File**: `src/components/editor/editor-canvas.tsx`

**Tasks**:
- Wrap `handleNodeClick` in `useCallback` with correct deps
- Wrap `handleNodeContextMenu` in `useCallback` with correct deps
- Wrap `handleZoneClick` in `useCallback` with correct deps
- Wrap `handleZoneContextMenu` in `useCallback` with correct deps
- Verify `handleHoverChange` has correct deps (already uses useCallback)

---

## 5. Memoize CanvasConnections

**File**: `src/components/editor/canvas-connections.tsx`

**Tasks**:
- Create `arePropsEqual` comparator (connectionIndices, nodesById, zonesById, diagramData.connections, selectedItemId, stackZIndex, width, height)
- Wrap in `React.memo(CanvasConnections, arePropsEqual)`
- Export memoized version

---

## 6. Memoize CanvasArrowToggles

**File**: `src/components/editor/canvas-arrow-toggles.tsx`

**Tasks**:
- Create comparator for props
- Wrap in `React.memo`
- Export memoized version

---

## 7. Memoize CanvasConnectionText

**File**: `src/components/editor/canvas-connection-text.tsx`

**Tasks**:
- Create comparator for props
- Wrap in `React.memo`
- Export memoized version

---

## 8. Use React.startTransition for label updates

**File**: `src/components/diagram-editor.tsx`

**Tasks**:
- In `handleLabelUpdate`: wrap `setDiagramData` and `setSelectedItem` in `startTransition(() => { ... })`
- Import `startTransition` from `react`

---

## 9. Throttle alignment guide calculation

**File**: `src/hooks/use-alignment-guides.ts`

**Status**: Reverted. RAF + setState caused infinite loop (setState → re-render → new displayNodesById ref → effect deps change → effect runs → setState…).

**Tasks** (if retried):
- Alternative: throttle at call site (e.g. parent passes throttled input refs)
- Or: move guide computation to a worker (complex)

---

## 10. Memoize layout / connection slots

**File**: `src/components/editor/editor-canvas.tsx`

**Tasks**:
- Verify `calculateLayout` useMemo depends only on `diagramData`
- Verify `nodesById` and `zonesById` useMemo deps are minimal
- Verify `connectionSlots` useMemo deps are minimal

---

## 11. Selection animation: reduce update rate

**File**: `src/hooks/use-sine-wave-animation.ts`

**Tasks**:
- Limit updates to ~30fps (skip every other RAF) or use CSS animation
- Option: pause animation when tab not visible (`document.visibilityState`)

---

## 12. Memoize layers getFilteredDiagramData

**File**: `src/hooks/use-layers.ts`

**Tasks**:
- Find `getFilteredDiagramData` implementation
- Memoize result with `useMemo` (deps: diagramData, layer config)

---

## 13. Resize responsiveness (text/shapes) ✅

**Problem**: When resizing text nodes or shapes via drag handles, responsiveness was slow. RAF throttling (previous approach) delayed visual updates until next frame and still caused parent re-renders.

**Solution (implemented)**: Local optimistic state during resize. `resizeDimensions` state in diagram-node updates on every mouse move; container and shapes use these for instant visual feedback. `onResize` is called only on resize end, so no parent/diagram updates during drag.

**Files**: `src/components/diagram/diagram-node.tsx`, `src/components/diagram/shapes/shape-wrapper.tsx`, `src/components/diagram/shapes/svg-shape-base.tsx`

**Changes**:
- Added `resizeDimensions: { width, height } | null` state; `displayWidth`/`displayHeight` computed from it when set
- Container style uses `displayWidth`/`displayHeight` when resizing
- ShapeWrapper and SvgShapeBase accept `overrideWidth`/`overrideHeight` for instant shape resize
- `handleResizeMove` calls `setResizeDimensions` on every move; `handleResizeEnd` flushes to `onResize` and clears

---

## Order

1 → 2 → 4 → 3 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13
