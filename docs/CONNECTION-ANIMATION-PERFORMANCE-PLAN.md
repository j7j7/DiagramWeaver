# Connection Line Animation – Performance Optimization Plan

**Status**: Implemented 2026-03-09. Optimizations applied in `bezier-connection.tsx`. Works in editor and viewer.

## Summary

This document analyzes how connection line animations are rendered and proposes performance optimizations **without sacrificing functionality**. The plan is based on code review of `bezier-connection.tsx`, `canvas-connections.tsx`, and related modules.

---

## Current Rendering Architecture

### Animation mechanism

- **Runtime animation**: Uses SVG `<animateMotion>` with `<mpath href="#...">` – declarative SMIL animation runs on the **browser compositor**. No JavaScript animation loop. This is already efficient.
- **GIF export**: Uses `exportAnimationTimeSeconds`; each frame renders shapes at computed positions via `pathDistanceLookup.resolveT` + `getPointOnConnectionPath`. This is CPU-heavy when many shapes animate during export.

### Per-connection work (BezierConnection)

1. **Path distance lookup** (`buildPathDistanceLookup`): 180 samples × `getPointOnConnectionPath` per connection on every render.
2. **Path calculation**: `calculateBezierPath` or `calculateMultiPointBezierPath` – moderate cost.
3. **Shape rendering**: Up to `MAX_RENDERED_ANIMATION_SHAPES` (2000) per connection. Each shape is:
   - **Live**: `<g>` + `<animateMotion>` + `mpath` – no per-frame JS.
   - **Static export**: Manual `resolveT`, `getPointOnConnectionPath` × 2 per shape per frame – heavy during GIF capture.

### Parent rendering

- **CanvasConnections** is memoized with `areCanvasConnectionsPropsEqual`, but it compares `diagramData === next.diagramData`. Any diagram edit creates a new `diagramData` reference, so all connections re-render.
- **BezierConnection** is **not memoized** – every parent render creates new instances.
- **Order-aware mode** (`connectionsBehindNodesEnabled=false`): Multiple `CanvasConnections` instances (one per slot), each filtering by `connectionIndices`. Still iterates all connections.

---

## Identified Bottlenecks

| Area | Impact | Notes |
|------|--------|-------|
| `buildPathDistanceLookup` always runs | High | 180 samples × `getPointOnConnectionPath` per connection. Used even when animation uses `animateMotion` (only export/spacing need it). |
| No BezierConnection memoization | Medium | Every connection re-renders when any prop changes; cascades from parent. |
| GIF export per-frame recompute | High | Each frame recalculates path lookup and static shape positions for all animated connections. |
| Dead code: `estimateConnectionPathLength` | Low | Never used – safe to remove. |
| Path distance sample count (180) | Low–Medium | Could be reduced for simple paths; 180 may be overkill for straight/gentle curves. |
| No visibility culling | Low | All connections render even when off-screen (depends on zoom/pan). |

---

## Optimization Plan (Priority Order)

### 1. Defer path distance lookup for live animation

**Goal**: Avoid `buildPathDistanceLookup` when not needed at runtime.

- **When to compute**: Only when `useStaticExportAnimation` is true (GIF export) or when we need `pathLength` for shape count/spacing.
- **For live animation**: `pathLength` is still needed for `renderedShapeCount` and `animationDuration`. So we must compute it at least once.
- **Refinement**: Compute `pathLength` via a cheaper method when only length is needed. `estimateConnectionPathLength` (60 samples) already exists but is unused. We could:
  - Use a lighter path-length approximation (e.g. 60 samples) when we only need `pathLength` for count/duration.
  - Use full `buildPathDistanceLookup` **only** when `useStaticExportAnimation` is true (GIF export).

**Impact**: Reduces work for most live views; full lookup only during export.

**Risk**: Low – export path is separate; live animation uses `animateMotion` which doesn’t need `resolveT`.

---

### 2. Memoize BezierConnection

**Goal**: Avoid re-rendering connections whose inputs haven’t changed.

