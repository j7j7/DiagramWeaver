# Large-file refactor plan (line-count reduction)

**Goal**: Split oversized modules into smaller files **without changing runtime behavior**. Prefer **mechanical extractions** (move pure helpers, constants, or leaf components) over behavior changes.

**Sizing note** (from `wc -l` on `src/**/*.ts` + `*.tsx`, April 2026): files above **~600–800 lines** are candidates; above **~1,500 lines** are high priority.

**Related doc**: [`DIAGRAM_EDITOR_REFACTOR_PLAN.md`](./DIAGRAM_EDITOR_REFACTOR_PLAN.md) tracks work already done on `diagram-editor.tsx` / inner shell / hooks — continue that thread for the parent editor before inventing duplicate structure.

---

## Ranked hotspots (lines, path)

| Lines | Path |
|------:|------|
| 4570 | `src/components/diagram-editor.tsx` |
| 3500 | `src/components/editor/editor-canvas.tsx` |
| 2940 | `src/components/editor/context-toolbar.tsx` |
| 2168 | `src/components/editor/chart-data-editor-modal.tsx` |
| 2069 | `src/components/diagram/diagram-node.tsx` |
| 1937 | `src/components/editor/shape-preview.tsx` |
| 1885 | `src/lib/theme-manager.ts` |
| 1728 | `src/components/diagram/bezier-connection.tsx` |
| 1659 | `src/components/editor/canvas-connections.tsx` |
| 1638 | `src/components/diagram/shapes/bar-chart-shape.tsx` |
| 1417 | `src/lib/orthogonal-routing.ts` |
| 1216 | `src/components/editor/top-menu-bar.tsx` |
| 1089 | `src/hooks/use-slide-transition.ts` |
| 1050 | `src/components/editor/canvas-layout-utils.ts` |
| 1038 | `src/components/diagram-editor-inner.tsx` |
| 1016 | `src/components/diagram/shapes/shape-utils.ts` |
| 972 | `src/components/diagram/shapes/line-chart-shape.tsx` |
| 965 | `src/components/editor/canvas-operations.ts` |
| 914 | `src/hooks/use-canvas-clipboard.ts` |
| … | (Additional 600–900 line files listed in appendix — see regeneration command below.) |

**Regenerate ranking**:

```bash
find src -type f \( -name '*.ts' -o -name '*.tsx' \) ! -path '*/node_modules/*' -exec wc -l {} + | sort -n -r | head -50
```

---

## Proposed splits (by file)

### 1. `diagram-editor.tsx` (~4570 after latest extraction)

**Status**: Partially addressed in [`DIAGRAM_EDITOR_REFACTOR_PLAN.md`](./DIAGRAM_EDITOR_REFACTOR_PLAN.md) (types, `editor-support`, `DiagramEditorInner`, many hooks).

**Remaining high-value extractions** (preserve hook order / effect deps — see `.cursor/skills/react-effect-avoid-max-depth`):

| Slice | Target module | Contents |
|------|---------------|----------|
| Presentation thumbnails + interval + backfill | ✅ [`use-presentation-thumbnails.ts`](../src/hooks/use-presentation-thumbnails.ts) | Wired after `persistPresentationSlideFromDiagram` effect |
| PNG/GIF export | ✅ [`diagram-editor-export-handlers.ts`](../src/lib/diagram-editor/diagram-editor-export-handlers.ts) | `createDiagramExportHandlers` — **not** a React hook (avoid shifting hook indices) |
| Compact JSON save | ✅ [`diagram-editor-save-handler.ts`](../src/lib/diagram-editor/diagram-editor-save-handler.ts) | `createDiagramSaveHandler` |
| File load / Mermaid import / examples | TBD (`diagram-editor-load-handlers.ts` or similar) | **`handleLoad`**, **`handleFileChange`**, **`handleMermaid*`**, **`handleLoadExample`** clusters |
| Heavy handler clusters | Same pattern or hooks where safe | Only if refs stay stable |

**Public API**: Keep `export default DiagramEditor` and `export type { SelectedItem } from …` unchanged.

---

### 2. `editor-canvas.tsx` (~3500)

**Structure signal**: Leading block is **simulation / availability** helpers and constants (~lines 78–410 before `EditorCanvas`).

