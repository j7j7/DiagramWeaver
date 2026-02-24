# Diagram Weaver

An interactive diagram creation tool for building architecture and flow diagrams. Create diagrams by dragging resources from the sidebar or describing them in natural language. Diagrams use a flat node structure with JSON-based storage and export.

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **UI**: Radix UI components, TailwindCSS, shadcn/ui pattern
- **Drag & Drop**: React DnD with HTML5 backend
- **Icons**: Lucide React (74 symbols) + provider-specific icons (AWS, Azure, GCP, etc.)
- **Editor**: CodeMirror for JSON editing with syntax highlighting

## Features

### Canvas & Editor

- **Interactive Canvas**: Zoom, pan, grid snap (10px) for precise placement
- **Responsive Design**: Mobile-friendly with touch support
- **Fit to View**: Auto-scale canvas to fit all content
- **Undo/Redo**: Full history support (Ctrl+Z / Ctrl+Shift+Z)
- **Multi-Tab**: Create and switch between multiple diagram tabs

### Resource Browser (Left Panel)

- **Searchable Sidebar**: Filter resources by name across all providers
- **Collapsible Panel**: Toggle between full view and narrow strip (48px) with vertical app name
- **Drag-and-Drop**: Drag resources onto the canvas
- **Double-Click Paste**: Add items at viewport center
- **Right-Click Search Modal**: Right-click on empty canvas to open search-resources modal; filter and click or drag items to place
- **Resource Truncation**: Long names truncated with ellipsis; tooltip shows full name on hover

### Resource Categories

| Provider | Description |
|----------|-------------|
| AWS | Amazon Web Services (64 resources) |
| Azure | Microsoft Azure (46 resources) |
| GCP | Google Cloud Platform (38 resources) |
| Kubernetes | K8s resources (24 resources) |
| Generic | Objects, shapes, devices, text (17 resources) |
| Programming | Languages, frameworks, flowcharts (75 resources) |
| On-Premise | Servers, databases, monitoring (66 resources) |

Additional providers available (can be enabled): Alibaba Cloud, OCI, SaaS, Elastic, Firebase, DigitalOcean, IBM Cloud, OpenStack, Outscale, GIS.

### Icons Section

- **Lucide Symbols**: 74 icons (Home, Shield, User, Star, Lock, Database, Server, etc.) across 11 categories
- **Emojis**: Standard emoji set for quick visual markers
- **Same Size**: Icons render at 80×80 like other resource items

### Node Types

- **Shapes**: Rectangle, circle, square, triangle, star, cloud, point, trapezoid, parallelogram, hexagon, pentagon, octagon, kite, jigsaw, chevron, arrow, rounded-rectangle
- **Line**: Independent line element with drag endpoints (blue/green handles), customizable start/end caps (none, arrow, dot, square), thickness, and color
- **Textbox**: Rich text with bold/italic/underline and bullet/numbered lists
- **Label**: Text labels with styling
- **Resource Icons**: Cloud provider and on-premise resources with 80×80 icons
- **Lucide Icons & Emojis**: Standard symbols from the Icons section

### Connections

- **Bezier Curves**: Smooth curved connections between nodes
- **Per-Connection Controls**: Arrow toggle, color picker, text label, text position (0–100%)
- **Direction Indicators**: Preferred exit/entry directions
- **Connection Order**: Lines respect z-order (Move to Front/Back affects layering)
- **Connections Panel**: Popover on Connections button; per-connection controls when node selected

### Selection & Multi-Select

- **Single Select**: Click to select node or connection
- **Shift+Click**: Add/remove from selection
- **Selection Box**: Drag on empty canvas to draw rectangle; items within selected
- **Multi-Drag**: Drag multiple selected items together; relative positions preserved

### Groupings

- **Create Group**: Select 2+ nodes → Create grouping for coordinated movement
- **Auto Layout**: Groupings move as blocks in auto-layout
- **Add/Remove**: Add nodes to grouping or remove from grouping

### Styling & Layout

- **Visual Styling Panel**: Shapes/textbox (border, background, shadow, tags); Lucide icons (color, remove background); resource items (remove background)
- **Text Styling Panel**: Justification (left, center, right, full), vertical position (top, middle, bottom)
- **Line Styling Panel**: Start/end caps, thickness (0.5–10px), color (for line objects)
- **Rotation**: 0°, ±45°, ±90° for nodes; interactive corner rotation handles
- **Resize Handles**: Edge and corner handles for shapes, textboxes, groups

### Alignment & Layout

- **Align**: Left, Center (H), Right, Top, Middle (V), Bottom
- **Distribute**: Horizontally, vertically
- **Auto Layout**: Hierarchical layered layout (Ctrl+Shift+L); minimizes crossings, preserves groupings

### JSON Editor Panel

- **Live Sync**: Bidirectional sync between canvas and JSON
- **CodeMirror**: Line numbers, syntax highlighting, bracket matching, validation
- **Keyboard Shortcut**: Ctrl+Shift+J (Cmd+Shift+J on Mac) to toggle
- **Type Expansion**: Abbreviated types (e.g. `aws.c.ec2`) expand to full form
- **Resizable**: Collapsible panel with localStorage persistence

### Mermaid Import

