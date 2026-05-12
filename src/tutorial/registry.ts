import type { Step, TutorialStepName } from './Step';
import { lsClickMeadow } from './steps/lsClickMeadow';
import { lsClickEasy } from './steps/lsClickEasy';
import { lsClickStart } from './steps/lsClickStart';
import { GameMoveStep } from './steps/gameMove';
import { gameHud } from './steps/gameHud';
import { GameStandStillStep } from './steps/gameStandStill';
import { GameKillStep } from './steps/gameKill';
import { gamePress1 } from './steps/gamePress1';
import { gamePlaceTower } from './steps/gamePlaceTower';
import { GameWatchTowerStep } from './steps/gameWatchTower';
import { gamePress4 } from './steps/gamePress4';
import { GamePlaceWallsStep } from './steps/gamePlaceWalls';
import { gameExitBuild } from './steps/gameExitBuild';
import { GameLootCoinsStep } from './steps/gameLootCoins';
import { gameCollect60 } from './steps/gameCollect60';
import { gameClickTower } from './steps/gameClickTower';
import { gameUpgradeTower } from './steps/gameUpgradeTower';
import { gameDeselectTower } from './steps/gameDeselectTower';
import { gameSpeed } from './steps/gameSpeed';
import { gameDone } from './steps/gameDone';

/**
 * Build a fresh registry of every tutorial step. Class-based steps
 * (those with mutable state like kill/wall counters) get a new instance
 * per call, so re-running the tutorial doesn't carry stale counters
 * from the previous run. Stateless steps are exported as singletons —
 * sharing a single instance is fine for them.
 *
 * `complete` is a sentinel name (no Step entry) — TutorialScene treats
 * it as "fire finish() and stop the scene" rather than rendering.
 */
export function buildStepRegistry(): Map<TutorialStepName, Step> {
  const reg = new Map<TutorialStepName, Step>();

  reg.set('ls_click_meadow', lsClickMeadow);
  reg.set('ls_click_easy', lsClickEasy);
  reg.set('ls_click_start', lsClickStart);

  reg.set('game_move', new GameMoveStep());
  reg.set('game_hud', gameHud);
  reg.set('game_stand_still', new GameStandStillStep());
  reg.set('game_kill', new GameKillStep());
  reg.set('game_press_1', gamePress1);
  reg.set('game_place_tower', gamePlaceTower);
  reg.set('game_watch_tower', new GameWatchTowerStep());
  reg.set('game_press_4', gamePress4);
  reg.set('game_place_walls', new GamePlaceWallsStep());
  reg.set('game_exit_build', gameExitBuild);
  reg.set('game_loot_coins', new GameLootCoinsStep());
  reg.set('game_collect_60', gameCollect60);
  reg.set('game_click_tower', gameClickTower);
  reg.set('game_upgrade_tower', gameUpgradeTower);
  reg.set('game_deselect_tower', gameDeselectTower);
  reg.set('game_speed', gameSpeed);
  reg.set('game_done', gameDone);

  return reg;
}
