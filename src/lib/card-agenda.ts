import type { CSSProperties } from "react";
import type { CardElementData, CardElementStyle, CardFlexJustify, CardTemplate } from "@/lib/card-types";
import type { DiagramNodeData } from "@/lib/types";
import { flexJustifyToTextJustify } from "@/lib/card-layout";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";
import { shiftHueOfColor } from "@/lib/color-shift";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";

export const AGENDA_TEMPLATE_ID = "agenda";

export const AGENDA_DATE_HEADER_ID = "date-header";
export const AGENDA_DATE_ID = "date";
export const AGENDA_TABLE_HEADER_ID = "table-header";
export const AGENDA_ENTRIES_ID = "entries";
export const AGENDA_ADD_ROW_ID = "add-row";
export const AGENDA_ADD_ROW_LABEL_ID = "add-row-label";
export const AGENDA_TIME_HEADER_ID = "time-header";
export const AGENDA_SESSION_HEADER_ID = "session-header";
export const AGENDA_COL_DIVIDER_ID = "col-divider";
export const AGENDA_DATE_TABLE_DIVIDER_ID = "date-table-divider";
export const AGENDA_HEADER_ENTRIES_DIVIDER_ID = "header-entries-divider";
export const AGENDA_ROW_PREFIX = "row-";

export const AGENDA_DIVIDER_COLOR_DEFAULT = "#e2e8f0";

/** Light UI: dark column-header band. Dark UI: inverted band. */
export const AGENDA_TABLE_HEADER_BG_LIGHT = "#0f172a";
export const AGENDA_TABLE_HEADER_TEXT_LIGHT = "#f8fafc";
export const AGENDA_TABLE_HEADER_BG_DARK = "#f1f5f9";
export const AGENDA_TABLE_HEADER_TEXT_DARK = "#0f172a";

export const AGENDA_DATE_HEADER_BG = "#f1f5f9";
export const AGENDA_ROW_FILL_DEFAULT = "#f8fafc";

const SLATE_DARK = "#1e293b";
const SLATE_MUTED = "#64748b";
const HIGHLIGHT_BORDER = "#3b82f6";
const CARD_WHITE = "#ffffff";

/** Fixed px width for Time column — does not grow when the card is resized wider. */
export const AGENDA_TIME_COL_WIDTH_PX = 76;
export const AGENDA_MIN_ROWS = 1;

/** Default drop size / corner radius for palette agenda cards. */
export const AGENDA_DEFAULT_WIDTH = 230;
export const AGENDA_DEFAULT_HEIGHT = 330;
export const AGENDA_DEFAULT_CORNER_RADIUS = 0.07313206754467916;
export const AGENDA_DEFAULT_DATE_SUBTITLE = "Workshop";

/** Teal workshop preset (palette drop + template root). */
export const AGENDA_DEFAULT_THEME = {
  dividerColor: "#0d7b96",
  textColor: "#134e4a",
  gradientAngle: 118,
  rootGradient: ["#ccfbf1", "#a7f3d0"] as [string, string],
  dateHeaderBg: "#ccfbf1",
  tableHeaderBg: "#ccfafb",
  rowFills: [
    "#cceffb",
    "#ccdffb",
    "#cccefb",
    "#daccfb",
    "#ebccfb",
    "#fbccfb",
    "#fbccea",
  ],
  addRowTextColor: "#134e4a",
  dateSubtitle: AGENDA_DEFAULT_DATE_SUBTITLE,
};

export type AgendaThemePreset = typeof AGENDA_DEFAULT_THEME;

export type AgendaRootOptions = {
  theme?: AgendaThemePreset;
  date?: Date;
  dateSubtitle?: string;
};

export interface AgendaRowData {
  id: string;
  time: string;
  session: string;
  highlighted?: boolean;
  rowStyle?: CardElementStyle;
}

export interface AgendaRegions {
  dateHeader: CardElementData | null;
  date: CardElementData | null;
  tableHeader: CardElementData | null;
  timeHeader: CardElementData | null;
  sessionHeader: CardElementData | null;
  entries: CardElementData | null;
}

const DEFAULT_ROWS: Omit<AgendaRowData, "id">[] = [
  { time: "10:30AM", session: "Kick off" },
  { time: "11:00AM", session: "Introductions" },
  { time: "1:00PM", session: "Lunch" },
  { time: "2:00PM", session: "Workshop" },
  { time: "3:15PM", session: "Checkpoint" },
  { time: "4:30PM", session: "Actions" },
  { time: "5:00PM", session: "Wrap Up" },
];

function englishOrdinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Format like "Tuesday, 27th May 2026" (weekday, ordinal day, month, year). */
export function formatAgendaDateHeader(date: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  const day = englishOrdinalDay(date.getDate());
  return `${weekday}, ${day} ${month} ${date.getFullYear()}`;
}

function agendaDivider(id: string, marginY = 0, color = AGENDA_DIVIDER_COLOR_DEFAULT): CardElementData {
  return {
    id,
    kind: "section",
    layout: {
      width: "100%",
      height: 1,
      flex: 0,
      alignSelf: "stretch",
      marginTop: marginY,
      marginBottom: marginY,
    },
    style: { backgroundColor: color, backgroundStyle: "solid" },
  };
}

function agendaColumnDivider(
  id: string,
  tone: "default" | "on-dark" = "default",
  color = AGENDA_DIVIDER_COLOR_DEFAULT,
): CardElementData {
  const bg =
    tone === "on-dark" && color === AGENDA_DIVIDER_COLOR_DEFAULT
      ? "rgba(248,250,252,0.25)"
      : color;
  return {
    id,
    kind: "section",
    layout: { width: 1, flex: 0, alignSelf: "stretch" },
    style: { backgroundColor: bg, backgroundStyle: "solid" },
  };
}

function agendaCellText(
  id: string,
  text: string,
  opts: {
    header?: boolean;
    onDark?: boolean;
    justify?: CardFlexJustify;
    nowrap?: boolean;
    textColor?: string;
    syncTextJustify?: boolean;
  } = {},
): CardElementData {
  const {
    header = false,
    onDark = false,
    justify = "start",
    nowrap = false,
    textColor: textColorOverride,
    syncTextJustify = false,
  } = opts;
  const isTimeCol = id.includes("-time") || id === AGENDA_TIME_HEADER_ID;
  const textColor =
    textColorOverride ??
    (onDark ? AGENDA_TABLE_HEADER_TEXT_LIGHT : header ? SLATE_MUTED : SLATE_DARK);
  const textJustify = syncTextJustify ? flexJustifyToTextJustify(justify) : undefined;
  return {
    id,
    kind: "text",
    text,
    editable: !header,
    fontSize: header ? 10 : 11,
    fontWeight: header ? "600" : "400",
    textColor,
    ...(textJustify ? { textJustify } : {}),
    layout: {
      flex: isTimeCol ? 0 : 1,
      width: isTimeCol ? AGENDA_TIME_COL_WIDTH_PX : undefined,
      minWidth: isTimeCol ? undefined : 0,
      padding: header ? [8, 10] : [8, 10],
      justifyContent: justify,
      alignItems: "center",
    },
    style: { backgroundStyle: "none" },
    ...(nowrap ? {} : {}),
  };
}

function defaultRowStyle(highlighted?: boolean): CardElementStyle {
  if (highlighted) {
    return {
      backgroundColor: AGENDA_ROW_FILL_DEFAULT,
      backgroundStyle: "solid",
      borderColor: HIGHLIGHT_BORDER,
      borderWidth: 2,
      borderStyle: "solid",
      borderRadius: 4,
    };
  }
  return {
    backgroundColor: AGENDA_ROW_FILL_DEFAULT,
    backgroundStyle: "solid",
  };
}

function agendaRowSection(
  row: AgendaRowData,
  timeJustify: CardFlexJustify,
  sessionJustify: CardFlexJustify,
  dividerColor = AGENDA_DIVIDER_COLOR_DEFAULT,
  cellTextColor?: string,
  syncTimeJustify = false,
): CardElementData {
  const style = row.rowStyle ?? defaultRowStyle(row.highlighted);
  return {
    id: row.id,
    kind: "section",
    highlighted: row.highlighted,
    layout: {
      flexDirection: "row",
      width: "100%",
      flex: 0,
      alignItems: "stretch",
      gap: 0,
    },
    style,
    children: [
      agendaCellText(`${row.id}-time`, row.time, {
        justify: timeJustify,
        nowrap: true,
        textColor: cellTextColor,
        syncTextJustify: syncTimeJustify,
      }),
      agendaColumnDivider(`${row.id}-divider`, "default", dividerColor),
      agendaCellText(`${row.id}-session`, row.session, {
        justify: sessionJustify,
        textColor: cellTextColor,
      }),
    ],
  };
}

