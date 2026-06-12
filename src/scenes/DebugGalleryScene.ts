import Phaser from 'phaser';
import { CFG } from '../config';
import { generateAllArt } from '../assets/generateArt';
import towerBaseImg from '../assets/sprites/tower_base.png';
import arrowBase1Img from '../assets/sprites/arrow_base_1.png';
import arrowBase2Img from '../assets/sprites/arrow_base_2.png';
import cannonBaseImg from '../assets/sprites/cannon_base.png';
import cannonBase1Img from '../assets/sprites/cannon_base_1.png';
import cannonBase2Img from '../assets/sprites/cannon_base_2.png';
import {
  loadTreeOverrides,
  TREE_CLUSTER_CONFIG,
} from '../assets/treeOverrides';
import {
  loadInfectedPlantOverrides,
  INFECTED_PLANT_CLUSTER_CONFIG,
} from '../assets/infectedPlantOverrides';
import {
  applySpriteOverrides,
  getEntityVisualScale,
  getSpriteDebugCatalog,
  loadSpriteOverrides,
  reregisterSpriteOverrideAnimations,
  SpriteDebugEntry,
} from '../assets/spriteOverrides';

const BG = 0x070a0f;
const PANEL = 0x101827;
const PANEL_HI = 0x1d2b45;
const TEXT = '#d8e6ff';
const MUTED = '#7f93b3';
const ACCENT = '#4ad96a';
const WARN = '#ffd36a';

const ENTITY_PROC_SCALES: Record<string, number> = {
  basic: 0.5,
  heavy: 0.5,
  snake: 0.5,
  rat: 0.45,
  deer: 0.55,
  wolf: 0.45,
  bear: 0.55,
  spider: 0.45,
  infected_basic: 0.5,
  infected_heavy: 0.5,
  toad: 0.55,
  crow: 0.5,
  bat: 0.5,
  dragonfly: 0.45,
  mosquito: 0.45,
  skeleton: 0.5,
  warlock: 0.5,
  golem: 0.55,
  shadow_imp: 0.45,
  castle_rat: 0.45,
};

export function isDebugGalleryRequested(): boolean {
  if (new URLSearchParams(window.location.search).get('debug') !== 'gallery') return false;

  const hostname = window.location.hostname;
  return import.meta.env.DEV
    || import.meta.env.VITE_ENABLE_DEBUG_GALLERY === 'true'
    || hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.endsWith('.vercel.app');
}

function initialDebugTab(): 'gallery' | 'sandbox' {
  return new URLSearchParams(window.location.search).get('tab') === 'sandbox' ? 'sandbox' : 'gallery';
}

type GalleryCard = {
  y: number;
  height: number;
  root: Phaser.GameObjects.Container;
};

type StaticDebugGroup = {
  title: string;
  subtitle: string;
  textures: { key: string; label: string }[];
};

const STATIC_GROUPS: StaticDebugGroup[] = [
  {
    title: 'towers',
    subtitle: 'tower art',
    textures: [
      { key: 't_base', label: 'arrow base' },
      { key: 't_archer', label: 'archer' },
      { key: 'c_base', label: 'cannon base' },
      { key: 'c_top_0', label: 'cannon' },
    ],
  },
  {
    title: 'projectiles',
    subtitle: 'combat art',
    textures: [
      { key: 'arrow_0', label: 'arrow' },
      { key: 'cball_0', label: 'cannonball' },
      { key: 'boulder_0', label: 'boulder' },
      { key: 'dfball_0', label: 'dragon fire' },
    ],
  },
  {
    title: 'effects',
    subtitle: 'fx art',
    textures: [
      { key: 'coin_0', label: 'coin' },
      { key: 'fx_hit_0', label: 'hit' },
      { key: 'fx_death_0', label: 'death' },
      { key: 'dfexpl_0', label: 'explosion' },
    ],
  },
  {
    title: 'terrain',
    subtitle: 'world props',
    textures: [
      { key: 'wall_15', label: 'wall' },
      { key: 'tree_cluster_0', label: 'trees' },
      { key: 'infected_plant_0', label: 'plants' },
      { key: 'castle_spikes_0', label: 'spikes' },
    ],
  },
  {
    title: 'indicators',
    subtitle: 'hud markers',
    textures: [
      { key: 'ind_arrow', label: 'arrow' },
      { key: 'ind_cannon', label: 'cannon' },
      { key: 'ind_boss', label: 'boss' },
      { key: 'ind_ptr', label: 'pointer' },
    ],
  },
];

