/**
 * Orthogonal (90°) Connection Routing Engine
 * * Computes axis-aligned paths between two points that:
 * - Move only horizontally or vertically (no diagonals)
 * - Avoid overlapping with obstacle rectangles (nodes & zones)
 * - Snap every bend to the 10 px canvas grid
 * - Minimise the number of bends (turns)
 * * Algorithm: simplified A* on a visibility-grid with 10 px resolution.
 * Obstacles are inflated by a configurable margin so lines don't hug
 * node edges.
 * * Exported helpers mirror the bezier-connection API so the rest of the
 * codebase can call them with the same parameters.
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Grid cell size - matches GRID_STEP in canvas-constants.ts */
const CELL = 10;

/** Padding added around obstacles so lines don't touch node edges */
const OBSTACLE_MARGIN = 20;

/** Maximum grid cells we'll explore before giving up (prevents freezing
 * on very large canvases). Falls back to simple L/Z route. */
const MAX_ITERATIONS = 15_000;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrthogonalSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OrthogonalRoute {
  /** Ordered waypoints (including start & end). All snapped to grid. */
  points: Array<{ x: number; y: number }>;
  /** Pre-computed SVG path string (M ... L ... L ...) */
  pathData: string;
  /** Total Manhattan length in canvas px */
  totalLength: number;
}

// -----------------------------------------------------------------------------
// Snap helper
// -----------------------------------------------------------------------------

function snap(v: number): number {
  return Math.round(v / CELL) * CELL;
}

// -----------------------------------------------------------------------------
// Simple fallback routes (no obstacle avoidance)
// -----------------------------------------------------------------------------

/**
 * L-route: one bend between from and to.
 * Prefers the direction matching the exit angle first.
 */
function lRoute(
  fx: number, fy: number,
  tx: number, ty: number,
  exitAngle: number,
): Array<{ x: number; y: number }> {
  // exitAngle convention: 0=up, 90=right, 180=down, 270=left
  const horizontalFirst = exitAngle === 90 || exitAngle === 270;
  if (horizontalFirst) {
    // Go horizontal first, then vertical
    return [{ x: fx, y: fy }, { x: tx, y: fy }, { x: tx, y: ty }];
  }
  // Go vertical first, then horizontal
  return [{ x: fx, y: fy }, { x: fx, y: ty }, { x: tx, y: ty }];
}

/**
 * Z-route: two bends. Used when the L-route would cross the target's
 * obstacle box (e.g. nodes side-by-side).
 */
function zRoute(
  fx: number, fy: number,
  tx: number, ty: number,
  exitAngle: number,
): Array<{ x: number; y: number }> {
  const horizontalFirst = exitAngle === 90 || exitAngle === 270;
  if (horizontalFirst) {
    const midX = snap((fx + tx) / 2);
    return [
      { x: fx, y: fy },
      { x: midX, y: fy },
      { x: midX, y: ty },
      { x: tx, y: ty },
    ];
  }
  const midY = snap((fy + ty) / 2);
  return [
    { x: fx, y: fy },
    { x: fx, y: midY },
    { x: tx, y: midY },
    { x: tx, y: ty },
  ];
}

// -----------------------------------------------------------------------------
// Obstacle helpers
// -----------------------------------------------------------------------------

/** Inflate a rect by `m` px on each side */
function inflateRect(r: Rect, m: number): Rect {
  return { x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m };
}

function rectContains(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

/** Does the axis-aligned segment (a->b) intersect the rect? Both points are grid-snapped. */
function segmentIntersectsRect(
  ax: number, ay: number,
  bx: number, by: number,
  r: Rect,
): boolean {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);

  // Quick AABB reject
  if (maxX < r.x || minX > r.x + r.width) return false;
  if (maxY < r.y || minY > r.y + r.height) return false;

  // Horizontal segment
  if (ay === by) {
    return ay >= r.y && ay <= r.y + r.height && maxX >= r.x && minX <= r.x + r.width;
  }
  // Vertical segment
  if (ax === bx) {
    return ax >= r.x && ax <= r.x + r.width && maxY >= r.y && minY <= r.y + r.height;
  }
  return false;
}

/** Check if a multi-segment route intersects any obstacle */
function routeIntersectsObstacles(
  points: Array<{ x: number; y: number }>,
  obstacles: Rect[],
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    for (const obs of obstacles) {
      if (segmentIntersectsRect(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, obs)) {
        return true;
      }
    }
  }
  return false;
}

