import Phaser from 'phaser';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { CFG } from '../config';
import { saveMedal, LEVELS } from '../levels';
import { SFX } from '../audio/sfx';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { UpgradePanel } from '../ui/UpgradePanel';
import { loadEndlessBest, saveEndlessBest, RunStatsSnapshot } from '../state/RunStats';
import type { Boss } from '../entities/Boss';
import type { Tower } from '../entities/Tower';
import type { GameScene } from './GameScene';
import type { GameEndState } from '../core/registry';
import type { Biome, Difficulty } from '../levels';
import type { BossHpPayload, BossSpawnPayload, HudState } from '../core/events';

type SelectableContainer = Phaser.GameObjects.Container & {
  setSelected?: (selected: boolean) => void;
};

type UISceneInitData = {
  levelId?: number;
  difficulty?: Difficulty;
};

export class UIScene extends Phaser.Scene {
  hpBarGfx!: Phaser.GameObjects.Graphics;
  private hpBarX = 0; private hpBarY = 0; private hpBarW = 0; private hpBarH = 0;
  nameText!: Phaser.GameObjects.Text;
  moneyText!: Phaser.GameObjects.Text;
  btnTower!: SelectableContainer;
  btnCannon!: SelectableContainer;
  btnMage!: Phaser.GameObjects.Container;
  btnWall!: SelectableContainer;
  btnSpeed!: Phaser.GameObjects.Container;
  speedLabel!: Phaser.GameObjects.Text;
  speedIdx = 0;
  endPanel?: Phaser.GameObjects.Container;
  pauseMenu?: Phaser.GameObjects.Container;
  menuButton?: Phaser.GameObjects.Container;
  bossBarGfx?: Phaser.GameObjects.Graphics;
  private bossBarX = 0; private bossBarY = 0; private bossBarW = 0; private bossBarH = 0;
  private bossBarMaxHp = 1;
  bossLabel?: Phaser.GameObjects.Text;
  waveBarGfx!: Phaser.GameObjects.Graphics;
  private waveBarX = 0; private waveBarY = 0; private waveBarW = 0; private waveBarH = 0;
  waveLabel!: Phaser.GameObjects.Text;
  progressCircles: Phaser.GameObjects.Arc[] = [];
  progressLabels: Phaser.GameObjects.Text[] = [];
  /** One Graphics overlay per node — draws a tiny skull (eyes + mouth)
   *  for boss nodes. Avoids the unreliable centering of the ☠ unicode
   *  glyph in the browser's monospace fallback font. Hidden on non-boss
   *  nodes; the underlying Text label handles those. */
  progressIcons: Phaser.GameObjects.Graphics[] = [];
  progressLines: Phaser.GameObjects.Rectangle[] = [];
  progressContainer!: Phaser.GameObjects.Container;
  countdownText!: Phaser.GameObjects.Text;
  buildErrorText!: Phaser.GameObjects.Text;
  buildHintText!: Phaser.GameObjects.Text;

  /** Off-screen markers — drawn here so they sit above the HUD elements
   *  rather than under them (would happen if drawn in GameScene since
   *  scenes layer in registration order). */
  private towerIndicators = new Map<Tower, { bg: Phaser.GameObjects.Sprite; ptr: Phaser.GameObjects.Sprite }>();
  private bossIndicators = new Map<Boss, { bg: Phaser.GameObjects.Sprite; ptr: Phaser.GameObjects.Sprite }>();
  private upgradePanel: UpgradePanel | null = null;
  private upgradeBtnAnchor: { x: number; y: number; w: number; h: number } | null = null;
  private upgradesLocked = false;
  private upgradesLockOverlay: Phaser.GameObjects.Graphics | null = null;

  /** Speed-cycle lock state — true while the tutorial is running. Locks the
   *  speed hotbar slot, the SPACE keybind, and the new `5` keybind. */
  private speedLocked = false;
  private speedLockOverlay: Phaser.GameObjects.Graphics | null = null;
  private readonly onHud = (s: HudState) => this.updateHud(s);
  private readonly onGameEnd = (s: GameEndState) => this.showEnd(s);
  private readonly onBossSpawn = (s: BossSpawnPayload) => this.showBossBar(s);
  private readonly onBossHp = (s: BossHpPayload) => this.updateBossBar(s);
  private readonly onBossDied = () => this.hideBossBar();
  private readonly onTutorialSpeedUnlocked = () => {
    this.speedLocked = false;
    if (this.speedLockOverlay) {
      this.speedLockOverlay.destroy();
      this.speedLockOverlay = null;
    }
  };
  private readonly onTutorialFinished = () => {
    this.speedLocked = false;
    if (this.speedLockOverlay) {
      this.speedLockOverlay.destroy();
      this.speedLockOverlay = null;
    }
    this.upgradesLocked = false;
    if (this.upgradesLockOverlay) {
      this.upgradesLockOverlay.destroy();
      this.upgradesLockOverlay = null;
    }
  };
  private readonly onBuildError = (msg: string) => {
    if (msg) {
      this.buildErrorText.setText(msg).setVisible(true);
    } else {
      this.buildErrorText.setVisible(false);
    }
  };
  private readonly onBuildMode = (active: boolean, kind?: string, towerKind?: string) => {
    this.buildHintText.setVisible(active);
    if (!active) this.buildErrorText.setVisible(false);
    this.btnTower.setSelected?.(active && kind === 'tower' && towerKind === 'arrow');
    this.btnCannon.setSelected?.(active && kind === 'tower' && towerKind === 'cannon');
    this.btnWall.setSelected?.(active && kind === 'wall');
  };

  levelId = 1;
  difficulty: Difficulty = 'easy';
  biome: Biome = 'grasslands';

  /** Scale factor for native resolution rendering */
  private sf = 1;
  /** Scale a base-resolution value to native */
  p(v: number) { return v * this.sf; }
  /** Convert a 1-indexed cumulative wave number into the display number
   *  shown to the player. In endless mode, every 4th wave is a boss
   *  event that doesn't get a number — so the visible sequence reads
   *  1, 2, 3, [boss], 4, 5, 6, [boss], 7, 8, 9, ... For non-endless
   *  difficulties this is a no-op (the number is shown as-is). */
  private displayWaveNum(cumulativeWave: number): number {
    if (this.difficulty !== 'endless') return cumulativeWave;
    return cumulativeWave - Math.floor(cumulativeWave / 4);
  }
  /** Draw a small skull-and-jaw icon into the given Graphics object,
   *  centered on its local origin. Used as the boss marker in the
   *  progress strip — Graphics-drawn so it always centers cleanly,
   *  unlike the ☠ unicode glyph which depends on the browser's
   *  monospace font fallback. */
  private drawSkullIcon(g: Phaser.GameObjects.Graphics, color: number) {
    g.clear();
    const p = this.p.bind(this);
    const dark = 0x0a0510;
    // Cranium — round skull top
    g.fillStyle(color, 1);
    g.fillCircle(0, -p(0.5), p(3.5));
    // Jaw — narrower rectangle below the cranium
    g.fillRect(-p(2.4), p(1.5), p(4.8), p(2));
    // Eye sockets — two dark circles cut into the cranium
    g.fillStyle(dark, 1);
    g.fillCircle(-p(1.4), -p(0.6), p(1));
    g.fillCircle(+p(1.4), -p(0.6), p(1));
    // Tiny nose hole
    g.fillRect(-p(0.4), p(0.5), p(0.8), p(0.8));
    // Tooth grid: dark mouth bar with three light vertical teeth on top
    g.fillRect(-p(1.9), p(1.7), p(3.8), p(1.5));
    g.fillStyle(color, 1);
    g.fillRect(-p(1.4), p(1.7), p(0.3), p(1.5));
    g.fillRect(-p(0.15), p(1.7), p(0.3), p(1.5));
    g.fillRect(+p(1.1), p(1.7), p(0.3), p(1.5));
  }
  /** Build a font-size string at scaled resolution */
  fs(px: number) { return `${Math.round(px * this.sf)}px`; }
  /** Design-space width (canvas divided by uiScale) — how many base units of
   *  horizontal room the UI has. Elements sized in base units must fit inside
   *  this number or they overflow the canvas. */
  private dw() { return this.scale.width / this.sf; }
  /** Design-space height. */
  private dh() { return this.scale.height / this.sf; }
  /** Mobile flag (from registry). */
  private isMobile = false;
  /** Virtual joystick (mobile only). */
  private joystick: VirtualJoystick | null = null;

  constructor() { super({ key: 'UI', active: false }); }

  init(data: UISceneInitData) {
    this.levelId = data?.levelId ?? 1;
    this.difficulty = data?.difficulty ?? 'easy';
    const levelDef = LEVELS.find(l => l.id === this.levelId);
    this.biome = levelDef?.biome ?? 'grasslands';
    this.endPanel = undefined;
    this.pauseMenu = undefined;
    this.menuButton = undefined;
    this.bossBarGfx = undefined;
    this.bossLabel = undefined;
    this.towerIndicators = new Map();
    this.bossIndicators = new Map();
    // Restore speedIdx if a prior incarnation persisted it (e.g. across a
    // viewport-driven scene restart on rotation). Default to 0 for fresh runs.
    this.speedIdx = (getRegistry(this.game).get('uiSpeedIdx') as number) ?? 0;
  }

