"use client";
import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { DraggableItem } from './draggable-item';
import { Download, Upload, Plus, Code, Maximize2, ImageDown, Undo, Redo } from 'lucide-react';
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
  onConnect: (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number }) => void;
  onDisconnect: () => void;
  onItemDelete: (itemToDelete: SelectedItem) => void;
  diagramData: DiagramData;
  onSave: () => void;
  onLoad: () => void;
  onNew: () => void;
  onResourceSelect: (resource: { name: string; file: string; }, provider: string, category: string) => void;
  onToggleJsonPanel?: () => void;
  jsonPanelOpen?: boolean;
  onFitToView?: () => void;
  onExportPng?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { text?: string; textPosition?: number; color?: string; style?: 'pathways' | 'bezier'; curvature?: number; preferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; arrow?: boolean; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean }) => void;
  onCloseSidebar?: () => void;
  isMobile?: boolean;
  transform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}




export function ComponentSidebar({ selectedItem, selectedItemIds, onItemUpdate, onConnect, onDisconnect, onItemDelete, diagramData, onSave, onLoad, onNew, onResourceSelect, onToggleJsonPanel, jsonPanelOpen, onFitToView, onExportPng, onConnectionUpdate, onCloseSidebar, isMobile, transform, onTransformChange, onUndo, onRedo, canUndo, canRedo }: ComponentSidebarProps) {
  const { register, reset, getValues } = useForm();
  
  // State for default connection settings
  const [defaultConnectionStyle, setDefaultConnectionStyle] = React.useState<'pathways' | 'bezier'>('bezier');
  const [defaultCurvature, setDefaultCurvature] = React.useState<number>(0.5);

  // Handler for connect button with default options
  const handleConnectClick = () => {
    onConnect({
      style: defaultConnectionStyle,
      curvature: defaultConnectionStyle === 'bezier' ? defaultCurvature : undefined
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
      <div className="p-4 border-b flex-shrink-0">
        {/* Mobile close button */}
        {isMobile && onCloseSidebar && (
          <div className="flex justify-end mb-2 md:hidden">
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
        <div className="flex items-center gap-2 mb-4 touch-spacing">
            <Button variant="outline" size="sm" onClick={onNew} className="flex-1 touch-target"><Plus className="mr-2 h-4 w-4"/>New</Button>
            <Button variant="outline" size="sm" onClick={onSave} className="flex-1 touch-target"><Download className="mr-2 h-4 w-4"/>Save</Button>
            <Button variant="outline" size="sm" onClick={onLoad} className="flex-1 touch-target"><Upload className="mr-2 h-4 w-4"/>Load</Button>
        </div>
        {onToggleJsonPanel && (
          <div className="mb-2">
            <Button 
              variant={jsonPanelOpen ? "default" : "outline"} 
              onClick={onToggleJsonPanel} 
              className="w-full touch-target"
            >
              <Code className="mr-2 h-4 w-4"/>
              {jsonPanelOpen ? 'Hide JSON' : 'Show JSON'}
            </Button>
          </div>
        )}
        {onFitToView && (
          <div className="mb-2">
            <Button variant="outline" onClick={onFitToView} className="w-full touch-target">
              <Maximize2 className="mr-2 h-4 w-4" />
              Fit to view
            </Button>
          </div>
        )}
        {onExportPng && (
          <div className="mb-2">
            <Button variant="outline" onClick={onExportPng} className="w-full touch-target">
              <ImageDown className="mr-2 h-4 w-4" />
              Export PNG
            </Button>
          </div>
        )}
        {(onUndo || onRedo) && (
          <div className="mb-4 flex gap-2">
            {onUndo && (
              <Button 
                variant="outline" 
                onClick={onUndo} 
                disabled={!canUndo}
                className="flex-1 touch-target"
              >
                <Undo className="mr-2 h-4 w-4" />
                Undo
              </Button>
            )}
            {onRedo && (
              <Button 
                variant="outline" 
                onClick={onRedo} 
                disabled={!canRedo}
                className="flex-1 touch-target"
              >
                <Redo className="mr-2 h-4 w-4" />
                Redo
              </Button>
            )}
          </div>
        )}
      </div>
      
      <Tabs defaultValue="resources" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="resources" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col min-h-0 overflow-hidden">
          <ResourceBrowser
            onResourceSelect={onResourceSelect}
          />
        </TabsContent>
        
        <TabsContent value="details" className="flex-1 m-0 p-4 data-[state=active]:flex data-[state=active]:flex-col min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 h-full">
            {selectedItem ? (
              <form onBlur={handleBlur} onSubmit={(e) => e.preventDefault()} className="space-y-4 pr-4">
                <div>
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" {...register('label')} />
                </div>
                
                {selectedItem.itemType === 'group' && (
                  <div>
                    <Label htmlFor="textPosition">Text Position</Label>
                    <Select 
                      value={selectedItem.textPosition || (selectedItem.subType === 'zone' ? 'top-left' : '')}
                      onValueChange={(value) => {
                        const updatedItem = {
                          ...selectedItem,
                          textPosition: value as 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'inside'
                        };
                        onItemUpdate(updatedItem as unknown as SelectedItem);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={selectedItem.subType === 'zone' ? 'Top Left (Default)' : 'Bottom Right (Default)'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top-left">Top Left</SelectItem>
                        <SelectItem value="top-center">Top Center</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="bottom-center">Bottom Center</SelectItem>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedItem.subType === 'zone' 
                        ? 'Position text inline with zone border' 
                        : 'Position text inside or outside the group'
                      }
                    </p>
                  </div>
                )}
                
                <div>
                    <Label htmlFor="info">Description</Label>
                    <Textarea id="info" {...register('info')} rows={5} />
                </div>
  {selectedItem.itemType === 'group' && (
                  <>
                    <div>
                      <Label htmlFor="orientation">Orientation</Label>
                      <Select 
                        value={selectedItem?.orientation || 'square'} 
                        onValueChange={(value) => {
                          const updatedItem = { 
                            ...selectedItem, 
                            orientation: value as 'horizontal' | 'vertical' | 'square'
                          };
                          onItemUpdate(updatedItem);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select orientation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="square">Square</SelectItem>
                          <SelectItem value="horizontal">Horizontal Rectangle</SelectItem>
                          <SelectItem value="vertical">Vertical Rectangle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(selectedItem.orientation === 'horizontal' || selectedItem.orientation === 'square') && (
                      <div>
                        <Label htmlFor="maxItemsPerRow">Max Items Per Row</Label>
                        <Input 
                          id="maxItemsPerRow" 
                          type="number" 
                          min="1" 
                          max="10"
                          {...register('maxItemsPerRow', { valueAsNumber: true })} 
                          className="p-1 h-10"
                          defaultValue={selectedItem.maxItemsPerRow || 3}
                        />
                      </div>
                    )}
                    
                    {/* Resize Controls */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="sizeMode">Sizing Mode</Label>
                        <Select 
                          value={selectedItem?.sizeMode || 'auto'} 
                          onValueChange={(value) => {
                            const updatedItem = { 
                              ...selectedItem, 
                              sizeMode: value as 'auto' | 'custom'
                            };
                            // If switching to custom, use current computed dimensions as starting point
                            if (value === 'custom' && !selectedItem.width && !selectedItem.height) {
                              // Try to find current computed dimensions from the canvas
                              // This is a reasonable default - the user can adjust from here
                              updatedItem.width = 300;
                              updatedItem.height = 220;
                            }
                            onItemUpdate(updatedItem);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select sizing mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (Fit Content)</SelectItem>
                            <SelectItem value="custom">Custom (Manual Resize)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto: Size calculated from content. Custom: Manual sizing with drag handles.
                        </p>
                      </div>
                      
                      {selectedItem?.sizeMode === 'custom' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="customWidth">Width (px)</Label>
                              <Input 
                                id="customWidth" 
                                type="number" 
                                min="100" 
                                step="20"
                                value={selectedItem?.width || 300}
                                onChange={(e) => {
                                  const newWidth = parseInt(e.target.value) || 300;
                                  onItemUpdate({
                                    ...selectedItem,
                                    width: newWidth
                                  });
                                }}
                                className="p-1 h-10"
                              />
                            </div>
                            <div>
                              <Label htmlFor="customHeight">Height (px)</Label>
                              <Input 
                                id="customHeight" 
                                type="number" 
                                min="100" 
                                step="20"
                                value={selectedItem?.height || 220}
                                onChange={(e) => {
                                  const newHeight = parseInt(e.target.value) || 220;
                                  onItemUpdate({
                                    ...selectedItem,
                                    height: newHeight
                                  });
                                }}
                                className="p-1 h-10"
                              />
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>• Drag right or bottom edges of the group to resize</p>
                            <p>• Values snap to 20px grid</p>
                            <p>• Minimum size enforced based on content</p>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="borderStyle">Border Style</Label>
                      <Select 
                        value={selectedItem.borderStyle || 'solid'}
                        onValueChange={(value) => {
                          onItemUpdate({
                            ...selectedItem,
                            borderStyle: value as 'solid' | 'gradient'
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select border style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="gradient">Gradient</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(selectedItem.borderStyle === 'solid' || !selectedItem.borderStyle) ? (
                      <div>
                        <Label htmlFor="borderColor">Border Color</Label>
                        <Input 
                          id="borderColor" 
                          type="color" 
                          value={selectedItem.borderColor || (selectedItem.subType === 'zone' ? '#6b7280' : '#3b82f6')}
                          onChange={(e) => {
                            onItemUpdate({
                              ...selectedItem,
                              borderColor: e.target.value
                            });
                          }}
                          className="p-1 h-10"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="borderColor1">Border Start Color</Label>
                          <Input 
                            id="borderColor1" 
                            type="color" 
                            value={selectedItem.borderColors?.[0] || '#6b7280'}
                            onChange={(e) => {
                              const currentColors = selectedItem.borderColors || ['#6b7280', '#3b82f6'];
                              onItemUpdate({
                                ...selectedItem,
                                borderColors: [e.target.value, currentColors[1]]
                              });
                            }}
                            className="p-1 h-10"
                          />
                        </div>
                        <div>
                          <Label htmlFor="borderColor2">Border End Color</Label>
                          <Input 
                            id="borderColor2" 
                            type="color" 
                            value={selectedItem.borderColors?.[1] || '#3b82f6'}
                            onChange={(e) => {
                              const currentColors = selectedItem.borderColors || ['#6b7280', '#3b82f6'];
                              onItemUpdate({
                                ...selectedItem,
                                borderColors: [currentColors[0], e.target.value]
                              });
                            }}
                            className="p-1 h-10"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="textColor">Text Color</Label>
                      <Input 
                        id="textColor" 
                        type="color" 
                        {...register('textColor')} 
                        className="p-1 h-10"
                        defaultValue={selectedItem.textColor || '#374151'}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="backgroundStyle">Background Style</Label>
                      <Select 
                        value={selectedItem.backgroundStyle || 'solid'}
                        onValueChange={(value) => {
                          onItemUpdate({
                            ...selectedItem,
                            backgroundStyle: value as 'solid' | 'gradient'
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select background style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="gradient">Gradient</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(selectedItem.backgroundStyle === 'solid' || !selectedItem.backgroundStyle) ? (
                      <div>
                        <Label htmlFor="backgroundColor">Background Color</Label>
                        <Input 
                          id="backgroundColor" 
                          type="color" 
                          value={selectedItem.backgroundColor || (selectedItem.subType === 'zone' ? '#f3f4f6' : '#f3f4f6')}
                          onChange={(e) => {
                            onItemUpdate({
                              ...selectedItem,
                              backgroundColor: e.target.value
                            });
                          }}
                          className="p-1 h-10"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="backgroundColor1">Background Start Color</Label>
                          <Input 
                            id="backgroundColor1" 
                            type="color" 
                            value={selectedItem.backgroundColors?.[0] || '#f3f4f6'}
                            onChange={(e) => {
                              const currentColors = selectedItem.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                              onItemUpdate({
                                ...selectedItem,
                                backgroundColors: [e.target.value, currentColors[1]]
                              });
                            }}
                            className="p-1 h-10"
                          />
                        </div>
                        <div>
                          <Label htmlFor="backgroundColor2">Background End Color</Label>
                          <Input 
                            id="backgroundColor2" 
                            type="color" 
                            value={selectedItem.backgroundColors?.[1] || '#e5e7eb'}
                            onChange={(e) => {
                              const currentColors = selectedItem.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                              onItemUpdate({
                                ...selectedItem,
                                backgroundColors: [currentColors[0], e.target.value]
                              });
                            }}
                            className="p-1 h-10"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <input
                        id="shadow"
                        type="checkbox"
                        {...register('shadow')}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        defaultChecked={selectedItem.shadow || false}
                      />
                      <Label htmlFor="shadow" className="text-sm font-medium">
                        Show Shadow
                      </Label>
                    </div>
                  </>
                )}

                {(selectedItem.itemType === 'node' || selectedItem.itemType === 'group') && (
                  <>
                    {(selectedItem.type === 'generic.text.label' || selectedItem.type === 'generic.text.text' || 
                      selectedItem.type === 'generic.text.textbox' || selectedItem.type === 'generic.text.labelbox' ||
                      selectedItem.type === 'generic.text.square' || selectedItem.type === 'generic.text.circle' || 
                      selectedItem.type === 'generic.text.rectangle' || selectedItem.type === 'generic.text.triangle') && (
                      <>
                        {selectedItem.type === 'generic.text.label' && (
                          <>
                            <div>
                              <Label htmlFor="borderColor">Border Color</Label>
                              <Input 
                                id="borderColor" 
                                type="color" 
                                value={(selectedItem as any).borderColor || '#d1d5db'}
                                onChange={(e) => {
                                  onItemUpdate({
                                    ...selectedItem,
                                    borderColor: e.target.value
                                  });
                                }}
                                className="p-1 h-10"
                              />
                            </div>
                            <div>
                              <Label htmlFor="backgroundColor">Background Color</Label>
                              <Input 
                                id="backgroundColor" 
                                type="color" 
                                value={(selectedItem as any).backgroundColor || '#f3f4f6'}
                                onChange={(e) => {
                                  onItemUpdate({
                                    ...selectedItem,
                                    backgroundColor: e.target.value
                                  });
                                }}
                                className="p-1 h-10"
                              />
                            </div>
                            <div>
                              <Label htmlFor="textColor">Text Color</Label>
                              <Input 
                                id="textColor" 
                                type="color" 
                                value={(selectedItem as any).textColor || '#374151'}
                                onChange={(e) => {
                                  onItemUpdate({
                                    ...selectedItem,
                                    textColor: e.target.value
                                  });
                                }}
                                className="p-1 h-10"
                              />
                            </div>
                          </>
                        )}
                        {(selectedItem.type === 'generic.text.textbox' || selectedItem.type === 'generic.text.labelbox') && (
                          <>
                            <div>
                              <Label htmlFor="sizeMode">Sizing Mode</Label>
                              <Select 
                                value={(selectedItem as any).sizeMode || 'auto'} 
                                onValueChange={(value) => {
                                  const updatedItem = { 
                                    ...selectedItem, 
                                    sizeMode: value as 'auto' | 'custom'
                                  };
                                  // If switching to custom, use current dimensions as starting point
                                  if (value === 'custom' && !(selectedItem as any).width && !(selectedItem as any).height) {
                                    // Try to find current computed dimensions - reasonable defaults
                                    updatedItem.width = selectedItem.type === 'generic.text.textbox' ? 200 : 160;
                                    updatedItem.height = selectedItem.type === 'generic.text.textbox' ? 120 : 100;
                                  }
                                  onItemUpdate(updatedItem as unknown as SelectedItem);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select sizing mode" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">Auto (Fit Content)</SelectItem>
                                  <SelectItem value="custom">Custom (Manual Size)</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Auto: Size based on text content. Custom: Manual width/height.
                              </p>
                            </div>
                            
                            {(selectedItem as any).sizeMode === 'custom' && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor="customWidth">Width (px)</Label>
                                    <Input 
                                      id="customWidth" 
                                      type="number" 
                                      min="100" 
                                      step="10"
                                      value={(selectedItem as any).width || (selectedItem.type === 'generic.text.textbox' ? 200 : 160)}
                                      onChange={(e) => {
                                        const newWidth = parseInt(e.target.value) || (selectedItem.type === 'generic.text.textbox' ? 200 : 160);
                                        onItemUpdate({
                                          ...selectedItem,
                                          width: newWidth
                                        } as unknown as SelectedItem);
                                      }}
                                      className="p-1 h-10"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="customHeight">Height (px)</Label>
                                    <Input 
                                      id="customHeight" 
                                      type="number" 
                                      min="80" 
                                      step="10"
                                      value={(selectedItem as any).height || (selectedItem.type === 'generic.text.textbox' ? 120 : 100)}
                                      onChange={(e) => {
                                        const newHeight = parseInt(e.target.value) || (selectedItem.type === 'generic.text.textbox' ? 120 : 100);
                                        onItemUpdate({
                                          ...selectedItem,
                                          height: newHeight
                                        } as unknown as SelectedItem);
                                      }}
                                      className="p-1 h-10"
                                    />
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <p>• Minimum: {selectedItem.type === 'generic.text.textbox' ? '200x120px' : '160x100px'}</p>
                                  <p>• Values snap to 10px grid</p>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        
                        {(selectedItem.type === 'generic.text.square' || selectedItem.type === 'generic.text.circle' || 
                          selectedItem.type === 'generic.text.rectangle' || selectedItem.type === 'generic.text.triangle') && (
                          <>
                            <div>
                              <Label htmlFor="backgroundColor">Shape Color</Label>
                              <Input 
                                id="backgroundColor" 
                                type="color" 
                                value={(selectedItem as any).backgroundColor || '#6b7280'}
                                onChange={(e) => {
                                  onItemUpdate({
                                    ...selectedItem,
                                    backgroundColor: e.target.value
                                  });
                                }}
                                className="p-1 h-10"
                              />
                            </div>
                            <div>
                              <Label htmlFor="textPosition">Text Position</Label>
                              <Select 
                                value={(selectedItem as any).textPosition || 'under'}
                                onValueChange={(value) => {
                                  const updatedItem = {
                                    ...selectedItem,
                                    textPosition: value as 'above' | 'center' | 'under'
                                  };
                                  onItemUpdate(updatedItem as unknown as SelectedItem);
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select text position" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="above">Above</SelectItem>
                                  <SelectItem value="center">Center</SelectItem>
                                  <SelectItem value="under">Under (Default)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                        <div>
                          <Label htmlFor="rotation">Rotation</Label>
                          <Select 
                            value={String((selectedItem as any).rotation || 0)}
                            onValueChange={(value) => {
                              onItemUpdate({
                                ...selectedItem,
                                rotation: parseInt(value)
                              });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select rotation" />
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
                      </>
                    )}
                    
                    {/* Freeflow option - only for nodes */}
                    {selectedItem.itemType === 'node' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="freeflow"
                          checked={(selectedItem as any).freeflow || false}
                          onChange={(e) => {
                            onItemUpdate({
                              ...selectedItem,
                              freeflow: e.target.checked
                            });
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="freeflow" className="text-sm font-medium">
                          Freeflow Mode
                        </Label>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="lineColor">Line Color</Label>
                      <Input 
                        id="lineColor" 
                        type="color" 
                        {...register('lineColor')} 
                        className="p-1 h-10"
                        defaultValue={selectedItem.lineColor || '#6b7280'}
                      />
                    </div>
                  </>
                )}
                
                {selectedItem.itemType === 'node' && parentGroup && (
                  <div>
                    <Label htmlFor="edgePosition">Edge Position</Label>
                    <Select 
                      value={selectedItem.edgePosition || 'none'}
                      onValueChange={(value) => {
                        onItemUpdate({
                          ...selectedItem,
                          edgePosition: value === 'none' ? undefined : value as 'top' | 'bottom' | 'left' | 'right'
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Position within group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Normal (Inside)</SelectItem>
                        <SelectItem value="top">Top Edge</SelectItem>
                        <SelectItem value="bottom">Bottom Edge</SelectItem>
                        <SelectItem value="left">Left Edge</SelectItem>
                        <SelectItem value="right">Right Edge</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Position node on the edge of parent group</p>
                  </div>
                )}
                
                
                {parentGroup && (
                    <div>
                        <Label>Parent Group</Label>
                        <p className='text-sm text-muted-foreground p-2 bg-muted rounded-md'>{parentGroup.label}</p>
                    </div>
                )}
                
                <p className="text-sm text-muted-foreground break-words">ID: {selectedItem.id}</p>
                
                {/* Connection Options */}
                {(selectedItem.itemType === 'node' || selectedItem.itemType === 'group') && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="connectionStyle">Default Connection Style</Label>
                      <Select 
                        value={defaultConnectionStyle}
                        onValueChange={(value) => setDefaultConnectionStyle(value as 'pathways' | 'bezier')}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select connection style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pathways">Pathways (Angular)</SelectItem>
                          <SelectItem value="bezier">Bezier (Curved)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {defaultConnectionStyle === 'bezier' && (
                      <div>
                        <Label htmlFor="defaultCurvature">Default Curve Intensity</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="defaultCurvature"
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={defaultCurvature}
                            onChange={(e) => setDefaultCurvature(parseFloat(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-sm text-muted-foreground w-8">{defaultCurvature.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2">
                    {(selectedItem.itemType === 'node' || selectedItem.itemType === 'group') && (
                      <>
                        <Button type="button" onClick={handleConnectClick} className="w-full">
                          Connect
                        </Button>
                        <Button type="button" variant="secondary" onClick={onDisconnect} className="w-full">
                          Disconnect
                        </Button>
                      </>
                    )}
                    <Button type="button" variant="destructive" onClick={() => onItemDelete(selectedItem)} className="w-full">
                      Delete
                    </Button>
                </div>

                {(selectedItem.itemType === 'node' || selectedItem.itemType === 'group') && (
                  <div>
                    <h3 className="text-md font-semibold mt-4 mb-2">Connections</h3>
                    <div className="text-sm space-y-4">
                      <div>
                        <h4 className="font-medium text-muted-foreground">Incoming ({incoming.length})</h4>
                        <div className="space-y-2 mt-2">
                          {incoming.length > 0 ? incoming.map((item, i) => (
                            <div key={i} className="pl-2 border-l-2 ml-1 space-y-2">
                              <div className="font-medium text-xs">{item.label}</div>
<div>
                                 <Label htmlFor={`incoming-text-${i}`} className="text-xs text-muted-foreground">Connection Text</Label>
                                 <Textarea
                                    id={`incoming-text-${i}`}
                                    placeholder="Add text... (Use Enter for new line)"
                                    value={item.connection.text || ''}
                                    onChange={(e) => {
                                      if (onConnectionUpdate) {
                                        onConnectionUpdate(item.connection.from, item.connection.to, { text: e.target.value });
                                      }
                                    }}
                                    className="h-16 text-xs resize-none"
                                    rows={2}
                                  />
                               </div>
                               {item.connection.text && (
                                 <div>
                                   <Label htmlFor={`incoming-text-position-${i}`} className="text-xs text-muted-foreground">Text Position</Label>
                                   <div className="flex items-center gap-2">
                                     <Input
                                       id={`incoming-text-position-${i}`}
                                       type="range"
                                       min="0"
                                       max="100"
                                       value={item.connection.textPosition || 50}
                                       onChange={(e) => {
                                         if (onConnectionUpdate) {
                                           onConnectionUpdate(item.connection.from, item.connection.to, { 
                                             textPosition: parseInt(e.target.value)
                                           });
                                         }
                                       }}
                                       className="flex-1 h-8"
                                     />
                                     <span className="text-xs text-muted-foreground w-10">{item.connection.textPosition || 50}%</span>
                                   </div>
                                 </div>
                               )}
                              <div>
                                <Label htmlFor={`incoming-entry-${i}`} className="text-xs text-muted-foreground">Preferred Entry (To)</Label>
                                <Select 
                                  value={item.connection.toPreferredEntry || 'none'}
                                   onValueChange={(value) => {
                                     if (onConnectionUpdate) {
                                       onConnectionUpdate(item.connection.from, item.connection.to, { 
                                         toPreferredEntry: value === 'none' ? undefined : value as 'top' | 'bottom' | 'left' | 'right' | 'center'
                                       });
                                     }
                                   }}
                                 >
                                   <SelectTrigger className="w-full h-8">
                                     <SelectValue placeholder="Select direction" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="none">None (Auto)</SelectItem>
                                     <SelectItem value="top">Top</SelectItem>
                                     <SelectItem value="bottom">Bottom</SelectItem>
                                     <SelectItem value="left">Left</SelectItem>
                                     <SelectItem value="right">Right</SelectItem>
                                     <SelectItem value="center">Center</SelectItem>
                                   </SelectContent>
                                 </Select>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  id={`incoming-arrow-${i}`}
                                  type="checkbox"
                                  checked={item.connection.toArrow === true}
                                  onChange={(e) => {
                                    if (onConnectionUpdate) {
                                      onConnectionUpdate(item.connection.from, item.connection.to, { 
                                        toArrow: e.target.checked
                                      });
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor={`incoming-arrow-${i}`} className="text-xs text-muted-foreground">
                                  Show Arrow (To)
                                </Label>
                              </div>
                            </div>
                          )) : <p className="text-xs text-muted-foreground pl-2">None</p>}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-muted-foreground">Outgoing ({outgoing.length})</h4>
                        <div className="space-y-2 mt-2">
                          {outgoing.length > 0 ? outgoing.map((item, i) => (
                            <div key={i} className="pl-2 border-l-2 ml-1 space-y-2">
                              <div className="font-medium text-xs">{item.label}</div>
<div>
                                 <Label htmlFor={`outgoing-text-${i}`} className="text-xs text-muted-foreground">Connection Text</Label>
                                  <Textarea
                                    id={`outgoing-text-${i}`}
                                    placeholder="Add text... (Use Enter for new line)"
                                    value={item.connection.text || ''}
                                    onChange={(e) => {
                                      if (onConnectionUpdate) {
                                        onConnectionUpdate(item.connection.from, item.connection.to, { text: e.target.value });
                                      }
                                    }}
                                    className="h-16 text-xs resize-none"
                                    rows={2}
                                  />
                               </div>
                               {item.connection.text && (
                                 <div>
                                   <Label htmlFor={`outgoing-text-position-${i}`} className="text-xs text-muted-foreground">Text Position</Label>
                                   <div className="flex items-center gap-2">
                                     <Input
                                       id={`outgoing-text-position-${i}`}
                                       type="range"
                                       min="0"
                                       max="100"
                                       value={item.connection.textPosition || 50}
                                       onChange={(e) => {
                                         if (onConnectionUpdate) {
                                           onConnectionUpdate(item.connection.from, item.connection.to, { 
                                             textPosition: parseInt(e.target.value)
                                           });
                                         }
                                       }}
                                       className="flex-1 h-8"
                                     />
                                     <span className="text-xs text-muted-foreground w-10">{item.connection.textPosition || 50}%</span>
                                   </div>
                                 </div>
                               )}
                              <div>
                                <Label htmlFor={`outgoing-exit-${i}`} className="text-xs text-muted-foreground">Preferred Exit (From)</Label>
                                <Select 
                                  value={item.connection.fromPreferredExit || 'none'}
                                   onValueChange={(value) => {
                                     if (onConnectionUpdate) {
                                       onConnectionUpdate(item.connection.from, item.connection.to, { 
                                         fromPreferredExit: value === 'none' ? undefined : value as 'top' | 'bottom' | 'left' | 'right' | 'center'
                                       });
                                     }
                                   }}
                                 >
                                   <SelectTrigger className="w-full h-8">
                                     <SelectValue placeholder="Select direction" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="none">None (Auto)</SelectItem>
                                     <SelectItem value="top">Top</SelectItem>
                                     <SelectItem value="bottom">Bottom</SelectItem>
                                     <SelectItem value="left">Left</SelectItem>
                                     <SelectItem value="right">Right</SelectItem>
                                     <SelectItem value="center">Center</SelectItem>
                                   </SelectContent>
                                 </Select>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  id={`outgoing-arrow-${i}`}
                                  type="checkbox"
                                  checked={item.connection.fromArrow === true}
                                  onChange={(e) => {
                                    if (onConnectionUpdate) {
                                      onConnectionUpdate(item.connection.from, item.connection.to, { 
                                        fromArrow: e.target.checked
                                      });
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor={`outgoing-arrow-${i}`} className="text-xs text-muted-foreground">
                                  Show Arrow (From)
                                </Label>
                               </div>
                               <div>
                                 <Label htmlFor={`outgoing-style-${i}`} className="text-xs text-muted-foreground">Connection Style</Label>
                                 <Select 
                                   value={item.connection.style || 'pathways'}
                                   onValueChange={(value) => {
                                     if (onConnectionUpdate) {
                                       onConnectionUpdate(item.connection.from, item.connection.to, { 
                                         style: value as 'pathways' | 'bezier'
                                       });
                                     }
                                   }}
                                 >
                                   <SelectTrigger className="w-full h-8">
                                     <SelectValue placeholder="Select style" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="pathways">Pathways (Smart Routing)</SelectItem>
                                     <SelectItem value="bezier">Bezier (Curved)</SelectItem>
                                   </SelectContent>
                                 </Select>
                               </div>
                               {item.connection.style === 'bezier' && (
                                 <div>
                                   <Label htmlFor={`outgoing-curvature-${i}`} className="text-xs text-muted-foreground">Curve Intensity</Label>
                                   <Input
                                     id={`outgoing-curvature-${i}`}
                                     type="range"
                                     min="0.1"
                                     max="1.0"
                                     step="0.1"
                                     value={item.connection.curvature || 0.3}
                                     onChange={(e) => {
                                       if (onConnectionUpdate) {
                                         onConnectionUpdate(item.connection.from, item.connection.to, { 
                                           curvature: parseFloat(e.target.value)
                                         });
                                       }
                                     }}
                                     className="h-8 text-xs"
                                   />
                                   <div className="flex justify-between text-xs text-muted-foreground">
                                     <span>Gentle</span>
                                     <span>{(item.connection.curvature || 0.3).toFixed(1)}</span>
                                     <span>Sharp</span>
                                   </div>
                                 </div>
                               )}
                             </div>
                           )) : <p className="text-xs text-muted-foreground pl-2">None</p>}
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
              </form>
            ) : (
              <div className="flex items-center justify-center text-center h-full">
                <p className="text-muted-foreground">Select an item to see its properties.</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="canvas" className="flex-1 m-0 p-4 data-[state=active]:flex data-[state=active]:flex-col min-h-0 overflow-hidden">
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-semibold mb-3">Selected Items</h3>
              
              {selectedItemIds && selectedItemIds.size > 0 ? (
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedItemIds.size} item{selectedItemIds.size > 1 ? 's' : ''} selected (hold Shift to multi-select)
                  </p>
                  
                  {/* Calculate and display bounds of selected items */}
                  {(() => {
                    const selectedItems = Array.from(selectedItemIds).map(id => {
                      const node = diagramData.nodes.find(n => n.id === id);
                      const group = diagramData.groups?.find(g => g.id === id);
                      return node || group;
                    }).filter(Boolean);
                    
                    if (selectedItems.length === 0) return null;
                    
                    const positions = selectedItems.map(item => ({
                      id: item!.id,
                      label: item!.label || 'Unnamed',
                      x: item!.x || 0,
                      y: item!.y || 0,
                      width: item!.type === 'group' ? (item as any).width || 300 : 104,
                      height: item!.type === 'group' ? (item as any).height || 220 : 100
                    }));
                    
                    const minX = Math.min(...positions.map(p => p.x));
                    const minY = Math.min(...positions.map(p => p.y));
                    const maxX = Math.max(...positions.map(p => p.x + p.width));
                    const maxY = Math.max(...positions.map(p => p.y + p.height));
                    const centerX = (minX + maxX) / 2;
                    const centerY = (minY + maxY) / 2;
                    
                    return (
                      <div className="space-y-2">
                        <div className="text-xs bg-muted p-2 rounded">
                          <p><strong>Bounds:</strong> X:{minX.toFixed(0)} Y:{minY.toFixed(0)} → X:{maxX.toFixed(0)} Y:{maxY.toFixed(0)}</p>
                          <p><strong>Center:</strong> X:{centerX.toFixed(0)} Y:{centerY.toFixed(0)}</p>
                          <p><strong>Size:</strong> W:{(maxX - minX).toFixed(0)} H:{(maxY - minY).toFixed(0)}</p>
                        </div>
                        
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {positions.map(pos => (
                            <div key={pos.id} className="text-xs p-1 bg-muted/50 rounded">
                              <strong>{pos.label}</strong>: X:{pos.x.toFixed(0)} Y:{pos.y.toFixed(0)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  Click items to select (hold Shift to multi-select)
                </p>
              )}
            </div>
            
            <div>
              <h3 className="text-md font-semibold mb-3">Canvas Transform</h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="transform-x">X Position</Label>
                  <Input
                    id="transform-x"
                    type="number"
                    value={transform?.x || 0}
                    onChange={(e) => onTransformChange?.({ 
                      x: parseFloat(e.target.value) || 0,
                      y: transform?.y || 0,
                      k: transform?.k || 1
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label htmlFor="transform-y">Y Position</Label>
                  <Input
                    id="transform-y"
                    type="number"
                    value={transform?.y || 0}
                    onChange={(e) => onTransformChange?.({ 
                      x: transform?.x || 0,
                      y: parseFloat(e.target.value) || 0,
                      k: transform?.k || 1
                    })}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label htmlFor="transform-zoom">Zoom Level</Label>
                  <Input
                    id="transform-zoom"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="4"
                    value={transform?.k || 1}
                    onChange={(e) => onTransformChange?.({ 
                      x: transform?.x || 0,
                      y: transform?.y || 0,
                      k: parseFloat(e.target.value) || 1
                    })}
                    className="w-full"
                  />
                </div>
                
                <div className="pt-2 space-y-2">
                  <Button 
                    variant="outline" 
                    onClick={() => onTransformChange?.({ x: 0, y: 0, k: 1 })}
                    className="w-full"
                  >
                    Reset Transform
                  </Button>
                  
                  {onFitToView && (
                    <Button 
                      variant="outline" 
                      onClick={onFitToView}
                      className="w-full"
                    >
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Fit to View
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>X:</strong> Horizontal pan position</p>
              <p><strong>Y:</strong> Vertical pan position</p>
              <p><strong>Zoom:</strong> Scale factor (1.0 = 100%)</p>
              <p>Use these controls to manually adjust the canvas view and troubleshoot fit-to-view functionality.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
