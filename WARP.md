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
- **Drag & Drop**: React DND for intuitive diagram creation
- **Zoom & Pan**: Canvas transformation with grid snapping
- **Smart Layouts**: Automatic positioning within groups while preserving manual layouts
- **Pathfinding**: Intelligent edge routing around obstacles
- **Hover Information**: Animated popover system for node details
- **Connect Mode**: Visual connection creation between nodes
- **File I/O**: JSON import/export functionality
- **AI Generation**: Natural language to diagram conversion

## Development Notes

### Adding New Node Types
1. Add AWS icon support in `src/components/diagram/aws-icon.tsx`
2. Extend type definitions if needed
3. Icons should follow diagrams.mingrammer.com naming conventions

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