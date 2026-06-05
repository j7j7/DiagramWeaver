"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChartGridCell, DiagramNodeData, NodeChartSpecGrid, RichTextRun } from "@/lib/types";
import { useThemeMenuHueStepDeg } from "@/hooks/use-theme-menu-hue-step-deg";
import {
  useGlobalProperties,
  useGlobalVariableContext,
} from "@/components/diagram/global-properties-context";
import { labelToRuns, normalizeRuns, getPlainTextFromRuns } from "@/lib/rich-text";
import { resolveGlobalVariablesInRuns } from "@/lib/global-properties";
import {
  buildGridChartInlineTextNode,
  gridChartCellRunsCentered,
} from "@/lib/grid-chart-rich-node";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import { DEFAULT_PIE_SLICE_COLORS } from "@/lib/chart-node";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import {
  adjustGridColumnTracksGrowContainer,
  adjustGridRowTracksGrowContainer,
  computeGridChartPlotInsets,
  gridChartTrackPixelSizesFromEdges,
  solveGridChartNodeHeightForPlotH,
  solveGridChartNodeWidthForPlotW,
  buildGridChartLayout,
  gridCellCornerRx,
  isGridCellFilled,
  nextGridCellAfterPaintClick,
  resolveGridDefaultCellFill,
  TRACK_EDGE_HIT_PAD,
  type GridChartLayoutCell,
} from "@/lib/grid-chart-layout";
import {
  chartSegmentPopAnimationStyle,
  chartSegmentPopKeyframesCss,
  gridChartCellSlideStagger,
  gridChartShellPopAnimationStyle,
  type ChartSlideStagger,
} from "@/lib/chart-presentation-stagger";
import {
  gridCellStaggerRankByIndex,
  lerpGridChartLayoutCells,
  parseGridChartLerpSnapshot,
} from "@/lib/grid-chart-slide-lerp";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates, getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { roundedRectangleMeshGradientSvg, meshGradientHubMarkersSvg } from "@/lib/mesh-gradient";
import { getHighlightAnimStyleForNode, mergeCardShellHighlightStyle } from "@/lib/highlight-anim";
import { GridChartStructureChrome } from "./grid-chart-structure-chrome";

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
  /** When true (grid chart selected), cells are hover-highlighted and click-to-paint enabled. */
  gridCellPaintInteractive?: boolean;
  /** When true (grid selected), internal column/row boundaries can be dragged. */
  gridTrackResizeInteractive?: boolean;
  /** Row/column delete, reorder, and add handles outside the chart body. */
  gridStructureInteractive?: boolean;
  onGridStructureDragSessionChange?: (active: boolean) => void;
  onGridTrackDragSessionChange?: (active: boolean) => void;
  onDeleteGridRow?: (rowIndex: number) => void;
  onDeleteGridColumn?: (colIndex: number) => void;
  onMoveGridRow?: (fromRow: number, toRow: number) => void;
  onMoveGridColumn?: (fromCol: number, toCol: number) => void;
  onInsertGridRow?: (atRow: number) => void;
  onInsertGridColumn?: (atCol: number) => void;
  onColumnTrackResize?: (payload: { columnWeights: number[]; width: number }) => void;
  onRowTrackResize?: (payload: { rowWeights: number[]; height: number }) => void;
  onGridCellPaint?: (cellIndex: number) => void;
  onGridCellTextChange?: (cellIndex: number, plainText: string, runs: RichTextRun[]) => void;
  onGridTitleChange?: (plainText: string, runs: RichTextRun[]) => void;
  onGridColumnTitleChange?: (colIndex: number, plainText: string, runs: RichTextRun[]) => void;
  onGridRowTitleChange?: (rowIndex: number, plainText: string, runs: RichTextRun[]) => void;
  /** Play / slide transition: staggered per-cell fill color lerp (see `useSlideTransition`). */
  presentationChartLerpU?: number;
  presentationChartLerpFromJson?: string;
  /** Reserved for segment pop-in when grid topology changes (no color lerp). */
  presentationChartStagger?: ChartSlideStagger;
  highlightAnimStaggerIndex?: number;
  highlightAnimStaggerCount?: number;
}

