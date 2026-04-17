import Phaser from 'phaser';
import { CFG } from '../config';
import { Difficulty, saveMedal } from '../levels';

export class UIScene extends Phaser.Scene {
  hpBarBg!: Phaser.GameObjects.Rectangle;
  hpBar!: Phaser.GameObjects.Rectangle;
  nameText!: Phaser.GameObjects.Text;
  moneyText!: Phaser.GameObjects.Text;
  btnTower!: Phaser.GameObjects.Container;
  btnCannon!: Phaser.GameObjects.Container;
  btnWall!: Phaser.GameObjects.Container;
  btnSpeed!: Phaser.GameObjects.Container;
  speedLabel!: Phaser.GameObjects.Text;
  speedIdx = 0;
  endPanel?: Phaser.GameObjects.Container;
  bossBarBg?: Phaser.GameObjects.Rectangle;
  bossBar?: Phaser.GameObjects.Rectangle;
  bossLabel?: Phaser.GameObjects.Text;
  waveBarBg!: Phaser.GameObjects.Rectangle;
  waveBar!: Phaser.GameObjects.Rectangle;
  waveLabel!: Phaser.GameObjects.Text;
  progressCircles: Phaser.GameObjects.Arc[] = [];
  progressLabels: Phaser.GameObjects.Text[] = [];
  progressLines: Phaser.GameObjects.Rectangle[] = [];
  progressContainer!: Phaser.GameObjects.Container;
  countdownText!: Phaser.GameObjects.Text;

  levelId = 1;
  difficulty: Difficulty = 'easy';

  constructor() { super({ key: 'UI', active: false }); }

  init(data: any) {
    this.levelId = data?.levelId ?? 1;
    this.difficulty = data?.difficulty ?? 'easy';
    this.endPanel = undefined;
    this.bossBarBg = undefined;
    this.bossBar = undefined;
    this.bossLabel = undefined;
    this.speedIdx = 0;
  }

  create() {
    const W = this.scale.width;
    const T = 20; // top padding

    // top-left HUD
    this.nameText = this.add.text(12, T, '', { fontFamily: 'monospace', fontSize: '14px', color: '#7cc4ff' });
    this.hpBarBg = this.add.rectangle(12, T + 22, 180, 14, 0x111826).setOrigin(0, 0).setStrokeStyle(1, 0x2a3760);
    this.hpBar = this.add.rectangle(13, T + 23, 178, 12, 0xd94a4a).setOrigin(0, 0);
    const arrowCost = CFG.tower.kinds.arrow.cost;
    const cannonCost = CFG.tower.kinds.cannon.cost;
    const H = this.scale.height;

    // Top-right gold badge (WoW-style)
    const coinX = W - 60;
    const coinY = T + 14;
    // Dark inset panel behind the number
    this.add.rectangle(coinX + 6, coinY, 80, 26, 0x0b0f1a, 0.85).setOrigin(1, 0.5).setStrokeStyle(1, 0x3a3a1a);
    // Gold coin circle
    const coinOuter = this.add.circle(coinX + 12, coinY, 13, 0x8a6a1a).setStrokeStyle(2, 0xc4a030);
    const coinInner = this.add.circle(coinX + 12, coinY, 9, 0xd4a820).setStrokeStyle(1, 0xffd84a);
    this.add.text(coinX + 12, coinY, '$', {
      fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#1a1000',
    }).setOrigin(0.5);
    // Money amount text
    this.moneyText = this.add.text(coinX - 2, coinY, '0', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffd84a',
      stroke: '#0b0f1a', strokeThickness: 3,
    }).setOrigin(1, 0.5);

    // Bottom-center hotbar
    const slotW = 72;
    const slotH = 52;
    const slotGap = 6;
    const slots = 4; // arrow, cannon, wall, speed
    const barTotalW = slots * slotW + (slots - 1) * slotGap;
    const barStartX = (W - barTotalW) / 2;
    const hotbarY = H - slotH - 10;

    // Hotbar background
    this.add.rectangle(W / 2, hotbarY + slotH / 2, barTotalW + 16, slotH + 8, 0x0b0f1a, 0.7)
      .setStrokeStyle(1, 0x2a3760);

