"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useDrag, useDrop } from "react-dnd";
import type { ConnectDragSource } from "react-dnd";
import Draggable from "react-draggable";
import { BarChart2, ChevronDown, GripVertical, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  ChartBarSegmentItem,
  ChartRingSeriesItem,
  ChartSeriesItem,
  ChartSliceFillStyle,
  DiagramNodeData,
  NodeChartSpec,
  NodeChartSpecBar,
  NodeChartSpecLine,
  NodeChartSpecPie,
  NodeChartSpecRing,
  NodeChartSpecGrid,
  NodeChartSpecGantt,
  NodeChartSpecLoop,
  NodeChartSpecArrow,
  ChartGridCell,
} from "@/lib/types";
import { getPlainTextFromRuns, labelToRuns } from "@/lib/rich-text";
import { gridChartCellRunsCentered } from "@/lib/grid-chart-rich-node";
import {
  CHART_MAX_SEGMENT_PULL,
  CHART_MAX_PER_SLICE_SEGMENT_PULL,
  defaultBarChartSpec,
  defaultGridChartSpec,
  defaultGanttChartSpec,
  defaultLoopChartSpec,
  defaultArrowChartSpec,
  defaultLineChartSpec,
  defaultPieChartSpec,
  defaultRingChartSpec,
  randomLineChartSpec,
  resizeGridChartCells,
  resetGridChartTrackSizes,
  resetGridChartCellFills,
  resetGridChartCellContent,
  newChartSliceId,
  DEFAULT_PIE_SLICE_COLORS,
  DEFAULT_PIE_SLICE_LABEL_COLOR,
  DEFAULT_PIE_WEDGE_LABEL_FONT,
  DEFAULT_RING_INNER_RADIUS,
  DEFAULT_RING_THICKNESS,
  formatChartValueForEdit,
  roundChartDataValue,
} from "@/lib/chart-node";
import {
  chartValueForEditorDisplay,
  chartValuesStrForEditorDisplay,
  parseChartScalarForSave,
  parseChartValuesListForSave,
  previewChartValueInput,
  splitChartValuesList,
} from "@/lib/chart-value-expr";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { barChartWantsRoundedColumnEnds } from "@/lib/bar-chart-layout";
import {
  LINE_CHART_POLYLINE_STROKE_MAX,
  LINE_CHART_POLYLINE_STROKE_MIN,
  lineChartPolylineStrokeFallbackFromNodeBorder,
} from "@/lib/line-chart-layout";
import {
  GRID_CELL_FILL_GLOBAL_PROPERTY,
  resolveGridCanvasPaintFill,
  resolveGridCellPadPx,
} from "@/lib/grid-chart-layout";
import { GanttChartDataFields } from "@/components/editor/gantt-chart-data-fields";
import { LoopChartDataFields } from "@/components/editor/loop-chart-data-fields";
import { ArrowChartDataFields } from "@/components/editor/arrow-chart-data-fields";
import { clampGanttCols, ganttGrowWidthForAddedColumns } from "@/lib/gantt-chart-layout";

type ChartModalSectionTint = "muted" | "amber" | "emerald" | "purple" | "sky" | "teal";

