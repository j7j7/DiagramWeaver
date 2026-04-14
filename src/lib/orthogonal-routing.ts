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

/** Soft penalty when a route crosses an existing orthogonal segment. */
const CROSSING_PENALTY = CELL * 12;

/** Mild penalty when a route reuses the exact same corridor. */
const OVERLAP_PENALTY = CELL * 0.8;

/** Near a route's endpoints we allow tighter interaction with existing lines. */
const ENDPOINT_CLEARANCE = CELL * 5;

/** Visual radius for rounded orthogonal bends when enabled. */
const SMOOTH_CORNER_RADIUS = 8;

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

export interface OrthogonalRouteOptions {
  occupiedSegments?: OrthogonalSegment[];
  smoothCorners?: boolean;
  /**
   * Skip A* and heavy obstacle bridging — L/Z fallbacks only with empty obstacle checks.
   * Use while dragging canvas items for responsiveness; full quality on release.
   */
  fastObstacleRouting?: boolean;
}

export interface OrthogonalRouteRequest extends OrthogonalRouteOptions {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromAngle: number;
  toAngle: number;
  obstacles: Rect[];
  waypoints?: Array<{ x: number; y: number }>;
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

function isAxisAlignedSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return a.x === b.x || a.y === b.y;
}

function dedupeConsecutivePoints(
  points: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];

  for (const point of points) {
    const snappedPoint = { x: snap(point.x), y: snap(point.y) };
    const last = result[result.length - 1];
    if (last && last.x === snappedPoint.x && last.y === snappedPoint.y) {
      continue;
    }
    result.push(snappedPoint);
  }

  return result;
}

function getManhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function trimPointToward(
  from: { x: number; y: number },
  to: { x: number; y: number },
  distance: number,
): { x: number; y: number } {
  if (from.x === to.x) {
    return { x: from.x, y: from.y + Math.sign(to.y - from.y) * distance };
  }

  return { x: from.x + Math.sign(to.x - from.x) * distance, y: from.y };
}

function getPerpendicularAngle(angle: number): number {
  return angle === 0 || angle === 180 ? 90 : 0;
}

function getFallbackAngles(primaryAngle: number, secondaryAngle: number): number[] {
  return Array.from(new Set([
    primaryAngle,
    secondaryAngle,
    getPerpendicularAngle(primaryAngle),
    getPerpendicularAngle(secondaryAngle),
  ]));
}

function getSegmentLength(segment: OrthogonalSegment): number {
  return Math.abs(segment.x2 - segment.x1) + Math.abs(segment.y2 - segment.y1);
}

function pointsToSegments(points: Array<{ x: number; y: number }>): OrthogonalSegment[] {
  const normalized = simplifyPath(points);
  const segments: OrthogonalSegment[] = [];

  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    if (prev.x === curr.x && prev.y === curr.y) continue;
    segments.push({ x1: prev.x, y1: prev.y, x2: curr.x, y2: curr.y });
  }

  return segments;
}

function isNearProtectedEndpoint(
  px: number,
  py: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): boolean {
  return (
    Math.abs(px - startX) + Math.abs(py - startY) <= ENDPOINT_CLEARANCE
    || Math.abs(px - endX) + Math.abs(py - endY) <= ENDPOINT_CLEARANCE
  );
}

function computeSegmentOverlapLength(candidate: OrthogonalSegment, occupied: OrthogonalSegment): number {
  const candidateHorizontal = candidate.y1 === candidate.y2;
  const occupiedHorizontal = occupied.y1 === occupied.y2;
  if (candidateHorizontal !== occupiedHorizontal) {
    return 0;
  }

  if (candidateHorizontal) {
    if (candidate.y1 !== occupied.y1) return 0;
    const start = Math.max(Math.min(candidate.x1, candidate.x2), Math.min(occupied.x1, occupied.x2));
    const end = Math.min(Math.max(candidate.x1, candidate.x2), Math.max(occupied.x1, occupied.x2));
    return Math.max(0, end - start);
  }

  if (candidate.x1 !== occupied.x1) return 0;
  const start = Math.max(Math.min(candidate.y1, candidate.y2), Math.min(occupied.y1, occupied.y2));
  const end = Math.min(Math.max(candidate.y1, candidate.y2), Math.max(occupied.y1, occupied.y2));
  return Math.max(0, end - start);
}

