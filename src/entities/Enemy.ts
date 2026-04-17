import Phaser from 'phaser';
import { CFG } from '../config';

export type EnemyKind = 'basic' | 'heavy' | 'runner' | 'wolf' | 'bear' | 'spider' | 'infected_basic' | 'infected_heavy' | 'infected_runner';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  coin: number;
  baseTint = 0xffffff;
  path: { x: number; y: number }[] = [];
  pathIdx = 0;
  lastPath = 0;
  attackCd = 0;
  dying = false;
  noCoinDrop = false; // boss-spawned enemies don't drop coins
  targetRef: any = null; // current target object (player, tower, wall)
  facing: 'r' | 'l' = 'r'; // directional facing for bear

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
    const dataMap: Record<EnemyKind, typeof CFG.enemy.basic> = {
      basic: CFG.enemy.basic, heavy: CFG.enemy.heavy, runner: CFG.enemy.runner,
      wolf: CFG.enemy.wolf, bear: CFG.enemy.bear, spider: CFG.enemy.spider,
      infected_basic: CFG.enemy.basic, infected_heavy: CFG.enemy.heavy, infected_runner: CFG.enemy.runner,
    };
    const data = dataMap[kind];
    const texPrefix = Enemy.texPrefix(kind);
    super(scene, x, y, `${texPrefix}_move0`);
    this.kind = kind;
    this.hp = data.hp;
    this.maxHp = data.hp;
    this.speed = data.speed;
    this.dmg = data.dmg;
    this.coin = data.coin;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(8);

    switch (kind) {
      case 'basic':
        this.setScale(0.5).setSize(24, 24).setOffset(20, 24);
        this.play('eb-move');
        break;
      case 'heavy':
        this.setScale(0.5).setSize(32, 32).setOffset(16, 20);
        this.play('eh-move');
        break;
      case 'runner':
        this.setScale(0.425).setSize(20, 20).setOffset(22, 26);
        this.play('eb-move');
        this.baseTint = 0x6af078;
        this.setTint(this.baseTint);
        break;
      case 'wolf':
        this.setScale(0.45).setSize(22, 18).setOffset(21, 26);
        this.play('ew-move');
        break;
      case 'bear':
        this.setScale(0.55).setSize(30, 30).setOffset(17, 20);
        this.play('ear-move');
        break;
      case 'spider':
        this.setScale(0.45).setSize(24, 22).setOffset(20, 24);
        this.play('es-move');
        break;
      case 'infected_basic':
        this.setScale(0.5).setSize(24, 24).setOffset(20, 24);
        this.play('eib-move');
        break;
      case 'infected_heavy':
        this.setScale(0.5).setSize(32, 32).setOffset(16, 20);
        this.play('eih-move');
        break;
      case 'infected_runner':
        this.setScale(0.425).setSize(20, 20).setOffset(22, 26);
        this.play('eib-move');
        this.baseTint = 0xe0d020; // yellow tint for infected runners
        this.setTint(this.baseTint);
        break;
    }
  }

  static texPrefix(kind: EnemyKind): string {
    switch (kind) {
      case 'heavy': return 'eh';
      case 'infected_basic': return 'eib';
      case 'infected_heavy': return 'eih';
      case 'infected_runner': return 'eib'; // reuses infected basic sprites
      case 'wolf': return 'ew';
      case 'bear': return 'ear'; // default to right-facing
      case 'spider': return 'es';
      default: return 'eb';
    }
  }

  /** For bears: get the current directional prefix based on facing */
  dirPrefix(): string {
    if (this.kind === 'bear') return this.facing === 'l' ? 'eal' : 'ear';
    return Enemy.texPrefix(this.kind);
  }

  /** Update bear facing direction based on velocity. Returns true if direction changed. */
  updateFacing(vx: number): boolean {
    if (this.kind !== 'bear') return false;
    const newFacing = vx < 0 ? 'l' : 'r';
    if (newFacing !== this.facing) {
      this.facing = newFacing;
      return true;
    }
    return false;
  }

  hurt(amount: number) {
    if (this.dying) return;
    this.hp -= amount;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.dying) return;
      if (this.baseTint !== 0xffffff) this.setTint(this.baseTint);
      else this.clearTint();
    });
    if (this.hp <= 0) {
      this.dying = true;
      this.setVelocity(0, 0);
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      const prefix = this.dirPrefix();
      this.play(`${prefix}-die`);
      this.once('animationcomplete', () => this.destroy());
    }
  }
}
