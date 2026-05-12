import type { Step, StepContext } from '../Step';

/** Informational beat that points at the speed hotbar slot and explains
 *  the 1x → 2x → 3x cycle. The slot itself stays locked until the
 *  tutorial finishes (UIScene gates click + SPACE on speedLocked), so
 *  this step just highlights and advances on click. */
export const gameSpeed: Step = {
  name: 'game_speed',

  render(ctx: StepContext) {
    const { W, H, p } = ctx;

    ctx.showClickPrompt(
      ctx.isMobile
        ? 'This slot cycles game speed: 1x → 2x → 3x.\nTap it (once the tutorial ends) to speed things up.'
        : 'This slot cycles game speed: 1x → 2x → 3x.\nPress SPACE or click it (once the tutorial ends) to speed things up.',
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
