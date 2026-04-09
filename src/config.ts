export const CFG = {
  width: 960,
  height: 640,
  tile: 32,
  worldCols: 30,
  worldRows: 20,

  player: {
    hp: 100,
    speed: 150,
    fireRate: 380,
    range: 260,
    projectileSpeed: 520,
    damage: 10
  },

  tower: {
    cost: 60,     // L1 build cost
    tiles: 2,     // 2x2 footprint
    levels: [
      { hp: 120, fireRate: 620, range: 240, damage: 16, projectileSpeed: 480, upgradeCost: 60 },
      { hp: 170, fireRate: 520, range: 270, damage: 24, projectileSpeed: 520, upgradeCost: 110 },
      { hp: 240, fireRate: 430, range: 300, damage: 34, projectileSpeed: 560, upgradeCost: 0 }
    ]
  },

  wall: {
    hp: 80,
    cost: 5
  },

  startMoney: 60,

  enemy: {
    basic: { hp: 20, speed: 60, dmg: 8, coin: 1, color: 0xd9412b },
    heavy: { hp: 30, speed: 40, dmg: 10, coin: 2, color: 0x7a1d14 }
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
    waveBreak: 15000        // ms of build break between waves
  },

  winKills: 200, // kills needed to trigger the boss; defeating the boss wins

  boss: {
    prepTime: 15000 // ms between clearing the last wave enemy and boss arrival
  }
};
