# Mind map node (`generic.object.mind-map-node`) — implementation plan

_Type string in app: **`generic.object.mind-map-node`** (kebab-case, matches palette slug)._

This document specifies how to add **individual mind-map nodes** to DiagramWeaver: radial auto-layout around parents, editable rounded-card visuals (aligned with **rounded rectangle**), **diagram connections** for links, drag behaviors (radial, orbital, subtree move), **join/disconnect/cluster-merge** flows, and **depth-based hue** styling — **without** breaking existing shapes, timelines, or the global connection system.

**Reference patterns in this repo**

- **`timelineobject.md`** / **`src/components/diagram/shapes/timeline.tsx`**: composite object with internal “entries,” spine geometry, context menu add/remove, **even vs manual** distribution, per-item normal offset (cards move nearer/further from spine), **theme-hues** sequencing.
- **`src/lib/timeline-layout.ts`**: pure layout math (ratios along path, drag solve → `t` + `cardNormalOffsetPx` + side).
- **`DiagramConnectionData`** (`src/lib/types.ts`, `src/lib/schemas.ts`): first-class edges between **node ids** — mind-map links should reuse this so **viewer**, **export**, and **presentation** behave like today.
- **`RoundedRectangleShape`** + **`diagram-node.tsx`** branch for **`generic.object.rounded-rectangle`**: label / rich text / styling — mind-map nodes should **reuse the same visual and text stack** (not invent a parallel mini-editor).
- **Group drag**: **`use-canvas-drag-drop.ts`** expands `itemsToMove` when an item has a **`groupId`** grouping; mind-map **subtree** move is analogous but must be driven by **mind-map hierarchy**, not necessarily `groupings[]`.

---

## 1. Product goals (acceptance criteria)

1. **Type**: New shape type **`generic.object.mindmap.node`** (consistent with `generic.object.*`; user-facing name “Mind map node”).
2. **First placement**: A lone mind-map node has **no** parent link; it behaves like a normal positioned shape until linked.
3. **Add child**: From a selected mind-map node, **context menu** (e.g. “Add mind map node”) creates a new node, **connects** parent → child, runs **auto-layout** for that parent’s children (equal angles on a circle by default).
4. **Layout**:
   - Children **orbit** the parent at a **default radius** (from sizes + padding).
   - **Equal angular spacing** by default; **user can reorder** siblings (changes angles while keeping spacing).
   - User can **drag outward/inward** (change radius) and **around** the parent (change angle / slot order) without breaking the link.
5. **Move subtree**: Dragging a node that is the **root of a mind-map subtree** (or a chosen “cluster handle”) moves **all descendants** in that hierarchy **as one**; **unrelated** nodes stay put; **connections** stretch because endpoints move.
6. **Text**: Same editing affordances as **rounded rectangle** (plain `label` / `richLabel`, styling panels).
7. **Join two nodes**: With **exactly two mind-map nodes** selected, context menu **“Connect mind map nodes”** creates an appropriate edge (see §5.2 for tree vs free link).
8. **Disconnect**: A node can be **removed from a parent** (becomes root of its own subtree or free node); **lines update** or are removed per rules below.
9. **Merge clusters**: Connecting a root of subtree A to a node in subtree B defines **merge semantics** (see §5.3) so two former clusters become one logical tree (or a defined exception if that would create a cycle).
10. **Color**: **Hue shifts by depth** from an ancestor’s “branch color” (see §8), compatible with existing `backgroundColor` / gradient / theme patterns.

---

## 2. Key design difference vs timeline

| Aspect | Timeline (`generic.object.timeline`) | Mind map (`generic.object.mindmap.node`) |
|--------|--------------------------------------|------------------------------------------|
| Cardinality | **One** diagram node, **many** internal `timelineEntries` | **Many** diagram **nodes**, each with its own `id` |
| Connections | Spine + cards are **internal geometry**; no per-card `DiagramConnectionData` | **Every** parent–child link is a normal **`DiagramConnectionData`** (or parallel tracked edge) so the rest of the app “sees” edges |
| Spatial authority | Entry positions derived from **spine** + `t` + `cardNormalOffsetPx` | Each node has **`x` / `y`**; layout **writes** polar-derived positions into `x`/`y` (or polar params that resolve to `x`/`y`) |
| Move | Move whole timeline → spine + entries transform together | Move **subtree** by walking **parent/child graph**; multi-select moves are unchanged unless extended |