function agendaAddRowButton(addLabelColor = "#3b82f6"): CardElementData {
  return {
    id: AGENDA_ADD_ROW_ID,
    kind: "section",
    layout: {
      width: "100%",
      flex: 0,
      padding: [8, 10],
      justifyContent: "center",
      alignItems: "center",
      marginTop: 4,
    },
    style: { backgroundStyle: "none" },
    children: [
      {
        id: "add-row-label",
        kind: "text",
        text: "+ Add item",
        editable: false,
        fontSize: 10,
        fontWeight: "600",
        textColor: addLabelColor,
        layout: { flex: 0, padding: [4, 8], justifyContent: "center", alignItems: "center" },
        style: { backgroundStyle: "none" },
      },
    ],
  };
}

function agendaDateTextElement(
  dateLine: string,
  subtitle: string,
  textColor: string,
): CardElementData {
  return {
    id: AGENDA_DATE_ID,
    kind: "text",
    text: `${dateLine}\n${subtitle}`,
    editable: true,
    fontSize: 13,
    fontWeight: "600",
    textColor,
    layout: {
      width: "100%",
      flex: 0,
      padding: [0, 4] as [number, number],
      justifyContent: "center",
      alignItems: "center",
    },
    style: { backgroundStyle: "none" },
    richText: [
      { text: dateLine, lineJustify: "center", lineFontSize: 13, lineFontWeight: "600" },
      { text: "\n" },
      { text: subtitle, lineJustify: "center", lineFontSize: 13, lineFontWeight: "600" },
    ],
  };
}

export function defaultStyledAgendaRows(theme: AgendaThemePreset = AGENDA_DEFAULT_THEME): AgendaRowData[] {
  return DEFAULT_ROWS.map((r, i) => ({
    ...r,
    id: `${AGENDA_ROW_PREFIX}${i + 1}`,
    rowStyle: {
      backgroundColor: theme.rowFills[i] ?? theme.rowFills[0],
      backgroundStyle: "solid",
    },
  }));
}

/** Node-level defaults when dropping an agenda card from the palette. */
export function defaultAgendaPaletteNodeProps(): Partial<DiagramNodeData> {
  return {
    width: AGENDA_DEFAULT_WIDTH,
    height: AGENDA_DEFAULT_HEIGHT,
    borderStyle: "gradient",
    borderColors: ["#0d7b96", "#14b8a6"],
    borderWidth: 1,
    backgroundStyle: "none",
    shadow: true,
    shadowColor: "#0284c7",
    shadowOpacity: 0.2,
    shadowBlur: 5,
    textColor: AGENDA_DEFAULT_THEME.textColor,
    textOpacity: 1,
    gradientAngle: AGENDA_DEFAULT_THEME.gradientAngle,
    textJustify: "center",
    cornerRadius: AGENDA_DEFAULT_CORNER_RADIUS,
    borderColor: "#0d9488",
    lineStyle: "solid",
    lineColor: "#0369a1",
    lineWidth: 2.5,
    lineOpacity: 1,
    agendaRowThemeHue: true,
  } as Partial<DiagramNodeData>;
}

export function createDefaultAgendaRoot(date: Date = new Date()): CardElementData {
  return createAgendaRoot(
    formatAgendaDateHeader(date),
    defaultStyledAgendaRows(),
    "end",
    "start",
    { theme: AGENDA_DEFAULT_THEME, date, dateSubtitle: AGENDA_DEFAULT_THEME.dateSubtitle },
  );
}

