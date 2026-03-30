# DiagramWeaver — In-app tutorial map

This document is the **content and flow blueprint** for the interactive tutorial (`TutorialOverlay` + `TutorialProvider`). Use it when adding steps in `diagram-editor.tsx` (`handleStartTutorial`) and when placing `data-tutorial-id` attributes on UI elements.

**Implementation notes**

- Each step has: `id`, `title`, `body`, `target` (selector or `data-tutorial-id`), optional `mode: 'message'`, `requiresTargetClick`, `autoActionsOnEnter` / `autoActionsOnNext` (e.g. open menus).
- **Yellow popups** are styled in `src/components/tutorial/tutorial-overlay.tsx` (amber theme).
- **Currently wired IDs** (grep `data-tutorial-id`): `file-menu`, `load-menu`, `toggle-json-menu`, `edit-menu`, `canvas`. Everything else in the tables below is **to add** when you implement that step.

---

## Guiding principles

1. **Progressive disclosure** — Start with layout and adding content, then selection and connections, then styling and power features (JSON, rules, presentation).
2. **One concept per step** where possible; use `message` mode for welcome/wrap-up or when there is no single DOM target.
3. **Prefer real UI highlights** — Attach steps to visible chrome (menus, sidebars, toolbar) before deep modal-only flows.
4. **Editor-first** — The tutorial runs in the main editor. Mention the **viewer** (`/viewer`, Copy Viewer URL) as a separate “sharing” chapter unless you build a viewer-specific tutorial later.

---

## Suggested chapter order

### Chapter A — Orientation (first session)

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| A1 | Welcome | DiagramWeaver is a canvas + sidebar + top menus; tutorial can be reopened from File. | `mode: 'message'` or highlight **canvas** |
| A2 | Top bar | File / Edit / Layout menus; zoom % and cursor coords are hints. | Add `data-tutorial-id` on **menubar container** or first trigger group |
| A3 | Canvas | Pan/zoom, grid snap, empty-area drag to select. | `canvas` (exists) |
| A4 | Left sidebar | Resource browser: search, providers, drag to canvas, double-click to paste at center. | `component-sidebar` root (to add) |
| A5 | Tabs | Multiple diagrams in tabs; **+ Tab** in File. | File menu item or tab strip (to add) |

### Chapter B — Diagram content

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| B1 | Nodes | Shapes, icons, textboxes, lines; resource icons vs Lucide vs emoji. | Sidebar section or first palette row (to add) |
| B2 | Selection | Click, Shift+click, marquee; multi-drag; status text in toolbar. | `canvas` + copy in body, or selection hint on **context toolbar** host (to add) |
| B3 | Context toolbar | Appears when something is selected: connect, delete, styling shortcuts. | `context-toolbar` wrapper (to add) |
| B4 | Layers | Multiple layers; show/hide from Edit → Layers; z-order and “lines behind nodes”. | Layers menu item or **layers panel** (to add) |
| B5 | Groupings | Create group, add/remove nodes, move as a unit; auto-layout respects groups. | Message or context menu trigger (to add) |

### Chapter C — Connections

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| C1 | Creating links | Connect mode, drag between nodes, **Connections** popover on selection. | Connect button / `context-toolbar` |
| C2 | Curved vs orthogonal | Per-connection **Bezier** vs **Orthogonal**; waypoints (curved). | Connection modal or edge selection (to add) |
| C3 | Labels & arrows | Connection text, position along line, arrow, color, thickness. | Same as C2 or properties |
| C4 | Advanced | Edge attachment (sides), center on edge, smooth corners (orthogonal); animations along path. | Short message + doc link in body |
| C5 | Presentation propagation | In presentation mode, propagate adds/deletes to later slides (toolbar when applicable). | `presentation-editor-panel` region (to add) |

### Chapter D — Styling & metadata

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| D1 | Properties panel | Right-side **Properties**: name, type, metadata key/value. | **Properties** toggle or panel root (to add) |
| D2 | Metadata popups | Compact popup under selection; Edit → enable/disable. | Message or toggle |
| D3 | Text / visual / line panels | Justification, borders, shadows, line caps — from **Diagram** styling or context toolbar. | Theme selector area or panel triggers (to add) |
| D4 | Themes | **Theme menu** + Theme Editor: apply presets, customize. | `ThemeMenuSelector` / theme button (to add) |
| D5 | Tags & scratch pad | Tags on shapes; **Scratch Pad** for notes (Edit menu). | Scratch pad toggle (to add) |