**Implication:** mind-map layout is closer to “smart graph layout + constrained drag” than to “single composite SVG.” Timeline code is still the right **UX reference** for: context actions, **even distribution**, **manual override** after drag, and **hue stepping**.

---

## 3. Data model

### 3.1 Node type and base fields

- **`type`**: `generic.object.mindmap.node` (also accept `*.mindmap.node` suffix pattern if the codebase standardizes `endsWith` checks like other shapes).
- **Reuse** shape sizing and style fields already on **`DiagramNodeData`**: `width`, `height`, `sizeMode`, `cornerRadius`, `background*`, `border*`, `text*`, `richLabel`, `label`, `shadow`, etc. Default dimensions should match **rounded rectangle** insert defaults from **`canvas-operations.ts`** where applicable.

### 3.2 Mind-map-specific fields (on `DiagramNodeData`)

Add an optional **namespace** block to avoid colliding with future features (exact naming can be `mindmap` prefix on each field or a nested object if schema allows — today the codebase flattens most fields on the node).

**Recommended flat fields** (validation-friendly, mirrors timeline):

| Field | Type | Purpose |
|--------|------|---------|
| `mindmapRootId` | `string?` | **Cluster root** node id for this component (the “owner” of hue baseline and undo grouping). Updated when clusters merge. |
| `mindmapParentId` | `string?` | **Declared tree parent** (node id). Must stay in sync with exactly one **primary** incoming mind-map tree edge (see §5). |
| `mindmapChildIds` | `string[]?` | **Ordered list of child ids** for this parent. Defines **orbital order** (clockwise order after stabilizing “first angle”). |
| `mindmapLayoutMode` | `'auto' \| 'manual'` | **`auto`**: children positions recomputed from parent + order + counts; **`manual`**: user drag overrides frozen until “Reset layout” or parent add/remove triggers rebalance. |
| `mindmapRadialIndex` | `number?` | Optional **slot** index among siblings (redundant if `mindmapChildIds` on parent is source of truth — prefer **parent’s child list** as canonical). |
| `mindmapAngleDeg` | `number?` | **Absolute** polar angle on canvas (0° = +X) from parent center to this node center — used when `manual` or for stable incremental updates. |
| `mindmapRadiusPx` | `number?` | Distance from **parent anchor** to **this** node’s placement anchor; if unset, use computed default. |
| `mindmapBaseHueDeg` | `number?` | Optional **per-branch** hue override for subtree; if unset, inherit resolver from parent (§8). |
| `mindmapAnchor` | `'center' \| 'edge'` (optional) | Which point on the child attaches to the connector (default **`center`** to match most shapes; edge mode can match connection attach heuristics later). |

**Canonical rule:** **`mindmapChildIds` on the parent** is the **single source of truth** for sibling **order**. Child’s `mindmapParentId` must match the parent id that lists it (bidirectional consistency enforced on every mutation).

### 3.3 Connection model (reuse `DiagramConnectionData`)

Avoid a parallel edge array if possible so **BezierConnection** / **OrthogonalConnection**, viewer, and JSON import/export stay uniform.

**Option A (recommended):** Use normal `connections[]` with optional metadata:

| Field on `DiagramConnectionData` | Purpose |
|----------------------------------|---------|
| `mindmapRole` | `'tree' \| 'link' \| undefined` — **`tree`**: participates in hierarchy + subtree moves + default layout; **`link`**: visual/join only, **does not** imply parent for layout unless promoted |
| `mindmapPrimary` | `boolean?` — for a child with multiple incoming edges, which edge defines **`mindmapParentId`** |

**Option B:** Encode tree only via node fields (`mindmapParentId` + child list) and treat **all** mind-map connections as **`mindmapRole: 'tree'`** when created from “add child”; “join” creates **`link`** until user promotes.

**Cycles:** **Tree edges must not form a directed cycle.** On operations that would create a cycle (e.g. connect descendant to ancestor as tree), **refuse** or **auto-demote** to `link` with a toast — behavior should be explicit in QA.

---

## 4. Layout algorithm

### 4.1 Coordinate system

