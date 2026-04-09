import Phaser from 'phaser';

export type BossState =
  | 'chase'
  | 'slam_wind'
  | 'birthing'
  | 'charge_wind'
  | 'charging'
  | 'dying';

export class Boss extends Phaser.Physics.Arcade.Sprite {
  hp = 1500;
  maxHp = 1500;
  speed = 28;
  dmg = 20; // contact damage

  state: BossState = 'chase';
  stateEnd = 0;
  nextSlam = 0;
  nextBirth = 0;
  nextCharge = 0;
  contactCd = 0;
  dying = false;

  chargeDirX = 1;
  chargeDirY = 0;
  lastSmoke = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss_idle0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    this.setSize(50, 46).setOffset(7, 14);
    this.play('boss-idle');

    const now = (scene as any).vTime ?? scene.time.now;
    this.nextBirth = now + 4000;
    this.nextCharge = now + 7500;
    this.nextSlam = now + 1500;
  }

  hurt(amount: number) {
    if (this.dying) return;
    this.hp -= amount;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => { if (!this.dying) this.clearTint(); });
    if (this.hp <= 0) {
      this.dying = true;
      this.state = 'dying';
      this.setVelocity(0, 0);
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      this.play('boss-die');
      this.once('animationcomplete-boss-die', () => this.destroy());
    }
  }
}
