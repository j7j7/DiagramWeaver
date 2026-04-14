# Charts on the canvas

DiagramWeaver supports **data-driven chart nodes** under the `generic.chart.*` type namespace. The first implementation is the **pie chart** (`generic.chart.pie`). Bar and line charts can follow the same pattern: extend `ChartKind`, add palette + `addNode` defaults, a shape renderer, and chart-specific editor fields.

## User-facing workflow

1. **Palette**: **Generic → Object → Pie chart** (resource `pie-chart.png`).
2. **Data**: Right-click the node → **Chart data** → edit slices (name, value, **fill mode** none/solid/gradient, colors, **per-slice label size**, label text color). **Segment labels** can be turned off chart-wide; with **more than two** slices, slice rows open **collapsed** by default.
3. **Appearance** (modal): **Slice outline**, **Pie drop shadow**, **Segment labels** (on/off), **Segment separation** (chart-wide default **0–3** SVG units), and per-slice **Segment pull override** (**0–4** slider, empty = use chart default). **Visual styling** sets **border width** / **border style**; slice **gradient direction** uses **`gradientAngle`**. The modal outline color only applies when the chart override is set or you rely on the node border.
4. **Global styling**: **Visual styling** (context menu) controls **Border width**, **Border style** (including **none**), **Background** (solid / gradient / none), **`gradientAngle`**, and **Shadow** on the shape wrapper (`filter: var(--shape-shadow-drop)` when `useSvgShadow`). The chart’s **Pie drop shadow** is independent and stacks if both are enabled.
5. **Diagram themes**: Applying a theme to a pie chart updates **each slice** from the theme’s **background** (solid, gradient, or none). Consecutive slices are shifted on the **hue wheel** by **36°** per slice (`DIAGRAM_THEME_HUE_STEP_DEG` in `theme-manager.ts`), so a green theme becomes green, green+36°, green+72°, … for both solid and gradient fills. **Label** colors on slices use the theme **`textColor`** when the theme defines it.

## Data model (`DiagramNodeData.chart`)

Stored as **`NodeChartSpec`** (`src/lib/types.ts`):

| Field | Type | Purpose |
|--------|------|---------|
| `kind` | `'pie'` | Discriminator for editors and renderers. |
| `series` | `ChartSeriesItem[]` | Slice rows: `id?`, `name`, `value`, `color?`, `labelColor?`, `labelFontSize?` (2–14, SVG viewBox units), `segmentPull?` (0–4, optional radial pull replacing chart default for that slice), `fillStyle?`, `gradientColors?`. |
| `sliceBorderColor?` | `string` | Stroke color for wedge outlines. If omitted, uses the node’s **`borderColor`** (Visual styling), then `#6b7280`. |
| `shadow?` | `boolean` | If `true`, applies an **SVG `feDropShadow`** on the pie geometry (see `PieChartShape`). Independent of the node-level **Shadow** toggle in Visual styling (both can be on). |
| `showSegmentLabels?` | `boolean` | If **`false`**, slice names are not drawn. Omitted or **`true`** = show labels. |
| `segmentGapDeg?` | `number` | **Chart default radial pull** for slices without `segmentPull` (0–`CHART_MAX_SEGMENT_PULL`, **3**). **Does not change slice angles.** For mixed pulls, **`pieSlicesForSvg`** scales pulls so **max effective pull + rDraw ≤ outer budget** and **`rDraw ≥ PIE_MIN_WEDGE_RADIUS`**. Older JSON above **3** is clamped when applied. JSON key kept for backward compatibility. |

JSON validation: `DiagramNodeDataSchema` in `src/lib/schemas.ts` (`chart` object).

## Library API (`src/lib/chart-node.ts`)

| Export | Description |
|--------|-------------|
| `isChartNodeType(nodeType)` | `true` if `type` starts with `generic.chart.`. |
| `newChartSliceId()` | UUID or random id for a slice row. |
| `defaultPieChartSpec()` | Default `NodeChartSpec` (one slice, value 100). |
| `CHART_MAX_SEGMENT_PULL` | Max **chart default** radial pull stored in `segmentGapDeg` (**3**). |
| `CHART_MAX_PER_SLICE_SEGMENT_PULL` | Max **`series[].segmentPull`** override (**4**). |
| `PIE_MIN_WEDGE_RADIUS` | Floor for wedge radius when pull is large (**5** SVG units). |
| `computePieRadialLayout(outerBudget, segmentGapRequest)` | Single-slice helper: `{ rDraw, pull }` after clamping the chart default and fitting the budget. |
| `scalePullsForOuterBudget(pulls, outerBudget)` | Scales an array of per-slice pulls so the outer rim and minimum wedge radius fit `outerBudget`. |
| `effectiveSliceSegmentPull(seriesItem, chartDefaultPull)` | Resolved pull for one slice (`segmentPull` or chart default). |
| `DEFAULT_PIE_SLICE_COLORS` | Palette when `series[].color` is omitted (solid). |
| `DEFAULT_PIE_SLICE_LABEL_COLOR` | Default label fill when `labelColor` is omitted. |
| `pieSlicesForSvg(cx, cy, outerRadiusBudget, series, options?)` | Builds wedges; returns **`{ slices, rDraw }`** where `rDraw` and per-slice explode distances come from **`scalePullsForOuterBudget`** over each slice’s effective pull. **`slices`** include resolved **`labelFontSize`** via `resolvePieSliceLabelFontSize`. |
| `resolvePieSliceLabelFontSize(seriesItem, spanRadians)` | Per-slice label size or defaults (`DEFAULT_PIE_WEDGE_LABEL_FONT` / `DEFAULT_PIE_FULL_SLICE_LABEL_FONT`). |
| `truncatePieSliceLabel(name, maxLen?)` | Shortens labels for small wedges / preview. |

