"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { resolveBorderColorMode } from "@/lib/border-theme";
import { getBorderTemplate } from "@/lib/border-templates";
import { getBorderTemplateIdFromNodeType } from "@/lib/border-utils";
import { BorderArtContent } from "./border-art";
import { SvgShapeBase } from "./svg-shape-base";

interface BorderShapeProps {
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
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
  overrideWidth?: number;
  overrideHeight?: number;
}

export function BorderShape(props: BorderShapeProps) {
  const templateId =
    getBorderTemplateIdFromNodeType(props.node.type) ??
    props.node.border?.templateId ??
    "corner-diagonal-accent";
  const template = getBorderTemplate(templateId);
  const colorMode = resolveBorderColorMode(props.node.border?.colorMode);

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 24 24"
      preserveAspectRatio="none"
      defaultWidth={template?.defaultWidth ?? 960}
      defaultHeight={template?.defaultHeight ?? 540}
      omitShapeText
      svgContent={
        <BorderArtContent
          templateId={templateId}
          colorMode={colorMode}
          rolePaints={props.node.border?.rolePaints}
        />
      }
    />
  );
}
