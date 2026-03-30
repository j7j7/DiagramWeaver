---
name: react-effect-avoid-max-depth
description: >-
  Prevents React "Maximum update depth exceeded" when syncing derived UI state
  (e.g. selection) from diagram/store updates. Use when adding or reviewing
  useEffect hooks that call setState and depend on selection, setters from
  useCallback, or other values whose identity changes after the effect runs.
---

# React effects: avoid max update depth (selection / diagram sync)

## When this applies

- A `useEffect` calls `setSelectedItem`, `setState`, or any updater **and** lists in its dependency array:
  - the same state it updates (e.g. `selectedItem`), or
  - a **setter function** from `useCallback` that itself depends on that state (common: `setX` recreated whenever `x` changes).

Then: effect runs → state updates → deps change → effect runs again → loop until **Maximum update depth exceeded**.

## Rule of thumb

**Depend on the event that should trigger the sync** (usually external data: `diagramData`, `currentDiagramData`, query results), **not** on the mirrored state or unstable setter identity.

## Pattern (recommended)

1. Keep a ref updated every render with the latest value needed inside the effect:

   `selectedItemRef.current = selectedItem`

2. If the setter is unstable, also stash it:

   `setSelectedItemRef.current = setSelectedItem`

3. `useEffect` dependency array: **only stable inputs** that mean “data changed”, e.g. `[currentDiagramData]`.

4. Inside the effect, read from refs; call the setter with a **functional update** and **`return prev`** when nothing actually changed (avoids redundant renders).

## Anti-pattern (do not do)

```tsx
useEffect(() => {
  // sync selectedItem from diagram
  setSelectedItem(/* ... */);
}, [currentDiagramData, selectedItem, setSelectedItem]);
```

Here `setSelectedItem` often changes whenever `selectedItem` changes → cascade.

## Quick checklist

- [ ] Does this effect update state? If yes, list **why** it should re-run (usually: source data changed).
- [ ] Are any deps **outputs** of the same update? Move them to refs or narrow deps.
- [ ] Does a `useCallback` setter close over the state this effect writes? Treat the setter as unstable; use a ref for the effect.
- [ ] After sync, does functional `setState` return `prev` when already in sync?

## Project context (DiagramWeaver)

`diagram-editor.tsx` syncs **`selectedItem` geometry** from **`currentDiagramData`** after drag so toolbar code that spreads `selectedItem` does not re-apply stale `x`/`y`. That effect must **not** list `selectedItem` or `setSelectedItem` in deps—use **`selectedItemForSyncRef`** and **`setSelectedItemForSyncRef`** instead.
