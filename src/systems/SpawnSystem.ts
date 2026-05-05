import Phaser from 'phaser';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { CFG } from '../config';
import { Enemy, EnemyKind } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Projectile } from '../entities/Projectile';
import { SFX } from '../audio/sfx';
import { Biome } from '../levels';
import { computeViewport, viewportWorldSize } from '../viewport';
import type { GameScene } from '../scenes/GameScene';

// Singles run events 1-6 (one boss per event, fixed order regardless of
// which level the run started on). Doubles run events 7+, looping the
// 9-entry table with HP scaling that compounds 1.15× per full pass past
// the first.
export type InfBossDef = { biome: Biome; kind?: 'queen' | 'dragon' };
const INF_RAM:    InfBossDef = { biome: 'grasslands' };
const INF_FOREST: InfBossDef = { biome: 'forest' };
const INF_INFEC:  InfBossDef = { biome: 'infected' };
const INF_RIVER:  InfBossDef = { biome: 'river' };
const INF_QUEEN:  InfBossDef = { biome: 'castle', kind: 'queen' };
const INF_DRAGON: InfBossDef = { biome: 'castle', kind: 'dragon' };

const INF_SINGLES: InfBossDef[] = [
  INF_RAM, INF_FOREST, INF_INFEC, INF_RIVER, INF_QUEEN, INF_DRAGON,
];

const INF_DOUBLES: { bosses: [InfBossDef, InfBossDef]; baseHpMult: number }[] = [
  { bosses: [INF_RAM,    INF_FOREST], baseHpMult: 1 },
  { bosses: [INF_FOREST, INF_INFEC],  baseHpMult: 1 },
  { bosses: [INF_INFEC,  INF_RIVER],  baseHpMult: 1 },
  { bosses: [INF_RIVER,  INF_QUEEN],  baseHpMult: 1 },
  { bosses: [INF_QUEEN,  INF_DRAGON], baseHpMult: 1 },
  { bosses: [INF_DRAGON, INF_RAM],    baseHpMult: 1.15 },
  { bosses: [INF_RAM,    INF_FOREST], baseHpMult: 1.15 },
  { bosses: [INF_FOREST, INF_DRAGON], baseHpMult: 1.15 },
  { bosses: [INF_QUEEN,  INF_DRAGON], baseHpMult: 1.15 },
];

/** Pick the boss(es) for a 0-indexed boss event in infinite mode. */
export function pickInfiniteBosses(eventIdx: number): { bosses: InfBossDef[]; hpMult: number } {
  if (eventIdx < INF_SINGLES.length) {
    return { bosses: [INF_SINGLES[eventIdx]], hpMult: 1 };
  }
  const di = eventIdx - INF_SINGLES.length;
  const slot = di % INF_DOUBLES.length;
  const cycle = Math.floor(di / INF_DOUBLES.length);
  const entry = INF_DOUBLES[slot];
  return {
    bosses: [...entry.bosses],
    hpMult: entry.baseHpMult * Math.pow(1.15, cycle),
  };
}

/** Title text used by the boss-warning countdown / "X APPROACHES" banner. */
export function infiniteBossTitle(def: InfBossDef): string {
  if (def.kind === 'queen') return 'PHANTOM QUEEN';
  if (def.kind === 'dragon') return 'CASTLE DRAGON';
  if (def.biome === 'forest') return 'WENDIGO';
  if (def.biome === 'infected') return 'BLIGHTED ONE';
  if (def.biome === 'river') return 'FOG PHANTOM';
  return 'ANCIENT RAM';
}

// ---------------------------------------------------------------------------
// Infinite-mode enemy theme rotation
// ---------------------------------------------------------------------------
// Normal-wave enemy pool grows with bossesCleared:
//   events 1-2 (cycles 0-1): home biome only
//   events 3-4 (cycles 2-3): home + 1 neighbour
//   events 5-6 (cycles 4-5): home + 2 neighbours
//   events 7+  (cycles 6+) : all 5 biomes mixed
// "Castle elites" (warlock / golem / shadow_imp / skeleton) trickle in
// starting event 5 with 5% chance, +5% per event, capped at 30%.

type SpawnBiome = 'grasslands' | 'forest' | 'infected' | 'river' | 'castle';

/** Order in which non-home biomes get added to the rotation pool. */
const BIOME_RAMP: SpawnBiome[] = ['grasslands', 'forest', 'infected', 'river', 'castle'];

