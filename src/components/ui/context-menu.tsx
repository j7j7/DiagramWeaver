"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn, isConnectorLikeSpineNodeType, isConnectorLineNodeType, isMindmapNodeType, isShapeNodeType, isTimelineNodeType } from '@/lib/utils';
import { isChartNodeType } from '@/lib/chart-node';
import { isTimelineBarNodeType } from '@/lib/timeline-bar';
import { isSegmentedRectangleNodeType } from '@/lib/segmented-rectangle';
import { isPyramidNodeType } from '@/lib/pyramid';
import { Copy, Trash2, Link, Link2Off, Move3D, Type, Palette, Network, Grid3X3, AlignLeft, AlignCenter, Layers, ChevronRight, Group, Ungroup, Plus, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Circle, RotateCw, ArrowDownAZ, ArrowUpAZ, Minus, Lock, Unlock, FileEdit, PieChart, ListOrdered, Activity, ArrowLeftRight, FlipVertical, Shapes, ClipboardPaste, AlignHorizontalSpaceAround, Pin, Combine } from 'lucide-react';
import type { ShapeBooleanOperation } from '@/lib/vector-path-types';
import { SHAPE_BOOLEAN_OPERATION_LABELS } from '@/lib/vector-path-types';
import type { PasteSpecialAspect } from '@/lib/paste-special-properties';


