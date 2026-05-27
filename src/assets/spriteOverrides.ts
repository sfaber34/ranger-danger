import Phaser from 'phaser';
import { Biome, Difficulty } from '../levels';
import { measureOpaqueBounds } from '../entities/spriteBounds';
import { CFG } from '../config';

/** Folders whose sheets are needed in every level — Player is always rendered;
 *  endless mode loads everything else on top. */
const UNIVERSAL_FOLDERS = ['player'];

/** Campaign-mode roster per biome. Endless ignores this and loads every
 *  folder. Keys in the inner arrays match the `folder` field in BUILTIN /
 *  the on-disk src/assets/sprites/<folder>/ directories. */
const CAMPAIGN_BIOME_FOLDERS: Record<Biome, string[]> = {
  grasslands: ['basic', 'heavy', 'snake', 'rat', 'deer', 'boss_meadow', 'boss_grasslands'],
  forest:     ['bear', 'spider', 'wolf', 'boss_forest'],
  infected:   ['toad', 'infected_basic', 'infected_heavy', 'boss_infected'],
  river:      ['crow', 'bat', 'dragonfly', 'mosquito', 'boss_river'],
  castle:     ['skeleton', 'warlock', 'golem', 'shadow_imp', 'castle_bat', 'castle_rat', 'boss_castle_q', 'boss_castle_d'],
  // Unimplemented biomes — fall back to loading everything if a future level
  // somehow routes here, so a missing entry doesn't ship as broken sprites.
  desert:   [],
  tundra:   [],
  volcanic: [],
};

/** Returns the set of CHARACTER folders to load for this (biome, difficulty)
 *  combination, or `null` to mean "load everything" — endless mode and
 *  unrecognized/unimplemented biomes. */
export function biomeFolderFilter(biome: Biome, difficulty: Difficulty): Set<string> | null {
  if (difficulty === 'endless') return null;
  const biomeFolders = CAMPAIGN_BIOME_FOLDERS[biome];
  if (!biomeFolders || biomeFolders.length === 0) return null;
  return new Set([...UNIVERSAL_FOLDERS, ...biomeFolders]);
}

// ============================================================================
// USER CONFIG
// ============================================================================
//
// Drop a horizontal sprite sheet at src/assets/sprites/<name>/<anim>.png
// where <name> is the enemy/character folder name (e.g. 'rat', 'wolf', 'player')
// and <anim> is the animation suffix (move, atk, shoot, hit, die, birth).
// Frames are auto-sliced from the sheet by assuming square frames.
//
// Idle is auto-derived from frame_0 of the primary motion animation.
// Enemies handle hit (white tint flash) and death (fx-death pop) programmatically,
// so most enemies just need move.png + atk.png.
//
// To tweak how a character renders, add an entry to OVERRIDES below.
// Available knobs:
//
//   pngScaleMultiplier — 1.0 (default) renders at the same world size as
//                        the procedural sprite. 1.5 = 50% bigger, 0.8 = 20%
//                        smaller, etc.
//
//   anims.<suffix>.frameCount  — override auto-detection if your sheet's
//                                frames aren't square (and so width/height
//                                doesn't give the right count).
//   anims.<suffix>.skipLast    — drop N trailing frames from the animation
//                                (useful when an AI tool tacks on a duplicate
//                                frame at the end).
//   anims.<suffix>.fps         — playback frame rate for this animation
//                                (only applies when a PNG sheet is loaded;
//                                procedural keeps its tuned rate).
//
// Names that work in OVERRIDES match the sprite-folder names: basic, heavy,
// snake, rat, deer, wolf, bear, spider, infected_basic, infected_heavy, crow,
// bat, dragonfly, mosquito, skeleton, warlock, golem, shadow_imp, castle_bat,
// castle_rat, toad, player, plus the bosses (boss_grasslands, boss_meadow,
// boss_infected, boss_forest, boss_river, boss_castle_q, boss_castle_d).
// Bosses only need move.png + atk.png — hit flash and death pop are programmatic.
//
// DEFAULTS are applied to every character. Per-character OVERRIDES below
// override individual fields. To turn off a default for a single character,
// set the field explicitly in OVERRIDES.
//
// Examples:
//   wolf: { pngScaleMultiplier: 1.2 }                     // smaller than 1.5 default
//   rat:  { anims: { move: { skipLast: 1 }, atk: { fps: 8 } } }

