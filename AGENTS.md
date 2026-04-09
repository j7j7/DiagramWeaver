# Viewer (`/viewer`)
- Uses **`ViewerCanvas`** → **`CanvasConnections`** → **`BezierConnection`** / **`OrthogonalConnection`** (same as the editor). Connection JSON from **`validateAndConvertJson`** (`DiagramDataSchema`) includes taper/width locks, **`colorEnd`** / **`colorLock`**, shadows, waypoints, and **`animation`** (paths, shapes, spacing). **`ViewerCanvas`** passes **`isReadOnly`** into **`CanvasConnections`** so editing affordances stay off while rendering matches the editor.

# Presentation (slides / fullscreen player)
- Slide and layer transition styles (**`connectionAnimationStyles`**) are applied on the **inner** path **`<g>`** only via **`slideTransitionStyle`**, so **`<defs>`** (linear gradients, filters, markers) stay **outside** CSS transforms — tapered strokes and color gradients stay correct during transitions.
- **Playback / slide changes**: **`connectionRenderRevision`** (slide index + id on viewer; deck + slide id in editor presentation mode) is passed into **`CanvasConnections`** so each connection **`<g>`** remounts per slide; **`connectionAdvancedStyleRevisionKey`** (resolved width/color locks vs **`resolveConnectionWidths` / `resolveConnectionColors`**) is part of **`BezierConnection`** / **`OrthogonalConnection`** memo equality so gradient vs flat styling cannot stick from the previous slide.

# Build Commands
- `npm run dev` - Start dev server (port 9003)
- `npm run build` - Production build
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
- ESLint config: next/core-web-vitals, next/typescript
- No test framework configured - ask user for test commands
