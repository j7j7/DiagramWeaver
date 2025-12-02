# Multi-Select Property Changes Test

## Test Plan

### 1. Multi-Select Functionality
- [ ] Select first item normally (click)
- [ ] Hold Shift and click second item (should add to selection)
- [ ] Hold Shift and click third item (should add to selection)
- [ ] Hold Shift and click selected item again (should remove from selection)
- [ ] Click without Shift (should clear multi-select and select only clicked item)

### 2. Text Styling Changes
- [ ] Multi-select 2-3 items
- [ ] Change font size - should only change font size for all selected items
- [ ] Change text color - should only change text color for all selected items
- [ ] Change font family - should only change font family for all selected items
- [ ] Change text alignment - should only change text alignment for all selected items
- [ ] Verify other properties (like font weight, etc.) remain unchanged

### 3. Visual Styling Changes
- [ ] Multi-select 2-3 items
- [ ] Change border color - should only change border color for all selected items
- [ ] Change background color - should only change background color for all selected items
- [ ] Change border width - should only change border width for all selected items
- [ ] Toggle shadow - should only change shadow property for all selected items
- [ ] Verify other visual properties remain unchanged

### 4. Reset Functionality
- [ ] Multi-select items with various styling
- [ ] Use text styling reset - should reset only text properties for all selected items
- [ ] Use visual styling reset - should reset only visual properties for all selected items

### 5. Edge Cases
- [ ] Multi-select nodes and zones together
- [ ] Apply styling changes - should work for both types
- [ ] Single item selection - should work as before
- [ ] No selection - styling panels should not be visible

## Implementation Details

The implementation modifies the `handleTextStylingChange` and `handleVisualStylingChange` functions in `context-toolbar.tsx` to:

1. Check if multiple items are selected (`selectedItemIds.size > 1`)
2. If multi-select: Apply property changes to all selected items via `onDiagramDataUpdate`
3. If single-select: Use existing `onItemUpdate` logic
4. Only the specific property that changed is applied, preserving all other properties

The styling panels themselves remain unchanged - they continue to call `onStylingChange` with only the modified property.