# Merge: animated-connection → main

## Summary
Merged `animated-connection` branch into `main` on 2026-03-02. No merge conflicts occurred; Git auto-merged successfully.

## Branches Involved
- **Source**: `animated-connection` (4 commits ahead of merge base)
- **Target**: `main` (4 commits ahead of merge base)
- **Merge base**: `4828ca5`

## Animated-Connection Features (now in main)

### 1. Animated connection markers
- Per-connection animation: shape (dot/square/arrow/triangle/hexagon), speed, size, spacing, count
- Configurable via right-click context modal on connections
- `ConnectionAnimationControls` component with bulk apply (outbound/inbound) and confirmation
- Persisted in diagram JSON (`animation` object on `DiagramConnectionData`)

### 2. GIF export
- File → Export: PNG and GIF format options
- GIF records animated connection markers over a configurable duration (1–30s) and FPS (1–30)
- Uses `gifenc` package for encoding
- Export dialog: format radio (PNG/GIF), duration, FPS, frame count display

### 3. Multiple connections selection for animation
- Right-click multi-select for connections fixed/improved
- Bug fixes for multiple connection selection

## Main-Branch Features Preserved

### 1. canvas-connection-text.tsx updates
- Connection text alignment and measured dimensions for proper rendering

### 2. Multiple copy-paste fixes
- Fixed duplicate IDs and selection race conditions when pasting

### 3. Connector z-order / restored connector z
- Connection layering behavior from main

## Files Changed (Merge Result)
- **New**: `docs/ANIMATED-CONNECTION-QA.md`, `connection-animation-controls.tsx`, `connection-animation.ts`, `gifenc.d.ts`
- **Modified**: diagram-editor, bezier-connection, diagram-node, canvas-connections, canvas-connection-text, component-sidebar, connection-context-modal, context-toolbar, editor-canvas, export-dialog, top-menu-bar, viewer-canvas, use-canvas-export, use-canvas-selection, schemas, types, package.json

## Verification
- `npm run typecheck` — passed
- `npm run build` — passed

## Issues / Notes for Awareness

1. **No merge conflicts** — Git auto-merged; manual conflict resolution was not needed.

2. **gifenc dependency** — New `gifenc` package added for GIF encoding. Ensure `npm install` is run after merge.

3. **QA recommended** — Run through `docs/ANIMATED-CONNECTION-QA.md` checklist to validate animated connection + GIF export flow.

4. **MEMORY.md** — Will be updated separately to record the merge and new features.
