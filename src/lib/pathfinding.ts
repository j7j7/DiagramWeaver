// A simple pathfinding algorithm (A*) for orthogonal routing.
// This is a simplified version and may not be perfect.

type Point = { x: number; y: number };
export type Obstacle = { id: string, x: number; y: number; width: number; height: number };

class GridNode {
  x: number;
  y: number;
  f: number = 0; // total cost
  g: number = 0; // distance from start
  h: number = 0; // heuristic distance to end
  parent: GridNode | null = null;
  isObstacle: boolean = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

const GRID_SIZE = 20;
const OBSTACLE_PADDING = 25;

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

  obstacles.forEach(obstacle => {
    const startX = Math.floor((obstacle.x - OBSTACLE_PADDING) / GRID_SIZE);
    const endX = Math.ceil((obstacle.x + obstacle.width + OBSTACLE_PADDING) / GRID_SIZE);
    const startY = Math.floor((obstacle.y - OBSTACLE_PADDING) / GRID_SIZE);
    const endY = Math.ceil((obstacle.y + obstacle.height + OBSTACLE_PADDING) / GRID_SIZE);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (grid[y] && grid[y][x]) {
          grid[y][x].isObstacle = true;
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
      const elbow: Point = { x: end.x, y: start.y };
      return simplifyPath([start, elbow, end]);
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
        return simplifyPath(path);
      }
  
      openSet.splice(lowestIndex, 1);
      closedSet.push(current);
  
      const neighbors = getNeighbors(grid, current);
      for (const neighbor of neighbors) {
        if (!closedSet.includes(neighbor) && !neighbor.isObstacle) {
          const tempG = current.g + 1;
  
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
  
    // No path found, return an orthogonal L-shaped fallback (may cross obstacles)
    const elbow: Point = { x: end.x, y: start.y };
    return simplifyPath([start, elbow, end]);
}

function simplifyPath(path: Point[]): Point[] {
    if (path.length < 3) return path;
    const newPath: Point[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const p1 = path[i-1];
        const p2 = path[i];
        const p3 = path[i+1];

        // Check for change in direction
        const dir1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const dir2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        if (dir1.x !== dir2.x || dir1.y !== dir2.y) {
            newPath.push(p2);
        }
    }
    newPath.push(path[path.length - 1]);
    return newPath;
}
