/**
 * Rich text formatting for textbox nodes.
 * Supports bold, italic, underline per text segment.
 * Per-line: textJustify, fontSize, fontWeight, fontFamily.
 * Stored as runs - each run has text and optional formatting flags.
 * RichTextRun type is also exported from @/lib/types.
 */

import type { RichTextRun } from "@/lib/types";
import type { DiagramNodeData } from "@/lib/types";
export type { RichTextRun };

const BOLD_TAGS = ["b", "strong"];
const ITALIC_TAGS = ["i", "em"];
const UNDERLINE_TAGS = ["u"];

type LineDefaults = {
  textJustify?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
};

/** Convert runs to plain text (for label fallback and search) */
export function getPlainTextFromRuns(runs: RichTextRun[]): string {
  return runs.map((r) => r.text).join("");
}

/** Convert plain label to a single run (for backward compat) */
export function labelToRuns(label: string | undefined): RichTextRun[] {
  if (!label) return [];
  return [{ text: label }];
}

function wrapRun(run: RichTextRun): string {
  let html = escapeHtml(run.text).replace(/\n/g, "<br>");
  if (run.underline) html = `<u>${html}</u>`;
  if (run.italic) html = `<i>${html}</i>`;
  if (run.bold) html = `<b>${html}</b>`;
  return html;
}

