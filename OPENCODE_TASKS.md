# OpenCode Tasks for DiagramWeaver Improvements

This document lists tasks that should be handled by OpenCode due to their complexity.

## When to Use OpenCode

Use OpenCode for tasks that:
- Require complex refactoring across multiple files
- Need sophisticated algorithm implementation
- Benefit from an autonomous coding agent's reasoning
- Would take significant time to implement manually

## OpenCode Task List

### Task 12: Implement Viewport Culling (HIGH PRIORITY)
**Complexity:** High
**Impact:** Major performance improvement for large diagrams
**Estimated Time:** 30-60 minutes

**Requirements:**
- Calculate visible viewport bounds based on transform (x, y, k)
- Filter nodes and connections to only render those within viewport
- Add margin buffer to prevent popping at edges
- Ensure culling updates on transform changes
- Test with diagrams of 100+ nodes
- Maintain functionality (selection, dragging, connections)

**Files to Modify:**
- `src/components/editor/editor-canvas.tsx`
- `src/components/diagram/diagram-node.tsx`
- `src/components/editor/canvas-connections.tsx`

**OpenCode Prompt:**
```
Implement viewport culling for DiagramWeaver to improve rendering performance with large diagrams (100+ nodes).

Requirements:
1. Calculate visible viewport bounds from transform (x, y, k) and canvas dimensions
2. Filter nodes to only render those within viewport + 100px margin buffer
3. Filter connections to only render those where both endpoints are visible
4. Update culling on transform changes (pan/zoom)
5. Ensure all functionality still works: selection, dragging, connections, context menu
6. Add a toggle in debug/developer menu to disable culling for testing
7. Test with a large diagram and verify performance improvement

Files to modify:
- src/components/editor/editor-canvas.tsx (add culling logic)
- src/components/diagram/diagram-node.tsx (respect culling)
- src/components/editor/canvas-connections.tsx (respect culling)

Build with: npm run build
Test by loading a large diagram and checking rendering performance.
```

---

### Task 13: Code Splitting for Large Panels
**Complexity:** Medium
**Impact:** Faster initial load time
**Estimated Time:** 20-40 minutes

**Requirements:**
- Use React.lazy for panel components
- Implement Suspense boundaries with loading states
- Ensure panels load on-demand when opened
- Test panel loading behavior
- Verify no functionality is broken

**Files to Modify:**
- `src/components/editor/context-toolbar.tsx` (2,638 lines)
- `src/components/editor/properties-panel.tsx` (624 lines)
- `src/components/diagram-editor.tsx` (5,724 lines)

**OpenCode Prompt:**
```
Implement code splitting for large panel components in DiagramWeaver to improve initial load time.

Requirements:
1. Identify large panel components that are not needed on initial load:
   - ContextToolbar (2,638 lines)
   - PropertiesPanel (624 lines)
   - Any other panels > 300 lines
2. Wrap these in React.lazy() for dynamic imports
3. Add Suspense boundaries with appropriate loading indicators
4. Ensure panels load smoothly when opened
5. Test that all panel functionality still works
6. Verify initial load time is faster

Files to modify:
- src/components/diagram-editor.tsx (lazy load panels)
- src/components/editor/context-toolbar.tsx (if it imports other large components)
- src/components/editor/properties-panel.tsx (if it imports other large components)

Build with: npm run build
Test by loading the app and opening/closing panels.
```

---

### Task 14: Optimize Image Loading
**Complexity:** Medium
**Impact:** Faster rendering of diagrams with many custom images
**Estimated Time:** 20-30 minutes

**Requirements:**
- Implement lazy loading for custom icon images
- Add image caching to prevent redundant loads
- Handle loading and error states gracefully
- Test with diagrams containing many custom images

**Files to Modify:**
- `src/components/editor/custom-icon-preview-editor.tsx`
- `src/lib/custom-icon-utils.ts`
- `src/components/diagram/diagram-node.tsx`

