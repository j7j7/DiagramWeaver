# PNG Export Fix - Canvas Size Calculation

## Problem
The save to PNG functionality was not getting the correct canvas size. It wasn't using the fit-to-canvas logic that was recently created and works perfectly.

## Solution
Updated the PNG export functionality to use the same bounds calculation logic as the fit-to-canvas feature. The export now:

1. **Calculates accurate bounds** using the same logic as `handleFitToView` from `use-canvas-transform.ts`
2. **Supports three export modes**:
   - **Full diagram export**: Calculates bounds of all items on canvas
   - **Selected items export**: When items are selected, calculates bounds of only those items (reduced scope)
   - **Manual selection export**: When user drags a selection rectangle, uses that exact area

## Changes Made

### 1. `/src/hooks/use-canvas-export.ts`
- Added new required props: `diagramData`, `processedNodes`, `processedZones`, `selectedItemIds`
- Created `calculateItemBounds()` function that:
  - Filters valid nodes and zones (with proper position validation)
  - Optionally filters by selected item IDs for scoped export
  - Calculates min/max bounds for both nodes and zones
  - Uses `measureNodeDims()` to get accurate dimensions (including custom sizes)
  - Adds 40px padding around content
  - Returns bounds as `{ x, y, width, height }`

- Updated `exportPng()` function to:
  - Check if a selection area was manually provided (from drag selection)
  - If not, calculate bounds automatically:
    - If items are selected (`selectedItemIds.size > 0`), calculate bounds for only those items
    - Otherwise, calculate bounds for all items
  - Use the calculated or provided bounds for the PNG export

### 2. `/src/components/editor/editor-canvas.tsx`
- Updated `useCanvasExport` hook call to pass the new required props:
  - `diagramData`
  - `processedNodes`
  - `processedZones`
  - `selectedItemIds`

## How It Works

### Full Diagram Export
```
User clicks: File → Export as PNG → Full Diagram
↓
exportPng() called with no selectionArea
↓
calculateItemBounds() called with no itemIds filter
↓
Calculates bounds of ALL nodes and zones
↓
Exports PNG with calculated bounds + padding
```

### Selected Items Export
```
User selects 2-3 objects, then: File → Export as PNG → Full Diagram
↓
exportPng() called with no selectionArea
↓
calculateItemBounds() called with selectedItemIds
↓
Calculates bounds of ONLY selected items (reduced scope)
↓
Exports PNG with calculated bounds + padding
```

### Manual Selection Export
```
User clicks: File → Export as PNG → Selection
↓
User drags selection rectangle on canvas
↓
exportPng() called with selectionArea from drag
↓
Uses provided selectionArea directly (no calculation needed)
↓
Exports PNG with exact selection area
```

## Benefits

1. **Accurate bounds**: Uses the same proven logic as fit-to-canvas
2. **Smart scoping**: Automatically reduces export area when items are selected
3. **Consistent behavior**: Same calculation logic across fit-to-canvas and export
4. **Proper dimensions**: Respects custom node sizes and zone dimensions
5. **Clean exports**: Adds appropriate padding around content

## Testing

To test the fix:

1. **Full diagram export**:
   - Create a diagram with nodes and zones
   - File → Export as PNG → Full Diagram
   - Verify PNG includes all items with proper bounds

2. **Selected items export**:
   - Select 2-3 objects on the canvas
   - File → Export as PNG → Full Diagram
   - Verify PNG only includes selected items (reduced scope)

3. **Manual selection export**:
   - File → Export as PNG → Selection
   - Drag a selection rectangle
   - Verify PNG matches the selected area exactly