/** Pool of biomes the normal-wave picker may sample from for this run. */
function getInfinitePool(home: SpawnBiome, bossesCleared: number): SpawnBiome[] {
  if (bossesCleared < 2) return [home];
  const others = BIOME_RAMP.filter(b => b !== home);
  if (bossesCleared < 4) return [home, others[0]];
  if (bossesCleared < 6) return [home, others[0], others[1]];
  return BIOME_RAMP.slice();
}

/** Per-biome kind picker — same odds as the campaign-mode spawnEnemy
 *  branches, just factored out so the infinite picker can reuse them
 *  for any biome it samples. */
function pickKindForBiome(biome: SpawnBiome, heavyChance: number): EnemyKind {
  if (biome === 'forest') return Math.random() < heavyChance ? 'bear' : 'spider';
  if (biome === 'infected') {
    const r = Math.random();
    if (r < CFG.infected.toadChance) return 'toad';
    if (r < CFG.infected.toadChance + heavyChance) return 'infected_heavy';
    return 'infected_basic';
  }
  if (biome === 'river') {
    const r = Math.random();
    if (r < heavyChance) return 'bat';
    if (r < 0.4) return 'mosquito';
    return 'crow';
  }
  if (biome === 'castle') {
    const r = Math.random();
    if (r < heavyChance) return 'golem';
    if (r < heavyChance + 0.15) return 'warlock';
    if (r < heavyChance + 0.35) return 'shadow_imp';
    return 'skeleton';
  }
  return Math.random() < heavyChance ? 'deer' : 'snake';
}

/** Maps an enemy kind back to its "home" biome — used for cluster sizing
 *  / spread now that infinite mode mixes kinds across biomes. */
function biomeOfKind(kind: EnemyKind): SpawnBiome {
  switch (kind) {
    case 'bear': case 'spider': case 'wolf':
      return 'forest';
    case 'toad': case 'infected_basic': case 'infected_heavy': case 'infected_runner':
      return 'infected';
    case 'crow': case 'bat': case 'mosquito': case 'dragonfly':
      return 'river';
    case 'skeleton': case 'warlock': case 'golem': case 'shadow_imp':
    case 'castle_bat': case 'castle_rat':
      return 'castle';
    default:
      return 'grasslands';
  }
}

/** Pick a normal-wave enemy kind in infinite mode. Honours theme
 *  rotation and the castle-elite trickle. */
function pickInfiniteEnemyKind(home: SpawnBiome, bossesCleared: number, heavyChance: number): EnemyKind {
  // Castle elite trickle starts at event 5 (after 4 bosses cleared).
  if (bossesCleared >= 4) {
    const eliteChance = Math.min(0.3, 0.05 + (bossesCleared - 4) * 0.05);
    if (Math.random() < eliteChance) {
      const r = Math.random();
      if (r < 0.25) return 'warlock';
      if (r < 0.50) return 'skeleton';
      if (r < 0.75) return 'shadow_imp';
      return 'golem';
    }
  }
  const pool = getInfinitePool(home, bossesCleared);
  const biome = pool[Math.floor(Math.random() * pool.length)];
  return pickKindForBiome(biome, heavyChance);
}

/** Pool of pack KINDS available for runner-pack bursts in infinite mode.
 *  Same theme-rotation rules as normal enemies. */
function pickInfinitePackKind(home: SpawnBiome, bossesCleared: number): EnemyKind {
  const pool = getInfinitePool(home, bossesCleared);
  const biome = pool[Math.floor(Math.random() * pool.length)];
  if (biome === 'castle') {
    const r = Math.random();
    return r < 0.33 ? 'castle_bat' : r < 0.66 ? 'castle_rat' : 'shadow_imp';
  }
  return biome === 'forest' ? 'wolf'
    : biome === 'infected' ? 'infected_runner'
    : biome === 'river' ? 'dragonfly'
    : 'rat';
}

/**
 * Wave-driven spawning: ramps difficulty, fires runner-pack bursts, picks
 * enemy types per biome, and triggers the boss lead-in / spawn for each
 * mode (campaign, castle, infinite).
 */
export class SpawnSystem {
  private infiniteFirstCorner: number | undefined = undefined;

  constructor(private scene: GameScene) {}

  recomputeSpawnDist() {
    const scene = this.scene;
    const vp = computeViewport();
    const { w: viewW, h: viewH } = viewportWorldSize(vp);
    const cornerTiles = Math.ceil(Math.hypot(viewW / 2, viewH / 2) / CFG.tile);
    scene.spawnDist = Math.max(CFG.spawnDist, cornerTiles + 4);
  }