- For each parent **P** at `(Px, Py)` with ordered children **C₀…Cₙ₋₁**:
  - Let **default radius** `R₀ = f(sizeP, sizeCi, padding)` — e.g. max half-diagonal of parent and child + margin (timeline uses fixed offsets like `timelineOffsetPx`; mind-map can mirror that with `mindmapDefaultGapPx` on the parent or a global constant).
  - For child **i**, ideal angle  
    `θᵢ = θ₀ + (2π / n) * i`  
    where **`θ₀`** is a **phase** (parent-level `mindmapStartAngleDeg` optional, or derive from first manual placement).
  - Position child center:  
    `Cx = Px + Rᵢ cos θᵢ`, `Cy = Py + Rᵢ sin θᵢ`  
    where **`Rᵢ`** is `mindmapRadiusPx` if set, else `R₀` (or per-child default).

### 4.2 Even distribution vs manual (timeline analogy)

- **`mindmapLayoutMode === 'auto'`** on the **parent** (or global diagram flag): after **add/remove/reorder**, recompute all non-manual children angles to equal spacing **preserving order** in `mindmapChildIds`.
- When user **drags** a child **tangentially** around P:
  - Snap drag to **“orbital”** motion: project movement onto circle of current radius (see §6.2).
  - On pointer up: update **`mindmapAngleDeg`** (and optionally **reindex** `mindmapChildIds` to match new angular order), set parent or child to **`manual`** if we want to freeze until reset (same spirit as `timelineDistribution: 'manual'`).

### 4.3 Radius drag

- Radial component of drag updates **`mindmapRadiusPx`** with min/max clamps (avoid overlapping parent).

### 4.4 First child / first node

- **n = 1**: angle can default to **downward** (`-90°` screen Y) or **right** — pick one constant and document in UI (timeline picks ratios along spine; here a fixed baseline reduces jank).
- **n > 1**: equal arc spacing; when **n** increases, optionally **rephase** so the **centroid** of children stays stable (reduces canvas jump); alternative is **keep absolute angles** of manual nodes — product choice (recommend **rebalance in auto**, **preserve in manual**).

### 4.5 Collision / overlap

- Phase 1: **no global collision solver** — rely on user radius and moving nodes (matches “simple” mandate).
- Phase 2 (optional): if sibling bounding boxes overlap after layout, bump **R** minimally.

---

## 5. Graph operations: add, join, disconnect, merge

### 5.1 Add child (context menu)

1. Create new node **`N`** with `type: generic.object.mindmap.node`, default size/style **cloned** from parent or palette default.
2. Set **`N.mindmapParentId = P.id`**, append **`N.id`** to **`P.mindmapChildIds`**.
3. Insert **`DiagramConnectionData`** `{ from: P.id, to: N.id, mindmapRole: 'tree', mindmapPrimary: true }` (plus style defaults).
4. Run **`layoutChildren(P)`** in **`auto`** mode.
5. **Undo**: single transaction removing node + connection + parent list edit.

### 5.2 Join two selected nodes

Precondition: selection is **two** items, both mind-map nodes.

- If user chooses **“Connect (tree)”**:
  - Require **direction**: *from A to B* (e.g. first selected → second, or modal). Set **B**’s parent to **A** (or vice versa), enforce **no cycle**.
  - Update **`mindmapChildIds`**, set `mindmapRole: 'tree'`.
- If user chooses **“Connect (link only)”**:
  - Add connection with **`mindmapRole: 'link'`** — **does not** change `mindmapParentId`; **subtree moves** ignore link-only edges.

### 5.3 Disconnect

- **Disconnect from parent**: remove **primary** tree edge parent→this; remove **this** from parent’s `mindmapChildIds`; clear **`mindmapParentId`**; **`mindmapRootId`** recalc (self or min-id in component — define rule); **children** stay attached to **this** node (whole branch detaches as a unit).

### 5.4 Merge clusters

Connecting **root of cluster A** to **any node in cluster B** as **tree**:

- **Option 1 (simple):** Attach **A’s root** under **B**; **`mindmapRootId`** for all nodes in A’s old component becomes **B’s cluster root** (BFS relabel).
- **Option 2:** Promote to a **virtual super-root** only if we introduce grouping — probably unnecessary for v1.

**Two clusters connect with a link only:** no relabel; roots unchanged.

---

## 6. Drag behavior (editor integration)

### 6.1 Single-node drag (default `react-dnd` / canvas)

