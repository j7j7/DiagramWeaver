"use client";

import React, { useId, useMemo, useState } from "react";
import type { DiagramNodeData, NodeChartSpecGrid, RichTextRun } from "@/lib/types";
import { useThemeMenuHueStepDeg } from "@/hooks/use-theme-menu-hue-step-deg";
import { buildGridChartLayout } from "@/lib/grid-chart-layout";
import { SvgShapeBase } from "./svg-shape-base";
import {
  chartInlineForeignObjectWidth,
  getGradientCoordinates,
  getShapeSvgFill,
  svgForeignObjectInlineInputStyle,
} from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { roundedRectangleMeshGradientSvg, meshGradientHubMarkersSvg } from "@/lib/mesh-gradient";

interface GridChartShapeProps {
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
  onGridCellTextChange?: (cellIndex: number, text: string) => void;
  onGridTitleChange?: (title: string) => void;
  onGridColumnTitleChange?: (colIndex: number, title: string) => void;
  onGridRowTitleChange?: (rowIndex: number, title: string) => void;
}

export function GridChartShape(props: GridChartShapeProps) {
  const {
    isReadOnly = false,
    showMeshGradientHubIndicators = false,
    onGridCellTextChange,
    onGridTitleChange,
    onGridColumnTitleChange,
    onGridRowTitleChange,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const nodeAny = node as unknown as Record<string, unknown>;
  const chartRaw = node.chart;
  const chartBase: NodeChartSpecGrid =
    chartRaw?.kind === "grid"
      ? chartRaw
      : { kind: "grid", cols: 4, rows: 4, cells: [] };

  const hueStepDeg = useThemeMenuHueStepDeg();
  const layout = useMemo(
    () => buildGridChartLayout(node, chartBase, { hueStepDeg }),
    [node, chartBase, hueStepDeg]
  );

  const [editingCellIndex, setEditingCellIndex] = useState<number | null>(null);
  const [editingCellDraft, setEditingCellDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState<"chart" | "col" | "row" | null>(null);
  const [editingTitleIndex, setEditingTitleIndex] = useState(-1);
  const [editingTitleDraft, setEditingTitleDraft] = useState("");

  const backgroundColors = (nodeAny.backgroundColors as string[]) || [
    (nodeAny.backgroundColor as string) || "#6b7280",
  ];
  const borderColors = (nodeAny.borderColors as string[]) || [
    (nodeAny.borderColor as string) || "#6b7280",
  ];
  const gradientAngle = (nodeAny.gradientAngle as number) || 135;
  const borderGradientAngle = (nodeAny.borderGradientAngle as number) ?? gradientAngle;
  const backgroundStyle = (nodeAny.backgroundStyle as string) || "solid";
  const borderStyle = (nodeAny.borderStyle as string) || "solid";
  const isMesh = backgroundStyle === "mesh_gradient";
  const strokeWidth = layout.strokeWidth;
  const { body } = layout;

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });

  const fillColor = getShapeSvgFill(backgroundStyle, fillRef, nodeAny.backgroundColor as string);
  const strokeColor =
    borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor as string) || "#6b7280";
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  const meshUidBase = `dw-gc-${useId().replace(/:/g, "")}`;
  const gradBaseId = `dw-gc-g-${useId().replace(/:/g, "")}`;
  const meshPaint = useMemo(() => {
    if (!isMesh) return { defs: null as React.ReactNode, fillClipGroup: null as React.ReactNode };
    return roundedRectangleMeshGradientSvg({
      uidBase: meshUidBase,
      innerX: body.x,
      innerY: body.y,
      innerW: body.w,
      innerH: body.h,
      rx: body.rx,
      ry: body.ry,
      baseColor: (nodeAny.backgroundColor as string) || "#6b7280",
      points: nodeAny.meshGradientPoints as Parameters<typeof roundedRectangleMeshGradientSvg>[0]["points"],
    });
  }, [isMesh, meshUidBase, body, nodeAny.backgroundColor, nodeAny.meshGradientPoints]);

  const meshHubMarkers = meshGradientHubMarkersSvg({
    show: Boolean(isMesh && showMeshGradientHubIndicators),
    points: nodeAny.meshGradientPoints as Parameters<typeof meshGradientHubMarkersSvg>[0]["points"],
    baseColor: (nodeAny.backgroundColor as string) || "#6b7280",
    innerX: body.x,
    innerY: body.y,
    innerW: body.w,
    innerH: body.h,
  });

  const gradientAngleNode = node.gradientAngle ?? 135;
  const gradCoords = getGradientCoordinates(gradientAngleNode);
  const canEditCell = !isReadOnly && !!onGridCellTextChange;
  const canEditChartTitle = !isReadOnly && !!onGridTitleChange;
  const canEditColTitle = !isReadOnly && !!onGridColumnTitleChange;
  const canEditRowTitle = !isReadOnly && !!onGridRowTitleChange;

  const cellGradients = layout.cells.map((cell, i) =>
    cell.fillMode === "gradient" ? (
      <linearGradient
        key={`cg-${i}`}
        id={`${gradBaseId}-${i}`}
        x1={gradCoords.x1}
        y1={gradCoords.y1}
        x2={gradCoords.x2}
        y2={gradCoords.y2}
        gradientUnits="objectBoundingBox"
      >
        <stop offset="0%" stopColor={cell.gradientColor1} />
        <stop offset="100%" stopColor={cell.gradientColor2} />
      </linearGradient>
    ) : null
  );

  const gridContent = (
    <>
      {defs}
      {meshPaint.defs}
      {isMesh ? (
        <>
          {meshPaint.fillClipGroup}
          <rect
            x={body.x}
            y={body.y}
            width={body.w}
            height={body.h}
            rx={body.rx}
            ry={body.ry}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            {...(strokeWidth > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
          />
          {meshHubMarkers}
        </>
      ) : (
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
          {...(strokeWidth > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
        />
      )}
      <g pointerEvents="none">
        {layout.gridLines.map((ln, i) => (
          <line
            key={`gl-${i}`}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke={layout.gridLineColor}
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {layout.cells.map((cell, i) => {
        const fill =
          cell.fillMode === "none"
            ? "transparent"
            : cell.fillMode === "gradient"
              ? `url(#${gradBaseId}-${i})`
              : cell.solidFill;
        return (
          <rect
            key={`cell-${i}`}
            x={cell.x}
            y={cell.y}
            width={cell.size}
            height={cell.size}
            fill={fill}
            rx={Math.min(cell.size * 0.12, 3)}
            ry={Math.min(cell.size * 0.12, 3)}
            pointerEvents="none"
          />
        );
      })}
      {layout.title && editingTitle === "chart" ? (
        <foreignObject
          x={layout.title.x - 80}
          y={layout.title.y - layout.title.fontSize}
          width={160}
          height={layout.title.fontSize * 2}
          style={{ overflow: "visible", pointerEvents: "auto" }}
        >
          <input
            type="text"
            spellCheck
            className="m-0 w-full box-border bg-transparent text-center shadow-none focus:outline-none"
            style={svgForeignObjectInlineInputStyle({
              fontSize: layout.title.fontSize,
              fontWeight: 600,
              color: layout.titleColor,
              caretColor: layout.titleColor,
              textAlign: "center",
            })}
            value={editingTitleDraft}
            autoFocus
            onChange={(e) => setEditingTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                onGridTitleChange?.(editingTitleDraft.trim());
                setEditingTitle(null);
              } else if (e.key === "Escape") setEditingTitle(null);
            }}
            onBlur={() => {
              onGridTitleChange?.(editingTitleDraft.trim());
              setEditingTitle(null);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </foreignObject>
      ) : layout.title ? (
        <text
          x={layout.title.x}
          y={layout.title.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={layout.titleColor}
          fontSize={layout.title.fontSize}
          fontWeight={600}
          pointerEvents={canEditChartTitle ? "auto" : "none"}
          style={{ cursor: canEditChartTitle ? "text" : undefined }}
          onDoubleClick={(e) => {
            if (!canEditChartTitle) return;
            e.stopPropagation();
            setEditingTitleDraft(layout.title!.text);
            setEditingTitle("chart");
          }}
        >
          {layout.title.text}
        </text>
      ) : null}
      {layout.columnTitles.map((ct, ci) =>
        editingTitle === "col" && editingTitleIndex === ci ? (
          <foreignObject
            key={`ct-edit-${ci}`}
            x={ct.x - 40}
            y={ct.y - ct.fontSize}
            width={80}
            height={ct.fontSize * 2}
            style={{ overflow: "visible", pointerEvents: "auto" }}
          >
            <input
              type="text"
              className="m-0 w-full box-border bg-transparent text-center shadow-none focus:outline-none"
              style={svgForeignObjectInlineInputStyle({
                fontSize: ct.fontSize,
                fontWeight: 500,
                color: layout.axisColor,
                caretColor: layout.axisColor,
                textAlign: "center",
              })}
              value={editingTitleDraft}
              autoFocus
              onChange={(e) => setEditingTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  onGridColumnTitleChange?.(ci, editingTitleDraft.trim());
                  setEditingTitle(null);
                } else if (e.key === "Escape") setEditingTitle(null);
              }}
              onBlur={() => {
                onGridColumnTitleChange?.(ci, editingTitleDraft.trim());
                setEditingTitle(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </foreignObject>
        ) : (
          <text
            key={`ct-${ci}`}
            x={ct.x}
            y={ct.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={layout.axisColor}
            fontSize={ct.fontSize}
            pointerEvents={canEditColTitle ? "auto" : "none"}
            style={{ cursor: canEditColTitle ? "text" : undefined }}
            onDoubleClick={(e) => {
              if (!canEditColTitle) return;
              e.stopPropagation();
              setEditingTitleDraft(ct.text);
              setEditingTitleIndex(ci);
              setEditingTitle("col");
            }}
          >
            {ct.text}
          </text>
        )
      )}
      {layout.rowTitles.map((rt, ri) =>
        editingTitle === "row" && editingTitleIndex === ri ? (
          <foreignObject
            key={`rt-edit-${ri}`}
            x={rt.x - 36}
            y={rt.y - rt.fontSize}
            width={72}
            height={rt.fontSize * 2}
            style={{ overflow: "visible", pointerEvents: "auto" }}
          >
            <input
              type="text"
              className="m-0 w-full box-border bg-transparent text-center shadow-none focus:outline-none"
              style={svgForeignObjectInlineInputStyle({
                fontSize: rt.fontSize,
                fontWeight: 500,
                color: layout.axisColor,
                caretColor: layout.axisColor,
                textAlign: "center",
              })}
              value={editingTitleDraft}
              autoFocus
              onChange={(e) => setEditingTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  onGridRowTitleChange?.(ri, editingTitleDraft.trim());
                  setEditingTitle(null);
                } else if (e.key === "Escape") setEditingTitle(null);
              }}
              onBlur={() => {
                onGridRowTitleChange?.(ri, editingTitleDraft.trim());
                setEditingTitle(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </foreignObject>
        ) : (
          <text
            key={`rt-${ri}`}
            x={rt.x}
            y={rt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={layout.axisColor}
            fontSize={rt.fontSize}
            pointerEvents={canEditRowTitle ? "auto" : "none"}
            style={{ cursor: canEditRowTitle ? "text" : undefined }}
            onDoubleClick={(e) => {
              if (!canEditRowTitle) return;
              e.stopPropagation();
              setEditingTitleDraft(rt.text);
              setEditingTitleIndex(ri);
              setEditingTitle("row");
            }}
          >
            {rt.text}
          </text>
        )
      )}
      {layout.cells.map((cell, i) => {
        if (!cell.text) return null;
        const fontSize = Math.min(cell.size * 0.38, 12);
        if (editingCellIndex === i) {
          const foW = chartInlineForeignObjectWidth({
            charCount: Math.max(4, editingCellDraft.length, cell.text.length),
            fontSize,
          });
          return (
            <foreignObject
              key={`cell-t-${i}`}
              x={cell.x + (cell.size - foW) / 2}
              y={cell.y + (cell.size - fontSize) / 2}
              width={foW}
              height={fontSize * 1.2}
              style={{ overflow: "visible", pointerEvents: "auto" }}
            >
              <input
                type="text"
                className="m-0 w-full box-border bg-transparent text-center shadow-none focus:outline-none"
                style={svgForeignObjectInlineInputStyle({
                  fontSize,
                  fontWeight: 600,
                  color: cell.labelColor,
                  caretColor: cell.labelColor,
                  textAlign: "center",
                })}
                value={editingCellDraft}
                autoFocus
                onChange={(e) => setEditingCellDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    onGridCellTextChange?.(i, editingCellDraft.trim());
                    setEditingCellIndex(null);
                  } else if (e.key === "Escape") setEditingCellIndex(null);
                }}
                onBlur={() => {
                  onGridCellTextChange?.(i, editingCellDraft.trim());
                  setEditingCellIndex(null);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </foreignObject>
          );
        }
        return (
          <text
            key={`cell-t-${i}`}
            x={cell.x + cell.size / 2}
            y={cell.y + cell.size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={cell.labelColor}
            fontSize={fontSize}
            fontWeight={600}
            pointerEvents={canEditCell ? "auto" : "none"}
            style={{
              cursor: canEditCell ? "text" : undefined,
              textShadow: "0 0 2px rgba(0,0,0,0.35)",
            }}
            onDoubleClick={(e) => {
              if (!canEditCell) return;
              e.stopPropagation();
              setEditingCellDraft(cell.text);
              setEditingCellIndex(i);
            }}
          >
            {cell.text}
          </text>
        );
      })}
      <defs>{cellGradients}</defs>
    </>
  );

  return (
    <SvgShapeBase
      {...svgBaseProps}
      defaultWidth={320}
      defaultHeight={260}
      viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
      frostedClipRectInViewBox={{ x: body.x, y: body.y, w: body.w, h: body.h, rx: body.rx, ry: body.ry }}
      slideColorTransition={slideColorTransition}
      svgContent={gridContent}
    />
  );
}
