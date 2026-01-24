import type { DiagramNodeData } from "@/lib/types";
import { getTextStylingCSS, extractTextStylingFromNode } from "@/lib/text-styling";

// Helper function to get gradient CSS with angle
export const getGradientWithAngle = (colors: string[], angle: number = 135) => {
  // Convert angle to CSS gradient direction
  let gradientDirection = '';
  switch (angle) {
    case 0:
      gradientDirection = 'to right';
      break;
    case 45:
      gradientDirection = 'to bottom right';
      break;
    case -45:
      gradientDirection = 'to top right';
      break;
    case 90:
      gradientDirection = 'to bottom';
      break;
    case 180:
      gradientDirection = 'to left';
      break;
    default:
      gradientDirection = `${angle}deg`;
  }
  // Ensure unique string by including angle in all cases
  const gradient = `linear-gradient(${gradientDirection}, ${colors[0]}, ${colors[1]})`;
  return gradient;
};

// Helper function to determine if a color is dark or light
const isColorDark = (color: string): boolean => {
  // Convert hex to RGB
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches) {
      r = parseInt(matches[0]);
      g = parseInt(matches[1]);
      b = parseInt(matches[2]);
    }
  }
  
  // Calculate relative luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if dark (luminance < 0.5)
  return luminance < 0.5;
};

// Helper function to get text color based on background
export const getTextColorForBackground = (backgroundColor: string, customTextColor?: string): string => {
  if (customTextColor) return customTextColor;
  return isColorDark(backgroundColor) ? '#ffffff' : '#000000';
};

// Helper function to get text styling CSS for a node
export const getTextStylingForNode = (node: DiagramNodeData) => {
  const textStyling = extractTextStylingFromNode(node);
  return getTextStylingCSS(textStyling);
};

// Helper function to get text justification class
export const getTextJustifyClass = (justify?: string) => {
  switch (justify) {
    case 'left':
      return 'text-left';
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'full':
      return 'text-justify';
    default:
      return 'text-center';
  }
};

// Helper function to get vertical positioning class (for flex containers with flex-col)
export const getVerticalPositionClass = (position?: string) => {
  switch (position) {
    case 'top':
      return 'items-start';
    case 'middle':
      return 'items-center';
    case 'bottom':
      return 'items-end';
    default:
      return 'items-center';
  }
};

// Helper function to get vertical justification class (for flex containers with flex-col to position content)
export const getVerticalJustifyClass = (position?: string) => {
  switch (position) {
    case 'top':
      return 'justify-start';
    case 'middle':
      return 'justify-center';
    case 'bottom':
      return 'justify-end';
    default:
      return 'justify-center';
  }
};

// Helper function to get tag positioning classes
export const getTagPositionClasses = (position?: string) => {
  switch (position) {
    case 'top-left':
      return '-top-[30px] left-0';
    case 'top-center':
      return '-top-[30px] left-1/2 transform -translate-x-1/2';
    case 'top-right':
      return '-top-[30px] right-0';
    case 'bottom-left':
      return '-bottom-[30px] left-0';
    case 'bottom-center':
      return '-bottom-[30px] left-1/2 transform -translate-x-1/2';
    case 'bottom-right':
      return '-bottom-[30px] right-0';
    default:
      return '-top-[30px] left-1/2 transform -translate-x-1/2'; // Default to top-center
  }
};

// Get shape styling properties from node
export const getShapeStyles = (node: DiagramNodeData & { width?: number; height?: number }) => {
  const nodeAny = node as any;
  const backgroundStyle = nodeAny.backgroundStyle || 'solid';
  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280', nodeAny.backgroundColor || '#6b7280'];
  const backgroundColor = nodeAny.backgroundColor || '#6b7280';
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderStyle = nodeAny.borderStyle || 'solid';
  const borderColor = nodeAny.borderColor || '#6b7280';
  const borderWidth = nodeAny.borderWidth || 2;
  const shadow = nodeAny.shadow || false;

  return {
    background: backgroundStyle === 'gradient' 
      ? getGradientWithAngle(backgroundColors, gradientAngle)
      : backgroundColor,
    borderWidth: borderStyle === 'none' ? '0' : `${borderWidth}px`,
    borderStyle: borderStyle === 'gradient' ? 'solid' : borderStyle,
    borderColor,
    shadow,
    backgroundColor: backgroundStyle === 'gradient' ? backgroundColors[0] : backgroundColor,
  };
};
