import Phaser from 'phaser';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { CFG } from '../config';
import { Player } from '../entities/Player';
import { Enemy, EnemyKind } from '../entities/Enemy';
import { Tower, TowerKind } from '../entities/Tower';
import { Wall } from '../entities/Wall';
import { Projectile } from '../entities/Projectile';
import { Coin } from '../entities/Coin';
import { Boss } from '../entities/Boss';
import { createSparseGrid, gridGet, gridSet, SparseGrid } from '../systems/Pathfinding';
import { CoinSystem } from '../systems/CoinSystem';
import { PathingSystem } from '../systems/PathingSystem';
import { DepthSortSystem } from '../systems/DepthSortSystem';
import { ChunkSystem } from '../systems/ChunkSystem';
import { HudSystem } from '../systems/HudSystem';
import { TowerPanelSystem } from '../systems/TowerPanelSystem';
import { BuildSystem } from '../systems/BuildSystem';
import { SellSystem } from '../systems/SellSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { EnemyBossSystem } from '../systems/EnemyBossSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { EndSystem } from '../systems/EndSystem';
import { WaveState } from '../state/WaveState';
import { BuildState, BuildKind } from '../state/BuildState';
import { BossState } from '../state/BossState';
import { EndState } from '../state/EndState';
import { RunStats } from '../state/RunStats';
import { PlayerUpgradeState } from '../state/PlayerUpgradeState';
import { SFX } from '../audio/sfx';
import { generateAllArt, registerAnimations } from '../assets/generateArt';
import { Difficulty, Biome, LEVELS } from '../levels';
import { computeViewport, viewportWorldSize } from '../viewport';

// Tower-base sprites used by generateAllArt() in create(). Kept out of
// BootScene so they don't block PLAY → level-select.
import towerBaseImg from '../assets/sprites/tower_base.png';
import arrowBase1Img from '../assets/sprites/arrow_base_1.png';
import arrowBase2Img from '../assets/sprites/arrow_base_2.png';
import cannonBaseImg from '../assets/sprites/cannon_base.png';
import cannonBase1Img from '../assets/sprites/cannon_base_1.png';
import cannonBase2Img from '../assets/sprites/cannon_base_2.png';
import {
  loadSpriteOverrides,
  applySpriteOverrides,
  reregisterSpriteOverrideAnimations,
} from '../assets/spriteOverrides';

// BuildKind moved to src/state/BuildState.ts. Re-exported here so existing
// `import { BuildKind } from '../scenes/GameScene'` callers don't break.
export type { BuildKind } from '../state/BuildState';


export class GameScene extends Phaser.Scene {
  player!: Player;
  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  enemyDarts!: Phaser.Physics.Arcade.Group;
  toadGlobs!: Phaser.Physics.Arcade.Group;
  coins!: Phaser.Physics.Arcade.Group;
  walls: Wall[] = [];
  towers: Tower[] = [];
  wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  towerGroup!: Phaser.Physics.Arcade.StaticGroup;

  grid: SparseGrid = createSparseGrid();
  gridVersion = 0;
  generatedChunks = new Set<string>();
  chunkImages = new Map<string, Phaser.GameObjects.Image>();
  pendingChunks: { cx: number; cy: number }[] = [];
  lastChunkCx = -9999;
  lastChunkCy = -9999;
  loadingDone = false;

  keys!: any;
  /** Build-mode state machine — kind ('none'|'tower'|'wall'), last-selected
   *  towerKind, and the shared paused flag. Mutate via setKind() and
   *  paused = true/false (the BuildSystem coordinates pause/resume). */
  buildState = new BuildState();
  // Bound listeners stored so shutdown() can remove the exact handlers it
  // registered. Calling game.events.off(name) without a fn ref nukes ALL
  // listeners for that event — including ones the next GameScene's create()
  // may have already registered if Phaser interleaves shutdown/create.
  private _onUiBuild?: (k: BuildKind, tk?: TowerKind) => void;
  private _onUiSell?: () => void;
  private _onUiSpeed?: (mult: number) => void;
  nextRunnerPack = 0;
  playerStoppedAt = 0;
  ghost!: Phaser.GameObjects.Sprite;
  deleteIcon!: Phaser.GameObjects.Graphics;
  gridOverlay!: Phaser.GameObjects.Graphics;

  spawnTimer = 0;
  spawnInterval = CFG.spawn.initialInterval;
  rampTimer = 0;
  heavyChance = CFG.spawn.heavyChanceStart;
  /** Wave-progression state machine — replaces the six legacy interlocking
   *  flags (waveStartAt, wave, waveSpawned, waveKills, waveBreakUntil,
   *  bossCountdownUntil). Read fields directly; mutate via the named
   *  transition methods. Constructed once and reset() per level. */
  waveState = new WaveState();
  pathsThisFrame = 0;     // BFS pathfinding budget per frame
  countdownMsg = '';
  countdownColor = '#7cc4ff';

  // Virtual / scalable game time so the "speed up" button affects all
  // cooldown / spawn logic, not just physics and animations.
  timeMult = 1.25;
  vTime = 0;

  selectedTower: Tower | null = null;
  selectionRing!: Phaser.GameObjects.Graphics;
  towerPanel!: Phaser.GameObjects.Container;
  towerPanelBounds = { x: 0, y: 0, w: 0, h: 0 };
  gapBlockers: Phaser.Physics.Arcade.StaticGroup | null = null;
  wallTilemap!: Phaser.Tilemaps.Tilemap;
  wallLayer!: Phaser.Tilemaps.TilemapLayer;
  sellTimers = new Map<Tower | Wall, { startTime: number; duration: number; gfx: Phaser.GameObjects.Graphics }>();

