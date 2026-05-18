/**
 * Shape of the per-biome cluster config consumed by ChunkSystem.placePngCluster.
 * Tree and infected-plant overrides each export a config of this shape; the
 * placement helper is biome-agnostic.
 */
export type ClusterConfig = {
  /** Number of PNG variants loaded for this cluster type (0 → use procedural fallback). */
  pngCount: number;
  /** Returns the texture key for variant <i>, or null if no PNGs loaded. */
  pngKey: (i: number) => string | null;
  /** World-pixel height the sprite is scaled to before scale-jitter is applied. */
  targetWorldHeight: number;
  /** ±this fraction is applied to base scale per sprite. */
  scaleJitter: number;
  /** Random-tint palette. Entries of 0xffffff render the artwork untinted. */
  tints: number[];
  /** Minimum sprites placed per tile. */
  perTileBase: number;
  /** Probability of adding one extra sprite on top of the base count. */
  perTileExtraChance: number;
  /** Horizontal jitter as a fraction of tile width (centered). */
  jitterXFraction: number;
  /** Vertical jitter as a fraction of tile height (centered). */
  jitterYFraction: number;
  /** Anchor Y inside the tile, as a fraction from the top (0.85 ≈ near bottom). */
  trunkYFraction: number;
  /** Optional per-variant scale multiplier applied on top of the base scale.
   *  Indices map to the variant returned by pngKey(); missing entries default
   *  to 1.0. Use this to shrink/grow specific plants without touching the
   *  source PNG dimensions. */
  variantScales?: number[];
};
