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
- **Pathfinding**: Custom algorithm for orthogonal connection routing
- **State Management**: React hooks and context for diagram state

### Core Features
- **Interactive Diagram Editor**: Canvas-based editor with zoom, pan, and grid snap
- **Drag-and-Drop Interface**: Drag resources from sidebar to canvas; supports nested groups and zones
- **AI-Powered Generation**: Generate diagrams from natural language descriptions using AI
- **Multi-Provider Support**: Icons and resources for AWS, Azure, GCP, OCI, Kubernetes, and more
- **Advanced Pathfinding**: Orthogonal routing with anti-connection-hugging, buffer zones, and smart connection points
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
- Resource JSON consolidation: Single source of truth under `public/resources/`; removed duplicate JSONs under `resources/`. Resource Browser now fetches index at runtime, and Canvas uses the same exact icon path via `imagePath` to ensure icon parity.
- **Pathfinding Overhaul**: Revolutionary improvements for connection routing, anti-hugging, and smart connections
- **Resource Reorganization**: Split into modular JSON files for better maintainability
- **Bug Fixes**: Icon persistence, drag-drop preservation, scrollbar issues resolved
- **Grid and Snap Enhancements**: Improved placement, collision prevention, and nested layouts
- **Type System**: Updated types to preserve resource information during operations
- **UI Fix**: Resolved React warning about mixing `border` and `borderImage` in `src/components/diagram/diagram-group.tsx` by replacing shorthand `border` with explicit `borderWidth`/`borderStyle`/`borderColor` and using `borderImageSource` + `borderImageSlice` for gradient borders.
- **New** (2025-10-27): Added "Fit to view" and "Export PNG" buttons under Show JSON toggle in left sidebar (ComponentSidebar). EditorCanvas now exposes `fitToView` and `exportPng` via forwardRef. PNG export uses `html-to-image` to render the viewport and triggers a browser download (diagram.png). Fit-to-view computes bounds using dynamic node dimensions plus margins. Removed temporary console logs from connection rendering and DiagramGroup shadow debug. Typecheck passed; ESLint currently errors due to a circular reference in `.eslintrc.json` (unchanged).
- Note: PNG export disables font embedding to avoid CSSStyleSheet SecurityError from cross-origin stylesheets.
- Sidebar fix: resource icons now resolve by deriving standard file names first (e.g., "EC2 Instance" → `/resources/aws/compute/ec2-instance.png`) and fall back to explicit `file` path, ensuring correct icons appear.
- Policy: Do not persist `imagePath` in created nodes; icons are always resolved from `type` with provider-specific aliasing (e.g., Kubernetes `statefulset` → `sts.png`).
- **Optimization** (2025-10-27): Removed redundant `imagePath` fields from diagram JSON files and drag/drop operations. The `ResourceIcon` component (renamed from `AwsIcon`) automatically derives icon paths from `type` field for all providers (e.g., "generic.device.mobile" → "/resources/generic/device/mobile.png", "aws.database.dynamodb" → "/resources/aws/database/dynamodb.png"). The `imagePath` field is now truly optional and only needed for custom icon overrides. This reduces JSON file size, eliminates data duplication, and works seamlessly with all 18+ supported providers (AWS, Azure, GCP, Generic, K8s, Programming, etc.).
- **NEW FEATURE** (2025-10-27): JSON Editor Panel - Added a collapsible JSON editor to the right side of the canvas with live sync capabilities. Features include:
  - **CodeMirror Editor**: Professional code editor with line numbers, syntax highlighting, bracket matching, and JSON linting
  - **Live Sync**: Real-time bidirectional updates between canvas and JSON - edit text changes reflect instantly on canvas, canvas changes update JSON
  - **Validation**: Zod schema validation with detailed error reporting for both JSON syntax and diagram structure
  - **Resizable Panel**: Uses `react-resizable-panels` for smooth resize and collapse behavior
  - **Keyboard Shortcut**: Ctrl+Shift+J (Cmd+Shift+J on Mac) to toggle panel
  - **Local Persistence**: Panel state and width saved to localStorage
  - **Debounced Updates**: 300ms debounce prevents performance issues during rapid typing
  - **Loop Protection**: Prevents infinite update cycles between editor and canvas
  - **Tech Stack**: `@uiw/react-codemirror`, `@codemirror/lang-json`, Zod validation, `react-resizable-panels`
  - **UI Polish**: Status indicators, error display, smooth transitions, collapsed state toggle button
