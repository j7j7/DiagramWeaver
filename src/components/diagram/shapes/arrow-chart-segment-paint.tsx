"use client";

import React, { useMemo } from "react";
import type { ArrowLayoutItem } from "@/lib/arrow-chart-layout";
import { buildArrowConicFan } from "@/lib/arrow-chart-paths";

function maskSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function arrowTailBorderMaskId(idBase: string, itemId: string): string {
  return `${idBase}-tbmask-${maskSafeId(itemId)}`;
}

/** Mask for tail-notch borders only (not ring arcs). */
export function ArrowChartTailBorderMaskDefs(props: {
  items: ArrowLayoutItem[];
  idBase: string;
  borderW: number;
  vbW: number;
  vbH: number;
}) {
  const { items, idBase, borderW, vbW, vbH } = props;
  const withTail = items.filter((item) => item.tailBorder);
  if (withTail.length === 0) return null;
  const n = items.length;
  const byIndex = new Map(items.map((item) => [item.index, item]));
  const pad = Math.max(borderW * 2, 4);
  return (
    <defs>
      {withTail.map((item) => {
        const prev = byIndex.get((item.index - 1 + n) % n);
        return (
          <mask
            key={`tbmask-${item.id}`}
            id={arrowTailBorderMaskId(idBase, item.id)}
            maskUnits="userSpaceOnUse"
            x={-pad}
            y={-pad}
            width={vbW + 2 * pad}
            height={vbH + 2 * pad}
          >
            <rect x={-pad} y={-pad} width={vbW + 2 * pad} height={vbH + 2 * pad} fill="black" />
            <path
              d={item.path}
              fill="white"
              stroke="white"
              strokeWidth={borderW}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {prev?.headOverlay ? <path d={prev.headOverlay} fill="black" /> : null}
          </mask>
        );
      })}
    </defs>
  );
}

function SegmentMask(props: {
  id: string;
  path: string;
  paint: ArrowLayoutItem["paint"];
  ringW: number;
  vbW: number;
  vbH: number;
}) {
  const { id, path, paint, ringW, vbW, vbH } = props;
  const strokeArc = paint === "stroke-arc";
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={vbW} height={vbH}>
      <rect x={0} y={0} width={vbW} height={vbH} fill="black" />
      {strokeArc ? (
        <path
          d={path}
          fill="none"
          stroke="white"
          strokeWidth={ringW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path d={path} fill="white" />
      )}
    </mask>
  );
}

export function ArrowChartSegmentGradientDefs(props: {
  items: ArrowLayoutItem[];
  ringW: number;
  vbW: number;
  vbH: number;
  idBase: string;
}) {
  const { items, ringW, vbW, vbH, idBase } = props;
  const gradientItems = items.filter((item) => item.fillStyle === "gradient");
  if (gradientItems.length === 0) return null;
  return (
    <defs>
      {gradientItems.map((item) => {
        const sid = maskSafeId(item.id);
        return (
          <React.Fragment key={`gdef-${item.id}`}>
            <SegmentMask
              id={`${idBase}-b-${sid}`}
              path={item.path}
              paint={item.paint}
              ringW={ringW}
              vbW={vbW}
              vbH={vbH}
            />
            <SegmentMask
              id={`${idBase}-h-${sid}`}
              path={item.headOverlay}
              paint={item.paint}
              ringW={ringW}
              vbW={vbW}
              vbH={vbH}
            />
          </React.Fragment>
        );
      })}
    </defs>
  );
}

export function ArrowSegmentGradientLayer(props: {
  item: ArrowLayoutItem;
  idBase: string;
  layer: "body" | "head";
  cx: number;
  cy: number;
  rFan: number;
  clockwise: boolean;
  opacity?: number;
}) {
  const { item, idBase, layer, cx, cy, rFan, clockwise, opacity } = props;
  const slices = useMemo(() => {
    if (item.fillStyle !== "gradient") return [];
    return buildArrowConicFan({
      cx,
      cy,
      r: rFan,
      from: item.gradFrom,
      to: item.gradTo,
      clockwise,
      colorStart: item.fillStart,
      colorEnd: item.fill,
    });
  }, [
    item.fillStyle,
    item.fillStart,
    item.fill,
    item.gradFrom,
    item.gradTo,
    cx,
    cy,
    rFan,
    clockwise,
  ]);
  if (item.fillStyle !== "gradient" || slices.length === 0) return null;
  const sid = maskSafeId(item.id);
  const maskId = layer === "body" ? `${idBase}-b-${sid}` : `${idBase}-h-${sid}`;
  return (
    <g mask={`url(#${maskId})`} opacity={opacity} pointerEvents="none">
      {slices.map((slice, i) => (
        <path key={i} d={slice.d} fill={slice.color} />
      ))}
    </g>
  );
}
