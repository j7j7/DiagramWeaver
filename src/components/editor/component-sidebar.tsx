"use client";
import React, { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DraggableItem } from './draggable-item';
import type { DiagramNodeData, DiagramGroupData, DiagramData, UserDefinedObject } from '@/lib/types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import type { SelectedItem } from '../diagram-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ResourceBrowser } from './resource-browser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import type { CustomImageOptions } from '@/lib/types';

interface ComponentSidebarProps {
  selectedItem: SelectedItem | null;
  selectedItemIds?: Set<string>;
  onItemUpdate: (updatedItem: SelectedItem) => void;
  onConnect: (connectionOptions?: { style?: 'bezier', curvature?: number; sourceItemId?: string }) => void;
  onDisconnect: () => void;
  onItemDelete: (itemToDelete: SelectedItem) => void;
  diagramData: DiagramData;
  onResourceSelect: (resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: CustomImageOptions }, provider: string, category: string) => void;
  onResourceActivate?: (resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: CustomImageOptions }, provider: string, category: string, fullItem?: object) => void;
  onToggleJsonPanel?: () => void;
  jsonPanelOpen?: boolean;
  onFitToView?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { text?: string; textPosition?: number; color?: string; style?: 'bezier'; curvature?: number; preferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; arrow?: boolean; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean }, connectionId?: string) => void;
  onConnectionDisconnect?: (from: string, to: string, connectionId?: string) => void;
  onCloseSidebar?: () => void;
  isMobile?: boolean;
  transform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
  isReadOnly?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  userDefinedObjectsLibrary?: Record<string, UserDefinedObject>;
  onUserDefinedObjectActivate?: (object: UserDefinedObject) => void;
}




