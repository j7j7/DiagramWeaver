# Documentation & onboarding todos

Tracked work for **tutorial completion** and **example content**. Update checkboxes `[ ]` → `[x]` as items complete. Cross-check `README.md`, `docs/TUTORIAL-MAP.md`, and the shipped UI.

**Legend**

| Symbol | Meaning   |
|:------:|-----------|
| `[ ]`  | Not done  |
| `[x]`  | Done      |

---

## At a glance

| Epic | Goal (summary)                           | Done when |
|:-----|:------------------------------------------|:----------|
| **A** — Tutorial | Guided flow covers shipped features end-to-end (see §A checklist). | All A.* rows `[x]` |
| **B** — Examples | Built-in diagrams showcase breadth of the app (see §B checklist). | All B.* rows `[x]` |

---

## A. Finish the tutorial — comprehensive coverage

**Intent:** Interactive tutorial (`TutorialOverlay` / `TutorialProvider`) walks new users through what the app actually does—not only canvas basics—using progressive disclosure aligned with `docs/TUTORIAL-MAP.md`.

| ID | Milestone | Status |
|:---|:-----------|:-------|
| **A-summary** | **Overall:** Feature surface in tutorial matches README + TUTORIAL-MAP chapters (orientation → presentation). | `[ ]` |

### A.1 Parity & content

| ID | Task | Done | Notes |
|:---|:-----|:----:|:------|
| A1.1 | Map each major **README** “Features” area (plus presentation / viewer bullets) to a step—or “advanced / see docs.” | `[ ]` | Include layers, groupings, themes, JSON, import/export, charts, Effects, sub-diagrams where feasible. |
| A1.2 | Cover **layers** visibility / order / “lines behind nodes.” | `[ ]` | |
| A1.3 | Cover **connections:** curved vs orthogonal, labels, taper/gradient where UI supports. | `[ ]` | |
| A1.4 | Cover **presentation** (slides, transitions, propagation) at level TUTORIAL-MAP suggests. | `[ ]` | |
| A1.5 | Mention **viewer** / share link vs editor-only flows. | `[ ]` | |

### A.2 Implementation (IDs & UX)

| ID | Task | Done | Notes |
|:---|:-----|:----:|:------|
| A2.1 | Implement missing **`data-tutorial-id`** anchors from **TUTORIAL-MAP**. | `[ ]` | Highlights match real menus/panels. |
| A2.2 | Wire **`autoActionsOnEnter` / autoActionsOnNext`** where steps need menus opened. | `[ ]` | |
| A2.3 | Closing step: **File → Examples**, **Copy Viewer URL** (or viewer path), reopen tutorial from File. | `[ ]` | |
| A2.4 | Sanity pass: **narrow viewport** + **keyboard** where steps claim shortcuts/flows. | `[ ]` | |

---

## B. Improve the example assets — showcase real capability

**Intent:** Files under **`public/examples`** (and tutorial JSON under **`public/examples/tutorial`**) demonstrate breadth—layers, connection styles/animations, styling, decks, charts—so inspection teaches patterns, not placeholders.

| ID | Milestone | Status |
|:---|:-----------|:-------|
| **B-summary** | **Overall:** Flagship samples + naming + validity; optionally aligned with tutorial JSON. | `[ ]` |

### B.1 Curated diagrams

| ID | Task | Done | Notes |
|:---|:-----|:----:|:------|
| B1.1 | **Architecture / layers** example (multi-layer, representative nodes). | `[ ]` | |
| B1.2 | **Flow** example emphasizing **connections** (e.g. animated / tapered vs plain). | `[ ]` | |
| B1.3 | **Presentation deck** example (slides + transitions worth demoing). | `[ ]` | |
| B1.4 | **Charts / themes** example (heavy chart nodes and/or themed styling). | `[ ]` | Optional split into two examples if clearer. |

### B.2 Metadata & hygiene

| ID | Task | Done | Notes |
|:---|:-----|:----:|:------|
| B2.1 | All shipped examples validate via **`validateAndConvertJson`** / schema (no stale keys). | `[ ]` | |
| B2.2 | Examples menu: **clear titles or short descriptions** (not opaque filenames alone). | `[ ]` | Where UI allows. |

### B.3 Tutorial alignment

| ID | Task | Done | Notes |
|:---|:-----|:----:|:------|
| B3.1 | Update **tutorial** JSON (**`public/examples/tutorial`**) where steps reference concrete diagram content. | `[ ]` | Optional but improves coherence with §A. |

---

## Reference (why this matters)

**Tutorial gaps:** Until `data-tutorial-id` and chapter coverage match **TUTORIAL-MAP**, onboarding diverges from the product—users fall back to README for layers, Effects, imports, decks, etc.

**Examples gaps:** Sparse assets under-teach tapered/animated edges, Effects, charts, decks, and nesting; richer fixtures also serve informal regression snapshots when canvas or serialization behavior changes.
