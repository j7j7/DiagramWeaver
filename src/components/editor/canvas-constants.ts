import type { DiagramNodeData, DiagramZoneData } from "@/lib/types";

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
  const isLineNode = n.type === 'generic.object.line' || n.type?.endsWith('.line');
   const isShapeNode =
     n.type === 'generic.object.square' ||
     n.type === 'generic.object.circle' ||
     n.type === 'generic.object.point' ||
     n.type === 'generic.object.rectangle' ||
     n.type === 'generic.object.rounded-rectangle' ||
     n.type === 'generic.object.triangle' ||
     n.type === 'generic.object.star' ||
     n.type === 'generic.object.cloud' ||
     n.type === 'generic.object.chevron' ||
     n.type?.endsWith('.square') ||
     n.type?.endsWith('.circle') ||
     n.type?.endsWith('.point') ||
     n.type?.endsWith('.rectangle') ||
     n.type?.endsWith('.rounded-rectangle') ||
     n.type?.endsWith('.triangle') ||
     n.type?.endsWith('.star') ||
     n.type?.endsWith('.cloud') ||
     n.type?.endsWith('.chevron');
  const label = (n.label || '').toString();

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
  
  // Shapes always use their custom width/height if set
  if (isShapeNode && n.width && n.height) {
    return { width: snapDimensionToGrid(n.width), height: snapDimensionToGrid(n.height) };
  }

  if (isTextboxNode) {
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
  } else if (isTextboxNode) {
    const avgCharWidth = 8;
    const padding = 24;
    const minWidth = 40;
    const maxWidth = 300;
    const minHeight = n.sizeMode === 'custom' ? 40 : 60; // Allow smaller height in custom mode

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

    const textLines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
    const height = minHeight + (textLines - 1) * EXTRA_LINE_HEIGHT;

    return { width: snapDimensionToGrid(calculatedWidth, minWidth), height: snapDimensionToGrid(height, minHeight) };
  } else if (isTextNode  || isShapeNode) {
    const avgCharWidth = 8;

    let calculatedWidth: number;
    let height: number;

    if (isTextNode ) {
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

      // Text nodes - use standard text height calculation
      const textLines = Math.max(1, Math.ceil(label.length / textMaxCharsPerLine));
      height = TEXT_NODE_HEIGHT + (textLines - 1) * EXTRA_LINE_HEIGHT;
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

    return { width: snapDimensionToGrid(calculatedWidth, 40), height: snapDimensionToGrid(height, 40) };
  } else {
    return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }
};

