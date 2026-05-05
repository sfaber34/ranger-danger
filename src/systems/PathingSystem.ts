import { CFG } from '../config';
import { gridGet } from './Pathfinding';
import type { GameScene } from '../scenes/GameScene';

/**
 * Tile-grid lookups, line-of-sight rays, reachability checks, and
 * wall-tilemap / gap-blocker maintenance. All methods read/write the
 * GameScene's `grid` SparseGrid directly during Phase 1.
 */
export class PathingSystem {
  constructor(private scene: GameScene) {}

  worldToTile(x: number, y: number) {
    return { x: Math.floor(x / CFG.tile), y: Math.floor(y / CFG.tile) };
  }

  /** Tile-grid raycast: returns true if no wall (1) or tower (2) tiles block the line. */
  hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const t = CFG.tile;
    const grid = this.scene.grid;
    let tx = Math.floor(x1 / t), ty = Math.floor(y1 / t);
    const ex = Math.floor(x2 / t), ey = Math.floor(y2 / t);
    const dx = Math.abs(ex - tx), dy = Math.abs(ey - ty);
    const sx = tx < ex ? 1 : -1, sy = ty < ey ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (tx === ex && ty === ey) return true;
      const v = gridGet(grid, tx, ty);
      if (v === 1 || v === 2) return false; // wall or tower blocks
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; tx += sx; }
      if (e2 < dx)  { err += dx; ty += sy; }
    }
  }

  /** Count how many of the 4 cardinal spawn directions can reach (px, py).
   *  Uses a single BFS flood from the player outward (reachability is
   *  symmetric in this grid) instead of running up to ~200 separate BFS
   *  calls — the previous implementation tried up to 49 candidate seeds per
   *  direction, each doing a full findPath, which made the per-frame ghost
   *  validity check stutter when the player stood near towers. */
  countReachableDirections(px: number, py: number): number {
    const grid = this.scene.grid;
    const dist = this.scene.spawnDist;
    // Region covering the player and all 4 cardinal target points + radius-3
    // search ring + a small pad. Using a typed Uint8Array indexed by (x,y)
    // offset so we can mark visited cells without per-cell hashing.
    const pad = 4;
    const minX = px - dist - pad, maxX = px + dist + pad;
    const minY = py - dist - pad, maxY = py + dist + pad;
    const w = maxX - minX + 1;
    const visited = new Uint8Array(w * (maxY - minY + 1));
    const idx = (x: number, y: number) => (y - minY) * w + (x - minX);

    const queue: number[] = [];
    let qHead = 0;
    queue.push(idx(px, py));
    visited[idx(px, py)] = 1;

    const cardinals: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
    const diagonals: [number, number][] = [[1,1],[-1,1],[1,-1],[-1,-1]];
    while (qHead < queue.length) {
      const cur = queue[qHead++];
      const cx = (cur % w) + minX;
      const cy = ((cur - (cur % w)) / w) + minY;
      for (const [dx, dy] of cardinals) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const ni = idx(nx, ny);
        if (visited[ni]) continue;
        const nv = gridGet(grid, nx, ny);
        if (nv >= 1 && nv !== 5) continue; // 5 = bridge, walkable
        visited[ni] = 1;
        queue.push(ni);
      }
      // Diagonal squeeze rules mirror findPath: walls (1), trees (3), water
      // (4) on either side block; towers (2) and bridges (5) allow the gap.
      for (const [dx, dy] of diagonals) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const ni = idx(nx, ny);
        if (visited[ni]) continue;
        const dv = gridGet(grid, nx, ny);
        if (dv >= 1 && dv !== 5) continue;
        const c1 = gridGet(grid, cx + dx, cy);
        const c2 = gridGet(grid, cx, cy + dy);
        const solid1 = c1 === 1 || c1 === 3 || c1 === 4;
        const solid2 = c2 === 1 || c2 === 3 || c2 === 4;
        if (solid1 || solid2 || (c1 >= 1 && c2 >= 1)) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }

    const targets = [
      { x: px, y: py - dist },
      { x: px, y: py + dist },
      { x: px - dist, y: py },
      { x: px + dist, y: py },
    ];
    let reachable = 0;
    for (const tp of targets) {
      let found = false;
      for (let r = 0; r <= 3 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const sx = tp.x + dx, sy = tp.y + dy;
            if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;
            if (visited[idx(sx, sy)]) found = true;
          }
        }
      }
      if (found) reachable++;
    }
    return reachable;
  }

  lineBlocked(x0: number, y0: number, x1: number, y1: number): boolean {
    const grid = this.scene.grid;
    const tx0 = Math.floor(x0 / CFG.tile), ty0 = Math.floor(y0 / CFG.tile);
    const tx1 = Math.floor(x1 / CFG.tile), ty1 = Math.floor(y1 / CFG.tile);
    let x = tx0, y = ty0;
    const dx = Math.abs(tx1 - tx0), dy = Math.abs(ty1 - ty0);
    const sx = tx0 < tx1 ? 1 : -1;
    const sy = ty0 < ty1 ? 1 : -1;
    let err = dx - dy;
    let safety = 200;
    while (safety-- > 0) {
      if (x === tx1 && y === ty1) return false;
      const v = gridGet(grid, x, y);
      // Water/rock (4) doesn't block line of sight — enemies can see over water
      if (v >= 1 && v !== 4 && !(x === tx0 && y === ty0)) return true;
      const prevX = x, prevY = y;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      // Diagonal step: walls (1) and trees (3) always block; towers (2) allow squeeze-through
      if (x !== prevX && y !== prevY) {
        const c1 = gridGet(grid, prevX, y);
        const c2 = gridGet(grid, x, prevY);
        const s1 = c1 === 1 || c1 === 3;
        const s2 = c2 === 1 || c2 === 3;
        if (s1 || s2 || (c1 >= 1 && c2 >= 1)) return true;
      }
    }
    return false;
  }

  /** Check if a world position is adjacent to a wall, tower, tree, or water tile */
  isAdjacentToObstacle(wx: number, wy: number): boolean {
    const grid = this.scene.grid;
    const t = CFG.tile;
    const gx = Math.floor(wx / t), gy = Math.floor(wy / t);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const v = gridGet(grid, gx + dx, gy + dy);
        if (v === 1 || v === 2 || v === 3 || v === 4) return true; // wall, tower, tree, water
      }
    }
    return false;
  }

  syncWallTile(tx: number, ty: number, blocked: boolean) {
    const scene = this.scene;
    const mapOffset = (scene.wallTilemap.width / 2);
    const mx = tx + mapOffset, my = ty + mapOffset;
    if (mx >= 0 && mx < scene.wallTilemap.width && my >= 0 && my < scene.wallTilemap.height) {
      scene.wallLayer.putTileAt(blocked ? 1 : -1, mx, my);
    }
  }

  /**
   * Place invisible physics rectangles at diagonal gaps between walls and
   * towers so the player can't squeeze through. Rebuilds from scratch each
   * call.
   */
  rebuildGapBlockers() {
    const scene = this.scene;
    if (!scene.gapBlockers) return;
    scene.gapBlockers.clear(true, true);
    const t = CFG.tile;
    const checked = new Set<string>();

    // Scan all blocked tiles and check their corners
    for (const [key] of scene.grid) {
      const [kx, ky] = key.split(',').map(Number);
      // Check all 4 corners of this tile
      for (const [cx, cy] of [[kx, ky], [kx+1, ky], [kx, ky+1], [kx+1, ky+1]]) {
        const ckey = `${cx},${cy}`;
        if (checked.has(ckey)) continue;
        checked.add(ckey);

        // 4 tiles around this corner
        const tl = gridGet(scene.grid, cx - 1, cy - 1);
        const tr = gridGet(scene.grid, cx,     cy - 1);
        const bl = gridGet(scene.grid, cx - 1, cy);
        const br = gridGet(scene.grid, cx,     cy);

        // Only block corners where a wall/tree (solid) meets a tower (2) diagonally.
        // Wall-to-wall corners don't need blockers (both are full-tile rectangles).
        // Tower-to-tower corners are intentional gaps (gameplay feature).
        const isSolid = (v: number) => v === 1 || v === 3 || v === 4; // wall, tree, or water/rock
        const tlbrNeedBlock = (isSolid(tr) && bl === 2) || (tr === 2 && isSolid(bl));
        const trblNeedBlock = (isSolid(tl) && br === 2) || (tl === 2 && isSolid(br));

        if (!tlbrNeedBlock && !trblNeedBlock) continue;

        // Place a small square blocker at this corner
        const wx = cx * t, wy = cy * t;
        const size = 18; // big enough to block the player's radius-14 circle
        const blocker = scene.add.zone(wx, wy, size, size);
        scene.physics.add.existing(blocker, true);
        (blocker.body as Phaser.Physics.Arcade.StaticBody).setSize(size, size);
        (blocker.body as Phaser.Physics.Arcade.StaticBody).position.set(wx - size/2, wy - size/2);
        scene.gapBlockers!.add(blocker);
      }
    }
  }
}
