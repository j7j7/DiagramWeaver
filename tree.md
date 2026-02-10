# DiagramWeaver Editor Canvas Architecture

This document describes the refactored architecture of the Editor Canvas component, which was broken down from a single large component (~4100 lines) into smaller, focused modules.

## Overview

The `editor-canvas.tsx` component orchestrates multiple specialized hooks, utilities, and sub-components to provide a complete diagram editing experience. Each module has a specific responsibility, making the codebase more maintainable and testable.

---

## Core Component

### `editor-canvas.tsx`
**Main orchestrator component** that combines all hooks and sub-components to render the canvas.

**Responsibilities:**
- Coordinates all hooks and sub-components
- Handles mouse/touch event delegation
- Manages keyboard shortcuts
- Renders the canvas structure with nodes, zones, connections, and overlays
- Provides imperative API via ref forwarding

---

## Hooks (`src/hooks/`)

### `use-canvas-transform.ts`
**Canvas panning and zooming functionality**

**Exports:**
- `Transform` interface: `{ x: number, y: number, k: number }`
- `useCanvasTransform()` hook

**Features:**
- Manages canvas transform state (position and scale)
- Handles mouse wheel zoom with center-point preservation
- Provides `fitToView()` function to auto-fit diagram to viewport
- Supports external transform control (for parent component control)
- Calculates optimal zoom level based on diagram bounds

**Key Functions:**
- `handleWheel()` - Processes mouse wheel events for zooming
- `handleFitToView()` - Calculates and applies transform to fit entire diagram
- `setTransform()` - Updates transform state (internal or external)

---

### `use-canvas-selection.ts`
**Multi-item selection and selection rectangle**

**Exports:**
- `useCanvasSelection()` hook

**Features:**
- Manages selection rectangle drawing (drag to select)
- Handles multi-item selection with shift-click
- Integrates with export functionality (selection area export)
- Detects items within selection rectangle
- Manages selection state (start/end coordinates)

**Key Functions:**
- `handleMouseDown()` - Initiates selection rectangle
- `handleMouseMove()` - Updates selection rectangle while dragging
- `handleMouseUpOrLeave()` - Completes selection and selects items
- `handleCanvasClick()` - Clears selection when clicking empty canvas

---

### `use-canvas-interactions.ts`
**Mouse position tracking and panning**

**Exports:**
- `useCanvasInteractions()` hook

**Features:**
- Tracks mouse position on canvas (throttled for performance)
- Handles right-click panning
- Converts mouse coordinates to diagram space
- Supports touch gestures (pan and pinch-zoom)
- Throttles mouse position updates to prevent performance warnings

**Key Functions:**
- `handleMouseMove()` - Tracks mouse position (throttled with requestAnimationFrame)
- `handleMouseDown()` - Initiates right-click panning
- `handleTouchStart/Move/End()` - Handles touch gestures for mobile

**Performance Optimization:**
- Uses `requestAnimationFrame` to throttle mouse position updates (~60fps)
- Only updates when position actually changes (snapped coordinates)
- Cleans up animation frames on mouse leave

---

### `use-canvas-drag-drop.ts`
**Drag and drop functionality for nodes and zones**

**Exports:**
- `useCanvasDragDrop()` hook

**Features:**
- Integrates with `react-dnd` for drag-and-drop
- Handles dropping items onto canvas
- Manages multi-item dragging
- Detects drop targets (zones/groups)
- Updates item positions on drop

**Key Functions:**
- `drop()` - Configures drop target for canvas
- Manages drag position state for visual feedback
- Handles multi-drag positioning

---

### `use-canvas-clipboard.ts`
**Copy, paste, and clipboard operations**

**Exports:**
- `useCanvasClipboard()` hook

**Features:**
- Copies selected items to clipboard
- Pastes items from clipboard
- Manages clipboard state (for enabling/disabling paste button)
- Generates new IDs for pasted items

**Key Functions:**
- `handleCopy()` - Copies selected item(s) to clipboard
- `handlePaste()` - Pastes clipboard content at current mouse position
- `canPaste()` - Checks if clipboard has content

