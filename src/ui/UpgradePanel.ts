import Phaser from 'phaser';
import type { UIScene } from '../scenes/UIScene';
import { UPGRADABLE_STATS, STAT_LABEL, type UpgradableStat } from '../state/PlayerUpgradeState';

/**
 * Player-upgrade panel — drops down below the UPGRADES HUD button,
 * lists each upgradable stat with its current level, +bonus, cost,
 * and a BUY button. Click outside or the × to close (UIScene resumes
 * physics).
 */
export class UpgradePanel {
  private root: Phaser.GameObjects.Container;
  private detailTexts: Phaser.GameObjects.Text[] = [];
  private buyBgs: Phaser.GameObjects.Graphics[] = [];
  private buyTexts: Phaser.GameObjects.Text[] = [];
  private buyRects: { x: number; y: number; w: number; h: number }[] = [];
  private uiScene: UIScene;
  private gameScene: any;
  private onClose: () => void;
  private destroyed = false;

  constructor(
    uiScene: UIScene,
    gameScene: any,
    anchor: { x: number; y: number; w: number; h: number },
    onClose: () => void,
  ) {
    this.uiScene = uiScene;
    this.gameScene = gameScene;
    this.onClose = onClose;

    const p = (v: number) => uiScene.p(v);
    const fs = (v: number) => uiScene.fs(v);
    const W = uiScene.scale.width;
    const H = uiScene.scale.height;

    const panelW = p(280);
    const panelH = p(340);
    // Right-align panel with the upgrade button so it reads as a dropdown,
    // then clamp into the viewport with a small margin.
    let panelX = anchor.x + anchor.w - panelW;
    let panelY = anchor.y + anchor.h + p(6);
    const margin = p(8);
    if (panelX < margin) panelX = margin;
    if (panelX + panelW > W - margin) panelX = W - margin - panelW;
    if (panelY + panelH > H - margin) panelY = Math.max(margin, H - margin - panelH);
    const r = p(10);

    const backdrop = uiScene.add.rectangle(0, 0, W, H, 0x000000, 0.45)
      .setOrigin(0, 0)
      .setInteractive();
    backdrop.on('pointerdown', () => this.close());

    const panelBg = uiScene.add.graphics();
    panelBg.fillStyle(0x0b0f1a, 0.96);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, r);
    panelBg.lineStyle(p(2), 0xffd84a, 0.85);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, r);
    // Eat clicks anywhere on the panel body so empty space inside it
    // doesn't fall through to the backdrop's close handler.
    const panelHit = uiScene.add.rectangle(panelX, panelY, panelW, panelH, 0x000000, 0)
      .setOrigin(0, 0)
      .setInteractive();

    const title = uiScene.add.text(panelX + p(14), panelY + p(18), 'PLAYER UPGRADES', {
      fontFamily: 'monospace', fontSize: fs(14), fontStyle: 'bold', color: '#ffd84a',
    }).setOrigin(0, 0.5);

    const closeHitW = p(36), closeHitH = p(28);
    const closeCx = panelX + panelW - p(18), closeCy = panelY + p(18);
    const closeText = uiScene.add.text(closeCx, closeCy, '×', {
      fontFamily: 'monospace', fontSize: fs(22), fontStyle: 'bold', color: '#ff8a8a',
    }).setOrigin(0.5);
    const closeHit = uiScene.add.rectangle(closeCx, closeCy, closeHitW, closeHitH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => this.close());

    const children: Phaser.GameObjects.GameObject[] = [
      backdrop, panelBg, panelHit, title, closeText, closeHit,
    ];

    const rowY0 = panelY + p(44);
    const rowH = p(54);
    const rowBgX = panelX + p(10);
    const rowBgW = panelW - p(20);

    UPGRADABLE_STATS.forEach((stat, i) => {
      const rowY = rowY0 + i * rowH;
      const rowBg = uiScene.add.graphics();
      rowBg.fillStyle(0x141a28, 0.85);
      rowBg.fillRoundedRect(rowBgX, rowY, rowBgW, rowH - p(6), p(6));

      const label = uiScene.add.text(rowBgX + p(10), rowY + p(8), STAT_LABEL[stat], {
        fontFamily: 'monospace', fontSize: fs(12), fontStyle: 'bold', color: '#dfe8ff',
      });
      const detail = uiScene.add.text(rowBgX + p(10), rowY + p(24), '', {
        fontFamily: 'monospace', fontSize: fs(10), color: '#9ab0d0',
      });
      this.detailTexts.push(detail);

      const btnW = p(70), btnH = p(28);
      const btnCx = rowBgX + rowBgW - btnW / 2 - p(6);
      const btnCy = rowY + (rowH - p(6)) / 2;
      const btnX = btnCx - btnW / 2, btnY = btnCy - btnH / 2;
      const btnBg = uiScene.add.graphics();
      const btnText = uiScene.add.text(btnCx, btnCy, 'BUY', {
        fontFamily: 'monospace', fontSize: fs(12), fontStyle: 'bold', color: '#dfffe8',
      }).setOrigin(0.5);
      const btnHit = uiScene.add.rectangle(btnCx, btnCy, btnW, btnH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      btnHit.on('pointerdown', () => this.tryBuy(stat));
      this.buyBgs.push(btnBg);
      this.buyTexts.push(btnText);
      this.buyRects.push({ x: btnX, y: btnY, w: btnW, h: btnH });

      children.push(rowBg, label, detail, btnBg, btnText, btnHit);
    });

    this.root = uiScene.add.container(0, 0, children).setDepth(2000);
    this.refresh();
  }

  private tryBuy(stat: UpgradableStat) {
    const player = this.gameScene.player;
    const upg = this.gameScene.playerUpgrades;
    const cost = upg.cost(stat);
    if (!player || player.money < cost) return;
    player.money -= cost;
    upg.buy(stat);
    if (stat === 'maxHp') {
      player.maxHp = Math.max(1, Math.round(this.gameScene.playerBaseMaxHp * upg.multiplier('maxHp')));
      player.hp = player.maxHp;
    }
    this.gameScene.hud?.pushHud?.();
    this.refresh();
  }

  private refresh() {
    if (this.destroyed) return;
    const player = this.gameScene.player;
    const upg = this.gameScene.playerUpgrades;
    const p = (v: number) => this.uiScene.p(v);

    UPGRADABLE_STATS.forEach((stat, i) => {
      const lvl = upg.counts[stat];
      const bonus = Math.round((upg.multiplier(stat) - 1) * 100);
      const cost = upg.cost(stat);
      const affordable = !!player && player.money >= cost;
      this.detailTexts[i].setText(`Lv ${lvl}   +${bonus}%   ${cost} coins`);

      const rect = this.buyRects[i];
      const bg = this.buyBgs[i];
      bg.clear();
      const fillColor = affordable ? 0x2a6a3a : 0x2a2a2a;
      const strokeColor = affordable ? 0x6cd47a : 0x555555;
      bg.fillStyle(fillColor, 0.95);
      bg.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, p(5));
      bg.lineStyle(p(1.5), strokeColor, 0.85);
      bg.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, p(5));
      this.buyTexts[i].setColor(affordable ? '#dfffe8' : '#888888');
    });
  }

  close() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.root.destroy();
    this.onClose();
  }
}
