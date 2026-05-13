import type { Step, StepContext } from '../Step';
import { getEvents } from '../../core/events';

/** Highlights the speed hotbar slot and explains the 1x → 2x → 3x cycle.
 *  Emits `tutorial-speed-unlocked` on entry so the player can actually
 *  press the slot while reading the prompt — the broader UPGRADES lock
 *  stays on until `tutorial-finished` fires after the next beat. */
export const gameSpeed: Step = {
  name: 'game_speed',

  enter(ctx: StepContext) {
    getEvents(ctx.scene.game.events).emit('tutorial-speed-unlocked');
  },

  render(ctx: StepContext) {
    const { W, H, p } = ctx;

    ctx.showClickPrompt(
      ctx.isMobile
        ? 'This slot cycles game speed: 1x → 2x → 3x.\nTap it to speed things up!'
        : 'This slot cycles game speed: 1x → 2x → 3x.\nPress SPACE or click it to speed things up!',
      H - p(160),
      'game_done',
    );

    const slotSize = p(48);
    const slotGap = p(10);
    const slots = 5;
    const hotbarY = H - slotSize - p(32);
    const barCenterX = W / 2;
    const speedSlotX = barCenterX
      - (slots * slotSize + (slots - 1) * slotGap) / 2
      + 4 * (slotSize + slotGap) + slotSize / 2;

    ctx.drawDimWithRect(
      speedSlotX - slotSize / 2 - p(4),
      hotbarY - p(4),
      slotSize + p(8),
      slotSize + p(8),
    );
    ctx.drawArrow(speedSlotX, hotbarY - p(12), 'down');
  },
};
