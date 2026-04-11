import Phaser from 'phaser';
import { CFG } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const overlay = document.getElementById('overlay') as HTMLDivElement;
const nameInput = document.getElementById('playerName') as HTMLInputElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;

let started = false;

// Keep the screen awake so the game doesn't pause/restart when the user
// walks away. Re-acquires the lock whenever the tab becomes visible again.
let wakeLock: any = null;
async function requestWakeLock() {
  try {
    const nav: any = navigator;
    if (nav.wakeLock && typeof nav.wakeLock.request === 'function') {
      wakeLock = await nav.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    }
  } catch (err) {
    // user may have denied, or API unsupported — not fatal
    console.warn('Wake lock unavailable:', err);
  }
}
document.addEventListener('visibilitychange', () => {
  if (started && document.visibilityState === 'visible' && !wakeLock) {
    requestWakeLock();
  }
});

function start() {
  if (started) return;
  started = true;
  const name = (nameInput.value || 'hero').trim().slice(0, 14);
  (window as any).__playerName = name;

  // Switch overlay to loading state (keep it visible)
  const panel = overlay.querySelector('.panel') as HTMLDivElement;
  panel.classList.add('loading');
  requestWakeLock();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: CFG.width,
    height: CFG.height,
    backgroundColor: '#0b0f1a',
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, GameScene, UIScene]
  });

  // Hide overlay once the game scene is ready
  game.events.on('game-ready', () => {
    overlay.classList.add('hidden');
  });
}

startBtn.addEventListener('click', start);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
