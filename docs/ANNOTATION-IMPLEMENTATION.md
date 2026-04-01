        # Annotation Tool Implementation Guide

## Overview

This guide provides step-by-step instructions for fully integrating the hand drawing annotation tool into DiagramWeaver.

## Implementation Steps

### Step 1: Import annotation components in diagram-editor.tsx

```typescript
// Add to imports in src/components/diagram-editor.tsx
import { useAnnotations } from '@/hooks/use-annotations';
import { AnnotationCanvas } from './editor/annotation-canvas';
import { AnnotationToolbar } from './editor/annotation-toolbar';
import { type DiagramAnnotations } from '@/lib/annotation-types';
import { compositeAnnotationsOntoImage } from '@/lib/annotation-export';
```

### Step 2: Add annotation state to diagram-editor

```typescript
// In the diagram-editor component:
const [annotationCanvasRef, setAnnotationCanvasRef] = useState<HTMLCanvasElement | null>(null);
const [isAnnotationDrawing, setIsAnnotationDrawing] = useState(false);
const annotations = useAnnotations({
  initialAnnotations: currentDiagramData?.annotations,
  onAnnotationsChange: (updated) => {
    setCurrentDiagramData((prev) => ({
      ...prev,
      annotations: updated,
    }));
  },
});
```

### Step 3: Add annotation canvas overlay to editor layout

In the JSX where EditorCanvas is rendered (around line 5360), wrap it like this:

```typescript
<div className={`flex-1 h-full min-w-0 relative`} ref={canvasContainerRef}>
  <EditorCanvas
    // ... existing props ...
  />
  
  {/* Annotation overlay */}
  {!presentationModeEnabled && (
    <AnnotationCanvas
      enabled={annotations.toolConfig.enabled}
      width={editorCanvasWidth}
      height={editorCanvasHeight}
      canvasRef={annotationCanvasRef}
      toolConfig={annotations.toolConfig}
      isDrawing={isAnnotationDrawing}
      onDrawingChange={setIsAnnotationDrawing}
      onStrokeComplete={(stroke) => {
        annotations.addStroke(stroke);
      }}
    />
  )}
  
  {/* Annotation toolbar */}
  {!presentationModeEnabled && (
    <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 40 }}>
      <AnnotationToolbar
        toolConfig={annotations.toolConfig}
        onToolChange={(config) => {
          if (config.style) annotations.setStyle(config.style);
          if (config.color) annotations.setColor(config.color);
          if (config.width) annotations.setWidth(config.width);
          if (config.opacity !== undefined) annotations.setOpacity(config.opacity);
        }}
        onToggleTool={() => annotations.toggleTool()}
        onClearAll={() => {
          if (confirm('Clear all annotations?')) {
            annotations.clearAll();
          }
        }}
        onUndo={() => annotations.undo()}
        hasStrokes={annotations.annotations.strokes.length > 0}
        isDrawing={isAnnotationDrawing}
      />
    </div>
  )}
</div>
```

### Step 4: Integrate with presentation mode

Add annotation support to the presentation player output. In the PresentationPlayer component when rendering slides:

```typescript
import { PresentationAnnotations } from './presentation-annotations';

// Wrap the main slide content:
{currentSlide ? (
  <PresentationAnnotations
    slide={currentSlide}
    canvasWidth={window.innerWidth}
    canvasHeight={window.innerHeight}
    toolbarPosition="bottom"
    onSlideAnnotationsUpdate={(annotations) => {
      // Update slide in the deck
      updateSlideAnnotations(currentSlide.id, annotations);
    }}
  />
) : null}
```

### Step 5: Update export functions

Modify the export functions in the EditorCanvas to include annotations:

```typescript
// In use-canvas-export.ts or similar:
const exportPngWithAnnotations = useCallback(async (options?: { 
  backgroundColor?: 'transparent' | 'white' | 'dark';
  quality?: 'low' | 'medium' | 'high';
}) => {
  // First export the diagram normally
  const diagramDataUrl = await captureViewportPngDataUrl({
    ...options,
    fitContent: true,
    fitPadding: 50,
    tightContentFrame: true,
  });

  // Then composite annotations if present
  if (diagramData.annotations?.enabled && diagramData.annotations.strokes.length > 0) {
    const withAnnotations = await compositeAnnotationsOntoImage({
      diagramDataUrl,
      annotations: diagramData.annotations,
      width: canvasWidth,
      height: canvasHeight,
    });
    return withAnnotations;
  }

  return diagramDataUrl;
}, [diagramData, canvasWidth, canvasHeight]);
```

### Step 6: Add keyboard shortcuts

In the diagram-editor keyboard handler, add:

```typescript
// Toggle annotation tool: Ctrl+Alt+D
if (event.ctrlKey && event.altKey && event.key === 'd') {
  event.preventDefault();
  annotations.toggleTool();
  return;
}

// Clear annotations: Ctrl+Alt+X
if (event.ctrlKey && event.altKey && event.key === 'x') {
  event.preventDefault();
  if (window.confirm('Clear all annotations?')) {
    annotations.clearAll();
  }
  return;
}
```

### Step 7: Update TopMenuBar with annotation menu items

Add annotation controls to the TopMenuBar component:

