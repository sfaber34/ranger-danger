import Phaser from 'phaser';
import { measureOpaqueBounds } from './spriteBounds';

/**
 * Flat oval shadow that sits under a sprite. Owns the underlying Ellipse,
 * stores a static Y offset from the sprite's center to its "ground" (computed
 * once at construction from the texture's visible pixel bounds), and tracks
 * the sprite's position when update() is called each frame.
 *
 * Depth is fixed at 7 — below enemy sprites (8), boss sprites (9), and well
 * below boss HP bars (20), so the shadow always renders behind the things
 * casting it but never in front of UI.
 */

// Tuning knobs.
const SHADOW_WIDTH_FRACTION = 0.9;   // shadow width = visible sprite width × this
const SHADOW_FLATNESS = 0.3;         // shadow height = shadow width × this
const SHADOW_COLOR = 0x000000;
const SHADOW_ALPHA = 0.25;
const SHADOW_DEPTH = 7;
const SHADOW_FLY_OFFSET = 20;        // extra world-px drop for flying entities to imply altitude

export class Shadow {
  private ellipse: Phaser.GameObjects.Ellipse;
  private groundOffset: number;

  /** Build a Shadow whose size and ground offset are derived from the
   *  texture's visible (non-transparent) pixel bounds, so transparent padding
   *  in the sprite sheet doesn't push the shadow away from the actual feet
   *  and doesn't oversize the ellipse. */
  static fromSprite(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    textureKey: string,
    opts: { flying?: boolean } = {},
  ): Shadow {
    const bounds = measureOpaqueBounds(scene, textureKey);
    let visibleWidth: number;
    let groundOffset: number;
    if (bounds) {
      visibleWidth = (bounds.right - bounds.left + 1) * sprite.scaleX;
      groundOffset = (bounds.bottom - bounds.sourceH / 2) * sprite.scaleY;
    } else {
      // Tainted canvas or fully-transparent texture — fall back to display dims.
      visibleWidth = sprite.displayWidth;
      groundOffset = sprite.displayHeight * 0.5 * 0.85;
    }
    return new Shadow(scene, visibleWidth * SHADOW_WIDTH_FRACTION, groundOffset, opts);
  }

  constructor(
    scene: Phaser.Scene,
    width: number,
    groundOffset: number,
    opts: { flying?: boolean } = {},
  ) {
    this.ellipse = scene.add.ellipse(0, 0, width, width * SHADOW_FLATNESS, SHADOW_COLOR, SHADOW_ALPHA);
    this.ellipse.setDepth(SHADOW_DEPTH);
    this.groundOffset = groundOffset + (opts.flying ? SHADOW_FLY_OFFSET : 0);
  }

  update(sprite: Phaser.GameObjects.Sprite): void {
    this.ellipse.setPosition(sprite.x, sprite.y + this.groundOffset);
  }

  destroy(): void {
    this.ellipse.destroy();
  }
}
