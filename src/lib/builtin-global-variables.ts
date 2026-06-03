import { GLOBAL_VARIABLE_PATTERN } from "@/lib/global-properties";

/** Runtime context for built-in `%var%` placeholders (date/time and presentation slide). */
export interface GlobalVariableContext {
  now?: Date;
  /** 0-based index of the active presentation slide. */
  slideIndex?: number;
  slideCount?: number;
}

export const BUILTIN_GLOBAL_VARIABLE_NAMES = [
  "day",
  "shortday",
  "dd",
  "mm",
  "month",
  "yy",
  "yyyy",
  "slide",
  "slides",
] as const;

export type BuiltinGlobalVariableName = (typeof BUILTIN_GLOBAL_VARIABLE_NAMES)[number];

type BuiltinVarKind =
  | "weekday"
  | "shortweekday"
  | "monthName"
  | "monthNum"
  | "dayNum"
  | "year2"
  | "year4"
  | "slideNum"
  | "slideCount";

const BUILTIN_VAR_KIND: Record<BuiltinGlobalVariableName, BuiltinVarKind> = {
  day: "weekday",
  shortday: "shortweekday",
  dd: "dayNum",
  mm: "monthNum",
  month: "monthName",
  yy: "year2",
  yyyy: "year4",
  slide: "slideNum",
  slides: "slideCount",
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const SHORT_WEEKDAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Parenthesized math, e.g. `(%dd% - 1)` or `(%dd%/2)` — `/` is division only inside `(...)`. */
const PAREN_MATH_EXPRESSION_PATTERN =
  /\(([^()]*(?:%[a-zA-Z_][a-zA-Z0-9_]*%)[^()]*)\)/g;

/** Slash-separated variables, e.g. `%dd%/%mm%/%yyyy%` — joins values (not division). */
const DATE_SLASH_CHAIN_PATTERN =
  /%[a-zA-Z_][a-zA-Z0-9_]*%(?:\s*\/\s*%[a-zA-Z_][a-zA-Z0-9_]*%)+/g;

function resolveNow(context: GlobalVariableContext): Date {
  return context.now ?? new Date();
}

function resolveSlideIndex(context: GlobalVariableContext): number {
  const idx = context.slideIndex;
  return typeof idx === "number" && Number.isFinite(idx) && idx >= 0 ? Math.floor(idx) : 0;
}

function resolveSlideCount(context: GlobalVariableContext): number {
  const count = context.slideCount;
  if (typeof count === "number" && Number.isFinite(count) && count >= 1) {
    return Math.floor(count);
  }
  return 1;
}

export function getBuiltinGlobalProperties(
  context: GlobalVariableContext = {},
): Record<string, string> {
  const now = resolveNow(context);
  const slideIndex = resolveSlideIndex(context);
  const slideCount = resolveSlideCount(context);

  return {
    day: WEEKDAY_NAMES[now.getDay()],
    shortday: SHORT_WEEKDAY_NAMES[now.getDay()],
    dd: String(now.getDate()).padStart(2, "0"),
    mm: String(now.getMonth() + 1).padStart(2, "0"),
    month: MONTH_NAMES[now.getMonth()],
    yy: String(now.getFullYear() % 100).padStart(2, "0"),
    yyyy: String(now.getFullYear()),
    slide: String(slideIndex + 1),
    slides: String(slideCount),
  };
}

export function mergeGlobalProperties(
  user?: Record<string, string>,
  context?: GlobalVariableContext,
): Record<string, string> {
  return { ...getBuiltinGlobalProperties(context), ...(user ?? {}) };
}

function parseMonthName(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === s);
  return idx >= 0 ? idx + 1 : null;
}

function parseWeekdayName(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const full = WEEKDAY_NAMES.findIndex((d) => d.toLowerCase() === s);
  if (full >= 0) return full;
  const short = SHORT_WEEKDAY_NAMES.findIndex((d) => d === s);
  return short >= 0 ? short : null;
}

