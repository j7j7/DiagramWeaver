"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  buildIconBevelCornerStack,
  getIconBevelFaceColors,
  getIconBevelGeometry,
  getIconBevelSceneTransform,
  getIconBevelTopFaceInset,
} from "@/lib/icon-bevel";

export interface IconBevelFrameProps {
  size: number;
  rotationDeg?: number;
  gridOffsetDeg?: number;
  depthRatio?: number;
  blockColor?: string;
  transparentTop?: boolean;
  topFaceClassName?: string;
  topFaceStyle?: React.CSSProperties;
  /** Highlight / glow pulse on the tilted tile (not the rectangular node frame). */
  highlightAnimStyle?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

/**
 * One tile element: thick bottom/right borders become visible side faces when the
 * group is tilted in 3D (reliable across browsers). A light diagonal shadow stack
 * softens rounded corners. Icon and block always share the same transform.
 */
export function IconBevelFrame({
  size,
  rotationDeg,
  gridOffsetDeg,
  depthRatio,
  blockColor,
  transparentTop = false,
  topFaceClassName,
  topFaceStyle,
  highlightAnimStyle,
  className,
  children,
}: IconBevelFrameProps) {
  const { rotateX, rotateZ } = getIconBevelSceneTransform(rotationDeg, gridOffsetDeg);
  const { depth, radius, pad, perspective } = getIconBevelGeometry(size, depthRatio);
  const colors = getIconBevelFaceColors(blockColor);
  const viewport = size + pad * 2 + depth;

  const topBackground = transparentTop
    ? "transparent"
    : blockColor || !topFaceClassName
      ? colors.topGradient
      : undefined;

  const cornerStack = buildIconBevelCornerStack(depth, colors);
  const faceShadow = [
    cornerStack,
    transparentTop ? null : getIconBevelTopFaceInset(),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{
        width: viewport,
        height: viewport,
        perspective: `${perspective}px`,
        perspectiveOrigin: "50% 46%",
        filter: `drop-shadow(0 ${Math.round(depth * 1)}px ${Math.round(depth * 2.2)}px ${colors.groundShadow})`,
      }}
    >
      <div
        data-dw-highlight-anim={highlightAnimStyle ? "true" : undefined}
        style={{
          transform: `rotateX(${rotateX}deg) rotateZ(${rotateZ}deg)`,
          transformStyle: "preserve-3d",
          ...highlightAnimStyle,
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center box-content",
            !blockColor && topFaceClassName,
          )}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            background: topBackground,
            borderStyle: "solid",
            borderTopColor: colors.edgeHighlight,
            borderLeftColor: colors.edgeHighlight,
            borderBottomColor: colors.sideFront,
            borderRightColor: colors.sideRight,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderBottomWidth: depth,
            borderRightWidth: depth,
            boxShadow: faceShadow || undefined,
            ...topFaceStyle,
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: size,
              height: size,
              filter:
                "drop-shadow(0 2px 2px rgba(0,0,0,0.16)) drop-shadow(0 4px 8px rgba(0,0,0,0.1))",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
