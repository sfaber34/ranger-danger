import type { TutorialScene } from '../scenes/TutorialScene';

/**
 * Every named position the tutorial can be in. Drives the registry lookup
 * + the persisted `tutorialStep` registry key that other scenes read to
 * gate behavior (e.g. UIScene blocks certain hotbar slots while the
 * tutorial is on a build step).
 */
export type TutorialStepName =
  | 'ls_click_meadow'
  | 'ls_click_easy'
  | 'ls_click_start'
  | 'game_move'
  | 'game_hud'
  | 'game_stand_still'
  | 'game_kill'
  | 'game_press_1'
  | 'game_place_tower'
  | 'game_watch_tower'
  | 'game_press_4'
  | 'game_place_walls'
  | 'game_loot_coins'
  | 'game_collect_60'
  | 'game_click_tower'
  | 'game_upgrade_tower'
  | 'game_deselect_tower'
  | 'game_speed'
  | 'game_done'
  | 'complete';

/**
 * The view a Step gets onto the surrounding TutorialScene. Steps never
 * touch `this.scene.add`/`this.scene.tweens`/etc directly — they use the
 * helpers exposed here so any future move (e.g. to a different scene
 * lifecycle) is a one-place change.
 */
export interface StepContext {
  /** The owning TutorialScene. Used for direct property access (selectedTower
   *  on the GameScene, this.scene routing, etc.) where a helper isn't worth
   *  inventing. */
  scene: TutorialScene;

  /** Cached canvas size at the moment showStep() / event handler ran. */
  W: number;
  H: number;
  isMobile: boolean;

  /** Tutorial-uiScale-aware pixel multiplier (matches UIScene's `p()`). */
  p(v: number): number;
  /** Tutorial-uiScale-aware font-size string. */
  fs(v: number): string;
  /** LevelSelect-canvas pixel multiplier. Use for any coord that targets a
   *  node/panel rendered by LevelSelectScene (mobile differs). */
  lsP(v: number): number;

  // --- Drawing helpers ---
  showPrompt(text: string, y: number, anchorY?: number): void;
  showClickPrompt(text: string, y: number, nextStep: TutorialStepName, nextDelay?: number): void;
  drawDimWithHole(cx: number, cy: number, r: number): void;
  drawDimWithCutout(x: number, y: number, w: number, h: number): void;
  drawDimWithRect(x: number, y: number, w: number, h: number): void;
  drawArrow(x: number, y: number, dir: 'up' | 'down' | 'right'): void;

  /** Add a manually-managed text/label that should be cleaned up when the
   *  step exits. Equivalent to TutorialScene.hudLabels.push(...). */
  trackLabel(obj: Phaser.GameObjects.GameObject): void;
  /** Set the click-anywhere zone used by game_hud. */
  setHudClickZone(zone: Phaser.GameObjects.Rectangle | null): void;

  /** Use the raw arrowGfx graphics object to draw bespoke arrows (e.g. the
   *  per-callout triangles in game_hud). Steps that just need a simple
   *  arrow should call drawArrow() instead. */
  arrowGfx: Phaser.GameObjects.Graphics;
  /** Use the raw overlay graphics object for bespoke dim shapes. */
  overlay: Phaser.GameObjects.Graphics;

  // --- Game control helpers ---
  pauseGame(): void;
  resumeGame(): void;
  spawnTutorialEnemies(count: number): void;

  // --- Transition helpers ---
  /** Schedule a transition to the named step. Pass delayMs > 0 for a
   *  blank-screen pause before the next step renders. */
  advanceTo(step: TutorialStepName, delayMs?: number): void;
  /** Force a re-render of the current step (e.g. to update a counter
   *  shown in the prompt). */
  showStep(): void;

  /** Read-only access to the active step / pending step. game_kill cares
   *  about kills counted while it's still pending. */
  readonly step: TutorialStepName;
  readonly pendingStep: TutorialStepName | null;
  /** Mutate the pending step directly. Used by onKill to skip game_kill
   *  if the player ground out 6 kills while the 2s lead-in was running. */
  setPendingStep(step: TutorialStepName | null): void;

  /** GameScene reference (untyped for now to avoid circular imports — the
   *  tutorial pokes at GameScene fields like buildState / selectedTower
   *  / player.money / loadingDone). */
  readonly gameScene: any;
}

/**
 * A tutorial step. Every step has at least a name + render(); event
 * handlers / update / lifecycle hooks are opt-in.
 *
 * Step-local mutable state (kill counters, watch timers) lives as fields
 * on the implementing class. Reset them in `enter()` so re-entering a
 * step (e.g. via skip-and-restart) starts fresh.
 */
export interface Step {
  readonly name: TutorialStepName;

  /** One-shot setup when the step becomes active. Reset counters here. */
  enter?(ctx: StepContext): void;

  /** Draw the step's prompt + overlay + arrows. Called whenever showStep
   *  fires (initial entry, viewport changed, counter changed, …). */
  render(ctx: StepContext): void;

  /** Cleanup when leaving the step. Most steps don't need this — the
   *  scene clears overlay/arrow/text/labels itself. */
  exit?(ctx: StepContext): void;

  /** Per-frame update. Called only while the step is active. */
  update?(ctx: StepContext, time: number, delta: number): void;

  // --- Event handlers (opt-in) ---
  onLevelClicked?(ctx: StepContext, levelId: number): void;
  onDiffClicked?(ctx: StepContext, diff: string): void;
  onGameReady?(ctx: StepContext): void;
  onBuildMode?(ctx: StepContext, active: boolean, kind: string, towerKind?: string): void;
  onKill?(ctx: StepContext): void;
  onTowerPlaced?(ctx: StepContext): void;
  onCoinCollected?(ctx: StepContext): void;
  onTowerSelected?(ctx: StepContext): void;
  onTowerUpgraded?(ctx: StepContext): void;
  onTowerDeselected?(ctx: StepContext): void;
  onWallPlaced?(ctx: StepContext): void;
}
