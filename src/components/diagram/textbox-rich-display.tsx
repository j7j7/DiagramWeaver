"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { getTextStylingForNode, getTextJustifyClass } from "@/components/diagram/shapes/shape-utils";

interface TextboxRichDisplayProps {
  node: DiagramNodeData;
  runs: RichTextRun[];
  onDoubleClick: (e: React.MouseEvent) => void;
}

export function TextboxRichDisplay({
  node,
  runs,
  onDoubleClick,
}: TextboxRichDisplayProps) {
  const nodeAny = node as unknown as Record<string, unknown>;

  if (runs.length === 0) {
    return (
      <p
        className={`${getTextJustifyClass((nodeAny.textJustify as string) || "left")} break-words leading-normal cursor-text hover:bg-background/50 rounded whitespace-pre-wrap w-full text-muted-foreground`}
        style={{ ...getTextStylingForNode(node), display: "block" }}
        onDoubleClick={onDoubleClick}
      >
        Enter text...
      </p>
    );
  }

  let numberedIndex = 0;
  const content = runs.map((run, i) => {
    const styles: React.CSSProperties = {};
    if (run.bold) styles.fontWeight = "bold";
    if (run.italic) styles.fontStyle = "italic";
    if (run.underline) styles.textDecoration = "underline";

    if (run.listType === "bullet") {
      numberedIndex = 0;
      return (
        <span key={i} style={styles}>
          • {run.text}{"\n"}
        </span>
      );
    }
    if (run.listType === "numbered") {
      numberedIndex++;
      return (
        <span key={i} style={styles}>
          {numberedIndex}. {run.text}{"\n"}
        </span>
      );
    }
    numberedIndex = 0;
    return (
      <span key={i} style={styles}>
        {run.text}
      </span>
    );
  });

  return (
    <p
      className={`${getTextJustifyClass((nodeAny.textJustify as string) || "left")} break-words leading-normal cursor-text hover:bg-background/50 rounded whitespace-pre-wrap w-full`}
      style={{ ...getTextStylingForNode(node), display: "block" }}
      onDoubleClick={onDoubleClick}
    >
      {content}
    </p>
  );
}
