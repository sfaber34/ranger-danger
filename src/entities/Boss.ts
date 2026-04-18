import Phaser from 'phaser';
import { Biome } from '../levels';

export type BossState =
  | 'chase'
  | 'slam_wind'
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
  nextBoulder = 0;
  contactCd = 0;
  dying = false;

  chargeDirX = 1;
  chargeDirY = 0;
  lastSmoke = 0;

  // Pathfinding state (same as Enemy)
  path: { x: number; y: number }[] = [];
  pathIdx = 0;
  lastPath = 0;
  _pv = -1; // grid version tracker

  hpBar: Phaser.GameObjects.Graphics;

  // Animation prefix — 'boss' for meadow, 'fboss' for forest
  animPrefix: string;

  constructor(scene: Phaser.Scene, x: number, y: number, biome: Biome = 'grasslands') {
    const prefix = biome === 'forest' ? 'fboss' : biome === 'infected' ? 'iboss' : biome === 'river' ? 'rboss' : 'ram';
    super(scene, x, y, `${prefix}_idle0`);
    this.animPrefix = prefix;
    this.setScale(0.5);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    this.setSize(44, 44).setOffset(42, 52);
    this.play(`${prefix}-idle`);

    this.hpBar = scene.add.graphics().setDepth(20);

    const now = (scene as any).vTime ?? scene.time.now;
    this.nextBirth = now + 4000;
    this.nextCharge = now + 7500;
    this.nextSlam = now + 1500;
    this.nextBoulder = now + 3000;
  }

  drawHpBar() {
    this.hpBar.clear();
    if (this.dying || !this.active) return;
    const pct = Math.max(0, this.hp / this.maxHp);
    const w = 44, h = 4;
    const bx = this.x - w / 2;
    const by = this.y + 30;
    this.hpBar.fillStyle(0x111826, 0.85);
    this.hpBar.fillRect(bx - 1, by - 1, w + 2, h + 2);
    const color = pct > 0.5 ? 0xd94a4a : pct > 0.25 ? 0xd97a4a : 0xff3030;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(bx, by, w * pct, h);
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
      this.hpBar.destroy();
      const dieAnim = `${this.animPrefix}-die`;
      this.play(dieAnim);
      this.once(`animationcomplete-${dieAnim}`, () => this.destroy());
    }
  }
}
