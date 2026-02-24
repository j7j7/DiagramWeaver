import { useCallback } from "react";
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramGroupData } from "@/lib/types";
import { ItemTypes } from "./draggable-item";
import { generateGroupId, generateSequentialId } from "@/lib/id-generator";
import { DEFAULT_THEMES } from "@/lib/theme-manager";
import { DEFAULT_TEXT_STYLING } from "@/lib/text-styling";
import {
  NODE_WIDTH, 
  NODE_HEIGHT,
  snapDimensionToGrid,
  ZONE_PADDING,
  snapToGrid, 
  measureNodeDims,
  type PositionedNode,
  type PositionedGroup,
} from "./canvas-constants";
import { isShapeNodeType, isIconOrEmojiType } from "@/lib/utils";
// Zones removed - no zone layout

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

  const addNode = useCallback((item: any, position: { x: number; y: number }, _targetGroupId: string | null) => {
    setDiagramData((prevData) => {
      const newNodes = prevData.nodes ? [...prevData.nodes] : [];
      let newItemId: string;

      // Use originalType if available (for shape preservation), otherwise use type
      const itemType = item.originalType || item.type || '';
      const itemLabel = item.label || '';
      
      // Check if this is a scratchpad item that already exists on canvas
      const isFromScratchPad = item.fromScratchPad || item.data?.fromScratchPad;
      const importId = item.importId || item.data?.importId;
      let existingNode = null;
      
      if (isFromScratchPad && importId) {
        existingNode = prevData.nodes.find(n => n.importId === importId);
      }
      
      // If item exists and is from scratchpad, create a copy with new ID
      if (existingNode) {
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
      // Exclude icon/emoji types - generic.icon.star is Lucide icon, not polygon shape
      const isShapeResource = !isIconOrEmojiType(itemType) && (itemType === 'generic.object.square' ||
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
                                itemType === 'generic.object.line' ||
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
                                itemType?.endsWith('.arrowhead') ||
                                itemType?.endsWith('.line'));
      
      // Check if this is a textbox resource
      const isTextboxResource = itemType === 'generic.text.textbox' || itemType?.endsWith('.textbox');
      
      if (!existingNode) {
        // For resource items from the sidebar, use type from drag item
        // NEVER store file in node - ResourceIcon looks up file from resource catalog
        // Special handling for shape resources - make them resizable
        const newNode: DiagramNodeData = {
          id: generateSequentialId(itemType, prevData),
          type: itemType,
          // Set label based on type - shapes get no default text (never use resource name like "Rectangle", "Circle")
          label: isShapeResource ? '' : itemLabel,
          // Don't set info/description for text and textbox resource types, or shapes
          ...(itemType !== 'generic.text.text' && itemType !== 'generic.text.textbox' && !isShapeResource && {
            info: item.provider ? `${itemLabel} from ${item.provider}` : `A new ${itemLabel}`
          }),
          sizeMode: (isShapeResource || isTextboxResource) ? 'custom' : undefined, // Shapes and textboxes use custom sizing
           width: isShapeResource ? snapDimensionToGrid(
             itemType === 'generic.object.point' ? 20 :
             itemType === 'generic.object.rectangle' ? 80 :
             itemType === 'generic.object.rounded-rectangle' ? 80 :
             itemType === 'generic.object.cloud' ? 80 :
             itemType === 'generic.object.line' ? 150 :
             60
           ) : isTextboxResource ? snapDimensionToGrid(120, 40) : undefined, // Initial width - larger for textbox
           height: isShapeResource ? snapDimensionToGrid(
             itemType === 'generic.object.point' ? 20 :
             itemType === 'generic.object.rectangle' ? 50 :
             itemType === 'generic.object.rounded-rectangle' ? 50 :
             itemType === 'generic.object.cloud' ? 50 :
             itemType === 'generic.object.line' ? 100 :
             60
           ) : isTextboxResource ? snapDimensionToGrid(80, 40) : undefined, // Initial height - larger for textbox
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
          // Special defaults for line shape (only if not from scratchpad)
          ...(itemType === 'generic.object.line' && !isFromScratchPad && {
            startPos: { x: position.x, y: position.y },
            endPos: { x: position.x + 150, y: position.y },
            // Set x/y to min of startPos/endPos for consistency with how line nodes are positioned
            x: position.x, // min of startPos.x and endPos.x
            y: position.y, // min of startPos.y and endPos.y
            startCap: 'none',
            endCap: 'none',
            lineThickness: 2.5,
            lineColor: '#6b7280',
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
      
      // Flat diagram: all nodes at top level
      const addedItemForPos = newNodes.find(n => n.id === newItemId);
      if (addedItemForPos) {
        (addedItemForPos as any).x = snapToGrid(position.x);
        (addedItemForPos as any).y = snapToGrid(position.y);
      }

      return { ...prevData, nodes: newNodes };
    });
  }, [setDiagramData]);

  const resizeNode = useCallback((nodeId: string, newWidth: number, newHeight: number) => {
    setDiagramData(prevData => {
      const updatedNodes = prevData.nodes?.map(node => {
        if (node.id === nodeId) {
          const isShapeNode = isShapeNodeType(node.type);
          const isTextboxNode = node.type === 'generic.text.textbox';
          const isTextNode = node.type === 'generic.text.text';
          const isIconNode = !isShapeNode && !isTextboxNode && !isTextNode && node.type !== 'generic.object.line' && !node.type?.endsWith?.('.line');

          if (isIconNode) {
            const minLabelWidth = 80;
            const labelWidth = snapDimensionToGrid(Math.max(minLabelWidth, newWidth), minLabelWidth);
            return { ...node, labelWidth };
          }

          let minWidth = 80;
          let minHeight = 40;
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
          const isKiteNode = node.type === 'generic.object.kite' || node.type?.endsWith?.('.kite');
          let finalWidth = snapDimensionToGrid(Math.max(minWidth, newWidth), minWidth);
          let finalHeight = snapDimensionToGrid(Math.max(minHeight, newHeight), minHeight);
          if (isKiteNode) {
            const size = Math.max(finalWidth, finalHeight);
            finalWidth = size;
            finalHeight = size;
          }
          return {
            ...node,
            width: finalWidth,
            height: finalHeight,
            sizeMode: 'custom' as const
          };
        }
        return node;
      }) || [];
      
      return { ...prevData, nodes: updatedNodes };
    });
  }, [setDiagramData]);

  const resizeMultipleNodes = useCallback((nodeIds: string[], scaleX: number, scaleY: number, originalDimensions?: Map<string, { width: number; height: number }>) => {
    setDiagramData(prevData => {
      const updatedNodes = prevData.nodes?.map(node => {
        if (nodeIds.includes(node.id)) {
          // Use original dimensions from ref if provided, otherwise use current dimensions
          const originalDims = originalDimensions?.get(node.id);
          const originalWidth = originalDims?.width ?? (node.width || 80);
          const originalHeight = originalDims?.height ?? (node.height || 80);
          const currentWidth = originalWidth;
          const currentHeight = originalHeight;
          
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
                             !isIconOrEmojiType(node.type) && (node.type?.endsWith('.square') ||
                             node.type?.endsWith('.circle') ||
                             node.type?.endsWith('.point') ||
                             node.type?.endsWith('.rectangle') ||
                             node.type?.endsWith('.rounded-rectangle') ||
                             node.type?.endsWith('.triangle') ||
                             node.type?.endsWith('.star') ||
                             node.type?.endsWith('.cloud') ||
                             node.type?.endsWith('.chevron'));
          
          if (node.type === 'generic.text.textbox') {
            minWidth = 40;
            minHeight = 40;
          } else if (isShapeNode) {
            minWidth = 20;
            minHeight = 20;
          }
          
          let newWidth = snapDimensionToGrid(currentWidth * scaleX, minWidth);
          let newHeight = snapDimensionToGrid(currentHeight * scaleY, minHeight);
          const isKiteNode = node.type === 'generic.object.kite' || node.type?.endsWith?.('.kite');
          if (isKiteNode) {
            const size = Math.max(newWidth, newHeight);
            newWidth = size;
            newHeight = size;
          }
          return {
            ...node,
            width: newWidth,
            height: newHeight,
            sizeMode: 'custom' as const
          };
        }
        return node;
      }) || [];
      
      return { ...prevData, nodes: updatedNodes };
    });
  }, [setDiagramData]);

  const resizeMultipleGroups = useCallback((_groupIds: string[], _scaleX: number, _scaleY: number, _originalDimensions?: Map<string, { width: number; height: number }>) => {
    // Zones removed - no-op
  }, []);

  const resizeGroup = useCallback((_groupId: string, _newWidth: number, _newHeight: number) => {
    // Zones removed - no-op
  }, []);

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

  const updateGroupTag = useCallback((groupId: string, newTag: string) => {
    setDiagramData(prevData => {
      const updatedZones = prevData.zones?.map(zone => {
        if (zone.id === groupId) {
          return {
            ...zone,
            tag: newTag
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
        const node = currentNodes.find(n => n.id === item.id);
        const isFreeflowNode = true; // All nodes use free placement

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
            currentNodes = currentNodes.map(n => {
              if (n.id === item.id) {
                // Special handling for line shapes - move both endpoints
                if (n.type === 'generic.object.line' || n.type?.endsWith('.line')) {
                  const currentStartPos = (n as any).startPos || { x: n.x || 0, y: (n.y || 0) + 50 };
                  const currentEndPos = (n as any).endPos || { x: (n.x || 0) + 150, y: (n.y || 0) + 50 };
                  const deltaX = snappedX - (n.x || 0);
                  const deltaY = snappedY - (n.y || 0);
                  
                  return {
                    ...n,
                    x: snappedX,
                    y: snappedY,
                    startPos: { x: currentStartPos.x + deltaX, y: currentStartPos.y + deltaY },
                    endPos: { x: currentEndPos.x + deltaX, y: currentEndPos.y + deltaY }
                  };
                }
                return { ...n, x: snappedX, y: snappedY };
              }
              return n;
            });
          } else { 
            currentZones = currentZones.map(zone => zone.id === item.id ? { ...zone, x: snappedX, y: snappedY } : zone);
          }
        }
      });

      return { ...prevData, nodes: currentNodes };
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

      const isFreeflowNode = true; // All nodes use free placement

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
        const isFreeflowNode = true; // All nodes use free placement

        // All nodes maintain their coordinates (free placement within grid)
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

          // Overlap allowed - all nodes use free placement within grid
          if (false && isOverlapAt(snappedX, snappedY)) {
            // Abort move if overlapping; user must choose a free grid cell
            return prevData;
          }

          const draggedItemData = processedNodes.find(n => n.id === item.id) || processedZones.find(zone => zone.id === item.id);
          const originalX = draggedItemData?.x ?? 0;
          const originalY = draggedItemData?.y ?? 0;
          const dx = snappedX - originalX;
          const dy = snappedY - originalY;

          if (movingIsZone) {
            // Update the zone's position
            currentZones = currentZones.map(zone => {
              if (zone.id === item.id) return { ...zone, x: snappedX, y: snappedY };
              return zone;
            });
            // DO NOT update child node/zone positions here - they have relative positions
            // that will be correctly converted to absolute during layout recalculation
            // The layout system will handle converting relative positions to absolute
            // based on the zone's new position
           } else {
             currentNodes = currentNodes.map(n => {
               if (n.id === item.id) {
                 // Special handling for line shapes - move both endpoints
                 if (n.type === 'generic.object.line' || n.type?.endsWith('.line')) {
                   const currentStartPos = (n as any).startPos || { x: n.x || 0, y: n.y || 0 };
                   const currentEndPos = (n as any).endPos || { x: (n.x || 0) + 150, y: n.y || 0 };
                   const deltaX = snappedX - originalX;
                   const deltaY = snappedY - originalY;
                   
                   return {
                     ...n,
                     x: snappedX,
                     y: snappedY,
                     startPos: { x: currentStartPos.x + deltaX, y: currentStartPos.y + deltaY },
                     endPos: { x: currentEndPos.x + deltaX, y: currentEndPos.y + deltaY }
                   };
                 }
                 return { ...n, x: snappedX, y: snappedY };
               }
               return n;
             });
           }
         }
       }
        
        return { ...prevData, nodes: currentNodes };
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
          zones: (prev.zones ?? []).map(zone => ({
            ...zone,
            children: zone.children.filter((n: string) => n !== itemId)
          }))
        };
      } else {
        updatedData = {
          ...prev,
          zones: (prev.zones ?? []).filter(zone => zone.id !== itemId)
        };
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
      
      return dataBeforeCleanup;
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
    resizeMultipleNodes,
    resizeMultipleGroups,
    updateGroupLabel,
    updateGroupTag,
    moveMultipleItems,
    moveItem,
    handleDelete,
    handleDeleteMultiple,
  };
}

