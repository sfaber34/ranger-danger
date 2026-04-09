import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage = 10;
  lifetime = 1500;
  born = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'arrow_0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    this.play('arrow-spin');
    this.setSize(10, 4).setOffset(10, 14);
  }

  fire(tx: number, ty: number, speed: number, damage: number) {
    this.damage = damage;
    this.born = (this.scene as any).vTime ?? this.scene.time.now;
    const angle = Math.atan2(ty - this.y, tx - this.x);
    this.setRotation(angle);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.setActive(true).setVisible(true);
  }
}
