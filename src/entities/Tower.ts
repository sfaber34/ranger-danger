import Phaser from 'phaser';
import { CFG } from '../config';

export type TowerKind = 'arrow' | 'cannon';

export class Tower extends Phaser.Physics.Arcade.Sprite {
  kind: TowerKind;
  level = 0;
  hp: number;
  maxHp: number;
  totalSpent: number;
  lastShot = 0;
  stand: Phaser.GameObjects.Sprite | null = null; // static ballista stand (arrow only)
  top: Phaser.GameObjects.Sprite;
  nockedArrow: Phaser.GameObjects.Sprite | null = null; // real arrow resting on bow (arrow only)
  hpBar: Phaser.GameObjects.Graphics;
  tileX: number;
  tileY: number;
  size = CFG.tower.tiles;

  // visual tint per level per kind
  static readonly TIER_TINT: Record<TowerKind, number[]> = {
    arrow:  [0xffffff, 0xffffff, 0xffffff],
    cannon: [0xffffff, 0xffffff, 0xffffff]
  };

  constructor(scene: Phaser.Scene, tileX: number, tileY: number, kind: TowerKind = 'arrow') {
    const size = CFG.tower.tiles;
    const wx = (tileX + size / 2) * CFG.tile;
    const wy = (tileY + size / 2) * CFG.tile;
    const baseTex = kind === 'cannon' ? 'c_base' : 't_base';
    super(scene, wx, wy, baseTex);
    this.setScale(0.5);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static
    this.kind = kind;
    this.tileX = tileX;
    this.tileY = tileY;
    this.setDepth(6);
    const bodyRadius = (CFG.tile * this.size - 20) / 2;
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    // Center the circular body exactly on the grid cell. Pass the offset
    // through setCircle so updateFromGameObject re-inserts the body into the
    // static collision tree at the correct location. Mutating
    // body.position.x/y after updateFromGameObject does NOT update the
    // spatial tree, so collisions fire against the pre-override position —
    // that's what made the player jitter at the top/left edge of arrow
    // towers (their PNG is 128×128, while cannon PNG is 88×124, so the
    // pre-override body sat ~10px NW of grid for arrow vs ~0×9 for cannon).
    const offX = this.displayWidth / 2 - bodyRadius;
    const offY = this.displayHeight / 2 - bodyRadius;
    body.setCircle(bodyRadius, offX, offY);
    body.updateFromGameObject();

    const topOffY = kind === 'arrow' ? -24 : -20;

    if (kind === 'arrow') {
      // Static archer body standing on tower
      this.stand = scene.add.sprite(wx, wy + topOffY, 't_archer').setDepth(6.5).setScale(0.5);
    } else if (kind === 'cannon') {
      // Static cannon mount / carriage (doesn't rotate)
      this.stand = scene.add.sprite(wx, wy + topOffY, 'c_mount').setDepth(6.5).setScale(0.5);
    }

    // Rotating top (bow for arrow tower, barrel for cannon)
    const topTex = kind === 'cannon' ? 'c_top_0' : 't_top_0';
    this.top = scene.add.sprite(wx, wy + topOffY, topTex).setDepth(7).setScale(0.5);
    if (kind === 'arrow') {
      // Bow origin: further left so the bow extends out from the archer's body
      this.top.setOrigin(0.0, 0.5);
      // Real arrow resting on the bow — initial position matches the rotation=0 offset
      // used in updateTowers so it renders correctly before the first frame of aiming.
      this.nockedArrow = scene.add.sprite(wx + 23, wy + topOffY, 'arrow_0').setDepth(7.5).setScale(0.5);
    }

    this.hpBar = scene.add.graphics().setDepth(20);

    const s = this.stats();
    this.hp = s.hp;
    this.maxHp = s.hp;
    this.totalSpent = CFG.tower.kinds[kind].cost;
    this.applyTierVisual();
  }

  stats() {
    return CFG.tower.kinds[this.kind].levels[this.level];
  }

  canUpgrade(): boolean {
    return this.level < CFG.tower.kinds[this.kind].levels.length - 1;
  }

