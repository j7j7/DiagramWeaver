# MEMORY.MD

## DiagramWeaver - Latest Features and Functions (Updated 2025-10-27)

### Project Overview
DiagramWeaver is a Next.js 15 application for creating interactive architecture diagrams. It supports drag-and-drop design, AI-powered generation from natural language descriptions, and integration with multiple cloud providers. Users can build, edit, and visualize complex system architectures with automatic pathfinding for connections.

### Tech Stack
- **Framework**: Next.js 15 with React 18
- **UI Library**: Radix UI components with TailwindCSS for styling
- **Drag & Drop**: React DND for interactive elements
- **AI Integration**: Google Genkit with Gemini 2.5 Flash for diagram generation
- **Icons and Resources**: Custom PNG/SVG icons for 17+ providers
- **Pathfinding**: Custom algorithm for orthogonal edge routing
- **State Management**: React hooks and context for diagram state

### Core Features
- **Interactive Diagram Editor**: Canvas-based editor with zoom, pan, and grid snap
- **Drag-and-Drop Interface**: Drag resources from sidebar to canvas; supports nested groups and zones
- **AI-Powered Generation**: Generate diagrams from natural language descriptions using AI
- **Multi-Provider Support**: Icons and resources for AWS, Azure, GCP, OCI, Kubernetes, and more
- **Advanced Pathfinding**: Orthogonal routing with anti-edge-hugging, buffer zones, and smart connection points
- **Group and Zone Management**: Create nested groups; intra-group reordering and hierarchical connections
- **Resource Browser**: Searchable sidebar with categorized resources from all providers
- **Export and Persistence**: JSON-based diagram storage and export capabilities
- **Responsive Design**: Mobile-friendly with touch support via use-mobile hook

### Supported Providers and Categories
- **Cloud Providers**: AWS (525 resources), Azure (808), GCP (94), OCI (141), Alibaba Cloud (95), IBM Cloud (181), DigitalOcean (26), OpenStack (51), Outscale (13)
- **Containerization**: Kubernetes (46 resources)
- **SaaS Tools**: 41 resources including Slack, Google Analytics, Salesforce
- **On-Premise**: 173 resources for servers, databases, monitoring tools
- **Programming**: 74 resources including languages (JavaScript, Python), frameworks (React, Django), flowcharts
- **Elastic Stack**: 45 resources for Elasticsearch, Kibana, Beats
- **Firebase**: 23 resources for core services and features
- **GIS**: 68 resources for mapping, geocoding, and spatial tools
- **Generic**: 30 resources for common elements like servers, networks

### AI Features
- **Natural Language Input**: Describe diagrams in plain English; AI generates JSON structure
- **Gemini Integration**: Uses Google Genkit for prompt engineering and code generation
- **Flow Support**: AI flows in `src/ai/flows/` for diagram code generation from descriptions

### UI/UX Features
- **Component Sidebar**: Draggable items with search and categorization
- **Editor Canvas**: Zoom/pan, grid visibility, snap-to-grid for precise placement
- **Hover and Selection**: Tooltips, highlighting for connected elements
- **Responsive Layout**: Adaptive design with proper scrolling in sidebars
- **Dark Mode Support**: Some providers (e.g., OCI) have white variants for dark themes
- **Icon Persistence**: Fixes ensure icons remain visible after connections and selections

### Recent Updates and Fixes
- Resource JSON consolidation: Single source of truth under `public/resources/`; removed duplicate JSONs under `resources/`. Resource Browser now fetches the index at runtime, and the Canvas uses the same exact icon path via `imagePath` to ensure icon parity.
- **Pathfinding Overhaul**: Revolutionary improvements for edge routing, anti-hugging, and smart connections
- **Resource Reorganization**: Split into modular JSON files for better maintainability
- **Bug Fixes**: Icon persistence, drag-drop preservation, scrollbar issues resolved
- **Grid and Snap Enhancements**: Improved placement, collision prevention, and nested layouts
- **Type System**: Updated types to preserve resource information during operations
- **UI Fix**: Resolved React warning about mixing `border` and `borderImage` in `src/components/diagram/diagram-group.tsx` by replacing shorthand `border` with explicit `borderWidth`/`borderStyle`/`borderColor` and using `borderImageSource` + `borderImageSlice` for gradient borders.
- **New** (2025-10-27): Added a floating "Resize to fit" button at the bottom-right of the canvas. Implemented `handleFitToView` in `src/components/editor/editor-canvas.tsx` to compute bounds of all elements and adjust `transform` so everything fits within the viewport with padding. Typecheck passed; ESLint currently errors due to a circular reference in `.eslintrc.json` (unchanged).
- **Optimization** (2025-10-27): Removed redundant `imagePath` fields from diagram JSON files and drag/drop operations. The `ResourceIcon` component (renamed from `AwsIcon`) automatically derives icon paths from the `type` field for all providers (e.g., "generic.device.mobile" → "/resources/generic/device/mobile.png", "aws.database.dynamodb" → "/resources/aws/database/dynamodb.png"). The `imagePath` field is now truly optional and only needed for custom icon overrides. This reduces JSON file size, eliminates data duplication, and works seamlessly with all 18+ supported providers (AWS, Azure, GCP, Generic, K8s, Programming, etc.).

### Development Tools
- **Scripts**: npm run dev, build, lint, typecheck, genkit
- **Launch Script**: `launch.sh` for macOS with dependency checks and server startup
- **Documentation**: WARP.md for architecture, blueprint.md for design specs
- **Testing**: TypeScript compilation and linting integrated

### Next Steps for Future Development
- Expand AI capabilities for more complex diagram types
- Add export formats (PNG, SVG, PDF)
- Enhance mobile experience
- Integrate more providers and update resource counts
- Optimize performance for large diagrams
