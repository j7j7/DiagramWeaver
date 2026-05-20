"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildIconBevelCornerStack,
  getIconBevelFaceColors,
  getIconBevelGeometry,
  getIconBevelSceneTransform,
  getIconBevelTopFaceInset,
  sampleIconPlateColorFromUrl,
} from "@/lib/icon-bevel";

/** Resolve plate colour from the source image before the bevel frame mounts. */
export function useIconBevelPlateColor(enabled: boolean, sampleSrc?: string): string | undefined {
  const [color, setColor] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !sampleSrc) {
      setColor(undefined);
      return;
    }
    let cancelled = false;
    void sampleIconPlateColorFromUrl(sampleSrc).then((hex) => {
      if (!cancelled && hex) setColor(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, sampleSrc]);

  return enabled ? color : undefined;
}

export interface IconBevelTileProps extends Omit<IconBevelFrameProps, "blockColor" | "matchIconBackground"> {
  matchIconBackground?: boolean;
  iconBevelBlockColor?: string;
  iconSampleSrc?: string;
}

/** Samples plate colour from `iconSampleSrc`, then renders the bevel frame. */
export function IconBevelTile({
  matchIconBackground = false,
  iconBevelBlockColor,
  iconSampleSrc,
  children,
  ...frameProps
}: IconBevelTileProps) {
  const plateColor = useIconBevelPlateColor(Boolean(matchIconBackground), iconSampleSrc);
  const blockColor = matchIconBackground
    ? iconBevelBlockColor ?? plateColor
    : iconBevelBlockColor;

  return (
    <IconBevelFrame
      {...frameProps}
      blockColor={blockColor}
      matchIconBackground={matchIconBackground}
    >
      {children}
    </IconBevelFrame>
  );
}

export interface IconBevelFrameProps {
  size: number;
  rotationDeg?: number;
  gridOffsetDeg?: number;
  depthRatio?: number;
  blockColor?: string;
  /** When true, top face is transparent once `blockColor` is set (colour sampled upstream). */
  matchIconBackground?: boolean;
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
  matchIconBackground = false,
  transparentTop = false,
  topFaceClassName,
  topFaceStyle,
  highlightAnimStyle,
  className,
  children,
}: IconBevelFrameProps) {
  const usesExplicitBlockColor = Boolean(blockColor && String(blockColor).trim());

  const { rotateX, rotateZ } = getIconBevelSceneTransform(rotationDeg, gridOffsetDeg);
  const { depth, radius, iconClipRadius, pad, perspective } = getIconBevelGeometry(size, depthRatio);
  const colors = getIconBevelFaceColors(usesExplicitBlockColor ? blockColor : undefined);
  const viewport = size + pad * 2 + depth;
  const clipRound = `${iconClipRadius}px`;

  const topBackground = transparentTop
    ? "transparent"
    : usesExplicitBlockColor || !topFaceClassName
      ? colors.topGradient
      : undefined;

  const cornerStack = buildIconBevelCornerStack(depth, colors);
  const faceShadow = [cornerStack, transparentTop ? null : getIconBevelTopFaceInset()]
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
            "flex items-center justify-center box-content overflow-hidden",
            !usesExplicitBlockColor && topFaceClassName,
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
            <div
              className="dw-icon-bevel-clip flex h-full w-full items-center justify-center overflow-hidden [&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:rounded-[inherit] [&_img]:object-cover [&_svg]:h-full [&_svg]:w-full [&_svg]:rounded-[inherit]"
              style={{
                width: size,
                height: size,
                borderRadius: iconClipRadius,
                clipPath: `inset(0 round ${clipRound})`,
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
