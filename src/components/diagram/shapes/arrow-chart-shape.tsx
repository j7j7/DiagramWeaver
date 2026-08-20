"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import type { DiagramNodeData, NodeChartSpecArrow, RichTextRun } from "@/lib/types";
import { useGlobalProperties, useGlobalVariableContext } from "@/components/diagram/global-properties-context";
import { labelToRuns, normalizeRuns } from "@/lib/rich-text";
import { resolveGlobalVariablesInRuns } from "@/lib/global-properties";
import { buildGridChartInlineTextNode } from "@/lib/grid-chart-rich-node";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import {
  arrowItemRotateTransform,
  arrowSegmentSlotIndexFromAngle,
  buildArrowChartLayout,
  type ArrowLayoutItem,
} from "@/lib/arrow-chart-layout";
import { defaultArrowChartSpec } from "@/lib/chart-node";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeStyles, getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { getHighlightAnimStyleForNode, mergeCardShellHighlightStyle } from "@/lib/highlight-anim";
import {
  ArrowChartSegmentGradientDefs,
  ArrowChartTailBorderMaskDefs,
  ArrowSegmentGradientLayer,
  arrowTailBorderMaskId,
} from "./arrow-chart-segment-paint";

type EditSlot = { kind: "title"; id: string } | { kind: "subtitle"; id: string };

interface ArrowChartShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  showMeshGradientHubIndicators?: boolean;
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
  isReadOnly?: boolean;
  arrowInteractive?: boolean;
  onArrowDragSessionChange?: (active: boolean) => void;
  onMoveArrowItem?: (fromIndex: number, toIndex: number) => void;
  onArrowItemTextChange?: (
    itemId: string,
    field: "title" | "subtitle",
    plainText: string,
    runs: RichTextRun[]
  ) => void;
}

