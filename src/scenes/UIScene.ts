import Phaser from 'phaser';
import { CFG } from '../config';
import { Difficulty, saveMedal } from '../levels';
import { SFX } from '../audio/sfx';
import { VirtualJoystick } from '../ui/VirtualJoystick';

export class UIScene extends Phaser.Scene {
  hpBarBg!: Phaser.GameObjects.Rectangle;
  hpBar!: Phaser.GameObjects.Rectangle;
  nameText!: Phaser.GameObjects.Text;
  moneyText!: Phaser.GameObjects.Text;
  btnTower!: Phaser.GameObjects.Container;
  btnCannon!: Phaser.GameObjects.Container;
  btnMage!: Phaser.GameObjects.Container;
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
  buildErrorText!: Phaser.GameObjects.Text;

  levelId = 1;
  difficulty: Difficulty = 'easy';

  /** Scale factor for native resolution rendering */
  private sf = 1;
  /** Scale a base-resolution value to native */
  private p(v: number) { return v * this.sf; }
  /** Build a font-size string at scaled resolution */
  private fs(px: number) { return `${Math.round(px * this.sf)}px`; }
  /** Design-space width (canvas divided by uiScale) — how many base units of
   *  horizontal room the UI has. Elements sized in base units must fit inside
   *  this number or they overflow the canvas. */
  private dw() { return this.scale.width / this.sf; }
  /** Design-space height. */
  private dh() { return this.scale.height / this.sf; }
  /** Mobile flag (from registry). */
  private isMobile = false;
  /** Virtual joystick (mobile only). */
  private joystick: VirtualJoystick | null = null;

  constructor() { super({ key: 'UI', active: false }); }

  init(data: any) {
    this.levelId = data?.levelId ?? 1;
    this.difficulty = data?.difficulty ?? 'easy';
    this.endPanel = undefined;
    this.bossBarBg = undefined;
    this.bossBar = undefined;
    this.bossLabel = undefined;
    // Restore speedIdx if a prior incarnation persisted it (e.g. across a
    // viewport-driven scene restart on rotation). Default to 0 for fresh runs.
    this.speedIdx = (this.game.registry.get('uiSpeedIdx') as number) ?? 0;
  }

