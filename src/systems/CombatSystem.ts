import Phaser from 'phaser';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { CFG } from '../config';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Coin } from '../entities/Coin';
import { Projectile } from '../entities/Projectile';
import { SFX } from '../audio/sfx';
import type { GameScene } from '../scenes/GameScene';

/**
 * Tower firing logic, target selection (nearest, most-threatening,
 * best-cannon-splash), projectile lifecycle, and damage application
 * (including the cannon explosion VFX + crater).
 */
export class CombatSystem {
  constructor(private scene: GameScene) {}

  updateTowers(time: number) {
    const scene = this.scene;
    for (const tower of scene.towers) {
      tower.drawHpBar();
      // Pending sale — tower stops firing during the sell countdown so the
      // player can't milk damage from a tower they've already cashed out.
      // Walls keep blocking enemies until the timer completes (handled by
      // the grid still containing them until executeSell).
      if (scene.sellTimers.has(tower)) continue;
      const st = tower.stats();

      if (st.splashRadius > 0) {
        // Cannon: aim at the spot that hits the most enemies
        const aim = this.findBestCannonTarget(tower.x, tower.y, st.range, st.splashRadius, st.projectileSpeed);
        if (!aim) continue;
        const launchY = tower.top.y; // fire from the barrel position, not base center
        // Cannonball arcs visually via `vy(t) = startY + dy·t − 22·sin(t·π)`
        // (see updateProjectiles). Tangent at the muzzle (t=0) is
        // (dx, dy − 22π) — totalDist drops out. Aim the barrel along that
        // tangent so the cannon points where the ball is actually heading
        // when it leaves the bore, not straight at the target.
        const dx = aim.x - tower.x;
        const dy = aim.y - launchY;
        const ARC_LIFT = 22 * Math.PI;
        const angle = Math.atan2(dy - ARC_LIFT, dx);
        tower.top.setRotation(angle);
        if (time > tower.lastShot + st.fireRate) {
          tower.lastShot = time;
          SFX.play('cannonShoot');
          tower.top.play('cannon-top-shoot', true);
          const cScale = 0.5 + tower.level * 0.15;
          // Spawn the cannonball at the muzzle of the barrel, not the pivot
          // — same trick the arrow tower uses with the bow tip. Cannon top
          // has origin (0.5, 0.5) and the muzzle sits +22 source px right of
          // origin → +11 world at scale 0.5; +13 puts the spawn just past
          // the muzzle flash so it reads as emerging from the bore.
          const spawnX = tower.top.x + Math.cos(angle) * 26;
          const spawnY = tower.top.y + Math.sin(angle) * 26;
          this.spawnProjectile(spawnX, spawnY, aim.x, aim.y, st.projectileSpeed, st.damage, st.splashRadius, cScale);
        }
      } else {
        // Arrow: shoot at nearest enemy with lead targeting
        const tgt = this.findNearestEnemy(tower.x, tower.y, st.range);
        if (!tgt) {
          // Reset shoot pose if the shot animation window has elapsed —
          // otherwise a target that disappears right after firing leaves the
          // bow stuck pulled back with the nocked arrow invisible forever.
          if (time > tower.lastShot + 150) {
            tower.top.setTexture('t_top_0');
            if (tower.nockedArrow) tower.nockedArrow.setVisible(true);
          }
          // Keep the nocked arrow aligned with the bow's current rotation while idle
          if (tower.nockedArrow) {
            tower.nockedArrow.setPosition(
              tower.top.x + Math.cos(tower.top.rotation) * 23,
              tower.top.y + Math.sin(tower.top.rotation) * 23
            );
            tower.nockedArrow.setRotation(tower.top.rotation);
          }
          continue;
        }
        let aimX = tgt.x, aimY = tgt.y;
        if (tgt.body) {
          const dist = Math.hypot(tgt.x - tower.x, tgt.y - tower.y) || 1;
          const travelTime = dist / st.projectileSpeed;
          const tb = tgt.body as Phaser.Physics.Arcade.Body;
          aimX = tgt.x + tb.velocity.x * travelTime;
          aimY = tgt.y + tb.velocity.y * travelTime;
        }
        const launchY = tower.top.y; // fire from the bow/archer position, not base center
        const angle = Math.atan2(aimY - launchY, aimX - tower.x);
        tower.top.setRotation(angle);
        if (time > tower.lastShot + st.fireRate) {
          tower.lastShot = time;
          SFX.play('arrowShoot');
          tower.top.setTexture('t_top_1');
          if (tower.nockedArrow) tower.nockedArrow.setVisible(false);
          const aScale = 0.5 + tower.level * 0.12;
          const aTint = tower.level === 2 ? 0xffd67a : tower.level === 1 ? 0x9fd9ff : 0;
          // Spawn at the nocked-arrow position so the shot emanates from the bow
          const spawnX = tower.top.x + Math.cos(angle) * 23;
          const spawnY = tower.top.y + Math.sin(angle) * 23;
          this.spawnProjectile(spawnX, spawnY, aimX, aimY, st.projectileSpeed, st.damage, 0, aScale, aTint, tgt);
        } else if (time > tower.lastShot + 150) {
          tower.top.setTexture('t_top_0');
          if (tower.nockedArrow) tower.nockedArrow.setVisible(true);
        }

        // Nocked arrow rides with the bow — fletching tip aligned with the bowstring
        if (tower.nockedArrow) {
          tower.nockedArrow.setPosition(
            tower.top.x + Math.cos(angle) * 23,
            tower.top.y + Math.sin(angle) * 23
          );
          tower.nockedArrow.setRotation(angle);
        }
      }
    }
  }

