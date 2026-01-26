# PNG Export Viewport Reset Fix

## Problem

When clicking "Export PNG", two issues occurred:
1. **Canvas viewport resets visibly** - The user sees the canvas jump/flash during export
2. **Resulting PNG doesn't have all items** - Some items are missing from the exported image

## Root Causes

### Issue 1: Visible Viewport Reset
The export process temporarily removes the canvas transform to get accurate coordinates:
```typescript
contentDiv.style.transform = 'none';  // This causes visible jump!
```

This happens BEFORE the export, so the user sees:
1. Canvas jumps to untransformed position (0, 0)
2. Export happens
3. Canvas jumps back to original position

### Issue 2: Missing Items in PNG
Two problems:
1. **Clamping to canvas bounds**: The export was clamping the calculated bounds to the canvas width/height, which could cut off items that extend beyond the initial canvas size
2. **Incorrect bounds calculation**: Items might not be included if their positions weren't properly validated

## Solution

### Fix 1: Hide Canvas During Export
```typescript
// Hide the canvas container temporarily to prevent visual flash
const canvasContainer = canvasRef.current;
const originalVisibility = canvasContainer.style.visibility;
const originalPointerEvents = canvasContainer.style.pointerEvents;
canvasContainer.style.visibility = 'hidden';
canvasContainer.style.pointerEvents = 'none';

// ... perform export operations ...

// Restore visibility after transform is restored
canvasContainer.style.visibility = originalVisibility;
canvasContainer.style.pointerEvents = originalPointerEvents;
```

**How it works:**
1. Set `visibility: hidden` BEFORE removing transform
2. User doesn't see the canvas jump (it's hidden)
3. Export happens with correct coordinates
4. Restore transform
5. Make canvas visible again
6. User sees no disruption!

### Fix 2: Remove Canvas Bounds Clamping
**Before:**
```typescript
exportOptions = {
  ...exportOptions,
  x: Math.max(0, x),
  y: Math.max(0, y),
  width: Math.max(1, Math.min(selectionWidth, width - x)), // ❌ Clamping!
  height: Math.max(1, Math.min(selectionHeight, height - y)), // ❌ Clamping!
};
```

**After:**
```typescript
exportOptions = {
  ...exportOptions,
  x: Math.max(0, x),
  y: Math.max(0, y),
  width: Math.max(1, selectionWidth), // ✅ No clamping
  height: Math.max(1, selectionHeight), // ✅ No clamping
};
```

**Why this matters:**
- The calculated bounds might be larger than the canvas dimensions
- Content can extend beyond the initial canvas size
- We want to export ALL content, not just what fits in the canvas viewport

### Fix 3: Better Error Handling
Added validation and user feedback:
```typescript
if (!bounds) {
  console.warn('No valid bounds calculated - no items to export');
  toast({ 
    variant: 'destructive', 
    title: 'Export failed', 
    description: 'No items found to export. Please add some content to the canvas.' 
  });
  return;
}
```

Also added debug logging:
```typescript
console.log('Calculated export bounds:', bounds);
console.log('Total items:', {
  nodes: processedNodes.length,
  zones: processedZones.length,
  selectedItems: selectedItemIds.size
});
```

## Changes Made

### `/src/hooks/use-canvas-export.ts`

1. **Added canvas visibility hiding**:
   - Store original visibility and pointer-events
   - Set `visibility: hidden` before transform removal
   - Restore visibility after transform restoration

2. **Removed bounds clamping**:
   - Don't clamp width/height to canvas dimensions
   - Allow export area to extend beyond canvas

3. **Added error handling**:
   - Check if bounds calculation returns null
   - Show user-friendly error message
   - Log debug information

4. **Added dependencies**:
   - Added `processedNodes` and `processedZones` to useCallback deps

## Flow Diagram

### Before (Visible Reset)
```
User clicks Export PNG
  ↓
Remove transform → 🔴 CANVAS JUMPS (visible)
  ↓
Export PNG
  ↓
Restore transform → 🔴 CANVAS JUMPS BACK (visible)
  ↓
Result: User sees flickering/jumping
```

### After (No Visible Reset)
```
User clicks Export PNG
  ↓
Hide canvas (visibility: hidden)
  ↓
Remove transform → ✅ No visible change (hidden)
  ↓
Export PNG
  ↓
Restore transform → ✅ No visible change (hidden)
  ↓
Show canvas (visibility: visible)
  ↓
Result: User sees no disruption!
```

## Benefits

✅ **No viewport reset** - Canvas stays in place during export
✅ **All items included** - No clamping to canvas bounds
✅ **Better UX** - No visible flickering or jumping
✅ **Better error handling** - Clear feedback if export fails
✅ **Debug logging** - Easy to troubleshoot issues

## Testing

### Test 1: Viewport Stability
1. Create a diagram and pan/zoom to a specific view
2. Click Export PNG
3. **Expected**: Canvas should NOT visibly jump or reset
4. **Expected**: After export, canvas should be in same position

### Test 2: All Items Included
1. Create a large diagram with items spread out
2. Pan so some items are off-screen
3. Export PNG
4. **Expected**: PNG should include ALL items, even those off-screen
5. Check console logs to verify bounds calculation

### Test 3: Large Diagrams
1. Create a diagram larger than canvas viewport
2. Export PNG
3. **Expected**: PNG should include all content, not clipped to canvas size

### Test 4: Selected Items
1. Select 2-3 items
2. Export PNG
3. **Expected**: PNG should include only selected items
4. **Expected**: No viewport reset during export

## Console Output Example

When exporting, you should see:
```
Calculated export bounds: { x: 60, y: 60, width: 800, height: 600 }
Total items: { nodes: 5, zones: 2, selectedItems: 0 }
Export with area: { x: 60, y: 60, selectionWidth: 800, selectionHeight: 600, ... }
Final export options: { x: 60, y: 60, width: 800, height: 600, pixelRatio: 6, ... }
```

## Technical Notes

### Why visibility: hidden instead of opacity: 0?
- `visibility: hidden` removes the element from visual rendering but keeps layout
- `opacity: 0` still renders the element, just transparent
- `visibility: hidden` is more performant for this use case

### Why pointer-events: none?
- Prevents any interaction with the canvas during export
- Ensures no mouse events interfere with the export process
- Restored after export completes

### Transform Restoration Order
1. Restore transform on contentDiv
2. Wait for DOM update (requestAnimationFrame)
3. Restore canvas visibility
4. Verify transform is still correct

This order ensures the transform is fully applied before the canvas becomes visible again.

## Conclusion

The export now works smoothly without any visible viewport changes, and all items are properly included in the exported PNG regardless of canvas size or viewport position.
