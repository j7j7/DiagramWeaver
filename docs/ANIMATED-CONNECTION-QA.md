# Animated Connection QA Checklist

## Scope
Validate animated connection behavior, per-connection config, bulk apply confirmation behavior, persistence, and GIF export flow.

## Pre-check
1. Run app (`npm run dev`) and open editor.
2. Add at least 3 nodes: `A`, `B`, `C`.
3. Create connections: `A -> B`, `A -> C`, `B -> A`.
4. Open connection settings from a connection context menu.

## 1) Shape + Speed
1. Set shape to each option: `dot`, `square`, `arrow`, `triangle`, `hexagon`.
   - Expected: moving marker geometry matches selection.
2. Set speed to `0`.
   - Expected: shapes remain visible but static.
3. Set speed to `50`.
   - Expected: movement direction is source -> destination.
4. Set speed to `-50`.
   - Expected: movement direction reverses destination -> source.
5. Set speed to `20` on two different connections with different lengths.
   - Expected: same apparent units-per-second rate on both connections (numeric consistency).

## 2) Size + Spacing + Count
1. Set size to `0`, then `10`.
   - Expected: marker size scales from line-thickness-equivalent minimum to large markers.
2. Auto mode enabled:
   - Keep auto count on.
   - Set spacing to `0.5`, then `2`, then `10`.
   - Expected: marker density updates automatically by spacing; larger spacing => fewer markers.
3. Manual mode:
   - Disable auto count.
   - Set shape count to `0`, then `2`, then `20`.
   - Expected: exact rendered marker count follows manual value.
   - Adjust spacing (`0`, `0.5`, `1`, `2`).
   - Expected: marker separation follows shape-size spacing ratio.

## 3) Style inheritance + color
1. Leave animation color empty/default.
   - Expected: markers follow connection/inherited line color.
2. Set explicit animation color.
   - Expected: markers use animation color override.

## 4) Bulk apply (one-time with confirm)
For a connection from source `A`:
1. Check `Apply to all outbound of source`.
   - Expected: confirmation dialog always appears.
2. Click `Cancel`.
   - Expected: checkbox resets unchecked; no outbound connections changed.
3. Repeat and click `Continue`.
   - Expected: outbound connections from `A` receive same animation config.
4. Check `Apply to all inbound of source` and click `Continue`.
   - Expected: all inbound connections for `A` receive same animation config.
5. Close and reopen the connection editor later.
   - Expected: bulk checkboxes are unchecked again (one-time effect).

## 5) JSON persistence
1. Save diagram JSON.
2. Reload diagram JSON.
3. Re-open same connection settings.
   - Expected: all animation fields are restored:
     - shape
     - speed
     - size
     - autoCount
     - shapeCount
     - spacing
     - animation color

## 6) Export flow (PNG unchanged + GIF added)
1. Open File menu export entry.
   - Expected: PNG and GIF are both available from same export location/flow.
2. Export PNG.
   - Expected: unchanged static export behavior.
3. Export GIF.
   - Expected: `.gif` file is generated and shows moving connection markers.

## Pass Criteria
- All expectations above succeed without runtime errors.
- No regression in normal connection rendering, text, arrows, waypoint behavior.