**OpenCode Prompt:**
```
Optimize image loading for DiagramWeaver to improve performance when diagrams contain many custom icons.

Requirements:
1. Implement lazy loading for custom icon images using IntersectionObserver or img loading="lazy"
2. Add image caching to prevent redundant network requests for the same URL
3. Show loading state while images are being fetched
4. Handle error states gracefully (fallback icon or placeholder)
5. Ensure existing functionality is preserved
6. Test with a diagram containing 10+ custom images

Files to modify:
- src/components/editor/custom-icon-preview-editor.tsx
- src/lib/custom-icon-utils.ts (add caching logic)
- src/components/diagram/diagram-node.tsx (lazy load images)

Build with: npm run build
Test by creating a diagram with multiple custom icons and verifying smooth loading.
```

---

### Task 21: Standardize Panel Layouts
**Complexity:** Medium
**Impact:** Cohesive UI experience
**Estimated Time:** 30-45 minutes

**Requirements:**
- Create consistent panel structure across all panels
- Extract common panel layout component
- Update all panels to use the new structure
- Test all panels for consistent behavior

**Files to Modify:**
- All panel components in `src/components/editor/`
- New shared component: `src/components/editor/panel-layout.tsx`

**OpenCode Prompt:**
```
Standardize panel layouts across DiagramWeaver to create a cohesive UI experience.

Requirements:
1. Create a shared PanelLayout component with consistent structure:
   - Header with title and collapse button
   - Scrollable content area
   - Consistent padding and spacing
   - Optional footer area
2. Audit all panel components:
   - properties-panel.tsx
   - context-toolbar.tsx
   - theme-editor.tsx
   - visual-styling-panel.tsx
   - rules-editor.tsx
   - presentation-editor-panel.tsx
   - Any other panels
3. Refactor each panel to use PanelLayout component
4. Ensure all functionality is preserved
5. Test all panels for consistent appearance and behavior

Files to modify:
- Create: src/components/editor/panel-layout.tsx
- Update: All panel components in src/components/editor/

Build with: npm run build
Test by opening all panels and verifying consistent layout and functionality.
```

---

### Task 22: Standardize Dropdown/Popover Behaviors
**Complexity:** Medium
**Impact:** Predictable user interactions
**Estimated Time:** 25-35 minutes

**Requirements:**
- Audit all dropdown/popover usages
- Standardize trigger behavior (click)
- Standardize positioning strategy
- Ensure consistent close-on-click-outside behavior
- Test all dropdowns/popovers

**Files to Modify:**
- All components using DropdownMenu or Popover

**OpenCode Prompt:**
```
Standardize dropdown and popover behaviors across DiagramWeaver for predictable user interactions.

Requirements:
1. Audit all usages of DropdownMenu and Popover components
2. Standardize behavior:
   - Trigger: always click (not hover)
   - Positioning: consistent strategy (usually "bottom-start" or "top-start")
   - Close behavior: always close on click outside
   - Animation: consistent transition
3. Create utility functions or components for consistent dropdown/popover usage
4. Update all dropdowns/popovers to use standardized approach
5. Test all dropdowns/popovers for consistent behavior

Files to modify:
- Find all components using DropdownMenu or Popover
- Update them to use standardized behavior
- Optionally create shared dropdown/popover wrapper components

Build with: npm run build
Test by interacting with all dropdowns/popovers in the UI.
```

---

## OpenCode Usage Guidelines

### For One-Shot Tasks
```bash
opencode run 'Implement viewport culling...' -f CRON_IMPLEMENTATION_PLAN.md
```

### For Interactive Sessions (if needed)
```bash
# Start opencode in background
opencode -p --title "Viewport Culling" &
# Submit task via process API
```

### After OpenCode Completes
1. Review the changes
2. Build: `npm run build`
3. Type check: `npm run typecheck`
4. Lint: `npm run lint`
5. Browser test if applicable
6. Update CHANGELOG_IMPLEMENTATION.md
7. Commit changes
8. Update progress in CRON_IMPLEMENTATION_PLAN.md

## Success Criteria

Each OpenCode task is successful when:
- ✅ Build passes without errors
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ No lint errors
- ✅ Browser testing shows correct behavior
- ✅ Performance improvement is measurable (if applicable)
- ✅ Documentation is updated
- ✅ Changes are committed
