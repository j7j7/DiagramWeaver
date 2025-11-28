# Grouping Feature Implementation Plan

## Overview
Implement a visual grouping system that allows users to group multiple canvas items together, similar to design tools like Figma, Adobe XD, or Sketch. Groups should be distinct from existing "zones" which are container elements with visual backgrounds.

## Key Requirements

### User Interactions
1. **Create Group**: Select multiple items → Right-click → "Group Items"
2. **Add to Group**: Select ungrouped items + grouped items → Right-click → "Add to Group"
3. **Remove from Group**: Select grouped items → Right-click → "Remove from Group"
4. **Ungroup**: Select group → Right-click → "Ungroup"
5. **Visual Feedback**: 
   - Individual items: Blue selection box (existing)
   - Group members: Green selection boxes when any member is selected
   - All group members move together maintaining relative positions

### Data Structure

#### New Type: DiagramGroupingData
```typescript
export interface DiagramGroupingData {
  id: string;
  type: 'grouping'; // Distinct from 'zone'
  memberIds: string[]; // IDs of nodes/zones that are grouped
  label?: string; // Optional group name
  locked?: boolean; // Prevent ungrouping/modifications
}
```

#### Updates to Existing Types
```typescript
// Add to DiagramNodeData and DiagramZoneData
interface DiagramNodeData {
  // ... existing properties
  groupId?: string; // Reference to parent grouping
}

interface DiagramZoneData {
  // ... existing properties
  groupId?: string; // Reference to parent grouping
}

// Add to DiagramData
interface DiagramData {
  nodes: DiagramNodeData[];
  connections: DiagramConnectionData[];
  zones: DiagramZoneData[];
  groupings?: DiagramGroupingData[]; // New array for groups
  // ... other properties
}

// Add to HierarchicalDiagramData for save/load
interface HierarchicalDiagramData {
  zones: DiagramZoneItem[];
  connections: DiagramConnectionData[];
  groupings?: DiagramGroupingData[]; // Flat list in hierarchical format too
  metadata?: any;
  layers?: LayersConfig;
}
```

## Implementation Steps

### Phase 1: Data Layer
**Files to modify:**
- `src/lib/types.ts` - Add new grouping types
- `src/lib/schemas.ts` - Add Zod schemas for validation
- `src/lib/nested-hierarchy.ts` - Add grouping conversion logic

**Tasks:**
1. ✅ Define `DiagramGroupingData` interface in types.ts
2. ✅ Add `groupId` property to `DiagramNodeData` and `DiagramZoneData`
3. ✅ Add `groupings` array to `DiagramData` and `HierarchicalDiagramData`
4. ✅ Create Zod schemas for grouping validation
5. ✅ Update conversion functions to preserve groupings during save/load

### Phase 2: Core Grouping Logic
**New file:** `src/lib/grouping-utils.ts`

**Functions:**
```typescript
// Create a new group from selected items
export function createGroup(
  itemIds: string[], 
  diagramData: DiagramData
): DiagramData

// Add items to an existing group
export function addToGroup(
  itemIds: string[], 
  groupId: string, 
  diagramData: DiagramData
): DiagramData

// Remove items from their group
export function removeFromGroup(
  itemIds: string[], 
  diagramData: DiagramData
): DiagramData

// Ungroup - dissolve a group entirely
export function ungroup(
  groupId: string, 
  diagramData: DiagramData
): DiagramData

// Get all members of a group (including the group itself)
export function getGroupMembers(
  groupId: string, 
  diagramData: DiagramData
): string[]

// Find which group an item belongs to
export function getItemGroup(
  itemId: string, 
  diagramData: DiagramData
): DiagramGroupingData | null

// Calculate relative positions within a group
export function calculateRelativePositions(
  itemIds: string[], 
  diagramData: DiagramData
): Map<string, { dx: number; dy: number }>

// Apply relative movement to all group members
export function moveGroupMembers(
  groupId: string, 
  deltaX: number, 
  deltaY: number, 
  diagramData: DiagramData
): DiagramData
```

### Phase 3: Context Menu Updates
**Files to modify:**
- `src/hooks/use-canvas-context-menu.ts` - Add grouping menu state
- `src/components/editor/editor-canvas.tsx` - Add context menu handlers

**Tasks:**
1. ✅ Add context menu items for:
   - "Group Items" (when 2+ items selected, none grouped)
   - "Add to Group" (when selection includes grouped + ungrouped)
   - "Remove from Group" (when grouped items selected)
   - "Ungroup" (when entire group selected)
