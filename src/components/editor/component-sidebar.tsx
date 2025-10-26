"use client";
import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { DraggableItem } from './draggable-item';
import { Download, Upload, Plus } from 'lucide-react';
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
  onItemUpdate: (updatedItem: SelectedItem) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onItemDelete: (itemToDelete: SelectedItem) => void;
  diagramData: DiagramData;
  onSave: () => void;
  onLoad: () => void;
  onNew: () => void;
}

type FormValues = Omit<DiagramNodeData & DiagramGroupData, 'id' | 'type' | 'nodes'> & {
  borderColor?: string;
  textColor?: string;
  backgroundColor?: string;
  borderStyle?: 'solid' | 'gradient';
  borderColors?: string[];
  backgroundStyle?: 'solid' | 'gradient';
  backgroundColors?: string[];
  orientation?: 'horizontal' | 'vertical' | 'square';
  lineColor?: string;
  maxItemsPerRow?: number;
  shadow?: boolean;
};


export function ComponentSidebar({ selectedItem, onItemUpdate, onConnect, onDisconnect, onItemDelete, diagramData, onSave, onLoad, onNew }: ComponentSidebarProps) {
  const { register, reset, getValues } = useForm<FormValues>();

  useEffect(() => {
    if (selectedItem) {
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
            const currentValue = currentValues[key as keyof FormValues];
            return initialValue !== currentValue;
        });

        if (hasChanged) {
            onItemUpdate(updatedItem);
        }
    }
  };


  const { incoming, outgoing, parentGroup } = useMemo(() => {
    if (!selectedItem || !diagramData) return { incoming: [], outgoing: [], parentGroup: null };
    
    const parent = (diagramData.groups || []).find(g => g.nodes.includes(selectedItem.id));
    
    const itemId = selectedItem.id;
    const nodesById = new Map(diagramData.nodes.map(n => [n.id, n]));
    const groupsById = new Map((diagramData.groups || []).map(g => [g.id, g]));

    const incoming = (diagramData.edges || [])
      .filter(edge => edge.to === itemId)
      .map(edge => nodesById.get(edge.from)?.label || groupsById.get(edge.from)?.label)
      .filter(Boolean);
      
    const outgoing = (diagramData.edges || [])
      .filter(edge => edge.from === itemId)
      .map(edge => nodesById.get(edge.to)?.label || groupsById.get(edge.to)?.label)
      .filter(Boolean);

    return { incoming, outgoing, parentGroup: parent };
  }, [selectedItem, diagramData]);


return (
    <aside className="w-80 bg-card border-r flex flex-col h-full">
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" onClick={onNew} className="flex-1"><Plus className="mr-2 h-4 w-4"/>New</Button>
            <Button variant="outline" onClick={onSave} className="flex-1"><Download className="mr-2 h-4 w-4"/>Save</Button>
            <Button variant="outline" onClick={onLoad} className="flex-1"><Upload className="mr-2 h-4 w-4"/>Load</Button>
        </div>
      </div>
      
      <Tabs defaultValue="resources" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="resources" className="flex-1 m-0 data-[state=active]:flex data-[state=active]:flex-col min-h-0 overflow-hidden">
          <ResourceBrowser 
            onResourceSelect={(resource, provider, category) => {
              console.log('Selected resource:', resource.name, 'from', provider, category);
              // TODO: Handle resource selection - create draggable item or add to canvas
            }}
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
                )}
                
                {parentGroup && (
                    <div>
                        <Label>Parent Group</Label>
                        <p className='text-sm text-muted-foreground p-2 bg-muted rounded-md'>{parentGroup.label}</p>
                    </div>
                )}
                
                <p className="text-sm text-muted-foreground break-words">ID: {selectedItem.id}</p>
                
                <div className="flex gap-2">
                    {(selectedItem.itemType === 'node' || selectedItem.itemType === 'group') && (
                      <>
                        <Button type="button" onClick={onConnect} className="w-full">
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
                    <div className="text-sm space-y-2">
                      <div>
                        <h4 className="font-medium text-muted-foreground">Incoming ({incoming.length})</h4>
                        <div className="pl-2 border-l-2 ml-1">
                          {incoming.length > 0 ? incoming.map((label, i) => <p key={i}>{label}</p>) : <p className="text-xs text-muted-foreground">None</p>}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-muted-foreground">Outgoing ({outgoing.length})</h4>
                        <div className="pl-2 border-l-2 ml-1">
                          {outgoing.length > 0 ? outgoing.map((label, i) => <p key={i}>{label}</p>) : <p className="text-xs text-muted-foreground">None</p>}
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
      </Tabs>
    </aside>
  );
}
