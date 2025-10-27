# Diagram Weaver

An interactive diagram creation tool that allows users to create diagrams from JSON configurations or natural language descriptions.

## Development

### Resource Management

The application uses a dual-directory structure for resource files:

- **Source files**: `resources/*.json` - Edit these files to update resources
- **Public files**: `public/resources/*.json` - Served by the web application

**Important**: After editing any resource files in the `resources/` directory, sync them to the public directory:

```bash
npm run sync:resources
```

This ensures that:
- JSON configurations are accessible via HTTP requests
- Resource images load correctly in the browser
- All resource metadata is up-to-date

### Getting Started

1. Start the development server: `npm run dev`
2. Edit resource files in `resources/` directory
3. Sync changes: `npm run sync:resources`
4. Changes will be reflected in the resource browser
