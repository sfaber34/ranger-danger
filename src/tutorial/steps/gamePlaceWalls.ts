import type { Step, StepContext, TutorialStepName } from '../Step';
import { CFG } from '../../config';

function nextStepAfterBuild(ctx: StepContext): TutorialStepName {
  const upgradeCost = CFG.tower.kinds.arrow.levels[0].upgradeCost;
  const money = ctx.gameScene?.player?.money ?? 0;
  return money >= upgradeCost ? 'game_click_tower' : 'game_collect_60';
}

/**
 * "Place 3 walls to funnel enemies." Prompt updates with wall-placed
 * count; on the 3rd wall we auto-exit build mode, spawn a wave so the
 * walls have something to funnel, and jump straight to the post-build
 * step. The exit-build hint is folded into the prompt instead of
 * standing on its own beat — keeps the wall placement → fight payoff
 * tight.
 */
export class GamePlaceWallsStep implements Step {
  readonly name = 'game_place_walls' as const;

  private wallsPlaced = 0;

  enter() {
    this.wallsPlaced = 0;
  }

  render(ctx: StepContext) {
    const { W, H, p } = ctx;
    const exitHint = ctx.isMobile
      ? 'Tip: tap the wall icon to leave build mode.'
      : 'Tip: right-click or ESC to leave build mode.';
    ctx.showPrompt(
      `Place walls to funnel enemies past your tower! (${this.wallsPlaced}/3)\nEnemies will pathfind around walls.\n${exitHint}`,
      p(150),
    );
    ctx.overlay.fillStyle(0x000000, 0.15);
    ctx.overlay.fillRect(0, 0, W, H);
  }

  onWallPlaced(ctx: StepContext) {
    this.wallsPlaced++;
    if (this.wallsPlaced >= 3) {
      ctx.gameScene?.build?.setBuild('none');
      ctx.spawnTutorialEnemies(6);
      ctx.advanceTo(nextStepAfterBuild(ctx));
    } else {
      ctx.showStep();
    }
  }
}
