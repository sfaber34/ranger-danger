import Phaser from 'phaser';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { CFG } from '../config';
import { loadMedals, totalMedals } from '../levels';
import { Enemy } from '../entities/Enemy';
import type { Step, StepContext, TutorialStepName } from '../tutorial/Step';
import { buildStepRegistry } from '../tutorial/registry';

const STORAGE_KEY = 'td_tutorial_done';

export function isTutorialNeeded(): boolean {
  if (localStorage.getItem(STORAGE_KEY) === 'true') return false;
  return totalMedals(loadMedals()) === 0;
}

export function markTutorialDone(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}

/**
 * Tutorial driver. The actual per-step content (prompt text, overlay
 * cutouts, advancement logic) lives in `src/tutorial/steps/*.ts`; this
 * scene owns the lifecycle (lifetime of overlay/text/skip-btn graphics,
 * pause/resume of GameScene, listener wiring) and dispatches incoming
 * events / per-frame updates to whichever step is currently active.
 *
 * `pendingStep` is non-null while we're between two steps (the screen
 * is blank during a delay). Some steps care about events that fire
 * while they're pending — e.g. game_kill counts kills landed during
 * the 2s lead-in. The dispatcher fires both the active step AND the
 * pending step when one is set so those quirks live entirely inside
 * the step files.
 */
export class TutorialScene extends Phaser.Scene {
  step: TutorialStepName = 'ls_click_meadow';
  pendingStep: TutorialStepName | null = null;

  overlay!: Phaser.GameObjects.Graphics;
  textBg!: Phaser.GameObjects.Graphics;
  promptText!: Phaser.GameObjects.Text;
  arrowGfx!: Phaser.GameObjects.Graphics;
  skipBtn!: Phaser.GameObjects.Text;

  private sf = 1;
  private isMobile = false;
  private p(v: number) { return v * this.sf; }
  private fs(px: number) { return `${Math.round(px * this.sf)}px`; }
  /** LevelSelect-canvas scaling: matches LevelSelectScene's sf = nativeW/CFG.width.
   *  Tutorial's regular `p()` uses uiScale (different on mobile), so use this for
   *  any coordinate that targets a node/panel rendered by LevelSelectScene. */
  private lsP(v: number) { return v * (this.scale.width / CFG.width); }

  hudLabels: Phaser.GameObjects.GameObject[] = [];
  hudClickZone: Phaser.GameObjects.Rectangle | null = null;
  continueZone: Phaser.GameObjects.Rectangle | null = null;

  /** When > 0, the time at which a pending advanceTo() should fire. */
  private pendingFireAt = 0;

  private steps: Map<TutorialStepName, Step> = new Map();

  constructor() { super('Tutorial'); }

  create() {
    this.sf = getRegistry(this.game).get('sf') || 1;
    this.isMobile = !!getRegistry(this.game).get('isMobile');
    const W = this.scale.width;

    // Full-screen dim overlay
    this.overlay = this.add.graphics().setDepth(100);

    // Text prompt background
    this.textBg = this.add.graphics().setDepth(101);

    // Prompt text
    this.promptText = this.add.text(W / 2, this.p(80), '', {
      fontFamily: 'monospace', fontSize: this.fs(16), color: '#ffffff',
      stroke: '#000000', strokeThickness: this.p(3),
      align: 'center', wordWrap: { width: W - this.p(100) }
    }).setOrigin(0.5).setDepth(102);

    // Arrow graphic (pulsing pointer)
    this.arrowGfx = this.add.graphics().setDepth(101);

    // Skip button — position depends on orientation, see repositionSkipBtn().
    this.skipBtn = this.add.text(0, 0, 'Skip Tutorial', {
      fontFamily: 'monospace', fontSize: this.fs(10), color: '#888',
      stroke: '#000', strokeThickness: this.p(2)
    }).setDepth(103).setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', () => this.finish());
    this.skipBtn.on('pointerover', () => this.skipBtn.setColor('#ccc'));
    this.skipBtn.on('pointerout', () => this.skipBtn.setColor('#888'));
    this.repositionSkipBtn();

    // Re-render on viewport change. queueMicrotask defers to let
    // GameScene's viewport-changed handler (which calls setGameSize)
    // run first, so this.scale reflects the new dimensions.
    const onViewportChanged = () => {
      queueMicrotask(() => {
        this.sf = getRegistry(this.game).get('sf') || 1;
        this.isMobile = !!getRegistry(this.game).get('isMobile');
        this.repositionSkipBtn();
        if (!this.pendingStep) this.showStep();
      });
    };
    getEvents(this.game.events).on('viewport-changed', onViewportChanged);
    // The scale resize event fires whenever any scene calls setGameSize —
    // critically, when GameScene expands the canvas back to the full
    // viewport on map load. Without this listener the skip button stays
    // anchored to the LevelSelect-sized canvas and (in mobile landscape)
    // ends up overlapping the hotbar until the user rotates.
    const onScaleResize = () => {
      this.sf = getRegistry(this.game).get('sf') || 1;
      this.repositionSkipBtn();
      if (!this.pendingStep) this.showStep();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onScaleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      getEvents(this.game.events).off('viewport-changed', onViewportChanged);
      this.scale.off(Phaser.Scale.Events.RESIZE, onScaleResize);
    });