### Chapter E — Files, import/export, JSON

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| E1 | Save / load | JSON diagram files; persistence per tab. | `load-menu` or Save item (to add id on Save) |
| E2 | Examples | File → Examples — Mermaid and diagram samples. | Examples submenu trigger (to add) |
| E3 | Mermaid import | File → Import Mermaid; supported diagram types. | `load-menu` or Import item |
| E4 | JSON panel | Live JSON ↔ canvas; **Ctrl+Shift+J**; validate on apply. | `toggle-json-menu` (exists) |
| E5 | Export | PNG / GIF (and viewport export behavior). | Export menu item (to add) |
| E6 | Copy Viewer URL | Read-only **viewer** link; sharing. | Copy Viewer URL item (to add) |

### Chapter F — View options & quality-of-life

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| F1 | Theme (app) | Light / Dark / System under File → View. | View submenu (to add) |
| F2 | Fit to view | Fit all content; in toolbar. | Fit button (to add) |
| F3 | Hover labels & icon chrome | Toggle hover text, icon backgrounds, alignment guides. | Edit menu cluster or message |
| F4 | Connection animations | **Ctrl+Alt+A**; optional click-to-toggle downstream chain. | Edit menu items |
| F5 | Layer animations | Sparkles toggle — motion on layer transitions (if used). | Edit → layer animations item |
| F6 | Read-only | Lock editing for safe review. | Edit → Read-only |

### Chapter G — Rules engine

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| G1 | Purpose | User-defined checks (counts, types, patterns); pass/fail. | Edit → **Rules** (to add) |
| G2 | Persistence | Rules in localStorage; import/export JSON. | Inside Rules editor first screen |

### Chapter H — Nested diagrams

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| H1 | Sub-diagram link | Node can link to a nested diagram; double-click to open. | Message + breadcrumb bar (`diagram-breadcrumb` — to add) |
| H2 | Context actions | Create / remove sub-diagram from context menu. | Message |

### Chapter I — Presentation mode

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| I1 | Enter mode | **Ctrl+Alt+P** / Edit → Presentation Mode; decks and slides. | Presentation menu item or panel |
| I2 | Snapshots | Slides store deltas vs master; thumbnails; play mode. | `presentation-editor-panel` |
| I3 | Playback | Fullscreen / slide zoom / transitions (high level). | Message or player controls (viewer/editor) |

### Chapter J — Wrap-up

| # | Topic | What the user should learn | Suggested highlight / action |
|---|--------|------------------------------|------------------------------|
| J1 | Keyboard shortcuts | Table from README: undo/redo, layout, JSON, animations. | `mode: 'message'` |
| J2 | About & help | About dialog; README / `docs/` for depth. | File → About (to add) |
| J3 | Done | Re-run tutorial anytime: **File → Start Tutorial**. | `file-menu` or `canvas` message |

---

## Optional: split tutorials

If the full path is too long for one sitting:

- **Tutorial 1 — Essentials** — Chapters A–C + E4 (JSON) + J3  
- **Tutorial 2 — Polish & share** — Chapters D–F + E5–E6  
- **Tutorial 3 — Advanced** — G, H, I + remaining E/F items  

That would require `startTutorialEssentials()` / `startTutorialAdvanced()` entry points in the provider or editor.

---

## Checklist: `data-tutorial-id` inventory

Add stable IDs (kebab-case) as you implement steps:

| ID (proposed) | Element |
|----------------|---------|
| `main-menubar` | `Menubar` root |
| `component-sidebar` | Left sidebar outer |
| `tab-strip` | Tab bar |
| `context-toolbar` | Context toolbar wrapper |
| `fit-to-view-button` | Fit button |
| `theme-menu-selector` | Theme dropdown |
| `properties-panel` | Properties column |
| `layers-panel` | Layers panel |
| `presentation-editor-panel` | Presentation UI |
| `diagram-breadcrumb` | Breadcrumb row |
| `load-menu` | exists |
| `toggle-json-menu` | exists |
| `file-menu` / `edit-menu` / `canvas` | exist |

---

## Copy tone

- Short **titles** (3–6 words).  
- **Body** 1–3 sentences: what it does, one tip, optional shortcut in parentheses.  
- Avoid duplicating README verbatim; reinforce **muscle memory** (where to click).

---

*Last updated: 2026-03-26*
