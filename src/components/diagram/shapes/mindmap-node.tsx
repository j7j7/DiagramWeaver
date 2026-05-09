"use client";

import React, { useMemo } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { RoundedRectangleShape } from "./rounded-rectangle";
import { RectangleShape } from "./rectangle";
import { SquareShape } from "./square";
import { CircleShape } from "./circle";
import { TriangleShape } from "./triangle";
import { StarShape } from "./star";
import { HexagonShape } from "./hexagon";
import { PentagonShape } from "./pentagon";
import { OctagonShape } from "./octagon";
import { CloudShape } from "./cloud";
import { ParallelogramShape } from "./parallelogram";
import { TrapezoidShape } from "./trapezoid";
import { KiteShape } from "./kite";
import { resolveMindmapDisplayColors } from "@/lib/mindmap-layout";
import { normalizeCompositeBodyShapeKind } from "@/lib/shape-type-swap";

interface MindmapNodeShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  /** Full diagram nodes — required for root/branch theme-hues cascade to resolve anchor base colors. */
  allMindmapNodes?: DiagramNodeData[];
  tag?: string;
  tagPosition?: string;
  isEditingTag: boolean;
  editTagText: string;
  onTagTextChange: (text: string) => void;
  onTagSubmit: () => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
  label: string;
  isEditingLabel: boolean;
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
}

export function MindmapNodeShape(props: MindmapNodeShapeProps) {
  const { allMindmapNodes, ...shapeRest } = props;
  const displayNode = useMemo(() => {
    const patch = resolveMindmapDisplayColors(props.node, allMindmapNodes);
    if (Object.keys(patch).length === 0) return props.node;
    return { ...props.node, ...patch };
  }, [props.node, allMindmapNodes]);

  const kind = normalizeCompositeBodyShapeKind(displayNode.compositeBodyShape);

  switch (kind) {
    case "rectangle":
      return <RectangleShape {...shapeRest} node={displayNode} />;
    case "square":
      return <SquareShape {...shapeRest} node={displayNode} />;
    case "circle":
      return <CircleShape {...shapeRest} node={displayNode} />;
    case "triangle":
      return <TriangleShape {...shapeRest} node={displayNode} />;
    case "star":
      return <StarShape {...shapeRest} node={displayNode} />;
    case "hexagon":
      return <HexagonShape {...shapeRest} node={displayNode} />;
    case "pentagon":
      return <PentagonShape {...shapeRest} node={displayNode} />;
    case "octagon":
      return <OctagonShape {...shapeRest} node={displayNode} />;
    case "cloud":
      return <CloudShape {...shapeRest} node={displayNode} />;
    case "parallelogram":
      return <ParallelogramShape {...shapeRest} node={displayNode} />;
    case "trapezoid":
      return <TrapezoidShape {...shapeRest} node={displayNode} />;
    case "kite":
      return <KiteShape {...shapeRest} node={displayNode} />;
    case "rounded-rectangle":
      return <RoundedRectangleShape {...shapeRest} node={displayNode} />;
  }
}
