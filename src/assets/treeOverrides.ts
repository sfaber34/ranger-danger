import Phaser from 'phaser';
import { ClusterConfig } from './clusterConfig';

// Drop tree PNGs at src/assets/sprites/trees/*.png (any filenames; sorted
// alphabetically for stable variant order). The forest-cluster placement in
// ChunkSystem picks among them at runtime to assemble clusters tile-by-tile.
//
// Each PNG should be drawn with the trunk base at the bottom-center of the
// canvas (placement uses setOrigin(0.5, 1.0)).
//
// All forest-tree knobs live in this file. Mirror file for infected plants
// is src/assets/infectedPlantOverrides.ts.

const TREE_URLS = import.meta.glob(
  './sprites/trees/*.png',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const sortedTreeUrls = Object.entries(TREE_URLS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

export const TREE_PNG_COUNT = sortedTreeUrls.length;

/** Target world-pixel height a tree renders at before scale-jitter is
 *  applied. Matches the midpoint of the procedural baker's tree-height range
 *  (48-62 world px). */
export const TREE_TARGET_WORLD_HEIGHT = 56;

/** ±this fraction is applied to base scale per tree for natural variety. */
export const TREE_SCALE_JITTER = 0.25;

/** Per-tree tint palette. setTint multiplies RGB, so further-from-white
 *  values shift the tree noticeably. 0xffffff is the "no tint" identity —
 *  one entry kept so some trees render with the artwork's original colors. */
export const TREE_TINTS: number[] = [
  0xffffff, // unmodified (default tree)
  0xa0c060, // bright yellow-green (new growth)
  0x80a060, // deep sage / pine
  0xc0a050, // autumn / dry
  0x60a070, // dark forest green
  0x508c70, // cool deep emerald
  0xb09848, // olive
];

/** Minimum trees placed per cluster tile. */
export const TREE_PER_TILE_BASE = 1;
/** Probability of adding one extra tree on top of the base count. */
export const TREE_PER_TILE_EXTRA_CHANCE = 0.5;
/** Horizontal jitter as a fraction of tile width (centered). */
export const TREE_JITTER_X_FRACTION = 0.84;
/** Vertical jitter as a fraction of tile height (centered). */
export const TREE_JITTER_Y_FRACTION = 0.48;
/** Anchor Y inside the tile, as a fraction from the top (0.85 ≈ near bottom). */
export const TREE_TRUNK_Y_FRACTION = 0.85;

export function loadTreeOverrides(scene: Phaser.Scene) {
  sortedTreeUrls.forEach((url, i) => {
    const k = `tree_png_${i}`;
    if (!scene.textures.exists(k)) scene.load.image(k, url);
  });
}

/** Returns the texture key for tree variant <i>, or null if no PNGs loaded. */
export function treePngKey(i: number): string | null {
  if (TREE_PNG_COUNT === 0) return null;
  return `tree_png_${i % TREE_PNG_COUNT}`;
}

export const TREE_CLUSTER_CONFIG: ClusterConfig = {
  pngCount: TREE_PNG_COUNT,
  pngKey: treePngKey,
  targetWorldHeight: TREE_TARGET_WORLD_HEIGHT,
  scaleJitter: TREE_SCALE_JITTER,
  tints: TREE_TINTS,
  perTileBase: TREE_PER_TILE_BASE,
  perTileExtraChance: TREE_PER_TILE_EXTRA_CHANCE,
  jitterXFraction: TREE_JITTER_X_FRACTION,
  jitterYFraction: TREE_JITTER_Y_FRACTION,
  trunkYFraction: TREE_TRUNK_Y_FRACTION,
};
