# Connector line object (`DiagramNodeData`)

This document describes the **polyline / connector line** shape: diagram nodes whose `type` is a connector line (not the **line chart** `generic.chart.line`).

## Node type

| Condition | Examples |
|-----------|----------|
| Connector line | `generic.object.line`, or any type ending in `.line` **except** types ending in `chart.line` |
| **Not** a connector line | `generic.chart.line` (chart widget) |

Detection in code: `isConnectorLineNodeType()` in `src/lib/utils.ts`.

---

## Required / usual core fields

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique node id |
| `type` | `string` | One of the connector line types above |
| `x`, `y` | `number` (optional but used) | Anchor of the node’s layout box: typically the **top-left** of the bounding box that contains the whole stroke (including interior points and curve bulge). Updated when endpoints or control points move so connections and hit targets stay correct |
| `startPos` | `{ x: number; y: number }` (optional) | **Absolute canvas** coordinates of the **start** vertex |
| `endPos` | `{ x: number; y: number }` (optional) | **Absolute canvas** coordinates of the **end** vertex |

If `startPos` / `endPos` are omitted, fallbacks derive from `x`, `y` and a default span (see `getConnectorLineVertices` in `src/lib/line-curve-path.ts`).

---

## Path geometry (polyline / spline)

Vertices are always, in order: **`[startPos, …lineControlPoints, endPos]`** when interior points exist.

| Property | Type | Default / notes |
|----------|------|------------------|
| `linePathStyle` | `'straight' \| 'curved'` | **Omitted or non-`curved`** ⇒ treated as **straight** for path mode |
| `lineControlPoints` | `{ x, y, id? }[]` | Interior knots in **absolute canvas** coords, between `startPos` and `endPos`. Omitted or `[]` ⇒ single segment from start to end (unless curved mode synthesizes a midpoint; see below) |
| `lineSmoothJoints` | `boolean` | **Straight mode only**, and only meaningful when there is **at least one** interior point. When `true`, corners use **quadratic fillets** (slight rounding) instead of sharp corners. Cleared when switching to **curved** path style |

### `linePathStyle: 'straight'` (or unset)

- **No** interior points: one straight segment from `startPos` to `endPos`.
- **With** `lineControlPoints`: open **polyline** through all vertices in order.
- **`lineSmoothJoints: true`**: same polyline, with rounded corners (fillet radius scales with segment length, capped in implementation).

### `linePathStyle: 'curved'`

- Renders a **smooth Catmull–Rom** spline (converted to SVG cubic Béziers) through all vertices.
- If there are **no** stored `lineControlPoints`, a **single synthetic midpoint** between `startPos` and `endPos` is used for display so the curve is not degenerate.
- **`lineSmoothJoints`** is not used in curved mode (whole path is already smooth).

Implementation reference: `getConnectorLineVertices`, `straightPolylineToSvgPathD`, `catmullRomToSvgPathD`, `connectorLinePathD` in `src/lib/line-curve-path.ts`; rendering in `src/components/diagram/shapes/line.tsx`.

---

## Stroke appearance

| Property | Type | Description |
|----------|------|-------------|
| `lineColor` | `string` (optional) | Stroke colour (falls back to a neutral grey in the shape if unset) |
| `lineThickness` | `number` (optional) | Stroke width in px; default in UI ~**2.5** |
| `lineType` | `'solid' \| 'dashed' \| 'dotted'` (optional) | Stroke dash pattern |
| `startCap` | `'none' \| 'arrow' \| 'dot' \| 'square'` (optional) | Decoration at **start** vertex (outward from the stroke) |
| `endCap` | `'none' \| 'arrow' \| 'dot' \| 'square'` (optional) | Decoration at **end** vertex (along stroke direction at the end) |

Caps use the same angle convention as the tangent at the true start/end of the rendered path (straight segment or spline).

---

## Closed path (start ≈ end)

When the first and last **rendered** vertices are within a small distance (**`isConnectorLineGeometryClosed`** in `line-curve-path.ts`, default **6px**), the line is treated as **closed**:

- **`LineShape`** appends **`Z`** to the path, draws an **area fill** from the same visual fields as other shapes (`backgroundStyle`, `backgroundColor`, `backgroundColors`, `gradientAngle`), and **does not render** start/end caps. **Line Styling** hides the Start/End cap controls while the path is closed.
- **Context toolbar** and **context menu** expose **Visual Styling** for closed connector lines (same panel as shapes) so you can set solid/gradient fill, border, shadow, etc.

