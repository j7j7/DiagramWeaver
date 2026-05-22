import type { CardTemplate } from "@/lib/card-types";

const BLUE = "#3b82f6";
const BLUE_LIGHT = "#bfdbfe";
const BLUE_MUTED = "#93c5fd";

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
      children: [
        {
          id: "indicator",
          kind: "icon-slot",
          layout: { width: 20, height: 20, flex: 0 },
          style: { borderRadius: 999, backgroundColor: BLUE },
          placeholder: "circle",
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
      children: [
        {
          id: "header",
          kind: "section",
          layout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" },
          children: [
            {
              id: "header-icon",
              kind: "icon-slot",
              layout: { width: 28, height: 28, flex: 0 },
              style: { borderRadius: 6, backgroundColor: BLUE },
              placeholder: "rect",
            },
            {
              id: "header-tag",
              kind: "tag",
              tag: "Tag",
              layout: { flex: 0 },
              style: { backgroundColor: BLUE_LIGHT, borderRadius: 4 },
              fontSize: 9,
              textColor: "#1e40af",
            },
          ],
        },
        {
          id: "body",
          kind: "section",
          layout: { flexDirection: "column", flex: 1, gap: 8, width: "100%" },
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
              style: { backgroundColor: BLUE, borderRadius: 4 },
            },
            {
              id: "body-line-1",
              kind: "text",
              text: "Body text line one",
              editable: true,
              fontSize: 10,
              textColor: "#334155",
              layout: { width: "95%", padding: [8, 12] },
              style: { backgroundColor: BLUE_MUTED, borderRadius: 4 },
            },
            {
              id: "body-line-2",
              kind: "text",
              text: "Body text line two",
              editable: true,
              fontSize: 10,
              textColor: "#334155",
              layout: { width: "70%", padding: [8, 12] },
              style: { backgroundColor: BLUE_LIGHT, borderRadius: 4 },
            },
          ],
        },
        {
          id: "footer",
          kind: "section",
          layout: { width: "100%", padding: 8, flex: 0 },
          style: {
            backgroundColor: BLUE_LIGHT,
            borderColor: "#0f172a",
            borderWidth: 1,
            borderStyle: "solid",
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
                borderStyle: "dashed",
                borderColor: BLUE,
                borderWidth: 1,
                borderRadius: 4,
                backgroundColor: "transparent",
              },
            },
          ],
        },
      ],
    },
  },
};

export const CARD_TEMPLATE_LIST = Object.values(CARD_TEMPLATES);

export function getCardTemplate(templateId: string): CardTemplate | undefined {
  return CARD_TEMPLATES[templateId];
}