2. ✅ Add keyboard shortcuts (optional):
   - `Cmd/Ctrl+G` - Group selected items
   - `Cmd/Ctrl+Shift+G` - Ungroup

### Phase 4: Selection Behavior
**Files to modify:**
- `src/components/diagram-editor.tsx` - Update selection logic
- `src/hooks/use-canvas-selection.ts` - Add group selection awareness
- `src/components/diagram/diagram-node.tsx` - Add green highlight for group members
- `src/components/diagram/diagram-zone.tsx` - Add green highlight for group members

**Tasks:**
1. ✅ When clicking a grouped item:
   - Set primary selection to clicked item (blue box)
   - Highlight all group members (green boxes)
   - Add all group members to `selectedItemIds`
2. ✅ Update `handleItemSelect` to auto-select group members
3. ✅ Add new prop `isGroupMember` to DiagramNode/DiagramZone
4. ✅ Render green selection box for group members
5. ✅ Update multi-selection to respect groups

### Phase 5: Movement Behavior
**Files to modify:**
- `src/hooks/use-canvas-drag-drop.ts` - Update drag logic for groups
- `src/components/editor/canvas-operations.ts` - Update move operations

**Tasks:**
1. ✅ When dragging a grouped item:
   - Calculate initial relative positions
   - Move all group members by same delta
   - Maintain spacing/layout
2. ✅ Update `moveItem` to check for group membership
3. ✅ Update `moveMultipleItems` to handle groups correctly
4. ✅ Handle edge cases:
   - Groups within zones
   - Overlapping groups (should be prevented)
   - Connections to grouped items

### Phase 6: Visual Indicators
**Files to modify:**
- `src/components/diagram/diagram-node.tsx` - Add group styling
- `src/components/diagram/diagram-zone.tsx` - Add group styling

**CSS/Styling:**
```typescript
// Blue box - primary selected item
className={cn(
  "ring-2 ring-blue-500 ring-offset-2"
)}

// Green box - group member (not primary)
className={cn(
  "ring-2 ring-green-500 ring-offset-2"
)}

// Both blue and green - primary item in a group
className={cn(
  "ring-2 ring-blue-500 ring-offset-2",
  "after:absolute after:inset-0 after:ring-2 after:ring-green-400 after:ring-offset-4"
)}
```

**Tasks:**
1. ✅ Add `isGroupMember` prop to node/zone components
2. ✅ Add green ring styling for group members
3. ✅ Ensure both rings visible for primary selected group member
4. ✅ Add subtle indicator (icon/badge) showing item is grouped

### Phase 7: Serialization/Deserialization
**Files to modify:**
- `src/lib/nested-hierarchy.ts` - Update conversion functions
- `src/components/diagram-editor.tsx` - Update save/load handlers

**Tasks:**
1. ✅ Ensure groupings are preserved in `convertToNestedHierarchy`
2. ✅ Ensure groupings are restored in `convertFromNestedHierarchy`
3. ✅ Test round-trip: Create group → Save → Load → Verify group intact
4. ✅ Handle legacy files without groupings gracefully

### Phase 8: Edge Cases & Validation
**Files to modify:**
- `src/lib/grouping-utils.ts` - Add validation functions

**Validation Rules:**
```typescript
// Prevent creating a group with less than 2 items
if (itemIds.length < 2) throw new Error("Groups require at least 2 items");

// Prevent items from being in multiple groups
const existingGroups = itemIds.map(id => getItemGroup(id, data));
if (existingGroups.some(g => g !== null)) {
  throw new Error("Items already in a group. Remove from group first.");
}

// Prevent circular dependencies (group containing itself)
// This shouldn't happen with flat structure but validate anyway
```

**Tasks:**
1. ✅ Validate group creation (min 2 items)
2. ✅ Prevent double-grouping (item in multiple groups)
3. ✅ Handle deletion of grouped items (remove from group or delete group)
4. ✅ Handle deletion of group (clear groupId from all members)
5. ✅ Test with connections to grouped items
6. ✅ Test with zones containing grouped items

### Phase 9: Testing Scenarios
**Create test cases for:**

1. **Basic Operations**
   - ✅ Create group with 2 nodes
   - ✅ Create group with 3+ nodes
   - ✅ Create group with zones
   - ✅ Create group with mixed nodes + zones

2. **Add/Remove**
   - ✅ Add single item to existing group
   - ✅ Add multiple items to existing group
   - ✅ Remove single item from group
   - ✅ Remove multiple items from group
   - ✅ Ungroup completely

