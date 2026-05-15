"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { ShapeWrapper } from "./shape-wrapper";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { labelToRuns } from "@/lib/rich-text";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import {
  getShapeStyles,
  getTextJustifyClass,
  getTextStylingForNode,
  getVerticalJustifyClass,
} from "./shape-utils";
import { cn } from "@/lib/utils";

export type HeadingEdge = "top" | "bottom" | "left" | "right";

const VIEWBOX_W = 80;
const VIEWBOX_H = 50;
/** Fallback strip size (diagram units) when content measurement is not ready yet */
const HEADING_RATIO = 0.22;

interface TextBoxHeadingShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  tag?: string;
  tagPosition?: string;
  isEditingTag: boolean;
  editTagText: string;
  onTagTextChange: (text: string) => void;
  onTagSubmit: () => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
  label: string;
  isEditingLabel: boolean;
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
  overrideWidth?: number;
  overrideHeight?: number;
  onPatch?: (patch: Partial<DiagramNodeData>) => void;
  isReadOnly?: boolean;
  onDraggingChange?: (dragging: boolean) => void;
}

function nearestHeadingEdge(px: number, py: number, w: number, h: number): HeadingEdge {
  const cx = w / 2;
  const cy = h / 2;
  const dx = px - cx;
  const dy = py - cy;
  const nx = dx / Math.max(w / 2, 1);
  const ny = dy / Math.max(h / 2, 1);
  if (Math.abs(nx) >= Math.abs(ny)) {
    return nx > 0 ? "right" : "left";
  }
  return ny > 0 ? "bottom" : "top";
}

function headingStripThickness(w: number, h: number, edge: HeadingEdge, rx: number, ry: number): number {
  const minR = Math.min(rx, ry) * 1.2;
  // Top/bottom: fraction of height. Left/right: same absolute thickness as horizontal strips (not % of width).
  const base = h * HEADING_RATIO;
  if (edge === "top" || edge === "bottom") {
    return Math.max(base, minR);
  }
  const side = Math.min(base, w * 0.36);
  return Math.max(side, minR);
}

function pathTopStrip(half: number, w: number, h: number, stripH: number, rx: number, ry: number): string {
  const x0 = half;
  const y0 = half;
  const x1 = x0 + w;
  const rb = y0 + stripH;
  return `M ${x0} ${rb} L ${x0} ${y0 + ry} Q ${x0} ${y0} ${x0 + rx} ${y0} L ${x1 - rx} ${y0} Q ${x1} ${y0} ${x1} ${y0 + ry} L ${x1} ${rb} Z`;
}

function pathBottomStrip(half: number, w: number, h: number, stripH: number, rx: number, ry: number): string {
  const x0 = half;
  const y0 = half;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const yt = y1 - stripH;
  return `M ${x0} ${yt} L ${x0} ${y1 - ry} Q ${x0} ${y1} ${x0 + rx} ${y1} L ${x1 - rx} ${y1} Q ${x1} ${y1} ${x1} ${y1 - ry} L ${x1} ${yt} Z`;
}

function pathLeftStrip(half: number, w: number, h: number, stripW: number, rx: number, ry: number): string {
  const x0 = half;
  const y0 = half;
  const y1 = y0 + h;
  const rr = x0 + stripW;
  return `M ${x0} ${y0 + ry} Q ${x0} ${y0} ${x0 + rx} ${y0} L ${rr} ${y0} L ${rr} ${y1} L ${x0 + rx} ${y1} Q ${x0} ${y1} ${x0} ${y1 - ry} Z`;
}

function pathRightStrip(half: number, w: number, h: number, stripW: number, rx: number, ry: number): string {
  const x0 = half;
  const y0 = half;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const rl = x1 - stripW;
  return `M ${rl} ${y0} L ${x1 - rx} ${y0} Q ${x1} ${y0} ${x1} ${y0 + ry} L ${x1} ${y1 - ry} Q ${x1} ${y1} ${x1 - rx} ${y1} L ${rl} ${y1} L ${rl} ${y0} Z`;
}

