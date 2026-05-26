import type { CardElementData, CardTemplate } from "@/lib/card-types";
import { createAgendaTemplate } from "@/lib/card-agenda";
import { createDashboardStatTemplate } from "@/lib/card-dashboard-stat";

const BLUE = "#3b82f6";
const BLUE_LIGHT = "#bfdbfe";
const BLUE_MUTED = "#93c5fd";

const TEAL = "#2ab7bc";
const SLATE_DARK = "#2d3748";
const SLATE_MUTED = "#718096";
const DIVIDER_GRAY = "#e2e8f0";
const CARD_WHITE = "#ffffff";

function profileSocialStatColumn(
  valueId: string,
  labelId: string,
  value: string,
  label: string,
): CardElementData {
  return {
    id: valueId.replace("-value", ""),
    kind: "section",
    layout: { flexDirection: "column", flex: 1, alignItems: "center", gap: 2, minWidth: 0 },
    children: [
      {
        id: valueId,
        kind: "text",
        text: value,
        editable: true,
        fontSize: 13,
        fontWeight: "700",
        textColor: SLATE_DARK,
        layout: { alignSelf: "center", padding: [0, 2] },
        style: { backgroundStyle: "none" },
      },
      {
        id: labelId,
        kind: "text",
        text: label,
        editable: true,
        fontSize: 9,
        textColor: SLATE_MUTED,
        layout: { alignSelf: "center", padding: [0, 2] },
        style: { backgroundStyle: "none" },
      },
    ],
  };
}

