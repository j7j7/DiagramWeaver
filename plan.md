# Canvas rendering performance (editor)

**Goal:** Improve responsiveness with many objects without removing features. Prefer updating only work tied to the interaction (drag, resize, etc.).

## Symptom

Few nodes: smooth drag/resize. Many nodes: each frame costs more, roughly with object count.

## Root causes (summary)

1. `EditorCanvas` re-renders on each drag frame (`dragPosition` / `multiDragPositions`).
2. `DiagramNode` uses `React.memo` + `areDiagramNodePropsEqual`, but **per-item inline** `onClick` / `onContextMenu` broke **callback reference equality** → every node reconciled every frame.
3. Separately, a **new** `displayNodesById` / `nodesById` object each frame breaks `CanvasConnections` memo (`prev.nodesById === next.nodesById`) — **Phase B**.
4. `useMemo` chains that depend on `displayNodesById` **identity** (e.g. highlight stagger, alignment guides) can repeat work every frame — **Phase C**.

## Phases

| Phase | Focus | Status |
|-------|--------|--------|
| **A** | Stable props for `DiagramNode`: `onClick` / `onContextMenu` via `data-node-id` + refs to latest `displayNodesById` and handlers (so `React.memo` skips unchanged nodes). | **Done** — `editor-canvas.tsx` (`onDiagramNodeClickStable` / `onDiagramNodeContextMenuStable`, refs) |
| **B** | Stable layout `nodesById` for `CanvasConnections` + explicit drag override / custom equality. | Planned |
| **C** | Tighten `useMemo` deps (e.g. stagger, alignment guides) so drag does not recompute full-graph work each frame. | Planned |

## Verification (after each phase)

- Multi-select / group drag, connector-line drag, Alt+duplicate preview, alignment guides, connect mode, `connectionsBehindNodesEnabled` on/off, rotation, context menu, keyboard nudge.
- React Profiler: frame cost while dragging, before/after.
