/**
 * Annotation System Test & Integration Examples
 * 
 * This file demonstrates how to integrate and test the hand drawing annotation system
 * in the DiagramWeaver application.
 */

// ============================================================================
// 1. BASIC ANNOTATION USAGE IN COMPONENTS
// ============================================================================

/*
// Example: Using annotations in a diagram editor component
import { useAnnotations } from '@/hooks/use-annotations';
import { AnnotationCanvas } from '@/components/editor/annotation-canvas';
import { AnnotationToolbar } from '@/components/editor/annotation-toolbar';
import { type DiagramData } from '@/lib/types';

function MyDiagramEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotations = useAnnotations({
    initialAnnotations: diagramData?.annotations,
    onAnnotationsChange: (updated) => {
      // Update diagram with new annotations
      setDiagramData((prev) => ({
        ...prev,
        annotations: updated,
      }));
    },
  });
  const [isDrawing, setIsDrawing] = useState(false);

  return (
    <div style={{ position: 'relative', width: 1200, height: 800 }}>
      {/* Main diagram canvas */}
      <div className="absolute inset-0">
        <MyCanvas />
      </div>

      {/* Annotation overlay */}
      <AnnotationCanvas
        enabled={annotations.toolConfig.enabled}
        width={1200}
        height={800}
        canvasRef={canvasRef}
        toolConfig={annotations.toolConfig}
        isDrawing={isDrawing}
        onDrawingChange={setIsDrawing}
        onStrokeComplete={annotations.addStroke}
      />

      {/* Annotation toolbar */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 40 }}>
        <AnnotationToolbar
          toolConfig={annotations.toolConfig}
          onToolChange={(config) => {
            // Handle tool configuration changes
          }}
          onToggleTool={annotations.toggleTool}
          onClearAll={annotations.clearAll}
          onUndo={annotations.undo}
          hasStrokes={annotations.annotations.strokes.length > 0}
          isDrawing={isDrawing}
        />
      </div>
    </div>
  );
}
*/

// ============================================================================
// 2. EXPORT WITH ANNOTATIONS
// ============================================================================

/*
import { compositeAnnotationsOntoImage } from '@/lib/annotation-export';

// For PNG export:
async function exportPngWithAnnotations(
  diagramDataUrl: string,
  diagramData: DiagramData,
  width: number,
  height: number
) {
  const finalDataUrl = await compositeAnnotationsOntoImage({
    diagramDataUrl,
    annotations: diagramData.annotations,
    width,
    height,
  });

  // Download or save finalDataUrl
  const link = document.createElement('a');
  link.href = finalDataUrl;
  link.download = 'diagram-with-annotations.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// For GIF export with multiple frames:
async function exportGifWithAnnotations(
  frameDataUrls: string[],
  diagramData: DiagramData,
  width: number,
  height: number
) {
  if (!diagramData.annotations?.enabled) {
    return frameDataUrls; // No annotations to composite
  }

  const compositedFrames = await Promise.all(
    frameDataUrls.map((dataUrl) =>
      compositeAnnotationsOntoImage({
        diagramDataUrl: dataUrl,
        annotations: diagramData.annotations,
        width,
        height,
      })
    )
  );

  return compositedFrames;
}
*/

// ============================================================================
// 3. PRESENTATION MODE ANNOTATIONS
// ============================================================================

/*
import { PresentationAnnotations } from '@/components/editor/presentation-annotations';
import { type Slide } from '@/lib/types';

// In presentation player:
function PresentationSlide({ slide, width, height }: { slide: Slide }) {
  const [isAnnotating, setIsAnnotating] = useState(false);

  return (
    <PresentationAnnotations
      slide={slide}
      canvasWidth={width}
      canvasHeight={height}
      toolbarPosition="bottom"
      onSlideAnnotationsUpdate={(annotations) => {
        // Update slide annotations
        updateSlideAnnotations(slide.id, annotations);
      }}
    />
  );
}
*/

// ============================================================================
// 4. SERIALIZATION & PERSISTENCE
// ============================================================================

/*
import {
  serializeAnnotations,
  deserializeAnnotations,
  simplifyStroke,
} from '@/lib/annotation-types';

// Saving diagram with annotations:
function saveDiagramWithAnnotations(diagramData: DiagramData) {
  // Simplify strokes to reduce file size
  const optimized = diagramData.annotations
    ? {
        ...diagramData.annotations,
        strokes: diagramData.annotations.strokes.map((stroke) =>
          simplifyStroke(stroke, 2) // tolerance = 2px
        ),
      }
    : undefined;

  const dataToSave = {
    ...diagramData,
    annotations: optimized,
  };

  const json = JSON.stringify(dataToSave);
  localStorage.setItem('diagram', json);
}

// Loading diagram with annotations:
function loadDiagramWithAnnotations() {
  const json = localStorage.getItem('diagram');
  if (!json) return null;

  const data = JSON.parse(json);
  if (data.annotations) {
    data.annotations = deserializeAnnotations(JSON.stringify(data.annotations));
  }
  return data;
}
*/

