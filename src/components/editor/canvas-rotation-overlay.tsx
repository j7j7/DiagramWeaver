"use client";

import React from "react";
import type { Transform } from "@/hooks/use-canvas-transform";

/**
 * Screen-space angle HUD while rotating (handle lives on the node — see RotationHandle).
 * Fine ticks every 5°; 45° and 90° multiples are emphasized. With Shift, only 45° increments
 * are used for snapping and the dial shows coarse ticks only.
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
  /** When true, user is in Shift mode (45° snap) — HUD shows only 45° markers */
  shiftKey?: boolean;
}

export function CanvasRotationOverlay({
  transform,
  targetBounds,
  rotationDegrees,
  shiftKey = false,
}: CanvasRotationOverlayProps) {
  const centerX = targetBounds.x + targetBounds.width / 2;
  const centerY = targetBounds.y + targetBounds.height / 2;

  const screenCenterX = centerX * transform.k + transform.x;
  const screenCenterY = centerY * transform.k + transform.y;

  const maxDimension = Math.max(targetBounds.width, targetBounds.height);
  const hudRadius = Math.max(60, Math.min(120, maxDimension * transform.k * 0.6));

  const currentRotation = rotationDegrees;

  const tickLine = (
    angleDeg: number,
    innerR: number,
    outerR: number,
    strokeWidth: number,
    stroke: string
  ) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const x1 = hudRadius + Math.cos(angleRad) * innerR;
    const y1 = hudRadius + Math.sin(angleRad) * innerR;
    const x2 = hudRadius + Math.cos(angleRad) * outerR;
    const y2 = hudRadius + Math.sin(angleRad) * outerR;
    return (
      <line
        key={`tick-${angleDeg}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    );
  };

  const renderFineTicks = () => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i < 72; i++) {
      const angleDeg = i * 5;
      const isCardinal = angleDeg % 90 === 0;
      const isHalfDiagonal = angleDeg % 45 === 0 && !isCardinal;

      if (isCardinal) {
        lines.push(
          tickLine(
            angleDeg,
            hudRadius - 22,
            hudRadius - 1,
            3.2,
            "rgba(34, 197, 94, 0.95)"
          )
        );
      } else if (isHalfDiagonal) {
        lines.push(
          tickLine(
            angleDeg,
            hudRadius - 16,
            hudRadius - 2,
            2.2,
            "rgba(34, 197, 94, 0.82)"
          )
        );
      } else {
        lines.push(
          tickLine(
            angleDeg,
            hudRadius - 10,
            hudRadius - 5,
            0.9,
            "rgba(34, 197, 94, 0.28)"
          )
        );
      }
    }
    return lines;
  };

  const renderShiftOnlyTicks = () => {
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    return angles.map((angleDeg) => {
      const isCardinal = angleDeg % 90 === 0;
      return isCardinal
        ? tickLine(
            angleDeg,
            hudRadius - 24,
            hudRadius - 1,
            3.5,
            "rgba(34, 197, 94, 0.98)"
          )
        : tickLine(
            angleDeg,
            hudRadius - 18,
            hudRadius - 2,
            2.8,
            "rgba(34, 197, 94, 0.88)"
          );
    });
  };

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
          stroke="rgba(34, 197, 94, 0.45)"
          strokeWidth="2"
        />

        {shiftKey ? renderShiftOnlyTicks() : renderFineTicks()}

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
              stroke="rgba(34, 197, 94, 0.95)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          );
        })()}
      </svg>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
        style={{
          fontSize: `${Math.max(16, hudRadius * 0.25)}px`,
          fontWeight: "bold",
          color: "rgba(34, 197, 94, 0.95)",
          textShadow: "0 0 4px rgba(255, 255, 255, 0.8)",
        }}
      >
        <span>{Math.round(currentRotation)}°</span>
        {shiftKey && (
          <span
            className="font-semibold opacity-90"
            style={{ fontSize: `${Math.max(11, hudRadius * 0.14)}px` }}
          >
            45° snap
          </span>
        )}
      </div>
    </div>
  );
}
