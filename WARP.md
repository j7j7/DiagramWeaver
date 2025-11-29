# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with Turbopack on port 9002
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### AI/Genkit Development
- `npm run genkit:dev` - Start Genkit development server
- `npm run genkit:watch` - Start Genkit with file watching

## Architecture Overview

### Core Application Structure
DiagramWeaver is a Next.js 15 application that renders interactive diagrams from JSON input. The app consists of:

1. **Main Editor (`DiagramEditor`)** - Central component managing diagram state, drag-and-drop, and user interactions
2. **Canvas System (`EditorCanvas`)** - Handles diagram rendering, zooming, panning, and layout algorithms
3. **Node Components** - Modular diagram elements with AWS icon support and hover information
4. **AI Generation** - Google Genkit integration for natural language to diagram conversion

### Key Data Flow
1. Diagrams are defined by `DiagramData` interface containing nodes, edges, and groups
2. Nodes support AWS service types with corresponding icons from the diagrams.mingrammer.com collection
3. Groups can be nested and support both "zone" and "group" subtypes for different visual styling
4. The layout engine automatically positions grouped elements while preserving manual positioning for top-level items

### Component Architecture
- `src/components/diagram-editor.tsx` - Main orchestrator component
- `src/components/editor/editor-canvas.tsx` - Canvas rendering and interaction logic
- `src/components/diagram/` - Individual diagram element components (nodes, edges, groups)
- `src/components/editor/` - Editor-specific UI components (sidebar, draggable items)

### Type System (`src/lib/types.ts`)
Core interfaces define the diagram structure:
- `DiagramNodeData` - Individual diagram elements with AWS service types
- `DiagramGroupData` - Container elements supporting nesting and visual grouping
- `DiagramEdgeData` - Connections between nodes
- `DiagramData` - Complete diagram structure

### AI Integration
Uses Google Genkit for natural language processing:
- `src/ai/genkit.ts` - Genkit configuration with Gemini 2.5 Flash
- `src/ai/flows/generate-diagram-code-from-description.ts` - Flow for converting descriptions to JSON
- `src/app/actions.ts` - Server action wrapping AI generation with error handling

