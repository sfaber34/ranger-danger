// Procedural pixel art drawn at logical resolution then Scale2x'\d to 2× physical.
// Logical sizes: gameplay sprites 32→64px, towers/boss 64→128px.
// All sprites use setScale(0.5) to maintain the same world-space dimensions.
// Every frame is registered as its own texture and animations reference them
// in order via registerAnimations().

import Phaser from 'phaser';
import { PFrame, drawPlayer, drawBow } from './art/player';
import {
  EFrame, ToadFrame,
  drawEnemyBasic, drawEnemyHeavy, drawEnemySnake, drawEnemyRat, drawEnemyDeer,
  drawEnemyInfectedBasic, drawEnemyInfectedHeavy,
  drawEnemyToad, drawToadGlob, drawEnemyWolf,
  drawEnemySpider, drawEnemyCrow, drawEnemyBat, drawEnemyDragonfly,
  drawEnemyMosquito, drawMosquitoDart, drawBirdPoop,
  drawEnemySkeleton, drawEnemyWarlock, drawEnemyGolem, drawEnemyShadowImp,
  drawEnemyCastleBat, drawEnemyCastleRat, drawWarlockBolt,
} from './art/enemies';
import {
  Put, PutRGB, P, S,
  pxIdx, pxEq, pxCopy, scale2x, makeCanvas, mirrorX,
  rect, disc, ring, line, ellipse, flashOverlay, hexToRgb, add,
} from './art/canvas';
import { BearFrame, drawBearDir, extractBearFrames } from './art/bear';
import {
  BossFrame, ForestBossFrame, forestBossFrames,
  drawFogPhantom, drawBoss, drawRam, drawInfectedBoss, drawForestBoss,
  drawPhantomQueen, drawCastleDragon,
  drawQueenOrb, drawDragonFireball, drawDragonFireExplosion,
} from './art/bosses';
import {
  drawTowerBase, drawBallistaStand, drawTowerArcher, drawTowerBow,
  drawTowerTop, drawCannonMount, drawCannonTop,
} from './art/towers';
import {
  CoinTier,
  drawArrow, drawCannonball, drawBoulder, drawBoulderShadow,
  drawCannonballShadow, drawCoin,
} from './art/projectiles';
import { drawBoulderImpact, drawHitSpark, drawDeathBurst, drawCoinPop } from './art/fx';
import {
  TREE_PATTERNS, SPIKE_VARIANT_COUNT,
  drawCastleSpikesCanvas, drawTreeClusterCanvas, drawInfectedPlantCanvas, drawFoundation,
} from './art/terrain';
// Re-export terrain names that ChunkSystem and other callers consume from
// generateArt — keeps the public surface stable while the implementation
// moves to art/terrain.ts.
export {
  RIVER_HALF_W, riverHorizontalCenterY, riverCenterPx, getRiverTileGrid,
  TREE_PATTERNS, SPIKE_PATTERNS, SPIKE_VARIANT_COUNT, createGroundChunk,
} from './art/terrain';
import {
  drawWall, drawIndicatorArrow, drawIndicatorCannon, drawIndicatorBoss, drawIndicatorPointer,
} from './art/ui';












