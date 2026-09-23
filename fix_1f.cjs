const fs = require('fs');

let content = fs.readFileSync('src/engine/AudioManager.js', 'utf8').replace(/\r\n/g, '\n');

const initRepl = `
  _initContext() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._volume;
      this._masterGain.connect(this._ctx.destination);
      
      this._noiseBuffers = {};
      for (const [key, def] of Object.entries(this._sfxDefs)) {
        if (def.gen === 'noise' || def.gen === 'boom') {
          const bufLen = Math.floor(this._ctx.sampleRate * def.duration);
          const buf = this._ctx.createBuffer(1, bufLen, this._ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
          this._noiseBuffers[key] = buf;
        }
      }
    } catch (e) {
      console.warn('[Audio] Web Audio not available:', e);
    }
  }
`;
content = content.replace(/_initContext\(\) \{[\s\S]*?\}\n/, initRepl.trim() + '\n');

const noiseRepl = `
    if (def.gen === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffers[name];

      // Bandpass filter for character
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = def.filter || 400;
      filter.Q.value = 0.5;
      src.connect(filter);
      filter.connect(gainNode);
      src.start(now);
`;
content = content.replace(/if \(def\.gen === 'noise'\) \{[\s\S]*?src\.start\(now\);\n/, noiseRepl.trim() + '\n');

const boomRepl = `
    } else if (def.gen === 'boom') {
      // Noise + sine layered
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffers[name];
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 200;
      src.connect(f);
      f.connect(gainNode);
      src.start(now);
`;
content = content.replace(/\} else if \(def\.gen === 'boom'\) \{[\s\S]*?src\.start\(now\);\n/, boomRepl.trim() + '\n');

fs.writeFileSync('src/engine/AudioManager.js', content, 'utf8');
