"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { getShapeStyles } from "./shape-utils";
import { ShapeTag } from "./shape-tag";
import { ShapeText } from "./shape-text";

interface ShapeWrapperProps {
  node: DiagramNodeData & { width?: number; height?: number };
  children?: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  borderRadius?: string;
  useSvgShadow?: boolean;
  skipWrapperStyling?: boolean; // When true, skip border/background styling on wrapper (for SVG shapes)
  // Tag props
  tag?: string;
  tagPosition?: string;
  isEditingTag: boolean;
  editTagText: string;
  onTagTextChange: (text: string) => void;
  onTagSubmit: () => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
  // Text props
  label: string;
  isEditingLabel: boolean;
  editText: string;
  onLabelTextChange: (text: string) => void;
  onLabelSubmit: () => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

export function ShapeWrapper({
  node,
  children,
  defaultWidth = 60,
  defaultHeight = 60,
  borderRadius,
  useSvgShadow = false,
  skipWrapperStyling = false,
  tag,
  tagPosition,
  isEditingTag,
  editTagText,
  onTagTextChange,
  onTagSubmit,
  onTagKeyDown,
  onTagDoubleClick,
  label,
  isEditingLabel,
  editText,
  onLabelTextChange,
  onLabelSubmit,
  onLabelKeyDown,
  onLabelDoubleClick,
}: ShapeWrapperProps) {
  const styles = getShapeStyles(node);
  const nodeAny = node as any;
  const width = node.width || defaultWidth;
  const height = node.height || defaultHeight;
  const roundedEdges = nodeAny.roundedEdges || false;

  // Calculate borderRadius when roundedEdges is enabled
  // Use 6% of the smaller dimension for subtle rounding
  const calculatedBorderRadius = roundedEdges 
    ? `${Math.min(width, height) * 0.06}px` 
    : borderRadius;

  // Skip border/background styling when skipWrapperStyling is true (for SVG shapes)
  // or when useSvgShadow is true (for SVG shapes with shadow)
  const shouldSkipStyling = skipWrapperStyling || useSvgShadow;

  return (
    <div
      key={`gradient-${nodeAny.gradientAngle || 135}`}
      className="relative"
      style={{
        background: !shouldSkipStyling ? styles.background : undefined,
        borderWidth: !shouldSkipStyling ? styles.borderWidth : undefined,
        borderStyle: !shouldSkipStyling ? styles.borderStyle : undefined,
        borderColor: !shouldSkipStyling ? styles.borderColor : undefined,
        borderRadius: calculatedBorderRadius,
        width,
        height,
        minWidth: width,
        minHeight: height,
        margin: styles.shadow ? 4 : 0,
        ...(styles.shadow && !useSvgShadow && {
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }),
        ...(styles.shadow && useSvgShadow && {
          filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.2)) drop-shadow(0 10px 10px rgba(0, 0, 0, 0.04))'
        })
      }}
    >
      {children ?? null}
      
      <ShapeTag
        tag={tag ?? ''}
        tagPosition={tagPosition ?? 'top-left'}
        isEditingTag={isEditingTag}
        editTagText={editTagText}
        onTagTextChange={onTagTextChange}
        onTagSubmit={onTagSubmit}
        onTagKeyDown={onTagKeyDown}
        onTagDoubleClick={onTagDoubleClick}
      />

      <ShapeText
        node={node}
        label={label}
        isEditingLabel={isEditingLabel}
        editText={editText}
        onLabelTextChange={onLabelTextChange}
        onLabelSubmit={onLabelSubmit}
        onLabelKeyDown={onLabelKeyDown}
        onLabelDoubleClick={onLabelDoubleClick}
      />
    </div>
  );
}
