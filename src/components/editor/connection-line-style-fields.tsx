"use client";

import React, { useEffect, useRef } from "react";
import { Info, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorPicker } from "@/components/ui/color-picker";
import { Checkbox } from "@/components/ui/checkbox";
import type { DiagramConnectionData } from "@/lib/types";
import { isUseSourceLineColorOn } from "@/lib/connection-line-style";

export interface ConnectionLineStyleFieldsProps {
  liveConnection: DiagramConnectionData;
  /** Resolved stroke color (explicit connection color or inherited from nodes). */
  resolvedConnectionColor: string;
  from: string;
  to: string;
  connectionId?: string;
  onConnectionUpdate: (from: string, to: string, updates: Record<string, unknown>, connectionId?: string) => void;
  isReadOnly?: boolean;
  /** Debounce (ms) for color picker updates only; omit or 0 for immediate commits. */
  debounceColorMs?: number;
}

function ShadowIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="6" height="6" rx="0.5" fill="rgba(0, 0, 0, 0.15)" />
      <rect
        x="0.5"
        y="0.5"
        width="6"
        height="6"
        rx="0.5"
        fill={active ? "#22c55e" : "#9ca3af"}
        stroke={active ? "#22c55e" : "#9ca3af"}
        strokeWidth="0.3"
      />
    </svg>
  );
}

export function ConnectionLineStyleFields({
  liveConnection,
  resolvedConnectionColor,
  from,
  to,
  connectionId,
  onConnectionUpdate,
  isReadOnly = false,
  debounceColorMs = 0,
}: ConnectionLineStyleFieldsProps) {
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    };
  }, []);

  const flushColorTimeout = () => {
    if (colorDebounceRef.current) {
      clearTimeout(colorDebounceRef.current);
      colorDebounceRef.current = null;
    }
  };

  const scheduleColorPatch = (updates: Record<string, unknown>) => {
    const run = () => onConnectionUpdate(from, to, updates, connectionId);
    if (!debounceColorMs || debounceColorMs <= 0) {
      flushColorTimeout();
      run();
      return;
    }
    flushColorTimeout();
    colorDebounceRef.current = setTimeout(() => {
      colorDebounceRef.current = null;
      run();
    }, debounceColorMs);
  };

  const lineWidthLocked = liveConnection.lineWidthLock !== false;
  const colorLocked = liveConnection.colorLock !== false;

  const toggleLineWidthLock = () => {
    if (lineWidthLocked) {
      onConnectionUpdate(
        from,
        to,
        {
          lineWidthLock: false,
          lineWidthEnd: liveConnection.lineWidthEnd ?? liveConnection.lineWidth ?? 2.5,
        },
        connectionId
      );
    } else {
      onConnectionUpdate(from, to, { lineWidthLock: true }, connectionId);
    }
  };

  const toggleColorLock = () => {
    if (colorLocked) {
      onConnectionUpdate(
        from,
        to,
        {
          colorLock: false,
          colorEnd: liveConnection.colorEnd ?? liveConnection.color ?? resolvedConnectionColor,
        },
        connectionId
      );
    } else {
      onConnectionUpdate(from, to, { colorLock: true }, connectionId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium">Line thickness</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={toggleLineWidthLock}
                disabled={isReadOnly}
                aria-label={lineWidthLocked ? "Unlock start and end thickness" : "Lock to single thickness"}
              >
                {lineWidthLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {lineWidthLocked
                ? "Same thickness both ends — click to set start and end separately"
                : "Start and end unlocked — click to use one thickness"}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {lineWidthLocked ? (
            <>
              <Input
                type="number"
                min={1}
                max={50}
                value={(liveConnection.lineWidth || 2.5).toString()}
                onChange={(e) => {
                  const width = Math.max(1, Math.min(50, parseFloat(e.target.value) || 2.5));
                  onConnectionUpdate(from, to, { lineWidth: width }, connectionId);
                }}
                className="h-8 w-[4.25rem] text-xs text-center shrink-0"
                disabled={isReadOnly}
                title="Line thickness (1–50 px)"
              />
              <span className="text-xs text-muted-foreground shrink-0">px</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground w-8 shrink-0">Start</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={(liveConnection.lineWidth ?? 2.5).toString()}
                  onChange={(e) => {
                    const width = Math.max(1, Math.min(50, parseFloat(e.target.value) || 2.5));
                    onConnectionUpdate(from, to, { lineWidth: width }, connectionId);
                  }}
                  className="h-8 w-[3.75rem] text-xs text-center shrink-0"
                  disabled={isReadOnly}
                  title="Start thickness (1–50 px)"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground w-8 shrink-0">End</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={(liveConnection.lineWidthEnd ?? liveConnection.lineWidth ?? 2.5).toString()}
                  onChange={(e) => {
                    const width = Math.max(1, Math.min(50, parseFloat(e.target.value) || 2.5));
                    onConnectionUpdate(from, to, { lineWidthEnd: width }, connectionId);
                  }}
                  className="h-8 w-[3.75rem] text-xs text-center shrink-0"
                  disabled={isReadOnly}
                  title="End thickness (1–50 px)"
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">px</span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={(liveConnection.shadow || false) ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() =>
                  onConnectionUpdate(from, to, { shadow: !(liveConnection.shadow || false) }, connectionId)
                }
                aria-pressed={!!liveConnection.shadow}
                disabled={isReadOnly}
              >
                <ShadowIcon active={!!liveConnection.shadow} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Depth effect</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 p-2">
        <Checkbox
          id={`conn-use-source-line-${from}-${to}-${connectionId ?? ""}`}
          checked={isUseSourceLineColorOn(liveConnection)}
          onCheckedChange={(v) =>
            onConnectionUpdate(from, to, { useSourceLineColor: v === true }, connectionId)
          }
          disabled={isReadOnly}
          className="mt-0.5"
          aria-label="Match source object outline color"
        />
        <div className="min-w-0 flex items-center gap-1">
          <Label
            htmlFor={`conn-use-source-line-${from}-${to}-${connectionId ?? ""}`}
            className="text-xs font-medium leading-snug cursor-pointer"
          >
            Match source outline color
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="How match source outline color works"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[min(280px,calc(100vw-2rem))] text-xs leading-snug">
              Uses the source object’s connector tint or border color; if neither is set, uses the connection color
              below.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium">Line color</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={toggleColorLock}
                disabled={isReadOnly}
                aria-label={colorLocked ? "Unlock start and end colors" : "Lock to single color"}
              >
                {colorLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {colorLocked
                ? "Single color — click to gradient from start to end"
                : "Gradient unlocked — click to use one color"}
            </TooltipContent>
          </Tooltip>
        </div>
        {colorLocked ? (
          <ColorPicker
            value={resolvedConnectionColor}
            onChange={(color) => scheduleColorPatch({ color })}
            placeholder="#6b7280"
            showAlpha={true}
            allowTransparent={true}
          />
        ) : (
          <div className="space-y-2">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Start</span>
              <ColorPicker
                value={liveConnection.color ?? resolvedConnectionColor}
                onChange={(color) => scheduleColorPatch({ color })}
                placeholder="#6b7280"
                showAlpha={true}
                allowTransparent={true}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">End</span>
              <ColorPicker
                value={liveConnection.colorEnd ?? liveConnection.color ?? resolvedConnectionColor}
                onChange={(color) => scheduleColorPatch({ colorEnd: color })}
                placeholder="#6b7280"
                showAlpha={true}
                allowTransparent={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
