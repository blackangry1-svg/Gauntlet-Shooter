/**
 * AudioManager.js
 * Procedural Web Audio API sound effects — no external audio files needed
 * Optimized: audio context created lazily on first user interaction
 */
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._volume = 0.6;
    this._sfxDefs = this._buildSFXDefs();

    // Initialize on first user gesture
    const init = () => {
      if (!this._ctx) this._initContext();
    };
    window.addEventListener('click', init, { once: true });
    window.addEventListener('keydown', init, { once: true });
  }

  _initContext() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._volume;
      this._masterGain.connect(this._ctx.destination);
    } catch (e) {
      console.warn('[Audio] Web Audio not available:', e);
    }
  }

  _buildSFXDefs() {
    // Each def: { type, freq, duration, attack, decay, modFreq?, modDepth?, noiseAmount? }
    return {
      // Sword swing — fast whoosh
      swordSwing:  { gen: 'noise', freq: 400, duration: 0.15, attack: 0.01, decay: 0.14, filter: 800 },
      // Heavy swing — deeper whoosh
      heavySwing:  { gen: 'noise', freq: 220, duration: 0.28, attack: 0.02, decay: 0.26, filter: 450 },
      // Sword hit — meaty thud
      swordHit:    { gen: 'hit', freq: 120, duration: 0.2, attack: 0.005, decay: 0.19 },
      // Dodge whoosh
      dodge:       { gen: 'noise', freq: 500, duration: 0.22, attack: 0.01, decay: 0.21, filter: 1100 },
      // Block clang — metallic deflection
      block:       { gen: 'tone', type: 'triangle', freq: 580, duration: 0.2, attack: 0.005, decay: 0.195, slide: 320 },
      // Guard break
      guardBreak:  { gen: 'boom', freq: 90, duration: 0.45, attack: 0.01, decay: 0.44 },
      // Telegraph warning sound
      telegraphWarn: { gen: 'tone', type: 'sine', freq: 350, duration: 0.35, attack: 0.03, decay: 0.32, slide: 550 },
      // Arrow fire — twang
      arrowFire:   { gen: 'tone', type: 'sawtooth', freq: 200, duration: 0.12, attack: 0.005, decay: 0.115, slide: 80 },
      // Arrow hit
      arrowHit:    { gen: 'hit', freq: 180, duration: 0.15, attack: 0.01, decay: 0.14 },
      // Fireball cast — crackling burst
      fireballCast:{ gen: 'noise', freq: 300, duration: 0.25, attack: 0.02, decay: 0.23, filter: 600 },
      // Fireball explode
      fireballExplode: { gen: 'boom', freq: 80, duration: 0.4, attack: 0.01, decay: 0.39 },
      // Player hurt — grunt
      playerHurt:  { gen: 'tone', type: 'sawtooth', freq: 180, duration: 0.15, attack: 0.005, decay: 0.145, slide: 60 },
      // Enemy death
      enemyDeath:  { gen: 'hit', freq: 100, duration: 0.3, attack: 0.01, decay: 0.29 },
      // Room clear — triumphant chime
      roomClear:   { gen: 'chord', freqs: [523, 659, 784], duration: 0.8, attack: 0.05, decay: 0.75 },
      // Pickup — coin jingle
      pickup:      { gen: 'tone', type: 'sine', freq: 880, duration: 0.12, attack: 0.01, decay: 0.11 },
      // Bonfire / Checkpoint rest
      bonfireRest: { gen: 'chord', freqs: [440, 554, 659, 880], duration: 1.4, attack: 0.1, decay: 1.3 },
      // Lever pull / door opening
      leverPull:   { gen: 'noise', freq: 180, duration: 0.6, attack: 0.05, decay: 0.55, filter: 350 },
      // Chest open
      chestOpen:   { gen: 'chord', freqs: [330, 494, 659], duration: 0.7, attack: 0.03, decay: 0.67 },
      // Boss roar / phase change
      bossRoar:    { gen: 'boom', freq: 55, duration: 0.9, attack: 0.02, decay: 0.88 },
      bossPhase:   { gen: 'boom', freq: 45, duration: 1.2, attack: 0.03, decay: 1.17 },
      // Footstep — low thud
      footstep:    { gen: 'hit', freq: 80, duration: 0.08, attack: 0.005, decay: 0.075 },
      // UI click
      uiClick:     { gen: 'tone', type: 'sine', freq: 440, duration: 0.06, attack: 0.005, decay: 0.055 },
    };
  }

  playSFX(name, volume = 1.0, pan = 0) {
    if (!this._ctx) return;
    const def = this._sfxDefs[name];
    if (!def) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, now + def.attack);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + def.duration);

    // Panner for 3D audio cue
    let chain = gainNode;
    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gainNode.connect(panner);
      panner.connect(this._masterGain);
      chain = gainNode;
    } else {
      gainNode.connect(this._masterGain);
    }

    if (def.gen === 'noise') {
      const bufLen = ctx.sampleRate * def.duration;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;

      // Bandpass filter for character
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = def.filter || 400;
      filter.Q.value = 0.5;
      src.connect(filter);
      filter.connect(gainNode);
      src.start(now);

    } else if (def.gen === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = def.type || 'sine';
      osc.frequency.setValueAtTime(def.freq, now);
      if (def.slide) osc.frequency.linearRampToValueAtTime(def.slide, now + def.duration);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + def.duration + 0.01);

    } else if (def.gen === 'hit') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(def.freq, now);
      osc.frequency.exponentialRampToValueAtTime(def.freq * 0.3, now + def.duration);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + def.duration + 0.01);

    } else if (def.gen === 'boom') {
      // Noise + sine layered
      const bufLen = ctx.sampleRate * def.duration;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 200;
      src.connect(f);
      f.connect(gainNode);
      src.start(now);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(def.freq, now);
      osc.frequency.exponentialRampToValueAtTime(def.freq * 0.1, now + def.duration);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + def.duration + 0.01);

    } else if (def.gen === 'chord') {
      for (const freq of def.freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.3, now + def.attack);
        g.gain.exponentialRampToValueAtTime(0.001, now + def.duration);
        osc.connect(g);
        g.connect(this._masterGain);
        osc.start(now);
        osc.stop(now + def.duration + 0.01);
      }
    }
  }

  startMusic() {
    if (!this._ctx || this._musicRunning) return;
    this._musicRunning = true;
    const ctx = this._ctx;

    // Ambient drone synth
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.value = 55;  // A1
    osc2.frequency.value = 82.5;// E2 (fifth)

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 160;

    this._musicGain = ctx.createGain();
    this._musicGain.gain.value = 0.15;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this._musicGain);
    this._musicGain.connect(this._masterGain);

    osc1.start();
    osc2.start();
    this._ambienceOscs = [osc1, osc2, filter];
  }

  setMusicState(state) {
    if (!this._musicGain || !this._ambienceOscs) return;
    const ctx = this._ctx;
    const filter = this._ambienceOscs[2];
    const now = ctx.currentTime;

    if (state === 'boss') {
      filter.frequency.linearRampToValueAtTime(320, now + 1.5);
      this._musicGain.gain.linearRampToValueAtTime(0.25, now + 1.5);
    } else if (state === 'combat') {
      filter.frequency.linearRampToValueAtTime(240, now + 1.0);
      this._musicGain.gain.linearRampToValueAtTime(0.20, now + 1.0);
    } else { // 'explore'
      filter.frequency.linearRampToValueAtTime(140, now + 2.0);
      this._musicGain.gain.linearRampToValueAtTime(0.12, now + 2.0);
    }
  }

  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._masterGain) this._masterGain.gain.value = this._volume;
  }
}
