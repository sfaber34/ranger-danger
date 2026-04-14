import Phaser from 'phaser';
import {
  LEVELS, LevelDef, Difficulty, DIFFICULTY_ORDER, DIFFICULTY_LABELS,
  MEDAL_COLORS, BIOME_COLORS, loadMedals, totalMedals, MedalStore
} from '../levels';

export class LevelSelectScene extends Phaser.Scene {
  medalStore!: MedalStore;
  medalCount = 0;
  selectedLevel: LevelDef | null = null;
  selectedDiff: Difficulty | null = null;
  panel: Phaser.GameObjects.Container | null = null;
  panelExtras: Phaser.GameObjects.GameObject[] = [];
  tooltip: Phaser.GameObjects.Container | null = null;
  tooltipTimer?: Phaser.Time.TimerEvent;
  diffButtons: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; diff: Difficulty }[] = [];

  constructor() { super('LevelSelect'); }

  create() {
    this.medalStore = loadMedals();
    this.medalCount = totalMedals(this.medalStore);
    this.selectedLevel = null;
    this.selectedDiff = null;
    this.panel = null;
    this.tooltip = null;

    const W = this.scale.width;
    const H = this.scale.height;

    // Map background image — stretched to fill canvas
    const bg = this.add.image(W / 2, H / 2, 'level_map_bg');
    bg.setDisplaySize(W, H);

    // Slight dark overlay so nodes/text pop
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.15);

    this.drawPaths();
    this.drawNodes();

    // Title banner
    const bannerG = this.add.graphics();
    bannerG.fillStyle(0x11172a, 0.85);
    bannerG.fillRoundedRect(W / 2 - 160, 6, 320, 36, 8);
    bannerG.lineStyle(1, 0x2a3760, 0.8);
    bannerG.strokeRoundedRect(W / 2 - 160, 6, 320, 36, 8);
    this.add.text(W / 2, 24, 'SELECT YOUR MISSION', {
      fontFamily: 'monospace', fontSize: '18px', color: '#7cc4ff',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(2);

    // Medal counter — top right
    const medalBg = this.add.graphics();
    medalBg.fillStyle(0x11172a, 0.85);
    medalBg.fillRoundedRect(W - 170, 6, 158, 36, 8);
    medalBg.lineStyle(1, 0x2a3760, 0.8);
    medalBg.strokeRoundedRect(W - 170, 6, 158, 36, 8);
    this.add.text(W - 91, 24, `Medals: ${this.medalCount} / ${LEVELS.length * 4}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffd84a',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(2);

    // Hide loading overlay
    this.game.events.emit('game-ready');
  }

  // ---- PATH LINES ----
  drawPaths() {
    const g = this.add.graphics().setDepth(1);
    const levelMap = new Map<number, LevelDef>();
    for (const l of LEVELS) levelMap.set(l.id, l);

    for (const level of LEVELS) {
      for (const targetId of level.connectsTo) {
        const target = levelMap.get(targetId);
        if (!target) continue;

        const unlocked = this.medalCount >= target.unlockCost;

        // Draw path with dark outline + lighter inner
        const dx = target.x - level.x;
        const dy = target.y - level.y;
        const dist = Math.hypot(dx, dy);
        const segments = Math.floor(dist / 10);

        for (let pass = 0; pass < 2; pass++) {
          if (pass === 0) {
            // Dark outline
            g.lineStyle(6, 0x000000, unlocked ? 0.7 : 0.3);
          } else {
            // Inner path
            g.lineStyle(3, unlocked ? 0x3a2a18 : 0x2a2018, unlocked ? 0.9 : 0.4);
          }
          for (let i = 0; i < segments; i++) {
            if (i % 2 !== 0) continue;
            const t0 = i / segments;
            const t1 = Math.min((i + 1) / segments, 1);
            g.lineBetween(
              level.x + dx * t0, level.y + dy * t0,
              level.x + dx * t1, level.y + dy * t1
            );
          }
        }
      }
    }
  }

  // ---- BIOME ICONS (drawn into the node circle) ----
  drawBiomeIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, biome: string) {
    switch (biome) {
      case 'grasslands':
        // Tree — trunk + canopy
        g.fillStyle(0x5a3a1a, 1);
        g.fillRect(cx - 2, cy - 1, 4, 8);
        g.fillStyle(0x3a8a2a, 1);
        g.fillCircle(cx, cy - 4, 6);
        g.fillStyle(0x4aaa3a, 1);
        g.fillCircle(cx - 1, cy - 5, 3);
        break;
      case 'desert':
        // Pyramid
        g.fillStyle(0xd4a84a, 1);
        g.fillTriangle(cx, cy - 7, cx - 8, cy + 5, cx + 8, cy + 5);
        g.lineStyle(1, 0xb8903a, 1);
        g.lineBetween(cx, cy - 7, cx + 8, cy + 5);
        g.fillStyle(0xc49a3a, 1);
        g.fillTriangle(cx, cy - 7, cx, cy + 5, cx + 8, cy + 5);
        break;
      case 'tundra':
        // Snowflake — 3 crossing lines with dots
        g.lineStyle(2, 0xc8e8ff, 1);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          g.lineBetween(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7,
                        cx - Math.cos(a) * 7, cy - Math.sin(a) * 7);
        }
        g.fillStyle(0xeaf4ff, 1);
        g.fillCircle(cx, cy, 2);
        break;
      case 'volcanic':
        // Flame
        g.fillStyle(0xd43a1a, 1);
        g.fillTriangle(cx, cy - 8, cx - 6, cy + 5, cx + 6, cy + 5);
        g.fillStyle(0xff8a2a, 1);
        g.fillTriangle(cx, cy - 5, cx - 4, cy + 4, cx + 4, cy + 4);
        g.fillStyle(0xffcc44, 1);
        g.fillTriangle(cx, cy - 2, cx - 2, cy + 3, cx + 2, cy + 3);
        break;
    }
  }

  // ---- LEVEL NODES ----
  drawNodes() {
    for (const level of LEVELS) {
      const unlocked = this.medalCount >= level.unlockCost;
      const biomeColor = BIOME_COLORS[level.biome];
      const medals = this.medalStore[String(level.id)];

      const R = 26; // main circle radius
      const cx = level.x, cy = level.y;

      const nodeG = this.add.graphics().setDepth(3);

      // Drop shadow
      nodeG.fillStyle(0x000000, 0.4);
      nodeG.fillCircle(cx + 2, cy + 2, R);

      if (unlocked) {
        // Outer dark ring
        nodeG.fillStyle(0x3a2a18, 1);
        nodeG.fillCircle(cx, cy, R + 2);
        // Parchment fill
        nodeG.fillStyle(0x6a5838, 1);
        nodeG.fillCircle(cx, cy, R);
        // Gold rim
        nodeG.lineStyle(2, 0xc8a86a, 0.9);
        nodeG.strokeCircle(cx, cy, R);
        // Inner lighter area for icon
        nodeG.fillStyle(0x7a6842, 1);
        nodeG.fillCircle(cx, cy - 3, 10);
      } else {
        nodeG.fillStyle(0x1a1614, 1);
        nodeG.fillCircle(cx, cy, R + 2);
        nodeG.fillStyle(0x2a2420, 1);
        nodeG.fillCircle(cx, cy, R);
        nodeG.lineStyle(1, 0x444444, 0.5);
        nodeG.strokeCircle(cx, cy, R);
      }

      // Biome icon or lock icon in upper part of circle
      const iconG = this.add.graphics().setDepth(4);
      if (unlocked) {
        this.drawBiomeIcon(iconG, cx, cy - 3, level.biome);
      } else {
        // Lock
        iconG.fillStyle(0x666666, 0.8);
        iconG.fillRoundedRect(cx - 6, cy - 2, 12, 9, 2);
        iconG.lineStyle(2, 0x666666, 0.8);
        iconG.beginPath();
        iconG.arc(cx, cy - 5, 5, Math.PI, 0, false);
        iconG.strokePath();
      }

      // Level name — bottom of circle
      this.add.text(cx, cy + 12, level.name, {
        fontFamily: 'monospace', fontSize: '7px',
        color: unlocked ? '#e8dcc8' : '#4a4030',
        stroke: '#000', strokeThickness: 1
      }).setOrigin(0.5).setDepth(4);

      // Medal dots — below circle
      const dotY = cy + R + 8;
      const dotSpacing = 11;
      const startX = cx - (dotSpacing * 1.5);
      const dotG = this.add.graphics().setDepth(4);
      for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
        const diff = DIFFICULTY_ORDER[i];
        const earned = medals?.[diff] ?? false;
        const mc = MEDAL_COLORS[diff];
        const dx = startX + i * dotSpacing;
        if (earned) {
          dotG.fillStyle(mc.fill, 0.3);
          dotG.fillCircle(dx, dotY, 5);
          dotG.fillStyle(mc.fill, 1);
          dotG.fillCircle(dx, dotY, 3.5);
          dotG.fillStyle(0xffffff, 0.3);
          dotG.fillCircle(dx - 1, dotY - 1, 1.5);
        } else {
          dotG.fillStyle(0x000000, 0.3);
          dotG.fillCircle(dx, dotY, 3);
          dotG.lineStyle(1, unlocked ? 0x7a6a52 : 0x444444, 0.4);
          dotG.strokeCircle(dx, dotY, 2.5);
        }
      }

      // Hit zone
      const hitZone = this.add.zone(cx, cy, R * 2.2, R * 2.2 + 16)
        .setInteractive({ useHandCursor: unlocked }).setDepth(5);

      hitZone.on('pointerdown', () => {
        if (!unlocked) {
          const needed = level.unlockCost - this.medalCount;
          this.showTooltip(cx, cy - R - 14, `Need ${needed} more medal${needed !== 1 ? 's' : ''}`);
          return;
        }
        if (!level.implemented) {
          this.showTooltip(cx, cy - R - 14, 'Coming Soon');
          return;
        }
        this.openDifficultyPanel(level);
      });

      // Hover glow
      if (unlocked) {
        const glowG = this.add.graphics().setAlpha(0).setDepth(2);
        glowG.lineStyle(2, 0xffd84a, 0.5);
        glowG.strokeCircle(cx, cy, R + 5);
        glowG.lineStyle(1, 0xffd84a, 0.2);
        glowG.strokeCircle(cx, cy, R + 9);

        hitZone.on('pointerover', () => {
          glowG.setAlpha(1);
          this.tweens.add({
            targets: glowG, alpha: 0.6, yoyo: true, repeat: -1, duration: 600
          });
        });
        hitZone.on('pointerout', () => {
          this.tweens.killTweensOf(glowG);
          glowG.setAlpha(0);
        });
      }
    }
  }

  // ---- TOOLTIP ----
  showTooltip(x: number, y: number, text: string) {
    if (this.tooltip) this.tooltip.destroy();
    if (this.tooltipTimer) this.tooltipTimer.destroy();

    const W = this.scale.width;
    // Clamp x to keep tooltip on screen
    const clampedX = Phaser.Math.Clamp(x, 80, W - 80);

    const bg = this.add.graphics();
    const t = this.add.text(0, 0, text, {
      fontFamily: 'monospace', fontSize: '11px', color: '#eee',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);

    const pw = t.width + 16, ph = 24;
    bg.fillStyle(0x11172a, 0.9);
    bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 6);
    bg.lineStyle(1, 0x2a3760, 0.8);
    bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 6);

    this.tooltip = this.add.container(clampedX, y, [bg, t]).setDepth(100);

    // Fade in
    this.tooltip.setAlpha(0);
    this.tweens.add({ targets: this.tooltip, alpha: 1, duration: 150 });

    this.tooltipTimer = this.time.delayedCall(2000, () => {
      if (this.tooltip) {
        this.tweens.add({
          targets: this.tooltip, alpha: 0, duration: 200,
          onComplete: () => { this.tooltip?.destroy(); this.tooltip = null; }
        });
      }
    });
  }

  // ---- DIFFICULTY PANEL ----
  openDifficultyPanel(level: LevelDef) {
    if (this.panel) this.panel.destroy();
    this.selectedLevel = level;
    this.selectedDiff = null;
    this.diffButtons = [];

    const W = this.scale.width;
    const H = this.scale.height;
    const pw = 300, ph = 360;
    const px = W / 2, py = H / 2;

    // Backdrop
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65)
      .setInteractive();

    // Panel box with double border
    const outerBox = this.add.graphics();
    outerBox.fillStyle(0x0d1220, 0.95);
    outerBox.fillRoundedRect(-pw / 2 - 3, -ph / 2 - 3, pw + 6, ph + 6, 10);
    outerBox.lineStyle(2, 0x4a3a1a, 0.8);
    outerBox.strokeRoundedRect(-pw / 2 - 3, -ph / 2 - 3, pw + 6, ph + 6, 10);

    const innerBox = this.add.graphics();
    innerBox.fillStyle(0x11172a, 0.95);
    innerBox.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
    innerBox.lineStyle(1, 0x2a3760, 0.8);
    innerBox.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);

    // Level name
    const biome = BIOME_COLORS[level.biome];
    const title = this.add.text(0, -ph / 2 + 28, level.name, {
      fontFamily: 'monospace', fontSize: '18px', color: '#7cc4ff',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);

    // Biome tag
    const tag = this.add.text(0, -ph / 2 + 52, biome.label.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '10px', color: biome.textHex,
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x2a3760, 0.6);
    divider.lineBetween(-pw / 2 + 20, -ph / 2 + 68, pw / 2 - 20, -ph / 2 + 68);

    // Difficulty buttons
    const medals = this.medalStore[String(level.id)];
    const btnStartY = -40;
    const btnH = 38;
    const btnW = 230;
    const items: Phaser.GameObjects.GameObject[] = [backdrop, outerBox, innerBox, title, tag, divider];

    for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
      const diff = DIFFICULTY_ORDER[i];
      const mc = MEDAL_COLORS[diff];
      const earned = medals?.[diff] ?? false;
      const by = btnStartY + i * (btnH + 6);

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x1a2540, 1);
      btnBg.fillRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, 6);
      btnBg.lineStyle(1, 0x2a3760, 0.8);
      btnBg.strokeRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, 6);

      // Invisible interactive rect on top
      const hitRect = this.add.rectangle(0, by, btnW, btnH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      const label = this.add.text(-btnW / 2 + 20, by, DIFFICULTY_LABELS[diff], {
        fontFamily: 'monospace', fontSize: '13px', color: '#ccd',
        stroke: '#000', strokeThickness: 1
      }).setOrigin(0, 0.5);

      // Green checkmark for completed difficulties (added to scene, not container)
      if (earned) {
        const chk = this.add.sprite(px + btnW / 2 - 24, py + by, 'ui_check')
          .setScale(1.2).setDepth(51);
        this.panelExtras.push(chk);
      }

      hitRect.on('pointerover', () => {
        btnBg.clear();
        btnBg.fillStyle(0x2a3760, 1);
        btnBg.fillRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, 6);
        btnBg.lineStyle(1, 0x4a5a8a, 0.8);
        btnBg.strokeRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, 6);
      });
      hitRect.on('pointerout', () => {
        const selected = this.selectedDiff === diff;
        btnBg.clear();
        btnBg.fillStyle(selected ? 0x2a3a60 : 0x1a2540, 1);
        btnBg.fillRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, 6);
        btnBg.lineStyle(1, selected ? 0x6a8acc : 0x2a3760, 0.8);
        btnBg.strokeRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, 6);
      });
      hitRect.on('pointerdown', () => {
        this.selectedDiff = diff;
        for (const btn of this.diffButtons) {
          const sel = btn.diff === diff;
          btn.bg.clear();
          btn.bg.fillStyle(sel ? 0x2a3a60 : 0x1a2540, 1);
          const bby = btnStartY + DIFFICULTY_ORDER.indexOf(btn.diff) * (btnH + 6);
          btn.bg.fillRoundedRect(-btnW / 2, bby - btnH / 2, btnW, btnH, 6);
          btn.bg.lineStyle(1, sel ? 0x6a8acc : 0x2a3760, 0.8);
          btn.bg.strokeRoundedRect(-btnW / 2, bby - btnH / 2, btnW, btnH, 6);
          btn.text.setColor(sel ? '#fff' : '#ccd');
        }
        this.updateStartButton();
      });

      this.diffButtons.push({ bg: btnBg, text: label, diff });
      items.push(btnBg, hitRect, label);
    }

    // START button
    this.startBtnY = ph / 2 - 52;
    this.startBtnG = this.add.graphics();
    this.startBtnG.fillStyle(0x1a2540, 1);
    this.startBtnG.fillRoundedRect(-60, this.startBtnY, 120, 36, 8);
    this.startBtnG.lineStyle(1, 0x2a3760, 0.8);
    this.startBtnG.strokeRoundedRect(-60, ph / 2 - 52, 120, 36, 8);
    this.startText = this.add.text(0, ph / 2 - 34, 'START', {
      fontFamily: 'monospace', fontSize: '15px', color: '#556',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    this.startHit = this.add.rectangle(0, ph / 2 - 34, 120, 36, 0x000000, 0);
    items.push(this.startBtnG, this.startText, this.startHit);

    // Close button
    const closeG = this.add.graphics();
    closeG.fillStyle(0x1a2540, 1);
    closeG.fillRoundedRect(pw / 2 - 32, -ph / 2 + 8, 24, 24, 4);
    closeG.lineStyle(1, 0x2a3760, 0.8);
    closeG.strokeRoundedRect(pw / 2 - 32, -ph / 2 + 8, 24, 24, 4);
    const closeX = this.add.text(pw / 2 - 20, -ph / 2 + 20, 'X', {
      fontFamily: 'monospace', fontSize: '12px', color: '#aab',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5);
    const closeHit = this.add.rectangle(pw / 2 - 20, -ph / 2 + 20, 28, 28, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => this.closeDifficultyPanel());
    closeHit.on('pointerover', () => {
      closeG.clear();
      closeG.fillStyle(0x3b4d84, 1);
      closeG.fillRoundedRect(pw / 2 - 32, -ph / 2 + 8, 24, 24, 4);
      closeG.lineStyle(1, 0x4a5a8a, 0.8);
      closeG.strokeRoundedRect(pw / 2 - 32, -ph / 2 + 8, 24, 24, 4);
    });
    closeHit.on('pointerout', () => {
      closeG.clear();
      closeG.fillStyle(0x1a2540, 1);
      closeG.fillRoundedRect(pw / 2 - 32, -ph / 2 + 8, 24, 24, 4);
      closeG.lineStyle(1, 0x2a3760, 0.8);
      closeG.strokeRoundedRect(pw / 2 - 32, -ph / 2 + 8, 24, 24, 4);
    });
    items.push(closeG, closeX, closeHit);

    this.panel = this.add.container(px, py, items).setDepth(50);

    // Fade in
    this.panel.setAlpha(0);
    this.tweens.add({ targets: this.panel, alpha: 1, duration: 200 });
  }

  startBtnG: Phaser.GameObjects.Graphics | null = null;
  startHit: Phaser.GameObjects.Rectangle | null = null;
  startText: Phaser.GameObjects.Text | null = null;
  startBtnY = 0; // top-left Y of the start button rect (panel-relative)

  updateStartButton() {
    if (!this.startBtnG || !this.startHit || !this.startText) return;
    const g = this.startBtnG;
    const text = this.startText;
    const hit = this.startHit;

    if (this.selectedDiff) {
      const by = this.startBtnY;
      g.clear();
      g.fillStyle(0x1e4a2e, 1);
      g.fillRoundedRect(-60, by, 120, 36, 8);
      g.lineStyle(2, 0x4ad96a, 0.9);
      g.strokeRoundedRect(-60, by, 120, 36, 8);
      text.setColor('#7cf29a');
      hit.setInteractive({ useHandCursor: true });
      hit.off('pointerdown');
      hit.on('pointerdown', () => this.startMission());
      hit.on('pointerover', () => {
        g.clear();
        g.fillStyle(0x2a6a3e, 1);
        g.fillRoundedRect(-60, by, 120, 36, 8);
        g.lineStyle(2, 0x6afa8a, 0.9);
        g.strokeRoundedRect(-60, by, 120, 36, 8);
      });
      hit.on('pointerout', () => {
        g.clear();
        g.fillStyle(0x1e4a2e, 1);
        g.fillRoundedRect(-60, by, 120, 36, 8);
        g.lineStyle(2, 0x4ad96a, 0.9);
        g.strokeRoundedRect(-60, by, 120, 36, 8);
      });
    }
  }

  closeDifficultyPanel() {
    if (this.panel) {
      this.tweens.add({
        targets: this.panel, alpha: 0, duration: 150,
        onComplete: () => { this.panel?.destroy(); this.panel = null; }
      });
    }
    for (const obj of this.panelExtras) obj.destroy();
    this.panelExtras = [];
    this.selectedLevel = null;
    this.selectedDiff = null;
    this.diffButtons = [];
    this.startBtnG = null;
    this.startText = null;
    this.startHit = null;
  }

  startMission() {
    if (!this.selectedLevel || !this.selectedDiff) return;
    this.scene.start('Game', {
      levelId: this.selectedLevel.id,
      difficulty: this.selectedDiff
    });
    this.scene.launch('UI', {
      levelId: this.selectedLevel.id,
      difficulty: this.selectedDiff
    });
  }
}