let artGenerated = false;
export function generateAllArt(scene: Phaser.Scene) {
  if (artGenerated) return;
  artGenerated = true;
  // Player
  const pFrames: { k: string; f: PFrame }[] = [
    { k: 'p_idle_0',  f: 'idle0' },
    { k: 'p_idle_1',  f: 'idle1' },
    { k: 'p_move_0',  f: 'move0' },
    { k: 'p_move_1',  f: 'move1' },
    { k: 'p_move_2',  f: 'move2' },
    { k: 'p_move_3',  f: 'move3' },
    { k: 'p_shoot_0', f: 'shoot0' },
    { k: 'p_shoot_1', f: 'shoot1' }
  ];
  for (const { k, f } of pFrames) add(scene, k, makeCanvas(32, drawPlayer(f)));
  add(scene, 'p_hit_0', makeCanvas(32, drawPlayer('hit')));

  // Bow (separate rotatable sprite, 32x32, origin will be at ~left-center)
  // Drawn pointing right, pivot near the grip (left side)
  add(scene, 'bow_0', makeCanvas(32, drawBow(false)));
  add(scene, 'bow_1', makeCanvas(32, drawBow(true)));

  // Enemies
  const eFrames: EFrame[] = ['move0','move1','move2','move3','atk0','atk1','hit','die0','die1','die2','die3'];
  for (const f of eFrames) add(scene, `eb_${f}`, makeCanvas(32, drawEnemyBasic(f)));
  for (const f of eFrames) add(scene, `eh_${f}`, makeCanvas(32, drawEnemyHeavy(f)));
  for (const f of eFrames) add(scene, `esnk_${f}`, makeCanvas(32, drawEnemySnake(f)));
  for (const f of eFrames) add(scene, `erat_${f}`, makeCanvas(32, drawEnemyRat(f)));
  for (const f of eFrames) add(scene, `eder_${f}`, makeCanvas(32, drawEnemyDeer(f)));
  for (const f of eFrames) add(scene, `eib_${f}`, makeCanvas(32, drawEnemyInfectedBasic(f)));
  for (const f of eFrames) add(scene, `eih_${f}`, makeCanvas(32, drawEnemyInfectedHeavy(f)));
  // Blighted Toad — uses its own frame set (idle + hop + atk + hit + die)
  const toadFrames: ToadFrame[] = ['idle', 'hop0', 'hop1', 'hop2', 'hop3', 'atk0', 'atk1', 'hit', 'die0', 'die1', 'die2', 'die3'];
  for (const f of toadFrames) add(scene, `etd_${f}`, makeCanvas(32, drawEnemyToad(f)));
  // Toad glob projectile
  add(scene, 'tglob_0', makeCanvas(16, drawToadGlob('glob0')));
  add(scene, 'tglob_1', makeCanvas(16, drawToadGlob('glob1')));
  for (const f of eFrames) add(scene, `ew_${f}`, makeCanvas(32, drawEnemyWolf(f)));
  // Bear: extract frames from sprite sheet, strip grey bg, register as textures
  extractBearFrames(scene);
  for (const f of eFrames) add(scene, `es_${f}`, makeCanvas(32, drawEnemySpider(f)));
  // River flying enemies
  for (const f of eFrames) add(scene, `ecr_${f}`, makeCanvas(32, drawEnemyCrow(f)));
  for (const f of eFrames) add(scene, `ebt_${f}`, makeCanvas(32, drawEnemyBat(f)));
  for (const f of eFrames) add(scene, `edf_${f}`, makeCanvas(32, drawEnemyDragonfly(f)));
  for (const f of eFrames) add(scene, `emq_${f}`, makeCanvas(32, drawEnemyMosquito(f)));
  // Mosquito dart projectile
  add(scene, 'mdart_0', makeCanvas(16, drawMosquitoDart('dart0')));
  add(scene, 'mdart_1', makeCanvas(16, drawMosquitoDart('dart1')));
  // Bird poop splat
  add(scene, 'bird_poop', makeCanvas(16, drawBirdPoop()));

  // Castle enemies
  for (const f of eFrames) add(scene, `esk_${f}`, makeCanvas(32, drawEnemySkeleton(f)));
  for (const f of eFrames) add(scene, `ewl_${f}`, makeCanvas(32, drawEnemyWarlock(f)));
  for (const f of eFrames) add(scene, `ego_${f}`, makeCanvas(32, drawEnemyGolem(f)));
  for (const f of eFrames) add(scene, `esi_${f}`, makeCanvas(32, drawEnemyShadowImp(f)));
  for (const f of eFrames) add(scene, `ecb_${f}`, makeCanvas(32, drawEnemyCastleBat(f)));
  for (const f of eFrames) add(scene, `ecrat_${f}`, makeCanvas(32, drawEnemyCastleRat(f)));
  // Warlock magic bolt projectile
  add(scene, 'wbolt_0', makeCanvas(32, drawWarlockBolt('bolt0')));
  add(scene, 'wbolt_1', makeCanvas(32, drawWarlockBolt('bolt1')));

  // Shared helper to copy a loaded PNG texture to a new key
  const copyTex = (src: string, dst: string) => {
    if (scene.textures.exists(dst)) scene.textures.remove(dst);
    const srcTex = scene.textures.get(src);
    const srcImg = srcTex.getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = srcImg.width; c.height = srcImg.height;
    c.getContext('2d')!.drawImage(srcImg, 0, 0);
    scene.textures.addCanvas(dst, c);
  };

  // Tower — PNG base + procedural ballista top
  if (scene.textures.exists('t_base_png')) {
    copyTex('t_base_png', 't_base');
  } else {
    add(scene, 't_base',  makeCanvas(64, drawTowerBase));
  }
  // Arrow tower upgrade bases (level 1 = sprite #7, level 2 = sprite #0)
  if (scene.textures.exists('t_base_1_png')) {
    copyTex('t_base_1_png', 't_base_1');
  }
  if (scene.textures.exists('t_base_2_png')) {
    copyTex('t_base_2_png', 't_base_2');
  }
  // Cannon tower — PNG base (sprite #29)
  if (scene.textures.exists('c_base_png')) {
    const cleanAndCopy = (src: string, dst: string) => {
      if (scene.textures.exists(dst)) scene.textures.remove(dst);
      const srcTex = scene.textures.get(src);
      const srcImg = srcTex.getSourceImage() as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = srcImg.width; c.height = srcImg.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(srcImg, 0, 0);
      // Strip magenta fringe: any pixel where R and B are high but G is low
      const id = ctx.getImageData(0, 0, c.width, c.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > 180 && b > 180 && g < 100) {
          d[i + 3] = 0; // make transparent
        }
      }
      ctx.putImageData(id, 0, 0);
      scene.textures.addCanvas(dst, c);
    };
    cleanAndCopy('c_base_png', 'c_base');
  } else {
    add(scene, 'c_base', makeCanvas(64, drawTowerBase));
  }
  // Cannon tower upgrade bases (level 1 = sprite #11, level 2 = sprite #32)
  if (scene.textures.exists('c_base_1_png')) {
    copyTex('c_base_1_png', 'c_base_1');
  }
  if (scene.textures.exists('c_base_2_png')) {
    copyTex('c_base_2_png', 'c_base_2');
  }
  // Arrow tower: static archer body + rotatable bow (same system as player)
  add(scene, 't_archer', makeCanvas(32, drawTowerArcher));
  add(scene, 't_top_0', makeCanvas(32, drawTowerBow(false)));
  add(scene, 't_top_1', makeCanvas(32, drawTowerBow(true)));
  add(scene, 'c_mount', makeCanvas(64, drawCannonMount()));
  add(scene, 'c_top_0', makeCanvas(64, drawCannonTop(false)));
  add(scene, 'c_top_1', makeCanvas(64, drawCannonTop(true)));

  // Off-screen tower indicators
  add(scene, 'ind_arrow',  makeCanvas(32, drawIndicatorArrow()));
  add(scene, 'ind_cannon', makeCanvas(32, drawIndicatorCannon()));
  add(scene, 'ind_boss',   makeCanvas(32, drawIndicatorBoss()));
  add(scene, 'ind_ptr',    makeCanvas(16, drawIndicatorPointer()));

  // Green checkmark for level select
  {
    const s = 20;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const x = c.getContext('2d')!;
    // Black outline
    x.strokeStyle = '#000';
    x.lineWidth = 4;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(3, 10);
    x.lineTo(8, 16);
    x.lineTo(17, 4);
    x.stroke();
    // Green fill
    x.strokeStyle = '#4ad96a';
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(3, 10);
    x.lineTo(8, 16);
    x.lineTo(17, 4);
    x.stroke();
    add(scene, 'ui_check', c);
  }

  // Wall
  // Walls — 16 autotile variants (N=1, E=2, S=4, W=8) × normal/damaged
  for (let mask = 0; mask < 16; mask++) {
    add(scene, `wall_${mask}`,     makeCanvas(32, drawWall(mask, false)));
    add(scene, `wall_${mask}_dmg`, makeCanvas(32, drawWall(mask, true)));
  }
  // Legacy keys for ghost preview and default
  add(scene, 'wall',     makeCanvas(32, drawWall(0, false)));
  add(scene, 'wall_dmg', makeCanvas(32, drawWall(0, true)));

  // Arrow
  add(scene, 'arrow_0', makeCanvas(32, drawArrow(0)));
  add(scene, 'arrow_1', makeCanvas(32, drawArrow(1)));

  // Cannonball
  add(scene, 'cball_0', makeCanvas(32, drawCannonball(0)));
  add(scene, 'cball_1', makeCanvas(32, drawCannonball(1)));
  add(scene, 'cball_shadow', makeCanvas(32, drawCannonballShadow()));

  // Boulder (boss projectile)
  add(scene, 'boulder_0', makeCanvas(32, drawBoulder(0)));
  add(scene, 'boulder_1', makeCanvas(32, drawBoulder(1)));
  add(scene, 'boulder_shadow', makeCanvas(32, drawBoulderShadow()));

  // Coin (bronze / silver / gold tiers)
  for (let i = 0; i < 6; i++) add(scene, `coin_${i}`, makeCanvas(32, drawCoin(i as any, 'gold')));
  for (const tier of ['bronze','silver','gold'] as const) {
    for (let i = 0; i < 6; i++) add(scene, `coin_${tier}_${i}`, makeCanvas(32, drawCoin(i as any, tier)));
  }

  // Effects
  for (let i = 0; i < 3; i++) add(scene, `fx_hit_${i}`,   makeCanvas(32, drawHitSpark(i as any)));
  for (let i = 0; i < 5; i++) add(scene, `fx_death_${i}`, makeCanvas(32, drawDeathBurst(i as any)));
  for (let i = 0; i < 3; i++) add(scene, `fx_pop_${i}`,   makeCanvas(32, drawCoinPop(i as any)));
  for (let i = 0; i < 5; i++) add(scene, `fx_boulder_${i}`, makeCanvas(32, drawBoulderImpact(i as any)));

  // Ground tile variations
  // Ground tiles are generated per-tile in GameScene.generateChunksAround()
  add(scene, 'foundation', makeCanvas(64, drawFoundation));

  // Tree cluster sprites (one per pattern)
  for (let i = 0; i < TREE_PATTERNS.length; i++) add(scene, `tree_cluster_${i}`, drawTreeClusterCanvas(i));

  // Infected plant cluster sprites (one per pattern)
  for (let i = 0; i < TREE_PATTERNS.length; i++) add(scene, `infected_plant_${i}`, drawInfectedPlantCanvas(i));

  // Castle floor spikes — register N jitter variants. The placement code
  // picks per-tile across patterns so multi-tile clusters don't look stamped.
  for (let i = 0; i < SPIKE_VARIANT_COUNT; i++) add(scene, `castle_spikes_${i}`, drawCastleSpikesCanvas(i));

  // Firefly particle (tiny yellow-green glow, 4x4 logical)
  {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = '#80c040';
    x.fillRect(0, 0, 4, 4);
    x.fillStyle = '#b0ff60';
    x.fillRect(1, 1, 2, 2);
    add(scene, 'firefly', c);
  }

  // Infection spore particle (4x4 — purple/green glow)
  {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = '#6030a0';
    x.fillRect(0, 0, 4, 4);
    x.fillStyle = '#a060e0';
    x.fillRect(1, 1, 2, 2);
    add(scene, 'infection_spore', c);
  }

  // Infection spore green variant (4x4)
  {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = '#208040';
    x.fillRect(0, 0, 4, 4);
    x.fillStyle = '#40e060';
    x.fillRect(1, 1, 2, 2);
    add(scene, 'infection_spore_green', c);
  }

  // Spider web texture (16x16 semi-transparent white circle)
  {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const x = c.getContext('2d')!;
    x.globalAlpha = 0.4;
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill();
    // Cross lines for web look
    x.globalAlpha = 0.5;
    x.strokeStyle = '#ffffff';
    x.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      x.beginPath();
      x.moveTo(16, 16);
      x.lineTo(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13);
      x.stroke();
    }
    // Concentric rings
    x.globalAlpha = 0.3;
    for (const r of [5, 9, 12]) {
      x.beginPath(); x.arc(16, 16, r, 0, Math.PI * 2); x.stroke();
    }
    add(scene, 'spider_web', c);
  }

  // Boss (64x64 native — 2x2 tile footprint)
  const bossFrames: BossFrame[] = [
    'idle0','idle1',
    'move0','move1','move2','move3',
    'atk0','atk1',
    'chargeWind','hit',
    'birth0','birth1','birth2','birth3','birth4',
    'die0','die1','die2','die3','die4'
  ];
  for (const f of bossFrames) add(scene, `boss_${f}`, makeCanvas(64, drawBoss(f)));
  for (const f of bossFrames) add(scene, `ram_${f}`, makeCanvas(64, drawRam(f)));
  for (const f of bossFrames) add(scene, `iboss_${f}`, makeCanvas(64, drawInfectedBoss(f)));

  // Forest boss (Ent) textures
  for (const f of forestBossFrames) add(scene, `fboss_${f}`, makeCanvas(64, drawForestBoss(f)));

  // River boss (Fog Phantom) textures
  for (const f of bossFrames) add(scene, `rboss_${f}`, makeCanvas(64, drawFogPhantom(f)));

  // Castle boss (Phantom Queen) textures
  for (const f of bossFrames) add(scene, `cqboss_${f}`, makeCanvas(64, drawPhantomQueen(f)));
  // Castle boss (Castle Dragon) textures
  for (const f of bossFrames) add(scene, `cdboss_${f}`, makeCanvas(64, drawCastleDragon(f)));

  // Queen orb projectile
  add(scene, 'qorb_0', makeCanvas(32, drawQueenOrb(0)));
  add(scene, 'qorb_1', makeCanvas(32, drawQueenOrb(1)));

  // Dragon fireball projectile (4 frames for rotation)
  add(scene, 'dfball_0', makeCanvas(32, drawDragonFireball(0)));
  add(scene, 'dfball_1', makeCanvas(32, drawDragonFireball(1)));
  add(scene, 'dfball_2', makeCanvas(32, drawDragonFireball(2)));
  add(scene, 'dfball_3', makeCanvas(32, drawDragonFireball(3)));

  // Dragon fireball explosion (5 frames)
  for (let i = 0; i < 5; i++)
    add(scene, `dfexpl_${i}`, makeCanvas(32, drawDragonFireExplosion(i)));
}

