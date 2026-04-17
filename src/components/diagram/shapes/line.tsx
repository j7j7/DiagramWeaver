"use client";

import React from "react";
import { useTheme } from "@/components/theme-provider";
import type { DiagramNodeData } from "@/lib/types";
import { extractTextStylingFromNode, getSvgTextOutlineProps, getTextEffectsShadowCss } from "@/lib/text-styling";
import {
  connectorLinePathD,
  connectorLinePointBounds,
  curveBoundsExpanded,
  getConnectorLineVertices,
  isConnectorLineGeometryClosed,
  linePathTangentAtEnd,
  linePathTangentAtStart,
  pointAtLengthRatio,
  type LinePathStyle,
} from "@/lib/line-curve-path";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { getShapeSvgFill } from "@/components/diagram/shapes/shape-utils";

interface LineShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  slideColorTransition?: string;
}

// Helper to render different line cap styles
const renderLineCap = (
  capType: 'none' | 'arrow' | 'dot' | 'square' | undefined,
  x: number,
  y: number,
  angle: number,
  color: string,
  size: number = 10
) => {
  if (!capType || capType === 'none') return null;

  const angleRad = (angle * Math.PI) / 180;

  if (capType === 'arrow') {
    // Arrow pointing in the direction of the line
    const baseWidth = size;
    const height = size * 1.5;
    
    // Arrow points in the direction of the angle
    const p1 = {
      x: x + Math.cos(angleRad) * height,
      y: y + Math.sin(angleRad) * height
    };
    const p2 = {
      x: x + Math.cos(angleRad + Math.PI * 2/3) * baseWidth,
      y: y + Math.sin(angleRad + Math.PI * 2/3) * baseWidth
    };
    const p3 = {
      x: x + Math.cos(angleRad - Math.PI * 2/3) * baseWidth,
      y: y + Math.sin(angleRad - Math.PI * 2/3) * baseWidth
    };

    return (
      <polygon
        points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    );
  }

  if (capType === 'dot') {
    return (
      <circle
        cx={x}
        cy={y}
        r={size / 2}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    );
  }

  if (capType === 'square') {
    const halfSize = size / 2;
    return (
      <rect
        x={x - halfSize}
        y={y - halfSize}
        width={size}
        height={size}
        fill={color}
        stroke={color}
        strokeWidth={1}
        transform={`rotate(${angle} ${x} ${y})`}
      />
    );
  }

  return null;
};

function normalizeTwoColors(value: unknown, fallbackA: string, fallbackB: string): [string, string] {
  if (Array.isArray(value)) {
    const vals = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (vals.length >= 2) return [vals[0], vals[1]];
    if (vals.length === 1) return [vals[0], vals[0]];
  }
  return [fallbackA, fallbackB];
}

