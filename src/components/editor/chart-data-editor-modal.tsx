"use client";

import React, { useRef, useEffect, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import type { ConnectDragSource } from "react-dnd";
import Draggable from "react-draggable";
import { ChevronDown, GripVertical, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  ChartBarSegmentItem,
  ChartSeriesItem,
  ChartSliceFillStyle,
  DiagramNodeData,
  NodeChartSpec,
  NodeChartSpecBar,
  NodeChartSpecLine,
  NodeChartSpecPie,
} from "@/lib/types";
import {
  CHART_MAX_SEGMENT_PULL,
  CHART_MAX_PER_SLICE_SEGMENT_PULL,
  defaultBarChartSpec,
  defaultLineChartSpec,
  defaultPieChartSpec,
  randomLineChartSpec,
  newChartSliceId,
  DEFAULT_PIE_SLICE_COLORS,
  DEFAULT_PIE_SLICE_LABEL_COLOR,
  DEFAULT_PIE_WEDGE_LABEL_FONT,
  formatChartValueForEdit,
  roundChartDataValue,
} from "@/lib/chart-node";
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

const CHART_SLICE_REORDER_TYPE = "dw-chart-slice-reorder";
const CHART_BAR_SEGMENT_REORDER_TYPE = "dw-chart-bar-segment-reorder";

function parseBarValuesList(raw: string, targetLen: number): number[] {
  const parts = String(raw ?? "")
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const nums = parts.map((p) => {
    const n = Number(p.replace(/,/g, "."));
    return roundChartDataValue(Number.isFinite(n) ? Math.max(0, n) : 0);
  });
  const out = nums.slice();
  while (out.length < targetLen) out.push(0);
  if (out.length > targetLen) out.length = targetLen;
  return out;
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

interface ChartDataEditorModalProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  node: DiagramNodeData | null;
  onSave: (nodeId: string, chart: NodeChartSpec) => void;
  isReadOnly?: boolean;
}

export function ChartDataEditorModal({
  x,
  y,
  visible,
  onClose,
  node,
  onSave,
  isReadOnly = false,
}: ChartDataEditorModalProps) {
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

  useEffect(() => {
    if (visible && node) {
      const chart = (node as DiagramNodeData & { chart?: NodeChartSpec }).chart;
      const isBar = node.type === "generic.chart.bar" || chart?.kind === "bar";
      const isLine = node.type === "generic.chart.line" || chart?.kind === "line";

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
            valuesStr: (s.values ?? [])
              .map((v) => formatChartValueForEdit(typeof v === "number" ? v : Number(v)))
              .join(", "),
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
            valuesStr: (s.values ?? [])
              .map((v) => formatChartValueForEdit(typeof v === "number" ? v : Number(v)))
              .join(", "),
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
          valueStr: formatChartValueForEdit(typeof s.value === "number" ? s.value : Number(s.value)),
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
    const isBar = node.type === "generic.chart.bar" || node.chart?.kind === "bar";
    const isLine = node.type === "generic.chart.line" || node.chart?.kind === "line";

    if (isLine) {
      const labelParts = categoryLabelsStr
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const rawLens = barRows.map((r) =>
        String(r.valuesStr ?? "")
          .split(/[,;\n]+/)
          .map((x) => x.trim())
          .filter(Boolean).length
      );
      const maxCat = Math.max(1, labelParts.length, ...rawLens, 0);
      if (barRows.length === 0) {
        onSave(node.id, randomLineChartSpec());
        onClose();
        return;
      }
      const series: ChartBarSegmentItem[] = barRows.map((r, i) => {
        const vals = parseBarValuesList(r.valuesStr, maxCat);
        const name = (r.name ?? "").trim() || `Series ${i + 1}`;
        const base: ChartBarSegmentItem = {
          id: r.id || newChartSliceId(),
          name,
          values: vals,
        };
        if (r.labelColor.trim()) base.labelColor = r.labelColor.trim();
        const lfsRaw = Number(String(r.labelFontSizeStr ?? "").trim().replace(/,/g, "."));
        if (Number.isFinite(lfsRaw) && lfsRaw > 0) {
          base.labelFontSize = Math.min(14, Math.max(2, lfsRaw));
        }
        if (r.fillStyle === "none") {
          base.fillStyle = "none";
          if (r.color.trim()) base.color = r.color.trim();
          return base;
        }
        if (r.fillStyle === "gradient") {
          base.fillStyle = "gradient";
          const g1 = r.gradientColor1.trim();
          const g2 = r.gradientColor2.trim();
          const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
          base.gradientColors = [g1 || fb, g2 || g1 || fb] as [string, string];
          return base;
        }
        base.fillStyle = "solid";
        if (r.color.trim()) base.color = r.color.trim();
        return base;
      });
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
      const rawLens = barRows.map((r) =>
        String(r.valuesStr ?? "")
          .split(/[,;\n]+/)
          .map((x) => x.trim())
          .filter(Boolean).length
      );
      const maxCat = Math.max(1, labelParts.length, ...rawLens, 0);
      if (barRows.length === 0) {
        onSave(node.id, defaultBarChartSpec());
        onClose();
        return;
      }
      const series: ChartBarSegmentItem[] = barRows.map((r, i) => {
        const vals = parseBarValuesList(r.valuesStr, maxCat);
        const name = (r.name ?? "").trim() || `Segment ${i + 1}`;
        const base: ChartBarSegmentItem = {
          id: r.id || newChartSliceId(),
          name,
          values: vals,
        };
        if (r.labelColor.trim()) base.labelColor = r.labelColor.trim();
        const lfsRaw = Number(String(r.labelFontSizeStr ?? "").trim().replace(/,/g, "."));
        if (Number.isFinite(lfsRaw) && lfsRaw > 0) {
          base.labelFontSize = Math.min(14, Math.max(2, lfsRaw));
        }
        if (r.fillStyle === "none") {
          base.fillStyle = "none";
          if (r.color.trim()) base.color = r.color.trim();
          return base;
        }
        if (r.fillStyle === "gradient") {
          base.fillStyle = "gradient";
          const g1 = r.gradientColor1.trim();
          const g2 = r.gradientColor2.trim();
          const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
          base.gradientColors = [g1 || fb, g2 || g1 || fb] as [string, string];
          return base;
        }
        base.fillStyle = "solid";
        if (r.color.trim()) base.color = r.color.trim();
        return base;
      });
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

    const cleaned: ChartSeriesItem[] = rows.map((r, i) => {
      const raw = Number(String(r.valueStr).replace(/,/g, "."));
      const value = roundChartDataValue(Number.isFinite(raw) ? Math.max(0, raw) : 0);
      const name = (r.name ?? "").trim() || `Series ${i + 1}`;
      const base: ChartSeriesItem = {
        id: r.id || newChartSliceId(),
        name,
        value,
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
        return base;
      }
      if (r.fillStyle === "gradient") {
        base.fillStyle = "gradient";
        const g1 = r.gradientColor1.trim();
        const g2 = r.gradientColor2.trim();
        const fb = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
        base.gradientColors = [g1 || fb, (g2 || g1 || fb)] as [string, string];
        return base;
      }
      base.fillStyle = "solid";
      if (r.color.trim()) base.color = r.color.trim();
      return base;
    });
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

  if (!visible) return null;

  const isBarModal =
    !!node && (node.type === "generic.chart.bar" || node.chart?.kind === "bar");
  const isLineModal =
    !!node && (node.type === "generic.chart.line" || node.chart?.kind === "line");
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
          className="fixed w-[460px] rounded-md border border-border bg-popover shadow-lg p-0 z-[70]"
        >
          <div className="chart-data-modal-drag-handle flex items-center justify-between p-3 border-b cursor-move">
            <h3 className="font-semibold text-sm">Chart data</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>
          <div className="p-4 space-y-3 max-h-[min(580px,72vh)] overflow-y-auto">
            {isCartesianModal ? (
              <>
                <div className="rounded-md border border-border/60 p-3 space-y-3 bg-muted/15">
                  <p className="text-xs font-medium text-foreground">Chart appearance</p>
                  <div
                    className={`space-y-3 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
                  >
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
                    {isLineModal ? (
                      <>
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
                      </>
                    ) : null}
                    {!isLineModal ? (
                      <>
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
                      </>
                    ) : null}
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
                </div>
                <div className={`space-y-1 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}>
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isLineModal ? "Series" : "Stack segments"}
                  </span>
                  {!isReadOnly && (
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addBarRow}>
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  )}
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
                        className="rounded-md border border-border/60 bg-muted/20"
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
                                    placeholder="10, 20, 30, 40"
                                    className="h-8 text-xs font-mono"
                                    disabled={isReadOnly}
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
              </>
            ) : (
              <>
            <div className="rounded-md border border-border/60 p-3 space-y-3 bg-muted/15">
              <p className="text-xs font-medium text-foreground">Chart appearance</p>
              <div
                className={`space-y-3 ${isReadOnly ? "pointer-events-none opacity-75" : ""}`}
              >
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
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Slices</span>
              {!isReadOnly && (
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addRow}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
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
                    className="rounded-md border border-border/60 bg-muted/20"
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
                              className="h-8 text-xs"
                              disabled={isReadOnly}
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
              </>
            )}
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
