/**
 * In-level player upgrade state. Counts per stat reset on every
 * GameScene.init() — bonuses never carry across levels or replays.
 *
 * Stat scaling is additive: each purchase adds 20% of the base stat
 * value. Cost scaling is multiplicative: each purchase makes the next
 * one 1.5× more expensive, so the curve self-limits via affordability.
 */

export type UpgradableStat = 'atkSpeed' | 'atkPower' | 'atkRange' | 'runSpeed' | 'maxHp';

export const UPGRADABLE_STATS: readonly UpgradableStat[] = [
  'atkSpeed', 'atkPower', 'atkRange', 'runSpeed', 'maxHp',
];

export const STAT_LABEL: Record<UpgradableStat, string> = {
  atkSpeed: 'Attack Speed',
  atkPower: 'Attack Power',
  atkRange: 'Attack Range',
  runSpeed: 'Run Speed',
  maxHp:    'Max HP',
};

const STAT_INC = 0.20;
const COST_INC = 1.3;
const BASE_COST = 50;

export class PlayerUpgradeState {
  counts: Record<UpgradableStat, number> = {
    atkSpeed: 0, atkPower: 0, atkRange: 0, runSpeed: 0, maxHp: 0,
  };

  multiplier(stat: UpgradableStat): number {
    return 1 + STAT_INC * this.counts[stat];
  }

  cost(stat: UpgradableStat): number {
    return Math.round(BASE_COST * Math.pow(COST_INC, this.counts[stat]));
  }

  buy(stat: UpgradableStat): void {
    this.counts[stat]++;
  }

  reset(): void {
    for (const s of UPGRADABLE_STATS) this.counts[s] = 0;
  }
}
