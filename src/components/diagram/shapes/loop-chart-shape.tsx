"use client";

import React, { useMemo, useRef, useState } from "react";
import type { DiagramNodeData, NodeChartSpecLoop, RichTextRun } from "@/lib/types";
import { useGlobalProperties, useGlobalVariableContext } from "@/components/diagram/global-properties-context";
import { labelToRuns, normalizeRuns } from "@/lib/rich-text";
import { resolveGlobalVariablesInRuns } from "@/lib/global-properties";
import { buildGridChartInlineTextNode } from "@/lib/grid-chart-rich-node";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import {
  buildLoopChartLayout,
  formatLoopArrowHeadPoints,
  loopItemRotateTransform,
  loopItemRotation,
  loopItemSlotIndexFromAngle,
  type LoopLayoutItem,
} from "@/lib/loop-chart-layout";
import { defaultLoopChartSpec } from "@/lib/chart-node";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { getHighlightAnimStyleForNode, mergeCardShellHighlightStyle } from "@/lib/highlight-anim";

type EditSlot =
  | { kind: "hub-title" }
  | { kind: "hub-subtitle" }
  | { kind: "item-title"; id: string }
  | { kind: "item-subtitle"; id: string }
  | { kind: "spoke"; id: string };

interface LoopChartShapeProps {
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
  loopInteractive?: boolean;
  onLoopDragSessionChange?: (active: boolean) => void;
  onMoveLoopItem?: (fromIndex: number, toIndex: number) => void;
  onLoopHubChange?: (plainTitle: string, titleRuns: RichTextRun[], plainSubtitle: string, subtitleRuns: RichTextRun[]) => void;
  onLoopItemTextChange?: (
    itemId: string,
    field: "title" | "subtitle" | "spokeLabel",
    plainText: string,
    runs: RichTextRun[]
  ) => void;
}

