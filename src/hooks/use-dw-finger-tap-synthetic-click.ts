"use client";

import { useCallback, useRef } from "react";

const DEFAULT_MOVE_CANCEL_PX = 14;

/** Touch ends with small movement ⇒ next synthetic `click` gets `dwFingerTap` on the MouseEvent (editor routing). */
export function useDwFingerTapSyntheticClick(moveCancelPx = DEFAULT_MOVE_CANCEL_PX) {
  const touchDownRef = useRef<{ x: number; y: number } | null>(null);
  const fingerTapForNextClickRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchDownRef.current = { x: t.clientX, y: t.clientY };
    fingerTapForNextClickRef.current = false;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      const start = touchDownRef.current;
      if (!t || !start) return;
      if (
        Math.abs(t.clientX - start.x) > moveCancelPx ||
        Math.abs(t.clientY - start.y) > moveCancelPx
      ) {
        touchDownRef.current = null;
      }
    },
    [moveCancelPx],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const changed = e.changedTouches[0];
      const grab = touchDownRef.current;
      touchDownRef.current = null;
      if (!changed || !grab) return;
      const ddx = Math.abs(changed.clientX - grab.x);
      const ddy = Math.abs(changed.clientY - grab.y);
      if (ddx <= moveCancelPx && ddy <= moveCancelPx) {
        fingerTapForNextClickRef.current = true;
      }
    },
    [moveCancelPx],
  );

  const onTouchCancel = useCallback(() => {
    fingerTapForNextClickRef.current = false;
    touchDownRef.current = null;
  }, []);

  const applyFingerTapMarkerToMouseEventIfNeeded = useCallback((evt: React.MouseEvent) => {
    if (!fingerTapForNextClickRef.current) return;
    fingerTapForNextClickRef.current = false;
    (evt as React.MouseEvent & { dwFingerTap?: boolean }).dwFingerTap = true;
  }, []);

  return {
    applyFingerTapMarkerToMouseEventIfNeeded,
    fingerTapTouchSvgProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    } as Pick<
      React.SVGAttributes<SVGGElement>,
      "onTouchStart" | "onTouchMove" | "onTouchEnd" | "onTouchCancel"
    >,
  };
}
