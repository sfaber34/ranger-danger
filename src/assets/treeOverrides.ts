import Phaser from 'phaser';

// Drop tree PNGs at src/assets/sprites/trees/*.png (any filenames; sorted
// alphabetically for stable variant order). The forest-cluster placement in
// ChunkSystem picks among them at runtime to assemble clusters tile-by-tile,
// reproducing the same density (2-3 trees per tile, jittered) as the old
// pre-baked tree_cluster_<i> textures.
//
// Each PNG should be drawn with the trunk base at the bottom-center of the
// canvas (placement uses setOrigin(0.5, 1.0)). Render-time scale targets a
// ~56 world-px tree height with ±15% jitter, matching the procedural baker's
// treeH range (48-62).

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

/** Per-tree tint palette. setTint multiplies RGB, so values close to white
 *  are subtle. 0xffffff is the "no tint" identity — included so a fraction
 *  of trees render with the artwork's original colors. Keep these gentle:
 *  big departures from white make the foliage look stained, not varied. */
export const TREE_TINTS: number[] = [
  0xffffff, // unmodified (default tree)
  0xffffff, // weighted heavier toward "no tint" so the artwork carries
  0xd8e0b8, // pale yellow-green
  0xb8c8a0, // sage
  0xd8c890, // touch of autumn / dry
  0xa8c0a8, // cool spring green
  0xc8b890, // earthy / olive
];

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
