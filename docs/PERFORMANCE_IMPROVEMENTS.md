# Performance Improvements Plan

**Date**: 2026-04-04
**Status**: Draft
**Scope**: Comprehensive performance optimization plan for DiagramWeaver

---

## Executive Summary

This document outlines performance bottlenecks identified in the DiagramWeaver codebase and proposes prioritized solutions. The analysis reveals issues with component monolithicity, missing memoization, excessive re-renders, and inefficient state management patterns. Implementation of these improvements should significantly enhance rendering performance, especially for large diagrams.

---

## 1. Component Monolithicity & Architectural Issues

### 1.1 diagram-editor.tsx - Excessive Size and Complexity

**Problem**: The main `DiagramEditor` component is 5,723 lines with 40+ state variables and 20+ useEffect hooks. This creates:

- Unnecessary re-renders when any state changes
- Difficult maintenance and testing
- Poor code organization
- Cognitive overload for developers

**Location**: `src/components/diagram-editor.tsx` (entire file, lines 1-5723)

**Current Implementation Examples**:
- Lines 519-743: 20+ useState hooks in a single component
- Lines 590-671: Multiple localStorage synchronization effects
- Lines 773-835: Complex tab and presentation state management
- Lines 948-1000: Multiple ref and memo calculations

**Proposed Solution**:
1. **Extract Presentation Mode Logic** (High Priority)
   - Create `usePresentationMode` hook for all presentation state
   - Create `PresentationContext` to manage deck/slide state
   - Extract presentation-related UI components

2. **Extract Tab Management** (High Priority)
   - Already has `useDiagramTabs` hook (good!)
   - Move tab-related UI to separate `DiagramTabs` component

3. **Extract Dialog/Modal State** (Medium Priority)
   - Create `useDialogManager` hook for managing multiple dialogs
   - Extract individual dialog components

4. **Extract Canvas Settings State** (Medium Priority)
   - Create `CanvasSettingsContext` for hover, alignment guides, etc.
   - Group related settings together

5. **Create Feature-based Sub-components** (Low Priority)
   - `DiagramStateProvider` - manages diagram data flow
   - `CanvasSettingsProvider` - manages canvas display options
   - `PresentationProvider` - manages presentation mode

**Estimated Lines Reduction**: From 5,723 to ~800-1,200 lines in main component

**Implementation Priority**: High
**Estimated Effort**: 3-4 days

---

### 1.2 context-toolbar.tsx - Large Component with Many States

**Problem**: `ContextToolbar` is 2,638 lines with 10+ state variables for managing panels and interactions. Every state change triggers full component re-render.

**Location**: `src/components/editor/context-toolbar.tsx` (lines 1-2638)

**Current Implementation Examples**:
- Lines 133-153: Multiple state variables for panel visibility
- Lines 172-201: Sync effects for panel states
- Lines 2638: Large component body with complex conditional rendering

**Proposed Solution**:
1. Extract individual panel components:
   - `LabelEditorPanel` - label/tag/description editing
   - `ConnectionsPanel` - connection management
   - `StylingPanelContainer` - wrapper for styling panels

2. Create `usePanelManager` hook:
   ```typescript
   function usePanelManager() {
     const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());
     const togglePanel = useCallback((panelId: string) => {
       setOpenPanels(prev => {
         const next = new Set(prev);
         if (next.has(panelId)) next.delete(panelId);
         else next.add(panelId);
         return next;
       });
     }, []);
     const isPanelOpen = useCallback((panelId: string) => openPanels.has(panelId), [openPanels]);
     const closeAllPanels = useCallback(() => setOpenPanels(new Set()), []);
     return { openPanels, togglePanel, isPanelOpen, closeAllPanels };
   }
   ```

3. Extract styling panels that are already separate but inline-embedded

**Estimated Lines Reduction**: From 2,638 to ~400-600 lines

**Implementation Priority**: High
**Estimated Effort**: 2-3 days

---

### 1.3 editor-canvas.tsx - Already Refactored But Can Improve

**Problem**: While already refactored from ~4,100 lines to ~2,000 lines with custom hooks, it still has room for improvement in memoization and rendering optimization.

**Location**: `src/components/editor/editor-canvas.tsx` (lines 1-2019)

