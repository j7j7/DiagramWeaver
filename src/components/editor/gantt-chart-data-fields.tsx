"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { NodeChartSpecGantt } from "@/lib/types";
import { newChartSliceId } from "@/lib/chart-node";
import {
  clampGanttCols,
  clampGanttSubdivisions,
  GANTT_GATE_BAR_BORDER,
  GANTT_GATE_BAR_FILL,
  GANTT_GATE_LABEL,
  GANTT_LABEL_CHIP_FILL,
  GANTT_PHASE_LABEL,
  GANTT_TASK_BAR_BORDER,
  GANTT_TASK_BAR_FILL,
  GANTT_TASK_LABEL,
  normalizeGanttBars,
  normalizeGanttRows,
} from "@/lib/gantt-chart-layout";
import { insertGanttRowAt } from "@/lib/gantt-chart-ops";

function toSwatchHex(value: string | undefined, fallback: string): string {
  const raw = (value?.trim() || fallback).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return `#${[m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(fallback) ? fallback : "#888888";
}

function GanttColorSwatch({
  value,
  fallback,
  onChange,
  title,
}: {
  value?: string;
  fallback: string;
  onChange: (color: string) => void;
  title: string;
}) {
  const hex = toSwatchHex(value, fallback);
  return (
    <label className="relative h-8 w-8 shrink-0 cursor-pointer" title={title}>
      <span
        className="block h-8 w-8 rounded-md border border-border"
        style={{ background: value?.trim() || fallback }}
      />
      <input
        type="color"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        aria-label={title}
      />
    </label>
  );
}

export function GanttChartDataFields({
  chart,
  isReadOnly,
  onPatch,
}: {
  chart: NodeChartSpecGantt;
  isReadOnly: boolean;
  onPatch: (next: NodeChartSpecGantt) => void;
}) {
  const rows = normalizeGanttRows(chart.rows);
  const cols = clampGanttCols(chart.cols);
  const bars = normalizeGanttBars(chart.bars, rows, cols);
  const titles = [...(chart.columnTitles ?? [])];
  while (titles.length < cols) titles.push("");
  const taskFill = chart.taskBarFill?.trim() || GANTT_TASK_BAR_FILL;
  const taskBorder = chart.taskBarBorder?.trim() || GANTT_TASK_BAR_BORDER;
  const gateFill = chart.gateBarFill?.trim() || GANTT_GATE_BAR_FILL;
  const gateBorder = chart.gateBarBorder?.trim() || GANTT_GATE_BAR_BORDER;
  const chipFill = chart.taskChipFill?.trim() || GANTT_LABEL_CHIP_FILL;
  const taskText = chart.taskLabelColor?.trim() || GANTT_TASK_LABEL;
  const phaseText = chart.phaseLabelColor?.trim() || GANTT_PHASE_LABEL;
  const gateText = chart.gateLabelColor?.trim() || GANTT_GATE_LABEL;
  const axisText = chart.axisColor?.trim() || "#64748b";

  return (
    <div className={cn("space-y-4", isReadOnly && "pointer-events-none opacity-75")}>
      <div className="rounded-md border border-border bg-sky-50/50 p-3 dark:bg-background">
        <Label className="mb-2 block text-sm font-semibold">Timeline</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Columns</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={cols}
              onChange={(e) => {
                const nextCols = clampGanttCols(Number(e.target.value));
                const nextTitles = titles.slice(0, nextCols);
                while (nextTitles.length < nextCols) nextTitles.push("Month");
                onPatch({ ...chart, kind: "gantt", cols: nextCols, columnTitles: nextTitles });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Week ticks / column</Label>
            <Input
              type="number"
              min={1}
              max={8}
              value={clampGanttSubdivisions(chart.subdivisions)}
              onChange={(e) =>
                onPatch({
                  ...chart,
                  kind: "gantt",
                  subdivisions: clampGanttSubdivisions(Number(e.target.value)),
                })
              }
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Column titles (comma-separated)</Label>
            <Input
              value={titles.join(", ")}
              onChange={(e) =>
                onPatch({
                  ...chart,
                  kind: "gantt",
                  columnTitles: e.target.value.split(/[,;\n]+/).map((s) => s.trim()),
                })
              }
              placeholder="April, May, June"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Chart title</Label>
            <Input
              value={chart.title ?? ""}
              onChange={(e) => onPatch({ ...chart, kind: "gantt", title: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={chart.showGridLines !== false}
              onCheckedChange={(v) => onPatch({ ...chart, kind: "gantt", showGridLines: v })}
            />
            <Label className="text-xs">Timeline lines</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={chart.showLegend !== false}
              onCheckedChange={(v) => onPatch({ ...chart, kind: "gantt", showLegend: v })}
            />
            <Label className="text-xs">Legend</Label>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/50 p-3">
        <Label className="mb-2 block text-sm font-semibold">Default colours</Label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Task bar</Label>
            <div className="flex gap-1">
              <GanttColorSwatch
                value={chart.taskBarFill}
                fallback={GANTT_TASK_BAR_FILL}
                title="Task bar fill"
                onChange={(v) => onPatch({ ...chart, kind: "gantt", taskBarFill: v })}
              />
              <GanttColorSwatch
                value={chart.taskBarBorder}
                fallback={GANTT_TASK_BAR_BORDER}
                title="Task bar border"
                onChange={(v) => onPatch({ ...chart, kind: "gantt", taskBarBorder: v })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Gate bar</Label>
            <div className="flex gap-1">
              <GanttColorSwatch
                value={chart.gateBarFill}
                fallback={GANTT_GATE_BAR_FILL}
                title="Gate bar fill"
                onChange={(v) => onPatch({ ...chart, kind: "gantt", gateBarFill: v })}
              />
              <GanttColorSwatch
                value={chart.gateBarBorder}
                fallback={GANTT_GATE_BAR_BORDER}
                title="Gate bar border"
                onChange={(v) => onPatch({ ...chart, kind: "gantt", gateBarBorder: v })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Section chip</Label>
            <GanttColorSwatch
              value={chart.taskChipFill}
              fallback={GANTT_LABEL_CHIP_FILL}
              title="Task section chip"
              onChange={(v) => onPatch({ ...chart, kind: "gantt", taskChipFill: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Task text</Label>
            <GanttColorSwatch
              value={chart.taskLabelColor}
              fallback={GANTT_TASK_LABEL}
              title="Task label text"
              onChange={(v) => onPatch({ ...chart, kind: "gantt", taskLabelColor: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Phase text</Label>
            <GanttColorSwatch
              value={chart.phaseLabelColor}
              fallback={GANTT_PHASE_LABEL}
              title="Phase label text"
              onChange={(v) => onPatch({ ...chart, kind: "gantt", phaseLabelColor: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Gate text</Label>
            <GanttColorSwatch
              value={chart.gateLabelColor}
              fallback={GANTT_GATE_LABEL}
              title="Gate bar text"
              onChange={(v) => onPatch({ ...chart, kind: "gantt", gateLabelColor: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Month text</Label>
            <GanttColorSwatch
              value={chart.axisColor}
              fallback="#64748b"
              title="Timeline / month text"
              onChange={(v) => onPatch({ ...chart, kind: "gantt", axisColor: v })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">Rows</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => onPatch(insertGanttRowAt(chart, rows.length, "phase"))}
            >
              <Plus className="mr-1 h-3 w-3" /> Phase
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => onPatch(insertGanttRowAt(chart, rows.length, "task"))}
            >
              <Plus className="mr-1 h-3 w-3" /> Task
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.id} className="space-y-1 rounded-md border border-transparent">
              <div className="flex items-center gap-2">
                <Select
                  value={row.kind}
                  onValueChange={(v) => {
                    const kind = v === "phase" ? "phase" : "task";
                    onPatch({
                      ...chart,
                      kind: "gantt",
                      rows: rows.map((r, idx) => (idx === i ? { ...r, kind } : r)),
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-[92px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="phase">Phase</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-xs"
                  value={row.label}
                  onChange={(e) =>
                    onPatch({
                      ...chart,
                      kind: "gantt",
                      rows: rows.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0"
                  disabled={rows.length <= 1}
                  onClick={() => {
                    const nextRows = rows.filter((_, idx) => idx !== i);
                    onPatch({
                      ...chart,
                      kind: "gantt",
                      rows: nextRows,
                      bars: bars.filter((b) => b.rowId !== row.id),
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-3 pl-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Section</span>
                  <GanttColorSwatch
                    value={row.chipFill}
                    fallback={row.kind === "task" ? chipFill : "#f8f9fa"}
                    title={`${row.label || "Row"} section colour`}
                    onChange={(v) =>
                      onPatch({
                        ...chart,
                        kind: "gantt",
                        rows: rows.map((r, idx) => (idx === i ? { ...r, chipFill: v } : r)),
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Text</span>
                  <GanttColorSwatch
                    value={row.labelColor}
                    fallback={row.kind === "phase" ? phaseText : taskText}
                    title={`${row.label || "Row"} text colour`}
                    onChange={(v) =>
                      onPatch({
                        ...chart,
                        kind: "gantt",
                        rows: rows.map((r, idx) => (idx === i ? { ...r, labelColor: v } : r)),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-amber-50/40 p-3 dark:bg-background">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">Bars</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              const task = rows.find((r) => r.kind === "task");
              if (!task) return;
              onPatch({
                ...chart,
                kind: "gantt",
                bars: [
                  ...bars,
                  {
                    id: newChartSliceId(),
                    rowId: task.id,
                    start: 0,
                    end: Math.max(1, cols * 0.35),
                    variant: "task",
                  },
                ],
              });
            }}
          >
            <Plus className="mr-1 h-3 w-3" /> Bar
          </Button>
        </div>
        <div className="space-y-2">
          {bars.map((bar) => {
            const isGate = (bar.variant ?? "task") === "gate";
            return (
              <div key={bar.id} className="space-y-1">
                <div className="grid grid-cols-[1fr_56px_56px_84px_28px] items-center gap-1.5">
                  <Select
                    value={bar.rowId}
                    onValueChange={(v) =>
                      onPatch({
                        ...chart,
                        kind: "gantt",
                        bars: bars.map((b) => (b.id === bar.id ? { ...b, rowId: v } : b)),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      {rows
                        .filter((r) => r.kind === "task")
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label || "Task"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    step={0.25}
                    min={0}
                    max={cols}
                    value={bar.start}
                    onChange={(e) =>
                      onPatch({
                        ...chart,
                        kind: "gantt",
                        bars: bars.map((b) =>
                          b.id === bar.id ? { ...b, start: Number(e.target.value) } : b
                        ),
                      })
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    step={0.25}
                    min={0}
                    max={cols}
                    value={bar.end}
                    onChange={(e) =>
                      onPatch({
                        ...chart,
                        kind: "gantt",
                        bars: bars.map((b) =>
                          b.id === bar.id ? { ...b, end: Number(e.target.value) } : b
                        ),
                      })
                    }
                  />
                  <Select
                    value={bar.variant ?? "task"}
                    onValueChange={(v) =>
                      onPatch({
                        ...chart,
                        kind: "gantt",
                        bars: bars.map((b) =>
                          b.id === bar.id
                            ? {
                                ...b,
                                variant: v === "gate" ? "gate" : "task",
                                label: v === "gate" ? b.label || "GATE" : b.label,
                              }
                            : b
                        ),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="gate">Gate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      onPatch({
                        ...chart,
                        kind: "gantt",
                        bars: bars.filter((b) => b.id !== bar.id),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Fill</span>
                    <GanttColorSwatch
                      value={bar.fill}
                      fallback={isGate ? gateFill : taskFill}
                      title="Bar fill"
                      onChange={(v) =>
                        onPatch({
                          ...chart,
                          kind: "gantt",
                          bars: bars.map((b) => (b.id === bar.id ? { ...b, fill: v } : b)),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Border</span>
                    <GanttColorSwatch
                      value={bar.border}
                      fallback={isGate ? gateBorder : taskBorder}
                      title="Bar border"
                      onChange={(v) =>
                        onPatch({
                          ...chart,
                          kind: "gantt",
                          bars: bars.map((b) => (b.id === bar.id ? { ...b, border: v } : b)),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Text</span>
                    <GanttColorSwatch
                      value={bar.labelColor}
                      fallback={isGate ? gateText : axisText}
                      title="Bar text"
                      onChange={(v) =>
                        onPatch({
                          ...chart,
                          kind: "gantt",
                          bars: bars.map((b) => (b.id === bar.id ? { ...b, labelColor: v } : b)),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
