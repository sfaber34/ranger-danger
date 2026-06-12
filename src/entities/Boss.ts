import Phaser from 'phaser';
import { Biome } from '../levels';
import { CFG } from '../config';
import { applyEntityVisual } from '../assets/spriteOverrides';
import { Shadow } from './Shadow';
import { measureOpaqueBounds } from './spriteBounds';

export type BossState =
  | 'chase'
  | 'slam_wind'
  | 'charge_wind'
  | 'charging'
  | 'dying';

export type BossKind = '' | 'queen' | 'dragon' | 'fissure_burrower' | 'desert_scorpion' | 'sandstorm_beast' | 'dune_wraith' | 'temple_construct' | 'sun_priest';

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
  flying = false;  // queen + fog phantom hover; controls shadow altitude

  chargeDirX = 1;
  chargeDirY = 0;
  lastSmoke = 0;

  // Pathfinding state (same as Enemy)
  path: { x: number; y: number }[] = [];
  pathIdx = 0;
  lastPath = 0;
  _pv = -1; // grid version tracker

  hpBar: Phaser.GameObjects.Graphics;
  shadow: Shadow | null = null;

  // Animation prefix — 'boss' for meadow, 'fboss' for forest
  animPrefix: string;

  bossKind: BossKind = '';

  constructor(scene: Phaser.Scene, x: number, y: number, biome: Biome = 'grasslands', bossKind: BossKind = '') {
    const prefix = bossKind === 'queen' ? 'cqboss'
                 : bossKind === 'dragon' ? 'cdboss'
                 : bossKind === 'fissure_burrower' ? 'dfboss'
                 : bossKind === 'desert_scorpion' ? 'dsboss'
                 : bossKind === 'sandstorm_beast' ? 'sbboss'
                 : bossKind === 'dune_wraith' ? 'dwboss'
                 : bossKind === 'temple_construct' ? 'dtboss'
                 : bossKind === 'sun_priest' ? 'spboss'
                 : biome === 'forest' ? 'fboss'
                 : biome === 'infected' ? 'iboss'
                 : biome === 'river' ? 'rboss'
                 : 'ram';
    const folder = bossKind === 'queen' ? 'boss_castle_q'
                 : bossKind === 'dragon' ? 'boss_castle_d'
                 : bossKind === 'fissure_burrower' ? 'boss_desert_burrower'
                 : bossKind === 'desert_scorpion' ? 'boss_desert_scorpion'
                 : bossKind === 'sandstorm_beast' ? 'boss_desert_sandstorm'
                 : bossKind === 'dune_wraith' ? 'boss_desert_wraith'
                 : bossKind === 'temple_construct' ? 'boss_desert_construct'
                 : bossKind === 'sun_priest' ? 'boss_desert_sun_priest'
                 : biome === 'forest' ? 'boss_forest'
                 : biome === 'infected' ? 'boss_infected'
                 : biome === 'river' ? 'boss_river'
                 : 'boss_meadow';
    super(scene, x, y, `${prefix}_idle0`);
    this.bossKind = bossKind;
    this.animPrefix = prefix;
    this.flying = prefix === 'cqboss' || prefix === 'rboss' || prefix === 'dwboss' || prefix === 'spboss';
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    // Visual scale comes from the shared CFG.bossScale knob; the physics
    // body is shrunk by the inverse ratio so the world-space hitbox stays
    // ~22px and bosses keep fitting through 1-tile wall gaps.
    const bodyComp = 0.5 / CFG.bossScale;
    const bw = Math.round(44 * bodyComp);
    applyEntityVisual(
      this, folder, 'move', CFG.bossScale,
      bw, bw,
      Math.round((128 - bw) / 2),     // recentre horizontally
      Math.round(96 - bw),            // keep the box anchored at the feet
    );
    this.play(`${prefix}-idle`);

    // Measure where the visible boss ends so the HP bar sits just below the
    // sprite rather than overlapping it. Different boss PNGs have wildly
    // different aspect ratios; a fixed offset can't fit all of them.
    this.hpBarYOffset = this.measureBarYOffset(`${prefix}_idle0`);

    // Shadow uses the same visible-pixel measurement under the hood, picking
    // up the boss's actual silhouette width and feet location regardless of
    // transparent padding.
    this.shadow = Shadow.fromSprite(scene, this, `${prefix}_idle0`, { flying: this.flying });
    this.shadow.update(this);

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

  /** World-space Y distance from sprite center to where the HP bar should
   *  sit. Computed once at construction by scanning the idle frame for the
   *  lowest non-transparent row, so the bar lines up with the visible
   *  bottom of the sprite even when bosses have very different heights. */
  private hpBarYOffset = 45;

  /** Distance from sprite center to where the HP bar should sit — just below
   *  the visible bottom of the boss. Reuses the shared opaque-bounds helper
   *  so transparent padding doesn't push the bar away. */
  private measureBarYOffset(textureKey: string): number {
    const bounds = measureOpaqueBounds(this.scene, textureKey);
    if (!bounds) return 45;
    const padding = 8;
    return (bounds.bottom - bounds.sourceH / 2) * this.scaleY + padding;
  }

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
    this.hpBar.setPosition(this.x, this.y + this.hpBarYOffset);
    this.shadow?.update(this);
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

  destroy(fromScene?: boolean) {
    this.shadow?.destroy();
    this.shadow = null;
    super.destroy(fromScene);
  }
}
