import Phaser from 'phaser';
import { CFG } from '../config';

export class UIScene extends Phaser.Scene {
  hpBarBg!: Phaser.GameObjects.Rectangle;
  hpBar!: Phaser.GameObjects.Rectangle;
  nameText!: Phaser.GameObjects.Text;
  moneyText!: Phaser.GameObjects.Text;
  killsText!: Phaser.GameObjects.Text;
  hintText!: Phaser.GameObjects.Text;
  buildText!: Phaser.GameObjects.Text;
  btnTower!: Phaser.GameObjects.Container;
  btnWall!: Phaser.GameObjects.Container;
  btnSpeed!: Phaser.GameObjects.Container;
  speedLabel!: Phaser.GameObjects.Text;
  speedIdx = 0;
  endPanel?: Phaser.GameObjects.Container;
  bossBarBg?: Phaser.GameObjects.Rectangle;
  bossBar?: Phaser.GameObjects.Rectangle;
  bossLabel?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'UI', active: false }); }

  create() {
    const W = this.scale.width;

    // top-left HUD
    this.nameText = this.add.text(12, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#7cc4ff' });
    this.hpBarBg = this.add.rectangle(12, 32, 180, 14, 0x111826).setOrigin(0, 0).setStrokeStyle(1, 0x2a3760);
    this.hpBar = this.add.rectangle(13, 33, 178, 12, 0xd94a4a).setOrigin(0, 0);
    this.moneyText = this.add.text(12, 52, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd84a' });
    this.killsText = this.add.text(12, 72, '', { fontFamily: 'monospace', fontSize: '14px', color: '#eee' });

    this.hintText = this.add.text(12, this.scale.height - 22,
      `1=Tower(${CFG.tower.cost})  2=Wall(${CFG.wall.cost})  Click tower=Info  Hold X+Click=Sell  ESC=Cancel`,
      { fontFamily: 'monospace', fontSize: '12px', color: '#667' });

    this.buildText = this.add.text(W - 12, 10, '', { fontFamily: 'monospace', fontSize: '13px', color: '#7cc4ff' }).setOrigin(1, 0);

    // build buttons (top-right)
    this.btnTower = this.makeButton(W - 160, 34, 70, 28, `TOWER ${CFG.tower.cost}`, () => this.game.events.emit('ui-build', 'tower'));
    this.btnWall = this.makeButton(W - 82, 34, 70, 28, `WALL ${CFG.wall.cost}`, () => this.game.events.emit('ui-build', 'wall'));

    // speed toggle (top-right, above build buttons)
    this.btnSpeed = this.makeButton(W - 46, 10, 40, 18, '> 1x', () => this.cycleSpeed());
    this.speedLabel = this.btnSpeed.list[1] as Phaser.GameObjects.Text;
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on('down', () => this.cycleSpeed());

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
    const y = 84;
    if (this.bossBarBg) return;
    this.bossLabel = this.add.text(W / 2, y - 16, 'THE BROOD MOTHER', {
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
    const speeds = [1, 2, 4];
    const labels = ['> 1x', '>> 2x', '>>> 4x'];
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

  updateHud(s: any) {
    if (!s) return;
    this.nameText.setText(s.name ?? 'hero');
    const pct = Math.max(0, s.hp / s.maxHp);
    this.hpBar.width = 178 * pct;
    this.hpBar.fillColor = pct > 0.5 ? 0x4ad96a : pct > 0.25 ? 0xd9a84a : 0xd94a4a;
    this.moneyText.setText(`$ ${s.money}`);
    if (s.bossSpawned) {
      this.killsText.setText(`Kill the Boss!`);
      this.killsText.setColor('#ff6a6a');
    } else {
      this.killsText.setText(`Kills: ${s.kills}/${s.target} -> Boss`);
      this.killsText.setColor('#eee');
    }
    this.buildText.setText(s.build === 'none' ? 'Build: —' : `Build: ${s.build.toUpperCase()}`);
  }

  showEnd(s: any) {
    if (this.endPanel) return;
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0);
    const box = this.add.rectangle(W / 2, H / 2, 380, 200, 0x11172a).setStrokeStyle(2, 0x2a3760);
    const title = this.add.text(W / 2, H / 2 - 60, s.win ? 'VICTORY' : 'DEFEAT',
      { fontFamily: 'monospace', fontSize: '32px', color: s.win ? '#7cf29a' : '#ff6a6a' }).setOrigin(0.5);
    const sub = this.add.text(W / 2, H / 2 - 10, `${s.name}   Kills: ${s.kills}   $ ${s.money}`,
      { fontFamily: 'monospace', fontSize: '14px', color: '#ccd' }).setOrigin(0.5);
    const btn = this.makeButton(W / 2 - 50, H / 2 + 40, 100, 32, 'RESTART', () => location.reload());
    this.endPanel = this.add.container(0, 0, [bg, box, title, sub, btn]);
  }
}