type CharacterOverrides = {
  pngScaleMultiplier?: number;
  anims?: Record<string, { frameCount?: number; skipLast?: number; fps?: number }>;
};

const DEFAULTS: CharacterOverrides = {
  pngScaleMultiplier: 1.5,
  anims: {
    move:   { fps: 12 },
    atk:    { fps: 12 },
    dash:   { fps: 24 },
    windup: { fps: 12 },
  },
};

const OVERRIDES: Record<string, CharacterOverrides> = {
  rat:  { pngScaleMultiplier: 1.0, anims: { move: { skipLast: 1 } } },
  castle_rat:  { pngScaleMultiplier: 1.0, anims: { move: { skipLast: 1 } } },
  spider:  { pngScaleMultiplier: 1.2,  anims: { move: { fps: 18 } } },
  wolf:  { anims: { move: { fps: 24 } } },
  bear:  { pngScaleMultiplier: 2.4,  anims: { move: { fps: 18 }, atk: { fps: 24 } } },
  golem:  { pngScaleMultiplier: 1.3, anims: { atk: { fps: 20 } } },
  crow:  { pngScaleMultiplier: 1.2,  anims: { move: { fps: 14 }, atk: { fps: 14 } }  },
  dragonfly:  { pngScaleMultiplier: 1.2,  anims: { move: { fps: 24 }, atk: { fps: 24 } }  },
  mosquito:  { pngScaleMultiplier: 1.1 },
  bat:  { pngScaleMultiplier: 1.2 },
  castle_bat:  { pngScaleMultiplier: 1.1 },
  shadow_imp:  { anims: { move: { fps: 18 } } },
  toad:  { pngScaleMultiplier: 1.2 },
  infected_basic:  { pngScaleMultiplier: 1.2,  anims: { atk: { fps: 22 } } },
  infected_heavy:  { anims: { atk: { fps: 18 } } },
  heavy:  { pngScaleMultiplier: 1.3 },
  // Boss slam: the wind-up state is 600 ms (EnemyBossSystem.slam_wind), and
  // every boss's atk.png is 12 frames. 12 / 0.6 = 20 fps makes the swing
  // animation finish right as bossSlamImpact lands.
  boss_meadow:    { anims: { atk: { fps: 20 } } },
  boss_forest:    { anims: { atk: { fps: 20 } } },
  boss_infected:  { anims: { atk: { fps: 20 } } },
  boss_river:     { anims: { atk: { fps: 20 } } },
  boss_castle_q:  { anims: { atk: { fps: 20 } } },
  boss_castle_d:  { anims: { atk: { fps: 20 } } },
};

// ============================================================================
// IMPLEMENTATION (you should not need to edit anything below this line)
// ============================================================================

type AnimSpec = {
  suffix: string;
  indexed: boolean;
  indexSep: string;
  animKey: string;
  derivedFrom?: string;        // single-frame derivation: this anim shows frame_0 of <source>.
  derivedAllFrames?: string;   // multi-frame derivation: this anim plays all frames of <source>
                               // (no sheet of its own; just a different fps / repeat).
  frameCount?: number;
  skipLast?: number;
  fps?: number;
  repeat?: number;             // used when there's no procedural anim to inherit from. Default -1.
};

type CharacterSpec = {
  folder: string;
  texPrefix: string;
  anims: AnimSpec[];
  proceduralCanvasSize?: number;
  pngScaleMultiplier?: number;
  // For directional characters whose left-facing render uses a second texture
  // set (bear uses 'eal_*' alongside 'ear_*'). When set, PNG slices are also
  // written horizontally-mirrored to keys prefixed with this value, and the
  // matching animations ({mirrorTexPrefix}-<suffix>) are re-registered.
  mirrorTexPrefix?: string;
};

const stdEnemyAnims = (texPrefix: string): AnimSpec[] => [
  { suffix: 'move', indexed: true, indexSep: '', animKey: `${texPrefix}-move` },
  { suffix: 'atk',  indexed: true, indexSep: '', animKey: `${texPrefix}-atk`  },
];

