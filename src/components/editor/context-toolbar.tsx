"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Type,
  Info,
  Trash2,
  Link,
  Layout,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Image as ImageIcon,
  RotateCw,
  Square,
  Grid3x3,
  Maximize2,
  ArrowRight,
  ArrowDownUp,
  ArrowLeftRight,
  ChevronDown,
  Palette,
  GripHorizontal,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  Tag,
  Minus,
  Copy,
  SquareMinus,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { ColorPicker } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { resolveBezierConnectionPaint, type ConnectionEndpointOutline } from '@/lib/connection-line-style';
import { applyMindmapHueAnchorsAfterVisualChanges } from '@/lib/mindmap-layout';

import { TextStylingPanel } from './text-styling-panel';
import { UmlClassTextStylingPanel } from './uml-class-text-styling-panel';
import { VisualStylingPanel } from './visual-styling-panel';
import { LineStylingPanel } from './line-styling-panel';
import { ConnectionAnimationControls } from './connection-animation-controls';
import { ConnectionLineStyleFields } from './connection-line-style-fields';
import type { SelectedItem } from '../diagram-editor';
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData } from '@/lib/types';
import { DiagramTheme, ThemeMenuApplyOptions } from '@/lib/theme-types';
import { themeManager } from '@/lib/theme-manager';
import { extractTextStylingFromNode, extractTextStylingFromGroup, applyTextStylingToZone, applyTextStylingToNode } from '@/lib/text-styling';
import { extractUmlClassTextStylingFromNode, applyUmlClassTextStylingToNode, DEFAULT_UML_CLASS_TEXT_STYLING } from '@/lib/uml-text-styling';
import { cn, isConnectorLikeSpineNodeType, isConnectorLineNodeType, isShapeNodeType, isIconOrEmojiType, isTimelineNodeType } from '@/lib/utils';
import { isConnectorLineGeometryClosed } from '@/lib/line-curve-path';
import { extractVisualStylingFromNode, extractVisualStylingFromGroup } from '@/lib/visual-styling';
import { extractLineStylingFromNode, applyLineStylingToNode, syncClosedConnectorLineBorderWidth } from '@/lib/line-styling';
import { toConnectionAnimationPatch } from '@/lib/connection-animation';
import { useToast } from '@/hooks/use-toast';
import { normalizeExternalUrl, openExternalUrlInNewTab } from '@/lib/url-utils';

interface ContextToolbarProps {
  selectedItem: SelectedItem | null;
  selectedItemIds?: Set<string>;
  onItemUpdate?: (updatedItem: SelectedItem) => void;
  onBulkMetadataUpdate?: (patch: { tag?: string; info?: string; label?: string }) => void;
  onConnect?: (connectionOptions?: { style?: 'bezier', curvature?: number; sourceItemId?: string }) => void;
  onDisconnect?: () => void;
  onDelete?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { arrow?: boolean; text?: string; textPosition?: number; color?: string; lineWidth?: number; shadow?: boolean; [key: string]: any }, connectionId?: string) => void;
  onConnectionDisconnect?: (from: string, to: string, connectionId?: string) => void;
  onConnectionWaypointAdd?: (from: string, to: string, connectionId?: string) => void;
  onConnectionWaypointRemove?: (from: string, to: string, index: number, connectionId?: string) => void;
  diagramData?: DiagramData;
  onDiagramDataUpdate?: (newDiagramData: DiagramData) => void;
  /** Current diagram (root or sub) - for sub-diagram safe operations */
  currentDiagramData?: DiagramData;
  /** Updates current diagram - for sub-diagram safe updates */
  onCurrentDiagramDataUpdate?: (updater: DiagramData | ((prev: DiagramData) => DiagramData)) => void;
  onAlignObjects?: (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => void;
  onThemeApplyToSelected?: (theme: DiagramTheme, options?: ThemeMenuApplyOptions) => void;
  textStylingPanelOpen?: boolean;
  visualStylingPanelOpen?: boolean;
  lineStylingPanelOpen?: boolean;
  connectionSettingsPanelOpen?: boolean;
  onTextStylingPanelOpenChange?: (open: boolean) => void;
  onVisualStylingPanelOpenChange?: (open: boolean) => void;
  onLineStylingPanelOpenChange?: (open: boolean) => void;
  onConnectionSettingsPanelOpenChange?: (open: boolean) => void;
  isReadOnly?: boolean;
  /** Presentation mode: show add/remove from later slides buttons when true and hasLaterSlides */
  presentationHasLaterSlides?: boolean;
  onPropagateAddToLaterSlides?: () => void;
  onPropagateDeleteToLaterSlides?: () => void;
}

