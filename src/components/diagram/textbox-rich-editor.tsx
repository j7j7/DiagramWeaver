"use client";

import React, { useRef, useEffect } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import {
  runsToHtml,
  htmlToRuns,
  getPlainTextFromRuns,
  normalizeRuns,
} from "@/lib/rich-text";
import { getTextStylingForNode, getTextJustifyClass } from "@/components/diagram/shapes/shape-utils";
import { cn } from "@/lib/utils";

interface TextboxRichEditorProps {
  node: DiagramNodeData;
  runs: RichTextRun[];
  onSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

export function TextboxRichEditor({
  node,
  runs,
  onSubmit,
  onKeyDown,
}: TextboxRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!editorRef.current || hasInitialized.current) return;
    editorRef.current.innerHTML = runsToHtml(runs);
    hasInitialized.current = true;
  }, [runs]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  const handleBlur = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const rawRuns = htmlToRuns(html);
    const normRuns = normalizeRuns(rawRuns);
    const plainText = getPlainTextFromRuns(normRuns);
    onSubmit(plainText, normRuns);
  };

  const applyFormat = (command: "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const nodeAny = node as unknown as Record<string, unknown>;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Formatting toolbar - use onMouseDown so selection stays in contentEditable */}
      <div
        className="flex gap-0.5 pb-1 shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          title="Bold"
          onMouseDown={(e) => applyFormat("bold", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Italic"
          onMouseDown={(e) => applyFormat("italic", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Underline"
          onMouseDown={(e) => applyFormat("underline", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Bullet list"
          onMouseDown={(e) => applyFormat("insertUnorderedList", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Numbered list"
          onMouseDown={(e) => applyFormat("insertOrderedList", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* contentEditable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleBlur();
            return;
          }
          onKeyDown(e);
        }}
        data-placeholder="Enter text..."
        className={cn(
          "text-sm font-medium flex-1 min-h-0 overflow-auto outline-none rounded px-2 py-1",
          "border border-primary rounded whitespace-pre-wrap break-words leading-normal",
          getTextJustifyClass((nodeAny.textJustify as string) || "left")
        )}
        style={{
          ...getTextStylingForNode(node),
          display: "block", // Keep inline text flowing; flex would break runs into separate items
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
