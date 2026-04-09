import Phaser from 'phaser';
import { CFG } from '../config';
import { Player } from '../entities/Player';
import { Enemy, EnemyKind } from '../entities/Enemy';
import { Tower, TowerKind } from '../entities/Tower';
import { Wall } from '../entities/Wall';
import { Projectile } from '../entities/Projectile';
import { Coin } from '../entities/Coin';
import { Boss } from '../entities/Boss';
import { createGrid, findPath, Grid } from '../systems/Pathfinding';

type BuildKind = 'none' | 'tower' | 'wall';

export class GameScene extends Phaser.Scene {
  player!: Player;
  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  coins!: Phaser.Physics.Arcade.Group;
  walls: Wall[] = [];
  towers: Tower[] = [];
  wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  towerGroup!: Phaser.Physics.Arcade.StaticGroup;

  grid: Grid = createGrid();
  gridVersion = 0;

  keys!: any;
  buildKind: BuildKind = 'none';
  buildTowerKind: TowerKind = 'arrow';
  nextRunnerPack = 0;
  ghost!: Phaser.GameObjects.Sprite;
  gridOverlay!: Phaser.GameObjects.Graphics;

  spawnTimer = 0;
  spawnInterval = CFG.spawn.initialInterval;
  rampTimer = 0;
  heavyChance = CFG.spawn.heavyChanceStart;
  waveStartAt = 0;
  wave = 0;               // 0-indexed current wave
  waveSpawned = 0;        // enemies spawned in the current wave
  waveKills = 0;          // kills counted for the current wave
  waveBreakUntil = 0;     // timestamp when the inter-wave build break ends
  countdownText!: Phaser.GameObjects.Text;

  // Virtual / scalable game time so the "speed up" button affects all
  // cooldown / spawn logic, not just physics and animations.
  timeMult = 1;
  vTime = 0;

  selectedTower: Tower | null = null;
  selectionRing!: Phaser.GameObjects.Graphics;
  towerPanel!: Phaser.GameObjects.Container;
  towerPanelBounds = { x: 0, y: 0, w: 0, h: 0 };

  boss: Boss | null = null;
  bossSpawned = false;
  bossCountdownUntil = 0;       // set once the last wave is cleared, boss spawns at this time

  killsTarget = CFG.winKills;
  gameOver = false;
  playerName = 'hero';

  constructor() { super('Game'); }

  init(data: any) {
    this.playerName = data?.playerName || 'hero';
  }

