# Infinite Loops & Memory Leaks – Analysis & Recommendations

**Date**: 2025-02-12  
**Scope**: Codebase audit for infinite loops, excessive re-renders, and memory leaks.

---

## Executive Summary

The codebase is generally well-structured with appropriate cleanup patterns. No critical infinite loops were found. A few moderate risks and minor leaks were identified. Recommendations are prioritized by severity.

---

## 1. Memory Leaks (Medium Priority)

### 1.1 `viewer-canvas.tsx` – Global `window` Assignments Never Cleaned

**Location**: `src/components/viewer/viewer-canvas.tsx` (lines 60–65, 174–177)

```tsx
useEffect(() => {
  if (onFitToView) {
    (window as any).__viewerFitToView = handleFitToView;
  }
}, [handleFitToView, onFitToView]);

// Later:
useEffect(() => {
  (window as any).__viewerZoomIn = handleZoomIn;
  (window as any).__viewerZoomOut = handleZoomOut;
  (window as any).__viewerFitToView = handleFitToView;
}, [handleZoomIn, handleZoomOut, handleFitToView]);
```

**Issue**: On unmount (e.g. navigating away from the viewer), these properties remain on `window`. Stale closures and references can accumulate across mount/unmount cycles.

**Recommendation**:
```tsx
return () => {
  delete (window as any).__viewerFitToView;
  delete (window as any).__viewerZoomIn;
  delete (window as any).__viewerZoomOut;
};
```

---

### 1.2 `carousel.tsx` – `reInit` Listener Not Unsubscribed

**Location**: `src/components/ui/carousel.tsx` (lines 114–119)

```tsx
api.on("reInit", onSelect)
api.on("select", onSelect)

return () => {
  api?.off("select", onSelect)  // reInit is never removed
};
```

**Issue**: The `reInit` listener is never removed on unmount. If the carousel is used in a dynamic context (e.g. modals), listeners can accumulate.

**Recommendation**:
```tsx
return () => {
  api?.off("select", onSelect);
  api?.off("reInit", onSelect);
};
```

---

## 2. Excessive Effect Runs (Low–Medium Priority)

### 2.1 `use-canvas-context-menu.ts` – Effect Depends on Unstable Callback

**Location**: `src/hooks/use-canvas-context-menu.ts` (lines 78–95)

```tsx
useEffect(() => {
  const handleGlobalClick = (event: MouseEvent) => {
    if (contextMenu.visible) closeContextMenu();
  };
  if (contextMenu.visible) {
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleGlobalClick);
    };
  }
}, [contextMenu.visible, closeContextMenu]);  // closeContextMenu changes every render
```

**Issue**: `closeContextMenu` is not wrapped in `useCallback`, so it changes every render. When the context menu is visible, the effect runs on every render, repeatedly clearing and resetting the timeout.

**Recommendation**:
```tsx
const closeContextMenu = useCallback(() => {
  setContextMenu(prev => ({ ...prev, visible: false }));
}, []);
```

---

### 2.2 `use-sine-wave-animation.ts` – `updateOffsets` in Dependencies

**Location**: `src/hooks/use-sine-wave-animation.ts` (line 150)

```tsx
}, [selectedIds.size, updateOffsets]);
```

**Note**: `updateOffsets` is a `useCallback` with `[]` deps (uses refs). This is stable and fine. The animation loop itself has proper `cancelAnimationFrame` cleanup.

---

## 3. Potential Update Loops (Audited – No Issues)

### 3.1 `use-layers.ts` – Layers Sync

**Location**: `src/hooks/use-layers.ts` (lines 66–69, 79–84)

- `diagramData.layers` → `setLayersConfig`  
- User actions → `setLayersConfig` + `updateDiagramDataWithLayers` → `setDiagramData`

No cycle: `updateDiagramDataWithLayers` is only called from user actions, not from the sync effect. React’s `setState` with equivalent objects typically avoids repeated updates.

---

### 3.2 `diagram-editor.tsx` – History Update