export function LoopChartShape(props: LoopChartShapeProps) {
  const {
    isReadOnly = false,
    loopInteractive = false,
    showMeshGradientHubIndicators: _hub = false,
    onLoopDragSessionChange,
    onMoveLoopItem,
    onLoopHubChange,
    onLoopItemTextChange,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const nodeAny = node as unknown as Record<string, unknown>;
  const chartBase: NodeChartSpecLoop =
    node.chart?.kind === "loop" ? node.chart : defaultLoopChartSpec();
  const variableContext = useGlobalVariableContext();
  const globalProperties = useGlobalProperties();
  const layout = useMemo(() => buildLoopChartLayout(node, chartBase), [node, chartBase]);
  const { body, hub } = layout;
  const canEdit = !isReadOnly && Boolean(onLoopItemTextChange || onLoopHubChange);
  const canReorder = loopInteractive && Boolean(onMoveLoopItem);
  const [edit, setEdit] = useState<EditSlot | null>(null);
  const [editRuns, setEditRuns] = useState<RichTextRun[]>([]);
  const [reorderTarget, setReorderTarget] = useState<number | null>(null);
  const [dragAngle, setDragAngle] = useState<number | null>(null);
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
  const preserveShellHalo = loopInteractive || !!shellHighlightStyle;

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
    if (slot.kind === "hub-title") {
      onLoopHubChange?.(
        plainText.trim(),
        norm,
        chartBase.subtitle ?? "",
        chartBase.richSubtitle ?? labelToRuns(chartBase.subtitle ?? "")
      );
      return;
    }
    if (slot.kind === "hub-subtitle") {
      onLoopHubChange?.(
        chartBase.title ?? "",
        chartBase.richTitle ?? labelToRuns(chartBase.title ?? ""),
        plainText.trim(),
        norm
      );
      return;
    }
    const field =
      slot.kind === "item-title" ? "title" : slot.kind === "item-subtitle" ? "subtitle" : "spokeLabel";
    onLoopItemTextChange?.(slot.id, field, plainText.trim(), norm);
  };

  const renderText = (opts: {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    runs: RichTextRun[];
    slot: EditSlot;
    color: string;
    fontSize: number;
    weight?: number;
    transform?: string;
  }) => {
    const editingThis =
      edit != null &&
      ((opts.slot.kind === "hub-title" && edit.kind === "hub-title") ||
        (opts.slot.kind === "hub-subtitle" && edit.kind === "hub-subtitle") ||
        (edit.kind === opts.slot.kind &&
          "id" in edit &&
          "id" in opts.slot &&
          edit.id === opts.slot.id));
    const textCaptures = editingThis;
    const displayRuns = resolveGlobalVariablesInRuns(opts.runs, globalProperties, variableContext);
    const textNode = buildGridChartInlineTextNode(node, {
      labelColor: opts.color,
      fontSize: opts.fontSize,
      textAlign: "center",
      fontWeight: opts.weight ?? 600,
    });
    return (
      <g key={opts.key}>
        <foreignObject
          x={opts.x}
          y={opts.y}
          width={Math.max(4, opts.w)}
          height={Math.max(4, opts.h)}
          style={{ overflow: editingThis ? "visible" : "hidden", pointerEvents: textCaptures ? "auto" : "none" }}
        >
          <div
            className="flex h-full w-full flex-col items-center justify-center"
            style={{ textTransform: opts.transform as React.CSSProperties["textTransform"] }}
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
    onLoopDragSessionChange?.(true);
    const pt = svgUserPointFromClient(svg, clientX, clientY);
    if (!pt) return;
    const angle = Math.atan2(pt.y - layout.cy, pt.x - layout.cx);
    const target = loopItemSlotIndexFromAngle(angle, layout.items.length);
    drag.target = target;
    setReorderTarget(target);
    setDragAngle(angle);
  };

  const onItemPointerDown = (index: number) => (e: React.PointerEvent<SVGRectElement>) => {
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

  const onItemPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!reorderRef.current) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (svg) applyReorderPointer(e.clientX, e.clientY, svg);
  };

  const endItemReorder = (e: React.PointerEvent) => {
    const drag = reorderRef.current;
    reorderRef.current = null;
    const from = drag?.from ?? -1;
    const to = drag?.target ?? from;
    const moved = Boolean(drag?.moved);
    setReorderTarget(null);
    setDragAngle(null);
    setDragFrom(null);
    onLoopDragSessionChange?.(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (moved && from >= 0 && from !== to) onMoveLoopItem?.(from, to);
  };

  const itemAtAngle = (item: LoopLayoutItem, angle: number): LoopLayoutItem => {
    const ix = layout.cx + layout.radius * Math.cos(angle);
    const iy = layout.cy + layout.radius * Math.sin(angle);
    return {
      ...item,
      angle,
      rotation: loopItemRotation(angle, layout.rotateItems),
      cx: ix,
      cy: iy,
      x: ix - item.w / 2,
      y: iy - item.h / 2,
    };
  };

  const draggingFrom = dragFrom;

  const svgContent = (
    <>
      {gradDefs}
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
      {layout.loopArrows.map((arrow, i) => (
        <g key={`arc-${i}`}>
          <path
            d={arrow.d}
            fill="none"
            stroke={layout.arrowColor}
            strokeWidth={layout.arrowWidth}
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={formatLoopArrowHeadPoints(
              arrow.head.x,
              arrow.head.y,
              arrow.head.angle,
              layout.arrowHeadSize
            )}
            fill={layout.arrowColor}
          />
        </g>
      ))}
      {layout.showInwardArrows
        ? layout.spokes.map((spoke) => {
            const item = layout.items[spoke.itemIndex];
            const inwardStroke = layout.arrowWidth * 0.9;
            return (
              <g key={`spoke-${spoke.itemIndex}`}>
                <line
                  x1={spoke.x1}
                  y1={spoke.y1}
                  x2={spoke.x2}
                  y2={spoke.y2}
                  stroke={layout.inwardArrowColor}
                  strokeWidth={inwardStroke}
                  strokeDasharray={`${layout.arrowWidth * 3.2} ${layout.arrowWidth * 2.2}`}
                  strokeLinecap="butt"
                  vectorEffect="non-scaling-stroke"
                />
                <polygon
                  points={formatLoopArrowHeadPoints(
                    spoke.tipX,
                    spoke.tipY,
                    spoke.headAngle,
                    layout.inwardArrowHeadSize
                  )}
                  fill={layout.inwardArrowColor}
                />
                {spoke.label && item
                  ? renderText({
                      key: `spoke-lbl-${item.id}`,
                      x: spoke.label.x - 36,
                      y: spoke.label.y - 8,
                      w: 72,
                      h: 16,
                      runs: runsFor(spoke.label.text, chartBase.items[spoke.itemIndex]?.richSpokeLabel),
                      slot: { kind: "spoke", id: item.id },
                      color: layout.spokeLabelColor,
                      fontSize: Math.max(7, item.subtitleFont),
                      weight: 600,
                      transform: "uppercase",
                    })
                  : null}
              </g>
            );
          })
        : null}
      <g>
        <rect
          x={hub.x}
          y={hub.y}
          width={hub.w}
          height={hub.h}
          rx={hub.rx}
          ry={hub.rx}
          fill={layout.hubFill}
          stroke={layout.hubBorder}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          onDoubleClick={(e) => {
            if (!canEdit) return;
            e.stopPropagation();
            e.preventDefault();
            setEditRuns(runsFor(layout.title, chartBase.richTitle));
            setEdit({ kind: "hub-title" });
          }}
        />
        {renderText({
          key: "hub-title",
          x: hub.x + 6,
          y: hub.y + hub.h * 0.12,
          w: hub.w - 12,
          h: hub.h * 0.48,
          runs: runsFor(layout.title, chartBase.richTitle),
          slot: { kind: "hub-title" },
          color: layout.hubTextColor,
          fontSize: layout.titleFont,
          weight: 700,
        })}
        {renderText({
          key: "hub-sub",
          x: hub.x + 6,
          y: hub.y + hub.h * 0.52,
          w: hub.w - 12,
          h: hub.h * 0.38,
          runs: runsFor(layout.subtitle, chartBase.richSubtitle),
          slot: { kind: "hub-subtitle" },
          color: layout.hubTextColor,
          fontSize: layout.subtitleFont,
          weight: 500,
        })}
      </g>
      {layout.items.map((raw, i) => {
        const item =
          draggingFrom === i && dragAngle != null ? itemAtAngle(raw, dragAngle) : raw;
        const isTarget = reorderTarget === i && draggingFrom != null && draggingFrom !== i;
        return (
          <g key={item.id}>
            {isTarget ? (
              <g transform={loopItemRotateTransform(raw)} pointerEvents="none">
                <rect
                  x={raw.x - 3}
                  y={raw.y - 3}
                  width={raw.w + 6}
                  height={raw.h + 6}
                  rx={raw.rx + 2}
                  fill="hsl(var(--primary) / 0.12)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : null}
            <g transform={loopItemRotateTransform(item)}>
            <rect
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              rx={item.rx}
              fill={item.fill}
              stroke={item.border}
              strokeWidth={1.15}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: canReorder ? "grab" : undefined, touchAction: "none" }}
              onPointerDown={onItemPointerDown(i)}
              onPointerMove={onItemPointerMove}
              onPointerUp={endItemReorder}
              onPointerCancel={endItemReorder}
              onDoubleClick={(e) => {
                if (!canEdit) return;
                e.stopPropagation();
                e.preventDefault();
                reorderRef.current = null;
                setReorderTarget(null);
                setDragAngle(null);
                setDragFrom(null);
                setEditRuns(runsFor(item.title, chartBase.items[i]?.richTitle));
                setEdit({ kind: "item-title", id: item.id });
              }}
            />
            {renderText({
              key: `t-${item.id}`,
              x: item.x + 4,
              y: item.y + item.h * 0.08,
              w: item.w - 8,
              h: item.h * 0.5,
              runs: runsFor(item.title, chartBase.items[i]?.richTitle),
              slot: { kind: "item-title", id: item.id },
              color: item.textColor,
              fontSize: item.titleFont,
              weight: 700,
            })}
            {renderText({
              key: `s-${item.id}`,
              x: item.x + 4,
              y: item.y + item.h * 0.52,
              w: item.w - 8,
              h: item.h * 0.4,
              runs: runsFor(item.subtitle, chartBase.items[i]?.richSubtitle),
              slot: { kind: "item-subtitle", id: item.id },
              color: item.textColor,
              fontSize: item.subtitleFont,
              weight: 500,
            })}
            </g>
          </g>
        );
      })}
    </>
  );

  return (
    <div
      data-dw-loop-chart-shell=""
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
        defaultWidth={520}
        defaultHeight={520}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
        borderRadius={shellBorderRadius}
        frostedClipRectInViewBox={{ x: body.x, y: body.y, w: body.w, h: body.h, rx: body.rx, ry: body.ry }}
        slideColorTransition={slideColorTransition}
        svgOverflowVisible={loopInteractive}
        preserveShellHalo={preserveShellHalo}
        omitShapeText
        svgContent={svgContent}
      />
    </div>
  );
}