| Extract | New file(s) |
|--------|----------------|
| Simulation constants + `parseSimulation*` + `computeAvailability*` + badge helpers | `src/components/editor/editor-canvas-simulation.ts` (or `src/lib/simulation/editor-canvas-simulation.ts` if reused) |
| **Optional** later: pointer / drag subgraphs | `useEditorCanvasPointer…` hooks — only after simulation split proves stable |

**Risk**: `forwardRef` + imperative handle — extract **pure functions first**, keep component file as orchestrator.

---

### 3. `context-toolbar.tsx` (~2940)

Single `ContextToolbar` function with many sections.

| Extract | Approach |
|---------|----------|
| **Connection** popover / list / waypoints UI | `context-toolbar-connection-section.tsx` |
| **Node vs zone vs multi-select** toolbars | `context-toolbar-node.tsx`, `context-toolbar-zone.tsx`, … — shared props interface in `context-toolbar-types.ts` |
| Local state aggregation | `useContextToolbarPanels.ts` (open flags, drafts, drag indices) |

**Benefit**: Smaller chunks for review; same props contract outward.

---

### 4. `chart-data-editor-modal.tsx` (~2168)

| Extract | New file(s) |
|--------|----------------|
| Spreadsheet/table body | `chart-data-editor-table.tsx` |
| Series / axis / chart-type panels | Per-panel components or `chart-data-editor-panels/` |
| Pure transforms (CSV ↔ series) | `chart-data-editor-model.ts` |

---

### 5. `diagram-node.tsx` (~2069)

`DiagramNodeInner` is one large component; memo comparator at bottom.

| Extract | New file(s) |
|--------|----------------|
| Connector-line vertex handles / closed polygon UI | `diagram-node-connector-handles.tsx` |
| Resize / rotation chrome | `diagram-node-frame-handles.tsx` |
| **Optional** shape branch renderers | Only if profiling shows hotspots — avoid deep prop drilling |

**Keep**: `DiagramNode` export + `areDiagramNodePropsEqual` signature stable.

---

### 6. `shape-preview.tsx` (~1937)

| Extract | New file(s) |
|--------|----------------|
| One file per preview kind or grouped by catalog section | `shape-preview/` directory with barrel `index.ts` |

---

### 7. `theme-manager.ts` (~1885)

| Extract | New file(s) |
|--------|----------------|
| `DEFAULT_THEMES` array (**~lines 48–1500**) | `src/lib/default-diagram-themes.ts` — export `DEFAULT_THEMES` |
| `ThemeManager` class + `themeManager` singleton | Remains in `theme-manager.ts` — `import { DEFAULT_THEMES } from './default-diagram-themes'` |

**Low risk**: Data-only move; no logic change.

---

### 8. `bezier-connection.tsx` (~1728) & `othogonal-connection.tsx` (~797)

| Extract | New file(s) |
|--------|----------------|
| Path building, hit-testing, label positions | `bezier-connection-geometry.ts`, shared `connection-path-utils.ts` where overlap exists |
| SVG render (markers, gradients) | Thin component + defs helper |

---

### 9. `canvas-connections.tsx` (~1659)

| Extract | New file(s) |
|--------|----------------|
| Layer grouping / z-order iteration | `canvas-connections-layout.ts` |
| Per-connection wrapper | Already manageable if geometry lives in connection components |

---

### 10. `bar-chart-shape.tsx` / `line-chart-shape.tsx` / `pie-chart-shape.tsx`

| Extract | New file(s) |
|--------|----------------|
| Axes, grid, labels | `*-chart-parts.tsx` |
| Layout math | Reuse or extend `bar-chart-layout.ts` / chart libs |

---

### 11. `orthogonal-routing.ts` (~1417)

| Extract | New file(s) |
|--------|----------------|
| Graph build, A* / path search, obstacle prep | `orthogonal-routing-graph.ts`, `orthogonal-routing-path.ts` |
| Single `index` re-export | Optional barrel for stable imports |

---

### 12. `top-menu-bar.tsx` (~1216)

| Extract | New file(s) |
|--------|----------------|
| File / Edit / View / Theme menus | `top-menu-bar-file.tsx`, … or `menus/` folder |
| Shared menu primitives | Only if duplication appears |

---

### 13. `use-slide-transition.ts` (~1089)

