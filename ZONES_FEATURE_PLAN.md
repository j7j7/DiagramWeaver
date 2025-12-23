# Circular Zones and Advanced Layout Feature (Completed)

## Implementation Summary

I have successfully implemented the requested features for Circular Zones and advanced item ordering, and fixed resizing and positioning issues.

### Key Features Added:
1.  **Circular Zones**:
    -   You can now toggle any Zone to a "Circular Layout" via the context menu.
    -   Circular zones automatically arrange their items in a perfect circle.
    -   The zone shape updates to a circle (`rounded-full`) when in this mode.
    -   Sizing is dynamic and "tight", ensuring the circle is just large enough to fit the items (plus padding), and always maintains a perfect 1:1 aspect ratio.
    -   **Single Item**: If a circular zone contains only one item, that item is perfectly centered.
    -   **Dragging Fix**: When dragging a circular (or free layout) zone, the size now remains consistent. The layout engine correctly calculates the bounding box of content (`maxX - minX`, etc.) rather than relying on absolute positions.
    -   **Centering & Positioning Fix**: 
        -   Items are now correctly positioned *inside* the zone.
        -   The `layoutCircularZone` function now stores **relative** coordinates (instead of absolute), which matches how `setAbsolutePositionsForZone` expects child coordinates to be (relative to parent).
        -   The `layoutZone` auto-layout function now robustly normalizes coordinates by shifting content to the target padding (`targetMinX - minX`), ensuring that regardless of whether input coordinates were absolute or relative, the output is correctly relative to the zone origin. This fixes the issue where items appeared "double-shifted" far outside the zone.

2.  **Advanced Ordering**:
    -   **Cycle Items**: Rotate the position of items within the zone (works for both Grid and Circular layouts).
    -   **Sort A-Z / Z-A**: Instantly reorder items alphabetically based on their labels.

3.  **Layout Management**:
    -   **Grid Layout**: Reverts the zone to the standard grid/auto-sizing behavior.
    -   **Drag & Drop**: Fully supported. Dragging items into/out of circular zones works as expected. The zone will resize to fit the new content while maintaining its circular shape.

### Technical Details:
-   **New Logic**: Created `src/lib/zone-layout-utils.ts` to handle the specific geometry calculations for circular layouts and sorting logic.
-   **Rendering**: Updated `DiagramZone` to visually render as a circle when the `layoutType` is set to `circular`.
-   **Auto-Layout Engine**: Updated `canvas-layout-utils.ts` to:
    -   Respect the circular layout constraint (force square aspect ratio).
    -   Use relative bounding box calculations for stable sizing during drag.
    -   Apply robust visual shifting to center content within the calculated zone bounds, handling both relative and absolute input coordinates gracefully.
-   **Context Menu**: Extended the Zone context menu with a new "Layout & Order" section containing these actions.

### Usage:
1.  **Right-click** on any Zone.
2.  Look for the **"Layout & Order"** section.
3.  Select **"Circular Layout"** to switch modes.
4.  Use **"Cycle Items"** or **"Sort A-Z"** to arrange your items.
