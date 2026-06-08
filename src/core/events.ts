import type Phaser from 'phaser';
import type { ViewportInfo } from '../viewport';
import type { Biome } from '../levels';
import type { BuildKind } from '../state/BuildState';
import type { TowerKind } from '../entities/Tower';
import type { GameEndState } from './registry';

/** Payload of the `hud` event — assembled by GameScene.hudState(). */
export type HudState = {
  name: string;
  hp: number;
  maxHp: number;
  money: number;
  kills: number;
  target: number;
  build: BuildKind | TowerKind;
  bossSpawned: boolean;
  wave: number;
  waveKills: number;
  waveSize: number;
  waveBreakUntil: number;
  bossCountdownUntil: number;
  vTime: number;
  countdownMsg: string;
  countdownColor: string;
  castlePhase: number;
  midBossDefeated: boolean;
};

export type BossSpawnPayload = {
  hp: number;
  maxHp: number;
  biome: Biome;
  /** 'queen' | 'dragon' | undefined for non-castle bosses. */
  bossKind?: string;
};

export type BossHpPayload = { hp: number; maxHp: number };

/**
 * Every cross-scene event flows through this map. Tuple values describe the
 * `emit` arg list — `[]` means a no-payload event (`emit('foo')`), single
 * elements like `[string]` mean one arg, and named tuple elements
 * (`[active: boolean, kind: BuildKind]`) read better at the call site
 * without changing the runtime shape.
 *
 * New events land here first so TypeScript catches name typos and payload
 * mismatches at compile time.
 */
export interface EventMap {
  // HUD / render
  hud: [HudState];
  'viewport-changed': [ViewportInfo];
  'build-error': [string];
  'build-mode': [active: boolean, kind: BuildKind, towerKind?: TowerKind];

  // Game flow
  'game-ready': [];
  'game-end': [GameEndState];
  'boss-spawn': [BossSpawnPayload];
  'boss-hp': [BossHpPayload];
  'boss-died': [];

  // UI commands (UIScene → GameScene)
  'ui-build': [kind: BuildKind, towerKind?: TowerKind];
  'ui-sell': [];
  'ui-speed': [number];
  'ui-pause': [];
  'ui-resume': [];

  // Tutorial
  'tutorial-level-clicked': [number];
  'tutorial-diff-clicked': [string];
  'tutorial-kill': [];
  'tutorial-tower-placed': [];
  'tutorial-wall-placed': [];
  'tutorial-coin-collected': [];
  'tutorial-tower-selected': [];
  'tutorial-tower-upgraded': [];
  'tutorial-tower-deselected': [];
  'tutorial-speed-unlocked': [];
  'tutorial-finished': [];
}

/**
 * Typed wrapper around any `Phaser.Events.EventEmitter` — game.events,
 * scene.events, scale.events, etc. Wraps the same emitter, just adds
 * TypeScript checking against `EventMap`.
 */
export class TypedEvents {
  constructor(private em: Phaser.Events.EventEmitter) {}

  emit<K extends keyof EventMap>(name: K, ...args: EventMap[K]): boolean {
    return this.em.emit(name as string, ...args);
  }

  on<K extends keyof EventMap>(name: K, fn: (...args: EventMap[K]) => void, ctx?: any): this {
    this.em.on(name as string, fn as (...args: any[]) => void, ctx);
    return this;
  }

  once<K extends keyof EventMap>(name: K, fn: (...args: EventMap[K]) => void, ctx?: any): this {
    this.em.once(name as string, fn as (...args: any[]) => void, ctx);
    return this;
  }

  /**
   * If `fn` is omitted, removes ALL listeners for the event — same
   * semantics as `Phaser.Events.EventEmitter.off(event)`.
   */
  off<K extends keyof EventMap>(
    name: K,
    fn?: (...args: EventMap[K]) => void,
    ctx?: any,
    once?: boolean,
  ): this {
    if (fn) this.em.off(name as string, fn as (...args: any[]) => void, ctx, once);
    else this.em.off(name as string);
    return this;
  }
}

const eventsCache = new WeakMap<Phaser.Events.EventEmitter, TypedEvents>();

/** Get (or lazily create) the typed wrapper for this emitter. */
export function getEvents(emitter: Phaser.Events.EventEmitter): TypedEvents {
  let typed = eventsCache.get(emitter);
  if (!typed) {
    typed = new TypedEvents(emitter);
    eventsCache.set(emitter, typed);
  }
  return typed;
}
