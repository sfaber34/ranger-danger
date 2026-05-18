import Phaser from 'phaser';
import { ClusterConfig } from './clusterConfig';

// Drop infected-plant PNGs at src/assets/sprites/infected_plants/*.png (any
// filenames; sorted alphabetically for stable variant order). The infected-
// biome cluster placement in ChunkSystem picks among them at runtime to
// assemble clusters tile-by-tile.
//
// Each PNG should be drawn with the trunk/stem base at the bottom-center of
// the canvas (placement uses setOrigin(0.5, 1.0)).
//
// All infected-plant knobs live in this file. Mirror file for forest trees
// is src/assets/treeOverrides.ts. Tweak independently — the two biomes do
// not share values.

const INFECTED_PLANT_URLS = import.meta.glob(
  './sprites/infected_plants/*.png',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const sortedInfectedPlantUrls = Object.entries(INFECTED_PLANT_URLS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

export const INFECTED_PLANT_PNG_COUNT = sortedInfectedPlantUrls.length;

/** Target world-pixel height a plant renders at before scale-jitter is applied. */
// export const INFECTED_PLANT_TARGET_WORLD_HEIGHT = 56;
export const INFECTED_PLANT_TARGET_WORLD_HEIGHT = 40;

/** ±this fraction is applied to base scale per plant for natural variety. */
export const INFECTED_PLANT_SCALE_JITTER = 0.10;

/** Per-plant tint palette. Sickly / poisoned tones befitting the biome.
 *  0xffffff renders the artwork untinted; further-from-white shifts harder. */
export const INFECTED_PLANT_TINTS: number[] = [
  0xffffff, // unmodified (default plant)
  0xa080c0, // sickly purple
  0x80c080, // toxic green
  0xc090a0, // pink rot
  0x90a060, // jaundiced yellow-green
];

/** Minimum plants placed per cluster tile. Must stay >= 1 — every infected-
 *  plant tile is a path blocker, so dropping below 1 would leave invisible
 *  walls. The placement helper enforces this with a Math.max(1, ...) safety
 *  net, but keep the value explicit here so the intent is clear. */
export const INFECTED_PLANT_PER_TILE_BASE = 1;
/** Probability of adding one extra plant on top of the base count. Wider
 *  plant sprites look cluttered with multiples per tile, so default to 0. */
export const INFECTED_PLANT_PER_TILE_EXTRA_CHANCE = 0;
/** Horizontal jitter as a fraction of tile width (centered). */
export const INFECTED_PLANT_JITTER_X_FRACTION = 0.84;
/** Vertical jitter as a fraction of tile height (centered). */
export const INFECTED_PLANT_JITTER_Y_FRACTION = 0.48;
/** Anchor Y inside the tile, as a fraction from the top (0.85 ≈ near bottom). */
export const INFECTED_PLANT_TRUNK_Y_FRACTION = 0.85;

/** Per-variant render-scale multiplier. Indices map to the alphabetical sort
 *  order of the PNGs in src/assets/sprites/infected_plants/, so:
 *    [0] → first file (e.g. infected_plant_1.png)
 *    [1] → second file
 *    [2..5] → remaining files (typically infected_plant_3..6.png)
 *  Missing entries default to 1.0. Adjust to make some variants visibly
 *  smaller / larger than others without resizing the source art. */
export const INFECTED_PLANT_VARIANT_SCALES: number[] = [1.8, 1.8, 0.75, 0.75, 0.75, 0.75];

export function loadInfectedPlantOverrides(scene: Phaser.Scene) {
  sortedInfectedPlantUrls.forEach((url, i) => {
    const k = `infected_plant_png_${i}`;
    if (!scene.textures.exists(k)) scene.load.image(k, url);
  });
}

/** Returns the texture key for infected-plant variant <i>, or null if no PNGs loaded. */
export function infectedPlantPngKey(i: number): string | null {
  if (INFECTED_PLANT_PNG_COUNT === 0) return null;
  return `infected_plant_png_${i % INFECTED_PLANT_PNG_COUNT}`;
}

export const INFECTED_PLANT_CLUSTER_CONFIG: ClusterConfig = {
  pngCount: INFECTED_PLANT_PNG_COUNT,
  pngKey: infectedPlantPngKey,
  targetWorldHeight: INFECTED_PLANT_TARGET_WORLD_HEIGHT,
  scaleJitter: INFECTED_PLANT_SCALE_JITTER,
  tints: INFECTED_PLANT_TINTS,
  perTileBase: INFECTED_PLANT_PER_TILE_BASE,
  perTileExtraChance: INFECTED_PLANT_PER_TILE_EXTRA_CHANCE,
  jitterXFraction: INFECTED_PLANT_JITTER_X_FRACTION,
  jitterYFraction: INFECTED_PLANT_JITTER_Y_FRACTION,
  trunkYFraction: INFECTED_PLANT_TRUNK_Y_FRACTION,
  variantScales: INFECTED_PLANT_VARIANT_SCALES,
};
