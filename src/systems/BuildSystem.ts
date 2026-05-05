import Phaser from 'phaser';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { CFG } from '../config';
import { Tower, TowerKind } from '../entities/Tower';
import { Wall } from '../entities/Wall';
import { SFX } from '../audio/sfx';
import { gridGet, gridSet } from './Pathfinding';
import type { GameScene, BuildKind } from '../scenes/GameScene';

/**
 * Build-mode state machine: choose tower / cannon / mage / wall, position
 * the ghost cursor, validate placement (gold, pathing, screen bounds), and
 * commit on tap/click. Owns the grid overlay redraw cache so canvas resizes
 * during build mode invalidate it correctly.
 */
export class BuildSystem {
  /** Last build-error string emitted — skip the per-frame event re-emit
   *  when the message didn't change so UIScene doesn't churn its toast. */
  private lastBuildErr = '';

  // Last camera scroll tile + zoom we drew the grid overlay against —
  // skip the redraw entirely when nothing relevant changed (which is
  // most frames while the player is standing or barely drifting).
  private lastGridOverlayLeft = NaN;
  private lastGridOverlayTop = NaN;
  private lastGridOverlayZoom = NaN;
  private lastGridOverlayCols = NaN;
  private lastGridOverlayRows = NaN;

  // Cached "how many spawn directions can reach the player from where they
  // stand right now?" — same answer for every uncached hovered tile, so we
  // pay the BFS once per player-tile/grid-version change instead of per-cell.
  private _beforeReach = -1;
  private _beforeReachKey = '';

  constructor(private scene: GameScene) {}

  toggleBuild(k: BuildKind, towerKind?: TowerKind) {
    const scene = this.scene;
    // If same build mode is already active, cancel it (toggle off)
    if (k === 'wall' && scene.buildState.kind === 'wall') {
      this.setBuild('none');
      return;
    }
    if (k === 'tower' && scene.buildState.kind === 'tower' && towerKind === scene.buildState.towerKind) {
      this.setBuild('none');
      return;
    }
    this.setBuild(k, towerKind);
  }

  setBuild(k: BuildKind, towerKind?: TowerKind) {
    const scene = this.scene;
    scene.buildState.setKind(k, towerKind);
    scene.ghost.setVisible(k !== 'none');
    if (scene.deleteIcon) scene.deleteIcon.setVisible(false);
    if (scene.gridOverlay) scene.gridOverlay.setVisible(k !== 'none');
    getEvents(scene.game.events).emit('build-mode', k !== 'none', k, towerKind);
    if (k === 'none') {
      getEvents(scene.game.events).emit('build-error', '');
      this.lastBuildErr = '';
    }
    if (k === 'tower') {
      scene.ghost.setTexture(scene.buildState.towerKind === 'cannon' ? 'c_base' : 't_base');
      const baseTint = Tower.TIER_TINT[scene.buildState.towerKind][0];
      scene.ghost.setTint(baseTint);
    }
    if (k === 'wall') {
      scene.ghost.setTexture('wall');
      scene.ghost.clearTint();
    }
    if (k !== 'none') scene.towerSelect.deselectTower();

    // Pause/unpause game world for build mode
    if (k !== 'none' && !scene.buildState.paused) {
      scene.buildState.paused = true;
      scene.physics.pause();
      scene.tweens.pauseAll();
      scene.anims.pauseAll();
    } else if (k === 'none' && scene.buildState.paused) {
      scene.buildState.paused = false;
      scene.physics.resume();
      scene.tweens.resumeAll();
      scene.anims.resumeAll();
    }

    scene.hud.pushHud();
  }