function framesFromKeys(keys: string[]): Phaser.Types.Animations.AnimationFrame[] {
  return keys.map(k => ({ key: k }));
}

export function registerAnimations(scene: Phaser.Scene) {
  const a = scene.anims;
  const mk = (key: string, keys: string[], frameRate: number, repeat: number) => {
    if (a.exists(key)) a.remove(key);
    a.create({ key, frames: framesFromKeys(keys), frameRate, repeat });
  };

  mk('player-idle',  ['p_idle_0', 'p_idle_1'], 3, -1);
  mk('player-move',  ['p_move_0','p_move_1','p_move_2','p_move_3'], 10, -1);
  mk('player-shoot', ['p_shoot_0','p_shoot_1'], 14, 0);
  mk('player-hit',   ['p_hit_0'], 8, 0);
  mk('bow-idle',  ['bow_0'], 1, 0);
  mk('bow-shoot', ['bow_1', 'bow_0'], 10, 0);

  mk('eb-move', ['eb_move0','eb_move1','eb_move2','eb_move3'], 8, -1);
  mk('eb-atk',  ['eb_atk0','eb_atk1'], 8, -1);
  mk('eb-hit',  ['eb_hit'], 10, 0);
  mk('eb-die',  ['eb_die0','eb_die1','eb_die2','eb_die3'], 10, 0);

  mk('eh-move', ['eh_move0','eh_move1','eh_move2','eh_move3'], 6, -1);
  mk('eh-atk',  ['eh_atk0','eh_atk1'], 6, -1);
  mk('eh-hit',  ['eh_hit'], 8, 0);
  mk('eh-die',  ['eh_die0','eh_die1','eh_die2','eh_die3'], 8, 0);

  mk('esnk-move', ['esnk_move0','esnk_move1','esnk_move2','esnk_move3'], 8, -1);
  mk('esnk-atk',  ['esnk_atk0','esnk_atk1'], 8, -1);
  mk('esnk-hit',  ['esnk_hit'], 10, 0);
  mk('esnk-die',  ['esnk_die0','esnk_die1','esnk_die2','esnk_die3'], 10, 0);

  mk('erat-move', ['erat_move0','erat_move1','erat_move2','erat_move3'], 10, -1);
  mk('erat-atk',  ['erat_atk0','erat_atk1'], 10, -1);
  mk('erat-hit',  ['erat_hit'], 10, 0);
  mk('erat-die',  ['erat_die0','erat_die1','erat_die2','erat_die3'], 10, 0);

  mk('eder-move', ['eder_move0','eder_move1','eder_move2','eder_move3'], 6, -1);
  mk('eder-atk',  ['eder_atk0','eder_atk1'], 6, -1);
  mk('eder-hit',  ['eder_hit'], 8, 0);
  mk('eder-die',  ['eder_die0','eder_die1','eder_die2','eder_die3'], 8, 0);

  mk('eib-move', ['eib_move0','eib_move1','eib_move2','eib_move3'], 8, -1);
  mk('eib-atk',  ['eib_atk0','eib_atk1'], 8, -1);
  mk('eib-hit',  ['eib_hit'], 10, 0);
  mk('eib-die',  ['eib_die0','eib_die1','eib_die2','eib_die3'], 10, 0);

  mk('eih-move', ['eih_move0','eih_move1','eih_move2','eih_move3'], 6, -1);
  mk('eih-atk',  ['eih_atk0','eih_atk1'], 6, -1);
  mk('eih-hit',  ['eih_hit'], 8, 0);
  mk('eih-die',  ['eih_die0','eih_die1','eih_die2','eih_die3'], 8, 0);

  // Blighted Toad
  mk('etd-idle', ['etd_idle'], 1, -1);
  mk('etd-hop',  ['etd_hop0','etd_hop1','etd_hop2','etd_hop3'], 8, 0); // plays once per hop
  mk('etd-atk',  ['etd_atk0','etd_atk1'], 6, 0);
  mk('etd-hit',  ['etd_hit'], 8, 0);
  mk('etd-die',  ['etd_die0','etd_die1','etd_die2','etd_die3'], 8, 0);
  mk('tglob-spin', ['tglob_0','tglob_1'], 8, -1);

  mk('ew-move', ['ew_move0','ew_move1','ew_move2','ew_move3'], 10, -1);
  mk('ew-atk',  ['ew_atk0','ew_atk1'], 10, -1);
  mk('ew-hit',  ['ew_hit'], 10, 0);
  mk('ew-die',  ['ew_die0','ew_die1','ew_die2','ew_die3'], 10, 0);

  // Bear: directional animations (right-facing and left-facing)
  mk('ear-move', ['ear_move0','ear_move1','ear_move2','ear_move3','ear_move4','ear_move5','ear_move6','ear_move7'], 10, -1);
  mk('ear-atk',  ['ear_atk0','ear_atk1','ear_atk2','ear_atk3','ear_atk4'], 6, 0);
  mk('ear-hit',  ['ear_hit'], 8, 0);
  mk('ear-die',  ['ear_die0','ear_die1','ear_die2','ear_die3'], 8, 0);
  mk('eal-move', ['eal_move0','eal_move1','eal_move2','eal_move3','eal_move4','eal_move5','eal_move6','eal_move7'], 10, -1);
  mk('eal-atk',  ['eal_atk0','eal_atk1','eal_atk2','eal_atk3','eal_atk4'], 6, 0);
  mk('eal-hit',  ['eal_hit'], 8, 0);
  mk('eal-die',  ['eal_die0','eal_die1','eal_die2','eal_die3'], 8, 0);

  mk('es-move', ['es_move0','es_move1','es_move2','es_move3'], 8, -1);
  mk('es-atk',  ['es_atk0','es_atk1'], 8, -1);
  mk('es-hit',  ['es_hit'], 10, 0);
  mk('es-die',  ['es_die0','es_die1','es_die2','es_die3'], 10, 0);

  // River flying enemies
  mk('ecr-move', ['ecr_move0','ecr_move1','ecr_move2','ecr_move3'], 8, -1);
  mk('ecr-atk',  ['ecr_atk0','ecr_atk1'], 8, -1);
  mk('ecr-hit',  ['ecr_hit'], 10, 0);
  mk('ecr-die',  ['ecr_die0','ecr_die1','ecr_die2','ecr_die3'], 10, 0);

  mk('ebt-move', ['ebt_move0','ebt_move1','ebt_move2','ebt_move3'], 6, -1);
  mk('ebt-atk',  ['ebt_atk0','ebt_atk1'], 6, -1);
  mk('ebt-hit',  ['ebt_hit'], 8, 0);
  mk('ebt-die',  ['ebt_die0','ebt_die1','ebt_die2','ebt_die3'], 8, 0);

  mk('edf-move', ['edf_move0','edf_move1','edf_move2','edf_move3'], 12, -1);
  mk('edf-atk',  ['edf_atk0','edf_atk1'], 12, -1);
  mk('edf-hit',  ['edf_hit'], 10, 0);
  mk('edf-die',  ['edf_die0','edf_die1','edf_die2','edf_die3'], 10, 0);

  mk('emq-move', ['emq_move0','emq_move1','emq_move2','emq_move3'], 10, -1);
  mk('emq-atk',  ['emq_atk0','emq_atk1'], 10, -1);
  mk('emq-hit',  ['emq_hit'], 10, 0);
  mk('emq-die',  ['emq_die0','emq_die1','emq_die2','emq_die3'], 10, 0);

  // Mosquito dart
  mk('mdart-spin', ['mdart_0','mdart_1'], 8, -1);

  // Castle enemies
  mk('esk-move', ['esk_move0','esk_move1','esk_move2','esk_move3'], 8, -1);
  mk('esk-atk',  ['esk_atk0','esk_atk1'], 8, -1);
  mk('esk-hit',  ['esk_hit'], 10, 0);
  mk('esk-die',  ['esk_die0','esk_die1','esk_die2','esk_die3'], 10, 0);

  mk('ewl-move', ['ewl_move0','ewl_move1','ewl_move2','ewl_move3'], 8, -1);
  mk('ewl-atk',  ['ewl_atk0','ewl_atk1'], 8, -1);
  mk('ewl-hit',  ['ewl_hit'], 10, 0);
  mk('ewl-die',  ['ewl_die0','ewl_die1','ewl_die2','ewl_die3'], 10, 0);

  mk('ego-move', ['ego_move0','ego_move1','ego_move2','ego_move3'], 6, -1);
  mk('ego-atk',  ['ego_atk0','ego_atk1'], 6, -1);
  mk('ego-hit',  ['ego_hit'], 8, 0);
  mk('ego-die',  ['ego_die0','ego_die1','ego_die2','ego_die3'], 8, 0);

  mk('esi-move', ['esi_move0','esi_move1','esi_move2','esi_move3'], 10, -1);
  mk('esi-atk',  ['esi_atk0','esi_atk1'], 10, -1);
  mk('esi-hit',  ['esi_hit'], 10, 0);
  mk('esi-die',  ['esi_die0','esi_die1','esi_die2','esi_die3'], 10, 0);

  mk('ecb-move', ['ecb_move0','ecb_move1','ecb_move2','ecb_move3'], 6, -1);
  mk('ecb-atk',  ['ecb_atk0','ecb_atk1'], 6, -1);
  mk('ecb-hit',  ['ecb_hit'], 8, 0);
  mk('ecb-die',  ['ecb_die0','ecb_die1','ecb_die2','ecb_die3'], 8, 0);

  mk('ecrat-move', ['ecrat_move0','ecrat_move1','ecrat_move2','ecrat_move3'], 10, -1);
  mk('ecrat-atk',  ['ecrat_atk0','ecrat_atk1'], 10, -1);
  mk('ecrat-hit',  ['ecrat_hit'], 10, 0);
  mk('ecrat-die',  ['ecrat_die0','ecrat_die1','ecrat_die2','ecrat_die3'], 10, 0);

  // Warlock bolt
  mk('wbolt-spin', ['wbolt_0','wbolt_1'], 8, -1);

  mk('tower-top-idle',  ['t_top_0'], 1, 0);
  mk('tower-top-shoot', ['t_top_1','t_top_0'], 14, 0);
  mk('cannon-top-idle',  ['c_top_0'], 1, 0);
  mk('cannon-top-shoot', ['c_top_1','c_top_0'], 10, 0);

  mk('arrow-spin', ['arrow_0','arrow_1'], 20, -1);
  mk('cball-spin', ['cball_0','cball_1'], 8, -1);
  mk('boulder-spin', ['boulder_0','boulder_1'], 6, -1);

  mk('coin-spin',  ['coin_0','coin_1','coin_2','coin_3','coin_4','coin_5'], 10, -1);
  for (const tier of ['bronze','silver','gold'] as const) {
    mk(`coin-${tier}-spin`,
      [`coin_${tier}_0`,`coin_${tier}_1`,`coin_${tier}_2`,`coin_${tier}_3`,`coin_${tier}_4`,`coin_${tier}_5`],
      10, -1);
  }

  mk('fx-hit',    ['fx_hit_0','fx_hit_1','fx_hit_2'], 22, 0);
  mk('fx-death',  ['fx_death_0','fx_death_1','fx_death_2','fx_death_3','fx_death_4'], 18, 0);
  mk('fx-pop',    ['fx_pop_0','fx_pop_1','fx_pop_2'], 20, 0);
  mk('fx-boulder', ['fx_boulder_0','fx_boulder_1','fx_boulder_2','fx_boulder_3','fx_boulder_4'], 14, 0);

  // Boss
  mk('boss-idle',       ['boss_idle0','boss_idle1'], 2, -1);
  mk('boss-move',       ['boss_move0','boss_move1','boss_move2','boss_move3'], 5, -1);
  mk('boss-atk',        ['boss_atk0','boss_atk1'], 4, 0);
  mk('boss-chargewind', ['boss_chargeWind','boss_idle0'], 6, -1);
  mk('boss-hit',        ['boss_hit'], 10, 0);
  mk('boss-birth',      ['boss_birth0','boss_birth1','boss_birth2','boss_birth3','boss_birth4'], 4, 0);
  mk('boss-die',        ['boss_die0','boss_die1','boss_die2','boss_die3','boss_die4'], 6, 0);

  // Meadow boss (Ancient Ram) animations
  mk('ram-idle',       ['ram_idle0','ram_idle1'], 2, -1);
  mk('ram-move',       ['ram_move0','ram_move1','ram_move2','ram_move3'], 5, -1);
  mk('ram-atk',        ['ram_atk0','ram_atk1'], 4, 0);
  mk('ram-chargewind', ['ram_chargeWind','ram_idle0'], 6, -1);
  mk('ram-hit',        ['ram_hit'], 10, 0);
  mk('ram-birth',      ['ram_birth0','ram_birth1','ram_birth2','ram_birth3','ram_birth4'], 4, 0);
  mk('ram-die',        ['ram_die0','ram_die1','ram_die2','ram_die3','ram_die4'], 6, 0);

  // Infected boss animations
  mk('iboss-idle',       ['iboss_idle0','iboss_idle1'], 2, -1);
  mk('iboss-move',       ['iboss_move0','iboss_move1','iboss_move2','iboss_move3'], 5, -1);
  mk('iboss-atk',        ['iboss_atk0','iboss_atk1'], 4, 0);
  mk('iboss-chargewind', ['iboss_chargeWind','iboss_idle0'], 6, -1);
  mk('iboss-hit',        ['iboss_hit'], 10, 0);
  mk('iboss-birth',      ['iboss_birth0','iboss_birth1','iboss_birth2','iboss_birth3','iboss_birth4'], 4, 0);
  mk('iboss-die',        ['iboss_die0','iboss_die1','iboss_die2','iboss_die3','iboss_die4'], 6, 0);

  // Forest boss (Ent) animations
  mk('fboss-idle',       ['fboss_idle0','fboss_idle1'], 2, -1);
  mk('fboss-move',       ['fboss_move0','fboss_move1','fboss_move2','fboss_move3'], 5, -1);
  mk('fboss-atk',        ['fboss_atk0','fboss_atk1'], 4, 0);
  mk('fboss-chargewind', ['fboss_chargeWind','fboss_idle0'], 6, -1);
  mk('fboss-hit',        ['fboss_hit'], 10, 0);
  mk('fboss-birth',      ['fboss_birth0','fboss_birth1','fboss_birth2','fboss_birth3','fboss_birth4'], 4, 0);
  mk('fboss-die',        ['fboss_die0','fboss_die1','fboss_die2','fboss_die3','fboss_die4'], 6, 0);

  // River boss (Fog Phantom)
  mk('rboss-idle',       ['rboss_idle0','rboss_idle1'], 2, -1);
  mk('rboss-move',       ['rboss_move0','rboss_move1','rboss_move2','rboss_move3'], 5, -1);
  mk('rboss-atk',        ['rboss_atk0','rboss_atk1'], 4, 0);
  mk('rboss-chargewind', ['rboss_chargeWind','rboss_idle0'], 6, -1);
  mk('rboss-hit',        ['rboss_hit'], 10, 0);
  mk('rboss-birth',      ['rboss_birth0','rboss_birth1','rboss_birth2','rboss_birth3','rboss_birth4'], 4, 0);
  mk('rboss-die',        ['rboss_die0','rboss_die1','rboss_die2','rboss_die3','rboss_die4'], 6, 0);

  // Castle boss (Phantom Queen) animations
  mk('cqboss-idle',       ['cqboss_idle0','cqboss_idle1'], 2, -1);
  mk('cqboss-move',       ['cqboss_move0','cqboss_move1','cqboss_move2','cqboss_move3'], 5, -1);
  mk('cqboss-atk',        ['cqboss_atk0','cqboss_atk1'], 4, 0);
  mk('cqboss-chargewind', ['cqboss_chargeWind','cqboss_idle0'], 6, -1);
  mk('cqboss-hit',        ['cqboss_hit'], 10, 0);
  mk('cqboss-birth',      ['cqboss_birth0','cqboss_birth1','cqboss_birth2','cqboss_birth3','cqboss_birth4'], 4, 0);
  mk('cqboss-die',        ['cqboss_die0','cqboss_die1','cqboss_die2','cqboss_die3','cqboss_die4'], 6, 0);

  // Castle boss (Castle Dragon) animations
  mk('cdboss-idle',       ['cdboss_idle0','cdboss_idle1'], 2, -1);
  mk('cdboss-move',       ['cdboss_move0','cdboss_move1','cdboss_move2','cdboss_move3'], 5, -1);
  mk('cdboss-atk',        ['cdboss_atk0','cdboss_atk1'], 4, 0);
  mk('cdboss-chargewind', ['cdboss_chargeWind','cdboss_idle0'], 6, -1);
  mk('cdboss-hit',        ['cdboss_hit'], 10, 0);
  mk('cdboss-birth',      ['cdboss_birth0','cdboss_birth1','cdboss_birth2','cdboss_birth3','cdboss_birth4'], 4, 0);
  mk('cdboss-die',        ['cdboss_die0','cdboss_die1','cdboss_die2','cdboss_die3','cdboss_die4'], 6, 0);

  // Queen orb spin animation
  mk('qorb-spin', ['qorb_0','qorb_1'], 8, -1);

  // Dragon fireball spin animation
  mk('dfball-spin', ['dfball_0','dfball_1','dfball_2','dfball_3'], 10, -1);
  mk('dfexpl', ['dfexpl_0','dfexpl_1','dfexpl_2','dfexpl_3','dfexpl_4'], 14, 0);

  // Pre-render river squiggle textures (small clusters of dashes)
  for (let vi = 0; vi < 5; vi++) {
    const sz = 20;
    const c = document.createElement('canvas');
    c.width = sz; c.height = sz;
    const x = c.getContext('2d')!;
    x.strokeStyle = '#ffffff';
    x.lineWidth = 1;
    x.lineCap = 'round';
    let h = ((vi * 73856093 + 12345) >>> 0) % 2147483647;
    const rng = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
    const count = 3 + (vi % 3);
    for (let j = 0; j < count; j++) {
      const ox = sz / 2 + (rng() - 0.5) * 14;
      const oy = sz / 2 + (rng() - 0.5) * 10;
      const ang = rng() * Math.PI;
      const halfLen = 1.5 + rng() * 3;
      x.globalAlpha = 0.5 + rng() * 0.3;
      x.beginPath();
      x.moveTo(ox - Math.cos(ang) * halfLen, oy - Math.sin(ang) * halfLen);
      x.lineTo(ox + Math.cos(ang) * halfLen, oy + Math.sin(ang) * halfLen);
      x.stroke();
    }
    if (scene.textures.exists(`river_squig_${vi}`)) scene.textures.remove(`river_squig_${vi}`);
    scene.textures.addCanvas(`river_squig_${vi}`, c);
  }
}
