# PNG Export Logic Flow

## Overview
The PNG export now uses the same bounds calculation logic as the fit-to-canvas feature, ensuring accurate canvas sizing.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Initiates Export                     │
│                  (File → Export as PNG)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  exportPng() called   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Check for manual      │
              │ selection area?       │
              └──────────┬───────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼ YES                           ▼ NO
┌────────────────┐           ┌──────────────────────┐
│ Use provided   │           │ Calculate bounds     │
│ selection area │           │ automatically        │
└────────────────┘           └──────────┬───────────┘
         │                               │
         │                               ▼
         │                    ┌──────────────────────┐
         │                    │ Check if items are   │
         │                    │ selected?            │
         │                    └──────────┬───────────┘
         │                               │
         │               ┌───────────────┴───────────────┐
         │               │                               │
         │               ▼ YES                           ▼ NO
         │    ┌──────────────────────┐      ┌──────────────────────┐
         │    │ calculateItemBounds  │      │ calculateItemBounds  │
         │    │ (selectedItemIds)    │      │ (all items)          │
         │    └──────────┬───────────┘      └──────────┬───────────┘
         │               │                               │
         │               │  ┌────────────────────────────┘
         │               │  │
         │               ▼  ▼
         │    ┌──────────────────────────────┐
         │    │ Calculate min/max bounds:    │
         │    │ - Filter valid nodes/zones   │
         │    │ - Get accurate dimensions    │
         │    │ - Find min/max X/Y           │
         │    │ - Add 40px padding           │
         │    └──────────┬───────────────────┘
         │               │
         └───────────────┴────────────────┐
                         │                │
                         ▼                │
              ┌──────────────────────┐   │
              │ Export PNG with      │   │
              │ calculated bounds    │   │
              └──────────────────────┘   │
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │ Save PNG to disk     │
                              └──────────────────────┘
```

## Key Functions

### calculateItemBounds(itemIds?: Set<string>)
```typescript
Input:  Optional set of item IDs to filter by
Output: { x, y, width, height } or null

Logic:
1. Filter processedNodes and processedZones
   - Validate positions (no NaN, finite numbers)
   - If itemIds provided, only include those items
   
2. Calculate bounds for nodes
   - Use measureNodeDims() for accurate dimensions
   - Respect custom sizes (sizeMode: 'custom')
   - Track min/max X/Y coordinates
   
3. Calculate bounds for zones
   - Use zone.width and zone.height
   - Track min/max X/Y coordinates
   
4. Combine bounds
   - minX = min(nodeMinX, zoneMinX)
   - minY = min(nodeMinY, zoneMinY)
   - maxX = max(nodeMaxX, zoneMaxX)
   - maxY = max(nodeMaxY, zoneMaxY)
   
5. Add padding and return
   - x = minX - 40
   - y = minY - 40
   - width = (maxX - minX) + 80
   - height = (maxY - minY) + 80
```

### exportPng(options?)
```typescript
Input:  Optional { backgroundColor, selectionArea }
Output: PNG file saved to disk

Logic:
1. Check if selectionArea provided
   - If YES: Use it directly (manual selection)
   - If NO: Calculate automatically
   
2. If calculating automatically:
   - Check if selectedItemIds.size > 0
     - If YES: Call calculateItemBounds(selectedItemIds)
     - If NO: Call calculateItemBounds() for all items
   
3. Apply bounds to export options
   - Set x, y, width, height for html-to-image
   - Clamp to canvas boundaries
   
4. Export PNG with html-to-image library
5. Save using File System Access API or download
```

## Benefits of This Approach

1. **Reuses proven logic**: Same calculation as fit-to-canvas
2. **Smart scoping**: Automatically adjusts to selection
3. **Flexible**: Supports manual selection override
4. **Accurate**: Respects custom dimensions and zone sizes
5. **Clean output**: Consistent padding around content

## Example Scenarios

### All Items Export
```
Canvas: 1000x1000px with 5 nodes
Nodes: Positions (100,100), (200,200), (300,300), (400,400), (500,500)
Node size: 80x50px each

Calculation:
- minX = 100, minY = 100
- maxX = 580 (500 + 80), maxY = 550 (500 + 50)
- With padding: x=60, y=60, width=600, height=570

Result: PNG is 600x570px (much smaller than 1000x1000)
```

### Selected Items Export
```
Canvas: Same as above
Selected: Only nodes at (100,100) and (200,200)

Calculation:
- minX = 100, minY = 100
- maxX = 280 (200 + 80), maxY = 250 (200 + 50)
- With padding: x=60, y=60, width=300, height=270

Result: PNG is 300x270px (even smaller, focused on selection)
```

### Manual Selection
```
User drags rectangle: (150,150) to (350,350)

Calculation:
- Uses provided coordinates directly
- No automatic calculation

Result: PNG is exactly 200x200px matching selection
```
