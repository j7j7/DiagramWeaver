# MEMORY.MD

## DiagramWeaver - Latest Features and Functions (Updated 2026-03-18)

### 2026-04-08 – Auto Layout: vertical graph depth (connected nodes)
**Issue**: Layered layout used **layers as columns** (left-to-right) and stacked nodes in each column on **Y**. Chains (A→B→C) had **one node per column**, all **vertically centered** to the same **Y** → nodes sat on a **horizontal line** and **edges overlapped**. **Change**: **`src/lib/auto-layout.ts`** **`layoutComponent`** now places **layers as rows** (top-to-bottom = rank / depth) and **spreads nodes in a layer on X**. Same **Sugiyama** ranking and barycenter ordering; only the coordinate mapping swapped so flowcharts get clear vertical separation between hops.

### 2026-04-08 – Auto Layout: grid within layers + grid of components
**Issue**: Many nodes **same rank** (or **no / weak edges**) still produced **one long horizontal row** per layer; **disconnected** root items used **shelf packing** with a **wide** target width → **one line** of boxes. **Change**: **`performLayeredLayout`** — multiple connected components packed with **`packComponentsInGrid`** (sqrt-based grid) instead of the shelf algorithm.

### 2026-04-08 – Auto Layout: dagre per component (fan-out → 2D, not a vertical spine)
**Issue**: Custom **Sugiyama** + **DFS tree edges** collapsed **fan-out** (e.g. hub → several nodes) into a **linear chain** of ranks → everything **stacked on one vertical axis**; edges overlapped. **Desired**: spread like a **small grid** when the graph branches (see user ref. layout). **Change**: **`src/lib/auto-layout.ts`** **`layoutComponent`** now uses **`@dagrejs/dagre`** (**`rankdir: TB`**, `nodesep` / `ranksep` aligned with existing spacing) on **all directed edges** in the component (deduped), same family as **Mermaid** layout. **Fallback**: row-major grid if layout throws. **Chain spine**: if result is **one node per rank** (≥3 ranks), apply **horizontal zig-zag** between ranks so pure chains are not one straight column.

