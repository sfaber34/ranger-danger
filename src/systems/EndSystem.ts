import Phaser from 'phaser';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { CFG } from '../config';
import { Enemy } from '../entities/Enemy';
import { SFX } from '../audio/sfx';
import type { GameScene } from '../scenes/GameScene';

/**
 * End-of-level lifecycle: the post-boss-death loot collection window, the
 * win + lose screens, and (in endless mode) the next-cycle reset that
 * recycles wave state instead of dropping into the victory screen.
 */
export class EndSystem {
  constructor(private scene: GameScene) {}

  checkEndConditions() {
    const scene = this.scene;
    // Endless double-boss events keep the secondary in midBoss. The
    // cycle is over only when BOTH are dying/inactive — guard for that
    // before falling through to the (single-boss) win path.
    if (scene.difficulty === 'endless' && scene.bossState.bossSpawned) {
      const primaryDone = !scene.bossState.boss || scene.bossState.boss.dying || !scene.bossState.boss.active;
      const secondaryDone = !scene.bossState.midBoss || scene.bossState.midBoss === scene.bossState.boss || scene.bossState.midBoss.dying || !scene.bossState.midBoss.active;
      if (!primaryDone || !secondaryDone) return;
    }
    if (scene.bossState.bossSpawned && (!scene.bossState.boss || scene.bossState.boss.dying || !scene.bossState.boss.active)) {
      if (scene.difficulty === 'endless') {
        if (scene.bossState.endlessResetUntil === 0) {
          getEvents(scene.game.events).emit('boss-died');
          scene.bossState.startEndlessReset(scene.vTime, 8000);
          // Per-boss-cleared difficulty ramp. Compounds forever, no
          // cap — paired with the per-cycle boss HP scaling already
          // baked into pickEndlessBosses(), this is what makes deep
          // runs increasingly nasty.
          scene.enemyHpMult *= 1.08;
          scene.enemyDmgMult *= 1.05;
          scene.levelMinInterval = Math.max(200, Math.round(scene.levelMinInterval * 0.95));
          // Don't let the active spawnInterval lag the new floor.
          scene.spawnInterval = Math.min(scene.spawnInterval, scene.levelMinInterval * 4);
          scene.countdownColor = '#7cf29a';
          const survivors = (scene.enemies.getChildren() as Enemy[])
            .filter((e) => e && e.active && !e.dying);
          for (let i = 0; i < survivors.length; i++) {
            const e = survivors[i];
            scene.time.delayedCall(i * 25, () => {
              if (e.active && !e.dying) e.hurt(9999);
            });
          }
        }
        const remaining = Math.max(0, Math.ceil((scene.bossState.endlessResetUntil - scene.vTime) / 1000));
        scene.hud.syncCountdown(`Boss ${scene.bossState.endlessBossesCleared} cleared! Next cycle in ${remaining}s`, '#7cf29a');
        if (scene.vTime >= scene.bossState.endlessResetUntil) {
          this.startNextEndlessCycle();
        } else if (scene.coins.countActive() === 0 && this.scene.endState.winCollectedAt === 0) {
          this.scene.endState.winCollectedAt = scene.vTime;
        } else if (this.scene.endState.winCollectedAt > 0 && scene.vTime >= this.scene.endState.winCollectedAt + 2000) {
          this.startNextEndlessCycle();
        }
        return;
      }
      // Castle mid-boss (queen) death: don't win — trigger next phase
      if (scene.biome === 'castle' && scene.bossState.castlePhase < 3) {
        if (!scene.bossState.midBossDefeated && scene.bossState.castlePhase === 1) {
          scene.bossState.recordMidBossDefeated();
          getEvents(scene.game.events).emit('boss-died');
          for (const e of scene.enemies.getChildren() as Enemy[]) {
            if (!e.dying && e.active) e.hurt(9999);
          }
        }
        return;
      }
      if (this.scene.endState.winDelayUntil === 0) {
        getEvents(scene.game.events).emit('boss-died');
        this.scene.endState.winDelayUntil = scene.vTime + 12000;
        scene.countdownColor = '#7cf29a';
        const survivors = (scene.enemies.getChildren() as Enemy[])
          .filter((e) => e && e.active && !e.dying);
        for (let i = 0; i < survivors.length; i++) {
          const e = survivors[i];
          scene.time.delayedCall(i * 25, () => {
            if (e.active && !e.dying) e.hurt(9999);
          });
        }
      }
      const remaining = Math.max(0, Math.ceil((this.scene.endState.winDelayUntil - scene.vTime) / 1000));
      scene.hud.syncCountdown(`VICTORY! Collect your loot! ${remaining}s`, '#7cf29a');
      if (scene.vTime >= this.scene.endState.winDelayUntil) {
        this.win();
      } else if (scene.coins.countActive() === 0 && this.scene.endState.winCollectedAt === 0) {
        this.scene.endState.winCollectedAt = scene.vTime;
      } else if (this.scene.endState.winCollectedAt > 0 && scene.vTime >= this.scene.endState.winCollectedAt + 2000) {
        this.win();
      }
    }
  }