```typescript
// In top-menu-bar.tsx, add props:
interface TopMenuBarProps {
  // ... existing props ...
  onToggleAnnotationTool?: () => void;
  annotationToolEnabled?: boolean;
  onClearAnnotations?: () => void;
  hasAnnotations?: boolean;
}

// In the Options menu:
{onToggleAnnotationTool && (
  <>
    {/* ... existing menu items ... */}
    <MenubarSeparator />
    <MenubarItem onClick={onToggleAnnotationTool}>
      <Pen className="mr-2 h-4 w-4" />
      {annotationToolEnabled ? 'Disable Drawing' : 'Enable Drawing'}
      <MenubarShortcut>Ctrl+Alt+D</MenubarShortcut>
    </MenubarItem>
    {hasAnnotations && (
      <MenubarItem onClick={onClearAnnotations}>
        <Trash2 className="mr-2 h-4 w-4" />
        Clear Annotations
        <MenubarShortcut>Ctrl+Alt+X</MenubarShortcut>
      </MenubarItem>
    )}
  </>
)}
```

### Step 8: Pass props from diagram-editor to TopMenuBar

```typescript
// In diagram-editor.tsx:
<TopMenuBar
  // ... existing props ...
  onToggleAnnotationTool={() => annotations.toggleTool()}
  annotationToolEnabled={annotations.toolConfig.enabled}
  onClearAnnotations={() => {
    if (window.confirm('Clear all annotations?')) {
      annotations.clearAll();
    }
  }}
  hasAnnotations={currentAnnotations.strokes.length > 0}
/>
```

### Step 9: Test the integration

1. **Create a new diagram**
2. **Enable drawing tool**: Click the pen icon or press Ctrl+Alt+D
3. **Draw annotations**: Click and drag on the canvas
4. **Test controls**:
   - Change color using the color picker
   - Adjust width and opacity with sliders
   - Switch between pen/marker/highlighter styles
   - Undo with Ctrl+Z or the Undo button
   - Clear all with Ctrl+Alt+X or the Clear button
5. **Export PNG/GIF**: Annotations should be included in the exported images
6. **Save and reload**: Verify annotations persist when saving/loading diagrams

### Step 10: Add to presentation mode

1. **Create presentation slides** with diagrams that have annotations
2. **Enter presentation mode**
3. **Enable drawing** in presentation player
4. **Draw on slides**: Annotations should persist with the slide
5. **Export slides**: Annotations should be included

## Integration Checklist

- [ ] Import annotation components
- [ ] Add annotation state hooks
- [ ] Add annotation canvas overlay
- [ ] Add annotation toolbar UI
- [ ] Integrate with presentation mode
- [ ] Update PNG export function
- [ ] Update GIF export function
- [ ] Add keyboard shortcuts
- [ ] Update TopMenuBar with annotation menu
- [ ] Test all features end-to-end
- [ ] Verify JSON serialization works
- [ ] Test import/export of diagrams with annotations
- [ ] Test presentation mode annotations
- [ ] Verify performance with large annotation sets

## Configuration

### Annotation Tool Defaults

Customize default settings in `useAnnotations` hook:

```typescript
const defaultConfig: AnnotationToolConfig = {
  enabled: false,
  color: '#000000',        // black
  width: 3,                // 3px
  opacity: 1,              // fully opaque
  style: 'pen',            // pen style
};
```

### Style Presets

Pre-configured styles in `annotation-toolbar.tsx`:

```typescript
const STYLE_PRESETS = {
  pen:         { width: 2, opacity: 1 },
  marker:      { width: 5, opacity: 0.8 },
  highlighter: { width: 8, opacity: 0.3 },
};
```

### Export Options

When exporting with annotations:

```typescript
compositeAnnotationsOntoImage({
  diagramDataUrl: '...',
  annotations: diagramData.annotations,
  width: 1200,
  height: 800,
})
```

## Troubleshooting

### Annotations not appearing on export

- Verify `diagramData.annotations.enabled` is true
- Check that strokes array is not empty
- Ensure canvas size matches actual diagram size
- Check browser console for errors in `compositeAnnotationsOntoImage`

### Drawing tool feels laggy

- Reduce the number of strokes (> 100 can impact performance)
- Simplify strokes using `simplifyStroke()` before saving
- Check device GPU capabilities
- Verify `requestAnimationFrame` is being called

### Annotations disappear on undo

- Make sure undo/redo system includes annotation changes
- Verify `onAnnotationsChange` callback is being called
- Check that diagram data is being persisted correctly

### Presentation slide annotations not saving

- Verify `onSlideAnnotationsUpdate` callback is implemented
- Check that slide state is being updated in the presentation deck
- Ensure presentation data is persisted to IndexedDB/localStorage

## Performance Optimization

### Reduce file size

```typescript
// Simplify strokes before saving
const optimized = annotations.strokes.map(stroke => 
  simplifyStroke(stroke, 2) // 2px tolerance
);
```

### Compress colors

```typescript
// Use compression when saving
const compressed = stroke.color === '#000000' ? '0' : stroke.color;
```

### Lazy render large annotation sets

```typescript
// Only render strokes in visible viewport
const visibleStrokes = annotations.strokes.filter(
  stroke => isStrokeInViewport(stroke, viewport)
);
```

## Future Enhancements

- [ ] Shape tools (rectangle, circle, line)
- [ ] Text annotations
- [ ] Annotation layers
- [ ] Undo/redo with branches
- [ ] Annotation timeline
- [ ] Collaborative annotations
- [ ] Custom brush styles
- [ ] Pressure-sensitive pen support
- [ ] Handwriting recognition
- [ ] Annotation templates
