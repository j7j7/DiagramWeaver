"use client";
import React, { useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Panel, Group as PanelGroup } from 'react-resizable-panels';
import { ComponentSidebar } from './editor/component-sidebar';
import { EditorCanvas, type EditorCanvasHandle } from './editor/editor-canvas';
import { ConnectionContextModal } from './editor/connection-context-modal';
import { UmlClassEditorModal } from './editor/uml-class-editor-modal';
import { computeUmlClassDimensions } from '@/lib/uml-utils';
import { JsonEditorPanel } from './editor/json-editor-panel';
import dynamic from 'next/dynamic';

const TopMenuBar = dynamic(() => import('./editor/top-menu-bar').then(mod => ({ default: mod.TopMenuBar })), {
  ssr: false,
  loading: () => <div className="flex items-center border-b bg-card min-h-[2.5rem] overflow-x-auto">
    <div className="flex h-10 items-center space-x-1 rounded-md border bg-background p-1">
      <div className="flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium">Loading...</div>
    </div>
  </div>
});
import { TabBar } from './editor/tab-bar';
import { ExportDialog } from './editor/export-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { DiagramData, DiagramNodeData, DiagramConnectionData } from '@/lib/types';
import { generateSequentialId } from '@/lib/id-generator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDiagramTabs } from '@/hooks/use-diagram-tabs';
import { useLayers } from '@/hooks/use-layers';
import { useLayerAnimation } from '@/hooks/use-layer-animation';
import { flattenDiagramOnImport, type RawDiagramData } from '@/lib/flatten-on-import';
import { DiagramDataSchema } from '@/lib/schemas';
import { parseMermaidFlowchart, parseMermaidClassDiagram, parseMermaidSequenceDiagram, detectMermaidDiagramType } from '@/lib/mermaid-parser';
import { mermaidToDiagramData, classDiagramToDiagramData, sequenceDiagramToDiagramData } from '@/lib/mermaid-to-diagram';
import { themeManager } from '@/lib/theme-manager';
import { DiagramTheme } from '@/lib/theme-types';
import { LayersPanel } from './editor/layers-panel';
import { PropertiesPanel } from './editor/properties-panel';
const ScratchPad = dynamic(() => import('./editor/scratch-pad').then(mod => ({ default: mod.ScratchPad })), {
  ssr: false,
});
import { TutorialProvider, useTutorial } from './tutorial/tutorial-provider';
import { TutorialOverlay } from './tutorial/tutorial-overlay';
import { TooltipProvider } from '@/components/ui/tooltip';
import { 
  createGroup, 
  addToGroup,
  removeFromGroup, 
  ungroup, 
  getItemGroup,
  getGroupMembers,
  handleItemDeletion as cleanupGroupsAfterDeletion
} from '@/lib/grouping-utils';
import { 
  moveItemToBack,
  moveItemToFront,
  moveItemOneBack,
  moveItemOneForward,
  getItemPosition,
  getItemCount
} from '@/lib/rendering-order-utils';
import { performAutoLayout } from '@/lib/auto-layout';
import { generateConnectionId, ensureConnectionIds } from '@/lib/connection-order-utils';
import { snapToGrid } from '@/components/editor/canvas-constants';
import { DEFAULT_CONNECTION_ANIMATION, toConnectionAnimationPatch, getDownstreamAnimationChainNodes } from '@/lib/connection-animation';
import { isEventFromEditableElement } from '@/lib/keyboard-utils';

export type SelectedItem = (
  | (DiagramNodeData & {
      itemType: 'node',
      id: string,
      // Zone styling properties for nodes
      borderColor?: string,
      textColor?: string,
      backgroundColor?: string,
      borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none',
      borderColors?: string[],
      backgroundStyle?: 'solid' | 'gradient' | 'none',
      backgroundColors?: string[],
      gradientAngle?: number,
      shadow?: boolean,
      rotation?: number,
      textPosition?: 'above' | 'center' | 'under',
      textJustify?: 'left' | 'center' | 'right' | 'full',
      textVerticalPosition?: 'top' | 'middle' | 'bottom',
      fontFamily?: string,
      fontSize?: number,
      fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900',
      fontStyle?: 'normal' | 'italic' | 'oblique',
      textDecoration?: 'none' | 'underline' | 'overline' | 'line-through',
      textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize',
      letterSpacing?: number,
      lineHeight?: number,
      textOpacity?: number,
      borderWidth?: number,
      objectStyle?: string,
      width?: number,
      height?: number,
      sizeMode?: 'auto' | 'custom',
      minWidth?: number,
      minHeight?: number,
      orientation?: 'horizontal' | 'vertical' | 'square',
      maxItemsPerRow?: number,
      lineColor?: string,
      parentId?: string,
      tag?: string,
      tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    })
  | (DiagramConnectionData & { 
      itemType: 'edge', 
      id: string,
      // Additional edge properties
      freeflow?: boolean,
      edgePosition?: number
    })
);

interface PaletteResource {
  name: string;
  file?: string; // Optional for icon resources (symbols/emojis)
  type?: string;
  hasWhiteVariant?: boolean;
  format?: string;
  iconType?: string;
  iconName?: string;
  emoji?: string;
}

interface PaletteSelection {
  resource: PaletteResource;
  provider: string;
  category: string;
}

function createPaletteItem(
  resource: PaletteResource | { name: string; iconType?: string; iconName?: string; emoji?: string },
  provider: string,
  category: string
) {
  const r = resource as { name: string; iconType?: string; iconName?: string; emoji?: string; file?: string };
  if (r.iconType === 'lucide' && r.iconName) {
    const slug = r.iconName.toLowerCase().replace(/\s+/g, '-');
    return { type: `generic.icon.${slug}`, label: r.name, provider: 'generic', category: 'icon', iconType: 'lucide', iconName: r.iconName };
  }
  if (r.iconType === 'emoji' && r.emoji) {
    const slug = r.name.replace(/\s+/g, '-').toLowerCase();
    return { type: `generic.emoji.${slug}`, label: r.name, provider: 'generic', category: 'emoji', iconType: 'emoji', emoji: r.emoji };
  }
  const derivedSlug = (resource as PaletteResource).name.replace(/\s+/g, '-').toLowerCase();
  return {
    type: `${provider}.${category}.${derivedSlug}`,
    label: (resource as PaletteResource).name,
    provider,
    category,
    file: (resource as PaletteResource).file,
  };
}