### Border / outline (visual styling)

When the node has **explicit** border fields from Visual Styling (`borderStyle`, `borderColor`, `borderColors`, `borderWidth`, `borderGradientAngle`), **`LineShape`** draws that border as an SVG **stroke** along the path (open: `pathD`; closed: `pathDClosed`): **solid**, **dotted**, or **gradient** (same `useSvgGradient` pattern as rectangles). **`borderStyle: none`** leaves border stroke off; the polyline then uses **Line Styling** only (`lineColor`, `lineThickness`, `lineType`). If a visual border is active, the Line Styling stroke is omitted so the outline matches normal shapes; open-line **caps** use the border paint in that case.

---

## Label and text along the line

The node’s **`label`** (plain string) is drawn along the path when non-empty.

| Property | Type | Description |
|----------|------|-------------|
| `lineTextPosition` | `number` (optional) | Position along path by **arc length**, **0–100** (percent). Default **50** (midpoint) |
| `lineTextVerticalPosition` | `'above' \| 'middle' \| 'below'` (optional) | Offset perpendicular to the local tangent at the label position (`middle` = on path) |
| `lineTextHorizontal` | `boolean` (optional) | If `true`, label stays **horizontal** (readable) even when the path is steep or right-to-left |

Line labels also use the node’s general **text styling** fields where applicable (`fontFamily`, `fontSize`, `fontWeight`, `textColor`, `textDecoration`, `textOpacity`, outline/shadow fields, etc.) via `extractTextStylingFromNode` in `line.tsx`.

---

## Editor behaviour (functional, not JSON)

- **Connections**: **double-click** a **bezier** or **orthogonal** link between two items inserts a **rectangle** node on the link at the nearest point on the path, replaces the one edge with **two** edges (same style/colours as the original; waypoints and orthogonal trunk offsets are cleared so routing stays valid). Self-loops are ignored.
- **Selection**: green **square handles** (same visual language as connection endpoint helpers) on **every** vertex: start, each `lineControlPoints` entry, and end (`LineVertexHandles`).
- **Context menu** (connector line node): **Curved line**, **Add point** (inserts midpoint on longest segment), **Smooth joints** (only when straight and there is at least one interior point), plus **Line styling** and other generic node actions.
- **Move whole line**: translating the node updates `x`, `y`, `startPos`, `endPos`, and all `lineControlPoints` together.
- **Bounding box** / `measureNodeDims`: includes all vertices and approximate curve extent for curved or smooth-jointed paths.

---

## Other `DiagramNodeData` fields that apply like any node

Connector lines still support, where relevant: `locked`, `layer`, `label`, `tag`, `info`, `linkUrl`, `metaData`, `subDiagramId`, `groupId`, `freeflow`, `ignoreConnectionAvoidance`, `highlightAnim*`, etc. Many shape-only or icon-only fields have no effect on the line renderer.

---

## Persistence and validation

- Line-specific fields are part of **`DiagramNodeData`** in `src/lib/types.ts` and validated in **`DiagramNodeDataSchema`** / nested schemas in `src/lib/schemas.ts` (including `linePathStyle`, `lineControlPoints`, `lineSmoothJoints`, caps, `lineType`, `lineThickness`, `startPos`, `endPos`, `lineTextVerticalPosition`).
- Some type-level fields (e.g. `lineTextPosition`, `lineTextHorizontal`) may exist on the TypeScript interface; confirm the Zod schema if you rely on strict JSON import validation.

---

## Quick JSON example

```json
{
  "id": "line-1",
  "type": "generic.object.line",
  "x": 100,
  "y": 80,
  "startPos": { "x": 100, "y": 80 },
  "endPos": { "x": 400, "y": 200 },
  "lineControlPoints": [
    { "x": 220, "y": 180 },
    { "x": 320, "y": 100 }
  ],
  "linePathStyle": "straight",
  "lineSmoothJoints": true,
  "lineColor": "#6b7280",
  "lineThickness": 2.5,
  "lineType": "solid",
  "startCap": "none",
  "endCap": "arrow",
  "label": "Segment A",
  "lineTextPosition": 45,
  "lineTextVerticalPosition": "above",
  "lineTextHorizontal": false
}
```

Curved variant: set `"linePathStyle": "curved"` and omit or adjust `lineSmoothJoints` (ignored for rendering when curved).
