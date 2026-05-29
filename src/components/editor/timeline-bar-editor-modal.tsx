"use client";

import React, { useRef, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { AlignHorizontalSpaceAround, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorPicker } from "@/components/ui/color-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TIMELINE_BAR_LABEL_FIRST_SECTION,
  type DiagramNodeData,
  type TimelineBarAxisLabelData,
  type TimelineBarSectionData,
} from "@/lib/types";
import {
  clampTimelineBarT,
  defaultTimelineBarSections,
  isTimelineBarNodeType,
  newTimelineBarAxisLabelId,
  newTimelineBarSectionId,
  normalizeTimelineBarAxisLabels,
  normalizeTimelineBarSections,
  timelineBarEvenAxisPositions,
  timelineBarSectionThemeHueBorderGradient,
  timelineBarSectionThemeHueFill,
  timelineBarSectionThemeHueFillGradient,
  timelineBarUsesSpanLayout,
} from "@/lib/timeline-bar";
import {
  isSegmentedRectangleNodeType,
  normalizeSegmentedRectangleSections,
} from "@/lib/segmented-rectangle";
import { GradientAnglePicker } from "./gradient-angle-picker";
import { cn } from "@/lib/utils";

function timelineBarSectionRowId(row: TimelineBarSectionData, index: number): string {
  return String(row.id ?? `tb-row-${index}`);
}

function timelineBarSegmentSummaryLabel(
  row: TimelineBarSectionData,
  index: number,
  spanLayoutEnabled: boolean,
  sizing: "equal" | "weighted",
): string {
  const raw = (row.label ?? "").trim();
  const title = (raw.split(/\n/)[0] ?? "").trim() || `Section ${index + 1}`;
  const fs = row.fillStyle ?? "solid";
  const parts: string[] = [title, fs];
  if (spanLayoutEnabled) {
    const a = Math.round(clampTimelineBarT(row.spanStart ?? 0) * 100);
    const b = Math.round(clampTimelineBarT(row.spanEnd ?? 1) * 100);
    parts.push(`${a}–${b}%`);
  } else if (sizing === "weighted") {
    parts.push(`wt ${typeof row.weight === "number" ? row.weight : 1}`);
  }
  return parts.join(" · ");
}

function equalSegmentSpans(n: number): { spanStart: number; spanEnd: number }[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => ({
    spanStart: i / n,
    spanEnd: (i + 1) / n,
  }));
}

const TIMELINE_BAR_PRESET_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Week preset: axis row below the bar (sections use 1–7). */
const TIMELINE_BAR_PRESET_WEEK_AXIS_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const TIMELINE_BAR_PRESET_QUARTER_AXIS: readonly Pick<TimelineBarAxisLabelData, "label" | "t">[] = [
  { label: "Q1", t: 0 },
  { label: "Q2", t: 0.25 },
  { label: "Q3", t: 0.5 },
  { label: "Q4", t: 0.75 },
];

type AxisRow = TimelineBarAxisLabelData;
type Row = TimelineBarSectionData;

/** Radix Select sentinel: cleared patch → inherit node text styling */
const TB_LABEL_SHAPE_DEFAULT = "__inherit";
/** Modal sentinel: font family from custom string input */
const TB_LABEL_FONT_CUSTOM = "__custom_font__";
/** Modal sentinel: font size from number input */
const TB_LABEL_SIZE_CUSTOM = "__custom_size__";

function timelineBarModalFontFamilySelectValue(row: Row, index: number): string {
  if (index > 0 && row.labelFontFamily === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    return TIMELINE_BAR_LABEL_FIRST_SECTION;
  }
  if (row.labelFontFamily && row.labelFontFamily !== TIMELINE_BAR_LABEL_FIRST_SECTION) {
    return TB_LABEL_FONT_CUSTOM;
  }
  return TB_LABEL_SHAPE_DEFAULT;
}

function timelineBarModalFontSizeSelectValue(row: Row, index: number): string {
  if (index > 0 && row.labelFontSize === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    return TIMELINE_BAR_LABEL_FIRST_SECTION;
  }
  if (typeof row.labelFontSize === "number") {
    return TB_LABEL_SIZE_CUSTOM;
  }
  return TB_LABEL_SHAPE_DEFAULT;
}

function patchTimelineBarSectionLabelFields(
  r: TimelineBarSectionData,
  rowIndex: number,
): Partial<
  Pick<
    TimelineBarSectionData,
    | "labelTextJustify"
    | "labelVerticalAlign"
    | "labelFontFamily"
    | "labelFontSize"
    | "labelFontWeight"
    | "labelFontStyle"
    | "labelTextDecoration"
  >
