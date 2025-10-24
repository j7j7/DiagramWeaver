"use client";
import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { DraggableItem } from './draggable-item';
import { Server, Database, Network, Group as GroupIcon, Layers, Box, Download, Upload } from 'lucide-react';
import { Separator } from '../ui/separator';
import type { DiagramNodeData, DiagramGroupData, DiagramData } from '@/lib/types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import type { SelectedItem } from '../diagram-editor';
import { ScrollArea } from '../ui/scroll-area';

const availableComponents = [
    { type: 'zone', label: 'Zone', icon: <Layers className="w-6 h-6" /> },
    { type: 'group', label: 'Group', icon: <GroupIcon className="w-6 h-6" /> },
    { type: 'aws.compute.Kubernetes', label: 'Kubernetes', icon: <Box className="w-6 h-6" /> },
    { type: 'aws.applicationintegration.EventBridge', label: 'Event Bus', icon: <Network className="w-6 h-6" /> },
    { type: 'generic.server', label: 'Server', icon: <Server className="w-6 h-6" /> },
    { type: 'aws.compute.Lambda', label: 'Lambda', icon: <Server className="w-6 h-6" /> },
    { type: 'aws.storage.S3', label: 'S3 Bucket', icon: <Database className="w-6 h-6" /> },
    { type: 'aws.database.RDS', label: 'Database', icon: <Database className="w-6 h-6" /> },
];

interface ComponentSidebarProps {
  selectedItem: SelectedItem | null;
  onItemUpdate: (updatedItem: SelectedItem) => void;
  onConnect: () => void;
  onItemDelete: (itemToDelete: SelectedItem) => void;
  diagramData: DiagramData;
  onSave: () => void;
  onLoad: () => void;
}

type FormValues = Omit<DiagramNodeData & DiagramGroupData, 'id' | 'type' | 'nodes'>;


export function ComponentSidebar({ selectedItem, onItemUpdate, onConnect, onItemDelete, diagramData, onSave, onLoad }: ComponentSidebarProps) {
  const { register, handleSubmit, reset, watch, getValues } = useForm<FormValues>();

  useEffect(() => {
    if (selectedItem) {
      reset(selectedItem);
    } else {
      reset({ label: '', info: '', color: '#e0e0e0'});
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

    if (selectedItem.type !== 'node') {
        return { incoming: [], outgoing: [], parentGroup: parent };
    }
    
    const nodeId = selectedItem.id;
    const nodesById = new Map(diagramData.nodes.map(n => [n.id, n]));

    const incoming = (diagramData.edges || [])
      .filter(edge => edge.to === nodeId)
      .map(edge => nodesById.get(edge.from)?.label)
      .filter(Boolean);
      
    const outgoing = (diagramData.edges || [])
      .filter(edge => edge.from === nodeId)
      .map(edge => nodesById.get(edge.to)?.label)
      .filter(Boolean);

    return { incoming, outgoing, parentGroup: parent };
  }, [selectedItem, diagramData]);


  return (
    <aside className="w-80 bg-card border-r p-4 flex flex-col">
      <h2 className="text-lg font-headline font-semibold mb-4">Components</h2>
      <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" onClick={onSave} className="w-full"><Download className="mr-2"/>Save</Button>
          <Button variant="outline" onClick={onLoad} className="w-full"><Upload className="mr-2"/>Load</Button>
      </div>
      <Separator className='mb-4' />
      <ScrollArea className="h-48">
        <div className="grid grid-cols-2 gap-4 pr-4">
            {availableComponents.map((item) => (
            <DraggableItem key={item.type} type={item.type} label={item.label} icon={item.icon} />
            ))}
        </div>
      </ScrollArea>
      <Separator className="my-6" />
      <h2 className="text-lg font-headline font-semibold mb-4">Details</h2>
      <Separator className='mb-4' />
      <ScrollArea className="flex-1">
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
            {selectedItem.type === 'group' && selectedItem.subType === 'group' && (
              <div>
                <Label htmlFor="color">Group Color</Label>
                <Input id="color" type="color" {...register('color')} className="p-1 h-10" />
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
                {selectedItem.type === 'node' && (
                  <Button type="button" onClick={onConnect} className="w-full">
                    Connect
                  </Button>
                )}
                <Button type="button" variant="destructive" onClick={() => onItemDelete(selectedItem)} className="w-full">
                  Delete
                </Button>
            </div>

            {selectedItem.type === 'node' && (
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
    </aside>
  );
}
