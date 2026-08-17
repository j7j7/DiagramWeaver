"use client";

import { connectionSolidOutlineStrokeWidth } from "@/lib/selection-highlight-style";

/**
 * Path-following highlight used when Options → Selection Highlight is **Solid outline**.
 * Hidden by CSS in glow mode (`display: none`) so default hover/select filters stay unchanged.
 */
export function ConnectionSolidOutlinePath({
  d,
  lineWidth,
  followShape = false,
}: {
  d: string;
  lineWidth: number;
  /** Filled ribbon / polygon — stroke the silhouette instead of a wide centerline halo. */
  followShape?: boolean;
}) {
  return (
    <path
      d={d}
      className="connection-solid-outline"
      fill="none"
      stroke="var(--dw-selection-outline)"
      strokeWidth={followShape ? 2.5 : connectionSolidOutlineStrokeWidth(lineWidth)}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    />
  );
}