  liveEnemyCount(): number {
    let n = 0;
    this.scene.enemies.children.iterate((c: any) => {
      const e = c as Enemy;
      if (e && e.active && !e.dying) n++;
      return true;
    });
    return n;
  }

  applyEnemyDifficulty(e: Enemy) {
    const scene = this.scene;
    if (scene.enemyHpMult !== 1) {
      e.hp = Math.ceil(e.hp * scene.enemyHpMult);
      e.maxHp = e.hp;
    }
    if (scene.enemySpeedMult !== 1) {
      e.speed = Math.ceil(e.speed * scene.enemySpeedMult);
    }
    if (scene.enemyDmgMult !== 1) {
      e.dmg = Math.ceil(e.dmg * scene.enemyDmgMult);
    }
  }

  spawnBoss() {
    const scene = this.scene;
    if (scene.bossState.bossSpawned) return;
    scene.bossState.bossSpawned = true;
    const spawnR = scene.spawnDist * CFG.tile;
    const px = scene.player.x, py = scene.player.y;
    const corners = [
      { x: px - spawnR, y: py - spawnR },
      { x: px + spawnR, y: py - spawnR },
      { x: px - spawnR, y: py + spawnR },
      { x: px + spawnR, y: py + spawnR }
    ];
    const pick = corners[Math.floor(Math.random() * corners.length)];
    scene.bossState.boss = new Boss(scene, pick.x, pick.y, scene.biome);
    if (scene.biome === 'grasslands') {
      scene.bossState.boss.hp = 800; scene.bossState.boss.maxHp = 800;
      scene.bossState.boss.dmg = 15; scene.bossState.boss.speed = 24;
    }
    scene.hud.pushHud();
    scene.physics.add.overlap(scene.projectiles, scene.bossState.boss, (a: any, b: any) => {
      const pr = (a instanceof Projectile ? a : b) as Projectile;
      const bs = (a instanceof Boss ? a : b) as Boss;
      scene.combat.projectileHitsBoss(pr, bs);
    });
    const onStructureHit = () => {
      if (scene.bossState.boss && scene.bossState.boss.state === 'charging') {
        scene.bossState.boss.stateEnd = 0;
      }
    };
    scene.physics.add.collider(scene.bossState.boss, scene.wallGroup, onStructureHit, () => scene.biome !== 'river');
    scene.physics.add.collider(scene.bossState.boss, scene.towerGroup, onStructureHit, () => scene.biome !== 'river');
    getEvents(scene.game.events).emit('boss-spawn', { hp: scene.bossState.boss.hp, maxHp: scene.bossState.boss.maxHp, biome: scene.biome });
    getRegistry(scene.game).set('bossActive', true);
    getRegistry(scene.game).set('bossHp', scene.bossState.boss.hp);
    getRegistry(scene.game).set('bossMaxHp', scene.bossState.boss.maxHp);
    getRegistry(scene.game).set('bossBiome', scene.biome);
    SFX.play('bossSpawn');
    const bossTitle = scene.biome === 'forest' ? 'THE WENDIGO'
                    : scene.biome === 'infected' ? 'THE BLIGHTED ONE'
                    : scene.biome === 'river' ? 'THE FOG PHANTOM'
                    : 'THE ANCIENT RAM';
    scene.countdownMsg = `${bossTitle} APPROACHES`;
    scene.countdownColor = '#ff5050';
    scene.hud.pushHud();
    scene.time.delayedCall(3000, () => {
      scene.countdownMsg = '';
      scene.hud.pushHud();
    });
    scene.cameras.main.shake(300, 0.005);
  }