- Add `React.memo(BezierConnection, areBezierConnectionPropsEqual)`.
- Custom comparator: compare `from`, `to`, `connectionData`, `connectionColor`, `animationConnectionsEnabled`, `exportAnimationTimeSeconds`, `onClick`, `onContextMenu`.
- For `from`/`to`: compare `id`, `x`, `y`, `width`, `height`, `type`, `lineColor`, and other fields that affect connection geometry.
- For `connectionData`: compare connection id, curvature, waypoints, animation config, lineWidth, shadow, arrows, etc.

**Impact**: Reduces redundant work when only unrelated parts of the diagram change (e.g. selection, panel state).

**Risk**: Low – standard React.memo pattern; must ensure comparator is correct to avoid visual bugs.

---

### 3. Optimize GIF export path

**Goal**: Reduce per-frame CPU work during GIF capture.

- **Cache path distance lookup**: Build `pathDistanceLookup` once per connection per export session; reuse across frames. `exportAnimationTimeSeconds` changes each frame, but connection geometry does not.
- **Cache shape positions per frame**: For static export, `effectiveProgress` is a function of `progress`, `exportAnimationTimeSeconds`, `pathLength`, `speedMagnitude`. The path is fixed; only the time offset changes. Consider batching or caching `resolveT` results if the same path is sampled repeatedly.

**Impact**: Reduces repeated computation during GIF export; most benefit when many connections or shapes.

**Risk**: Low – export is a constrained flow; cache can be cleared when export stops.

---

### 4. Reduce path distance samples when appropriate

**Goal**: Lower cost of `buildPathDistanceLookup` where possible.

- Use 180 samples for multi-waypoint paths (complex curves).
- Use 90–120 samples for simple single-segment Bezier paths.
- Or: single tunable constant (e.g. 120) as a balance.

**Impact**: Modest CPU reduction per connection; quality should remain acceptable.

**Risk**: Low – verify visually that start/end alignment and shape distribution remain good.

---

### 5. Remove dead code

**Goal**: Clean up unused logic.

- Remove `estimateConnectionPathLength` if it remains unused after optimization 1, or repurpose it for the lightweight path-length case.

**Impact**: Slightly smaller bundle and clearer code.

**Risk**: None.

---

### 6. Consider visibility culling (future)

**Goal**: Skip rendering connections far off-screen.

- Use viewport bounds and transform to detect connections outside the visible area.
- Skip or simplify rendering for off-screen connections.

**Impact**: Helpful for very large diagrams; requires viewport/transform wiring.

**Risk**: Medium – must handle pan/zoom and edge cases where connections span viewport.

---

## What to avoid

- Do **not** replace SVG `animateMotion` with a JS-driven animation loop – it would be less efficient.
- Do **not** change animation behaviour, shape types, speed, or visual output.
- Do **not** reduce `MAX_RENDERED_ANIMATION_SHAPES` as a performance hack – honour user configuration.
- Do **not** break GIF export or per-connection animation settings.

---

## Implementation order

1. **Memoize BezierConnection** – lowest risk, clear win when selection/panels change.
2. **Defer / optimize path distance lookup** – build full lookup only when needed (export); use lighter length estimate for live.
3. **GIF export caching** – cache path lookup and reuse per connection during export.
4. **Reduce samples** – tune 180 → 90–120 for simple paths.
5. **Remove dead code** – `estimateConnectionPathLength` or integrate into plan.
6. **Visibility culling** – optional, for large diagrams.

---

## Files to modify

| File | Changes |
|------|---------|
| `src/components/diagram/bezier-connection.tsx` | Memoization, path lookup deferral, sample count, dead code removal |
| `src/components/editor/canvas-connections.tsx` | Ensure stable refs/callbacks if needed for memoization |
| `src/hooks/use-canvas-export.ts` | Optional: pass cache or mode to connections during GIF export |

---

## Testing checklist

- [ ] Live animation: shapes move smoothly on connections (dot, square, arrow, triangle, hexagon).
- [ ] Speed 0: shapes static; speed ±N: direction correct.
- [ ] Auto/manual count, spacing, size: unchanged behaviour.
- [ ] GIF export: moving markers match live animation.
- [ ] Order-aware vs lines-behind-nodes: both modes unchanged.
- [ ] Waypoints: multi-segment paths animate correctly.
- [ ] Selection, pan, zoom: no regression in responsiveness.
