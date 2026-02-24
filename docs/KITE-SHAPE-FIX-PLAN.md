# Kite (Diamond) Shape Fix Plan

## Problem Summary

1. **Connector alignment**: Connectors appear to attach to the rectangular bounding box edges rather than the actual diamond vertices/edges. The connector logic works for rectangles but not for the kite's diagonal geometry.
2. **Resize proportions**: When resizing the kite, it does not maintain its diamond proportions—it can become wide and short (or vice versa) instead of staying a proper diamond (square aspect ratio).

## Root Cause Analysis

### Connector Issues

- **Current behavior**: `shape-connection-bounds.ts` defines kite with vertex-based bounds (topY:5, bottomY:55, leftX:10, rightX:50, viewBox 60×60). `shapeEdgeToPoint` uses SVG "meet" scaling to map viewBox coords to screen coords.
- **Coordinate system match**: Both the kite SVG and `shapeEdgeToPoint` use "meet" (default for SVG). When width≠height, the diamond is letterboxed. The connection point math should match—unless dimensions are wrong or a different code path is used.
- **Potential issues**:
  - **Dimensions**: When kite comes from Mermaid import with 3× multiplier, base dims can be very wide (e.g. 516×168 for "Incident Resolved?"). `measureNodeDims` returns `node.width`/`node.height` for shapes with custom size—so those get used.
  - **Exit angles**: `getExitAngle` returns 90° for "right", 270° for "left", etc.—suitable for rectangles. For a diamond, the right "edge" is a vertex; the natural exit direction from center to that vertex might differ slightly. This affects bezier curve tangents.
  - **Multi-connection distribution**: For rectangles, multiple connectors on the same edge are distributed along the edge (offsetX for top/bottom, offsetY for left/right). For kite, left/right are single vertices—adding offsetY to a vertex places points off the diamond. Kite may need special handling (no distribution, or use center + small radial offset).

### Resize Proportions

- **Current behavior**: `handleResizeMove` in `diagram-node.tsx` allows independent width and height for all shapes (right handle, bottom handle, bottom-right handle).
- **Kite**: A diamond should maintain 1:1 aspect ratio. Resizing to e.g. 200×80 stretches the bounding box; with SVG "meet" the diamond stays 80×80 centered, but the box looks wrong and existing diagrams may have odd sizes from Mermaid import.

---

## Implementation Plan

### Phase 1: Resize – Maintain Proportions for Kite

**Goal**: Kite always uses a square bounding box (width = height) so the diamond keeps correct proportions.

**Files**:
- `src/components/diagram/diagram-node.tsx` (handleResizeMove, handleResizeStart)
- `src/components/editor/canvas-operations.ts` (resizeNode – optional validation)

**Approach**:

1. **Kite-specific resize logic** (diagram-node.tsx):
   - Add `isKiteNode = nodeType === 'generic.object.kite' || nodeType?.endsWith('.kite')`.
   - In `handleResizeMove`, when `isKiteNode`:
     - **Right handle**: `newWidth = startWidth + deltaX`, `newHeight = newWidth` (lock to square).
     - **Bottom handle**: `newHeight = startHeight + deltaY`, `newWidth = newHeight`.
     - **Bottom-right handle**: Use the larger of the two deltas to preserve square: `size = max(startWidth + deltaX, startHeight + deltaY)`, then `newWidth = newHeight = size`.
   - Apply `snapDimensionToGrid` to both (they stay equal).

2. **Backward compatibility**:
   - Existing kites with width≠height (e.g. from Mermaid) will render with "meet" (correct diamond, letterboxed). On first resize, they snap to square. No migration needed.

3. **canvas-operations.resizeNode**:
   - For kite, when `newWidth !== newHeight`, coerce to square: `size = max(newWidth, newHeight)`, store `width: size, height: size`. This keeps consistency if resize is triggered elsewhere.

### Phase 2: Connector Logic – Kite-Specific Edge Points & Distribution

**Goal**: Connectors land on the diamond's four vertices *and* along each edge (including the midpoint), with distribution/subdivision like rectangles, and exit angles aligned to each edge's direction.

**Files**:
- `src/lib/shape-connection-bounds.ts` (new kite edge geometry)
- `src/components/diagram/bezier-connection.tsx` (getConnectionPoint, getOptimalConnectionPoints, getExitAngle)

---

#### 2.1 Kite Edge Geometry (viewBox 60×60)

**Vertices**: Top (30,5), Right (50,30), Bottom (30,55), Left (10,30).

**Four logical edges** (polyline paths of 2 segments each):
- **Top**: (10,30) → (30,5) → (50,30)
- **Right**: (30,5) → (50,30) → (30,55)
- **Bottom**: (50,30) → (30,55) → (10,30)
- **Left**: (30,55) → (10,30) → (30,5)

Each edge path has 3 points. Parametric `t ∈ [0,1]` walks from start to end. The midpoint (t=0.5) is the vertex at the “middle” of that path (top vertex for top edge, etc.).

