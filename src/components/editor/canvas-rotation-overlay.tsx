"use client";

import React from "react";
import type { Transform } from "@/hooks/use-canvas-transform";

/**
 * Screen-space angle HUD while rotating (handle lives on the node — see RotationHandle).
 */
interface CanvasRotationOverlayProps {
  transform: Transform;
  targetBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Rotation in degrees to display (typically live value during drag) */
  rotationDegrees: number;
}

export function CanvasRotationOverlay({
  transform,
  targetBounds,
  rotationDegrees,
}: CanvasRotationOverlayProps) {
  const centerX = targetBounds.x + targetBounds.width / 2;
  const centerY = targetBounds.y + targetBounds.height / 2;

  const screenCenterX = centerX * transform.k + transform.x;
  const screenCenterY = centerY * transform.k + transform.y;

  const maxDimension = Math.max(targetBounds.width, targetBounds.height);
  const hudRadius = Math.max(60, Math.min(120, maxDimension * transform.k * 0.6));

  const currentRotation = rotationDegrees;

  return (
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
        <circle
          cx={hudRadius}
          cy={hudRadius}
          r={hudRadius - 2}
          fill="none"
          stroke="rgba(34, 197, 94, 0.4)"
          strokeWidth="2"
        />

        {Array.from({ length: 72 }, (_, i) => {
          const angle = i * 5;
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

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontSize: `${Math.max(16, hudRadius * 0.25)}px`,
          fontWeight: "bold",
          color: "rgba(34, 197, 94, 0.9)",
          textShadow: "0 0 4px rgba(255, 255, 255, 0.8)",
        }}
      >
        {Math.round(currentRotation)}°
      </div>
    </div>
  );
}
