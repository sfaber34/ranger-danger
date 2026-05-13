import Phaser from 'phaser';
import { CFG } from '../config';
import { Enemy, EnemyKind } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Wall } from '../entities/Wall';
import { Tower } from '../entities/Tower';
import { findPath, gridGet, gridSet } from './Pathfinding';
import type { GameScene } from '../scenes/GameScene';

/**
 * Combined enemy + boss AI / abilities / projectile lifecycle. EnemySystem
 * (basic enemies, mosquito darts, toad globs, web slow) and BossSystem
 * (boss AI, abilities, charge / slam / boulder, castle queen+dragon
 * projectiles, gas clouds, bird poop) were planned as two systems but share
 * so much surface area that a single class keeps the call graph readable.
 */
export class EnemyBossSystem {
  constructor(private scene: GameScene) {}

  updateWebs(time: number) {
    const scene = this.scene;
    // Expire old webs
    for (let i = scene.webs.length - 1; i >= 0; i--) {
      const w = scene.webs[i];
      if (time >= w.expireAt) {
        scene.tweens.add({
          targets: w.sprite, alpha: 0, duration: 300,
          onComplete: () => w.sprite.destroy()
        });
        scene.webs.splice(i, 1);
      }
    }
    // Slow enemies standing on webs
    if (scene.webs.length > 0) {
      const slowFactor = CFG.forest.spiderWebSlowFactor;
      for (const e of scene.enemies.getChildren() as Enemy[]) {
        if (!e.active || e.dying) continue;
        let onWeb = false;
        for (const w of scene.webs) {
          const dx = e.x - w.x, dy = e.y - w.y;
          if (dx * dx + dy * dy < 24 * 24) { onWeb = true; break; }
        }
        if (onWeb) {
          const body = e.body as Phaser.Physics.Arcade.Body;
          body.velocity.x *= slowFactor;
          body.velocity.y *= slowFactor;
        }
      }
    }
  }

  /** True when an enemy's center sits inside the visible world rect with a
   *  small inset — enemies don't get to snipe the player while off-screen. */
  private enemyOnScreen(e: Enemy): boolean {
    const wv = this.scene.cameras.main.worldView;
    const inset = 20;
    return e.x > wv.x + inset && e.x < wv.right - inset
        && e.y > wv.y + inset && e.y < wv.bottom - inset;
  }

