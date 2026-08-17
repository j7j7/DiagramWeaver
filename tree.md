# Folder layout (`tree.md`)

Canonical narrative: **README → Development → Project Structure**. Update this file when top-level directories or major `src/` groupings change.

**Last verified:** 2026-08-17

```
.
├── docs/
│   ├── functional.md           # Modules, hooks, routes — how code fits together (see README / AGENTS.md)
│   ├── e2e-perf-harness.md     # Playwright canvas performance workflow + env vars
│   ├── AI_SCHEMA.md            # Pointer to the LLM authoring pack
│   ├── ai-schema/              # LLM create/edit schema (generated catalogs + fixtures)
│   │   ├── README.md
│   │   ├── authoring-source.json
│   │   ├── diagram-authoring.json
│   │   ├── resource-types.json
│   │   └── fixtures/
├── e2e/
│   ├── helpers/                # editor-page, perf-logger, palette-items
│   ├── perf/                   # canvas-workflow.spec.ts
│   ├── logs/                   # perf-*.log / perf-*.json (gitignored)
│   ├── report/                 # Playwright HTML report (gitignored)
│   └── test-results/           # traces, video (gitignored)
├── playwright.config.ts
├── public/
│   ├── examples/
│   └── resources/          # Served JSON + icons (`/resources/*`)
├── scripts/                    # bump-*, generate-*-resources, ai-schema generate/validate
├── resources/               # Templates / tooling beside public (optional); live catalogs under public/resources/
├── src/
│   ├── app/
│   │   ├── viewer/
│   │   └── page.tsx         # editor route `/`
│   ├── components/
│   │   ├── diagram/
│   │   ├── editor/
│   │   ├── viewer/
│   │   ├── tutorial/
│   │   ├── ui/
│   │   ├── diagram-editor.tsx
│   │   ├── diagram-editor-inner.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── hooks/
│   ├── lib/
│   │   ├── canvas-guide-lines.ts   # ruler guide coords + export strip helper
│   │   └── diagram-editor/  # extracted editor helpers
│   └── types/               # ambient .d.ts only; domain types in lib/types.ts
├── AGENTS.md
├── MEMORY.MD
├── README.md
├── components.json
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

Ignored here: `.git/`, `.next/`, `node_modules/`, build artifacts.
