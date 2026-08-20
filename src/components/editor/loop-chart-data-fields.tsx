"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoopChartItem, NodeChartSpecLoop } from "@/lib/types";
import { defaultLoopChartSpec } from "@/lib/chart-node";
import {
  LOOP_ARROW,
  LOOP_ARROW_WIDTH_DEFAULT,
  LOOP_ARROW_WIDTH_MAX,
  LOOP_ARROW_WIDTH_MIN,
  LOOP_HUB_FILL,
  LOOP_HUB_TEXT,
  LOOP_INWARD,
  LOOP_ITEM_BORDER,
  LOOP_ITEM_FILL,
  LOOP_MAX_ITEMS,
  LOOP_MIN_ITEMS,
  normalizeLoopItems,
  resolveLoopItemHueStepDeg,
} from "@/lib/loop-chart-layout";
import { deleteLoopItemAt, insertLoopItemAt } from "@/lib/loop-chart-ops";

interface LoopChartDataFieldsProps {
  chart: NodeChartSpecLoop;
  isReadOnly: boolean;
  onPatch: (next: NodeChartSpecLoop) => void;
}

function patchItem(
  chart: NodeChartSpecLoop,
  index: number,
  patch: Partial<LoopChartItem>
): NodeChartSpecLoop {
  const items = normalizeLoopItems(chart.items).map((item, i) =>
    i === index ? { ...item, ...patch } : item
  );
  return { ...chart, kind: "loop", items };
}