**Current Implementation Examples**:
- Lines 176-198: Multiple useMemo hooks for node/zone lookup
- Lines 200-239: Complex pointer events pass-through calculation on every render

**Proposed Solution**:
1. Add `React.memo` to sub-components that don't need to re-render
2. Memoize complex calculations like `pointerEventsPassThroughIds`
3. Consider virtualizing node list for diagrams with 100+ nodes

**Implementation Priority**: Medium
**Estimated Effort**: 1-2 days

---

## 2. Missing Memoization

### 2.1 Diagram Node Component Not Memoized

**Problem**: `DiagramNode` component (1,667 lines) is not memoized, causing all nodes to re-render when any node or canvas state changes.

**Location**: `src/components/diagram/diagram-node.tsx`

**Current Implementation**:
```typescript
export function DiagramNode({ node, isSelected, ... }) {
  // 1,667 lines of component logic
}
```

**Proposed Solution**:
```typescript
const DiagramNode = React.memo(function DiagramNode({ node, isSelected, ... }) {
  // Component logic
}, areDiagramNodePropsEqual);

function areDiagramNodePropsEqual(
  prev: DiagramNodeProps,
  next: DiagramNodeProps
): boolean {
  // Compare only relevant props that affect rendering
  return (
    prev.node === next.node &&
    prev.isSelected === next.isSelected &&
    prev.isHighlighted === next.isHighlighted &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.isGroupMember === next.isGroupMember &&
    prev.hoverEnabled === next.hoverEnabled &&
    prev.isReadOnly === next.isReadOnly &&
    prev.pointerEventsPassThrough === next.pointerEventsPassThrough &&
    propsEqual(prev.animationStyle, next.animationStyle)
  );
}
```

**Impact**: For diagrams with 50+ nodes, this reduces re-renders by 90%+ when selecting or moving individual nodes.

**Implementation Priority**: High
**Estimated Effort**: 1 day

---

### 2.2 Resource Browser Items Not Memoized

**Problem**: `ResourceBrowser` renders 370+ resources without memoization. Filtering or searching causes all items to re-render.

**Location**: `src/components/editor/resource-browser.tsx` (lines 1-871)

**Current Implementation Examples**:
- Lines 175-250: ProviderIcon component re-renders on every state change
- Resource items not memoized

**Proposed Solution**:
1. Memoize `ProviderIcon`:
```typescript
const ProviderIcon = React.memo(function ProviderIcon({ provider }: { provider: string }) {
  // Existing logic
});
```

2. Memoize `ResourceItem` or `DraggableResourceItem` components
3. Use `useMemo` for filtered/sorted resource lists

**Implementation Priority**: Medium
**Estimated Effort**: 1 day

---

### 2.3 Canvas Connections Partially Memoized

**Problem**: `CanvasConnections` has a custom comparison function `areCanvasConnectionsPropsEqual`, but it compares object references (`diagramData === next.diagramData`) which always change on any diagram update.

**Location**: `src/components/editor/canvas-connections.tsx` (lines 72-93)

**Current Implementation**:
```typescript
function areCanvasConnectionsPropsEqual(prev: CanvasConnectionsProps, next: CanvasConnectionsProps): boolean {
  return prev.width === next.width &&
    prev.height === next.height &&
    prev.diagramData === next.diagramData && // ← Always false on any diagram change
    prev.nodesById === next.nodesById && // ← Always false
    // ...
}
```

**Proposed Solution**:
```typescript
function areCanvasConnectionsPropsEqual(prev: CanvasConnectionsProps, next: CanvasConnectionsProps): boolean {
  // Compare primitive values
  if (prev.width !== next.width || prev.height !== next.height) return false;
  if (prev.selectedItemId !== next.selectedItemId) return false;
  if (prev.stackZIndex !== next.stackZIndex) return false;
  if (prev.animationConnectionsEnabled !== next.animationConnectionsEnabled) return false;

  // Deep compare connections array (only what matters)
  const prevConns = prev.diagramData.connections || [];
  const nextConns = next.diagramData.connections || [];
  if (prevConns.length !== nextConns.length) return false;

  for (let i = 0; i < prevConns.length; i++) {
    if (!connectionDataEqual(prevConns[i], nextConns[i])) return false;
  }

  // Compare node/zone positions (only x, y, width, height matter)
  if (!positionsEqual(prev.nodesById, next.nodesById)) return false;
  if (!positionsEqual(prev.zonesById, next.zonesById)) return false;

  return true;
}

function connectionDataEqual(a: any, b: any): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.style === b.style &&
    a.curvature === b.curvature &&
    a.lineWidth === b.lineWidth &&
    a.color === b.color &&
    JSON.stringify(a.waypoints) === JSON.stringify(b.waypoints) &&
    JSON.stringify(a.animation) === JSON.stringify(b.animation)
    // Add other connection properties that affect rendering
  );
}
```

