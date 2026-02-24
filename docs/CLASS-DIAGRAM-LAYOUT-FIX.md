# Class Diagram Layout Fix Plan

## Problem
- **Expected (screenshot 1)**: Animal centered at top; Duck, Fish, Zebra in a horizontal row below, left-to-right; each class in its own rectangle; inheritance arrows up to Animal
- **Current (screenshot 2)**: Layout may have wrong child order (e.g. Zebra, Fish, Duck) or spacing; dagre ordering is non-deterministic

## Solution

### 1. Dedicated Class Diagram Layout
Replace dagre for class diagrams with a **deterministic layout**:

- **Parent(s)**: At top, centered horizontally. For single parent (Animal), one row at y=0.
- **Children**: In a horizontal row below parent, order = **Duck, Fish, Zebra** (matching inheritance definition order in source).
- **Spacing**: `CHILD_SPACING` between children; `RANK_SPACING` between parent row and children row.
- **Centering**: Parent row center X = center of bounding box of children row.

### 2. Child Order
Use the order classes appear as **children** in the inheritance edges. From `Animal <|-- Duck`, `Animal <|-- Fish`, `Animal <|-- Zebra`, order = Duck, Fish, Zebra.

### 3. Implementation
- Add `computeClassDiagramLayout()` in `mermaid-to-diagram.ts` (or new `mermaid-class-layout.ts`)
- Input: classes, edges, nodeDimensions
- Output: Map<id, {x, y}> with deterministic positions
- Call this from `classDiagramToDiagramData` instead of `computeMermaidLayout`

### 4. Layout Math
```
RANK_SPACING = 60
CHILD_SPACING = 40

Children: [Duck, Fish, Zebra]
Child widths: [wD, wF, wZ]

Total children width = wD + wF + wZ + 2*CHILD_SPACING
Children row start X = 0 (or offset for centering)

Child positions (left edges):
  Duck.x  = 0
  Fish.x  = Duck.x + wD + CHILD_SPACING
  Zebra.x = Fish.x + wF + CHILD_SPACING

Children row center X = (Duck.x + wD/2 + Zebra.x + wZ/2) / 2

Parent (Animal):
  Animal.y = 0
  Animal.x = Children row center X - Animal.width/2
  Children.y = Animal.height + RANK_SPACING
```

### 5. Grid Snapping
Reuse existing `centerToPosition` and `snapPosToGrid` so positions align to grid.
