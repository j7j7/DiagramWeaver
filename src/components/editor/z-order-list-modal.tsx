"use client";

import React, { useCallback, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { useDrag, useDrop } from "react-dnd";
import { Box, Type, Shapes, Minus, ImageIcon, X, Layers, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiagramData, DiagramNodeData } from "@/lib/types";
import { isConnectorLineNodeType, isShapeNodeType } from "@/lib/utils";
import {
  applyFrontToBackOrderToDiagramData,
  frontToBackFromBackToForward,
  getBackToForwardItemOrder,
  moveBlockToBeforeInFrontToBack,
  stackKeyForZOrder,
} from "@/lib/z-order-list-utils";

const DND_TYPE = "dw-z-order-list-row";

function rowLabel(diagramData: DiagramData, id: string): string {
  const n = diagramData.nodes.find((x) => x.id === id);
  if (n) {
    const label = (n as { label?: string }).label;
    if (label && String(label).trim()) return String(label);
    if ((n as { type?: string }).type?.startsWith("generic.icon.")) {
      return (n as { type?: string }).type?.replace("generic.icon.", "Icon: ") || id;
    }
    if ((n as { type?: string }).type?.includes("text")) {
      return "Text";
    }
    return (n as { type?: string }).type || id;
  }
  const z = diagramData.zones?.find((x) => x.id === id);
  if (z) return (z as { label?: string; name?: string }).label || (z as { name?: string }).name || "Zone";
  return id;
}

function rowKindIcon(nodeType: string | undefined) {
  if (!nodeType) return Box;
  if (isShapeNodeType(nodeType)) return Shapes;
  if (isConnectorLineNodeType(nodeType)) return Minus;
  if (nodeType.startsWith("generic.icon.") || nodeType.startsWith("generic.emoji.")) return ImageIcon;
  if (nodeType.startsWith("generic.text.")) return Type;
  return Box;
}

interface ZOrderListModalProps {
  x: number;
  y: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramData: DiagramData;
  onApply: (next: DiagramData) => void;
  getLayerDisplayName: (layerId: string) => string;
  isReadOnly?: boolean;
  /** Canvas selection (nodes/zones); list highlights match this set. */
  selectedItemIds: Set<string>;
  /** Updates canvas selection; pass IDs in front-to-back list order. */
  onSelectCanvasItems: (idsInFrontToBackOrder: string[]) => void;
}

export function ZOrderListModal({
  x,
  y,
  open,
  onOpenChange,
  diagramData,
  onApply,
  getLayerDisplayName,
  isReadOnly = false,
  selectedItemIds,
  onSelectCanvasItems,
}: ZOrderListModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [f2b, setF2b] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setF2b(frontToBackFromBackToForward(getBackToForwardItemOrder(diagramData)));
  }, [diagramData, open]);

  useEffect(() => {
    if (open) {
      const w = 380;
      const h = 480;
      const padding = 8;
      let posX = x;
      let posY = y;
      if (posX + w > window.innerWidth - padding) posX = Math.max(padding, window.innerWidth - w - padding);
      if (posY + h > window.innerHeight - padding) posY = Math.max(padding, window.innerHeight - h - padding);
      if (posX < padding) posX = padding;
      if (posY < padding) posY = padding;
      setPosition({ x: posX, y: posY });
    }
  }, [open, x, y]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const commit = useCallback(
    (nextF2b: string[]) => {
      setF2b(nextF2b);
      onApply(applyFrontToBackOrderToDiagramData(nextF2b, diagramData));
    },
    [diagramData, onApply]
  );

  const handleDropBefore = useCallback(
    (dragIds: string[], beforeIndex: number) => {
      if (isReadOnly) return;
      const next = moveBlockToBeforeInFrontToBack(f2b, dragIds, beforeIndex, diagramData);
      if (next) commit(next);
    },
    [commit, diagramData, f2b, isReadOnly]
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.shiftKey) {
        const objectIdsOnList = f2b.filter((x) => selectedItemIds.has(x));
        const n = new Set(objectIdsOnList);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        onSelectCanvasItems(f2b.filter((x) => n.has(x)));
      } else {
        onSelectCanvasItems([id]);
      }
    },
    [f2b, onSelectCanvasItems, selectedItemIds]
  );

  if (!open) return null;

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[60]">
      <div
        className="absolute inset-0 bg-background/40"
        aria-hidden
        onMouseDown={() => onOpenChange(false)}
      />
      <Draggable
        nodeRef={panelRef}
        position={position}
        onStop={(_e, data) => setPosition({ x: data.x, y: data.y })}
        handle=".z-order-modal-drag-handle"
      >
        <div
          ref={panelRef}
          className="fixed w-[min(380px,calc(100vw-2rem))] rounded-xl border border-border bg-card shadow-2xl backdrop-blur-sm z-[70] flex flex-col max-h-[min(520px,86vh)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="z-order-modal-drag-handle flex items-center justify-between gap-2 px-3 py-2.5 border-b cursor-move shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold truncate">Stacking order</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground px-3 py-1.5 border-b shrink-0">
            Top = front. Drag the grip to reorder within the same layer. Hold Shift to multi-select. Connections follow
            endpoints.
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
            {f2b.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-4 text-center">No items on the canvas.</p>
            ) : (
              <ul className="space-y-0.5" role="list">
                {f2b.map((id, index) => (
                  <ZOrderRow
                    key={id}
                    id={id}
                    index={index}
                    f2b={f2b}
                    diagramData={diagramData}
                    isReadOnly={isReadOnly}
                    selectedItemIds={selectedItemIds}
                    onRowClick={handleRowClick}
                    onDropBefore={handleDropBefore}
                    getLayerDisplayName={getLayerDisplayName}
                  />
                ))}
                <ZOrderEndDropZone f2b={f2b} isReadOnly={isReadOnly} onDropBefore={handleDropBefore} />
              </ul>
            )}
          </div>
        </div>
      </Draggable>
    </div>
  );
}