export function TextBoxHeadingShape(props: TextBoxHeadingShapeProps) {
  const {
    node,
    onPatch,
    isReadOnly,
    onDraggingChange,
    slideColorTransition,
    overrideWidth,
    overrideHeight,
    ...rest
  } = props;
  const nodeAny = node as any;
  const uid = useId().replace(/:/g, "");
  const headingGradId = `dw-hdg-${uid}`;

  const [isEditingHeading, setIsEditingHeading] = useState(false);
  const [editHeadingRuns, setEditHeadingRuns] = useState<RichTextRun[]>([]);
  const [previewEdge, setPreviewEdge] = useState<HeadingEdge | null>(null);
  const [isDraggingHeadingEdge, setIsDraggingHeadingEdge] = useState(false);
  const [headingToolbarHost, setHeadingToolbarHost] = useState<HTMLDivElement | null>(null);
  const previewEdgeRef = useRef<HeadingEdge | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Natural heading block height (or width for side edges) ÷ container size — content-driven, not % of shape height */
  const stripMeasureRef = useRef<HTMLDivElement | null>(null);
  const [stripRatio, setStripRatio] = useState<number | null>(null);

  const shapeStyles = getShapeStyles(node);
  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || "#6b7280"];
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || "#6b7280"];
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || "solid";
  const borderStyle = nodeAny.borderStyle || "solid";

  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth || 2), 10) || 2);
  const half = strokeWidth / 2;

  const w = node.width ?? VIEWBOX_W;
  const h = node.height ?? VIEWBOX_H;
  const minDim = Math.min(w, h);
  const cornerRadius = Math.max(0, Math.min(1, nodeAny.cornerRadius ?? 0.2));
  const maxRadius = minDim / 2;
  const radius = cornerRadius * maxRadius;
  const rx = Math.min(radius, maxRadius);
  const ry = rx;

  const edge: HeadingEdge = previewEdge ?? nodeAny.headingEdge ?? "top";

  const headingRuns = useMemo(
    () => nodeAny.richHeadingLabel ?? labelToRuns(nodeAny.headingLabel ?? ""),
    [nodeAny.richHeadingLabel, nodeAny.headingLabel]
  );

  const headingTextColorResolved = nodeAny.headingTextColor ?? "#ffffff";

  const headingNode: DiagramNodeData = {
    ...node,
    textColor: headingTextColorResolved,
    fontSize: Math.max(10, (nodeAny.fontSize ?? 14) - 2),
    textJustify: "center",
    textVerticalPosition: "middle",
  };

  const runsForStripMeasure = isEditingHeading ? editHeadingRuns : headingRuns;

  const stripThick = (() => {
    const minR = Math.min(rx, ry) * 1.2;
    let t: number;
    if (stripRatio != null && stripRatio > 0) {
      if (edge === "top" || edge === "bottom") {
        t = h * stripRatio;
      } else {
        t = w * stripRatio;
      }
    } else {
      t = headingStripThickness(w, h, edge, rx, ry);
    }
    if (edge === "left" || edge === "right") {
      t = Math.min(t, w * 0.36);
    }
    const maxStrip = edge === "top" || edge === "bottom" ? h - 2 : w - 2;
    return Math.max(Math.min(t, maxStrip), minR);
  })();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = stripMeasureRef.current;
    if (!container || !measure) return;

    const update = () => {
      const ch = container.clientHeight;
      const cw = container.clientWidth;
      const mh = measure.offsetHeight;
      if (edge === "top" || edge === "bottom") {
        if (ch > 0 && mh > 0) {
          const next = mh / ch;
          setStripRatio((prev) => (prev != null && Math.abs(prev - next) < 1e-6 ? prev : next));
        }
      } else if (cw > 0 && mh > 0) {
        const next = mh / cw;
        setStripRatio((prev) => (prev != null && Math.abs(prev - next) < 1e-6 ? prev : next));
      }
    };

    const ro = new ResizeObserver(update);
    ro.observe(container);
    ro.observe(measure);
    update();
    return () => ro.disconnect();
  }, [edge, w, h, isEditingHeading]);

  const headingColor = nodeAny.headingBackgroundColor || "#1f2937";
  const headingBgSolid = nodeAny.headingBackgroundStyle === "solid";

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });

  const fillColor = getShapeSvgFill(backgroundStyle, fillRef, nodeAny.backgroundColor);
  const strokeColor = borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  let headingPath = "";
  if (edge === "top") headingPath = pathTopStrip(half, w, h, stripThick, rx, ry);
  else if (edge === "bottom") headingPath = pathBottomStrip(half, w, h, stripThick, rx, ry);
  else if (edge === "left") headingPath = pathLeftStrip(half, w, h, stripThick, rx, ry);
  else headingPath = pathRightStrip(half, w, h, stripThick, rx, ry);

  let gX1 = "0%";
  let gY1 = "0%";
  let gX2 = "0%";
  let gY2 = "100%";
  if (edge === "top") {
    gX1 = "0%";
    gY1 = "0%";
    gX2 = "0%";
    gY2 = "100%";
  } else if (edge === "bottom") {
    gX1 = "0%";
    gY1 = "100%";
    gX2 = "0%";
    gY2 = "0%";
  } else if (edge === "left") {
    gX1 = "0%";
    gY1 = "0%";
    gX2 = "100%";
    gY2 = "0%";
  } else {
    gX1 = "100%";
    gY1 = "0%";
    gX2 = "0%";
    gY2 = "0%";
  }

  const clipW = overrideWidth ?? w;
  const clipH = overrideHeight ?? h;
  const rxClipPx = Math.min((rx / vbW) * clipW, clipW / 2, clipH / 2);
  const ryClipPx = Math.min((ry / vbH) * clipH, clipW / 2, clipH / 2);

  const stripPct = edge === "top" || edge === "bottom" ? (stripThick / h) * 100 : (stripThick / w) * 100;

  const handleHeadingMouseDown = (e: React.MouseEvent) => {
    if (isReadOnly || !onPatch) return;
    e.stopPropagation();
    e.preventDefault();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const next = nearestHeadingEdge(px, py, rect.width, rect.height);
      previewEdgeRef.current = next;
      setPreviewEdge(next);
    }
    setIsDraggingHeadingEdge(true);
    onDraggingChange?.(true);
  };

  useEffect(() => {
    if (!isDraggingHeadingEdge) return;

    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const next = nearestHeadingEdge(px, py, rect.width, rect.height);
      previewEdgeRef.current = next;
      setPreviewEdge(next);
    };

    const onUp = () => {
      setIsDraggingHeadingEdge(false);
      onDraggingChange?.(false);
      const eEdge = previewEdgeRef.current;
      previewEdgeRef.current = null;
      setPreviewEdge(null);
      if (eEdge != null && onPatch) {
        onPatch({ headingEdge: eEdge });
      }
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
    };
  }, [isDraggingHeadingEdge, onPatch, onDraggingChange]);

  const handleHeadingDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingHeading(true);
    setEditHeadingRuns(nodeAny.richHeadingLabel ?? labelToRuns(nodeAny.headingLabel ?? ""));
  };

  const handleHeadingRichSubmit = useCallback(
    (plainText: string, runs: RichTextRun[]) => {
      onPatch?.({ headingLabel: plainText.trim(), richHeadingLabel: runs });
      setIsEditingHeading(false);
    },
    [onPatch]
  );

  const handleHeadingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditingHeading(false);
      setEditHeadingRuns(nodeAny.richHeadingLabel ?? labelToRuns(nodeAny.headingLabel ?? ""));
    }
  };

  const bodyVertical =
    nodeAny.textVerticalPosition === "top" || nodeAny.textVerticalPosition === "bottom"
      ? nodeAny.textVerticalPosition
      : "middle";

  const headingBoxStyle: React.CSSProperties =
    edge === "top"
      ? { top: 0, left: 0, right: 0, height: `${stripPct}%` }
      : edge === "bottom"
        ? { bottom: 0, left: 0, right: 0, height: `${stripPct}%` }
        : edge === "left"
          ? { top: 0, left: 0, bottom: 0, width: `${stripPct}%` }
          : { top: 0, right: 0, bottom: 0, width: `${stripPct}%` };

  const bodyBoxStyle: React.CSSProperties =
    edge === "top"
      ? { top: `${stripPct}%`, left: 0, right: 0, bottom: 0 }
      : edge === "bottom"
        ? { top: 0, left: 0, right: 0, bottom: `${stripPct}%` }
        : edge === "left"
          ? { top: 0, left: `${stripPct}%`, right: 0, bottom: 0 }
          : { top: 0, left: 0, right: `${stripPct}%`, bottom: 0 };

  const isVerticalHeading = edge === "left" || edge === "right";
  const isEditingAny = isEditingHeading || rest.isEditingLabel;

  return (
    <ShapeWrapper
      node={node}
      defaultWidth={VIEWBOX_W}
      defaultHeight={VIEWBOX_H}
      overrideWidth={overrideWidth}
      overrideHeight={overrideHeight}
      useSvgShadow={shapeStyles.shadow}
      skipWrapperStyling={true}
      slideColorTransition={slideColorTransition}
      omitShapeText
      {...rest}
    >
      <div
        ref={containerRef}
        className={cn("absolute inset-0", isEditingAny ? "overflow-visible" : "overflow-hidden")}
        style={{
          background: "transparent",
          borderRadius: `${rxClipPx}px / ${ryClipPx}px`,
          ...(isEditingAny ? { zIndex: 20 } : {}),
        }}
      >
        {isVerticalHeading && isEditingHeading ? (
          <div
            ref={setHeadingToolbarHost}
            className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2"
          />
        ) : null}
        {/* Hidden: natural heading block size (lines + padding) — drives strip thickness independent of overall shape height */}
        <div
          ref={stripMeasureRef}
          className="pointer-events-none absolute left-0 top-0 -z-10 w-full select-none overflow-hidden opacity-0"
          aria-hidden
        >
          <div
            className={`flex flex-col items-center justify-center overflow-hidden px-1 py-0.5 ${getTextJustifyClass("center")}`}
            style={{
              ...getTextStylingForNode(headingNode),
              color: headingTextColorResolved,
            }}
          >
            <TextboxRichDisplay
              node={headingNode}
              runs={runsForStripMeasure}
              onDoubleClick={() => {}}
              suppressHoverBackground
            />
          </div>
        </div>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 dw-slide-svg-paint-tx"
        >
          {slideColorTransition ? (
            <style>{`
            .dw-slide-svg-paint-tx :is(path, circle, rect, polygon, polyline, line, ellipse, text, tspan) {
              transition: ${slideColorTransition};
            }
          `}</style>
          ) : null}
          {defs}
          <defs>
            <clipPath id={`${uid}-shape-clip`} clipPathUnits="userSpaceOnUse">
              <rect x={half} y={half} width={w} height={h} rx={rx} ry={ry} />
            </clipPath>
            {!headingBgSolid ? (
              <linearGradient id={headingGradId} x1={gX1} y1={gY1} x2={gX2} y2={gY2} gradientUnits="objectBoundingBox">
                <stop offset="0%" stopColor={headingColor} stopOpacity={1} />
                <stop offset="100%" stopColor={headingColor} stopOpacity={0} />
              </linearGradient>
            ) : null}
          </defs>
          <g clipPath={`url(#${uid}-shape-clip)`}>
            <rect
              x={half}
              y={half}
              width={w}
              height={h}
              rx={rx}
              ry={ry}
              fill={fillColor}
            />
            <path
              d={headingPath}
              fill={headingBgSolid ? headingColor : `url(#${headingGradId})`}
            />
          </g>
          <rect
            x={half}
            y={half}
            width={w}
            height={h}
            rx={rx}
            ry={ry}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            {...(strokeWidth > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
          />
        </svg>

        <div
          className={cn(
            "absolute z-[2] pointer-events-auto",
            isEditingHeading ? "cursor-text select-text" : "cursor-move select-none",
            isVerticalHeading ? "flex items-center justify-center overflow-visible" : "flex items-center justify-center px-1 py-0.5"
          )}
          style={headingBoxStyle}
          onMouseDown={isEditingHeading ? undefined : handleHeadingMouseDown}
          onDoubleClick={handleHeadingDoubleClick}
        >
          {isVerticalHeading ? (
            <div
              className="relative flex items-center justify-center overflow-visible"
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              <div
                className="flex min-h-0 min-w-0 items-center justify-center px-1 py-0.5"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: h,
                  height: stripThick,
                  transform: `translate(-50%, -50%) rotate(${edge === "left" ? -90 : 90}deg)`,
                  maxWidth: "none",
                }}
              >
                {isEditingHeading ? (
                  <div className="min-h-0 w-full max-w-full flex-1 overflow-visible">
                    <TextboxRichEditor
                      node={headingNode}
                      runs={editHeadingRuns}
                      onSubmit={handleHeadingRichSubmit}
                      onKeyDown={handleHeadingKeyDown}
                      toolbarPinToShapeTop
                      toolbarPortalHost={headingToolbarHost}
                    />
                  </div>
                ) : (
                  <div
                    className={`flex max-h-full min-h-0 w-full max-w-full flex-1 items-center justify-center overflow-visible ${getTextJustifyClass("center")}`}
                    style={{
                      ...getTextStylingForNode(headingNode),
                      color: headingTextColorResolved,
                    }}
                  >
                    <TextboxRichDisplay
                      node={headingNode}
                      runs={headingRuns}
                      onDoubleClick={handleHeadingDoubleClick}
                      suppressHoverBackground
                    />
                  </div>
                )}
              </div>
            </div>
          ) : isEditingHeading ? (
            <div className="flex min-h-0 w-full max-h-full flex-1 items-center justify-center overflow-visible">
              <TextboxRichEditor
                node={headingNode}
                runs={editHeadingRuns}
                onSubmit={handleHeadingRichSubmit}
                onKeyDown={handleHeadingKeyDown}
              />
            </div>
          ) : (
            <div
              className={`flex max-h-full w-full flex-col items-center justify-center overflow-hidden ${getTextJustifyClass("center")}`}
              style={{
                ...getTextStylingForNode(headingNode),
                color: headingTextColorResolved,
              }}
            >
              <TextboxRichDisplay
                node={headingNode}
                runs={headingRuns}
                onDoubleClick={handleHeadingDoubleClick}
                suppressHoverBackground
              />
            </div>
          )}
        </div>

        <div
          className={`absolute z-[1] flex flex-col px-1 py-1 pointer-events-auto ${getVerticalJustifyClass(bodyVertical)}`}
          style={bodyBoxStyle}
          onDoubleClick={(e) => {
            e.stopPropagation();
            rest.onLabelDoubleClick(e);
          }}
        >
          {rest.isEditingLabel ? (
            <div
              className={`w-full h-full min-h-0 flex flex-col overflow-visible ${getTextJustifyClass(nodeAny.textJustify)} ${getVerticalJustifyClass(bodyVertical)}`}
            >
              <TextboxRichEditor
                node={node}
                runs={rest.editRuns}
                onSubmit={rest.onRichLabelSubmit}
                onKeyDown={rest.onLabelKeyDown}
                onVerticalAlignChange={rest.onVerticalAlignChange}
              />
            </div>
          ) : (
            <div
              className={`w-full flex-1 min-h-0 flex flex-col ${getTextJustifyClass(nodeAny.textJustify)} ${getVerticalJustifyClass(bodyVertical)}`}
              style={getTextStylingForNode(node)}
            >
              <TextboxRichDisplay
                node={node}
                runs={node.richLabel ?? labelToRuns(node.label ?? "")}
                onDoubleClick={rest.onLabelDoubleClick}
              />
            </div>
          )}
        </div>
      </div>
    </ShapeWrapper>
  );
}
