/**
 * Rich text formatting for textbox nodes.
 * Supports bold, italic, underline per text segment.
 * Stored as runs - each run has text and optional formatting flags.
 * RichTextRun type is also exported from @/lib/types.
 */

import type { RichTextRun } from "@/lib/types";
export type { RichTextRun };

const BOLD_TAGS = ["b", "strong"];
const ITALIC_TAGS = ["i", "em"];
const UNDERLINE_TAGS = ["u"];

/** Convert runs to plain text (for label fallback and search) */
export function getPlainTextFromRuns(runs: RichTextRun[]): string {
  return runs.map((r) => r.text).join("");
}

/** Convert plain label to a single run (for backward compat) */
export function labelToRuns(label: string | undefined): RichTextRun[] {
  if (!label) return [];
  return [{ text: label }];
}

/** Convert runs to HTML for contentEditable */
export function runsToHtml(runs: RichTextRun[]): string {
  if (runs.length === 0) return "";
  return runs
    .map((run) => {
      let html = escapeHtml(run.text).replace(/\n/g, "<br>");
      if (run.underline) html = `<u>${html}</u>`;
      if (run.italic) html = `<i>${html}</i>`;
      if (run.bold) html = `<b>${html}</b>`;
      return html;
    })
    .join("");
}

/** Parse contentEditable HTML back to runs */
export function htmlToRuns(html: string): RichTextRun[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div>${html.replace(/\n/g, "<br>")}</div>`,
    "text/html"
  );
  const root = doc.body.firstElementChild;
  if (!root) return [];

  const runs: RichTextRun[] = [];
  const stack: { bold: boolean; italic: boolean; underline: boolean }[] = [
    { bold: false, italic: false, underline: false },
  ];

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        const fmt = stack[stack.length - 1];
        runs.push({
          text: unescapeHtml(text),
          bold: fmt.bold || undefined,
          italic: fmt.italic || undefined,
          underline: fmt.underline || undefined,
        });
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
    else if (tag === "br") {
      runs.push({
        text: "\n",
        bold: fmt.bold || undefined,
        italic: fmt.italic || undefined,
        underline: fmt.underline || undefined,
      });
      return;
    } else if (["div", "p"].includes(tag) && runs.length > 0) {
      runs.push({
        text: "\n",
        bold: fmt.bold || undefined,
        italic: fmt.italic || undefined,
        underline: fmt.underline || undefined,
      });
    }

    stack.push(fmt);
    for (const child of el.childNodes) visit(child);
    stack.pop();
  }

  for (const child of root.childNodes) visit(child);
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
      (current.underline ?? false) === (r.underline ?? false);

    if (sameFmt) {
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