function ChartModalSection({
  title,
  tint,
  children,
  className,
  headerRight,
}: {
  title: string;
  tint: ChartModalSectionTint;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  const box: Record<ChartModalSectionTint, string> = {
    muted: "bg-muted/50 dark:bg-background border border-border",
    amber: "bg-amber-50/50 dark:bg-background border border-amber-200/50 dark:border-border",
    emerald: "bg-emerald-50/50 dark:bg-background border border-emerald-200/50 dark:border-border",
    purple: "bg-purple-50/50 dark:bg-background border border-purple-200/50 dark:border-border",
    sky: "bg-sky-50/50 dark:bg-background border border-sky-200/50 dark:border-border",
    teal: "bg-teal-50/50 dark:bg-background border border-teal-200/50 dark:border-border",
  };
  const dot: Record<ChartModalSectionTint, string> = {
    muted: "bg-primary",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    purple: "bg-purple-500",
    sky: "bg-sky-500",
    teal: "bg-teal-500",
  };
  return (
    <div className={cn("rounded-md p-3 min-w-0", box[tint], className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-2 h-2 rounded-full shrink-0", dot[tint])} />
          <Label className="text-sm font-semibold text-foreground">{title}</Label>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function sliceFillStyleFromSeries(s: ChartSeriesItem | ChartBarSegmentItem): ChartSliceFillStyle {
  if (s.fillStyle === "none" || s.fillStyle === "solid" || s.fillStyle === "gradient") {
    return s.fillStyle;
  }
  const g = s.gradientColors;
  if (g?.[0]?.trim() && g?.[1]?.trim()) return "gradient";
  return "solid";
}

/** Parsed label size for the chart modal slider (empty string = renderer default). */
const DEFAULT_BAR_CATEGORY_LABEL_FONT = 2.75;
const DEFAULT_BAR_LEGEND_LABEL_FONT = 2.7;

function barOptionalFontSliderState(
  sizeStr: string,
  fallback: number
): { hasCustom: boolean; sliderValue: number } {
  const trimmed = String(sizeStr ?? "").trim();
  const raw = Number(trimmed.replace(/,/g, "."));
  if (!trimmed || !Number.isFinite(raw) || raw <= 0) {
    return { hasCustom: false, sliderValue: fallback };
  }
  return { hasCustom: true, sliderValue: Math.min(14, Math.max(2, raw)) };
}

function pieChartRowLabelSizeState(labelFontSizeStr: string): {
  hasCustomLabelFontSize: boolean;
  labelSizeSliderValue: number;
} {
  const trimmed = String(labelFontSizeStr ?? "").trim();
  const raw = Number(trimmed.replace(/,/g, "."));
  if (!trimmed || !Number.isFinite(raw) || raw <= 0) {
    return {
      hasCustomLabelFontSize: false,
      labelSizeSliderValue: DEFAULT_PIE_WEDGE_LABEL_FONT,
    };
  }
  return {
    hasCustomLabelFontSize: true,
    labelSizeSliderValue: Math.min(14, Math.max(2, raw)),
  };
}

interface EditRow {
  id: string;
  name: string;
  valueStr: string;
  fillStyle: ChartSliceFillStyle;
  color: string;
  gradientColor1: string;
  gradientColor2: string;
  labelColor: string;
  /** Empty = use renderer default label size. */
  labelFontSizeStr: string;
  /** Empty = use chart "Segment separation" for this slice; otherwise 0–4 radial pull. */
  segmentPullStr: string;
}

/** Ring chart segment row in the modal (string fields mirror pie `EditRow` pattern). */
interface RingModalEditRow {
  id: string;
  name: string;
  valueStr: string;
  fillStyle: ChartSliceFillStyle;
  color: string;
  gradientColor1: string;
  gradientColor2: string;
  labelColor: string;
  labelFontSizeStr: string;
  ringThicknessStr: string;
  ringRadialOffsetStr: string;
  sliceOutlineColorStr: string;
  sliceOutlineWidthStr: string;
}

const CHART_SLICE_REORDER_TYPE = "dw-chart-slice-reorder";
const CHART_BAR_SEGMENT_REORDER_TYPE = "dw-chart-bar-segment-reorder";

function ChartValueInputHint({
  valueStr,
  globalProperties,
  globalVariableContext,
}: {
  valueStr: string;
  globalProperties?: Record<string, string>;
  globalVariableContext?: import("@/lib/builtin-global-variables").GlobalVariableContext;
}) {
  const hint = useMemo(
    () => previewChartValueInput(valueStr, globalProperties, globalVariableContext),
    [valueStr, globalProperties, globalVariableContext],
  );
  if (!hint) return null;
  const isError = !hint.startsWith("=");
  return (
    <p
      className={cn(
        "text-[10px] leading-tight break-words",
        isError ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {hint}
    </p>
  );
}

type GridCellFillStyle = ChartSliceFillStyle | "hue-step" | "theme-hue" | "default";

function gridCellFillStyleFromCell(cell: ChartGridCell): GridCellFillStyle {
  const fs = cell.fillStyle;
  if (
    fs === "none" ||
    fs === "solid" ||
    fs === "gradient" ||
    fs === "hue-step" ||
    fs === "theme-hue" ||
    fs === "default"
  ) {
    return fs;
  }
  const g = cell.gradientColors;
  if (g?.[0]?.trim() && g?.[1]?.trim()) return "gradient";
  if (cell.filled === false) return "none";
  if (!(cell.color ?? "").trim()) return "default";
  return "solid";
}

interface GridCellEditRow {
  id: string;
  filled: boolean;
  fillStyle: GridCellFillStyle;
  color: string;
  gradientColor1: string;
  gradientColor2: string;
  text: string;
  labelColor: string;
}

interface BarEditRow {
  id: string;
  name: string;
  valuesStr: string;
  fillStyle: ChartSliceFillStyle;
  color: string;
  gradientColor1: string;
  gradientColor2: string;
  labelColor: string;
  labelFontSizeStr: string;
}

function BarSegmentSortableRow({
  index,
  isReadOnly,
  reorderRows,
  className,
  children,
}: {
  index: number;
  isReadOnly: boolean;
  reorderRows: (fromIndex: number, toIndex: number) => void;
  className?: string;
  children: (dragHandleRef: ConnectDragSource) => React.ReactNode;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CHART_BAR_SEGMENT_REORDER_TYPE,
      item: { index },
      canDrag: !isReadOnly,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [index, isReadOnly]
  );

  const [, drop] = useDrop(
    () => ({
      accept: CHART_BAR_SEGMENT_REORDER_TYPE,
      hover(item: { index: number }) {
        if (item.index === index) return;
        reorderRows(item.index, index);
        item.index = index;
      },
    }),
    [index, reorderRows]
  );

  return (
    <div
      ref={drop as unknown as React.RefCallback<HTMLDivElement | null>}
      className={cn(className, isDragging && "opacity-50")}
    >
      {children(drag)}
    </div>
  );
}

function ChartSliceSortableRow({
  index,
  isReadOnly,
  reorderRows,
  className,
  children,
}: {
  index: number;
  isReadOnly: boolean;
  reorderRows: (fromIndex: number, toIndex: number) => void;
  className?: string;
  children: (dragHandleRef: ConnectDragSource) => React.ReactNode;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CHART_SLICE_REORDER_TYPE,
      item: { index },
      canDrag: !isReadOnly,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [index, isReadOnly]
  );

  const [, drop] = useDrop(
    () => ({
      accept: CHART_SLICE_REORDER_TYPE,
      hover(item: { index: number }) {
        if (item.index === index) return;
        reorderRows(item.index, index);
        item.index = index;
      },
    }),
    [index, reorderRows]
  );

  return (
    <div
      ref={drop as unknown as React.RefCallback<HTMLDivElement | null>}
      className={cn(className, isDragging && "opacity-50")}
    >
      {children(drag)}
    </div>
  );
}

/** Parsed segment pull override for the modal slider (empty string = use chart default). */
function pieChartRowSegmentPullState(segmentPullStr: string): {
  hasCustomSegmentPull: boolean;
  segmentPullSliderValue: number;
} {
  const trimmed = String(segmentPullStr ?? "").trim();
  if (!trimmed) {
    return { hasCustomSegmentPull: false, segmentPullSliderValue: 0 };
  }
  const raw = Number(trimmed.replace(/,/g, "."));
  if (!Number.isFinite(raw)) {
    return { hasCustomSegmentPull: false, segmentPullSliderValue: 0 };
  }
  return {
    hasCustomSegmentPull: true,
    segmentPullSliderValue: Math.min(
      CHART_MAX_PER_SLICE_SEGMENT_PULL,
      Math.max(0, raw)
    ),
  };
}

const GRID_CANVAS_PAINT_LABELS: Record<string, string> = {
  default: "Default cell color",
  solid: "Solid (default cell color)",
  same: "Same as previous cell",
  gradient: "Gradient",
  "hue-step": "Hue step",
  "theme-hue": "Theme hue",
  none: "None (no fill on click)",
};

interface ChartDataEditorModalProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  node: DiagramNodeData | null;
  onSave: (nodeId: string, chart: NodeChartSpec) => void;
  /** Apply chart changes without closing the modal (e.g. reset track sizes). */
  onPatchChart?: (
    nodeId: string,
    chart: NodeChartSpec,
    nodePatch?: Partial<Pick<DiagramNodeData, "width" | "height">>
  ) => void;
  isReadOnly?: boolean;
  globalProperties?: Record<string, string>;
  globalVariableContext?: import("@/lib/builtin-global-variables").GlobalVariableContext;
}

export function ChartDataEditorModal({
  x,
  y,
  visible,
  onClose,
  node,
  onSave,
  onPatchChart,
  isReadOnly = false,
  globalProperties,
  globalVariableContext,
}: ChartDataEditorModalProps) {
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rows, setRows] = useState<EditRow[]>([]);
  const [sliceBorderColor, setSliceBorderColor] = useState("");
  const [chartShadow, setChartShadow] = useState(false);
  const [segmentGapDeg, setSegmentGapDeg] = useState(0);
  const [showSegmentLabels, setShowSegmentLabels] = useState(true);
  /** Slice ids whose editor body is collapsed (header only). */
  const [collapsedSliceIds, setCollapsedSliceIds] = useState<Set<string>>(() => new Set());

  const [barRows, setBarRows] = useState<BarEditRow[]>([]);
  const [collapsedBarIds, setCollapsedBarIds] = useState<Set<string>>(() => new Set());
  const [categoryLabelsStr, setCategoryLabelsStr] = useState("");
  const [stacked100, setStacked100] = useState(false);
  const [barVertical, setBarVertical] = useState(true);
  const [categoryGap, setCategoryGap] = useState(0.22);
  const [stackGap, setStackGap] = useState(0.12);
  const [roundedColumnEnds, setRoundedColumnEnds] = useState(false);
  const [showGridX, setShowGridX] = useState(false);
  const [showGridY, setShowGridY] = useState(false);
  const [gridColor, setGridColor] = useState("");
  const [showValueAxis, setShowValueAxis] = useState(true);
  const [axisColor, setAxisColor] = useState("");
  const [showCategoryLabels, setShowCategoryLabels] = useState(true);
  const [showBarSegmentValues, setShowBarSegmentValues] = useState(true);
  const [showBarLegend, setShowBarLegend] = useState(false);
  const [barCategoryLabelFontSizeStr, setBarCategoryLabelFontSizeStr] = useState("");
  const [barLegendLabelFontSizeStr, setBarLegendLabelFontSizeStr] = useState("");
  const [showLineArea, setShowLineArea] = useState(true);
  const [lineSmooth, setLineSmooth] = useState(true);
  const [showLineDots, setShowLineDots] = useState(true);
  const [lineDotRadius, setLineDotRadius] = useState(1.85);
  const [lineStrokeWidth, setLineStrokeWidth] = useState(1.35);
  const [lineAreaOpacity, setLineAreaOpacity] = useState(0.42);
  const [valuesLocked, setValuesLocked] = useState(false);

  const [ringRows, setRingRows] = useState<RingModalEditRow[]>([]);
  const [collapsedRingIds, setCollapsedRingIds] = useState<Set<string>>(() => new Set());
  const [ringInnerRadius, setRingInnerRadius] = useState(DEFAULT_RING_INNER_RADIUS);
  const [ringAngularGapDeg, setRingAngularGapDeg] = useState(2);
  /** Default segment outline width in SVG vb units when rows omit theirs. */
  const [ringDefaultOutlineWidthVb, setRingDefaultOutlineWidthVb] = useState(1.75);

  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(4);
  const [gridTitle, setGridTitle] = useState("");
  const [gridColumnTitlesStr, setGridColumnTitlesStr] = useState("");
  const [gridRowTitlesStr, setGridRowTitlesStr] = useState("");
  const [gridCellGap, setGridCellGap] = useState(4);
  const [gridShowLines, setGridShowLines] = useState(true);
  const [gridLineColor, setGridLineColor] = useState("");
  const [gridAxisColor, setGridAxisColor] = useState("");
  const [gridCellRows, setGridCellRows] = useState<GridCellEditRow[]>([]);
  const [gridCanvasPaintFill, setGridCanvasPaintFill] = useState<
    ChartSliceFillStyle | "hue-step" | "theme-hue" | "same" | "default"
  >("default");
  const [gridCanvasPaintGradient1, setGridCanvasPaintGradient1] = useState("");
  const [gridCanvasPaintGradient2, setGridCanvasPaintGradient2] = useState("");
  const [gridDefaultCellFill, setGridDefaultCellFill] = useState("");
  const [gridDefaultCellLabelColor, setGridDefaultCellLabelColor] = useState("");
  const [gridHueStepDirection, setGridHueStepDirection] = useState<"row" | "column">("row");
  const [gridOmitTrackWeightsOnSave, setGridOmitTrackWeightsOnSave] = useState(false);

  const patchGridChartLive = (patch: Partial<NodeChartSpecGrid>) => {
    if (!node?.id || node.chart?.kind !== "grid" || !onPatchChart || isReadOnly) return;
    const cur = node.chart as NodeChartSpecGrid;
    onPatchChart(node.id, { ...cur, kind: "grid", ...patch });
  };

  const patchGridDefaultCellFillLive = (color: string) => {
    if (!node?.id || node.chart?.kind !== "grid" || !onPatchChart || isReadOnly) return;
    const cur = node.chart as NodeChartSpecGrid;
    const trimmed = color.trim();
    if (trimmed) {
      onPatchChart(node.id, { ...cur, kind: "grid", defaultCellFill: trimmed });
    } else {
      const { defaultCellFill: _omit, ...rest } = cur;
      onPatchChart(node.id, { ...rest, kind: "grid" });
    }
  };

  const applyGridDimensions = (cols: number, rows: number, prevCells: GridCellEditRow[]) => {
    const c = Math.min(24, Math.max(1, Math.round(cols)));
    const r = Math.min(24, Math.max(1, Math.round(rows)));
    setGridCols(c);
    setGridRows(r);
    const n = c * r;
    const next: GridCellEditRow[] = [];
    for (let i = 0; i < n; i++) {
      const prev = prevCells[i];
      next.push(
        prev ?? {
          id: newChartSliceId(),
          filled: false,
          fillStyle: "none",
          color: "",
          gradientColor1: "",
          gradientColor2: "",
          text: "",
          labelColor: "",
        }
      );
    }
    setGridCellRows(next);
  };

  useEffect(() => {
    if (visible && node) {
      const chart = (node as DiagramNodeData & { chart?: NodeChartSpec }).chart;
      const isGrid = node.type === "generic.chart.grid" || chart?.kind === "grid";
      const isGantt = node.type === "generic.chart.gantt" || chart?.kind === "gantt";
      const isLoop = node.type === "generic.chart.loop" || chart?.kind === "loop";
      const isArrow = node.type === "generic.chart.arrow" || chart?.kind === "arrow";
      const isBar = node.type === "generic.chart.bar" || chart?.kind === "bar";
      const isLine = node.type === "generic.chart.line" || chart?.kind === "line";
      const isRing = node.type === "generic.chart.ring" || chart?.kind === "ring";

      if (isGrid) {
        const spec: NodeChartSpecGrid =
          chart?.kind === "grid" ? chart : defaultGridChartSpec();
        const cols = Math.min(24, Math.max(1, spec.cols ?? 4));
        const rows = Math.min(24, Math.max(1, spec.rows ?? 4));
        const normalized = resizeGridChartCells(spec, cols, rows);
        setGridCols(cols);
        setGridRows(rows);
        setGridTitle(spec.title ?? "");
        setGridColumnTitlesStr((spec.columnTitles ?? []).join(", "));
        setGridRowTitlesStr((spec.rowTitles ?? []).join(", "));
        setGridCellGap(resolveGridCellPadPx(spec.cellGap));
        setGridShowLines(spec.showGridLines !== false);
        setGridLineColor(spec.gridLineColor ?? "");
        setGridAxisColor(spec.axisColor ?? "");
        setGridCanvasPaintFill(resolveGridCanvasPaintFill(spec));
        setGridHueStepDirection(spec.hueStepDirection === "column" ? "column" : "row");
        const pg = spec.canvasPaintGradientColors;
        setGridCanvasPaintGradient1(pg?.[0] ?? "");
        setGridCanvasPaintGradient2(pg?.[1] ?? "");
        setGridDefaultCellFill(
          spec.defaultCellFill?.trim() ||
            globalProperties?.[GRID_CELL_FILL_GLOBAL_PROPERTY]?.trim() ||
            ""
        );
        setGridDefaultCellLabelColor(spec.defaultCellLabelColor?.trim() ?? "");
        setGridOmitTrackWeightsOnSave(false);
        setGridCellRows(
          normalized.cells.map((cell) => {
            const fs = gridCellFillStyleFromCell(cell);
            const gc = cell.gradientColors;
            return {
              id: cell.id || newChartSliceId(),
              filled: cell.filled !== false && fs !== "none",
              fillStyle: fs,
              color: cell.color ?? "",
              gradientColor1: gc?.[0] ?? "",
              gradientColor2: gc?.[1] ?? "",
              text: cell.text ?? "",
              labelColor: cell.labelColor ?? "",
            };
          })
        );
        return;
      }

      if (isGantt) {
        return;
      }

      if (isLoop) {
        return;
      }

      if (isArrow) {
        return;
      }

      if (isLine) {
        const spec: NodeChartSpecLine =
          chart?.kind === "line" ? chart : defaultLineChartSpec();
        const series: ChartBarSegmentItem[] = spec.series?.length
          ? spec.series.map((s) => ({ ...s, values: [...(s.values ?? [])] }))
          : defaultLineChartSpec().series;
        const nextBar: BarEditRow[] = series.map((s) => {
          const fs = sliceFillStyleFromSeries(s);
          const gc = s.gradientColors;
          return {
            id: s.id || newChartSliceId(),
            name: s.name,
            valuesStr: chartValuesStrForEditorDisplay(s.values ?? [], s.valuesExpr),
            fillStyle: fs,
            color: s.color ?? "",
            gradientColor1: gc?.[0] ?? "",
            gradientColor2: gc?.[1] ?? "",
            labelColor: s.labelColor ?? "",
            labelFontSizeStr:
              s.labelFontSize != null && Number.isFinite(s.labelFontSize)
                ? String(s.labelFontSize)
                : "",
          };
        });
        setBarRows(nextBar);
        setCategoryLabelsStr(
          Array.isArray(spec.categoryLabels) ? spec.categoryLabels.join(", ") : ""
        );
        setShowGridX(spec.showGridX === true);
        setShowGridY(spec.showGridY === true);
        setGridColor(spec.gridColor ?? "");
        setShowValueAxis(spec.showValueAxis !== false);
        setAxisColor(spec.axisColor ?? "");
        setShowCategoryLabels(spec.showCategoryLabels !== false);
        setShowBarLegend(spec.showLegend === true);
        setBarCategoryLabelFontSizeStr(
          spec.categoryLabelFontSize != null && Number.isFinite(spec.categoryLabelFontSize)
            ? String(spec.categoryLabelFontSize)
            : ""
        );
        setBarLegendLabelFontSizeStr(
          spec.legendLabelFontSize != null && Number.isFinite(spec.legendLabelFontSize)
            ? String(spec.legendLabelFontSize)
            : ""
        );
        setSliceBorderColor(spec.sliceBorderColor ?? "");
        setChartShadow(spec.shadow === true);
        setShowSegmentLabels(true);
        setShowLineArea(spec.showAreaFill !== false);
        setLineSmooth(spec.smooth !== false);
        setShowLineDots(spec.showDots !== false);
        setLineDotRadius(
          typeof spec.dotRadius === "number" && Number.isFinite(spec.dotRadius)
            ? Math.min(3, Math.max(0, spec.dotRadius))
            : 1.85
        );
        {
          const borderStyle = node.borderStyle ?? "solid";
          const nodeStrokeW = borderStyle === "none" ? 0 : node.borderWidth ?? 2;
          const legacyLineW = lineChartPolylineStrokeFallbackFromNodeBorder(nodeStrokeW);
          setLineStrokeWidth(
            typeof spec.lineStrokeWidth === "number" && Number.isFinite(spec.lineStrokeWidth)
              ? Math.min(
                  LINE_CHART_POLYLINE_STROKE_MAX,
                  Math.max(LINE_CHART_POLYLINE_STROKE_MIN, spec.lineStrokeWidth)
                )
              : legacyLineW
          );
        }
        setLineAreaOpacity(
          typeof spec.areaFillOpacity === "number" && Number.isFinite(spec.areaFillOpacity)
            ? Math.min(1, Math.max(0, spec.areaFillOpacity))
            : 0.42
        );
        setValuesLocked(spec.valuesLocked === true);
        if (nextBar.length > 2) {
          setCollapsedBarIds(new Set(nextBar.map((r) => r.id)));
        } else {
          setCollapsedBarIds(new Set());
        }
        return;
      }

      if (isBar) {
        const spec: NodeChartSpecBar =
          chart?.kind === "bar" ? chart : defaultBarChartSpec();
        const series: ChartBarSegmentItem[] = spec.series?.length
          ? spec.series.map((s) => ({ ...s, values: [...(s.values ?? [])] }))
          : defaultBarChartSpec().series;
        const nextBar: BarEditRow[] = series.map((s) => {
          const fs = sliceFillStyleFromSeries(s);
          const gc = s.gradientColors;
          return {
            id: s.id || newChartSliceId(),
            name: s.name,
            valuesStr: chartValuesStrForEditorDisplay(s.values ?? [], s.valuesExpr),
            fillStyle: fs,
            color: s.color ?? "",
            gradientColor1: gc?.[0] ?? "",
            gradientColor2: gc?.[1] ?? "",
            labelColor: s.labelColor ?? "",
            labelFontSizeStr:
              s.labelFontSize != null && Number.isFinite(s.labelFontSize)
                ? String(s.labelFontSize)
                : "",
          };
        });
        setBarRows(nextBar);
        setCategoryLabelsStr(
          Array.isArray(spec.categoryLabels) ? spec.categoryLabels.join(", ") : ""
        );
        setValuesLocked(spec.valuesLocked === true);
        setStacked100(spec.stacked100 === true);
        setBarVertical(spec.vertical !== false);
        setCategoryGap(
          typeof spec.categoryGap === "number" && spec.categoryGap >= 0
            ? Math.min(0.85, spec.categoryGap)
            : 0.22
        );
        setStackGap(
          typeof spec.stackGap === "number" && spec.stackGap >= 0
            ? Math.min(2, spec.stackGap)
            : 0.12
        );
        setRoundedColumnEnds(barChartWantsRoundedColumnEnds(spec));
        setShowGridX(spec.showGridX === true);
        setShowGridY(spec.showGridY === true);
        setGridColor(spec.gridColor ?? "");
        setShowValueAxis(spec.showValueAxis !== false);
        setAxisColor(spec.axisColor ?? "");
        setShowCategoryLabels(spec.showCategoryLabels !== false);
        setShowBarSegmentValues(spec.showSegmentValues === true);
        setShowBarLegend(spec.showLegend === true);
        setBarCategoryLabelFontSizeStr(
          spec.categoryLabelFontSize != null && Number.isFinite(spec.categoryLabelFontSize)
            ? String(spec.categoryLabelFontSize)
            : ""
        );
        setBarLegendLabelFontSizeStr(
          spec.legendLabelFontSize != null && Number.isFinite(spec.legendLabelFontSize)
            ? String(spec.legendLabelFontSize)
            : ""
        );
        setSliceBorderColor(spec.sliceBorderColor ?? "");
        setChartShadow(spec.shadow === true);
        setShowSegmentLabels(spec.showSegmentLabels !== false);
        if (nextBar.length > 2) {
          setCollapsedBarIds(new Set(nextBar.map((r) => r.id)));
        } else {
          setCollapsedBarIds(new Set());
        }
        return;
      }

      if (isRing) {
        const spec: NodeChartSpecRing =
          chart?.kind === "ring" ? chart : defaultRingChartSpec();
        const series: ChartRingSeriesItem[] =
          spec.series?.length > 0 ? spec.series.map((s) => ({ ...s })) : defaultRingChartSpec().series;
        const nextRows: RingModalEditRow[] = series.map((s) => {
          const fs = sliceFillStyleFromSeries(s);
          const gc = s.gradientColors;
          return {
            id: s.id || newChartSliceId(),
            name: s.name,
            valueStr: chartValueForEditorDisplay(
              typeof s.value === "number" ? s.value : Number(s.value),
              s.valueExpr,
            ),
            fillStyle: fs,
            color: s.color ?? "",
            gradientColor1: gc?.[0] ?? "",
            gradientColor2: gc?.[1] ?? "",
            labelColor: s.labelColor ?? "",
            labelFontSizeStr:
              s.labelFontSize != null && Number.isFinite(s.labelFontSize)
                ? String(s.labelFontSize)
                : "",
            ringThicknessStr:
              s.ringThickness != null && Number.isFinite(s.ringThickness)
                ? String(s.ringThickness)
                : "",
            ringRadialOffsetStr:
              s.ringRadialOffset != null && Number.isFinite(s.ringRadialOffset)
                ? String(s.ringRadialOffset)
                : "",
            sliceOutlineColorStr: s.sliceOutlineColor ?? "",
            sliceOutlineWidthStr:
              s.sliceOutlineWidth != null && Number.isFinite(s.sliceOutlineWidth)
                ? String(s.sliceOutlineWidth)
                : "",
          };
        });
        setRingRows(nextRows);
        setSliceBorderColor(spec.sliceBorderColor ?? "");
        setChartShadow(spec.shadow === true);
        setShowSegmentLabels(spec.showSegmentLabels !== false);
        setValuesLocked(spec.valuesLocked === true);
        setRingInnerRadius(
          typeof spec.innerRadius === "number" && Number.isFinite(spec.innerRadius)
            ? Math.min(26, Math.max(2, spec.innerRadius))
            : DEFAULT_RING_INNER_RADIUS
        );
        setRingAngularGapDeg(
          typeof spec.segmentAngularGapDeg === "number" && Number.isFinite(spec.segmentAngularGapDeg)
            ? Math.min(8, Math.max(0, spec.segmentAngularGapDeg))
            : 2
        );
        {
          const borderStyle = node.borderStyle ?? "solid";
          const nw = borderStyle === "none" ? 0 : node.borderWidth ?? 2;
          const specW = spec.sliceBorderWidth;
          const baseW =
            typeof specW === "number" && Number.isFinite(specW)
              ? Math.max(0, Math.min(5, specW))
              : Math.max(0.25, Math.min(5, nw));
          setRingDefaultOutlineWidthVb(baseW);
        }
        if (nextRows.length > 2) {
          setCollapsedRingIds(new Set(nextRows.map((r) => r.id)));
        } else {
          setCollapsedRingIds(new Set());
        }
        return;
      }

      let spec: NodeChartSpecPie = defaultPieChartSpec();
      if (chart?.kind === "pie") {
        spec = chart;
      } else {
        const legacy = chart as unknown as
          | {
              series?: ChartSeriesItem[];
              sliceBorderColor?: string;
              shadow?: boolean;
              segmentGapDeg?: number;
              showSegmentLabels?: boolean;
            }
          | undefined;
        if (
          legacy &&
          Array.isArray(legacy.series) &&
          legacy.series[0] &&
          typeof legacy.series[0].value === "number"
        ) {
          spec = {
            kind: "pie",
            series: legacy.series,
            sliceBorderColor: legacy.sliceBorderColor,
            shadow: legacy.shadow,
            segmentGapDeg: legacy.segmentGapDeg,
            showSegmentLabels: legacy.showSegmentLabels,
          };
        }
      }
      const series: ChartSeriesItem[] = spec.series?.length
        ? spec.series.map((s) => ({ ...s }))
        : defaultPieChartSpec().series;
      const nextRows: EditRow[] = series.map((s) => {
        const fs = sliceFillStyleFromSeries(s);
        const gc = s.gradientColors;
        return {
          id: s.id || newChartSliceId(),
          name: s.name,
          valueStr: chartValueForEditorDisplay(
            typeof s.value === "number" ? s.value : Number(s.value),
            s.valueExpr,
          ),
          fillStyle: fs,
          color: s.color ?? "",
          gradientColor1: gc?.[0] ?? "",
          gradientColor2: gc?.[1] ?? "",
          labelColor: s.labelColor ?? "",
          labelFontSizeStr:
            s.labelFontSize != null && Number.isFinite(s.labelFontSize)
              ? String(s.labelFontSize)
              : "",
          segmentPullStr:
            s.segmentPull != null && Number.isFinite(s.segmentPull)
              ? String(
                  Math.min(
                    CHART_MAX_PER_SLICE_SEGMENT_PULL,
                    Math.max(0, s.segmentPull)
                  )
                )
              : "",
        };
      });
      setRows(nextRows);
      setSliceBorderColor(spec.sliceBorderColor ?? "");
      setChartShadow(spec.shadow === true);
      setShowSegmentLabels(spec.showSegmentLabels !== false);
      setSegmentGapDeg(
        typeof spec.segmentGapDeg === "number" && spec.segmentGapDeg > 0
          ? Math.min(CHART_MAX_SEGMENT_PULL, spec.segmentGapDeg)
          : 0
      );
      setValuesLocked(spec.valuesLocked === true);
      if (nextRows.length > 2) {
        setCollapsedSliceIds(new Set(nextRows.map((r) => r.id)));
      } else {
        setCollapsedSliceIds(new Set());
      }
    }
  }, [visible, node]);

  const toggleSliceCollapsed = (id: string) => {
    setCollapsedSliceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reorderRows = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= rows.length ||
      toIndex >= rows.length
    ) {
      return;
    }
    setRows((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const reorderBarRows = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= barRows.length ||
      toIndex >= barRows.length
    ) {
      return;
    }
    setBarRows((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const toggleBarCollapsed = (id: string) => {
    setCollapsedBarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateBarRow = (i: number, patch: Partial<BarEditRow>) =>
    setBarRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addBarRow = () =>
    setBarRows((prev) => [
      ...prev,
      {
        id: newChartSliceId(),
        name: `Segment ${prev.length + 1}`,
        valuesStr: prev[0]?.valuesStr ?? "0",
        fillStyle: "solid",
        color: "",
        gradientColor1: "",
        gradientColor2: "",
        labelColor: "",
        labelFontSizeStr: "",
      },
    ]);

  const removeBarRow = (i: number) =>
    setBarRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  useEffect(() => {
    if (visible) {
      const modalWidth = 460;
      const modalHeight = 760;
      const padding = 8;
      let posX = x;
      let posY = y;
      if (x + modalWidth > window.innerWidth - padding)
        posX = Math.max(padding, window.innerWidth - modalWidth - padding);
      if (y + modalHeight > window.innerHeight - padding)
        posY = Math.max(padding, window.innerHeight - modalHeight - padding);
      if (posX < padding) posX = padding;
      if (posY < padding) posY = padding;
      setPosition({ x: posX, y: posY });
    }
  }, [visible, x, y]);

  useEffect(() => {
    if (visible) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      const focusableElement = panelRef.current?.querySelector(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      ) as HTMLElement;
      focusableElement?.focus();

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        const focusableElements = panelRef.current?.querySelectorAll(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        ) as NodeListOf<HTMLElement>;
        if (!focusableElements || focusableElements.length === 0) return;
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      };
      document.addEventListener("keydown", handleTab);
      return () => {
        document.removeEventListener("keydown", handleTab);
        previousActiveElementRef.current?.focus();
      };
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-radix-select-content]")) return;
      if (target.closest("[data-radix-select-viewport]")) return;
      if (target.closest("[data-radix-select-item]")) return;
      if (target.closest("[data-radix-popover-content]")) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  const handleSave = () => {
    if (!node || isReadOnly) return;
    const isGrid = node.type === "generic.chart.grid" || node.chart?.kind === "grid";
    const isGantt = node.type === "generic.chart.gantt" || node.chart?.kind === "gantt";
    const isLoop = node.type === "generic.chart.loop" || node.chart?.kind === "loop";
    const isArrow = node.type === "generic.chart.arrow" || node.chart?.kind === "arrow";
    const isBar = node.type === "generic.chart.bar" || node.chart?.kind === "bar";
    const isLine = node.type === "generic.chart.line" || node.chart?.kind === "line";
    const isRing = node.type === "generic.chart.ring" || node.chart?.kind === "ring";

    const failSave = (message: string) => {
      toast({
        title: "Invalid chart value",
        description: message,
        variant: "destructive",
      });
    };

    if (isLine) {
      const labelParts = categoryLabelsStr
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const rawLens = barRows.map((r) => splitChartValuesList(String(r.valuesStr ?? "")).length);
      const maxCat = Math.max(1, labelParts.length, ...rawLens, 0);
      if (barRows.length === 0) {
        onSave(node.id, randomLineChartSpec());
        onClose();
        return;
      }
      const series: ChartBarSegmentItem[] = [];
      for (let i = 0; i < barRows.length; i++) {
        const r = barRows[i];
        const parsed = parseChartValuesListForSave(
          String(r.valuesStr ?? ""),
          maxCat,
          globalProperties,
          globalVariableContext,
        );
        if (!parsed.ok) {
          failSave(`${(r.name ?? "").trim() || `Series ${i + 1}`}: ${parsed.error}`);
          return;
        }
        const name = (r.name ?? "").trim() || `Series ${i + 1}`;
        const base: ChartBarSegmentItem = {
          id: r.id || newChartSliceId(),
          name,
          values: parsed.values,
          ...(parsed.valuesExpr ? { valuesExpr: parsed.valuesExpr } : {}),
        };
        if (r.labelColor.trim()) base.labelColor = r.labelColor.trim();
        const lfsRaw = Number(String(r.labelFontSizeStr ?? "").trim().replace(/,/g, "."));
        if (Number.isFinite(lfsRaw) && lfsRaw > 0) {
          base.labelFontSize = Math.min(14, Math.max(2, lfsRaw));
        }
        if (r.fillStyle === "none") {
          base.fillStyle = "none";
          if (r.color.trim()) base.color = r.color.trim();
          series.push(base);
          continue;
        }
        if (r.fillStyle === "gradient") {
          base.fillStyle = "gradient";
          const g1 = r.gradientColor1.trim();
          const g2 = r.gradientColor2.trim();
          const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
          base.gradientColors = [g1 || fb, g2 || g1 || fb] as [string, string];
          series.push(base);
          continue;
        }
        base.fillStyle = "solid";
        if (r.color.trim()) base.color = r.color.trim();
        series.push(base);
      }
      const lineChart: NodeChartSpecLine = {
        kind: "line",
        series,
        ...(valuesLocked ? { valuesLocked: true } : {}),
        ...(labelParts.length ? { categoryLabels: labelParts.slice(0, maxCat) } : {}),
        ...(showLineArea ? { showAreaFill: true } : { showAreaFill: false }),
        areaFillOpacity: Math.min(1, Math.max(0, lineAreaOpacity)),
        ...(lineSmooth ? { smooth: true } : { smooth: false }),
        ...(showLineDots ? { showDots: true } : { showDots: false }),
        dotRadius: Math.min(3, Math.max(0, lineDotRadius)),
        lineStrokeWidth: Math.min(
          LINE_CHART_POLYLINE_STROKE_MAX,
          Math.max(LINE_CHART_POLYLINE_STROKE_MIN, lineStrokeWidth)
        ),
        ...(sliceBorderColor.trim() ? { sliceBorderColor: sliceBorderColor.trim() } : {}),
        ...(chartShadow ? { shadow: true } : {}),
        ...(showGridX ? { showGridX: true } : {}),
        ...(showGridY ? { showGridY: true } : {}),
        ...(gridColor.trim() ? { gridColor: gridColor.trim() } : {}),
        ...(!showValueAxis ? { showValueAxis: false } : {}),
        ...(axisColor.trim() ? { axisColor: axisColor.trim() } : {}),
        ...(!showCategoryLabels ? { showCategoryLabels: false } : {}),
        ...(showBarLegend ? { showLegend: true } : {}),
      };
      const catLfs = Number(
        String(barCategoryLabelFontSizeStr ?? "").trim().replace(/,/g, ".")
      );
      if (Number.isFinite(catLfs) && catLfs > 0) {
        lineChart.categoryLabelFontSize = Math.min(14, Math.max(2, catLfs));
      }
      const legLfs = Number(
        String(barLegendLabelFontSizeStr ?? "").trim().replace(/,/g, ".")
      );
      if (Number.isFinite(legLfs) && legLfs > 0) {
        lineChart.legendLabelFontSize = Math.min(14, Math.max(2, legLfs));
      }
      onSave(node.id, lineChart);
      onClose();
      return;
    }

    if (isBar) {
      const labelParts = categoryLabelsStr
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const rawLens = barRows.map((r) => splitChartValuesList(String(r.valuesStr ?? "")).length);
      const maxCat = Math.max(1, labelParts.length, ...rawLens, 0);
      if (barRows.length === 0) {
        onSave(node.id, defaultBarChartSpec());
        onClose();
        return;
      }
      const series: ChartBarSegmentItem[] = [];
      for (let i = 0; i < barRows.length; i++) {
        const r = barRows[i];
        const parsed = parseChartValuesListForSave(
          String(r.valuesStr ?? ""),
          maxCat,
          globalProperties,
          globalVariableContext,
        );
        if (!parsed.ok) {
          failSave(`${(r.name ?? "").trim() || `Segment ${i + 1}`}: ${parsed.error}`);
          return;
        }
        const name = (r.name ?? "").trim() || `Segment ${i + 1}`;
        const base: ChartBarSegmentItem = {
          id: r.id || newChartSliceId(),
          name,
          values: parsed.values,
          ...(parsed.valuesExpr ? { valuesExpr: parsed.valuesExpr } : {}),
        };
        if (r.labelColor.trim()) base.labelColor = r.labelColor.trim();
        const lfsRaw = Number(String(r.labelFontSizeStr ?? "").trim().replace(/,/g, "."));
        if (Number.isFinite(lfsRaw) && lfsRaw > 0) {
          base.labelFontSize = Math.min(14, Math.max(2, lfsRaw));
        }
        if (r.fillStyle === "none") {
          base.fillStyle = "none";
          if (r.color.trim()) base.color = r.color.trim();
          series.push(base);
          continue;
        }
        if (r.fillStyle === "gradient") {
          base.fillStyle = "gradient";
          const g1 = r.gradientColor1.trim();
          const g2 = r.gradientColor2.trim();
          const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
          base.gradientColors = [g1 || fb, g2 || g1 || fb] as [string, string];
          series.push(base);
          continue;
        }
        base.fillStyle = "solid";
        if (r.color.trim()) base.color = r.color.trim();
        series.push(base);
      }
      const barChart: NodeChartSpecBar = {
        kind: "bar",
        series,
        ...(valuesLocked ? { valuesLocked: true } : {}),
        ...(labelParts.length ? { categoryLabels: labelParts.slice(0, maxCat) } : {}),
        ...(stacked100 ? { stacked100: true } : {}),
        ...(barVertical ? { vertical: true } : { vertical: false }),
        categoryGap: Math.min(0.85, Math.max(0, categoryGap)),
        stackGap: Math.min(2, Math.max(0, stackGap)),
        ...(roundedColumnEnds ? { roundedColumnEnds: true } : {}),
        ...(sliceBorderColor.trim() ? { sliceBorderColor: sliceBorderColor.trim() } : {}),
        ...(chartShadow ? { shadow: true } : {}),
        ...(!showSegmentLabels ? { showSegmentLabels: false } : {}),
        ...(showGridX ? { showGridX: true } : {}),
        ...(showGridY ? { showGridY: true } : {}),
        ...(gridColor.trim() ? { gridColor: gridColor.trim() } : {}),
        ...(!showValueAxis ? { showValueAxis: false } : {}),
        ...(axisColor.trim() ? { axisColor: axisColor.trim() } : {}),
        ...(!showCategoryLabels ? { showCategoryLabels: false } : {}),
        ...(showBarSegmentValues ? { showSegmentValues: true } : {}),
        ...(showBarLegend ? { showLegend: true } : {}),
      };
      const catLfs = Number(
        String(barCategoryLabelFontSizeStr ?? "").trim().replace(/,/g, ".")
      );
      if (Number.isFinite(catLfs) && catLfs > 0) {
        barChart.categoryLabelFontSize = Math.min(14, Math.max(2, catLfs));
      }
      const legLfs = Number(
        String(barLegendLabelFontSizeStr ?? "").trim().replace(/,/g, ".")
      );
      if (Number.isFinite(legLfs) && legLfs > 0) {
        barChart.legendLabelFontSize = Math.min(14, Math.max(2, legLfs));
      }
      onSave(node.id, barChart);
      onClose();
      return;
    }

    if (isRing) {
      if (ringRows.length === 0) {
        onSave(node.id, defaultRingChartSpec());
        onClose();
        return;
      }
      const series: ChartRingSeriesItem[] = [];
      for (let i = 0; i < ringRows.length; i++) {
        const r = ringRows[i];
        const parsed = parseChartScalarForSave(
          String(r.valueStr ?? ""),
          globalProperties,
          globalVariableContext,
        );
        if (!parsed.ok) {
          failSave(`${(r.name ?? "").trim() || `Segment ${i + 1}`}: ${parsed.error}`);
          return;
        }
        const name = (r.name ?? "").trim() || `Segment ${i + 1}`;
        const row: ChartRingSeriesItem = {
          id: r.id || newChartSliceId(),
          name,
          value: parsed.value,
          ...(parsed.valueExpr ? { valueExpr: parsed.valueExpr } : {}),
        };
        if (r.labelColor.trim()) row.labelColor = r.labelColor.trim();
        const lfsRaw = Number(String(r.labelFontSizeStr ?? "").trim().replace(/,/g, "."));
        if (Number.isFinite(lfsRaw) && lfsRaw > 0) {
          row.labelFontSize = Math.min(14, Math.max(2, lfsRaw));
        }
        const thRaw = Number(String(r.ringThicknessStr ?? "").trim().replace(/,/g, "."));
        if (String(r.ringThicknessStr ?? "").trim() !== "" && Number.isFinite(thRaw)) {
          row.ringThickness = Math.min(24, Math.max(2, thRaw));
        }
        const roRaw = Number(String(r.ringRadialOffsetStr ?? "").trim().replace(/,/g, "."));
        if (String(r.ringRadialOffsetStr ?? "").trim() !== "" && Number.isFinite(roRaw)) {
          row.ringRadialOffset = Math.min(14, Math.max(-8, roRaw));
        }
        if (r.sliceOutlineColorStr.trim()) {
          row.sliceOutlineColor = r.sliceOutlineColorStr.trim();
        }
        const owRaw = Number(String(r.sliceOutlineWidthStr ?? "").trim().replace(/,/g, "."));
        if (String(r.sliceOutlineWidthStr ?? "").trim() !== "" && Number.isFinite(owRaw)) {
          row.sliceOutlineWidth = Math.max(0, Math.min(5, owRaw));
        }
        if (r.fillStyle === "none") {
          row.fillStyle = "none";
          series.push(row);
          continue;
        }
        if (r.fillStyle === "gradient") {
          row.fillStyle = "gradient";
          const g1 = r.gradientColor1.trim();
          const g2 = r.gradientColor2.trim();
          const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
          row.gradientColors = [g1 || fb, g2 || g1 || fb] as [string, string];
          series.push(row);
          continue;
        }
        row.fillStyle = "solid";
        if (r.color.trim()) row.color = r.color.trim();
        series.push(row);
      }
      const ringChartSaved: NodeChartSpecRing = {
        kind: "ring",
        series,
        ...(valuesLocked ? { valuesLocked: true } : {}),
        ...(sliceBorderColor.trim() ? { sliceBorderColor: sliceBorderColor.trim() } : {}),
        sliceBorderWidth: Math.max(0, Math.min(5, ringDefaultOutlineWidthVb)),
        ...(chartShadow ? { shadow: true } : {}),
        ...(!showSegmentLabels ? { showSegmentLabels: false } : {}),
        innerRadius: Math.min(26, Math.max(2, ringInnerRadius)),
        segmentAngularGapDeg: Math.min(8, Math.max(0, ringAngularGapDeg)),
      };
      onSave(node.id, ringChartSaved);
      onClose();
      return;
    }

    if (isGantt) {
      const spec =
        node.chart?.kind === "gantt" ? node.chart : defaultGanttChartSpec();
      onSave(node.id, spec);
      onClose();
      return;
    }

    if (isLoop) {
      const spec =
        node.chart?.kind === "loop" ? node.chart : defaultLoopChartSpec();
      onSave(node.id, spec);
      onClose();
      return;
    }

    if (isArrow) {
      const spec =
        node.chart?.kind === "arrow" ? node.chart : defaultArrowChartSpec();
      onSave(node.id, spec);
      onClose();
      return;
    }

    if (isGrid) {
      const cols = Math.min(24, Math.max(1, Math.round(gridCols)));
      const rows = Math.min(24, Math.max(1, Math.round(gridRows)));
      const colTitles = gridColumnTitlesStr
        .split(/[,;\n]+/)
        .map((s) => s.trim());
      const rowTitles = gridRowTitlesStr
        .split(/[,;\n]+/)
        .map((s) => s.trim());
      const existingGrid =
        node.chart?.kind === "grid" ? (node.chart as NodeChartSpecGrid) : undefined;
      const priorCells = resizeGridChartCells(
        existingGrid ?? { kind: "grid", cols, rows, cells: [] },
        cols,
        rows
      ).cells;
      const cells: ChartGridCell[] = gridCellRows.slice(0, cols * rows).map((row, i) => {
        const base: ChartGridCell = {
          id: row.id || newChartSliceId(),
          filled: row.filled && row.fillStyle !== "none",
        };
        const plain = row.text.trim();
        if (plain) base.text = plain;
        const prior = priorCells[i];
        if (prior?.richText?.length) {
          const priorPlain = getPlainTextFromRuns(
            prior.richText ?? labelToRuns(prior.text)
          ).trim();
          if (plain === priorPlain)
            base.richText = gridChartCellRunsCentered(prior.richText);
        }
        if (row.labelColor.trim()) base.labelColor = row.labelColor.trim();
        if (!base.filled) {
          base.fillStyle = "none";
          return base;
        }
        if (
          row.fillStyle === "hue-step" ||
          row.fillStyle === "theme-hue" ||
          row.fillStyle === "default"
        ) {
          if (row.fillStyle === "default") {
            base.fillStyle = "default";
          } else {
            base.fillStyle = row.fillStyle;
          }
          return base;
        }
        if (row.fillStyle === "none") {
          base.filled = false;
          base.fillStyle = "none";
          return base;
        }
        if (row.fillStyle === "gradient") {
          base.fillStyle = "gradient";
          const g1 = row.gradientColor1.trim();
          const g2 = row.gradientColor2.trim();
          const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
          base.gradientColors = [g1 || fb, g2 || g1 || fb] as [string, string];
          return base;
        }
        base.fillStyle = "solid";
        if (row.color.trim()) base.color = row.color.trim();
        return base;
      });
      const gridChart: NodeChartSpecGrid = {
        kind: "grid",
        cols,
        rows,
        cells,
        ...(gridTitle.trim() ? { title: gridTitle.trim() } : {}),
        ...(existingGrid?.richTitle &&
        gridTitle.trim() === (existingGrid.title ?? "").trim()
          ? { richTitle: existingGrid.richTitle }
          : {}),
        ...(colTitles.some(Boolean) ? { columnTitles: colTitles } : {}),
        ...(existingGrid?.richColumnTitles &&
        gridColumnTitlesStr.trim() === (existingGrid.columnTitles ?? []).join(", ").trim()
          ? { richColumnTitles: existingGrid.richColumnTitles }
          : {}),
        ...(rowTitles.some(Boolean) ? { rowTitles: rowTitles } : {}),
        ...(existingGrid?.richRowTitles &&
        gridRowTitlesStr.trim() === (existingGrid.rowTitles ?? []).join(", ").trim()
          ? { richRowTitles: existingGrid.richRowTitles }
          : {}),
        cellGap: Math.min(24, Math.max(0, Math.round(gridCellGap))),
        ...(gridShowLines ? { showGridLines: true } : { showGridLines: false }),
        ...(gridLineColor.trim() ? { gridLineColor: gridLineColor.trim() } : {}),
        ...(gridAxisColor.trim() ? { axisColor: gridAxisColor.trim() } : {}),
        canvasPaintFill: gridCanvasPaintFill,
        hueStepDirection: gridHueStepDirection,
        ...(gridDefaultCellFill.trim()
          ? { defaultCellFill: gridDefaultCellFill.trim() }
          : {}),
        ...(gridDefaultCellLabelColor.trim()
          ? { defaultCellLabelColor: gridDefaultCellLabelColor.trim() }
          : {}),
        ...(gridCanvasPaintFill === "gradient"
          ? {
              canvasPaintGradientColors: [
                gridCanvasPaintGradient1.trim() || DEFAULT_PIE_SLICE_COLORS[0],
                gridCanvasPaintGradient2.trim() ||
                  gridCanvasPaintGradient1.trim() ||
                  DEFAULT_PIE_SLICE_COLORS[1],
              ] as [string, string],
            }
          : {}),
        ...(!gridOmitTrackWeightsOnSave && existingGrid?.columnWeights
          ? { columnWeights: existingGrid.columnWeights }
          : {}),
        ...(!gridOmitTrackWeightsOnSave && existingGrid?.rowWeights
          ? { rowWeights: existingGrid.rowWeights }
          : {}),
      };
      onSave(node.id, gridChart);
      onClose();
      return;
    }

    const cleaned: ChartSeriesItem[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const parsed = parseChartScalarForSave(
        String(r.valueStr ?? ""),
        globalProperties,
        globalVariableContext,
      );
      if (!parsed.ok) {
        failSave(`${(r.name ?? "").trim() || `Series ${i + 1}`}: ${parsed.error}`);
        return;
      }
      const name = (r.name ?? "").trim() || `Series ${i + 1}`;
      const base: ChartSeriesItem = {
        id: r.id || newChartSliceId(),
        name,
        value: parsed.value,
        ...(parsed.valueExpr ? { valueExpr: parsed.valueExpr } : {}),
      };
      if (r.labelColor.trim()) base.labelColor = r.labelColor.trim();
      const lfsRaw = Number(String(r.labelFontSizeStr ?? "").trim().replace(/,/g, "."));
      if (Number.isFinite(lfsRaw) && lfsRaw > 0) {
        base.labelFontSize = Math.min(14, Math.max(2, lfsRaw));
      }
      const spRaw = Number(String(r.segmentPullStr ?? "").trim().replace(/,/g, "."));
      if (String(r.segmentPullStr ?? "").trim() !== "" && Number.isFinite(spRaw)) {
        base.segmentPull = Math.min(
          CHART_MAX_PER_SLICE_SEGMENT_PULL,
          Math.max(0, spRaw)
        );
      }

      if (r.fillStyle === "none") {
        base.fillStyle = "none";
        cleaned.push(base);
        continue;
      }
      if (r.fillStyle === "gradient") {
        base.fillStyle = "gradient";
        const g1 = r.gradientColor1.trim();
        const g2 = r.gradientColor2.trim();
        const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
        base.gradientColors = [g1 || fb, (g2 || g1 || fb)] as [string, string];
        cleaned.push(base);
        continue;
      }
      base.fillStyle = "solid";
      if (r.color.trim()) base.color = r.color.trim();
      cleaned.push(base);
    }
    if (cleaned.length === 0) {
      onSave(node.id, defaultPieChartSpec());
      onClose();
      return;
    }
    const chart: NodeChartSpec = {
      kind: "pie",
      series: cleaned,
      ...(valuesLocked ? { valuesLocked: true } : {}),
      ...(sliceBorderColor.trim() ? { sliceBorderColor: sliceBorderColor.trim() } : {}),
      ...(chartShadow ? { shadow: true } : {}),
      ...(segmentGapDeg > 0
        ? { segmentGapDeg: Math.min(CHART_MAX_SEGMENT_PULL, segmentGapDeg) }
        : {}),
      ...(!showSegmentLabels ? { showSegmentLabels: false } : {}),
    };
    onSave(node.id, chart);
    onClose();
  };

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        id: newChartSliceId(),
        name: `Series ${prev.length + 1}`,
        valueStr: "0",
        fillStyle: "solid",
        color: "",
        gradientColor1: "",
        gradientColor2: "",
        labelColor: "",
        labelFontSizeStr: "",
        segmentPullStr: "",
      },
    ]);

  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const updateRow = (i: number, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const toggleRingCollapsed = (id: string) => {
    setCollapsedRingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reorderRingRows = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= ringRows.length ||
      toIndex >= ringRows.length
    ) {
      return;
    }
    setRingRows((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const updateRingRow = (i: number, patch: Partial<RingModalEditRow>) =>
    setRingRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRingRow = () =>
    setRingRows((prev) => [
      ...prev,
      {
        id: newChartSliceId(),
        name: `Segment ${prev.length + 1}`,
        valueStr: "1",
        fillStyle: "solid",
        color: "",
        gradientColor1: "",
        gradientColor2: "",
        labelColor: "",
        labelFontSizeStr: "",
        ringThicknessStr: "",
        ringRadialOffsetStr: "",
        sliceOutlineColorStr: "",
        sliceOutlineWidthStr: "",
      },
    ]);

  const removeRingRow = (i: number) =>
    setRingRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  if (!visible) return null;

  const isBarModal =
    !!node && (node.type === "generic.chart.bar" || node.chart?.kind === "bar");
  const isLineModal =
    !!node && (node.type === "generic.chart.line" || node.chart?.kind === "line");
  const isRingModal =
    !!node && (node.type === "generic.chart.ring" || node.chart?.kind === "ring");
  const isGridModal =
    !!node && (node.type === "generic.chart.grid" || node.chart?.kind === "grid");
  const isGanttModal =
    !!node && (node.type === "generic.chart.gantt" || node.chart?.kind === "gantt");
  const isLoopModal =
    !!node && (node.type === "generic.chart.loop" || node.chart?.kind === "loop");
  const isArrowModal =
    !!node && (node.type === "generic.chart.arrow" || node.chart?.kind === "arrow");
  const isCartesianModal = isBarModal || isLineModal;

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[60]" style={{ pointerEvents: "auto" }}>
      <Draggable
        nodeRef={panelRef}
        position={position}
        onStop={(_e, data) => setPosition({ x: data.x, y: data.y })}
        handle=".chart-data-modal-drag-handle"
      >
        <div
          ref={panelRef}
          className="fixed z-[70] w-[460px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-0 shadow-lg"
        >
          <div className="chart-data-modal-drag-handle flex cursor-move items-center justify-between border-b px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <BarChart2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <h3 className="truncate text-sm font-semibold text-foreground">Chart data</h3>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>
          <div className="max-h-[min(580px,72vh)] space-y-4 overflow-y-auto p-5">
            {isCartesianModal ? (
              <>
                <ChartModalSection title="Outline & display" tint="muted">
                  <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[10px] text-muted-foreground">
                          {isLineModal ? "Line outline" : "Segment outline"}
                        </Label>
                        {!isReadOnly && sliceBorderColor.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-muted-foreground"
                            onClick={() => setSliceBorderColor("")}
                          >
                            Use node border
                          </Button>
                        ) : null}
                      </div>
                      <ColorPicker
                        value={sliceBorderColor.trim() ? sliceBorderColor : "#6b7280"}
                        onChange={(value) => setSliceBorderColor(value)}
                        placeholder="#6b7280"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                           <div className="flex items-center gap-2">
                        <Label htmlFor="chart-data-bar-shadow" className="text-xs font-medium">
                          Chart shadow
                        </Label>
                        <Switch
                          id="chart-data-bar-shadow"
                          checked={chartShadow}
                          onCheckedChange={setChartShadow}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-data-lock-values" className="text-xs font-medium">
                          Lock segment values
                        </Label>
                        <Switch
                          id="chart-data-lock-values"
                          checked={valuesLocked}
                          onCheckedChange={setValuesLocked}
                          disabled={isReadOnly}
                        />
                      </div>
                      {!isLineModal ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="chart-data-bar-seg-lbl" className="text-xs font-medium">
                              Segment labels
                            </Label>
                            <Switch
                              id="chart-data-bar-seg-lbl"
                              checked={showSegmentLabels}
                              onCheckedChange={setShowSegmentLabels}
                              disabled={isReadOnly}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="chart-data-bar-stacked100" className="text-xs font-medium">
                              100% stacked
                            </Label>
                            <Switch
                              id="chart-data-bar-stacked100"
                              checked={stacked100}
                              onCheckedChange={setStacked100}
                              disabled={isReadOnly}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </ChartModalSection>
                    {isLineModal ? (
                <ChartModalSection title="Line style" tint="emerald">
                  <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="chart-line-area" className="text-xs font-medium">
                              Area under lines
                            </Label>
                            <Switch
                              id="chart-line-area"
                              checked={showLineArea}
                              onCheckedChange={setShowLineArea}
                              disabled={isReadOnly}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="chart-line-smooth" className="text-xs font-medium">
                              Smooth curves
                            </Label>
                            <Switch
                              id="chart-line-smooth"
                              checked={lineSmooth}
                              onCheckedChange={setLineSmooth}
                              disabled={isReadOnly}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="chart-line-dots" className="text-xs font-medium">
                              Point markers
                            </Label>
                            <Switch
                              id="chart-line-dots"
                              checked={showLineDots}
                              onCheckedChange={setShowLineDots}
                              disabled={isReadOnly}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between gap-2">
                            <Label className="text-xs">Marker size</Label>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {lineDotRadius.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[lineDotRadius]}
                            onValueChange={(v) => setLineDotRadius(v[0] ?? 0)}
                            min={0}
                            max={3}
                            step={0.05}
                            disabled={isReadOnly || !showLineDots}
                          />
                          <p className="text-[10px] text-muted-foreground">
                            ViewBox units; 0 hides markers when point markers are on.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between gap-2">
                            <Label className="text-xs">Line width</Label>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {lineStrokeWidth.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[lineStrokeWidth]}
                            onValueChange={(v) => setLineStrokeWidth(v[0] ?? 1.35)}
                            min={LINE_CHART_POLYLINE_STROKE_MIN}
                            max={LINE_CHART_POLYLINE_STROKE_MAX}
                            step={0.05}
                            disabled={isReadOnly}
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Chart units; older diagrams without this still follow the shape border until you save.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between gap-2">
                            <Label className="text-xs">Area fade strength</Label>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {lineAreaOpacity.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[lineAreaOpacity]}
                            onValueChange={(v) => setLineAreaOpacity(v[0] ?? 0.42)}
                            min={0.05}
                            max={0.9}
                            step={0.01}
                            disabled={isReadOnly || !showLineArea}
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Opacity at the line; gradient falls to transparent at the baseline.
                          </p>
                        </div>
                  </div>
                </ChartModalSection>
                    ) : null}
                    {!isLineModal ? (
                <ChartModalSection title="Bar layout" tint="amber">
                  <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Orientation</Label>
                          <Select
                            value={barVertical ? "vertical" : "horizontal"}
                            onValueChange={(v) => setBarVertical(v === "vertical")}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              <SelectItem value="vertical">Vertical (categories on X)</SelectItem>
                              <SelectItem value="horizontal">Horizontal (categories on Y)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between gap-2">
                            <Label className="text-xs">Category spacing</Label>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {categoryGap.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[categoryGap]}
                            onValueChange={(v) => setCategoryGap(v[0] ?? 0)}
                            min={0}
                            max={0.8}
                            step={0.02}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between gap-2">
                            <Label className="text-xs">Stack segment gap</Label>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {stackGap.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[stackGap]}
                            onValueChange={(v) => setStackGap(v[0] ?? 0)}
                            min={0}
                            max={0.5}
                            step={0.02}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="chart-bar-rounded-ends" className="text-xs font-medium">
                            Rounded column ends
                          </Label>
                          <Switch
                            id="chart-bar-rounded-ends"
                            checked={roundedColumnEnds}
                            onCheckedChange={setRoundedColumnEnds}
                            disabled={isReadOnly}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Rounds the whole column cap (stacked columns use one outline; inner segment edges stay straight).
                        </p>
                  </div>
                </ChartModalSection>
                    ) : null}
                <ChartModalSection title="Axes, grid & legend" tint="purple">
                  <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-bar-grid-v" className="text-xs font-medium">
                          Vertical grid
                        </Label>
                        <Switch
                          id="chart-bar-grid-v"
                          checked={showGridX}
                          onCheckedChange={setShowGridX}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-bar-grid-h" className="text-xs font-medium">
                          Horizontal grid
                        </Label>
                        <Switch
                          id="chart-bar-grid-h"
                          checked={showGridY}
                          onCheckedChange={setShowGridY}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-bar-axis-num" className="text-xs font-medium">
                          Value axis numbers
                        </Label>
                        <Switch
                          id="chart-bar-axis-num"
                          checked={showValueAxis}
                          onCheckedChange={setShowValueAxis}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-bar-cat-show" className="text-xs font-medium">
                          Category labels
                        </Label>
                        <Switch
                          id="chart-bar-cat-show"
                          checked={showCategoryLabels}
                          onCheckedChange={setShowCategoryLabels}
                          disabled={isReadOnly}
                        />
                      </div>
                      {!isLineModal ? (
                        <div className="flex items-center gap-2">
                          <Label htmlFor="chart-bar-seg-val" className="text-xs font-medium">
                            Values in segments
                          </Label>
                          <Switch
                            id="chart-bar-seg-val"
                            checked={showBarSegmentValues}
                            onCheckedChange={setShowBarSegmentValues}
                            disabled={isReadOnly}
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-bar-legend" className="text-xs font-medium">
                          Bottom legend
                        </Label>
                        <Switch
                          id="chart-bar-legend"
                          checked={showBarLegend}
                          onCheckedChange={setShowBarLegend}
                          disabled={isReadOnly}
                        />
                      </div>
                    </div>
                    <div className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}>
                      <Label className="text-[10px] text-muted-foreground">Grid line color</Label>
                      <ColorPicker
                        value={gridColor.trim() ? gridColor : "#94a3b8"}
                        onChange={(value) => setGridColor(value)}
                        placeholder="#94a3b8"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    </div>
                    <div className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}>
                      <Label className="text-[10px] text-muted-foreground">Axis text color</Label>
                      <ColorPicker
                        value={axisColor.trim() ? axisColor : "#64748b"}
                        onChange={(value) => setAxisColor(value)}
                        placeholder="#64748b"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    </div>
                    {(() => {
                      const catFsState = barOptionalFontSliderState(
                        barCategoryLabelFontSizeStr,
                        DEFAULT_BAR_CATEGORY_LABEL_FONT
                      );
                      const legFsState = barOptionalFontSliderState(
                        barLegendLabelFontSizeStr,
                        DEFAULT_BAR_LEGEND_LABEL_FONT
                      );
                      return (
                        <>
                          <div
                            className={`space-y-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-[10px] text-muted-foreground">
                                Category label size
                              </Label>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {catFsState.hasCustom
                                    ? catFsState.sliderValue
                                    : "Default"}
                                </span>
                                {!isReadOnly && catFsState.hasCustom ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-muted-foreground"
                                    onClick={() => setBarCategoryLabelFontSizeStr("")}
                                  >
                                    Use default
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            <Slider
                              value={[catFsState.sliderValue]}
                              onValueChange={(v) => {
                                const next = v[0];
                                if (next == null) return;
                                setBarCategoryLabelFontSizeStr(String(next));
                              }}
                              min={2}
                              max={14}
                              step={0.25}
                              disabled={isReadOnly}
                            />
                          </div>
                          <div
                            className={`space-y-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-[10px] text-muted-foreground">
                                Legend label size
                              </Label>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {legFsState.hasCustom
                                    ? legFsState.sliderValue
                                    : "Default"}
                                </span>
                                {!isReadOnly && legFsState.hasCustom ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-muted-foreground"
                                    onClick={() => setBarLegendLabelFontSizeStr("")}
                                  >
                                    Use default
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            <Slider
                              value={[legFsState.sliderValue]}
                              onValueChange={(v) => {
                                const next = v[0];
                                if (next == null) return;
                                setBarLegendLabelFontSizeStr(String(next));
                              }}
                              min={2}
                              max={14}
                              step={0.25}
                              disabled={isReadOnly}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </ChartModalSection>
                <ChartModalSection
                  title={isLineModal ? "Categories & series" : "Categories & stack segments"}
                  tint="sky"
                  headerRight={
                    !isReadOnly ? (
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addBarRow}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    ) : undefined
                  }
                >
                  <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Category names (comma-separated)
                  </Label>
                  <Input
                    value={categoryLabelsStr}
                    onChange={(e) => setCategoryLabelsStr(e.target.value)}
                    placeholder="A, B, C, D"
                    className="h-8 text-xs"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-3">
                  {barRows.map((row, i) => {
                    const fillFallback =
                      DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
                    const collapsed = collapsedBarIds.has(row.id);
                    const summaryName =
                      (row.name ?? "").trim() ||
                      (isLineModal ? `Series ${i + 1}` : `Segment ${i + 1}`);
                    const lineSeriesPreviewColor =
                      row.fillStyle === "gradient"
                        ? row.gradientColor1.trim() || fillFallback
                        : row.color.trim() || fillFallback;
                    const { hasCustomLabelFontSize, labelSizeSliderValue } =
                      pieChartRowLabelSizeState(row.labelFontSizeStr);
                    return (
                      <BarSegmentSortableRow
                        key={row.id}
                        index={i}
                        isReadOnly={isReadOnly}
                        reorderRows={reorderBarRows}
                        className="rounded-md border border-border/60 bg-muted/20 dark:border-border dark:bg-background"
                      >
                        {(dragHandleRef) => (
                          <>
                            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/40">
                              <button
                                type="button"
                                className="shrink-0 p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => toggleBarCollapsed(row.id)}
                                aria-expanded={!collapsed}
                                aria-label={collapsed ? "Expand segment" : "Collapse segment"}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    collapsed && "-rotate-90"
                                  )}
                                />
                              </button>
                              <div
                                ref={dragHandleRef as unknown as React.Ref<HTMLDivElement>}
                                role="button"
                                tabIndex={isReadOnly ? -1 : 0}
                                className={cn(
                                  "touch-none shrink-0 p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  isReadOnly && "pointer-events-none opacity-40 cursor-default"
                                )}
                                aria-label="Drag to reorder segment"
                                onKeyDown={(e) => {
                                  if (isReadOnly) return;
                                  if (e.key === "ArrowUp" && i > 0) {
                                    e.preventDefault();
                                    reorderBarRows(i, i - 1);
                                  }
                                  if (e.key === "ArrowDown" && i < barRows.length - 1) {
                                    e.preventDefault();
                                    reorderBarRows(i, i + 1);
                                  }
                                }}
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              {collapsed ? (
                                <span className="flex flex-1 min-w-0 items-center gap-2 text-xs text-muted-foreground truncate">
                                  {isLineModal ? (
                                    <span
                                      className="h-3 w-3 shrink-0 rounded-sm border border-border/80"
                                      style={{ background: lineSeriesPreviewColor }}
                                      title="Series line color"
                                    />
                                  ) : null}
                                  <span className="truncate">
                                    {summaryName} · {row.valuesStr || "0"}
                                  </span>
                                </span>
                              ) : (
                                <div className="flex-1 min-w-0" aria-hidden />
                              )}
                              {!isReadOnly && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeBarRow(i)}
                                  disabled={barRows.length <= 1}
                                  aria-label="Remove segment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            {!collapsed ? (
                              <div className="p-2 space-y-2">
                                <Input
                                  value={row.name}
                                  onChange={(e) => updateBarRow(i, { name: e.target.value })}
                                  placeholder={isLineModal ? "Series name" : "Segment name"}
                                  className="h-8 text-xs"
                                  disabled={isReadOnly}
                                />
                                <div className="space-y-1 min-w-0">
                                  <Label className="text-[10px] text-muted-foreground">
                                    Values per column (comma-separated)
                                  </Label>
                                  <Input
                                    value={row.valuesStr}
                                    onChange={(e) => updateBarRow(i, { valuesStr: e.target.value })}
                                    placeholder="45, %sales%-%tax%"
                                    className="h-8 text-xs font-mono"
                                    disabled={isReadOnly}
                                  />
                                  <ChartValueInputHint
                                    valueStr={row.valuesStr}
                                    globalProperties={globalProperties}
                                    globalVariableContext={globalVariableContext}
                                  />
                                </div>
                                <div
                                  className={`grid grid-cols-2 gap-2 items-end ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                >
                                  <div className="space-y-1 min-w-0">
                                    <Label className="text-[10px] text-muted-foreground">
                                      {isLineModal ? "Series style" : "Fill"}
                                    </Label>
                                    <Select
                                      value={row.fillStyle}
                                      onValueChange={(v) =>
                                        updateBarRow(i, { fillStyle: v as ChartSliceFillStyle })
                                      }
                                      disabled={isReadOnly}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Fill type" />
                                      </SelectTrigger>
                                      <SelectContent className="z-[100] max-h-[min(280px,50vh)]">
                                        <SelectItem value="none">
                                          {isLineModal ? "Line only (no fill)" : "None"}
                                        </SelectItem>
                                        <SelectItem value="solid">
                                          {isLineModal ? "Solid line & area" : "Solid"}
                                        </SelectItem>
                                        <SelectItem value="gradient">
                                          {isLineModal ? "Gradient line & area" : "Gradient"}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                {isLineModal && row.fillStyle === "none" ? (
                                  <div
                                    className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                  >
                                    <Label className="text-[10px] text-muted-foreground">Line color</Label>
                                    <ColorPicker
                                      value={row.color.trim() ? row.color : fillFallback}
                                      onChange={(value) => updateBarRow(i, { color: value })}
                                      placeholder={fillFallback}
                                      showAlpha={true}
                                      allowTransparent={true}
                                    />
                                  </div>
                                ) : null}
                                {row.fillStyle === "solid" ? (
                                  <div
                                    className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                  >
                                    <Label className="text-[10px] text-muted-foreground">
                                      {isLineModal ? "Line & area color" : "Fill color"}
                                    </Label>
                                    <ColorPicker
                                      value={row.color.trim() ? row.color : fillFallback}
                                      onChange={(value) => updateBarRow(i, { color: value })}
                                      placeholder={fillFallback}
                                      showAlpha={true}
                                      allowTransparent={true}
                                    />
                                  </div>
                                ) : null}
                                {row.fillStyle === "gradient" ? (
                                  <div
                                    className={`grid grid-cols-2 gap-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                  >
                                    <div className="space-y-1 min-w-0">
                                      <Label className="text-[10px] text-muted-foreground">
                                        {isLineModal ? "Line & area (start)" : "Gradient start"}
                                      </Label>
                                      <ColorPicker
                                        value={
                                          row.gradientColor1.trim()
                                            ? row.gradientColor1
                                            : fillFallback
                                        }
                                        onChange={(value) => updateBarRow(i, { gradientColor1: value })}
                                        placeholder={fillFallback}
                                        showAlpha={true}
                                        allowTransparent={true}
                                      />
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                      <Label className="text-[10px] text-muted-foreground">
                                        {isLineModal ? "Line & area (end)" : "Gradient end"}
                                      </Label>
                                      <ColorPicker
                                        value={
                                          row.gradientColor2.trim()
                                            ? row.gradientColor2
                                            : DEFAULT_PIE_SLICE_COLORS[
                                                (i + 1) % DEFAULT_PIE_SLICE_COLORS.length
                                              ]
                                        }
                                        onChange={(value) => updateBarRow(i, { gradientColor2: value })}
                                        placeholder={
                                          DEFAULT_PIE_SLICE_COLORS[
                                            (i + 1) % DEFAULT_PIE_SLICE_COLORS.length
                                          ]
                                        }
                                        showAlpha={true}
                                        allowTransparent={true}
                                      />
                                    </div>
                                  </div>
                                ) : null}
                                <div
                                  className={`space-y-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <Label className="text-[10px] text-muted-foreground">Label size</Label>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[10px] text-muted-foreground tabular-nums">
                                        {hasCustomLabelFontSize ? labelSizeSliderValue : "Default"}
                                      </span>
                                      {!isReadOnly && hasCustomLabelFontSize ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-1.5 text-[10px] text-muted-foreground"
                                          onClick={() => updateBarRow(i, { labelFontSizeStr: "" })}
                                        >
                                          Use default
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                  <Slider
                                    value={[labelSizeSliderValue]}
                                    onValueChange={(v) => {
                                      const next = v[0];
                                      if (next == null) return;
                                      updateBarRow(i, { labelFontSizeStr: String(next) });
                                    }}
                                    min={2}
                                    max={14}
                                    step={0.25}
                                    disabled={isReadOnly}
                                  />
                                </div>
                                <div
                                  className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                >
                                  <Label className="text-[10px] text-muted-foreground">Label text</Label>
                                  <ColorPicker
                                    value={
                                      row.labelColor.trim()
                                        ? row.labelColor
                                        : DEFAULT_PIE_SLICE_LABEL_COLOR
                                    }
                                    onChange={(value) => updateBarRow(i, { labelColor: value })}
                                    placeholder={DEFAULT_PIE_SLICE_LABEL_COLOR}
                                    showAlpha={true}
                                    allowTransparent={true}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </BarSegmentSortableRow>
                    );
                  })}
                </div>
                  </div>
                </ChartModalSection>
              </>
            ) : null}
            {!isCartesianModal && isRingModal ? (
              <>
                <ChartModalSection title="Outline & defaults" tint="muted">
                  <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[10px] text-muted-foreground">Segment outline color</Label>
                        {!isReadOnly && sliceBorderColor.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-muted-foreground"
                            onClick={() => setSliceBorderColor("")}
                          >
                            Use node border
                          </Button>
                        ) : null}
                      </div>
                      <ColorPicker
                        value={sliceBorderColor.trim() ? sliceBorderColor : "#6b7280"}
                        onChange={(value) => setSliceBorderColor(value)}
                        placeholder="#6b7280"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    </div>
                    <div className="space-y-2 pt-3">
                      <div className="flex justify-between gap-2">
                        <Label className="text-xs">Default outline thickness</Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {ringDefaultOutlineWidthVb.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        value={[ringDefaultOutlineWidthVb]}
                        onValueChange={(v) => setRingDefaultOutlineWidthVb(v[0] ?? 0)}
                        min={0}
                        max={4}
                        step={0.05}
                        disabled={isReadOnly}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        SVG chart units — individual segments may override thickness and color below.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-data-ring-shadow" className="text-xs font-medium">
                          Ring drop shadow
                        </Label>
                        <Switch
                          id="chart-data-ring-shadow"
                          checked={chartShadow}
                          onCheckedChange={setChartShadow}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-data-ring-segment-labels" className="text-xs font-medium">
                          Segment labels
                        </Label>
                        <Switch
                          id="chart-data-ring-segment-labels"
                          checked={showSegmentLabels}
                          onCheckedChange={setShowSegmentLabels}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chart-data-ring-lock-values" className="text-xs font-medium">
                          Lock segment values
                        </Label>
                        <Switch
                          id="chart-data-ring-lock-values"
                          checked={valuesLocked}
                          onCheckedChange={setValuesLocked}
                          disabled={isReadOnly}
                        />
                      </div>
                    </div>
                  </div>
                </ChartModalSection>
                <ChartModalSection title="Hole size & angular gaps" tint="teal">
                  <div className={cn(isReadOnly && "pointer-events-none opacity-75 space-y-4")}>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2">
                        <Label className="text-xs">Inner radius (hole baseline)</Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {ringInnerRadius.toFixed(1)}
                        </span>
                      </div>
                      <Slider
                        value={[ringInnerRadius]}
                        onValueChange={(v) =>
                          setRingInnerRadius(Math.min(26, Math.max(2, v[0] ?? DEFAULT_RING_INNER_RADIUS)))
                        }
                        min={2}
                        max={26}
                        step={0.5}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2">
                        <Label className="text-xs">Gap between arcs (degrees)</Label>
                        <span className="text-xs tabular-nums text-muted-foreground">{ringAngularGapDeg}</span>
                      </div>
                      <Slider
                        value={[ringAngularGapDeg]}
                        onValueChange={(v) => setRingAngularGapDeg(Math.min(8, Math.max(0, v[0] ?? 0)))}
                        min={0}
                        max={8}
                        step={0.25}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                </ChartModalSection>
                <ChartModalSection
                  title="Arc segments"
                  tint="sky"
                  headerRight={
                    !isReadOnly ? (
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addRingRow}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    ) : undefined
                  }
                >
                  <div className="space-y-3">
                    {ringRows.map((row, i) => {
                      const fillFallback =
                        DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
                      const collapsed = collapsedRingIds.has(row.id);
                      const summaryName = (row.name ?? "").trim() || `Segment ${i + 1}`;
                      const { hasCustomLabelFontSize, labelSizeSliderValue } = pieChartRowLabelSizeState(
                        row.labelFontSizeStr
                      );
                      return (
                        <ChartSliceSortableRow
                          key={row.id}
                          index={i}
                          isReadOnly={isReadOnly}
                          reorderRows={reorderRingRows}
                          className="rounded-md border border-border/60 bg-muted/20 dark:border-border dark:bg-background"
                        >
                          {(dragHandleRef) => (
                            <>
                              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/40">
                                <button
                                  type="button"
                                  className="shrink-0 p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                                  onClick={() => toggleRingCollapsed(row.id)}
                                  aria-expanded={!collapsed}
                                  aria-label={collapsed ? "Expand segment" : "Collapse segment"}
                                >
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 transition-transform",
                                      collapsed && "-rotate-90"
                                    )}
                                  />
                                </button>
                                <div
                                  ref={dragHandleRef as unknown as React.Ref<HTMLDivElement>}
                                  role="button"
                                  tabIndex={isReadOnly ? -1 : 0}
                                  className={cn(
                                    "touch-none shrink-0 p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    isReadOnly && "pointer-events-none opacity-40 cursor-default"
                                  )}
                                  aria-label="Drag to reorder segment"
                                  onKeyDown={(e) => {
                                    if (isReadOnly) return;
                                    if (e.key === "ArrowUp" && i > 0) {
                                      e.preventDefault();
                                      reorderRingRows(i, i - 1);
                                    }
                                    if (e.key === "ArrowDown" && i < ringRows.length - 1) {
                                      e.preventDefault();
                                      reorderRingRows(i, i + 1);
                                    }
                                  }}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                {collapsed ? (
                                  <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                                    {summaryName} · arc {row.valueStr || "0"}
                                    {row.ringThicknessStr.trim() ? ` · thick ${row.ringThicknessStr}` : ""}
                                    {row.ringRadialOffsetStr.trim()
                                      ? ` · offset ${row.ringRadialOffsetStr}`
                                      : ""}
                                  </span>
                                ) : (
                                  <div className="flex-1 min-w-0" aria-hidden />
                                )}
                                {!isReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeRingRow(i)}
                                    disabled={ringRows.length <= 1}
                                    aria-label="Remove segment"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              {!collapsed ? (
                                <div className="p-2 space-y-2">
                                  <Input
                                    value={row.name}
                                    onChange={(e) => updateRingRow(i, { name: e.target.value })}
                                    placeholder="Segment name"
                                    className="h-8 text-xs"
                                    disabled={isReadOnly}
                                  />
                                  <div
                                    className={`grid grid-cols-2 gap-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                  >
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Arc proportion</Label>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={row.valueStr}
                                        onChange={(e) => updateRingRow(i, { valueStr: e.target.value })}
                                        className="h-8 text-xs font-mono"
                                        disabled={isReadOnly}
                                      />
                                      <ChartValueInputHint
                                      valueStr={row.valueStr}
                                      globalProperties={globalProperties}
                                      globalVariableContext={globalVariableContext}
                                    />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Fill mode</Label>
                                      <Select
                                        value={row.fillStyle}
                                        onValueChange={(v) =>
                                          updateRingRow(i, { fillStyle: v as ChartSliceFillStyle })
                                        }
                                        disabled={isReadOnly}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="z-[100] max-h-[min(280px,50vh)]">
                                          <SelectItem value="none">None</SelectItem>
                                          <SelectItem value="solid">Solid</SelectItem>
                                          <SelectItem value="gradient">Gradient</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className={`grid grid-cols-2 gap-2 ${isReadOnly ? "opacity-75" : ""}`}>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Band thickness</Label>
                                      <Input
                                        className="h-8 text-xs"
                                        placeholder={`${DEFAULT_RING_THICKNESS}`}
                                        value={row.ringThicknessStr}
                                        onChange={(e) =>
                                          updateRingRow(i, { ringThicknessStr: e.target.value })
                                        }
                                        disabled={isReadOnly}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Radial offset</Label>
                                      <Input
                                        className="h-8 text-xs font-mono"
                                        placeholder="0"
                                        title="Adds to inner radius (+ outward)."
                                        value={row.ringRadialOffsetStr}
                                        onChange={(e) =>
                                          updateRingRow(i, { ringRadialOffsetStr: e.target.value })
                                        }
                                        disabled={isReadOnly}
                                      />
                                    </div>
                                  </div>
                                  <div className={`space-y-1 ${isReadOnly ? "opacity-75" : ""}`}>
                                    <Label className="text-[10px] text-muted-foreground">
                                      Outline width override
                                    </Label>
                                    <Input
                                      className="h-8 text-xs font-mono"
                                      placeholder={`${ringDefaultOutlineWidthVb}`}
                                      value={row.sliceOutlineWidthStr}
                                      onChange={(e) =>
                                        updateRingRow(i, { sliceOutlineWidthStr: e.target.value })
                                      }
                                      disabled={isReadOnly}
                                    />
                                  </div>
                                  {row.fillStyle === "solid" ? (
                                    <div className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}>
                                      <Label className="text-[10px] text-muted-foreground">Fill color</Label>
                                      <ColorPicker
                                        value={row.color.trim() ? row.color : fillFallback}
                                        onChange={(value) => updateRingRow(i, { color: value })}
                                        placeholder={fillFallback}
                                        showAlpha={true}
                                        allowTransparent={true}
                                      />
                                    </div>
                                  ) : null}
                                  <div className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}>
                                    <Label className="text-[10px] text-muted-foreground">
                                      Outline color (segment)
                                    </Label>
                                    <ColorPicker
                                      value={
                                        row.sliceOutlineColorStr.trim()
                                          ? row.sliceOutlineColorStr
                                          : sliceBorderColor.trim()
                                            ? sliceBorderColor
                                            : "#6b7280"
                                      }
                                      onChange={(value) =>
                                        updateRingRow(i, { sliceOutlineColorStr: value })
                                      }
                                      placeholder="#6b7280"
                                      showAlpha={true}
                                      allowTransparent={true}
                                    />
                                  </div>
                                  {row.fillStyle === "gradient" ? (
                                    <div className={`grid grid-cols-2 gap-2 ${isReadOnly ? "opacity-75" : ""}`}>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Gradient start</Label>
                                        <ColorPicker
                                          value={
                                            row.gradientColor1.trim()
                                              ? row.gradientColor1
                                              : fillFallback
                                          }
                                          onChange={(v) => updateRingRow(i, { gradientColor1: v })}
                                          placeholder={fillFallback}
                                          showAlpha={true}
                                          allowTransparent={true}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Gradient end</Label>
                                        <ColorPicker
                                          value={
                                            row.gradientColor2.trim()
                                              ? row.gradientColor2
                                              : DEFAULT_PIE_SLICE_COLORS[
                                                  (i + 1) % DEFAULT_PIE_SLICE_COLORS.length
                                                ]
                                          }
                                          onChange={(v) => updateRingRow(i, { gradientColor2: v })}
                                          placeholder={
                                            DEFAULT_PIE_SLICE_COLORS[
                                              (i + 1) % DEFAULT_PIE_SLICE_COLORS.length
                                            ]
                                          }
                                          showAlpha={true}
                                          allowTransparent={true}
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                  <div
                                    className={`space-y-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <Label className="text-[10px] text-muted-foreground">Label size</Label>
                                      <span className="text-[10px] text-muted-foreground tabular-nums">
                                        {hasCustomLabelFontSize ? labelSizeSliderValue : "Default"}
                                      </span>
                                      {!isReadOnly && hasCustomLabelFontSize ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-1.5 text-[10px]"
                                          onClick={() => updateRingRow(i, { labelFontSizeStr: "" })}
                                        >
                                          Reset
                                        </Button>
                                      ) : null}
                                    </div>
                                    <Slider
                                      value={[labelSizeSliderValue]}
                                      onValueChange={(v) => {
                                        const n = v[0];
                                        if (n != null)
                                          updateRingRow(i, { labelFontSizeStr: String(n) });
                                      }}
                                      min={2}
                                      max={14}
                                      step={0.25}
                                      disabled={isReadOnly}
                                    />
                                  </div>
                                  <div className={`space-y-1 ${isReadOnly ? "opacity-75" : ""}`}>
                                    <Label className="text-[10px] text-muted-foreground">Label text color</Label>
                                    <ColorPicker
                                      value={
                                        row.labelColor.trim()
                                          ? row.labelColor
                                          : DEFAULT_PIE_SLICE_LABEL_COLOR
                                      }
                                      onChange={(v) => updateRingRow(i, { labelColor: v })}
                                      placeholder={DEFAULT_PIE_SLICE_LABEL_COLOR}
                                      showAlpha={true}
                                      allowTransparent={true}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </ChartSliceSortableRow>
                      );
                    })}
                  </div>
                </ChartModalSection>
              </>
            ) : null}
            {isGanttModal ? (
              <GanttChartDataFields
                chart={
                  node?.chart?.kind === "gantt"
                    ? (node.chart as NodeChartSpecGantt)
                    : defaultGanttChartSpec()
                }
                isReadOnly={isReadOnly}
                onPatch={(next) => {
                  if (!node?.id || !onPatchChart || isReadOnly) return;
                  const prevChart =
                    node.chart?.kind === "gantt"
                      ? (node.chart as NodeChartSpecGantt)
                      : defaultGanttChartSpec();
                  const prevCols = clampGanttCols(prevChart.cols);
                  const nextCols = clampGanttCols(next.cols);
                  const added = nextCols - prevCols;
                  const nodePatch =
                    added > 0
                      ? { width: ganttGrowWidthForAddedColumns(node, prevChart, added) }
                      : undefined;
                  onPatchChart(node.id, next, nodePatch);
                }}
              />
            ) : null}
            {isLoopModal ? (
              <LoopChartDataFields
                chart={
                  node?.chart?.kind === "loop"
                    ? (node.chart as NodeChartSpecLoop)
                    : defaultLoopChartSpec()
                }
                isReadOnly={isReadOnly}
                onPatch={(next) => {
                  if (!node?.id || !onPatchChart || isReadOnly) return;
                  onPatchChart(node.id, next);
                }}
              />
            ) : null}
            {isArrowModal ? (
              <ArrowChartDataFields
                chart={
                  node?.chart?.kind === "arrow"
                    ? (node.chart as NodeChartSpecArrow)
                    : defaultArrowChartSpec()
                }
                isReadOnly={isReadOnly}
                onPatch={(next) => {
                  if (!node?.id || !onPatchChart || isReadOnly) return;
                  onPatchChart(node.id, next);
                }}
              />
            ) : null}
            {isGridModal ? (
              <>
                <ChartModalSection title="Grid layout" tint="sky">
                  <div className={cn("grid grid-cols-2 gap-3", isReadOnly && "pointer-events-none opacity-75")}>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Columns</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={gridCols}
                        onChange={(e) =>
                          applyGridDimensions(Number(e.target.value), gridRows, gridCellRows)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Rows</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={gridRows}
                        onChange={(e) =>
                          applyGridDimensions(gridCols, Number(e.target.value), gridCellRows)
                        }
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Chart title</Label>
                      <Input
                        value={gridTitle}
                        onChange={(e) => setGridTitle(e.target.value)}
                        placeholder="Optional title"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Column titles (comma-separated)</Label>
                      <Input
                        value={gridColumnTitlesStr}
                        onChange={(e) => setGridColumnTitlesStr(e.target.value)}
                        placeholder="A, B, C"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Row titles (comma-separated)</Label>
                      <Input
                        value={gridRowTitlesStr}
                        onChange={(e) => setGridRowTitlesStr(e.target.value)}
                        placeholder="1, 2, 3"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label className="text-[10px] text-muted-foreground">Paint on canvas</Label>
                      <Select
                        value={gridCanvasPaintFill}
                        onValueChange={(v) => {
                          const mode = v as
                            | ChartSliceFillStyle
                            | "hue-step"
                            | "theme-hue"
                            | "same"
                            | "default";
                          setGridCanvasPaintFill(mode);
                          const patch: Partial<NodeChartSpecGrid> = {
                            canvasPaintFill: mode,
                          };
                          if (mode === "solid" && node?.chart?.kind === "grid") {
                            const cur = node.chart as NodeChartSpecGrid;
                            if (!cur.defaultCellFill?.trim()) {
                              const fill =
                                gridDefaultCellFill.trim() ||
                                globalProperties?.[
                                  GRID_CELL_FILL_GLOBAL_PROPERTY
                                ]?.trim() ||
                                DEFAULT_PIE_SLICE_COLORS[0];
                              patch.defaultCellFill = fill;
                              setGridDefaultCellFill(fill);
                            }
                          }
                          patchGridChartLive(patch);
                        }}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue>
                            {GRID_CANVAS_PAINT_LABELS[gridCanvasPaintFill] ?? gridCanvasPaintFill}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="z-[100] max-h-[min(280px,50vh)]">
                          <SelectItem value="default">
                            {GRID_CANVAS_PAINT_LABELS.default}
                          </SelectItem>
                          <SelectItem value="solid">{GRID_CANVAS_PAINT_LABELS.solid}</SelectItem>
                          <SelectItem value="same">{GRID_CANVAS_PAINT_LABELS.same}</SelectItem>
                          <SelectItem value="gradient">
                            {GRID_CANVAS_PAINT_LABELS.gradient}
                          </SelectItem>
                          <SelectItem value="hue-step">
                            {GRID_CANVAS_PAINT_LABELS["hue-step"]}
                          </SelectItem>
                          <SelectItem value="theme-hue">
                            {GRID_CANVAS_PAINT_LABELS["theme-hue"]}
                          </SelectItem>
                          <SelectItem value="none">{GRID_CANVAS_PAINT_LABELS.none}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Hue step along
                        </Label>
                        <Select
                          value={gridHueStepDirection}
                          onValueChange={(v) =>
                            setGridHueStepDirection(v === "column" ? "column" : "row")
                          }
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[100]">
                            <SelectItem value="row">Rows (left → right)</SelectItem>
                            <SelectItem value="column">Columns (top → bottom)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Order for <span className="font-medium">Hue step</span> and{" "}
                          <span className="font-medium">Theme hue</span> fills (canvas paint and
                          per-cell fill styles).
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Default cell color
                        </Label>
                        <div className={isReadOnly ? "pointer-events-none opacity-75" : undefined}>
                          <ColorPicker
                            value={
                              gridDefaultCellFill.trim() ||
                              DEFAULT_PIE_SLICE_COLORS[0]
                            }
                            onChange={(color) => {
                              setGridDefaultCellFill(color);
                              patchGridDefaultCellFillLive(color);
                            }}
                            showAlpha={true}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Used for <span className="font-medium">Solid</span> and{" "}
                          <span className="font-medium">Default</span> canvas paint (and cells with
                          Default fill). Overrides diagram{" "}
                          <span className="font-mono">{GRID_CELL_FILL_GLOBAL_PROPERTY}</span> when set;
                          not the chart frame background.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Default cell text color
                        </Label>
                        <div className={isReadOnly ? "pointer-events-none opacity-75" : undefined}>
                          <ColorPicker
                            value={
                              gridDefaultCellLabelColor.trim() ||
                              DEFAULT_PIE_SLICE_LABEL_COLOR
                            }
                            onChange={setGridDefaultCellLabelColor}
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Used for new canvas-painted cells and any cell without its own text color.
                          Falls back to the shape&apos;s text color when unset.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full text-xs"
                          disabled={isReadOnly}
                          onClick={() => {
                            if (!node?.id || node.chart?.kind !== "grid") return;
                            const reset = resetGridChartTrackSizes(
                              node.chart as NodeChartSpecGrid
                            );
                            if (onPatchChart) {
                              onPatchChart(node.id, reset);
                            }
                            setGridOmitTrackWeightsOnSave(true);
                            toast({
                              title: "Cell sizes reset",
                              description: "Column and row tracks are equal again.",
                            });
                          }}
                        >
                          Reset cell sizes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full text-xs"
                          disabled={isReadOnly}
                          onClick={() => {
                            if (!node?.id || node.chart?.kind !== "grid") return;
                            const reset = resetGridChartCellFills(
                              node.chart as NodeChartSpecGrid
                            );
                            if (onPatchChart) {
                              onPatchChart(node.id, reset);
                            }
                            setGridCellRows((prev) =>
                              prev.map((row) => ({
                                ...row,
                                filled: false,
                                fillStyle: "none" as const,
                                color: "",
                                gradientColor1: "",
                                gradientColor2: "",
                              }))
                            );
                            toast({
                              title: "Cell fill reset",
                              description: "All cell fills cleared; text and label colours kept.",
                            });
                          }}
                        >
                          Reset cell fill
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full text-xs"
                          disabled={isReadOnly}
                          onClick={() => {
                            if (!node?.id || node.chart?.kind !== "grid") return;
                            const reset = resetGridChartCellContent(
                              node.chart as NodeChartSpecGrid
                            );
                            if (onPatchChart) {
                              onPatchChart(node.id, reset);
                            }
                            setGridCellRows((prev) =>
                              prev.map((row) => ({ ...row, text: "" }))
                            );
                            toast({
                              title: "Cell content reset",
                              description: "All in-cell text cleared; fills unchanged.",
                            });
                          }}
                        >
                          Reset cell content
                        </Button>
                      </div>
                      {gridCanvasPaintFill === "gradient" ? (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <ColorPicker
                            value={
                              gridCanvasPaintGradient1.trim() || DEFAULT_PIE_SLICE_COLORS[0]
                            }
                            onChange={setGridCanvasPaintGradient1}
                            showAlpha={true}
                          />
                          <ColorPicker
                            value={
                              gridCanvasPaintGradient2.trim() || DEFAULT_PIE_SLICE_COLORS[1]
                            }
                            onChange={setGridCanvasPaintGradient2}
                            showAlpha={true}
                          />
                        </div>
                      ) : null}
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        With the grid selected on the canvas, hover a cell to preview; click to fill
                        or clear. Drag column/row dividers to resize tracks.
                      </p>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Cell padding ({Math.round(gridCellGap)}px)
                      </Label>
                      <Slider
                        value={[gridCellGap]}
                        min={0}
                        max={24}
                        step={1}
                        onValueChange={([v]) => setGridCellGap(v ?? 0)}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="chart-grid-lines" className="text-xs font-medium">
                        Grid lines
                      </Label>
                      <Switch
                        id="chart-grid-lines"
                        checked={gridShowLines}
                        onCheckedChange={setGridShowLines}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Grid line color</Label>
                      <ColorPicker
                        value={gridLineColor.trim() ? gridLineColor : "#94a3b8"}
                        onChange={setGridLineColor}
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Axis / title color</Label>
                      <ColorPicker
                        value={gridAxisColor.trim() ? gridAxisColor : "#64748b"}
                        onChange={setGridAxisColor}
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    </div>
                  </div>
                </ChartModalSection>
                <ChartModalSection title="Cells" tint="emerald">
                  <div
                    className={cn(
                      "max-h-64 space-y-2 overflow-y-auto pr-1",
                      isReadOnly && "pointer-events-none opacity-75"
                    )}
                  >
                    {gridCellRows.map((cell, i) => {
                      const col = i % gridCols;
                      const row = Math.floor(i / gridCols);
                      return (
                        <div
                          key={cell.id}
                          className="rounded border border-border/80 bg-background/60 p-2 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium text-muted-foreground">
                              Row {row + 1}, Col {col + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px]">Filled</Label>
                              <Switch
                                checked={cell.filled}
                                onCheckedChange={(v) =>
                                  setGridCellRows((prev) =>
                                    prev.map((c, j) =>
                                      j === i ? { ...c, filled: v, fillStyle: v ? c.fillStyle === "none" ? "solid" : c.fillStyle : "none" } : c
                                    )
                                  )
                                }
                                disabled={isReadOnly}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Fill</Label>
                              <Select
                                value={cell.fillStyle}
                                onValueChange={(v) =>
                                  setGridCellRows((prev) =>
                                    prev.map((c, j) =>
                                      j === i ? { ...c, fillStyle: v as GridCellFillStyle } : c
                                    )
                                  )
                                }
                                disabled={isReadOnly || !cell.filled}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[100] max-h-[min(280px,50vh)]">
                                  <SelectItem value="default">Default (global)</SelectItem>
                                  <SelectItem value="solid">Solid</SelectItem>
                                  <SelectItem value="gradient">Gradient</SelectItem>
                                  <SelectItem value="hue-step">Hue step</SelectItem>
                                  <SelectItem value="theme-hue">Theme hue</SelectItem>
                                  <SelectItem value="none">None</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Cell text</Label>
                              <Input
                                className="h-8 text-xs"
                                value={cell.text}
                                onChange={(e) =>
                                  setGridCellRows((prev) =>
                                    prev.map((c, j) => (j === i ? { ...c, text: e.target.value } : c))
                                  )
                                }
                                placeholder="Optional"
                              />
                            </div>
                            <div
                              className={`space-y-1 col-span-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                            >
                              <Label className="text-[10px] text-muted-foreground">Text color</Label>
                              <ColorPicker
                                value={
                                  cell.labelColor.trim()
                                    ? cell.labelColor
                                    : gridDefaultCellLabelColor.trim() ||
                                      DEFAULT_PIE_SLICE_LABEL_COLOR
                                }
                                onChange={(v) =>
                                  setGridCellRows((prev) =>
                                    prev.map((c, j) => (j === i ? { ...c, labelColor: v } : c))
                                  )
                                }
                                showAlpha={true}
                                allowTransparent={true}
                              />
                            </div>
                          </div>
                          {cell.filled && cell.fillStyle === "solid" ? (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Color</Label>
                              <ColorPicker
                                value={cell.color.trim() || DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length]}
                                onChange={(v) =>
                                  setGridCellRows((prev) =>
                                    prev.map((c, j) => (j === i ? { ...c, color: v } : c))
                                  )
                                }
                                showAlpha={true}
                              />
                            </div>
                          ) : null}
                          {cell.filled && cell.fillStyle === "gradient" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <ColorPicker
                                value={cell.gradientColor1.trim() || DEFAULT_PIE_SLICE_COLORS[0]}
                                onChange={(v) =>
                                  setGridCellRows((prev) =>
                                    prev.map((c, j) => (j === i ? { ...c, gradientColor1: v } : c))
                                  )
                                }
                                showAlpha={true}
                              />
                              <ColorPicker
                                value={cell.gradientColor2.trim() || DEFAULT_PIE_SLICE_COLORS[1]}
                                onChange={(v) =>
                                  setGridCellRows((prev) =>
                                    prev.map((c, j) => (j === i ? { ...c, gradientColor2: v } : c))
                                  )
                                }
                                showAlpha={true}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </ChartModalSection>
              </>
            ) : null}
            {!isCartesianModal && !isRingModal && !isGridModal && !isGanttModal && !isLoopModal && !isArrowModal ? (
              <>
            <ChartModalSection title="Slice outline & options" tint="muted">
              <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px] text-muted-foreground">Slice outline (wedge border)</Label>
                    {!isReadOnly && sliceBorderColor.trim() ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] text-muted-foreground"
                        onClick={() => setSliceBorderColor("")}
                      >
                        Use node border
                      </Button>
                    ) : null}
                  </div>
                  <ColorPicker
                    value={sliceBorderColor.trim() ? sliceBorderColor : "#6b7280"}
                    onChange={(value) => setSliceBorderColor(value)}
                    placeholder="#6b7280"
                    showAlpha={true}
                    allowTransparent={true}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="chart-data-pie-shadow" className="text-xs font-medium">
                      Pie drop shadow
                    </Label>
                    <Switch
                      id="chart-data-pie-shadow"
                      checked={chartShadow}
                      onCheckedChange={setChartShadow}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="chart-data-segment-labels" className="text-xs font-medium">
                      Segment labels
                    </Label>
                    <Switch
                      id="chart-data-segment-labels"
                      checked={showSegmentLabels}
                      onCheckedChange={setShowSegmentLabels}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="chart-data-pie-lock-values" className="text-xs font-medium">
                      Lock segment values
                    </Label>
                    <Switch
                      id="chart-data-pie-lock-values"
                      checked={valuesLocked}
                      onCheckedChange={setValuesLocked}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>
            </ChartModalSection>

            <ChartModalSection title="Segment separation" tint="amber">
              <div className={cn(isReadOnly && "pointer-events-none opacity-75")}>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <Label className="text-xs">Segment separation</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{segmentGapDeg}</span>
                  </div>
                  <Slider
                    value={[segmentGapDeg]}
                    onValueChange={(v) => setSegmentGapDeg(v[0] ?? 0)}
                    min={0}
                    max={CHART_MAX_SEGMENT_PULL}
                    step={0.5}
                    disabled={isReadOnly}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Default pull for every slice (0–{CHART_MAX_SEGMENT_PULL}). Wedge radius scales so the rim stays inside the design circle; angles unchanged. Per-slice overrides can pull individual slices farther (see each row).
                  </p>
                </div>
              </div>
            </ChartModalSection>

            <ChartModalSection
              title="Slices"
              tint="sky"
              headerRight={
                !isReadOnly ? (
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addRow}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                ) : undefined
              }
            >
            <div className="space-y-3">
              {rows.map((row, i) => {
                const fillFallback = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
                const collapsed = collapsedSliceIds.has(row.id);
                const summaryName = (row.name ?? "").trim() || `Series ${i + 1}`;
                const { hasCustomLabelFontSize, labelSizeSliderValue } = pieChartRowLabelSizeState(
                  row.labelFontSizeStr
                );
                const { hasCustomSegmentPull, segmentPullSliderValue } = pieChartRowSegmentPullState(
                  row.segmentPullStr
                );
                return (
                  <ChartSliceSortableRow
                    key={row.id}
                    index={i}
                    isReadOnly={isReadOnly}
                    reorderRows={reorderRows}
                    className="rounded-md border border-border/60 bg-muted/20 dark:border-border dark:bg-background"
                  >
                    {(dragHandleRef) => (
                      <>
                        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/40">
                          <button
                            type="button"
                            className="shrink-0 p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => toggleSliceCollapsed(row.id)}
                            aria-expanded={!collapsed}
                            aria-label={collapsed ? "Expand slice" : "Collapse slice"}
                          >
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")}
                            />
                          </button>
                          <div
                            ref={dragHandleRef as unknown as React.Ref<HTMLDivElement>}
                            role="button"
                            tabIndex={isReadOnly ? -1 : 0}
                            className={cn(
                              "touch-none shrink-0 p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isReadOnly && "pointer-events-none opacity-40 cursor-default"
                            )}
                            aria-label="Drag to reorder slice"
                            onKeyDown={(e) => {
                              if (isReadOnly) return;
                              if (e.key === "ArrowUp" && i > 0) {
                                e.preventDefault();
                                reorderRows(i, i - 1);
                              }
                              if (e.key === "ArrowDown" && i < rows.length - 1) {
                                e.preventDefault();
                                reorderRows(i, i + 1);
                              }
                            }}
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          {collapsed ? (
                            <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                              {summaryName} · {row.valueStr || "0"} · {row.fillStyle}
                              {row.labelFontSizeStr.trim() ? ` · sz ${row.labelFontSizeStr}` : ""}
                              {row.segmentPullStr.trim() ? ` · pull ${row.segmentPullStr}` : ""}
                            </span>
                          ) : (
                            <div className="flex-1 min-w-0" aria-hidden />
                          )}
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRow(i)}
                              disabled={rows.length <= 1}
                              aria-label="Remove slice"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {!collapsed ? (
                          <div className="p-2 space-y-2">
                        <div className="flex gap-1 items-center">
                          <Input
                            value={row.name}
                            onChange={(e) => updateRow(i, { name: e.target.value })}
                            placeholder="Series name"
                            className="h-8 text-xs flex-1 min-w-0"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div
                          className={`grid grid-cols-2 gap-2 items-end ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                        >
                          <div className="space-y-1 min-w-0">
                            <Label className="text-[10px] text-muted-foreground">Value</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={row.valueStr}
                              onChange={(e) => updateRow(i, { valueStr: e.target.value })}
                              className="h-8 text-xs font-mono"
                              disabled={isReadOnly}
                            />
                            <ChartValueInputHint
                                      valueStr={row.valueStr}
                                      globalProperties={globalProperties}
                                      globalVariableContext={globalVariableContext}
                                    />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <Label className="text-[10px] text-muted-foreground">Slice fill</Label>
                            <Select
                              value={row.fillStyle}
                              onValueChange={(v) =>
                                updateRow(i, { fillStyle: v as ChartSliceFillStyle })
                              }
                              disabled={isReadOnly}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Fill type" />
                              </SelectTrigger>
                              <SelectContent className="z-[100] max-h-[min(280px,50vh)]">
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="solid">Solid</SelectItem>
                                <SelectItem value="gradient">Gradient</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {row.fillStyle === "solid" ? (
                          <div className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}>
                            <Label className="text-[10px] text-muted-foreground">Fill color</Label>
                            <ColorPicker
                              value={row.color.trim() ? row.color : fillFallback}
                              onChange={(value) => updateRow(i, { color: value })}
                              placeholder={fillFallback}
                              showAlpha={true}
                              allowTransparent={true}
                            />
                          </div>
                        ) : null}
                        {row.fillStyle === "gradient" ? (
                          <div
                            className={`grid grid-cols-2 gap-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                          >
                            <div className="space-y-1 min-w-0">
                              <Label className="text-[10px] text-muted-foreground">Gradient start</Label>
                              <ColorPicker
                                value={
                                  row.gradientColor1.trim()
                                    ? row.gradientColor1
                                    : fillFallback
                                }
                                onChange={(value) => updateRow(i, { gradientColor1: value })}
                                placeholder={fillFallback}
                                showAlpha={true}
                                allowTransparent={true}
                              />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <Label className="text-[10px] text-muted-foreground">Gradient end</Label>
                              <ColorPicker
                                value={
                                  row.gradientColor2.trim()
                                    ? row.gradientColor2
                                    : DEFAULT_PIE_SLICE_COLORS[(i + 1) % DEFAULT_PIE_SLICE_COLORS.length]
                                }
                                onChange={(value) => updateRow(i, { gradientColor2: value })}
                                placeholder={
                                  DEFAULT_PIE_SLICE_COLORS[(i + 1) % DEFAULT_PIE_SLICE_COLORS.length]
                                }
                                showAlpha={true}
                                allowTransparent={true}
                              />
                            </div>
                          </div>
                        ) : null}
                        {row.fillStyle === "none" ? (
                          <p className="text-[10px] text-muted-foreground">This slice has no fill.</p>
                        ) : null}
                        <div
                          className={`space-y-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-[10px] text-muted-foreground">
                              Segment pull override
                            </Label>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {hasCustomSegmentPull ? segmentPullSliderValue : "Chart default"}
                              </span>
                              {!isReadOnly && hasCustomSegmentPull ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] text-muted-foreground"
                                  onClick={() => updateRow(i, { segmentPullStr: "" })}
                                >
                                  Use default
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <Slider
                            value={[segmentPullSliderValue]}
                            onValueChange={(v) => {
                              const next = v[0];
                              if (next == null) return;
                              updateRow(i, { segmentPullStr: String(next) });
                            }}
                            min={0}
                            max={CHART_MAX_PER_SLICE_SEGMENT_PULL}
                            step={0.25}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div
                          className={`space-y-2 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-[10px] text-muted-foreground">Label size</Label>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {hasCustomLabelFontSize ? labelSizeSliderValue : "Default"}
                              </span>
                              {!isReadOnly && hasCustomLabelFontSize ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] text-muted-foreground"
                                  onClick={() => updateRow(i, { labelFontSizeStr: "" })}
                                >
                                  Use default
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <Slider
                            value={[labelSizeSliderValue]}
                            onValueChange={(v) => {
                              const next = v[0];
                              if (next == null) return;
                              updateRow(i, { labelFontSizeStr: String(next) });
                            }}
                            min={2}
                            max={14}
                            step={0.25}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div
                          className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                        >
                          <Label className="text-[10px] text-muted-foreground">Label text</Label>
                          <ColorPicker
                            value={row.labelColor.trim() ? row.labelColor : DEFAULT_PIE_SLICE_LABEL_COLOR}
                            onChange={(value) => updateRow(i, { labelColor: value })}
                            placeholder={DEFAULT_PIE_SLICE_LABEL_COLOR}
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ) : null}
                      </>
                    )}
                  </ChartSliceSortableRow>
                );
              })}
            </div>
            </ChartModalSection>
              </>
            ) : null}
          </div>
          {!isReadOnly && (
            <div className="p-3 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          )}
        </div>
      </Draggable>
    </div>
  );
}