- **ID Generation Improvement** (2025-10-27): Replaced timestamp-based ID generation with sequential numbering for cleaner diagram organization:
  - **Sequential Node IDs**: New nodes get IDs like `aws-database-dynamodb-1`, `aws-database-dynamodb-2`, etc.
  - **Sequential Group/Zone IDs**: Groups and zones get IDs like `group-1`, `zone-1`, `group-2`, etc.
  - **Smart ID Scanning**: The `generateSequentialId()` function scans existing diagram data to find the highest sequential number (1-999) for each type and increments, ignoring timestamp-based IDs (numbers > 999)
  - **Backward Compatibility**: Handles existing diagrams with timestamp-based IDs gracefully by ignoring them and starting fresh sequential numbering
  - **Consistent Operations**: Copy/paste operations, drag-from-sidebar, and group/zone creation all use sequential IDs
  - **Implementation**: New `src/lib/id-generator.ts` utility integrated in both `diagram-editor.tsx` and `editor-canvas.tsx`
  - **Benefits**: Cleaner diagram JSON, predictable naming, easier debugging and manual editing, eliminates 13-digit timestamp clutter
- **Type Expansion System** (2025-10-27): Added intelligent type abbreviation expansion for faster JSON editing:
  - **Fuzzy Matching**: Type patterns like `aws.c.ec2` automatically expand to `aws.compute.ec2-instance`
  - **Ultra-Short Patterns**: Even `a.c.e` expands to `aws.compute.ec2-instance` (first alphabetical match)
  - **Multiple Strategies**: Exact match → prefix match → contains match → abbreviation match → fuzzy matching
  - **Real-time Expansion**: JSON editor automatically expands abbreviated types during editing
  - **Resource Awareness**: Loads all available resources from providers to ensure accurate matching
  - **Smart Scoring**: Prioritizes provider > category > resource matching with weighted scores
  - **Implementation**: New `src/lib/type-matcher.ts` utility integrated into JSON editor for seamless type expansion
  - **Performance**: Caches loaded resource types to avoid repeated API calls
- **ResourceIcon Component Overhaul** (2025-10-27): Completely fixed icon loading system for 100% reliability across all providers:
  - **Removed All Fallback Logic**: Eliminated problematic fallback paths that caused wrong 404 requests (e.g., `/resources/aws/compute/ec2.png` instead of correct catalog lookup)
  - **Pure Catalog Lookup**: Icons now ONLY load from resource catalog files (resource-*.json), ensuring correct filename mapping (e.g., `aws.compute.ec2` → fetch resource-aws.json → find "EC2" → use "amazon-elastic-compute-cloud.png")
  - **Fixed Infinite Recursion**: Removed buggy `onError` handler that caused infinite incrementing when no more candidates existed
  - **Simplified State Management**: Removed complex `candidates` array and `idx` state, replaced with simple `iconPath` from catalog lookup
  - **Enhanced Error Handling**: Added proper HTTP status checking and detailed console warnings for debugging
  - **Universal Fix**: Works for ALL providers (AWS, Azure, GCP, Generic, K8s, etc.) - no more mixed working/broken icons
  - **Performance**: Icons load once from catalog, no retry loops or multiple failed requests
  - **Clean Fallback**: Only shows generic SVG icon if catalog lookup completely fails, no broken image attempts
- **Hierarchical Rendering Fix** (2025-10-29): Fixed infinite recursion error when changing group orientation and implemented proper parent-first rendering:
  - **Root Cause**: `resetChildGroupPositions` function had multiple issues causing stack overflow:
    - Wrong variable reference: Using `groupData.children` instead of `group.children` in recursive calls
    - No cycle protection: No visited set to prevent infinite recursion in circular references
    - Mixed property names: Inconsistent use of `children` vs `nodes` properties
  - **Cycle Protection**: Added `visited: Set<string>` parameter to track processed groups and prevent infinite loops
  - **Fixed Variable References**: Corrected all recursive calls to use proper `group.children` instead of `groupData.children`
  - **Type Consistency**: Updated all references to use `children` property consistently (removed fallback `(groupData as any).nodes`)
  - **Hierarchical Rendering**: Implemented `sortedRenderItems` that sorts diagram elements by depth:
    - Parents (depth 0) render before children (depth 1+)
    - Maintains original order for items at same depth level
    - Uses parent-child map to calculate depth and sort accordingly
  - **Rendering Order Update**: Replaced separate group/node rendering loops with single sorted loop for proper visual layering
  - **Testing**: Created comprehensive test suite (`test-recursion-fix.js`) covering normal hierarchy, circular references, and complex nested structures
  - **Benefits**: No more stack overflow errors, proper visual hierarchy, correct z-index ordering, maintained drag-drop functionality

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