// -----------------------------------------------------------------------------
// A* pathfinding on a 10 px grid
// -----------------------------------------------------------------------------

/** Directions: right, down, left, up */
const DX = [CELL, 0, -CELL, 0];
const DY = [0, CELL, 0, -CELL];

/** Pack grid coordinates into a single number for fast Map lookups */
function packKey(gx: number, gy: number): number {
  // Shift to positive range (supports coords up to ±3,276,700 px)
  return ((gx / CELL + 32767) | 0) * 65536 + ((gy / CELL + 32767) | 0);
}

interface AStarNode {
  x: number;
  y: number;
  g: number; // cost so far
  f: number; // g + heuristic
  dir: number; // last direction index (0-3), or -1 for start
  parentKey: number; // packed key of parent
}

/**
 * Run A* from (sx,sy) to (ex,ey) on a 10 px grid, avoiding `obstacles`.
 * Returns an array of grid-snapped points, or null if no path found within budget.
 */
function astar(
  sx: number, sy: number,
  ex: number, ey: number,
  obstacles: Rect[],
  exitAngle: number,
  entryAngle: number,
): Array<{ x: number; y: number }> | null {
  // Snap start/end
  const startX = snap(sx);
  const startY = snap(sy);
  const endX = snap(ex);
  const endY = snap(ey);

  if (startX === endX && startY === endY) {
    return [{ x: startX, y: startY }];
  }

  // Build blocked-cell lookup from inflated obstacles
  const inflated = obstacles.map(o => inflateRect(o, OBSTACLE_MARGIN));

  // Determine the bounding box for the search (expand 200 px beyond the from/to range)
  const PAD = 200;
  const minBX = snap(Math.min(startX, endX) - PAD);
  const maxBX = snap(Math.max(startX, endX) + PAD);
  const minBY = snap(Math.min(startY, endY) - PAD);
  const maxBY = snap(Math.max(startY, endY) + PAD);

  function isBlocked(px: number, py: number): boolean {
    for (const r of inflated) {
      if (rectContains(r, px, py)) return true;
    }
    return false;
  }

  // Heuristic: Manhattan distance + small penalty to prefer fewer turns
  function heuristic(px: number, py: number): number {
    return Math.abs(px - endX) + Math.abs(py - endY);
  }

  // Map initial direction from exit angle
  function angleToDir(angle: number): number {
    if (angle === 90) return 0;  // right
    if (angle === 180) return 1; // down
    if (angle === 270) return 2; // left
    return 3;                    // up (0°)
  }

  const startDir = angleToDir(exitAngle);
  const startKey = packKey(startX, startY);
  const endKey = packKey(endX, endY);

  // Open set as a simple sorted array (fast enough for our bounded search)
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, { parentKey: number; dir: number }>();
  const open: AStarNode[] = [];
  const closed = new Set<number>();

  const h0 = heuristic(startX, startY);
  open.push({ x: startX, y: startY, g: 0, f: h0, dir: startDir, parentKey: -1 });
  gScore.set(startKey, 0);

  let iterations = 0;
  while (open.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    // Pop node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }

    const current = open[bestIdx];
    open[bestIdx] = open[open.length - 1];
    open.pop();

    const curKey = packKey(current.x, current.y);

    if (curKey === endKey) {
      // Reconstruct path
      const path: Array<{ x: number; y: number }> = [];
      let key = curKey;
      let node: { parentKey: number; dir: number } | undefined = { parentKey: current.parentKey, dir: current.dir };
      path.push({ x: current.x, y: current.y });

      while (node && node.parentKey !== -1) {
        const pk = node.parentKey;
        // Decode key back to coordinates
        const pgx = ((pk / 65536) | 0) - 32767;
        const pgy = (pk % 65536) - 32767;
        path.push({ x: pgx * CELL, y: pgy * CELL });
        node = cameFrom.get(pk);
        key = pk;
      }

      path.reverse();
      return simplifyPath(path);
    }

    if (closed.has(curKey)) continue;
    closed.add(curKey);

    for (let d = 0; d < 4; d++) {
      const nx = current.x + DX[d];
      const ny = current.y + DY[d];

      // Bounds check
      if (nx < minBX || nx > maxBX || ny < minBY || ny > maxBY) continue;

      const nKey = packKey(nx, ny);
      if (closed.has(nKey)) continue;

      // Skip blocked cells (but always allow the end cell)
      if (nKey !== endKey && isBlocked(nx, ny)) continue;

      // Cost: 1 per cell + penalty for changing direction (encourages fewer bends)
      const turnPenalty = (current.dir >= 0 && d !== current.dir) ? CELL * 2 : 0;
      const tentativeG = current.g + CELL + turnPenalty;

      const prevG = gScore.get(nKey);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(nKey, tentativeG);
      cameFrom.set(nKey, { parentKey: curKey, dir: d });
      open.push({
        x: nx, y: ny,
        g: tentativeG,
        f: tentativeG + heuristic(nx, ny),
        dir: d,
        parentKey: curKey,
      });
    }
  }

  // No path found within budget
  return null;
}

