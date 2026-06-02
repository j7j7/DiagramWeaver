"use client";

import React from "react";
import type { CSSProperties, ReactNode } from "react";

/** Shell SVG (border + interior fill) sits below heading tab. */
export const FRAMED_HEADING_SHELL_Z_INDEX = 0;
/** Card element tree (heading tab uses higher z-index within). */
export const FRAMED_HEADING_CONTENT_Z_INDEX = 10;

export function framedHeadingShellOuterStyle(
  maskShellStyle: CSSProperties,
): CSSProperties {
  const { border, borderWidth, borderStyle, borderColor, ...rest } = maskShellStyle;
  return {
    ...rest,
    overflow: "visible",
  };
}

export function framedHeadingContentLayerStyle(): CSSProperties {
  return {
    position: "relative",
    zIndex: FRAMED_HEADING_CONTENT_Z_INDEX,
    overflow: "visible",
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  };
}

export function FramedHeadingCardShell({
  shellStyle,
  shellSvg,
  children,
  highlightAnim,
}: {
  shellStyle: CSSProperties;
  /** SVG border + interior fill (same stack as rounded rectangle). */
  shellSvg: ReactNode;
  children: ReactNode;
  highlightAnim?: "true";
}) {
  const outerStyle = framedHeadingShellOuterStyle(shellStyle);
  const shellRadius = shellStyle.borderRadius;

  return (
    <div
      className="relative box-border h-full w-full"
      data-dw-highlight-anim={highlightAnim}
      style={outerStyle}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          zIndex: FRAMED_HEADING_SHELL_Z_INDEX,
          borderRadius: shellRadius,
        }}
      >
        {shellSvg}
      </div>
      <div style={framedHeadingContentLayerStyle()}>{children}</div>
    </div>
  );
}