export function createAgendaRoot(
  dateText: string,
  rows: AgendaRowData[],
  timeJustify: CardFlexJustify = "start",
  sessionJustify: CardFlexJustify = "start",
  options?: AgendaRootOptions,
): CardElementData {
  const theme = options?.theme;
  const dividerColor = theme?.dividerColor ?? AGENDA_DIVIDER_COLOR_DEFAULT;
  const textColor = theme?.textColor;
  const syncTimeJustify = !!theme;

  const entryChildren: CardElementData[] = [];
  rows.forEach((row, i) => {
    entryChildren.push(
      agendaRowSection(row, timeJustify, sessionJustify, dividerColor, textColor, syncTimeJustify),
    );
    if (i < rows.length - 1) {
      entryChildren.push(agendaDivider(`${row.id}-sep`, 0, dividerColor));
    }
  });
  entryChildren.push(agendaAddRowButton(theme?.addRowTextColor ?? "#3b82f6"));

  const dateCell =
    theme && options?.date
      ? agendaDateTextElement(
          dateText,
          options.dateSubtitle ?? theme.dateSubtitle ?? "",
          textColor ?? AGENDA_DEFAULT_THEME.textColor,
        )
      : {
          id: AGENDA_DATE_ID,
          kind: "text" as const,
          text: dateText,
          editable: true,
          fontSize: 13,
          fontWeight: "600",
          textColor: textColor ?? SLATE_DARK,
          layout: {
            width: "100%",
            flex: 0,
            padding: [0, 4] as [number, number],
            justifyContent: "center" as const,
            alignItems: "center" as const,
          },
          style: { backgroundStyle: "none" as const },
        };

  return {
    id: "root",
    kind: "section",
    layout: {
      flexDirection: "column",
      width: "100%",
      height: "100%",
      gap: 0,
      padding: 0,
      overflow: "hidden",
    },
    style: theme
      ? {
          backgroundColor: theme.rootGradient[0],
          backgroundStyle: "gradient",
          backgroundColors: theme.rootGradient,
          gradientAngle: theme.gradientAngle,
        }
      : { backgroundColor: CARD_WHITE, backgroundStyle: "solid" },
    children: [
      {
        id: AGENDA_DATE_HEADER_ID,
        kind: "section",
        layout: {
          width: "100%",
          flex: 0,
          alignSelf: "stretch",
          padding: [12, 14],
          justifyContent: "center",
          alignItems: "center",
        },
        style: {
          backgroundColor: theme?.dateHeaderBg ?? AGENDA_DATE_HEADER_BG,
          backgroundStyle: "solid",
        },
        children: [dateCell],
      },
      agendaDivider(AGENDA_DATE_TABLE_DIVIDER_ID, 0, dividerColor),
      {
        id: AGENDA_TABLE_HEADER_ID,
        kind: "section",
        layout: {
          flexDirection: "row",
          width: "100%",
          flex: 0,
          alignSelf: "stretch",
          alignItems: "stretch",
        },
        style: {
          backgroundColor: theme?.tableHeaderBg ?? AGENDA_TABLE_HEADER_BG_LIGHT,
          backgroundStyle: "solid",
        },
        children: [
          agendaCellText(AGENDA_TIME_HEADER_ID, "Time", {
            header: true,
            onDark: !theme,
            justify: timeJustify,
            textColor,
            syncTextJustify: syncTimeJustify,
          }),
          agendaColumnDivider(AGENDA_COL_DIVIDER_ID, theme ? "default" : "on-dark", dividerColor),
          agendaCellText(AGENDA_SESSION_HEADER_ID, "Session", {
            header: true,
            onDark: !theme,
            justify: sessionJustify,
            textColor,
          }),
        ],
      },
      {
        id: AGENDA_ENTRIES_ID,
        kind: "section",
        layout: {
          flexDirection: "column",
          width: "100%",
          flex: 1,
          minHeight: 0,
          gap: 0,
          padding: 0,
          alignSelf: "stretch",
        },
        style: { backgroundStyle: "none" },
        children: entryChildren,
      },
    ],
  };
}

export function defaultAgendaRows(): AgendaRowData[] {
  return DEFAULT_ROWS.map((r, i) => ({ ...r, id: `${AGENDA_ROW_PREFIX}${i + 1}` }));
}

export function createAgendaTemplate(date: Date = new Date()): CardTemplate {
  return {
    id: AGENDA_TEMPLATE_ID,
    name: "Agenda",
    defaultWidth: AGENDA_DEFAULT_WIDTH,
    defaultHeight: AGENDA_DEFAULT_HEIGHT,
    cornerRadius: AGENDA_DEFAULT_CORNER_RADIUS,
    root: createDefaultAgendaRoot(date),
  };
}

export function isAgendaCard(templateId: string | undefined): boolean {
  return templateId === AGENDA_TEMPLATE_ID;
}

export function isAgendaRowId(elementId: string): boolean {
  return /^row-\d+$/.test(elementId);
}

export function isAgendaTimeCellId(elementId: string): boolean {
  return elementId.endsWith("-time") || elementId === AGENDA_TIME_HEADER_ID;
}

export function isAgendaSessionCellId(elementId: string): boolean {
  return elementId.endsWith("-session") || elementId === AGENDA_SESSION_HEADER_ID;
}

export function isAgendaAddRowId(elementId: string): boolean {
  return elementId === AGENDA_ADD_ROW_ID;
}

