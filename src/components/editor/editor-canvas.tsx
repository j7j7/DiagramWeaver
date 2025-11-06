"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useDrop } from 'react-dnd';
import { DiagramNode } from "../diagram/diagram-node";

import { BezierConnection, BezierConnectionText } from "../diagram/bezier-connection";
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


const NODE_WIDTH = 80;
const NODE_HEIGHT = 80;
const TEXT_NODE_HEIGHT = 40;
const EXTRA_LINE_HEIGHT = 20;
const GROUP_PADDING = 50; // Increased by 25% (was 40)
const GROUP_NODE_SPACING = 30;
const GRID_SNAP = 20;

interface EditorCanvasProps {
  diagramData: DiagramData;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  onItemSelect: (item: SelectedItem | null, shiftKey?: boolean) => void;
  selectedItemId?: string;
  isConnectMode: boolean;
  onNodeClickInConnectMode: (node: DiagramNodeData) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  externalTransform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
  onLabelUpdate?: (nodeId: string, newLabel: string) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  onClipboardChange?: (hasClipboard: boolean) => void;
}

type PositionedNode = DiagramNodeData & { x: number; y: number; };
type PositionedGroup = DiagramGroupData & { x: number; y: number; width: number; height: number; };

const measureNodeDims = (n: PositionedNode) => {
  const isText = n.type === 'generic.text.text' || n.type === 'generic.text.label';
  const isTextboxNode = n.type === 'generic.text.textbox';
  const isLabelboxNode = n.type === 'generic.text.labelbox';
  const isShapeNode =
    n.type === 'generic.text.square' ||
    n.type === 'generic.text.circle' ||
    n.type === 'generic.text.rectangle' ||
    n.type === 'generic.text.triangle' ||
    n.type === 'generic.text.star' ||
    n.type === 'generic.text.cloud';
  const label = (n.label || '').toString();

  // Use custom dimensions if sizeMode is 'custom' and dimensions are provided
  if ((isTextboxNode || isLabelboxNode || isShapeNode) && n.sizeMode === 'custom' && n.width && n.height) {
    return { width: n.width, height: n.height };
  }
  
  // Shapes always use their custom width/height if set
  if (isShapeNode && n.width && n.height) {
    return { width: n.width, height: n.height };
  }

  if (isTextboxNode) {
    const avgCharWidth = 8;
    const padding = 32;
    const minWidth = 200;
    const maxWidth = 400;
    const minHeight = 120;

    const words = label.split(' ');
    const maxCharsPerLine = 30;
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    const maxLineLength = Math.max(...lines.map(line => line.length), 1);
    const calculatedWidth = Math.max(
      minWidth,
      Math.min(maxWidth, maxLineLength * avgCharWidth + padding),
    );

    const textLines = Math.max(3, Math.ceil(label.length / maxCharsPerLine));
    const height = minHeight + (textLines - 3) * EXTRA_LINE_HEIGHT;

    return { width: calculatedWidth, height };
  } else if (isLabelboxNode) {
    const avgCharWidth = 8;
    const padding = 24;
    const minWidth = 160;
    const maxWidth = 300;
    const minHeight = 100;

    const words = label.split(' ');
    const maxCharsPerLine = 25;
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    const maxLineLength = Math.max(...lines.map(line => line.length), 1);
    const calculatedWidth = Math.max(
      minWidth,
      Math.min(maxWidth, maxLineLength * avgCharWidth + padding),
    );

    const textLines = Math.max(2, Math.ceil(label.length / maxCharsPerLine));
    const height = minHeight + (textLines - 2) * EXTRA_LINE_HEIGHT;

    return { width: calculatedWidth, height };
  } else if (isText || isShapeNode) {
    const avgCharWidth = 8;

    let calculatedWidth: number;
    let height: number;

    if (isText) {
      const padding = 16;
      const minTextWidth = 80;
      const maxTextWidth = 200;

      const words = label.split(' ');
      const textMaxCharsPerLine = 20;
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= textMaxCharsPerLine) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);

      const maxLineLength = Math.max(...lines.map(line => line.length), 1);
      calculatedWidth = Math.max(
        minTextWidth,
        Math.min(maxTextWidth, maxLineLength * avgCharWidth + padding),
      );

      // Check if it's a label node - use exact text height, no padding
      if (n.type === 'generic.text.label') {
        const textLines = Math.max(1, Math.ceil(label.length / textMaxCharsPerLine));
        const lineHeight = 20; // Approximate line height for text-sm font-medium
        height = textLines * lineHeight;
      } else {
        const textLines = Math.max(1, Math.ceil(label.length / textMaxCharsPerLine));
        height = TEXT_NODE_HEIGHT + (textLines - 1) * EXTRA_LINE_HEIGHT;
      }
    } else {
      const shapeSize = 48;
      const textPadding = 16;
      const textPosition = (n as any).textPosition || 'under';

      if (textPosition === 'center' && label) {
        calculatedWidth = shapeSize;
      } else if (textPosition === 'above' || textPosition === 'under') {
        const textWidth = Math.min(120, Math.max(40, label.length * avgCharWidth + textPadding));
        calculatedWidth = Math.max(shapeSize, textWidth);
      } else {
        calculatedWidth = Math.max(shapeSize, 80);
      }

      const maxCharsPerLine = 12;
      const shapeLines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
      height = NODE_HEIGHT + (shapeLines - 1) * EXTRA_LINE_HEIGHT;
    }

    return { width: calculatedWidth, height };
  } else {
    return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }
};

export type EditorCanvasHandle = {
  fitToView: () => void;
  exportPng: () => Promise<void>;
  copy: () => void;
  paste: () => void;
  canPaste: () => boolean;
};

