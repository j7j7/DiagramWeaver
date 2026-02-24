# Mermaid Sequence Diagram Import Plan

## Goal

Support Mermaid `sequenceDiagram` syntax in addition to existing flowchart and classDiagram support. Sequence diagrams display participants (actors) with message flow between them. **Do not break existing flowchart or class diagram import.**

## Mermaid Sequence Diagram Syntax (reference)

```mermaid
sequenceDiagram
    participant Customer
    participant Website
    participant PaymentGateway as Payment Gateway
    participant Warehouse

    Customer->>Website: Browse and select items
    Website->>Website: Add items to cart
    Customer->>Website: Proceed to checkout
    Website->>Customer: Display order summary
    ...
```

- **Header**: `sequenceDiagram`
- **Participants**: `participant Id` or `participant Id as Display Label`
- **Messages**: `From->>To: label` (solid arrow), `From-->>To: label` (dashed)
- **Self-loops**: `A->>A: label` - message from participant to itself (internal action)

## Diagram Representation in DiagramWeaver

### Participants
- **Nodes**: `generic.object.rounded-rectangle` (or rectangle) - one per participant
- **Layout**: Horizontal row, left to right in definition order
- **Lifelines**: Vertical dashed line from each participant (visual only, or implicit)

### Messages (A -> B, where A ≠ B)
- **Line objects**: `generic.object.line` with `startPos` and `endPos`
  - startPos: right edge center of source participant
  - endPos: left edge center of target participant
  - endCap: 'arrow' for `->>` style
  - label: message text
  - lineType: 'solid' or 'dashed' based on `->>` vs `-->>`
- Messages ordered top-to-bottom by definition order; Y position increases per message

### Self-loops (A -> A)
- **Loop objects**: New `generic.object.loop` shape
  - Curved path from participant back to itself (right side of lifeline)
  - Properties: anchor position (x,y), loop dimensions, label
  - Renders as curved arrow with optional arrowhead

## Implementation Plan

### Phase 1: Parser (mermaid-parser.ts)

1. Add `ParsedMermaidSequenceDiagram`, `MermaidSequenceParticipant`, `MermaidSequenceMessage` types
2. Add `parseMermaidSequenceDiagram(text: string)` function
3. Do **not** modify `parseMermaidFlowchart` or `parseMermaidClassDiagram`
4. Update `detectMermaidDiagramType` to return `'sequenceDiagram'` when header matches

### Phase 2: Loop Shape (new)

1. Create `generic.object.loop` - LoopShape component
2. Renders curved path (e.g. cubic bezier or ellipse arc) from anchor back to anchor
3. Properties: x, y (anchor), width, height (loop size), label, endCap
4. Add to diagram-node.tsx, shape-preview.tsx, canvas-operations.ts, context-toolbar.tsx

### Phase 3: Converter (mermaid-to-diagram.ts)

1. Add `sequenceDiagramToDiagramData(parsed): DiagramData`
2. Participants → rounded-rectangle nodes, horizontal layout
3. Inter-participant messages → line nodes with computed startPos/endPos
4. Self-loops → loop nodes anchored to participant
5. Order messages vertically (increasing Y)

### Phase 4: Integration

1. In `handleMermaidFileChange`, `handleFileChange`, `handleLoadExample`: route `sequenceDiagram` to parser/converter
2. Add `sequence-diagram` example to File → Examples
3. Copy `Order Payment Checkout Flow-*.mmd` content to `public/examples/sequence-diagram.mmd`

## Key Files

| File | Changes |
|------|---------|
| `src/lib/mermaid-parser.ts` | Add sequence parser + detectMermaidDiagramType |
| `src/lib/mermaid-to-diagram.ts` | Add sequenceDiagramToDiagramData |
| `src/components/diagram/shapes/loop.tsx` | New LoopShape component |
| `src/components/diagram/diagram-node.tsx` | Add loop shape branch |
| `src/components/diagram-editor.tsx` | Route sequence diagram |
| `src/components/editor/top-menu-bar.tsx` | Add Sequence Diagram example |
| `public/examples/sequence-diagram.mmd` | Example file |

## Non-Goals (this phase)

- Activation boxes (thick bars on lifelines)
- Notes (`rect`, `Note over/left/right`)
- Destructive/stop participant styles
- Export to Mermaid sequence syntax

## Validation

1. Import Order Payment Checkout Flow via File → Import Mermaid
2. Load via File → Examples → Mermaid Sequence Diagram
3. Flowchart and class diagram examples continue to work
