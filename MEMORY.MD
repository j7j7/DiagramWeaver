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
- **Edge Positioning for Group Children** (2025-11-03): Added ability to position nodes on the edges of their parent groups/zones:
  - **Edge Position Property**: Added `edgePosition?: 'top' | 'bottom' | 'left' | 'right'` to DiagramNodeData type
  - **Layout Algorithm**: Modified layoutGroup function to separate edge-positioned nodes from regular nodes
  - **Positioning Logic**: Edge nodes are positioned at the center of their respective edges, half inside/half outside the group boundary
  - **UI Control**: Added dropdown in sidebar (Details tab) to set edge position when node has a parent group
  - **Options**: "Normal (Inside)", "Top Edge", "Bottom Edge", "Left Edge", "Right Edge"
  - **Smart Centering**: Nodes positioned at midpoint of edge (horizontally centered on top/bottom, vertically centered on left/right)
  - **Schema Support**: Updated Zod schemas to validate edgePosition property
  - **Backward Compatible**: Nodes without edgePosition property continue to be positioned inside groups normally
  - **Preserved Capabilities**: All existing layout and positioning features remain functional
- **Edge Node Alignment Fix** (2025-11-03): Fixed alignment issue where edge-positioned nodes were misaligned when they were the only node inside a group/zone:
  - **Root Cause**: When a group contained only edge-positioned nodes (no regular nodes), the layout algorithm treated it as an "empty" group (`numItems === 0`) and used minimum sizing, but didn't position the edge nodes within that sizing logic
  - **Issue**: Edge nodes were being positioned after group sizing was calculated, but the empty group path didn't account for their positioning needs
  - **Solution**: Modified the empty group handling to:
    1. Detect when edge nodes exist even with no regular children
    2. Ensure adequate minimum group size for proper edge positioning (2x node dimensions)
    3. Position edge nodes within the empty group logic path, not just in the regular layout path
  - **Algorithm Update**: Edge node positioning now happens in both the empty group case and regular layout case
  - **Consistent Sizing**: Groups with edge nodes now maintain adequate minimum size (2x node dimensions) in both empty and populated states
  - **Even Distribution**: When multiple nodes are positioned on the same edge, they are distributed evenly across the available edge space
  - **Distribution Logic**: Single nodes remain centered; multiple nodes spread from edge to edge with equal spacing between them
  - **Result**: Edge nodes align perfectly whether single (centered) or multiple (evenly distributed), and groups maintain consistent size in all scenarios
- **Edge Distribution Enhancement** (2025-11-03): Fixed edge node distribution for 2-item case to avoid extreme positioning:
  - **Issue**: With exactly 2 nodes on an edge, they were positioned at extreme ends (0% and 100%) rather than being evenly distributed
  - **Root Cause**: Spacing calculation used `availableSpace / (count - 1)` which for 2 nodes resulted in positions at the very edges
  - **Solution**: Changed to `availableSpace / (count + 1)` and position at `spacing * (index + 1)` for more even distribution
  - **Result**: 2 nodes now position at ~33% and ~67% of the edge length instead of 0% and 100%
  - **Maintained**: Single node centering (50%) and 3+ node distribution remain unchanged
  - **Applies To**: Both horizontal (top/bottom) and vertical (left/right) edge distributions
- **Preferred Exit & Connection Arrows** (2025-11-03): Added per-connection directional control and arrowhead indicators:
  - **Per-Connection Preferred Exit**: Added `preferredExit?: 'top' | 'bottom' | 'left' | 'right'` to DiagramConnectionData interface
  - **Per-Connection Arrow Control**: Added `arrow?: boolean` property to connections to enable/disable arrowheads per connection
  - **Pathfinding Integration**: Modified connection boundary calculation to respect per-connection preferred exit directions
  - **Edge-Based Connections**: When preferred exit is set, connections start 1 grid position (20px) outward from the specified edge
  - **SVG Arrowhead Markers**: Arrowheads render as traditional SVG markers at the end of connection lines
  - **UI Controls**: Added preferred exit dropdown and arrow checkbox per outgoing connection in sidebar
  - **Node Edge Arrows**: Created NodeEdgeArrows component that renders arrows on specific node edges based on preferred exit direction
  - **Connection-Specific Settings**: Each outgoing connection can have its own preferred exit direction
  - **Pathfinding Logic**: Enhanced pathfinding algorithm to force first movement in preferred direction per connection
  - **Direction Enforcement**: Modified `findPath()` to accept preferred direction parameter and ensure first segment goes in that direction
  - **Orthogonal Routing**: Ensures preferred direction paths maintain right-angle lines without diagonal segments
  - **Zone Entry Fix**: Special handling for connections to zones ensures straight-line entry without grid-snapping curves
  - **Type Updates**: Extended DiagramConnectionData interface and updated sidebar connection controls
  - **Visual Implementation**: Arrowheads use SVG markers with automatic orientation and color matching
- **Benefits**: Granular control over individual connection routing, clearer data flow indication, enhanced diagram readability
- **Preferred Exit Positioning Fix** (2025-11-03): Fixed issue where preferred exit directions were not placing connection start points at the correct node edges:
  - **Root Cause**: getGroupBoundaryConnection was looking for preferred exit on node objects instead of connection data
  - **Data Location Fix**: Updated to read fromPreferredExit and toPreferredEntry from connection data (not from nodes)
  - **Edge Calculation**: Modified getPreferredExitPoint to position connections directly at node edges (not offset by grid distance)
  - **Proper Direction Support**: Added toPreferredEntry parameter to handle preferred entry directions for incoming connections
  - **Pathfinding Enhancement**: Extended findPath function to support both preferred start and end directions simultaneously
  - **Algorithm Update**: Enhanced pathfinding to ensure connections start in preferred direction and approach targets from preferred entry direction
  - **UI Completion**: Added incoming connection controls for "Preferred Entry (To)" and "Show Arrow (To)" in sidebar
  - **Result**: Preferred exit "bottom" now correctly places connection at bottom edge of node, same for all directions
  - **Entry Direction Fix**: Fixed reversed preferred entry directions - "left" now correctly enters from left side instead of right
  - **Logic Correction**: Removed incorrect getOppositeDirection() usage in target node entry point calculation
  - **Consistent Behavior**: Both source preferred exits and target preferred entries now work intuitively
- **Arrow Rendering Fix** (2025-11-03): Fixed arrow display to use SVG markers on connection lines instead of drawing separate lines:
  - **Issue**: NodeEdgeArrows component was drawing separate arrow lines instead of using existing connection lines
  - **Root Cause**: Duplicate rendering system - both SVG markers on connections and separate arrow lines were being drawn
  - **Solution**: Removed NodeEdgeArrows component usage and enhanced DiagramConnection arrow logic
  - **SVG Marker Integration**: Updated connection component to properly use fromArrow and toArrow properties with SVG markers
  - **Backward Compatibility**: Maintained support for legacy 'arrow' property while adding new per-direction arrow support
  - **Clean Rendering**: Arrows now appear as proper arrowheads on the connection lines, not as separate overlapping elements
  - **Result**: "Show Arrow" checkboxes now correctly add arrowheads to the existing connection lines

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
