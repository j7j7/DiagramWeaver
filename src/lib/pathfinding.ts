// Revolutionary pathfinding algorithm (A*) with enhanced obstacle avoidance and smart connection logic.
// Designed to eliminate edge cases and provide optimal routing for all scenarios.

type Point = { x: number; y: number };
export type Obstacle = { id: string, x: number; y: number; width: number; height: number, isZone?: boolean, isGroup?: boolean, subType?: string };

class GridNode {
  x: number;
  y: number;
  f: number = 0; // total cost
  g: number = 0; // distance from start
  h: number = 0; // heuristic distance to end
  parent: GridNode | null = null;
  isObstacle: boolean = false;
  isZone: boolean = false;
  isGroup: boolean = false;
  nearObstacle: boolean = false; // For maintaining 1-grid distance
  nearZoneEdge: boolean = false; // For zone edge avoidance
  edgeCost: number = 1; // Additional cost for being near edges
  obstacleDistance: number = Infinity; // Distance to nearest obstacle

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

const GRID_SIZE = 20;
const OBSTACLE_PADDING = 30; // Increased for better avoidance
const ZONE_EDGE_PENALTY = 15; // Heavy penalty for zone edge hugging
const OBSTACLE_PROXIMITY_PENALTY = 10; // Penalty for being too close to obstacles
const PREFERRED_CLEARANCE = GRID_SIZE; // Minimum preferred distance from obstacles

function createGrid(width: number, height: number, obstacles: Obstacle[]): GridNode[][] {
  const cols = Math.ceil(width / GRID_SIZE);
  const rows = Math.ceil(height / GRID_SIZE);
  const grid: GridNode[][] = [];

  // Initialize grid
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = new GridNode(x, y);
    }
  }

  // First pass: mark core obstacles and zones (exact boundaries)
  obstacles.forEach(obstacle => {
    const coreStartX = Math.floor(obstacle.x / GRID_SIZE);
    const coreEndX = Math.ceil((obstacle.x + obstacle.width) / GRID_SIZE);
    const coreStartY = Math.floor(obstacle.y / GRID_SIZE);
    const coreEndY = Math.ceil((obstacle.y + obstacle.height) / GRID_SIZE);

    for (let y = coreStartY; y < coreEndY; y++) {
      for (let x = coreStartX; x < coreEndX; x++) {
        if (grid[y] && grid[y][x]) {
          if (obstacle.isZone) {
            grid[y][x].isZone = true;
          } else if (obstacle.isGroup) {
            grid[y][x].isGroup = true;
          } else {
            // Regular nodes are impassable obstacles
            grid[y][x].isObstacle = true;
          }
        }
      }
    }
  });

  // Second pass: create buffer zones around obstacles (1 grid spacing minimum)
  obstacles.forEach(obstacle => {
    if (!obstacle.isZone) { // Don't create buffers around zones, only real obstacles
      const bufferDistance = Math.max(GRID_SIZE, OBSTACLE_PADDING);
      const bufferStartX = Math.floor((obstacle.x - bufferDistance) / GRID_SIZE);
      const bufferEndX = Math.ceil((obstacle.x + obstacle.width + bufferDistance) / GRID_SIZE);
      const bufferStartY = Math.floor((obstacle.y - bufferDistance) / GRID_SIZE);
      const bufferEndY = Math.ceil((obstacle.y + obstacle.height + bufferDistance) / GRID_SIZE);

      for (let y = bufferStartY; y < bufferEndY; y++) {
        for (let x = bufferStartX; x < bufferEndX; x++) {
          if (grid[y] && grid[y][x] && !grid[y][x].isObstacle) {
            // Calculate actual distance to obstacle center
            const cellCenterX = x * GRID_SIZE + GRID_SIZE / 2;
            const cellCenterY = y * GRID_SIZE + GRID_SIZE / 2;
            const obstacleCenterX = obstacle.x + obstacle.width / 2;
            const obstacleCenterY = obstacle.y + obstacle.height / 2;
            const distance = Math.sqrt(
              Math.pow(cellCenterX - obstacleCenterX, 2) + 
              Math.pow(cellCenterY - obstacleCenterY, 2)
            );
            
            // Update obstacle distance for cost calculation
            grid[y][x].obstacleDistance = Math.min(grid[y][x].obstacleDistance, distance);
            
            // Mark cells that are too close to obstacles
            if (distance < PREFERRED_CLEARANCE) {
              grid[y][x].nearObstacle = true;
              grid[y][x].edgeCost += OBSTACLE_PROXIMITY_PENALTY;
            }
          }
        }
      }
    }
  });

  // Third pass: handle zone edge penalties and group boundaries with extended buffer
  obstacles.forEach(obstacle => {
    if (obstacle.isZone || obstacle.isGroup) {
      const coreStartX = Math.floor(obstacle.x / GRID_SIZE);
      const coreEndX = Math.ceil((obstacle.x + obstacle.width) / GRID_SIZE);
      const coreStartY = Math.floor(obstacle.y / GRID_SIZE);
      const coreEndY = Math.ceil((obstacle.y + obstacle.height) / GRID_SIZE);
      
      // Create an extended area around groups/zones to prevent edge routing
      const extendedMargin = 2; // 2 grid cells margin
      const extStartX = Math.max(0, coreStartX - extendedMargin);
      const extEndX = Math.min(cols, coreEndX + extendedMargin);
      const extStartY = Math.max(0, coreStartY - extendedMargin);
      const extEndY = Math.min(rows, coreEndY + extendedMargin);

      for (let y = extStartY; y < extEndY; y++) {
        for (let x = extStartX; x < extEndX; x++) {
          if (grid[y] && grid[y][x]) {
            // Distance from core boundary
            const distFromCoreX = Math.max(0, Math.max(coreStartX - x, x - (coreEndX - 1)));
            const distFromCoreY = Math.max(0, Math.max(coreStartY - y, y - (coreEndY - 1)));
            const distFromCore = Math.max(distFromCoreX, distFromCoreY);
            
            // Core area penalties
            if (distFromCore === 0) {
              // Inside the core area
              const isLeftEdge = x === coreStartX;
              const isRightEdge = x === coreEndX - 1;
              const isTopEdge = y === coreStartY;
              const isBottomEdge = y === coreEndY - 1;
              const isEdge = isLeftEdge || isRightEdge || isTopEdge || isBottomEdge;
              
              if (isEdge) {
                grid[y][x].nearZoneEdge = true;
                grid[y][x].edgeCost += ZONE_EDGE_PENALTY * 2; // Double penalty for core edges
              }
              
              // Extreme penalty for corner cells
              const isCorner = (isLeftEdge || isRightEdge) && (isTopEdge || isBottomEdge);
              if (isCorner) {
                grid[y][x].edgeCost += ZONE_EDGE_PENALTY * 3; // Triple penalty for corners
              }
            } else if (distFromCore === 1) {
              // First ring around core - high penalty to discourage edge-hugging
              grid[y][x].nearZoneEdge = true;
              grid[y][x].edgeCost += ZONE_EDGE_PENALTY;
            } else if (distFromCore === 2) {
              // Second ring - moderate penalty
              grid[y][x].edgeCost += ZONE_EDGE_PENALTY / 2;
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
  
    // 4-directional movement (orthogonal only for clean lines)
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }, // left
      { dx: 1, dy: 0 }   // right
    ];
    
    for (const dir of directions) {
      const newX = x + dir.dx;
      const newY = y + dir.dy;
      
      if (grid[newY] && grid[newY][newX]) {
        neighbors.push(grid[newY][newX]);
      }
    }
  
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

function findPathWithPreferredDirection(
  start: Point, 
  end: Point, 
  obstacles: Obstacle[], 
  canvasSize: {width: number, height: number}, 
  preferredDirection: 'top' | 'bottom' | 'left' | 'right',
  grid: GridNode[][],
  startNode: GridNode,
  endNode: GridNode,
  targetIsZone?: boolean,
  preferredEndDirection?: 'top' | 'bottom' | 'left' | 'right'
): Point[] {
  // Calculate the direction vector for preferred direction
  const directionMap = {
    'top': { dx: 0, dy: -1 },
    'bottom': { dx: 0, dy: 1 },
    'left': { dx: -1, dy: 0 },
    'right': { dx: 1, dy: 0 }
  };
  
  const preferredDir = directionMap[preferredDirection];
  
  // Find the first valid node in the preferred direction
  let forcedFirstNode: GridNode | null = null;
  let steps = 1;
  const maxSteps = 10; // Don't search too far
  
  while (steps <= maxSteps && !forcedFirstNode) {
    const newX = startNode.x + (preferredDir.dx * steps);
    const newY = startNode.y + (preferredDir.dy * steps);
    
    if (grid[newY] && grid[newY][newX] && !grid[newY][newX].isObstacle) {
      forcedFirstNode = grid[newY][newX];
      break;
    }
    steps++;
  }
  
  // If we can't move in preferred direction, fall back to regular pathfinding
  if (!forcedFirstNode) {
    return findRegularPath(grid, startNode, endNode, obstacles);
  }
  
  // Find path from the forced first node to the end
  const pathFromForced = findRegularPath(grid, forcedFirstNode, endNode, obstacles);
  
  if (pathFromForced.length === 0) {
    // If no path from forced node, try regular pathfinding
    return findRegularPath(grid, startNode, endNode, obstacles);
  }
  
  // Create proper orthogonal path with preferred direction
  const startPoint = { x: start.x, y: start.y };
  const forcedPoint = { x: forcedFirstNode.x * GRID_SIZE + GRID_SIZE / 2, y: forcedFirstNode.y * GRID_SIZE + GRID_SIZE / 2 };
  
  // Create an intermediate point that ensures we exit in the preferred direction
  let orthogonalPath: Point[] = [startPoint];
  
  // Calculate an intermediate point one grid step away in the preferred direction
  const intermediatePoint = {
    x: startPoint.x + (preferredDir.dx * GRID_SIZE),
    y: startPoint.y + (preferredDir.dy * GRID_SIZE)
  };
  
  // Add the intermediate point to ensure we exit in the preferred direction
  orthogonalPath.push(intermediatePoint);
  
  // If the forced point is not the same as our intermediate point, add it
  if (Math.abs(forcedPoint.x - intermediatePoint.x) > 5 || Math.abs(forcedPoint.y - intermediatePoint.y) > 5) {
    orthogonalPath.push(forcedPoint);
  }
  
  // Remove the first point from pathFromForced since it's the same as forcedPoint
  const remainingPath = pathFromForced.slice(1);
  
  // Combine the orthogonal path with the remaining path
  let fullPath = [...orthogonalPath, ...remainingPath];
  
  // Handle preferred end direction
  if (preferredEndDirection && fullPath.length >= 2) {
    const endPoint = { x: end.x, y: end.y };
    const endDirMap = {
      'top': { dx: 0, dy: -1 },
      'bottom': { dx: 0, dy: 1 },
      'left': { dx: -1, dy: 0 },
      'right': { dx: 1, dy: 0 }
    };
    const endDir = endDirMap[preferredEndDirection];
    
    // Create an approach point one grid step away in the opposite direction of preferred entry
    const approachPoint = {
      x: endPoint.x - (endDir.dx * GRID_SIZE),
      y: endPoint.y - (endDir.dy * GRID_SIZE)
    };
    
    // Modify the path to approach from the preferred direction
    if (fullPath.length >= 2) {
      fullPath[fullPath.length - 2] = approachPoint;
      fullPath[fullPath.length - 1] = endPoint;
    } else {
      fullPath.push(approachPoint);
      fullPath.push(endPoint);
    }
  } else if (targetIsZone && fullPath.length >= 2) {
    // If target is a zone (but no preferred end direction), ensure the final segment is straight
    const secondToLast = fullPath[fullPath.length - 2];
    const last = fullPath[fullPath.length - 1];
    
    // Check if the final segment needs to be made straight
    if (Math.abs(last.x - secondToLast.x) > 5 && Math.abs(last.y - secondToLast.y) > 5) {
      // Make the final segment straight by aligning with the end point
      const straightEndPoint = { x: end.x, y: end.y };
      fullPath[fullPath.length - 1] = straightEndPoint;
    }
  }
  
  return postProcessPath(simplifyPath(fullPath), obstacles);
}

function findRegularPath(grid: GridNode[][], startNode: GridNode, endNode: GridNode, obstacles: Obstacle[]): Point[] {
  // Reset all nodes for a fresh search
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      grid[y][x].f = 0;
      grid[y][x].g = 0;
      grid[y][x].h = 0;
      grid[y][x].parent = null;
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
      return reconstructPath(current);
    }

    openSet.splice(lowestIndex, 1);
    closedSet.push(current);

    const neighbors = getNeighbors(grid, current);
    for (const neighbor of neighbors) {
      if (!closedSet.includes(neighbor) && !neighbor.isObstacle) {
        const baseCost = 1;
        const edgePenalty = neighbor.edgeCost;
        const proximityPenalty = neighbor.nearObstacle ? OBSTACLE_PROXIMITY_PENALTY : 0;
        const zoneEdgePenalty = neighbor.nearZoneEdge ? ZONE_EDGE_PENALTY : 0;
        
        let distancePenalty = 0;
        if (neighbor.obstacleDistance < PREFERRED_CLEARANCE) {
          distancePenalty = Math.max(0, (PREFERRED_CLEARANCE - neighbor.obstacleDistance) / PREFERRED_CLEARANCE * 5);
        }
        
        let directionPenalty = 0;
        if (current.parent) {
          const prevDirection = { x: current.x - current.parent.x, y: current.y - current.parent.y };
          const newDirection = { x: neighbor.x - current.x, y: neighbor.y - current.y };
          if (prevDirection.x !== newDirection.x && prevDirection.y !== newDirection.y) {
            directionPenalty = 0.5;
          }
        }
        
        let edgeHuggingPenalty = 0;
        if (neighbor.nearZoneEdge && current.parent && current.parent.nearZoneEdge) {
          const prevDirection = { x: current.x - current.parent.x, y: current.y - current.parent.y };
          const newDirection = { x: neighbor.x - current.x, y: neighbor.y - current.y };
          
          if (prevDirection.x === newDirection.x && prevDirection.y === newDirection.y) {
            edgeHuggingPenalty = ZONE_EDGE_PENALTY * 5;
          }
        }
        
        const totalMoveCost = baseCost + edgePenalty + proximityPenalty + zoneEdgePenalty + distancePenalty + directionPenalty + edgeHuggingPenalty;
        const tempG = current.g + totalMoveCost;

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
  
  return []; // No path found
}

function findPathWithStraightZoneEntry(
  start: Point,
  end: Point,
  obstacles: Obstacle[],
  canvasSize: {width: number, height: number},
  grid: GridNode[][],
  startNode: GridNode,
  endNode: GridNode
): Point[] {
  // First, find a regular path
  const regularPath = findRegularPath(grid, startNode, endNode, obstacles);
  
  if (regularPath.length < 2) {
    return regularPath;
  }
  
  // Ensure the final segment goes straight into the zone
  const modifiedPath = [...regularPath];
  
  // If there are at least 2 points, make sure the last segment is orthogonal and straight
  if (modifiedPath.length >= 2) {
    const secondToLast = modifiedPath[modifiedPath.length - 2];
    const actualEndPoint = { x: end.x, y: end.y };
    
    // Determine if we should approach horizontally or vertically
    const dx = Math.abs(actualEndPoint.x - secondToLast.x);
    const dy = Math.abs(actualEndPoint.y - secondToLast.y);
    
    // Create an intermediate point to ensure straight entry
    if (dx > 5 && dy > 5) {
      // Choose the shorter approach to minimize the turn
      if (dx < dy) {
        // Approach horizontally first, then vertically
        const intermediatePoint = { x: actualEndPoint.x, y: secondToLast.y };
        modifiedPath[modifiedPath.length - 1] = intermediatePoint;
        modifiedPath.push(actualEndPoint);
      } else {
        // Approach vertically first, then horizontally  
        const intermediatePoint = { x: secondToLast.x, y: actualEndPoint.y };
        modifiedPath[modifiedPath.length - 1] = intermediatePoint;
        modifiedPath.push(actualEndPoint);
      }
    } else {
      // Already mostly aligned, just ensure exact end point
      modifiedPath[modifiedPath.length - 1] = actualEndPoint;
    }
  }
  
  return postProcessPath(simplifyPath(modifiedPath), obstacles);
}

export function findPath(start: Point, end: Point, obstacles: Obstacle[], canvasSize: {width: number, height: number}, preferredStartDirection?: 'top' | 'bottom' | 'left' | 'right', targetIsZone?: boolean, preferredEndDirection?: 'top' | 'bottom' | 'left' | 'right'): Point[] {
    const grid = createGrid(canvasSize.width, canvasSize.height, obstacles);
    const startNode = grid[Math.floor(start.y / GRID_SIZE)]?.[Math.floor(start.x / GRID_SIZE)];
    const endNode = grid[Math.floor(end.y / GRID_SIZE)]?.[Math.floor(end.x / GRID_SIZE)];
  
    // Enhanced fallback logic for invalid start/end positions
    if (!startNode || startNode.isObstacle || !endNode || endNode.isObstacle) {
      return createIntelligentFallbackPath(start, end, obstacles, grid);
    }

    // If preferred start direction is specified, force first move in that direction
    if (preferredStartDirection) {
      return findPathWithPreferredDirection(start, end, obstacles, canvasSize, preferredStartDirection, grid, startNode, endNode, targetIsZone, preferredEndDirection);
    }
    
    // If target is a zone, ensure clean straight-line entry
    if (targetIsZone) {
      return findPathWithStraightZoneEntry(start, end, obstacles, canvasSize, grid, startNode, endNode);
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
          // Enhanced cost calculation with multiple factors
          const baseCost = 1;
          const edgePenalty = neighbor.edgeCost;
          const proximityPenalty = neighbor.nearObstacle ? OBSTACLE_PROXIMITY_PENALTY : 0;
          const zoneEdgePenalty = neighbor.nearZoneEdge ? ZONE_EDGE_PENALTY : 0;
          
          // Dynamic penalty based on distance to obstacles
          let distancePenalty = 0;
          if (neighbor.obstacleDistance < PREFERRED_CLEARANCE) {
            distancePenalty = Math.max(0, (PREFERRED_CLEARANCE - neighbor.obstacleDistance) / PREFERRED_CLEARANCE * 5);
          }
          
          // Direction change penalty (encourage straight lines but allow necessary turns)
          let directionPenalty = 0;
          if (current.parent) {
            const prevDirection = { x: current.x - current.parent.x, y: current.y - current.parent.y };
            const newDirection = { x: neighbor.x - current.x, y: neighbor.y - current.y };
            if (prevDirection.x !== newDirection.x && prevDirection.y !== newDirection.y) {
              directionPenalty = 0.5; // Small penalty for direction changes
            }
          }
          
          // Edge-hugging detection and heavy penalty
          let edgeHuggingPenalty = 0;
          if (neighbor.nearZoneEdge && current.parent && current.parent.nearZoneEdge) {
            // We're continuing along a zone edge - heavily penalize this
            const prevDirection = { x: current.x - current.parent.x, y: current.y - current.parent.y };
            const newDirection = { x: neighbor.x - current.x, y: neighbor.y - current.y };
            
            // If we're moving in the same direction along an edge, apply massive penalty
            if (prevDirection.x === newDirection.x && prevDirection.y === newDirection.y) {
              edgeHuggingPenalty = ZONE_EDGE_PENALTY * 5; // Massive penalty for edge-hugging
            }
          }
          
          const totalMoveCost = baseCost + edgePenalty + proximityPenalty + zoneEdgePenalty + distancePenalty + directionPenalty + edgeHuggingPenalty;
          const tempG = current.g + totalMoveCost;

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
  
    // No path found, use enhanced fallback
    return createIntelligentFallbackPath(start, end, obstacles, grid);
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
    
    // Second pass: optimize for edge-hugging prevention and allow tighter bends
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
            
            // Also check for inefficient routing with unnecessary long detours
            const totalDistance = dist1 + dist2;
            const directDistance = Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
            const isInefficient = totalDistance > directDistance * 1.5; // 50% longer than direct route
            
            if ((isShortTurn && isSameDirection) || isInefficient) {
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
    
    // Detect and fix edge-hugging patterns and inefficient routing
    const fixedPath = [...path];
    
    for (let i = 1; i < fixedPath.length - 1; i++) {
        const prev = fixedPath[i - 1];
        const curr = fixedPath[i];
        const next = fixedPath[i + 1];
        
        // Check for edge-hugging pattern
        const dist1 = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
        const dist2 = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y);
        
        // Calculate total path efficiency
        const totalDistance = dist1 + dist2;
        const directDistance = Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
        const efficiency = directDistance / totalDistance;
        
        // If we have an inefficient path (less than 70% efficient)
        if (efficiency < 0.7) {
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
        
        // Also check for classic edge-hugging: short segment + long perpendicular segment
        if (dist1 < GRID_SIZE * 3 && dist2 > GRID_SIZE * 6) {
            const dir1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const dir2 = { x: next.x - curr.x, y: next.y - curr.y };
            
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
    // Calculate the distance between start and end
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // For close objects, try tighter bends
    const isClose = distance < 200;
    
    // Try different intermediate points to avoid edge-hugging
    const candidates = [
        { x: start.x, y: end.y }, // L-shape with vertical first
        { x: end.x, y: start.y }, // L-shape with horizontal first
        ...(isClose ? [
            { x: start.x + (end.x - start.x) * 0.2, y: start.y }, // 20% horizontal - tighter bend
            { x: start.x, y: start.y + (end.y - start.y) * 0.2 }, // 20% vertical - tighter bend
            { x: start.x + (end.x - start.x) * 0.8, y: start.y }, // 80% horizontal - tighter bend
            { x: start.x, y: start.y + (end.y - start.y) * 0.8 }, // 80% vertical - tighter bend
        ] : [
            { x: start.x + (end.x - start.x) * 0.3, y: start.y }, // 30% horizontal
            { x: start.x, y: start.y + (end.y - start.y) * 0.3 }, // 30% vertical
            { x: start.x + (end.x - start.x) * 0.7, y: start.y }, // 70% horizontal
            { x: start.x, y: start.y + (end.y - start.y) * 0.7 }, // 70% vertical
        ])
    ];
    
    // Score candidates based on path efficiency and obstacle avoidance
    let bestCandidate = null;
    let bestScore = -Infinity;
    
    for (const candidate of candidates) {
        if (!pathIntersectsObstacles(start, candidate, obstacles) && 
            !pathIntersectsObstacles(candidate, end, obstacles)) {
            
            // Calculate path efficiency
            const pathLength = Math.abs(candidate.x - start.x) + Math.abs(candidate.y - start.y) +
                              Math.abs(end.x - candidate.x) + Math.abs(end.y - candidate.y);
            const directLength = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
            const efficiency = directLength / pathLength;
            
            // Prefer more efficient paths
            const score = efficiency * 100;
            
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }
    }
    
    return bestCandidate;
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

// Enhanced fallback path creation with intelligent routing
function createIntelligentFallbackPath(start: Point, end: Point, obstacles: Obstacle[], grid: GridNode[][] | null): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // For close connections, try direct routing first
  if (distance < 150) {
    const directPath = [start, end];
    if (!pathIntersectsObstacles(start, end, obstacles.filter(o => !o.isZone))) {
      return directPath;
    }
  }
  
  // Create multiple path candidates and choose the best one
  const candidates: Point[][] = [];
  
  // L-shaped paths with different bend points
  const bendPoints = [0.2, 0.3, 0.5, 0.7, 0.8];
  
  for (const bendRatio of bendPoints) {
    // Horizontal-first L-shape
    const hMid = { x: start.x + dx * bendRatio, y: start.y };
    candidates.push([start, hMid, end]);
    
    // Vertical-first L-shape
    const vMid = { x: start.x, y: start.y + dy * bendRatio };
    candidates.push([start, vMid, end]);
  }
  
  // Z-shaped paths for complex routing
  if (Math.abs(dx) > 100 && Math.abs(dy) > 100) {
    const zMid1 = { x: start.x + dx * 0.3, y: start.y };
    const zMid2 = { x: start.x + dx * 0.7, y: end.y };
    candidates.push([start, zMid1, zMid2, end]);
    
    const zMid3 = { x: start.x, y: start.y + dy * 0.3 };
    const zMid4 = { x: end.x, y: start.y + dy * 0.7 };
    candidates.push([start, zMid3, zMid4, end]);
  }
  
  // Score and select the best candidate
  let bestPath = candidates[0] || [start, end];
  let bestScore = -Infinity;
  
  for (const candidate of candidates) {
    const score = scorePath(candidate, obstacles);
    if (score > bestScore) {
      bestScore = score;
      bestPath = candidate;
    }
  }
  
  return postProcessPath(bestPath, obstacles);
}

// Score a path based on various factors
function scorePath(path: Point[], obstacles: Obstacle[]): number {
  let score = 0;
  
  // Calculate total path length (shorter is better)
  let totalLength = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i-1].x;
    const dy = path[i].y - path[i-1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  
  const directLength = Math.sqrt(
    Math.pow(path[path.length-1].x - path[0].x, 2) + 
    Math.pow(path[path.length-1].y - path[0].y, 2)
  );
  
  const efficiency = directLength / totalLength;
  score += efficiency * 100; // Reward efficiency
  
  // Penalize obstacle intersections heavily
  for (let i = 1; i < path.length; i++) {
    if (pathIntersectsObstacles(path[i-1], path[i], obstacles.filter(o => !o.isZone))) {
      score -= 1000; // Heavy penalty for intersections
    }
  }
  
  // Bonus for fewer segments (simpler paths)
  score += (10 - path.length) * 5;
  
  // Penalize paths that go too close to obstacles
  for (let i = 0; i < path.length; i++) {
    for (const obstacle of obstacles) {
      if (obstacle.isZone) continue;
      
      const minDist = getMinDistanceToRectangle(path[i], obstacle);
      if (minDist < PREFERRED_CLEARANCE) {
        score -= (PREFERRED_CLEARANCE - minDist) * 0.5;
      }
    }
  }
  
  return score;
}

// Get minimum distance from a point to a rectangle
function getMinDistanceToRectangle(point: Point, rect: {x: number, y: number, width: number, height: number}): number {
  const dx = Math.max(0, Math.max(rect.x - point.x, point.x - (rect.x + rect.width)));
  const dy = Math.max(0, Math.max(rect.y - point.y, point.y - (rect.y + rect.height)));
  return Math.sqrt(dx * dx + dy * dy);
}
