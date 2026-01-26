"use client";

import React, { useRef } from "react";
import type { DiagramNodeData } from "@/lib/types";
import {
  getTextStylingForNode,
  getTextColorForBackground,
  getTextJustifyClass,
  getVerticalPositionClass,
  getVerticalJustifyClass,
  getShapeStyles,
} from "./shape-utils";

interface ShapeTextProps {
  node: DiagramNodeData;
  label: string;
  isEditingLabel: boolean;
  editText: string;
  onLabelTextChange: (text: string) => void;
  onLabelSubmit: () => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

export function ShapeText({
  node,
  label,
  isEditingLabel,
  editText,
  onLabelTextChange,
  onLabelSubmit,
  onLabelKeyDown,
  onLabelDoubleClick,
}: ShapeTextProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeAny = node as any;
  const styles = getShapeStyles(node);
  const verticalPosition = nodeAny.textVerticalPosition;
  const textPosition = nodeAny.textPosition;

  // Point shapes don't display text
  if (node.type === 'generic.object.point' || node.type?.endsWith('.point')) {
    return null;
  }

  // Show text if label exists
  if (!label) {
    return null;
  }

  // Determine position: textVerticalPosition takes precedence, fallback to textPosition for backward compatibility
  let effectivePosition: 'top' | 'middle' | 'bottom';
  if (verticalPosition) {
    effectivePosition = verticalPosition;
  } else if (textPosition === 'above') {
    effectivePosition = 'top';
  } else if (textPosition === 'under') {
    effectivePosition = 'bottom';
  } else {
    effectivePosition = 'middle'; // Default to middle/inside
  }

  // Determine if text should be inside or outside
  const isInside = effectivePosition === 'middle';
  const isAbove = effectivePosition === 'top';
  const isBelow = effectivePosition === 'bottom';

  // Get shape dimensions for outside positioning
  const shapeWidth = node.width || 60;
  const shapeHeight = node.height || 60;
  const spacing = 4; // Spacing between shape and text

  // Render text inside the shape (middle position)
  if (isInside) {
    return (
      <div className={`absolute inset-0 flex flex-col ${getVerticalPositionClass(effectivePosition)}`}>
        {isEditingLabel ? (
          <div className={`w-full h-full flex flex-col ${getVerticalJustifyClass(effectivePosition)} px-1`}>
            <input
              ref={inputRef}
              id={`node-input-${node.id}`}
              type="text"
              value={editText}
              onChange={(e) => onLabelTextChange(e.target.value)}
              onBlur={onLabelSubmit}
              onKeyDown={onLabelKeyDown}
              className={`text-xs ${getTextJustifyClass(nodeAny.textJustify)} bg-transparent border border-white rounded px-1 py-0.5 w-full outline-none`}
              style={{
                ...getTextStylingForNode(node),
                color: getTextColorForBackground(styles.backgroundColor, nodeAny.textColor)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className={`w-full h-full flex flex-col ${getVerticalJustifyClass(effectivePosition)} px-1`}>
            <p
              className={`text-xs ${getTextJustifyClass(nodeAny.textJustify)} break-words leading-tight cursor-text w-full`}
              style={{
                ...getTextStylingForNode(node),
                color: getTextColorForBackground(styles.backgroundColor, nodeAny.textColor),
                display: 'block'
              }}
              onDoubleClick={onLabelDoubleClick}
            >
              {label}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Render text outside the shape (above or below)
  const outsideStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    width: `${shapeWidth}px`,
    ...getTextStylingForNode(node),
    display: 'block',
  };

  if (isAbove) {
    // Position above the shape - use bottom to position above the wrapper
    outsideStyle.bottom = `calc(100% + ${spacing}px)`;
  } else if (isBelow) {
    // Position below the shape - use top to position below the wrapper
    outsideStyle.top = `calc(100% + ${spacing}px)`;
  }

  return (
    <div
      className={`absolute ${getTextJustifyClass(nodeAny.textJustify)} w-full`}
      style={outsideStyle}
    >
      {isEditingLabel ? (
        <input
          ref={inputRef}
          id={`node-input-${node.id}`}
          type="text"
          value={editText}
          onChange={(e) => onLabelTextChange(e.target.value)}
          onBlur={onLabelSubmit}
          onKeyDown={onLabelKeyDown}
          className={`text-xs ${getTextJustifyClass(nodeAny.textJustify)} bg-transparent border border-white rounded px-1 py-0.5 w-full outline-none`}
          style={{
            ...getTextStylingForNode(node),
            color: nodeAny.textColor || '#374151',
            display: 'block'
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <p
          className={`text-xs ${getTextJustifyClass(nodeAny.textJustify)} break-words leading-tight cursor-text w-full`}
          style={{
            ...getTextStylingForNode(node),
            color: nodeAny.textColor || '#374151',
            display: 'block'
          }}
          onDoubleClick={onLabelDoubleClick}
        >
          {label}
        </p>
      )}
    </div>
  );
}