/** Registry of built-in card templates (palette + drop defaults). */
export const CARD_TEMPLATES: Record<string, CardTemplate> = {
  "profile-feature": {
    id: "profile-feature",
    name: "Profile Feature",
    defaultWidth: 160,
    defaultHeight: 200,
    cornerRadius: 0.12,
    root: {
      id: "root",
      kind: "section",
      layout: { flexDirection: "column", width: "100%", height: "100%", gap: 0, padding: 0, overflow: "hidden" },
      children: [
        {
          id: "hero",
          kind: "icon-slot",
          layout: { flex: 55, width: "100%", minHeight: 0 },
          style: { backgroundColor: BLUE, backgroundStyle: "solid" },
          placeholder: "rect",
        },
        {
          id: "body",
          kind: "section",
          layout: { flexDirection: "column", padding: 12, gap: 8, flex: 45, minHeight: 0 },
          style: { backgroundColor: "#fffbeb", backgroundStyle: "solid" },
          children: [
            {
              id: "title",
              kind: "text",
              text: "Card title",
              editable: true,
              fontSize: 14,
              fontWeight: "600",
              textColor: "#1e3a5f",
              layout: { width: "75%", padding: [8, 12] },
              style: { backgroundColor: BLUE_MUTED, backgroundStyle: "solid", borderRadius: 4 },
            },
            {
              id: "subtitle",
              kind: "text",
              text: "Subtitle or short description",
              editable: true,
              fontSize: 11,
              textColor: "#334155",
              layout: { width: "55%", padding: [8, 12] },
              style: { backgroundColor: BLUE_LIGHT, backgroundStyle: "solid", borderRadius: 4 },
            },
          ],
        },
      ],
    },
  },

  "profile-diagonal-split": {
    id: "profile-diagonal-split",
    name: "Profile Diagonal Split",
    defaultWidth: 160,
    defaultHeight: 160,
    cornerRadius: 0.08,
    root: {
      id: "root",
      kind: "section",
      layout: { width: "100%", height: "100%", padding: 0, overflow: "hidden" },
      children: [
        {
          id: "body",
          kind: "section",
          layout: { flex: 0, width: "100%", height: "100%" },
          style: { backgroundColor: "#faf8f5", backgroundStyle: "solid" },
        },
        {
          id: "hero",
          kind: "section",
          layout: { flex: 52, height: "100%", gap: 18 },
          style: {
            backgroundStyle: "gradient",
            backgroundColors: ["#fde8d0", "#e8a86b"],
            gradientAngle: 135,
          },
        },
        {
          id: "content",
          kind: "section",
          layout: {
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 12,
            width: "100%",
            height: "100%",
          },
          style: { backgroundStyle: "none" },
          children: [
            {
              id: "text-stack",
              kind: "section",
              layout: {
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                width: "100%",
                flex: 1,
                justifyContent: "center",
              },
              children: [
                {
                  id: "title",
                  kind: "text",
                  text: "Title",
                  editable: true,
                  fontSize: 14,
                  fontWeight: "600",
                  textColor: "#8b2942",
                  layout: { width: "72%", padding: [8, 12], alignSelf: "center" },
                  style: { backgroundColor: "#e5e7eb", backgroundStyle: "solid", borderRadius: 2 },
                },
                {
                  id: "subtitle",
                  kind: "text",
                  text: "small text",
                  editable: true,
                  fontSize: 11,
                  textColor: "#8b2942",
                  layout: { width: "58%", padding: [6, 10], alignSelf: "center" },
                  style: { backgroundColor: "#e5e7eb", backgroundStyle: "solid", borderRadius: 2 },
                },
              ],
            },
          ],
        },
        {
          id: "avatar",
          kind: "icon-slot",
          layout: { width: 48, height: 48, flex: 0 },
          style: {
            borderRadius: 999,
            backgroundColor: "#a8d5a2",
            backgroundStyle: "solid",
            borderColor: "#475569",
            borderWidth: 2,
            borderStyle: "solid",
          },
          placeholder: "circle",
          iconFillSlot: true,
          matchCardBorder: false,
        },
      ],
    },
  },

  "profile-social": {
    id: "profile-social",
    name: "Profile Social",
    defaultWidth: 175,
    defaultHeight: 260,
    cornerRadius: 0.12,
    root: {
      id: "root",
      kind: "section",
      layout: { flexDirection: "column", width: "100%", height: "100%", gap: 0, padding: 0, overflow: "hidden" },
      style: { backgroundColor: CARD_WHITE, backgroundStyle: "solid" },
      children: [
        {
          id: "hero",
          kind: "section",
          layout: { flex: 38, width: "100%", minHeight: 0 },
          style: { backgroundColor: TEAL, backgroundStyle: "solid" },
        },
        {
          id: "body",
          kind: "section",
          layout: {
            flexDirection: "column",
            flex: 62,
            width: "100%",
            minHeight: 0,
            alignItems: "center",
            gap: 6,
            padding: [0, 12, 12, 12],
          },
          style: { backgroundColor: CARD_WHITE, backgroundStyle: "solid" },
          children: [
            {
              id: "avatar",
              kind: "icon-slot",
              layout: { width: 56, height: 56, flex: 0, alignSelf: "center", marginTop: -28, zIndex: 2 },
              style: {
                borderRadius: 999,
                backgroundColor: TEAL,
                backgroundStyle: "solid",
                borderColor: CARD_WHITE,
                borderWidth: 4,
                borderStyle: "solid",
              },
              placeholder: "circle",
              iconFillSlot: true,
              matchCardBorder: false,
              iconSlotShadow: true,
            },
            {
              id: "info",
              kind: "section",
              layout: { flexDirection: "column", alignItems: "center", gap: 2, width: "100%", flex: 0 },
              children: [
                {
                  id: "name-row",
                  kind: "section",
                  layout: {
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "center",
                    gap: 6,
                    width: "100%",
                    flex: 0,
                  },
                  children: [
                    {
                      id: "name",
                      kind: "text",
                      text: "Victor Crest",
                      editable: true,
                      fontSize: 14,
                      fontWeight: "700",
                      textColor: SLATE_DARK,
                      layout: { alignSelf: "center", padding: [0, 2] },
                      style: { backgroundStyle: "none" },
                    },
                    {
                      id: "age",
                      kind: "text",
                      text: "26",
                      editable: true,
                      fontSize: 12,
                      fontWeight: "400",
                      textColor: SLATE_MUTED,
                      layout: { alignSelf: "center", padding: [0, 2] },
                      style: { backgroundStyle: "none" },
                    },
                  ],
                },
                {
                  id: "location",
                  kind: "text",
                  text: "London",
                  editable: true,
                  fontSize: 11,
                  textColor: SLATE_MUTED,
                  layout: { alignSelf: "center", padding: [0, 2] },
                  style: { backgroundStyle: "none" },
                },
              ],
            },
            {
              id: "description",
              kind: "text",
              text: "Short bio or description",
              editable: true,
              fontSize: 10,
              lineHeight: 1.4,
              textColor: SLATE_MUTED,
              layout: {
                width: "100%",
                flex: 1,
                minHeight: 0,
                flexDirection: "column",
                justifyContent: "start",
                alignSelf: "stretch",
                fillRemaining: true,
                overflow: "hidden",
                padding: [4, 8],
              },
              style: { backgroundStyle: "none" },
            },
            {
              id: "footer",
              kind: "section",
              layout: {
                flexDirection: "column",
                width: "100%",
                flex: 0,
                alignSelf: "stretch",
                gap: 0,
                minHeight: 0,
              },
              children: [
                {
                  id: "divider",
                  kind: "section",
                  layout: { width: "100%", height: 1, flex: 0, marginTop: 8, marginBottom: 4 },
                  style: { backgroundColor: DIVIDER_GRAY, backgroundStyle: "solid" },
                },
                {
                  id: "stats",
                  kind: "section",
                  layout: {
                    flexDirection: "row",
                    width: "100%",
                    flex: 0,
                    justifyContent: "space-between",
                    alignItems: "start",
                    gap: 4,
                    minHeight: 0,
                    padding: [4, 0, 0, 0],
                  },
                  children: [
                    profileSocialStatColumn("stat-1-value", "stat-1-label", "80K", "Followers"),
                    profileSocialStatColumn("stat-2-value", "stat-2-label", "803K", "Likes"),
                    profileSocialStatColumn("stat-3-value", "stat-3-label", "1.4K", "Photos"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },

  "compact-horizontal": {
    id: "compact-horizontal",
    name: "Compact Horizontal",
    defaultWidth: 220,
    defaultHeight: 80,
    cornerRadius: 0.2,
    root: {
      id: "root",
      kind: "section",
      layout: {
        flexDirection: "row",
        width: "100%",
        height: "100%",
        padding: [10, 12],
        gap: 12,
        alignItems: "center",
      },
      style: { backgroundColor: "#f8fafc", backgroundStyle: "solid" },
      children: [
        {
          id: "avatar",
          kind: "icon-slot",
          layout: { width: 44, height: 44, flex: 0, overflow: "hidden" },
          style: { borderRadius: 999, backgroundColor: BLUE, backgroundStyle: "solid" },
          placeholder: "circle",
          iconFillSlot: true,
          matchCardBorder: true,
        },
        {
          id: "text-col",
          kind: "section",
          layout: {
            flexDirection: "column",
            flex: 1,
            gap: 5,
            justifyContent: "center",
            minWidth: 0,
            alignItems: "stretch",
          },
          children: [
            {
              id: "name",
              kind: "text",
              text: "Name or label",
              editable: true,
              fontSize: 13,
              fontWeight: "600",
              lineHeight: 1.25,
              textColor: "#1e3a5f",
              layout: { width: "88%", alignSelf: "start", padding: [4, 10] },
              style: { backgroundColor: BLUE_MUTED, backgroundStyle: "solid", borderRadius: 4 },
            },
            {
              id: "status",
              kind: "text",
              text: "Status or role",
              editable: true,
              fontSize: 10,
              lineHeight: 1.25,
              textColor: "#475569",
              layout: { width: "68%", alignSelf: "start", padding: [3, 10] },
              style: { backgroundColor: BLUE_LIGHT, backgroundStyle: "solid", borderRadius: 4 },
            },
          ],
        },
      ],
    },
  },

  "list-item-row": {
    id: "list-item-row",
    name: "List Item Row",
    defaultWidth: 220,
    defaultHeight: 44,
    cornerRadius: 0.15,
    root: {
      id: "root",
      kind: "section",
      layout: {
        flexDirection: "row",
        width: "100%",
        height: "100%",
        padding: [8, 10],
        gap: 10,
        alignItems: "center",
      },
      style: { backgroundColor: "#f8fafc", backgroundStyle: "solid" },
      children: [
        {
          id: "indicator",
          kind: "icon-slot",
          layout: { width: 20, height: 20, flex: 0, overflow: "hidden" },
          style: { borderRadius: 999, backgroundColor: BLUE, backgroundStyle: "solid" },
          placeholder: "circle",
          iconFillSlot: true,
          matchCardBorder: true,
        },
        {
          id: "label",
          kind: "text",
          text: "List item label",
          editable: true,
          fontSize: 12,
          textColor: "#1e3a5f",
          layout: { flex: 1, padding: [8, 12] },
          style: { backgroundColor: BLUE_LIGHT, borderRadius: 4 },
        },
        {
          id: "drag-handle",
          kind: "decor",
          placeholder: "dots",
          layout: { width: 16, height: 24, flex: 0 },
        },
      ],
    },
  },

  "detail-post": {
    id: "detail-post",
    name: "Detail Post",
    defaultWidth: 180,
    defaultHeight: 220,
    cornerRadius: 0.1,
    root: {
      id: "root",
      kind: "section",
      layout: { flexDirection: "column", width: "100%", height: "100%", padding: 12, gap: 10 },
      style: { backgroundColor: "#f8fafc", backgroundStyle: "solid" },
      children: [
        {
          id: "header",
          kind: "section",
          layout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" },
          children: [
            {
              id: "header-icon",
              kind: "icon-slot",
              layout: { width: 28, height: 28, flex: 0, overflow: "hidden" },
              style: { borderRadius: 6, backgroundColor: BLUE, backgroundStyle: "solid" },
              placeholder: "rect",
              iconFillSlot: true,
              matchCardBorder: true,
            },
            {
              id: "header-tag",
              kind: "tag",
              tag: "Tag",
              editable: true,
              layout: { flex: 0 },
              style: { backgroundColor: BLUE_LIGHT, backgroundStyle: "solid", borderRadius: 4 },
              fontSize: 9,
              textColor: "#1e40af",
            },
          ],
        },
        {
          id: "body",
          kind: "section",
          layout: { flexDirection: "column", flex: 1, gap: 8, width: "100%", minHeight: 0 },
          children: [
            {
              id: "headline",
              kind: "text",
              text: "Headline",
              editable: true,
              fontSize: 14,
              fontWeight: "700",
              textColor: "#0f172a",
              layout: { width: "85%", padding: [8, 12] },
              style: { backgroundColor: BLUE, backgroundStyle: "solid", borderRadius: 4 },
            },
            {
              id: "body-line-1",
              kind: "text",
              text: "Body text line one",
              editable: true,
              fontSize: 10,
              textColor: "#334155",
              layout: { width: "95%", padding: [8, 12] },
              style: { backgroundColor: BLUE_MUTED, backgroundStyle: "solid", borderRadius: 4 },
            },
            {
              id: "body-line-2",
              kind: "text",
              text: "Body text line two",
              editable: true,
              fontSize: 10,
              textColor: "#334155",
              layout: {
                width: "95%",
                flex: 1,
                minHeight: 0,
                flexDirection: "column",
                justifyContent: "start",
                alignSelf: "start",
                fillRemaining: true,
                overflow: "hidden",
                padding: [8, 12],
              },
              style: { backgroundColor: BLUE_LIGHT, backgroundStyle: "solid", borderRadius: 4 },
            },
          ],
        },
        {
          id: "footer",
          kind: "section",
          matchCardBorder: true,
          layout: { width: "100%", padding: 8, flex: 0 },
          style: {
            backgroundColor: BLUE_LIGHT,
            backgroundStyle: "solid",
            borderRadius: 8,
          },
          children: [
            {
              id: "cta",
              kind: "text",
              text: "Call to action",
              editable: true,
              fontSize: 10,
              fontWeight: "600",
              textColor: BLUE,
              layout: { width: "100%", alignItems: "center", justifyContent: "center", padding: [8, 12] },
              style: {
                borderRadius: 4,
                backgroundColor: "transparent",
                backgroundStyle: "none",
              },
            },
          ],
        },
      ],
    },
  },

  "dashboard-score": createDashboardStatTemplate({
    id: "dashboard-score",
    name: "Dashboard Score",
    defaultWidth: 200,
    defaultHeight: 120,
    gradient: ["#ddd6fe", "#7c3aed"],
    title: "Overall Score",
    value: "8 / 10",
  }),

  "dashboard-ranking": createDashboardStatTemplate({
    id: "dashboard-ranking",
    name: "Dashboard Ranking",
    defaultWidth: 200,
    defaultHeight: 120,
    gradient: ["#bbf7d0", "#16a34a"],
    title: "Ranking",
    value: "25",
  }),

  "dashboard-incentives": createDashboardStatTemplate({
    id: "dashboard-incentives",
    name: "Dashboard Incentives",
    defaultWidth: 200,
    defaultHeight: 160,
    gradient: ["#bae6fd", "#0284c7"],
    title: "Incentives",
    subtitle: "worth of",
    value: "$ 15",
    valueFontSize: 36,
  }),

  "dashboard-defaults": createDashboardStatTemplate({
    id: "dashboard-defaults",
    name: "Dashboard Defaults",
    defaultWidth: 200,
    defaultHeight: 120,
    gradient: ["#fecdd3", "#db2777"],
    title: "Defaults",
    value: "2",
  }),

  agenda: createAgendaTemplate(),
};

export const CARD_TEMPLATE_LIST = Object.values(CARD_TEMPLATES);

export function getCardTemplate(templateId: string): CardTemplate | undefined {
  return CARD_TEMPLATES[templateId];
}
