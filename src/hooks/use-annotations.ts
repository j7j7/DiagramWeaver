'use client';

import { useCallback, useState } from 'react';
import {
  type DiagramAnnotations,
  type AnnotationStroke,
  type AnnotationToolConfig,
  createEmptyAnnotations,
  addStroke,
  removeStroke,
  clearStrokes,
  undoLastStroke,
  serializeAnnotations,
  deserializeAnnotations,
  getAnnotationsBounds,
} from '@/lib/annotation-types';

export interface UseAnnotationsOptions {
  initialAnnotations?: DiagramAnnotations;
  onAnnotationsChange?: (annotations: DiagramAnnotations) => void;
}

export function useAnnotations(options: UseAnnotationsOptions = {}) {
  const [annotations, setAnnotations] = useState<DiagramAnnotations>(
    options.initialAnnotations || createEmptyAnnotations()
  );

  const [toolConfig, setToolConfig] = useState<AnnotationToolConfig>({
    enabled: false,
    color: '#000000',
    width: 3,
    opacity: 1,
    style: 'pen',
  });

  const updateAnnotations = useCallback(
    (newAnnotations: DiagramAnnotations) => {
      setAnnotations(newAnnotations);
      options.onAnnotationsChange?.(newAnnotations);
    },
    [options]
  );

  const addStrokeToAnnotations = useCallback(
    (stroke: AnnotationStroke) => {
      const updated = addStroke(annotations, stroke);
      updateAnnotations(updated);
    },
    [annotations, updateAnnotations]
  );

  const removeStrokeFromAnnotations = useCallback(
    (strokeId: string) => {
      const updated = removeStroke(annotations, strokeId);
      updateAnnotations(updated);
    },
    [annotations, updateAnnotations]
  );

  const clearAllStrokes = useCallback(() => {
    const updated = clearStrokes(annotations);
    updateAnnotations(updated);
  }, [annotations, updateAnnotations]);

  const undoStroke = useCallback(() => {
    const updated = undoLastStroke(annotations);
    updateAnnotations(updated);
  }, [annotations, updateAnnotations]);

  const toggleAnnotationTool = useCallback(() => {
    setToolConfig((prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  }, []);

  const setToolColor = useCallback((color: string) => {
    setToolConfig((prev) => ({
      ...prev,
      color,
    }));
  }, []);

  const setToolWidth = useCallback((width: number) => {
    const clamped = Math.max(1, Math.min(20, width));
    setToolConfig((prev) => ({
      ...prev,
      width: clamped,
    }));
  }, []);

  const setToolOpacity = useCallback((opacity: number) => {
    const clamped = Math.max(0, Math.min(1, opacity));
    setToolConfig((prev) => ({
      ...prev,
      opacity: clamped,
    }));
  }, []);

  const setToolStyle = useCallback((style: 'pen' | 'marker' | 'highlighter' | 'eraser') => {
    setToolConfig((prev) => ({
      ...prev,
      style,
    }));
  }, []);

  const exportAnnotationsJson = useCallback(() => {
    return serializeAnnotations(annotations);
  }, [annotations]);

  const importAnnotationsJson = useCallback(
    (json: string) => {
      const imported = deserializeAnnotations(json);
      updateAnnotations(imported);
    },
    [updateAnnotations]
  );

  const getStrokeBounds = useCallback(() => {
    return getAnnotationsBounds(annotations);
  }, [annotations]);

  return {
    // State
    annotations,
    toolConfig,

    // Annotation operations
    addStroke: addStrokeToAnnotations,
    removeStroke: removeStrokeFromAnnotations,
    clearAll: clearAllStrokes,
    undo: undoStroke,

    // Tool configuration
    toggleTool: toggleAnnotationTool,
    setColor: setToolColor,
    setWidth: setToolWidth,
    setOpacity: setToolOpacity,
    setStyle: setToolStyle,

    // Import/export
    exportJson: exportAnnotationsJson,
    importJson: importAnnotationsJson,

    // Utilities
    getBounds: getStrokeBounds,
  };
}
