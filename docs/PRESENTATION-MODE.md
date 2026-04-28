# Presentation Mode

Presentation Mode adds two sub-modes to DiagramWeaver:

- Editing Mode: build and manage presentation decks/snapshots
- Play Mode: fullscreen slideshow playback

## Data Model

### PresentationDeck

```ts
{
  id: string;
  name: string;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}
```

### Slide

```ts
{
  id: string;
  snapshotImage?: string;  // optional base64 PNG thumbnail
  diagramDelta: DiagramDelta;
  animationState?: {
    enabled: boolean;
    filterSourceIds?: string[];
    disabledSourceIds?: string[];
  };
  visibleLayerIds?: string[];
  title?: string;
  description?: string;
  createdAt: number;
}
```

### DiagramDelta

```ts
{
  version: '1.0';
  compressed: true;
  operations: Array<{
    op: 'add' | 'remove' | 'replace';
    path: string;          // JSON pointer-like path
    value?: unknown;
  }>;
}
```

## UI

Use Edit -> Enter Presentation Mode to show the presentation toolbox.

Toolbox actions:

- Create New Presentation
- Current Presentation
- Delete Presentation
- Select Presentation
- Add Snapshot
- Previous / Next
- Remove Snapshot
- Slide Count

Additional actions:

- Rename current presentation
- Drag/drop snapshot reorder
- Multi-select snapshot delete
- Export/Import presentations JSON
- Play Mode launch

## Snapshot Semantics

When Add Snapshot is used:

1. Capture base64 PNG of current visible canvas viewport.
2. Compute compressed delta against master diagram baseline.
3. Store current animation playback state (master toggle + filter/disabled source sets).
4. Store visible layer IDs for playback reveal effects.

Master diagram state is not mutated when saving/managing presentations.

When saving a diagram JSON file from the editor:

- Presentations are embedded inside the same diagram JSON under `presentations`
- Slides are stored in compact form (delta + minimal metadata)
- Snapshot PNG data, per-slide timestamps, and redundant IDs are omitted from embedded slide records
- Delta operations are tuple-encoded in compact form to reduce repeated JSON keys
- Playback reconstructs each slide from `diagramDelta` against the diagram in that file

Compact embedded format (v2):

```ts
{
  presentations: {
    v: 2,
    ai?: number, // active deck index
    d: Array<{
      n?: string, // deck name
      tn?: string[][], // deck-level table of repeated node-id sets
      tl?: string[][], // deck-level table of repeated layer-id sets
      s: Array<{
        d?: { o: Array<[0 | 1 | 2, string, unknown?]> }, // 0=add,1=remove,2=replace
        r?: {
          n?: string[]; // visible node ids (resolved from base diagram)
          l?: string[]; // visible layer ids (resolved from base diagram)
          ni?: number; // index into deck tn table
          li?: number; // index into deck tl table
        },
        t?: string, // optional non-default title
        a?: { e?: 0; f?: string[]; x?: string[] } // animation overrides only when needed
      }>
    }>
  }
}
```

When possible, repeated full replacements like `/nodes` and `/layers/layers` are compressed into `r.n` and `r.l` references instead of embedding full object arrays.

When the same `r.n` or `r.l` patterns repeat across multiple slides in a deck, they are deduplicated into deck-level tables (`tn`, `tl`) and slides use `r.ni` / `r.li` indices.

## Persistence

Presentation decks are persisted with IndexedDB first and localStorage fallback.

Per-tab temporary presentation state now shares the same IndexedDB namespace used by tab storage (`DiagramWeaver` / `tabs`) and uses presentation-specific keys inside that store. Older data from the legacy `DiagramWeaverPresentations` database is migrated forward on read.

Storage utility:

- `src/lib/presentation-storage.ts`

Key functions:

- `loadPresentationsFromIndexedDB`
- `savePresentationsToIndexedDB`
- `loadPresentationsFromLocalStorage`
- `savePresentationsToLocalStorage`

## Delta Utilities

Delta utility:

- `src/lib/presentation-delta.ts`

Key functions:

- `computeDiagramDelta(base, current)`
- `applyDiagramDelta(base, delta)`
- `projectVisibleDiagram(diagramData)`
- `listVisibleLayerIds(diagramData)`

## Viewer (`/viewer`)

Embedded **`presentations`** in loaded JSON are normalized the same way as in the editor: **`migratePresentationDecks`** then **`collapsePresentationDecksToOne`** (`viewer-utils` **`normalizeViewerPresentation`**). The strip and fullscreen player use the deck’s **`slides`** array only—**slide 1** is **`slides[0]`** (main diagram, empty delta vs file root); further slides use the same delta-vs-root reconstruction as the editor. **`slideDiagrams`** in the viewer is `slides.map((s) => applyDiagramDelta(master, s.diagramDelta))` with **`master = projectVisibleDiagram(diagramData)`**.

## Play Mode

Play Mode runs in a fullscreen dialog and supports:

- Previous/Next controls
- Slide index display
- Auto-play with configurable seconds
- Reconstructed diagram playback from stored deltas (with snapshot image fallback)
- Uses each slide's captured animation state so connection animations replay as captured
- Keyboard shortcuts:
  - Space: next
  - Backspace: previous
  - Escape: exit

## Components

- `src/components/editor/presentation-editor-panel.tsx`
- `src/components/editor/presentation-player.tsx`