**Impact**: Prevents all connections from re-rendering when unrelated nodes change.

**Implementation Priority**: High
**Estimated Effort**: 1-2 days

---

### 2.4 BezierConnection Not Memoized (Already Documented)

**Problem**: `BezierConnection` component is not memoized, causing all animated connections to re-render unnecessarily.

**Location**: `src/components/diagram/bezier-connection.tsx`

**Note**: This is already documented in `CONNECTION-ANIMATION-PERFORMANCE-PLAN.md` but included here for completeness.

**Implementation Priority**: High (already planned)
**Estimated Effort**: 1 day

---

## 3. Excessive State Updates and Re-renders

### 3.1 DiagramEditor - Too Many useEffect Dependencies

**Problem**: Multiple useEffect hooks in `diagram-editor.tsx` depend on unstable references or large objects, causing excessive effect runs.

**Location**: `src/components/diagram-editor.tsx`

**Current Implementation Examples**:
- Lines 590-604: Rules localStorage sync on every `rules` change
- Lines 607-611: Rules save on every `rules` change (could be debounced)
- Lines 614-631: Scratchpad visibility sync
- Lines 634-651: Layer animations sync
- Lines 654-671: Presentation mode sync
- Lines 744-770: Trigger state effects (these create 100ms delays)

**Proposed Solution**:
1. **Batch localStorage writes** (High Priority):
   ```typescript
   // Create a debounced batch writer
   function useDebouncedLocalStorage<T>(key: string, value: T, delay: number = 1000) {
     useEffect(() => {
       const timeout = setTimeout(() => {
         localStorage.setItem(key, JSON.stringify(value));
       }, delay);
       return () => clearTimeout(timeout);
     }, [key, value, delay]);
   }

   // Usage:
   useDebouncedLocalStorage('dw:rules', { version: '1.0', rules }, 1000);
   ```

2. **Remove unnecessary trigger effects** (Medium Priority):
   - Lines 744-770: These effects set state then clear it after 100ms
   - Replace with direct prop passing or event dispatching

3. **Combine related effects** (Low Priority):
   - Group localStorage sync effects into a single effect
   - Group presentation-related effects

**Implementation Priority**: High
**Estimated Effort**: 1-2 days

---

### 3.2 Context Toolbar - Panel Sync Effects Run Unnecessarily

**Problem**: Lines 172-201 in `context-toolbar.tsx` have effects that sync panel states. These run on every render when the external state changes.

**Location**: `src/components/editor/context-toolbar.tsx` (lines 172-201)

**Current Implementation**:
```typescript
useEffect(() => {
  if (textStylingPanelOpen && !textStylingOpen) {
    setTextStylingOpen(true);
  }
}, [textStylingPanelOpen, textStylingOpen]); // Runs when either changes
```

**Proposed Solution**:
Remove these effects entirely and use controlled components pattern:
```typescript
// In parent (diagram-editor.tsx), track panel state centrally:
const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());

// Pass to ContextToolbar:
<ContextToolbar
  openPanels={openPanels}
  onPanelToggle={(panelId) => setOpenPanels(prev => {
    const next = new Set(prev);
    if (next.has(panelId)) next.delete(panelId);
    else next.add(panelId);
    return next;
  })}
  // ...
/>

// ContextToolbar uses controlled state directly, no sync needed
```

**Implementation Priority**: Medium
**Estimated Effort**: 1-2 days

---

### 3.3 JSON Editor Panel - Frequent Re-syncs