function lineStyleAttr(run: RichTextRun, defaults: LineDefaults): string {
  const parts: string[] = [];
  const align = run.lineJustify ?? defaults.textJustify ?? "left";
  parts.push(`text-align:${align === "full" ? "justify" : align}`);
  if (run.lineFontSize != null) parts.push(`font-size:${run.lineFontSize}px`);
  else if (defaults.fontSize != null) parts.push(`font-size:${defaults.fontSize}px`);
  if (run.lineFontWeight != null) parts.push(`font-weight:${run.lineFontWeight}`);
  else if (defaults.fontWeight != null) parts.push(`font-weight:${defaults.fontWeight}`);
  if (run.lineFontFamily != null) parts.push(`font-family:${escapeCssString(run.lineFontFamily)}`);
  else if (defaults.fontFamily != null) parts.push(`font-family:${escapeCssString(defaults.fontFamily)}`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function escapeCssString(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/** Convert runs to HTML for contentEditable. Supports per-line justify/font. */
export function runsToHtml(runs: RichTextRun[], node?: DiagramNodeData | null): string {
  if (runs.length === 0) return "";
  const defaults: LineDefaults = {
    textJustify: (node as any)?.textJustify ?? "left",
    fontSize: (node as any)?.fontSize,
    fontWeight: (node as any)?.fontWeight,
    fontFamily: (node as any)?.fontFamily,
  };
  const parts: string[] = [];
  let i = 0;

  while (i < runs.length) {
    const run = runs[i];
    if (run.listType === "bullet" || run.listType === "numbered") {
      const listTag = run.listType === "bullet" ? "ul" : "ol";
      const items: string[] = [];
      while (i < runs.length) {
        const r = runs[i];
        if (r.listType === run.listType) {
          const liStyle = lineStyleAttr(r, defaults);
          items.push(`<li${liStyle}>${wrapRun(r)}</li>`);
          i++;
        } else if (r.text === "\n" && i + 1 < runs.length && runs[i + 1].listType === run.listType) {
          i++;
        } else {
          break;
        }
      }
      parts.push(`<${listTag}>${items.join("")}</${listTag}>`);
      continue;
    }
    const lineRuns: RichTextRun[] = [];
    while (i < runs.length) {
      const r = runs[i];
      if (r.listType) break;
      if (r.text === "\n") {
        if (lineRuns.length > 0) {
          const style = lineStyleAttr(lineRuns[0], defaults);
          parts.push(`<div${style}>${lineRuns.map(wrapRun).join("")}</div>`);
          lineRuns.length = 0;
        } else {
          parts.push(`<div${lineStyleAttr(r, defaults)}><br></div>`);
        }
        i++;
        break;
      }
      const newlineIdx = r.text.indexOf("\n");
      if (newlineIdx >= 0) {
        const before = r.text.slice(0, newlineIdx);
        const after = r.text.slice(newlineIdx + 1);
        if (before) lineRuns.push({ ...r, text: before });
        if (lineRuns.length > 0) {
          const style = lineStyleAttr(lineRuns[0], defaults);
          parts.push(`<div${style}>${lineRuns.map(wrapRun).join("")}</div>`);
          lineRuns.length = 0;
        }
        if (after) {
          const contRun = { ...r, text: after };
          parts.push(`<div${lineStyleAttr(contRun, defaults)}>${wrapRun(contRun)}</div>`);
        }
        i++;
        break;
      }
      lineRuns.push(r);
      i++;
    }
    if (lineRuns.length > 0) {
      const style = lineStyleAttr(lineRuns[0], defaults);
      parts.push(`<div${style}>${lineRuns.map(wrapRun).join("")}</div>`);
    }
  }
  return parts.join("");
}

/** Parse contentEditable HTML back to runs, preserving per-line formatting from block styles */
export function htmlToRuns(html: string, node?: DiagramNodeData | null): RichTextRun[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div>${html.replace(/\n/g, "<br>")}</div>`,
    "text/html"
  );
  const root = doc.body.firstElementChild;
  if (!root) return [];

  const defaults: LineDefaults = {
    textJustify: (node as any)?.textJustify ?? "left",
    fontSize: (node as any)?.fontSize,
    fontWeight: (node as any)?.fontWeight,
    fontFamily: (node as any)?.fontFamily,
  };

  const runs: RichTextRun[] = [];
  const stack: { bold: boolean; italic: boolean; underline: boolean; listType?: "bullet" | "numbered" }[] = [
    { bold: false, italic: false, underline: false },
  ];

  function getBlockLineFormat(el: Element): Partial<RichTextRun> {
    const style = (el as HTMLElement).style;
    const format: Partial<RichTextRun> = {};
    const align = style?.textAlign;
    if (align) {
      format.lineJustify = align === "justify" ? "full" : (align as "left" | "center" | "right");
    }
    const fs = style?.fontSize;
    if (fs && fs !== "inherit") {
      const px = parseFloat(fs);
      if (!isNaN(px)) format.lineFontSize = px;
    }
    const fw = style?.fontWeight;
    if (fw && fw !== "inherit") format.lineFontWeight = fw;
    const ff = style?.fontFamily;
    if (ff && ff !== "inherit") format.lineFontFamily = ff.replace(/^["']|["']$/g, "");
    return format;
  }

  let firstRunOfBlock = true;
  let blockLineFormat: Partial<RichTextRun> = {};

  function visit(node: Node, blockFormat?: Partial<RichTextRun>) {
    const effectiveBlockFormat = blockFormat ?? blockLineFormat;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        const fmt = stack[stack.length - 1];
        const run: RichTextRun = {
          text: unescapeHtml(text),
          bold: fmt.bold || undefined,
          italic: fmt.italic || undefined,
          underline: fmt.underline || undefined,
          listType: fmt.listType,
        };
        if (firstRunOfBlock && Object.keys(effectiveBlockFormat).length > 0) {
          if (effectiveBlockFormat.lineJustify) run.lineJustify = effectiveBlockFormat.lineJustify;
          if (effectiveBlockFormat.lineFontSize != null) run.lineFontSize = effectiveBlockFormat.lineFontSize;
          if (effectiveBlockFormat.lineFontWeight != null) run.lineFontWeight = effectiveBlockFormat.lineFontWeight;
          if (effectiveBlockFormat.lineFontFamily) run.lineFontFamily = effectiveBlockFormat.lineFontFamily;
          firstRunOfBlock = false;
        }
        runs.push(run);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName?.toLowerCase();
    const fmt = { ...stack[stack.length - 1] };

    if (BOLD_TAGS.includes(tag)) fmt.bold = true;
    else if (ITALIC_TAGS.includes(tag)) fmt.italic = true;
    else if (UNDERLINE_TAGS.includes(tag)) fmt.underline = true;
    else if (tag === "ul") fmt.listType = "bullet";
    else if (tag === "ol") fmt.listType = "numbered";
    else if (tag === "li") {
      const prevFirst = firstRunOfBlock;
      firstRunOfBlock = true;
      blockLineFormat = getBlockLineFormat(el);
      stack.push(fmt);
      for (const child of el.childNodes) visit(child, blockLineFormat);
      stack.pop();
      firstRunOfBlock = prevFirst;
      return;
    } else if (tag === "br") {
      runs.push({
        text: "\n",
        bold: fmt.bold || undefined,
        italic: fmt.italic || undefined,
        underline: fmt.underline || undefined,
        listType: fmt.listType,
      });
      return;
    } else if (["div", "p"].includes(tag)) {
      const prevFirst = firstRunOfBlock;
      firstRunOfBlock = true;
      const lineFmt = getBlockLineFormat(el);
      const onlyBr =
        el.childNodes.length === 1 &&
        el.childNodes[0].nodeType === Node.ELEMENT_NODE &&
        (el.childNodes[0] as Element).tagName?.toLowerCase() === "br";
      if (runs.length > 0 && !onlyBr) {
        runs.push({
          text: "\n",
          bold: fmt.bold || undefined,
          italic: fmt.italic || undefined,
          underline: fmt.underline || undefined,
          listType: fmt.listType,
        });
      }
      stack.push(fmt);
      for (const child of el.childNodes) visit(child, lineFmt);
      stack.pop();
      firstRunOfBlock = prevFirst;
      return;
    }

    stack.push(fmt);
    for (const child of el.childNodes) visit(child, effectiveBlockFormat);
    stack.pop();
  }

  for (const child of root.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName?.toLowerCase();
      if (["div", "p"].includes(tag)) {
        firstRunOfBlock = true;
        blockLineFormat = getBlockLineFormat(el);
      }
    }
    visit(child);
  }
  return runs;
}

/** Merge adjacent runs with same formatting to reduce array size */
export function normalizeRuns(runs: RichTextRun[]): RichTextRun[] {
  if (runs.length <= 1) return runs;
  const result: RichTextRun[] = [];
  let current = { ...runs[0] };

  for (let i = 1; i < runs.length; i++) {
    const r = runs[i];
    const sameFmt =
      (current.bold ?? false) === (r.bold ?? false) &&
      (current.italic ?? false) === (r.italic ?? false) &&
      (current.underline ?? false) === (r.underline ?? false) &&
      (current.listType ?? null) === (r.listType ?? null) &&
      (current.lineJustify ?? null) === (r.lineJustify ?? null) &&
      (current.lineFontSize ?? null) === (r.lineFontSize ?? null) &&
      (current.lineFontWeight ?? null) === (r.lineFontWeight ?? null) &&
      (current.lineFontFamily ?? null) === (r.lineFontFamily ?? null);
    const canMerge = sameFmt && !current.listType;

    if (canMerge) {
      current.text += r.text;
    } else {
      result.push(current);
      current = { ...r };
    }
  }
  result.push(current);
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