  create() {
    this.sf = this.game.registry.get('sf') || 1;
    this.isMobile = !!this.game.registry.get('isMobile');
    const W = this.scale.width;
    const H = this.scale.height;
    const T = this.p(20); // top padding

    // top-left HUD
    this.nameText = this.add.text(this.p(12), T, '', { fontFamily: 'monospace', fontSize: this.fs(14), color: '#7cc4ff' });
    const hpBarW = this.p(180);
    this.hpBarBg = this.add.rectangle(this.p(12), T + this.p(22), hpBarW, this.p(14), 0x111826).setOrigin(0, 0).setStrokeStyle(this.p(1), 0x2a3760);
    this.hpBar = this.add.rectangle(this.p(13), T + this.p(23), hpBarW - this.p(2), this.p(12), 0xd94a4a).setOrigin(0, 0);

    // Top-right gold badge (WoW-style)
    const coinX = W - this.p(60);
    const coinY = T + this.p(14);
    // Dark inset panel behind the number
    this.add.rectangle(coinX + this.p(6), coinY, this.p(80), this.p(26), 0x0b0f1a, 0.85).setOrigin(1, 0.5).setStrokeStyle(this.p(1), 0x3a3a1a);
    // Gold coin circle
    this.add.circle(coinX + this.p(12), coinY, this.p(13), 0x8a6a1a).setStrokeStyle(this.p(2), 0xc4a030);
    this.add.circle(coinX + this.p(12), coinY, this.p(9), 0xd4a820).setStrokeStyle(this.p(1), 0xffd84a);
    this.add.text(coinX + this.p(12), coinY, '$', {
      fontFamily: 'monospace', fontSize: this.fs(12), fontStyle: 'bold', color: '#1a1000',
    }).setOrigin(0.5);
    // Money amount text
    this.moneyText = this.add.text(coinX - this.p(2), coinY, '0', {
      fontFamily: 'monospace', fontSize: this.fs(15), fontStyle: 'bold', color: '#ffd84a',
      stroke: '#0b0f1a', strokeThickness: this.p(3),
    }).setOrigin(1, 0.5);

    // Bottom-center minimal hotbar (#7 style — slots with labels below)
    const slotSize = this.p(48);
    const slotGap = this.p(10);
    const slots = 5;
    const hotbarY = H - slotSize - this.p(32); // extra room for labels below
    const barCenterX = W / 2;

    const slotX = (i: number) => barCenterX - (slots * slotSize + (slots - 1) * slotGap) / 2 + i * (slotSize + slotGap) + slotSize / 2;

    this.btnTower = this.makeHotbarSlot(slotX(0), hotbarY, slotSize, slotSize, '1', 'arrow', 'ARROW', '$60',
      () => this.game.events.emit('ui-build', 'tower', 'arrow'));
    this.btnCannon = this.makeHotbarSlot(slotX(1), hotbarY, slotSize, slotSize, '2', 'cannon', 'CANNON', '$60',
      () => this.game.events.emit('ui-build', 'tower', 'cannon'));
    this.btnMage = this.makeHotbarSlot(slotX(2), hotbarY, slotSize, slotSize, '3', 'mage', 'MAGE', '$80',
      () => { /* locked — mage tower not yet implemented */ });
    // Lock overlay on mage slot
    const lockG = this.add.graphics();
    const ls = this.sf;
    // Dim overlay
    lockG.fillStyle(0x000000, 0.5);
    lockG.fillRoundedRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, this.p(3));
    // Padlock body
    const lx = 0, ly = this.p(2);
    lockG.fillStyle(0x8a8a8a, 0.9);
    lockG.fillRoundedRect(lx - this.p(7), ly, this.p(14), this.p(10), this.p(2));
    // Shackle
    lockG.lineStyle(this.p(2.5), 0x8a8a8a, 0.9);
    lockG.beginPath();
    lockG.arc(lx, ly - this.p(1), this.p(5), Math.PI, 0, false);
    lockG.strokePath();
    // Keyhole
    lockG.fillStyle(0x222222, 1);
    lockG.fillCircle(lx, ly + this.p(4), this.p(2));
    lockG.fillRect(lx - this.p(1), ly + this.p(5), this.p(2), this.p(3));
    this.btnMage.add(lockG);
    this.btnWall = this.makeHotbarSlot(slotX(3), hotbarY, slotSize, slotSize, '4', 'wall', 'WALL', '$5',
      () => this.game.events.emit('ui-build', 'wall'));
    this.btnSpeed = this.makeHotbarSlot(slotX(4), hotbarY, slotSize, slotSize, 'SPC', 'speed', 'SPEED', '',
      () => this.cycleSpeed());
    // Speed cycle text overlay — initial text matches the persisted speedIdx
    // so a restart (e.g. viewport rotation) doesn't desync from GameScene.
    const speedLabels = ['>', '>>', '>>>'];
    this.speedLabel = this.add.text(0, 0, speedLabels[this.speedIdx] ?? '>', {
      fontFamily: 'monospace', fontSize: this.fs(16), fontStyle: 'bold', color: '#c4a850',
      stroke: '#0a0e1a', strokeThickness: this.p(3),
    }).setOrigin(0.5);
    this.btnSpeed.add(this.speedLabel);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on('down', () => this.cycleSpeed());

    // Level progress graphic (wave circles + boss skull)
    this.progressCircles = [];
    this.progressLabels = [];
    this.progressLines = [];
    const totalNodes = CFG.spawn.waveCount + 1; // waves + boss
    const nodeSpacing = this.p(36);
    const totalW = (totalNodes - 1) * nodeSpacing;
    const startX = (W - totalW) / 2;
    const nodeY = T;
    const nodeR = this.p(9);
    const items: Phaser.GameObjects.GameObject[] = [];

    for (let i = 0; i < totalNodes; i++) {
      const nx = startX + i * nodeSpacing;
      // connecting line to next node
      if (i < totalNodes - 1) {
        const line = this.add.rectangle(nx + nodeR + this.p(2), nodeY, nodeSpacing - nodeR * 2 - this.p(4), this.p(2), 0x2a3760).setOrigin(0, 0.5);
        this.progressLines.push(line);
        items.push(line);
      }
      // circle
      const circle = this.add.circle(nx, nodeY, nodeR, 0x11172a).setStrokeStyle(this.p(2), 0x2a3760);
      this.progressCircles.push(circle);
      items.push(circle);
      // label (number or skull)
      const isBoss = i === totalNodes - 1;
      const label = this.add.text(nx, nodeY, isBoss ? '\u2620' : `${i + 1}`, {
        fontFamily: 'monospace', fontSize: isBoss ? this.fs(12) : this.fs(10), color: '#556',
      }).setOrigin(0.5);
      this.progressLabels.push(label);
      items.push(label);
    }
    this.progressContainer = this.add.container(0, 0, items);

