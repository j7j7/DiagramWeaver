import React, { useId } from 'react';
import { polygonToRoundedPath } from '@/components/diagram/shapes/shape-utils';

interface ShapePreviewProps {
  type: string;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderStyle?: string;
  backgroundColor?: string;
  borderColor?: string;
  backgroundStyle?: string;
  backgroundColors?: string[];
  borderColors?: string[];
  gradientAngle?: number;
  borderGradientAngle?: number;
  label?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  shadow?: boolean;
  roundedEdges?: boolean;
  cornerRadius?: number; // Rounded-rectangle only: 0=straight, 1=full
}

// Helper function to convert gradient angle to SVG coordinates
const getGradientCoordinates = (angle: number = 135) => {
  const radians = (angle * Math.PI) / 180;
  const x2 = 50 + 50 * Math.cos(radians);
  const y2 = 50 + 50 * Math.sin(radians);
  const x1 = 50 - 50 * Math.cos(radians);
  const y1 = 50 - 50 * Math.sin(radians);
  return {
    x1: `${x1}%`,
    y1: `${y1}%`,
    x2: `${x2}%`,
    y2: `${y2}%`
  };
}

export function ShapePreview({
  type,
  width = 40,
  height = 40,
  fill,
  stroke,
  strokeWidth = 2,
  borderStyle = 'solid',
  backgroundColor,
  borderColor,
  backgroundStyle = 'solid',
  backgroundColors,
  borderColors,
  gradientAngle = 135,
  borderGradientAngle,
  label,
  textColor = '#000000',
  fontFamily,
  fontSize = 10,
  fontWeight,
  fontStyle,
  textDecoration,
  shadow = false,
  roundedEdges = false,
  cornerRadius = 0.5
}: ShapePreviewProps) {
  const gradientId = useId();
  const borderGradientId = useId();

  // Use provided colors or fallback to fill/stroke for backward compatibility
  // Only apply defaults if NO color is provided at all
  const effectiveBackgroundColor = backgroundColor !== undefined ? backgroundColor : (fill !== undefined ? fill : '#6b7280');
  const effectiveBorderColor = borderColor !== undefined ? borderColor : (stroke !== undefined ? stroke : '#6b7280');
  
  // Normalize dimensions to fit in the preview area while maintaining aspect ratio if needed
  // For scratchpad, we usually want a fixed square-ish preview
  const displayWidth = width;
  const displayHeight = height;
  
  // Handle background colors array - ensure we have valid colors
  const bgColors = backgroundColors && backgroundColors.length >= 2 
    ? backgroundColors 
    : [effectiveBackgroundColor, effectiveBackgroundColor];
  const borderColorArray = borderColors && borderColors.length >= 2
    ? borderColors
    : [effectiveBorderColor, effectiveBorderColor];
  
  // Ensure backgroundStyle defaults to 'solid' if not provided (matching canvas behavior)
  const effectiveBackgroundStyle = backgroundStyle !== undefined ? backgroundStyle : 'solid';
  


  const commonSvgProps = {
    width: displayWidth,
    height: displayHeight,
    style: { display: 'block' }
  };

  const borderCoords = getGradientCoordinates(borderGradientAngle ?? gradientAngle);

  const renderShape = () => {
    // Circle
    if (type === 'generic.object.circle' || type?.endsWith('.circle')) {
      const r = (Math.min(displayWidth, displayHeight) / 2) - (borderStyle === 'none' ? 0 : strokeWidth / 2);
      const coords = getGradientCoordinates(gradientAngle);
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <circle
            cx={displayWidth / 2}
            cy={displayHeight / 2}
            r={r > 0 ? r : 0}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
        </svg>
      );
    }

    // Triangle
    if (type === 'generic.object.triangle' || type?.endsWith('.triangle')) {
      const coords = getGradientCoordinates(gradientAngle);
      const points = `${displayWidth / 2},${strokeWidth} ${displayWidth - strokeWidth},${displayHeight - strokeWidth} ${strokeWidth},${displayHeight - strokeWidth}`;
      const viewBox: [number, number] = [displayWidth, displayHeight];
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          {roundedEdges ? (
            <path
              d={polygonToRoundedPath(points, undefined, viewBox)}
              fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <polygon
              points={points}
              fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            />
          )}
        </svg>
      );
    }

    // Star (exclude icon/emoji - generic.icon.star is Lucide icon, not polygon)
    if ((type === 'generic.object.star' || type?.endsWith('.star')) && !type?.startsWith('generic.icon.') && !type?.startsWith('generic.emoji.')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${displayWidth / 2},${strokeWidth / 2} 
                L ${displayWidth * 0.61},${displayHeight * 0.38} 
                L ${displayWidth - strokeWidth / 2},${displayHeight * 0.38} 
                L ${displayWidth * 0.68},${displayHeight * 0.62} 
                L ${displayWidth * 0.82},${displayHeight - strokeWidth / 2} 
                L ${displayWidth / 2},${displayHeight * 0.75} 
                L ${displayWidth * 0.18},${displayHeight - strokeWidth / 2} 
                L ${displayWidth * 0.32},${displayHeight * 0.62} 
                L ${strokeWidth / 2},${displayHeight * 0.38} 
                L ${displayWidth * 0.39},${displayHeight * 0.38} Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Cloud (exclude icon/emoji)
    if ((type === 'generic.object.cloud' || type?.endsWith('.cloud')) && !type?.startsWith('generic.icon.') && !type?.startsWith('generic.emoji.')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${displayWidth * 0.1},${displayHeight * 0.5} 
                C ${displayWidth * 0.1},${displayHeight * 0.36} ${displayWidth * 0.15},${displayHeight * 0.24} ${displayWidth * 0.225},${displayHeight * 0.24} 
                C ${displayWidth * 0.25},${displayHeight * 0.16} ${displayWidth * 0.3},${displayHeight * 0.12} ${displayWidth * 0.35},${displayHeight * 0.16} 
                C ${displayWidth * 0.375},${displayHeight * 0.08} ${displayWidth * 0.425},${displayHeight * 0.04} ${displayWidth * 0.475},${displayHeight * 0.08} 
                C ${displayWidth * 0.525},${displayHeight * 0.04} ${displayWidth * 0.575},${displayHeight * 0.08} ${displayWidth * 0.6},${displayHeight * 0.16} 
                C ${displayWidth * 0.65},${displayHeight * 0.12} ${displayWidth * 0.7},${displayHeight * 0.16} ${displayWidth * 0.725},${displayHeight * 0.24} 
                C ${displayWidth * 0.85},${displayHeight * 0.24} ${displayWidth * 0.9},${displayHeight * 0.36} ${displayWidth * 0.9},${displayHeight * 0.5} 
                C ${displayWidth * 0.94},${displayHeight * 0.52} ${displayWidth * 0.96},${displayHeight * 0.58} ${displayWidth * 0.96},${displayHeight * 0.66} 
                C ${displayWidth * 0.96},${displayHeight * 0.74} ${displayWidth * 0.94},${displayHeight * 0.8} ${displayWidth * 0.9},${displayHeight * 0.82} 
                C ${displayWidth * 0.88},${displayHeight * 0.88} ${displayWidth * 0.84},${displayHeight * 0.9} ${displayWidth * 0.8},${displayHeight * 0.86} 
                C ${displayWidth * 0.76},${displayHeight * 0.9} ${displayWidth * 0.72},${displayHeight * 0.86} ${displayWidth * 0.7},${displayHeight * 0.82} 
                C ${displayWidth * 0.66},${displayHeight * 0.84} ${displayWidth * 0.62},${displayHeight * 0.82} ${displayWidth * 0.6},${displayHeight * 0.78} 
                C ${displayWidth * 0.56},${displayHeight * 0.82} ${displayWidth * 0.52},${displayHeight * 0.78} ${displayWidth * 0.5},${displayHeight * 0.74} 
                C ${displayWidth * 0.48},${displayHeight * 0.78} ${displayWidth * 0.44},${displayHeight * 0.74} ${displayWidth * 0.42},${displayHeight * 0.7} 
                C ${displayWidth * 0.38},${displayHeight * 0.72} ${displayWidth * 0.34},${displayHeight * 0.7} ${displayWidth * 0.32},${displayHeight * 0.66} 
                C ${displayWidth * 0.28},${displayHeight * 0.68} ${displayWidth * 0.24},${displayHeight * 0.66} ${displayWidth * 0.225},${displayHeight * 0.62} 
                C ${displayWidth * 0.18},${displayHeight * 0.64} ${displayWidth * 0.14},${displayHeight * 0.58} ${displayWidth * 0.14},${displayHeight * 0.52} 
                C ${displayWidth * 0.14},${displayHeight * 0.5} ${displayWidth * 0.15},${displayHeight * 0.44} ${displayWidth * 0.2},${displayHeight * 0.42} 
                C ${displayWidth * 0.15},${displayHeight * 0.4} ${displayWidth * 0.1},${displayHeight * 0.46} ${displayWidth * 0.1},${displayHeight * 0.5} Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Parallelogram
    if (type === 'generic.object.parallelogram' || type?.endsWith('.parallelogram')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={`${displayWidth * 0.2},${strokeWidth} ${displayWidth - strokeWidth},${strokeWidth} ${displayWidth * 0.8},${displayHeight - strokeWidth} ${strokeWidth},${displayHeight - strokeWidth}`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Chevron
    if (type === 'generic.object.chevron' || type?.endsWith('.chevron')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.3},${strokeWidth} 
                L ${displayWidth - strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.3},${displayHeight - strokeWidth} 
                Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Loop (sequence diagram self-loop - curved path)
    if (type === 'generic.object.loop' || type?.endsWith('.loop')) {
      const lineColor = stroke || '#6b7280';
      const pathD = `M 0 0 C ${displayWidth} 0, ${displayWidth} ${displayHeight}, 0 ${displayHeight}`;
      return (
        <svg {...commonSvgProps}>
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth || 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    // Trapezoid
    if (type === 'generic.object.trapezoid' || type?.endsWith('.trapezoid')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={`${displayWidth * 0.25},${strokeWidth} ${displayWidth * 0.75},${strokeWidth} ${displayWidth - strokeWidth},${displayHeight - strokeWidth} ${strokeWidth},${displayHeight - strokeWidth}`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Kite
    if (type === 'generic.object.kite' || type?.endsWith('.kite')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={`${displayWidth / 2},${strokeWidth} ${displayWidth * 0.75},${displayHeight * 0.4} ${displayWidth / 2},${displayHeight - strokeWidth} ${displayWidth * 0.25},${displayHeight * 0.4}`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Hexagon
    if (type === 'generic.object.hexagon' || type?.endsWith('.hexagon')) {
      const coords = getGradientCoordinates(gradientAngle);
      const hexWidth = displayWidth - strokeWidth;
      const hexHeight = displayHeight - strokeWidth;
      const centerX = hexWidth / 2 + strokeWidth / 2;
      const centerY = hexHeight / 2 + strokeWidth / 2;
      const radius = Math.min(hexWidth, hexHeight) / 2;
      
      const hexPoints = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        hexPoints.push(`${x},${y}`);
      }
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={hexPoints.join(' ')}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Pentagon
    if (type === 'generic.object.pentagon' || type?.endsWith('.pentagon')) {
      const coords = getGradientCoordinates(gradientAngle);
      const pentWidth = displayWidth - strokeWidth;
      const pentHeight = displayHeight - strokeWidth;
      const centerX = pentWidth / 2 + strokeWidth / 2;
      const centerY = pentHeight / 2 + strokeWidth / 2;
      const radius = Math.min(pentWidth, pentHeight) / 2;
      
      const pentPoints = [];
      for (let i = 0; i < 5; i++) {
        const angle = (2 * Math.PI / 5) * i - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        pentPoints.push(`${x},${y}`);
      }
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={pentPoints.join(' ')}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Octagon
    if (type === 'generic.object.octagon' || type?.endsWith('.octagon')) {
      const coords = getGradientCoordinates(gradientAngle);
      const octWidth = displayWidth - strokeWidth;
      const octHeight = displayHeight - strokeWidth;
      const centerX = octWidth / 2 + strokeWidth / 2;
      const centerY = octHeight / 2 + strokeWidth / 2;
      const radius = Math.min(octWidth, octHeight) / 2;
      
      const octPoints = [];
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        octPoints.push(`${x},${y}`);
      }
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={octPoints.join(' ')}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Jigsaw
    if (type === 'generic.object.jigsaw' || type?.endsWith('.jigsaw')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${strokeWidth},${displayHeight * 0.3} 
                Q ${strokeWidth},${displayHeight * 0.1} ${displayWidth * 0.2},${strokeWidth} 
                L ${displayWidth * 0.4},${strokeWidth} 
                Q ${displayWidth * 0.5},${displayHeight * 0.1} ${displayWidth * 0.6},${strokeWidth} 
                L ${displayWidth * 0.8},${strokeWidth} 
                Q ${displayWidth - strokeWidth},${displayHeight * 0.1} ${displayWidth - strokeWidth},${displayHeight * 0.3} 
                L ${displayWidth - strokeWidth},${displayHeight * 0.7} 
                Q ${displayWidth - strokeWidth},${displayHeight * 0.9} ${displayWidth * 0.8},${displayHeight - strokeWidth} 
                L ${displayWidth * 0.6},${displayHeight - strokeWidth} 
                Q ${displayWidth * 0.5},${displayHeight * 0.9} ${displayWidth * 0.4},${displayHeight - strokeWidth} 
                L ${displayWidth * 0.2},${displayHeight - strokeWidth} 
                Q ${strokeWidth},${displayHeight * 0.9} ${strokeWidth},${displayHeight * 0.7} 
                Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Arrowhead
    if (type === 'generic.object.arrowhead' || type?.endsWith('.arrowhead')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.7},${strokeWidth} 
                L ${displayWidth - strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.7},${displayHeight - strokeWidth} 
                Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Rounded Rectangle
    if (type === 'generic.object.rounded-rectangle' || type?.endsWith('.rounded-rectangle')) {
      const coords = getGradientCoordinates(gradientAngle);
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const radius = cr * Math.min(displayWidth, displayHeight) * 0.5; // 0=straight, 1=full pill
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                  <stop offset="0%" stopColor={bgColors[0]} />
                  <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                  <stop offset="0%" stopColor={borderColorArray[0]} />
                  <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={Math.max(0, displayWidth - strokeWidth)}
            height={Math.max(0, displayHeight - strokeWidth)}
            rx={radius}
            ry={radius}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
        </svg>
      );
    }

    // UML Class (rectangle with compartment dividers)
    if (type === 'generic.object.uml-class' || type?.endsWith('.uml-class')) {
      const coords = getGradientCoordinates(gradientAngle);
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <rect
            x={sw / 2}
            y={sw / 2}
            width={Math.max(0, displayWidth - sw)}
            height={Math.max(0, displayHeight - sw)}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={sw}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
          <line x1={sw} y1={displayHeight / 3} x2={displayWidth - sw} y2={displayHeight / 3} stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : effectiveBorderColor} strokeWidth={1} />
          <line x1={sw} y1={(2 * displayHeight) / 3} x2={displayWidth - sw} y2={(2 * displayHeight) / 3} stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : effectiveBorderColor} strokeWidth={1} />
        </svg>
      );
    }

    // Rectangle / Square (Default)
    const coords = getGradientCoordinates(gradientAngle);
    // Calculate borderRadius when roundedEdges is enabled (6% of smaller dimension)
    const borderRadius = roundedEdges ? Math.min(displayWidth, displayHeight) * 0.06 : 0;
    return (
      <svg {...commonSvgProps}>
        <defs>
          {effectiveBackgroundStyle === 'gradient' && (
            <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
            </linearGradient>
          )}
          {borderStyle === 'gradient' && (
            <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
            </linearGradient>
          )}
        </defs>
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={Math.max(0, displayWidth - strokeWidth)}
            height={Math.max(0, displayHeight - strokeWidth)}
            rx={borderRadius}
            ry={borderRadius}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
      </svg>
    );
  };

  return (
    <div 
      className="relative flex items-center justify-center" 
      style={{ 
        width: displayWidth, 
        height: displayHeight,
        filter: shadow ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' : undefined
      }}
    >
      {renderShape()}
      
      {label && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-1">
          <span 
            className="font-medium leading-tight text-center"
            style={{ 
              color: textColor,
              fontFamily,
              fontWeight: fontWeight as any,
              fontStyle: fontStyle as any,
              textDecoration,
              fontSize: `${fontSize}px`,
              textShadow: shadow ? '0 1px 2px rgba(0,0,0,0.3)' : undefined,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