/** Horizontal rules between sections/rows, and vertical rules between Time and Session columns. */
export function isAgendaDividerElement(elementId: string): boolean {
  if (elementId.endsWith("-sep")) return true;
  if (elementId === AGENDA_COL_DIVIDER_ID) return true;
  if (elementId === AGENDA_DATE_TABLE_DIVIDER_ID) return true;
  if (elementId === AGENDA_HEADER_ENTRIES_DIVIDER_ID) return true;
  return /^row-\d+-divider$/.test(elementId);
}

function mapAgendaElementTree(
  root: CardElementData,
  mapFn: (el: CardElementData) => CardElementData,
): CardElementData {
  const mapped = mapFn(root);
  if (!mapped.children?.length) return mapped;
  return {
    ...mapped,
    children: mapped.children.map((child) => mapAgendaElementTree(child, mapFn)),
  };
}

export function getAgendaDividerColor(root: CardElementData | undefined): string {
  if (!root) return AGENDA_DIVIDER_COLOR_DEFAULT;
  let found: string | undefined;
  const walk = (el: CardElementData) => {
    if (found) return;
    if (isAgendaDividerElement(el.id) && el.style?.backgroundColor) {
      found = el.style.backgroundColor;
      return;
    }
    for (const child of el.children ?? []) walk(child);
  };
  walk(root);
  return found ?? AGENDA_DIVIDER_COLOR_DEFAULT;
}

export function applyAgendaDividerColor(elements: CardElementData, color: string): CardElementData {
  return mapAgendaElementTree(elements, (el) => {
    if (!isAgendaDividerElement(el.id)) return el;
    return {
      ...el,
      style: { ...el.style, backgroundColor: color, backgroundStyle: "solid" },
    };
  });
}

export function resolveAgendaFullBleedSectionLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardElementData["layout"],
): CardElementData["layout"] | undefined {
  if (!isAgendaCard(templateId)) return layout;
  if (
    elementId !== AGENDA_TABLE_HEADER_ID &&
    elementId !== AGENDA_DATE_HEADER_ID &&
    elementId !== AGENDA_DATE_TABLE_DIVIDER_ID &&
    elementId !== AGENDA_HEADER_ENTRIES_DIVIDER_ID
  ) {
    return layout;
  }
  return {
    ...layout,
    width: "100%",
    alignSelf: "stretch",
    minWidth: 0,
  };
}

/** Entries band is edge-to-edge; legacy templates used vertical padding that gaps the grid lines. */
export function resolveAgendaEntriesSectionLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardElementData["layout"],
): CardElementData["layout"] | undefined {
  if (!isAgendaCard(templateId) || elementId !== AGENDA_ENTRIES_ID) return layout;
  return { ...layout, padding: 0 };
}

export function isAgendaHorizontalDividerElement(elementId: string): boolean {
  if (!isAgendaDividerElement(elementId)) return false;
  if (elementId === AGENDA_COL_DIVIDER_ID) return false;
  if (/^row-\d+-divider$/.test(elementId)) return false;
  return true;
}

/** Horizontal rules stay 1px tall (flex sections otherwise collapse or gap). */
export function resolveAgendaHorizontalDividerLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardElementData["layout"],
): CardElementData["layout"] | undefined {
  if (!isAgendaCard(templateId) || !isAgendaHorizontalDividerElement(elementId)) return layout;
  return {
    ...layout,
    height: 1,
    minHeight: 1,
    flex: 0,
    marginTop: 0,
    marginBottom: 0,
  };
}

export function getAgendaRegions(root: CardElementData | undefined): AgendaRegions {
  if (!root?.children?.length) {
    return {
      dateHeader: null,
      date: null,
      tableHeader: null,
      timeHeader: null,
      sessionHeader: null,
      entries: null,
    };
  }
  const dateHeader = root.children.find((c) => c.id === AGENDA_DATE_HEADER_ID) ?? null;
  const legacyDate = root.children.find((c) => c.id === AGENDA_DATE_ID && c.kind === "text") ?? null;
  const tableHeader = root.children.find((c) => c.id === AGENDA_TABLE_HEADER_ID) ?? null;
  const entries = root.children.find((c) => c.id === AGENDA_ENTRIES_ID) ?? null;
  const date =
    dateHeader?.children?.find((c) => c.id === AGENDA_DATE_ID) ??
    legacyDate ??
    null;
  const timeHeader = tableHeader?.children?.find((c) => c.id === AGENDA_TIME_HEADER_ID) ?? null;
  const sessionHeader = tableHeader?.children?.find((c) => c.id === AGENDA_SESSION_HEADER_ID) ?? null;
  return { dateHeader, date, tableHeader, timeHeader, sessionHeader, entries };
}

