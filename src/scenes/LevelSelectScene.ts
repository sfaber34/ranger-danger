import Phaser from 'phaser';
import { CFG } from '../config';
import { SFX } from '../audio/sfx';
import { computeViewport } from '../viewport';
import {
  LEVELS, LevelDef, Difficulty, DIFFICULTY_ORDER, DIFFICULTY_LABELS,
  MEDAL_COLORS, BIOME_COLORS, loadMedals, totalMedals, isLevelUnlocked, MedalStore
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

  /** Scale factor: all base-resolution (960×640) coordinates get multiplied by this */
  private sf = 1;
  /** Scale a value from base resolution to native */
  private p(v: number) { return v * this.sf; }
  /** Build a font-size string at the scaled resolution */
  private fs(px: number) { return `${Math.round(px * this.sf)}px`; }

  constructor() { super('LevelSelect'); }

  create() {
    // Compute native display size and decoupled scales (desktop stays identical;
    // mobile fills the device viewport with its own camera zoom + UI scale).
    const vp = computeViewport();

    // Level select is locked to the 3:2 aspect of CFG.width × CFG.height. The
    // level-node coordinates and the map background were painted in that space;
    // stretching the canvas to a phone's portrait/landscape aspect would
    // distort the background and desync nodes from their painted spots. Fit a
    // 3:2 box inside the device viewport — Phaser's FIT mode + the smaller
    // setGameSize gives us natural letterboxing.
    const aspect = CFG.width / CFG.height;
    let nativeW = vp.renderW;
    let nativeH = vp.renderH;
    if (nativeW / nativeH > aspect) {
      // Wider than 3:2 — height-constrained.
      nativeW = Math.round(nativeH * aspect);
    } else {
      // Taller than 3:2 — width-constrained.
      nativeH = Math.round(nativeW / aspect);
    }

    this.scale.scaleMode = Phaser.Scale.ScaleModes.FIT;
    this.scale.setGameSize(nativeW, nativeH);
    this.scale.refresh();

    // Store all three scales in the registry so GameScene and UIScene can use
    // them. GameScene's create() will resize the canvas back to the full
    // viewport when gameplay starts.
    this.game.registry.set('sf', vp.uiScale);
    this.game.registry.set('cameraZoom', vp.cameraZoom);
    this.game.registry.set('uiScale', vp.uiScale);
    this.game.registry.set('isMobile', vp.isMobile);

    // Layout uses the 3:2-fitted canvas, so the legacy min-ratio formula now
    // resolves to native/CFG (ratio is identical on both axes by construction).
    this.sf = nativeW / CFG.width;

    // Re-layout on rotation: this scene has no preserved state, so a restart
    // is the cleanest way to rebuild every node/banner at the new size.
    const onViewportChanged = () => {
      // Only restart while LevelSelect is the active scene.
      if (this.scene.isActive('LevelSelect')) this.scene.restart();
    };
    this.game.events.once('viewport-changed', onViewportChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport-changed', onViewportChanged);
    });

    this.medalStore = loadMedals();
    this.medalCount = totalMedals(this.medalStore);
    this.selectedLevel = null;
    this.selectedDiff = null;
    this.panel = null;
    this.tooltip = null;

    const W = nativeW;
    const H = nativeH;

    // Map background image — stretched to fill canvas
    const bg = this.add.image(W / 2, H / 2, 'level_map_bg');
    bg.setDisplaySize(W, H);

    // Slight dark overlay so nodes/text pop
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.15);

    this.drawPaths();
    this.drawNodes();

    // Title banner
    const bannerW = this.p(320), bannerH = this.p(36);
    const bannerG = this.add.graphics();
    bannerG.fillStyle(0x11172a, 0.85);
    bannerG.fillRoundedRect(W / 2 - bannerW / 2, this.p(6), bannerW, bannerH, this.p(8));
    bannerG.lineStyle(this.p(1), 0x2a3760, 0.8);
    bannerG.strokeRoundedRect(W / 2 - bannerW / 2, this.p(6), bannerW, bannerH, this.p(8));
    this.add.text(W / 2, this.p(24), 'SELECT YOUR MISSION', {
      fontFamily: 'monospace', fontSize: this.fs(18), color: '#7cc4ff',
      stroke: '#000', strokeThickness: this.p(3)
    }).setOrigin(0.5).setDepth(2);

    // Medal counter — top right
    const mcW = this.p(158), mcH = this.p(36);
    const medalBg = this.add.graphics();
    medalBg.fillStyle(0x11172a, 0.85);
    medalBg.fillRoundedRect(W - this.p(170), this.p(6), mcW, mcH, this.p(8));
    medalBg.lineStyle(this.p(1), 0x2a3760, 0.8);
    medalBg.strokeRoundedRect(W - this.p(170), this.p(6), mcW, mcH, this.p(8));
    this.add.text(W - this.p(91), this.p(24), `Medals: ${this.medalCount} / ${LEVELS.length * 4}`, {
      fontFamily: 'monospace', fontSize: this.fs(12), color: '#ffd84a',
      stroke: '#000', strokeThickness: this.p(2)
    }).setOrigin(0.5).setDepth(2);

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

        const unlocked = isLevelUnlocked(this.medalStore, target.id);

        const x0 = this.p(level.x), y0 = this.p(level.y);
        const x1 = this.p(target.x), y1 = this.p(target.y);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const dist = Math.hypot(dx, dy);
        const segments = Math.floor(dist / this.p(10));

        for (let pass = 0; pass < 2; pass++) {
          if (pass === 0) {
            g.lineStyle(this.p(6), 0x000000, unlocked ? 0.7 : 0.3);
          } else {
            g.lineStyle(this.p(3), unlocked ? 0x3a2a18 : 0x2a2018, unlocked ? 0.9 : 0.4);
          }
          for (let i = 0; i < segments; i++) {
            if (i % 2 !== 0) continue;
            const t0 = i / segments;
            const t1 = Math.min((i + 1) / segments, 1);
            g.lineBetween(
              x0 + dx * t0, y0 + dy * t0,
              x0 + dx * t1, y0 + dy * t1
            );
          }
        }
      }
    }
  }

  // ---- BIOME ICONS (drawn into the node circle) ----
  drawBiomeIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, biome: string) {
    const s = this.sf;
    switch (biome) {
      case 'grasslands':
        g.fillStyle(0x5a3a1a, 1);
        g.fillRect(cx - 2 * s, cy - 1 * s, 4 * s, 8 * s);
        g.fillStyle(0x3a8a2a, 1);
        g.fillCircle(cx, cy - 4 * s, 6 * s);
        g.fillStyle(0x4aaa3a, 1);
        g.fillCircle(cx - 1 * s, cy - 5 * s, 3 * s);
        break;
      case 'forest':
        g.fillStyle(0x3a2010, 1);
        g.fillRect(cx - 4 * s, cy, 3 * s, 7 * s);
        g.fillRect(cx + 2 * s, cy - 1 * s, 3 * s, 7 * s);
        g.fillStyle(0x1a4a18, 1);
        g.fillCircle(cx - 3 * s, cy - 3 * s, 5 * s);
        g.fillCircle(cx + 3 * s, cy - 4 * s, 6 * s);
        g.fillStyle(0x2a6a22, 1);
        g.fillCircle(cx - 2 * s, cy - 4 * s, 3 * s);
        g.fillCircle(cx + 4 * s, cy - 5 * s, 3 * s);
        break;
      case 'river':
        g.lineStyle(3 * s, 0x3a7ac8, 1);
        g.lineBetween(cx - 8 * s, cy - 4 * s, cx - 3 * s, cy - 7 * s);
        g.lineBetween(cx - 3 * s, cy - 7 * s, cx + 3 * s, cy - 1 * s);
        g.lineBetween(cx + 3 * s, cy - 1 * s, cx + 8 * s, cy - 4 * s);
        g.lineStyle(3 * s, 0x4a8ad8, 1);
        g.lineBetween(cx - 8 * s, cy + 3 * s, cx - 3 * s, cy);
        g.lineBetween(cx - 3 * s, cy, cx + 3 * s, cy + 6 * s);
        g.lineBetween(cx + 3 * s, cy + 6 * s, cx + 8 * s, cy + 3 * s);
        g.lineStyle(1 * s, 0x8ac0ff, 0.6);
        g.lineBetween(cx - 6 * s, cy - 5 * s, cx - 2 * s, cy - 8 * s);
        g.lineBetween(cx - 2 * s, cy - 8 * s, cx + 2 * s, cy - 2 * s);
        g.lineBetween(cx + 2 * s, cy - 2 * s, cx + 6 * s, cy - 5 * s);
        break;
      case 'infected':
        g.fillStyle(0x2a1a2a, 1);
        g.fillRect(cx - 4 * s, cy, 3 * s, 7 * s);
        g.fillRect(cx + 2 * s, cy - 1 * s, 3 * s, 7 * s);
        g.fillStyle(0x6a2a6a, 1);
        g.fillCircle(cx - 3 * s, cy - 3 * s, 5 * s);
        g.fillCircle(cx + 3 * s, cy - 4 * s, 6 * s);
        g.fillStyle(0x9a40aa, 1);
        g.fillCircle(cx - 2 * s, cy - 4 * s, 3 * s);
        g.fillCircle(cx + 4 * s, cy - 5 * s, 3 * s);
        break;
      case 'desert':
        g.fillStyle(0xd4a84a, 1);
        g.fillTriangle(cx, cy - 7 * s, cx - 8 * s, cy + 5 * s, cx + 8 * s, cy + 5 * s);
        g.lineStyle(1 * s, 0xb8903a, 1);
        g.lineBetween(cx, cy - 7 * s, cx + 8 * s, cy + 5 * s);
        g.fillStyle(0xc49a3a, 1);
        g.fillTriangle(cx, cy - 7 * s, cx, cy + 5 * s, cx + 8 * s, cy + 5 * s);
        break;
      case 'tundra':
        g.lineStyle(2 * s, 0xc8e8ff, 1);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          g.lineBetween(cx + Math.cos(a) * 7 * s, cy + Math.sin(a) * 7 * s,
                        cx - Math.cos(a) * 7 * s, cy - Math.sin(a) * 7 * s);
        }
        g.fillStyle(0xeaf4ff, 1);
        g.fillCircle(cx, cy, 2 * s);
        break;
      case 'volcanic':
        g.fillStyle(0xd43a1a, 1);
        g.fillTriangle(cx, cy - 8 * s, cx - 6 * s, cy + 5 * s, cx + 6 * s, cy + 5 * s);
        g.fillStyle(0xff8a2a, 1);
        g.fillTriangle(cx, cy - 5 * s, cx - 4 * s, cy + 4 * s, cx + 4 * s, cy + 4 * s);
        g.fillStyle(0xffcc44, 1);
        g.fillTriangle(cx, cy - 2 * s, cx - 2 * s, cy + 3 * s, cx + 2 * s, cy + 3 * s);
        break;
    }
  }

  // ---- LEVEL NODES ----
  drawNodes() {
    for (const level of LEVELS) {
      const unlocked = isLevelUnlocked(this.medalStore, level.id);
      const medals = this.medalStore[String(level.id)];

      const R = this.p(26); // main circle radius
      const cx = this.p(level.x), cy = this.p(level.y);

      const nodeG = this.add.graphics().setDepth(3);

      // Drop shadow
      nodeG.fillStyle(0x000000, 0.4);
      nodeG.fillCircle(cx + this.p(2), cy + this.p(2), R);

      if (unlocked) {
        nodeG.fillStyle(0x3a2a18, 1);
        nodeG.fillCircle(cx, cy, R + this.p(2));
        nodeG.fillStyle(0x6a5838, 1);
        nodeG.fillCircle(cx, cy, R);
        nodeG.lineStyle(this.p(2), 0xc8a86a, 0.9);
        nodeG.strokeCircle(cx, cy, R);
        nodeG.fillStyle(0x7a6842, 1);
        nodeG.fillCircle(cx, cy - this.p(3), this.p(10));
      } else {
        nodeG.fillStyle(0x1a1614, 1);
        nodeG.fillCircle(cx, cy, R + this.p(2));
        nodeG.fillStyle(0x2a2420, 1);
        nodeG.fillCircle(cx, cy, R);
        nodeG.lineStyle(this.p(1), 0x444444, 0.5);
        nodeG.strokeCircle(cx, cy, R);
      }

      // Biome icon or lock icon
      const iconG = this.add.graphics().setDepth(4);
      if (unlocked) {
        this.drawBiomeIcon(iconG, cx, cy - this.p(3), level.name === 'Rivers' ? 'river' : level.biome);
      } else {
        iconG.fillStyle(0x666666, 0.8);
        iconG.fillRoundedRect(cx - this.p(6), cy - this.p(2), this.p(12), this.p(9), this.p(2));
        iconG.lineStyle(this.p(2), 0x666666, 0.8);
        iconG.beginPath();
        iconG.arc(cx, cy - this.p(5), this.p(5), Math.PI, 0, false);
        iconG.strokePath();
      }

      // Level name
      this.add.text(cx, cy + this.p(12), level.name, {
        fontFamily: 'monospace', fontSize: this.fs(7),
        color: unlocked ? '#e8dcc8' : '#4a4030',
        stroke: '#000', strokeThickness: this.p(1)
        }).setOrigin(0.5).setDepth(4);

      // Medal dots
      const dotY = cy + R + this.p(8);
      const dotSpacing = this.p(11);
      const startX = cx - (dotSpacing * 1.5);
      const dotG = this.add.graphics().setDepth(4);
      for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
        const diff = DIFFICULTY_ORDER[i];
        const earned = medals?.[diff] ?? false;
        const mc = MEDAL_COLORS[diff];
        const dx = startX + i * dotSpacing;
        if (earned) {
          dotG.fillStyle(mc.fill, 0.3);
          dotG.fillCircle(dx, dotY, this.p(5));
          dotG.fillStyle(mc.fill, 1);
          dotG.fillCircle(dx, dotY, this.p(3.5));
          dotG.fillStyle(0xffffff, 0.3);
          dotG.fillCircle(dx - this.p(1), dotY - this.p(1), this.p(1.5));
        } else {
          dotG.fillStyle(0x000000, 0.3);
          dotG.fillCircle(dx, dotY, this.p(3));
          dotG.lineStyle(this.p(1), unlocked ? 0x7a6a52 : 0x444444, 0.4);
          dotG.strokeCircle(dx, dotY, this.p(2.5));
        }
      }

      // Hit zone
      const hitW = this.p(26 * 2.2), hitH = this.p(26 * 2.2 + 16);
      const hitZone = this.add.zone(cx, cy, hitW, hitH)
        .setInteractive({ useHandCursor: unlocked }).setDepth(5);

      hitZone.on('pointerdown', () => {
        if (!unlocked) {
          const prevLevel = LEVELS.find(l => l.id === level.id - 1);
          const prevName = prevLevel ? prevLevel.name : `Level ${level.id - 1}`;
          this.showTooltip(cx, cy - R - this.p(14), `Complete ${prevName} first`);
          return;
        }
        if (!level.implemented) {
          this.showTooltip(cx, cy - R - this.p(14), 'Coming Soon');
          return;
        }
        SFX.play('click');
        this.openDifficultyPanel(level);
      });

      // Hover glow
      if (unlocked) {
        const glowG = this.add.graphics().setAlpha(0).setDepth(2);
        glowG.lineStyle(this.p(2), 0xffd84a, 0.5);
        glowG.strokeCircle(cx, cy, R + this.p(5));
        glowG.lineStyle(this.p(1), 0xffd84a, 0.2);
        glowG.strokeCircle(cx, cy, R + this.p(9));

        hitZone.on('pointerover', () => {
          SFX.play('click');
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
    const clampedX = Phaser.Math.Clamp(x, this.p(80), W - this.p(80));

    const bg = this.add.graphics();
    const t = this.add.text(0, 0, text, {
      fontFamily: 'monospace', fontSize: this.fs(11), color: '#eee',
      stroke: '#000', strokeThickness: this.p(2)
    }).setOrigin(0.5);

    const pw = t.width + this.p(16), ph = this.p(24);
    bg.fillStyle(0x11172a, 0.9);
    bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, this.p(6));
    bg.lineStyle(this.p(1), 0x2a3760, 0.8);
    bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, this.p(6));

    this.tooltip = this.add.container(clampedX, y, [bg, t]).setDepth(100);

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
    const pw = this.p(300), ph = this.p(360);
    const px = W / 2, py = H / 2;

    // Backdrop
    const backdrop = this.add.rectangle(0, 0, W, H, 0x000000, 0.65)
      .setInteractive();
    backdrop.on('pointerdown', () => this.closeDifficultyPanel());

    // Panel box
    const outerBox = this.add.graphics();
    outerBox.fillStyle(0x0d1220, 0.95);
    outerBox.fillRoundedRect(-pw / 2 - this.p(3), -ph / 2 - this.p(3), pw + this.p(6), ph + this.p(6), this.p(10));
    outerBox.lineStyle(this.p(2), 0x4a3a1a, 0.8);
    outerBox.strokeRoundedRect(-pw / 2 - this.p(3), -ph / 2 - this.p(3), pw + this.p(6), ph + this.p(6), this.p(10));

    const innerBox = this.add.graphics();
    innerBox.fillStyle(0x11172a, 0.95);
    innerBox.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, this.p(8));
    innerBox.lineStyle(this.p(1), 0x2a3760, 0.8);
    innerBox.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, this.p(8));

    // Level name
    const biome = BIOME_COLORS[level.biome];
    const title = this.add.text(0, -ph / 2 + this.p(28), level.name, {
      fontFamily: 'monospace', fontSize: this.fs(18), color: '#7cc4ff',
      stroke: '#000', strokeThickness: this.p(3)
    }).setOrigin(0.5);

    // Biome tag
    const tag = this.add.text(0, -ph / 2 + this.p(52), biome.label.toUpperCase(), {
      fontFamily: 'monospace', fontSize: this.fs(10), color: biome.textHex,
      stroke: '#000', strokeThickness: this.p(2)
    }).setOrigin(0.5);

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(this.p(1), 0x2a3760, 0.6);
    divider.lineBetween(-pw / 2 + this.p(20), -ph / 2 + this.p(68), pw / 2 - this.p(20), -ph / 2 + this.p(68));

    // Difficulty buttons
    const medals = this.medalStore[String(level.id)];
    const btnStartY = this.p(-40);
    const btnH = this.p(38);
    const btnW = this.p(230);
    const btnGap = this.p(6);
    const items: Phaser.GameObjects.GameObject[] = [backdrop, outerBox, innerBox, title, tag, divider];

    for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
      const diff = DIFFICULTY_ORDER[i];
      const by = btnStartY + i * (btnH + btnGap);

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x1a2540, 1);
      btnBg.fillRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, this.p(6));
      btnBg.lineStyle(this.p(1), 0x2a3760, 0.8);
      btnBg.strokeRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, this.p(6));

      const hitRect = this.add.rectangle(0, by, btnW, btnH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      const label = this.add.text(-btnW / 2 + this.p(20), by, DIFFICULTY_LABELS[diff], {
        fontFamily: 'monospace', fontSize: this.fs(13), color: '#ccd',
        stroke: '#000', strokeThickness: this.p(1)
      }).setOrigin(0, 0.5);

      hitRect.on('pointerover', () => {
        btnBg.clear();
        btnBg.fillStyle(0x2a3760, 1);
        btnBg.fillRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, this.p(6));
        btnBg.lineStyle(this.p(1), 0x4a5a8a, 0.8);
        btnBg.strokeRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, this.p(6));
      });
      hitRect.on('pointerout', () => {
        const selected = this.selectedDiff === diff;
        btnBg.clear();
        btnBg.fillStyle(selected ? 0x2a3a60 : 0x1a2540, 1);
        btnBg.fillRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, this.p(6));
        btnBg.lineStyle(this.p(1), selected ? 0x6a8acc : 0x2a3760, 0.8);
        btnBg.strokeRoundedRect(-btnW / 2, by - btnH / 2, btnW, btnH, this.p(6));
      });
      hitRect.on('pointerdown', () => {
        SFX.play('click');
        this.selectedDiff = diff;
        for (const btn of this.diffButtons) {
          const sel = btn.diff === diff;
          btn.bg.clear();
          btn.bg.fillStyle(sel ? 0x2a3a60 : 0x1a2540, 1);
          const bby = btnStartY + DIFFICULTY_ORDER.indexOf(btn.diff) * (btnH + btnGap);
          btn.bg.fillRoundedRect(-btnW / 2, bby - btnH / 2, btnW, btnH, this.p(6));
          btn.bg.lineStyle(this.p(1), sel ? 0x6a8acc : 0x2a3760, 0.8);
          btn.bg.strokeRoundedRect(-btnW / 2, bby - btnH / 2, btnW, btnH, this.p(6));
          btn.text.setColor(sel ? '#fff' : '#ccd');
        }
        this.updateStartButton();
      });

      this.diffButtons.push({ bg: btnBg, text: label, diff });
      items.push(btnBg, hitRect, label);
    }

    // Green checkmarks for completed difficulties
    for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
      const diff = DIFFICULTY_ORDER[i];
      const earned = medals?.[diff] ?? false;
      if (earned) {
        const by = btnStartY + i * (btnH + btnGap);
        const chk = this.add.image(btnW / 2 - this.p(24), by, 'green_check').setOrigin(0.5).setDisplaySize(this.p(28), this.p(28));
        items.push(chk);
      }
    }

    // START button
    const startBtnW = this.p(120), startBtnH = this.p(36);
    this.startBtnY = ph / 2 - this.p(52);
    this.startBtnG = this.add.graphics();
    this.startBtnG.fillStyle(0x1a2540, 1);
    this.startBtnG.fillRoundedRect(-startBtnW / 2, this.startBtnY, startBtnW, startBtnH, this.p(8));
    this.startBtnG.lineStyle(this.p(1), 0x2a3760, 0.8);
    this.startBtnG.strokeRoundedRect(-startBtnW / 2, this.startBtnY, startBtnW, startBtnH, this.p(8));
    this.startText = this.add.text(0, this.startBtnY + startBtnH / 2, 'START', {
      fontFamily: 'monospace', fontSize: this.fs(15), color: '#556',
      stroke: '#000', strokeThickness: this.p(2)
    }).setOrigin(0.5);
    this.startHit = this.add.rectangle(0, this.startBtnY + startBtnH / 2, startBtnW, startBtnH, 0x000000, 0);
    this.startBtnW = startBtnW;
    this.startBtnH = startBtnH;
    items.push(this.startBtnG, this.startText, this.startHit);

    // Close button
    const clBtnSz = this.p(24);
    const clX = pw / 2 - this.p(32);
    const clY = -ph / 2 + this.p(8);
    const closeG = this.add.graphics();
    closeG.fillStyle(0x1a2540, 1);
    closeG.fillRoundedRect(clX, clY, clBtnSz, clBtnSz, this.p(4));
    closeG.lineStyle(this.p(1), 0x2a3760, 0.8);
    closeG.strokeRoundedRect(clX, clY, clBtnSz, clBtnSz, this.p(4));
    const closeCx = clX + clBtnSz / 2;
    const closeCy = clY + clBtnSz / 2;
    const closeX = this.add.text(closeCx, closeCy, 'X', {
      fontFamily: 'monospace', fontSize: this.fs(12), color: '#aab',
      stroke: '#000', strokeThickness: this.p(1)
    }).setOrigin(0.5);
    const closeHit = this.add.rectangle(closeCx, closeCy, this.p(28), this.p(28), 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => this.closeDifficultyPanel());
    closeHit.on('pointerover', () => {
      closeG.clear();
      closeG.fillStyle(0x3b4d84, 1);
      closeG.fillRoundedRect(clX, clY, clBtnSz, clBtnSz, this.p(4));
      closeG.lineStyle(this.p(1), 0x4a5a8a, 0.8);
      closeG.strokeRoundedRect(clX, clY, clBtnSz, clBtnSz, this.p(4));
    });
    closeHit.on('pointerout', () => {
      closeG.clear();
      closeG.fillStyle(0x1a2540, 1);
      closeG.fillRoundedRect(clX, clY, clBtnSz, clBtnSz, this.p(4));
      closeG.lineStyle(this.p(1), 0x2a3760, 0.8);
      closeG.strokeRoundedRect(clX, clY, clBtnSz, clBtnSz, this.p(4));
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
  startBtnY = 0;
  startBtnW = 0;
  startBtnH = 0;

  updateStartButton() {
    if (!this.startBtnG || !this.startHit || !this.startText) return;
    const g = this.startBtnG;
    const text = this.startText;
    const hit = this.startHit;
    const bw = this.startBtnW, bh = this.startBtnH;

    if (this.selectedDiff) {
      const by = this.startBtnY;
      g.clear();
      g.fillStyle(0x1e4a2e, 1);
      g.fillRoundedRect(-bw / 2, by, bw, bh, this.p(8));
      g.lineStyle(this.p(2), 0x4ad96a, 0.9);
      g.strokeRoundedRect(-bw / 2, by, bw, bh, this.p(8));
      text.setColor('#7cf29a');
      hit.setInteractive({ useHandCursor: true });
      hit.off('pointerdown');
      hit.on('pointerdown', () => { SFX.play('click'); this.startMission(); });
      hit.on('pointerover', () => {
        g.clear();
        g.fillStyle(0x2a6a3e, 1);
        g.fillRoundedRect(-bw / 2, by, bw, bh, this.p(8));
        g.lineStyle(this.p(2), 0x6afa8a, 0.9);
        g.strokeRoundedRect(-bw / 2, by, bw, bh, this.p(8));
      });
      hit.on('pointerout', () => {
        g.clear();
        g.fillStyle(0x1e4a2e, 1);
        g.fillRoundedRect(-bw / 2, by, bw, bh, this.p(8));
        g.lineStyle(this.p(2), 0x4ad96a, 0.9);
        g.strokeRoundedRect(-bw / 2, by, bw, bh, this.p(8));
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

    // Show the "Generating world..." loading overlay
    const overlay = document.getElementById('overlay');
    const landing = document.getElementById('landingPanel');
    if (overlay && landing) {
      landing.classList.add('loading');
      overlay.classList.remove('hidden');
    }

    // Keep native resolution — GameScene zooms its camera, UIScene scales its elements

    const levelId = this.selectedLevel.id;
    const difficulty = this.selectedDiff;
    requestAnimationFrame(() => {
      this.scene.start('Game', { levelId, difficulty });
      this.scene.launch('UI', { levelId, difficulty });
    });
  }
}
