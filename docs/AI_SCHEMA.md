# DiagramWeaver AI Schema

The LLM authoring pack lives in **[`docs/ai-schema/`](ai-schema/README.md)**.

| File | Role |
|------|------|
| **`docs/ai-schema/diagram-authoring.json`** | Attach to the model: output contract, families (shapes, cards, charts, tables-as-grid, icons, colours, themes), card skeletons, examples. |
| **`docs/ai-schema/resource-types.json`** | Full `provider.category.resource` index (AWS, Azure, GCP, k8s, …). Attach when the task needs a specific icon. |
| **`src/lib/schemas.ts`** | Runtime Zod (`DiagramDataSchema`) — what the editor/viewer will parse. |

Regenerate / test:

```bash
npm run generate-ai-schema
npm run validate-ai-schema
```
