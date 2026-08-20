"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArrowChartItem, NodeChartSpecArrow } from "@/lib/types";
import { defaultArrowChartSpec } from "@/lib/chart-node";
import {
  ARROW_GAP_DEG_DEFAULT,
  ARROW_GAP_DEG_MAX,
  ARROW_GAP_DEG_MIN,
  ARROW_GAP_DEG_OVERLAP,
  ARROW_INNER_RATIO_DEFAULT,
  ARROW_INNER_RATIO_MAX,
  ARROW_INNER_RATIO_MIN,
  ARROW_MAX_ITEMS,
  ARROW_MIN_ITEMS,
  ARROW_SEGMENT_BORDER,
  ARROW_SEGMENT_BORDER_WIDTH_DEFAULT,
  ARROW_SEGMENT_BORDER_WIDTH_MAX,
  ARROW_SEGMENT_BORDER_WIDTH_MIN,
  ARROW_SEGMENT_FILL,
  defaultArrowSegmentFillStart,
  normalizeArrowItems,
  resolveArrowColorMode,
  resolveArrowDirection,
  resolveArrowFillStyle,
  resolveArrowGapDeg,
  resolveArrowHueStepDeg,
  resolveArrowStartAngleDeg,
  resolveArrowStyle,
  ARROW_START_ANGLE_DEG_DEFAULT,
  ARROW_START_ANGLE_DEG_MAX,
  ARROW_START_ANGLE_DEG_MIN,
} from "@/lib/arrow-chart-layout";
import { deleteArrowItemAt, insertArrowItemAt } from "@/lib/arrow-chart-ops";

interface ArrowChartDataFieldsProps {
  chart: NodeChartSpecArrow;
  isReadOnly: boolean;
  onPatch: (next: NodeChartSpecArrow) => void;
}

function patchItem(
  chart: NodeChartSpecArrow,
  index: number,
  patch: Partial<ArrowChartItem>
): NodeChartSpecArrow {
  const items = normalizeArrowItems(chart.items).map((item, i) =>
    i === index ? { ...item, ...patch } : item
  );
  return { ...chart, kind: "arrow", items };
}

