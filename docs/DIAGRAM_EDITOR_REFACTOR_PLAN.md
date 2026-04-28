# Diagram editor refactor — tracked plan

**Goal**: Split `src/components/diagram-editor.tsx` into smaller modules **without changing behavior**. Public API (`SelectedItem`, default export `DiagramEditor`) stays stable for existing imports.

**Status legend**: `[ ]` pending · `[x]` done

---

## Completed extractions (Phase A — structure)

### A1 — Shared types (`diagram-editor-types.ts`)

**File**: `src/components/editor/diagram-editor-types.ts`

| Item | Status |
|------|--------|
| `SelectedItem` union type | [x] |
| `PaletteResource` | [x] |
| `PaletteSelection` | [x] |

**Consumers**: `diagram-editor.tsx` re-exports `SelectedItem`; other files may keep importing `import type { SelectedItem } from '@/components/diagram-editor'` or import from `diagram-editor-types` directly.

---

### A2 — Pure helpers & compact presentation JSON (`editor-support.ts`)

**File**: `src/lib/diagram-editor/editor-support.ts` (~510 lines)

| Area | Symbols | Status |
|------|-----------|--------|
| Constants | `PRESENTATION_THUMB_INTERVAL_MS`, `EMPTY_TAB_DIAGRAM_FALLBACK` | [x] |
| Presentation export | `buildPresentationUnionDiagramsForPngExport`, `waitTwoAnimationFrames` | [x] |
| Selection / connect cleanup | `collectConnectSourceIdsFromDiagram`, `getSelectionIdKind`, `connectionIdsFromSelectionSet`, `clearPendingConnectionWindowState` | [x] |
| Compact deck JSON | `DiagramJsonWithPresentations`, `CompactSlideV2`, `CompactDeckV2`, `CompactOperation`, `CompactOpCode`, `CompactAnimationStateV2`, `dedupeSlideRefSets`, `buildBaseNodeMap`, `canCompressNodeReplaceToIds`, `canCompressLayerReplaceToVisibleIds`, `stripConnectionDefaults` | [x] |
| Clone / slides | `safeClone`, `blankSlideVisibleFromMaster` | [x] |
| Palette | `createPaletteItem` | [x] |

---

### A3 — Shell UI (`diagram-editor-inner.tsx`)

**File**: `src/components/diagram-editor-inner.tsx` (~1040 lines)

| Item | Status |
|------|--------|
| `export function DiagramEditorInner` — layout: sidebar, header (`TopMenuBar`, tabs, presentation strip), breadcrumb, `EditorCanvas`, properties/layers/json panels, portals (UML/chart/Z-order/connection modals), `ScratchPad`, `PresentationPlayer`, animation `AlertDialog`s | [x] |
| Imports trimmed to modules actually used by this file (removed accidental duplicate of parent editor imports) | [x] |

**Parent**: `diagram-editor.tsx` wraps `TutorialProvider` → `<DiagramEditorInner ... />` → `<TutorialOverlay />`.

---

### A4 — Parent cleanup (`diagram-editor.tsx`)

| Item | Status |
|------|--------|
| Removed Inner-only imports (`createPortal`, `DndProvider`, lazy panels, etc.) | [x] |
| Kept logic-heavy hooks/state/handlers in default `DiagramEditor` | [x] |

**Approximate line counts** (after Phase C hooks session):

| File | Lines (approx.) |
|------|-----------------|
| `diagram-editor.tsx` | ~4570 (after save + export handler extraction) |
| `diagram-editor-inner.tsx` | ~1040 |
| `editor-support.ts` | ~509 |
| `diagram-editor-types.ts` | ~90 |
| `diagram-editor-inner-props.ts` | ~52 |

---

## Phase B — Props surface (`diagram-editor-inner-props.ts`)

| Item | Status |
|------|--------|
| **`diagram-editor-inner-props.ts`**: exported helpers — `ConnectionContextModalState`, `UmlOrChartModalState`, `ConnectorLineFocusedVertex`, `DiagramEditorExportOptions`, `DiagramEditorToastFn` | [x] |
| **`DiagramEditorInnerProps`**: currently **`any`** (explicit alias + eslint comment) so runtime matches pre-refactor behavior without forcing every handler/callback through loose `(...args: unknown[])` mismatches vs `EditorCanvas` / `TopMenuBar`. | [x] |
| **`diagram-editor-inner.tsx`** re-exports the named types above + `DiagramEditorInnerProps`. | [x] |
| Optional follow-up: replace `DiagramEditorInnerProps` `any` with a generated or manually curated interface once handler signatures are centralized. | [ ] |

