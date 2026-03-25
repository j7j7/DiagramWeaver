"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResourceIcon } from "./resource-icon";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { labelToRuns } from "@/lib/rich-text";
import { TextboxRichEditor } from "./textbox-rich-editor";
import { TextboxRichDisplay } from "./textbox-rich-display";
import { cn, isIconOrEmojiType } from "@/lib/utils";
import { ItemTypes } from "../editor/draggable-item";
import { snapToGrid, snapDimensionToGrid, measureNodeDims } from "@/components/editor/canvas-constants";
import { getTextStylingCSS, extractTextStylingFromNode } from "@/lib/text-styling";
import { getNodeSizeDimensions } from "@/lib/visual-styling";
import {
  SquareShape,
  RectangleShape,
  RoundedRectangleShape,
  CircleShape,
  PointShape,
  KiteShape,
  TriangleShape,
  StarShape,
  HexagonShape,
  PentagonShape,
  OctagonShape,
  CloudShape,
  ParallelogramShape,
  TrapezoidShape,
  JigsawShape,
  ArrowheadShape,
  ChevronShape,
  LineShape,
  LoopShape,
  UmlClassShape,
} from "./shapes";
import {
  SlideShapeShadowTransitionProvider,
  getSlideShapeShadowMode,
} from "@/components/diagram/slide-shape-shadow-transition-context";
import { ResizeHandles } from "./resize-handles";
import { LineEndpointHandles } from "./line-endpoint-handles";
import { ConnectHandle } from "./connect-handle";
import { CornerRadiusHandle } from "./corner-radius-handle";
import { UrlHandle } from "./url-handle";
import { computeUmlClassDimensions } from "@/lib/uml-utils";
import { openExternalUrlInNewTab } from "@/lib/url-utils";

const NODE_WIDTH = 80;
const BASE_NODE_HEIGHT = 80;
const TEXT_NODE_HEIGHT = 40; // Height for text-only nodes
const EXTRA_LINE_HEIGHT = 20; // Additional height per extra line of text

// Helper function to get gradient CSS with angle
const getGradientWithAngle = (colors: string[], angle: number = 135) => {
  // Convert angle to CSS gradient direction
  let gradientDirection = '';
  switch (angle) {
    case 0:
      gradientDirection = 'to right';
      break;
    case 45:
      gradientDirection = 'to bottom right';
      break;
    case -45:
      gradientDirection = 'to top right';
      break;
    case 90:
      gradientDirection = 'to bottom';
      break;
    case 180:
      gradientDirection = 'to left';
      break;
    default:
      gradientDirection = `${angle}deg`;
  }
  // Ensure unique string by including angle in all cases
  const gradient = `linear-gradient(${gradientDirection}, ${colors[0]}, ${colors[1]})`;
  return gradient;
};

// Helper function to convert gradient angle to SVG coordinates
const getGradientCoordinates = (angle: number = 135) => {
  // CSS gradient angles: 0° = to right, 90° = to bottom, -45° = to top right
  // Convert CSS angle to SVG coordinates (where 0° points right)
  const radians = (angle * Math.PI) / 180;
  
  // Calculate end point coordinates
  const x2 = 50 + 50 * Math.cos(radians);
  const y2 = 50 + 50 * Math.sin(radians);
  
  // Calculate start point (opposite direction)
  const x1 = 50 - 50 * Math.cos(radians);
  const y1 = 50 - 50 * Math.sin(radians);
  
  return {
    x1: `${x1}%`,
    y1: `${y1}%`,
    x2: `${x2}%`,
    y2: `${y2}%`
  };
};

// Helper function to determine if a color is dark or light
const isColorDark = (color: string): boolean => {
  // Convert hex to RGB
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches) {
      r = parseInt(matches[0]);
      g = parseInt(matches[1]);
      b = parseInt(matches[2]);
    }
  }
  
  // Calculate relative luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if dark (luminance < 0.5)
  return luminance < 0.5;
};

// Helper function to get text color based on background
const getTextColorForBackground = (backgroundColor: string, customTextColor?: string): string => {
  if (customTextColor) return customTextColor;
  return isColorDark(backgroundColor) ? '#ffffff' : '#000000';
};

// Helper function to get text styling CSS for a node
const getTextStylingForNode = (node: DiagramNodeData) => {
  const textStyling = extractTextStylingFromNode(node);
  return getTextStylingCSS(textStyling);
};

interface DiagramNodeProps {
  node: DiagramNodeData & { x: number; y: number };
  isSelected?: boolean;
  isTargetable?: boolean;
  isHighlighted?: boolean;
  isMultiSelected?: boolean;
  isGroupMember?: boolean;
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onLabelUpdate?: (nodeId: string, newLabel: string, richLabel?: RichTextRun[]) => void;
  onTagUpdate?: (nodeId: string, newTag: string) => void;
  onResize?: (nodeId: string, newWidth: number, newHeight: number, newX?: number, newY?: number) => void;
  onResizeStart?: (nodeId: string, width: number, height: number) => void;
  onResizeEnd?: () => void;
  onPositionUpdate?: (nodeId: string, x: number, y: number) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  onUpdate?: (node: DiagramNodeData) => void;
  hoverEnabled?: boolean;
  isReadOnly?: boolean;
  onHoverChange?: (id: string, itemType: 'node' | 'zone', isHovered: boolean) => void;
  onConnect?: (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number; sourceItemId?: string }) => void;
  isConnectMode?: boolean;
  transform?: { x: number; y: number; k: number }; // Canvas transform for coordinate conversion
  canvasRef?: React.RefObject<HTMLDivElement | null>; // Canvas ref for coordinate conversion
  /** Z-index for order-aware connection layering (when set, overrides default 2) */
  stackZIndex?: number;
  /** When true, pointer-events: none so clicks pass through to selected item below */
  pointerEventsPassThrough?: boolean;
  /** Layer show/hide animation style (opacity, transition, transform) from useLayerAnimation; slide transitions may add visualColorMerge* */
  animationStyle?: {
    opacity: number;
    transition: string;
    transform?: string;
    transformOrigin?: string;
    visualColorMerge?: Record<string, unknown>;
    visualColorMergeTransition?: string;
    transitionDelayMs?: number;
    visualColorCrossfade?: { from: Record<string, unknown>; to: Record<string, unknown> };
    visualColorCrossfadeTopOpacity?: number;
    visualColorCrossfadeTopTransition?: string;
  };
  /** When node has subDiagramId, double-click navigates to sub-diagram instead of editing label */
  onSubDiagramDoubleClick?: (node: DiagramNodeData) => void;
  /** True when node links to an existing sub-diagram (shows golden glow) */
  hasLinkedSubDiagram?: boolean;
  /** When true, show URL handle (green icon) even in read-only mode - for viewer link support */
  showUrlHandleWhenReadOnly?: boolean;
  /** Alt+drag duplicate preview ghost — non-interactive, not a drag source */
  isDuplicateDragPreview?: boolean;
}