---

### `use-canvas-export.ts`
**PNG export functionality**

**Exports:**
- `useCanvasExport()` hook

**Features:**
- Exports canvas to PNG using `html-to-image`
- Supports transparent or white background
- Supports selection area export
- Manages export mode state
- Provides export dialog integration

**Key Functions:**
- `exportPng()` - Exports canvas to PNG file
- `startSelectionMode()` - Enters selection mode for area export

---

### `use-canvas-context-menu.ts`
**Right-click context menu state management**

**Exports:**
- `useCanvasContextMenu()` hook

**Features:**
- Manages context menu visibility and position
- Tracks which item triggered the menu (node/zone)
- Handles menu open/close
- Closes menu on outside click (with delay to prevent immediate closure)

**Key Functions:**
- `handleContextMenu()` - Opens context menu at mouse position
- `closeContextMenu()` - Closes the context menu

---

## Utility Modules (`src/components/editor/`)

### `canvas-constants.ts`
**Shared constants and utility functions**

**Exports:**
- Canvas dimension constants (`NODE_WIDTH`, `NODE_HEIGHT`, `ZONE_PADDING`, etc.)
- `PositionedNode` and `PositionedGroup` types
- `snapToGrid()` - Snaps coordinates to grid
- `measureNodeDims()` - Calculates node dimensions based on type and content

**Constants:**
- `NODE_WIDTH = 80`
- `NODE_HEIGHT = 80`
- `ZONE_PADDING = 50`
- `GRID_SNAP = 20`
- `RULER_SIZE = 24`

---

### `canvas-layout-utils.ts`
**Layout calculation algorithms**

**Exports:**
- `calculateLayout()` - Main layout calculation function
- `recalculateGroupSize()` - Recalculates zone size based on children
- `layoutZone()` - Calculates positions for items within a zone
- `setAbsolutePositionsForZone()` - Sets absolute positions for zone children
- `redistributeItemsInCustomZone()` - Redistributes items when zone is resized

**Features:**
- Calculates positions for all nodes and zones
- Handles nested zones (zones within zones)
- Supports different zone orientations (auto, horizontal, vertical, grid/square)
- Handles custom vs auto sizing modes
- Calculates zone sizes based on content

**Key Functions:**
- `calculateLayout()` - Main entry point, processes entire diagram
- `layoutZone()` - Handles zone-specific layout logic
- `recalculateGroupSize()` - Updates zone dimensions based on children

---

### `canvas-operations.ts`
**CRUD operations for diagram items**

**Exports:**
- `useCanvasOperations()` hook

**Features:**
- Adds new nodes to canvas
- Resizes nodes and zones
- Moves items (single and multiple)
- Deletes items (single and multiple)
- Updates zone labels

**Key Functions:**
- `addNode()` - Adds a new node to the diagram
- `resizeNode()` - Resizes a node with minimum size constraints
- `resizeGroup()` - Resizes a zone with minimum size constraints
- `moveItem()` - Moves a single item
- `moveMultipleItems()` - Moves multiple selected items
- `handleDelete()` - Deletes a single item
- `handleDeleteMultiple()` - Deletes multiple items
- `updateGroupLabel()` - Updates zone label

---

## Sub-Components (`src/components/editor/`)

### `canvas-connections.tsx`
**Renders connection lines between nodes/zones**

**Props:**
- `width`, `height` - Canvas dimensions
- `diagramData` - Full diagram data
- `nodesById`, `zonesById` - Lookup maps for items
- `selectedItemId` - Currently selected item
- `onItemSelect` - Callback for selecting items
- `closeContextMenu` - Callback to close context menu

**Features:**
- Renders bezier curves between connected items
- Highlights selected connections
- Handles connection clicks for selection
- Calculates connection paths avoiding overlaps

---

### `canvas-arrow-toggles.tsx`
**Renders arrow toggle buttons on connections**

**Props:**
- `selectedItemId` - Currently selected item
- `diagramData` - Full diagram data
- `nodesById`, `zonesById` - Lookup maps
- `setDiagramData` - State setter

