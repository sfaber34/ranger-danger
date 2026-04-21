export const CFG = {
  width: 960,
  height: 640,
  tile: 32,
  viewCols: 30,      // viewport width in tiles (for reference)
  viewRows: 20,      // viewport height in tiles
  spawnDist: 18,     // tiles from player where enemies spawn
  chunkSize: 16,     // ground chunk size in tiles

  player: {
    hp: 100,
    speed: 150,
    fireRate: 480,
    range: 240,
    projectileSpeed: 520,
    damage: 10
  },

  tower: {
    tiles: 2,     // 2x2 footprint
    kinds: {
      arrow: {
        cost: 60,
        levels: [
          { hp: 120, fireRate: 620, range: 240, damage: 16, projectileSpeed: 480, splashRadius: 0, upgradeCost: 60 },
          { hp: 170, fireRate: 460, range: 270, damage: 24, projectileSpeed: 580, splashRadius: 0, upgradeCost: 110 },
          { hp: 240, fireRate: 320, range: 300, damage: 34, projectileSpeed: 700, splashRadius: 0, upgradeCost: 0 }
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
    cost: 5
  },

  startMoney: 120,

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
    mosquito:  { hp: 14, speed: 50,  dmg: 3,  coin: 1, color: 0x504638 }
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
    spiderWebSlowFactor: 0.5
  },

  infected: {
    runnerPackSize: 5,
    runnerPackCooldownMin: 6000,
    runnerPackCooldownMax: 11000,
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
  },

  winKills: 200, // kills needed to trigger the boss; defeating the boss wins

  boss: {
    prepTime: 15000 // ms between clearing the last wave enemy and boss arrival
  }
};
