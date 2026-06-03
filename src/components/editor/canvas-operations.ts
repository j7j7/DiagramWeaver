import { useCallback } from "react";
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramGroupData, DiagramConnectionData } from "@/lib/types";
import { generateConnectionId } from "@/lib/connection-order-utils";
import { ItemTypes } from "./draggable-item";
import { generateGroupId, generateSequentialId } from "@/lib/id-generator";
import themeManager, { DEFAULT_THEMES } from "@/lib/theme-manager";
import { DEFAULT_TEXT_STYLING } from "@/lib/text-styling";
import {
  NODE_WIDTH, 
  NODE_HEIGHT,
  snapDimensionToGrid,
  snapIconLabelWidthToGrid,
  ZONE_PADDING,
  snapToGrid, 
  measureNodeDims,
  type PositionedNode,
  type PositionedGroup,
} from "./canvas-constants";
import { getIconTileAnchorSize } from "@/lib/icon-bevel";
import {
  isConnectorLikeSpineNodeType,
  isConnectorLineNodeType,
  isIconOrEmojiType,
  isMindmapNodeType,
  isShapeNodeType,
  isTimelineNodeType,
  filterUnlockedDiagramItemIds,
  isDiagramNodeLocked,
} from "@/lib/utils";
import { isVectorPathNodeType, scaleVectorPathRings } from "@/lib/vector-path-utils";
import { TIMELINE_DEFAULT_SPINE_LENGTH_PX, TIMELINE_NODE_TYPE } from "@/lib/timeline-layout";
import { defaultPalettePyramidNodeProps } from "@/lib/pyramid";
import { defaultPaletteTimelineBarNodeProps } from "@/lib/timeline-bar";
import { defaultPaletteSegmentedRectangleNodeProps } from "@/lib/segmented-rectangle";
import { getCardTemplateIdFromNodeType, createInitialCardSpec } from "@/lib/card-utils";
import {
  getBorderTemplateIdFromNodeType,
  createInitialBorderSpec,
} from "@/lib/border-utils";
import { getBorderTemplate, defaultBorderPaletteNodeProps } from "@/lib/border-templates";
import { AGENDA_TEMPLATE_ID, defaultAgendaPaletteNodeProps } from "@/lib/card-agenda";
import {
  BULLET_LIST_TEMPLATE_ID,
  defaultBulletListPaletteNodeProps,
} from "@/lib/card-bullet-list";
import {
  createElementFeaturePaletteDrop,
  ELEMENT_FEATURE_TEMPLATE_ID,
} from "@/lib/card-element-feature";
import { getCardTemplate, defaultCardPaletteNodeProps } from "@/lib/card-templates";
import { MINDMAP_NODE_TYPE } from "@/lib/mindmap-layout";
import {
  nextMindmapAutoNumericLabel,
  reorderMindmapSiblingsByAngle,
  recomputeMindmapMetadata,
  syncMindmapChildPolarAfterMove,
} from "@/lib/mindmap-layout";
import { getConnectorLikeSpinePlacementAnchor } from "@/lib/line-curve-path";
import { defaultChartSpecForNodeType } from "@/lib/chart-node";
// Zones removed - no zone layout

interface UseCanvasOperationsOptions {
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  processedNodes: PositionedNode[];
  processedZones: PositionedGroup[];
  onItemSelect: (item: any | null) => void;
  toast: (options: { variant?: 'destructive' | 'default'; title: string; description: string }) => void;
  iconBackgroundEnabled?: boolean;
  /** When true (default), new palette drops get resource label + info description for icons/objects. Text/textbox resources always keep catalog label. */
  defaultTextLabelsEnabled?: boolean;
}

