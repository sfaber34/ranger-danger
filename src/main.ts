import Phaser from 'phaser';
import { CFG } from './config';
import { BootScene } from './scenes/BootScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { TutorialScene } from './scenes/TutorialScene';
import { SFX } from './audio/sfx';
import { installViewportResizeListener } from './viewport';
import { getRegistry } from './core/registry';
import { getEvents } from './core/events';

const overlay = document.getElementById('overlay') as HTMLDivElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;

let started = false;

// Preload the castle-door whoosh so it can fire instantly on the PLAY click
// (decoding a 100KB WAV inside the gesture would cost a perceptible delay).
let playBtnBuffer: ArrayBuffer | null = null;
fetch('/audio/PlayButton.wav').then(r => r.arrayBuffer()).then(b => { playBtnBuffer = b; }).catch(() => {});

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

  // Start the intro theme via the preloaded <audio> element so it fires
  // instantly on this gesture (no fetch/decode delay). It keeps playing
  // through level-select; LevelSelectScene.startMission stops it so the
  // biome track can take over.
  const intro = document.getElementById('introMusic') as HTMLAudioElement | null;
  if (intro) {
    intro.volume = 0.07;
    intro.play().catch((err) => {
      console.warn('intro audio play() rejected:', err);
    });
  }

  // Castle-door whoosh: play the preloaded buffer with the same rate +
  // offset that LevelSelectScene uses for its level/difficulty/start
  // clicks, so the sound is identical across init + map screens. Gain is
  // tuned to match the level-select clicks' effective volume after they
  // pass through the SFX manager's master gain (volume * 0.32).
  if (playBtnBuffer) {
    const ctx = new AudioContext();
    ctx.decodeAudioData(playBtnBuffer.slice(0)).then(audioBuf => {
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.playbackRate.value = 2.0;
      const g = ctx.createGain();
      g.gain.value = 0.11;
      src.connect(g);
      g.connect(ctx.destination);
      src.start(0, 0.12);
    });
  }

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
    // Allow up to 3 simultaneous touch points so mobile players can hold the
    // virtual joystick and tap a hotbar slot (or speed button) at the same
    // time. Phaser defaults to 1 active touch pointer, which silently drops
    // every additional finger.
    input: { activePointers: 3 },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    scene: [BootScene, LevelSelectScene, GameScene, UIScene, TutorialScene]
  });

  // Hide overlay once GameScene is ready (after "Generating world..." from level select)
  getEvents(game.events).on('game-ready', () => {
    overlay.classList.add('hidden');
    const landing = document.getElementById('landingPanel');
    if (landing) landing.classList.remove('loading');
  });

  // Resize / orientation handling. When the viewport changes, update the
  // shared scale registry values and broadcast a `viewport-changed` event.
  // Each scene is responsible for setting its own gameSize (LevelSelect locks
  // to a 3:2 fit; GameScene fills the device viewport), so this top-level
  // handler intentionally does NOT call setGameSize itself.
  const reg = getRegistry(game);
  installViewportResizeListener((vp) => {
    reg.set('sf', vp.uiScale);
    reg.set('cameraZoom', vp.cameraZoom);
    reg.set('uiScale', vp.uiScale);
    reg.set('isMobile', vp.isMobile);
    getEvents(game.events).emit('viewport-changed', vp);
  });
}

startBtn.addEventListener('click', start);
