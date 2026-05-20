"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildIconBevelCornerStack,
  getIconBevelFaceColors,
  getIconBevelGeometry,
  getIconBevelSceneTransform,
  getIconBevelTopFaceInset,
  readIconTileBackgroundHex,
  sampleIconBackgroundColorFromImageSource,
} from "@/lib/icon-bevel";

export interface IconBevelFrameProps {
  size: number;
  rotationDeg?: number;
  gridOffsetDeg?: number;
  depthRatio?: number;
  blockColor?: string;
  /** Sample icon edge / tile background for block + top face colour. */
  matchIconBackground?: boolean;
  transparentTop?: boolean;
  topFaceClassName?: string;
  topFaceStyle?: React.CSSProperties;
  /** Highlight / glow pulse on the tilted tile (not the rectangular node frame). */
  highlightAnimStyle?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(probe);
    probe.onerror = () => resolve(null);
    probe.src = url;
  });
}

/** Decode the full icon bitmap (not the CSS-rounded view) and sample plate colour. */
async function sampleBackgroundColorFromIconRoot(root: HTMLElement | null): Promise<string | null> {
  if (!root || typeof document === "undefined") return null;

  const img = root.querySelector("img");
  if (img) {
    const url = img.currentSrc || img.src;
    if (url) {
      const probe =
        img.complete && img.naturalWidth > 0
          ? img
          : await loadImageFromUrl(url);
      if (probe && probe.naturalWidth > 0) {
        const hex = sampleIconBackgroundColorFromImageSource(
          probe,
          probe.naturalWidth,
          probe.naturalHeight,
        );
        if (hex) return hex;
      }
    }
  }

  const svg = root.querySelector("svg");
  if (svg) {
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const probe = await loadImageFromUrl(url);
      URL.revokeObjectURL(url);
      if (probe && probe.naturalWidth > 0) {
        const hex = sampleIconBackgroundColorFromImageSource(
          probe,
          probe.naturalWidth,
          probe.naturalHeight,
        );
        if (hex) return hex;
      }
    } catch {
      /* fall through */
    }
  }

  return readIconTileBackgroundHex(root.closest(".dw-icon-container") ?? root);
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
  const iconRootRef = useRef<HTMLDivElement>(null);
  const [matchedColor, setMatchedColor] = useState<string | null>(null);

  const resampleMatchedColor = useCallback(() => {
    if (!matchIconBackground) {
      setMatchedColor(null);
      return;
    }
    const root = iconRootRef.current;
    if (!root) return;

    const img = root.querySelector("img");
    if (img && !img.complete) return;

    void sampleBackgroundColorFromIconRoot(root).then((hex) => {
      if (hex) setMatchedColor(hex);
    });
  }, [matchIconBackground]);

  useEffect(() => {
    resampleMatchedColor();
  }, [resampleMatchedColor, children, size, blockColor]);

  useEffect(() => {
    if (!matchIconBackground) return;
    const root = iconRootRef.current;
    const img = root?.querySelector("img");
    if (!img) return;
    const onLoad = () => resampleMatchedColor();
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [matchIconBackground, resampleMatchedColor]);

  const effectiveBlockColor = matchIconBackground ? matchedColor ?? blockColor : blockColor;
  const usesExplicitBlockColor = Boolean(effectiveBlockColor);

  const { rotateX, rotateZ } = getIconBevelSceneTransform(rotationDeg, gridOffsetDeg);
  const { depth, radius, iconClipRadius, pad, perspective } = getIconBevelGeometry(size, depthRatio);
  const colors = getIconBevelFaceColors(effectiveBlockColor ?? undefined);
  const viewport = size + pad * 2 + depth;
  const clipRound = `${iconClipRadius}px`;

  const topBackground =
    transparentTop || matchIconBackground
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
            !usesExplicitBlockColor && !matchIconBackground && topFaceClassName,
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
              ref={iconRootRef}
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