- **Import Mermaid**: File → Import Mermaid or File → Load (.mmd, .mermaid files)
- **Supported types**: Flowchart, class diagram, sequence diagram
- **Flowchart**: Node shapes (rect, rounded, circle, diamond, hexagon, parallelogram, trapezoid, etc.), connectors with labels, directions TD/LR/BT/RL, YAML frontmatter for layout (dagre/elk)
- **Class diagram**: UML-style classes (name, attributes, methods), inheritance (`Parent <|-- Child`)
- **Sequence diagram**: Participants as rounded-rectangles, messages as lines, self-loops as loop shapes
- **Examples**: File → Examples → Mermaid Simple / Mermaid Complex / Mermaid Class Diagram / Mermaid Sequence Diagram
- **Validation**: `npm run validate-mermaid` or `GET /api/validate-mermaid` when dev server running

See `docs/MERMAID-IMPORT.md` for full syntax and mapping.

### Export & Persistence

- **Export PNG**: Viewport export via html-to-image
- **Save/Load**: JSON file save and load (JSON + .mmd/.mermaid)
- **Copy Viewer URL**: Shareable URL for read-only viewer
- **Examples**: Built-in example diagrams (File → Examples)

### Viewer

- **Read-Only Mode**: Share diagrams via URL without editing (File → Copy Viewer URL)
- **URL Parameters**: `?json=` (base64-encoded diagram) or `?url=` (URL to fetch JSON from a remote host)
- **Controls**: Zoom in/out, Fit to View, Properties panel toggle, metadata popup toggle
- **Selection**: Click nodes or connections to view name, type, and metadata in the Properties panel
- **Metadata Popups**: Compact popup under selected item shows key/value pairs (toggle in controls)
- **Layers Panel**: When diagram has 2+ layers, toggle layer visibility (eye/eye-off)
- **Limits**: 5MB JSON max; 10s timeout for remote `url=` fetch

### View Options

- **Layers Panel**: Toggle layer visibility
- **Scratch Pad**: Notes area
- **Hover Text**: Toggle node labels on hover
- **Icon Background**: Toggle background on resource icons
- **Alignment Guides**: Snap guides when dragging
- **Read-Only Mode**: Disable editing

### Rules Engine

- **Edit → Rules**: Define validation rules for diagram content; pass (✓) or fail (✗) per rule
- **Operators**: Must have at least 1, at least N, more than N, exactly N, or must have all types
- **Type Matching**: Exact (searchable dropdown) or pattern with substring/`*` wildcard (e.g. `firewall` or `aws.database.*`)
- **Export/Import**: Save rules to JSON file (native Save As dialog in Chrome/Edge); import from file
- **Persistence**: Rules stored in localStorage and survive browser refresh
- **Optional**: Diagrams work without rules; rules are user-defined checks only

### Metadata

- **`metaData`**: Optional key/value pairs (e.g. `"IP Address": "192.168.1.1"`) on nodes, connections, zones, and groupings
- **Properties Panel**: Right panel shows selected item name, type, and metadata; add/edit/remove via UI (Edit → Toggle Properties)
- **Metadata Popup**: Compact popup under selected node/connection shows key/value pairs; Edit → Enable Properties toggles it
- **Key Suggestions**: Input suggests previously used keys across the diagram for consistent property names
- **JSON Storage**: Stored in diagram JSON as `metaData: { "Key": "value", ... }`; export/import preserves metadata
- **Viewer**: Properties panel and popup available in read-only mode

### Theme

- **Theme Selector**: Apply themes to selected items
- **Theme Editor**: Customize colors, borders, gradients
- **Theme Menu**: Quick theme application from toolbar

### Other

- **Tutorial**: In-app tutorial overlay (File → Start Tutorial)
- **About Dialog**: Version and project info
- **Sequential IDs**: New nodes get IDs like `aws-database-dynamodb-1`, `grouping-2`
- **Palette Copy/Paste**: Select resource in sidebar → Copy → Paste to add at center

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New diagram |
| Ctrl+O | Load |
| Ctrl+S | Save |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+A | Select All |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+Shift+J | Toggle JSON panel |
| Ctrl+Shift+L | Auto Layout |
| Delete / Backspace | Delete selected |
| Escape | Clear selection |

## Development

### Build Commands

- `npm run dev` – Start dev server (port 9002)
- `npm run build` – Production build
- `npm run lint` – Run ESLint
- `npm run typecheck` – TypeScript type check

### Resource Management

Single source of truth: `public/resources/`

- All resource JSON files and icons are served from `public/resources/*`
- Resource Browser fetches index from `/resources/resource-components.json` and provider files from `/resources/*.json`
- Canvas uses the same icon paths via `imagePath` from the browser into node data
- **No separate source directory or sync step** – update JSON files directly under `public/resources/`

See detailed guide: `docs/RESOURCES.md`

### Getting Started

1. Start the development server: `npm run dev`
2. Edit resource files in `public/resources/`
3. Reload the app; changes appear in the Resource Browser

### Project Structure

```
src/
  app/              # Next.js pages and API
  components/       # React components
    diagram/        # Diagram nodes, shapes, connections
    editor/         # Canvas, sidebar, toolbars, panels
    viewer/         # Read-only viewer
    tutorial/       # Tutorial overlay
    ui/             # shadcn/ui primitives
  hooks/            # use-canvas-*, use-diagram-tabs, etc.
  lib/              # Types, schemas, utils, auto-layout, etc.
```

## Documentation

- `docs/RESOURCES.md` – Resource and icon system
- `docs/MERMAID-IMPORT.md` – Mermaid flowchart, class diagram, and sequence diagram import
- `AGENTS.md` – Build commands and code style
- `MEMORY.MD` – Detailed feature history and implementation notes
