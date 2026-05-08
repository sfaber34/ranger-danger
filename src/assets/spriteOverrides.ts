import Phaser from 'phaser';

// Drop PNG frames at src/assets/sprites/<character>/<animation>/frame_<N>.png
// to override the procedural art for that animation. Frame count is variable
// per animation. The procedural pipeline still runs first; this module copies
// PNG textures over the canonical keys and re-registers the matching Phaser
// animation with the discovered frame count.
//
// Conventions baked in:
//  - Most characters use texture keys like `ew_move0` (no separator before index).
//  - Player uses `p_move_0` (underscore separator).
//  - Single-frame animations (like `ew_hit`) have no index and only consume frame_0.
//  - Frame rate / repeat are inherited from the procedural animation registration.

type AnimSpec = {
  folder: string;     // sprite folder name (e.g. 'walking')
  suffix: string;     // texture-key suffix (e.g. 'move')
  indexed: boolean;   // false → single key like 'ew_hit'; true → 'ew_move0', 'ew_move1', …
  indexSep: string;   // separator before the index ('' for most; '_' for player)
  animKey: string;    // Phaser animation key (e.g. 'ew-move')
  // When set, this anim has no folder of its own — its single canonical
  // texture is copied from frame_0 of the anim with this suffix, and the
  // Phaser animation is re-registered as a single-frame anim. Used so the
  // idle pose reuses frame_0 of walking/hopping rather than a dedicated PNG.
  derivedFrom?: string;
};

type CharacterSpec = {
  folder: string;     // top-level sprite folder (e.g. 'wolf')
  texPrefix: string;  // procedural texture-key prefix (e.g. 'ew')
  anims: AnimSpec[];
};

const stdEnemyAnims = (texPrefix: string): AnimSpec[] => [
  { folder: 'walking',   suffix: 'move', indexed: true,  indexSep: '', animKey: `${texPrefix}-move` },
  { folder: 'attacking', suffix: 'atk',  indexed: true,  indexSep: '', animKey: `${texPrefix}-atk`  },
  { folder: 'hit',       suffix: 'hit',  indexed: false, indexSep: '', animKey: `${texPrefix}-hit`  },
  { folder: 'dying',     suffix: 'die',  indexed: true,  indexSep: '', animKey: `${texPrefix}-die`  },
];

const bossAnims = (texPrefix: string): AnimSpec[] => [
  { folder: 'walking',   suffix: 'move',  indexed: true,  indexSep: '', animKey: `${texPrefix}-move`  },
  { folder: 'attacking', suffix: 'atk',   indexed: true,  indexSep: '', animKey: `${texPrefix}-atk`   },
  { folder: 'hit',       suffix: 'hit',   indexed: false, indexSep: '', animKey: `${texPrefix}-hit`   },
  { folder: 'birthing',  suffix: 'birth', indexed: true,  indexSep: '', animKey: `${texPrefix}-birth` },
  { folder: 'dying',     suffix: 'die',   indexed: true,  indexSep: '', animKey: `${texPrefix}-die`   },
  { folder: '_derived',  suffix: 'idle',  indexed: true,  indexSep: '', animKey: `${texPrefix}-idle`, derivedFrom: 'move' },
];

