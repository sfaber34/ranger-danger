/** Plain shape persisted in localStorage and read back for the
 *  death-screen comparison. Mirrors the public fields of RunStats. */
export interface RunStatsSnapshot {
  wavesCleared: number;
  bossesKilled: number;
  bossesByKind: Record<string, number>;
  enemiesKilled: number;
  coinsCollected: number;
  coinsSpent: number;
  towersBuilt: number;
  towersUpgradedToMax: number;
  highestTowerLevel: number;
  wallsBuilt: number;
  wallsDestroyed: number;
  damageDealt: number;
  damageTaken: number;
  timeSurvived: number;
}

const STORAGE_KEY = 'td_endless_scores';

type ScoreStore = Record<string, RunStatsSnapshot>;

function loadStore(): ScoreStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store: ScoreStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // private mode / quota exceeded — silently drop
  }
}

/** Best run for `levelId`, or null if no run was ever saved. */
export function loadEndlessBest(levelId: number): RunStatsSnapshot | null {
  return loadStore()[String(levelId)] ?? null;
}

/** Merge a finished run into the persisted "best" record field-by-field
 *  — each metric tracks its own all-time best, so a long run with poor
 *  damage doesn't wipe a short run's better damage record. Returns the
 *  set of metric keys this run set a new record on. */
export function saveEndlessBest(levelId: number, run: RunStatsSnapshot): Set<string> {
  const store = loadStore();
  const key = String(levelId);
  const prev = store[key];
  const newRecords = new Set<string>();
  if (!prev) {
    store[key] = { ...run, bossesByKind: { ...run.bossesByKind } };
    // First run on this level — every nonzero metric counts as a record.
    for (const k of Object.keys(run) as (keyof RunStatsSnapshot)[]) {
      const v = run[k];
      if (typeof v === 'number' && v > 0) newRecords.add(k);
    }
    writeStore(store);
    return newRecords;
  }
  const merged: RunStatsSnapshot = {
    wavesCleared:        Math.max(prev.wavesCleared,        run.wavesCleared),
    bossesKilled:        Math.max(prev.bossesKilled,        run.bossesKilled),
    bossesByKind:        { ...prev.bossesByKind },
    enemiesKilled:       Math.max(prev.enemiesKilled,       run.enemiesKilled),
    coinsCollected:      Math.max(prev.coinsCollected,      run.coinsCollected),
    coinsSpent:          Math.max(prev.coinsSpent,          run.coinsSpent),
    towersBuilt:         Math.max(prev.towersBuilt,         run.towersBuilt),
    towersUpgradedToMax: Math.max(prev.towersUpgradedToMax, run.towersUpgradedToMax),
    highestTowerLevel:   Math.max(prev.highestTowerLevel,   run.highestTowerLevel),
    wallsBuilt:          Math.max(prev.wallsBuilt,          run.wallsBuilt),
    wallsDestroyed:      Math.max(prev.wallsDestroyed,      run.wallsDestroyed),
    damageDealt:         Math.max(prev.damageDealt,         run.damageDealt),
    damageTaken:         Math.max(prev.damageTaken,         run.damageTaken),
    timeSurvived:        Math.max(prev.timeSurvived,        run.timeSurvived),
  };
  for (const k of Object.keys(merged) as (keyof RunStatsSnapshot)[]) {
    const v = merged[k];
    if (typeof v === 'number' && (run as any)[k] > (prev as any)[k]) newRecords.add(k);
  }
  // Boss-by-kind: per-kind max
  for (const kind of Object.keys(run.bossesByKind)) {
    merged.bossesByKind[kind] = Math.max(prev.bossesByKind[kind] ?? 0, run.bossesByKind[kind] ?? 0);
  }
  store[key] = merged;
  writeStore(store);
  return newRecords;
}

/**
 * Per-run telemetry counters. Used by endless mode to populate the
 * death screen and to compare against the persisted best-run snapshot.
 *
 * All counters reset to 0 on every level start (init) — this is a
 * single-run record, not a lifetime tally.
 */
export class RunStats {
  /** Cumulative wave count (1-indexed). Mirrors waveState.wave + 1 at
   *  death time so the panel doesn't have to know about WaveState. */
  wavesCleared = 0;

  /** Total bosses defeated (sum of bossesByKind). Mirrors
   *  bossState.endlessBossesCleared. */
  bossesKilled = 0;

  /** Per-kind boss kill breakdown. Keys match the boss "title" buckets:
   *  ram, wendigo, blighted, fog, queen, dragon. */
  bossesByKind: Record<string, number> = {
    ram: 0, wendigo: 0, blighted: 0, fog: 0, queen: 0, dragon: 0,
  };

  enemiesKilled = 0;
  coinsCollected = 0;
  coinsSpent = 0;

  towersBuilt = 0;
  /** Towers that hit the max level (level === levels.length - 1) at
   *  least once during the run. */
  towersUpgradedToMax = 0;
  highestTowerLevel = 0;

  wallsBuilt = 0;
  wallsDestroyed = 0;

  damageDealt = 0;
  damageTaken = 0;

  /** vTime in ms at game-over. Set once when the player dies. */
  timeSurvived = 0;

  reset() {
    this.wavesCleared = 0;
    this.bossesKilled = 0;
    this.bossesByKind = { ram: 0, wendigo: 0, blighted: 0, fog: 0, queen: 0, dragon: 0 };
    this.enemiesKilled = 0;
    this.coinsCollected = 0;
    this.coinsSpent = 0;
    this.towersBuilt = 0;
    this.towersUpgradedToMax = 0;
    this.highestTowerLevel = 0;
    this.wallsBuilt = 0;
    this.wallsDestroyed = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.timeSurvived = 0;
  }
}
