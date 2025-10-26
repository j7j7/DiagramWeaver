// A simple pathfinding algorithm (A*) for orthogonal routing.
// This is a simplified version and may not be perfect.

type Point = { x: number; y: number };
export type Obstacle = { id: string, x: number; y: number; width: number; height: number, isZone?: boolean };

class GridNode {
  x: number;
  y: number;
  f: number = 0; // total cost
  g: number = 0; // distance from start
  h: number = 0; // heuristic distance to end
  parent: GridNode | null = null;
  isObstacle: boolean = false;
  isZone: boolean = false;
  edgeCost: number = 1; // Additional cost for being near edges

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

const GRID_SIZE = 20;
const OBSTACLE_PADDING = 25;
const EDGE_HUGGING_PENALTY = 5; // Extra cost for paths that hug edges

function createGrid(width: number, height: number, obstacles: Obstacle[]): GridNode[][] {
  const cols = Math.ceil(width / GRID_SIZE);
  const rows = Math.ceil(height / GRID_SIZE);
  const grid: GridNode[][] = [];

  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = new GridNode(x, y);
    }
  }

  // First pass: mark obstacles and zones
  obstacles.forEach(obstacle => {
    const startX = Math.floor((obstacle.x - OBSTACLE_PADDING) / GRID_SIZE);
    const endX = Math.ceil((obstacle.x + obstacle.width + OBSTACLE_PADDING) / GRID_SIZE);
    const startY = Math.floor((obstacle.y - OBSTACLE_PADDING) / GRID_SIZE);
    const endY = Math.ceil((obstacle.y + obstacle.height + OBSTACLE_PADDING) / GRID_SIZE);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (grid[y] && grid[y][x]) {
          if (obstacle.isZone) {
            // Zones are not obstacles, but we mark them for edge cost calculation
            grid[y][x].isZone = true;
          } else {
            // Regular obstacles are impassable
            grid[y][x].isObstacle = true;
          }
        }
      }
    }
  });

  // Second pass: calculate edge costs for zones
  obstacles.forEach(obstacle => {
    if (obstacle.isZone) {
      const startX = Math.floor((obstacle.x - OBSTACLE_PADDING) / GRID_SIZE);
      const endX = Math.ceil((obstacle.x + obstacle.width + OBSTACLE_PADDING) / GRID_SIZE);
      const startY = Math.floor((obstacle.y - OBSTACLE_PADDING) / GRID_SIZE);
      const endY = Math.ceil((obstacle.y + obstacle.height + OBSTACLE_PADDING) / GRID_SIZE);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          if (grid[y] && grid[y][x]) {
            // Check if this cell is on the edge of the zone
            const isEdge = 
              x === startX || x === endX - 1 || // Left or right edge
              y === startY || y === endY - 1;   // Top or bottom edge
            
            if (isEdge) {
              grid[y][x].edgeCost = EDGE_HUGGING_PENALTY;
            }
          }
        }
      }
    }
  });

  return grid;
}

