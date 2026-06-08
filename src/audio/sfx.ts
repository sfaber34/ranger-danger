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
  'doorOpen',     // castle door / play button
  'structDestroy',// wall / tower torn down (sold or destroyed by boss)
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
  doorOpen: '/audio/PlayButton.wav',
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
  // playerHurt uses a custom programmatic tone (see loadPlayerHurt below)
  // upgrade uses a custom programmatic tone (see loadUpgrade below)
  // victory uses a custom programmatic fanfare (see loadVictory below)
  gameOver:    '12eZRSDW9BpyimpJ2g3CzvFeX7gYUb8STeQhqTheS6kbAXPHtF43iMHM4X4FDyt6hu2Gpiiz5scgQdCbp1Kd9YLifs2Xp7PKJhDZqHPZAsDXZesN5w4R7vko6X',
  // click uses a custom programmatic tone (see loadClick below)
};

// ---- Per-biome BGM file paths ----
// Loaded lazily — only the track for the current level is fetched, which
// keeps "Generating world..." short. The intro/menu theme is served via
// an HTMLAudioElement (see index.html) so it starts on first gesture.
const BGM_PATHS: Record<string, string> = {
  grasslands: '/audio/bgm_grasslands.mp3',
  forest:     '/audio/bgm_forest.mp3',
  infected:   '/audio/bgm_infected.mp3',
  river:      '/audio/bgm_river.mp3',
  castle:     '/audio/bgm_castle.mp3',
};

// ---- Manager ----
class SfxManager {
  /** Pre-decoded AudioBuffers for instant playback */
  private buffers: Partial<Record<SfxKey, AudioBuffer>> = {};
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private _volume = 0.32;
  private _muted = false;
  private unlocked = false;
  /** Hidden looping <audio> element used to bypass the iOS silent switch by
   *  forcing Safari into the "playback" audio session category. */
  private silentEl: HTMLAudioElement | null = null;

