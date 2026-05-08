"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { labelToRuns } from "@/lib/rich-text";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import {
  getTextStylingForNode,
  getTextJustifyClass,
  getVerticalPositionClass,
  getVerticalJustifyClass,
} from "./shape-utils";

interface ShapeTextProps {
  node: DiagramNodeData;
  label: string;
  isEditingLabel: boolean;
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

export function ShapeText({
  node,
  label,
  isEditingLabel,
  editRuns,
  onRichLabelSubmit,
  onVerticalAlignChange,
  onLabelKeyDown,
  onLabelDoubleClick,
}: ShapeTextProps) {
  const nodeAny = node as any;
  const verticalPosition = nodeAny.textVerticalPosition;
  const textPosition = nodeAny.textPosition;

  // Point shapes don't display text
  if (node.type === "generic.object.point" || node.type?.endsWith(".point")) {
    return null;
  }

  const isProgressBar = node.type === "generic.object.progress-bar" || node.type?.endsWith(".progress-bar");
  const showProgressPercent = isProgressBar && nodeAny.progressShowPercent !== false;
  const progressPctRounded = Math.max(
    0,
    Math.min(100, Math.round(Number(nodeAny.progressPercent ?? 0))),
  );

  // Show text if label exists
  if (!label) {
    return null;
  }

  // Determine position: textVerticalPosition takes precedence, fallback to textPosition for backward compatibility
  let effectivePosition: "top" | "middle" | "bottom";
  if (verticalPosition) {
    effectivePosition = verticalPosition;
  } else if (textPosition === "above") {
    effectivePosition = "top";
  } else if (textPosition === "under") {
    effectivePosition = "bottom";
  } else {
    effectivePosition = "middle"; // Default to middle/inside
  }

  // Determine if text should be inside or outside
  const isInside = effectivePosition === "middle";
  const isAbove = effectivePosition === "top";
  const isBelow = effectivePosition === "bottom";

  // Get shape dimensions for outside positioning
  const shapeWidth = node.width || 60;
  const shapeHeight = node.height || 60;
  const spacing = 4; // Spacing between shape and text

  // Kite (diamond) and hexagon have narrower usable width - constrain text so it wraps at spaces with left/right padding
  const isKite = node.type === "generic.object.kite" || node.type?.endsWith(".kite");
  const isHexagon = node.type === "generic.object.hexagon" || node.type?.endsWith(".hexagon");
  const narrowShapeClass = isKite || isHexagon ? " max-w-[70%] mx-auto min-w-0" : "";

  const displayRuns = node.richLabel ?? labelToRuns(node.label);

  // Render text inside the shape (middle position)
  if (isInside) {
    if (isProgressBar && showProgressPercent) {
      const pctStyle: React.CSSProperties = {
        ...getTextStylingForNode(node),
        fontWeight: 700,
      };
      return (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center ${isEditingLabel ? "overflow-visible" : ""}`}
        >
          {isEditingLabel ? (
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 overflow-visible px-1">
              <TextboxRichEditor
                node={node}
                runs={editRuns}
                onSubmit={onRichLabelSubmit}
                onKeyDown={onLabelKeyDown}
                onVerticalAlignChange={onVerticalAlignChange}
              />
              <span className="pointer-events-none tabular-nums" style={pctStyle}>
                {progressPctRounded}%
              </span>
            </div>
          ) : (
            <div className="pointer-events-none flex max-h-full w-full flex-col items-center justify-center gap-1 px-1">
              <div className="pointer-events-auto min-w-0 max-w-full">
                <TextboxRichDisplay node={node} runs={displayRuns} onDoubleClick={onLabelDoubleClick} />
              </div>
              <span className="tabular-nums pointer-events-none" style={pctStyle}>
                {progressPctRounded}%
              </span>
            </div>
          )}
        </div>
      );
    }

    const innerClass = `w-full h-full flex flex-col ${getVerticalJustifyClass(effectivePosition)} px-1`;
    return (
      <div
        className={`absolute inset-0 flex flex-col ${getVerticalPositionClass(effectivePosition)} ${isEditingLabel ? "overflow-visible" : ""}`}
      >
        {isEditingLabel ? (
          <div className={`${innerClass} min-h-0 flex-1 flex flex-col overflow-visible${narrowShapeClass}`}>
            <TextboxRichEditor
              node={node}
              runs={editRuns}
              onSubmit={onRichLabelSubmit}
              onKeyDown={onLabelKeyDown}
              onVerticalAlignChange={onVerticalAlignChange}
            />
          </div>
        ) : (
          <div className={innerClass + narrowShapeClass}>
            <TextboxRichDisplay node={node} runs={displayRuns} onDoubleClick={onLabelDoubleClick} />
          </div>
        )}
      </div>
    );
  }

  // Render text outside the shape (above or below)
  const outsideStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    width: `${shapeWidth}px`,
    ...getTextStylingForNode(node),
    display: "block",
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
      className={`absolute ${getTextJustifyClass(nodeAny.textJustify)} w-full ${isEditingLabel ? "overflow-visible" : ""}`}
      style={outsideStyle}
    >
      {isEditingLabel ? (
        <div className="min-h-0 flex flex-col overflow-visible w-full">
          <TextboxRichEditor
            node={node}
            runs={editRuns}
            onSubmit={onRichLabelSubmit}
            onKeyDown={onLabelKeyDown}
            onVerticalAlignChange={onVerticalAlignChange}
          />
        </div>
      ) : (
        <TextboxRichDisplay node={node} runs={displayRuns} onDoubleClick={onLabelDoubleClick} />
      )}
    </div>
  );
}