    const slotX = (i: number) => barStartX + i * (slotW + slotGap) + slotW / 2;

    this.btnTower = this.makeHotbarSlot(slotX(0), hotbarY, slotW, slotH, '1', `ARROW`, `$${arrowCost}`,
      () => this.game.events.emit('ui-build', 'tower', 'arrow'));
    this.btnCannon = this.makeHotbarSlot(slotX(1), hotbarY, slotW, slotH, '2', `CANNON`, `$${cannonCost}`,
      () => this.game.events.emit('ui-build', 'tower', 'cannon'));
    this.btnWall = this.makeHotbarSlot(slotX(2), hotbarY, slotW, slotH, '3', `WALL`, `$${CFG.wall.cost}`,
      () => this.game.events.emit('ui-build', 'wall'));
    this.btnSpeed = this.makeHotbarSlot(slotX(3), hotbarY, slotW, slotH, 'SPC', '>', '',
      () => this.cycleSpeed());
    this.speedLabel = this.btnSpeed.getAt(2) as Phaser.GameObjects.Text; // the name label
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on('down', () => this.cycleSpeed());

    // Level progress graphic (wave circles + boss skull)
    this.progressCircles = [];
    this.progressLabels = [];
    this.progressLines = [];
    const totalNodes = CFG.spawn.waveCount + 1; // waves + boss
    const nodeSpacing = 36;
    const totalW = (totalNodes - 1) * nodeSpacing;
    const startX = (W - totalW) / 2;
    const nodeY = T;
    const nodeR = 9;
    const items: Phaser.GameObjects.GameObject[] = [];

    for (let i = 0; i < totalNodes; i++) {
      const nx = startX + i * nodeSpacing;
      // connecting line to next node
      if (i < totalNodes - 1) {
        const line = this.add.rectangle(nx + nodeR + 2, nodeY, nodeSpacing - nodeR * 2 - 4, 2, 0x2a3760).setOrigin(0, 0.5);
        this.progressLines.push(line);
        items.push(line);
      }
      // circle
      const circle = this.add.circle(nx, nodeY, nodeR, 0x11172a).setStrokeStyle(2, 0x2a3760);
      this.progressCircles.push(circle);
      items.push(circle);
      // label (number or skull)
      const isBoss = i === totalNodes - 1;
      const label = this.add.text(nx, nodeY, isBoss ? '\u2620' : `${i + 1}`, {
        fontFamily: 'monospace', fontSize: isBoss ? '12px' : '10px', color: '#556',
      }).setOrigin(0.5);
      this.progressLabels.push(label);
      items.push(label);
    }
    this.progressContainer = this.add.container(0, 0, items);