export function ArrowChartDataFields({ chart, isReadOnly, onPatch }: ArrowChartDataFieldsProps) {
  const items = normalizeArrowItems(chart.items);
  const arrowStyle = resolveArrowStyle(chart);
  const direction = resolveArrowDirection(chart);
  const colorMode = resolveArrowColorMode(chart);
  const fillStyle = resolveArrowFillStyle(chart);
  const hueStepDeg = resolveArrowHueStepDeg(chart);
  const segmentFill = chart.segmentFill?.trim() || ARROW_SEGMENT_FILL;
  const segmentFillStart = chart.segmentFillStart?.trim() || defaultArrowSegmentFillStart(segmentFill);
  const innerRatio =
    typeof chart.innerRatio === "number" && Number.isFinite(chart.innerRatio)
      ? Math.min(ARROW_INNER_RATIO_MAX, Math.max(ARROW_INNER_RATIO_MIN, chart.innerRatio))
      : ARROW_INNER_RATIO_DEFAULT;
  const gapDeg = resolveArrowGapDeg(chart);
  const startAngleDeg = resolveArrowStartAngleDeg(chart);
  const gapSliderVisible = arrowStyle !== "overlap";
  const borderWidth =
    typeof chart.segmentBorderWidth === "number" && Number.isFinite(chart.segmentBorderWidth)
      ? Math.min(
          ARROW_SEGMENT_BORDER_WIDTH_MAX,
          Math.max(ARROW_SEGMENT_BORDER_WIDTH_MIN, chart.segmentBorderWidth)
        )
      : 0;
  const borderOn = borderWidth > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/50 p-3">
        <Label className="mb-2 block text-sm font-semibold">Ring</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Arrow type</Label>
            <Select
              value={arrowStyle}
              disabled={isReadOnly}
              onValueChange={(v) =>
                onPatch({
                  ...chart,
                  kind: "arrow",
                  arrowStyle: v === "overlap" || v === "triangle" ? v : "chevron",
                  ...(v === "overlap" ? { gapDeg: ARROW_GAP_DEG_OVERLAP } : {}),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chevron">Chevron</SelectItem>
                <SelectItem value="triangle">Triangle</SelectItem>
                <SelectItem value="overlap">Rounded overlap</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Direction</Label>
            <Select
              value={direction}
              disabled={isReadOnly}
              onValueChange={(v) =>
                onPatch({
                  ...chart,
                  kind: "arrow",
                  direction: v === "anticlockwise" ? "anticlockwise" : "clockwise",
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clockwise">Clockwise</SelectItem>
                <SelectItem value="anticlockwise">Anticlockwise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2 pt-3">
          <div className="flex justify-between gap-2">
            <Label className="text-xs">Hole size</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(innerRatio * 100)}%
            </span>
          </div>
          <Slider
            value={[innerRatio]}
            onValueChange={(v) =>
              onPatch({
                ...chart,
                kind: "arrow",
                innerRatio: Math.min(
                  ARROW_INNER_RATIO_MAX,
                  Math.max(ARROW_INNER_RATIO_MIN, v[0] ?? ARROW_INNER_RATIO_DEFAULT)
                ),
              })
            }
            min={ARROW_INNER_RATIO_MIN}
            max={ARROW_INNER_RATIO_MAX}
            step={0.01}
            disabled={isReadOnly}
          />
        </div>
        {gapSliderVisible ? (
          <div className="space-y-2 pt-3">
            <div className="flex justify-between gap-2">
              <Label className="text-xs">Gap (°)</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{gapDeg.toFixed(1)}</span>
            </div>
            <Slider
              value={[gapDeg]}
              onValueChange={(v) =>
                onPatch({
                  ...chart,
                  kind: "arrow",
                  gapDeg: Math.min(
                    ARROW_GAP_DEG_MAX,
                    Math.max(ARROW_GAP_DEG_MIN, v[0] ?? ARROW_GAP_DEG_DEFAULT)
                  ),
                })
              }
              min={ARROW_GAP_DEG_MIN}
              max={ARROW_GAP_DEG_MAX}
              step={0.1}
              disabled={isReadOnly}
            />
          </div>
        ) : null}
        <div className="space-y-2 pt-3">
          <div className="flex justify-between gap-2">
            <Label className="text-xs">Start angle adjust (°)</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {startAngleDeg > 0 ? "+" : ""}
              {startAngleDeg.toFixed(1)}°
            </span>
          </div>
          <Slider
            value={[startAngleDeg]}
            onValueChange={(v) =>
              onPatch({
                ...chart,
                kind: "arrow",
                startAngleDeg: Math.min(
                  ARROW_START_ANGLE_DEG_MAX,
                  Math.max(
                    ARROW_START_ANGLE_DEG_MIN,
                    v[0] ?? ARROW_START_ANGLE_DEG_DEFAULT
                  )
                ),
              })
            }
            min={ARROW_START_ANGLE_DEG_MIN}
            max={ARROW_START_ANGLE_DEG_MAX}
            step={0.5}
            disabled={isReadOnly}
          />
        </div>
        <div className="flex items-center gap-2 pt-3">
          <Switch
            checked={borderOn}
            disabled={isReadOnly}
            onCheckedChange={(v) =>
              onPatch({
                ...chart,
                kind: "arrow",
                segmentBorderWidth: v ? ARROW_SEGMENT_BORDER_WIDTH_DEFAULT : 0,
              })
            }
          />
          <Label className="text-xs">Segment borders</Label>
        </div>
        {borderOn ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Border colour</Label>
              <ColorPicker
                value={chart.segmentBorder?.trim() || ARROW_SEGMENT_BORDER}
                onChange={(v) => onPatch({ ...chart, kind: "arrow", segmentBorder: v })}
                showAlpha={false}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between gap-2">
                <Label className="text-xs">Border width</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {borderWidth.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[borderWidth]}
                onValueChange={(v) =>
                  onPatch({
                    ...chart,
                    kind: "arrow",
                    segmentBorderWidth: Math.min(
                      ARROW_SEGMENT_BORDER_WIDTH_MAX,
                      Math.max(0.4, v[0] ?? ARROW_SEGMENT_BORDER_WIDTH_DEFAULT)
                    ),
                  })
                }
                min={0.4}
                max={ARROW_SEGMENT_BORDER_WIDTH_MAX}
                step={0.1}
                disabled={isReadOnly}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-muted/50 p-3">
        <Label className="mb-2 block text-sm font-semibold">Colours</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Segment fill</Label>
            <Select
              value={fillStyle}
              disabled={isReadOnly}
              onValueChange={(v) => {
                if (v === "gradient") {
                  onPatch({
                    ...chart,
                    kind: "arrow",
                    segmentFillStyle: "gradient",
                    segmentFillStart:
                      chart.segmentFillStart?.trim() || defaultArrowSegmentFillStart(segmentFill),
                  });
                  return;
                }
                onPatch({ ...chart, kind: "arrow", segmentFillStyle: "solid" });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Colour mode</Label>
            <Select
              value={colorMode}
              disabled={isReadOnly}
              onValueChange={(v) =>
                onPatch({
                  ...chart,
                  kind: "arrow",
                  colorMode: v === "hint" || v === "hue-step" ? v : "same",
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Same</SelectItem>
                <SelectItem value="hint">Hint</SelectItem>
                <SelectItem value="hue-step">Hue difference</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {fillStyle === "gradient" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Start (tail)</Label>
              <ColorPicker
                value={segmentFillStart}
                onChange={(v) => onPatch({ ...chart, kind: "arrow", segmentFillStart: v })}
                showAlpha={false}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">End (head)</Label>
              <ColorPicker
                value={segmentFill}
                onChange={(v) => onPatch({ ...chart, kind: "arrow", segmentFill: v })}
                showAlpha={false}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Fill colour</Label>
            <ColorPicker
              value={segmentFill}
              onChange={(v) => onPatch({ ...chart, kind: "arrow", segmentFill: v })}
              showAlpha={false}
            />
          </div>
        )}
        {colorMode === "hue-step" ? (
          <div className="space-y-2 pt-3">
            <div className="flex justify-between gap-2">
              <Label className="text-xs">Hue step (°)</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{hueStepDeg}°</span>
            </div>
            <Slider
              value={[hueStepDeg]}
              onValueChange={(v) =>
                onPatch({
                  ...chart,
                  kind: "arrow",
                  hueStepDeg: Math.min(360, Math.max(1, Math.round(v[0] ?? hueStepDeg))),
                })
              }
              min={1}
              max={360}
              step={1}
              disabled={isReadOnly}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-muted/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm font-semibold">Segments ({items.length})</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isReadOnly}
              onClick={() => onPatch(defaultArrowChartSpec())}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isReadOnly || items.length >= ARROW_MAX_ITEMS}
              onClick={() => onPatch(insertArrowItemAt(chart, items.length))}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id || i} className="rounded-md border border-border bg-background p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-[10px] text-muted-foreground">{i + 1}</span>
                <Input
                  value={item.title}
                  disabled={isReadOnly}
                  placeholder="Title"
                  className="h-7 text-xs"
                  onChange={(e) => onPatch(patchItem(chart, i, { title: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                  disabled={isReadOnly || items.length <= ARROW_MIN_ITEMS}
                  onClick={() => onPatch(deleteArrowItemAt(chart, i))}
                  aria-label="Delete segment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={item.subtitle ?? ""}
                disabled={isReadOnly}
                placeholder="Subtitle (optional)"
                className="h-7 text-xs"
                onChange={(e) => onPatch(patchItem(chart, i, { subtitle: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
