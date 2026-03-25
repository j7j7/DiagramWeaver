# Nested Diagrams Plan

## Active Work Notes

### 2026-03-25 - Orthogonal routing hardening

- Ensure orthogonal connection routing always emits axis-aligned segments after pathfinding and endpoint approach correction.
- Preserve and improve obstacle avoidance by widening the A* search bounds around blockers and preferring stricter obstacle-safe fallbacks before relaxed ones.
- Keep waypoint-based orthogonal routes working by enforcing orthogonality after chained leg assembly.

## Overview
Support multiple diagrams nested within each other. A top-level diagram can have icons that reference sub-diagrams. Double-clicking such an icon navigates to the sub-diagram. Users can return via a breadcrumb bar.

## Data Model (JSON Format)

### Backwards Compatible Extensions

1. **DiagramNodeData** – add optional:
   - `subDiagramId?: string` – when present, this node/icon links to a sub-diagram

2. **DiagramData** – add optional:
   - `subDiagrams?: Record<string, DiagramData>` – keyed by subDiagramId; each value is full DiagramData (nodes, connections, etc.)

### Example JSON

```json
{
  "nodes": [
    { "id": "n1", "type": "aws.compute.ec2", "label": "Main Server", "x": 100, "y": 100 },
    { "id": "n2", "type": "aws.storage.s3", "label": "Storage", "subDiagramId": "sub-storage", "x": 300, "y": 100 }
  ],
  "connections": [{ "from": "n1", "to": "n2" }],
  "subDiagrams": {
    "sub-storage": {
      "nodes": [
        { "id": "s1", "type": "generic.object.rectangle", "label": "Bucket A", "x": 50, "y": 50 }
      ],
      "connections": []
    }
  }
}
```

- If `subDiagramId` is absent on a node → regular icon (no link).
- If `subDiagrams` is absent → existing behavior (no nested diagrams).

## Visual Distinction

- **Regular icon**: existing hover glow (blue).
- **Sub-diagram link icon**: different glow (e.g. amber/gold) – `node-glow-subdiagram` class.
- Applied when `node.subDiagramId` is set.

## Navigation

1. **Active diagram stack**: `activeDiagramStack: Array<{ diagramId: string | null; fromNodeId?: string; fromNodeLabel?: string }>`
   - `null` = root diagram
   - Non-null = sub-diagram id
2. **Double-click on node with `subDiagramId`**:
   - Navigate to sub-diagram (push to stack).
   - If sub-diagram does not exist yet → create blank DiagramData and add to `subDiagrams`.
3. **Breadcrumb**: Renders at top; each segment clickable to go back.
   - Root → "Main Diagram" (or tab name)
   - Sub → node label that links to it

## Creating the Link

- **Context menu** on icon node: "Link to sub-diagram" / "Create sub-diagram"
  - Creates new sub-diagram (blank canvas), sets `node.subDiagramId`, navigates to it.
- **Properties panel**: Optional "Sub-diagram" field to link/unlink.
- **Unlink**: "Remove sub-diagram link" in context menu – clears `subDiagramId`, optionally deletes sub-diagram.

## Implementation Phases

1. Types & schemas: Add `subDiagramId`, `subDiagrams` (optional, backwards compatible).
2. Flatten/parse: Preserve `subDiagrams` in flatten-on-import and schema.
3. CSS: Add `node-glow-subdiagram` for link icons.
4. DiagramBreadcrumb component.
5. Double-click handler: Navigate on sub-diagram link; otherwise existing label edit.
6. Diagram editor: Active stack state, render current diagram, wire updates to correct sub-diagram.
7. Context menu: "Create sub-diagram" / "Remove sub-diagram link".

## Viewer

- Viewer should support nested navigation (breadcrumb + double-click to drill down).
- Same JSON format; viewer reads `subDiagrams` and allows navigation.