// -----------------------------------------------------------------------------
// Path simplification - merge collinear segments
// -----------------------------------------------------------------------------

function simplifyPath(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  const result: Array<{ x: number; y: number }> = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const next = points[i + 1];
    const curr = points[i];

    // Keep point only if direction changes
    const sameX = prev.x === curr.x && curr.x === next.x;
    const sameY = prev.y === curr.y && curr.y === next.y;
    if (!sameX && !sameY) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

// -----------------------------------------------------------------------------
// Ensure correct approach / departure angle
// -----------------------------------------------------------------------------

/**
 * Guarantee the path's first or last segment is axis-aligned with the
 * required exit/entry direction.
 * * When `isSource` is true we fix the **departure** end (first two points).
 * When `isSource` is false we fix the **arrival** end (last two points).
 * * If the segment is already aligned, the path is returned untouched.
 * Otherwise an approach waypoint AND a corner point are inserted so the
 * line makes a clean 90° turn before reaching the endpoint - keeping
 * every segment fully orthogonal.
 */
function ensureApproachSegment(
  points: Array<{ x: number; y: number }>,
  endpointX: number,
  endpointY: number,
  angle: number,
  stubLen: number,
  isSource: boolean,
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;

  // Pick the two points that form the segment we need to check
  const idx = isSource ? 0 : points.length - 1;
  const adjIdx = isSource ? 1 : points.length - 2;
  const endpoint = points[idx];
  const adjacent = points[adjIdx];

  const dx = adjacent.x - endpoint.x;
  const dy = adjacent.y - endpoint.y;

  // Determine whether the existing segment already matches the required
  // direction. Convention:
  // angle 0   -> line must leave/arrive vertically upward   (dy < 0, dx === 0)
  // angle 90  -> line must leave/arrive horizontally right  (dx > 0, dy === 0)
  // angle 180 -> line must leave/arrive vertically downward (dy > 0, dx === 0)
  // angle 270 -> line must leave/arrive horizontally left   (dx < 0, dy === 0)
  // For a *source* we check the direction FROM endpoint TO adjacent.
  // For a *destination* we check the direction FROM adjacent TO endpoint
  // (i.e. the line must be arriving along the correct axis).
  const checkDx = isSource ? dx : -dx;
  const checkDy = isSource ? dy : -dy;

  let aligned = false;
  switch (angle) {
    case 0:   aligned = (checkDx === 0 && checkDy < 0); break;
    case 90:  aligned = (checkDy === 0 && checkDx > 0); break;
    case 180: aligned = (checkDx === 0 && checkDy > 0); break;
    case 270: aligned = (checkDy === 0 && checkDx < 0); break;
    default:  aligned = true;
  }

  if (aligned) return points;

  // Compute the approach waypoint - same as exitStub
  const approach = exitStub(endpointX, endpointY, angle, stubLen);

  // Don't insert if it duplicates the adjacent point
  if (approach.x === adjacent.x && approach.y === adjacent.y) return points;

  // We need a corner point that shortens the overshooting segment.
  // Instead of INSERTING corner+approach (which leaves the old adjacent
  // point in place, creating a zigzag), we REPLACE the adjacent point
  // with the corner - this truncates the run at the right level - and
  // then insert the approach point for the final stub.
  //
  // angle 0 or 180 (vertical entry/exit):
  //   corner = (adjacent.x, approach.y)
  //   Replaces adjacent -> shortens/adjusts the vertical run to the
  //   approach level, then approach -> endpoint is the clean stub.
  //
  // angle 90 or 270 (horizontal entry/exit):
  //   corner = (approach.x, adjacent.y)
  //   Replaces adjacent -> shortens/adjusts the horizontal run to the
  //   approach level, then approach -> endpoint is the clean stub.

  let corner: { x: number; y: number };
  if (angle === 0 || angle === 180) {
    corner = { x: adjacent.x, y: approach.y };
  } else {
    corner = { x: approach.x, y: adjacent.y };
  }

  const result = [...points];
  const cornerEqualsApproach = corner.x === approach.x && corner.y === approach.y;

  if (isSource) {
    // Replace adjacent (index 1) with corner to adjust the overshoot,
    // then insert approach between endpoint and corner.
    // Result: endpoint -> approach -> corner -> (rest...)
    result[1] = corner;
    if (!cornerEqualsApproach) {
      result.splice(1, 0, approach);
    }
  } else {
    // Replace adjacent (second to last) with corner to adjust the overshoot,
    // then insert approach between corner and endpoint.
    // Result: (...rest) -> corner -> approach -> endpoint
    result[result.length - 2] = corner;
    if (!cornerEqualsApproach) {
      result.splice(result.length - 1, 0, approach);
    }
  }
  return result;
}

// -----------------------------------------------------------------------------
// Waypoint helpers
// -----------------------------------------------------------------------------

/** Get orthogonal exit/entry angle (0, 90, 180, 270) from A toward B. Uses dominant axis. */
function directionFromTo(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return 90;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 90 : 270;
  }
  return dy >= 0 ? 180 : 0;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Compute a single segment orthogonal route. Used internally and for waypoint chaining.
 */
function computeOrthogonalSegment(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromAngle: number,
  toAngle: number,
  obstacles: Rect[],
): Array<{ x: number; y: number }> {
  const sfx = snap(fromX);
  const sfy = snap(fromY);
  const stx = snap(toX);
  const sty = snap(toY);

  const stubLen = CELL * 3;
  const entryStubLen = CELL * 3;
  const stub = exitStub(sfx, sfy, fromAngle, stubLen);
  const entryStub = exitStub(stx, sty, toAngle, entryStubLen);

  let points = astar(stub.x, stub.y, entryStub.x, entryStub.y, obstacles, fromAngle, toAngle);

  if (points) {
    points = [{ x: sfx, y: sfy }, ...points, { x: stx, y: sty }];
    points = simplifyPath(points);
  } else {
    const halfInflated = obstacles.map(o => inflateRect(o, OBSTACLE_MARGIN / 2));
    const candidateAngles = [fromAngle, fromAngle === 0 || fromAngle === 180 ? 90 : 0];
    let bestFallback: Array<{ x: number; y: number }> | null = null;

    for (const angle of candidateAngles) {
      const lPts = lRoute(sfx, sfy, stx, sty, angle);
      if (!routeIntersectsObstacles(lPts, halfInflated)) {
        bestFallback = lPts;
        break;
      }
      const zPts = zRoute(sfx, sfy, stx, sty, angle);
      if (!routeIntersectsObstacles(zPts, halfInflated)) {
        bestFallback = zPts;
        break;
      }
    }
    points = bestFallback ?? zRoute(sfx, sfy, stx, sty, fromAngle);
  }

  points = ensureApproachSegment(points, sfx, sfy, fromAngle, stubLen, true);
  points = ensureApproachSegment(points, stx, sty, toAngle, entryStubLen, false);
  return points;
}

/**
 * Compute an orthogonal (90° only) route between two connection endpoints.
 * Optional waypoints force the path to pass through each point (in order).
 * @param fromX      Source x (from getOptimalConnectionPoints)
 * @param fromY      Source y
 * @param toX        Target x
 * @param toY        Target y
 * @param fromAngle  Exit angle in degrees (0=up, 90=right, 180=down, 270=left)
 * @param toAngle    Entry angle
 * @param obstacles  Array of node/zone bounding rectangles to route around
 * @param waypoints  Optional through-points; path must pass through each (snapped to grid)
 */
export function computeOrthogonalRoute(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromAngle: number,
  toAngle: number,
  obstacles: Rect[],
  waypoints?: Array<{ x: number; y: number }>,
): OrthogonalRoute {
  const snappedWaypoints = waypoints?.length
    ? waypoints.map((wp) => ({ x: snap(wp.x), y: snap(wp.y) }))
    : undefined;

  let points: Array<{ x: number; y: number }>;

  if (!snappedWaypoints?.length) {
    points = computeOrthogonalSegment(fromX, fromY, toX, toY, fromAngle, toAngle, obstacles);
  } else {
    const all: Array<{ x: number; y: number }> = [];
    const legs = [
      { ax: fromX, ay: fromY, bx: snappedWaypoints[0].x, by: snappedWaypoints[0].y, exitAngle: fromAngle, entryAngle: directionFromTo(fromX, fromY, snappedWaypoints[0].x, snappedWaypoints[0].y) },
      ...snappedWaypoints.slice(0, -1).map((wp, i) => {
        const next = snappedWaypoints[i + 1];
        const angle = directionFromTo(wp.x, wp.y, next.x, next.y);
        return { ax: wp.x, ay: wp.y, bx: next.x, by: next.y, exitAngle: angle, entryAngle: angle };
      }),
      {
        ax: snappedWaypoints[snappedWaypoints.length - 1].x,
        ay: snappedWaypoints[snappedWaypoints.length - 1].y,
        bx: toX, by: toY,
        exitAngle: directionFromTo(snappedWaypoints[snappedWaypoints.length - 1].x, snappedWaypoints[snappedWaypoints.length - 1].y, toX, toY),
        entryAngle: toAngle,
      },
    ];

    for (let i = 0; i < legs.length; i++) {
      const seg = computeOrthogonalSegment(
        legs[i].ax, legs[i].ay, legs[i].bx, legs[i].by,
        legs[i].exitAngle, legs[i].entryAngle,
        obstacles,
      );
      if (i === 0) {
        all.push(...seg);
      } else {
        all.push(...seg.slice(1));
      }
    }
    points = simplifyPath(all);
  }

  const pathData = pointsToPathData(points);
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    totalLength += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return { points, pathData, totalLength };
}

/** Short stub point extending from (x,y) in direction `angleDeg` by `len` px */
function exitStub(x: number, y: number, angleDeg: number, len: number): { x: number; y: number } {
  // Convention: 0=up, 90=right, 180=down, 270=left
  switch (angleDeg) {
    case 0:   return { x: snap(x), y: snap(y - len) };
    case 90:  return { x: snap(x + len), y: snap(y) };
    case 180: return { x: snap(x), y: snap(y + len) };
    case 270: return { x: snap(x - len), y: snap(y) };
    default:  return { x: snap(x), y: snap(y) };
  }
}

/** Convert an array of points to an SVG path string */
function pointsToPathData(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// -----------------------------------------------------------------------------
// Animation / position helpers (mirror bezier-connection API)
// -----------------------------------------------------------------------------

/**
 * Get a point at parameter `t` (0-1) along an orthogonal route.
 * Used for text positioning and animated shapes.
 */
export function getPointOnOrthogonalPath(
  t: number,
  points: Array<{ x: number; y: number }>,
  totalLength: number,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || t <= 0) return { x: points[0].x, y: points[0].y };
  if (t >= 1) return { x: points[points.length - 1].x, y: points[points.length - 1].y };

  const targetDist = t * totalLength;
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const segLen = Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
    if (segLen === 0) continue;
    if (accumulated + segLen >= targetDist) {
      const remainder = targetDist - accumulated;
      const frac = remainder / segLen;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * frac,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * frac,
      };
    }
    accumulated += segLen;
  }

  return { x: points[points.length - 1].x, y: points[points.length - 1].y };
}

/**
 * Collect obstacle rectangles from the diagram for routing.
 * Excludes the source & target nodes so the path can exit/enter them.
 */
export function collectObstacles(
  nodesById: Record<string, { x: number; y: number; width?: number; height?: number; type?: string; [k: string]: any }>,
  zonesById: Record<string, { x: number; y: number; width: number; height: number; [k: string]: any }>,
  excludeIds: string[],
): Rect[] {
  const exclude = new Set(excludeIds);
  const rects: Rect[] = [];

  for (const [id, n] of Object.entries(nodesById)) {
    if (exclude.has(id)) continue;
    const w = n.width ?? 80;
    const h = n.height ?? 80;
    rects.push({ x: n.x, y: n.y, width: w, height: h });
  }

  for (const [id, z] of Object.entries(zonesById)) {
    if (exclude.has(id)) continue;
    rects.push({ x: z.x, y: z.y, width: z.width, height: z.height });
  }

  return rects;
}