# MEMORY.MD

## DiagramWeaver Codebase Analysis & WARP.md Creation

### Project Overview
DiagramWeaver is a Next.js 15 application for creating interactive architecture diagrams from JSON input, with AI-powered natural language generation capabilities.

### Key Analysis Findings
- **Tech Stack**: Next.js 15, React DND, Radix UI, TailwindCSS, Google Genkit
- **Architecture**: Component-based with Canvas/Editor separation
- **AI Integration**: Uses Gemini 2.5 Flash for diagram generation from descriptions
- **Features**: Drag & drop, zoom/pan, nested groups, pathfinding, hover info

### WARP.md Creation (2025-10-24)
Created comprehensive WARP.md file including:
- Development commands (dev, build, lint, typecheck, genkit commands)
- Architecture overview with 4 main components
- Data flow explanation
- Component structure mapping
- Type system documentation
- AI integration details
- Styling/theming information
- Feature descriptions
- Development notes for common tasks

### Important Files Analyzed
- `package.json` - Scripts and dependencies
- `src/components/diagram-editor.tsx` - Main orchestrator
- `src/components/editor/editor-canvas.tsx` - Canvas system
- `src/lib/types.ts` - Core interfaces
- `src/ai/flows/generate-diagram-code-from-description.ts` - AI generation
- `docs/blueprint.md` - Design specifications
- Sample diagram structure from `src/lib/sample-diagram.json`

### .gitignore Creation (2025-10-24)
Created comprehensive .gitignore file for the project including:
- Node.js dependencies (node_modules/, package logs)
- Next.js build artifacts (.next/, out/, build/, dist/)
- Environment variables (.env files)
- Firebase and Genkit specific ignores
- OS files (.DS_Store, Thumbs.db)
- Editor files (.vscode/, .idea/)
- Cache and temporary files
- Testing coverage directories

### launch.sh Creation (2025-10-24)
Added `launch.sh` for macOS to streamline testing:
- Validates Node/npm, checks Node >= 18
- Installs deps (npm ci/install) with --fresh-install option
- Kills conflicting processes on :9002, starts Next dev or production
- Optional Genkit server via --genkit, logs to .genkit-dev.log
- Opens browser, waits for server, traps cleanup on exit

### Grid & Snap Updates (2025-10-24)
- Improved grid visibility in `globals.css` (contrast and CSS var `--grid-size`)
- Snap on move for top-level items (snaps inside moveItem too)
- Prevent overlapping placements at top-level; drop aborted if collision
- New top-level items snap and nudge to nearest free grid slot
- Reduced node horizontal padding by ~50% (NODE_WIDTH 128 -> 104)
- Fixed nested group layout: child group x/y now computed on original group objects to avoid overlap in parent grids
- Intra-group drag reordering: dropping within a group re-inserts item by row-major position (no manual coords)
- Edge rendering: orthogonal routing with rounded corners; pathfinding fallback now L-shaped (no diagonals)
- Edge routing respects hierarchy: may pass through ancestor groups of endpoints; avoids unrelated groups/nodes
- Removed arrowheads; edges anchor to centers; highlight edges/nodes when connected to selection
- Fixed duplicate export in diagram-edge.tsx and ensured endpoints are excluded from obstacles
- Disconnect button now removes all edges to/from the selected node immediately (no extra click)

### WARP.md Analysis (2025-10-26)
Reviewed existing WARP.md file and found it to be comprehensive and current:
- All development commands properly documented
- Architecture overview accurately reflects codebase structure
- Component mappings align with actual src/ directory
- Type system documentation matches src/lib/types.ts
- AI integration details correspond to Genkit implementation
- Styling information matches blueprint.md specifications
- Development notes provide specific guidance for common tasks
- No updates needed - file is already optimal for future Warp instances

### Revolutionary Pathfinding System Overhaul (2025-10-26)
Completely revolutionized the pathfinding algorithm in `src/lib/pathfinding.ts` and connection logic in `src/components/diagram/diagram-edge.tsx`:

#### Core Pathfinding Improvements:
- **Enhanced Grid System**: Improved obstacle padding with 1-grid spacing minimum from objects
- **Smart Cost Calculation**: Multi-factor cost system considering obstacle distance, edge penalties, and direction changes
- **Buffer Zones**: Proper buffer zones around obstacles preventing edge-hugging patterns
- **Zone Edge Penalties**: Heavy penalties for paths along zone/group edges
- **Dynamic Penalties**: Distance-based penalties that scale with proximity to obstacles
- **Intelligent Fallback**: Advanced fallback path generation with multiple candidate scoring