    // Countdown text (shares space with progress graphic — only one visible at a time)
    this.countdownText = this.add.text(W / 2, nodeY, '', {
      fontFamily: 'monospace', fontSize: this.fs(18), color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: this.p(4)
    }).setOrigin(0.5).setVisible(false);

    // Wave progress bar (centered, same position as boss bar). Clamp to the
    // available design width so it doesn't overflow narrow mobile canvases.
    const waveBarBaseW = Math.min(420, this.dw() - 40);
    const barW = this.p(waveBarBaseW);
    const barX = (W - barW) / 2;
    const barY = T + this.p(38);
    this.waveLabel = this.add.text(W / 2, barY - this.p(16), 'WAVE 1', {
      fontFamily: 'monospace', fontSize: this.fs(14), color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: this.p(3)
    }).setOrigin(0.5);
    this.waveBarBg = this.add.rectangle(barX, barY, barW, this.p(14), 0x11172a).setOrigin(0, 0).setStrokeStyle(this.p(2), 0x2a3760);
    this.waveBar = this.add.rectangle(barX + this.p(2), barY + this.p(2), 0, this.p(10), 0x4a8ad9).setOrigin(0, 0);

    // Build error message (persistent while hovering invalid tile)
    const hotbarTop = H - this.p(48) - this.p(32); // matches hotbarY
    this.buildErrorText = this.add.text(W / 2, hotbarTop - this.p(18), '', {
      fontFamily: 'monospace', fontSize: this.fs(13), color: '#ff6a6a',
      stroke: '#0b0f1a', strokeThickness: this.p(3),
      backgroundColor: '#1a0a0aCC',
      padding: { x: Number(this.p(10)), y: Number(this.p(4)) }
    }).setOrigin(0.5, 1).setDepth(900).setVisible(false);

    // listen for HUD updates
    this.game.events.on('hud', (s: any) => this.updateHud(s));
    this.game.events.on('game-end', (s: any) => this.showEnd(s));
    this.game.events.on('boss-spawn', (s: any) => this.showBossBar(s));
    this.game.events.on('boss-hp', (s: any) => this.updateBossBar(s));
    this.game.events.on('build-error', (msg: string) => {
      if (msg) {
        this.buildErrorText.setText(msg).setVisible(true);
      } else {
        this.buildErrorText.setVisible(false);
      }
    });

    // ---- Mobile virtual joystick (lower-left) ----
    if (this.isMobile) {
      const outerR = this.p(60);
      const innerR = this.p(28);
      // Portrait: lift the joystick above the bottom hotbar (slot top at
      // H - p(80), labels extend below to ~H - p(18)). Landscape: hotbar is
      // horizontally centered with no overlap on the left, so we can sit lower.
      const isPortraitNow = this.scale.height > this.scale.width;
      const margin = this.p(isPortraitNow ? 130 : 60);
      const cx = this.p(40) + outerR;
      const cy = H - margin - outerR;
      const touchPad = this.p(20);
      this.joystick = new VirtualJoystick(this, cx, cy, outerR, innerR, outerR + touchPad);

      // Publish the joystick's screen-space hit rect so GameScene can ignore
      // taps in this region (otherwise tapping the stick during build mode
      // would also fire handleClick and try to place a tower under your thumb).
      const halfSize = outerR + touchPad;
      this.game.registry.set('joystickBounds', {
        x: cx - halfSize,
        y: cy - halfSize,
        w: halfSize * 2,
        h: halfSize * 2,
      });
    }

