import Phaser from 'phaser';
import { CFG } from '../config';
import {
  createGroundChunk,
  TREE_PATTERNS,
  SPIKE_PATTERNS,
  SPIKE_VARIANT_COUNT,
  CACTUS_VARIANT_COUNT,
  TEMPLE_BLOCK_VARIANT_COUNT,
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
        const terrainKey = scene.biome === 'desert' ? `${scene.biome}_${scene.levelId}` : scene.biome;
        const texKey = `gnd_chunk_${terrainKey}_${cx + dx}_${cy + dy}`;
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
      if (scene.biome === 'desert') {
        this.placeCactusInChunk(ccx, ccy);
        if (scene.levelId === 7) this.placeQuicksandInChunk(ccx, ccy);
        if (scene.levelId === 8) this.placeTempleBlocksInChunk(ccx, ccy);
      }
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
      // Cluster tiles are path blockers, so leaving a tile without a sprite
      // would create an invisible wall. Floor of 1 guards against any config
      // that sums to less than 1 sprite per tile.
      const count = Math.max(1, cfg.perTileBase + (rng() < cfg.perTileExtraChance ? 1 : 0));
      for (let i = 0; i < count; i++) {
        const jx = (rng() - 0.5) * t * cfg.jitterXFraction;
        const jy = (rng() - 0.5) * t * cfg.jitterYFraction;
        const variant = Math.floor(rng() * cfg.pngCount);
        const key = cfg.pngKey(variant)!;
        const pngH = (scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement).height || 1;
        const variantScale = cfg.variantScales?.[variant] ?? 1;
        const baseScale = (cfg.targetWorldHeight / pngH) * variantScale;
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

  destroyDesertObstacleTile(gx: number, gy: number) {
    const scene = this.scene;
    const v = gridGet(scene.grid, gx, gy);
    if (v !== 7 && v !== 9) return;
    const t = CFG.tile;
    gridSet(scene.grid, gx, gy, 0);
    scene.pathing.syncWallTile(gx, gy, false);
    const wx = gx * t + t / 2;
    const wy = gy * t + t / 2;
    for (const child of scene.wallGroup.getChildren()) {
      if (Math.abs((child as any).x - wx) < 2 && Math.abs((child as any).y - wy) < 2) {
        child.destroy();
        break;
      }
    }
    const sprites = v === 7 ? scene.cactusSprites : scene.templeBlockSprites;
    for (let i = sprites.length - 1; i >= 0; i--) {
      const spr = sprites[i] as Phaser.GameObjects.Image & { _gx?: number; _gy?: number };
      if (spr._gx === gx && spr._gy === gy) {
        spr.destroy();
        sprites.splice(i, 1);
      }
    }
    scene.gridVersion++;
    scene._wallCheckCache.clear();
    scene.pathing.rebuildGapBlockers();
  }

  placeCactusInChunk(cx: number, cy: number) {
    const scene = this.scene;
    const chunkKey = `${cx},${cy}`;
    if (scene.cactusChunksGenerated.has(chunkKey)) return;
    scene.cactusChunksGenerated.add(chunkKey);

    const t = CFG.tile;
    const cs = CFG.chunkSize;
    const chunkTileX = cx * cs;
    const chunkTileY = cy * cs;
    const clustersPerChunk = scene.levelId === 6 ? 8 : scene.levelId === 8 ? 1 : 2;
    const maxAttempts = clustersPerChunk * 8;
    let seed = ((scene.treeSeed * 2246822519 + cx * 73856093 + cy * 19349669 + 7001) >>> 0) || 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ptx = Math.floor(scene.player.x / t);
    const pty = Math.floor(scene.player.y / t);
    const nearSpawn = Math.abs(cx * cs) < scene.spawnDist + cs && Math.abs(cy * cs) < scene.spawnDist + cs;
    const makeCactusBlobPattern = (): ClusterPattern => {
      for (let shapeAttempt = 0; shapeAttempt < 16; shapeAttempt++) {
        const targetTiles = 3 + Math.floor(rng() * 4);
        const tiles = [{ dx: 0, dy: 0 }];
        const seen = new Set(['0,0']);
        let guard = 0;
        while (tiles.length < targetTiles && guard < targetTiles * 14) {
          guard++;
          const base = tiles[Math.floor(rng() * tiles.length)];
          const dir = Math.floor(rng() * 4);
          const dx = base.dx + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
          const dy = base.dy + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
          const key = `${dx},${dy}`;
          if (seen.has(key)) continue;
          const nextMinX = Math.min(dx, ...tiles.map(tile => tile.dx));
          const nextMaxX = Math.max(dx, ...tiles.map(tile => tile.dx));
          const nextMinY = Math.min(dy, ...tiles.map(tile => tile.dy));
          const nextMaxY = Math.max(dy, ...tiles.map(tile => tile.dy));
          if (nextMaxX - nextMinX > 2 || nextMaxY - nextMinY > 2) continue;
          seen.add(key);
          tiles.push({ dx, dy });
        }
        const minX = Math.min(...tiles.map(tile => tile.dx));
        const minY = Math.min(...tiles.map(tile => tile.dy));
        const normalized = tiles.map(tile => ({ dx: tile.dx - minX, dy: tile.dy - minY }));
        const w = Math.max(...normalized.map(tile => tile.dx)) + 1;
        const h = Math.max(...normalized.map(tile => tile.dy)) + 1;
        const isLine = w === 1 || h === 1;
        const isFilledRect = normalized.length === w * h;
        if (isLine || isFilledRect) continue;
        const tileSet = new Set(normalized.map(tile => `${tile.dx},${tile.dy}`));
        const filled = normalized.slice();
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (tileSet.has(`${x},${y}`)) continue;
            const up = y > 0 && tileSet.has(`${x},${y - 1}`);
            const dn = y < h - 1 && tileSet.has(`${x},${y + 1}`);
            const lf = x > 0 && tileSet.has(`${x - 1},${y}`);
            const rt = x < w - 1 && tileSet.has(`${x + 1},${y}`);
            if (up && dn && lf && rt) filled.push({ dx: x, dy: y });
          }
        }
        return { tiles: filled, w, h };
      }
      return { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }], w: 2, h: 2 };
    };

    let placed = 0;
    let attempts = 0;
    while (placed < clustersPerChunk && attempts < maxAttempts) {
      attempts++;
      const pattern = makeCactusBlobPattern();
      const ox = chunkTileX + Math.floor(rng() * (cs - pattern.w));
      const oy = chunkTileY + Math.floor(rng() * (cs - pattern.h));
      if (Math.abs(ox) < 4 && Math.abs(oy) < 4) continue;
      let blocked = false;
      for (const tile of pattern.tiles) {
        const gx = ox + tile.dx, gy = oy + tile.dy;
        if (gridGet(scene.grid, gx, gy) !== 0) { blocked = true; break; }
        if (Math.abs(gx - ptx) <= 1 && Math.abs(gy - pty) <= 1) { blocked = true; break; }
      }
      if (blocked) continue;
      for (const tile of pattern.tiles) gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 7);
      if (nearSpawn && !canReachFromSpawnDirections(scene.grid, ptx, pty, scene.spawnDist, 3)) {
        for (const tile of pattern.tiles) gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 0);
        continue;
      }
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
        const variant = Math.floor(rng() * CACTUS_VARIANT_COUNT);
        const spr = scene.add.image(wx, wy + t * 0.1, `desert_cactus_${variant}`)
          .setDepth(100 + wy * 0.1);
        (spr as any)._gx = gx;
        (spr as any)._gy = gy;
        scene.cactusSprites.push(spr);
      }
      placed++;
    }
  }

  placeQuicksandInChunk(cx: number, cy: number) {
    const scene = this.scene;
    const chunkKey = `${cx},${cy}`;
    if (scene.quicksandChunksGenerated.has(chunkKey)) return;
    scene.quicksandChunksGenerated.add(chunkKey);

    const t = CFG.tile;
    const cs = CFG.chunkSize;
    const chunkTileX = cx * cs;
    const chunkTileY = cy * cs;
    const poolsPerChunk = 2;
    let seed = ((scene.treeSeed * 1103515245 + cx * 73856093 + cy * 19349669 + 8803) >>> 0) || 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ptx = Math.floor(scene.player.x / t);
    const pty = Math.floor(scene.player.y / t);
    const nearSpawn = Math.abs(cx * cs) < scene.spawnDist + cs && Math.abs(cy * cs) < scene.spawnDist + cs;
    let placed = 0;
    let attempts = 0;

    const makeQuicksandPattern = (): ClusterPattern => {
      for (let shapeAttempt = 0; shapeAttempt < 16; shapeAttempt++) {
        const targetTiles = 5 + Math.floor(rng() * 4);
        const tiles = [{ dx: 0, dy: 0 }];
        const seen = new Set(['0,0']);
        let guard = 0;
        while (tiles.length < targetTiles && guard < targetTiles * 14) {
          guard++;
          const base = tiles[Math.floor(rng() * tiles.length)];
          const dir = Math.floor(rng() * 4);
          const dx = base.dx + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
          const dy = base.dy + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
          const key = `${dx},${dy}`;
          if (seen.has(key)) continue;
          const nextMinX = Math.min(dx, ...tiles.map(tile => tile.dx));
          const nextMaxX = Math.max(dx, ...tiles.map(tile => tile.dx));
          const nextMinY = Math.min(dy, ...tiles.map(tile => tile.dy));
          const nextMaxY = Math.max(dy, ...tiles.map(tile => tile.dy));
          if (nextMaxX - nextMinX > 3 || nextMaxY - nextMinY > 3) continue;
          seen.add(key);
          tiles.push({ dx, dy });
        }

        const minX = Math.min(...tiles.map(tile => tile.dx));
        const minY = Math.min(...tiles.map(tile => tile.dy));
        const normalized = tiles.map(tile => ({ dx: tile.dx - minX, dy: tile.dy - minY }));
        const w = Math.max(...normalized.map(tile => tile.dx)) + 1;
        const h = Math.max(...normalized.map(tile => tile.dy)) + 1;
        const isLine = w === 1 || h === 1;
        const isFilledRect = normalized.length === w * h;
        if (!isLine && !isFilledRect) return { tiles: normalized, w, h };
      }
      return {
        tiles: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 1, dy: 2 }],
        w: 3,
        h: 3,
      };
    };

    let poolIndex = 0;
    const drawPool = (tiles: { dx: number; dy: number }[], ox: number, oy: number) => {
      let minDx = Infinity, maxDx = -Infinity, minDy = Infinity, maxDy = -Infinity;
      for (const tile of tiles) {
        minDx = Math.min(minDx, tile.dx);
        maxDx = Math.max(maxDx, tile.dx);
        minDy = Math.min(minDy, tile.dy);
        maxDy = Math.max(maxDy, tile.dy);
      }
      const pad = t * 0.4;
      const texW = Math.ceil((maxDx - minDx + 1) * t + pad * 2);
      const texH = Math.ceil((maxDy - minDy + 1) * t + pad * 2);
      const worldCx = (ox + (minDx + maxDx + 1) / 2) * t;
      const worldCy = (oy + (minDy + maxDy + 1) / 2) * t;
      const tileShapes = tiles.map(tile => ({
        tcx: (tile.dx - minDx + 0.5) * t + pad,
        tcy: (tile.dy - minDy + 0.5) * t + pad,
        w: t * (1.26 + rng() * 0.2),
        h: t * (1.26 + rng() * 0.2),
        r: t * (0.32 + rng() * 0.14),
        jx: (rng() - 0.5) * t * 0.18,
        jy: (rng() - 0.5) * t * 0.18,
      }));
      const rimBw = 2.5;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xa98552, 1);
      for (const s of tileShapes) {
        const rw = s.w + rimBw * 2;
        const rh = s.h + rimBw * 2;
        g.fillRoundedRect(s.tcx - rw / 2 + s.jx, s.tcy - rh / 2 + s.jy, rw, rh, s.r + rimBw);
      }
      g.fillStyle(0x97744a, 1);
      for (const s of tileShapes) {
        g.fillRoundedRect(s.tcx - s.w / 2 + s.jx, s.tcy - s.h / 2 + s.jy, s.w, s.h, s.r);
      }
      g.lineStyle(1, 0x6f4f2a, 0.4);
      for (const tile of tiles) {
        const tcx = (tile.dx - minDx + 0.5) * t + pad;
        const tcy = (tile.dy - minDy + 0.5) * t + pad;
        const x = tcx + (rng() - 0.5) * t * 0.36;
        const y = tcy + (rng() - 0.5) * t * 0.28;
        g.lineBetween(x - t * (0.12 + rng() * 0.14), y, x + t * (0.12 + rng() * 0.14), y + (rng() - 0.5) * t * 0.08);
      }

      const texKey = `qs_${cx}_${cy}_${poolIndex++}`;
      if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
      g.generateTexture(texKey, texW, texH);
      g.destroy();
      const img = scene.add.image(worldCx, worldCy, texKey).setOrigin(0.5).setDepth(1);
      scene.quicksandTextureKeys.push(texKey);

      const ripple = scene.add.graphics().setDepth(2);
      ripple.lineStyle(1, 0xd8b878, 0.45);
      for (const tile of tiles) {
        if (rng() > 0.65) continue;
        const tcx = (ox + tile.dx + 0.5) * t;
        const tcy = (oy + tile.dy + 0.5) * t;
        const wx = tcx + (rng() - 0.5) * t * 0.32;
        const wy = tcy + (rng() - 0.5) * t * 0.24;
        ripple.strokeEllipse(wx, wy, t * (0.24 + rng() * 0.12), t * (0.1 + rng() * 0.06));
      }
      scene.tweens.add({
        targets: ripple,
        alpha: { from: 0.45, to: 0.18 },
        duration: 1400 + Math.floor(rng() * 500),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });

      scene.quicksandSprites.push(img, ripple);
    };

    while (placed < poolsPerChunk && attempts < poolsPerChunk * 8) {
      attempts++;
      const pattern = makeQuicksandPattern();
      const ox = chunkTileX + Math.floor(rng() * (cs - pattern.w));
      const oy = chunkTileY + Math.floor(rng() * (cs - pattern.h));
      if (Math.abs(ox) < 4 && Math.abs(oy) < 4) continue;
      const tiles = pattern.tiles;
      let blocked = false;
      for (const tile of tiles) {
        const gx = ox + tile.dx, gy = oy + tile.dy;
        if (gridGet(scene.grid, gx, gy) !== 0) { blocked = true; break; }
        if (Math.abs(gx - ptx) <= 1 && Math.abs(gy - pty) <= 1) { blocked = true; break; }
      }
      if (blocked) continue;
      for (const tile of tiles) gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 8);
      if (nearSpawn && !canReachFromSpawnDirections(scene.grid, ptx, pty, scene.spawnDist, 3)) {
        for (const tile of tiles) gridSet(scene.grid, ox + tile.dx, oy + tile.dy, 0);
        continue;
      }
      drawPool(tiles, ox, oy);
      placed++;
    }
  }

  placeTempleBlocksInChunk(cx: number, cy: number) {
    const scene = this.scene;
    const chunkKey = `${cx},${cy}`;
    if (scene.templeChunksGenerated.has(chunkKey)) return;
    scene.templeChunksGenerated.add(chunkKey);

    const t = CFG.tile;
    const cs = CFG.chunkSize;
    const chunkTileX = cx * cs;
    const chunkTileY = cy * cs;
    let seed = ((scene.treeSeed * 747796405 + cx * 73856093 + cy * 19349669 + 9919) >>> 0) || 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ptx = Math.floor(scene.player.x / t);
    const pty = Math.floor(scene.player.y / t);
    const nearSpawn = Math.abs(cx * cs) < scene.spawnDist + cs && Math.abs(cy * cs) < scene.spawnDist + cs;
    const candidates: { gx: number; gy: number }[] = [];
    for (let ty = 1; ty < cs - 1; ty++) {
      for (let tx = 1; tx < cs - 1; tx++) {
        const gx = chunkTileX + tx;
        const gy = chunkTileY + ty;
        if (Math.abs(gx) < 4 && Math.abs(gy) < 4) continue;
        const corridor = ((gx + Math.floor(gy / 2)) % 6 === 0) || ((gy + Math.floor(gx / 3)) % 7 === 0);
        if (corridor && rng() < 0.72) candidates.push({ gx, gy });
      }
    }
    let placed = 0;
    for (const { gx, gy } of candidates) {
      if (placed >= 34) break;
      if (gridGet(scene.grid, gx, gy) !== 0) continue;
      if (Math.abs(gx - ptx) <= 1 && Math.abs(gy - pty) <= 1) continue;
      gridSet(scene.grid, gx, gy, 9);
      if (nearSpawn && !canReachFromSpawnDirections(scene.grid, ptx, pty, scene.spawnDist, 3)) {
        gridSet(scene.grid, gx, gy, 0);
        continue;
      }
      const wx = gx * t + t / 2;
      const wy = gy * t + t / 2;
      const blocker = scene.add.zone(wx, wy, t, t);
      scene.physics.add.existing(blocker, true);
      (blocker.body as Phaser.Physics.Arcade.StaticBody).setSize(t, t);
      (blocker.body as Phaser.Physics.Arcade.StaticBody).position.set(wx - t / 2, wy - t / 2);
      scene.wallGroup.add(blocker);
      scene.pathing.syncWallTile(gx, gy, true);
      const spr = scene.add.image(wx, wy, `temple_block_${Math.floor(rng() * TEMPLE_BLOCK_VARIANT_COUNT)}`)
        .setDepth(100 + wy * 0.1);
      (spr as any)._gx = gx;
      (spr as any)._gy = gy;
      scene.templeBlockSprites.push(spr);
      placed++;
    }
  }
}