export default function DiagramEditor() {
  const [isClient, setIsClient] = React.useState<boolean>(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const editorRef = React.useRef<EditorCanvasHandle>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportDialogFormat, setExportDialogFormat] = React.useState<'png' | 'gif'>('png');
  const [closeTabDialogOpen, setCloseTabDialogOpen] = React.useState(false);
  const [pendingCloseTabId, setPendingCloseTabId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = React.useState<boolean>(false);
  // Use fixed defaults for SSR/hydration; restore from localStorage in useEffect
  const [rightPanelCollapsed, setRightPanelCollapsed] = React.useState<boolean>(true);
  const [metadataPopupsEnabled, setMetadataPopupsEnabled] = React.useState<boolean>(true);
  const [propertiesPanelVisible, setPropertiesPanelVisible] = React.useState<boolean>(true);
  const [scratchPadOpen, setScratchPadOpen] = React.useState<boolean>(false);
  const [layerAnimationsEnabled, setLayerAnimationsEnabled] = React.useState<boolean>(true);
  const [rulesEditorOpen, setRulesEditorOpen] = React.useState<boolean>(false);
  const [rules, setRules] = React.useState<import('@/lib/rules-types').DiagramRule[]>([]);

  // Restore rules from localStorage after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('dw:rules');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const rulesArray = Array.isArray(parsed?.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : [];
        if (rulesArray.length > 0 && rulesArray.every((r: any) => r && typeof r.id === 'string' && r.operator)) {
          setRules(rulesArray);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Save rules to localStorage when they change
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dw:rules', JSON.stringify({ version: '1.0', rules }));
    }
  }, [rules]);

  // Restore scratchpad visibility from localStorage after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('dw:scratchpad:visible');
    if (saved) {
      try {
        setScratchPadOpen(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Save scratchpad visibility to localStorage when it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dw:scratchpad:visible', JSON.stringify(scratchPadOpen));
    }
  }, [scratchPadOpen]);

  // Restore layer animations enabled from localStorage after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('dw:layerAnimations:enabled');
    if (saved !== null) {
      try {
        setLayerAnimationsEnabled(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Save layer animations enabled to localStorage when it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dw:layerAnimations:enabled', JSON.stringify(layerAnimationsEnabled));
    }
  }, [layerAnimationsEnabled]);
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [canPaste, setCanPaste] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mermaidInputRef = React.useRef<HTMLInputElement>(null);
  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null);
  const [hoverEnabled, setHoverEnabled] = React.useState<boolean>(false);
  const [iconBackgroundEnabled, setIconBackgroundEnabled] = React.useState<boolean>(true);
  const [alignmentGuidesEnabled, setAlignmentGuidesEnabled] = React.useState<boolean>(true);
  const [connectionsBehindNodesEnabled, setConnectionsBehindNodesEnabled] = React.useState<boolean>(true);
  const [animationConnectionsEnabled, setAnimationConnectionsEnabled] = React.useState<boolean>(true);
  const [animationToggleOnClickEnabled, setAnimationToggleOnClickEnabled] = React.useState<boolean>(false);
  const [animationDisabledSources, setAnimationDisabledSources] = React.useState<Set<string>>(new Set());
  const [isReadOnly, setIsReadOnly] = React.useState<boolean>(false);
  const [triggerTextStylingPanel, setTriggerTextStylingPanel] = React.useState<boolean>(false);
  const [triggerVisualStylingPanel, setTriggerVisualStylingPanel] = React.useState<boolean>(false);
  const [triggerLineStylingPanel, setTriggerLineStylingPanel] = React.useState<boolean>(false);
  const [triggerConnectionSettingsPanel, setTriggerConnectionSettingsPanel] = React.useState<boolean>(false);
  const [connectionContextModal, setConnectionContextModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    connection: import('@/lib/types').DiagramConnectionData | null;
  }>({ visible: false, x: 0, y: 0, connection: null });
  const [umlClassEditorModal, setUmlClassEditorModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
  }>({ visible: false, x: 0, y: 0, itemId: '' });
  const [lastRightClickItemId, setLastRightClickItemId] = React.useState<string | null>(null);
  const [selectedResource, setSelectedResource] = React.useState<PaletteSelection | null>(null);
  const [paletteClipboardItem, setPaletteClipboardItem] = React.useState<any | null>(null);
  const [animationSelectionDialogOpen, setAnimationSelectionDialogOpen] = React.useState(false);
  const [animationOverwriteDialogOpen, setAnimationOverwriteDialogOpen] = React.useState(false);
  const [animationDisableConfirmDialogOpen, setAnimationDisableConfirmDialogOpen] = React.useState(false);
  const [animationCurrentOnlyDialogOpen, setAnimationCurrentOnlyDialogOpen] = React.useState(false);
  const [pendingAnimationUpdate, setPendingAnimationUpdate] = React.useState<{
    from: string;
    to: string;
    connectionId?: string;
    mode: 'enable' | 'disable';
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    };
    selectedConnectionIds: string[];
  } | null>(null);
  // Reset trigger states after they've been used
  React.useEffect(() => {
    if (triggerTextStylingPanel) {
      const timer = setTimeout(() => setTriggerTextStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerTextStylingPanel]);

  React.useEffect(() => {
    if (triggerVisualStylingPanel) {
      const timer = setTimeout(() => setTriggerVisualStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerVisualStylingPanel]);

  React.useEffect(() => {
    if (triggerLineStylingPanel) {
      const timer = setTimeout(() => setTriggerLineStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerLineStylingPanel]);

  React.useEffect(() => {
    if (triggerConnectionSettingsPanel) {
      const timer = setTimeout(() => setTriggerConnectionSettingsPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerConnectionSettingsPanel]);

  // Tab management
  const {
    tabs,
    activeTabId,
    isLoaded,
    activeTab,
    createTab,
    switchTab,
    closeTab,
    updateActiveTab,
    updateTab,
    getTab,
    reorderTabs,
    markTabAsSaved,
    getHistoryRef,
    setHistoryRef,
  } = useDiagramTabs({
    isClient,
    onToast: toast,
  });

  // Sync active tab state to local state for component use
  const diagramData = activeTab?.diagramData || { nodes: [], connections: [], groupings: [] };
  const history = activeTab?.history || [JSON.stringify({ nodes: [], connections: [], groupings: [] })];
  const historyIndex = activeTab?.historyIndex || 0;
  const historyRef = React.useRef(getHistoryRef(activeTabId || '') || { history: [], index: 0 });
  const selectedItem = activeTab?.selectedItem || null;
  const selectedItemIds = activeTab?.selectedItemIds || new Set();
  const isConnectMode = activeTab?.isConnectMode || false;
  const jsonPanelOpen = activeTab?.jsonPanelOpen || false;
  const canvasTransform = activeTab?.canvasTransform || { x: 0, y: 0, k: 1 };
  
  // Refresh key to force canvas re-render
  const [canvasRefreshKey, setCanvasRefreshKey] = React.useState(0);
  
  const refreshCanvas = React.useCallback(() => {
    setCanvasRefreshKey(prev => prev + 1);
  }, []);



  // Helper functions to update active tab
  const setDiagramData = React.useCallback((updater: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    if (!activeTabId) return;
    const newData = typeof updater === 'function' ? updater(diagramData) : updater;
    const connections = newData.connections || [];
    const needsIds = connections.some((c: DiagramConnectionData) => !(c as DiagramConnectionData).id);
    const ensuredConnections = needsIds ? ensureConnectionIds(connections) : connections;
    updateActiveTab({ diagramData: { ...newData, connections: ensuredConnections } });
  }, [activeTabId, diagramData, updateActiveTab]);

  const setSelectedItem = React.useCallback((updater: SelectedItem | null | ((prev: SelectedItem | null) => SelectedItem | null)) => {
    if (!activeTabId) return;
    const newItem = typeof updater === 'function' ? updater(selectedItem) : updater;
    updateActiveTab({ selectedItem: newItem });
  }, [activeTabId, selectedItem, updateActiveTab]);

  // Initialize layers system
  const layers = useLayers({
    diagramData,
    setDiagramData,
    toast
  });

  // Layer show/hide animations (Edit menu toggle, default enabled)
  const layerAnimation = useLayerAnimation(
    layerAnimationsEnabled,
    layers.filteredDiagramData ?? diagramData,
    layers.layersConfig,
  );

  React.useEffect(() => {
    layerAnimation.updateSnapshot(diagramData);
  }, [diagramData, layerAnimation.updateSnapshot]);

  const handleToggleLayerVisibility = React.useCallback(
    (layerId: string) => {
      if (!layerAnimation.onLayerVisibilityWillChange(layerId)) return;
      layers.toggleLayerVisibilityById(layerId);
    },
    [layerAnimation.onLayerVisibilityWillChange, layers.toggleLayerVisibilityById],
  );

  const displayDiagramData = layerAnimation.animatingDiagramData ?? layers.filteredDiagramData ?? diagramData;

  // When animation toggle-on-click mode is on: show animations only for selected node's chain. Nothing selected = no animations.
  const effectiveAnimationFilterIds = React.useMemo(() => {
    if (!animationToggleOnClickEnabled || !animationConnectionsEnabled) return undefined;
    const displayData = layers.filteredDiagramData ?? diagramData;
    const connections = displayData?.connections ?? [];
    if (selectedItem?.itemType === 'node' && selectedItem?.id && connections.length > 0) {
      return getDownstreamAnimationChainNodes(selectedItem.id, connections);
    }
    return new Set<string>(); // Empty set = no animations when nothing selected
  }, [animationToggleOnClickEnabled, animationConnectionsEnabled, selectedItem, layers.filteredDiagramData, diagramData]);

  const setSelectedItemIds = React.useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (!activeTabId) return;
    const newIds = typeof updater === 'function' ? updater(selectedItemIds) : updater;
    updateActiveTab({ selectedItemIds: newIds });
    
    // Update active layer based on selection
    layers.updateActiveLayerFromSelection(newIds);
  }, [activeTabId, selectedItemIds, updateActiveTab, layers]);

  const setIsConnectMode = React.useCallback((mode: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ isConnectMode: mode });
  }, [activeTabId, updateActiveTab]);

  const setJsonPanelOpen = React.useCallback((open: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ jsonPanelOpen: open });
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(open));
    }
  }, [activeTabId, updateActiveTab, isClient]);

  const setCanvasTransform = React.useCallback((transform: { x: number; y: number; k: number }) => {
    if (!activeTabId) return;
    updateActiveTab({ canvasTransform: transform });
  }, [activeTabId, updateActiveTab]);

  const setHistory = React.useCallback((newHistory: string[]) => {
    if (!activeTabId) return;
    updateActiveTab({ history: newHistory });
    setHistoryRef(activeTabId, { history: newHistory, index: historyIndex });
  }, [activeTabId, historyIndex, updateActiveTab, setHistoryRef]);

  const setHistoryIndex = React.useCallback((index: number) => {
    if (!activeTabId) return;
    updateActiveTab({ historyIndex: index });
    const currentHistory = historyRef.current.history;
    setHistoryRef(activeTabId, { history: currentHistory, index });
  }, [activeTabId, updateActiveTab, setHistoryRef]);

  // Update historyRef when active tab changes
  React.useEffect(() => {
    if (activeTabId && activeTab) {
      historyRef.current = getHistoryRef(activeTabId) || { history: activeTab.history, index: activeTab.historyIndex };
    }
  }, [activeTabId, activeTab, getHistoryRef]);

  // Debounced history update to prevent excessive processing during rapid changes
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const updateHistory = useCallback(() => {
    if (!activeTabId || !activeTab) return;
    
    // Skip history updates during dragging
    if (isDragging) {
      return;
    }
    
    const jsonString = JSON.stringify(diagramData);
    
    // Skip if this is same as last history entry (but not on initial load)
    if (historyRef.current.history.length > 1 && historyRef.current.history[historyRef.current.index] === jsonString) {
      return;
    }
    
    // Update history using ref for immediate access
    const currentHistory = historyRef.current.history.slice(0, historyRef.current.index + 1);
    currentHistory.push(jsonString);
    
    // Keep only last 20 states
    if (currentHistory.length > 20) {
      currentHistory.shift();
    }
    
    const newIndex = currentHistory.length - 1;
    
    // Update ref
    historyRef.current = { history: currentHistory, index: newIndex };
    
    // Update tab state
    updateActiveTab({ history: currentHistory, historyIndex: newIndex });
    setHistoryRef(activeTabId, historyRef.current);
  }, [diagramData, isDragging, activeTabId, activeTab, updateActiveTab, setHistoryRef]);

  // Watch diagramData changes and update history with debouncing
  React.useEffect(() => {
    // Clear existing timeout
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    
    // Skip history updates during dragging to prevent performance issues
    if (isDragging) {
      return;
    }
    
    // Debounce history updates to 300ms
    historyTimeoutRef.current = setTimeout(() => {
      updateHistory();
    }, 300);
    
    // Cleanup timeout on unmount
    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [diagramData, updateHistory, isDragging]);

  const undo = React.useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef]);

  const redo = React.useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef]);

  // Initialize client-side state after hydration
  React.useEffect(() => {
    setIsClient(true);
    const savedWidth = localStorage.getItem('dw:jsonEditor:width');
    if (savedWidth !== null) {
      const parsed = parseInt(savedWidth, 10);
      if (!Number.isNaN(parsed) && parsed >= 280) {
        setJsonPanelWidth(Math.min(parsed, Math.max(300, window.innerWidth * 0.5)));
      }
    }
    // Load icon background preference
    const savedIconBackground = localStorage.getItem('dw:iconBackground:enabled');
    if (savedIconBackground !== null) {
      setIconBackgroundEnabled(savedIconBackground === 'true');
    }
  }, []);

  // Handle body scroll lock when mobile sidebar is open
  React.useEffect(() => {
    if (isMobile) {
      if (sidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [sidebarOpen, isMobile]);

  const handleItemSelect = (item: SelectedItem | null, shiftKey = false) => {
    if (isConnectMode && !item) {
      setIsConnectMode(false);
    }

    if (!item && animationToggleOnClickEnabled) {
      setAnimationDisabledSources(new Set());
    }

    if (shiftKey && item) {
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);

        // Preserve the currently selected item when entering additive selection
        // from flows where selectedItemIds may not yet include selectedItem.
        if (selectedItem?.id) {
          newSet.add(selectedItem.id);
        }

        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
      setSelectedItem(item);
    } else {
      setSelectedItem(item);

      if (item) {
        setSelectedItemIds(new Set([item.id]));
      } else {
        setSelectedItemIds(new Set());
      }
    }
  };

  const handleBatchSelect = (itemIds: string[]) => {
    if (itemIds.length === 0) {
      setSelectedItem(null);
      setSelectedItemIds(new Set());
      if (animationToggleOnClickEnabled) setAnimationDisabledSources(new Set());
      return;
    }
    
    // Find all selectable items (nodes, zones, and connections)
    const items: SelectedItem[] = [];
    itemIds.forEach(id => {
      const node = diagramData.nodes.find(n => n.id === id);
      if (node) {
        items.push({ ...node, itemType: 'node' as const });
        return;
      }

      const zone = diagramData.zones?.find(z => z.id === id);
      if (zone) {
        items.push({ ...(zone as any), itemType: 'node' as const, id: zone.id } as SelectedItem);
        return;
      }

      const connection = diagramData.connections.find(conn =>
        (conn as DiagramConnectionData).id === id || `${conn.from}-${conn.to}` === id
      );
      if (connection) {
        const connId = (connection as DiagramConnectionData).id ?? id;
        items.push({ ...connection, itemType: 'edge' as const, id: connId });
      }
    });
    
    if (items.length > 0) {
      // Set first item as primary, all items as selected
      setSelectedItem(items[0]);
      setSelectedItemIds(new Set(itemIds));
    }
  };
  
  const handleItemUpdate = (updatedItem: SelectedItem) => {
    if (updatedItem.itemType === 'edge') return;
    setDiagramData(prevData => {
            // Find the existing node to preserve its properties
            const existingNode = prevData.nodes.find(n => n.id === updatedItem.id);
            
            if (!existingNode) {
                // Node doesn't exist, this shouldn't happen but handle gracefully
                return prevData;
            }
            
            // Create merged node, ensuring we preserve all existing properties
            // Only update properties that are explicitly provided in updatedItem
            const mergedNode = { ...existingNode } as DiagramNodeData;
            
            // Only copy properties that exist in updatedItem and are not undefined
            Object.keys(updatedItem).forEach(key => {
                if (key !== 'itemType' && key !== 'id') {
                    const value = (updatedItem as any)[key];
                    if (value !== undefined) {
                        (mergedNode as any)[key] = value;
                    }
                }
            });
            
            return {
                ...prevData,
                nodes: prevData.nodes.map(n => n.id === updatedItem.id ? mergedNode : n)
            };
    });

    // Also update the selected item state if it's the one being edited
    if (selectedItem?.id === updatedItem.id) {
        setSelectedItem(updatedItem);
    }
  }

  const handleLabelUpdate = (nodeId: string, newLabel: string, richLabel?: import("@/lib/types").RichTextRun[]) => {
    React.startTransition(() => {
      setDiagramData(prevData => ({
        ...prevData,
        nodes: prevData.nodes.map(n =>
          n.id === nodeId
            ? { ...n, label: newLabel, richLabel: richLabel ?? undefined }
            : n
        ),
      }));

      // Also update the selected item if it's the one being edited
      if (selectedItem?.id === nodeId && selectedItem.itemType === 'node') {
        setSelectedItem({ ...selectedItem, label: newLabel });
      }
    });
  }

  const handleTagUpdate = (nodeId: string, newTag: string) => {
    setDiagramData(prevData => ({
      ...prevData,
      nodes: prevData.nodes.map(n => n.id === nodeId ? { ...n, tag: newTag } : n)
    }));

    // Also update the selected item if it's the one being edited
    if (selectedItem?.id === nodeId && selectedItem.itemType === 'node') {
      setSelectedItem({ ...selectedItem, tag: newTag });
    }
  }

  const handleResourceSelect = (resource: { name: string; file: string; type?: string; hasWhiteVariant?: boolean; format?: string }, provider: string, category: string) => {
    // Track the currently selected resource from the sidebar for copy/paste
    setSelectedResource({ resource, provider, category });
    console.log('Resource selected:', { resource, provider, category });
  };

  const handleResourceActivate = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string },
    provider: string,
    category: string,
    fullItem?: { type: string; label: string; provider: string; category: string; iconType?: string; iconName?: string; emoji?: string }
  ) => {
    const item = fullItem ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item);
    }
  };

  const handleResourceActivateAtPosition = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string },
    provider: string,
    category: string,
    position: { x: number; y: number },
    fullItem?: object
  ) => {
    const item = (fullItem as { type: string; label: string; provider: string; category: string }) ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item, position);
    }
  };

  const handleItemDelete = (itemToDelete: SelectedItem) => {
    setDiagramData(prevData => {
      let newNodes = prevData.nodes;
      let newConnections = prevData.connections;

      if (itemToDelete.itemType === 'node') {
        newNodes = prevData.nodes.filter(n => n.id !== itemToDelete.id);
        newConnections = prevData.connections.filter((e: { from: string; to: string }) => e.from !== itemToDelete.id && e.to !== itemToDelete.id);
      } else if (itemToDelete.itemType === 'edge') {
        const edgeItem = itemToDelete as { from: string; to: string; id?: string };
        newConnections = prevData.connections.filter((e: DiagramConnectionData) => {
          if (edgeItem.id && (e as DiagramConnectionData).id) return (e as DiagramConnectionData).id !== edgeItem.id;
          return !(e.from === edgeItem.from && e.to === edgeItem.to);
        });
      }

      const updatedData = { ...prevData, nodes: newNodes, connections: newConnections };
      return cleanupGroupsAfterDeletion([itemToDelete.id], updatedData);
    });
    setSelectedItem(null);
  };

  const handleGroupItems = () => {
    if (selectedItemIds.size < 2) {
      toast({ 
        variant: 'destructive', 
        title: 'Cannot Group', 
        description: 'Select at least 2 items to create a group.' 
      });
      return;
    }

    try {
      const updatedData = createGroup(Array.from(selectedItemIds), diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Items Grouped', 
        description: `Created group with ${selectedItemIds.size} items.` 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Group Failed', 
        description: error instanceof Error ? error.message : 'Failed to create group.' 
      });
    }
  };

  const handleUngroupItems = () => {
    if (!selectedItem) return;

    const group = getItemGroup(selectedItem.id, diagramData);
    if (!group) {
      toast({ 
        variant: 'destructive', 
        title: 'Not Grouped', 
        description: 'Selected item is not in a group.' 
      });
      return;
    }

    try {
      const updatedData = ungroup(group.id, diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Items Ungrouped', 
        description: 'Group has been dissolved.' 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Ungroup Failed', 
        description: error instanceof Error ? error.message : 'Failed to ungroup items.' 
      });
    }
  };

  const handleRemoveFromGroup = () => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = removeFromGroup(Array.from(selectedItemIds), diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Removed from Group', 
        description: `${selectedItemIds.size} item(s) removed from group.` 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Remove Failed', 
        description: error instanceof Error ? error.message : 'Failed to remove from group.' 
      });
    }
  };

  const handleAddToGroup = (groupId: string) => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = addToGroup(Array.from(selectedItemIds), groupId, diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Added to Group', 
        description: `${selectedItemIds.size} item(s) added to group.` 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Add to Group Failed', 
        description: error instanceof Error ? error.message : 'Failed to add to group.' 
      });
    }
  };

  const handleConnect = (targetItem: DiagramNodeData) => {
    const pendingSourceId = (window as any).pendingConnectionSourceId as string | undefined;
    const sourceId = pendingSourceId || (selectedItem?.itemType === 'node' ? selectedItem.id : undefined);

    if (!isConnectMode || !sourceId || sourceId === targetItem.id) {
      delete (window as any).pendingConnectionSourceId;
      delete (window as any).pendingConnectionOptions;
      setIsConnectMode(false);
      return;
    }

    // Get connection options from window storage or use defaults
    const connectionOptions = (window as any).pendingConnectionOptions || {};
    
    const newConnection: DiagramConnectionData = { 
      id: generateConnectionId(),
      from: sourceId,
      to: targetItem.id,
      style: connectionOptions.style || 'bezier',
      curvature: connectionOptions.style === 'bezier' ? (connectionOptions.curvature || 0.5) : undefined,
      animation: toConnectionAnimationPatch(DEFAULT_CONNECTION_ANIMATION),
    };
    
    // Clear stored connection options
    delete (window as any).pendingConnectionSourceId;
    delete (window as any).pendingConnectionOptions;
    
    setDiagramData(prevData => ({
      ...prevData,
      connections: [...prevData.connections, newConnection]
    }));
    
    setIsConnectMode(false);
    setSelectedItem(null); // Deselect after connecting
  };

  const startConnecting = (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number; sourceItemId?: string }) => {
    const sourceItemId = connectionOptions?.sourceItemId || (selectedItem?.itemType === 'node' ? selectedItem.id : undefined);

    if (!sourceItemId) return;

    setIsConnectMode(true);
    (window as any).pendingConnectionSourceId = sourceItemId;
    (window as any).pendingConnectionOptions = connectionOptions;
  }

  const disconnectSelected = () => {
    if (!selectedItem || selectedItem.itemType !== 'node') return;
    const id = selectedItem.id;
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.filter((e: any) => e.from !== id && e.to !== id),
    }));
    toast({ title: 'Disconnected', description: 'All connections to/from this item have been removed.' });
  };

  const disconnectConnection = (from: string, to: string, connectionId?: string) => {
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.filter((e: DiagramConnectionData) => {
        if (connectionId && (e as DiagramConnectionData).id) return (e as DiagramConnectionData).id !== connectionId;
        return !(e.from === from && e.to === to);
      }),
    }));
    if (selectedItem && selectedItem.itemType === 'edge') {
      const match = (selectedItem.from === from && selectedItem.to === to) &&
        (!connectionId || (selectedItem as { id?: string }).id === connectionId);
      if (match) setSelectedItem(null);
    }
    toast({ title: 'Connection Disconnected', description: 'Connection has been removed.' });
  };
  
  const getFilenameStem = (filename: string) =>
    filename.replace(/\.[^.]+$/, '') || filename;

  const handleSave = async (tabId?: string): Promise<boolean> => {
    const targetTabId = (typeof tabId === 'string' ? tabId : undefined) ?? activeTabId;
    const targetTab = targetTabId ? getTab(targetTabId) : activeTab;
    if (!targetTabId || !targetTab) return false;

    const dataToSave = targetTab.diagramData;
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const suggestedName = `${targetTab.name.replace(/\s+/g, '-').toLowerCase()}.json`;

    // Try to use the File System Access API if available (Chromium browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        const fileName = 'name' in handle ? String(handle.name) : suggestedName;
        updateTab(targetTabId, { name: getFilenameStem(fileName) });
        markTabAsSaved(targetTabId);
        toast({ title: 'Diagram Saved', description: 'Your diagram has been saved successfully.' });
        return true;
      } catch (error: any) {
        if (error.name === 'AbortError') return false;
        console.log('File System Access API failed, falling back to download:', error);
      }
    }

    // Fallback: automatic download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateTab(targetTabId, { name: getFilenameStem(suggestedName) });
    markTabAsSaved(targetTabId);
    toast({ title: 'Diagram Saved', description: 'Your diagram has been downloaded.' });
    return true;
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleMermaidImportClick = () => {
    mermaidInputRef.current?.click();
  };

  const handleMermaidFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') return;
        const diagramType = detectMermaidDiagramType(text);
        if (diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content found. Expected: sequenceDiagram followed by participant and message definitions.');
          }
          if (parsed.errors.length > 0) {
            const errMsg = parsed.errors.join('; ');
            console.error('[Mermaid Import] Sequence diagram parse issues:', { errors: parsed.errors });
            throw new Error(`Sequence diagram parse issues: ${errMsg}`);
          }
          const completeData = sequenceDiagramToDiagramData(parsed);
          completeData.connections = ensureConnectionIds(completeData.connections || []);
          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            toast({ title: 'Mermaid Imported', description: 'Your sequence diagram has been successfully imported.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
          return;
        }
        if (diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content found. Expected: classDiagram followed by class and inheritance definitions.');
          }
          if (parsed.errors.length > 0) {
            const errMsg = parsed.errors.join('; ');
            console.error('[Mermaid Import] Class diagram parse issues:', { errors: parsed.errors });
            throw new Error(`Class diagram parse issues: ${errMsg}`);
          }
          let completeData = classDiagramToDiagramData(parsed);
          completeData.connections = ensureConnectionIds(completeData.connections || []);
          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            toast({ title: 'Mermaid Imported', description: 'Your class diagram has been successfully imported.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
          return;
        }
        const parsed = parseMermaidFlowchart(text);
        if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
          throw new Error('No valid flowchart content found. Expected: flowchart TD or flowchart LR followed by node and edge definitions.');
        }
        if (parsed.errors.length > 0) {
          const errMsg = parsed.errors.join('; ');
          console.error('[Mermaid Import] Parse issues:', { errors: parsed.errors, nodes: parsed.nodes.length, edges: parsed.edges.length });
          throw new Error(`Mermaid parse issues: ${errMsg}`);
        }
        let completeData = await mermaidToDiagramData(parsed);
        setDiagramData({ nodes: [], connections: [], groupings: [] });
        setTimeout(() => {
          setDiagramData(completeData);
          setSelectedItem(null);
          toast({ title: 'Mermaid Imported', description: 'Your diagram has been successfully imported.' });
          setTimeout(() => editorRef.current?.fitToView(), 100);
        }, 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        const stack = error instanceof Error ? error.stack : undefined;
        console.error('[Mermaid Import] Error:', { message, stack, file: file?.name });
        toast({ variant: 'destructive', title: 'Error Importing Mermaid', description: message });
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const parseUnknownJsonToDiagramData = React.useCallback((json: unknown): DiagramData => {
    const flattened = flattenDiagramOnImport((json || {}) as RawDiagramData);
    const result = DiagramDataSchema.safeParse(flattened);
    if (!result.success) {
      throw new Error(`Invalid diagram format: ${result.error.message}`);
    }
    const connections = ensureConnectionIds(result.data.connections || []);
    return {
      nodes: result.data.nodes || [],
      connections,
      groupings: result.data.groupings,
      layers: result.data.layers,
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result;
          if (typeof text !== 'string') return;
          const ext = file.name.toLowerCase().slice(-5);
          const diagramType = detectMermaidDiagramType(text);
          const isMermaid = /\.(mmd|mermaid)$/.test(file.name.toLowerCase())
            || diagramType !== null;
          let completeData: DiagramData;

          if (isMermaid && diagramType === 'sequenceDiagram') {
            const parsed = parseMermaidSequenceDiagram(text);
            if (parsed.participants.length === 0 && parsed.messages.length === 0) {
              throw new Error('No valid sequence diagram content found.');
            }
            if (parsed.errors.length > 0) {
              throw new Error(`Sequence diagram parse issues: ${parsed.errors.join('; ')}`);
            }
            completeData = sequenceDiagramToDiagramData(parsed);
          } else if (isMermaid && diagramType === 'classDiagram') {
            const parsed = parseMermaidClassDiagram(text);
            if (parsed.classes.length === 0 && parsed.edges.length === 0) {
              throw new Error('No valid class diagram content found. Expected: classDiagram followed by class and inheritance definitions.');
            }
            if (parsed.errors.length > 0) {
              const errMsg = parsed.errors.join('; ');
              console.error('[Mermaid Load] Class diagram parse issues:', { errors: parsed.errors });
              throw new Error(`Class diagram parse issues: ${errMsg}`);
            }
            completeData = classDiagramToDiagramData(parsed);
          } else if (isMermaid) {
            const parsed = parseMermaidFlowchart(text);
            if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
              throw new Error('No valid flowchart content found. Expected: flowchart TD or flowchart LR followed by node and edge definitions.');
            }
            if (parsed.errors.length > 0) {
              const errMsg = parsed.errors.join('; ');
              console.error('[Mermaid Load] Parse issues:', { errors: parsed.errors, nodes: parsed.nodes.length, edges: parsed.edges.length });
              throw new Error(`Mermaid parse issues: ${errMsg}`);
            }
            let mermaidData = await mermaidToDiagramData(parsed);
            completeData = mermaidData;
          } else {
            const jsonData = JSON.parse(text);
            completeData = parseUnknownJsonToDiagramData(jsonData);
          }
          completeData.connections = ensureConnectionIds(completeData.connections || []);

          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            updateActiveTab({ name: getFilenameStem(file.name) });
            toast({ title: 'Diagram Loaded', description: 'Your diagram has been successfully loaded.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
        } catch (error) {
          const message = error instanceof Error ? error.message : "An unknown error occurred";
          const stack = error instanceof Error ? error.stack : undefined;
          console.error('[Diagram Load] Error:', { message, stack, file: file?.name });
          toast({
            variant: 'destructive',
            title: 'Error Loading Diagram',
            description: `Could not load or parse the file. ${message}`,
          });
        }
      };
      reader.readAsText(file);
    }
    if (event.target) event.target.value = '';
  };

  const hasConnectionAnimationSettings = React.useCallback((connection: DiagramConnectionData) => {
    const animation = connection.animation;
    if (!animation) return false;
    return (
      animation.enabled === true ||
      animation.color !== undefined ||
      animation.shape !== undefined ||
      animation.speed !== undefined ||
      animation.size !== undefined ||
      animation.autoCount !== undefined ||
      animation.shapeCount !== undefined ||
      animation.spacing !== undefined
    );
  }, []);

  const applyConnectionUpdates = React.useCallback((
    from: string,
    to: string,
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    },
    connectionId?: string
  ) => {
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.map(conn => {
        const match = connectionId
          ? (conn as DiagramConnectionData).id === connectionId
          : (conn.from === from && conn.to === to);
        return match ? { ...conn, ...updates } : conn;
      })
    }));
    if (selectedItem && selectedItem.itemType === 'edge') {
      const match = connectionId
        ? (selectedItem as { id?: string }).id === connectionId
        : (selectedItem.from === from && selectedItem.to === to);
      if (match) setSelectedItem({ ...selectedItem, ...updates });
    }
  }, [selectedItem, setDiagramData, setSelectedItem]);

  const applyAnimationToCurrentAndSelected = React.useCallback((
    from: string,
    to: string,
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    },
    selectedConnectionIds: string[],
    currentConnectionId?: string
  ) => {
    setDiagramData((prevData) => ({
      ...prevData,
      connections: prevData.connections.map((conn) => {
        const connId = (conn as DiagramConnectionData).id;
        const isCurrent = currentConnectionId ? connId === currentConnectionId : (conn.from === from && conn.to === to);
        if (isCurrent) return { ...conn, ...updates };
        if (selectedConnectionIds.includes(connId ?? `${conn.from}-${conn.to}`) && updates.animation) {
          return { ...conn, animation: updates.animation };
        }
        return conn;
      }),
    }));

    if (selectedItem && selectedItem.itemType === 'edge') {
      const match = currentConnectionId ? (selectedItem as { id?: string }).id === currentConnectionId : (selectedItem.from === from && selectedItem.to === to);
      if (match) setSelectedItem({ ...selectedItem, ...updates });
    }
  }, [selectedItem, setDiagramData, setSelectedItem]);

  const resetPendingAnimationDialogs = React.useCallback(() => {
    setAnimationSelectionDialogOpen(false);
    setAnimationOverwriteDialogOpen(false);
    setAnimationDisableConfirmDialogOpen(false);
    setPendingAnimationUpdate(null);
  }, []);

  const handleConnectionUpdate = (from: string, to: string, updates: { text?: string; color?: string; textPosition?: number; lineWidth?: number; shadow?: boolean; style?: 'bezier' | 'orthogonal'; curvature?: number; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean; arrow?: boolean; waypoints?: Array<{ x: number; y: number; id?: string }>; metaData?: Record<string, string>; animation?: DiagramConnectionData['animation'] }, connectionId?: string) => {
    const effectiveConnId = connectionId ?? (selectedItem?.itemType === 'edge' ? (selectedItem as { id?: string }).id : undefined);
    const currentConnection = diagramData.connections.find((conn) =>
      effectiveConnId ? (conn as DiagramConnectionData).id === effectiveConnId : (conn.from === from && conn.to === to)
    );
    const isEnablingAnimation = updates.animation?.enabled === true && currentConnection?.animation?.enabled !== true;
    const isDisablingAnimation = updates.animation?.enabled === false && currentConnection?.animation?.enabled === true;
    const selectedConnectionIds = Array.from(selectedItemIds).filter((id) => {
      if (effectiveConnId && id === effectiveConnId) return false;
      return diagramData.connections.some((conn) => (conn as DiagramConnectionData).id === id || `${conn.from}-${conn.to}` === id);
    });

    if (isEnablingAnimation || isDisablingAnimation) {
      if (selectedConnectionIds.length > 0) {
        setPendingAnimationUpdate({
          from,
          to,
          connectionId: effectiveConnId,
          mode: isDisablingAnimation ? 'disable' : 'enable',
          updates,
          selectedConnectionIds,
        });
        setAnimationSelectionDialogOpen(true);
        return;
      }
    }

    if (updates.animation && selectedConnectionIds.length > 0) {
      applyAnimationToCurrentAndSelected(from, to, updates, selectedConnectionIds, effectiveConnId);
      return;
    }

    applyConnectionUpdates(from, to, updates, effectiveConnId);
  };

  const handleAnimationApplyCurrentOnly = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    applyConnectionUpdates(
      pendingAnimationUpdate.from,
      pendingAnimationUpdate.to,
      pendingAnimationUpdate.updates,
      pendingAnimationUpdate.connectionId
    );
    resetPendingAnimationDialogs();
    setAnimationCurrentOnlyDialogOpen(true);
  }, [pendingAnimationUpdate, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleAnimationApplySelectedConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    setAnimationSelectionDialogOpen(false);

    if (pendingAnimationUpdate.mode === 'disable') {
      setAnimationDisableConfirmDialogOpen(true);
      return;
    }

    const hasOtherExistingAnimation = diagramData.connections.some((conn) => {
      const connId = (conn as DiagramConnectionData).id ?? `${conn.from}-${conn.to}`;
      if (!pendingAnimationUpdate.selectedConnectionIds.includes(connId)) return false;
      return hasConnectionAnimationSettings(conn);
    });

    if (hasOtherExistingAnimation) {
      setAnimationOverwriteDialogOpen(true);
      return;
    }

    applyAnimationToCurrentAndSelected(
      pendingAnimationUpdate.from,
      pendingAnimationUpdate.to,
      pendingAnimationUpdate.updates,
      pendingAnimationUpdate.selectedConnectionIds,
      pendingAnimationUpdate.connectionId
    );
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, diagramData.connections, hasConnectionAnimationSettings, applyAnimationToCurrentAndSelected, resetPendingAnimationDialogs]);

  const handleAnimationDisableConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    applyAnimationToCurrentAndSelected(
      pendingAnimationUpdate.from,
      pendingAnimationUpdate.to,
      pendingAnimationUpdate.updates,
      pendingAnimationUpdate.selectedConnectionIds,
      pendingAnimationUpdate.connectionId
    );
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, applyAnimationToCurrentAndSelected, resetPendingAnimationDialogs]);

  const handleAnimationOverwriteConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    applyAnimationToCurrentAndSelected(
      pendingAnimationUpdate.from,
      pendingAnimationUpdate.to,
      pendingAnimationUpdate.updates,
      pendingAnimationUpdate.selectedConnectionIds,
      pendingAnimationUpdate.connectionId
    );
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, applyAnimationToCurrentAndSelected, resetPendingAnimationDialogs]);

  const handleConnectionWaypointMove = (from: string, to: string, index: number, newPos: { x: number; y: number }, connectionId?: string) => {
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.map(conn => {
        const match = connectionId ? (conn as DiagramConnectionData).id === connectionId : (conn.from === from && conn.to === to);
        if (!match || !conn.waypoints) return conn;
        const updated = [...conn.waypoints];
        if (index >= 0 && index < updated.length) {
          updated[index] = { ...updated[index], x: newPos.x, y: newPos.y };
        }
        return { ...conn, waypoints: updated };
      })
    }));
  };

  const handleConnectionWaypointAdd = (from: string, to: string, connectionId?: string) => {
    const conn = diagramData.connections.find((c) =>
      connectionId ? (c as DiagramConnectionData).id === connectionId : (c.from === from && c.to === to)
    );
    if (!conn) return;
    const existing = conn.waypoints ?? [];
    const fromNode = diagramData.nodes.find((n) => n.id === from) || diagramData.zones?.find((z) => z.id === from);
    const toNode = diagramData.nodes.find((n) => n.id === to) || diagramData.zones?.find((z) => z.id === to);
    let midX: number;
    let midY: number;
    if (existing.length > 0) {
      const last = existing[existing.length - 1];
      const tx = ((toNode as any)?.x ?? 100) + (((toNode as any)?.width ?? 80) / 2);
      const ty = ((toNode as any)?.y ?? 80) + (((toNode as any)?.height ?? 80) / 2);
      midX = (last.x + tx) / 2;
      midY = (last.y + ty) / 2;
    } else if (fromNode && toNode) {
      const fx = ((fromNode as any).x ?? 0) + (((fromNode as any).width ?? 80) / 2);
      const fy = ((fromNode as any).y ?? 0) + (((fromNode as any).height ?? 80) / 2);
      const tx = ((toNode as any).x ?? 100) + (((toNode as any).width ?? 80) / 2);
      const ty = ((toNode as any).y ?? 80) + (((toNode as any).height ?? 80) / 2);
      midX = (fx + tx) / 2;
      midY = (fy + ty) / 2;
    } else {
      midX = 200;
      midY = 150;
    }
    const newWaypoint = { x: snapToGrid(midX), y: snapToGrid(midY), id: `wp-${Date.now()}` };
    const connId = connectionId ?? (conn as DiagramConnectionData).id;
    handleConnectionUpdate(from, to, { waypoints: [...existing, newWaypoint] }, connId);
  };

  const handleConnectionWaypointRemove = (from: string, to: string, index: number, connectionId?: string) => {
    const conn = diagramData.connections.find((c) =>
      connectionId ? (c as DiagramConnectionData).id === connectionId : (c.from === from && c.to === to)
    );
    if (!conn?.waypoints) return;
    const updated = conn.waypoints.filter((_, i) => i !== index);
    const connId = connectionId ?? (conn as DiagramConnectionData).id;
    handleConnectionUpdate(from, to, { waypoints: updated.length ? updated : undefined }, connId);
  };

  const handleConnectionAnimationBulkApply = (
    sourceId: string,
    direction: 'outbound' | 'inbound',
    animation: DiagramConnectionData['animation']
  ) => {
    const animationPatch = toConnectionAnimationPatch(animation);
    setDiagramData((prevData) => ({
      ...prevData,
      connections: prevData.connections.map((conn) => {
        const shouldApply = direction === 'outbound' ? conn.from === sourceId : conn.to === sourceId;
        if (!shouldApply) return conn;
        return {
          ...conn,
          animation: animationPatch,
        };
      }),
    }));
  };

  const handleConnectionContextMenu = useCallback((e: React.MouseEvent, connection: DiagramConnectionData) => {
    setConnectionContextModal({ visible: true, x: e.clientX, y: e.clientY, connection });
  }, []);

  const handleNew = () => {
    createTab();
  };

  const handleLoadExample = React.useCallback(async (exampleId: string) => {
    try {
      const isMermaid = exampleId === 'simple' || exampleId === 'complex' || exampleId === 'class-diagram' || exampleId === 'sequence-diagram';
      const res = await fetch(`/examples/${exampleId}.${isMermaid ? 'mmd' : 'json'}`);
      if (!res.ok) {
        throw new Error(`Failed to load example: ${res.statusText}`);
      }
      const text = await res.text();
      let diagram: DiagramData;

      if (isMermaid) {
        const diagramType = detectMermaidDiagramType(text);
        let mermaidData: DiagramData;
        if (diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content in Mermaid example.');
          }
          mermaidData = sequenceDiagramToDiagramData(parsed);
        } else if (diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content in Mermaid example.');
          }
          mermaidData = classDiagramToDiagramData(parsed);
        } else {
          const parsed = parseMermaidFlowchart(text);
          if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid flowchart content in Mermaid example.');
          }
          mermaidData = await mermaidToDiagramData(parsed);
        }
        diagram = mermaidData;
      } else {
        const json = JSON.parse(text);
        diagram = parseUnknownJsonToDiagramData(json);
      }

      const exampleName = exampleId === 'example1' ? 'Example 1' : exampleId === 'example2' ? 'Example 2'
        : exampleId === 'simple' ? 'Mermaid Simple' : exampleId === 'complex' ? 'Mermaid Complex'
        : exampleId === 'class-diagram' ? 'Mermaid Class Diagram'
        : exampleId === 'sequence-diagram' ? 'Mermaid Sequence Diagram' : `Example: ${exampleId}`;
      createTab({ name: exampleName, diagramData: diagram });

      toast({ title: 'Example Loaded', description: `${exampleName} has been loaded in a new tab.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ variant: 'destructive', title: 'Error Loading Example', description: `Could not load example. ${message}` });
    }
  }, [parseUnknownJsonToDiagramData, createTab, toast]);

  const handleMenuCopy = () => {
    if (selectedResource) {
      const item = createPaletteItem(selectedResource.resource, selectedResource.provider, selectedResource.category);
      setPaletteClipboardItem(item);
    } else {
      editorRef.current?.copy();
    }
  };

  const handleMenuPaste = () => {
    if (paletteClipboardItem && editorRef.current) {
      editorRef.current.pastePaletteItem(paletteClipboardItem);
    } else {
      editorRef.current?.paste();
    }
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>();
    
    diagramData.nodes.forEach(node => allIds.add(node.id));
    diagramData.connections.forEach(connection => {
      allIds.add((connection as DiagramConnectionData).id ?? `${connection.from}-${connection.to}`);
    });
    
    setSelectedItemIds(allIds);
    
    if (allIds.size > 0) {
      const firstId = Array.from(allIds)[0];
      const nodeItem = diagramData.nodes.find(node => node.id === firstId);
      if (nodeItem) {
        setSelectedItem({ ...nodeItem, itemType: 'node' });
        return;
      }
      const connection = diagramData.connections.find(conn =>
        (conn as DiagramConnectionData).id === firstId || `${conn.from}-${conn.to}` === firstId
      );
      if (connection) {
        const connId = (connection as DiagramConnectionData).id ?? firstId;
        setSelectedItem({ ...connection, itemType: 'edge' as const, id: connId });
      }
    } else {
      setSelectedItem(null);
    }
  };

  const handleExportPng = async () => {
    setExportDialogFormat('png');
    setExportDialogOpen(true);
  };

  const handleExportGif = async () => {
    setExportDialogFormat('gif');
    setExportDialogOpen(true);
  };

  const handleExport = async (options: {
    format: 'png' | 'gif';
    backgroundColor: 'transparent' | 'white' | 'dark';
    quality?: 'low' | 'medium' | 'high';
    fps?: number;
    durationSeconds?: number;
  }) => {
    // Close dialog and export current viewport
    setExportDialogOpen(false);
    if (editorRef.current) {
      if (options.format === 'gif') {
        await editorRef.current.exportGif({
          backgroundColor: options.backgroundColor,
          quality: options.quality || 'medium',
          fps: options.fps,
          durationSeconds: options.durationSeconds,
        });
        return;
      }
      await editorRef.current.exportPng({ 
        backgroundColor: options.backgroundColor,
        quality: options.quality || 'medium'
      });
    }
  };

  const handleTabClose = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Check for unsaved changes
    const currentDataHash = JSON.stringify(activeTab?.diagramData);
    const hasUnsavedChanges = tab.isModified;

    if (hasUnsavedChanges) {
      setPendingCloseTabId(tabId);
      setCloseTabDialogOpen(true);
    } else {
      await closeTab(tabId, true);
    }
  };

  const handleCloseTabConfirm = async () => {
    if (pendingCloseTabId) {
      await closeTab(pendingCloseTabId, true);
      setPendingCloseTabId(null);
    }
    setCloseTabDialogOpen(false);
  };

  const handleCloseTabSave = async () => {
    if (!pendingCloseTabId) return;
    const saved = await handleSave(pendingCloseTabId);
    if (saved) {
      await closeTab(pendingCloseTabId, true);
      setPendingCloseTabId(null);
      setCloseTabDialogOpen(false);
    }
  };

  const handleJsonValidChange = (newDiagramData: DiagramData) => {
    setDiagramData(newDiagramData);
  };

  const handleThemeApplyToSelected = (theme: DiagramTheme) => {
    if (!selectedItemIds || selectedItemIds.size === 0) {
      // Apply to single selected item
      if (selectedItem) {
        const updatedItem = themeManager.applyThemeToItem(selectedItem, theme);
        handleItemUpdate(updatedItem as any);
      }
    } else {
      // Apply to multiple selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return themeManager.applyThemeToItem(node, theme) as DiagramNodeData;
        }
        return node;
      });
      
      // Update connections
      updatedDiagramData.connections = updatedDiagramData.connections.map(connection => {
        const connId = (connection as DiagramConnectionData).id ?? `${connection.from}-${connection.to}`;
        if (selectedItemIds.has(connId)) {
          return themeManager.applyThemeToItem(connection, theme) as DiagramConnectionData;
        }
        return connection;
      });
      
      setDiagramData(updatedDiagramData);
      
      const count = selectedItemIds.size;
      toast({ 
        title: 'Theme Applied', 
        description: `Applied "${theme.name}" theme to ${count} item${count > 1 ? 's' : ''}.` 
      });
    }
  };

  const handleMoveToBack = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToBack(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleMoveToFront = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToFront(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleMoveOneBack = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneBack(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleMoveOneForward = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneForward(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleAlignObjects = (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => {
    if (!selectedItem || selectedItemIds.size < 2) return;

    // Get the reference item (first selected item) and store it permanently
    // We need to find the actual first selected item from the diagram data
    const firstSelectedId = Array.from(selectedItemIds)[0];
    const referenceNode = diagramData.nodes.find(n => n.id === firstSelectedId);
    if (!referenceNode) return;
    
    const referenceItem = { ...referenceNode, itemType: 'node' } as SelectedItem;
    
    // Helper function to get object dimensions
    const getObjectDimensions = (item: SelectedItem): { width: number; height: number } => {
      if (item.itemType === 'node') {
        const node = item as any;
        
        // Check if it's a shape node
        const isShapeNode = node.type === 'generic.object.square' ||
                           node.type === 'generic.object.circle' ||
                           node.type === 'generic.object.point' ||
                           node.type === 'generic.object.rectangle' ||
                           node.type === 'generic.object.uml-class' ||
                           node.type === 'generic.object.rounded-rectangle' ||
                           node.type === 'generic.object.triangle' ||
                           node.type === 'generic.object.star' ||
                           node.type === 'generic.object.cloud';
        
        // Check if it's a textbox node
        const isTextboxNode = node.type === 'generic.text.textbox';
        
        // Use custom dimensions if sizeMode is 'custom' and dimensions are provided
        if ((isTextboxNode || isShapeNode) && node.sizeMode === 'custom' && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Shapes always use their custom width/height if set
        if (isShapeNode && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Default dimensions based on node type
        if (node.type?.startsWith('generic.text')) {
          if (node.type === 'generic.text.textbox') {
            return { width: 120, height: 60 };
          }
          return { width: 100, height: 40 };
        }
        
        // Default for icon nodes
        return { width: 80, height: 50 };
      }
      return { width: 80, height: 50 };
    };

    // Calculate reference position based on alignment
    const refDims = getObjectDimensions(referenceItem);
    const refX = (referenceItem as any).x || 0;
    const refY = (referenceItem as any).y || 0;
    let referenceX: number;
    let referenceY: number;

    // Handle vertical alignment
    switch (alignment) {
      case 'top':
        referenceY = refY;
        break;
      case 'v-middle':
        referenceY = refY + (refDims.height / 2);
        break;
      case 'bottom':
        referenceY = refY + refDims.height;
        break;
      default:
        // For horizontal alignment, use center Y as default
        referenceY = refY + (refDims.height / 2);
        break;
    }

    // Handle horizontal alignment
    switch (alignment) {
      case 'left':
        referenceX = refX;
        break;
      case 'h-center':
        referenceX = refX + (refDims.width / 2);
        break;
      case 'right':
        referenceX = refX + refDims.width;
        break;
      default:
        // For vertical alignment, use center X as default
        referenceX = refX + (refDims.width / 2);
        break;
    }

    // Handle distribute operations
    if (alignment === 'distribute-v' || alignment === 'distribute-h') {
      // Get all selected items with their positions and dimensions
      const selectedItems: Array<{id: string, x: number, y: number, width: number, height: number, itemType: 'node', index: number}> = [];
      
      selectedItemIds.forEach(id => {
        const node = diagramData.nodes.find(n => n.id === id);
        if (node) {
          const dims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          selectedItems.push({
            id,
            x: node.x || 0,
            y: node.y || 0,
            width: dims.width,
            height: dims.height,
            itemType: 'node',
            index: diagramData.nodes.findIndex(n => n.id === id)
          });
        }
      });

      if (selectedItems.length < 3) return; // Need at least 3 items to distribute

      // Sort items by position
      if (alignment === 'distribute-v') {
        selectedItems.sort((a, b) => a.y - b.y);
      } else {
        selectedItems.sort((a, b) => a.x - b.x);
      }

      // Calculate distribution
      const firstItem = selectedItems[0];
      const lastItem = selectedItems[selectedItems.length - 1];
      
      let newPositions: Array<{id: string, x?: number, y?: number}> = [];

      if (alignment === 'distribute-v') {
        // Vertical distribution
        const totalHeight = lastItem.y + lastItem.height - firstItem.y;
        const totalItemHeight = selectedItems.reduce((sum, item) => sum + item.height, 0);
        const totalSpacing = totalHeight - totalItemHeight;
        const spacing = totalSpacing / (selectedItems.length - 1);
        
        let currentY = firstItem.y;
        selectedItems.forEach(item => {
          newPositions.push({ id: item.id, y: currentY });
          currentY += item.height + spacing;
        });
      } else {
        // Horizontal distribution
        const totalWidth = lastItem.x + lastItem.width - firstItem.x;
        const totalItemWidth = selectedItems.reduce((sum, item) => sum + item.width, 0);
        const totalSpacing = totalWidth - totalItemWidth;
        const spacing = totalSpacing / (selectedItems.length - 1);
        
        let currentX = firstItem.x;
        selectedItems.forEach(item => {
          newPositions.push({ id: item.id, x: currentX });
          currentX += item.width + spacing;
        });
      }

      // Apply the new positions
      setDiagramData(prevData => {
        const newNodes = [...prevData.nodes];
        newPositions.forEach(pos => {
          const nodeIndex = newNodes.findIndex(n => n.id === pos.id);
          if (nodeIndex !== -1) {
            newNodes[nodeIndex] = { ...newNodes[nodeIndex], ...pos };
          }
        });
        return { ...prevData, nodes: newNodes };
      });

      const updatedSelectedItems: SelectedItem[] = [];
      selectedItemIds.forEach(id => {
        const updatedNode = diagramData.nodes.find(n => n.id === id);
        if (updatedNode) {
          updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
        }
      });

      // Update the primary selected item if it was distributed
      if (selectedItem && selectedItem.id !== firstSelectedId) {
        const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }

      return;
    }

    // Align all selected items
    setDiagramData(prevData => {
      const newNodes = [...prevData.nodes];

      selectedItemIds.forEach(id => {
        if (id === firstSelectedId) return;

        const nodeIndex = newNodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          const node = newNodes[nodeIndex];
          const nodeDims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          let newX = node.x;
          let newY = node.y;
          
          switch (alignment) {
            case 'top':
              newY = referenceY;
              break;
            case 'v-middle':
              newY = referenceY - (nodeDims.height / 2);
              break;
            case 'bottom':
              newY = referenceY - nodeDims.height;
              break;
          }
          
          switch (alignment) {
            case 'left':
              newX = referenceX;
              break;
            case 'h-center':
              newX = referenceX - (nodeDims.width / 2);
              break;
            case 'right':
              newX = referenceX - nodeDims.width;
              break;
            case 'center':
              newX = referenceX - (nodeDims.width / 2);
              break;
          }
          
          newNodes[nodeIndex] = { ...node, x: newX, y: newY };
        }
      });

      return { ...prevData, nodes: newNodes };
    });

    const updatedSelectedItems: SelectedItem[] = [];
    selectedItemIds.forEach(id => {
      const updatedNode = diagramData.nodes.find(n => n.id === id);
      if (updatedNode) {
        updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
    });

    // Update the primary selected item if it was aligned
    if (selectedItem && selectedItem.id !== referenceItem.id) {
      const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
      if (updatedPrimary) {
        setSelectedItem(updatedPrimary);
      }
    }
  };

  const handleAutoLayout = () => {
    try {
      const newData = performAutoLayout(diagramData);
      setDiagramData(newData);
      toast({ 
        title: 'Auto Layout Applied', 
        description: 'Diagram has been automatically arranged.' 
      });
    } catch (error) {
      console.error('Auto layout failed:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Auto Layout Failed', 
        description: 'Could not apply auto layout.' 
      });
    }
  };

  const toggleJsonPanel = () => {
    const newState = !jsonPanelOpen;
    setJsonPanelOpen(newState);
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(newState));
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toUpperCase().includes('MAC');

      if (isEventFromEditableElement(e)) return;
      
      // Ctrl+Shift+J (or Cmd+Shift+J on Mac) - Toggle JSON Panel
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleJsonPanel();
      }
      
      // Ctrl+N (or Cmd+N on Mac) - New
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNew();
      }
      
      // Ctrl+O (or Cmd+O on Mac) - Load
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        handleLoadClick();
      }
      
      // Ctrl+S (or Cmd+S on Mac) - Save
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      
      // Ctrl+Z (or Cmd+Z on Mac) - Undo
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Ctrl+Shift+Z (or Cmd+Shift+Z on Mac) - Redo
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      }
      
      // Ctrl+Y (or Cmd+Y on Mac) - Redo (alternative)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      
      // Ctrl+A (or Cmd+A on Mac) - Select All
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault();
        handleSelectAll();
      }
      
      // Escape key - Clear multi-selection
      if (e.key === 'Escape' && selectedItemIds.size > 1) {
        e.preventDefault();
        setSelectedItemIds(new Set());
        return;
      }
      
      // Ctrl+G (or Cmd+G on Mac) - Group selected items
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        handleGroupItems();
        return;
      }
      
      // Ctrl+Shift+G (or Cmd+Shift+G on Mac) - Ungroup selected items
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleUngroupItems();
        return;
      }
      
      // Ctrl+Shift+L (or Cmd+Shift+L on Mac) - Auto Layout
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleAutoLayout();
        return;
      }
      
      // Ctrl+Alt+A (or Cmd+Option+A on Mac) - Toggle Animation Connections
      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAnimationConnectionsEnabled(!animationConnectionsEnabled);
        return;
      }
      
      // Ctrl+Alt+C (or Cmd+Option+C on Mac) - Toggle Click to Toggle Animations
      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (animationConnectionsEnabled) {
          setAnimationToggleOnClickEnabled(!animationToggleOnClickEnabled);
        }
        return;
      }
      
      // Arrow keys - Move selected items by 10px grid
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedItem && selectedItem.itemType !== 'edge') {
        e.preventDefault();
        
        const gridSize = 10; // Use 10px for arrow key movement
        let deltaX = 0;
        let deltaY = 0;
        
        switch (e.key) {
          case 'ArrowUp':
            deltaY -= gridSize;
            break;
          case 'ArrowDown':
            deltaY += gridSize;
            break;
          case 'ArrowLeft':
            deltaX -= gridSize;
            break;
          case 'ArrowRight':
            deltaX += gridSize;
            break;
        }
        
        // Determine which items to move (multi-selection or single selection)
        const itemIdsToMove = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : [selectedItem.id];
        
        // Filter out locked nodes
        const unlockedItemIds = itemIdsToMove.filter(id => {
          const node = diagramData.nodes.find(n => n.id === id);
          return !node || !node.locked;
        });
        
        // If all items are locked, don't move anything
        if (unlockedItemIds.length === 0) {
          return;
        }
        
        setDiagramData(prevData => {
          const newNodes = [...prevData.nodes];
          unlockedItemIds.forEach(id => {
            const nodeIndex = newNodes.findIndex(n => n.id === id);
            if (nodeIndex !== -1) {
              const node = newNodes[nodeIndex];
              newNodes[nodeIndex] = { 
                ...node, 
                x: Math.round(((node.x || 0) + deltaX) / gridSize) * gridSize,
                y: Math.round(((node.y || 0) + deltaY) / gridSize) * gridSize
              };
            }
          });
          return { ...prevData, nodes: newNodes };
        });
        
        const updatedSelectedItems: SelectedItem[] = [];
        unlockedItemIds.forEach(id => {
          const updatedNode = diagramData.nodes.find(n => n.id === id);
          if (updatedNode) {
            updatedSelectedItems.push({ 
              ...updatedNode, 
              itemType: 'node',
              x: Math.round(((updatedNode.x || 0) + deltaX) / gridSize) * gridSize,
              y: Math.round(((updatedNode.y || 0) + deltaY) / gridSize) * gridSize
            } as SelectedItem);
          }
        });
        
        // Update the primary selected item
        const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jsonPanelOpen, historyIndex, history, selectedItem, selectedItemIds, diagramData, setDiagramData, setSelectedItem, animationConnectionsEnabled, setAnimationConnectionsEnabled, setAnimationToggleOnClickEnabled]);

  // Persist panel width
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:width', String(jsonPanelWidth));
    }
  }, [jsonPanelWidth, isClient]);

  // Persist icon background preference
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:iconBackground:enabled', String(iconBackgroundEnabled));
    }
  }, [iconBackgroundEnabled, isClient]);

  // Persist alignment guides preference
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:alignmentGuides:enabled', String(alignmentGuidesEnabled));
    }
  }, [alignmentGuidesEnabled, isClient]);

  // Restore panel state from localStorage after hydration (avoids hydration mismatch)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCollapsed = localStorage.getItem('dw:propertiesPanel:collapsed');
    if (savedCollapsed !== null) setRightPanelCollapsed(savedCollapsed === 'true');
    const savedVisible = localStorage.getItem('dw:propertiesPanel:visible');
    if (savedVisible !== null) setPropertiesPanelVisible(savedVisible !== 'false');
    const savedPopups = localStorage.getItem('dw:metadataPopups:enabled');
    if (savedPopups !== null) setMetadataPopupsEnabled(savedPopups !== 'false');
    const savedGuides = localStorage.getItem('dw:alignmentGuides:enabled');
    if (savedGuides !== null) setAlignmentGuidesEnabled(savedGuides !== 'false');
    const savedConnectionsBehind = localStorage.getItem('dw:connectionsBehindNodes:enabled');
    if (savedConnectionsBehind !== null) setConnectionsBehindNodesEnabled(savedConnectionsBehind !== 'false');
    const savedAnimationConnections = localStorage.getItem('dw:animationConnections:enabled');
    if (savedAnimationConnections !== null) setAnimationConnectionsEnabled(savedAnimationConnections !== 'false');
    const savedAnimationToggleOnClick = localStorage.getItem('dw:animationToggleOnClick:enabled');
    if (savedAnimationToggleOnClick !== null) setAnimationToggleOnClickEnabled(savedAnimationToggleOnClick === 'true');
  }, []);

  // Persist connections-behind-nodes preference
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:connectionsBehindNodes:enabled', String(connectionsBehindNodesEnabled));
    }
  }, [connectionsBehindNodesEnabled, isClient]);

  // Persist animation connections preference
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:animationConnections:enabled', String(animationConnectionsEnabled));
    }
  }, [animationConnectionsEnabled, isClient]);

  // Persist animation toggle on click preference
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:animationToggleOnClick:enabled', String(animationToggleOnClickEnabled));
    }
  }, [animationToggleOnClickEnabled, isClient]);

  // Reset click-to-toggle disabled sources when it's enabled
  React.useEffect(() => {
    if (animationToggleOnClickEnabled) {
      setAnimationDisabledSources(new Set());
    }
  }, [animationToggleOnClickEnabled]);

  // Disable click-to-toggle when master animation toggle is off
  React.useEffect(() => {
    if (!animationConnectionsEnabled && animationToggleOnClickEnabled) {
      setAnimationToggleOnClickEnabled(false);
    }
  }, [animationConnectionsEnabled, animationToggleOnClickEnabled]);

  // Reset disabled animation sources when master animation toggle is re-enabled (only after client init)
  React.useEffect(() => {
    if (!isClient) return;
    if (animationConnectionsEnabled) {
      setAnimationDisabledSources(new Set());
    }
  }, [animationConnectionsEnabled, isClient]);

  // Persist properties panel collapse state
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:propertiesPanel:collapsed', String(rightPanelCollapsed));
    }
  }, [rightPanelCollapsed, isClient]);

  // Persist properties panel visibility
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:propertiesPanel:visible', String(propertiesPanelVisible));
    }
  }, [propertiesPanelVisible, isClient]);

  // Persist metadata popups enabled
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:metadataPopups:enabled', String(metadataPopupsEnabled));
    }
  }, [metadataPopupsEnabled, isClient]);

  const togglePropertiesPanel = React.useCallback(() => {
    setPropertiesPanelVisible(prev => !prev);
  }, []);

  const toggleMetadataPopups = React.useCallback(() => {
    setMetadataPopupsEnabled(prev => !prev);
  }, []);

  const canPasteFromMenu = paletteClipboardItem != null || canPaste;

  // Tutorial integration
  const handleStartTutorial = React.useCallback(() => {
    // This will be called from TopMenuBar, but we need to access the tutorial context
    // So we'll pass it through a ref or use a different approach
  }, []);

  return (
    <TooltipProvider>
    <TutorialProvider>
      <DiagramEditorInner
        canPasteFromMenu={canPasteFromMenu}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        leftPanelCollapsed={leftPanelCollapsed}
        setLeftPanelCollapsed={setLeftPanelCollapsed}
        rightPanelCollapsed={rightPanelCollapsed}
        setRightPanelCollapsed={setRightPanelCollapsed}
        propertiesPanelVisible={propertiesPanelVisible}
        onTogglePropertiesPanel={togglePropertiesPanel}
        metadataPopupsEnabled={metadataPopupsEnabled}
        onToggleMetadataPopups={toggleMetadataPopups}
        selectedItem={selectedItem}
        selectedItemIds={selectedItemIds}
        handleItemUpdate={handleItemUpdate}
        startConnecting={startConnecting}
        handleItemDelete={handleItemDelete}
        handleResourceSelect={handleResourceSelect}
        handleResourceActivate={handleResourceActivate}
        handleResourceActivateAtPosition={handleResourceActivateAtPosition}
        toggleJsonPanel={toggleJsonPanel}
        jsonPanelOpen={jsonPanelOpen}
        jsonPanelWidth={jsonPanelWidth}
        setJsonPanelWidth={setJsonPanelWidth}
        editorRef={editorRef}
        handleConnectionUpdate={handleConnectionUpdate}
        disconnectConnection={disconnectConnection}
        handleConnectionWaypointAdd={handleConnectionWaypointAdd}
        handleConnectionWaypointRemove={handleConnectionWaypointRemove}
        handleConnectionWaypointMove={handleConnectionWaypointMove}
        handleConnectionContextMenu={handleConnectionContextMenu}
        connectionContextModal={connectionContextModal}
        setConnectionContextModal={setConnectionContextModal}
        umlClassEditorModal={umlClassEditorModal}
        setUmlClassEditorModal={setUmlClassEditorModal}
        setDiagramData={setDiagramData}
        layers={layers}
        layerAnimationsEnabled={layerAnimationsEnabled}
        setLayerAnimationsEnabled={setLayerAnimationsEnabled}
        layerAnimation={layerAnimation}
        displayDiagramData={displayDiagramData}
        handleToggleLayerVisibility={handleToggleLayerVisibility}
        canvasTransform={canvasTransform}
        setCanvasTransform={setCanvasTransform}
        handleNew={handleNew}
        handleLoadClick={handleLoadClick}
        handleMermaidImportClick={handleMermaidImportClick}
        handleMermaidFileChange={handleMermaidFileChange}
        mermaidInputRef={mermaidInputRef}
        handleSave={handleSave}
        handleLoadExample={handleLoadExample}
        createTab={createTab}
        handleExportSvg={handleExportPng}
        handleExportGif={handleExportGif}
        handleMenuCopy={handleMenuCopy}
        handleMenuPaste={handleMenuPaste}
        canPaste={canPaste}
        undo={undo}
        redo={redo}
        historyIndex={historyIndex}
        history={history}
        handleSelectAll={handleSelectAll}
        mousePosition={mousePosition}
        hoverEnabled={hoverEnabled}
        setHoverEnabled={setHoverEnabled}
        iconBackgroundEnabled={iconBackgroundEnabled}
        setIconBackgroundEnabled={setIconBackgroundEnabled}
        alignmentGuidesEnabled={alignmentGuidesEnabled}
        setAlignmentGuidesEnabled={setAlignmentGuidesEnabled}
        connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
        setConnectionsBehindNodesEnabled={setConnectionsBehindNodesEnabled}
        animationConnectionsEnabled={animationConnectionsEnabled}
        setAnimationConnectionsEnabled={setAnimationConnectionsEnabled}
        animationToggleOnClickEnabled={animationToggleOnClickEnabled}
        setAnimationToggleOnClickEnabled={setAnimationToggleOnClickEnabled}
        effectiveAnimationFilterIds={effectiveAnimationFilterIds}
        animationDisabledSources={animationDisabledSources}
        setAnimationDisabledSources={setAnimationDisabledSources}
        isReadOnly={isReadOnly}
        setIsReadOnly={setIsReadOnly}
        handleAlignObjects={handleAlignObjects}
        handleAutoLayout={handleAutoLayout}
        handleThemeApplyToSelected={handleThemeApplyToSelected}
        triggerTextStylingPanel={triggerTextStylingPanel}
        setTriggerTextStylingPanel={setTriggerTextStylingPanel}
        triggerVisualStylingPanel={triggerVisualStylingPanel}
        setTriggerVisualStylingPanel={setTriggerVisualStylingPanel}
        triggerLineStylingPanel={triggerLineStylingPanel}
        setTriggerLineStylingPanel={setTriggerLineStylingPanel}
        triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
        setTriggerConnectionSettingsPanel={setTriggerConnectionSettingsPanel}
        setScratchPadOpen={setScratchPadOpen}
        scratchPadOpen={scratchPadOpen}
        rulesEditorOpen={rulesEditorOpen}
        setRulesEditorOpen={setRulesEditorOpen}
        rules={rules}
        setRules={setRules}
        tabs={tabs}
        activeTabId={activeTabId}
        isLoaded={isLoaded}
        switchTab={switchTab}
        handleTabClose={handleTabClose}
        reorderTabs={reorderTabs}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        diagramData={diagramData}
        handleJsonValidChange={handleJsonValidChange}
        exportDialogOpen={exportDialogOpen}
        exportDialogFormat={exportDialogFormat}
        setExportDialogOpen={setExportDialogOpen}
        handleExport={handleExport}
        refreshCanvas={refreshCanvas}
        updateHistory={updateHistory}
        closeTabDialogOpen={closeTabDialogOpen}
        setCloseTabDialogOpen={setCloseTabDialogOpen}
        pendingCloseTabId={pendingCloseTabId}
        setPendingCloseTabId={setPendingCloseTabId}
        handleCloseTabConfirm={handleCloseTabConfirm}
        handleCloseTabSave={handleCloseTabSave}
        animationSelectionDialogOpen={animationSelectionDialogOpen}
        setAnimationSelectionDialogOpen={setAnimationSelectionDialogOpen}
        animationOverwriteDialogOpen={animationOverwriteDialogOpen}
        setAnimationOverwriteDialogOpen={setAnimationOverwriteDialogOpen}
        animationDisableConfirmDialogOpen={animationDisableConfirmDialogOpen}
        setAnimationDisableConfirmDialogOpen={setAnimationDisableConfirmDialogOpen}
        animationCurrentOnlyDialogOpen={animationCurrentOnlyDialogOpen}
        setAnimationCurrentOnlyDialogOpen={setAnimationCurrentOnlyDialogOpen}
        handleAnimationApplyCurrentOnly={handleAnimationApplyCurrentOnly}
        handleAnimationApplySelectedConfirm={handleAnimationApplySelectedConfirm}
        handleAnimationDisableConfirm={handleAnimationDisableConfirm}
        handleAnimationOverwriteConfirm={handleAnimationOverwriteConfirm}
        handleItemSelect={handleItemSelect}
        handleBatchSelect={handleBatchSelect}
        setSelectedItemIds={setSelectedItemIds}
        setSelectedItem={setSelectedItem}
        isConnectMode={isConnectMode}
        handleConnect={handleConnect}
        setIsConnectMode={setIsConnectMode}
        disconnectSelected={disconnectSelected}
        handleLabelUpdate={handleLabelUpdate}
        handleTagUpdate={handleTagUpdate}
        setIsDragging={setIsDragging}
        setCanPaste={setCanPaste}
        setMousePosition={setMousePosition}
        handleGroupItems={handleGroupItems}
        handleUngroupItems={handleUngroupItems}
        handleRemoveFromGroup={handleRemoveFromGroup}
        handleAddToGroup={handleAddToGroup}
        handleMoveToBack={handleMoveToBack}
        handleMoveToFront={handleMoveToFront}
        handleMoveOneBack={handleMoveOneBack}
        handleMoveOneForward={handleMoveOneForward}
        canvasRefreshKey={canvasRefreshKey}
        activeTab={activeTab}
        toast={toast}
      />
      <TutorialOverlay />
    </TutorialProvider>
    </TooltipProvider>
  );
}

function DiagramEditorInner({
  canPasteFromMenu,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  rightPanelCollapsed,
  setRightPanelCollapsed,
  propertiesPanelVisible,
  onTogglePropertiesPanel,
  metadataPopupsEnabled,
  onToggleMetadataPopups,
  selectedItem,
  selectedItemIds,
  handleItemUpdate,
  startConnecting,
  handleItemDelete,
  handleResourceSelect,
  handleResourceActivate,
  handleResourceActivateAtPosition,
  toggleJsonPanel,
  jsonPanelOpen,
  editorRef,
  handleConnectionUpdate,
  disconnectConnection,
  handleConnectionWaypointAdd,
  handleConnectionWaypointRemove,
  handleConnectionWaypointMove,
  handleConnectionContextMenu,
  connectionContextModal,
  setConnectionContextModal,
  umlClassEditorModal,
  setUmlClassEditorModal,
  setDiagramData,
  layers,
  layerAnimationsEnabled,
  setLayerAnimationsEnabled,
  displayDiagramData,
  layerAnimation,
  handleToggleLayerVisibility,
  canvasTransform,
  setCanvasTransform,
  handleNew,
  handleLoadClick,
  handleMermaidImportClick,
  handleMermaidFileChange,
  mermaidInputRef,
  handleSave,
  handleLoadExample,
  createTab,
  handleExportSvg,
  handleExportGif,
  handleMenuCopy,
  handleMenuPaste,
  canPaste,
  undo,
  redo,
  historyIndex,
  history,
  handleSelectAll,
  mousePosition,
  hoverEnabled,
  setHoverEnabled,
  iconBackgroundEnabled,
  setIconBackgroundEnabled,
  alignmentGuidesEnabled,
  setAlignmentGuidesEnabled,
  connectionsBehindNodesEnabled,
  setConnectionsBehindNodesEnabled,
  animationConnectionsEnabled,
  setAnimationConnectionsEnabled,
  animationToggleOnClickEnabled,
  setAnimationToggleOnClickEnabled,
  effectiveAnimationFilterIds,
  animationDisabledSources,
  setAnimationDisabledSources,
  isReadOnly,
  setIsReadOnly,
  handleAlignObjects,
  handleAutoLayout,
  handleThemeApplyToSelected,
  triggerTextStylingPanel,
  setTriggerTextStylingPanel,
  triggerVisualStylingPanel,
  setTriggerVisualStylingPanel,
  triggerLineStylingPanel,
  setTriggerLineStylingPanel,
  triggerConnectionSettingsPanel,
  setTriggerConnectionSettingsPanel,
  setScratchPadOpen,
  scratchPadOpen,
  rulesEditorOpen,
  setRulesEditorOpen,
  rules,
  setRules,
  tabs,
  activeTabId,
  isLoaded,
  switchTab,
  handleTabClose,
  reorderTabs,
  fileInputRef,
  handleFileChange,
  jsonPanelOpen: jsonPanelOpenInner,
  jsonPanelWidth,
  setJsonPanelWidth,
  diagramData,
  handleJsonValidChange,
  toggleJsonPanel: toggleJsonPanelInner,
  exportDialogOpen,
  exportDialogFormat,
  setExportDialogOpen,
  handleExport,
  refreshCanvas,
  updateHistory,
  closeTabDialogOpen,
  setCloseTabDialogOpen,
  pendingCloseTabId,
  setPendingCloseTabId,
  handleCloseTabConfirm,
  handleCloseTabSave,
  animationSelectionDialogOpen,
  setAnimationSelectionDialogOpen,
  animationOverwriteDialogOpen,
  setAnimationOverwriteDialogOpen,
  animationDisableConfirmDialogOpen,
  setAnimationDisableConfirmDialogOpen,
  animationCurrentOnlyDialogOpen,
  setAnimationCurrentOnlyDialogOpen,
  handleAnimationApplyCurrentOnly,
  handleAnimationApplySelectedConfirm,
  handleAnimationDisableConfirm,
  handleAnimationOverwriteConfirm,
  handleItemSelect,
  handleBatchSelect,
  setSelectedItemIds,
  setSelectedItem,
  isConnectMode,
  handleConnect,
  setIsConnectMode,
  disconnectSelected,
  handleLabelUpdate,
  handleTagUpdate,
  setIsDragging,
  setCanPaste,
  setMousePosition,
  handleGroupItems,
  handleUngroupItems,
  handleRemoveFromGroup,
  handleAddToGroup,
  handleMoveToBack,
  handleMoveToFront,
  handleMoveOneBack,
  handleMoveOneForward,
  canvasRefreshKey,
  activeTab,
  toast,
}: any) {
  const { start } = useTutorial();
  
  const handleStartTutorial = React.useCallback(() => {
    start([
      {
        id: 'step-1',
        title: 'Welcome to DiagramWeaver',
        body: 'Click the File menu to open it. If you don’t want to, press Next and the tutorial will do it for you.',
        target: 'file-menu',
        requiresTargetClick: true,
        autoActionsOnNext: [{ type: 'click', target: 'file-menu' }],
      },
      {
        id: 'step-2',
        title: 'Edit menu',
        body: 'The Edit menu has actions like copy/paste and undo/redo. Click it, or press Next to open it automatically.',
        target: 'edit-menu',
        requiresTargetClick: true,
        autoActionsOnNext: [{ type: 'click', target: 'edit-menu' }],
      },
      {
        id: 'step-3',
        title: 'Tutorial complete',
        body: 'You’re all set. You can run this tutorial again any time from File → Start Tutorial.',
        target: 'canvas',
        mode: 'message',
        requiresTargetClick: false,
      },
    ]);
  }, [start]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen w-screen bg-background text-foreground font-body relative overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar - fixed on mobile, normal on desktop */}
        <div className={`${isMobile ? 'fixed left-0 top-0 h-full z-50 transform transition-transform duration-300 ease-in-out' : ''} ${isMobile && !sidebarOpen ? '-translate-x-full' : ''} ${isMobile ? (leftPanelCollapsed ? 'w-12' : 'w-80') : ''}`}>
 <ComponentSidebar
    selectedItem={selectedItem}
    selectedItemIds={selectedItemIds}
    onItemUpdate={handleItemUpdate}
    onConnect={startConnecting}
    onDisconnect={disconnectSelected}
    onItemDelete={handleItemDelete}
    diagramData={diagramData}
    onResourceSelect={handleResourceSelect}
    onResourceActivate={handleResourceActivate}
    onToggleJsonPanel={toggleJsonPanel}
    jsonPanelOpen={jsonPanelOpen}
    onFitToView={() => editorRef.current?.fitToView()}
    onConnectionUpdate={handleConnectionUpdate}
    onConnectionDisconnect={disconnectConnection}
    onCloseSidebar={() => setSidebarOpen(false)}
    isMobile={isMobile}
    transform={canvasTransform}
    onTransformChange={setCanvasTransform}
    collapsed={leftPanelCollapsed}
    onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
  />
        </div>
        
        {/* Mobile menu toggle button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="fixed left-4 top-4 z-30 p-3 bg-card border border-border rounded-md shadow-lg touch-target"
            style={{ touchAction: 'manipulation' }}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        
        <main className={`flex-1 flex flex-col ${isMobile ? 'w-full' : ''} ${isMobile && sidebarOpen ? 'pointer-events-none' : ''} ${(jsonPanelOpen || propertiesPanelVisible) ? 'min-w-0' : ''}`}>
            <header className="flex flex-col border-b bg-card">
                <TopMenuBar
                    onNew={handleNew}
                    onLoad={handleLoadClick}
                    onImportMermaid={handleMermaidImportClick}
                    onSave={handleSave}
                    onLoadExample={handleLoadExample}
                    onNewTab={createTab}
                    onExportSvg={handleExportSvg}
                    onExportGif={handleExportGif}
                    onToggleJsonPanel={toggleJsonPanel}
                    jsonPanelOpen={jsonPanelOpen}
                    onTogglePropertiesPanel={onTogglePropertiesPanel}
                    propertiesPanelVisible={propertiesPanelVisible}
                    onToggleMetadataPopups={onToggleMetadataPopups}
                    metadataPopupsEnabled={metadataPopupsEnabled}
                    onToggleLayersPanel={layers.toggleLayersPanel}
                    layersPanelOpen={layers.layersPanelOpen}
                    layerAnimationsEnabled={layerAnimationsEnabled}
                    onToggleLayerAnimations={() => setLayerAnimationsEnabled(!layerAnimationsEnabled)}
                    onFitToView={() => editorRef.current?.fitToView()}
                    onCopy={handleMenuCopy}
                    onPaste={handleMenuPaste}
                    canPaste={canPasteFromMenu}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={historyIndex > 0}
                    canRedo={historyIndex < history.length - 1}
                    onSelectAll={handleSelectAll}
                    transform={canvasTransform}
                    onTransformChange={setCanvasTransform}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    onItemUpdate={handleItemUpdate}
                    onConnect={startConnecting}
                    onDisconnect={disconnectSelected}
                    onDelete={() => {
                      if (selectedItem) {
                        handleItemDelete(selectedItem);
                      }
                    }}
                    onConnectionUpdate={handleConnectionUpdate}
                    onConnectionDisconnect={disconnectConnection}
                    onConnectionWaypointAdd={handleConnectionWaypointAdd}
                    onConnectionWaypointRemove={handleConnectionWaypointRemove}
                    diagramData={activeTab?.diagramData}
                    onDiagramDataUpdate={setDiagramData}
                    mousePosition={mousePosition}
                    hoverEnabled={hoverEnabled}
                    onToggleHover={() => setHoverEnabled(!hoverEnabled)}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    onToggleIconBackground={() => setIconBackgroundEnabled(!iconBackgroundEnabled)}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    onToggleAlignmentGuides={() => setAlignmentGuidesEnabled(!alignmentGuidesEnabled)}
                    connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
                    onToggleConnectionsBehindNodes={() => setConnectionsBehindNodesEnabled(!connectionsBehindNodesEnabled)}
                    animationConnectionsEnabled={animationConnectionsEnabled}
                    onToggleAnimationConnections={() => setAnimationConnectionsEnabled(!animationConnectionsEnabled)}
                    animationToggleOnClickEnabled={animationToggleOnClickEnabled}
                    onToggleAnimationToggleOnClick={() => setAnimationToggleOnClickEnabled(!animationToggleOnClickEnabled)}
                    isReadOnly={isReadOnly}
                    onToggleReadOnly={() => setIsReadOnly(!isReadOnly)}
                    onAlignObjects={handleAlignObjects}
                    onAutoLayout={handleAutoLayout}
                    onThemeApplyToSelected={handleThemeApplyToSelected}
                    triggerTextStylingPanel={triggerTextStylingPanel}
                    triggerVisualStylingPanel={triggerVisualStylingPanel}
                    triggerLineStylingPanel={triggerLineStylingPanel}
                    triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
                    onCloseConnectionSettingsPanel={() => {
                      // This will be passed down to close the connection settings panel
                      // We need to emit an event or call a callback to top-menu-bar
                    }}
                    onToggleScratchPad={() => setScratchPadOpen(!scratchPadOpen)}
                    scratchPadOpen={scratchPadOpen}
                    onToggleRulesEditor={() => setRulesEditorOpen(true)}
                    onRulesEditorOpenChange={setRulesEditorOpen}
                    rulesEditorOpen={rulesEditorOpen}
                    rules={rules}
                    onRulesChange={setRules}
                    onStartTutorial={handleStartTutorial}
                />
                {!isLoaded ? (
                  <div className="flex items-center gap-1 border-b bg-card px-3 py-2 text-sm text-muted-foreground">
                    Loading tabs…
                  </div>
                ) : (
                  activeTabId && (
                    <TabBar
                      tabs={tabs}
                      activeTabId={activeTabId}
                      onTabSelect={switchTab}
                      onTabClose={handleTabClose}
                      onTabReorder={reorderTabs}
                    />
                  )
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json,application/json,.mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={mermaidInputRef}
                    onChange={handleMermaidFileChange}
                    accept=".mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
            </header>
            <div className="flex-1 flex flex-col">
                <div className={`flex flex-1 ${(jsonPanelOpen || propertiesPanelVisible) ? 'overflow-x-auto' : ''}`}>
                  <div className={`flex-1 h-full min-w-0 ${(jsonPanelOpen || propertiesPanelVisible) ? 'mr-2' : ''}`}>
                <EditorCanvas
                    key={canvasRefreshKey}
                    ref={editorRef}
                    diagramData={displayDiagramData}
                    nodeAnimationStyles={layerAnimation.nodeAnimationStyles}
                    connectionAnimationStyles={layerAnimation.connectionAnimationStyles}
                    connectionKey={layerAnimation.connectionKey}
                    setDiagramData={setDiagramData}
                    onItemSelect={handleItemSelect}
                    onBatchSelect={handleBatchSelect}
                    setSelectedItemIds={setSelectedItemIds}
                    setSelectedItem={setSelectedItem as any}
                    selectedItemId={selectedItem?.id}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    isConnectMode={isConnectMode}
                    onNodeClickInConnectMode={handleConnect}
                    onConnect={startConnecting}
                    onDisconnect={() => {
                             // Remove all connections from selected item
                             if (selectedItem) {
                                 setDiagramData((prevData: DiagramData) => ({
                                     ...prevData,
                                     connections: prevData.connections?.filter((e: any) => e.from !== selectedItem.id && e.to !== selectedItem.id) || []
                                 }));
                                 toast({
                                     title: "Connections Disconnected",
                                     description: "All connections from the selected item have been removed.",
                                 });
                             }
                        }}
                    onConnectionDelete={disconnectConnection}
                    onConnectionWaypointMove={handleConnectionWaypointMove}
                    onConnectionUpdate={handleConnectionUpdate}
                    onConnectionWaypointAdd={handleConnectionWaypointAdd}
                    onConnectionContextMenu={handleConnectionContextMenu}
                    externalTransform={canvasTransform}
                     onTransformChange={setCanvasTransform}
                     onLabelUpdate={handleLabelUpdate}
                     onTagUpdate={handleTagUpdate}
                     onDraggingChange={setIsDragging}
                    onClipboardChange={setCanPaste}
                    onMousePositionChange={setMousePosition}
                    onExportComplete={() => setExportDialogOpen(false)}
                    hoverEnabled={hoverEnabled}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    onSelectAll={handleSelectAll}
                    onTriggerTextStylingPanel={() => setTriggerTextStylingPanel(true)}
                    onTriggerVisualStylingPanel={() => setTriggerVisualStylingPanel(true)}
                    onTriggerLineStylingPanel={() => setTriggerLineStylingPanel(true)}
                    onTriggerConnectionSettingsPanel={() => setTriggerConnectionSettingsPanel(true)}
                    onResetConnectionSettingsTrigger={() => setTriggerConnectionSettingsPanel(false)}
                    layers={{
                      getAllLayers: layers.getAllLayers,
                      getItemLayerById: layers.getItemLayerById,
                      assignItemsToLayer: layers.assignItemsToLayer
                    }}
                    onGroupItems={handleGroupItems}
                    onUngroupItems={handleUngroupItems}
                    onRemoveFromGroup={handleRemoveFromGroup}
                    onAddToGroupItems={handleAddToGroup}
                    onMoveToBack={handleMoveToBack}
                    onMoveToFront={handleMoveToFront}
                    onMoveOneBack={handleMoveOneBack}
                    onMoveOneForward={handleMoveOneForward}
                    isReadOnly={isReadOnly}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
                    animationConnectionsEnabled={animationConnectionsEnabled}
                    animationToggleOnClickEnabled={animationToggleOnClickEnabled}
                    animationFilterSourceIds={effectiveAnimationFilterIds}
                    animationDisabledSources={animationDisabledSources}
                    onAnimationDisabledSourcesChange={setAnimationDisabledSources}
                    onResourceActivateAtPosition={handleResourceActivateAtPosition}
                    metadataPopupsEnabled={metadataPopupsEnabled}
                    setUmlClassEditorModal={setUmlClassEditorModal}
                    />
                  </div>

                  {/* Properties Panel (metadata, item name/type) */}
                  {propertiesPanelVisible && (
                  <PropertiesPanel
                    selectedItem={selectedItem}
                    diagramData={diagramData}
                    onItemUpdate={handleItemUpdate}
                    onConnectionUpdate={handleConnectionUpdate}
                    collapsed={rightPanelCollapsed}
                    onToggleCollapse={() => setRightPanelCollapsed((prev: boolean) => !prev)}
                    isReadOnly={isReadOnly}
                  />
                  )}
                  
                  {/* Layers Panel */}
                  {layers.layersPanelOpen && (
                    <div className="absolute top-4 right-4 z-50">
                      <LayersPanel
                        layers={layers.getAllLayers()}
                        activeLayerId={layers.layersConfig.activeLayerId}
                        selectedItemsLayerIds={selectedItemIds.size > 0 ? 
                          Array.from(selectedItemIds).map(id => layers.getItemLayerById(id)) : []
                        }
                        onAddLayer={layers.addNewLayer}
                        onRemoveLayer={layers.removeLayerById}
                        onRenameLayer={layers.renameLayerById}
                        onToggleVisibility={handleToggleLayerVisibility}
                        onSetActiveLayer={layers.setActiveLayerById}
                        onReorderLayers={layers.reorderLayers}
                        onAssignSelectedItemsToLayer={selectedItemIds.size > 0 ? (layerId: string) => layers.assignItemsToLayer(Array.from(selectedItemIds), layerId) : undefined}
                        onClose={layers.toggleLayersPanel}
                        getLayerItemCount={(layerId: string) => {
                          const items = layers.getLayerItems(layerId);
                          return (items.nodes?.length || 0);
                        }}
                      />
                    </div>
                  )}
                  
                  {jsonPanelOpen && (
                    <div className="flex-shrink-0">
                      <JsonEditorPanel
                        value={diagramData}
                        onValidJsonChange={handleJsonValidChange}
                        isOpen={jsonPanelOpen}
                        onToggleOpen={toggleJsonPanel}
                        widthPx={jsonPanelWidth}
                        onWidthChange={setJsonPanelWidth}
                        isReadOnly={isReadOnly}
                      />
                    </div>
                  )}
                </div>
            </div>
        </main>
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          initialFormat={exportDialogFormat}
          onExport={handleExport}
        />
        {umlClassEditorModal.visible && umlClassEditorModal.itemId && typeof window !== 'undefined' && createPortal(
          <UmlClassEditorModal
            x={umlClassEditorModal.x}
            y={umlClassEditorModal.y}
            visible={umlClassEditorModal.visible}
            onClose={() => setUmlClassEditorModal({ visible: false, x: 0, y: 0, itemId: '' })}
            node={diagramData.nodes?.find((n: DiagramNodeData) => n.id === umlClassEditorModal.itemId) ?? null}
            onSave={(nodeId, umlClass) => {
              const dims = computeUmlClassDimensions(umlClass.name, umlClass.attributes, umlClass.methods);
              setDiagramData((prev: DiagramData) => ({
                ...prev,
                nodes: prev.nodes?.map((n: DiagramNodeData) =>
                  n.id === nodeId ? { ...n, umlClass, width: dims.width, height: dims.height } : n
                ) ?? [],
              }));
              setUmlClassEditorModal({ visible: false, x: 0, y: 0, itemId: '' });
            }}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        {connectionContextModal.connection && typeof window !== 'undefined' && createPortal(
          <ConnectionContextModal
            x={connectionContextModal.x}
            y={connectionContextModal.y}
            visible={connectionContextModal.visible}
            onClose={() => setConnectionContextModal({ visible: false, x: 0, y: 0, connection: null })}
            connection={connectionContextModal.connection}
            diagramData={diagramData}
            onConnectionUpdate={handleConnectionUpdate}
            onConnectionDisconnect={disconnectConnection}
            onConnectionWaypointAdd={handleConnectionWaypointAdd}
            onConnectionWaypointRemove={handleConnectionWaypointRemove}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        <ScratchPad 
          isOpen={scratchPadOpen} 
          onClose={() => setScratchPadOpen(false)} 
          diagramData={diagramData}
          setDiagramData={setDiagramData}
          onCanvasRefresh={refreshCanvas}
          onHistoryUpdate={updateHistory}
        />
        <AlertDialog
          open={animationSelectionDialogOpen}
          onOpenChange={setAnimationSelectionDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply animation setting</AlertDialogTitle>
              <AlertDialogDescription>
                Other selected connections are detected. Do you want to apply this animation setting to all selected connections, or only the current connection?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationApplySelectedConfirm}>Apply to Selected</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationOverwriteDialogOpen}
          onOpenChange={setAnimationOverwriteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Overwrite animation setting</AlertDialogTitle>
              <AlertDialogDescription>
                Some selected connections already have animation settings. These settings will be overwritten by the new setting. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationOverwriteConfirm}>Overwrite and Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationDisableConfirmDialogOpen}
          onOpenChange={setAnimationDisableConfirmDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable animation for selected connections</AlertDialogTitle>
              <AlertDialogDescription>
                This will disable animation for all currently selected connections. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationDisableConfirm}>Disable and Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationCurrentOnlyDialogOpen}
          onOpenChange={setAnimationCurrentOnlyDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Applied to current connection only</AlertDialogTitle>
              <AlertDialogDescription>
                Only the current connection will apply the animation setting.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setAnimationCurrentOnlyDialogOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={closeTabDialogOpen} onOpenChange={setCloseTabDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                This tab has unsaved changes. Do you want to save them before closing?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setPendingCloseTabId(null);
                setCloseTabDialogOpen(false);
              }}>Cancel</AlertDialogCancel>
              <Button variant="outline" onClick={handleCloseTabConfirm}>Don&apos;t Save</Button>
              <Button onClick={handleCloseTabSave}>Save</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndProvider>
  );
}