function ZOrderRow({
  id,
  index,
  f2b,
  diagramData,
  isReadOnly,
  selectedItemIds,
  onRowClick,
  onDropBefore,
  getLayerDisplayName,
}: {
  id: string;
  index: number;
  f2b: string[];
  diagramData: DiagramData;
  isReadOnly: boolean;
  selectedItemIds: Set<string>;
  onRowClick: (e: React.MouseEvent, id: string) => void;
  onDropBefore: (dragIds: string[], beforeIndex: number) => void;
  getLayerDisplayName: (layerId: string) => string;
}) {
  const node = diagramData.nodes.find((n) => n.id === id);
  const isZone = !node && diagramData.zones?.some((z) => z.id === id);
  const nodeType = (node as DiagramNodeData | undefined)?.type;
  const Icon = isZone ? Layers : rowKindIcon(nodeType);
  const layerKey = stackKeyForZOrder(id, diagramData);
  const layerName =
    layerKey === "z:zones" ? "Zone" : getLayerDisplayName(layerKey.replace(/^n:/, ""));

  const dragIds = React.useMemo(() => {
    if (selectedItemIds.size > 0 && selectedItemIds.has(id)) {
      return f2b.filter((x) => selectedItemIds.has(x));
    }
    return [id];
  }, [f2b, id, selectedItemIds]);

  const sameKey = React.useMemo(() => {
    if (dragIds.length <= 1) return true;
    const k0 = stackKeyForZOrder(dragIds[0]!, diagramData);
    return dragIds.every((d) => stackKeyForZOrder(d, diagramData) === k0);
  }, [dragIds, diagramData]);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DND_TYPE,
      item: { dragIds },
      canDrag: !isReadOnly && sameKey,
      collect: (m) => ({
        isDragging: m.isDragging(),
      }),
    }),
    [dragIds, isReadOnly, sameKey]
  );

  const [, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      drop: (item: { dragIds: string[] }) => {
        onDropBefore(item.dragIds, index);
      },
    }),
    [index, onDropBefore]
  );

  const selected = selectedItemIds.has(id);

  return (
    <li
      ref={drop as unknown as React.RefCallback<HTMLLIElement | null>}
      className={cn(
        "flex items-center gap-2 rounded-md border border-transparent bg-muted/30 px-1.5 py-1.5 text-sm",
        selected && "border-primary/40 bg-primary/5",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        className="touch-none p-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing disabled:opacity-30 disabled:cursor-not-allowed"
        ref={drag as unknown as React.RefCallback<HTMLButtonElement | null>}
        disabled={isReadOnly || !sameKey}
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={(e) => onRowClick(e, id)}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium" title={rowLabel(diagramData, id)}>
          {rowLabel(diagramData, id)}
        </span>
        <span className="ml-auto shrink-0 text-[10px] uppercase text-muted-foreground"> {layerName}</span>
      </button>
    </li>
  );
}

/** Drop to move block to end of list (back-most position in this list = bottom of f2b). */
function ZOrderEndDropZone({
  f2b,
  isReadOnly,
  onDropBefore,
}: {
  f2b: string[];
  isReadOnly: boolean;
  onDropBefore: (dragIds: string[], beforeIndex: number) => void;
}) {
  const [, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      drop: (item: { dragIds: string[] }) => {
        if (isReadOnly) return;
        onDropBefore(item.dragIds, f2b.length);
      },
    }),
    [f2b.length, isReadOnly, onDropBefore]
  );

  return (
    <li
      ref={drop as unknown as React.RefCallback<HTMLLIElement | null>}
      className="h-3 min-h-[12px] rounded-md bg-muted/20"
      aria-label="Drop to back"
    />
  );
}