export function ContextToolbar({
  selectedItem,
  selectedItemIds,
  onItemUpdate,
  onBulkMetadataUpdate,
  onConnect,
  onDisconnect,
  onDelete,
  onConnectionUpdate,
  onConnectionDisconnect,
  onConnectionWaypointAdd,
  onConnectionWaypointRemove,
  diagramData,
  onDiagramDataUpdate,
  currentDiagramData,
  onCurrentDiagramDataUpdate,
  onAlignObjects,
  onThemeApplyToSelected,
  textStylingPanelOpen = false,
  visualStylingPanelOpen = false,
  lineStylingPanelOpen = false,
  connectionSettingsPanelOpen = false,
  onTextStylingPanelOpenChange,
  onVisualStylingPanelOpenChange,
  onLineStylingPanelOpenChange,
  onConnectionSettingsPanelOpenChange,
  isReadOnly = false,
  presentationHasLaterSlides = false,
  onPropagateAddToLaterSlides,
  onPropagateDeleteToLaterSlides,
}: ContextToolbarProps) {
  const { toast } = useToast();
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelInputValue, setLabelInputValue] = useState('');
  const labelDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [textStylingOpen, setTextStylingOpen] = useState(false);
  const [visualStylingOpen, setVisualStylingOpen] = useState(false);
  const [lineStylingOpen, setLineStylingOpen] = useState(false);
  const [draggedConnectionIndex, setDraggedConnectionIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [connectionTextDrafts, setConnectionTextDrafts] = useState<Record<string, string>>({});
  /** Keys = connection id or `${from}-${to}-${index}` — which rows show full details in Connections popover */
  const [expandedConnectionKeys, setExpandedConnectionKeys] = useState<Set<string>>(() => new Set());
  const [tagDraft, setTagDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const textStylingPanelRef = useRef<HTMLDivElement>(null);
  const connectionsPanelRef = useRef(null);
  const visualStylingPanelRef = useRef<HTMLDivElement>(null);
  const lineStylingPanelRef = useRef<HTMLDivElement>(null);
  const textStylingButtonRef = useRef<HTMLButtonElement>(null);
  const visualStylingButtonRef = useRef<HTMLButtonElement>(null);
  const lineStylingButtonRef = useRef<HTMLButtonElement>(null);

  const handleTextStylingOpenChange = useCallback((open: boolean) => {
    setTextStylingOpen(open);
    onTextStylingPanelOpenChange?.(open);
  }, [onTextStylingPanelOpenChange]);

  const handleVisualStylingOpenChange = useCallback((open: boolean) => {
    setVisualStylingOpen(open);
    onVisualStylingPanelOpenChange?.(open);
  }, [onVisualStylingPanelOpenChange]);

  const handleLineStylingOpenChange = useCallback((open: boolean) => {
    setLineStylingOpen(open);
    onLineStylingPanelOpenChange?.(open);
  }, [onLineStylingPanelOpenChange]);

  // Sync external panel state with internal state - but only when explicitly triggered
  // Don't auto-open when external state changes - only sync when opening, not when closing
  useEffect(() => {
    if (textStylingPanelOpen && !textStylingOpen) {
      setTextStylingOpen(true);
    }
  }, [textStylingPanelOpen, textStylingOpen]);

  useEffect(() => {
    if (visualStylingPanelOpen && !visualStylingOpen) {
      setVisualStylingOpen(true);
    }
  }, [visualStylingPanelOpen, visualStylingOpen]);

  useEffect(() => {
    if (lineStylingPanelOpen && !lineStylingOpen) {
      setLineStylingOpen(true);
    }
  }, [lineStylingPanelOpen, lineStylingOpen]);

  // Close panels when selectedItem becomes null (deselecting)
  useEffect(() => {
    if (!selectedItem) {
      if (textStylingOpen) {
        handleTextStylingOpenChange(false);
      }
      if (visualStylingOpen) {
        handleVisualStylingOpenChange(false);
      }
      if (lineStylingOpen) {
        handleLineStylingOpenChange(false);
      }
    }
  }, [selectedItem, textStylingOpen, visualStylingOpen, lineStylingOpen, handleTextStylingOpenChange, handleVisualStylingOpenChange, handleLineStylingOpenChange]);

  // Click outside detection for text styling panel
  useEffect(() => {
    if (!textStylingOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on the panel or button
      if (
        textStylingPanelRef.current?.contains(target) ||
        textStylingButtonRef.current?.contains(target)
      ) {
        return;
      }
      
      // Check if click is on a Radix Select dropdown (portaled to body)
      // Radix Select content has data-radix-select-content attribute
      if (target.closest('[data-radix-select-content]')) {
        return;
      }
      
      // Check if click is on a Radix Select viewport (the scrollable area)
      if (target.closest('[data-radix-select-viewport]')) {
        return;
      }
      
      // Check if click is on a Radix Select item
      if (target.closest('[data-radix-select-item]')) {
        return;
      }
      
      // If none of the above, close the panel
      handleTextStylingOpenChange(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [textStylingOpen, handleTextStylingOpenChange]);

  // Click outside detection for visual styling panel
  useEffect(() => {
    if (!visualStylingOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on the panel or button
      if (
        visualStylingPanelRef.current?.contains(target) ||
        visualStylingButtonRef.current?.contains(target)
      ) {
        return;
      }
      
      // Check if click is on a Radix Select dropdown (portaled to body)
      // Radix Select content has data-radix-select-content attribute
      if (target.closest('[data-radix-select-content]')) {
        return;
      }
      
      // Check if click is on a Radix Select viewport (the scrollable area)
      if (target.closest('[data-radix-select-viewport]')) {
        return;
      }
      
      // Check if click is on a Radix Select item
      if (target.closest('[data-radix-select-item]')) {
        return;
      }
      
      // If none of the above, close the panel
      handleVisualStylingOpenChange(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visualStylingOpen, handleVisualStylingOpenChange]);

  // Click outside detection for line styling panel
  useEffect(() => {
    if (!lineStylingOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on the panel or button
      if (
        lineStylingPanelRef.current?.contains(target) ||
        lineStylingButtonRef.current?.contains(target)
      ) {
        return;
      }
      
      // Check if click is on a Radix Select dropdown (portaled to body)
      if (target.closest('[data-radix-select-content]')) {
        return;
      }
      
      // Check if click is on a Radix Select viewport (the scrollable area)
      if (target.closest('[data-radix-select-viewport]')) {
        return;
      }
      
      // Check if click is on a Radix Select item
      if (target.closest('[data-radix-select-item]')) {
        return;
      }
      
      // If none of the above, close the panel
      handleLineStylingOpenChange(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [lineStylingOpen, handleLineStylingOpenChange]);

  useEffect(() => {
    setConnectionsOpen(connectionSettingsPanelOpen);
  }, [connectionSettingsPanelOpen]);

  // Clear connection text drafts when Connections popover closes (expanded/collapsed state persists)
  useEffect(() => {
    if (!connectionsOpen) {
      setConnectionTextDrafts({});
    }
  }, [connectionsOpen]);

  const toggleConnectionExpanded = useCallback((key: string) => {
    setExpandedConnectionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Sync tag/description drafts when popovers open
  useEffect(() => {
    if (tagOpen && selectedItem && selectedItem.itemType !== 'edge') {
      setTagDraft((selectedItem as { tag?: string }).tag || '');
    }
  }, [tagOpen, selectedItem?.id, selectedItem && selectedItem.itemType !== 'edge' ? (selectedItem as { tag?: string }).tag : undefined]);
  useEffect(() => {
    if (descriptionOpen && selectedItem && selectedItem.itemType !== 'edge') {
      setDescriptionDraft(selectedItem.info || '');
    }
  }, [descriptionOpen, selectedItem?.id, selectedItem && selectedItem.itemType !== 'edge' ? (selectedItem as { info?: string }).info : undefined]);

  const prevSelectedIdRef = useRef<string | undefined>(undefined);
  const prevLabelOpenRef = useRef(false);
  useEffect(() => {
    if (selectedItem && selectedItem.itemType !== 'edge' && (prevSelectedIdRef.current !== selectedItem.id || (labelOpen && !prevLabelOpenRef.current))) {
      setLabelInputValue((selectedItem as { label?: string }).label || '');
      prevSelectedIdRef.current = selectedItem.id;
    }
    prevLabelOpenRef.current = labelOpen;
  }, [selectedItem?.id, selectedItem && selectedItem.itemType !== 'edge' ? (selectedItem as { label?: string }).label : undefined, selectedItem?.itemType, labelOpen]);

  // All hooks must run unconditionally (Rules of Hooks) - move before early returns
  const flushLabelChange = useCallback(() => {
    if (labelDebounceRef.current) {
      clearTimeout(labelDebounceRef.current);
      labelDebounceRef.current = null;
    }
    const value = labelInputValue.trim();
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    if (value === ((selectedItem as { label?: string }).label || '')) return;
    const multi = (selectedItemIds?.size ?? 0) > 1;
    if (multi && onBulkMetadataUpdate) {
      onBulkMetadataUpdate({ label: value });
      return;
    }
    const updated = { ...selectedItem, label: value } as SelectedItem;
    if (selectedItem.type === 'generic.text.textbox' || selectedItem.type === 'generic.text.text') {
      (updated as any).richLabel = undefined;
    }
    onItemUpdate?.(updated);
  }, [labelInputValue, selectedItem, selectedItemIds, onItemUpdate, onBulkMetadataUpdate]);

  const handleLabelChange = useCallback((value: string) => {
    setLabelInputValue(value);
    if (labelDebounceRef.current) {
      clearTimeout(labelDebounceRef.current);
    }
    labelDebounceRef.current = setTimeout(() => {
      labelDebounceRef.current = null;
      if (!selectedItem || selectedItem.itemType === 'edge') return;
      const trimmed = value.trim();
      if (trimmed === ((selectedItem as { label?: string }).label || '')) return;
      const multi = (selectedItemIds?.size ?? 0) > 1;
      if (multi && onBulkMetadataUpdate) {
        onBulkMetadataUpdate({ label: trimmed });
        return;
      }
      const updated = { ...selectedItem, label: trimmed } as SelectedItem;
      if (selectedItem.type === 'generic.text.textbox' || selectedItem.type === 'generic.text.text') {
        (updated as any).richLabel = undefined;
      }
      onItemUpdate?.(updated);
    }, 350);
  }, [selectedItem, selectedItemIds, onItemUpdate, onBulkMetadataUpdate]);

  const handleLabelBlur = useCallback(() => {
    flushLabelChange();
    setLabelOpen(false);
  }, [flushLabelChange]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      flushLabelChange();
      setLabelOpen(false);
    }
  }, [flushLabelChange]);

  const colorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleColorChange = useCallback((property: 'borderColor' | 'backgroundColor' | 'textColor' | 'lineColor', value: string) => {
    if (colorTimeoutRef.current) {
      clearTimeout(colorTimeoutRef.current);
    }
    colorTimeoutRef.current = setTimeout(() => {
      if (selectedItem && selectedItem.itemType !== 'edge') {
        onItemUpdate?.({ ...selectedItem, [property]: value } as SelectedItem);
      }
    }, 150);
  }, [selectedItem, onItemUpdate]);

  const handleColorChangeImmediate = useCallback((property: 'borderColor' | 'backgroundColor' | 'textColor' | 'lineColor', value: string) => {
    if (colorTimeoutRef.current) {
      clearTimeout(colorTimeoutRef.current);
    }
    if (selectedItem && selectedItem.itemType !== 'edge') {
      onItemUpdate?.({ ...selectedItem, [property]: value } as SelectedItem);
    }
  }, [selectedItem, onItemUpdate]);

  useEffect(() => {
    return () => {
      if (colorTimeoutRef.current) clearTimeout(colorTimeoutRef.current);
      if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
    };
  }, []);

  // All hooks must run unconditionally (Rules of Hooks) - before any early returns
  const isNode = selectedItem?.itemType === 'node';
  const isTextNode = isNode && (selectedItem as any)?.type?.startsWith('generic.text');
  const isTextboxNode = isNode && (selectedItem as any)?.type === 'generic.text.textbox';
  const isPlainTextNode = isNode && (selectedItem as any)?.type === 'generic.text.text';
  const isShapeNode = isNode && !isIconOrEmojiType((selectedItem as any)?.type) && (
    (selectedItem as any)?.type === 'generic.object.square' ||
    (selectedItem as any)?.type === 'generic.object.circle' ||
    (selectedItem as any)?.type === 'generic.object.point' ||
    (selectedItem as any)?.type === 'generic.object.rectangle' ||
    (selectedItem as any)?.type === 'generic.object.uml-class' ||
    (selectedItem as any)?.type === 'generic.object.rounded-rectangle' ||
    (selectedItem as any)?.type === 'generic.object.progress-bar' ||
    (selectedItem as any)?.type === 'generic.object.timeline-bar' ||
    (selectedItem as any)?.type === 'generic.object.text-box-heading' ||
    (selectedItem as any)?.type === 'generic.object.triangle' ||
    (selectedItem as any)?.type === 'generic.object.star' ||
    (selectedItem as any)?.type === 'generic.object.cloud' ||
    (selectedItem as any)?.type === 'generic.object.parallelogram' ||
    (selectedItem as any)?.type === 'generic.object.trapezoid' ||
    (selectedItem as any)?.type === 'generic.object.kite' ||
    (selectedItem as any)?.type === 'generic.object.hexagon' ||
    (selectedItem as any)?.type === 'generic.object.pentagon' ||
    (selectedItem as any)?.type === 'generic.object.octagon' ||
    (selectedItem as any)?.type === 'generic.object.jigsaw' ||
    (selectedItem as any)?.type === 'generic.object.arrowhead' ||
    (selectedItem as any)?.type === 'generic.object.chevron' ||
    (selectedItem as any)?.type === 'generic.object.timeline' ||
    (selectedItem as any)?.type === 'generic.object.mind-map-node' ||
    isConnectorLineNodeType((selectedItem as any)?.type) ||
    (selectedItem as any)?.type?.startsWith('generic.chart.') ||
    (selectedItem as any)?.type?.endsWith('.square') ||
    (selectedItem as any)?.type?.endsWith('.circle') ||
    (selectedItem as any)?.type?.endsWith('.point') ||
    (selectedItem as any)?.type?.endsWith('.rectangle') ||
    (selectedItem as any)?.type?.endsWith('.rounded-rectangle') ||
    (selectedItem as any)?.type?.endsWith('.progress-bar') ||
    (selectedItem as any)?.type?.endsWith('.timeline-bar') ||
    (selectedItem as any)?.type?.endsWith('.text-box-heading') ||
    (selectedItem as any)?.type?.endsWith('.triangle') ||
    (selectedItem as any)?.type?.endsWith('.star') ||
    (selectedItem as any)?.type?.endsWith('.cloud') ||
    (selectedItem as any)?.type?.endsWith('.parallelogram') ||
    (selectedItem as any)?.type?.endsWith('.trapezoid') ||
    (selectedItem as any)?.type?.endsWith('.kite') ||
    (selectedItem as any)?.type?.endsWith('.hexagon') ||
    (selectedItem as any)?.type?.endsWith('.pentagon') ||
    (selectedItem as any)?.type?.endsWith('.octagon') ||
    (selectedItem as any)?.type?.endsWith('.jigsaw') ||
    (selectedItem as any)?.type?.endsWith('.arrowhead') ||
    (selectedItem as any)?.type?.endsWith('.chevron') ||
    (selectedItem as any)?.type?.endsWith('.timeline') ||
    (selectedItem as any)?.type?.endsWith('.mind-map-node')
  );
  const isLineNode = isNode && isConnectorLineNodeType((selectedItem as any)?.type);
  const isTimelineNode = isNode && isTimelineNodeType((selectedItem as any)?.type);
  const showSpineLineStyling = isLineNode || isTimelineNode;
  const isClosedConnectorLine = useMemo(() => {
    if (!isLineNode || !diagramData || !selectedItem?.id) return false;
    const n = diagramData.nodes.find((nn) => nn.id === selectedItem.id);
    if (!n) return false;
    return isConnectorLineGeometryClosed(n as DiagramNodeData);
  }, [isLineNode, diagramData, selectedItem?.id]);
  const isUmlClassNode = isNode && ((selectedItem as any)?.type === 'generic.object.uml-class' || (selectedItem as any)?.type?.endsWith('.uml-class'));

  const getCurrentUmlClassTextStyling = useMemo(() => {
    if (!selectedItem || !isUmlClassNode) return {};
    let item = selectedItem;
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData) {
      const found = diagramData.nodes.find(n => n.id === selectedItem.id);
      item = found ? { ...found, itemType: 'node' as const } : selectedItem;
    }
    return extractUmlClassTextStylingFromNode(item as any);
  }, [selectedItem, isUmlClassNode, selectedItemIds, diagramData]);

  const getCurrentTextStyling = useMemo(() => {
    if (!selectedItem || !diagramData) return {};
    let currentItem = selectedItem;
    if (selectedItemIds && selectedItemIds.size > 1) {
      if (isNode) {
        const foundNode = diagramData.nodes.find(n => n.id === selectedItem.id);
        currentItem = foundNode ? { ...foundNode, itemType: 'node' as const } : selectedItem;
      }
    }
    if (isNode) {
      return extractTextStylingFromNode(currentItem as any);
    }
    return {};
  }, [selectedItem, isNode, selectedItemIds, diagramData]);

  const getCurrentVisualStyling = useMemo(() => {
    if (!selectedItem || !diagramData) return {};
    let currentItem = selectedItem;
    if (isNode) {
      const foundNode = diagramData.nodes.find((n) => n.id === selectedItem.id);
      currentItem = foundNode ? { ...foundNode, itemType: 'node' as const } : selectedItem;
    }
    if (isNode) {
      return extractVisualStylingFromNode(currentItem as any);
    }
    return {};
  }, [selectedItem, isNode, diagramData]);

  const getCurrentLineStyling = useMemo(() => {
    if (!selectedItem || !diagramData) return {};
    if (!isNode || (!isLineNode && !isTimelineNode)) return {};
    let currentItem = selectedItem;
    if (selectedItemIds && selectedItemIds.size > 1) {
      const foundNode = diagramData.nodes.find(n => n.id === selectedItem.id);
      currentItem = foundNode ? { ...foundNode, itemType: 'node' as const } : selectedItem;
    }
    return extractLineStylingFromNode(currentItem as any);
  }, [selectedItem, isNode, isLineNode, isTimelineNode, selectedItemIds, diagramData]);

  const getAllConnections = useMemo(() => {
    if (!selectedItem || !diagramData) return [];
    const itemId = selectedItem.id;
    const nodesById = new Map(diagramData.nodes.map(n => [n.id, n]));
    const zonesById = new Map((diagramData.zones || []).map(zone => [zone.id, zone]));
    const allConnections = (diagramData.connections || []).filter((edge: any) =>
      edge.from === itemId || edge.to === itemId
    ).map((edge: any) => {
      const isOutgoing = edge.from === itemId;
      const targetId = isOutgoing ? edge.to : edge.from;
      const targetItem = nodesById.get(targetId) || zonesById.get(targetId);
      const targetLabel = targetItem?.label || targetId;
      return {
        connection: edge,
        targetId,
        targetLabel,
        isOutgoing,
        direction: isOutgoing ? '→' : '←'
      };
    });
    return allConnections;
  }, [selectedItem, diagramData]);

  const connectionExpandKeys = useMemo(
    () =>
      getAllConnections.map((connInfo, index) => {
        const cid = (connInfo.connection as DiagramConnectionData).id;
        return cid ?? `${connInfo.connection.from}-${connInfo.connection.to}-${index}`;
      }),
    [getAllConnections]
  );

  const prevConnectionsNodeIdRef = useRef<string | undefined>(undefined);
  const prevConnectionsCountRef = useRef<number | null>(null);

  useEffect(() => {
    const nodeId = selectedItem?.itemType !== 'edge' ? selectedItem?.id : undefined;
    const len = connectionExpandKeys.length;
    const keys = connectionExpandKeys;

    if (!nodeId || len === 0) {
      if (len === 0) setExpandedConnectionKeys(new Set());
      prevConnectionsNodeIdRef.current = nodeId;
      prevConnectionsCountRef.current = len;
      return;
    }

    const nodeChanged = prevConnectionsNodeIdRef.current !== nodeId;
    const prevCount = prevConnectionsCountRef.current;

    if (nodeChanged) {
      if (len === 1) {
        setExpandedConnectionKeys(new Set([keys[0]]));
      } else {
        setExpandedConnectionKeys(new Set());
      }
      prevConnectionsNodeIdRef.current = nodeId;
      prevConnectionsCountRef.current = len;
      return;
    }

    if (prevCount !== null) {
      if (prevCount === 1 && len >= 2) {
        setExpandedConnectionKeys(new Set());
      } else if (prevCount >= 2 && len === 1) {
        setExpandedConnectionKeys(new Set([keys[0]]));
      }
    }
    prevConnectionsCountRef.current = len;
  }, [selectedItem?.id, selectedItem?.itemType, connectionExpandKeys]);

  const handleBulkConnectionAnimationApply = useCallback((sourceId: string, direction: 'outbound' | 'inbound', animation: DiagramConnectionData['animation']) => {
    if (!diagramData || !onDiagramDataUpdate) return;
    const animationPatch = toConnectionAnimationPatch(animation);
    onDiagramDataUpdate({
      ...diagramData,
      connections: (diagramData.connections || []).map((conn) => {
        const shouldApply = direction === 'outbound' ? conn.from === sourceId : conn.to === sourceId;
        if (!shouldApply) return conn;
        return {
          ...conn,
          animation: animationPatch,
        };
      }),
    });
  }, [diagramData, onDiagramDataUpdate]);

  const commitTagChange = useCallback((valueFromDom?: string) => {
    const value = valueFromDom ?? tagDraft;
    const item = selectedItem;
    if (!item || (item as { itemType: string }).itemType === 'edge') return;
    if (value === ((item as { tag?: string }).tag || '')) return;
    const multi = (selectedItemIds?.size ?? 0) > 1;
    if (multi && onBulkMetadataUpdate) {
      onBulkMetadataUpdate({ tag: value });
    } else {
      onItemUpdate?.({ ...item, tag: value } as SelectedItem);
    }
  }, [tagDraft, selectedItem, selectedItemIds, onItemUpdate, onBulkMetadataUpdate]);

  const commitInfoChange = useCallback((valueFromDom?: string) => {
    const value = valueFromDom ?? descriptionDraft;
    const item = selectedItem;
    if (!item || (item as { itemType: string }).itemType === 'edge') return;
    if (value !== ((item as { info?: string }).info || '')) {
      const multi = (selectedItemIds?.size ?? 0) > 1;
      if (multi && onBulkMetadataUpdate) {
        onBulkMetadataUpdate({ info: value });
      } else {
        onItemUpdate?.({ ...item, info: value } as SelectedItem);
      }
    }
  }, [descriptionDraft, selectedItem, selectedItemIds, onItemUpdate, onBulkMetadataUpdate]);

  const handleOpenNodeLink = useCallback(() => {
    if (!selectedItem || selectedItem.itemType !== 'node') return;
    const rawUrl = (selectedItem as { linkUrl?: string }).linkUrl;
    const normalized = normalizeExternalUrl(rawUrl);
    if (!normalized) {
      toast({
        variant: 'destructive',
        title: 'No valid URL',
        description: 'Add a valid URL in the Properties panel first.',
      });
      return;
    }

    openExternalUrlInNewTab(normalized);
  }, [selectedItem, toast]);

  if (!selectedItem) {
    return null;
  }

  // Handle edge/connection selection
  if (selectedItem.itemType === 'edge') {
    const isEdge = selectedItem.itemType === 'edge';
    const hasArrow = selectedItem.arrow === true || selectedItem.toArrow === true;
    const lineStyle = (selectedItem as any).style ?? 'bezier';
    const smoothCorners = lineStyle === 'orthogonal' && (selectedItem as any).smoothCorners === true;

    const handleArrowToggle = () => {
      if (onConnectionUpdate && isEdge) {
        const connId = (selectedItem as { id?: string }).id;
        onConnectionUpdate(selectedItem.from, selectedItem.to, {
          arrow: !hasArrow,
          toArrow: !hasArrow
        }, connId);
      }
    };

    const handleLineStyleChange = (style: 'bezier' | 'orthogonal') => {
      if (onConnectionUpdate && isEdge) {
        const connId = (selectedItem as { id?: string }).id;
        onConnectionUpdate(selectedItem.from, selectedItem.to, { style }, connId);
      }
    };

    const handleSmoothCornersToggle = () => {
      if (onConnectionUpdate && isEdge) {
        const connId = (selectedItem as { id?: string }).id;
        onConnectionUpdate(selectedItem.from, selectedItem.to, { smoothCorners: !smoothCorners }, connId);
      }
    };

    const waypoints = (selectedItem as any).waypoints ?? [];
    const canAddWaypoint = !!onConnectionWaypointAdd && !isReadOnly;
    const canRemoveWaypoint = !!onConnectionWaypointRemove && !isReadOnly;

    return (
      <div className="flex items-center gap-1 px-2 border-l border-border min-h-[2.5rem] shrink-0">
        {/* Line Type Toggle */}
        <div className="flex gap-0.5">
          <Button
            variant={lineStyle === 'bezier' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => handleLineStyleChange('bezier')}
            title="Curved line"
          >
            <span className="text-xs">Curved</span>
          </Button>
          <Button
            variant={lineStyle === 'orthogonal' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => handleLineStyleChange('orthogonal')}
            title="Orthogonal line"
          >
            <span className="text-xs">Orthogonal</span>
          </Button>
        </div>

        {lineStyle === 'orthogonal' && (
          <Button
            variant={smoothCorners ? "default" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={handleSmoothCornersToggle}
            title={smoothCorners ? "Disable smooth corners" : "Enable smooth corners"}
          >
            <span className="text-xs">Smooth corners</span>
          </Button>
        )}

        {/* Arrow Toggle Button */}
        <Button
          variant={hasArrow ? "default" : "ghost"}
          size="sm"
          className="h-8 px-2"
          onClick={handleArrowToggle}
          title={hasArrow ? "Hide Arrow" : "Show Arrow"}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>

        {/* Add Waypoint - click to add a waypoint for routing connection around obstacles (bezier only) */}
        {canAddWaypoint && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => onConnectionWaypointAdd?.(selectedItem.from, selectedItem.to, (selectedItem as { id?: string }).id)}
            title="Add waypoint to route connection around obstacles"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}

        {/* Waypoints list with remove */}
        {waypoints.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2" title={`${waypoints.length} waypoint(s)`}>
                <GripHorizontal className="h-4 w-4" />
                <span className="text-xs ml-1">{waypoints.length}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="text-xs text-muted-foreground mb-2">Waypoints — drag on canvas to move</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {waypoints.map((wp: { x: number; y: number; id?: string }, idx: number) => (
                  <div key={wp.id ?? idx} className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-accent/50">
                    <span className="text-xs font-mono truncate">Waypoint {idx + 1}</span>
                    {canRemoveWaypoint && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => onConnectionWaypointRemove?.(selectedItem.from, selectedItem.to, idx, (selectedItem as { id?: string }).id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Presentation: Add/Remove from later slides (for connections) */}
        {presentationHasLaterSlides && onPropagateAddToLaterSlides && onPropagateDeleteToLaterSlides && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPropagateAddToLaterSlides} title="Add to later slides">
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add to later slides</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPropagateDeleteToLaterSlides} title="Remove from later slides">
                  <SquareMinus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove from later slides</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    );
  }

  const handleMaxItemsPerRowChange = (value: number) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply maxItemsPerRow change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update zones (only zones have maxItemsPerRow)
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, maxItemsPerRow: value };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, maxItemsPerRow: value } as SelectedItem);
    }
  };

  const handleSizeModeChange = (value: 'auto' | 'custom') => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply sizeMode change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update zones (only zones have sizeMode)
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            const updatedZone = { ...zone, sizeMode: value };
            // Set default dimensions if switching to custom without existing dimensions
            if (value === 'custom' && !zone.width && !zone.height) {
              (updatedZone as any).width = 300;
              (updatedZone as any).height = 220;
            }
            return updatedZone;
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      const updatedItem = { ...selectedItem, sizeMode: value } as SelectedItem;
      if (value === 'custom' && !(selectedItem as any).width && !(selectedItem as any).height) {
        (updatedItem as any).width = 40;
        (updatedItem as any).height = 40;
      }
      onItemUpdate?.(updatedItem);
    }
  };

  const handleWidthChange = (value: number) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply width change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, width: value };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, width: value };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, width: value } as SelectedItem);
    }
  };

  const handleHeightChange = (value: number) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply height change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, height: value };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, height: value };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, height: value } as SelectedItem);
    }
  };

  const handleRotationChange = (value: string) => {
    const rotationValue = parseInt(value);
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply rotation change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, rotation: rotationValue };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, rotation: rotationValue };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, rotation: rotationValue } as SelectedItem);
    }
  };



  const handleOrientationChange = (value: 'square' | 'horizontal' | 'vertical') => {
    onItemUpdate?.({ ...selectedItem, orientation: value } as SelectedItem);
  };

  const handleTextPositionChange = (value: string) => {
    onItemUpdate?.({ ...selectedItem, textPosition: value as any } as SelectedItem);
  };

  const handleShapeTextPlacementChange = (value: 'above' | 'center' | 'under') => {
    onItemUpdate?.({ ...selectedItem, textPosition: value } as SelectedItem);
  };

  const toggleNoIconBackground = () => {
    if (!selectedItem) return;
    
    if (selectedItemIds && selectedItemIds.size > 1) {
      // Apply to multiple selected items
      const newNoIconBackgroundValue = !(selectedItem as any).noIconBackground;
      
      // Update all selected items in the diagram data
      if (diagramData && onDiagramDataUpdate) {
        const updatedDiagramData = {
          ...diagramData,
          nodes: diagramData.nodes.map((node: any) => {
            if (selectedItemIds.has(node.id)) {
              return { ...node, noIconBackground: newNoIconBackgroundValue };
            }
            return node;
          }),
          zones: diagramData.zones?.map((zone: any) => {
            if (selectedItemIds.has(zone.id)) {
              return { ...zone, noIconBackground: newNoIconBackgroundValue };
            }
            return zone;
          })
        };
        onDiagramDataUpdate(updatedDiagramData);
      }
    } else {
      // Apply to single selected item
      onItemUpdate?.({ ...selectedItem, noIconBackground: !(selectedItem as any).noIconBackground } as any);
    }
  };

  const handleTextStylingChange = (styling: any) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply styling change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return applyTextStylingToNode(node, styling);
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return applyTextStylingToZone(zone, styling) as DiagramZoneData;
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      if (isNode) {
        // Use applyTextStylingToNode to properly merge styling for nodes
        const updatedNode = applyTextStylingToNode(selectedItem as any, styling);
        onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
      } else {
        onItemUpdate?.({ ...selectedItem as SelectedItem, ...styling } as SelectedItem);
      }
    }
  };

  const handleUmlClassTextStylingChange = (styling: any) => {
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      const updated = { ...diagramData };
      updated.nodes = updated.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return applyUmlClassTextStylingToNode(node, styling);
        }
        return node;
      });
      onDiagramDataUpdate(updated);
    } else if (isNode) {
      const updatedNode = applyUmlClassTextStylingToNode(selectedItem as any, styling);
      onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
    }
  };

  const handleUmlClassTextStylingReset = () => {
    handleUmlClassTextStylingChange(DEFAULT_UML_CLASS_TEXT_STYLING);
  };

  const handleTextStylingReset = () => {
    // Reset to default text styling
    const defaultStyling = {
      fontFamily: undefined,
      fontSize: undefined,
      fontWeight: undefined,
      fontStyle: undefined,
      textDecoration: undefined,
      textTransform: undefined,
      letterSpacing: undefined,
      lineHeight: undefined,
      textOpacity: undefined,
      textColor: undefined,
      textOutlineWidth: undefined,
      textOutlineColor: undefined,
      textGlowBlur: undefined,
      textGlowColor: undefined,
      textShadowOffsetX: undefined,
      textShadowOffsetY: undefined,
      textShadowBlur: undefined,
      textShadowColor: undefined,
      textDropShadowEnabled: undefined,
      headingTextColor: undefined
    };
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply reset to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return applyTextStylingToNode(node, defaultStyling);
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return applyTextStylingToZone(zone, defaultStyling) as DiagramZoneData;
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem as SelectedItem, ...defaultStyling } as SelectedItem);
    }
  };

  const handleVisualStylingChange = (styling: any) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply styling change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          const merged = { ...node } as Record<string, unknown>;
          for (const [k, v] of Object.entries(styling)) {
            if (v === null) delete merged[k];
            else if (v !== undefined) merged[k] = v;
          }
          return syncClosedConnectorLineBorderWidth(merged as unknown as DiagramNodeData);
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (!selectedItemIds.has(zone.id)) return zone;
          const merged = { ...zone } as Record<string, unknown>;
          for (const [k, v] of Object.entries(styling)) {
            if (v === null) delete merged[k];
            else if (v !== undefined) merged[k] = v;
          }
          return merged as unknown as typeof zone;
        });
      }
      
      updatedDiagramData.nodes = applyMindmapHueAnchorsAfterVisualChanges(
        diagramData.nodes,
        updatedDiagramData.nodes,
        selectedItemIds,
      );

      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      const merged = { ...selectedItem } as Record<string, unknown>;
      for (const [k, v] of Object.entries(styling)) {
        if (v === null) delete merged[k];
        else if (v !== undefined) merged[k] = v;
      }
      onItemUpdate?.(syncClosedConnectorLineBorderWidth(merged as unknown as DiagramNodeData) as SelectedItem);
    }
  };

  const handleVisualStylingReset = () => {
    // Reset to default visual styling
    const defaultStyling = {
      borderStyle: undefined,
      borderColor: undefined,
      borderColors: undefined,
      backgroundStyle: undefined,
      backgroundColor: undefined,
      backgroundColors: undefined,
      gradientAngle: undefined,
      shadow: undefined,
      borderWidth: undefined,
      iconColor: undefined,
      nodeSize: undefined,
      headingBackgroundColor: undefined,
      headingBackgroundStyle: undefined,
      highlightAnim: undefined,
      highlightAnimDurationSec: undefined,
      highlightAnimIntervalSec: undefined,
      highlightAnimGlowColor: undefined,
      highlightAnimGlowIntensity: undefined,
      highlightAnimMode: undefined,
      ignoreConnectionAvoidance: undefined,
    };
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply reset to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return syncClosedConnectorLineBorderWidth({ ...node, ...defaultStyling } as DiagramNodeData);
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, ...defaultStyling };
          }
          return zone;
        });
      }
      
      updatedDiagramData.nodes = applyMindmapHueAnchorsAfterVisualChanges(
        diagramData.nodes,
        updatedDiagramData.nodes,
        selectedItemIds,
      );

      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.(
        syncClosedConnectorLineBorderWidth({
          ...selectedItem,
          ...defaultStyling,
        } as DiagramNodeData) as SelectedItem
      );
    }
  };

  const handleLineStylingChange = (styling: any) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply styling change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes (only line nodes)
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id) && isConnectorLikeSpineNodeType(node.type)) {
          return applyLineStylingToNode(node, styling);
        }
        return node;
      });
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - get fresh node data from diagramData to preserve startPos/endPos
      if (isNode && showSpineLineStyling && diagramData) {
        // Get the latest node data from diagramData to ensure we have current startPos/endPos
        const freshNode = diagramData.nodes.find(n => n.id === selectedItem.id);
        const nodeToUpdate = freshNode || selectedItem;
        const updatedNode = applyLineStylingToNode(nodeToUpdate as any, styling);
        onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
    }
  };

  const handleLineStylingReset = () => {
    // Reset to default line styling
    const defaultStyling = {
      lineThickness: undefined,
      startCap: undefined,
      endCap: undefined,
      lineColor: undefined,
      lineColorStyle: undefined,
      lineColors: undefined,
      lineGradientAngle: undefined,
      lineTextVerticalPosition: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      fontWeight: undefined,
      fontStyle: undefined,
      textDecoration: undefined,
      textTransform: undefined,
      letterSpacing: undefined,
      lineHeight: undefined,
      textOpacity: undefined,
      textColor: undefined,
      textOutlineWidth: undefined,
      textOutlineColor: undefined,
      textGlowBlur: undefined,
      textGlowColor: undefined,
      textShadowOffsetX: undefined,
      textShadowOffsetY: undefined,
      textShadowBlur: undefined,
      textShadowColor: undefined,
      textDropShadowEnabled: undefined,
      textJustify: undefined,
      textVerticalPosition: undefined
    };
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply reset to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes (only line nodes)
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id) && isConnectorLikeSpineNodeType(node.type)) {
          return applyLineStylingToNode(node, defaultStyling);
        }
        return node;
      });
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection
      if (isNode && showSpineLineStyling) {
        const updatedNode = applyLineStylingToNode(selectedItem as any, defaultStyling);
        onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
    }
  };

  // Drag and drop handlers for connection reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedConnectionIndex(index);
    // Set drag data to identify the connection
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drag over if we're actually leaving the element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (isNaN(draggedIndex) || draggedIndex === dropIndex) {
      setDraggedConnectionIndex(null);
      return;
    }



    // Get the actual connection objects from the filtered getAllConnections
    const allConnections = getAllConnections;
    if (draggedIndex >= allConnections.length || dropIndex >= allConnections.length) {
      setDraggedConnectionIndex(null);
      return;
    }

    const draggedConnInfo = allConnections[draggedIndex];
    const dropConnInfo = allConnections[dropIndex];
    


    // Reorder connections in the diagram data
    if (diagramData && onDiagramDataUpdate) {
      const newConnections = [...(diagramData.connections || [])];
      

      
      const draggedConnId = (draggedConnInfo.connection as DiagramConnectionData).id;
      const dropConnId = (dropConnInfo.connection as DiagramConnectionData).id;
      const draggedActualIndex = newConnections.findIndex(c =>
        draggedConnId ? (c as DiagramConnectionData).id === draggedConnId
          : (c.from === draggedConnInfo.connection.from && c.to === draggedConnInfo.connection.to)
      );
      const dropActualIndex = newConnections.findIndex(c =>
        dropConnId ? (c as DiagramConnectionData).id === dropConnId
          : (c.from === dropConnInfo.connection.from && c.to === dropConnInfo.connection.to)
      );
      

      
      if (draggedActualIndex !== -1 && dropActualIndex !== -1) {
        const draggedConnection = newConnections[draggedActualIndex];
        newConnections.splice(draggedActualIndex, 1);
        const insertIndex = dropActualIndex > draggedActualIndex ? dropActualIndex - 1 : dropActualIndex;
        newConnections.splice(insertIndex, 0, draggedConnection);
        

        
        // Update the diagram data with reordered connections
        onDiagramDataUpdate({
          ...diagramData,
          connections: newConnections
        });
        
      }
    }
    
    setDraggedConnectionIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedConnectionIndex(null);
    setDragOverIndex(null);
  };

  const isLabelOrTextbox = isTextboxNode;
  // Text type nodes that should hide certain controls
  const isTextTypeNode = isTextNode; // includes all generic.text nodes

  return (
    <TooltipProvider>
      {isReadOnly && selectedItem ? (
        <div className="flex items-center gap-2 px-3 border-l border-border min-h-[2.5rem] shrink-0 bg-muted/30">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{selectedItem.label || 'Unnamed Item'}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {selectedItem.info || 'No description'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground px-2 border-l border-border">
            {selectedItem.itemType === 'node' ? 'Node' : 'Connection'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1 px-2 border-l border-border min-h-[2.5rem] shrink-0">
        {/* Label Editor */}
        <Popover open={labelOpen} onOpenChange={setLabelOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Type className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Label</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={labelInputValue}
                onChange={(e) => handleLabelChange(e.target.value)}
                onBlur={handleLabelBlur}
                onKeyDown={handleLabelKeyDown}
                placeholder="Enter label"
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Tag Editor - Show for all shapes except lines */}
        {isShapeNode && !isLineNode && (
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Tag className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Tag</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tag</label>
                <Input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onBlur={(e) => { commitTagChange((e.target as HTMLInputElement).value); setTagOpen(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitTagChange((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).blur();
                      setTagOpen(false);
                    }
                  }}
                  placeholder="Enter tag"
                />
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Description Editor - Hide for lines */}
        {!isLineNode && (
        <Popover open={descriptionOpen} onOpenChange={setDescriptionOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Description</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                onBlur={(e) => { commitInfoChange((e.target as HTMLTextAreaElement).value); setDescriptionOpen(false); }}
                placeholder="Enter description"
                rows={3}
              />
            </div>
          </PopoverContent>
        </Popover>
        )}

        {/* Open URL in new tab */}
        {isNode && !isLineNode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={handleOpenNodeLink}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open URL</TooltipContent>
          </Tooltip>
        )}

        {/* Connect Button - Hide for connector lines and timeline (no diagram connections) */}
        {isNode && !isLineNode && !isTimelineNode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2" 
                onClick={() => onConnect?.({ style: 'bezier', curvature: 0.6 })}
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connect</TooltipContent>
          </Tooltip>
        )}


        {/* Connections popover — hidden for timeline */}
        {isNode && !isTimelineNode && getAllConnections.length > 0 && (
          <Popover open={connectionsOpen} onOpenChange={setConnectionsOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2"
                  >
                    <ArrowRight className="h-4 w-4" />
                    {getAllConnections.length > 1 && (
                      <span className="ml-1 text-xs">({getAllConnections.length})</span>
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Connections</TooltipContent>
            </Tooltip>
            <PopoverContent ref={connectionsPanelRef} className="w-[min(480px,calc(100vw-2rem))] p-0" align="end" side="bottom">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="font-semibold">Connections</h3>
                  <Button variant="ghost" size="sm" onClick={() => setConnectionsOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2 p-4">
                    {getAllConnections.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">No connections</div>
                    ) : (
                      getAllConnections.map((connInfo, index) => {
                        const fromNode =
                          diagramData?.nodes.find((n) => n.id === connInfo.connection.from) ||
                          diagramData?.zones?.find((z) => z.id === connInfo.connection.from);
                        const toNode =
                          diagramData?.nodes.find((n) => n.id === connInfo.connection.to) ||
                          diagramData?.zones?.find((z) => z.id === connInfo.connection.to);

                        const connId = (connInfo.connection as DiagramConnectionData).id;
                        const connectionRowKey = connId ?? `${connInfo.connection.from}-${connInfo.connection.to}-${index}`;
                        const isConnectionExpanded = expandedConnectionKeys.has(connectionRowKey);
                        const diagramSource = currentDiagramData ?? diagramData;
                        const liveConnection =
                          diagramSource?.connections?.find((c) =>
                            connId ? c.id === connId : c.from === connInfo.connection.from && c.to === connInfo.connection.to
                          ) ?? connInfo.connection;

                        const hasArrow = liveConnection.arrow === true || liveConnection.toArrow === true;
                        const connectionLineStyle = liveConnection.style ?? 'bezier';
                        const strokePattern = liveConnection.lineType ?? 'solid';
                        const connectionSmoothCorners =
                          connectionLineStyle === 'orthogonal' && liveConnection.smoothCorners === true;

                        const connectionColor = resolveBezierConnectionPaint(
                          liveConnection,
                          liveConnection.color,
                          (fromNode ?? {}) as ConnectionEndpointOutline,
                          (toNode ?? {}) as { lineColor?: string }
                        ).cStart;

                        const textPosition = liveConnection.textPosition ?? 50;
                        const connectionText = liveConnection.text || '';
                        const handleConnectionArrowToggle = () => {
                          if (onConnectionUpdate) {
                            onConnectionUpdate(
                              connInfo.connection.from,
                              connInfo.connection.to,
                              { arrow: !hasArrow, toArrow: !hasArrow },
                              connId
                            );
                          }
                        };

                        const handleTextPositionChange = (value: number) => {
                          if (onConnectionUpdate) {
                            onConnectionUpdate(
                              connInfo.connection.from,
                              connInfo.connection.to,
                              { textPosition: value },
                              connId
                            );
                          }
                        };

                        const displayConnectionText = (connectionTextDrafts[connId ?? ''] ?? connectionText);
                        const commitConnectionText = (valueFromDom?: string) => {
                          const value = valueFromDom ?? connectionTextDrafts[connId ?? ''] ?? connectionText;
                          if (value !== connectionText && onConnectionUpdate) {
                            onConnectionUpdate(
                              connInfo.connection.from,
                              connInfo.connection.to,
                              { text: value },
                              connId
                            );
                            setConnectionTextDrafts((d) => {
                              const next = { ...d };
                              if (connId) delete next[connId];
                              return next;
                            });
                          }
                        };

                        return (
                          <div 
                            key={`${connInfo.connection.from}-${connInfo.connection.to}-${index}`}
                            className={`flex flex-col gap-2 p-2 rounded-md border transition-all ${
                              dragOverIndex === index 
                                ? 'border-primary bg-primary/10 scale-105' 
                                : 'border-border hover:bg-accent/20'
                            } ${draggedConnectionIndex === index ? 'opacity-50' : ''}`}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <div 
                                className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent/50 rounded shrink-0"
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, index);
                                }}
                                onDragEnd={(e) => {
                                  e.stopPropagation();
                                  handleDragEnd(e);
                                }}
                              >
                                <GripHorizontal className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <button
                                type="button"
                                className={cn(
                                  "flex flex-1 min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none",
                                  "hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                                )}
                                onClick={() => toggleConnectionExpanded(connectionRowKey)}
                                aria-expanded={isConnectionExpanded}
                                aria-controls={`connection-details-${connectionRowKey}`}
                                id={`connection-summary-${connectionRowKey}`}
                              >
                                <span className="text-xs font-mono text-muted-foreground shrink-0">
                                  {connInfo.isOutgoing ? '→' : '←'}
                                </span>
                                <span className="text-sm font-medium truncate flex-1" title={connInfo.targetLabel}>
                                  {connInfo.targetLabel || connInfo.targetId}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                    isConnectionExpanded && "rotate-180"
                                  )}
                                  aria-hidden
                                />
                              </button>
                            </div>
                            {isConnectionExpanded && (
                            <div
                              id={`connection-details-${connectionRowKey}`}
                              role="region"
                              aria-labelledby={`connection-summary-${connectionRowKey}`}
                              className="flex flex-col gap-3 pt-2 border-t border-border/50"
                            >
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                              <div className="space-y-2.5 min-w-0">
                                <div className="flex items-start gap-3">
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <Label className="text-xs font-medium">Line type</Label>
                                    <div className="flex flex-wrap gap-1">
                                      <Button
                                        variant={connectionLineStyle === 'bezier' ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 px-2 text-xs"
                                        onClick={() => onConnectionUpdate?.(connInfo.connection.from, connInfo.connection.to, { style: 'bezier' }, connId)}
                                      >
                                        Curved
                                      </Button>
                                      <Button
                                        variant={connectionLineStyle === 'orthogonal' ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 px-2 text-xs"
                                        onClick={() => onConnectionUpdate?.(connInfo.connection.from, connInfo.connection.to, { style: 'orthogonal' }, connId)}
                                      >
                                        Orthogonal
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="shrink-0 space-y-1.5">
                                    <Label className="text-xs font-medium">Arrow</Label>
                                    <div className="flex flex-wrap gap-1">
                                      <Button
                                        variant={hasArrow ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={handleConnectionArrowToggle}
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
                                      variant={strokePattern === 'solid' ? 'default' : 'outline'}
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => onConnectionUpdate?.(connInfo.connection.from, connInfo.connection.to, { lineType: 'solid' }, connId)}
                                    >
                                      Solid
                                    </Button>
                                    <Button
                                      variant={strokePattern === 'dashed' ? 'default' : 'outline'}
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => onConnectionUpdate?.(connInfo.connection.from, connInfo.connection.to, { lineType: 'dashed' }, connId)}
                                    >
                                      Dashed
                                    </Button>
                                    <Button
                                      variant={strokePattern === 'dotted' ? 'default' : 'outline'}
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => onConnectionUpdate?.(connInfo.connection.from, connInfo.connection.to, { lineType: 'dotted' }, connId)}
                                    >
                                      Dotted
                                    </Button>
                                  </div>
                                </div>

                                <ConnectionLineStyleFields
                                  liveConnection={liveConnection}
                                  resolvedConnectionColor={connectionColor}
                                  from={connInfo.connection.from}
                                  to={connInfo.connection.to}
                                  connectionId={connId}
                                  onConnectionUpdate={(from, to, updates, cid) =>
                                    onConnectionUpdate?.(from, to, updates, cid)
                                  }
                                  isReadOnly={isReadOnly}
                                  debounceColorMs={150}
                                />

                                {connectionLineStyle === 'orthogonal' && (
                                  <div className="space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <Label className="text-xs font-medium">Smooth corners</Label>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                          Add a small rounded bend at each 90-degree turn
                                        </p>
                                      </div>
                                      <Switch
                                        checked={connectionSmoothCorners}
                                        onCheckedChange={(checked: boolean) =>
                                          onConnectionUpdate?.(connInfo.connection.from, connInfo.connection.to, { smoothCorners: checked }, connId)
                                        }
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
                                      checked={liveConnection.centerEdgeAnchors === true}
                                      onCheckedChange={(checked: boolean) =>
                                        onConnectionUpdate?.(
                                          connInfo.connection.from,
                                          connInfo.connection.to,
                                          { centerEdgeAnchors: checked },
                                          connId
                                        )
                                      }
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
                                            variant={liveConnection.edgeAttachmentConstraint === 'top-bottom' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            disabled={isReadOnly}
                                            aria-pressed={liveConnection.edgeAttachmentConstraint === 'top-bottom'}
                                            aria-label="Top and bottom edges only"
                                            onClick={() =>
                                              onConnectionUpdate?.(
                                                connInfo.connection.from,
                                                connInfo.connection.to,
                                                liveConnection.edgeAttachmentConstraint === 'top-bottom'
                                                  ? { edgeAttachmentConstraint: undefined }
                                                  : { edgeAttachmentConstraint: 'top-bottom' },
                                                connId
                                              )
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
                                            variant={liveConnection.edgeAttachmentConstraint === 'left-right' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            disabled={isReadOnly}
                                            aria-pressed={liveConnection.edgeAttachmentConstraint === 'left-right'}
                                            aria-label="Left and right edges only"
                                            onClick={() =>
                                              onConnectionUpdate?.(
                                                connInfo.connection.from,
                                                connInfo.connection.to,
                                                liveConnection.edgeAttachmentConstraint === 'left-right'
                                                  ? { edgeAttachmentConstraint: undefined }
                                                  : { edgeAttachmentConstraint: 'left-right' },
                                                connId
                                              )
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
                              </div>

                              <div className="space-y-2.5 min-w-0 border-l border-border pl-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`toolbar-conn-text-${connectionRowKey}`} className="text-xs font-medium">
                                    Text
                                  </Label>
                                  <Input
                                    id={`toolbar-conn-text-${connectionRowKey}`}
                                    type="text"
                                    value={displayConnectionText}
                                    onChange={(e) => setConnectionTextDrafts((d) => ({ ...d, [connId ?? '']: e.target.value }))}
                                    onBlur={(e) => commitConnectionText((e.target as HTMLInputElement).value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitConnectionText((e.target as HTMLInputElement).value);
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    placeholder="Enter connection text..."
                                    className="h-8 text-xs"
                                    title="Text displayed on connection line"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label htmlFor={`toolbar-conn-tpos-${connectionRowKey}`} className="text-xs font-medium">
                                    Text position: {textPosition}%
                                  </Label>
                                  <div className="flex items-center gap-1.5">
                                    <Slider
                                      id={`toolbar-conn-tpos-${connectionRowKey}`}
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
                                      onChange={(e) => handleTextPositionChange(Math.max(0, Math.min(100, parseInt(e.target.value) || 50)))}
                                      className="h-8 w-14 text-xs text-center shrink-0"
                                      min={0}
                                      max={100}
                                      title="Text position percentage (0-100)"
                                    />
                                    <span className="text-xs text-muted-foreground shrink-0">%</span>
                                  </div>
                                </div>

                                {onConnectionDisconnect && !isReadOnly && (
                                  <div className="flex justify-end pt-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 gap-1.5 px-2.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                                          onClick={() =>
                                            onConnectionDisconnect(
                                              connInfo.connection.from,
                                              connInfo.connection.to,
                                              connId
                                            )
                                          }
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
                              </div>
                            </div>

                            <div className="border-t border-border pt-3 space-y-2">
                              <ConnectionAnimationControls
                                connection={liveConnection}
                                inheritedConnectionColor={connectionColor}
                                onConnectionUpdate={(from, to, updates) => onConnectionUpdate?.(from, to, updates, connId)}
                                onBulkApply={handleBulkConnectionAnimationApply}
                                compact
                                isReadOnly={isReadOnly}
                              />
                            </div>
                            <div className="border-t border-border pt-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs font-medium">Connection points</Label>
                                {onConnectionWaypointAdd && !isReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    onClick={() =>
                                      onConnectionWaypointAdd(
                                        connInfo.connection.from,
                                        connInfo.connection.to,
                                        connId
                                      )
                                    }
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Add
                                  </Button>
                                )}
                              </div>
                              {(liveConnection.waypoints ?? []).length > 0 && (
                                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                  {(liveConnection.waypoints ?? []).map(
                                    (wp: { x: number; y: number; id?: string }, idx: number) => (
                                      <div
                                        key={wp.id ?? idx}
                                        className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-accent/50"
                                      >
                                        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-xs font-mono truncate">Waypoint {idx + 1}</span>
                                        {onConnectionWaypointRemove && !isReadOnly && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                                            onClick={() =>
                                              onConnectionWaypointRemove(
                                                connInfo.connection.from,
                                                connInfo.connection.to,
                                                idx,
                                                connId
                                              )
                                            }
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                            </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
            </PopoverContent>
          </Popover>
        )}



        {/* Text Styling Button */}
        {selectedItem && isNode && !isLineNode && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={textStylingButtonRef}
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => handleTextStylingOpenChange(!textStylingOpen)}
                >
                  <Type className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isUmlClassNode ? 'UML Class Text' : 'Text Styling'}</TooltipContent>
            </Tooltip>
            {textStylingOpen && typeof window !== 'undefined' && createPortal(
              <div 
                ref={textStylingPanelRef}
                className="fixed top-0 left-0 h-screen z-[60]"
                style={{ pointerEvents: 'auto' }}
              >
                {isUmlClassNode ? (
                  <UmlClassTextStylingPanel
                    styling={getCurrentUmlClassTextStyling}
                    onStylingChange={handleUmlClassTextStylingChange}
                    onReset={handleUmlClassTextStylingReset}
                    onClose={() => handleTextStylingOpenChange(false)}
                  />
                ) : (
                  <TextStylingPanel
                    styling={getCurrentTextStyling}
                    onStylingChange={handleTextStylingChange}
                    onReset={handleTextStylingReset}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    textPosition={selectedItem?.textPosition}
                    onTextPositionChange={handleTextPositionChange}
                  />
                )}
              </div>,
              document.body
            )}
          </>
        )}

        {/* Visual Styling Button - shapes and textbox (full), Lucide (Icon Color + Remove bg), resource items (Remove bg only), emojis (Size + Remove bg). Closed connector lines get fill (same as shapes). generic.text.text excluded. */}
        {selectedItem && isNode && (!isLineNode || isClosedConnectorLine) && (() => {
          const t = (selectedItem as any)?.type || '';
          const isEmoji = t.startsWith('generic.emoji.');
          const isShape = isShapeNodeType(t);
          const isTextbox = t === 'generic.text.textbox';
          const isLucide = t.startsWith('generic.icon.') || (selectedItem as any)?.iconType === 'lucide';
          const isText = t.startsWith('generic.text.');
          const isResourceItem = !isShape && !isText;
          const closedLineFill = isLineNode && isClosedConnectorLine;
          return isShape || isTextbox || isLucide || isResourceItem || isEmoji || closedLineFill;
        })() && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={visualStylingButtonRef}
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => handleVisualStylingOpenChange(!visualStylingOpen)}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visual Styling</TooltipContent>
            </Tooltip>
            {visualStylingOpen && typeof window !== 'undefined' && createPortal(
              <div 
                ref={visualStylingPanelRef}
                className="fixed top-0 left-0 h-screen z-[60]"
                style={{ pointerEvents: 'auto' }}
              >
                <VisualStylingPanel
                  styling={getCurrentVisualStyling}
                  onStylingChange={handleVisualStylingChange}
                  onReset={handleVisualStylingReset}
                  selectedItemIds={selectedItemIds}
                  tag={(selectedItem as any)?.tag}
                  tagPosition={(selectedItem as any)?.tagPosition}
                  onTagChange={(tag) => {
                    const multi = (selectedItemIds?.size ?? 0) > 1;
                    if (multi && onBulkMetadataUpdate) {
                      onBulkMetadataUpdate({ tag });
                    } else {
                      onItemUpdate?.({ ...selectedItem, tag } as SelectedItem);
                    }
                  }}
                  onTagPositionChange={(tagPosition) => onItemUpdate?.({ ...selectedItem, tagPosition } as SelectedItem)}
                  isLucideIcon={(selectedItem as any)?.type?.startsWith?.('generic.icon.') || (selectedItem as any)?.iconType === 'lucide'}
                  showRemoveBackground={(() => {
                    const t = (selectedItem as any)?.type || '';
                    const isShape = isShapeNodeType(t);
                    const isText = t.startsWith('generic.text.');
                    const isLucide = t.startsWith('generic.icon.') || (selectedItem as any)?.iconType === 'lucide';
                    const isEmoji = t.startsWith('generic.emoji.') || (selectedItem as any)?.iconType === 'emoji';
                    const isResourceItem = !isShape && !isText;
                    return isLucide || isResourceItem || isEmoji;
                  })()}
                  showFullStyling={(() => {
                    const t = (selectedItem as any)?.type || '';
                    const isShape = isShapeNodeType(t);
                    const isTextbox = t === 'generic.text.textbox';
                    const closedLineFill = isLineNode && isClosedConnectorLine;
                    return isShape || isTextbox || closedLineFill;
                  })()}
                  isShape={(() => {
                    const t = (selectedItem as any)?.type || '';
                    const closedLineFill = isLineNode && isClosedConnectorLine;
                    return isShapeNodeType(t) || closedLineFill;
                  })()}
                  isRoundedRectangle={
                    (selectedItem as any)?.type === 'generic.object.rounded-rectangle' ||
                    (selectedItem as any)?.type === 'generic.object.mind-map-node' ||
                    (selectedItem as any)?.type?.endsWith?.('.rounded-rectangle') ||
                    (selectedItem as any)?.type?.endsWith?.('.mind-map-node')
                  }
                  isTextBoxHeading={
                    (selectedItem as any)?.type === 'generic.object.text-box-heading' ||
                    (selectedItem as any)?.type?.endsWith?.('.text-box-heading')
                  }
                  isProgressBar={
                    (selectedItem as any)?.type === 'generic.object.progress-bar' ||
                    (selectedItem as any)?.type?.endsWith?.('.progress-bar')
                  }
                  isTimelineBar={
                    (selectedItem as any)?.type === 'generic.object.timeline-bar' ||
                    (selectedItem as any)?.type?.endsWith?.('.timeline-bar')
                  }
                  noIconBackground={(() => {
                    if (!selectedItem || !diagramData) return false;
                    const item = selectedItemIds && selectedItemIds.size > 1
                      ? diagramData.nodes.find(n => n.id === selectedItem.id) || selectedItem
                      : selectedItem;
                    return !!(item as any)?.noIconBackground;
                  })()}
                />
              </div>,
              document.body
            )}
          </>
        )}

        {/* Line Styling Button - Only for line nodes */}
        {selectedItem && showSpineLineStyling && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={lineStylingButtonRef}
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => handleLineStylingOpenChange(!lineStylingOpen)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Line Styling</TooltipContent>
            </Tooltip>
            {lineStylingOpen && typeof window !== 'undefined' && createPortal(
              <div 
                ref={lineStylingPanelRef}
                className="fixed top-0 left-0 h-screen z-[60]"
                style={{ pointerEvents: 'auto' }}
              >
                <LineStylingPanel
                  styling={getCurrentLineStyling}
                  onStylingChange={handleLineStylingChange}
                  onReset={handleLineStylingReset}
                  selectedItem={selectedItem}
                  selectedItemIds={selectedItemIds}
                  onClose={() => handleLineStylingOpenChange(false)}
                />
              </div>,
              document.body
            )}
          </>
        )}



        {/* Text Placement for Shapes */}
        {isShapeNode && !isLineNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignVerticalJustifyCenter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Placement</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Placement</label>
                <Select
                  value={(selectedItem as any).textPosition || 'under'}
                  onValueChange={handleShapeTextPlacementChange}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">
                      <div className="flex items-center gap-2">
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                        <span>Above</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="center">
                      <div className="flex items-center gap-2">
                        <AlignVerticalJustifyCenter className="h-4 w-4" />
                        <span>Middle</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="under">
                      <div className="flex items-center gap-2">
                        <AlignVerticalJustifyEnd className="h-4 w-4" />
                        <span>Below</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Line Endpoint Controls */}
        {/* Line Endpoints - Hide for lines (endpoints are controlled via handles on canvas) */}
        {false && isLineNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <polygon points="20,12 16,10 16,14" fill="currentColor" />
                    </svg>
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Line Endpoints</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Cap</label>
                  <Select
                    value={(selectedItem as any).startCap || 'none'}
                    onValueChange={(value) => {
                      onItemUpdate?.({ 
                        ...selectedItem, 
                        startCap: value as 'none' | 'arrow' | 'dot' | 'square'
                      } as SelectedItem);
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="arrow">Arrow</SelectItem>
                      <SelectItem value="dot">Dot</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Cap</label>
                  <Select
                    value={(selectedItem as any).endCap || 'arrow'}
                    onValueChange={(value) => {
                      onItemUpdate?.({ 
                        ...selectedItem, 
                        endCap: value as 'none' | 'arrow' | 'dot' | 'square'
                      } as SelectedItem);
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="arrow">Arrow</SelectItem>
                      <SelectItem value="dot">Dot</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Line Thickness</label>
                  <input
                    type="number"
                    className="w-full h-8 px-2 rounded border"
                    value={(selectedItem as any).lineThickness || 2.5}
                    min={0.5}
                    max={10}
                    step={0.5}
                    onChange={(e) => {
                      const thickness = parseFloat(e.target.value);
                      if (!isNaN(thickness)) {
                        onItemUpdate?.({ 
                          ...selectedItem, 
                          lineThickness: thickness
                        } as SelectedItem);
                      }
                    }}
                  />
                </div>
                
                {/* Text Position Controls */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Text Position</label>
                  <Select
                    value={(selectedItem as any).lineTextVerticalPosition || 'middle'}
                    onValueChange={(value: 'above' | 'below' | 'middle') => {
                      onItemUpdate?.({
                        ...selectedItem,
                        lineTextVerticalPosition: value
                      } as SelectedItem);
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above Line</SelectItem>
                      <SelectItem value="middle">On Line</SelectItem>
                      <SelectItem value="below">Below Line</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Text Position Along Line (%)</label>
                  <input
                    type="number"
                    className="w-full h-8 px-2 rounded border"
                    value={(selectedItem as any).lineTextPosition || 50}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 50));
                      onItemUpdate?.({
                        ...selectedItem,
                        lineTextPosition: value
                      } as SelectedItem);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">0% = start, 50% = middle, 100% = end</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}









        {/* Orientation (Groups only) - zones removed */}
        {false && selectedItem && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Layout className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Orientation</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Orientation</label>
                <Select 
                  value={((selectedItem as any).orientation as string) || 'square'} 
                  onValueChange={handleOrientationChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Text Position (Groups) */}
        {false && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Position</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Position</label>
                <Select 
                  value={String((selectedItem as any)?.textPosition ?? '')} 
                  onValueChange={handleTextPositionChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="max-h-60 overflow-y-auto">
                      {/* Inline Positions */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Inline (Border)</div>
                      <SelectItem value="inline-top">Inline Top</SelectItem>
                      <SelectItem value="inline-bottom">Inline Bottom</SelectItem>
                      <SelectItem value="inline-left">Inline Left</SelectItem>
                      <SelectItem value="inline-right">Inline Right</SelectItem>
                      
                      {/* Outside Positions */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Outside</div>
                      <SelectItem value="outside-top">Outside Top</SelectItem>
                      <SelectItem value="outside-bottom">Outside Bottom</SelectItem>
                      <SelectItem value="outside-left">Outside Left</SelectItem>
                      <SelectItem value="outside-right">Outside Right</SelectItem>
                      
                      {/* Traditional Positions */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Traditional</div>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-center">Top Center</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-center">Bottom Center</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      
                      {/* Inside Position */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Inside</div>
                      <SelectItem value="inside">Inside Zone</SelectItem>
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Max Items Per Row (Groups) - zones removed */}
        {false && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Max Items Per Row</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Items Per Row</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={(selectedItem as any).maxItemsPerRow || 3}
                  onChange={(e) => handleMaxItemsPerRowChange(parseInt(e.target.value) || 3)}
                  className="h-10"
                />
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Size Mode (Groups and Text Resources) */}
        {(isTextNode || isTextboxNode) && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Size Mode</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sizing Mode</label>
                <Select 
                  value={(selectedItem as any).sizeMode || 'auto'} 
                  onValueChange={handleSizeModeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Fit Content)</SelectItem>
                    <SelectItem value="custom">Custom (Manual Resize)</SelectItem>
                  </SelectContent>
                </Select>
                {(selectedItem as any).sizeMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Width (px)</label>
                      <Input
                        type="number"
                        min="40"
                        step="20"
                        value={(selectedItem as any).width || 40}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || 40)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Height (px)</label>
                      <Input
                        type="number"
                        min="40"
                        step="20"
                        value={(selectedItem as any).height || 40}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || 40)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}



        {/* Rotation (All Nodes and Groups, except lines) */}
        {isNode && !isLineNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Rotation</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rotation</label>
                <Select 
                  value={String((selectedItem as any).rotation || 0)} 
                  onValueChange={handleRotationChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0° (Default)</SelectItem>
                    <SelectItem value="45">45°</SelectItem>
                    <SelectItem value="-45">-45°</SelectItem>
                    <SelectItem value="90">90°</SelectItem>
                    <SelectItem value="-90">-90°</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}




        {/* Remove Icon Background (Non-text, non-shape nodes) */}
        {isNode && !isTextNode && !isShapeNode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={(selectedItem as any).noIconBackground ? "default" : "ghost"} 
                size="sm" 
                className="h-8 px-2"
                onClick={toggleNoIconBackground}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove Icon Background</TooltipContent>
          </Tooltip>
        )}

        {/* Align Objects Button - Show when multiple items are selected */}
        {selectedItemIds && selectedItemIds.size > 1 && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignCenter className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Align Objects</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Vertical Alignment</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('top')}
                  >
                    <AlignVerticalJustifyStart className="h-4 w-4 mr-2" />
                    Align Top
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('v-middle')}
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4 mr-2" />
                    Align Middle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('bottom')}
                  >
                    <AlignVerticalJustifyEnd className="h-4 w-4 mr-2" />
                    Align Bottom
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Horizontal Alignment</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('left')}
                  >
                    <AlignLeft className="h-4 w-4 mr-2" />
                    Align Left
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('h-center')}
                  >
                    <AlignCenter className="h-4 w-4 mr-2" />
                    Align Center
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('right')}
                  >
                    <AlignRight className="h-4 w-4 mr-2" />
                    Align Right
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Distribute</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('distribute-v')}
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4 mr-2" />
                    Vertically
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('distribute-h')}
                  >
                    <AlignCenter className="h-4 w-4 mr-2" />
                    Horizontally
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Rendering Order Controls */}
        {isNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <ArrowUp className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Rendering Order</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rendering Order</label>
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      const data = currentDiagramData ?? diagramData;
                      if (onCurrentDiagramDataUpdate && data) {
                        const { moveItemToFront } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemToFront(data, selectedItem.id, selectedItem.itemType);
                        onCurrentDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Move to Front
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      const data = currentDiagramData ?? diagramData;
                      if (onCurrentDiagramDataUpdate && data) {
                        const { moveItemOneForward } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemOneForward(data, selectedItem.id, selectedItem.itemType);
                        onCurrentDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Move One Forward
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      const data = currentDiagramData ?? diagramData;
                      if (onCurrentDiagramDataUpdate && data) {
                        const { moveItemOneBack } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemOneBack(data, selectedItem.id, selectedItem.itemType);
                        onCurrentDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Move One Back
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      const data = currentDiagramData ?? diagramData;
                      if (onCurrentDiagramDataUpdate && data) {
                        const { moveItemToBack } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemToBack(data, selectedItem.id, selectedItem.itemType);
                        onCurrentDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Move to Back
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Presentation: Add/Remove from later slides */}
        {presentationHasLaterSlides && onPropagateAddToLaterSlides && onPropagateDeleteToLaterSlides && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPropagateAddToLaterSlides} title="Add to later slides">
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add to later slides</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPropagateDeleteToLaterSlides} title="Remove from later slides">
                  <SquareMinus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove from later slides</TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Delete Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
      )}
    </TooltipProvider>
  );
}