export function getAgendaEntriesSection(root: CardElementData | undefined): CardElementData | null {
  return getAgendaRegions(root).entries;
}

export function getAgendaRows(root: CardElementData | undefined): CardElementData[] {
  const entries = getAgendaEntriesSection(root);
  if (!entries?.children?.length) return [];
  return entries.children.filter((c) => c.kind === "section" && isAgendaRowId(c.id));
}

export function parseAgendaRow(row: CardElementData): AgendaRowData {
  const timeEl = row.children?.find((c) => c.id.endsWith("-time"));
  const sessionEl = row.children?.find((c) => c.id.endsWith("-session"));
  return {
    id: row.id,
    time: timeEl?.text ?? "",
    session: sessionEl?.text ?? "",
    highlighted: row.highlighted ?? (row.style?.borderWidth ?? 0) > 0,
    rowStyle: row.style ? { ...row.style } : undefined,
  };
}

function nextAgendaRowId(rows: CardElementData[]): string {
  let max = 0;
  for (const row of rows) {
    const n = Number.parseInt(row.id.slice(AGENDA_ROW_PREFIX.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${AGENDA_ROW_PREFIX}${max + 1}`;
}

function readColumnJustify(root: CardElementData, column: "time" | "session"): CardFlexJustify {
  const headerId = column === "time" ? AGENDA_TIME_HEADER_ID : AGENDA_SESSION_HEADER_ID;
  const header = findCardElement(root, headerId);
  return header?.layout?.justifyContent ?? "start";
}

function readRowFillBaseStyle(root: CardElementData): CardElementStyle {
  const firstRow = getAgendaRows(root)[0];
  if (firstRow?.style?.backgroundColor) {
    return {
      backgroundStyle: firstRow.style.backgroundStyle ?? "solid",
      backgroundColor: firstRow.style.backgroundColor,
      backgroundColors: firstRow.style.backgroundColors,
      gradientAngle: firstRow.style.gradientAngle,
    };
  }
  return { backgroundColor: AGENDA_ROW_FILL_DEFAULT, backgroundStyle: "solid" };
}

function readAgendaCellTextColor(root: CardElementData): string | undefined {
  const timeHeader = findCardElement(root, AGENDA_TIME_HEADER_ID);
  if (timeHeader?.textColor) return timeHeader.textColor;
  const firstRow = getAgendaRows(root)[0];
  if (!firstRow) return undefined;
  return findCardElement(root, `${firstRow.id}-time`)?.textColor;
}

function readAgendaSyncTimeJustify(root: CardElementData): boolean {
  const firstRow = getAgendaRows(root)[0];
  if (!firstRow) return false;
  const timeCell = findCardElement(root, `${firstRow.id}-time`);
  return timeCell?.textJustify != null;
}

function readAgendaAddRowLabelColor(root: CardElementData): string {
  const addLabel = findCardElement(root, "add-row-label");
  return addLabel?.textColor ?? "#3b82f6";
}

function rebuildAgendaEntries(root: CardElementData, rows: AgendaRowData[]): CardElementData {
  const timeJustify = readColumnJustify(root, "time");
  const sessionJustify = readColumnJustify(root, "session");
  const baseFill = readRowFillBaseStyle(root);
  const dividerColor = getAgendaDividerColor(root);
  const cellTextColor = readAgendaCellTextColor(root);
  const syncTimeJustify = readAgendaSyncTimeJustify(root);
  const addRowLabelColor = readAgendaAddRowLabelColor(root);
  const entryChildren: CardElementData[] = [];
  rows.forEach((row, i) => {
    const merged: AgendaRowData = {
      ...row,
      rowStyle: row.rowStyle ?? (row.highlighted ? defaultRowStyle(true) : { ...baseFill }),
    };
    entryChildren.push(
      agendaRowSection(
        merged,
        timeJustify,
        sessionJustify,
        dividerColor,
        cellTextColor,
        syncTimeJustify,
      ),
    );
    if (i < rows.length - 1) {
      entryChildren.push(agendaDivider(`${row.id}-sep`, 0, dividerColor));
    }
  });
  entryChildren.push(agendaAddRowButton(addRowLabelColor));
  return updateCardElementTree(root, AGENDA_ENTRIES_ID, { children: entryChildren });
}

export function addAgendaRow(elements: CardElementData): CardElementData {
  const rows = getAgendaRows(elements);
  const newId = nextAgendaRowId(rows);
  const parsed = rows.map(parseAgendaRow);
  parsed.push({ id: newId, time: "12:00PM", session: "New session" });
  return rebuildAgendaEntries(elements, parsed);
}

export function removeAgendaRow(elements: CardElementData, rowId: string): CardElementData {
  const rows = getAgendaRows(elements);
  if (rows.length <= AGENDA_MIN_ROWS) return elements;
  const parsed = rows.map(parseAgendaRow).filter((r) => r.id !== rowId);
  return rebuildAgendaEntries(elements, parsed);
}

/** Reorder agenda rows by index (0-based, relative to `getAgendaRows` order). */
export function reorderAgendaRows(
  elements: CardElementData,
  fromIndex: number,
  toIndex: number,
): CardElementData {
  const rows = getAgendaRows(elements);
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= rows.length ||
    toIndex >= rows.length
  ) {
    return elements;
  }
  const parsed = rows.map(parseAgendaRow);
  const [moved] = parsed.splice(fromIndex, 1);
  parsed.splice(toIndex, 0, moved);
  return rebuildAgendaEntries(elements, parsed);
}

export function getAgendaRowIndex(elements: CardElementData, rowId: string): number {
  return getAgendaRows(elements).findIndex((r) => r.id === rowId);
}

export function setAgendaRowHighlight(
  elements: CardElementData,
  rowId: string,
  highlighted: boolean,
): CardElementData {
  const row = findCardElement(elements, rowId);
  if (!row) return elements;
  const base = row.style?.backgroundColor
    ? { backgroundColor: row.style.backgroundColor, backgroundStyle: row.style.backgroundStyle ?? "solid" }
    : readRowFillBaseStyle(elements);
  const style: CardElementStyle = highlighted
    ? { ...base, borderColor: HIGHLIGHT_BORDER, borderWidth: 2, borderStyle: "solid", borderRadius: 4 }
    : { ...base, borderWidth: undefined, borderColor: undefined, borderStyle: undefined, borderRadius: undefined };
  return updateCardElementTree(elements, rowId, { highlighted, style });
}

export function applyAgendaRowFillStyle(
  elements: CardElementData,
  stylePatch: Partial<CardElementStyle>,
): CardElementData {
  let next = elements;
  for (const row of getAgendaRows(next)) {
    const el = findCardElement(next, row.id);
    if (!el) continue;
    const merged: CardElementStyle = {
      ...el.style,
      ...stylePatch,
      borderColor: el.highlighted ? el.style?.borderColor ?? HIGHLIGHT_BORDER : stylePatch.borderColor,
      borderWidth: el.highlighted ? el.style?.borderWidth ?? 2 : stylePatch.borderWidth,
      borderStyle: el.highlighted ? el.style?.borderStyle ?? "solid" : stylePatch.borderStyle,
    };
    next = updateCardElementTree(next, row.id, { style: merged });
  }
  return next;
}

export function updateAgendaElementStyle(
  elements: CardElementData,
  elementId: string,
  stylePatch: Partial<CardElementStyle>,
): CardElementData {
  const el = findCardElement(elements, elementId);
  if (!el) return elements;
  return updateCardElementTree(elements, elementId, {
    style: { ...el.style, ...stylePatch },
  });
}

export function setAgendaColumnAlign(
  elements: CardElementData,
  column: "time" | "session",
  justify: CardFlexJustify,
): CardElementData {
  const headerId = column === "time" ? AGENDA_TIME_HEADER_ID : AGENDA_SESSION_HEADER_ID;
  const suffix = column === "time" ? "-time" : "-session";
  let next = elements;
  const header = findCardElement(next, headerId);
  if (header) {
    next = updateCardElementTree(next, headerId, {
      layout: { ...header.layout, justifyContent: justify },
      textJustify: flexJustifyToTextJustify(justify),
    });
  }
  for (const row of getAgendaRows(next)) {
    const cellId = `${row.id}${suffix}`;
    const cell = findCardElement(next, cellId);
    if (cell) {
      next = updateCardElementTree(next, cellId, {
        layout: { ...cell.layout, justifyContent: justify },
        textJustify: flexJustifyToTextJustify(justify),
      });
    }
  }
  return next;
}

export function setAgendaCellAlign(
  elements: CardElementData,
  elementId: string,
  justify: CardFlexJustify,
): CardElementData {
  const el = findCardElement(elements, elementId);
  if (!el) return elements;
  return updateCardElementTree(elements, elementId, {
    layout: { ...el.layout, justifyContent: justify },
    textJustify: flexJustifyToTextJustify(justify),
  });
}

function isDefaultTableHeaderBg(color: string | undefined, isDark: boolean): boolean {
  if (!color) return true;
  const c = color.toLowerCase();
  return (
    c === AGENDA_TABLE_HEADER_BG_LIGHT.toLowerCase() ||
    c === AGENDA_TABLE_HEADER_BG_DARK.toLowerCase()
  );
}

/** Theme-aware column header band (dark in light UI, inverted in dark UI). */
export function resolveAgendaTableHeaderSectionStyle(
  elementId: string,
  templateId: string | undefined,
  style: CardElementStyle | undefined,
  isDark: boolean,
): CardElementStyle | undefined {
  if (!isAgendaCard(templateId) || elementId !== AGENDA_TABLE_HEADER_ID) return style;
  if (!isDefaultTableHeaderBg(style?.backgroundColor, isDark)) return style;
  return {
    ...style,
    backgroundStyle: "solid",
    backgroundColor: isDark ? AGENDA_TABLE_HEADER_BG_DARK : AGENDA_TABLE_HEADER_BG_LIGHT,
  };
}

export function resolveAgendaTableHeaderTextColor(
  elementId: string,
  templateId: string | undefined,
  textColor: string | undefined,
  isDark: boolean,
  tableHeaderStyle?: CardElementStyle,
): string | undefined {
  if (!isAgendaCard(templateId)) return textColor;
  if (elementId !== AGENDA_TIME_HEADER_ID && elementId !== AGENDA_SESSION_HEADER_ID) return textColor;
  if (tableHeaderStyle?.backgroundColor && !isDefaultTableHeaderBg(tableHeaderStyle.backgroundColor, isDark)) {
    return textColor;
  }
  const defaultText = isDark ? AGENDA_TABLE_HEADER_TEXT_DARK : AGENDA_TABLE_HEADER_TEXT_LIGHT;
  if (!textColor || textColor === AGENDA_TABLE_HEADER_TEXT_LIGHT || textColor === SLATE_DARK) {
    return defaultText;
  }
  return textColor;
}

export function resolveAgendaRowStyle(
  elementId: string,
  templateId: string | undefined,
  style: CardElementStyle | undefined,
  rowIndex: number,
  themeHue: boolean,
  hueStepDeg: number,
): CardElementStyle | undefined {
  if (!isAgendaCard(templateId) || !isAgendaRowId(elementId)) return style;
  if (!style) return style;
  let resolved = { ...style };
  if (themeHue && resolved.backgroundStyle === "solid" && resolved.backgroundColor) {
    const delta = rowIndex * hueStepDeg;
    resolved = {
      ...resolved,
      backgroundColor: delta === 0 ? resolved.backgroundColor : shiftHueOfColor(resolved.backgroundColor, delta),
    };
  }
  return resolved;
}

export function resolveAgendaTimeCellLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardElementData["layout"],
): CardElementData["layout"] | undefined {
  if (!isAgendaCard(templateId) || !isAgendaTimeCellId(elementId)) return layout;
  return {
    ...layout,
    flex: 0,
    width: AGENDA_TIME_COL_WIDTH_PX,
    minWidth: undefined,
    justifyContent: layout?.justifyContent ?? "start",
    alignItems: layout?.alignItems ?? "center",
  };
}

export function resolveAgendaSessionCellLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardElementData["layout"],
): CardElementData["layout"] | undefined {
  if (!isAgendaCard(templateId) || !isAgendaSessionCellId(elementId)) return layout;
  return {
    ...layout,
    flex: 1,
    width: undefined,
    minWidth: 0,
  };
}

export function resolveAgendaTimeTextStyle(
  elementId: string,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isAgendaCard(templateId)) return undefined;
  if (!isAgendaTimeCellId(elementId) || elementId === AGENDA_TIME_HEADER_ID) return undefined;
  return { whiteSpace: "nowrap" };
}

export function agendaRowThemeHueEnabled(
  nodeAgendaRowThemeHue: boolean | undefined,
  globalMultiHue: boolean,
): boolean {
  if (typeof nodeAgendaRowThemeHue === "boolean") return nodeAgendaRowThemeHue;
  return globalMultiHue;
}

export function agendaRowHueStepDeg(nodeHueStep: number | undefined): number {
  if (typeof nodeHueStep === "number" && Number.isFinite(nodeHueStep)) return nodeHueStep;
  return DIAGRAM_THEME_HUE_STEP_DEG;
}