  /** Boss-fight state machine — primary/secondary boss refs, the
   *  bossSpawned latch, the castlePhase enum, and infinite-mode counters.
   *  Mutate via the named transitions on BossState. */
  bossState = new BossState();
  /** Per-level player upgrade counts. Reset in init(). Bonuses never
   *  carry across levels — purchases only affect the active run. */
  playerUpgrades = new PlayerUpgradeState();
  /** Captured after difficulty-driven HP overrides in create() so max-HP
   *  upgrades scale from the level's true base (e.g. 1 in oneHP mode). */
  playerBaseMaxHp = CFG.player.hp;
  warlockBolts!: Phaser.Physics.Arcade.Group;
  queenOrbs!: Phaser.Physics.Arcade.Group;
  dragonFireballs!: Phaser.Physics.Arcade.Group;
  nextQueenTeleport = 0;
  nextQueenOrb = 0;
  nextQueenAura = 0;
  nextDragonFireball = 0;

  killsTarget = CFG.winKills;
  /** End-of-level state — gameOver, dying, winDelayUntil, winCollectedAt.
   *  EndSystem reads/writes this; GameScene's update() short-circuits on
   *  endState.gameOver and endState.dying. */
  endState = new EndState();
  /** Per-run stat counters — populated by callsites throughout the
   *  systems and rendered on the infinite-mode death screen. */
  runStats = new RunStats();
  levelId = 1;
  difficulty: Difficulty = 'easy';
  // (Infinite-mode counters live on bossState now: infiniteBossesCleared,
  // infiniteResetUntil. They never reset within a run; the cycle reset
  // restarts wave state but leaves the cumulative count alone.)
  biome: Biome = 'grasslands';
  enemyHpMult = 1;
  enemySpeedMult = 1;
  // Per-enemy damage multiplier. Stays at 1 in campaign modes; infinite
  // mode compounds it 1.05× per boss cleared via EndSystem.
  enemyDmgMult = 1;
  levelRampFactor = CFG.spawn.rampFactor;
  levelMinInterval = CFG.spawn.minInterval;
  levelWaveSize = CFG.spawn.waveSize;
  levelClusterMax = 4;
  boulders: { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Sprite; sx: number; sy: number; tx: number; ty: number; totalDist: number; speed: number; dmg: number; splashRadius: number; born: number }[] = [];
  webs: { x: number; y: number; sprite: Phaser.GameObjects.Sprite; expireAt: number }[] = [];
  gasClouds: { x: number; y: number; sprites: Phaser.GameObjects.Arc[]; expireAt: number; dmgCd: number }[] = [];
  birdPoops: { sprite: Phaser.GameObjects.Image; expireAt: number; dmgCd: number }[] = [];
  treeSprites: Phaser.GameObjects.GameObject[] = [];
  treeChunksGenerated = new Set<string>();
  // Castle-only floor-spike obstacles. Same chunk-level deterministic
  // generator as trees, but spikes block enemy pathing while letting the
  // player walk through (with a slow + DOT applied in updatePlayer).
  spikeSprites: Phaser.GameObjects.GameObject[] = [];
  spikeChunksGenerated = new Set<string>();
  /** Real-time timestamp the player can next take spike damage. Throttled
   *  so a brief stumble onto a spike doesn't melt the HP bar. */
  private nextSpikeDmgAt = 0;
  riverChunksGenerated = new Set<string>();
  riverSquiggles: { sprite: Phaser.GameObjects.Image; age: number; life: number; dx: number; dy: number }[] = [];
  squiggleTimer = 0;
  treeSeed = 0;
  sf = 1; // native resolution scale factor
  /** Effective spawn/chunk radius in tiles. Always grown to cover the
   *  current camera's visible-corner distance plus a margin so enemies
   *  spawn comfortably off-screen even with camera-follow lerp lag. */
  spawnDist = CFG.spawnDist;
  /** Per-tile cache of "would placing a wall here strangle pathing?" Cleared
   *  whenever the grid changes (wall/tower placed/destroyed/sold) or the
   *  player moves to a new tile. Sweeping the cursor across already-hovered
   *  tiles is then free — only the first hover of each tile pays for BFS. */
  _wallCheckCache = new Map<string, boolean>();
  _lastWallCheckPlayerTile = '';
  _warmupFrames = 0;

  // Bow / nocked-arrow offsets relative to the player center, recomputed in
  // updatePlayer and re-applied in POST_UPDATE so the bow tracks the player's
  // post-physics-sync position (otherwise the body integrates in UPDATE,
  // sprite syncs in POST_UPDATE, and the bow renders one frame behind).
  _bowOffsetX = 10;
  _bowOffsetY = 2;
  _nockOffsetX = 25;
  _nockOffsetY = 2;

  constructor() { super('Game'); }

