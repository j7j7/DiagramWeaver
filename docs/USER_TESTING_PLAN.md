# DiagramWeaver User Testing Plan

**Branch:** `implement-performance-ux-improvements`
**Date:** 2026-04-04
**Status:** Ready for User Testing

## Overview

This document outlines the test scenarios and acceptance criteria for validating the performance and UX consistency improvements made to DiagramWeaver. All 31 implementation tasks have been completed and code reviewed successfully.

## Testing Objectives

1. **Performance Validation** - Verify that performance improvements are measurable and beneficial
2. **UX Consistency Validation** - Ensure consistent user experience across all UI elements
3. **Accessibility Validation** - Confirm WCAG 2.1 Level AA compliance
4. **Regression Testing** - Ensure no existing functionality was broken

## Test Environment Requirements

- Browser: Chrome 120+, Firefox 120+, Safari 17+, or Edge 120+
- Screen sizes: Desktop (1920x1080), Laptop (1366x768), Tablet (768x1024)
- Network: Test on both fast and slow connections (3G simulation)
- Diagram sizes: Small (1-10 nodes), Medium (11-50 nodes), Large (51-100 nodes), Very Large (100+ nodes)

---

## Phase 1: Performance Testing

### Test Case 1.1: Initial Page Load Time
**Objective:** Verify code splitting reduces initial load time

**Steps:**
1. Clear browser cache and localStorage
2. Open DevTools Performance tab
3. Navigate to http://localhost:9004
4. Measure time to first contentful paint (FCP)
5. Measure time to interactive (TTI)

**Acceptance Criteria:**
- [ ] FCP < 2.5 seconds on fast connection
- [ ] TTI < 4.0 seconds on fast connection
- [ ] Panel loading indicators appear when panels are first opened
- [ ] No errors in browser console

**Expected Improvement:** 10-15% faster TTI compared to previous version

---

### Test Case 1.2: Rendering Performance - Small Diagram
**Objective:** Verify small diagrams render smoothly

**Steps:**
1. Create or load a diagram with 5-10 nodes
2. Add connections between nodes
3. Drag nodes around the canvas
4. Zoom in and out
5. Pan the canvas

**Acceptance Criteria:**
- [ ] Canvas renders smoothly at 60fps during all interactions
- [ ] No noticeable lag when dragging nodes
- [ ] Zoom and pan are responsive
- [ ] Connections update immediately when nodes move

---

### Test Case 1.3: Rendering Performance - Medium Diagram
**Objective:** Verify performance improvements with medium diagrams

**Steps:**
1. Create or load a diagram with 30-50 nodes
2. Add connections between most nodes
3. Select and drag multiple nodes
4. Zoom to fit entire diagram
5. Move through the diagram by panning

**Acceptance Criteria:**
- [ ] Canvas remains responsive during drag operations
- [ ] Frame rate stays above 30fps during intensive operations
- [ ] Selection updates within 100ms
- [ ] No UI freezing or stuttering

**Expected Improvement:** 10-15% faster rendering than previous version

---

### Test Case 1.4: Rendering Performance - Large Diagram
**Objective:** Verify performance with large diagrams

**Steps:**
1. Create or load a diagram with 80-100 nodes
2. Add connections to create complex layout
3. Perform stress test:
   - Rapidly select and deselect nodes
   - Drag groups of nodes
   - Quickly zoom and pan
   - Open and close panels
4. Monitor DevTools Performance tab

**Acceptance Criteria:**
- [ ] Application remains responsive (no "Not Responding")
- [ ] Operations complete within reasonable time (< 500ms for most)
- [ ] Memory usage remains stable (no continuous growth)
- [ ] Console shows no errors or warnings

**Expected Improvement:** 15-25% faster rendering than previous version

---

### Test Case 1.5: Image Loading Performance
**Objective:** Verify image caching and lazy loading work correctly

**Steps:**
1. Create a diagram with 10+ custom icon images
2. Save the diagram
3. Reload the page
4. Open Network tab in DevTools
5. Observe image loading behavior

**Acceptance Criteria:**
- [ ] Images show loading spinners while fetching
- [ ] Images load only when visible (lazy loading)
- [ ] Repeated page loads show cached images (no network requests)
- [ ] All images display correctly after loading
- [ ] No broken images or placeholders remain

**Expected Improvement:** 70-90% reduction in redundant network requests

---

### Test Case 1.6: localStorage Performance
**Objective:** Verify localStorage debouncing reduces write operations

**Steps:**
1. Open DevTools Application tab → Local Storage
2. Resize the properties panel continuously for 5 seconds
3. Observe localStorage write operations
4. Change a boolean setting (e.g., snap to grid) multiple times quickly
5. Edit JSON content rapidly