const bossAnims = (texPrefix: string): AnimSpec[] => [
  { suffix: 'move',   indexed: true, indexSep: '', animKey: `${texPrefix}-move`   },
  { suffix: 'atk',    indexed: true, indexSep: '', animKey: `${texPrefix}-atk`    },
  // 'windup' has no procedural counterpart — created fresh from windup.png. Loops
  // while the boss is in the charge_wind state (~1.2 s).
  { suffix: 'windup', indexed: true, indexSep: '', animKey: `${texPrefix}-windup`, repeat: -1 },
  // 'dash' has no sheet — it plays the move frames at a higher fps during charges.
  { suffix: 'dash',   indexed: true, indexSep: '', animKey: `${texPrefix}-dash`,   derivedAllFrames: 'move' },
  { suffix: 'idle',   indexed: true, indexSep: '', animKey: `${texPrefix}-idle`,   derivedFrom: 'move' },
];

const BUILTIN: CharacterSpec[] = [
  { folder: 'basic',          texPrefix: 'eb',    anims: stdEnemyAnims('eb') },
  { folder: 'heavy',          texPrefix: 'eh',    anims: stdEnemyAnims('eh') },
  { folder: 'snake',          texPrefix: 'esnk',  anims: stdEnemyAnims('esnk') },
  { folder: 'rat',            texPrefix: 'erat',  anims: stdEnemyAnims('erat') },
  { folder: 'deer',           texPrefix: 'eder',  anims: stdEnemyAnims('eder') },
  { folder: 'wolf',           texPrefix: 'ew',    anims: stdEnemyAnims('ew') },
  { folder: 'spider',         texPrefix: 'es',    anims: stdEnemyAnims('es') },
  { folder: 'infected_basic', texPrefix: 'eib',   anims: stdEnemyAnims('eib') },
  { folder: 'infected_heavy', texPrefix: 'eih',   anims: stdEnemyAnims('eih') },
  { folder: 'crow',           texPrefix: 'ecr',   anims: stdEnemyAnims('ecr') },
  { folder: 'bat',            texPrefix: 'ebt',   anims: stdEnemyAnims('ebt') },
  { folder: 'dragonfly',      texPrefix: 'edf',   anims: stdEnemyAnims('edf') },
  { folder: 'mosquito',       texPrefix: 'emq',   anims: stdEnemyAnims('emq') },
  { folder: 'skeleton',       texPrefix: 'esk',   anims: stdEnemyAnims('esk') },
  { folder: 'warlock',        texPrefix: 'ewl',   anims: stdEnemyAnims('ewl') },
  { folder: 'golem',          texPrefix: 'ego',   anims: stdEnemyAnims('ego') },
  { folder: 'shadow_imp',     texPrefix: 'esi',   anims: stdEnemyAnims('esi') },
  { folder: 'castle_bat',     texPrefix: 'ecb',   anims: stdEnemyAnims('ecb') },
  { folder: 'castle_rat',     texPrefix: 'ecrat', anims: stdEnemyAnims('ecrat') },
  // Bear — drop a right-facing sheet; the engine generates a mirrored copy
  // for the left-facing texture set the bear logic uses (eal_*). Procedural
  // bear frames are 32×32, extracted from bearsprites.png.
  { folder: 'bear',           texPrefix: 'ear',   anims: stdEnemyAnims('ear'), proceduralCanvasSize: 32, mirrorTexPrefix: 'eal' },
  // Toad — drops in as move.png (in-game animation is etd-hop). Idle derives
  // from move frame_0.
  { folder: 'toad', texPrefix: 'etd', anims: [
    { suffix: 'move', indexed: true,  indexSep: '', animKey: 'etd-hop'  },
    { suffix: 'atk',  indexed: true,  indexSep: '', animKey: 'etd-atk'  },
    { suffix: 'idle', indexed: false, indexSep: '', animKey: 'etd-idle', derivedFrom: 'move' },
  ]},
  // Player — keys use an underscore separator before the index (p_move_0, p_idle_0, etc.).
  { folder: 'player', texPrefix: 'p', anims: [
    { suffix: 'move',  indexed: true, indexSep: '_', animKey: 'player-move'  },
    { suffix: 'shoot', indexed: true, indexSep: '_', animKey: 'player-shoot' },
    { suffix: 'hit',   indexed: true, indexSep: '_', animKey: 'player-hit'   },
    { suffix: 'idle',  indexed: true, indexSep: '_', animKey: 'player-idle', derivedFrom: 'move' },
  ]},
  // Bosses — chargeWind isn't overridable (its anim alternates with idle0).
  // Hit flash and death pop are programmatic, so bosses only need move.png + atk.png.
  { folder: 'boss_grasslands', texPrefix: 'boss',   anims: bossAnims('boss'),   proceduralCanvasSize: 128 },
  { folder: 'boss_meadow',     texPrefix: 'ram',    anims: bossAnims('ram'),    proceduralCanvasSize: 128 },
  { folder: 'boss_infected',   texPrefix: 'iboss',  anims: bossAnims('iboss'),  proceduralCanvasSize: 128 },
  { folder: 'boss_forest',     texPrefix: 'fboss',  anims: bossAnims('fboss'),  proceduralCanvasSize: 128 },
  { folder: 'boss_river',      texPrefix: 'rboss',  anims: bossAnims('rboss'),  proceduralCanvasSize: 128 },
  { folder: 'boss_castle_q',   texPrefix: 'cqboss', anims: bossAnims('cqboss'), proceduralCanvasSize: 128 },
  { folder: 'boss_castle_d',   texPrefix: 'cdboss', anims: bossAnims('cdboss'), proceduralCanvasSize: 128 },
];

