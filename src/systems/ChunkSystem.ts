import Phaser from 'phaser';
import { CFG } from '../config';
import {
  createGroundChunk,
  TREE_PATTERNS,
  SPIKE_PATTERNS,
  SPIKE_VARIANT_COUNT,
  getRiverTileGrid,
  riverCenterPx,
  RIVER_HALF_W,
  riverHorizontalCenterY,
} from '../assets/generateArt';
import { canReachFromSpawnDirections, gridGet, gridSet } from './Pathfinding';
import { TREE_CLUSTER_CONFIG } from '../assets/treeOverrides';
import { INFECTED_PLANT_CLUSTER_CONFIG } from '../assets/infectedPlantOverrides';
import { ClusterConfig } from '../assets/clusterConfig';
import type { GameScene } from '../scenes/GameScene';

type ClusterPattern = { tiles: { dx: number; dy: number }[]; w: number; h: number };

/**
 * Streamed ground-chunk generation, plus the per-biome decoration passes
 * (river, trees, spikes) that piggyback on the chunk pipeline. Also owns the
 * river-squiggle ambient FX update. Tree-tile destruction lives here too
 * because trees are a chunk-spawned obstacle.
 */
export class ChunkSystem {
  constructor(private scene: GameScene) {}

  // Queue ground chunks around a world position (deferred generation)
  generateChunksAround(wx: number, wy: number, force = false) {
    const scene = this.scene;
    const cs = CFG.chunkSize;
    const tile = CFG.tile;
    const cx = Math.floor(wx / (cs * tile));
    const cy = Math.floor(wy / (cs * tile));
    // Skip if player is still in the same chunk (unless forced at startup)
    if (!force && cx === scene.lastChunkCx && cy === scene.lastChunkCy) return;
    scene.lastChunkCx = cx;
    scene.lastChunkCy = cy;
    const cs2 = CFG.chunkSize;
    const tile2 = CFG.tile;
    const chunkPx = cs2 * tile2;
    const radius = 3; // generate around viewport
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const ck = `${cx + dx},${cy + dy}`;
        // Already have a display image? skip
        if (scene.chunkImages.has(ck)) continue;
        // Texture already cached from a previous visit? Just create image, no re-render
        const texKey = `gnd_chunk_${scene.biome}_${cx + dx}_${cy + dy}`;
        if (scene.generatedChunks.has(ck) && scene.textures.exists(texKey)) {
          const img = scene.add.image((cx + dx) * chunkPx + chunkPx / 2, (cy + dy) * chunkPx + chunkPx / 2, texKey).setDepth(-1000);
          scene.chunkImages.set(ck, img);
          continue;
        }
        // New chunk — queue for generation
        if (!scene.generatedChunks.has(ck)) {
          scene.generatedChunks.add(ck);
          scene.pendingChunks.push({ cx: cx + dx, cy: cy + dy });
        }
      }
    }
    // Sort by distance to player chunk so nearest chunks render first
    scene.pendingChunks.sort((a, b) =>
      ((a.cx - cx) ** 2 + (a.cy - cy) ** 2) - ((b.cx - cx) ** 2 + (b.cy - cy) ** 2)
    );

    // Destroy distant chunk images (textures stay cached for instant re-creation)
    const cullRadius = radius + 3;
    for (const [key, img] of scene.chunkImages) {
      const [kcx, kcy] = key.split(',').map(Number);
      if (Math.abs(kcx - cx) > cullRadius || Math.abs(kcy - cy) > cullRadius) {
        img.destroy();
        scene.chunkImages.delete(key);
      }
    }
  }

  /**
   * Process pending chunks with a time budget.
   * @param budgetMs max milliseconds to spend (0 = unlimited, process all)
   */
  processChunkQueue(budgetMs: number) {
    const scene = this.scene;
    const cs = CFG.chunkSize;
    const tile = CFG.tile;
    const chunkPx = cs * tile;
    const start = performance.now();
    // Hard cap: at most 1 chunk per frame when budgeted (river chunks are expensive)
    const maxPerFrame = budgetMs > 0 ? 1 : Infinity;
    let processed = 0;
    while (scene.pendingChunks.length > 0 && processed < maxPerFrame) {
      // Time-budget check (skip on unlimited/startup)
      if (budgetMs > 0 && performance.now() - start >= budgetMs) break;
      const { cx: ccx, cy: ccy } = scene.pendingChunks.shift()!;
      const texKey = createGroundChunk(scene, ccx, ccy, cs, 32, scene.biome);
      const chunkImg = scene.add.image(ccx * chunkPx + chunkPx / 2, ccy * chunkPx + chunkPx / 2, texKey).setDepth(-1000);
      scene.chunkImages.set(`${ccx},${ccy}`, chunkImg);
      // Generate trees for this chunk if forest biome
      if (scene.biome === 'forest' || scene.biome === 'infected') this.placeTreesInChunk(ccx, ccy);
      if (scene.biome === 'castle') this.placeSpikesInChunk(ccx, ccy);
      // Generate river terrain blockers
      if (scene.biome === 'river') this.placeRiverInChunk(ccx, ccy);
      processed++;
    }
  }

  /** Destroy a tree tile at grid coords, removing its blocker and sprite. */
  destroyTreeTile(gx: number, gy: number) {
    const scene = this.scene;
    const t = CFG.tile;
    gridSet(scene.grid, gx, gy, 0);
    scene.pathing.syncWallTile(gx, gy, false);

    // Remove the physics blocker zone at this tile
    const wx = gx * t + t / 2;
    const wy = gy * t + t / 2;
    for (const child of scene.wallGroup.getChildren()) {
      if (Math.abs((child as any).x - wx) < 2 && Math.abs((child as any).y - wy) < 2) {
        child.destroy();
        break;
      }
    }

    // Destroy tree sprites belonging to this tile. PNG-mode trees are tagged
    // with _gx/_gy so we hit exactly the right tile's trees; legacy baked
    // cluster sprites (no tag, one per cluster) fall back to a bounding-box
    // overlap test, which destroys the whole cluster when any of its tiles
    // is hit — same behavior the system had before PNG mode was added.
    const px = gx * t + t / 2;
    const py = gy * t + t / 2;
    for (let i = scene.treeSprites.length - 1; i >= 0; i--) {
      const spr = scene.treeSprites[i] as Phaser.GameObjects.Image & { _gx?: number; _gy?: number };
      const hasTag = spr._gx !== undefined && spr._gy !== undefined;
      let hit: boolean;
      if (hasTag) {
        hit = spr._gx === gx && spr._gy === gy;
      } else {
        const hw = spr.width * spr.scaleX / 2;
        const hh = spr.height * spr.scaleY / 2;
        hit = px >= spr.x - hw && px <= spr.x + hw && py >= spr.y - hh && py <= spr.y + hh;
      }
      if (hit) {
        spr.destroy();
        scene.treeSprites.splice(i, 1);
      }
    }

    scene.gridVersion++; scene._wallCheckCache.clear();
  }

  // ---------- RIVER TERRAIN (river biome) ----------
  placeRiverInChunk(cx: number, cy: number) {
    const scene = this.scene;
    const chunkKey = `${cx},${cy}`;
    if (scene.riverChunksGenerated.has(chunkKey)) return;
    scene.riverChunksGenerated.add(chunkKey);

    const cs = CFG.chunkSize;
    const chunkTileX = cx * cs;
    const chunkTileY = cy * cs;

    for (let ty = 0; ty < cs; ty++) {
      for (let tx = 0; tx < cs; tx++) {
        const gx = chunkTileX + tx;
        const gy = chunkTileY + ty;
        const gridVal = getRiverTileGrid(gx, gy);
        if (gridVal === 4) {
          gridSet(scene.grid, gx, gy, 4);
          scene.pathing.syncWallTile(gx, gy, true);
        } else if (gridVal === 5) {
          gridSet(scene.grid, gx, gy, 5);
          // No physics blocker — bridges are walkable
        }
      }
    }
    // Don't bump gridVersion here — river terrain is static and shouldn't
    // force all enemies to recalculate paths on every chunk load.
  }

  // ---------- RIVER SQUIGGLES (animated water flow lines) ----------
  updateRiverSquiggles(delta: number) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const camL = cam.scrollX - 50;
    const camR = cam.scrollX + cam.width + 50;
    const camT = cam.scrollY - 50;
    const camB = cam.scrollY + cam.height + 50;
    const MAX_SQUIGGLES = 12;

    // Spawn new squiggles periodically
    scene.squiggleTimer -= delta;
    if (scene.squiggleTimer <= 0 && scene.riverSquiggles.length < MAX_SQUIGGLES) {
      scene.squiggleTimer = 200 + Math.random() * 250;
      const vertical = Math.random() < 0.5;
      const texKey = `river_squig_${Math.floor(Math.random() * 5)}`;
      const speed = 0.005 + Math.random() * 0.006;

      if (vertical) {
        // Vertical river: spawn at random Y, position on river center X
        const spawnY = camT + Math.random() * (camB - camT);
        const cx = riverCenterPx(0, spawnY);
        if (cx > camL && cx < camR) {
          const ox = (Math.random() - 0.5) * RIVER_HALF_W * 1.2;
          const sprite = scene.add.image(cx + ox, spawnY, texKey).setDepth(-999).setAlpha(0);
          scene.riverSquiggles.push({ sprite, age: 0, life: 1500 + Math.random() * 1000, dx: 0, dy: speed });
        }
      } else {
        // Horizontal river: spawn at random X, position on river center Y
        const spawnX = camL + Math.random() * (camR - camL);
        const cy = riverHorizontalCenterY(spawnX);
        if (cy > camT && cy < camB) {
          const oy = (Math.random() - 0.5) * RIVER_HALF_W * 1.2;
          const sprite = scene.add.image(spawnX, cy + oy, texKey).setDepth(-999).setAlpha(0);
          scene.riverSquiggles.push({ sprite, age: 0, life: 1500 + Math.random() * 1000, dx: speed, dy: 0 });
        }
      }
    }

    // Update sprites
    for (let i = scene.riverSquiggles.length - 1; i >= 0; i--) {
      const sq = scene.riverSquiggles[i];
      sq.age += delta;
      sq.sprite.x += sq.dx * delta;
      sq.sprite.y += sq.dy * delta;

      const sx = sq.sprite.x, sy = sq.sprite.y;
      if (sq.age >= sq.life || sx < camL - 80 || sx > camR + 80 || sy < camT - 80 || sy > camB + 80) {
        sq.sprite.destroy();
        scene.riverSquiggles.splice(i, 1);
        continue;
      }

      const t = sq.age / sq.life;
      const alpha = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1.0;
      sq.sprite.setAlpha(alpha * 0.15);
    }
  }

  // ---------- TREE OBSTACLES (forest biome) ----------
  /** Place tree clusters in a single chunk. Deterministic per chunk coords + treeSeed. */
  placeTreesInChunk(cx: number, cy: number) {
    const scene = this.scene;
    const chunkKey = `${cx},${cy}`;
    if (scene.treeChunksGenerated.has(chunkKey)) return;
    scene.treeChunksGenerated.add(chunkKey);

    const t = CFG.tile;
    const cs = CFG.chunkSize; // tiles per chunk
    const clustersPerChunk = 2; // target clusters per chunk
    const maxAttempts = clustersPerChunk * 6;

    // Deterministic RNG for this chunk (same treeSeed + chunk coords = same trees)
    let seed = ((scene.treeSeed + cx * 73856093 + cy * 19349669) >>> 0) || 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    const ptx = Math.floor(scene.player.x / t);
    const pty = Math.floor(scene.player.y / t);
    // Only do pathfinding checks near spawn (within spawnDist + margin)
    const nearSpawn = Math.abs(cx * cs) < scene.spawnDist + cs && Math.abs(cy * cs) < scene.spawnDist + cs;

    // Chunk tile origin
    const chunkTileX = cx * cs;
    const chunkTileY = cy * cs;

    let placed = 0;
    let attempts = 0;
    while (placed < clustersPerChunk && attempts < maxAttempts) {
      attempts++;
      const pattern = TREE_PATTERNS[Math.floor(rng() * TREE_PATTERNS.length)];
      // Random tile within this chunk
      const ox = chunkTileX + Math.floor(rng() * (cs - pattern.w));
      const oy = chunkTileY + Math.floor(rng() * (cs - pattern.h));

      // Don't place too close to player spawn
      if (Math.abs(ox) < 3 && Math.abs(oy) < 3) continue;

      // Check all tiles in pattern are free
      let blocked = false;
      for (const tile of pattern.tiles) {
        const gx = ox + tile.dx, gy = oy + tile.dy;
        if (gridGet(scene.grid, gx, gy) !== 0) { blocked = true; break; }
        if (Math.abs(gx - ptx) <= 1 && Math.abs(gy - pty) <= 1) { blocked = true; break; }
      }
      if (blocked) continue;

      // Tentatively place on grid
      for (const tile of pattern.tiles) {
        gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 3);
      }

      // Pathfinding check only near spawn area
      if (nearSpawn && !canReachFromSpawnDirections(scene.grid, ptx, pty, scene.spawnDist, 3)) {
        for (const tile of pattern.tiles) {
          gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 0);
        }
        continue;
      }

      // Place cluster sprite. PNG mode (per-tile placement) when override
      // PNGs exist for this biome; otherwise fall back to the pre-baked
      // single-image-per-cluster procedural texture.
      const patIdx = TREE_PATTERNS.indexOf(pattern);
      const sprX = ox * t + (pattern.w * t) / 2;
      const sprY = oy * t + (pattern.h * t) / 2;
      const bottomY = oy * t + pattern.h * t;
      const cfg = scene.biome === 'infected' ? INFECTED_PLANT_CLUSTER_CONFIG : TREE_CLUSTER_CONFIG;
      if (cfg.pngCount > 0) {
        this.placePngCluster(pattern, ox, oy, t, rng, cfg);
      } else {
        const texKey = scene.biome === 'infected' ? `infected_plant_${patIdx}` : `tree_cluster_${patIdx}`;
        const spr = scene.add.image(sprX, sprY, texKey).setDepth(100 + bottomY * 0.1);
        scene.treeSprites.push(spr);
      }

      // Place per-tile collision blockers
      for (const tile of pattern.tiles) {
        const gx = ox + tile.dx, gy = oy + tile.dy;
        const wx = gx * t + t / 2;
        const wy = gy * t + t / 2;

        const blocker = scene.add.zone(wx, wy, t, t);
        scene.physics.add.existing(blocker, true);
        (blocker.body as Phaser.Physics.Arcade.StaticBody).setSize(t, t);
        (blocker.body as Phaser.Physics.Arcade.StaticBody).position.set(wx - t / 2, wy - t / 2);
        scene.wallGroup.add(blocker);

        scene.pathing.syncWallTile(gx, gy, true);
      }
      placed++;
    }
  }

  /**
   * Render a tree / infected-plant cluster from individual per-tile PNG
   * sprites instead of one baked cluster image. Driven by a biome-specific
   * ClusterConfig — forest trees and infected plants pass independent
   * configs (densities, scale targets, tints, jitter) but share this loop.
   */
  private placePngCluster(
    pattern: ClusterPattern,
    ox: number,
    oy: number,
    t: number,
    rng: () => number,
    cfg: ClusterConfig,
  ): void {
    const scene = this.scene;
    for (const tile of pattern.tiles) {
      const gx = ox + tile.dx, gy = oy + tile.dy;
      const tileCx = gx * t + t / 2;
      const tileCy = gy * t + t * cfg.trunkYFraction;
      const count = cfg.perTileBase + (rng() < cfg.perTileExtraChance ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const jx = (rng() - 0.5) * t * cfg.jitterXFraction;
        const jy = (rng() - 0.5) * t * cfg.jitterYFraction;
        const variant = Math.floor(rng() * cfg.pngCount);
        const key = cfg.pngKey(variant)!;
        const pngH = (scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement).height || 1;
        const baseScale = cfg.targetWorldHeight / pngH;
        const scale = baseScale * (1 - cfg.scaleJitter + rng() * cfg.scaleJitter * 2);
        const spriteX = tileCx + jx;
        const spriteY = tileCy + jy;
        const spr = scene.add.sprite(spriteX, spriteY, key)
          .setOrigin(0.5, 1.0)
          .setScale(scale)
          .setDepth(100 + spriteY * 0.1);
        if (rng() > 0.5) spr.setFlipX(true);
        const tint = cfg.tints[Math.floor(rng() * cfg.tints.length)];
        if (tint !== 0xffffff) spr.setTint(tint);
        (spr as any)._gx = gx;
        (spr as any)._gy = gy;
        scene.treeSprites.push(spr);
      }
    }
  }

  /**
   * Castle floor spikes — same deterministic chunk generator as trees,
   * but spikes block enemy pathing only (grid value 6) without joining
   * wallGroup, so the player can walk through and take damage.
   */
  placeSpikesInChunk(cx: number, cy: number) {
    const scene = this.scene;
    const chunkKey = `${cx},${cy}`;
    if (scene.spikeChunksGenerated.has(chunkKey)) return;
    scene.spikeChunksGenerated.add(chunkKey);

    const t = CFG.tile;
    const cs = CFG.chunkSize;
    const spikesPerChunk = 4; // a touch denser than tree clusters
    const maxAttempts = spikesPerChunk * 6;

    // Independent seed from trees so swapping biomes doesn't reuse layouts.
    let seed = ((scene.treeSeed * 2654435761 + cx * 73856093 + cy * 19349669 + 31337) >>> 0) || 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    const ptx = Math.floor(scene.player.x / t);
    const pty = Math.floor(scene.player.y / t);
    const nearSpawn = Math.abs(cx * cs) < scene.spawnDist + cs && Math.abs(cy * cs) < scene.spawnDist + cs;

    const chunkTileX = cx * cs;
    const chunkTileY = cy * cs;

    let placed = 0;
    let attempts = 0;
    while (placed < spikesPerChunk && attempts < maxAttempts) {
      attempts++;
      const pattern = SPIKE_PATTERNS[Math.floor(rng() * SPIKE_PATTERNS.length)];
      const ox = chunkTileX + Math.floor(rng() * (cs - pattern.w));
      const oy = chunkTileY + Math.floor(rng() * (cs - pattern.h));

      // Don't place too close to player spawn
      if (Math.abs(ox) < 3 && Math.abs(oy) < 3) continue;

      // All target tiles must be empty AND not adjacent to player spawn
      let blocked = false;
      for (const tile of pattern.tiles) {
        const gx = ox + tile.dx, gy = oy + tile.dy;
        if (gridGet(scene.grid, gx, gy) !== 0) { blocked = true; break; }
        if (Math.abs(gx - ptx) <= 1 && Math.abs(gy - pty) <= 1) { blocked = true; break; }
      }
      if (blocked) continue;

      // Tentatively mark as obstacles (grid value 6 = spike)
      for (const tile of pattern.tiles) {
        gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 6);
      }

      // Don't strangle pathing near spawn — same check trees use.
      if (nearSpawn && !canReachFromSpawnDirections(scene.grid, ptx, pty, scene.spawnDist, 3)) {
        for (const tile of pattern.tiles) {
          gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 0);
        }
        continue;
      }

      // Per-tile spike sprite (no wallGroup → player walks through). Each
      // tile within a cluster picks its own jitter variant so a 3-tile
      // strip doesn't look stamped.
      for (const tile of pattern.tiles) {
        const gx = ox + tile.dx, gy = oy + tile.dy;
        const wx = gx * t + t / 2;
        const wy = gy * t + t / 2;
        const variant = Math.floor(rng() * SPIKE_VARIANT_COUNT);
        const spr = scene.add.image(wx, wy, `castle_spikes_${variant}`).setDepth(100 + wy * 0.1);
        scene.spikeSprites.push(spr);
      }
      placed++;
    }
  }
}
