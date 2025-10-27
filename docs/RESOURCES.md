# Resources and Icon System

Single source of truth for all resource JSON files and icons lives under `public/resources/`.

- JSON index: `/resources/resource-components.json`
- Provider JSON: `/resources/resource-<provider>.json`
- Icons: `/resources/<provider>/<category>/<file>` (PNG/SVG)

The editor uses these in two stages:
- Resource Browser: fetches the index and provider JSONs from `/resources/*`, and constructs each item with an `imagePath` pointing at the exact icon
- Canvas: nodes carry `imagePath` in their data; the icon renderer uses that path directly (with fallback to type-based path derivation)

What changed
- Removed duplicate JSONs from `resources/` (kept `resource-template.json` only)
- Removed duplicate icon tree from `src/components/resources/`
- Resource Browser now fetches the index from `/resources/resource-components.json` at runtime
- Nodes include `imagePath`, and `AwsIcon` accepts `imagePath` for exact parity between Browser and Canvas

Folder structure
```
public/
  resources/
    <provider>/              # e.g., aws/, azure/, gcp/, generic/, k8s/, ...
      <category>/            # e.g., compute/, network/, database/, grouping/, ...
        <icon files>.png|.svg
    resource-components.json # global index of providers
    resource-<provider>.json # provider catalog (categories/resources)
```

Adding or updating resources
- Place icons in `public/resources/<provider>/<category>/`
- Update the corresponding `public/resources/resource-<provider>.json`
- Update `public/resources/resource-components.json` if you add/enable a provider
- Reload the app; Resource Browser refetches index/provider JSONs

Notes
- Do not put resource JSON or icons anywhere under `src/`; these will not be used
- The `metadata.basePath` values inside JSON may still refer to legacy paths; the app does not use them