When dragging mind-map node **N** with parent **P**:

- **Subtree mode** (see §7): if **N** is the dragged handle for a **cluster move**, apply delta to **N and all descendants** along **tree** edges.
- **Individual mode**: if **N** is not “root being moved” or user holds a modifier (optional): **only N** moves — connection **stretches**; **after drop**, set **`mindmapLayoutMode: 'manual'`** for **N** and optionally clear automatic angle for siblings or leave siblings auto (product choice; recommend **manual for N only**).

### 6.2 Orbital drag (implementation sketch)

On pointer down on **child** with parent **P**:

1. Compute vector **v** from **P** to pointer.
2. Decompose **v** into **radius** and **angle**; apply **snap to grid** only on final position if that’s global policy (may conflict with orbit — consider **exempting** mind-map from grid on tangential drag or snap polar coords).

### 6.3 Multi-select drag

Existing behavior moves all selected **independently**. **Do not break** this: mind-map nodes in a multi-select without subtree mode move like any shapes; connections follow.

---

## 7. Subtree / cluster move (critical hook)

**Desired behavior:** dragging a **parent** (or “hub”) moves **entire hierarchy** under it.

**Implementation strategy (align with `use-canvas-drag-drop.ts`):**

1. Add **`collectMindmapSubtree(nodeId, nodesById, connections): Set<string>`** — walks **`mindmapParentId` / child lists / `mindmapRole: 'tree'`** to gather descendants (BFS/DFS).
2. When starting a drag on node **H**, if **H is a mind-map node** and **no modifier** (or always, per UX):
   - Replace `itemsToMove` with **`collectMindmapSubtree(H)`** instead of only `groupId` members — **similar** to grouped items branch (~line 276–284 in `use-canvas-drag-drop.ts`).
3. **Conflict:** multi-select + mind-map — **precedence rule**:
   - If **multi-select** includes non-subtree nodes, **do not** auto-expand to subtree (avoid surprising mass moves), **unless** all selected nodes ⊆ same subtree and user drags a member (advanced — Phase 2).

**Nodes not in subtree** stay fixed; **connections** between a moving node and a fixed node **update** automatically because endpoints move (existing connection geometry).

---

## 8. Color / hue by depth

**Goal:** If user sets a **branch color** on node **A**, descendants **A.1, A.2, …** share **shifted hues**; deeper levels shift more (user example: **1.1** vs **1.1.3.1**).

**Approach:**

1. **Resolve base**: from node’s **`backgroundColor`** (or first stop of gradient — if gradient, use midpoint hue or disable auto-shift per entry override).
2. **Depth**: shortest path length along **`mindmapRole: 'tree'`** from **`mindmapRootId`** (or from local branch root if subtree moved).
3. **Hue offset**:  
   `hue(d) = hue_base + d * Δ`  
   where **`Δ`** is **`mindmapHueStepDeg`** on the **root** or global default (timeline has `timelineHueStepDeg`).
4. **Apply**: compute **display** fill in **`MindmapNodeShape`** resolver: if **`mindmapColorInherit !== false`**, replace displayed background with **HSL-adjusted** color; **respect** user explicit **“lock color”** flag per node (`mindmapHueLocked?: boolean`).

**Consistency:** Reuse **`timelineCardFillMode: 'theme-hues'`** naming where possible (`mindmapFillMode: 'solid' | 'theme-hues'`).

---

## 9. Rendering and components

### 9.1 New shape component

- **`src/components/diagram/shapes/mindmap-node.tsx`**
  - **Visually**: delegate to same primitives as **`RoundedRectangleShape`** (or extract **`<RoundedCardBody />`** shared helper) so borders, frosted, gradients, and **SvgShapeBase** behaviors match.
  - **No** per-node internal SVG connectors like timeline; **all** lines are **`CanvasConnections`**.

### 9.2 `diagram-node.tsx`

- Add branch: if `generic.object.mindmap.node`, render **`MindmapNodeShape`** with same label/edit handlers as rounded rectangle.

### 9.3 Connection styling

- Default **tree** connections: subtle **bezier**, optional **arrowhead policy** (often **none** on mind maps — product call).
- **Link** connections: can reuse global defaults.

---

## 10. Context menu & toolbar