export function useCanvasOperations({
  setDiagramData,
  processedNodes,
  processedZones,
  onItemSelect,
  toast,
  iconBackgroundEnabled = true,
  defaultTextLabelsEnabled = true,
}: UseCanvasOperationsOptions) {
  const pickRandomBuiltInTheme = () => {
    const themes = DEFAULT_THEMES.filter((t) => t.isBuiltIn);
    return themes[Math.floor(Math.random() * themes.length)];
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
                                itemType === 'generic.object.progress-bar' ||
                                itemType === 'generic.object.timeline-bar' ||
                                itemType === 'generic.object.segmented-rectangle' ||
                                itemType === 'generic.object.pyramid' ||
                                itemType === 'generic.object.text-box-heading' ||
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
                                itemType === TIMELINE_NODE_TYPE ||
                                itemType === MINDMAP_NODE_TYPE ||
                                itemType === 'generic.object.uml-class' ||
                                itemType === 'generic.chart.pie' ||
                                itemType?.startsWith('generic.chart.') ||
                                itemType?.startsWith('generic.card.') ||
                                itemType?.startsWith('generic.border.') ||
                                isConnectorLineNodeType(itemType) ||
                                itemType?.endsWith('.square') ||
                                itemType?.endsWith('.circle') ||
                                itemType?.endsWith('.point') ||
                                itemType?.endsWith('.rectangle') ||
                                itemType?.endsWith('.rounded-rectangle') ||
                                itemType?.endsWith('.progress-bar') ||
                                itemType?.endsWith('.timeline-bar') ||
                                itemType?.endsWith('.segmented-rectangle') ||
                                itemType?.endsWith('.pyramid') ||
                                itemType?.endsWith('.text-box-heading') ||
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
                                itemType?.endsWith('.timeline') ||
                                itemType?.endsWith('.mind-map-node') ||
                                itemType?.endsWith('.uml-class'));
      
      // Check if this is a textbox resource
      const isTextboxResource = itemType === 'generic.text.textbox' || itemType?.endsWith('.textbox');
      const isRichTextBoxLikeResource = isTextboxResource || itemType === 'generic.text.text';
      const useResourceLabelForNewNode =
        itemType === 'generic.text.text' ||
        isTextboxResource ||
        defaultTextLabelsEnabled;
      // Drag/palette items may carry info/description; do not merge them when defaults are off (same as omitting generated info above)
      const omitMergedInfoDescription =
        itemType !== 'generic.text.text' &&
        !isTextboxResource &&
        !defaultTextLabelsEnabled;

      if (!existingNode) {
        const borderTemplateId = getBorderTemplateIdFromNodeType(itemType);
        const shouldApplyShapeTheme =
          isShapeResource && itemType !== "generic.object.point" && !isFromScratchPad && !borderTemplateId;
        const randomBuiltInTheme = shouldApplyShapeTheme ? pickRandomBuiltInTheme() : null;
        // For resource items from the sidebar, use type from drag item
        // NEVER store file in node - ResourceIcon looks up file from resource catalog
        // Special handling for shape resources - make them resizable
        const newNodeId = generateSequentialId(itemType, prevData);
        let initialLabel =
          isShapeResource ? "" : useResourceLabelForNewNode ? itemLabel : "";
        if (itemType === MINDMAP_NODE_TYPE && !isFromScratchPad) {
          initialLabel = nextMindmapAutoNumericLabel(prevData.nodes ?? []);
        }
        const cardTemplateId = getCardTemplateIdFromNodeType(itemType);
        const cardTemplate = cardTemplateId ? getCardTemplate(cardTemplateId) : undefined;
        const borderTemplate = borderTemplateId ? getBorderTemplate(borderTemplateId) : undefined;
        let newNode: DiagramNodeData = {
          id: newNodeId,
          type: itemType,
          // Set label based on type - shapes get no default text (never use resource name like "Rectangle", "Circle")
          // Icons/objects: omit resource name + info when defaultTextLabelsEnabled is off (text/textbox still use catalog label)
          label: initialLabel,
          // Don't set info/description for text and textbox resource types, or shapes
          ...(itemType !== 'generic.text.text' &&
            itemType !== 'generic.text.textbox' &&
            !isShapeResource &&
            defaultTextLabelsEnabled && {
              info: item.provider ? `${itemLabel} from ${item.provider}` : `A new ${itemLabel}`,
            }),
          sizeMode: (isShapeResource || isRichTextBoxLikeResource) ? 'custom' : undefined, // Shapes, textbox, and plain text use custom sizing
           width: isShapeResource ? snapDimensionToGrid(
             itemType === 'generic.object.point' ? 20 :
             itemType === 'generic.object.rectangle' ? 80 :
             itemType === 'generic.object.uml-class' ? 120 :
             itemType === 'generic.object.rounded-rectangle' ? 80 :
             itemType === MINDMAP_NODE_TYPE ? 80 :
             itemType === 'generic.object.progress-bar' ? 80 :
             itemType === 'generic.object.timeline-bar' ? snapDimensionToGrid(790, 40) :
             itemType === 'generic.object.segmented-rectangle' ? snapDimensionToGrid(780, 40) :
             itemType === 'generic.object.pyramid' || itemType?.endsWith('.pyramid') ? snapDimensionToGrid(390, 40) :
             itemType === 'generic.object.text-box-heading' ? 180 :
             itemType === 'generic.object.cloud' ? 80 :
             itemType === 'generic.object.line'
             ? 150
             : itemType === TIMELINE_NODE_TYPE
               ? snapDimensionToGrid(TIMELINE_DEFAULT_SPINE_LENGTH_PX, 150)
             :
             itemType === 'generic.chart.pie' ? snapDimensionToGrid(190, 40) :
             itemType === 'generic.chart.line' ? 470 :
             itemType === 'generic.chart.bar' ? 380 :
             itemType === 'generic.chart.ring' ? 410 :
             itemType === 'generic.chart.grid' ? 400 :
             borderTemplate ? borderTemplate.defaultWidth :
             cardTemplate ? cardTemplate.defaultWidth :
             60
           ) : isRichTextBoxLikeResource ? snapDimensionToGrid(240, 40) : undefined, // Initial width - 100% wider than before (was 120)
           height: isShapeResource ? snapDimensionToGrid(
             itemType === 'generic.object.point' ? 20 :
             itemType === 'generic.object.rectangle' ? 50 :
             itemType === 'generic.object.uml-class' ? 80 :
             itemType === 'generic.object.rounded-rectangle' ? 50 :
             itemType === MINDMAP_NODE_TYPE ? 50 :
             itemType === 'generic.object.progress-bar' ? 50 :
             itemType === 'generic.object.timeline-bar' ? snapDimensionToGrid(150, 28) :
             itemType === 'generic.object.segmented-rectangle' ? snapDimensionToGrid(210, 28) :
             itemType === 'generic.object.pyramid' || itemType?.endsWith('.pyramid') ? snapDimensionToGrid(310, 28) :
             itemType === 'generic.object.text-box-heading' ? 90 :
             itemType === 'generic.object.cloud' ? 50 :
             itemType === 'generic.object.line' || itemType === TIMELINE_NODE_TYPE ? 100 :
             itemType === 'generic.chart.pie' ? snapDimensionToGrid(180, 28) :
             itemType === 'generic.chart.line' ? 320 :
             itemType === 'generic.chart.bar' ? 280 :
             itemType === 'generic.chart.ring' ? 320 :
             itemType === 'generic.chart.grid' ? 280 :
             borderTemplate ? borderTemplate.defaultHeight :
             cardTemplate ? cardTemplate.defaultHeight :
             60
           ) : isRichTextBoxLikeResource ? snapDimensionToGrid(80, 40) : undefined, // Initial height - same as textbox for plain text
          // Apply default text color for text resources
          ...((itemType === 'generic.text.text' || itemType === 'generic.text.textbox') && {
            textColor: DEFAULT_TEXT_STYLING.textColor
          }),
          // Textbox + plain text: center text horizontally and vertically
          ...(isRichTextBoxLikeResource && !isFromScratchPad && {
            textJustify: 'center' as const,
            textVerticalPosition: 'middle' as const,
          }),
          // Other `.text` resources (not textbox / not generic.text.text): same alignment defaults
          ...(itemType?.endsWith('.text') && !isRichTextBoxLikeResource && !isFromScratchPad && {
            textJustify: 'center' as const,
            textVerticalPosition: 'middle' as const,
          }),
          // Apply random theme to all shapes (except point which has special styling)
          // BUT: Don't apply random theme if coming from scratchpad with existing properties
          ...(randomBuiltInTheme && {
            ...randomBuiltInTheme.properties,
            textJustify: 'center' as const,
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
          ...(itemType === TIMELINE_NODE_TYPE && !isFromScratchPad && {
            startPos: { x: position.x, y: position.y },
            endPos: { x: position.x + TIMELINE_DEFAULT_SPINE_LENGTH_PX, y: position.y },
            x: position.x,
            y: position.y,
            startCap: 'none',
            endCap: 'none',
            lineThickness: 2.5,
            lineColor: '#6b7280',
            timelineDistribution: 'even' as const,
            timelineCardSide: 'alternate' as const,
            timelineEntries: [
              { id: `${newNodeId}-te0`, label: 'Step 1' },
              { id: `${newNodeId}-te1`, label: 'Step 2' },
              { id: `${newNodeId}-te2`, label: 'Step 3' },
            ],
          }),
          ...(itemType === MINDMAP_NODE_TYPE && !isFromScratchPad && {
            mindmapFillMode: 'theme-hues' as const,
            mindmapHueStepDeg: 14,
            mindmapRootId: newNodeId,
            mindmapTreeDepth: 0,
            mindmapHueAnchor: true,
          }),
          // Default placeholder text for UML class (only if not from scratchpad)
          ...((itemType === 'generic.object.uml-class' || itemType?.endsWith('.uml-class')) && !isFromScratchPad && {
            umlClass: { name: 'name', attributes: ['attributes'], methods: ['methods'] },
          }),
          ...((itemType === 'generic.object.text-box-heading' || itemType?.endsWith('.text-box-heading')) && !isFromScratchPad && {
            headingEdge: 'top' as const,
            headingLabel: 'HEADING',
            headingBackgroundColor: '#1f2937',
            label: 'body',
          }),
          ...((itemType === 'generic.object.progress-bar' || itemType?.endsWith('.progress-bar')) && !isFromScratchPad && {
            progressPercent: 62,
            progressShowPercent: true,
            cornerRadius: 0.35,
            backgroundStyle: 'solid' as const,
            backgroundColor: '#e5e7eb',
            progressFillStyle: 'gradient' as const,
            progressFillColors: ['#22c55e', '#15803d'],
            progressFillGradientAngle: 90,
            textPosition: 'above' as const,
          }),
          ...((itemType === 'generic.object.timeline-bar' || itemType?.endsWith('.timeline-bar')) && !isFromScratchPad && {
            ...defaultPaletteTimelineBarNodeProps(newNodeId),
          }),
          ...((itemType === 'generic.object.segmented-rectangle' || itemType?.endsWith('.segmented-rectangle')) &&
            !isFromScratchPad && {
            ...defaultPaletteSegmentedRectangleNodeProps(newNodeId),
          }),
          ...((itemType === 'generic.object.pyramid' || itemType?.endsWith('.pyramid')) && !isFromScratchPad && {
            ...defaultPalettePyramidNodeProps(newNodeId),
          }),
          ...((itemType === 'generic.chart.pie' ||
            itemType === 'generic.chart.bar' ||
            itemType === 'generic.chart.line' ||
            itemType === 'generic.chart.ring' ||
            itemType === 'generic.chart.grid' ||
            itemType?.startsWith('generic.chart.')) &&
            !isFromScratchPad && {
            chart: defaultChartSpecForNodeType(itemType),
          }),
          ...(itemType === 'generic.chart.grid' && !isFromScratchPad && {
            cornerRadius: 0.2,
          }),
          ...(borderTemplateId && !isFromScratchPad && {
            ...defaultBorderPaletteNodeProps(borderTemplateId),
            border: createInitialBorderSpec(borderTemplateId),
          }),
          ...(cardTemplateId && !isFromScratchPad && (
            cardTemplateId === AGENDA_TEMPLATE_ID
              ? {
                  ...defaultAgendaPaletteNodeProps(),
                  card: createInitialCardSpec(cardTemplateId),
                }
              : cardTemplateId === BULLET_LIST_TEMPLATE_ID
                ? {
                    ...defaultBulletListPaletteNodeProps(),
                    card: createInitialCardSpec(cardTemplateId),
                  }
                : cardTemplateId === ELEMENT_FEATURE_TEMPLATE_ID
                  ? createElementFeaturePaletteDrop()
                  : {
                      ...defaultCardPaletteNodeProps(cardTemplateId),
                      card: createInitialCardSpec(cardTemplateId),
                    }
          )),
          // Apply icon background setting
          ...(!iconBackgroundEnabled && {
            noIconBackground: true
          }),
          // Merge extra properties from item (favorites/imports), excluding reserved ones
          // Keep provider, category, and file for icon rendering
          // This MUST come AFTER random theme so scratchpad properties override defaults
          ...Object.keys(item).reduce((acc: any, key) => {
             if (['type', 'label', 'x', 'y', 'id', 'fromScratchPad'].includes(key)) {
               return acc;
             }
             if (omitMergedInfoDescription && (key === 'info' || key === 'description')) {
               return acc;
             }
             acc[key] = item[key];
             return acc;
          }, {}),
        };
        if (
          randomBuiltInTheme &&
          (itemType === "generic.chart.pie" ||
            itemType === "generic.chart.bar" ||
            itemType === "generic.chart.ring" ||
            itemType === "generic.chart.grid")
        ) {
          newNode = themeManager.applyThemeToItem(newNode, randomBuiltInTheme) as DiagramNodeData;
        }
        if (borderTemplateId) {
          newNodes.unshift(newNode);
        } else {
          newNodes.push(newNode);
        }
        newItemId = newNode.id;
      }
      
      // Flat diagram: all nodes at top level
      const addedItemForPos = newNodes.find(n => n.id === newItemId);
      if (addedItemForPos) {
        (addedItemForPos as any).x = snapToGrid(position.x);
        (addedItemForPos as any).y = snapToGrid(position.y);
      }

      let outNodes = newNodes;
      if (addedItemForPos && isMindmapNodeType(addedItemForPos.type)) {
        outNodes = recomputeMindmapMetadata(newNodes);
      }
      return { ...prevData, nodes: outNodes };
    });
  }, [setDiagramData, defaultTextLabelsEnabled, iconBackgroundEnabled]);

  const resizeNode = useCallback((nodeId: string, newWidth: number, newHeight: number, newX?: number, newY?: number) => {
    setDiagramData(prevData => {
      if (prevData.nodes.find((n) => n.id === nodeId)?.locked) {
        return prevData;
      }
      const updatedNodes = prevData.nodes?.map(node => {
        if (node.id === nodeId) {
          const isShapeNode = isShapeNodeType(node.type);
          const isTextboxNode = node.type === 'generic.text.textbox';
          const isTextNode = node.type === 'generic.text.text';
          const isIconNode =
            !isShapeNode && !isTextboxNode && !isTextNode && !isConnectorLineNodeType(node.type);

          if (isIconNode) {
            const iconTileSize = getIconTileAnchorSize(node);
            const labelWidth = snapIconLabelWidthToGrid(Math.max(iconTileSize, newWidth), iconTileSize);
            return { ...node, labelWidth };
          }

          let minWidth = 80;
          let minHeight = 40;
          if (node.type === 'generic.text.textbox' || node.type === 'generic.text.text') {
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
          const updates: Partial<DiagramNodeData> = {
            width: finalWidth,
            height: finalHeight,
            sizeMode: 'custom' as const
          };
          if (newX !== undefined) updates.x = snapToGrid(newX);
          if (newY !== undefined) updates.y = snapToGrid(newY);
          if (isVectorPathNodeType(node.type) && node.vectorPath?.rings?.length) {
            const oldW = node.width ?? finalWidth;
            const oldH = node.height ?? finalHeight;
            updates.vectorPath = {
              rings: scaleVectorPathRings(node.vectorPath.rings, oldW, oldH, finalWidth, finalHeight),
            };
          }
          return { ...node, ...updates };
        }
        return node;
      }) || [];
      
      return { ...prevData, nodes: updatedNodes };
    });
  }, [setDiagramData]);

  const resizeMultipleNodes = useCallback((
    nodeIds: string[],
    scaleX: number,
    scaleY: number,
    originalDimensions?: Map<string, { width: number; height: number }>,
    options?: { anchorX?: 'left' | 'right'; anchorY?: 'top' | 'bottom' }
  ) => {
    const anchorX = options?.anchorX ?? 'left';
    const anchorY = options?.anchorY ?? 'top';
    setDiagramData(prevData => {
      const updatedNodes = prevData.nodes?.map(node => {
        if (nodeIds.includes(node.id)) {
          if (node.locked) return node;
          const originalDims = originalDimensions?.get(node.id);
          const originalWidth = originalDims?.width ?? (node.width || 80);
          const originalHeight = originalDims?.height ?? (node.height || 80);
          const nodeX = node.x ?? 0;
          const nodeY = node.y ?? 0;

          let minWidth = 80;
          let minHeight = 40;
          const isShapeNode = isShapeNodeType(node.type);

          if (node.type === 'generic.text.textbox' || node.type === 'generic.text.text') {
            minWidth = 40;
            minHeight = 40;
          } else if (isShapeNode) {
            minWidth = 20;
            minHeight = 20;
          }

          let newWidth = snapDimensionToGrid(originalWidth * scaleX, minWidth);
          let newHeight = snapDimensionToGrid(originalHeight * scaleY, minHeight);
          const isKiteNode = node.type === 'generic.object.kite' || node.type?.endsWith?.('.kite');
          if (isKiteNode) {
            const size = Math.max(newWidth, newHeight);
            newWidth = size;
            newHeight = size;
          }

          let newX = nodeX;
          let newY = nodeY;
          if (anchorX === 'right') {
            newX = snapToGrid(nodeX + originalWidth - newWidth);
          }
          if (anchorY === 'bottom') {
            newY = snapToGrid(nodeY + originalHeight - newHeight);
          }

          return {
            ...node,
            x: newX,
            y: newY,
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

  /** Clone nodes to new positions; originals unchanged. Used for Alt+drag duplicate. Returns new node records (for selection). */
  const duplicateNodesAtPositions = useCallback(
    (
      items: Array<{ id: string }>,
      newPositions: Array<{ x: number; y: number }>,
      sourceDiagram: DiagramData
    ): DiagramNodeData[] => {
      const additions: DiagramNodeData[] = [];
      /** originalId → cloneId; must be set when each clone is pushed (not by index into additions, which misaligns if any item skips). */
      const idMap = new Map<string, string>();
      let accNodes = [...(sourceDiagram.nodes || [])];
      items.forEach((item, index) => {
        const original = accNodes.find((n) => n.id === item.id);
        const pos = newPositions[index];
        if (!original || !pos) return;
        const tempData: DiagramData = { ...sourceDiagram, nodes: accNodes };
        const newId = generateSequentialId(original.type, tempData);
        const snappedX = snapToGrid(pos.x);
        const snappedY = snapToGrid(pos.y);
        let next: DiagramNodeData = {
          ...original,
          id: newId,
          x: snappedX,
          y: snappedY,
          importId: undefined,
          groupId: undefined,
        };
        if (isConnectorLikeSpineNodeType(original.type)) {
          const anchor = getConnectorLikeSpinePlacementAnchor(original);
          const ddx = snappedX - anchor.x;
          const ddy = snappedY - anchor.y;
          const ox = original.x ?? 0;
          const oy = original.y ?? 0;
          const sp = (original as { startPos?: { x: number; y: number } }).startPos || { x: ox, y: oy };
          const ep = (original as { endPos?: { x: number; y: number } }).endPos || { x: ox + 150, y: oy };
          const ctrls = (original as { lineControlPoints?: { x: number; y: number }[] }).lineControlPoints;
          next = {
            ...next,
            startPos: { x: sp.x + ddx, y: sp.y + ddy },
            endPos: { x: ep.x + ddx, y: ep.y + ddy },
            ...(ctrls?.length
              ? {
                  lineControlPoints: ctrls.map((c) => ({
                    ...c,
                    x: c.x + ddx,
                    y: c.y + ddy,
                  })),
                }
              : {}),
          };
          if (isTimelineNodeType(original.type)) {
            const entries = original.timelineEntries;
            if (entries?.length) {
              next = {
                ...next,
                timelineEntries: entries.map((e, i) => ({
                  ...e,
                  id: `${newId}-te${i}`,
                })),
              };
            }
          }
        }
        if (isMindmapNodeType(original.type)) {
          const mapPid = original.mindmapParentId ? idMap.get(original.mindmapParentId) : undefined;
          const nextChildren = (original.mindmapChildIds ?? [])
            .map((cid) => idMap.get(cid))
            .filter((x): x is string => typeof x === "string");
          const nextRoot = original.mindmapRootId ? idMap.get(original.mindmapRootId) ?? newId : newId;
          next = {
            ...next,
            mindmapParentId: mapPid,
            mindmapChildIds: nextChildren.length ? nextChildren : undefined,
            mindmapRootId: nextRoot,
            mindmapHueAnchor: false,
          };
        }
        additions.push(next);
        idMap.set(item.id, next.id);
        accNodes = [...accNodes, next];
      });
      if (additions.length === 0) return [];
      setDiagramData((prev) => {
        const extraConnections: DiagramConnectionData[] = [];
        for (const conn of prev.connections || []) {
          const newFrom = idMap.get(conn.from) ?? conn.from;
          const newTo = idMap.get(conn.to) ?? conn.to;
          if (newFrom === conn.from && newTo === conn.to) continue;

          const { id: _oldConnId, waypoints: _wp, ...rest } = conn;
          extraConnections.push({
            ...rest,
            id: generateConnectionId(),
            from: newFrom,
            to: newTo,
            waypoints: undefined,
            connectionIndex: undefined,
            totalConnections: undefined,
            toConnectionIndex: undefined,
            toTotalConnections: undefined,
          });
        }

        const merged = [...(prev.nodes || []), ...additions];
        const nodes = additions.some((n) => isMindmapNodeType(n.type))
          ? recomputeMindmapMetadata(merged)
          : merged;

        return {
          ...prev,
          nodes,
          connections: [...(prev.connections || []), ...extraConnections],
        };
      });
      return additions;
    },
    [setDiagramData]
  );

  const moveMultipleItems = useCallback((items: Array<{ id: string; type: string; x?: number, y?: number }>, newPositions: Array<{ x: number; y: number }>, targetGroupId: string | null) => {
    setDiagramData(prevData => {
      let currentNodes = [...(prevData.nodes || [])];
      let currentZones = [...(prevData.zones || [])];
      
      items.forEach((item, index) => {
        const newPos = newPositions[index];
        if (!newPos) return;

        const node = currentNodes.find(n => n.id === item.id);
        if (node?.locked) return;

        const oldParentId = currentZones.find(zone => zone.children.includes(item.id))?.id;
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
                if (isConnectorLikeSpineNodeType(n.type)) {
                  const currentStartPos = (n as any).startPos || { x: n.x || 0, y: (n.y || 0) + 50 };
                  const currentEndPos = (n as any).endPos || { x: (n.x || 0) + 150, y: (n.y || 0) + 50 };
                  const anchor = getConnectorLikeSpinePlacementAnchor(n);
                  const deltaX = snappedX - anchor.x;
                  const deltaY = snappedY - anchor.y;
                  const ctrls = (n as any).lineControlPoints as { x: number; y: number }[] | undefined;
                  return {
                    ...n,
                    x: snappedX,
                    y: snappedY,
                    startPos: { x: currentStartPos.x + deltaX, y: currentStartPos.y + deltaY },
                    endPos: { x: currentEndPos.x + deltaX, y: currentEndPos.y + deltaY },
                    ...(ctrls?.length
                      ? {
                          lineControlPoints: ctrls.map((c) => ({
                            ...c,
                            x: c.x + deltaX,
                            y: c.y + deltaY,
                          })),
                        }
                      : {}),
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
      if (prevData.nodes.find((n) => n.id === item.id)?.locked) {
        return prevData;
      }
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
                 if (isConnectorLikeSpineNodeType(n.type)) {
                   const currentStartPos = (n as any).startPos || { x: n.x || 0, y: n.y || 0 };
                   const currentEndPos = (n as any).endPos || { x: (n.x || 0) + 150, y: n.y || 0 };
                   const anchor = getConnectorLikeSpinePlacementAnchor(n);
                   const deltaX = snappedX - anchor.x;
                   const deltaY = snappedY - anchor.y;
                   const ctrls = (n as any).lineControlPoints as { x: number; y: number }[] | undefined;
                   return {
                     ...n,
                     x: snappedX,
                     y: snappedY,
                     startPos: { x: currentStartPos.x + deltaX, y: currentStartPos.y + deltaY },
                     endPos: { x: currentEndPos.x + deltaX, y: currentEndPos.y + deltaY },
                     ...(ctrls?.length
                       ? {
                           lineControlPoints: ctrls.map((c) => ({
                             ...c,
                             x: c.x + deltaX,
                             y: c.y + deltaY,
                           })),
                         }
                       : {}),
                   };
                 }
                 return { ...n, x: snappedX, y: snappedY };
               }
               return n;
             });
             const movedMm = currentNodes.find((nn) => nn.id === item.id);
             if (
               movedMm &&
               isMindmapNodeType(movedMm.type) &&
               movedMm.mindmapParentId
             ) {
               currentNodes = currentNodes.map((n) =>
                 n.id === item.id ? syncMindmapChildPolarAfterMove(n, currentNodes) : n,
               );
               currentNodes = reorderMindmapSiblingsByAngle(movedMm.mindmapParentId, currentNodes);
               currentNodes = recomputeMindmapMetadata(currentNodes);
             }
           }
         }
       }
        
        return { ...prevData, nodes: currentNodes };
    });
  }, [setDiagramData, processedNodes, processedZones]);

  const handleDelete = useCallback((itemId: string) => {
    let didDelete = false;
    setDiagramData(prev => {
      if (isDiagramNodeLocked(prev.nodes, itemId)) {
        return prev;
      }

      const isNode = prev.nodes.some(n => n.id === itemId);
      const isZone = (prev.zones ?? []).some(zone => zone.id === itemId);
      const hasConnectionIdMatch = prev.connections.some((e: any) => e.id === itemId);
      const hasConnectionKeyMatch = prev.connections.some((e: any) => `${e.from}-${e.to}` === itemId);
      
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
      } else if (hasConnectionIdMatch || hasConnectionKeyMatch) {
        updatedData = {
          ...prev,
          connections: prev.connections.filter((e: any) => {
            if (hasConnectionIdMatch) return e.id !== itemId;
            return `${e.from}-${e.to}` !== itemId;
          })
        };
      } else if (isZone) {
        updatedData = {
          ...prev,
          zones: (prev.zones ?? []).filter(zone => zone.id !== itemId)
        };
      } else {
        updatedData = {
          ...prev,
          zones: (prev.zones ?? []).filter(zone => zone.id !== itemId)
        };
      }

      didDelete = true;
      return updatedData;
    });

    if (!didDelete) return;

    onItemSelect(null);
    toast({
      title: "Item Deleted",
      description: "The selected item has been deleted.",
    });
  }, [setDiagramData, onItemSelect, toast]);

  const handleDeleteMultiple = useCallback((itemIds: string[]) => {
    let deletedCount = 0;
    setDiagramData(prev => {
      const deletableIds = filterUnlockedDiagramItemIds(prev.nodes, itemIds);
      if (deletableIds.length === 0) {
        return prev;
      }
      deletedCount = deletableIds.length;
      const idsToDelete = new Set(deletableIds);
      // Filter out nodes that are being deleted
      const remainingNodes = prev.nodes.filter(n => !idsToDelete.has(n.id));

      // Separate edge identifiers from node/zone identifiers
      const edgeIdsToDelete = new Set<string>();
      const edgeKeysToDelete = new Set<string>();
      idsToDelete.forEach((id) => {
        if (prev.connections.some((e: any) => e.id === id)) edgeIdsToDelete.add(id);
        else if (prev.connections.some((e: any) => `${e.from}-${e.to}` === id)) edgeKeysToDelete.add(id);
      });
      
      // Filter out zones that are being deleted
      const remainingZones = prev.zones?.filter(zone => !idsToDelete.has(zone.id));
      
      // Remove deleted items from zone children
      const updatedZones = remainingZones?.map(zone => ({
        ...zone,
        children: zone.children.filter(childId => !idsToDelete.has(childId))
      }));
      
      // Remove connections that involve deleted items
      const remainingConnections = prev.connections?.filter((e: any) => 
        !idsToDelete.has(e.from) &&
        !idsToDelete.has(e.to) &&
        !(e.id && edgeIdsToDelete.has(e.id)) &&
        !edgeKeysToDelete.has(`${e.from}-${e.to}`)
      );
      
      const dataBeforeCleanup = {
        ...prev,
        nodes: remainingNodes,
        zones: updatedZones,
        connections: remainingConnections
      };
      
      return dataBeforeCleanup;
    });

    if (deletedCount === 0) return;

    onItemSelect(null);
    toast({
      title: "Items Deleted",
      description: `${deletedCount} items have been deleted.`,
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
    duplicateNodesAtPositions,
    handleDelete,
    handleDeleteMultiple,
  };
}

