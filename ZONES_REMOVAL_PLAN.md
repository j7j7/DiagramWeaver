# Zones Feature Removal Plan

## Goal
Remove the zones feature completely from DiagramWeaver. Establish a flat hierarchy: all nodes exist at root level. When JSON is imported with zones, automatically flatten—nodes inside zones become top-level nodes with computed absolute positions. Zones are discarded.

## Scope

### Data Model Changes
- **DiagramData**: Remove `zones`, `rootZoneId`. Keep `nodes`, `connections`, `groupings`, `layers`.
- **Remove types**: `DiagramZoneData`, `DiagramZoneItem`, `DiagramGroupData`, `DiagramGroupItem` (or keep as deprecated stubs for gradual migration).
- **SelectedItem**: Remove `itemType: 'zone'` variant. Keep `node` and `edge` only.
- **DiagramGroupingData**: `memberIds` refers only to node IDs (no zones). Update `grouping-utils` to exclude zone IDs.

### Import Flatten Logic
When loading/parsing diagram JSON:
1. If `zones` array exists and has items:
   - Recursively walk zones (depth-first).
   - For each zone: compute absolute offset (zone.x + parentOffset.x, zone.y + parentOffset.y).
   - For nodes in zone.children: get node, compute abs position = zoneOffset + (node.x||0, node.y||0), add to flat nodes list, clear parentId/groupId for zone containment.
   - For nested zones in children: recurse with zoneOffset.
   - Discard all zones.
2. Update connections: remove any connection where `from` or `to` is a zone ID (zones no longer exist).
3. Update groupings: `memberIds` should only contain node IDs—filter out any zone IDs.

### JSON Schema
- Remove `DiagramGroupDataSchema`, `DiagramGroupItemSchema`, `HierarchicalDiagramDataSchema`.
- **DiagramDataSchema**: Remove `zones` field. Add optional `zones` for backward compat that gets stripped on parse.
- Parse hook: when validating/loading, if `zones` present, run `flattenDiagramOnImport` before use.

### Files to Modify (Surgical Edits)

| File | Changes |
|------|---------|
| `src/lib/types.ts` | Remove DiagramZoneData, DiagramZoneItem; remove zones from DiagramData; remove zone from SelectedItem |
| `src/lib/schemas.ts` | Remove DiagramGroupDataSchema, DiagramGroupItemSchema, HierarchicalDiagramDataSchema; remove zones from DiagramDataSchema |
| `src/lib/flatten-on-import.ts` | **NEW** - `flattenDiagramOnImport(data)` utility |
| `src/lib/nested-hierarchy.ts` | Simplify or remove—no hierarchical format; or repurpose for flatten-only |
| `src/lib/pure-hierarchy.ts` | Remove zone creation; simplify to node-only |
| `src/lib/canvas-layout-utils.ts` | Remove zone layout (layoutZone, recalculateGroupSize, setAbsolutePositionsForZone, redistributeItemsInCustomZone); simplify calculateLayout to nodes-only |
| `src/components/diagram/diagram-zone.tsx` | **DELETE** |
| `src/lib/zone-layout-utils.ts` | **DELETE** |
| `src/components/editor/editor-canvas.tsx` | Remove DiagramZone import/render; remove processedZones, handleZoneClick, handleZoneResize, handleZoneContextMenu; remove zone from layout |
| `src/components/editor/context-toolbar.tsx` | Remove all zone-specific controls and isZone branches |
| `src/hooks/use-canvas-clipboard.ts` | Remove zone copy/paste; only copy nodes and connections |
| `src/hooks/use-canvas-drag-drop.ts` | Remove zone drop targeting; remove processedZones dependency |
| `src/components/editor/canvas-operations.ts` | Remove addNode zone creation; remove resizeGroup, resizeMultipleGroups; remove zone layout imports |
| `src/components/editor/component-sidebar.tsx` | Remove zone from parentGroup, zonesById; remove zone defaults in form |
| `src/components/editor/draggable-resource-item.tsx` | Remove isZoneResource block—never create zone type |
| `src/components/editor/resource-browser.tsx` | Remove grouping category or Zone from generic (comment/code) |
| `src/components/ui/context-menu.tsx` | Remove zone options (Layout, Inside Zone, etc.) |
| `src/components/diagram-editor.tsx` | Remove zone from SelectedItem type; remove onZoneLayoutChange, onZoneCycle, onZoneSort, applyZoneLayout, cycleZoneItems; remove cleanupEmptyZones; update initial diagram |
| `src/hooks/use-canvas-selection.ts` | Remove zone from selection logic if any |
| `src/hooks/use-canvas-context-menu.ts` | Remove zone item type handling |
| `src/components/editor/canvas-connections.tsx` | Remove zonesById; connections only between nodes |
| `src/components/editor/canvas-arrow-toggles.tsx` | Remove zonesById |
| `src/components/editor/canvas-connection-text.tsx` | Remove zonesById, processedZones |
| `src/lib/grouping-utils.ts` | Remove zone from createGroup/addToGroup (memberIds nodes only); remove cleanupEmptyZones; update getItemGroup for nodes only |
| `src/lib/id-generator.ts` | Remove generateGroupId for zone; keep for grouping if needed |
| `src/lib/text-styling.ts` | Remove applyTextStylingToZone, extractTextStylingFromGroup (or repurpose for nodes) |
| `src/lib/viewer-utils.ts` | Flatten on load; remove zones from output |
| `src/lib/server-export.ts` | Flatten; no zones in export |
| `src/components/viewer/viewer-canvas.tsx` | Remove zone rendering; flatten on load |
| `src/components/editor/json-editor-panel.tsx` | Remove hierarchical format; always flat; flatten on load if zones present |
| `src/components/editor/scratch-pad.tsx` | Remove zone import handling |
| `src/app/api/export/route.ts` | Flatten before export |
| `public/resources/generic/grouping/zone.svg` | **DELETE** or leave (unused) |
| `docs/AI_SCHEMA.md` | Remove groups/zones from schema |
| `MEMORY.MD` | Update zone references |

### Files to Delete
- `src/components/diagram/diagram-zone.tsx`
- `src/lib/zone-layout-utils.ts`

### Preserved
- **Groupings** (`DiagramGroupingData`): Logical grouping of nodes for coordinated movement. Not zones. Keep as-is but memberIds = nodes only.
- All node types: icon, shape, text, textbox, line, etc.
- Connections between nodes
- Layers
- Copy/paste for nodes and connections

## Execution Order
1. Create `flatten-on-import.ts` utility
2. Update types and schemas (remove zones, add flatten on parse)
3. Simplify canvas-layout-utils (nodes only)
4. Remove DiagramZone, zone rendering from editor-canvas
5. Update diagram-editor, context-toolbar, clipboard, drag-drop, operations
6. Update component-sidebar, draggable-resource-item, context-menu
7. Update grouping-utils, hooks, canvas-connections, etc.
8. Delete zone-layout-utils, diagram-zone.tsx
9. Update json-editor-panel, scratch-pad, viewer, export
10. Update docs and MEMORY.MD
