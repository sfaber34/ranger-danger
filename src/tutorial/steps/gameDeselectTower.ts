import type { Step, StepContext } from '../Step';

/**
 * "Click/Tap somewhere else to close the tower panel." If the player
 * already deselected the tower during the 1.5s lead-in delay before
 * this step rendered, skip straight to the speed beat — there's
 * nothing left to do here.
 */
export const gameDeselectTower: Step = {
  name: 'game_deselect_tower',

  render(ctx: StepContext) {
    if (!ctx.gameScene?.selectedTower) {
      ctx.advanceTo('game_speed', 1500);
      return;
    }
    ctx.showPrompt(
      ctx.isMobile
        ? 'Tap somewhere else to close the tower panel.'
        : 'Click somewhere else to close the tower panel.',
      ctx.p(150),
    );
  },

  onTowerDeselected(ctx: StepContext) {
    ctx.advanceTo('game_speed', 1500);
  },
};
