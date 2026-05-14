# MEMORY.MD

Reverse-dated changelog: **newer entries are closer to the top**. For **current product behavior and file layout**, use **`README.md`**, **`AGENTS.md`**, and **`docs/functional.md`**. Entries here are historical; where an older note disagrees with a newer one, **trust the newer dated line**.


### 2026-05-14 – Duplicate slide: independent chain snapshots

Default presentation decks use **`presentationDeltaMode: 'chain'`**. **Duplicate slide** (**`capturePresentationSlidePayload`**) computed **`computeDiagramDelta(prevBase, current)`** when the canvas matched cumulative state, producing an **empty delta**. Consecutive identity steps keep the same cumulative diagram, so editing one duplicate updated what every later “copy” showed. **Fix**: if chain mode and **`diagramDelta.operations`** is empty after capture, persist a **root `replace`** with **`safeClone(topologyCurrent)`** so each duplicate freezes its own topology. Existing decks with stacked empty duplicates may need re-duplicating affected slides. Patch bumped.


### 2026-05-14 – Shape label text justification (rich runs)

**`applyTextStylingToNode`** (**`text-styling.ts`**) now strips **`lineJustify`** from **`richLabel`** when **`textJustify`** changes for **any** node with rich text (not only **`generic.text.text` / `generic.text.textbox`**). Shape labels use **`TextboxRichDisplay`**, which prefers **`run.lineJustify`** over **`node.textJustify`**; runs kept **`center`** from the contenteditable HTML, so left/right in the Text styling panel had no effect. Same clear applied to **`richHeadingLabel`** when **`textJustify`** changes. Patch bumped.


### 2026-05-13 – Mind map: add child without moving existing nodes
Context menu on a mind-map node (**single selection**): second action **Add mind map node without moving others** — same new node placement offset as before, but skips **`layoutMindmapChildrenAroundParent`** so sibling **x/y** stay fixed; **`finalizeMindmapTreeAttachPreserveSiblingPositions`** (**`mindmap-layout.ts`**) syncs polar fields for the new child only + **`recomputeMindmapMetadata`**. Original **Add mind map node** still rebalances the radial fan. **`attachMindmapTreeChild`** accepts optional **`{ relayoutSiblings?: boolean }`** (default **`true`**); pair-connect keeps full relayout. **`context-menu`** / **`editor-canvas`**.


### 2026-05-13 – Optional diagram canvas background colour

**`DiagramData.canvasBackgroundColor`** (optional CSS colour string) is validated in **`DiagramDataSchema`**, preserved on flatten/hierarchical import (**`flatten-on-import`**, **`nested-hierarchy`**). **Edit → Canvas background…** opens **`canvas-background-dialog`** (Colour picker + “Use theme default” / Apply); updates use **`onCurrentDiagramDataUpdate`** (per root/sub‑diagram). **`EditorCanvas`** and **`ViewerCanvas`** apply it on the viewport container (`bg-background` when unset). **Presentation** fullscreen shell uses the same colour for letterboxing (**`presentation-player`**). Patch bumped.


### 2026-05-13 – Editor modals: compact consistent title bar

Shared chrome for draggable editor panels (**`visual-styling-panel`**, **`text-styling-panel`**, **`line-styling-panel`**, **`chart-data-editor-modal`**, **`timeline-bar-editor-modal`** header + footer, **`uml-class-editor-modal`**, **`z-order-list-modal`**): **`border-b`** row **`px-4 py-2.5`**; lead icon **`h-4 w-4 text-primary`**; title **`text-sm font-semibold text-foreground truncate`**; close **`Button` `h-8 w-8`**. Matches existing **`connection-context-modal`** density. Patch bumped.


### 2026-05-13 – Timeline bar modal: collapsible axis + sections

**`timeline-bar-editor-modal`**: **Timeline axis** teal block wraps body in **`Collapsible`** (chevron on the title row); **>**2 axis rows → **opened collapsed** (**`axisSectionOpen`**). Each **colour segment** is a **`Collapsible`** with header (**chevron + summary**: label · fill style · span % or weight) and **Trash** on the header; **`collapsedSegIds`** (Set of section **`id`**s); opening the modal with **>**2 sections initializes **all segments collapsed**. New row from **Add section** removes its id from the set (**expanded**). Patch bumped.


### 2026-05-13 – Timeline bar modal: axis Pos % layout

**`timeline-bar-editor-modal`**: timeline axis rows use a **fixed 3-column grid** (**`minmax(0,1fr)` / `≥5.75rem` / `2rem`**) so the label field **`min-w-0`** shrinks cleanly; **Pos %** uses a stacked **Label** + **`tabular-nums`** input with **`w-full`** in its column (no cramped inline “Pos % | field”), **spin buttons hidden** to save width. Patch bumped.

### 2026-05-13 – Timeline bar sections modal: Visual-styling parity

**`timeline-bar-editor-modal`**: shell **`rounded-lg`**, **`max-w-[calc(100vw-2rem)]`**; header **`px-5 py-4`**, **`AlignHorizontalSpaceAround`** **`h-5 w-5 text-primary`**, title **`text-base font-semibold text-foreground`**, close **`h-9 w-9`**. Body **`p-5 space-y-4`**. Axis block: **`dark:bg-background dark:border-border`**, teal tint kept in light; section title **`text-foreground`** + teal dot; **`p-3`**. Span switch / section rows / dashed placeholder **`dark:bg-background`**; rows **`dark:border-border`**, **`p-3`**. Footer **`px-5 py-4`**. Patch bumped.

### 2026-05-13 – Chart Data modal: dark wells + header parity with Visual Styling

**`chart-data-editor-modal`**: **`ChartModalSection`** tint boxes use **`dark:bg-background`** / **`dark:border-border`** (same pattern as Visual styling). Sortable pie/bar segment rows **`dark:bg-background`**. Panel **`rounded-lg`**, header **`px-5 py-4`**, title **`text-base font-semibold`**, **`BarChart2`** **`h-5 w-5`**, close **`h-9 w-9`**, body **`p-5 space-y-4`**, **`max-w-[calc(100vw-2rem)]`** on shell. Patch bumped.

### 2026-05-13 – Line Styling modal header + semantic text colours

**`line-styling-panel`**: title uses **`text-foreground`** (**`text-base font-semibold`**) like Text/Visual modals; header **`px-5 py-4`**, **`Min`** icon **`w-5 h-5`**, close **`h-9 w-9`**. Replaced hardcoded **`text-slate-*`** on labels with **`text-foreground`** / **`text-muted-foreground`**. Content **`p-5`**, section wells **`p-3`**. Patch bumped.

**`visual-styling-panel`**, **`text-styling-panel`** (and **`line-styling-panel`** for parity): pastel **`bg-*-50`** wells and **`bg-muted/50`** now use **`dark:bg-background`** with **`dark:border-border`** so dark-mode sections sit **darker** than **`bg-popover`** (muted was lifting lightness). **`StylingAccordionSection`** applies the same **`dark:`** accents after **`outerClassName`**. Accordion trigger hover: **`dark:hover:bg-muted/40`**. Patch bumped.

Semantic **`text-primary` / text-sidebar-primary** on menu **`svg`**s: **`menubar`** / **`dropdown-menu`** (**`[&>svg]`** on normal rows so nested controls like theme **`Star`** keep their colours; checkbox/radio items keep **`[&_svg]`** for indicators); canvas **`context-menu`** + **`simulation-popup-menu`**; **`select`** (**`SelectTrigger`/`SelectItem`/scroll**) + **`SidebarMenuButton`/`SidebarMenuAction`/`SidebarGroupAction`**. Replaced lingering **`text-blue-600`** header icons → **`text-primary`** in **`connection-context-modal`**, **`chart-data-editor-modal`**, text/line/visual styling panels; **`theme-editor`** selection **`ring-primary`**. **`resource-browser`** cloud brand blues unchanged. Patch bumped.

### 2026-05-13 – Brand style guide refresh (warm paper / charcoal / orange primary)

Applied tokens + typography: **`globals.css`** (`:root`/`.dark` HSL, **`dw-field-shell-*`/`.dw-field-grid-*`**, **`h1`–`h6`** → **`font-headline`**); **`tailwind.config.ts`** (**`fontFamily.headline`** → **Nunito**, Inter body); **`layout.tsx`** (Google Fonts Nunito 400–800). Staging **`temp/`** (copy-in reference) removed after merge. Patch bumped.

### 2026-05-12 – Timeline bar: axis row font size + family (Visual styling)
**`timelineBarAxisLabelFontSize`** / **`timelineBarAxisLabelFontFamily`** on the node; **Visual styling → Timeline bar → Axis row text** (font + optional px size; blank size = auto). Default auto sizing ~**2×** the former axis cap (**`timeline-bar.tsx`**: `autoAxisFs`). Tick band grows with chosen size so labels fit. **`timelineBarMemoPayload`** includes font fields + shape **`fontSize`**/**`fontFamily`** for memo. Patch bumped.

### 2026-05-12 – Timeline bar: axis row distance locked when stretching height
**`gapTick`** / **`tickBand`** no longer grow with **`h`** once the node is tall enough (reference strip from **`VIEWBOX_H`** + min bar height). Extra vertical resize goes into **`barH`** only, so Q1–Q4 (and tick markers) stay the same distance below the coloured bar instead of drifting down. Short nodes still use the old proportional strip so layout doesn’t overflow. **`timeline-bar.tsx`**. Patch bumped.


### 2026-05-12 – Visual styling glow: timeline bar uses shape silhouette pulse
Highlight pulse for **`generic.object.timeline-bar`** no longer forces **`box-shadow` on the node frame** (which looked like a soft blue rectangle behind the node). **`isHighlightPulseShapeSilhouetteType`** in **`utils.ts`** treats timeline bar like progress bar — **`drop-shadow` on the painted SVG** so the glow follows the rounded pill. Patch bumped.

### 2026-05-12 – Palette default: timeline bar (790×150, 8 theme-hue sections, Q1–Q4 axis)
New **`defaultPaletteTimelineBarNodeProps`** (**`timeline-bar.ts`**) — warm gradient shell, section borders, ticks + markers, **10°** hue step, **8×** **S1…S8** **theme-hue** sections, axis **Q1–Q4** at even **t** (12.5 / 37.5 / 62.5 / 87.5). **`canvas-operations`** uses **790×150** (grid-snapped) + that payload; **`shape-type-swap`** into timeline bar matches. Patch bumped.

### 2026-05-12 – Timeline bar axis: revert to linear **t** on full inner width
Axis ticks now use **`half + t * w`** again (same inner `[half, half+w]` as segment layout). The prior **`timelineBarAxisLabelCenterX`** (**flat** span `w − 2·rx`) shifted high-**t** ticks left, so 20/40/60/80% no longer matched equal reference divisions and **Q4→right** looked huge. Rounded corners stay a cosmetic outline; **Pos %** stays linear on the bar’s inner width. Patch bumped.

### 2026-05-12 – Timeline bar modal: “Even spacing” for axis (Q1–Q4)
**Timeline axis** Pos % can leave the last tick near **100%**, so the gap from the last label to the bar end looks tighter than earlier gaps. **`timelineBarEvenAxisPositions`** (**`timeline-bar.ts`**) returns centres of **n** equal slices: e.g. four labels → **12.5 / 37.5 / 62.5 / 87.5**. The editor modal adds an **Even spacing** button (tooltip explains). Patch bumped.

### 2026-05-12 – Timeline bar: section labels wrap + double-click edit
Segment labels render in a **`foreignObject`** (CSS **`word-break`** / **`overflow-wrap`**) so long copy stays inside each segment. **Double-click** a label when the node is **singly selected** in the editor to edit inline (**textarea**; blur or **⌃/⌘+Enter** saves, **Escape** cancels). Section boundary drag strips hidden while a label is being edited. Patch bumped.

### 2026-05-12 – Timeline bar: drag section boundaries (grid snap)
Selected timeline bar (**single selection**, editor): **invisible hit strips** on interior segment boundaries (**col-resize**), pointer capture + **`onPatch({ timelineBarSections })`**. Equal/weighted layout **converts to `spanStart`/`spanEnd`** on first drag. Boundary position snaps to **`snapToGrid`** on **diagram X** (uses **`diagramSnapX`** + rendered bar width). **`onSectionBoundaryDragSessionChange`** ties into **`chartValueDragInteractionRef`** so whole-node drag stays suppressed while resizing. **`timeline-bar.ts`** exports **`timelineBarEnsureSpanSections`**, **`snapTimelineBarBoundaryT`**, **`timelineBarMoveJointAtVisualBoundary`**, etc. Patch bumped.

### 2026-05-12 – Visual styling: theme hue step typing
**`visual-styling-panel`** timeline bar **Theme hue step** uses a text field with commit on blur (not **`type="number"`** with **min**), so the value can be cleared and retyped; empty on blur clears the override (**`null`** → default **36°**). Patch bumped.

### 2026-05-12 – Visual styling: corner radius slider
**`visual-styling-panel`**: **Corner radius** for progress bar, timeline bar, and rounded-rectangle shapes uses a **Slider** (0–100% readout, 0.01 steps) instead of a number input. Patch bumped.

### 2026-05-12 – Timeline bar shape (`generic.object.timeline-bar`)
Segmented horizontal bar (rounded outer clip; square interior edges between sections). Data: **`timelineBarSections`**, optional **`timelineBarAxisLabels`** (independent tick row: **`label`**, **`t`** 0–1), optional **`spanStart`**/**`spanEnd`** per section (0–1; when **all** sections define a valid window, widths use spans instead of **`timelineBarSizing`**), plus **`fill`** / **`fillStyle`**, **`timelineBarHueStepDeg`**, tick row toggles, section dividers. **Theme hue** follows visual order (**`spanStart`** when spans). **Modal** (including axis + span controls); **Visual styling**; Radix outside-click fix. **`shape-type-swap`** strips **`timelineBarAxisLabels`** and **`timelineBarHueStepDeg`** when leaving the shape. Implementation: **`timeline-bar.ts`**, **`timeline-bar.tsx`**, **`timeline-bar-editor-modal.tsx`**. Patch bumped.

### 2026-05-11 – Tab rename: double-click label
**`TabBar`**: double-click a tab title (non-tutorial) to edit inline; **Enter**/blur commits via **`updateTab(..., { name })`**. **`createDiagramSaveHandler`** already derives **`suggestedName`** from **`targetTab.name`**, so Save uses that stem. Wired through **`DiagramEditorInner`** (**`onTabRename`**). Patch bumped.

### 2026-05-09 – Timeline slide diff: exit ghosts + enter only new cards
When **`timelinePresentationSignature`** changes between slides but the timeline **node id** stays, **`computeTimelineCardTransitionStylePatch`** diffs **`timelineEntries`**: **removed** ids render as **`timelineRemovedCards`** (layout from prev slide, shifted by node **x/y** delta) with **`timelineRemoveStagger`**; **new** ids get **`timelineSlideStagger`** + **`timelineEnterStaggerOrder`**; **stable** cards skip enter pop. Tail = **max(enter, exit)** stagger. **`timelineSlideRemovedCardPayloads`** (**`timeline-layout.ts`**). Whole-timeline appear/disappear unchanged. Patch bumped.

### 2026-05-09 – Timeline play transition: cards grow/shrink + fade (staggered)
**`timelineEntryPopKeyframesCss` / `timelineEntryPopAnimationStyle`** (**`chart-presentation-stagger.ts`**) replace opacity-only chart pop on timeline HTML cards: sequential **`scale(0.82)↔1`** with **fade in/out**, **`transformOrigin: center`**. **`diagram-node`** wires the new keyframes. Patch bumped.

### 2026-05-09 – Timeline entry edit: rich-text toolbar visible (overflow)
Per-entry **`TextboxRichEditor`** overlay used **`overflow-hidden`**, which clipped the floating formatting bar (**`absolute bottom-full`** above the contenteditable — textbox/shape editing wrappers use **`overflow-visible`**). Overlay **`overflow-visible`**; **`onVerticalAlignChange`** matches Mindmap/card wiring. Patch bumped.

### 2026-05-09 – Timeline card context menu: ignore non-primary pointer-down drag session
**`handleTimelineEntryPointerDown`** attached document **`pointerup`** for every button; on **right‑click**, release in **`pending`** ran the same path as a left **tap** (**`handleTimelineCardTap`** → **`handleNodeClick`** → **`closeContextMenu`**), so the node menu flashed closed. **Guard `e.button !== 0`** before **`preventDefault`** / listeners so secondary button uses **`onContextMenu`** only. Patch bumped.

### 2026-05-09 – Timeline HTML cards: pass-through shape shell (restore drag / resize / properties)
The **`renderShape()`** wrapper (**`flex items-start justify-start`**) used default **`pointer-events: auto`** with **`w-full h-full`**, so it sat above the **`MindmapNodeShape`** card siblings in hit-testing and ate **`pointerdown` / click / context menu** (no selection → toolbar/properties dead; resize rails never targeted). For **`isTimelineNode`** that wrapper is **`pointer-events-none`**; spine stays interactive via **`TimelineShape`**’s inner **`<svg style={{ pointerEvents: 'auto' }}>`** and stroke hit path (same idea as **`LineShape`**). Card wrappers use **`pointer-events-auto`**. Patch bumped.

### 2026-05-09 – Timeline cards: same **`ShapeWrapper`** stack as palette shapes (no SVG/`foreignObject` hull)
**`TimelineShape`** draws **spine + section ticks + connector stems/dots** only. Each row’s hull + **`ShapeText`** render as **`MindmapNodeShape`** siblings inside **`diagram-node`** (**`absolute`** bounds via **`timelineEntryOverlayBoundsRelativeToNodeContainer`**), matching rectangles/composites (**SVG fill + frosted + gradients + tags/text tooling**). **`buildSyntheticTimelineEntryCardNode`** (**`timeline-styling.ts`**) merges visual (including **theme-hues**) + **`mergedTimelineEntryTextDisplayNode`**. Card **`pointerdown` / click / context menu** wire like prior **`CompositeCardSilhouette`**. Patch bumped.

### 2026-05-09 – Timeline: spine junction dot above connector stem
**`TimelineShape`** draws the entry stem **`<line>`** before the anchor **`<circle>`** so the dot sits on top of the stem (SVG paint order); spine path still precedes entry groups. Patch bumped.

### 2026-05-09 – Context menu hook + timeline card text placement
**`useCanvasContextMenu`** removed the **`document` `click`** listener that called **`closeContextMenu()` on every click** (no target filter)—menus vanished instantly after open (e.g. timeline card right‑click). **`ContextMenu`** already handles outside dismiss (**`mousedown`**, Escape, canvas capture **`click`**). **Timeline** card **`<text>`** now respects **`textJustify`** / **`textVerticalPosition`** from **`extractTextStylingFromNode`** like rectangle styling (**`full`** → centered). Patch bumped.

### 2026-05-09 – Timeline selected cards: hit-through resize overlay (drag + context menu)
Per-card **`ResizeHandles`** sat in a **`pointer-events-auto`** full-size wrapper over the card, stealing **`pointerdown`** / **`contextmenu`** from **`CompositeCardSilhouette`**. Wrapper is **`pointer-events-none`** so the SVG receives body hits again (drag along spine + perpendicular offset); rails pass **`className="pointer-events-auto"`** on **`ResizeHandles`** so edges stay draggable for resize. Patch bumped.

### 2026-05-09 – Timeline card drag vs react-dnd whole-node move
**`mousedown`** on a timeline card bubbles to the **`useDrag`** wrapper while **`suppressTimelineCanvasDragRef`** was unset (`pointerdown` ran first but **HTML5** backend starts on **mouse**). **`canDrag`** now requires **`!suppressTimelineCanvasDragRef.current`**; the ref is set for card **`pointerdown`** / cleared in **`onUp` `finally`**, and set when starting **per-card resize** / cleared in resize **`finish` `finally`** + effect cleanup. **`preventDefault`** on card **`pointerdown`** added. Patch bumped.

### 2026-05-09 – Timeline: line-like outer box + per-card resize rails
Removed **outer** **`ResizeHandles`** on **`generic.object.timeline`** (restore **no green hull** on the bbox like connector lines). **Selected timeline cards** (`timelineSelectedEntryIds`) get **`ResizeHandles`** positioned with **`timelineEntryOverlayBoundsRelativeToNodeContainer`** on **`timelineNodeWithLiveCardDims`** (live preview during drag); **`pointerup`** writes **`timelineEntries[].width` / `height`** via **`onUpdate`**. Document **`computeTimelineCardResizeDims`** mirrors edge/corner + Shift-proportional rules; **`timelineEntryResizeNodeRef`** supplies fresh node data on commit. **`Popover`** also gated by **`!isResizingTimelineEntry`**. Patch bumped.

### 2026-05-09 – Timeline cards: canvas selection, multi-card Shift, resize handles
Card **`pointerdown`** no longer **`preventDefault`s immediately** (that suppressed **`click`**, so the timeline **node** never became **`selectedItem`**). **Pending vs drag** uses **`TIMELINE_CARD_DRAG_THRESHOLD_PX`** (~5px): tiny movement → **`handleTimelineCardTap`** on pointer-up (select node + entry keys; **Shift/Ctrl/Meta** toggles multi-card keys and adds the timeline to **`selectedItemIds`** only when it was not already selected—avoids shift-toggle removing the sole selected timeline). Drag beyond threshold commits **`manual`** spine geometry as before; **`timelineCardClickSuppressRef`** drops duplicate **`click`** after tap/drag. **`EditorCanvas`** builds **`timelineSelectedEntryIdsByNodeId`** from **`parseTimelineEntryKey`** for **`TimelineShape.selectedEntryIds`**. **`onTimelineEntrySelect`** wrapper passes **`additive`**. Patch bumped.

### 2026-05-09 – Timeline: selection key helpers + canvas callback wiring
**`timeline-layout.ts`** exports **`TIMELINE_ENTRY_KEY_SEP`**, **`makeTimelineEntryKey`**, **`parseTimelineEntryKey`**, and **`lastTimelineEntryIdOnNodeFromOrderedKeys`** (multi-select / context **Remove card** uses the last key for that node). **`editor-canvas`**: **`DiagramNode`** gets **`onTimelineEntrySelect={(entryId) => …(node.id, entryId)}`**; removed unused **`timelineEntrySelection`** prop from **`DiagramNode`** (selection set stays on **`EditorCanvas`** for menus). Patch bumped.

