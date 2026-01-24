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

  // Only show text if it's in the center/middle position (default)
  const showText = (nodeAny.textVerticalPosition === 'middle' || !nodeAny.textVerticalPosition) &&
                   (nodeAny.textPosition === 'center' || !nodeAny.textPosition) &&
                   label;

  if (!showText) {
    return null;
  }

  return (
    <div className={`absolute inset-0 flex flex-col ${getVerticalPositionClass(nodeAny.textVerticalPosition)}`}>
      {isEditingLabel ? (
        <div className={`w-full h-full flex flex-col ${getVerticalJustifyClass(nodeAny.textVerticalPosition)} px-1`}>
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
        <div className={`w-full h-full flex flex-col ${getVerticalJustifyClass(nodeAny.textVerticalPosition)} px-1`}>
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
