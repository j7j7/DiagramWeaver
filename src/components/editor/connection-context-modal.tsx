"use client";

import React, { useRef, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { X, Plus, GripHorizontal, ArrowRight, ArrowDownUp, ArrowLeftRight, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import type { DiagramConnectionData, DiagramData } from "@/lib/types";
import { resolveBezierConnectionPaint, type ConnectionEndpointOutline } from "@/lib/connection-line-style";
import { ConnectionAnimationControls } from "@/components/editor/connection-animation-controls";
import { ConnectionLineStyleFields } from "@/components/editor/connection-line-style-fields";
import { getOptimalConnectionPoints } from "@/components/diagram/bezier-connection";
import {
  appendInteriorObstaclesForPreferredEdges,
  collectObstacles,
  seedOrthogonalCustomRouteWaypoints,
} from "@/lib/orthogonal-routing";

interface ConnectionContextModalProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  connection: DiagramConnectionData;
  diagramData: DiagramData;
  onConnectionUpdate: (from: string, to: string, updates: Record<string, unknown>, connectionId?: string) => void;
  onConnectionAnimationBulkApply?: (sourceId: string, direction: 'outbound' | 'inbound', animation: DiagramConnectionData['animation']) => void;
  onConnectionDisconnect?: (from: string, to: string, connectionId?: string) => void;
  onConnectionWaypointAdd?: (from: string, to: string, connectionId?: string) => void;
  onConnectionWaypointRemove?: (from: string, to: string, index: number, connectionId?: string) => void;
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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [localConnectionText, setLocalConnectionText] = useState("");

  const connId = connection.id;
  const liveConnection = diagramData?.connections?.find((c) =>
    connId ? c.id === connId : (c.from === connection.from && c.to === connection.to)
  ) ?? connection;

  const fromNode = diagramData?.nodes.find((n) => n.id === connection.from) ||
    diagramData?.zones?.find((z) => z.id === connection.from);
  const toNode = diagramData?.nodes.find((n) => n.id === connection.to) ||
    diagramData?.zones?.find((z) => z.id === connection.to);

  const connectionColor = resolveBezierConnectionPaint(
    liveConnection,
    liveConnection.color,
    (fromNode ?? {}) as ConnectionEndpointOutline,
    (toNode ?? {}) as { lineColor?: string }
  ).cStart;
  const lineStyle = liveConnection.style ?? "bezier";
  const strokePattern = liveConnection.lineType ?? "solid";
  const smoothCorners = lineStyle === "orthogonal" && liveConnection.smoothCorners === true;
  const textPosition = liveConnection.textPosition ?? 50;
  const connectionText = liveConnection.text || "";
  const hasArrow = liveConnection.arrow === true || liveConnection.toArrow === true;

  // Sync local text when modal opens or connection changes; buffer typing until blur/Enter
  useEffect(() => {
    if (visible) setLocalConnectionText(connectionText);
  }, [visible, connId, connectionText]);

  const commitConnectionText = (valueFromDom?: string) => {
    const value = valueFromDom ?? localConnectionText;
    if (value !== connectionText) {
      onConnectionUpdate(connection.from, connection.to, { text: value }, connId);
    }
  };
  const waypoints = liveConnection.waypoints ?? [];
  const canAddWaypoint = !!onConnectionWaypointAdd && !isReadOnly;
  const canRemoveWaypoint = !!onConnectionWaypointRemove && !isReadOnly;

  const handleArrowToggle = () => {
    onConnectionUpdate(connection.from, connection.to, { arrow: !hasArrow, toArrow: !hasArrow }, connId);
  };

  const handleTextPositionChange = (value: number) => {
    onConnectionUpdate(connection.from, connection.to, { textPosition: value }, connId);
  };

  const handleLineStyleChange = (style: "bezier" | "orthogonal") => {
    if (style === "bezier" && liveConnection.orthogonalCustomRoute) {
      onConnectionUpdate(
        connection.from,
        connection.to,
        { style, orthogonalCustomRoute: false },
        connId,
      );
      return;
    }
    onConnectionUpdate(connection.from, connection.to, { style }, connId);
  };

  const customRoute = lineStyle === "orthogonal" && liveConnection.orthogonalCustomRoute === true;

  const handleCustomRouteChange = (checked: boolean) => {
    if (!checked) {
      onConnectionUpdate(
        connection.from,
        connection.to,
        {
          orthogonalCustomRoute: false,
          waypoints: undefined,
          orthogonalTrunkOffsetX: undefined,
          orthogonalTrunkOffsetY: undefined,
        },
        connId,
      );
      return;
    }

    const fromItem = fromNode as { id?: string; x?: number; y?: number; width?: number; height?: number } | undefined;
    const toItem = toNode as { id?: string; x?: number; y?: number; width?: number; height?: number } | undefined;
    if (!fromItem || !toItem) {
      onConnectionUpdate(
        connection.from,
        connection.to,
        {
          style: "orthogonal",
          orthogonalCustomRoute: true,
          orthogonalTrunkOffsetX: undefined,
          orthogonalTrunkOffsetY: undefined,
        },
        connId,
      );
      return;
    }

    const fromWidth = fromItem.width ?? 80;
    const fromHeight = fromItem.height ?? 80;
    const toWidth = toItem.width ?? 80;
    const toHeight = toItem.height ?? 80;
    const { fromX, fromY, toX, toY, fromAngle, toAngle } = getOptimalConnectionPoints(
      fromItem,
      toItem,
      fromWidth,
      fromHeight,
      toWidth,
      toHeight,
      liveConnection,
    );

    const nodesById: Record<string, { x: number; y: number; width?: number; height?: number; type?: string }> = {};
    const zonesById: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const n of diagramData.nodes ?? []) {
      nodesById[n.id] = n as { x: number; y: number; width?: number; height?: number; type?: string };
    }
    for (const z of diagramData.zones ?? []) {
      zonesById[z.id] = z as { x: number; y: number; width: number; height: number };
    }

    const baseObstacles = collectObstacles(nodesById, zonesById, [connection.from, connection.to]);
    const obstacles = appendInteriorObstaclesForPreferredEdges(
      baseObstacles,
      nodesById,
      zonesById,
      connection.from,
      connection.to,
      liveConnection.fromPreferredExit,
      liveConnection.toPreferredEntry,
    );

    const seeded = seedOrthogonalCustomRouteWaypoints(
      fromX,
      fromY,
      toX,
      toY,
      fromAngle,
      toAngle,
      obstacles,
      liveConnection.waypoints,
      liveConnection.orthogonalTrunkOffsetX,
      liveConnection.orthogonalTrunkOffsetY,
    );

    onConnectionUpdate(
      connection.from,
      connection.to,
      {
        style: "orthogonal",
        orthogonalCustomRoute: true,
        waypoints: seeded.length ? seeded : undefined,
        orthogonalTrunkOffsetX: undefined,
        orthogonalTrunkOffsetY: undefined,
      },
      connId,
    );
  };

  const handleStrokePatternChange = (lineType: "solid" | "dashed" | "dotted") => {
    onConnectionUpdate(connection.from, connection.to, { lineType }, connId);
  };

  const handleSmoothCornersChange = (checked: boolean) => {
    onConnectionUpdate(connection.from, connection.to, { smoothCorners: checked }, connId);
  };

  const centerOnEdge = liveConnection.centerEdgeAnchors === true;
  const handleCenterEdgeAnchorsChange = (checked: boolean) => {
    onConnectionUpdate(connection.from, connection.to, { centerEdgeAnchors: checked }, connId);
  };

  const edgeAttachmentConstraint = liveConnection.edgeAttachmentConstraint;
  const setEdgeConstraint = (next: "auto" | "top-bottom" | "left-right") => {
    if (next === "auto") {
      onConnectionUpdate(connection.from, connection.to, { edgeAttachmentConstraint: undefined }, connId);
    } else {
      onConnectionUpdate(connection.from, connection.to, { edgeAttachmentConstraint: next }, connId);
    }
  };

  // Initialize position from props when modal opens
  useEffect(() => {
    if (visible) {
      const modalWidth = 480;
      const modalHeight = 600;
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

  // Focus management: save and restore focus
  useEffect(() => {
    if (visible) {
      // Save the currently focused element
      previousActiveElementRef.current = document.activeElement as HTMLElement;

      // Focus the first focusable control, but not the header close button (avoids
      // Radix tooltips opening from programmatic focus before hover).
      const focusableElement = panelRef.current?.querySelector(
        'button:not([data-skip-modal-initial-focus]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      focusableElement?.focus();

      // Trap focus within the modal
      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const focusableElements = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

      document.addEventListener('keydown', handleTab);

      return () => {
        document.removeEventListener('keydown', handleTab);
        // Restore focus to the previously focused element
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
          className="fixed w-[min(480px,calc(100vw-2rem))] rounded-lg border border-border bg-popover shadow-lg p-0 z-[70]"
        >
      <div className="connection-modal-drag-handle flex items-center justify-between px-4 py-2.5 border-b cursor-move">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 className="w-4 h-4 shrink-0 text-primary" aria-hidden />
          <h3
            className="text-sm font-semibold text-foreground truncate"
            title={`${connection.from} → ${connection.to}`}
          >
            {fromLabel} → {toLabel}
          </h3>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              data-skip-modal-initial-focus
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>
      <div className="max-h-[min(78vh,640px)] overflow-y-auto">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="space-y-2.5 min-w-0">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label className="text-xs font-medium">Line type</Label>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant={lineStyle === "bezier" ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleLineStyleChange("bezier")}
                    >
                      Curved
                    </Button>
                    <Button
                      variant={lineStyle === "orthogonal" ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleLineStyleChange("orthogonal")}
                    >
                      Orthogonal
                    </Button>
                  </div>
                </div>
                <div className="shrink-0 space-y-1.5">
                  <Label className="text-xs font-medium">Arrow</Label>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant={hasArrow ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-2"
                      onClick={handleArrowToggle}
                      aria-pressed={hasArrow}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Stroke</Label>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant={strokePattern === "solid" ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleStrokePatternChange("solid")}
                  >
                    Solid
                  </Button>
                  <Button
                    variant={strokePattern === "dashed" ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleStrokePatternChange("dashed")}
                  >
                    Dashed
                  </Button>
                  <Button
                    variant={strokePattern === "dotted" ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleStrokePatternChange("dotted")}
                  >
                    Dotted
                  </Button>
                </div>
              </div>

              <ConnectionLineStyleFields
                liveConnection={liveConnection}
                resolvedConnectionColor={connectionColor}
                from={connection.from}
                to={connection.to}
                connectionId={connId}
                onConnectionUpdate={onConnectionUpdate}
                isReadOnly={isReadOnly}
              />
            </div>

            <div className="space-y-2.5 min-w-0 border-l border-border pl-3">
              {onConnectionDisconnect && !isReadOnly && (
                <div className="flex justify-end pb-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-2.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          onConnectionDisconnect(connection.from, connection.to, connId);
                          onClose();
                        }}
                        aria-label="Delete connection"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        Delete
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end">
                      Remove this connection from the diagram
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="connection-label-text" className="text-xs font-medium">
                  Text
                </Label>
                <Input
                  id="connection-label-text"
                  type="text"
                  value={localConnectionText}
                  onChange={(e) => setLocalConnectionText(e.target.value)}
                  onBlur={(e) => commitConnectionText((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitConnectionText((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Enter connection text..."
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="connection-text-position" className="text-xs font-medium">
                  Text position: {textPosition}%
                </Label>
                <div className="flex items-center gap-1.5">
                  <Slider
                    id="connection-text-position"
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
                    className="h-8 w-14 text-xs text-center shrink-0"
                    min={0}
                    max={100}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">%</span>
                </div>
              </div>

              {lineStyle === "orthogonal" && (
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Label className="text-xs font-medium">Smooth corners</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        Add a small rounded bend at each 90-degree turn
                      </p>
                    </div>
                    <Switch
                      checked={smoothCorners}
                      onCheckedChange={handleSmoothCornersChange}
                      disabled={isReadOnly}
                      className="shrink-0 mt-0.5 scale-90"
                      aria-label="Smooth orthogonal corners"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="text-xs font-medium">Center on edge</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      One attach point per side (not spread along the edge)
                    </p>
                  </div>
                  <Switch
                    checked={centerOnEdge}
                    onCheckedChange={handleCenterEdgeAnchorsChange}
                    disabled={isReadOnly}
                    className="shrink-0 mt-0.5 scale-90"
                    aria-label="Center connection anchors on edge"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="text-xs font-medium">Attach on side</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Limit which edges the line may use (default: automatic)
                    </p>
                  </div>
                  <div className="flex gap-0.5 shrink-0 mt-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={edgeAttachmentConstraint === "top-bottom" ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={isReadOnly}
                          aria-pressed={edgeAttachmentConstraint === "top-bottom"}
                          aria-label="Top and bottom edges only"
                          onClick={() =>
                            setEdgeConstraint(edgeAttachmentConstraint === "top-bottom" ? "auto" : "top-bottom")
                          }
                        >
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Top / bottom only</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={edgeAttachmentConstraint === "left-right" ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={isReadOnly}
                          aria-pressed={edgeAttachmentConstraint === "left-right"}
                          aria-label="Left and right edges only"
                          onClick={() =>
                            setEdgeConstraint(edgeAttachmentConstraint === "left-right" ? "auto" : "left-right")
                          }
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Left / right only</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {lineStyle === "orthogonal" && (
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Label className="text-xs font-medium">Custom</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        Drag any straight segment to build a fully manual route (auto routing off)
                      </p>
                    </div>
                    <Switch
                      checked={customRoute}
                      onCheckedChange={handleCustomRouteChange}
                      disabled={isReadOnly}
                      className="shrink-0 mt-0.5 scale-90"
                      aria-label="Custom orthogonal route"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <ConnectionAnimationControls
              connection={liveConnection}
              inheritedConnectionColor={connectionColor}
              onConnectionUpdate={(from, to, updates) => onConnectionUpdate(from, to, updates as Record<string, unknown>, connId)}
              onBulkApply={onConnectionAnimationBulkApply}
              isReadOnly={isReadOnly}
              compact
            />
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium">Connection points</Label>
              {canAddWaypoint && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() =>
                    onConnectionWaypointAdd?.(connection.from, connection.to, connId)
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              )}
            </div>
            {waypoints.length > 0 && (
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {waypoints.map((wp: { x: number; y: number; id?: string }, idx: number) => (
                  <div
                    key={wp.id ?? idx}
                    className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-accent/50"
                  >
                    <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono truncate">Waypoint {idx + 1}</span>
                    {canRemoveWaypoint && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                        onClick={() =>
                          onConnectionWaypointRemove?.(connection.from, connection.to, idx, connId)
                        }
                        aria-label={`Remove waypoint ${idx + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
        </div>
      </Draggable>
    </div>
  );
}
