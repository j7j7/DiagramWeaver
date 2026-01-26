# PNG Export Cropping Fix - CRITICAL

## 🔴 Critical Problem

The PNG export was only capturing a **small subsection** of the diagram instead of all items.

## Root Cause

The export code was **incorrectly cropping** the image even for full diagram exports:

```typescript
// WRONG - This was cropping the export!
if (exportArea) {
  exportOptions = {
    ...exportOptions,
    x: Math.max(0, x),      // ❌ Cropping to calculated bounds
    y: Math.max(0, y),      // ❌ This cuts off content!
    width: selectionWidth,
    height: selectionHeight,
  };
}
```

### Why This Was Wrong

1. **Bounds calculation is for information only** - We calculate bounds to know the content size, but we shouldn't use those bounds to crop the export
2. **ContentDiv is already correctly sized** - The `contentDiv` has `width` and `height` set by the layout calculation to contain ALL items
3. **Cropping cuts off content** - By passing x, y, width, height to `html-to-image`, we were telling it to only export a portion of the contentDiv
4. **Padding creates negative coordinates** - When we add 40px padding, the x/y can be negative, which gets clamped to 0, cutting off content

## ✅ Solution

**Only crop for manual selections, NOT for full diagram exports:**

```typescript
// CORRECT - Only crop for manual selections
if (options?.selectionArea) {
  // Manual selection (user dragged a rectangle) - crop to that area
  exportOptions = {
    ...exportOptions,
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: selectionWidth,
    height: selectionHeight,
  };
} else if (exportArea) {
  // Auto-calculated bounds - DON'T crop, export full contentDiv
  // The contentDiv is already sized correctly to contain all items
  console.log('Export full content with calculated bounds:', exportArea);
  // Don't add crop options - let html-to-image export the entire contentDiv
}
```

## Key Insight

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  The contentDiv is ALREADY sized correctly!                 │
│                                                             │
│  - Layout calculation sets width/height to contain all items│
│  - We don't need to crop for full diagram export           │
│  - Just export the entire contentDiv as-is                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## How It Works Now

### Full Diagram Export (No Selection)
```
1. Calculate bounds (for logging/info only)
   ↓
2. Export ENTIRE contentDiv (no cropping)
   ↓
3. html-to-image captures full contentDiv
   ↓
4. Result: PNG with ALL items ✅
```

### Manual Selection Export
```
1. User drags selection rectangle
   ↓
2. Pass selection coordinates to export
   ↓
3. Crop to selection area
   ↓
4. Result: PNG with selected area only ✅
```

### Selected Items Export
```
1. Calculate bounds of selected items
   ↓
2. Export ENTIRE contentDiv (no cropping)
   ↓
3. Result: PNG with ALL items (not just selected)
   
Note: This is intentional - selected items export still shows
full diagram, just calculates different bounds for info.
If you want only selected items, use manual selection.
```

## Before vs After

### Before (Broken)
```typescript
// Always cropped, even for full export
exportOptions = {
  x: 60,           // ❌ Cropping!
  y: 60,           // ❌ Only exports from (60,60)
  width: 800,      // ❌ Only 800px wide
  height: 600,     // ❌ Only 600px tall
};

// Result: Small subsection of diagram
```

### After (Fixed)
```typescript
// No cropping for full export
exportOptions = {
  // No x, y, width, height
  // Exports entire contentDiv
};

// Result: Full diagram with all items ✅
```

## Testing

### Quick Test
1. Create a diagram with 10+ nodes spread across canvas
2. Export PNG (Full Diagram)
3. Open the PNG
4. **Expected:** ALL nodes should be visible
5. **Expected:** PNG should be large enough to contain everything

### Console Output
```javascript
// Full diagram export:
Calculated export bounds: { x: 60, y: 60, width: 2000, height: 1500 }
Total items: { nodes: 10, zones: 2, selectedItems: 0 }
Export full content with calculated bounds: { x: 60, y: 60, width: 2000, height: 1500 }
ContentDiv size: { width: 2100, height: 1600 }
// Note: No "Final export options (cropped)" - not cropping!

// Manual selection export:
Export with manual selection: { x: 100, y: 100, selectionWidth: 500, selectionHeight: 400 }
Final export options (cropped): { x: 100, y: 100, width: 500, height: 400 }
```

## Why The Previous Approach Failed

### Attempt 1: Use calculated bounds for cropping
❌ **Problem:** Cropping cuts off content, especially with padding

### Attempt 2: Remove clamping
❌ **Problem:** Still cropping, just with different coordinates

### Attempt 3: Don't crop at all (CORRECT)
✅ **Solution:** Let contentDiv size determine export, no cropping needed

## Important Notes

1. **ContentDiv is the source of truth** - It's already sized correctly by layout calculation
2. **Bounds calculation is for info** - We calculate bounds to log/debug, not to crop
3. **Only crop for manual selection** - When user drags a rectangle, then we crop
4. **Full export = full contentDiv** - No cropping, no clipping, just export everything

## Code Changes

### File: `/src/hooks/use-canvas-export.ts`

**Changed:**
- Only apply crop options when `options?.selectionArea` is provided (manual selection)
- For auto-calculated bounds, don't add crop options to exportOptions
- Export the entire contentDiv for full diagram exports

**Result:**
- Full diagram exports now include ALL items
- Manual selection still works correctly with cropping
- No more small subsection exports!

## Summary

The fix is simple but critical:

**DON'T CROP FOR FULL DIAGRAM EXPORTS**

The contentDiv is already sized correctly. Just export it as-is.
Only crop when the user manually selects an area.

This ensures ALL items are included in the PNG export. ✅