function getPerpendicularIntersection(
  candidate: OrthogonalSegment,
  occupied: OrthogonalSegment,
): { x: number; y: number } | null {
  const candidateHorizontal = candidate.y1 === candidate.y2;
  const occupiedHorizontal = occupied.y1 === occupied.y2;
  if (candidateHorizontal === occupiedHorizontal) {
    return null;
  }

  const horizontal = candidateHorizontal ? candidate : occupied;
  const vertical = candidateHorizontal ? occupied : candidate;
  const x = vertical.x1;
  const y = horizontal.y1;
  const withinHorizontal = x >= Math.min(horizontal.x1, horizontal.x2) && x <= Math.max(horizontal.x1, horizontal.x2);
  const withinVertical = y >= Math.min(vertical.y1, vertical.y2) && y <= Math.max(vertical.y1, vertical.y2);

  return withinHorizontal && withinVertical ? { x, y } : null;
}

function computeOccupiedSegmentPenalty(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  occupiedSegments: OrthogonalSegment[],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  if (occupiedSegments.length === 0) {
    return 0;
  }

  const candidate: OrthogonalSegment = { x1: ax, y1: ay, x2: bx, y2: by };
  let penalty = 0;

  for (const occupied of occupiedSegments) {
    const overlapLength = computeSegmentOverlapLength(candidate, occupied);
    if (overlapLength > 0) {
      const overlapMidX = candidate.x1 === candidate.x2
        ? candidate.x1
        : (Math.max(Math.min(candidate.x1, candidate.x2), Math.min(occupied.x1, occupied.x2))
          + Math.min(Math.max(candidate.x1, candidate.x2), Math.max(occupied.x1, occupied.x2))) / 2;
      const overlapMidY = candidate.y1 === candidate.y2
        ? candidate.y1
        : (Math.max(Math.min(candidate.y1, candidate.y2), Math.min(occupied.y1, occupied.y2))
          + Math.min(Math.max(candidate.y1, candidate.y2), Math.max(occupied.y1, occupied.y2))) / 2;

      if (!isNearProtectedEndpoint(overlapMidX, overlapMidY, startX, startY, endX, endY)) {
        penalty += OVERLAP_PENALTY * (overlapLength / CELL);
      }
    }

    const intersection = getPerpendicularIntersection(candidate, occupied);
    if (intersection && !isNearProtectedEndpoint(intersection.x, intersection.y, startX, startY, endX, endY)) {
      penalty += CROSSING_PENALTY;
    }
  }

  return penalty;
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

function packStateKey(gx: number, gy: number, dir: number): number {
  return packKey(gx, gy) * 8 + (dir + 1);
}

function unpackStatePosition(stateKey: number): { x: number; y: number } {
  const positionKey = Math.floor(stateKey / 8);
  const pgx = ((positionKey / 65536) | 0) - 32767;
  const pgy = (positionKey % 65536) - 32767;
  return { x: pgx * CELL, y: pgy * CELL };
}

interface AStarNode {
  x: number;
  y: number;
  g: number; // cost so far
  f: number; // g + heuristic
  dir: number; // last direction index (0-3), or -1 for start
  stateKey: number;
  parentStateKey: number;
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
  options?: OrthogonalRouteOptions,
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

  // Keep the search box wide enough to route around nearby blockers instead of
  // failing early and falling back to a simplistic L/Z path.
  const PAD = 200;
  const minObstacleX = inflated.length > 0 ? Math.min(...inflated.map((r) => r.x)) : Math.min(startX, endX);
  const maxObstacleX = inflated.length > 0 ? Math.max(...inflated.map((r) => r.x + r.width)) : Math.max(startX, endX);
  const minObstacleY = inflated.length > 0 ? Math.min(...inflated.map((r) => r.y)) : Math.min(startY, endY);
  const maxObstacleY = inflated.length > 0 ? Math.max(...inflated.map((r) => r.y + r.height)) : Math.max(startY, endY);
  const minBX = snap(Math.min(startX, endX, minObstacleX) - PAD);
  const maxBX = snap(Math.max(startX, endX, maxObstacleX) + PAD);
  const minBY = snap(Math.min(startY, endY, minObstacleY) - PAD);
  const maxBY = snap(Math.max(startY, endY, maxObstacleY) + PAD);

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
  const startStateKey = packStateKey(startX, startY, startDir);
  const endKey = packKey(endX, endY);
  const occupiedSegments = options?.occupiedSegments ?? [];

  // Open set as a simple sorted array (fast enough for our bounded search)
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const open: AStarNode[] = [];
  const closed = new Set<number>();

  const h0 = heuristic(startX, startY);
  open.push({ x: startX, y: startY, g: 0, f: h0, dir: startDir, stateKey: startStateKey, parentStateKey: -1 });
  gScore.set(startStateKey, 0);

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
    const curStateKey = current.stateKey;

    if (curKey === endKey) {
      // Reconstruct path
      const path: Array<{ x: number; y: number }> = [];
      path.push({ x: current.x, y: current.y });
      let parentStateKey = current.parentStateKey;

      while (parentStateKey !== -1) {
        path.push(unpackStatePosition(parentStateKey));
        parentStateKey = cameFrom.get(parentStateKey) ?? -1;
      }

      path.reverse();
      return simplifyPath(dedupeConsecutivePoints(path));
    }

    if (closed.has(curStateKey)) continue;
    closed.add(curStateKey);

    for (let d = 0; d < 4; d++) {
      const nx = current.x + DX[d];
      const ny = current.y + DY[d];

      // Bounds check
      if (nx < minBX || nx > maxBX || ny < minBY || ny > maxBY) continue;

      const nKey = packKey(nx, ny);
      const nStateKey = packStateKey(nx, ny, d);
      if (closed.has(nStateKey)) continue;

      // Skip blocked cells (but always allow the end cell)
      if (nKey !== endKey && isBlocked(nx, ny)) continue;

      // Cost: 1 per cell + penalty for changing direction (encourages fewer bends)
      const turnPenalty = (current.dir >= 0 && d !== current.dir) ? CELL * 2 : 0;
      const occupancyPenalty = computeOccupiedSegmentPenalty(
        current.x,
        current.y,
        nx,
        ny,
        occupiedSegments,
        startX,
        startY,
        endX,
        endY,
      );
      const tentativeG = current.g + CELL + turnPenalty + occupancyPenalty;

      const prevG = gScore.get(nStateKey);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(nStateKey, tentativeG);
      cameFrom.set(nStateKey, curStateKey);
      open.push({
        x: nx, y: ny,
        g: tentativeG,
        f: tentativeG + heuristic(nx, ny),
        dir: d,
        stateKey: nStateKey,
        parentStateKey: curStateKey,
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
  const normalizedPoints = dedupeConsecutivePoints(points);
  if (normalizedPoints.length <= 2) return normalizedPoints;

  const result: Array<{ x: number; y: number }> = [normalizedPoints[0]];
  for (let i = 1; i < normalizedPoints.length - 1; i++) {
    const prev = result[result.length - 1];
    const next = normalizedPoints[i + 1];
    const curr = normalizedPoints[i];

    // Keep point only if direction changes
    const sameX = prev.x === curr.x && curr.x === next.x;
    const sameY = prev.y === curr.y && curr.y === next.y;
    if (!sameX && !sameY) {
      result.push(curr);
    }
  }
  result.push(normalizedPoints[normalizedPoints.length - 1]);
  return result;
}

function findFallbackRoute(
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  candidateAngles: number[],
  obstacles: Rect[],
): Array<{ x: number; y: number }> | null {
  for (const angle of candidateAngles) {
    const lPts = lRoute(fx, fy, tx, ty, angle);
    if (!routeIntersectsObstacles(lPts, obstacles)) {
      return simplifyPath(lPts);
    }

    const zPts = zRoute(fx, fy, tx, ty, angle);
    if (!routeIntersectsObstacles(zPts, obstacles)) {
      return simplifyPath(zPts);
    }
  }

  return null;
}

function buildOrthogonalBridge(
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: Rect[],
  fromAngle: number,
  toAngle: number,
  options?: OrthogonalRouteOptions,
): Array<{ x: number; y: number }> {
  const start = { x: snap(from.x), y: snap(from.y) };
  const end = { x: snap(to.x), y: snap(to.y) };

  if (start.x === end.x && start.y === end.y) {
    return [start];
  }

  const inflated = obstacles.map((o) => inflateRect(o, OBSTACLE_MARGIN));
  if (isAxisAlignedSegment(start, end) && !routeIntersectsObstacles([start, end], inflated)) {
    return [start, end];
  }

  const routed = astar(start.x, start.y, end.x, end.y, obstacles, fromAngle, toAngle, options);
  if (routed) {
    return simplifyPath(routed);
  }

  const fallbackAngles = getFallbackAngles(fromAngle, directionFromTo(start.x, start.y, end.x, end.y));
  return findFallbackRoute(start.x, start.y, end.x, end.y, fallbackAngles, inflated)
    ?? findFallbackRoute(start.x, start.y, end.x, end.y, fallbackAngles, obstacles)
    ?? simplifyPath([start, { x: end.x, y: start.y }, end]);
}

function enforceOrthogonalSegments(
  points: Array<{ x: number; y: number }>,
  obstacles: Rect[],
  options?: OrthogonalRouteOptions,
): Array<{ x: number; y: number }> {
  const normalized = simplifyPath(points);
  if (normalized.length <= 2) {
    return normalized;
  }

  const result: Array<{ x: number; y: number }> = [normalized[0]];
  for (let i = 1; i < normalized.length; i++) {
    const prev = result[result.length - 1];
    const next = normalized[i];

    if (isAxisAlignedSegment(prev, next)) {
      result.push(next);
      continue;
    }

    const incomingAngle = result.length > 1
      ? directionFromTo(result[result.length - 2].x, result[result.length - 2].y, prev.x, prev.y)
      : directionFromTo(prev.x, prev.y, next.x, next.y);
    const outgoingAngle = directionFromTo(prev.x, prev.y, next.x, next.y);
    const bridge = buildOrthogonalBridge(prev, next, obstacles, incomingAngle, outgoingAngle, options);
    result.pop();
    result.push(...bridge);
  }

  return simplifyPath(result);
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
  obstacles: Rect[],
  options: OrthogonalRouteOptions | undefined,
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

  if (isSource) {
    const bridge = buildOrthogonalBridge(
      approach,
      adjacent,
      obstacles,
      angle,
      directionFromTo(approach.x, approach.y, adjacent.x, adjacent.y),
      options,
    );
    return simplifyPath([
      { x: endpointX, y: endpointY },
      ...bridge,
      ...points.slice(2),
    ]);
  } else {
    const bridge = buildOrthogonalBridge(
      adjacent,
      approach,
      obstacles,
      directionFromTo(adjacent.x, adjacent.y, approach.x, approach.y),
      angle,
      options,
    );
    return simplifyPath([
      ...points.slice(0, -2),
      ...bridge,
      { x: endpointX, y: endpointY },
    ]);
  }
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
  options?: OrthogonalRouteOptions,
): Array<{ x: number; y: number }> {
  const sfx = snap(fromX);
  const sfy = snap(fromY);
  const stx = snap(toX);
  const sty = snap(toY);

  const stubLen = CELL * 3;
  const entryStubLen = CELL * 3;
  const stub = exitStub(sfx, sfy, fromAngle, stubLen);
  const entryStub = exitStub(stx, sty, toAngle, entryStubLen);

  if (options?.fastObstacleRouting) {
    const noObs: Rect[] = [];
    const candidateAngles = getFallbackAngles(fromAngle, directionFromTo(sfx, sfy, stx, sty));
    const inner =
      findFallbackRoute(stub.x, stub.y, entryStub.x, entryStub.y, candidateAngles, noObs) ??
      zRoute(stub.x, stub.y, entryStub.x, entryStub.y, fromAngle);
    let fastPts = [{ x: sfx, y: sfy }, ...inner, { x: stx, y: sty }];
    fastPts = simplifyPath(fastPts);
    fastPts = ensureApproachSegment(fastPts, sfx, sfy, fromAngle, stubLen, noObs, options, true);
    fastPts = ensureApproachSegment(fastPts, stx, sty, toAngle, entryStubLen, noObs, options, false);
    return enforceOrthogonalSegments(fastPts, noObs, options);
  }

  let points = astar(stub.x, stub.y, entryStub.x, entryStub.y, obstacles, fromAngle, toAngle, options);

  if (points) {
    points = [{ x: sfx, y: sfy }, ...points, { x: stx, y: sty }];
    points = simplifyPath(points);
  } else {
    const inflated = obstacles.map((o) => inflateRect(o, OBSTACLE_MARGIN));
    const relaxed = obstacles.map((o) => inflateRect(o, OBSTACLE_MARGIN / 2));
    const candidateAngles = getFallbackAngles(fromAngle, directionFromTo(sfx, sfy, stx, sty));
    points = findFallbackRoute(sfx, sfy, stx, sty, candidateAngles, inflated)
      ?? findFallbackRoute(sfx, sfy, stx, sty, candidateAngles, relaxed)
      ?? zRoute(sfx, sfy, stx, sty, fromAngle);
  }

  points = ensureApproachSegment(points, sfx, sfy, fromAngle, stubLen, obstacles, options, true);
  points = ensureApproachSegment(points, stx, sty, toAngle, entryStubLen, obstacles, options, false);
  return enforceOrthogonalSegments(points, obstacles, options);
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
  options?: OrthogonalRouteOptions,
): OrthogonalRoute {
  const snappedWaypoints = waypoints?.length
    ? waypoints.map((wp) => ({ x: snap(wp.x), y: snap(wp.y) }))
    : undefined;

  let points: Array<{ x: number; y: number }>;

  if (!snappedWaypoints?.length) {
    points = computeOrthogonalSegment(fromX, fromY, toX, toY, fromAngle, toAngle, obstacles, options);
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
        options,
      );
      if (i === 0) {
        all.push(...seg);
      } else {
        all.push(...seg.slice(1));
      }
    }
    points = enforceOrthogonalSegments(all, obstacles, options);
  }

  const pathData = pointsToPathData(points, options?.smoothCorners === true);
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    totalLength += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return { points, pathData, totalLength };
}

export function computeOrthogonalRoutesBatch(
  requests: OrthogonalRouteRequest[],
): OrthogonalRoute[] {
  const occupiedSegments: OrthogonalSegment[] = [];

  return requests.map((request) => {
    const route = computeOrthogonalRoute(
      request.fromX,
      request.fromY,
      request.toX,
      request.toY,
      request.fromAngle,
      request.toAngle,
      request.obstacles,
      request.waypoints,
      {
        occupiedSegments: request.occupiedSegments ?? occupiedSegments,
        smoothCorners: request.smoothCorners === true,
        fastObstacleRouting: request.fastObstacleRouting === true,
      },
    );

    occupiedSegments.push(...pointsToSegments(route.points).filter((segment) => getSegmentLength(segment) > 0));
    return route;
  });
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
function pointsToPathData(points: Array<{ x: number; y: number }>, smoothCorners = false): string {
  const normalized = simplifyPath(points);
  if (normalized.length === 0) return "";
  if (!smoothCorners || normalized.length < 3) {
    let direct = `M ${normalized[0].x} ${normalized[0].y}`;
    for (let i = 1; i < normalized.length; i++) {
      direct += ` L ${normalized[i].x} ${normalized[i].y}`;
    }
    return direct;
  }

  let d = `M ${normalized[0].x} ${normalized[0].y}`;

  for (let i = 1; i < normalized.length - 1; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    const next = normalized[i + 1];
    const incomingLen = getManhattanDistance(prev, curr);
    const outgoingLen = getManhattanDistance(curr, next);
    const sameX = prev.x === curr.x && curr.x === next.x;
    const sameY = prev.y === curr.y && curr.y === next.y;

    if (sameX || sameY || incomingLen === 0 || outgoingLen === 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const radius = Math.min(SMOOTH_CORNER_RADIUS, incomingLen / 2, outgoingLen / 2);
    if (radius <= 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const entry = trimPointToward(curr, prev, radius);
    const exit = trimPointToward(curr, next, radius);
    d += ` L ${entry.x} ${entry.y} Q ${curr.x} ${curr.y} ${exit.x} ${exit.y}`;
  }

  const last = normalized[normalized.length - 1];
  d += ` L ${last.x} ${last.y}`;
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
 * When the user explicitly chooses a connection edge (fromPreferredExit / toPreferredEntry),
 * endpoints are excluded from the obstacle list — so the router would otherwise allow
 * segments to cut through the node's interior (e.g. across the icon) before reaching the
 * chosen side. We add a thin "free" strip along that chosen edge and block the rest of the
 * node's interior so the path must approach from outside (e.g. top/bottom) instead of
 * through the node.
 */
const PREFERRED_EDGE_STRIP_PX = CELL * 4; // 40px; ≥ stub length (CELL*3) so the corridor is usable

function pushInteriorObstacleForPreferredEdge(
  out: Rect[],
  node: { x: number; y: number; width: number; height: number },
  edge: 'top' | 'bottom' | 'left' | 'right',
  stripWidth: number,
): void {
  const { x, y, width: w, height: h } = node;
  const sw = Math.min(stripWidth, Math.max(0, w - 2), Math.max(0, h - 2));
  if (sw <= 0) return;
  switch (edge) {
    case 'right': {
      if (w - sw <= 2) return;
      out.push({ x, y, width: w - sw, height: h });
      break;
    }
    case 'left': {
      if (w - sw <= 2) return;
      out.push({ x: x + sw, y, width: w - sw, height: h });
      break;
    }
    case 'top': {
      if (h - sw <= 2) return;
      out.push({ x, y: y + sw, width: w, height: h - sw });
      break;
    }
    case 'bottom': {
      if (h - sw <= 2) return;
      out.push({ x, y, width: w, height: h - sw });
      break;
    }
  }
}

function getNodeRectForRoutingObstacle(
  id: string,
  nodesById: Record<string, { x: number; y: number; width?: number; height?: number; [k: string]: any }>,
  zonesById: Record<string, { x: number; y: number; width: number; height: number; [k: string]: any }>,
): Rect | null {
  const n = nodesById[id] || zonesById[id];
  if (!n) return null;
  const w = n.width ?? 80;
  const h = n.height ?? 80;
  return { x: n.x, y: n.y, width: w, height: h };
}

export function appendInteriorObstaclesForPreferredEdges(
  obstacles: Rect[],
  nodesById: Record<string, { x: number; y: number; width?: number; height?: number; [k: string]: any }>,
  zonesById: Record<string, { x: number; y: number; width: number; height: number; [k: string]: any }>,
  fromId: string,
  toId: string,
  fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center',
  toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center',
): Rect[] {
  const out = [...obstacles];
  if (fromPreferredExit && fromPreferredExit !== 'center') {
    const r = getNodeRectForRoutingObstacle(fromId, nodesById, zonesById);
    if (r) pushInteriorObstacleForPreferredEdge(out, r, fromPreferredExit, PREFERRED_EDGE_STRIP_PX);
  }
  if (toPreferredEntry && toPreferredEntry !== 'center') {
    const r = getNodeRectForRoutingObstacle(toId, nodesById, zonesById);
    if (r) pushInteriorObstacleForPreferredEdge(out, r, toPreferredEntry, PREFERRED_EDGE_STRIP_PX);
  }
  return out;
}

/** Obstacle rect tagged with diagram id for filtering per connection without rescanning maps. */
export interface TaggedObstacleRect extends Rect {
  sourceId: string;
}

/** Single pass over nodes + zones; reuse with {@link obstaclesForEndpoints}. */
export function buildObstacleCatalog(
  nodesById: Record<string, { x: number; y: number; width?: number; height?: number; type?: string; [k: string]: any }>,
  zonesById: Record<string, { x: number; y: number; width: number; height: number; [k: string]: any }>,
): TaggedObstacleRect[] {
  const out: TaggedObstacleRect[] = [];
  for (const [id, n] of Object.entries(nodesById)) {
    const w = n.width ?? 80;
    const h = n.height ?? 80;
    out.push({ sourceId: id, x: n.x ?? 0, y: n.y ?? 0, width: w, height: h });
  }
  for (const [id, z] of Object.entries(zonesById)) {
    out.push({ sourceId: id, x: z.x ?? 0, y: z.y ?? 0, width: z.width, height: z.height });
  }
  return out;
}

/** Rect list for routing excluding both connection endpoints (O(catalog length) per call). */
export function obstaclesForEndpoints(catalog: TaggedObstacleRect[], fromId: string, toId: string): Rect[] {
  return catalog
    .filter((o) => o.sourceId !== fromId && o.sourceId !== toId)
    .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
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