import { CFG } from '../config';
import { getRegistry } from '../core/registry';
import { getEvents } from '../core/events';
import { Tower } from '../entities/Tower';
import { SFX } from '../audio/sfx';
import type { GameScene } from '../scenes/GameScene';

/**
 * Tower selection ring + the upgrade/sell panel that appears above (or
 * below, on mobile near the screen top) a tapped tower. Owns the panel
 * geometry, the upgrade and sell button handlers, and the deselect/freeze
 * lifecycle.
 */
export class TowerPanelSystem {
  constructor(private scene: GameScene) {}

  selectTower(t: Tower) {
    const scene = this.scene;
    scene.selectedTower = t;
    this.drawSelectionRing(t);
    this.buildPanel(t);
    getEvents(scene.game.events).emit('tutorial-tower-selected');
    // Freeze game while tower panel is open
    if (!scene.buildState.paused) {
      scene.buildState.paused = true;
      scene.physics.pause();
      scene.tweens.pauseAll();
      scene.anims.pauseAll();
    }
  }

  deselectTower() {
    const scene = this.scene;
    scene.selectedTower = null;
    scene.selectionRing.clear().setVisible(false);
    scene.towerPanel.removeAll(true);
    scene.towerPanel.setVisible(false);
    getEvents(scene.game.events).emit('tutorial-tower-deselected');
    // Unfreeze if no build mode active either
    if (scene.buildState.paused && scene.buildState.kind === 'none') {
      scene.buildState.paused = false;
      scene.physics.resume();
      scene.tweens.resumeAll();
      scene.anims.resumeAll();
    }
  }

  drawSelectionRing(t: Tower) {
    const st = t.stats();
    const g = this.scene.selectionRing;
    g.clear();
    g.lineStyle(2, 0x7cc4ff, 0.8);
    g.strokeCircle(t.x, t.y, st.range);
    g.lineStyle(1, 0x7cc4ff, 0.25);
    g.strokeCircle(t.x, t.y, st.range - 3);
    g.setVisible(true);
  }

  pointInPanel(wx: number, wy: number): boolean {
    const scene = this.scene;
    if (!scene.towerPanel.visible) return false;
    const b = scene.towerPanelBounds;
    return wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h;
  }