**Location**: `src/components/diagram-editor.tsx` (lines 382–403)

- `useEffect` depends on `[diagramData, updateHistory, isDragging]`
- `updateHistory` calls `updateActiveTab` (history only, not `diagramData`)
- Debouncing and guards against identical history entries prevent runaway updates

No infinite loop risk.

---

### 3.3 `context-toolbar.tsx` – Panel Sync Effects

**Location**: `src/components/editor/context-toolbar.tsx` (lines 137–153)

```tsx
useEffect(() => {
  if (textStylingPanelOpen && !textStylingOpen) {
    setTextStylingOpen(true);
  }
}, [textStylingPanelOpen, textStylingOpen]);
```

Once `textStylingOpen` becomes `true`, the condition fails and the effect stops firing. No loop.

---

## 4. Properly Cleaned Resources (Audited – Good Practices)

| Component / Hook        | Resource / Pattern           | Status                                  |
|-------------------------|------------------------------|-----------------------------------------|
| `context-toolbar.tsx`   | Color / label / connection timeouts | Cleaned on unmount (lines 424–436) |
| `editor-canvas.tsx`    | `ResizeObserver`, `addEventListener` | Disconnect / `removeEventListener`     |
| `diagram-node.tsx`     | `mousemove`, `mouseup`, `click`, `keydown` | Cleanup in effect returns              |
| `tutorial-overlay.tsx`  | `setInterval`                | `clearInterval` in cleanup             |
| `json-editor-panel.tsx`| `ResizeObserver`, timeouts   | Disconnect and `clearTimeout`           |
| `theme-editor.tsx`     | `themeManager.subscribe`     | Unsubscribe on unmount                  |
| `use-sine-wave-animation.ts` | `requestAnimationFrame` | `cancelAnimationFrame` in cleanup      |
| `use-mobile.tsx`       | `MediaQueryList` listener     | `removeEventListener` in cleanup       |
| `use-canvas-drag-drop.ts` | `mouseup` listener         | `removeEventListener` in cleanup       |

---

## 5. Algorithmic Loops (Audited – Safe)

- `rich-text.ts`: `while` loops with `i` incremented
- `auto-layout.ts`: `while` loops with stack/queue and termination logic
- `theme-manager.ts`: `while (this.themes.some(...))` with ID increment

These are bounded and do not pose loop risks.

---

## 6. Action Plan

### High Priority (Memory Leaks)

1. **viewer-canvas.tsx**: Add cleanup to both `useEffect`s that assign to `(window as any)` (delete `__viewerFitToView`, `__viewerZoomIn`, `__viewerZoomOut`).
2. **carousel.tsx**: Add `api?.off("reInit", onSelect)` in the effect cleanup.

### Medium Priority (Excessive Effect Runs)

3. **use-canvas-context-menu.ts**: Wrap `closeContextMenu` in `useCallback` and depend on it in the effect.

### Low Priority (Ongoing)

4. Use React DevTools Profiler to verify there are no unnecessary re-render cascades.
5. Watch for `useEffect` deps that include objects/arrays without memoization.

---

## 7. Prevention Guidelines

1. **Event listeners**: Always pair `addEventListener` with `removeEventListener` in `useEffect` cleanup.
2. **Subscriptions**: Unsubscribe in `useEffect` cleanup (`themeManager`, API `on`/`off`, etc.).
3. **Timers**: For `setTimeout` / `setInterval`, store IDs in refs and clear in cleanup.
4. **requestAnimationFrame**: Always `cancelAnimationFrame` in cleanup.
5. **Observers**: `ResizeObserver` / `MutationObserver` / `IntersectionObserver` should be disconnected in cleanup.
6. **Global state**: Avoid `window` / `document` pollution; if used, clear on unmount.
7. **Callbacks in deps**: Use `useCallback` for functions passed as effect dependencies.
8. **Object references in deps**: Prefer primitive deps or memoized objects/arrays to avoid extra effect runs.