export class DebugGalleryScene extends Phaser.Scene {
  private cards: GalleryCard[] = [];
  private content!: Phaser.GameObjects.Container;
  private focus!: Phaser.GameObjects.Container;
  private sandbox!: Phaser.GameObjects.Container;
  private tabButtons: Phaser.GameObjects.Container[] = [];
  private selected: SpriteDebugEntry | null = null;
  private mode: 'gallery' | 'sandbox' = 'gallery';
  private selectedAnimIndex = 0;
  private playbackSpeed = 1;
  private previewScale = 1;
  private paused = false;
  private sandboxSprite: Phaser.GameObjects.Sprite | null = null;
  private sandboxAnimLabel: Phaser.GameObjects.Text | null = null;
  private sandboxScaleValue: Phaser.GameObjects.Text | null = null;
  private sandboxSpeedValue: Phaser.GameObjects.Text | null = null;
  private sandboxHpValue: Phaser.GameObjects.Text | null = null;
  private sandboxMoveValue: Phaser.GameObjects.Text | null = null;
  private sandboxDamageValue: Phaser.GameObjects.Text | null = null;
  private sandboxLineupSprite: Phaser.GameObjects.Sprite | null = null;
  private sandboxLineupScaleValue: Phaser.GameObjects.Text | null = null;
  private sandboxLineupBaseY = 0;
  private sandboxLineupTopY = 0;
  private sandboxBgIndex = 0;
  private readonly sandboxBgs = [0x070a0f, 0x151515, 0x263044, 0x304226, 0x56302c];
  private sandboxMaxHp = 20;
  private sandboxHp = 20;
  private sandboxMoveSpeed = 60;
  private sandboxDamage = 8;
  private sandboxUnitX = 0;
  private sandboxUnitDir = 1;
  private sandboxStage = { x: 0, y: 0, w: 0, h: 0 };
  private pixelRatio = 1;
  private layoutW = CFG.width;
  private layoutH = CFG.height;
  private scrollY = 0;
  private maxScroll = 0;
  private readonly headerH = 70;
  private readonly focusH = 154;

  constructor() { super('DebugGallery'); }

  preload() {
    if (!this.textures.exists('t_base_png')) this.load.image('t_base_png', towerBaseImg);
    if (!this.textures.exists('t_base_1_png')) this.load.image('t_base_1_png', arrowBase1Img);
    if (!this.textures.exists('t_base_2_png')) this.load.image('t_base_2_png', arrowBase2Img);
    if (!this.textures.exists('c_base_png')) this.load.image('c_base_png', cannonBaseImg);
    if (!this.textures.exists('c_base_1_png')) this.load.image('c_base_1_png', cannonBase1Img);
    if (!this.textures.exists('c_base_2_png')) this.load.image('c_base_2_png', cannonBase2Img);
    loadTreeOverrides(this);
    loadInfectedPlantOverrides(this);
    loadSpriteOverrides(this, null);
  }

