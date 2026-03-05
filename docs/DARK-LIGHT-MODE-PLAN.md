# Dark / Light Mode Implementation Plan

## Overview

Implement a system-wide dark/light mode toggle for DiagramWeaver that:
- Works across editor, viewer, menus, panels, popups, and overlays
- Is colour and context aware (no dark text on dark backgrounds)
- Uses a modern, consistent design system
- Preserves all existing functionality

## Current State

### Already in place
- **Tailwind**: `darkMode: 'class'` configured in `tailwind.config.ts`
- **CSS variables**: Both `:root` (light) and `.dark` (dark) modes defined in `globals.css`
- **Semantic tokens**: `background`, `foreground`, `card`, `popover`, `muted`, `accent`, `border`, etc.
- **UI primitives**: Radix components (dropdown-menu, popover, context-menu, dialog) use `bg-popover`, `text-popover-foreground`, `hover:bg-accent` – theme-aware
- **Viewer**: Uses `bg-background`, `bg-card`, `text-muted-foreground` – already theme-ready

### Gaps
1. **No theme toggle**: No provider applies `dark` class to `<html>`, no persistence
2. **Hardcoded colours**: Several components use `bg-white`, `bg-slate-50`, `text-gray-*`, `bg-zinc-*`, hex values
3. **Diagram content**: User-defined node colours (textColor, backgroundColor, etc.) are diagram data – remain as-is; canvas background uses semantic token

## Implementation Strategy

### Phase 1: Theme infrastructure (no UI changes to features)
1. Create `ThemeProvider` – applies `dark` class to `<html>`, reads from localStorage (`dw:theme`)
2. Create `useTheme` hook – `theme`, `setTheme`, `toggleTheme`
3. Persist preference: `'light' | 'dark' | 'system'` (system = `prefers-color-scheme`)
4. Integrate in `layout.tsx` wrapping body; add `suppressHydrationWarning` to avoid flash

### Phase 2: Theme toggle UI
1. Add toggle to top menu bar (View menu or prominent position)
2. Add toggle to viewer controls (for consistency when viewing diagrams)
3. Use `Moon` / `Sun` icons or similar for clear affordance

### Phase 3: Replace hardcoded UI colours
Replace fixed colours with semantic tokens in:

| File | Current | Replacement |
|------|---------|-------------|
| `text-styling-panel.tsx` | `bg-white` | `bg-popover` or `bg-card` |
| `visual-styling-panel.tsx` | `bg-white`, `bg-blue-50`, `bg-slate-50` | `bg-popover`, `bg-muted`, `bg-accent/5` |
| `line-styling-panel.tsx` | `bg-white`, `bg-blue-50` | `bg-popover`, `bg-muted` |
| `layers-panel.tsx` | `bg-white`, `bg-gray-50`, `bg-blue-50` | `bg-popover`, `bg-muted`, `bg-accent` |
| `scratch-pad.tsx` | `bg-white` | `bg-popover` |
| `uml-class-text-styling-panel.tsx` | `bg-white` | `bg-popover` |
| `metadata-popup.tsx` | `bg-zinc-800`, `text-zinc-*`, `border-zinc-*` | `bg-popover`, `text-popover-foreground`, `border-border` |
| `properties-panel.tsx` | `bg-white` (textarea) | `bg-background` or `bg-muted` |
| `tutorial-overlay.tsx` | `text-gray-*`, `bg-yellow-500`, `#fbbf24` | `text-foreground`, `text-muted-foreground`, `bg-primary` / semantic |
| `resource-browser.tsx` | `bg-slate-500/5`, `text-gray-500` | `bg-muted/50`, `text-muted-foreground` |
| `theme-menu-selector.tsx` | `text-gray-400` | `text-muted-foreground` |
| `theme-selector.tsx` | `text-gray-400` | `text-muted-foreground` |
| `diagram-editor.tsx` | `bg-black/50` (mobile overlay) | `bg-black/50` (keep – overlay dimming) |
| `shape-tag.tsx` | `bg-slate-100`, `border-slate-300` | `bg-muted`, `border-border` |
| `line-endpoint-handles.tsx` | `bg-green-200` | `bg-primary/20` or keep green for state |

### Phase 4: Colour pickers and diagram defaults
- Placeholder hex values in inputs (e.g. `#374151`) are for **diagram node styling** – user-editable, not app UI
- Keep these as default suggestions; only ensure input/container backgrounds are theme-aware

### Phase 5: Canvas-specific elements
- **Resize/connect handles** (`globals.css`): Currently `rgb(34 197 94)` – green accent. Consider CSS variables for semantic accent or keep for visibility.
- **Alignment guides**: Green stroke – same consideration
- **Connection arrow toggles**: SVG fill colours – semantic or keep for contrast

### Out of scope (by design)
- **Diagram content colours**: Node `backgroundColor`, `textColor`, `borderColor`, connection `color` – these are user data, not app chrome
- **Export output**: PNG/SVG/GIF reflect diagram content as designed

## Token usage reference

| Token | Light | Dark |
|-------|-------|------|
| `background` | Page background | Dark blue-gray |
| `foreground` | Primary text | Near white |
| `card` | Panel background | Same as background |
| `popover` | Modal/dropdown bg | Dark surface |
| `muted` | Muted surfaces | Darker muted |
| `accent` | Hover/focus | Lighter accent |
| `border` | Borders | Dark borders |

## Testing checklist

- [ ] Toggle light/dark in editor – all panels update
- [ ] Toggle in viewer – controls and properties panel update
- [ ] Context menu, dropdowns, dialogs – readable in both modes
- [ ] Metadata popup – readable in both modes
- [ ] Tutorial overlay – readable in both modes
- [ ] JSON editor – CodeMirror theme (one-dark) – consider light theme for light mode
- [ ] Persistence – refresh page preserves choice
- [ ] System preference – when `system`, follows OS

## Implementation status (2026-03-05)

- **Phase 1–2**: ThemeProvider, useTheme, layout integration, View menu (Light/Dark/System), viewer toggle
- **Phase 3**: Panels updated: text-styling, visual-styling, line-styling, layers, scratch-pad, uml-class-text-styling, properties, metadata-popup, tutorial-overlay, resource-browser, theme-selectors, shape-tag

## Files to create/modify

**Create:**
- `src/components/theme-provider.tsx` – ThemeProvider + useTheme
- `src/hooks/use-theme.ts` – re-export from provider or separate hook

**Modify:**
- `src/app/layout.tsx` – wrap with ThemeProvider, pass theme to html
- `src/components/editor/top-menu-bar.tsx` – add theme toggle (View menu or icon)
- `src/components/viewer/viewer-controls.tsx` – add theme toggle
- All files in Phase 3 table

## Notes

- Use `next-themes` pattern (or minimal custom) for SSR-safe class application
- Apply `dark` class on `<html>` so `prefers-color-scheme` can be overridden
- Avoid `media` dark mode – we need explicit user toggle, not just system