**Side midpoints** (geometric center of each of the 4 sides between adjacent vertices): (20,17.5), (40,17.5), (40,42.5), (20,42.5) for top-left, top-right, right-bottom, bottom-left sides respectively.

---

#### 2.2 Connection Point Placement (like rectangle)

**Single connection**: Use the midpoint of the path (the vertex for that edge).

**Multiple connections**: Subdivide parametrically—for N connections place at `t = 1/(N+1), 2/(N+1), …, N/(N+1)` along the path (same pattern as rectangle). Compute (x,y) at each t by linear interpolation along the polyline.

**New API in shape-connection-bounds.ts**:
- `getKiteEdgePath(edge)`: returns the 3 points of the path in viewBox coords.
- `getKiteConnectionPoint(edge, t, obj, width, height)`: returns `{ x, y, angleDeg }` — screen coords and exit angle for parametric position t. Uses "meet" scaling.
- `getKiteEdgeAngleAtT(edge, t)`: outward normal angle (degrees) at t for bezier tangent.

---

#### 2.3 Exit Angle from Edge (alignment to kite)

At each placement point, use the **outward normal** to the edge at that point instead of fixed cardinal angles. For a segment A→B: direction = normalize(B-A); outward normal = rotate 90° so it points away from center (30,30). At vertices use the bisector of the two segment normals.

---

#### 2.4 Integration

1. In `getConnectionPoint`, for kite with top/right/bottom/left: call `getKiteConnectionPoint(edge, t, obj, width, height)` with `t = (effectiveIndex + 1) / (effectiveTotal + 1)`.
2. In `getOptimalConnectionPoints`, for kite: use the kite-specific angle from `getKiteEdgeAngleAtT` (or from `getKiteConnectionPoint`) for `fromAngle`/`toAngle` instead of `getExitAngle`.
3. Add `preserveAspectRatio="xMidYMid meet"` to the kite SVG.

### Phase 3: Mermaid Import – Square Dimensions for Diamond

**Goal**: Avoid creating kites with non-square boxes from Mermaid.

**Files**:
- `src/lib/mermaid-to-diagram.ts`

**Approach**:

1. For `shape === 'diamond'`, after applying `DECISION_SHAPE_MULTIPLIER`:
   - `baseSize = max(dims.width, dims.height) * DECISION_SHAPE_MULTIPLIER`
   - Set `dims = { width: snapToGrid(baseSize), height: snapToGrid(baseSize) }`.
2. Ensures all new Mermaid-imported decision nodes start as squares.

### Phase 4: Initial Kite Size (Optional)

**Files**:
- `src/components/editor/canvas-operations.ts` (addNode)

**Approach**:
- Kite already uses default 60×60 for shapes. No change needed unless you want an explicit kite default.

---

## Implementation Order

1. **Phase 1** (Resize) – Immediate UX fix, low risk.
2. **Phase 3** (Mermaid import) – Prevents new bad data, low risk.
3. **Phase 2** (Connectors) – Implement kite edge geometry, parametric distribution along edges, and edge-aligned exit angles. Requires `shape-connection-bounds.ts` changes and bezier-connection integration.

---

## Files to Modify

| File | Changes |
|------|---------|
| `diagram-node.tsx` | Kite resize lock to square in handleResizeMove |
| `canvas-operations.ts` | Optional: coerce kite to square in resizeNode |
| `shape-connection-bounds.ts` | Add `getKiteEdgePath`, `getKiteConnectionPoint`, `getKiteEdgeAngleAtT` — kite edge geometry and parametric placement |
| `bezier-connection.tsx` | For kite: use `getKiteConnectionPoint` + kite angles instead of `shapeEdgeToPoint`/`getExitAngle`; parametric distribution along edges |
| `svg-shape-base.tsx` or `kite.tsx` | Add `preserveAspectRatio="xMidYMid meet"` for kite |
| `mermaid-to-diagram.ts` | Diamond dimensions = square (max×3, max×3) |

---

## Testing Checklist

- [ ] Create new kite from Objects panel → resize with right, bottom, bottom-right handles → remains square.
- [ ] Import Mermaid with decision nodes → kites are square.
- [ ] Connect to kite from all four sides (top, right, bottom, left) → connectors land on edges (vertices + midpoints).
- [ ] Single connection on kite edge → lands at midpoint (vertex) of that edge.
- [ ] Multiple connectors from same kite edge → distributed along edge like rectangle; each connector uses correct edge angle.
- [ ] Connector exit angles align with kite edges (not horizontal/vertical).
- [ ] Existing diagram with kite (possibly non-square) → loads correctly, resize corrects to square.
- [ ] Rectangles and other shapes → unchanged behavior.

---

## Risk Mitigation

- **Existing connections**: Connection logic uses `fromPreferredExit`/`toPreferredEntry` when set. Auto-determined edges (top/bottom/left/right) stay the same; only the *position* and *angle* may change. Existing diagrams should not break.
- **Kite-only changes**: All new logic is guarded by `node.type === 'generic.object.kite'` or `type?.endsWith('.kite')`. Other shapes unaffected.
- **No schema changes**: No new JSON fields; no migrations.