  spawnCastleBoss(kind: 'queen' | 'dragon') {
    const scene = this.scene;
    scene.bossState.bossSpawned = true;
    const spawnR = scene.spawnDist * CFG.tile;
    const px = scene.player.x, py = scene.player.y;
    const corners = [
      { x: px - spawnR, y: py - spawnR },
      { x: px + spawnR, y: py - spawnR },
      { x: px - spawnR, y: py + spawnR },
      { x: px + spawnR, y: py + spawnR }
    ];
    const pick = corners[Math.floor(Math.random() * corners.length)];
    const b = new Boss(scene, pick.x, pick.y, 'castle', kind);

    if (kind === 'queen') {
      b.hp = CFG.castle.queenHp; b.maxHp = CFG.castle.queenHp;
      b.dmg = CFG.castle.queenDmg; b.speed = CFG.castle.queenSpeed;
      scene.bossState.midBoss = b;
      scene.bossState.castlePhase = 1;
      scene.nextQueenOrb = scene.vTime + CFG.castle.queenOrbFireRate;
      scene.nextQueenTeleport = scene.vTime + CFG.castle.queenTeleportCooldown;
      scene.nextQueenAura = scene.vTime + CFG.castle.queenAuraCooldown;
    } else {
      b.hp = CFG.castle.dragonHp; b.maxHp = CFG.castle.dragonHp;
      b.dmg = CFG.castle.dragonDmg; b.speed = CFG.castle.dragonSpeed;
      scene.bossState.castlePhase = 3;
      scene.nextDragonFireball = scene.vTime + CFG.castle.dragonFireballRate;
    }

    scene.bossState.boss = b;
    scene.hud.pushHud();
    scene.physics.add.overlap(scene.projectiles, b, (a: any, bb: any) => {
      const pr = (a instanceof Projectile ? a : bb) as Projectile;
      const bs = (a instanceof Boss ? a : bb) as Boss;
      scene.combat.projectileHitsBoss(pr, bs);
    });
    const onStructureHit = () => {
      if (scene.bossState.boss && scene.bossState.boss.state === 'charging') {
        scene.bossState.boss.stateEnd = 0;
      }
    };
    scene.physics.add.collider(b, scene.wallGroup, onStructureHit);
    scene.physics.add.collider(b, scene.towerGroup, onStructureHit);

    const bossTitle = kind === 'queen' ? 'THE PHANTOM QUEEN' : 'THE CASTLE DRAGON';
    getEvents(scene.game.events).emit('boss-spawn', { hp: b.hp, maxHp: b.maxHp, biome: 'castle', bossKind: kind });
    SFX.play('bossSpawn');
    scene.countdownMsg = `${bossTitle} APPROACHES`;
    scene.countdownColor = '#ff5050';
    scene.hud.pushHud();
    scene.time.delayedCall(3000, () => { scene.countdownMsg = ''; scene.hud.pushHud(); });
    scene.cameras.main.shake(300, 0.005);
  }

  spawnInfiniteBoss(def: InfBossDef, hpMult: number, slotIdx: number) {
    const scene = this.scene;
    const spawnR = scene.spawnDist * CFG.tile;
    const px = scene.player.x, py = scene.player.y;
    const corners = [
      { x: px - spawnR, y: py - spawnR },
      { x: px + spawnR, y: py - spawnR },
      { x: px - spawnR, y: py + spawnR },
      { x: px + spawnR, y: py + spawnR },
    ];
    let cornerIdx: number;
    if (slotIdx === 0) {
      cornerIdx = Math.floor(Math.random() * corners.length);
      this.infiniteFirstCorner = cornerIdx;
    } else {
      const taken = this.infiniteFirstCorner ?? 0;
      const others = [0, 1, 2, 3].filter(c => c !== taken);
      cornerIdx = others[Math.floor(Math.random() * others.length)];
    }
    const pick = corners[cornerIdx];
    const b = new Boss(scene, pick.x, pick.y, def.biome, def.kind ?? '');

    if (def.kind === 'queen') {
      b.hp = CFG.castle.queenHp; b.maxHp = CFG.castle.queenHp;
      b.dmg = CFG.castle.queenDmg; b.speed = CFG.castle.queenSpeed;
      scene.nextQueenOrb = scene.vTime + CFG.castle.queenOrbFireRate;
      scene.nextQueenTeleport = scene.vTime + CFG.castle.queenTeleportCooldown;
      scene.nextQueenAura = scene.vTime + CFG.castle.queenAuraCooldown;
    } else if (def.kind === 'dragon') {
      b.hp = CFG.castle.dragonHp; b.maxHp = CFG.castle.dragonHp;
      b.dmg = CFG.castle.dragonDmg; b.speed = CFG.castle.dragonSpeed;
      scene.nextDragonFireball = scene.vTime + CFG.castle.dragonFireballRate;
    } else if (def.biome === 'grasslands') {
      b.hp = 800; b.maxHp = 800;
      b.dmg = 15; b.speed = 24;
    }
    b.hp = Math.round(b.hp * hpMult);
    b.maxHp = b.hp;

    if (slotIdx === 0) scene.bossState.boss = b;
    else scene.bossState.midBoss = b;
    scene.bossState.bossSpawned = true;

    scene.physics.add.overlap(scene.projectiles, b, (a: any, bb: any) => {
      const pr = (a instanceof Projectile ? a : bb) as Projectile;
      const bs = (a instanceof Boss ? a : bb) as Boss;
      scene.combat.projectileHitsBoss(pr, bs);
    });
    const onStructureHit = () => {
      if (b.state === 'charging') b.stateEnd = 0;
    };
    scene.physics.add.collider(b, scene.wallGroup, onStructureHit);
    scene.physics.add.collider(b, scene.towerGroup, onStructureHit);

    if (slotIdx === 0) {
      getEvents(scene.game.events).emit('boss-spawn', { hp: b.hp, maxHp: b.maxHp, biome: def.biome, bossKind: def.kind });
      getRegistry(scene.game).set('bossActive', true);
      getRegistry(scene.game).set('bossHp', b.hp);
      getRegistry(scene.game).set('bossMaxHp', b.maxHp);
      getRegistry(scene.game).set('bossBiome', def.biome);
    }
    scene.hud.pushHud();
  }