### 2026-05-09 – Timeline card drag: no stray “debug” UI / stuck drag flag
**`handleTimelineEntryPointerDown`** called **`onDraggingChange(true)`** **before** validating **`entryId`**; a failed lookup returned early and left **history** /**drag** tracking stuck. **Info** **`Popover`** could also open during card repositioning. **Fix**: validate **`idx`** **first**; **`timelineCardInteractionActive`** gates **`Popover`** while dragging a card; **`setTimelineCardInteractionActive(false)`** on pointer up/cancel. **`useLayoutEffect`** for **`preview(getEmptyImage())`** so the browser is less likely to show a native drag ghost with SVG **entry** label text. Patch bumped.

### 2026-05-09 – Timeline / spine selection: click-through no longer clears selection
Spine-like nodes (**connector lines**, **timeline**) use **`pointer-events: none`** on the outer shell with hits on inner SVG/cards. Clicks on **padding** inside the Popover trigger still bubbled to **`editor-canvas`** and ran **empty-canvas** selection clear → flicker/jump, no stable selection, **LineVertexHandles** and context **toolbar** never stayed active. **`diagram-node`**: **`onClick`** on the Popover trigger wrapper for **`spineLikeNode`** stops propagation and forwards **`onClick(node)`**; **`overflow-visible`** on the spine shell; **`LineVertexHandles`** use **`z-[120]`** so endpoints sit above overlapping nodes. Patch bumped.

### 2026-05-09 – Timeline: longer default spine from palette
New **`generic.object.timeline`** drops use **`TIMELINE_DEFAULT_SPINE_LENGTH_PX`** (**280**) for **`endPos.x - startPos.x`** (was 150), matching a roomier default layout; initial **`width`** uses the same value. **`timeline-layout.ts`** exports the constant; **`canvas-operations`** **`addNode`**. Patch bumped.

### 2026-05-09 – Rounded rectangle palette icon: clearer slight corner radius
**`public/resources/generic/object/rounded-rectangle.svg`** and new **`rounded-rectangle.png`** (64×64, from SVG) use **`rx`/`ry` 3** and the same **`4,6` 16×12** frame as the rectangle sidebar glyph; **`ResourceIcon`** **`rounded-rectangle`** case matches. Patch bumped.

### 2026-05-09 – Paste special: **Description** (`info`)
Submenu adds **Description** — copies **`info`** only (popover/bulk description text). **`info` removed** from **Properties** so description is explicit; **Properties** still copies **`metaData`**, **`linkUrl`**, and other non-geometry fields. Patch bumped.

### 2026-05-09 – Paste special **Properties**: metadata + URL
**`applyPropertiesAspect`** (**`paste-special-properties`**) now copies **`metaData`** (deep clone when present on source), **`linkUrl`**, and **`info`** with other property-only fields. Patch bumped.

### 2026-05-09 – Context menu **Paste special** (properties from clipboard)
After a normal **Copy**, **Paste special** (submenu under **Copy**) applies **only** **Size**, **Colour**, **Text**, or **Properties** from the clipboard’s template node onto the **current selection** — **no new objects**, **positions unchanged**. Clipboard template is the **first** copied node when multiple are copied. **Compatibility** is by coarse family (**`paste-special-properties`**: chart kind pie/bar/line, connector line, timeline, mind map, UML class, closed **`generic.object.*`**, palette **Lucide/emoji** icon, vs **resource** icon/label); mismatches are skipped with a toast. Implementation: **`getClipboardTemplateNode`**, **`applyPasteSpecialAspect`**, **`useCanvasClipboard` → `handlePasteSpecial`**, **`ContextMenu`** submenu. Patch bumped.

### 2026-05-09 – Change shape: resize only on point ↔ non-point swap
**`swapDiagramNodeObjectKind`** (**`shape-type-swap`**) sets **`width`** / **`height`** / **`sizeMode: 'custom'`** when swapping **into** or **out of** **`point`**, using the same grid-snapped defaults as palette **`addNode`** (e.g. point **20×20**, square-like **60×60**, rectangle **80×50**). Other swaps (e.g. square ↔ circle) keep the node’s current size. Patch bumped.

### 2026-05-09 – Timeline & mind-map card hull (`compositeBodyShape`)
**`DiagramNodeData.compositeBodyShape`** (**`DiagramCompositeBodyShapeKind`**, mirrored in **`DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS`**) sets the painted card body while **`type`** stays **`generic.object.timeline`** or **`generic.object.mind-map-node`**. Context menu **Change shape** routes through **`swapDiagramNodeObjectKind`** early return (**`shape-type-swap`**); **`shapeSwapMenuOptions(type, compositeBodyShape)`**. Timeline cards render via **`CompositeCardSilhouette`**; mind-map uses existing **`MindmapNodeShape`** switch to **`CircleShape`** / **`TriangleShape`** / etc. Full palette→closed-object swap still clears composite/timeline/mind-map fields when leaving those types.

### 2026-05-09 – Context menu **Change shape** (closed palette objects)
Right‑click a swappable **`*.object.*`** shape (not chart / line): **Change shape** submenu lists other kinds. For timeline/mind‑map‑node, submenu only swaps **`compositeBodyShape`** (see **`DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS`**). **`swapDiagramNodeObjectKind`** (**`shape-type-swap.ts`**) otherwise updates **`type`**, clears incompatible payloads (UML/chart/spine/icon fields, progress/heading when swapping away), preserves id/position/styling/group/layer/sub‑diagram link. Prefix before **`.object.`** kept when present.

### 2026-05-09 – Timeline palette icon: spine + alternating cards (`PaletteTimelineGlyph`)
**`ResourceIcon`** uses **`generic.object.timeline`** vector preview (spine + three stems/cards/dots); catalog **`timeline.svg`** under **`generic/object/`**, **`resource-generic.json`** updated; **`DraggableResourceItem`** routes palette tile like **`progress-bar`**. Removed flat **`timeline.png`**. Patch bumped.

### 2026-05-09 – Mind map palette icon: radial hub + satellite cards (`PaletteMindmapGlyph`)
**`generic.object.mind-map-node`** uses **`PaletteMindmapGlyph`** (center rounded topic, spokes, five perimeter rounded rects). **`isMindmapPaletteVectorType`** skips catalog raster thumbnail; **`resource-generic.json`** → **`mind-map-node.svg`**; **`DraggableResourceItem`** uses **`ResourceIcon`** for **`mind-map-node`**. **`mind-map-node.png`** removed. Patch bumped.

### 2026-05-09 – Timeline card drag: snap to canvas grid
**`timelineDragSolveFromDiagramPoint`** snaps pointer diagram **`x`/`y`** with **`snapToGrid`** before **`projectDiagramPointToTimelineStrokeRatio`** and perpendicular offset math, matching drops / waypoints / align behavior. Patch bumped.

### 2026-05-09 – Mind map theme-hues: root vs branch color cascade
**`mindmapHueAnchor`** marks where the user last set fill/border for **`theme-hues`**. **`resolveMindmapDisplayColors(node, allNodes)`** uses the nearest anchor up the tree (else tree root) as the chromatic base, then applies depth/sibling hue steps only for descendants. Coloring the **root** clears other anchors in the tree; a **branch** sets a local anchor and clears anchors under it. **`MindmapNodeShape`** / **`DiagramNode`** take **`diagramNodesForMindmap`**; palette roots default **`mindmapHueAnchor: true`**, duplicates **`false`**. Item update / multi visual styling / multi theme apply run **`applyMindmapHueAnchorsAfterVisualChanges`**. Patch bumped.

### 2026-05-09 – Mind map theme-hues: per-sibling auto hue
**`recomputeMindmapMetadata`** sets **`mindmapSiblingHueIndex`** (order in parent’s valid tree children). **`resolveMindmapDisplayColors`** shifts hue by **`(mindmapTreeDepth + mindmapSiblingHueIndex) × step`** so new children differ visually (not identical depth-1 shifts). Types/schema/slide memo/diagram memo updated; **palette add**, **duplicate**, **post-reorder move** run recompute where needed. Patch bumped.

### 2026-05-09 – Mind map drag: move root with leaf children only
Dragging a mind-map node uses **`collectMindmapDragCoMembers`**: self + direct tree children that have **no** mind-map children (leaves). Branch subtrees stay put (e.g. drag **1** → **2,3,4,6** move; **5** and **7,8** stay). Dragging **5** still moves **7,8** with it. Hover/drop/touch use same set. **`mindmapValidDirectChildIds`** shared with radial layout. Patch bumped.

### 2026-05-09 – Mind map default labels: sequential `1`, `2`, …
New mind-map nodes from the palette or **Add child** get **`nextMindmapAutoNumericLabel`** (`mindmap-layout.ts`); counting uses existing mind-map nodes whose label is all digits. Alt+duplicate keeps copied text. Patch bumped.

### 2026-05-09 – Mind map subtree drop: persist multi-node move
**`use-canvas-drag-drop`** hover expanded mind-map drags to **`collectMindmapSubtree`**, but **drop** only used group membership or a single id → **`moveItem`** ran for the grabbed node only; children reverted when overlay cleared. Drop and **mobile** move now mirror hover (mind-map branch before group). Patch bumped.

### 2026-05-09 – Mind map node (`generic.object.mind-map-node`) shipped
Radial child layout (`mindmap-layout.ts`), subtree canvas drag (`use-canvas-drag-drop`), context menu (add child, detach, reset layout, pair tree/link, branch hues), `DiagramConnectionData.mindmapRole` (`tree`|`link`). Shape reuses rounded-rect + `MindmapNodeShape` hue resolver. Palette: **`resource-generic.json`** + **`mind-map-node.svg`** (**`PaletteMindmapGlyph`** in **`resource-icon`**). See **`mind-map-implementation.md`**.

### 2026-05-08 – Fit to view / content bounds: timeline uses outer spine+card bounds
**`handleFitToView`** (**`use-canvas-transform`**) and **`computeContentBounds`** (**`presentation-viewport-fit`**) previously boxed each node as **`(x,y) + measureNodeDims`**. **`TimelineShape`** paints inside an inner wrapper offset by **`svgMinX`/`svgMinY`**, so cards and spine often sit outside that rectangle — fit was under-zoomed and off-center. Shared **`nodeBoundingBoxForFit`** in **`canvas-constants`** delegates timelines to **`computeTimelineOuterBounds`**; other nodes unchanged. Patch bumped.

### 2026-05-08 – Timeline card drag: flip above/below spine
Per-entry **`cardSide`** (`'above' \| 'below'`) overrides node **`timelineCardSide`** for that row. **`timelineDragSolveFromDiagramPoint`** uses signed **`dot(W, N)`** vs spine normal to pick side + distance (deadband keeps stability on the spine). Patch bumped.

### 2026-05-08 – Timeline: hues by spine order, perpendicular drag, alternate sides toggle
**Sequential hues** use **`theme-hues`** rank sorted by arc **`t`** (tie **`entryIndex`**) so swapping positions swaps hues. Per-entry **`cardNormalOffsetPx`** stores perpendicular drag (**`timelineDragSolveFromDiagramPoint`**); **`timelineEntriesMaterializedRatios`** freezes ghost **`even`** ratios when committing **`manual`**. Context menu **Alternate cards above/below** toggles **`timelineCardSide`** **`alternate` ↔ `above`**. Patch bumped.

### 2026-05-08 – Align / grid-step: spine lines kept geometry in sync
**`diagram-editor`** **`handleAlignObjects`** (align + distribute) and **`handleLayoutGridStep`** (linear + curved variants) previously patched only **`node.x` / `node.y`** for **`isConnectorLikeSpineNodeType`** nodes. **`startPos` / `endPos` / `lineControlPoints`** stayed on old canvas coords, so axis-aligned connector/timeline spines often appeared missing after alignment or stepping. **`positionNodeWithSpineTranslate`** mirrors canvas move deltas; **`getObjectDimensions`** uses **`measureNodeDims`** for spines instead of **`80×50`**. Patch bumped.

### 2026-05-08 – Timeline excluded from diagram connections UX
**`generic.object.timeline`**: no **Connect** / **Disconnect** / **Connections** in **`context-menu`** or **`context-toolbar`** on-node controls; **`ConnectHandle`** hidden (**`spineLikeNode`**). **`collectConnectSourceIdsFromDiagram`** / **`startConnecting`** / **`handleConnect`** drop timeline node ids as sources (targets already blocked via **`isConnectorLikeSpineNodeType`**). Patch bumped.

### 2026-05-08 – Timeline **Add card** inserts by spine click position
**`timeline-layout`** **`insertTimelineEntryNearArcRatio`** freezes existing **`t`** values, switches **`manual`**, splices new row where projected arc ratio falls between neighbors. **`TimelineShape`** spine **`contextmenu`** maps screen→diagram→**`projectDiagramPointToTimelineStrokeRatio`**; **`useCanvasContextMenu`** stores **`timelineSpineArcRatio`**. Opening menu from a card (no spine ratio) keeps append-at-end. Patch bumped.

### 2026-05-08 – Timeline: card context menu, spine spacing helper, line caps on spine
**`TimelineShape`** renders **`startCap` / `endCap`** like **`LineShape`** (**`renderConnectorLineCapSvg`** exported from **`line.tsx`**). **`applyTimelineEntriesSpacedEndpoints`** (**`timeline-layout`**) sets **manual** **`t`** = **`i/(n-1)`** (single row **`0.5`**). **`use-canvas-context-menu`** **`timelineEntryId`** + **`handleTimelineEntryContextMenu`** → **`Delete card`** targets card-under-menu / fallback selected row; **Space cards start → end** context action; selected cards use **primary** stroke ring. Patch bumped.

### 2026-05-08 – Timeline cards: inline label edit, context add/remove, sequential hues toggle
**`diagram-node`**: **`TextboxRichEditor`** overlay on **double-click** a card (**`onEntryDoubleClick`** → **`timelineEntryOverlayBoundsRelativeToNodeContainer`**); guards Popover / touch-move / hover while **`isEditingTimelineEntryLabel`**. **`context-menu`** / **`editor-canvas`**: **Add timeline card**, **Remove selected card** (active **`timelineActiveEntryId`**, keep ≥1 row), **Sequential card hues** checkbox (**`timelineCardFillMode`** **`solid` ↔ `theme-hues`**). Patch bumped.

### 2026-05-08 – **`generic.object.timeline`** (initial ship)
Composite timeline shape: palette **`Timeline`** + **`timeline.png`** (copied from **`line.png`** placeholder); **`canvas-operations`** / **`measureNodeDims`** / drag-move / duplicate use **`isConnectorLikeSpineNodeType`**; **`diagram-node`** **`spineLikeNode`** chrome (**vertex handles**, **`timelineLiveLayoutDims`**, glow/highlight parity); **`diagram-editor`** **`timelineActiveEntryId`** → **`EditorCanvas`** → **`DiagramNode`**; context menu spine actions + toolbar **Line styling** include timeline; **`timeline-styling`** **`unknown`** casts for strict **`tsc`**. Per-entry panel routing remains incremental — see **`timelineobject.md`**.

### 2026-05-08 – Progress bar sidebar tile: `DraggableResourceItem` used PNG over `ResourceIcon`
**`draggable-resource-item`**: **`progress-bar`** added next to **cloud** / charts — **`ResourceIcon`** **`generic.object.progress-bar`** instead of **`iconPath`** **`<img>`** (**`progress-bar.png`**), which bypassed **`PaletteProgressBarGlyph`**. Patch bumped.

### 2026-05-08 – Progress bar resource icon: vector glyph vs catalog PNG
**`resource-icon`**: **`progress-bar`** skips catalog **`progress-bar.png`** (**`setResourceFile(null)`** + **`iconPath`** **`null`** via **`isProgressBarPaletteVectorType`**, same idea as **text-box-heading**) so the resources grid shows **`PaletteProgressBarGlyph`** (light **track** + solid **~52%** **fill** + **outline**) instead of the hollow PNG. Patch bumped.

### 2026-05-08 – Visual Styling: preset select trigger fits two-line labels
**`visual-styling-panel`** **Preset** **`SelectTrigger`**: **`h-auto`** / **`min-h-9`**, **`items-start`**, and **`[&>span]:line-clamp-none`** so preset **name + description** are not clipped by fixed **`h-9`** + default **`line-clamp-1`** on **`SelectValue`**. Patch bumped.

### 2026-05-08 – Visual Styling panel: collapsible sections + scroll + progress column
**`visual-styling-panel`**: **`StylingAccordionSection`** (**Radix Collapsible**) for **Preset**, **Border**, **Background**, **Progress bar** (left column, under Background), **Effects**, **Connectors**, **Tags**. Body **`max-h`** + **`overflow-y-auto`**; drag via **`.dw-visual-styling-drag-handle`**. **`isProgressBar`**: **`defaultOpen={false}`** on all accordions & grid **`key`** from **`selectedItemIds` + PB flag** so sections start collapsed when styling a progress bar (and refresh when switching selection). Scratch pad passes **`selectedItemIds`** so remount key is stable per item.

### 2026-05-08 – Progress bar: unfilled strip = Background (remove Track styling)
 **`ProgressBarShape`**: full-bar base paint comes from node **`background*`** (**`useSvgGradient`** + **`getShapeSvgFill`**, same layering idea as **`RoundedRectangleShape`**); only **`progressFill*`** renders the completion overlay (no duplicate “track” layer). **`VisualStyling`** / **`visual-styling-panel`**: Progress bar drops **Track** controls; hint points to **Background**. **`theme-manager`**: clears legacy **`progressTrack*`** keys on theme apply; **`progressBarFillFromTheme`** sets **`progressFill*`** hues only (**`background*`** applied in the usual theme branch). **`slide-visual-color`** and **`diagram-node`** memo omit **`progressTrack*`**. **`canvas-operations`** default **`backgroundColor`** **`#e5e7eb`** for new bars; **`shape-preview`** track uses resolved **Background**. Patch bumped.

### 2026-05-08 – Progress bar palette glyph (resources list)
**`resource-icon`** **`PaletteProgressBarGlyph`**: two-tone bar under rounded **`clipUrl`** (**`url(#dw-pb-clip-…)`** on **`<g>`**; light full track + darker **~58%** fill) plus outline (**`strokeWidth`** coerced safely). Patch bumped.

### 2026-05-08 – Theme apply: progress bar track + shifted fill hues (**superseded**)
Older behavior wrote **`progressTrack*`** explicitly; newer line above uses theme **`background*`** as the strip and clears **`progressTrack*`**. **`progressFill*`** hues still come from **`progressBarFillFromTheme`** (**+42°** shift paths unchanged).

### 2026-05-08 – Progress bar: value drag only on fill/track divider
 **`ProgressBarShape`**: root **`<svg>`** **`pointer-events: none`**; **narrow transparent thumb** (**`pointer-events: auto`**) sits on the **boundary** between filled and track sections (`data-dw-progress-bar-drag`); rest of bar passes clicks through so **canvas move / selection** behaves like other shapes. **`SvgShapeBase`**: optional **`svgPointerEvents`**. Patch bumped.

### 2026-05-08 – **`generic.object.progress-bar`** shape object (**track note superseded**)
Rounded bar with **corner radius**, **drag-to-set percent**, **`progressShowPercent`**, label placement, **completion fill** **`progressFill*`**; **unfilled** paint is node **`background*`** (see newer **“unfilled strip = Background”** entry). Palette + **`ShapeText`** stacking + slide crossfades as before.

### 2026-05-02 – Connector line: SVG path click/context menu lacked `data-node-id` wiring
**`editor-canvas`**: **`onDiagramNodeClickStable`** / **`onDiagramNodeContextMenuStable`** read **`data-node-id`** **`from`** **`currentTarget`**; **`LineShape`** / **`LoopShape`** **`<path>`** targets have none, so **`line`** never selected (no vertex handles) and right-click **`return`** **`ed`** **`early`**. **`LineShape`** **`already`** **`passes`** **`(e`** **`,` **`node)`** **`—`** **`optional`** **`nodeHint`** **on** **`Stable`** **`+`** **`id`** **`from`** **`DOM`** **`(`**`**`closest`****`)`** **first** **`then`** **`fallback`** **`hint`** **`+`** **`ref`** **`/`** **`hint`** **`resolution`**. **`Loop`** **`path`** **`events`** **`inherit`** **`the`** **`same`** **`handler`**. Patch bumped.

### 2026-05-02 – Connector line node: explicit width/height (auto box was 0×0, no hits)
**`diagram-node`**: **`generic.object.line`** only fills the stack with **`position:absolute`** **`LineShape`** content, so **`width/height: auto`** collapsed the HTML box to **0×0** — no pointer path to the SVG, so no select, context menu, or vertex handles. Added **`lineLiveLayoutDims`** (**`connectorLinePointBounds`** + padding + **`snapDimensionToGrid`**, same idea as **`measureNodeDims`**, honoring **`__local*`** during endpoint drag). Keeps earlier **`<svg pointerEvents: auto>`** fix. Patch bumped.

### 2026-05-02 – Line / loop SVG hit testing (select, context menu, vertex handles)
**`line.tsx`**, **`loop.tsx`**: **`pointer-events: none`** on the root **`<svg>`** disabled the **entire** subtree in **Chromium/WebKit**, so connector lines were not selectable and green/yellow handles never appeared. **`<svg`** **`style.pointerEvents`** **`'auto'`**; **HTML** wrapper stays **`none`** so only painted paths are targets. **`renderLineCap`** arrow/dot/square **`pointerEvents: none`** so hits reach the wide transparent hit path underneath. **`loop`** arrow polygon same. Patch bumped.

### 2026-05-02 – Connector line vertex handles: `pointermove`/`pointerup` (touch + stylus)
**`LineVertexHandles`** moved from **`mousedown`** to **`pointerdown`** (`touch-none`, **`touchAction: none`**), **`data-dw-line-vertex-handle`**. **`diagram-node`** line drag uses **`document` pointer listeners** + **`pointercancel`** (replacing **`mouse*`** only) so endpoints work on phones/tablets without changing desktop mouse parity. **`handleTouchStart`** ignores hits on **`[data-dw-line-vertex-handle]`**. Patch bumped.

### 2026-05-02 – Touch: PNG/custom icon nodes suppress native long-press (Save Image / drag)
Catalog **`resource-icon.tsx`** **`img`** + **`custom-icon-image`**: **`draggable={false}`**, **`touchAction: none`**, **`-webkit-touch-callout: none`**, **`user-select: none`**, **`onDragStart`**. **`diagram-node`** icon subtree: **`select-none [-webkit-touch-callout:none]`** on popover trigger; **`onDragStart`** blocks native image drag when **`isIconNode`**. Leaves existing long-hold canvas move untouched. Patch bumped.

### 2026-05-02 – Touch: second tap on selected **connection** opens context/simulation menu (Bezier + orthogonal)
**`useDwFingerTapSyntheticClick`** tags synthetic clicks on connection **`<g>`**s (**`BezierConnection`** / **`OrthogonalConnection`**). **`canvas-connections`** routes **`dwFingerTap`** + already-selected edge to **`handleConnectionContextMenuEdge`** (same as right-click); **`isConnectMode`** disables that path. **`editor-canvas`** passes **`isConnectMode`**. Patch bumped.

### 2026-05-02 – ESLint: `next lint` removed in Next 16 CLI; flat `eslint.config.mjs` + real `eslint-config-next`
**`npm run lint`** runs **`eslint .`**. Replaced mistaken **`eslint-config-next@0.2.4`** with **`eslint-config-next@16.1.6`** (Vercel). Flat config extends **`eslint-config-next/core-web-vitals`**; strict **react-compiler** hooks rules relaxed / **`react-hooks/purity`** off so the repo passes with **0 errors** (warnings remain). **`bezier-connection`**: unconditional **`useMemo`** for path distance lookup. **`layout`**: scoped disable for **`@next/next/no-sync-scripts`** on **`theme-init.js`**.

### 2026-05-02 – Touch: second tap on selected node opens context menu; empty canvas tap still clears selection
**`DiagramNode`** sets **`dwFingerTap`** on the synthetic click after a short touch; **`handleNodeClick`** routes to **`handleNodeContextMenu`** when **`selectedItemIds.has(node.id)`** (and not connect-mode / modifiers). Mouse path unchanged. **`handleCanvasClick`** already clears selection on empty canvas **`click`**. Patch bumped.

### 2026-05-02 – Canvas items on touch: long-press move, resize/corner-radius via pointers
After **~420ms press** on a node (not lines, not chart value handles, not helper controls), touch-drag moves with live offset and commits via **`emitMobileCanvasDeltaMove`** → **`mobileMove`** in **`useCanvasDragDrop`** (same multi-select / group delta logic as mouse **`drop`**). Scroll before the hold cancels the timer. **`ResizeHandles`** use **`onPointerDown`** + **`touchAction: none`**; resize tracking uses document **`pointermove`/`pointerup`**. **`CornerRadiusHandle`** uses **`onPointerDown`** + pointer listeners. Mouse **`react-dnd`** unchanged. Patch bumped.

### 2026-05-02 – Mobile sidebar palette drops: hook listens for `mobileDrop`, Lucide/emoji icons get touch gesture
Sidebar items already dispatched **`mobileDrop`** without a receiver; **`data-testid="editor-canvas"`** on **`#canvas-container`** makes resolution reliable. **`useCanvasDragDrop`** attaches a **`mobileDrop`** listener (**viewport → diagram** coords matching HTML5 **`drop`**). **`emitMobilePaletteDropIfOverCanvas`** in **`draggable-item`** centralizes dispatch; **`DraggableIconItem`** adds the same long-press-drag touch path as **`DraggableResourceItem`**. Desktop HTML5 **`react-dnd`** unchanged. Patch bumped.

### 2026-04-29 – Glow spread readout: minimum ~1px (was ~4)
**`highlight-anim`**: **`GLOW_DROP_BLUR_MIN`** **1**; outer/inner/spread **mins** at **0** so **`highlightGlowApproxHaloPx`** at spread **0** rounds to **~1px** (tight halo). Patch bumped.

### 2026-04-29 – Highlight glow (effects): higher max spread, ~56px UI readout, silhouette parity with rectangles
**`highlight-anim`**: raised **`GLOW_DROP_BLUR_MAX`** (e.g. **30**) / **`GLOW_BOX_*_MAX`**; **`highlightGlowApproxHaloPx`** → **Visual styling → Glow spread (~size)** **~56px** at full spread (**`drop + outer×0.5`**) — superseded bundles showed legacy **~24px**. **`alpha`** (circle, triangle, …): **dual** **`drop-shadow()`** plus **`GLOW_NONE_FILTER_DUAL`** keyframes; **`box`** rectangles: **box-shadow** + single drop.

### 2026-04-29 – Sidebar cloud resource: matches CloudShape vector (`src/lib/cloud-shape.ts`)
**`ResourceIcon`** skips catalog **`cloud.png`** for **`generic.object.cloud`** (like charts — vector parity with canvas) and draws **`CLOUD_SHAPE_PATH_D`** in **`CLOUD_SHAPE_VIEW_BOX`**. **`CloudShape`** imports the same constants. **`DraggableResourceItem`** forces **`ResourceIcon`** for cloud (otherwise **`cloud.png`** **`img`** wins over the **`icon`** prop). Patch bumped.

### 2026-04-29 – Cloud shape SVG: recognizable fluffy silhouette
**`CloudShape`** (`src/components/diagram/shapes/cloud.tsx`) and matching **`shape-preview`** cloud **`path`** use a classic flat-bottom silhouette with distinct upper lobes (same geometry in **`0 0 100 60`** normalized space). Patch bumped.

### 2026-04-29 – MEMORY.MD: consolidated duplicate / superseded notes
Merged redundant **README** bullets; removed **object-fill** thumbnail note (reverted to **`object-contain`**); folded the **Apr 24 frosted portal** debugging chain into a short **superseded** summary + compact inline-stack notes; deduped **presentation collapse-toolbar** and **viewer connection labels**; merged duplicate **Connections popover** / **mint-mocha** merge lines; dropped the redundant **semver superseded** stub (history folded into the **`0.1.{patch}`** line); corrected **app build** note vs **2026-04-14** top-bar chip removal. Removed stale **“Project Overview”** tail (~600 lines: outdated Next/React snapshot, contradictory **zones** history, duplicated feature bullets). **`package.json`** patch vs **`### `** count may drift until the next intentional semver bump.

### 2026-04-29 – `docs/AI_SCHEMA.md`: LLM-oriented layout & aesthetics guidance
**`docs/AI_SCHEMA.md`** — **For LLM authors** section: output contract, validity checklist, coordinate grid/spacing, visual hierarchy (icons vs boxes), color/contrast polish, readable connections, anti-patterns, optional **`recentColors`**. Intent: prompts that attach this file produce parseable JSON and clearer diagrams.

### 2026-04-29 – `docs/AI_SCHEMA.md`: aligned with `DiagramDataSchema` / import pipeline
**`docs/AI_SCHEMA.md`** rewritten for current diagram JSON: top-level **`groupings`**, **`layers`**, **`subDiagrams`**, **`viewState`**; deprecated **`groups`**/**`rootGroupId`**; orthogonal connections, taper/color locks, **`animation`**; hierarchical **`zones`** as legacy import only; **`HierarchicalDiagramDataSchema`** / **`flattenDiagramOnImport`** / **`validateAndConvertJson`** pointers. Examples updated.

