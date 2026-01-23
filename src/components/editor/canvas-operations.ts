import { useCallback } from "react";
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramGroupData } from "@/lib/types";
import { ItemTypes } from "./draggable-item";
import { generateGroupId, generateSequentialId } from "@/lib/id-generator";
import { DEFAULT_THEMES } from "@/lib/theme-manager";
import { DEFAULT_TEXT_STYLING } from "@/lib/text-styling";
import { 
  NODE_WIDTH, 
  NODE_HEIGHT, 
  ZONE_PADDING,
  snapToGrid, 
  measureNodeDims,
  type PositionedNode,
  type PositionedGroup,
} from "./canvas-constants";
import { recalculateGroupSize } from "./canvas-layout-utils";
import { cleanupEmptyZones } from "@/lib/grouping-utils";
import { applyZoneLayout, cycleZoneItems } from "@/lib/zone-layout-utils";

interface UseCanvasOperationsOptions {
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  processedNodes: PositionedNode[];
  processedZones: PositionedGroup[];
  onItemSelect: (item: any | null) => void;
  toast: (options: { variant?: 'destructive' | 'default'; title: string; description: string }) => void;
  iconBackgroundEnabled?: boolean;
}

export function useCanvasOperations({
  setDiagramData,
  processedNodes,
  processedZones,
  onItemSelect,
  toast,
  iconBackgroundEnabled = true,
}: UseCanvasOperationsOptions) {
  // Function to get random theme for shapes
  const getRandomTheme = () => {
    const themes = DEFAULT_THEMES.filter(theme => theme.isBuiltIn);
    const randomIndex = Math.floor(Math.random() * themes.length);
    return themes[randomIndex].properties;
  };

  const addNode = useCallback((item: any, position: { x: number; y: number }, targetGroupId: string | null) => {
    setDiagramData((prevData) => {
      let newZones = prevData.zones ? [...prevData.zones] : [];
      let newNodes = prevData.nodes ? [...prevData.nodes] : [];
      let newItemId: string;

      // Use originalType if available (for shape preservation), otherwise use type
      const itemType = item.originalType || item.type || '';
      const itemLabel = item.label || '';
      
      // Debug logging for all items to see what we're getting
      console.log('addNode called with:', { itemType, itemLabel, item });
      
      // Debug logging for zone creation
      if (itemType === 'zone') {
        console.log('Creating zone:', { itemType, itemLabel, item });
      }
      
      // Check if this is a scratchpad item that already exists on canvas
      const isFromScratchPad = item.fromScratchPad || item.data?.fromScratchPad;
      const importId = item.importId || item.data?.importId;
      let existingNode = null;
      
      if (isFromScratchPad && importId) {
        existingNode = prevData.nodes.find(n => n.importId === importId);
      }
      
      // If item exists and is from scratchpad, create a copy with new ID
      if (existingNode) {
        console.log('Creating copy of existing scratchpad item:', existingNode.id);
        // We'll create a new node based on the existing one but with a new ID
        const copyNode: DiagramNodeData = {
          ...existingNode,
          id: generateSequentialId(existingNode.type, prevData),
          x: position.x,
          y: position.y,
          // Remove importId to make this a standalone copy
          importId: undefined,
          // Update label to indicate it's a copy
          label: existingNode.label ? 
            `${existingNode.label.replace(/(\s\(copy\))+$/g, '').trim()} (copy)` : 
            undefined
        };
        newNodes.push(copyNode);
        newItemId = copyNode.id;
      }
      
      // Check if this is a shape resource (needed for freeflow and group exclusion)
      const isShapeResource = itemType === 'generic.object.square' ||
                                itemType === 'generic.object.circle' ||
                                itemType === 'generic.object.point' ||
                                itemType === 'generic.object.rectangle' ||
                                itemType === 'generic.object.rounded-rectangle' ||
                                itemType === 'generic.object.triangle' ||
                                itemType === 'generic.object.star' ||
                                itemType === 'generic.object.cloud' ||
                                itemType === 'generic.object.parallelogram' ||
                                itemType === 'generic.object.trapezoid' ||
                                itemType === 'generic.object.kite' ||
                                itemType === 'generic.object.hexagon' ||
                                itemType === 'generic.object.pentagon' ||
                                itemType === 'generic.object.octagon' ||
                                itemType === 'generic.object.jigsaw' ||
                                itemType === 'generic.object.arrowhead' ||
                                itemType === 'generic.object.chevron' ||
                                itemType?.endsWith('.square') ||
                                itemType?.endsWith('.circle') ||
                                itemType?.endsWith('.point') ||
                                itemType?.endsWith('.rectangle') ||
                                itemType?.endsWith('.rounded-rectangle') ||
                                itemType?.endsWith('.triangle') ||
                                itemType?.endsWith('.star') ||
                                itemType?.endsWith('.cloud') ||
                                itemType?.endsWith('.parallelogram') ||
                                itemType?.endsWith('.trapezoid') ||
                                itemType?.endsWith('.kite') ||
                                itemType?.endsWith('.hexagon') ||
                                itemType?.endsWith('.pentagon') ||
                                itemType?.endsWith('.octagon') ||
                                itemType?.endsWith('.jigsaw') ||
                                itemType?.endsWith('.arrowhead');
      
      // Check if this is a textbox resource
      const isTextboxResource = itemType === 'generic.text.textbox' || itemType?.endsWith('.textbox');
      
      if (!existingNode && itemType === 'zone') {
        // Use subType from item if available, otherwise derive from type
        const subType = item.subType || 'zone';
        const newZone: DiagramZoneData = {
          id: generateGroupId(subType, prevData),
          label: itemLabel,
          children: [],
          type: 'zone',
          subType,
          info: `A new ${itemLabel}`,
          color: undefined,
          sizeMode: 'auto', // Default to auto-sizing
          textPosition: 'outside-top', // Default text position for new zones
          textJustify: 'left', // Default text justification for new zones
          x: position.x,
          y: position.y,
          width: 300,
          height: 220,
        };
        newZones.push(newZone);
        newItemId = newZone.id;
        console.log('Zone created and added to zones:', newZone);
      } else if (!existingNode) {
        // For resource items from the sidebar, use type from drag item
        // NEVER store file in node - ResourceIcon looks up file from resource catalog
        // Special handling for shape resources - make them resizable and freeflow
        const newNode: DiagramNodeData = {
          id: generateSequentialId(itemType, prevData),
          type: itemType,
          // Set label based on type - shapes get blank by default, unless it's a configured item (e.g. from Scratch Pad)
          label: (isShapeResource && !item.label) ? '' : itemLabel,
          // Don't set info/description for text and textbox resource types, or shapes
          ...(itemType !== 'generic.text.text' && itemType !== 'generic.text.textbox' && !isShapeResource && {
            info: item.provider ? `${itemLabel} from ${item.provider}` : `A new ${itemLabel}`
          }),
          freeflow: isShapeResource ? true : undefined, // Shapes are always freeflow
          sizeMode: (isShapeResource || isTextboxResource) ? 'custom' : undefined, // Shapes and textboxes use custom sizing
           width: isShapeResource ? (
             itemType === 'generic.object.point' ? 20 :
             itemType === 'generic.object.rectangle' ? 80 :
             itemType === 'generic.object.rounded-rectangle' ? 80 :
             itemType === 'generic.object.cloud' ? 80 :
             60
           ) : isTextboxResource ? 120 : undefined, // Initial width - larger for textbox
           height: isShapeResource ? (
             itemType === 'generic.object.point' ? 20 :
             itemType === 'generic.object.rectangle' ? 50 :
             itemType === 'generic.object.rounded-rectangle' ? 50 :
             itemType === 'generic.object.cloud' ? 50 :
             60
           ) : isTextboxResource ? 80 : undefined, // Initial height - larger for textbox
          // Apply default text color for text resources
          ...((itemType === 'generic.text.text' || itemType === 'generic.text.textbox') && {
            textColor: DEFAULT_TEXT_STYLING.textColor
          }),
          // Apply random theme to all shapes (except point which has special styling)
          // BUT: Don't apply random theme if coming from scratchpad with existing properties
          ...(isShapeResource && itemType !== 'generic.object.point' && !isFromScratchPad && {
            ...getRandomTheme()
          }),
          // Special defaults for point shape (only if not from scratchpad)
          ...(itemType === 'generic.object.point' && !isFromScratchPad && {
            borderStyle: 'none', // No outline by default
            backgroundColor: '#808080' // Grey color by default
          }),
          // Apply icon background setting
          ...(!iconBackgroundEnabled && {
            noIconBackground: true
          }),
          // Merge extra properties from item (favorites/imports), excluding reserved ones
          // Keep provider, category, and file for icon rendering
          // This MUST come AFTER random theme so scratchpad properties override defaults
          ...Object.keys(item).reduce((acc: any, key) => {
             if (!['type', 'label', 'x', 'y', 'id', 'fromScratchPad'].includes(key)) {
               acc[key] = item[key];
             }
             return acc;
          }, {}),
        };
        newNodes.push(newNode);
        newItemId = newNode.id;
      }
      
      // Don't add freeflow shape nodes to groups
      const addedItem = newNodes.find(n => n.id === newItemId) || newZones.find(zone => zone.id === newItemId);
      const isFreeflowShape = (addedItem as any)?.freeflow === true && isShapeResource;
      
      if (targetGroupId && !isFreeflowShape) {
        newZones = newZones.map(zone => {
          if (zone.id === targetGroupId) {
            const updatedZone = { ...zone, children: [...zone.children, newItemId] };
            // Recalculate zone size based on new children including dynamic dimensions
            return recalculateGroupSize(updatedZone, newNodes, newZones);
          }
          return zone;
        });
        
        // If target zone has circular layout, re-apply layout to recalculate positions
        const targetZone = newZones.find(z => z.id === targetGroupId);
        if (targetZone?.layoutType === 'circular') {
          const intermediateData = { ...prevData, nodes: newNodes, zones: newZones };
          const updatedWithLayout = applyZoneLayout(targetGroupId, intermediateData);
          newNodes = updatedWithLayout.nodes;
          newZones = updatedWithLayout.zones;
        }
      } else {
        // Top-level placement: snap to grid and avoid overlap by nudging to nearest free slot
        let posX = snapToGrid(position.x);
        let posY = snapToGrid(position.y);

        const isOverlapAt = (x: number, y: number) => {
          const width = item.type === 'zone' ? 300 : 
                      (item.type ? measureNodeDims(item as PositionedNode).width : NODE_WIDTH);
          const height = item.type === 'zone' ? 220 : 
                       (item.type ? measureNodeDims(item as PositionedNode).height : NODE_HEIGHT);
          const rectA = { x, y, width, height };
          // existing obstacles from processed nodes/groups at this render cycle are not available here,
          // so approximate using current prevData nodes/groups positions
          const obstacles: { x: number; y: number; width: number; height: number; id: string }[] = [];
          for (const n of newNodes) {
            const nn: any = n as any;
            if (nn.x != null && nn.y != null) {
              const dims = measureNodeDims(nn as PositionedNode);
              obstacles.push({ id: n.id, x: nn.x, y: nn.y, width: dims.width, height: dims.height });
            }
          }
          for (const zone of newZones) {
            if (zone.x != null && zone.y != null && zone.id !== newItemId) {
              // zones without computed size: approximate
              obstacles.push({ id: zone.id, x: zone.x, y: zone.y, width: 300, height: 220 });
            }
          }
          return obstacles.some(o => !(x + rectA.width <= o.x || o.x + o.width <= x || y + rectA.height <= o.y || o.y + o.height <= y));
        };

        // Check if the new node should be freeflow (skip overlap prevention)
        const addedItem = newNodes.find(n => n.id === newItemId) || newZones.find(zone => zone.id === newItemId);
        const isFreeflowNewItem = (addedItem as any)?.freeflow;

        // nudge search (spiral-ish) up to 50 attempts (skip for freeflow items)
        const dirs = [ [1,0],[0,1],[-1,0],[0,-1] ];
        let step = 1; let attempts = 0; let dirIdx = 0; let movesInDir = 0; let changes = 0;
        while (!isFreeflowNewItem && isOverlapAt(posX, posY) && attempts < 50) {
          // Use 10px increments for nudging (smaller step size)
          const nudgeStep = 10;
          posX += dirs[dirIdx][0] * nudgeStep;
          posY += dirs[dirIdx][1] * nudgeStep;
          // Snap after nudging
          posX = snapToGrid(posX);
          posY = snapToGrid(posY);
          movesInDir++;
          if (movesInDir === step) { dirIdx = (dirIdx + 1) % 4; movesInDir = 0; changes++; if (changes % 2 === 0) step++; }
          attempts++;
        }

        if (addedItem) {
          (addedItem as any).x = posX;
          (addedItem as any).y = posY;
        }
      }

      return { ...prevData, nodes: newNodes, zones: newZones };
    });
  }, [setDiagramData]);

  const resizeNode = useCallback((nodeId: string, newWidth: number, newHeight: number) => {
    setDiagramData(prevData => {
      const updatedNodes = prevData.nodes?.map(node => {
        if (node.id === nodeId) {
          // Calculate minimum size based on node type
          let minWidth = 80;
          let minHeight = 40;
          
           const isShapeNode = node.type === 'generic.object.square' ||
                              node.type === 'generic.object.circle' ||
                              node.type === 'generic.object.point' ||
                              node.type === 'generic.object.rectangle' ||
                              node.type === 'generic.object.rounded-rectangle' ||
                              node.type === 'generic.object.triangle' ||
                              node.type === 'generic.object.star' ||
                              node.type === 'generic.object.cloud' ||
                              node.type === 'generic.object.chevron' ||
                              node.type?.endsWith('.square') ||
                              node.type?.endsWith('.circle') ||
                              node.type?.endsWith('.point') ||
                              node.type?.endsWith('.rectangle') ||
                              node.type?.endsWith('.rounded-rectangle') ||
                              node.type?.endsWith('.triangle') ||
                              node.type?.endsWith('.star') ||
                              node.type?.endsWith('.cloud') ||
                              node.type?.endsWith('.chevron');
          
          if (node.type === 'generic.text.textbox') {
            minWidth = 40;
            minHeight = 40;
          } else if (node.type === 'generic.text.textbox') {
            minWidth = 40;
            minHeight = 40;
          } else if (isShapeNode) {
            minWidth = 20;
            minHeight = 20;
          }
          
          return {
            ...node,
            width: Math.max(minWidth, newWidth),
            height: Math.max(minHeight, newHeight),
            sizeMode: 'custom' as const
          };
        }
        return node;
      }) || [];
      
      return { ...prevData, nodes: updatedNodes };
    });
  }, [setDiagramData]);

  const resizeGroup = useCallback((groupId: string, newWidth: number, newHeight: number) => {
    setDiagramData(prevData => {
      const updatedZones = prevData.zones?.map(zone => {
        if (zone.id === groupId) {
          // Calculate minimum size based on content using dynamic dimensions
          const currentZone = processedZones.find(z => z.id === groupId);
          const groupNodes = processedNodes.filter(n => currentZone?.children.includes(n.id));
          
          let minWidth = 200;
          let minHeight = 150;
          
          if (groupNodes.length > 0) {
            const maxNodeWidth = Math.max(...groupNodes.map(n => measureNodeDims(n).width));
            const maxNodeHeight = Math.max(...groupNodes.map(n => measureNodeDims(n).height));
            minWidth = Math.max(minWidth, maxNodeWidth + ZONE_PADDING * 2);
            minHeight = Math.max(minHeight, maxNodeHeight + ZONE_PADDING * 2);
          }
          
          return {
            ...zone,
            width: Math.max(minWidth, newWidth),
            height: Math.max(minHeight, newHeight),
            sizeMode: 'custom' as const,
            minWidth,
            minHeight
          };
        }
        return zone;
      }) || [];
      
      return { ...prevData, zones: updatedZones };
    });
  }, [setDiagramData, processedZones, processedNodes]);

  const updateGroupLabel = useCallback((groupId: string, newLabel: string) => {
    setDiagramData(prevData => {
      const updatedZones = prevData.zones?.map(zone => {
        if (zone.id === groupId) {
          return {
            ...zone,
            label: newLabel
          };
        }
        return zone;
      }) || [];
      
      return { ...prevData, zones: updatedZones };
    });
  }, [setDiagramData]);

  const moveMultipleItems = useCallback((items: Array<{ id: string; type: string; x?: number, y?: number }>, newPositions: Array<{ x: number; y: number }>, targetGroupId: string | null) => {
    setDiagramData(prevData => {
      let currentNodes = [...(prevData.nodes || [])];
      let currentZones = [...(prevData.zones || [])];
      
      items.forEach((item, index) => {
        const newPos = newPositions[index];
        if (!newPos) return;
        
        const oldParentId = currentZones.find(zone => zone.children.includes(item.id))?.id;
        const isFreeflowNode = currentNodes.find(n => n.id === item.id)?.freeflow;

        // Handle re-parenting
        if (oldParentId !== targetGroupId) {
          currentZones = currentZones.map(zone => {
            if (zone.id === oldParentId) { 
              return { ...zone, children: zone.children.filter((nid: string) => nid !== item.id) };
            }
            if (zone.id === targetGroupId) {
              const filtered = zone.children.filter((nid: string) => nid !== item.id);
              filtered.push(item.id);
              return { ...zone, children: filtered };
            }
            return zone;
          });
        }

        // Handle positioning
        if (targetGroupId && !isFreeflowNode) {
          // Item is now a child - remove explicit coords
          if (item.type === ItemTypes.CANVAS_NODE) {
            currentNodes = currentNodes.map(n => n.id === item.id ? { ...n, x: undefined, y: undefined } : n);
          } else { 
            currentZones = currentZones.map(zone => zone.id === item.id ? { ...zone, x: undefined, y: undefined } : zone);
          }
        } else {
          // Top-level - update coordinates
          const snappedX = snapToGrid(newPos.x);
          const snappedY = snapToGrid(newPos.y);
          
          if (item.type === ItemTypes.CANVAS_NODE) {
            currentNodes = currentNodes.map(n => n.id === item.id ? { ...n, x: snappedX, y: snappedY } : n);
          } else { 
            currentZones = currentZones.map(zone => zone.id === item.id ? { ...zone, x: snappedX, y: snappedY } : zone);
          }
        }
      });

      let finalData = { ...prevData, nodes: currentNodes, zones: currentZones };

      // If items were moved within the same circular zone, cycle items
      // This applies when all items have the same oldParentId and targetGroupId
      if (targetGroupId) {
        const targetZone = finalData.zones?.find(z => z.id === targetGroupId);
        if (targetZone?.layoutType === 'circular') {
          finalData = cycleZoneItems(targetGroupId, finalData);
        }
      }

      return finalData;
    });
  }, [setDiagramData]);

  const moveItem = useCallback((item: { id: string; type: string; x?: number, y?: number }, newPos: { x: number; y: number }, targetGroupId: string | null) => {
    setDiagramData(prevData => {
      let currentNodes = [...(prevData.nodes || [])];
      let currentZones = [...(prevData.zones || [])];
      
      const oldParentId = currentZones.find(zone => zone.children.includes(item.id))?.id;

      // Utility to compute insert index inside a group based on pointer position
      const computeInsertIndex = (groupId: string, drop: { x: number; y: number }) => {
        const pg = processedZones.find(zone => zone.id === groupId);
        if (!pg) return 0;
        const children = currentZones.find(zone => zone.id === groupId)?.children.filter((id: string) => id !== item.id) || [];
        const infos = children
          .map((id: string) => {
            const n = processedNodes.find(pn => pn.id === id);
            if (n) {
              const dims = measureNodeDims(n);
              return { id, x: n.x, y: n.y, width: dims.width, height: dims.height };
            }
            const z = processedZones.find(zone2 => zone2.id === id);
            if (z) return { id, x: z.x, y: z.y, width: z.width, height: z.height };
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
        currentZones = currentZones.map(zone => {
          if (zone.id === oldParentId) { 
            return { ...zone, children: zone.children.filter((nid: string) => nid !== item.id) };
          }
          if (zone.id === targetGroupId) {
            // Can't drop a zone into itself or its descendants
            const visited = new Set<string>();
            const isDescendant = (childId: string, parentId: string): boolean => {
              if (childId === parentId) return true;
              if (visited.has(childId)) return false; // Avoid infinite loops
              visited.add(childId);
              const childZone = currentZones.find(z => z.id === childId);
              if (!childZone) return false;
              return childZone.children.some((nid: string) => isDescendant(nid, parentId));
            };
            if (item.type === ItemTypes.ZONE && isDescendant(zone.id, item.id)) {
              return zone;
            }
            // Defer actual insertion to ordering step below
            return zone;
          }
          return zone;
        });

        // Clean up residual information when moving out of old group
        if (oldParentId && item.type === ItemTypes.ZONE) {
          // Remove parentId from the moved group and all its descendants
          const cleanUpParentId = (groupId: string) => {
            const zone = currentZones.find(zone => zone.id === groupId);
            if (zone) {
              // Remove parentId reference
              const groupIndex = currentZones.findIndex(g => g.id === groupId);
              if (groupIndex !== -1) {
                currentZones[groupIndex] = { ...zone, parentId: undefined };
              }
              
              // Recursively clean up all child groups
              zone.children.forEach(childId => {
                const childZone = currentZones.find(zone => zone.id === childId);
                if (childZone) {
                  cleanUpParentId(childId);
                }
              });
            }
          };
          cleanUpParentId(item.id);
        }
      }

      // Check if item is a freeflow node
      const isFreeflowNode = currentNodes.find(n => n.id === item.id)?.freeflow;
      
      // If target is a group and item is NOT freeflow, set ordering within that group (reorder or insert)
      if (targetGroupId && !isFreeflowNode) {
        currentZones = currentZones.map(zone => {
          if (zone.id !== targetGroupId) return zone;
          const filtered = zone.children.filter((nid: string) => nid !== item.id);
          const insertIndex = computeInsertIndex(targetGroupId, newPos);
          filtered.splice(insertIndex, 0, item.id);
          return { ...zone, children: filtered };
        });

        // Set parentId for groups that are moved into a new parent
        if (item.type === ItemTypes.ZONE && targetGroupId) {
          const setParentId = (groupId: string, parentId: string) => {
            const zone = currentZones.find(zone => zone.id === groupId);
            if (zone) {
              const groupIndex = currentZones.findIndex(g => g.id === groupId);
              if (groupIndex !== -1) {
                currentZones[groupIndex] = { ...zone, parentId };
              }
              
              // Recursively set parentId for all child groups
              zone.children.forEach(childId => {
                const childZone = currentZones.find(zone => zone.id === childId);
                if (childZone) {
                  setParentId(childId, groupId);
                }
              });
            }
          };
          setParentId(item.id, targetGroupId);
        }
      } else if (!targetGroupId && item.type === ItemTypes.ZONE) {
        // Group moved to canvas (orphaned) - clear parentId for moved group and all descendants
        const clearParentId = (groupId: string) => {
          const zone = currentZones.find(zone => zone.id === groupId);
          if (zone) {
            const groupIndex = currentZones.findIndex(g => g.id === groupId);
            if (groupIndex !== -1) {
              currentZones[groupIndex] = { ...zone, parentId: undefined };
            }
            
            // Recursively clear parentId for all child groups
            zone.children.forEach(childId => {
              const childZone = currentZones.find(zone => zone.id === childId);
              if (childZone) {
                clearParentId(childId);
              }
            });
          }
        };
        clearParentId(item.id);
      }
  
      // Handle positioning
      if (item.type === ItemTypes.CANVAS_NODE || item.type === ItemTypes.ZONE) {
        // Check if item is a freeflow node
        const isFreeflowNode = currentNodes.find(n => n.id === item.id)?.freeflow;
        
        // If item is (now) a child and NOT freeflow, its position is auto-calculated, so remove explicit coords.
        // Freeflow nodes always maintain their coordinates even if dropped over a group.
        if (targetGroupId && !isFreeflowNode) {
          if (item.type === ItemTypes.CANVAS_NODE) {
            currentNodes = currentNodes.map(n => n.id === item.id ? { ...n, x: undefined, y: undefined } : n);
          } else { 
            currentZones = currentZones.map(zone => zone.id === item.id ? { ...zone, x: undefined, y: undefined } : zone);
          }
        } else {
          // Top-level: snap and prevent overlap
          const snappedX = snapToGrid(newPos.x);
          const snappedY = snapToGrid(newPos.y);

          const movingIsZone = item.type === ItemTypes.ZONE;
          const movingDims = movingIsZone
            ? (() => {
                const zone = processedZones.find(pz => pz.id === item.id);
                return { width: zone?.width ?? 300, height: zone?.height ?? 220 };
              })()
            : (() => {
                const n = processedNodes.find(pn => pn.id === item.id);
                if (n) return measureNodeDims(n);
                return { width: NODE_WIDTH, height: NODE_HEIGHT };
              })();

          const allChildIds = new Set<string>();
          const getChildrenRecursive = (itemId: string) => {
              if (allChildIds.has(itemId)) return;
              allChildIds.add(itemId);
              const zone = currentZones.find(z => z.id === itemId);
              if (!zone) return;
              zone.children.forEach((childId: string) => getChildrenRecursive(childId));
          };
          if (movingIsZone) getChildrenRecursive(item.id);

          const isOverlapAt = (x: number, y: number) => {
            const rectA = { x, y, width: movingDims.width, height: movingDims.height };
            // obstacles: all processed nodes/groups except moving item and its descendants
            const obstacles: { x: number; y: number; width: number; height: number; id: string }[] = [
              ...processedNodes.map(n => {
                const dims = measureNodeDims(n);
                return { id: n.id, x: n.x, y: n.y, width: dims.width, height: dims.height };
              }),
              ...processedZones.map(zone => ({ id: zone.id, x: zone.x, y: zone.y, width: zone.width, height: zone.height })),
            ].filter(o => o.id !== item.id && !allChildIds.has(o.id));
            return obstacles.some(o => !(x + rectA.width <= o.x || o.x + o.width <= x || y + rectA.height <= o.y || o.y + o.height <= y));
          };

          // Skip overlap prevention for freeflow nodes
          if (!isFreeflowNode && isOverlapAt(snappedX, snappedY)) {
            // Abort move if overlapping; user must choose a free grid cell
            return prevData;
          }

          const draggedItemData = processedNodes.find(n => n.id === item.id) || processedZones.find(zone => zone.id === item.id);
          const originalX = draggedItemData?.x ?? 0;
          const originalY = draggedItemData?.y ?? 0;
          const dx = snappedX - originalX;
          const dy = snappedY - originalY;

          if (movingIsZone) {
            currentZones = currentZones.map(zone => {
              if (zone.id === item.id) return { ...zone, x: snappedX, y: snappedY };
              if (allChildIds.has(zone.id)) {
                const originalChild = processedZones.find(childZone => childZone.id === zone.id);
                return { ...zone, x: (originalChild?.x ?? 0) + dx, y: (originalChild?.y ?? 0) + dy };
              }
              return zone;
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
        
        let finalData = { ...prevData, nodes: currentNodes, zones: currentZones };
      
      // If item was moved into or out of a circular zone, re-apply layout to affected zones
      if (oldParentId !== targetGroupId) {
        // Item moved - check both old and new parent zones
        const zonesToRelayout: string[] = [];
        
        if (oldParentId) {
          const oldZone = finalData.zones?.find(z => z.id === oldParentId);
          if (oldZone?.layoutType === 'circular' && oldZone.children.length > 0) {
            zonesToRelayout.push(oldParentId);
          }
        }
        
        if (targetGroupId) {
          const newZone = finalData.zones?.find(z => z.id === targetGroupId);
          if (newZone?.layoutType === 'circular') {
            zonesToRelayout.push(targetGroupId);
          }
        }
        
        // Apply layout to all affected zones
        zonesToRelayout.forEach(zoneId => {
          finalData = applyZoneLayout(zoneId, finalData);
        });
      } else if (targetGroupId) {
        // Item moved within the same zone - check if it's a circular zone and cycle items
        const targetZone = finalData.zones?.find(z => z.id === targetGroupId);
        if (targetZone?.layoutType === 'circular') {
          finalData = cycleZoneItems(targetGroupId, finalData);
        }
      }
      
      // If moved item itself is a circular zone, re-apply its layout
      // This keeps items oriented correctly within the zone after moving the zone
      const isMovingCircularZone = item.type === ItemTypes.ZONE && finalData.zones?.find(z => z.id === item.id)?.layoutType === 'circular';
      if (isMovingCircularZone) {
        finalData = applyZoneLayout(item.id, finalData);
      }
      
      return finalData;
    });
  }, [setDiagramData, processedNodes, processedZones]);

  const handleDelete = useCallback((itemId: string) => {
    setDiagramData(prev => {
      const isNode = prev.nodes.some(n => n.id === itemId);
      
      let updatedData;
      if (isNode) {
        updatedData = {
          ...prev,
          nodes: prev.nodes.filter(n => n.id !== itemId),
          connections: prev.connections.filter((e: any) => e.from !== itemId && e.to !== itemId),
          zones: prev.zones?.map(zone => ({
            ...zone,
            children: zone.children.filter((n: string) => n !== itemId)
          }))
        };
      } else {
        updatedData = {
          ...prev,
          zones: prev.zones?.filter(zone => zone.id !== itemId)
        };
      }
      
      // Clean up empty zones after deletion
      updatedData = cleanupEmptyZones(updatedData);
      
      // If a node was deleted, check if it was in a circular zone and re-apply layout
      if (isNode) {
        const circularZone = updatedData.zones?.find(zone => 
          zone.layoutType === 'circular' && zone.children.length > 0
        );
        if (circularZone) {
          updatedData = applyZoneLayout(circularZone.id, updatedData);
        }
      }
      
      return updatedData;
    });
    
    onItemSelect(null);
    toast({
      title: "Item Deleted",
      description: "The selected item has been deleted.",
    });
  }, [setDiagramData, onItemSelect, toast]);

  const handleDeleteMultiple = useCallback((itemIds: string[]) => {
    const idsToDelete = new Set(itemIds);
    
    setDiagramData(prev => {
      // Filter out nodes that are being deleted
      const remainingNodes = prev.nodes.filter(n => !idsToDelete.has(n.id));
      
      // Filter out zones that are being deleted
      const remainingZones = prev.zones?.filter(zone => !idsToDelete.has(zone.id));
      
      // Remove deleted items from zone children
      const updatedZones = remainingZones?.map(zone => ({
        ...zone,
        children: zone.children.filter(childId => !idsToDelete.has(childId))
      }));
      
      // Remove connections that involve deleted items
      const remainingConnections = prev.connections?.filter((e: any) => 
        !idsToDelete.has(e.from) && !idsToDelete.has(e.to)
      );
      
      const dataBeforeCleanup = {
        ...prev,
        nodes: remainingNodes,
        zones: updatedZones,
        connections: remainingConnections
      };
      
      // Clean up empty zones after deletion
      let finalData = cleanupEmptyZones(dataBeforeCleanup);
      
      // If items were deleted from circular zones, re-apply layout to those zones
      // Collect zones that need re-layout
      const zonesToRelayout = finalData.zones?.filter(zone => {
        if (zone.layoutType !== 'circular' || zone.children.length === 0) return false;
        // Check if any of the deleted items were in this zone
        const prevZone = prev.zones?.find(z => z.id === zone.id);
        if (!prevZone) return false;
        return prevZone.children.some(childId => idsToDelete.has(childId));
      }) || [];
      
      // Apply layout to all affected zones
      zonesToRelayout.forEach(zone => {
        finalData = applyZoneLayout(zone.id, finalData);
      });
      
      return finalData;
    });
    
    onItemSelect(null);
    toast({
      title: "Items Deleted",
      description: `${itemIds.length} items have been deleted.`,
    });
  }, [setDiagramData, onItemSelect, toast]);

  return {
    addNode,
    resizeNode,
    resizeGroup,
    updateGroupLabel,
    moveMultipleItems,
    moveItem,
    handleDelete,
    handleDeleteMultiple,
  };
}