function heuristic(a: GridNode, b: GridNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(grid: GridNode[][], node: GridNode): GridNode[] {
    const neighbors: GridNode[] = [];
    const { x, y } = node;
  
    if (grid[y - 1] && grid[y - 1][x]) neighbors.push(grid[y - 1][x]);
    if (grid[y + 1] && grid[y + 1][x]) neighbors.push(grid[y + 1][x]);
    if (grid[y] && grid[y][x - 1]) neighbors.push(grid[y][x - 1]);
    if (grid[y] && grid[y][x + 1]) neighbors.push(grid[y][x + 1]);
  
    return neighbors;
}

function reconstructPath(node: GridNode): Point[] {
    const path: Point[] = [];
    let current: GridNode | null = node;
    while(current) {
        path.unshift({ x: current.x * GRID_SIZE + GRID_SIZE / 2, y: current.y * GRID_SIZE + GRID_SIZE / 2 });
        current = current.parent;
    }
    return path;
}

export function findPath(start: Point, end: Point, obstacles: Obstacle[], canvasSize: {width: number, height: number}): Point[] {
    const grid = createGrid(canvasSize.width, canvasSize.height, obstacles);
    const startNode = grid[Math.floor(start.y / GRID_SIZE)]?.[Math.floor(start.x / GRID_SIZE)];
    const endNode = grid[Math.floor(end.y / GRID_SIZE)]?.[Math.floor(end.x / GRID_SIZE)];
  
    // If start or end are outside grid or on an obstacle, return a simple orthogonal fallback (no diagonals).
    if (!startNode || startNode.isObstacle || !endNode || endNode.isObstacle) {
      // Create a smarter fallback that tries to avoid edge-hugging
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      
      // Prefer horizontal-first routing for better aesthetics
      if (Math.abs(dx) > Math.abs(dy)) {
        const midX = start.x + dx;
        return postProcessPath([start, { x: midX, y: start.y }, end], obstacles);
      } else {
        const midY = start.y + dy;
        return postProcessPath([start, { x: start.x, y: midY }, end], obstacles);
      }
    }
  
    const openSet: GridNode[] = [startNode];
    const closedSet: GridNode[] = [];
  
    while(openSet.length > 0) {
      let lowestIndex = 0;
      for(let i=0; i<openSet.length; i++) {
        if(openSet[i].f < openSet[lowestIndex].f) {
          lowestIndex = i;
        }
      }
  
      const current = openSet[lowestIndex];
  
      if (current === endNode) {
        const path = reconstructPath(current);
        return postProcessPath(simplifyPath(path), obstacles);
      }
  
      openSet.splice(lowestIndex, 1);
      closedSet.push(current);
  
      const neighbors = getNeighbors(grid, current);
      for (const neighbor of neighbors) {
        if (!closedSet.includes(neighbor) && !neighbor.isObstacle) {
          // Calculate movement cost with edge penalty
          const moveCost = 1 + neighbor.edgeCost;
          const tempG = current.g + moveCost;

          let newPath = false;
          if (openSet.includes(neighbor)) {
            if (tempG < neighbor.g) {
              neighbor.g = tempG;
              newPath = true;
            }
          } else {
            neighbor.g = tempG;
            newPath = true;
            openSet.push(neighbor);
          }

          if (newPath) {
            neighbor.h = heuristic(neighbor, endNode);
            neighbor.f = neighbor.g + neighbor.h;
            neighbor.parent = current;
          }
        }
      }
    }
  
    // No path found, return a smarter orthogonal L-shaped fallback
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Create intermediate point that avoids edge-hugging
    let intermediate: Point;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal-first routing
      intermediate = { x: start.x + dx * 0.7, y: start.y };
    } else {
      // Vertical-first routing
      intermediate = { x: start.x, y: start.y + dy * 0.7 };
    }
    
    return postProcessPath([start, intermediate, end], obstacles);
}

function simplifyPath(path: Point[]): Point[] {
    if (path.length < 3) return path;
    
    // First pass: remove collinear points
    const simplified: Point[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const p1 = path[i-1];
        const p2 = path[i];
        const p3 = path[i+1];

        // Check for change in direction
        const dir1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const dir2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        // Only keep point if direction changes
        if (dir1.x !== dir2.x || dir1.y !== dir2.y) {
            simplified.push(p2);
        }
    }
    simplified.push(path[path.length - 1]);
    
    // Second pass: optimize for edge-hugging prevention
    if (simplified.length > 3) {
        const optimized: Point[] = [simplified[0]];
        
        for (let i = 1; i < simplified.length - 1; i++) {
            const prev = simplified[i-1];
            const curr = simplified[i];
            const next = simplified[i+1];
            
            // Detect edge-hugging pattern: short segment followed by long parallel segment
            const dist1 = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
            const dist2 = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y);
            
            const dir1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const dir2 = { x: next.x - curr.x, y: next.y - curr.y };
            
            // Check if we have a short turn followed by a long straight segment
            const isShortTurn = dist1 < GRID_SIZE * 2 && dist2 > GRID_SIZE * 4;
            const isSameDirection = (dir1.x === 0 && dir2.x === 0) || (dir1.y === 0 && dir2.y === 0);
            
            if (isShortTurn && isSameDirection) {
                // Skip the intermediate point to create a more direct route
                continue;
            }
            
            optimized.push(curr);
        }
        optimized.push(simplified[simplified.length - 1]);
        
        // Final validation: ensure we still have a valid path
        if (optimized.length >= 2) {
            return optimized;
        }
    }
    
    return simplified;
}