**Features:**
- Shows arrow toggle buttons when connection is selected
- Allows toggling arrow direction (from/to/both)
- Updates connection data when toggled

---

### `canvas-connection-text.tsx`
**Renders and manages connection labels**

**Props:**
- `width`, `height` - Canvas dimensions
- `diagramData` - Full diagram data
- `nodesById`, `zonesById` - Lookup maps
- `processedZones` - Processed zone data

**Features:**
- Renders text labels on connections
- Allows editing connection text
- Positions text along connection path
- Handles text input and updates

---

### `canvas-rotation-overlay.tsx`
**Renders rotation handles and angle HUD for selected items**

**Props:**
- `transform` - Canvas transform (pan/zoom)
- `targetBounds` - Item bounds in diagram space (x, y, width, height)
- `rotation` - Current rotation angle in degrees
- `isDragging` - Whether rotation drag is active
- `dragRotation` - Current rotation during drag (optional)
- `onHandlePointerDown` - Callback when handle is pressed

**Features:**
- Displays four semi-transparent green rotate handles at item corners
- Shows green angle HUD circle with tick marks (every 5°) while dragging
- Calculates rotated corner positions based on current rotation angle
- Converts diagram-space coordinates to screen-space for overlay positioning
- Renders angle indicator line and central angle readout during rotation

**Key Functions:**
- Computes rotated corner positions using trigonometry
- Renders SVG-based angle HUD with tick marks and indicator line
- Positions handles at correct screen coordinates accounting for zoom/pan

---

### `canvas-rulers.tsx`
**Renders horizontal and vertical rulers**

**Props:**
- `transform` - Current canvas transform
- `canvasWidth`, `canvasHeight` - Canvas dimensions
- `rulerSize` - Size of ruler area

**Features:**
- Shows pixel rulers along top and left edges
- Updates based on zoom level
- Displays grid markers

---

## Component Integration Flow

```
editor-canvas.tsx (Main Component)
│
├── Hooks (State & Logic)
│   ├── useCanvasTransform → Pan/Zoom
│   ├── useCanvasSelection → Selection Rectangle
│   ├── useCanvasInteractions → Mouse Tracking & Panning
│   ├── useCanvasDragDrop → Drag & Drop
│   ├── useCanvasClipboard → Copy/Paste
│   ├── useCanvasExport → PNG Export
│   └── useCanvasContextMenu → Right-Click Menu
│
├── Operations Hook
│   └── useCanvasOperations → CRUD Operations
│
├── Layout Calculation
│   └── calculateLayout() → Positions all items
│
└── Sub-Components (Rendering)
    ├── DiagramNode → Individual nodes
    ├── DiagramZone → Zones/groups
    ├── CanvasConnections → Connection lines
    ├── CanvasArrowToggles → Arrow controls
    ├── CanvasConnectionText → Connection labels
    ├── CanvasRotationOverlay → Rotation handles & HUD
    └── ContextMenu → Right-click menu
```

## Data Flow

1. **User Interaction** → Event handlers in `editor-canvas.tsx`
2. **Event Delegation** → Appropriate hook handles the event
3. **State Update** → Hook updates state via `setDiagramData` or callbacks
4. **Layout Recalculation** → `calculateLayout()` recalculates positions
5. **Re-render** → React re-renders with new layout
6. **Visual Update** → Canvas displays updated diagram

## Key Design Patterns

1. **Separation of Concerns**: Each hook/component has a single responsibility
2. **Composition**: Main component composes hooks and sub-components
3. **Imperative API**: Exposes methods via ref forwarding for parent control
4. **Performance Optimization**: Throttling, memoization, and efficient updates
5. **Type Safety**: Strong TypeScript typing throughout

## Performance Considerations

- **Layout Calculation**: Memoized with `useMemo` based on `diagramData`
- **Mouse Position**: Throttled with `requestAnimationFrame` (~60fps)
- **Selection**: Only updates when actually selecting (not on every move)
- **Re-renders**: Minimized through proper dependency arrays and memoization
