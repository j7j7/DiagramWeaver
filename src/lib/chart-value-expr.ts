import { GLOBAL_VARIABLE_PATTERN } from "@/lib/global-properties";
import { formatChartValueForEdit, roundChartDataValue } from "@/lib/chart-node";
import type {
  ChartBarSegmentItem,
  NodeChartSpec,
} from "@/lib/types";

export type ChartValueEvalResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export interface ChartValueResolveError {
  kind: NodeChartSpec["kind"];
  seriesIndex: number;
  categoryIndex?: number;
  error: string;
}

/** Whether editor input is more than a plain numeric literal. */
export function isChartValueExpression(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (GLOBAL_VARIABLE_PATTERN.test(s)) return true;
  if (/[+*/()]/.test(s)) return true;
  if (/\d\s*-\s*\S/.test(s)) return true;
  if (/%/.test(s)) return true;
  return false;
}

export function parseChartNumericToken(raw: string): ChartValueEvalResult {
  const s = raw.trim();
  if (!s) return { ok: false, error: "Empty value" };

  const pctMatch = /^(-?\d+(?:[.,]\d+)?)\s*%$/.exec(s);
  if (pctMatch) {
    const n = Number(pctMatch[1].replace(/,/g, "."));
    if (!Number.isFinite(n)) return { ok: false, error: `Invalid percentage: ${raw}` };
    return { ok: true, value: n / 100 };
  }

  if (/%/.test(s)) {
    return { ok: false, error: `Invalid percentage: ${raw}` };
  }

  const n = Number(s.replace(/,/g, "."));
  if (!Number.isFinite(n)) {
    return { ok: false, error: `"${raw}" is not a number` };
  }
  return { ok: true, value: n };
}

function substituteChartVariables(
  expr: string,
  globalProperties?: Record<string, string>,
): { ok: true; expr: string } | { ok: false; error: string } {
  const problems: string[] = [];

  const substituted = expr.replace(GLOBAL_VARIABLE_PATTERN, (match, name: string) => {
    if (!globalProperties || !Object.prototype.hasOwnProperty.call(globalProperties, name)) {
      problems.push(`Unknown variable %${name}%`);
      return match;
    }
    const parsed = parseChartNumericToken(globalProperties[name]);
    if (!parsed.ok) {
      problems.push(`%${name}%: ${parsed.error}`);
      return match;
    }
    return `(${parsed.value})`;
  });

  if (problems.length > 0) {
    return { ok: false, error: problems.join("; ") };
  }
  if (GLOBAL_VARIABLE_PATTERN.test(substituted)) {
    return { ok: false, error: "Unknown variable in expression" };
  }
  return { ok: true, expr: substituted };
}

function evaluateMathExpression(expr: string): ChartValueEvalResult {
  const s = expr.trim().replace(/\s+/g, "");
  if (!s) return { ok: false, error: "Empty expression" };

  if (!/^[\d+\-*/().]+$/.test(s)) {
    return { ok: false, error: "Invalid expression" };
  }

  let i = 0;
  const peek = () => s[i] ?? "";
  const consume = () => s[i++];

  const parseExpr = (): number => parseAddSub();

  const parseAddSub = (): number => {
    let left = parseMulDiv();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const parseMulDiv = (): number => {
    let left = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseUnary();
      if (op === "/" && right === 0) throw new Error("Division by zero");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  };

  const parseUnary = (): number => {
    if (peek() === "+") {
      consume();
      return parseUnary();
    }
    if (peek() === "-") {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    if (peek() === "(") {
      consume();
      const v = parseExpr();
      if (peek() !== ")") throw new Error("Unmatched parenthesis");
      consume();
      return v;
    }
    const start = i;
    while (/[\d.]/.test(peek())) consume();
    if (start === i) throw new Error("Expected number");
    const n = Number(s.slice(start, i));
    if (!Number.isFinite(n)) throw new Error("Invalid number");
    return n;
  };

  try {
    const result = parseExpr();
    if (i < s.length) return { ok: false, error: "Unexpected characters in expression" };
    if (!Number.isFinite(result)) return { ok: false, error: "Result is not a number" };
    return { ok: true, value: roundChartDataValue(Math.max(0, result)) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not evaluate expression";
    return { ok: false, error: msg };
  }
}

export function evaluateChartValueInput(
  raw: string,
  globalProperties?: Record<string, string>,
): ChartValueEvalResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: 0 };

  if (!isChartValueExpression(trimmed)) {
    return parseChartNumericToken(trimmed);
  }

  const sub = substituteChartVariables(trimmed, globalProperties);
  if (!sub.ok) return sub;
  return evaluateMathExpression(sub.expr);
}

export function splitChartValuesList(raw: string): string[] {
  return String(raw ?? "")
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function chartValuesListUsesExpression(raw: string): boolean {
  return splitChartValuesList(raw).some((p) => isChartValueExpression(p));
}

export function chartValueForEditorDisplay(value: number, valueExpr?: string): string {
  if (valueExpr?.trim()) return valueExpr.trim();
  return formatChartValueForEdit(typeof value === "number" ? value : Number(value));
}

export function chartValuesStrForEditorDisplay(values: number[], valuesExpr?: string): string {
  if (valuesExpr?.trim()) return valuesExpr.trim();
  return (values ?? [])
    .map((v) => formatChartValueForEdit(typeof v === "number" ? v : Number(v)))
    .join(", ");
}

export function parseChartScalarForSave(
  raw: string,
  globalProperties?: Record<string, string>,
):
  | { ok: true; value: number; valueExpr?: string }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  const evaluated = evaluateChartValueInput(trimmed, globalProperties);
  if (!evaluated.ok) return evaluated;
  if (isChartValueExpression(trimmed)) {
    return { ok: true, value: evaluated.value, valueExpr: trimmed };
  }
  return { ok: true, value: evaluated.value };
}

export function parseChartValuesListForSave(
  raw: string,
  targetLen: number,
  globalProperties?: Record<string, string>,
):
  | { ok: true; values: number[]; valuesExpr?: string }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  const parts = splitChartValuesList(trimmed);
  const values: number[] = [];
  for (const part of parts) {
    const evaluated = evaluateChartValueInput(part, globalProperties);
    if (!evaluated.ok) return { ok: false, error: `${part}: ${evaluated.error}` };
    values.push(evaluated.value);
  }
  while (values.length < targetLen) values.push(0);
  if (values.length > targetLen) values.length = targetLen;

  if (chartValuesListUsesExpression(trimmed)) {
    return { ok: true, values, valuesExpr: trimmed };
  }
  return { ok: true, values };
}

