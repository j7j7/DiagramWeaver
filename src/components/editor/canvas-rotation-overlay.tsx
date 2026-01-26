"use client";

import React from 'react';
import { RotateCw } from 'lucide-react';
import type { Transform } from '@/hooks/use-canvas-transform';

interface CanvasRotationOverlayProps {
  transform: Transform;
  targetBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotation: number; // Current rotation in degrees
  isDragging: boolean;
  dragRotation?: number; // Current rotation during drag (if different from rotation)
  onHandlePointerDown: (e: React.PointerEvent, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => void;
}

export function CanvasRotationOverlay({
  transform,
  targetBounds,
  rotation,
  isDragging,
  dragRotation,
  onHandlePointerDown,
}: CanvasRotationOverlayProps) {
  // Calculate center point in diagram space
  const centerX = targetBounds.x + targetBounds.width / 2;
  const centerY = targetBounds.y + targetBounds.height / 2;

  // Convert center to screen space
  const screenCenterX = centerX * transform.k + transform.x;
  const screenCenterY = centerY * transform.k + transform.y;

  // Current rotation (use dragRotation if dragging, otherwise use rotation)
  const currentRotation = isDragging && dragRotation !== undefined ? dragRotation : rotation;

  // Calculate top-left corner offset in diagram space (before rotation)
  const halfWidth = targetBounds.width / 2;
  const halfHeight = targetBounds.height / 2;
  const topLeftOffset = { x: -halfWidth, y: -halfHeight };

  // Rotate corner offset by current rotation
  const rotatePoint = (x: number, y: number, angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    };
  };

  // Calculate top-left corner position in diagram space (rotated)
  const rotatedTopLeft = rotatePoint(topLeftOffset.x, topLeftOffset.y, currentRotation);
  const topLeftCorner = {
    x: centerX + rotatedTopLeft.x,
    y: centerY + rotatedTopLeft.y,
  };

  // Convert to screen space
  const screenTopLeft = {
    x: topLeftCorner.x * transform.k + transform.x,
    y: topLeftCorner.y * transform.k + transform.y,
  };

  // Calculate HUD circle radius (based on largest dimension, scaled by zoom)
  const maxDimension = Math.max(targetBounds.width, targetBounds.height);
  const hudRadius = Math.max(60, Math.min(120, maxDimension * transform.k * 0.6));

  // Handle size in screen pixels (constant size regardless of zoom)
  const handleSize = 24;

  return (
    <>
      {/* Top-left rotation handle */}
      <button
        type="button"
        className="absolute pointer-events-auto cursor-grab active:cursor-grabbing z-[90] rounded-full bg-green-500/30 hover:bg-green-500/50 border-2 border-green-500/70 hover:border-green-500 transition-all flex items-center justify-center"
        style={{
          left: `${screenTopLeft.x - handleSize / 2}px`,
          top: `${screenTopLeft.y - handleSize / 2}px`,
          width: `${handleSize}px`,
          height: `${handleSize}px`,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onHandlePointerDown(e, 'top-left');
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
        }}
        aria-label="Rotate"
      >
        <RotateCw className="w-4 h-4 text-green-700" />
      </button>

      {/* Green angle HUD (only while dragging) */}
      {isDragging && (
        <div
          className="absolute pointer-events-none z-[89]"
          style={{
            left: `${screenCenterX - hudRadius}px`,
            top: `${screenCenterY - hudRadius}px`,
            width: `${hudRadius * 2}px`,
            height: `${hudRadius * 2}px`,
          }}
        >
          <svg
            width={hudRadius * 2}
            height={hudRadius * 2}
            className="overflow-visible"
          >
            {/* Circle outline */}
            <circle
              cx={hudRadius}
              cy={hudRadius}
              r={hudRadius - 2}
              fill="none"
              stroke="rgba(34, 197, 94, 0.4)" // green-500 with opacity
              strokeWidth="2"
            />

            {/* Tick marks every 5 degrees */}
            {Array.from({ length: 72 }, (_, i) => {
              const angle = i * 5; // 0, 5, 10, ..., 355
              const angleRad = (angle * Math.PI) / 180;
              const innerRadius = hudRadius - 8;
              const outerRadius = hudRadius - 2;
              
              const x1 = hudRadius + Math.cos(angleRad) * innerRadius;
              const y1 = hudRadius + Math.sin(angleRad) * innerRadius;
              const x2 = hudRadius + Math.cos(angleRad) * outerRadius;
              const y2 = hudRadius + Math.sin(angleRad) * outerRadius;

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(34, 197, 94, 0.5)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Current angle indicator line */}
            {(() => {
              const angleRad = (currentRotation * Math.PI) / 180;
              const lineLength = hudRadius - 4;
              const x2 = hudRadius + Math.cos(angleRad) * lineLength;
              const y2 = hudRadius + Math.sin(angleRad) * lineLength;

              return (
                <line
                  x1={hudRadius}
                  y1={hudRadius}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(34, 197, 94, 0.9)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              );
            })()}
          </svg>

          {/* Central angle text */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              fontSize: `${Math.max(16, hudRadius * 0.25)}px`,
              fontWeight: 'bold',
              color: 'rgba(34, 197, 94, 0.9)',
              textShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
            }}
          >
            {Math.round(currentRotation)}°
          </div>
        </div>
      )}
    </>
  );
}