export function LineShape({ node, fill = "#000000", stroke, strokeWidth = 2.5, onClick, onContextMenu, slideColorTransition }: LineShapeProps) {
  const { resolvedTheme } = useTheme();
  const vertices = getConnectorLineVertices(node as DiagramNodeData & { __localStartPos?: { x: number; y: number }; __localEndPos?: { x: number; y: number }; __localControlPoints?: { x: number; y: number }[] });
  const startPos = vertices[0];
  const endPos = vertices[vertices.length - 1];

  const linePathStyle = (node as DiagramNodeData & { linePathStyle?: LinePathStyle }).linePathStyle;
  const lineSmoothJoints = (node as DiagramNodeData & { lineSmoothJoints?: boolean }).lineSmoothJoints === true;

  const pathD = connectorLinePathD(vertices, linePathStyle, lineSmoothJoints);
  const closed = isConnectorLineGeometryClosed(node as DiagramNodeData);
  const pathDClosed = closed && pathD ? `${pathD.trimEnd()} Z` : pathD;

  const nodeAny = node as DiagramNodeData & {
    backgroundStyle?: string;
    backgroundColor?: string;
    backgroundColors?: string[];
    gradientAngle?: number;
    borderStyle?: string;
    borderColor?: string;
    borderColors?: string[];
    borderWidth?: number;
    borderGradientAngle?: number;
  };

  const hasExplicitShapeVisual =
    nodeAny.backgroundStyle !== undefined ||
    nodeAny.backgroundColor !== undefined ||
    (Array.isArray(nodeAny.backgroundColors) && nodeAny.backgroundColors.length > 0) ||
    nodeAny.borderStyle !== undefined ||
    nodeAny.borderColor !== undefined ||
    (Array.isArray(nodeAny.borderColors) && nodeAny.borderColors.length > 0) ||
    nodeAny.borderWidth !== undefined;

  const backgroundColorFallback =
    nodeAny.backgroundColor || (hasExplicitShapeVisual ? "#6b7280" : "#93c5fd");
  const borderColorFallback =
    nodeAny.borderColor || (hasExplicitShapeVisual ? "#6b7280" : "#374151");
  const [bgStart, bgEnd] = normalizeTwoColors(
    nodeAny.backgroundColors,
    backgroundColorFallback,
    hasExplicitShapeVisual ? backgroundColorFallback : backgroundColorFallback,
  );
  const [borderStart, borderEnd] = normalizeTwoColors(
    nodeAny.borderColors,
    borderColorFallback,
    hasExplicitShapeVisual ? borderColorFallback : borderColorFallback,
  );
  const gradientAngle = nodeAny.gradientAngle ?? 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = (nodeAny.backgroundStyle || "none") as "solid" | "gradient" | "none";

  const explicitBorderVisual =
    nodeAny.borderStyle !== undefined ||
    nodeAny.borderColor !== undefined ||
    (Array.isArray(nodeAny.borderColors) && nodeAny.borderColors.length > 0) ||
    nodeAny.borderWidth !== undefined;
  const borderStyleVs = (explicitBorderVisual
    ? nodeAny.borderStyle || "solid"
    : "none") as "solid" | "dotted" | "gradient" | "none";
  const borderStrokeWidth =
    borderStyleVs === "none" ? 0 : (parseInt(String(nodeAny.borderWidth ?? 2), 10) || 2);
  const hasVisualBorder = explicitBorderVisual && borderStyleVs !== "none" && borderStrokeWidth > 0;

  const needsAreaFill = closed && backgroundStyle !== "none";
  const needsFillGradient = needsAreaFill && backgroundStyle === "gradient";
  const needsBorderGradient = hasVisualBorder && borderStyleVs === "gradient";
  const { defs: gradientDefs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? [bgStart, bgEnd] : [bgStart],
    angle: gradientAngle,
    borderColors: needsBorderGradient ? [borderStart, borderEnd] : undefined,
    borderAngle: needsBorderGradient ? borderGradientAngle : undefined,
    enabled: needsFillGradient || needsBorderGradient,
  });
  const areaFill = needsAreaFill
    ? getShapeSvgFill(backgroundStyle, fillRef, backgroundColorFallback)
    : "none";
  const borderStrokePaint =
    borderStyleVs === "gradient" ? (strokeRef ?? borderColorFallback) : borderColorFallback;
  const borderStrokeDasharray = borderStyleVs === "dotted" ? "3,3" : undefined;
  
  const nodeX = node.x ?? connectorLinePointBounds(vertices).minX;
  const nodeY = node.y ?? connectorLinePointBounds(vertices).minY;
  
  const relStartX = startPos.x - nodeX;
  const relStartY = startPos.y - nodeY;
  const relEndX = endPos.x - nodeX;
  const relEndY = endPos.y - nodeY;
  
  const tangentStart = linePathTangentAtStart(vertices, linePathStyle);
  const tangentEnd = linePathTangentAtEnd(vertices, linePathStyle);
  const angleToStartCap = tangentStart + 180;
  
  // Line caps
  const startCap = node.startCap || 'none';
  const endCap = node.endCap || 'none';
  
  // Use node's lineColor or default to grey
  const lineColor = node.lineColor || '#6b7280';
  const actualStrokeWidth = node.lineThickness || strokeWidth;
  
  // Line type - determine strokeDasharray based on lineType
  const lineType = (node as any).lineType || 'solid';
  let strokeDasharray: string | undefined;
  if (lineType === 'dashed') {
    // Dashed line: longer dashes with gaps
    strokeDasharray = `${actualStrokeWidth * 4} ${actualStrokeWidth * 2}`;
  } else if (lineType === 'dotted') {
    // Dotted line: small dots with gaps
    strokeDasharray = `0 ${actualStrokeWidth * 2}`;
  }
  
  // Get text styling from node
  const textStyling = extractTextStylingFromNode(node);
  const textColor = textStyling.textColor || lineColor;
  const fontSize = textStyling.fontSize || 12;
  const fontWeight = textStyling.fontWeight || '500';
  const fontFamily = textStyling.fontFamily || 'Inter, system-ui, sans-serif';
  const fontStyle = textStyling.fontStyle || 'normal';
  const letterSpacing = textStyling.letterSpacing || 0;
  const textOpacity = textStyling.textOpacity !== undefined ? textStyling.textOpacity : 1;
  const outlineSvg = getSvgTextOutlineProps(textStyling);
  const effectsShadow = getTextEffectsShadowCss(textStyling);
  const themeLabelShadow =
    resolvedTheme === "dark"
      ? "0 0 3px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.9), 1px 1px 4px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.9), 1px -1px 4px rgba(0,0,0,0.9), -1px 1px 4px rgba(0,0,0,0.9)"
      : "0 0 3px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,0.8), 1px 1px 4px rgba(255,255,255,1), -1px -1px 4px rgba(255,255,255,1), 1px -1px 4px rgba(255,255,255,1), -1px 1px 4px rgba(255,255,255,1)";
  
  const capSize = 10;
  const padding = capSize * 3;
  const textPadding = node.label ? 30 : 0;
  const strokeExtentPad =
    (hasVisualBorder ? borderStrokeWidth / 2 : actualStrokeWidth / 2) + 4;
  const absPad = padding + textPadding + strokeExtentPad;
  const expanded = curveBoundsExpanded(vertices, absPad, linePathStyle, lineSmoothJoints);
  const svgMinX = expanded.minX - nodeX;
  const svgMinY = expanded.minY - nodeY;
  const svgMaxX = expanded.maxX - nodeX;
  const svgMaxY = expanded.maxY - nodeY;
  const svgWidth = Math.max(1, svgMaxX - svgMinX);
  const svgHeight = Math.max(1, svgMaxY - svgMinY);
  
  const textPositionPercent = (node as any).lineTextPosition || 50;
  const t = textPositionPercent / 100;
  const textPtAbs = pointAtLengthRatio(vertices, t, linePathStyle, lineSmoothJoints);
  const textX = textPtAbs.x - nodeX;
  const textY = textPtAbs.y - nodeY;
  const textPtLo = pointAtLengthRatio(vertices, Math.max(0, t - 0.03), linePathStyle, lineSmoothJoints);
  const textPtHi = pointAtLengthRatio(vertices, Math.min(1, t + 0.03), linePathStyle, lineSmoothJoints);
  const lineAngleRad = Math.atan2(textPtHi.y - textPtLo.y, textPtHi.x - textPtLo.x);
  const textDeg = (lineAngleRad * 180) / Math.PI;
  const absAngle = Math.abs(textDeg);
  const wouldFlipUpsideDown = absAngle > 90 && absAngle < 270;
  const textRotation = (node as any).lineTextHorizontal === true || wouldFlipUpsideDown
    ? 0
    : textDeg;
  
  // Text position mode: 'above', 'below', or 'middle' (default)
  const textPosition = (node as any).lineTextVerticalPosition || 'middle';
  // Calculate offset based on font size - scale with font but keep it closer for large fonts
  const baseOffset = fontSize * 0.8; // 0.8x font size for closer spacing, especially for large fonts
  const textOffset = textPosition === 'above' ? -baseOffset : textPosition === 'below' ? baseOffset : 0;
  
  // Calculate perpendicular offset for text above/below
  const perpAngleRad = lineAngleRad + Math.PI / 2;
  const textOffsetX = Math.cos(perpAngleRad) * textOffset;
  const textOffsetY = Math.sin(perpAngleRad) * textOffset;
  
  const finalTextX = textX + textOffsetX;
  const finalTextY = textY + textOffsetY;
  
  // Process text (split by newlines and handle long lines)
  const label = node.label || '';
  const explicitLines = label.split('\n');
  const textLines: string[] = [];
  
  explicitLines.forEach(line => {
    if (line.length > 15) {
      const words = line.split(' ');
      let currentLine = '';
      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= 15) {
          currentLine = testLine;
        } else {
          if (currentLine) textLines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) textLines.push(currentLine);
    } else {
      textLines.push(line);
    }
  });
  
  return (
    <div style={{
      position: 'absolute',
      left: `${svgMinX}px`,
      top: `${svgMinY}px`,
      width: `${svgWidth}px`,
      height: `${svgHeight}px`,
      pointerEvents: 'none',
    }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          overflow: 'visible',
          pointerEvents: 'none', // Make SVG background non-clickable
        }}
      >
        <g transform={`translate(${-(nodeX + svgMinX)}, ${-(nodeY + svgMinY)})`}>
          {gradientDefs}
          {needsAreaFill && (
            <path
              d={pathDClosed}
              fill={areaFill}
              stroke="none"
              className="pointer-events-none"
              style={slideColorTransition !== undefined ? { transition: slideColorTransition } : undefined}
            />
          )}
          {hasVisualBorder && (
            <path
              d={closed ? pathDClosed : pathD}
              fill="none"
              stroke={borderStrokePaint}
              strokeWidth={borderStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={borderStrokeDasharray}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-none"
              style={slideColorTransition !== undefined ? { transition: slideColorTransition } : undefined}
            />
          )}
          <path
            d={pathD}
            stroke="transparent"
            strokeWidth={Math.max(
              20,
              (hasVisualBorder ? borderStrokeWidth : actualStrokeWidth) * 3,
            )}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(e as any, node);
            }}
            onContextMenu={(e) => {
              e.stopPropagation();
              onContextMenu?.(e as any, node);
            }}
          />
          {!hasVisualBorder && (
            <path
              d={closed ? pathDClosed : pathD}
              stroke={stroke || lineColor}
              strokeWidth={actualStrokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={strokeDasharray}
              style={{
                pointerEvents: 'none',
                ...(slideColorTransition !== undefined ? { transition: slideColorTransition } : {}),
              }}
            />
          )}
        </g>
        
        {/* Closed paths: no start/end caps (same vertex). */}
        {!closed &&
          renderLineCap(
            startCap,
            relStartX - svgMinX,
            relStartY - svgMinY,
            angleToStartCap,
            hasVisualBorder ? borderStrokePaint : lineColor,
            capSize,
          )}
        {!closed &&
          renderLineCap(
            endCap,
            relEndX - svgMinX,
            relEndY - svgMinY,
            tangentEnd,
            hasVisualBorder ? borderStrokePaint : lineColor,
            capSize,
          )}
        
        {/* Text label */}
        {label && textLines.length > 0 && (
          <g transform={`translate(${finalTextX - svgMinX}, ${finalTextY - svgMinY}) rotate(${textRotation})`}>
            {textLines.map((line, index) => {
              const lineHeightValue = textStyling.lineHeight || 1.4;
              const lineHeightPx = fontSize * lineHeightValue;
              const startY = -((textLines.length - 1) * lineHeightPx) / 2;
              
              // Apply text transform if specified
              let displayText = line;
              if (textStyling.textTransform === 'uppercase') {
                displayText = line.toUpperCase();
              } else if (textStyling.textTransform === 'lowercase') {
                displayText = line.toLowerCase();
              } else if (textStyling.textTransform === 'capitalize') {
                displayText = line.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
              }
              
              return (
                <text
                  key={index}
                  x={0}
                  y={startY + (index * lineHeightPx)}
                  fill={textColor}
                  stroke={outlineSvg.stroke}
                  strokeWidth={outlineSvg.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fontSize={fontSize}
                  fontWeight={fontWeight}
                  fontFamily={fontFamily}
                  fontStyle={fontStyle}
                  letterSpacing={letterSpacing ? `${letterSpacing}px` : undefined}
                  opacity={textOpacity}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  style={{
                    paintOrder: outlineSvg.paintOrder,
                    textShadow:
                      effectsShadow ??
                      (outlineSvg.stroke ? undefined : themeLabelShadow),
                    textDecoration: textStyling.textDecoration === 'underline' ? 'underline' : 
                                   textStyling.textDecoration === 'line-through' ? 'line-through' :
                                   textStyling.textDecoration === 'overline' ? 'overline' : 'none'
                  }}
                >
                  {displayText}
                </text>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