const CHARACTERS: CharacterSpec[] = BUILTIN.map(base => {
  const ov = OVERRIDES[base.folder] ?? {};
  return {
    ...base,
    pngScaleMultiplier: ov.pngScaleMultiplier ?? DEFAULTS.pngScaleMultiplier ?? base.pngScaleMultiplier,
    anims: base.anims.map(a => {
      const animOv = ov.anims?.[a.suffix];
      const animDefault = DEFAULTS.anims?.[a.suffix];
      return {
        ...a,
        frameCount: animOv?.frameCount ?? animDefault?.frameCount ?? a.frameCount,
        skipLast:   animOv?.skipLast   ?? animDefault?.skipLast   ?? a.skipLast,
        fps:        animOv?.fps        ?? animDefault?.fps        ?? a.fps,
      };
    }),
  };
});

const ALL_SHEETS = import.meta.glob(
  './sprites/*/*.png',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

function findSheet(charFolder: string, animFile: string): string | null {
  const re = new RegExp(`/${charFolder}/${animFile}\\.png$`);
  for (const [path, url] of Object.entries(ALL_SHEETS)) {
    if (re.test(path)) return url;
  }
  return null;
}

function sheetKey(texPrefix: string, suffix: string): string {
  return `__sheet_${texPrefix}_${suffix}`;
}

function canonicalKey(spec: AnimSpec, texPrefix: string, i: number): string {
  return spec.indexed
    ? `${texPrefix}_${spec.suffix}${spec.indexSep}${i}`
    : `${texPrefix}_${spec.suffix}`;
}

function findAnim(c: CharacterSpec, suffix: string): AnimSpec | undefined {
  return c.anims.find(a => a.suffix === suffix);
}

function inferFrameCount(scene: Phaser.Scene, key: string, override?: number): number {
  if (override !== undefined) return Math.max(1, override);
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  return Math.max(1, Math.round(img.width / img.height));
}

function sliceFrame(scene: Phaser.Scene, sheetK: string, total: number, idx: number, dst: string) {
  const img = scene.textures.get(sheetK).getSourceImage() as HTMLImageElement;
  const frameW = img.width / total;
  const frameH = img.height;
  const c = document.createElement('canvas');
  c.width = Math.round(frameW);
  c.height = frameH;
  c.getContext('2d')!.drawImage(img, idx * frameW, 0, frameW, frameH, 0, 0, c.width, c.height);
  if (scene.textures.exists(dst)) scene.textures.remove(dst);
  scene.textures.addCanvas(dst, c);
}

function sliceFrameMirrored(scene: Phaser.Scene, sheetK: string, total: number, idx: number, dst: string) {
  const img = scene.textures.get(sheetK).getSourceImage() as HTMLImageElement;
  const frameW = img.width / total;
  const frameH = img.height;
  const c = document.createElement('canvas');
  c.width = Math.round(frameW);
  c.height = frameH;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, idx * frameW, 0, frameW, frameH, 0, 0, c.width, c.height);
  if (scene.textures.exists(dst)) scene.textures.remove(dst);
  scene.textures.addCanvas(dst, c);
}

function mirrorCanonicalKey(c: CharacterSpec, spec: AnimSpec, i: number): string {
  return spec.indexed
    ? `${c.mirrorTexPrefix}_${spec.suffix}${spec.indexSep}${i}`
    : `${c.mirrorTexPrefix}_${spec.suffix}`;
}

