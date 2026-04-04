# DiagramWeaver Component Library

**Version:** 1.0.0
**Last Updated:** 2026-04-04
**Purpose:** Documentation of reusable components, hooks, and patterns used throughout DiagramWeaver

This document provides an overview of the component library, including UI components, custom hooks, diagram components, and common patterns used in the DiagramWeaver codebase.

---

## Table of Contents

1. [UI Components](#ui-components)
2. [Custom Hooks](#custom-hooks)
3. [Diagram Components](#diagram-components)
4. [Common Patterns](#common-patterns)
5. [Performance Patterns](#performance-patterns)
6. [Accessibility Patterns](#accessibility-patterns)

---

## UI Components

DiagramWeaver uses a combination of Radix UI primitives, shadcn/ui components, and custom UI components.

### Standardized UI Components

#### StandardPopover
**Location:** `src/components/ui/standard-popover.tsx`

A pre-configured Popover component with consistent defaults for the application.

**Props:**
```typescript
interface StandardPopoverProps extends PopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}
```

**Default Behavior:**
- Trigger: Click-only (not hover)
- Position: Bottom-start by default
- Animation: Consistent fade/zoom/slide transitions
- Close on click outside: Yes

**Usage Example:**
```tsx
<StandardPopover
  content={
    <PopoverContent className="w-80">
      <PopoverContentTitle>Title</PopoverContentTitle>
      <p>Content goes here</p>
    </PopoverContent>
  }
>
  <Button variant="ghost">Trigger</Button>
</StandardPopover>
```

**When to Use:**
- Tooltips or additional information
- Context menus
- Any popover-like interaction

---

#### StandardDropdownMenu
**Location:** `src/components/ui/standard-dropdown-menu.tsx`

A pre-configured DropdownMenu component with consistent defaults.

**Props:**
```typescript
interface StandardDropdownMenuProps extends DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}
```

**Default Behavior:**
- Trigger: Click-only (not hover)
- Position: End-aligned (standard for dropdown menus)
- Animation: Consistent fade/zoom/slide transitions
- Close on click outside: Yes

**Usage Example:**
```tsx
<StandardDropdownMenu
  trigger={<Button variant="ghost" aria-label="Menu">☰</Button>}
>
  <DropdownMenuItem onClick={handleAction}>Action 1</DropdownMenuItem>
  <DropdownMenuItem onClick={handleAction}>Action 2</DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={handleAction}>Action 3</DropdownMenuItem>
</StandardDropdownMenu>
```

**When to Use:**
- Action menus
- Settings menus
- Any dropdown-style menu

---

#### ColorPicker
**Location:** `src/components/ui/color-picker.tsx`

A color picker component with hex input and preset color swatches.

**Props:**
```typescript
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  label?: string;
}
```

**Features:**
- Hex color input with validation
- Preset color swatches
- Live preview
- Keyboard accessible

**Usage Example:**
```tsx
<ColorPicker
  value={node.color}
  onChange={(color) => updateNodeColor(node.id, color)}
  presets={['#000000', '#ffffff', '#ef4444', '#3b82f6']}
  label="Node Color"
/>
```

---

#### ContextMenu
**Location:** `src/components/ui/context-menu.tsx`

A context menu component that opens on right-click.

**Props:**
```typescript
interface ContextMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}
```

**Usage Example:**
```tsx
<ContextMenu trigger={<div>Right-click me</div>}>
  <ContextMenuItem onClick={handleCopy}>Copy</ContextMenuItem>
  <ContextMenuItem onClick={handlePaste}>Paste</ContextMenuItem>
  <ContextMenuSeparator />
  <ContextMenuItem onClick={handleDelete}>Delete</ContextMenuItem>
</ContextMenu>
```

---

## Custom Hooks

DiagramWeaver uses custom hooks to encapsulate reusable logic and state management.

### Canvas Hooks

#### useCanvasTransform
**Location:** `src/hooks/use-canvas-transform.ts`

Manages canvas pan, zoom, and fit-to-view functionality.

**Returns:**
```typescript
{
  transform: { x: number; y: number; k: number };
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
  fitToView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}
```

**Usage Example:**
```tsx
const { transform, setTransform, fitToView } = useCanvasTransform({
  width: canvasWidth,
  height: canvasHeight,
  nodes: diagramData.nodes,
  connections: diagramData.connections,
});
```

---

#### useCanvasSelection
**Location:** `src/hooks/use-canvas-selection.ts`

Manages node and connection selection state.

**Returns:**
```typescript
{
  selectedIds: string[];
  selectedItemId: string | null;
  isMultiSelect: boolean;
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
}
```

**Usage Example:**
```tsx
const { selectedIds, toggleSelection, clearSelection } = useCanvasSelection({
  diagramData,
  isReadOnly,
});
```

---

#### useCanvasDragDrop
**Location:** `src/hooks/use-canvas-drag-drop.ts`

Manages drag-and-drop interactions for nodes and resources.

**Returns:**
```typescript
{
  isDragging: boolean;
  draggedItem: any;
  onDragStart: (e: DragEvent, item: any) => void;
  onDragEnd: () => void;
  onDrop: (e: DragEvent) => void;
}
```

**Usage Example:**
```tsx
const { isDragging, onDragStart, onDragEnd } = useCanvasDragDrop({
  diagramData,
  setDiagramData,
  onMoveNode: handleMoveNode,
});
```

---

### Data Management Hooks

#### useDiagramTabs
**Location:** `src/hooks/use-diagram-tabs.ts`

Manages multiple diagram tabs with localStorage persistence.

**Returns:**
```typescript
{
  tabs: DiagramTab[];
  activeTabId: string | null;
  addTab: (diagram: DiagramData) => string;
  updateTab: (id: string, diagram: DiagramData) => void;
  removeTab: (id: string) => void;
  switchTab: (id: string) => void;
  activeDiagram: DiagramData | null;
}
```

**Usage Example:**
```tsx
const { tabs, activeTabId, activeDiagram, addTab, switchTab } = useDiagramTabs({
  isClient,
  onToast: showToast,
});
```

---

#### useLayers
**Location:** `src/hooks/use-layers.ts`

Manages diagram layers for organization and visibility control.

**Returns:**
```typescript
{
  layers: Layer[];
  activeLayerId: string | null;
  addLayer: (name: string) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  setActiveLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
}
```

**Usage Example:**
```tsx
const { layers, activeLayerId, addLayer, toggleLayerVisibility } = useLayers({
  diagramData,
  setDiagramData,
  toast: showToast,
});
```

---

### Utility Hooks

#### useCanvasExport
**Location:** `src/hooks/use-canvas-export.ts`

Handles exporting canvas to PNG and GIF formats.

**Returns:**
```typescript
{
  exportToPNG: () => Promise<Blob>;
  exportToGIF: (options: GIFExportOptions) => Promise<Blob>;
  isExporting: boolean;
}
```

**Usage Example:**
```tsx
const { exportToPNG, exportToGIF, isExporting } = useCanvasExport({
  canvasRef,
  diagramData,
  connectionsBehindNodes,
});
```

---

#### useAlignmentGuides
**Location:** `src/hooks/use-alignment-guides.ts`

Calculates and displays alignment guides when dragging nodes.

**Returns:**
```typescript
{
  guides: AlignmentGuide[];
  showGuides: boolean;
}
```

**Usage Example:**
```tsx
const { guides } = useAlignmentGuides({
  nodes: diagramData.nodes,
  draggedNodeIds,
  gridSize: 10,
});
```

---

#### useSineWaveAnimation
**Location:** `src/hooks/use-sine-wave-animation.ts`

Provides sine wave animation values for smooth transitions.

**Props:**
```typescript
interface SineWaveAnimationOptions {
  duration?: number;
  amplitude?: number;
  frequency?: number;
  offset?: number;
}
```

**Returns:**
```typescript
{
  value: number; // Current sine wave value (-1 to 1)
  progress: number; // Progress through one cycle (0 to 1)
}
```

**Usage Example:**
```tsx
const { value } = useSineWaveAnimation({
  duration: 2000,
  amplitude: 1,
  frequency: 1,
});

const scale = 1 + value * 0.1; // Subtle scale animation
```

---

## Diagram Components

Core components used for rendering diagram elements.

### Node Components

#### DiagramNode
**Location:** `src/components/diagram/diagram-node.tsx`

Main component for rendering all types of diagram nodes.

**Key Features:**
- Memoized with custom comparison for performance
- Handles selection, dragging, and interactions
- Renders different shapes based on node type
- Supports custom icons and text

**Props:**
```typescript
interface DiagramNodeProps {
  node: DiagramNodeData;
  isSelected: boolean;
  isHighlighted: boolean;
  isMultiSelected: boolean;
  isGroupMember: boolean;
  hoverEnabled: boolean;
  isReadOnly: boolean;
  pointerEventsPassThrough?: boolean;
  animationStyle?: AnimationStyle;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onDoubleClick: (id: string) => void;
  // ... more props
}
```

---

#### ResourceIcon
**Location:** `src/components/diagram/resource-icon.tsx`

Displays cloud provider and custom resource icons with caching and lazy loading.

**Props:**
```typescript
interface ResourceIconProps {
  type?: string;
  imagePath?: string;
  provider?: string;
  category?: string;
  file?: string;
  iconType?: string;
  iconName?: string;
  emoji?: string;
  iconColor?: string;
  imageUrl?: string;
  imageOptions?: any;
  width?: number;
  height?: number;
}
```

**Features:**
- Image caching (1-hour cache, max 100 images)
- Lazy loading with `loading="lazy"`
- Loading spinner while fetching
- Fallback icon support

---

### Connection Components

#### BezierConnection
**Location:** `src/components/diagram/bezier-connection.tsx`

Renders curved bezier connections with optional animations.

**Key Features:**
- Memoized with custom comparison
- Supports animated shapes (dot, square, arrow, triangle, hexagon)
- Customizable curvature, color, thickness
- Waypoint support for routing around obstacles

**Props:**
```typescript
interface BezierConnectionProps {
  connection: DiagramConnectionData;
  from: DiagramNodeData;
  to: DiagramNodeData;
  fromWidth: number;
  fromHeight: number;
  toWidth: number;
  toHeight: number;
  isSelected: boolean;
  isHighlighted: boolean;
  animationConnectionsEnabled: boolean;
  // ... more props
}
```

---

#### OrthogonalConnection
**Location:** `src/components/diagram/othogonal-connection.tsx`

Renders orthogonal (90° axis-aligned) connections.

**Key Features:**
- Memoized with custom comparison
- Automatic routing with optimal edge detection
- Supports all the same features as BezierConnection

---

### Shape Components

All shape components follow a consistent interface and are located in `src/components/diagram/shapes/`.

**Base Shape Props:**
```typescript
interface BaseShapeProps {
  node: DiagramNodeData;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
}
```

**Available Shapes:**
- `RectangleShape` - Basic rectangle
- `RoundedRectangleShape` - Rectangle with rounded corners
- `CircleShape` - Circle/ellipse
- `SquareShape` - Square
- `TriangleShape` - Triangle
- `StarShape` - Star
- `CloudShape` - Cloud
- `HexagonShape` - Hexagon
- `PentagonShape` - Pentagon
- `OctagonShape` - Octagon
- `TrapezoidShape` - Trapezoid
- `ParallelogramShape` - Parallelogram
- `ChevronShape` - Chevron
- `ArrowheadShape` - Arrow
- `PointShape` - Small point/marker
- `KiteShape` - Kite shape
- `JigsawShape` - Jigsaw puzzle piece
- `LoopShape` - Loop for sequence diagrams
- `UmlClassShape` - UML class diagram representation
- `TextBoxHeadingShape` - Text box with heading
- `LineShape` - Independent line with drag endpoints

**Usage Example:**
```tsx
<RectangleShape
  node={node}
  fill={node.color}
  stroke={node.borderColor}
  strokeWidth={node.borderWidth}
  onClick={() => onSelectNode(node.id)}
/>
```

---

## Common Patterns

### 1. Memoization Pattern

Components that render frequently should be memoized with custom comparison functions:

```tsx
const Component = React.memo(function ComponentInner({ prop1, prop2 }) {
  // Component logic
}, arePropsEqual);

function arePropsEqual(prev: Props, next: Props): boolean {
  // Compare only relevant props
  return prev.prop1 === next.prop1 && prev.prop2 === next.prop2;
}
```

**Examples in Codebase:**
- `DiagramNode` - `areDiagramNodePropsEqual`
- `BezierConnection` - `areBezierConnectionPropsEqual`
- `OrthogonalConnection` - `areOrthogonalPropsEqual`
- `ConnectionWaypointHandles` - Custom comparison

---

### 2. Handler Optimization Pattern

Wrap event handlers in `useCallback` to prevent child component re-renders:

```tsx
const handleClick = useCallback((id: string) => {
  setSelectedId(id);
  // ... other logic
}, [dependency1, dependency2]);
```

**Best Practices:**
- All event handlers should use `useCallback`
- Only include actual dependencies in the dependency array
- Use `useRef` for values that change but shouldn't trigger re-renders

---

### 3. State Management Pattern

Use custom hooks for complex state logic instead of `useState` in components:

```tsx
// Good: Custom hook
const { transform, setTransform, fitToView } = useCanvasTransform({...});

// Avoid: Complex useState in component
const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
```

---

### 4. Panel Pattern

Panels follow a consistent structure:

```tsx
<Panel className="w-80">
  <PanelHeader>
    <PanelTitle>Panel Title</PanelTitle>
    <PanelActions>
      <Button variant="ghost" size="icon">✕</Button>
    </PanelActions>
  </PanelHeader>
  <ScrollArea className="h-96">
    {/* Panel content */}
  </ScrollArea>
</Panel>
```

**Common Panel Props:**
- `isOpen` - Controls visibility
- `onClose` - Callback when closing
- `className` - Additional styling

---

### 5. Dialog Pattern

Use Radix UI Dialog components with focus management:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={onConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Accessibility Features:**
- Auto-focus first focusable element on open
- Trap tab navigation within dialog
- Restore focus on close
- Escape key to close

---

## Performance Patterns

### 1. Code Splitting

Large panels are lazy-loaded to reduce initial bundle size:

```tsx
const PropertiesPanel = dynamic(
  () => import('@/components/editor/properties-panel'),
  { 
    loading: () => <PanelLoading />,
    ssr: false 
  }
);
```

**Lazy-Loaded Panels:**
- PropertiesPanel (624 lines)
- LayersPanel (467 lines)
- JsonEditorPanel (436 lines)
- PresentationEditorPanel (622 lines)

---

### 2. Image Optimization

Custom icons use caching and lazy loading:

```tsx
// In custom-icon-utils.ts
const imageCache = new Map<string, { timestamp: number; image: HTMLImageElement }>();

export async function getCachedImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
    return cached.image;
  }
  // Load and cache image
}
```

**Features:**
- 1-hour cache duration
- Max 100 cached images
- Automatic expiration
- Lazy loading with `loading="lazy"`

---

### 3. Computation Memoization

Expensive calculations use `useMemo`:

```tsx
const processedNodes = useMemo(() => {
  return nodes.map(node => ({
    ...node,
    processed: true
  }));
}, [nodes]);
```

**When to Use:**
- Expensive transformations
- Filtering large arrays
- Complex calculations
- Dependency arrays should be minimal

---

## Accessibility Patterns

### 1. ARIA Labels

All icon-only buttons must have `aria-label`:

```tsx
<Button 
  variant="ghost" 
  size="icon"
  aria-label="Close panel"
  onClick={onClose}
>
  <X className="h-4 w-4" />
</Button>
```

---

### 2. Focus Management

Custom modals implement focus trapping:

```tsx
const previousActiveElementRef = useRef<HTMLElement | null>(null);

useEffect(() => {
  if (isOpen) {
    previousActiveElementRef.current = document.activeElement as HTMLElement;
    firstFocusableRef.current?.focus();
  } else {
    previousActiveElementRef.current?.focus();
  }
}, [isOpen]);

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Tab') {
    // Trap tab navigation
  }
};
```

---

### 3. Keyboard Shortcuts

Standard shortcuts are implemented:

| Shortcut | Action |
|----------|--------|
| Ctrl+C | Copy selection |
| Ctrl+V | Paste |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+0 | Fit to View |
| Ctrl+Shift+J | Toggle JSON panel |
| Delete/Backspace | Delete selected |
| Escape | Clear selection / close dialogs |

**Implementation:**
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      handleCopy();
    }
    // ... other shortcuts
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [handleCopy, ...]);
```

---

### 4. Semantic HTML

Use semantic elements for accessibility:

```tsx
<nav aria-label="Main menu">
  <ul>
    <li><button aria-label="New diagram">New</button></li>
    <li><button aria-label="Open diagram">Open</button></li>
  </ul>
</nav>

<main aria-label="Diagram canvas">
  {/* Canvas content */}
</main>

<aside aria-label="Properties panel">
  {/* Panel content */}
</aside>
```

---

## Component Library Guidelines

### When to Create a New Component

Create a reusable component when:
1. The same UI pattern appears 3+ times
2. The component has complex logic that shouldn't be duplicated
3. The component needs to maintain internal state
4. The component has a well-defined API

### Component Naming

- Use PascalCase for component names: `MyComponent`
- Use descriptive names: `ColorPicker` (not `CP` or `Picker`)
- Group related components: `Button`, `ButtonGroup`, `ButtonIcon`

### Props Interface

Always define explicit prop interfaces:

```tsx
interface MyComponentProps {
  // Required props first
  value: string;
  onChange: (value: string) => void;
  
  // Optional props with defaults
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
}
```

### Component Documentation

Document components with JSDoc comments:

```tsx
/**
 * A customizable color picker with hex input and preset swatches.
 * 
 * @example
 * ```tsx
 * <ColorPicker
 *   value="#ff0000"
 *   onChange={setColor}
 *   presets={['#ff0000', '#00ff00', '#0000ff']}
 * />
 * ```
 */
export function ColorPicker({ value, onChange, presets }: ColorPickerProps) {
  // ...
}
```

---

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [docs/PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md) - Performance optimization details
- [PERFORMANCE_BENCHMARK_REPORT.md](../PERFORMANCE_BENCHMARK_REPORT.md) - Performance metrics
- [ACCESSIBILITY_AUDIT_REPORT.md](../ACCESSIBILITY_AUDIT_REPORT.md) - Accessibility compliance
- [AGENTS.md](../AGENTS.md) - Code style and build commands

---

**Document Status:** ✅ Complete
**Maintainer:** DiagramWeaver Team
**Last Review:** 2026-04-04