  upgradeCost(): number {
    return this.stats().upgradeCost;
  }

  upgrade(): boolean {
    if (!this.canUpgrade()) return false;
    this.level++;
    const s = this.stats();
    const ratio = this.hp / this.maxHp;
    this.maxHp = s.hp;
    this.hp = Math.ceil(s.hp * ratio);
    this.applyTierVisual();
    // pop fx
    const scale = 0.5;
    const targets = [this, this.top];
    if (this.stand) targets.push(this.stand);
    if (this.nockedArrow) targets.push(this.nockedArrow);
    this.scene.tweens.add({
      targets,
      scale: { from: scale * 1.15, to: scale },
      duration: 220,
      ease: 'Back.Out'
    });
    return true;
  }

  applyTierVisual() {
    // hurt() schedules a 60ms delayedCall that lands here. If a follow-up hit
    // kills the tower in that window the timer still fires on a destroyed
    // GameObject (Phaser nulls `scene` on destroy) — bail out.
    if (!this.scene) return;
    const tint = Tower.TIER_TINT[this.kind][this.level] ?? 0xffffff;
    this.setTint(tint);
    // Cannon top is already dark pixel art — don't wash it with tint.
    if (this.kind === 'cannon') this.top.clearTint();
    else this.top.setTint(tint);
    if (this.stand) this.stand.setTint(tint);
    if (this.nockedArrow) {
      // Match the per-level arrow projectile tint used in spawnProjectile
      const arrowTint = this.level === 2 ? 0xffd67a : this.level === 1 ? 0x9fd9ff : 0;
      if (arrowTint) this.nockedArrow.setTint(arrowTint);
      else this.nockedArrow.clearTint();
    }

    // Swap tower base sprite per upgrade level
    if (this.kind === 'arrow') {
      const baseKey = this.level === 2 ? 't_base_2' :
                      this.level === 1 ? 't_base_1' : 't_base';
      if (this.scene.textures.exists(baseKey)) {
        this.setTexture(baseKey);
        this.setTint(tint);
      }
    } else if (this.kind === 'cannon') {
      const baseKey = this.level === 2 ? 'c_base_2' :
                      this.level === 1 ? 'c_base_1' : 'c_base';
      if (this.scene.textures.exists(baseKey)) {
        this.setTexture(baseKey);
        this.setTint(tint);
      }
    }
  }

  hurt(amount: number) {
    this.hp -= amount;
    this.setTintFill(0xffffff);
    this.top.setTintFill(0xffffff);
    if (this.stand) this.stand.setTintFill(0xffffff);
    if (this.nockedArrow) this.nockedArrow.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => { this.applyTierVisual(); });
  }

  /** Cached values from the last drawHpBar paint — skip re-rendering when
   *  nothing changed (most frames, since most towers are full HP). */
  private _lastDrawnHp = -1;
  private _lastDrawnMaxHp = -1;

  drawHpBar() {
    if (this.hp === this._lastDrawnHp && this.maxHp === this._lastDrawnMaxHp) return;
    this._lastDrawnHp = this.hp;
    this._lastDrawnMaxHp = this.maxHp;
    this.hpBar.clear();
    // Always render — even at 100% — so the player can spot freshly damaged
    // towers immediately without having to wait for the bar to appear.
    const pct = Math.max(0, this.hp / this.maxHp);
    const w = 28, h = 3;
    const bx = this.x - w / 2;
    const by = this.y + CFG.tile * this.size / 2 + 3;
    this.hpBar.fillStyle(0x111826, 0.8);
    this.hpBar.fillRect(bx - 1, by - 1, w + 2, h + 2);
    const color = pct > 0.5 ? 0x4ad96a : pct > 0.25 ? 0xd9a84a : 0xd94a4a;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(bx, by, w * pct, h);
  }

  destroyTower() {
    this.hpBar.destroy();
    this.top.destroy();
    if (this.stand) this.stand.destroy();
    if (this.nockedArrow) this.nockedArrow.destroy();
    this.destroy();
  }
}
