import type { DiagramData, RichTextRun } from "@/lib/types";

/** `%varname%` placeholders in text — varname is `[a-zA-Z_][a-zA-Z0-9_]*`. */
export const GLOBAL_VARIABLE_PATTERN = /%([a-zA-Z_][a-zA-Z0-9_]*)%/g;

export function normalizeGlobalPropertyKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return null;
  return trimmed;
}

export function resolveGlobalVariables(
  text: string,
  globalProperties?: Record<string, string>,
): string {
  if (!text || !globalProperties || Object.keys(globalProperties).length === 0) {
    return text;
  }
  return text.replace(GLOBAL_VARIABLE_PATTERN, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(globalProperties, name)
      ? globalProperties[name]
      : match,
  );
}

export function resolveGlobalVariablesInRuns(
  runs: RichTextRun[],
  globalProperties?: Record<string, string>,
): RichTextRun[] {
  if (!globalProperties || Object.keys(globalProperties).length === 0) {
    return runs;
  }
  return runs.map((run) => ({
    ...run,
    text: resolveGlobalVariables(run.text, globalProperties),
  }));
}

/** Collect `%varname%` names referenced anywhere in diagram text (for UI hints). */
export function collectUsedGlobalVariableNames(
  data: DiagramData | undefined,
): string[] {
  if (!data) return [];
  const names = new Set<string>();
  const scan = (text: string | undefined) => {
    if (!text) return;
    for (const match of text.matchAll(GLOBAL_VARIABLE_PATTERN)) {
      names.add(match[1]);
    }
  };
  const scanRuns = (runs: unknown) => {
    if (!Array.isArray(runs)) return;
    for (const run of runs) {
      if (run && typeof run === "object" && typeof (run as { text?: string }).text === "string") {
        scan((run as { text: string }).text);
      }
    }
  };
  const scanCardElements = (elements: unknown) => {
    if (!elements || typeof elements !== "object") return;
    for (const el of Object.values(elements as Record<string, unknown>)) {
      if (!el || typeof el !== "object") continue;
      const item = el as Record<string, unknown>;
      if (typeof item.text === "string") scan(item.text);
      if (typeof item.tag === "string") scan(item.tag);
      scanRuns(item.richText);
    }
  };

  for (const node of data.nodes ?? []) {
    scan(node.label);
    scan(node.tag);
    scan(node.info);
    scan((node as { headingLabel?: string }).headingLabel);
    scanRuns(node.richLabel);
    scanRuns((node as { richHeadingLabel?: RichTextRun[] }).richHeadingLabel);
    const chart = node.chart as { categoryLabels?: string[]; title?: string } | undefined;
    chart?.categoryLabels?.forEach(scan);
    scan(chart?.title);
    const uml = node.umlClass;
    uml?.name && scan(uml.name);
    uml?.attributes?.forEach(scan);
    uml?.methods?.forEach(scan);
    node.timelineEntries?.forEach((entry) => {
      scan(entry.label);
      scanRuns(entry.richLabel);
    });
    scanCardElements((node as { cardElements?: unknown }).cardElements);
    const chartSeries = (node.chart as { series?: Array<{ valueExpr?: string; valuesExpr?: string }> } | undefined)?.series;
    chartSeries?.forEach((row) => {
      scan(row.valueExpr);
      scan(row.valuesExpr);
      if (row.valuesExpr) {
        row.valuesExpr.split(/[,;\n]+/).forEach((part) => scan(part.trim()));
      }
    });
  }
  for (const conn of data.connections ?? []) {
    scan(conn.text);
  }
  return Array.from(names).sort();
}