  create() {
    this.sf = getRegistry(this.game).get('sf') || 1;
    this.isMobile = !!getRegistry(this.game).get('isMobile');
    const W = this.scale.width;
    const H = this.scale.height;
    const T = this.p(20); // top padding

    // top-left HUD — bar is 25% narrower on mobile to leave room for the
    // centered wave bar. On portrait mobile the bar nudges up ~5px to tuck
    // closer under the Ranger label (label stays put).
    this.nameText = this.add.text(this.p(12), T, '', { fontFamily: 'monospace', fontSize: this.fs(14), color: '#7cc4ff' });
    const hpBarBaseW = this.isMobile ? 135 : 180;
    const isPortraitMobile = this.isMobile && H > W;
    const hpBarYOffset = isPortraitMobile ? this.p(17) : this.p(22);
    this.hpBarX = this.p(12);
    this.hpBarY = T + hpBarYOffset;
    this.hpBarW = this.p(hpBarBaseW);
    this.hpBarH = this.p(14);
    this.hpBarGfx = this.add.graphics();

    // Top-right gold badge (WoW-style, rounded). On portrait mobile, shift
    // right so the rightmost element (the coin circle, which extends to
    // coinX+p(25)) aligns with the right edge of the centered wave bar at
    // W-p(20).
    const coinX = isPortraitMobile ? W - this.p(45) : W - this.p(60);
    const coinY = T + this.p(14);
    // Dark inset panel behind the number — rounded corners
    const gbW = this.p(80), gbH = this.p(26), gbR = this.p(6);
    const gbX = coinX + this.p(6) - gbW, gbY = coinY - gbH / 2;
    const gbGfx = this.add.graphics();
    gbGfx.fillStyle(0x0b0f1a, 0.85);
    gbGfx.fillRoundedRect(gbX, gbY, gbW, gbH, gbR);
    gbGfx.lineStyle(this.p(1.5), 0x5a4a1a, 0.7);
    gbGfx.strokeRoundedRect(gbX, gbY, gbW, gbH, gbR);
    // Gold coin circle
    this.add.circle(coinX + this.p(12), coinY, this.p(13), 0x8a6a1a).setStrokeStyle(this.p(2), 0xc4a030);
    this.add.circle(coinX + this.p(12), coinY, this.p(9), 0xd4a820).setStrokeStyle(this.p(1), 0xffd84a);
    this.add.text(coinX + this.p(12), coinY, '$', {
      fontFamily: 'monospace', fontSize: this.fs(12), fontStyle: 'bold', color: '#1a1000',
    }).setOrigin(0.5);
    // Money amount text
    this.moneyText = this.add.text(coinX - this.p(2), coinY, '0', {
      fontFamily: 'monospace', fontSize: this.fs(15), fontStyle: 'bold', color: '#ffd84a',
      stroke: '#0b0f1a', strokeThickness: this.p(3),
    }).setOrigin(1, 0.5);

    // Upgrades button — sits directly to the left of the money badge.
    const upgW = this.p(96), upgH = this.p(26), upgR = this.p(6);
    const upgX = gbX - this.p(6) - upgW, upgY = coinY - upgH / 2;
    const upgGfx = this.add.graphics();
    upgGfx.fillStyle(0x0b0f1a, 0.85);
    upgGfx.fillRoundedRect(upgX, upgY, upgW, upgH, upgR);
    upgGfx.lineStyle(this.p(1.5), 0x6cd47a, 0.7);
    upgGfx.strokeRoundedRect(upgX, upgY, upgW, upgH, upgR);
    this.add.text(upgX + upgW / 2, coinY, '▲ UPGRADES', {
      fontFamily: 'monospace', fontSize: this.fs(11), fontStyle: 'bold', color: '#dfffe8',
      stroke: '#0b0f1a', strokeThickness: this.p(2),
    }).setOrigin(0.5);
    this.add.rectangle(upgX + upgW / 2, coinY, upgW, upgH, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openUpgradePanel());
    this.upgradeBtnAnchor = { x: upgX, y: upgY, w: upgW, h: upgH };

    // Lock the UPGRADES button during the tutorial — paired with the
    // speed-slot lock above. The `tutorial-finished` listener tears the
    // overlay back off and clears the flag.
    this.upgradesLocked = !!getRegistry(this.game).get('tutorialActive');
    if (this.upgradesLocked) {
      this.upgradesLockOverlay = this.buildUpgradesLockOverlay();
    }
    const menuX = this.isMobile ? this.p(44) : this.p(12 + 82 / 2);
    const menuY = this.isMobile ? T + this.p(58) : H - this.p(44);
    this.menuButton = this.makeMenuButton(menuX, menuY);

    // Bottom-center minimal hotbar (#7 style — slots with labels below)
    const slotSize = this.p(48);
    const slotGap = this.p(10);
    const slots = 5;
    const hotbarY = H - slotSize - this.p(32); // extra room for labels below
    const barCenterX = W / 2;

    const slotX = (i: number) => barCenterX - (slots * slotSize + (slots - 1) * slotGap) / 2 + i * (slotSize + slotGap) + slotSize / 2;

    this.btnTower = this.makeHotbarSlot(slotX(0), hotbarY, slotSize, slotSize, '1', 'arrow', 'ARROW', '$60',
      () => getEvents(this.game.events).emit('ui-build', 'tower', 'arrow'));
    // Cannon is locked on the meadow level (intro) — unlocks from forest on.
    const cannonLocked = this.levelId === 1;
    this.btnCannon = this.makeHotbarSlot(slotX(1), hotbarY, slotSize, slotSize, '2', 'cannon', 'CANNON', '$60',
      cannonLocked
        ? () => { /* locked on meadow */ }
        : () => getEvents(this.game.events).emit('ui-build', 'tower', 'cannon'));
    this.btnMage = this.makeHotbarSlot(slotX(2), hotbarY, slotSize, slotSize, '3', 'mage', 'MAGE', '$80',
      () => { /* locked — mage tower not yet implemented */ });

    /** Build the padlock + dim overlay used on locked hotbar slots. */
    const buildLockOverlay = () => {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, this.p(3));
      const lx = 0, ly = this.p(2);
      g.fillStyle(0x8a8a8a, 0.9);
      g.fillRoundedRect(lx - this.p(7), ly, this.p(14), this.p(10), this.p(2));
      g.lineStyle(this.p(2.5), 0x8a8a8a, 0.9);
      g.beginPath();
      g.arc(lx, ly - this.p(1), this.p(5), Math.PI, 0, false);
      g.strokePath();
      g.fillStyle(0x222222, 1);
      g.fillCircle(lx, ly + this.p(4), this.p(2));
      g.fillRect(lx - this.p(1), ly + this.p(5), this.p(2), this.p(3));
      return g;
    };
    this.btnMage.add(buildLockOverlay());
    if (cannonLocked) this.btnCannon.add(buildLockOverlay());
    this.btnWall = this.makeHotbarSlot(slotX(3), hotbarY, slotSize, slotSize, '4', 'wall', 'WALL', `$${CFG.wall.cost}`,
      () => getEvents(this.game.events).emit('ui-build', 'wall'));
    this.btnSpeed = this.makeHotbarSlot(slotX(4), hotbarY, slotSize, slotSize, 'SPC', 'speed', 'SPEED', '',
      () => { if (!this.speedLocked) this.cycleSpeed(); });
    // Speed cycle text overlay — initial text matches the persisted speedIdx
    // so a restart (e.g. viewport rotation) doesn't desync from GameScene.
    const speedLabels = ['>', '>>', '>>>'];
    this.speedLabel = this.add.text(0, 0, speedLabels[this.speedIdx] ?? '>', {
      fontFamily: 'monospace', fontSize: this.fs(16), fontStyle: 'bold', color: '#c4a850',
      stroke: '#0a0e1a', strokeThickness: this.p(3),
    }).setOrigin(0.5);
    this.btnSpeed.add(this.speedLabel);

    // Speed is locked during the tutorial. Lock state survives the lock
    // overlay so SPACE / 5 / hotbar-click all share the same gate; the
    // `tutorial-finished` listener tears the overlay back off.
    this.speedLocked = !!getRegistry(this.game).get('tutorialActive');
    if (this.speedLocked) {
      this.speedLockOverlay = buildLockOverlay();
      this.btnSpeed.add(this.speedLockOverlay);
    }

