# Test Plan for PNG Export Bounds Fix

## Test Scenarios

### Scenario 1: Full Diagram Export (No Selection)
**Setup:**
- Create a diagram with 5 nodes spread across the canvas
- Add 2 zones containing some nodes
- Do NOT select any items

**Steps:**
1. Click File → Export as PNG
2. Choose "Full Diagram" option
3. Select background color (white or transparent)

**Expected Result:**
- PNG should include ALL nodes and zones
- Bounds should be calculated from the outermost items
- 40px padding should be added around all content
- No items should be cut off

### Scenario 2: Selected Items Export (Reduced Scope)
**Setup:**
- Create a diagram with 10 nodes spread across the canvas
- Select only 3 nodes in one corner

**Steps:**
1. Select 3 nodes (Shift+Click or drag selection)
2. Click File → Export as PNG
3. Choose "Full Diagram" option
4. Select background color

**Expected Result:**
- PNG should include ONLY the 3 selected nodes
- Bounds should be calculated from only those 3 nodes
- Export area should be much smaller than full diagram
- 40px padding around the selected items only

### Scenario 3: Manual Selection Export
**Setup:**
- Create a diagram with multiple nodes

**Steps:**
1. Click File → Export as PNG
2. Choose "Selection" option
3. Drag a selection rectangle around specific area
4. Release mouse

**Expected Result:**
- PNG should match the exact area you dragged
- No automatic bounds calculation (uses manual selection)
- Content outside the selection should be excluded

### Scenario 4: Mixed Content (Nodes + Zones)
**Setup:**
- Create 3 regular nodes
- Create 2 zones with nested content
- Select 1 node and 1 zone

**Steps:**
1. Select 1 node and 1 zone
2. Export as PNG

**Expected Result:**
- PNG includes both the selected node and zone
- Zone's full width/height is included
- Bounds calculation respects zone dimensions

### Scenario 5: Custom Sized Nodes
**Setup:**
- Create nodes with custom sizes (sizeMode: 'custom')
- Set different width/height values

**Steps:**
1. Select nodes with custom sizes
2. Export as PNG

**Expected Result:**
- Custom node dimensions are respected
- Bounds calculation uses actual custom width/height
- No clipping of custom-sized content

## Verification Checklist

- [ ] Full diagram export includes all items
- [ ] Selected items export reduces scope correctly
- [ ] Manual selection works as before
- [ ] Padding (40px) is applied correctly
- [ ] Custom node sizes are respected
- [ ] Zone dimensions are calculated correctly
- [ ] No items are cut off in any scenario
- [ ] Export works with both white and transparent backgrounds
- [ ] Console logs show correct bounds calculations

## Debug Output

When testing, check browser console for:
```
Calculated export bounds: { x: ..., y: ..., width: ..., height: ... }
Export with area: { x: ..., y: ..., selectionWidth: ..., selectionHeight: ... }
Final export options: { x: ..., y: ..., width: ..., height: ..., ... }
```

These logs help verify the bounds calculation is working correctly.