  /**
   * Find the aim point within range that maximizes enemies hit by splash.
   * Considers each enemy's predicted position when the cannonball arrives.
   */
  findBestCannonTarget(tx: number, ty: number, range: number, splash: number, projSpeed: number): { x: number; y: number } | null {
    const scene = this.scene;
    const r2 = range * range;
    const s2 = splash * splash;

    // Collect predicted positions for all enemies in range
    const candidates: { px: number; py: number }[] = [];
    scene.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (!e || !e.active || e.dying) return true;
      const d2 = (e.x - tx) ** 2 + (e.y - ty) ** 2;
      if (d2 > r2) return true;
      // Lead: predict where enemy will be when ball arrives
      const dist = Math.sqrt(d2) || 1;
      const travelTime = dist / projSpeed;
      const b = e.body as Phaser.Physics.Arcade.Body;
      const px = e.x + (b ? b.velocity.x * travelTime : 0);
      const py = e.y + (b ? b.velocity.y * travelTime : 0);
      candidates.push({ px, py });
      return true;
    });
    // Also consider the boss(es). Endless mode's double-boss events
    // stash the secondary in midBoss, so cannons can lead-target either.
    const bossesToCheck: (Boss | null)[] = [scene.bossState.boss];
    if (scene.difficulty === 'endless' && scene.bossState.midBoss && scene.bossState.midBoss !== scene.bossState.boss) {
      bossesToCheck.push(scene.bossState.midBoss);
    }
    for (const bb of bossesToCheck) {
      if (!bb || !bb.active || bb.dying) continue;
      const d2 = (bb.x - tx) ** 2 + (bb.y - ty) ** 2;
      if (d2 <= r2) {
        const dist = Math.sqrt(d2) || 1;
        const travelTime = dist / projSpeed;
        const body = bb.body as Phaser.Physics.Arcade.Body;
        const px = bb.x + (body ? body.velocity.x * travelTime : 0);
        const py = bb.y + (body ? body.velocity.y * travelTime : 0);
        candidates.push({ px, py });
      }
    }

    if (candidates.length === 0) return null;

    // Test each candidate position as a potential aim point and pick the one
    // that catches the most enemies in the splash radius
    let bestCount = 0;
    let bestX = candidates[0].px, bestY = candidates[0].py;
    for (const c of candidates) {
      let count = 0;
      for (const o of candidates) {
        if ((c.px - o.px) ** 2 + (c.py - o.py) ** 2 <= s2) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestX = c.px;
        bestY = c.py;
      }
    }
    return { x: bestX, y: bestY };
  }

  findNearestEnemy(x: number, y: number, range: number): Enemy | Boss | null {
    const scene = this.scene;
    let best: Enemy | Boss | null = null;
    let bestD = range * range;
    scene.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (!e || !e.active || e.dying) return true;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
      return true;
    });
    if (scene.bossState.boss && scene.bossState.boss.active && !scene.bossState.boss.dying) {
      const d = (scene.bossState.boss.x - x) ** 2 + (scene.bossState.boss.y - y) ** 2;
      if (d < bestD) { bestD = d; best = scene.bossState.boss; }
    }
    if (scene.difficulty === 'endless' && scene.bossState.midBoss && scene.bossState.midBoss !== scene.bossState.boss
        && scene.bossState.midBoss.active && !scene.bossState.midBoss.dying) {
      const d = (scene.bossState.midBoss.x - x) ** 2 + (scene.bossState.midBoss.y - y) ** 2;
      if (d < bestD) { bestD = d; best = scene.bossState.midBoss; }
    }
    return best;
  }

  /**
   * Player targeting: pick the enemy closest to arriving (shortest remaining
   * path). Enemies with direct LOS (no BFS path) use euclidean distance.
   * Still filters to within shooting range.
   */
  findMostThreateningEnemy(x: number, y: number, range: number): Enemy | Boss | null {
    const scene = this.scene;
    let best: Enemy | Boss | null = null;
    let bestPathDist = Infinity;
    const r2 = range * range;
    scene.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (!e || !e.active || e.dying) return true;
      const eucD2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (eucD2 > r2) return true; // out of shooting range
      // Path distance: remaining BFS steps, or euclidean if direct LOS
      const pathDist = e.path && e.path.length > 0
        ? (e.path.length - e.pathIdx) * CFG.tile
        : Math.sqrt(eucD2);
      if (pathDist < bestPathDist) { bestPathDist = pathDist; best = e; }
      return true;
    });
    const bossesToCheck: (Boss | null)[] = [scene.bossState.boss];
    if (scene.difficulty === 'endless' && scene.bossState.midBoss && scene.bossState.midBoss !== scene.bossState.boss) {
      bossesToCheck.push(scene.bossState.midBoss);
    }
    for (const bb of bossesToCheck) {
      if (!bb || !bb.active || bb.dying) continue;
      const eucD2 = (bb.x - x) ** 2 + (bb.y - y) ** 2;
      if (eucD2 <= r2) {
        const pathDist = bb.path && bb.path.length > 0
          ? (bb.path.length - bb.pathIdx) * CFG.tile
          : Math.sqrt(eucD2);
        if (pathDist < bestPathDist) { bestPathDist = pathDist; best = bb; }
      }
    }
    return best;
  }

  spawnProjectile(x: number, y: number, tx: number, ty: number, speed: number, dmg: number, splashRadius = 0, scale = 0.5, tint = 0, homingTarget: Phaser.GameObjects.Sprite | null = null) {
    const scene = this.scene;
    const pr = new Projectile(scene, x, y);
    scene.projectiles.add(pr);
    pr.fire(tx, ty, speed, dmg, splashRadius, scale, tint, homingTarget);
  }

  updateProjectiles(time: number) {
    const scene = this.scene;
    scene.projectiles.children.iterate((c: any) => {
      const p = c as Projectile;
      if (!p || !p.active) return true;
      if (time - p.born > p.lifetime) { p.destroy(); return true; }

      // Homing arrows: steer toward target each frame
      if (p.homingTarget && !p.groundTarget) {
        if (p.homingTarget.active && !(p.homingTarget as any).dying) {
          const dx = p.homingTarget.x - p.x;
          const dy = p.homingTarget.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const angle = Math.atan2(dy, dx);
          p.setVelocity((dx / d) * p.speed, (dy / d) * p.speed);
          p.setRotation(angle);
        } else {
          // Target dead — stop homing, fly straight with current velocity
          p.homingTarget = null;
        }
      }

      if (p.groundTarget) {
        // Undo previous arc offset so physics position is correct
        p.y += p.arcOffset;

        // Check arrival at ground target
        const d = Math.hypot(p.groundX - p.x, p.groundY - p.y);
        if (d < 14) {
          p.arcOffset = 0;
          this.cannonExplode(p.groundX, p.groundY, p.splashRadius, p.damage);
          p.destroy();
          return true;
        }

        // Arc: parabolic height based on flight progress
        const traveled = Math.hypot(p.x - p.startX, p.y - p.startY);
        const t = Math.min(traveled / p.totalDist, 1);
        const arcHeight = Math.sin(t * Math.PI) * 22;
        p.arcOffset = arcHeight;

        // Shadow follows on the ground
        if (p.shadow) {
          p.shadow.setPosition(p.x, p.y);
          const shadowScale = 0.2 + Math.sin(t * Math.PI) * 0.25;
          p.shadow.setScale(shadowScale);
          p.shadow.setAlpha(0.4 - Math.sin(t * Math.PI) * 0.2);
        }

        // Visually shift the ball upward (arc)
        p.y -= arcHeight;
      }
      return true;
    });
  }

  projectileHitsBoss(pr: Projectile, b: Boss) {
    const scene = this.scene;
    if (!pr.active || !b.active || b.dying) return;
    // Cannonballs ignore direct hits — they explode on reaching their ground target
    if (pr.groundTarget) return;
    SFX.play('hit');
    const dmgApplied = Math.min(pr.damage, Math.max(0, b.hp));
    b.hurt(pr.damage);
    scene.runStats.damageDealt += dmgApplied;
    const spark = scene.add.sprite(pr.x, pr.y, 'fx_hit_0').setDepth(15).setScale(0.5);
    spark.play('fx-hit');
    spark.once('animationcomplete', () => spark.destroy());
    pr.destroy();
    // Only the primary boss drives the top HUD bar — otherwise endless-
    // mode double-boss events flicker the bar between two HP values as
    // hits land on each. Each boss still gets its own in-world bar via
    // Boss.drawHpBar().
    if (b === scene.bossState.boss) {
      getEvents(scene.game.events).emit('boss-hp', { hp: b.hp, maxHp: b.maxHp });
      getRegistry(scene.game).set('bossHp', b.hp);
    }
    if (b.dying) {
      // bossActive only flips off when the primary dies — for endless
      // doubles we still want the HUD to show the secondary's HP via
      // its in-world bar; the primary bar hides at this moment.
      if (b === scene.bossState.boss) getRegistry(scene.game).set('bossActive', false);
      this.dropBossLoot(b);
      // Stats — bucket the kill by boss kind so the death panel can
      // show "Rams: 3, Dragons: 1" etc.
      scene.runStats.bossesKilled++;
      const bucket = b.bossKind === 'queen' ? 'queen'
        : b.bossKind === 'dragon' ? 'dragon'
        : b.animPrefix === 'fboss' ? 'wendigo'
        : b.animPrefix === 'iboss' ? 'blighted'
        : b.animPrefix === 'rboss' ? 'fog'
        : 'ram';
      scene.runStats.bossesByKind[bucket] = (scene.runStats.bossesByKind[bucket] ?? 0) + 1;
    }
  }

  dropBossLoot(b: Boss) {
    const scene = this.scene;
    const drops = 12;
    for (let i = 0; i < drops; i++) {
      const a = (i / drops) * Math.PI * 2;
      const d = Phaser.Math.Between(6, 22);
      const coin = new Coin(scene, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 'gold');
      scene.coins.add(coin);
    }
  }

  projectileHitsEnemy(pr: Projectile, e: Enemy) {
    const scene = this.scene;
    if (!pr.active || !e.active || e.dying) return;
    // Cannonballs ignore direct hits — they explode on reaching their ground target
    if (pr.groundTarget) return;

    this.applyDamageToEnemy(e, pr.damage);
    const spark = scene.add.sprite(pr.x, pr.y, 'fx_hit_0').setDepth(15).setScale(0.5);
    spark.play('fx-hit');
    spark.once('animationcomplete', () => spark.destroy());
    pr.destroy();
  }

  /** Damage a single enemy and handle its death drops/counts. */
  applyDamageToEnemy(e: Enemy, dmg: number) {
    const scene = this.scene;
    if (!e || !e.active || e.dying) return;
    SFX.play('hit');
    const dmgApplied = Math.min(dmg, Math.max(0, e.hp));
    e.hurt(dmg);
    scene.runStats.damageDealt += dmgApplied;
    if (e.hp <= 0) {
      if (!e.noCoinDrop) {
        const tier =
          e.kind === 'heavy' || e.kind === 'deer' || e.kind === 'bear' || e.kind === 'infected_heavy' ? 'silver' :
                                                     'bronze';
        const coin = new Coin(scene, e.x + Phaser.Math.Between(-4, 4), e.y + Phaser.Math.Between(-4, 4), tier);
        scene.coins.add(coin);
      }
      const burst = scene.add.sprite(e.x, e.y, 'fx_death_0').setDepth(15).setScale(0.5);
      burst.play('fx-death');
      burst.once('animationcomplete', () => burst.destroy());

      scene.player.kills++;
      scene.runStats.enemiesKilled++;
      scene.waveState.recordKill();
      scene.hud.pushHud();
      if (getRegistry(scene.game).get('tutorialActive')) getEvents(scene.game.events).emit('tutorial-kill');
    }
  }

  cannonExplode(x: number, y: number, radius: number, dmg: number) {
    const scene = this.scene;
    SFX.play('boom');
    // ---------- VISUALS ----------
    // 1) Bright white core flash (fast)
    const core = scene.add.circle(x, y, radius * 0.55, 0xfff5c0, 0.95)
      .setDepth(16)
      .setScale(0.3);
    scene.tweens.add({
      targets: core,
      scale: 1,
      alpha: { from: 1, to: 0 },
      duration: 160,
      ease: 'Sine.Out',
      onComplete: () => core.destroy()
    });

    // 2) Orange fireball layer
    const fire = scene.add.circle(x, y, radius * 0.85, 0xff8a20, 0.85)
      .setDepth(15)
      .setScale(0.25);
    scene.tweens.add({
      targets: fire,
      scale: 1,
      alpha: { from: 0.9, to: 0 },
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => fire.destroy()
    });

    // 3) Dark red outer shell for depth
    const shell = scene.add.circle(x, y, radius, 0xc93010, 0.55)
      .setDepth(14)
      .setScale(0.2);
    scene.tweens.add({
      targets: shell,
      scale: 1.05,
      alpha: { from: 0.7, to: 0 },
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => shell.destroy()
    });

    // 4) Expanding shockwave ring outline
    const ring = scene.add.circle(x, y, radius, 0x000000, 0)
      .setStrokeStyle(3, 0xffd070, 0.95)
      .setDepth(17)
      .setScale(0.2);
    scene.tweens.add({
      targets: ring,
      scale: 1.15,
      alpha: { from: 1, to: 0 },
      duration: 360,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
    });

    // 5) Fiery shrapnel sparks shooting outward
    const sparkCount = 14;
    for (let i = 0; i < sparkCount; i++) {
      const a = (i / sparkCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist = radius * Phaser.Math.FloatBetween(0.7, 1.1);
      const sparkColor = [0xffe070, 0xff9030, 0xffffff][i % 3];
      const s = scene.add.circle(x, y, Phaser.Math.Between(2, 3), sparkColor, 1).setDepth(18);
      scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0.3 },
        duration: Phaser.Math.Between(260, 420),
        ease: 'Cubic.Out',
        onComplete: () => s.destroy()
      });
    }

    // 6) Smoke puffs that linger after the fire fades
    const smokeCount = 7;
    for (let i = 0; i < smokeCount; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const offD = Phaser.Math.FloatBetween(0, radius * 0.6);
      const px = x + Math.cos(a) * offD;
      const py = y + Math.sin(a) * offD;
      const shade = [0x6a6a74, 0x858590, 0x4a4a54][i % 3];
      const puff = scene.add.circle(px, py, Phaser.Math.Between(8, 13), shade, 0.65)
        .setStrokeStyle(1, 0x2a2a32, 0.4)
        .setDepth(13)
        .setScale(0.4);
      const driftX = Phaser.Math.Between(-10, 10);
      const driftY = Phaser.Math.Between(-20, -8); // smoke rises
      // small delay so smoke emerges as the fire dies down
      scene.tweens.add({
        targets: puff,
        scale: { from: 0.4, to: 1.4 },
        alpha: { from: 0.7, to: 0 },
        x: px + driftX,
        y: py + driftY,
        duration: Phaser.Math.Between(600, 900),
        delay: Phaser.Math.Between(40, 140),
        ease: 'Sine.Out',
        onComplete: () => puff.destroy()
      });
    }

    // 7) Permanent dirt crater on the ground
    this.spawnCrater(x, y, radius);

    // Damage all enemies in radius
    const r2 = radius * radius;
    const hitList: Enemy[] = [];
    scene.enemies.children.iterate((c: any) => {
      const en = c as Enemy;
      if (!en || !en.active || en.dying) return true;
      const dx = en.x - x, dy = en.y - y;
      if (dx * dx + dy * dy <= r2) hitList.push(en);
      return true;
    });
    for (const en of hitList) this.applyDamageToEnemy(en, dmg);

    // Also chip the boss if in range
    if (scene.bossState.boss && scene.bossState.boss.active && !scene.bossState.boss.dying) {
      const dx = scene.bossState.boss.x - x, dy = scene.bossState.boss.y - y;
      if (dx * dx + dy * dy <= r2) {
        scene.bossState.boss.hurt(Math.floor(dmg * 0.6));
        getEvents(scene.game.events).emit('boss-hp', { hp: scene.bossState.boss.hp, maxHp: scene.bossState.boss.maxHp });
        getRegistry(scene.game).set('bossHp', scene.bossState.boss.hp);
        if (scene.bossState.boss.dying) {
          getRegistry(scene.game).set('bossActive', false);
          this.dropBossLoot(scene.bossState.boss);
        }
      }
    }
  }

  spawnCrater(x: number, y: number, _radius: number) {
    const scene = this.scene;
    const g = scene.add.graphics().setDepth(0);
    const cr = 10;
    // Ash streaks radiating outward — thicker near crater, tapering to a point
    const streakColors = [0x1a1008, 0x241810, 0x2e2014];
    const streaks = Phaser.Math.Between(5, 8);
    for (let i = 0; i < streaks; i++) {
      const a = (i / streaks) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.35, 0.35);
      const len = Phaser.Math.FloatBetween(6, 12);
      const steps = 5;
      const color = streakColors[i % 3];
      const alpha = Phaser.Math.FloatBetween(0.45, 0.65);
      g.fillStyle(color, alpha);
      for (let s = 0; s < steps; s++) {
        const t = s / (steps - 1); // 0 at crater edge, 1 at tip
        const d = cr * 0.7 + len * t;
        const sx = x + Math.cos(a) * d;
        const sy = y + Math.sin(a) * d;
        const r = 2.2 * (1 - t * 0.85); // thick at start, tiny point at end
        g.fillCircle(sx, sy, Math.max(r, 0.5));
      }
    }
    // Brown crater bowl
    g.fillStyle(0x3e2e1a, 0.6);
    g.fillEllipse(x, y, cr * 2, cr * 1.5);
    // Darker center
    g.fillStyle(0x2a1e10, 0.5);
    g.fillEllipse(x + Phaser.Math.FloatBetween(-1, 1), y + Phaser.Math.FloatBetween(-1, 1), cr * 1.1, cr * 0.8);
    // Light dirt highlight on top rim
    g.fillStyle(0x9a7a50, 0.25);
    g.fillEllipse(x, y - cr * 0.3, cr * 1.3, cr * 0.35);
    // Fade out over 15 seconds then destroy
    scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 15000,
      ease: 'Sine.In',
      onComplete: () => g.destroy()
    });
  }
}
