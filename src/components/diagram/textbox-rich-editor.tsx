"use client";

import React, { useRef, useEffect, useCallback, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUp, Circle, ArrowDown } from "lucide-react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import {
  runsToHtml,
  htmlToRuns,
  getPlainTextFromRuns,
  normalizeRuns,
} from "@/lib/rich-text";
import { DEFAULT_TEXT_STYLING } from "@/lib/text-styling";
import { getTextStylingForNode, getTextJustifyClass } from "@/components/diagram/shapes/shape-utils";
import { cn } from "@/lib/utils";

const DEFAULT_JUSTIFY = DEFAULT_TEXT_STYLING.textJustify ?? "center";

/** Above interleaved connection label layers and other canvas chrome so the format bar is never covered. */
const TEXTBOX_RICH_TOOLBAR_Z_INDEX = 10_050;

/** Vertical overhead: outer p-1 (8) + inner py-0.5 (4) + contentEditable border (2). scrollHeight includes contentEditable padding (py-0.5 = 4). */
const TEXTBOX_CONTENT_OVERHEAD = 14;

const FONT_SIZES = [12, 14, 16, 18, 20, 24] as const;

function parsePxFontSize(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) && px > 0 ? Math.round(px) : null;
}

/** Font size on the block containing `start` (inline style, else computed). */
function readBlockFontSize(start: Node | null, editor: HTMLElement): number | null {
  let block: Node | null = start;
  while (block && block !== editor) {
    if (block.nodeType === Node.ELEMENT_NODE) {
      const el = block as HTMLElement;
      if (["DIV", "P", "LI"].includes(el.tagName)) {
        return parsePxFontSize(el.style.fontSize) ?? parsePxFontSize(getComputedStyle(el).fontSize);
      }
    }
    block = block.parentElement;
  }
  return null;
}

interface TextboxRichEditorProps {
  node: DiagramNodeData;
  runs: RichTextRun[];
  onSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  /** Callback when content height changes during edit - for auto-resize. Receives required node height. */
  onHeightChange?: (height: number) => void;
  /** Callback when vertical alignment changes (top/middle/bottom). Updates node textVerticalPosition. */
  onVerticalAlignChange?: (position: 'top' | 'middle' | 'bottom') => void;
  /**
   * When the editor is inside a rotated container (e.g. left/right heading strip), counter-rotate the
   * formatting bar so it stays horizontal on screen. Degrees: opposite of the container’s rotation.
   */
  toolbarCounterRotationDeg?: number;
  /**
   * Optional anchor element (e.g. absolutely positioned above a heading strip). The toolbar is portaled to
   * `document.body` and positioned from this element’s bounding rect so it stays above canvas stacking.
   */
  toolbarPortalHost?: HTMLElement | null;
  /** When true, use `toolbarPortalHost` for toolbar position (or hide until the host mounts). */
  toolbarPinToShapeTop?: boolean;
  /**
   * Legacy: the toolbar is always portaled to `document.body` when visible (except the brief moment before
   * a pin host mounts). Kept for call-site compatibility.
   */
  toolbarFixedToViewport?: boolean;
}

