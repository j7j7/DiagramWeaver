"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { DiagramData, Slide } from "@/lib/types";
import type { Transform } from "@/hooks/use-canvas-transform";
import {
  computeSlidePlaybackTransform,
  computeUnionFitTransformForDiagrams,
} from "@/lib/presentation-viewport-fit";

const PLAYBACK_CAMERA_DURATION_MS = 300;

interface UsePresentationPlaybackCameraOptions {
  enabled: boolean;
  useSlideZoom: boolean;
  slideIndex: number;
  currentSlide: Pick<Slide, "id" | "autoZoomLevel" | "viewPanX" | "viewPanY"> | null;
  renderedDiagram: DiagramData | null;
  slideDiagramsForUnionFit: DiagramData[];
  /** When both are zero, falls back to `window` inner size (fullscreen play mode). */
  viewportWidth: number;
  viewportHeight: number;
  transform: Transform;
  setTransform: (transform: Transform) => void;
  /** When this changes, the next camera apply snaps instantly (e.g. deck switch). */
  instantApplyRevision?: unknown;
}

export function usePresentationPlaybackCamera({
  enabled,
  useSlideZoom,
  slideIndex,
  currentSlide,
  renderedDiagram,
  slideDiagramsForUnionFit,
  viewportWidth,
  viewportHeight,
  transform,
  setTransform,
  instantApplyRevision,
}: UsePresentationPlaybackCameraOptions) {
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const skipLerpRef = useRef(true);
  const lerpCleanupRef = useRef<(() => void) | null>(null);
  const prevUseSlideZoomRef = useRef(useSlideZoom);
  const prevViewportRef = useRef({ w: viewportWidth, h: viewportHeight });

  const cancelLerp = useCallback(() => {
    lerpCleanupRef.current?.();
    lerpCleanupRef.current = null;
  }, []);

  const resolveViewportSize = useCallback(() => {
    if (viewportWidth > 0 && viewportHeight > 0) {
      return { width: viewportWidth, height: viewportHeight };
    }
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  }, [viewportWidth, viewportHeight]);

  const computeTarget = useCallback((): Transform | null => {
    const { width, height } = resolveViewportSize();
    if (width <= 0 || height <= 0) return null;
    if (useSlideZoom) {
      if (!currentSlide || !renderedDiagram) return null;
      return computeSlidePlaybackTransform(currentSlide, renderedDiagram, width, height);
    }
    if (slideDiagramsForUnionFit.length === 0) return null;
    return computeUnionFitTransformForDiagrams(slideDiagramsForUnionFit, width, height);
  }, [useSlideZoom, currentSlide, renderedDiagram, slideDiagramsForUnionFit, resolveViewportSize]);

  const animateTo = useCallback(
    (target: Transform, instant = false) => {
      cancelLerp();
      if (instant || skipLerpRef.current) {
        setTransform(target);
        transformRef.current = target;
        skipLerpRef.current = false;
        return;
      }

      const start = { ...transformRef.current };
      let alive = true;
      const easeOut = (t: number) => 1 - (1 - t) ** 3;
      const startTime = performance.now();

      const tick = (now: number) => {
        if (!alive) return;
        const elapsed = now - startTime;
        const u = Math.min(1, elapsed / PLAYBACK_CAMERA_DURATION_MS);
        const e = easeOut(u);
        const next = {
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          k: start.k + (target.k - start.k) * e,
        };
        setTransform(next);
        transformRef.current = next;
        if (u < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      lerpCleanupRef.current = () => {
        alive = false;
      };
    },
    [cancelLerp, setTransform]
  );

  const applyCamera = useCallback(
    (instant = false) => {
      const target = computeTarget();
      if (!target) return;
      animateTo(target, instant);
    },
    [animateTo, computeTarget]
  );

  useEffect(() => {
    skipLerpRef.current = true;
  }, [instantApplyRevision]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const prev = prevViewportRef.current;
    if (prev.w !== viewportWidth || prev.h !== viewportHeight) {
      if (prev.w > 0 && prev.h > 0) {
        skipLerpRef.current = true;
      }
      prevViewportRef.current = { w: viewportWidth, h: viewportHeight };
    }
  }, [enabled, viewportWidth, viewportHeight]);

  useEffect(() => {
    if (!enabled) {
      skipLerpRef.current = true;
      cancelLerp();
      return;
    }
    applyCamera();
    return cancelLerp;
  }, [
    enabled,
    useSlideZoom,
    slideIndex,
    currentSlide?.id,
    currentSlide?.autoZoomLevel,
    currentSlide?.viewPanX,
    currentSlide?.viewPanY,
    renderedDiagram,
    slideDiagramsForUnionFit,
    viewportWidth,
    viewportHeight,
    applyCamera,
    cancelLerp,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => {
      if (useSlideZoom) return;
      skipLerpRef.current = true;
      applyCamera(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, useSlideZoom, applyCamera]);

  useEffect(() => {
    if (useSlideZoom && !prevUseSlideZoomRef.current) {
      skipLerpRef.current = true;
    }
    if (!useSlideZoom && prevUseSlideZoomRef.current) {
      skipLerpRef.current = true;
    }
    prevUseSlideZoomRef.current = useSlideZoom;
  }, [useSlideZoom]);

  return {
    applyCamera,
    skipNextLerp: () => {
      skipLerpRef.current = true;
    },
  };
}
