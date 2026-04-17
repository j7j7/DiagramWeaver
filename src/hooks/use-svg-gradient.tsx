"use client";

import React, { useId } from 'react';
import { createSvgGradientData, getGradientCoordinates } from '@/components/diagram/shapes/shape-utils';

interface UseSvgGradientOptions {
  colors: string[];
  angle?: number;
  borderColors?: string[];
  borderAngle?: number;
  /** Optional third gradient (e.g. connector line body in LineShape). */
  lineColors?: string[];
  lineAngle?: number;
  enabled?: boolean;
}

interface UseSvgGradientResult {
  defs: React.ReactNode;
  fillRef: string;
  strokeRef?: string;
  /** `url(#id)` when `lineColors` has two colors; else first line color if any. */
  lineStrokeRef?: string;
}

/**
 * React hook for generating SVG gradients with unique IDs
 * Returns SVG defs element and fill/stroke references for use in SVG shapes
 */
export function useSvgGradient({
  colors,
  angle = 135,
  borderColors,
  borderAngle,
  lineColors,
  lineAngle = 135,
  enabled = true
}: UseSvgGradientOptions): UseSvgGradientResult {
  const gradientId = useId();
  const borderGradientId = borderColors && borderColors.length >= 2 ? `${gradientId}-border` : undefined;

  const needsFillGradient = enabled && colors && colors.length >= 2;
  const needsBorderGradient = enabled && borderColors && borderColors.length >= 2;
  const needsLineGradient = enabled && lineColors && lineColors.length >= 2;
  const lineGradientId = needsLineGradient ? `${gradientId}-line` : '';
  const lineCoords = needsLineGradient ? getGradientCoordinates(lineAngle) : null;

  if (!needsFillGradient && !needsBorderGradient && !needsLineGradient) {
    return {
      defs: null,
      fillRef: colors?.[0] || '#6b7280',
      strokeRef: borderColors?.[0] || undefined,
      lineStrokeRef: lineColors?.[0] || undefined,
    };
  }

  // When only border is gradient, pass dummy fill colors to createSvgGradientData
  const fillColors = needsFillGradient ? colors! : [colors?.[0] || '#6b7280', colors?.[0] || '#6b7280'];

  const { gradientData, borderGradientData, fillRef, strokeRef } = createSvgGradientData(
    gradientId,
    fillColors,
    angle,
    borderGradientId,
    needsBorderGradient ? borderColors : undefined,
    borderAngle
  );

  const fillRefFinal = needsFillGradient ? fillRef : (colors?.[0] || '#6b7280');
  const strokeRefFinal = needsBorderGradient ? strokeRef : borderColors?.[0];
  const lineStrokeRefFinal = needsLineGradient ? `url(#${lineGradientId})` : lineColors?.[0];

  const defs = (
    <defs>
      {needsFillGradient && (
        <linearGradient
          id={gradientData.id}
          x1={gradientData.x1}
          y1={gradientData.y1}
          x2={gradientData.x2}
          y2={gradientData.y2}
        >
          <stop offset="0%" stopColor={gradientData.color1} />
          <stop offset="100%" stopColor={gradientData.color2} />
        </linearGradient>
      )}
      {borderGradientData && (
        <linearGradient
          id={borderGradientData.id}
          x1={borderGradientData.x1}
          y1={borderGradientData.y1}
          x2={borderGradientData.x2}
          y2={borderGradientData.y2}
        >
          <stop offset="0%" stopColor={borderGradientData.color1} />
          <stop offset="100%" stopColor={borderGradientData.color2} />
        </linearGradient>
      )}
      {needsLineGradient && lineColors && lineCoords && (
        <linearGradient
          id={lineGradientId}
          x1={lineCoords.x1}
          y1={lineCoords.y1}
          x2={lineCoords.x2}
          y2={lineCoords.y2}
        >
          <stop offset="0%" stopColor={lineColors[0]} />
          <stop offset="100%" stopColor={lineColors[1]} />
        </linearGradient>
      )}
    </defs>
  );

  return { defs, fillRef: fillRefFinal, strokeRef: strokeRefFinal, lineStrokeRef: lineStrokeRefFinal };
}
