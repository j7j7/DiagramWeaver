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