  // Background music — per-biome tracks loaded lazily on demand (see
  // BGM_PATHS above). Only the track for the level the player enters
  // gets fetched; this is what keeps the loading screen short.
  private bgmGain: GainNode | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmBuffers: Record<string, AudioBuffer> = {};
  /** Currently-playing BGM key, or null if none. */
  private currentBgmKey: string | null = null;
  /** A play request that arrived before the buffer finished decoding. */
  private pendingBgmKey: string | null = null;
  /** Keys currently mid-fetch — prevents duplicate downloads. */
  private bgmLoading: Set<string> = new Set();
  private _bgmVolume = 0.07;
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
    cannonShoot: 0.5,
    playerHurt: 0.85,
    doorOpen: 0.5,
  };
  /** Per-sound playback-rate multipliers (1 = original pitch). <1 = lower
   *  pitch, >1 = higher. */
  private rates: Partial<Record<SfxKey, number>> = {};

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
      const el = document.createElement('audio') as HTMLAudioElement & { playsInline: boolean };
      el.src = '/audio/silent.mp3';
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.playsInline = true;
      el.style.display = 'none';
      document.body.appendChild(el);
      // The silent loop is the iOS silent-switch bypass — if it fails to
      // play, WebAudio gets routed through the silent switch and the user
      // hears nothing. Surface the failure so we don't silently regress.
      el.play().catch((err) => {
        console.error('SFX silent-loop play() rejected — iOS mute-switch bypass disabled:', err);
      });
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
    // BGM is now lazy — playBgm(key) fetches+decodes the requested track on
    // first use, so this loadAssets() pass only handles the small SFX bank.
    await Promise.all(loads);
    this.loadClick();
    this.loadCoin();
    this.loadUpgrade();
    this.loadPlayerHurt();
    this.loadVictory();
    this.loadStructDestroy();
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
    const freq = 1100; // Hz — softer tap pitch
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

  /** Soft thud with descending pitch — less harsh than jsfxr version */
  private loadPlayerHurt() {
    const sr = 44100;
    const len = Math.floor(sr * 0.18); // 180ms
    const buf = this.ctx!.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    const vol = 0.7;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const progress = i / len;
      // Descending pitch from 400Hz to 160Hz for a noticeable thud
      const freq = 400 - 240 * progress;
      // Quick attack, smooth exponential decay
      const env = Math.exp(-progress * 4) * (1 - Math.exp(-i / (sr * 0.003)));
      // Mix sine + a touch of triangle for warmth
      const phase = 2 * Math.PI * freq * t;
      const sine = Math.sin(phase);
      const tri = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
      ch[i] = (sine * 0.7 + tri * 0.3) * env * vol;
    }
    this.buffers.playerHurt = buf;
  }

  /** Triumphant ascending fanfare for level-complete. Three short bumps
   *  (C5, E5, G5) climbing the major triad, finishing on a sustained C6. */
  private loadVictory() {
    const sr = 44100;
    const totalDur = 1.45;
    const len = Math.floor(sr * totalDur);
    const buf = this.ctx!.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    type Note = { freq: number; start: number; dur: number; vol: number };
    const notes: Note[] = [
      { freq: 523, start: 0.00, dur: 0.18, vol: 0.36 }, // C5
      { freq: 659, start: 0.16, dur: 0.18, vol: 0.36 }, // E5
      { freq: 784, start: 0.32, dur: 0.20, vol: 0.40 }, // G5
      { freq: 1046, start: 0.50, dur: 0.95, vol: 0.45 }, // C6 sustained
    ];
    for (const n of notes) {
      const startSample = Math.floor(n.start * sr);
      const noteLen = Math.floor(n.dur * sr);
      for (let i = 0; i < noteLen && (startSample + i) < len; i++) {
        const t = i / sr;
        const progress = i / noteLen;
        // Quick attack (~5ms), exponential decay across the note's duration
        const attack = 1 - Math.exp(-i / (sr * 0.005));
        const decay = Math.exp(-progress * 2.4);
        const env = attack * decay;
        const phase = 2 * Math.PI * n.freq * t;
        // Fundamental + slight 3rd harmonic for a warmer, brassier tone
        const sample = Math.sin(phase) * 0.7 + Math.sin(phase * 3) * 0.12;
        ch[startSample + i] += sample * env * n.vol;
      }
    }
    // Defensive clamp in case overlapping notes clip
    for (let i = 0; i < len; i++) {
      if (ch[i] > 1) ch[i] = 1;
      else if (ch[i] < -1) ch[i] = -1;
    }
    this.buffers.victory = buf;
  }

  /** Wall / tower crumble — short noise burst over a descending low sine
   *  for a "thunk + rubble" feel. Used both when a sell countdown completes
   *  and when a boss tears a structure down to 0 HP. */
  private loadStructDestroy() {
    const sr = 44100;
    const len = Math.floor(sr * 0.32); // 320ms
    const buf = this.ctx!.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    const vol = 0.55;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const progress = i / len;
      // Sharp ~5ms attack, exponential decay across the sound's life.
      const attack = 1 - Math.exp(-i / (sr * 0.005));
      const decay = Math.exp(-progress * 4.5);
      // Descending rumble (110 -> 45 Hz)
      const rumbleFreq = 110 - 65 * progress;
      const rumble = Math.sin(2 * Math.PI * rumbleFreq * t);
      // Noise burst (rubble) — heavier early, fades faster than rumble.
      const noiseEnv = Math.exp(-progress * 8);
      const noise = (Math.random() * 2 - 1) * noiseEnv;
      ch[i] = (rumble * 0.55 + noise * 0.5) * attack * decay * vol;
    }
    // Defensive clamp — noise+rumble overlap can briefly exceed [-1, 1].
    for (let i = 0; i < len; i++) {
      if (ch[i] > 1) ch[i] = 1;
      else if (ch[i] < -1) ch[i] = -1;
    }
    this.buffers.structDestroy = buf;
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
    const rate = this.rates[key];
    if (rate !== undefined && rate !== 1) source.playbackRate.value = rate;
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

  /** Returns true if the given key's AudioBuffer has been decoded and is ready for playback. */
  hasBuffer(key: SfxKey): boolean { return !!this.buffers[key]; }

  /** Play a sound with custom pitch and volume. Useful for UI click variants. */
  playPitched(key: SfxKey, volume: number, rate: number, startOffset = 0) {
    if (this._muted || !this.ctx || !this.gainNode) return;
    const buf = this.buffers[key];
    if (!buf) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    source.connect(g);
    g.connect(this.gainNode);
    source.start(0, startOffset);
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

  private async loadBgm(key: string, path: string) {
    try {
      const resp = await fetch(path);
      const arrayBuf = await resp.arrayBuffer();
      this.bgmBuffers[key] = await this.ctx!.decodeAudioData(arrayBuf);
    } catch (e) {
      console.warn(`BGM: failed to load ${path}`);
    }
  }

  /** Kick off a lazy fetch+decode for a BGM track without playing it.
   *  Safe to call multiple times — duplicate calls become no-ops. Used to
   *  warm the cache during "Generating world..." so playBgm() lands
   *  instantly when the level finishes loading. */
  preloadBgm(key: string) {
    if (this.bgmBuffers[key]) return;
    if (this.bgmLoading.has(key)) return;
    const path = BGM_PATHS[key];
    if (!path || !this.ctx) return;
    this.bgmLoading.add(key);
    this.loadBgm(key, path).finally(() => {
      this.bgmLoading.delete(key);
      // If a play was already queued for this key, fire it now.
      if (this.pendingBgmKey === key && this.bgmBuffers[key]) {
        this.pendingBgmKey = null;
        this.playBgm(key);
      }
    });
  }

  /** Start the named BGM track on loop. Pass the same key as currently
   *  playing to no-op. If the track hasn't been fetched yet (BGMs are
   *  loaded lazily so the level-load screen stays short), kick off the
   *  fetch and queue the play — it fires the moment decode finishes. */
  playBgm(key: string) {
    if (!this.bgmBuffers[key]) {
      this.pendingBgmKey = key;
      // Trigger a lazy fetch+decode if we haven't already.
      const path = BGM_PATHS[key];
      if (path && !this.bgmLoading.has(key) && this.ctx) {
        this.bgmLoading.add(key);
        this.loadBgm(key, path).finally(() => {
          this.bgmLoading.delete(key);
          // If this is still the requested track, fire it now.
          if (this.pendingBgmKey === key && this.bgmBuffers[key]) {
            this.pendingBgmKey = null;
            this.playBgm(key);
          }
        });
      }
      return;
    }
    if (!this.ctx || !this.bgmGain) return;
    if (this.currentBgmKey === key && this.bgmPlaying) return;
    this.stopBgm();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // Restore gain in case a previous fadeOutBgm left it at 0
    this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bgmGain.gain.setValueAtTime(this._muted ? 0 : this._bgmVolume, this.ctx.currentTime);
    this.bgmSource = this.ctx.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffers[key];
    this.bgmSource.loop = true;
    this.bgmSource.connect(this.bgmGain);
    this.bgmSource.start(0);
    this.bgmPlaying = true;
    this.currentBgmKey = key;
  }

  /** Stop background music immediately. */
  stopBgm() {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch (_) { /* already stopped */ }
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
    this.bgmPlaying = false;
    this.currentBgmKey = null;
  }

  /** Fade BGM volume to silence over `durationMs`, then stop the source. */
  fadeOutBgm(durationMs = 1500) {
    if (!this.ctx || !this.bgmGain || !this.bgmSource) { this.stopBgm(); return; }
    const now = this.ctx.currentTime;
    const end = now + durationMs / 1000;
    const g = this.bgmGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    // linearRamp to 0 (avoid 0 with exponential)
    g.linearRampToValueAtTime(0, end);
    const src = this.bgmSource;
    setTimeout(() => {
      if (this.bgmSource === src) this.stopBgm();
      // Restore gain so future playBgm calls aren't silent
      if (this.bgmGain) this.bgmGain.gain.value = this._muted ? 0 : this._bgmVolume;
    }, durationMs + 50);
  }

  get bgmVolume() { return this._bgmVolume; }
  set bgmVolume(v: number) {
    this._bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgmGain && !this._muted) this.bgmGain.gain.value = this._bgmVolume;
  }
}

/** Global SFX singleton — call SFX.init() once at boot, then SFX.play('key') anywhere. */
export const SFX = new SfxManager();
