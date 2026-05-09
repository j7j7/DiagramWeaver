"use client";

import React from "react";
import type { DiagramCompositeBodyShapeKind } from "@/lib/types";
import { CLOUD_SHAPE_PATH_D } from "@/lib/cloud-shape";
import { cn } from "@/lib/utils";

function regularPolygonPoints(cx: number, cy: number, rx: number, ry: number, n: number, rotDeg: number): string {
  const pts: string[] = [];
  const r0 = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const t = r0 + (i * 2 * Math.PI) / n;
    pts.push(`${cx + rx * Math.cos(t)},${cy + ry * Math.sin(t)}`);
  }
  return pts.join(" ");
}

function star5Points(cx: number, cy: number, outerR: number): string {
  const inner = outerR * 0.38;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(" ");
}

export interface CompositeCardSilhouetteProps {
  kind: DiagramCompositeBodyShapeKind;
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Pixel corner radius before clamping (rounded-rectangle / analogous). */
  cornerRadiusPx: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  className?: string;
  style?: React.CSSProperties;
  onPointerDown?: React.PointerEventHandler<SVGElement>;
  onClick?: React.MouseEventHandler<SVGElement>;
  onDoubleClick?: React.MouseEventHandler<SVGElement>;
  onContextMenu?: React.MouseEventHandler<SVGElement>;
}

/**
 * Timeline card hull in diagram SVG space — matches palette “composite body” kinds without changing `generic.object.timeline`.
 */
export function CompositeCardSilhouette({
  kind,
  cx,
  cy,
  w,
  h,
  cornerRadiusPx,
  fill,
  stroke,
  strokeWidth,
  className,
  style,
  onPointerDown,
  onClick,
  onDoubleClick,
  onContextMenu,
}: CompositeCardSilhouetteProps) {
  const halfW = w / 2;
  const halfH = h / 2;
  const sq = Math.min(w, h);
  const sqHalf = sq / 2;

  const common = {
    fill,
    stroke,
    strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
    className: cn(className),
    style,
    onPointerDown,
    onClick,
    onDoubleClick,
    onContextMenu,
  };

  switch (kind) {
    case "rounded-rectangle": {
      const rx = Math.min(cornerRadiusPx, halfW * 0.45, halfH * 0.45);
      return (
        <rect
          x={cx - halfW}
          y={cy - halfH}
          width={w}
          height={h}
          rx={rx}
          ry={rx}
          {...common}
        />
      );
    }
    case "rectangle":
      return <rect x={cx - halfW} y={cy - halfH} width={w} height={h} {...common} />;
    case "square":
      return <rect x={cx - sqHalf} y={cy - sqHalf} width={sq} height={sq} {...common} />;
    case "circle":
      return <circle cx={cx} cy={cy} r={sqHalf} {...common} />;
    case "triangle": {
      const pts = `${cx},${cy - halfH} ${cx - halfW},${cy + halfH} ${cx + halfW},${cy + halfH}`;
      return <polygon points={pts} {...common} />;
    }
    case "hexagon":
      return (
        <polygon
          points={regularPolygonPoints(cx, cy, halfW * 0.92, halfH * 0.92, 6, -90)}
          {...common}
        />
      );
    case "pentagon":
      return (
        <polygon
          points={regularPolygonPoints(cx, cy, halfW * 0.92, halfH * 0.92, 5, -90)}
          {...common}
        />
      );
    case "octagon":
      return (
        <polygon
          points={regularPolygonPoints(cx, cy, halfW * 0.92, halfH * 0.92, 8, -90 + 360 / 16)}
          {...common}
        />
      );
    case "star":
      return (
        <polygon points={star5Points(cx, cy, Math.min(halfW, halfH) * 0.95)} {...common} />
      );
    case "parallelogram": {
      const skew = halfW * 0.28;
      const pts = `${cx - halfW + skew},${cy - halfH} ${cx + halfW + skew},${cy - halfH} ${cx + halfW - skew},${cy + halfH} ${cx - halfW - skew},${cy + halfH}`;
      return <polygon points={pts} {...common} />;
    }
    case "trapezoid": {
      const tw = halfW * 0.62;
      const pts = `${cx - tw},${cy - halfH} ${cx + tw},${cy - halfH} ${cx + halfW},${cy + halfH} ${cx - halfW},${cy + halfH}`;
      return <polygon points={pts} {...common} />;
    }
    case "kite": {
      const pts = `${cx},${cy - halfH} ${cx + halfW * 0.55},${cy} ${cx},${cy + halfH} ${cx - halfW * 0.55},${cy}`;
      return <polygon points={pts} {...common} />;
    }
    case "cloud":
      return (
        <g
          transform={`translate(${cx - halfW},${cy - halfH}) scale(${w / 100},${h / 60})`}
          className={className}
          style={style}
          onPointerDown={onPointerDown as React.PointerEventHandler<SVGGElement>}
          onClick={onClick as React.MouseEventHandler<SVGGElement>}
          onDoubleClick={onDoubleClick as React.MouseEventHandler<SVGGElement>}
          onContextMenu={onContextMenu as React.MouseEventHandler<SVGGElement>}
        >
          <path
            d={CLOUD_SHAPE_PATH_D}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
  }
}