| Extract | New file(s) |
|--------|----------------|
| Transition math / keyframe / diff | `slide-transition-logic.ts` |
| Hook wiring + React state | `use-slide-transition.ts` (thin) |

---

### 14. `canvas-layout-utils.ts` (~1050) & `canvas-operations.ts` (~965)

| Extract | New file(s) |
|--------|----------------|
| Group by **operation type** (nodes, connections, groups) | `canvas-layout-utils-nodes.ts`, etc., with `canvas-layout-utils.ts` re-exporting |

---

### 15. `diagram-editor-inner.tsx` (~1038)

| Extract | New file(s) |
|--------|----------------|
| Header vs side panels vs modals | `DiagramEditorShellHeader.tsx`, `DiagramEditorShellModals.tsx` — pass through same props |
| Align with Phase C in [`DIAGRAM_EDITOR_REFACTOR_PLAN.md`](./DIAGRAM_EDITOR_REFACTOR_PLAN.md) |

---

### 16. `use-canvas-clipboard.ts` (~914), `use-canvas-drag-drop.ts` (~665)

| Extract | New file(s) |
|--------|----------------|
| Serialize/deserialize clipboard payload | `canvas-clipboard-format.ts` |
| Platform-specific guards | Small `clipboard-env.ts` |

---

### 17. `types.ts` (~807) / `schemas.ts` (~709)

**Careful**: Wide import graph. Prefer **domain slices** only if re-exports preserve `import { X } from '@/lib/types'`:

- `types/diagram-core.ts`, `types/presentation.ts`, `types/connection.ts` → `types/index.ts` re-export all.

Same pattern for `schemas.ts` if split.

---

### 18. Third-party-style `src/components/ui/*` (e.g. `context-menu.tsx`, `sidebar.tsx`)

Treat as **vendored**: split only for maintainability with upstream diffs in mind; lower priority than app logic.

---

## Detailed action plan (execution order)

**Principles**

1. **One vertical slice per PR/merge**: e.g. “theme default data only” or “editor-canvas simulation helpers only”.
2. **After each slice**: `npm run typecheck` and `npm run lint` (no dev server unless requested).
3. **No behavior change**: move code verbatim first; rename only when clarity needs it.
4. **Re-exports**: When moving public symbols, re-export from the old path temporarily if many imports break, then follow-up PR to update imports.
5. **Effects / hooks**: When moving `useEffect` blocks, copy dependency arrays exactly; read `react-effect-avoid-max-depth` skill before changing deps.
6. **Manual smoke**: Use the checklist in [`DIAGRAM_EDITOR_REFACTOR_PLAN.md`](./DIAGRAM_EDITOR_REFACTOR_PLAN.md) for editor flows; add a short flow per area (chart modal, context toolbar, canvas) after touching that file.

**Suggested phases**

| Phase | Target | Outcome |
|-------|--------|---------|
| **P0** | `theme-manager.ts` → `default-diagram-themes.ts` | Largest **safe** win (~1.4k lines moved) |
| **P1** | Finish `diagram-editor.tsx` per existing doc (thumbs, import/export hooks) | Align with ongoing Phase C |
| **P2** | `editor-canvas.tsx` simulation block extraction | Clear boundary at ~line 430 |
| **P3** | `context-toolbar.tsx` section components | UI-only splits |
| **P4** | `chart-data-editor-modal.tsx` + chart shape siblings | Table + panels |
| **P5** | Connection components + `orthogonal-routing.ts` | Geometry vs UI |
| **P6** | `diagram-node.tsx`, `shape-preview.tsx` | Incremental subcomponents |
| **P7** | `use-slide-transition.ts`, `canvas-*-utils.ts`, clipboard/drag hooks | Pure vs hook separation |
| **P8** | `types.ts` / `schemas.ts` (optional) | Only with re-export strategy |

**Verification matrix (per phase)**

- [ ] Typecheck clean
- [ ] Lint clean
- [ ] Grep for removed symbol names — no orphan imports
- [ ] Touch relevant manual scenario (themed diagram load, canvas sim, toolbar, etc.)

---

## What we are *not* doing in this pass

- Rewriting algorithms or combining code paths “while we’re here”
- Changing default theme data or schema fields
- Renaming public routes or component exports without a migration step

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-28 | Initial ranking + split recommendations + phased action plan. |