  create() {
    const W = CFG.worldCols * CFG.tile;
    const H = CFG.worldRows * CFG.tile;
    this.physics.world.setBounds(0, 0, W, H);
    this.cameras.main.setBounds(0, 0, W, H);

    // ground
    for (let y = 0; y < CFG.worldRows; y++) {
      for (let x = 0; x < CFG.worldCols; x++) {
        const key = `ground_${(x * 31 + y * 17) % 4}`;
        this.add.image(x * CFG.tile + CFG.tile / 2, y * CFG.tile + CFG.tile / 2, key).setDepth(0);
      }
    }

    // groups
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: false });
    this.projectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: false });
    this.coins = this.physics.add.group({ classType: Coin, runChildUpdate: false });
    this.wallGroup = this.physics.add.staticGroup();
    this.towerGroup = this.physics.add.staticGroup();

    // player
    this.player = new Player(this, W / 2, H / 2);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // collisions
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.player, this.towerGroup);
    this.physics.add.collider(this.enemies, this.wallGroup, (e, w) => this.enemyHitsWall(e as Enemy, w as Wall));
    this.physics.add.collider(this.enemies, this.towerGroup, (e, t) => this.enemyHitsTower(e as Enemy, t as Tower));
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.enemyHitsPlayer(e as Enemy));
    this.physics.add.overlap(this.projectiles, this.enemies, (pr, en) => this.projectileHitsEnemy(pr as Projectile, en as Enemy));
    // boss overlaps set up when boss spawns (since it's created later)

    // input
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,X,ESC');
    this.input.keyboard!.on('keydown-ONE', () => this.setBuild('tower', 'arrow'));
    this.input.keyboard!.on('keydown-TWO', () => this.setBuild('tower', 'cannon'));
    this.input.keyboard!.on('keydown-THREE', () => this.setBuild('wall'));
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.selectedTower) this.deselectTower();
      else this.setBuild('none');
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handleClick(p));

    // build ghost
    this.ghost = this.add.sprite(0, 0, 'wall').setAlpha(0.5).setDepth(20).setVisible(false).setOrigin(0.5);

    // grid overlay (only visible while building)
    const gridG = this.add.graphics().setDepth(19).setVisible(false);
    gridG.lineStyle(1, 0xffffff, 0.18);
    for (let x = 0; x <= CFG.worldCols; x++) {
      gridG.lineBetween(x * CFG.tile, 0, x * CFG.tile, H);
    }
    for (let y = 0; y <= CFG.worldRows; y++) {
      gridG.lineBetween(0, y * CFG.tile, W, y * CFG.tile);
    }
    this.gridOverlay = gridG;

    // selection ring (tower range visualizer)
    this.selectionRing = this.add.graphics().setDepth(18).setVisible(false);

    // tower upgrade panel (built once, positioned/shown on selection)
    this.towerPanel = this.add.container(0, 0).setDepth(50).setVisible(false);

    // events from UI
    this.events.emit('hud', this.hudState());
    this.game.events.on('ui-build', (k: BuildKind, tk?: TowerKind) => this.setBuild(k, tk));
    this.game.events.on('ui-sell', () => this.setBuild('none'));
    this.game.events.on('ui-speed', (mult: number) => this.setTimeScale(mult));

    // initial UI update
    this.scene.get('UI').events.emit('hud', this.hudState());

    // pre-wave build phase
    this.waveStartAt = CFG.spawn.startDelay;
    this.countdownText = this.add.text(W / 2, 36, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: 4
    }).setOrigin(0.5).setDepth(30).setScrollFactor(0);
  }

  hudState() {
    return {
      name: this.playerName,
      hp: this.player?.hp ?? CFG.player.hp,
      maxHp: CFG.player.hp,
      money: this.player?.money ?? 0,
      kills: this.player?.kills ?? 0,
      target: this.killsTarget,
      build: this.buildKind === 'tower' ? this.buildTowerKind : this.buildKind,
      bossSpawned: this.bossSpawned
    };
  }

  pushHud() {
    this.game.events.emit('hud', this.hudState());
  }

  setTimeScale(mult: number) {
    this.timeMult = mult;
    // Phaser's physics.world.timeScale is inverted: lower = faster.
    this.physics.world.timeScale = 1 / mult;
    this.anims.globalTimeScale = mult;
    this.tweens.timeScale = mult;
    this.time.timeScale = mult;
  }

  setBuild(k: BuildKind, towerKind?: TowerKind) {
    this.buildKind = k;
    if (k === 'tower' && towerKind) this.buildTowerKind = towerKind;
    this.ghost.setVisible(k !== 'none');
    if (this.gridOverlay) this.gridOverlay.setVisible(k !== 'none');
    if (k === 'tower') {
      this.ghost.setTexture('t_base');
      // pre-tint the ghost so player sees which kind they're placing
      const baseTint = Tower.TIER_TINT[this.buildTowerKind][0];
      this.ghost.setTint(baseTint);
    }
    if (k === 'wall') {
      this.ghost.setTexture('wall');
      this.ghost.clearTint();
    }
    if (k !== 'none') this.deselectTower();
    this.pushHud();
  }

  // Check if a 3x3 block with top-left at (tx,ty) is all free (and not under player)
  canPlaceTower(tx: number, ty: number): boolean {
    const s = CFG.tower.tiles;
    if (tx < 0 || ty < 0 || tx + s > CFG.worldCols || ty + s > CFG.worldRows) return false;
    const pt = this.worldToTile(this.player.x, this.player.y);
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        if (this.grid[ty + j][tx + i] !== 0) return false;
        if (pt.x === tx + i && pt.y === ty + j) return false;
      }
    }
    return true;
  }

  handleClick(p: Phaser.Input.Pointer) {
    if (this.gameOver) return;
    const wx = p.worldX, wy = p.worldY;

    // panel takes priority — clicks inside it are handled by button hit areas
    if (this.selectedTower && this.pointInPanel(wx, wy)) return;

    const tx = Math.floor(wx / CFG.tile);
    const ty = Math.floor(wy / CFG.tile);
    if (tx < 0 || ty < 0 || tx >= CFG.worldCols || ty >= CFG.worldRows) {
      this.deselectTower();
      return;
    }

    // sell with X held + click
    if (this.keys.X.isDown) {
      this.sellAt(tx, ty);
      return;
    }

    // click an existing tower with no active build = select it
    if (this.buildKind === 'none') {
      const hit = this.towers.find(t =>
        tx >= t.tileX && tx < t.tileX + t.size &&
        ty >= t.tileY && ty < t.tileY + t.size);
      if (hit) this.selectTower(hit);
      else this.deselectTower();
      return;
    }

    // entering build mode cancels selection
    this.deselectTower();

    if (this.buildKind === 'tower') {
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
      const kindCost = CFG.tower.kinds[this.buildTowerKind].cost;
      if (this.player.money < kindCost) return;
      this.player.money -= kindCost;
      const t = new Tower(this, ox, oy, this.buildTowerKind);
      this.towers.push(t);
      this.towerGroup.add(t);
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) this.grid[oy + j][ox + i] = 1;
      this.gridVersion++;
      this.pushHud();
      return;
    }

    // wall
    if (this.grid[ty][tx] !== 0) return;
    const pt = this.worldToTile(this.player.x, this.player.y);
    if (pt.x === tx && pt.y === ty) return;
    if (this.player.money < CFG.wall.cost) return;
    this.player.money -= CFG.wall.cost;
    const w = new Wall(this, tx, ty);
    this.walls.push(w);
    this.wallGroup.add(w);
    this.grid[ty][tx] = 1;
    this.gridVersion++;
    this.pushHud();
  }

  sellAt(tx: number, ty: number) {
    // tower: click anywhere inside the 3x3 footprint
    const ti = this.towers.findIndex(t =>
      tx >= t.tileX && tx < t.tileX + t.size &&
      ty >= t.tileY && ty < t.tileY + t.size);
    if (ti >= 0) {
      const t = this.towers[ti];
      this.player.money += Math.floor(t.totalSpent * 0.5);
      for (let j = 0; j < t.size; j++) for (let i = 0; i < t.size; i++) this.grid[t.tileY + j][t.tileX + i] = 0;
      t.destroyTower();
      this.towers.splice(ti, 1);
      this.gridVersion++;
      this.pushHud();
      return;
    }
    const wi = this.walls.findIndex(w => w.tileX === tx && w.tileY === ty);
    if (wi >= 0) {
      const w = this.walls[wi];
      this.player.money += Math.floor(CFG.wall.cost * 0.5);
      w.destroy();
      this.walls.splice(wi, 1);
      this.grid[ty][tx] = 0; this.gridVersion++;
      this.pushHud();
    }
  }

  selectTower(t: Tower) {
    this.selectedTower = t;
    this.drawSelectionRing(t);
    this.buildTowerPanel(t);
  }

  deselectTower() {
    this.selectedTower = null;
    this.selectionRing.clear().setVisible(false);
    this.towerPanel.removeAll(true);
    this.towerPanel.setVisible(false);
  }

  drawSelectionRing(t: Tower) {
    const st = t.stats();
    const g = this.selectionRing;
    g.clear();
    g.lineStyle(2, 0x7cc4ff, 0.8);
    g.strokeCircle(t.x, t.y, st.range);
    g.lineStyle(1, 0x7cc4ff, 0.25);
    g.strokeCircle(t.x, t.y, st.range - 3);
    g.setVisible(true);
  }

  pointInPanel(wx: number, wy: number): boolean {
    if (!this.towerPanel.visible) return false;
    const b = this.towerPanelBounds;
    return wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h;
  }

  buildTowerPanel(t: Tower) {
    const panel = this.towerPanel;
    panel.removeAll(true);

    const W = 156, H = 74;
    const px = t.x;
    const py = t.y - CFG.tile * t.size / 2 - H / 2 - 10;
    panel.setPosition(px, py);
    panel.setVisible(true);
    this.towerPanelBounds = { x: px - W / 2, y: py - H / 2, w: W, h: H };

    const bg = this.add.rectangle(0, 0, W, H, 0x11172a, 0.95)
      .setStrokeStyle(2, 0x2a3760);
    panel.add(bg);

    // little pointer nub at the bottom
    const nub = this.add.triangle(0, H / 2 + 4, -6, -4, 6, -4, 0, 4, 0x11172a)
      .setStrokeStyle(1, 0x2a3760);
    panel.add(nub);

    // Title: LVL X
    const title = this.add.text(-W / 2 + 8, -H / 2 + 6, `${t.kind.toUpperCase()}  LVL ${t.level + 1}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#7cc4ff'
    });
    panel.add(title);

    // Sell label on the top-right
    const sellVal = Math.floor(t.totalSpent * 0.5);
    const sellLbl = this.add.text(W / 2 - 8, -H / 2 + 6, `SELL $${sellVal}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffa07a'
    }).setOrigin(1, 0);
    panel.add(sellLbl);

    // Current stats
    const st = t.stats();
    const splashLine = st.splashRadius > 0 ? `  AOE ${st.splashRadius}` : '';
    const stats = this.add.text(-W / 2 + 8, -H / 2 + 22,
      `DMG ${st.damage}  RNG ${st.range}${splashLine}\nFIRE ${(1000 / st.fireRate).toFixed(1)}/s  HP ${t.hp}/${t.maxHp}`,
      { fontFamily: 'monospace', fontSize: '10px', color: '#ccd' });
    panel.add(stats);

    // Upgrade button
    const btnW = 70, btnH = 20;
    const btnY = H / 2 - btnH / 2 - 4;
    const canUp = t.canUpgrade();
    const upCost = t.upgradeCost();
    const affordable = canUp && this.player.money >= upCost;
    const upLabel = canUp ? `UPGRADE $${upCost}` : 'MAX LEVEL';
    const upColor = !canUp ? 0x3a3a4a : affordable ? 0x2a6b3a : 0x5a2a2a;
    const upBg = this.add.rectangle(-W / 2 + btnW / 2 + 6, btnY, btnW, btnH, upColor)
      .setStrokeStyle(1, 0x556);
    const upTxt = this.add.text(upBg.x, upBg.y, upLabel, {
      fontFamily: 'monospace', fontSize: '10px',
      color: !canUp ? '#888' : affordable ? '#ffffff' : '#ff9a9a'
    }).setOrigin(0.5);
    if (canUp) {
      upBg.setInteractive({ useHandCursor: true });
      upBg.on('pointerdown', (_p: any, _lx: any, _ly: any, ev: any) => {
        ev?.stopPropagation?.();
        this.doUpgradeSelected();
      });
      upBg.on('pointerover', () => upBg.setFillStyle(affordable ? 0x3b8a4a : 0x7a3a3a));
      upBg.on('pointerout',  () => upBg.setFillStyle(upColor));
    }
    panel.add([upBg, upTxt]);

    // Sell button
    const sellBg = this.add.rectangle(W / 2 - btnW / 2 - 6, btnY, btnW, btnH, 0x5a2a2a)
      .setStrokeStyle(1, 0x556);
    const sellTxt = this.add.text(sellBg.x, sellBg.y, `SELL $${sellVal}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffd6c0'
    }).setOrigin(0.5);
    sellBg.setInteractive({ useHandCursor: true });
    sellBg.on('pointerdown', (_p: any, _lx: any, _ly: any, ev: any) => {
      ev?.stopPropagation?.();
      this.doSellSelected();
    });
    sellBg.on('pointerover', () => sellBg.setFillStyle(0x8a3a3a));
    sellBg.on('pointerout',  () => sellBg.setFillStyle(0x5a2a2a));
    panel.add([sellBg, sellTxt]);
  }

  doUpgradeSelected() {
    const t = this.selectedTower;
    if (!t) return;
    if (!t.canUpgrade()) return;
    const cost = t.upgradeCost();
    if (this.player.money < cost) {
      this.floatText(t.x, t.y - 20, `NEED $${cost}`, '#ff6a6a');
      return;
    }
    this.player.money -= cost;
    t.totalSpent += cost;
    t.upgrade();
    this.floatText(t.x, t.y - 24, `LVL ${t.level + 1}`, '#7cf29a');
    this.pushHud();
    // refresh ring + panel
    this.drawSelectionRing(t);
    this.buildTowerPanel(t);
  }

  doSellSelected() {
    const t = this.selectedTower;
    if (!t) return;
    this.player.money += Math.floor(t.totalSpent * 0.5);
    for (let j = 0; j < t.size; j++)
      for (let i = 0; i < t.size; i++)
        this.grid[t.tileY + j][t.tileX + i] = 0;
    const idx = this.towers.indexOf(t);
    if (idx >= 0) this.towers.splice(idx, 1);
    t.destroyTower();
    this.gridVersion++;
    this.deselectTower();
    this.pushHud();
  }

  floatText(x: number, y: number, msg: string, color: string) {
    const txt = this.add.text(x, y, msg, {
      fontFamily: 'monospace', fontSize: '12px', color,
      stroke: '#0b0f1a', strokeThickness: 3
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: txt,
      y: y - 18,
      alpha: { from: 1, to: 0 },
      duration: 700,
      ease: 'Sine.Out',
      onComplete: () => txt.destroy()
    });
  }

  worldToTile(x: number, y: number) {
    return { x: Math.floor(x / CFG.tile), y: Math.floor(y / CFG.tile) };
  }

  update(_realTime: number, delta: number) {
    if (this.gameOver) return;

    // Virtual time advances at timeMult speed; all downstream systems use it.
    const vd = delta * this.timeMult;
    this.vTime += vd;
    const time = this.vTime;

    // While dying, keep the world alive for the death animation but skip player input
    if (this.dying) {
      this.updateTowers(time);
      this.updateEnemies(time, vd);
      this.updateBoss(time);
      this.updateProjectiles(time);
      return;
    }

    // Ghost follow pointer
    if (this.buildKind !== 'none') {
      const p = this.input.activePointer;
      const tx = Math.floor(p.worldX / CFG.tile);
      const ty = Math.floor(p.worldY / CFG.tile);
      if (this.buildKind === 'tower') {
        const s = CFG.tower.tiles;
        const ox = s % 2 === 0
          ? Math.round(p.worldX / CFG.tile) - s / 2
          : Math.floor(p.worldX / CFG.tile) - Math.floor(s / 2);
        const oy = s % 2 === 0
          ? Math.round(p.worldY / CFG.tile) - s / 2
          : Math.floor(p.worldY / CFG.tile) - Math.floor(s / 2);
        this.ghost.setPosition((ox + s / 2) * CFG.tile, (oy + s / 2) * CFG.tile);
        this.ghost.setTint(this.canPlaceTower(ox, oy) ? 0x88ff88 : 0xff8888);
      } else {
        this.ghost.setPosition(tx * CFG.tile + CFG.tile / 2, ty * CFG.tile + CFG.tile / 2);
        const valid = tx >= 0 && ty >= 0 && tx < CFG.worldCols && ty < CFG.worldRows && this.grid[ty][tx] === 0;
        this.ghost.setTint(valid ? 0x88ff88 : 0xff8888);
      }
    }

    this.updatePlayer(time, vd);
    this.updateTowers(time);
    this.updateEnemies(time, vd);
    this.updateBoss(time);
    this.updateProjectiles(time);
    this.updateCoins(vd);
    this.updateSpawning(time, vd);
    this.checkEndConditions();
  }

  // ---------- PLAYER ----------
  updatePlayer(time: number, _delta: number) {
    const k = this.keys;
    let vx = 0, vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      this.player.setVelocity(vx * CFG.player.speed, vy * CFG.player.speed);
      this.player.setFlipX(vx < 0);
      if (this.player.anims.currentAnim?.key !== 'player-move') this.player.play('player-move');
    } else {
      this.player.setVelocity(0, 0);
      if (
        this.player.anims.currentAnim?.key !== 'player-idle' &&
        this.player.anims.currentAnim?.key !== 'player-shoot'
      ) this.player.play('player-idle');
    }

    // auto-shoot when stationary
    if (!moving && time > this.player.lastShot + CFG.player.fireRate) {
      const target = this.findNearestEnemy(this.player.x, this.player.y, CFG.player.range);
      if (target) {
        this.player.lastShot = time;
        this.player.play('player-shoot', true);
        this.player.once('animationcomplete-player-shoot', () => this.player.play('player-idle'));
        const dx = target.x - this.player.x;
        this.player.setFlipX(dx < 0);
        this.spawnProjectile(this.player.x, this.player.y, target.x, target.y, CFG.player.projectileSpeed, CFG.player.damage);
      }
    }
  }

  // ---------- TOWERS ----------
  updateTowers(time: number) {
    for (const tower of this.towers) {
      tower.drawHpBar();
      const st = tower.stats();
      const tgt = this.findNearestEnemy(tower.x, tower.y, st.range);
      if (!tgt) continue;
      const angle = Math.atan2(tgt.y - tower.y, tgt.x - tower.x);
      tower.top.setRotation(angle);
      if (time > tower.lastShot + st.fireRate) {
        tower.lastShot = time;
        tower.top.play(tower.kind === 'cannon' ? 'cannon-top-shoot' : 'tower-top-shoot', true);
        this.spawnProjectile(tower.x, tower.y, tgt.x, tgt.y, st.projectileSpeed, st.damage, st.splashRadius);
      }
    }
  }

  findNearestEnemy(x: number, y: number, range: number): Enemy | Boss | null {
    let best: Enemy | Boss | null = null;
    let bestD = range * range;
    this.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (!e || !e.active || e.dying) return true;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
      return true;
    });
    if (this.boss && this.boss.active && !this.boss.dying) {
      const d = (this.boss.x - x) ** 2 + (this.boss.y - y) ** 2;
      if (d < bestD) { bestD = d; best = this.boss; }
    }
    return best;
  }

  // ---------- ENEMIES ----------
  // Bresenham-style line check across the grid; true if any blocked tile is hit
  lineBlocked(x0: number, y0: number, x1: number, y1: number): boolean {
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
      if (y >= 0 && y < CFG.worldRows && x >= 0 && x < CFG.worldCols) {
        if (this.grid[y][x] === 1 && !(x === tx0 && y === ty0)) return true;
      }
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return false;
  }

  updateEnemies(time: number, _delta: number) {
    this.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (!e || !e.active || e.dying) return true;

      // choose target: nearest of player or tower
      let target: { x: number; y: number; ref: any } = { x: this.player.x, y: this.player.y, ref: this.player };
      let bestD = (this.player.x - e.x) ** 2 + (this.player.y - e.y) ** 2;
      for (const t of this.towers) {
        const d = (t.x - e.x) ** 2 + (t.y - e.y) ** 2;
        if (d < bestD) { bestD = d; target = { x: t.x, y: t.y, ref: t }; }
      }
      e.targetRef = target.ref;

      // attack range — bigger for towers since they're 3x3
      const attackRange = target.ref instanceof Tower ? CFG.tile * 2 : 30;
      const dist2ToTarget = (target.x - e.x) ** 2 + (target.y - e.y) ** 2;
      const prefix = e.kind === 'basic' ? 'eb' : 'eh';

      if (dist2ToTarget < attackRange * attackRange) {
        e.setVelocity(0, 0);
        if (e.anims.currentAnim?.key !== `${prefix}-atk`) e.play(`${prefix}-atk`);
        if (time > e.attackCd) {
          e.attackCd = time + 800;
          const r = target.ref;
          if (r === this.player) this.player.hurt(e.dmg, this);
          else if (r && typeof r.hurt === 'function') r.hurt(e.dmg);
          if (this.player.hp <= 0) this.lose();
        }
        return true;
      }

      // Direct chase if nothing is in the way — this feels like real tracking.
      const clear = !this.lineBlocked(e.x, e.y, target.x, target.y);
      if (clear) {
        const dx = target.x - e.x, dy = target.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
        e.setFlipX(dx < 0);
        e.path = [];
        if (e.anims.currentAnim?.key !== `${prefix}-move`) e.play(`${prefix}-move`);
        return true;
      }

      // Blocked by walls/towers — recompute path occasionally and follow it.
      if (time > e.lastPath + 400 || (e as any)._pv !== this.gridVersion || !e.path || e.path.length === 0) {
        e.lastPath = time;
        (e as any)._pv = this.gridVersion;
        const start = this.worldToTile(e.x, e.y);
        const goal = this.worldToTile(target.x, target.y);
        const saved = this.grid[goal.y] && this.grid[goal.y][goal.x];
        if (saved === 1) this.grid[goal.y][goal.x] = 0;
        e.path = findPath(this.grid, start.x, start.y, goal.x, goal.y);
        if (saved === 1) this.grid[goal.y][goal.x] = 1;
        e.pathIdx = 0;
      }

      if (e.path && e.path.length > 0) {
        if (e.pathIdx >= e.path.length) e.pathIdx = e.path.length - 1;
        // Look ahead: skip to the furthest node we have line-of-sight to.
        // This cuts the zig-zag from grid-aligned waypoints.
        let lookahead = e.pathIdx;
        for (let i = e.path.length - 1; i > e.pathIdx; i--) {
          const node = e.path[i];
          const nx = node.x * CFG.tile + CFG.tile / 2;
          const ny = node.y * CFG.tile + CFG.tile / 2;
          if (!this.lineBlocked(e.x, e.y, nx, ny)) { lookahead = i; break; }
        }
        e.pathIdx = lookahead;
        const node = e.path[e.pathIdx];
        const nx = node.x * CFG.tile + CFG.tile / 2;
        const ny = node.y * CFG.tile + CFG.tile / 2;
        const dx = nx - e.x, dy = ny - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 4 && e.pathIdx < e.path.length - 1) e.pathIdx++;
        if (d > 0.01) {
          e.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
          e.setFlipX(dx < 0);
        }
      } else {
        const dx = target.x - e.x, dy = target.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
        e.setFlipX(dx < 0);
      }
      if (e.anims.currentAnim?.key !== `${prefix}-move`) e.play(`${prefix}-move`);
      return true;
    });
  }

  // ---------- BOSS ----------
  chooseBossTarget(b: Boss) {
    let tx = this.player.x, ty = this.player.y, ref: any = this.player;
    let bestD = (this.player.x - b.x) ** 2 + (this.player.y - b.y) ** 2;
    for (const t of this.towers) {
      const d = (t.x - b.x) ** 2 + (t.y - b.y) ** 2;
      if (d < bestD) { bestD = d; tx = t.x; ty = t.y; ref = t; }
    }
    return { x: tx, y: ty, ref };
  }

  updateBoss(time: number) {
    const b = this.boss;
    if (!b || !b.active || b.dying) return;
    b.drawHpBar();

    // resolve state timers
    if (b.state === 'slam_wind' && time >= b.stateEnd) {
      this.bossSlamImpact(b);
      b.state = 'chase';
      b.nextSlam = time + 4200;
      b.play('boss-idle');
    } else if (b.state === 'charge_wind' && time >= b.stateEnd) {
      // Charge always aims at the player, ignoring towers.
      const dx = this.player.x - b.x, dy = this.player.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.chargeDirX = dx / d; b.chargeDirY = dy / d;
      b.state = 'charging';
      b.stateEnd = time + 1000;
      b.setVelocity(b.chargeDirX * 320, b.chargeDirY * 320);
      b.play('boss-move');
      // initial launch puff behind her (covers the "against a wall" case)
      this.spawnChargeSmoke(b, 3);
      b.lastSmoke = time;
    } else if (b.state === 'charging' && time >= b.stateEnd) {
      b.setVelocity(0, 0);
      this.bossChargeImpact(b);
      b.state = 'chase';
      b.nextCharge = time + 9500;
      b.play('boss-idle');
    }

    // Smoke trail while charging (throttled). Even if the boss isn't moving
    // (wall-locked), the initial puff already fired above.
    if (b.state === 'charging' && time > b.lastSmoke + 60) {
      b.lastSmoke = time;
      this.spawnChargeSmoke(b, 1);
    }

    // Mid-charge: bulldoze through anything in her path
    if (b.state === 'charging') {
      // Crush player if she runs over them
      if (b.contactCd < time &&
          Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) < 40) {
        const chargeDmg = Math.floor(CFG.player.hp * 0.55); // ~55% max HP
        this.player.hurt(chargeDmg, this);
        b.contactCd = time + 600; // don't double-tap within the same charge
        if (this.player.hp <= 0) this.lose();
      }
      // Instantly destroy any tower she barrels into
      for (const t of [...this.towers]) {
        if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < 50) {
          this.destroyTower(t);
        }
      }
    }

    if (b.state !== 'chase') return;

    const target = this.chooseBossTarget(b);
    const dx = target.x - b.x, dy = target.y - b.y;
    const dist = Math.hypot(dx, dy);

    // ability triggers (in priority order)
    // Birthing happens passively while chasing — no pause
    if (time >= b.nextBirth) {
      this.bossBirthSpawn(b);
      b.nextBirth = time + 3800;
    }
    const distToPlayer = Math.hypot(this.player.x - b.x, this.player.y - b.y);
    if (time >= b.nextCharge && distToPlayer > 40) {
      b.state = 'charge_wind';
      b.stateEnd = time + 1200;
      b.setVelocity(0, 0);
      b.play('boss-chargewind');
      return;
    }
    if (dist < 62 && time >= b.nextSlam) {
      b.state = 'slam_wind';
      b.stateEnd = time + 600;
      b.setVelocity(0, 0);
      b.play('boss-atk');
      return;
    }

    // walk toward target
    if (dist > 1) {
      b.setVelocity((dx / dist) * b.speed, (dy / dist) * b.speed);
      b.setFlipX(dx < 0);
    }
    if (b.anims.currentAnim?.key !== 'boss-move') b.play('boss-move');

    // passive contact damage (touching the player)
    if (
      Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) < 36 &&
      time > b.contactCd
    ) {
      b.contactCd = time + 700;
      this.player.hurt(b.dmg, this);
      if (this.player.hp <= 0) this.lose();
    }
  }

  bossSlamImpact(b: Boss) {
    const r = 56;
    if (Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) < r) {
      this.player.hurt(30, this);
      if (this.player.hp <= 0) this.lose();
    }
    for (const t of [...this.towers]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < r + 16) {
        t.hurt(35);
        if (t.hp <= 0) this.destroyTower(t);
      }
    }
    for (const w of [...this.walls]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, w.x, w.y) < r + 8) {
        w.hurt(40);
        if (w.hp <= 0) this.destroyWall(w);
      }
    }

    // Ground pound VFX — visible red/orange shockwave
    const slamCore = this.add.circle(b.x, b.y, r, 0xff4020, 0.5)
      .setDepth(14).setScale(0.15);
    this.tweens.add({
      targets: slamCore,
      scale: 1,
      alpha: { from: 0.55, to: 0 },
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => slamCore.destroy()
    });

    const slamRing = this.add.circle(b.x, b.y, r, 0x000000, 0)
      .setStrokeStyle(3, 0xff5030, 0.9)
      .setDepth(15).setScale(0.15);
    this.tweens.add({
      targets: slamRing,
      scale: 1.08,
      alpha: { from: 1, to: 0 },
      duration: 380,
      ease: 'Sine.Out',
      onComplete: () => slamRing.destroy()
    });

    // Debris chunks flying outward
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
      const dist = r * Phaser.Math.FloatBetween(0.6, 1.1);
      const col = [0xd94a2a, 0xff8a40, 0x8a4a2a, 0xffc060][i % 4];
      const sz = Phaser.Math.Between(2, 4);
      const chunk = this.add.rectangle(b.x, b.y, sz, sz, col, 1).setDepth(16);
      this.tweens.add({
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

    // Ground scorch
    const slamScorch = this.add.circle(b.x, b.y, r * 0.6, 0x1a0808, 0.45)
      .setDepth(2);
    this.tweens.add({
      targets: slamScorch,
      alpha: { from: 0.45, to: 0 },
      duration: 1000,
      ease: 'Sine.In',
      onComplete: () => slamScorch.destroy()
    });

    this.cameras.main.shake(200, 0.01);
  }

  spawnChargeSmoke(b: Boss, puffs: number) {
    // position behind the boss (opposite the charge direction)
    const backDist = 26;
    const baseX = b.x - b.chargeDirX * backDist;
    const baseY = b.y - b.chargeDirY * backDist + 4; // slight downward bias
    for (let i = 0; i < puffs; i++) {
      const jx = Phaser.Math.Between(-6, 6);
      const jy = Phaser.Math.Between(-4, 4);
      const r = Phaser.Math.Between(8, 12);
      const shade = [0x9a9aa8, 0xb8b8c4, 0x7e7e8a][i % 3];
      const puff = this.add.circle(baseX + jx, baseY + jy, r, shade, 0.7)
        .setDepth(8)
        .setStrokeStyle(1, 0x5a5a66, 0.5);
      // lazy drift opposite to charge + upward
      const driftX = -b.chargeDirX * 14 + Phaser.Math.Between(-6, 6);
      const driftY = -b.chargeDirY * 14 + Phaser.Math.Between(-14, -6);
      this.tweens.add({
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
  }

  bossChargeImpact(b: Boss) {
    const r = 80;
    if (Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) < r) {
      const chargeDmg = Math.floor(CFG.player.hp * 0.55);
      this.player.hurt(chargeDmg, this);
      if (this.player.hp <= 0) this.lose();
    }
    // Towers caught in the impact zone are instantly destroyed
    for (const t of [...this.towers]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < r) {
        this.destroyTower(t);
      }
    }
    for (const w of [...this.walls]) {
      if (Phaser.Math.Distance.Between(b.x, b.y, w.x, w.y) < r) {
        w.hurt(80);
        if (w.hp <= 0) this.destroyWall(w);
      }
    }
    const burst = this.add.sprite(b.x, b.y, 'fx_death_0').setDepth(15).setScale(3);
    burst.play('fx-death');
    burst.once('animationcomplete', () => burst.destroy());

    // Red shockwave showing AoE reach
    const core = this.add.circle(b.x, b.y, r, 0xff2020, 0.45)
      .setDepth(14).setScale(0.15);
    this.tweens.add({
      targets: core,
      scale: 1,
      alpha: { from: 0.5, to: 0 },
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy()
    });

    // Outer ring edge
    const ring = this.add.circle(b.x, b.y, r, 0x000000, 0)
      .setStrokeStyle(4, 0xff4040, 1)
      .setDepth(15).setScale(0.15);
    this.tweens.add({
      targets: ring,
      scale: 1.05,
      alpha: { from: 1, to: 0 },
      duration: 400,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
    });

    // Second fainter wave trailing behind
    const wave2 = this.add.circle(b.x, b.y, r, 0x000000, 0)
      .setStrokeStyle(2, 0xff6a3a, 0.7)
      .setDepth(14).setScale(0.1);
    this.tweens.add({
      targets: wave2,
      scale: 1.15,
      alpha: { from: 0.7, to: 0 },
      duration: 520,
      delay: 60,
      ease: 'Sine.Out',
      onComplete: () => wave2.destroy()
    });

    // Ground scorch
    const scorch = this.add.circle(b.x, b.y, r * 0.8, 0x1a0808, 0.5)
      .setDepth(2);
    this.tweens.add({
      targets: scorch,
      alpha: { from: 0.5, to: 0 },
      duration: 1400,
      ease: 'Sine.In',
      onComplete: () => scorch.destroy()
    });

    this.cameras.main.shake(360, 0.016);
  }

  bossBirthSpawn(b: Boss) {
    // emit 3 basic enemies from the boss's back with an upward spread
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.5;
      const dist = 18;
      const ex = b.x + Math.cos(a) * dist;
      const ey = b.y + Math.sin(a) * dist - 6;
      const kind: EnemyKind = Math.random() < 0.4 ? 'heavy' : 'basic';
      const e = new Enemy(this, ex, ey, kind);
      this.enemies.add(e);
      const body = e.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(a) * 120, Math.sin(a) * 120 - 40);
      // birth pop fx
      const pop = this.add.sprite(ex, ey, 'fx_pop_0').setDepth(15);
      pop.play('fx-pop');
      pop.once('animationcomplete', () => pop.destroy());
    }
  }

  destroyTower(t: Tower) {
    if (this.selectedTower === t) this.deselectTower();
    const idx = this.towers.indexOf(t);
    if (idx >= 0) this.towers.splice(idx, 1);
    for (let j = 0; j < t.size; j++)
      for (let i = 0; i < t.size; i++)
        this.grid[t.tileY + j][t.tileX + i] = 0;
    this.gridVersion++;
    const burst = this.add.sprite(t.x, t.y, 'fx_death_0').setDepth(15);
    burst.play('fx-death');
    burst.once('animationcomplete', () => burst.destroy());
    t.destroyTower();
  }
  destroyWall(w: Wall) {
    const idx = this.walls.indexOf(w);
    if (idx >= 0) this.walls.splice(idx, 1);
    this.grid[w.tileY][w.tileX] = 0;
    this.gridVersion++;
    w.destroy();
  }

  liveEnemyCount(): number {
    let n = 0;
    this.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (e && e.active && !e.dying) n++;
      return true;
    });
    return n;
  }

  spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    const W = CFG.worldCols * CFG.tile;
    const H = CFG.worldRows * CFG.tile;
    // spawn at the edge furthest from the player
    const corners = [
      { x: 60, y: 60 }, { x: W - 60, y: 60 },
      { x: 60, y: H - 60 }, { x: W - 60, y: H - 60 }
    ];
    let best = corners[0], bestD = 0;
    for (const c of corners) {
      const d = (c.x - this.player.x) ** 2 + (c.y - this.player.y) ** 2;
      if (d > bestD) { bestD = d; best = c; }
    }
    this.boss = new Boss(this, best.x, best.y);
    this.pushHud();
    this.physics.add.overlap(this.projectiles, this.boss, (a: any, b: any) => {
      const pr = (a instanceof Projectile ? a : b) as Projectile;
      const bs = (a instanceof Boss ? a : b) as Boss;
      this.projectileHitsBoss(pr, bs);
    });
    // Colliders: boss cannot phase through walls/towers. If the collision
    // happens while charging, slam the charge impact right where she stopped.
    const onStructureHit = () => {
      if (this.boss && this.boss.state === 'charging') {
        this.boss.stateEnd = 0; // updateBoss will fire bossChargeImpact next frame
      }
    };
    this.physics.add.collider(this.boss, this.wallGroup, onStructureHit);
    this.physics.add.collider(this.boss, this.towerGroup, onStructureHit);
    this.game.events.emit('boss-spawn', { hp: this.boss.hp, maxHp: this.boss.maxHp });
    this.countdownText.setText('THE BROOD MOTHER APPROACHES');
    this.countdownText.setColor('#ff5050');
    this.time.delayedCall(3000, () => {
      if (this.countdownText) this.countdownText.setText('');
    });
    this.cameras.main.shake(600, 0.012);
  }

  enemyHitsPlayer(e: Enemy) {
    if (!e.active || e.dying) return;
    if (this.vTime > e.attackCd) {
      e.attackCd = this.vTime + 700;
      this.player.hurt(e.dmg, this);
      if (this.player.hp <= 0) this.lose();
    }
  }

  enemyHitsWall(e: Enemy, w: Wall) {
    if (!e.active || e.dying) return;
    if (this.vTime > e.attackCd) {
      e.attackCd = this.vTime + 700;
      const prefix = e.kind === 'basic' ? 'eb' : 'eh';
      e.play(`${prefix}-atk`, true);
      w.hurt(e.dmg);
      if (w.hp <= 0) {
        const idx = this.walls.indexOf(w);
        if (idx >= 0) this.walls.splice(idx, 1);
        this.grid[w.tileY][w.tileX] = 0;
        this.gridVersion++;
        w.destroy();
      }
    }
  }

  enemyHitsTower(e: Enemy, t: Tower) {
    if (!e.active || e.dying) return;
    if (this.vTime > e.attackCd) {
      e.attackCd = this.vTime + 700;
      t.hurt(e.dmg);
      if (t.hp <= 0) {
        const idx = this.towers.indexOf(t);
        if (idx >= 0) this.towers.splice(idx, 1);
        for (let j = 0; j < t.size; j++) for (let i = 0; i < t.size; i++) this.grid[t.tileY + j][t.tileX + i] = 0;
        this.gridVersion++;
        const burst = this.add.sprite(t.x, t.y, 'fx_death_0').setDepth(15);
        burst.play('fx-death');
        burst.once('animationcomplete', () => burst.destroy());
        t.destroyTower();
      }
    }
  }

  // ---------- PROJECTILES ----------
  spawnProjectile(x: number, y: number, tx: number, ty: number, speed: number, dmg: number, splashRadius = 0) {
    const pr = new Projectile(this, x, y);
    this.projectiles.add(pr);
    pr.fire(tx, ty, speed, dmg, splashRadius);
  }

  updateProjectiles(time: number) {
    this.projectiles.children.iterate((c: any) => {
      const p = c as Projectile;
      if (!p || !p.active) return true;
      if (time - p.born > p.lifetime) p.destroy();
      return true;
    });
  }

  projectileHitsBoss(pr: Projectile, b: Boss) {
    if (!pr.active || !b.active || b.dying) return;
    b.hurt(pr.damage);
    const spark = this.add.sprite(pr.x, pr.y, 'fx_hit_0').setDepth(15);
    spark.play('fx-hit');
    spark.once('animationcomplete', () => spark.destroy());
    pr.destroy();
    this.game.events.emit('boss-hp', { hp: b.hp, maxHp: b.maxHp });
    if (b.dying) {
      // boss drops a big pile of gold
      const drops = 12;
      for (let i = 0; i < drops; i++) {
        const a = (i / drops) * Math.PI * 2;
        const d = Phaser.Math.Between(6, 22);
        const coin = new Coin(this, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 'gold');
        this.coins.add(coin);
      }
    }
  }

  projectileHitsEnemy(pr: Projectile, e: Enemy) {
    if (!pr.active || !e.active || e.dying) return;
    const splash = pr.splashRadius;
    const dmg = pr.damage;
    const ix = pr.x, iy = pr.y;

    if (splash > 0) {
      // AoE: damage everyone (including the initial hit enemy and boss) within radius
      this.cannonExplode(ix, iy, splash, dmg);
    } else {
      this.applyDamageToEnemy(e, dmg);
    }

    const spark = this.add.sprite(ix, iy, 'fx_hit_0').setDepth(15);
    spark.play('fx-hit');
    spark.once('animationcomplete', () => spark.destroy());
    pr.destroy();
  }

  // Damage a single enemy and handle its death drops/counts.
  applyDamageToEnemy(e: Enemy, dmg: number) {
    if (!e || !e.active || e.dying) return;
    e.hurt(dmg);
    if (e.hp <= 0) {
      const tier =
        e.kind === 'heavy'  ? 'silver' :
        e.kind === 'runner' ? 'bronze' :
                              'bronze';
      const coin = new Coin(this, e.x + Phaser.Math.Between(-4, 4), e.y + Phaser.Math.Between(-4, 4), tier);
      this.coins.add(coin);
      const burst = this.add.sprite(e.x, e.y, 'fx_death_0').setDepth(15);
      burst.play('fx-death');
      burst.once('animationcomplete', () => burst.destroy());
      this.player.kills++;
      this.waveKills++;
      this.pushHud();
    }
  }

  cannonExplode(x: number, y: number, radius: number, dmg: number) {
    // ---------- VISUALS ----------
    // 1) Bright white core flash (fast)
    const core = this.add.circle(x, y, radius * 0.55, 0xfff5c0, 0.95)
      .setDepth(16)
      .setScale(0.3);
    this.tweens.add({
      targets: core,
      scale: 1,
      alpha: { from: 1, to: 0 },
      duration: 160,
      ease: 'Sine.Out',
      onComplete: () => core.destroy()
    });

    // 2) Orange fireball layer
    const fire = this.add.circle(x, y, radius * 0.85, 0xff8a20, 0.85)
      .setDepth(15)
      .setScale(0.25);
    this.tweens.add({
      targets: fire,
      scale: 1,
      alpha: { from: 0.9, to: 0 },
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => fire.destroy()
    });

    // 3) Dark red outer shell for depth
    const shell = this.add.circle(x, y, radius, 0xc93010, 0.55)
      .setDepth(14)
      .setScale(0.2);
    this.tweens.add({
      targets: shell,
      scale: 1.05,
      alpha: { from: 0.7, to: 0 },
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => shell.destroy()
    });

    // 4) Expanding shockwave ring outline
    const ring = this.add.circle(x, y, radius, 0x000000, 0)
      .setStrokeStyle(3, 0xffd070, 0.95)
      .setDepth(17)
      .setScale(0.2);
    this.tweens.add({
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
      const s = this.add.circle(x, y, Phaser.Math.Between(2, 3), sparkColor, 1).setDepth(18);
      this.tweens.add({
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
      const puff = this.add.circle(px, py, Phaser.Math.Between(8, 13), shade, 0.65)
        .setStrokeStyle(1, 0x2a2a32, 0.4)
        .setDepth(13)
        .setScale(0.4);
      const driftX = Phaser.Math.Between(-10, 10);
      const driftY = Phaser.Math.Between(-20, -8); // smoke rises
      // small delay so smoke emerges as the fire dies down
      this.tweens.add({
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

    // 7) Scorch mark that lingers briefly on the ground
    const scorch = this.add.circle(x, y, radius * 0.7, 0x1a1214, 0.55)
      .setDepth(2);
    this.tweens.add({
      targets: scorch,
      alpha: { from: 0.55, to: 0 },
      duration: 1200,
      ease: 'Sine.In',
      onComplete: () => scorch.destroy()
    });

    this.cameras.main.shake(140, 0.006);

    // Damage all enemies in radius
    const r2 = radius * radius;
    const hitList: Enemy[] = [];
    this.enemies.children.iterate((c: any) => {
      const en = c as Enemy;
      if (!en || !en.active || en.dying) return true;
      const dx = en.x - x, dy = en.y - y;
      if (dx * dx + dy * dy <= r2) hitList.push(en);
      return true;
    });
    for (const en of hitList) this.applyDamageToEnemy(en, dmg);

    // Also chip the boss if in range
    if (this.boss && this.boss.active && !this.boss.dying) {
      const dx = this.boss.x - x, dy = this.boss.y - y;
      if (dx * dx + dy * dy <= r2) this.boss.hurt(Math.floor(dmg * 0.6));
    }
  }

  // ---------- COINS ----------
  updateCoins(delta: number) {
    const dt = delta / 1000;
    this.coins.children.iterate((c: any) => {
      const coin = c as Coin;
      if (!coin || !coin.active) return true;
      const dx = this.player.x - coin.x;
      const dy = this.player.y - coin.y;
      const d = Math.hypot(dx, dy);
      if (d < 18) {
        // collect
        this.player.money += coin.value;
        this.pushHud();
        const pop = this.add.sprite(coin.x, coin.y, 'fx_pop_0').setDepth(15);
        pop.play('fx-pop');
        pop.once('animationcomplete', () => pop.destroy());
        coin.destroy();
        return true;
      }
      if (d < CFG.coin.magnetRange) {
        const speed = CFG.coin.magnetSpeed * (1 - d / CFG.coin.magnetRange + 0.2);
        coin.x += (dx / d) * speed * dt;
        coin.y += (dy / d) * speed * dt;
      }
      return true;
    });
  }

  // ---------- SPAWNING ----------
  updateSpawning(time: number, delta: number) {
    // initial build phase — show countdown, don't spawn anything yet
    if (time < this.waveStartAt) {
      const secs = Math.ceil((this.waveStartAt - time) / 1000);
      this.countdownText.setText(`BUILD PHASE — wave 1 in ${secs}`);
      this.countdownText.setColor('#7cc4ff');
      return;
    }

    const waveSize = CFG.spawn.waveSize;
    const lastWaveIdx = CFG.spawn.waveCount - 1;
    const isLastWave = this.wave >= lastWaveIdx;

    // Boss already out — nothing to show/spawn here
    if (this.bossSpawned) {
      if (this.countdownText.text) this.countdownText.setText('');
      return;
    }

    // Between-wave build break
    if (time < this.waveBreakUntil) {
      const secs = Math.ceil((this.waveBreakUntil - time) / 1000);
      this.countdownText.setText(`WAVE ${this.wave + 1} IN ${secs}`);
      this.countdownText.setColor('#7cc4ff');
      return;
    }

    // Boss lead-in: only on the final wave once every enemy has been spawned.
    if (isLastWave && this.waveSpawned >= waveSize) {
      const live = this.liveEnemyCount();
      const left = Math.max(live, waveSize - this.waveKills);
      if (left > 0) {
        this.countdownText.setText(`KILL THE STRAGGLERS — ${left} LEFT`);
        this.countdownText.setColor('#ff9a4a');
      } else {
        if (this.bossCountdownUntil === 0) {
          this.bossCountdownUntil = time + CFG.boss.prepTime;
        }
        if (time >= this.bossCountdownUntil) {
          this.spawnBoss();
          return;
        }
        const secs = Math.ceil((this.bossCountdownUntil - time) / 1000);
        this.countdownText.setText(`BROOD MOTHER SPAWNING IN ${secs}`);
        this.countdownText.setColor('#ff5050');
      }
      return;
    }

    // Non-last wave finished → start build break, advance wave counter.
    if (!isLastWave && this.waveSpawned >= waveSize && this.waveKills >= waveSize) {
      this.wave++;
      this.waveSpawned = 0;
      this.waveKills = 0;
      this.waveBreakUntil = time + CFG.spawn.waveBreak;
      return;
    }

    // Active wave — show progress banner.
    this.countdownText.setText(`WAVE ${this.wave + 1} — ${this.waveKills}/${waveSize}`);
    this.countdownText.setColor('#eee');

    // Ramp difficulty, spawn until this wave's quota is met.
    this.spawnTimer += delta;
    this.rampTimer += delta;
    if (this.rampTimer > CFG.spawn.rampEvery) {
      this.rampTimer = 0;
      this.spawnInterval = Math.max(CFG.spawn.minInterval, this.spawnInterval * CFG.spawn.rampFactor);
      this.heavyChance = Math.min(CFG.spawn.heavyChanceMax, this.heavyChance + CFG.spawn.heavyChanceStep);
    }
    if (this.spawnTimer > this.spawnInterval && this.waveSpawned < waveSize) {
      this.spawnTimer = 0;
      this.spawnEnemy();
      this.waveSpawned++;
    }

    // Runner pack bursts, independent of the normal spawn cadence.
    if (this.wave >= CFG.spawn.runnerPackStartWave && this.waveSpawned < waveSize) {
      if (this.nextRunnerPack === 0) {
        this.nextRunnerPack = time + Phaser.Math.Between(
          CFG.spawn.runnerPackCooldownMin, CFG.spawn.runnerPackCooldownMax);
      } else if (time >= this.nextRunnerPack) {
        this.spawnRunnerPack();
        this.nextRunnerPack = time + Phaser.Math.Between(
          CFG.spawn.runnerPackCooldownMin, CFG.spawn.runnerPackCooldownMax);
      }
    }
  }

  spawnRunnerPack() {
    const W = CFG.worldCols * CFG.tile;
    const H = CFG.worldRows * CFG.tile;
    const waveSize = CFG.spawn.waveSize;
    const side = Phaser.Math.Between(0, 3);
    let cx = 0, cy = 0;
    if (side === 0) { cx = Phaser.Math.Between(60, W - 60); cy = 8; }
    if (side === 1) { cx = Phaser.Math.Between(60, W - 60); cy = H - 8; }
    if (side === 2) { cx = 8; cy = Phaser.Math.Between(60, H - 60); }
    if (side === 3) { cx = W - 8; cy = Phaser.Math.Between(60, H - 60); }
    const n = CFG.spawn.runnerPackSize;
    for (let i = 0; i < n && this.waveSpawned < waveSize; i++) {
      const ox = Phaser.Math.Between(-28, 28);
      const oy = Phaser.Math.Between(-28, 28);
      const e = new Enemy(this, cx + ox, cy + oy, 'runner');
      this.enemies.add(e);
      this.waveSpawned++;
    }
  }

  spawnEnemy() {
    const W = CFG.worldCols * CFG.tile;
    const H = CFG.worldRows * CFG.tile;
    const side = Phaser.Math.Between(0, 3);
    let x = 0, y = 0;
    if (side === 0) { x = Phaser.Math.Between(0, W); y = 8; }
    if (side === 1) { x = Phaser.Math.Between(0, W); y = H - 8; }
    if (side === 2) { x = 8; y = Phaser.Math.Between(0, H); }
    if (side === 3) { x = W - 8; y = Phaser.Math.Between(0, H); }
    const kind: EnemyKind = Math.random() < this.heavyChance ? 'heavy' : 'basic';
    const e = new Enemy(this, x, y, kind);
    this.enemies.add(e);
  }

  // ---------- END ----------
  winDelayUntil = 0;

  checkEndConditions() {
    // Level is won by defeating the boss, not by a kill count.
    if (this.bossSpawned && (!this.boss || this.boss.dying || !this.boss.active)) {
      // Start a 5s collection window so the player can grab coins
      if (this.winDelayUntil === 0) {
        this.winDelayUntil = this.vTime + 5000;
        this.countdownText.setText('VICTORY! Collect your loot!');
        this.countdownText.setColor('#7cf29a');
      } else if (this.vTime >= this.winDelayUntil) {
        this.win();
      }
    }
  }

  dying = false;

  lose() {
    if (this.gameOver || this.dying) return;
    this.dying = true;

    // Stop the player but keep the scene running for the death animation
    this.player.setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;

    // Kill any existing tweens on the player (e.g. hurt flash) to avoid conflicts
    this.tweens.killTweensOf(this.player);

    this.cameras.main.shake(300, 0.012);

    const deathX = this.player.x;
    const deathY = this.player.y;

    // Instantly hide the player sprite — no rotation/shrink
    this.player.setVisible(false);

    // White flash at death point
    const flash = this.add.circle(deathX, deathY, 30, 0xffffff, 0.95).setDepth(19);
    this.tweens.add({
      targets: flash,
      scale: 2.5,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy()
    });

    // Pixel explosion — chunky coloured squares flying outward
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const d = Phaser.Math.Between(28, 60);
      const col = [0xff4040, 0xff8060, 0x4a90e2, 0xf2c79a, 0xffffff, 0xffcc40][i % 6];
      const sz = Phaser.Math.Between(3, 6);
      const p = this.add.rectangle(deathX, deathY, sz, sz, col, 1).setDepth(20);
      this.tweens.add({
        targets: p,
        x: deathX + Math.cos(a) * d,
        y: deathY + Math.sin(a) * d - Phaser.Math.Between(5, 20),
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(500, 800),
        ease: 'Cubic.Out',
        onComplete: () => p.destroy()
      });
    }

    // Camera zoom on death spot
    this.cameras.main.zoomTo(1.3, 800);

    // Gravestone pops up from the ground after particles settle
    setTimeout(() => {
      if (!this.scene.isActive()) return;

      // Simple cross (lowercase 't' shape)
      const grave = this.add.container(deathX, deathY + 4).setDepth(10);
      const vertical = this.add.rectangle(0, 0, 4, 18, 0x6a6a78)
        .setStrokeStyle(1, 0x3e4654);
      const horizontal = this.add.rectangle(0, -5, 12, 4, 0x6a6a78)
        .setStrokeStyle(1, 0x3e4654);
      // Small dirt mound
      const dirt = this.add.ellipse(0, 10, 18, 6, 0x3e2310);
      grave.add([dirt, vertical, horizontal]);

      // Pop up from below
      grave.setScale(0.3);
      grave.y += 14;
      this.tweens.add({
        targets: grave,
        y: deathY + 4,
        scale: 1,
        duration: 400,
        ease: 'Back.Out'
      });
    }, 900);

    // Show defeat screen after the full animation (real-time)
    setTimeout(() => {
      if (!this.scene.isActive()) return;
      this.gameOver = true;
      this.physics.pause();
      this.game.events.emit('game-end', {
        win: false, name: this.playerName,
        kills: this.player.kills, money: this.player.money
      });
    }, 3500);
  }
  win() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    this.game.events.emit('game-end', { win: true, name: this.playerName, kills: this.player.kills, money: this.player.money });
  }
}