> {
  const extra: Partial<
    Pick<
      TimelineBarSectionData,
      | "labelTextJustify"
      | "labelVerticalAlign"
      | "labelFontFamily"
      | "labelFontSize"
      | "labelFontWeight"
      | "labelFontStyle"
      | "labelTextDecoration"
    >
  > = {};
  const allowFirstRef = rowIndex > 0;
  const j = r.labelTextJustify;
  if (allowFirstRef && j === TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelTextJustify = j;
  else if (j === "left" || j === "center" || j === "right" || j === "full") extra.labelTextJustify = j;

  const va = r.labelVerticalAlign;
  if (allowFirstRef && va === TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelVerticalAlign = va;
  else if (va === "top" || va === "middle" || va === "bottom") extra.labelVerticalAlign = va;

  const fam = typeof r.labelFontFamily === "string" ? r.labelFontFamily.trim() : "";
  if (allowFirstRef && fam === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    extra.labelFontFamily = TIMELINE_BAR_LABEL_FIRST_SECTION;
  } else if (fam && fam !== TIMELINE_BAR_LABEL_FIRST_SECTION) {
    extra.labelFontFamily = fam;
  }

  const fs = r.labelFontSize;
  if (allowFirstRef && fs === TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelFontSize = fs;
  else if (typeof fs === "number" && Number.isFinite(fs) && fs > 0) extra.labelFontSize = fs;

  const fw = r.labelFontWeight;
  if (allowFirstRef && fw === TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelFontWeight = fw;
  else if (
    fw === "normal" ||
    fw === "bold" ||
    fw === "100" ||
    fw === "200" ||
    fw === "300" ||
    fw === "400" ||
    fw === "500" ||
    fw === "600" ||
    fw === "700" ||
    fw === "800" ||
    fw === "900"
  )
    extra.labelFontWeight = fw;

  const fst = r.labelFontStyle;
  if (allowFirstRef && fst === TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelFontStyle = fst;
  else if (fst === "normal" || fst === "italic" || fst === "oblique") extra.labelFontStyle = fst;

  const td = r.labelTextDecoration;
  if (allowFirstRef && td === TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelTextDecoration = td;
  else if (td === "none" || td === "underline" || td === "overline" || td === "line-through")
    extra.labelTextDecoration = td;

  return extra;
}

export interface TimelineBarEditorSavePayload {
  sections: TimelineBarSectionData[];
  sizing: "equal" | "weighted";
  axisLabels: TimelineBarAxisLabelData[];
  /** When true, segments after the first mirror the first segment’s bar-label alignment and typography on the canvas. */
  labelsFollowFirstSection: boolean;
}

interface TimelineBarEditorModalProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  node: DiagramNodeData | null;
  onSave: (nodeId: string, payload: TimelineBarEditorSavePayload) => void;
  isReadOnly?: boolean;
}

export function TimelineBarEditorModal({
  x,
  y,
  visible,
  onClose,
  node,
  onSave,
  isReadOnly = false,
}: TimelineBarEditorModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [sizing, setSizing] = useState<"equal" | "weighted">("equal");
  const [axisRows, setAxisRows] = useState<AxisRow[]>([]);
  const [spanLayoutEnabled, setSpanLayoutEnabled] = useState(false);
  const [axisSectionOpen, setAxisSectionOpen] = useState(true);
  const [collapsedSegIds, setCollapsedSegIds] = useState<Set<string>>(() => new Set());
  const [labelsFollowFirstSection, setLabelsFollowFirstSection] = useState(false);

  useEffect(() => {
    if (visible && node && (isTimelineBarNodeType(node.type) || isSegmentedRectangleNodeType(node.type))) {
      const segmented = isSegmentedRectangleNodeType(node.type);
      const sec = (segmented ? normalizeSegmentedRectangleSections(node) : normalizeTimelineBarSections(node)).map(
        (s) => ({ ...s }),
      );
      setRows(sec);
      setSizing(
        (segmented
          ? ((node as DiagramNodeData & { segmentedRectangleSizing?: string }).segmentedRectangleSizing as
              | "equal"
              | "weighted")
          : ((node as DiagramNodeData & { timelineBarSizing?: string }).timelineBarSizing as "equal" | "weighted")) ||
          "equal",
      );
      if (segmented) {
        setAxisRows([]);
        setAxisSectionOpen(false);
      } else {
        const ax = normalizeTimelineBarAxisLabels(node).map((a) => ({ ...a }));
        setAxisRows(ax);
        setAxisSectionOpen(ax.length <= 2);
      }
      setSpanLayoutEnabled(timelineBarUsesSpanLayout(sec));
      setCollapsedSegIds(
        sec.length > 2 ? new Set(sec.map((r, j) => timelineBarSectionRowId(r, j))) : new Set(),
      );
      setLabelsFollowFirstSection(
        segmented
          ? (node as DiagramNodeData & { segmentedRectangleLabelsFollowFirstSection?: boolean })
              .segmentedRectangleLabelsFollowFirstSection === true
          : (node as DiagramNodeData & { timelineBarLabelsFollowFirstSection?: boolean })
              .timelineBarLabelsFollowFirstSection === true,
      );
    } else if (visible && node) {
      const def = defaultTimelineBarSections();
      setRows(def);
      setSizing("equal");
      setAxisRows([]);
      setSpanLayoutEnabled(false);
      setAxisSectionOpen(true);
      setCollapsedSegIds(
        def.length > 2 ? new Set(def.map((r, j) => timelineBarSectionRowId(r, j))) : new Set(),
      );
      setLabelsFollowFirstSection(false);
    }
  }, [visible, node]);

  useEffect(() => {
    if (visible) {
      const modalWidth = 400;
      const modalHeight = 560;
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
      const focusable = panelRef.current?.querySelector(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ) as HTMLElement;
      focusable?.focus();
      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        const list = panelRef.current?.querySelectorAll(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (!list?.length) return;
        const first = list[0] as HTMLElement;
        const last = list[list.length - 1] as HTMLElement;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
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
      if (target.closest('[role="menu"]')) return;
      if (target.closest("[data-radix-dropdown-menu-content]")) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  const editorIsSegmented = Boolean(visible && node && isSegmentedRectangleNodeType(node.type));

  const applyPresetMonths = () => {
    if (!node || isReadOnly || editorIsSegmented) return;
    const sp = equalSegmentSpans(TIMELINE_BAR_PRESET_MONTH_LABELS.length);
    const nextRows: Row[] = TIMELINE_BAR_PRESET_MONTH_LABELS.map((label, i) => ({
      id: newTimelineBarSectionId(node.id),
      label,
      fill: "#94a3b8",
      fillStyle: "theme-hue" as const,
      weight: 1,
      spanStart: sp[i]?.spanStart,
      spanEnd: sp[i]?.spanEnd,
    }));
    setRows(nextRows);
    setSizing("equal");
    setSpanLayoutEnabled(true);
    setAxisRows(
      TIMELINE_BAR_PRESET_QUARTER_AXIS.map((a) => ({
        id: newTimelineBarAxisLabelId(node.id),
        label: a.label,
        t: clampTimelineBarT(a.t),
      })),
    );
    setAxisSectionOpen(true);
    setCollapsedSegIds(
      nextRows.length > 2 ? new Set(nextRows.map((r, j) => timelineBarSectionRowId(r, j))) : new Set(),
    );
  };

  const applyPresetWeek = () => {
    if (!node || isReadOnly || editorIsSegmented) return;
    const n = TIMELINE_BAR_PRESET_WEEK_AXIS_LABELS.length;
    const sp = equalSegmentSpans(n);
    const ts = timelineBarEvenAxisPositions(n);
    const nextRows: Row[] = Array.from({ length: n }, (_, i) => ({
      id: newTimelineBarSectionId(node.id),
      label: String(i + 1),
      fill: "#94a3b8",
      fillStyle: "theme-hue" as const,
      weight: 1,
      spanStart: sp[i]?.spanStart,
      spanEnd: sp[i]?.spanEnd,
    }));
    setRows(nextRows);
    setSizing("equal");
    setSpanLayoutEnabled(true);
    setAxisRows(
      TIMELINE_BAR_PRESET_WEEK_AXIS_LABELS.map((label, i) => ({
        id: newTimelineBarAxisLabelId(node.id),
        label,
        t: clampTimelineBarT(ts[i] ?? (i + 0.5) / n),
      })),
    );
    setAxisSectionOpen(true);
    setCollapsedSegIds(
      nextRows.length > 2 ? new Set(nextRows.map((r, j) => timelineBarSectionRowId(r, j))) : new Set(),
    );
  };

  const handleSave = () => {
    if (!node || isReadOnly) return;
    const useSpan = spanLayoutEnabled && rows.length > 0;
    const cleaned: TimelineBarSectionData[] = rows.map((r, i) => {
      const fs = r.fillStyle ?? "solid";
      const base: TimelineBarSectionData = {
        id: r.id || `tb-${i}`,
        label: r.label?.trim() || undefined,
        fill: r.fill || "#6b7280",
        weight: typeof r.weight === "number" && r.weight > 0 ? r.weight : 1,
        tickLabel: r.tickLabel?.trim() || undefined,
        labelColor: r.labelColor?.trim() || undefined,
        fillStyle: fs,
        ...patchTimelineBarSectionLabelFields(r, i),
      };
      if (typeof r.segmentOutlineWidth === "number" && Number.isFinite(r.segmentOutlineWidth) && r.segmentOutlineWidth >= 0) {
        base.segmentOutlineWidth = r.segmentOutlineWidth;
      }
      if (typeof r.segmentOutlineColor === "string" && r.segmentOutlineColor.trim()) {
        base.segmentOutlineColor = r.segmentOutlineColor.trim();
      }
      if (r.segmentOutlineStyle === "solid" || r.segmentOutlineStyle === "dotted" || r.segmentOutlineStyle === "none") {
        base.segmentOutlineStyle = r.segmentOutlineStyle;
      }
      if (fs === "gradient") {
        const g0 = r.fillGradientColors?.[0] ?? r.fill ?? "#6b7280";
        const g1 = r.fillGradientColors?.[1] ?? g0;
        base.fillGradientColors = [String(g0), String(g1)];
        base.fillGradientAngle =
          typeof r.fillGradientAngle === "number" && Number.isFinite(r.fillGradientAngle) ? r.fillGradientAngle : 90;
      }
      if (useSpan) {
        let ss = clampTimelineBarT(typeof r.spanStart === "number" ? r.spanStart : 0);
        let se = clampTimelineBarT(typeof r.spanEnd === "number" ? r.spanEnd : 1);
        if (se <= ss) se = Math.min(1, ss + 1e-3);
        base.spanStart = ss;
        base.spanEnd = se;
      }
      return base;
    });

    const axisLabels: TimelineBarAxisLabelData[] = axisRows
      .map((a, i) => ({
        id: typeof a.id === "string" && a.id ? a.id : newTimelineBarAxisLabelId(node.id),
        label: (a.label ?? "").trim(),
        t: clampTimelineBarT(typeof a.t === "number" && Number.isFinite(a.t) ? a.t : (i + 0.5) / Math.max(1, axisRows.length)),
      }))
      .filter((a) => a.label.length > 0);

    if (cleaned.length === 0) {
      onSave(node.id, {
        sections: defaultTimelineBarSections(),
        sizing,
        axisLabels: [],
        labelsFollowFirstSection,
      });
    } else {
      onSave(node.id, { sections: cleaned, sizing, axisLabels, labelsFollowFirstSection });
    }
    onClose();
  };

  const addRow = () => {
    if (!node || isReadOnly) return;
    const newId = newTimelineBarSectionId(node.id);
    setRows((prev) => {
      const idx = prev.length + 1;
      const template = editorIsSegmented && prev.length > 0 ? prev[prev.length - 1] : null;
      let newRow: Row;
      if (template) {
        const fs = template.fillStyle ?? "solid";
        newRow = {
          id: newId,
          label: `S${idx}`,
          fill: template.fill || "#94a3b8",
          fillStyle: fs,
          weight: 1,
          tickLabel: "",
        };
        if (fs === "gradient") {
          const g0 = template.fillGradientColors?.[0] ?? template.fill ?? "#6b7280";
          const g1 = template.fillGradientColors?.[1] ?? g0;
          newRow.fillGradientColors = [String(g0), String(g1)];
          newRow.fillGradientAngle =
            typeof template.fillGradientAngle === "number" && Number.isFinite(template.fillGradientAngle)
              ? template.fillGradientAngle
              : 90;
        }
        if (typeof template.segmentOutlineWidth === "number" && Number.isFinite(template.segmentOutlineWidth)) {
          newRow.segmentOutlineWidth = template.segmentOutlineWidth;
        }
        if (template.segmentOutlineColor?.trim()) {
          newRow.segmentOutlineColor = template.segmentOutlineColor.trim();
        }
        if (
          template.segmentOutlineStyle === "solid" ||
          template.segmentOutlineStyle === "dotted" ||
          template.segmentOutlineStyle === "none"
        ) {
          newRow.segmentOutlineStyle = template.segmentOutlineStyle;
        }
        if (template.labelColor?.trim()) {
          newRow.labelColor = template.labelColor.trim();
        }
      } else {
        newRow = {
          id: newId,
          label: `S${idx}`,
          fill: "#94a3b8",
          fillStyle: "solid" as const,
          weight: 1,
          tickLabel: "",
        };
      }
      const next = [...prev, newRow];
      if (spanLayoutEnabled) {
        const sp = equalSegmentSpans(next.length);
        return next.map((r, i) => ({ ...r, spanStart: sp[i]?.spanStart, spanEnd: sp[i]?.spanEnd }));
      }
      return next;
    });
    setCollapsedSegIds((s) => {
      const next = new Set(s);
      next.delete(newId);
      return next;
    });
  };

  const removeRow = (i: number) => {
    let removedId: string | undefined;
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      removedId = timelineBarSectionRowId(prev[i], i);
      const next = prev.filter((_, idx) => idx !== i);
      if (spanLayoutEnabled) {
        const sp = equalSegmentSpans(next.length);
        return next.map((r, j) => ({ ...r, spanStart: sp[j]?.spanStart, spanEnd: sp[j]?.spanEnd }));
      }
      return next;
    });
    setCollapsedSegIds((s) => {
      if (!removedId) return s;
      const next = new Set(s);
      next.delete(removedId);
      return next;
    });
  };

  const patchAxisRow = (i: number, patch: Partial<AxisRow>) => {
    setAxisRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addAxisRow = () => {
    if (!node || isReadOnly) return;
    setAxisRows((prev) => [
      ...prev,
      {
        id: newTimelineBarAxisLabelId(node.id),
        label: "",
        t:
          prev.length === 0
            ? 0.125
            : clampTimelineBarT(Math.min(0.95, (prev[prev.length - 1]?.t ?? 0) + 0.25)),
      },
    ]);
  };

  const removeAxisRow = (i: number) => {
    setAxisRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const applyEvenAxisSpacing = () => {
    setAxisRows((prev) => {
      if (prev.length === 0) return prev;
      const ts = timelineBarEvenAxisPositions(prev.length);
      return prev.map((row, i) => ({ ...row, t: ts[i] ?? row.t }));
    });
  };

  const hideSectionTickFields = editorIsSegmented || axisRows.some((a) => (a.label ?? "").trim().length > 0);

  const patchRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };


  return (
    <div className="fixed left-0 top-0 z-[60] h-screen w-screen" style={{ pointerEvents: "auto" }}>
      <Draggable
        nodeRef={panelRef}
        position={position}
        onStop={(_e, data) => setPosition({ x: data.x, y: data.y })}
        handle=".tb-modal-drag-handle"
      >
        <div
          ref={panelRef}
          className="fixed z-[70] w-[440px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-0 shadow-lg"
        >
          <div className="tb-modal-drag-handle flex cursor-move items-center justify-between border-b px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <AlignHorizontalSpaceAround className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <h3 className="truncate text-sm font-semibold text-foreground">
                {editorIsSegmented ? "Segmented rectangle sections" : "Timeline bar sections"}
              </h3>
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
          <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto p-5">
            {!editorIsSegmented ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/25 px-3 py-2 dark:border-border dark:bg-background">
                  <Label className="text-xs font-medium text-foreground">Presets</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 text-xs"
                        disabled={isReadOnly}
                      >
                        Apply preset…
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[80] max-w-[min(18rem,calc(100vw-3rem))]">
                      <DropdownMenuItem className="cursor-pointer text-xs" onSelect={() => applyPresetMonths()}>
                        12 months + axis Q1–Q4
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-xs" onSelect={() => applyPresetWeek()}>
                        Week — sections 1–7 + axis Mon … Sun
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
            <Collapsible open={axisSectionOpen} onOpenChange={setAxisSectionOpen}>
              <div className="space-y-2 rounded-md border border-teal-200/60 bg-teal-50/35 p-3 dark:border-border dark:bg-background">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0"
                        aria-expanded={axisSectionOpen}
                        aria-label={axisSectionOpen ? "Collapse timeline axis" : "Expand timeline axis"}
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            !axisSectionOpen && "-rotate-90",
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <div className="h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden />
                    <Label className="text-xs font-semibold text-foreground">Timeline axis (below bar)</Label>
                  </div>
                  {!isReadOnly ? (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={applyEvenAxisSpacing}
                            disabled={axisRows.length === 0}
                          >
                            Even spacing
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs text-xs">
                          Sets Pos % so each tick sits at the centre of an equal slice of the bar (e.g. four labels:
                          12.5 / 37.5 / 62.5 / 87.5). Fixes uneven gaps when the last tick was near 100%.
                        </TooltipContent>
                      </Tooltip>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={addAxisRow}>
                        <Plus className="mr-0.5 h-3 w-3" />
                        Add label
                      </Button>
                    </div>
                  ) : null}
                </div>
                <CollapsibleContent className="space-y-2 overflow-hidden">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Independent of coloured segments: e.g. four quarters evenly spaced while segments stay equal/weighted or
                    use custom spans. Use{" "}
                    <span className="font-medium text-foreground">Even spacing</span> to recalculate positions.
                  </p>
                  {axisRows.length === 0 ? (
                    <p className="text-[11px] italic text-muted-foreground">
                      Empty — section “Date / tick” fields draw the tick row.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {axisRows.map((ax, i) => (
                        <div
                          key={ax.id || `ax-${i}`}
                          className="grid w-full items-end gap-x-2 gap-y-1 [grid-template-columns:minmax(0,1fr)_minmax(5.75rem,auto)_2rem]"
                        >
                          <Input
                            value={ax.label}
                            onChange={(e) => patchAxisRow(i, { label: e.target.value })}
                            placeholder="e.g. Q1"
                            className="h-8 min-w-0 w-full text-xs"
                            disabled={isReadOnly}
                          />
                          <div className="flex min-w-[5.75rem] shrink-0 flex-col gap-0.5 justify-end">
                            <Label
                              htmlFor={`tb-axis-t-${ax.id ?? i}`}
                              className="text-[10px] leading-none text-muted-foreground"
                            >
                              Pos %
                            </Label>
                            <Input
                              id={`tb-axis-t-${ax.id ?? i}`}
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={Math.round(clampTimelineBarT(ax.t) * 100)}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value);
                                if (!Number.isFinite(n)) return;
                                patchAxisRow(i, { t: clampTimelineBarT(n / 100) });
                              }}
                              className="h-8 w-full px-2 text-center text-xs tabular-nums [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              disabled={isReadOnly}
                              title="Horizontal position (0 = left, 100 = right)"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 shrink-0 justify-self-end p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeAxisRow(i)}
                            disabled={isReadOnly}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
              </>
            ) : null}

            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 dark:border-border dark:bg-background">
              <div>
                <Label className="text-xs text-muted-foreground">Custom segment span (0–100%)</Label>
                <p className="text-[10px] text-muted-foreground">Place each coloured block on the bar; ignores equal/weighted.</p>
              </div>
              <Switch
                checked={spanLayoutEnabled}
                disabled={isReadOnly}
                onCheckedChange={(c) => {
                  setSpanLayoutEnabled(c);
                  if (c) {
                    setRows((prev) => {
                      const sp = equalSegmentSpans(prev.length);
                      return prev.map((r, i) => ({ ...r, spanStart: sp[i]?.spanStart, spanEnd: sp[i]?.spanEnd }));
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Section widths</Label>
              <Select
                value={sizing}
                onValueChange={(v) => setSizing(v as "equal" | "weighted")}
                disabled={isReadOnly || spanLayoutEnabled}
              >
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  <SelectItem value="equal" className="text-sm">
                    Equal (auto)
                  </SelectItem>
                  <SelectItem value="weighted" className="text-sm">
                    Weighted (auto)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {spanLayoutEnabled ? (
              <p className="text-xs text-muted-foreground">Width comes from each row’s start/end %.</p>
            ) : sizing === "weighted" ? (
              <p className="text-xs text-muted-foreground">
                Width is proportional to each row&apos;s weight (default 1).
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Every section gets the same width.</p>
            )}
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5 dark:border-border dark:bg-background">
              <div className="min-w-0 flex-1 space-y-1 pr-2">
                <Label htmlFor="tb-labels-follow-first" className="text-xs font-medium text-foreground">
                  Section default (bar label)
                </Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  On: every section matches the first section&apos;s in-bar label alignment and typography. Off: set each row below.
                </p>
              </div>
              <Switch
                id="tb-labels-follow-first"
                checked={labelsFollowFirstSection}
                disabled={isReadOnly || rows.length <= 1}
                onCheckedChange={setLabelsFollowFirstSection}
              />
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => {
                const rowId = timelineBarSectionRowId(row, i);
                const segOpen = !collapsedSegIds.has(rowId);
                return (
                  <Collapsible
                    key={rowId}
                    open={segOpen}
                    onOpenChange={(next) => {
                      setCollapsedSegIds((prev) => {
                        const n = new Set(prev);
                        if (next) n.delete(rowId);
                        else n.add(rowId);
                        return n;
                      });
                    }}
                  >
                    <div className="overflow-hidden rounded-md border border-border/60 bg-muted/30 dark:border-border dark:bg-background">
                      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1.5">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-0.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                !segOpen && "-rotate-90",
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              {timelineBarSegmentSummaryLabel(row, i, spanLayoutEnabled, sizing)}
                            </span>
                          </button>
                        </CollapsibleTrigger>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(i)}
                          disabled={isReadOnly || rows.length <= 1}
                          aria-label="Remove section"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <CollapsibleContent className="overflow-hidden">
                        <div className="space-y-2 p-3 pt-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            <div className="min-w-0 flex-1 space-y-1">
                              <Textarea
                                value={row.label ?? ""}
                                onChange={(e) => patchRow(i, { label: e.target.value })}
                                placeholder="Bar text"
                                rows={3}
                                className="min-h-[4.5rem] resize-y text-xs"
                                disabled={isReadOnly}
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Line breaks show in the bar (same as pyramid tiers). Inline edit: Enter adds a line; Ctrl/Cmd+Enter
                                commits.
                              </p>
                            </div>
                            {!hideSectionTickFields ? (
                              <Input
                                value={row.tickLabel ?? ""}
                                onChange={(e) => patchRow(i, { tickLabel: e.target.value })}
                                placeholder="Date / tick (optional)"
                                className="h-8 flex-1 text-xs"
                                disabled={isReadOnly}
                              />
                            ) : (
                              <div className="flex flex-1 items-center rounded border border-dashed border-border/60 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground dark:bg-background">
                                Timeline axis row active
                              </div>
                            )}
                          </div>
                          <div className="rounded-md border border-border/40 bg-background/60 p-2 dark:bg-background">
                            <Label className="text-[11px] font-semibold text-foreground">Bar label text</Label>
                            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                              <span className="font-medium text-foreground">Shape default</span>: node Text styling.{" "}
                              <span className="font-medium text-foreground">Section default</span> (rows 2+): first section for that
                              field. Rows after the first hide these when the toggle above is on.
                            </p>
                            {labelsFollowFirstSection && i > 0 ? (
                              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                                Matches first section — toggle above.
                              </p>
                            ) : (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <div className="flex min-w-0 flex-col gap-1">
                                <Label className="text-[10px] text-muted-foreground">Horizontal</Label>
                                <Select
                                  value={row.labelTextJustify ?? TB_LABEL_SHAPE_DEFAULT}
                                  onValueChange={(v) =>
                                    patchRow(i, {
                                      labelTextJustify:
                                        v === TB_LABEL_SHAPE_DEFAULT
                                          ? undefined
                                          : (v as NonNullable<Row["labelTextJustify"]>),
                                    })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="z-[80]">
                                    <SelectItem value={TB_LABEL_SHAPE_DEFAULT} className="text-sm">
                                      Shape default
                                    </SelectItem>
                                    {i > 0 ? (
                                      <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION} className="text-sm">
                                        Section default
                                      </SelectItem>
                                    ) : null}
                                    <SelectItem value="left" className="text-sm">
                                      Left
                                    </SelectItem>
                                    <SelectItem value="center" className="text-sm">
                                      Center
                                    </SelectItem>
                                    <SelectItem value="right" className="text-sm">
                                      Right
                                    </SelectItem>
                                    <SelectItem value="full" className="text-sm">
                                      Full (justify)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex min-w-0 flex-col gap-1">
                                <Label className="text-[10px] text-muted-foreground">Vertical</Label>
                                <Select
                                  value={row.labelVerticalAlign ?? TB_LABEL_SHAPE_DEFAULT}
                                  onValueChange={(v) =>
                                    patchRow(i, {
                                      labelVerticalAlign:
                                        v === TB_LABEL_SHAPE_DEFAULT
                                          ? undefined
                                          : (v as NonNullable<Row["labelVerticalAlign"]>),
                                    })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="z-[80]">
                                    <SelectItem value={TB_LABEL_SHAPE_DEFAULT} className="text-sm">
                                      Shape default
                                    </SelectItem>
                                    {i > 0 ? (
                                      <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION} className="text-sm">
                                        Section default
                                      </SelectItem>
                                    ) : null}
                                    <SelectItem value="top" className="text-sm">
                                      Top
                                    </SelectItem>
                                    <SelectItem value="middle" className="text-sm">
                                      Middle
                                    </SelectItem>
                                    <SelectItem value="bottom" className="text-sm">
                                      Bottom
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                                <Label className="text-[10px] text-muted-foreground">Font family</Label>
                                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                  <Select
                                    value={timelineBarModalFontFamilySelectValue(row, i)}
                                    onValueChange={(v) => {
                                      if (v === TB_LABEL_SHAPE_DEFAULT) patchRow(i, { labelFontFamily: undefined });
                                      else if (v === TIMELINE_BAR_LABEL_FIRST_SECTION && i > 0) {
                                        patchRow(i, { labelFontFamily: TIMELINE_BAR_LABEL_FIRST_SECTION });
                                      } else if (v === TB_LABEL_FONT_CUSTOM) {
                                        const fallback =
                                          row.labelFontFamily &&
                                          row.labelFontFamily !== TIMELINE_BAR_LABEL_FIRST_SECTION &&
                                          row.labelFontFamily.trim()
                                            ? row.labelFontFamily
                                            : (node?.fontFamily?.trim() ?? "");
                                        patchRow(i, {
                                          labelFontFamily: fallback || "sans-serif",
                                        });
                                      }
                                    }}
                                    disabled={isReadOnly}
                                  >
                                    <SelectTrigger className="h-8 min-w-[9rem] flex-1 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[80]">
                                      <SelectItem value={TB_LABEL_SHAPE_DEFAULT} className="text-sm">
                                        Shape default
                                      </SelectItem>
                                      {i > 0 ? (
                                        <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION} className="text-sm">
                                          Section default
                                        </SelectItem>
                                      ) : null}
                                      <SelectItem value={TB_LABEL_FONT_CUSTOM} className="text-sm">
                                        Custom
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {timelineBarModalFontFamilySelectValue(row, i) === TB_LABEL_FONT_CUSTOM ? (
                                    <Input
                                      value={
                                        row.labelFontFamily &&
                                        row.labelFontFamily !== TIMELINE_BAR_LABEL_FIRST_SECTION
                                          ? row.labelFontFamily
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        patchRow(i, { labelFontFamily: v.trim() ? v : undefined });
                                      }}
                                      placeholder="e.g. Inter, system-ui"
                                      className="h-8 min-w-0 flex-1 text-xs"
                                      disabled={isReadOnly}
                                    />
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                                <Label className="text-[10px] text-muted-foreground">Font size</Label>
                                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                  <Select
                                    value={timelineBarModalFontSizeSelectValue(row, i)}
                                    onValueChange={(v) => {
                                      if (v === TB_LABEL_SHAPE_DEFAULT) patchRow(i, { labelFontSize: undefined });
                                      else if (v === TIMELINE_BAR_LABEL_FIRST_SECTION && i > 0) {
                                        patchRow(i, { labelFontSize: TIMELINE_BAR_LABEL_FIRST_SECTION });
                                      } else if (v === TB_LABEL_SIZE_CUSTOM) {
                                        const fallback =
                                          typeof row.labelFontSize === "number" && Number.isFinite(row.labelFontSize)
                                            ? row.labelFontSize
                                            : typeof node?.fontSize === "number" && node.fontSize > 0
                                              ? node.fontSize
                                              : 12;
                                        patchRow(i, { labelFontSize: Math.min(96, Math.max(4, Math.round(fallback))) });
                                      }
                                    }}
                                    disabled={isReadOnly}
                                  >
                                    <SelectTrigger className="h-8 min-w-[9rem] flex-1 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[80]">
                                      <SelectItem value={TB_LABEL_SHAPE_DEFAULT} className="text-sm">
                                        Shape default
                                      </SelectItem>
                                      {i > 0 ? (
                                        <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION} className="text-sm">
                                          Section default
                                        </SelectItem>
                                      ) : null}
                                      <SelectItem value={TB_LABEL_SIZE_CUSTOM} className="text-sm">
                                        Custom (px)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {timelineBarModalFontSizeSelectValue(row, i) === TB_LABEL_SIZE_CUSTOM ? (
                                    <Input
                                      type="number"
                                      min={4}
                                      max={96}
                                      step={1}
                                      value={
                                        typeof row.labelFontSize === "number" ? String(row.labelFontSize) : ""
                                      }
                                      onChange={(e) => {
                                        const t = e.target.value.trim();
                                        if (!t) {
                                          patchRow(i, { labelFontSize: undefined });
                                          return;
                                        }
                                        const n = parseFloat(t);
                                        patchRow(i, {
                                          labelFontSize:
                                            Number.isFinite(n) && n > 0
                                              ? Math.min(96, Math.max(4, n))
                                              : undefined,
                                        });
                                      }}
                                      className="h-8 w-full min-w-[5rem] flex-1 text-xs tabular-nums sm:max-w-[7rem]"
                                      disabled={isReadOnly}
                                    />
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-col gap-1">
                                <Label className="text-[10px] text-muted-foreground">Weight</Label>
                                <Select
                                  value={row.labelFontWeight ?? TB_LABEL_SHAPE_DEFAULT}
                                  onValueChange={(v) =>
                                    patchRow(i, {
                                      labelFontWeight:
                                        v === TB_LABEL_SHAPE_DEFAULT
                                          ? undefined
                                          : (v as NonNullable<Row["labelFontWeight"]>),
                                    })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="z-[80]">
                                    <SelectItem value={TB_LABEL_SHAPE_DEFAULT} className="text-sm">
                                      Shape default
                                    </SelectItem>
                                    {i > 0 ? (
                                      <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION} className="text-sm">
                                        Section default
                                      </SelectItem>
                                    ) : null}
                                    <SelectItem value="normal" className="text-sm">
                                      Normal
                                    </SelectItem>
                                    <SelectItem value="bold" className="text-sm">
                                      Bold
                                    </SelectItem>
                                    <SelectItem value="400" className="text-sm">
                                      400
                                    </SelectItem>
                                    <SelectItem value="500" className="text-sm">
                                      500
                                    </SelectItem>
                                    <SelectItem value="600" className="text-sm">
                                      600
                                    </SelectItem>
                                    <SelectItem value="700" className="text-sm">
                                      700
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex min-w-0 flex-col gap-1">
                                <Label className="text-[10px] text-muted-foreground">Style</Label>
                                <Select
                                  value={row.labelFontStyle ?? TB_LABEL_SHAPE_DEFAULT}
                                  onValueChange={(v) =>
                                    patchRow(i, {
                                      labelFontStyle:
                                        v === TB_LABEL_SHAPE_DEFAULT
                                          ? undefined
                                          : (v as NonNullable<Row["labelFontStyle"]>),
                                    })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="z-[80]">
                                    <SelectItem value={TB_LABEL_SHAPE_DEFAULT} className="text-sm">
                                      Shape default
                                    </SelectItem>
                                    {i > 0 ? (
                                      <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION} className="text-sm">
                                        Section default
                                      </SelectItem>
                                    ) : null}
                                    <SelectItem value="normal" className="text-sm">
                                      Normal
                                    </SelectItem>
                                    <SelectItem value="italic" className="text-sm">
                                      Italic
                                    </SelectItem>
                                    <SelectItem value="oblique" className="text-sm">
                                      Oblique
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex min-w-0 flex-col gap-1">
                                <Label className="text-[10px] text-muted-foreground">Decoration</Label>
                                <Select
                                  value={row.labelTextDecoration ?? TB_LABEL_SHAPE_DEFAULT}
                                  onValueChange={(v) =>
                                    patchRow(i, {
                                      labelTextDecoration:
                                        v === TB_LABEL_SHAPE_DEFAULT
                                          ? undefined
                                          : (v as NonNullable<Row["labelTextDecoration"]>),
                                    })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="z-[80]">
                                    <SelectItem value={TB_LABEL_SHAPE_DEFAULT} className="text-sm">
                                      Shape default
                                    </SelectItem>
                                    {i > 0 ? (
                                      <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION} className="text-sm">
                                        Section default
                                      </SelectItem>
                                    ) : null}
                                    <SelectItem value="none" className="text-sm">
                                      None
                                    </SelectItem>
                                    <SelectItem value="underline" className="text-sm">
                                      Underline
                                    </SelectItem>
                                    <SelectItem value="overline" className="text-sm">
                                      Overline
                                    </SelectItem>
                                    <SelectItem value="line-through" className="text-sm">
                                      Line-through
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            )}
                          </div>
                          {spanLayoutEnabled ? (
                            <div className="flex flex-wrap gap-2">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">Start %</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Math.round(clampTimelineBarT(row.spanStart ?? 0) * 100)}
                                  onChange={(e) => {
                                    const n = parseFloat(e.target.value);
                                    if (!Number.isFinite(n)) return;
                                    patchRow(i, { spanStart: clampTimelineBarT(n / 100) });
                                  }}
                                  className="h-8 w-16 text-xs"
                                  disabled={isReadOnly}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">End %</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Math.round(clampTimelineBarT(row.spanEnd ?? 1) * 100)}
                                  onChange={(e) => {
                                    const n = parseFloat(e.target.value);
                                    if (!Number.isFinite(n)) return;
                                    patchRow(i, { spanEnd: clampTimelineBarT(n / 100) });
                                  }}
                                  className="h-8 w-16 text-xs"
                                  disabled={isReadOnly}
                                />
                              </div>
                            </div>
                          ) : null}
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Label className="shrink-0 text-xs text-muted-foreground">Fill</Label>
                              <Select
                                value={row.fillStyle ?? "solid"}
                                onValueChange={(v) => {
                                  const style = v as "solid" | "gradient" | "none" | "theme-hue";
                                  if (style === "gradient") {
                                    const base = row.fill || "#94a3b8";
                                    const c1 =
                                      Array.isArray(row.fillGradientColors) && row.fillGradientColors.length >= 2
                                        ? String(row.fillGradientColors[1])
                                        : "#64748b";
                                    patchRow(i, {
                                      fillStyle: "gradient",
                                      fillGradientColors: [
                                        Array.isArray(row.fillGradientColors) && row.fillGradientColors.length >= 1
                                          ? String(row.fillGradientColors[0])
                                          : base,
                                        c1,
                                      ],
                                      fillGradientAngle:
                                        typeof row.fillGradientAngle === "number" && Number.isFinite(row.fillGradientAngle)
                                          ? row.fillGradientAngle
                                          : 90,
                                    });
                                  } else if (style === "none") {
                                    patchRow(i, { fillStyle: "none" });
                                  } else if (style === "theme-hue") {
                                    patchRow(i, { fillStyle: "theme-hue" });
                                  } else {
                                    patchRow(i, { fillStyle: "solid" });
                                  }
                                }}
                                disabled={isReadOnly}
                              >
                                <SelectTrigger className="h-8 min-w-[148px] max-w-[200px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[80]">
                                  <SelectItem value="solid" className="text-sm">
                                    Solid
                                  </SelectItem>
                                  <SelectItem value="gradient" className="text-sm">
                                    Gradient
                                  </SelectItem>
                                  <SelectItem value="theme-hue" className="text-sm">
                                    Theme hue
                                  </SelectItem>
                                  <SelectItem value="none" className="text-sm">
                                    None
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {(row.fillStyle ?? "solid") === "solid" ? (
                              <div className="min-w-[120px] max-w-[200px]">
                                <ColorPicker
                                  value={row.fill || "#6b7280"}
                                  onChange={(value) => patchRow(i, { fill: value })}
                                />
                              </div>
                            ) : null}
                            {(row.fillStyle ?? "solid") === "gradient" ? (
                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                                <div className="flex flex-1 flex-col gap-1">
                                  <Label className="text-xs text-muted-foreground">Start</Label>
                                  <ColorPicker
                                    value={
                                      Array.isArray(row.fillGradientColors) && row.fillGradientColors[0]
                                        ? String(row.fillGradientColors[0])
                                        : row.fill || "#6b7280"
                                    }
                                    onChange={(value) => {
                                      const g1 =
                                        Array.isArray(row.fillGradientColors) && row.fillGradientColors.length >= 2
                                          ? String(row.fillGradientColors[1])
                                          : value;
                                      patchRow(i, { fillGradientColors: [value, g1], fill: value });
                                    }}
                                  />
                                </div>
                                <div className="flex flex-1 flex-col gap-1">
                                  <Label className="text-xs text-muted-foreground">End</Label>
                                  <ColorPicker
                                    value={
                                      Array.isArray(row.fillGradientColors) && row.fillGradientColors.length >= 2
                                        ? String(row.fillGradientColors[1])
                                        : "#64748b"
                                    }
                                    onChange={(value) => {
                                      const g0 =
                                        Array.isArray(row.fillGradientColors) && row.fillGradientColors.length >= 1
                                          ? String(row.fillGradientColors[0])
                                          : row.fill || "#6b7280";
                                      patchRow(i, { fillGradientColors: [g0, value] });
                                    }}
                                  />
                                </div>
                                <div className="shrink-0">
                                  <GradientAnglePicker
                                    value={
                                      typeof row.fillGradientAngle === "number" && Number.isFinite(row.fillGradientAngle)
                                        ? row.fillGradientAngle
                                        : 90
                                    }
                                    onChange={(angle) => patchRow(i, { fillGradientAngle: angle })}
                                    label="Angle"
                                  />
                                </div>
                              </div>
                            ) : null}
                            {(row.fillStyle ?? "solid") === "none" ? (
                              <p className="text-xs text-muted-foreground">Segment is transparent; the bar track shows through.</p>
                            ) : null}
                            {(row.fillStyle ?? "solid") === "theme-hue" ? (
                              <p className="text-xs text-muted-foreground">
                                Uses the shape background colour for the first theme-hue segment; each further theme-hue segment
                                shifts hue (same idea as timeline cards). Set the step under Visual styling →{" "}
                                {editorIsSegmented ? "Segmented rectangle" : "Timeline bar"}, or use
                                the Hue step in the Themes menu (pyramid tiers follow that menu value only).
                                {node && rows.length > 0 ? (
                                  <span className="mt-1 flex items-center gap-2">
                                    {(() => {
                                      const previewHueNode = editorIsSegmented
                                        ? ({
                                            ...node,
                                            timelineBarHueStepDeg: (
                                              node as DiagramNodeData & { segmentedRectangleHueStepDeg?: number }
                                            ).segmentedRectangleHueStepDeg,
                                          } as DiagramNodeData)
                                        : ({ ...node, timelineBarSections: rows } as DiagramNodeData);
                                      const previewSecs = normalizeTimelineBarSections({
                                        ...node,
                                        timelineBarSections: rows,
                                      } as DiagramNodeData);
                                      const fillGrad = timelineBarSectionThemeHueFillGradient(
                                        previewHueNode,
                                        previewSecs,
                                        i,
                                      );
                                      const borderGrad = timelineBarSectionThemeHueBorderGradient(
                                        previewHueNode,
                                        previewSecs,
                                        i,
                                      );
                                      const fillSolid = timelineBarSectionThemeHueFill(previewHueNode, previewSecs, i);
                                      const innerStyle: React.CSSProperties = fillGrad
                                        ? {
                                            background: `linear-gradient(${fillGrad.angleDeg}deg, ${fillGrad.start}, ${fillGrad.end})`,
                                          }
                                        : { backgroundColor: fillSolid };
                                      if (borderGrad) {
                                        return (
                                          <span
                                            className="inline-block shrink-0 rounded p-[2px]"
                                            style={{
                                              background: `linear-gradient(${borderGrad.angleDeg}deg, ${borderGrad.start}, ${borderGrad.end})`,
                                            }}
                                            title="Preview: fill and border (this segment, from current shape styling)"
                                          >
                                            <span
                                              className="block h-4 w-4 rounded-sm"
                                              style={innerStyle}
                                            />
                                          </span>
                                        );
                                      }
                                      return (
                                        <span
                                          className="inline-block h-4 w-4 shrink-0 rounded border border-border"
                                          style={innerStyle}
                                          title="Preview from current shape background"
                                        />
                                      );
                                    })()}
                                    <span>Preview from current background</span>
                                  </span>
                                ) : null}
                              </p>
                            ) : null}
                          </div>
                          {sizing === "weighted" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={row.weight ?? 1}
                                onChange={(e) => {
                                  const n = parseFloat(e.target.value);
                                  if (!Number.isFinite(n)) return;
                                  patchRow(i, { weight: Math.max(0.01, n) });
                                }}
                                className="h-8 w-20 text-xs"
                                disabled={isReadOnly}
                                title="Weight"
                              />
                            </div>
                          ) : null}
                          {editorIsSegmented ? (
                            <div className="space-y-2 rounded-md border border-border/50 bg-muted/10 p-2">
                              <Label className="text-xs font-medium text-foreground">Segment outline</Label>
                              <p className="text-[10px] text-muted-foreground">
                                Used when Visual styling → Segmented rectangle → Outline mode is &quot;segments&quot;. Omit width to use the shape border width.
                              </p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Stroke colour</Label>
                                  <ColorPicker
                                    value={row.segmentOutlineColor ?? String((node as DiagramNodeData).borderColor ?? "#78350f")}
                                    onChange={(value) => patchRow(i, { segmentOutlineColor: value })}
                                    showAlpha={true}
                                    allowTransparent={true}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Width (px, blank = shape border)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={16}
                                    step={0.5}
                                    className="h-8 text-xs tabular-nums"
                                    placeholder="inherit"
                                    value={
                                      typeof row.segmentOutlineWidth === "number" && Number.isFinite(row.segmentOutlineWidth)
                                        ? row.segmentOutlineWidth
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw === "") {
                                        patchRow(i, { segmentOutlineWidth: undefined });
                                        return;
                                      }
                                      const n = parseFloat(raw);
                                      if (Number.isFinite(n) && n >= 0) patchRow(i, { segmentOutlineWidth: n });
                                    }}
                                    disabled={isReadOnly}
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <Label className="text-[10px] text-muted-foreground">Stroke style</Label>
                                  <Select
                                    value={row.segmentOutlineStyle ?? "__inherit__"}
                                    onValueChange={(v) =>
                                      patchRow(i, {
                                        segmentOutlineStyle:
                                          v === "__inherit__" ? undefined : (v as "solid" | "dotted" | "none"),
                                      })
                                    }
                                    disabled={isReadOnly}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[80]">
                                      <SelectItem value="__inherit__" className="text-xs">
                                        Same as shape border
                                      </SelectItem>
                                      <SelectItem value="solid" className="text-xs">
                                        Solid
                                      </SelectItem>
                                      <SelectItem value="dotted" className="text-xs">
                                        Dotted
                                      </SelectItem>
                                      <SelectItem value="none" className="text-xs">
                                        None
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
            {!isReadOnly && (
              <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" onClick={addRow}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add section
              </Button>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t px-4 py-2.5">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isReadOnly}>
              Apply
            </Button>
          </div>
        </div>
      </Draggable>
    </div>
  );
}
