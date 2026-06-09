/**
 * Wave-progression state. Replaces the six interlocking fields that used
 * to live on GameScene (waveStartAt, wave, waveSpawned, waveKills,
 * waveBreakUntil, bossCountdownUntil). Most multi-field transitions go
 * through named methods so it's one call to advance the wave instead of
 * five scattered mutations.
 *
 * Counters are still publicly readable — UIScene assembles its HUD payload
 * from them, and updateSpawning needs to compare timer fields against the
 * current vTime each frame. Writes from outside the class are still
 * possible but should be reviewed: anything that mutates more than one
 * field at a time belongs in a transition method here.
 */
export class WaveState {
  /** 0-indexed current wave number. wave === 0 is the first wave (display "WAVE 1"). */
  wave = 0;

  /** Enemies spawned so far in the current wave. */
  waveSpawned = 0;

  /** Kills counted toward the current wave's size. */
  waveKills = 0;

  /** SpawnSystem's wave-end climax fires one mandatory pack burst at
   *  ~85% progress. This flag is reset on every wave-break transition so
   *  the climax repeats for each new wave. */
  finalePackTriggered = false;

  /**
   * Real-time vTime when the initial pre-game build phase ends. Set to
   * Infinity by the tutorial to suppress all spawning.
   */
  waveStartAt = 0;

  /** vTime when the inter-wave build break ends. */
  waveBreakUntil = 0;

  /**
   * vTime when the boss spawns after stragglers are cleared. 0 = unset
   * (still waiting for stragglers / boss not yet queued).
   */
  bossCountdownUntil = 0;

  // ---------- transitions ----------

  /** Begin or restart the inter-wave build break, advancing to the next wave. */
  enterWaveBreak(now: number, breakMs: number) {
    this.wave++;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.waveBreakUntil = now + breakMs;
    this.finalePackTriggered = false;
  }

  /**
   * Castle phase-2 advance — queen has died, jump to wave 2 (the dragon's
   * lead-in waves) with a fresh build break. bossCountdownUntil is also
   * cleared here since the next boss-prep cycle hasn't started.
   */
  enterCastlePhase2(now: number, breakMs: number) {
    this.wave = 2;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.bossCountdownUntil = 0;
    this.waveBreakUntil = now + breakMs;
    this.finalePackTriggered = false;
  }

  enterDesertPhase2(now: number, breakMs: number) {
    this.wave = 3;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.bossCountdownUntil = 0;
    this.waveBreakUntil = now + breakMs;
    this.finalePackTriggered = false;
  }

  /**
   * Endless-mode boss-cycle reset. Wave counter is cumulative across
   * cycles (so the displayed wave number keeps climbing), but spawn/kill
   * counters and the boss-prep timer reset for the next 3-waves-plus-boss
   * cycle.
   */
  enterNextEndlessCycle(now: number, breakMs: number) {
    this.wave++;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.bossCountdownUntil = 0;
    this.waveBreakUntil = now + breakMs;
    this.finalePackTriggered = false;
  }

  recordSpawn() { this.waveSpawned++; }

  recordKill() { this.waveKills++; }

  /** Stragglers cleared on a boss wave — start the prep-time countdown. */
  startBossPrep(now: number, prepMs: number) {
    this.bossCountdownUntil = now + prepMs;
  }

  resetBossPrep() {
    this.bossCountdownUntil = 0;
  }

  /** Kick off the initial pre-game build phase. */
  startInitialBuildPhase(startAt: number) {
    this.waveStartAt = startAt;
  }

  /** Tutorial: pause spawning indefinitely. */
  suspendInitialBuildPhase() {
    this.waveStartAt = Infinity;
  }

  /** Tutorial: resume spawning at the given vTime (effectively now). */
  resumeInitialBuildPhase(vTime: number) {
    this.waveStartAt = vTime;
  }

  /** Reset all counters/timers (used on init/level transition). */
  reset() {
    this.wave = 0;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.waveStartAt = 0;
    this.waveBreakUntil = 0;
    this.bossCountdownUntil = 0;
    this.finalePackTriggered = false;
  }
}
