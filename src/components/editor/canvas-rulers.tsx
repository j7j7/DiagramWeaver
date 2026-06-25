"use client";

import React, { useMemo } from "react";

interface CanvasRulersProps {
  transform: { x: number; y: number; k: number };
  canvasWidth: number;
  canvasHeight: number;
  rulerSize?: number;
  /** Horizontal inset so rulers sit to the right of the component sidebar overlay. */
  leftOffset?: number;
}

const RULER_SIZE = 24; // Height of horizontal ruler, width of vertical ruler

export function CanvasRulers({ 
  transform, 
  canvasWidth, 
  canvasHeight,
  rulerSize = RULER_SIZE,
  leftOffset = 0,
}: CanvasRulersProps) {
  // Calculate the visible range in canvas coordinates
  // The canvas content starts at screen (0,0) and has transform applied
  // So screen (0,0) maps to canvas (-transform.x / transform.k, -transform.y / transform.k)
  // Account for 10px offset to align with grid dots (add offset to correct ruler reading)
  const offset = 10;
  const visibleLeft = (-transform.x / transform.k) + offset;
  const visibleRight = visibleLeft + canvasWidth / transform.k;
  const visibleTop = (-transform.y / transform.k) + offset;
  const visibleBottom = visibleTop + canvasHeight / transform.k;

  // Calculate tick spacing based on zoom level
  // At zoom 1.0, we want ticks every 50px
  // As we zoom in, we want more ticks (smaller spacing)
  // As we zoom out, we want fewer ticks (larger spacing)
  const baseTickSpacing = 50;
  const tickSpacing = baseTickSpacing / transform.k;
  
  // Adjust tick spacing to reasonable values (10, 20, 50, 100, 200, 500, etc.)
  const getTickSpacing = (spacing: number): number => {
    if (spacing <= 10) return 10;
    if (spacing <= 20) return 20;
    if (spacing <= 50) return 50;
    if (spacing <= 100) return 100;
    if (spacing <= 200) return 200;
    if (spacing <= 500) return 500;
    return Math.round(spacing / 100) * 100;
  };

  const adjustedTickSpacing = getTickSpacing(tickSpacing);

  // Generate tick marks for horizontal ruler
  const horizontalTicks = useMemo(() => {
    const ticks: Array<{ position: number; value: number; isMajor: boolean }> = [];
    const startTick = Math.floor(visibleLeft / adjustedTickSpacing) * adjustedTickSpacing;
    const endTick = Math.ceil(visibleRight / adjustedTickSpacing) * adjustedTickSpacing;
    
    for (let tick = startTick; tick <= endTick; tick += adjustedTickSpacing) {
      const position = (tick - visibleLeft) * transform.k;
      ticks.push({
        position,
        value: tick,
        isMajor: true,
      });
    }
    
    // Add minor ticks (halfway between major ticks) if zoomed in enough
    if (adjustedTickSpacing <= 50) {
      const minorTicks: Array<{ position: number; value: number; isMajor: boolean }> = [];
      for (let tick = startTick; tick <= endTick; tick += adjustedTickSpacing) {
        const minorTick = tick + adjustedTickSpacing / 2;
        if (minorTick >= visibleLeft && minorTick <= visibleRight) {
          const position = (minorTick - visibleLeft) * transform.k;
          minorTicks.push({
            position,
            value: minorTick,
            isMajor: false,
          });
        }
      }
      ticks.push(...minorTicks);
      ticks.sort((a, b) => a.position - b.position);
    }
    
    return ticks;
  }, [visibleLeft, visibleRight, transform.k, adjustedTickSpacing]);

  // Generate tick marks for vertical ruler
  const verticalTicks = useMemo(() => {
    const ticks: Array<{ position: number; value: number; isMajor: boolean }> = [];
    const startTick = Math.floor(visibleTop / adjustedTickSpacing) * adjustedTickSpacing;
    const endTick = Math.ceil(visibleBottom / adjustedTickSpacing) * adjustedTickSpacing;
    
    for (let tick = startTick; tick <= endTick; tick += adjustedTickSpacing) {
      const position = (tick - visibleTop) * transform.k;
      ticks.push({
        position,
        value: tick,
        isMajor: true,
      });
    }
    
    // Add minor ticks (halfway between major ticks) if zoomed in enough
    if (adjustedTickSpacing <= 50) {
      const minorTicks: Array<{ position: number; value: number; isMajor: boolean }> = [];
      for (let tick = startTick; tick <= endTick; tick += adjustedTickSpacing) {
        const minorTick = tick + adjustedTickSpacing / 2;
        if (minorTick >= visibleTop && minorTick <= visibleBottom) {
          const position = (minorTick - visibleTop) * transform.k;
          minorTicks.push({
            position,
            value: minorTick,
            isMajor: false,
          });
        }
      }
      ticks.push(...minorTicks);
      ticks.sort((a, b) => a.position - b.position);
    }
    
    return ticks;
  }, [visibleTop, visibleBottom, transform.k, adjustedTickSpacing]);

  return (
    <>
      {leftOffset > 0 && (
        <div
          className="absolute top-0 left-0 bg-muted/50 border-b border-border z-50 pointer-events-none"
          style={{
            height: `${rulerSize}px`,
            width: `${leftOffset}px`,
          }}
        />
      )}
      {/* Horizontal ruler (top) */}
      <div
        className="absolute top-0 bg-muted/50 border-b border-r border-border z-50 pointer-events-none"
        style={{ 
          height: `${rulerSize}px`,
          width: `${rulerSize}px`,
          left: `${leftOffset}px`,
        }}
      />
      <div
        className="absolute top-0 bg-muted/50 border-b border-border z-50 pointer-events-none"
        style={{ 
          height: `${rulerSize}px`,
          left: `${leftOffset + rulerSize}px`,
          right: 0
        }}
      >
        <svg
          width="100%"
          height={rulerSize}
          className="absolute top-0 left-0"
          style={{ display: 'block' }}
        >
          {horizontalTicks.map((tick, index) => (
            <g key={`h-${tick.value}-${index}`}>
              <line
                x1={tick.position}
                y1={tick.isMajor ? 0 : rulerSize * 0.6}
                x2={tick.position}
                y2={rulerSize}
                stroke="currentColor"
                strokeWidth={tick.isMajor ? 1 : 0.5}
                className="text-muted-foreground"
                opacity={tick.isMajor ? 1 : 0.6}
              />
              {tick.isMajor && (
                <text
                  x={tick.position}
                  y={rulerSize - 4}
                  fontSize="10"
                  fill="currentColor"
                  className="text-muted-foreground"
                  textAnchor="middle"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {Math.round(tick.value)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Vertical ruler (left) */}
      <div
        className="absolute top-0 bg-muted/50 border-r border-border z-50 pointer-events-none"
        style={{ 
          width: `${rulerSize}px`,
          left: `${leftOffset}px`,
          top: `${rulerSize}px`,
          bottom: 0
        }}
      >
        <svg
          width={rulerSize}
          height="100%"
          className="absolute top-0 left-0"
          style={{ display: 'block' }}
        >
          {verticalTicks.map((tick, index) => (
            <g key={`v-${tick.value}-${index}`}>
              <line
                x1={tick.isMajor ? 0 : rulerSize * 0.6}
                y1={tick.position}
                x2={rulerSize}
                y2={tick.position}
                stroke="currentColor"
                strokeWidth={tick.isMajor ? 1 : 0.5}
                className="text-muted-foreground"
                opacity={tick.isMajor ? 1 : 0.6}
              />
              {tick.isMajor && (
                <text
                  x={rulerSize - 4}
                  y={tick.position}
                  fontSize="10"
                  fill="currentColor"
                  className="text-muted-foreground"
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {Math.round(tick.value)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

    </>
  );
}