    // Publish joystick state to the registry every frame so GameScene can read
    // it from updatePlayer without coupling the two scenes through events.
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (this.joystick) {
        this.game.registry.set('joystickX', this.joystick.x);
        this.game.registry.set('joystickY', this.joystick.y);
      }
    });

    // If a boss is alive (e.g. we just restarted on rotation), rebuild the
    // boss bar from registry state since boss-spawn is one-shot and we missed
    // the original event.
    if (this.game.registry.get('bossActive')) {
      const bossMaxHp = (this.game.registry.get('bossMaxHp') as number) || 1;
      const bossHp = (this.game.registry.get('bossHp') as number) || 0;
      const biome = this.game.registry.get('bossBiome') as string;
      this.showBossBar({ maxHp: bossMaxHp, biome });
      this.updateBossBar({ hp: bossHp, maxHp: bossMaxHp });
    }

    // Re-layout on rotation / window resize. Restarting cleanly rebuilds every
    // element at the new uiScale; shutdown() above unbinds the listeners so
    // they don't accumulate across restarts.
    const onViewportChanged = () => {
      // Clear joystick state so the player doesn't drift after restart.
      this.game.registry.set('joystickX', 0);
      this.game.registry.set('joystickY', 0);
      if (this.scene.isActive('UI')) this.scene.restart();
    };
    this.game.events.on('viewport-changed', onViewportChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport-changed', onViewportChanged);
    });
  }

  showBossBar(s: any) {
    const W = this.scale.width;
    const barW = this.p(Math.min(420, this.dw() - 40));
    const x = (W - barW) / 2;
    const y = this.p(58); // 20 (top pad) + 38
    if (this.bossBarBg) return;
    const bossName = s?.biome === 'forest' ? 'THE WENDIGO' : s?.biome === 'infected' ? 'THE BLIGHTED ONE' : s?.biome === 'river' ? 'THE FOG PHANTOM' : 'THE ANCIENT RAM';
    this.bossLabel = this.add.text(W / 2, y - this.p(16), bossName, {
      fontFamily: 'monospace', fontSize: this.fs(14), color: '#ff6a6a',
      stroke: '#0b0f1a', strokeThickness: this.p(3)
    }).setOrigin(0.5);
    this.bossBarBg = this.add.rectangle(x, y, barW, this.p(14), 0x11172a).setOrigin(0, 0).setStrokeStyle(this.p(2), 0x6a1a1a);
    this.bossBar = this.add.rectangle(x + this.p(2), y + this.p(2), barW - this.p(4), this.p(10), 0xd94a4a).setOrigin(0, 0);
    this.bossBar.setDataEnabled();
    this.bossBar.setData('maxW', barW - this.p(4));
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
    // Persist so a viewport-driven scene restart preserves the chosen speed.
    this.game.registry.set('uiSpeedIdx', this.speedIdx);
  }

  makeButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0x2a3760).setStrokeStyle(this.p(1), 0x556);
    const t = this.add.text(0, 0, label, { fontFamily: 'monospace', fontSize: this.fs(12), color: '#fff' }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { SFX.play('click'); onClick(); });
    bg.on('pointerover', () => bg.setFillStyle(0x3b4d84));
    bg.on('pointerout', () => bg.setFillStyle(0x2a3760));
    c.add([bg, t]);
    return c;
  }

  makeHotbarSlot(cx: number, topY: number, w: number, h: number, key: string, icon: string, name: string, cost: string, onClick: () => void) {
    const my = topY + h / 2;
    const c = this.add.container(cx, my);

    const g = this.add.graphics();
    const drawSlot = (hover: boolean) => {
      g.clear();
      // Slot fill
      g.fillStyle(hover ? 0x141c30 : 0x0a0e1a, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, this.p(3));
      // Gold border
      g.lineStyle(this.p(1.5), hover ? 0xc4a030 : 0x8a6a20, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, this.p(3));
      // Inner glow
      g.lineStyle(this.p(1), hover ? 0xa08830 : 0xa08030, hover ? 0.2 : 0.12);
      g.strokeRoundedRect(-w / 2 + this.p(2), -h / 2 + this.p(2), w - this.p(4), h - this.p(4), this.p(2));
    };
    drawSlot(false);

    // Hit area
    const hitRect = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hitRect.on('pointerdown', () => { SFX.play('click'); onClick(); });
    hitRect.on('pointerover', () => drawSlot(true));
    hitRect.on('pointerout', () => drawSlot(false));

    // Draw icon
    const iconG = this.add.graphics();
    this.drawSlotIcon(iconG, icon);

    // Keybind badge (top-left corner)
    const badgeW = key.length > 2 ? this.p(22) : this.p(13);
    const badgeBg = this.add.rectangle(-w / 2 + badgeW / 2 + this.p(1), -h / 2 + this.p(7), badgeW, this.p(12), 0x0a0e1a, 0.9)
      .setStrokeStyle(this.p(0.5), 0x8a6a20, 0.5);
    const badge = this.add.text(-w / 2 + badgeW / 2 + this.p(1), -h / 2 + this.p(7), key, {
      fontFamily: 'monospace', fontSize: this.fs(8), color: '#a08830',
    }).setOrigin(0.5);

    // Name label below slot
    const nameLabel = this.add.text(0, h / 2 + this.p(4), name, {
      fontFamily: 'monospace', fontSize: this.fs(8), color: '#8a9ab0',
    }).setOrigin(0.5, 0);

    const items: Phaser.GameObjects.GameObject[] = [g, hitRect, iconG, badgeBg, badge, nameLabel];

    // Cost label below name
    if (cost) {
      const costLabel = this.add.text(0, h / 2 + this.p(14), cost, {
        fontFamily: 'monospace', fontSize: this.fs(8), color: '#ffd84a',
      }).setOrigin(0.5, 0);
      items.push(costLabel);
    }

    c.add(items);
    return c;
  }

  drawSlotIcon(g: Phaser.GameObjects.Graphics, icon: string) {
    const cx = 0, cy = 0;
    const s = this.sf;
    switch (icon) {
      case 'arrow': {
        // Arrow shaft (diagonal)
        g.lineStyle(2.5 * s, 0xc4a850, 1);
        g.lineBetween(cx + 10 * s, cy + 10 * s, cx - 8 * s, cy - 8 * s);
        // Arrowhead
        g.fillStyle(0xc4a850, 1);
        g.fillTriangle(cx - 12 * s, cy - 12 * s, cx - 4 * s, cy - 10 * s, cx - 10 * s, cy - 2 * s);
        // Fletching
        g.lineStyle(1.5 * s, 0xa08830, 0.8);
        g.lineBetween(cx + 10 * s, cy + 10 * s, cx + 12 * s, cy + 6 * s);
        g.lineBetween(cx + 10 * s, cy + 10 * s, cx + 6 * s, cy + 12 * s);
        break;
      }
      case 'cannon': {
        // Cannonball shadow
        g.fillStyle(0x1a1a1a, 0.5);
        g.fillCircle(cx + 1 * s, cy + 2 * s, 9 * s);
        // Main ball
        g.fillStyle(0x2a2a2a, 1);
        g.fillCircle(cx, cy, 9 * s);
        // Subtle gradient layers
        g.fillStyle(0x3a3a3a, 1);
        g.fillCircle(cx - 1 * s, cy - 1 * s, 8 * s);
        // Primary light reflection (top-left)
        g.fillStyle(0x606060, 0.7);
        g.fillCircle(cx - 3 * s, cy - 3 * s, 4 * s);
        // Bright highlight spot
        g.fillStyle(0x8a8a8a, 0.6);
        g.fillCircle(cx - 4 * s, cy - 4 * s, 2 * s);
        // Small specular dot
        g.fillStyle(0xbbbbbb, 0.5);
        g.fillCircle(cx - 4.5 * s, cy - 4.5 * s, 1 * s);
        break;
      }
      case 'mage': {
        // Staff
        g.lineStyle(2.5 * s, 0x8a6adf, 1);
        g.lineBetween(cx, cy - 10 * s, cx, cy + 10 * s);
        // Orb glow
        g.fillStyle(0xb090ff, 0.3);
        g.fillCircle(cx, cy - 10 * s, 5 * s);
        // Orb
        g.fillStyle(0xb090ff, 0.9);
        g.fillCircle(cx, cy - 10 * s, 3.5 * s);
        g.fillStyle(0xd0c0ff, 1);
        g.fillCircle(cx, cy - 10 * s, 2 * s);
        // Specular
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(cx - 1 * s, cy - 11 * s, 1 * s);
        // Side wisps
        g.lineStyle(1 * s, 0x9a7aef, 0.5);
        g.lineBetween(cx, cy - 6 * s, cx - 4 * s, cy - 9 * s);
        g.lineBetween(cx, cy - 6 * s, cx + 4 * s, cy - 9 * s);
        g.fillStyle(0xb090ff, 0.4);
        g.fillCircle(cx - 4 * s, cy - 9 * s, 1 * s);
        g.fillCircle(cx + 4 * s, cy - 9 * s, 1 * s);
        // Staff base
        g.lineStyle(2 * s, 0x8a6adf, 1);
        g.lineBetween(cx - 3 * s, cy + 10 * s, cx + 3 * s, cy + 10 * s);
        break;
      }
      case 'wall': {
        // 3-row brick wall matching HTML mockup SVG layout
        // SVG viewBox is 28x28, icon area +-14 from center
        const bw = 11 * s, bh = 6 * s;
        const colors = [0xb0a080, 0x8a7a60];
        const ox = cx - 14 * s; // origin offset to match SVG viewBox 0,0
        const oy = cy - 14 * s;
        // Row 0 (y=4): two full-width bricks
        g.fillStyle(colors[0], 1); g.fillRect(ox + 2 * s, oy + 4 * s, bw, bh);
        g.fillStyle(colors[1], 1); g.fillRect(ox + 15 * s, oy + 4 * s, bw, bh);
        // Row 1 (y=11): offset — half brick, full brick, half brick
        g.fillStyle(colors[1], 1); g.fillRect(ox + 8 * s, oy + 11 * s, bw, bh);
        g.fillStyle(colors[0], 1); g.fillRect(ox + 2 * s, oy + 11 * s, 5 * s, bh);
        g.fillStyle(colors[0], 1); g.fillRect(ox + 20 * s, oy + 11 * s, 6 * s, bh);
        // Row 2 (y=18): two full-width bricks
        g.fillStyle(colors[0], 1); g.fillRect(ox + 2 * s, oy + 18 * s, bw, bh);
        g.fillStyle(colors[1], 1); g.fillRect(ox + 15 * s, oy + 18 * s, bw, bh);
        // Mortar lines on all bricks
        g.lineStyle(0.5 * s, 0x4a3a2a, 0.5);
        g.strokeRect(ox + 2 * s, oy + 4 * s, bw, bh);
        g.strokeRect(ox + 15 * s, oy + 4 * s, bw, bh);
        g.strokeRect(ox + 8 * s, oy + 11 * s, bw, bh);
        g.strokeRect(ox + 2 * s, oy + 11 * s, 5 * s, bh);
        g.strokeRect(ox + 20 * s, oy + 11 * s, 6 * s, bh);
        g.strokeRect(ox + 2 * s, oy + 18 * s, bw, bh);
        g.strokeRect(ox + 15 * s, oy + 18 * s, bw, bh);
        break;
      }
      case 'speed': {
        // Drawn via text overlay (speedLabel)
        break;
      }
    }
  }

  updateHud(s: any) {
    if (!s) return;
    this.nameText.setText(s.name ?? 'Ranger');
    const pct = Math.max(0, s.hp / s.maxHp);
    const hpBarInner = this.p(178);
    this.hpBar.width = hpBarInner * pct;
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
          this.progressCircles[i].setStrokeStyle(this.p(2), 0xff6a6a);
          this.progressCircles[i].setFillStyle(0x3a1010);
          this.progressLabels[i].setColor('#ff6a6a');
        } else {
          // Boss not yet
          this.progressCircles[i].setStrokeStyle(this.p(2), 0x2a3760);
          this.progressCircles[i].setFillStyle(0x11172a);
          this.progressLabels[i].setColor('#556');
        }
      } else if (waveNum < currentWave || (waveNum === currentWave && s.bossSpawned)) {
        // Completed wave - green with checkmark
        this.progressCircles[i].setStrokeStyle(this.p(2), 0x4ad96a);
        this.progressCircles[i].setFillStyle(0x1a3a1a);
        this.progressLabels[i].setText('\u2713');
        this.progressLabels[i].setColor('#4ad96a');
      } else if (waveNum === currentWave) {
        // Current wave - bright blue highlight
        this.progressCircles[i].setStrokeStyle(this.p(2), 0x7cc4ff);
        this.progressCircles[i].setFillStyle(0x1a2a4a);
        this.progressLabels[i].setText(`${waveNum}`);
        this.progressLabels[i].setColor('#7cc4ff');
      } else {
        // Future wave - dim
        this.progressCircles[i].setStrokeStyle(this.p(2), 0x2a3760);
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
      // Match the clamped wave bar width — bg width minus the inset border.
      const maxW = this.waveBarBg.width - this.p(4);
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
    const box = this.add.rectangle(W / 2, H / 2, this.p(380), this.p(200), 0x11172a).setStrokeStyle(this.p(2), 0x2a3760);
    const title = this.add.text(W / 2, H / 2 - this.p(60), s.win ? 'VICTORY' : 'DEFEAT',
      { fontFamily: 'monospace', fontSize: this.fs(32), color: s.win ? '#7cf29a' : '#ff6a6a' }).setOrigin(0.5);
    const sub = this.add.text(W / 2, H / 2 - this.p(10), `${s.name}   Kills: ${s.kills}   $ ${s.money}`,
      { fontFamily: 'monospace', fontSize: this.fs(14), color: '#ccd' }).setOrigin(0.5);
    const btn = this.makeButton(W / 2, H / 2 + this.p(40), this.p(140), this.p(32), 'RETURN TO MAP', () => {
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
    this.game.events.off('build-error');
  }
}
