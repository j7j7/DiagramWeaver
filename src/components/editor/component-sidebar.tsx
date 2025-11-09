"use client";
import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { DraggableItem } from './draggable-item';
import type { DiagramNodeData, DiagramGroupData, DiagramData } from '@/lib/types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import type { SelectedItem } from '../diagram-editor';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ResourceBrowser } from './resource-browser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface ComponentSidebarProps {
  selectedItem: SelectedItem | null;
  selectedItemIds?: Set<string>;
  onItemUpdate: (updatedItem: SelectedItem) => void;
  onConnect: (connectionOptions?: { style?: 'bezier', curvature?: number }) => void;
  onDisconnect: () => void;
  onItemDelete: (itemToDelete: SelectedItem) => void;
  diagramData: DiagramData;
  onResourceSelect: (resource: { name: string; file: string; }, provider: string, category: string) => void;
  onToggleJsonPanel?: () => void;
  jsonPanelOpen?: boolean;
  onFitToView?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { text?: string; textPosition?: number; color?: string; style?: 'bezier'; curvature?: number; preferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; arrow?: boolean; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean }) => void;
  onConnectionDisconnect?: (from: string, to: string) => void;
  onCloseSidebar?: () => void;
  isMobile?: boolean;
  transform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
}




export function ComponentSidebar({ selectedItem, selectedItemIds, onItemUpdate, onConnect, onDisconnect, onItemDelete, diagramData, onResourceSelect, onToggleJsonPanel, jsonPanelOpen, onFitToView, onConnectionUpdate, onConnectionDisconnect, onCloseSidebar, isMobile, transform, onTransformChange }: ComponentSidebarProps) {
  const { register, reset, getValues } = useForm();
  

  
  // Handler for connect button with default options
  const handleConnectClick = () => {
    onConnect({
      style: 'bezier',
      curvature: 0.6
    });
  };

  useEffect(() => {
    if (selectedItem && selectedItem.itemType !== 'edge') {
      // Initialize new gradient properties from legacy colors for backward compatibility
      const initializedItem = {
        ...selectedItem,
        borderStyle: selectedItem.borderStyle || 'solid',
        borderColors: selectedItem.borderColors || [
          selectedItem.borderColor || (selectedItem.subType === 'zone' ? '#6b7280' : '#3b82f6'),
          selectedItem.borderColor || (selectedItem.subType === 'zone' ? '#6b7280' : '#3b82f6')
        ],
        backgroundStyle: selectedItem.backgroundStyle || 'solid',
        backgroundColors: selectedItem.backgroundColors || [
          selectedItem.backgroundColor || (selectedItem.subType === 'zone' ? '#f3f4f6' : '#f3f4f6'),
          selectedItem.backgroundColor || (selectedItem.subType === 'zone' ? '#e5e7eb' : '#e5e7eb')
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
  }, [selectedItem, reset]);

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
    
    const parent = (diagramData.groups || []).find(g => (g.children || (g as any).nodes || []).includes(selectedItem.id));
    
    const itemId = selectedItem.id;
    const nodesById = new Map(diagramData.nodes.map(n => [n.id, n]));
    const groupsById = new Map((diagramData.groups || []).map(g => [g.id, g]));

    const incoming = (diagramData.connections || [])
      .filter((edge: any) => edge.to === itemId)
      .map((edge: any) => ({
        connection: edge,
        label: nodesById.get(edge.from)?.label || groupsById.get(edge.from)?.label || edge.from
      }))
      .filter(item => item.label);
      
    const outgoing = (diagramData.connections || [])
      .filter((edge: any) => edge.from === itemId)
      .map((edge: any) => ({
        connection: edge,
        label: nodesById.get(edge.to)?.label || groupsById.get(edge.to)?.label || edge.to
      }))
      .filter(item => item.label);

    return { incoming, outgoing, parentGroup: parent };
  }, [selectedItem, diagramData]);


return (
    <aside className="w-80 bg-card border-r flex flex-col h-full">
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
        />
      </div>
    </aside>
  );
}