export const EditorCanvas = React.forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { diagramData, setDiagramData, onItemSelect, selectedItemId, isConnectMode, onNodeClickInConnectMode, onConnect, onDisconnect, externalTransform, onTransformChange, onLabelUpdate, onDraggingChange, onClipboardChange }: EditorCanvasProps,
  ref
) {
  const [internalTransform, setInternalTransform] = useState({ x: 0, y: 0, k: 1 });
  const transform = externalTransform || internalTransform;
  const setTransform = (newTransform: { x: number; y: number; k: number }) => {
    if (onTransformChange) {
      onTransformChange(newTransform);
    } else {
      setInternalTransform(newTransform);
    }
  };
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
    children?: (DiagramNodeData | DiagramGroupData)[];
  } | null>(null);

  const { processedNodes, processedGroups, width, height } = useMemo(() => {
    const nodes: DiagramNodeData[] = JSON.parse(JSON.stringify(diagramData.nodes || []));
    const groups: DiagramGroupData[] = JSON.parse(JSON.stringify(diagramData.groups || []));
    
    const allItems: { [id: string]: DiagramNodeData | DiagramGroupData | PositionedNode | PositionedGroup } = {};
    nodes.forEach(item => allItems[item.id] = item);
    groups.forEach(item => allItems[item.id] = item);
    
    // Helper function to redistribute items within a custom-sized group
    const redistributeItemsInCustomGroup = (group: DiagramGroupData, childNodes: DiagramNodeData[], childGroups: DiagramGroupData[]) => {
        if (!group.width || !group.height) return;

        // Cache node measurements so dynamic text nodes are consistent within this pass
        const nodeDimsCache = new Map<string, { width: number; height: number }>();
        const getNodeDims = (node: DiagramNodeData) => {
            if (!nodeDimsCache.has(node.id)) {
                nodeDimsCache.set(node.id, measureNodeDims(node as PositionedNode));
            }
            return nodeDimsCache.get(node.id)!;
        };
        const getChildDims = (child: DiagramNodeData | DiagramGroupData) => {
            if ((child as DiagramGroupData).type === 'group') {
                return {
                    width: (child as PositionedGroup).width || 300,
                    height: (child as PositionedGroup).height || 220,
                };
            }
            return getNodeDims(child as DiagramNodeData);
        };

        // Separate edge-positioned nodes from regular nodes
        const regularNodes = childNodes.filter(n => !n.edgePosition);
        const edgeNodes = childNodes.filter(n => n.edgePosition);

        // All regular children (nodes and groups)
        const regularChildren = [...regularNodes, ...childGroups];

        if (regularChildren.length > 0) {
            const childLayouts = regularChildren.map(child => ({ child, dims: getChildDims(child) }));
            const availableWidth = Math.max(0, group.width - (GROUP_PADDING * 2));
            const widestChildWidth = Math.max(...childLayouts.map(({ dims }) => dims.width), NODE_WIDTH);
            const widthPerItem = widestChildWidth + GROUP_NODE_SPACING;
            const widthBasedLimit = Math.max(1, Math.floor(availableWidth / Math.max(widthPerItem, 1))); // Ensure at least one per row

            // Determine items per row based on available space and orientation
            let itemsPerRow: number;
            if (group.orientation === 'vertical') {
                itemsPerRow = 1;
            } else if (group.orientation === 'horizontal') {
                itemsPerRow = group.maxItemsPerRow || widthBasedLimit;
            } else {
                const approxSquare = Math.max(1, Math.floor(Math.sqrt(childLayouts.length) * 1.2));
                itemsPerRow = group.maxItemsPerRow || Math.min(approxSquare, widthBasedLimit);
            }

            itemsPerRow = Math.max(1, Math.min(itemsPerRow, childLayouts.length));

            // Use the same centering logic as the main layout function
            let currentY = GROUP_PADDING;
            let rowMaxHeight = 0;
            const rows: Array<{ children: any[], rowWidth: number, rowHeight: number }> = [];
            let currentRow: any[] = [];

            // First pass: organize children into rows and calculate row dimensions
            childLayouts.forEach(({ child, dims }, index) => {
                currentRow.push({ child, width: dims.width, height: dims.height });
                rowMaxHeight = Math.max(rowMaxHeight, dims.height);
                
                // End of row
                if (index === childLayouts.length - 1 || (index + 1) % itemsPerRow === 0) {
                    const rowWidth = currentRow.reduce((sum, item) => sum + item.width + GROUP_NODE_SPACING, 0) - GROUP_NODE_SPACING;
                    rows.push({
                        children: currentRow,
                        rowWidth: rowWidth,
                        rowHeight: rowMaxHeight
                    });
                    currentRow = [];
                    rowMaxHeight = 0;
                }
            });

            // Second pass: position children with centering within the custom-sized group
            rows.forEach((row, rowIndex) => {
                // Calculate horizontal offset to center the row within the group
                const horizontalOffset = GROUP_PADDING + ((group.width || 0) - GROUP_PADDING * 2 - row.rowWidth) / 2;
                
                row.children.forEach((item, itemIndex) => {
                    item.child.x = horizontalOffset + (itemIndex > 0 ? 
                        row.children.slice(0, itemIndex).reduce((sum, prevItem) => sum + prevItem.width + GROUP_NODE_SPACING, 0) : 0);
                    item.child.y = currentY;
                });
                
                currentY += row.rowHeight + GROUP_NODE_SPACING;
            });

            // Apply vertical centering for all rows within the custom-sized group
            const totalContentHeight = currentY - GROUP_NODE_SPACING;
            const verticalOffset = GROUP_PADDING + ((group.height || 0) - GROUP_PADDING * 2 - totalContentHeight) / 2;
            
            // Reposition all children with vertical offset
            rows.forEach((row) => {
                row.children.forEach((item) => {
                    item.child.y += verticalOffset - GROUP_PADDING;
                });
            });
        }

        // Position edge nodes on the boundaries
        if (edgeNodes.length > 0) {
            const nodesByEdge = {
                top: edgeNodes.filter(n => n.edgePosition === 'top'),
                bottom: edgeNodes.filter(n => n.edgePosition === 'bottom'),
                left: edgeNodes.filter(n => n.edgePosition === 'left'),
                right: edgeNodes.filter(n => n.edgePosition === 'right'),
            };

            Object.entries(nodesByEdge).forEach(([edge, nodes]) => {
                if (nodes.length === 0) return;

                nodes.forEach((node, index) => {
                    const dims = getNodeDims(node);

                    switch (edge) {
                        case 'top': {
                            const segmentWidth = group.width! / nodes.length;
                            const centerX = segmentWidth * index + segmentWidth / 2;
                            node.x = centerX - dims.width / 2;
                            node.y = -dims.height / 2 + dims.height * 0.1;
                            break;
                        }
                        case 'bottom': {
                            const segmentWidth = group.width! / nodes.length;
                            const centerX = segmentWidth * index + segmentWidth / 2;
                            node.x = centerX - dims.width / 2;
                            node.y = group.height! - dims.height / 2 + dims.height * 0.1;
                            break;
                        }
                        case 'left': {
                            const segmentHeight = group.height! / nodes.length;
                            const centerY = segmentHeight * index + segmentHeight / 2;
                            node.x = -dims.width / 2;
                            node.y = centerY - dims.height / 2;
                            break;
                        }
                        case 'right': {
                            const segmentHeight = group.height! / nodes.length;
                            const centerY = segmentHeight * index + segmentHeight / 2;
                            node.x = group.width! - dims.width / 2;
                            node.y = centerY - dims.height / 2;
                            break;
                        }
                    }
                });
            });
        }
    };
    
    const layoutGroup = (group: DiagramGroupData): { width: number, height: number } => {
        // If group has custom sizing, use those dimensions and redistribute content within
        if (group.sizeMode === 'custom' && group.width && group.height) {
            const childNodes = group.children
                .map((id: string) => allItems[id])
                .filter(Boolean)
                .filter((c: any) => !c.type || c.type !== 'group') as DiagramNodeData[];
            
            const childGroups = group.children
                .map((id: string) => allItems[id])
                .filter(Boolean)
                .filter((c: any) => c.type === 'group') as DiagramGroupData[];
                
            // Layout child groups first
            childGroups.forEach(cg => {
                const dims = layoutGroup(cg);
                (cg as any).width = dims.width;
                (cg as any).height = dims.height;
            });
            
            // Redistribute items within the custom size
            redistributeItemsInCustomGroup(group, childNodes, childGroups);
            
            return { width: group.width, height: group.height };
        }
        
        // Auto-sizing logic (only for non-custom groups)
        
        // Auto-sizing logic (existing)
        const childNodes = group.children
            .map((id: string) => allItems[id])
            .filter(Boolean)
            .filter((c: any) => !c.type || c.type !== 'group') as DiagramNodeData[];
        
        const childGroups = group.children
            .map((id: string) => allItems[id])
            .filter(Boolean)
            .filter((c: any) => c.type === 'group') as DiagramGroupData[];

        // Separate edge-positioned nodes from regular nodes
        const regularNodes = childNodes.filter(n => !n.edgePosition);
        const edgeNodes = childNodes.filter(n => n.edgePosition);

        let contentWidth = 0;
        let contentHeight = 0;

        // Layout child groups first and get their dimensions (mutate originals so positions persist)
        const laidOutChildGroups = childGroups.map(cg => {
            const dims = layoutGroup(cg);
            (cg as any).width = dims.width;
            (cg as any).height = dims.height;
            return cg; // IMPORTANT: return original reference so x/y set below apply to allItems
        });

        // Grid layout for regular children (nodes and groups) with orientation and maxItemsPerRow support
        // Edge-positioned nodes are handled separately
        const allChildren = [...regularNodes, ...laidOutChildGroups];
        const numItems = allChildren.length;
        
        // Determine items per row based on orientation and maxItemsPerRow
        let itemsPerRow: number;
        if (group.orientation === 'vertical') {
            // Vertical orientation: single column, but respect maxItemsPerRow for column height
            itemsPerRow = 1;
        } else if (group.orientation === 'horizontal') {
            // Horizontal orientation: use a reasonable default to create multiple rows but maintain width
            itemsPerRow = group.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
        } else {
            // Square orientation: use maxItemsPerRow if specified, otherwise calculate
            itemsPerRow = group.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
        }
        
        // For groups with no regular children, ensure minimum size to accommodate content
        // Consider edge nodes when determining if group is truly empty
        if (numItems === 0) {
            // Calculate maximum dimensions among all nodes (including edge nodes) for proper group sizing
            const allNodesInGroup = [...regularNodes, ...edgeNodes];
            const maxNodeWidth = allNodesInGroup.length > 0 
                ? Math.max(...allNodesInGroup.map(n => measureNodeDims(n as PositionedNode).width))
                : NODE_WIDTH;
            const maxNodeHeight = allNodesInGroup.length > 0 
                ? Math.max(...allNodesInGroup.map(n => measureNodeDims(n as PositionedNode).height))
                : NODE_HEIGHT;
            
            let minGroupWidth = maxNodeWidth + (GROUP_PADDING * 2);
            let minGroupHeight = maxNodeHeight + (GROUP_PADDING * 2);
            
            // If we have edge nodes but no regular nodes, ensure adequate space for edge positioning
            if (edgeNodes.length > 0) {
                // Use orientation-specific minimum dimensions for edge nodes
                if (group.orientation === 'vertical') {
                    // Vertical: need enough width for edge nodes, but keep it tall and thin
                    minGroupWidth = Math.max(minGroupWidth, maxNodeWidth + GROUP_PADDING * 1.5);
                    minGroupHeight = Math.max(minGroupHeight, maxNodeHeight * 3 + GROUP_PADDING * 2);
                } else if (group.orientation === 'horizontal') {
                    // Horizontal: need enough height for edge nodes, but keep it wide and short
                    minGroupWidth = Math.max(minGroupWidth, maxNodeWidth * 3 + GROUP_PADDING * 2);
                    minGroupHeight = Math.max(minGroupHeight, maxNodeHeight + GROUP_PADDING * 1.5);
                } else {
                    // Square: use balanced dimensions
                    minGroupWidth = Math.max(minGroupWidth, maxNodeWidth * 2 + GROUP_PADDING * 2);
                    minGroupHeight = Math.max(minGroupHeight, maxNodeHeight * 2 + GROUP_PADDING * 2);
                }
            }
            
            (group as PositionedGroup).width = minGroupWidth;
            (group as PositionedGroup).height = minGroupHeight;
            
            // Position edge nodes even when there are no regular children
            // Group nodes by edge position for even distribution
            const nodesByEdge = {
                top: edgeNodes.filter(n => n.edgePosition === 'top'),
                bottom: edgeNodes.filter(n => n.edgePosition === 'bottom'),
                left: edgeNodes.filter(n => n.edgePosition === 'left'),
                right: edgeNodes.filter(n => n.edgePosition === 'right')
            };
            
            // Position nodes evenly along each edge
            Object.entries(nodesByEdge).forEach(([edge, nodes]) => {
                if (nodes.length === 0) return;
                
                // Use actual node dimensions for edge positioning
                const nodeWidth = nodes.length > 0 ? measureNodeDims(nodes[0] as PositionedNode).width : NODE_WIDTH;
                const nodeHeight = nodes.length > 0 ? measureNodeDims(nodes[0] as PositionedNode).height : NODE_HEIGHT;
                
                nodes.forEach((node, index) => {
                    switch (edge) {
                        case 'top':
                        case 'bottom':
                        // Distribute horizontally along top/bottom edges
                        if (nodes.length === 1) {
                            node.x = (minGroupWidth - nodeWidth) / 2;
                        } else {
                            const spacing = minGroupWidth / (nodes.length + 1);
                            node.x = spacing * (index + 1) - (nodeWidth / 2);
                        }
                            node.y = edge === 'top' 
                                ? -nodeHeight / 2 + nodeHeight * 0.1
                                : minGroupHeight - nodeHeight / 2 + nodeHeight * 0.1;
                            break;
                            
                        case 'left':
                        case 'right':
                            // Distribute vertically along left/right edges
                            node.x = edge === 'left'
                                ? -nodeWidth / 2
                                : minGroupWidth - nodeWidth / 2;
                            if (nodes.length === 1) {
                                node.y = (minGroupHeight - nodeHeight) / 2;
                            } else {
                                const spacing = minGroupHeight / (nodes.length + 1);
                                node.y = spacing * (index + 1) - (nodeHeight / 2);
                            }
                            break;
                    }
                });
            });
            
            return { width: minGroupWidth, height: minGroupHeight };
        }
        
        let currentY = GROUP_PADDING;
        let rowMaxHeight = 0;
        const rows: Array<{ children: any[], rowWidth: number, rowHeight: number }> = [];
        let currentRow: any[] = [];

        // First pass: organize children into rows and calculate row dimensions
        allChildren.forEach((child, index) => {
            // Use different dimension calculation for groups vs nodes
            let childWidth: number;
            let childHeight: number;
            
            if ((child as any).type === 'group') {
                // For groups, use their calculated width and height from the recursive layout call
                childWidth = (child as any).width || 300;
                childHeight = (child as any).height || 220;
            } else {
                // For nodes, use the measureNodeDims function
                const childDims = measureNodeDims(child as PositionedNode);
                childWidth = childDims.width;
                childHeight = childDims.height;
            }
            
            currentRow.push({ child, width: childWidth, height: childHeight });
            rowMaxHeight = Math.max(rowMaxHeight, childHeight);
            
            // End of row
            if (index === allChildren.length - 1 || (index + 1) % itemsPerRow === 0) {
                const rowWidth = currentRow.reduce((sum, item) => sum + item.width + GROUP_NODE_SPACING, 0) - GROUP_NODE_SPACING;
                rows.push({
                    children: currentRow,
                    rowWidth: rowWidth,
                    rowHeight: rowMaxHeight
                });
                currentRow = [];
                rowMaxHeight = 0;
            }
        });

        // Calculate total content width for auto-sized groups
        let calculatedContentWidth: number;
        if (group.orientation === 'horizontal') {
            // For horizontal orientation, calculate width based on itemsPerRow to maintain consistent width
            // Get the dimensions of the first few items to estimate width
            const sampleItems = allChildren.slice(0, Math.min(itemsPerRow, allChildren.length));
            const estimatedWidth = sampleItems.reduce((sum, child) => {
                let childWidth: number;
                if ((child as any).type === 'group') {
                    childWidth = (child as any).width || 300;
                } else {
                    const childDims = measureNodeDims(child as PositionedNode);
                    childWidth = childDims.width;
                }
                return sum + childWidth + GROUP_NODE_SPACING;
            }, 0) - GROUP_NODE_SPACING;
            calculatedContentWidth = estimatedWidth;
        } else {
            // For other orientations, use the maximum row width
            calculatedContentWidth = Math.max(...rows.map(row => row.rowWidth), 0);
        }

        // Determine the actual group width to use for layout
        // Use reduced padding for both vertical and horizontal orientations to make them tighter
        const horizontalPadding = group.orientation === 'vertical' ? GROUP_PADDING * 0.5 : 
                                 group.orientation === 'horizontal' ? GROUP_PADDING * 0.5 : 
                                 GROUP_PADDING;
        const actualGroupWidth = group.sizeMode === 'custom' && group.width ? 
                               group.width : 
                               calculatedContentWidth + horizontalPadding * 2;

        // Second pass: position children with centering
        rows.forEach((row, rowIndex) => {
            // Calculate horizontal offset to center the row within the group
            const horizontalOffset = horizontalPadding + (actualGroupWidth - horizontalPadding * 2 - row.rowWidth) / 2;
            
            row.children.forEach((item, itemIndex) => {
                item.child.x = horizontalOffset + (itemIndex > 0 ? 
                    row.children.slice(0, itemIndex).reduce((sum, prevItem) => sum + prevItem.width + GROUP_NODE_SPACING, 0) : 0);
                item.child.y = currentY;
            });
            
            currentY += row.rowHeight + GROUP_NODE_SPACING;
        });

        contentHeight = currentY - GROUP_NODE_SPACING;
        contentWidth = calculatedContentWidth;

        // Calculate group dimensions
        let groupWidth = actualGroupWidth;
        // Use reduced padding for both vertical and horizontal orientations to make them tighter
        const verticalPadding = group.orientation === 'vertical' ? GROUP_PADDING * 0.5 : 
                               group.orientation === 'horizontal' ? GROUP_PADDING * 0.5 : 
                               GROUP_PADDING;
        let groupHeight = contentHeight + verticalPadding * 2;
        
        // For auto-sized groups, apply orientation-specific aspect ratios
        if (group.sizeMode !== 'custom') {
            const originalWidth = groupWidth;
            const originalHeight = groupHeight;
            
            if (group.orientation === 'vertical') {
                // Vertical orientation: keep width tight to content, only adjust height if needed
                // Don't force aspect ratio - let content determine width, only ensure minimum height
                groupWidth = originalWidth; // Keep width tight to content
                // Only increase height if content is too tall for the width
                const minHeightForVertical = originalWidth * 1.5; // Minimum 1.5:1 height:width ratio
                if (originalHeight < minHeightForVertical) {
                    groupHeight = minHeightForVertical;
                } else {
                    groupHeight = originalHeight;
                }
            } else if (group.orientation === 'horizontal') {
                // Horizontal orientation: keep height tight to content, only adjust width if needed
                // Don't force aspect ratio - let content determine height, only ensure minimum width
                groupHeight = originalHeight; // Keep height tight to content
                // Only increase width if content is too wide for the height
                const minWidthForHorizontal = originalHeight * 1.8; // Minimum 1.8:1 width:height ratio
                if (originalWidth < minWidthForHorizontal) {
                    groupWidth = minWidthForHorizontal;
                } else {
                    groupWidth = originalWidth;
                }
            } else {
                // Square orientation: enforce square aspect ratio by using the larger dimension
                const maxDimension = Math.max(groupWidth, groupHeight);
                groupWidth = maxDimension;
                groupHeight = maxDimension;
            }
            
            // Re-center content within the group
            const horizontalOffset = (groupWidth - originalWidth) / 2;
            const verticalOffset = (groupHeight - originalHeight) / 2;
            
            // Reposition all children to center them in the group
            rows.forEach((row) => {
                row.children.forEach((item) => {
                    item.child.x += horizontalOffset;
                    item.child.y += verticalOffset;
                });
            });
        }
        
        // For custom-sized groups, use the custom dimensions and apply vertical centering
        if (group.sizeMode === 'custom') {
            groupHeight = group.height || groupHeight;
            
            // Apply vertical centering for all rows within the custom-sized group
            const totalContentHeight = contentHeight;
            const verticalOffset = verticalPadding + (groupHeight - verticalPadding * 2 - totalContentHeight) / 2;
            
            // Reposition all children with vertical offset
            rows.forEach((row) => {
                row.children.forEach((item) => {
                    item.child.y += verticalOffset - verticalPadding;
                });
            });
        }
        
        // If we have edge nodes, ensure minimum size for proper edge positioning using dynamic dimensions
        if (edgeNodes.length > 0) {
            const edgeNodeDims = edgeNodes.map(n => measureNodeDims(n as PositionedNode));
            const maxEdgeNodeWidth = Math.max(...edgeNodeDims.map(d => d.width));
            const maxEdgeNodeHeight = Math.max(...edgeNodeDims.map(d => d.height));
            // Use orientation-specific minimum dimensions for edge nodes
            if (group.orientation === 'vertical') {
                // Vertical: need enough width for edge nodes, but keep it tall and thin
                const minWidthForEdges = maxEdgeNodeWidth + GROUP_PADDING * 1.5;
                const minHeightForEdges = maxEdgeNodeHeight * 3 + GROUP_PADDING * 2;
                groupWidth = Math.max(groupWidth, minWidthForEdges);
                groupHeight = Math.max(groupHeight, minHeightForEdges);
            } else if (group.orientation === 'horizontal') {
                // Horizontal: need enough height for edge nodes, but keep it wide and short
                const minWidthForEdges = maxEdgeNodeWidth * 3 + GROUP_PADDING * 2;
                const minHeightForEdges = maxEdgeNodeHeight + GROUP_PADDING * 1.5;
                groupWidth = Math.max(groupWidth, minWidthForEdges);
                groupHeight = Math.max(groupHeight, minHeightForEdges);
            } else {
                // Square: use balanced dimensions
                const minWidthForEdges = maxEdgeNodeWidth * 2 + GROUP_PADDING * 2;
                const minHeightForEdges = maxEdgeNodeHeight * 2 + GROUP_PADDING * 2;
                groupWidth = Math.max(groupWidth, minWidthForEdges);
                groupHeight = Math.max(groupHeight, minHeightForEdges);
            }
        }
        
        (group as PositionedGroup).width = groupWidth;
        (group as PositionedGroup).height = groupHeight;

        // Position edge nodes on the boundaries of the group
        // Group nodes by edge position for even distribution
        const nodesByEdge = {
            top: edgeNodes.filter(n => n.edgePosition === 'top'),
            bottom: edgeNodes.filter(n => n.edgePosition === 'bottom'),
            left: edgeNodes.filter(n => n.edgePosition === 'left'),
            right: edgeNodes.filter(n => n.edgePosition === 'right')
        };
        
        // Position nodes evenly along each edge
        Object.entries(nodesByEdge).forEach(([edge, nodes]) => {
            if (nodes.length === 0) return;
            
            // Use actual node dimensions for edge positioning
            const nodeWidth = nodes.length > 0 ? measureNodeDims(nodes[0] as PositionedNode).width : NODE_WIDTH;
            const nodeHeight = nodes.length > 0 ? measureNodeDims(nodes[0] as PositionedNode).height : NODE_HEIGHT;
            
            nodes.forEach((node, index) => {
                switch (edge) {
                    case 'top':
                    case 'bottom':
                        // Distribute horizontally along top/bottom edges
                        if (nodes.length === 1) {
                            node.x = (groupWidth - nodeWidth) / 2;
                        } else {
                            const spacing = groupWidth / (nodes.length + 1);
                            node.x = spacing * (index + 1) - (nodeWidth / 2);
                        }
                        node.y = edge === 'top' 
                            ? -nodeHeight / 2 + nodeHeight * 0.1
                            : groupHeight - nodeHeight / 2 + nodeHeight * 0.1;
                        break;
                        
                    case 'left':
                    case 'right':
                        // Distribute vertically along left/right edges
                        node.x = edge === 'left'
                            ? -nodeWidth / 2
                            : groupWidth - nodeWidth / 2;
                        if (nodes.length === 1) {
                            node.y = (groupHeight - nodeHeight) / 2;
                        } else {
                            const spacing = groupHeight / (nodes.length + 1);
                            node.y = spacing * (index + 1) - (nodeHeight / 2);
                        }
                        break;
                }
            });
        });

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
        const itemWidth = item.type === 'group' 
            ? (item as any).width || 300 
            : measureNodeDims(item as PositionedNode).width;
        currentX += itemWidth + 50;
    });

    const finalNodes = Object.values(allItems).filter(i => i.type !== 'group') as PositionedNode[];
    const finalGroups = Object.values(allItems).filter(i => i.type === 'group') as PositionedGroup[];

    const allElementsX = [
        ...finalNodes.map(n => (n.x || 0) + measureNodeDims(n).width),
        ...finalGroups.map(g => (g.x || 0) + g.width)
    ];
    const allElementsY = [
        ...finalNodes.map(n => (n.y || 0) + measureNodeDims(n).height),
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

  // Helper function to recalculate group size based on its children
  const recalculateGroupSize = (group: DiagramGroupData, allNodes: DiagramNodeData[], allGroups: DiagramGroupData[]): DiagramGroupData => {
    // If group is in custom sizing mode, don't resize it - just return as-is
    if (group.sizeMode === 'custom') {
      return group;
    }
    
    const childNodes = allNodes.filter(n => group.children.includes(n.id));
    const childGroups = allGroups.filter((g: DiagramGroupData) => group.children.includes(g.id));
    
    if (childNodes.length === 0 && childGroups.length === 0) {
      // Empty group - use larger minimum size to accommodate potential textbox/labelbox nodes
      return {
        ...group,
        width: Math.max(NODE_WIDTH + GROUP_PADDING * 2, 300), // Larger minimum width
        height: Math.max(NODE_HEIGHT + GROUP_PADDING * 2, 200) // Larger minimum height
      };
    }
    
    // Calculate maximum dimensions among all children
    const allChildDims = [
      ...childNodes.map(n => measureNodeDims(n as PositionedNode)),
      ...childGroups.map(g => ({ width: g.width || 300, height: g.height || 220 }))
    ];
    
    const maxChildWidth = Math.max(...allChildDims.map(d => d.width));
    const maxChildHeight = Math.max(...allChildDims.map(d => d.height));
    
    // Calculate required group size based on actual grid layout
    const allChildren = [...childNodes, ...childGroups];
    const numChildren = allChildren.length;
    const itemsPerRow = group.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numChildren) * 1.2));
    const numRows = Math.ceil(numChildren / itemsPerRow);
    
    // Calculate actual grid layout to determine proper dimensions
    let totalWidth = 0;
    let totalHeight = 0;
    let maxRowWidth = 0;
    let maxRowHeight = 0;
    
    for (let row = 0; row < numRows; row++) {
      const startIndex = row * itemsPerRow;
      const endIndex = Math.min(startIndex + itemsPerRow, numChildren);
      const rowChildren = allChildren.slice(startIndex, endIndex);
      
      // Calculate dimensions for this row
      let rowWidth = 0;
      let rowHeight = 0;
      
      rowChildren.forEach(child => {
        const dims = 'type' in child 
          ? measureNodeDims(child as PositionedNode)
          : { width: (child as DiagramGroupData).width || 300, height: (child as DiagramGroupData).height || 220 };
        
        rowWidth += dims.width;
        rowHeight = Math.max(rowHeight, dims.height);
      });
      
      // Add spacing between items in row
      if (rowChildren.length > 1) {
        rowWidth += GROUP_NODE_SPACING * (rowChildren.length - 1);
      }
      
      maxRowWidth = Math.max(maxRowWidth, rowWidth);
      totalHeight += rowHeight;
      
      // Add spacing between rows (except for last row)
      if (row < numRows - 1) {
        totalHeight += GROUP_NODE_SPACING;
      }
    }
    
    const requiredWidth = maxRowWidth + GROUP_PADDING * 2;
    const requiredHeight = totalHeight + GROUP_PADDING * 2;
    
    return {
      ...group,
      width: Math.max(requiredWidth, maxChildWidth + GROUP_PADDING * 2),
      height: Math.max(requiredHeight, maxChildHeight + GROUP_PADDING * 2)
    };
  };

  const addNode = useCallback((item: any, position: { x: number; y: number }, targetGroupId: string | null) => {
    setDiagramData((prevData) => {
      let newGroups = prevData.groups ? [...prevData.groups] : [];
      let newNodes = prevData.nodes ? [...prevData.nodes] : [];
      let newItemId: string;

      const itemType = item.type || '';
      const itemLabel = item.label || '';
      
      // Check if this is a shape resource (needed for freeflow and group exclusion)
      const isShapeResource = itemType === 'generic.text.square' || 
                               itemType === 'generic.text.circle' || 
                               itemType === 'generic.text.rectangle' || 
                               itemType === 'generic.text.triangle' ||
                               itemType === 'generic.text.star' ||
                               itemType === 'generic.text.cloud';
      
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
          sizeMode: 'auto', // Default to auto-sizing
        };
        newGroups.push(newGroup);
        newItemId = newGroup.id;
      } else {
        // For resource items from the sidebar, use type from drag item
        // NEVER store file in node - ResourceIcon looks up file from resource catalog
        // Special handling for shape resources - make them resizable and freeflow
        const newNode: DiagramNodeData = {
          id: generateSequentialId(itemType, prevData),
          type: itemType,
          label: itemLabel,
          info: item.provider ? `${itemLabel} from ${item.provider}` : `A new ${itemLabel}`,
          freeflow: isShapeResource ? true : undefined, // Shapes are always freeflow
          sizeMode: isShapeResource ? 'custom' : undefined, // Shapes use custom sizing
          width: isShapeResource ? (itemType === 'generic.text.rectangle' ? 80 : itemType === 'generic.text.cloud' ? 80 : 60) : undefined, // Initial width
          height: isShapeResource ? (itemType === 'generic.text.rectangle' ? 50 : itemType === 'generic.text.cloud' ? 50 : 60) : undefined, // Initial height
        };
        newNodes.push(newNode);
        newItemId = newNode.id;
      }
      
      // Don't add freeflow shape nodes to groups
      const addedItem = newNodes.find(n => n.id === newItemId) || newGroups.find(g => g.id === newItemId);
      const isFreeflowShape = (addedItem as any)?.freeflow === true && isShapeResource;
      
      if (targetGroupId && !isFreeflowShape) {
        newGroups = newGroups.map(g => {
          if (g.id === targetGroupId) {
            const updatedGroup = { ...g, children: [...g.children, newItemId] };
            // Recalculate group size based on new children including dynamic dimensions
            return recalculateGroupSize(updatedGroup, newNodes, newGroups);
          }
          return g;
        });
      } else {
        // Top-level placement: snap to grid and avoid overlap by nudging to nearest free slot
        const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP;
        let posX = snap(position.x);
        let posY = snap(position.y);

        const isOverlapAt = (x: number, y: number) => {
          const width = (item.type === 'zone' || item.type === 'group') ? 300 : 
                      (item.type ? measureNodeDims(item as PositionedNode).width : NODE_WIDTH);
          const height = (item.type === 'zone' || item.type === 'group') ? 220 : 
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
          for (const g of newGroups) {
            const gg: any = g as any;
            if (gg.x != null && gg.y != null && g.id !== newItemId) {
              // groups without computed size: approximate
              obstacles.push({ id: g.id, x: gg.x, y: gg.y, width: 300, height: 220 });
            }
          }
          return obstacles.some(o => !(x + rectA.width <= o.x || o.x + o.width <= x || y + rectA.height <= o.y || o.y + o.height <= y));
        };

        // Check if the new node should be freeflow (skip overlap prevention)
        const addedItem = newNodes.find(n => n.id === newItemId) || newGroups.find(g => g.id === newItemId);
        const isFreeflowNewItem = (addedItem as any)?.freeflow;

        // nudge search (spiral-ish) up to 50 attempts (skip for freeflow items)
        const dirs = [ [1,0],[0,1],[-1,0],[0,-1] ];
        let step = 1; let attempts = 0; let dirIdx = 0; let movesInDir = 0; let changes = 0;
        while (!isFreeflowNewItem && isOverlapAt(posX, posY) && attempts < 50) {
          posX += dirs[dirIdx][0] * GRID_SNAP;
          posY += dirs[dirIdx][1] * GRID_SNAP;
          movesInDir++;
          if (movesInDir === step) { dirIdx = (dirIdx + 1) % 4; movesInDir = 0; changes++; if (changes % 2 === 0) step++; }
          attempts++;
        }

        if (addedItem) {
          (addedItem as any).x = posX;
          (addedItem as any).y = posY;
        }
      }

      return { ...prevData, nodes: newNodes, groups: newGroups };
    });
  }, [setDiagramData]);

  const resizeNode = useCallback((nodeId: string, newWidth: number, newHeight: number) => {
    setDiagramData(prevData => {
      const updatedNodes = prevData.nodes?.map(node => {
        if (node.id === nodeId) {
          // Calculate minimum size based on node type
          let minWidth = 80;
          let minHeight = 40;
          
          const isShapeNode = node.type === 'generic.text.square' || 
                             node.type === 'generic.text.circle' || 
                             node.type === 'generic.text.rectangle' || 
                             node.type === 'generic.text.triangle' ||
                             node.type === 'generic.text.star' ||
                             node.type === 'generic.text.cloud';
          
          if (node.type === 'generic.text.textbox') {
            minWidth = 200;
            minHeight = 120;
          } else if (node.type === 'generic.text.labelbox') {
            minWidth = 160;
            minHeight = 100;
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
      const updatedGroups = prevData.groups?.map(group => {
        if (group.id === groupId) {
          // Calculate minimum size based on content using dynamic dimensions
          const currentGroup = processedGroups.find(g => g.id === groupId);
          const groupNodes = processedNodes.filter(n => currentGroup?.children.includes(n.id));
          
          let minWidth = 200;
          let minHeight = 150;
          
          if (groupNodes.length > 0) {
            const maxNodeWidth = Math.max(...groupNodes.map(n => measureNodeDims(n).width));
            const maxNodeHeight = Math.max(...groupNodes.map(n => measureNodeDims(n).height));
            minWidth = Math.max(minWidth, maxNodeWidth + GROUP_PADDING * 2);
            minHeight = Math.max(minHeight, maxNodeHeight + GROUP_PADDING * 2);
          }
          
          return {
            ...group,
            width: Math.max(minWidth, newWidth),
            height: Math.max(minHeight, newHeight),
            sizeMode: 'custom' as const,
            minWidth,
            minHeight
          };
        }
        return group;
      }) || [];
      
      return { ...prevData, groups: updatedGroups };
    });
  }, [setDiagramData, processedGroups]);

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
            if (n) {
              const dims = measureNodeDims(n);
              return { id, x: n.x, y: n.y, width: dims.width, height: dims.height };
            }
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

        // Clean up residual information when moving out of old group
        if (oldParentId && item.type === ItemTypes.GROUP) {
          // Remove parentId from the moved group and all its descendants
          const cleanUpParentId = (groupId: string) => {
            const group = currentGroups.find(g => g.id === groupId);
            if (group) {
              // Remove parentId reference
              const groupIndex = currentGroups.findIndex(g => g.id === groupId);
              if (groupIndex !== -1) {
                currentGroups[groupIndex] = { ...group, parentId: undefined };
              }
              
              // Recursively clean up all child groups
              group.children.forEach(childId => {
                const childGroup = currentGroups.find(g => g.id === childId);
                if (childGroup) {
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
        currentGroups = currentGroups.map(g => {
          if (g.id !== targetGroupId) return g;
          const filtered = g.children.filter((nid: string) => nid !== item.id);
          const insertIndex = computeInsertIndex(targetGroupId, newPos);
          filtered.splice(insertIndex, 0, item.id);
          return { ...g, children: filtered };
        });

        // Set parentId for groups that are moved into a new parent
        if (item.type === ItemTypes.GROUP && targetGroupId) {
          const setParentId = (groupId: string, parentId: string) => {
            const group = currentGroups.find(g => g.id === groupId);
            if (group) {
              const groupIndex = currentGroups.findIndex(g => g.id === groupId);
              if (groupIndex !== -1) {
                currentGroups[groupIndex] = { ...group, parentId };
              }
              
              // Recursively set parentId for all child groups
              group.children.forEach(childId => {
                const childGroup = currentGroups.find(g => g.id === childId);
                if (childGroup) {
                  setParentId(childId, groupId);
                }
              });
            }
          };
          setParentId(item.id, targetGroupId);
        }
      } else if (!targetGroupId && item.type === ItemTypes.GROUP) {
        // Group moved to canvas (orphaned) - clear parentId for moved group and all descendants
        const clearParentId = (groupId: string) => {
          const group = currentGroups.find(g => g.id === groupId);
          if (group) {
            const groupIndex = currentGroups.findIndex(g => g.id === groupId);
            if (groupIndex !== -1) {
              currentGroups[groupIndex] = { ...group, parentId: undefined };
            }
            
            // Recursively clear parentId for all child groups
            group.children.forEach(childId => {
              const childGroup = currentGroups.find(g => g.id === childId);
              if (childGroup) {
                clearParentId(childId);
              }
            });
          }
        };
        clearParentId(item.id);
      }
  
      // Handle positioning
      if (item.type === ItemTypes.CANVAS_NODE || item.type === ItemTypes.GROUP) {
        // Check if item is a freeflow node
        const isFreeflowNode = currentNodes.find(n => n.id === item.id)?.freeflow;
        
        // If item is (now) a child and NOT freeflow, its position is auto-calculated, so remove explicit coords.
        // Freeflow nodes always maintain their coordinates even if dropped over a group.
        if (targetGroupId && !isFreeflowNode) {
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
            : (() => {
                const n = processedNodes.find(pn => pn.id === item.id);
                if (n) return measureNodeDims(n);
                return { width: NODE_WIDTH, height: NODE_HEIGHT };
              })();

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
              ...processedNodes.map(n => {
                const dims = measureNodeDims(n);
                return { id: n.id, x: n.x, y: n.y, width: dims.width, height: dims.height };
              }),
              ...processedGroups.map(g => ({ id: g.id, x: g.x, y: g.y, width: g.width, height: g.height })),
            ].filter(o => o.id !== item.id && !allChildIds.has(o.id));
            return obstacles.some(o => !(x + rectA.width <= o.x || o.x + o.width <= x || y + rectA.height <= o.y || o.y + o.height <= y));
          };

          // Skip overlap prevention for freeflow nodes
          if (!isFreeflowNode && isOverlapAt(snappedX, snappedY)) {
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

        // Check if item is a freeflow node
        const isFreeflowNode = item.id && nodesById[item.id]?.freeflow;

        let targetGroupId: string | null = null;
        
        // Only check for group highlighting if item is NOT a freeflow node
        if (!isFreeflowNode) {
            // Iterate backwards to check topmost groups first
            for (let i = processedGroups.length - 1; i >= 0; i--) {
                const group = processedGroups[i];
                if (group.id === item.id) continue;
                
                // Check if item being dragged is an ancestor of potential target group
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
        
        
        
        // Check if item is a freeflow node
        const isFreeflowNode = item.id && nodesById[item.id]?.freeflow;
        const targetGroupIdForFreeflow = isFreeflowNode ? null : hoveredGroupId;
        
        if (itemType === ItemTypes.DIAGRAM_NODE) { 
            // Pass full item data to preserve resource information
            addNode(item as any, { x, y }, targetGroupIdForFreeflow);
        } else if (item.id && (itemType === ItemTypes.CANVAS_NODE || itemType === ItemTypes.GROUP)) {
            moveItem({ id: item.id, type: item.type || '', x: item.x, y: item.y }, { x, y }, targetGroupIdForFreeflow);
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
      onItemSelect({ ...node, itemType: 'node' }, e.shiftKey);
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
      onItemSelect({ ...group, itemType: 'group' }, e.shiftKey);
    }
  }

  const handleGroupRightClick = (e: React.MouseEvent, group: DiagramGroupData) => {
    e.stopPropagation();
    handleContextMenu(e, group.id, 'group');
  };

  drop(canvasRef);
  
  const handleWheel = (e: React.WheelEvent) => {
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
    setTransform({ ...transform, x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  // Touch event handlers for mobile - improved logic
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isConnectMode) return;
    const target = e.target as HTMLElement;
    
    // Check if touching an interactive element - let them handle their own touch events
    // This includes nodes, groups, buttons, inputs, etc.
    if (target.closest('.absolute') || 
        target.closest('button') || 
        target.closest('input') || 
        target.closest('textarea') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-move')) {
      return; // Don't handle canvas pan/zoom when touching interactive elements
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
    const target = e.target as HTMLElement;
    
    // Don't handle if touching interactive elements
    if (target.closest('.absolute') || 
        target.closest('button') || 
        target.closest('input') || 
        target.closest('textarea') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-move')) {
      return;
    }
    
    if (e.touches.length === 1 && isPanning) {
      // Single touch - pan
      e.preventDefault(); // Only prevent default for panning
      const touch = e.touches[0];
      setTransform({ ...transform, x: touch.clientX - panStart.x, y: touch.clientY - panStart.y });
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
      setTransform({ ...transform, k: newK });
      setLastTouchDistance(currentDistance);
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    setTouchStart(null);
    setLastTouchDistance(null);
  };


  const handleFitToView = useCallback(() => {
    if (!canvasRef.current) return;

    const viewportWidth = canvasRef.current.clientWidth;
    const viewportHeight = canvasRef.current.clientHeight;

    // Use the processedNodes and processedGroups which have final calculated positions
    const allNodes = processedNodes;
    const allGroups = processedGroups;

    console.log('Processed items (final positions):', {
      allNodes: allNodes.map(n => ({ id: n.id, x: n.x, y: n.y, label: n.label, width: measureNodeDims(n).width, height: measureNodeDims(n).height })),
      allGroups: allGroups.map(g => ({ id: g.id, x: g.x, y: g.y, width: g.width, height: g.height, label: g.label }))
    });

    const nodeBounds = allNodes.length
      ? {
          minX: Math.min(...allNodes.map(n => n.x ?? 0)),
          minY: Math.min(...allNodes.map(n => n.y ?? 0)),
          maxX: Math.max(...allNodes.map(n => (n.x ?? 0) + measureNodeDims(n).width)),
          maxY: Math.max(...allNodes.map(n => (n.y ?? 0) + measureNodeDims(n).height)),
        }
      : null;

    const groupBounds = allGroups.length
      ? {
          minX: Math.min(...allGroups.map(g => g.x ?? 0)),
          minY: Math.min(...allGroups.map(g => g.y ?? 0)),
          maxX: Math.max(...allGroups.map(g => (g.x ?? 0) + g.width)),
          maxY: Math.max(...allGroups.map(g => (g.y ?? 0) + g.height)),
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

    // Add minimal padding to account for edges/labels that can extend beyond shapes
    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    // Calculate scale needed to fit content within viewport
    // If content is larger than viewport, scale < 1 (zoom out)
    // If content is smaller than viewport, allow some zoom in for better visibility
    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    // Use the smaller scale to ensure everything fits, but allow up to 1.5x zoom for better visibility
    const k = Math.min(1.5, Math.min(scaleX, scaleY));
    
    // Debug logging (remove in production)
    console.log('Fit to view debug:', {
      viewportWidth, viewportHeight,
      contentWidth, contentHeight,
      scaleX, scaleY, k,
      bounds: { minX, minY, maxX, maxY },
      nodesCount: allNodes.length,
      groupsCount: allGroups.length,
      sampleNodes: allNodes.slice(0, 3).map(n => ({ id: n.id, x: n.x, y: n.y, label: n.label })),
      sampleGroups: allGroups.slice(0, 3).map(g => ({ id: g.id, x: g.x, y: g.y, width: g.width, height: g.height }))
    });

    const displayWidth = k * contentWidth;
    const displayHeight = k * contentHeight;

    // Calculate positioning - use your ideal values directly
    // You want X=-200, Y=-100, so let's use those as the target
    const x = -200;
    const y = -100;
    
// Debug the centering calculation
    console.log('Fit to view calculation:', {
      contentBounds: { minX, minY, maxX, maxY },
      calculatedTransform: { x, y, k },
      contentSize: { width: contentWidth, height: contentHeight },
      scaleFactors: { scaleX, scaleY },
      targetPosition: { x: -200, y: -100 }
    });

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

  // Initial imperative API setup - will be updated after handleCopy/handlePaste are defined

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

  // Fix passive wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const { clientX, clientY, deltaY } = e;
      const rect = canvas.getBoundingClientRect();
      const s = Math.pow(0.99, deltaY);
      const newK = Math.max(0.1, Math.min(transform.k * s, 3));
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const newX = mouseX - (mouseX - transform.x) * s;
      const newY = mouseY - (mouseY - transform.y) * s;
      setTransform({ x: newX, y: newY, k: newK });
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [transform]);

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
      onClipboardChange?.(true);
    } else if (group) {
      // Recursively collect all children
      const collectChildren = (groupId: string, visited: Set<string> = new Set()): (DiagramNodeData | DiagramGroupData)[] => {
        if (visited.has(groupId)) return [];
        visited.add(groupId);

        const children: (DiagramNodeData | DiagramGroupData)[] = [];
        const currentGroup = diagramData.groups?.find(g => g.id === groupId);

        if (currentGroup?.children) {
          for (const childId of currentGroup.children) {
            const childNode = diagramData.nodes.find(n => n.id === childId);
            const childGroup = diagramData.groups?.find(g => g.id === childId);

            if (childNode) {
              children.push({ ...childNode });
            } else if (childGroup) {
              children.push({ ...childGroup });
              // Recursively collect children of child groups
              children.push(...collectChildren(childId, visited));
            }
          }
        }

        return children;
      };

      const children = collectChildren(itemId);
      setClipboard({ group: { ...group }, children });
      onClipboardChange?.(true);
    }

    toast({
      title: "Item Copied",
      description: "The selected item has been copied to clipboard.",
    });
  };

  const handleToggleFreeflow = (itemId: string) => {
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
      // Create ID mapping for all items being pasted
      const idMapping = new Map<string, string>();

      // Generate new ID for the main group
      const newGroupId = generateGroupId((clipboard.group.subType as 'group' | 'zone') || 'group', diagramData);
      idMapping.set(clipboard.group.id, newGroupId);

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
          const groupChild = child as DiagramGroupData;
          const newChildId = generateGroupId((groupChild.subType as 'group' | 'zone') || 'group', diagramData);
          idMapping.set(groupChild.id, newChildId);
        }
      }

      // Create new group with updated children IDs
      const newGroup: DiagramGroupData = {
        ...clipboard.group,
        id: newGroupId,
        x: (clipboard.group.x || 0) + 50,
        y: (clipboard.group.y || 0) + 50,
        children: clipboard.group.children?.map(childId => idMapping.get(childId) || childId) || []
      };

      // Create new children with updated IDs and positions
      const newNodes: DiagramNodeData[] = [];
      const newGroups: DiagramGroupData[] = [];

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
          const groupChild = child as DiagramGroupData;
          const newChildGroup: DiagramGroupData = {
            ...groupChild,
            id: newChildId,
            x: (groupChild.x || 0) + 50,
            y: (groupChild.y || 0) + 50,
            children: groupChild.children?.map((childId: string) => idMapping.get(childId) || childId) || []
          };
          newGroups.push(newChildGroup);
        }
      }

      setDiagramData(prev => ({
        ...prev,
        nodes: [...prev.nodes, ...newNodes],
        groups: [...(prev.groups || []), newGroup, ...newGroups]
      }));
    }

    toast({
      title: "Item Pasted",
      description: "The copied item has been pasted to the canvas.",
    });
  };

  // Wrap copy/paste handlers in useCallback for stable references
  const copyHandler = useCallback(() => {
    if (selectedItemId) {
      handleCopy(selectedItemId);
    }
  }, [selectedItemId, diagramData]);

  const pasteHandler = useCallback(() => {
    handlePaste();
  }, [clipboard, diagramData]);

  const canPasteHandler = useCallback(() => {
    return !!clipboard;
  }, [clipboard]);

  // Expose imperative API
  React.useImperativeHandle(ref, () => ({
    fitToView: handleFitToView,
    exportPng,
    copy: copyHandler,
    paste: pasteHandler,
    canPaste: canPasteHandler,
  }), [handleFitToView, exportPng, copyHandler, pasteHandler, canPasteHandler]);

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
            style={{ touchAction: 'none' }}
            
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

                    // Use measured dimensions for nodes to ensure proper connection alignment
                    const fromItemDims = 'type' in fromItem ? measureNodeDims(fromItem as PositionedNode) : { width: (fromItem as any).width, height: (fromItem as any).height };
                    const toItemDims = 'type' in toItem ? measureNodeDims(toItem as PositionedNode) : { width: (toItem as any).width, height: (toItem as any).height };
                    
                    const fromPos: any = {
                      ...fromItem,
                      width: 'width' in fromItem ? (fromItem as any).width : fromItemDims.width,
                      height: 'height' in fromItem ? (fromItem as any).height : fromItemDims.height,
                    };
                    const toPos: any = {
                      ...toItem,
                      width: 'width' in toItem ? (toItem as any).width : toItemDims.width,
                      height: 'height' in toItem ? (toItem as any).height : toItemDims.height,
                    };

                    // Explicitly set lineColor after spreading to ensure it's not overwritten
                    fromPos.lineColor = (fromItem as any).lineColor;
                    toPos.lineColor = (toItem as any).lineColor;

                    // Check if this connection is selected
                    const edgeId = `${edge.from}-${edge.to}`;
                    const isConnectionHighlighted = selectedItemId === edge.from || selectedItemId === edge.to || selectedItemId === edgeId;

return (
                    <g key={`${edge.from}-${edge.to}-${index}`} className={cn(isConnectionHighlighted && 'drop-shadow-[0_0_6px_rgba(0,200,150,0.8)]')}>
                      <BezierConnection
                        from={fromPos}
                        to={toPos}
                        connectionColor={edge.color}
                        connectionData={edge}
                        onClick={(connection) => {
                          // Select the connection when clicked
                          if (onItemSelect) {
                            onItemSelect({
                              ...connection,
                              itemType: 'edge',
                              id: `${connection.from}-${connection.to}`
                            });
                          }
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
                      <div key={item.id} style={{ zIndex: 0, overflow: 'visible' }}>
                        <DiagramGroup 
                          group={item}
                          isSelected={selectedItemId === item.id && !isConnectMode}
                          isDropTarget={hoveredGroupId === item.id}
                          isTargetable={isConnectMode && selectedItemId !== item.id}
                          onClick={handleGroupClick}
                          onContextMenu={handleGroupRightClick}
                          onResize={resizeGroup}
                        />
                      </div>
                    );
                  } else {
                    const isConnectedToSelected = !!selectedItemId && (diagramData.connections || []).some((e: any) => e.from === selectedItemId && e.to === item.id || e.to === selectedItemId && e.from === item.id);
                    const isFreeflowNode = (item as any).freeflow;
                    return (
                      <div key={item.id} style={{ 
                        zIndex: isFreeflowNode ? 10 : 2, 
                        position: 'relative', 
                        transform: 'translateZ(0)' 
                      }}>
                        <DiagramNode 
                          node={item} 
                          isSelected={selectedItemId === item.id && !isConnectMode}
                          isTargetable={isConnectMode && selectedItemId !== item.id}
                          isHighlighted={isConnectedToSelected}
                          onClick={handleNodeClick}
                          onContextMenu={handleNodeRightClick}
                          onLabelUpdate={onLabelUpdate}
                          onResize={resizeNode}
                          onDraggingChange={onDraggingChange}
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

                    // Get actual dimensions for shapes using measureNodeDims
                    const fromDims = measureNodeDims(fromItem as PositionedNode);
                    const toDims = measureNodeDims(toItem as PositionedNode);
                    
                    const fromPos: any = {
                      ...fromItem,
                      width: fromDims.width,
                      height: fromDims.height,
                    };
                    const toPos: any = {
                      ...toItem,
                      width: toDims.width,
                      height: toDims.height,
                    };

                    // Explicitly set lineColor after spreading to ensure it's not overwritten
                    fromPos.lineColor = (fromItem as any).lineColor;
                    toPos.lineColor = (toItem as any).lineColor;

                    // Build parent map for groups to gather ancestor groups of endpoints
                    const parentMap = new Map<string, string>();
                    processedGroups.forEach(g => {
                      g.children.forEach((id: string) => parentMap.set(id, g.id));
                    });
                    
                    return (
                      <BezierConnectionText
                        key={`text-${edge.from}-${edge.to}-${index}`}
                        connectionData={edge}
                        from={fromPos}
                        to={toPos}
                        connectionColor={edge.color}
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
          onToggleFreeflow={() => handleToggleFreeflow(contextMenu.itemId)}
          isFreeflow={diagramData.nodes.find(n => n.id === contextMenu.itemId)?.freeflow || false}
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