function areDiagramNodePropsEqual(prev: DiagramNodeProps, next: DiagramNodeProps): boolean {
  if (prev.node !== next.node) {
    const p = prev.node;
    const n = next.node;
    if (p.id !== n.id || p.x !== n.x || p.y !== n.y || p.label !== n.label ||
        JSON.stringify((p as any).richLabel) !== JSON.stringify((n as any).richLabel) ||
        p.width !== n.width || p.height !== n.height || p.type !== n.type ||
        (p as any).rotation !== (n as any).rotation || p.tag !== n.tag ||
        (p as any).cornerRadius !== (n as any).cornerRadius) {
      return false;
    }
    const pUml = (p as any).umlClass;
    const nUml = (n as any).umlClass;
    if (JSON.stringify(pUml) !== JSON.stringify(nUml)) return false;
    const pLine = p as any;
    const nLine = n as any;
    if (pLine.startPos && nLine.startPos) {
      if (pLine.startPos.x !== nLine.startPos.x || pLine.startPos.y !== nLine.startPos.y ||
          pLine.endPos.x !== nLine.endPos.x || pLine.endPos.y !== nLine.endPos.y) {
        return false;
      }
    } else if (pLine.startPos !== nLine.startPos) {
      return false;
    }
  }
  return prev.isSelected === next.isSelected &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.isGroupMember === next.isGroupMember &&
    prev.stackZIndex === next.stackZIndex &&
    prev.pointerEventsPassThrough === next.pointerEventsPassThrough &&
    prev.hoverEnabled === next.hoverEnabled &&
    prev.isReadOnly === next.isReadOnly &&
    prev.transform?.x === next.transform?.x &&
    prev.transform?.y === next.transform?.y &&
    prev.transform?.k === next.transform?.k &&
    prev.onClick === next.onClick &&
    prev.onContextMenu === next.onContextMenu &&
    prev.onLabelUpdate === next.onLabelUpdate &&
    prev.onTagUpdate === next.onTagUpdate &&
    prev.onResize === next.onResize &&
    prev.onResizeStart === next.onResizeStart &&
    prev.onResizeEnd === next.onResizeEnd &&
    prev.onUpdate === next.onUpdate &&
    prev.onPositionUpdate === next.onPositionUpdate &&
    prev.onDraggingChange === next.onDraggingChange &&
    prev.onHoverChange === next.onHoverChange &&
    prev.onConnect === next.onConnect &&
    prev.isConnectMode === next.isConnectMode &&
    prev.animationStyle === next.animationStyle &&
    prev.onSubDiagramDoubleClick === next.onSubDiagramDoubleClick &&
    prev.hasLinkedSubDiagram === next.hasLinkedSubDiagram &&
    prev.showUrlHandleWhenReadOnly === next.showUrlHandleWhenReadOnly &&
    prev.isDuplicateDragPreview === next.isDuplicateDragPreview;
}

