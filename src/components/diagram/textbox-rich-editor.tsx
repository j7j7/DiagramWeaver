"use client";

import React, { useRef, useEffect, useCallback } from "react";
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

/** Vertical overhead: outer p-1 (8) + inner py-0.5 (4) + contentEditable border (2). scrollHeight already includes contentEditable padding. */
const TEXTBOX_CONTENT_OVERHEAD = 14;

interface TextboxRichEditorProps {
  node: DiagramNodeData;
  runs: RichTextRun[];
  onSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  /** Callback when content height changes during edit - for auto-resize. Receives required node height. */
  onHeightChange?: (height: number) => void;
}

export function TextboxRichEditor({
  node,
  runs,
  onSubmit,
  onKeyDown,
  onHeightChange,
}: TextboxRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const rafId = useRef<number | null>(null);
  const lastReportedHeight = useRef<number | null>(null);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;

  useEffect(() => {
    if (!editorRef.current || hasInitialized.current) return;
    editorRef.current.innerHTML = runsToHtml(runs);
    hasInitialized.current = true;
  }, [runs]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  const measureAndReportHeight = useCallback(() => {
    const el = editorRef.current;
    const cb = onHeightChangeRef.current;
    if (!el || !cb) return;
    // Temporarily collapse to force scrollHeight to report content height, not container height
    // (contentEditable can return clientHeight when content fits, causing unbounded growth)
    const prevHeight = el.style.height;
    const prevOverflow = el.style.overflow;
    const prevMinHeight = el.style.minHeight;
    el.style.height = "0px";
    el.style.overflow = "hidden";
    el.style.minHeight = "0";
    const contentHeight = el.scrollHeight;
    el.style.height = prevHeight;
    el.style.overflow = prevOverflow;
    el.style.minHeight = prevMinHeight;
    const required = Math.max(40, TEXTBOX_CONTENT_OVERHEAD + contentHeight);
    if (lastReportedHeight.current === required) return;
    lastReportedHeight.current = required;
    cb(required);
  }, []);

  const scheduleHeightCheck = useCallback(() => {
    if (!onHeightChangeRef.current) return;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      measureAndReportHeight();
    });
  }, [measureAndReportHeight]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || !onHeightChange) return;
    scheduleHeightCheck();
    const mo = new MutationObserver(scheduleHeightCheck);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const onInput = () => scheduleHeightCheck();
    el.addEventListener("input", onInput);
    return () => {
      mo.disconnect();
      el.removeEventListener("input", onInput);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [onHeightChange, scheduleHeightCheck]);

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
    <div className="relative w-full h-full flex flex-col min-h-0">
      {/* Formatting toolbar - positioned OUTSIDE above textbox, so text stays in same place */}
      <div
        className="absolute left-0 bottom-full mb-1 flex gap-0.5 rounded-md border border-border bg-background/95 px-1 py-1 shadow-sm z-10"
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

      {/* contentEditable area - fills same space as display, no layout shift */}
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
        onKeyUp={(e) => {
          if (e.key === "Backspace" || e.key === "Delete") {
            scheduleHeightCheck();
          }
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
