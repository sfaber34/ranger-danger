import { CFG } from '../config';

export type Grid = number[][]; // 0 = walkable, 1 = blocked (wall/tower)

export function createGrid(cols = CFG.worldCols, rows = CFG.worldRows): Grid {
  const g: Grid = [];
  for (let y = 0; y < rows; y++) {
    g.push(new Array(cols).fill(0));
  }
  return g;
}

export function inBounds(g: Grid, x: number, y: number) {
  return y >= 0 && y < g.length && x >= 0 && x < g[0].length;
}

// BFS from (sx,sy) to (tx,ty). Returns list of {x,y} tile coords or empty.
export function findPath(
  g: Grid,
  sx: number, sy: number,
  tx: number, ty: number
): { x: number; y: number }[] {
  if (!inBounds(g, sx, sy)) return [];
  const rows = g.length, cols = g[0].length;
  const prev = new Array(rows * cols).fill(-1);
  const visited = new Uint8Array(rows * cols);
  const idx = (x: number, y: number) => y * cols + x;
  const queue: number[] = [];
  const start = idx(sx, sy);
  queue.push(start);
  visited[start] = 1;

  let foundTarget = false;
  // 8-directional: cardinals first, then diagonals
  const cardinals: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
  const diagonals: [number, number][] = [[1,1],[-1,1],[1,-1],[-1,-1]];

  while (queue.length) {
    const cur = queue.shift()!;
    const cx = cur % cols, cy = Math.floor(cur / cols);
    if (cx === tx && cy === ty) { foundTarget = true; break; }
    // Cardinals
    for (const [dx, dy] of cardinals) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      if (g[ny][nx] === 1) continue;
      visited[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
    // Diagonals — only if both adjacent cardinal tiles are walkable (no wall-cutting)
    for (const [dx, dy] of diagonals) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      if (g[ny][nx] === 1) continue;
      if (g[cy][cx + dx] === 1 || g[cy + dy][cx] === 1) continue; // can't cut corners
      visited[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }

  if (!foundTarget) return [];
  const goalIdx = idx(tx, ty);
  const path: { x: number; y: number }[] = [];
  let c = goalIdx;
  while (c !== -1 && c !== start) {
    path.push({ x: c % cols, y: Math.floor(c / cols) });
    c = prev[c];
  }
  path.reverse();
  return path;
}

// Flood-fill from the player tile and check that at least one walkable tile
// on each of the 4 map edges is reachable. This ensures enemies spawning from
// any edge can always path to the player without breaking structures.
export function edgesCanReachPlayer(g: Grid, px: number, py: number): boolean {
  const rows = g.length, cols = g[0].length;
  if (!inBounds(g, px, py) || g[py][px] === 1) return false;

  const visited = new Uint8Array(rows * cols);
  const idx = (x: number, y: number) => y * cols + x;
  const queue: number[] = [];
  const start = idx(px, py);
  queue.push(start);
  visited[start] = 1;

  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  while (queue.length) {
    const cur = queue.shift()!;
    const cx = cur % cols, cy = Math.floor(cur / cols);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      if (g[ny][nx] === 1) continue;
      visited[ni] = 1;
      queue.push(ni);
    }
  }

  // Check each edge for at least one reachable walkable tile
  let top = false, bottom = false, left = false, right = false;
  for (let x = 0; x < cols; x++) {
    if (visited[idx(x, 0)]) top = true;
    if (visited[idx(x, rows - 1)]) bottom = true;
  }
  for (let y = 0; y < rows; y++) {
    if (visited[idx(0, y)]) left = true;
    if (visited[idx(cols - 1, y)]) right = true;
  }
  return top && bottom && left && right;
}
