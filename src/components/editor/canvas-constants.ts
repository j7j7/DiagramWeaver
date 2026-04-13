import type { DiagramNodeData, DiagramZoneData } from "@/lib/types";
import { isConnectorLineNodeType, isIconOrEmojiType, isShapeNodeType } from "@/lib/utils";
import { getPlainTextFromRuns } from "@/lib/rich-text";
import { getNodeSizeDimensions, getNodeSizeMultiplier } from "@/lib/visual-styling";
import { computeUmlClassDimensions } from "@/lib/uml-utils";

// Canvas constants
export const NODE_WIDTH = 80;
export const NODE_HEIGHT = 80;
export const BASE_NODE_HEIGHT = 80;
export const TEXT_NODE_HEIGHT = 40;
export const EXTRA_LINE_HEIGHT = 20;
export const ZONE_PADDING = 50; // Increased by 25% (was 40)
export const ZONE_NODE_SPACING = 30;
export const MULTI_LINE_SPACING_BONUS = 25; // Extra spacing for nodes with 2+ lines of text
export const GRID_SNAP = 20;
export const RULER_SIZE = 24;

/**
 * Z-index for connection affordances (on-canvas delete / add-waypoint / arrow helpers, waypoint drag handles).
 * Must exceed node layer stacks in `editor-canvas` (e.g. `100 + 2 * order`) and duplicate-drag previews (`50000 + i`).
 */
export const CONNECTION_HELPER_Z_INDEX = 100000;

// Types
export type PositionedNode = DiagramNodeData & { x: number; y: number; };
export type PositionedGroup = DiagramZoneData & { x: number; y: number; width: number; height: number; };

// Grid step for position and dimension alignment (10px) - ensures right/bottom edges tessellate
const GRID_STEP = 10;

// Custom snap function: snaps to 10px increments
export const snapToGrid = (v: number): number => {
  return Math.round(v / GRID_STEP) * GRID_STEP;
};

/** Snaps width/height to grid so right (x+width) and bottom (y+height) edges align for tessellation */
export const snapDimensionToGrid = (v: number, minVal = 20): number => {
  const snapped = Math.round(v / GRID_STEP) * GRID_STEP;
  return Math.max(minVal, snapped);
};

