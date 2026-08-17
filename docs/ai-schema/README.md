# Diagram Weaver LLM schema

This folder is the **authoritative prompt pack** for an LLM that must **create or edit** Diagram Weaver JSON. The editor and viewer accept the same flat `DiagramData` shape (`nodes` + `connections`). Runtime validation is `DiagramDataSchema` in `src/lib/schemas.ts`; this pack adds **type catalogs**, **per-family recipes**, and **layout rules** that Zod does not encode.

## What to attach to the model

| File | When | Size |
|------|------|------|
| **`diagram-authoring.json`** | Always. Output contract, fields, cards, charts, colours, icons, recipes, examples. | Medium |
| **`resource-types.json`** | When the task needs a specific cloud/tech icon (`aws.*`, `azure.*`, `k8s.*`, …). | Large (full type index) |

Do **not** attach `authoring-source.json` — it is the hand-maintained input that `npm run generate-ai-schema` merges into `diagram-authoring.json`.

## Create vs edit

- **Create:** emit one flat diagram object: `{ "nodes": [...], "connections": [...] }`. Optional: `groupings`, `layers`, `recentColors`, `canvasBackgroundColor`, `viewState`.
- **Edit:** the user supplies current diagram JSON. Emit the **full updated diagram** (same shape). Upsert by `id`: keep unchanged nodes, change fields on existing ids, add new ids, drop removed ids. Every `connections[].from` / `to` must still exist.

Never wrap the payload in markdown fences unless the caller asked for fenced JSON.

## Regenerate / test

```bash
npm run generate-ai-schema   # rebuild generated JSON from catalogs + authoring-source
npm run validate-ai-schema   # catalog drift, fixtures, examples, family rules
npm run validate-ai-schema -- --check   # fail if generated files are stale
```

How testing is designed:

1. **Catalog integrity** — type ids are built with the same slug + remap rules as the palette (`generic.chart.pie`, `generic.card.*`, …). Unique ids. Enabled providers from `public/resources/resource-components.json`.
2. **Family rules** — charts need a matching `chart.kind`; cards need `card.templateId` + `card.elements`; connections must point at real node ids.
3. **Fixtures** in `docs/ai-schema/fixtures/` — one diagram per major family, parsed by the same structural rules an LLM must satisfy.
4. **Examples inside `diagram-authoring.json`** — must pass the same validator (so prompt examples stay importable).
5. **`--check`** — regenerate to a temp dir and diff, so the committed JSON cannot silently rot.

There is no in-app LLM runtime yet; paste generated JSON into the editor JSON panel or open it in `/viewer`.
