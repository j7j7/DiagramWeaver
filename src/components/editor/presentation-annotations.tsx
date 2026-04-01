"use client";

import React, { useRef } from 'react';
import { type SlideAnnotations } from '@/lib/annotation-types';
import { AnnotationCanvas } from './annotation-canvas';
import { AnnotationToolbar } from './annotation-toolbar';
import { useAnnotations } from '@/hooks/use-annotations';

export interface PresentationAnnotationsProps {
  slide: any; // Slide type
  canvasWidth: number;
  canvasHeight: number;
  onSlideAnnotationsUpdate?: (annotations: SlideAnnotations) => void;
  toolbarPosition?: 'top' | 'bottom' | 'floating';
}

/**
 * Adds annotation support to presentation slides
 * Allows drawing on top of presentation slides and persists annotations
 */
export function PresentationAnnotations({
  slide,
  canvasWidth,
  canvasHeight,
  onSlideAnnotationsUpdate,
  toolbarPosition = 'bottom',
}: PresentationAnnotationsProps) {
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const initialAnnotations: SlideAnnotations = slide?.annotations || {
    enabled: false,
    strokes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const annotations = useAnnotations({
    initialAnnotations,
    onAnnotationsChange: (updated) => {
      const slideAnnotations: SlideAnnotations = {
        enabled: updated.enabled,
        strokes: updated.strokes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
      onSlideAnnotationsUpdate?.(slideAnnotations);
    },
  });

  const [isDrawing, setIsDrawing] = React.useState(false);

  return (
    <div
      style={{
        position: 'relative',
        width: canvasWidth,
        height: canvasHeight,
      }}
    >
      {/* Drawing canvas overlay */}
      <AnnotationCanvas
        enabled={annotations.toolConfig.enabled}
        width={canvasWidth}
        height={canvasHeight}
        canvasRef={annotationCanvasRef}
        toolConfig={annotations.toolConfig}
        isDrawing={isDrawing}
        onDrawingChange={setIsDrawing}
        resetToken={slide?.id ?? 'none'}
        onStrokeComplete={(stroke) => {
          annotations.addStroke(stroke);
        }}
      />

      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          ...(toolbarPosition === 'top' && { top: '8px', left: '8px' }),
          ...(toolbarPosition === 'bottom' && { bottom: '8px', left: '8px' }),
          ...(toolbarPosition === 'floating' && { right: '8px', top: '50%', transform: 'translateY(-50%)' }),
          zIndex: 40,
        }}
      >
        <AnnotationToolbar
          toolConfig={annotations.toolConfig}
          onToolChange={(config) => {
            if (config.enabled !== undefined) {
              // Toggle tool
              if (config.enabled) annotations.toggleTool();
            } else {
              // Update specific properties
              if (config.color) annotations.setColor(config.color);
              if (config.width) annotations.setWidth(config.width);
              if (config.opacity !== undefined) annotations.setOpacity(config.opacity);
              if (config.style) annotations.setStyle(config.style);
            }
          }}
          onToggleTool={() => annotations.toggleTool()}
          onClearAll={() => annotations.clearAll()}
          onUndo={() => annotations.undo()}
          hasStrokes={annotations.annotations.strokes.length > 0}
          isDrawing={isDrawing}
        />
      </div>
    </div>
  );
}