interface ContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onCopy: () => void;
  /** Clipboard style paste: apply only size / colour / text / properties to selected objects (no new objects). */
  pasteSpecialEnabled?: boolean;
  onPasteSpecial?: (aspect: PasteSpecialAspect) => void;
  onDelete: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onShowConnections?: () => void;
  triggerConnectionSettings?: () => void;
  connections?: Array<{from: string; to: string; id?: string}>;
  itemType?: 'node' | 'zone';
  itemId?: string;
  nodeType?: string;
  onTextStyling?: () => void;
  onVisualStyling?: () => void;
  onLineStyling?: () => void;
  onOrientationChange?: (orientation: 'auto' | 'grid' | 'horizontal' | 'vertical') => void;
  onLayoutChange?: (layout: 'grid' | 'circular') => void;
  onCycleItems?: () => void;
  onSortItems?: (order: 'alpha-asc' | 'alpha-desc') => void;
  currentOrientation?: 'auto' | 'grid' | 'horizontal' | 'vertical';
  currentLayer?: string;
  availableLayers?: Array<{id: string; name: string}>;
  onChangeLayer?: (layerId: string) => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onRemoveFromGroup?: (itemId: string) => void;
  onAddToGroup?: () => void;
  isGrouped?: boolean;
  canGroup?: boolean;
  canAddToGroup?: boolean;
  /** 3+ nodes in a row/column with uneven edge gaps */
  canUniformSpacingAlign?: boolean;
  onUniformSpacingAlign?: () => void;
  onMoveToBack?: () => void;
  onMoveToFront?: () => void;
  onMoveOneBack?: () => void;
  onMoveOneForward?: () => void;
  canMoveToBack?: boolean;
  canMoveToFront?: boolean;
  canMoveOneBack?: boolean;
  canMoveOneForward?: boolean;
  /** Open the full stacking (z) order list panel */
  onOpenZOrderList?: () => void;
  onToggleLock?: () => void;
  isLocked?: boolean;
  onEditUmlClass?: () => void;
  onEditChartData?: () => void;
  onEditTimelineBarSections?: () => void;
  onEditPyramidSections?: () => void;
  onSimulation?: () => void;
  hasSubDiagramLink?: boolean;
  onCreateSubDiagram?: (nodeId: string) => void;
  onRemoveSubDiagramLink?: (nodeId: string) => void;
  /** When true with `onAutoNumberLabels`, show multi-select label numbering. */
  canAutoNumber?: boolean;
  onAutoNumberLabels?: () => void;
  /** Polyline / connector line node: curved path vs straight segment */
  connectorLineCurved?: boolean;
  onToggleConnectorLineCurved?: () => void;
  /** Insert a point at the midpoint of the longest segment (straight or curved) */
  onAddConnectorLinePoint?: () => void;
  /** Straight polyline with ≥1 interior point: show “Smooth joints” checkbox */
  connectorLineShowSmoothJointsOption?: boolean;
  connectorLineSmoothJoints?: boolean;
  onToggleConnectorLineSmoothJoints?: () => void;
  /** Connector line with start ≈ end: allow Visual Styling (fill / gradient). */
  connectorLineClosed?: boolean;
  /** Timeline node: append a card row (preserves even vs manual distribution). */
  onTimelineAddCard?: () => void;
  /** Timeline node: remove the actively selected card if allowed. */
  onTimelineRemoveCard?: () => void;
  timelineCanRemoveCard?: boolean;
  /** Timeline node: `theme-hues` vs solid fills per card. */
  timelineSequentialHues?: boolean;
  onTimelineToggleSequentialHues?: () => void;
  /** Timeline: alternate cards above/below spine vs same side (`above`). */
  timelineAlternateSides?: boolean;
  onTimelineToggleAlternateSides?: () => void;
  /** Timeline: anchor cards from spine start through end with even spacing (`manual` + `t`). */
  onTimelineSpaceEndpoints?: () => void;
  /** Mind map: add a child node and rebalance radial layout around the parent (existing siblings move). */
  onMindmapAddChild?: () => void;
  /** Mind map: add a child at the default offset without moving existing sibling nodes (polar fields synced for the new node only). */
  onMindmapAddChildPreserveSiblingPositions?: () => void;
  /** Mind map: remove tree link to parent (keeps subtree). */
  onMindmapDetachFromParent?: () => void;
  mindmapCanDetach?: boolean;
  onMindmapResetRadialLayout?: () => void;
  mindmapCanResetRadial?: boolean;
  mindmapThemeHues?: boolean;
  onMindmapToggleThemeHues?: () => void;
  /** Two mind-map nodes selected; menu node is tree parent of the other. */
  onMindmapConnectPairTree?: () => void;
  onMindmapConnectPairLink?: () => void;
  mindmapPairConnectVisible?: boolean;
  /** Closed `*.object.*` palette shapes — swap rendered kind while preserving node id and connections. */
  shapeChangeOptions?: Array<{ kind: string; label: string }>;
  onChangeDiagramObjectShapeKind?: (kind: string) => void;
  /** Card template swap submenu (`generic.card.*`). */
  cardTemplateChangeOptions?: Array<{ templateId: string; label: string }>;
  onChangeCardTemplate?: (templateId: string) => void;
  /** Card icon-slot: menu opened from an assigned icon inside a card */
  cardIconContext?: boolean;
  onRemoveCardIcon?: () => void;
  /** 2+ closed shapes selected — boolean combine submenu */
  canBooleanCombine?: boolean;
  onBooleanCombine?: (operation: "union" | "subtract" | "intersect" | "exclude") => void;
}

// Connector-only lines hide root label/text tooling; timeline keeps Text actions like shapes.
const isConnectorPolylineOnlyNodeType = (nodeType?: string): boolean => isConnectorLineNodeType(nodeType);

/** Spine shared by connector lines + timeline — curved segment / interior points / smooth joints */
const isSpineGeometryMenuNodeType = (nodeType?: string): boolean =>
  isConnectorLikeSpineNodeType(nodeType);

const isUmlClassNodeType = (nodeType?: string): boolean => {
  return nodeType === 'generic.object.uml-class' || (nodeType?.endsWith('.uml-class') ?? false);
};


