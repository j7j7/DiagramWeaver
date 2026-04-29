# Folder layout (`tree.md`)

Canonical narrative: **README → Development → Project Structure**. Update this file when top-level directories or major `src/` groupings change.

**Last verified:** 2026-04-29

```
.
├── docs/
├── public/
│   ├── examples/
│   └── resources/          # Served JSON + icons (`/resources/*`)
├── scripts/
├── resources/               # Templates / tooling beside public (optional); live catalogs under public/resources/
├── src/
│   ├── app/
│   │   ├── api/             # export, validate-mermaid, validate-image-url
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
