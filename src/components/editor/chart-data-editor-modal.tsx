"use client";

import React, { useRef, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DiagramNodeData, ChartSeriesItem, NodeChartSpec } from "@/lib/types";
import { defaultPieChartSpec, newChartSliceId } from "@/lib/chart-node";

interface EditRow {
  id: string;
  name: string;
  valueStr: string;
  color: string;
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

  useEffect(() => {
    if (visible && node) {
      const spec = (node as DiagramNodeData & { chart?: NodeChartSpec }).chart;
      const series: ChartSeriesItem[] = spec?.series?.length
        ? spec.series.map((s) => ({ ...s }))
        : defaultPieChartSpec().series;
      setRows(
        series.map((s) => ({
          id: s.id || newChartSliceId(),
          name: s.name,
          valueStr: String(s.value),
          color: s.color ?? "",
        }))
      );
    }
  }, [visible, node]);

  useEffect(() => {
    if (visible) {
      const modalWidth = 380;
      const modalHeight = 440;
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
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  const handleSave = () => {
    if (!node || isReadOnly) return;
    const cleaned: ChartSeriesItem[] = rows.map((r, i) => {
      const raw = Number(String(r.valueStr).replace(/,/g, "."));
      const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
      const name = (r.name ?? "").trim() || `Series ${i + 1}`;
      return {
        id: r.id || newChartSliceId(),
        name,
        value,
        ...(r.color.trim() ? { color: r.color.trim() } : {}),
      };
    });
    if (cleaned.length === 0) {
      onSave(node.id, defaultPieChartSpec());
      onClose();
      return;
    }
    const chart: NodeChartSpec = { kind: "pie", series: cleaned };
    onSave(node.id, chart);
    onClose();
  };

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { id: newChartSliceId(), name: `Series ${prev.length + 1}`, valueStr: "0", color: "" },
    ]);

  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const updateRow = (i: number, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  if (!visible) return null;

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
          className="fixed w-[380px] rounded-md border border-border bg-popover shadow-lg p-0 z-[70]"
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
          <div className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              Names and numeric values define slice sizes. Optional color overrides the default palette.
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Slices</span>
              {!isReadOnly && (
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addRow}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={row.id} className="flex flex-wrap gap-1 items-center">
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="Name"
                    className="h-8 text-xs flex-1 min-w-[100px]"
                    disabled={isReadOnly}
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={row.valueStr}
                    onChange={(e) => updateRow(i, { valueStr: e.target.value })}
                    placeholder="Value"
                    className="h-8 text-xs w-[72px]"
                    disabled={isReadOnly}
                  />
                  <Input
                    value={row.color}
                    onChange={(e) => updateRow(i, { color: e.target.value })}
                    placeholder="#hex"
                    className="h-8 text-xs w-[72px] font-mono"
                    disabled={isReadOnly}
                  />
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
              ))}
            </div>
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
