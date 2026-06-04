"use client";

import { useMemo } from "react";
import type { PositionedGroup, PositionedNode } from "@/components/editor/canvas-constants";
import type { DiagramConnectionData } from "@/lib/types";
import {
  computeViewportRenderCull,
  type Transform,
  type ViewportRenderCullResult,
} from "@/lib/viewport-culling";

export interface UseViewportRenderCullParams {
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  connections: DiagramConnectionData[];
  transform: Transform;
  viewportWidth: number;
  viewportHeight: number;
  /** When false, all items and connections render (export, tiny diagrams, etc.). */
  enabled?: boolean;
  forceIncludeItemIds?: Iterable<string>;
  forceIncludeConnectionIndices?: Iterable<number>;
}

export function useViewportRenderCull(params: UseViewportRenderCullParams): ViewportRenderCullResult {
  const {
    nodesById,
    zonesById,
    connections,
    transform,
    viewportWidth,
    viewportHeight,
    enabled = true,
    forceIncludeItemIds,
    forceIncludeConnectionIndices,
  } = params;

  const forceItemKey = forceIncludeItemIds ? [...forceIncludeItemIds].sort().join("\t") : "";
  const forceConnKey = forceIncludeConnectionIndices
    ? [...forceIncludeConnectionIndices].sort((a, b) => a - b).join(",")
    : "";

  return useMemo(
    () =>
      computeViewportRenderCull({
        nodesById,
        zonesById,
        connections,
        transform,
        viewportWidth,
        viewportHeight,
        enabled,
        forceIncludeItemIds,
        forceIncludeConnectionIndices,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable keys for iterables
    [
      nodesById,
      zonesById,
      connections,
      transform.x,
      transform.y,
      transform.k,
      viewportWidth,
      viewportHeight,
      enabled,
      forceItemKey,
      forceConnKey,
    ],
  );
}
