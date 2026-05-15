"use client";

import { useId, useMemo } from "react";
import type React from "react";
import { clippedMeshGradientSvg, meshGradientHubMarkersSvg } from "@/lib/mesh-gradient";
import { boundingBoxFromSvgPolygonPointsString, polygonToRoundedPath } from "./shape-utils";

export function usePolygonMeshGradientLayers(opts: {
  isMesh: boolean;
  showMeshGradientHubIndicators?: boolean;
  nodeAny: Record<string, unknown>;
  transformedPoints: string;
  roundedEdges: boolean;
  vbW: number;
  vbH: number;
}): {
  meshDefs: React.ReactNode | null;
  meshFillClip: React.ReactNode | null;
  meshHubMarkers: React.ReactNode | null;
} {
  const meshUidBase = `dw-poly-${useId().replace(/:/g, "")}`;
  const bbox = useMemo(
    () => boundingBoxFromSvgPolygonPointsString(opts.transformedPoints),
    [opts.transformedPoints],
  );

  const meshPaint = useMemo(() => {
    if (!opts.isMesh) return { defs: null as React.ReactNode | null, fillClipGroup: null as React.ReactNode | null };
    const clip = opts.roundedEdges ? (
      <path d={polygonToRoundedPath(opts.transformedPoints, undefined, [opts.vbW, opts.vbH])} />
    ) : (
      <polygon points={opts.transformedPoints} />
    );
    const baseCol = (opts.nodeAny.backgroundColor as string) || "#6b7280";
    return clippedMeshGradientSvg({
      uidBase: meshUidBase,
      innerX: bbox.x,
      innerY: bbox.y,
      innerW: bbox.w,
      innerH: bbox.h,
      baseColor: baseCol,
      points: opts.nodeAny.meshGradientPoints,
      clipPathChildren: clip,
    });
  }, [
    opts.isMesh,
    meshUidBase,
    bbox.x,
    bbox.y,
    bbox.w,
    bbox.h,
    opts.nodeAny.backgroundColor,
    opts.nodeAny.meshGradientPoints,
    opts.transformedPoints,
    opts.roundedEdges,
    opts.vbW,
    opts.vbH,
  ]);

  const meshHubMarkers = meshGradientHubMarkersSvg({
    show: Boolean(opts.isMesh && opts.showMeshGradientHubIndicators),
    points: opts.nodeAny.meshGradientPoints,
    baseColor: (opts.nodeAny.backgroundColor as string) || "#6b7280",
    innerX: bbox.x,
    innerY: bbox.y,
    innerW: bbox.w,
    innerH: bbox.h,
  });

  return {
    meshDefs: opts.isMesh ? meshPaint.defs : null,
    meshFillClip: opts.isMesh ? meshPaint.fillClipGroup : null,
    meshHubMarkers,
  };
}