**Problem**: `json-editor-panel.tsx` has an effect (lines 130-166) that re-syncs text when `value` prop changes. This runs on every diagram change, even when the panel is closed.

**Location**: `src/components/editor/json-editor-panel.tsx` (lines 130-166)

**Current Implementation**:
```typescript
React.useEffect(() => {
  if (isUpdating) return;
  if (previousValueRef.current === value) return;

  // 16ms timeout + JSON.stringify on every value change
  updateTimeoutRef.current = setTimeout(() => {
    const displayData = { /* ... */ };
    setText(stableStringify(displayData));
    // ...
  }, 16);
}, [value, isUpdating]);
```

**Proposed Solution**:
1. Add early return when panel is closed:
```typescript
React.useEffect(() => {
  if (!isOpen) return; // ← Skip when closed
  if (isUpdating) return;
  // ... rest of effect
}, [value, isUpdating, isOpen]);
```

2. Increase debounce timeout to 100ms (16ms is too aggressive):
```typescript
updateTimeoutRef.current = setTimeout(() => {
  // ...
}, 100);
```

3. Consider using `useDeepCompareEffect` for object comparison instead of reference comparison

**Implementation Priority**: Medium
**Estimated Effort**: 0.5 day

---

## 4. Inefficient State Management

### 4.1 No State Management Library for Complex State

**Problem**: Complex state (presentation mode, layers, tabs) is managed with many useState hooks and manual propagation. This leads to:
- Prop drilling (30+ props to EditorCanvas)
- Difficulty tracking state changes
- Potential state synchronization bugs

**Location**: Multiple files, especially `diagram-editor.tsx`

**Current Implementation Examples**:
- Lines 162-165 in `editor-canvas.tsx`: 50+ props passed to EditorCanvas
- Lines 540-587 in `diagram-editor.tsx`: 10+ state variables for presentation mode

**Proposed Solution**:
1. **Create Context Providers** (High Priority):

```typescript
// CanvasSettingsContext
interface CanvasSettingsContextValue {
  hoverEnabled: boolean;
  setHoverEnabled: (enabled: boolean) => void;
  iconBackgroundEnabled: boolean;
  setIconBackgroundEnabled: (enabled: boolean) => void;
  alignmentGuidesEnabled: boolean;
  setAlignmentGuidesEnabled: (enabled: boolean) => void;
  connectionsBehindNodesEnabled: boolean;
  setConnectionsBehindNodesEnabled: (enabled: boolean) => void;
  animationConnectionsEnabled: boolean;
  setAnimationConnectionsEnabled: (enabled: boolean) => void;
  // ... other canvas settings
}

// PresentationContext
interface PresentationContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId: string | null;
  // ... other presentation state
}
```

2. **Consider Zustand or Jotai for simpler state** (Medium Priority):
   - Good for UI state that doesn't need to be persisted
   - Avoids prop drilling
   - Easy to debug with DevTools

**Implementation Priority**: High
**Estimated Effort**: 3-4 days

---

### 4.2 Large Object Dependencies in useEffect

**Problem**: Several useEffect hooks depend on large objects (`diagramData`, `nodesById`, `zonesById`) which causes them to run on every render.

**Location**: Multiple files

**Examples**:
- `editor-canvas.tsx` line 176: `useMemo(() => calculateLayout(diagramData), [diagramData])`
- `canvas-connections.tsx` line 200: `useMemo(() => computeConnectionSlots(...), [diagramData, processedNodes, processedZones])`

**Proposed Solution**:
1. Use `useDeepCompareMemo` and `useDeepCompareEffect` for object dependencies:
```typescript
import { useDeepCompareMemo, useDeepCompareEffect } from 'use-deep-compare';

const { processedNodes, processedZones, width, height } = useDeepCompareMemo(() => {
  return calculateLayout(diagramData);
}, [diagramData]);
```

2. Or use selectors to only depend on specific properties:
```typescript
const nodeCount = useMemo(() => diagramData.nodes?.length || 0, [diagramData.nodes?.length]);
```

**Implementation Priority**: Medium
**Estimated Effort**: 1 day (requires installing dependency)

---

## 5. Canvas and Rendering Performance

### 5.1 No Virtualization for Large Diagrams