    // Listen for events
    const ev = getEvents(this.game.events);
    ev.on('tutorial-level-clicked', this.onLevelClicked, this);
    ev.on('tutorial-diff-clicked', this.onDiffClicked, this);
    ev.on('tutorial-kill', this.onKill, this);
    ev.on('tutorial-tower-placed', this.onTowerPlaced, this);
    ev.on('tutorial-wall-placed', this.onWallPlaced, this);
    ev.on('game-ready', this.onGameReady, this);
    ev.on('build-mode', this.onBuildMode, this);
    ev.on('tutorial-coin-collected', this.onCoinCollected, this);
    ev.on('tutorial-tower-selected', this.onTowerSelected, this);
    ev.on('tutorial-tower-upgraded', this.onTowerUpgraded, this);
    ev.on('tutorial-tower-deselected', this.onTowerDeselected, this);

    // Build a fresh registry every create() so step-local counters start
    // clean on tutorial restart.
    this.steps = buildStepRegistry();

    this.step = 'ls_click_meadow';
    this.pendingStep = null;
    this.pendingFireAt = 0;
    getRegistry(this.game).set('tutorialStep', this.step);

    // Run enter() on the first step before render() — same lifecycle
    // every transition uses.
    this.steps.get(this.step)?.enter?.(this.buildCtx());
    this.showStep();
  }

  /**
   * Build the read-through context object that steps see. Cheap (small
   *  object literal); we don't bother caching it. `step` and `pendingStep`
   *  are snapshots — buildCtx() is called fresh per event / render / frame
   *  so they reflect the current values at dispatch time.
   */
  private buildCtx(): StepContext {
    return {
      scene: this,
      W: this.scale.width,
      H: this.scale.height,
      isMobile: this.isMobile,
      p: (v: number) => this.p(v),
      fs: (v: number) => this.fs(v),
      lsP: (v: number) => this.lsP(v),
      showPrompt: (text, y, anchorY) => this.showPrompt(text, y, anchorY),
      showClickPrompt: (text, y, nextStep, nextDelay) => this.showClickPrompt(text, y, nextStep, nextDelay),
      drawDimWithHole: (cx, cy, r) => this.drawDimWithHole(cx, cy, r),
      drawDimWithCutout: (x, y, w, h) => this.drawDimWithCutout(x, y, w, h),
      drawDimWithRect: (x, y, w, h) => this.drawDimWithRect(x, y, w, h),
      drawArrow: (x, y, dir) => this.drawArrow(x, y, dir),
      trackLabel: (obj) => { this.hudLabels.push(obj); },
      setHudClickZone: (zone) => { this.hudClickZone = zone; },
      arrowGfx: this.arrowGfx,
      overlay: this.overlay,
      pauseGame: () => this.pauseGame(),
      resumeGame: () => this.resumeGame(),
      spawnTutorialEnemies: (count) => this.spawnTutorialEnemies(this.scene.get('Game') as any, count),
      advanceTo: (step, delayMs) => this.advanceTo(step, delayMs ?? 0),
      showStep: () => this.showStep(),
      step: this.step,
      pendingStep: this.pendingStep,
      setPendingStep: (s) => { this.pendingStep = s; },
      gameScene: this.scene.get('Game') as any,
    };
  }

  // ---------- Event dispatchers ----------

  /**
   * Forward the event to BOTH the active step AND the pending step (when
   * one is set). game_kill counts kills landed during the 2s lead-in,
   * which relies on this dual fire. Stateless steps without the
   * matching handler simply ignore it.
   */
  private dispatchEvent<K extends keyof Step>(
    method: K,
    invoke: (step: Step) => void,
  ) {
    const active = this.steps.get(this.step);
    if (active && typeof active[method] === 'function') invoke(active);
    if (this.pendingStep && this.pendingStep !== this.step) {
      const pending = this.steps.get(this.pendingStep);
      if (pending && typeof pending[method] === 'function') invoke(pending);
    }
  }

  onLevelClicked = (id: number) => {
    this.dispatchEvent('onLevelClicked', s => s.onLevelClicked!(this.buildCtx(), id));
  };

  onDiffClicked = (diff: string) => {
    this.dispatchEvent('onDiffClicked', s => s.onDiffClicked!(this.buildCtx(), diff));
  };

  onGameReady = () => {
    this.dispatchEvent('onGameReady', s => s.onGameReady!(this.buildCtx()));
  };

  onBuildMode = (active: boolean, kind: string, towerKind?: string) => {
    this.dispatchEvent('onBuildMode', s => s.onBuildMode!(this.buildCtx(), active, kind, towerKind));
  };

  onKill = () => {
    this.dispatchEvent('onKill', s => s.onKill!(this.buildCtx()));
  };

  onTowerPlaced = () => {
    this.dispatchEvent('onTowerPlaced', s => s.onTowerPlaced!(this.buildCtx()));
  };

  onCoinCollected = () => {
    this.dispatchEvent('onCoinCollected', s => s.onCoinCollected!(this.buildCtx()));
  };

  onTowerSelected = () => {
    this.dispatchEvent('onTowerSelected', s => s.onTowerSelected!(this.buildCtx()));
  };

  onTowerUpgraded = () => {
    this.dispatchEvent('onTowerUpgraded', s => s.onTowerUpgraded!(this.buildCtx()));
  };

  onTowerDeselected = () => {
    this.dispatchEvent('onTowerDeselected', s => s.onTowerDeselected!(this.buildCtx()));
  };

  onWallPlaced = () => {
    this.dispatchEvent('onWallPlaced', s => s.onWallPlaced!(this.buildCtx()));
  };

  // ---------- Lifecycle ----------

  advanceTo(step: TutorialStepName, delayMs = 0) {
    if (delayMs > 0) {
      if (this.pendingStep) return; // already waiting
      // Clear the screen during the delay
      this.overlay.clear();
      this.textBg.clear();
      this.arrowGfx.clear();
      this.promptText.setText('');
      this.cleanupHudLabels();
      this.pendingStep = step;
      this.pendingFireAt = this.time.now + delayMs;
      return;
    }
    this.commitStep(step);
  }

  /** Actually transition to the named step (no delay). */
  private commitStep(step: TutorialStepName) {
    // exit() the previous step
    const prev = this.steps.get(this.step);
    prev?.exit?.(this.buildCtx());

    this.pendingStep = null;
    this.pendingFireAt = 0;
    this.step = step;
    getRegistry(this.game).set('tutorialStep', step);

    if (step === 'complete') {
      this.finish();
      return;
    }

    const next = this.steps.get(step);
    next?.enter?.(this.buildCtx());
    this.showStep();
  }

  showStep() {
    this.overlay.clear();
    this.textBg.clear();
    this.arrowGfx.clear();
    this.cleanupContinueZone();
    this.cleanupHudLabels();

    if (this.step === 'complete') {
      this.finish();
      return;
    }

    const step = this.steps.get(this.step);
    step?.render(this.buildCtx());
  }

  update() {
    // Handle delayed transitions
    if (this.pendingStep && this.pendingFireAt > 0 && this.time.now > this.pendingFireAt) {
      this.commitStep(this.pendingStep);
      return;
    }

    // Skip step logic while waiting for a delayed transition
    if (this.pendingStep) return;

    // Step-specific update logic
    const active = this.steps.get(this.step);
    active?.update?.(this.buildCtx(), this.time.now, this.game.loop.delta);
  }

  // ---------- Helpers exposed via StepContext ----------

  pauseGame() {
    const gameScene = this.scene.get('Game') as any;
    if (gameScene?.physics?.world) gameScene.physics.pause();
  }

  resumeGame() {
    const gameScene = this.scene.get('Game') as any;
    if (gameScene?.physics?.world) gameScene.physics.resume();
  }

  /** Show prompt with "Click/Tap to continue" and advance to nextStep on click */
  showClickPrompt(text: string, y: number, nextStep: TutorialStepName, nextDelay = 0) {
    const continueHint = this.isMobile ? '\n\nTap to continue.' : '\n\nClick to continue.';
    this.showPrompt(text + continueHint, y);
    const W = this.scale.width;
    const H = this.scale.height;
    this.continueZone = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(100);
    this.continueZone.on('pointerdown', () => {
      this.cleanupContinueZone();
      this.advanceTo(nextStep, nextDelay);
    });
  }

  cleanupContinueZone() {
    if (this.continueZone) { this.continueZone.destroy(); this.continueZone = null; }
  }

  cleanupHudLabels() {
    for (const obj of this.hudLabels) obj.destroy();
    this.hudLabels = [];
    if (this.hudClickZone) { this.hudClickZone.destroy(); this.hudClickZone = null; }
  }

  /**
   * Place the skip-tutorial link based on viewport / orientation:
   *   - Mobile portrait: vertically centered on the right edge so the user's
   *     thumb (which usually rests near the bottom holding the phone) doesn't
   *     hit it accidentally.
   *   - Mobile landscape: bottom-right with extra vertical standoff so the
   *     link clears the Vibe Jam 2026 badge anchored to the bottom-right of
   *     the viewport.
   *   - Desktop: lower-right corner (the legacy spot).
   */
  private repositionSkipBtn() {
    if (!this.skipBtn) return;
    const W = this.scale.width;
    const H = this.scale.height;
    const isPortraitMobile = this.isMobile && H > W;
    const isLandscapeMobile = this.isMobile && W > H;
    if (isPortraitMobile) {
      this.skipBtn.setPosition(W - this.p(20), H / 2).setOrigin(1, 0.5);
    } else if (isLandscapeMobile) {
      this.skipBtn.setPosition(W - this.p(20), H - this.p(48)).setOrigin(1, 1);
    } else {
      this.skipBtn.setPosition(W - this.p(20), H - this.p(12)).setOrigin(1, 1);
    }
  }

  showPrompt(text: string, y: number, anchorY: number = 0.5) {
    const W = this.scale.width;
    const H = this.scale.height;
    // In-game tutorial steps (`game_*`) on mobile landscape float the prompt
    // on the right edge so the gameplay area stays clear. Portrait and
    // level-select (`ls_*`) keep the original centered layout. Orientation
    // changes re-run showStep → showPrompt so this branch picks the right
    // side automatically when the device rotates.
    const inGameMobileLandscape = this.isMobile && W > H && this.step.startsWith('game_');
    if (inGameMobileLandscape) {
      const wrapW = Math.max(this.p(200), Math.min(W * 0.34, this.p(360)));
      this.promptText.setWordWrapWidth(wrapW);
      this.promptText.setOrigin(1, 0.5).setText(text).setPosition(W - this.p(20), H / 2);
    } else {
      this.promptText.setWordWrapWidth(W - this.p(100));
      this.promptText.setOrigin(0.5, anchorY).setText(text).setPosition(W / 2, y);
    }

    // Draw text background panel
    const bounds = this.promptText.getBounds();
    const pad = this.p(14);
    this.textBg.fillStyle(0x0d1220, 0.9);
    this.textBg.fillRoundedRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2, this.p(8));
    this.textBg.lineStyle(this.p(1), 0x4a8acc, 0.6);
    this.textBg.strokeRoundedRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2, this.p(8));
  }

  drawDimWithHole(cx: number, cy: number, r: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    // Draw 4 rects around the circular hole (approximated as square cutout)
    const s = r + this.p(6);
    this.overlay.fillStyle(0x000000, 0.6);
    this.overlay.fillRect(0, 0, W, cy - s);           // top
    this.overlay.fillRect(0, cy + s, W, H - cy - s);  // bottom
    this.overlay.fillRect(0, cy - s, cx - s, s * 2);  // left
    this.overlay.fillRect(cx + s, cy - s, W - cx - s, s * 2); // right
    // Pulsing ring around cutout
    this.overlay.lineStyle(this.p(2), 0x4ad96a, 0.8);
    this.overlay.strokeCircle(cx, cy, r + this.p(4));
  }

  drawDimWithCutout(x: number, y: number, w: number, h: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    const pad = this.p(4);
    this.overlay.fillStyle(0x000000, 0.6);
    this.overlay.fillRect(0, 0, W, y - pad);                          // top
    this.overlay.fillRect(0, y + h + pad, W, H - y - h - pad);       // bottom
    this.overlay.fillRect(0, y - pad, x - pad, h + pad * 2);         // left
    this.overlay.fillRect(x + w + pad, y - pad, W - x - w - pad, h + pad * 2); // right
  }

  drawDimWithRect(x: number, y: number, w: number, h: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    const pad = this.p(4);
    this.overlay.fillStyle(0x000000, 0.6);
    this.overlay.fillRect(0, 0, W, y - pad);                          // top
    this.overlay.fillRect(0, y + h + pad, W, H - y - h - pad);       // bottom
    this.overlay.fillRect(0, y - pad, x - pad, h + pad * 2);         // left
    this.overlay.fillRect(x + w + pad, y - pad, W - x - w - pad, h + pad * 2); // right
    // Highlight border
    this.overlay.lineStyle(this.p(2), 0x4ad96a, 0.8);
    this.overlay.strokeRoundedRect(x - pad, y - pad, w + pad * 2, h + pad * 2, this.p(4));
  }

  drawArrow(x: number, y: number, dir: 'down' | 'up' | 'right') {
    const sz = this.p(10);
    this.arrowGfx.fillStyle(0x4ad96a, 0.9);
    if (dir === 'down') {
      this.arrowGfx.fillTriangle(x - sz, y, x + sz, y, x, y + sz * 1.5);
    } else if (dir === 'up') {
      this.arrowGfx.fillTriangle(x - sz, y, x + sz, y, x, y - sz * 1.5);
    } else {
      this.arrowGfx.fillTriangle(x, y - sz, x, y + sz, x + sz * 1.5, y);
    }
    // Pulse the arrow
    this.tweens.killTweensOf(this.arrowGfx);
    this.arrowGfx.setAlpha(1);
    this.tweens.add({ targets: this.arrowGfx, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
  }

  spawnTutorialEnemies(gameScene: any, count: number) {
    if (!gameScene?.player) return;
    const px = gameScene.player.x;
    const py = gameScene.player.y;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 480 + Math.random() * 80;
      const ex = px + Math.cos(angle) * dist;
      const ey = py + Math.sin(angle) * dist;
      const e = new Enemy(gameScene, ex, ey, 'snake');
      gameScene.enemies.add(e);
    }
  }

  finish() {
    markTutorialDone();
    getRegistry(this.game).set('tutorialActive', false);
    getRegistry(this.game).set('tutorialStep', null);
    this.cleanupContinueZone();
    this.resumeGame();

    // Tells UIScene the tutorial just wrapped — it pops the speed-up
    // unlock toast a couple seconds later and removes the speed slot lock.
    getEvents(this.game.events).emit('tutorial-finished');

    // Resume normal spawning in GameScene — skip the standard build break
    // since the tutorial already walked the player through placement.
    const gameScene = this.scene.get('Game') as any;
    if (gameScene?.loadingDone) {
      gameScene.waveState.resumeInitialBuildPhase(gameScene.vTime);
    }

    this.detachListeners();
    this.scene.stop('Tutorial');
  }

  shutdown() {
    this.detachListeners();
  }

  private detachListeners() {
    const ev = getEvents(this.game.events);
    ev.off('tutorial-level-clicked', this.onLevelClicked, this);
    ev.off('tutorial-diff-clicked', this.onDiffClicked, this);
    ev.off('tutorial-kill', this.onKill, this);
    ev.off('tutorial-tower-placed', this.onTowerPlaced, this);
    ev.off('tutorial-wall-placed', this.onWallPlaced, this);
    ev.off('game-ready', this.onGameReady, this);
    ev.off('build-mode', this.onBuildMode, this);
    ev.off('tutorial-coin-collected', this.onCoinCollected, this);
    ev.off('tutorial-tower-selected', this.onTowerSelected, this);
    ev.off('tutorial-tower-upgraded', this.onTowerUpgraded, this);
    ev.off('tutorial-tower-deselected', this.onTowerDeselected, this);
  }
}