  /** Reset wave state for the next endless-mode cycle. */
  startNextEndlessCycle() {
    const scene = this.scene;
    scene.bossState.finishEndlessReset();
    scene.waveState.enterNextEndlessCycle(scene.vTime, CFG.spawn.waveBreak);
    this.scene.endState.winCollectedAt = 0;
    scene.hud.pushHud();
  }

  lose() {
    const scene = this.scene;
    if (!scene.endState.enterDying()) return;

    scene.player.setVelocity(0, 0);
    (scene.player.body as Phaser.Physics.Arcade.Body).enable = false;
    scene.physics.pause();

    scene.tweens.killTweensOf(scene.player);

    scene.cameras.main.shake(300, 0.012);

    const deathX = scene.player.x;
    const deathY = scene.player.y;

    scene.player.setVisible(false);
    scene.player.bow.setVisible(false);

    const flash = scene.add.circle(deathX, deathY, 30, 0xffffff, 0.95).setDepth(19);
    scene.tweens.add({
      targets: flash,
      scale: 2.5,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy()
    });

    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const d = Phaser.Math.Between(28, 60);
      const col = [0xff4040, 0xff8060, 0x4a90e2, 0xf2c79a, 0xffffff, 0xffcc40][i % 6];
      const sz = Phaser.Math.Between(3, 6);
      const p = scene.add.rectangle(deathX, deathY, sz, sz, col, 1).setDepth(20);
      scene.tweens.add({
        targets: p,
        x: deathX + Math.cos(a) * d,
        y: deathY + Math.sin(a) * d - Phaser.Math.Between(5, 20),
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(500, 800),
        ease: 'Cubic.Out',
        onComplete: () => p.destroy()
      });
    }

    scene.cameras.main.zoomTo(1.3 * scene.sf, 800);

    setTimeout(() => {
      if (!scene.scene.isActive()) return;

      const grave = scene.add.container(deathX, deathY + 4).setDepth(10);
      const vertical = scene.add.rectangle(0, 0, 4, 18, 0x6a6a78)
        .setStrokeStyle(1, 0x3e4654);
      const horizontal = scene.add.rectangle(0, -5, 12, 4, 0x6a6a78)
        .setStrokeStyle(1, 0x3e4654);
      const dirt = scene.add.ellipse(0, 10, 18, 6, 0x3e2310);
      grave.add([dirt, vertical, horizontal]);

      grave.setScale(0.3);
      grave.y += 14;
      scene.tweens.add({
        targets: grave,
        y: deathY + 4,
        scale: 1,
        duration: 400,
        ease: 'Back.Out'
      });
    }, 900);

    SFX.fadeOutBgm(2500);

    setTimeout(() => {
      if (!scene.scene.isActive()) return;
      scene.endState.enterGameOver();
      scene.physics.pause();
      SFX.play('gameOver');
      // Stats — snapshot the cumulative wave + run duration. Mirrors
      // bossesKilled from bossState for the death panel.
      scene.runStats.wavesCleared = scene.waveState.wave;
      scene.runStats.timeSurvived = scene.vTime;
      scene.runStats.bossesKilled = scene.bossState.endlessBossesCleared;
      const payload = {
        win: false, name: 'Ranger',
        kills: scene.player.kills, money: scene.player.money,
        runStats: scene.difficulty === 'endless' ? scene.runStats : undefined,
      };
      getRegistry(scene.game).set('gameEndState', payload);
      getEvents(scene.game.events).emit('game-end', payload);
    }, 3500);
  }

  win() {
    const scene = this.scene;
    if (!scene.endState.enterGameOver()) return;
    scene.physics.pause();
    SFX.fadeOutBgm(1500);
    SFX.play('victory');
    const payload = { win: true, name: 'Ranger', kills: scene.player.kills, money: scene.player.money };
    getRegistry(scene.game).set('gameEndState', payload);
    getEvents(scene.game.events).emit('game-end', payload);
  }
}