**Problem**: For diagrams with 100+ nodes, all nodes are rendered even when off-screen. This wastes rendering resources.

**Location**: `editor-canvas.tsx` (node rendering loop)

**Current Implementation**:
```typescript
// Lines ~1700-1800: Renders all nodes
{processedNodes.map((node) => (
  <DiagramNode key={node.id} node={node} ... />
))}
```

**Proposed Solution**:
Implement viewport culling:
```typescript
const visibleNodes = useMemo(() => {
  const viewport = {
    x: -transform.x / transform.k,
    y: -transform.y / transform.k,
    width: canvasDimensions.width / transform.k,
    height: canvasDimensions.height / transform.k,
  };

  return processedNodes.filter(node => {
    const nodeBounds = {
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || NODE_WIDTH,
      height: node.height || BASE_NODE_HEIGHT,
    };

    return rectIntersect(viewport, nodeBounds);
  });
}, [processedNodes, transform, canvasDimensions]);

// Render only visible nodes
{visibleNodes.map((node) => (
  <DiagramNode key={node.id} node={node} ... />
))}
```

**Impact**: For diagrams with 200+ nodes where only 20-30 are visible, reduces DOM nodes by 85%.

**Implementation Priority**: Medium
**Estimated Effort**: 1-2 days

---

### 5.2 Connection Rendering Not Optimized for Large Diagrams

**Problem**: All connections are rendered and their paths calculated even when off-screen or when both endpoints are not visible.

**Location**: `canvas-connections.tsx`

**Current Implementation**:
- Lines 126-151: Calculates edges for ALL connections
- Lines 200-300: Renders all connections

**Proposed Solution**:
1. Combine with viewport culling from 5.1
2. Skip connections where both endpoints are off-screen:
```typescript
const visibleConnections = useMemo(() => {
  if (!connectionIndices) return diagramData.connections || [];

  return (diagramData.connections || []).filter((conn, index) => {
    if (!connectionIndices.has(index)) return false;

    const fromItem = nodesById[conn.from] || zonesById[conn.from];
    const toItem = nodesById[conn.to] || zonesById[conn.to];

    // Skip if either endpoint doesn't exist
    if (!fromItem || !toItem) return false;

    // Skip if both endpoints are off-screen
    if (!isItemVisible(fromItem, viewport) && !isItemVisible(toItem, viewport)) {
      return false;
    }

    return true;
  });
}, [diagramData.connections, connectionIndices, nodesById, zonesById, viewport]);
```

**Implementation Priority**: Medium
**Estimated Effort**: 1 day

---

### 5.3 Resource Browser - Lazy Loading Provider Data

**Problem**: All 370+ resources are loaded and rendered at once, even when collapsed.

**Location**: `resource-browser.tsx`

**Current Implementation**:
- Lines 200-400: Fetches all provider JSON files
- Renders all categories even when collapsed

**Proposed Solution**:
1. Lazy load provider data when category is expanded:
```typescript
const [loadedProviders, setLoadedProviders] = useState<Set<string>>(new Set());

const handleProviderToggle = (providerKey: string) => {
  const isExpanding = !expandedProviders.has(providerKey);

  if (isExpanding && !loadedProviders.has(providerKey)) {
    // Load provider data on expand
    loadProviderData(providerKey).then(data => {
      setProviders(prev => ({ ...prev, [providerKey]: data }));
      setLoadedProviders(prev => new Set(prev).add(providerKey));
    });
  }

  setExpandedProviders(prev => {
    const next = new Set(prev);
    if (next.has(providerKey)) next.delete(providerKey);
    else next.add(providerKey);
    return next;
  });
};
```

2. Virtualize resource list within categories (if categories have 50+ items)

**Implementation Priority**: Low (only needed if performance issues observed)
**Estimated Effort**: 1-2 days

---

## 6. Drag and Drop Performance

### 6.1 Canvas Drag Operations Cause Full Re-render

**Problem**: When dragging a node, the entire canvas re-renders including all other nodes, connections, and UI panels.

**Location**: `use-canvas-drag-drop.ts`

**Current Implementation**:
- Updates `diagramData` state on every mouse move
- This triggers full component tree re-render