3. **Movement**
   - ✅ Drag grouped node - all members move
   - ✅ Drag grouped zone - all members move
   - ✅ Arrow key movement - all members move
   - ✅ Align/distribute operations with groups

4. **Selection**
   - ✅ Click grouped item - all members highlighted
   - ✅ Multi-select including grouped items
   - ✅ Rectangle select including grouped items
   - ✅ Keyboard navigation with groups

5. **Persistence**
   - ✅ Save diagram with groups → Load → Groups intact
   - ✅ Export/import hierarchical format with groups
   - ✅ Load legacy diagram without groups → No errors

6. **Edge Cases**
   - ✅ Delete grouped item → Group updates
   - ✅ Delete entire group → Members ungrouped
   - ✅ Copy/paste grouped items → Group preserved
   - ✅ Undo/redo group operations → State correct

### Phase 10: Documentation & Polish
**Tasks:**
1. ✅ Update README with grouping feature
2. ✅ Add tooltips for group context menu items
3. ✅ Add user guide section for grouping
4. ✅ Ensure all grouping operations are undo-able
5. ✅ Performance test with large groups (100+ items)

## Implementation Order

### Sprint 1: Foundation (Days 1-2)
- Phase 1: Data Layer
- Phase 2: Core Grouping Logic

### Sprint 2: UI Integration (Days 3-4)
- Phase 3: Context Menu Updates
- Phase 4: Selection Behavior

### Sprint 3: Polish (Days 5-6)
- Phase 5: Movement Behavior
- Phase 6: Visual Indicators

### Sprint 4: Robustness (Days 7-8)
- Phase 7: Serialization/Deserialization
- Phase 8: Edge Cases & Validation

### Sprint 5: Quality (Days 9-10)
- Phase 9: Testing Scenarios
- Phase 10: Documentation & Polish

## Technical Decisions

### Why Flat Structure?
- Groups stored as separate array in `DiagramData`
- Items reference group via `groupId` property
- **Pros:** Simple queries, no nesting complexity, easy undo/redo
- **Cons:** Need to keep references in sync

### Why Not Nested Structure?
- Alternative: Store items inside group object
- **Rejected because:** Complicates existing zone/node logic, harder to query, difficult to handle items in both zones and groups

### Group vs Zone
| Feature | Zone | Grouping |
|---------|------|----------|
| Visual container | ✅ Yes | ❌ No |
| Background/border | ✅ Yes | ❌ No |
| Layout children | ✅ Yes | ❌ No |
| Move together | ⚠️ Children move with zone | ✅ Members move together |
| Selection highlight | 🔵 Blue | 🟢 Green |
| Purpose | Logical/visual organization | Movement coordination |

## Success Criteria
- ✅ Users can group 2+ items via right-click menu
- ✅ Clicking any group member highlights all members in green
- ✅ Moving any group member moves all members together
- ✅ Groups persist through save/load cycles
- ✅ No existing functionality broken
- ✅ Performance acceptable with groups of 50+ items
- ✅ Intuitive UX matching common design tools

## Risk Mitigation
- **Risk:** Breaking existing zone functionality
  - **Mitigation:** Keep zones and groupings completely separate in data model
- **Risk:** Performance with large groups
  - **Mitigation:** Use memoization, optimize selection queries
- **Risk:** Complex edge cases (groups in zones, connections, etc.)
  - **Mitigation:** Comprehensive test suite in Phase 9

## Progress Tracking

### Completed Tasks
- [x] Phase 1: Data Layer (5/5 tasks) ✅
- [x] Phase 2: Core Grouping Logic (8/8 functions) ✅
- [x] Phase 3: Context Menu Updates (2/2 tasks) ✅
- [x] Phase 4: Selection Behavior (5/5 tasks) ✅
- [ ] Phase 5: Movement Behavior (0/4 tasks)
- [ ] Phase 6: Visual Indicators (0/4 tasks)
- [ ] Phase 7: Serialization (0/4 tasks) - Already complete via Phase 1
- [ ] Phase 8: Validation (0/4 tasks) - Partially complete via Phase 2
- [ ] Phase 9: Testing (0/24 test cases)
- [ ] Phase 10: Documentation (0/5 tasks)

**Total Progress: 20/65 tasks (31%)**

### Implementation Log