**Hue shift helper** (themes): `shiftHueOfColor(color, deltaDegrees)` in `src/lib/color-shift.ts` — used when applying diagram themes to pie slices.

## Rendering

| Piece | Path |
|-------|------|
| **Pie** | `src/components/diagram/shapes/pie-chart-shape.tsx` — `SvgShapeBase`, per-slice `<g transform="translate(explode)">`, linear gradients in `<defs>` using **`getGradientCoordinates(node.gradientAngle)`**, per-slice hover, labels, optional SVG drop shadow. |
| **Diagram routing** | `src/components/diagram/diagram-node.tsx` — branches on `generic.chart.*` to `PieChartShape`. |
| **Scratch pad preview** | `src/components/editor/shape-preview.tsx` — same slice builder + gradients + explode. |

## Editor UI

| Piece | Path |
|-------|------|
| **Chart data modal** | `src/components/editor/chart-data-editor-modal.tsx` — slices (fill mode + colors) + chart-level outline / shadow / segment separation. |
| **Context menu** | `src/components/ui/context-menu.tsx` — **Chart data** when `isChartNodeType`. |
| **Canvas / editor wiring** | `src/components/editor/editor-canvas.tsx`, `src/components/diagram-editor.tsx` — modal state and `onSave` updating `node.chart`. |

## Themes (`src/lib/theme-manager.ts`)

`applyThemeToItem` updates `node.chart.series` for `generic.chart.*` nodes: each row gets `fillStyle` / `color` or `gradientColors` from **`ThemeProperties.backgroundStyle`** and colors, with **`shiftHueOfColor(..., i * 36)`** per slice index. Slice **`labelColor`** follows **`textColor`** when present.

## Connections (pie as a circle)

Chart nodes are included in **`isGenericObjectOrChartShapeType`** (`src/lib/utils.ts`) so connection math treats them like closed shapes, not icon-in-box nodes.

**Edge geometry**: `getShapeEdgeBounds` in `src/lib/shape-connection-bounds.ts` returns the same **60×60 circular “meet”** bounds as `generic.object.circle` for `generic.chart.*`, so connectors attach on the visible circle (including left/right). **`getConnectionPoint`** / **`getOptimalConnectionPoints`** / **`computeAxisDeltasForConnectionNodes`** in `src/components/diagram/bezier-connection.tsx` use that helper.

## Adding a new chart type (checklist)

1. Extend **`ChartKind`** and Zod `chart.kind` (or use separate node `type` values, e.g. `generic.chart.bar`).
2. Add **`NodeChartSpec`** fields or a discriminated union for bar/line-only options.
3. Implement **`pieSlicesForSvg`-style** geometry (or a new builder) + a shape component under `src/components/diagram/shapes/`.
4. Register the branch in **`diagram-node.tsx`** and **`shape-preview.tsx`** if needed.
5. Extend **Chart data** modal (or add a dedicated modal) for the new fields.
6. If the shape is non-rectangular, extend **`getShapeEdgeBounds`** and connection logic like other polygons.

## Related files (quick index)

- `src/lib/types.ts` — `ChartKind`, `ChartSliceFillStyle`, `ChartSeriesItem`, `NodeChartSpec`
- `src/lib/chart-node.ts` — builders and constants
- `src/lib/color-shift.ts` — `shiftHueOfColor` for theme slice colors
- `src/lib/schemas.ts` — `chart` on nodes
- `src/lib/theme-manager.ts` — `applyThemeToItem` pie slice hue stepping
- `src/components/diagram/shapes/pie-chart-shape.tsx`
- `src/components/editor/chart-data-editor-modal.tsx`
- `src/components/editor/canvas-operations.ts` — palette drop defaults (`chart: defaultPieChartSpec()`)
- `src/components/editor/draggable-resource-item.tsx` / `diagram-editor.tsx` — `pie-chart` → `generic.chart.pie`
- `public/resources/resource-generic.json` — palette entry
