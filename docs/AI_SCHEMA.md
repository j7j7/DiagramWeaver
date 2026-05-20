# DiagramWeaver AI Schema

Specification for generating **diagram JSON** that the editor and viewer accept. **Authoritative definitions** live in **`src/lib/schemas.ts`** (Zod) and **`src/lib/types.ts`** (`DiagramNodeData`, `DiagramConnectionData`, `DiagramData`, …).

Use this document as the **single prompt attachment** when asking an LLM to output diagram JSON: it combines **validity rules** (what parses) with **layout and styling conventions** (what reads well on the canvas).

---

## For LLM authors: valid, good-looking diagrams

### Output contract

- Emit **one JSON object** only (no markdown fences inside the payload unless the user asked for fenced output).
- Use the **flat diagram shape**: at minimum **`nodes`** and **`connections`** arrays (both may be empty but should exist for clarity).
- **Never** use deprecated keys **`groups`**, **`rootGroupId`**, or **`DiagramData.groups`**. Use **`groupings`** only when you need coordinated selection (see below).
- Prefer **real resource types** from `provider.category.resource` (e.g. `aws.compute.lambda`) check **`public/resources/resource-*.json`** naming when unsure; **`generic.object.*`** / **`generic.text.*`** are safe for shapes and labels.

### Validity checklist (must pass parsing)

| Rule | Detail |
|------|--------|
| Unique **`id`** per node | Stable strings: `alpaca-1`, `web-tier`, **`no spaces in ids`** (hyphens/underscores OK). |
| **`connections` reference nodes** | Every **`from`** and **`to`** must match an existing node **`id`**. |
| **`type`** on every node | Non-empty string; wrong types may render as missing assets—prefer known **`generic.*`** or catalog **`aws.*`**, **`azure.*`**, etc. |
| **`groupings` consistency** | If you set **`groupId`** on a node, include a **`groupings`** entry with that **`id`** and list the node in **`memberIds`**. |
| Custom images | **`imageUrl`** only if **`http:`** or **`https:`** (app may strip invalid URLs). |

### Layout: coordinates and spacing

- Positions are **canvas pixels**: **`x`** increases to the right, **`y`** increases downward (typical 2D layout).
- **Avoid** placing every node at **`(0, 0)`**—diagrams overlap and look broken. Use a **rough grid**:
  - **Horizontal stride** between peers: about **160–280px** (icons ~80px wide; leave gap for labels).
  - **Vertical tiers** (layers of architecture): **140–220px** between rows.
  - Keep the whole sketch in a **bounded region** (e.g. **x: 40–1200**, **y: 40–800**) so default zoom shows the full story; extreme coordinates make the canvas feel empty or clipped.
- **Patterns that read well:**
  - **Left → right** for user → API → services → data (increase **x** along the flow).
  - **Top → bottom** for high-level to detail, or pipelines (increase **y** per stage).
  - **Align** peers: same **`y`** for a row, same **`x`** for a column.
- **`width`** / **`height`** on rectangles: set both with **`sizeMode`: `"custom"`** (or omit sizeMode where the app defaults sensibly for shapes). Use similar sizes within a tier so rows look intentional (e.g. all boxes **140×72**).

### Visual hierarchy

- **Fewer, bolder elements:** 5–25 nodes is usually clearer than 50 tiny icons; group related items with **`groupings`** + **`label`** or use a **title node** (**`generic.text.text`**) above a row.
- **Icons vs boxes:** Cloud **resources** (**`aws.*`**, **`azure.*`**, …) for concrete services; **`generic.object.rectangle`** (or rounded via **`cornerRadius`**) for “App”, “VPC”, logical groupings when no icon fits.
- **`nodeSize`:** **`half`** / **`quarter`** for dense rows; **`normal`** for default; **`double`** for hero/large icons.
- **`textPosition`:** For shapes, **`above`** keeps labels readable; **`center`** inside solid boxes with short labels.
- **`label`:** Short (2–5 words); put longer explanations in **`info`** (hover/popover in app).

