export const CFG = {
  width: 960,
  height: 640,
  tile: 32,
  viewCols: 30,      // viewport width in tiles (for reference)
  viewRows: 20,      // viewport height in tiles
  spawnDist: 18,     // tiles from player where enemies spawn
  chunkSize: 16,     // ground chunk size in tiles

  // Uniform world-space scale for every boss sprite (enemies render at 0.5).
  // One knob so "big = boss" reads consistently across all biomes — bosses
  // differ by silhouette, not size. The physics body in Boss.ts is
  // compensated so the hitbox still fits through 1-tile gaps.
  bossScale: 0.7,

  player: {
    hp: 100,
    speed: 150,
    fireRate: 480,
    range: 240,
    projectileSpeed: 520,
    damage: 13
  },

  tower: {
    tiles: 2,     // 2x2 footprint
    kinds: {
      arrow: {
        cost: 60,
        levels: [
          { hp: 120, fireRate: 620, range: 240, damage: 20, projectileSpeed: 480, splashRadius: 0, upgradeCost: 60 },
          { hp: 170, fireRate: 460, range: 270, damage: 30, projectileSpeed: 580, splashRadius: 0, upgradeCost: 110 },
          { hp: 240, fireRate: 320, range: 300, damage: 42, projectileSpeed: 700, splashRadius: 0, upgradeCost: 0 }
        ]
      },
      cannon: {
        cost: 60,
        levels: [
          { hp: 180, fireRate: 1400, range: 220, damage: 15, projectileSpeed: 200, splashRadius: 48, upgradeCost: 60 },
          { hp: 250, fireRate: 1100, range: 240, damage: 22, projectileSpeed: 280, splashRadius: 58, upgradeCost: 110 },
          { hp: 340, fireRate: 850, range: 260, damage: 32, projectileSpeed: 360, splashRadius: 72, upgradeCost: 0 }
        ]
      }
    }
  },

  wall: {
    hp: 80,
    cost: 3
  },

  startMoney: 130,

  enemy: {
    basic:  { hp: 20, speed: 60,  dmg: 8,  coin: 1, color: 0xd9412b },
    heavy:  { hp: 30, speed: 40,  dmg: 10, coin: 2, color: 0x7a1d14 },
    runner: { hp: 12, speed: 140, dmg: 5,  coin: 1, color: 0x6af078 },
    // Meadow enemies (new)
    snake:  { hp: 18, speed: 55,  dmg: 7,  coin: 1, color: 0x4a7a30 },
    rat:    { hp: 10, speed: 130, dmg: 4,  coin: 1, color: 0x7a6a5a },
    deer:   { hp: 40, speed: 35,  dmg: 12, coin: 2, color: 0x8a6a48 },
    // Forest enemies
    wolf:   { hp: 14, speed: 120, dmg: 6,  coin: 1, color: 0x8a8a8a },
    bear:   { hp: 50, speed: 32,  dmg: 14, coin: 3, color: 0x5a3a1a },
    spider: { hp: 18, speed: 55,  dmg: 7,  coin: 1, color: 0x2a2a2a },
    // River flying enemies
    crow:      { hp: 18, speed: 58,  dmg: 7,  coin: 1, color: 0x232330 },
    bat:       { hp: 35, speed: 36,  dmg: 11, coin: 2, color: 0x3c2832 },
    dragonfly: { hp: 10, speed: 135, dmg: 4,  coin: 1, color: 0x28a0b4 },
    mosquito:  { hp: 14, speed: 50,  dmg: 3,  coin: 1, color: 0x504638 },
    // Infected ranged enemy
    toad:      { hp: 30, speed: 45,  dmg: 8,  coin: 2, color: 0x9040d0 },
    // Castle enemies
    skeleton:    { hp: 22, speed: 55,  dmg: 8,  coin: 1, color: 0xd8d0c0 },
    warlock:     { hp: 18, speed: 38,  dmg: 6,  coin: 2, color: 0x6a28a0 },
    golem:       { hp: 55, speed: 28,  dmg: 14, coin: 3, color: 0x3c4250 },
    shadow_imp:  { hp: 16, speed: 90,  dmg: 6,  coin: 1, color: 0x2a1a38 },
    castle_bat:  { hp: 10, speed: 120, dmg: 4,  coin: 1, color: 0x3a2a3a },
    castle_rat:  { hp: 10, speed: 130, dmg: 4,  coin: 1, color: 0x5a4a38 },
    // Desert enemies
    scorpion:        { hp: 24, speed: 58,  dmg: 8,  coin: 1, color: 0x9a5a24 },
    boss_scorpion:   { hp: 14, speed: 96,  dmg: 5,  coin: 0, color: 0x5f6f2f },
    scarab:          { hp: 16, speed: 105, dmg: 5,  coin: 1, color: 0x2f5c58 },
    sand_mite:       { hp: 12, speed: 135, dmg: 4,  coin: 1, color: 0xc8943e },
    cactus_hopper:   { hp: 32, speed: 44,  dmg: 10, coin: 2, color: 0x4f8a3a },
    dune_strider:    { hp: 26, speed: 88,  dmg: 7,  coin: 1, color: 0xd0a45a },
    sand_wraith:     { hp: 42, speed: 42,  dmg: 12, coin: 2, color: 0xb8a070 },
    temple_guardian: { hp: 58, speed: 32,  dmg: 14, coin: 3, color: 0xb89052 },
    sun_mote:        { hp: 18, speed: 60,  dmg: 6,  coin: 2, color: 0xffd45a }
  },

  coin: { magnetRange: 90, magnetSpeed: 420 },

  spawn: {
    startDelay: 10000,      // ms of build time before the first enemy spawns
    initialInterval: 2600,  // starting ms between spawns
    minInterval: 350,       // floor for spawn interval at max ramp
    rampEvery: 12000,       // ms between difficulty ramps
    rampFactor: 0.93,       // interval *= rampFactor each ramp
    heavyChanceStart: 0.0,
    heavyChanceMax: 0.35,
    heavyChanceStep: 0.03,
    waveSize: 100,          // enemies per wave
    waveCount: 2,           // number of waves before the boss
    waveBreak: 15000,       // ms of build break between waves
    runnerPackStartWave: 1, // 0-indexed wave at which runner packs start appearing
    runnerPackSize: 5,      // runners per pack
    runnerPackCooldownMin: 7000,
    runnerPackCooldownMax: 12000
  },

  forest: {
    wolfPackSize: 4,
    wolfPackCooldownMin: 8000,
    wolfPackCooldownMax: 14000,
    spiderWebDuration: 4000,
    spiderWebSlowFactor: 0.5,
    spiderClusterMin: 2,        // spiders spawn in clusters of 2-4
    spiderClusterMax: 4,
    spiderClusterSpread: 20,    // px spread within the cluster
  },

  infected: {
    runnerPackSize: 5,
    runnerPackCooldownMin: 6000,
    runnerPackCooldownMax: 11000,
    clusterMin: 2,              // infected enemies spawn in groups of 2-3
    clusterMax: 3,
    clusterSpread: 24,          // px spread within the cluster
    rampFactor: 0.88,           // faster ramp than normal (0.93)
    minInterval: 250,           // tighter floor than normal (350)
    toadRange: 300,             // px — distance at which toad starts lobbing globs (it keeps hopping while in range)
    toadFireRate: 2800,         // ms between lobs
    toadGlobSpeed: 120,         // slow arcing glob
    toadGlobDmg: 8,
    toadGlobSplash: 12,         // smaller than half a tile — easier to sidestep
    toadGlobLifetime: 3500,
    toadGlobArcHeight: 60,      // px — peak height of the arc
    toadHopInterval: 500,       // ms between hops
    toadHopDuration: 350,       // ms a hop takes (airborne)
    toadChance: 0.15,           // chance a spawn is a toad instead of normal infected
  },

  river: {
    mosquitoRange: 260,       // px — distance at which mosquito stops and shoots
    mosquitoFireRate: 2200,   // ms between shots
    mosquitoDartSpeed: 180,   // slow-moving projectile
    mosquitoDartDmg: 5,
    mosquitoDartLifetime: 3000,
    dragonflyPackSize: 4,
    dragonflyPackCooldownMin: 7000,
    dragonflyPackCooldownMax: 12000,
    clusterMin: 2,
    clusterMax: 4,
    clusterSpread: 60, // looser than infected (40) but still grouped
  },

  castle: {
    warlockRange: 220,         // px — distance at which warlock stops and casts
    warlockFireRate: 2400,     // ms between shots
    warlockBoltSpeed: 160,     // purple bolt speed
    warlockBoltDmg: 6,
    warlockBoltLifetime: 3000,
    impPackSize: 4,
    impPackCooldownMin: 8000,
    impPackCooldownMax: 13000,
    batPackSize: 5,
    batPackCooldownMin: 7000,
    batPackCooldownMax: 12000,
    clusterMin: 2,
    clusterMax: 3,
    clusterSpread: 24,
    // Phantom Queen (mid-boss)
    queenHp: 1200,
    queenSpeed: 34,
    queenDmg: 16,
    queenOrbSpeed: 160,
    queenOrbDmg: 10,
    queenOrbLifetime: 3500,
    queenOrbBurstCount: 3,     // fires 3 orbs at a time
    queenOrbFireRate: 2400,    // ms between bursts (faster)
    queenTeleportCooldown: 4500, // ms between teleports (more frequent)
    queenTeleportRange: 170,   // px closer to player
    // Slow structure-damaging aura — telegraphs a purple ring at the queen's
    // current position, then strikes after the windup. Locked to cast spot
    // even if she teleports.
    queenAuraRadius: 110,
    queenAuraDmg: 14,
    queenAuraCooldown: 4000,
    queenAuraWindup: 1100,
    // Castle Dragon (final boss)
    dragonHp: 2000,
    dragonSpeed: 22,
    dragonDmg: 22,
    dragonFireballSpeed: 150,
    dragonFireballDmg: 18,
    dragonFireballSplash: 56,  // AoE radius
    dragonFireballLifetime: 3500,
    dragonFireballRate: 1700,  // ms between fireballs (~30% faster than the original 2200ms)
  },

  desert: {
    cactusDmg: 4,
    cactusDmgRate: 650,
    quicksandSlowFactor: 0.38,
    quicksandDelay: 3000,
    quicksandDmg: 4,
    quicksandDmgRate: 800,
    clusterMin: 2,
    clusterMax: 4,
    clusterSpread: 28,
    mitePackSize: 5,
    mitePackCooldownMin: 6500,
    mitePackCooldownMax: 11000,
    sunMoteRange: 330,
    sunMoteFireRate: 2300,
    sunBoltSpeed: 190,
    sunBoltDmg: 7,
    sunBoltLifetime: 3200,
    burrowerHp: 1050,
    burrowerSpeed: 34,
    burrowerDmg: 16,
    scorpionHp: 1250,
    scorpionSpeed: 30,
    scorpionDmg: 18,
    sandstormHp: 1350,
    sandstormSpeed: 42,
    sandstormDmg: 17,
    wraithHp: 1550,
    wraithSpeed: 36,
    wraithDmg: 18,
    constructHp: 1300,
    constructSpeed: 30,
    constructDmg: 18,
    sunPriestHp: 2300,
    sunPriestSpeed: 24,
    sunPriestDmg: 24,
  },

  winKills: 200, // kills needed to trigger the boss; defeating the boss wins

  boss: {
    prepTime: 15000 // ms between clearing the last wave enemy and boss arrival
  }
};