  init(data: any) {
    this.levelId = data?.levelId ?? 1;
    this.difficulty = data?.difficulty ?? 'easy';
    const levelDef = LEVELS.find(l => l.id === this.levelId);
    this.biome = levelDef?.biome ?? 'grasslands';

    // Reset mutable state for scene re-entry
    this.walls = [];
    this.towers = [];
    this.grid = createSparseGrid();
    this.gridVersion = 0;
    this.generatedChunks = new Set();
    this.chunkImages = new Map();
    this.pendingChunks = [];
    this.lastChunkCx = -9999;
    this.lastChunkCy = -9999;
    this.loadingDone = false;
    this.buildState.reset();
    this.nextRunnerPack = 0;
    this.playerStoppedAt = 0;
    this.spawnTimer = 0;
    this.spawnInterval = CFG.spawn.initialInterval;
    this.rampTimer = 0;
    this.heavyChance = CFG.spawn.heavyChanceStart;
    this.waveState.reset();
    this.timeMult = 1.25;
    this.vTime = 0;
    this.selectedTower = null;
    this.sellTimers = new Map();
    this.bossState.boss = null;
    this.bossState.bossSpawned = false;
    this.playerUpgrades.reset();
    // (waveState.reset() above also cleared bossCountdownUntil.)
    // Clear any persisted boss state from the previous run/level.
    getRegistry(this.game).set('bossActive', false);
    getRegistry(this.game).set('bossHp', 0);
    getRegistry(this.game).set('bossMaxHp', 0);
    getRegistry(this.game).set('bossBiome', undefined);
    getRegistry(this.game).set('gameEndState', undefined);
    this.killsTarget = CFG.winKills;
    this.endState.reset();
    this.runStats.reset();
    this.boulders = [];
    this.webs = [];
    this.gasClouds = [];
    this.birdPoops = [];
    this.treeSprites = [];
    this.treeChunksGenerated = new Set();
    this.spikeSprites = [];
    this.spikeChunksGenerated = new Set();
    this.nextSpikeDmgAt = 0;
    this.riverChunksGenerated = new Set();
    this.riverSquiggles = [];
    this.squiggleTimer = 0;
    this.treeSeed = Math.floor(Math.random() * 2147483647) || 1;
    // (EndSystem owns dying/winDelayUntil/winCollectedAt — fresh instance
    // each create() means no carry-over across level transitions.)
    this.bossState.castlePhase = 0;
    this.bossState.midBoss = null;
    this.bossState.midBossDefeated = false;
    this.bossState.infiniteBossesCleared = 0;
    this.bossState.infiniteResetUntil = 0;
    // (CoinSystem owns its own fx-pop pool now — fresh instance per
    // create() means no stale-sprite carryover across level transitions.)
    this.nextQueenTeleport = 0;
    this.nextQueenOrb = 0;
    this.nextQueenAura = 0;
    this.nextDragonFireball = 0;

    // Per-level spawn tuning (from level def, fall back to CFG defaults)
    this.levelRampFactor = levelDef?.rampFactor ?? CFG.spawn.rampFactor;
    this.levelMinInterval = levelDef?.minInterval ?? CFG.spawn.minInterval;
    this.levelWaveSize = levelDef?.waveSize ?? CFG.spawn.waveSize;
    this.levelClusterMax = levelDef?.clusterMax ?? 4;

    // Difficulty multipliers (don't mutate CFG). Harder modes get tougher
    // enemies, more of them, and faster spawn pacing — but the same
    // starting gold across all modes.
    this.enemySpeedMult = 1;
    this.enemyDmgMult = 1;
    let waveSizeMult = 1;
    let intervalMult = 1;
    switch (this.difficulty) {
      case 'medium':
        this.enemyHpMult = 1.3;
        waveSizeMult = 1.25;
        intervalMult = 0.85;
        break;
      case 'hard':
      case 'oneHP':
        this.enemyHpMult = 1.6;
        waveSizeMult = 1.5;
        intervalMult = 0.7;
        break;
      default:
        this.enemyHpMult = 1;
    }
    this.levelWaveSize = Math.round(this.levelWaveSize * waveSizeMult);
    this.levelMinInterval = Math.round(this.levelMinInterval * intervalMult);
  }

  preload() {
    // Tower-base textures consumed by generateAllArt() during create().
    // Loaded here (under "Generating world..." overlay) instead of in
    // BootScene so PLAY → level-select isn't gated on them. Phaser's
    // loader is idempotent on the texture key, so re-entering a level
    // is a no-op.
    if (!this.textures.exists('t_base_png')) this.load.image('t_base_png', towerBaseImg);
    if (!this.textures.exists('t_base_1_png')) this.load.image('t_base_1_png', arrowBase1Img);
    if (!this.textures.exists('t_base_2_png')) this.load.image('t_base_2_png', arrowBase2Img);
    if (!this.textures.exists('c_base_png')) this.load.image('c_base_png', cannonBaseImg);
    if (!this.textures.exists('c_base_1_png')) this.load.image('c_base_1_png', cannonBase1Img);
    if (!this.textures.exists('c_base_2_png')) this.load.image('c_base_2_png', cannonBase2Img);
    loadSpriteOverrides(this);
  }

