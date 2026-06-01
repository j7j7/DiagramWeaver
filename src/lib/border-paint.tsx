import React from "react";
import type { BorderRolePaint } from "@/lib/border-types";
import { getGradientCoordinates } from "@/components/diagram/shapes/shape-utils";

export function normalizeBorderRolePaint(paint: BorderRolePaint): BorderRolePaint {
  const style = paint.style ?? "solid";
  if (style === "gradient" && paint.colors?.length === 2) {
    return {
      style: "gradient",
      colors: paint.colors,
      angle: paint.angle ?? 135,
    };
  }
  return {
    style: "solid",
    color: paint.color ?? "#888888",
  };
}

export function borderRoleFillRef(uid: string, roleId: string, paint: BorderRolePaint): string {
  const normalized = normalizeBorderRolePaint(paint);
  if (normalized.style === "gradient" && normalized.colors) {
    return `url(#${uid}-${roleId})`;
  }
  return normalized.color ?? "#888888";
}

export function borderRoleGradientDefs(
  uid: string,
  roles: Record<string, BorderRolePaint>,
): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  for (const [roleId, paint] of Object.entries(roles)) {
    const normalized = normalizeBorderRolePaint(paint);
    if (normalized.style !== "gradient" || !normalized.colors) continue;
    const { x1, y1, x2, y2 } = getGradientCoordinates(normalized.angle ?? 135);
    const id = `${uid}-${roleId}`;
    nodes.push(
      <linearGradient key={id} id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
        <stop offset="0%" stopColor={normalized.colors[0]} />
        <stop offset="100%" stopColor={normalized.colors[1]} />
      </linearGradient>,
    );
  }
  if (nodes.length === 0) return null;
  return <defs>{nodes}</defs>;
}

export function borderRadialGradientDef(
  uid: string,
  roleId: string,
  inner: string,
  outer: string,
): { defs: React.ReactNode; fill: string } {
  const id = `${uid}-${roleId}-radial`;
  return {
    fill: `url(#${id})`,
    defs: (
      <radialGradient id={id} cx="70%" cy="70%" r="70%">
        <stop offset="0%" stopColor={inner} />
        <stop offset="100%" stopColor={outer} />
      </radialGradient>
    ),
  };
}
