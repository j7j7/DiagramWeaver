"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useDrop } from 'react-dnd';
import { DiagramNode } from "../diagram/diagram-node";
import { DiagramConnection, DiagramConnectionText } from "../diagram/diagram-connection";
import { DiagramGroup } from "../diagram/diagram-group";
import type { DiagramData, DiagramNodeData, DiagramGroupData } from "@/lib/types";
import { ItemTypes } from './draggable-item';
import { generateDiagram } from "@/app/actions";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader, Maximize2 } from "lucide-react";
import type { SelectedItem } from "../diagram-editor";
import { cn } from "@/lib/utils";

import { ContextMenu } from "../ui/context-menu";
import { generateGroupId, generateSequentialId } from "@/lib/id-generator";


const NODE_WIDTH = 104;
const NODE_HEIGHT = 100;
const TEXT_NODE_HEIGHT = 40;
const EXTRA_LINE_HEIGHT = 20;
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
  onConnect?: () => void;
  onDisconnect?: () => void;
}

type PositionedNode = DiagramNodeData & { x: number; y: number; };
type PositionedGroup = DiagramGroupData & { x: number; y: number; width: number; height: number; };

export type EditorCanvasHandle = {
  fitToView: () => void;
  exportPng: () => Promise<void>;
};

export const EditorCanvas = React.forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { diagramData, setDiagramData, onItemSelect, selectedItemId, isConnectMode, onNodeClickInConnectMode, onConnect, onDisconnect }: EditorCanvasProps,
  ref
) {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; distance: number } | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    itemType: 'node' | 'group';
    itemId: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    itemType: 'node',
    itemId: ''
  });
  
  // Clipboard state
  const [clipboard, setClipboard] = useState<{
    node?: DiagramNodeData;
    group?: DiagramGroupData;
  } | null>(null);

  const { processedNodes, processedGroups, width, height } = useMemo(() => {
    const nodes: DiagramNodeData[] = JSON.parse(JSON.stringify(diagramData.nodes || []));
    const groups: DiagramGroupData[] = JSON.parse(JSON.stringify(diagramData.groups || []));
    
    const allItems: { [id: string]: DiagramNodeData | DiagramGroupData | PositionedNode | PositionedGroup } = {};
    nodes.forEach(item => allItems[item.id] = item);
    groups.forEach(item => allItems[item.id] = item);
    
    const layoutGroup = (group: DiagramGroupData): { width: number, height: number } => {
        const childNodes = group.children
            .map((id: string) => allItems[id])
            .filter(Boolean)
            .filter((c: any) => !c.type || c.type !== 'group') as DiagramNodeData[];
        
        const childGroups = group.children
            .map((id: string) => allItems[id])
            .filter(Boolean)
            .filter((c: any) => c.type === 'group') as DiagramGroupData[];

        let contentWidth = 0;
        let contentHeight = 0;

        // Layout child groups first and get their dimensions (mutate originals so positions persist)
        const laidOutChildGroups = childGroups.map(cg => {
            const dims = layoutGroup(cg);
            (cg as any).width = dims.width;
            (cg as any).height = dims.height;
            return cg; // IMPORTANT: return original reference so x/y set below apply to allItems
        });

        // Grid layout for all children (nodes and groups) with orientation and maxItemsPerRow support
        const allChildren = [...childNodes, ...laidOutChildGroups];
        const numItems = allChildren.length;
        
        // Determine items per row based on orientation and maxItemsPerRow
        let itemsPerRow: number;
        if (group.orientation === 'vertical') {
            // Vertical orientation: single column, but respect maxItemsPerRow for column height
            itemsPerRow = 1;
        } else if (group.orientation === 'horizontal') {
            // Horizontal orientation: use maxItemsPerRow if specified, otherwise calculate
            itemsPerRow = group.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
        } else {
            // Square orientation: use maxItemsPerRow if specified, otherwise calculate
            itemsPerRow = group.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
        }
        
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

    const rootGroups = groups.filter(g => !groups.some(parent => parent.children.includes(g.id)));
    rootGroups.forEach(layoutGroup);

    // Set absolute positions
    const setAbsolutePositions = (group: DiagramGroupData, parentX: number, parentY: number) => {
        group.x = (group.x ?? 0) + parentX;
        group.y = (group.y ?? 0) + parentY;

        group.children.forEach((childId: string) => {
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
    const allChildIds = new Set(groups.flatMap(g => g.children));
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
    if (node) return { ...node, itemType: 'node' as const };
    const group = groupsById[selectedItemId];
    if (group) return { ...group, itemType: 'group' as const, subType: group.subType };
    return null;
  }, [selectedItemId, nodesById, groupsById]);

  const addNode = useCallback((item: any, position: { x: number; y: number }, targetGroupId: string | null) => {
    setDiagramData((prevData) => {
      let newGroups = prevData.groups ? [...prevData.groups] : [];
      let newNodes = prevData.nodes ? [...prevData.nodes] : [];
      let newItemId: string;

      const itemType = item.type || '';
      const itemLabel = item.label || '';
      
      if (itemType === 'zone' || itemType === 'group') {
        const subType = itemType === 'zone' ? 'zone' : 'group';
        const newGroup: DiagramGroupData = {
          id: generateGroupId(subType, prevData),
          label: itemLabel,
          children: [],
          type: 'group',
          subType,
          info: `A new ${itemLabel}`,
          color: subType === 'group' ? '#e0e0e0' : undefined,
        };
        newGroups.push(newGroup);
        newItemId = newGroup.id;
      } else {
        // For resource items from the sidebar, use type from drag item
        // NEVER store file in node - ResourceIcon looks up file from resource catalog
        const newNode: DiagramNodeData = {
          id: generateSequentialId(itemType, prevData),
          type: itemType,
          label: itemLabel,
          info: item.provider ? `${itemLabel} from ${item.provider}` : `A new ${itemLabel}`,
        };
        newNodes.push(newNode);
        newItemId = newNode.id;
      }
      
      if (targetGroupId) {
        newGroups = newGroups.map(g => {
          if (g.id === targetGroupId) {
            return { ...g, children: [...g.children, newItemId] };
          }
          return g;
        });
      } else {
        // Top-level placement: snap to grid and avoid overlap by nudging to nearest free slot
        const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP;
        let posX = snap(position.x);
        let posY = snap(position.y);

        const isOverlapAt = (x: number, y: number) => {
          const width = (item.type === 'zone' || item.type === 'group') ? 300 : NODE_WIDTH;
          const height = (item.type === 'zone' || item.type === 'group') ? 220 : NODE_HEIGHT;
          const rectA = { x, y, width, height };
          // existing obstacles from processed nodes/groups at this render cycle are not available here,
          // so approximate using current prevData nodes/groups positions
          const obstacles: { x: number; y: number; width: number; height: number; id: string }[] = [];
          for (const n of newNodes) {
            const nn: any = n as any;
            if (nn.x != null && nn.y != null) obstacles.push({ id: n.id, x: nn.x, y: nn.y, width: NODE_WIDTH, height: NODE_HEIGHT });
          }
          for (const g of newGroups) {
            const gg: any = g as any;
            if (gg.x != null && gg.y != null && g.id !== newItemId) {
              // groups without computed size: approximate
              obstacles.push({ id: g.id, x: gg.x, y: gg.y, width: 300, height: 220 });
            }
          }
          return obstacles.some(o => !(x + rectA.width <= o.x || o.x + o.width <= x || y + rectA.height <= o.y || o.y + o.height <= y));
        };

        // nudge search (spiral-ish) up to 50 attempts
        const dirs = [ [1,0],[0,1],[-1,0],[0,-1] ];
        let step = 1; let attempts = 0; let dirIdx = 0; let movesInDir = 0; let changes = 0;
        while (isOverlapAt(posX, posY) && attempts < 50) {
          posX += dirs[dirIdx][0] * GRID_SNAP;
          posY += dirs[dirIdx][1] * GRID_SNAP;
          movesInDir++;
          if (movesInDir === step) { dirIdx = (dirIdx + 1) % 4; movesInDir = 0; changes++; if (changes % 2 === 0) step++; }
          attempts++;
        }

        const addedItem = newNodes.find(n => n.id === newItemId) || newGroups.find(g => g.id === newItemId);
        if (addedItem) {
          (addedItem as any).x = posX;
          (addedItem as any).y = posY;
        }
      }

      return { ...prevData, nodes: newNodes, groups: newGroups };
    });
  }, [setDiagramData]);

  const moveItem = useCallback((item: { id: string; type: string; x?: number, y?: number }, newPos: { x: number; y: number }, targetGroupId: string | null) => {
    setDiagramData(prevData => {
      let currentNodes = [...(prevData.nodes || [])];
      let currentGroups = [...(prevData.groups || [])];
      
      const oldParentId = currentGroups.find(g => g.children.includes(item.id))?.id;

      // Utility to compute insert index inside a group based on pointer position
      const computeInsertIndex = (groupId: string, drop: { x: number; y: number }) => {
        const pg = processedGroups.find(g => g.id === groupId);
        if (!pg) return 0;
        const children = currentGroups.find(g => g.id === groupId)?.children.filter((id: string) => id !== item.id) || [];
        const infos = children
          .map((id: string) => {
            const n = processedNodes.find(pn => pn.id === id);
            if (n) return { id, x: n.x, y: n.y, width: NODE_WIDTH, height: NODE_HEIGHT };
            const g = processedGroups.find(pg2 => pg2.id === id);
            if (g) return { id, x: g.x, y: g.y, width: g.width, height: g.height };
            return null;
          })
          .filter(Boolean) as { id: string; x: number; y: number; width: number; height: number }[];
        infos.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
        for (let i = 0; i < infos.length; i++) {
          const c = infos[i];
          const cy = c.y + c.height / 2;
          if (drop.y < cy) return i;
        }
        return infos.length;
      };
   
      // Handle re-parenting (remove from old, we'll insert into target with ordering below)
      if (oldParentId !== targetGroupId) {
        currentGroups = currentGroups.map(g => {
          if (g.id === oldParentId) { 
            return { ...g, children: g.children.filter((nid: string) => nid !== item.id) };
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
              return childGroup.children.some((nid: string) => isDescendant(nid, parentId));
            };
            if (item.type === ItemTypes.GROUP && isDescendant(g.id, item.id)) {
              return g;
            }
            // Defer actual insertion to ordering step below
            return g;
          }
          return g;
        });
      }

      // If target is a group, set ordering within that group (reorder or insert)
      if (targetGroupId) {
        currentGroups = currentGroups.map(g => {
          if (g.id !== targetGroupId) return g;
          const filtered = g.children.filter((nid: string) => nid !== item.id);
          const insertIndex = computeInsertIndex(targetGroupId, newPos);
          filtered.splice(insertIndex, 0, item.id);
          return { ...g, children: filtered };
        });
      }
  
      // Handle positioning
      if (item.type === ItemTypes.CANVAS_NODE || item.type === ItemTypes.GROUP) {
        // If the item is (now) a child, its position is auto-calculated, so remove explicit coords.
        if (targetGroupId) {
          if (item.type === ItemTypes.CANVAS_NODE) {
            currentNodes = currentNodes.map(n => n.id === item.id ? { ...n, x: undefined, y: undefined } : n);
          } else { 
            currentGroups = currentGroups.map(g => g.id === item.id ? { ...g, x: undefined, y: undefined } : g);
          }
        } else {
          // Top-level: snap and prevent overlap
          const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP;
          const snappedX = snap(newPos.x);
          const snappedY = snap(newPos.y);

          const movingIsGroup = item.type === ItemTypes.GROUP;
          const movingDims = movingIsGroup
            ? (() => {
                const g = processedGroups.find(pg => pg.id === item.id);
                return { width: g?.width ?? 300, height: g?.height ?? 220 };
              })()
            : { width: NODE_WIDTH, height: NODE_HEIGHT };

          const allChildIds = new Set<string>();
          const getChildrenRecursive = (itemId: string) => {
              if (allChildIds.has(itemId)) return;
              allChildIds.add(itemId);
              const group = currentGroups.find(g => g.id === itemId);
              if (!group) return;
              group.children.forEach((childId: string) => getChildrenRecursive(childId));
          };
          if (movingIsGroup) getChildrenRecursive(item.id);

          const isOverlapAt = (x: number, y: number) => {
            const rectA = { x, y, width: movingDims.width, height: movingDims.height };
            // obstacles: all processed nodes/groups except moving item and its descendants
            const obstacles: { x: number; y: number; width: number; height: number; id: string }[] = [
              ...processedNodes.map(n => ({ id: n.id, x: n.x, y: n.y, width: NODE_WIDTH, height: NODE_HEIGHT })),
              ...processedGroups.map(g => ({ id: g.id, x: g.x, y: g.y, width: g.width, height: g.height })),
            ].filter(o => o.id !== item.id && !allChildIds.has(o.id));
            return obstacles.some(o => !(x + rectA.width <= o.x || o.x + o.width <= x || y + rectA.height <= o.y || o.y + o.height <= y));
          };

          if (isOverlapAt(snappedX, snappedY)) {
            // Abort move if overlapping; user must choose a free grid cell
            return prevData;
          }

          const draggedItemData = processedNodes.find(n => n.id === item.id) || processedGroups.find(g => g.id === item.id);
          const originalX = draggedItemData?.x ?? 0;
          const originalY = draggedItemData?.y ?? 0;
          const dx = snappedX - originalX;
          const dy = snappedY - originalY;

          if (movingIsGroup) {
            currentGroups = currentGroups.map(g => {
              if (g.id === item.id) return { ...g, x: snappedX, y: snappedY };
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
            currentNodes = currentNodes.map(n => n.id === item.id ? { ...n, x: snappedX, y: snappedY } : n);
          }
        }
      }
      return { ...prevData, nodes: currentNodes, groups: currentGroups };
    });
  }, [setDiagramData, processedNodes, processedGroups]);


  type DropItem = { 
    id?: string; 
    type?: string; 
    label?: string; 
    x?: number; 
    y?: number;
};

const [, drop] = useDrop(() => ({
    accept: [ItemTypes.DIAGRAM_NODE, ItemTypes.CANVAS_NODE, ItemTypes.GROUP],
    hover: (item: DropItem, monitor) => {
        if (!canvasRef.current) return;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (clientOffset.x - rect.left - transform.x) / transform.k;
        const y = (clientOffset.y - rect.top - transform.y) / transform.k;

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
                    return currentGroupData.children.some((childId: string) => {
                        const childGroup = processedGroups.find(g => g.id === childId);
                        return childGroup ? checkDescendants(childGroup.id) : false;
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
    drop: (item: DropItem, monitor) => {
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
        
        
        
        if (itemType === ItemTypes.DIAGRAM_NODE) { 
            // Pass the full item data to preserve resource information
            addNode(item as any, { x, y }, hoveredGroupId);
        } else if (item.id && (itemType === ItemTypes.CANVAS_NODE || itemType === ItemTypes.GROUP)) {
            moveItem({ id: item.id, type: item.type || '', x: item.x, y: item.y }, { x, y }, hoveredGroupId);
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
      onItemSelect({ ...node, itemType: 'node' });
    }
  }

  const handleNodeRightClick = (e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    handleContextMenu(e, node.id, 'node');
  }

  const handleGroupClick = (e: React.MouseEvent, group: DiagramGroupData) => {
    e.stopPropagation();
    if (isConnectMode) {
      onNodeClickInConnectMode(group as any);
    } else {
      onItemSelect({ ...group, itemType: 'group' });
    }
  }

  const handleGroupRightClick = (e: React.MouseEvent, group: DiagramGroupData) => {
    e.stopPropagation();
    handleContextMenu(e, group.id, 'group');
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

  // Touch event handlers for mobile - simplified approach
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isConnectMode) return;
    const target = e.target as HTMLElement;
    
    // Check if touching an item (node or group) - let them handle their own touch events
    if (target.closest('.absolute')) {
      return; // Don't handle canvas pan/zoom when touching items
    }
    
    if (e.touches.length === 1) {
      // Single touch - start panning
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX - transform.x, y: touch.clientY - transform.y });
    } else if (e.touches.length === 2) {
      // Two touches - prepare for zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      setTouchStart({ x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2, distance });
      setLastTouchDistance(distance);
      setIsPanning(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      // Single touch - pan
      e.preventDefault(); // Only prevent default for panning
      const touch = e.touches[0];
      setTransform(t => ({ ...t, x: touch.clientX - panStart.x, y: touch.clientY - panStart.y }));
    } else if (e.touches.length === 2 && touchStart && lastTouchDistance !== null) {
      // Two touches - zoom
      e.preventDefault(); // Prevent page zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      if (!canvasRef.current) return;
      
      // Calculate zoom
      const scale = currentDistance / lastTouchDistance;
      const newK = Math.max(0.1, Math.min(transform.k * scale, 3));
      
      // Keep the same center point for zoom
      setTransform(t => ({ ...t, k: newK }));
      setLastTouchDistance(currentDistance);
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    setTouchStart(null);
    setLastTouchDistance(null);
  };

  const measureNodeDims = (n: PositionedNode) => {
    const isText = n.type === 'generic.text.text';
    const label = (n.label || '').toString();
    const maxCharsPerLine = isText ? 20 : 12;
    const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
    const height = (isText ? TEXT_NODE_HEIGHT : NODE_HEIGHT) + (lines - 1) * EXTRA_LINE_HEIGHT;
    const width = isText ? 200 : NODE_WIDTH; // conservative upper bound for text nodes
    return { width, height };
  };

  const handleFitToView = useCallback(() => {
    if (!canvasRef.current) return;

    const viewportWidth = canvasRef.current.clientWidth;
    const viewportHeight = canvasRef.current.clientHeight;

    const nodeBounds = processedNodes.length
      ? {
          minX: Math.min(...processedNodes.map(n => n.x)),
          minY: Math.min(...processedNodes.map(n => n.y)),
          maxX: Math.max(...processedNodes.map(n => n.x + measureNodeDims(n).width)),
          maxY: Math.max(...processedNodes.map(n => n.y + measureNodeDims(n).height)),
        }
      : null;

    const groupBounds = processedGroups.length
      ? {
          minX: Math.min(...processedGroups.map(g => g.x)),
          minY: Math.min(...processedGroups.map(g => g.y)),
          maxX: Math.max(...processedGroups.map(g => g.x + g.width)),
          maxY: Math.max(...processedGroups.map(g => g.y + g.height)),
        }
      : null;

    if (!nodeBounds && !groupBounds) {
      setTransform({ x: 0, y: 0, k: 1 });
      return;
    }

    let minX = Math.min(nodeBounds?.minX ?? Infinity, groupBounds?.minX ?? Infinity);
    let minY = Math.min(nodeBounds?.minY ?? Infinity, groupBounds?.minY ?? Infinity);
    let maxX = Math.max(nodeBounds?.maxX ?? -Infinity, groupBounds?.maxX ?? -Infinity);
    let maxY = Math.max(nodeBounds?.maxY ?? -Infinity, groupBounds?.maxY ?? -Infinity);

    // Add extra margin to account for edges/labels that can extend beyond shapes
    const logicalPadding = 60;
    const extraMargin = 80;
    minX -= extraMargin;
    minY -= extraMargin;
    maxX += extraMargin;
    maxY += extraMargin;

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    const scaleX = viewportWidth / (contentWidth + 2 * logicalPadding);
    const scaleY = viewportHeight / (contentHeight + 2 * logicalPadding);
    // Allow smaller scales so very large diagrams still fit; cap max zoom-in but allow tiny zoom-out
    const k = Math.min(4, Math.min(scaleX, scaleY));

    const displayWidth = k * (contentWidth + 2 * logicalPadding);
    const displayHeight = k * (contentHeight + 2 * logicalPadding);

    const offsetX = (viewportWidth - displayWidth) / 2;
    const offsetY = (viewportHeight - displayHeight) / 2;

    const x = offsetX - k * (minX - logicalPadding);
    const y = offsetY - k * (minY - logicalPadding);

    setTransform({ x, y, k });
  }, [processedNodes, processedGroups]);

  const exportPng = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(canvasRef.current, {
        pixelRatio: Math.min(3, window.devicePixelRatio || 1) * 2,
        cacheBust: true,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--background') || '#ffffff',
        skipFonts: true,
      });
      const link = document.createElement('a');
      link.download = 'diagram.png';
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Exported', description: 'PNG exported successfully.' });
    } catch (err) {
      // Swallow known SecurityError from cross-origin styles when fonts are parsed; we already set skipFonts
      toast({ variant: 'destructive', title: 'Export failed', description: 'Export encountered an issue.' });
    }
  }, [toast]);

  // Expose imperative API
  React.useImperativeHandle(ref, () => ({
    fitToView: handleFitToView,
    exportPng,
  }), [handleFitToView, exportPng]);

  // Sort items for proper hierarchical rendering: parent first, then children in order
  const sortedRenderItems = useMemo(() => {
    const parentMap = new Map<string, string>();
    processedGroups.forEach(g => {
      g.children.forEach((id: string) => parentMap.set(id, g.id));
    });

    const getDepth = (id: string): number => {
      let depth = 0;
      let current = parentMap.get(id);
      while (current) {
        depth++;
        current = parentMap.get(current);
      }
      return depth;
    };

    // Combine all items and sort by depth (parents first), then by original order
    const allItems = [
      ...processedGroups.map(g => ({ ...g, itemType: 'group' as const })),
      ...processedNodes.map(n => ({ ...n, itemType: 'node' as const }))
    ];

    return allItems.sort((a, b) => {
      const depthA = getDepth(a.id);
      const depthB = getDepth(b.id);
      
      // Parents first (lower depth)
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      
      // Same depth: maintain original order by using their position in the original arrays
      const indexA = a.itemType === 'group' 
        ? processedGroups.findIndex(g => g.id === a.id)
        : processedNodes.findIndex(n => n.id === a.id);
      const indexB = b.itemType === 'group'
        ? processedGroups.findIndex(g => g.id === b.id)
        : processedNodes.findIndex(n => n.id === b.id);
      
      return indexA - indexB;
    });
  }, [processedGroups, processedNodes]);

  const allObstacles = useMemo(() => {
    const nodeObstacles = processedNodes.map(n => {
      const dims = measureNodeDims(n);
      return ({
        id: n.id,
        x: n.x,
        y: n.y,
        width: dims.width,
        height: dims.height,
        isZone: false
      });
    });
    const groupObstacles = processedGroups.map(g => ({
      id: g.id,
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height,
      isZone: g.subType === 'zone'
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete key - delete selected item
      if (event.key === 'Delete' && selectedItemId) {
        handleDelete(selectedItemId);
        return;
      }

      // Ctrl+C - copy selected item
      if (event.ctrlKey && event.key === 'c' && selectedItemId) {
        event.preventDefault();
        handleCopy(selectedItemId);
        return;
      }

      // Ctrl+V - paste item
      if (event.ctrlKey && event.key === 'v' && clipboard) {
        event.preventDefault();
        handlePaste();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, clipboard]);

  // Handle mobile drop events
  useEffect(() => {
    const handleMobileDrop = (event: CustomEvent) => {
      const { item, x, y, itemType } = event.detail;
      
      // Calculate position accounting for transform
      const adjustedX = (x - transform.x) / transform.k;
      const adjustedY = (y - transform.y) / transform.k;
      
      // Check if dropping over a group
      let targetGroupId: string | null = null;
      for (let i = processedGroups.length - 1; i >= 0; i--) {
        const group = processedGroups[i];
        if (adjustedX > group.x && adjustedX < group.x + group.width && 
            adjustedY > group.y && adjustedY < group.y + group.height) {
          targetGroupId = group.id;
          break;
        }
      }
      
      
      
      if (itemType === ItemTypes.DIAGRAM_NODE) {
        addNode(item, { x: adjustedX, y: adjustedY }, targetGroupId);
      }
    };

    const handleMobileMove = (event: CustomEvent) => {
      const { id, type, x, y, originalX, originalY } = event.detail;
      
      // Calculate position accounting for transform
      const adjustedX = (x - transform.x) / transform.k;
      const adjustedY = (y - transform.y) / transform.k;
      
      // Check if dropping over a group
      let targetGroupId: string | null = null;
      for (let i = processedGroups.length - 1; i >= 0; i--) {
        const group = processedGroups[i];
        if (adjustedX > group.x && adjustedX < group.x + group.width && 
            adjustedY > group.y && adjustedY < group.y + group.height) {
          targetGroupId = group.id;
          break;
        }
      }
      
      
      
      if (type === ItemTypes.CANVAS_NODE || type === ItemTypes.GROUP) {
        moveItem({ id, type, x: originalX, y: originalY }, { x: adjustedX, y: adjustedY }, targetGroupId);
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setAttribute('data-testid', 'editor-canvas');
      canvas.addEventListener('mobileDrop', handleMobileDrop as EventListener);
      canvas.addEventListener('mobileMove', handleMobileMove as EventListener);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mobileDrop', handleMobileDrop as EventListener);
        canvas.removeEventListener('mobileMove', handleMobileMove as EventListener);
      }
    };
  }, [transform, processedGroups, addNode, moveItem]);

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, itemId: string, itemType: 'node' | 'group') => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      itemType,
      itemId
    });
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Action handlers
  const handleDelete = (itemId: string) => {
    const isNode = diagramData.nodes.some(n => n.id === itemId);
    
    if (isNode) {
      setDiagramData(prev => ({
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== itemId),
        connections: prev.connections.filter((e: any) => e.from !== itemId && e.to !== itemId),
        groups: prev.groups?.map(g => ({
          ...g,
          children: g.children.filter((n: string) => n !== itemId)
        }))
      }));
    } else {
      setDiagramData(prev => ({
        ...prev,
        groups: prev.groups?.filter(g => g.id !== itemId)
      }));
    }
    
    onItemSelect(null);
    toast({
      title: "Item Deleted",
      description: "The selected item has been deleted.",
    });
  };

  const handleCopy = (itemId: string) => {
    const node = diagramData.nodes.find(n => n.id === itemId);
    const group = diagramData.groups?.find(g => g.id === itemId);
    
    if (node) {
      setClipboard({ node: { ...node } });
    } else if (group) {
      setClipboard({ group: { ...group } });
    }
    
    toast({
      title: "Item Copied",
      description: "The selected item has been copied to clipboard.",
    });
  };

  const handlePaste = () => {
    if (!clipboard) return;

    if (clipboard.node) {
      const newNode: DiagramNodeData = {
        ...clipboard.node,
        id: generateSequentialId(clipboard.node.type, diagramData),
        x: (clipboard.node.x || 0) + 50,
        y: (clipboard.node.y || 0) + 50,
      };
      
      setDiagramData(prev => ({
        ...prev,
        nodes: [...prev.nodes, newNode]
      }));
    } else if (clipboard.group) {
      const newGroup: DiagramGroupData = {
        ...clipboard.group,
        id: generateGroupId((clipboard.group.subType as 'group' | 'zone') || 'group', diagramData),
        x: (clipboard.group.x || 0) + 50,
        y: (clipboard.group.y || 0) + 50,
      };
      
      setDiagramData(prev => ({
        ...prev,
        groups: [...(prev.groups || []), newGroup]
      }));
    }
    
    toast({
      title: "Item Pasted",
      description: "The copied item has been pasted to the canvas.",
    });
  };

  return (
    <div className="relative w-full h-full">
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
                {/* SVG connections rendered first (behind nodes) */}
                <svg
                width={width}
                height={height}
                className="absolute top-0 left-0 overflow-visible pointer-events-none"
                style={{ zIndex: 1 }}
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
                {(diagramData.connections || []).map((edge: any, index: any) => {
                    const fromItem = nodesById[edge.from] || groupsById[edge.from];
                    const toItem = nodesById[edge.to] || groupsById[edge.to];
                    if (!fromItem || !toItem) return null;

                    // 

                    const fromPos: any = {
                      ...fromItem,
                      width: 'width' in fromItem ? (fromItem as any).width : NODE_WIDTH,
                      height: 'height' in fromItem ? (fromItem as any).height : NODE_HEIGHT,
                    };
                    const toPos: any = {
                      ...toItem,
                      width: 'width' in toItem ? (toItem as any).width : NODE_WIDTH,
                      height: 'height' in toItem ? (toItem as any).height : NODE_HEIGHT,
                    };

                    // Explicitly set lineColor after spreading to ensure it's not overwritten
                    fromPos.lineColor = (fromItem as any).lineColor;
                    toPos.lineColor = (toItem as any).lineColor;

                    // 

                    // Build parent map for groups to gather ancestor groups of endpoints
                    const parentMap = new Map<string, string>();
                    processedGroups.forEach(g => {
                      g.children.forEach((id: string) => parentMap.set(id, g.id));
                    });
                    const ancestorsOf = (id: string): string[] => {
                      const res: string[] = [];
                      let cur = parentMap.get(id);
                      const guard = new Set<string>();
                      while (cur && !guard.has(cur)) {
                        res.push(cur);
                        guard.add(cur);
                        cur = parentMap.get(cur);
                      }
                      return res;
                    };

                    const allowedOverlapIds = [
                      ...ancestorsOf(edge.from),
                      ...ancestorsOf(edge.to),
                      ...(toItem && 'type' in toItem && (toItem as any).type === 'group' ? [edge.to] : []),
                    ];

                    const isConnectionHighlighted = selectedItemId === edge.from || selectedItemId === edge.to;

return (
                    <g key={`${edge.from}-${edge.to}-${index}`} className={cn(isConnectionHighlighted && 'drop-shadow-[0_0_6px_rgba(0,200,150,0.8)]')}>
                      <DiagramConnection
                        from={fromPos}
                        to={toPos}
                        allObstacles={allObstacles}
                        allowedOverlapIds={allowedOverlapIds}
                        connectionColor={edge.color}
                        connectionData={edge}
                        onClick={(connection) => {
                          // Handle connection click - you can add custom logic here
                          console.log('Connection clicked:', connection);
                          // For now, just log it - you can expand this to show a modal, edit text, etc.
                        }}
                      />
                    </g>
                    );
                })}
                </svg>
                
                {/* Nodes and groups rendered on top of connections */}
                {sortedRenderItems.map((item) => {
                  if (item.itemType === 'group') {
                    return (
                      <div key={item.id} onClick={(e) => handleGroupClick(e, item)} onContextMenu={(e) => handleGroupRightClick(e, item)} style={{ zIndex: 0, overflow: 'visible' }}>
                        <DiagramGroup 
                          group={item}
                          isSelected={selectedItemId === item.id && !isConnectMode}
                          isDropTarget={hoveredGroupId === item.id}
                          isTargetable={isConnectMode && selectedItemId !== item.id}
                        />
                      </div>
                    );
                  } else {
                    const isConnectedToSelected = !!selectedItemId && (diagramData.connections || []).some((e: any) => e.from === selectedItemId && e.to === item.id || e.to === selectedItemId && e.from === item.id);
                    return (
                      <div key={item.id} onClick={(e) => handleNodeClick(e, item)} onContextMenu={(e) => handleNodeRightClick(e, item)} style={{ zIndex: 2, position: 'relative', transform: 'translateZ(0)' }}>
                        <DiagramNode 
                          node={item} 
                          isSelected={selectedItemId === item.id && !isConnectMode}
                          isTargetable={isConnectMode && selectedItemId !== item.id}
                          isHighlighted={isConnectedToSelected}
                        />
                      </div>
                    );
                  }
                })}
                
                {/* Connection text rendered on top of everything */}
                <svg
                width={width}
                height={height}
                className="absolute top-0 left-0 overflow-visible pointer-events-none"
                style={{ zIndex: 3 }}
                >
                {(diagramData.connections || []).map((edge: any, index: any) => {
                    const fromItem = nodesById[edge.from] || groupsById[edge.from];
                    const toItem = nodesById[edge.to] || groupsById[edge.to];
                    if (!fromItem || !toItem) return null;

                    const fromPos: any = {
                      ...fromItem,
                      width: 'width' in fromItem ? (fromItem as any).width : NODE_WIDTH,
                      height: 'height' in fromItem ? (fromItem as any).height : NODE_HEIGHT,
                    };
                    const toPos: any = {
                      ...toItem,
                      width: 'width' in toItem ? (toItem as any).width : NODE_WIDTH,
                      height: 'height' in toItem ? (toItem as any).height : NODE_HEIGHT,
                    };

                    // Explicitly set lineColor after spreading to ensure it's not overwritten
                    fromPos.lineColor = (fromItem as any).lineColor;
                    toPos.lineColor = (toItem as any).lineColor;

                    // Build parent map for groups to gather ancestor groups of endpoints
                    const parentMap = new Map<string, string>();
                    processedGroups.forEach(g => {
                      g.children.forEach((id: string) => parentMap.set(id, g.id));
                    });
                    const ancestorsOf = (id: string): string[] => {
                      const res: string[] = [];
                      let cur = parentMap.get(id);
                      const guard = new Set<string>();
                      while (cur && !guard.has(cur)) {
                        res.push(cur);
                        guard.add(cur);
                        cur = parentMap.get(cur);
                      }
                      return res;
                    };

                    const allowedOverlapIds = [
                      ...ancestorsOf(edge.from),
                      ...ancestorsOf(edge.to),
                      ...(toItem && 'type' in toItem && (toItem as any).type === 'group' ? [edge.to] : []),
                    ];

                    return (
                      <DiagramConnectionText
                        key={`text-${edge.from}-${edge.to}-${index}`}
                        connectionData={edge}
                        from={fromPos}
                        to={toPos}
                        connectionColor={edge.color}
                        allObstacles={allObstacles}
                        allowedOverlapIds={allowedOverlapIds}
                      />
                    );
                })}
                </svg>
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
        
        {/* Context Menu */}
        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          itemType={contextMenu.itemType}
          onClose={closeContextMenu}
          onCopy={() => handleCopy(contextMenu.itemId)}
          onDelete={() => handleDelete(contextMenu.itemId)}
          onConnect={() => {
            const item = diagramData.nodes.find(n => n.id === contextMenu.itemId) || 
                       diagramData.groups?.find(g => g.id === contextMenu.itemId);
            if (item) {
              onItemSelect({ ...item, itemType: contextMenu.itemType });
              onConnect?.();
            }
          }}
          onDisconnect={() => {
            // Remove all connections to/from this item
            setDiagramData(prev => ({
              ...prev,
              connections: prev.connections.filter((e: any) => e.from !== contextMenu.itemId && e.to !== contextMenu.itemId)
            }));
            toast({
              title: "Connections Disconnected",
              description: "All connections to/from this item have been removed.",
            });
            onDisconnect?.();
          }}
        />

        {/* Fit-to-view floating button */}
        <div className="absolute bottom-4 right-4 z-50">
          <Button variant="secondary" size="icon" onClick={handleFitToView} className="rounded-full shadow-md">
            <Maximize2 className="h-5 w-5" />
            <span className="sr-only">Resize to fit</span>
          </Button>
        </div>
    </div>
  );
});