**Acceptance Criteria:**
- [ ] Panel resize writes are debounced (not on every pixel change)
- [ ] Boolean settings have noticeable delay before saving
- [ ] JSON editor has 1-second debounce
- [ ] No data loss occurs during rapid changes
- [ ] localStorage contains correct final values

---

### Test Case 1.7: Memory Usage
**Objective:** Verify no memory leaks exist

**Steps:**
1. Open DevTools Memory tab
2. Take heap snapshot
3. Create and delete 50 nodes
4. Open and close all panels 10 times
5. Take second heap snapshot
6. Compare snapshots

**Acceptance Criteria:**
- [ ] Memory usage increases during active use (expected)
- [ ] Memory returns to baseline after operations complete
- [ ] No detached DOM elements (potential memory leaks)
- [ ] No continuously growing memory patterns
- [ ] Application remains stable after extended use (30+ minutes)

---

## Phase 2: UX Consistency Testing

### Test Case 2.1: Button Standardization
**Objective:** Verify all buttons follow consistent design patterns

**Steps:**
1. Navigate through all panels and dialogs
2. Observe button styles and variants
3. Test hover, active, and disabled states
4. Check icon-only buttons

**Acceptance Criteria:**
- [ ] Primary action buttons use `variant="default"` (solid color)
- [ ] Secondary action buttons use `variant="outline"` or `variant="ghost"`
- [ ] Toolbar icon buttons use `variant="ghost"` with tooltips
- [ ] All icon-only buttons have aria-label or title
- [ ] Button sizes are consistent (h-10 or appropriate for context)
- [ ] Hover states are consistent across all buttons

---

### Test Case 2.2: Icon Size Consistency
**Objective:** Verify icon sizes follow visual hierarchy

**Steps:**
1. Examine icons in:
   - Panel headers
   - Toolbar buttons
   - Menu items
   - Status indicators
   - Draggable items
2. Compare icon sizes using DevTools

**Acceptance Criteria:**
- [ ] Toolbar buttons: h-4 w-4 (16px)
- [ ] Panel headers: h-5 w-5 (20px)
- [ ] Status indicators: h-5 w-5 (20px)
- [ ] Primary draggable icons: h-6 w-6 (24px)
- [ ] All icons within same category are same size

---

### Test Case 2.3: Color Consistency
**Objective:** Verify colors use CSS variables for theming

**Steps:**
1. Switch between light and dark themes
2. Observe UI elements that previously used hardcoded colors
3. Check connection waypoint handles
4. Check layer panel color indicators