  updateSpawning(time: number, delta: number) {
    const scene = this.scene;
    // initial build phase — show countdown, don't spawn anything yet
    if (time < scene.waveState.waveStartAt) {
      if (scene.waveState.waveStartAt === Infinity) {
        scene.hud.syncCountdown('');
        return;
      }
      const secs = Math.ceil((scene.waveState.waveStartAt - time) / 1000);
      scene.hud.syncCountdown(`BUILD PHASE — ${secs}s`, '#7cc4ff');
      return;
    }

    const waveSize = scene.levelWaveSize;
    const isInfinite = scene.difficulty === 'infinite';
    const totalWaves = isInfinite ? 4 : (scene.biome === 'castle' ? 4 : CFG.spawn.waveCount);
    const lastWaveIdx = totalWaves - 1;
    const isBossWave = isInfinite
      ? scene.waveState.wave % 4 === 3
      : scene.biome === 'castle'
        ? (scene.bossState.castlePhase === 0 && scene.waveState.wave === 1) || (scene.bossState.castlePhase === 2 && scene.waveState.wave === 3)
        : scene.waveState.wave >= lastWaveIdx;

    // Castle mid-boss phase: waiting for queen to die before resuming waves
    if (!isInfinite && scene.biome === 'castle' && scene.bossState.castlePhase === 1) {
      if (scene.bossState.midBossDefeated) {
        scene.bossState.enterPostQueenWaves();
        scene.waveState.enterCastlePhase2(time, CFG.spawn.waveBreak);
      }
      return;
    }

    if (scene.bossState.bossSpawned) {
      scene.hud.syncCountdown('');
      return;
    }

    if (time < scene.waveState.waveBreakUntil) {
      const secs = Math.ceil((scene.waveState.waveBreakUntil - time) / 1000);
      let needsPush = false;
      if (scene.countdownMsg) { scene.countdownMsg = ''; needsPush = true; }
      if (scene.hud.lastWaveBreakUntil !== scene.waveState.waveBreakUntil || scene.hud.lastWaveBreakSecond !== secs) {
        scene.hud.lastWaveBreakUntil = scene.waveState.waveBreakUntil;
        scene.hud.lastWaveBreakSecond = secs;
        needsPush = true;
      }
      if (needsPush) scene.hud.pushHud();
      return;
    }

    // Break just ended — force a HUD push so the "WAVE N IN 1s" label
    // flips to "WAVE N" the instant the timer expires, instead of
    // lingering until the first enemy spawn (~spawnInterval later)
    // happens to push for some other reason.
    if (scene.hud.lastWaveBreakUntil > 0) {
      scene.hud.lastWaveBreakUntil = 0;
      scene.hud.lastWaveBreakSecond = -1;
      scene.hud.pushHud();
    }

    // Infinite-mode boss waves are *boss-only* — no preceding enemy
    // spawn phase. Fast-forward the wave counters so the boss-lead-in
    // branch below kicks straight into the boss-prep countdown.
    if (isInfinite && isBossWave && scene.waveState.waveSpawned === 0) {
      scene.waveState.waveSpawned = waveSize;
      scene.waveState.waveKills = waveSize;
    }

    if (isBossWave && scene.waveState.waveSpawned >= waveSize) {
      const live = this.liveEnemyCount();
      const left = Math.max(live, waveSize - scene.waveState.waveKills);
      if (left > 0) {
        scene.hud.syncCountdown(`KILL THE STRAGGLERS — ${left} LEFT`, '#ff9a4a');
      } else {
        if (scene.waveState.bossCountdownUntil === 0) {
          scene.waveState.startBossPrep(time, CFG.boss.prepTime);
        }
        if (time >= scene.waveState.bossCountdownUntil) {
          if (isInfinite) {
            const pick = pickInfiniteBosses(scene.bossState.infiniteBossesCleared);
            this.infiniteFirstCorner = undefined;
            for (let i = 0; i < pick.bosses.length; i++) {
              this.spawnInfiniteBoss(pick.bosses[i], pick.hpMult, i);
            }
            const titles = pick.bosses.map(infiniteBossTitle);
            const banner = titles.length === 1
              ? `THE ${titles[0]} APPROACHES`
              : `${titles[0]} & ${titles[1]} APPROACH`;
            scene.countdownMsg = banner;
            scene.countdownColor = '#ff5050';
            SFX.play('bossSpawn');
            scene.cameras.main.shake(300, 0.005);
            scene.hud.pushHud();
            scene.time.delayedCall(3000, () => { scene.countdownMsg = ''; scene.hud.pushHud(); });
          } else if (scene.biome === 'castle' && scene.bossState.castlePhase === 0) {
            this.spawnCastleBoss('queen');
          } else if (scene.biome === 'castle' && scene.bossState.castlePhase === 2) {
            this.spawnCastleBoss('dragon');
          } else {
            this.spawnBoss();
          }
          return;
        }
        const secs = Math.ceil((scene.waveState.bossCountdownUntil - time) / 1000);
        let bossName: string;
        if (isInfinite) {
          const pick = pickInfiniteBosses(scene.bossState.infiniteBossesCleared);
          bossName = pick.bosses.map(infiniteBossTitle).join(' & ');
        } else {
          bossName = scene.biome === 'forest' ? 'WENDIGO'
                       : scene.biome === 'infected' ? 'BLIGHTED ONE'
                       : scene.biome === 'river' ? 'FOG PHANTOM'
                       : scene.biome === 'castle' && scene.bossState.castlePhase === 0 ? 'PHANTOM QUEEN'
                       : scene.biome === 'castle' && scene.bossState.castlePhase === 2 ? 'CASTLE DRAGON'
                       : 'ANCIENT RAM';
        }
        scene.hud.syncCountdown(`${bossName} SPAWNING IN ${secs}`, '#ff5050');
      }
      return;
    }

    // Non-boss wave finished → start build break, advance wave counter.
    if (!isBossWave && scene.waveState.waveSpawned >= waveSize && scene.waveState.waveKills >= waveSize) {
      scene.waveState.enterWaveBreak(time, CFG.spawn.waveBreak);
      return;
    }

    // Active wave — clear countdown text, wave bar shows progress
    scene.hud.syncCountdown('');

    // Ramp difficulty, spawn until this wave's quota is met.
    scene.spawnTimer += delta;
    scene.rampTimer += delta;
    if (scene.rampTimer > CFG.spawn.rampEvery) {
      scene.rampTimer = 0;
      scene.spawnInterval = Math.max(scene.levelMinInterval, scene.spawnInterval * scene.levelRampFactor);
      // Infinite mode lets heavyChance climb past the campaign cap so
      // late-run waves shift toward the tougher enemy variants.
      const heavyCap = scene.difficulty === 'infinite' ? 0.6 : CFG.spawn.heavyChanceMax;
      scene.heavyChance = Math.min(heavyCap, scene.heavyChance + CFG.spawn.heavyChanceStep);
    }
    if (scene.spawnTimer > scene.spawnInterval && scene.waveState.waveSpawned < waveSize) {
      scene.spawnTimer = 0;
      this.spawnEnemy();
      scene.waveState.recordSpawn();
    }

    // Runner/wolf pack bursts, independent of the normal spawn cadence.
    if (scene.waveState.wave >= CFG.spawn.runnerPackStartWave && scene.waveState.waveSpawned < waveSize) {
      const cdMin = scene.biome === 'forest' ? CFG.forest.wolfPackCooldownMin
                  : scene.biome === 'infected' ? CFG.infected.runnerPackCooldownMin
                  : scene.biome === 'river' ? CFG.river.dragonflyPackCooldownMin
                  : scene.biome === 'castle' ? CFG.castle.impPackCooldownMin
                  : CFG.spawn.runnerPackCooldownMin;
      const cdMax = scene.biome === 'forest' ? CFG.forest.wolfPackCooldownMax
                  : scene.biome === 'infected' ? CFG.infected.runnerPackCooldownMax
                  : scene.biome === 'river' ? CFG.river.dragonflyPackCooldownMax
                  : scene.biome === 'castle' ? CFG.castle.impPackCooldownMax
                  : CFG.spawn.runnerPackCooldownMax;
      if (scene.nextRunnerPack === 0) {
        scene.nextRunnerPack = time + Phaser.Math.Between(cdMin, cdMax);
      } else if (time >= scene.nextRunnerPack) {
        this.spawnRunnerPack();
        scene.nextRunnerPack = time + Phaser.Math.Between(cdMin, cdMax);
      }
    }
  }