function DiagramNodeInner({ node, isSelected, isTargetable, isHighlighted, isMultiSelected, isGroupMember, onClick, onContextMenu, onLabelUpdate, onTagUpdate, onResize, onResizeStart, onResizeEnd, onPositionUpdate, onDraggingChange, onUpdate, hoverEnabled = true, isReadOnly = false, onHoverChange, onConnect, isConnectMode, transform, canvasRef, stackZIndex, pointerEventsPassThrough = false, animationStyle, onSubDiagramDoubleClick, hasLinkedSubDiagram, showUrlHandleWhenReadOnly, isDuplicateDragPreview = false }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [editText, setEditText] = useState(node.label || '');
  const [editRuns, setEditRuns] = useState<RichTextRun[]>([]);
  const [editTagText, setEditTagText] = useState(node.tag || '');
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'top' | 'left' | 'right' | 'bottom' | 'bottom-right' | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<'top' | 'left' | 'right' | 'bottom' | 'bottom-right' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const resizeStartPos = useRef<{ x: number; y: number; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Local dimensions during resize for instant visual feedback (no parent update until end)
  const [resizeDimensions, setResizeDimensions] = useState<{ width: number; height: number } | null>(null);
  const [resizePosition, setResizePosition] = useState<{ x: number; y: number } | null>(null);
  const latestResizeDimensionsRef = useRef<{ width: number; height: number; x?: number; y?: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  // Line endpoint dragging state
  const [isDraggingLineEndpoint, setIsDraggingLineEndpoint] = useState(false);
  const [lineEndpointHandle, setLineEndpointHandle] = useState<'start' | 'end' | null>(null);
  const lineEndpointStartPos = useRef<{ x: number; y: number; startPoint: { x: number; y: number }; endPoint: { x: number; y: number } } | null>(null);

  // Corner radius drag state (rounded-rectangle only)
  const [isDraggingCornerRadius, setIsDraggingCornerRadius] = useState(false);
  const [localCornerRadius, setLocalCornerRadius] = useState<number | null>(null);
  const cornerRadiusDragRef = useRef<{ startX: number; startValue: number } | null>(null);
  const latestCornerRadiusRef = useRef<number>(0);

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Label double-click always enters edit mode; sub-diagram navigation only on icon/glow double-click
    setIsEditingLabel(true);
    setIsOpen(false); // Close popup when editing starts
    setEditText(node.label || '');
    if (node.type === 'generic.text.textbox' || node.type === 'generic.text.text') {
      setEditRuns(node.richLabel ?? labelToRuns(node.label));
    }
    setTimeout(() => {
      const ref = (isTextboxNode || isTextNode) ? null : inputRef.current;
      if (ref) {
        ref.focus();
        ref.select();
      }
    }, 0);
  };

  const handleLabelSubmit = () => {
    if (onLabelUpdate && editText.trim() !== node.label) {
      onLabelUpdate(node.id, editText.trim());
    }
    setIsEditingLabel(false);
  };

  const handleRichLabelSubmit = (plainText: string, runs: RichTextRun[]) => {
    if (onLabelUpdate) {
      onLabelUpdate(node.id, plainText.trim(), runs);
    }
    setIsEditingLabel(false);
  };

  const handleTagDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTag(true);
    setIsOpen(false); // Close popup when editing starts
    setEditTagText(node.tag || '');
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
        tagInputRef.current.select();
      }
    }, 0);
  };

  const handleTagSubmit = () => {
    if (onTagUpdate && editTagText.trim() !== node.tag) {
      onTagUpdate(node.id, editTagText.trim());
    }
    setIsEditingTag(false);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent, isMultiline: boolean = false) => {
    if (e.key === 'Enter') {
      if (isMultiline) {
        // For multiline inputs, only submit on Ctrl+Enter or Cmd+Enter
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleLabelSubmit();
        }
        // Otherwise, allow Enter to create a new line (default textarea behavior)
      } else {
        // For single-line inputs, Enter submits
        handleLabelSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditText(node.label || '');
      if (node.type === 'generic.text.textbox' || node.type === 'generic.text.text') {
        setEditRuns(node.richLabel ?? labelToRuns(node.label));
      }
      // Also clear resize state when Escape is pressed
      if (isResizing) {
        handleResizeEnd();
      }
    } else if (!isEditingLabel && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      // Handle keyboard navigation for selected nodes (skip if locked)
      if (node.locked) {
        return; // Don't move locked nodes
      }
      e.preventDefault();
      const gridSize = 20;
      let newX = node.x || 0;
      let newY = node.y || 0;

      switch (e.key) {
        case 'ArrowUp':
          newY -= gridSize;
          break;
        case 'ArrowDown':
          newY += gridSize;
          break;
        case 'ArrowLeft':
          newX -= gridSize;
          break;
        case 'ArrowRight':
          newX += gridSize;
          break;
      }

      // Update node position through parent
      if (onPositionUpdate) {
        onPositionUpdate(node.id, newX, newY);
      }
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTagSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingTag(false);
      setEditTagText(node.tag || '');
    }
  };

  /** During slide transitions, merge previous-slide colors so CSS can lerp to current slide. */
  const displayNode = useMemo(() => {
    const cf = animationStyle?.visualColorCrossfade;
    if (cf) {
      return { ...node, ...cf.to } as DiagramNodeData;
    }
    const m = animationStyle?.visualColorMerge;
    if (!m || Object.keys(m).length === 0) return node;
    return { ...node, ...m } as DiagramNodeData;
  }, [node, animationStyle]);

  const slideShapeShadowMode = useMemo(
    () => getSlideShapeShadowMode(animationStyle),
    [animationStyle],
  );

  /** Gradient slide changes: two full renders with top-layer opacity (see use-slide-transition). */
  const wrapSlideVisualCrossfade = (render: (visualNode: DiagramNodeData) => React.ReactNode) => {
    if (!animationStyle?.visualColorCrossfade) {
      return render(displayNode);
    }
    const from = { ...node, ...animationStyle.visualColorCrossfade.from } as DiagramNodeData;
    const to = { ...node, ...animationStyle.visualColorCrossfade.to } as DiagramNodeData;
    const topOpacity = animationStyle.visualColorCrossfadeTopOpacity ?? 0;
    const topTransition = animationStyle.visualColorCrossfadeTopTransition ?? 'none';
    const liftGroupShadow = Boolean((displayNode as any).shadow);
    return (
      <div
        className="relative w-full h-full min-h-0 isolate"
        style={liftGroupShadow ? { filter: "var(--shape-shadow-drop)" } : undefined}
      >
        <div className="absolute inset-0">{render(from)}</div>
        <div
          className="absolute inset-0"
          style={{
            opacity: topOpacity,
            transition: topTransition,
            pointerEvents: topOpacity < 1 ? "none" : "auto",
          }}
        >
          {render(to)}
        </div>
      </div>
    );
  };

  // Helper function to render shape based on node type (excludes icons/emojis - they use ResourceIcon)
  const renderShapeForVisualNode = (visualNode: DiagramNodeData, slideColorTransition?: string) => {
    if (isIconOrEmojiType(node.type)) return null
    const nodeAny = node as any;
    const shapeProps = {
      node: visualNode,
      slideColorTransition,
      overrideWidth: typeof displayWidth === 'number' ? displayWidth : undefined,
      overrideHeight: typeof displayHeight === 'number' ? displayHeight : undefined,
      tag: nodeAny.tag,
      tagPosition: nodeAny.tagPosition,
      isEditingTag,
      editTagText,
      onTagTextChange: setEditTagText,
      onTagSubmit: handleTagSubmit,
      onTagKeyDown: handleTagKeyDown,
      onTagDoubleClick: handleTagDoubleClick,
      label: node.label || '',
      isEditingLabel,
      editText,
      onLabelTextChange: setEditText,
      onLabelSubmit: handleLabelSubmit,
      onLabelKeyDown: (e: React.KeyboardEvent) => handleLabelKeyDown(e, true),
      onLabelDoubleClick: handleLabelDoubleClick,
    };

    const nodeType = node.type;
    if (nodeType === 'generic.object.square' || nodeType?.endsWith('.square')) {
      return <SquareShape {...shapeProps} />;
    } else     if (nodeType === 'generic.object.uml-class' || nodeType?.endsWith('.uml-class')) {
      const nodeAny = node as any;
      return (
        <UmlClassShape
          node={visualNode}
          slideColorTransition={slideColorTransition}
          overrideWidth={shapeProps.overrideWidth}
          overrideHeight={shapeProps.overrideHeight}
          label={shapeProps.label}
          tag={shapeProps.tag}
          tagPosition={shapeProps.tagPosition}
          isEditingTag={shapeProps.isEditingTag}
          editTagText={shapeProps.editTagText}
          onTagTextChange={shapeProps.onTagTextChange}
          onTagSubmit={shapeProps.onTagSubmit}
          onTagKeyDown={shapeProps.onTagKeyDown}
          onTagDoubleClick={shapeProps.onTagDoubleClick}
          onUmlClassUpdate={onUpdate ? (umlClass) => {
            const merged = { ...(nodeAny.umlClass || {}), ...umlClass };
            const dims = computeUmlClassDimensions(
              merged.name ?? 'name',
              merged.attributes ?? ['attributes'],
              merged.methods ?? ['methods']
            );
            onUpdate({ ...node, umlClass: merged, width: dims.width, height: dims.height });
          } : undefined}
          isReadOnly={isReadOnly}
        />
      );
    } else if (nodeType === 'generic.object.rectangle' || nodeType?.endsWith('.rectangle')) {
      return <RectangleShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.rounded-rectangle' || nodeType?.endsWith('.rounded-rectangle')) {
      const roundedNode = isDraggingCornerRadius && localCornerRadius !== null
        ? { ...visualNode, cornerRadius: localCornerRadius }
        : visualNode;
      return <RoundedRectangleShape {...shapeProps} node={roundedNode} />;
    } else if (nodeType === 'generic.object.circle' || nodeType?.endsWith('.circle')) {
      return <CircleShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.point' || nodeType?.endsWith('.point')) {
      return <PointShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.kite' || nodeType?.endsWith('.kite')) {
      return <KiteShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.triangle' || nodeType?.endsWith('.triangle')) {
      return <TriangleShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.star' || nodeType?.endsWith('.star')) {
      return <StarShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.hexagon' || nodeType?.endsWith('.hexagon')) {
      return <HexagonShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.pentagon' || nodeType?.endsWith('.pentagon')) {
      return <PentagonShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.octagon' || nodeType?.endsWith('.octagon')) {
      return <OctagonShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.cloud' || nodeType?.endsWith('.cloud')) {
      return <CloudShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.parallelogram' || nodeType?.endsWith('.parallelogram')) {
      return <ParallelogramShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.trapezoid' || nodeType?.endsWith('.trapezoid')) {
      return <TrapezoidShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.jigsaw' || nodeType?.endsWith('.jigsaw')) {
      return <JigsawShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.arrowhead' || nodeType?.endsWith('.arrowhead')) {
      return <ArrowheadShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.chevron' || nodeType?.endsWith('.chevron')) {
      return <ChevronShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.line' || nodeType?.endsWith('.line')) {
      const lineNodeWithLocalPos = {
        ...visualNode,
        ...(localStartPos && { __localStartPos: localStartPos }),
        ...(localEndPos && { __localEndPos: localEndPos })
      };
      return <LineShape {...shapeProps} node={lineNodeWithLocalPos} onClick={onClick} onContextMenu={onContextMenu} />;
    } else if (nodeType === 'generic.object.loop' || nodeType?.endsWith('.loop')) {
      return <LoopShape {...shapeProps} node={visualNode} onClick={onClick} onContextMenu={onContextMenu} />;
    }
    return null;
  };

  const renderShape = () =>
    wrapSlideVisualCrossfade((vn) =>
      renderShapeForVisualNode(
        vn,
        animationStyle?.visualColorCrossfade ? undefined : animationStyle?.visualColorMergeTransition
      )
    );

  // Textbox node content (avoids IIFE parsing issues in Turbopack)
  const renderTextboxContentForVisualNode = (visualNode: DiagramNodeData) => {
    const nodeAny = visualNode as any;
    const borderStyle = nodeAny.borderStyle || 'solid';
    const borderColors = nodeAny.borderColors || [nodeAny.borderColor || '#d1d5db', nodeAny.borderColor || '#d1d5db'];
    const backgroundStyle = nodeAny.backgroundStyle || 'solid';
    const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || '#ffffff', nodeAny.backgroundColor || '#ffffff'];
    const backgroundColor = nodeAny.backgroundColor || '#ffffff';
    const gradientAngle = nodeAny.gradientAngle || 135;
    const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
    const hasShadow = nodeAny.shadow || false;
    const showLocalShadow = hasShadow && slideShapeShadowMode !== "crossfade";
    const borderColor = nodeAny.borderColor || '#d1d5db';

    return (
      <div
        className={cn(
          "flex flex-col h-full w-full rounded-lg",
          animationStyle?.visualColorMergeTransition == null && !animationStyle?.visualColorCrossfade && "transition-colors",
          getVerticalPositionClass(nodeAny.textVerticalPosition),
          node.sizeMode === 'custom' ? "p-1" : "p-4",
          borderStyle !== 'none' && "border-2",
          borderStyle === 'none' && (isSelected
            ? "border border-dashed border-primary opacity-100"
            : "opacity-100 hover:border hover:border-dashed hover:border-primary hover:bg-primary/5"),
          isSelected && borderStyle !== 'none' ? "border-primary" : !(isDragging || isTouchDragging) && borderStyle !== 'none' && "group-hover:border-accent",
          isTargetable && "border-dashed border-primary",
          showLocalShadow && "shadow-[0_10px_15px_-3px_rgba(239,68,68,0.3),0_4px_6px_-2px_rgba(239,68,68,0.2)]"
        )}
        style={{
          background: backgroundStyle === 'none'
            ? 'transparent'
            : backgroundStyle === 'gradient'
              ? `linear-gradient(${gradientAngle}deg, ${backgroundColors[0]}, ${backgroundColors[1]})`
              : backgroundColor,
          ...(borderStyle === 'none' ? {} : borderStyle === 'gradient' ? {
            borderImage: `${getGradientWithAngle(borderColors, borderGradientAngle)} 1`,
            borderColor: 'transparent'
          } : borderStyle === 'dotted' ? {
            borderColor,
            borderStyle: 'dotted'
          } : {
            borderColor
          }),
          color: nodeAny.textColor || '#374151',
          ...(node.sizeMode === 'custom' ? {} : { minHeight: '120px' }),
          ...(showLocalShadow && { boxShadow: 'var(--shape-shadow)' }),
          ...(!animationStyle?.visualColorCrossfade && animationStyle?.visualColorMergeTransition !== undefined
            ? { transition: animationStyle.visualColorMergeTransition }
            : {}),
        }}
      >
        {isEditingLabel ? (
          <div className={`w-full flex-1 flex flex-col min-h-0 overflow-visible ${getVerticalJustifyClass(nodeAny.textVerticalPosition)} ${node.sizeMode === 'custom' ? 'px-1 py-0.5' : 'px-2 py-2'}`}>
            <TextboxRichEditor
              node={node}
              runs={editRuns}
              onSubmit={handleRichLabelSubmit}
              onKeyDown={(e) => handleLabelKeyDown(e, true)}
              onHeightChange={node.sizeMode === 'custom' && onUpdate && !isResizing ? (height) => {
                const snapped = snapDimensionToGrid(height, 40);
                const current = node.height ?? 40;
                if (snapped === current) return;
                onUpdate({ ...node, height: snapped, sizeMode: 'custom' });
              } : undefined}
              onVerticalAlignChange={onUpdate ? (pos) => onUpdate({ ...node, textVerticalPosition: pos }) : undefined}
            />
          </div>
        ) : (
          <div className={`w-full flex-1 flex flex-col min-h-0 ${getVerticalJustifyClass(nodeAny.textVerticalPosition)} ${node.sizeMode === 'custom' ? 'px-1 py-0.5' : 'px-2 py-2'}`}>
            <TextboxRichDisplay
              node={visualNode}
              runs={node.richLabel ?? labelToRuns(node.label)}
              onDoubleClick={handleLabelDoubleClick}
            />
          </div>
        )}
      </div>
    );
  };

  // Regular icon node content (avoids IIFE parsing issues in Turbopack)
  const renderIconNodeContentForVisualNode = (visualNode: DiagramNodeData) => {
    const nodeAny = visualNode as any;
    const { container, icon } = getNodeSizeDimensions(nodeAny.nodeSize);
    const textVerticalPosition = nodeAny.textVerticalPosition || 'bottom';
    const isMiddle = textVerticalPosition === 'middle';
    const isTop = textVerticalPosition === 'top';
    const isBottom = textVerticalPosition === 'bottom';

    return (
      <div className={cn(
        "flex flex-col items-center w-full h-full",
        isMiddle ? "relative justify-center" : "justify-start"
      )}>
        <div className={cn(
          "flex items-center justify-center flex-shrink-0",
          animationStyle?.visualColorMergeTransition == null && !animationStyle?.visualColorCrossfade && "transition-colors",
          nodeAny.noIconBackground ? "" : "rounded-lg shadow-md border bg-card dw-icon-container",
          isSelected ? "border-primary" : nodeAny.noIconBackground || (isDragging || isTouchDragging) ? "" : "group-hover:border-accent",
          isTargetable && "border-dashed border-primary",
          isTop && "order-2",
          isBottom && "order-1"
        )}
        style={{
          width: container,
          height: container,
          ...(!animationStyle?.visualColorCrossfade && animationStyle?.visualColorMergeTransition !== undefined
            ? { transition: animationStyle.visualColorMergeTransition }
            : {}),
        }}>
          <ResourceIcon
            type={node.type}
            provider={node.provider}
            category={node.category}
            file={node.file}
            iconType={node.iconType}
            iconName={node.iconName}
            emoji={node.emoji}
            iconColor={nodeAny.iconColor}
            imageUrl={nodeAny.imageUrl}
            imageOptions={nodeAny.imageOptions}
            width={icon}
            height={icon}
            style={{
              width: icon,
              height: icon,
              ...(!animationStyle?.visualColorCrossfade && animationStyle?.visualColorMergeTransition !== undefined
                ? { transition: animationStyle.visualColorMergeTransition }
                : {}),
            }}
          />
        </div>
        {isEditingLabel ? (
          <input
            ref={inputRef}
            id={`node-input-${node.id}`}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleLabelSubmit}
            onKeyDown={(e) => handleLabelKeyDown(e, false)}
            className={cn(
              "text-sm text-center bg-transparent border border-primary rounded outline-none",
              node.sizeMode === 'custom' ? 'px-1 py-0.5' : 'px-1 py-0.5',
              isMiddle ? "absolute flex items-center justify-center pointer-events-auto left-0 top-0" : "w-full",
              isTop && "order-1",
              isBottom && "order-2"
            )}
            style={isMiddle ? {
              ...getTextStylingForNode(node),
              backgroundColor: 'transparent',
              zIndex: 10,
              width: container,
              height: container
            } : getTextStylingForNode(node)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : node.label ? (
          <p
            className={cn(
              "text-center break-words leading-tight cursor-text hover:bg-background/50 rounded px-1 py-0.5",
              isMiddle ? "absolute flex items-center justify-center pointer-events-auto left-0 top-0 -mx-0 -my-0" : "-mx-1 -my-0.5 w-full",
              isTop && "order-1",
              isBottom && "order-2"
            )}
            style={isMiddle ? {
              ...getTextStylingForNode(node),
              backgroundColor: 'transparent',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: container,
              height: container
            } : {
              ...getTextStylingForNode(node),
              display: 'block'
            }}
            onDoubleClick={handleLabelDoubleClick}
          >
            {node.label}
          </p>
        ) : null}
      </div>
    );
  };
  
  // Calculate dynamic height based on label length and node type
  const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
    // Use custom height if sizeMode is 'custom' and customHeight is provided
    if (sizeMode === 'custom' && customHeight) {
      return customHeight;
    }
    
    // Handle larger multi-line text boxes
    if (nodeType === 'generic.text.textbox') {
      const maxCharsPerLine = 30; // More characters fit in wider textbox
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine)); // Minimum 1 line
      return 40 + ((lines - 1) * EXTRA_LINE_HEIGHT); // Start with 40px height
    } else if (nodeType === 'generic.text.textbox') {
      const maxCharsPerLine = 25; // Characters fit in textbox
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine)); // Minimum 1 line for custom sizing
      return 100 + ((lines - 1) * EXTRA_LINE_HEIGHT); // Start with 100px height
    } else if (nodeType === 'generic.text.text') {
      const maxCharsPerLine = 20; // More characters fit in text-only nodes
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
      return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
    } else {
      const maxCharsPerLine = 12; // Approximate characters that fit in node width
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
      return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
    }
  };
  
   // Helper function to get text justification class
   const getTextJustifyClass = (justify?: string) => {
     switch (justify) {
       case 'left':
         return 'text-left';
       case 'center':
         return 'text-center';
       case 'right':
         return 'text-right';
       case 'full':
         return 'text-justify';
       default:
         return 'text-center';
     }
   };
   
   // Helper function to get vertical positioning class (for flex containers with flex-col)
   const getVerticalPositionClass = (position?: string) => {
     switch (position) {
       case 'top':
         return 'items-start';
       case 'middle':
         return 'items-center';
       case 'bottom':
         return 'items-end';
       default:
         return 'items-center';
     }
   };
   
   // Helper function to get vertical justification class (for flex containers with flex-col to position content)
   const getVerticalJustifyClass = (position?: string) => {
     switch (position) {
       case 'top':
         return 'justify-start';
       case 'middle':
         return 'justify-center';
       case 'bottom':
         return 'justify-end';
       default:
         return 'justify-center';
     }
    };

    // Helper function to get tag positioning classes
    const getTagPositionClasses = (position?: string) => {
      switch (position) {
        case 'top-left':
          return '-top-[30px] left-0';
        case 'top-center':
          return '-top-[30px] left-1/2 transform -translate-x-1/2';
        case 'top-right':
          return '-top-[30px] right-0';
        case 'bottom-left':
          return '-bottom-[30px] left-0';
        case 'bottom-center':
          return '-bottom-[30px] left-1/2 transform -translate-x-1/2';
        case 'bottom-right':
          return '-bottom-[30px] right-0';
        default:
          return '-top-[30px] left-1/2 transform -translate-x-1/2'; // Default to top-center
      }
    };

   const isTextNode = node.type === 'generic.text.text';
  const isTextboxNode = node.type === 'generic.text.textbox';
   const isShapeNode = !isIconOrEmojiType(node.type) && (node.type === 'generic.object.square' || node.type === 'generic.object.circle' || node.type === 'generic.object.point' || node.type === 'generic.object.rectangle' || node.type === 'generic.object.uml-class' || node.type === 'generic.object.rounded-rectangle' || node.type === 'generic.object.triangle' || node.type === 'generic.object.star' || node.type === 'generic.object.cloud' || node.type === 'generic.object.parallelogram' || node.type === 'generic.object.trapezoid' || node.type === 'generic.object.kite' || node.type === 'generic.object.hexagon' || node.type === 'generic.object.pentagon' || node.type === 'generic.object.octagon' || node.type === 'generic.object.jigsaw' || node.type === 'generic.object.arrowhead' || node.type === 'generic.object.chevron' || node.type === 'generic.object.line' || node.type === 'generic.object.loop' ||
                       node.type?.endsWith('.square') || node.type?.endsWith('.circle') || node.type?.endsWith('.point') || node.type?.endsWith('.rectangle') || node.type?.endsWith('.rounded-rectangle') || node.type?.endsWith('.triangle') || node.type?.endsWith('.star') || node.type?.endsWith('.cloud') || node.type?.endsWith('.parallelogram') || node.type?.endsWith('.trapezoid') || node.type?.endsWith('.kite') || node.type?.endsWith('.hexagon') || node.type?.endsWith('.pentagon') || node.type?.endsWith('.octagon') || node.type?.endsWith('.jigsaw') || node.type?.endsWith('.arrowhead') || node.type?.endsWith('.chevron') || node.type?.endsWith('.line') || node.type?.endsWith('.loop'));
  const isPointNode = node.type === 'generic.object.point' || node.type?.endsWith('.point');
  const isLineNode = node.type === 'generic.object.line' || node.type?.endsWith('.line');
  const isRoundedRectangleNode = node.type === 'generic.object.rounded-rectangle' || node.type?.endsWith('.rounded-rectangle');
  const isRotatableNode = (isTextNode || isTextboxNode || isShapeNode) && !isLineNode;
  const isIconNode = !isTextNode && !isTextboxNode && !isShapeNode && !isLineNode;
  const nodeHeight = calculateNodeHeight(node.label || '', node.type, node.sizeMode, node.height);
  const iconNodeDims = isIconNode ? measureNodeDims(node as any) : null;
  const rotation = (node as any).rotation || 0;
  // During resize, use local dimensions for instant visual feedback
  const displayWidth = resizeDimensions ? resizeDimensions.width : (
    isShapeNode ? (node.width || 60) :
    (isRotatableNode || isTextboxNode) ? (node.sizeMode === 'custom' && node.width ? node.width : undefined) :
    undefined
  );
  const displayHeight = resizeDimensions ? resizeDimensions.height : (
    isShapeNode ? (node.height || 60) :
    (isTextboxNode && node.sizeMode === 'custom') ? (node.height || 40) :
    undefined
  );
  const isLocked = node.locked || false;
  
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemTypes.CANVAS_NODE,
    item: { 
      ...node, // Include ALL node properties
      x: node.x, 
      y: node.y, 
      type: ItemTypes.CANVAS_NODE, 
      // CRITICAL: Preserve original shape type for scratchpad
      originalType: node.type,
      label: node.label || '' 
    },
    canDrag: () => !isDuplicateDragPreview && !isLocked && !isReadOnly && !isEditingLabel && !isEditingTag,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    onDragStart: () => {
      onDraggingChange?.(true);
    },
    onDragEnd: () => {
      onDraggingChange?.(false);
    },
  }), [node, node.id, node.x, node.y, onDraggingChange, isLocked, isReadOnly, isEditingLabel, isEditingTag, isDuplicateDragPreview]);

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  
  // Temporary position for dragging (doesn't update actual data until drop)
  const [tempPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, handle: 'top' | 'left' | 'right' | 'bottom' | 'bottom-right') => {
    if (isReadOnly) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    const startX = node.x ?? 0;
    const startY = node.y ?? 0;
    const startWidth = isIconNode ? (iconNodeDims?.width ?? (node as any).labelWidth ?? 80) : (node.width || (isTextboxNode ? 40 : 80));
    const startHeight = isIconNode ? (iconNodeDims?.height ?? nodeHeight) : (node.height || nodeHeight);
    
    // Store original dimensions for multi-resize
    (node as any).originalWidth = startWidth;
    (node as any).originalHeight = startHeight;
    
    // Notify parent to store original dimensions for all selected items
    if (onResizeStart) {
      onResizeStart(node.id, startWidth, startHeight);
    }
    
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startX,
      startY,
      startWidth,
      startHeight
    };
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!isResizing || !resizeStartPos.current || !resizeHandle) return;
    
    let deltaX = e.clientX - resizeStartPos.current.x;
    let deltaY = e.clientY - resizeStartPos.current.y;
    if (transform) {
      deltaX = deltaX / transform.k;
      deltaY = deltaY / transform.k;
    }
    
    let newWidth = resizeStartPos.current.startWidth;
    let newHeight = resizeStartPos.current.startHeight;
    
    const minWidth = isTextboxNode ? 40 : isShapeNode ? 20 : 80;
    const minHeight = isTextboxNode ? 40 : isShapeNode ? 20 : 40;
    const isKiteNode = node.type === 'generic.object.kite' || node.type?.endsWith?.('.kite');
    
    let newX: number | undefined;
    let newY: number | undefined;
    const { startX, startY } = resizeStartPos.current;

    switch (resizeHandle) {
      case 'right':
        newWidth = resizeStartPos.current.startWidth + deltaX;
        if (isKiteNode) newHeight = newWidth;
        break;
      case 'bottom':
        newHeight = resizeStartPos.current.startHeight + deltaY;
        if (isKiteNode) newWidth = newHeight;
        break;
      case 'bottom-right': {
        // Proportional resize: maintain aspect ratio (both dimensions scale together)
        const rawW = resizeStartPos.current.startWidth + deltaX;
        const rawH = resizeStartPos.current.startHeight + deltaY;
        // Use the larger scale so the shape fills the dragged area
        const scaleFromW = rawW / resizeStartPos.current.startWidth;
        const scaleFromH = rawH / resizeStartPos.current.startHeight;
        const scale = Math.max(scaleFromW, scaleFromH, minWidth / resizeStartPos.current.startWidth, minHeight / resizeStartPos.current.startHeight);
        newWidth = resizeStartPos.current.startWidth * scale;
        newHeight = resizeStartPos.current.startHeight * scale;
        if (isKiteNode) {
          const size = Math.max(newWidth, newHeight);
          newWidth = size;
          newHeight = size;
        }
        break;
      }
      case 'top':
        // Drag up = increase height (bottom stays fixed), drag down = decrease
        newHeight = Math.max(minHeight, resizeStartPos.current.startHeight - deltaY);
        if (isKiteNode) newWidth = newHeight;
        newY = startY + (resizeStartPos.current.startHeight - newHeight);
        break;
      case 'left':
        // Drag left = increase width (right stays fixed), drag right = decrease
        newWidth = Math.max(minWidth, resizeStartPos.current.startWidth - deltaX);
        if (isKiteNode) newHeight = newWidth;
        newX = startX + (resizeStartPos.current.startWidth - newWidth);
        break;
    }

    newWidth = snapDimensionToGrid(newWidth, minWidth);
    newHeight = snapDimensionToGrid(newHeight, minHeight);
    if (isKiteNode) newHeight = newWidth; // ensure square after snap

    // Recompute position for top/left after snapping (keep anchor edge fixed)
    if (resizeHandle === 'top' && newY !== undefined) {
      newY = startY + (resizeStartPos.current.startHeight - newHeight);
    }
    if (resizeHandle === 'left' && newX !== undefined) {
      newX = startX + (resizeStartPos.current.startWidth - newWidth);
    }

    const dims = { width: newWidth, height: newHeight, x: newX, y: newY };
    latestResizeDimensionsRef.current = dims;
    setResizeDimensions({ width: newWidth, height: newHeight });
    setResizePosition(newX !== undefined || newY !== undefined ? { x: newX ?? startX, y: newY ?? startY } : null);
  };

  const handleResizeEnd = () => {
    const dimensions = latestResizeDimensionsRef.current ?? resizeStartPos.current;
    latestResizeDimensionsRef.current = null;
    resizeStartPos.current = null;
    setResizeDimensions(null);
    setResizePosition(null);
    setIsResizing(false);
    setResizeHandle(null);
    delete (node as any).originalWidth;
    delete (node as any).originalHeight;
    if (dimensions && onResize) {
      const w = 'width' in dimensions ? dimensions.width : dimensions.startWidth;
      const h = 'height' in dimensions ? dimensions.height : dimensions.startHeight;
      const newX = dimensions && 'x' in dimensions ? dimensions.x : undefined;
      const newY = dimensions && 'y' in dimensions ? dimensions.y : undefined;
      onResize(node.id, w, h, newX, newY);
    }
    if (onResizeEnd) {
      onResizeEnd();
    }
  };
  
  // Store initial container position when drag starts (keeps container stable during drag)
  const initialContainerPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Line endpoint drag handlers
  const handleLineEndpointDragStart = (e: React.MouseEvent, handle: 'start' | 'end') => {
    if (isReadOnly) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingLineEndpoint(true);
    setLineEndpointHandle(handle);
    
    // Notify parent that dragging has started (prevents history updates during drag)
    onDraggingChange?.(true);
    
    // Store absolute canvas positions (use local state if available, otherwise node state)
    const currentStartPos = localStartPos || (node as any).startPos || { x: node.x || 0, y: node.y || 0 };
    const currentEndPos = localEndPos || (node as any).endPos || { x: (node.x || 0) + 150, y: node.y || 0 };
    
    // Store initial container position (keep it stable during drag)
    const initialMinX = Math.min(currentStartPos.x, currentEndPos.x);
    const initialMinY = Math.min(currentStartPos.y, currentEndPos.y);
    initialContainerPosRef.current = { x: initialMinX, y: initialMinY };
    
    lineEndpointStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startPoint: currentStartPos,
      endPoint: currentEndPos
    };
    
    // Initialize ref with current positions
    latestPositionsRef.current = { startPos: currentStartPos, endPos: currentEndPos };
  };
  
  // Use local state for immediate visual updates, only sync to data on drag end
  const [localStartPos, setLocalStartPos] = useState<{ x: number; y: number } | null>(null);
  const [localEndPos, setLocalEndPos] = useState<{ x: number; y: number } | null>(null);
  // Ref to track latest positions during drag (for reliable access on drag end)
  const latestPositionsRef = useRef<{ startPos: { x: number; y: number } | null, endPos: { x: number; y: number } | null }>({ startPos: null, endPos: null });
  
  // Initialize and sync local state with node positions (but not during drag)
  useEffect(() => {
    if (!isDraggingLineEndpoint && isLineNode) {
      const startPos = (node as any).startPos || { x: node.x || 0, y: node.y || 0 };
      const endPos = (node as any).endPos || { x: (node.x || 0) + 150, y: node.y || 0 };
      
      // Only update if positions actually changed to avoid unnecessary state updates
      setLocalStartPos(prev => {
        if (!prev || prev.x !== startPos.x || prev.y !== startPos.y) {
          return startPos;
        }
        return prev;
      });
      setLocalEndPos(prev => {
        if (!prev || prev.x !== endPos.x || prev.y !== endPos.y) {
          return endPos;
        }
        return prev;
      });
    }
  }, [node.id, (node as any).startPos?.x, (node as any).startPos?.y, (node as any).endPos?.x, (node as any).endPos?.y, isDraggingLineEndpoint, isLineNode]);

  const handleLineEndpointDragMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!isDraggingLineEndpoint || !lineEndpointStartPos.current || !lineEndpointHandle) return;
    
    // Convert screen coordinates to canvas coordinates
    let deltaX = e.clientX - lineEndpointStartPos.current.x;
    let deltaY = e.clientY - lineEndpointStartPos.current.y;
    
    // Apply transform if available (convert screen delta to canvas delta)
    if (transform) {
      deltaX = deltaX / transform.k;
      deltaY = deltaY / transform.k;
    }
    
    let newStartPos = lineEndpointStartPos.current.startPoint;
    let newEndPos = lineEndpointStartPos.current.endPoint;
    
    if (lineEndpointHandle === 'start') {
      newStartPos = {
        x: snapToGrid(lineEndpointStartPos.current.startPoint.x + deltaX),
        y: snapToGrid(lineEndpointStartPos.current.startPoint.y + deltaY)
      };
      setLocalStartPos(newStartPos);
      latestPositionsRef.current.startPos = newStartPos;
    } else {
      newEndPos = {
        x: snapToGrid(lineEndpointStartPos.current.endPoint.x + deltaX),
        y: snapToGrid(lineEndpointStartPos.current.endPoint.y + deltaY)
      };
      setLocalEndPos(newEndPos);
      latestPositionsRef.current.endPos = newEndPos;
    }
    
    // Update local state immediately for visual feedback (no data update yet)
    // This provides instant visual feedback without triggering expensive re-renders
  }, [isDraggingLineEndpoint, lineEndpointHandle, transform]);
  
  const handleLineEndpointDragEnd = useCallback(() => {
    // Only update data on drag end (not during drag) for better performance
    if (onUpdate && lineEndpointStartPos.current) {
      // Get the current positions from ref (most reliable) or fall back to local state or original
      const currentStartPos = latestPositionsRef.current.startPos || localStartPos || lineEndpointStartPos.current.startPoint;
      const currentEndPos = latestPositionsRef.current.endPos || localEndPos || lineEndpointStartPos.current.endPoint;
      
      const minX = Math.min(currentStartPos.x, currentEndPos.x);
      const minY = Math.min(currentStartPos.y, currentEndPos.y);
      
      // Update the node with final positions
      onUpdate({
        ...node,
        x: minX,
        y: minY,
        startPos: currentStartPos,
        endPos: currentEndPos
      });
      
      // Reset refs after update
      latestPositionsRef.current = { startPos: null, endPos: null };
      initialContainerPosRef.current = null;
    }
    
    // Notify parent that dragging has ended (allows history updates again)
    onDraggingChange?.(false);
    
    setIsDraggingLineEndpoint(false);
    setLineEndpointHandle(null);
    lineEndpointStartPos.current = null;
  }, [onUpdate, node, localStartPos, localEndPos, onDraggingChange]);

  // Global mouse events for resize
  useEffect(() => {
    if (isResizing) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!resizeStartPos.current || !resizeHandle) return;
        handleResizeMove(e as any);
      };
      
      const handleGlobalMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleResizeEnd();
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove, true);
      document.addEventListener('mouseup', handleGlobalMouseUp, true);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove, true);
        document.removeEventListener('mouseup', handleGlobalMouseUp, true);
      };
    }
  }, [isResizing, resizeHandle, node.id]);
  
  // Global mouse events for line endpoint dragging
  useEffect(() => {
    if (isDraggingLineEndpoint) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleLineEndpointDragMove(e);
      };
      
      const handleGlobalMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleLineEndpointDragEnd();
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove, true);
      document.addEventListener('mouseup', handleGlobalMouseUp, true);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove, true);
        document.removeEventListener('mouseup', handleGlobalMouseUp, true);
      };
    }
  }, [isDraggingLineEndpoint, lineEndpointHandle, handleLineEndpointDragMove, handleLineEndpointDragEnd, localStartPos, localEndPos, onUpdate, node]);

  // Corner radius drag handlers (rounded-rectangle only)
  const handleCornerRadiusDragStart = useCallback((e: React.MouseEvent) => {
    if (isReadOnly || !onUpdate || !isRoundedRectangleNode) return;
    e.preventDefault();
    e.stopPropagation();
    const startValue = Math.max(0, Math.min(1, (node as any).cornerRadius ?? 0.2));
    cornerRadiusDragRef.current = { startX: e.clientX, startValue };
    latestCornerRadiusRef.current = startValue;
    setLocalCornerRadius(startValue);
    setIsDraggingCornerRadius(true);
    onDraggingChange?.(true);
  }, [isReadOnly, onUpdate, isRoundedRectangleNode, node, onDraggingChange]);

  const handleCornerRadiusDragMove = useCallback((e: MouseEvent) => {
    if (!cornerRadiusDragRef.current) return;
    const { startX, startValue } = cornerRadiusDragRef.current;
    let deltaX = e.clientX - startX;
    if (transform) deltaX = deltaX / transform.k;
    const sensitivity = 80; // pixels for full 0->1 range
    const newValue = Math.max(0, Math.min(1, startValue + deltaX / sensitivity));
    latestCornerRadiusRef.current = newValue;
    setLocalCornerRadius(newValue);
  }, [transform]);

  const handleCornerRadiusDragEnd = useCallback(() => {
    if (onUpdate) {
      const finalValue = localCornerRadius ?? latestCornerRadiusRef.current;
      onUpdate({ ...node, cornerRadius: finalValue });
    }
    cornerRadiusDragRef.current = null;
    setLocalCornerRadius(null);
    setIsDraggingCornerRadius(false);
    onDraggingChange?.(false);
  }, [onUpdate, node, localCornerRadius, onDraggingChange]);

  useEffect(() => {
    if (isDraggingCornerRadius) {
      document.addEventListener('mousemove', handleCornerRadiusDragMove, true);
      document.addEventListener('mouseup', handleCornerRadiusDragEnd, true);
      return () => {
        document.removeEventListener('mousemove', handleCornerRadiusDragMove, true);
        document.removeEventListener('mouseup', handleCornerRadiusDragEnd, true);
      };
    }
  }, [isDraggingCornerRadius, handleCornerRadiusDragMove, handleCornerRadiusDragEnd]);

  // Global click handler to clear resize state when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside this node
      if (!target.closest(`[data-node-id="${node.id}"]`)) {
        // Clear both resize state and hover state
        handleResizeEnd();
        setIsHovered(false);
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [isResizing, node.id, handleResizeEnd, setIsHovered]);

  // Global keyboard handler for Escape key
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isResizing) {
        handleResizeEnd();
        setIsHovered(false);
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isResizing, handleResizeEnd, setIsHovered]);

  // Touch event handlers for mobile drag and drop
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLocked || isReadOnly) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setIsTouchDragging(true);
    onDraggingChange?.(true);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
    e.stopPropagation(); // Prevent canvas from handling this touch
    e.preventDefault(); // Prevent any default touch behavior
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // Only start dragging if moved enough to prevent accidental drags
    if (deltaX > 10 || deltaY > 10) {
      e.preventDefault(); // Prevent scrolling when dragging
      e.stopPropagation(); // Prevent canvas from handling this touch
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // Check if it was a significant drag (not just a tap)
    if (deltaX > 10 || deltaY > 10) {
      // Find the canvas element
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLElement;
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        
        // Calculate position relative to canvas
        const x = touch.clientX - canvasRect.left;
        const y = touch.clientY - canvasRect.top;
        
        // Dispatch a custom event to the canvas for moving the node
        const moveEvent = new CustomEvent('mobileMove', {
          detail: { 
            id: node.id, 
            type: ItemTypes.CANVAS_NODE, 
            x, 
            y,
            originalX: node.x,
            originalY: node.y
          }
        });
        canvas.dispatchEvent(moveEvent);
      }
    } else {
      // This was a tap, not a drag - trigger click
      if (onClick) {
        const syntheticEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        onClick(syntheticEvent as any, node);
      }
    }
    
    // Reset styles
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setIsTouchDragging(false);
    onDraggingChange?.(false);
    touchStartPos.current = null;
    e.stopPropagation();
    e.preventDefault(); // Prevent any default touch behavior
  };