export function loadSpriteOverrides(scene: Phaser.Scene, folderFilter: Set<string> | null = null) {
  for (const c of CHARACTERS) {
    if (folderFilter && !folderFilter.has(c.folder)) continue;
    for (const a of c.anims) {
      if (a.derivedFrom || a.derivedAllFrames) continue;
      const url = findSheet(c.folder, a.suffix);
      if (!url) continue;
      const k = sheetKey(c.texPrefix, a.suffix);
      if (!scene.textures.exists(k)) scene.load.image(k, url);
    }
  }
}

export function applySpriteOverrides(scene: Phaser.Scene) {
  for (const c of CHARACTERS) {
    for (const a of c.anims) {
      if (a.derivedFrom) {
        const sourceSheet = sheetKey(c.texPrefix, a.derivedFrom);
        if (!scene.textures.exists(sourceSheet)) continue;
        const sourceCount = inferFrameCount(scene, sourceSheet, findAnim(c, a.derivedFrom)?.frameCount);
        sliceFrame(scene, sourceSheet, sourceCount, 0, canonicalKey(a, c.texPrefix, 0));
        continue;
      }
      if (a.derivedAllFrames) continue;
      const sheet = sheetKey(c.texPrefix, a.suffix);
      if (!scene.textures.exists(sheet)) continue;
      const total = inferFrameCount(scene, sheet, a.frameCount);
      const used = Math.max(1, total - (a.skipLast ?? 0));
      if (!a.indexed) {
        sliceFrame(scene, sheet, total, 0, canonicalKey(a, c.texPrefix, 0));
        if (c.mirrorTexPrefix) sliceFrameMirrored(scene, sheet, total, 0, mirrorCanonicalKey(c, a, 0));
      } else {
        for (let i = 0; i < used; i++) {
          sliceFrame(scene, sheet, total, i, canonicalKey(a, c.texPrefix, i));
          if (c.mirrorTexPrefix) sliceFrameMirrored(scene, sheet, total, i, mirrorCanonicalKey(c, a, i));
        }
      }
    }
  }
}

export function reregisterSpriteOverrideAnimations(scene: Phaser.Scene) {
  for (const c of CHARACTERS) {
    for (const a of c.anims) {
      if (a.derivedFrom) {
        const sourceSheet = sheetKey(c.texPrefix, a.derivedFrom);
        if (!scene.textures.exists(sourceSheet)) continue;
        if (!scene.anims.exists(a.animKey)) continue;
        const existing = scene.anims.get(a.animKey);
        const frameRate = a.fps ?? existing.frameRate;
        const repeat = existing.repeat;
        scene.anims.remove(a.animKey);
        scene.anims.create({
          key: a.animKey,
          frames: [{ key: canonicalKey(a, c.texPrefix, 0) }],
          frameRate,
          repeat,
        });
        continue;
      }
      if (a.derivedAllFrames) {
        const sourceSpec = findAnim(c, a.derivedAllFrames);
        if (!sourceSpec) continue;
        // Source canonical keys exist after generateAllArt/applySpriteOverrides,
        // whether procedural or PNG-backed.
        let n = 0;
        while (scene.textures.exists(canonicalKey(sourceSpec, c.texPrefix, n))) n++;
        if (n === 0) continue;
        const used = Math.max(1, n - (sourceSpec.skipLast ?? 0));
        const frameRate = a.fps ?? 24;
        if (scene.anims.exists(a.animKey)) scene.anims.remove(a.animKey);
        const keys = Array.from({ length: used }, (_, i) => canonicalKey(sourceSpec, c.texPrefix, i));
        scene.anims.create({
          key: a.animKey,
          frames: keys.map(k => ({ key: k })),
          frameRate,
          repeat: -1,
        });
        continue;
      }
      const sheet = sheetKey(c.texPrefix, a.suffix);
      if (!scene.textures.exists(sheet)) continue;
      const total = inferFrameCount(scene, sheet, a.frameCount);
      const used = Math.max(1, total - (a.skipLast ?? 0));
      let frameRate: number;
      let repeat: number;
      if (scene.anims.exists(a.animKey)) {
        const existing = scene.anims.get(a.animKey);
        frameRate = a.fps ?? existing.frameRate;
        repeat = existing.repeat;
        scene.anims.remove(a.animKey);
      } else {
        // No procedural anim to inherit from (e.g. boss windup) — create fresh.
        frameRate = a.fps ?? 12;
        repeat = a.repeat ?? -1;
      }
      const keys = a.indexed
        ? Array.from({ length: used }, (_, i) => canonicalKey(a, c.texPrefix, i))
        : [canonicalKey(a, c.texPrefix, 0)];
      scene.anims.create({
        key: a.animKey,
        frames: keys.map(k => ({ key: k })),
        frameRate,
        repeat,
      });
      if (c.mirrorTexPrefix) {
        const mirrorAnimKey = `${c.mirrorTexPrefix}-${a.suffix}`;
        if (scene.anims.exists(mirrorAnimKey)) {
          const mExisting = scene.anims.get(mirrorAnimKey);
          const mFrameRate = a.fps ?? mExisting.frameRate;
          const mRepeat = mExisting.repeat;
          scene.anims.remove(mirrorAnimKey);
          const mKeys = a.indexed
            ? Array.from({ length: used }, (_, i) => mirrorCanonicalKey(c, a, i))
            : [mirrorCanonicalKey(c, a, 0)];
          scene.anims.create({
            key: mirrorAnimKey,
            frames: mKeys.map(k => ({ key: k })),
            frameRate: mFrameRate,
            repeat: mRepeat,
          });
        }
      }
    }
  }
}

