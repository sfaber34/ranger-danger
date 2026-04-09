import Phaser from 'phaser';
import { CFG } from '../config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = CFG.player.hp;
  maxHp = CFG.player.hp;
  money = CFG.startMoney;
  kills = 0;
  lastShot = 0;
  invuln = 0;
  facing = 0; // radians

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'p_idle_0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setSize(14, 18).setOffset(9, 10);
    this.setDepth(10);
    this.play('player-idle');
  }

  hurt(amount: number, scene: Phaser.Scene) {
    const now = (scene as any).vTime ?? scene.time.now;
    if (this.invuln > now) return;
    this.hp -= amount;
    this.invuln = now + 500;
    this.play('player-hit', true);
    scene.tweens.add({
      targets: this, alpha: 0.3, yoyo: true, duration: 80, repeat: 3,
      onComplete: () => this.setAlpha(1)
    });
    scene.cameras.main.shake(120, 0.006);
  }
}
