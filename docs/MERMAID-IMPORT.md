# Mermaid Diagram Import

DiagramWeaver imports Mermaid diagram syntax (.mmd, .mermaid) and converts it to editable diagram JSON. Supported diagram types: **flowchart**, **class diagram**, and **sequence diagram**.

## How to Import

- **File → Import Mermaid** – Select a `.mmd` or `.mermaid` file
- **File → Load** – Load JSON or Mermaid files (accepts `.mmd`, `.mermaid`)
- **File → Examples** – Load built-in Mermaid examples:
  - Mermaid Simple
  - Mermaid Complex
  - Mermaid Class Diagram
  - Mermaid Sequence Diagram

## Supported Diagram Types

### 1. Flowchart

**Header**: `flowchart TD|LR|BT|RL` or `graph TD|LR|BT|RL` (TB maps to TD)

**Directions**: Top-Down (TD), Left-Right (LR), Bottom-Top (BT), Right-Left (RL)

**Node shapes** (Mermaid → DiagramWeaver mapping):

| Mermaid | DiagramWeaver type |
|---------|--------------------|
| `[text]`, `rect`, default | generic.object.rectangle |
| `(text)` | generic.object.rounded-rectangle |
| `((text))` | generic.object.circle |
| `{text}` | generic.object.kite (diamond) |
| `[[text]]` | generic.object.rectangle (subroutine) |
| `{{text}}` | generic.object.hexagon |
| `[/text/]`, `[\text\]` | generic.object.parallelogram |
| `[/text\]`, `[\text/]` | generic.object.trapezoid |
| `([text])` | generic.object.rounded-rectangle (stadium) |
| `[(text)]` | generic.object.rounded-rectangle (cylinder/database) |

**Connectors**: `-->`, `---`, `-.->`, `==>` with optional labels `|label|` or `-- label --`

**Layout config** (YAML frontmatter):

```yaml
---
config:
  layout: dagre | elk
  nodeSpacing: 50
  rankSpacing: 50
  elk:
    nodePlacementStrategy: string
    mergeEdges: boolean
    cycleBreakingStrategy: string
---
flowchart TD
  A --> B
```

- **dagre** (default): @dagrejs/dagre layout
- **elk**: elkjs layout when `layout: elk`

### 2. Class Diagram

**Header**: `classDiagram`

**Inheritance**: `Parent <|-- Child` (arrow from child to parent)

**Members (colon)**: `ClassName : +int age`, `ClassName: +methodName()`

**Members (block)**: `class Duck{ +String beakColor +swim() +quack() }`

**Visibility**: `+` public, `-` private, `#` protected, `~` package

**DiagramWeaver**: Classes become `generic.object.uml-class` with three compartments (name, attributes, methods). Layout: parents at top, children below.

### 3. Sequence Diagram

**Header**: `sequenceDiagram`

**Participants**: `participant Id` or `participant Id as Display Label`

**Messages**: `A->>B: label` (solid arrow), `A-->>B: label` (dashed)

**Self-loops**: `A->>A: label` – rendered as `generic.object.loop` (curved path)

**DiagramWeaver**:
- Participants → rounded-rectangles in a horizontal row
- Inter-participant messages → `generic.object.line` with startPos/endPos, arrow at target
- Self-loops → `generic.object.loop` shape
- Lifelines → vertical connections (gray bezier, no arrow)

## Import Styling

**Flowchart themes** (inline, no theme-manager):
- **Ocean Blue** (rect/default): `#3b82f6` border, `#eff6ff` bg
- **Forest Green** (decision, circle, hexagon, etc.): `#16a34a` border, `#f0fdf4` bg
- **Royal Purple** (last nodes in chain): `#9333ea` border, `#faf5ff` bg

**Connector label colors**: Yes/Low=green (#22c55e), No/Critical=red (#ef4444), High=orange (#f97316), Medium/Medium-Low=amber (#f59e0b)

**Sequence diagram**: Participants use alternating themes (blue, green, orange, purple, cyan, red)

## Grid Alignment

Flowchart import snaps positions and dimensions to GRID_SNAP (20px). Center points are snapped, then top-left derived for even dimensions so connectors stay straight between vertically stacked nodes.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/mermaid-parser.ts` | Parse flowchart, class, sequence syntax; YAML frontmatter |
| `src/lib/mermaid-layout.ts` | Dagre/ELK layout (Mermaid-compatible) |
| `src/lib/mermaid-to-diagram.ts` | Convert parsed data to DiagramData |
| `src/app/api/validate-mermaid/route.ts` | API for validating .mmd files |
| `scripts/validate-mermaid.mjs` | Standalone Node validation (flowchart only) |
| `public/examples/*.mmd` | Example files |

## Examples

- `public/examples/simple.mmd` – Flowchart with shapes and labels
- `public/examples/complex.mmd` – Flowchart LR, multiple shapes
- `public/examples/graphTD.mmd` – graph TD syntax
- `public/examples/class-diagram.mmd` – UML class diagram
- `public/examples/sequence-diagram.mmd` – Sequence with participants and messages

## Validation

- **Browser console**: Full error output on import (`[Mermaid Import]` / `[Mermaid Load]`)
- **API**: `GET /api/validate-mermaid` (when dev server running) – validates all .mmd in public/examples using flowchart parser
- **CLI**: `npm run validate-mermaid` – standalone Node script (flowchart-only, minimal parser)

**Note**: The validation API and script currently validate flowcharts only. Class and sequence diagrams are parsed on import but not included in batch validation.

## Export to Mermaid

Planned as a separate phase. Not yet implemented.
