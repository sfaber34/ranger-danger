import Phaser from 'phaser';
import { CFG } from '../config';
import { SFX } from '../audio/sfx';
import { DEBUG } from '../debug.config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = CFG.player.hp;
  maxHp = CFG.player.hp;
  money = CFG.startMoney;
  kills = 0;
  lastShot = 0;
  invuln = 0;
  facing = 0; // radians
  facingRight = true; // last horizontal direction
  bow: Phaser.GameObjects.Sprite;
  nockedArrow: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'p_idle_0');
    this.setScale(0.5);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(14, 18, 22);
    this.setDepth(10);
    this.play('player-idle');

    // Separate bow sprite that rotates to aim
    this.bow = scene.add.sprite(x, y, 'bow_0').setDepth(11).setOrigin(0.25, 0.5).setScale(0.5);
    // Real arrow nocked on the bow — the same projectile sprite that will fly when firing
    this.nockedArrow = scene.add.sprite(x, y, 'arrow_0').setDepth(11.5).setScale(0.5);
  }

  hurt(amount: number, scene: Phaser.Scene) {
    if (DEBUG.noDamage) return;
    const now = (scene as any).vTime ?? scene.time.now;
    if (this.invuln > now) return;
    this.hp -= amount;
    // Stats — track damage actually taken (post-invuln). Touch via any
    // to avoid pulling GameScene types into this file.
    const stats = (scene as any).runStats;
    if (stats) stats.damageTaken += amount;
    this.invuln = now + 500;
    SFX.play('playerHurt');
    this.play('player-hit', true);
    scene.tweens.add({
      targets: this, alpha: 0.3, yoyo: true, duration: 80, repeat: 3,
      onComplete: () => this.setAlpha(1)
    });
    scene.cameras.main.shake(120, 0.006);
  }
}
