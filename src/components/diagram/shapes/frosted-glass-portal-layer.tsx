"use client";

import React, { useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { FrostedGlassParams } from "./shape-utils";
import {
  getFrostedGlassBackdropLayerStyle,
  getFrostedGlassDropShadowLayerStyle,
  getFrostedGrainOverlayStyle,
  getFrostedFineGrainOverlayStyle,
  getFrostedGlassTopEdgeHighlightStyle,
  getFrostedGlassLeftEdgeHighlightStyle,
} from "./shape-utils";

const FROSTED_PORTAL_MOUNT_ID = "dw-frosted-root";

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FrostedGlassPortalLayerProps = {
  glass: FrostedGlassParams;
  zIndex: number;
  targetRef: React.RefObject<HTMLElement | null>;
  borderRadius: string;
  /** CSS `clip-path` basic shape (`inset(...)`, `polygon(...)`, …) aligned to the SVG fill. */
  clipPath?: string;
  panZoom?: { x: number; y: number; k: number };
  canvasContainerRef?: React.RefObject<HTMLElement | null>;
  /**
   * When the node moves/resizes/rotates, `getBoundingClientRect` changes but `ResizeObserver` does not fire.
   * Pass a string that changes with diagram `x`/`y` (and size/rotation when relevant) so the portal re-measures.
   */
  layoutSyncKey: string;
};

/**
 * Viewport-fixed portal under `#dw-frosted-root` (fallback `document.body`) so `backdrop-filter`
 * escapes the pan/zoom `transform` subtree. Position tracks the shape via `getBoundingClientRect()`.
 *
 * (Portaling into `[data-diagram-layer]` was reverted: Chromium often applies no visible backdrop blur there.)
 */
export function FrostedGlassPortalLayer({
  glass,
  zIndex,
  targetRef,
  borderRadius,
  clipPath: clipPathCss,
  panZoom,
  canvasContainerRef,
  layoutSyncKey,
}: FrostedGlassPortalLayerProps) {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const update = () => {
      const t = targetRef.current;
      if (!t) return;
      const tr = t.getBoundingClientRect();
      setBox({
        left: tr.left,
        top: tr.top,
        width: tr.width,
        height: tr.height,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const canvasEl =
      canvasContainerRef?.current ??
      (typeof document !== "undefined" ? document.getElementById("canvas-container") : null);
    const roCanvas = canvasEl ? new ResizeObserver(update) : null;
    if (canvasEl && roCanvas) roCanvas.observe(canvasEl);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      roCanvas?.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [targetRef, panZoom?.x, panZoom?.y, panZoom?.k, canvasContainerRef, layoutSyncKey]);

  if (typeof document === "undefined" || !box) return null;

  const zi = typeof zIndex === "number" && Number.isFinite(zIndex) ? zIndex : 2;
  /** Below shadcn `z-50`; slight spread from `stackZIndex` for multiple frosted nodes (capped &lt; 50). */
  const z = Math.min(49, 46 + (zi % 4));

  const surfaceKey = `${glass.blurPx}-${glass.saturation}-${glass.fillRgba}-${glass.glassBoxShadow}`;

  const mount =
    typeof document !== "undefined"
      ? (document.getElementById(FROSTED_PORTAL_MOUNT_ID) ?? document.body)
      : null;
  if (!mount) return null;

  const clipStyle: CSSProperties | undefined = clipPathCss
    ? { clipPath: clipPathCss, WebkitClipPath: clipPathCss }
    : undefined;

  return createPortal(
    <div
      data-dw-frosted-glass-portal
      style={{
        position: "fixed",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: z,
        borderRadius: clipPathCss ? 0 : borderRadius,
        pointerEvents: "none",
      }}
    >
      {/*
        Shadow and backdrop are split: Chromium often disables blur when `box-shadow` (esp. inset)
        shares the same element as `backdrop-filter`. Mount under `#dw-frosted-root` + no `overflow`
        on `body` so `body` is not a backdrop-root that blocks sampling.
        Apply the same clip-path on each layer so triangles/polygons match the SVG fill.
      */}
      <div style={{ ...getFrostedGlassDropShadowLayerStyle(glass), ...clipStyle }} aria-hidden />
      <div key={surfaceKey} style={{ ...getFrostedGlassBackdropLayerStyle(glass), ...clipStyle }} aria-hidden />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 2,
          ...clipStyle,
        }}
        aria-hidden
      >
        <div style={getFrostedGrainOverlayStyle(glass.grainOpacity)} aria-hidden />
        <div style={getFrostedFineGrainOverlayStyle(glass.grainOpacity)} aria-hidden />
      </div>
      <div style={{ ...getFrostedGlassTopEdgeHighlightStyle(), ...clipStyle }} aria-hidden />
      <div style={{ ...getFrostedGlassLeftEdgeHighlightStyle(), ...clipStyle }} aria-hidden />
    </div>,
    mount
  );
}