  create() {
    this.events.on('shutdown', this.shutdown, this);

    // Generate art on first game start (deferred from boot for instant level select)
    generateAllArt(this);
    registerAnimations(this);
    applySpriteOverrides(this);
    reregisterSpriteOverrideAnimations(this);

    // Keep FIT mode — native resolution already matches viewport
    this.scale.scaleMode = Phaser.Scale.ScaleModes.FIT;
    this.scale.refresh();

    // Resume systems in case previous run ended while paused
    this.physics.resume();
    this.anims.resumeAll();

    // Infinite world — no physics bounds, no camera bounds
    this.physics.world.setBounds(-1e6, -1e6, 2e6, 2e6);
    this.physics.world.setBoundsCollision(false);

    // Systems — fresh instance per create(), so any per-system state (pools,
    // caches) starts clean on every level transition without explicit resets.
    this.coinSystem = new CoinSystem(this);
    this.pathing = new PathingSystem(this);
    this.depthSort = new DepthSortSystem(this);
    this.chunkSystem = new ChunkSystem(this);
    this.hud = new HudSystem(this);
    this.towerSelect = new TowerPanelSystem(this);
    this.build = new BuildSystem(this);
    this.sell = new SellSystem(this);
    this.combat = new CombatSystem(this);
    this.enemyBoss = new EnemyBossSystem(this);
    this.spawn = new SpawnSystem(this);
    this.end = new EndSystem(this);

    // groups
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: false });
    this.projectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: false });
    this.enemyDarts = this.physics.add.group({ runChildUpdate: false });
    this.toadGlobs = this.physics.add.group({ runChildUpdate: false });
    this.coins = this.physics.add.group({ classType: Coin, runChildUpdate: false });
    this.warlockBolts = this.physics.add.group({ runChildUpdate: false });
    this.queenOrbs = this.physics.add.group({ runChildUpdate: false });
    this.dragonFireballs = this.physics.add.group({ runChildUpdate: false });
    this.wallGroup = this.physics.add.staticGroup();
    this.towerGroup = this.physics.add.staticGroup();
    this.gapBlockers = this.physics.add.staticGroup();

    // Collision tilemap for player-wall collision (no seam issues unlike individual bodies)
    const mapSize = 400; // 400x400 tiles centered on origin
    this.wallTilemap = this.make.tilemap({
      tileWidth: CFG.tile, tileHeight: CFG.tile,
      width: mapSize, height: mapSize
    });
    // 1px transparent + 1px solid tileset (registered once at the global
    // texture manager — the canvas/texture survive scene shutdowns, so on
    // subsequent runs we just reuse the existing entry instead of warning).
    const tilesetKey = 'wall_collision_tileset';
    if (!this.textures.exists(tilesetKey)) {
      const canvas = document.createElement('canvas');
      canvas.width = CFG.tile * 2; canvas.height = CFG.tile;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(CFG.tile, 0, CFG.tile, CFG.tile); // tile index 1 = solid
      this.textures.addCanvas(tilesetKey, canvas);
    }
    const tileset = this.wallTilemap.addTilesetImage(tilesetKey, tilesetKey, CFG.tile, CFG.tile)!;
    this.wallLayer = this.wallTilemap.createBlankLayer('walls', tileset,
      -(mapSize / 2) * CFG.tile, -(mapSize / 2) * CFG.tile)!;
    this.wallLayer.setCollision(1);
    this.wallLayer.setVisible(false); // invisible — walls have their own sprites
    this.wallLayer.setDepth(-1);

    // Expand the canvas back to the full device viewport (LevelSelectScene
    // shrunk it to a 3:2 fit). On desktop this widens past 3:2; on mobile
    // it kills the letterbox.
    {
      const vp = computeViewport();
      // Tell UIScene to skip its one-time side effects (intro toasts) on
      // its first create — that initial pass runs against the old
      // LevelSelect gameSize and is about to be restarted at the right
      // size on the next tick.
      getRegistry(this.game).set('uiBootingForResize', true);
      this.scale.setGameSize(vp.renderW, vp.renderH);
      this.scale.refresh();
      this.time.delayedCall(0, () => {
        getRegistry(this.game).set('uiBootingForResize', false);
        const ui = this.scene.get('UI');
        if (ui?.scene.isActive()) ui.scene.restart();
      });
    }

    // player — starts at origin, camera follows
    this.player = new Player(this, 0, 0);
    this.sf = getRegistry(this.game).get('sf') || 1;
    const cameraZoom = getRegistry(this.game).get('cameraZoom') ?? this.sf;
    this.cameras.main.setZoom(cameraZoom);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // Viewport-aware spawn radius. Desktop keeps CFG.spawnDist exactly (hard
    // requirement). On mobile the view aspect differs from 3:2, so the corner
    // distance can exceed 18 tiles (notably in portrait) — grow to cover it.
    this.spawn.recomputeSpawnDist();

    // React to rotation / window resize: resize the canvas to the new device
    // viewport, pull the new camera zoom out of the registry, and grow chunk/
    // spawn radius to match. World state (player, towers, enemies) stays
    // untouched.
    const onViewportChanged = () => {
      const vp = computeViewport();
      this.scale.setGameSize(vp.renderW, vp.renderH);
      this.scale.refresh();
      this.cameras.main.setZoom(vp.cameraZoom);
      this.spawn.recomputeSpawnDist();
      // Force chunk regeneration around player at the new view radius.
      this.lastChunkCx = -9999;
      this.lastChunkCy = -9999;
    };
    getEvents(this.game.events).on('viewport-changed', onViewportChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      getEvents(this.game.events).off('viewport-changed', onViewportChanged);
    });

    // Apply difficulty adjustments. Starting gold is now uniform across all
    // modes (CFG.startMoney); harder modes are tuned via wave size + spawn
    // pacing in init() instead.
    if (this.difficulty === 'oneHP') {
      this.player.hp = 1;
      this.player.maxHp = 1;
    }
    this.playerBaseMaxHp = this.player.maxHp;

    // Generate all initial ground chunks before the game starts (no time limit)
    this.chunkSystem.generateChunksAround(0, 0);
    this.chunkSystem.processChunkQueue(0);

    // Place trees in the initial chunks around spawn
    if (this.biome === 'forest' || this.biome === 'infected') {
      this.generatedChunks.forEach(key => {
        const [cx, cy] = key.split(',').map(Number);
        this.chunkSystem.placeTreesInChunk(cx, cy);
      });
    }
    // Castle gets floor spikes — same deterministic chunk generator.
    if (this.biome === 'castle') {
      this.generatedChunks.forEach(key => {
        const [cx, cy] = key.split(',').map(Number);
        this.chunkSystem.placeSpikesInChunk(cx, cy);
      });
    }

    // collisions — player uses tilemap layer for walls (no seams) + wallGroup for tree blockers
    this.physics.add.collider(this.player, this.wallLayer);
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.player, this.towerGroup);
    this.physics.add.collider(this.player, this.gapBlockers);
    this.physics.add.collider(this.enemies, this.wallGroup, (e, w) => this.enemyBoss.enemyHitsWall(e as Enemy, w as Wall), (_e, _w) => !((_e as Enemy).flying));
    this.physics.add.collider(this.enemies, this.towerGroup, (e, t) => this.enemyBoss.enemyHitsTower(e as Enemy, t as Tower), (_e, _t) => !((_e as Enemy).flying));
    // Big-body enemies (currently just golems) push each other apart so their
    // sprites don't overlap. Add more kinds to the filter to extend.
    this.physics.add.collider(this.enemies, this.enemies, undefined, (a, b) => (a as Enemy).kind === 'golem' && (b as Enemy).kind === 'golem');
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.enemyBoss.enemyHitsPlayer(e as Enemy));
    this.physics.add.overlap(this.projectiles, this.enemies, (pr, en) => this.combat.projectileHitsEnemy(pr as Projectile, en as Enemy));
    this.physics.add.overlap(this.player, this.enemyDarts, (_p, d) => this.enemyBoss.enemyDartHitsPlayer(d as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.enemyDarts, this.wallGroup, (_d, _w) => { (_d as Phaser.Physics.Arcade.Sprite).destroy(); });
    this.physics.add.overlap(this.enemyDarts, this.towerGroup, (_d, _t) => { (_d as Phaser.Physics.Arcade.Sprite).destroy(); });
    // Toad globs hit the player (they arc over walls/towers — no wall/tower overlap)
    this.physics.add.overlap(this.player, this.toadGlobs, (_p, g) => this.enemyBoss.toadGlobHitsPlayer(g as Phaser.Physics.Arcade.Sprite));
    // Castle warlock bolts, queen orbs, dragon fireballs
    this.physics.add.overlap(this.player, this.warlockBolts, (_p, b) => this.enemyBoss.castleBoltHitsPlayer(b as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.warlockBolts, this.wallGroup, (_b, _w) => { (_b as Phaser.Physics.Arcade.Sprite).destroy(); });
    this.physics.add.overlap(this.player, this.queenOrbs, (_p, o) => this.enemyBoss.castleBoltHitsPlayer(o as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.dragonFireballs, (_p, f) => this.enemyBoss.dragonFireballHitsPlayer(f as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.dragonFireballs, this.wallGroup, (_f, _w) => this.enemyBoss.dragonFireballExplode(_f as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.dragonFireballs, this.towerGroup, (_f, _t) => this.enemyBoss.dragonFireballExplode(_f as Phaser.Physics.Arcade.Sprite));
    // boss overlaps set up when boss spawns (since it's created later)

    // input
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,FOUR,X,ESC');
    this.input.keyboard!.on('keydown-ONE', () => {
      const ts = getRegistry(this.game).get('tutorialStep');
      if (ts && ts !== 'game_press_1' && ts !== 'game_place_tower') return;
      this.build.toggleBuild('tower', 'arrow');
    });
    this.input.keyboard!.on('keydown-TWO', () => {
      if (getRegistry(this.game).get('tutorialStep')) return; // blocked during tutorial
      // Cannon is locked on the meadow level (intro). Unlocked from forest on.
      if (this.biome === 'grasslands') return;
      this.build.toggleBuild('tower', 'cannon');
    });
    // Key 3 reserved for mage tower (not yet implemented)
    this.input.keyboard!.on('keydown-FOUR', () => {
      const ts = getRegistry(this.game).get('tutorialStep');
      if (ts && ts !== 'game_press_4' && ts !== 'game_place_walls') return;
      this.build.toggleBuild('wall');
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.selectedTower) this.towerSelect.deselectTower();
      else this.build.setBuild('none');
    });
    // 'B' is a dedicated build-cancel key — handy while wall-building since
    // the wall hotkey is '4' (not adjacent to ESC). No-ops outside of
    // build mode so it won't fight other bindings.
    this.input.keyboard!.on('keydown-B', () => {
      if (this.buildState.kind !== 'none') this.build.setBuild('none');
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.build.handleClick(p));
    this.input.mouse!.disableContextMenu();

    // build ghost
    this.ghost = this.add.sprite(0, 0, 'wall').setAlpha(0.5).setDepth(800).setVisible(false).setOrigin(0.5).setScale(0.5);

    // Red X overlay shown in wall build mode when the cursor is on an
    // existing wall — hint that clicking will start the sell countdown.
    this.deleteIcon = this.add.graphics().setDepth(801).setVisible(false);
    const dr = CFG.tile * 0.32;
    this.deleteIcon.lineStyle(4, 0x000000, 0.6);
    this.deleteIcon.lineBetween(-dr, -dr, dr, dr);
    this.deleteIcon.lineBetween(-dr, dr, dr, -dr);
    this.deleteIcon.lineStyle(2.5, 0xff4040, 1);
    this.deleteIcon.lineBetween(-dr, -dr, dr, dr);
    this.deleteIcon.lineBetween(-dr, dr, dr, -dr);

    // grid overlay (redrawn each frame while building)
    this.gridOverlay = this.add.graphics().setDepth(799).setVisible(false);

    // selection ring (tower range visualizer)
    this.selectionRing = this.add.graphics().setDepth(798).setVisible(false);

    // tower upgrade panel (built once, positioned/shown on selection)
    this.towerPanel = this.add.container(0, 0).setDepth(900).setVisible(false);

    // events from UI
    getEvents(this.events).emit('hud', this.hudState());
    // Defensive: drop any leftover listeners from a previous run before
    // registering ours. The old shutdown path doesn't always fire in time
    // (e.g. on win the panel→stop happens synchronously inside an input
    // handler and Phaser can interleave the create of the next run before
    // the previous shutdown), which would leave us with two listeners both
    // toggling buildKind on the same singleton scene instance — they cancel
    // each other and the build menu never opens.
    getEvents(this.game.events).off('ui-build');
    getEvents(this.game.events).off('ui-sell');
    getEvents(this.game.events).off('ui-speed');
    this._onUiBuild = (k: BuildKind, tk?: TowerKind) => {
      const ts = getRegistry(this.game).get('tutorialStep');
      if (ts) {
        if (ts === 'game_press_1' && k === 'tower' && tk === 'arrow') { /* allowed */ }
        // Tutorial caps placements at 3 walls — once 3 are down, don't let
        // the player re-enter wall build mode and click into a dead state.
        else if ((ts === 'game_press_4' || ts === 'game_place_walls') && k === 'wall' && this.walls.length < 3) { /* allowed */ }
        // Tutorial caps placements at 1 arrow tower — once placed, don't let
        // the player re-enter tower build mode and try to place another.
        else if (ts === 'game_place_tower' && k === 'tower' && tk === 'arrow' && this.towers.length === 0) { /* allowed */ }
        // Mobile has no right-click / ESC, so tapping the (already-active)
        // wall slot is the only way to exit build mode during this step.
        // Only permit it when wall mode is currently on (i.e. the toggle
        // turns it OFF) so the player can't re-enter wall mode after exit.
        else if (ts === 'game_exit_build' && k === 'wall' && this.buildState.kind === 'wall') { /* allowed — toggles off */ }
        else return; // block everything else during tutorial
      }
      this.build.toggleBuild(k, tk);
    };
    this._onUiSell = () => this.build.setBuild('none');
    this._onUiSpeed = (mult: number) => this.setTimeScale(mult);
    getEvents(this.game.events).on('ui-build', this._onUiBuild);
    getEvents(this.game.events).on('ui-sell', this._onUiSell);
    getEvents(this.game.events).on('ui-speed', this._onUiSpeed);

    // Apply default game speed (1.25x base)
    this.setTimeScale(this.timeMult);

    // initial UI update
    getEvents(this.scene.get('UI').events).emit('hud', this.hudState());

    // pre-wave build phase
    this.waveState.startInitialBuildPhase(CFG.spawn.startDelay);
    this.countdownMsg = '';
    this.countdownColor = '#7cc4ff';

    // Biome atmosphere effects
    if (this.biome === 'forest') {
      // Firefly particles
      const fireflyEmitter = this.add.particles(0, 0, 'firefly', {
        follow: this.player,
        lifespan: 4000,
        speed: { min: 3, max: 15 },
        scale: { start: 0.4, end: 0.1 },
        alpha: { start: 0.7, end: 0 },
        frequency: 250,
        blendMode: 'ADD'
      });
      fireflyEmitter.setDepth(15);
      fireflyEmitter.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(-400, -300, 800, 600) } as any);

      // removed vignette — was too distracting
    }

    if (this.biome === 'infected') {
      // Purple infection spores — dense, drifting slowly, fade in then out
      const sporeEmitter = this.add.particles(0, 0, 'infection_spore', {
        follow: this.player,
        lifespan: 6000,
        speed: { min: 2, max: 14 },
        scale: { start: 0.6, end: 0.15 },
        alpha: { values: [0, 0.85, 0.85, 0] },
        frequency: 60,
        blendMode: 'ADD'
      });
      sporeEmitter.setDepth(15);
      sporeEmitter.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(-500, -400, 1000, 800) } as any);

      // Green infection spores — medium density, slightly faster
      const sporeGreenEmitter = this.add.particles(0, 0, 'infection_spore_green', {
        follow: this.player,
        lifespan: 5000,
        speed: { min: 3, max: 20 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { values: [0, 0.7, 0.7, 0] },
        frequency: 100,
        blendMode: 'ADD'
      });
      sporeGreenEmitter.setDepth(15);
      sporeGreenEmitter.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(-500, -400, 1000, 800) } as any);
    }

    // Warm-up phase: pause physics and run several real frames so the browser
    // JIT-compiles the update loop and uploads textures to the GPU. The loading
    // overlay stays visible until we're done, then the game starts stutter-free.
    this.loadingDone = false;
    this.physics.pause();
    this._warmupFrames = 0;

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this._syncBowToPlayer);
  }

  hudState() {
    return {
      name: 'Ranger',
      hp: this.player?.hp ?? CFG.player.hp,
      maxHp: this.player?.maxHp ?? CFG.player.hp,
      money: this.player?.money ?? 0,
      kills: this.player?.kills ?? 0,
      target: this.killsTarget,
      build: this.buildState.kind === 'tower' ? this.buildState.towerKind : this.buildState.kind,
      bossSpawned: this.bossState.bossSpawned,
      wave: this.waveState.wave + 1,
      waveKills: this.waveState.waveKills,
      waveSize: this.levelWaveSize,
      waveBreakUntil: this.waveState.waveBreakUntil,
      vTime: this.vTime,
      countdownMsg: this.countdownMsg,
      countdownColor: this.countdownColor,
      castlePhase: this.bossState.castlePhase,
      midBossDefeated: this.bossState.midBossDefeated,
    };
  }

  // Systems — owned by GameScene, instantiated in create(). Each system
  // takes (scene: GameScene) and reads/writes scene state directly during
  // the Phase 1 split; further decoupling happens in later phases.
  coinSystem!: CoinSystem;
  pathing!: PathingSystem;
  depthSort!: DepthSortSystem;
  chunkSystem!: ChunkSystem;
  hud!: HudSystem;
  towerSelect!: TowerPanelSystem;
  build!: BuildSystem;
  sell!: SellSystem;
  combat!: CombatSystem;
  enemyBoss!: EnemyBossSystem;
  spawn!: SpawnSystem;
  end!: EndSystem;

  setTimeScale(mult: number) {
    this.timeMult = mult;
    // Phaser's physics.world.timeScale is inverted: lower = faster.
    this.physics.world.timeScale = 1 / mult;
    this.anims.globalTimeScale = mult;
    this.tweens.timeScale = mult;
    this.time.timeScale = mult;
  }




  update(_realTime: number, delta: number) {
    if (this.endState.gameOver) return;

    // Warm-up: let a few render frames pass (physics paused, loading overlay visible)
    // so the browser JIT-compiles and GPU uploads textures before gameplay starts.
    if (!this.loadingDone) {
      this._warmupFrames++;
      if (this._warmupFrames >= 10) {
        this.loadingDone = true;
        this.physics.resume();
        this.hud.pushHud();
        getEvents(this.game.events).emit('game-ready');
        // Pick the biome's BGM. Falls through to 'castle' for any biome
        // that doesn't yet have its own track.
        const bgmKey = (['grasslands', 'forest', 'infected', 'river', 'castle'] as const)
          .includes(this.biome as any) ? this.biome : 'castle';
        SFX.playBgm(bgmKey);
      }
      return;
    }

    // Ghost follow pointer (runs even while build-paused)
    this.build.updateGhost();

    // Generate ground chunks around player as they move (4ms budget per frame)
    this.chunkSystem.generateChunksAround(this.player.x, this.player.y);
    this.chunkSystem.processChunkQueue(4);

    // River squiggle animation
    if (this.biome === 'river') this.chunkSystem.updateRiverSquiggles(delta);

    // Redraw grid overlay around the camera if building
    if (this.buildState.kind !== 'none') this.build.redrawGridOverlay();

    // When build-paused, only update ghost/grid — skip all game simulation
    if (this.buildState.paused) return;

    // Virtual time advances at timeMult speed; all downstream systems use it.
    const vd = delta * this.timeMult;
    this.vTime += vd;
    const time = this.vTime;

    // While dying, keep the world alive for the death animation but skip player input
    if (this.endState.dying) return;

    this.pathsThisFrame = 0;
    this.updatePlayer(time, vd);
    this.combat.updateTowers(time);
    this.enemyBoss.updateEnemies(time, vd);
    this.enemyBoss.updateBoss(time);
    this.enemyBoss.updateGasClouds(time);
    this.enemyBoss.updateBirdPoops(time);
    this.combat.updateProjectiles(time);
    this.enemyBoss.updateEnemyDarts();
    this.enemyBoss.updateToadGlobs();
    this.enemyBoss.updateBoulders(time);
    this.enemyBoss.updateCastleProjectiles();
    this.coinSystem.update(vd);
    this.spawn.updateSpawning(time, vd);
    this.depthSort.update();
    this.sell.updateSellTimers();
    this.end.checkEndConditions();
  }

  // ---------- PLAYER ----------
  updatePlayer(time: number, _delta: number) {
    // Physics-paused covers tutorial step prompts and the upgrade panel.
    // Returning here freezes facing, animation, and the auto-fire loop so
    // the world feels actually paused rather than just no-movement.
    if (this.physics.world.isPaused) return;
    const k = this.keys;
    let vx = 0, vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;

    // Mobile virtual joystick contribution. UIScene publishes the current
    // stick vector to the registry every frame. A generous deadzone (0.3
    // magnitude) ignores thumb rest / jitter; outside the deadzone the input
    // snaps to a unit vector so movement is binary (full speed, no analog).
    const jx = (getRegistry(this.game).get('joystickX') as number) || 0;
    const jy = (getRegistry(this.game).get('joystickY') as number) || 0;
    const jmag2 = jx * jx + jy * jy;
    const JOYSTICK_DEADZONE_SQ = 0.3 * 0.3;
    if (jmag2 >= JOYSTICK_DEADZONE_SQ) {
      const jmag = Math.sqrt(jmag2);
      vx += jx / jmag;
      vy += jy / jmag;
    }

    // Castle floor spikes — when the player's tile is a spike (grid value
    // 6), halve their move speed and tick contact damage every 500ms.
    const playerTx = Math.floor(this.player.x / CFG.tile);
    const playerTy = Math.floor(this.player.y / CFG.tile);
    const onSpike = gridGet(this.grid, playerTx, playerTy) === 6;
    if (onSpike) {
      if (time >= this.nextSpikeDmgAt) {
        this.nextSpikeDmgAt = time + 500;
        this.player.hurt(5, this);
        this.hud.pushHud();
        if (this.player.hp <= 0) this.end.lose();
      }
    } else {
      // Reset cooldown the moment they step off — re-entering should bite
      // immediately, not wait for a stale timer.
      this.nextSpikeDmgAt = 0;
    }
    const speedMult = onSpike ? 0.5 : 1;

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      const runMult = this.playerUpgrades.multiplier('runSpeed');
      this.player.setVelocity(vx * CFG.player.speed * speedMult * runMult, vy * CFG.player.speed * speedMult * runMult);
      if (vx !== 0) this.player.facingRight = vx > 0;
      this.player.setFlipX(!this.player.facingRight);
      if (this.player.anims.currentAnim?.key !== 'player-move') this.player.play('player-move');
    } else {
      this.player.setVelocity(0, 0);
      if (
        this.player.anims.currentAnim?.key !== 'player-idle'
      ) this.player.play('player-idle');
    }

    // Tutorial leash: keep tower visible on screen
    if (getRegistry(this.game).get('tutorialActive') && this.towers.length > 0) {
      const anchor = this.towers[0];
      const cam = this.cameras.main;
      const margin = 40; // keep tower at least this far from screen edge
      const maxDx = (cam.width / 2) - margin;
      const maxDy = (cam.height / 2) - margin;
      // Clamp player position so the tower stays within the viewport
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      let clamped = false;
      if (this.player.x > anchor.x + maxDx) { this.player.x = anchor.x + maxDx; clamped = true; }
      if (this.player.x < anchor.x - maxDx) { this.player.x = anchor.x - maxDx; clamped = true; }
      if (this.player.y > anchor.y + maxDy) { this.player.y = anchor.y + maxDy; clamped = true; }
      if (this.player.y < anchor.y - maxDy) { this.player.y = anchor.y - maxDy; clamped = true; }
      if (clamped) {
        // Zero out velocity on clamped axes
        if (this.player.x === anchor.x + maxDx || this.player.x === anchor.x - maxDx) body.velocity.x = 0;
        if (this.player.y === anchor.y + maxDy || this.player.y === anchor.y - maxDy) body.velocity.y = 0;
      }
    }

    // Bow follows player with offset based on aim direction
    const bow = this.player.bow;
    const nock = this.player.nockedArrow;

    // Find most threatening enemy — prioritizes shortest path distance, not euclidean
    const target = this.combat.findMostThreateningEnemy(this.player.x, this.player.y, CFG.player.range * this.playerUpgrades.multiplier('atkRange'));

    if (target) {
      // Aim bow at target
      const aimAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
      bow.setRotation(aimAngle);
      bow.setFlipY(Math.abs(aimAngle) > Math.PI / 2);

      // Push bow outward from body center along the aim direction
      // More offset when aiming horizontally, less when vertical
      const horizFactor = Math.abs(Math.cos(aimAngle)); // 1 at sides, 0 at top/bottom
      const offset = 6 + horizFactor * 5; // 6px minimum, up to 11px at the sides
      this._bowOffsetX = Math.cos(aimAngle) * offset;
      this._bowOffsetY = 2 + Math.sin(aimAngle) * offset;
      bow.setPosition(this.player.x + this._bowOffsetX, this.player.y + this._bowOffsetY);

      // Flip player body to face target
      this.player.setFlipX(target.x < this.player.x);
      if (target.x >= this.player.x) this.player.facingRight = true;
      else this.player.facingRight = false;

      // Fire rate: half speed while moving, full speed after standing still for 400ms
      if (moving) {
        this.playerStoppedAt = 0;
      } else if (this.playerStoppedAt === 0) {
        this.playerStoppedAt = time;
      }
      const stoodLongEnough = !moving && this.playerStoppedAt > 0 && (time - this.playerStoppedAt) >= 400;
      const rate = (stoodLongEnough ? CFG.player.fireRate : CFG.player.fireRate * 2) / this.playerUpgrades.multiplier('atkSpeed');
      if (time > this.player.lastShot + rate) {
        this.player.lastShot = time;
        SFX.play('arrowShoot');
        bow.play('bow-shoot', true);
        nock.setVisible(false);
        bow.once('animationcomplete-bow-shoot', () => {
          bow.play('bow-idle');
          nock.setVisible(true);
        });
        // Lead the target
        let aimX = target.x, aimY = target.y;
        if (target.body) {
          const dist = Math.hypot(target.x - this.player.x, target.y - this.player.y) || 1;
          const travelTime = dist / CFG.player.projectileSpeed;
          const tb = target.body as Phaser.Physics.Arcade.Body;
          aimX = target.x + tb.velocity.x * travelTime;
          aimY = target.y + tb.velocity.y * travelTime;
        }
        // Spawn the projectile at the nocked-arrow position so it emanates from the bow
        const spawnX = bow.x + Math.cos(bow.rotation) * 15;
        const spawnY = bow.y + Math.sin(bow.rotation) * 15;
        this.combat.spawnProjectile(spawnX, spawnY, aimX, aimY, CFG.player.projectileSpeed, CFG.player.damage * this.playerUpgrades.multiplier('atkPower'), 0, 0.5, 0, target);
      }
    } else {
      // No target — bow points in the direction the player faces, held out to the side
      const idleDir = this.player.facingRight ? 1 : -1;
      bow.setRotation(this.player.facingRight ? 0 : Math.PI);
      bow.setFlipY(!this.player.facingRight);
      this._bowOffsetX = idleDir * 10;
      this._bowOffsetY = 2;
      bow.setPosition(this.player.x + this._bowOffsetX, this.player.y + this._bowOffsetY);
    }

    // Nocked arrow rides with the bow — fletching tip sits on the bowstring.
    // Offset = (bowstring_x - bow_origin_x) + (arrow_center_x - arrow_back_x) = 1 + 14 = 15 world px.
    this._nockOffsetX = this._bowOffsetX + Math.cos(bow.rotation) * 15;
    this._nockOffsetY = this._bowOffsetY + Math.sin(bow.rotation) * 15;
    nock.setPosition(this.player.x + this._nockOffsetX, this.player.y + this._nockOffsetY);
    nock.setRotation(bow.rotation);
  }

  /** Re-apply bow + nock positions after arcade physics has synced the player
   *  sprite from its body in POST_UPDATE. Otherwise the bow renders at the
   *  pre-sync (last frame) player position and visibly lags during movement. */
  private _syncBowToPlayer = () => {
    const p = this.player;
    if (!p || !p.bow) return;
    p.bow.setPosition(p.x + this._bowOffsetX, p.y + this._bowOffsetY);
    p.nockedArrow.setPosition(p.x + this._nockOffsetX, p.y + this._nockOffsetY);
  };





  shutdown() {
    SFX.stopBgm();
    if (this._onUiBuild) getEvents(this.game.events).off('ui-build', this._onUiBuild);
    if (this._onUiSell) getEvents(this.game.events).off('ui-sell', this._onUiSell);
    if (this._onUiSpeed) getEvents(this.game.events).off('ui-speed', this._onUiSpeed);
    this._onUiBuild = undefined;
    this._onUiSell = undefined;
    this._onUiSpeed = undefined;
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this._syncBowToPlayer);
  }
}