export const CHARACTERS: CharacterSpec[] = [
  // Standard enemies
  { folder: 'basic',          texPrefix: 'eb',    anims: stdEnemyAnims('eb') },
  { folder: 'heavy',          texPrefix: 'eh',    anims: stdEnemyAnims('eh') },
  { folder: 'snake',          texPrefix: 'esnk',  anims: stdEnemyAnims('esnk') },
  { folder: 'rat',            texPrefix: 'erat',  anims: stdEnemyAnims('erat') },
  { folder: 'deer',           texPrefix: 'eder',  anims: stdEnemyAnims('eder') },
  { folder: 'wolf',           texPrefix: 'ew',    anims: stdEnemyAnims('ew') },
  { folder: 'spider',         texPrefix: 'es',    anims: stdEnemyAnims('es') },
  { folder: 'infected-basic', texPrefix: 'eib',   anims: stdEnemyAnims('eib') },
  { folder: 'infected-heavy', texPrefix: 'eih',   anims: stdEnemyAnims('eih') },
  { folder: 'crow',           texPrefix: 'ecr',   anims: stdEnemyAnims('ecr') },
  { folder: 'bat',            texPrefix: 'ebt',   anims: stdEnemyAnims('ebt') },
  { folder: 'dragonfly',      texPrefix: 'edf',   anims: stdEnemyAnims('edf') },
  { folder: 'mosquito',       texPrefix: 'emq',   anims: stdEnemyAnims('emq') },
  { folder: 'skeleton',       texPrefix: 'esk',   anims: stdEnemyAnims('esk') },
  { folder: 'warlock',        texPrefix: 'ewl',   anims: stdEnemyAnims('ewl') },
  { folder: 'golem',          texPrefix: 'ego',   anims: stdEnemyAnims('ego') },
  { folder: 'shadow-imp',     texPrefix: 'esi',   anims: stdEnemyAnims('esi') },
  { folder: 'castle-bat',     texPrefix: 'ecb',   anims: stdEnemyAnims('ecb') },
  { folder: 'castle-rat',     texPrefix: 'ecrat', anims: stdEnemyAnims('ecrat') },
  // Bear has separate right-/left-facing texture sets (procedural source is bearsprites.png).
  { folder: 'bear-right',     texPrefix: 'ear',   anims: stdEnemyAnims('ear') },
  { folder: 'bear-left',      texPrefix: 'eal',   anims: stdEnemyAnims('eal') },
  // Toad — idle pose is derived from hopping frame_0.
  { folder: 'toad', texPrefix: 'etd', anims: [
    { folder: 'hopping',   suffix: 'hop',  indexed: true,  indexSep: '', animKey: 'etd-hop'  },
    { folder: 'attacking', suffix: 'atk',  indexed: true,  indexSep: '', animKey: 'etd-atk'  },
    { folder: 'hit',       suffix: 'hit',  indexed: false, indexSep: '', animKey: 'etd-hit'  },
    { folder: 'dying',     suffix: 'die',  indexed: true,  indexSep: '', animKey: 'etd-die'  },
    { folder: '_derived',  suffix: 'idle', indexed: false, indexSep: '', animKey: 'etd-idle', derivedFrom: 'hop' },
  ]},
  // Player — keys use an underscore separator before the index (p_move_0, p_idle_0, etc.).
  // Idle pose is derived from walking frame_0.
  { folder: 'player', texPrefix: 'p', anims: [
    { folder: 'walking',  suffix: 'move',  indexed: true, indexSep: '_', animKey: 'player-move'  },
    { folder: 'shooting', suffix: 'shoot', indexed: true, indexSep: '_', animKey: 'player-shoot' },
    { folder: 'hit',      suffix: 'hit',   indexed: true, indexSep: '_', animKey: 'player-hit'   },
    { folder: '_derived', suffix: 'idle',  indexed: true, indexSep: '_', animKey: 'player-idle', derivedFrom: 'move' },
  ]},
  // Bosses (chargeWind isn't overridable — its registered animation alternates with idle0
  // and isn't a flat frame list, so it stays procedural.)
  { folder: 'boss-grasslands', texPrefix: 'boss',   anims: bossAnims('boss')   },
  { folder: 'boss-meadow',     texPrefix: 'ram',    anims: bossAnims('ram')    },
  { folder: 'boss-infected',   texPrefix: 'iboss',  anims: bossAnims('iboss')  },
  { folder: 'boss-forest',     texPrefix: 'fboss',  anims: bossAnims('fboss')  },
  { folder: 'boss-river',      texPrefix: 'rboss',  anims: bossAnims('rboss')  },
  { folder: 'boss-castle-q',   texPrefix: 'cqboss', anims: bossAnims('cqboss') },
  { folder: 'boss-castle-d',   texPrefix: 'cdboss', anims: bossAnims('cdboss') },
];