**Proposed Solution**:
1. Use ref-based position updates during drag, only commit to state on mouse up:
```typescript
// In use-canvas-drag-drop.ts
const draggedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  if (!isDragging || !draggedItemIds.size) return;

  // Update positions in ref (no state update)
  const deltaX = e.movementX / transform.k;
  const deltaY = e.movementY / transform.k;

  draggedItemIds.forEach(id => {
    const item = nodesById[id] || zonesById[id];
    if (item) {
      const current = draggedPositionsRef.current.get(id) || { x: item.x || 0, y: item.y || 0 };
      draggedPositionsRef.current.set(id, {
        x: current.x + deltaX,
        y: current.y + deltaY,
      });
    }
  });

  // Trigger visual update without state change
  onDraggingChange?.(true);
}, [isDragging, draggedItemIds, nodesById, zonesById, transform.k, onDraggingChange]);

const handleMouseUp = useCallback(() => {
  if (!isDragging) return;

  // Commit positions to state once
  const updates: Array<{ id: string; x: number; y: number }> = [];
  draggedPositionsRef.current.forEach((pos, id) => {
    updates.push({ id, ...pos });
  });

  if (updates.length > 0) {
    onPositionUpdate?.(updates);
  }

  draggedPositionsRef.current.clear();
  setIsDragging(false);
  onDraggingChange?.(false);
}, [isDragging, onPositionUpdate, onDraggingChange]);
```

2. Pass dragged positions as a prop to nodes during drag (via context or prop)

**Implementation Priority**: High
**Estimated Effort**: 2-3 days

---

### 6.2 Resource Browser Drag Preview Not Optimized

**Problem**: When dragging from resource browser, a large preview is created and updated.

**Location**: `draggable-resource-item.tsx`, `draggable-icon-item.tsx`

**Proposed Solution**:
Ensure custom drag preview uses cached images and doesn't create new elements on every drag start.

**Implementation Priority**: Low
**Estimated Effort**: 0.5 day

---

## 7. Memory Leaks (From Existing Analysis)

### 7.1 viewer-canvas.tsx - Global Window Assignments

**Problem**: Already documented in `INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md`

**Location**: `src/components/viewer/viewer-canvas.tsx` (lines 60-65, 174-177)

**Solution**: Add cleanup in useEffect return

**Implementation Priority**: High
**Estimated Effort**: 0.5 day

---

### 7.2 carousel.tsx - Listener Not Unsubscribed

**Problem**: Already documented in `INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md`

**Location**: `src/components/ui/carousel.tsx` (lines 114-119)

**Solution**: Add `api?.off("reInit", onSelect)` in cleanup

**Implementation Priority**: High
**Estimated Effort**: 0.5 day

---

### 7.3 use-canvas-context-menu.ts - Unstable Callback Dependency

**Problem**: Already documented in `INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md`

**Location**: `src/hooks/use-canvas-context-menu.ts` (lines 78-95)

**Solution**: Wrap `closeContextMenu` in `useCallback`

**Implementation Priority**: Medium
**Estimated Effort**: 0.5 day

---

## 8. Animation Performance

### 8.1 Connection Animation Path Lookup Computed Every Render

**Problem**: Already documented in `CONNECTION-ANIMATION-PERFORMANCE-PLAN.md`

**Location**: `src/components/diagram/bezier-connection.tsx`

**Solution**: Implement the optimizations from that plan (defer lookup, memoize, reduce samples)

**Implementation Priority**: High (already planned)
**Estimated Effort**: 2-3 days

---

### 8.2 Layer Animation Transitions Not Debounced

**Problem**: When toggling multiple layers rapidly, each toggle triggers a transition animation.

**Location**: `src/hooks/use-layer-animation.ts`

**Proposed Solution**:
Debounce rapid layer toggles to batch transitions.

**Implementation Priority**: Low
**Estimated Effort**: 1 day

---

## 9. Code Splitting and Lazy Loading

### 9.1 Large Components Not Code-Split

**Problem**: Some large components are loaded eagerly, increasing initial bundle size.

**Location**: Multiple files

**Current Good Examples**:
- `diagram-editor.tsx` lines 18-25: `TopMenuBar` is already lazy-loaded
- `diagram-editor.tsx` lines 58-60: `ScratchPad` is already lazy-loaded

