import Phaser from 'phaser';
import { CFG } from './config';
import { BootScene } from './scenes/BootScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { SFX } from './audio/sfx';
import { installViewportResizeListener } from './viewport';

const overlay = document.getElementById('overlay') as HTMLDivElement;
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

  // Unlock audio FIRST, synchronously, while we're still inside the click
  // gesture. iOS requires this for both WebAudio resume and the silent-loop
  // hack that bypasses the mute switch.
  SFX.unlock();

  // Hide overlay immediately — level select appears fast since art is deferred
  overlay.classList.add('hidden');
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
      autoCenter: Phaser.Scale.NO_CENTER
    },
    scene: [BootScene, LevelSelectScene, GameScene, UIScene]
  });

  // Hide overlay once GameScene is ready (after "Generating world..." from level select)
  game.events.on('game-ready', () => {
    overlay.classList.add('hidden');
    const landing = document.getElementById('landingPanel');
    if (landing) landing.classList.remove('loading');
  });

  // Resize / orientation handling. When the viewport changes, update the
  // shared scale registry values and broadcast a `viewport-changed` event.
  // Each scene is responsible for setting its own gameSize (LevelSelect locks
  // to a 3:2 fit; GameScene fills the device viewport), so this top-level
  // handler intentionally does NOT call setGameSize itself.
  installViewportResizeListener((vp) => {
    game.registry.set('sf', vp.uiScale);
    game.registry.set('cameraZoom', vp.cameraZoom);
    game.registry.set('uiScale', vp.uiScale);
    game.registry.set('isMobile', vp.isMobile);
    game.events.emit('viewport-changed', vp);
  });
}

startBtn.addEventListener('click', start);