**Acceptance Criteria:**
- [ ] All UI colors adapt to theme (light/dark)
- [ ] No hardcoded gray colors (#f3f4f6) in UI elements
- [ ] Connection waypoint handles use hsl(var(--muted))
- [ ] Layer color indicators use hsl(var(--muted)) as fallback
- [ ] Theme switching works smoothly

---

### Test Case 2.4: Typography Consistency
**Objective:** Verify typography follows consistent patterns

**Steps:**
1. Examine text throughout the application
2. Check headings, body text, labels, and captions
3. Verify font weights and sizes

**Acceptance Criteria:**
- [ ] Headings use text-xl with font-semibold or font-bold
- [ ] Body text uses text-sm with font-normal or font-medium
- [ ] Captions use text-xs with font-normal
- [ ] Font weights follow clear hierarchy
- [ ] Line heights are appropriate for readability

---

### Test Case 2.5: Panel Layout Consistency
**Objective:** Verify panels have consistent structure

**Steps:**
1. Open all sidebar panels (Properties, Layers, JSON, etc.)
2. Open floating panels (if any)
3. Examine structure and behavior

**Acceptance Criteria:**
- [ ] Sidebar panels have:
  - Header with title and collapse/expand button
  - Scrollable content area
  - Consistent padding (p-4)
- [ ] Floating panels have:
  - Header with title and close button
  - Fixed position with draggable capability
  - Consistent styling
- [ ] Panel collapse/expand works smoothly
- [ ] All panels maintain consistent visual appearance

---

### Test Case 2.6: Dropdown/Popover Consistency
**Objective:** Verify dropdowns and popovers behave consistently

**Steps:**
1. Test all dropdown menus in the application
2. Test all popovers
3. Verify trigger behavior, positioning, and closing

**Acceptance Criteria:**
- [ ] All dropdowns/popovers trigger on click (not hover)
- [ ] Default positioning is consistent (bottom-start for popovers, end-aligned for dropdowns)
- [ ] All close when clicking outside
- [ ] Animations are consistent (fade/zoom/slide)
- [ ] No dropdowns/popovers get stuck open

---

### Test Case 2.7: Keyboard Shortcuts
**Objective:** Verify all documented keyboard shortcuts work

**Steps:**
1. Open keyboard shortcuts dialog
2. Test each shortcut
3. Verify shortcuts work in appropriate contexts
4. Verify shortcuts don't trigger in text inputs

**Acceptance Criteria:**
- [ ] Ctrl+C / Cmd+C copies selected items
- [ ] Ctrl+V / Cmd+V pastes from clipboard
- [ ] Ctrl+0 / Cmd+0 fits diagram to view
- [ ] Ctrl+S / Cmd+S saves diagram
- [ ] Ctrl+Z / Cmd+Z undoes last action
- [ ] Ctrl+Y / Cmd+Y redoes last action
- [ ] Delete key removes selected items
- [ ] Shortcuts are ignored when typing in inputs/textareas

---

## Phase 3: Accessibility Testing

### Test Case 3.1: Screen Reader Compatibility
**Objective:** Verify application is usable with screen readers

**Tools:** NVDA (Windows), VoiceOver (macOS), or JAWS

**Steps:**
1. Enable screen reader
2. Navigate through the application using keyboard only
3. Test all interactive elements
4. Verify announcements are clear

**Acceptance Criteria:**
- [ ] All icon-only buttons have aria-label (69+ instances)
- [ ] Dialogs announce their purpose
- [ ] Focus moves logically through the interface
- [ ] Form fields have associated labels
- [ ] Status changes are announced (when applicable)

---

### Test Case 3.2: Keyboard Navigation
**Objective:** Verify full keyboard accessibility

**Steps:**
1. Unplug mouse (or don't use it)
2. Navigate through entire application using Tab, Enter, Esc, and arrow keys
3. Test all interactive elements
4. Verify focus management

**Acceptance Criteria:**
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical and predictable
- [ ] Custom modals trap focus within the modal
- [ ] Focus is restored to previous element when modal closes
- [ ] Esc key closes modals and dropdowns
- [ ] No keyboard traps (ways to get stuck)

---

### Test Case 3.3: Focus Visibility
**Objective:** Verify focus indicators are clearly visible

**Steps:**
1. Enable keyboard navigation
2. Tab through the application
3. Observe focus indicators
4. Test on both light and dark themes

**Acceptance Criteria:**
- [ ] Focus indicator is clearly visible on all elements
- [ ] Focus indicator meets WCAG contrast requirements (3:1)
- [ ] Focus indicator is visible on both light and dark themes
- [ ] Focus moves smoothly between elements

---

### Test Case 3.4: ARIA Attributes
**Objective:** Verify ARIA attributes are correctly used

**Steps:**
1. Use browser DevTools to inspect elements
2. Check ARIA labels, roles, and states
3. Verify semantic HTML is used where possible

**Acceptance Criteria:**
- [ ] All icon-only buttons have aria-label
- [ ] Dialogs have role="dialog" and aria-labelledby
- [ ] Dropdown menus have appropriate ARIA attributes
- [ ] Form inputs have aria-describedby for error messages
- [ ] Live regions announce important changes

---

### Test Case 3.5: Color Contrast
**Objective:** Verify text and UI elements meet WCAG contrast requirements

**Tools:** axe DevTools, WAVE, or Lighthouse

**Steps:**
1. Run contrast checker on all pages
2. Test both light and dark themes
3. Check text, borders, icons, and interactive elements

**Acceptance Criteria:**
- [ ] Normal text has contrast ratio ≥ 4.5:1
- [ ] Large text (18pt+) has contrast ratio ≥ 3:1
- [ ] UI components have contrast ratio ≥ 3:1
- [ ] Focus indicators have contrast ratio ≥ 3:1
- [ ] No contrast violations on light or dark theme

---

## Phase 4: Regression Testing

### Test Case 4.1: Core Functionality
**Objective:** Verify all core features still work correctly

**Steps:**
1. Create a new diagram from scratch
2. Add various node types (shapes, resources, UML classes)
3. Create connections between nodes
4. Apply different styles and themes
5. Save and load the diagram

**Acceptance Criteria:**
- [ ] New diagrams can be created
- [ ] All node types render correctly
- [ ] Connections can be created and styled
- [ ] Styles and themes apply correctly
- [ ] Save/load works without errors
- [ ] No data corruption occurs

---

### Test Case 4.2: Advanced Features
**Objective:** Verify advanced features work correctly

**Steps:**
1. Test grouping and ungrouping nodes
2. Test alignment guides
3. Test snap to grid
4. Test layers panel (reorder, visibility, lock)
5. Test context menu on nodes and connections
6. Test JSON editor (apply changes to canvas)

**Acceptance Criteria:**
- [ ] Group/ungroup works correctly
- [ ] Alignment guides appear and function
- [ ] Snap to grid works
- [ ] Layers panel operations work
- [ ] Context menu provides all expected options
- [ ] JSON editor changes apply correctly to canvas

---

### Test Case 4.3: Export and Presentation
**Objective:** Verify export and presentation features work

**Steps:**
1. Test export to PNG/SVG
2. Test copy to clipboard
3. Test presentation mode
4. Test presenter notes
5. Test presentation snapshots

**Acceptance Criteria:**
- [ ] Export to PNG works
- [ ] Export to SVG works
- [ ] Copy to clipboard works
- [ ] Presentation mode activates and functions
- [ ] Presenter notes display correctly
- [ ] Presentation snapshots work

---

### Test Case 4.4: Customization Features
**Objective:** Verify customization options work

**Steps:**
1. Test custom icon upload
2. Test theme editor
3. Test rules editor
4. Test scratch pad (favorites, imports)

**Acceptance Criteria:**
- [ ] Custom icons can be uploaded and used
- [ ] Theme editor creates and applies themes
- [ ] Rules editor saves and applies rules
- [ ] Scratch pad favorites can be saved/loaded
- [ ] Scratch pad imports work correctly

---

### Test Case 4.5: Edge Cases
**Objective:** Verify application handles edge cases gracefully

**Steps:**
1. Create diagram with 200+ nodes (stress test)
2. Upload very large custom images
3. Paste invalid JSON in JSON editor
4. Rapidly open/close panels
5. Switch themes rapidly

**Acceptance Criteria:**
- [ ] Large diagrams don't crash the application
- [ ] Large images are handled gracefully
- [ ] Invalid JSON shows error message, doesn't crash
- [ ] Rapid panel operations don't cause errors
- [ ] Theme switching doesn't cause visual glitches

---

## Phase 5: Cross-Browser Testing

### Test Case 5.1: Browser Compatibility
**Objective:** Verify application works across major browsers

**Browsers to Test:**
- Chrome 120+ (Windows/Mac/Linux)
- Firefox 120+ (Windows/Mac/Linux)
- Safari 17+ (Mac/iOS)
- Edge 120+ (Windows)

**Steps:**
1. Open application in each browser
2. Run Test Case 4.1 (Core Functionality) in each browser
3. Test performance in each browser
4. Check DevTools console for errors

**Acceptance Criteria:**
- [ ] All core features work in all browsers
- [ ] Performance is acceptable in all browsers
- [ ] No browser-specific errors in console
- [ ] Visual appearance is consistent across browsers

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Previous | Improvement |
|--------|--------|----------|-------------|
| Initial TTI | < 4.0s | ~4.5s | 10-15% |
| Small diagram render | 60fps | 60fps | Maintained |
| Medium diagram render | 30+fps | ~25fps | 10-15% |
| Large diagram render | 30+fps | ~20fps | 15-25% |
| Image cache hit rate | >80% | ~0% | 70-90% |
| Bundle size reduction | - | - | 53KB |

---

## Defect Reporting

### Defect Severity Levels

- **Critical:** Application crashes, data loss, security issue
- **High:** Major feature broken, significant performance degradation
- **Medium:** Minor feature broken, slight performance issue
- **Low:** Cosmetic issue, minor UX inconsistency

### Defect Template

```
Title: [Short description]
Severity: [Critical/High/Medium/Low]
Browser: [Browser name and version]
OS: [Operating system]
Steps to Reproduce:
1. [Step 1]
2. [Step 2]
...
Expected Behavior: [What should happen]
Actual Behavior: [What actually happens]
Screenshots/Videos: [Attach if applicable]
```

---

## Test Execution Checklist

### Pre-Testing Setup
- [ ] Clean browser cache and localStorage
- [ ] Enable DevTools (Console, Performance, Memory, Network)
- [ ] Have test diagrams ready (small, medium, large)
- [ ] Have custom images ready for testing
- [ ] Set up screen reader (if testing accessibility)

### During Testing
- [ ] Document all test results
- [ ] Take screenshots of any issues
- [ ] Record performance metrics
- [ ] Note any browser-specific behaviors
- [ ] Report defects immediately

### Post-Testing
- [ ] Compile test results
- [ ] Calculate performance improvements
- [ ] Document any bugs found
- [ ] Verify all acceptance criteria
- [ ] Sign off on testing completion

---

## Sign-Off

**Tester Name:** __________________________

**Test Date:** __________________________

**Overall Result:** ☐ Pass ☐ Fail with Critical Issues ☐ Fail with Non-Critical Issues

**Comments:**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

**Approval:**
☐ All acceptance criteria met
☐ Performance improvements validated
☐ No critical defects found
☐ Ready for production deployment

**Approver:** __________________________  **Date:** __________________________