### 2026-04-08 – Tooltips: no spurious open on programmatic focus (global)
**Cause**: Radix **`TooltipTrigger`** opens on **focus** as well as pointer hover. Modals that **focus the first control** often hit a **Close** button wrapped in a tooltip → **“Close”** appears without hover. **Fix**: **`src/components/ui/tooltip.tsx`** wraps **`TooltipPrimitive.Trigger`** and, on **`onFocus`**, calls **`preventDefault()`** when the target does **not** match **`:focus-visible`** (see Radix [issue #2248](https://github.com/radix-ui/primitives/issues/2248)) — suppresses programmatic / non–keyboard-intent focus while keeping keyboard **Tab** behavior. **`connection-context-modal.tsx`**: close button has **`data-skip-modal-initial-focus`** so initial focus targets the first **non-close** control.

### 2026-04-08 – Semver minor bump (agent rule + script)
**Cursor rule**: **`.cursor/rules/semver-minor-on-app-edit.mdc`** (`alwaysApply: true`) — when an agent **changes application code** (`src/`, app config like **`next.config.ts`**, etc.), it should run **`node scripts/bump-minor.mjs`** **once** before finishing the task. That increments **`package.json`** **`version`** **minor** (e.g. `0.1.0` → `0.2.0`, patch reset to `0`). **Skip** the bump for docs-only / meta-only edits (e.g. **`MEMORY.MD`**, rules-only), or when only touching version files. **Build** counter (**`bump-build.mjs`**) is independent (still **`predev`** / **`prebuild`**).

### 2026-04-08 – App build number (auto-increment)
**Versioning**: **`src/lib/build-version.json`** holds monotonic **`build`** (integer). **`scripts/bump-build.mjs`** increments it. **`predev`** and **`prebuild`** in **`package.json`** run the bump before **`npm run dev`** and **`npm run build`**, so each dev session or production build advances the counter. **`src/lib/app-version.ts`** exports **`APP_SEMVER`** (from **`package.json`**) and **`APP_BUILD`**. **UI**: top bar shows **`{semver} · {build}`** (before Help); **About** shows **Version {semver} · build {build}** and **Development session** when `NODE_ENV !== 'production'`.

### 2026-04-08 – About dialog copy
**UI**: **`about-dialog.tsx`** — title **About DiagramWeaver** (product name, no space); body describes a simple interactive diagram tool for presenting/conveying information and storytelling; **Privacy** section clarified (data on device, localStorage, exports where you choose; no upload to cloud/remote servers).

### 2026-04-08 – Connections popover: expandable rows
**UI**: **`context-toolbar.tsx`** — each connection row shows **grip + clickable title + chevron** when collapsed; clicking expands/collapses full settings. **Defaults**: selecting a node with **one** connection starts **expanded**; **two or more** start **all collapsed**. **Transitions**: adding a second connection (1→2+) **collapses all**; removing down to one (2+→1) **expands** the sole row. **Remember**: expanded state is **not** cleared when the popover closes; it resets when switching to another node or when diagram connections for the node go to zero. **`expandedConnectionKeys`** uses connection id or `from-to-index`.

### 2026-04-08 – Connections popover (node toolbar) matches connection context modal
**UI**: **`context-toolbar.tsx`** Connections popover (arrow button on selected node) now exposes the same line controls as right-click **`ConnectionContextModal`**: **Center on edge**, **Attach on side** (top/bottom vs left/right toggles), **Arrow** on its own row, **Smooth corners** with the same helper text, **Connection points** (add/remove waypoints), and section order aligned (line options → text/color/position → thickness/shadow/disconnect → path animation → waypoints).

### 2026-04-05 – ContextToolbar: hooks after edge early-return
**Issue**: Branch vs `main` wrapped edge toolbar handlers and post-edge handlers in **`useCallback`**. **`ContextToolbar`** returns early when **`selectedItem.itemType === 'edge'`**, so **edge** renders ran **3** extra hooks; **non-edge** skipped those and ran **many** hooks below → **Rules of Hooks** / “final argument to useCallback changed size” when right-clicking / changing selection. **Fix**: **`context-toolbar.tsx`** — revert those to **plain functions** (same as **`main`**); hooks must not be split across the edge **`return`**.

### 2026-03-30 – ResourceIcon: text-box-heading catalog + hooks order
**Issue**: Right-click on a **connection** (or any action that re-rendered the canvas with **text-box-heading** nodes) triggered **`Resource not found: text-box-heading in generic.object`** — palette JSON lists **Text Box Heading** under **`generic.text`**, while runtime type is **`generic.object.text-box-heading`**. Failed lookup also risked **React error #300** from **conditional hooks** (`useEffect` / `useMemo` only after early returns). **Fix** in **`resource-icon.tsx`**: run **all hooks** before conditional returns; **skip** resource-catalog fetch for **`generic.object.text-box-heading`** (vector icon only); keep existing render branches.

### 2026-03-30 – ResourceIcon: text-box-heading follow-up (stale fetch + fallback)
**Follow-up**: Same warning could still appear from **stale in-flight `fetch`** resolving after a type change, or **trim/Unicode hyphen** on `type`. **`resource-icon.tsx`** now: **`isTextBoxHeadingRuntimeType()`** (trim, lowercase, `\u2011` → `-`); **`AbortController`** on catalog fetch + **ignore** aborted/`AbortError`; if lookup in **`generic.object`** fails, **retry** **`generic.text`** for slug **`text-box-heading`**; **`useMemo`** returns **`null`** icon path for heading type so PNG is never used; resolved catalog file for **`text-box-heading`** does not set **`resourceFile`** (vector only).

### 2026-03-30 – Properties/Layers/Scratch/Rules/Presentation: Edit → Options
**UI**: **`top-menu-bar.tsx`** — **Show/Hide Properties** (right **panel**), **Show/Hide Layers**, **Show/Hide Scratch Pad**, **Rules**, **Enter/Exit Presentation Mode** moved from **Edit** to **Options**, in that order after **Show JSON** and before **Enable Properties** (metadata popups). **`hasOptionsPanelMenuItems`** is used so separators stay correct through the rest of **Options**. **Edit** is now clipboard, paste, select all, undo/redo, fit to view, read-only.

### 2026-03-30 – View (Light/Dark/System): moved to Options menu
**UI**: **`top-menu-bar.tsx`** — **View** submenu (**Light** / **Dark** / **System** via `ViewThemeSubmenu`) moved from **File** to **Options** (last entry, after other toggles). **`data-tutorial-id="view-menu"`** on the **View** sub-trigger for tutorials. Separator before **View** only when at least one other Options item is present.

### 2026-03-30 – Show JSON: moved to Options menu
**UI**: **`top-menu-bar.tsx`** — **Show JSON / Hide JSON** (`data-tutorial-id="toggle-json-menu"`, **Code** icon) is no longer under **File**; it is the first item in **Options** when `onToggleJsonPanel` is provided. Keyboard shortcut unchanged (**Ctrl+Shift+J** in shortcuts dialog).

### 2026-03-30 – Right-click search modal: larger palette icons
**Context menu** “search resources” grid (`search-resources-modal`, `viewMode="compact"`). **Change**: **`DraggableResourceItem`** / **`DraggableIconItem`** compact tiles use **`aspect-square`** cells with **`max-w`/`max-h` ~90–92%** for PNGs and **48×48** vector heading icon; Lucide symbols **`h-12 w-12`** (capped **`max-h/w 90%`**); emojis **`text-4xl`**; fallback **`Box`** in modal **`h-10 w-10`**. Icons fill the tile instead of fixed **20px** in **48px**-tall rows.

### 2026-03-30 – Top bar: Options menu
**UI**: **`top-menu-bar.tsx`** — new top-level **Options** menu (`data-tutorial-id="options-menu"`) immediately **right of Edit**, before **Layout**. **Options** also holds **JSON**, **panel toggles** (properties, layers, scratch, rules, presentation), **View** (app theme), and behavior toggles (metadata popups, layer animations, hover, guides, default text labels, icon background, connection ordering, animation connections). **Edit** keeps clipboard, undo/redo, fit, read-only (see newer MEMORY entries for panel moves).

### 2026-03-30 – Options: default text labels for new palette drops
**Toggle**: **Options → Enable/Disable Default Text Labels** (default: **on**). When **off**, dropping an icon or object from the palette creates a node **without** the resource **label** or **info** (description); **text** / **textbox** resources still get the catalog label as before. **Persistence**: `dw:defaultTextLabels:enabled` in localStorage. **Implementation**: `useCanvasOperations` **`addNode`** in **`canvas-operations.ts`** (`defaultTextLabelsEnabled`); **`diagram-editor.tsx`** state; **`editor-canvas.tsx`** passes the flag into the hook; **`top-menu-bar.tsx`** Options menu. When defaults are off, **`addNode`** also skips merging **`info`** / **`description`** from drag/palette item objects (covers right-click **search** and DnD). **`pastePaletteItem`** deps include **`defaultTextLabelsEnabled`**.

### 2026-03-30 – Merge `troubleshoot-mint-mocha` into `main`
Merged **`origin/troubleshoot-mint-mocha`** into **`main`** (clean merge, no conflicts). Touches **`shape-wrapper.tsx`**, **`square.tsx`**, **`html-to-image-fit-png.ts`**. Pushed **`main`** to **`origin`**. **`npm run typecheck`** passes.

### 2026-03-30 – Merge `troubleshoot-mint-mocha` into `main` (follow-up)
Second merge after branch updates: **`uml-class.tsx`** (mint/mocha grey fix for custom UML shape). Clean merge, **`npm run typecheck`** passes, pushed **`origin/main`**.

### 2026-03-30 – Merge `troubleshoot-mint-mocha` into `main` (third)
Third merge: **`point.tsx`**, **`rectangle.tsx`**, **`shape-preview.tsx`**, **`theme-manager.ts`** (mint/mocha grey fix for normal rectangle; related point/preview/theme tweaks). Clean merge, **`npm run typecheck`** passes, pushed **`origin/main`**.

### 2026-03-30 – Shape: Text box with heading (`generic.object.text-box-heading`)
**Purpose**: Rounded-rectangle body with a **linked heading strip** on any edge; **heading** and **body** use separate rich text; **drag** the heading to snap **top/bottom/left/right** (gradient + text rotation update). **Data**: `headingEdge`, `headingLabel`, `richHeadingLabel`, `headingBackgroundColor`, **`headingBackgroundStyle`** (`gradient` \| `solid`; default **gradient** = fade color to transparent; **solid** = flat strip fill) (see **`types.ts`** / **`schemas.ts`**). **Rendering**: **`text-box-heading.tsx`** (SVG body + heading path, `ShapeWrapper` with **`omitShapeText`**). **UI**: Visual styling **Heading background** + **Heading color**; corner-radius handle shared with rounded-rectangle. **Palette**: Generic → **Text** → **Text Box Heading** (`resource-generic.json`; runtime type remains **`generic.object.text-box-heading`**). **Sidebar icon**: vector in **`resource-icon.tsx`** (rounded card + **#1f2937** heading strip); palette tile uses **`ResourceIcon`**, not the PNG. **Default body text** (main area): **`body`** in **`canvas-operations.ts`** (was `More text here`); heading strip default remains **`HEADING`**. **Default size** when dropped: **180×90** (was 80×50).

### 2026-03-30 – Default horizontal text alignment: center
**Behavior**: When **`textJustify`** is unset, rich text (**`rich-text.ts`**, **`textbox-rich-display`**, **`textbox-rich-editor`**) now falls back to **`DEFAULT_TEXT_STYLING.textJustify`** (**center**), not left. **Text styling panel** uses **`effectiveTextJustify`** so **center** appears selected when unset. **New palette nodes**: shapes (with random theme) and standalone **text** nodes get **`textJustify: 'center'`** in **`canvas-operations.ts`** (textbox already did).

### 2026-03-30 – Shape label editing: same WYSIWYG toolbar as textbox/text
**Change**: **`shape-text.tsx`** uses **`TextboxRichEditor`** / **`TextboxRichDisplay`** (rich **`richLabel`**) instead of a plain **`<textarea>`**, matching **textbox** / **text** nodes. **`diagram-node`** passes **`editRuns`**, **`handleRichLabelSubmit`**, and optional **`onVerticalAlignChange`** into **`ShapeWrapper`** / shape components.

### 2026-03-30 – Shape visual styling: background “none” = transparent
**Bug**: Setting **background** to **none** on shapes showed **dark grey** (`#6b7280` fallback). **Fix**: `getShapeSvgFill()` in **`shape-utils.ts`** returns **`transparent`** when `backgroundStyle === 'none'`; **`getShapeStyles`** uses transparent background for wrappers. All SVG shape components use **`getShapeSvgFill`** for fill.

### 2026-03-30 – Cursor skill: React effects / max update depth
**Project skill** (`.cursor/skills/react-effect-avoid-max-depth/SKILL.md`): use **refs** for latest selection + setter; **`useEffect`** deps only **`currentDiagramData`** (or other stable “source” data)—not **`selectedItem`** / unstable **`setSelectedItem`**—to avoid **Maximum update depth exceeded** when syncing selection from the diagram.

### 2026-03-30 – Selection sync after drag (visual styling jump)
**Bug**: After moving a node on the canvas, opening visual styling and changing a value snapped the item back to the pre-drag position. **Cause**: `moveItem` / `handleNodeUpdate` update **`diagramData`** but not **`selectedItem`**; `handleVisualStylingChange` spread **`selectedItem`**, so **`handleItemUpdate`** re-applied stale **`x`/`y`**. **Fix**: **`diagram-editor.tsx`** — `useEffect` on **`currentDiagramData`** + selection syncs **`selectedItem`** geometry (position, size, rotation, line endpoints) from the diagram when it differs. **Follow-up**: Effect must depend only on **`currentDiagramData`**; read selection via **`selectedItemForSyncRef`** (and **`setSelectedItemForSyncRef`**) so **`setSelectedItem`** identity changes do not retrigger the effect (**maximum update depth**).

### 2026-03-30 – Tutorial diagram B: labels Object A/B/C
**Tutorial** sample **`tutorial-b-content.json`** node labels are **Object A**, **Object B**, **Object C** (not “Step A/B/C”). **`tutorial-steps.ts`** copy for **Diagram content**, **Selection**, and **Connections** matches.

### 2026-03-27 – File → Export PNG: fit-to-view framing and canvas-sized dimensions
**PNG export** uses **`captureViewportPngDataUrl({ fitContent: true, fitPadding: 50 })`** — same **`computeContentBounds`** + **`transformToFitBounds`** / clone **`.dot-grid`** transform as fit-content captures, with **50px** padding to match **`handleFitToView`**. Output dimensions are **`getCanvasElementSizeForImageCapture`** (canvas **`clientWidth`/`clientHeight`**) passed as html-to-image **`width`/`height`**, not the layout coordinate minimum (**2000×1500**). **`useCanvasExport`** no longer takes unused **`transform`/`width`/`height`**.

### 2026-03-26 – Help menu pinned to the right of the top bar
**UI**: **Help** is a second `Menubar` (same items as before) placed after zoom/cursor readouts with **`ml-auto`** so it sits at the **far right** of the toolbar row; outer bar uses **`w-full min-w-0`**.

### 2026-03-26 – Help menu + sectioned interactive tutorial with tutorial JSON
**UI**: Top bar **Help** (`data-tutorial-id="help-menu"`) — **Keyboard shortcuts**, **Interactive tutorial**, **About** (moved from File). **File** keeps document actions only. **Tutorial**: `tutorial-steps.ts` defines sections (`sectionLabel`) A/B/C; `TutorialStep.loadExampleId` loads `/public/examples/tutorial/` JSON into the **active tab** via `handleLoadTutorialExample` in **`diagram-editor`**. Examples: `tutorial-a-orientation.json`, `tutorial-b-content.json`, `tutorial-c-connections.json`. **IDs**: `main-menubar` on Menubar, `component-sidebar` on sidebar. Auto-start first-run delay **800ms** (tabs + DOM ready).

### 2026-03-26 – File menu: Keyboard shortcuts dialog
**UI**: File → **Keyboard shortcuts** (after **About**) opens **`keyboard-shortcuts-dialog.tsx`** — amber/yellow modal (matches tutorial styling). Lists file/edit shortcuts, **duplicate** (copy/paste + **Alt+drag** for nodes), **multi-select** (Shift / Ctrl / ⌘+click), **Control+drag** axis lock (⌃ on Mac, not Command), **canvas mouse** (wheel zoom, right-drag pan, right-click search on empty canvas, context menu on items), **resize** (edge vs corner). Title: **Keyboard shortcuts & canvas input**. **`top-menu-bar.tsx`** wires menu item + state.

### 2026-03-26 – Tutorial overlay: yellow popups + roadmap doc
**UI**: `tutorial-overlay.tsx` — tutorial card uses **amber/yellow** panel (`bg-amber-50` / `dark:bg-amber-950/95`), matching border, arrow, and **amber highlight ring** around focused targets (replacing generic popover/primary styling). **Planning**: `docs/TUTORIAL-MAP.md` lists proposed tutorial steps covering editor features (canvas, sidebar, menus, connections, styling, JSON, presentation, rules, viewer, etc.) and notes which `data-tutorial-id` hooks still need to be added in the UI.

### 2026-03-25 – Slide transitions: connection lines lerp with moving endpoints
**Problem**: In presentation play mode / viewer, nodes CSS-animated between slides but connections were only transitioned on appear/disappear—lines jumped to the new geometry when endpoints moved. **Fix**: `use-slide-transition` detects stable connections whose **from/to** items moved (or waypoints changed), stores previous→current deltas, and a **requestAnimationFrame** loop (aligned with the same double-rAF start as node transitions) interpolates **`slideEndpointOffset`** / **`slideWaypointOffsets`** using **`ease-slide-cubic-bezier`** (`cubic-bezier(0.4, 0, 0.2, 1)` to match slide **EASE_IN_OUT**) and the same stagger delays as connections. **`CanvasConnections`** / **`CanvasConnectionText`** apply offsets when computing **`getOptimalConnectionPoints`** (and skip cached edge picks while offsets are active); **`BezierConnection`** / **`OrthogonalConnection`** receive **`geomFrom`/`geomTo`**. **`viewer-canvas`** passes transition styles into connection text.

### 2026-03-25 – Presentation: backfill slide thumbnails after compact file load
**Compact v2** embedded presentations set every slide’s **`snapshotImage`** to an SVG placeholder (`PRESENTATION_THUMBNAIL_PLACEHOLDER` in **`extract-embedded-presentations.ts`**), so the snapshot strip looked blank/generic. **`slideNeedsPresentationThumbnailSnapshot`** treats non-`data:image/png` snapshots as needing capture. **`diagram-editor`**: when **presentation mode** is on and **`presentationMasterDiagram`** is set, a **`useEffect`** (keyed by **`presentationDeckIdentityKey`**, not per-thumbnail updates) sequentially **`flushSync`**’s each slide as active draft, **`captureSnapshotPng`** with **`unionDiagrams`**, then restores the prior active slide. **`runPresentationThumbnailCaptureIfNeeded`** skips while **`presentationThumbBackfillRunningRef`** is true.

### 2026-03-25 – Presentation thumbnails: capture outgoing slide before navigation (delta fingerprint)
**Per-slide** delta JSON fingerprints live in **`presentationThumbDeltaFingerprintBySlideRef`** (`${deckId}:${slideId}`). **Baseline** is set in **`useLayoutEffect`** when deck/slide changes (not on draft-only edits) and when **storage hydration** applies **`setPresentationDraftDiagram`**. **`runPresentationThumbnailCaptureIfNeeded`** skips when fingerprint matches **unless** **`slideNeedsPresentationThumbnailSnapshot`** (placeholder PNG). **`captureOutgoingSlideThumbnailIfNeeded`** is **`await`**’d before changing slides in **`handleSelectPresentationSlide`**, deck create/select/delete, and **add snapshot**. Removed the post-switch **`useEffect`** that captured the **incoming** slide; **3s** poll interval still runs **`runPresentationThumbnailCaptureIfNeeded`** while editing without switching (no-op when delta fingerprint unchanged).

### 2026-03-25 – Merge `customized-picture-icon` into `main`
Merged **`origin/customized-picture-icon`** into **`main`** with **`-X ours`** so any overlapping edits resolve in favor of **main**; non-conflicting branch changes were applied. Adds custom picture/icon flow: **`/api/validate-image-url`**, **`custom-icon-utils`**, **`custom-icon-image`**, **`custom-icon-preview-editor`**, **`resource-browser`**, plus updates to **`diagram-editor`**, **`properties-panel`**, **`schemas`**, **`types`**, **`resource-icon`**, **`diagram-node`**, **`component-sidebar`**, **`editor-canvas`**. **`npm run typecheck`** passes after merge.

### 2026-03-25 – Presentation mode (editor): per-slide viewport when switching snapshots
In **`diagram-editor`**, **`useLayoutEffect`** tracks **`prevPresentationSlideIdForViewportRef`**. On **slide id change**: **persist** outgoing slide’s **`autoZoomLevel` / `viewPanX` / `viewPanY`** from **`canvasTransformRef`** into **`presentationDecks`**, then **`computeSlidePlaybackTransform`** + **`setCanvasTransform`** for the **incoming** slide (diagram from master + that slide’s **`diagramDelta`**). If **`prevSlideId === activePresentationSlideId`**, return early so deck updates (thumbnails, delta persist) **don’t** reset the canvas every render.

### 2026-03-25 – Presentation playback: per-slide pan + zoom with lerp
**Slides** store **`viewPanX` / `viewPanY`** with **`autoZoomLevel`** when adding a snapshot or applying zoom to the active snapshot (compact JSON **`px` / `py`** next to **`z`**). **`PresentationPlayer`**: **`computeSlidePlaybackTransform`** uses saved pan when present; legacy slides (zoom only) center content at the saved zoom via **`transformToFitBoundsWithFixedZoom`**. Camera animates over **300ms** ease-out (aligned with **`use-slide-transition`**). **Use slide zoom** applies in **fullscreen** too (no longer gated on **`showPlaybackToolbar`**). Union-fit fullscreen runs only when **Use slide zoom** is off. Global auto-zoom / apply-zoom-to-all clears per-slide pan.

### 2026-03-25 – Presentation strip: thumbnail `object-contain`
**`presentation-editor-panel.tsx`** `DraggableSlideItem`: snapshot **`img`** uses **`object-contain`** inside an **`aspect-video`** frame with **`bg-muted`**, not **`object-cover`** — canvas PNGs are not 16:9, so cover cropped edges in the toolbar strip. **`loading="lazy"`** / **`decoding="async"`**.

### 2026-03-25 – Presentation play mode auto-zoom matches viewer (union of all slides)
**PresentationPlayer** (editor play mode, toolbar visible): **Auto zoom** now calls **`applyViewerUnionFit()`** (`computeUnionFitTransformForDiagrams` over all **`slideDiagrams`**, pruned connections) and turns **Use slide zoom** off so the one camera (pan + zoom) persists — same behavior as viewer fullscreen presentation. **`diagram-editor`** **`runPresentationAutoZoom`** (presentation panel wand / apply zoom to all snapshots) uses the same union-fit **`k`** vs **`window.innerWidth`/`innerHeight`** when the deck has slides; empty deck still uses **`editorRef.fitToView()`** on the current canvas.

### 2026-03-25 – Presentation thumbnails: fit content inside PNG only (no canvas change)
**Thumbnails** call **`captureSnapshotPng({ fitContent: true, unionDiagrams: activePresentationSlideDiagramsForThumbnailCapture })`** — union uses **live `presentationDraftDiagram`** for the active slide (not only persisted delta). **`use-canvas-export`** / **`html-to-image-fit-png.ts`**: html-to-image **`cloneNode`**, then **`.dot-grid`** transform on the clone = **`computeUnionFitTransformForDiagrams`** (same as viewer embedded presentation / `PresentationPlayer`) over **all deck slides**, with **`pruneConnectionsToVisibleNodes`**. Viewport size for that math uses **`getCanvasElementSizeForImageCapture`** (full canvas **`clientWidth`/`clientHeight`**) so it matches the rasterized bitmap — not **`getElementVisibleViewportSize`** (window-clipped), which caused mis-centered PNGs (e.g. top cut off). Fallback: single-slide **`computeContentBounds`** if union fails. **Add snapshot** unchanged (no `fitContent`).

### 2026-03-25 – Presentation toolbar: snapshot index between prev/next
**Editor** `PresentationEditorPanel`: Between **Previous** and **Next** snapshot buttons, a **`n / total`** readout (`tabular-nums`, muted text); **—** when no deck/slides. File: `presentation-editor-panel.tsx`.

### 2026-03-25 – Presentation mode: no separate export/import
Presentation decks are embedded in the main diagram JSON; **Export** / **Import** buttons and `handleExportPresentations` / `handleImportPresentations` were removed from `PresentationEditorPanel` and `diagram-editor.tsx`. **`exportPresentationsToJson`**, **`importPresentationsFromJson`**, and **`stripSnapshotImages`** removed from `presentation-storage.ts`. Docs: `PRESENTATION-MODE.md`.

### 2026-03-25 – Presentation mode toolbar: Exit
**Editor** `PresentationEditorPanel` header row (right of collapse / float): **Exit** button with LogOut icon — calls `onExitPresentationMode` → `setPresentationModeEnabled(false)` and same cleanup as turning presentation mode off (draft, disabled layers, close play mode). Files: `presentation-editor-panel.tsx`, `diagram-editor.tsx`.

### 2026-03-25 – Presentation panel: single toolbar row
**Editor** `PresentationEditorPanel`: Removed the separate top row (“Presentation Mode”, deck · slide count badge) and the **Toolbar** label. One horizontal bar: scrollable deck/snapshot controls (`flex-1 overflow-x-auto`) plus **collapse**, **float/pin**, and **Exit** on the right (`shrink-0`). Floating mode keeps grip + drag on the combined bar. File: `presentation-editor-panel.tsx`.

### 2026-03-25 – Presentation panel: collapse hides previews only
The first **minimize** control on the presentation bar toggles **`snapshotsCollapsed`** (hide/show slide thumbnail strip), not a separate `toolbarCollapsed` state. Deck controls, snapshot actions, and pin/exit stay visible. Removed `toolbarCollapsed` from panel localStorage. File: `presentation-editor-panel.tsx`.

### 2026-03-25 – Presentation panel: no drag resize above thumbnails
Removed the horizontal **grip** strip between the deck toolbar and the snapshot thumbnails (was `cursor-n-resize` + `GripHorizontal`). File: `presentation-editor-panel.tsx`.

### 2026-03-25 – Presentation thumbnails: height fits content
Snapshot strip **no longer uses a fixed pixel height** (`snapshotsPaneHeight` removed from state and `dw:presentation:panelSettings`). The bordered viewport is **`h-auto`** (content-sized) so extra gray space under thumbnails is gone. Empty-deck placeholder uses **`min-h-[88px]`** instead of `min-h-full`. **Floating** snapshots bar: removed chevron shrink/grow height controls. Thumbnail card image wrapper: **`shrink-0`** instead of `flex-1 min-h-0`. File: `presentation-editor-panel.tsx`.

### 2026-03-25 – Connection: edge attachment constraint
**Data**: `DiagramConnectionData.edgeAttachmentConstraint?: 'auto' | 'top-bottom' | 'left-right'` — default/unset = **auto** (existing behavior). **`top-bottom`**: only top/bottom attach edges; **`left-right`**: only left/right. **UI**: Connection properties modal (`connection-context-modal.tsx`) — **Attach on side**: two icon toggles (↕ top/bottom, ↔ left/right); active = constrained, both off = auto; switching one on replaces the other. **Logic**: `determineConnectionEdges` and `getOptimalConnectionPoints` in `bezier-connection.tsx` clamp inferred or preferred edges to the allowed axis set using the same dx/dy rules as automatic routing (orthogonal pathing / avoidance unchanged). **Persistence**: `stripConnectionDefaults` stores only `top-bottom` or `left-right`; merge clears the field when explicitly set to auto/undefined (`applyConnectionUpdates` uses `'edgeAttachmentConstraint' in updates`). **Load/save**: `DiagramConnectionDataSchema` includes the field (Zod does not strip it). **JSON panel Apply** uses `flattenDiagramOnImport` + `DiagramDataSchema.safeParse` + `ensureConnectionIds` (same as file open) so hand-edited JSON keeps `edgeAttachmentConstraint`. **Viewer** (`/viewer`): loads via `validateAndConvertJson` in `viewer-utils.ts` — now returns `{ ...DiagramDataSchema.parse(...), connections: ensureConnectionIds(...) }` so all parsed connection fields are kept; `ViewerCanvas` reuses `CanvasConnections` / `determineConnectionEdges` / `getOptimalConnectionPoints` like the editor.

### 2026-03-25 – Orthogonal routing: force 90° segments after avoidance
Orthogonal connection routing could still emit a diagonal-looking hop after pathfinding when the endpoint approach-correction step rewrote a waypoint without repairing the following segment. **Fix**: `orthogonal-routing.ts` now (1) keeps A* state keyed by **position + direction** so turn costs remain valid, (2) expands the search bounds to include nearby inflated obstacles so avoidance succeeds more often before fallback, (3) rebuilds misaligned source/target approach segments with an orthogonal bridge instead of mutating a single point, and (4) runs a final orthogonality enforcement pass so every emitted segment is horizontal or vertical, including waypoint-chained routes. **Fallbacks** now prefer stricter obstacle-safe routes before relaxed ones.

### 2026-03-25 – Orthogonal routing: avoid unnecessary line crossings
Orthogonal routing now considers already-routed orthogonal connections as **soft traffic**, not hard blockers. **Implementation**: `CanvasConnections` batch-computes visible orthogonal routes in render order via `computeOrthogonalRoutesBatch(...)` and feeds earlier route segments into later ones. In `orthogonal-routing.ts`, A* adds a **high penalty** for perpendicular crossings and a **mild penalty** for exact corridor reuse, with reduced sensitivity near the current route's endpoints so local exits/entries do not get distorted. Result: later paths prefer to avoid crossing existing orthogonal lines, but can still run along the same corridor when that is cleaner than a large detour.

### 2026-03-25 – Orthogonal connections: smooth corners option
Orthogonal connections now support **`smoothCorners?: boolean`**. This is a **visual-only** option for orthogonal lines: when enabled, each 90-degree bend is rendered with a small rounded corner in the SVG path data, but the underlying orthogonal route points, obstacle avoidance, crossing-avoidance heuristics, waypoint routing, and connection logic remain unchanged. **UI**: shown only when **Orthogonal** is selected in connection controls (`connection-context-modal.tsx`, edge toolbar, node Connections popover). **Persistence**: stored only when `true` in compact connection deltas.

### 2026-03-25 – Connection: center edge anchors
**Data**: `DiagramConnectionData.centerEdgeAnchors?: boolean` — when `true`, both endpoints attach at the **center of the chosen edge** instead of **spreading along the edge** with `connectionIndex` / `totalConnections` (default unchanged). **UI**: Right-click connection → **Connection** properties modal → **Center on edge** switch. **Implementation**: `getConnectionPoint(..., centerEdgeAnchors)` in `bezier-connection.tsx`; compact JSON delta keeps `centerEdgeAnchors` only when `true` (`stripConnectionDefaults`).

### 2026-03-20 – Slide transition: shadow flash in play mode
**Cause**: `use-slide-transition` used `transition: all` on nodes/connections, which pulled unrelated paint props (e.g. shadow/filter) into interpolation/compositing during the motion phase. **Fix**: `slideMotionTransition()` — only `opacity` and `transform` are transitioned; color crossfade / merge still use their existing scoped transition strings.

**Gradient crossfade** stacks two renders; **`SlideShapeShadowTransitionProvider`** sets `crossfade` only when `visualColorCrossfade` is active—then suppress per-layer shadow and use **one** group `filter: var(--shape-shadow-drop)` (same CSS as a single layer). Solid colour lerp (`visualColorMerge` only) keeps the **normal** per-layer shadow so it doesn’t blink off/on. **Textbox** / **uml** / **ShapeWrapper** suppress local shadow only in `crossfade`. **SVG solid merge**: no inner `ShapeWrapper` paint `transition` when `skipWrapperStyling`.

### 2026-03-20 – Hard refresh in presentation mode: restore slide canvas
**Problem**: Per-tab presentation **decks/slide id** load from IndexedDB after refresh, but **master/draft** were never persisted; the active-tab effect could also clear presentation state before that load. **Fix**: After **`presentationStorageHydrated`**, if presentation mode is on and there is an active deck + slide, **rebuild** `presentationMasterDiagram` from **`tabDiagramData`** (when missing) and **`presentationDraftDiagram`** via **`applyDiagramDelta(projectVisibleDiagram(master), slide.diagramDelta)`**, keyed by **`tabId:deckId:slideId`** (`presentationSlideCanvasKeyRef`) so edits don’t reset every render. Clear key when leaving presentation mode. File: `diagram-editor.tsx`.

### 2026-03-20 – Tab modified dot for presentation-mode canvas edits
**`TabState.hasUnsavedPresentations`** + **`isModified`** now true when embedded presentation data is dirty (canvas edits in **presentation mode** only updated the slide draft, not `tab.diagramData`). Set on `setDiagramData` when `presentationModeEnabled`; cleared by **`markTabAsSaved`** and on **file load**. Files: `use-diagram-tabs.ts`, `diagram-editor.tsx`.

### 2026-03-20 – Viewer layout: properties rail + no rulers
**`/viewer`**: Canvas and **Properties** sit in a **horizontal row** under the breadcrumb (matches editor), so the properties panel is **full viewport height** beside the diagram. **Collapsed** properties strip is **`absolute` on the right** so it **does not shrink** the canvas width; viewer passes **`narrowCollapsed`** on `PropertiesPanel` (**`w-7`**, icon-only rail vs editor `w-12` + label). Properties wrapper has **`data-dw-viewer-properties`** for toolbar auto-hide chrome detection. **`ViewerControls`** is a **sibling** of the canvas host (not inside the `pointer-events-none` wrapper when fullscreen). **`ViewerControls` is not mounted** while **`presentationViewActive`** (embedded slides) or **`presentationPlayerOpen`** (fullscreen player)—toolbar is **hidden entirely** in presentation. **Rulers** are off by default on `ViewerCanvas` (`showRulers` default `false`; presentation player unchanged). **`ViewerControls`**: **`absolute` top-left**, **`bg-card/80 backdrop-blur-md`**, **`z-[90]`** / touch strip **`z-[89]`**, **properties toggle first**. **Auto-hide** (non-presentation only): starts **visible**, **1s** first hide; then edge / toolbar / properties reveal; **1s** hide after leaving chrome; **`translate-x`** off-screen; **`inert`** when hidden. **Properties default hidden**; opening from toolbar **expands** the panel. Files: `viewer/page.tsx`, `viewer-canvas.tsx`, `viewer-controls.tsx`, `properties-panel.tsx`, `viewer-presentation-bar.tsx`.

### 2026-03-20 – Viewer: `?file=` local JSON
**`/viewer?file`** or **`/viewer?file=`** (empty value): opens **`ViewerLocalFilePanel`** — choose `.json`, drag-and-drop, same validation/presentations as `loadViewerData` via `viewerDataFromUnknownJson`. **Non-empty** `file`: resolved with `resolveViewerFileParam` (absolute http(s) or path relative to the current page URL), then fetched like `url`. Cannot combine `file` with `json`/`url`. Browsers cannot load raw `file://` paths. **Implementation**: `parseViewerParams` → `ParsedViewerParams`; optional `rawLocationSearch` (`window.location.search`) so bare `?file` works if the Next `useSearchParams()` snapshot omits it; regex fallback via `fileQueryFromRawQuery`. `sessionFileChosenRef` avoids wiping client-loaded data while the URL stays `?file=`. **`displayData` `useMemo` must run before loading/file-picker early returns** or React throws #310 (“more hooks than previous render”) after picking a file.

### 2026-03-20 – Standalone viewer: embedded presentation slides
**`/viewer` loads `presentations` from saved JSON** (same v2 compact + legacy shapes as the editor): `loadViewerData` returns optional `presentation` (hydrated decks). **Shared extraction** in `extract-embedded-presentations.ts`; `diagram-editor` file load uses `extractEmbeddedPresentations(json, parseUnknownJsonToDiagramData(json))` so behavior matches pre-refactor.

**In the viewer**: MonitorPlay control (when the diagram has slides) uses a **green ring + glow** (idle) and **brighter green glow + accent** when presentation slide view is on; it toggles **presentation slide view** — same `useSlideTransition` + `ViewerCanvas` transition maps as `PresentationPlayer`, per-slide `animationState`, **union fit zoom** over all slides (`computeUnionFitTransformForDiagrams` + host `ResizeObserver` / `getElementVisibleViewportSize`, not per-slide `autoZoomLevel`), keyboard: Space = next, ← / → = prev/next, ↑ / ↓ = first/last (inputs excluded). **`ViewerPresentationBar`** is `fixed` bottom-center on the viewport. **`skipInitialFitToView`** while presenting so mount auto-fit does not override. **Fullscreen** (`PresentationPlayer` with `showPlaybackToolbar={false}`): **Union fit zoom** — `presentation-viewport-fit.ts` runs `calculateLayout` on every pruned slide diagram, unions axis-aligned bounds, then one `transformToFitBounds` to `window.innerWidth`/`innerHeight` (recomputed on resize). Per-slide `autoZoomLevel` is not used in this mode. `ViewerCanvas` gets `skipInitialFitToView` so mount auto-fit does not override. Editor fullscreen still uses slide zoom + bottom bar. **Radix `pointerDownOutside` / `interactOutside`** are prevented in that mode so clicks on the viewer chrome (e.g. `ViewerPresentationBar` at `z-[60]` above the dialog’s `z-50`) do not close fullscreen. While fullscreen: hide the snapshot bar, `pointer-events-none` on the main canvas column + properties panel, and pause embedded `usePresentationSlideView` / per-slide zoom sync so only the player drives slides. Editor fullscreen keeps outside-dismiss and the full toolbar (default `showPlaybackToolbar`). Sub-diagram navigation exits slide mode; layers side panel hidden during slide view.

### 2026-03-20 – Presentation mode: auto-save slide edits + toolbar cleanup
**Auto-save diagram delta to the active snapshot**: In presentation mode, edits to the canvas update the current slide’s stored `diagramDelta` automatically (effect on `presentationDraftDiagram` calling `persistPresentationSlideFromDiagram`). No separate “Save snapshot” control. **Toolbar**: Removed Save snapshot button, zoom percent input, and per-thumbnail zoom % badges. **Apply zoom** buttons use the current canvas zoom level (`canvasTransformRef`). Files: `diagram-editor.tsx`, `presentation-editor-panel.tsx`.

**Snapshot PNG thumbnails (delayed refresh)**: `runPresentationThumbnailCaptureIfNeeded` compares `JSON.stringify(computeDiagramDelta(...))` to **`presentationThumbDeltaFingerprintBySlideRef`** per slide; skips when unchanged unless the slide still has a placeholder PNG. **3s** `setInterval` polls while on a slide; **outgoing** capture runs before navigation. `presentationThumbCaptureInFlightRef` prevents overlap.

### 2026-03-20 – Presentation slide transition: color lerp
**Between slides**, `use-slide-transition` animates position/size/opacity. **Visual color fields** (`backgroundColor`, gradients, borders, `textColor`, `iconColor`, `lineColor`, etc.) are compared via `visualColorSignature` in `slide-visual-color.ts`. **Solid / simple paint**: (1) start colors + transition `none`; (2) after double rAF, still start colors + delayed merge transition; (3) next rAF applies end colors so CSS interpolates. **SvgShapeBase** adds scoped SVG rules for `fill`/`stroke` transitions. **Gradients**: `visualColorNeedsCrossfade` → two renders + top opacity with per-item delay. **Stagger**: `slide-transition-order.ts` — only **changing** nodes/connections get delays (stack order among those). Skips nodes with no geometry/color change (same as previous slide); skips stable connections (both slides). Line shapes: `startPos`/`endPos` and `rotation` count as movement. **80ms** between staggered items; total cleanup `maxStagger + 300ms + 50`. If nothing transitions, `startTransition` returns early.

### 2026-03-20 – Theme menu swatches + new built-in themes
**Themes dropdown swatch fix**: Small previews used only `backgroundColor` / `borderColor`, so **gradient** themes (e.g. Golden Yellow, Royal Purple) fell back to pale gray and looked white/wrong. Previews now use `getVisualStylingCSS(themePropertiesToVisualStyling(...))` from `visual-styling.ts` so gradient fills and gradient borders match the theme. Updated: `theme-menu-selector.tsx`, `theme-selector.tsx`, `theme-editor.tsx` list preview card.

**Ten new built-in themes** in `theme-manager.ts`: Aurora Teal, Lavender Mist, Ember Clay, Slate Indigo (now listed as **Grey · Slate Indigo**), Mint Mocha, Sakura Blush, Deep Current, Olive Grove, Citron Pop, Merlot Rose. **Grey / steel family**: five additions (Ash Mist, Charcoal Smoke, Cool Steel, Pewter Plate, Warm Concrete) plus renamed **Grey · Light Minimal** (was Minimal Gray) and **Grey · Slate Indigo** so built-in lists sort them adjacent under `Grey ·`.

**Theme list ordering & completeness**: Built-in and custom themes in `getThemesSorted()` are ordered by **hue** (accent from `lineColor` → border → background) via `theme-spectrum.ts`; low-saturation themes sort after chromatic ones. Themes menu and theme popover **list all themes** (no 20-item cap or “and N more”). **Nature set**: Moss & Bark, Sea Glass, Wheat Straw, Redwood Grove, Lichen Stone, Desert Sand, Mountain Sky, Peat Earth, Tide Pool, Autumn Leaf. **Dark blues**: Midnight Sapphire, Cobalt Depth, Prussian Ink. **Mint Mocha** uses green `lineColor` for spectrum sort while keeping espresso borders.

### 2026-03-20 – Alt+drag duplicate on canvas
**Hold Option/Alt while dragging** selected node(s): originals stay put; semi-transparent previews follow the cursor; **drop** creates clones at that position and selects them. **Release Alt before drop** to switch back to a normal move (same as standard drag). **Modifiers while dragging** must not rely on bubble-phase `keydown` alone (HTML5 DnD often swallows those)—`use-canvas-drag-drop` syncs Alt from **capture** `keydown`/`keyup` plus **`dragover` / `mousemove` / `pointermove`**, and uses **`altModifierRef`** so `drop()` reads the current Alt state. `duplicateNodesAtPositions` in `canvas-operations.ts`, preview layer in `editor-canvas.tsx`, `isDuplicateDragPreview` on `DiagramNode`. Line nodes duplicate with endpoints shifted; `groupId` cleared on copies.

**Ctrl (Control) during move or Alt-duplicate**: constrains motion to **horizontal or vertical** relative to the drag origin. Outside a small dead zone (~15px in diagram space), locks to the dominant axis; **inside the dead zone** the lock clears so you can switch axis or nudge near the source. **Release Ctrl** to remove the constraint (synced via `ctrlModifierRef` like Alt). Uses shared anchor `getCanvasDragAnchor` (line nodes: min of endpoint box corner) in `use-canvas-drag-drop` **hover** and **drop**.

**Multi-drag drop vs `mouseup` order**: document `mouseup` could run before `drop` and cleared `multiDragStartPositions`, so `drop` skipped the multi branch (only one item moved or display showed one ghost). **Fix**: removed that ref; multi **hover** and **drop** always read start `(x,y)` from `nodesById`/`zonesById`. Global `mouseup` also clears `dragPosition` when clearing multi preview so the primary item does not stay offset alone for a frame.

**Drop delta stale (axis constraint / multi)**: after `mouseup`, `monitor.getDifferenceFromInitialOffset()` can be **0 or wrong**, so `moveMultipleItems` wrote unchanged coords — fine while selection still showed drag overlay, then **deselect** revealed real data. **Fix**: `lastCanvasDragCommitRef` stores the latest **hover** snapshot (`multi` map and `single` `{x,y}`); **drop** prefers that over recomputing from the monitor. Clear commit at the **start** of a new drag only (not after writing the first frame’s commit).

**Alt+drag duplicate + connections**: `duplicateNodesAtPositions` in `canvas-operations.ts` builds an `idMap` (original→clone). For each existing connection, if either endpoint was duplicated, appends a **new** connection (`generateConnectionId`) with endpoints remapped (`newFrom`/`newTo`); unduplicated endpoint unchanged (e.g. A→B duplicate A→C yields C→B). **Waypoints** cleared on copies; index fields cleared so routing can recompute. **idMap must be set when each clone is pushed** (`idMap.set(item.id, next.id)`), not by pairing `items[i]` with `additions[i]`: if any requested duplicate is skipped (no `original`/`pos`), indices shift and multi-item duplicates would wire edges to the wrong clones or skip remaps.

**Copy/paste + connections (same parity)**: `use-canvas-clipboard.ts` copies any connection that **touches** a copied node (not only when both endpoints are selected). Single-node and group copies store those edges on the clipboard. Paste remaps endpoints via `idMapping` (multi) or the new node id (single), skips unchanged pairs, clears waypoints/index fields—same behavior as Alt+duplicate.

**Multi Alt+drag duplicate (no clones / no edges)**: `selectedItemIds` can include **connection ids** (multi-select with edges). Those ids are not in `nodesById`, so `allDuplicatableNodes` was false → Alt+duplicate skipped; `commitMulti` also failed `ids.every(id => commitMulti[id])` because hover only writes positions for real nodes/zones. **Fix** in `use-canvas-drag-drop.ts`: `canvasDraggableIdsFromSelection` filters to nodes/zones; Alt+duplicate requires `allSelectedAreNodesForDuplicate` (only nodes, matching `duplicateNodesAtPositions`).

### 2026-03-18 – Per-Diagram ViewState (Zoom/Pan) Persistence
**ViewState stored per diagram level in JSON**: When navigating to a sub-diagram or via breadcrumbs, the view no longer auto-resizes. Instead, each diagram (root and each sub-diagram) stores `viewState?: { x, y, k }` in the JSON. If present, that zoom/position is restored when navigating to it; if absent, fit-to-view runs. **Persist**: Canvas transform changes are debounced (400ms) and saved to the current diagram's viewState. **Restore**: Effect on activeDiagramStack change reads target diagram's viewState and applies it or fits. Same logic in editor and standalone viewer. Modified: `types.ts` (DiagramViewState, DiagramData.viewState), `schemas.ts`, `flatten-on-import.ts`, `view-state-utils.ts` (new), `diagram-editor.tsx`, `viewer/page.tsx`.

### 2026-03-18 – Sub-diagram: Properties and Theme Application
**Property edits work in sub-diagrams**: Apply theme, move to back/front, align, connection updates, waypoints, auto-layout, and Properties Panel metadata now correctly target the **current diagram** (root or sub) instead of always the root. Uses `currentDiagramData` and `setCurrentDiagramData` throughout. Modified: `diagram-editor.tsx` (handleThemeApplyToSelected, handleMoveToBack/Front, handleAlignObjects, applyConnectionUpdates, applyAnimationToCurrentAndSelected, handleConnectionUpdate, handleConnectionWaypointAdd/Remove, handleAutoLayout, handleConnectionAnimationBulkApply, PropertiesPanel); `top-menu-bar.tsx`, `context-toolbar.tsx` (currentDiagramData/onCurrentDiagramDataUpdate for Rendering Order popover).

### 2026-03-18 – Sub-diagram Double-Click: Text vs Icon
**Double-click text = edit, double-click icon = navigate**: For nodes with a linked sub-diagram, double-clicking the **label/text** now enters inline text edit mode instead of navigating. Double-clicking the **icon/glow area** still navigates to the sub-diagram. Modified: `diagram-node.tsx` (handleLabelDoubleClick no longer triggers sub-diagram navigation; container onDoubleClick handles icon-area navigation).

### 2026-03-18 – Nested Diagrams (Sub-diagrams)
**Multiple diagrams nested within each other**: Icons/nodes can link to sub-diagrams. Double-click icon/glow navigates to sub-diagram; double-click text edits label; breadcrumb at top returns to parent. **Data**: `subDiagramId` on DiagramNodeData (optional); `subDiagrams?: Record<string, DiagramData>` on DiagramData. **Visual**: Icons with subDiagramId use amber/gold glow (`node-glow-subdiagram`) to distinguish from regular icons. **Context menu**: "Create sub-diagram" (creates blank sub, links node, navigates); "Remove sub-diagram link". **Import into sub-diagram**: When viewing a sub-diagram, File → Import into sub-diagram loads a diagram JSON (or Mermaid) and replaces the sub-diagram content with the imported diagram. Supports .json and .mmd/.mermaid. **ID sanitization**: Imported content is remapped (nodes, connections, groupings, layers, subDiagram keys) so IDs never collide with the existing diagram tree. New: `import-sanitize.ts`. **Nested sub-sub-diagrams**: Sub-subs are stored under the current sub (not at root). `sub-diagram-utils.ts` provides `getDiagramAtStack`, `updateDiagramAtStack`, `addSubDiagramAtStack`, `removeSubDiagramAtStack`. **Sub-sub glow fix**: Icon in sub-diagram linking to sub-sub now shows golden glow. `getHasLinkedSubDiagram` checks sub at current level or root (legacy migration). **Legacy migration**: Double-click on node with sub stored at root moves it to correct nesting level. **Viewer mode**: Sub-diagram navigation works in standalone viewer (`/viewer`). Double-click nodes with subDiagramId to drill in; breadcrumb at top to go back. Golden glow on linked icons. `getDiagramAtStack` falls back to root when sub not at current level (legacy). Modified: viewer/page.tsx, viewer-canvas.tsx, sub-diagram-utils.ts. **Backwards compatible**: Existing diagrams without these fields work unchanged. Modified: types.ts, schemas.ts, flatten-on-import.ts, globals.css, diagram-node.tsx, editor-canvas.tsx, context-menu.tsx, diagram-editor.tsx, top-menu-bar.tsx. New: diagram-breadcrumb.tsx, sub-diagram-utils.ts, plan.md.

### 2026-03-16 – Presentation/Viewer Mode: Connection Text Labels
**Connection text labels now show in presentation viewer**: ViewerCanvas (used by presentation player and standalone viewer) was missing `CanvasConnectionText`, which renders text labels on Bezier connections. Editor had it; viewer did not. Added `CanvasConnectionText` to ViewerCanvas inside the diagram content div, with same props as editor (width, height, diagramData, nodesById, zonesById, processedZones). Orthogonal connections render text inline in their own component. Modified: `viewer-canvas.tsx`.

### 2026-03-16 – Presentation Viewer: Connection Text Labels
**Connection text labels in presentation mode**: When in presentation viewer mode (or general viewer), connection text labels were not showing. **Cause**: ViewerCanvas rendered CanvasConnections but not CanvasConnectionText (which renders Bezier connection labels; orthogonal labels render inline). **Fix**: Added CanvasConnectionText to ViewerCanvas with the same props as editor (width, height, diagramData, nodesById, zonesById, processedZones). Modified: `viewer-canvas.tsx`.

### 2026-03-16 – Presentation Mode: Persist State Across Browser Refresh
**Presentation mode and settings preserved**: On refresh, presentation mode state is restored: (1) **presentationModeEnabled** in localStorage (`dw:presentationMode:enabled`); (2) **activeSlideId** per tab in IndexedDB/localStorage with decks and activeDeckId; (3) **Presentation editor panel UI** (toolbar floating, snapshots collapsed/floating, positions; **not** snapshot pane pixel height—removed 2026-03-25) in localStorage (`dw:presentation:panelSettings`). Modified: `diagram-editor.tsx` (restore/save presentationModeEnabled; hydrate/save activeSlideId), `presentation-storage.ts` (extend PerTabPresentationData with activeSlideId), `presentation-editor-panel.tsx` (restore/save panel settings).

### 2026-03-16 – Presentation Mode: Collapse Toolbar Shows Toolbar, Hides Thumbnails
**Collapse toolbar fix**: When the presentation mode toolbar is collapsed, it now correctly shows the toolbar (deck select, add snapshot, previous/next, etc.) and hides only the thumbnails. Previously the `{!toolbarCollapsed && (` wrapper hid both. **Fix**: Removed the conditional wrapper from the toolbar div so the toolbar is always visible; added `!toolbarCollapsed &&` to the docked thumbnails condition. Modified: `presentation-editor-panel.tsx`.

### 2026-03-16 – Presentation Mode Toolbar: Collapse Shows Toolbar, Hides Thumbnails
**Collapse toolbar fix**: When the presentation mode toolbar is collapsed, it now correctly shows the toolbar (deck select, Add Snapshot, Previous/Next, Play, etc.) and hides only the slide thumbnails. Previously, both toolbar and thumbnails were hidden. Modified: `presentation-editor-panel.tsx` (removed `{!toolbarCollapsed &&` wrapper from toolbar; added `!toolbarCollapsed &&` to thumbnails condition).

### 2026-03-16 – Presentation Mode: Collapse Toolbar Shows Toolbar, Hides Thumbnails
**Collapse toolbar fix**: When the presentation-mode toolbar is collapsed, it now correctly shows the toolbar (deck select, add snapshot, previous/next, etc.) and hides only the thumbnails. Previously, both toolbar and thumbnails were hidden when collapsed. Modified: `presentation-editor-panel.tsx` (removed `{!toolbarCollapsed && (` wrapper from toolbar; added `!toolbarCollapsed &&` to thumbnails condition).

### 2026-03-16 – Presentation Mode Toolbar: Collapse Shows Toolbar, Hides Thumbnails
**Collapse toolbar fix**: When the presentation editor panel toolbar is collapsed, it now shows the toolbar (deck select, Add Snapshot, Previous/Next, Play, etc.) and hides only the thumbnails. Previously, both toolbar and thumbnails were hidden when collapsed. **Implementation**: Removed `{!toolbarCollapsed && (` wrapper from toolbar div so toolbar always renders; added `!toolbarCollapsed &&` to docked thumbnails condition. Modified: `presentation-editor-panel.tsx`.

### 2026-03-16 – Presentation Mode Toolbar: Collapse Shows Toolbar, Hides Thumbnails
**Collapse toolbar behavior**: When the presentation mode toolbar is collapsed, it now correctly shows the toolbar (deck select, Add Snapshot, Previous/Next, Play, etc.) while hiding only the slide thumbnails. Previously, both toolbar and thumbnails were hidden when collapsed. Modified: `presentation-editor-panel.tsx` (removed `{!toolbarCollapsed && (` wrapper from toolbar; added `!toolbarCollapsed &&` to thumbnails condition).

### 2026-03-16 – Presentation Mode: Collapse Toolbar Shows Toolbar, Hides Thumbnails
**Collapse toolbar fix**: When the presentation mode toolbar is collapsed, it now shows the toolbar (deck select, add snapshot, previous/next, etc.) and hides only the thumbnails. Previously the `{!toolbarCollapsed && (` wrapper hid both toolbar and thumbnails. Fixed by removing the conditional around the toolbar and adding `!toolbarCollapsed &&` to the docked thumbnails condition only. Modified: `presentation-editor-panel.tsx`.

### 2026-03-16 – Presentation Playback: Auto Zoom + Theme-Aware Toolbar
**Auto zoom button**: Presentation player bottom toolbar now has an Auto zoom (Wand2) button that fits the current slide's diagram to the viewport, same as the edit canvas. Uses ViewerCanvas's fitToView via onFitToView. **Theme-aware toolbar**: Bottom toolbar (docked and floating) now uses theme classes (bg-card, text-foreground, border-border, bg-muted/50) so it reads correctly in light and dark mode. Previously white text on light mode when undocked was unreadable. Modified: `presentation-player.tsx` (Wand2 import, Auto zoom button, onFitToView to ViewerCanvas, theme classes throughout toolbar and reveal button).

### 2026-03-16 – Presentation Mode: Propagate Add/Delete to Later Slides
**Propagate changes across slides**: When editing a presentation on step X (of 6), you can now propagate item changes to all later slides. **Add to later slides**: Select a node or connection, then click the Copy icon (Add to later slides) in the context toolbar—the item is added to slides X+1 through the end. **Remove from later slides**: Select an item, click the SquareMinus icon (Remove from later slides)—the item is removed from slides X+1 through the end. Fixes the issue where deleting on step 3 caused the item to reappear on steps 4, 5, 6. Buttons appear only in presentation mode when there are later slides (not on the last slide). Modified: `diagram-editor.tsx` (handlePropagateAddToLaterSlides, handlePropagateDeleteToLaterSlides, hasLaterSlides), `top-menu-bar.tsx`, `context-toolbar.tsx` (Copy + SquareMinus buttons for node and edge toolbars).

### 2026-03-12 – Textbox Toolbar: Vertical Alignment + Wider Default
**Textbox toolbar** now includes top/middle/bottom vertical alignment icons (ArrowUp, Circle, ArrowDown). Click to set `textVerticalPosition` on the node; data persists via `onUpdate`. Alignment buttons show active state (bg-muted) for current position. **Default textbox size**: Width doubled when dropping a new textbox (120 → 240px) for a wider initial box. Modified: `textbox-rich-editor.tsx` (onVerticalAlignChange prop, applyVerticalAlign, alignment buttons), `diagram-node.tsx` (wire onVerticalAlignChange to onUpdate for textbox), `canvas-operations.ts` (isTextboxResource width 240).

### 2026-03-12 – Layer Animations (Show/Hide)
**Layer show/hide animations** when toggling layer visibility from the Layers panel. Objects animate in (fade + translateY) when showing a layer and out when hiding. **Toggle**: Options menu → Layer Animations (default: enabled). Disable to toggle layers instantly without animation. **Persistence**: `layerAnimationsEnabled` stored in localStorage (`dw:layerAnimations:enabled`). **Implementation**: `use-layer-animation.ts` hook provides `onLayerVisibilityWillChange`, `nodeAnimationStyles`, `connectionAnimationStyles`, `animatingDiagramData`; called before layer toggle; applies stagger + fade to nodes and connections. Modified: diagram-editor.tsx, top-menu-bar.tsx, editor-canvas.tsx, diagram-node.tsx, canvas-connections.tsx.

### 2026-03-11 – Orthogonal Waypoints
Waypoints can now be added to **orthogonal** (90°) connection lines, same as bezier. The path routes through each waypoint in order, with segments staying orthogonal. **Data**: Same `waypoints` array on DiagramConnectionData; persisted and works in viewer. **Implementation**: `computeOrthogonalRoute` accepts optional `waypoints`; chains segment routing (from→wp0, wp0→wp1, …, wpN→to) with direction inference at each waypoint. Waypoints are snapped to the 10px grid. **UI**: Add waypoint button, context toolbar, and Connection Context Modal show waypoint controls for both Curved and Orthogonal. Waypoint handles (drag circles) appear for orthogonal when selected. Modified: `orthogonal-routing.ts`, `othogonal-connection.tsx`, `canvas-connections.tsx`, `context-toolbar.tsx`, `connection-context-modal.tsx`.

### 2026-03-11 – ContextToolbar: React Hooks Error When Selecting Animated Connection
Clicking an animated connection caused React error #300 ("Rendered fewer hooks than expected"). **Cause**: ContextToolbar returned early for edge selection (line ~661) before `commitTagChange` and `commitInfoChange` useCallback hooks, violating Rules of Hooks. **Fix**: Moved both useCallbacks above the `if (!selectedItem)` and edge early returns so they run on every render. Modified: `context-toolbar.tsx`.

### 2026-03-11 – Waypoint Handles: Fix Lookup and Visibility
Waypoint circles were not showing after adding a waypoint. **Cause**: Editor looked up the selected connection with `${c.from}-${c.to}` === selectedItemId, but selectedItemId for edges uses connection id (or `from-to-index` for multi-conn), so the lookup failed. **Fix**: Use selectedItem when itemType === 'edge' and match connection by id (or `from-to-index`). Also raised waypoint handle z-index to 60 so circles appear above connection lines. Modified: `editor-canvas.tsx`, `connection-waypoint-handles.tsx`.

### 2026-03-11 – Connection Action Buttons: Right-Click + Tooltip Z-Index
When a connection is selected, the floating action buttons (Add waypoint, Delete connection, Toggle arrow) could add a waypoint on right-click if the cursor was over the Add waypoint button—right-click should open the context menu, not trigger actions. **Fix**: (1) `onMouseDown` handlers now ignore non-left-clicks (`if (e.button !== 0) return`). (2) `onContextMenu` added to each button so right-clicking a button still opens the connection context modal. (3) TooltipContent for these buttons gets `className="z-[9999]"` so hover labels ("Add waypoint", "Delete connection", "Toggle arrow") appear above other canvas elements. Modified: `canvas-connections.tsx`.

### 2026-03-11 – Buffered Text Inputs: Connection Text, Tag, Description
Connection text inputs (right-click modal, Connections popover) and small fields (Tag, Description) previously called `onConnectionUpdate`/`onItemUpdate` on every keystroke, causing lag when backspacing long strings. **Fix**: Buffer changes in local state and commit only on blur or Enter. Typing stays responsive; diagram updates once when entry finishes. Main text/textbox objects unchanged (they work). Modified: `connection-context-modal.tsx`, `context-toolbar.tsx`.

### 2026-03-11 – Selection Focus: Resize/Drag Target Selected Item (Not Hovered)
When a background object is selected with items on top, resize and drag must operate on the **selected** item, not the item under the cursor. **Fix**: Items that overlap the selected item and are rendered on top of it get `pointer-events: none`, so clicks pass through to the selected item. User can resize/drag the background even when the mouse is over the icon. Visual stacking order unchanged. To select the top item instead: click empty canvas to deselect, then click the top item. Modified: `diagram-node.tsx` (pointerEventsPassThrough prop), `editor-canvas.tsx` (pointerEventsPassThroughIds useMemo, overlap detection).

### 2026-03-10 – Orthogonal Connection Lines (Toggle with Bezier)
**Orthogonal routing** added as an alternative to bezier curves. Users can choose **Curved** (bezier, default) or **Orthogonal** (90° axis-aligned) per connection. **Toggle locations**: (1) Right-click connection → Connection Context Modal → Line type (Curved / Orthogonal); (2) Select connection → context toolbar Curved/Orthogonal buttons; (3) Select node → Connections popover → Line type per connection. New connections default to bezier. **Orthogonal** uses A* pathfinding on a 10px grid to avoid nodes/zones; falls back to L/Z routes if no path. **Animation**: OrthogonalConnection supports connection animations (shapes along path, animateMotion, GIF export) using getPointOnOrthogonalPath; same behavior as BezierConnection. **Viewer**: CanvasConnections renders orthogonal; animations work. **Components**: `orthogonal-routing.ts`, `othogonal-connection.tsx`. Modified: types.ts, schemas.ts, canvas-connections.tsx, connection-context-modal.tsx, canvas-connection-text.tsx, diagram-editor.tsx, context-toolbar.tsx (Connections popover + edge toolbar Curved/Orthogonal toggle; Add waypoint hidden for orthogonal), othogonal-connection.tsx (animation support, clampConnectionAnimation, renderAnimatedShape, getLoopedAnimationPathConfig), bezier-connection (export Positionable, renderAnimatedShape, getLoopedAnimationPathConfig, colorWithHalfOpacity).

### 2026-03-09 – Example JSON: Fixed Missing AWS Resource References
`public/examples/example1.json` had AWS node types that did not match the resource catalog (`resource-aws.json`). Updated types: `aws.general.internet-gateway` → `aws.networkingcontentdelivery.vpc_internet-gateway`; `aws.database.rds` → `aws.databases.rds`; `aws.storage.s3` → `aws.storage.simple-storage-service`; `aws.network.alb` → `aws.networkingcontentdelivery.elastic-load-balancing`; `aws.network.vpc` → `aws.networkingcontentdelivery.virtual-private-cloud`; `aws.network.direct-connect` → `aws.networkingcontentdelivery.direct-connect`; `aws.network.transit-gateway` → `aws.networkingcontentdelivery.transit-gateway`. `example2.json` verified; no changes needed (programming flowchart types match catalog).

### 2026-03-09 – GIF Export: Global Palette + Shadows Disabled
GIF export previously used **per-frame quantization** (256-colour palette per frame), causing shadows to look more pronounced and textbox colours to shift. **Fixes**: (1) Use a single **global palette** built from the first frame and reuse it for all frames—consistent colours across the animation. (2) **Disable shadows during GIF export**—add `gif-export-active` class to `document.documentElement` while capturing; globals.css overrides `--shape-shadow`, `--shape-shadow-drop`, `--shape-shadow-sm`, `--shape-shadow-preview` to `none` and forces `filter: none` on SVG elements. Shadows remain in editor/PNG; GIF output has no shadows for cleaner 256-colour result. Modified: `use-canvas-export.ts`, `globals.css`.

### 2026-03-09 – Connection Animation Performance (Implemented)
Performance optimizations for connection line animations in `bezier-connection.tsx`. **Changes**: (1) Lightweight `computePathLengthLight` (60 samples) for live animation—full `buildPathDistanceLookup` only when static shapes need positioning (GIF export or speed=0). (2) `pathDistanceLookup` cached via `useMemo` during GIF export (path geometry deps; `exportAnimationTimeSeconds` excluded). (3) Reduced samples: 90 for simple paths (no waypoints), 180 for waypoints. (4) `BezierConnection` wrapped in `React.memo` with `areBezierConnectionPropsEqual`. Works in editor and viewer. Plan: `docs/CONNECTION-ANIMATION-PERFORMANCE-PLAN.md`.

### 2026-03-09 – Right-Click: Normal Browser Behavior in Text Edit
When the user is in any text edit (input, textarea, contenteditable), right-click now shows the standard browser context menu (copy, paste, etc.) instead of diagram custom handlers. Uses existing `isEventFromEditableElement` from keyboard-utils. Applied to: right-click panning (use-canvas-interactions), canvas empty-area context menu, node context menu, zone context menu. When not in text edit, behavior unchanged (custom context menus, right-drag pan). Modified: use-canvas-interactions.ts, editor-canvas.tsx.

### 2026-03-09 – Viewer Mode: Rich Text (Textbox/Text) Styling
**Viewer** now correctly displays rich text formatting (bold, italic, underline, justify, font size, lists) for textbox and text nodes. **Cause**: `richLabel` was not preserved when converting hierarchical diagram format to flat, and `DiagramNodeItemSchema` lacked `richLabel`. **Fix**: Added `richLabel` to `DiagramNodeItemSchema`; added `richLabel` preservation in `convertFromNestedHierarchy` (orphan nodes + processNestedGroup) and `convertToNestedHierarchy` / `convertGroupToNested`; `measureNodeDims` now uses `getPlainTextFromRuns(richLabel)` when present for correct layout; `areDiagramNodePropsEqual` checks richLabel. Modified: `schemas.ts`, `nested-hierarchy.ts`, `canvas-constants.ts`, `diagram-node.tsx`.

### 2026-03-09 – Text Object Rich Controls (Same as Textbox)
The **text** object (`generic.text.text`) now uses the same WYSIWYG controls as the textbox: bold, italic, underline, justify (left/center/right/full), font size, bullet/numbered lists. Replaces plain input with `TextboxRichEditor` / `TextboxRichDisplay`. Supports `richLabel`; backward compatible with plain `label`. Auto-resize when `sizeMode === 'custom'`. Modified: `diagram-node.tsx` (handleLabelDoubleClick sets editRuns for text; text block uses TextboxRichEditor/Display).

### 2026-03-09 – Textbox Per-Line Formatting (Justify, Font Size)
Textbox now supports **per-line** text justification and font size. Each line can have different alignment (left/center/right/justify) and font size (12–24px). **Data model**: RichTextRun extended with `lineJustify`, `lineFontSize`, `lineFontWeight`, `lineFontFamily`. Node-level `textJustify`, `fontSize` remain as fallbacks. **rich-text.ts**: runsToHtml outputs line-based divs with inline styles; htmlToRuns parses block styles (text-align, font-size) into runs. **TextboxRichDisplay**: groups runs by lines, renders each line in a div with line-level style. **TextboxRichEditor**: justify buttons apply to current block via execCommand; font size buttons (12–24) apply to current block. Backward compatible: legacy runs without line-level format use node defaults. Modified: types.ts, schemas.ts, rich-text.ts, textbox-rich-display.tsx, textbox-rich-editor.tsx.

### 2026-03-09 – Textbox Auto-Resize During Edit (Grow/Shrink with Content)
When editing a textbox (double-click to edit), the textbox now auto-resizes vertically to fit content: **grows** when the user adds lines (e.g. Enter) and **shrinks** when they remove lines. Uses contentEditable `scrollHeight` + padding overhead (22px); height snapped to grid (min 40px). Only applies when `sizeMode === 'custom'`; manual resize is allowed and not overridden during active resize drag. MutationObserver + input events drive height checks via requestAnimationFrame. Modified: `textbox-rich-editor.tsx` (onHeightChange, measureAndReportHeight), `diagram-node.tsx` (wire onHeightChange to onUpdate).

### 2026-03-09 – Textbox WYSIWYG Toolbar Outside Textbox, No Layout Shift
When double-clicking a textbox to edit, the formatting toolbar (bold, italic, underline, lists) previously sat inside the textbox at the top, covering text and pushing it down. **Fix**: Toolbar now floats above the textbox (`position: absolute; bottom: 100%`), outside the content bounds. Text stays in the same position whether editing or viewing—no layout shift. Inner wrapper gets `overflow-visible` when editing so the floating toolbar is visible. Modified: `textbox-rich-editor.tsx`, `diagram-node.tsx`.

### 2026-03-09 – Hover: Glow Instead of Zoom for Unselected Shapes/Icons
Unselected shapes and icons on the canvas previously used `hover:scale-[1.02]` (zoom). Replaced with a subtle blue glow (`node-glow-hover`) so hovering shows a soft highlight instead of scaling. Applied to all non-line nodes when not selected, dragging, or locked. Modified: `diagram-node.tsx`, `globals.css` (added `.node-glow-hover:hover`).

### 2026-03-09 – Paste: New Unique Connection IDs for Pasted Connections
When copying multiple shapes with connections (e.g. 2 shapes connected) and pasting, the pasted connection previously retained the **original connection id**, so it was "linked" to the source. Selection, delete, or update by connectionId could target both original and pasted copies. **Fix**: In `use-canvas-clipboard.ts` paste handler, pasted connections now get a fresh unique id via `generateConnectionId()`. The old id is omitted and replaced so each pasted connection is an independent reference. Modified: `use-canvas-clipboard.ts`.

### 2026-03-05 – Tab Persistence: IndexedDB (Replaces localStorage)
**IndexedDB for tabs**: Tab persistence moved from localStorage to IndexedDB to avoid ~5–10MB quota limits. IndexedDB typically allows hundreds of MB. **Migration**: On first load, existing `dw:tabs` / `dw:activeTabId` in localStorage are migrated to IndexedDB and localStorage keys cleared. **Fallbacks**: When IndexedDB unavailable (old browsers), uses localStorage; on QuotaExceededError (IndexedDB or localStorage), retries slim save (no undo history) and toasts if both fail. **Debounced persist** (400ms). Loading state shown in tab bar until hydrated. Modified: `src/lib/tab-storage.ts` (new), `use-diagram-tabs.ts`, `diagram-editor.tsx`.

### 2026-03-05 – GIF/PNG Export: Dark Background in Dark Mode
**Export respects theme**: When exporting GIF (or PNG) in dark mode, the background defaults to dark (#0f172a). Export dialog adds a "Dark" background option; when opening for GIF in dark mode, Dark is preselected. Users can still choose White or Transparent. Modified: `use-canvas-export.ts` (backgroundColor 'dark' support + isDark fallback), `export-dialog.tsx` (Dark option, default when GIF + dark), `diagram-editor.tsx`, `editor-canvas.tsx` (types).

### 2026-03-05 – Draggable Tab Reordering
**Tab bar drag-and-drop**: Diagram tabs can be reordered by dragging. Each tab shows a grip icon when reordering is available (2+ tabs). Drag a tab onto another to insert before it. Uses native HTML5 drag-and-drop. Order persisted via localStorage (`dw:tabs`). Modified: `tab-bar.tsx` (onTabReorder, draggable, GripVertical), `use-diagram-tabs.ts` (reorderTabs), `diagram-editor.tsx` (pass reorderTabs).

### 2026-03-05 – Keyboard Shortcuts: Don't Intercept When Typing in Text Fields
**Standard text-editing shortcuts** (copy, paste, cut, cursor keys, select-all) now work normally when the user is typing in any text input. Editor shortcuts (diagram copy/paste, delete item, arrow-key move, etc.) are skipped when the keydown originates from an editable element: `<input>`, `<textarea>`, `[contenteditable="true"]`, or CodeMirror (`.cm-editor`). Added shared `isEventFromEditableElement(e)` in `src/lib/keyboard-utils.ts`. Updated: `editor-canvas.tsx` (copy/paste/delete), `diagram-editor.tsx` (all shortcuts + arrow keys), `viewer/page.tsx`. Applies to: labels, tags, descriptions, metadata, layer names, properties panel, UML class compartments, textbox rich editor, JSON panel, search modal—everywhere.

### 2026-03-05 – JSON Panel Resizable
**User-resizable JSON panel**: The JSON editor panel can be resized by dragging the left edge. Width is persisted to localStorage (`dw:jsonEditor:width`) and restored on load. Min width 280px, max 50% of viewport. Resize handle shows a subtle vertical indicator. Modified: `json-editor-panel.tsx` (resize handle, `onWidthChange`), `diagram-editor.tsx` (pass `jsonPanelWidth`/`setJsonPanelWidth`).

### 2026-03-05 – Dark / Light Mode Toggle
**System-wide theme toggle**: Dark and light mode now work across editor, viewer, menus, panels, and popups. **ThemeProvider** applies `dark` class to `<html>`, persisted to localStorage (`dw:theme`). Options: Light, Dark, System (follows OS `prefers-color-scheme`). **Toggle locations**: View menu (Light/Dark/System) in editor; theme button in viewer controls. **Colour-aware**: All UI uses semantic tokens (background, foreground, popover, muted, accent, border) – no dark-on-dark issues. **Updated panels**: text-styling, visual-styling, line-styling, layers, scratch-pad, uml-class-text-styling, properties, metadata-popup, tutorial-overlay, resource-browser, theme-selectors, shape-tag. Diagram node colours (user data) unchanged. Plan: `docs/DARK-LIGHT-MODE-PLAN.md`. Modified: `theme-provider.tsx`, `theme-toggle.tsx`, `layout.tsx`, `top-menu-bar.tsx`, `viewer-controls.tsx`, multiple panel/popup components.

### 2026-03-05 – Tab Close/Save: Unsaved Changes Prompt and Filename as Tab Name
**Close tab with unsaved changes**: When closing a tab that has unsaved changes, a dialog offers **Save**, **Don't Save**, and **Cancel**. Save triggers the save-to-file flow, then closes the tab on success. **Tab name from filename**: When saving to file (File System Access API or download), the tab name updates to the chosen filename without extension. When loading a file, the active tab name updates to the loaded filename without extension. Modified: `use-diagram-tabs.ts` (added `getTab`, `updateTab`, `markTabAsSaved(tabId)`), `diagram-editor.tsx` (`handleSave(tabId?)`, `handleCloseTabSave`, `handleFileChange` sets tab name, close dialog buttons).

### 2026-03-05 – GIF Export: Full Save Dialog (Same as Load/Save)
**Save file picker shown first**: GIF export now shows the full native save file/folder dialog at the start of the export flow, matching diagram Save and PNG export. Previously `showSaveFilePicker()` was called after 3–30 seconds of frame recording; by then the user gesture had expired, so the dialog could fail or fall back to download. **Fix**: Call `showSaveFilePicker` immediately when the user clicks Export (while the gesture is active), store the handle, then record frames and write to that handle. User cancelling the dialog aborts export. Modified: `use-canvas-export.ts`.

### 2026-03-05 – Color Picker: Shared Recent Colours and Deferred Commit
**Shared recent colours**: All colour pickers now share the same saved/recent colour palette. Added `RecentColorsContext` and `RecentColorsProvider` in root layout so every ColorPicker reads/writes the same recent colours from a single localStorage-backed store (`dw:recent-colors`). **Deferred commit**: The colour picker no longer saves/updates parent state while the user is browsing the native colour wheel—updates are only applied on commit (native input `onBlur`/`onMouseUp`, alpha Slider `onValueCommit`). Prevents slow UI and excessive undo/redo history during colour selection. Modified: `use-recent-colors.ts` → `use-recent-colors.tsx` (context + provider), `color-picker.tsx`, `layout.tsx`.

### 2026-03-05 – Connector Line Animation Defaults
**Defaults updated**: anim size 2 (was 1), shape-size spacing 2 (was 1). Default animation colour when not set: 50% transparent of the line colour (via `colorWithHalfOpacity()`). Modified: `connection-animation.ts`, `bezier-connection.tsx`.

### 2026-03-05 – Multiple Same-Direction Connections (A > B and A > B)
**Multiple connections** between the same two nodes (A→B and A→B) are now supported. Previously only A→B and B→A (bidirectional) were allowed. **Data model**: Added optional `id` to `DiagramConnectionData`; new connections get unique ids via `generateConnectionId()`; `ensureConnectionIds()` assigns ids where missing. **Backward compatibility with legacy JSON**: `ensureConnectionIds` runs in: `setDiagramData` (covers undo/redo, JSON edit, paste); `createNewTab` and tab restore from localStorage (`use-diagram-tabs`); `parseUnknownJsonToDiagramData` and Mermaid imports; `viewer-utils` on load. Existing diagrams without connection ids get ids assigned on load. **Selection/update/delete**: All handlers accept optional `connectionId` to target a specific connection. **JSON**: Connection `id` is persisted; load/save works. Modified: `types.ts`, `schemas.ts`, `connection-order-utils.ts`, `diagram-editor.tsx`, `use-diagram-tabs.ts`, `canvas-connections.tsx`, `context-toolbar.tsx`, `connection-context-modal.tsx`, `connection-waypoint-handles.tsx`, `viewer-utils.ts`, `properties-panel.tsx`, `component-sidebar.tsx`, `top-menu-bar.tsx`, `editor-canvas.tsx`.

### 2026-03-05 – Animation Connector: Selection-Only Behaviour (Select=Show, Deselect=Stop)
When **animation toggle-on-click** (Ctrl+Alt+C) is enabled: **Click canvas** → all animations stop. **Click item** → enable animations for that item's chain (connections that have animation defined). **Click canvas** → stop. No toggle—purely selection-driven. On deselect (canvas click or empty batch select), `animationDisabledSources` is cleared. On item select, that node's chain is enabled. Editor and viewer both updated. Modified: `diagram-editor.tsx`, `editor-canvas.tsx`, `viewer-canvas.tsx`, `viewer/page.tsx`.

### 2026-03-04 – Viewer "Show Animations for Selected Only" Uses Chain (Same as Editor)
In the viewer, when "Show animations for selected only" is on and a node is selected, animations now show the full downstream chain (B→C, C→D when selecting B), matching the editor. Added `animationFilterSourceIds` to CanvasConnections; viewer page computes chain via `getDownstreamAnimationChainNodes`. Modified: `canvas-connections.tsx`, `viewer/page.tsx`, `viewer-canvas.tsx`.

### 2026-03-04 – No Animations When Nothing Selected (Viewer)
In the viewer with "Show animations for selected only", animations are hidden when no item is selected (e.g. after clicking canvas). Animations show only when a node is selected (chain). Removed lastAnimationFilterNodeId. Modified: `viewer/page.tsx`.

### 2026-03-04 – Animation Click-Toggle Follows Downstream Chain
When animation toggle-on-click is enabled, clicking a node now enables/disables animations for the **entire downstream chain** (not just the direct outbound connection). E.g. A→B→C→D: clicking B toggles B→C and C→D, but not A→B. Chain follows only connections that have animation defined. Added `getDownstreamAnimationChainNodes()` in `connection-animation.ts`; updated `handleNodeClick` in `editor-canvas.tsx` and `viewer-canvas.tsx`.

### 2026-03-04 – Connection Icons Aligned Along Bezier Curve
When a connection is selected, the three action icons (arrow toggle, add waypoint, remove connection) could misalign on curved bezier lines because they used center ± horizontal offset. **Fix**: Icons are now positioned at fixed t-values along the curve: **Remove** at t=0.1 (start), **Add waypoint** at t=0.5 (center), **Arrow toggle** at t=0.9 (destination). Uses `getPointOnConnectionPath` when waypoints exist so icons follow multi-segment paths. Modified: `canvas-connections.tsx`.

### 2026-03-04 – Context Menu Text/Visual Styling Panel Shows on First Click
Right-click on a selected object → choose Text Styling or Visual Styling from the context menu: the modal did not show until a second click on the object. **Cause**: Clicking the context menu item bubbled to the canvas container, triggering `handleCanvasClick` which cleared selection (`onItemSelect(null)`); the ContextToolbar unmounted (it only renders when `selectedItem` exists), so the panel never appeared. **Fix**: Add `context-menu` class to the ContextMenu root div; in `use-canvas-selection` `handleCanvasClick`, skip clearing selection when the click target is inside `.context-menu`. Modified: `context-menu.tsx`, `use-canvas-selection.ts`.

### 2026-03-02 – Merged animated-connection into main
Merged `animated-connection` branch into `main`. No conflicts. Features now in main: **Animated connection markers** (per-connection shape/speed/size/spacing via right-click context modal, bulk apply outbound/inbound), **GIF export** (File → Export, PNG or GIF with duration/FPS), **multiple connection selection fixes**. New: `connection-animation-controls.tsx`, `connection-animation.ts`, `gifenc` package. See `docs/MERGE-ANIMATED-CONNECTION-TO-MAIN.md`.

## DiagramWeaver - Latest Features and Functions (Updated 2026-02-26)

### 2026-02-26 – Node Labels Always On Top of Connectors (Icon Nodes Only)
When using **Order-Aware Connection Lines** (Options → Lines Behind Nodes off), connector lines could render over icon/node labels (e.g. "EC2 Auto Scaling"). **Fix**: In interleaved mode, **icon and text nodes** get elevated z-index (NODE_LAYER_BASE=100) so their labels stay on top of connectors. **Shape nodes** keep original z-ordering (2*i+1) so connector lines can still pass in front of shapes. Uses `isShapeNodeType` to distinguish. Modified: `editor-canvas.tsx`, `viewer-canvas.tsx`.

### 2026-02-26 – Multi-Select Copy/Paste Fix
When selecting multiple canvas items and copying (Cmd/Ctrl+C or Edit → Copy), only one item was pasted. **Cause**: Both `selectedItemId` (primary) and `selectedItemIds` are set during multi-select; the code checked `selectedItemId` first and called `handleCopy(selectedItemId)` for single-item copy. **Fix**: Prioritize multi-selection: when `selectedItemIds.size > 1`, call `handleCopy()` (no arg) to copy all selected items, connections, and groupings. Single-item path used only when one item selected. Modified: `editor-canvas.tsx` (copyHandler and keyboard handler).

### 2026-02-25 – Non-Scaling Stroke and ViewBox for All SVG Shapes
Applied the rounded-rectangle pattern to all SVG shapes: **1) Borders**: `vector-effect="non-scaling-stroke"` so stroke stays constant pixel width regardless of shape size. **2) ViewBox fit**: Polygon shapes pass `strokeWidth/2` as strokePadding to `getPolygonViewBoxAndPoints()` so the viewBox includes stroke overflow and the shape fills its container. Shapes updated: kite, triangle, hexagon, star, pentagon, octagon, trapezoid, parallelogram, arrowhead, chevron (polygon/path); circle, cloud, jigsaw (path). Modified: all shape components in `shapes/`.

### 2026-02-25 – Shape Container Alignment Fix (Rounded Rect, Kite, Triangle, etc.)
Polygon shapes (kite, triangle, hexagon, star, octagon, pentagon, parallelogram, trapezoid, chevron, arrowhead) had oversized viewBoxes, causing the visible shape to appear smaller than its layout container and misalign with rectangles. **Fix**: Added `getPolygonViewBoxAndPoints()` in `shape-utils.ts` to compute a tight viewBox from the polygon’s bounding box and transform points to that space, so the shape fills the container. Connection bounds updated for stretch scaling (`stretchScaling: true`) in `shape-connection-bounds.ts`; kite’s `getKiteConnectionPoint` now uses the tight viewBox. **Rounded-rectangle fix**: viewBox expanded to include stroke overflow (`vbX=-half`, `vbY=-half`, `vbW=VIEWBOX_W+strokeWidth`, `vbH=VIEWBOX_H+strokeWidth`); rect drawn at (0,0) full size so the stroke's outer edge maps exactly to the container edge—eliminates visible gap between shape and selection/container box for correct alignment. Modified: `shape-utils.ts`, `shape-connection-bounds.ts`, `rounded-rectangle.tsx`, polygon shapes.

### 2026-02-24 – Connection Lines Layering Toggle
**Options → Lines Behind Nodes / Order-Aware Connection Lines** toggle controls how connector lines render relative to nodes. **Lines Behind Nodes** (default): All connections render first (z-index 0), nodes on top; lines never overlap rectangles. **Order-Aware Connection Lines**: Interleaved z-ordering per connection-order-utils (connections can pass in front of/behind nodes based on endpoint positions). Preference persisted to localStorage (`dw:connectionsBehindNodes:enabled`). Viewer reads same localStorage. Modified: diagram-editor.tsx, top-menu-bar.tsx, editor-canvas.tsx, viewer-canvas.tsx.

### 2026-02-24 – Rounded-Rectangle Corner Radius Modifier
Rounded-rectangle now has a draggable corner-radius handle (green icon at bottom-right, like resize): drag left/right to adjust curve from straight (0) to full round (1). Value stored in JSON as `cornerRadius` (0–1), works in editor and viewer. Handle: `corner-radius-handle.tsx`; persisted via schema; RoundedRectangleShape uses it for rx/ry. Modified: `diagram-node.tsx`, `rounded-rectangle.tsx`, `corner-radius-handle.tsx`, `schemas.ts`, `types.ts`, `shape-preview.tsx`, `globals.css`.

### 2026-02-24 – Rounded-Rectangle SVG Conversion
Rounded-rectangle was using ShapeWrapper (div with CSS border-radius), which caused background bleeding at edges and gradient/complex border styles reverting corners to square (border-image doesn't work with border-radius). Converted to SvgShapeBase with SVG `<rect rx/ry>` like circle/kite—proper gradient fills, gradient borders, dotted borders, and crisp rounded corners. **Uniform border**: Uses `vector-effect="non-scaling-stroke"` so stroke stays same pixel width irrespective of shape size (thin, tall, wide). **Uniform corners**: Corner radius (rx/ry) computed so corners render at fixed ~8px regardless of shape dimensions—avoids squashed/elongated curves on thin shapes. Modified: `rounded-rectangle.tsx`.

### 2026-02-24 – Hexagon Text Padding (like Kite)
Hexagon labels now use the same left/right padding as kite: text container constrained to max-w-[70%] with mx-auto so text wraps better within the angled hexagon shape. Modified: `shape-text.tsx`.

### 2026-02-24 – Proportional Bottom-Right Resize
The bottom-right corner resize handle now maintains aspect ratio: both width and height scale together proportionally. Uses the larger of the two dimension scales so the shape fills the dragged area. Multi-select resize from corner is also proportional. Width, height, and sizeMode: 'custom' are already persisted in diagram JSON (save/load) and used by the viewer via measureNodeDims. Modified: `diagram-node.tsx`.

### 2026-02-24 – Shape Backing Box No Blank Areas
Polygon shapes (trapezoid, hexagon, parallelogram, etc.) were letterboxed when resized to a different aspect ratio than their viewBox, creating blank areas above/below the shape. **Cause**: SVG default preserveAspectRatio "xMidYMid meet" scales uniformly and centers, leaving gaps. **Fix**: SvgShapeBase defaults to preserveAspectRatio="none" when not specified, so shapes stretch to fill their container. Circle and kite keep explicit "xMidYMid meet" for their fixed proportions. Modified: `svg-shape-base.tsx`.

### 2026-02-24 – Top and Left Resize Handles
Shapes can now be resized from top and left edges in addition to right, bottom, and bottom-right. **Top**: Drag upward to expand (bottom edge stays fixed), downward to shrink. **Left**: Drag left to expand (right edge stays fixed), right to shrink. Connect (+ connector) handle moved from top-center to top-right to accommodate top resize. Multi-select resize from top/left anchors at bottom/right respectively. Modified: `resize-handles.tsx`, `connect-handle.tsx`, `diagram-node.tsx`, `canvas-operations.ts`, `editor-canvas.tsx`, `globals.css`.

### 2026-02-24 – Circle Shape Square Border Fix
Circle shape was rendered via `ShapeWrapper` (CSS div with background/border-radius), which produced a visible rectangular bounding box. Converted to `SvgShapeBase` with an SVG `<circle>` element, matching kite and other polygon shapes. Circle now renders with no visible square border; supports gradients, border styles, and shadow. Modified: `src/components/diagram/shapes/circle.tsx`.

### 2026-02-24 – Circle Connection Points on Shape Edge
Connections to the circle were attaching to the rectangular bounding box instead of the circular boundary. Added circle to `getShapeEdgeBounds` in `shape-connection-bounds.ts` so connector entry/exit points land on the actual circle edge (top/bottom/left/right centers at viewBox coords 1,59,1,59). Matches behavior of kite, hexagon, octagon, etc. Modified: `src/lib/shape-connection-bounds.ts`.

### 2026-02-24 – Gradient Direction (Border vs Background)
Border and background now support separate gradient directions: `gradientAngle` (background) and `borderGradientAngle` (border). When unset, `borderGradientAngle` falls back to `gradientAngle`. Visual Styling panel: border direction picker is on the same line as Width for gradient borders; "Colors" headings removed from Border and Background for a more compact layout.

### 2026-02-24 – Mermaid Diagram Import
Import Mermaid flowchart (`.mmd`, `.mermaid`), class diagram, and sequence diagram files into DiagramWeaver. Converts nodes to shapes and text, edges to connectors with optional labels.

**How to import**: File → Load, File → Import Mermaid, or File → Examples → Mermaid Simple / Mermaid Class Diagram / Mermaid Sequence Diagram / Mermaid Complex.

**Mermaid layout config** (from YAML frontmatter): Matches Mermaid standard. Uses `@dagrejs/dagre` for default/dagre layout, `elkjs` when `layout: elk`. Supports `nodeSpacing`, `rankSpacing` (default 50), and `elk.nodePlacementStrategy`, `elk.mergeEdges`, `elk.cycleBreakingStrategy` for ELK.

**Supported Mermaid flowchart elements**:
- **Header**: `flowchart TD|LR|BT|RL` or `graph TD|LR|BT|RL` (TB maps to TD)
- **Node shapes** (mapped to `generic.object.*`): `[rect]`, `(rounded)`, `((circle))`, `{diamond}`→kite, `[[subroutine]]`, `{{hexagon}}`, `[/parallelogram/]`, `[\parallelogram\]`, `[/trapezoid\]`, `[\trapezoid/]`, `[(cylinder)]`→rounded-rectangle, `([stadium])`→rounded-rectangle
- **Connectors**: `-->`, `---`, `-.->`, `==>`, with optional labels `|label|` or `-- label --`
- **Directions**: TD (top-down), LR (left-right), BT (bottom-top), RL (right-left)

**Mermaid sequence diagram** (`sequenceDiagram`):
- Participants rendered as rounded-rectangles in a horizontal row (left-to-right definition order)
- Inter-participant messages use `generic.object.line` with startPos/endPos, arrow at target
- Self-loops (A->>A) use `generic.object.loop` shape (curved path with optional arrow)
- Lifelines: vertical dashed connections from top participant to bottom participant
- Message syntax: `A->>B: label` (solid arrow), `A-->>B: label` (dashed)
- Participant syntax: `participant Id` or `participant Id as Display Label`
- Example: File → Examples → Mermaid Sequence Diagram, or import `sequence-diagram.mmd`

**Mermaid class diagram** (`classDiagram`):
- Classes rendered as UML-style boxes with three compartments: name (top), attributes (middle), methods (bottom), separated by horizontal divider lines
- Node type: `generic.object.uml-class` with `umlClass: { name, attributes[], methods[] }`
- **UML Class in sidebar**: Draggable from Generic → Object section. Icon: `uml-class.png` (rect with two horizontal dividers). Added to `resource-generic.json`; `resource-icon.tsx` has uml-class SVG fallback; `shape-preview.tsx` has Visual Styling preview. **Tag support**: UML class shape supports tag/tagPosition (like rectangle); persisted in JSON, shown in editor and viewer via ShapeTag. **Right-click → Edit UML Class**: Opens modal for full edit (name, add/remove attributes, add/remove methods). **Inline editing**: Double-click name, attributes, or methods section to edit; Enter to submit (Ctrl+Enter for attributes/methods); Escape to cancel. **Dynamic sizing**: Box height grows/shrinks with attribute and method count (1 line per attribute/method). New UML class nodes get default placeholders: name "name", attributes ["attributes"], methods ["methods"]. Key: `uml-class-editor-modal.tsx`, `uml-utils.ts`
- Inheritance: `Parent <|-- Child` → connection from child to parent with arrow at parent
- Colon syntax: `ClassName : +int age`, `ClassName: +methodName()`
- Block syntax: `class Duck{ +String beakColor +swim() +quack() }`
- Visibility: `+` public, `-` private, `#` protected, `~` package
- Example: File → Examples → Mermaid Class Diagram, or import `class-diagram.mmd`

**Examples**: `public/examples/simple.mmd`, `complex.mmd`, `graphTD.mmd`, `class-diagram.mmd`, `sequence-diagram.mmd`

**Key files**:
- `src/lib/mermaid-parser.ts` – Parse flowchart, class, sequence syntax; YAML frontmatter config
- `src/lib/mermaid-layout.ts` – Dagre/ELK layout (Mermaid-compatible)
- `src/lib/mermaid-to-diagram.ts` – Convert to DiagramData (shapes, connections)
- `src/app/api/validate-mermaid/route.ts` – API for validating .mmd files (flowchart parser)
- `scripts/validate-mermaid.mjs` – Standalone Node validation script (flowchart)

**Validation**: Full error output logs to browser console (`[Mermaid Import]` / `[Mermaid Load]`). Use `npm run validate-mermaid` or `GET /api/validate-mermaid` (when dev server running). Note: API/script validate flowcharts only; class and sequence are parsed on import.

**Import styling**: Connectors with labels get auto-colored: Yes/Low=green (#22c55e), No/Critical=red (#ef4444), High=orange (#f97316), Medium/Medium-Low=amber (#f59e0b). Decision nodes (diamond `{...}`) use square dimensions same size as process nodes. Shape themes (inline in mermaid-to-diagram, no theme-manager dep): decision/kite and other shapes (circle, hexagon, parallelogram, trapezoid, rounded, etc.) use Forest Green (#16a34a border, #f0fdf4 bg); standard box (`rect`/`default`) uses Ocean Blue (#3b82f6 border, #eff6ff bg); last nodes in chain use Royal Purple (#9333ea). Sequence diagram participants use alternating themes. Applies to both File→Import Mermaid and File→Load (.mmd).

**Grid alignment for straight connectors**: Mermaid import dimensions snap to GRID_SNAP (20px) and are forced even for proper centering. Positions are computed by snapping layout center points to the grid, then deriving top-left from snapped center minus half-dimensions, so vertically stacked nodes align and connectors stay straight.

**Export to Mermaid**: Planned as a separate phase.

**Full documentation**: `docs/MERMAID-IMPORT.md`

### 2026-02-20 – Rules Engine
User-definable validation rules for diagram content. **Edit → Rules** opens the Rules Editor dialog. Rules check nodes on the diagram against user-defined criteria; pass = green tick, fail = red cross.

**Menu**: Edit → Rules (opens Rules Editor dialog).

**Rule operators** (dropdown):
- Must have at least 1 – diagram must contain ≥1 node of the given type
- Must have at least N – diagram must contain ≥N nodes of the type (N from count input)
- Must have more than N – diagram must contain >N nodes of the type
- Must have exactly N – diagram must contain exactly N nodes of the type
- Must have all types – diagram must contain at least 1 of each type listed (one per line)

**Type matching**:
- Exact – select from searchable combobox (all resource types + Lucide icons + emojis; filters to 60 results)
- Pattern – substring match when no `*` (e.g. `firewall` matches `aws.securityidentity.firewall-manager`); use `*` wildcard for `aws.database.*`, `*.database.*`

**Example rules**:
- Must have web, database, firewall → use "Must have all types" with `aws.compute.ec2-instance`, `aws.database.rds`, `generic.object.cloud` (or equivalents)
- Must have a `<type>` object → "Must have at least 1" + select type
- Must have more than X of `<type>` → "Must have more than N" + type + count

**Export/Import**: Export uses `showSaveFilePicker()` (Chrome/Edge) for native Save As dialog; fallback blob download. Import uses file input for standard Open dialog. Rules file format: `{ version: "1.0", rules: [...] }`.

**JSON rules file format**:
```json
{ "version": "1.0", "name": "Diagram Rules", "rules": [{ "id": "...", "name": "...", "operator": "must_have", "typeValue": "aws.database.rds", "typeMatch": "exact" }] }
```

**Optional**: Rules are optional; diagrams work without any rules defined.

**Evaluation**: Rules are checked against `diagramData.nodes` (flat node list; zones excluded). Evaluation runs when the Rules Editor is open and diagramData changes.

**Persistence**: Rules saved to localStorage (`dw:rules`) and survive browser refresh. Export/Import for backup or sharing.

**UI**: Modal scrolls vertically (`overflow-y-auto`); new rules added at top of list; Count (N) uses text input (no spinner arrows, allows empty/backspace, no `01` glitch); memoized evaluation and searchable type combobox for performance.

**Key files**:
- `src/lib/rules-types.ts` – DiagramRule, RulesFile, RuleResult types
- `src/lib/rules-engine.ts` – evaluateRule, evaluateRules, typeMatchesPattern, getDiagramNodes
- `src/components/editor/rules-editor.tsx` – Rules Editor dialog UI
- `src/hooks/use-resource-types.ts` – loads resource types for type dropdown (providers + icons + emojis)
- **Modified**: top-menu-bar.tsx (Edit → Rules menu item), diagram-editor.tsx (rules, rulesEditorOpen state)

### 2026-02-20 – Metadata for Diagram Items
Added optional `metaData?: Record<string, string>` (key/value pairs) to nodes, connections, zones, and groupings. Users can add custom properties like "IP Address: 192.168.1.1" to any item.

**Properties Panel** (right side, collapsible): Shows selected item name, type, and metadata. Add/edit/remove metadata via UI. Collapsed state persisted to localStorage (`dw:propertiesPanel:collapsed`). **Edit → Toggle Properties** shows/hides the panel; visibility persisted to localStorage (`dw:propertiesPanel:visible`). **Viewer**: Properties panel toggle (PanelRight) first in **top-left** viewer controls (semi-transparent toolbar); **hidden by default**; read-only metadata when shown.

**Key suggestions for consistency**: When adding a new metadata property, the Key input suggests previously used keys from the diagram (nodes, connections, zones, groupings) via native HTML datalist. Encourages consistent property names across items.

**Metadata popup under selected item**: When an item (node or connection) with metadata is selected, a compact popup appears below it showing key/value pairs. Popup is window-aware (flips above if near bottom, shifts horizontally to stay in viewport). **Options → Enable Properties** toggles these popups (default: shown). Persisted to `dw:metadataPopups:enabled`.

**Properties panel default state**: Editor right panel starts **collapsed** (narrow strip) unless restored from `dw:propertiesPanel:collapsed`. **Viewer**: panel **hidden** until toggled (not the same localStorage keys as editor for visibility).

**Hydration fix**: Panel/collapse state no longer read from localStorage during initial render—fixed defaults used for SSR, then restored from localStorage in useEffect to avoid server/client mismatch.

**Metadata popup size reactive**: Popup shows partial info (~2–3 entries) by default; hover to expand and reveal all entries. Uses transition for max-height; "⋯" hint when more content is available.

**JSON storage**: `metaData` is stored in diagram JSON. Each node/connection/zone/grouping object can include `metaData: { "Key": "value", ... }`. Exported and imported diagrams preserve all metadata.

Types: `DiagramNodeData`, `DiagramConnectionData`, `DiagramZoneData`, `DiagramGroupingData`; schemas updated. New: `properties-panel.tsx`; modified: `types.ts`, `schemas.ts`, `diagram-editor.tsx`. `handleConnectionUpdate` extended to accept `metaData` in updates.

## DiagramWeaver - Latest Features and Functions (Updated 2026-02-13)

### 2026-02-13 – Connector Entry Points for Polygon Shapes
Connector lines were appearing to emerge from within polygon shapes (octagon, hexagon, pentagon, etc.) instead of at their visible boundary. **Cause**: `getConnectionPoint` used the rectangular bounding box for all shapes; polygons don't fill their viewBox and have angled edges. **Fix**: Added `shape-connection-bounds.ts` with viewBox-based edge geometry for octagon, hexagon, pentagon, kite, trapezoid, parallelogram, chevron, arrowhead, triangle, star. `getConnectionPoint` now uses `getShapeEdgeBounds` + `shapeEdgeToPoint` for object nodes so connectors land on the actual shape edge. Also extended `measureNodeDims` in canvas-constants to include octagon and other polygon types as shape nodes. Modified: bezier-connection.tsx, canvas-constants.ts. Added: shape-connection-bounds.ts.

### 2026-02-13 – Octagon Bottom Connector / Polygon Shape Dimensions
Octagon connector entering from bottom went to the middle of the shape, especially when resized. **Cause**: `isFromShape`/`isToShape` in canvas-connections, bezier-connection, and canvas-arrow-toggles only included a subset of polygon types (square, circle, triangle, star, cloud, etc.) and excluded octagon, hexagon, pentagon, parallelogram, trapezoid, kite, arrowhead, jigsaw, chevron. For those types, wrong dimensions were passed (e.g. calculated height instead of node.width/node.height), breaking the shape-edge calculation. **Fix**: Replaced the long explicit shape-type checks with `isShapeNodeType(type)` from utils (single source of truth). Now octagon and all polygon shapes receive their actual width/height for connection-point calculations, so connectors land correctly on resized shapes. Modified: canvas-connections.tsx, bezier-connection.tsx, canvas-arrow-toggles.tsx.

### 2026-02-12 – Connection Line Right-Click Context Modal
Right-clicking a selected connection line opens a context modal (matches Visual Styling panel UX). Shows: Text, Color, Text Position (slider), Line Thickness, Arrow toggle, Shadow (depth effect), Disconnect, and Add/Remove waypoints. Context-aware for the specific connection. **Behavior**: Full-screen overlay with pointer-events: auto (like Visual Styling), draggable via header (react-draggable, handle=".connection-modal-drag-handle"), live connection data from diagramData so form inputs stay in sync. Click outside or Escape to close. **Components**: ConnectionContextModal (connection-context-modal.tsx), BezierConnection onContextMenu, CanvasConnections onConnectionContextMenu prop. Modified: bezier-connection.tsx, canvas-connections.tsx, editor-canvas.tsx, diagram-editor.tsx.

### 2026-02-12 – Node/Shape and Connection Line Clickability Fix
Some nodes/shapes were unselectable because connection SVGs (full canvas size) were layered above nodes and captured clicks. **Fix**: (1) Added pointer-events-none to the connection SVG in canvas-connections.tsx so the transparent background passes clicks through to nodes below. (2) In BezierConnection, wrapped the path in a `<g style={{ pointerEvents: 'auto' }}>` with onClick so the connection line opts back into hit-testing and remains clickable—children of pointer-events-none can receive events when they set pointer-events: auto. Note: pointer-events-stroke is not a valid Tailwind class; use inline style for SVG pointer-events. Modified: canvas-connections.tsx, bezier-connection.tsx.

### 2026-02-12 – ContextToolbar Hooks Order Fix
Fixed React "change in the order of Hooks" error in ContextToolbar: when an edge was selected, the component returned early and skipped hooks (flushLabelChange, handleLabelChange, colorTimeoutRef, etc.), causing hook order to differ between edge and node selection. Moved all hooks (flushLabelChange, handleLabelChange, handleLabelBlur, handleLabelKeyDown, colorTimeoutRef, connectionColorTimeoutRef, handleColorChange, handleColorChangeImmediate, cleanup useEffect) above the early returns so they run unconditionally. Added selectedItem.itemType !== 'edge' guards inside callbacks and type assertions for selectedItem.label (edge has no label). Modified: context-toolbar.tsx.

### 2026-02-12 – Bezier Connection Waypoints
Optional waypoints for routing connections around obstacles:
- **Types**: `waypoints?: Array<{ x: number; y: number; id?: string }>` on DiagramConnectionData
- **Path**: Multi-segment smooth cubic Bezier via Catmull-Rom style tangents (C1 continuity at each waypoint)
- **Add**: When connection selected, click + button in context toolbar
- **Remove**: Waypoints popover lists each waypoint with X to remove
- **Drag**: Waypoint handles (circles) appear when connection selected; drag to reposition
- **Components**: BezierConnection uses calculateMultiPointBezierPath when waypoints exist; BezierConnectionText uses getPointOnConnectionPath for text positioning; ConnectionWaypointHandles for drag UI
- **Edge inference**: When waypoints exist, `determineConnectionEdges` uses first waypoint vs from-node center for fromEdge and last waypoint vs to-node center for toEdge; connector exits/enters the edge closest to the waypoint (e.g. waypoint below node → bottom edge). No change to existing logic when no waypoints.

### 2026-02-12 – Connection Alignment and Node Size (Half/Quarter)
Connection alignment and node sizing now respect `nodeSize` (normal/half/quarter) throughout editor and viewer:
- **BezierConnection**: Replaced hardcoded `ICON_SIZE = 80` with `getNodeSizeDimensions(nodeSize).container` (40 for half, 20 for quarter).
- **canvas-connections.tsx**: Uses `getNodeSizeDimensions` for icon heights and passes icon width/offset to `getOptimalConnectionPoints`; fixes delete button placement and connection paths.
- **canvas-arrow-toggles.tsx**: Same nodeSize-aware icon dimensions and width/offset for arrow toggle positioning.
- **bezier-connection.tsx (BezierConnectionText)**: Icon height and width/offset from `getNodeSizeDimensions` for connection text placement.
- **diagram-node.tsx**: Icon node `minWidth` now uses `iconNodeDims.width` or `getNodeSizeDimensions(nodeSize).container` instead of hardcoded 80, so half/quarter nodes render correctly.
Viewer uses same components as editor, so all fixes apply to both.

### 2026-02-12 – Viewer Mode Layer Visibility
When a diagram has layers defined in its JSON, the viewer mode now shows a Layers button in the controls panel. Users can toggle layer visibility (eye/eye-off) to show or hide nodes in each layer. Background layer cannot be hidden. Uses `filterByVisibleLayers` from layers-utils; ViewerLayersPanel is a read-only popover with visibility toggles. Added: viewer-layers-panel.tsx; modified: viewer/page.tsx, viewer-controls.tsx.

### 2026-02-12 – Connector Order by Relative Target Position
When multiple connectors exit the same edge of a node, their order was based on JSON connection order, causing overlapping lines when targets were at different vertical positions. Now edge groups are sorted by the relative position of the other endpoint: for outgoing connections, by target center (Y for left/right edges, X for top/bottom); for incoming connections, by source center. This fans out connectors toward their destinations and reduces overlap. Modified: canvas-connections.tsx (edgeGroups sort after build).

### 2026-02-12 – Connection Alignment Uses Icon-Only Bounds
Fixed connector alignment for icon/resource nodes with labels (for example, multi-line labels under icons). Updated `bezier-connection.tsx` geometry helpers (`determineConnectionEdges`, `getOptimalConnectionPoints`, and `getConnectionPoint`) so icon-like nodes automatically use icon container dimensions from `nodeSize` for anchor/edge center calculations. Label text width/height is now ignored for connector bounding alignment; textbox/text node behavior remains unchanged.

### 2026-02-12 – Connection Path Anchors Forced to Inner Icon Geometry
Further tightened connector alignment in the actual rendered path math (`BezierConnection`) for icon/resource nodes. Connection height now uses icon container size (not text-inflated node height), and top-label offset is derived from measured outer-vs-icon delta so lines attach to the inner icon body consistently. No textbox/text behavior changes.

### 2026-02-12 – Icon Width Fallback in Shared Connection Geometry
Updated shared connection helpers in `bezier-connection.tsx` so icon-like nodes derive icon width from icon geometry even when callers only provide icon height. This prevents horizontal anchor math from falling back to outer text-inflated width in partial call paths.

### 2026-02-12 – Icon Node Stack Anchored Top For Connection Consistency
Adjusted icon/resource node layout in `diagram-node.tsx` so non-middle text modes use a full-height wrapper anchored from the top instead of vertical centering. This removes center drift when labels increase container height and keeps icon position stable for connection anchor alignment.

### 2025-02-12 – Connection Alignment Ignores Text (Icon-Only Bounding Box)
Connection lines attach to the node element (icon) only, ignoring text labels. Added `measureNodeDimsForConnections()` which returns icon-only dimensions for icon/resource nodes. Connection point calculations, edge determination, and BezierConnection now use icon-only dims so lines align to the purple icon square, not the full box including "Glue Databrew"-style labels. Text nodes, textboxes, shapes, and groups unchanged. Modified: canvas-constants.ts (measureNodeDimsForConnections), canvas-connections.tsx, bezier-connection.tsx, canvas-arrow-toggles.tsx, canvas-connection-text.tsx.

### 2025-02-12 – Selection Animation Removal
Removed the "Enable Selection Animation" feature from the editor. The View menu no longer includes the toggle; nodes always use static glow (node-glow-static, node-glow-green-static) for selection/group-member highlighting. Removed: useNodeAnimationOffsets from editor-canvas, animatedNodesById/animatedZonesById (display now uses nodesById/zonesById directly), selectionAnimationEnabled/animationOffset from diagram-node, TopMenuBar toggle. Modified: top-menu-bar.tsx, diagram-editor.tsx, editor-canvas.tsx, diagram-node.tsx, README.md.

### 2025-02-12 – Resize Responsiveness
Resize drag handles (rectangles, textboxes, shapes) now update instantly during drag. Uses local state `resizeDimensions` in diagram-node for optimistic display; parent `onResize` called only on pointer up. ShapeWrapper and SvgShapeBase accept `overrideWidth`/`overrideHeight` for live shape resizing. Modified: diagram-node.tsx, shape-wrapper.tsx, svg-shape-base.tsx.

### 2025-02-12 – Node/Icon Size (normal, half, quarter)
Added `nodeSize` property for nodes and icons: `'normal' | 'half' | 'quarter'`. Available in the Visual Styling modal (context toolbar). Normal = 80×80 container, 70×70 icon; half = 40×40/35×35; quarter = 20×20/18×18. Applies to icons (Lucide, resource, emoji), shapes, and JSON schema. Modified: visual-styling.ts (interface, extract, apply, getNodeSizeDimensions, getNodeSizeMultiplier), types.ts, schemas.ts, visual-styling-panel.tsx, diagram-node.tsx, canvas-constants.ts, shape-wrapper.tsx, svg-shape-base.tsx, context-toolbar.tsx (handleVisualStylingReset), nested-hierarchy.ts, AI_SCHEMA.md.

### 2025-02-12 – Infinite Loops / Memory Leaks Audit
Created `docs/INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md` – codebase audit for infinite loops, excessive re-renders, and memory leaks. No critical infinite loops found. Issues: (1) viewer-canvas assigns `__viewerFitToView`/`__viewerZoomIn`/`__viewerZoomOut` to `window` without cleanup on unmount; (2) carousel `reInit` listener not unsubscribed; (3) use-canvas-context-menu `closeContextMenu` should be `useCallback` to avoid effect thrashing. Most patterns (event listeners, ResizeObserver, RAF, subscriptions) have proper cleanup.

### 2025-02-11 – README Update
README.md fully updated with all latest functions and features: canvas & editor, resource browser, node types (shapes, line, textbox, icons), connections, selection/multi-select, groupings, styling panels, alignment, auto layout, JSON editor, export, keyboard shortcuts, development commands.

### Project Overview
DiagramWeaver is a Next.js 15 application for creating interactive architecture diagrams. It supports drag-and-drop design and integration with multiple cloud providers. Users can build, edit, and visualize complex system architectures with Bezier curve connections.

### Tech Stack
- **Framework**: Next.js 15 with React 18
- **UI Library**: Radix UI components with TailwindCSS for styling
- **Drag & Drop**: React DND for interactive elements
- **Icons and Resources**: Custom PNG/SVG icons for 17+ providers
- **State Management**: React hooks and context for diagram state

### Core Features
- **Interactive Diagram Editor**: Canvas-based editor with zoom, pan, and grid snap
- **Drag-and-Drop Interface**: Drag resources from sidebar to canvas; supports nested groups and zones
- **Multi-Provider Support**: Icons and resources for AWS, Azure, GCP, OCI, Kubernetes, and more
- **Connection Routing**: Bezier curve connections between nodes with customizable styling
- **Group and Zone Management**: Create nested groups; intra-group reordering and hierarchical connections
- **Resource Browser**: Searchable sidebar with categorized resources from all providers
- **Export and Persistence**: JSON-based diagram storage and export capabilities
- **Responsive Design**: Mobile-friendly with touch support via use-mobile hook

### Supported Providers and Categories
- **Cloud Providers**: AWS (525 resources), Azure (808), GCP (94), OCI (141), Alibaba Cloud (95), IBM Cloud (181), DigitalOcean (26), OpenStack (51), Outscale (13)
- **Containerization**: Kubernetes (46 resources)
- **SaaS Tools**: 41 resources including Slack, Google Analytics, Salesforce
- **On-Premise**: 173 resources for servers, databases, monitoring tools
- **Programming**: 74 resources including languages (JavaScript, Python), frameworks (React, Django), flowcharts
- **Elastic Stack**: 45 resources for Elasticsearch, Kibana, Beats
- **Firebase**: 23 resources for core services and features
- **GIS**: 68 resources for mapping, geocoding, and spatial tools
- **Generic**: 30 resources for common elements like servers, networks

### UI/UX Features
- **Component Sidebar**: Draggable items with search and categorization
- **Editor Canvas**: Zoom/pan, grid visibility, snap-to-grid for precise placement
- **Hover and Selection**: Tooltips, highlighting for connected elements
- **Responsive Layout**: Adaptive design with proper scrolling in sidebars
- **Dark Mode Support**: Some providers (e.g., OCI) have white variants for dark themes
- **Icon Persistence**: Fixes ensure icons remain visible after connections and selections

### Recent Updates and Fixes
- **2026-02-12 – Viewer Mode Layer Visibility**: When a diagram has layers defined in its JSON (2+ layers), viewer mode shows a Layers button in the control panel. Users can toggle layer visibility (eye/eye-off) to show/hide nodes per layer. Background layer cannot be hidden. New: viewer-layers-panel.tsx; modified: viewer/page.tsx, viewer-controls.tsx.
- **2025-02-11 – Resource Name Truncation**: Long resource names in the left panel are truncated with ellipsis so they fit within the card width. Hover shows a Tooltip with the full name. Applies to both DraggableResourceItem (cloud resources) and DraggableIconItem (icons). Modified: draggable-resource-item.tsx, draggable-icon-item.tsx.
- **2025-02-11 – Right-Click Search + Pan Coexist**: Right-click on empty canvas: **right-click + hold + drag** pans the canvas; **right-click + release** (without dragging) opens the Search Resources modal. Modal has a search input that filters resources as you type, with a scrollable icon list similar to the left panel. Users can click or drag items onto the canvas; click places at the right-click position, drag uses normal drop position. Modal positioned near cursor, responsive. uses `wasLastRightClickAPan()` in use-canvas-interactions to distinguish pan vs context-menu intent. Modified: editor-canvas.tsx, use-canvas-interactions.ts.
- **2025-02-11 – Left Panel Branding & Collapse**: Added "Diagram Weaver" app name at top left of the left side panel above the search bar. Added collapse/expand toggle (chevron) for the whole left panel; when collapsed shows narrow strip (48px) with vertical app name and expand button; when expanded shows full panel with title and collapse button. Modified: component-sidebar.tsx, diagram-editor.tsx.
- **2025-02-11 – Icon vs Shape Star/Cloud Fix**: Dragging the Lucide "Star" (or "Cloud") icon from the Icons section previously created an object-shape star/cloud instead of the icon. Added `isIconOrEmojiType()` helper in utils.ts to distinguish `generic.icon.*` and `generic.emoji.*` from object shapes. DiagramNode, ResourceIcon, canvas-constants, context-toolbar, canvas-connections, bezier-connection, canvas-operations, canvas-arrow-toggles, node-edge-arrows, scratch-pad, and shape-preview now exclude icon/emoji types from shape detection. Both the object shape star (from Objects) and the Lucide icon star (from Icons) can now be dragged correctly.
- **2025-02-11 – Connection Lines Behind Node Text**: Fixed connection lines and arrowheads appearing in front of node labels (e.g. "Kinesis Video Streams"). DiagramNode now has z-index 2; CanvasConnections uses z-index -1 (slot connections) or 0 (last slot). Nodes and their text labels render above all connection lines. Modified: diagram-node.tsx, canvas-connections.tsx.
- **2025-02-11 – Connection Order & Text Layering**: (1) Connection text now renders above connection lines (z-index 10). (2) Connection lines respect item z-order: a line from shape 1 to shape 3 goes *behind* shape 2 when shape 2 is "in front" (higher in layer/array order), and *in front of* shape 2 when shape 2 is "back". Uses `computeConnectionSlots()` in `connection-order-utils.ts`; connections are interleaved with node rendering in `editor-canvas.tsx`. Move to Front/Back and layer order control line layering.
- **2025-02-11 – Edge Position Removed from Toolbar**: Removed the Edge Position control from the context toolbar menu. The `edgePosition` property remains in types/schemas/layout for backward compatibility; only the toolbar UI was removed.
- **2025-02-11 – Connections & Delete UI**: Connections panel is now a Popover anchored to the Connections button (no draggable modal). Removed "Shadow:" label from connection settings (toggle button kept). Delete connection red icon has a styled Tooltip hover ("Remove connection") instead of native title. Modified: context-toolbar.tsx, canvas-connections.tsx.
- **2025-02-11 – Icon/Resource Label Width**: Text labels under icon/resource nodes can be wider than the 80px icon. Added `labelWidth` (node property). Resize via right-handle when selected. Connections attach to icon (not label). Node dimensions from `measureNodeDims`; connections use icon anchors when `labelWidth` > 80. Modified: types, schemas, canvas-constants, diagram-node, bezier-connection, resize-handles, canvas-operations, nested-hierarchy.
- **2025-02-11 – Visual Styling Context-Aware**: Visual Styling button/panel: **shapes and textbox** (full preset/border/background/effects/tags), **Lucide icons** (Icon Color + Remove background), **resource items** (Remove background only). Hidden for emojis. **generic.text.text** does NOT show Visual Styling; **generic.text.textbox** does. Modified: context-toolbar, context-menu, visual-styling-panel.
- **2025-02-11 – Lucide Icons Expansion**: Added 14 more Lucide icons to the left sidebar Icons section: UserPlus (People), AtSign (Communication), ThumbsUp/ThumbsDown (Status), Smartphone/Box/Router (Tech), FolderOpen/Image (Documents), Power/RefreshCw (Actions), RotateCw (Tools), Timer/History (Time). Now 11 sections with 74 Lucide icons total (was 60). Modified: icon-resources.ts.
- **2025-02-11 – Icons Section**: Added a new "Icons" section in the left selection panel (ResourceBrowser) with standard web framework symbols (Lucide icons) and emojis. Users can drag Home, Shield, Person, Star, Lock, Key, and 50+ other symbols/emojis onto the canvas. Icons render at the same 80×80 size as other resource items. Two subcategories: Symbols (Lucide) and Emojis. Supports search filtering and double-click to paste. Copy/paste from palette works for icons. Types: `generic.icon.*` (Lucide) and `generic.emoji.*`. New files: `src/lib/icon-resources.ts`, `src/components/editor/draggable-icon-item.tsx`. Modified: resource-browser, resource-icon, diagram-node, canvas-operations, types, diagram-editor, component-sidebar, draggable-resource-item.
- **2025-02-11 – Textbox Bullet/Numbered Lists**: Textbox supports bullet and numbered lists. Use the list icons in the formatting toolbar (bullet or 1.2.3). Stored in richLabel runs with listType: 'bullet' | 'numbered'. Modified: types, schemas, rich-text.ts, textbox-rich-editor, textbox-rich-display.
- **2025-02-11 – Textbox Rich Text**: Textbox assets now support bold/italic/underline per text segment. Double-click to edit, select text and use the B/I/U toolbar. Formatting is preserved in JSON via `richLabel` array (`[{text, bold?, italic?, underline?}, ...]`). Backward compat: nodes without `richLabel` use plain `label`. Context toolbar label edit clears rich formatting. Modified: `rich-text.ts`, `textbox-rich-editor.tsx`, `textbox-rich-display.tsx`, `diagram-node.tsx`, `diagram-editor.tsx`, `context-toolbar.tsx`, `types.ts`, `schemas.ts`.
- **2025-02-11 – Shape Text Multiline Support**: Shapes (rectangles, circles, squares, etc.) now support hard carriage returns in text, matching textbox behavior. Use Enter for new lines; Ctrl/Cmd+Enter to finish editing. Display uses `whitespace-pre-wrap` to preserve line breaks for text inside the shape and for above/below positioning. Editing uses textarea instead of input. Shape dimension calculation honors explicit newlines. Modified: `shape-text.tsx`, `diagram-node.tsx`, `canvas-constants.ts`.
- **2025-02-11 – No Default Text on Shapes**: When dragging or creating shape objects (rectangle, circle, square, etc.) from the resource browser to the canvas, shapes no longer receive default text (e.g. "Rectangle", "Circle"). Label is now always empty for shape resources on creation; users can add text via double-click. Modified `canvas-operations.ts` addNode: `label: isShapeResource ? '' : itemLabel`.
- **2025-02-11 – Border Overlap Fix**: Added negative marginRight/marginBottom (half of border width, e.g. -1px for 2px border) to ShapeWrapper so adjacent shapes overlap by half a border. This makes shared edges draw on the same pixels—single clean line instead of double. Grid dimensions unchanged; overlap is purely visual.
- **2025-02-11 – Grid Tessellation Fix**: Objects (rectangles, squares, jigsaw, etc.) now align correctly at bottom and right edges for proper tessellation. Added `snapDimensionToGrid()` to ensure width/height are multiples of 10px (matching position grid). Applied in: `measureNodeDims` (all returned dimensions), `addNode` (initial shape sizes), `resizeNode`, `resizeMultipleNodes`, and diagram-node `handleResizeMove`. Right edge (x+width) and bottom edge (y+height) now land on grid points.
- **2025-02-11 – Resource Icon Path Fix**: Fixed 404s for AWS/Azure resource icons (e.g. OpenSearch Traces, UltraWarm). Added `buildResourceIconPath()` in resource-mapping.ts to handle both simple filenames (provider/category/file) and full paths (when file starts with "provider/"). Updated generate-aws-resources.py and generate-azure-resources.py to store full paths in the file field. Regenerated resource-aws.json and resource-azure.json.
- **2025-02-10 – Typecheck Fixes**: Fixed all TS errors after zones removal: optional zones (?? []), removed zone from SelectedItem, added lineTextPosition/roundedEdges to types, fixed addEventListener/Event, CanvasRulers props, onHoverChange signature, clipboard param types, ThemeProperties.roundedEdges.
- **2025-02-10 – Zones Feature Removal** (Complete): Diagram is flat—nodes only. Deleted: `diagram-zone.tsx`, `zone-layout-utils.ts`. Stripped: zone creation/resize/layout from canvas-operations, zone rendering from editor-canvas and viewer-canvas, zone layout from calculateLayout (returns processedZones: []). `flattenDiagramOnImport` flattens legacy JSON on import. DiagramData.zones optional (deprecated).
- **2025-02-10 – Freeflow Option Removal**: Removed the freeflow toggle and default freeflow preference. Objects and nodes are now always allowed to move anywhere within the grid. No more zone absorption on drop—all items use free placement. Removed: context toolbar freeflow button, context menu freeflow option, View menu default freeflow toggle, handleToggleFreeflow from clipboard, defaultFreeflowEnabled state.
- **2025-02-10 – AI/Ollama/Firebase Removal**: Removed all AI generation features, Ollama integration, Firebase SDK, and genkit-cli. Diagram creation is now JSON/drag-and-drop only. See AI_REMOVAL_PLAN.md.
- **2026-01-26 – Line Shape Feature** (Corrected Implementation): Added a new line shape type that works fundamentally differently from other shapes:
  - **Unique Object Type**: Lines are NOT regular shapes - they're a special diagram element with their own behavior
  - **Absolute Position System**: Lines store TWO absolute canvas positions (`startPos` and `endPos`) instead of one position + relative offsets
  - **Bounding Box Calculation**: The node's x,y position represents the top-left of the bounding box containing both endpoints
  - **Independent Endpoint Dragging**: 
    - Blue handle appears at start point, green handle at end point
    - Drag either handle to move that endpoint independently
    - **Grid Snapping**: Endpoints snap to grid when dragged for precise alignment
    - Creates angled lines (45°, vertical, horizontal, any angle)
    - Endpoint positions are absolute canvas coordinates
  - **Line Movement**: 
    - Click and drag the line body (not handles) to move entire line
    - Both startPos and endPos update together by the same delta
    - Maintains the line's angle and length while moving
  - **Visual Differences from Regular Shapes**:
    - ❌ NO bounding box/ring highlight when selected (only endpoint handles show)
    - ❌ NO resize handles (resize by dragging endpoints)
    - ❌ NO rotation controls (rotation defined by endpoint positions)
    - ❌ NO connection handles (lines aren't connectable nodes)
    - ❌ NO hover scale effect or glow
  - **Customizable Endpoint Caps**:
    - **None**: No decoration
    - **Arrow**: Triangular arrowhead pointing along line direction
    - **Dot**: Circular cap
    - **Square**: Square cap rotated to line angle
  - **Context Toolbar Controls** (only these show for lines):
    - Start Cap dropdown (none/arrow/dot/square)
    - End Cap dropdown (none/arrow/dot/square)
    - Line Thickness input (0.5-10px)
    - Line Color picker (via lineColor property)
  - **Line Properties**:
    ```typescript
    {
      startPos: { x: number, y: number },  // Absolute canvas position
      endPos: { x: number, y: number },    // Absolute canvas position
      startCap: 'none' | 'arrow' | 'dot' | 'square',
      endCap: 'none' | 'arrow' | 'dot' | 'square',
      lineThickness: number,
      lineColor: string
    }
    ```
  - **Default Configuration**: New lines created horizontal, 150px length, start=none, end=arrow, thickness=2.5px
  - **Rendering System**: 
    - LineShape component calculates relative coordinates from absolute positions
    - SVG positioned absolutely with calculated dimensions
    - Caps rendered at correct angles based on line direction
  - **Movement System**: Both moveItem and moveMultipleItems handle lines specially by updating both endpoints
  - **Type System**: Extended DiagramNodeData/DiagramNodeItem with startPos, endPos, startCap, endCap, lineThickness
  - **Components Created**:
    - `src/components/diagram/shapes/line.tsx` - Line rendering with SVG
    - `src/components/diagram/line-endpoint-handles.tsx` - Draggable endpoint handles
  - **Files Modified**: types.ts, diagram-node.tsx, context-toolbar.tsx, canvas-operations.ts, resource-generic.json
  - **Benefits**: True line objects for annotations, directional indicators, visual separators, and custom connector-like elements without using the connection system
- **2026-01-26 – Line Dragging Improvements**: Fixed multiple issues with line object dragging and endpoint positioning:
  - **Real-Time Visual Feedback**: Line objects now move smoothly during drag (not just on release). Both `startPos` and `endPos` update in real-time using drag delta calculations, matching the behavior of endpoint dragging.
  - **Initial Position Fix**: Fixed issue where newly created lines would jump on first drag. Lines are now created with `x` and `y` set to match the min of `startPos`/`endPos` for consistency.
  - **Removed Vertical Offset**: Removed the +50px vertical offset that was applied to line creation. Lines now appear exactly where dropped, horizontally aligned with the drop point.
  - **Endpoint Marker Positioning**: Fixed issue where endpoint markers would drop down on first drag. Ensured `node.x`/`node.y` match the calculated min positions before drag starts.
  - **Drag Handler Updates**: Enhanced drag handler in `use-canvas-drag-drop.ts` to use min of `startPos`/`endPos` as initial position for line nodes, ensuring consistent positioning.
  - **Display Position Overrides**: Updated `displayNodesById` in `editor-canvas.tsx` to apply delta to both `startPos` and `endPos` during drag for real-time visual updates.
  - **Files Modified**: 
    - `src/hooks/use-canvas-drag-drop.ts` - Line node initial position calculation
    - `src/components/editor/editor-canvas.tsx` - Real-time position updates for line nodes
    - `src/components/editor/canvas-operations.ts` - Line creation without vertical offset
    - `src/components/diagram/diagram-node.tsx` - Endpoint handle positioning consistency
    - `src/components/diagram/shapes/line.tsx` - Removed offset from fallback calculations
  - **Result**: Lines now drag smoothly from creation, endpoint markers stay correctly positioned, and lines appear exactly where dropped without any offset
- **2025-11-17 – Copy-Paste ID Generation Fix**: Fixed duplicate IDs when pasting multiple items of the same type:
  - **Problem 1 - Duplicate IDs**: When copying and pasting multiple nodes of the same type (e.g., 3 Windows instances), all pasted items would get the same ID because `generateSequentialId()` was called with the same `diagramData` state for each item.
  - **Problem 2 - Selection Race Condition**: When pasting multiple items, only some of the new items would be selected (e.g., copy 2, paste, but 3 out of 4 items selected including one old item). This was caused by async state updates where shift-key selection read stale state.
  - **Root Cause (IDs)**: ID generator checked existing IDs in `diagramData` before any new items were added. When generating IDs for items 2 and 3, the generator still saw the same max ID as item 1, producing duplicates.
  - **Root Cause (Selection)**: Using `onItemSelect` with shift-key in `setTimeout` created race condition—shift-select reads previous state via `setSelectedItemIds(prev => ...)` which could still contain old selected items.
  - **Fix Applied (IDs)**: Modified paste handler to pass temporary `DiagramData` that includes already-generated nodes/zones to `generateSequentialId()`, ensuring each subsequent ID is based on previously generated ones in the same paste operation.
  - **Fix Applied (Selection)**: Directly set selection state (`setSelectedItemIds` and `setSelectedItem`) in the paste handler instead of relying on `onBatchSelect` which was trying to find items in stale `diagramData`. The paste operation now immediately sets selection to only the newly created item IDs synchronously with the data update.
  - **Implementation**: Added `setSelectedItemIds` and `setSelectedItem` to clipboard hook options, passed through from `diagram-editor.tsx` → `EditorCanvas` → `useCanvasClipboard`. Selection state is set directly with the array of pasted IDs collected during paste operation.
  - **Impact**: Multiple items of the same type now paste with unique sequential IDs (e.g., windows-6, windows-7, windows-8). Only newly pasted items are selected after paste, never old items.
  - **Files Modified**: `src/hooks/use-canvas-clipboard.ts` (ID generation loop and selection logic), `src/components/editor/editor-canvas.tsx` (pass onBatchSelect)
- **2025-11-17 – Zone Move ID Duplication Bug Fix**: Fixed critical bug where moving zones caused ID duplication (e.g., moving zone-2 would overwrite zone-1's ID with zone-2, resulting in duplicate zone-2 entries):
  - **Root Cause**: Three helper functions in `canvas-operations.ts` (`cleanUpParentId`, `setParentId`, `clearParentId`) used incorrect `findIndex` predicates that always returned index 0, causing zone updates to overwrite the first zone in the array regardless of which zone was being moved.
  - **Bug Pattern**: `findIndex(g => zone.id === groupId)` compared the outer scope `zone` variable instead of the predicate parameter `g`, making the condition constant and always matching the first element.
  - **Fix Applied**: Changed all three predicates to `findIndex(g => g.id === groupId)` to correctly find the zone being updated.
  - **Impact**: Zone moves now preserve all zone IDs correctly; no more ID overwrites or duplicates when dragging zones.
  - **Files Modified**: `src/components/editor/canvas-operations.ts` (lines 415, 451, 472)
- **2025-11-17 – Zone Drop Target Highlighting Restored**: Re-enabled visual feedback when dragging items over zones:
  - **Issue**: After zone system refactoring, drag-over highlighting stopped working—zones no longer showed blue ring or pulse animation when items were dragged over them.
  - **Root Cause**: `EditorCanvas` computed `hoveredGroupId` correctly via `useCanvasDragDrop`, but wasn't passing `isDropTarget` and `isTargetable` props to `DiagramZone` components.
  - **Fix Applied**: Wired up `isDropTarget={hoveredGroupId === zone.id}` and `isTargetable={hoveredGroupId === zone.id}` in zone rendering loop.
  - **Result**: Zones now highlight with blue ring + pulse animation while dragging items over them, providing clear visual feedback for drop targets.
  - **Files Modified**: `src/components/editor/editor-canvas.tsx` (zone rendering section)
- **2025-11-17 – Nested Zone Rendering & Interaction Fix**: Fixed z-order and interaction issues with nested zones:
  - **Problem 1 - Interaction Blocking**: When Zone-A was nested inside Zone-B, clicking/dragging Zone-A was impossible because Zone-B's DOM element rendered on top and intercepted all pointer events.
  - **Problem 2 - Depth Calculation**: Initial fix relied on `parentId` field which could be out of sync with actual nesting structure in `children` arrays.
  - **Solution - Children-Based Depth Sorting**: Implemented depth calculation based purely on `children` array relationships (not `parentId`) and sort zones by depth before rendering:
    - Computes depth for each zone by walking up the parent chain (via `children` arrays).
    - Sorts zones by ascending depth: parents (depth 0) render first, children (depth 1+) render last.
    - Child zones now sit visually on top of parents in DOM, making them fully interactive.
  - **Implementation**: Added IIFE in zone rendering that computes depth per zone using `getParentId()` helper that searches `children` arrays, then sorts before rendering.
  - **Result**: Nested zones are now fully clickable, draggable, and accept children; hierarchy depth is always correct regardless of `parentId` field state.
  - **Files Modified**: `src/components/editor/editor-canvas.tsx` (zone rendering with depth sorting)
- **2025-11-17 – Nested Zone Drop Targeting Fix**: Fixed inability to drop items into child zones when parent and child zones overlap:
  - **Problem**: Dragging items into nested zones only highlighted/targeted the parent zone; child zones never became drop targets even when hovering directly over them.
  - **Root Cause**: Drag-drop hover logic used "first match wins" approach—iterated zones and returned the first one containing the cursor point, which was often the parent.
  - **Solution - Smallest Zone Wins**: Changed hover logic to collect ALL zones containing the cursor, then select the zone with smallest area (child zones have smaller area than parents):
    - Collects all candidate zones whose bounds contain cursor position.
    - Filters out invalid drops (e.g., dropping zone into its own descendant).
    - Sorts candidates by area (width × height) ascending.
    - Picks zone with smallest area as drop target.
  - **Result**: When dragging over nested zones, the innermost/smallest zone wins; users can now drop items into both parent and child zones as expected.
  - **Files Modified**: `src/hooks/use-canvas-drag-drop.ts` (hover handler in `useDrop` hook)
  - **Benefit**: Full support for deeply nested zone hierarchies with intuitive drop targeting.
- **2025-11-17 – JSON Editor Reliability**: `JsonEditorPanel` now only re-syncs from external `DiagramData` when the value object actually changes, always rebuilds text from canonical hierarchical data (diff optimization disabled), and has a cleaned-up JSX return block that fixes the earlier parse error.
- **2025-11-17 – JSON Editor Shadow File Fix**: Removed stale compiled `src/components/editor/json-editor-panel.js` which was being preferred over the `.tsx` source on some environments, causing `react_1.default` to be `undefined` and leading to `Cannot read properties of undefined (reading 'useState')` in the browser. Next.js now uses the `.tsx` file exclusively.
- **2025-11-17 – Multi-Delete Behavior**: Delete/Backspace in `EditorCanvas` now prefers `selectedItemIds` and calls `handleDeleteMultiple`, so all selected nodes/zones/connections are removed from `DiagramData` (and thus flat + hierarchical JSON) in one keystroke.
- **2025-11-17 – Sidebar Double-Click Placement**: Items added via sidebar double-click use the same zoom/viewport center as `useCanvasTransform` (browser viewport center mapped into canvas space), with ±80px jitter in X/Y so new items appear near the visible center instead of far down the canvas.
- **Generic Shape Type Refactoring** (2025-11-12): Renamed generic shape types from `generic.text.*` to `generic.object.*` for better semantic clarity:
  - **Renamed Types**: `generic.text.square`, `generic.text.rectangle`, `generic.text.circle`, `generic.text.point`, `generic.text.triangle`, `generic.text.star`, `generic.text.cloud` → `generic.object.*`
   - **Configuration Updates**: Updated `resource-generic.json` to separate text resources (text, textbox, label) from object resources (shapes)
  - **File Structure**: Created new `/public/resources/generic/object/` directory and copied shape images from text directory
  - **Code Updates**: Updated all TypeScript/JavaScript files to use new `generic.object.*` naming:
    - `src/components/editor/editor-canvas.tsx` - Shape detection and sizing logic
    - `src/components/diagram/node-edge-arrows.tsx` - Node type detection
    - `src/components/diagram/bezier-connection.tsx` - Connection routing logic
    - `src/components/editor/context-toolbar.tsx` - Toolbar shape detection
    - `src/components/diagram-editor.tsx` - Shape node detection
    - `src/components/diagram/diagram-node.tsx` - Shape rendering logic
  - **Test Files**: Updated test JSON files to use new naming convention
   - **Backward Compatibility**: Preserved `generic.text.textbox` type unchanged as requested
  - **Build Verification**: Confirmed successful compilation with no breaking changes
  - **Benefits**: Clearer semantic distinction between text elements and geometric shapes, improved code organization
- Resource JSON consolidation: Single source of truth under `public/resources/`; removed duplicate JSONs under `resources/`. Resource Browser now fetches index at runtime, and Canvas uses the same exact icon path via `imagePath` to ensure icon parity.
- **Resource Reorganization**: Split into modular JSON files for better maintainability
- **Bug Fixes**: Icon persistence, drag-drop preservation, scrollbar issues resolved
- **Grid and Snap Enhancements**: Improved placement, collision prevention, and nested layouts
- **Type System**: Updated types to preserve resource information during operations
- **UI Fix**: Resolved React warning about mixing `border` and `borderImage` in `src/components/diagram/diagram-group.tsx` by replacing shorthand `border` with explicit `borderWidth`/`borderStyle`/`borderColor` and using `borderImageSource` + `borderImageSlice` for gradient borders.
- **New** (2025-10-27): Added "Fit to view" and "Export PNG" buttons under Show JSON toggle in left sidebar (ComponentSidebar). EditorCanvas now exposes `fitToView` and `exportPng` via forwardRef. PNG export uses `html-to-image` to render the viewport and triggers a browser download (diagram.png). Fit-to-view computes bounds using dynamic node dimensions plus margins. Removed temporary console logs from connection rendering and DiagramGroup shadow debug. Typecheck passed; ESLint currently errors due to a circular reference in `.eslintrc.json` (unchanged).
- Note: PNG export disables font embedding to avoid CSSStyleSheet SecurityError from cross-origin stylesheets.
- Sidebar fix: resource icons now resolve by deriving standard file names first (e.g., "EC2 Instance" → `/resources/aws/compute/ec2-instance.png`) and fall back to explicit `file` path, ensuring correct icons appear.
- Policy: Do not persist `imagePath` in created nodes; icons are always resolved from `type` with provider-specific aliasing (e.g., Kubernetes `statefulset` → `sts.png`).
- **Optimization** (2025-10-27): Removed redundant `imagePath` fields from diagram JSON files and drag/drop operations. The `ResourceIcon` component (renamed from `AwsIcon`) automatically derives icon paths from `type` field for all providers (e.g., "generic.device.mobile" → "/resources/generic/device/mobile.png", "aws.database.dynamodb" → "/resources/aws/database/dynamodb.png"). The `imagePath` field is now truly optional and only needed for custom icon overrides. This reduces JSON file size, eliminates data duplication, and works seamlessly with all 18+ supported providers (AWS, Azure, GCP, Generic, K8s, Programming, etc.).
- **NEW FEATURE** (2025-10-27): JSON Editor Panel - Added a collapsible JSON editor to the right side of the canvas with live sync capabilities. Features include:
  - **CodeMirror Editor**: Professional code editor with line numbers, syntax highlighting, bracket matching, and JSON linting
  - **Live Sync**: Real-time bidirectional updates between canvas and JSON - edit text changes reflect instantly on canvas, canvas changes update JSON
  - **Validation**: Zod schema validation with detailed error reporting for both JSON syntax and diagram structure
  - **Resizable Panel**: Uses `react-resizable-panels` for smooth resize and collapse behavior
  - **Keyboard Shortcut**: Ctrl+Shift+J (Cmd+Shift+J on Mac) to toggle panel
  - **Local Persistence**: Panel state and width saved to localStorage
  - **Debounced Updates**: 300ms debounce prevents performance issues during rapid typing
  - **Loop Protection**: Prevents infinite update cycles between editor and canvas
  - **Tech Stack**: `@uiw/react-codemirror`, `@codemirror/lang-json`, Zod validation, `react-resizable-panels`
  - **UI Polish**: Status indicators, error display, smooth transitions, collapsed state toggle button
- **ID Generation Improvement** (2025-10-27): Replaced timestamp-based ID generation with sequential numbering for cleaner diagram organization:
  - **Sequential Node IDs**: New nodes get IDs like `aws-database-dynamodb-1`, `aws-database-dynamodb-2`, etc.
  - **Sequential Group/Zone IDs**: Groups and zones get IDs like `group-1`, `zone-1`, `group-2`, etc.
  - **Smart ID Scanning**: The `generateSequentialId()` function scans existing diagram data to find the highest sequential number (1-999) for each type and increments, ignoring timestamp-based IDs (numbers > 999)
  - **Backward Compatibility**: Handles existing diagrams with timestamp-based IDs gracefully by ignoring them and starting fresh sequential numbering
  - **Consistent Operations**: Copy/paste operations, drag-from-sidebar, and group/zone creation all use sequential IDs
  - **Implementation**: New `src/lib/id-generator.ts` utility integrated in both `diagram-editor.tsx` and `editor-canvas.tsx`
  - **Benefits**: Cleaner diagram JSON, predictable naming, easier debugging and manual editing, eliminates 13-digit timestamp clutter
- **Type Expansion System** (2025-10-27): Added intelligent type abbreviation expansion for faster JSON editing:
  - **Fuzzy Matching**: Type patterns like `aws.c.ec2` automatically expand to `aws.compute.ec2-instance`
  - **Ultra-Short Patterns**: Even `a.c.e` expands to `aws.compute.ec2-instance` (first alphabetical match)
  - **Multiple Strategies**: Exact match → prefix match → contains match → abbreviation match → fuzzy matching
  - **Real-time Expansion**: JSON editor automatically expands abbreviated types during editing
  - **Resource Awareness**: Loads all available resources from providers to ensure accurate matching
  - **Smart Scoring**: Prioritizes provider > category > resource matching with weighted scores
  - **Implementation**: New `src/lib/type-matcher.ts` utility integrated into JSON editor for seamless type expansion
  - **Performance**: Caches loaded resource types to avoid repeated API calls
- **ResourceIcon Component Overhaul** (2025-10-27): Completely fixed icon loading system for 100% reliability across all providers:
  - **Removed All Fallback Logic**: Eliminated problematic fallback paths that caused wrong 404 requests (e.g., `/resources/aws/compute/ec2.png` instead of correct catalog lookup)
  - **Pure Catalog Lookup**: Icons now ONLY load from resource catalog files (resource-*.json), ensuring correct filename mapping (e.g., `aws.compute.ec2` → fetch resource-aws.json → find "EC2" → use "amazon-elastic-compute-cloud.png")
  - **Fixed Infinite Recursion**: Removed buggy `onError` handler that caused infinite incrementing when no more candidates existed
  - **Simplified State Management**: Removed complex `candidates` array and `idx` state, replaced with simple `iconPath` from catalog lookup
  - **Enhanced Error Handling**: Added proper HTTP status checking and detailed console warnings for debugging
  - **Universal Fix**: Works for ALL providers (AWS, Azure, GCP, Generic, K8s, etc.) - no more mixed working/broken icons
  - **Performance**: Icons load once from catalog, no retry loops or multiple failed requests
  - **Clean Fallback**: Only shows generic SVG icon if catalog lookup completely fails, no broken image attempts
- **Hierarchical Rendering Fix** (2025-10-29): Fixed infinite recursion error when changing group orientation and implemented proper parent-first rendering:
  - **Root Cause**: `resetChildGroupPositions` function had multiple issues causing stack overflow:
    - Wrong variable reference: Using `groupData.children` instead of `group.children` in recursive calls
    - No cycle protection: No visited set to prevent infinite recursion in circular references
    - Mixed property names: Inconsistent use of `children` vs `nodes` properties
  - **Cycle Protection**: Added `visited: Set<string>` parameter to track processed groups and prevent infinite loops
  - **Fixed Variable References**: Corrected all recursive calls to use proper `group.children` instead of `groupData.children`
  - **Type Consistency**: Updated all references to use `children` property consistently (removed fallback `(groupData as any).nodes`)
  - **Hierarchical Rendering**: Implemented `sortedRenderItems` that sorts diagram elements by depth:
    - Parents (depth 0) render before children (depth 1+)
    - Maintains original order for items at same depth level
    - Uses parent-child map to calculate depth and sort accordingly
  - **Rendering Order Update**: Replaced separate group/node rendering loops with single sorted loop for proper visual layering
  - **Testing**: Created comprehensive test suite (`test-recursion-fix.js`) covering normal hierarchy, circular references, and complex nested structures
  - **Benefits**: No more stack overflow errors, proper visual hierarchy, correct z-index ordering, maintained drag-drop functionality
- **Edge Positioning for Group Children** (2025-11-03): Added ability to position nodes on the edges of their parent groups/zones:
  - **Edge Position Property**: Added `edgePosition?: 'top' | 'bottom' | 'left' | 'right'` to DiagramNodeData type
  - **Layout Algorithm**: Modified layoutGroup function to separate edge-positioned nodes from regular nodes
  - **Positioning Logic**: Edge nodes are positioned at the center of their respective edges, half inside/half outside the group boundary
  - **UI Control**: Added dropdown in sidebar (Details tab) to set edge position when node has a parent group
  - **Options**: "Normal (Inside)", "Top Edge", "Bottom Edge", "Left Edge", "Right Edge"
  - **Smart Centering**: Nodes positioned at midpoint of edge (horizontally centered on top/bottom, vertically centered on left/right)
  - **Schema Support**: Updated Zod schemas to validate edgePosition property
  - **Backward Compatible**: Nodes without edgePosition property continue to be positioned inside groups normally
  - **Preserved Capabilities**: All existing layout and positioning features remain functional
- **Edge Node Alignment Fix** (2025-11-03): Fixed alignment issue where edge-positioned nodes were misaligned when they were the only node inside a group/zone:
  - **Root Cause**: When a group contained only edge-positioned nodes (no regular nodes), the layout algorithm treated it as an "empty" group (`numItems === 0`) and used minimum sizing, but didn't position the edge nodes within that sizing logic
  - **Issue**: Edge nodes were being positioned after group sizing was calculated, but the empty group path didn't account for their positioning needs
  - **Solution**: Modified the empty group handling to:
    1. Detect when edge nodes exist even with no regular children
    2. Ensure adequate minimum group size for proper edge positioning (2x node dimensions)
    3. Position edge nodes within the empty group logic path, not just in the regular layout path
  - **Algorithm Update**: Edge node positioning now happens in both the empty group case and regular layout case
  - **Consistent Sizing**: Groups with edge nodes now maintain adequate minimum size (2x node dimensions) in both empty and populated states
  - **Even Distribution**: When multiple nodes are positioned on the same edge, they are distributed evenly across the available edge space
  - **Distribution Logic**: Single nodes remain centered; multiple nodes spread from edge to edge with equal spacing between them
  - **Result**: Edge nodes align perfectly whether single (centered) or multiple (evenly distributed), and groups maintain consistent size in all scenarios
- **Edge Distribution Enhancement** (2025-11-03): Fixed edge node distribution for 2-item case to avoid extreme positioning:
  - **Issue**: With exactly 2 nodes on an edge, they were positioned at extreme ends (0% and 100%) rather than being evenly distributed
  - **Root Cause**: Spacing calculation used `availableSpace / (count - 1)` which for 2 nodes resulted in positions at the very edges
  - **Solution**: Changed to `availableSpace / (count + 1)` and position at `spacing * (index + 1)` for more even distribution
  - **Result**: 2 nodes now position at ~33% and ~67% of the edge length instead of 0% and 100%
  - **Maintained**: Single node centering (50%) and 3+ node distribution remain unchanged
  - **Applies To**: Both horizontal (top/bottom) and vertical (left/right) edge distributions
- **Preferred Exit & Connection Arrows** (2025-11-03): Added per-connection directional control and arrowhead indicators:
  - **Per-Connection Preferred Exit**: Added `preferredExit?: 'top' | 'bottom' | 'left' | 'right'` to DiagramConnectionData interface
  - **Per-Connection Arrow Control**: Added `arrow?: boolean` property to connections to enable/disable arrowheads per connection
  - **Bezier Connections**: Connections use Bezier curves for smooth routing between nodes
  - **SVG Arrowhead Markers**: Arrowheads render as traditional SVG markers at the end of connection lines
  - **UI Controls**: Added preferred exit dropdown and arrow checkbox per outgoing connection in sidebar
  - **Connection-Specific Settings**: Each outgoing connection can have its own preferred exit direction
  - **Type Updates**: Extended DiagramConnectionData interface and updated sidebar connection controls
  - **Visual Implementation**: Arrowheads use SVG markers with automatic orientation and color matching
- **Benefits**: Granular control over individual connection routing, clearer data flow indication, enhanced diagram readability
- **Preferred Exit Positioning Fix** (2025-11-03): Fixed issue where preferred exit directions were not placing connection start points at the correct node edges:
  - **Root Cause**: Connection positioning logic was looking for preferred exit on node objects instead of connection data
  - **Data Location Fix**: Updated to read fromPreferredExit and toPreferredEntry from connection data (not from nodes)
  - **Edge Calculation**: Modified connection point calculation to position connections directly at node edges
  - **Proper Direction Support**: Added toPreferredEntry parameter to handle preferred entry directions for incoming connections
  - **Bezier Routing**: Bezier curve connections respect preferred exit and entry directions for smooth routing
  - **UI Completion**: Added incoming connection controls for "Preferred Entry (To)" and "Show Arrow (To)" in sidebar
  - **Result**: Preferred exit "bottom" now correctly places connection at bottom edge of node, same for all directions
  - **Entry Direction Fix**: Fixed reversed preferred entry directions - "left" now correctly enters from left side instead of right
  - **Logic Correction**: Removed incorrect getOppositeDirection() usage in target node entry point calculation
  - **Consistent Behavior**: Both source preferred exits and target preferred entries now work intuitively
- **Arrow Rendering Fix** (2025-11-03): Fixed arrow display to use SVG markers on connection lines instead of drawing separate lines:
  - **Issue**: NodeEdgeArrows component was drawing separate arrow lines instead of using existing connection lines
  - **Root Cause**: Duplicate rendering system - both SVG markers on connections and separate arrow lines were being drawn
  - **Solution**: Removed NodeEdgeArrows component usage and enhanced DiagramConnection arrow logic
  - **SVG Marker Integration**: Updated connection component to properly use fromArrow and toArrow properties with SVG markers
  - **Backward Compatibility**: Maintained support for legacy 'arrow' property while adding new per-direction arrow support
  - **Clean Rendering**: Arrows now appear as proper arrowheads on the connection lines, not as separate overlapping elements
  - **Result**: "Show Arrow" checkboxes now correctly add arrowheads to the existing connection lines
- **Connection Toolbar Controls** (2025-12): Enhanced toolbar with comprehensive connection management:
  - **Context-Aware Arrow Toggle**: Arrow enable/disable option appears only when a connection is selected
  - **Connections Dropdown**: When a node/group is selected, displays all associated connections in a scrollable dropdown
  - **Per-Connection Controls**: Each connection in the dropdown has individual controls:
    - **Arrow Toggle**: Enable/disable arrowhead per connection
    - **Color Picker**: Change line color with both color picker and hex input
    - **Text Input**: Update text displayed on connection line
    - **Text Position Slider**: Adjust text position percentage (0-100%) along the connection line with slider and number input
  - **Connection Selection**: Clicking a connection selects it and shows arrow toggle and delete button in toolbar
  - **Multiple Connection Indicator**: Connection button shows count when node/group has multiple connections
  - **Visual Direction Indicators**: Each connection shows direction arrow (→ outgoing, ← incoming) and target label
  - **Type Updates**: Extended `onConnectionUpdate` handler to support `text`, `textPosition`, and `color` properties
  - **Implementation**: New `getAllConnections` useMemo hook filters connections related to selected item
  - **UI Components**: Uses Popover, Slider, Input, and Button components for intuitive controls
- **Rotation Support Extended** (2025-12): Added rotation capability to all node types and groups/zones:
  - **Universal Rotation**: All nodes (text, textbox, label, shape, icon) now support rotation
  - **Group/Zone Rotation**: Groups and zones can be rotated using the same rotation controls
  - **Rotation Options**: 0°, 45°, -45°, 90°, -90° available via dropdown in toolbar
  - **CSS Transform**: Rotation applied using `rotate(Xdeg)` CSS transform with `transformOrigin: center`
  - **Type Updates**: Added `rotation?: number` to `DiagramGroupItem` and `DiagramGroupData` interfaces
  - **Rendering**: Updated `DiagramNode` and `DiagramGroup` components to apply rotation transforms
  - **UI Controls**: Rotation option appears in toolbar for all nodes and groups (not just text nodes)
  - **Shadow Compatibility**: Rotation works correctly with shadow effects (uses `translateZ(0)` for proper rendering)
- **Interactive Rotation Handles** (2026-01, updated 2026-04): Direct rotation from the canvas:
  - **Handle placement**: One **top-left** green control (`RotationHandle` in `diagram-node.tsx`), same visual system as connect / resize / corner-radius (`globals.css` `.dw-rotation-*`), inside the node’s rotated box so it stays fixed like other helpers
  - **Visual Feedback**: `CanvasRotationOverlay` draws only the **angle HUD** (ticks + readout) while dragging, in screen space
  - **Drag-to-Rotate**: Drag vertically to rotate (up increases, down decreases); pointer capture on handle
  - **Snap**: Default **5°** steps; hold **Shift** for **45°** steps only (HUD switches to coarse 45° dial + “45° snap” hint; keyboard Shift toggles mid-drag without moving the pointer)
  - **Dial**: **90°** cardinals (0/90/180/270) strongest ticks; **45°** diagonals next; other **5°** ticks subtle
  - **Multi-Select**: Handle targets the hovered selected item when applicable
  - **Files**: `rotation-handle.tsx`, `canvas-rotation-overlay.tsx`, `editor-canvas.tsx`, `diagram-node.tsx`
- **Label Node Styling** (2025-12): Enhanced label nodes with styling controls matching groups/zones:
  - **Height Fix**: Label nodes now have horizontal height matching text exactly (removed vertical padding)
  - **Labelbox Unchanged**: Labelbox nodes maintain their padding and styling
  - **Height Calculation**: Label nodes calculate height as `lines * lineHeight` (20px) with no base padding
  - **Styling Controls**: Added comprehensive styling toolbar controls for label/textbox nodes:
    - **Border Style**: None, Solid, or Gradient options
    - **Border Color**: Color picker supporting solid or gradient (2 colors)
    - **Background Style**: None, Solid, or Gradient options
    - **Background Color**: Color picker supporting solid or gradient (2 colors)
    - **Text Color**: Color picker for text color
    - **Shadow Toggle**: Enable/disable shadow effect
  - **Rendering**: Updated label/textbox rendering to support gradient borders/backgrounds and shadow
  - **Type Updates**: Added `borderStyle`, `borderColors`, `backgroundStyle`, `backgroundColors`, and `shadow` to `DiagramNodeData`
  - **Visual Consistency**: Label/textbox nodes now have same styling capabilities as groups/zones
  - **Implementation**: Uses IIFE pattern in rendering to extract styling variables, supports gradient borders via `borderImage`, gradient backgrounds via `linear-gradient`
 - **Toolbar UI Improvements** (2025-12): Refined toolbar display and controls:
   - **Selected Item Label Display**: Toolbar now shows the label/name of selected node/group instead of just "Selected: node/group"
   - **Connection Display**: Selected connections show as "Connection {from} → {to}"
   - **Control Hiding**: Hidden unnecessary controls for text type nodes:
     - **Text Position**: Hidden for text/textbox/label nodes (only applies to shape nodes)
     - **Edge Position**: Hidden for text/textbox/label nodes (only applies to icon/resource nodes in groups)
     - **Size Mode**: Hidden for text/textbox/label nodes (size is auto-calculated)
   - **Context Awareness**: Controls dynamically show/hide based on selected item type
   - **Type Detection**: Added `isTextTypeNode` helper to identify all text-related node types
   - **Cleaner UI**: Removed redundant controls, making toolbar more focused and intuitive
 - **Corner Resize Handles** (2025-12): Added bottom-right corner resize handles for groups, zones, and shapes:
   - **Dual-Dimension Resize**: Corner handle allows simultaneous width and height adjustment when dragging
   - **Visual Feedback**: Corner handle uses `cursor-nwse-resize` and `hover:bg-primary/30` for clear indication
   - **Implementation**: Added `'bottom-right'` to resize handle types in both `DiagramGroup` and `DiagramNode` components
   - **Consistent Behavior**: Corner resize maintains minimum size constraints and grid snapping like edge handles
   - **Handle Size**: Corner handle is 4x4 pixels (larger than 2px edge handles) for easier grabbing
   - **Applies To**: Groups, zones, textboxes, text nodes (in custom mode), and all shape nodes (except points)
 - **Multi-Select Functionality** (2025-11-10): Added comprehensive multi-select and group movement capabilities:
   - **Shift+Click Selection**: Hold shift and click on elements to add/remove them from selection
   - **Visual Highlighting**: All selected elements show a blue ring highlight for clear visual feedback
   - **Group Movement**: Drag multiple selected elements together while maintaining their relative spacing and positions
   - **Visual Feedback During Drag**:
     - Drag position indicator shows count of selected items: "X: 100 Y: 200 (3 items)"
     - Blue dots show positions of all selected items during multi-drag operations
     - Real-time position updates for all selected elements during drag
   - **Top Menu Bar Display**: Shows selection count in the interface:
     - Single selection: "Selected: Item Name" or "Selected: Connection from → to"
     - Multi-selection: "3 items selected" (shows actual count)
   - **Keyboard Support**: Press Escape key to clear multi-selection and return to single-select mode
   - **Batch Movement System**: Implemented `moveMultipleItems` function for efficient simultaneous updates:
     - Maintains relative spacing between all selected items
     - Applies grid snapping to all elements during movement
     - Handles re-parenting (moving items between groups) for multiple items at once
     - Preserves all existing functionality while adding multi-select capabilities
   - **Component Updates**:
     - **DiagramNode**: Added `isMultiSelected` prop with blue ring styling
     - **DiagramGroup**: Added `isMultiSelected` prop with blue ring styling
     - **EditorCanvas**: Enhanced drag-and-drop system to track and move multiple items
     - **TopMenuBar**: Added selection count display logic
     - **DiagramEditor**: Enhanced selection state management with `selectedItemIds` Set
   - **Technical Implementation**:
     - Uses React Set for efficient selection tracking
     - Maintains backward compatibility with single-select operations
     - Preserves all existing drag-drop, connection, and grouping features
     - Implements proper cleanup and state management for multi-drag operations
- **Text Styling System Enhancement** (2025-01-XX): Fixed text justification and vertical positioning for textboxes and shapes:
  - **Text Justification**: Horizontal text alignment (left, center, right, full) now works correctly for both textboxes and shapes:
    - **Textboxes**: Text justification classes applied to text elements with full width (`w-full`) for proper alignment
    - **Shapes**: Text justification works for text inside shapes (when `textVerticalPosition === 'middle'`) and outside shapes (when `textVerticalPosition === 'top'` or `'bottom'`)
    - **Implementation**: Uses `getTextJustifyClass()` helper function that returns Tailwind classes (`text-left`, `text-center`, `text-right`, `text-justify`)
    - **Text Elements**: All text elements use `display: 'block'` and `w-full` to ensure text-align CSS properties work correctly
  - **Vertical Position Control**: Vertical text positioning (top, middle, bottom) now works correctly:
    - **Textboxes**: Uses flexbox with `flex-col` and `items-start/center/end` for container alignment, plus inner wrapper with `justify-start/center/end` for content positioning
    - **Shapes**: `textVerticalPosition` controls both inside/outside placement AND vertical alignment:
      - `textVerticalPosition: "top"` → Text appears OUTSIDE above the shape
      - `textVerticalPosition: "bottom"` → Text appears OUTSIDE below the shape
      - `textVerticalPosition: "middle"` → Text appears INSIDE the shape (vertically centered)
    - **Helper Functions**: 
      - `getVerticalPositionClass()`: Returns `items-start/center/end` for flex container alignment
      - `getVerticalJustifyClass()`: Returns `justify-start/center/end` for content positioning within flex containers
  - **Shape Text Positioning**: Text outside shapes is absolutely positioned to prevent shape movement:
    - **Text Above**: Positioned absolutely with negative `top` offset, doesn't affect shape position
    - **Text Below**: Positioned absolutely with positive `top` offset (shape height + spacing), doesn't affect shape position
    - **Container**: Shape container uses `relative` positioning to allow absolute positioning of outside text
    - **Result**: Shape position remains stable when changing `textVerticalPosition` between top, middle, and bottom
  - **Text Outside Shapes**: Horizontal text justification works correctly for text above/below shapes:
    - **Removed `justify-center`**: Flex containers no longer use `justify-center` which was overriding text-align
    - **Block Display**: Text elements use `display: 'block'` to ensure text-align CSS properties work
    - **Full Width**: Text elements use `w-full` to fill container width for proper alignment
  - **Implementation Details**:
    - **Textbox Structure**: Container (`flex flex-col`) → Inner wrapper (`flex flex-col` with `justify-*`) → Text element (with `text-*` classes)
    - **Shape Inside Text**: Container (`flex flex-col` with `items-*`) → Inner wrapper (`flex flex-col` with `justify-*`) → Text element (with `text-*` classes)
    - **Shape Outside Text**: Absolutely positioned divs with proper width matching shape width
    - **All Shape Types**: Applied to square, circle, point, rectangle, triangle, star, and cloud shapes
  - **Backward Compatibility**: 
    - `textPosition` property still works (`'above'`, `'center'`, `'under'`) for explicit control
    - `textVerticalPosition` takes precedence when set, providing unified control over text placement
   - **Benefits**: 
     - Consistent text styling across all node types (textboxes, shapes, labels)
     - Proper vertical and horizontal alignment working as expected
     - Shape positions remain stable regardless of text placement
     - Full control over text positioning with intuitive property names
 - **Selection Box Multi-Select** (2025-11-14): Added drag-to-select functionality for selecting multiple items with selection rectangle:
   - **Selection Box Drawing**: Click and drag on empty canvas to draw selection rectangle
   - **Visual Feedback**: Blue dashed rectangle shows selection area while dragging
   - **Multi-Select Logic**: All items completely within selection rectangle are selected
   - **Primary Selection**: First item found becomes primary selected item (highlighted differently)
   - **Batch Selection**: Additional items are added to multi-selection with blue ring highlights
   - **Coordinate System**: Selection works correctly with zoom/pan transformations
   - **Canvas Click Prevention**: Fixed issue where canvas click would clear selection immediately after selection box completion
   - **Atomic Selection**: Implemented batch selection system to avoid React state timing issues
   - **Implementation Details**:
     - **Mouse Events**: Enhanced `handleMouseDown`, `handleMouseMove`, and `handleMouseUpOrLeave` for selection box
     - **Coordinate Conversion**: Proper transformation between screen space and diagram space coordinates
     - **Item Detection**: Accurate containment checking for both nodes and groups within selection rectangle
     - **State Management**: Added `justCompletedSelection` flag to prevent selection clearing
     - **Batch Function**: New `handleBatchSelect` function for atomic multi-item selection
     - **Type Safety**: Proper TypeScript typing with `as const` assertions for `itemType` properties
   - **Integration**: Works seamlessly with existing shift-click multi-select functionality
   - **Performance**: Efficient selection detection with early exit conditions
   - **User Experience**: Intuitive drag-to-select behavior matching professional diagram tools
   - **Files Modified**:
     - `src/components/editor/editor-canvas.tsx` - Selection box drawing and item detection
     - `src/components/diagram-editor.tsx` - Batch selection state management
   - **Benefits**: 
     - Professional drag-select functionality matching industry standards
     - Efficient multi-item selection for large diagrams
     - Maintains all existing selection features (shift-click, individual selection)
     - Robust coordinate handling with zoom/pan support
     - Clean state management without timing issues

### Development Tools
- **Scripts**: npm run dev, build, lint, typecheck, genkit
- **Launch Script**: `launch.sh` for macOS with dependency checks and server startup
- **Documentation**: WARP.md for architecture, blueprint.md for design specs
- **Testing**: TypeScript compilation and linting integrated

### Zone System Refactoring (2025-11-14)
- **Complete Terminology Migration**: Successfully removed all 'group' references and replaced with 'zone' throughout entire codebase
- **Type System Updates**: Updated `DiagramData` interface to use `zones` array instead of `groups`, updated `SelectedItem` type to use `itemType: 'zone'`
- **Function and Variable Renaming**: Systematically renamed all functions, variables, and properties:
  - `layoutGroup` → `layoutZone`
  - `redistributeItemsInCustomGroup` → `redistributeItemsInCustomZone`
  - `setAbsolutePositions` → `setAbsolutePositionsForZone`
  - `handleGroupClick` → `handleZoneClick`
  - `handleGroupRightClick` → `handleZoneRightClick`
  - `groupsById` → `zonesById`
  - `currentGroup` → `currentZone`
  - `newGroup` → `newZone`
  - `childGroup` → `childZone`
- **Property Updates**: `diagramData.groups` → `diagramData.zones`, `GROUP_PADDING` → `ZONE_PADDING`, etc.
- **Logic and Rendering**: Fixed all `itemType === 'group'` comparisons to `itemType === 'zone'`, updated zone rendering logic
- **Build Status**: Application builds successfully with no TypeScript compilation errors
- **Zone Functionality**: 
  - Drag & Drop "Zone" from resource panel creates container zones (not icons)
  - JSON files with `zones` array load correctly
  - Zones render as dashed containers with proper styling
  - Child items can be placed inside zones with full hierarchy support
  - Zone styling (borders, colors, sizing) works properly
- **Files Modified**: 
  - `src/lib/types.ts` - Updated DiagramData interface
  - `src/components/diagram-editor.tsx` - Updated SelectedItem type and all references
  - `src/components/editor/editor-canvas.tsx` - Major refactoring of layout and rendering logic
  - `src/components/editor/component-sidebar.tsx` - Updated all zone references
  - `src/components/editor/context-toolbar.tsx` - Fixed zone handling
  - `src/lib/nested-hierarchy.ts` - Updated hierarchy processing
  - `src/lib/pure-hierarchy.ts` - Updated pure hierarchy logic
  - All test files and hierarchy utilities updated consistently
- **Benefits**: 
  - Consistent terminology throughout codebase eliminates confusion
  - Proper zone functionality working as intended
  - Users can successfully create container zones that hold child items
  - Clean, maintainable code with unified naming conventions

### Kite Shape Fix (2026-02-24) – Implemented
All phases from `docs/KITE-SHAPE-FIX-PLAN.md` implemented. (1) **Resize**: Kite locks to square in diagram-node handleResizeMove and canvas-operations resizeNode/resizeMultipleNodes. (2) **Connectors**: shape-connection-bounds.ts adds getKiteEdgePath, getKiteConnectionPoint, getKiteEdgeAngleAtT, isKiteShapeType; bezier-connection uses kite parametric placement (t = (index+1)/(total+1)) and edge-aligned angles; calculateBezierPath/calculateBezierControlPoints support arbitrary angles via angleToUnitVector. (3) **Mermaid**: diamond nodes get square dims (max×3). (4) **SVG**: KiteShape passes preserveAspectRatio="xMidYMid meet" to SvgShapeBase. (5) **Text wrapping**: ShapeText constrains kite label container to max-w-[70%] so text wraps at spaces within the diamond (uses break-words, whitespace-pre-wrap).

### Next Steps for Future Development
- Add export formats (PNG, SVG, PDF)
- Enhance mobile experience
- Integrate more providers and update resource counts
- Optimize performance for large diagrams

### 2025-02-12 – Canvas Responsiveness Optimization Plan
Created `docs/CANVAS-RESPONSIVENESS-PLAN.md` – a detailed, step-by-step plan for improving editor responsiveness. Each of 12 optimizations is documented with:
- Implementation steps and file/line references
- Before/after measurement instructions (React DevTools Profiler, Performance tab, manual feel tests)
- Validation checklists
- Status checkboxes (implement one by one, measure individually)
Baseline measurement and a measurement log template are included. Recommended order: 1 (debounce label) → 2 (throttle drag) → 4 (stable callbacks) → 3 (memo DiagramNode) → 5–7 (memo connections) → 8–12.

### Editor Canvas Refactoring (2025-11-15)
Successfully refactored `editor-canvas.tsx` from ~4100 lines to **513 lines** (87.5% reduction).

**Created Files:**
- `src/components/editor/canvas-constants.ts` (127 lines) - Constants & utilities
- `src/components/editor/canvas-layout-utils.ts` (587 lines) - Layout calculations  
- `src/hooks/use-canvas-transform.ts` (118 lines) - Pan & zoom
- `src/hooks/use-canvas-selection.ts` (279 lines) - Selection logic
- `src/hooks/use-canvas-interactions.ts` (120 lines) - Panning & touch
- `src/hooks/use-canvas-clipboard.ts` (314 lines) - Copy/paste
- `src/hooks/use-canvas-export.ts` (143 lines) - PNG export
- `src/hooks/use-canvas-context-menu.ts` (57 lines) - Right-click menu
- `src/hooks/use-canvas-drag-drop.ts` (316 lines) - Drag & drop

**Minor Issues (6 linter errors):**
- Component prop types need updating for: DiagramZone, DiagramNode, CanvasConnections, CanvasArrowToggles, CanvasConnectionText, ContextMenu
- These are TypeScript type definition issues only, functionality is intact

See `REFACTORING_SUMMARY.md` for complete details.

### Palette Copy/Paste from Sidebar (2025-11-17)
- Added a palette-aware copy/paste flow that reuses the existing drag-and-drop addNode logic:
  - Clicking a resource in the left sidebar marks it as the active palette selection (no behavior change for drag).
  - Using **Edit → Copy** while a sidebar resource is selected copies a palette item (derived from the same type/label logic as drag) into a separate clipboard.
  - Using **Edit → Paste** first checks this palette clipboard: if present, it pastes a new instance of that resource onto the canvas at the viewport center using `operations.addNode`; otherwise it falls back to the existing canvas clipboard paste.
  - Double-clicking a sidebar resource now immediately pastes a new instance of that item onto the canvas and updates the palette clipboard.
- Implementation details:
  - `DraggableResourceItem` gained optional click/double-click hooks; drag behavior is unchanged.
  - `ResourceBrowser` forwards clicks/double-clicks up via `onResourceSelect`/`onResourceActivate`.
  - `ComponentSidebar` forwards these to `DiagramEditor`.
  - `DiagramEditor` tracks `selectedResource` and a `paletteClipboardItem` and extends the `TopMenuBar` copy/paste handlers to use them.
  - `EditorCanvas` exposes a new `pastePaletteItem(item)` imperative handle that uses the same `useCanvasOperations().addNode` path as drag-and-drop to ensure identical default values.
- Notes:
  - Existing canvas copy/paste (for nodes/zones) and keyboard shortcuts remain unchanged.
  - `npm run typecheck` currently fails due to pre-existing issues in `src/components/editor/text-styling-panel.tsx` and `src/lib/group-hierarchy.ts`; those files were not modified as part of this change.
- **Drag and Drop Visuals** (2025-11-29): Updated drag and drop behavior to move the original item instead of a ghost preview:
  - **Visual Feedback**: The original item now moves on the canvas during drag, providing a more direct manipulation feel.
  - **Ghost Hiding**: Suppressed the default HTML5 drag ghost image using `getEmptyImage()` from `react-dnd-html5-backend`.
  - **State Management**: Dragging updates a temporary visual state (`dragPosition`) without committing to the main `diagramData` history, preventing undo/redo stack pollution during the drag operation.
  - **History Update**: Undo/redo history is only updated once the drag is completed (on drop).
  - **Files Modified**: `src/components/editor/editor-canvas.tsx`, `src/components/diagram/diagram-node.tsx`, `src/components/diagram/diagram-zone.tsx`.
|- **Real-Time Connection Line Updates During Drag** (2025-11-29): Enhanced drag and drop to update connection lines dynamically as items are dragged:
|  - **Display Position Overrides**: Created `displayNodesById` and `displayZonesById` lookup maps that override item positions with temporary drag positions during drag operations.
|  - **Live Connection Updates**: Connection rendering components (`CanvasConnections`, `CanvasArrowToggles`, `CanvasConnectionText`) receive the display position maps and update connection lines in real-time.
|  - **Multi-Item Support**: Both single-item drag (`dragPosition`) and multi-item drag (`multiDragPositions`) update connection lines for all dragged items simultaneously.
|  - **No Data Mutations**: Visual updates happen without modifying the underlying `diagramData`, maintaining clean undo/redo history.
|  - **Hook Reordering Fix**: Resolved React hook dependency errors by reordering hooks in `editor-canvas.tsx` to ensure display maps are calculated before being passed to connection components.
|  - **Animation Integration**: Display maps layer on top of animation offsets (`animatedNodesById`, `animatedZonesById`) for smooth visual feedback.
|  - **Implementation**: The drag-drop hook (`useCanvasDragDrop`) tracks temporary positions, which are then merged into display lookup maps used by all rendering components.
|  - **Files Modified**: `src/components/editor/editor-canvas.tsx` (display map creation and prop passing to connection components).
|- **Debug Log Cleanup** (2025-11-29): Removed verbose debug console.log statements from JSON editor:
|  - **Cleaned Output**: Removed repetitive "Has both nodes and zones at root - flat format" and similar messages that cluttered browser console.
|  - **Affected Functions**: Cleaned up `isNestedFormat()` and `handleSubmit()` in `json-editor-panel.tsx`.
|  - **Functionality Preserved**: All validation and format detection logic remains intact, only removed logging.
  - **Files Modified**: `src/components/editor/json-editor-panel.tsx`.
- **Auto Layout Feature** (2025-11-29): Added a new "Auto Layout" feature to automatically arrange diagram items:
  - **Algorithm**: Implemented a hierarchical layered layout (Sugiyama-style) that:
    - Processes the diagram bottom-up (zones first).
    - Assigns ranks/layers to nodes based on dependencies (connections).
    - Minimizes edge crossings using barycenter heuristic.
    - Assigns X/Y coordinates with uniform spacing.
    - Handles disconnected components by packing them.
  - **UI**: Added "Layout" menu with "Auto Layout" item and keyboard shortcut `Ctrl+Shift+L`.
  - **Zone Preservation**: Modified algorithm to preserve zone sizes and internal layouts. Zones are treated as rigid blocks during auto-layout, with their dimensions calculated from current content.
  - **Grouping Support**: Enhanced algorithm to treat groupings as single units. Items within a grouping move together as a block, preserving their relative arrangement.
  - **Implementation**: Created `src/lib/auto-layout.ts` engine and updated `canvas-layout-utils.ts` to support freeform layout inside zones.
  - **Layout Refinement**:
    - **Randomness**: Added randomness to item processing, neighbor traversal, and initial layer ordering to ensure different layouts on repeated calls.
    - **Horizontal Flow**: Switched to Left-to-Right main flow (ranks on X axis, items on Y) for better screen utilization.
    - **Component Packing**: Implemented a 2D shelf-packing algorithm to arrange disconnected components into a roughly 1.5:1 aspect ratio box instead of a single wide row.