// ============================================================================
// 5. KEYBOARD SHORTCUTS
// ============================================================================

/*
// Add to diagram-editor keyboard handler:
function handleKeyDown(event: KeyboardEvent) {
  // Toggle annotation tool: Ctrl+Alt+D
  if (event.ctrlKey && event.altKey && event.key === 'd') {
    event.preventDefault();
    annotations.toggleTool();
  }

  // Undo annotation: Ctrl+Z (already handled by undo system)
  if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
    if (annotations.toolConfig.enabled && annotations.annotations.strokes.length > 0) {
      event.preventDefault();
      annotations.undo();
    }
  }

  // Clear annotations: Ctrl+Alt+X
  if (event.ctrlKey && event.altKey && event.key === 'x') {
    event.preventDefault();
    if (confirm('Clear all annotations?')) {
      annotations.clearAll();
    }
  }
}
*/

// ============================================================================
// 6. TESTING THE ANNOTATION SYSTEM
// ============================================================================

/*
// Unit tests
describe('Annotation System', () => {
  it('should create and add strokes', () => {
    const annotations = useAnnotations();
    const stroke: AnnotationStroke = {
      id: 'stroke-1',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      color: '#FF0000',
      width: 2,
      opacity: 1,
      timestamp: Date.now(),
    };

    annotations.addStroke(stroke);
    expect(annotations.annotations.strokes).toHaveLength(1);
    expect(annotations.annotations.strokes[0].id).toBe('stroke-1');
  });

  it('should undo last stroke', () => {
    const annotations = useAnnotations();
    annotations.addStroke(createStroke());
    annotations.addStroke(createStroke());
    expect(annotations.annotations.strokes).toHaveLength(2);

    annotations.undo();
    expect(annotations.annotations.strokes).toHaveLength(1);
  });

  it('should clear all strokes', () => {
    const annotations = useAnnotations();
    annotations.addStroke(createStroke());
    annotations.addStroke(createStroke());
    annotations.clearAll();
    expect(annotations.annotations.strokes).toHaveLength(0);
  });

  it('should serialize/deserialize annotations', () => {
    const annotations: DiagramAnnotations = {
      enabled: true,
      strokes: [createStroke()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const json = serializeAnnotations(annotations);
    const deserialized = deserializeAnnotations(json);
    expect(deserialized.strokes).toHaveLength(1);
  });

  it('should simplify stroke points', () => {
    const stroke: AnnotationStroke = {
      id: 'stroke-1',
      points: generateDensePoints(1000), // 1000 points
      color: '#FF0000',
      width: 2,
      opacity: 1,
      timestamp: Date.now(),
    };

    const simplified = simplifyStroke(stroke, 2);
    expect(simplified.points.length).toBeLessThan(stroke.points.length);
    // Shape should be preserved
    const bounds1 = getAnnotationsBounds({ 
      enabled: true, 
      strokes: [stroke],
      createdAt: 0,
      updatedAt: 0,
    });
    const bounds2 = getAnnotationsBounds({
      enabled: true,
      strokes: [simplified],
      createdAt: 0,
      updatedAt: 0,
    });
    expect(Math.abs(bounds1!.maxX - bounds2!.maxX)).toBeLessThan(3);
  });

  it('should composite annotations onto image', async () => {
    const diagramDataUrl = 'data:image/png;base64,...';
    const annotations: DiagramAnnotations = {
      enabled: true,
      strokes: [createStroke()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await compositeAnnotationsOntoImage({
      diagramDataUrl,
      annotations,
      width: 800,
      height: 600,
    });

    expect(result).toStartWith('data:image/png');
  });
});
*/

// ============================================================================
// 7. PERFORMANCE CONSIDERATIONS
// ============================================================================

/*
// Recommendations:
// - Simplify strokes periodically to reduce file size
// - Use canvas.startDraw/endDraw for batch operations
// - Defer rendering of strokes for large annotation sets (>100 strokes)
// - Use requestAnimationFrame for smooth drawing
// - Compress colors to save space in JSON
// - Store only essential stroke data (points, color, width, opacity)

// Example performance optimization:
function optimizeAnnotations(annotations: DiagramAnnotations): DiagramAnnotations {
  if (annotations.strokes.length === 0) return annotations;

  return {
    ...annotations,
    strokes: annotations.strokes
      .map((stroke) => simplifyStroke(stroke, 2)) // Reduce points
      .filter((stroke) => stroke.points.length > 1), // Remove invalid
  };
}

// Use before saving:
const optimized = optimizeAnnotations(diagramData.annotations);
*/

export {};