  updateEnemies(time: number, _delta: number) {
    const scene = this.scene;
    const respawnR = scene.spawnDist * CFG.tile;
    // Cull/teleport thresholds must stay outside the spawn ring — spawnDist
    // grows with viewport diagonal, so a hardcoded radius can fall inside
    // the spawn ring on large screens and leave freshly-spawned enemies
    // permanently frozen until the player walks toward them.
    const FAR_AI_CULL_SQ = (respawnR + 200) ** 2;
    const TELEPORT_DIST_SQ = (respawnR + 600) ** 2;

    // Count alive enemies once so we can detect "stragglers phase" and
    // bypass perf cull / unwedge stuck movers. With a handful left and
    // no new spawns drawing the player around, a frozen straggler stalls
    // the wave indefinitely.
    let liveCount = 0;
    scene.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (e && e.active && !e.dying) liveCount++;
      return true;
    });
    const stragglersPhase = liveCount > 0 && liveCount <= 3;
    const STUCK_TELEPORT_MS = 3000;
    const MOVING_SPEED_THRESH = 5;

    scene.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (!e || !e.active || e.dying) return true;

      const tx = scene.player.x, ty = scene.player.y;
      e.targetRef = scene.player;
      const prefix = e.dirPrefix();
      const dist2 = (tx - e.x) ** 2 + (ty - e.y) ** 2;

      // Initialize / refresh "last actually moving" timestamp. Done before
      // any early-return so newly-spawned enemies don't read as "stuck for
      // the entire vTime so far" on their first iteration.
      if (e.lastMovingAt === 0) e.lastMovingAt = time;
      const body = e.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        const speedNow = Math.hypot(body.velocity.x, body.velocity.y);
        if (speedNow > MOVING_SPEED_THRESH) e.lastMovingAt = time;
      }

      if (dist2 > TELEPORT_DIST_SQ) {
        const dx = e.x - tx, dy = e.y - ty;
        const inv = 1 / Math.sqrt(dx * dx + dy * dy);
        e.setPosition(tx + dx * inv * respawnR, ty + dy * inv * respawnR);
        if (e.body && (e.body as any).enable) e.setVelocity(0, 0);
        e.path = [];
        e.pathIdx = 0;
        e.lastMovingAt = time;
        return true;
      }

      // Skip the perf cull during stragglers phase so the last few
      // enemies always run AI and head for the player.
      if (dist2 > FAR_AI_CULL_SQ && !stragglersPhase) {
        if (e.body && (e.body as any).enable) e.setVelocity(0, 0);
        return true;
      }

      // Stragglers wedged behind terrain (path keeps returning empty) or
      // pinned by the cull edge case: teleport to the spawn ring along
      // their current bearing so the wave can resolve. Skip kinds that
      // intentionally stand still (toad between hops, warlock standoff,
      // any flying kind that can't get terrain-wedged).
      const skipsStuckCheck = e.kind === 'toad' || e.kind === 'warlock' || e.flying;
      if (stragglersPhase && !skipsStuckCheck && time - e.lastMovingAt > STUCK_TELEPORT_MS) {
        const dx = e.x - tx, dy = e.y - ty;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        e.setPosition(tx + (dx / d) * respawnR, ty + (dy / d) * respawnR);
        if (e.body && (e.body as any).enable) e.setVelocity(0, 0);
        e.path = [];
        e.pathIdx = 0;
        e.lastMovingAt = time;
        return true;
      }

      if ((e.kind === 'crow' || e.kind === 'bat') && Math.random() < 0.0006 && this.enemyOnScreen(e)) {
        this.spawnBirdPoop(e.x, e.y);
      }

      if (e.kind === 'mosquito') {
        const mqRange = CFG.river.mosquitoRange;
        const meleeRange = 30;
        const dist = Math.sqrt(dist2);
        e.setFlipX(tx - e.x < 0);

        if (dist < meleeRange) {
          e.setVelocity(0, 0);
          if (e.anims.currentAnim?.key !== `${prefix}-atk`) e.play(`${prefix}-atk`);
          if (time > e.attackCd) {
            e.attackCd = time + 700;
            scene.player.hurt(e.dmg, scene);
            scene.hud.pushHud();
            if (scene.player.hp <= 0) scene.end.lose();
          }
          return true;
        }

        const hasLOS = scene.pathing.hasLineOfSight(e.x, e.y, tx, ty);

        if (dist < mqRange && hasLOS) {
          const perpX = -(ty - e.y), perpY = tx - e.x;
          const pLen = Math.hypot(perpX, perpY) || 1;
          e.setVelocity((perpX / pLen) * e.speed * 0.3, (perpY / pLen) * e.speed * 0.3);
          if (e.anims.currentAnim?.key !== `${prefix}-atk`) e.play(`${prefix}-atk`);
          if (time > e.attackCd && this.enemyOnScreen(e)) {
            e.attackCd = time + CFG.river.mosquitoFireRate;
            this.spawnMosquitoDart(e.x, e.y, tx, ty);
          }
          return true;
        }

        const dx = tx - e.x, dy = ty - e.y;
        const d = dist || 1;
        const rushSpeed = hasLOS ? e.speed : e.speed * 1.5;
        e.setVelocity((dx / d) * rushSpeed, (dy / d) * rushSpeed);
        if (e.anims.currentAnim?.key !== `${prefix}-move`) e.play(`${prefix}-move`);
        return true;
      }

      if (e.kind === 'toad') {
        const toadRange = CFG.infected.toadRange;
        const dist = Math.sqrt(dist2);
        e.setFlipX(tx - e.x < 0);

        const td = e as any;
        if (td._toadHopNext === undefined) {
          td._toadHopNext = time + CFG.infected.toadHopInterval;
          td._toadHopping = false;
          td._toadHopEnd = 0;
        }

        if (dist < toadRange && dist > 40 && time > e.attackCd && !td._toadHopping && this.enemyOnScreen(e)) {
          e.attackCd = time + CFG.infected.toadFireRate;
          e.play('etd-atk');
          scene.time.delayedCall(200 / scene.timeMult, () => {
            if (e.active && !e.dying) this.spawnToadGlob(e.x, e.y, tx, ty);
          });
        }

        // Let the attack animation finish before the hop/idle logic stomps it.
        if (e.anims.currentAnim?.key === 'etd-atk' && e.anims.isPlaying) {
          e.setVelocity(0, 0);
          return true;
        }

        if (td._toadHopping) {
          if (time > td._toadHopEnd) {
            td._toadHopping = false;
            e.setVelocity(0, 0);
            if (e.anims.currentAnim?.key !== 'etd-idle') e.play('etd-idle');
            td._toadHopNext = time + CFG.infected.toadHopInterval;
          }
          return true;
        }

        if (time > td._toadHopNext) {
          let hopX = tx, hopY = ty;
          if (scene.pathing.lineBlocked(e.x, e.y, tx, ty)) {
            const stale = time > e.lastPath + 400 || (e as any)._pv !== scene.gridVersion || !e.path || e.path.length === 0;
            if (stale && scene.pathsThisFrame < 3) {
              scene.pathsThisFrame++;
              e.lastPath = time;
              (e as any)._pv = scene.gridVersion;
              const start = scene.pathing.worldToTile(e.x, e.y);
              const goal = scene.pathing.worldToTile(tx, ty);
              const saved = gridGet(scene.grid, goal.x, goal.y);
              if (saved >= 1) gridSet(scene.grid, goal.x, goal.y, 0);
              e.path = findPath(scene.grid, start.x, start.y, goal.x, goal.y);
              if (saved >= 1) gridSet(scene.grid, goal.x, goal.y, saved);
            }
            if (e.path && e.path.length > 0) {
              const t = CFG.tile;
              while (e.path.length > 0) {
                const wp = e.path[0];
                const wx = wp.x * t + t / 2, wy = wp.y * t + t / 2;
                if (Math.hypot(wx - e.x, wy - e.y) < 14) e.path.shift();
                else { hopX = wx; hopY = wy; break; }
              }
            }
          } else {
            e.path = [];
          }
          const dxh = hopX - e.x, dyh = hopY - e.y;
          const dh = Math.hypot(dxh, dyh) || 1;
          td._toadHopping = true;
          td._toadHopEnd = time + CFG.infected.toadHopDuration;
          e.setVelocity((dxh / dh) * e.speed, (dyh / dh) * e.speed);
          e.play('etd-hop');
        } else {
          e.setVelocity(0, 0);
          if (e.anims.currentAnim?.key !== 'etd-idle') e.play('etd-idle');
        }
        return true;
      }

      if (e.kind === 'warlock') {
        const wlRange = CFG.castle.warlockRange;
        const dist = Math.sqrt(dist2);
        e.setFlipX(tx - e.x < 0);

        if (dist < 30) {
          e.setVelocity(0, 0);
          if (e.anims.currentAnim?.key !== `${prefix}-atk`) e.play(`${prefix}-atk`);
          if (time > e.attackCd) {
            e.attackCd = time + 800;
            scene.player.hurt(e.dmg, scene);
            scene.hud.pushHud();
            if (scene.player.hp <= 0) scene.end.lose();
          }
          return true;
        }

        if (dist < wlRange && scene.pathing.hasLineOfSight(e.x, e.y, tx, ty)) {
          e.setVelocity(0, 0);
          if (e.anims.currentAnim?.key !== `${prefix}-atk`) e.play(`${prefix}-atk`);
          if (time > e.attackCd && this.enemyOnScreen(e)) {
            e.attackCd = time + CFG.castle.warlockFireRate;
            this.spawnWarlockBolt(e.x, e.y, tx, ty);
          }
          return true;
        }

        const dx = tx - e.x, dy = ty - e.y;
        const d = dist || 1;
        e.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
        if (e.anims.currentAnim?.key !== `${prefix}-move`) e.play(`${prefix}-move`);
        return true;
      }

      if (dist2 < 30 * 30) {
        e.setVelocity(0, 0);
        if (e.rotates) {
          e.rotateToward(tx - e.x, ty - e.y);
        } else if (e.kind === 'bear') {
          const dirChanged = e.updateFacing(tx - e.x);
          const atkAnim = `${e.dirPrefix()}-atk`;
          if (dirChanged || e.anims.currentAnim?.key !== atkAnim) e.play(atkAnim);
        } else {
          e.setFlipX(tx - e.x < 0);
        }
        if (e.anims.currentAnim?.key !== `${prefix}-atk`) e.play(`${prefix}-atk`);
        if (time > e.attackCd) {
          e.attackCd = time + 800;
          scene.player.hurt(e.dmg, scene);
          scene.hud.pushHud();
          if (scene.player.hp <= 0) scene.end.lose();
        }
        return true;
      }

      const clear = e.flying || !scene.pathing.lineBlocked(e.x, e.y, tx, ty);
      if (clear) {
        const dx = tx - e.x, dy = ty - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
        if (e.rotates) {
          e.rotateToward(dx, dy);
        } else if (e.kind === 'bear') {
          const dirChanged = e.updateFacing(dx);
          const moveAnim = `${e.dirPrefix()}-move`;
          if (dirChanged || e.anims.currentAnim?.key !== moveAnim) e.play(moveAnim);
        } else {
          e.setFlipX(dx < 0);
        }
        if (e.anims.currentAnim?.key !== `${prefix}-move`) e.play(`${prefix}-move`);
        e.path = [];
        return true;
      }

      if (time > e.lastPath + 400 || (e as any)._pv !== scene.gridVersion || !e.path || e.path.length === 0) {
        if (scene.pathsThisFrame < 3) {
        scene.pathsThisFrame++;
        e.lastPath = time;
        (e as any)._pv = scene.gridVersion;
        const start = scene.pathing.worldToTile(e.x, e.y);
        const goal = scene.pathing.worldToTile(tx, ty);
        const saved = gridGet(scene.grid, goal.x, goal.y);
        if (saved >= 1) gridSet(scene.grid, goal.x, goal.y, 0);
        e.path = findPath(scene.grid, start.x, start.y, goal.x, goal.y);
        if (saved >= 1) gridSet(scene.grid, goal.x, goal.y, saved);

        if (e.path.length === 0) {
          for (let r = 1; r <= 6; r++) {
            let bestPath: { x: number; y: number }[] = [];
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const nx = goal.x + dx, ny = goal.y + dy;
                if (gridGet(scene.grid, nx, ny) >= 1) continue;
                const p = findPath(scene.grid, start.x, start.y, nx, ny);
                if (p.length > 0 && (bestPath.length === 0 || p.length < bestPath.length)) {
                  bestPath = p;
                }
              }
            }
            if (bestPath.length > 0) { e.path = bestPath; break; }
          }
        }

        e.pathIdx = 0;
        }
      }

      let moveX = 0, moveY = 0;
      if (e.path && e.path.length > 0) {
        if (e.pathIdx >= e.path.length) e.pathIdx = e.path.length - 1;
        let lookahead = e.pathIdx;
        for (let i = e.path.length - 1; i > e.pathIdx; i--) {
          const node = e.path[i];
          const nx = node.x * CFG.tile + CFG.tile / 2;
          const ny = node.y * CFG.tile + CFG.tile / 2;
          if (!scene.pathing.lineBlocked(e.x, e.y, nx, ny)) { lookahead = i; break; }
        }
        e.pathIdx = lookahead;
        const node = e.path[e.pathIdx];
        const nx = node.x * CFG.tile + CFG.tile / 2;
        const ny = node.y * CFG.tile + CFG.tile / 2;
        const dx = nx - e.x, dy = ny - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 4 && e.pathIdx < e.path.length - 1) e.pathIdx++;
        if (d > 0.01) { moveX = dx / d; moveY = dy / d; }
      } else {
        moveX = 0; moveY = 0;
      }

      const etx = Math.floor(e.x / CFG.tile), ety = Math.floor(e.y / CFG.tile);
      let avoidX = 0, avoidY = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const gx = etx + ox, gy = ety + oy;
          if (gridGet(scene.grid, gx, gy) < 1) continue;
          const wallCX = gx * CFG.tile + CFG.tile / 2;
          const wallCY = gy * CFG.tile + CFG.tile / 2;
          const rdx = e.x - wallCX, rdy = e.y - wallCY;
          const rd = Math.hypot(rdx, rdy) || 1;
          const strength = Math.max(0, 1 - rd / (CFG.tile * 1.2));
          avoidX += (rdx / rd) * strength;
          avoidY += (rdy / rd) * strength;
        }
      }
      const avoidMag = Math.hypot(avoidX, avoidY);
      if (avoidMag > 0) {
        const avoidWeight = 0.4;
        moveX = moveX * (1 - avoidWeight) + (avoidX / avoidMag) * avoidWeight;
        moveY = moveY * (1 - avoidWeight) + (avoidY / avoidMag) * avoidWeight;
        const ml = Math.hypot(moveX, moveY) || 1;
        moveX /= ml; moveY /= ml;
      }
      e.setVelocity(moveX * e.speed, moveY * e.speed);
      if (e.rotates) {
        e.rotateToward(moveX, moveY);
      } else if (e.kind === 'bear') {
        if (moveX !== 0) {
          const dirChanged = e.updateFacing(moveX);
          const moveAnim = `${e.dirPrefix()}-move`;
          if (dirChanged || e.anims.currentAnim?.key !== moveAnim) e.play(moveAnim);
        }
      } else {
        e.setFlipX(moveX < 0);
      }
      if (e.anims.currentAnim?.key !== `${prefix}-move`) e.play(`${prefix}-move`);
      return true;
    });
  }

  // ---------- BOSS ----------
  updateBoss(time: number) {
    const scene = this.scene;
    if (scene.bossState.boss) this._updateOneBoss(scene.bossState.boss, time);
    if (scene.difficulty === 'endless'
      && scene.bossState.midBoss
      && scene.bossState.midBoss !== scene.bossState.boss
      && scene.bossState.midBoss.active
      && !scene.bossState.midBoss.dying) {
      this._updateOneBoss(scene.bossState.midBoss, time);
    }
  }

  _updateOneBoss(b: Boss, time: number) {
    const scene = this.scene;
    if (!b || !b.active || b.dying) return;
    b.drawHpBar();

    const ap = b.animPrefix;
    if (b.state === 'slam_wind' && time >= b.stateEnd) {
      this.bossSlamImpact(b);
      b.state = 'chase';
      b.nextSlam = time + 4200;
      b.play(`${ap}-idle`);
    } else if (b.state === 'charge_wind' && time >= b.stateEnd) {
      const dx = scene.player.x - b.x, dy = scene.player.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.chargeDirX = dx / d; b.chargeDirY = dy / d;
      b.state = 'charging';
      b.stateEnd = time + 1000;
      b.setVelocity(b.chargeDirX * 320, b.chargeDirY * 320);
      b.play(`${ap}-move`);
      this.spawnChargeSmoke(b, 3);
      b.lastSmoke = time;
    } else if (b.state === 'charging' && time >= b.stateEnd) {
      b.setVelocity(0, 0);
      this.bossChargeImpact(b);
      b.state = 'chase';
      b.nextCharge = time + 9500;
      b.nextBirth = Math.max(b.nextBirth, time + 3000);
      b.play(`${ap}-idle`);
    }

    if (b.state === 'charging' && time > b.lastSmoke + 60) {
      b.lastSmoke = time;
      this.spawnChargeSmoke(b, 1);
    }

    if (b.state === 'charging') {
      if (b.contactCd < time &&
          Phaser.Math.Distance.Between(b.x, b.y, scene.player.x, scene.player.y) < 40) {
        const chargeDmg = Math.floor(CFG.player.hp * 0.55);
        scene.player.hurt(chargeDmg, scene);
        scene.hud.pushHud();
        b.contactCd = time + 600;
        if (scene.player.hp <= 0) scene.end.lose();
      }
      let chargeHit = false;
      for (const t of scene.towers) {
        if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < 50) { chargeHit = true; break; }
      }
      if (!chargeHit) {
        for (const w of scene.walls) {
          if (Phaser.Math.Distance.Between(b.x, b.y, w.x, w.y) < 40) { chargeHit = true; break; }
        }
      }
      if (chargeHit) {
        b.setVelocity(0, 0);
        this.bossChargeImpact(b);
        b.state = 'chase';
        b.nextCharge = time + 9500;
        b.nextBirth = Math.max(b.nextBirth, time + 3000);
        b.play(`${ap}-idle`);
      }
      const bt = CFG.tile;
      const bgx = Math.floor(b.x / bt);
      const bgy = Math.floor(b.y / bt);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (gridGet(scene.grid, bgx + dx, bgy + dy) === 3) {
            scene.chunkSystem.destroyTreeTile(bgx + dx, bgy + dy);
          }
        }
      }
    }

    if (b.state !== 'chase') return;

    const px = scene.player.x, py = scene.player.y;
    const distToPlayer = Math.hypot(px - b.x, py - b.y);

    const isCastleBoss = b.bossKind === 'queen' || b.bossKind === 'dragon';

    if (!isCastleBoss && time >= b.nextBirth && b.state === 'chase') {
      this.bossBirthSpawn(b);
      b.nextBirth = time + 3800;
    }
    const cam = scene.cameras.main;
    const onScreen = b.x >= cam.worldView.x && b.x <= cam.worldView.right
                  && b.y >= cam.worldView.y && b.y <= cam.worldView.bottom;

    if (b.bossKind === 'queen') {
      if (time >= scene.nextQueenTeleport && distToPlayer > 120) {
        const ang = Math.atan2(py - b.y, px - b.x);
        const teleportDist = Math.min(CFG.castle.queenTeleportRange, distToPlayer - 60);
        const nx = b.x + Math.cos(ang) * teleportDist;
        const ny = b.y + Math.sin(ang) * teleportDist;
        b.setAlpha(0.2);
        b.setPosition(nx, ny);
        scene.tweens.add({ targets: b, alpha: 1, duration: 300, ease: 'Cubic.Out' });
        for (const pos of [{ x: b.x - Math.cos(ang) * teleportDist, y: b.y - Math.sin(ang) * teleportDist }, { x: nx, y: ny }]) {
          for (let i = 0; i < 8; i++) {
            const pa = (i / 8) * Math.PI * 2;
            const p = scene.add.circle(pos.x, pos.y, 3, 0x9040e0, 0.8).setDepth(15);
            scene.tweens.add({ targets: p, x: pos.x + Math.cos(pa) * 30, y: pos.y + Math.sin(pa) * 30, alpha: 0, duration: 400, onComplete: () => p.destroy() });
          }
        }
        scene.nextQueenTeleport = time + CFG.castle.queenTeleportCooldown;
      }
      if (time >= scene.nextQueenOrb && onScreen) {
        const burstCount = CFG.castle.queenOrbBurstCount;
        const spread = 0.3;
        const baseAngle = Math.atan2(py - b.y, px - b.x);
        for (let i = 0; i < burstCount; i++) {
          const a = baseAngle + (i - (burstCount - 1) / 2) * spread;
          const orbTx = b.x + Math.cos(a) * 300;
          const orbTy = b.y + Math.sin(a) * 300;
          this.spawnQueenOrb(b.x, b.y, orbTx, orbTy);
        }
        scene.nextQueenOrb = time + CFG.castle.queenOrbFireRate;
      }
      if (time >= scene.nextQueenAura && onScreen) {
        this.queenAuraStrike(b.x, b.y);
        scene.nextQueenAura = time + CFG.castle.queenAuraCooldown;
      }
    }

    if (b.bossKind === 'dragon') {
      if (time >= scene.nextDragonFireball && onScreen) {
        this.spawnDragonFireball(b.x, b.y, px, py);
        scene.nextDragonFireball = time + CFG.castle.dragonFireballRate;
      }
      if (time >= b.nextBirth) {
        const spawnCount = 3;
        for (let i = 0; i < spawnCount; i++) {
          const sa = (i / spawnCount) * Math.PI * 2;
          const se = new Enemy(scene, b.x + Math.cos(sa) * 40, b.y + Math.sin(sa) * 40, 'skeleton');
          scene.spawn.applyEnemyDifficulty(se);
          se.noCoinDrop = true;
          scene.enemies.add(se);
        }
        b.nextBirth = time + 8000;
      }
    }

    if (!isCastleBoss && time >= b.nextCharge && distToPlayer > 40 && onScreen) {
      b.state = 'charge_wind';
      b.stateEnd = time + 1200;
      b.setVelocity(0, 0);
      b.play(`${ap}-chargewind`);
      return;
    }
    if (!isCastleBoss && scene.biome !== 'grasslands' && time >= b.nextBoulder && onScreen) {
      const boulderRange = 280;
      let bestDist = boulderRange;
      let target: { x: number; y: number } | null = null;
      for (const t of scene.towers) {
        const d = Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y);
        if (d < bestDist) { bestDist = d; target = { x: t.x, y: t.y }; }
      }
      for (const w of scene.walls) {
        const d = Phaser.Math.Distance.Between(b.x, b.y, w.x, w.y);
        if (d < bestDist) { bestDist = d; target = { x: w.x, y: w.y }; }
      }
      if (target) {
        this.bossThrowBoulder(b, target.x, target.y);
        b.nextBoulder = time + 3500;
      } else {
        b.nextBoulder = time + 1000;
      }
    }
    if (distToPlayer < 62 && time >= b.nextSlam) {
      b.state = 'slam_wind';
      b.stateEnd = time + 600;
      b.setVelocity(0, 0);
      b.play(`${ap}-atk`);
      return;
    }

    let moveX = 0, moveY = 0;
    const clear = scene.biome === 'river' || !scene.pathing.lineBlocked(b.x, b.y, px, py);
    if (clear) {
      const dx = px - b.x, dy = py - b.y;
      const d = Math.hypot(dx, dy) || 1;
      moveX = dx / d; moveY = dy / d;
      b.path = [];
    } else {
      if (time > b.lastPath + 400 || b._pv !== scene.gridVersion || !b.path || b.path.length === 0) {
        b.lastPath = time;
        b._pv = scene.gridVersion;
        const start = scene.pathing.worldToTile(b.x, b.y);
        const goal = scene.pathing.worldToTile(px, py);
        const saved = gridGet(scene.grid, goal.x, goal.y);
        if (saved >= 1) gridSet(scene.grid, goal.x, goal.y, 0);
        b.path = findPath(scene.grid, start.x, start.y, goal.x, goal.y);
        if (saved >= 1) gridSet(scene.grid, goal.x, goal.y, saved);

        if (b.path.length === 0) {
          for (let r = 1; r <= 6; r++) {
            let bestPath: { x: number; y: number }[] = [];
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const nx = goal.x + dx, ny = goal.y + dy;
                if (gridGet(scene.grid, nx, ny) >= 1) continue;
                const p = findPath(scene.grid, start.x, start.y, nx, ny);
                if (p.length > 0 && (bestPath.length === 0 || p.length < bestPath.length)) {
                  bestPath = p;
                }
              }
            }
            if (bestPath.length > 0) { b.path = bestPath; break; }
          }
        }

        b.pathIdx = 0;
      }

      if (b.path && b.path.length > 0) {
        if (b.pathIdx >= b.path.length) b.pathIdx = b.path.length - 1;
        let lookahead = b.pathIdx;
        for (let i = b.path.length - 1; i > b.pathIdx; i--) {
          const node = b.path[i];
          const nx = node.x * CFG.tile + CFG.tile / 2;
          const ny = node.y * CFG.tile + CFG.tile / 2;
          if (!scene.pathing.lineBlocked(b.x, b.y, nx, ny)) { lookahead = i; break; }
        }
        b.pathIdx = lookahead;
        const node = b.path[b.pathIdx];
        const nx = node.x * CFG.tile + CFG.tile / 2;
        const ny = node.y * CFG.tile + CFG.tile / 2;
        const dx = nx - b.x, dy = ny - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 4 && b.pathIdx < b.path.length - 1) b.pathIdx++;
        if (d > 0.01) { moveX = dx / d; moveY = dy / d; }
      } else {
        moveX = 0; moveY = 0;
      }
    }

    const btx = Math.floor(b.x / CFG.tile), bty = Math.floor(b.y / CFG.tile);
    let avoidX = 0, avoidY = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const gx = btx + ox, gy = bty + oy;
        if (gridGet(scene.grid, gx, gy) < 1) continue;
        const wallCX = gx * CFG.tile + CFG.tile / 2;
        const wallCY = gy * CFG.tile + CFG.tile / 2;
        const rdx = b.x - wallCX, rdy = b.y - wallCY;
        const rd = Math.hypot(rdx, rdy) || 1;
        const strength = Math.max(0, 1 - rd / (CFG.tile * 1.2));
        avoidX += (rdx / rd) * strength;
        avoidY += (rdy / rd) * strength;
      }
    }
    const avoidMag = Math.hypot(avoidX, avoidY);
    if (avoidMag > 0) {
      const avoidWeight = 0.35;
      moveX = moveX * (1 - avoidWeight) + (avoidX / avoidMag) * avoidWeight;
      moveY = moveY * (1 - avoidWeight) + (avoidY / avoidMag) * avoidWeight;
      const ml = Math.hypot(moveX, moveY) || 1;
      moveX /= ml; moveY /= ml;
    }
    b.setVelocity(moveX * b.speed, moveY * b.speed);
    b.setFlipX(moveX < 0);
    const moveAnim = `${b.animPrefix}-move`;
    if (b.anims.currentAnim?.key !== moveAnim) b.play(moveAnim);

    if (
      Phaser.Math.Distance.Between(b.x, b.y, scene.player.x, scene.player.y) < 36 &&
      time > b.contactCd
    ) {
      b.contactCd = time + 700;
      scene.player.hurt(b.dmg, scene);
      scene.hud.pushHud();
      if (scene.player.hp <= 0) scene.end.lose();
    }
  }

  queenAuraStrike(cx: number, cy: number) {
    const scene = this.scene;
    const r = CFG.castle.queenAuraRadius;
    const dmg = CFG.castle.queenAuraDmg;
    const windup = CFG.castle.queenAuraWindup;

    const ring = scene.add.circle(cx, cy, r, 0x9040e0, 0)
      .setStrokeStyle(3, 0x9040e0, 0.9)
      .setDepth(13).setScale(0.1);
    const fill = scene.add.circle(cx, cy, r, 0x9040e0, 0.18)
      .setDepth(12).setScale(0.1);
    scene.tweens.add({
      targets: [ring, fill],
      scale: 1,
      duration: windup,
      ease: 'Cubic.In',
    });

    scene.time.delayedCall(windup, () => {
      ring.destroy();
      fill.destroy();
      for (const t of [...scene.towers]) {
        if (Phaser.Math.Distance.Between(cx, cy, t.x, t.y) < r + 16) {
          t.hurt(dmg);
          if (t.hp <= 0) scene.sell.destroyTower(t);
        }
      }
      for (const w of [...scene.walls]) {
        if (Phaser.Math.Distance.Between(cx, cy, w.x, w.y) < r + 8) {
          w.hurt(dmg);
          if (w.hp <= 0) scene.sell.destroyWall(w);
        }
      }
      const burst = scene.add.circle(cx, cy, r, 0x9040e0, 0.45).setDepth(14);
      scene.tweens.add({ targets: burst, scale: 1.25, alpha: 0, duration: 350, ease: 'Cubic.Out', onComplete: () => burst.destroy() });
      const shock = scene.add.circle(cx, cy, r, 0x000000, 0)
        .setStrokeStyle(3, 0xc080ff, 0.9).setDepth(15);
      scene.tweens.add({ targets: shock, scale: 1.3, alpha: { from: 1, to: 0 }, duration: 400, onComplete: () => shock.destroy() });
    });
  }

  bossSlamImpact(b: Boss) {
    const scene = this.scene;
    const r = 56;
    if (Phaser.Math.Distance.Between(b.x, b.y, scene.player.x, scene.player.y) < r) {
      scene.player.hurt(30, scene);
      scene.hud.pushHud();
      if (scene.player.hp <= 0) scene.end.lose();
    }
    for (const t of [...scene.towers]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < r + 16) {
        t.hurt(35);
        if (t.hp <= 0) scene.sell.destroyTower(t);
      }
    }
    for (const w of [...scene.walls]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, w.x, w.y) < r + 8) {
        w.hurt(40);
        if (w.hp <= 0) scene.sell.destroyWall(w);
      }
    }

    const slamCore = scene.add.circle(b.x, b.y, r, 0xff4020, 0.5)
      .setDepth(14).setScale(0.15);
    scene.tweens.add({
      targets: slamCore,
      scale: 1,
      alpha: { from: 0.55, to: 0 },
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => slamCore.destroy()
    });

    const slamRing = scene.add.circle(b.x, b.y, r, 0x000000, 0)
      .setStrokeStyle(3, 0xff5030, 0.9)
      .setDepth(15).setScale(0.15);
    scene.tweens.add({
      targets: slamRing,
      scale: 1.08,
      alpha: { from: 1, to: 0 },
      duration: 380,
      ease: 'Sine.Out',
      onComplete: () => slamRing.destroy()
    });

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
      const dist = r * Phaser.Math.FloatBetween(0.6, 1.1);
      const col = [0xd94a2a, 0xff8a40, 0x8a4a2a, 0xffc060][i % 4];
      const sz = Phaser.Math.Between(2, 4);
      const chunk = scene.add.rectangle(b.x, b.y, sz, sz, col, 1).setDepth(16);
      scene.tweens.add({
        targets: chunk,
        x: b.x + Math.cos(a) * dist,
        y: b.y + Math.sin(a) * dist,
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(300, 500),
        ease: 'Cubic.Out',
        onComplete: () => chunk.destroy()
      });
    }

    const slamScorch = scene.add.circle(b.x, b.y, r * 0.6, 0x1a0808, 0.45)
      .setDepth(2);
    scene.tweens.add({
      targets: slamScorch,
      alpha: { from: 0.45, to: 0 },
      duration: 1000,
      ease: 'Sine.In',
      onComplete: () => slamScorch.destroy()
    });

    scene.cameras.main.shake(200, 0.01);
  }

  spawnChargeSmoke(b: Boss, puffs: number) {
    const scene = this.scene;
    const backDist = 26;
    const baseX = b.x - b.chargeDirX * backDist;
    const baseY = b.y - b.chargeDirY * backDist + 4;
    for (let i = 0; i < puffs; i++) {
      const jx = Phaser.Math.Between(-6, 6);
      const jy = Phaser.Math.Between(-4, 4);
      const r = Phaser.Math.Between(8, 12);
      const shade = scene.biome === 'infected'
        ? [0xd060a0, 0xe080c0, 0xc04890][i % 3]
        : [0x9a9aa8, 0xb8b8c4, 0x7e7e8a][i % 3];
      const puff = scene.add.circle(baseX + jx, baseY + jy, r, shade, 0.7)
        .setDepth(8)
        .setStrokeStyle(1, scene.biome === 'infected' ? 0x8a2060 : 0x5a5a66, 0.5);
      const driftX = -b.chargeDirX * 14 + Phaser.Math.Between(-6, 6);
      const driftY = -b.chargeDirY * 14 + Phaser.Math.Between(-14, -6);
      scene.tweens.add({
        targets: puff,
        x: puff.x + driftX,
        y: puff.y + driftY,
        scale: { from: 0.7, to: 1.6 },
        alpha: { from: 0.75, to: 0 },
        duration: 520,
        ease: 'Sine.Out',
        onComplete: () => puff.destroy()
      });
    }

    if (scene.biome === 'infected') {
      this.spawnGasCloud(baseX, baseY);
    }
  }

  spawnGasCloud(x: number, y: number) {
    const scene = this.scene;
    for (const gc of scene.gasClouds) {
      if (Phaser.Math.Distance.Between(x, y, gc.x, gc.y) < 20) return;
    }
    const sprites: Phaser.GameObjects.Arc[] = [];
    const count = Phaser.Math.Between(3, 4);
    for (let i = 0; i < count; i++) {
      const jx = Phaser.Math.Between(-10, 10);
      const jy = Phaser.Math.Between(-8, 8);
      const r = Phaser.Math.Between(12, 18);
      const shade = [0xd060a0, 0xe878b8, 0xc04888, 0xd06898][i % 4];
      const c = scene.add.circle(x + jx, y + jy, r, shade, 0.35).setDepth(7);
      sprites.push(c);
      scene.tweens.add({
        targets: c,
        x: c.x + Phaser.Math.Between(-6, 6),
        y: c.y + Phaser.Math.Between(-6, 6),
        scale: { from: 0.9, to: 1.15 },
        alpha: { from: 0.35, to: 0.2 },
        duration: Phaser.Math.Between(1500, 2500),
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1
      });
    }
    scene.gasClouds.push({ x, y, sprites, expireAt: Infinity, dmgCd: 0 });
  }

  updateGasClouds(time: number) {
    const scene = this.scene;
    for (let i = scene.gasClouds.length - 1; i >= 0; i--) {
      const gc = scene.gasClouds[i];
      if (time >= gc.expireAt) {
        for (const s of gc.sprites) {
          scene.tweens.add({
            targets: s, alpha: 0, duration: 500,
            onComplete: () => s.destroy()
          });
        }
        scene.gasClouds.splice(i, 1);
        continue;
      }
      if (time > gc.dmgCd) {
        const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, gc.x, gc.y);
        if (dist < 36) {
          const dmg = 3;
          scene.player.hurt(dmg, scene);
          scene.hud.pushHud();
          gc.dmgCd = time + 500;
          if (scene.player.hp <= 0) scene.end.lose();
        }
      }
    }
  }

  spawnBirdPoop(x: number, y: number) {
    const scene = this.scene;
    for (const bp of scene.birdPoops) {
      if (Phaser.Math.Distance.Between(x, y, bp.sprite.x, bp.sprite.y) < 24) return;
    }
    if (scene.birdPoops.length >= 30) return;
    const spr = scene.add.image(x, y + 12, 'bird_poop').setScale(0.5).setDepth(2).setAlpha(0);
    scene.tweens.add({
      targets: spr,
      alpha: 0.85,
      scaleX: 0.6,
      scaleY: 0.45,
      duration: 300,
      ease: 'Bounce.Out'
    });
    scene.birdPoops.push({
      sprite: spr,
      expireAt: scene.vTime + 12000,
      dmgCd: 0
    });
  }

  updateBirdPoops(time: number) {
    const scene = this.scene;
    for (let i = scene.birdPoops.length - 1; i >= 0; i--) {
      const bp = scene.birdPoops[i];
      if (time >= bp.expireAt) {
        scene.tweens.add({
          targets: bp.sprite, alpha: 0, duration: 800,
          onComplete: () => bp.sprite.destroy()
        });
        scene.birdPoops.splice(i, 1);
        continue;
      }
      if (bp.expireAt - time < 2000 && bp.sprite.alpha > 0.3) {
        bp.sprite.setAlpha(0.3 + 0.55 * ((bp.expireAt - time) / 2000));
      }
      if (time > bp.dmgCd) {
        const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, bp.sprite.x, bp.sprite.y);
        if (dist < 16) {
          scene.player.hurt(4, scene);
          scene.hud.pushHud();
          bp.dmgCd = time + 800;
          if (scene.player.hp <= 0) scene.end.lose();
        }
      }
    }
  }

  bossChargeImpact(b: Boss) {
    const scene = this.scene;
    const r = 80;
    if (Phaser.Math.Distance.Between(b.x, b.y, scene.player.x, scene.player.y) < r) {
      const chargeDmg = Math.floor(CFG.player.hp * 0.55);
      scene.player.hurt(chargeDmg, scene);
      scene.hud.pushHud();
      if (scene.player.hp <= 0) scene.end.lose();
    }
    for (const t of [...scene.towers]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < r) {
        scene.sell.destroyTower(t);
      }
    }
    for (const w of [...scene.walls]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, w.x, w.y) < r) {
        w.hurt(80);
        if (w.hp <= 0) scene.sell.destroyWall(w);
      }
    }
    const burst = scene.add.sprite(b.x, b.y, 'fx_death_0').setDepth(15).setScale(1.5);
    burst.play('fx-death');
    burst.once('animationcomplete', () => burst.destroy());

    const core = scene.add.circle(b.x, b.y, r, 0xff2020, 0.45)
      .setDepth(14).setScale(0.15);
    scene.tweens.add({
      targets: core,
      scale: 1,
      alpha: { from: 0.5, to: 0 },
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy()
    });

    const ring = scene.add.circle(b.x, b.y, r, 0x000000, 0)
      .setStrokeStyle(4, 0xff4040, 1)
      .setDepth(15).setScale(0.15);
    scene.tweens.add({
      targets: ring,
      scale: 1.05,
      alpha: { from: 1, to: 0 },
      duration: 400,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
    });

    const wave2 = scene.add.circle(b.x, b.y, r, 0x000000, 0)
      .setStrokeStyle(2, 0xff6a3a, 0.7)
      .setDepth(14).setScale(0.1);
    scene.tweens.add({
      targets: wave2,
      scale: 1.15,
      alpha: { from: 0.7, to: 0 },
      duration: 520,
      delay: 60,
      ease: 'Sine.Out',
      onComplete: () => wave2.destroy()
    });

    const scorch = scene.add.circle(b.x, b.y, r * 0.8, 0x1a0808, 0.5)
      .setDepth(2);
    scene.tweens.add({
      targets: scorch,
      alpha: { from: 0.5, to: 0 },
      duration: 1400,
      ease: 'Sine.In',
      onComplete: () => scorch.destroy()
    });

    scene.cameras.main.shake(360, 0.016);
  }

  bossBirthSpawn(b: Boss) {
    const scene = this.scene;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.5;
      const dist = 18;
      const ex = b.x + Math.cos(a) * dist;
      const ey = b.y + Math.sin(a) * dist - 6;
      const kind: EnemyKind = scene.biome === 'forest'
        ? (Math.random() < 0.4 ? 'spider' : 'wolf')
        : scene.biome === 'infected'
        ? (Math.random() < 0.4 ? 'infected_heavy' : 'infected_basic')
        : scene.biome === 'river'
        ? (Math.random() < 0.4 ? 'bat' : 'crow')
        : (Math.random() < 0.4 ? 'deer' : 'snake');
      const e = new Enemy(scene, ex, ey, kind);
      e.noCoinDrop = true;
      scene.spawn.applyEnemyDifficulty(e);
      scene.enemies.add(e);
      const body = e.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(a) * 120, Math.sin(a) * 120 - 40);
      const pop = scene.add.sprite(ex, ey, 'fx_pop_0').setDepth(15).setScale(0.5);
      pop.play('fx-pop');
      pop.once('animationcomplete', () => pop.destroy());
    }
  }

  bossThrowBoulder(b: Boss, tx: number, ty: number) {
    const scene = this.scene;
    const speed = 180;
    const dist = Math.hypot(tx - b.x, ty - b.y) || 1;
    const angle = Math.atan2(ty - b.y, tx - b.x);

    const sprite = scene.add.sprite(b.x, b.y, 'boulder_0').setDepth(14).setScale(0.6);
    sprite.play('boulder-spin');
    const shadowSprite = scene.add.sprite(b.x, b.y, 'boulder_shadow').setDepth(5).setScale(0.3).setAlpha(0.35);

    scene.boulders.push({
      sprite, shadow: shadowSprite,
      sx: b.x, sy: b.y, tx, ty,
      totalDist: dist, speed, dmg: 40, splashRadius: 48,
      born: scene.vTime
    });

    b.play(`${b.animPrefix}-atk`);
    scene.time.delayedCall(300, () => {
      if (b.active && !b.dying && b.state === 'chase')
        b.play(`${b.animPrefix}-move`);
    });
  }

  updateBoulders(time: number) {
    const scene = this.scene;
    for (let i = scene.boulders.length - 1; i >= 0; i--) {
      const bl = scene.boulders[i];
      if (!bl.sprite.active) { scene.boulders.splice(i, 1); continue; }

      const elapsed = time - bl.born;
      const travelTime = bl.totalDist / bl.speed;
      const t = Math.min(elapsed / (travelTime * 1000), 1);

      const cx = bl.sx + (bl.tx - bl.sx) * t;
      const cy = bl.sy + (bl.ty - bl.sy) * t;
      const arcHeight = Math.sin(t * Math.PI) * 30;

      bl.sprite.setPosition(cx, cy - arcHeight);
      bl.shadow.setPosition(cx, cy);
      bl.shadow.setScale(0.2 + Math.sin(t * Math.PI) * 0.3);
      bl.shadow.setAlpha(0.4 - Math.sin(t * Math.PI) * 0.2);

      if (t >= 1) {
        this.boulderImpact(bl.tx, bl.ty, bl.splashRadius, bl.dmg);
        bl.sprite.destroy();
        bl.shadow.destroy();
        scene.boulders.splice(i, 1);
      }
      else if (elapsed > 5000) {
        bl.sprite.destroy();
        bl.shadow.destroy();
        scene.boulders.splice(i, 1);
      }
    }
  }

  boulderImpact(x: number, y: number, radius: number, dmg: number) {
    const scene = this.scene;
    for (const t of [...scene.towers]) {
      if (Phaser.Math.Distance.Between(x, y, t.x, t.y) < radius + 16) {
        t.hp -= dmg;
        if (t.hp <= 0) scene.sell.destroyTower(t);
      }
    }
    for (const w of [...scene.walls]) {
      if (Phaser.Math.Distance.Between(x, y, w.x, w.y) < radius + 8) {
        w.hp -= dmg;
        if (w.hp <= 0) scene.sell.destroyWall(w);
      }
    }
    if (Phaser.Math.Distance.Between(x, y, scene.player.x, scene.player.y) < radius) {
      scene.player.hurt(15, scene);
      scene.hud.pushHud();
      if (scene.player.hp <= 0) scene.end.lose();
    }

    const fx = scene.add.sprite(x, y, 'fx_boulder_0').setDepth(500).setScale(1.5);
    fx.play('fx-boulder');
    fx.once('animationcomplete', () => fx.destroy());

    const scorch = scene.add.circle(x, y, radius * 0.4, 0x3a3028, 0.3).setDepth(1);
    scene.tweens.add({
      targets: scorch, alpha: 0, duration: 3000, onComplete: () => scorch.destroy()
    });

    scene.cameras.main.shake(180, 0.008);
  }

  enemyHitsPlayer(e: Enemy) {
    const scene = this.scene;
    if (!e.active || e.dying) return;
    if (scene.vTime > e.attackCd) {
      e.attackCd = scene.vTime + 700;
      scene.player.hurt(e.dmg, scene);
      scene.hud.pushHud();
      if (scene.player.hp <= 0) scene.end.lose();
    }
  }

  enemyHitsWall(_e: Enemy, _w: Wall) { /* enemies no longer attack structures */ }
  enemyHitsTower(_e: Enemy, _t: Tower) { /* enemies no longer attack structures */ }

  spawnMosquitoDart(x: number, y: number, tx: number, ty: number) {
    const scene = this.scene;
    const dart = scene.physics.add.sprite(x, y, 'mdart_0').setScale(0.7).setDepth(9);
    dart.play('mdart-spin');
    dart.setSize(12, 12).setOffset(2, 2);
    scene.enemyDarts.add(dart);
    const angle = Math.atan2(ty - y, tx - x);
    const spd = CFG.river.mosquitoDartSpeed;
    dart.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
    dart.setRotation(angle);
    (dart as any)._born = scene.vTime;
    (dart as any)._dmg = CFG.river.mosquitoDartDmg;
  }

  enemyDartHitsPlayer(dart: Phaser.Physics.Arcade.Sprite) {
    const scene = this.scene;
    if (!dart.active) return;
    const dmg = (dart as any)._dmg ?? CFG.river.mosquitoDartDmg;
    scene.player.hurt(dmg, scene);
    scene.hud.pushHud();
    if (scene.player.hp <= 0) scene.end.lose();
    dart.destroy();
  }

  updateEnemyDarts() {
    const scene = this.scene;
    scene.enemyDarts.children.iterate((c: any) => {
      if (!c || !c.active) return true;
      if (scene.vTime - c._born > CFG.river.mosquitoDartLifetime) { c.destroy(); return true; }
      return true;
    });
  }

  spawnToadGlob(x: number, y: number, tx: number, ty: number) {
    const scene = this.scene;
    const glob = scene.physics.add.sprite(x, y, 'tglob_0').setScale(0.8).setDepth(12);
    glob.play('tglob-spin');
    glob.setSize(10, 10).setOffset(3, 3);
    scene.toadGlobs.add(glob);

    const dx = tx - x, dy = ty - y;
    const dist = Math.hypot(dx, dy) || 1;
    const spd = CFG.infected.toadGlobSpeed;

    const g = glob as any;
    g._born = scene.vTime;
    g._startX = x;
    g._startY = y;
    g._targetX = tx;
    g._targetY = ty;
    g._totalDist = dist;
    g._dmg = CFG.infected.toadGlobDmg;
    g._splash = CFG.infected.toadGlobSplash;
    g._arcHeight = CFG.infected.toadGlobArcHeight;
    g._flat = false;
    g._landed = false;

    glob.setVelocity((dx / dist) * spd, (dy / dist) * spd);
  }

  landToadGlob(glob: Phaser.Physics.Arcade.Sprite) {
    const scene = this.scene;
    if (!glob.active) return;
    const g = glob as any;
    if (g._landed) return;
    g._landed = true;

    glob.setVelocity(0, 0);
    glob.setScale(0.8);
    glob.setOrigin(0.5, 0.5);
    (glob.body as Phaser.Physics.Arcade.Body).enable = false;

    const dmg = g._dmg ?? CFG.infected.toadGlobDmg;
    const splash = g._splash ?? CFG.infected.toadGlobSplash;

    const pdx = scene.player.x - glob.x, pdy = scene.player.y - glob.y;
    if (pdx * pdx + pdy * pdy < splash * splash) {
      scene.player.hurt(dmg, scene);
      scene.hud.pushHud();
      if (scene.player.hp <= 0) scene.end.lose();
    }

    const splat = scene.add.circle(glob.x, glob.y, splash, 0x40e060, 0.5).setDepth(5);
    scene.tweens.add({ targets: splat, alpha: 0, duration: 500, onComplete: () => splat.destroy() });
    glob.setTintFill(0x40e060);
    scene.tweens.add({ targets: glob, alpha: 0, scaleX: 1.2, scaleY: 0.3, duration: 200, onComplete: () => glob.destroy() });
  }

  toadGlobHitsPlayer(glob: Phaser.Physics.Arcade.Sprite) {
    if (!glob.active || (glob as any)._landed) return;
    this.landToadGlob(glob);
  }

  updateToadGlobs() {
    const scene = this.scene;
    scene.toadGlobs.children.iterate((c: any) => {
      if (!c || !c.active || c._landed) return true;
      const elapsed = scene.vTime - c._born;
      if (elapsed > CFG.infected.toadGlobLifetime) { this.landToadGlob(c); return true; }

      const dx = c.x - c._startX, dy = c.y - c._startY;
      const traveled = Math.hypot(dx, dy);
      if (traveled >= c._totalDist) {
        this.landToadGlob(c);
        return true;
      }

      const progress = traveled / c._totalDist;
      if (c._arcHeight > 0) {
        const arc = -4 * c._arcHeight * progress * (progress - 1);
        const scaleMod = 1 + (arc / c._arcHeight) * 0.4;
        c.setScale(0.8 * scaleMod);
        c.setOrigin(0.5, 0.5 + arc / 16);
      }

      return true;
    });
  }

  spawnWarlockBolt(sx: number, sy: number, tx: number, ty: number) {
    const scene = this.scene;
    const bolt = scene.physics.add.sprite(sx, sy, 'wbolt_0');
    bolt.setScale(0.5).setDepth(10);
    bolt.play('wbolt-spin');
    scene.warlockBolts.add(bolt);
    const dx = tx - sx, dy = ty - sy;
    const d = Math.hypot(dx, dy) || 1;
    const spd = CFG.castle.warlockBoltSpeed;
    bolt.setVelocity((dx / d) * spd, (dy / d) * spd);
    (bolt as any)._born = scene.vTime;
    (bolt as any)._dmg = CFG.castle.warlockBoltDmg;
  }

  spawnQueenOrb(sx: number, sy: number, tx: number, ty: number) {
    const scene = this.scene;
    const orb = scene.physics.add.sprite(sx, sy, 'qorb_0');
    orb.setScale(0.5).setDepth(10);
    orb.play('qorb-spin');
    scene.queenOrbs.add(orb);
    const dx = tx - sx, dy = ty - sy;
    const d = Math.hypot(dx, dy) || 1;
    const spd = CFG.castle.queenOrbSpeed;
    orb.setVelocity((dx / d) * spd, (dy / d) * spd);
    (orb as any)._born = scene.vTime;
    (orb as any)._dmg = CFG.castle.queenOrbDmg;
  }

  spawnDragonFireball(sx: number, sy: number, tx: number, ty: number) {
    const scene = this.scene;
    const fb = scene.physics.add.sprite(sx, sy, 'dfball_0');
    fb.setScale(0.6).setDepth(10);
    fb.play('dfball-spin');
    scene.dragonFireballs.add(fb);
    const dx = tx - sx, dy = ty - sy;
    const d = Math.hypot(dx, dy) || 1;
    const spd = CFG.castle.dragonFireballSpeed;
    fb.setVelocity((dx / d) * spd, (dy / d) * spd);
    (fb as any)._born = scene.vTime;
    (fb as any)._dmg = CFG.castle.dragonFireballDmg;
    (fb as any)._splash = CFG.castle.dragonFireballSplash;
    (fb as any)._tx = tx;
    (fb as any)._ty = ty;
    (fb as any)._totalDist = d;
    (fb as any)._startX = sx;
    (fb as any)._startY = sy;
  }

  castleBoltHitsPlayer(bolt: Phaser.Physics.Arcade.Sprite) {
    const scene = this.scene;
    if (!bolt.active) return;
    const dmg = (bolt as any)._dmg ?? 6;
    scene.player.hurt(dmg, scene);
    scene.hud.pushHud();
    if (scene.player.hp <= 0) scene.end.lose();
    bolt.destroy();
  }

  dragonFireballHitsPlayer(fb: Phaser.Physics.Arcade.Sprite) {
    const scene = this.scene;
    if (!fb.active) return;
    const dmg = (fb as any)._dmg ?? 15;
    scene.player.hurt(dmg, scene);
    scene.hud.pushHud();
    if (scene.player.hp <= 0) scene.end.lose();
    (fb as any)._directHit = true;
    this.dragonFireballExplode(fb);
  }

  dragonFireballExplode(fb: Phaser.Physics.Arcade.Sprite) {
    const scene = this.scene;
    if (!fb.active) return;
    const x = fb.x, y = fb.y;
    const dmg = (fb as any)._dmg ?? 15;
    const splash = (fb as any)._splash ?? 48;
    fb.destroy();

    const expl = scene.add.sprite(x, y, 'dfexpl_0').setScale(1.2).setDepth(12);
    expl.play('dfexpl');
    expl.once('animationcomplete', () => expl.destroy());

    if (Phaser.Math.Distance.Between(x, y, scene.player.x, scene.player.y) < splash) {
      if (!(fb as any)._directHit) {
        scene.player.hurt(dmg, scene);
        scene.hud.pushHud();
        if (scene.player.hp <= 0) scene.end.lose();
      }
    }

    const structDmg = Math.floor(dmg * 2.5);
    for (const t of scene.towers) {
      if (Phaser.Math.Distance.Between(x, y, t.x, t.y) < splash) {
        t.hurt(structDmg);
        if (t.hp <= 0) scene.sell.destroyTower(t);
      }
    }
    for (const w of scene.walls) {
      if (Phaser.Math.Distance.Between(x, y, w.x, w.y) < splash) {
        w.hurt(structDmg);
        if (w.hp <= 0) scene.sell.destroyWall(w);
      }
    }
  }

  updateCastleProjectiles() {
    const scene = this.scene;
    scene.warlockBolts.children.iterate((c: any) => {
      if (!c || !c.active) return true;
      if (scene.vTime - c._born > CFG.castle.warlockBoltLifetime) { c.destroy(); return true; }
      return true;
    });
    scene.queenOrbs.children.iterate((c: any) => {
      if (!c || !c.active) return true;
      if (scene.vTime - c._born > CFG.castle.queenOrbLifetime) { c.destroy(); return true; }
      return true;
    });
    const fbToExplode: Phaser.Physics.Arcade.Sprite[] = [];
    scene.dragonFireballs.children.iterate((c: any) => {
      if (!c || !c.active) return true;
      if (scene.vTime - c._born > CFG.castle.dragonFireballLifetime) {
        fbToExplode.push(c);
        return true;
      }
      return true;
    });
    for (const fb of fbToExplode) {
      const splash = (fb as any)._splash ?? 48;
      const dmg = (fb as any)._dmg ?? 15;
      if (Phaser.Math.Distance.Between(fb.x, fb.y, scene.player.x, scene.player.y) < splash) {
        scene.player.hurt(dmg, scene);
        scene.hud.pushHud();
        if (scene.player.hp <= 0) scene.end.lose();
        (fb as any)._directHit = true;
      }
      this.dragonFireballExplode(fb);
    }
  }
}
