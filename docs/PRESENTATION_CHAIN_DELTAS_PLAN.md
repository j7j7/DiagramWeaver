# Presentation slides: chained deltas

## Goal

Store slide **`diagramDelta`** as delta **from the previous resolved slide** (slide 0 vs master). Previously every slide was delta vs the **same** visible master.

## Resolution

- **Legacy `master` mode**: `slides.map(s => applyDiagramDelta(masterBase, s.diagramDelta))`
- **`chain` mode**: sequential `cur = applyDiagramDelta(cur, s.diagramDelta)` from `masterBase`

## Migration

- Deck field **`presentationDeltaMode?: 'master' | 'chain'`** (missing ⇒ `master`).
- **`migratePresentationDeckToChain(deck, masterBase)`** resolves absolutes using master mode, then rechains (`src/lib/presentation-slide-chain.ts`).
- Editor migrates decks when **`presentationMasterDiagram`** is available.

## Reorder / delete / propagate

- **Reorder**: resolve absolutes (chain or master), permute rows, **rechain**; if a **non-primary** row becomes index 0, set the **tab diagram** to that slide’s resolved diagram (it becomes the main diagram), keep **`__dw_primary__-${deckId}`** on slide 1, reassign the displaced primary row’s id, then recompute deltas (chain: `rechainSlideDeltasFromAbsoluteDiagrams`; master: each slide vs new master visible).
- **Primary strip**: drag **onto** slide 1 makes that snapshot the main diagram; the first card is also **draggable** so the former main can move to another index.
- **Delete**: remove slide, recompute absolutes, rechain.

## Files

- Core: `src/lib/presentation-slide-chain.ts`
- Editor, viewer, thumbnails, viewport sync, export helpers, `extract-embedded-presentations.ts`