export function ArrowChartShape(props: ArrowChartShapeProps) {
  const {
    isReadOnly = false,
    arrowInteractive = false,
    showMeshGradientHubIndicators: _hub = false,
    onArrowDragSessionChange,
    onMoveArrowItem,
    onArrowItemTextChange,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const nodeAny = node as unknown as Record<string, unknown>;
  const chartBase: NodeChartSpecArrow =
    node.chart?.kind === "arrow" ? node.chart : defaultArrowChartSpec();
  const variableContext = useGlobalVariableContext();
  const globalProperties = useGlobalProperties();
  const layout = useMemo(() => buildArrowChartLayout(node, chartBase), [node, chartBase]);
  const { body } = layout;
  const gradIdBase = `dw-arw-${useId().replace(/:/g, "")}`;
  const canEdit = !isReadOnly && Boolean(onArrowItemTextChange);
  const canReorder = arrowInteractive && Boolean(onMoveArrowItem);
  const [edit, setEdit] = useState<EditSlot | null>(null);
  const [editRuns, setEditRuns] = useState<RichTextRun[]>([]);
  const [reorderTarget, setReorderTarget] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const reorderRef = useRef<{
    from: number;
    originX: number;
    originY: number;
    moved: boolean;
    target: number;
  } | null>(null);

  const backgroundStyle = (nodeAny.backgroundStyle as string) || "none";
  const borderStyle = (nodeAny.borderStyle as string) || "none";
  const backgroundColors = (nodeAny.backgroundColors as string[]) || [
    (nodeAny.backgroundColor as string) || "#ffffff",
  ];
  const borderColors = (nodeAny.borderColors as string[]) || [
    (nodeAny.borderColor as string) || "#e5e7eb",
  ];
  const gradientAngle = (nodeAny.gradientAngle as number) || 180;
  const { defs: gradDefs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? gradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });
  const fillColor = getShapeSvgFill(
    backgroundStyle,
    fillRef,
    nodeAny.backgroundColor as string,
    "transparent"
  );
  const strokeColor =
    borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor as string) || "#e5e7eb";
  const strokeWidth = borderStyle === "none" ? 0 : Number(nodeAny.borderWidth) || 1;
  const strokeDasharray = borderStyle === "dotted" ? "4 3" : undefined;
  const shellHighlightStyle = getHighlightAnimStyleForNode(
    node as DiagramNodeData & { x: number; y: number },
    {
      isLineNode: false,
      isDuplicateDragPreview: false,
      positionX: node.x ?? 0,
      positionY: node.y ?? 0,
      roundedShellGlow: true,
    }
  );
  const shellBorderRadius = `${Math.max(0, body.rx)}px`;
  const hasVisualShadow = getShapeStyles(node).shadow;
  const preserveShellHalo = arrowInteractive || !!shellHighlightStyle || hasVisualShadow;

  const runsFor = (plain: string, rich?: RichTextRun[]) => {
    const resolved = rich?.length
      ? resolveGlobalVariablesInRuns(rich, globalProperties, variableContext)
      : labelToRuns(plain);
    return resolved;
  };

  const finishEdit = (plainText: string, runs: RichTextRun[]) => {
    const slot = edit;
    setEdit(null);
    if (!slot) return;
    const norm = normalizeRuns(runs);
    onArrowItemTextChange?.(slot.id, slot.kind, plainText.trim(), norm);
  };

  const renderText = (opts: {
    key: string;
    item: ArrowLayoutItem;
    w: number;
    h: number;
    yOff: number;
    runs: RichTextRun[];
    slot: EditSlot;
    fontSize: number;
    weight?: number;
  }) => {
    const editingThis =
      edit != null && edit.kind === opts.slot.kind && edit.id === opts.slot.id;
    const displayRuns = resolveGlobalVariablesInRuns(opts.runs, globalProperties, variableContext);
    const textNode = buildGridChartInlineTextNode(node, {
      labelColor: opts.item.textColor,
      fontSize: opts.fontSize,
      textAlign: "center",
      fontWeight: opts.weight ?? 600,
    });
    return (
      <g key={opts.key} transform={arrowItemRotateTransform(opts.item)}>
        <foreignObject
          x={opts.item.textX}
          y={opts.item.textY + opts.yOff}
          width={Math.max(4, opts.w)}
          height={Math.max(4, opts.h)}
          style={{ overflow: editingThis ? "visible" : "hidden", pointerEvents: editingThis ? "auto" : "none" }}
        >
          <div
            className="flex h-full w-full flex-col items-center justify-center"
            onPointerDown={(e) => {
              if (editingThis) e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              if (!canEdit || editingThis) return;
              e.stopPropagation();
              e.preventDefault();
              setEditRuns(opts.runs);
              setEdit(opts.slot);
            }}
          >
            {editingThis ? (
              <div className="relative min-h-0 w-full flex-1 overflow-visible" onPointerDown={(e) => e.stopPropagation()}>
                <TextboxRichEditor
                  node={textNode}
                  runs={editRuns}
                  onSubmit={finishEdit}
                  toolbarFixedToViewport
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEdit(null);
                    }
                  }}
                />
              </div>
            ) : (
              <TextboxRichDisplay
                node={textNode}
                runs={displayRuns}
                suppressHoverBackground
                pointerEventsNone
                onDoubleClick={(e) => {
                  if (!canEdit) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setEditRuns(opts.runs);
                  setEdit(opts.slot);
                }}
              />
            )}
          </div>
        </foreignObject>
      </g>
    );
  };

  const applyReorderPointer = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const drag = reorderRef.current;
    if (!drag) return;
    const dx = clientX - drag.originX;
    const dy = clientY - drag.originY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    setDragFrom(drag.from);
    onArrowDragSessionChange?.(true);
    const pt = svgUserPointFromClient(svg, clientX, clientY);
    if (!pt) return;
    const angle = Math.atan2(pt.y - layout.cy, pt.x - layout.cx);
    const target = arrowSegmentSlotIndexFromAngle(angle, layout.items.length, layout.clockwise);
    drag.target = target;
    setReorderTarget(target);
  };

  const onSegPointerDown = (index: number) => (e: React.PointerEvent<SVGPathElement>) => {
    if (!canReorder || edit) return;
    e.stopPropagation();
    reorderRef.current = {
      from: index,
      originX: e.clientX,
      originY: e.clientY,
      moved: false,
      target: index,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSegPointerMove = (e: React.PointerEvent<SVGPathElement>) => {
    if (!reorderRef.current) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (svg) applyReorderPointer(e.clientX, e.clientY, svg);
  };

  const endSegReorder = (e: React.PointerEvent) => {
    const drag = reorderRef.current;
    reorderRef.current = null;
    const from = drag?.from ?? -1;
    const to = drag?.target ?? from;
    const moved = Boolean(drag?.moved);
    setReorderTarget(null);
    setDragFrom(null);
    onArrowDragSessionChange?.(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (moved && from >= 0 && from !== to) onMoveArrowItem?.(from, to);
  };

  const bodyOrder = [...layout.items].reverse();
  const borderW = layout.segmentBorderWidth;
  const borderColor = layout.segmentBorder;
  const ringW = layout.rOuter - layout.rInner;

  const svgContent = (
    <>
      {gradDefs}
      <ArrowChartSegmentGradientDefs
        items={layout.items}
        ringW={ringW}
        vbW={layout.vbW}
        vbH={layout.vbH}
        idBase={gradIdBase}
      />
      <ArrowChartTailBorderMaskDefs
        items={layout.items}
        idBase={gradIdBase}
        borderW={borderW}
        vbW={layout.vbW}
        vbH={layout.vbH}
      />
      <rect
        x={body.x}
        y={body.y}
        width={body.w}
        height={body.h}
        rx={body.rx}
        ry={body.ry}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        vectorEffect="non-scaling-stroke"
      />
      {bodyOrder.map((item) => {
        const dim = dragFrom === item.index || reorderTarget === item.index;
        const strokeArc = item.paint === "stroke-arc";
        const gradient = item.fillStyle === "gradient";
        const dimOp = dim ? 0.72 : 1;
        return (
          <g key={`seg-${item.id}`}>
            {strokeArc && borderW > 0 ? (
              <path
                d={item.path}
                fill="none"
                stroke={borderColor}
                strokeWidth={ringW + 2 * borderW}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={dimOp}
                pointerEvents="none"
              />
            ) : null}
            {gradient ? (
              <ArrowSegmentGradientLayer
                item={item}
                idBase={gradIdBase}
                layer="body"
                cx={layout.cx}
                cy={layout.cy}
                rFan={layout.rFan}
                clockwise={layout.clockwise}
                opacity={dimOp}
              />
            ) : null}
            <path
              d={item.path}
              fill={strokeArc ? "none" : gradient ? "transparent" : item.fill}
              stroke={strokeArc ? (gradient ? "transparent" : item.fill) : "none"}
              strokeWidth={strokeArc ? ringW : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={gradient ? 1 : dimOp}
              style={{ cursor: canReorder ? "grab" : canEdit ? "text" : undefined }}
              onPointerDown={onSegPointerDown(item.index)}
              onPointerMove={onSegPointerMove}
              onPointerUp={endSegReorder}
              onPointerCancel={endSegReorder}
              onDoubleClick={(e) => {
                if (!canEdit || edit) return;
                e.stopPropagation();
                e.preventDefault();
                const src = chartBase.items[item.index];
                setEditRuns(runsFor(item.title, src?.richTitle));
                setEdit({ kind: "title", id: item.id });
              }}
            />
          </g>
        );
      })}
      {borderW > 0
        ? bodyOrder.map((item) =>
            item.paint === "fill" ? (
              <path
                key={`seg-b-${item.id}`}
                d={item.bodyBorder ?? item.path}
                fill="none"
                stroke={borderColor}
                strokeWidth={borderW}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={dragFrom === item.index || reorderTarget === item.index ? 0.72 : 1}
                pointerEvents="none"
              />
            ) : null
          )
        : null}
      {borderW > 0
        ? bodyOrder.map((item) =>
            item.tailBorder ? (
              <path
                key={`tail-b-${item.id}`}
                d={item.tailBorder}
                mask={`url(#${arrowTailBorderMaskId(gradIdBase, item.id)})`}
                fill="none"
                stroke={borderColor}
                strokeWidth={borderW}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={dragFrom === item.index || reorderTarget === item.index ? 0.72 : 1}
                pointerEvents="none"
              />
            ) : null
          )
        : null}
      {layout.items.map((item) => {
        const strokeArc = item.paint === "stroke-arc";
        const gradient = item.fillStyle === "gradient";
        const dimOp = dragFrom === item.index || reorderTarget === item.index ? 0.72 : 1;
        if (gradient) {
          return (
            <ArrowSegmentGradientLayer
              key={`head-${item.id}`}
              item={item}
              idBase={gradIdBase}
              layer="head"
              cx={layout.cx}
              cy={layout.cy}
              rFan={layout.rFan}
              clockwise={layout.clockwise}
              opacity={dimOp}
            />
          );
        }
        return (
          <path
            key={`head-${item.id}`}
            d={item.headOverlay}
            fill={strokeArc ? "none" : item.fill}
            stroke={strokeArc ? item.fill : "none"}
            strokeWidth={strokeArc ? ringW : undefined}
            strokeLinecap={strokeArc ? "round" : undefined}
            strokeLinejoin={strokeArc ? "round" : undefined}
            opacity={dimOp}
            pointerEvents="none"
          />
        );
      })}
      {borderW > 0
        ? layout.items.map((item) =>
            item.paint === "fill" ? (
              <path
                key={`head-b-${item.id}`}
                d={item.headBorder}
                fill="none"
                stroke={borderColor}
                strokeWidth={borderW}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={dragFrom === item.index || reorderTarget === item.index ? 0.72 : 1}
                pointerEvents="none"
              />
            ) : null
          )
        : null}
      {borderW > 0
        ? layout.items.map((item) =>
            item.paint === "stroke-arc" ? (
              <path
                key={`rim-${item.id}`}
                d={item.headRim}
                fill="none"
                stroke={borderColor}
                strokeWidth={borderW}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
              />
            ) : null
          )
        : null}
      {layout.items.map((item, i) => {
        const hasSub = Boolean(item.subtitle.trim());
        const titleH = hasSub ? item.textH * 0.55 : item.textH;
        const src = chartBase.items[i];
        return (
          <g key={`lbl-${item.id}`}>
            {renderText({
              key: `t-${item.id}`,
              item,
              w: item.textW,
              h: titleH,
              yOff: hasSub ? -item.textH * 0.08 : 0,
              runs: runsFor(item.title, src?.richTitle),
              slot: { kind: "title", id: item.id },
              fontSize: item.titleFont,
              weight: 700,
            })}
            {hasSub
              ? renderText({
                  key: `s-${item.id}`,
                  item,
                  w: item.textW,
                  h: item.textH * 0.4,
                  yOff: item.textH * 0.42,
                  runs: runsFor(item.subtitle, src?.richSubtitle),
                  slot: { kind: "subtitle", id: item.id },
                  fontSize: item.subtitleFont,
                  weight: 500,
                })
              : null}
          </g>
        );
      })}
    </>
  );

  return (
    <div
      data-dw-arrow-chart-shell=""
      data-dw-highlight-anim={shellHighlightStyle ? "true" : undefined}
      className="relative box-border h-full w-full"
      style={{
        borderRadius: shellBorderRadius,
        overflow: preserveShellHalo ? "visible" : "hidden",
        ...mergeCardShellHighlightStyle(shellHighlightStyle, undefined),
      }}
    >
      <SvgShapeBase
        {...svgBaseProps}
        defaultWidth={480}
        defaultHeight={480}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
        borderRadius={shellBorderRadius}
        frostedClipRectInViewBox={{ x: body.x, y: body.y, w: body.w, h: body.h, rx: body.rx, ry: body.ry }}
        slideColorTransition={slideColorTransition}
        svgOverflowVisible={arrowInteractive || hasVisualShadow}
        preserveShellHalo={preserveShellHalo}
        omitShapeText
        svgContent={svgContent}
      />
    </div>
  );
}