Files: **`src/hooks/use-canvas-context-menu.ts`**, **`src/components/ui/context-menu.tsx`** (timeline flags pattern).

Add:

- **Add mind map node** (single select, mind-map node)
- **Remove mind map node** / **Detach from parent** (if has parent)
- **Connect selected** (two select)
- **Reorder children** (optional submenu or drag handles on chip list — Phase 2)
- Mirrors: **timeline**’s “Add timeline card” / alternate sides / sequential hues toggles → mind-map: **“Reset radial layout”**, **“Evenly space children”**, **“Theme hues for branch”**.

---

## 11. Schema, validation, import/export

1. **`src/lib/schemas.ts`**: extend Zod for new node fields + connection `mindmapRole` / `mindmapPrimary` (spell-check field names before ship).
2. **`validateAndConvertJson`** path: ensure unknown fields don’t strip mind-map keys.
3. **`docs/AI_SCHEMA.md`**: document type for AI-generated diagrams.

---

## 12. Utilities & classification

**`src/lib/utils.ts`**

- Add **`isMindmapNodeType`**, include in **`isShapeNodeType`** (so hit testing, connection bounds, scratch pad behave like shapes).
- **`isHighlightPulseShapeSilhouetteType`**: decide **false** (box silhouette) like rounded rectangle.
- **`isConnectorLikeSpineNodeType`**: **false** — mind-map nodes are **not** line/timeline spines.

**`src/lib/shape-connection-bounds.ts`**

- Ensure mind-map uses same bounds as rounded rect (width/height on node).

---

## 13. Editor wiring checklist (non-exhaustive)

| Area | Action |
|------|--------|
| **`canvas-operations.ts`** | Default insert payload; duplicate mapping for mind-map |
| **`editor-canvas.tsx` / `diagram-editor.tsx`** | Pass any new context-menu props; subtree drag |
| **`context-toolbar.tsx` / `visual-styling-panel.tsx`** | Expose mind-map toggles next to rounded-rectangle controls |
| **`scratch-pad.tsx` / `shape-preview.tsx` / `resource-icon.tsx`** | Palette icon + preview |
| **`resource-mapping.ts`** | Library entry |
| **Viewer** | Read-only: no edit chrome; connections render as today |
| **Presentation** | `connectionRenderRevision` already remounts per slide — mind-map nodes obey same |

---

## 14. Phased delivery (recommended)

| Phase | Scope |
|-------|--------|
| **P0** | Type + schema + render **identical** to rounded rect + palette insert |
| **P1** | Tree fields + add child + connections + basic **auto** radial layout |
| **P2** | Orbital + radial drag + manual/auto modes |
| **P3** | Subtree drag + join/disconnect + merge |
| **P4** | Hue-by-depth + polish (reset layout, collision) |

---

## 15. Testing & regression matrix

- Mixed canvas: mind-map + timeline + normal shapes + **zones** (if any) — no exceptions in `moveItem` / line moves.
- **Undo/redo** for: add child, layout change, disconnect, merge.
- **Copy/paste** / duplicate: **`mindmapParentId`**, **child lists**, and **connections** must duplicate **consistently** (regenerate ids, remap graph).
- **Viewer** and **export JSON** round-trip.
- **Performance**: subtree collect on drag — O(nodes) per drag start; acceptable for typical mind maps; cache if needed.

---

## 16. Open decisions (to lock before coding)

1. **Subtree drag default**: always on for mind-map nodes vs **modifier key** to move single node only.
2. **Join direction UX**: first-selected vs context menu directional picker.
3. **Multiple parents**: forbidden vs **one primary tree + link extras** (recommended).
4. **Grid snap** during orbital drag: on/off.
5. **Link vs tree** visual differentiation (dashed for `link`?).

---

## 17. Summary

Mind-map support should **reuse** `DiagramConnectionData` and **`DiagramNodeData`** styling like the **rounded rectangle**, while introducing a **small, validated** mind-map field set for **tree order, polar params, and cluster root**. Layout and drag math can follow **`timeline-layout.ts`** patterns (even vs manual, offset along degree of freedom), but **spatial authority** lives in **per-node `x`/`y`** updated from **polar placement**. Subtree moves integrate at the **same layer as group drag** in **`use-canvas-drag-drop.ts`**, preserving the rest of the app’s connection rendering, viewer parity, and JSON story.