export function ComponentSidebar({ selectedItem, selectedItemIds, onItemUpdate, onConnect, onDisconnect, onItemDelete, diagramData, onResourceSelect, onResourceActivate, onToggleJsonPanel, jsonPanelOpen, onFitToView, onConnectionUpdate, onConnectionDisconnect, onCloseSidebar, isMobile, transform, onTransformChange, isReadOnly = false, collapsed = false, onToggleCollapse, userDefinedObjectsLibrary, onUserDefinedObjectActivate }: ComponentSidebarProps) {
  const { register, reset, getValues } = useForm();

  const selectedItemRef = useRef(selectedItem);
  selectedItemRef.current = selectedItem;

  /**
   * `selectedItem` from the editor often gets a new object reference each render (hydration, geometry sync).
   * Depending on `selectedItem` in an effect that calls `reset()` → max update depth. Sync only when a
   * stable fingerprint of form-relevant fields changes; read the latest item from a ref inside the effect.
   */
  const sidebarFormSyncSignature = useMemo(() => {
    if (!selectedItem) return 'none';
    if (selectedItem.itemType === 'edge') return `edge:${selectedItem.id}`;
    const s = selectedItem as unknown as Record<string, unknown>;
    const pick = {
      id: s.id,
      itemType: s.itemType,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      label: s.label,
      info: s.info,
      tag: s.tag,
      borderStyle: s.borderStyle,
      borderColors: s.borderColors,
      backgroundStyle: s.backgroundStyle,
      backgroundColors: s.backgroundColors,
      borderColor: s.borderColor,
      backgroundColor: s.backgroundColor,
      textColor: s.textColor,
      orientation: s.orientation,
      lineColor: s.lineColor,
      maxItemsPerRow: s.maxItemsPerRow,
      shadow: s.shadow,
      rotation: s.rotation,
    };
    try {
      return JSON.stringify(pick);
    } catch {
      return `${String(s.id)}:${String(s.itemType)}`;
    }
  }, [selectedItem]);

  
  // Handler for connect button with default options
  const handleConnectClick = () => {
    onConnect({
      style: 'bezier',
      curvature: 0.6
    });
  };

  useEffect(() => {
    const si = selectedItemRef.current;
    if (si && si.itemType !== 'edge') {
      // Initialize new gradient properties from legacy colors for backward compatibility
      const initializedItem = {
        ...si,
        borderStyle: si.borderStyle || 'solid',
        borderColors: si.borderColors || [
          si.borderColor || '#3b82f6',
          si.borderColor || '#3b82f6'
        ],
        backgroundStyle: si.backgroundStyle || 'solid',
        backgroundColors: si.backgroundColors || [
          si.backgroundColor || '#f3f4f6',
          si.backgroundColor || '#e5e7eb'
        ]
      };
      reset(initializedItem);
    } else {
      reset({ 
        label: '', 
        info: '', 
        borderColor: '#6b7280',
        textColor: '#374151',
        backgroundColor: '#f3f4f6',
        borderStyle: 'solid',
        borderColors: ['#6b7280', '#6b7280'],
        backgroundStyle: 'solid',
        backgroundColors: ['#f3f4f6', '#f3f4f6'],
        orientation: 'square',
        lineColor: '#6b7280',
        maxItemsPerRow: 3,
        shadow: false
      });
    }
  }, [sidebarFormSyncSignature, reset]);

  const handleBlur = () => {
    if(selectedItem) {
        const currentValues = getValues();
        const updatedItem = { ...selectedItem, ...currentValues };
        
        
        // Prevent infinite loop by checking for actual changes
        const hasChanged = Object.keys(currentValues).some(key => {
            const initialValue = selectedItem[key as keyof SelectedItem];
            const currentValue = currentValues[key as string];
            return initialValue !== currentValue;
        });

        if (hasChanged) {
            onItemUpdate(updatedItem);
        }
    }
  };


  const { incoming, outgoing, parentGroup } = useMemo(() => {
    if (!selectedItem || !diagramData) return { incoming: [], outgoing: [], parentGroup: null };
    
    const parent = (diagramData.zones || []).find(zone => (zone.children || (zone as any).nodes || []).includes(selectedItem.id));
    
    const itemId = selectedItem.id;
    const nodesById = new Map(diagramData.nodes.map(n => [n.id, n]));
    const zonesById = new Map((diagramData.zones || []).map(zone => [zone.id, zone]));

    const incoming = (diagramData.connections || [])
      .filter((edge: any) => edge.to === itemId)
      .map((edge: any) => ({
        connection: edge,
        label: nodesById.get(edge.from)?.label || zonesById.get(edge.from)?.label || edge.from
      }))
      .filter(item => item.label);
      
    const outgoing = (diagramData.connections || [])
      .filter((edge: any) => edge.from === itemId)
      .map((edge: any) => ({
        connection: edge,
        label: nodesById.get(edge.to)?.label || zonesById.get(edge.to)?.label || edge.to
      }))
      .filter(item => item.label);

    return { incoming, outgoing, parentGroup: parent };
  }, [selectedItem, diagramData]);


  if (collapsed) {
    return (
      <aside className="w-12 bg-card border-r flex flex-col h-full flex-shrink-0" data-tutorial-id="component-sidebar">
        <div className="flex flex-col items-center p-2 gap-2">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-md hover:bg-muted touch-target"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180 py-2 text-muted-foreground whitespace-nowrap">Diagram Weaver</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-card border-r flex flex-col h-full flex-shrink-0" data-tutorial-id="component-sidebar">
      {/* Header: app name + collapse button */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h1 className="font-semibold text-base">Diagram Weaver</h1>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-md hover:bg-muted -mr-2 touch-target"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Mobile close button */}
      {isMobile && onCloseSidebar && (
        <div className="flex justify-end p-2 border-b md:hidden">
          <button
            onClick={onCloseSidebar}
            className="p-2 rounded-md hover:bg-muted touch-target"
            aria-label="Close sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ResourceBrowser
          onResourceSelect={onResourceSelect}
          onResourceActivate={onResourceActivate}
          userDefinedObjectsLibrary={userDefinedObjectsLibrary}
          diagramData={diagramData}
          onUserDefinedObjectActivate={onUserDefinedObjectActivate}
        />
      </div>
    </aside>
  );
}