export function GridChartShape(props: GridChartShapeProps) {
  const {
    isReadOnly = false,
    gridCellPaintInteractive = false,
    gridTrackResizeInteractive = false,
    gridStructureInteractive = false,
    showMeshGradientHubIndicators = false,
    onGridStructureDragSessionChange,
    onGridTrackDragSessionChange,
    onDeleteGridRow,
    onDeleteGridColumn,
    onMoveGridRow,
    onMoveGridColumn,
    onInsertGridRow,
    onInsertGridColumn,
    onColumnTrackResize,
    onRowTrackResize,
    onGridCellPaint,
    onGridCellTextChange,
    onGridTitleChange,
    onGridColumnTitleChange,
    onGridRowTitleChange,
    presentationChartStagger,
    presentationChartLerpU,
    presentationChartLerpFromJson,
    highlightAnimStaggerIndex,
    highlightAnimStaggerCount,
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
  const globalProperties = useGlobalProperties();
  const variableContext = useGlobalVariableContext();
  const themeBase =
    ((node as DiagramNodeData).backgroundColor ?? "").trim() ||
    DEFAULT_PIE_SLICE_COLORS[0];
  const defaultCellFill = useMemo(
    () =>
      resolveGridDefaultCellFill(
        globalProperties,
        DEFAULT_PIE_SLICE_COLORS[0],
        chartBase.defaultCellFill
      ),
    [globalProperties, chartBase.defaultCellFill]
  );
  const layout = useMemo(
    () =>
      buildGridChartLayout(node, chartBase, {
        hueStepDeg,
        defaultCellFill,
        structureChrome: gridStructureInteractive,
      }),
    [node, chartBase, hueStepDeg, defaultCellFill, gridStructureInteractive]
  );

  const isGridColorLerp = useMemo(
    () =>
      presentationChartLerpFromJson != null &&
      presentationChartLerpU != null &&
      presentationChartLerpU < 1 - 1e-9,
    [presentationChartLerpFromJson, presentationChartLerpU]
  );

  const displayCells = useMemo(() => {
    if (!isGridColorLerp || !presentationChartLerpFromJson || presentationChartLerpU == null) {
      return layout.cells;
    }
    const snapshot = parseGridChartLerpSnapshot(presentationChartLerpFromJson);
    if (!snapshot) return layout.cells;
    const prevThemeBase =
      (snapshot.backgroundColor ?? "").trim() ||
      ((node as DiagramNodeData).backgroundColor ?? "").trim() ||
      DEFAULT_PIE_SLICE_COLORS[0];
    const prevDefaultFill = resolveGridDefaultCellFill(
      globalProperties,
      DEFAULT_PIE_SLICE_COLORS[0],
      snapshot.chart.defaultCellFill
    );
    const prevLayout = buildGridChartLayout(
      { ...node, backgroundColor: prevThemeBase },
      snapshot.chart,
      { hueStepDeg, defaultCellFill: prevDefaultFill }
    );
    return lerpGridChartLayoutCells(
      prevLayout.cells,
      layout.cells,
      presentationChartLerpU
    );
  }, [
    isGridColorLerp,
    layout.cells,
    node,
    hueStepDeg,
    globalProperties,
    defaultCellFill,
    presentationChartLerpFromJson,
    presentationChartLerpU,
  ]);

  const segPopInId = useId().replace(/:/g, "");
  const segPopOutId = `${segPopInId}-out`;

  const cellStaggerRanks = useMemo(() => {
    if (!presentationChartStagger || isGridColorLerp) return null;
    const seed = `${node.id}|${presentationChartStagger.exit ? "exit" : "enter"}`;
    return gridCellStaggerRankByIndex(seed, layout.cells.length);
  }, [presentationChartStagger, isGridColorLerp, node.id, layout.cells.length]);

  const cellSlideStagger = useMemo(
    () =>
      presentationChartStagger && !isGridColorLerp
        ? gridChartCellSlideStagger(presentationChartStagger)
        : undefined,
    [presentationChartStagger, isGridColorLerp]
  );

  const shellSlideStyle = useMemo(
    () =>
      presentationChartStagger && !isGridColorLerp
        ? gridChartShellPopAnimationStyle(
            presentationChartStagger,
            layout.cells.length,
            segPopInId,
            segPopOutId
          )
        : undefined,
    [presentationChartStagger, isGridColorLerp, layout.cells.length, segPopInId, segPopOutId]
  );
  const canStructureChrome =
    gridStructureInteractive &&
    !isReadOnly &&
    !!(onDeleteGridRow || onDeleteGridColumn || onMoveGridRow || onMoveGridColumn);

  const [hoveredCellIndex, setHoveredCellIndex] = useState<number | null>(null);
  const [hoveredColBoundary, setHoveredColBoundary] = useState<number | null>(null);
  const [hoveredRowBoundary, setHoveredRowBoundary] = useState<number | null>(null);
  const trackDragActiveRef = useRef(false);
  const cellClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colBoundaryDragRef = useRef(0);
  const rowBoundaryDragRef = useRef(0);
  const colTrackSnapshotRef = useRef<number[]>([]);
  const rowTrackSnapshotRef = useRef<number[]>([]);
  const gridStrokeWidth =
    ((nodeAny.borderStyle as string) || "solid") === "none"
      ? 0
      : parseInt(String(nodeAny.borderWidth ?? 2), 10) || 2;
  const gridBodyW = Math.max(40, node.width ?? 320);
  const gridBodyH = Math.max(40, node.height ?? 260);

  useEffect(() => {
    if (!gridCellPaintInteractive) setHoveredCellIndex(null);
  }, [gridCellPaintInteractive]);
  useEffect(() => {
    if (!gridTrackResizeInteractive) {
      setHoveredColBoundary(null);
      setHoveredRowBoundary(null);
    }
  }, [gridTrackResizeInteractive]);
  const [editingCellIndex, setEditingCellIndex] = useState<number | null>(null);
  const [editingCellRuns, setEditingCellRuns] = useState<RichTextRun[]>([]);
  const [editingTitle, setEditingTitle] = useState<"chart" | "col" | "row" | null>(null);
  const [editingTitleIndex, setEditingTitleIndex] = useState(-1);
  const [editingTitleRuns, setEditingTitleRuns] = useState<RichTextRun[]>([]);

  const resolveDisplayRuns = useCallback(
    (runs: RichTextRun[]) =>
      resolveGlobalVariablesInRuns(runs, globalProperties, variableContext),
    [globalProperties, variableContext]
  );

  const runsForGridCell = useCallback(
    (raw: ChartGridCell | undefined) =>
      normalizeRuns(raw?.richText ?? labelToRuns(raw?.text ?? "")),
    []
  );

  const runsForChartTitle = useCallback(
    () => normalizeRuns(chartBase.richTitle ?? labelToRuns(chartBase.title ?? "")),
    [chartBase.richTitle, chartBase.title]
  );

  const runsForColumnTitle = useCallback(
    (colIndex: number) => {
      const rich = chartBase.richColumnTitles?.[colIndex];
      const plain = (chartBase.columnTitles ?? [])[colIndex] ?? "";
      return normalizeRuns(rich ?? labelToRuns(plain));
    },
    [chartBase.richColumnTitles, chartBase.columnTitles]
  );

  const runsForRowTitle = useCallback(
    (rowIndex: number) => {
      const rich = chartBase.richRowTitles?.[rowIndex];
      const plain = (chartBase.rowTitles ?? [])[rowIndex] ?? "";
      return normalizeRuns(rich ?? labelToRuns(plain));
    },
    [chartBase.richRowTitles, chartBase.rowTitles]
  );

  const finishCellEdit = useCallback(
    (cellIndex: number, plainText: string, runs: RichTextRun[]) => {
      onGridCellTextChange?.(cellIndex, plainText, gridChartCellRunsCentered(runs));
      setEditingCellIndex(null);
    },
    [onGridCellTextChange]
  );

  const finishTitleEdit = useCallback(
    (kind: "chart" | "col" | "row", index: number, plainText: string, runs: RichTextRun[]) => {
      if (kind === "chart") onGridTitleChange?.(plainText, runs);
      else if (kind === "col") onGridColumnTitleChange?.(index, plainText, runs);
      else onGridRowTitleChange?.(index, plainText, runs);
      setEditingTitle(null);
    },
    [onGridColumnTitleChange, onGridRowTitleChange, onGridTitleChange]
  );

  const renderGridRichTextSlot = useCallback(
    (opts: {
      key: string;
      x: number;
      y: number;
      w: number;
      h: number;
      runs: RichTextRun[];
      editRuns: RichTextRun[];
      isEditing: boolean;
      textNode: DiagramNodeData;
      canEdit: boolean;
      onStartEdit: () => void;
      onSubmit: (plainText: string, runs: RichTextRun[]) => void;
      onCancelEdit: () => void;
      textAlign?: "left" | "center" | "right";
      /** Let single/double-click reach cell paint hit targets beneath (grid selected). */
      passPaintClicks?: boolean;
    }) => {
      const {
        key,
        x,
        y,
        w,
        h,
        runs,
        editRuns,
        isEditing,
        textNode,
        canEdit,
        onStartEdit,
        onSubmit,
        onCancelEdit,
        textAlign = "center",
        passPaintClicks = false,
      } = opts;
      const displayRuns = resolveDisplayRuns(runs);
      const plainDisplay = getPlainTextFromRuns(displayRuns).trim();
      if (!plainDisplay && !isEditing) return null;
      const pad = 2;
      const foW = Math.max(4, w - pad * 2);
      const foH = Math.max(4, h - pad * 2);
      const alignItems =
        textAlign === "left"
          ? "flex-start"
          : textAlign === "right"
            ? "flex-end"
            : "center";
      const pointer = isEditing ? "auto" : passPaintClicks ? "none" : canEdit ? "auto" : "none";
      const cellCursor =
        passPaintClicks && !isEditing ? "cursor-pointer" : canEdit || isEditing ? "cursor-text" : "cursor-default";
      return (
        <g key={key} style={passPaintClicks && !isEditing ? { pointerEvents: "none" } : undefined}>
          <foreignObject
            x={x + pad}
            y={y + pad}
            width={foW}
            height={foH}
            style={{ overflow: isEditing ? "visible" : "hidden", pointerEvents: pointer }}
          >
            <div
              className={`flex h-full min-h-0 w-full flex-col ${cellCursor}`}
              style={{
                justifyContent: isEditing ? "flex-start" : "center",
                alignItems,
              }}
              onPointerDown={(e) => {
                if (passPaintClicks || !canEdit || isEditing) return;
                e.stopPropagation();
              }}
              onDoubleClick={(e) => {
                if (passPaintClicks || !canEdit || isEditing) return;
                e.stopPropagation();
                e.preventDefault();
                onStartEdit();
              }}
            >
              {isEditing ? (
                <div
                  className="relative min-h-0 w-full flex-1 overflow-visible"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <TextboxRichEditor
                    node={textNode}
                    runs={editRuns}
                    onSubmit={onSubmit}
                    toolbarFixedToViewport
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        onCancelEdit();
                      }
                    }}
                  />
                </div>
              ) : (
                <div
                  className="min-h-0 w-full max-h-full shrink overflow-auto"
                  style={{ padding: 1, boxSizing: "border-box" }}
                >
                  <TextboxRichDisplay
                    node={textNode}
                    runs={displayRuns}
                    suppressHoverBackground
                    pointerEventsNone={passPaintClicks}
                    onDoubleClick={(e) => {
                      if (passPaintClicks || !canEdit) return;
                      e.stopPropagation();
                      e.preventDefault();
                      onStartEdit();
                    }}
                  />
                </div>
              )}
            </div>
          </foreignObject>
        </g>
      );
    },
    [resolveDisplayRuns]
  );

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

  const nodeW = Math.max(40, node.width ?? 320);
  const nodeH = Math.max(40, node.height ?? 260);
  const shellRadiusPx = useMemo(() => {
    if (body.rx <= 0 && body.ry <= 0) return 0;
    const sx = layout.vbW > 0 ? nodeW / layout.vbW : 1;
    const sy = layout.vbH > 0 ? nodeH / layout.vbH : 1;
    const rPx = Math.min(body.rx * sx, body.ry * sy);
    return Math.min(rPx, 0.48 * Math.min(nodeW, nodeH));
  }, [body.rx, body.ry, layout.vbH, layout.vbW, nodeH, nodeW]);
  const shellBorderRadius = shellRadiusPx > 0.5 ? `${shellRadiusPx}px` : undefined;

  const shellHighlightStyle = useMemo(
    () =>
      getHighlightAnimStyleForNode(node as DiagramNodeData & { x: number; y: number }, {
        isLineNode: false,
        isDuplicateDragPreview: false,
        positionX: node.x ?? 0,
        positionY: node.y ?? 0,
        highlightAnimStaggerIndex,
        highlightAnimStaggerCount,
        roundedShellGlow: true,
      }),
    [
      node,
      highlightAnimStaggerIndex,
      highlightAnimStaggerCount,
      nodeAny.highlightAnim,
      nodeAny.highlightAnimMode,
      nodeAny.highlightAnimDurationSec,
      nodeAny.highlightAnimIntervalSec,
      nodeAny.highlightAnimGlowColor,
      nodeAny.highlightAnimGlowIntensity,
    ]
  );
  const preserveShellHalo = gridStructureInteractive || !!shellHighlightStyle;

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
  const canPaintCells =
    gridCellPaintInteractive && !isReadOnly && !!onGridCellPaint;
  const canEditCell = !isReadOnly && !!onGridCellTextChange;
  const canResizeTracks =
    gridTrackResizeInteractive &&
    !isReadOnly &&
    (!!onColumnTrackResize || !!onRowTrackResize);
  const { plot } = layout;

  const endTrackDrag = useCallback(() => {
    if (!trackDragActiveRef.current) return;
    trackDragActiveRef.current = false;
    onGridTrackDragSessionChange?.(false);
  }, [onGridTrackDragSessionChange]);

  const applyColBoundaryClient = useCallback(
    (clientX: number, boundaryIndex: number, svg: SVGSVGElement) => {
      if (!onColumnTrackResize) return;
      const pt = svgUserPointFromClient(svg, clientX, 0);
      if (!pt) return;
      const snapshot = colTrackSnapshotRef.current;
      let nextWidth = gridBodyW;
      let trackPx = snapshot;
      for (let iter = 0; iter < 3; iter++) {
        const { plotX } = computeGridChartPlotInsets(
          nextWidth,
          gridBodyH,
          chartBase,
          gridStrokeWidth
        );
        const result = adjustGridColumnTracksGrowContainer(
          snapshot,
          boundaryIndex,
          pt.x,
          plotX
        );
        trackPx = result.trackPx;
        nextWidth = solveGridChartNodeWidthForPlotW(
          result.plotW,
          gridBodyH,
          chartBase,
          gridStrokeWidth
        );
      }
      onColumnTrackResize({ columnWeights: trackPx, width: nextWidth });
    },
    [chartBase, gridBodyH, gridBodyW, gridStrokeWidth, onColumnTrackResize]
  );

  const applyRowBoundaryClient = useCallback(
    (clientY: number, boundaryIndex: number, svg: SVGSVGElement) => {
      if (!onRowTrackResize) return;
      const pt = svgUserPointFromClient(svg, 0, clientY);
      if (!pt) return;
      const snapshot = rowTrackSnapshotRef.current;
      let nextHeight = gridBodyH;
      let trackPx = snapshot;
      for (let iter = 0; iter < 3; iter++) {
        const { plotY } = computeGridChartPlotInsets(
          gridBodyW,
          nextHeight,
          chartBase,
          gridStrokeWidth
        );
        const result = adjustGridRowTracksGrowContainer(
          snapshot,
          boundaryIndex,
          pt.y,
          plotY
        );
        trackPx = result.trackPx;
        nextHeight = solveGridChartNodeHeightForPlotH(
          result.plotH,
          gridBodyW,
          chartBase,
          gridStrokeWidth
        );
      }
      onRowTrackResize({ rowWeights: trackPx, height: nextHeight });
    },
    [chartBase, gridBodyH, gridBodyW, gridStrokeWidth, onRowTrackResize]
  );

  const onPointerDownColBoundary = useCallback(
    (boundaryIndex: number) => (e: React.PointerEvent<SVGRectElement>) => {
      if (!canResizeTracks || !onColumnTrackResize || layout.cols < 2) return;
      e.stopPropagation();
      e.preventDefault();
      colTrackSnapshotRef.current = gridChartTrackPixelSizesFromEdges(layout.columnEdges);
      colBoundaryDragRef.current = boundaryIndex;
      trackDragActiveRef.current = true;
      onGridTrackDragSessionChange?.(true);
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyColBoundaryClient(e.clientX, boundaryIndex, svg);
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    },
    [
      applyColBoundaryClient,
      canResizeTracks,
      layout.columnEdges,
      layout.cols,
      onColumnTrackResize,
      onGridTrackDragSessionChange,
    ]
  );

  const onPointerDownRowBoundary = useCallback(
    (boundaryIndex: number) => (e: React.PointerEvent<SVGRectElement>) => {
      if (!canResizeTracks || !onRowTrackResize || layout.rows < 2) return;
      e.stopPropagation();
      e.preventDefault();
      rowTrackSnapshotRef.current = gridChartTrackPixelSizesFromEdges(layout.rowEdges);
      rowBoundaryDragRef.current = boundaryIndex;
      trackDragActiveRef.current = true;
      onGridTrackDragSessionChange?.(true);
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyRowBoundaryClient(e.clientY, boundaryIndex, svg);
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    },
    [
      applyRowBoundaryClient,
      canResizeTracks,
      layout.rowEdges,
      layout.rows,
      onRowTrackResize,
      onGridTrackDragSessionChange,
    ]
  );

  const onPointerMoveColBoundary = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!trackDragActiveRef.current || !onColumnTrackResize) return;
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyColBoundaryClient(e.clientX, colBoundaryDragRef.current, svg);
    },
    [applyColBoundaryClient, onColumnTrackResize]
  );

  const onPointerMoveRowBoundary = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!trackDragActiveRef.current || !onRowTrackResize) return;
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyRowBoundaryClient(e.clientY, rowBoundaryDragRef.current, svg);
    },
    [applyRowBoundaryClient, onRowTrackResize]
  );

  const onPointerUpTrackBoundary = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        (e.currentTarget as SVGRectElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      endTrackDrag();
    },
    [endTrackDrag]
  );

  const slotRect = useCallback(
    (row: number, col: number) => {
      const x0 = layout.columnEdges[col] ?? plot.x;
      const x1 = layout.columnEdges[col + 1] ?? plot.x + plot.w;
      const y0 = layout.rowEdges[row] ?? plot.y;
      const y1 = layout.rowEdges[row + 1] ?? plot.y + plot.h;
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    },
    [layout.columnEdges, layout.rowEdges, plot]
  );

  const renderCellFill = (
    cell: GridChartLayoutCell,
    i: number,
    fillOpacity = 1,
    staggerRank?: number
  ) => {
    const rx = gridCellCornerRx(cell.w, cell.h);
    const fill =
      cell.fillMode === "none"
        ? "transparent"
        : cell.fillMode === "gradient"
          ? `url(#${gradBaseId}-${i})`
          : cell.solidFill;
    const resolvedOpacity =
      typeof cell.fillOpacity === "number" ? cell.fillOpacity * fillOpacity : fillOpacity;
    const rect = (
      <rect
        className="dw-grid-chart-cell-fill"
        x={cell.x}
        y={cell.y}
        width={cell.w}
        height={cell.h}
        fill={fill}
        fillOpacity={resolvedOpacity}
        rx={rx}
        ry={rx}
      />
    );
    if (cellSlideStagger && staggerRank != null) {
      const segAnim = chartSegmentPopAnimationStyle(
        staggerRank,
        segPopInId,
        segPopOutId,
        0,
        0,
        cellSlideStagger
      );
      return <g style={segAnim}>{rect}</g>;
    }
    return rect;
  };

  const hoverPreviewCell = useMemo((): GridChartLayoutCell | null => {
    if (!canPaintCells || hoveredCellIndex == null) return null;
    const cells = chartBase.cells ?? [];
    const raw = cells[hoveredCellIndex];
    if (isGridCellFilled(raw)) return null;
    const nextCells = [...cells];
    while (nextCells.length < layout.cells.length) {
      nextCells.push({ filled: false });
    }
    const nodeTextColor = String(nodeAny.textColor ?? "").trim();
    nextCells[hoveredCellIndex] = nextGridCellAfterPaintClick(
      nextCells[hoveredCellIndex],
      hoveredCellIndex,
      nextCells,
      chartBase,
      themeBase,
      hueStepDeg,
      nodeTextColor || undefined,
      defaultCellFill
    );
    const previewLayout = buildGridChartLayout(
      node,
      { ...chartBase, cells: nextCells },
      { hueStepDeg, defaultCellFill }
    );
    const lc = previewLayout.cells[hoveredCellIndex];
    if (!lc || lc.fillMode === "none") return null;
    return lc;
  }, [
    canPaintCells,
    hoveredCellIndex,
    chartBase,
    chartBase.cells,
    layout.cells.length,
    node,
    themeBase,
    hueStepDeg,
    defaultCellFill,
  ]);

  useEffect(() => {
    return () => {
      if (cellClickTimerRef.current) clearTimeout(cellClickTimerRef.current);
    };
  }, []);
  const canEditChartTitle = !isReadOnly && !!onGridTitleChange;
  const canEditColTitle = !isReadOnly && !!onGridColumnTitleChange;
  const canEditRowTitle = !isReadOnly && !!onGridRowTitleChange;

  const cellGradients = displayCells.map((cell, i) => {
    const src =
      hoveredCellIndex === i && hoverPreviewCell?.fillMode === "gradient"
        ? hoverPreviewCell
        : cell;
    return src.fillMode === "gradient" ? (
      <linearGradient
        key={`cg-${i}`}
        id={`${gradBaseId}-${i}`}
        x1={gradCoords.x1}
        y1={gradCoords.y1}
        x2={gradCoords.x2}
        y2={gradCoords.y2}
        gradientUnits="objectBoundingBox"
      >
        <stop offset="0%" stopColor={src.gradientColor1} />
        <stop offset="100%" stopColor={src.gradientColor2} />
      </linearGradient>
    ) : null;
  });

  const gridShellLayer = (
    <>
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
      {layout.title
        ? renderGridRichTextSlot({
            key: "grid-chart-title",
            x: body.x + layout.titlePadX,
            y: layout.title.y - layout.title.fontSize * 1.1,
            w: Math.max(8, body.w - layout.titlePadX * 2),
            h: layout.title.fontSize * 2.2,
            runs: runsForChartTitle(),
            editRuns: editingTitleRuns,
            isEditing: editingTitle === "chart",
            textNode: buildGridChartInlineTextNode(node, {
              labelColor: layout.titleColor,
              fontSize: layout.title.fontSize,
              textAlign: "center",
              fontWeight: 600,
            }),
            canEdit: canEditChartTitle,
            onStartEdit: () => {
              setEditingTitleRuns(runsForChartTitle());
              setEditingTitleIndex(-1);
              setEditingTitle("chart");
            },
            onSubmit: (plain, runs) => finishTitleEdit("chart", -1, plain, runs),
            onCancelEdit: () => setEditingTitle(null),
            textAlign: "center",
          })
        : null}
      {layout.columnTitles.map((ct) => {
        const colW =
          (layout.columnEdges[ct.colIndex + 1] ?? plot.x + plot.w) -
          (layout.columnEdges[ct.colIndex] ?? plot.x);
        const titleH = ct.fontSize * 2.2;
        return renderGridRichTextSlot({
          key: `ct-${ct.colIndex}`,
          x: layout.columnEdges[ct.colIndex] ?? plot.x,
          y: ct.y - titleH / 2,
          w: colW,
          h: titleH,
          runs: runsForColumnTitle(ct.colIndex),
          editRuns: editingTitleRuns,
          isEditing: editingTitle === "col" && editingTitleIndex === ct.colIndex,
          textNode: buildGridChartInlineTextNode(node, {
            labelColor: layout.axisColor,
            fontSize: ct.fontSize,
            textAlign: "center",
            fontWeight: 500,
          }),
          canEdit: canEditColTitle,
          onStartEdit: () => {
            setEditingTitleRuns(runsForColumnTitle(ct.colIndex));
            setEditingTitleIndex(ct.colIndex);
            setEditingTitle("col");
          },
          onSubmit: (plain, runs) => finishTitleEdit("col", ct.colIndex, plain, runs),
          onCancelEdit: () => setEditingTitle(null),
          textAlign: "center",
        });
      })}
      {layout.rowTitles.map((rt) => {
        const rowH =
          (layout.rowEdges[rt.rowIndex + 1] ?? plot.y + plot.h) -
          (layout.rowEdges[rt.rowIndex] ?? plot.y);
        const rowTitleW = Math.max(8, plot.x - body.x);
        return renderGridRichTextSlot({
          key: `rt-${rt.rowIndex}`,
          x: body.x,
          y: layout.rowEdges[rt.rowIndex] ?? plot.y,
          w: rowTitleW,
          h: rowH,
          runs: runsForRowTitle(rt.rowIndex),
          editRuns: editingTitleRuns,
          isEditing: editingTitle === "row" && editingTitleIndex === rt.rowIndex,
          textNode: buildGridChartInlineTextNode(node, {
            labelColor: layout.axisColor,
            fontSize: rt.fontSize,
            textAlign: "center",
            fontWeight: 500,
          }),
          canEdit: canEditRowTitle,
          onStartEdit: () => {
            setEditingTitleRuns(runsForRowTitle(rt.rowIndex));
            setEditingTitleIndex(rt.rowIndex);
            setEditingTitle("row");
          },
          onSubmit: (plain, runs) => finishTitleEdit("row", rt.rowIndex, plain, runs),
          onCancelEdit: () => setEditingTitle(null),
          textAlign: "center",
        });
      })}
    </>
  );

  const gridContent = (
    <>
      {defs}
      {meshPaint.defs}
      <g style={shellSlideStyle} pointerEvents="none">
        {gridShellLayer}
      </g>
      {displayCells.map((cell, i) => {
        const isHover = canPaintCells && hoveredCellIndex === i;
        const showPaintPreview =
          isHover && hoverPreviewCell != null && cell.fillMode === "none";
        const rx = gridCellCornerRx(cell.w, cell.h);
        const staggerRank = cellStaggerRanks?.[i];
        return (
          <g key={`cell-${i}`} pointerEvents="none">
            {renderCellFill(cell, i, 1, staggerRank)}
            {showPaintPreview
              ? renderCellFill(hoverPreviewCell, i, 0.55, undefined)
              : null}
            {isHover ? (
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill="rgba(59,130,246,0.12)"
                stroke="rgba(59,130,246,0.85)"
                strokeWidth={0.65}
                vectorEffect="non-scaling-stroke"
                rx={rx}
                ry={rx}
              />
            ) : null}
          </g>
        );
      })}
      {layout.cells.map((cell, i) => {
        const fontSize = Math.min(Math.min(cell.w, cell.h) * 0.38, 12);
        const raw = chartBase.cells?.[i];
        const cellRuns = gridChartCellRunsCentered(runsForGridCell(raw));
        const label = renderGridRichTextSlot({
          key: `cell-t-${i}`,
          x: cell.x,
          y: cell.y,
          w: cell.w,
          h: cell.h,
          runs: cellRuns,
          editRuns:
            editingCellIndex === i ? gridChartCellRunsCentered(editingCellRuns) : editingCellRuns,
          isEditing: editingCellIndex === i,
          textNode: buildGridChartInlineTextNode(node, {
            labelColor: cell.labelColor,
            fontSize,
            textAlign: "center",
            fontWeight: 600,
          }),
          canEdit: canEditCell,
          onStartEdit: () => {
            setEditingCellRuns(cellRuns);
            setEditingCellIndex(i);
          },
          onSubmit: (plain, runs) => finishCellEdit(i, plain, runs),
          onCancelEdit: () => setEditingCellIndex(null),
          textAlign: "center",
          passPaintClicks: canPaintCells && editingCellIndex !== i,
        });
        const staggerRank = cellStaggerRanks?.[i];
        if (cellSlideStagger && staggerRank != null) {
          const segAnim = chartSegmentPopAnimationStyle(
            staggerRank,
            segPopInId,
            segPopOutId,
            0,
            0,
            cellSlideStagger
          );
          return (
            <g key={`cell-t-wrap-${i}`} style={segAnim}>
              {label}
            </g>
          );
        }
        return label;
      })}
      {canPaintCells
        ? layout.cells.map((cell, i) => {
            const slot = slotRect(cell.row, cell.col);
            return (
              <rect
                key={`cell-hit-${i}`}
                x={slot.x}
                y={slot.y}
                width={slot.w}
                height={slot.h}
                fill="transparent"
                style={{ cursor: "pointer", touchAction: "none" }}
                onPointerEnter={() => setHoveredCellIndex(i)}
                onPointerLeave={() =>
                  setHoveredCellIndex((prev) => (prev === i ? null : prev))
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (cellClickTimerRef.current) clearTimeout(cellClickTimerRef.current);
                  cellClickTimerRef.current = setTimeout(() => {
                    cellClickTimerRef.current = null;
                    onGridCellPaint?.(i);
                  }, 280);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (cellClickTimerRef.current) {
                    clearTimeout(cellClickTimerRef.current);
                    cellClickTimerRef.current = null;
                  }
                  if (!canEditCell) return;
                  const raw = chartBase.cells?.[i];
                  setEditingCellRuns(gridChartCellRunsCentered(runsForGridCell(raw)));
                  setEditingCellIndex(i);
                }}
              />
            );
          })
        : null}
      {canResizeTracks && onColumnTrackResize && layout.cols > 1
        ? layout.colBoundaries.map((b) => {
            const pad = TRACK_EDGE_HIT_PAD;
            const hitW = Math.max(6, pad * 2);
            const hovered = hoveredColBoundary === b.index;
            return (
              <g key={`col-bound-${b.index}`}>
                {hovered ? (
                  <line
                    x1={b.x}
                    y1={b.y0}
                    x2={b.x}
                    y2={b.y1}
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth={1.25}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ) : null}
                <rect
                  x={b.x - hitW / 2}
                  y={b.y0}
                  width={hitW}
                  height={b.y1 - b.y0}
                  fill="transparent"
                  style={{ cursor: "col-resize", touchAction: "none" }}
                  onPointerEnter={() => {
                    setHoveredColBoundary(b.index);
                    setHoveredCellIndex(null);
                  }}
                  onPointerLeave={() =>
                    setHoveredColBoundary((prev) => (prev === b.index ? null : prev))
                  }
                  onPointerDown={onPointerDownColBoundary(b.index)}
                  onPointerMove={onPointerMoveColBoundary}
                  onPointerUp={onPointerUpTrackBoundary}
                  onPointerCancel={onPointerUpTrackBoundary}
                />
              </g>
            );
          })
        : null}
      {canResizeTracks && onRowTrackResize && layout.rows > 1
        ? layout.rowBoundaries.map((b) => {
            const pad = TRACK_EDGE_HIT_PAD;
            const hitH = Math.max(6, pad * 2);
            const hovered = hoveredRowBoundary === b.index;
            return (
              <g key={`row-bound-${b.index}`}>
                {hovered ? (
                  <line
                    x1={b.x0}
                    y1={b.y}
                    x2={b.x1}
                    y2={b.y}
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth={1.25}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ) : null}
                <rect
                  x={b.x0}
                  y={b.y - hitH / 2}
                  width={b.x1 - b.x0}
                  height={hitH}
                  fill="transparent"
                  style={{ cursor: "row-resize", touchAction: "none" }}
                  onPointerEnter={() => {
                    setHoveredRowBoundary(b.index);
                    setHoveredCellIndex(null);
                  }}
                  onPointerLeave={() =>
                    setHoveredRowBoundary((prev) => (prev === b.index ? null : prev))
                  }
                  onPointerDown={onPointerDownRowBoundary(b.index)}
                  onPointerMove={onPointerMoveRowBoundary}
                  onPointerUp={onPointerUpTrackBoundary}
                  onPointerCancel={onPointerUpTrackBoundary}
                />
              </g>
            );
          })
        : null}
      {canStructureChrome && layout.structure ? (
        <GridChartStructureChrome
          layout={layout}
          canInteract
          onDeleteRow={onDeleteGridRow}
          onDeleteColumn={onDeleteGridColumn}
          onMoveRow={onMoveGridRow}
          onMoveColumn={onMoveGridColumn}
          onInsertRow={onInsertGridRow}
          onInsertColumn={onInsertGridColumn}
          onDragSessionChange={onGridStructureDragSessionChange}
        />
      ) : null}
      <defs>
        {presentationChartStagger && cellStaggerRanks ? (
          <style
            type="text/css"
            dangerouslySetInnerHTML={{
              __html: chartSegmentPopKeyframesCss(segPopInId, segPopOutId),
            }}
          />
        ) : null}
        {cellGradients}
      </defs>
    </>
  );

  return (
    <div
      data-dw-grid-chart-shell=""
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
        defaultWidth={320}
        defaultHeight={260}
        viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
        borderRadius={shellBorderRadius}
        frostedClipRectInViewBox={{ x: body.x, y: body.y, w: body.w, h: body.h, rx: body.rx, ry: body.ry }}
        slideColorTransition={isGridColorLerp ? undefined : slideColorTransition}
        svgOverflowVisible={gridStructureInteractive}
        preserveShellHalo={preserveShellHalo}
        svgContent={gridContent}
      />
    </div>
  );
}
