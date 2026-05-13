import type { Step, StepContext } from '../Step';

/**
 * "Watch the tower fight." Drip-feeds enemies for the new tower to mow
 * down (waiting 3s after entry so the player can read the prompt), then
 * advances to game_press_4 once the tower has cleared 6 kills and the
 * field is empty.
 */
export class GameWatchTowerStep implements Step {
  readonly name = 'game_watch_tower' as const;

  private kills = 0;
  private watchTimer = 0;

  enter() {
    this.kills = 0;
    this.watchTimer = 0;
  }

  render(ctx: StepContext) {
    ctx.showPrompt('Your tower will auto-shoot enemies!', ctx.p(150));
  }

  update(ctx: StepContext, _time: number, delta: number) {
    this.watchTimer += delta;
    const enemies = ctx.gameScene?.enemies;
    if (this.watchTimer > 3000 && this.kills < 6 && enemies?.countActive() < 3) {
      ctx.spawnTutorialEnemies(2);
    }
    if (this.kills >= 6 && enemies?.countActive() === 0) {
      ctx.advanceTo('game_press_4', 2000);
    }
  }

  onKill() {
    this.kills++;
  }
}
