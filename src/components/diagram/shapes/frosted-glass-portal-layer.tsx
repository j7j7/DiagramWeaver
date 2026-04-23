"use client";

import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FrostedGlassParams } from "./shape-utils";
import { getFrostedGlassSurfaceStyle } from "./shape-utils";

type Box = { left: number; top: number; width: number; height: number };

type FrostedGlassPortalLayerProps = {
  glass: FrostedGlassParams;
  zIndex: number;
  targetRef: React.RefObject<HTMLElement | null>;
  borderRadius: string;
  /** Optional clip; matches the in-tree shape clip (e.g. SVG frosted). */
  clipPath?: string;
};

/**
 * Renders frosted glass as `position: fixed` (default host: `#canvas-container`), matching the
 * shape’s viewport box. Pan/zoom `transform` on `data-diagram-layer` makes in-tree
 * `backdrop-filter` only sample that subtree (often the dot grid). Porting out of that layer
 * restores realistic blur; host stays under the diagram so z-order vs nodes remains correct.
 */
export function FrostedGlassPortalLayer({ glass, zIndex, targetRef, borderRadius, clipPath }: FrostedGlassPortalLayerProps) {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [targetRef, glass, clipPath, borderRadius, zIndex]);

  if (typeof document === "undefined" || !box) return null;

  // Keep under the pannable `data-diagram-layer` (z-index 1) so nodes/icons stay visible;
  // still escape that layer’s `transform` so `backdrop-filter` blurs the real viewport.
  const portalHost = document.getElementById("canvas-container") ?? document.body;

  return createPortal(
    <div
      data-dw-frosted-glass-portal
      style={{
        position: "fixed",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: 0,
        borderRadius,
        pointerEvents: "none",
        overflow: "hidden",
        ...(clipPath ? { clipPath } : {}),
      }}
    >
      <div style={getFrostedGlassSurfaceStyle(glass)} aria-hidden />
    </div>,
    portalHost
  );
}