function parseNumericToken(raw: string): number | null {
  const s = raw.trim().replace(/,/g, ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getBuiltinNumericValue(name: BuiltinGlobalVariableName, context: GlobalVariableContext): number {
  const now = resolveNow(context);
  switch (BUILTIN_VAR_KIND[name]) {
    case "weekday":
    case "shortweekday":
      return now.getDay();
    case "monthName":
    case "monthNum":
      return now.getMonth() + 1;
    case "dayNum":
      return now.getDate();
    case "year2":
      return now.getFullYear() % 100;
    case "year4":
      return now.getFullYear();
    case "slideNum":
      return resolveSlideIndex(context) + 1;
    case "slideCount":
      return resolveSlideCount(context);
    default:
      return 0;
  }
}

function getNumericForVariable(
  name: string,
  merged: Record<string, string>,
  context: GlobalVariableContext,
): number | null {
  if (!Object.prototype.hasOwnProperty.call(merged, name)) return null;

  const raw = merged[name];
  const builtinKind = (BUILTIN_GLOBAL_VARIABLE_NAMES as readonly string[]).includes(name)
    ? BUILTIN_VAR_KIND[name as BuiltinGlobalVariableName]
    : null;

  if (builtinKind === "monthName") {
    const fromName = parseMonthName(raw);
    if (fromName !== null) return fromName;
  }
  if (builtinKind === "weekday" || builtinKind === "shortweekday") {
    const fromDay = parseWeekdayName(raw);
    if (fromDay !== null) return fromDay;
  }

  const parsed = parseNumericToken(raw);
  if (parsed !== null) return parsed;

  if (builtinKind) {
    return getBuiltinNumericValue(name as BuiltinGlobalVariableName, context);
  }

  return null;
}

function inferExpressionResultKind(expression: string): BuiltinVarKind | "number" {
  const first = expression.match(GLOBAL_VARIABLE_PATTERN);
  const name = first?.[1];
  if (name && (BUILTIN_GLOBAL_VARIABLE_NAMES as readonly string[]).includes(name)) {
    return BUILTIN_VAR_KIND[name as BuiltinGlobalVariableName];
  }
  return "number";
}

function formatExpressionResult(kind: BuiltinVarKind | "number", value: number): string {
  const n = Number.isFinite(value) ? value : 0;

  switch (kind) {
    case "weekday": {
      const idx = ((Math.round(n) % 7) + 7) % 7;
      return WEEKDAY_NAMES[idx];
    }
    case "shortweekday": {
      const idx = ((Math.round(n) % 7) + 7) % 7;
      return SHORT_WEEKDAY_NAMES[idx];
    }
    case "monthName": {
      const idx = ((Math.round(n) - 1) % 12 + 12) % 12;
      return MONTH_NAMES[idx];
    }
    case "year2":
      return String(((Math.round(n) % 100) + 100) % 100).padStart(2, "0");
    case "year4":
      return String(Math.round(n));
    case "monthNum":
    case "dayNum":
    case "slideNum":
    case "slideCount":
    case "number":
    default:
      return Number.isInteger(n) ? String(Math.round(n)) : String(n);
  }
}

type PlainMathResult = { ok: true; value: number } | { ok: false; error: string };

function evaluatePlainMathExpression(expr: string): PlainMathResult {
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
    const num = Number(s.slice(start, i));
    if (!Number.isFinite(num)) throw new Error("Invalid number");
    return num;
  };

  try {
    const result = parseExpr();
    if (i < s.length) return { ok: false, error: "Unexpected characters in expression" };
    if (!Number.isFinite(result)) return { ok: false, error: "Result is not a number" };
    return { ok: true, value: result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not evaluate expression";
    return { ok: false, error: msg };
  }
}

function getDisplayValueForVariable(
  name: string,
  merged: Record<string, string>,
  context: GlobalVariableContext,
): string | null {
  if (!Object.prototype.hasOwnProperty.call(merged, name)) return null;

  const builtinKind = (BUILTIN_GLOBAL_VARIABLE_NAMES as readonly string[]).includes(name)
    ? BUILTIN_VAR_KIND[name as BuiltinGlobalVariableName]
    : null;

  if (builtinKind === "dayNum" || builtinKind === "monthNum") {
    const n = getNumericForVariable(name, merged, context);
    if (n !== null) return String(Math.round(n)).padStart(2, "0");
  }
  if (builtinKind === "year2") {
    const n = getNumericForVariable(name, merged, context);
    if (n !== null) return String(((Math.round(n) % 100) + 100) % 100).padStart(2, "0");
  }

  return merged[name];
}

function evaluateParenMathExpression(
  inner: string,
  merged: Record<string, string>,
  context: GlobalVariableContext,
): string | null {
  const problems: string[] = [];

  const substituted = inner.replace(GLOBAL_VARIABLE_PATTERN, (match, name: string) => {
    const num = getNumericForVariable(name, merged, context);
    if (num === null) {
      problems.push(name);
      return match;
    }
    return `(${num})`;
  });

  if (problems.length > 0) return null;

  const remaining = new RegExp(GLOBAL_VARIABLE_PATTERN.source, "g");
  if (remaining.test(substituted)) return null;

  const evaluated = evaluatePlainMathExpression(substituted);
  if (!evaluated.ok) return null;

  return formatExpressionResult(inferExpressionResultKind(inner), evaluated.value);
}

function evaluateDateSlashChain(
  chain: string,
  merged: Record<string, string>,
  context: GlobalVariableContext,
): string | null {
  const parts = chain.split(/\s*\/\s*/);
  const resolved: string[] = [];

  for (const part of parts) {
    const match = /^%([a-zA-Z_][a-zA-Z0-9_]*)%$/.exec(part.trim());
    if (!match) return null;
    const value = getDisplayValueForVariable(match[1], merged, context);
    if (value === null) return null;
    resolved.push(value);
  }

  return resolved.join("/");
}

/**
 * Evaluate parenthesized math and slash-joined date chains.
 * Ungrouped `%dd% - 1` is left for plain `%var%` substitution (e.g. `04 - 1`).
 */
export function evaluateGlobalTextExpressions(
  text: string,
  merged: Record<string, string>,
  context: GlobalVariableContext = {},
): string {
  if (!text.includes("%")) return text;

  let result = text;

  result = result.replace(PAREN_MATH_EXPRESSION_PATTERN, (full, inner: string) => {
    const evaluated = evaluateParenMathExpression(inner, merged, context);
    return evaluated !== null ? evaluated : full;
  });

  result = result.replace(DATE_SLASH_CHAIN_PATTERN, (chain) => {
    const evaluated = evaluateDateSlashChain(chain, merged, context);
    return evaluated ?? chain;
  });

  return result;
}

export function isBuiltinGlobalVariableName(name: string): boolean {
  return (BUILTIN_GLOBAL_VARIABLE_NAMES as readonly string[]).includes(name);
}

export function buildPresentationGlobalVariableContext(
  slideIndex: number,
  slideCount: number,
): GlobalVariableContext {
  const safeCount = Math.max(1, Math.floor(slideCount));
  const safeIndex = Math.max(0, Math.min(Math.floor(slideIndex), safeCount - 1));
  return { slideIndex: safeIndex, slideCount: safeCount };
}