  spawnRunnerPack() {
    const scene = this.scene;
    const spawnR = scene.spawnDist * CFG.tile;
    const waveSize = scene.levelWaveSize;
    const side = Phaser.Math.Between(0, 3);
    const sideAngle = side === 0 ? -Math.PI / 2 : side === 1 ? Math.PI / 2 : side === 2 ? Math.PI : 0;
    const packAngle = sideAngle + (Math.random() - 0.5) * (Math.PI / 2);
    const ca = Math.cos(packAngle), sa = Math.sin(packAngle);
    const tx = -sa, ty = ca;
    const computeSpawnPos = () => {
      const px = scene.player.x, py = scene.player.y;
      const jitter = Phaser.Math.Between(-18, 18);
      return {
        cx: px + ca * spawnR + tx * jitter,
        cy: py + sa * spawnR + ty * jitter,
      };
    };
    // Infinite mode rotates through biome packs after a couple of bosses
    // are cleared; campaign mode stays on the home biome's pack.
    const packKind: EnemyKind = scene.difficulty === 'infinite'
      ? pickInfinitePackKind(scene.biome as SpawnBiome, scene.bossState.infiniteBossesCleared)
      : (scene.biome === 'forest' ? 'wolf'
        : scene.biome === 'infected' ? 'infected_runner'
        : scene.biome === 'river' ? 'dragonfly'
        : scene.biome === 'castle'
          ? (Math.random() < 0.33 ? 'castle_bat' : Math.random() < 0.5 ? 'castle_rat' : 'shadow_imp')
          : 'rat');
    // Pack size keys off the picked kind's biome so foreign packs feel
    // identically meaty to their home-biome version.
    const packBiome = biomeOfKind(packKind);
    const base = packBiome === 'forest' ? CFG.forest.wolfPackSize
               : packBiome === 'infected' ? CFG.infected.runnerPackSize
               : packBiome === 'river' ? CFG.river.dragonflyPackSize
               : packBiome === 'castle' ? CFG.castle.impPackSize
               : CFG.spawn.runnerPackSize;
    const n = packBiome === 'forest' ? base + Phaser.Math.Between(0, 5) : base;
    const delay = 150;
    const toSpawn = Math.min(n, waveSize - scene.waveState.waveSpawned);
    for (let i = 0; i < toSpawn; i++) {
      scene.waveState.recordSpawn();
      if (i === 0) {
        const { cx, cy } = computeSpawnPos();
        const e = new Enemy(scene, cx, cy, packKind);
        this.applyEnemyDifficulty(e);
        scene.enemies.add(e);
      } else {
        scene.time.delayedCall(delay * i, () => {
          if (scene.endState.gameOver) return;
          const { cx, cy } = computeSpawnPos();
          const e = new Enemy(scene, cx + Phaser.Math.Between(-8, 8), cy + Phaser.Math.Between(-8, 8), packKind);
          this.applyEnemyDifficulty(e);
          scene.enemies.add(e);
        });
      }
    }
  }

