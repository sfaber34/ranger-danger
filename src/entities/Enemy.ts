import Phaser from 'phaser';
import { CFG } from '../config';
import { applyEntityVisual } from '../assets/spriteOverrides';

export type EnemyKind = 'basic' | 'heavy' | 'runner' | 'snake' | 'rat' | 'deer' | 'wolf' | 'bear' | 'spider' | 'infected_basic' | 'infected_heavy' | 'infected_runner' | 'toad' | 'crow' | 'bat' | 'dragonfly' | 'mosquito' | 'skeleton' | 'warlock' | 'golem' | 'shadow_imp' | 'castle_bat' | 'castle_rat';

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
      infected_basic: CFG.enemy.basic, infected_heavy: CFG.enemy.heavy, infected_runner: CFG.enemy.runner, toad: CFG.enemy.toad,
      crow: CFG.enemy.crow, bat: CFG.enemy.bat, dragonfly: CFG.enemy.dragonfly, mosquito: CFG.enemy.mosquito,
      skeleton: CFG.enemy.skeleton, warlock: CFG.enemy.warlock, golem: CFG.enemy.golem,
      shadow_imp: CFG.enemy.shadow_imp, castle_bat: CFG.enemy.castle_bat, castle_rat: CFG.enemy.castle_rat,
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
        applyEntityVisual(this, 'basic', 'move', 0.5, 24, 24, 20, 24);
        this.play('eb-move');
        break;
      case 'heavy':
        applyEntityVisual(this, 'heavy', 'move', 0.5, 32, 32, 16, 20);
        this.play('eh-move');
        break;
      case 'runner':
        applyEntityVisual(this, 'basic', 'move', 0.425, 20, 20, 22, 26);
        this.play('eb-move');
        this.baseTint = 0x6af078;
        this.setTint(this.baseTint);
        break;
      case 'snake':
        applyEntityVisual(this, 'snake', 'move', 0.5, 24, 16, 16, 18);
        this.play('esnk-move');
        break;
      case 'rat':
        applyEntityVisual(this, 'rat', 'move', 0.45, 22, 20, 20, 24);
        this.play('erat-move');
        break;
      case 'deer':
        applyEntityVisual(this, 'deer', 'move', 0.55, 30, 28, 14, 16);
        this.play('eder-move');
        break;
      case 'wolf':
        applyEntityVisual(this, 'wolf', 'move', 0.45, 22, 18, 21, 26);
        this.play('ew-move');
        break;
      case 'bear':
        applyEntityVisual(this, 'bear-right', 'move', 0.55, 30, 30, 17, 20);
        this.play('ear-move');
        break;
      case 'spider': {
        applyEntityVisual(this, 'spider', 'move', 0.45, 24, 22, 20, 24);
        this.play('es-move');
        // Random forest spider color variety
        const spiderTints = [
          0xffffff, // default black
          0xb09070, // brown recluse
          0x80a060, // green garden spider
          0xc0a040, // golden orb weaver
          0xa07050, // wood spider
          0x90b0a0, // grey-green
        ];
        this.baseTint = spiderTints[Math.floor(Math.random() * spiderTints.length)];
        if (this.baseTint !== 0xffffff) this.setTint(this.baseTint);
        break;
      }
      case 'infected_basic':
        applyEntityVisual(this, 'infected-basic', 'move', 0.5, 24, 24, 20, 24);
        this.play('eib-move');
        break;
      case 'infected_heavy':
        applyEntityVisual(this, 'infected-heavy', 'move', 0.5, 32, 32, 16, 20);
        this.play('eih-move');
        break;
      case 'infected_runner':
        applyEntityVisual(this, 'infected-basic', 'move', 0.425, 20, 20, 22, 26);
        this.play('eib-move');
        this.baseTint = 0xe0d020; // yellow tint for infected runners
        this.setTint(this.baseTint);
        break;
      case 'toad':
        applyEntityVisual(this, 'toad', 'hop', 0.55, 28, 24, 18, 22);
        this.play('etd-idle');
        break;
      case 'crow':
        applyEntityVisual(this, 'crow', 'move', 0.5, 24, 24, 20, 20);
        this.play('ecr-move');
        this.flying = true;
        break;
      case 'bat':
        applyEntityVisual(this, 'bat', 'move', 0.5, 26, 26, 19, 19);
        this.play('ebt-move');
        this.flying = true;
        break;
      case 'dragonfly':
        applyEntityVisual(this, 'dragonfly', 'move', 0.45, 20, 20, 22, 22);
        this.play('edf-move');
        this.flying = true;
        break;
      case 'mosquito':
        applyEntityVisual(this, 'mosquito', 'move', 0.45, 20, 20, 22, 22);
        this.play('emq-move');
        this.flying = true;
        break;
      // Castle enemies
      case 'skeleton':
        applyEntityVisual(this, 'skeleton', 'move', 0.5, 24, 24, 20, 24);
        this.play('esk-move');
        break;
      case 'warlock':
        applyEntityVisual(this, 'warlock', 'move', 0.5, 24, 24, 20, 24);
        this.play('ewl-move');
        break;
      case 'golem':
        applyEntityVisual(this, 'golem', 'move', 0.55, 30, 30, 17, 20);
        this.play('ego-move');
        break;
      case 'shadow_imp':
        applyEntityVisual(this, 'shadow-imp', 'move', 0.45, 20, 20, 22, 26);
        this.play('esi-move');
        break;
      case 'castle_bat':
        applyEntityVisual(this, 'castle-bat', 'move', 0.45, 20, 20, 22, 22);
        this.play('ecb-move');
        this.flying = true;
        break;
      case 'castle_rat':
        applyEntityVisual(this, 'castle-rat', 'move', 0.45, 22, 20, 20, 24);
        this.play('ecrat-move');
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
      case 'toad': return 'etd';
      case 'wolf': return 'ew';
      case 'bear': return 'ear'; // default to right-facing
      case 'spider': return 'es';
      case 'crow': return 'ecr';
      case 'bat': return 'ebt';
      case 'dragonfly': return 'edf';
      case 'mosquito': return 'emq';
      case 'skeleton': return 'esk';
      case 'warlock': return 'ewl';
      case 'golem': return 'ego';
      case 'shadow_imp': return 'esi';
      case 'castle_bat': return 'ecb';
      case 'castle_rat': return 'ecrat';
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
    return this.kind === 'snake' || this.kind === 'rat' || this.kind === 'castle_rat';
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
      const pop = this.scene.add.sprite(this.x, this.y, 'fx_death_0').setDepth(this.depth + 0.5);
      pop.play('fx-death');
      pop.once('animationcomplete', () => pop.destroy());
      this.destroy();
    }
  }
}