  buildPanel(t: Tower) {
    const scene = this.scene;
    const panel = scene.towerPanel;
    panel.removeAll(true);

    // Mobile gets a 1.5× larger panel so the buttons are tap-friendly. Every
    // literal pixel size below is multiplied by `ms` so the layout stays
    // proportional at the larger size (text included via fontSize: `${n*ms}px`).
    const isMobile = !!getRegistry(scene.game).get('isMobile');
    const ms = isMobile ? 1.5 : 1;

    const W = 184 * ms, H = 76 * ms;
    const towerHalfH = CFG.tile * t.size / 2;
    const standoff = 10 * ms;

    // Default: panel above the tower with the nub pointing down at it.
    let py = t.y - towerHalfH - H / 2 - standoff;
    let nubAtBottom = true;

    // Mobile: if the panel would clip off the top of the screen OR sit
    // underneath the HUD (which lives in the top ~80 design-pixels of the
    // canvas), flip below the tower with the nub pointing up. The HUD is
    // rendered in canvas pixels, so convert that vertical extent to world
    // units via uiScale / camera zoom before comparing against worldView.
    if (isMobile) {
      const view = scene.cameras.main.worldView;
      const sf = getRegistry(scene.game).get('sf') || 1;
      const camZoom = scene.cameras.main.zoom || 1;
      const hudClearWorld = (90 * sf) / camZoom; // 80px HUD region + a little padding
      if (py - H / 2 < view.y + hudClearWorld) {
        py = t.y + towerHalfH + H / 2 + standoff;
        nubAtBottom = false;
      }
    }

    const px = t.x;
    panel.setPosition(px, py);
    panel.setVisible(true);
    scene.towerPanelBounds = { x: px - W / 2, y: py - H / 2, w: W, h: H };

    // Themed accent — same blue accent the HUD uses for info/wave bars.
    const accent = 0x4a8acc;
    const panelR = 8 * ms;

    // Rounded panel — matches Victory/Defeat language: dark navy fill,
    // subtle inner stroke, themed outer stroke.
    const panelG = scene.add.graphics();
    panelG.fillStyle(0x11172a, 0.97);
    panelG.fillRoundedRect(-W / 2, -H / 2, W, H, panelR);
    panelG.lineStyle(1 * ms, 0x2a3760, 0.7);
    panelG.strokeRoundedRect(-W / 2 + 3 * ms, -H / 2 + 3 * ms, W - 6 * ms, H - 6 * ms, panelR - 2 * ms);
    panelG.lineStyle(2 * ms, accent, 0.85);
    panelG.strokeRoundedRect(-W / 2, -H / 2, W, H, panelR);
    panel.add(panelG);

    // Pointer nub — drawn with Graphics rather than the Triangle Shape so
    // it (a) lands centered horizontally on the panel (Phaser's Triangle
    // Shape uses Math.max(x1,x2,x3) for its width, which throws centering
    // off when vertex coords straddle 0), and (b) has its base flush with
    // the panel edge so the nub and panel touch with no visible gap.
    const nubHalfW = 6 * ms;
    const nubH = 8 * ms;
    const baseY = nubAtBottom ? H / 2 : -H / 2;
    const apexY = nubAtBottom ? baseY + nubH : baseY - nubH;
    const nubG = scene.add.graphics();
    nubG.fillStyle(0x11172a, 1);
    nubG.beginPath();
    nubG.moveTo(-nubHalfW, baseY);
    nubG.lineTo(nubHalfW, baseY);
    nubG.lineTo(0, apexY);
    nubG.closePath();
    nubG.fillPath();
    // Stroke only the two slanted sides — the base sits on top of the
    // panel's outline, so a base stroke would just double-draw it.
    nubG.lineStyle(1 * ms, accent, 1);
    nubG.beginPath();
    nubG.moveTo(-nubHalfW, baseY);
    nubG.lineTo(0, apexY);
    nubG.lineTo(nubHalfW, baseY);
    nubG.strokePath();
    panel.add(nubG);

    // Title
    const tr = scene.sf;
    const title = scene.add.text(-W / 2 + 10 * ms, -H / 2 + 7 * ms, `${t.kind.toUpperCase()}  LVL ${t.level + 1}`, {
      fontFamily: 'monospace', fontSize: `${12 * ms}px`, fontStyle: 'bold', color: '#7cc4ff',
      stroke: '#0b0f1a', strokeThickness: 2 * ms
    }).setResolution(tr);
    panel.add(title);

    const sellVal = Math.floor(t.totalSpent * 0.5);

    // Stats
    const st = t.stats();
    const splashLine = st.splashRadius > 0 ? `  AOE ${st.splashRadius}` : '';
    const stats = scene.add.text(-W / 2 + 10 * ms, -H / 2 + 24 * ms,
      `DMG ${st.damage}  RNG ${st.range}${splashLine}\nFIRE ${(1000 / st.fireRate).toFixed(1)}/s  HP ${t.hp}/${t.maxHp}`,
      { fontFamily: 'monospace', fontSize: `${10 * ms}px`, color: '#ccd' }).setResolution(tr);
    panel.add(stats);

    // ---- Buttons — rounded, themed strokes (green=affordable, red=can't / sell)
    const btnW = 80 * ms, btnH = 22 * ms, btnR = 5 * ms;
    const btnY = H / 2 - btnH / 2 - 6 * ms;

    // Upgrade
    const canUp = t.canUpgrade();
    const upCost = t.upgradeCost();
    const affordable = canUp && scene.player.money >= upCost;
    const upLabel = canUp ? `UPGRADE $${upCost}` : 'MAX LEVEL';
    const upStroke = !canUp ? 0x556677 : affordable ? 0x4ad96a : 0xd94a4a;
    const upTextColor = !canUp ? '#888' : affordable ? '#7cf29a' : '#ff9a9a';
    const upX = -W / 2 + 8 * ms, upCX = upX + btnW / 2;
    const upG = scene.add.graphics();
    let upHover = false;
    const drawUp = () => {
      upG.clear();
      upG.fillStyle(upHover && canUp ? 0x1a2238 : 0x0b0f1a, 0.95);
      upG.fillRoundedRect(upX, btnY - btnH / 2, btnW, btnH, btnR);
      upG.lineStyle(1.5 * ms, upStroke, upHover && canUp ? 1 : 0.85);
      upG.strokeRoundedRect(upX, btnY - btnH / 2, btnW, btnH, btnR);
    };
    drawUp();
    const upTxt = scene.add.text(upCX, btnY, upLabel, {
      fontFamily: 'monospace', fontSize: `${10 * ms}px`, fontStyle: 'bold', color: upTextColor,
      stroke: '#0b0f1a', strokeThickness: 2 * ms
    }).setOrigin(0.5).setResolution(tr);
    panel.add([upG, upTxt]);
    if (canUp) {
      const upHit = scene.add.rectangle(upCX, btnY, btnW, btnH, 0x000000, 0).setInteractive({ useHandCursor: true });
      upHit.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        this.doUpgradeSelected();
      });
      upHit.on('pointerover', () => { upHover = true; drawUp(); });
      upHit.on('pointerout',  () => { upHover = false; drawUp(); });
      panel.add(upHit);
    }

    // Sell
    const sellX = W / 2 - 8 * ms - btnW, sellCX = sellX + btnW / 2;
    const sellG = scene.add.graphics();
    let sellHover = false;
    const drawSell = () => {
      sellG.clear();
      sellG.fillStyle(sellHover ? 0x1a2238 : 0x0b0f1a, 0.95);
      sellG.fillRoundedRect(sellX, btnY - btnH / 2, btnW, btnH, btnR);
      sellG.lineStyle(1.5 * ms, 0xd94a4a, sellHover ? 1 : 0.85);
      sellG.strokeRoundedRect(sellX, btnY - btnH / 2, btnW, btnH, btnR);
    };
    drawSell();
    const sellTxt = scene.add.text(sellCX, btnY, `SELL $${sellVal}`, {
      fontFamily: 'monospace', fontSize: `${10 * ms}px`, fontStyle: 'bold', color: '#ffd6c0',
      stroke: '#0b0f1a', strokeThickness: 2 * ms
    }).setOrigin(0.5).setResolution(tr);
    const sellHit = scene.add.rectangle(sellCX, btnY, btnW, btnH, 0x000000, 0).setInteractive({ useHandCursor: true });
    sellHit.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (getRegistry(scene.game).get('tutorialActive')) return;
      this.doSellSelected();
    });
    sellHit.on('pointerover', () => { sellHover = true; drawSell(); });
    sellHit.on('pointerout',  () => { sellHover = false; drawSell(); });
    panel.add([sellG, sellTxt, sellHit]);
  }

  doUpgradeSelected() {
    const scene = this.scene;
    const t = scene.selectedTower;
    if (!t) return;
    if (!t.canUpgrade()) return;
    const cost = t.upgradeCost();
    if (scene.player.money < cost) {
      scene.hud.floatText(t.x, t.y - 40, `NEED $${cost}`, '#ff6a6a');
      return;
    }
    scene.player.money -= cost;
    scene.runStats.coinsSpent += cost;
    t.totalSpent += cost;
    t.upgrade();
    // Track highest tower level reached and count max-tier upgrades.
    if (t.level > scene.runStats.highestTowerLevel) scene.runStats.highestTowerLevel = t.level;
    if (!t.canUpgrade()) scene.runStats.towersUpgradedToMax++;
    SFX.play('upgrade');
    scene.hud.floatText(t.x, t.y - 40, `LVL ${t.level + 1}`, '#7cf29a');
    getEvents(scene.game.events).emit('tutorial-tower-upgraded');
    scene.hud.pushHud();
    // Auto-close the panel — the upgrade succeeded so the player isn't
    // about to do anything else with this tower.
    this.deselectTower();
  }

  doSellSelected() {
    const scene = this.scene;
    const t = scene.selectedTower;
    if (!t) return;
    // Start the same red-pie countdown walls use, then close the panel
    // immediately so the world resumes — towers no longer sell instantly.
    scene.sell.startSellTimer(t);
    this.deselectTower();
  }
}
