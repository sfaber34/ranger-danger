import Phaser from 'phaser';

export type CoinTier = 'bronze' | 'silver' | 'gold';

export class Coin extends Phaser.Physics.Arcade.Sprite {
  value = 1;
  tier: CoinTier = 'bronze';
  born = 0;
  collecting = false;

  constructor(scene: Phaser.Scene, x: number, y: number, tier: CoinTier = 'bronze') {
    super(scene, x, y, `coin_${tier}_0`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.tier = tier;
    this.value = tier === 'gold' ? 3 : tier === 'silver' ? 2 : 1;
    this.born = scene.time.now;
    this.setDepth(7);
    this.setSize(12, 12).setOffset(10, 10);
    this.play(`coin-${tier}-spin`);
    // little pop on spawn
    this.setScale(0.6);
    scene.tweens.add({ targets: this, scale: 1, duration: 180, ease: 'Back.Out' });
  }
}