### 2026-04-29 – `docs/functional.md`: functional architecture reference
Added **`docs/functional.md`** — routes, **`DiagramData`** lifecycle, editor/viewer composition, **`src/hooks`** grouping, **`src/lib`** modules by domain (presentation, connections, themes, charts, Mermaid, export), and extension notes. **`tree.md`**: **`docs/`** bullet for this file.

### 2026-04-29 – Fit to View: no success toast (presentation)
**`handlePresentationFitToView`** no longer shows a toast after a successful deck fit; error toasts unchanged. Patch bumped.

### 2026-04-29 – `docs/todo.md`: tutorial + examples backlog
**`docs/todo.md`** — checklist tables with **`[ ]`/`[x]`** status + sub-rows (parity/IDs/examples/hygiene); epics **A** (tutorial) / **B** (examples); “at a glance” summary. Same scope as before: **`TUTORIAL-MAP`** / **`README`**, **`public/examples`** + **`public/examples/tutorial`**.

### 2026-04-29 – Fit to View: host-size viewport (regression from window-clip / `innerWidth`)
**`use-canvas-transform`** `handleFitToView` again uses the canvas host’s **`clientWidth`/`clientHeight`** (via **`getCanvasElementSizeForImageCapture`**) for scale and centering — same coordinate system as **`translate(x,y) scale(k)`** and pointer math. The Jan 2026 “visible window ∩ canvas rect” path mismatched that system and broke fit; **`runPresentationFitToView`** also used **`window.innerWidth`/`innerHeight`** for union fit, overstating space vs the real canvas → zoom too high. **`getElementVisibleViewportSize`** now delegates to **`getCanvasElementSizeForImageCapture`** (viewer union-fit **`ResizeObserver`** stays consistent). **`EditorCanvasHandle`**: **`getCanvasHostViewportForFit`**. Patch bumped.

### 2026-04-29 – Diagram JSON: persist `layers` on save/load
**`ensureDiagramLayersPersisted`** in **`layers-utils`** — if **`diagramData.layers`** is missing or fails **`validateLayersConfig`**, inject **`getDefaultLayersConfig()`** before writing/reading. Wired into **Save as .json** (**`diagram-editor-save-handler`**), **`validateAndConvertJson`** (**viewer** paths), **`parseDiagramJson`** (**`schemas`**), **`parseUnknownJsonToDiagramData`** (preserves full validated diagram + connections + ensures layers), JSON panel apply (**`json-editor-panel`**), **`sanitizeImportedDiagram`** (includes **`viewState`** in return). Patch bumped.

### 2026-04-29 – Layers panel: isolate state per diagram tab (`useLayers`)

**`layerSourceKey: activeTabId`** on **`useLayers`** + **`[diagramData.layers, layerSourceKey]`** sync; when **`diagramData.layers`** is missing or invalid, reset to **`getDefaultLayersConfig()`**—avoids carrying the prior tab’s layer list when switching tabs. **`use-layers`**, **`diagram-editor`**. Patch bumped.

### 2026-04-29 – Presentation drafts: canonical `layers` from tab after slide resolve
Non-primary **`presentationDraftDiagram`** was rebuilt from deltas with **stale **`layers`** (visibility didn’t track tab). Effect merges **`tabDiagramData.layers`** onto snapshot drafts whenever they differ (**`presentationLayersSyncFingerprint`**). **`validateLayersConfig`**, **`diagram-editor`**. Fixes cross-slide visibility staying in sync. Patch bumped.

### 2026-04-29 – Slide deltas: full topology (layer hide no longer drops nodes from persisted slides)
Persisted **`diagramDelta`** was computed with **`projectVisibleDiagram`** (layer filter), so hiding a layer rewrote slide JSON as if nodes were **deleted**—layer panel counts hit 0 after slide switches. **All** `computeDiagramDelta` inputs for slide persistence / rechaining / propagation / blank slide / snapshot payload / viewport resolve / viewer resolve now use **full** `DiagramData`; **`projectVisibleDiagram`** remains for **rendering / PNG thumbnails only**. Touched: **`presentation-delta`** (JSDoc), **`presentation-slide-chain`**, **`diagram-editor`**, **`use-presentation-thumbnails`**, **`use-presentation-slide-viewport-sync`**, **`viewer/page`**. Patch bumped.

### 2026-04-29 – Layers: shared config across presentation slides + any-slide panel
**Layers** are **`LayersConfig`** on each tab’s **`diagramData`**. **`applyDiagramLayersGlobally`** in **`diagram-editor`** syncs **`layers`** to **`updateActiveTab`**, **`presentationMasterDiagram`**, and **`presentationDraftDiagram`** so visibility / order / active-layer / rename / add / remove behave as **one per file** while editing any slide. **`use-layers`** takes optional **`applyLayersGlobally`**; **`removeLayerById`** calls it before moving items. **`diagram-editor-inner`**: Layers panel no longer gated by primary slide (`isPrimaryPresentationSlideActiveInner` removed—assign/set active/reorder/rename/etc. on snapshot slides).

### 2026-04-29 – Undo/redo: defer snapshots during chart value drag
Bar/line/pie **in-canvas value drags** emit **`onChartValueDragSessionChange`** from **`diagram-node`** → **`editor-canvas`** → **`diagram-editor-inner`**; **`useDiagramEditorHistory`** treats **`isDragging || chartValueDragActive`** like node drag so the debounced stack does not record every pointer-move. Patch bumped.

### 2026-04-29 – Presentation: layers usable on all slides (remove “disabled layer” UX)
Removed **`presentationDisabledLayerIds`** (master-vs-slide delta bookkeeping), **`confirmPresentationLayerImpact`** dialogs, **`computePresentationDisabledLayerIds`**, and the Layers panel **Disabled in presentation** badge / amber row styling. Visibility toggle and deletes/disconnects/connection edits no longer block or mark layers when snapshot slides omit master nodes. **`diagram-editor`**, **`diagram-editor-inner`**, **`layers-panel`**. Patch bumped.

### 2026-04-29 – README (batch): structure, stack, copy, styling
**`README.md`**: short **work in progress** disclaimer at top; **feature-focused intro** (diagram + presentation, icons/shapes, slide animations, JSON/Mermaid/export). **Project Structure** matches repo (`docs/`, `public/`, `scripts/`, optional **`resources/`**, **`src/`** routes/components); **`types/`** vs **`lib/types.ts`**; **`theme-provider`** / **`theme-toggle`**. **Interactive** canvas + **metadata** popups vs **presentation** emphasis (Effects, transitions, connection animations). **Styling & Layout**: Themes (+ **Theme Editor**), **Step hue**, solid / gradient / **frosted** fills. **Tech stack** per **`package.json`**: TypeScript 5, Next.js **16.x**, React **19.x**, Tailwind **3.x**, **`react-dnd`**, CodeMirror (**`@uiw/react-codemirror`**). **Line** node: straight vs curved, smoothed joints, **closed** outlines + Line Styling panel. Dropped a long **Documentation** bullet list (most **`docs/*.md`** are notes); retained **Development** structure; **`tree.md`** + select **`docs/`** links where those files exist.

### 2026-04-28 – Full Visual Styling: same Glow Off / Constant / Pulse as compact
**`HighlightAnimEffectControls`** is a single **`Glow`** select + colour/spread/time (compact + full two-column **`showFullStyling`**); removed **`Highlight animation`** checkbox path. **`Checkbox`** import dropped. Patch bumped.

### 2026-04-28 – Glow spread: blur radius mapping (not opacity)
**`highlightAnimGlowIntensity`**: **lerp** blur/spread px from a **small** halo to the **legacy peak** (`16` / `28` / …) via **`buildGlowPeakCss`** and **`highlightGlowApproxHaloPx`** — not **× peak** (avoids matching colour alpha). **`highlight-anim`**: **`HighlightAnimSilhouetteMode`** / **`clampHighlightGlowIntensity`** hoisted. UI: **Glow spread (~size)** with **~N px** readout. Patch bumped.


### 2026-04-28 – Icon visual styling: constant vs pulse glow
**Effects** compact panel: **`highlightAnimMode`** **`'constant'`** | **`'pulse'`** (explicit **`'pulse'`** fixes merge overwriting **`'constant'`** when switching back from dropdown; omit = legacy pulse). **`getHighlightAnimStyleForNode`** only treats **`'constant'`** as static glow. Patch bumped.

### 2026-04-28 – Dark mode: themed native scrollbars
**`globals.css`**: **`--scrollbar-track`** / **`--scrollbar-thumb`** in **`:root`** and **`.dark`**; global **`scrollbar-width: thin`**, **`scrollbar-color`** (Firefox), and **WebKit** **`-webkit-scrollbar-*`** so overflow regions (e.g. resources sidebar list, JSON/CodeMirror) use dark tracks/thumbs instead of light OS chrome. Patch bumped.

### 2026-04-28 – Top bar: Fit to View + presentation “auto zoom” merged
Single **Fit to View** (**Maximize2**): with **no** active presentation deck → **`editorRef.fitToView()`** (visible canvas bounds); with **`activePresentationDeckId`** → **`handlePresentationFitToView`** (was **`handleAutoZoomPresentation`** / wand): union fit across slides, **`setCanvasTransform`** for full **x/y/k** when union succeeds, persist **`autoZoomLevel`** on all slides, clear pan. **Slides** strip in **`top-menu-bar`**: removed duplicate **Wand2** control; **`presentationToolbar`** drops **`onAutoZoom`**. **`runPresentationFitToView`** replaces **`runPresentationAutoZoom`**. Sidebar uses same **`handleTopBarFitToView`**. Patch bumped.

### 2026-04-28 – Top toolbar: duplicate-slide tooltip
**`top-menu-bar`** presentation **Slides** **+** control: tooltip / **`aria-label`** **“Add snapshot”** → **“Duplicate Slide”** / **“Duplicate slide”** (matches duplicate-current-slide behavior). Patch bumped.

### 2026-04-28 – Play mode: default “Use slide zoom” off
**`presentation-player`**: **`useSlideZoom`** defaults to **false** (union fit all slides like viewer fullscreen). **`useLayoutEffect`** / window **resize** union-fit run whenever slide zoom is off, including with the bottom **playback toolbar** (**`showPlaybackToolbar`**). **`skipInitialFitToView`** — **true** when **`!useSlideZoom`** so ViewerCanvas’s delayed single-slide fit does not override union transform. Patch bumped.

### 2026-04-28 – Presentation thumbnails: debounce + slower poll
**`PRESENTATION_THUMB_DEBOUNCE_MS`** **900** (`editor-support`): **`tabDiagramData`** / **`presentationDraftDiagram`** changes stagger thumbnail **`captureSnapshotPng`** via **`setTimeout`**. **Flush** (no debounce) on **`activePresentationDeckId`**, **`activePresentationSlideId`**, **`activeTabId`**, **`resolvedTheme`** — clears pending debounce first. **`runPresentationThumbnailCaptureRef`** avoids effect churn from **`presentationThumbnailFitUnionDiagrams`**. **`PRESENTATION_THUMB_INTERVAL_MS`** **10s** (was 3s). Patch bumped.

### 2026-04-28 – Presentation thumbnails: UI light/dark backgrounds
**`use-canvas-export`** maps **`backgroundColor: 'dark'`** → **`#0f172a`**. Strip thumbnails and **add snapshot** use **`presentationThumbnailCaptureBackground(resolvedTheme)`** (**`useTheme`** in **`diagram-editor`** / **`usePresentationThumbnails`**). **Diagram fingerprints** use **`withPresentationThumbnailThemeFingerprintTag`** so PNGs re-capture after toggling theme (not only on diagram churn). Patch bumped.

### 2026-04-28 – Presentation thumbnails: per-slide fit + tight frame
Thumbnail **`captureSnapshotPng`** uses **`unionDiagrams: [that slide’s diagram]`** (not deck-wide union), plus **`tightContentFrame`** + **`fitPadding: 40`** so each PNG auto-fits all objects on **that** slide. **`presentationThumbnailFitUnionDiagrams`** memo in **`diagram-editor`**; **`use-presentation-thumbnails`** backfill uses **`[draftDiagram]`** per slide. **Add snapshot** uses **`fitContent`** + **`tightContentFrame`**. Strip **`presentation-editor-panel`**: **`object-contain`** again (no crop). **`editor-canvas`** snapshot API passes **`tightContentFrame`** / **`fitPadding`**. Patch bumped.

### 2026-04-28 – Presentation strip: thumbnails show index only (no slide name)
**`presentation-editor-panel`** **`PrimarySlideStripItem`**: removed the **`slide.title` / `'Diagram'`** label under slide **#1** so the first thumbnail matches **#2** / **#3** (**`#n`** only). Patch bumped.

### 2026-04-28 – Play mode: hide canvas dot grid
**`ViewerCanvas`** / **`EditorCanvas`**: optional **`showDotGrid`** (default **true**) gates the **`dot-grid`** CSS background on the diagram layer. **`presentation-player`** passes **`showDotGrid={false}`**; **`diagram-editor-inner`** passes **`showDotGrid={!presentationPlayerOpen}`**; **`viewer/page`** passes **`showDotGrid={!presentationPlayerOpen}`** for fullscreen playback. Patch bumped.

### 2026-04-28 – Presentation snapshot strip: no undocked mode
**`presentation-editor-panel`**: removed **floating/undocked** snapshot pane (`snapshotsFloating`, drag chrome, localStorage position). Strip stays **fixed** under the tab bar. **`diagram-editor-inner`** persistence drops deprecated **`snapshotsFloating`**, **`snapshotsPosition`**, **`toolbarFloating`**, **`toolbarPosition`** keys on save. Patch bumped.

### 2026-04-28 – Presentation slide controls in top toolbar
**`top-menu-bar`**: optional **`presentationToolbar`** renders slide actions **left of** the connection **Activity** (animation) button: add snapshot/blank, auto zoom, apply zoom current/all, prev/next + readout, play, show/hide snapshot strip. Shown only when **`presentationToolbar`** is set and the canvas has **no** selection (**`!selectedItem`**, **`selectedItemIds.size === 0`**). **`diagram-editor-inner`**: **`presentationSnapshotsCollapsed`** persisted via **`dw:presentation:panelSettings`**. **`presentation-editor-panel`**: **fixed** thumbnail strip + DnD only (no undocked/floating pane).

### 2026-04-28 – Presentation: any slide can become main (slide 1)
**`presentation-editor-panel`**: slide 1 is **draggable** (react-dnd) and accepts drops that call **`onMoveSlide(index, 0)`** (was position 2 only). **`diagram-editor`** **`handleMovePresentationSlide`**: allows **`fromIndex`/`toIndex` 0**; when the row at index 0 is not the primary id, **tab `diagramData`** + **`presentationMasterDiagram`** update to that slide’s resolved diagram; **`slides[0]`** keeps **`__dw_primary__-${deckId}`** with empty delta; duplicate primary id elsewhere gets a new **`slide-…`** id; **chain** rechains vs new base; **master** recomputes each slide delta vs new master visible. Reorder-only (slide 1 unchanged) keeps prior behavior.

### 2026-04-28 – Presentation slides: chained deltas vs master
Non-primary slides now store **`diagramDelta`** as **delta from the previous resolved slide** (deck **`presentationDeltaMode: 'chain'`**); legacy **`master`** (missing field) still resolves each slide from the visible master independently. **`src/lib/presentation-slide-chain.ts`**: **`resolvePresentationSlideDiagrams`**, **`migratePresentationDeckToChain`**, **`rechainSlideDeltasFromAbsoluteDiagrams`**, **`cumulativeDiagramThroughSlideIndex`**, **`rebasePresentationSlidesOnMasterEdit`**. **Editor** migrates decks when **`presentationMasterDiagram`** is set; **reorder** rechains absolutes; **delete** rechains; **propagate to later slides** recomputes chain; **persist / snapshots / blank slide** use previous-base **`computeDiagramDelta`**. **Viewer** and **export** use the same resolver. **`extract-embedded-presentations`** migrates to chain on load. **`docs/PRESENTATION_CHAIN_DELTAS_PLAN.md`** describes the model. **`presentation-slide-chain.test.ts`**: **`runPresentationChainUtilityTests`**. **`npm run typecheck`** clean; semver patch bumped.

### 2026-04-28 – Presentation JSON load: slide 2 connections dropped
Compact deck **`extractEmbeddedPresentations`** builds **`diagramDelta.operations`** as **`d.o`** ops **then** **`r`** ref patches (**`/nodes`**, **`/layers/layers`**, **`/connections`**). **`applyDiagramDelta`** treated **`path: ''`** (full-diagram replace from fallback snapshot slides) as **terminal** (`return`), so **later** ops (**`/connections`** from **`r.c`**) never ran — slide 2 could show nodes but **no lines** after reload. **Fix**: **`applyDiagramDelta`** applies root replace into a **mutable** diagram and **`continue`**s so following ops apply; **`extract`** uses **`ensureConnectionIds`** on **`r.c`** arrays. **`presentation-delta.test.ts`**: multi-op ordering assert. **`npm run typecheck`** clean; semver patch bumped.

### 2026-04-28 – Load JSON: single-slide decks no duplicate primary
**`extractEmbeddedPresentations`** (compact **`presentations.v === 2`**): first slide used generated **`slide-…`** ids, so **`migratePresentationDeckToUnifiedSlides`** treated decks as legacy and **prepended** **`__dw_primary__`** → extra blank slide after load. **Fix**: assign **`createPresentationPrimarySlide(deckId).id`** to **`slides[0]`**; reuse same **`deckId`** for the deck object. **`npm run typecheck`** clean; semver patch bumped.

### 2026-04-28 – diagram-editor: save + export factories
**`diagram-editor.tsx`**: **`createDiagramSaveHandler`** in **`src/lib/diagram-editor/diagram-editor-save-handler.ts`** (compact presentation v2 JSON, File System Access + download fallback); **`createDiagramExportHandlers`** in **`src/lib/diagram-editor/diagram-editor-export-handlers.ts`** (GIF, single PNG, multi-slide PNG). Implemented as **factory functions** (not custom hooks) so React **hook order** stays identical to inlined `const handleSave` / `handleExport`. Module-level **`getFilenameStem`** in **`diagram-editor.tsx`** for load-side tab rename; **`toast as DiagramEditorToastFn`** at factory call sites. Wired after **`diagramDataForExportLayersRef`** (export) and after disconnect handler (save). **`npm run typecheck`** clean; semver patch bumped.

### 2026-04-28 – diagram-editor: `usePresentationThumbnails`
Extracted presentation strip **PNG thumbnail** pipeline from **`diagram-editor.tsx`** into **`src/hooks/use-presentation-thumbnails.ts`** (~511 lines): `useLayoutEffect` fingerprint on slide change, **`captureOutgoingSlideThumbnailIfNeeded`**, interval + slide-change **`runPresentationThumbnailCaptureIfNeeded`**, sequential **SVG placeholder backfill** (`flushSync` deck/slide restores preserved). **`presentationThumbDeltaFingerprintBySlideRef`** / **`presentationThumbFingerprintSlideKeyRef`** remain in parent so IndexedDB **hydrate effect** can write the same refs. Hook is called **after** **`persistPresentationSlideFromDiagram`** effect (unchanged React hook order vs inlined code). **`npm run typecheck`** clean; semver patch bumped.

