# Timeline object (`generic.object.timeline`) — design & progress

Living doc for the **timeline** composite shape: a spine (straight or curved, same mechanics as **`generic.object.line`**) with **N rounded rectangles** (entries), connectors from spine → marker dot → card, optional **section splits**, auto-spacing vs drag overrides, and styling aligned with existing **line / visual / text** tooling.

**Status:** initial integration shipped — spine/rendering/palette/move/context **Line** parity; **per-entry** styling from **Visual/Text** panels still incremental (see § below).

**Done (this pass):** types/schemas/layout helpers; **`TimelineShape`**; **`diagram-node`** spine chrome + entry interaction hooks (**double-click** opens **`TextboxRichEditor`** overlay per card); **`timelineActiveEntryId`** wiring; **`canvas-operations`** / **`measureNodeDims`** / **`use-canvas-drag-drop`** spine parity; context menu + toolbar **Line styling** for timeline; **`resource-generic`** **Timeline** tile; context menu **Add timeline card**, **Remove selected card** (needs active entry), **Sequential card hues** (`timelineCardFillMode` **`solid` ↔ `theme-hues`**); **`timeline-hues`** stepping via **`timelineHueStepDeg`** / theme step.

**Remaining / incremental:** route **Visual/Text** panel patches to **`timelineActiveEntryId`** via **`timeline-styling.ts`** from **`context-toolbar`** / **`visual-styling-panel`** (when entry focused); **`even`** reshape redistribution verification.

---

## 1. Product goals

- **Easy cardinality**: add/remove entries without manual pixel positioning.
- **Auto layout**: default **even spacing along path length** uses **`(i+1)/(n+1)`** (inset from endpoints); context menu **Space cards start → end** switches to **manual** with **`t = i/(n-1)`** so first/last sit at spine ends.
- **Spine resize ⇄ layout**: while **`timelineDistribution === 'even'`**, dragging the **start or end** endpoint (spine vertex handles) **continuously** recomputes entry positions along the **current** path — items stay **evenly distributed** in arc-length terms as the spine lengthens, shortens, or rotates; section markers use the same updated geometry. No stale pixel anchors tied to the old spine length.
- **Flexible placement**: cards **above** spine, **below**, or **alternating**.
- **User refinement**: drag an entry along the spine → stores a **per-entry parameter** `t ∈ [0,1]` (arc-length ratio); optionally toggle global mode **`even` vs `manual`** (see §5).
- **Visual rhythm**: optional **`sections`** count → **equally spaced** division ticks or faint bands along the spine (design choice in §7).
- **Spine parity**: **`linePathStyle`**: `straight` | `curved`; **`lineControlPoints`**; **`lineSmoothJoints`** where applicable — same as connector lines (**`src/lib/line-curve-path.ts`**, **`LineShape`**).
- **Consistency**: right-click **context menu** + existing panels (**Line styling**, **Visual styling**, **Text styling**) behave like other shapes/lines where fields overlap.
- **Per-entry editing (required)**: each timeline card is independently editable — **text content** (`label` / **`richLabel`** parity with other shapes), **colours** (fill, gradient/frosted if supported, border, text), and **related visual options** (e.g. shadow, corner radius if exposed per entry). Users choose **one active entry** (selection/sub-selection) so **Visual styling** and **Text styling** panels apply to **that entry**, while spine/connector styling stays at **timeline** level unless explicitly mirrored.

---

## 2. Naming & collisions

- **Type string**: `generic.object.timeline` (do **not** use a suffix `.line`; **`isConnectorLineNodeType`** treats unknown `*.line` types as connector lines — **`generic.chart.line`** is explicitly excluded).
- **Highlight / pulse**: decide vs **`isHighlightPulseShapeSilhouetteType`** — likely **`false`** (composite SVG similar to line/card combo).

---

## 3. Data model (sketch)

Extend **`DiagramNodeData`** (+ **`DiagramNodeDataSchema`**) with a dedicated subtree so validation/import/export stays explicit.

### 3.1 Spine geometry (reuse line fields)

Reuse existing optional fields already on nodes used by **`getConnectorLineVertices`**:

- `startPos`, `endPos` (or **`x`,`y`** + width/height mapping — mirror **`LineShape`** / **`diagram-node`** line handling)
- `linePathStyle`, `lineControlPoints`, `lineSmoothJoints`
- Line paint: `lineColor`, `lineType`, stroke width conventions already used by **`LineShape`** and **`line-styling.ts`**

### 3.2 Timeline-specific fields (new)