---

## Phase C — Custom hooks from `DiagramEditor` / shell

Split by domain; each extraction must preserve effect deps (`react-effect-avoid-max-depth` skill).

| Slice | Status |
|-------|--------|
| Tutorial **`c-intro`** auto-connection (`useTutorialCIntroConnectionEffect`) — extracted from `diagram-editor-inner.tsx` | [x] |
| **`UseLayersApi`** / **`LayerAnimationApi`** type aliases (`ReturnType` of `useLayers` / `useLayerAnimation`) | [x] |
| Presentation **IndexedDB hydration** + **active-tab deck/slide/master/draft sync** | [x] — see [`usePresentationStorageHydration`](#c1--presentation-hydration--tab-switch), [`usePresentationTabSwitchSync`](#c1--presentation-hydration--tab-switch) |
| Presentation **viewport on slide change** (`useLayoutEffect` → deck slide fit) | [x] — [`usePresentationSlideViewportSync`](#c4--preference--viewport--trigger-hooks) |
| Presentation **thumbnail capture / interval / backfill** | [x] — [`usePresentationThumbnails`](../src/hooks/use-presentation-thumbnails.ts); fingerprint refs stay in parent for hydrate effect; hook placed **after** `persistPresentationSlideFromDiagram` effect (same hook order as inlined code) |
| Presentation **PNG / GIF export** (`handleExportPng`, `handleExportGif`, `handleExport`) | [x] — [`createDiagramExportHandlers`](../src/lib/diagram-editor/diagram-editor-export-handlers.ts) (**non-hook** factories: same per-render function identity as inlined `const handleExport = async`) |
| Compact **JSON save** (presentation v2, `showSaveFilePicker` / download fallback) | [x] — [`createDiagramSaveHandler`](../src/lib/diagram-editor/diagram-editor-save-handler.ts) (**non-hook**; `toast` asserted to `DiagramEditorToastFn` at call site) |
| History / **undo–redo stack** | [x] — [`useDiagramEditorHistory`](#c2--history-undoredo) |
| File **load** (JSON, Mermaid, examples) | [ ] — remains in `diagram-editor.tsx` |
| Selection + connection fan-out + animation dialogs | [ ] |
| Tabs glue | [x] — canonical hook is **`useDiagramTabs`** in `src/hooks/use-diagram-tabs.ts`; `DiagramEditor` composes it (not duplicated) |
| Keyboard shortcuts (`window` `keydown`) | [x] — [`useDiagramEditorKeyboard`](#c3--keyboard-shortcuts) |

---

### C1 — Presentation hydration + tab switch

| File | Role |
|------|------|
| [`src/hooks/use-presentation-storage-hydration.ts`](../src/hooks/use-presentation-storage-hydration.ts) | **`usePresentationStorageHydration`**: after `isLoaded`, calls `loadPresentationsByTab()` → `collapsePresentationDecksToOne` → fills `presentationStateByTabRef` and, if the active tab has stored data, applies `setPresentationDecks` / `setActivePresentationDeckId` / `setActivePresentationSlideId`; `finally` → `setPresentationStorageHydrated(true)`. Uses an internal “hydration started” ref (same guard behavior as before). |
| [`src/hooks/use-presentation-tab-switch-sync.ts`](../src/hooks/use-presentation-tab-switch-sync.ts) | **`usePresentationTabSwitchSync`**: on **`activeTabId`** change, clears `presentationPrevBaseJsonRef` / `presentationMasterFromTabSyncKeyRef`, resets or loads decks/slides/master/draft/breadcrumb stack from `presentationStateByTabRef` (including `lastRestoredStackRef` when no tab). |

**Still in parent**: tab bar `useEffect` that prunes dead tab keys from `presentationStateByTabRef`; ref mirroring effect; debounced `savePresentationsByTab`; PNG export slide switching; default deck creation effects; base-slide delta rebase — unchanged logic, same order relative to dependents (`usePresentationSlideViewportSync` extracted separately). Thumbnail capture / interval / backfill live in **`usePresentationThumbnails`** (wired after `persistPresentationSlideFromDiagram` effect).

---

### C2 — History (undo/redo)

| File | Exports |
|------|---------|
| [`src/hooks/use-diagram-editor-history.ts`](../src/hooks/use-diagram-editor-history.ts) | **`useDiagramEditorHistory`** → `{ history, historyIndex, updateHistory, undo, redo }` — matches prior `historyRef` sync, debounced append (300ms, skip while `isDragging`, cap 20), `undo`/`redo` parsing JSON into `setDiagramData` + `setSelectedItem(null)`. |

**Parent** calls the hook **after** `setDiagramData` / `setSelectedItem` are defined; `updateHistory` is still passed to **`DiagramEditorInner`** / JSON panel (`onHistoryUpdate`).

---

### C3 — Keyboard shortcuts

| File | Role |
|------|------|
| [`src/hooks/use-diagram-editor-keyboard.ts`](../src/hooks/use-diagram-editor-keyboard.ts) | **`useDiagramEditorKeyboard`**: registers `window` `keydown` — file/new/open/save, undo/redo, select all, copy/paste, fit view, escape clear multi-select, delete, group/ungroup, auto-layout, animation toggles, presentation play, simulation toggles, arrow nudge. Dependency list includes shortcuts’ callbacks (`handleNew`, `handleLoadClick`, …) so listeners track current closures. |

### C4 — Preference / viewport / trigger hooks (localStorage + `useLayoutEffect` glue)

| File | Role |
|------|------|
| [`src/hooks/use-diagram-editor-rules-scratch-layer-effects.ts`](../src/hooks/use-diagram-editor-rules-scratch-layer-effects.ts) | **`useDiagramEditorRulesScratchLayerEffects`**: restore + debounced persist for `dw:rules`, `dw:scratchpad:visible`, `dw:layerAnimations:enabled`. |
| [`src/hooks/use-toolbar-trigger-auto-reset.ts`](../src/hooks/use-toolbar-trigger-auto-reset.ts) | **`useToolbarTriggerAutoResets`**: four one-shot panel trigger flags reset after 100 ms. |
| [`src/hooks/use-diagram-editor-client-bootstrap.ts`](../src/hooks/use-diagram-editor-client-bootstrap.ts) | **`useDiagramEditorClientBootstrap`**: `setIsClient(true)` + JSON panel width + icon background + default text labels from `localStorage` (same keys as before). |
| [`src/hooks/use-presentation-slide-viewport-sync.ts`](../src/hooks/use-presentation-slide-viewport-sync.ts) | **`usePresentationSlideViewportSync`**: on slide id change, persist prior slide viewport fields on the deck slide, then `computeSlidePlaybackTransform` + `setCanvasTransform`. |
| [`src/hooks/use-diagram-editor-option-persistence.ts`](../src/hooks/use-diagram-editor-option-persistence.ts) | **`useDiagramEditorOptionPersistence`**: debounced `setItemDebounced` / `setBooleanDebounced` for JSON width and editor toggles; one-shot restore for properties panel / metadata / guides / connections-behind / animation prefs. |

### C5 — Presentation thumbnails (strip PNGs)

| File | Role |
|------|------|
| [`src/hooks/use-presentation-thumbnails.ts`](../src/hooks/use-presentation-thumbnails.ts) | **`usePresentationThumbnails`**: maintains **`presentationThumbCtxRef`** each render; fingerprint `useLayoutEffect` on deck/slide id; **`runPresentationThumbnailCaptureIfNeeded`** (primary slide + snapshot slide **`captureSnapshotPng`**); **`captureOutgoingSlideThumbnailIfNeeded`** (guards while backfill runs); **`setInterval`** + effect on slide/tab data; **backfill** over decks needing real PNGs (restore active deck/slide/draft in `finally`). |

---

## File map (quick reference)

```
src/components/
  diagram-editor.tsx                      # Default export: state + handlers + TutorialProvider shell
  diagram-editor-inner.tsx               # Presentation layout + modal portals (+ re-exported prop helper types)
src/components/editor/
  diagram-editor-types.ts                # SelectedItem, palette types
  diagram-editor-inner-props.ts          # Modal/export/toast helpers; DiagramEditorInnerProps (= any until tightened)
src/hooks/
  use-diagram-tabs.ts                    # Tab list, IndexedDB persistence, history refs (tabs glue)
  use-tutorial-c-intro-connection-effect.ts
  use-diagram-editor-history.ts         # Undo/redo stack + debounced history + updateHistory for JSON panel
  use-diagram-editor-keyboard.ts        # Global editor keyboard shortcuts
  use-presentation-storage-hydration.ts # Load presentation decks from storage when tabs are ready
  use-presentation-tab-switch-sync.ts   # Apply per-tab presentation snapshot when active tab changes
  use-presentation-thumbnails.ts       # Strip thumbnails: fingerprint layout, interval capture, SVG placeholder backfill
  use-diagram-editor-rules-scratch-layer-effects.ts
  use-toolbar-trigger-auto-reset.ts     # Toolbar one-shot styling trigger flags → false after timer
  use-diagram-editor-client-bootstrap.ts # isClient + first-paint hydration for JSON panel + a few booleans
  use-presentation-slide-viewport-sync.ts # Presentation slide deck: persist prior viewport, fit next slide
  use-diagram-editor-option-persistence.ts # Debounced option keys + hydration restore for panels/canvas toggles
src/lib/diagram-editor/
  editor-support.ts                       # Helpers + compact presentation serialization
  diagram-editor-save-handler.ts         # `createDiagramSaveHandler` — compact JSON save (no hooks)
  diagram-editor-export-handlers.ts      # `createDiagramExportHandlers` — PNG/GIF + multi-slide PNG (no hooks)
```

---

### D — Tests / smoke checklist (manual until test framework exists)

- [ ] Tab create/close/switch, unsaved close dialog.
- [ ] Presentation: base slide, snapshot slide, blank slide, play mode, thumbnails.
- [ ] Connect mode, multi-select connections, animation apply dialogs.
- [ ] JSON panel, properties panel, layers panel, scratch pad.
- [ ] Tutorial start/finish (**verify `c-intro`** still inserts A→B when entering Connections step).

---

## Changelog (update when you merge a phase)

| Date | Change |
|------|--------|
| 2026-04-28 | Phase A: types, `editor-support`, `DiagramEditorInner`, trimmed parent imports; `tsc` clean. |
| 2026-04-28 | Phase B/C: `diagram-editor-inner-props` helpers + `DiagramEditorInnerProps` alias; tutorial `c-intro` effect hook; `UseLayersApi` / `LayerAnimationApi`; trimmed `diagram-editor-inner` imports; `tsc` clean. |
| 2026-04-28 | **Phase C (domain hooks)**: `useDiagramEditorHistory`, `useDiagramEditorKeyboard`, `usePresentationStorageHydration`, `usePresentationTabSwitchSync`; `diagram-editor` wiring only; `npm run typecheck` clean. |
| 2026-04-28 | **Phase C (continued)**: `useDiagramEditorRulesScratchLayerEffects`, `useToolbarTriggerAutoResets`, `useDiagramEditorClientBootstrap`, `usePresentationSlideViewportSync`, `useDiagramEditorOptionPersistence`; ~180 lines fewer in `diagram-editor.tsx`; `tsc` clean. |
| 2026-04-28 | **`usePresentationThumbnails`**: periodic + slide-change thumbnail capture, placeholder backfill, slide fingerprint `useLayoutEffect`; shared fingerprint refs with IndexedDB hydrate effect in parent; ~350 lines fewer in `diagram-editor.tsx`. |
| 2026-04-28 | **`createDiagramSaveHandler`** + **`createDiagramExportHandlers`** in `src/lib/diagram-editor/` (factories, not hooks — avoids shifting React hook indices); `diagram-editor.tsx` modules `getFilenameStem` + `toast as DiagramEditorToastFn` at call sites. |

---

## Verification command (local)

```bash
npm run typecheck
```

(Do not start dev server unless asked; see project rules.)