  /**
   * Check if a 2x2 block with top-left at (tx,ty) is all free, not under
   * player, and wouldn't block enemy pathing from all 4 edges to the player.
   */
  canPlaceTower(tx: number, ty: number): boolean {
    const scene = this.scene;
    const s = CFG.tower.tiles;
    const pt = scene.pathing.worldToTile(scene.player.x, scene.player.y);
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        if (gridGet(scene.grid, tx + i, ty + j) !== 0) return false;
      }
    }
    // Temporarily block tiles and check spawn directions can still reach the
    // player. PathingSystem.countReachableDirections runs a single BFS flood
    // from the player; the legacy canReachFromSpawnDirections did up to ~200
    // separate BFS calls per check and stalled the ghost cursor near towers.
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) gridSet(scene.grid, tx + i, ty + j, 2);
    const ok = scene.pathing.countReachableDirections(pt.x, pt.y) >= 2;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) gridSet(scene.grid, tx + i, ty + j, 0);
    return ok;
  }

  handleClick(p: Phaser.Input.Pointer) {
    const scene = this.scene;
    if (scene.endState.gameOver) return;

    // Right-click cancels build mode
    if (p.rightButtonDown() && scene.buildState.kind !== 'none') {
      this.setBuild('none');
      return;
    }

    // Ignore taps that land inside the mobile joystick's hit zone — otherwise
    // dragging the stick during build mode would also place a tower beneath
    // the thumb. Bounds are published by UIScene in screen-space pixels.
    const jb = getRegistry(scene.game).get('joystickBounds') as
      | { x: number; y: number; w: number; h: number }
      | undefined;
    if (jb && p.x >= jb.x && p.x <= jb.x + jb.w && p.y >= jb.y && p.y <= jb.y + jb.h) {
      return;
    }

    const wx = p.worldX, wy = p.worldY;

    // panel takes priority — clicks inside it are handled by button hit areas
    if (scene.selectedTower && scene.towerSelect.pointInPanel(wx, wy)) return;

    const tx = Math.floor(wx / CFG.tile);
    const ty = Math.floor(wy / CFG.tile);

    // sell with X held + click
    if (scene.keys.X.isDown) {
      if (getRegistry(scene.game).get('tutorialActive')) return; // no selling during tutorial
      scene.sell.sellAt(tx, ty);
      return;
    }

    // click an existing tower with no active build = select it
    if (scene.buildState.kind === 'none') {
      const hit = scene.towers.find(t =>
        tx >= t.tileX && tx < t.tileX + t.size &&
        ty >= t.tileY && ty < t.tileY + t.size);
      if (hit) {
        scene.towerSelect.selectTower(hit);
        return;
      }
      // No tower under cursor — if it's a wall, start the sell countdown
      // (click it again to cancel). Towers still need the upgrade panel
      // for sell, so we don't auto-sell them on click.
      if (!getRegistry(scene.game).get('tutorialActive')) {
        const wHit = scene.walls.find(w => w.tileX === tx && w.tileY === ty);
        if (wHit) {
          scene.sell.startSellTimer(wHit);
          return;
        }
      }
      scene.towerSelect.deselectTower();
      return;
    }

    // entering build mode cancels selection
    scene.towerSelect.deselectTower();

    if (scene.buildState.kind === 'tower') {
      // Tutorial caps placements at 1 tower; ignore further click-to-place
      // even if the player somehow stays in tower build mode.
      if (getRegistry(scene.game).get('tutorialActive') && scene.towers.length >= 1) return;
      const s = CFG.tower.tiles;
      // For even-size footprints, snap to the nearest grid intersection
      // so the tower centers under the cursor. For odd, snap to tile center.
      const ox = s % 2 === 0
        ? Math.round(wx / CFG.tile) - s / 2
        : Math.floor(wx / CFG.tile) - Math.floor(s / 2);
      const oy = s % 2 === 0
        ? Math.round(wy / CFG.tile) - s / 2
        : Math.floor(wy / CFG.tile) - Math.floor(s / 2);
      if (!this.canPlaceTower(ox, oy)) return;
      const kindCost = CFG.tower.kinds[scene.buildState.towerKind].cost;
      if (scene.player.money < kindCost) return;
      scene.player.money -= kindCost;
      scene.runStats.coinsSpent += kindCost;
      scene.runStats.towersBuilt++;
      const t = new Tower(scene, ox, oy, scene.buildState.towerKind);
      scene.towers.push(t);
      scene.towerGroup.add(t);
      scene.depthSort.applyTowerDepth(t); // static — set once, skipped in updateDepthSort
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) gridSet(scene.grid, ox + i, oy + j, 2);
      scene.gridVersion++; scene._wallCheckCache.clear(); scene.pathing.rebuildGapBlockers(); scene.pathing.rebuildGapBlockers();
      scene.hud.pushHud();
      SFX.play('towerPlace');
      if (getRegistry(scene.game).get('tutorialActive')) getEvents(scene.game.events).emit('tutorial-tower-placed');
      this.setBuild('none');
      return;
    }

    // wall
    // Click on an existing wall while in wall build mode = start the
    // sell countdown instead of trying (and failing) to place. Skip
    // during tutorial since we don't allow selling there.
    if (!getRegistry(scene.game).get('tutorialActive')) {
      const wHit = scene.walls.find(w => w.tileX === tx && w.tileY === ty);
      if (wHit) {
        scene.sell.startSellTimer(wHit);
        return;
      }
    }
    // Tutorial caps placements at 3 walls.
    if (getRegistry(scene.game).get('tutorialActive') && scene.walls.length >= 3) return;
    if (gridGet(scene.grid, tx, ty) !== 0) return;
    if (scene.player.money < CFG.wall.cost) return;
    const pt = scene.pathing.worldToTile(scene.player.x, scene.player.y);
    // Check placing this wall won't reduce reachable spawn directions below minimum
    const beforeReach = scene.pathing.countReachableDirections(pt.x, pt.y);
    gridSet(scene.grid, tx, ty, 1);
    const afterReach = scene.pathing.countReachableDirections(pt.x, pt.y);
    gridSet(scene.grid, tx, ty, 0);
    if (afterReach < Math.min(beforeReach, 2)) return;
    scene.player.money -= CFG.wall.cost;
    scene.runStats.coinsSpent += CFG.wall.cost;
    scene.runStats.wallsBuilt++;
    const w = new Wall(scene, tx, ty);
    scene.walls.push(w);
    scene.wallGroup.add(w);
    gridSet(scene.grid, tx, ty, 1);
    scene.pathing.syncWallTile(tx, ty, true);
    scene.sell.updateWallNeighbors(tx, ty);
    scene.gridVersion++; scene._wallCheckCache.clear(); scene.pathing.rebuildGapBlockers();
    scene.hud.pushHud();
    SFX.play('wallPlace');
    if (getRegistry(scene.game).get('tutorialActive')) getEvents(scene.game.events).emit('tutorial-wall-placed');
  }

  /**
   * Per-frame ghost cursor render + placement validity check while in build
   * mode. Emits `build-error` toasts via the dedupe field so UIScene only
   * sees a re-emit when the message changes.
   */
  updateGhost() {
    const scene = this.scene;
    if (scene.buildState.kind === 'none') return;
    const p = scene.input.activePointer;
    // Don't snap the ghost onto the joystick when the player's thumb is on
    // the stick — keep it at its last position until they tap elsewhere.
    const jb = getRegistry(scene.game).get('joystickBounds') as
      | { x: number; y: number; w: number; h: number }
      | undefined;
    const overJoystick = !!jb && p.x >= jb.x && p.x <= jb.x + jb.w && p.y >= jb.y && p.y <= jb.y + jb.h;
    if (overJoystick) return;
    const tx = Math.floor(p.worldX / CFG.tile);
    const ty = Math.floor(p.worldY / CFG.tile);
    let buildErr = '';
    if (scene.buildState.kind === 'tower') {
      const s = CFG.tower.tiles;
      const ox = s % 2 === 0
        ? Math.round(p.worldX / CFG.tile) - s / 2
        : Math.floor(p.worldX / CFG.tile) - Math.floor(s / 2);
      const oy = s % 2 === 0
        ? Math.round(p.worldY / CFG.tile) - s / 2
        : Math.floor(p.worldY / CFG.tile) - Math.floor(s / 2);
      scene.ghost.setPosition((ox + s / 2) * CFG.tile, (oy + s / 2) * CFG.tile);
      const towerCost = CFG.tower.kinds[scene.buildState.towerKind].cost;
      const canAffordTower = scene.player.money >= towerCost;
      const canPlace = this.canPlaceTower(ox, oy);
      if (!canAffordTower) buildErr = 'Not enough gold';
      else if (!canPlace) buildErr = 'Blocked';
      scene.ghost.setTint(canPlace && canAffordTower ? 0x88ff88 : 0xff8888);
    } else {
      scene.ghost.setPosition(tx * CFG.tile + CFG.tile / 2, ty * CFG.tile + CFG.tile / 2);
      // Hovering an existing wall? Show a red X — clicking will start
      // the sell countdown to tear it down. Skip the BFS pathing check
      // entirely (way cheaper, and there's nothing to validate). Mobile
      // has no real hover (the pointer stays parked on the last touch),
      // so suppress the red X there — it would spuriously appear over
      // the just-placed wall every time the player taps to build. Tap-
      // to-sell still works through the regular pointer-down handler.
      const wallHere = !getRegistry(scene.game).get('tutorialActive')
        && !getRegistry(scene.game).get('isMobile')
        && scene.walls.find(w => w.tileX === tx && w.tileY === ty);
      if (wallHere) {
        scene.ghost.setVisible(false);
        // If the wall already has a pending sell timer the marker is
        // drawn over the wall itself — skip the hover hint to avoid a
        // doubled-up X.
        if (scene.sellTimers.has(wallHere)) {
          scene.deleteIcon.setVisible(false);
        } else {
          scene.deleteIcon.setPosition(tx * CFG.tile + CFG.tile / 2, ty * CFG.tile + CFG.tile / 2)
            .setVisible(true);
        }
      } else {
        scene.ghost.setVisible(true);
        scene.deleteIcon.setVisible(false);

        // Invalidate cache when player moves to a new tile
        const ptKey = `${Math.floor(scene.player.x / CFG.tile)},${Math.floor(scene.player.y / CFG.tile)}`;
        if (ptKey !== scene._lastWallCheckPlayerTile) {
          scene._lastWallCheckPlayerTile = ptKey;
          scene._wallCheckCache.clear();
        }
        let valid = gridGet(scene.grid, tx, ty) === 0;
        let tileBlocked = !valid;
        if (valid) {
          // Per-tile cache — cleared on player move and on any grid
          // change. Sweeping the cursor over already-hovered tiles is
          // free; only first-hovered tiles pay for BFS.
          const cacheKey = `${tx},${ty}`;
          const cached = scene._wallCheckCache.get(cacheKey);
          if (cached !== undefined) {
            valid = cached;
          } else {
            const pt = scene.pathing.worldToTile(scene.player.x, scene.player.y);
            // beforeReach is identical for every uncached cell at the same
            // player-tile + gridVersion — only afterReach varies per cell.
            const beforeKey = `${ptKey}|${scene.gridVersion}`;
            if (this._beforeReachKey !== beforeKey) {
              this._beforeReachKey = beforeKey;
              this._beforeReach = scene.pathing.countReachableDirections(pt.x, pt.y);
            }
            const beforeReach = this._beforeReach;
            gridSet(scene.grid, tx, ty, 1);
            const afterReach = scene.pathing.countReachableDirections(pt.x, pt.y);
            gridSet(scene.grid, tx, ty, 0);
            valid = afterReach >= Math.min(beforeReach, 2);
            scene._wallCheckCache.set(cacheKey, valid);
          }
        }
        const canAffordWall = scene.player.money >= CFG.wall.cost;
        // Suppress the "Blocked" / "Blocks path" toasts on mobile when
        // building walls — the pointer parks on the last touch position,
        // so these would spuriously fire over the just-placed tile every
        // frame. The red ghost tint already conveys "can't place here".
        // The "Not enough gold" toast still shows since it isn't tied to
        // cursor location.
        const suppressPlacementToast = !!getRegistry(scene.game).get('isMobile');
        if (!canAffordWall) buildErr = 'Not enough gold';
        else if (tileBlocked && !suppressPlacementToast) buildErr = 'Blocked';
        else if (!valid && !suppressPlacementToast) buildErr = 'Blocks path';
        scene.ghost.setTint(valid && canAffordWall ? 0x88ff88 : 0xff8888);
      }
    }
    if (buildErr !== this.lastBuildErr) {
      this.lastBuildErr = buildErr;
      getEvents(scene.game.events).emit('build-error', buildErr);
    }
  }

  redrawGridOverlay() {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const tile = CFG.tile;
    // cam.worldView is Phaser's authoritative visible-world rectangle —
    // it accounts for zoom and origin correctly. cam.scrollX/scrollY are
    // pixel-space scroll offsets, NOT the visible-world left/top, so using
    // them here would (and did) draw the grid offset and at the wrong size
    // when zoom != 1.
    const view = cam.worldView;
    const left = Math.floor(view.x / tile) - 1;
    const top = Math.floor(view.y / tile) - 1;
    const cols = Math.ceil(view.width / tile) + 2;
    const rows = Math.ceil(view.height / tile) + 2;
    if (left === this.lastGridOverlayLeft &&
        top === this.lastGridOverlayTop &&
        cam.zoom === this.lastGridOverlayZoom &&
        cols === this.lastGridOverlayCols &&
        rows === this.lastGridOverlayRows) {
      return;
    }
    this.lastGridOverlayLeft = left;
    this.lastGridOverlayTop = top;
    this.lastGridOverlayZoom = cam.zoom;
    this.lastGridOverlayCols = cols;
    this.lastGridOverlayRows = rows;
    const right = left + cols;
    const bottom = top + rows;
    const g = scene.gridOverlay;
    g.clear();
    g.lineStyle(1, 0xffffff, 0.18);
    for (let x = left; x <= right; x++) {
      g.lineBetween(x * tile, top * tile, x * tile, bottom * tile);
    }
    for (let y = top; y <= bottom; y++) {
      g.lineBetween(left * tile, y * tile, right * tile, y * tile);
    }
  }
}
