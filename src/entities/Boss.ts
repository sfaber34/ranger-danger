import Phaser from 'phaser';
import { Biome } from '../levels';
import { applyEntityVisual } from '../assets/spriteOverrides';

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

  bossKind: string = ''; // e.g. 'queen', 'dragon' for castle bosses

  constructor(scene: Phaser.Scene, x: number, y: number, biome: Biome = 'grasslands', bossKind = '') {
    const prefix = bossKind === 'queen' ? 'cqboss'
                 : bossKind === 'dragon' ? 'cdboss'
                 : biome === 'forest' ? 'fboss'
                 : biome === 'infected' ? 'iboss'
                 : biome === 'river' ? 'rboss'
                 : 'ram';
    const folder = bossKind === 'queen' ? 'boss_castle_q'
                 : bossKind === 'dragon' ? 'boss_castle_d'
                 : biome === 'forest' ? 'boss_forest'
                 : biome === 'infected' ? 'boss_infected'
                 : biome === 'river' ? 'boss_river'
                 : 'boss_meadow';
    super(scene, x, y, `${prefix}_idle0`);
    this.bossKind = bossKind;
    this.animPrefix = prefix;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    applyEntityVisual(this, folder, 'move', 0.5, 44, 44, 42, 52);
    this.play(`${prefix}-idle`);

    this.hpBar = scene.add.graphics().setDepth(20);

    const now = (scene as any).vTime ?? scene.time.now;
    this.nextBirth = now + 4000;
    this.nextCharge = now + 7500;
    this.nextSlam = now + 1500;
    this.nextBoulder = now + 3000;
  }

  /** Cached values from the last bar repaint — skip the Graphics rebuild
   *  when nothing changed. The bar follows the boss via Graphics position
   *  (cheap), so the expensive clear/fill path only runs when HP shifts. */
  private _lastDrawnHp = -1;
  private _lastDrawnMaxHp = -1;
  private _barCleared = false;

  drawHpBar() {
    if (this.dying || !this.active) {
      if (!this._barCleared) {
        this.hpBar.clear();
        this._barCleared = true;
      }
      return;
    }
    // Position the Graphics object to follow the boss; the bar geometry
    // is drawn in local coords (0,0) so we don't need to repaint it.
    this.hpBar.setPosition(this.x, this.y + 30);
    if (this.hp === this._lastDrawnHp && this.maxHp === this._lastDrawnMaxHp) return;
    this._lastDrawnHp = this.hp;
    this._lastDrawnMaxHp = this.maxHp;
    this._barCleared = false;
    const pct = Math.max(0, this.hp / this.maxHp);
    const w = 44, h = 4;
    const bx = -w / 2;
    const by = 0;
    this.hpBar.clear();
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
      this.setVelocity(0, 0);
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      this.hpBar.destroy();
      // Boss death uses the same fx-death pop as enemies, scaled up to roughly
      // match the boss footprint (2× the 64-px enemy pop ≈ 128 world px).
      const pop = this.scene.add.sprite(this.x, this.y, 'fx_death_0').setDepth(this.depth + 0.5).setScale(2);
      pop.play('fx-death');
      pop.once('animationcomplete', () => pop.destroy());
      this.destroy();
    }
  }
}
