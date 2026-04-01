# Hand Drawing Annotation Tool

## Overview

The Hand Drawing Annotation Tool enables users to add freehand drawings and annotations to diagrams in both **Editor Mode** and **Presentation Mode**. All annotations are:

- **Stored as JSON** in the diagram data structure
- **Exportable with PNG/GIF** when saving diagrams
- **Transparent and composable** on top of existing diagrams
- **Pressure-sensitive** (when used with supported devices)

## Architecture

### Components

1. **AnnotationCanvas** (`src/components/editor/annotation-canvas.tsx`)
   - Renders an overlay canvas for real-time drawing
   - Captures mouse/touch events for pen input
   - Manages current stroke being drawn

2. **AnnotationRenderer** (`src/components/editor/annotation-renderer.tsx`)
   - Renders stored annotations to a canvas
   - Used for display and export operations
   - Can render per-stroke or all-at-once

3. **AnnotationToolbar** (`src/components/editor/annotation-toolbar.tsx`)
   - UI controls for the drawing tool
   - Color picker, width/opacity sliders
   - Style selector (pen, marker, highlighter)
   - Undo/clear buttons

  4. **useAnnotations Hook** (`src/hooks/use-annotations.ts`)
   - Manages annotation state and operations
   - Provides serialization/deserialization
   - Handles stroke management (add, remove, undo, clear)

### Data Structure

Annotations are stored in the `DiagramData` interface:

```typescript
interface DiagramData {
  // ... existing diagram fields ...
  
  // Hand-drawn annotations (strokes) for this diagram
  annotations?: DiagramAnnotations;
}

interface DiagramAnnotations {
  enabled: boolean;
  strokes: AnnotationStroke[];
  createdAt: number;
  updatedAt: number;
}

interface AnnotationStroke {
  id: string;
  points: StrokePoint[];
  color: string; // Hex color (e.g., '#FF0000')
  width: number; // 1-20 pixels
  opacity: number; // 0-1
  timestamp: number;
  style?: 'pen' | 'marker' | 'highlighter';
}
```

For slides in presentation mode:

```typescript
interface Slide {
  // ... existing slide fields ...
  
  // Hand-drawn annotations for this slide
  annotations?: SlideAnnotations;
}

interface SlideAnnotations {
  enabled: boolean;
  strokes: AnnotationStroke[];
  createdAt: number;
  updatedAt: number;
}
```

## Usage

### In Editor Mode

1. **Enable Drawing Tool**
   - Click the pen icon in the annotation toolbar
   - Tool becomes active when enabled

2. **Drawing**
   - **Left-click and drag** to draw strokes
   - **Real-time preview** as you draw
   - **Style customization**: color, width, opacity, style (pen/marker/highlighter)

3. **Editing Strokes**
   - **Undo**: Remove last stroke (Undo button or Ctrl+Z)
   - **Clear All**: Remove all annotations
   - **Select & Delete**: Click individual strokes to delete them

4. **Exporting**
   - **PNG Export**: Annotations are composited onto the diagram
   - **GIF Export**: All frame annotations are included in the animation

### In Presentation Mode

1. **Annotations per Slide**
   - Each slide can have its own annotations
   - Stored separately from the diagram annotations

2. **Drawing During Playback**
   - Enable annotation tool to draw on current slide
   - Annotations persist with the slide

3. **Export**
   - Slide annotations are included in exported snapshots

## Implementation Details

### Stroke Simplification

Strokes are automatically simplified using the **Ramer-Douglas-Peucker algorithm** to reduce file size:

```typescript
simplifyStroke(stroke, tolerance: number = 2)
```

This removes redundant points while maintaining stroke shape.

### Color Compression

Common colors are compressed for smaller JSON:

```
'#000000' -> '0'    (black)
'#ffffff' -> 'w'    (white)
'#ff0000' -> 'r'    (red)
'#00ff00' -> 'g'    (green)
// ... etc
```

### Canvas Export Integration

When exporting to PNG/GIF, the annotation canvas is:

1. Rendered to a separate canvas element
2. Composited on top of the diagram canvas
3. Included in the final bitmap/animation

## API Reference

### AnnotationCanvas Props

```typescript
interface AnnotationCanvasProps {
  enabled: boolean;                          // Draw mode active
  width: number;                             // Canvas width
  height: number;                            // Canvas height
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  onStrokeComplete?: (stroke: AnnotationStroke) => void;
  onStrokeCancelled?: () => void;
  toolConfig: AnnotationToolConfig;          // Current tool settings
  isDrawing?: boolean;                       // Currently drawing
  onDrawingChange?: (isDrawing: boolean) => void;
}
```

### useAnnotations Hook

```typescript
const {
  // State
  annotations: DiagramAnnotations;
  toolConfig: AnnotationToolConfig;
  
  // Stroke operations
  addStroke: (stroke: AnnotationStroke) => void;
  removeStroke: (strokeId: string) => void;
  clearAll: () => void;
  undo: () => void;
  
  // Tool configuration
  toggleTool: () => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setOpacity: (opacity: number) => void;
  setStyle: (style: 'pen' | 'marker' | 'highlighter') => void;
  
  // Import/export
  exportJson: () => string;
  importJson: (json: string) => void;
  
  // Utilities
  getBounds: () => { minX, minY, maxX, maxY } | null;
} = useAnnotations(options);
```

### Utility Functions

```typescript
// Serialize/deserialize
serializeAnnotations(annotations) => string;
deserializeAnnotations(json) => DiagramAnnotations;

// Operations
createEmptyAnnotations() => DiagramAnnotations;
addStroke(annotations, stroke) => DiagramAnnotations;
removeStroke(annotations, strokeId) => DiagramAnnotations;
clearStrokes(annotations) => DiagramAnnotations;
undoLastStroke(annotations) => DiagramAnnotations;

// Utilities
getAnnotationsBounds(annotations) => BoundingBox | null;
simplifyStroke(stroke, tolerance?) => AnnotationStroke;
```

## Export Process

### PNG Export

1. Create temporary canvas for annotations
2. Render all strokes to annotation canvas
3. Composite annotation canvas on top of diagram
4. Export as PNG

### GIF Export

1. For each frame:
   - Render current diagram state
   - Overlay current slide annotations (if in presentation mode)
   - Include in GIF frame

## Integration Checklist

- [ ] Add annotation canvas overlay to editor
- [ ] Integrate useAnnotations hook into diagram-editor
- [ ] Add annotation toolbar to editor layout
- [ ] Save/load annotations in diagram JSON
- [ ] Support annotations in presentation mode
- [ ] Composite annotations in PNG/GIF export
- [ ] Add keyboard shortcuts (Ctrl+Z for undo)
- [ ] Sync annotations with undo/redo system

## Future Enhancements

- [ ] Annotation tools: shapes, text, arrows
- [ ] Annotation layers (separate/group annotations)
- [ ] Annotation persistence in viewer
- [ ] Shape recognition (convert drawings to shapes)
- [ ] Collaborative annotations
- [ ] Annotation timeline
- [ ] Custom brush styles

## Files

- `/src/lib/annotation-types.ts` - Type definitions and utilities
- `/src/components/editor/annotation-canvas.tsx` - Drawing canvas component
- `/src/components/editor/annotation-renderer.tsx` - Display component
- `/src/components/editor/annotation-toolbar.tsx` - Control toolbar
- `/src/hooks/use-annotations.ts` - State management hook
