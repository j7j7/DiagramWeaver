# Diagram Weaver

An interactive diagram creation tool that allows users to create diagrams from JSON configurations or natural language descriptions.

## Development

### Resource Management

- Single source of truth: `public/resources/`
  - All resource JSON files and icons are served from `public/resources/*`
  - The Resource Browser fetches the index from `/resources/resource-components.json` and provider files from `/resources/*.json`
  - The Canvas renders the same icon paths by carrying `imagePath` from the browser into node data

There is no separate source directory or sync step. Update JSON files directly under `public/resources/`.

See detailed guide: `docs/RESOURCES.md`.

### Getting Started

1. Start the development server: `npm run dev`
2. Edit resource files in `public/resources/`
3. Reload the app; changes will appear in the Resource Browser
