"use client";

import React, { useRef, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { X, Plus, Unlink, GripHorizontal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorPicker } from "@/components/ui/color-picker";
import type { DiagramConnectionData, DiagramData } from "@/lib/types";
import { ConnectionAnimationControls } from "@/components/editor/connection-animation-controls";

interface ConnectionContextModalProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  connection: DiagramConnectionData;
  diagramData: DiagramData;
  onConnectionUpdate: (from: string, to: string, updates: Record<string, unknown>) => void;
  onConnectionAnimationBulkApply?: (sourceId: string, direction: 'outbound' | 'inbound', animation: DiagramConnectionData['animation']) => void;
  onConnectionDisconnect?: (from: string, to: string) => void;
  onConnectionWaypointAdd?: (from: string, to: string) => void;
  onConnectionWaypointRemove?: (from: string, to: string, index: number) => void;
  isReadOnly?: boolean;
}

export function ConnectionContextModal({
  x,
  y,
  visible,
  onClose,
  connection,
  diagramData,
  onConnectionUpdate,
  onConnectionAnimationBulkApply,
  onConnectionDisconnect,
  onConnectionWaypointAdd,
  onConnectionWaypointRemove,
  isReadOnly = false,
}: ConnectionContextModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Use live connection from diagramData so inputs stay in sync when we update
  const liveConnection = diagramData?.connections?.find(
    (c) => c.from === connection.from && c.to === connection.to
  ) ?? connection;

  const fromNode = diagramData?.nodes.find((n) => n.id === connection.from) ||
    diagramData?.zones?.find((z) => z.id === connection.from);
  const toNode = diagramData?.nodes.find((n) => n.id === connection.to) ||
    diagramData?.zones?.find((z) => z.id === connection.to);

  const connectionColor =
    liveConnection.color ||
    (toNode as any)?.lineColor ||
    (fromNode as any)?.lineColor ||
    "#6b7280";
  const textPosition = liveConnection.textPosition ?? 50;
  const connectionText = liveConnection.text || "";
  const hasArrow = liveConnection.arrow === true || liveConnection.toArrow === true;
  const waypoints = liveConnection.waypoints ?? [];
  const canAddWaypoint = !!onConnectionWaypointAdd && !isReadOnly;
  const canRemoveWaypoint = !!onConnectionWaypointRemove && !isReadOnly;

  const handleArrowToggle = () => {
    onConnectionUpdate(connection.from, connection.to, {
      arrow: !hasArrow,
      toArrow: !hasArrow,
    });
  };

  const handleTextChange = (text: string) => {
    onConnectionUpdate(connection.from, connection.to, { text });
  };

  const handleColorChange = (color: string) => {
    onConnectionUpdate(connection.from, connection.to, { color });
  };

  const handleTextPositionChange = (value: number) => {
    onConnectionUpdate(connection.from, connection.to, { textPosition: value });
  };

  const handleLineWidthChange = (value: number) => {
    onConnectionUpdate(connection.from, connection.to, { lineWidth: value });
  };

  const handleShadowToggle = () => {
    onConnectionUpdate(connection.from, connection.to, {
      shadow: !(liveConnection.shadow || false),
    });
  };

  // Initialize position from props when modal opens
  useEffect(() => {
    if (visible) {
      const modalWidth = 320;
      const modalHeight = 620;
      const padding = 8;
      let posX = x;
      let posY = y;
      if (x + modalWidth > window.innerWidth - padding) posX = Math.max(padding, window.innerWidth - modalWidth - padding);
      if (y + modalHeight > window.innerHeight - padding) posY = Math.max(padding, window.innerHeight - modalHeight - padding);
      if (posX < padding) posX = padding;
      if (posY < padding) posY = padding;
      setPosition({ x: posX, y: posY });
    }
  }, [visible, x, y]);

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visible, onClose]);

  // Click outside detection - ref on panel so overlay clicks close
  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-radix-select-content]")) return;
      if (target.closest("[data-radix-select-viewport]")) return;
      if (target.closest("[data-radix-select-item]")) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  if (!visible) return null;

  const fromLabel = (fromNode as any)?.label || connection.from;
  const toLabel = (toNode as any)?.label || connection.to;

  // Match Visual Styling: full-screen overlay + draggable panel
  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen z-[60]"
      style={{ pointerEvents: "auto" }}
    >
      <Draggable
        nodeRef={panelRef}
        position={position}
        onStop={(_e, data) => setPosition({ x: data.x, y: data.y })}
        handle=".connection-modal-drag-handle"
      >
        <div
          ref={panelRef}
          className="fixed w-80 rounded-md border border-border bg-popover shadow-lg p-0 z-[70]"
        >
      <div className="connection-modal-drag-handle flex items-center justify-between p-3 border-b cursor-move">
        <h3 className="font-semibold text-sm truncate" title={`${connection.from} → ${connection.to}`}>
          {fromLabel} → {toLabel}
        </h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Arrow</span>
          <Button
            variant={hasArrow ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={handleArrowToggle}
          >
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Text:</label>
          <Input
            type="text"
            value={connectionText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter connection text..."
            className="h-7 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Color:</label>
          <ColorPicker
            value={connectionColor}
            onChange={handleColorChange}
            placeholder="#6b7280"
            showAlpha={true}
            allowTransparent={true}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Text Position:</label>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Slider
              value={[textPosition]}
              onValueChange={(values) => handleTextPositionChange(values[0])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={textPosition}
              onChange={(e) =>
                handleTextPositionChange(
                  Math.max(0, Math.min(100, parseInt(e.target.value) || 50))
                )
              }
              className="h-7 w-16 text-xs text-center shrink-0"
              min={0}
              max={100}
            />
            <span className="text-xs text-muted-foreground shrink-0">%</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Line Thickness:</label>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              type="number"
              min={1}
              max={10}
              value={(liveConnection.lineWidth || 2.5).toString()}
              onChange={(e) => {
                const width = Math.max(
                  1,
                  Math.min(10, parseFloat(e.target.value) || 2.5)
                );
                handleLineWidthChange(width);
              }}
              className="h-7 w-20 text-xs text-center shrink-0"
            />
            <span className="text-xs text-muted-foreground shrink-0">px</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={(liveConnection.shadow || false) ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 shrink-0"
                onClick={handleShadowToggle}
              >
                <ShadowIcon active={!!liveConnection.shadow} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Depth effect</TooltipContent>
          </Tooltip>
          {onConnectionDisconnect && !isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive shrink-0"
              onClick={() => {
                onConnectionDisconnect(connection.from, connection.to);
                onClose();
              }}
            >
              <Unlink className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <ConnectionAnimationControls
            connection={liveConnection}
            inheritedConnectionColor={connectionColor}
            onConnectionUpdate={(from, to, updates) => onConnectionUpdate(from, to, updates as Record<string, unknown>)}
            onBulkApply={onConnectionAnimationBulkApply}
            isReadOnly={isReadOnly}
          />
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Connection points</span>
            {canAddWaypoint && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() =>
                  onConnectionWaypointAdd?.(connection.from, connection.to)
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>
          {waypoints.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {waypoints.map((wp: { x: number; y: number; id?: string }, idx: number) => (
                <div
                  key={wp.id ?? idx}
                  className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-accent/50"
                >
                  <GripHorizontal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-mono truncate">Waypoint {idx + 1}</span>
                  {canRemoveWaypoint && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                      onClick={() =>
                        onConnectionWaypointRemove?.(connection.from, connection.to, idx)
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </div>
      </Draggable>
    </div>
  );
}

function ShadowIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2"
        y="2"
        width="6"
        height="6"
        rx="0.5"
        fill="rgba(0, 0, 0, 0.15)"
      />
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