export function hasPngOverride(scene: Phaser.Scene, texPrefix: string, suffix: string): boolean {
  return scene.textures.exists(sheetKey(texPrefix, suffix));
}

export function applyEntityVisual(
  sprite: Phaser.Physics.Arcade.Sprite,
  characterFolder: string,
  primarySuffix: string,
  procScale: number,
  procBodyW: number,
  procBodyH: number,
  procOffsetX: number,
  procOffsetY: number,
): void {
  const c = CHARACTERS.find(cs => cs.folder === characterFolder);
  const sheetK = c ? sheetKey(c.texPrefix, primarySuffix) : '';
  if (c && sprite.scene.textures.exists(sheetK)) {
    const img = sprite.scene.textures.get(sheetK).getSourceImage() as HTMLImageElement;
    const proc = c.proceduralCanvasSize ?? 64;
    const ratio = img.height / proc;
    const mult = c.pngScaleMultiplier ?? 1;
    sprite.setScale((procScale / ratio) * mult);
    // Auto-size the physics body to the sprite's non-transparent silhouette.
    // Reads opaque bounds from frame 0 of the primary anim (sliced into its
    // own texture by applySpriteOverrides). Falls back to the manual proc*
    // values if the scan fails (e.g. tainted cross-origin canvas) or the
    // frame texture doesn't exist yet.
    const anim = findAnim(c, primarySuffix);
    const frame0Key = anim ? canonicalKey(anim, c.texPrefix, 0) : '';
    const bounds = frame0Key && sprite.scene.textures.exists(frame0Key)
      ? measureOpaqueBounds(sprite.scene, frame0Key)
      : null;
    if (bounds) {
      // Compute body size from the visible silhouette, then cap each
      // dimension at one tile minus a clearance margin so the body always
      // fits inside a single tile corridor with room to spare. The visual
      // sprite is unaffected — only the invisible collision rectangle is
      // resized. Body stays centered on the silhouette regardless of cap.
      const scale = Math.max(0.001, Math.abs(sprite.scaleX));
      const rawSourceW = bounds.right - bounds.left + 1;
      const rawSourceH = bounds.bottom - bounds.top + 1;
      // Cap leaves slack on each side so the alignment tolerance is wide
      // enough that fast-moving enemies don't have to damp their velocity
      // at every corner to land precisely on the centerline. Higher margin
      // = more tolerance = more fluid cornering at high game speed.
      const corridorMargin = 8; // 4 px clearance per side in a 32-px tile
      const maxDisplayDim = CFG.tile - corridorMargin;
      const maxSourceDim = maxDisplayDim / scale;
      const srcW = Math.max(1, Math.min(rawSourceW, maxSourceDim));
      const srcH = Math.max(1, Math.min(rawSourceH, maxSourceDim));
      const cxSrc = (bounds.left + bounds.right + 1) / 2;
      const cySrc = (bounds.top + bounds.bottom + 1) / 2;
      sprite.setSize(srcW, srcH);
      sprite.setOffset(cxSrc - srcW / 2, cySrc - srcH / 2);
    } else {
      sprite.setSize(procBodyW * ratio, procBodyH * ratio);
      sprite.setOffset(procOffsetX * ratio, procOffsetY * ratio);
    }
  } else {
    sprite.setScale(procScale);
    sprite.setSize(procBodyW, procBodyH);
    sprite.setOffset(procOffsetX, procOffsetY);
  }
}