function resolveScalarRowValue(
  value: number,
  valueExpr: string | undefined,
  globalProperties: Record<string, string> | undefined,
  onError: (error: string) => void,
): number {
  if (!valueExpr?.trim()) return value;
  const evaluated = evaluateChartValueInput(valueExpr, globalProperties);
  if (!evaluated.ok) {
    onError(evaluated.error);
    return value;
  }
  return evaluated.value;
}

function resolveBarSegmentRow(
  row: ChartBarSegmentItem,
  globalProperties: Record<string, string> | undefined,
  onError: (categoryIndex: number | undefined, error: string) => void,
): ChartBarSegmentItem {
  if (!row.valuesExpr?.trim()) return row;
  const parts = splitChartValuesList(row.valuesExpr);
  const values = [...(row.values ?? [])];
  parts.forEach((part, categoryIndex) => {
    const evaluated = evaluateChartValueInput(part, globalProperties);
    if (!evaluated.ok) {
      onError(categoryIndex, evaluated.error);
      return;
    }
    values[categoryIndex] = evaluated.value;
  });
  return { ...row, values };
}

/** Re-evaluate stored expressions with current global variables for chart layout/render. */
export function resolveChartSpecForDisplay(
  chart: NodeChartSpec,
  globalProperties?: Record<string, string>,
): { chart: NodeChartSpec; errors: ChartValueResolveError[] } {
  const errors: ChartValueResolveError[] = [];

  if (chart.kind === "pie") {
    const series = chart.series.map((row, seriesIndex) => {
      if (!row.valueExpr?.trim()) return row;
      const value = resolveScalarRowValue(row.value, row.valueExpr, globalProperties, (error) => {
        errors.push({ kind: "pie", seriesIndex, error });
      });
      return { ...row, value };
    });
    return { chart: { ...chart, series }, errors };
  }

  if (chart.kind === "ring") {
    const series = chart.series.map((row, seriesIndex) => {
      if (!row.valueExpr?.trim()) return row;
      const value = resolveScalarRowValue(row.value, row.valueExpr, globalProperties, (error) => {
        errors.push({ kind: "ring", seriesIndex, error });
      });
      return { ...row, value };
    });
    return { chart: { ...chart, series }, errors };
  }

  if (chart.kind === "bar" || chart.kind === "line") {
    const series = chart.series.map((row, seriesIndex) =>
      resolveBarSegmentRow(row, globalProperties, (categoryIndex, error) => {
        errors.push({
          kind: chart.kind,
          seriesIndex,
          categoryIndex,
          error,
        });
      }),
    );
    return { chart: { ...chart, series }, errors };
  }

  return { chart, errors };
}

export function previewChartValueInput(
  raw: string,
  globalProperties?: Record<string, string>,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!isChartValueExpression(trimmed)) return null;
  const evaluated = evaluateChartValueInput(trimmed, globalProperties);
  if (!evaluated.ok) return evaluated.error;
  return `= ${formatChartValueForEdit(evaluated.value)}`;
}
