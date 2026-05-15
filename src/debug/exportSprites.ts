import Phaser from 'phaser';

// Texture keys for all static (non-animated, non-particle) world art. Used by
// the DEBUG_EXPORT_STATIC_SPRITES flag to dump the procedural art to disk so
// it can be replaced with hand-drawn PNGs.
//
// Already-PNG keys (tower bases) are included because seeing them next to the
// procedural neighbors makes the style comparison easier.
const STATIC_TEXTURE_KEYS: string[] = [
  // Walls — 16 autotile masks × normal + damaged
  ...Array.from({ length: 16 }, (_, i) => `wall_${i}`),
  ...Array.from({ length: 16 }, (_, i) => `wall_${i}_dmg`),
  // Tower components
  't_archer',
  't_top_0', 't_top_1',
  'c_mount',
  'c_top_0', 'c_top_1',
  'foundation',
  // Tower bases (already PNG-backed)
  't_base', 't_base_1', 't_base_2',
  'c_base', 'c_base_1', 'c_base_2',
  // Tree clusters
  ...Array.from({ length: 16 }, (_, i) => `tree_cluster_${i}`),
  // Infected plant clusters
  ...Array.from({ length: 16 }, (_, i) => `infected_plant_${i}`),
  // Castle floor spikes
  ...Array.from({ length: 3 }, (_, i) => `castle_spikes_${i}`),
  // Off-screen indicators (HUD-ish but static art)
  'ind_arrow', 'ind_cannon', 'ind_boss', 'ind_ptr',
  // Misc
  'spider_web',
  'ui_check',
];

function textureToCanvas(scene: Phaser.Scene, key: string): HTMLCanvasElement | null {
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key).getSourceImage();
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement('canvas');
  c.width = (src as HTMLImageElement).width;
  c.height = (src as HTMLImageElement).height;
  c.getContext('2d')!.drawImage(src as HTMLImageElement, 0, 0);
  return c;
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a beat so the click() download had a chance to grab the blob.
      setTimeout(() => URL.revokeObjectURL(url), 100);
      resolve();
    }, 'image/png');
  });
}

/**
 * Download every static texture as a PNG. Files land in the browser's Downloads
 * folder named after their texture key (e.g. `wall_0.png`, `tree_cluster_5.png`).
 *
 * Chrome / Edge will prompt the user to "Allow multiple file downloads" — click
 * Allow once and the remaining files come through silently.
 *
 * The 50 ms stagger keeps Safari + Firefox happy; without it some downloads get
 * skipped on those browsers.
 */
export async function exportStaticSprites(scene: Phaser.Scene): Promise<void> {
  let exported = 0, missing = 0;
  for (const key of STATIC_TEXTURE_KEYS) {
    const canvas = textureToCanvas(scene, key);
    if (!canvas) {
      console.warn(`[exportStaticSprites] missing texture: ${key}`);
      missing++;
      continue;
    }
    await downloadCanvas(canvas, `${key}.png`);
    exported++;
    await new Promise(r => setTimeout(r, 50));
  }
  console.log(`[exportStaticSprites] exported ${exported} PNGs (${missing} missing)`);
}
