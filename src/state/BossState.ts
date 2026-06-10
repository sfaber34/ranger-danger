import type { Boss } from '../entities/Boss';

/**
 * Castle level has four phases:
 *   0 — waves 1 + 2 leading up to the Phantom Queen
 *   1 — Queen mid-boss fight
 *   2 — waves 3 + 4 leading up to the Castle Dragon
 *   3 — Dragon final-boss fight
 *
 * Other biomes ignore this field (it stays at 0).
 */
export type CastlePhase = 0 | 1 | 2 | 3;
export type DesertPhase = 0 | 1 | 2 | 3;

/**
 * Boss-fight state. Replaces the seven scattered fields that used to live
 * on GameScene: boss, midBoss (castle queen + endless secondary), the
 * `bossSpawned` latch, the `midBossDefeated` latch (castle queen death),
 * the castlePhase counter, and the two endless-mode counters
 * (endlessBossesCleared, endlessResetUntil).
 */
export class BossState {
  /** Primary boss, or null when no boss is on the field. */
  boss: Boss | null = null;

  /**
   * Secondary boss in either the castle (queen, while phase 1) or in
   * endless mode's double-boss events (slot 1). Aliases `boss` while the
   * castle queen is alive; null otherwise.
   */
  midBoss: Boss | null = null;

  /** True from spawn-boss event until win/lose. The wave system uses this
   *  to suppress wave logic while a boss is on the field. */
  bossSpawned = false;

  /** True once the castle queen has died — phase advancement gate. */
  midBossDefeated = false;

  /** Castle phase 0–3 (see CastlePhase). 0 outside castle. */
  castlePhase: CastlePhase = 0;

  /** Desert phase 0–3: first waves, mid-boss, second waves, final boss. */
  desertPhase: DesertPhase = 0;

  /** Cumulative count of bosses defeated in endless mode. */
  endlessBossesCleared = 0;

  /** vTime at which the next endless cycle should kick off (set when a
   *  boss dies in endless mode). 0 = unset. */
  endlessResetUntil = 0;

  // ---------- transitions ----------

  /** Mid-boss (castle queen) defeated — flip the latch and advance phase. */
  recordMidBossDefeated() {
    this.midBossDefeated = true;
  }

  /** Castle phase advancement: queen has died, walk into post-queen waves. */
  enterPostQueenWaves() {
    this.castlePhase = 2;
    this.bossSpawned = false;
    this.boss = null;
    // midBoss stays as the queen reference even after death — the EnemyBoss
    // system reads it during the death animation. Cleared by reset() on
    // level transition.
  }

  /** Castle queen spawn. Sets midBoss alias and phase 1. */
  enterQueenFight(b: Boss) {
    this.boss = b;
    this.midBoss = b;
    this.bossSpawned = true;
    this.castlePhase = 1;
  }

  /** Castle dragon spawn — final phase. */
  enterDragonFight(b: Boss) {
    this.boss = b;
    this.bossSpawned = true;
    this.castlePhase = 3;
  }

  /** Desert mid-boss spawn. */
  enterDesertMidBoss(b: Boss) {
    this.boss = b;
    this.midBoss = b;
    this.bossSpawned = true;
    this.desertPhase = 1;
  }

  /** Desert mid-boss has died, resume waves toward final boss. */
  enterPostDesertMidBossWaves() {
    this.desertPhase = 2;
    this.bossSpawned = false;
    this.boss = null;
  }

  /** Desert Temple final boss spawn. */
  enterDesertFinalBoss(b: Boss) {
    this.boss = b;
    this.bossSpawned = true;
    this.desertPhase = 3;
  }

  /** Generic non-castle boss spawn. */
  enterBossFight(b: Boss) {
    this.boss = b;
    this.bossSpawned = true;
  }

  /** Endless-mode primary boss spawn (slot 0). */
  enterEndlessPrimary(b: Boss) {
    this.boss = b;
    this.bossSpawned = true;
  }

  /** Endless-mode secondary boss spawn (slot 1, double-boss events). */
  enterEndlessSecondary(b: Boss) {
    this.midBoss = b;
  }

  /** Endless cycle reset — boss died, queue the next cycle. */
  startEndlessReset(now: number, ms: number) {
    this.endlessBossesCleared++;
    this.endlessResetUntil = now + ms;
  }

  /** Called when the next endless cycle actually starts. */
  finishEndlessReset() {
    this.bossSpawned = false;
    this.boss = null;
    this.midBoss = null;
    this.endlessResetUntil = 0;
  }

  /** Reset everything for a fresh level. */
  reset() {
    this.boss = null;
    this.midBoss = null;
    this.bossSpawned = false;
    this.midBossDefeated = false;
    this.castlePhase = 0;
    this.desertPhase = 0;
    this.endlessBossesCleared = 0;
    this.endlessResetUntil = 0;
  }
}