### Color and polish

- **Palette discipline:** Pick **2–4 accent colors** plus neutrals (**`#1f2937`**, **`#64748b`**, **`#e5e7eb`**). Reuse the same hex for a service family (e.g. orange **#ff9900** for AWS compute-adjacent).
- **Contrast:** Dark text **`#0f172a`** or **`#111827`** on light fills; light text **`#f8fafc`** on dark fills. Avoid mid-gray on mid-gray.
- **`backgroundStyle`:** **`gradient`** with **`backgroundColors`** set to **two** hex strings plus **`gradientAngle`** between **90** and **135** reads modern; **`solid`** is clearest for dense diagrams.
- **`shadow`: true** on **1–3 focal nodes** only; overuse looks muddy.
- **Connections:** Match **`color`** to the **target** role or a **single relationship color** (e.g. **`#6366f1`** for primary data flow). Use **`toArrow`: true** (or **`fromArrow`**) to show direction. **`lineWidth`** **2–3** for primary paths, default for secondary.
- **`style`:** **`bezier`** is default and friendly; **`orthogonal`** + **`smoothCorners`: true** fits **boxy** architecture diagrams and right-angle corporate style.
- **Animation:** Sparingly—enable on at most **one** primary link when the user wants motion, e.g. `{"enabled": true, "shape": "dot"}` inside **`animation`**; omit for static diagrams.

### Connections that stay readable

- Prefer **fewer long hops**: if two nodes are far apart, **increase spacing** or add **intermediate** nodes rather than ugly long edges.
- **`fromPreferredExit`** / **`toPreferredEntry`:** For left-to-right flow, use **`right`** exit and **`left`** entry so lines attach cleanly.
- **Multiple edges** between the same pair: give each connection a distinct **`id`**.
- **`waypoints`:** Advanced; only if you must route around shapes—coordinates are **absolute** on the canvas.

### Optional: `recentColors`

Listing **4–8** hex strings you used helps the product color picker mirror your palette (**`recentColors`**); optional.

### Anti-patterns

- Overlapping nodes at identical **x,y** without offset.
- Random **type** strings that are not in the resource catalog—use **`generic.object.rectangle`** with a **`label`** instead.
- Neon on neon, or low-contrast pastel-on-pastel for body text.
- **Every** connection with animation and shadow—noise, not emphasis.
- Omitting **`nodes`** but leaving **`connections`** that reference missing ids.

Smallest **valid** sketch (note non-zero **`x`** / **`y`** so the node is visible and not stacked on the origin):

```json
{
  "nodes": [
    {
      "id": "svc-1",
      "type": "generic.object.rectangle",
      "label": "Service",
      "x": 180,
      "y": 160,
      "width": 168,
      "height": 76,
      "sizeMode": "custom",
      "backgroundColor": "#f1f5f9",
      "textColor": "#0f172a"
    }
  ],
  "connections": []
}
```

---

## Overview

Validated diagram data (**flat format**) contains:

| Key | Required | Purpose |
|-----|----------|---------|
| `nodes` | yes (may be empty) | Shapes, icons, lines, text, charts, etc. |
| `connections` | yes (may be empty) | Edges between node IDs |
| `groupings` | no | Coordination groups (`type: "grouping"`), not a backdrop layer |
| `layers` | no | Layer visibility, locks, palette (`LayersConfig`; defaulted on load if missing) |
| `recentColors` | no | Recent color picker values |
| `subDiagrams` | no | Map of **`subDiagramId` → nested `DiagramData`** |
| `viewState` | no | Saved pan/zoom: `{ x, y, k }` |

Importer **`validateAndConvertJson`** (viewer) and **`parseDiagramJson`** sanitize custom icons and ensure **`layers`** where needed.

**Do not use:** `groups`, `rootGroupId`, or **`DiagramData.groups`** — those are obsolete names. Persisted diagram JSON uses flat **`nodes`** + optional **`groupings`**.

---

## Top-level skeleton (flat)

```json
{
  "nodes": [],
  "connections": [],
  "groupings": [],
  "layers": {
    "layers": [
      { "id": "background", "name": "Background", "visible": true, "locked": false, "color": "#cbd5f5" }
    ],
    "activeLayerId": "background",
    "defaultLayerId": "background"
  },
  "recentColors": ["#6366f1"],
  "subDiagrams": {},
  "viewState": { "x": 0, "y": 0, "k": 1 }
}
```

Omit optional keys when unused. **`defaultLayerId`** is always **`"background"`** in defaults.

---

## Nodes (`DiagramNodeData`)

Every node has **`id`** and **`type`**. **`type`** is usually `provider.category.resource` (e.g. `aws.compute.ec2`) or **`generic.*`** shapes/text/icons/charts.

Common optional fields (see Zod **`DiagramNodeDataSchema`** for the full list):

- **Identity / content:** `label`, `richLabel` (runs with `text`, optional `bold` / `italic` / `underline`, list/justify/font fields), `info`, `linkUrl`, `tag`, `tagPosition`
- **Layout:** `x`, `y`, `layer`, `stackWithShapes`, `edgePosition` (`top` \| `bottom` \| `left` \| `right`), `freeflow`, `locked`, `groupId` (references a **`groupings`** entry)
- **Box / fill:** `borderColor`, `backgroundColor`, `textColor`, `borderStyle` (`solid` \| `dotted` \| `gradient` \| `none`), `borderColors`, `backgroundStyle` (`solid` \| `gradient` \| `frosted` \| `none`), `backgroundColors`, `frostedDiffusion`, `frostedTransparency`, `frostedPerlinNoise`, `gradientAngle`, `borderGradientAngle`, `shadow`, `borderWidth`, `cornerRadius` (0–1 rounded rect)
- **Highlight:** `highlightAnim`, `highlightAnimDurationSec`, `highlightAnimIntervalSec`, `highlightAnimGlowColor`, `highlightAnimGlowIntensity`, `highlightAnimMode` (`constant` \| `pulse`)
- **Shape text:** `textPosition` (`above` \| `center` \| `under`), `textJustify`, `textVerticalPosition`, font fields (`fontFamily`, `fontSize`, `fontWeight`, …), outline/glow/shadow text fields
- **Heading strip (e.g. text-box-heading):** `headingEdge`, `headingLabel`, `richHeadingLabel`, `headingBackgroundColor`, `headingBackgroundStyle`, `headingTextColor`
- **Icons / resources:** `provider`, `category`, `file`, or **standard icons:** `iconType` (`lucide` \| `emoji`), `iconName`, `emoji`, `iconColor`; **custom image:** `imageUrl` (http/https only), `imageOptions` (crop/scale/orientation)
- **Routing:** `ignoreConnectionAvoidance` (orthogonal may cross this shape)
- **Line node** (`generic.object.line` style usage): `startPos`, `endPos`, `startCap`, `endCap`, `lineThickness`, `lineType`, `linePathStyle` (`straight` \| `curved`), `lineControlPoints`, `lineSmoothJoints`, `lineTextVerticalPosition`, `lineColorStyle`, `lineColors`, `lineGradientAngle`
- **Charts:** `chart` — discriminated by **`kind`**: `pie` \| `bar` \| `line` (see schema for `series`, axes, labels, etc.)
- **UML:** `umlClass`, `umlClassStyle`
- **Mind map** (`generic.object.mind-map-node`): `mindmapParentId`, `mindmapChildIds`, `mindmapAngleDeg`, `mindmapRadiusPx`, `mindmapStartAngleDeg`, `mindmapFillMode` (`solid` \| `theme-hues`), `mindmapHueStepDeg`, `mindmapHueLocked`, `mindmapHueAnchor`, `mindmapRootId`, `mindmapTreeDepth`, `mindmapSiblingHueIndex`
- **Navigation:** `subDiagramId` (key into **`subDiagrams`**)
- **Other:** `metaData` (string map), `noIconBackground`, `nodeSize` (`normal` \| `half` \| `quarter` \| `double`), `labelWidth`, `width`, `height`, `sizeMode` (`auto` \| `custom`), `rotation`, `metaData`

---

## Connections (`DiagramConnectionData`)

Required: **`from`**, **`to`** (node IDs). **`id`** distinguishes multiple edges between the same pair.

Routing & style:

| Field | Notes |
|-------|--------|
| `style` | `bezier` (default) or `orthogonal` |
| `curvature` | Bezier intensity |
| `smoothCorners` | Rounded bends for orthogonal |
| `waypoints` | `[{ x, y, id? }]` canvas coordinates (orthogonal/bezier routing) |
| `orthogonalTrunkOffsetX`, `orthogonalTrunkOffsetY` | Z-route trunk offsets when not using manual waypoints |
| `fromPreferredExit`, `toPreferredEntry` | `top` \| `bottom` \| `left` \| `right` \| `center` |
| `edgeAttachmentConstraint` | `auto` \| `top-bottom` \| `left-right` |
| `centerEdgeAnchors` | Attach at edge midpoints |

Stroke:

| Field | Notes |
|-------|--------|
| `color`, `lineWidth` | Base stroke |
| `lineWidthLock`, `lineWidthEnd` | Taper along path when lock false |
| `colorLock`, `colorEnd` | Gradient along stroke when color lock false |
| `lineType` | `solid` \| `dashed` \| `dotted` |
| `shadow` | Stroke shadow |
| `useSourceLineColor` | Follow source styling |

Markers & labels: `fromArrow`, `toArrow`, `arrow` (legacy), `text`, `textPosition` (0–100 along path).

**Animation** (`animation`):

- `enabled`, `shape` (`dot` \| `square` \| `arrow` \| `triangle` \| `hexagon`), `speed`, `size`, `color`, `autoCount`, `shapeCount`, `spacing`

**Other:** `metaData`; **mind map:** `mindmapRole` (`tree` \| `link`), `mindmapPrimary`

---

## Groupings (`DiagramGroupingData`)

Selection/movement sets — **not** a visible rectangle on the canvas; members move together.

```json
{
  "id": "grp-1",
  "type": "grouping",
  "memberIds": ["node-a", "node-b"],
  "label": "Optional name",
  "locked": false
}
```

Nodes may set **`groupId`** to tie to a grouping ID.

---

## Node Types (summary)

### Text / generic

- `generic.text.text`, `generic.text.textbox`, and related generic text/shape **`generic.object.*`** (square, rectangle, circle, triangle, star, cloud, line, charts, …) — verify exact IDs in **`public/resources`** and the resource picker metadata.

### Resource icons

Pattern: **`{provider}.{category}.{resource}`** (see resource JSON under **`public/resources`**, e.g. `resource-aws.json`).

Major provider **categories** (non-exhaustive; see resource files):

- **AWS:** `general`, `compute`, `storage`, `database`, `networking`, `security`, `analytics`, `ai`, `iot`, `mobile`, and other service groups in resource JSON.
- **Azure:** `general`, `compute`, `database`, `networking`, `storage`, `security`, apps, IoT, etc.
- **GCP:** `compute`, `storage`, `database`, `networking`, `bigdata`, `ai`, etc.
- **Others:** Alibaba, DigitalOcean, Elastic, Firebase, IBM, **k8s**, OCI, on-prem, OpenStack, programming, SaaS, **generic**, etc.

---

## Styling quick reference

### Gradient angles (background / border)

Common values include **`-45`**, **`90`**, **`135`**, **`180`** (product UI labels may vary).

### Border / background modes

- **Border:** `solid` \| `dotted` \| `gradient` \| `none`
- **Fill:** `solid` \| `gradient` \| `frosted` \| `none`

### Shape label position (`textPosition`)

`above` \| `center` \| `under`

### Shape / group labels (`textPosition` for group-style boxes)

Includes `inside` plus edge variants such as **`inline-top`**, **`outside-left`**, etc. — see **`DiagramGroupDataSchema`** in **`schemas.ts`**.

### Group layout (`orientation`)

`horizontal` \| `vertical` \| `square` — see **`DiagramGroupDataSchema`** in **`schemas.ts`**

---

## Connection options (summary)

- **Bezier vs orthogonal:** `style`
- **Waypoints:** absolute canvas **`x`**, **`y`**
- **Orthogonal tweaks:** **`smoothCorners`**, **`orthogonalTrunkOffsetX`** / **`Y`**
- **Taper / gradient stroke:** **`lineWidthLock`** / **`lineWidthEnd`**, **`colorLock`** / **`colorEnd`**
- **Attachment:** **`edgeAttachmentConstraint`**, **`centerEdgeAnchors`**
- **Animation:** nested **`animation`** object

---

## Examples

### Simple flat diagram

```json
{
  "nodes": [
    {
      "id": "user",
      "type": "aws.general.user",
      "label": "User",
      "x": 100,
      "y": 100
    },
    {
      "id": "ec2",
      "type": "aws.compute.ec2",
      "label": "Web Server",
      "x": 300,
      "y": 100,
      "backgroundColor": "#ff9900",
      "shadow": true
    },
    {
      "id": "rds",
      "type": "aws.database.rds",
      "label": "Database",
      "x": 500,
      "y": 100,
      "backgroundColor": "#527fff"
    }
  ],
  "connections": [
    {
      "from": "user",
      "to": "ec2",
      "toArrow": true,
      "color": "#ff9900"
    },
    {
      "from": "ec2",
      "to": "rds",
      "toArrow": true,
      "color": "#527fff"
    }
  ]
}
```

### Styled nodes + orthogonal connection + grouping

```json
{
  "nodes": [
    {
      "id": "frontend",
      "type": "generic.object.rectangle",
      "label": "Frontend",
      "x": 50,
      "y": 50,
      "backgroundStyle": "gradient",
      "backgroundColors": ["#667eea", "#764ba2"],
      "gradientAngle": 135,
      "shadow": true,
      "width": 120,
      "height": 60,
      "groupId": "app-pair"
    },
    {
      "id": "backend",
      "type": "generic.object.rectangle",
      "label": "Backend",
      "x": 250,
      "y": 50,
      "backgroundStyle": "gradient",
      "backgroundColors": ["#f093fb", "#f5576c"],
      "gradientAngle": 90,
      "shadow": true,
      "width": 120,
      "height": 60,
      "groupId": "app-pair"
    }
  ],
  "connections": [
    {
      "from": "frontend",
      "to": "backend",
      "style": "orthogonal",
      "smoothCorners": true,
      "toArrow": true,
      "color": "#333333",
      "lineWidth": 2.5,
      "animation": { "enabled": true, "shape": "dot", "spacing": 2 }
    }
  ],
  "groupings": [
    {
      "id": "app-pair",
      "type": "grouping",
      "memberIds": ["frontend", "backend"],
      "label": "Application layer"
    }
  ]
}
```

---

## Maintenance

Update this doc when **`DiagramDataSchema`**, **`DiagramNodeDataSchema`**, or **`DiagramConnectionDataSchema`** change in **`src/lib/schemas.ts`**, or when new **`generic.*`** / resource IDs ship.

Suggested checks:

1. **`src/lib/schemas.ts`** — Zod shapes  
2. **`src/lib/types.ts`** — exported TypeScript interfaces and comments  
3. **`src/lib/viewer-utils.ts`** — **`validateAndConvertJson`** behavior  
4. **`src/lib/flatten-on-import.ts`** — diagram normalization on import  
5. **`public/resources/resource-*.json`** — provider/category/resource IDs