export function ContextMenu({ 
  x, 
  y, 
  visible, 
  onClose, 
  onCopy,
  pasteSpecialEnabled = false,
  onPasteSpecial,
  onDelete, 
  onConnect, 
  onDisconnect,
  onShowConnections,
  triggerConnectionSettings,
  connections = [],
  itemType = 'node',
  nodeType,
  onTextStyling,
  onVisualStyling,
  onLineStyling,
  onOrientationChange,
  currentOrientation = 'auto',
  currentLayer,
  availableLayers = [],
  onChangeLayer,
  onGroup,
  onUngroup,
  onRemoveFromGroup,
  onAddToGroup,
  isGrouped = false,
  canGroup = false,
  canAddToGroup = false,
  canUniformSpacingAlign = false,
  onUniformSpacingAlign,
  itemId,
  onMoveToBack,
  onMoveToFront,
  onMoveOneBack,
  onMoveOneForward,
  canMoveToBack = false,
  canMoveToFront = false,
  canMoveOneBack = false,
  canMoveOneForward = false,
  onOpenZOrderList,
  onLayoutChange,
  onCycleItems,
  onSortItems,
  onToggleLock,
  isLocked = false,
  onEditUmlClass,
  onEditChartData,
  onEditTimelineBarSections,
  onEditPyramidSections,
  onSimulation,
  hasSubDiagramLink = false,
  onCreateSubDiagram,
  onRemoveSubDiagramLink,
  canAutoNumber = false,
  onAutoNumberLabels,
  connectorLineCurved = false,
  onToggleConnectorLineCurved,
  onAddConnectorLinePoint,
  connectorLineShowSmoothJointsOption = false,
  connectorLineSmoothJoints = false,
  onToggleConnectorLineSmoothJoints,
  connectorLineClosed = false,
  onTimelineAddCard,
  onTimelineRemoveCard,
  timelineCanRemoveCard = false,
  timelineSequentialHues = false,
  onTimelineToggleSequentialHues,
  timelineAlternateSides = false,
  onTimelineToggleAlternateSides,
  onTimelineSpaceEndpoints,
  onMindmapAddChild,
  onMindmapAddChildPreserveSiblingPositions,
  onMindmapDetachFromParent,
  mindmapCanDetach = false,
  onMindmapResetRadialLayout,
  mindmapCanResetRadial = false,
  mindmapThemeHues = false,
  onMindmapToggleThemeHues,
  onMindmapConnectPairTree,
  onMindmapConnectPairLink,
  mindmapPairConnectVisible = false,
  shapeChangeOptions = [],
  onChangeDiagramObjectShapeKind,
  cardTemplateChangeOptions = [],
  onChangeCardTemplate,
  cardIconContext = false,
  onRemoveCardIcon,
  canBooleanCombine = false,
  onBooleanCombine,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [layerSubmenuOpen, setLayerSubmenuOpen] = useState(false);
  const [renderOrderSubmenuOpen, setRenderOrderSubmenuOpen] = useState(false);
  const [layoutOrderSubmenuOpen, setLayoutOrderSubmenuOpen] = useState(false);
  const [shapeSubmenuOpen, setShapeSubmenuOpen] = useState(false);
  const [booleanSubmenuOpen, setBooleanSubmenuOpen] = useState(false);
  const [cardTemplateSubmenuOpen, setCardTemplateSubmenuOpen] = useState(false);
  const [pasteSpecialSubmenuOpen, setPasteSpecialSubmenuOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setLayerSubmenuOpen(false);
      setRenderOrderSubmenuOpen(false);
      setLayoutOrderSubmenuOpen(false);
      setShapeSubmenuOpen(false);
      setBooleanSubmenuOpen(false);
      setCardTemplateSubmenuOpen(false);
      setPasteSpecialSubmenuOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleCanvasClick = (event: MouseEvent) => {
      // Close context menu on any canvas click when menu is visible
      if (visible && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        // Check if click is on canvas area (not on other UI elements)
        if (target.closest('#canvas-container') || target.closest('[data-canvas]')) {
          onClose();
        }
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('click', handleCanvasClick, true); // Use capture to ensure it fires
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleCanvasClick, true);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        "context-menu fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
        "animate-in fade-in-0 zoom-in-95",
        "[&_svg:not([class*='text-destructive'])]:text-primary [&_svg]:shrink-0"
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
        onClick={() => {
          onCopy();
          onClose();
        }}
      >
        <Copy className="w-4 h-4" />
        Copy
      </button>

      {pasteSpecialEnabled && onPasteSpecial && (
        <div className="relative">
          <button
            type="button"
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onMouseEnter={() => setPasteSpecialSubmenuOpen(true)}
            onMouseLeave={() => setPasteSpecialSubmenuOpen(false)}
          >
            <ClipboardPaste className="w-4 h-4 shrink-0" />
            Paste special
            <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
          </button>
          {pasteSpecialSubmenuOpen && (
            <div
              className={cn(
                "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50",
                "animate-in fade-in-0 zoom-in-95 min-w-[160px]",
              )}
              style={{ marginLeft: "0px" }}
              onMouseEnter={() => setPasteSpecialSubmenuOpen(true)}
              onMouseLeave={() => setPasteSpecialSubmenuOpen(false)}
            >
              {(
                [
                  ["size", "Size"],
                  ["colour", "Colour"],
                  ["text", "Text"],
                  ["description", "Description"],
                  ["properties", "Properties"],
                ] as const
              ).map(([aspect, label]) => (
                <button
                  key={aspect}
                  type="button"
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onPasteSpecial(aspect);
                    setPasteSpecialSubmenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {onEditUmlClass && isUmlClassNodeType(nodeType) && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onEditUmlClass();
            onClose();
          }}
        >
          <FileEdit className="w-4 h-4" />
          Edit UML Class
        </button>
      )}

      {onEditChartData && isChartNodeType(nodeType) && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onEditChartData();
            onClose();
          }}
        >
          <PieChart className="w-4 h-4" />
          Chart data
        </button>
      )}

      {onEditTimelineBarSections && (isTimelineBarNodeType(nodeType) || isSegmentedRectangleNodeType(nodeType)) && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onEditTimelineBarSections();
            onClose();
          }}
        >
          <AlignHorizontalSpaceAround className="w-4 h-4" />
          {isSegmentedRectangleNodeType(nodeType) ? "Segmented rectangle sections" : "Timeline bar sections"}
        </button>
      )}

      {onEditPyramidSections && isPyramidNodeType(nodeType) && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onEditPyramidSections();
            onClose();
          }}
        >
          <AlignHorizontalSpaceAround className="w-4 h-4" />
          Pyramid tiers
        </button>
      )}

      {onSimulation && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onSimulation();
          }}
        >
          <Activity className="w-4 h-4" />
          Simulation
        </button>
      )}

      {onCreateSubDiagram && !hasSubDiagramLink && itemType === 'node' && itemId && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onCreateSubDiagram(itemId);
            onClose();
          }}
        >
          <Link className="w-4 h-4" />
          Create sub-diagram
        </button>
      )}

      {onRemoveSubDiagramLink && hasSubDiagramLink && itemType === 'node' && itemId && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onRemoveSubDiagramLink(itemId);
            onClose();
          }}
        >
          <Link2Off className="w-4 h-4" />
          Remove sub-diagram link
        </button>
      )}

      {onTextStyling && !isConnectorPolylineOnlyNodeType(nodeType) && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onTextStyling();
            onClose();
          }}
        >
          <Type className="w-4 h-4" />
          Text Styling
        </button>
      )}

      {onAutoNumberLabels && canAutoNumber && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onAutoNumberLabels();
          }}
        >
          <ListOrdered className="w-4 h-4" />
          Auto-number
        </button>
      )}

      {onVisualStyling && (() => {
        const t = nodeType || '';
        const isEmoji = t.startsWith('generic.emoji.');
        const isShape = isShapeNodeType(t);
        const isTextbox = t === 'generic.text.textbox';
        const isLucide = t.startsWith('generic.icon.');
        const isText = t.startsWith('generic.text.');
        const isResourceItem = !isShape && !isText && !isConnectorPolylineOnlyNodeType(t);
        const closedLineFill = isConnectorPolylineOnlyNodeType(t) && connectorLineClosed;
        const isCard = t.startsWith('generic.card.');
        return cardIconContext || isCard || isShape || isTextbox || isLucide || isResourceItem || isEmoji || closedLineFill;
      })() && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onVisualStyling();
            onClose();
          }}
        >
          <Palette className="w-4 h-4" />
          {cardIconContext ? 'Icon styling' : 'Visual Styling'}
        </button>
      )}

      {cardIconContext && onRemoveCardIcon && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-destructive"
          onClick={() => {
            onRemoveCardIcon();
            onClose();
          }}
        >
          <Trash2 className="w-4 h-4" />
          Remove icon
        </button>
      )}

      {itemType === 'node' &&
        shapeChangeOptions.length > 0 &&
        onChangeDiagramObjectShapeKind && (
          <div className="relative">
            <button
              type="button"
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onMouseEnter={() => setShapeSubmenuOpen(true)}
              onMouseLeave={() => setShapeSubmenuOpen(false)}
            >
              <Shapes className="w-4 h-4 shrink-0" />
              Change shape
              <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
            </button>
            {shapeSubmenuOpen && (
              <div
                className={cn(
                  "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 max-h-[min(360px,calc(100vh-96px))] overflow-y-auto",
                  "animate-in fade-in-0 zoom-in-95 min-w-[180px]",
                )}
                style={{ marginLeft: "0px" }}
                onMouseEnter={() => setShapeSubmenuOpen(true)}
                onMouseLeave={() => setShapeSubmenuOpen(false)}
              >
                {shapeChangeOptions.map((opt) => (
                  <button
                    key={opt.kind}
                    type="button"
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onChangeDiagramObjectShapeKind(opt.kind);
                      setShapeSubmenuOpen(false);
                      onClose();
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      {itemType === 'node' &&
        cardTemplateChangeOptions.length > 0 &&
        onChangeCardTemplate && (
          <div className="relative">
            <button
              type="button"
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onMouseEnter={() => setCardTemplateSubmenuOpen(true)}
              onMouseLeave={() => setCardTemplateSubmenuOpen(false)}
            >
              <Shapes className="w-4 h-4 shrink-0" />
              Change card template
              <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
            </button>
            {cardTemplateSubmenuOpen && (
              <div
                className={cn(
                  "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 max-h-[min(360px,calc(100vh-96px))] overflow-y-auto",
                  "animate-in fade-in-0 zoom-in-95 min-w-[180px]",
                )}
                style={{ marginLeft: "0px" }}
                onMouseEnter={() => setCardTemplateSubmenuOpen(true)}
                onMouseLeave={() => setCardTemplateSubmenuOpen(false)}
              >
                {cardTemplateChangeOptions.map((opt) => (
                  <button
                    key={opt.templateId}
                    type="button"
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onChangeCardTemplate(opt.templateId);
                      setCardTemplateSubmenuOpen(false);
                      onClose();
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      {itemType === 'node' && canBooleanCombine && onBooleanCombine && (
          <div className="relative">
            <button
              type="button"
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onMouseEnter={() => setBooleanSubmenuOpen(true)}
              onMouseLeave={() => setBooleanSubmenuOpen(false)}
            >
              <Combine className="w-4 h-4 shrink-0" />
              Combine shapes
              <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
            </button>
            {booleanSubmenuOpen && (
              <div
                className={cn(
                  "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[200px]",
                  "animate-in fade-in-0 zoom-in-95",
                )}
                style={{ marginLeft: "0px" }}
                onMouseEnter={() => setBooleanSubmenuOpen(true)}
                onMouseLeave={() => setBooleanSubmenuOpen(false)}
              >
                {(Object.keys(SHAPE_BOOLEAN_OPERATION_LABELS) as ShapeBooleanOperation[]).map((op) => (
                  <button
                    key={op}
                    type="button"
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onBooleanCombine(op);
                      setBooleanSubmenuOpen(false);
                      onClose();
                    }}
                  >
                    {SHAPE_BOOLEAN_OPERATION_LABELS[op]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      {onLineStyling && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onLineStyling();
            onClose();
          }}
        >
          <Minus className="w-4 h-4" />
          Line Styling
        </button>
      )}

      {isSpineGeometryMenuNodeType(nodeType) && onToggleConnectorLineCurved && (
        <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={connectorLineCurved}
            onChange={() => {
              onToggleConnectorLineCurved();
            }}
          />
          Curved line
        </label>
      )}

      {isSpineGeometryMenuNodeType(nodeType) && onAddConnectorLinePoint && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onAddConnectorLinePoint();
            onClose();
          }}
        >
          <Plus className="w-4 h-4" />
          Add point
        </button>
      )}

      {isSpineGeometryMenuNodeType(nodeType) &&
        connectorLineShowSmoothJointsOption &&
        onToggleConnectorLineSmoothJoints && (
        <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={connectorLineSmoothJoints}
            onChange={() => {
              onToggleConnectorLineSmoothJoints();
            }}
          />
          Smooth joints
        </label>
      )}

      {isTimelineNodeType(nodeType) && onTimelineAddCard && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onTimelineAddCard();
            onClose();
          }}
        >
          <Plus className="w-4 h-4" />
          Add timeline card
        </button>
      )}

      {isTimelineNodeType(nodeType) && onTimelineSpaceEndpoints && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onTimelineSpaceEndpoints();
            onClose();
          }}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Space cards start → end
        </button>
      )}

      {isTimelineNodeType(nodeType) && onTimelineRemoveCard && (
        <button
          type="button"
          disabled={!timelineCanRemoveCard}
          className={cn(
            "w-full px-3 py-2 text-sm text-left flex items-center gap-2",
            timelineCanRemoveCard
              ? "hover:bg-accent hover:text-accent-foreground"
              : "opacity-40 cursor-not-allowed",
          )}
          onClick={() => {
            if (!timelineCanRemoveCard) return;
            onTimelineRemoveCard();
            onClose();
          }}
        >
          <Trash2 className="w-4 h-4" />
          Delete card
        </button>
      )}

      {isTimelineNodeType(nodeType) && onTimelineToggleSequentialHues && (
        <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={timelineSequentialHues}
            onChange={() => {
              onTimelineToggleSequentialHues();
            }}
          />
          <Activity className="w-4 h-4 shrink-0" />
          Sequential card hues
        </label>
      )}

      {isTimelineNodeType(nodeType) && onTimelineToggleAlternateSides && (
        <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={timelineAlternateSides}
            onChange={() => {
              onTimelineToggleAlternateSides();
            }}
          />
          <FlipVertical className="w-4 h-4 shrink-0" />
          Alternate cards above/below
        </label>
      )}

      {mindmapPairConnectVisible && onMindmapConnectPairTree && onMindmapConnectPairLink && (
        <>
          <button
            type="button"
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onMindmapConnectPairTree();
              onClose();
            }}
          >
            <Network className="w-4 h-4" />
            Mind map: tree (this → other)
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onMindmapConnectPairLink();
              onClose();
            }}
          >
            <Link className="w-4 h-4" />
            Mind map: link only
          </button>
        </>
      )}

      {isMindmapNodeType(nodeType) && onMindmapAddChild && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onMindmapAddChild();
            onClose();
          }}
        >
          <Plus className="w-4 h-4" />
          Add mind map node
        </button>
      )}

      {isMindmapNodeType(nodeType) && onMindmapAddChildPreserveSiblingPositions && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onMindmapAddChildPreserveSiblingPositions();
            onClose();
          }}
        >
          <Pin className="w-4 h-4" />
          Add mind map node without moving others
        </button>
      )}

      {isMindmapNodeType(nodeType) && mindmapCanResetRadial && onMindmapResetRadialLayout && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onMindmapResetRadialLayout();
            onClose();
          }}
        >
          <RotateCw className="w-4 h-4" />
          Reset radial layout
        </button>
      )}

      {isMindmapNodeType(nodeType) && mindmapCanDetach && onMindmapDetachFromParent && (
        <button
          type="button"
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onMindmapDetachFromParent();
            onClose();
          }}
        >
          <Link2Off className="w-4 h-4" />
          Detach from parent
        </button>
      )}

      {isMindmapNodeType(nodeType) && onMindmapToggleThemeHues && (
        <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={mindmapThemeHues}
            onChange={() => {
              onMindmapToggleThemeHues();
            }}
          />
          <Activity className="w-4 h-4 shrink-0" />
          Branch theme hues
        </label>
      )}

      {/* Render Order Submenu */}
      {(canMoveToBack || canMoveToFront || canMoveOneBack || canMoveOneForward || onOpenZOrderList) && (
        <div className="relative">
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onMouseEnter={() => setRenderOrderSubmenuOpen(true)}
            onMouseLeave={() => setRenderOrderSubmenuOpen(false)}
          >
            <ArrowUp className="w-4 h-4" />
            Render Order
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
          
          {renderOrderSubmenuOpen && (
            <div
              className={cn(
                "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
                "animate-in fade-in-0 zoom-in-95"
              )}
              style={{ marginLeft: '0px' }}
              onMouseEnter={() => setRenderOrderSubmenuOpen(true)}
              onMouseLeave={() => setRenderOrderSubmenuOpen(false)}
            >
              {onOpenZOrderList && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onOpenZOrderList();
                    setRenderOrderSubmenuOpen(false);
                  }}
                >
                  <Layers className="w-4 h-4" />
                  Stacking order list…
                </button>
              )}
              {onOpenZOrderList && (onMoveToFront || onMoveToBack) && <div className="border-t border-border my-1" />}
              {onMoveToFront && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveToFront();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveToFront}
                >
                  <ChevronUp className="w-4 h-4" />
                  Move to Front
                </button>
              )}

              {onMoveOneForward && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveOneForward();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveOneForward}
                >
                  <ArrowUp className="w-4 h-4" />
                  Move One Forward
                </button>
              )}

              {onMoveOneBack && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveOneBack();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveOneBack}
                >
                  <ArrowDown className="w-4 h-4" />
                  Move One Back
                </button>
              )}

              {onMoveToBack && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveToBack();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveToBack}
                >
                  <ChevronDown className="w-4 h-4" />
                  Move to Back
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {itemType === 'zone' && onOrientationChange && (
        <>
          <div className="border-t border-border my-1" />
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Orientation</div>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('auto');
              onClose();
            }}
          >
            <AlignCenter className="w-4 h-4" />
            Auto
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('grid');
              onClose();
            }}
          >
            <Grid3X3 className="w-4 h-4" />
            Grid
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('horizontal');
              onClose();
            }}
          >
            <AlignLeft className="w-4 h-4" />
            Horizontal
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('vertical');
              onClose();
            }}
          >
            <Move3D className="w-4 h-4" />
            Vertical
          </button>
        </>
      )}

      {/* Layout & Order Submenu */}
      {itemType === 'zone' && (onLayoutChange || onCycleItems || onSortItems) && (
        <div className="relative">
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onMouseEnter={() => setLayoutOrderSubmenuOpen(true)}
            onMouseLeave={() => setLayoutOrderSubmenuOpen(false)}
          >
            <Grid3X3 className="w-4 h-4" />
            Layout & Order
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>

          {layoutOrderSubmenuOpen && (
            <div
              className={cn(
                "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
                "animate-in fade-in-0 zoom-in-95"
              )}
              style={{ marginLeft: '4px' }}
              onMouseEnter={() => setLayoutOrderSubmenuOpen(true)}
              onMouseLeave={() => setLayoutOrderSubmenuOpen(false)}
            >
              {onLayoutChange && (
                <>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onLayoutChange('grid');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    Grid Layout
                  </button>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onLayoutChange('circular');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <Circle className="w-4 h-4" />
                    Circular Layout
                  </button>
                  {(onCycleItems || onSortItems) && <div className="border-t border-border my-1" />}
                </>
              )}

              {onCycleItems && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onCycleItems();
                    onClose();
                    setLayoutOrderSubmenuOpen(false);
                  }}
                >
                  <RotateCw className="w-4 h-4" />
                  Cycle Items
                </button>
              )}

              {onSortItems && (
                <>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onSortItems('alpha-asc');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <ArrowDownAZ className="w-4 h-4" />
                    Sort A-Z
                  </button>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onSortItems('alpha-desc');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <ArrowUpAZ className="w-4 h-4" />
                    Sort Z-A
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(itemType === 'node' || itemType === 'zone') &&
        !isConnectorPolylineOnlyNodeType(nodeType) &&
        !isTimelineNodeType(nodeType) && (
        <>
          <div className="border-t border-border my-1" />
          
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onConnect();
              onClose();
            }}
          >
            <Link className="w-4 h-4" />
            Connect
          </button>

          {triggerConnectionSettings && connections.length > 0 && (
            <button
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onClick={() => {
                triggerConnectionSettings();
                onClose();
              }}
            >
              <Network className="w-4 h-4" />
              Connections ({connections.length})
            </button>
          )}
          
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onDisconnect();
              onClose();
            }}
          >
            <Link2Off className="w-4 h-4" />
            Disconnect
          </button>
        </>
      )}

      {/* Layer Submenu */}
      {availableLayers.length > 0 && (
        <>
          <div className="border-t border-border my-1" />
          <div className="relative">
            <button
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onMouseEnter={() => setLayerSubmenuOpen(true)}
              onMouseLeave={() => setLayerSubmenuOpen(false)}
            >
              <Layers className="w-4 h-4" />
              Layer: {currentLayer}
              <ChevronRight className="w-4 h-4 ml-auto" />
            </button>
            
            {/* Layer Submenu */}
            {layerSubmenuOpen && (
              <div
                className={cn(
                  "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
                  "animate-in fade-in-0 zoom-in-95"
                )}
                style={{ marginLeft: '0px' }}
                onMouseEnter={() => setLayerSubmenuOpen(true)}
                onMouseLeave={() => setLayerSubmenuOpen(false)}
              >
                {availableLayers.map((layer) => (
                  <button
                    key={layer.id}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onChangeLayer?.(layer.id);
                      onClose();
                      setLayerSubmenuOpen(false);
                    }}
                  >
                    <Layers className="w-4 h-4" />
                    {layer.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="border-t border-border my-1" />
      
      {canGroup && onGroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onGroup();
            onClose();
          }}
        >
          <Group className="w-4 h-4" />
          Group Items
        </button>
      )}

      {canAddToGroup && onAddToGroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onAddToGroup();
            onClose();
          }}
        >
          <Plus className="w-4 h-4" />
          Add to Group
        </button>
      )}

      {isGrouped && onUngroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onUngroup();
            onClose();
          }}
        >
          <Ungroup className="w-4 h-4" />
          Ungroup
        </button>
      )}

      {isGrouped && onRemoveFromGroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            if (itemId && onRemoveFromGroup) {
              onRemoveFromGroup(itemId);
            }
            onClose();
          }}
        >
          <Link2Off className="w-4 h-4" />
          Remove from Group
        </button>
      )}

      {canUniformSpacingAlign && onUniformSpacingAlign && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onUniformSpacingAlign();
            onClose();
          }}
        >
          <AlignHorizontalSpaceAround className="w-4 h-4" />
          Alignment
        </button>
      )}



      {(canGroup || isGrouped || canUniformSpacingAlign) && <div className="border-t border-border my-1" />}
      
      {onToggleLock && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onToggleLock();
            onClose();
          }}
        >
          {isLocked ? (
            <>
              <Unlock className="w-4 h-4" />
              Unlock
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Lock
            </>
          )}
        </button>
      )}

      {onToggleLock && <div className="border-t border-border my-1" />}
      
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
        {itemType === "zone" ? "Delete zone" : "Delete node"}
      </button>
    </div>
  );
}