  create() {
    this.resizeDebugCanvas();
    generateAllArt(this);
    applySpriteOverrides(this);
    reregisterSpriteOverrideAnimations(this);

    const W = this.layoutW;
    const H = this.layoutH;

    this.cameras.main.setBackgroundColor(BG);
    this.add.rectangle(W / 2, this.headerH / 2, W, this.headerH, 0x05070c, 1).setDepth(20);
    this.add.text(18, 18, 'Ranger Danger Debug Gallery', {
      fontFamily: 'monospace', fontSize: '22px', color: ACCENT,
    }).setDepth(21);
    this.add.text(20, 46, '?debug=gallery | click a card to inspect | wheel / arrows / page keys scroll', {
      fontFamily: 'monospace', fontSize: '12px', color: MUTED,
    }).setDepth(21);
    this.makeTabButton(W - 256, 18, 'Gallery', 'gallery');
    this.makeTabButton(W - 128, 18, 'Sandbox', 'sandbox');

    this.focus = this.add.container(0, this.headerH).setDepth(15);
    this.content = this.add.container(0, this.headerH + this.focusH + 16);
    this.sandbox = this.add.container(0, this.headerH).setDepth(16).setVisible(false);

    this.buildCards();
    this.selectEntry(getSpriteDebugCatalog()[0] ?? null);
    this.rebuildSandbox();
    this.setMode(initialDebugTab());
    this.updateScroll(0);
    this.sharpenDebugText();

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _targets: unknown, _dx: number, dy: number) => {
      this.updateScroll(this.scrollY + dy);
    });
    this.input.keyboard?.on('keydown-UP', () => this.updateScroll(this.scrollY - 64));
    this.input.keyboard?.on('keydown-DOWN', () => this.updateScroll(this.scrollY + 64));
    this.input.keyboard?.on('keydown-PAGE_UP', () => this.updateScroll(this.scrollY - H * 0.75));
    this.input.keyboard?.on('keydown-PAGE_DOWN', () => this.updateScroll(this.scrollY + H * 0.75));
    this.input.keyboard?.on('keydown-HOME', () => this.updateScroll(0));
    this.input.keyboard?.on('keydown-END', () => this.updateScroll(this.maxScroll));
  }

  private resizeDebugCanvas() {
    this.pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.layoutW = Math.max(1, Math.round(window.innerWidth));
    this.layoutH = Math.max(1, Math.round(window.innerHeight));

    this.scale.scaleMode = Phaser.Scale.ScaleModes.FIT;
    this.scale.setGameSize(this.layoutW, this.layoutH);
    this.scale.refresh();
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.game.canvas.style.width = `${this.layoutW}px`;
    this.game.canvas.style.height = `${this.layoutH}px`;
    this.game.canvas.style.imageRendering = 'auto';
  }

  private makeTabButton(x: number, y: number, label: string, mode: 'gallery' | 'sandbox') {
    const root = this.add.container(x, y).setDepth(22);
    const bg = this.add.rectangle(0, 0, 112, 34, PANEL, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2a3760, 1);
    const text = this.add.text(56, 17, label, {
      fontFamily: 'monospace', fontSize: '15px', color: TEXT,
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, 112, 34, 0x000000, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.setMode(mode));
    root.add([bg, text, hit]);
    root.setData('bg', bg);
    root.setData('mode', mode);
    this.tabButtons.push(root);
  }

  private setMode(mode: 'gallery' | 'sandbox') {
    this.mode = mode;
    this.focus.setVisible(mode === 'gallery');
    this.content.setVisible(mode === 'gallery');
    this.sandbox.setVisible(mode === 'sandbox');
    this.setContainerAnimationsPaused(this.focus, mode !== 'gallery');
    this.setContainerAnimationsPaused(this.content, mode !== 'gallery');
    for (const tab of this.tabButtons) {
      const bg = tab.getData('bg') as Phaser.GameObjects.Rectangle;
      const active = tab.getData('mode') === mode;
      bg.setFillStyle(active ? 0x1e4a2e : PANEL, 1);
      bg.setStrokeStyle(1, active ? 0x4ad96a : 0x2a3760, 1);
    }
    if (mode === 'sandbox') this.rebuildSandbox();
  }

  private buildCards() {
    const entries = getSpriteDebugCatalog();
    const W = this.layoutW;
    const cardW = 284;
    const cardH = 116;
    const gap = 14;
    const cols = Math.max(1, Math.floor((W - gap) / (cardW + gap)));
    const left = Math.floor((W - (cols * cardW + (cols - 1) * gap)) / 2);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = left + col * (cardW + gap);
      const y = row * (cardH + gap);
      const root = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, cardW, cardH, PANEL, 1)
        .setOrigin(0)
        .setStrokeStyle(1, entry.kind === 'boss' ? 0xb84a3a : entry.kind === 'player' ? 0x4ad96a : 0x33435f, 0.9);
      root.add(bg);

      root.add(this.add.text(12, 10, entry.folder, {
        fontFamily: 'monospace', fontSize: '14px', color: TEXT,
      }));
      root.add(this.add.text(12, 30, `${entry.kind} | ${entry.texPrefix}`, {
        fontFamily: 'monospace', fontSize: '11px', color: MUTED,
      }));

      const anims = entry.anims.filter(a => this.anims.exists(a.animKey)).slice(0, 4);
      for (let a = 0; a < anims.length; a++) {
        const x0 = 48 + a * 56;
        const label = this.add.text(x0, 92, anims[a].suffix, {
          fontFamily: 'monospace', fontSize: '10px', color: MUTED,
        }).setOrigin(0.5);
        const sprite = this.add.sprite(x0, 66, this.firstTextureFor(anims[a].animKey))
          .setOrigin(0.5)
          .setScale(1);
        sprite.play(anims[a].animKey);
        this.fitSprite(sprite, 48, 48, 1);
        root.add([sprite, label]);
      }

      const hit = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.selectEntry(entry));
      hit.on('pointerover', () => bg.setFillStyle(PANEL_HI, 1));
      hit.on('pointerout', () => bg.setFillStyle(PANEL, 1));
      root.add(hit);

      this.content.add(root);
      this.cards.push({ y, height: cardH, root });
    }

    for (let s = 0; s < STATIC_GROUPS.length; s++) {
      this.addStaticCard(STATIC_GROUPS[s], entries.length + s, left, cols, cardW, cardH, gap);
    }

    const rows = Math.ceil((entries.length + STATIC_GROUPS.length) / cols);
    const contentH = rows * cardH + Math.max(0, rows - 1) * gap;
    this.maxScroll = Math.max(0, contentH - (this.layoutH - this.headerH - this.focusH - 24));
  }

  private addStaticCard(group: StaticDebugGroup, index: number, left: number, cols: number, cardW: number, cardH: number, gap: number) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = left + col * (cardW + gap);
    const y = row * (cardH + gap);
    const root = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, cardW, cardH, PANEL, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5a4d2a, 0.9);
    root.add(bg);
    root.add(this.add.text(12, 10, group.title, {
      fontFamily: 'monospace', fontSize: '14px', color: TEXT,
    }));
    root.add(this.add.text(12, 30, group.subtitle, {
      fontFamily: 'monospace', fontSize: '11px', color: MUTED,
    }));

    for (let i = 0; i < group.textures.length; i++) {
      const tex = group.textures[i];
      if (!this.textures.exists(tex.key)) continue;
      const x0 = 48 + i * 56;
      const sprite = this.add.sprite(x0, 66, tex.key).setOrigin(0.5);
      this.fitSprite(sprite, 46, 46, 1.2);
      const label = this.add.text(x0, 92, tex.label, {
        fontFamily: 'monospace', fontSize: '9px', color: MUTED,
      }).setOrigin(0.5);
      root.add([sprite, label]);
    }

    const hit = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.selectStaticGroup(group));
    hit.on('pointerover', () => bg.setFillStyle(PANEL_HI, 1));
    hit.on('pointerout', () => bg.setFillStyle(PANEL, 1));
    root.add(hit);

    this.content.add(root);
    this.cards.push({ y, height: cardH, root });
  }

  private selectEntry(entry: SpriteDebugEntry | null) {
    this.selected = entry;
    this.selectedAnimIndex = 0;
    if (entry) this.resetSandboxStats(entry);
    this.focus.removeAll(true);

    const W = this.layoutW;
    this.focus.add(this.add.rectangle(W / 2, this.focusH / 2, W - 28, this.focusH, 0x0b111d, 1)
      .setStrokeStyle(1, 0x263957, 1));

    if (!entry) return;

    this.focus.add(this.add.text(26, 18, `${entry.folder}`, {
      fontFamily: 'monospace', fontSize: '22px', color: TEXT,
    }));
    this.focus.add(this.add.text(28, 48, `${entry.kind} preview`, {
      fontFamily: 'monospace', fontSize: '12px', color: MUTED,
    }));

    const anims = entry.anims.filter(a => this.anims.exists(a.animKey)).slice(0, 4);
    for (let i = 0; i < anims.length; i++) {
      const x = 180 + i * 98;
      const sprite = this.add.sprite(x, 82, this.firstTextureFor(anims[i].animKey))
        .setScale(1)
        .play(anims[i].animKey);
      this.fitSprite(sprite, 82, 82, entry.kind === 'boss' ? 0.75 : 1.4);
      const label = this.add.text(x, 128, anims[i].suffix, {
        fontFamily: 'monospace', fontSize: '12px', color: MUTED,
      }).setOrigin(0.5);
      this.focus.add([sprite, label]);
    }
    if (this.mode === 'sandbox') this.rebuildSandbox();
    this.sharpenDebugText();
  }

  private selectStaticGroup(group: StaticDebugGroup) {
    this.selected = null;
    this.focus.removeAll(true);

    const W = this.layoutW;
    this.focus.add(this.add.rectangle(W / 2, this.focusH / 2, W - 28, this.focusH, 0x0b111d, 1)
      .setStrokeStyle(1, 0x263957, 1));
    this.focus.add(this.add.text(26, 18, group.title, {
      fontFamily: 'monospace', fontSize: '22px', color: TEXT,
    }));
    this.focus.add(this.add.text(28, 48, group.subtitle, {
      fontFamily: 'monospace', fontSize: '12px', color: MUTED,
    }));

    for (let i = 0; i < group.textures.length; i++) {
      const tex = group.textures[i];
      if (!this.textures.exists(tex.key)) continue;
      const x = 180 + i * 98;
      const sprite = this.add.sprite(x, 82, tex.key).setOrigin(0.5);
      this.fitSprite(sprite, 72, 72, 1.5);
      const label = this.add.text(x, 128, tex.label, {
        fontFamily: 'monospace', fontSize: '12px', color: MUTED,
      }).setOrigin(0.5);
      this.focus.add([sprite, label]);
    }
    this.sharpenDebugText();
  }

  private rebuildSandbox() {
    this.sandbox.removeAll(true);
    this.sandboxSprite = null;
    this.sandboxAnimLabel = null;
    this.sandboxScaleValue = null;
    this.sandboxSpeedValue = null;
    this.sandboxHpValue = null;
    this.sandboxMoveValue = null;
    this.sandboxDamageValue = null;
    this.sandboxLineupSprite = null;
    this.sandboxLineupScaleValue = null;
    this.sandboxLineupBaseY = 0;
    this.sandboxLineupTopY = 0;

    const W = this.layoutW;
    const H = this.layoutH - this.headerH;
    this.sandbox.add(this.add.rectangle(W / 2, H / 2, W - 28, H - 24, this.sandboxBgs[this.sandboxBgIndex], 1)
      .setStrokeStyle(1, 0x263957, 1));

    if (!this.selected) {
      this.sandbox.add(this.add.text(30, 28, 'Select an animated sprite in Gallery first.', {
        fontFamily: 'monospace', fontSize: '18px', color: WARN,
      }));
      return;
    }

    const entry = this.selected;
    const anims = entry.anims.filter(a => this.anims.exists(a.animKey));
    if (anims.length === 0) {
      this.sandbox.add(this.add.text(30, 28, `${entry.folder} has no registered animations.`, {
        fontFamily: 'monospace', fontSize: '18px', color: WARN,
      }));
      return;
    }
    this.selectedAnimIndex = Phaser.Math.Clamp(this.selectedAnimIndex, 0, anims.length - 1);
    const anim = anims[this.selectedAnimIndex];

    this.sandbox.add(this.add.text(30, 26, `${entry.folder}`, {
      fontFamily: 'monospace', fontSize: '24px', color: TEXT,
    }));
    this.sandboxAnimLabel = this.add.text(30, 58, `${entry.kind} | ${anim.suffix} | ${anim.animKey}`, {
      fontFamily: 'monospace', fontSize: '13px', color: MUTED,
    });
    this.sandbox.add(this.sandboxAnimLabel);

    const compact = W < 720;
    const stageW = compact ? Math.min(W - 72, 430) : Math.min(460, Math.max(360, W * 0.38));
    const stageH = compact ? 220 : Math.min(330, Math.max(280, H * 0.52));
    const stageX = compact ? W / 2 : 44 + stageW / 2;
    const lineupH = 180;
    const lineupTop = compact ? 84 : Math.max(86, H * 0.14);
    const stageY = lineupTop + lineupH + 8 + stageH / 2;
    this.sandboxStage = { x: stageX, y: stageY, w: stageW, h: stageH };
    this.addSandboxScaleLineup(entry, anim.animKey, {
      x: stageX,
      y: lineupTop + lineupH / 2,
      w: stageW,
      h: lineupH,
    });
    this.sandbox.add(this.add.rectangle(stageX, stageY, stageW, stageH, 0x000000, 0.22)
      .setStrokeStyle(1, 0x33435f, 0.9));
    this.sandboxUnitX = stageX;
    this.sandboxSprite = this.add.sprite(stageX, stageY, this.firstTextureFor(anim.animKey)).play(anim.animKey);
    this.sandboxSprite.x = this.sandboxUnitX;
    this.sandbox.add(this.sandboxSprite);
    this.applySandboxPlayback();

    const controlsX = compact ? W / 2 : Math.min(W - 210, Math.max(stageX + stageW / 2 + 236, W * 0.72));
    const controlsTop = compact ? stageY + stageH / 2 + 4 : 96;
    this.sandbox.add(this.add.text(controlsX, controlsTop, 'Sandbox Controls', {
      fontFamily: 'monospace', fontSize: '22px', color: ACCENT,
    }).setOrigin(0.5));
    this.addButton(controlsX - 120, controlsTop + 46, '< Anim', () => this.cycleAnim(-1));
    this.addButton(controlsX, controlsTop + 46, this.paused ? 'Resume' : 'Pause', () => {
      this.paused = !this.paused;
      this.rebuildSandbox();
    });
    this.addButton(controlsX + 120, controlsTop + 46, 'Anim >', () => this.cycleAnim(1));
    this.addButton(controlsX - 120, controlsTop + 96, 'Step', () => this.stepFrame());
    this.addButton(controlsX, controlsTop + 96, 'BG', () => {
      this.sandboxBgIndex = (this.sandboxBgIndex + 1) % this.sandboxBgs.length;
      this.rebuildSandbox();
    });
    this.addButton(controlsX + 120, controlsTop + 96, 'Reset', () => {
      this.previewScale = 1;
      this.playbackSpeed = 1;
      this.paused = false;
      this.resetSandboxStats(entry);
      this.rebuildSandbox();
    });
    this.addButton(controlsX - 60, controlsTop + 146, 'Hit', () => this.damageSandboxUnit());
    this.addButton(controlsX + 60, controlsTop + 146, 'Kill', () => this.killSandboxUnit());

    const sliderTop = controlsTop + 196;
    const sliderGap = 58;
    this.sandbox.add(this.add.text(controlsX - 160, sliderTop, 'Scale', {
      fontFamily: 'monospace', fontSize: '16px', color: TEXT,
    }));
    this.sandboxScaleValue = this.add.text(controlsX + 154, sliderTop, '', {
      fontFamily: 'monospace', fontSize: '16px', color: MUTED,
    }).setOrigin(1, 0);
    this.sandbox.add(this.sandboxScaleValue);
    this.addSlider(controlsX - 160, sliderTop + 30, 320, 0.5, 3, this.previewScale, (v) => {
      this.previewScale = v;
      this.applySandboxPlayback();
    });

    this.sandbox.add(this.add.text(controlsX - 160, sliderTop + sliderGap, 'Playback', {
      fontFamily: 'monospace', fontSize: '16px', color: TEXT,
    }));
    this.sandboxSpeedValue = this.add.text(controlsX + 154, sliderTop + sliderGap, '', {
      fontFamily: 'monospace', fontSize: '16px', color: MUTED,
    }).setOrigin(1, 0);
    this.sandbox.add(this.sandboxSpeedValue);
    this.addSlider(controlsX - 160, sliderTop + sliderGap + 30, 320, 0.1, 3, this.playbackSpeed, (v) => {
      this.playbackSpeed = v;
      this.applySandboxPlayback();
    });

    this.sandbox.add(this.add.text(controlsX - 160, sliderTop + sliderGap * 2, 'HP', {
      fontFamily: 'monospace', fontSize: '16px', color: TEXT,
    }));
    this.sandboxHpValue = this.add.text(controlsX + 154, sliderTop + sliderGap * 2, '', {
      fontFamily: 'monospace', fontSize: '16px', color: MUTED,
    }).setOrigin(1, 0);
    this.sandbox.add(this.sandboxHpValue);
    this.addSlider(controlsX - 160, sliderTop + sliderGap * 2 + 30, 320, 1, 1000, this.sandboxMaxHp, (v) => {
      this.sandboxMaxHp = Math.round(v);
      this.sandboxHp = Math.min(this.sandboxHp, this.sandboxMaxHp);
      this.updateSandboxStatLabels();
    });

    this.sandbox.add(this.add.text(controlsX - 160, sliderTop + sliderGap * 3, 'Move Speed', {
      fontFamily: 'monospace', fontSize: '16px', color: TEXT,
    }));
    this.sandboxMoveValue = this.add.text(controlsX + 154, sliderTop + sliderGap * 3, '', {
      fontFamily: 'monospace', fontSize: '16px', color: MUTED,
    }).setOrigin(1, 0);
    this.sandbox.add(this.sandboxMoveValue);
    this.addSlider(controlsX - 160, sliderTop + sliderGap * 3 + 30, 320, 0, 220, this.sandboxMoveSpeed, (v) => {
      this.sandboxMoveSpeed = Math.round(v);
      this.updateSandboxStatLabels();
    });

    this.sandbox.add(this.add.text(controlsX - 160, sliderTop + sliderGap * 4, 'Damage', {
      fontFamily: 'monospace', fontSize: '16px', color: TEXT,
    }));
    this.sandboxDamageValue = this.add.text(controlsX + 154, sliderTop + sliderGap * 4, '', {
      fontFamily: 'monospace', fontSize: '16px', color: MUTED,
    }).setOrigin(1, 0);
    this.sandbox.add(this.sandboxDamageValue);
    this.addSlider(controlsX - 160, sliderTop + sliderGap * 4 + 30, 320, 1, 120, this.sandboxDamage, (v) => {
      this.sandboxDamage = Math.round(v);
      this.updateSandboxStatLabels();
    });
    this.updateSandboxStatLabels();
    this.sharpenDebugText();
  }

  private sharpenDebugText() {
    this.applyTextResolution(this.children.list);
  }

  private applyTextResolution(children: Phaser.GameObjects.GameObject[]) {
    for (const child of children) {
      if (child instanceof Phaser.GameObjects.Text) {
        child.setResolution(Math.max(2, this.pixelRatio));
      } else if (child instanceof Phaser.GameObjects.Container) {
        this.applyTextResolution(child.list);
      }
    }
  }

  private setContainerAnimationsPaused(container: Phaser.GameObjects.Container, paused: boolean) {
    for (const child of container.list) {
      if (child instanceof Phaser.GameObjects.Sprite) {
        if (paused) child.anims.pause();
        else child.anims.resume();
      } else if (child instanceof Phaser.GameObjects.Container) {
        this.setContainerAnimationsPaused(child, paused);
      }
    }
  }

  private addButton(x: number, y: number, label: string, onClick: () => void) {
    const bg = this.add.rectangle(x, y, 112, 40, PANEL, 1)
      .setStrokeStyle(1, 0x33435f, 1);
    const text = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '15px', color: TEXT,
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, 112, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => bg.setFillStyle(PANEL_HI, 1));
    hit.on('pointerout', () => bg.setFillStyle(PANEL, 1));
    hit.on('pointerdown', onClick);
    this.sandbox.add([bg, text, hit]);
  }

  private addSlider(
    x: number,
    y: number,
    w: number,
    min: number,
    max: number,
    value: number,
    onChange: (value: number) => void,
  ) {
    const track = this.add.rectangle(x, y, w, 6, 0x263957, 1).setOrigin(0, 0.5);
    const fill = this.add.rectangle(x, y, 1, 6, 0x4ad96a, 1).setOrigin(0, 0.5);
    const handle = this.add.rectangle(x, y, 14, 24, 0xd8e6ff, 1)
      .setStrokeStyle(1, 0x000000, 0.7)
      .setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(handle);

    const update = (next: number) => {
      const clamped = Phaser.Math.Clamp(next, min, max);
      const t = (clamped - min) / (max - min);
      fill.width = Math.max(1, w * t);
      handle.x = x + w * t;
      handle.y = y;
      onChange(clamped);
    };
    update(value);

    const setFromPointer = (pointerX: number) => update(min + Phaser.Math.Clamp((pointerX - x) / w, 0, 1) * (max - min));
    track.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Phaser.Input.Pointer) => setFromPointer(pointer.x));
    fill.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Phaser.Input.Pointer) => setFromPointer(pointer.x));
    handle.on('drag', (pointer: Phaser.Input.Pointer) => setFromPointer(pointer.x));
    this.sandbox.add([track, fill, handle]);
  }

  private addSandboxScaleLineup(
    entry: SpriteDebugEntry,
    animKey: string,
    bounds: { x: number; y: number; w: number; h: number },
  ) {
    const { x, y, w, h } = bounds;
    const baseY = y + h / 2 - 32;
    this.sandboxLineupBaseY = baseY;
    this.sandboxLineupTopY = y - h / 2 + 28;
    const labelY = baseY + 10;
    const treeKey = TREE_CLUSTER_CONFIG.pngKey(0) ?? 'tree_cluster_0';
    const plantKey = INFECTED_PLANT_CLUSTER_CONFIG.pngKey(0) ?? 'infected_plant_0';
    const items = [
      { label: 'player', key: 'p_idle_0', anim: 'player-idle', scale: 0.5 },
      { label: entry.folder, key: this.firstTextureFor(animKey), anim: animKey, selected: true },
      { label: 'arrow tower', key: 't_base', scale: 0.5 },
      { label: 'cannon', key: 'c_base', scale: 0.5 },
      { label: 'tree', key: treeKey, scale: this.worldHeightScale(treeKey, TREE_CLUSTER_CONFIG.targetWorldHeight) },
      {
        label: 'plant',
        key: plantKey,
        scale: this.worldHeightScale(
          plantKey,
          INFECTED_PLANT_CLUSTER_CONFIG.targetWorldHeight
            * (INFECTED_PLANT_CLUSTER_CONFIG.variantScales?.[0] ?? 1),
        ),
      },
      { label: 'wall', key: 'wall_15', scale: 0.5 },
    ];
    const step = w / items.length;
    const startX = x - w / 2 + step / 2;

    this.sandbox.add(this.add.rectangle(x, y, w, h, 0x000000, 0.22)
      .setStrokeStyle(1, 0x33435f, 0.9));
    this.sandbox.add(this.add.rectangle(x, baseY + 6, w - 24, 3, 0x5c6f50, 0.9));
    this.sandbox.add(this.add.text(x - w / 2 + 14, y - h / 2 + 10, 'World Scale Lineup', {
      fontFamily: 'monospace', fontSize: '13px', color: ACCENT,
    }));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!this.textures.exists(item.key)) continue;
      const itemX = startX + step * i;
      const sprite = this.add.sprite(itemX, baseY, item.key).setOrigin(0.5, 1);
      if (item.anim && this.anims.exists(item.anim)) sprite.play(item.anim);
      if (item.selected) {
        this.sandboxLineupSprite = sprite;
        this.updateSandboxLineupScale();
      } else {
        sprite.setScale(item.scale ?? 1);
      }
      this.sandbox.add(sprite);
      if (item.label === 'arrow tower') this.addLineupTowerTop(itemX, baseY, sprite.displayHeight);
      if (item.label === 'cannon') this.addLineupCannonTop(itemX, baseY, sprite.displayHeight);
      this.sandbox.add(this.add.text(itemX, labelY, item.label, {
        fontFamily: 'monospace', fontSize: '10px', color: item.selected ? TEXT : MUTED,
      }).setOrigin(0.5, 0));
    }

    this.sandboxLineupScaleValue = this.add.text(x + w / 2 - 14, y - h / 2 + 10, '', {
      fontFamily: 'monospace', fontSize: '12px', color: MUTED,
    }).setOrigin(1, 0);
    this.sandbox.add(this.sandboxLineupScaleValue);
    this.updateSandboxLineupScale();
  }

  private updateSandboxLineupScale() {
    if (!this.sandboxLineupSprite || !this.selected) return;
    const baseScale = this.selected.kind === 'player'
      ? 0.5
      : getEntityVisualScale(this, this.selected.folder, 'move', ENTITY_PROC_SCALES[this.selected.folder] ?? 0.5);
    this.sandboxLineupSprite.setScale(baseScale * this.previewScale);
    this.sandboxLineupSprite.y = Math.max(
      this.sandboxLineupBaseY,
      this.sandboxLineupTopY + this.sandboxLineupSprite.displayHeight,
    );
    this.sandboxLineupSprite.anims.timeScale = this.playbackSpeed;
    if (this.paused) this.sandboxLineupSprite.anims.pause();
    else this.sandboxLineupSprite.anims.resume();
    this.sandboxLineupScaleValue?.setText(`selected ${this.previewScale.toFixed(2)}x`);
  }

  private worldHeightScale(textureKey: string, targetWorldHeight: number) {
    if (!this.textures.exists(textureKey)) return 1;
    const image = this.textures.get(textureKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    return targetWorldHeight / Math.max(1, image.height);
  }

  private addLineupTowerTop(x: number, baseY: number, baseH: number) {
    const centerY = baseY - baseH / 2;
    for (const [key, offY] of [['t_archer', -24], ['t_top_0', -24]] as const) {
      if (!this.textures.exists(key)) continue;
      this.sandbox.add(this.add.sprite(x, centerY + offY, key).setScale(0.5));
    }
  }

  private addLineupCannonTop(x: number, baseY: number, baseH: number) {
    const centerY = baseY - baseH / 2;
    for (const [key, offY] of [['c_mount', -20], ['c_top_0', -20]] as const) {
      if (!this.textures.exists(key)) continue;
      this.sandbox.add(this.add.sprite(x, centerY + offY, key).setScale(0.5));
    }
  }

  private cycleAnim(dir: number) {
    if (!this.selected) return;
    const anims = this.selected.anims.filter(a => this.anims.exists(a.animKey));
    if (anims.length === 0) return;
    this.selectedAnimIndex = Phaser.Math.Wrap(this.selectedAnimIndex + dir, 0, anims.length);
    this.paused = false;
    this.rebuildSandbox();
  }

  private stepFrame() {
    if (!this.sandboxSprite) return;
    this.paused = true;
    this.sandboxSprite.anims.pause();
    this.sandboxSprite.anims.nextFrame();
    this.applySandboxPlayback();
  }

  private applySandboxPlayback() {
    if (!this.sandboxSprite || !this.selected) return;
    const frameW = this.sandboxSprite.frame.realWidth || this.sandboxSprite.width || 1;
    const frameH = this.sandboxSprite.frame.realHeight || this.sandboxSprite.height || 1;
    const baseScale = Math.min(1, 180 / frameW, 180 / frameH);
    const stageScaleCap = Math.min(
      (this.sandboxStage.w - 48) / frameW,
      (this.sandboxStage.h - 88) / frameH,
    );
    this.sandboxSprite.setScale(Math.min(baseScale * this.previewScale, stageScaleCap));
    this.sandboxSprite.anims.timeScale = this.playbackSpeed;
    if (this.paused) this.sandboxSprite.anims.pause();
    else this.sandboxSprite.anims.resume();
    this.sandboxScaleValue?.setText(`${this.previewScale.toFixed(2)}x`);
    this.sandboxSpeedValue?.setText(`${this.playbackSpeed.toFixed(2)}x`);
    this.updateSandboxLineupScale();
    this.updateSandboxStatLabels();
  }

  private resetSandboxStats(entry: SpriteDebugEntry) {
    const enemyCfg = (CFG.enemy as Record<string, { hp: number; speed: number; dmg: number } | undefined>)[entry.folder];
    if (enemyCfg) {
      this.sandboxMaxHp = enemyCfg.hp;
      this.sandboxMoveSpeed = enemyCfg.speed;
      this.sandboxDamage = enemyCfg.dmg;
    } else if (entry.kind === 'boss') {
      this.sandboxMaxHp = 800;
      this.sandboxMoveSpeed = 28;
      this.sandboxDamage = 15;
    } else if (entry.kind === 'player') {
      this.sandboxMaxHp = CFG.player.hp;
      this.sandboxMoveSpeed = CFG.player.speed;
      this.sandboxDamage = CFG.player.damage;
    } else {
      this.sandboxMaxHp = 20;
      this.sandboxMoveSpeed = 60;
      this.sandboxDamage = 8;
    }
    this.sandboxHp = this.sandboxMaxHp;
    this.sandboxUnitX = 0;
    this.sandboxUnitDir = 1;
  }

  private damageSandboxUnit() {
    if (!this.sandboxSprite) return;
    this.sandboxHp = Math.max(1, this.sandboxHp - this.sandboxDamage);
    const target = this.sandboxSprite;
    target.setTintFill(0xffffff);
    this.time.delayedCall(60, () => {
      if (!target.scene || target !== this.sandboxSprite) return;
      target.clearTint();
    });
    const fxScale = this.sandboxEffectScale(target, 1.2);
    const spark = this.add.sprite(this.sandboxSprite.x, this.sandboxSprite.y, 'fx_hit_0')
      .setScale(fxScale)
      .setDepth(30);
    this.sandbox.add(spark);
    spark.play('fx-hit');
    spark.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spark.destroy());
    this.time.delayedCall(250, () => {
      if (spark.scene) spark.destroy();
    });
    this.updateSandboxStatLabels();
  }

  private killSandboxUnit(setHp = true) {
    if (!this.sandboxSprite) return;
    if (setHp) this.sandboxHp = 0;
    const target = this.sandboxSprite;
    const fxScale = this.sandboxEffectScale(target, this.selected?.kind === 'boss' ? 2 : 1.4);
    const pop = this.add.sprite(this.sandboxSprite.x, this.sandboxSprite.y, 'fx_death_0')
      .setScale(fxScale)
      .setDepth(30);
    this.sandbox.add(pop);
    pop.play('fx-death');
    pop.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pop.destroy());
    this.time.delayedCall(400, () => {
      if (pop.scene) pop.destroy();
    });
    target.destroy();
    this.sandboxSprite = null;
    this.updateSandboxStatLabels();
  }

  private sandboxEffectScale(sprite: Phaser.GameObjects.Sprite, baseScale: number) {
    const size = Math.max(sprite.displayWidth, sprite.displayHeight);
    return Phaser.Math.Clamp(baseScale * (size / 64), baseScale * 0.7, baseScale * 3);
  }

  private updateSandboxStatLabels() {
    this.sandboxHpValue?.setText(`${this.sandboxHp} / ${this.sandboxMaxHp}`);
    this.sandboxMoveValue?.setText(`${this.sandboxMoveSpeed}px/s`);
    this.sandboxDamageValue?.setText(`${this.sandboxDamage}`);
  }

  private firstTextureFor(animKey: string): string {
    const anim = this.anims.get(animKey);
    const first = anim.frames[0];
    return first.textureKey;
  }

  private fitSprite(sprite: Phaser.GameObjects.Sprite, maxW: number, maxH: number, maxScale: number) {
    const frameW = sprite.frame.realWidth || sprite.width || 1;
    const frameH = sprite.frame.realHeight || sprite.height || 1;
    const scale = Math.min(maxScale, maxW / frameW, maxH / frameH);
    sprite.setScale(scale);
  }

  private updateScroll(next: number) {
    this.scrollY = Phaser.Math.Clamp(next, 0, this.maxScroll);
    this.content.y = this.headerH + this.focusH + 16 - this.scrollY;

    const top = this.scrollY - 140;
    const bottom = this.scrollY + CFG.height;
    for (const card of this.cards) {
      card.root.setVisible(card.y + card.height >= top && card.y <= bottom);
    }
  }
}
