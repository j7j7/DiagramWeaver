import React from "react";
import { BezierConnectionText } from "../diagram/bezier-connection";
import { determineConnectionEdges } from "../diagram/bezier-connection";
import type { DiagramConnectionData, DiagramData } from "@/lib/types";
import { stableDiagramConnectionId } from "@/lib/connection-order-utils";
import { measureNodeDims, type PositionedNode, type PositionedGroup } from "./canvas-constants";

export interface CanvasConnectionTextProps {
  width: number;
  height: number;
  diagramData: DiagramData;
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  processedZones: PositionedGroup[];
  /** When set, only render text for connections whose index is in this set (order-aware layering). */
  connectionIndices?: Set<number>;
  /** Z-index for this label layer (above its connection lines, per stacking slot). */
  stackZIndex?: number;
  /** Slide / layer transition styles (same keys as CanvasConnections) */
  connectionAnimationStyles?: Map<string, {
    opacity: number;
    transition: string;
    slideEndpointOffset?: { fromDx: number; fromDy: number; toDx: number; toDy: number };
    slideWaypointOffsets?: Array<{ dx: number; dy: number }>;
  }>;
  connectionKey?: (conn: DiagramConnectionData) => string;
  connectionTextEditKey?: string | null;
  connectionTextEditDraft?: string;
  onConnectionTextEditDraftChange?: (value: string) => void;
  onConnectionTextEditStart?: (connection: DiagramConnectionData, connectionIndex: number, e: React.MouseEvent) => void;
  onConnectionTextEditCommit?: () => void;
  onConnectionTextEditCancel?: () => void;
  connectionTextEditDisabled?: boolean;
}

function areCanvasConnectionTextPropsEqual(prev: CanvasConnectionTextProps, next: CanvasConnectionTextProps): boolean {
  return prev.width === next.width &&
    prev.height === next.height &&
    prev.diagramData === next.diagramData &&
    prev.nodesById === next.nodesById &&
    prev.zonesById === next.zonesById &&
    prev.processedZones === next.processedZones &&
    prev.connectionIndices === next.connectionIndices &&
    prev.stackZIndex === next.stackZIndex &&
    prev.connectionAnimationStyles === next.connectionAnimationStyles &&
    prev.connectionKey === next.connectionKey &&
    prev.connectionTextEditKey === next.connectionTextEditKey &&
    prev.connectionTextEditDraft === next.connectionTextEditDraft &&
    prev.onConnectionTextEditDraftChange === next.onConnectionTextEditDraftChange &&
    prev.onConnectionTextEditStart === next.onConnectionTextEditStart &&
    prev.onConnectionTextEditCommit === next.onConnectionTextEditCommit &&
    prev.onConnectionTextEditCancel === next.onConnectionTextEditCancel &&
    prev.connectionTextEditDisabled === next.connectionTextEditDisabled;
}

function CanvasConnectionTextInner(props: CanvasConnectionTextProps) {
  const {
    width,
    height,
    diagramData,
    nodesById,
    zonesById,
    connectionIndices,
    stackZIndex,
    connectionAnimationStyles,
    connectionKey,
    connectionTextEditKey,
    connectionTextEditDraft = "",
    onConnectionTextEditDraftChange,
    onConnectionTextEditStart,
    onConnectionTextEditCommit,
    onConnectionTextEditCancel,
    connectionTextEditDisabled = false,
  } = props;

  const connections = diagramData.connections || [];
  const entries = connections
    .map((edge, index) => ({ edge, index }))
    .filter(({ index }) => !connectionIndices || connectionIndices.has(index));

  if (entries.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: stackZIndex ?? 1 }}
    >
      {entries.map(({ edge, index }) => {
        const fromItem = nodesById[edge.from] || zonesById[edge.from];
        const toItem = nodesById[edge.to] || zonesById[edge.to];
        if (!fromItem || !toItem || !edge.text) return null;
        // Orthogonal connections render text inline; skip here
        if (edge.style === "orthogonal") return null;

        const fromItemDims = "type" in fromItem
          ? measureNodeDims(fromItem as PositionedNode)
          : { width: (fromItem as PositionedGroup).width, height: (fromItem as PositionedGroup).height };
        const toItemDims = "type" in toItem
          ? measureNodeDims(toItem as PositionedNode)
          : { width: (toItem as PositionedGroup).width, height: (toItem as PositionedGroup).height };

        const fromPos: any = {
          ...fromItem,
          width: "width" in fromItem ? (fromItem as PositionedNode).width : fromItemDims.width,
          height: "height" in fromItem ? (fromItem as PositionedNode).height : fromItemDims.height,
        };
        const toPos: any = {
          ...toItem,
          width: "width" in toItem ? (toItem as PositionedNode).width : toItemDims.width,
          height: "height" in toItem ? (toItem as PositionedNode).height : toItemDims.height,
        };

        fromPos.lineColor = (fromItem as PositionedNode).lineColor;
        toPos.lineColor = (toItem as PositionedNode).lineColor;

        const stableConnKey = connectionKey ? connectionKey(edge) : null;
        const slideConnStyle = stableConnKey && connectionAnimationStyles
          ? connectionAnimationStyles.get(stableConnKey)
          : undefined;
        const slideOff = slideConnStyle?.slideEndpointOffset;
        const slideWpOff = slideConnStyle?.slideWaypointOffsets;

        const geomFrom = slideOff
          ? { ...fromPos, x: (fromPos.x ?? 0) + slideOff.fromDx, y: (fromPos.y ?? 0) + slideOff.fromDy }
          : fromPos;
        const geomTo = slideOff
          ? { ...toPos, x: (toPos.x ?? 0) + slideOff.toDx, y: (toPos.y ?? 0) + slideOff.toDy }
          : toPos;

        const edges = determineConnectionEdges(
          geomFrom,
          geomTo,
          edge,
          fromItemDims.width,
          fromItemDims.height,
          toItemDims.width,
          toItemDims.height,
        );

        let edgeConnData: any = {
          ...edge,
          fromPreferredExit: edges.fromEdge,
          toPreferredEntry: edges.toEdge,
        };
        if (slideWpOff && edgeConnData.waypoints?.length) {
          edgeConnData = {
            ...edgeConnData,
            waypoints: edgeConnData.waypoints.map((w: { x: number; y: number }, i: number) => ({
              ...w,
              x: w.x + (slideWpOff[i]?.dx ?? 0),
              y: w.y + (slideWpOff[i]?.dy ?? 0),
            })),
          };
        }

        return (
          <BezierConnectionText
            key={`connection-text-${edge.from}-${edge.to}-${index}`}
            connectionData={edgeConnData}
            from={geomFrom}
            to={geomTo}
            connectionColor={edge.color}
            isTextEditing={connectionTextEditKey === stableDiagramConnectionId(edge, index)}
            textEditDraft={connectionTextEditDraft}
            onTextEditDraftChange={onConnectionTextEditDraftChange}
            onTextEditStart={(e) => onConnectionTextEditStart?.(edge, index, e)}
            onTextEditCommit={onConnectionTextEditCommit}
            onTextEditCancel={onConnectionTextEditCancel}
            textEditDisabled={connectionTextEditDisabled}
          />
        );
      })}
    </svg>
  );
}

export const CanvasConnectionText = React.memo(CanvasConnectionTextInner, areCanvasConnectionTextPropsEqual);