export function LoopChartDataFields({ chart, isReadOnly, onPatch }: LoopChartDataFieldsProps) {
  const items = normalizeLoopItems(chart.items);
  const arrowWidth =
    typeof chart.arrowWidth === "number" && Number.isFinite(chart.arrowWidth)
      ? Math.min(LOOP_ARROW_WIDTH_MAX, Math.max(LOOP_ARROW_WIDTH_MIN, chart.arrowWidth))
      : LOOP_ARROW_WIDTH_DEFAULT;
  const itemColorMode = chart.itemColorMode === "hue-step" ? "hue-step" : "same";
  const arrowColorMode = chart.arrowColorMode === "hue-step" ? "hue-step" : "fixed";
  const hueStepDeg = resolveLoopItemHueStepDeg(chart);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/50 p-3">
        <Label className="mb-2 block text-sm font-semibold">Hub</Label>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Title</Label>
            <Input
              value={chart.title ?? ""}
              disabled={isReadOnly}
              onChange={(e) => onPatch({ ...chart, kind: "loop", title: e.target.value })}
              placeholder="Shared memory"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Subtitle</Label>
            <Input
              value={chart.subtitle ?? ""}
              disabled={isReadOnly}
              onChange={(e) => onPatch({ ...chart, kind: "loop", subtitle: e.target.value })}
              placeholder="one record, every loop"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={chart.showInwardArrows !== false}
              disabled={isReadOnly}
              onCheckedChange={(v) => onPatch({ ...chart, kind: "loop", showInwardArrows: v })}
            />
            <Label className="text-xs">Inward arrows to hub</Label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={chart.rotateItems === true}
              disabled={isReadOnly}
              onCheckedChange={(v) => onPatch({ ...chart, kind: "loop", rotateItems: v })}
            />
            <Label className="text-xs">Rotate items around the circle</Label>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/50 p-3">
        <Label className="mb-2 block text-sm font-semibold">Default colours</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Hub fill</Label>
            <ColorPicker
              value={chart.hubFill?.trim() || LOOP_HUB_FILL}
              onChange={(v) => onPatch({ ...chart, kind: "loop", hubFill: v })}
              showAlpha
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Hub text</Label>
            <ColorPicker
              value={chart.hubTextColor?.trim() || LOOP_HUB_TEXT}
              onChange={(v) => onPatch({ ...chart, kind: "loop", hubTextColor: v })}
              showAlpha
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Item fill</Label>
            <ColorPicker
              value={chart.itemFill?.trim() || LOOP_ITEM_FILL}
              onChange={(v) => onPatch({ ...chart, kind: "loop", itemFill: v })}
              showAlpha
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Item border</Label>
            <ColorPicker
              value={chart.itemBorder?.trim() || LOOP_ITEM_BORDER}
              onChange={(v) => onPatch({ ...chart, kind: "loop", itemBorder: v })}
              showAlpha
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Loop arrows</Label>
            <ColorPicker
              value={chart.arrowColor?.trim() || LOOP_ARROW}
              onChange={(v) => onPatch({ ...chart, kind: "loop", arrowColor: v })}
              showAlpha
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Inward arrows</Label>
            <ColorPicker
              value={chart.inwardArrowColor?.trim() || LOOP_INWARD}
              onChange={(v) => onPatch({ ...chart, kind: "loop", inwardArrowColor: v })}
              showAlpha
            />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Item colours</Label>
            <Select
              value={itemColorMode}
              disabled={isReadOnly}
              onValueChange={(v) =>
                onPatch({
                  ...chart,
                  kind: "loop",
                  itemColorMode: v === "hue-step" ? "hue-step" : "same",
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Same for all items</SelectItem>
                <SelectItem value="hue-step">Hue step around ring</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Loop arrow colour</Label>
            <Select
              value={arrowColorMode}
              disabled={isReadOnly}
              onValueChange={(v) =>
                onPatch({
                  ...chart,
                  kind: "loop",
                  arrowColorMode: v === "hue-step" ? "hue-step" : "fixed",
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed colour</SelectItem>
                <SelectItem value="hue-step">Hue step per segment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {itemColorMode === "hue-step" || arrowColorMode === "hue-step" ? (
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
                  kind: "loop",
                  itemHueStepDeg: Math.min(360, Math.max(1, Math.round(v[0] ?? hueStepDeg))),
                })
              }
              min={1}
              max={360}
              step={1}
              disabled={isReadOnly}
            />
            <p className="text-[10px] text-muted-foreground">
              Shifts item fill and border per step; loop arrows use the same step when set to hue step.
            </p>
          </div>
        ) : null}
        <div className="space-y-2 pt-3">
          <div className="flex justify-between gap-2">
            <Label className="text-xs">Arrow thickness</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{arrowWidth.toFixed(2)}</span>
          </div>
          <Slider
            value={[arrowWidth]}
            onValueChange={(v) =>
              onPatch({
                ...chart,
                kind: "loop",
                arrowWidth: Math.min(
                  LOOP_ARROW_WIDTH_MAX,
                  Math.max(LOOP_ARROW_WIDTH_MIN, v[0] ?? LOOP_ARROW_WIDTH_DEFAULT)
                ),
              })
            }
            min={LOOP_ARROW_WIDTH_MIN}
            max={LOOP_ARROW_WIDTH_MAX}
            step={0.05}
            disabled={isReadOnly}
          />
          <p className="text-[10px] text-muted-foreground">
            SVG chart units — applies to loop arrows and inward spokes.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm font-semibold">Items ({items.length})</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isReadOnly}
              onClick={() => onPatch(defaultLoopChartSpec())}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isReadOnly || items.length >= LOOP_MAX_ITEMS}
              onClick={() => onPatch(insertLoopItemAt(chart, items.length))}
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
                  disabled={isReadOnly || items.length <= LOOP_MIN_ITEMS}
                  onClick={() => onPatch(deleteLoopItemAt(chart, i))}
                  aria-label="Delete item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={item.subtitle ?? ""}
                disabled={isReadOnly}
                placeholder="Subtitle"
                className="h-7 text-xs"
                onChange={(e) => onPatch(patchItem(chart, i, { subtitle: e.target.value }))}
              />
              <Input
                value={item.spokeLabel ?? ""}
                disabled={isReadOnly || chart.showInwardArrows === false}
                placeholder="Inward arrow label (optional)"
                className="h-7 text-xs uppercase"
                onChange={(e) => onPatch(patchItem(chart, i, { spokeLabel: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