**Additional Opportunities**:
1. Lazy load `ThemeEditor` (only opened occasionally)
2. Lazy load `RulesEditor` (only opened occasionally)
3. Lazy load `AboutDialog`, `KeyboardShortcutsDialog` (opened rarely)
4. Lazy load presentation-related components when not in presentation mode

**Proposed Solution**:
```typescript
const ThemeEditor = dynamic(() => import('./editor/theme-editor').then(mod => ({ default: mod.ThemeEditor })), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

const RulesEditor = dynamic(() => import('./editor/rules-editor').then(mod => ({ default: mod.RulesEditor })), {
  ssr: false,
});

const AboutDialog = dynamic(() => import('./editor/about-dialog').then(mod => ({ default: mod.AboutDialog })), {
  ssr: false,
});
```

**Implementation Priority**: Low
**Estimated Effort**: 1 day

---

## 10. Bundle Size Optimization

### 10.1 Unused Code and Dependencies

**Problem**: Potential for unused code and oversized dependencies.

**Proposed Solution**:
1. Run bundle analyzer:
```bash
npm run build -- --analyze
```

2. Review and remove unused dependencies
3. Use tree-shaking for icon libraries (Lucide React already does this well)
4. Consider CodeMirror extensions - only load what's needed

**Implementation Priority**: Low
**Estimated Effort**: 1 day (analysis) + variable

---

## Implementation Priority Summary

### Phase 1: Critical Performance Issues (2-3 weeks)
1. **Memoize DiagramNode** (High, 1 day)
2. **Fix CanvasConnections memoization** (High, 1-2 days)
3. **Fix memory leaks** (High, 1.5 days)
4. **Optimize drag operations** (High, 2-3 days)
5. **Debounce localStorage writes** (High, 1-2 days)

### Phase 2: Architectural Improvements (3-4 weeks)
1. **Refactor diagram-editor.tsx** (High, 3-4 days)
2. **Refactor context-toolbar.tsx** (High, 2-3 days)
3. **Create context providers** (High, 3-4 days)
4. **Remove unnecessary sync effects** (Medium, 1-2 days)

### Phase 3: Rendering Optimizations (2-3 weeks)
1. **Viewport culling** (Medium, 1-2 days)
2. **Memoize resource browser** (Medium, 1 day)
3. **Optimize JSON editor panel** (Medium, 0.5 day)
4. **Connection rendering optimization** (Medium, 1 day)

### Phase 4: Nice-to-Have (1-2 weeks)
1. **Code splitting** (Low, 1 day)
2. **Bundle size analysis** (Low, 1 day)
3. **Layer animation debouncing** (Low, 1 day)
4. **Resource browser lazy loading** (Low, 1-2 days)

---

## Testing Checklist

After implementing each optimization:

- [ ] Verify no visual regressions (nodes, connections, selections)
- [ ] Test with small diagrams (<10 nodes)
- [ ] Test with medium diagrams (10-50 nodes)
- [ ] Test with large diagrams (50-200 nodes)
- [ ] Test drag and drop performance
- [ ] Test connection animation smoothness
- [ ] Test zoom and pan responsiveness
- [ ] Test panel open/close performance
- [ ] Test JSON editor sync
- [ ] Test memory usage with React DevTools Profiler
- [ ] Run React DevTools Profiler to verify reduced re-renders
- [ ] Check for console warnings/errors
- [ ] Test on different browsers (Chrome, Firefox, Safari)

---

## Success Metrics

- **Render Time**: 50% reduction in time to render 100-node diagram
- **Re-renders**: 70% reduction in unnecessary re-renders during interactions
- **Bundle Size**: 10-15% reduction through code splitting
- **Memory Usage**: No memory leaks after 10+ minutes of heavy use
- **User Perception**: Smooth 60fps animations during drag and connection animation

---

## Related Documentation

- [INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md](./INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md) - Memory leak analysis
- [CONNECTION-ANIMATION-PERFORMANCE-PLAN.md](./CONNECTION-ANIMATION-PERFORMANCE-PLAN.md) - Connection animation optimization
- [CANVAS-RESPONSIVENESS-PLAN.md](./CANVAS-RESPONSIVENESS-PLAN.md) - Canvas responsiveness
