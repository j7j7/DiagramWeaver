# PNG Export - Test Checklist

## ✅ Issues Fixed

1. **Viewport reset during export** - Canvas no longer jumps/flashes
2. **Missing items in PNG** - All items now included in export

## 🧪 Test Scenarios

### Test 1: No Viewport Reset ⭐ CRITICAL
**Setup:**
- Create a diagram with several nodes
- Pan and zoom to a specific position (e.g., zoomed in on one corner)

**Steps:**
1. Click File → Export as PNG
2. Choose "Full Diagram"
3. Select background color
4. Save the file

**Expected Results:**
- [ ] Canvas does NOT visibly jump or flash during export
- [ ] Canvas stays in the same pan/zoom position after export
- [ ] No flickering or visual disruption

**If this fails:** The visibility hiding isn't working properly

---

### Test 2: All Items Included
**Setup:**
- Create a diagram with 10+ nodes spread across a large area
- Pan so that some nodes are off-screen (outside viewport)

**Steps:**
1. Export PNG (Full Diagram)
2. Open the exported PNG file
3. Count the items in the PNG

**Expected Results:**
- [ ] PNG includes ALL 10+ nodes
- [ ] Items that were off-screen are included
- [ ] No items are cut off or missing
- [ ] Check console logs show correct bounds

**Console should show:**
```
Calculated export bounds: { x: ..., y: ..., width: ..., height: ... }
Total items: { nodes: 10, zones: 0, selectedItems: 0 }
```

---

### Test 3: Large Diagram (Bigger than Canvas)
**Setup:**
- Create a very large diagram (e.g., 3000x3000px worth of content)
- Canvas viewport is only 1920x1080px

**Steps:**
1. Export PNG
2. Check the exported file dimensions

**Expected Results:**
- [ ] PNG is large enough to contain all content
- [ ] PNG dimensions match calculated bounds (not canvas size)
- [ ] No content is clipped at canvas boundaries

---

### Test 4: Selected Items Export
**Setup:**
- Create 10 nodes
- Select only 3 nodes in one corner

**Steps:**
1. Select 3 nodes (Shift+Click)
2. Export PNG
3. Open exported PNG

**Expected Results:**
- [ ] PNG includes only the 3 selected nodes
- [ ] PNG is smaller (reduced scope)
- [ ] No viewport reset during export
- [ ] Console shows `selectedItems: 3`

---

### Test 5: Empty Canvas
**Setup:**
- Empty canvas (no nodes or zones)

**Steps:**
1. Try to export PNG

**Expected Results:**
- [ ] Error toast appears
- [ ] Message: "No items found to export. Please add some content to the canvas."
- [ ] Console shows warning: "No valid bounds calculated"
- [ ] No crash or error

---

### Test 6: Custom Sized Nodes
**Setup:**
- Create nodes with custom sizes (sizeMode: 'custom')
- Set different width/height values

**Steps:**
1. Export PNG
2. Check if custom-sized nodes are fully visible

**Expected Results:**
- [ ] Custom node dimensions are respected
- [ ] No clipping of custom-sized content
- [ ] Bounds calculation includes full custom size

---

### Test 7: Zones and Nested Content
**Setup:**
- Create 2 zones with nested nodes
- Make zones different sizes

**Steps:**
1. Export PNG
2. Verify zones are fully included

**Expected Results:**
- [ ] Zone dimensions are correctly calculated
- [ ] Nested content is included
- [ ] Zone borders are visible in PNG

---

### Test 8: Manual Selection Export
**Setup:**
- Create multiple nodes

**Steps:**
1. File → Export as PNG → Selection
2. Drag a selection rectangle around specific area
3. Release mouse

**Expected Results:**
- [ ] PNG matches the dragged selection area
- [ ] No viewport reset during selection or export
- [ ] Manual selection overrides automatic bounds

---

### Test 9: Different Zoom Levels
**Setup:**
- Create a diagram
- Test at different zoom levels: 50%, 100%, 150%, 200%

**Steps:**
1. Zoom to 50%
2. Export PNG
3. Repeat at 100%, 150%, 200%

**Expected Results:**
- [ ] Export works at all zoom levels
- [ ] PNG content is same regardless of zoom
- [ ] No viewport reset at any zoom level
- [ ] Zoom level doesn't affect PNG output

---

### Test 10: Pan Position
**Setup:**
- Create a diagram
- Pan to different positions (top-left, center, bottom-right)

**Steps:**
1. Pan to top-left corner
2. Export PNG
3. Pan to bottom-right corner
4. Export PNG again

**Expected Results:**
- [ ] Both PNGs are identical (same content)
- [ ] Pan position doesn't affect PNG output
- [ ] Canvas stays at panned position after export

---

## 🔍 Console Logs to Check

During export, look for these logs:

```javascript
✅ Calculated export bounds: { x: 60, y: 60, width: 800, height: 600 }
✅ Total items: { nodes: 5, zones: 2, selectedItems: 0 }
✅ Export with area: { x: 60, y: 60, selectionWidth: 800, selectionHeight: 600 }
✅ Final export options: { x: 60, y: 60, width: 800, height: 600, pixelRatio: 6 }
```

If you see:
```javascript
❌ No valid bounds calculated - no items to export
```
Then there are no items on the canvas.

---

## 🐛 Known Issues to Watch For

### Issue: Canvas flickers during export
**Cause:** Visibility hiding not working
**Check:** Verify `canvasContainer.style.visibility = 'hidden'` is being set

### Issue: PNG is missing items
**Cause:** Bounds calculation issue
**Check:** Console logs for calculated bounds
**Check:** Verify processedNodes and processedZones have items

### Issue: PNG is too small
**Cause:** Bounds clamping (should be fixed)
**Check:** Verify no `Math.min(selectionWidth, width - x)` clamping

### Issue: Export fails silently
**Cause:** Error not being caught
**Check:** Browser console for errors
**Check:** Network tab for failed imports

---

## ✨ Success Criteria

All tests pass if:
- ✅ No visible viewport reset during export
- ✅ All items included in PNG (none missing)
- ✅ PNG size matches content bounds (not canvas size)
- ✅ Selected items export works correctly
- ✅ Error handling works for empty canvas
- ✅ Console logs show correct information

---

## 📊 Before/After Comparison

### Before (Broken)
- ❌ Canvas jumps during export
- ❌ Some items missing from PNG
- ❌ PNG size incorrect
- ❌ No error handling

### After (Fixed)
- ✅ No visible canvas movement
- ✅ All items included
- ✅ Correct PNG size
- ✅ Proper error handling
- ✅ Debug logging
- ✅ Selected items support

---

## 🚀 Quick Test

**Fastest way to verify the fix:**

1. Create 5 nodes on canvas
2. Pan to a random position
3. Zoom to 150%
4. Click Export PNG
5. **Watch the canvas** - it should NOT jump or flash
6. Open the PNG - all 5 nodes should be visible

If these work, the fix is successful! ✅