  spawnEnemy() {
    const scene = this.scene;
    const spawnR = scene.spawnDist * CFG.tile;
    const px = scene.player.x, py = scene.player.y;
    const vx = (scene.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    const vy = (scene.player.body as Phaser.Physics.Arcade.Body).velocity.y;

    let angle = Math.random() * Math.PI * 2;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > 20) {
      const moveAngle = Math.atan2(vy, vx);
      if (Math.random() < 0.6) {
        angle = moveAngle + (Math.random() - 0.5) * Math.PI;
      }
    }

    const x = px + Math.cos(angle) * spawnR;
    const y = py + Math.sin(angle) * spawnR;
    let kind: EnemyKind;
    if (scene.difficulty === 'infinite') {
      kind = pickInfiniteEnemyKind(scene.biome as SpawnBiome, scene.bossState.infiniteBossesCleared, scene.heavyChance);
    } else if (scene.biome === 'forest') {
      kind = Math.random() < scene.heavyChance ? 'bear' : 'spider';
    } else if (scene.biome === 'infected') {
      const r = Math.random();
      if (r < CFG.infected.toadChance) kind = 'toad';
      else if (r < CFG.infected.toadChance + scene.heavyChance) kind = 'infected_heavy';
      else kind = 'infected_basic';
    } else if (scene.biome === 'river') {
      const r = Math.random();
      if (r < scene.heavyChance) kind = 'bat';
      else if (r < 0.4) kind = 'mosquito';
      else kind = 'crow';
    } else if (scene.biome === 'castle') {
      const r = Math.random();
      if (r < scene.heavyChance) kind = 'golem';
      else if (r < scene.heavyChance + 0.15) kind = 'warlock';
      else if (r < scene.heavyChance + 0.35) kind = 'shadow_imp';
      else kind = 'skeleton';
    } else {
      kind = Math.random() < scene.heavyChance ? 'deer' : 'snake';
    }

    // Cluster behaviour was originally biome-keyed but enemy kind alone
    // determines whether/how to cluster. Infinite-mode mixed-biome rolls
    // need this kind-keyed check to still get the right cluster shape
    // even though scene.biome != biomeOfKind(kind).
    const kindBiome = biomeOfKind(kind);

    if (kindBiome === 'forest' && kind === 'spider') {
      const n = Math.min(Phaser.Math.Between(CFG.forest.spiderClusterMin, CFG.forest.spiderClusterMax), scene.levelClusterMax);
      const spread = CFG.forest.spiderClusterSpread;
      const waveSize = scene.levelWaveSize;
      const toSpawn = Math.min(n, waveSize - scene.waveState.waveSpawned);
      for (let i = 0; i < toSpawn; i++) {
        const sx = x + Phaser.Math.Between(-spread, spread);
        const sy = y + Phaser.Math.Between(-spread, spread);
        const se = new Enemy(scene, sx, sy, 'spider');
        this.applyEnemyDifficulty(se);
        scene.enemies.add(se);
        if (i > 0) scene.waveState.recordSpawn();
      }
      return;
    }

    if (kindBiome === 'infected' && kind !== 'toad') {
      const n = Math.min(Phaser.Math.Between(CFG.infected.clusterMin, CFG.infected.clusterMax), scene.levelClusterMax);
      const spread = CFG.infected.clusterSpread;
      const waveSize = scene.levelWaveSize;
      const toSpawn = Math.min(n, waveSize - scene.waveState.waveSpawned);
      for (let i = 0; i < toSpawn; i++) {
        const sx = x + Phaser.Math.Between(-spread, spread);
        const sy = y + Phaser.Math.Between(-spread, spread);
        const se = new Enemy(scene, sx, sy, kind);
        this.applyEnemyDifficulty(se);
        scene.enemies.add(se);
        if (i > 0) scene.waveState.recordSpawn();
      }
      return;
    }

    if (kindBiome === 'castle' && kind !== 'warlock') {
      const n = Math.min(Phaser.Math.Between(CFG.castle.clusterMin, CFG.castle.clusterMax), scene.levelClusterMax);
      const spread = CFG.castle.clusterSpread;
      const waveSize = scene.levelWaveSize;
      const toSpawn = Math.min(n, waveSize - scene.waveState.waveSpawned);
      for (let i = 0; i < toSpawn; i++) {
        const sx = x + Phaser.Math.Between(-spread, spread);
        const sy = y + Phaser.Math.Between(-spread, spread);
        const se = new Enemy(scene, sx, sy, kind);
        this.applyEnemyDifficulty(se);
        scene.enemies.add(se);
        if (i > 0) scene.waveState.recordSpawn();
      }
      return;
    }

    if (kindBiome === 'river') {
      const n = Math.min(Phaser.Math.Between(CFG.river.clusterMin, CFG.river.clusterMax), scene.levelClusterMax);
      const spread = CFG.river.clusterSpread;
      const waveSize = scene.levelWaveSize;
      const toSpawn = Math.min(n, waveSize - scene.waveState.waveSpawned);
      for (let i = 0; i < toSpawn; i++) {
        const sx = x + Phaser.Math.Between(-spread, spread);
        const sy = y + Phaser.Math.Between(-spread, spread);
        const se = new Enemy(scene, sx, sy, kind);
        this.applyEnemyDifficulty(se);
        scene.enemies.add(se);
        if (i > 0) scene.waveState.recordSpawn();
      }
      return;
    }

    const e = new Enemy(scene, x, y, kind);
    this.applyEnemyDifficulty(e);
    scene.enemies.add(e);
  }
}