### 2026-04-28 – Large-file refactor plan (repo-wide)
Added **`docs/LARGE_FILE_REFACTOR_PLAN.md`**: **`wc -l`** ranking for large **`src/**/*.ts[x]`** files, proposed splits ( **`diagram-editor`**, **`editor-canvas`** simulation helpers, **`context-toolbar`** sections, **`theme-manager`** **`DEFAULT_THEMES`**, charts, connections, **`orthogonal-routing`**, hooks, **`types`**/**`schemas`**), phased action order + verification matrix; complements ongoing **`docs/DIAGRAM_EDITOR_REFACTOR_PLAN.md`**.

### 2026-04-28 – diagram-editor Phase C (additional effect hooks)
Reduced **`diagram-editor.tsx`** further with **`useDiagramEditorRulesScratchLayerEffects`**, **`useToolbarTriggerAutoResets`**, **`useDiagramEditorClientBootstrap`**, **`usePresentationSlideViewportSync`**, **`useDiagramEditorOptionPersistence`** (debounced option keys + one-shot panel/canvas restore); behavior and localStorage keys unchanged; **`npm run typecheck`** clean.

### 2026-04-28 – diagram-editor Phase C (domain hooks)
**Phase C** (`docs/DIAGRAM_EDITOR_REFACTOR_PLAN.md`): extracted **`useDiagramEditorHistory`** (undo/redo + debounced history + **`updateHistory`** for JSON panel), **`useDiagramEditorKeyboard`** (global **`window` `keydown`** shortcuts; dependency list includes command callbacks), **`usePresentationStorageHydration`** (IndexedDB **`loadPresentationsByTab`** → per-tab ref + active tab apply), **`usePresentationTabSwitchSync`** (on **`activeTabId`** change, restore or clear deck/slide/master/draft from **`presentationStateByTabRef`**). **`diagram-editor.tsx`** wires hooks only; thumbnails / viewport / PNG orchestration / file I/O stay in the parent. **`npm run typecheck`** clean.

### 2026-04-28 – diagram-editor Phase B/C (props helpers + tutorial hook)
**`diagram-editor-inner-props`**: exported **`ConnectionContextModalState`**, **`UmlOrChartModalState`**, **`ConnectorLineFocusedVertex`**, **`DiagramEditorExportOptions`**, **`DiagramEditorToastFn`**; **`DiagramEditorInnerProps`** remains an explicit **`any`** alias until handlers can be typed without breaking **`EditorCanvas`** / **`TopMenuBar`** inference. **`diagram-editor-inner`** trims unused imports, uses **`DiagramEditorInnerProps`** on the destructured props parameter, re-exports helper types. **`use-tutorial-c-intro-connection-effect`**: **`c-intro`** step effect (auto A→B) moved out of inner with same deps. **`use-layers`** / **`use-layer-animation`**: **`UseLayersApi`** / **`LayerAnimationApi`** **`ReturnType`** exports. **`docs/DIAGRAM_EDITOR_REFACTOR_PLAN.md`** updated.

### 2026-04-28 – diagram-editor split (Phase A refactor)
**`diagram-editor.tsx`** trimmed by extracting **`diagram-editor-types`** (`SelectedItem`, palette types), **`lib/diagram-editor/editor-support`** (presentation thumbs, selection helpers, compact deck JSON + palette factory), and **`diagram-editor-inner`** (shell UI: sidebar, menubar, canvas column, panels, portals, dialogs). **`diagram-editor.tsx`** still owns state/handlers and re-exports **`SelectedItem`**. Tracked in **`docs/DIAGRAM_EDITOR_REFACTOR_PLAN.md`**.

### 2026-04-28 – Merge simulation branch with main (conflict resolution)
**`New-Design-Simulation-mode`**: Merged **`main`** in; kept **deck-based presentation** and **orthogonal/viewport routing** from main; kept **simulation mode** (canvas, connections, options menu, availability workspace). Removed the feature branch’s legacy **`presentationModeEnabled`** / presentation menubar entries (superseded by **`PresentationEditorPanel`**). **`CanvasConnections`** + **`EditorCanvas`**: **freeze routing + viewport** props combined with **simulation** handlers and styling.

### 2026-04-28 – Presentation: Add snapshot inserts after current slide
**`handleAddPresentationSnapshot`**: New snapshot is **inserted after** the active slide (later slides shift), matching blank-slide behavior. Index/title use the **functional `setPresentationDecks`** updater.

### 2026-04-28 – Presentation toolbar: blank slide after current
**`presentation-editor-panel`**: **`FilePlus`** button next to **Add snapshot** inserts a **blank** slide (empty nodes/connections, master layers retained) **after** the active slide via **`handleAddBlankPresentationSlide`** in **`diagram-editor`**.

### 2026-04-27 – README: License section
**`README.md`**: **License** section states the project is under **GNU GPL v3.0** and links **`LICENSE.txt`**.

### 2026-04-25 – Frosted Perlin: achromatic source (`feColorMatrix`)
**`FROST_PERLIN`** filter: **`feTurbulence` → `feColorMatrix` (sRGB luma 0.2126/0.7152/0.0722 into R, G, B)** so the bitmap is true gray before **`mixBlendMode: luminosity`**. `feTurbulence` alone can be slightly chromatic; **`luminosity` alone** was not enough.
### 2026-04-25 – Frosted Perlin: `luminosity` (no added hue)
**`getFrostedPerlinNoiseOverlayStyle`**: **`mixBlendMode: "luminosity"`** so the `feTurbulence` tile only supplies **luminance** variation; **hue/saturation** follow the existing frosted stack (tint + backdrop), not colored noise. Replaces **`soft-light`**, which re-tinted the glass.

### 2026-04-25 – PNG export: frosted underlay + non-rect `clip-path`
**`injectFrostedBlurredUnderlays`**: Injected **`data-frosted-export-blurred-underlay`** was a full **bbox** image (no clip), so triangles/polygons looked like **rects** in PNG. **`shape-wrapper`**: **`data-frosted-clip-path={frostedGlassClipPath}`** on **`data-frosted-glass-stack`**. **html-to-image**: copy **`clip-path` / `-webkit-clip-path`** to the underlay (same as live glass layers). UML keeps no attribute (rectangular).

### 2026-04-25 – Frosted Perlin: seamless tile
**`FROST_PERLIN`**: `feTurbulence` filter region **`0,0,256,256`** **`userSpaceOnUse`** + **`primitiveUnits="userSpaceOnUse"`** (no negative overflow); **`stitchTiles="stitch"`**. **`background-size` fixed `256px`** to match intrinsic SVG—removed scaled **`backgroundSize`** to kill repeat seams from resampling.

### 2026-04-25 – Frosted: Perlin noise slider (0–10)
**`frostedPerlinNoise`**: 0=off, 10=strong; zod/schema/types, **`nested-hierarchy`**, **`VisualStyling`**, **`slide-visual-color`**. **`getFrostedGlassParams`**: `frostedPerlinNoise` in options → **`FrostedGlassParams.frostedPerlinNoise`**. **`getFrostedPerlinNoiseOverlayStyle`**: tiled SVG **`fractalNoise`** (`FROST_PERLIN_DATA_URL`), **`soft-light`**, behind diffusion speckle. **`shape-wrapper`**, **`uml-class`**: layer inside grain wrapper (with clip). **`visual-styling-panel`**: “Perlin noise (texture)” **Slider** 0..10.

### 2026-04-25 – Frosted (SVG): hide bbox edge highlights
**`shape-wrapper`**: Hype4-style **1×1 px top/left** gradient strips sit on the **node border box**; with **`clip-path`** (`inset(… round …)`, **`polygon(…)`**) they still read as **stray L-shaped box lines** (subpixel / compositing), especially at **top-left**. **Fix**: render those two layers **only** when there is **no** **`frostedGlassClipPath`** (plain CSS frosted on **`uml-class`** + full-rect div shapes unchanged; SVG `SvgShapeBase` still gets depth from **`glassBoxShadow`**, grain, tints, backdrops).

### 2026-04-25 – Canvas perf plan + Phase A (stable node click/context handlers)
**Plan** saved in **`plan.md`**: editor canvas perf (memo-friendly props, then connection `nodesById` stability, then tighter memo deps). **Phase A (done in code)**: `EditorCanvas` was passing **new** `onClick` / `onContextMenu` lambdas per node each render, so `DiagramNode`’s **`React.memo` never skipped** during drag. **Fix**: **stable** `onDiagramNodeClickStable` / `onDiagramNodeContextMenuStable` (`useCallback`, `[]`) read **`data-node-id`** from `e.currentTarget`, resolve the node from **`displayNodesByIdRef`**, and forward via **`handleNodeClickRef`** / **`handleNodeContextMenuRef`** (kept in sync with the live handlers). `displayNodesByIdRef.current` updates each render after **`displayNodesById`** is computed. Next: **Phase B** (connection layer + `nodesById` ref identity), **Phase C** (stagger / alignment memo deps).

### 2026-04-25 – Editor drag: freeze routing for connections that do not touch the moved item(s)
**Issue**: While dragging a **connection endpoint**, **`freezeUnrelatedConnectionRouting`** was off, so **every** connection re-ran orthogonal batch / layout every frame. **Fix**: **Any** non–Alt canvas drag sets **`freezeUnrelatedConnectionRouting`** + **dragged id key**. **`CanvasConnections`**: **`isPartialConnectionDragFreeze`** = dragged set intersects **`getConnectionEndpointIdSet`**. If only non-endpoint items move → same **full** early return on frozen bundle. If an endpoint is dragged → **`partialDragFrozenBundle`** from ref; for **unrelated** orth edges pre-seed **`orthogonalRouteMap`** from frozen and **skip** **`buildConnectionLayout` / batch** for those indices; main render **Bezier** for unrelated still uses **`frozenBuildForUnrelatedConnectionDrag`**. **`orthogonalFastRouting`**: **`isCanvasItemDragging && (!freeze || hasEndpointInDrag)`** so L/Z fast applies to **live** pieces only.

### 2026-04-25 – Drag: sync first hover position (non-endpoint connection freeze)
**Issue**: **`onDraggingChange(true)`** ran in **`use-canvas-drag-drop` hover** while **`setDragPosition`** was only flushed via **RAF**, so **`EditorCanvas`** could render with **`isCanvasItemDragging`** but **no** **`dragPosition?.itemId`** for a frame. **`freezeUnrelatedConnectionRouting`** (previously also gated on **`isCanvasItemDragging`**) missed that window — unrelated **orthogonal** lines re-routed / updated until the next frame. **Fix**: On the **first** hover of a session (**`!isDraggingRef.current`**), **`setDragPosition` / `setMultiDragPositions`** from **`pendingDragRef`** run **synchronously** (RAF still runs for throttling). **`freezeUnrelatedConnectionRouting`** no longer requires **`isCanvasItemDragging`** — only **live drag positions** + **endpoint set** + **!Alt**.

### 2026-04-25 – Editor: freeze unrelated connection routing while dragging non-endpoints
**Issue**: While dragging a **node/zone with no connection endpoints**, `nodesById` and obstacles changed every frame, so other lines **re-routed** (incl. **`orthogonalFastRouting`** L/Z only). **Fix**: **`getConnectionEndpointIdSet`**; **`EditorCanvas`** computes **`freezeUnrelatedConnectionRouting`** + **`unrelatedConnectionRoutingDragIdsKey`**. **`CanvasConnections`**: prop **`freezeConnectionRoutingWhileDrag`** — skip routing `useMemo` and reuse last bundle; for connections **not** attached to a dragged id, the **main render** uses **frozen** **`buildConnectionLayout`/`orthogonalRouteMap`** (skips per-frame **`getOptimalConnectionPoints`**). **Toolbar** uses **`orthogonalRouteMap`** only (no `computeOrthogonal` fallback) when frozen; **`orthogonalFastRouting`** off when froze. Ref snapshot on last non-frozen run (same `diagramData.connections` ref to detect topology).

### 2026-04-25 – Orthogonal obstacles: freeze off-viewport items
**Issue**: Moving or editing items **off the visible canvas** still changed **every** connection’s obstacle signature (full catalog), forcing re-routing. **Fix**: **`connector-obstacle-viewport-freeze`** — from **host width/height** + **`transform`**, compute visible **diagram** AABB (`hostRectToDiagramViewRect`). For each node/zone whose bounds are **outside** that box **+ 400px pad**, routing uses a **frozen** last position (ref map) until the item **re-enters** the pad. **`CanvasConnections`** takes optional **`viewportWidthPx` / `viewportHeightPx`** (editor **`canvasDimensions`**, viewer **`canvasDimensions`**) + **`transform`**; **`useLayoutEffect`** bumps a version so **pan** after a move off-screen updates frozen snapshot. Live positions for **endpoints** and **on-screen** obstacles unchanged.

### 2026-04-25 – Revert: corridor obstacle cull
**Removed** **`cullDistantObstaclesForConnectionCorridor`**: centroid+box culling could **drop** obstacles the router still had to “see” (paths can jog far), so L/Z pre-pass treated routes as **obstacle-free** while full obstacles later produced **A\***/avoidance — **selection** could flip visible routing vs ref cache. Obstacle set for routing is again the **full** `obstaclesForEndpoints` + **appendInteriorObstaclesForPreferredEdges**; **per-connection ref cache** + **L/Z before A\*** remain.

### 2026-04-25 – Orthogonal routes: per-connection ref cache
**Issue**: **`nodesById`** (new object reference on many renders) and **selection** could invalidate **`useMemo`** in **`canvas-connections`**, re-running **`computeOrthogonalRoutesBatch`** even when **endpoint geometry and obstacles** were unchanged (e.g. right‑click, unrelated selection). **Fix**: **`orthogonalRouteRequestGeometryKey`** in **`orthogonal-routing`**; **`CanvasConnections`** holds **`useRef<Record<cacheKey, OrthogonalRoute>>`**. For each **orthogonal** connection, if **`stableId~geometryKey`** hits the ref, **reuse** the route; else compute **only** missing requests in one **batch** and **replace** the ref map with the current frame’s live routes (drop stale **stableId**s).

### 2026-04-25 – Orthogonal routing: L/Z before A* (distance scaling)
**Issue**: Full routing always ran **A\*** on a **10px grid** (up to **15_000** iterations) for the **stub→stub** span. Cost grows with how far the endpoints are apart in Manhattan distance; **L/Z** checks only ran when A* failed, so long connections on sparse boards did huge grid work. Any interaction that re-rendered (e.g. **context menu**) felt slow. **Fix**: **`computeOrthogonalSegment`** — after fast routing, try **`findFallbackRoute`** (L then Z) on **stub → entry stub** with **inflated** (then raw) **obstacles** **before** A*; if L/Z is clear, skip A* entirely.

### 2026-04-25 – Orthogonal connections: pan/zoom performance
**Issue**: Long **orthogonal** routes re-ran **`computeOrthogonalRoutesBatch`** and obstacle/edge prep on **every** **`transform`** update (pan/zoom), even though routes are diagram-space only. **Fix**: memoize **`buildObstacleCatalog`**, edge grouping, **`buildConnectionLayout`**, and **`orthogonalRouteMap`** in **`canvas-connections`** (deps: diagram + nodes + routing mode, not viewport). **`OrthogonalConnection`**: only pass **`diagramTransform`** / **`diagramCanvasRef`** when **trunk drag** is active (selected, no waypoints) so pan does not break memo on every line. **`othogonal-connection`**: slightly lower cap on width-gradient ribbon sample count for very long paths.

### 2026-04-24 – Frosted: polygon / circle / ellipse mask + backdrop blur
**Issue**: Rounded rects used **`getFrostedInsetClipStyleForBackdropLayers`** (blur + tint clip) while **`polygon(...)`** did not, so kites/triangles showed a **full-rect** frosted area; the stack root also used **`clip-path`** for polygons (hurt blur). **Fix**: **`getFrostedBackdropLayerClipStyle`** applies the same **`frostedGlassClipPath` to** primary/second **backdrop** + **tint** for **`inset` / `polygon` / `circle` / `ellipse`**; **no** clip on the **frost stack root** (all shapes). **`getFrostedCircleClipPathCss`** + **`frostedClipCircleInViewBox`** on **`SvgShapeBase`**; **`CircleShape`** passes **`cx, cy, r`** (matches SVG fill, **`xMidYMid meet`**) so circles mask correctly.

### 2026-04-24 – PNG/GIF export: frosted glass (blurred underlay)
**html-to-image** / SVG **`foreignObject`** does not paint **`backdrop-filter`**. **`data-frosted-glass-stack`** on the frost stack (**`shape-wrapper`**, **`uml-class`**) carries **`data-frosted-export-blur`** / **`saturate`** from **`getFrostedGlassExportRasterStackBlurPx`** / **`getFrostedGlassExportRasterBackdropSaturate`**. Export attaches the clone to an offscreen host, hides stacks, rasterizes once (**true pixels behind** each shape), restores stacks, crops + **canvas `filter` blur** (scaled by **`pixelRatio`**) per stack, injects **`data-frosted-export-blurred-underlay`**, then strips **`backdrop-filter`**. If injection fails, falls back to opaque **`data-frosted-export-fallback-bg`**.

### 2026-04-24 – Chart data modal: tinted section cards
**`chart-data-editor-modal`**: **`ChartModalSection`** helper (same visual language as visual/text styling panels: **`bg-*-50/50`**, border, dot + **`Label`** header, optional **`headerRight`**). **Bar/line**: **Outline & display** (muted), **Line style** (emerald, line only), **Bar layout** (amber, bar only), **Axes, grid & legend** (purple), **Categories & …** (sky, Add in header). **Pie**: **Slice outline & options** (muted), **Segment separation** (amber), **Slices** (sky). Drag handle title row: **`BarChart2`** **`text-blue-600`**, **`text-foreground`** title.

### 2026-04-24 – Text styling panel: tinted sections (match visual styling)
**`text-styling-panel`**: Controls grouped into section cards like **`visual-styling-panel`** — **`bg-*-50/50`**, matching borders, dot + **`Label`** headers: **Typography** (muted/primary), **Alignment & position** (amber), **Spacing & case** (emerald), **Color** (sky; includes heading text color when text-box-heading), **Outline** (amber), **Glow** (purple), **Drop shadow** (teal). Title row **`text-foreground`** + **`Type`** **`text-blue-600`**.

### 2026-04-24 – Presentation editor: no toolbar remove snapshot
**`presentation-editor-panel`**: Removed the **Remove active snapshot** trash button from the main toolbar. **Per-slide** trash on each deck thumbnail ( **`onDeleteSlide`** / **`handleDeletePresentationSlide`**) is unchanged. Removed **`onRemoveSlides`**, **`handleRemovePresentationSlides`**, and the panel’s unused **`selectedSlideIds`** prop (per-tab **selectedPresentationSlideIds** state remains for ref sync / persistence).

### 2026-04-24 – Presentation play mode: bottom bar matches viewer
**`presentation-player`** (`showPlaybackToolbar`): Bottom UI uses the same **`fixed` bottom-center** pill layout as **`ViewerPresentationBar`** (MonitorPlay, title, **`n / m`**, Prev/Next, Fullscreen hides the bar). **Exit** remains **`fixed` top-right** only. **Use slide zoom** checkbox sits on the bar. Auto zoom, auto-play, manual zoom %, and shortcut text moved to a **More (⋯) popover**. Removed the old docked strip, float/pin/drag toolbar, and in-bar Exit.

### 2026-04-24 – React: no `transition` + `transitionDelay` mix on slide styles
**Symptom**: Console warning when viewer/presentation animates connections — removing **`transitionDelay`** on rerender while **`transition`** shorthand is set. **Fix**: **`transitionShorthandWithDelay`** in **`css-transition-with-delay.ts`** appends delay to each comma-separated transition clause (respects **`cubic-bezier(...)`** commas). **`canvas-connections`** / **`diagram-node`** use it instead of a separate **`transitionDelay`** style. Connection memo equality no longer compares **`transitionDelay`**.

### 2026-04-24 – Presentation play mode: bottom toolbar clickable
**`presentation-player`**: Docked playback bar used **`absolute bottom-0`** while **`ViewerCanvas`** was **`h-full`**, so the pan/zoom layer (incl. **`transform`**) overlapped the bar — **grab cursor + pan** stole clicks. **Fix**: outer shell **`flex flex-col`**; slide area **`min-h-0 flex-1`**; docked bar **`shrink-0 w-full`** (in flow, no overlap). Image / empty states centered in the **`flex-1`** region. Floating bar unchanged (**`absolute z-50`**).

### 2026-04-24 – Stacking order list (z-order panel)
Draggable **Stacking order** modal (`z-order-list-modal.tsx`) lists canvas items **front → back** (matches `computeConnectionSlots` / `getBackToForwardItemOrder`). Reorder **within the same layer (or zone block)** via react-dnd; **Shift** multi-select. Updates **`nodes`/`zones` array order** through `applyFrontToBackOrderToDiagramData`; history debounces like other edits. Open from **Layout** menu, **toolbar ListOrdered** button, or **context → Render order → Stacking order list…** (passes cursor position + item id). **`wheelZoomSuppressed`** on editor canvas while open. List selection uses **`selectedItemIds` + `handleBatchSelect`**: row clicks / shift+click update canvas selection; opening from context **selects** that item; canvas changes reflect in the list highlights.

### 2026-04-24 – Z-order: `stackWithShapes` on icon nodes
Icon/resource nodes default to **`NODE_LAYER_BASE + 2*i+1`** z-index so **connectors stay under icons**. Shapes use **`2*i+1`**, so **reordering JSON does not** put an icon behind a rectangle on the same diagram layer. Optional **`stackWithShapes: true`** on a node opts it into the shape ladder so **`computeConnectionSlots` item order** controls overlap; connectors may then draw above that node per slot order. Editor/viewer **`useShapeStackTier`**; **`nested-hierarchy`** preserves the field.

### 2026-04-24 – Frosted: viewport portal removed; inline glass only
Removed **`FrostedGlassPortalLayer`**, **`#dw-frosted-root`**, **`frostedGlassQuality`** / viewport UI and schema fields. All **`frosted`** backgrounds use the inline stack only; **`getFrostedGlassParams(..., { forInlineStacking: true })`** always. Dropped pan/zoom + canvas ref props from shape plumbing.

### 2026-04-24 – Frosted glass: no hover/subdiagram `filter` glow
**`node-glow-hover`** / **`.node-glow-subdiagram`** use **`filter: drop-shadow`** on the **node** wrapper — in Chromium, **`filter` on an ancestor** creates a **backdrop root**, so **inline/“fake” frosted** **`backdrop-filter`** no longer blurs. **`diagram-node`**: if **`backgroundStyle === 'frosted'`**, skip those classes (selection **`.node-glow-static`** still uses `filter` — user preference for performance).

### 2026-04-24 – Visual styling: frosted rendering help as tooltip
**`visual-styling-panel`**: Removed inline copy for **Viewport blur** vs **Layer order** (former paragraph + long **Select** labels). **Rendering** row has an **Info** control; **`TooltipContent`** holds both explanations. Dropdown shows **Viewport blur** and **Layer order** only.

### 2026-04-24 – Frosted inline on SVG shapes: `filter` + `clip-path` ancestor
**Symptom**: Tint + grain but **no** backdrop blur (sharp icon/text through the glass). **Causes**: (1) **`filter: var(--shape-shadow-drop)`** on **`ShapeWrapper`** root when **`useSvgShadow`** — `filter` creates a **backdrop root**, so child **`backdrop-filter`** does not sample the diagram. **Fix**: skip that root **`filter`** when **`isFrostedBg`** (glass stack already carries depth). (2) **`clip-path`** on the **frost stack wrapper** around **`backdrop-filter`** — Chromium often disables blur. **Fix**: **`frostedInlineOuterClipPath`** — no wrapper clip for **`inset(...)`** clips (rects); clip grain/rims/shadow only; **`polygon(...)`** may need wrapper clip for geometry.

### 2026-04-24 – Frosted inline: isolation, remount, simulated stack, diffusion
**`isolation: isolate`** removed from frost ancestors. **`getFrostedInlineBackdropReactKey`** + **`Fragment` `key`** remount when **`blurPx`/tint** change. **`getFrostedGlassParams(..., { forInlineStacking: true })`** tunes fill/grain. **`simulated`** path: **`getFrostedGlassInlineBackdropPrimaryStyle`**, second pass, **`getFrostedInsetClipStyleForBackdropLayers`** on **`inset(...)`** rounds; **`uml-class`** **`overflow: visible`** when frosted. **`getFrostedGlassTintLayerStyle`** (**`tintRgba`**) above blur, under grain; **`surfaceKey`** includes **`tintRgba`**. **Diffusion** curve: **`blurPx ≈ 0.35 + d^1.88 * 47.2`**, fill **`× (0.18 + 0.82·d)`**, grain **`0.012 + d^1.48 * 0.32`**. **SvgShapeBase** **`inset(… round rpx)`**: **`rPx = min(rx·sx, ry·sy, 0.48·min(w,h))`**. Dropped **`will-change: backdrop-filter`** on inline layers.

### 2026-04-24 – Frosted glass: viewport-portal era (superseded same day)
**Superseded** by **“Frosted: viewport portal removed; inline glass only”** (above). Iterations involved **`FrostedGlassPortalLayer`**, **`#dw-frosted-root`**, **`#dw-frosted-glass-host`**, diagram-space vs fixed portaling, **`layoutSyncKey`**, **`overflow`/`clip-path`** on portal roots, **`body`** backdrop-root quirks, **`frostedGlassZIndex`**, and separating **`box-shadow`** from the blur surface. **Still in code**: [Hype4](https://hype4.academy/tools/glassmorphism-generator)-style **`glassBoxShadow`**, edge highlights, **`getFrostedGlassDropShadowLayerStyle`** / **`getFrostedGlassBackdropLayerStyle`**, **`frostedClipPathOverride`**, and PNG raster underlay — used by the **inline** stack.

### 2026-04-24 – Frosted diffusion: clip-path vs blur surface (`translateZ` removal)
**Symptom**: **Diffusion** slider did not update live blur. **Causes**: **`clip-path`** on the same layer as **`backdrop-filter`**; **`translateZ(0)`** sticking compositing. **Fix**: split **`clip-path`** to a wrapper; surface **`key`** on blur/tint changes; **`useLayoutEffect`** deps positioning-only where appropriate. **`shape-utils`**: removed **`translateZ(0)`** from **`getFrostedGlassSurfaceStyle`**.

### 2026-04-24 – Frosted diffusion slider: `DiagramNode` memo skipped re-renders
**`areDiagramNodePropsEqual`** did not compare **`frostedDiffusion`** / **`frostedTransparency`** / other fill-border color keys, so **`React.memo(DiagramNode)`** treated styling-only updates as equal and the canvas kept stale **`backdrop-filter`**. **Fix**: **`diagramNodeVisualStylingSignature`** in **`slide-visual-color`** (**`visualColorSignature`** + border width / shadow / rounded / **`nodeSize`** / **`noIconBackground`**) compared first when **`node` reference changes.

### 2026-04-24 – Frosted: `isFrostedBg` on SVG shapes (wrapper skip)
**`shape-wrapper`** treated **`skipWrapperStyling`** (**`SvgShapeBase`**) as “not frosted”, so **`isFrostedBg`** was false and rects stayed transparent. **Fix**: frosted follows **`backgroundStyle`** regardless of wrapper paint skip.

### 2026-04-23 – Shape fill: frosted glass (backdrop blur)
**`backgroundStyle: 'frosted'`** with **`frostedDiffusion`** / **`frostedTransparency`** (0–1) on **`DiagramNodeData`**. **Visual styling panel** + **`shape-wrapper`**, **`svg-shape-base`**, **`uml-class`**, **`text-box-heading`**; **slide color crossfade** includes frosted. Zod + **`SelectedItem`** updated. **Shipping note**: first used a **viewport portal**; **Apr 24** → **inline-only** stack (**`FrostedGlassPortalLayer`** removed).

### 2026-04-23 – Z-order: textbox vs connection lines (order-aware mode)
With **connections not forced behind nodes**, **`generic.text.textbox`** used the same **`100+2i+1`** stack tier as icons/plain text, so every textbox sat above all connection layers and lines always disappeared behind it. **`editor-canvas`** / **`viewer-canvas`** now treat **`generic.text.textbox`** like shapes (**`2*i+1`**) so edges interleave with layer order; **`generic.text.text`** unchanged (labels stay above connectors).

### 2026-04-22 – Cursor personal skill: Browser Use Cloud (`llms-full`)
Global (personal) skill installed at **`~/.cursor/skills/browser-use-cloud/`**: **`SKILL.md`** plus full **`llms-full.txt`** copied from https://docs.browser-use.com/llms-full.txt (2888 lines). Cursor-managed **`~/.cursor/skills-cursor/`** was not modified. Refresh the txt from the URL if docs drift. **Console:** https://cloud.browser-use.com — **`BROWSER_USE_API_KEY`** for this repo lives in **`.env.local`** (gitignored); do not commit.

### 2026-04-22 – Browser Use Cloud API key (workspace)
**`BROWSER_USE_API_KEY`** is set in **`.env.local`** (gitignored). Skill **`~/.cursor/skills/browser-use-cloud/SKILL.md`** updated with **https://cloud.browser-use.com** console/key workflow. If the key was ever pasted into chat or a public repo, rotate it in Cloud settings.

### 2026-04-19 – Export PNG: multi-slide deck (`{name}-{n}.png`)
When the active tab has a presentation deck with at least one **snapshot** (so **slide 1** = main diagram + **2…** = snapshots), **Export PNG** shows **Slides**: **All**, **Range** (from–to), or **Single** slide. Files are named **`{sanitized-tab-name}-{slideNumber}.png`**. Export temporarily switches the canvas per slide (persist-to-delta is suppressed during the run), uses the same **union-bounds** capture as thumbnails (`buildPresentationUnionDiagramsForPngExport` + `captureSnapshotPng`). **Multiple files**: prefers **Save to folder** (`showDirectoryPicker`) when available; otherwise sequential downloads. **Single slide** from the set uses **Save As** / one download. Sub-diagram drill-in disables the multi-slide section (single-viewport export only). **`export-dialog`**: `sanitizeExportBasename`, `presentationSlides` prop.

### 2026-04-19 – Presentation panel: remove empty-deck snapshot hint
**`presentation-editor-panel`**: Removed the muted line **“Add Snapshot to capture additional views of this diagram.”** shown when there was no deck or no extra slides.

### 2026-04-19 – Presentation strip: slide 1 thumbnail (base PNG)
**Unified presentation slides**: **`slides[0]`** is always the **main diagram** (stable id **`__dw_primary__-${deckId}`**, empty **`diagramDelta`** vs file root). Further slides are the former “snapshots”; deltas stay vs **master / tab** so playback still uses **`applyDiagramDelta(master, slide.diagramDelta)`** for every index. **Legacy** decks (implicit main + snapshot-only **`slides[]`**) are **migrated** via **`migratePresentationDeckToUnifiedSlides`** (IndexedDB **`normalizeDecks`**, **`collapsePresentationDecksToOne`**, **`extractEmbeddedPresentations`**). **`baseSnapshotImage`** is deprecated (thumb moves to **`slides[0].snapshotImage`**). **Editor**: **`activePresentationSlideId`** is never “base = null”; primary id selects the tab. **DnD**: index **0** fixed; **`onMoveSlide(from, 0)`** disallowed — drop on slide 1 calls **`onMoveSlide(from, 1)`**. **Viewer** / **player**: no synthetic base slide — same **`slides`** array as editor. **`viewer-utils`** **`normalizeViewerPresentation`** runs **`migratePresentationDecks`** then **`collapsePresentationDecksToOne`**. **`presentationEligible`** requires **`slides.length > 0`**.

### 2026-04-19 – Editor: slides merged into main flow (single deck per tab)
Presentation is always on: **slide 1** is the **main diagram** (tab); extra **snapshots** are deck slides. **No** separate presentation name, create/rename/delete deck, or exit mode. **IndexedDB** per-tab decks are **collapsed to one** unnamed deck on load (legacy multi-deck slides merged). **Player** prepends a synthetic base slide so playback includes the diagram. **Ctrl+Alt+P** starts playback only. **Layer structure** (add/remove/rename/reorder/assign) is allowed on the **main** slide; locked while editing a **snapshot**. **Sub-diagram** breadcrumb + double-click work on the main slide. New helper: **`presentation-deck-merge`** **`collapsePresentationDecksToOne`**.

### 2026-04-19 – Presentation: stop max update depth from `tabDiagramData` + master sync
**`diagram-editor`**: **`tabDiagramData`** used **`|| { nodes, connections, groupings }`**, so a **missing** `diagramData` produced a **new object every render**; the base-slide effect always **`setPresentationMasterDiagram`**, looping updates. **Fix**: **`EMPTY_TAB_DIAGRAM_FALLBACK`** constant; **`??`** for tab data; **`presentationMasterFromTabSyncKeyRef`** skips when **`${activeTabId}:${JSON.stringify(tabDiagramData)}`** unchanged; clear ref on tab switch. Slide hydration **`useEffect`** no longer lists **`tabDiagramData`** / **`presentationMasterDiagram`** (uses **`tabDiagramDataRef`** / **`presentationMasterDiagramRef`**) so master state updates don’t retrigger the same effect.

### 2026-04-19 – Component sidebar: form `reset` vs unstable `selectedItem` (max update depth)
**`component-sidebar`**: **`useEffect([selectedItem, reset])`** called **`reset()`** whenever **`selectedItem` reference changed** — common after IndexedDB hydrate / diagram sync — so **`reset` → re-render → new `selectedItem` ref → repeat**. **Fix**: effect deps use **`sidebarFormSyncSignature`** (**`JSON.stringify`** of form-relevant fields); latest item read from **`selectedItemRef`**. Removed unused **`ScrollArea`** import.

### 2026-04-19 – Resource browser: remove Radix Collapsible (max update depth)
**`resource-browser`**: Nested **Radix **`Collapsible`** inside **`ScrollArea`** could still hit **`Maximum update depth exceeded`** (layout/content measurement vs controlled `open`). **Fix**: **plain `Button` + conditional render** for provider/category/icon sections; **cookie** persistence for provider/category expansion in a **`useEffect`** (no **`document.cookie`** inside **`setState`** updaters). **`expansionCookieSyncRef`** skips writes until **`loadAll`** **`finally`**. List uses **`overflow-y-auto`** instead of Radix **`ScrollArea`**.

### 2026-04-19 – Viewer: single deck + base slide (matches editor)
**`viewer-utils`**: after **`extractEmbeddedPresentations`**, **`normalizeViewerPresentation`** runs **`collapsePresentationDecksToOne`**. **`viewer/page`**: synthetic **Diagram** slide first, then deck snapshots; slide strip + canvas are active at **root** whenever the file has a deck (no separate “enter presentation” toggle). **Fullscreen** **`PresentationPlayer`** uses the same list. **`viewer-presentation-bar`**: **`onExit`** is optional (omitted in viewer).

### 2026-04-17 – Connector line: Add point uses focused vertex segment
**Context menu** **Add point**: If a **vertex handle** was **click-selected** (**`connectorLineFocusedVertex`**) for that line, inserts the new point at the **midpoint of the segment after that vertex** (**`insertConnectorLinePointAfterVertexIndex`** in **`line-curve-path`**); **closed** loops support the closing segment (**`afterVertexIndex === n - 1`** → wrap). Otherwise keeps **longest-segment** behavior (**`insertConnectorLineMidControl`**). Both paths run **`syncClosedConnectorLineBorderWidth`** in **`editor-canvas`**.

### 2026-04-17 – Connector line: click vertex to delete that point (not the whole line)
**`LineVertexHandles`** / **`diagram-node`**: **Pointer down** uses a **5px** move threshold — **click** (no drag) calls **`onConnectorLineVertexFocus`**, which narrows selection to that line and stores **`connectorLineFocusedVertex`**. **Delete** (toolbar, context menu, keyboard with a **single** selection) runs **`removeConnectorLineVertexAtIndex`** (**`line-curve-path`**) when focus matches, then **`syncClosedConnectorVisualBorderFromLineStyling`** when the result is still a closed loop (otherwise no-op). **Multi-select** is cleared on vertex focus so Delete does not batch-remove other objects. **`handleItemSelect`** / **`handleBatchSelect`** clear vertex focus.

### 2026-04-17 – Closed connector line: select by clicking interior / fill
**`LineShape`**: The invisible hit path used open **`pathD`** with **`fill="none"`** and **`pointerEvents: 'stroke'`**, so closed loops only registered clicks on the stroke spine, not the enclosed area. For **`closed`**, the hit path now uses **`pathDClosed`**, **`fill="transparent"`**, and **`pointerEvents: 'all'`** (same thick transparent stroke as before for edge tolerance).

### 2026-04-17 – Connector lines cannot be connection targets
**`diagram-editor`** **`handleConnect`**: Early return when **`isConnectorLineNodeType(targetItem.type)`** so connect mode clicks never add edges **to** polyline / **`*.line`** nodes (sources unchanged). Connect handle and context **Connect** were already hidden for lines.

### 2026-04-17 – Line vertex handles: green endpoints, yellow interior
**`LineVertexHandles`** (`line-endpoint-handles.tsx`): **start** and **end** squares stay **green** (`#22c55e` / hover `#16a34a`); **interior** control points use **yellow** (`#eab308` / hover `#ca8a04`). Same 12px / white border as before.

### 2026-04-17 – Context menu: delete node/zone from label right-click
**`editor-canvas`** **`handleNodeContextMenu`** / **`handleZoneContextMenu`**: no longer bail out when the event target is an editable element, so right-click on **in-node text** (e.g. rich textbox **`contentEditable`**) opens the same canvas context menu and **Delete** works. **`context-menu`**: destructive action label is **Delete node** or **Delete zone** by **`itemType`**.

### 2026-04-17 – Line styling panel: two columns like visual styling
**`line-styling-panel`**: **Line** block in the **left** column, **Text** block in the **right** column — **`grid grid-cols-2 gap-x-8 gap-y-4`** with **`space-y-4 min-w-0`** column wrappers (same pattern as **`visual-styling-panel`**). Panel width **`640px`** with **`max-w-[calc(100vw-2rem)]`** so both columns fit.

### 2026-04-17 – Connector line: visual border stroke (solid / dotted / gradient)
**`LineShape`**: When the node has explicit **`borderStyle`** / **`borderColor`** / **`borderColors`** / **`borderWidth`** (from Visual Styling), draws a **stroke** along **`pathD`** or **`pathDClosed`** with **`useSvgGradient`** (fill + border gradients combined like **`RectangleShape`**). **`!hasVisualBorder`** keeps the previous **`lineColor`** / **`lineThickness`** stroke; caps use border paint when the visual border is active. Bounds padding includes border/line half-width.

### 2026-04-17 – Z-order: closed connector loops vs shapes and connections
**`editor-canvas`** / **`viewer-canvas`**: **`isConnectorLineGeometryClosed`** nodes use the **shape** tier **`stackZIndex: 2*i+1`** (same as rectangles in **`connectionSlots.sortedItemIds`** order), not **`100+2i+1`**, so a rectangle later in the list paints above a closed loop and an earlier one below. **Open** connector lines stay on the icon/label tier. Connection slot z stays **`2*i`** (same under/over rules as for rectangular shapes). **Connections-behind-nodes** mode: all nodes use **`10+i`** including closed loops.

### 2026-04-17 – Connector line: Line Styling color always paints the stroke
**`LineShape`**: When Visual Styling / theme set **border** fields, **`hasVisualBorder`** drew the visible path with **`borderStrokePaint`**, and the Line Styling path only rendered when **`!hasVisualBorder`**, so the **Line Styling** color picker had no effect on typical themed lines. The visible stroke is now **always** one path using **`lineBodyPaint`** (solid **`lineColor`** or line gradient). **`strokeDasharray`** prefers **Line type** (dashed/dotted); if solid, falls back to Visual border dotted. Border gradient defs are no longer used for this stroke. Caps match **`lineBodyPaint`**.

### 2026-04-17 – Line Styling: gradient line color (connector lines)
**Line Styling** panel: **Color style** **Solid** | **Gradient** (like Visual **Border**). Stores **`lineColorStyle`**, **`lineColors`** **[start, end]**, **`lineGradientAngle`** on the node. **`useSvgGradient`** supports an optional third gradient (**`lineColors`** / **`lineAngle`**) → **`lineStrokeRef`**. **`LineShape`** enables defs when **`needsLineBodyGradient`** and paints the body path and caps with **`lineBodyPaint`** (`url(#…)` or solid **`lineColor`**). Types / **`DiagramNodeDataSchema`** / **`DiagramNodeItemSchema`** / **`line-styling`** extract+apply updated.

### 2026-04-17 – Open connector line: Line thickness vs visual border stroke
**`LineShape`**: When **`hasVisualBorder`** (theme / Visual Styling border), the painted path used **`borderWidth`** for **`strokeWidth`**, so **Line thickness** had no effect on non-closed lines. The visible stroke now always uses **`lineThickness`** (fallback **`strokeWidth`** prop, default **2.5**); **`borderWidth`** only gates whether border **paint** (style / gradient / color) applies, not the geometric stroke width. Hit target padding follows **`actualStrokeWidth`**.

### 2026-04-17 – Closed connector line: `borderWidth` tracks `lineThickness`; theme skips border width
**Closed connector sync** (**`line-styling`**): **`syncClosedConnectorVisualBorderFromLineStyling`** copies line paint → Visual border (same fields as before). It runs only when the loop **first closes** (**`diagram-node`** drag end / vertex delete: **`!wasClosed && isNowClosed`**) or when **`applyLineStylingToNode`** touches a **line paint** key (`lineThickness`, `lineType`, `lineColor`, `lineColorStyle`, `lineColors`, `lineGradientAngle`) — **not** on every vertex drag while already closed, so **Visual Styling** border/gradient edits are not overwritten by stale line fields. While closed, geometry commits still run **`syncClosedConnectorLineBorderWidth`** (width ↔ thickness). Theme / Visual merges still end with width-only sync. **`LineShape`**: open → **`lineBodyPaint`**; closed → Visual **`borderStrokePaint`** when **`closedUsesVisualStroke`**.

### 2026-04-17 – Closed connector line: hide caps in Line Styling panel
**`LineStylingPanel`**: **`linePathClosed`** (**`isConnectorLineGeometryClosed`** on **`selectedItem` + draft `styling`**) hides **Start cap** / **End cap** controls; **`LineShape`** already skipped cap rendering when closed.

### 2026-04-17 – Connections: double-click inserts node; closed connector line fill + visual styling
**Double-click** a **bezier** or **orthogonal** connection (not read-only): nearest point on path (**`closestTOnConnectionPath`** / **`closestTOnOrthogonalPath`**), snapped; **`handleConnectionInsertNode`** in **`diagram-editor`** adds **`generic.object.rectangle`**, splits **`connections[index]`** into two edges (copies style; clears **`waypoints`**, trunk offsets; **first** leg keeps **connection text**; arrows: **to** only on second leg). Wired via **`onConnectionInsertNode`** → **`CanvasConnections`** → **`BezierConnection`** / **`OrthogonalConnection`** **`onDoubleClick`**. **`DiagramEditorInner`** receives the handler as a prop from **`DiagramEditor`**.

**Closed connector line** (**`isConnectorLineGeometryClosed`**, start/end within **6px**): **`LineShape`** closes path with **`Z`**, **`useSvgGradient`** + **`getShapeSvgFill`** for area fill from **`backgroundStyle`** / **`backgroundColors`**; caps suppressed when closed. **`context-toolbar`** / **`context-menu`**: **Visual Styling** for closed lines (**`isClosedConnectorLine`**), **`showFullStyling`** / **`isShape`** treat like shapes for the panel.

### 2026-04-17 – Connector line: straight polylines, smooth joints, add point always
**Straight** mode uses **`lineControlPoints`** as interior vertices (**`getConnectorLineVertices`** returns **`[start, ...stored, end]`** when any are stored). **`lineSmoothJoints`**: quadratic fillets at interior corners (**`straightPolylineToSvgPathD`** / **`flattenStraightSmoothInternal`**); context **Smooth joints** only when straight and ≥1 interior point. **Add point** in context menu for all connector lines (not only curved). **`connectorLinePathD`** picks Catmull (**curved**) vs straight polyline. Toggling **Curved line** clears **`lineSmoothJoints`**.

### 2026-04-17 – Connector line shape: curved path + draggable control points
**`generic.object.line`** (and `*.line` connector types): optional **`linePathStyle`** **`straight`** | **`curved`** and **`lineControlPoints`** (absolute canvas coords between **`startPos`** / **`endPos`**). **Catmull–Rom** → SVG cubics in **`line-curve-path`** (`getConnectorLineVertices`, `catmullRomToSvgPathD`, `insertConnectorLineMidControl`). **`LineShape`** draws a **`<path>`** with shared hit-stroke; label position uses arc-length sampling. **Context menu**: **Curved line** checkbox; **Add point** (midpoint of longest segment). **Handles**: **`LineVertexHandles`** — **12px** squares / white border: **green** start/end, **yellow** interior points (see entry above). **`diagram-node`** drags any vertex; **`measureNodeDims`**, **move/duplicate** in **`canvas-operations`**, **drag preview** in **`editor-canvas`**, and **`use-canvas-drag-drop`** anchor include control points. Toggling **curved** seeds one center point if none stored.

### 2026-04-17 – Layout menu: staircase horizontal / vertical step (multi-select)
**Layout** → **Step amount:** integer **-99…99** (non-zero; **0** / invalid → **1**), default **1**, persisted **`localStorage`** **`dw:layout-grid-step-amount`**. **Horizontal step** / **Vertical step** use custom **SVG** icons (vertical vs horizontal stepladder). **Horizontal step**: sort **leftmost** first (**`x`** then **`y`**), step **`y`** only (aligned with **horizontal curve**’s **y** axis); negative **step** → **up**. **Vertical step**: sort **topmost** first (**`y`** then **`x`**), step **`x`** only (aligned with **vertical curve**’s **x** axis); negative **step** → **right**. **`index × step × GRID_STEP`**. **vertical-curve** uses **selection order**; **horizontal-curve** sorts **left→right** (**`x`** then **`y`**). **Horizontal curve** / **Vertical curve** (Layout menu, custom **SVG** bumps: up vs left): **Vertical curve** — first item unchanged; **last** **`x`** snaps to first’s **`x`** (same column), **`y`** kept; middle **`y`** interpolates first→last, **`x = x0 + bulge*4*t*(1-t)`**. **Horizontal curve** — each **`x`** kept; last **`y`** snaps to first’s **`y`**; middle **`y`** = chord first→last **`y`** plus bulge. **Curve** bulge uses **Step amount**: **`max(GRID_STEP, |steps| * GRID_STEP)`** at the apex (not span-based); **step** sign flips bulge. **≥3** selections. Locked **nodes** skip moves (including aligned end if locked). **`GRID_STEP`** in **`canvas-constants`**.

### 2026-04-17 – Multi-select: tag + description (`info`) like labels
**`handleTagUpdate`**: Fans out **`tag`** to every selected **node** and **zone** when multi-select includes the edited id (same pattern as **`handleLabelUpdate`**). **`handleBulkMetadataUpdate`**: Toolbar / visual styling commits **`tag`**, **`info`**, and **plain toolbar label** to all selected nodes and zones (**`context-toolbar`** **`commitTagChange`** / **`commitInfoChange`** / **label** popover **`flushLabelChange`** + debounced **`handleLabelChange`**, **Visual Styling** tag field). **`top-menu-bar`** passes **`onBulkMetadataUpdate`**. **`handleItemUpdate`** also merges updates into **`zones`** when the id is not a node (fixes zone **tag** / **description** from the toolbar). **`diagram-node`**: **`tagEditDirtyRef`** avoids multi tag blur fan-out without edits. Bulk **label** clears **`richLabel`** only on **`generic.text.textbox`** / **`generic.text.text`** nodes (same as single-item toolbar).

### 2026-04-17 – Multi-select: inline label edit applies to all selected nodes
**`diagram-editor`** **`handleLabelUpdate`**: When **`selectedItemIds.size > 1`** and the edited **`nodeId`** is in the set, **`label`** / **`richLabel`** update every **node** id in the selection (non-node ids ignored). **`selectedItem`** stays in sync when it is one of those nodes. **`diagram-node`**: plain icon label uses **`plainLabelEditDirtyRef`** so a **blur without edits** does not fan out; **rich** label submit skips multi fan-out when normalized **runs** are unchanged (blur-only), avoiding accidental mass rewrites.

### 2026-04-17 – Context menu: Auto-number multi-select labels
**`context-menu`**: **Auto-number** (when ≥2 nodes/zones are selected) sets each label to **`{n}`** or **`{n} {text}`** (number **before** text). If the label already starts with digits, that leading number is **replaced** by **`n`** (**`formatLabelWithLeadingAutoNumber`** / **`bodyAfterLeadingNumericToken`** in **`auto-number-labels`**). **Anchor** = first selected object in **`selectedItemIds`** insertion order among nodes/zones. **Order** for the rest: ascending distance from the anchor’s **bounding-box center**. **Rich** textboxes: joined to plain, reformatted, then **`richLabel`** is cleared so **`label`** is canonical. **`editor-canvas`**: one **`setDiagramData`** pass.

### 2026-04-17 – Marquee batch select: same diagram as canvas (`displayDiagramData`)
**`diagram-editor`** **`handleBatchSelect`** resolved hits against root **`diagramData`** (tab) while **`useCanvasSelection`** / **`EditorCanvas`** use **`displayDiagramData`** (current sub-diagram + visible layers + layer-animation snapshot). That mismatch dropped or mis-resolved connection ids, so **`selectedItemIds`** did not match what was highlighted and right-click called **`onItemSelect`** and collapsed the set. **Fix**: resolve batch IDs from **`displayDiagramData`**. **`handleItemSelect`**: shift-anchor **`getSelectionIdKind`** uses **`currentDiagramData`**; edge preserve-multi uses **`displayDiagramData.connections`**. **`canvas-connections`** memo compares **`selectedItemIds`** with **`stringSetsEqual`** (not reference-only).

### 2026-04-17 – Connection multi-select: canonical id matching (highlight vs selection set)
**`connection-order-utils`**: **`stableDiagramConnectionId`** (moved from **`diagram-editor`**), **`connectionSelectionIdMatches`**, **`isDiagramConnectionInCanvasSelection`**, **`selectionSetContainsConnection`**. **`canvas-connections`**: glow highlight, context-menu “already selected”, click **`id`**, and toolbar primary detection use these helpers so **uuid** rows still match **from-to-index** (or unique **from-to**) ids left in **`selectedItemIds`** after marquee / **`ensureConnectionIds`**. Right-click on any highlighted line no longer replaces the set with a single edge. **`diagram-editor`**: **`handleItemSelect`** preserve-multi path uses the same matching for plain clicks on edges.

### 2026-04-17 – Multi-select: plain click keeps the set when re-selecting a member
**`diagram-editor`** **`handleItemSelect`**: On a **non-shift** click, if **`selectedItemIds.size > 1`** and the clicked item’s **`id`** is already in the set, only **`setSelectedItem`** updates (new **primary**). **`selectedItemIds`** is no longer collapsed to a single id — so marquee / multi-selected **connections** stay selected when you left-click another selected line before opening the connection modal or using bulk style. Aligns with **right-click** on an already-selected edge (context menu did not call **`onItemSelect`**).

### 2026-04-17 – Multi-select connections: all properties fan-out + animation dialog bulk
**`diagram-editor`** **`handleConnectionUpdate`**: Fan-out when **`connectionIdsFromSelectionSet`** resolves **more than one** edge (no longer requires **`selectedItem.itemType === 'edge'`** + raw set size). **`updates.animation`** with multiple edges uses the same **`applyConnectionUpdates`** path as other fields so **full** patches apply to **all** selected links. Animation enable/disable dialog stores **`applyAllConnectionIds`**; confirm handlers (**apply selected** / **disable** / **overwrite**) call **`applyConnectionUpdates`** with that list so **combined** updates (e.g. color + animation) apply everywhere. **`applyAnimationToCurrentAndSelected`** matches peers by **`stableDiagramConnectionId`** (and uuid). **`hasOtherExistingAnimation`** uses the same stable/id matching for peer checks.

### 2026-04-17 – Multi-select connections: bulk line style (e.g. gradient end)
**`diagram-editor`**: **`connectionIdsFromSelectionSet`** now resolves **`from-to-index`** keys for **id-less** connections (and unique **`from-to`** legacy keys) to the same **stable id** as **`applyConnectionUpdates`** (**`stableDiagramConnectionId`**), so fan-out patches (**`color`**, **`colorEnd`**, etc.) apply to **every** selected edge instead of only edges with stored **`id`**.

### 2026-04-17 – Match source outline: helper text in tooltip
**`connection-line-style-fields`**: Removed inline description under **Match source outline color**; same copy is shown in a **`Tooltip`** on a small **info** icon next to the label (**`aria-label`**: how it works).

### 2026-04-17 – Connection modal: layout (delete + routing controls in right column)
**`connection-context-modal`**: **Delete** is at the **top** of the **right** column. **Smooth corners**, **Center on edge**, and **Attach on side** sit **below** the **Text position** slider (same column). Left column keeps line type, arrow, stroke, and **`ConnectionLineStyleFields`**.

### 2026-04-17 – Orthogonal Z-routes: draggable trunks (X + Y)
**`orthogonalTrunkOffsetX`** / **`orthogonalTrunkOffsetY`** on **`DiagramConnectionData`** (Zod **`schemas`**): optional px offsets from the auto **Z-route** midline — **X** for **horizontal-first** routes (vertical trunk, **ew-resize** drag), **Y** for **vertical-first** routes (horizontal trunk, **ns-resize** drag; negative moves the bus **up** when the link runs top→bottom). **`mergeOrthogonalTrunkWaypoints`** composes **`mergeOrthogonalWaypointsWithTrunkOffset`** / **`mergeOrthogonalWaypointsWithTrunkOffsetY`**; **`findOrthogonalTrunkVerticalSegment`** / **`findOrthogonalTrunkHorizontalSegment`** pick the draggable segment. No manual **`waypoints`**: same injected corner pairs the router already supports. **`canvas-connections`** batch + **`OrthogonalConnection`** local compute; **`onOrthogonalTrunkOffsetChange`** / **`onOrthogonalTrunkOffsetYChange`** → **`onConnectionUpdate`**. With **multi-selected edges**, trunk drags **fan out** (same as color/style): all resolved ids in **`connectionIdsFromSelectionSet`** get the same offset; waypoint-only edits still skip fan-out. **`use-slide-transition`**: both offsets count like waypoint changes. **`stripConnectionDefaults`** omits zero offsets.

### 2026-04-17 – Connections: match source object line color
**`useSourceLineColor`** on **`DiagramConnectionData`** (Zod **`schemas`**): checkbox **Match source outline** in **`connection-line-style-fields`** (checked state uses **`isUseSourceLineColorOn`** for loose JSON). Paint uses **`sourceOutlineTintForConnection`**: **visible border first** (**`borderColors`** / **`borderColor`** when **`borderStyle` ≠ `none`**), then **`lineColor`**, then zone **`color`**, icon **`iconColor`** — so gradient stroke isn’t overridden by a stale theme **`lineColor`** (e.g. orange). Match-source **fallback** skips default edge greys **`#6b7280` / `#9ca3af`**. **Icon** **`diagram-node`** applies stored border on the icon tile when not selected/targetable. Bezier **`connectionDataKey`** / orthogonal **`connectionDataEqual`** use **`isUseSourceLineColorOn`** for memo equality.

### 2026-04-17 – Multi-select connection lines (marquee + bulk style)
**`use-canvas-selection`**: **`computeMarqueeSelectionPlan`** — drag-box picks **either** fully contained nodes/zones **or** intersecting connections (never mixed): the mode follows whichever candidate is **first** in top→left order (**`y`** then **`x`**). Connection hits use stable **`connection.id`** (fallback **`from-to-index`**). Live marquee returns **`selectionMarqueeMode`** (**`connections`** → green overlay; otherwise blue). **`diagram-editor`**: **`handleBatchSelect`** stores resolved ids; **`handleConnectionUpdate`** applies partial patches to **all** selected edges when **`selectedItemIds.size > 1`** (skips **`waypoints`** so geometry edits stay single-edge). **Shift+click** additive selection refuses mixing objects with connections (anchor = first id in the working set). **`editor-canvas`**: context-menu **Group** disabled when selection is connection-only (**`canGroupSelectedCanvasItems`**).

### 2026-04-17 – Themes menu: configurable multi-select hue step
**`theme-menu-selector`**: **Hue step (°)** number field (only visible when **Step hue for multi-selection.** is on) — persisted in **`localStorage`** key **`diagram-weaver-theme-multi-hue-step-deg`**, clamped **1–360**, default matches **`DIAGRAM_THEME_HUE_STEP_DEG`**. **`ThemeMenuApplyOptions.multiSelectHueStepDegrees`** is passed when applying a theme; **`diagram-editor`** **`handleThemeApplyToSelected`** multiplies layout index by this step instead of always using **`DIAGRAM_THEME_HUE_STEP_DEG`**.

### 2026-04-15 – Shapes: optional “pass-through” for orthogonal connector routing
**`ignoreConnectionAvoidance`** on **`DiagramNodeData`** / **`DiagramZoneData`** (and nested item schemas): when **`true`**, **`buildObstacleCatalog`** and **`collectObstacles`** omit that item via **`actsAsConnectorRoutingObstacle`** in **`orthogonal-routing`**, so **orthogonal** links may run through the bounds. **Visual Styling** panel **Connectors**: switch **Let lines pass through**. Bezier curves were already unaffected by obstacle rects.

### 2026-04-14 – Canvas drag: fast orthogonal + shared obstacle catalog
**`orthogonal-routing`**: **`OrthogonalRouteOptions.fastObstacleRouting`** — skips A* / obstacle-aware bridging; L/Z **`findFallbackRoute`** on empty obstacles + **`ensureApproachSegment`** / **`enforceOrthogonalSegments`** with no rects. **`buildObstacleCatalog`** + **`obstaclesForEndpoints`** (one diagram scan, filter per link). **`editor-canvas`**: **`isCanvasItemDragging`** + **`notifyDraggingChange`** wraps **`onDraggingChange`** (hook + **`DiagramNode`**). **`CanvasConnections`** **`orthogonalFastRouting={isCanvasItemDragging}`** passes through batch + toolbar fallback; **`OrthogonalConnection`** skips **`collectObstacles`** when **`route`** is precomputed; memo no longer compares **`nodesById`** refs, adds **`orthogonalFastRouting`**. Full obstacle-aware routing returns on release.

### 2026-04-14 – Canvas drag perf: connections layer (investigation)
Dragging updates **`displayNodesById`** every frame (**new object** from **`nodesWithDragPositions`**), so **`CanvasConnections`** **`React.memo`** (`nodesById` ref equality) always re-runs. **`canvas-connections`** recomputes for **all** edges each frame: edge grouping pass, **`getOptimalConnectionPoints`**, and **per-connection **`collectObstacles`** (full scan of all nodes/zones × orthogonal count). **`computeOrthogonalRoutesBatch`** reruns for all orthogonal links. **`OrthogonalConnection`** memo also requires **`prev.nodesById === next.nodesById`**, so it rarely skips during drag even when **`route`** is unchanged. **Bezier** child memo can skip for fixed endpoints, but parent work dominates. Levers: single shared obstacle build per frame; stable props / drag-overlay split; relax orthogonal memo to compare **`route`** + geometry not map refs; optional fast orthogonal during drag.

### 2026-04-14 – ResourceIcon: no catalog fetch for chart types
**`resource-icon`**: **`useEffect`** skips **`/resources/resource-generic.json`** lookup for **`generic.chart.*`** (**`isChartNodeType`**). Those types render inline pie/bar/line glyphs; the JSON has no **`chart`** category, so the previous fetch logged **Category not found: chart** in dev.

### 2026-04-14 – Connect mode: multi-select sources
**`diagram-editor`**: **`startConnecting`** builds **`pendingConnectionSourceIds`** from all selected **node** and **zone** ids (skips connection-only selection entries); explicit **`sourceItemId`** stays single-source (e.g. context-menu / canvas flows). **`handleConnect`** adds one **connection** per source to the clicked target (dedupes ids, skips self-loops). Window cleanup uses **`clearPendingConnectionWindowState`**.

### 2026-04-14 – Highlight pulse: non-rect object shapes use SVG silhouette
**`highlight-anim`**: **`ensureHighlightAnimKeyframes`** **`silhouetteMode`** **`box`** vs **`alpha`** (drop-shadow-only keyframes). **`getHighlightAnimStyleForNode`**: **`pulseFollowsShapeSilhouette`**. **`utils`**: **`isHighlightPulseShapeSilhouetteType`** — true for **`generic.object.*`** except connector **lines**, **square**, **rectangle**, **rounded-rectangle**, **text-box-heading**, **uml-class** (charts are not **`generic.object.`**, so they keep the outer-frame pulse). **`diagram-node`** moves **`data-dw-highlight-anim`** + animation **`style`** to the inner wrapper around **`renderShape()`** when silhouette applies (circle, triangle, star, kite, parallelogram, trapezoid, hexagon, loop, …).

### 2026-04-14 – Charts: lock segment values + 2dp data values
**`valuesLocked`** on **`NodeChartSpec`** (pie / bar / line): Chart data modal switch **Lock segment values** — when on, canvas drag (and inline value edit on the shape) is disabled; the modal still edits numbers. **`roundChartDataValue`** / **`formatChartValueForEdit`** in **`chart-node`**: stored chart magnitudes round to **2** decimal places (modal save, bar/line CSV lists, pie rows, and commits from **`diagram-node`**). **`roundChartDragValue`**: pointer **drag** on pie / bar / line commits **whole non-negative integers** only (tooltips use the same); typed inline edit on the chart still allows decimals → **2dp** via **`diagram-node`**. Zod **`schemas`** accepts **`valuesLocked`**.

### 2026-04-14 – Highlight UI + Windows: styling source, transition clash
**`getCurrentVisualStyling`** always resolves the node from **`diagramData.nodes`** (single-select was using stale **`selectedItem`**, so duration/interval prefilled as defaults). **Highlight** fields use focus-aware draft sync. **Pulse** keyframes add **`filter: drop-shadow`** + **`type="text/css"`** on injected **`<style>`**, **`will-change`**, **`cssColorForKeyframes`**; when **`highlightAnim`**, node wrapper uses **`transition-transform`** only so **`transition-[transform,filter]`** does not fight **`box-shadow`/`filter`** keyframes (helps some **Chrome/Windows** builds).

### 2026-04-14 – Visual styling: highlight animation on nodes
**`highlightAnim`** (+ **`highlightAnimDurationSec`** default **1s**, **`highlightAnimIntervalSec`** default **5s**, **`highlightAnimGlowColor`**) on **`DiagramNodeData`**: repeating **box-shadow** glow on the node wrapper; phase: **canvas-wide** **`buildHighlightAnimStaggerOrder`** sorts by **`y`** then **`x`**, assigns stagger **`n - 1 - i`** so the wave runs **top-down** (reversed from bottom-up); **editor-canvas** / **viewer-canvas** pass **`highlightAnimStaggerIndex`/`Count`** into **`DiagramNode`**; local sin hash fallback when stagger isn’t passed. **Visual Styling** panel **Effects**: checkbox **Highlight animation** plus duration, interval, and glow color (icons/emojis get the same block when the compact panel is shown). **GIF export** / **`prefers-reduced-motion`**: animation disabled. Zod + nested hierarchy round-trip for the new fields.

### 2026-04-14 – Presentation: chart segments stagger on slide change
**`use-slide-transition`**: **`chartPresentationSignature`** (full **`node.chart`** JSON) detects pie/bar/line data changes between slides; **`chartSlideStagger`** is passed on **`nodeTransitionStyles`**. **`suppressChartOuterScale`** (**`isChartNodeType`**, not disappearing) skips **all** wrapper **CSS scale** during slide transitions so the chart never animates as one scaled box (including resize-only and appear). **`chart-presentation-stagger`**: sequential **opacity-only** keyframes (no segment scale) + **`CHART_SLIDE_SEGMENT_STAGGER_MS`** (~58ms) between segments; slide duration extends when many segments need to finish. **`PieChartShape`** / **`BarChartShape`** / **`LineChartShape`** apply staggered **`animation`** on each slice/bar/series group; **`diagram-node`** passes **`presentationChartStagger`** when chart data changed **without** compatible value-only lerp, when a chart **newly appears**, or when a chart **disappears** (**`ChartSlideStagger.exit`**: paired **in/out** keyframes; **`isDisappearingChart`** keeps wrapper opacity/transform/scale steady while segments fade out in sequence). Post-transition cleanup skips **`opacityEnd === 1`** resets for **`isDisappearing`** nodes. **`chart-slide-lerp`**: when **`chartSlideLerpCompatible`** (same kind, topology, bar **`vertical`/`stacked100`**) **`chartLerpU`** is RAF-eased over the slide duration and shapes blend numeric values (**`lerpNodeChartForSlide`**) so bars/pies/lines **grow/shrink** per data instead of whole-node scale. **`nodeDelayMs`** stored on **`SlideAnimation`** for lerp timing. **Labels**: pie segment text sits in the same staggered `<g>` as the wedge; **bar** in-bar name/value overlays and **legend** rows use the same stagger index as that segment’s bars (**`barLegendStaggerIndex`** = earliest column for the segment); **line** point labels stay inside the per-series `<g>` and **legend** rows use the series index as the stagger step.

### 2026-04-14 – New pie / bar charts: theme drives slice colors
**`canvas-operations`**: Palette drops reuse one random built-in **`DiagramTheme`** (same as other shapes). After **`chart`** is set, **`themeManager.applyThemeToItem`** runs for **`generic.chart.pie`** and **`.bar`** so series **`fillStyle` / `color` / `gradientColors`** match the theme (same path as applying a theme in the UI), instead of staying on the default slice palette.

### 2026-04-14 – Top bar: hide app version / build chip
**`top-menu-bar`**: Removed the **`{semver} · {build}`** label (was **`APP_SEMVER` · `APP_BUILD`**). Version info remains available elsewhere (e.g. **Help → About**) via existing app version module.

### 2026-04-14 – Top bar: hide zoom readout
**`top-menu-bar`**: Removed the **Zoom: …%** (and **k:**) label from the header; **`transform` / `onTransformChange`** props were dropped from **`TopMenuBar`** (unused after the label). **`diagram-editor`** still owns **`canvasTransform`** / **`setCanvasTransform`** for the canvas. **`presentation-player`**: removed the slide-zoom **…%** badge next to “Slide N of M” in the playback toolbar (manual zoom % input in advanced controls unchanged).

### 2026-04-14 – Themes: step hue across multi-selection by layout
**`theme-menu-selector`**: Checkbox **Step hue for multi-selection.** above the theme list (persisted in **`localStorage`**). **`ThemeMenuApplyOptions.multiSelectHueByLayout`** is passed when applying a theme. **`selection-theme-order`**: orders selected node/connection ids by **top→bottom** when vertical spread ≥ horizontal spread, else **left→right** (connection anchor = midpoint of endpoint node centers). **`theme-manager`**: **`ThemeApplicationOptions.hueShiftDegrees`** shifts theme colors on nodes/connections and adds to chart series hue (**`DIAGRAM_THEME_HUE_STEP_DEG`** export, replaces internal chart-only constant). **`diagram-editor`** **`handleThemeApplyToSelected`** uses per-id hue index × step when the option is on and **>1** item is selected.

### 2026-04-14 – Editor shell flex hardening + canvas drag cleanup
**`diagram-editor`**: **`main`** and nested canvas column wrappers use **`min-h-0`** so **`flex-1`** children can shrink inside **`h-screen overflow-hidden`** without clipping or squashing chrome in WebKit-style layouts. **`<header>`** uses **`shrink-0`** so the menubar/tab stack is not compressed. **`use-canvas-drag-drop`**: global **`mouseup`** now clears **`isDraggingRef`**, **`axisLockRef`**, and calls **`onDraggingChange(false)`** when a canvas drag was active so cancelled drags do not leave stale drag state.

### 2026-04-14 – Pie chart: drag wedge to edit segment value
**`pieSlicesForSvg`**: each real wedge includes **`seriesIndex`** (source row; skips zero‑contribution slices in render order). **`PieChartShape`**: hit path **`data-dw-pie-slice-value-handle`**, pointer capture, **`ns-resize`**, **`onPieSliceValueChange`** / **`onPieChartValueDragSessionChange`**; vertical drag uses **`chartValueFromVerticalValueAxis`** over the pie bounding band (**`VB_CY ± VB_R`**) with a frozen **`valueSpan = max(1, sum, slice×2)`** and the same **delta-from-grab** pattern as the bar chart. **`diagram-node`** wires value updates (**`≥ 0`**) and extends **`chartValueDragInteractionRef`** **`closest(...)`** guards (HTML5 **`onDragStart`** + touch) to pie handles. Segment label inline edit keys off **`seriesIndex`** so names match data when some rows are hidden.

### 2026-04-14 – Pie chart: default size, two slices, segment separation
New **`generic.chart.pie`** palette drops: **410×320** (was **60×60** via generic shape fallback). **`defaultPieChartSpec()`**: two series (**100** + **50**), **`segmentGapDeg: 1`** (chart-default radial pull).

### 2026-04-14 – Bar chart: drag segment to edit values (line chart parity)
Bar rects use **`data-dw-bar-cell-value-handle`**; **`BarChartShape`** **`onBarChartValueDragSessionChange`** gates node DnD while dragging (pointer capture, **`ns-resize`** / **`ew-resize`** by axis). Value drag uses **delta from grab**: **`startAxisValue`** (axis reading at pointerdown) and **`startCellValue`** (that slice’s data from the same layout as the rect) so moves apply **`max(0, startCellValue + axis − startAxisValue)`** without reading **`series`** on each move — avoids stale React state after a prior drag when switching segments. Value mapping shares **`chart-pointer-geometry.ts`** with the line chart. **`diagram-node`** **`chartValueDragInteractionRef`** replaces the line-only ref so **`useDrag`** **`canDrag`**, **`onDragStart`**, and **`handleTouchStart`** all treat line point handles, bar value handles, and pie slice handles the same.

### 2026-04-14 – Bar chart: default size, sample data, display toggles
New **`generic.chart.bar`** palette drops: **380×280** (was **100×68**). **`randomBarChartSpec()`** — two segments × **4** categories, values **1–100** random — used for new nodes (**`defaultChartSpecForNodeType`**); **`defaultBarChartSpec()`** stays a fixed **1–100** sample for preview / editor fallbacks. Defaults: **segment names in bars off**, **values in segments on**, **both grids on**, **bottom legend on**.

### 2026-04-13 – Palette: pie + bar + line chart vector thumbnails
**`resource-icon.tsx`**: **`ChartPalettePieGlyph`**, **`ChartPaletteBarGlyph`**, **`ChartPaletteLineGlyph`** (axes + polyline + dots). **`generic.chart.pie`** / **`.bar`** / **`.line`** use these instead of catalog images where wired. **`draggable-resource-item`** / **`resource-browser`**: **`line-chart`** slug → **`generic.chart.line`**. Catalog asset **`line-chart.svg`** under **`generic/object/`** for non-ResourceIcon contexts.

### 2026-04-13 – Line chart vs connector line type guard
**`isConnectorLineNodeType`** in **`utils.ts`**: true for **`generic.object.line`** and types ending in **`.line`**, but **false** for **`generic.chart.line`** (and any **`*chart.line`**). Replaces **`endsWith('.line')`** checks that misclassified line charts as polyline nodes (**`diagram-node`** had **`pointer-events: none`** and no **`onClick`** on the wrapper). Updated **editor-canvas**, **context-toolbar**, **canvas-constants**, **canvas-operations**, **use-canvas-drag-drop**, **context-menu**, **resource-icon**.

### 2026-04-13 – Line chart: new node size + random sample data
New **`generic.chart.line`** nodes from the palette: **470×320** (was 100×68); bar chart unchanged. **`randomLineChartSpec()`** in **`chart-node.ts`**: two series × **5** categories, values **1–100** random; used by **`defaultChartSpecForNodeType`** and empty **Chart data** save. **`defaultLineChartSpec()`** stays a fixed sample for preview / editor fallbacks.

### 2026-04-13 – Line chart: point drag vs node drag (HTML5 DnD)
Hit circles use **`data-dw-line-chart-point-handle`**. **`LineChartShape`** **`onLineChartPointDragSessionChange`**: **`true`** on point **`pointerdown`** (after **`ownerSVGElement`** check), **`false`** on **`pointerup`** / **`pointercancel`** / **`lostpointercapture`**; **`onMouseDownCapture`** **`stopPropagation`** on the hit circle. **`diagram-node`** **`chartValueDragInteractionRef`** (shared with bar value drags) gates **`useDrag`** **`canDrag`** so react-dnd never starts a node drag while a point is held. **`onDragStart`** **`preventDefault`** + **`handleTouchStart`** skip remain as extras.

### 2026-04-13 – Line chart: drag points to edit values
**`LineChartShape`**: pointer **capture** on dot hit-circles; **client → SVG user** coords via **`getScreenCTM().inverse()`**; value from Y with **`lineChartValueFromSvgY`** (same scale as **`buildLineChartLayout`**). **`onLinePointValueChange`** on move (read-only / no handler = no drag). **Double-click** inline edit suppressed briefly after a drag (**`DOT_DRAG_SUPPRESS_DBLCLICK_PX`**). Pointer leave during drag does not clear the tooltip.

### 2026-04-13 – Line chart: per-series line color in Chart data
Each **`series`** row uses **`ChartBarSegmentItem.color`** (and **`gradientColors`** when style is gradient) for the polyline and markers (**`buildLineChartLayout`**). **Chart data** modal (line mode): clearer labels (**Series style**, **Line color** when **Line only**, **Line & area** for solid/gradient), collapsed row **color swatch**, and **Save** now keeps **`color`** when **`fillStyle: 'none'`** (line + bar save paths) so “line only” picks persist.

### 2026-04-13 – Line chart: line width slider
**`lineStrokeWidth`** (**0.25–4** viewBox units) on **`NodeChartSpecLine`**; **Chart data** modal **Line width** slider. **`resolveLineChartPolylineStrokeWidth`** / **`lineChartPolylineStrokeFallbackFromNodeBorder`** in **`line-chart-layout.ts`**: when omitted, polyline width stays the legacy formula from the node border. **`LineChartShape`** and **`shape-preview`** use the resolver.

### 2026-04-13 – Line chart: marker size slider (0–3)
**`dotRadius`** clamped **0–3** in schema; **Chart data** modal **Marker size** slider (step **0.05**), disabled when **Point markers** off. **0** with markers on hides dots; omitted **`dotRadius`** still defaults to **~1.85** in **`LineChartShape`** / **`shape-preview`**.

### 2026-04-13 – Line chart node (`generic.chart.line`)
**Palette**: Generic → Object → **Line chart**. **`chart.kind: 'line'`** — same **`series`** row shape as bar (**`values[]`** per category) but each row is a **line** (not stacked). **`NodeChartSpecLine`**: **`showAreaFill`** (vertical gradient **opacity at line →0 at baseline** via **`areaFillOpacity`**), **`smooth`**, **`showDots`**, **`dotRadius`**, **`lineStrokeWidth`**, grids / axis / legend / **`categoryLabels`** like bar. **Render**: **`LineChartShape`** + **`buildLineChartLayout`** (`line-chart-layout.ts`). **Modal**: **`chart-data-editor-modal`** **cartesian** branch with line-only toggles. **Preview**: **`shape-preview`**. **Themes**: **`applyThemeToItem`** treats **`line`** like **`bar`** for series colors. **Schema**: **`NodeChartLineSchema`** in discriminated union.

### 2026-04-13 – Bar chart: wrapped category / legend / segment labels + axis font sizes
**`NodeChartSpecBar`**: optional **`categoryLabelFontSize`** and **`legendLabelFontSize`** (2–14 SVG units; schema + **Chart data** modal sliders with **Use default**). **`buildBarChartLayout`** word-wraps category, legend, and reserves **`marginL`** / bottom bands from line counts (**`wrapBarLabelLines`**, **`estimateBarLabelLineWidth`**). **`BarChartShape`** / **`shape-preview`**: segment names use **`BarSvgTextBlock`** / **`BarPreviewTextBlock`** (`<tspan>` lines); legend swatch aligns to **`legMidY`**.

### 2026-04-13 – Bar chart: legend nudged up (~50% of legend band)
**`BarChartShape`** / preview: bottom legend uses small **`legendYLift` (~1.5)**; **`buildBarChartLayout`** tightens the real gap by a smaller **`legendBand`** tail (**`rowH + 1.25`** vs **`+ 5`**) and **`verticalBelowPlot` 5** when a legend is on (was **`9 + categoryBand + legendBand`** for all vertical bars).

### 2026-04-13 – Bar chart: segment hover shows value when values not in-bar
**`BarChartShape`**: if **`showSegmentValues`** is off, each segment uses the same **portaled tooltip** pattern as the pie (**`createPortal`**, **~140ms** delayed **`pointerLeave`**, invisible **hit** rect + **`pointer-events: none`** paint rect). **`formatAxisNumber`** matches axis / in-bar formatting. **Segment name** `<text>` (name-only overlay) shares **`barRectValueTooltipHandlers`** so hovering the label doesn’t drop the tip. **`shape-preview`** bar branch matches for the palette.

### 2026-04-13 – Pie chart: segment hover shows value
**`pieSlicesForSvg`** adds optional **`tooltipValue`** on each **`PieSliceRender`** (from the matching series row; omitted for empty/placeholder discs). **`PieChartShape`** and **`shape-preview`** show the formatted value (**`toLocaleString()`**) via **`createPortal`** to **`document.body`** (fixed UI near the pointer): native SVG **`<title>`** tooltips were unreliable inside transformed/filtered SVG on the canvas. **Stability**: invisible **hit** path under the painted wedge ( **`pointer-events: none`** on the visual path) plus **~140ms** delayed clear on **`pointerLeave`** so hover stroke / hit-testing gaps don’t flicker the tooltip. **Segment labels** use the same **`slicePointerHandlers`** as the wedge (and **`pointer-events: auto`** when a value tooltip or inline edit applies) so moving onto the text doesn’t drop the tooltip.

### 2026-04-13 – Bar chart: double-click inline text (pie-style)
**`BarChartShape`**: **`foreignObject`** inputs for **segment names** (in-bar or **legend**), **category axis labels** (`categoryLabels`), and **in-bar numeric values** when **`showSegmentValues`**. **`diagram-node`** wires **`onBarCategoryLabelChange`** and **`onBarCellValueChange`** (values clamped **≥ 0**). One active inline editor at a time (`segment` / `category` / `value`). Inline fields use the **same anchor** as the matching **`text`** (`dominantBaseline="middle"`). **`foreignObject`** height is **1em** (font size); **`svgForeignObjectInlineInputStyle`** in **`shape-utils.ts`** strips UA padding / appearance so `<input>` matches SVG text. Width uses **`chartInlineForeignObjectWidth`** (grows with typed length, cap **220** SVG units). Two-line name+value edit stacks from the **name line center**. **`PieChartShape`** uses the same helpers (no flex wrapper).

### 2026-04-13 – Bar chart: uniform scaling (labels match pie)
**`BarChartShape`** + **`shape-preview`** bar branch: **`preserveAspectRatio="xMidYMid meet"`** (was **`none`**), same idea as **`PieChartShape`** — chart scales **uniformly** when the node is resized so **text and strokes are not stretched**; letterboxing may appear if the node aspect ratio ≠ viewBox (**100×** dynamic height).

### 2026-04-13 – Bar chart: rounded column ends (toggle)
**`NodeChartSpecBar.roundedColumnEnds`**: boolean like other shape rounding toggles. Cap radius is **auto** from bar thickness in viewBox units (**`barColumnAutoRoundRadius`**). Clip paths use **quadratic** corners. Legacy **`columnCornerRadius` > 0** in JSON maps to **`roundedColumnEnds`** in **`normalizeChartField`**. **Chart data** modal: **Rounded column ends** switch.

### 2026-04-13 – Bar chart: slice outline follows rounded column cap
**`BarChartShape`** (and **`shape-preview`**): fills stay **clip-path** rounded; **per-rect stroke** lived inside the same clip, so the **outer** stroke was sheared flat. **Fix**: **fill-only** rects inside the clip, then an **unclipped** **`path`** stroked with the same **`d`** as the column clip (**`strokeLinejoin="round"`**). Hover thickens that column outline when **`hoveredKey`** matches the category.

### 2026-04-13 – Bar chart: values in segments + bottom legend
**`NodeChartSpecBar`**: **`showSegmentValues`** draws the numeric value in each segment (when large enough); with **segment labels** on, name and value stack on two lines when space allows. **`showLegend`** reserves bottom band and draws **swatch + segment name** per stack row. **`bar-chart-layout`** adds **`value`** on each **`BarRect`** and expands **`marginB`** for the legend band; category labels sit just below the plot. **Chart data** modal: **Values in segments** and **Bottom legend** switches. **`shape-preview`** matches.

### 2026-04-13 – Bar chart node (`generic.chart.bar`)
**Palette**: Generic → Object → **Bar chart** (vector glyph in **`ResourceIcon`**; catalog may still list `bar-chart.png` for legacy file fields). **Data**: `chart.kind: 'bar'` — **`series`** rows are stack **segments**; each row has **`values: number[]`** (one magnitude per category column). Options: **`stacked100`**, **`vertical`** (swap axes: columns vs horizontal bars), **`categoryGap`** / **`stackGap`**, **`showGridX`** / **`showGridY`** (screen-space vertical vs horizontal lines), **`showValueAxis`**, **`showCategoryLabels`**, **`gridColor`**, **`axisColor`**, optional **`categoryLabels`**. Same fill modes as pie (solid / gradient / none). **Render**: **`BarChartShape`** (`SvgShapeBase`, viewBox **100×**`vbH`, **`preserveAspectRatio="xMidYMid meet"`**) via **`buildBarChartLayout`** (`bar-chart-layout.ts`). **Modal**: **`chart-data-editor-modal`** branches on bar vs pie. **Connections**: **`getShapeEdgeBounds`** — only **`generic.chart.pie`** uses circular bounds; bar uses default rectangle bbox. **Themes**: **`applyThemeToItem`** hue-steps bar segments like pie. **Schema**: `chart` is a **`kind` discriminated union** with **`normalizeChartField`** for legacy chart objects without **`kind`**.

### 2026-04-13 – Chart data modal: tighter Chart appearance + slice rows
**`chart-data-editor-modal.tsx`**: Removed the top intro blurb (per-slice fill / gradient / labels). Removed helper blurbs under **Slice outline**, **Segment pull override**, and **Label size**. **Pie drop shadow** and **Segment labels** are on **one row** (labels + switches only, no subtext).

### 2026-04-13 – Themes menu: delayed description tooltip
**View → Themes** dropdown (`theme-menu-selector.tsx`): hovering a theme row shows **`description`** in a **tooltip to the right** after **1.5s** (`THEME_DESCRIPTION_TOOLTIP_DELAY_MS`). Rows **without** a description skip the tooltip. **`z-[200]`** so the tip stacks above the menu.

### 2026-04-13 – Built-in diagram themes: vivid blue retune + presets
**`theme-manager.ts` `DEFAULT_THEMES`**: **5 blues** after Prussian Ink (Indigo Mirage … Cerulean Deep) use **saturated blue** fills/borders (retuned from grey/black-heavy). **5 extras**: Sapphire Pop, Electric Azure, Royal Tide, Skydive, Lagoon Splash — **light bright blue** fields. **Deep reds/oranges** after Merlot / Ember Clay; **Oxblood Silk**, **Crimson Nocturne**, and **Rust Canyon** tweaked to stay colourful (not near-black fields). Menu order: **`getThemesSorted()`** / **`theme-spectrum.ts`**.

### 2026-04-13 – Pie chart: segment pull 0–4, modal reorder (react-dnd), inline segment labels
**`segmentPull`** cap is **0–4** (schema + **`CHART_MAX_PER_SLICE_SEGMENT_PULL`**). **Chart data** modal: per-slice **Segment pull override** is a **slider** (0–4) with **Use default**; slice reorder uses **`useDrag` / `useDrop`** (HTML5 DnD conflicted with **`react-dnd`** backend under the portaled modal). **Canvas**: double-click a **segment label** on the pie to edit **`series[i].name`** (**`foreignObject`** input; **`diagram-node`** wires **`onPieSliceNameChange`**).

### 2026-04-13 – Pie chart: segment separation cap 3 + per-slice `segmentPull`
**Chart default** **`segmentGapDeg`** (modal **Segment separation**) is capped at **3** (older JSON &gt; **3** clamps to **3**). **`series[].segmentPull`** (optional **0–4**) overrides the default for that slice; **`pieSlicesForSvg`** returns **`{ slices, rDraw }`** and uses **`scalePullsForOuterBudget`** so the rim stays inside the design circle. **Chart data** modal: per-row **Segment pull override**; themes preserve **`segmentPull`**. **`docs/charts.md`** updated.

### 2026-04-13 – Canvas charts: pie (`generic.chart.pie`) + Chart data modal
**Palette**: Generic → Object → **Pie chart** (vector glyph in **`ResourceIcon`**; catalog may still list `pie-chart.png` for legacy file fields). **Type** `generic.chart.pie` (not `generic.object.*`) so future `generic.chart.bar` / line stay namespaced. **Data**: `DiagramNodeData.chart` — `series` rows support **`fillStyle`** none/solid/**gradient** + **`gradientColors`**; **`segmentGapDeg`** is chart-default radial pull; **`segmentPull`** per slice can exceed that default; geometry scales so the pie stays inside the same circle; angles unchanged. **Themes**: **`applyThemeToItem`** sets each slice from theme **background** with **`shiftHueOfColor`** (**36°** per slice index). **UI**: **Chart data** modal — **Segment labels** on/off, per-slice **label size**, fill mode (`Select` z-index / Radix click-outside), drag reorder, **expand/collapse** (default **all collapsed** when more than **2** slices), wedge outline, pie shadow, segment separation + per-slice pull override. **Docs**: **`docs/charts.md`**. **Render**: **`PieChartShape`** — defs gradients use **`gradientAngle`**, per-slice explode transform; chart **`shadow`**: SVG **`overflow="visible"`** via **`SvgShapeBase.svgOverflowVisible`** + wider **`feDropShadow`** filter region so blur isn’t clipped. **Connections**: **`isGenericObjectOrChartShapeType`** + **`getShapeEdgeBounds`**. **Schema**: `chart` on **`DiagramNodeDataSchema`**.

### 2026-04-13 – Marquee multi-select: Delete removes all in one keypress
**Issue**: Two window **`keydown`** handlers — **`EditorCanvas`** runs **`handleDeleteMultiple`** first, then **`diagram-editor`** ran **`handleItemDelete(selectedItem)`** with **stale** **`currentDiagramData`**, overwriting the batch update so only **one** item disappeared until Delete was pressed again. **Fix**: skip the parent single-item delete branch when **`selectedItemIds.size > 1`**.

### 2026-04-13 – Paste: allocate ids against all occupied references + batch reserve
**Behavior**: Each paste builds **`collectOccupiedDiagramIds`** (nodes, zones, groupings, **`connection.id`**) then a mutable **`pasteOccupied`** set; every new node/zone/grouping/grouping-record and pasted **connection id** is reserved so **nothing collides** with the target diagram or with **other items in the same paste**. **`generateSequentialId` / `generateGroupId`** take optional **`extraOccupiedIds`** and skip past exact collisions (custom ids). **Grouping** paste ids use **`generateSequentialId('grouping', …)`** (replaces naive `grouping-N` max). **Zone tree paste** reserves ids **per child** so multiple children no longer reuse the same sequential id. Pasted **nodes** get **`groupId: undefined`** until new groupings are applied.

### 2026-04-13 – Cross-tab paste: restore connections when sequential ids match source
**Issue**: Copying nodes + connections then pasting into another tab (often an **empty** diagram) could paste **nodes** but **no connections**. **Cause**: paste skipped creating edges when **`mergedFrom`/`mergedTo` equaled the clipboard’s `from`/`to`** — `generateSequentialId` can reuse the same strings as the source (e.g. `type-1`, `type-2`), so the guard treated the edge as unchanged and dropped it. **Fix** (`use-canvas-clipboard.ts`): remove that skip for multi- and single-node paste. **Copy**: also treat connections as selected when **`connection.id`** or **`${from}-${to}`** is in **`selectedItemIds`** (explicit edge selection).

### 2026-04-09 – Text drop shadow: enable toggle
**Data**: **`textDropShadowEnabled`**: only **`true`** applies drop shadow; **omitted** or **`false`** = off (**default**). **Render**: **`getTextEffectsShadowCss`**. **UI**: Switch in **text styling** + **line styling** panels; when off, **offset/blur/color controls are hidden**. **Types**, **schema**, **nested hierarchy**, **scratch pad** / **ShapePreview**, **resets**.

### 2026-04-09 – Text styling panel: persist 0 on effects + layout
**Behavior**: Outline / glow / drop-shadow sliders **store `0`** (not `undefined`) when dragged to zero so the value **stays after deselect** (same in **line styling** panel). **UI**: **Text transform**, **letter spacing**, **line height** moved to the **left** column; right column is opacity, colors, outline, glow, shadow.

### 2026-04-09 – Text styling: font size slider max 200px
**UI**: `text-styling-panel.tsx` and `line-styling-panel.tsx` — **Font size** slider **`max`** raised from **72** to **200** px for large titles.

### 2026-04-09 – Text glow + drop shadow (optional)
**Data**: **`textGlowBlur`** / **`textGlowColor`** (0 or unset = no glow), **`textShadowOffsetX`** / **`textShadowOffsetY`** / **`textShadowBlur`** / **`textShadowColor`** (drop shadow off when blur and both offsets are 0). **Rendering**: **`getTextEffectsShadowCss`** in **`text-styling.ts`** composes comma-separated **`text-shadow`** layers (glow uses two radii; shadow uses offset+blur). **`getTextStylingCSS`** applies it; **line** / **loop** SVG labels use the same helper, falling back to theme halo only when no custom effects and no outline stroke. **UI**: Text styling + line styling panels. **Theme** merge, **schema**, **nested hierarchy**, **scratch pad** / **ShapePreview**, **`slide-visual-color`** (glow + shadow colors).

### 2026-04-09 – Optional text outline (separate from fill color)
**Data** (`DiagramNodeData` / zones / schema): optional **`textOutlineWidth`** (px, 0 or unset = off) and **`textOutlineColor`** (stroke color, independent of **`textColor`**). **Rendering**: HTML text uses **`-webkit-text-stroke`** via **`getTextStylingCSS`** (`text-styling.ts`); SVG line/loop labels use **`stroke`** + **`paint-order: stroke fill`** via **`getSvgTextOutlineProps`**. **UI**: Text styling panel + line styling panel — outline width slider (0–6px) and outline color when width &gt; 0. **Theme** (`theme-types`): optional outline fields merged in **`getTextStyling`**. **Scratch pad** / **ShapePreview** pass outline for thumbnail consistency.

### 2026-04-09 – Slide transitions: connection remove/add before node motion
**Behavior** (`use-slide-transition.ts`): **Removing** a connection between slides **locks** geometry to the **previous** slide (`slideEndpointMove` + **`geomLockToPrev`**, no RAF lerp) so the line does **not** jump to the next slide’s layout while fading; **endpoints that move** (`nodeIdStyles`) get a **delay** (`connectionDelay + TRANSITION_DURATION_MS`) so the fade finishes **before** their motion. **New** connections use **`max(endpoint delays) + TRANSITION_DURATION_MS`** so their fade-in starts **after** both endpoints are in place. **Presentation** + **viewer** slide paths share this hook.

### 2026-04-13 – Connection animations: pause for menubar + canvas context UI
**Behavior**: **File / Edit / Options / Layout / Help** use **`MainMenubarTrigger`** in **`top-menu-bar.tsx`** (**`onPointerDown`** + **Enter / Space / ArrowDown**) to set **`animationConnectionsMenuPaused`** when **`animationConnectionsUserEnabled`**. **Canvas**: node/zone **`useCanvasContextMenu`** (**`onContextMenuOpen`**), empty-canvas **resource search** modal open, and **connection** right-click (**`handleConnectionContextMenu`**) call the same **`pauseConnectionAnimationsForOverlayUi`**. Effective animations: **`userEnabled && !idlePaused && !menuPaused`**. Canvas activity (**`onConnectionAnimationCanvasActivity`** — same path as idle: mouse/touch on canvas) clears **`menuPaused`** without changing the saved toggle. **Activity** button tooltip distinguishes **menu/context** vs **idle** pause.

### 2026-04-09 – Connection animations: 20s canvas idle auto-pause + resume on movement
**Behavior**: **`animationConnectionsUserEnabled`** (persisted **`dw:animationConnections:enabled`**) is separate from **effective** rendering: **`animationConnectionsEnabled = userEnabled && !idlePaused`** (and **`!menuPaused`** — see **2026-04-13**). After **20s** with **no diagram-space cursor change** on the canvas (snapped grid updates from **`use-canvas-interactions`**), **`idlePaused`** turns on so animations stop without changing saved preference. **Mouse move** or **touch move** on the canvas calls **`onCanvasActivity`**, clears idle pause, and restarts the timer. **Activity** toolbar button tooltip explains idle pause. **Options** menu Enable/Disable text follows **user** preference. **Hook**: **`src/hooks/use-connection-animation-idle.ts`** (**`CONNECTION_ANIMATION_IDLE_MS`**). **Touch**: **`use-canvas-interactions`**; **`touchend`** clears when **`touches.length === 0`**.

### 2026-04-09 – Presentation slide change: connection transition before paint
**Issue**: **`startTransition`** ran in **`useEffect`** (after paint), so connections could **flash one frame** at the **next** slide’s geometry before **`slideEndpointOffset`** applied. **Fix**: **`useLayoutEffect`** in **`use-presentation-slide-view.ts`** and **`presentation-player.tsx`** so **`useSlideTransition`**’s initial connection styles apply **before** the browser paints.

### 2026-04-09 – Viewer: same connection rendering as editor + `isReadOnly`
**Behavior**: **`viewer-canvas.tsx`** passes **`isReadOnly`** on **`CanvasConnections`** (ribbons, color gradients, animation paths unchanged — shared **`BezierConnection`** / **`OrthogonalConnection`**). **`canvas-connections.tsx`** memo compare includes **`onConnectionUpdate`** and **`onConnectionWaypointAdd`**. **`AGENTS.md`** documents viewer pipeline + schema.

### 2026-04-09 – Presentation playback: gradient/taper revision + per-slide connection remount
**Behavior**: **`connection-line-style.ts`** — **`connectionAdvancedStyleRevisionKey`**, **`bezierConnectionColorFallback`**, **`orthogonalConnectionColorFallback`** so **`React.memo`** on **`BezierConnection`** / **`OrthogonalConnection`** compares **resolved** taper + color gradient (matches render **`resolveConnectionWidths` / `resolveConnectionColors`**). **`canvas-connections.tsx`** — optional **`connectionRenderRevision`** in each connection **`<g>`** **key**. **`viewer/page.tsx`** (presentation view), **`presentation-player.tsx`**, **`diagram-editor.tsx`** **`DiagramEditorInner`** (presentation mode) pass revision so slide changes **remount** defs/gradients. **`editor-canvas.tsx`** / **`viewer-canvas.tsx`** wire the prop.

### 2026-04-09 – Connection line gradients: stable SVG `id` includes style revision
**Issue**: **`linearGradient`** **`id`** was **`conn-line-grad-${connectionKey}`** / **`orth-line-grad-${connectionKey}`** only; same logical connection across play snapshots could **reuse** an **`id`** while **stop colors** changed → browsers could show **stale** gradients. **Fix**: **`connectionGradientIdSuffix`** (hashes **`connectionAdvancedStyleRevisionKey`**, later extended with **gradient axis** — see next entry) appended to **`id`**. **`bezier-connection.tsx`**, **`othogonal-connection.tsx`**.

### 2026-04-09 – Connection line gradients: id suffix includes axis (user space)
**Issue**: With **unchanged** gradient **colors** but **moved** endpoints, some SVG engines kept a stale **`userSpaceOnUse`** vector when the **`id`** was unchanged. **Fix**: **`connectionGradientIdSuffix`** also hashes **`ribbonLayout`** **`gx1`/`gy1`/`gx2`/`gy2`** (formatted coords); suffix is computed **after** **`ribbonLayout`**. **`connection-line-style.ts`**, **`bezier-connection.tsx`**, **`othogonal-connection.tsx`**.

### 2026-04-09 – Presentation / slide transitions: gradients + taper outside CSS transform
**Rendering**: **`canvas-connections.tsx`** no longer applies **`connectionAnimationStyles`** (opacity/transform) on the wrapper **`<g>`** around each connection. **`BezierConnection`** / **`OrthogonalConnection`** take **`slideTransitionStyle`** on the **inner** path **`<g>`** only, so **`<defs>`** ( **`linearGradient`** **`userSpaceOnUse`**, filters, markers) are not under the same **transform** as before — fixes mis-aligned gradients / ribbon fills during **`useSlideTransition`** / **`useLayerAnimation`**. **Memo** compares **`slideTransitionStyle`**; **orthogonal** **`connectionKey`** includes **`connection.id`**.

### 2026-04-09 – Top bar: toggle connection line animations (toolbar button)
**UI**: **`top-menu-bar.tsx`** — next to **Fit to view**, **ghost** **Activity** button toggles the same **`animationConnectionsEnabled`** state as **Options → Enable/Disable Animation Connections** (**Ctrl+Alt+A**). Dimmed when animations are off; **title** / **aria** mirror the menu.

### 2026-04-09 – Connection animation: shape size step 0.5
**Behavior**: **`connection-animation-controls.tsx`** — **Shape size** slider/input use **`step={0.5}`** (was **1**); number field uses **`parseFloat`**. **`clampConnectionAnimation`** (`connection-animation.ts`) rounds **`animation.size`** to **0.5** increments (**0–10**). **`types.ts`** comment updated.

### 2026-04-09 – Toolbar Connections popover: `liveConnection` + modal parity
**UI**: **`context-toolbar.tsx`** — each row resolves **`liveConnection`** from **`currentDiagramData ?? diagramData`** (by **`id`** or **`from`/`to`**) and uses it for **arrow**, **line style**, **stroke**, **smooth corners**, **center on edge**, **attach on side**, **text** / **color** display, **`ConnectionLineStyleFields`** (locks, start/end width and color, shadow), **`ConnectionAnimationControls`**, and **waypoints** so controls stay aligned with saved **`connections[]`** JSON after edits.

### 2026-04-09 – Connection line: taper, gradient, lock toggles (modal + SVG)
**Data** (`DiagramConnectionData`): optional **`lineWidthLock`** (default locked), **`lineWidthEnd`**, **`colorLock`** (default locked), **`colorEnd`**. **Line width** clamp **`1–50` px** (`connection-line-style.ts`, modal, toolbar, theme **Line Width**). **Modal** (`connection-context-modal.tsx`): **Lock** / **Unlock** next to line thickness and line color; when unlocked, **Start** / **End** inputs (px) and two **ColorPicker**s. **Merge** (`diagram-editor.tsx` **`applyConnectionUpdates`**): re-locking clears **`lineWidthEnd`** / **`colorEnd`** (and lock flags) from stored JSON. **Render** (`bezier-connection.tsx`, `othogonal-connection.tsx`): varying width → filled **ribbon** polygon along sampled path; varying color → **linearGradient** (userSpaceOnUse from path start→end); uniform stroke path unchanged when both locked. **Arrows** (advanced stroke): separate invisible paths with **`markerUnits="strokeWidth"`** — **start** marker uses **`wStart`**, **end** marker uses **`wEnd`**. **Hit-test** stroke **`max(20, 4×max(wStart,wEnd))`**. **Connection animation**: shape size **`animation.size × 2 × localWidth`** — **static** shapes use width at **arc-length fraction**; **moving** shapes use **`animateTransform` `scale`** vs **`getLoopedAnimationPathConfig` `keyPoints`** via **`scaleValuesForAnimationKeyPoints`**. **Dot spacing / auto-count** uses **`CONNECTION_ANIMATION_SPACING_REF_LINE_PX` (2.5)** × **`animation.size`** × **`(1 + spacing)`**, **not** actual line width, so path frequency stays usable when the stroke is very thick. **Stroke pattern**: dashed/dotted is **not** applied while taper or color gradient is active (line draws **solid** for that case). **Helpers**: `src/lib/connection-line-style.ts`, `src/lib/connection-ribbon-path.ts`. **Schema**: `schemas.ts` updated.

### 2026-04-09 – JSON panel header: title + find field width
**UI**: **`json-editor-panel.tsx`** — header title **JSON** (was “JSON Editor”); find input width **~half** (**`min(90px,14vw)`**, **`min-w-[50px]`**, tighter **`px`**).

### 2026-04-09 – JSON editor: find bar + scroll to start of canvas selection
**Behavior**: **Find** row next to **Submit** — search input, **Aa** (case-sensitive), **prev/next** (**chevrons**), count (**0/n** until first navigation, then **i/n**), **Enter** / **Shift+Enter** for next/prev. **`src/lib/json-text-search.ts`** uses **`SearchCursor`**; **`searchKeymap`** off so built-in panel does not clash. **Canvas selection** scroll uses **`EditorView.scrollIntoView(from, { y: 'start' })`** so the **first line** of the highlighted block is aligned to the top of the viewport.

### 2026-04-09 – JSON editor: jump to canvas selection
**Behavior**: With the **JSON Editor** panel open, clicking a **node** or **connection** on the canvas selects the corresponding **`nodes[]` / `connections[]`** object in the editor, scrolls it into view (**CodeMirror** `scrollIntoView`), and updates scroll lock so later diagram sync does not snap away. **Implementation**: **`src/lib/json-editor-focus.ts`** (parse JSON for index → scan raw text for array element byte range), **`json-editor-panel.tsx`** (`focusTarget` + effect), **`diagram-editor.tsx`** passes **`selectedItem`**.

### 2026-04-09 – Connections popover (toolbar): same layout as connection modal + Stroke
**UI**: **`context-toolbar.tsx`** — **Connections** popover **`min(480px, 100vw-2rem)`**; expanded row matches **`connection-context-modal`** **two-column** grid (**Line type** + **Arrow**, **Stroke**, **Line thickness** + depth, smooth/center/attach | **Text**, **Text position**, **Color**, **Delete** + tooltip), then compact **`ConnectionAnimationControls`**, then **Connection points**. **`Label`** import; removed **`Unlink`**. **Collapse/expand** per connection unchanged.

### 2026-04-09 – Connection animation controls: 2-column grid, show when enabled
**UI**: **`connection-animation-controls.tsx`** — **Enable animation** row always visible; **detail** controls (shape, speed, size, formula, auto **/** shape count, color, spacing, bulk apply) render only when **`animation.enabled`**. Layout uses **`grid`** **`grid-cols-2`** (left: shape + speed + size + note + auto count + manual count; right: color + spacing + divider) with **bulk** rows **full-width** below. **Bulk** checkboxes reset when animation is disabled.

### 2026-04-09 – Connection modal: Delete under Color (recent colors), tooltip
**UI**: **`connection-context-modal.tsx`** — **Delete** connection control moved to **bottom-right** of the **right** column **below** the **Color** picker (under **Recent Colors**), **outline** button with **Trash2** + **Delete** label, **tooltip** “Remove this connection from the diagram” (**`side="bottom"`** **`align="end"`**). Removed from **Line thickness** row.

### 2026-04-09 – Connection context modal: Arrow by Line type; Text → Text position; thickness left
**UI**: **`connection-context-modal.tsx`** — **Line type** and **Arrow** share one **horizontal** row (left column). **Line thickness** (+ shadow + disconnect) moved to **left** column after **Stroke**. **Right** column order: **Text**, **Text position** (directly under Text), **Color**.

### 2026-04-09 – Connection context modal: denser footprint (still two-column)
**UI**: **`connection-context-modal.tsx`** — keeps **two-column** **Link2** header layout aligned with **Text** / **Visual** styling, but **narrower** (**`min(480px, 100vw-2rem)`**), **tighter** **`p-4`**, **`gap-x-3`**, **`pl-3`** divider, **`text-xs`** field labels, **`h-8`** controls, **`compact`** **`ConnectionAnimationControls`** in the modal to reduce vertical space; scroll **`max-h-[min(78vh,640px)]`**. **`connection-animation-controls.tsx`**: modal uses **`compact`** for animation; non-compact **`text-sm`/`h-9`** path remains for other callers if needed.

### 2026-04-09 – Plain text (`generic.text.text`) aligned with textbox, no chrome
**Behavior**: **Text** uses the same **rich editor / display**, **custom sizing**, **resize handles**, **vertical alignment** (`textVerticalPosition`), and **auto / measure** dimensions as **textbox**. **Rendering**: **`plainChrome`** path in **`diagram-node.tsx`** — transparent **background**, **no** border / shadow / hover box (textbox styling unchanged). **Data**: New palette **text** nodes get **`sizeMode: 'custom'`** and the same default **width/height** as textbox (**`canvas-operations.ts`**). **`measureNodeDims`** (**`canvas-constants.ts`**) treats text like textbox; removed dead duplicate **`isTextboxNode`** branch. **Resize** mins and **align/distribute** defaults updated for **`generic.text.text`**.

### 2026-04-09 – Text / textbox (custom size): edit no longer grows height
**Issue**: With **Custom (Manual Resize)** sizing, **double-click** to edit used **`TextboxRichEditor`** **`onHeightChange`**, which measured content and updated **`node.height`** on every keystroke → box **kept growing vertically**. **Fix**: **`diagram-node.tsx`** — do not pass **`onHeightChange`** for custom-sized **text** / **textbox** nodes; fixed height from resize handles is preserved; **`overflow-auto`** on the editor scrolls long content.

### 2026-04-08 – Semver: `0.1.{patch}`, patch auto-bump, build on dev/build only
**Versioning**: **`package.json`** **`version`** is **`0.1.x`** where **x** (**patch**) aligns with the count of dated **`### `** update lines in **`MEMORY.MD`** (third segment). **Auto** on app code edits: **`node scripts/bump-patch.mjs`** increments **patch** only (replaces the older **minor**-bump agent rule + **`bump-minor.mjs`**). **Cursor rule**: **`.cursor/rules/semver-patch-on-app-edit.mdc`**. **`src/lib/build-version.json`** **`build`** advances only via **`predev`** / **`prebuild`** (**`npm run dev`** / **`npm run build`**), separate from semver.

### 2026-04-08 – App build number set to 252
**Versioning**: **`src/lib/build-version.json`** **`build`** set to **252** (user request: replace **10** with **252**). **`package.json`** semver was **`0.9.0`** at that time; later **`0.1.x`** scheme applies.

### 2026-04-08 – Connection edge handles: start handle hit-testing + clear
**Issue**: Start (source) handle could sit under the **delete** control (~10% along path) and **far-release clear** could miss due to **stale** `connection` in the pointer-up closure. **Fix**: Render **`ConnectionEndpointHandles`** **after** arrow / waypoint / delete in **`canvas-connections.tsx`**; raise handle **z-index** (`CONNECTION_HELPER_Z_INDEX + 50`). On pointer-up beyond the distance threshold, **always** emit **`fromPreferredExit` / `toPreferredEntry`: `undefined`** for that role (merge deletes key; no stale guard).

### 2026-04-08 – Connection edge handles: yellow = pinned, drag away clears
**UI**: Endpoint handles are **yellow** when that end has a **stored** preference (`fromPreferredExit` / `toPreferredEntry`, per-end); **green** when **auto** for that end. **Drag** only updates the edge while the pointer stays **within ~120px** diagram space of the node; **release** **farther** than that **clears** that end’s preference (back to **green** + autocalc). **`determineConnectionEdges`** / **`getOptimalConnectionPoints`** support **partial** prefs (one side only). **`applyConnectionUpdates`** deletes keys when updates pass **`undefined`** for those fields.

### 2026-04-08 – Orthogonal routing: no line through node when user picks an edge
**Issue**: Endpoints are **excluded** from `collectObstacles`, so orthogonal paths could **cross the interior** of the source/target (e.g. through the **icon**) before reaching a **user-chosen** edge. **Fix**: **`appendInteriorObstaclesForPreferredEdges`** in **`orthogonal-routing.ts`** — when **`fromPreferredExit`** / **`toPreferredEntry`** is set to a **cardinal** side (not `center`), add an **interior** rectangle that blocks everything **except** a **~40px strip** along that edge so the path must **go around** (e.g. from **top**) like a clean port. Wired in **`canvas-connections.tsx`** (batch + toolbar) and **`othogonal-connection.tsx`**.

### 2026-04-08 – Connection edge drag handles (editor)
**UI**: When a **connection** is selected, **small green square** handles appear at the **start** and **end** attachment points (same overlay layer as arrow / waypoint controls). **Drag** near a node to pick **which side** the line exits (source) or enters (target); updates persisted **`fromPreferredExit`** / **`toPreferredEntry`** (with the other end filled from **auto** layout when first overridden). Respects **`edgeAttachmentConstraint`**. Hidden when the connection is deselected, when **read-only**, or without editor **`transform` + `canvasRef`**. **Files**: **`connection-endpoint-handles.tsx`**, **`canvas-connections.tsx`**, **`editor-canvas.tsx`**, **`bezier-connection.tsx`** (memo key + **`clampEdgeAttachmentForConstraint`** / **`computeAxisDeltasForConnectionNodes`** exports), **`othogonal-connection.tsx`** (memo compares preferred edges).

### 2026-04-08 – Auto Layout: vertical graph depth (connected nodes)
**Issue**: Layered layout used **layers as columns** (left-to-right) and stacked nodes in each column on **Y**. Chains (A→B→C) had **one node per column**, all **vertically centered** to the same **Y** → nodes sat on a **horizontal line** and **edges overlapped**. **Change**: **`src/lib/auto-layout.ts`** **`layoutComponent`** now places **layers as rows** (top-to-bottom = rank / depth) and **spreads nodes in a layer on X**. Same **Sugiyama** ranking and barycenter ordering; only the coordinate mapping swapped so flowcharts get clear vertical separation between hops.

### 2026-04-08 – Auto Layout: grid within layers + grid of components
**Issue**: Many nodes **same rank** (or **no / weak edges**) still produced **one long horizontal row** per layer; **disconnected** root items used **shelf packing** with a **wide** target width → **one line** of boxes. **Change**: **`performLayeredLayout`** — multiple connected components packed with **`packComponentsInGrid`** (sqrt-based grid) instead of the shelf algorithm.

### 2026-04-08 – Auto Layout: dagre per component (fan-out → 2D, not a vertical spine)
**Issue**: Custom **Sugiyama** + **DFS tree edges** collapsed **fan-out** (e.g. hub → several nodes) into a **linear chain** of ranks → everything **stacked on one vertical axis**; edges overlapped. **Desired**: spread like a **small grid** when the graph branches (see user ref. layout). **Change**: **`src/lib/auto-layout.ts`** **`layoutComponent`** now uses **`@dagrejs/dagre`** (**`rankdir: TB`**, `nodesep` / `ranksep` aligned with existing spacing) on **all directed edges** in the component (deduped), same family as **Mermaid** layout. **Fallback**: row-major grid if layout throws. **Chain spine**: if result is **one node per rank** (≥3 ranks), apply **horizontal zig-zag** between ranks so pure chains are not one straight column.

### 2026-04-08 – Tooltips: no spurious open on programmatic focus (global)
**Cause**: Radix **`TooltipTrigger`** opens on **focus** as well as pointer hover. Modals that **focus the first control** often hit a **Close** button wrapped in a tooltip → **“Close”** appears without hover. **Fix**: **`src/components/ui/tooltip.tsx`** wraps **`TooltipPrimitive.Trigger`** and, on **`onFocus`**, calls **`preventDefault()`** when the target does **not** match **`:focus-visible`** (see Radix [issue #2248](https://github.com/radix-ui/primitives/issues/2248)) — suppresses programmatic / non–keyboard-intent focus while keeping keyboard **Tab** behavior. **`connection-context-modal.tsx`**: close button has **`data-skip-modal-initial-focus`** so initial focus targets the first **non-close** control.

### 2026-04-08 – App build number (auto-increment)
**Versioning**: **`src/lib/build-version.json`** holds monotonic **`build`** (integer). **`scripts/bump-build.mjs`** increments it. **`predev`** and **`prebuild`** in **`package.json`** run the bump before **`npm run dev`** and **`npm run build`**, so each dev session or production build advances the counter. **`src/lib/app-version.ts`** exports **`APP_SEMVER`** (from **`package.json`**) and **`APP_BUILD`**. **About** shows **Version** + **build** (and **Development session** when not production). **Top bar** semver/build chip **removed** **2026-04-14** (see dated entry).

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

### 2026-03-30 – Merge `troubleshoot-mint-mocha` into `main` (three follow-ups)
Mint/mocha palette greys + export: **`shape-wrapper`**, **`square`**, **`html-to-image-fit-png`**, **`uml-class`**, **`point`**, **`rectangle`**, **`shape-preview`**, **`theme-manager`**. Clean merges; **`npm run typecheck`**; pushed **`origin/main`**.

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
**PresentationPlayer** (editor play mode, toolbar visible): **Auto zoom** now calls **`applyViewerUnionFit()`** (`computeUnionFitTransformForDiagrams` over all **`slideDiagrams`**, pruned connections) and turns **Use slide zoom** off so the one camera (pan + zoom) persists — same behavior as viewer fullscreen presentation. **`diagram-editor`** **`runPresentationFitToView`** (top bar **Fit to View** when a deck is active; was wand **auto zoom**): same union-fit **`k`** vs **`window.innerWidth`/`innerHeight`** when the deck has slides; empty diagram list still uses **`editorRef.fitToView()`** on the current canvas. Applies full union **transform** to the canvas when union succeeds.

### 2026-03-25 – Presentation thumbnails: fit content inside PNG only (no canvas change)
**Thumbnails** call **`captureSnapshotPng({ fitContent: true, unionDiagrams: [that slide], tightContentFrame: true, … })`** — per-slide bounds (see **2026-04-28 – Presentation thumbnails: per-slide fit**). **`use-canvas-export`** / **`html-to-image-fit-png.ts`**: html-to-image **`cloneNode`**, then **`.dot-grid`** transform on the clone = **`computeUnionFitTransformForDiagrams`** over the given diagram(s); deck-wide union still used for **multi-slide PNG export** / **viewer** camera, not for strip thumbnails. Viewport size uses **`getCanvasElementSizeForImageCapture`**. Fallback: **`computeContentBounds`** on live canvas when union empty/fails.

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

**Theme list ordering & completeness**: Built-in and custom themes in `getThemesSorted()` are ordered by **hue** (accent from `lineColor` → border → background) via `theme-spectrum.ts`; low-saturation themes sort after chromatic ones. Themes menu and theme popover **list all themes** (no 20-item cap or “and N more”). **Nature set**: Moss & Bark, Sea Glass, Wheat Straw, Redwood Grove, Lichen Stone, Desert Sand, Mountain Sky, Peat Earth, Tide Pool, Autumn Leaf. **Blues** (navy through vivid light): Midnight Sapphire, Cobalt Depth, Prussian Ink, Indigo Mirage, Denim Storm, Harbor Fog, Glacier Deep, Cerulean Deep; Sapphire Pop, Electric Azure, Royal Tide, Skydive, Lagoon Splash. **Deep reds / oranges**: Burgundy Velvet, Oxblood Silk, Scarlet Forge, Garnet Shadow, Crimson Nocturne; Ember Molasses, Burnt Umber, Copper Forge, Molten Caramel, Rust Canyon. **Mint Mocha** uses green `lineColor` for spectrum sort while keeping espresso borders.

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

### 2026-03-16 – Viewer: Bezier connection text labels (`CanvasConnectionText`)
**`ViewerCanvas`** (presentation player + standalone viewer) was missing **`CanvasConnectionText`** for **Bezier** edge labels; **orthogonal** text stays inline. **Fix**: add **`CanvasConnectionText`** with the same props as the editor. **`viewer-canvas.tsx`**.

### 2026-03-16 – Presentation Mode: Persist State Across Browser Refresh
**Presentation mode and settings preserved**: On refresh, presentation mode state is restored: (1) **presentationModeEnabled** in localStorage (`dw:presentationMode:enabled`); (2) **activeSlideId** per tab in IndexedDB/localStorage with decks and activeDeckId; (3) **Presentation editor panel UI** (toolbar floating, snapshots collapsed/floating, positions; **not** snapshot pane pixel height—removed 2026-03-25) in localStorage (`dw:presentation:panelSettings`). Modified: `diagram-editor.tsx` (restore/save presentationModeEnabled; hydrate/save activeSlideId), `presentation-storage.ts` (extend PerTabPresentationData with activeSlideId), `presentation-editor-panel.tsx` (restore/save panel settings).

### 2026-03-16 – Presentation panel: collapse hides thumbnails only
When the presentation strip is **collapsed**, the **deck toolbar** stays visible; only **thumbnails** hide. **Fix**: toolbar was wrapped in **`!toolbarCollapsed`** by mistake—moved the guard to thumbnail strip only. **`presentation-editor-panel.tsx`**.

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

---

**Tail removed (consolidated 2026-04-29)**: Everything after the old **Project Overview** was a stale snapshot (e.g. Next.js 15 / React 18, **zones** narrative conflicting with Feb 2026 “zones removed” and later reintroduction), duplicated bullet registries, and scratch refactoring notes—those are not a reliable source of truth. **Prefer `README.md`, `AGENTS.md`, and `docs/functional.md`.** Dated **`### YYYY-MM-DD – …`** entries above remain the changelog.