    const tryCycleSpeed = () => {
      // While a build mode is active, SPACE bails out of build instead of
      // cycling speed — gives the player a quick exit during wall/tower
      // placement without reaching for ESC. (Property paths matter: the
      // earlier `game.buildKind` / `game.setBuild` aliases never existed,
      // so this branch was silently dead and SPACE always cycled speed.)
      const game = this.scene.get('Game') as GameScene;
      if (game.buildState.kind !== 'none') {
        game.build.setBuild('none');
        return;
      }
      if (!this.speedLocked) this.cycleSpeed();
    };
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', tryCycleSpeed);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      if (this.pauseMenu) this.hidePauseMenu();
      else this.showPauseMenu();
    });

    // Level progress graphic (wave circles + boss skull)
    this.progressCircles = [];
    this.progressLabels = [];
    this.progressIcons = [];
    this.progressLines = [];
    // Endless mode: 6 rolling nodes (current wave + next 5). Updated
    // dynamically in updateHud.
    // Castle/Desert: 4 waves + two boss skulls = 6 nodes
    // Others: waveCount waves + 1 boss = waveCount+1 nodes
    const hasTwoBossProgress = this.biome === 'castle' || this.biome === 'desert';
    const totalNodes = this.difficulty === 'endless' ? 6
      : hasTwoBossProgress ? 6
      : CFG.spawn.waveCount + 1;
    const nodeSpacing = this.p(36);
    const totalW = (totalNodes - 1) * nodeSpacing;
    const startX = (W - totalW) / 2;
    const nodeY = T;
    const nodeR = this.p(9);
    const items: Phaser.GameObjects.GameObject[] = [];

    for (let i = 0; i < totalNodes; i++) {
      const nx = startX + i * nodeSpacing;
      // connecting line to next node
      if (i < totalNodes - 1) {
        const line = this.add.rectangle(nx + nodeR + this.p(2), nodeY, nodeSpacing - nodeR * 2 - this.p(4), this.p(2), 0x2a3760).setOrigin(0, 0.5);
        this.progressLines.push(line);
        items.push(line);
      }
      // circle
      const circle = this.add.circle(nx, nodeY, nodeR, 0x11172a).setStrokeStyle(this.p(2), 0x2a3760);
      this.progressCircles.push(circle);
      items.push(circle);
      // label (number or skull)
      // Castle/Desert: nodes 2 and 5 are boss skulls
      // Endless: labels are dynamic \u2014 placeholder, updateHud sets them
      const isBoss = this.difficulty === 'endless' ? false
        : hasTwoBossProgress ? (i === 2 || i === 5)
        : i === totalNodes - 1;
      const waveNum = hasTwoBossProgress
        ? (i < 2 ? i + 1 : i === 2 ? 0 : i < 5 ? i : 0) // 1,2,skull,3,4,skull
        : i + 1;
      const label = this.add.text(nx, nodeY, isBoss ? '' : `${waveNum}`, {
        fontFamily: 'monospace', fontSize: this.fs(10), color: '#556',
      }).setOrigin(0.5);
      // Boss icon \u2014 drawn as Graphics so it doesn't depend on the
      // browser's font-fallback metrics for the \u2620 glyph. Hidden when
      // the node isn't a boss node.
      const icon = this.add.graphics().setPosition(nx, nodeY);
      this.drawSkullIcon(icon, 0x556a78);
      icon.setVisible(isBoss);
      this.progressIcons.push(icon);
      label.setVisible(!isBoss);
      this.progressLabels.push(label);
      items.push(label, icon);
    }
    this.progressContainer = this.add.container(0, 0, items);

    // Countdown text (shares space with progress graphic — only one visible at a time)
    this.countdownText = this.add.text(W / 2, nodeY, '', {
      fontFamily: 'monospace', fontSize: this.fs(18), color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: this.p(4)
    }).setOrigin(0.5).setVisible(false);

    // Wave progress bar (centered, same position as boss bar). Clamp to the
    // available design width so it doesn't overflow narrow mobile canvases.
    const waveBarBaseW = Math.min(420, this.dw() - 40);
    const barW = this.p(waveBarBaseW);
    const barX = (W - barW) / 2;
    const barY = T + this.p(38);
    this.waveLabel = this.add.text(W / 2, barY - this.p(16), 'WAVE 1', {
      fontFamily: 'monospace', fontSize: this.fs(14), color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: this.p(3)
    }).setOrigin(0.5);
    this.waveBarX = barX;
    this.waveBarY = barY;
    this.waveBarW = barW;
    this.waveBarH = this.p(14);
    this.waveBarGfx = this.add.graphics();

    // Build error message (persistent while hovering invalid tile)
    const hotbarTop = H - this.p(48) - this.p(32); // matches hotbarY
    this.buildErrorText = this.add.text(W / 2, hotbarTop - this.p(18), '', {
      fontFamily: 'monospace', fontSize: this.fs(13), color: '#ff6a6a',
      stroke: '#0b0f1a', strokeThickness: this.p(3),
      backgroundColor: '#1a0a0aCC',
      padding: { x: Number(this.p(10)), y: Number(this.p(4)) }
    }).setOrigin(0.5, 1).setDepth(900).setVisible(false);

    // Build mode cancel hint
    this.buildHintText = this.add.text(W / 2, hotbarTop - this.p(38),
      this.isMobile
        ? 'Tap selected item again to leave build menu'
        : 'Right-click, B, or ESC to leave build menu',
      {
        fontFamily: 'monospace', fontSize: this.fs(12), color: '#c8d8e8',
        stroke: '#0b0f1a', strokeThickness: this.p(3),
        backgroundColor: '#11172aDD', padding: { x: Number(this.p(8)), y: Number(this.p(4)) }
      }
    ).setOrigin(0.5, 1).setDepth(900).setVisible(false);

    // listen for HUD updates
    getEvents(this.game.events).on('hud', this.onHud);
    getEvents(this.game.events).on('game-end', this.onGameEnd);
    getEvents(this.game.events).on('boss-spawn', this.onBossSpawn);
    getEvents(this.game.events).on('boss-hp', this.onBossHp);
    getEvents(this.game.events).on('boss-died', this.onBossDied);
    // game_speed tutorial step fires this so the player can press the
    // speed slot while reading its prompt (the broader UPGRADES lock
    // stays on until tutorial-finished).
    getEvents(this.game.events).on('tutorial-speed-unlocked', this.onTutorialSpeedUnlocked);
    // Tutorial wrapped — drop the UPGRADES lock (speed already unlocked
    // a step earlier). Also a safety net for the speed slot in case a
    // skip-path bypassed game_speed entirely.
    getEvents(this.game.events).on('tutorial-finished', this.onTutorialFinished);
    getEvents(this.game.events).on('build-error', this.onBuildError);
    getEvents(this.game.events).on('build-mode', this.onBuildMode);

    // Recover the end-panel after a UI restart (e.g. mid-rotation): if the
    // game already ended and we missed the live event, replay it now.
    const gameEndState = getRegistry(this.game).get('gameEndState');
    if (gameEndState) this.showEnd(gameEndState);

    // Pull the current HUD state from GameScene so the HP / wave bars
    // render at their real values immediately on rotation, instead of
    // showing as empty until the next hud event fires.
    const game = this.scene.get('Game') as GameScene;
    this.updateHud(game.hudState());

    // Re-apply the active build-mode highlight after a UI restart (rotation),
    // since the new hotbar slots default to !isSelected. Also reshow the
    // build hint text if a build is in progress.
    const activeKind = game.buildState.kind;
    const activeTowerKind = game.buildState.towerKind;
    if (activeKind && activeKind !== 'none') {
      this.btnTower.setSelected?.(activeKind === 'tower' && activeTowerKind === 'arrow');
      this.btnCannon.setSelected?.(activeKind === 'tower' && activeTowerKind === 'cannon');
      this.btnWall.setSelected?.(activeKind === 'wall');
      this.buildHintText.setVisible(true);
    }

    // GameScene runs setGameSize during its create() and immediately
    // schedules a UIScene restart so the HUD lays out at the final size.
    // On that throwaway first pass we skip one-time side effects (intro
    // toasts) — they'd fire against the wrong layout, set their
    // localStorage flags, and then get cancelled by the restart, eating
    // the player's only chance to see them.
    const bootingForResize = !!getRegistry(this.game).get('uiBootingForResize');

    // First time the player drops into the forest level (level 2), pop a
    // 6-second tooltip introducing the now-unlocked cannon tower. Flag is
    // stored in localStorage so it only fires once across sessions.
    if (!bootingForResize && this.levelId === 2 && localStorage.getItem('td_seen_forest_intro') !== 'true') {
      this.showForestIntroToast();
      localStorage.setItem('td_seen_forest_intro', 'true');
    }

    // First time the player drops into the infected level (level 3),
    // warn them about ranged enemies — toads here, mosquitos and others
    // later — and explain that some projectiles arc over walls/towers
    // while others get blocked.
    if (!bootingForResize && this.levelId === 3 && localStorage.getItem('td_seen_infected_intro') !== 'true') {
      this.showInfectedIntroToast();
      localStorage.setItem('td_seen_infected_intro', 'true');
    }

    // First time the player drops into the castle level (level 5), warn
    // them about the unique 2-boss / 4-wave structure so they pace
    // resources accordingly (mid-boss after wave 2, final after wave 4).
    if (!bootingForResize && this.levelId === 5 && localStorage.getItem('td_seen_castle_intro') !== 'true') {
      this.showCastleIntroToast();
      localStorage.setItem('td_seen_castle_intro', 'true');
    }


    // ---- Mobile virtual joystick (lower-left) ----
    if (this.isMobile) {
      const outerR = this.p(60);
      const innerR = this.p(28);
      // Portrait: lift the joystick above the bottom hotbar (slot top at
      // H - p(80), labels extend below to ~H - p(18)). Landscape: hotbar is
      // horizontally centered with no overlap on the left, so we can sit lower.
      const isPortraitNow = this.scale.height > this.scale.width;
      const margin = this.p(isPortraitNow ? 130 : 60);
      const cx = this.p(40) + outerR;
      const cy = H - margin - outerR;
      const touchPad = this.p(20);
      this.joystick = new VirtualJoystick(this, cx, cy, outerR, innerR, outerR + touchPad);

      // Publish the joystick's screen-space hit rect so GameScene can ignore
      // taps in this region (otherwise tapping the stick during build mode
      // would also fire handleClick and try to place a tower under your thumb).
      const halfSize = outerR + touchPad;
      getRegistry(this.game).set('joystickBounds', {
        x: cx - halfSize,
        y: cy - halfSize,
        w: halfSize * 2,
        h: halfSize * 2,
      });
    }

    // Publish joystick state to the registry every frame so GameScene can read
    // it from updatePlayer without coupling the two scenes through events.
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (this.joystick) {
        getRegistry(this.game).set('joystickX', this.joystick.x);
        getRegistry(this.game).set('joystickY', this.joystick.y);
      }
    });

    // If a boss is alive (e.g. we just restarted on rotation), rebuild the
    // boss bar from registry state since boss-spawn is one-shot and we missed
    // the original event.
    if (getRegistry(this.game).get('bossActive')) {
      const bossMaxHp = getRegistry(this.game).get('bossMaxHp') || 1;
      const bossHp = getRegistry(this.game).get('bossHp') || 0;
      const biome = getRegistry(this.game).get('bossBiome') ?? this.biome;
      this.showBossBar({ hp: bossHp, maxHp: bossMaxHp, biome });
      this.updateBossBar({ hp: bossHp, maxHp: bossMaxHp });
    }

    // Re-layout on rotation / window resize. Restarting cleanly rebuilds every
    // element at the new uiScale; shutdown() above unbinds the listeners so
    // they don't accumulate across restarts.
    const onViewportChanged = () => {
      // Clear joystick state so the player doesn't drift after restart.
      getRegistry(this.game).set('joystickX', 0);
      getRegistry(this.game).set('joystickY', 0);
      if (this.scene.isActive('UI')) this.scene.restart();
    };
    getEvents(this.game.events).on('viewport-changed', onViewportChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      getEvents(this.game.events).off('viewport-changed', onViewportChanged);
    });
  }

  showBossBar(s: BossSpawnPayload) {
    const W = this.scale.width;
    const barW = this.p(Math.min(420, this.dw() - 40));
    const x = (W - barW) / 2;
    const y = this.p(58); // 20 (top pad) + 38
    // Destroy previous boss bar if any (for multi-boss levels like Castle)
    this.hideBossBar();

    // First time the player ever sees a boss spawn (always the meadow's
    // Ancient Ram, even during the tutorial), pop a quick warning so they
    // know bosses are dangerous and will smash structures.
    if (s?.biome === 'grasslands' && localStorage.getItem('td_seen_first_boss_intro') !== 'true') {
      this.showFirstBossIntroToast();
      localStorage.setItem('td_seen_first_boss_intro', 'true');
    }
    const bossName = s?.bossKind === 'queen' ? 'THE PHANTOM QUEEN'
                   : s?.bossKind === 'dragon' ? 'THE CASTLE DRAGON'
                   : s?.bossKind === 'fissure_burrower' ? 'THE FISSURE BURROWER'
                   : s?.bossKind === 'desert_scorpion' ? 'THE GIANT SCORPION'
                   : s?.bossKind === 'sandstorm_beast' ? 'THE SANDSTORM BEAST'
                   : s?.bossKind === 'dune_wraith' ? 'THE DUNE WRAITH'
                   : s?.bossKind === 'temple_construct' ? 'THE TEMPLE CONSTRUCT'
                   : s?.bossKind === 'sun_priest' ? 'THE SUN PRIEST'
                   : s?.biome === 'forest' ? 'THE WENDIGO'
                   : s?.biome === 'infected' ? 'THE BLIGHTED ONE'
                   : s?.biome === 'river' ? 'THE FOG PHANTOM'
                   : 'THE ANCIENT RAM';
    this.bossLabel = this.add.text(W / 2, y - this.p(16), bossName, {
      fontFamily: 'monospace', fontSize: this.fs(14), color: '#ff6a6a',
      stroke: '#0b0f1a', strokeThickness: this.p(3)
    }).setOrigin(0.5);
    this.bossBarX = x;
    this.bossBarY = y;
    this.bossBarW = barW;
    this.bossBarH = this.p(14);
    this.bossBarMaxHp = s?.maxHp ?? 1;
    this.bossBarGfx = this.add.graphics();
    // Draw immediately at full HP so the bar appears the moment the boss spawns
    this.updateBossBar({ hp: this.bossBarMaxHp, maxHp: this.bossBarMaxHp });
  }

  hideBossBar() {
    if (this.bossBarGfx) { this.bossBarGfx.destroy(); this.bossBarGfx = undefined; }
    if (this.bossLabel) { this.bossLabel.destroy(); this.bossLabel = undefined; }
  }

  updateBossBar(s: BossHpPayload) {
    if (!this.bossBarGfx) return;
    const maxHp = this.bossBarMaxHp || s.maxHp || 1;
    const pct = Math.max(0, (s.hp ?? 0) / maxHp);
    const x = this.bossBarX, y = this.bossBarY, w = this.bossBarW, h = this.bossBarH;
    const r = this.p(5);
    const bossColor = pct > 0.5 ? 0xd94a4a : pct > 0.25 ? 0xd97a4a : 0xff3030;
    this.bossBarGfx.clear();
    this.bossBarGfx.fillStyle(0x11172a, 1);
    this.bossBarGfx.fillRoundedRect(x, y, w, h, r);
    this.bossBarGfx.lineStyle(this.p(1.5), 0x6a2a2a, 0.8);
    this.bossBarGfx.strokeRoundedRect(x, y, w, h, r);
    const fillW = (w - this.p(4)) * pct;
    if (fillW > 0) {
      this.bossBarGfx.fillStyle(bossColor, 1);
      this.bossBarGfx.fillRoundedRect(x + this.p(2), y + this.p(2), fillW, h - this.p(4), r - this.p(1));
    }
  }

  cycleSpeed() {
    const speeds = [1.25, 2, 3.75];
    const labels = ['>', '>>', '>>>'];
    this.speedIdx = (this.speedIdx + 1) % speeds.length;
    this.speedLabel.setText(labels[this.speedIdx]);
    getEvents(this.game.events).emit('ui-speed', speeds[this.speedIdx]);
    // Persist so a viewport-driven scene restart preserves the chosen speed.
    getRegistry(this.game).set('uiSpeedIdx', this.speedIdx);
  }

  makeButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0x2a3760).setStrokeStyle(this.p(1), 0x556);
    const t = this.add.text(0, 0, label, { fontFamily: 'monospace', fontSize: this.fs(12), color: '#fff' }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { SFX.play('click'); onClick(); });
    bg.on('pointerover', () => bg.setFillStyle(0x3b4d84));
    bg.on('pointerout', () => bg.setFillStyle(0x2a3760));
    c.add([bg, t]);
    return c;
  }

  private makeMenuButton(cx: number, cy: number) {
    const text = this.isMobile ? 'MENU' : 'MENU (M)';
    const w = this.p(this.isMobile ? 62 : 82);
    const h = this.p(28);
    const c = this.add.container(cx, cy).setDepth(960);
    const g = this.add.graphics();
    let hover = false;
    const draw = () => {
      g.clear();
      g.fillStyle(hover ? 0x141c30 : 0x0a0e1a, 0.95);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, this.p(5));
      g.lineStyle(this.p(1.5), hover ? 0xc4a030 : 0x8a6a20, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, this.p(5));
    };
    draw();

    const label = this.add.text(0, 0, text, {
      fontFamily: 'monospace', fontSize: this.fs(11), fontStyle: 'bold',
      color: '#ffd84a', stroke: '#0b0f1a', strokeThickness: this.p(2),
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      SFX.play('click');
      if (this.pauseMenu) this.hidePauseMenu();
      else this.showPauseMenu();
    });
    hit.on('pointerover', () => { hover = true; draw(); });
    hit.on('pointerout', () => { hover = false; draw(); });
    c.add([g, label, hit]);
    return c;
  }

  private makePauseMenuButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    accent: number,
    color: string,
    onClick: () => void,
  ) {
    const g = this.add.graphics();
    let hover = false;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const draw = () => {
      g.clear();
      g.fillStyle(hover ? 0x1a2238 : 0x0b0f1a, 0.95);
      g.fillRoundedRect(x, y, w, h, this.p(7));
      g.lineStyle(this.p(1.5), accent, hover ? 1 : 0.85);
      g.strokeRoundedRect(x, y, w, h, this.p(7));
    };
    draw();
    const text = this.add.text(cx, cy, label, {
      fontFamily: 'monospace', fontSize: this.fs(14), fontStyle: 'bold',
      color, stroke: '#0b0f1a', strokeThickness: this.p(2),
    }).setOrigin(0.5);
    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      SFX.play('click');
      onClick();
    });
    hit.on('pointerover', () => { hover = true; draw(); });
    hit.on('pointerout', () => { hover = false; draw(); });
    return [g, text, hit];
  }

  private showPauseMenu() {
    if (this.pauseMenu || this.endPanel) return;
    getEvents(this.game.events).emit('ui-pause');
    this.renderPauseMenuMain();
  }

  private renderPauseMenuMain() {
    const W = this.scale.width;
    const H = this.scale.height;
    const accent = 0xc4a030;
    const titleHex = '#ffd84a';
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.62).setOrigin(0);

    const boxW = Math.min(this.p(360), W - this.p(32));
    const boxH = this.p(282);
    const boxX = W / 2 - boxW / 2;
    const boxY = H / 2 - boxH / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x11172a, 0.97);
    panel.fillRoundedRect(boxX, boxY, boxW, boxH, this.p(10));
    panel.lineStyle(this.p(1), 0x2a3760, 0.7);
    panel.strokeRoundedRect(boxX + this.p(3), boxY + this.p(3), boxW - this.p(6), boxH - this.p(6), this.p(8));
    panel.lineStyle(this.p(2), accent, 0.9);
    panel.strokeRoundedRect(boxX, boxY, boxW, boxH, this.p(10));

    const title = this.add.text(W / 2, boxY + this.p(42), 'PAUSED', {
      fontFamily: 'monospace', fontSize: this.fs(30), fontStyle: 'bold',
      color: titleHex, stroke: '#0b0f1a', strokeThickness: this.p(4),
    }).setOrigin(0.5);

    const btnW = Math.min(this.p(190), boxW - this.p(52));
    const btnH = this.p(40);
    const resumeItems = this.makePauseMenuButton(W / 2, boxY + this.p(105), btnW, btnH, 'RESUME', 0x4ad96a, '#7cf29a', () => this.hidePauseMenu());
    const controlsItems = this.makePauseMenuButton(W / 2, boxY + this.p(158), btnW, btnH, 'CONTROLS', 0x7cc4ff, '#a8d1ff', () => this.showControlsMenu());
    const mapItems = this.makePauseMenuButton(W / 2, boxY + this.p(211), btnW, btnH, 'RETURN TO MAP', 0xc4a030, titleHex, () => {
      this.scene.stop('Game');
      this.scene.stop('UI');
      this.scene.start('LevelSelect');
    });

    this.pauseMenu = this.add.container(0, 0, [bg, panel, title, ...resumeItems, ...controlsItems, ...mapItems]).setDepth(1200);
  }

  private showControlsMenu() {
    if (!this.pauseMenu) return;
    this.pauseMenu.destroy();

    const W = this.scale.width;
    const H = this.scale.height;
    const accent = 0x7cc4ff;
    const titleHex = '#a8d1ff';
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.62).setOrigin(0);
    const boxW = Math.min(this.p(this.isMobile ? 500 : 560), W - this.p(32));
    const boxH = Math.min(this.p(this.isMobile ? 340 : 370), H - this.p(36));
    const boxX = W / 2 - boxW / 2;
    const boxY = H / 2 - boxH / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x11172a, 0.97);
    panel.fillRoundedRect(boxX, boxY, boxW, boxH, this.p(10));
    panel.lineStyle(this.p(1), 0x2a3760, 0.7);
    panel.strokeRoundedRect(boxX + this.p(3), boxY + this.p(3), boxW - this.p(6), boxH - this.p(6), this.p(8));
    panel.lineStyle(this.p(2), accent, 0.9);
    panel.strokeRoundedRect(boxX, boxY, boxW, boxH, this.p(10));

    const title = this.add.text(W / 2, boxY + this.p(38), 'CONTROLS', {
      fontFamily: 'monospace', fontSize: this.fs(26), fontStyle: 'bold',
      color: titleHex, stroke: '#0b0f1a', strokeThickness: this.p(4),
    }).setOrigin(0.5);
    const controls = this.isMobile
      ? [
          ['Move ranger', 'On-screen joystick'],
          ['Choose build item', 'Tap Arrow, Cannon, Wall, or Speed slot'],
          ['Place build item', 'Tap a valid tile'],
          ['Place/select tower', 'Tap the map or an existing tower'],
          ['Leave build menu', 'Tap the selected hotbar item again'],
          ['Pause/menu', 'Tap MENU'],
        ]
      : [
          ['Move ranger', 'WASD or Arrow Keys'],
          ['Choose build item', '1 Arrow Tower, 2 Cannon, 4 Wall'],
          ['Place/select tower', 'Left-click'],
          ['Leave build menu', 'Right-click, B, or ESC'],
          ['Cycle speed', 'Space or hotbar speed slot'],
          ['Pause/menu', 'M or MENU button'],
        ];
    const lineTop = boxY + this.p(80);
    const lineGap = this.p(this.isMobile ? 38 : 34);
    const labelX = boxX + this.p(34);
    const valueX = boxX + this.p(this.isMobile ? 176 : 188);
    const items: Phaser.GameObjects.GameObject[] = [bg, panel, title];
    controls.forEach(([label, value], i) => {
      const y = lineTop + i * lineGap;
      items.push(this.add.text(labelX, y, label, {
        fontFamily: 'monospace', fontSize: this.fs(12), fontStyle: 'bold',
        color: '#ffd84a', stroke: '#0b0f1a', strokeThickness: this.p(2),
      }).setOrigin(0, 0.5));
      items.push(this.add.text(valueX, y, value, {
        fontFamily: 'monospace', fontSize: this.fs(this.isMobile ? 11 : 12),
        color: '#e8edf8', stroke: '#0b0f1a', strokeThickness: this.p(2),
        wordWrap: { width: boxX + boxW - valueX - this.p(28), useAdvancedWrap: true },
      }).setOrigin(0, 0.5));
    });
    const btnW = Math.min(this.p(170), boxW - this.p(52));
    const btnH = this.p(40);
    const backItems = this.makePauseMenuButton(W / 2, boxY + boxH - this.p(44), btnW, btnH, 'BACK', 0xc4a030, '#ffd84a', () => {
      this.pauseMenu?.destroy();
      this.renderPauseMenuMain();
    });
    items.push(...backItems);
    this.pauseMenu = this.add.container(0, 0, items).setDepth(1200);
  }

  private hidePauseMenu() {
    if (!this.pauseMenu) return;
    this.pauseMenu.destroy();
    this.pauseMenu = undefined;
    getEvents(this.game.events).emit('ui-resume');
  }

  makeHotbarSlot(cx: number, topY: number, w: number, h: number, key: string, icon: string, name: string, cost: string, onClick: () => void): SelectableContainer {
    const my = topY + h / 2;
    const c = this.add.container(cx, my) as SelectableContainer;

    const g = this.add.graphics();
    let isHover = false;
    let isSelected = false;
    const drawSlot = () => {
      g.clear();
      // Outer glow ring + thicker border when this slot's build kind is the
      // active one (mobile only — desktop has the keybind badge / right-click
      // affordance to communicate selection).
      if (isSelected && this.isMobile) {
        g.lineStyle(this.p(2), 0xffd84a, 0.5);
        g.strokeRoundedRect(-w / 2 - this.p(3), -h / 2 - this.p(3), w + this.p(6), h + this.p(6), this.p(5));
        g.lineStyle(this.p(1.5), 0xffd84a, 0.25);
        g.strokeRoundedRect(-w / 2 - this.p(5), -h / 2 - this.p(5), w + this.p(10), h + this.p(10), this.p(6));
      }
      // Slot fill
      g.fillStyle(isHover ? 0x141c30 : 0x0a0e1a, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, this.p(3));
      // Gold border — thicker / brighter when selected on mobile.
      const borderW = (isSelected && this.isMobile) ? this.p(3) : this.p(1.5);
      const borderColor = (isSelected && this.isMobile)
        ? 0xffd84a
        : (isHover ? 0xc4a030 : 0x8a6a20);
      g.lineStyle(borderW, borderColor, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, this.p(3));
      // Inner glow
      g.lineStyle(this.p(1), isHover ? 0xa08830 : 0xa08030, isHover ? 0.2 : 0.12);
      g.strokeRoundedRect(-w / 2 + this.p(2), -h / 2 + this.p(2), w - this.p(4), h - this.p(4), this.p(2));
    };
    drawSlot();

    // Hit area
    const hitRect = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hitRect.on('pointerdown', () => { SFX.play('click'); onClick(); });
    hitRect.on('pointerover', () => { isHover = true; drawSlot(); });
    hitRect.on('pointerout', () => { isHover = false; drawSlot(); });

    // Draw icon
    const iconG = this.add.graphics();
    this.drawSlotIcon(iconG, icon);

    // Keybind badge (top-left corner) — desktop only; the keys it displays
    // (1/2/3/4/SPC) don't apply on touch devices.
    const items: Phaser.GameObjects.GameObject[] = [g, hitRect, iconG];
    if (!this.isMobile) {
      const badgeW = key.length > 2 ? this.p(22) : this.p(13);
      const badgeBg = this.add.rectangle(-w / 2 + badgeW / 2 + this.p(1), -h / 2 + this.p(7), badgeW, this.p(12), 0x0a0e1a, 0.9)
        .setStrokeStyle(this.p(0.5), 0x8a6a20, 0.5);
      const badge = this.add.text(-w / 2 + badgeW / 2 + this.p(1), -h / 2 + this.p(7), key, {
        fontFamily: 'monospace', fontSize: this.fs(8), color: '#a08830',
      }).setOrigin(0.5);
      items.push(badgeBg, badge);
    }

    // Name label below slot
    const nameLabel = this.add.text(0, h / 2 + this.p(4), name, {
      fontFamily: 'monospace', fontSize: this.fs(8), color: '#8a9ab0',
    }).setOrigin(0.5, 0);

    items.push(nameLabel);

    // Cost label below name
    if (cost) {
      const costLabel = this.add.text(0, h / 2 + this.p(14), cost, {
        fontFamily: 'monospace', fontSize: this.fs(8), color: '#ffd84a',
      }).setOrigin(0.5, 0);
      items.push(costLabel);
    }

    c.add(items);
    // Expose a setter so the build-mode listener can highlight this slot
    // when it matches the active build kind.
    c.setSelected = (sel: boolean) => { isSelected = sel; drawSlot(); };
    return c;
  }

  drawSlotIcon(g: Phaser.GameObjects.Graphics, icon: string) {
    const cx = 0, cy = 0;
    const s = this.sf;
    switch (icon) {
      case 'arrow': {
        // Arrow shaft (diagonal)
        g.lineStyle(2.5 * s, 0xc4a850, 1);
        g.lineBetween(cx + 10 * s, cy + 10 * s, cx - 8 * s, cy - 8 * s);
        // Arrowhead
        g.fillStyle(0xc4a850, 1);
        g.fillTriangle(cx - 12 * s, cy - 12 * s, cx - 4 * s, cy - 10 * s, cx - 10 * s, cy - 2 * s);
        // Fletching
        g.lineStyle(1.5 * s, 0xa08830, 0.8);
        g.lineBetween(cx + 10 * s, cy + 10 * s, cx + 12 * s, cy + 6 * s);
        g.lineBetween(cx + 10 * s, cy + 10 * s, cx + 6 * s, cy + 12 * s);
        break;
      }
      case 'cannon': {
        // Cannonball shadow
        g.fillStyle(0x1a1a1a, 0.5);
        g.fillCircle(cx + 1 * s, cy + 2 * s, 9 * s);
        // Main ball
        g.fillStyle(0x2a2a2a, 1);
        g.fillCircle(cx, cy, 9 * s);
        // Subtle gradient layers
        g.fillStyle(0x3a3a3a, 1);
        g.fillCircle(cx - 1 * s, cy - 1 * s, 8 * s);
        // Primary light reflection (top-left)
        g.fillStyle(0x606060, 0.7);
        g.fillCircle(cx - 3 * s, cy - 3 * s, 4 * s);
        // Bright highlight spot
        g.fillStyle(0x8a8a8a, 0.6);
        g.fillCircle(cx - 4 * s, cy - 4 * s, 2 * s);
        // Small specular dot
        g.fillStyle(0xbbbbbb, 0.5);
        g.fillCircle(cx - 4.5 * s, cy - 4.5 * s, 1 * s);
        break;
      }
      case 'mage': {
        // Staff
        g.lineStyle(2.5 * s, 0x8a6adf, 1);
        g.lineBetween(cx, cy - 10 * s, cx, cy + 10 * s);
        // Orb glow
        g.fillStyle(0xb090ff, 0.3);
        g.fillCircle(cx, cy - 10 * s, 5 * s);
        // Orb
        g.fillStyle(0xb090ff, 0.9);
        g.fillCircle(cx, cy - 10 * s, 3.5 * s);
        g.fillStyle(0xd0c0ff, 1);
        g.fillCircle(cx, cy - 10 * s, 2 * s);
        // Specular
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(cx - 1 * s, cy - 11 * s, 1 * s);
        // Side wisps
        g.lineStyle(1 * s, 0x9a7aef, 0.5);
        g.lineBetween(cx, cy - 6 * s, cx - 4 * s, cy - 9 * s);
        g.lineBetween(cx, cy - 6 * s, cx + 4 * s, cy - 9 * s);
        g.fillStyle(0xb090ff, 0.4);
        g.fillCircle(cx - 4 * s, cy - 9 * s, 1 * s);
        g.fillCircle(cx + 4 * s, cy - 9 * s, 1 * s);
        // Staff base
        g.lineStyle(2 * s, 0x8a6adf, 1);
        g.lineBetween(cx - 3 * s, cy + 10 * s, cx + 3 * s, cy + 10 * s);
        break;
      }
      case 'wall': {
        // 3-row brick wall matching HTML mockup SVG layout
        // SVG viewBox is 28x28, icon area +-14 from center
        const bw = 11 * s, bh = 6 * s;
        const colors = [0xb0a080, 0x8a7a60];
        const ox = cx - 14 * s; // origin offset to match SVG viewBox 0,0
        const oy = cy - 14 * s;
        // Row 0 (y=4): two full-width bricks
        g.fillStyle(colors[0], 1); g.fillRect(ox + 2 * s, oy + 4 * s, bw, bh);
        g.fillStyle(colors[1], 1); g.fillRect(ox + 15 * s, oy + 4 * s, bw, bh);
        // Row 1 (y=11): offset — half brick, full brick, half brick
        g.fillStyle(colors[1], 1); g.fillRect(ox + 8 * s, oy + 11 * s, bw, bh);
        g.fillStyle(colors[0], 1); g.fillRect(ox + 2 * s, oy + 11 * s, 5 * s, bh);
        g.fillStyle(colors[0], 1); g.fillRect(ox + 20 * s, oy + 11 * s, 6 * s, bh);
        // Row 2 (y=18): two full-width bricks
        g.fillStyle(colors[0], 1); g.fillRect(ox + 2 * s, oy + 18 * s, bw, bh);
        g.fillStyle(colors[1], 1); g.fillRect(ox + 15 * s, oy + 18 * s, bw, bh);
        // Mortar lines on all bricks
        g.lineStyle(0.5 * s, 0x4a3a2a, 0.5);
        g.strokeRect(ox + 2 * s, oy + 4 * s, bw, bh);
        g.strokeRect(ox + 15 * s, oy + 4 * s, bw, bh);
        g.strokeRect(ox + 8 * s, oy + 11 * s, bw, bh);
        g.strokeRect(ox + 2 * s, oy + 11 * s, 5 * s, bh);
        g.strokeRect(ox + 20 * s, oy + 11 * s, 6 * s, bh);
        g.strokeRect(ox + 2 * s, oy + 18 * s, bw, bh);
        g.strokeRect(ox + 15 * s, oy + 18 * s, bw, bh);
        break;
      }
      case 'speed': {
        // Drawn via text overlay (speedLabel)
        break;
      }
    }
  }

  updateHud(s: HudState) {
    this.nameText.setText(s.name ?? 'Ranger');
    const pct = Math.max(0, s.hp / s.maxHp);
    const hpColor = pct > 0.5 ? 0x4ad96a : pct > 0.25 ? 0xd9a84a : 0xd94a4a;
    const hpX = this.hpBarX, hpY = this.hpBarY, hpW = this.hpBarW, hpH = this.hpBarH;
    const hpR = this.p(5);
    this.hpBarGfx.clear();
    this.hpBarGfx.fillStyle(0x111826, 1);
    this.hpBarGfx.fillRoundedRect(hpX, hpY, hpW, hpH, hpR);
    this.hpBarGfx.lineStyle(this.p(1.5), 0x3a4a70, 0.8);
    this.hpBarGfx.strokeRoundedRect(hpX, hpY, hpW, hpH, hpR);
    const hpFillW = (hpW - this.p(4)) * pct;
    if (hpFillW > 0) {
      this.hpBarGfx.fillStyle(hpColor, 1);
      this.hpBarGfx.fillRoundedRect(hpX + this.p(2), hpY + this.p(2), hpFillW, hpH - this.p(4), hpR - this.p(1));
    }
    this.moneyText.setText(`${s.money}`);

    // Toggle countdown text vs progress graphic
    if (s.countdownMsg) {
      this.countdownText.setText(s.countdownMsg);
      this.countdownText.setColor(s.countdownColor ?? '#7cc4ff');
      this.countdownText.setVisible(true);
      this.progressContainer.setVisible(false);
    } else {
      this.countdownText.setVisible(false);
      this.progressContainer.setVisible(true);
    }

    // Update level progress circles
    const currentWave = s.wave ?? 1; // 1-indexed
    if (this.difficulty === 'endless') {
      // Rolling 6-node strip: leftmost = current wave, then next 5.
      // Wave numbering is cumulative (no reset across cycles), and
      // every 4th wave (4, 8, 12, ...) is a boss event.
      for (let i = 0; i < this.progressCircles.length; i++) {
        const w = currentWave + i;
        const isBoss = w % 4 === 0;
        const isCurrent = i === 0;
        // Boss circles use the Graphics-drawn skull icon; non-boss use
        // the text label. Toggle visibility per role.
        this.progressLabels[i].setVisible(!isBoss);
        this.progressIcons[i].setVisible(isBoss);
        if (!isBoss) this.progressLabels[i].setText(`${this.displayWaveNum(w)}`);
        let iconColor = 0x556a78;
        if (isCurrent && isBoss && s.bossSpawned) {
          this.progressCircles[i].setStrokeStyle(this.p(2), 0xff6a6a);
          this.progressCircles[i].setFillStyle(0x3a1010);
          this.progressLabels[i].setColor('#ff6a6a');
          iconColor = 0xff6a6a;
        } else if (isCurrent) {
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x7cc4ff);
          this.progressCircles[i].setFillStyle(0x1a2a4a);
          this.progressLabels[i].setColor('#7cc4ff');
          iconColor = 0x7cc4ff;
        } else if (isBoss) {
          // Upcoming boss — dim red so the player can see it coming
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x4a2a2a);
          this.progressCircles[i].setFillStyle(0x1a0a0a);
          this.progressLabels[i].setColor('#7a4a4a');
          iconColor = 0x7a4a4a;
        } else {
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x2a3760);
          this.progressCircles[i].setFillStyle(0x11172a);
          this.progressLabels[i].setColor('#556');
        }
        if (isBoss) this.drawSkullIcon(this.progressIcons[i], iconColor);
        if (i < this.progressLines.length) {
          // Lines are blue when leading into the current node, dim
          // otherwise — there's no "completed" past since the strip rolls.
          this.progressLines[i].setFillStyle(0x2a3760);
        }
      }
    } else if (this.biome === 'castle' || this.biome === 'desert') {
      // Castle/Desert: 6 nodes — W1, W2, Boss, W3, W4, Boss
      // Map node index to progress state
      const cp = this.biome === 'castle' ? (s.castlePhase ?? 0) : (s.desertPhase ?? 0);
      for (let i = 0; i < this.progressCircles.length; i++) {
        const isBossNode = (i === 2 || i === 5);
        let completed = false;
        let active = false;
        let current = false;

        if (i === 0) { // Wave 1
          completed = currentWave > 1 || cp >= 1;
          current = currentWave === 1 && cp === 0;
        } else if (i === 1) { // Wave 2
          completed = cp >= 1;
          current = currentWave === 2 && cp === 0;
        } else if (i === 2) { // First boss
          completed = s.midBossDefeated;
          active = cp === 1 && s.bossSpawned;
        } else if (i === 3) { // Wave 3
          completed = (cp >= 2 && currentWave > 3) || cp >= 3;
          current = currentWave === 3 && cp === 2;
        } else if (i === 4) { // Wave 4
          completed = cp >= 3;
          current = currentWave === 4 && cp === 2;
        } else if (i === 5) { // Final boss
          active = cp === 3 && s.bossSpawned;
        }

        // Boss nodes show the Graphics skull; everything else shows the text label.
        this.progressLabels[i].setVisible(!isBossNode);
        this.progressIcons[i].setVisible(isBossNode);
        if (isBossNode) {
          let iconColor = 0x7a4a4a;
          if (completed) {
            this.progressCircles[i].setStrokeStyle(this.p(2), 0x4ad96a);
            this.progressCircles[i].setFillStyle(0x1a3a1a);
            iconColor = 0x4ad96a;
          } else if (active) {
            this.progressCircles[i].setStrokeStyle(this.p(2), 0xff6a6a);
            this.progressCircles[i].setFillStyle(0x3a1010);
            iconColor = 0xff6a6a;
          } else {
            // Upcoming boss — dim red so the player can see it coming.
            this.progressCircles[i].setStrokeStyle(this.p(2), 0x4a2a2a);
            this.progressCircles[i].setFillStyle(0x1a0a0a);
            iconColor = 0x7a4a4a;
          }
          this.drawSkullIcon(this.progressIcons[i], iconColor);
        } else if (completed) {
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x4ad96a);
          this.progressCircles[i].setFillStyle(0x1a3a1a);
          this.progressLabels[i].setText('\u2713');
          this.progressLabels[i].setColor('#4ad96a');
        } else if (current) {
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x7cc4ff);
          this.progressCircles[i].setFillStyle(0x1a2a4a);
          this.progressLabels[i].setColor('#7cc4ff');
        } else {
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x2a3760);
          this.progressCircles[i].setFillStyle(0x11172a);
          this.progressLabels[i].setColor('#556');
        }
        if (i < this.progressLines.length) {
          if (completed) this.progressLines[i].setFillStyle(0x4ad96a);
          else if (current || active) this.progressLines[i].setFillStyle(0x7cc4ff);
          else this.progressLines[i].setFillStyle(0x2a3760);
        }
      }
    } else {
      const waveCount = CFG.spawn.waveCount;
      for (let i = 0; i < this.progressCircles.length; i++) {
        const isBoss = i === waveCount;
        const waveNum = i + 1; // 1-indexed wave for this node
        // Boss nodes show the Graphics skull; everything else shows text.
        this.progressLabels[i].setVisible(!isBoss);
        this.progressIcons[i].setVisible(isBoss);
        if (isBoss) {
          let iconColor = 0x7a4a4a;
          if (s.bossSpawned) {
            this.progressCircles[i].setStrokeStyle(this.p(2), 0xff6a6a);
            this.progressCircles[i].setFillStyle(0x3a1010);
            iconColor = 0xff6a6a;
          } else {
            // Upcoming boss — dim red so the player can see it coming.
            this.progressCircles[i].setStrokeStyle(this.p(2), 0x4a2a2a);
            this.progressCircles[i].setFillStyle(0x1a0a0a);
            iconColor = 0x7a4a4a;
          }
          this.drawSkullIcon(this.progressIcons[i], iconColor);
        } else if (waveNum < currentWave || (waveNum === currentWave && s.bossSpawned)) {
          // Completed wave - green with checkmark
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x4ad96a);
          this.progressCircles[i].setFillStyle(0x1a3a1a);
          this.progressLabels[i].setText('\u2713');
          this.progressLabels[i].setColor('#4ad96a');
        } else if (waveNum === currentWave) {
          // Current wave - bright blue highlight
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x7cc4ff);
          this.progressCircles[i].setFillStyle(0x1a2a4a);
          this.progressLabels[i].setText(`${waveNum}`);
          this.progressLabels[i].setColor('#7cc4ff');
        } else {
          // Future wave - dim
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x2a3760);
          this.progressCircles[i].setFillStyle(0x11172a);
          this.progressLabels[i].setText(`${waveNum}`);
          this.progressLabels[i].setColor('#556');
        }
        // Update connecting line colors
        if (i < this.progressLines.length) {
          if (waveNum < currentWave || (waveNum === currentWave && s.bossSpawned)) {
            this.progressLines[i].setFillStyle(0x4ad96a);
          } else if (waveNum === currentWave) {
            this.progressLines[i].setFillStyle(0x7cc4ff);
          } else {
            this.progressLines[i].setFillStyle(0x2a3760);
          }
        }
      }
    }

    // Wave progress bar
    this.waveBarGfx.clear();
    // Endless boss waves spawn no enemies — there's no progress to show
    // once the boss prep starts, so hide the bar/label then. Keep it
    // visible during the lead-in break so the player still sees the
    // "BOSS IN Ns" countdown.
    const inWaveBreak = s.waveBreakUntil > 0 && s.vTime < s.waveBreakUntil;
    const endlessBossWave = this.difficulty === 'endless' && s.wave % 4 === 0;
    // Boss-prep phase on a campaign boss wave (or castle queen/dragon, or
    // the final endless straggler-clear): wave is fully killed and we're
    // counting down to the boss. The wave bar would be sitting at 0% with
    // a stale "WAVE N" label, which the user reads as the wave still
    // running. Hide it; the boss-approach banner / countdown takes over.
    const inBossPrep = s.bossCountdownUntil > 0 && s.vTime < s.bossCountdownUntil;
    if (s.bossSpawned || (endlessBossWave && !inWaveBreak) || inBossPrep) {
      // Hide wave bar when boss is active (boss bar takes its place)
      this.waveLabel.setVisible(false);
      this.waveBarGfx.setVisible(false);
    } else {
      this.waveBarGfx.setVisible(true);
      this.waveLabel.setVisible(true);
      const wbX = this.waveBarX, wbY = this.waveBarY, wbW = this.waveBarW, wbH = this.waveBarH;
      const wbR = this.p(5);
      this.waveBarGfx.fillStyle(0x11172a, 1);
      this.waveBarGfx.fillRoundedRect(wbX, wbY, wbW, wbH, wbR);
      this.waveBarGfx.lineStyle(this.p(1.5), 0x3a4a70, 0.8);
      this.waveBarGfx.strokeRoundedRect(wbX, wbY, wbW, wbH, wbR);
      const wavePct = s.waveSize > 0 ? Math.min(1, s.waveKills / s.waveSize) : 0;
      const wbFillW = (wbW - this.p(4)) * (1 - wavePct);
      if (wbFillW > 0) {
        this.waveBarGfx.fillStyle(0x4a8ad9, 1);
        this.waveBarGfx.fillRoundedRect(wbX + this.p(2), wbY + this.p(2), wbFillW, wbH - this.p(4), wbR - this.p(1));
      }

      // In endless mode every 4th wave (cumulative) is a boss event
      // and shouldn't share a number with the surrounding numbered
      // waves. Label it "BOSS" instead.
      const isBossWave = this.difficulty === 'endless' && s.wave % 4 === 0;
      const displayWave = this.displayWaveNum(s.wave);
      if (s.waveBreakUntil > 0 && s.vTime < s.waveBreakUntil) {
        const secs = Math.ceil((s.waveBreakUntil - s.vTime) / 1000);
        this.waveLabel.setText(isBossWave ? `BOSS IN ${secs}s` : `WAVE ${displayWave} IN ${secs}s`);
        this.waveLabel.setColor('#ffd84a');
      } else {
        this.waveLabel.setText(isBossWave ? `BOSS WAVE` : `WAVE ${displayWave}`);
        this.waveLabel.setColor(isBossWave ? '#ff6a6a' : '#7cc4ff');
      }
    }
  }

  /** Per-frame loop — Phaser auto-calls this on a running scene. We use it
   *  to refresh the off-screen tower / boss indicators against GameScene
   *  state. The indicators live here so they render above the HUD. */
  update() {
    this.updateIndicators();
  }

  /** Open the player-upgrade panel, pausing GameScene physics while it's
   *  visible so the player can shop without being shot. No-op while the
   *  game-over panel is up or another upgrade panel is already open. */
  private openUpgradePanel() {
    if (this.upgradePanel || !this.upgradeBtnAnchor || this.upgradesLocked) return;
    const game = this.scene.get('Game') as GameScene;
    if (!game || !game.player || game.endState?.gameOver) return;
    // Match the tower-panel pause set: pausing physics alone leaves the
    // GameScene update loop running, so towers keep re-triggering their
    // attack animations every fireRate while the menu is open.
    if (!game.buildState.paused) {
      game.buildState.paused = true;
      game.physics?.pause();
      game.tweens?.pauseAll();
      game.anims?.pauseAll();
    }
    this.upgradePanel = new UpgradePanel(this, game, this.upgradeBtnAnchor, () => {
      if (game.buildState.paused && game.buildState.kind === 'none') {
        game.buildState.paused = false;
        game.physics?.resume();
        game.tweens?.resumeAll();
        game.anims?.resumeAll();
      }
      this.upgradePanel = null;
    });
  }

  /** Dim overlay sized for the rectangular UPGRADES button — signals the
   *  button is inactive during the tutorial without the padlock icon
   *  (which read as confusing against the rectangular shape). */
  private buildUpgradesLockOverlay(): Phaser.GameObjects.Graphics {
    const a = this.upgradeBtnAnchor!;
    const g = this.add.graphics().setDepth(50);
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(a.x, a.y, a.w, a.h, this.p(6));
    return g;
  }

  private updateIndicators() {
    const game = this.scene.get('Game') as GameScene;
    if (!game || !game.cameras?.main) return;
    const gameCam = game.cameras.main;
    const wv = gameCam.worldView;
    const mid = gameCam.midPoint;

    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2, cy = H / 2;
    const pad = this.p(28);
    const margin = 40;
    const offset = this.p(18);
    const iconScale = this.p(0.5);

    // ---- Tower indicators
    const towers = game.towers;
    const alive = new Set(towers);
    for (const t of towers) {
      const onScreen = t.x > wv.x - margin && t.x < wv.right + margin &&
                       t.y > wv.y - margin && t.y < wv.bottom + margin;
      let ind = this.towerIndicators.get(t);
      if (!ind) {
        const texKey = t.kind === 'arrow' ? 'ind_arrow' : 'ind_cannon';
        const bg = this.add.sprite(0, 0, texKey)
          .setDepth(950).setScale(iconScale).setAlpha(0.9).setVisible(false);
        const ptr = this.add.sprite(0, 0, 'ind_ptr')
          .setDepth(950.1).setScale(iconScale).setAlpha(0.9).setVisible(false);
        ind = { bg, ptr };
        this.towerIndicators.set(t, ind);
      }
      if (onScreen) {
        ind.bg.setVisible(false);
        ind.ptr.setVisible(false);
        continue;
      }
      const dx = t.x - mid.x;
      const dy = t.y - mid.y;
      if (dx === 0 && dy === 0) continue;
      const sX = dx !== 0 ? (cx - pad) / Math.abs(dx) : Infinity;
      const sY = dy !== 0 ? (cy - pad) / Math.abs(dy) : Infinity;
      const s = Math.min(sX, sY);
      const edgeX = cx + dx * s;
      const edgeY = cy + dy * s;
      const angle = Math.atan2(dy, dx);
      ind.bg.setPosition(edgeX, edgeY).setVisible(true);
      ind.ptr.setPosition(edgeX + Math.cos(angle) * offset, edgeY + Math.sin(angle) * offset)
        .setRotation(angle).setVisible(true);
    }
    // Cleanup destroyed towers
    for (const [t, ind] of this.towerIndicators) {
      if (!alive.has(t)) {
        ind.bg.destroy();
        ind.ptr.destroy();
        this.towerIndicators.delete(t);
      }
    }

    // ---- Boss indicators (primary + castle queen mid-boss + endless secondary).
    // During the castle queen fight, bossState.boss === bossState.midBoss, so
    // we de-dupe by identity before drawing.
    const bs = game.bossState;
    const bosses: Boss[] = [];
    if (bs?.boss && bs.boss.active && !bs.boss.dying) bosses.push(bs.boss);
    if (bs?.midBoss && bs.midBoss !== bs.boss && bs.midBoss.active && !bs.midBoss.dying) bosses.push(bs.midBoss);
    const bossesAlive = new Set(bosses);
    for (const b of bosses) {
      const onScreen = b.x > wv.x - margin && b.x < wv.right + margin &&
                       b.y > wv.y - margin && b.y < wv.bottom + margin;
      let ind = this.bossIndicators.get(b);
      if (!ind) {
        const bg = this.add.sprite(0, 0, 'ind_boss')
          .setDepth(950).setScale(iconScale).setAlpha(0.9).setVisible(false);
        const ptr = this.add.sprite(0, 0, 'ind_ptr')
          .setDepth(950.1).setScale(iconScale).setAlpha(0.9).setVisible(false);
        ind = { bg, ptr };
        this.bossIndicators.set(b, ind);
      }
      if (onScreen) {
        ind.bg.setVisible(false);
        ind.ptr.setVisible(false);
        continue;
      }
      const dx = b.x - mid.x;
      const dy = b.y - mid.y;
      if (dx === 0 && dy === 0) continue;
      const sX = dx !== 0 ? (cx - pad) / Math.abs(dx) : Infinity;
      const sY = dy !== 0 ? (cy - pad) / Math.abs(dy) : Infinity;
      const s = Math.min(sX, sY);
      const edgeX = cx + dx * s;
      const edgeY = cy + dy * s;
      const angle = Math.atan2(dy, dx);
      ind.bg.setPosition(edgeX, edgeY).setVisible(true);
      ind.ptr.setPosition(edgeX + Math.cos(angle) * offset, edgeY + Math.sin(angle) * offset)
        .setRotation(angle).setVisible(true);
    }
    for (const [b, ind] of this.bossIndicators) {
      if (!bossesAlive.has(b)) {
        ind.bg.destroy();
        ind.ptr.destroy();
        this.bossIndicators.delete(b);
      }
    }
  }

  /** Shared rounded-toast helper used by the one-time intro tooltips
   *  (cannon unlock, first boss warning, ...). `accent` colors the outer
   *  border; `totalDurationMs` is the on-screen lifetime (last 500ms is a
   *  fade), defaulting to 6000ms (5500 visible + 500 fade). */
  private showIntroToast(message: string, accent: number, y: number, totalDurationMs = 6000) {
    const W = this.scale.width;
    const H = this.scale.height;
    const text = this.add.text(W / 2, y, message, {
      fontFamily: 'monospace', fontSize: this.fs(14), fontStyle: 'bold',
      color: '#ffffff', align: 'center', stroke: '#0b0f1a', strokeThickness: this.p(3),
    }).setOrigin(0.5).setDepth(951);

    // Mobile landscape: float toasts on the right edge so they don't cover
    // the centered gameplay area. Matches the TutorialScene in-game prompt
    // anchoring so all in-game tutorial guidance reads in the same place.
    if (this.isMobile && W > H) {
      text.setOrigin(1, 0.5).setPosition(W - this.p(20), H / 2);
    }

    const tb = text.getBounds();
    const padX = this.p(20), padY = this.p(14);
    const boxX = tb.x - padX, boxY = tb.y - padY;
    const boxW = tb.width + padX * 2, boxH = tb.height + padY * 2;
    const r = this.p(8);
    const panel = this.add.graphics().setDepth(950);
    panel.fillStyle(0x11172a, 0.95);
    panel.fillRoundedRect(boxX, boxY, boxW, boxH, r);
    panel.lineStyle(this.p(1), 0x2a3760, 0.7);
    panel.strokeRoundedRect(boxX + this.p(3), boxY + this.p(3), boxW - this.p(6), boxH - this.p(6), r - this.p(2));
    panel.lineStyle(this.p(2), accent, 0.9);
    panel.strokeRoundedRect(boxX, boxY, boxW, boxH, r);

    this.time.delayedCall(Math.max(0, totalDurationMs - 500), () => {
      this.tweens.add({
        targets: [panel, text],
        alpha: 0,
        duration: 500,
        onComplete: () => { panel.destroy(); text.destroy(); }
      });
    });
  }

  /** First time the player enters the forest — introduces cannon tower. */
  private showForestIntroToast() {
    this.showIntroToast(
      'CANNON TOWER UNLOCKED!\n\nGreat for AoE damage against\nclusters of enemies.',
      0x4a8acc, // blue info accent
      this.p(150) // sit below the wave/phase bar so it doesn't cover it
    );
  }

  /** First time the player enters the infected level — first ranged
   *  enemies. Sets expectations for both styles: blockable line-of-sight
   *  shots and arcing projectiles that ignore walls and towers. */
  private showInfectedIntroToast() {
    this.showIntroToast(
      'RANGED ENEMIES INCOMING!\n\nSome projectiles can\'t shoot through\nwalls or towers — others arc right over them.\nPosition your defenses carefully.',
      0x9a5ac0, // purple/infected accent
      this.p(110)
    );
  }

  /** First time the player enters the castle level — heads-up that this
   *  level breaks the usual "waves then a boss" pattern: two bosses and
   *  only four waves total (mid-boss after wave 2, final after wave 4). */
  private showCastleIntroToast() {
    this.showIntroToast(
      'WATCH OUT!\n\nThere will be more waves and\ntwo bosses on this level!',
      0xc4a850, // gold accent — castle / royalty vibe
      this.p(150)
    );
  }

  /** First time the player ever fights a boss — danger warning. Lower
   *  on the screen so it doesn't overlap the just-appeared boss HP bar. */
  private showFirstBossIntroToast() {
    this.showIntroToast(
      'YOUR FIRST BOSS IS SPAWNING!\n\nCareful — bosses have special abilities\nand can destroy walls and towers.',
      0xd94a4a, // red danger accent
      this.p(160)
    );
  }

  showEnd(s: GameEndState) {
    if (this.endPanel) return;
    if (s.win) saveMedal(this.levelId, this.difficulty);
    if (s.runStats && this.difficulty === 'endless') {
      this.showEndlessEnd(s, s.runStats);
      return;
    }
    const W = this.scale.width, H = this.scale.height;

    // Themed colors — green for VICTORY, red for DEFEAT. Hex strings used
    // for text, packed ints for Graphics fills/strokes.
    const accent = s.win ? 0x4ad96a : 0xd94a4a;
    const titleHex = s.win ? '#7cf29a' : '#ff6a6a';

    // Fullscreen dim
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0);

    // Modal panel — matches the HUD's rounded-rect language: dark navy fill,
    // subtle inner stroke, themed outer stroke. Same colour family as the
    // HP / wave / boss bars.
    const boxW = this.p(380), boxH = this.p(200);
    const boxX = W / 2 - boxW / 2, boxY = H / 2 - boxH / 2;
    const boxR = this.p(10);
    const panel = this.add.graphics();
    panel.fillStyle(0x11172a, 0.97);
    panel.fillRoundedRect(boxX, boxY, boxW, boxH, boxR);
    panel.lineStyle(this.p(1), 0x2a3760, 0.7);
    panel.strokeRoundedRect(boxX + this.p(3), boxY + this.p(3), boxW - this.p(6), boxH - this.p(6), boxR - this.p(2));
    panel.lineStyle(this.p(2), accent, 0.9);
    panel.strokeRoundedRect(boxX, boxY, boxW, boxH, boxR);

    // Title
    const title = this.add.text(W / 2, H / 2 - this.p(60), s.win ? 'VICTORY' : 'DEFEAT', {
      fontFamily: 'monospace', fontSize: this.fs(32), fontStyle: 'bold',
      color: titleHex, stroke: '#0b0f1a', strokeThickness: this.p(4)
    }).setOrigin(0.5);

    // Stats line
    const sub = this.add.text(W / 2, H / 2 - this.p(15), `${s.name}   Kills: ${s.kills}   $ ${s.money}`, {
      fontFamily: 'monospace', fontSize: this.fs(14), color: '#ccd',
      stroke: '#0b0f1a', strokeThickness: this.p(2)
    }).setOrigin(0.5);

    // RETURN TO MAP button — rounded, themed border, text in accent colour.
    const btnW = this.p(160), btnH = this.p(36);
    const btnCX = W / 2, btnCY = H / 2 + this.p(45);
    const btnX = btnCX - btnW / 2, btnY = btnCY - btnH / 2;
    const btnR = this.p(7);
    const btnG = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x1a2238 : 0x0b0f1a, 0.95);
      btnG.fillRoundedRect(btnX, btnY, btnW, btnH, btnR);
      btnG.lineStyle(this.p(1.5), accent, hover ? 1 : 0.85);
      btnG.strokeRoundedRect(btnX, btnY, btnW, btnH, btnR);
    };
    drawBtn(false);
    const btnText = this.add.text(btnCX, btnCY, 'RETURN TO MAP', {
      fontFamily: 'monospace', fontSize: this.fs(13), fontStyle: 'bold',
      color: titleHex, stroke: '#0b0f1a', strokeThickness: this.p(2)
    }).setOrigin(0.5);
    const btnHit = this.add.rectangle(btnCX, btnCY, btnW, btnH, 0x000000, 0).setInteractive({ useHandCursor: true });
    btnHit.on('pointerdown', () => {
      SFX.play('click');
      this.scene.stop('Game');
      this.scene.stop('UI');
      this.scene.start('LevelSelect');
    });
    btnHit.on('pointerover', () => drawBtn(true));
    btnHit.on('pointerout', () => drawBtn(false));

    this.endPanel = this.add.container(0, 0, [bg, panel, title, sub, btnG, btnText, btnHit]).setDepth(1000);
  }

  /** Endless-mode death screen — shows the full RunStats breakdown plus
   *  ★ markers next to any field that beat the persisted best. */
  private showEndlessEnd(s: GameEndState, runStats: RunStatsSnapshot) {
    const W = this.scale.width, H = this.scale.height;
    const stats: RunStatsSnapshot = {
      wavesCleared: runStats.wavesCleared,
      bossesKilled: runStats.bossesKilled,
      bossesByKind: { ...runStats.bossesByKind },
      enemiesKilled: runStats.enemiesKilled,
      coinsCollected: runStats.coinsCollected,
      coinsSpent: runStats.coinsSpent,
      towersBuilt: runStats.towersBuilt,
      towersUpgradedToMax: runStats.towersUpgradedToMax,
      highestTowerLevel: runStats.highestTowerLevel,
      wallsBuilt: runStats.wallsBuilt,
      wallsDestroyed: runStats.wallsDestroyed,
      damageDealt: runStats.damageDealt,
      damageTaken: runStats.damageTaken,
      timeSurvived: runStats.timeSurvived,
    };
    const newRecords = saveEndlessBest(this.levelId, stats);

    const accent = 0xc040c0; // endless-mode purple
    const titleHex = '#e090e0';

    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0);

    const boxW = this.p(440), boxH = this.p(420);
    const boxX = W / 2 - boxW / 2, boxY = H / 2 - boxH / 2;
    const boxR = this.p(10);
    const panel = this.add.graphics();
    panel.fillStyle(0x11172a, 0.97);
    panel.fillRoundedRect(boxX, boxY, boxW, boxH, boxR);
    panel.lineStyle(this.p(1), 0x2a3760, 0.7);
    panel.strokeRoundedRect(boxX + this.p(3), boxY + this.p(3), boxW - this.p(6), boxH - this.p(6), boxR - this.p(2));
    panel.lineStyle(this.p(2), accent, 0.9);
    panel.strokeRoundedRect(boxX, boxY, boxW, boxH, boxR);

    const title = this.add.text(W / 2, boxY + this.p(28), 'RUN ENDED', {
      fontFamily: 'monospace', fontSize: this.fs(26), fontStyle: 'bold',
      color: titleHex, stroke: '#0b0f1a', strokeThickness: this.p(4),
    }).setOrigin(0.5);

    // Stats rows. Two columns: label (left), value (right). ★ if record.
    const row = (label: string, value: string, isRecord: boolean, idx: number) => {
      const y = boxY + this.p(70) + idx * this.p(18);
      const star = isRecord ? '★ ' : '   ';
      const labelText = this.add.text(boxX + this.p(28), y, label, {
        fontFamily: 'monospace', fontSize: this.fs(12), color: '#a0b0d0',
      }).setOrigin(0, 0.5);
      const valueText = this.add.text(boxX + boxW - this.p(28), y, `${star}${value}`, {
        fontFamily: 'monospace', fontSize: this.fs(12), fontStyle: isRecord ? 'bold' : 'normal',
        color: isRecord ? '#ffd84a' : '#ccd',
      }).setOrigin(1, 0.5);
      return [labelText, valueText];
    };

    const formatTime = (ms: number) => {
      const total = Math.floor(ms / 1000);
      const m = Math.floor(total / 60);
      const sec = total % 60;
      return `${m}m ${sec.toString().padStart(2, '0')}s`;
    };

    const rows: { label: string; value: string; key: keyof RunStatsSnapshot | null }[] = [
      { label: 'Waves cleared',     value: `${stats.wavesCleared}`,           key: 'wavesCleared' },
      { label: 'Bosses defeated',   value: `${stats.bossesKilled}`,           key: 'bossesKilled' },
      { label: 'Time survived',     value: formatTime(stats.timeSurvived),    key: 'timeSurvived' },
      { label: 'Enemies defeated',  value: `${stats.enemiesKilled}`,          key: 'enemiesKilled' },
      { label: 'Damage dealt',      value: `${stats.damageDealt}`,            key: 'damageDealt' },
      { label: 'Damage taken',      value: `${stats.damageTaken}`,            key: 'damageTaken' },
      { label: 'Coins collected',   value: `${stats.coinsCollected}`,         key: 'coinsCollected' },
      { label: 'Coins spent',       value: `${stats.coinsSpent}`,             key: 'coinsSpent' },
      { label: 'Towers built',      value: `${stats.towersBuilt}`,            key: 'towersBuilt' },
      { label: 'Max-tier towers',   value: `${stats.towersUpgradedToMax}`,    key: 'towersUpgradedToMax' },
      { label: 'Highest tower lvl', value: `${stats.highestTowerLevel + 1}`,  key: 'highestTowerLevel' },
      { label: 'Walls built',       value: `${stats.wallsBuilt}`,             key: 'wallsBuilt' },
      { label: 'Walls destroyed',   value: `${stats.wallsDestroyed}`,         key: 'wallsDestroyed' },
    ];

    const items: Phaser.GameObjects.GameObject[] = [bg, panel, title];
    rows.forEach((r, i) => {
      const isRecord = r.key !== null && newRecords.has(r.key);
      const [a, b] = row(r.label, r.value, isRecord, i);
      items.push(a, b);
    });

    // Footer hint about new records
    const recordCount = Array.from(newRecords).length;
    if (recordCount > 0) {
      const hint = this.add.text(W / 2, boxY + boxH - this.p(75), `★  ${recordCount} new personal best${recordCount === 1 ? '' : 's'}`, {
        fontFamily: 'monospace', fontSize: this.fs(12), color: '#ffd84a',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      items.push(hint);
    }

    // RETURN button
    const btnW = this.p(180), btnH = this.p(40);
    const btnCX = W / 2, btnCY = boxY + boxH - this.p(35);
    const btnX = btnCX - btnW / 2, btnY = btnCY - btnH / 2;
    const btnR = this.p(7);
    const btnG = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x1a2238 : 0x0b0f1a, 0.95);
      btnG.fillRoundedRect(btnX, btnY, btnW, btnH, btnR);
      btnG.lineStyle(this.p(1.5), accent, hover ? 1 : 0.85);
      btnG.strokeRoundedRect(btnX, btnY, btnW, btnH, btnR);
    };
    drawBtn(false);
    const btnText = this.add.text(btnCX, btnCY, 'RETURN TO MAP', {
      fontFamily: 'monospace', fontSize: this.fs(13), fontStyle: 'bold',
      color: titleHex, stroke: '#0b0f1a', strokeThickness: this.p(2),
    }).setOrigin(0.5);
    const btnHit = this.add.rectangle(btnCX, btnCY, btnW, btnH, 0x000000, 0).setInteractive({ useHandCursor: true });
    btnHit.on('pointerdown', () => {
      SFX.play('click');
      this.scene.stop('Game');
      this.scene.stop('UI');
      this.scene.start('LevelSelect');
    });
    btnHit.on('pointerover', () => drawBtn(true));
    btnHit.on('pointerout', () => drawBtn(false));
    items.push(btnG, btnText, btnHit);

    this.endPanel = this.add.container(0, 0, items).setDepth(1000);
  }

  shutdown() {
    // Drop any lingering off-screen indicator sprites — they're tied to the
    // GameScene tower/boss instances which don't survive a scene restart.
    for (const [, ind] of this.towerIndicators) { ind.bg.destroy(); ind.ptr.destroy(); }
    this.towerIndicators.clear();
    for (const [, ind] of this.bossIndicators) { ind.bg.destroy(); ind.ptr.destroy(); }
    this.bossIndicators.clear();
    if (this.upgradePanel) { this.upgradePanel.close(); this.upgradePanel = null; }
    getEvents(this.game.events).off('hud', this.onHud);
    getEvents(this.game.events).off('game-end', this.onGameEnd);
    getEvents(this.game.events).off('boss-spawn', this.onBossSpawn);
    getEvents(this.game.events).off('boss-hp', this.onBossHp);
    getEvents(this.game.events).off('boss-died', this.onBossDied);
    getEvents(this.game.events).off('tutorial-finished', this.onTutorialFinished);
    getEvents(this.game.events).off('tutorial-speed-unlocked', this.onTutorialSpeedUnlocked);
    getEvents(this.game.events).off('build-error', this.onBuildError);
    getEvents(this.game.events).off('build-mode', this.onBuildMode);
  }
}
