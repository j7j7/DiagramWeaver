"use client";

import React from "react";
import { Label } from "@/components/ui/label";

const ANGLE_OPTIONS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const RADIUS = 20;
const CENTER = 24;

/** Normalize angle to 0-360 and snap to nearest 45° for display */
function snapToNearest45(angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  const nearest = ANGLE_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - a) < Math.abs(prev - a) ? curr : prev
  );
  return nearest;
}

/** Convert degrees to radians (0° = right, 90° = down) */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

interface GradientAnglePickerProps {
  value: number;
  onChange: (angle: number) => void;
  label?: string;
}

export function GradientAnglePicker({ value, onChange, label = "Direction" }: GradientAnglePickerProps) {
  const displayAngle = snapToNearest45(value);
  const rad = degToRad(displayAngle);
  const endX = CENTER + RADIUS * Math.cos(rad);
  const endY = CENTER + RADIUS * Math.sin(rad);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - CENTER;
    const y = e.clientY - rect.top - CENTER;
    let angle = (Math.atan2(y, x) * 180) / Math.PI;
    angle = ((angle % 360) + 360) % 360;
    const snapped = snapToNearest45(angle);
    onChange(snapped);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-xs text-slate-600">{label}</Label>}
      <svg
        width={48}
        height={48}
        className="cursor-pointer"
        onClick={handleClick}
        role="slider"
        aria-label={`Gradient angle: ${displayAngle} degrees`}
      >
        {/* 45° tick marks */}
        {ANGLE_OPTIONS.map((angle) => {
          const r = degToRad(angle);
          const innerR = RADIUS - 3;
          const outerR = RADIUS;
          const x1 = CENTER + innerR * Math.cos(r);
          const y1 = CENTER + innerR * Math.sin(r);
          const x2 = CENTER + outerR * Math.cos(r);
          const y2 = CENTER + outerR * Math.sin(r);
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={1}
              className="text-slate-300"
            />
          );
        })}
        {/* Angle indicator line */}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={endX}
          y2={endY}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="text-emerald-600"
        />
        {/* Center dot */}
        <circle cx={CENTER} cy={CENTER} r={2} fill="currentColor" className="text-slate-400" />
      </svg>
    </div>
  );
}
