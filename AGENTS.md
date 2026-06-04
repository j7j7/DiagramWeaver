# Viewer (`/viewer`)
- Uses **`ViewerCanvas`** → **`CanvasConnections`** → **`BezierConnection`** / **`OrthogonalConnection`** (same as the editor). Connection JSON from **`validateAndConvertJson`** (`DiagramDataSchema`) includes taper/width locks, **`colorEnd`** / **`colorLock`**, shadows, waypoints, and **`animation`** (paths, shapes, spacing). **`ViewerCanvas`** passes **`isReadOnly`** into **`CanvasConnections`** so editing affordances stay off while rendering matches the editor.

# Viewport culling (editor + viewer canvas)
- **`useViewportRenderCull`** / **`computeViewportRenderCull`** in **`src/lib/viewport-culling.ts`**: from pan/zoom + host size, only mount **`DiagramNode`** instances whose bounds intersect the padded view (**32px** screen margin, **48** diagram-unit cap); connections use **16px** endpoint-only tests. Pass **`connectionIndices`** into **`CanvasConnections`** / **`CanvasConnectionText`**. Active when the diagram has **≥4** items; disabled during GIF export. Selected, dragged, hovered, and selected-edge endpoints are always included.

# Presentation (slides / fullscreen player)
- Slide and layer transition styles (**`connectionAnimationStyles`**) are applied on the **inner** path **`<g>`** only via **`slideTransitionStyle`**, so **`<defs>`** (linear gradients, filters, markers) stay **outside** CSS transforms — tapered strokes and color gradients stay correct during transitions.
- **Playback / slide changes**: **`connectionRenderRevision`** (slide index + id on viewer; deck + slide id in editor presentation mode) is passed into **`CanvasConnections`** so each connection **`<g>`** remounts per slide; **`connectionAdvancedStyleRevisionKey`** (resolved width/color locks vs **`resolveConnectionWidths` / `resolveConnectionColors`**) is part of **`BezierConnection`** / **`OrthogonalConnection`** memo equality so gradient vs flat styling cannot stick from the previous slide.

# Build Commands
- `npm run dev` - Start dev server (port 9003)
- `npm run build` - Static export to `out/` (`output: 'export'` in `next.config.ts`)
- `npm run start` / `npm run serve:static` - Serve `out/` locally (port 9003)
- `node scripts/bump-patch.mjs` - Increment `package.json` patch (`0.1.x` → `0.1.x+1`) after app code changes (see `.cursor/rules/semver-patch-on-app-edit.mdc`)
- `npm run lint` - Run ESLint
- `npm run typecheck` - TypeScript type check

# Code Style
- TypeScript strict mode; use path alias `@/*` for src imports
- Client components need `"use client"` directive at top
- File names: kebab-case for components, descriptive for lib files
- Types: Import interfaces from `@/lib/types`
- ClassNames: Use `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- Hooks: Custom hooks in `src/hooks/` with `use-` prefix
- Lib functions: Place in `src/lib/` with descriptive names
- Component structure: Radix UI primitives, shadcn/ui pattern
- ESLint: flat config **`eslint.config.mjs`** (`eslint-config-next/core-web-vitals`, relaxed **react-hooks** compiler rules + **`react-hooks/purity`** off until a dedicated cleanup)
- No test framework configured - ask user for test commands
