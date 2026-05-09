"use client";

import React, { useMemo } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { RoundedRectangleShape } from "./rounded-rectangle";
import { resolveMindmapDisplayColors } from "@/lib/mindmap-layout";

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
}

export function MindmapNodeShape(props: MindmapNodeShapeProps) {
  const { allMindmapNodes, ...shapeRest } = props;
  const displayNode = useMemo(() => {
    const patch = resolveMindmapDisplayColors(props.node, allMindmapNodes);
    if (Object.keys(patch).length === 0) return props.node;
    return { ...props.node, ...patch };
  }, [props.node, allMindmapNodes]);
  return <RoundedRectangleShape {...shapeRest} node={displayNode} />;
}