#### Phase 1: Data Layer ✅ COMPLETE
**Files Modified:**
1. `src/lib/types.ts`
   - Added `DiagramGroupingData` interface
   - Added `groupId?: string` to `DiagramNodeData`, `DiagramNodeItem`, `DiagramZoneData`, `DiagramZoneItem`
   - Added `groupings?: DiagramGroupingData[]` to `DiagramData` and `HierarchicalDiagramData`

2. `src/lib/schemas.ts`
   - Added `DiagramGroupingDataSchema` with Zod validation
   - Added `groupId` field to node and zone schemas
   - Added `groupings` array to main data schemas

3. `src/lib/nested-hierarchy.ts`
   - Updated `convertToNestedHierarchy()` to preserve groupings
   - Updated `convertFromNestedHierarchy()` to restore groupings

#### Phase 2: Core Grouping Logic ✅ COMPLETE
**New File:** `src/lib/grouping-utils.ts`

**11 Functions Implemented:**
1. `createGroup()` - Creates group from 2+ items with validation
2. `addToGroup()` - Adds items to existing group
3. `removeFromGroup()` - Removes items from group, auto-dissolves if <2 members
4. `ungroup()` - Dissolves entire group
5. `getGroupMembers()` - Returns array of member IDs
6. `getItemGroup()` - Finds group for given item
7. `calculateRelativePositions()` - Calculates relative offsets
8. `moveGroupMembers()` - Moves all members by delta
9. `isItemInGroup()` - Boolean check for group membership
10. `getAllGroupedItems()` - Returns set of all grouped item IDs
11. `handleItemDeletion()` - Cleans up groups when items deleted

#### Phase 3: Context Menu Integration ✅ COMPLETE
**Files Modified:**
1. `src/components/ui/context-menu.tsx`
   - Added `onGroup`, `onUngroup`, `onRemoveFromGroup` props
   - Added `isGrouped`, `canGroup` state props
   - Added menu items with Group/Ungroup/Remove icons (from lucide-react)
   - Conditionally rendered based on selection state

2. `src/components/diagram-editor.tsx`
   - Imported grouping utilities
   - Added `handleGroupItems()` - creates groups with toast feedback
   - Added `handleUngroupItems()` - dissolves groups with toast
   - Added `handleRemoveFromGroup()` - removes items with toast
   - Updated `handleItemDelete()` to call `cleanupGroupsAfterDeletion()`
   - Updated `handleItemSelect()` to auto-select all group members
   - Added keyboard shortcuts:
     - `Cmd/Ctrl+G` - Group selected items
     - `Cmd/Ctrl+Shift+G` - Ungroup selected items
   - Passed handlers to EditorCanvas

3. `src/components/editor/editor-canvas.tsx`
   - Added `onGroupItems`, `onUngroupItems`, `onRemoveFromGroup` props
   - Imported `getItemGroup` utility
   - Passed grouping handlers to ContextMenu
   - Calculate `canGroup` (2+ items) and `isGrouped` dynamically

#### Phase 4: Selection & Visual Feedback ✅ COMPLETE
**Files Modified:**
1. `src/app/globals.css`
   - Added green glow animations for group members:
     - `@keyframes pulse-glow-green` - Animated green pulse (rgba(34, 197, 94))
     - `.node-glow-green-pulse` - Animated green glow class
     - `.node-glow-green-static` - Static green glow class

2. `src/components/diagram/diagram-node.tsx`
   - Added `isGroupMember?: boolean` prop
   - Added conditional green glow when `isGroupMember && !isSelected`
   - Green glow applied alongside blue selection glow logic

3. `src/components/diagram/diagram-zone.tsx`
   - Added `isGroupMember?: boolean` prop
   - Added conditional green ring when `isGroupMember && !isSelected`
   - Uses `ring-2 ring-green-500` for consistency

4. `src/components/editor/editor-canvas.tsx`
   - Calculate `isInGroup` for each node/zone during render
   - Pass `isGroupMember` prop to DiagramNode and DiagramZone
   - Logic: `isInGroup = selectedItemIds.size > 1 && selectedItemIds.has(item.id) && selectedItemId !== item.id`

**Visual Behavior:**
- **Primary selected item**: Blue glow/ring
- **Other group members**: Green glow/ring
- **Non-grouped items**: No highlight
- Works with both static and animated selection modes

---

## Next Steps
1. Begin Phase 1: Update type definitions in `src/lib/types.ts`
2. Add Zod schemas in `src/lib/schemas.ts`
3. Create `src/lib/grouping-utils.ts` with core functions
