"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useDrop } from 'react-dnd';
import { DiagramNode } from "../diagram/diagram-node";
import { DiagramEdge } from "../diagram/diagram-edge";
import { DiagramGroup } from "../diagram/diagram-group";
import type { DiagramData, DiagramNodeData, DiagramGroupData } from "@/lib/types";
import { ItemTypes } from './draggable-item';
import { generateDiagram } from "@/app/actions";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "lucide-react";
import type { SelectedItem } from "../diagram-editor";
import { cn } from "@/lib/utils";
import { findPath } from "@/lib/pathfinding";
import type { Obstacle } from "@/lib/pathfinding";


const NODE_WIDTH = 128;
const NODE_HEIGHT = 100;
const GROUP_PADDING = 40;
const GROUP_NODE_SPACING = 30;
const GRID_SNAP = 20;

interface EditorCanvasProps {
  diagramData: DiagramData;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  onItemSelect: (item: SelectedItem | null) => void;
  selectedItemId?: string;
  isConnectMode: boolean;
  onNodeClickInConnectMode: (node: DiagramNodeData) => void;
}

type PositionedNode = DiagramNodeData & { x: number; y: number; };
type PositionedGroup = DiagramGroupData & { x: number; y: number; width: number; height: number; };

export function EditorCanvas({ diagramData, setDiagramData, onItemSelect, selectedItemId, isConnectMode, onNodeClickInConnectMode }: EditorCanvasProps) {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  const { processedNodes, processedGroups, width, height } = useMemo(() => {
    const nodes: DiagramNodeData[] = JSON.parse(JSON.stringify(diagramData.nodes || []));
    const groups: DiagramGroupData[] = JSON.parse(JSON.stringify(diagramData.groups || []));
    
    const allItems: { [id: string]: DiagramNodeData | DiagramGroupData | PositionedNode | PositionedGroup } = {};
    nodes.forEach(item => allItems[item.id] = item);
    groups.forEach(item => allItems[item.id] = item);
    
    const layoutGroup = (group: DiagramGroupData): { width: number, height: number } => {
        const childNodes = group.nodes
            .map(id => allItems[id])
            .filter(Boolean)
            .filter(c => !c.type || c.type !== 'group') as DiagramNodeData[];
        
        const childGroups = group.nodes
            .map(id => allItems[id])
            .filter(Boolean)
            .filter(c => c.type === 'group') as DiagramGroupData[];

        let contentWidth = 0;
        let contentHeight = 0;

        // Layout child groups first and get their dimensions
        const laidOutChildGroups = childGroups.map(cg => {
            const dims = layoutGroup(cg);
            return { ...cg, width: dims.width, height: dims.height };
        });

        // Simple grid layout for all children (nodes and groups)
        const allChildren = [...childNodes, ...laidOutChildGroups];
        const numItems = allChildren.length;
        const itemsPerRow = Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
        
        let currentX = GROUP_PADDING;
        let currentY = GROUP_PADDING;
        let rowMaxHeight = 0;

        allChildren.forEach((child, index) => {
            if (index > 0 && index % itemsPerRow === 0) {
                currentX = GROUP_PADDING;
                currentY += rowMaxHeight + GROUP_NODE_SPACING;
                rowMaxHeight = 0;
            }
            
            const childWidth = (child as any).width || NODE_WIDTH;
            const childHeight = (child as any).height || NODE_HEIGHT;
            
            child.x = currentX;
            child.y = currentY;

            currentX += childWidth + GROUP_NODE_SPACING;
            rowMaxHeight = Math.max(rowMaxHeight, childHeight);
            contentWidth = Math.max(contentWidth, currentX);
        });

        contentHeight = currentY + rowMaxHeight;

        const groupWidth = contentWidth - GROUP_NODE_SPACING + GROUP_PADDING;
        const groupHeight = contentHeight + GROUP_PADDING;
        
        (group as PositionedGroup).width = groupWidth;
        (group as PositionedGroup).height = groupHeight;

        return { width: groupWidth, height: groupHeight };
    };

    const rootGroups = groups.filter(g => !groups.some(parent => parent.nodes.includes(g.id)));
    rootGroups.forEach(layoutGroup);

    // Set absolute positions
    const setAbsolutePositions = (group: DiagramGroupData, parentX: number, parentY: number) => {
        group.x = (group.x ?? 0) + parentX;
        group.y = (group.y ?? 0) + parentY;

        group.nodes.forEach(childId => {
            const child = allItems[childId];
            if (!child) return;
            
            if (child.type === 'group') {
                setAbsolutePositions(child as DiagramGroupData, group.x!, group.y!);
            } else {
                child.x = (child.x ?? 0) + group.x!;
                child.y = (child.y ?? 0) + group.y!;
            }
        });
    };
    
    // Position root groups and orphan nodes
    let currentX = 50;
    const allChildIds = new Set(groups.flatMap(g => g.nodes));
    const orphanNodes = nodes.filter(n => !allChildIds.has(n.id));
    const topLevelItems = [...rootGroups, ...orphanNodes];

    topLevelItems.forEach(item => {
        // Only assign position if it doesn't have one
        if (item.x === undefined || item.y === undefined) {
          item.x = currentX;
          item.y = 50;
        }
        if (item.type === 'group') {
          setAbsolutePositions(item as DiagramGroupData, 0, 0);
        }
        currentX += ((item as any).width || NODE_WIDTH) + 50;
    });

    const finalNodes = Object.values(allItems).filter(i => i.type !== 'group') as PositionedNode[];
    const finalGroups = Object.values(allItems).filter(i => i.type === 'group') as PositionedGroup[];

    const allElementsX = [
        ...finalNodes.map(n => (n.x || 0) + NODE_WIDTH),
        ...finalGroups.map(g => (g.x || 0) + g.width)
    ];
    const allElementsY = [
        ...finalNodes.map(n => (n.y || 0) + NODE_HEIGHT),
        ...finalGroups.map(g => (g.y || 0) + g.height)
    ];

    const canvasWidth = Math.max(2000, ...allElementsX);
    const canvasHeight = Math.max(1500, ...allElementsY);
    
    return { 
        processedNodes: finalNodes, 
        processedGroups: finalGroups, 
        width: canvasWidth, 
        height: canvasHeight 
    };
}, [diagramData]);


  const nodesById = useMemo(() => {
    return processedNodes.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {} as Record<string, PositionedNode>);
  }, [processedNodes]);
  
  const groupsById = useMemo(() => {
    return processedGroups.reduce((acc, group) => {
      acc[group.id] = group;
      return acc;
    }, {} as Record<string, PositionedGroup>);
  }, [processedGroups]);
  
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    const node = nodesById[selectedItemId];
    if (node) return { ...node, type: 'node' as const };
    const group = groupsById[selectedItemId];
    if (group) return { ...group, type: 'group' as const, subType: group.subType };
    return null;
  }, [selectedItemId, nodesById, groupsById]);

  const addNode = useCallback((item: { type: string; label: string }, position: { x: number; y: number }, targetGroupId: string | null) => {
    setDiagramData((prevData) => {
      let newGroups = prevData.groups ? [...prevData.groups] : [];
      let newNodes = prevData.nodes ? [...prevData.nodes] : [];
      let newItemId: string;

      if (item.type === 'zone' || item.type === 'group') {
        const newGroup: DiagramGroupData = {
          id: `group-${Date.now()}`,
          label: item.label,
          nodes: [],
          type: 'group',
          subType: item.type === 'zone' ? 'zone' : 'group',
          info: `A new ${item.label}`,
          color: item.type === 'group' ? '#e0e0e0' : undefined,
        };
        newGroups.push(newGroup);
        newItemId = newGroup.id;
      } else {
        const newNode: DiagramNodeData = {
          id: `${item.type}-${Date.now()}`,
          type: item.type,
          label: item.label,
          info: `A new ${item.label}`,
        };
        newNodes.push(newNode);
        newItemId = newNode.id;
      }
      
      if (targetGroupId) {
        newGroups = newGroups.map(g => {
          if (g.id === targetGroupId) {
            return { ...g, nodes: [...g.nodes, newItemId] };
          }
          return g;
        });
      } else {
        const addedItem = newNodes.find(n => n.id === newItemId) || newGroups.find(g => g.id === newItemId);
        if (addedItem) {
            addedItem.x = position.x;
            addedItem.y = position.y;
        }
      }

      return { ...prevData, nodes: newNodes, groups: newGroups };
    });
  }, [setDiagramData]);

  const moveItem = useCallback((item: { id: string; type: string; x?: number, y?: number }, newPos: { x: number; y: number }, targetGroupId: string | null) => {
    setDiagramData(prevData => {
      let currentNodes = [...(prevData.nodes || [])];
      let currentGroups = [...(prevData.groups || [])];
      
      const oldParentId = currentGroups.find(g => g.nodes.includes(item.id))?.id;
  
      // Handle re-parenting
      if (oldParentId !== targetGroupId) {
        currentGroups = currentGroups.map(g => {
          if (g.id === oldParentId) { 
            return { ...g, nodes: g.nodes.filter(nid => nid !== item.id) };
          }
          if (g.id === targetGroupId) {
            // Can't drop a group into itself or its descendants
            const visited = new Set<string>();
            const isDescendant = (childId: string, parentId: string): boolean => {
              if (childId === parentId) return true;
              if (visited.has(childId)) return false; // Avoid infinite loops
              visited.add(childId);
              const childGroup = currentGroups.find(g => g.id === childId);
              if (!childGroup) return false;
              return childGroup.nodes.some(nid => isDescendant(nid, parentId));
            }
            if (item.type === ItemTypes.GROUP && isDescendant(g.id, item.id)) {
              return g;
            }
            return { ...g, nodes: [...g.nodes, item.id] };
          }
          return g;
        });
      }
  
      // Handle positioning
      if (item.type === ItemTypes.CANVAS_NODE || item.type === ItemTypes.GROUP) {
        // If the item is now a child, its position is auto-calculated, so remove explicit coords.
        if (targetGroupId) {
          if (item.type === ItemTypes.CANVAS_NODE) {
            currentNodes = currentNodes.map(n => n.id === item.id ? { ...n, x: undefined, y: undefined } : n);
          } else { 
            currentGroups = currentGroups.map(g => g.id === item.id ? { ...g, x: undefined, y: undefined } : g);
          }
        } else {
          // If the item is a top-level item, apply the snapped position.
          const draggedItemData = processedNodes.find(n => n.id === item.id) || processedGroups.find(g => g.id === item.id);
          const originalX = draggedItemData?.x ?? 0;
          const originalY = draggedItemData?.y ?? 0;
          const dx = newPos.x - originalX;
          const dy = newPos.y - originalY;

          const allChildIds = new Set<string>();
          const getChildrenRecursive = (itemId: string) => {
              if (allChildIds.has(itemId)) return;
              allChildIds.add(itemId);

              const group = currentGroups.find(g => g.id === itemId);
              if (!group) return;
              group.nodes.forEach(childId => {
                  getChildrenRecursive(childId);
              });
          };


          if (item.type === ItemTypes.GROUP) {
            getChildrenRecursive(item.id);
            currentGroups = currentGroups.map(g => {
              if (g.id === item.id) return { ...g, x: newPos.x, y: newPos.y };
              if (allChildIds.has(g.id)) {
                const originalChild = processedGroups.find(cg => cg.id === g.id);
                return { ...g, x: (originalChild?.x ?? 0) + dx, y: (originalChild?.y ?? 0) + dy };
              }
              return g;
            });
            currentNodes = currentNodes.map(n => {
              if (allChildIds.has(n.id)) {
                const originalChild = processedNodes.find(cn => cn.id === n.id);
                return { ...n, x: (originalChild?.x ?? 0) + dx, y: (originalChild?.y ?? 0) + dy };
              }
              return n;
            });
          } else {
            currentNodes = currentNodes.map(n => n.id === item.id ? { ...n, x: newPos.x, y: newPos.y } : n);
          }
        }
      }
      return { ...prevData, nodes: currentNodes, groups: currentGroups };
    });
  }, [setDiagramData, processedNodes, processedGroups]);


  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.DIAGRAM_NODE, ItemTypes.CANVAS_NODE, ItemTypes.GROUP],
    hover: (item: { id?: string }, monitor) => {
        if (!canvasRef.current) return;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        
        const x = (clientOffset.x - canvasRef.current.getBoundingClientRect().left - transform.x) / transform.k;
        const y = (clientOffset.y - canvasRef.current.getBoundingClientRect().top - transform.y) / transform.k;

        let targetGroupId: string | null = null;
        // Iterate backwards to check topmost groups first
        for (let i = processedGroups.length - 1; i >= 0; i--) {
            const group = processedGroups[i];
            if (group.id === item.id) continue;
            
            // Check if the item being dragged is an ancestor of the potential target group
            let isAncestor = false;
            if (item.id) {
                const visited = new Set<string>();
                const checkDescendants = (currentGroupId: string): boolean => {
                    if (visited.has(currentGroupId)) return false;
                    visited.add(currentGroupId);
                    if (currentGroupId === group.id) return true;
                    const currentGroupData = processedGroups.find(g => g.id === currentGroupId);
                    if (!currentGroupData) return false;
                    return currentGroupData.nodes.some(childId => {
                        const childGroup = processedGroups.find(g => g.id === childId);
                        return childGroup ? checkDescendants(childId) : false;
                    });
                };
                isAncestor = checkDescendants(item.id);
            }
            if (isAncestor) continue;

            if (x > group.x && x < group.x + group.width && y > group.y && y < group.y + group.height) {
                targetGroupId = group.id;
                break;
            }
        }
        setHoveredGroupId(targetGroupId);
    },
    drop: (item: { id?: string, type: string; label: string, x?: number, y?: number }, monitor) => {
        if (!canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        
        const itemType = monitor.getItemType();
        let x, y;
        
        const currentPos = monitor.getClientOffset();
        if (!currentPos) return;

        if (itemType === ItemTypes.DIAGRAM_NODE) {
          // This is a new item from the sidebar
          x = (currentPos.x - canvasRect.left - transform.x) / transform.k;
          y = (currentPos.y - canvasRect.top - transform.y) / transform.k;
        } else {
          // This is an existing item being moved
          const initialCanvasPos = monitor.getInitialSourceClientOffset();
          const delta = monitor.getDifferenceFromInitialOffset();
          if (!initialCanvasPos || !delta) return;

          const originalItem = nodesById[item.id!] || groupsById[item.id!];
          const initialX = originalItem?.x ?? 0;
          const initialY = originalItem?.y ?? 0;
          x = initialX + delta.x / transform.k;
          y = initialY + delta.y / transform.k;
        }
        
        const snappedX = Math.round(x / GRID_SNAP) * GRID_SNAP;
        const snappedY = Math.round(y / GRID_SNAP) * GRID_SNAP;

        if (itemType === ItemTypes.DIAGRAM_NODE) { 
            addNode({type: item.type, label: item.label}, { x: snappedX, y: snappedY }, hoveredGroupId);
        } else if (item.id && (itemType === ItemTypes.CANVAS_NODE || itemType === ItemTypes.GROUP)) {
            moveItem({ id: item.id, type: item.type, x: item.x, y: item.y }, { x: snappedX, y: snappedY }, hoveredGroupId);
        }
        
        setHoveredGroupId(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [transform, processedGroups, diagramData, hoveredGroupId, moveItem, addNode, nodesById, groupsById]);


  
  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.absolute') === null) {
      onItemSelect(null);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    if (isConnectMode) {
      onNodeClickInConnectMode(node);
    } else {
      onItemSelect({ ...node, type: 'node' });
    }
  }

  const handleGroupClick = (e: React.MouseEvent, group: DiagramGroupData) => {
    e.stopPropagation();
    if (!isConnectMode) {
      onItemSelect({ ...group, type: 'group' });
    }
  };

  drop(canvasRef);
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const { clientX, clientY, deltaY } = e;
    const rect = canvasRef.current.getBoundingClientRect();
    const s = Math.pow(0.99, deltaY);
    const newK = Math.max(0.1, Math.min(transform.k * s, 3));
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const newX = mouseX - (mouseX - transform.x) * s;
    const newY = mouseY - (mouseY - transform.y) * s;
    setTransform({ x: newX, y: newY, k: newK });
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isConnectMode) return;
    const target = e.target as HTMLElement;
    if (e.button !== 0 || target.closest('.absolute')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setTransform(t => ({ ...t, x: e.clientX - panStart.x, y: e.clientY - panStart.y}));
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  const allObstacles = useMemo(() => {
    const nodeObstacles = processedNodes.map(n => ({
      id: n.id,
      x: n.x,
      y: n.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    }));
    const groupObstacles = processedGroups.map(g => ({
      id: g.id,
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height
    }));
    return [...nodeObstacles, ...groupObstacles];
  }, [processedNodes, processedGroups]);

  const handleGenerateClick = async () => {
    setIsGenerating(true);
    const { data, error } = await generateDiagram(description);
    setIsGenerating(false);
    if (error || !data) {
      toast({
        variant: "destructive",
        title: "Error Generating Diagram",
        description: error || "An unknown error occurred.",
      });
    } else {
      setDiagramData(data);
      toast({
        title: "Diagram Generated",
        description: "The diagram has been successfully generated from your description.",
      });
    }
  };

  return (
    <>
        <div
            ref={canvasRef}
            className={cn(
              "w-full h-full overflow-hidden bg-background",
              isConnectMode && "cursor-crosshair",
              !isConnectMode && "cursor-grab",
              isPanning && "cursor-grabbing"
            )}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onClick={handleCanvasClick}
        >
            <div
                className="relative dot-grid"
                style={{
                  width: `${width}px`,
                  height: `${height}px`,
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                  transformOrigin: '0 0',
                }}
            >
                {processedGroups.map((group) => (
                    <div key={group.id} onClick={(e) => handleGroupClick(e, group)}>
                        <DiagramGroup 
                            group={group}
                            isSelected={selectedItemId === group.id && !isConnectMode}
                            isDropTarget={hoveredGroupId === group.id}
                        />
                    </div>
                ))}
                <svg
                width={width}
                height={height}
                className="absolute top-0 left-0 overflow-visible pointer-events-none"
                >
                <defs>
                    <marker
                    id="arrowhead"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                    >
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current text-muted-foreground" />
                    </marker>
                </defs>
                {(diagramData.edges || []).map((edge, index) => {
                    const fromItem = nodesById[edge.from] || groupsById[edge.from];
                    const toItem = nodesById[edge.to] || groupsById[edge.to];
                    if (!fromItem || !toItem) return null;
                    
                    const fromPos = {
                      ...fromItem,
                      width: 'width' in fromItem ? fromItem.width : NODE_WIDTH,
                      height: 'height' in fromItem ? fromItem.height : NODE_HEIGHT
                    }
                    const toPos = {
                      ...toItem,
                      width: 'width' in toItem ? toItem.width : NODE_WIDTH,
                      height: 'height' in toItem ? toItem.height : NODE_HEIGHT
                    }

                    return (
                    <DiagramEdge
                        key={`${edge.from}-${edge.to}-${index}`}
                        from={fromPos}
                        to={toPos}
                        allObstacles={allObstacles}
                    />
                    );
                })}
                </svg>
                {processedNodes.map((node) => (
                <div key={node.id} onClick={(e) => handleNodeClick(e, node)}>
                    <DiagramNode 
                      node={node} 
                      isSelected={selectedItemId === node.id && !isConnectMode}
                      isTargetable={isConnectMode && selectedItemId !== node.id}
                     />
                </div>
                ))}
            </div>
        </div>
         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl p-2">
            {isConnectMode && selectedItem && (
              <div className="bg-primary/90 text-primary-foreground backdrop-blur-sm shadow-lg rounded-lg p-3 mb-2 text-center font-medium">
                Connect Mode: Click a target to connect from "{selectedItem.label}".
              </div>
            )}
            <div className="bg-card/80 backdrop-blur-sm shadow-lg rounded-lg p-4 flex gap-2">
                <Textarea
                    placeholder="Describe your diagram in plain English... e.g., 'A user connects to a web server through a load balancer.'"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex-1 text-base"
                    rows={2}
                />
                <Button onClick={handleGenerateClick} disabled={isGenerating || !description}>
                    {isGenerating ? <Loader className="animate-spin" /> : "Generate"}
                    <span className="sr-only">Generate Diagram</span>
                </Button>
            </div>
        </div>
    </>
  );
}
