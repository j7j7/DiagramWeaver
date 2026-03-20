"use client";

import React, { createContext, useContext, useMemo } from "react";

export type SlideShapeShadowMode = "none" | "crossfade";

const SlideShapeShadowTransitionContext = createContext<SlideShapeShadowMode>("none");

/** `animationStyle` slice needed to detect stacked gradient crossfade layers. */
export type SlideShapeShadowAnimationStyle = {
  visualColorCrossfade?: unknown;
} | undefined;

export function getSlideShapeShadowMode(
  animationStyle: SlideShapeShadowAnimationStyle,
): SlideShapeShadowMode {
  return animationStyle?.visualColorCrossfade ? "crossfade" : "none";
}

export function SlideShapeShadowTransitionProvider({
  animationStyle,
  children,
}: {
  animationStyle: SlideShapeShadowAnimationStyle;
  children: React.ReactNode;
}) {
  const mode = useMemo(
    () => getSlideShapeShadowMode(animationStyle),
    [animationStyle],
  );

  return (
    <SlideShapeShadowTransitionContext.Provider value={mode}>
      {children}
    </SlideShapeShadowTransitionContext.Provider>
  );
}

export function useSlideShapeShadowTransitionMode(): SlideShapeShadowMode {
  return useContext(SlideShapeShadowTransitionContext);
}
