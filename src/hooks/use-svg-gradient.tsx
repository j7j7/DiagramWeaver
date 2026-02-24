"use client";

import React, { useId } from 'react';
import { createSvgGradientData } from '@/components/diagram/shapes/shape-utils';

interface UseSvgGradientOptions {
  colors: string[];
  angle?: number;
  borderColors?: string[];
  borderAngle?: number;
  enabled?: boolean;
}

interface UseSvgGradientResult {
  defs: React.ReactNode;
  fillRef: string;
  strokeRef?: string;
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
  enabled = true
}: UseSvgGradientOptions): UseSvgGradientResult {
  const gradientId = useId();
  const borderGradientId = borderColors ? `${gradientId}-border` : undefined;

  if (!enabled || !colors || colors.length < 2) {
    return {
      defs: null,
      fillRef: colors?.[0] || '#6b7280',
      strokeRef: borderColors?.[0] || undefined
    };
  }

  const { gradientData, borderGradientData, fillRef, strokeRef } = createSvgGradientData(
    gradientId,
    colors,
    angle,
    borderGradientId,
    borderColors,
    borderAngle
  );

  const defs = (
    <defs>
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
    </defs>
  );

  return { defs, fillRef, strokeRef };
}
