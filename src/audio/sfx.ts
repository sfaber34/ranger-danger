/**
 * Sound effects manager.
 *
 * Drop WAV/MP3/OGG files into public/audio/ and map them below.
 * Any sound without a file falls back to a jsfxr-generated tone.
 *
 * File naming convention:  public/audio/<key>.wav  (e.g. public/audio/arrowShoot.wav)
 */
import { sfxr } from 'jsfxr';

// ---- Sound keys the game uses ----
const SFX_KEYS = [
  'arrowShoot',   // player & arrow tower fires
  'cannonShoot',  // cannon tower fires
  'hit',          // enemy takes damage
  'coin',         // coin collected
  'towerPlace',   // tower built
  'wallPlace',    // wall placed
  'boom',         // cannon splash explosion
  'bossSpawn',    // boss appears
  'playerHurt',   // player takes damage
  'upgrade',      // tower upgraded
  'victory',      // game won
  'gameOver',     // game lost
  'click',        // UI button click
] as const;

export type SfxKey = typeof SFX_KEYS[number];

// ---- Audio files: map key → path under public/ ----
// When you drop a file into public/audio/, add it here.
// Supported formats: .wav, .mp3, .ogg
const AUDIO_FILES: Partial<Record<SfxKey, string>> = {
  arrowShoot: '/audio/arrow_1.wav',
  cannonShoot: '/audio/cannonfire.flac',
  hit: '/audio/arrowhit.wav',
  // coin: '/audio/coin.wav',
  // towerPlace: '/audio/towerPlace.wav',
  // wallPlace: '/audio/wallPlace.wav',
  // boom: '/audio/boom.wav',
  // bossSpawn: '/audio/bossSpawn.wav',
  // playerHurt: '/audio/playerHurt.wav',
  // upgrade: '/audio/upgrade.wav',
  // victory: '/audio/victory.wav',
  // gameOver: '/audio/gameOver.wav',
  // click: '/audio/click.wav',
};

// ---- jsfxr fallbacks (b58 encoded) for sounds without a file ----
const FALLBACKS: Partial<Record<SfxKey, string>> = {
  arrowShoot:  '7BMHBGKeaSRzutqux35L2nmieBVFHEcyT4QbJ5wDG18HBTGWqmQjdmTadfaCUnpdTSdp946i84nRdcFDxXiHn7RgQ7aoRe8GbZzz2JmWDYufW4eQBQb3Gv8u1',
  cannonShoot: '12eZRSDW9BMogwNAtzYnLSRoy3YwZx6LxmvDVzyRESygjypkNZbnJsttfvpVtet95EpujKgmAYxtqRHddt5TDH7n6g4wjx2qmx8Szk3YFba8fmPKJRa41VF1yZ',
  hit:         '12eZRSDGK2a8nkE7ocbPN2Zfn34PjaBUS2KFypdmt2hBhWtcRfVMabfr2MCGEaj2op9XeKw5NELanteLuMhsgRQVeCwJJsNdEiAj55sMwroNS8kJ8rpm8AQgRD',
  // coin uses a custom programmatic tone (see loadCoin below)
  towerPlace:  '7BMHBGG45s3FvKh6FzS7kZfiABdTAz9MnSYVcFhuDwCxHSywhwSyjDxrPJrV3FA74MLDseKvrHTGsAcCa3vBYDuASRXVABXboaWqYT8joRuAUoYGFeeLGtrt7',
  wallPlace:   '12eZRSDGK2a8ncanb4HHKxEkayTgXz1bEGVRiT35nZXFBk38k5xYdmjADDLNFnMEJPG2gYFCMuHcepZzUbEKmhs6E6CM6oHRi7isDz48fB1m5WcUuAYrdGnHj5',
  boom:        '12eZRSDRnjsSkoovj21LDvGd5SbDnrfDbsaxdmMRaT3XK9Qa8jgXdTSa1MaBys6CgmNjtff7futsPfmfcRpWTZUnXr2TWv2gdboDKZmc6GTpUZxc97qpXJWtyD',
  bossSpawn:   '12eZRSDSVRrD67KRceReSAHfH5R3pqU9JuRJpxZuQ1eMG9Fn1aSWE8wmnE3HgvjZiNptQo2zpHgj9fqofhSaDFuEok9jcFWnVvN3cW1iDBbN4qzVuw8gJNnhKM',
  playerHurt:  '12eZRSDGK26xkrJpNakcz4XTrH1g68EjAXHgAYGhaSMTiyy9kWZ2K1zGM4jjXyKhWXTYXmWo5n7nUEYm22Y12WbJfAHpY4VD37Va7qctx3UbXNTnEyTC9CP2EB',
  // upgrade uses a custom programmatic tone (see loadUpgrade below)
  victory:     '12eZRSDSVRrD4ighYdxUJtJhbVM7kzBaESDDXD9y9c3gB9aqm7KCQmne61TQrJLPbeVZ55B9tgz9FcmqdQGuWbneGcgGAzT38WkhBUNh5tjysbwgkjcuPkTP51',
  gameOver:    '12eZRSDW9BpyimpJ2g3CzvFeX7gYUb8STeQhqTheS6kbAXPHtF43iMHM4X4FDyt6hu2Gpiiz5scgQdCbp1Kd9YLifs2Xp7PKJhDZqHPZAsDXZesN5w4R7vko6X',
  // click uses a custom programmatic tone (see loadClick below)
};

