import { useState, useCallback } from "react";
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData, DiagramGroupData, DiagramGroupingData } from "@/lib/types";
import { generateSequentialId, generateGroupId } from "@/lib/id-generator";

interface ClipboardData {
  node?: DiagramNodeData;
  zone?: DiagramZoneData;
  children?: (DiagramNodeData | DiagramZoneData)[];
  // Multi-selection support
  nodes?: DiagramNodeData[];
  zones?: DiagramZoneData[];
  connections?: DiagramConnectionData[];
  // Track original group relationships for creating new groups on paste
  originalGroupRelationships?: Map<string, string>; // nodeId -> zoneId
  originalGroupingRelationships?: Map<string, string>; // nodeId -> groupingId
}

interface UseCanvasClipboardOptions {
  diagramData: DiagramData;
  selectedItemIds: Set<string>;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedItem: React.Dispatch<React.SetStateAction<any>>;
  onItemSelect: (item: any | null, shiftKey?: boolean) => void;
  onBatchSelect?: (itemIds: string[]) => void;
  onClipboardChange?: (hasClipboard: boolean) => void;
  toast: (options: { variant?: 'destructive' | 'default'; title: string; description: string }) => void;
}

export function useCanvasClipboard({
  diagramData,
  selectedItemIds,
  setDiagramData,
  setSelectedItemIds,
  setSelectedItem,
  onItemSelect,
  onBatchSelect,
  onClipboardChange,
  toast,
}: UseCanvasClipboardOptions) {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  const handleCopy = useCallback((itemId?: string) => {
    // If we have multiple items selected, copy all of them
    if (selectedItemIds && selectedItemIds.size > 0) {
      const selectedNodes: DiagramNodeData[] = [];
      const selectedZones: DiagramZoneData[] = [];
      const selectedConnections: DiagramConnectionData[] = [];
      const allSelectedIds = new Set(selectedItemIds);
      const originalGroupRelationships = new Map<string, string>();
      const originalGroupingRelationships = new Map<string, string>();

      // Collect selected nodes and groups
      selectedItemIds.forEach(id => {
        const node = diagramData.nodes.find(n => n.id === id);
        const zone = diagramData.zones?.find(zone => zone.id === id);
        
        if (node) {
          selectedNodes.push({ ...node });
          // Check if this node belongs to any zone
          const parentZone = diagramData.zones?.find(zone => zone.children?.includes(node.id));
          if (parentZone) {
            originalGroupRelationships.set(node.id, parentZone.id);
          }
          // Check if this node belongs to any grouping
          if (node.groupId) {
            originalGroupingRelationships.set(node.id, node.groupId);
          }
        } else if (zone) {
          // Recursively collect all children of selected groups
          const collectChildren = (groupId: string, visited: Set<string> = new Set()): (DiagramNodeData | DiagramGroupData)[] => {
            if (visited.has(groupId)) return [];
            visited.add(groupId);

            const children: (DiagramNodeData | DiagramGroupData)[] = [];
            const currentZone = diagramData.zones?.find(zone => zone.id === groupId);

            if (currentZone?.children) {
              for (const childId of currentZone.children) {
                const childNode = diagramData.nodes.find(n => n.id === childId);
                const childZone = diagramData.zones?.find(zone => zone.id === childId);

                if (childNode) {
                  children.push({ ...childNode });
                  allSelectedIds.add(childId);
                  // Track that this node belongs to this zone
                  originalGroupRelationships.set(childId, groupId);
                  // Track grouping relationships too
                  if (childNode.groupId) {
                    originalGroupingRelationships.set(childId, childNode.groupId);
                  }
                } else if (childZone) {
                  children.push({ ...childZone });
                  allSelectedIds.add(childId);
                  // Recursively collect children of child groups
                  children.push(...collectChildren(childId, visited));
                }
              }
            }

            return children;
          };

          selectedZones.push({ ...zone });
          const children = collectChildren(id);
          children.forEach(child => {
            if ('type' in child) {
              selectedNodes.push(child as DiagramNodeData);
            } else {
              selectedZones.push(child as DiagramGroupData);
            }
          });
        }
      });

      // Collect connections between selected items
      diagramData.connections?.forEach(connection => {
        if (allSelectedIds.has(connection.from) && allSelectedIds.has(connection.to)) {
          selectedConnections.push({ ...connection });
        }
      });

      setClipboard({
        nodes: selectedNodes,
        zones: selectedZones,
        connections: selectedConnections,
        originalGroupRelationships,
        originalGroupingRelationships
      });
      onClipboardChange?.(true);

      toast({
        title: "Items Copied",
        description: `${selectedNodes.length + selectedZones.length} items and ${selectedConnections.length} connections copied to clipboard.`,
      });
    } else if (itemId) {
      // Fallback to single item copy for backward compatibility
      const node = diagramData.nodes.find(n => n.id === itemId);
      const zone = diagramData.zones?.find(zone => zone.id === itemId);

      if (node) {
        setClipboard({ node: { ...node } });
        onClipboardChange?.(true);
      } else if (zone) {
        // Recursively collect all children
        const collectChildren = (groupId: string, visited: Set<string> = new Set()): (DiagramNodeData | DiagramGroupData)[] => {
          if (visited.has(groupId)) return [];
          visited.add(groupId);

          const children: (DiagramNodeData | DiagramGroupData)[] = [];
          const currentZone = diagramData.zones?.find(zone => zone.id === groupId);

          if (currentZone?.children) {
            for (const childId of currentZone.children) {
              const childNode = diagramData.nodes.find(n => n.id === childId);
              const childZone = diagramData.zones?.find(zone => zone.id === childId);

              if (childNode) {
                children.push({ ...childNode });
              } else if (childZone) {
                children.push({ ...childZone });
                // Recursively collect children of child groups
                children.push(...collectChildren(childId, visited));
              }
            }
          }

          return children;
        };

        const children = collectChildren(itemId);
        setClipboard({ zone: { ...zone }, children });
        onClipboardChange?.(true);
      }

      toast({
        title: "Item Copied",
        description: "The selected item has been copied to clipboard.",
      });
    }
  }, [selectedItemIds, diagramData, onClipboardChange, toast]);

  const handleToggleFreeflow = useCallback((itemId: string) => {
    const node = diagramData.nodes.find(n => n.id === itemId);
    if (node) {
      const newFreeflowState = !(node.freeflow || false);
      setDiagramData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => 
          n.id === itemId ? { ...n, freeflow: newFreeflowState } : n
        )
      }));

      // Update selected item if it's the one being toggled
      const selectedItem = diagramData.nodes.find(n => n.id === itemId);
      if (selectedItem) {
        onItemSelect({ ...selectedItem, itemType: 'node', freeflow: newFreeflowState });
      }

      toast({
        title: `Freeflow ${newFreeflowState ? 'Enabled' : 'Disabled'}`,
        description: `The node can ${newFreeflowState ? 'now' : 'no longer'} be placed anywhere without joining groups.`,
      });
    }
  }, [diagramData, setDiagramData, onItemSelect, toast]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;

    // Handle multi-selection paste
    if (clipboard.nodes || clipboard.zones) {
      const nodes = clipboard.nodes || [];
      const zones = clipboard.zones || [];
      const connections = clipboard.connections || [];
      
      // Create ID mapping for all items being pasted
      const idMapping = new Map<string, string>();

      // First pass: generate new IDs for all nodes
      const newNodes: DiagramNodeData[] = [];
      const tempGeneratedIds: string[] = []; // Track IDs generated in this paste operation
      
      nodes.forEach(node => {
        // Create temporary diagram data that includes already-generated IDs
        const tempData: DiagramData = {
          ...diagramData,
          nodes: [...diagramData.nodes, ...newNodes] // Include nodes we've already created
        };
        
        const newNodeId = generateSequentialId(node.type, tempData);
        idMapping.set(node.id, newNodeId);
        tempGeneratedIds.push(newNodeId);
        
        const newNode: DiagramNodeData = {
          ...node,
          id: newNodeId,
          x: (node.x || 0) + 50,
          y: (node.y || 0) + 50,
        };
        newNodes.push(newNode);
      });

      // Create new groups for nodes that had original group relationships
      const originalGroupRelationships = clipboard.originalGroupRelationships || new Map();
      const groupsToCreate = new Map<string, string[]>(); // groupId -> nodeIds
       
      // Group nodes by their original group
      originalGroupRelationships.forEach((groupId, nodeId) => {
        const newNodeId = idMapping.get(nodeId);
        if (newNodeId) {
          if (!groupsToCreate.has(groupId)) {
            groupsToCreate.set(groupId, []);
          }
          groupsToCreate.get(groupId)!.push(newNodeId);
        }
      });

      // Second pass: generate new IDs for all groups and process their children
      const newZones: DiagramZoneData[] = [];
      const processZoneChildren = (zone: DiagramGroupData): DiagramGroupData => {
        // Create temporary diagram data that includes already-generated IDs
        const tempData: DiagramData = {
          ...diagramData,
          nodes: [...diagramData.nodes, ...newNodes],
          zones: [...(diagramData.zones || []), ...newZones]
        };
        
        const newZoneId = generateGroupId((zone.subType as 'group' | 'zone') || 'zone', tempData);
        idMapping.set(zone.id, newZoneId);

        // Process children - map old IDs to new IDs
        const processedChildren: string[] = [];
        zone.children?.forEach(childId => {
          // Check if this child ID is in our mapping (means it's being copied)
          const mappedId = idMapping.get(childId);
          if (mappedId) {
            processedChildren.push(mappedId);
          } else {
            // Child is not in our selection, keep original ID
            processedChildren.push(childId);
          }
        });

        return {
          ...zone,
          id: newZoneId,
          x: (zone.x || 0) + 50,
          y: (zone.y || 0) + 50,
          children: processedChildren
        };
      };

      // Process all zones (including nested ones)
      zones.forEach(zone => {
        const newZone = processZoneChildren(zone);
        newZones.push(newZone);
      });

      // Create new groups for nodes that were originally grouped
      groupsToCreate.forEach((nodeIds, originalGroupId) => {
        // Find original group to copy its properties
        const originalGroup = diagramData.zones?.find(zone => zone.id === originalGroupId);
        if (originalGroup && nodeIds.length > 0) {
          // Create temporary diagram data for ID generation
          const tempData: DiagramData = {
            ...diagramData,
            nodes: [...diagramData.nodes, ...newNodes],
            zones: [...(diagramData.zones || []), ...newZones]
          };
          
          const newGroupId = generateGroupId((originalGroup.subType as 'group' | 'zone') || 'group', tempData);
          
          // Calculate position for new group (centered around its nodes)
          let minX = Infinity, minY = Infinity;
          nodeIds.forEach(nodeId => {
            const node = newNodes.find(n => n.id === nodeId);
            if (node) {
              minX = Math.min(minX, node.x || 0);
              minY = Math.min(minY, node.y || 0);
            }
          });
          
          const newGroup: DiagramZoneData = {
            ...originalGroup,
            id: newGroupId,
            x: minX - 20, // Position group to encompass its nodes
            y: minY - 20,
            children: nodeIds
          };
          
          newZones.push(newGroup);
        }
      });

      // Third pass: create new connections with updated IDs
      const newConnections: DiagramConnectionData[] = [];
      connections.forEach(connection => {
        const newFromId = idMapping.get(connection.from);
        const newToId = idMapping.get(connection.to);
        
        // Only create connection if both endpoints are being copied
        if (newFromId && newToId) {
          newConnections.push({
            ...connection,
            from: newFromId,
            to: newToId
          });
        }
      });

      // Create new groupings for nodes that had original grouping relationships
      const originalGroupingRelationships = clipboard.originalGroupingRelationships || new Map();
      const groupingsToCreate = new Map<string, string[]>(); // groupingId -> nodeIds
       
      // Group nodes by their original grouping
      originalGroupingRelationships.forEach((groupingId, nodeId) => {
        const newNodeId = idMapping.get(nodeId);
        if (newNodeId) {
          if (!groupingsToCreate.has(groupingId)) {
            groupingsToCreate.set(groupingId, []);
          }
          groupingsToCreate.get(groupingId)!.push(newNodeId);
        }
      });

      // Create new groupings
      const newGroupings: DiagramGroupingData[] = [];
      groupingsToCreate.forEach((nodeIds, originalGroupingId) => {
        // Find original grouping to copy its properties
        const originalGrouping = diagramData.groupings?.find(grouping => grouping.id === originalGroupingId);
        if (originalGrouping && nodeIds.length > 0) {
          // Generate new grouping ID
          const existingGroupingIds = (diagramData.groupings || []).map(g => g.id);
          const maxNumber = Math.max(0, ...existingGroupingIds
            .map(id => parseInt(id.replace('grouping-', '')) || 0)
          );
          const newGroupingId = `grouping-${maxNumber + 1}`;
          
          const newGrouping: DiagramGroupingData = {
            ...originalGrouping,
            id: newGroupingId,
            memberIds: nodeIds
          };
          
          newGroupings.push(newGrouping);
          
          // Update the copied nodes to reference the new grouping
          nodeIds.forEach(nodeId => {
            const node = newNodes.find(n => n.id === nodeId);
            if (node) {
              node.groupId = newGroupingId;
            }
          });
        }
      });

      // Collect IDs of all newly pasted items
      const pastedItemIds: string[] = [];
      newNodes.forEach(node => pastedItemIds.push(node.id));
      newZones.forEach(group => pastedItemIds.push(group.id));

      // Update diagram data
      setDiagramData(prev => ({
        ...prev,
        nodes: [...prev.nodes, ...newNodes],
        zones: [...(prev.zones || []), ...newZones],
        connections: [...(prev.connections || []), ...newConnections],
        groupings: [...(prev.groupings || []), ...newGroupings]
      }));

      // Clear old selection and set new selection to ONLY the pasted items
      // Do this synchronously with the state update to avoid race conditions
      if (pastedItemIds.length > 0) {
        // Set the selected item IDs to only the newly pasted items
        setSelectedItemIds(new Set(pastedItemIds));
        
        // Set the primary selected item to the first pasted item
        const firstPastedId = pastedItemIds[0];
        const firstPastedNode = newNodes.find(n => n.id === firstPastedId);
        const firstPastedZone = newZones.find(zone => zone.id === firstPastedId);
        
        if (firstPastedNode) {
          setSelectedItem({ ...firstPastedNode, itemType: 'node' });
        } else if (firstPastedZone) {
          setSelectedItem({ ...firstPastedZone, itemType: 'zone' });
        }
      }

      toast({
        title: "Items Pasted",
        description: `${newNodes.length + newZones.length} items and ${newConnections.length} connections pasted to canvas.`,
      });
    } else if (clipboard.node) {
      // Handle single node paste (backward compatibility)
      const originalGroupRelationships = clipboard.originalGroupRelationships || new Map();
      const originalGroupingRelationships = clipboard.originalGroupingRelationships || new Map();
      const newNode: DiagramNodeData = {
        ...clipboard.node,
        id: generateSequentialId(clipboard.node.type, diagramData),
        x: (clipboard.node.x || 0) + 50,
        y: (clipboard.node.y || 0) + 50,
      };

      const newZones: DiagramZoneData[] = [];
      const newGroupings: DiagramGroupingData[] = [];
      
      // Check if this node was originally in a zone and create a new zone
      const originalGroupId = originalGroupRelationships.get(clipboard.node.id);
      if (originalGroupId) {
        const originalGroup = diagramData.zones?.find(zone => zone.id === originalGroupId);
        if (originalGroup) {
          const newGroupId = generateGroupId((originalGroup.subType as 'group' | 'zone') || 'group', diagramData);
          
          const newGroup: DiagramZoneData = {
            ...originalGroup,
            id: newGroupId,
            x: (newNode.x || 0) - 20, // Position group to encompass the node
            y: (newNode.y || 0) - 20,
            children: [newNode.id]
          };
          
          newZones.push(newGroup);
        }
      }

      // Check if this node was originally in a grouping and create a new grouping
      const originalGroupingId = originalGroupingRelationships.get(clipboard.node.id);
      if (originalGroupingId) {
        const originalGrouping = diagramData.groupings?.find(grouping => grouping.id === originalGroupingId);
        if (originalGrouping) {
          // Generate new grouping ID
          const existingGroupingIds = (diagramData.groupings || []).map(g => g.id);
          const maxNumber = Math.max(0, ...existingGroupingIds
            .map(id => parseInt(id.replace('grouping-', '')) || 0)
          );
          const newGroupingId = `grouping-${maxNumber + 1}`;
          
          const newGrouping: DiagramGroupingData = {
            ...originalGrouping,
            id: newGroupingId,
            memberIds: [newNode.id]
          };
          
          newGroupings.push(newGrouping);
          
          // Update the node to reference the new grouping
          newNode.groupId = newGroupingId;
        }
      }

      setDiagramData(prev => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
        zones: [...(prev.zones || []), ...newZones],
        groupings: [...(prev.groupings || []), ...newGroupings]
      }));

      // Select the newly pasted item (or its group if one was created)
      if (newZones.length > 0) {
        onItemSelect({ ...newZones[0], itemType: 'zone' });
      } else {
        onItemSelect({ ...newNode, itemType: 'node' });
      }

      toast({
        title: "Item Pasted",
        description: "The copied item has been pasted to the canvas.",
      });
    } else if (clipboard.zone) {
      // Handle single group paste (backward compatibility)
      // Create ID mapping for all items being pasted
      const idMapping = new Map<string, string>();

      // Generate new ID for the main group
      const newZoneId = generateGroupId((clipboard.zone.subType as 'group' | 'zone') || 'group', diagramData);
      idMapping.set(clipboard.zone.id, newZoneId);

      // Generate new IDs for all children
      const children = clipboard.children || [];
      for (const child of children) {
        if ('type' in child && child.type) {
          // It's a node
          const nodeChild = child as DiagramNodeData;
          const newChildId = generateSequentialId(nodeChild.type, diagramData);
          idMapping.set(nodeChild.id, newChildId);
        } else {
          // It's a group
          const zoneChild = child as DiagramGroupData;
          const newChildId = generateGroupId((zoneChild.subType as 'group' | 'zone') || 'group', diagramData);
          idMapping.set(zoneChild.id, newChildId);
        }
      }

      // Create new group with updated children IDs
      const newZone: DiagramGroupData = {
        ...clipboard.zone,
        id: newZoneId,
        x: (clipboard.zone.x || 0) + 50,
        y: (clipboard.zone.y || 0) + 50,
        children: clipboard.zone.children?.map(childId => idMapping.get(childId) || childId) || []
      };

      // Create new children with updated IDs and positions
      const newNodes: DiagramNodeData[] = [];
      const newChildGroups: DiagramZoneData[] = [];

      for (const child of children) {
        const newChildId = idMapping.get(child.id)!;

        if ('type' in child && child.type) {
          // It's a node
          const nodeChild = child as DiagramNodeData;
          const newNode: DiagramNodeData = {
            ...nodeChild,
            id: newChildId,
            x: (nodeChild.x || 0) + 50,
            y: (nodeChild.y || 0) + 50,
          };
          newNodes.push(newNode);
        } else {
          // It's a group - update its children IDs as well
          const zoneChild = child as DiagramGroupData;
          const newChildGroup: DiagramGroupData = {
            ...zoneChild,
            id: newChildId,
            x: (zoneChild.x || 0) + 50,
            y: (zoneChild.y || 0) + 50,
            children: zoneChild.children?.map((childId: string) => idMapping.get(childId) || childId) || []
          };
          newChildGroups.push(newChildGroup);
        }
      }

      setDiagramData(prev => ({
        ...prev,
        nodes: [...prev.nodes, ...newNodes],
        zones: [...(prev.zones || []), newZone, ...newChildGroups]
      }));

      // Select the newly pasted group
      onItemSelect({ ...newZone, itemType: 'zone' });

      toast({
        title: "Item Pasted",
        description: "The copied item has been pasted to the canvas.",
      });
    }
  }, [clipboard, diagramData, setDiagramData, onItemSelect, toast]);

  const canPaste = useCallback(() => {
    return !!clipboard;
  }, [clipboard]);

  return {
    clipboard,
    handleCopy,
    handlePaste,
    handleToggleFreeflow,
    canPaste,
  };
}

