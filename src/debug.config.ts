import type { EnemyKind } from './entities/Enemy';

type InitialSpawn = {
  kind: EnemyKind;
  dx?: number;
  dy?: number;
  distance?: number;
  angleDeg?: number;
};

/**
 * Development debug overrides. Edit values here and refresh the browser (F5)
 * to apply. All flags default to off — file is harmless to leave in source.
 */
export const DEBUG = {
  noDamage: true,
  pauseWaveSpawns: true,

  /**
   * Disable the stuck-recovery teleport (Stage 3 at 2s + sliding-window at
   * 4s/16px). When debugging pathfinding, stuck enemies should stay where
   * they are so you can observe what's happening instead of vanishing back
   * to the spawn ring.
   */
  disableStuckRecovery: true,
  initialSpawns: [
    { kind: 'bear', distance: 400 },
  ] as InitialSpawn[],
  path: {
    enabled: true,
    kinds: [] as EnemyKind[],
    maxDistFromPlayer: 0,
    intervalMs: 150,
  },

  /**
   * Pre-built wall maze placed once on scene start. Multi-line ASCII grid:
   *   '#'   = wall tile
   *   '.'   = empty tile
   *   '@'   = mark the player's position (optional; defaults to grid center)
   *   ' '   = ignored (lets you align rows visually)
   * Set to empty string to disable.
   */
  preBuiltMaze: `
  ..#####..
  .#.....#.
  #..###..#
  #.#...#.#
  #.#.#.#.#
  #.#@#.#.#
  #.###.#.#
  #.....#.#
  .#####..#
  .......#.
  ......#..
`,
};
