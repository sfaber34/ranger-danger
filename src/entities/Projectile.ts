import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage = 10;
  lifetime = 1500;
  born = 0;
  splashRadius = 0;
  // Ground-target for cannonballs — explodes on arrival, not on enemy hit
  groundTarget = false;
  groundX = 0;
  groundY = 0;
  startX = 0;
  startY = 0;
  totalDist = 0;
  shadow: Phaser.GameObjects.Sprite | null = null;
  arcOffset = 0; // current visual Y offset (pixels above ground)

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'arrow_0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    this.play('arrow-spin');
    this.setSize(10, 4).setOffset(10, 14);
  }

  fire(tx: number, ty: number, speed: number, damage: number, splashRadius = 0) {
    this.damage = damage;
    this.splashRadius = splashRadius;
    this.born = (this.scene as any).vTime ?? this.scene.time.now;
    const angle = Math.atan2(ty - this.y, tx - this.x);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.setActive(true).setVisible(true);
    this.arcOffset = 0;

    if (splashRadius > 0) {
      // Cannonball
      this.groundTarget = true;
      this.groundX = tx;
      this.groundY = ty;
      this.startX = this.x;
      this.startY = this.y;
      this.totalDist = Math.hypot(tx - this.x, ty - this.y) || 1;
      this.setTexture('cball_0');
      this.play('cball-spin');
      this.setRotation(0);
      this.setScale(1);
      this.clearTint();
      this.setSize(8, 8).setOffset(12, 12);
      this.setDepth(14);

      // Ground shadow
      this.shadow = this.scene.add.sprite(this.x, this.y, 'cball_shadow')
        .setDepth(5)
        .setAlpha(0.35)
        .setScale(0.5);
    } else {
      // Arrow
      this.groundTarget = false;
      this.setTexture('arrow_0');
      this.play('arrow-spin');
      this.setRotation(angle);
      this.setScale(1);
      this.clearTint();
      this.setSize(10, 4).setOffset(10, 14);
      this.setDepth(9);
      if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
    }
  }

  preDestroy() {
    if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
  }
}