export const measureNodeDims = (n: PositionedNode) => {
  const isTextNode = n.type === 'generic.text.text';
  const isTextboxNode = n.type === 'generic.text.textbox';
  const isLineNode = isConnectorLineNodeType(n.type);
  const isLoopNode = n.type === 'generic.object.loop' || n.type?.endsWith('.loop');
  const isShapeNode =
    !isIconOrEmojiType(n.type) &&
    !isLineNode &&
    (isShapeNodeType(n.type) || isLoopNode);
  const label = (n.richLabel && n.richLabel.length > 0 ? getPlainTextFromRuns(n.richLabel) : (n.label || '')).toString();

  // Line nodes calculate dimensions from startPos/endPos
  if (isLineNode) {
    const startPos = (n as any).startPos || { x: n.x || 0, y: n.y || 0 };
    const endPos = (n as any).endPos || { x: (n.x || 0) + 150, y: n.y || 0 };
    const minX = Math.min(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxX = Math.max(startPos.x, endPos.x);
    const maxY = Math.max(startPos.y, endPos.y);
    const padding = 30;
    const w = Math.max(150, maxX - minX + padding * 2);
    const h = Math.max(100, maxY - minY + padding * 2);
    return { width: snapDimensionToGrid(w, 150), height: snapDimensionToGrid(h, 100) };
  }

  // Use custom dimensions if sizeMode is 'custom' and dimensions are provided
  if ((isTextNode  || isTextboxNode || isShapeNode) && n.sizeMode === 'custom' && n.width && n.height) {
    return { width: snapDimensionToGrid(n.width), height: snapDimensionToGrid(n.height) };
  }
  
  // UML class: compute dimensions from umlClass content when not explicitly set
  const isUmlClass = n.type === 'generic.object.uml-class' || n.type?.endsWith('.uml-class');
  if (isUmlClass) {
    const uml = (n as any).umlClass;
    const name = uml?.name ?? 'name';
    const attrs = uml?.attributes ?? ['attributes'];
    const methods = uml?.methods ?? ['methods'];
    const dims = computeUmlClassDimensions(name, attrs, methods);
    return { width: snapDimensionToGrid(n.width ?? dims.width), height: snapDimensionToGrid(n.height ?? dims.height) };
  }

  // Shapes always use their custom width/height if set
  if (isShapeNode && n.width && n.height) {
    return { width: snapDimensionToGrid(n.width), height: snapDimensionToGrid(n.height) };
  }

  // Text + textbox: identical auto-size model (plain text has no visible frame on canvas)
  if (isTextboxNode || isTextNode) {
    const avgCharWidth = 8;
    const padding = 32;
    const minWidth = 40;
    const maxWidth = 400;
    const minHeight = 40;

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

    const textLines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
    const height = minHeight + (textLines - 1) * EXTRA_LINE_HEIGHT;

    return { width: snapDimensionToGrid(calculatedWidth, minWidth), height: snapDimensionToGrid(height, minHeight) };
  } else if (isShapeNode) {
    const avgCharWidth = 8;

    let calculatedWidth: number;
    let height: number;

    const scale = getNodeSizeMultiplier((n as any).nodeSize);
    const shapeSize = Math.round(48 * scale);
    const textPadding = 16;
    const textPosition = (n as any).textPosition || 'under';

    if (textPosition === 'center' && label) {
      calculatedWidth = shapeSize;
    } else if (textPosition === 'above' || textPosition === 'under') {
      const textWidth = Math.min(120, Math.max(40, label.length * avgCharWidth + textPadding));
      calculatedWidth = Math.max(shapeSize, textWidth);
    } else {
      calculatedWidth = Math.max(shapeSize, Math.round(80 * scale));
    }

    const explicitLines = label.split('\n');
    const shapeLines = Math.max(1, explicitLines.length);
    height = Math.round(NODE_HEIGHT * scale) + (shapeLines - 1) * EXTRA_LINE_HEIGHT;

    return { width: snapDimensionToGrid(calculatedWidth, 40), height: snapDimensionToGrid(height, 40) };
  } else {
    // Icon/resource nodes: width can include wider label via labelWidth; nodeSize scales base
    const { container: iconContainer } = getNodeSizeDimensions((n as any).nodeSize);
    const iconWidth = iconContainer;
    let effectiveLabelWidth: number | undefined = (n as any).labelWidth ? snapDimensionToGrid(Math.max(iconWidth, (n as any).labelWidth), iconWidth) : undefined;
    // When no labelWidth persisted, derive width from label so text doesn't fragment in viewer
    if (!effectiveLabelWidth && label.trim().length > 0) {
      const avgCharWidth = 8;
      const padding = 24;
      const words = label.split(' ');
      const maxCharsPerLine = 12; // Same as legacy fallback for line count
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
      const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
      const labelBasedWidth = Math.max(iconWidth, Math.min(400, maxLineLength * avgCharWidth + padding));
      effectiveLabelWidth = snapDimensionToGrid(labelBasedWidth, iconWidth);
    }
    const nodeWidth = effectiveLabelWidth ?? iconWidth;
    const hasLabel = label.trim().length > 0;
    const maxCharsPerLine = effectiveLabelWidth ? Math.floor(effectiveLabelWidth / 8) : 12;
    const labelLines = hasLabel ? Math.max(1, Math.ceil(label.length / maxCharsPerLine)) : 1;
    const nodeHeight = iconContainer + (labelLines - 1) * EXTRA_LINE_HEIGHT;
    return { width: nodeWidth, height: snapDimensionToGrid(nodeHeight, 40) };
  }
};