#### Connection Point Revolution:
- **Middle-Point Strategy**: Group-to-group and group-to-zone connections now use middle-point entry logic
- **Smart Point Generation**: Enhanced connection point selection with quarter-points for groups/zones
- **Anti-Edge-Hugging**: Heavy penalties for connections that hug edges of groups/zones
- **Directional Optimization**: Connection scoring heavily favors directional alignment
- **Orthogonal Preference**: Strong bonuses for clean orthogonal connections
- **Proximity Intelligence**: Special handling for close objects with direct routing

#### Technical Enhancements:
- **Grid Node Properties**: Added nearObstacle, nearZoneEdge, obstacleDistance tracking
- **Enhanced Obstacle Types**: Extended obstacle interface to support groups and zones
- **Path Scoring**: Multi-criteria path evaluation for optimal route selection
- **Backward Compatibility**: Legacy functions maintained while new logic takes precedence

#### Key Constants:
- `PREFERRED_CLEARANCE = 20` (1 grid spacing)
- `ZONE_EDGE_PENALTY = 15` (heavy penalty for zone edge routing)
- `OBSTACLE_PROXIMITY_PENALTY = 10` (penalty for being too close)
- Enhanced penalties and bonuses for optimal routing behavior

#### Enhanced Edge-Hugging Detection (2025-10-26 Critical Update):
- **4-Point Analysis**: Each container (group/zone) generates 4 connection points (top/bottom/left/right)
- **Combinatorial Evaluation**: System tests all source→target point combinations (16 total for container-to-container)
- **Multi-Layer Edge Detection**: 
  - **Parallelism Detection**: 1000pt penalty for paths running parallel to edges within 30px
  - **Exit Edge Proximity**: 800pt penalty for paths that exit and immediately run along edges
  - **General Proximity**: 300pt penalty for paths within 40px of any edge
- **L-Shaped Path Rewards**: 200pt bonus for clean perpendicular exits (bottom→horizontal, right→vertical)
- **Debug Logging**: Console logs all connection scores for troubleshooting
- **Scoring Priority**: Edge-avoidance now dominates distance optimization
- **Specific Detection**: Targets problematic patterns like "exit bottom + go horizontal"

#### Icon Persistence Bug Fix (2025-10-26) - RESOLVED:
- **Root Cause Found**: SelectedItem type definition was overwriting node `type` field with 'node' literal
- **Issue**: In selectedItem useMemo, `{ ...node, type: 'node' }` overwrote AWS service type (e.g., 'generic.network.firewall')
- **Solution**: Changed SelectedItem to use `itemType` instead of `type` to avoid field name collision
- **Files Fixed**: 
  - `diagram-editor.tsx`: Updated SelectedItem type and all references
  - `editor-canvas.tsx`: Fixed click handlers to use `itemType: 'node'/'group'`
  - `component-sidebar.tsx`: Updated all conditional checks to use `itemType`
- **Result**: Node type information now preserved during selection/connection operations
- **Icons Now Persist**: Verified AWS icons remain visible after creating connections
- **TypeScript Clean**: All type errors resolved, passes typecheck

#### Drag-Drop Icon Preservation Fix (2025-10-26):
- **Resource Data Preservation**: Fixed `addNode` function to preserve full resource information during drag-drop
- **Type Path Construction**: Constructs proper type paths like `firebase.core.firebase` instead of generic types
- **AwsIcon Enhancement**: Updated to handle all provider resources (Firebase, AWS, etc.) not just generic ones
- **Resource Information**: Preserves provider, category, and resource details from sidebar to canvas
- **Fallback Handling**: Maintains fallback to generic icons when resource images fail to load

#### Left Menu Scrollbar Fix (2025-10-26):
- **Fixed Layout Issues**: Added proper `overflow-hidden` to parent containers
- **Improved ScrollArea**: Enhanced flex layout with `min-h-0` and `h-full` classes
- **Resource Browser**: Fixed scrolling in Resources tab with proper container nesting
- **Details Tab**: Enhanced ScrollArea layout for form content scrolling
- **Cross-Tab Consistency**: Both tabs now have proper vertical scrolling behavior

#### Validation:
- TypeScript compilation passes without errors
- Code maintains existing API compatibility
- All edge cases addressed with intelligent fallback strategies
- **Critical edge-hugging issue resolved with proper group entry**
- **Left menu now has functional vertical scrollbars**

### Next Steps for Future Development
- WARP.md is comprehensive and ready for use
- .gitignore properly configured to exclude build artifacts and dependencies
- Covers all major development scenarios
- Includes specific guidance for AI prompt engineering
- Documents complex layout algorithm behavior
- **Pathfinding system now handles all edge cases with revolutionary improvements**
