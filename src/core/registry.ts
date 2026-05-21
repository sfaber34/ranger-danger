import type { Biome } from '../levels';
import type { RunStatsSnapshot } from '../state/RunStats';

/**
 * Payload of the `game-end` event AND of the `gameEndState` registry key.
 * Stored in registry so a UIScene restart (e.g. mid-rotation) can recover
 * the win/lose modal even if the live event fired while UI had no listener.
 */
export type GameEndState = {
  win: boolean;
  name: string;
  kills: number;
  money: number;
  runStats?: RunStatsSnapshot;
};

/**
 * The single source of truth for every key written to / read from
 * `game.registry`. New keys land here first; runtime call sites should go
 * through `getRegistry(game)` so TypeScript catches typos and wrong types.
 */
export interface RegistrySchema {
  // ---- Viewport (set by main.ts viewport listener) ----
  /** Combined sf scale factor (camera zoom on desktop, uiScale on mobile). */
  sf: number;
  /** Camera zoom (computeViewport().cameraZoom). */
  cameraZoom: number;
  /** UI scale factor (computeViewport().uiScale). */
  uiScale: number;
  /** True for touch-first devices (computeViewport().isMobile). */
  isMobile: boolean;

  // ---- UI restart coordination ----
  /** Set true while GameScene is mid-resize so UIScene's first create()
   *  skips one-time intro toasts (they'd fire against the wrong layout). */
  uiBootingForResize: boolean;
  /** Last-selected speed slot — persisted so a UIScene restart preserves it. */
  uiSpeedIdx: number;

  // ---- Mobile virtual joystick state, published by UIScene per-frame ----
  joystickX: number;
  joystickY: number;
  joystickBounds: { x: number; y: number; w: number; h: number } | undefined;

  // ---- Boss bar ----
  // UIScene reads these on restart to recreate the boss bar mid-fight,
  // since the live `boss-spawn` / `boss-hp` events are one-shot.
  bossActive: boolean;
  bossBiome: Biome | undefined;
  bossHp: number;
  bossMaxHp: number;

  // ---- Tutorial flags ----
  tutorialActive: boolean;
  tutorialStep: string | null;

  // ---- Win/lose modal ----
  /** Persisted so a UIScene restart can recover the panel. */
  gameEndState: GameEndState | undefined;
}

/**
 * Typed wrapper around `Phaser.Data.DataManager` (`game.registry`). Shares
 * the same store as `game.registry.get/set`, just with TypeScript checking
 * the key + value shape against `RegistrySchema`.
 */
export class TypedRegistry {
  constructor(private dm: Phaser.Data.DataManager) {}

  get<K extends keyof RegistrySchema>(key: K): RegistrySchema[K] {
    return this.dm.get(key as string);
  }

  set<K extends keyof RegistrySchema>(key: K, value: RegistrySchema[K]): this {
    this.dm.set(key as string, value);
    return this;
  }
}

const registryCache = new WeakMap<Phaser.Game, TypedRegistry>();

/** Get (or lazily create) the typed registry wrapper for this game. */
export function getRegistry(game: Phaser.Game): TypedRegistry {
  let reg = registryCache.get(game);
  if (!reg) {
    reg = new TypedRegistry(game.registry);
    registryCache.set(game, reg);
  }
  return reg;
}