| Field | Purpose |
|-------|---------|
| `timelineEntries` | Array of entry records — see **§3.2a** (identity, layout **`t`**, **text**, **per-entry visual overrides**) |
| `timelineDistribution` | `'even'` \| `'manual'` — **`even`** ignores stored **`t`** for layout (except optional pinned entries — see §11) |
| `timelineCardSide` | `'above'` \| `'below'` \| `'alternate'` |
| `timelineSections` | `number` (e.g. **0** = off, **≥2** = divisions — semantics §7) |
| `timelineCardW`, `timelineCardH`, `timelineCornerRadius` | **Defaults** for card geometry; entries may override (**§3.2a**) |
| `timelineOffsetPx` | Normal distance from spine to card anchor (connector length) |
| `timelineCardFillMode` | **Default** tint strategy for *new* entries / bulk reset: `'solid'` \| `'theme-hues'` — does **not** remove per-entry overrides |
| `timelineConnectorWidth`, `timelineDotRadius` | Connector line + spine marker dot (timeline-level; optional per-entry connector colour later) |

#### 3.2a `timelineEntries[]` — required shape (per-entry editing)

Each entry **must** support editing **text** and **card appearance** independently. Minimal sketch (align field names with **`DiagramNodeData`** / **`RichTextRun`** where practical so schema reuse and styling panels stay consistent):

| Entry field | Purpose |
|-------------|---------|
| `id` | Stable id for persistence and selection |
| `t?` | Arc-length ratio **`[0,1]`** when **`timelineDistribution === 'manual'`** or after drag |
| `label?`, `richLabel?` | **Primary content** for that card (same semantics as other labeled shapes) |
| **Visual overrides** (all optional — missing ⇒ inherit timeline-level defaults) | e.g. `backgroundStyle`, `backgroundColor`, `backgroundColors`, `gradientAngle`, `frosted*`; `borderStyle`, `borderColor`, `borderColors`, `borderGradientAngle`; `shadow`; `textColor` or per-run styling via **`richLabel`** |
| `cornerRadius?`, `width?`, `height?` | Optional per-entry geometry overrides |

**Bulk / defaults**: timeline-level **`backgroundColor`**, **`timelineCardFillMode`**, **`timelineCardW`** / **`H`** apply when entry omits overrides. **“Apply theme hues”** can **initialize** or **reset** entry fills from palette index **`i`**, without blocking manual per-entry colour afterward.

**Node-level `label`/`richLabel`**: optional **timeline caption** (title outside the cards) — phase 2; **not** a substitute for per-entry text.

### 3.3 Z-order / grouping

Single **`DiagramNodeData`** entry (one timeline node), rendered as one SVG subtree — avoids treating each card as a separate **`nodes[]`** row. **Sub-selection**: **`timelineActiveEntryId`** (or equivalent in editor state) identifies which entry receives **text/visual** panel edits and optional **Delete this entry**. Sub-hit-targets for card vs spine vs connector (**`data-timeline-entry-id`** or similar) via transparent geometry (`pointer-events` pattern proven on **`LineShape`**).

### 3.4 Editor state (sketch)

- Persist **`timelineActiveEntryId`** in **`diagram-editor`** / selection hook (not necessarily in saved JSON unless needed for undo UX — prefer **transient** UI state).
- Changing timeline selection from “spine” to “entry **k**” updates **Text styling** / **Visual styling** targets without deselecting the timeline node.

---

## 4. Rendering architecture