export function TextboxRichEditor({
  node,
  runs,
  onSubmit,
  onKeyDown,
  onHeightChange,
  onVerticalAlignChange,
  toolbarCounterRotationDeg,
  toolbarPortalHost,
  toolbarPinToShapeTop,
  toolbarFixedToViewport: _toolbarFixedToViewport = false,
}: TextboxRichEditorProps) {
  void _toolbarFixedToViewport;
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const submitFlushedRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const nodeForHtmlRef = useRef(node);
  nodeForHtmlRef.current = node;
  const rafId = useRef<number | null>(null);
  const lastReportedHeight = useRef<number | null>(null);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;

  const isWithinEditorChrome = useCallback((node: Node | null) => {
    if (!node) return false;
    return Boolean(rootRef.current?.contains(node) || toolbarRef.current?.contains(node));
  }, []);

  const useShapeTopToolbar = toolbarPinToShapeTop === true;
  /** `pin` without a host still mounts — hide bar until the host ref is set. */
  const toolbarUsesBodyPortal = !useShapeTopToolbar || Boolean(toolbarPortalHost);

  const [floatingToolbarAnchor, setFloatingToolbarAnchor] = useState<{ cx: number; top: number } | null>(null);
  const [customFontSize, setCustomFontSize] = useState("");
  const savedFontSizeRangeRef = useRef<Range | null>(null);

  const updateFloatingToolbarAnchor = useCallback(() => {
    if (!toolbarUsesBodyPortal) return;
    const el =
      useShapeTopToolbar && toolbarPortalHost ? toolbarPortalHost : rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFloatingToolbarAnchor({ cx: r.left + r.width / 2, top: r.top });
  }, [toolbarUsesBodyPortal, useShapeTopToolbar, toolbarPortalHost]);

  useLayoutEffect(() => {
    if (!toolbarUsesBodyPortal) return;
    updateFloatingToolbarAnchor();
    const onScrollOrResize = () => updateFloatingToolbarAnchor();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    const ro = new ResizeObserver(onScrollOrResize);
    const anchorEl =
      useShapeTopToolbar && toolbarPortalHost ? toolbarPortalHost : rootRef.current;
    if (anchorEl) ro.observe(anchorEl);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      ro.disconnect();
    };
  }, [toolbarUsesBodyPortal, useShapeTopToolbar, toolbarPortalHost, updateFloatingToolbarAnchor]);

  useEffect(() => {
    if (!toolbarUsesBodyPortal) return;
    const el = editorRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      updateFloatingToolbarAnchor();
      if (document.activeElement === el) {
        raf = requestAnimationFrame(tick);
      }
    };
    const onFocus = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onBlur = () => cancelAnimationFrame(raf);
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    if (document.activeElement === el) onFocus();
    return () => {
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      cancelAnimationFrame(raf);
    };
  }, [toolbarUsesBodyPortal, updateFloatingToolbarAnchor]);

  const syncCustomFontSizeFromSelection = useCallback(() => {
    const active = document.activeElement;
    // Don't overwrite while the user is typing in the custom size field.
    if (active instanceof HTMLInputElement && toolbarRef.current?.contains(active)) return;

    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    let size: number | null = null;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      size = readBlockFontSize(sel.anchorNode, editor);
    }
    if (size == null) {
      const first = editor.querySelector("div, p, li");
      if (first) size = readBlockFontSize(first, editor);
    }
    if (size == null) {
      const nodeFs = Number((node as { fontSize?: number }).fontSize);
      if (Number.isFinite(nodeFs) && nodeFs > 0) size = Math.round(nodeFs);
    }
    if (size != null) setCustomFontSize(String(size));
  }, [node]);

  useEffect(() => {
    if (!editorRef.current || hasInitialized.current) return;
    editorRef.current.innerHTML = runsToHtml(runs, node);
    hasInitialized.current = true;
    requestAnimationFrame(() => syncCustomFontSizeFromSelection());
  }, [runs, node, syncCustomFontSizeFromSelection]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || !editor.contains(sel.anchorNode)) return;
      syncCustomFontSizeFromSelection();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [syncCustomFontSizeFromSelection]);

  const flushEditorToSubmit = useCallback(() => {
    if (submitFlushedRef.current || !editorRef.current || !hasInitialized.current) return;
    submitFlushedRef.current = true;
    const html = editorRef.current.innerHTML;
    const rawRuns = htmlToRuns(html, nodeForHtmlRef.current);
    const normRuns = normalizeRuns(rawRuns);
    const plainText = getPlainTextFromRuns(normRuns);
    onSubmitRef.current(plainText, normRuns);
  }, []);

  useEffect(() => {
    return () => {
      flushEditorToSubmit();
    };
  }, [flushEditorToSubmit]);

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

  const handleBlur = (e?: React.FocusEvent) => {
    const related = (e?.relatedTarget as Node | null) ?? null;
    if (isWithinEditorChrome(related)) return;
    // Portaled toolbar / number input: relatedTarget can be null; defer and re-check.
    window.setTimeout(() => {
      if (isWithinEditorChrome(document.activeElement)) return;
      flushEditorToSubmit();
    }, 0);
  };

  const applyFormat = (command: "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.execCommand(command, false);
    editorRef.current?.focus();
    scheduleHeightCheck();
  };

  const applyJustify = (justify: "left" | "center" | "right" | "full", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cmd = justify === "center" ? "justifyCenter" : justify === "right" ? "justifyRight" : justify === "full" ? "justifyFull" : "justifyLeft";
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  };

  const saveFontSizeSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedFontSizeRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const applyFontSize = (size: number, e?: React.MouseEvent, opts?: { focusEditor?: boolean }) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (savedFontSizeRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedFontSizeRangeRef.current);
      }
    }
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    let block: HTMLElement | null = sel.anchorNode as HTMLElement;
    while (block && block !== editorRef.current) {
      if (block.nodeType === Node.ELEMENT_NODE && ["DIV", "P", "LI"].includes((block as Element).tagName)) {
        (block as HTMLElement).style.fontSize = `${size}px`;
        break;
      }
      block = block.parentElement;
    }
    setCustomFontSize(String(size));
    if (opts?.focusEditor !== false) {
      editorRef.current?.focus();
    }
    scheduleHeightCheck();
  };

  const applyCustomFontSize = (opts?: { focusEditor?: boolean }) => {
    const n = Number.parseInt(customFontSize, 10);
    if (!Number.isFinite(n) || n < 1) return;
    applyFontSize(Math.min(n, 400), undefined, opts);
  };

  const applyVerticalAlign = (position: 'top' | 'middle' | 'bottom', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onVerticalAlignChange?.(position);
    editorRef.current?.focus();
  };

  const nodeAny = node as unknown as Record<string, unknown>;
  const currentVerticalPos = (nodeAny.textVerticalPosition as 'top' | 'middle' | 'bottom' | undefined) || 'middle';

  const toolbarClass =
    "flex gap-0.5 rounded-md border border-border bg-background/95 text-foreground px-1 py-1 shadow-sm";
  const counterRot = !useShapeTopToolbar && toolbarCounterRotationDeg != null;

  const toolbarBar = (
    <div ref={toolbarRef} className={toolbarClass} onMouseDown={(e) => e.stopPropagation()}>
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
          title="Align left"
          onMouseDown={(e) => applyJustify("left", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Align center"
          onMouseDown={(e) => applyJustify("center", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Align right"
          onMouseDown={(e) => applyJustify("right", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Justify"
          onMouseDown={(e) => applyJustify("full", e)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </button>
        {onVerticalAlignChange && (
          <>
            <span className="w-px bg-border mx-0.5 self-stretch" aria-hidden />
            <button
              type="button"
              title="Align top"
              onMouseDown={(e) => applyVerticalAlign('top', e)}
              className={cn("p-1 rounded hover:bg-muted transition-colors", currentVerticalPos === 'top' && "bg-muted")}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Align middle"
              onMouseDown={(e) => applyVerticalAlign('middle', e)}
              className={cn("p-1 rounded hover:bg-muted transition-colors", currentVerticalPos === 'middle' && "bg-muted")}
            >
              <Circle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Align bottom"
              onMouseDown={(e) => applyVerticalAlign('bottom', e)}
              className={cn("p-1 rounded hover:bg-muted transition-colors", currentVerticalPos === 'bottom' && "bg-muted")}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <span className="w-px bg-border mx-0.5 self-stretch" aria-hidden />
        {FONT_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            title={`Font size ${s}`}
            onMouseDown={(e) => { e.stopPropagation(); applyFontSize(s, e); }}
            className="p-1 rounded hover:bg-muted transition-colors text-[10px] min-w-[20px]"
          >
            {s}
          </button>
        ))}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={400}
          title="Custom font size"
          aria-label="Custom font size"
          placeholder="px"
          value={customFontSize}
          onChange={(e) => setCustomFontSize(e.target.value)}
          onMouseDown={(e) => {
            e.stopPropagation();
            saveFontSizeSelection();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              applyCustomFontSize({ focusEditor: true });
            }
          }}
          onBlur={(e) => {
            const related = e.relatedTarget as Node | null;
            const stayingInChrome = isWithinEditorChrome(related);
            applyCustomFontSize({ focusEditor: stayingInChrome });
            if (stayingInChrome) return;
            window.setTimeout(() => {
              if (isWithinEditorChrome(document.activeElement)) return;
              flushEditorToSubmit();
            }, 0);
          }}
          className="w-9 h-6 rounded border border-border bg-background px-0.5 text-[10px] text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
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
  );

  const toolbarBarWrapped =
    counterRot ? (
      <div
        style={{
          transform: `rotate(${toolbarCounterRotationDeg}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        {toolbarBar}
      </div>
    ) : (
      toolbarBar
    );

  const toolbarChrome =
    toolbarUsesBodyPortal &&
    floatingToolbarAnchor &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            className="pointer-events-auto"
            style={{
              position: "fixed",
              left: floatingToolbarAnchor.cx,
              top: floatingToolbarAnchor.top,
              transform: "translate(-50%, calc(-100% - 0.75rem))",
              zIndex: TEXTBOX_RICH_TOOLBAR_Z_INDEX,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              // Buttons use preventDefault so the editor keeps focus; allow real focus for inputs.
              const t = e.target as HTMLElement | null;
              if (t?.closest("input, textarea, select")) return;
              e.preventDefault();
            }}
          >
            {toolbarBarWrapped}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative h-full w-full flex min-h-0 flex-col">
      {toolbarChrome}

      {/* contentEditable area - fills same space as display, no layout shift */}
      <div
        ref={editorRef}
        contentEditable
        spellCheck
        suppressContentEditableWarning
        onContextMenu={(e) => e.stopPropagation()}
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
          "flex-1 min-h-0 overflow-auto outline-none rounded",
          "border border-transparent whitespace-pre-wrap break-words leading-normal",
          "cursor-text w-full",
          "[&_ul]:list-disc [&_ul]:list-inside [&_ul]:pl-5 [&_ul]:my-1 [&_ul]:space-y-0.5",
          "[&_ol]:list-decimal [&_ol]:list-inside [&_ol]:pl-5 [&_ol]:my-1 [&_ol]:space-y-0.5",
          "[&_li]:leading-normal",
          getTextJustifyClass((nodeAny.textJustify as string) || DEFAULT_JUSTIFY)
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