### Styling and Theming
- TailwindCSS with custom design system following blueprint specifications
- Primary colors: Deep blue (#3F51B5), Light gray (#EEEEEE), Teal (#009688)
- Fonts: Inter (body), Space Grotesk (headlines)
- Radix UI components for consistent interactions

### Features
- **Drag & Drop**: React DND for intuitive diagram creation with real-time visual feedback
  - Original items move during drag (no ghost preview)
  - Connection lines update dynamically during drag operations
  - Multi-item dragging with maintained relative positioning
  - Undo/redo history updated only on drop completion
- **Zoom & Pan**: Canvas transformation with grid snapping
- **Smart Layouts**: Automatic positioning within groups while preserving manual layouts
- **Pathfinding**: Intelligent edge routing around obstacles
- **Hover Information**: Animated popover system for node details
- **Connect Mode**: Visual connection creation between nodes
- **File I/O**: JSON import/export functionality
- **AI Generation**: Natural language to diagram conversion
- **Multi-Select**: Shift-click and drag-to-select for batch operations
- **JSON Editor**: Live bidirectional sync with CodeMirror editor

## Development Notes

### Adding New Node Types
1. Add icon support in `src/components/diagram/aws-icon.tsx` (icons are loaded from `public/resources/...`)
2. Extend type definitions if needed
3. Icons should follow diagrams.mingrammer.com naming conventions
4. Place new icons under `public/resources/<provider>/<category>/` and update the corresponding `public/resources/resource-<provider>.json`

### Modifying Layout Algorithm
The layout system in `EditorCanvas` handles:
- Nested group positioning with recursive layout
- Grid-based arrangement within groups
- Automatic sizing based on content
- Top-level manual positioning preservation

### AI Prompt Engineering
The Genkit flow expects specific JSON structure output. When modifying prompts:
- Ensure output matches `DiagramData` interface
- Include proper AWS service type names
- Consider group/zone relationships for complex diagrams

### Testing Considerations
- Test diagram rendering with various node counts and nesting levels
- Verify drag-and-drop behavior across group boundaries
- Validate AI generation with edge cases and malformed inputs
- Check zoom/pan performance with large diagrams

## Recent Architectural Improvements (2025-11-29)

### Drag and Drop System Enhancements

#### Visual Feedback System
The drag-and-drop system has been enhanced to provide immediate visual feedback:

1. **Original Item Movement**: Items move directly on the canvas during drag rather than showing a ghost preview
   - Implemented using `getEmptyImage()` from `react-dnd-html5-backend` to suppress default drag preview
   - Applied in both `DiagramNode` and `DiagramZone` components via `preview(getEmptyImage())`

2. **Display Position Override System**: 
   - `useCanvasDragDrop` hook tracks temporary drag positions (`dragPosition` for single items, `multiDragPositions` for groups)
   - `displayNodesById` and `displayZonesById` lookup maps layer drag positions over base item positions
   - These display maps are computed from `animatedNodesById`/`animatedZonesById` (which include selection animations)
   - All rendering and connection components use display maps for consistent visual state

3. **Real-Time Connection Updates**:
   - Connection rendering components (`CanvasConnections`, `CanvasArrowToggles`, `CanvasConnectionText`) receive display position maps
   - Connection lines redraw automatically as nodes/zones move during drag
   - Bezier curves recalculate control points based on temporary positions
   - Works for both single-item and multi-item drag operations

4. **State Management**:
   - Drag operations update only visual state, never `diagramData` directly
   - Undo/redo history updated once on drop (not during drag hover)
   - `isDragging` flag passed to parent to debounce history updates
   - Clean separation between visual feedback and data persistence

#### Implementation Details

**Hook Layering** (in `editor-canvas.tsx`):
```
diagramData → processedNodes/processedZones (layout)
            → nodesById/zonesById (lookup maps)
            → animatedNodesById/animatedZonesById (selection animation)
            → displayNodesById/displayZonesById (drag overrides)
            → rendering components
```

**Key Files**:
- `src/hooks/use-canvas-drag-drop.ts` - Tracks drag positions and hover targets
- `src/components/editor/editor-canvas.tsx` - Creates display maps and passes to renderers
- `src/components/diagram/diagram-node.tsx` - Drag source for nodes
- `src/components/diagram/diagram-zone.tsx` - Drag source for zones
- `src/components/editor/canvas-connections.tsx` - Connection line rendering

### Editor Canvas Architecture

The `EditorCanvas` component follows a modular hook-based architecture:

**Core Hooks**:
- `useCanvasTransform` - Pan/zoom state and transformations
- `useCanvasOperations` - CRUD operations for diagram items
- `useCanvasDragDrop` - Drag-and-drop logic with react-dnd
- `useCanvasSelection` - Multi-item selection with rectangle
- `useCanvasInteractions` - Mouse/touch event handling
- `useCanvasClipboard` - Copy/paste operations
- `useCanvasExport` - PNG export functionality
- `useCanvasContextMenu` - Right-click menu management

**Data Flow**:
1. Parent `DiagramEditor` maintains `diagramData` state
2. `EditorCanvas` calculates layout via `calculateLayout()` from `canvas-layout-utils.ts`
3. Hooks process layout data and manage interactions
4. Display maps merge all visual states (animation + drag)
5. Rendering components use display maps for final output

**Refactoring Stats**:
- Original: ~4100 lines in single file
- Current: 513 lines in main component + 8 focused hooks
- 87.5% reduction in main component complexity
- Each hook handles single responsibility

### JSON Editor System

The JSON editor panel provides live bidirectional sync:
- Uses CodeMirror 6 for professional editing experience
- Validates JSON against Zod schemas
- Supports both flat and hierarchical (nested) diagram formats
- Auto-converts between formats transparently
- Debounced updates (16ms) prevent flickering during rapid changes
- Scroll position preservation during external updates
- Recent cleanup removed verbose debug logging for cleaner console output
