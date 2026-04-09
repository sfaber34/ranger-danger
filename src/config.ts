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
    hp: 120,
    cost: 60,
    fireRate: 620,
    range: 240,
    projectileSpeed: 480,
    damage: 16,
    tiles: 2 // 2x2 footprint
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
    breakEvery: 100,        // trigger a build break every N spawned enemies
    breakDuration: 15000    // ms of pause during a build break
  },

  winKills: 200 // kills needed to trigger the boss; defeating the boss wins
};
