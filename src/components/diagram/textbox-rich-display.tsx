"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { getTextStylingForNode, getTextJustifyClass } from "@/components/diagram/shapes/shape-utils";

interface TextboxRichDisplayProps {
  node: DiagramNodeData;
  runs: RichTextRun[];
  onDoubleClick: (e: React.MouseEvent) => void;
}

function getLineStyle(run: RichTextRun, node: DiagramNodeData): React.CSSProperties {
  const base = getTextStylingForNode(node);
  const style: React.CSSProperties = { ...base, display: "block" };
  const nodeAny = node as unknown as Record<string, unknown>;
  const align = run.lineJustify ?? nodeAny.textJustify ?? "left";
  style.textAlign = (align === "full" ? "justify" : align) as React.CSSProperties["textAlign"];
  if (run.lineFontSize != null) style.fontSize = `${run.lineFontSize}px`;
  else if (nodeAny.fontSize) style.fontSize = `${nodeAny.fontSize}px`;
  if (run.lineFontWeight != null) style.fontWeight = run.lineFontWeight as React.CSSProperties["fontWeight"];
  else if (nodeAny.fontWeight) style.fontWeight = nodeAny.fontWeight as React.CSSProperties["fontWeight"];
  if (run.lineFontFamily) style.fontFamily = run.lineFontFamily;
  else if (nodeAny.fontFamily) style.fontFamily = nodeAny.fontFamily as string;
  return style;
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
  const lines: { runs: RichTextRun[]; lineFormat: RichTextRun | null }[] = [];
  let currentLine: RichTextRun[] = [];
  let lineFormat: RichTextRun | null = null;

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (run.listType === "bullet" || run.listType === "numbered") {
      if (currentLine.length > 0) {
        lines.push({ runs: currentLine, lineFormat });
        currentLine = [];
        lineFormat = null;
      }
      lines.push({ runs: [run], lineFormat: run });
      if (run.listType === "numbered") numberedIndex++;
      continue;
    }
    if (run.text === "\n") {
      if (currentLine.length > 0) {
        lines.push({ runs: currentLine, lineFormat });
        currentLine = [];
        lineFormat = null;
      }
      lines.push({ runs: [], lineFormat: run });
      continue;
    }
    const parts = run.text.split("\n");
    for (let p = 0; p < parts.length; p++) {
      if (p > 0) {
        if (currentLine.length > 0) {
          lines.push({ runs: currentLine, lineFormat });
          currentLine = [];
          lineFormat = null;
        }
        lines.push({ runs: [], lineFormat: run });
      }
      if (parts[p]) {
        if (currentLine.length === 0) lineFormat = run;
        currentLine.push({ ...run, text: parts[p] });
      }
    }
  }
  if (currentLine.length > 0) {
    lines.push({ runs: currentLine, lineFormat });
  }

  numberedIndex = 0;
  const content = lines.map((line, lineIdx) => {
    if (line.runs.length === 0) {
      return <div key={lineIdx} style={line.lineFormat ? getLineStyle(line.lineFormat, node) : getTextStylingForNode(node)} className="break-words leading-normal whitespace-pre-wrap" />;
    }
    const lineStyle = line.lineFormat ? getLineStyle(line.lineFormat, node) : getTextStylingForNode(node);
    const spans = line.runs.map((run, i) => {
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
      return (
        <span key={i} style={styles}>
          {run.text}
        </span>
      );
    });
    return (
      <div key={lineIdx} style={lineStyle} className="break-words leading-normal whitespace-pre-wrap w-full">
        {spans}
      </div>
    );
  });

  return (
    <div
      className="break-words leading-normal cursor-text hover:bg-background/50 rounded w-full space-y-0.5"
      style={getTextStylingForNode(node)}
      onDoubleClick={onDoubleClick}
    >
      {content}
    </div>
  );
}
