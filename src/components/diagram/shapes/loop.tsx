"use client";

import React from "react";
import { useTheme } from "@/components/theme-provider";
import type { DiagramNodeData } from "@/lib/types";
import { extractTextStylingFromNode, getSvgTextOutlineProps, getTextEffectsShadowCss } from "@/lib/text-styling";

interface LoopShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  slideColorTransition?: string;
}

/**
 * Loop shape for sequence diagram self-loops (e.g. A->>A: message).
 * Renders a curved path that bulges to the right, from top to bottom,
 * with optional arrow at the end and label.
 */
export function LoopShape({ node, fill = "#000000", stroke, strokeWidth = 2.5, onClick, onContextMenu, slideColorTransition }: LoopShapeProps) {
  const { resolvedTheme } = useTheme();
  const width = node.width ?? 60;
  const height = node.height ?? 80;

  const lineColor = node.lineColor || '#6b7280';
  const actualStrokeWidth = (node as any).lineThickness ?? strokeWidth ?? 2.5;
  const lineType = (node as any).lineType || 'solid';
  const endCap = (node as any).endCap || 'arrow';

  let strokeDasharray: string | undefined;
  if (lineType === 'dashed') {
    strokeDasharray = `${actualStrokeWidth * 4} ${actualStrokeWidth * 2}`;
  } else if (lineType === 'dotted') {
    strokeDasharray = `0 ${actualStrokeWidth * 2}`;
  }

  // Cubic bezier: from top-left (0,0) to bottom-left (0, height), bulging to the right
  const pathD = `M 0 0 C ${width} 0, ${width} ${height}, 0 ${height}`;

  const label = node.label || '';
  const textStyling = extractTextStylingFromNode(node);
  const textColor = textStyling.textColor || lineColor;
  const fontSize = textStyling.fontSize || 12;
  const outlineSvg = getSvgTextOutlineProps(textStyling);
  const effectsShadow = getTextEffectsShadowCss(textStyling);
  const themeLabelShadow =
    resolvedTheme === "dark"
      ? "0 0 3px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.9)"
      : "0 0 3px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,0.8)";

  // Arrow at bottom - points left (back toward lifeline)
  const arrowSize = 10;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${-arrowSize} 0 ${width + arrowSize * 2} ${height + arrowSize}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible', pointerEvents: 'auto' }}
      >
        <path
          d={pathD}
          fill="none"
          stroke={stroke || lineColor}
          strokeWidth={actualStrokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            pointerEvents: 'stroke',
            cursor: onClick ? 'pointer' : undefined,
            ...(slideColorTransition !== undefined ? { transition: slideColorTransition } : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(e as unknown as React.MouseEvent, node);
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            onContextMenu?.(e as unknown as React.MouseEvent, node);
          }}
        />
        {endCap === 'arrow' && (
          <polygon
            points={`${0},${height} ${arrowSize},${height - arrowSize * 0.6} ${arrowSize},${height + arrowSize * 0.6}`}
            fill={lineColor}
            stroke={lineColor}
            strokeWidth={1}
            style={{ pointerEvents: "none" }}
          />
        )}
        {label && (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={textColor}
            stroke={outlineSvg.stroke}
            strokeWidth={outlineSvg.strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fontSize={fontSize}
            fontWeight={textStyling.fontWeight || '500'}
            fontFamily={textStyling.fontFamily || 'Inter, system-ui, sans-serif'}
            style={{
              paintOrder: outlineSvg.paintOrder,
              textShadow:
                effectsShadow ??
                (outlineSvg.stroke ? undefined : themeLabelShadow),
              pointerEvents: 'none',
            }}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