return (
    <div
      data-node-id={node.id}
      ref={(el) => {
        if (el && !isDuplicateDragPreview) {
          drag(el);
        }
      }}
      className={cn(
        "absolute group transition-[transform,filter] duration-200 ease-in-out rounded-lg",
        // Hover and selection effects - not for lines, and not when locked
        !isLineNode && !(isDragging || isTouchDragging) && !(isSelected || isHighlighted || isMultiSelected) && !isLocked && !(hasLinkedSubDiagram ?? node.subDiagramId) && "node-glow-hover",
        !isLineNode && (hasLinkedSubDiagram ?? node.subDiagramId) && !(isSelected || isHighlighted || isMultiSelected) && !isLocked && "node-glow-subdiagram",
        !isLineNode && (isSelected || isHighlighted || isMultiSelected) && "node-glow-static",
        !isLineNode && isGroupMember && !isSelected && !isHighlighted && !isMultiSelected && "node-glow-green-static",
        (isDragging || isTouchDragging) && "cursor-grabbing",
        isTargetable && "cursor-crosshair opacity-70 hover:opacity-100"
        )}
      onClick={isLineNode ? undefined : (e) => onClick && onClick(e, node)} // Lines handle clicks in their SVG (not on container)
      onDoubleClick={isLineNode ? undefined : (e) => {
        if (node.subDiagramId && onSubDiagramDoubleClick) {
          e.stopPropagation();
          onSubDiagramDoubleClick(node);
        }
      }}
      onContextMenu={isLineNode ? undefined : (e) => onContextMenu && onContextMenu(e, node)} // Lines handle context menu in their SVG (not on container)
      style={{
        zIndex: stackZIndex ?? 2,
        // For lines during drag, keep container position stable (use initial position)
        // This prevents handles from drifting - they're positioned relative to stable container
        // For top/left resize, use resizePosition for instant feedback
        left: isLineNode && isDraggingLineEndpoint && initialContainerPosRef.current
          ? initialContainerPosRef.current.x
          : (resizePosition?.x ?? node.x),
        top: isLineNode && isDraggingLineEndpoint && initialContainerPosRef.current
          ? initialContainerPosRef.current.y
          : (resizePosition?.y ?? node.y),
         width: isLineNode ? 'auto' : (typeof displayWidth === 'number' ? displayWidth :
                (isShapeNode ? (node.width || 60) :
                (isRotatableNode || isTextboxNode ? 
                 (node.sizeMode === 'custom' && node.width ? node.width : 'auto') : 
                 (iconNodeDims ? iconNodeDims.width : NODE_WIDTH)))),
         minWidth: isLineNode ? 0 : // Lines don't need min width
                   (resizeDimensions ? (isShapeNode ? 20 : isTextboxNode ? 40 : 80) : // During resize: allow shrinking to match new dimensions (like textbox)
                    isShapeNode ? (node.width || 60) :
                    isTextboxNode ? 40 :
                   isRotatableNode ? 80 : (isIconNode ? (iconNodeDims?.width ?? getNodeSizeDimensions((node as any).nodeSize).container) : NODE_WIDTH)),
         maxWidth: isLineNode ? 'none' : // Lines don't need max width
                   (resizeDimensions ? 'none' : // During resize: allow growing without constraint
                    isShapeNode ? (node.width || 60) :
                    isTextboxNode ? (node.sizeMode === 'custom' ? 'none' : 400) :
                   isRotatableNode ? 200 : (isIconNode ? 400 : NODE_WIDTH)),
         height: isLineNode ? 'auto' : (typeof displayHeight === 'number' ? displayHeight :
                 (isShapeNode ? (node.height || 60) :
                 isTextboxNode && node.sizeMode === 'custom' ? (node.height || 40) :
                 (isRotatableNode || isTextboxNode) ? nodeHeight : (iconNodeDims ? iconNodeDims.height : 'auto'))),
         ...(resizeDimensions && !isLineNode && (isShapeNode || isTextboxNode) && {
           minHeight: isShapeNode ? 20 : 40,
         }),
        touchAction: 'none',
        transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center',
        // For lines: container doesn't intercept clicks, but children (endpoint handles) can still receive events
        // pointerEventsPassThrough: when selected item is behind this, let clicks pass through to it for resize/drag
        ...(isLineNode && { pointerEvents: 'none' }),
        ...(pointerEventsPassThrough && { pointerEvents: 'none' }),
        ...(isDuplicateDragPreview && { pointerEvents: 'none', opacity: 0.88 }),
        // Layer show/hide animation (opacity, transition, transform)
        ...(animationStyle && !isDuplicateDragPreview && {
          opacity: animationStyle.opacity,
          transition: animationStyle.transition,
          ...(animationStyle.transitionDelayMs != null && { transitionDelay: `${animationStyle.transitionDelayMs}ms` }),
          ...(animationStyle.transform && { transform: animationStyle.transform }),
          ...(animationStyle.transformOrigin && { transformOrigin: animationStyle.transformOrigin }),
        }),
      }}
      onMouseEnter={() => { 
        if (!isDragging && !isEditingLabel && !isEditingTag) { 
          setIsOpen(hoverEnabled); 
          setIsHovered(true);
          onHoverChange?.(node.id, 'node', true);
        } 
      }}
      onMouseLeave={() => { 
        if (!isEditingLabel && !isEditingTag) { 
          setIsOpen(false); 
          setIsHovered(false);
          onHoverChange?.(node.id, 'node', false);
        } 
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <SlideShapeShadowTransitionProvider animationStyle={animationStyle}>
      <Popover open={isOpen && !isDragging && !isEditingLabel && !isEditingTag} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex flex-col items-center justify-center h-full w-full cursor-pointer">
            {node.type === 'generic.text.text' ? (
              // Text node - rich text with same toolbar as textbox
              <div className={cn(
                "flex flex-col items-center justify-center h-full w-full px-2",
                isEditingLabel && "overflow-visible"
              )}>
                {isEditingLabel ? (
                  <div className="w-full flex-1 flex flex-col min-h-0 overflow-visible">
                    <TextboxRichEditor
                      node={node}
                      runs={editRuns}
                      onSubmit={handleRichLabelSubmit}
                      onKeyDown={(e) => handleLabelKeyDown(e, true)}
                      onHeightChange={node.sizeMode === 'custom' && onUpdate && !isResizing ? (height) => {
                        const snapped = snapDimensionToGrid(height, 40);
                        const current = node.height ?? 40;
                        if (snapped === current) return;
                        onUpdate({ ...node, height: snapped, sizeMode: 'custom' });
                      } : undefined}
                    />
                  </div>
                ) : (
                  wrapSlideVisualCrossfade((vn) => (
                    <div className="w-full flex-1 flex flex-col min-h-0">
                      <TextboxRichDisplay
                        node={vn}
                        runs={node.richLabel ?? labelToRuns(node.label)}
                        onDoubleClick={handleLabelDoubleClick}
                      />
                    </div>
                  ))
                )}
              </div>
            ) : node.type === 'generic.text.textbox' ? (
              wrapSlideVisualCrossfade((vn) => renderTextboxContentForVisualNode(vn))
             ) : isShapeNode ? (
              // Shape node - render pure shape with text in different positions (resizable)
              // Use justify-start/items-start so resize extends right/down from fixed top-left (like textbox)
                <div className="flex flex-col items-start justify-start h-full w-full relative">
                  <div className="flex items-start justify-start" style={{ width: '100%', height: '100%' }}>
                    {renderShape()}
                  </div>
                </div>
             ) : (
              wrapSlideVisualCrossfade((vn) => renderIconNodeContentForVisualNode(vn))
            )}
          </div>
        </PopoverTrigger>
        {node.info && (
          <PopoverContent
            side="top"
            align="center"
            className="w-64 bg-popover text-popover-foreground shadow-xl border-accent"
          >
            <p className="text-sm whitespace-pre-wrap">{node.info}</p>
          </PopoverContent>
        )}
       </Popover>

       {/* Resize handles - textbox, text (custom), shapes, or icon nodes (label width) */}
        {!isReadOnly && (isResizing || isSelected || isMultiSelected) &&
         (isTextboxNode || ((isTextNode ) && node.sizeMode === 'custom') || (isShapeNode && !isPointNode && !isLineNode) || isIconNode) && (
          <ResizeHandles
            visible={true}
            activeHandle={resizeHandle}
            hoveredHandle={hoveredHandle}
            onStart={handleResizeStart}
            disabled={false}
            zIndexClass="z-50"
            handles={isIconNode ? ['right'] : undefined}
          />
       )}
       
       {/* Line endpoint handles for line shapes - only show when THIS line is selected (not in multi-select with other items) */}
       {!isReadOnly && isLineNode && isSelected && !isMultiSelected && (() => {
         // Get base positions - use same logic as drag start handler for consistency
         // This ensures handles are positioned correctly even on first drag
        const baseStartPos = localStartPos || (node as any).startPos || { x: node.x || 0, y: node.y || 0 };
        const baseEndPos = localEndPos || (node as any).endPos || { x: (node.x || 0) + 150, y: node.y || 0 };
         
         // During drag, only update the handle being dragged, keep the other stable
         const currentStartPos = isDraggingLineEndpoint && lineEndpointHandle === 'start' && localStartPos
           ? localStartPos
           : baseStartPos;
         const currentEndPos = isDraggingLineEndpoint && lineEndpointHandle === 'end' && localEndPos
           ? localEndPos
           : baseEndPos;
         
         // Use node.x/y if available (matches LineShape calculation), otherwise use min of positions
         // This ensures handles align exactly with the line endpoints
         const nodeX = node.x ?? Math.min(currentStartPos.x, currentEndPos.x);
         const nodeY = node.y ?? Math.min(currentStartPos.y, currentEndPos.y);
         
         // During drag, use stable container position to prevent handles from drifting
         const handleNodeX = isDraggingLineEndpoint && initialContainerPosRef.current
           ? initialContainerPosRef.current.x
           : nodeX;
         const handleNodeY = isDraggingLineEndpoint && initialContainerPosRef.current
           ? initialContainerPosRef.current.y
           : nodeY;
         
         return (
           <LineEndpointHandles
             visible={true}
             activeHandle={lineEndpointHandle}
             startPoint={currentStartPos}
             endPoint={currentEndPos}
             nodeX={handleNodeX}
             nodeY={handleNodeY}
             onStartDrag={handleLineEndpointDragStart}
             disabled={false}
             zIndexClass="z-50"
           />
         );
       })()}

       {/* Connect handle - show when selected (not for lines) */}
       {!isReadOnly && (isSelected || isMultiSelected) && onConnect && !isLineNode && (
         <ConnectHandle
           visible={true}
           onConnect={() => onConnect({ style: 'bezier', curvature: 0.6 })}
           isConnectMode={isConnectMode}
           disabled={false}
           zIndexClass="z-50"
         />
       )}

       {/* URL handle - icon nodes and shapes with configured URL (editor when selected, viewer when selected + showUrlHandleWhenReadOnly) */}
       {((!isReadOnly || showUrlHandleWhenReadOnly) && (isIconNode || isShapeNode) && (isSelected || isMultiSelected) && !!node.linkUrl?.trim()) && (
         <UrlHandle
           visible={true}
           onOpen={() => {
             openExternalUrlInNewTab(node.linkUrl);
           }}
           disabled={false}
           zIndexClass="z-50"
           url={node.linkUrl?.trim()}
         />
       )}

       {/* Corner radius handle - rounded-rectangle only, single select */}
       {!isReadOnly && isSelected && !isMultiSelected && isRoundedRectangleNode && onUpdate && (
         <CornerRadiusHandle
           visible={true}
           onMouseDown={handleCornerRadiusDragStart}
           disabled={isDraggingCornerRadius}
           zIndexClass="z-50"
         />
       )}
      </SlideShapeShadowTransitionProvider>
    </div>
  );
}

export const DiagramNode = React.memo(DiagramNodeInner, areDiagramNodePropsEqual);
