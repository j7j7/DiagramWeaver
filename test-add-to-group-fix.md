# Test Case: Add to Group Functionality

## Issue Description
When having an existing group of three items, clicking on another item that isn't a member of that group and clicking "Add to Group" doesn't work. Error says "selected items are from different groups removed from the groups first" even though the new item wasn't part of a group.

## Root Cause
The "Add to Group" functionality was incorrectly calling `createGroup()` instead of `addToGroup()`. The `createGroup()` function has logic that prevents mixing grouped and ungrouped items, while `addToGroup()` is specifically designed to add items to an existing group.

## Fix Applied
1. Added `addToGroup` import to diagram-editor.tsx
2. Created `handleAddToGroup()` function that properly uses `addToGroup()` utility
3. Added `onAddToGroupItems` prop to EditorCanvas interface and implementation
4. Updated the context menu `onAddToGroup` handler to call the correct function

## Expected Behavior After Fix
- Select multiple items (some grouped, some ungrouped)
- Right-click on an item that belongs to the target group
- Click "Add to Group" 
- All selected items should be added to the existing group without error

## Files Modified
- `/src/components/diagram-editor.tsx`: Added `handleAddToGroup` function and passed it to EditorCanvas
- `/src/components/editor/editor-canvas.tsx`: Added `onAddToGroupItems` prop and updated context menu handler
- `/src/lib/grouping-utils.ts`: No changes needed (already had correct `addToGroup` function)

## Test Steps
1. Create a group with 3 items
2. Add a 4th item to the canvas (not in any group)
3. Select the 4th item
4. Right-click on one of the grouped items
5. Select "Add to Group" from context menu
6. Expected: All selected items are added to the group
7. Expected: Success toast message appears