| Piece | Approach |
|-------|----------|
| New shape component | e.g. **`src/components/diagram/shapes/timeline.tsx`** |
| **`diagram-node.tsx`** | Branch like **`LineShape`**: resolve spine verts → compute bounds (**`connectorLinePointBounds`** + padding for cards/connectors) for wrapper sizing / grid snap |
| Spine path | **`connectorLinePathD`** + same dash/caps styling helpers as **`LineShape`** |
| Entry anchors | **`pointAtLengthRatio(vertices, tEffective, linePathStyle, lineSmoothJoints)`** + tangent/normal for above/below offset |
| Connectors | Short segment from spine anchor perpendicular (or along normal) to card nearest edge; **dot** at spine anchor (`circle`) |
| Section markers | Vertical ticks or perpendicular hatch at **`j / sections`** for **j = 1 … sections-1`** (endpoints usually implicit — tune with UX) |
| Cards | **Merged style** = timeline defaults ⊕ entry overrides — reuse **`getShapeSvgFill`**, **`extractTextStylingFromNode`**-style resolution keyed per entry |

**Viewer**: same component path with **`isReadOnly`** — hide spine vertex handles; drag disabled; entry text still readable (no edit chrome).

---

## 5. Layout algorithm

### 5.1 Even distribution

For **`n`** entries and **`timelineDistribution === 'even'`**:

- Compute **`t_i = (i + 1) / (n + 1)`** for **i = 0 … n-1** (keeps endpoints clear for spine caps / sections), **or** **`i / (n - 1)`** when **n > 1** with endpoints allowed — **pick one rule**, document in UI tooltip; first option avoids overlap with line arrow caps.
- **Spine geometry changes** (endpoint drag, moving interior control points, toggling straight/curved): **re-evaluate** these **`t_i`** against the **updated** polyline/spline each frame — entries **follow** the path; distribution stays **even by construction** (ratios along total arc length stay fixed by the formula; absolute positions on canvas update automatically).

### 5.2 Manual / after entry drag

- On **entry** drag end: set **`timelineDistribution = 'manual'`** (or introduce **`timelinePinned: boolean[]`** — see §11).
- Store **`t`** clamped to **[0,1]** on the dragged entry; optional **snap** to section boundaries or **even** positions.
- **Spine endpoint / interior handle drag** in **`manual`** mode: **do not** force re-evening — keep each entry’s stored **`t`**; **`pointAtLengthRatio`** on the new geometry moves anchors along the reshaped path (**relative** positions preserved). User can use context action **“Redistribute evenly”** to snap back to **`even`** if desired.

### 5.3 Alternate sides

- **`timelineCardSide === 'alternate'`**: entry **i** uses side **`above`** if **i % 2 === 0**, else **`below`** (or inverted — configurable constant).

### 5.4 Relation to connector-line vertex UX

- Timeline spine uses the same **`startPos`/`endPos`** (and interior controls) as **`generic.object.line`**. Implement endpoint drag in **`diagram-node`** / line-handle layer so commits update vertices; timeline layout pass runs **after** resolved **`getConnectorLineVertices`** so **even** mode never depends on cached positions from before the drag.

---

## 6. Editor interactions

| Action | Behavior |
|--------|----------|
| Move whole timeline | Existing node drag — translate **`startPos`/`endPos`** and **`lineControlPoints`** together (mirror line-with-points behavior in **`canvas-operations`**). |
| Resize spine endpoints | Reuse **connector line vertex** UX (**`LineVertexHandles`**). When **`timelineDistribution === 'even'`**, each **`pointermove`** while dragging **start** or **end** recomputes entry anchors along the live spine — **even spacing is preserved** as length/shape changes. When **`manual`**, endpoints reshape the path but **per-entry `t`** values are unchanged (**§5.2**). |
| Drag entry along spine | Hit target on card or dedicated grip → pointer capture → update **`t`** param live; commit on **pointerup**. |
| Select entry for editing | Click card sets **`timelineActiveEntryId`** (timeline stays selected); click spine/empty timeline chrome clears to “timeline-only” (spine/dot/connector defaults). |
| Edit entry text | Double-click card **or** focus via selection → same patterns as **label / text-box** inline edit where applicable; **`richLabel`** in inspector/panel. |
| Edit entry colour / border / shadow | **Visual styling** panel applies to **active entry** when **`timelineActiveEntryId`** set; otherwise applies to **timeline defaults** (new entries inherit). |
| Add entry | Context menu “Add timeline entry” → append defaults (**`Entry n`**, inherit timeline visual defaults), **`even`** redistribute or insert **`t`** by neighbor interpolation; optionally focus new entry. |
| Remove entry | Context **“Remove selected entry”** when sub-selection active; **“Remove last”** / bulk actions as fallback; keyboard **Delete** removes active entry when policy allows (whole timeline if no sub-selection — match UX convention). |

---

## 7. Sections (`n` splits)

- **`timelineSections = N`**: draw **N − 1** internal division marks at evenly spaced **arc-length** positions (not Euclidean along chord).
- Optional **section labels** — phase 2 (parallel array or richer schema).
- Interaction: decorative **read-only** in v1; optional snap targets for entry **`t`** in v2.

---

## 8. Colours & inheritance

**Resolution order** for each card: **entry overrides** → **timeline-level defaults** on the node → theme/document defaults.

| Scenario | Behavior |
|----------|----------|
| User sets one colour for “the whole timeline” | Update **timeline-level** defaults only; entries **without** overrides track changes; entries **with** overrides unchanged. |
| User selects a card and opens **Visual styling** | Mutations write to **`timelineEntries[k]`** override fields. |
| **Theme hues** (`timelineCardFillMode`) | **Suggestion**: bulk-assign palette-derived **`backgroundColor`** (or **`backgroundColors`**) per entry — user can still edit any entry afterward. |
| **Consistent look** | Omit per-entry overrides; rely on single timeline default fill/border. |

Spine/connector colours: reuse **`lineColor`** / **`lineColors`** + **`lineColorStyle`** from **`LineShape`** at **timeline** scope (not per entry in v1 unless **`timelineConnectorWidth`**-style extension adds per-entry dot colour).

---

## 9. Context menu & panels (integration map)

Align with **`src/components/ui/context-menu.tsx`** and **`editor-canvas.tsx`** wiring:

- **Line-related** (when node is timeline): reuse **`onLineStyling`**, **`onToggleConnectorLineCurved`**, add point, smooth joints — extend **`isLineNodeType`** helper or add **`isTimelineNodeType`** so timeline gets **Curve / Add point / Smooth joints** without pretending to be **`generic.object.line`**.
- **Visual styling**: when **`timelineActiveEntryId`** is set, panel reads/writes **that entry’s** override object; when unset, reads/writes **timeline defaults** (card geometry defaults + shared fill/border fields on the node). Timeline-only chrome (card side, sections, hue bulk action, connector/dot) remains available in both modes where relevant.
- **Text styling**: routes to **active entry** **`label`/`richLabel`** (and typography fields stored per entry or inherited — mirror **`DiagramNodeData`** text fields subset); timeline caption (node-level) is optional later.
- **Context menu (card right-click)**: **Edit text**, **Visual styling** / **Text styling** (open panel scoped to entry), **Duplicate entry**, **Remove entry**, plus spine-level actions when clicking spine/track.

### 9.1 Palette / scratchpad

- **`public/resources/resource-generic.json`**: add **Timeline** object entry under generic objects (icon asset).
- **`createPaletteItem`** / **`useCanvasOperations` → `addNode`**: whitelist **`generic.object.timeline`** (**`canvas-operations.ts`** shape lists).
- **`isShapeNodeType`** / **`scratch-pad`**: include timeline for drag/copy consistency.

---

## 10. Implementation phases (checklist)

### Phase A — Schema & types

- [ ] **`src/lib/types.ts`**: `timeline*` interfaces
- [ ] **`src/lib/schemas.ts`**: Zod validation + defaults on create
- [ ] Import/export round-trip sanity

### Phase B — Rendering

- [ ] **`timeline.tsx`** spine + cards + connectors + sections
- [ ] **`diagram-node.tsx`** integration + bounds (**`lineLiveLayoutDims`**-style)
- [ ] Viewer / presentation: **`isReadOnly`** (no drag handles)

### Phase C — Edit interactions

- [ ] Whole-node move with control points
- [ ] Spine vertex handles (reuse line); **`even`** mode: layout pass on every spine geometry commit (and ideally live during endpoint drag)
- [ ] Entry drag along path + **`manual`** mode

### Phase D — Chrome & menus

- [ ] **Sub-selection**: `timelineActiveEntryId`, hit targets on cards, clear-on-spine-click
- [ ] Context: add/remove entry, entry-scoped actions on card, card side cycle, sections count; **“Redistribute evenly”** when **`manual`**
- [ ] Line styling hooks for spine
- [ ] Visual panel: **entry vs defaults** routing; hue bulk / reset; connector/dot sizing (timeline-level)

### Phase E — Polish

- [ ] Per-entry inline text edit + keyboard accessibility (tab/focus between entries if feasible)
- [ ] Touch: pointer parity with line/card drag + entry selection
- [ ] **`MEMORY.MD`** changelog entry when shipped

---

## 11. Open questions

1. **Delete / Backspace**: when sub-selection is an entry, delete entry vs delete whole timeline — recommend **entry** with **Shift+Delete** or modifier for whole node (document in shortcuts).
2. **Minimum spine length** when **n** is large — auto-expand bounding box vs warn user?
3. **Pinned entries**: allow some indices **`even`** and one **`manual`** without global flip?
4. **Closed spine**: support loop timelines or explicitly **disallow**?
5. **Typography inheritance**: duplicate full **`DiagramNodeData`** text-style subset per entry vs minimal **`textColor` + rich runs** only?

---

## 12. Related code references

- Spine math & sampling: **`src/lib/line-curve-path.ts`**
- Line rendering & text-on-path: **`src/components/diagram/shapes/line.tsx`**
- Line node wiring / handles: **`src/components/diagram/diagram-node.tsx`**
- Line context toggles: **`src/components/editor/editor-canvas.tsx`**
- Type guards: **`src/lib/utils.ts`** (`isConnectorLineNodeType`, `isShapeNodeType`)
- Palette drop whitelist: **`src/components/editor/canvas-operations.ts`**

---

_Last updated: 2026-05-08 (spine endpoint drag ⇄ even redistribution)_