    // Countdown text (shares space with progress graphic — only one visible at a time)
    this.countdownText = this.add.text(W / 2, nodeY, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: 4
    }).setOrigin(0.5).setVisible(false);

    // Wave progress bar (centered, same position as boss bar)
    const barW = 420;
    const barX = (W - barW) / 2;
    const barY = T + 38;
    this.waveLabel = this.add.text(W / 2, barY - 16, 'WAVE 1', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: 3
    }).setOrigin(0.5);
    this.waveBarBg = this.add.rectangle(barX, barY, barW, 14, 0x11172a).setOrigin(0, 0).setStrokeStyle(2, 0x2a3760);
    this.waveBar = this.add.rectangle(barX + 2, barY + 2, 0, 10, 0x4a8ad9).setOrigin(0, 0);

    // listen for HUD updates
    this.game.events.on('hud', (s: any) => this.updateHud(s));
    this.game.events.on('game-end', (s: any) => this.showEnd(s));
    this.game.events.on('boss-spawn', (s: any) => this.showBossBar(s));
    this.game.events.on('boss-hp', (s: any) => this.updateBossBar(s));
  }

  showBossBar(s: any) {
    const W = this.scale.width;
    const barW = 420;
    const x = (W - barW) / 2;
    const y = 58; // 20 (top pad) + 38
    if (this.bossBarBg) return;
    const bossName = s?.biome === 'forest' ? 'THE FOREST GUARDIAN' : 'THE BROOD MOTHER';
    this.bossLabel = this.add.text(W / 2, y - 16, bossName, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ff6a6a',
      stroke: '#0b0f1a', strokeThickness: 3
    }).setOrigin(0.5);
    this.bossBarBg = this.add.rectangle(x, y, barW, 14, 0x11172a).setOrigin(0, 0).setStrokeStyle(2, 0x6a1a1a);
    this.bossBar = this.add.rectangle(x + 2, y + 2, barW - 4, 10, 0xd94a4a).setOrigin(0, 0);
    this.bossBar.setDataEnabled();
    this.bossBar.setData('maxW', barW - 4);
    this.bossBar.setData('maxHp', s?.maxHp ?? 1);
  }

  updateBossBar(s: any) {
    if (!this.bossBar) return;
    const maxW = this.bossBar.getData('maxW');
    const maxHp = this.bossBar.getData('maxHp') || s.maxHp || 1;
    const pct = Math.max(0, (s.hp ?? 0) / maxHp);
    this.bossBar.width = maxW * pct;
    this.bossBar.fillColor = pct > 0.5 ? 0xd94a4a : pct > 0.25 ? 0xd97a4a : 0xff3030;
  }

  cycleSpeed() {
    const speeds = [1.25, 2, 3.75];
    const labels = ['>', '>>', '>>>'];
    this.speedIdx = (this.speedIdx + 1) % speeds.length;
    this.speedLabel.setText(labels[this.speedIdx]);
    this.game.events.emit('ui-speed', speeds[this.speedIdx]);
  }

  makeButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0x2a3760).setStrokeStyle(1, 0x556);
    const t = this.add.text(0, 0, label, { fontFamily: 'monospace', fontSize: '12px', color: '#fff' }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    bg.on('pointerover', () => bg.setFillStyle(0x3b4d84));
    bg.on('pointerout', () => bg.setFillStyle(0x2a3760));
    c.add([bg, t]);
    return c;
  }

  makeHotbarSlot(cx: number, topY: number, w: number, h: number, key: string, name: string, cost: string, onClick: () => void) {
    const my = topY + h / 2;
    const c = this.add.container(cx, my);
    // slot background
    const bg = this.add.rectangle(0, 0, w, h, 0x1a2240).setStrokeStyle(1, 0x3a4a80);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    bg.on('pointerover', () => bg.setFillStyle(0x2a3a60));
    bg.on('pointerout', () => bg.setFillStyle(0x1a2240));
    // keybind badge (top-left corner)
    const badge = this.add.text(-w / 2 + 4, -h / 2 + 2, key, {
      fontFamily: 'monospace', fontSize: '9px', color: '#8899bb',
    }).setOrigin(0, 0);
    // name label (center)
    const nameT = this.add.text(0, -2, name, {
      fontFamily: 'monospace', fontSize: '12px', color: '#fff',
    }).setOrigin(0.5);
    // cost label (below name)
    const costT = this.add.text(0, 12, cost, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffd84a',
    }).setOrigin(0.5);
    c.add([bg, badge, nameT, costT]);
    return c;
  }

  updateHud(s: any) {
    if (!s) return;
    this.nameText.setText(s.name ?? 'hero');
    const pct = Math.max(0, s.hp / s.maxHp);
    this.hpBar.width = 178 * pct;
    this.hpBar.fillColor = pct > 0.5 ? 0x4ad96a : pct > 0.25 ? 0xd9a84a : 0xd94a4a;
    this.moneyText.setText(`${s.money}`);

    // Toggle countdown text vs progress graphic
    if (s.countdownMsg) {
      this.countdownText.setText(s.countdownMsg);
      this.countdownText.setColor(s.countdownColor ?? '#7cc4ff');
      this.countdownText.setVisible(true);
      this.progressContainer.setVisible(false);
    } else {
      this.countdownText.setVisible(false);
      this.progressContainer.setVisible(true);
    }

    // Update level progress circles
    const waveCount = CFG.spawn.waveCount;
    const currentWave = s.wave ?? 1; // 1-indexed
    for (let i = 0; i < this.progressCircles.length; i++) {
      const isBoss = i === waveCount;
      const waveNum = i + 1; // 1-indexed wave for this node
      if (isBoss) {
        if (s.bossSpawned) {
          // Boss active - highlight red
          this.progressCircles[i].setStrokeStyle(2, 0xff6a6a);
          this.progressCircles[i].setFillStyle(0x3a1010);
          this.progressLabels[i].setColor('#ff6a6a');
        } else {
          // Boss not yet
          this.progressCircles[i].setStrokeStyle(2, 0x2a3760);
          this.progressCircles[i].setFillStyle(0x11172a);
          this.progressLabels[i].setColor('#556');
        }
      } else if (waveNum < currentWave || (waveNum === currentWave && s.bossSpawned)) {
        // Completed wave - green with checkmark
        this.progressCircles[i].setStrokeStyle(2, 0x4ad96a);
        this.progressCircles[i].setFillStyle(0x1a3a1a);
        this.progressLabels[i].setText('\u2713');
        this.progressLabels[i].setColor('#4ad96a');
      } else if (waveNum === currentWave) {
        // Current wave - bright blue highlight
        this.progressCircles[i].setStrokeStyle(2, 0x7cc4ff);
        this.progressCircles[i].setFillStyle(0x1a2a4a);
        this.progressLabels[i].setText(`${waveNum}`);
        this.progressLabels[i].setColor('#7cc4ff');
      } else {
        // Future wave - dim
        this.progressCircles[i].setStrokeStyle(2, 0x2a3760);
        this.progressCircles[i].setFillStyle(0x11172a);
        this.progressLabels[i].setText(`${waveNum}`);
        this.progressLabels[i].setColor('#556');
      }
      // Update connecting line colors
      if (i < this.progressLines.length) {
        if (waveNum < currentWave || (waveNum === currentWave && s.bossSpawned)) {
          this.progressLines[i].setFillStyle(0x4ad96a);
        } else if (waveNum === currentWave) {
          this.progressLines[i].setFillStyle(0x7cc4ff);
        } else {
          this.progressLines[i].setFillStyle(0x2a3760);
        }
      }
    }

    // Wave progress bar
    if (s.bossSpawned) {
      // Hide wave bar when boss is active (boss bar takes its place)
      this.waveLabel.setVisible(false);
      this.waveBarBg.setVisible(false);
      this.waveBar.setVisible(false);
    } else {
      const maxW = 416; // barW - 4
      const wavePct = s.waveSize > 0 ? Math.min(1, s.waveKills / s.waveSize) : 0;
      this.waveBar.width = maxW * (1 - wavePct);

      if (s.waveBreakUntil > 0 && s.vTime < s.waveBreakUntil) {
        const secs = Math.ceil((s.waveBreakUntil - s.vTime) / 1000);
        this.waveLabel.setText(`WAVE ${s.wave} IN ${secs}s`);
        this.waveLabel.setColor('#ffd84a');
      } else {
        this.waveLabel.setText(`WAVE ${s.wave}`);
        this.waveLabel.setColor('#7cc4ff');
      }
    }
  }

  showEnd(s: any) {
    if (this.endPanel) return;
    if (s.win) saveMedal(this.levelId, this.difficulty);
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0);
    const box = this.add.rectangle(W / 2, H / 2, 380, 200, 0x11172a).setStrokeStyle(2, 0x2a3760);
    const title = this.add.text(W / 2, H / 2 - 60, s.win ? 'VICTORY' : 'DEFEAT',
      { fontFamily: 'monospace', fontSize: '32px', color: s.win ? '#7cf29a' : '#ff6a6a' }).setOrigin(0.5);
    const sub = this.add.text(W / 2, H / 2 - 10, `${s.name}   Kills: ${s.kills}   $ ${s.money}`,
      { fontFamily: 'monospace', fontSize: '14px', color: '#ccd' }).setOrigin(0.5);
    const btn = this.makeButton(W / 2, H / 2 + 40, 140, 32, 'RETURN TO MAP', () => {
      this.scene.stop('Game');
      this.scene.stop('UI');
      this.scene.start('LevelSelect');
    });
    this.endPanel = this.add.container(0, 0, [bg, box, title, sub, btn]);
  }

  shutdown() {
    this.game.events.off('hud');
    this.game.events.off('game-end');
    this.game.events.off('boss-spawn');
    this.game.events.off('boss-hp');
  }
}