function postProcessPath(path: Point[], obstacles: Obstacle[]): Point[] {
    if (path.length < 3) return path;
    
    // Detect and fix edge-hugging patterns
    const fixedPath = [...path];
    
    for (let i = 1; i < fixedPath.length - 1; i++) {
        const prev = fixedPath[i - 1];
        const curr = fixedPath[i];
        const next = fixedPath[i + 1];
        
        // Check for edge-hugging pattern
        const dist1 = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
        const dist2 = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y);
        
        // If we have a short segment followed by a long perpendicular segment
        if (dist1 < GRID_SIZE * 3 && dist2 > GRID_SIZE * 6) {
            const dir1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const dir2 = { x: next.x - curr.x, y: next.y - curr.y };
            
            // Check if directions are perpendicular
            const isPerpendicular = (dir1.x !== 0 && dir2.y !== 0) || (dir1.y !== 0 && dir2.x !== 0);
            
            if (isPerpendicular) {
                // Try to find a better intermediate point
                const betterPoint = findBetterIntermediatePoint(prev, next, obstacles);
                if (betterPoint) {
                    fixedPath[i] = betterPoint;
                }
            }
        }
    }
    
    return fixedPath;
}

function findBetterIntermediatePoint(start: Point, end: Point, obstacles: Obstacle[]): Point | null {
    // Try different intermediate points to avoid edge-hugging
    const candidates = [
        { x: start.x, y: end.y }, // L-shape with vertical first
        { x: end.x, y: start.y }, // L-shape with horizontal first
        { x: start.x + (end.x - start.x) * 0.3, y: start.y }, // 30% horizontal
        { x: start.x, y: start.y + (end.y - start.y) * 0.3 }, // 30% vertical
        { x: start.x + (end.x - start.x) * 0.7, y: start.y }, // 70% horizontal
        { x: start.x, y: start.y + (end.y - start.y) * 0.7 }, // 70% vertical
    ];
    
    // Return the first candidate that doesn't intersect obstacles
    for (const candidate of candidates) {
        if (!pathIntersectsObstacles(start, candidate, obstacles) && 
            !pathIntersectsObstacles(candidate, end, obstacles)) {
            return candidate;
        }
    }
    
    return null;
}

function pathIntersectsObstacles(start: Point, end: Point, obstacles: Obstacle[]): boolean {
    for (const obstacle of obstacles) {
        if (obstacle.isZone) continue; // Zones are not real obstacles
        
        // Simple rectangle intersection check
        if (lineIntersectsRect(start, end, obstacle)) {
            return true;
        }
    }
    return false;
}

function lineIntersectsRect(start: Point, end: Point, rect: {x: number, y: number, width: number, height: number}): boolean {
    // Check if line segment intersects rectangle
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    
    // Check if either endpoint is inside the rectangle
    if ((start.x >= left && start.x <= right && start.y >= top && start.y <= bottom) ||
        (end.x >= left && end.x <= right && end.y >= top && end.y <= bottom)) {
        return true;
    }
    
    // Check if line intersects any of the rectangle edges
    return lineIntersectsLine(start, end, {x: left, y: top}, {x: right, y: top}) ||
           lineIntersectsLine(start, end, {x: right, y: top}, {x: right, y: bottom}) ||
           lineIntersectsLine(start, end, {x: right, y: bottom}, {x: left, y: bottom}) ||
           lineIntersectsLine(start, end, {x: left, y: bottom}, {x: left, y: top});
}

function lineIntersectsLine(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    const ccw = (A: Point, B: Point, C: Point) => {
        return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    };
    
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}