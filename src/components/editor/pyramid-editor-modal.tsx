"use client";

import React, { useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMELINE_BAR_LABEL_FIRST_SECTION, type DiagramNodeData, type PyramidDirection, type PyramidSizing, type TimelineBarSectionData } from "@/lib/types";
import {
  defaultPyramidSections,
  isPyramidNodeType,
  newPyramidSectionId,
  normalizePyramidSections,
} from "@/lib/pyramid";
import {
  timelineBarSectionThemeHueBorderGradient,
  timelineBarSectionThemeHueFill,
  timelineBarSectionThemeHueFillGradient,
} from "@/lib/timeline-bar";
import { GradientAnglePicker } from "./gradient-angle-picker";
import { cn } from "@/lib/utils";
import { useThemeMenuHueStepDeg } from "@/hooks/use-theme-menu-hue-step-deg";

type Row = TimelineBarSectionData;

const PY_LABEL_SHAPE_DEFAULT = "__inherit";
const PY_LABEL_FONT_CUSTOM = "__custom_font__";
const PY_LABEL_SIZE_CUSTOM = "__custom_size__";

function pyramidSectionRowId(row: Row, index: number): string {
  return String(row.id ?? `py-row-${index}`);
}

function patchPyramidSectionLabelFields(
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
  if (allowFirstRef && fam === TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelFontFamily = TIMELINE_BAR_LABEL_FIRST_SECTION;
  else if (fam && fam !== TIMELINE_BAR_LABEL_FIRST_SECTION) extra.labelFontFamily = fam;

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

export interface PyramidEditorSavePayload {
  sections: TimelineBarSectionData[];
  sizing: PyramidSizing;
  segmentGapPx: number;
  direction: PyramidDirection;
  apexWidthRatio: number;
  labelsFollowFirstSection: boolean;
}

interface PyramidEditorModalProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  node: DiagramNodeData | null;
  onSave: (nodeId: string, payload: PyramidEditorSavePayload) => void;
  isReadOnly?: boolean;
}

export function PyramidEditorModal({ x, y, visible, onClose, node, onSave, isReadOnly = false }: PyramidEditorModalProps) {
  const themesMenuHueStepDeg = useThemeMenuHueStepDeg();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [sizing, setSizing] = useState<PyramidSizing>("equal");
  const [segmentGapPx, setSegmentGapPx] = useState(2);
  const [tierSpacingFocused, setTierSpacingFocused] = useState(false);
  const [tierSpacingDraft, setTierSpacingDraft] = useState("");
  const [direction, setDirection] = useState<PyramidDirection>("narrow-at-top");
  const [apexPercent, setApexPercent] = useState(12);
  const [labelsFollowFirstSection, setLabelsFollowFirstSection] = useState(false);
  const [collapsedSegIds, setCollapsedSegIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (visible && node && isPyramidNodeType(node.type)) {
      setRows(normalizePyramidSections(node).map((s) => ({ ...s })));
      setSizing((((node as DiagramNodeData & { pyramidSizing?: string }).pyramidSizing as PyramidSizing) || "equal") as PyramidSizing);
      setSegmentGapPx(
        typeof (node as DiagramNodeData & { pyramidSegmentGap?: number }).pyramidSegmentGap === "number"
          ? Number((node as DiagramNodeData & { pyramidSegmentGap?: number }).pyramidSegmentGap)
          : 2,
      );
      setDirection(
        (node as DiagramNodeData & { pyramidDirection?: PyramidDirection }).pyramidDirection === "narrow-at-bottom"
          ? "narrow-at-bottom"
          : "narrow-at-top",
      );
      const ar = (node as DiagramNodeData & { pyramidApexWidthRatio?: number }).pyramidApexWidthRatio;
      const r = typeof ar === "number" && Number.isFinite(ar) ? ar : 0.12;
      setApexPercent(Math.round(r * 100));
      setLabelsFollowFirstSection(
        (node as DiagramNodeData & { pyramidLabelsFollowFirstSection?: boolean }).pyramidLabelsFollowFirstSection === true,
      );
      const sec = normalizePyramidSections(node);
      setCollapsedSegIds(sec.length > 2 ? new Set(sec.map((r, j) => pyramidSectionRowId(r, j))) : new Set());
    } else if (visible && node) {
      const def = defaultPyramidSections();
      setRows(def);
      setSizing("equal");
      setSegmentGapPx(2);
      setDirection("narrow-at-top");
      setApexPercent(12);
      setLabelsFollowFirstSection(false);
      setCollapsedSegIds(def.length > 2 ? new Set(def.map((r, j) => pyramidSectionRowId(r, j))) : new Set());
    }
  }, [visible, node]);

  useEffect(() => {
    if (!tierSpacingFocused) setTierSpacingDraft(String(segmentGapPx));
  }, [segmentGapPx, tierSpacingFocused]);

  useEffect(() => {
    if (!visible) setTierSpacingFocused(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const modalWidth = 400;
    const modalHeight = 520;
    const padding = 8;
    let posX = x;
    let posY = y;
    if (x + modalWidth > window.innerWidth - padding) posX = Math.max(padding, window.innerWidth - modalWidth - padding);
    if (y + modalHeight > window.innerHeight - padding)
      posY = Math.max(padding, window.innerHeight - modalHeight - padding);
    if (posX < padding) posX = padding;
    if (posY < padding) posY = padding;
    setPosition({ x: posX, y: posY });
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
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  const patchRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSave = () => {
    if (!node || isReadOnly) return;
    const cleaned: TimelineBarSectionData[] = rows.map((r, i) => {
      const fs = r.fillStyle ?? "solid";
      const base: TimelineBarSectionData = {
        id: r.id || `py-${i}`,
        label: r.label?.trim() || undefined,
        fill: r.fill || "#6b7280",
        weight: typeof r.weight === "number" && r.weight > 0 ? r.weight : 1,
        labelColor: r.labelColor?.trim() || undefined,
        fillStyle: fs,
        ...patchPyramidSectionLabelFields(r, i),
      };
      if (fs === "gradient") {
        const g0 = r.fillGradientColors?.[0] ?? r.fill ?? "#6b7280";
        const g1 = r.fillGradientColors?.[1] ?? g0;
        base.fillGradientColors = [String(g0), String(g1)];
        base.fillGradientAngle =
          typeof r.fillGradientAngle === "number" && Number.isFinite(r.fillGradientAngle) ? r.fillGradientAngle : 90;
      }
      return base;
    });
    let gapPx = segmentGapPx;
    if (!Number.isFinite(gapPx)) gapPx = 2;
    gapPx = Math.max(0, Math.min(32, gapPx));

    const apexRatio = Math.max(0, Math.min(1, apexPercent / 100));

    onSave(node.id, {
      sections: cleaned.length ? cleaned : defaultPyramidSections(),
      sizing,
      segmentGapPx: gapPx,
      direction,
      apexWidthRatio: apexRatio,
      labelsFollowFirstSection,
    });
    onClose();
  };

  const addRow = () => {
    if (!node || isReadOnly) return;
    const newId = newPyramidSectionId(node.id);
    setRows((prev) => [
      ...prev,
      {
        id: newId,
        label: `L${prev.length + 1}`,
        fill: "#94a3b8",
        fillStyle: "solid" as const,
        weight: 1,
      },
    ]);
    setCollapsedSegIds((s) => {
      const next = new Set(s);
      next.delete(newId);
      return next;
    });
  };

  const removeRow = (i: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const pyramidModalFontFamilySelectValue = (row: Row, index: number): string => {
    if (index > 0 && row.labelFontFamily === TIMELINE_BAR_LABEL_FIRST_SECTION) return TIMELINE_BAR_LABEL_FIRST_SECTION;
    if (row.labelFontFamily && row.labelFontFamily !== TIMELINE_BAR_LABEL_FIRST_SECTION) return PY_LABEL_FONT_CUSTOM;
    return PY_LABEL_SHAPE_DEFAULT;
  };

  const pyramidModalFontSizeSelectValue = (row: Row, index: number): string => {
    if (index > 0 && row.labelFontSize === TIMELINE_BAR_LABEL_FIRST_SECTION) return TIMELINE_BAR_LABEL_FIRST_SECTION;
    if (typeof row.labelFontSize === "number") return PY_LABEL_SIZE_CUSTOM;
    return PY_LABEL_SHAPE_DEFAULT;
  };

  if (!visible || !node) return null;

  return (
    <Draggable handle=".dw-pyramid-editor-drag-handle" nodeRef={panelRef}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="fixed z-[100] flex max-h-[min(80vh,calc(100vh-24px))] w-[400px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <div className="dw-pyramid-editor-drag-handle flex shrink-0 cursor-move items-center justify-between gap-2 border-b px-3 py-2">
          <span className="truncate text-sm font-semibold">Pyramid tiers</span>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Tier height</Label>
              <Select
                value={sizing === "weighted" ? "weighted" : "equal"}
                onValueChange={(v) => setSizing(v === "weighted" ? "weighted" : "equal")}
                disabled={isReadOnly}
              >
                <SelectTrigger className="h-8 w-[148px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="equal">
                    Equal
                  </SelectItem>
                  <SelectItem value="weighted">
                    Weighted
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Spacing</Label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="h-8 min-w-[4rem] tabular-nums text-xs"
                disabled={isReadOnly}
                value={tierSpacingFocused ? tierSpacingDraft : String(segmentGapPx)}
                onFocus={() => {
                  setTierSpacingFocused(true);
                  setTierSpacingDraft(String(segmentGapPx));
                }}
                onChange={(e) => setTierSpacingDraft(e.target.value)}
                onBlur={() => {
                  setTierSpacingFocused(false);
                  const t = tierSpacingDraft.trim();
                  if (t === "") {
                    setTierSpacingDraft(String(segmentGapPx));
                    return;
                  }
                  const n = parseFloat(t.replace(",", "."));
                  if (!Number.isFinite(n)) {
                    setTierSpacingDraft(String(segmentGapPx));
                    return;
                  }
                  const clamped = Math.min(32, Math.max(0, n));
                  setSegmentGapPx(clamped);
                  setTierSpacingDraft(String(clamped));
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 flex-col gap-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Narrow end</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection((v === "narrow-at-bottom" ? "narrow-at-bottom" : "narrow-at-top") as PyramidDirection)}
                disabled={isReadOnly}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="narrow-at-top">Top (classic)</SelectItem>
                  <SelectItem value="narrow-at-bottom">Bottom (inverted)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Narrow end (% of base, 0 = point)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                className="h-8 tabular-nums text-xs"
                value={apexPercent}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setApexPercent(Math.round(Math.min(100, Math.max(0, n))));
                }}
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
            <Label htmlFor="py-label-follow" className="text-xs">
              Typography follows first tier (sections 2+)
            </Label>
            <Switch
              id="py-label-follow"
              checked={labelsFollowFirstSection}
              onCheckedChange={setLabelsFollowFirstSection}
              disabled={isReadOnly}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Tiers · bottom → top</span>
            {!isReadOnly ? (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addRow}>
                <Plus className="h-3 w-3" />
                Tier
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => {
              const rowKey = pyramidSectionRowId(row, i);
              const collapsed = collapsedSegIds.has(rowKey);
              const title =
                `${(row.label ?? "").trim() || `Tier ${i + 1}`} · fill ${row.fillStyle ?? "solid"}${sizing === "weighted" ? ` · wt ${row.weight ?? 1}` : ""}`;
              return (
                <Collapsible
                  key={rowKey}
                  open={!collapsed}
                  onOpenChange={(open) =>
                    setCollapsedSegIds((s) => {
                      const next = new Set(s);
                      if (open) next.delete(rowKey);
                      else next.add(rowKey);
                      return next;
                    })
                  }
                >
                  <div className="rounded-md border border-border/70 bg-muted/30">
                    <div className="flex items-center gap-1 border-b border-border/70 px-2 py-2">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-0.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              collapsed && "-rotate-90",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
                        </button>
                      </CollapsibleTrigger>
                      {!isReadOnly && rows.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove tier"
                          aria-label="Remove tier"
                          onClick={() => removeRow(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <CollapsibleContent>
                      <div className="space-y-3 px-2 pb-3 pt-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Tier label</Label>
                          <Textarea
                            value={row.label ?? ""}
                            onChange={(e) => patchRow(i, { label: e.target.value })}
                            rows={3}
                            className="min-h-[4.5rem] resize-y text-xs"
                            disabled={isReadOnly}
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Line breaks show on the pyramid. Use Enter while editing on-canvas to add lines (Ctrl/Cmd+Enter
                            commits inline edit).
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Label color</Label>
                            <ColorPicker
                              value={row.labelColor || "#111827"}
                              onChange={(v) => patchRow(i, { labelColor: v })}
                              allowTransparent
                            />
                          </div>
                          {sizing === "weighted" ? (
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-[10px] text-muted-foreground">Height weight</Label>
                              <Input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={typeof row.weight === "number" ? row.weight : 1}
                                onChange={(e) => {
                                  const n = parseFloat(e.target.value);
                                  patchRow(i, { weight: Number.isFinite(n) && n > 0 ? n : 1 });
                                }}
                                className="h-8 text-xs tabular-nums"
                                disabled={isReadOnly}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="shrink-0 text-[10px] text-muted-foreground">Fill style</Label>
                          <Select
                            value={row.fillStyle ?? "solid"}
                            onValueChange={(v) => {
                              patchRow(i, { fillStyle: v as TimelineBarSectionData["fillStyle"] });
                            }}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="h-8 w-[148px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[110]">
                              <SelectItem value="solid">Solid</SelectItem>
                              <SelectItem value="gradient">Gradient</SelectItem>
                              <SelectItem value="theme-hue">Theme hue</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(row.fillStyle ?? "solid") === "gradient" ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Start</Label>
                              <ColorPicker
                                value={row.fillGradientColors?.[0] ?? row.fill ?? "#6b7280"}
                                onChange={(v) => {
                                  const c = row.fillGradientColors || ["#6b7280", "#6b7280"];
                                  patchRow(i, { fillGradientColors: [v, c[1]] });
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">End</Label>
                              <ColorPicker
                                value={row.fillGradientColors?.[1] ?? row.fill ?? "#6b7280"}
                                onChange={(v) => {
                                  const c = row.fillGradientColors || ["#6b7280", "#6b7280"];
                                  patchRow(i, { fillGradientColors: [c[0], v] });
                                }}
                              />
                            </div>
                            <div className="min-w-[8rem] flex-1">
                              <GradientAnglePicker
                                label="Angle"
                                value={typeof row.fillGradientAngle === "number" ? row.fillGradientAngle : 90}
                                onChange={(a) => patchRow(i, { fillGradientAngle: a })}
                              />
                            </div>
                          </div>
                        ) : (row.fillStyle ?? "solid") !== "theme-hue" ? (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Fill</Label>
                            <ColorPicker
                              value={String(row.fill ?? "#6b7280")}
                              onChange={(value) => patchRow(i, { fill: value })}
                              allowTransparent
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-[11px] text-muted-foreground">
                              Uses the shape background colour as the base; each further theme-hue tier shifts hue by the value in
                              the Themes menu (&quot;Step hue for multi-selection&quot;) — not the Timeline bar step under Visual
                              styling.
                            </p>
                            {node && rows.length > 0 ? (
                              <span className="mt-1 flex items-center gap-2">
                                {(() => {
                                  const previewHueNode = { ...node, pyramidSections: rows } as DiagramNodeData;
                                  const previewSecs = normalizePyramidSections(previewHueNode);
                                  const fillGrad = timelineBarSectionThemeHueFillGradient(
                                    previewHueNode,
                                    previewSecs,
                                    i,
                                    themesMenuHueStepDeg,
                                  );
                                  const borderGrad = timelineBarSectionThemeHueBorderGradient(
                                    previewHueNode,
                                    previewSecs,
                                    i,
                                    themesMenuHueStepDeg,
                                  );
                                  const fillSolid = timelineBarSectionThemeHueFill(
                                    previewHueNode,
                                    previewSecs,
                                    i,
                                    themesMenuHueStepDeg,
                                  );
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
                                        title="Preview: fill and border (this tier, Themes menu hue step)"
                                      >
                                        <span className="block h-4 w-4 rounded-sm" style={innerStyle} />
                                      </span>
                                    );
                                  }
                                  return (
                                    <span
                                      className="inline-block h-4 w-4 shrink-0 rounded border border-border"
                                      style={innerStyle}
                                      title="Preview using Themes menu hue step"
                                    />
                                  );
                                })()}
                                <span className="text-[10px] text-muted-foreground">Matches canvas tier colour</span>
                              </span>
                            ) : null}
                          </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex min-w-0 flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Text align</Label>
                            <Select
                              value={row.labelTextJustify ?? PY_LABEL_SHAPE_DEFAULT}
                              onValueChange={(v) => {
                                if (v === PY_LABEL_SHAPE_DEFAULT) patchRow(i, { labelTextJustify: undefined });
                                else patchRow(i, { labelTextJustify: v as Row["labelTextJustify"] });
                              }}
                              disabled={isReadOnly}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-[110]">
                                <SelectItem value={PY_LABEL_SHAPE_DEFAULT}>Shape default</SelectItem>
                                {i > 0 ? (
                                  <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION}>First tier</SelectItem>
                                ) : null}
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                                <SelectItem value="full">Full</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex min-w-0 flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground">Vertical</Label>
                            <Select
                              value={row.labelVerticalAlign ?? PY_LABEL_SHAPE_DEFAULT}
                              onValueChange={(v) => {
                                if (v === PY_LABEL_SHAPE_DEFAULT) patchRow(i, { labelVerticalAlign: undefined });
                                else patchRow(i, { labelVerticalAlign: v as Row["labelVerticalAlign"] });
                              }}
                              disabled={isReadOnly}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-[110]">
                                <SelectItem value={PY_LABEL_SHAPE_DEFAULT}>Shape default</SelectItem>
                                {i > 0 ? (
                                  <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION}>First tier</SelectItem>
                                ) : null}
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="middle">Middle</SelectItem>
                                <SelectItem value="bottom">Bottom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Font</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Select
                                value={pyramidModalFontFamilySelectValue(row, i)}
                                onValueChange={(v) => {
                                  if (v === PY_LABEL_SHAPE_DEFAULT) patchRow(i, { labelFontFamily: undefined });
                                  else if (v === TIMELINE_BAR_LABEL_FIRST_SECTION && i > 0) {
                                    patchRow(i, { labelFontFamily: TIMELINE_BAR_LABEL_FIRST_SECTION });
                                  } else if (v === PY_LABEL_FONT_CUSTOM) {
                                    patchRow(i, {
                                      labelFontFamily:
                                        typeof row.labelFontFamily === "string" && row.labelFontFamily.trim()
                                          ? row.labelFontFamily.trim()
                                          : "Inter",
                                    });
                                  }
                                }}
                                disabled={isReadOnly}
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[110]">
                                  <SelectItem value={PY_LABEL_SHAPE_DEFAULT}>Shape default</SelectItem>
                                  {i > 0 ? (
                                    <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION}>First tier</SelectItem>
                                  ) : null}
                                  <SelectItem value={PY_LABEL_FONT_CUSTOM}>Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              {pyramidModalFontFamilySelectValue(row, i) === PY_LABEL_FONT_CUSTOM ? (
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
                                  placeholder="Family"
                                  className="h-8 flex-1 text-xs"
                                  disabled={isReadOnly}
                                />
                              ) : null}
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Font size</Label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Select
                                value={pyramidModalFontSizeSelectValue(row, i)}
                                onValueChange={(v) => {
                                  if (v === PY_LABEL_SHAPE_DEFAULT) patchRow(i, { labelFontSize: undefined });
                                  else if (v === TIMELINE_BAR_LABEL_FIRST_SECTION && i > 0) {
                                    patchRow(i, { labelFontSize: TIMELINE_BAR_LABEL_FIRST_SECTION });
                                  } else if (v === PY_LABEL_SIZE_CUSTOM) {
                                    const fallback =
                                      typeof row.labelFontSize === "number" && Number.isFinite(row.labelFontSize)
                                        ? row.labelFontSize
                                        : typeof node.fontSize === "number" && node.fontSize > 0
                                          ? node.fontSize
                                          : 12;
                                    patchRow(i, { labelFontSize: Math.min(96, Math.max(4, Math.round(fallback))) });
                                  }
                                }}
                                disabled={isReadOnly}
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[110]">
                                  <SelectItem value={PY_LABEL_SHAPE_DEFAULT}>Shape default</SelectItem>
                                  {i > 0 ? (
                                    <SelectItem value={TIMELINE_BAR_LABEL_FIRST_SECTION}>First tier</SelectItem>
                                  ) : null}
                                  <SelectItem value={PY_LABEL_SIZE_CUSTOM}>Custom (px)</SelectItem>
                                </SelectContent>
                              </Select>
                              {pyramidModalFontSizeSelectValue(row, i) === PY_LABEL_SIZE_CUSTOM ? (
                                <Input
                                  type="number"
                                  min={4}
                                  max={96}
                                  value={typeof row.labelFontSize === "number" ? String(row.labelFontSize) : ""}
                                  onChange={(e) => {
                                    const t = e.target.value.trim();
                                    if (!t) {
                                      patchRow(i, { labelFontSize: undefined });
                                      return;
                                    }
                                    const n = parseFloat(t);
                                    patchRow(i, {
                                      labelFontSize: Number.isFinite(n) && n > 0 ? Math.min(96, Math.max(4, n)) : undefined,
                                    });
                                  }}
                                  className="h-8 w-24 tabular-nums text-xs"
                                  disabled={isReadOnly}
                                />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t p-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isReadOnly}>
            Apply
          </Button>
        </div>
      </div>
    </Draggable>
  );
}
