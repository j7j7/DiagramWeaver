"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { ShapeWrapper } from "./shape-wrapper";

interface CircleShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
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
  editText: string;
  onLabelTextChange: (text: string) => void;
  onLabelSubmit: () => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

export function CircleShape(props: CircleShapeProps) {
  return (
    <ShapeWrapper
      {...props}
      defaultWidth={60}
      defaultHeight={60}
      borderRadius="50%"
    />
  );
}
