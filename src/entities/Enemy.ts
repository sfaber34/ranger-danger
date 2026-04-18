import Phaser from 'phaser';
import { CFG } from '../config';

export type EnemyKind = 'basic' | 'heavy' | 'runner' | 'snake' | 'rat' | 'deer' | 'wolf' | 'bear' | 'spider' | 'infected_basic' | 'infected_heavy' | 'infected_runner' | 'crow' | 'bat' | 'dragonfly' | 'mosquito';

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
  flying = false;     // flying enemies ignore terrain and go straight to player
  noCoinDrop = false; // boss-spawned enemies don't drop coins
  targetRef: any = null; // current target object (player, tower, wall)
  facing: 'r' | 'l' = 'r'; // directional facing for bear

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
    const dataMap: Record<EnemyKind, typeof CFG.enemy.basic> = {
      basic: CFG.enemy.basic, heavy: CFG.enemy.heavy, runner: CFG.enemy.runner,
      snake: CFG.enemy.snake, rat: CFG.enemy.rat, deer: CFG.enemy.deer,
      wolf: CFG.enemy.wolf, bear: CFG.enemy.bear, spider: CFG.enemy.spider,
      infected_basic: CFG.enemy.basic, infected_heavy: CFG.enemy.heavy, infected_runner: CFG.enemy.runner,
      crow: CFG.enemy.crow, bat: CFG.enemy.bat, dragonfly: CFG.enemy.dragonfly, mosquito: CFG.enemy.mosquito,
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
      case 'snake':
        this.setScale(0.5).setSize(24, 16).setOffset(16, 18);
        this.play('esnk-move');
        break;
      case 'rat':
        this.setScale(0.45).setSize(22, 20).setOffset(20, 24);
        this.play('erat-move');
        break;
      case 'deer':
        this.setScale(0.55).setSize(30, 28).setOffset(14, 16);
        this.play('eder-move');
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
      case 'crow':
        this.setScale(0.5).setSize(24, 24).setOffset(20, 20);
        this.play('ecr-move');
        this.flying = true;
        break;
      case 'bat':
        this.setScale(0.5).setSize(26, 26).setOffset(19, 19);
        this.play('ebt-move');
        this.flying = true;
        break;
      case 'dragonfly':
        this.setScale(0.45).setSize(20, 20).setOffset(22, 22);
        this.play('edf-move');
        this.flying = true;
        break;
      case 'mosquito':
        this.setScale(0.45).setSize(20, 20).setOffset(22, 22);
        this.play('emq-move');
        this.flying = true;
        break;
    }
  }

  static texPrefix(kind: EnemyKind): string {
    switch (kind) {
      case 'heavy': return 'eh';
      case 'snake': return 'esnk';
      case 'rat': return 'erat';
      case 'deer': return 'eder';
      case 'infected_basic': return 'eib';
      case 'infected_heavy': return 'eih';
      case 'infected_runner': return 'eib'; // reuses infected basic sprites
      case 'wolf': return 'ew';
      case 'bear': return 'ear'; // default to right-facing
      case 'spider': return 'es';
      case 'crow': return 'ecr';
      case 'bat': return 'ebt';
      case 'dragonfly': return 'edf';
      case 'mosquito': return 'emq';
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

  /** Returns true if this enemy kind should rotate to face movement direction. */
  get rotates(): boolean {
    return this.kind === 'snake' || this.kind === 'rat';
  }

  /** Set rotation from a movement vector. Sprites face right at rotation 0.
   *  When moving left, flips X and negates the angle so the sprite never appears backwards. */
  rotateToward(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    if (dx < 0) {
      this.setFlipX(true);
      this.setFlipY(true);
      this.setRotation(Math.atan2(-dy, -dx));
    } else {
      this.setFlipX(false);
      this.setFlipY(false);
      this.setRotation(Math.atan2(dy, dx));
    }
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
      if (this.rotates) this.setRotation(0);
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      const prefix = this.dirPrefix();
      this.play(`${prefix}-die`);
      this.once('animationcomplete', () => this.destroy());
    }
  }
}
