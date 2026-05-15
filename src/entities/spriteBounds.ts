import Phaser from 'phaser';

/**
 * Bounding box of a texture's non-transparent pixels, in source-pixel coords.
 * Returned by measureOpaqueBounds; null when the read fails (e.g. a tainted
 * cross-origin canvas) or when the texture is fully transparent.
 */
export type OpaqueBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  sourceW: number;
  sourceH: number;
};

// Cache keyed by texture key. Textures are stable for the lifetime of a scene
// (they're rebuilt fresh on scene init), so a one-time scan per texture is
// safe and saves us from doing 4×10^5 pixel reads every time an enemy spawns.
const cache = new Map<string, OpaqueBounds | null>();

/** Forget cached bounds — call when textures get replaced (e.g. before a
 *  fresh applySpriteOverrides pass). */
export function clearOpaqueBoundsCache(): void {
  cache.clear();
}

/** Scan a texture for the bounding box of all pixels with alpha > 0. */
export function measureOpaqueBounds(scene: Phaser.Scene, textureKey: string): OpaqueBounds | null {
  if (cache.has(textureKey)) return cache.get(textureKey)!;
  const result = scan(scene, textureKey);
  cache.set(textureKey, result);
  return result;
}

function scan(scene: Phaser.Scene, textureKey: string): OpaqueBounds | null {
  try {
    const src = scene.textures.get(textureKey).getSourceImage();
    let canvas: HTMLCanvasElement;
    if (src instanceof HTMLCanvasElement) {
      canvas = src;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = (src as HTMLImageElement).width;
      canvas.height = (src as HTMLImageElement).height;
      canvas.getContext('2d')!.drawImage(src as HTMLImageElement, 0, 0);
    }
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let left = w, right = -1, top = h, bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 0) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right < 0) return null;
    return { left, right, top, bottom, sourceW: w, sourceH: h };
  } catch {
    return null;
  }
}