const ALL_FRAMES = import.meta.glob(
  './sprites/*/*/frame_*.png',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

function findFrames(charFolder: string, animFolder: string): string[] {
  const re = new RegExp(`/${charFolder}/${animFolder}/frame_(\\d+)\\.png$`);
  const matches: { idx: number; url: string }[] = [];
  for (const [path, url] of Object.entries(ALL_FRAMES)) {
    const m = path.match(re);
    if (m) matches.push({ idx: parseInt(m[1], 10), url });
  }
  return matches.sort((a, b) => a.idx - b.idx).map(e => e.url);
}

function pngLoadKey(texPrefix: string, suffix: string, i: number): string {
  return `__png_${texPrefix}_${suffix}_${i}`;
}

function canonicalKey(spec: AnimSpec, texPrefix: string, i: number): string {
  return spec.indexed
    ? `${texPrefix}_${spec.suffix}${spec.indexSep}${i}`
    : `${texPrefix}_${spec.suffix}`;
}

function countLoaded(scene: Phaser.Scene, texPrefix: string, suffix: string): number {
  let n = 0;
  while (scene.textures.exists(pngLoadKey(texPrefix, suffix, n))) n++;
  return n;
}

function copyTexture(scene: Phaser.Scene, src: string, dst: string) {
  if (scene.textures.exists(dst)) scene.textures.remove(dst);
  const srcImg = scene.textures.get(src).getSourceImage() as HTMLImageElement;
  const c = document.createElement('canvas');
  c.width = srcImg.width; c.height = srcImg.height;
  c.getContext('2d')!.drawImage(srcImg, 0, 0);
  scene.textures.addCanvas(dst, c);
}

export function loadSpriteOverrides(scene: Phaser.Scene) {
  for (const c of CHARACTERS) {
    for (const a of c.anims) {
      const urls = findFrames(c.folder, a.folder);
      urls.forEach((url, i) => {
        const k = pngLoadKey(c.texPrefix, a.suffix, i);
        if (!scene.textures.exists(k)) scene.load.image(k, url);
      });
    }
  }
}

export function applySpriteOverrides(scene: Phaser.Scene) {
  for (const c of CHARACTERS) {
    for (const a of c.anims) {
      if (a.derivedFrom) {
        if (!hasPngOverride(scene, c.texPrefix, a.derivedFrom)) continue;
        copyTexture(scene, pngLoadKey(c.texPrefix, a.derivedFrom, 0), canonicalKey(a, c.texPrefix, 0));
        continue;
      }
      const n = countLoaded(scene, c.texPrefix, a.suffix);
      if (n === 0) continue;
      if (!a.indexed) {
        copyTexture(scene, pngLoadKey(c.texPrefix, a.suffix, 0), canonicalKey(a, c.texPrefix, 0));
      } else {
        for (let i = 0; i < n; i++) {
          copyTexture(scene, pngLoadKey(c.texPrefix, a.suffix, i), canonicalKey(a, c.texPrefix, i));
        }
      }
    }
  }
}

export function reregisterSpriteOverrideAnimations(scene: Phaser.Scene) {
  for (const c of CHARACTERS) {
    for (const a of c.anims) {
      if (a.derivedFrom) {
        if (!hasPngOverride(scene, c.texPrefix, a.derivedFrom)) continue;
        if (!scene.anims.exists(a.animKey)) continue;
        const existing = scene.anims.get(a.animKey);
        const frameRate = existing.frameRate;
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
      const n = countLoaded(scene, c.texPrefix, a.suffix);
      if (n === 0) continue;
      if (!scene.anims.exists(a.animKey)) continue;
      const existing = scene.anims.get(a.animKey);
      const frameRate = existing.frameRate;
      const repeat = existing.repeat;
      scene.anims.remove(a.animKey);
      const keys = a.indexed
        ? Array.from({ length: n }, (_, i) => canonicalKey(a, c.texPrefix, i))
        : [canonicalKey(a, c.texPrefix, 0)];
      scene.anims.create({
        key: a.animKey,
        frames: keys.map(k => ({ key: k })),
        frameRate,
        repeat,
      });
    }
  }
}

export function hasPngOverride(scene: Phaser.Scene, texPrefix: string, suffix: string): boolean {
  return scene.textures.exists(pngLoadKey(texPrefix, suffix, 0));
}