// ---- Manager ----
class SfxManager {
  /** Pre-decoded AudioBuffers for instant playback */
  private buffers: Partial<Record<SfxKey, AudioBuffer>> = {};
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private _volume = 0.22;
  private _muted = false;
  private unlocked = false;
  /** Hidden looping <audio> element used to bypass the iOS silent switch by
   *  forcing Safari into the "playback" audio session category. */
  private silentEl: HTMLAudioElement | null = null;

  // Background music
  private bgmGain: GainNode | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  private _bgmVolume = 0.12;
  private bgmPlaying = false;
  private lastPlayed: Partial<Record<SfxKey, number>> = {};
  private cooldowns: Partial<Record<SfxKey, number>> = {
    hit: 80,
    coin: 50,
    arrowShoot: 60,
    cannonShoot: 100,
    wallPlace: 80,
  };
  /** Per-sound volume multipliers (0–1, default 1) */
  private volumes: Partial<Record<SfxKey, number>> = {
    cannonShoot: 0.75,
  };

  /** SYNCHRONOUS — must be called from inside a user-gesture handler (e.g. the
   *  Play button click). Creates the AudioContext, primes it with a silent
   *  buffer, and starts the silent-loop hack to bypass the iOS mute switch.
   *  Safe to call multiple times — only the first call does work. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this._volume;
      this.gainNode.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this._bgmVolume;
      this.bgmGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Play a one-sample silent buffer to fully unlock iOS WebAudio.
    const silentBuf = this.ctx.createBuffer(1, 1, 22050);
    const silentSrc = this.ctx.createBufferSource();
    silentSrc.buffer = silentBuf;
    silentSrc.connect(this.ctx.destination);
    silentSrc.start(0);

    // iOS mute-switch bypass: a looping <audio> element forces Safari to use
    // the "playback" audio session category, which ignores the silent switch.
    if (!this.silentEl) {
      const el = document.createElement('audio');
      el.src = '/audio/silent.mp3';
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      (el as any).playsInline = true;
      el.style.display = 'none';
      document.body.appendChild(el);
      // Non-fatal if play() rejects (e.g. file missing during dev).
      el.play().catch(() => { /* ignore */ });
      this.silentEl = el;
    }

    this.unlocked = true;
  }

  /** ASYNC — fetches/decodes all sound assets. Requires `unlock()` to have
   *  been called first so an AudioContext exists. */
  async loadAssets() {
    if (!this.ctx) {
      // Fallback: create a context now (decoding works on a suspended context,
      // though playback won't until unlock() is called from a user gesture).
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this._volume;
      this.gainNode.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this._bgmVolume;
      this.bgmGain.connect(this.ctx.destination);
    }

    const loads: Promise<void>[] = [];
    for (const key of SFX_KEYS) {
      const filePath = AUDIO_FILES[key];
      if (filePath) {
        loads.push(this.loadFile(key, filePath));
      } else {
        const b58 = FALLBACKS[key];
        if (b58) this.loadSfxr(key, b58);
      }
    }
    loads.push(this.loadBgm('/audio/bgm_default.mp3'));
    await Promise.all(loads);
    this.loadClick();
    this.loadCoin();
    this.loadUpgrade();
  }

  /** @deprecated kept for any old call sites — equivalent to loadAssets(). */
  async init() { return this.loadAssets(); }

  private async loadFile(key: SfxKey, path: string) {
    try {
      const resp = await fetch(path);
      const arrayBuf = await resp.arrayBuffer();
      this.buffers[key] = await this.ctx!.decodeAudioData(arrayBuf);
    } catch (e) {
      console.warn(`SFX: failed to load ${path}, falling back to synth`);
      const b58 = FALLBACKS[key];
      if (b58) this.loadSfxr(key, b58);
    }
  }

  /** Generate a clean, short sine-wave click (no jsfxr noise) */
  private loadClick() {
    const sr = 44100;
    const len = Math.floor(sr * 0.035); // 35ms
    const buf = this.ctx!.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    const freq = 1800; // Hz — crisp tap pitch
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = 1 - i / len; // linear decay
      ch[i] = Math.sin(2 * Math.PI * freq * t) * env * env * 0.45;
    }
    this.buffers.click = buf;
  }

  /** Mario-style two-tone coin ding */
  private loadCoin() {
    const sr = 44100;
    const noteLen = Math.floor(sr * 0.06); // 60ms per note
    const gap = Math.floor(sr * 0.015);    // 15ms gap
    const totalLen = noteLen + gap + noteLen;
    const buf = this.ctx!.createBuffer(1, totalLen, sr);
    const ch = buf.getChannelData(0);
    const f1 = 988;  // B5
    const f2 = 1319; // E6 (the iconic Mario coin interval)
    const vol = 0.15;
    // First note
    for (let i = 0; i < noteLen; i++) {
      const t = i / sr;
      const env = 1 - (i / noteLen);
      ch[i] = Math.sin(2 * Math.PI * f1 * t) * env * vol;
    }
    // Second note (longer sustain)
    const off = noteLen + gap;
    for (let i = 0; i < noteLen; i++) {
      const t = i / sr;
      const env = 1 - (i / noteLen) * 0.6; // slower decay on second note
      ch[off + i] = Math.sin(2 * Math.PI * f2 * t) * env * vol;
    }
    this.buffers.coin = buf;
  }

  /** Mario power-up style ascending arpeggio */
  private loadUpgrade() {
    const sr = 44100;
    // Fast ascending notes: E5 → G5 → B5 → E6 → G6 → B6 → E7
    const notes = [659, 784, 988, 1319, 1568, 1976, 2637];
    const noteLen = Math.floor(sr * 0.055); // 55ms per note
    const totalLen = notes.length * noteLen;
    const buf = this.ctx!.createBuffer(1, totalLen, sr);
    const ch = buf.getChannelData(0);
    const vol = 0.3;
    for (let n = 0; n < notes.length; n++) {
      const off = n * noteLen;
      const freq = notes[n];
      for (let i = 0; i < noteLen; i++) {
        const t = i / sr;
        const env = 1 - (i / noteLen) * 0.5; // gentle decay per note
        ch[off + i] = Math.sin(2 * Math.PI * freq * t) * env * vol;
      }
    }
    this.buffers.upgrade = buf;
  }

  private loadSfxr(key: SfxKey, b58: string) {
    const samples = sfxr.toBuffer(b58);
    if (!samples || samples.length === 0) return;
    const buf = this.ctx!.createBuffer(1, samples.length, 44100);
    const channel = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = (samples[i] - 128) / 128;
    this.buffers[key] = buf;
  }

  /** Play a sound effect. Uses Web Audio API for instant playback. */
  play(key: SfxKey) {
    if (this._muted || !this.ctx || !this.gainNode) return;
    const buf = this.buffers[key];
    if (!buf) return;

    const now = performance.now();
    const cd = this.cooldowns[key] ?? 0;
    if (cd > 0) {
      const last = this.lastPlayed[key] ?? 0;
      if (now - last < cd) return;
    }
    this.lastPlayed[key] = now;

    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    const vol = this.volumes[key];
    if (vol !== undefined && vol < 1) {
      const g = this.ctx.createGain();
      g.gain.value = vol;
      source.connect(g);
      g.connect(this.gainNode);
    } else {
      source.connect(this.gainNode);
    }
    source.start(0);
  }

  get volume() { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.gainNode) this.gainNode.gain.value = this._volume;
  }

  get muted() { return this._muted; }
  set muted(m: boolean) { this._muted = m; }

  toggle() {
    this._muted = !this._muted;
    // Mute/unmute BGM along with SFX
    if (this.bgmGain) this.bgmGain.gain.value = this._muted ? 0 : this._bgmVolume;
  }

  // ---- Background music ----

  private async loadBgm(path: string) {
    try {
      const resp = await fetch(path);
      const arrayBuf = await resp.arrayBuffer();
      this.bgmBuffer = await this.ctx!.decodeAudioData(arrayBuf);
    } catch (e) {
      console.warn(`BGM: failed to load ${path}`);
    }
  }

  /** Start background music (looping). Safe to call multiple times — restarts if already playing. */
  playBgm() {
    if (!this.ctx || !this.bgmGain || !this.bgmBuffer) return;
    this.stopBgm();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.bgmSource = this.ctx.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.loop = true;
    this.bgmSource.connect(this.bgmGain);
    this.bgmSource.start(0);
    this.bgmPlaying = true;
  }

  /** Stop background music. */
  stopBgm() {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch (_) { /* already stopped */ }
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
    this.bgmPlaying = false;
  }

  get bgmVolume() { return this._bgmVolume; }
  set bgmVolume(v: number) {
    this._bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgmGain && !this._muted) this.bgmGain.gain.value = this._bgmVolume;
  }
}

/** Global SFX singleton — call SFX.init() once at boot, then SFX.play('key') anywhere. */
export const SFX = new SfxManager();
