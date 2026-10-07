// Web Audio engine: metronome clicks, beeps, a Karplus-Strong guitar voice for
// tab playback and ear tests, and a shared microphone stream for the tuner and
// (Phase C) playing evaluation.
export const Audio = {
  ctx: null, master: null, guitarBus: null, ksCache: new Map(),

  get() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3;
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      // Guitar "body": gentle low-pass plus a low-mid bump
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.5;
      const body = this.ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 3; body.Q.value = 1;
      this.guitarBus = this.ctx.createGain(); this.guitarBus.gain.value = 0.9;
      this.guitarBus.connect(body); body.connect(lp); lp.connect(this.master);
      if (this.outputId && this.ctx.setSinkId) this.ctx.setSinkId(this.outputId).catch(() => {});
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  now() { const c = this.get(); return c ? c.currentTime : 0; },
  freq(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  clickStyle: 'normal', // 'eval' = high sine blip the playing analyzer filters out
  click(t, accent, vol = 1) {
    const c = this.get(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    if (this.clickStyle === 'eval') {
      o.type = 'sine'; o.frequency.value = accent ? 4400 : 3800;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.04);
      return;
    }
    o.type = 'square'; o.frequency.value = accent ? 1600 : 1050;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((accent ? 0.45 : 0.3) * vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.06);
  },

  beep(t, f = 880, dur = 0.5, vol = 0.5) {
    const c = this.get(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },

  /** Karplus-Strong plucked string rendered once per pitch and cached. */
  ksBuffer(midi, bright = 0.55) {
    const key = midi + ':' + bright;
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const c = this.get(), sr = c.sampleRate, f = this.freq(midi);
    const T60 = Math.max(0.9, 3.6 - (midi - 40) * 0.07);          // low strings ring longer
    const dur = Math.min(3.2, T60 + 0.2);
    const len = Math.floor(sr * dur);
    const buf = c.createBuffer(1, len, sr), y = buf.getChannelData(0);
    const D = sr / f - 0.5, Di = Math.floor(D), fr = D - Di;
    const g = Math.pow(10, -3 / (f * T60));
    // Excitation: filtered noise burst one period long
    const exc = new Float32Array(Di + 2); let prev = 0;
    for (let i = 0; i < exc.length; i++) { prev += bright * ((Math.random() * 2 - 1) - prev); exc[i] = prev; }
    const a0 = 1 - fr;
    for (let n = 0; n < len; n++) {
      const i0 = n - Di, i1 = i0 - 1, i2 = i0 - 2;
      const y0 = i0 >= 0 ? y[i0] : 0, y1 = i1 >= 0 ? y[i1] : 0, y2 = i2 >= 0 ? y[i2] : 0;
      y[n] = (n < exc.length ? exc[n] : 0) + g * 0.5 * (a0 * y0 + fr * y1 + a0 * y1 + fr * y2);
    }
    let peak = 0; for (let n = 0; n < len; n++) peak = Math.max(peak, Math.abs(y[n]));
    const norm = peak ? 0.9 / peak : 1;
    for (let n = 0; n < len; n++) y[n] *= norm;
    this.ksCache.set(key, buf);
    return buf;
  },

  /** Play one guitar note. Returns the source so callers can stop it. */
  guitar(midi, t, { dur = 1.5, gain = 0.5, bright = 0.55, cents = 0 } = {}) {
    const c = this.get(); if (!c) return null;
    t = t == null ? c.currentTime + 0.02 : t;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = this.ksBuffer(Math.round(midi), bright);
    const off = cents + (midi - Math.round(midi)) * 100;
    if (off && src.detune) src.detune.value = off;
    g.gain.setValueAtTime(gain, t);
    const end = t + Math.min(dur, src.buffer.duration);
    g.gain.setValueAtTime(gain, Math.max(t, end - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, end);
    src.connect(g); g.connect(this.guitarBus);
    src.start(t); src.stop(end + 0.02);
    return src;
  },
  strum(midis, t, { dur = 2, gain = 0.6, spread = 0.018 } = {}) {
    const per = gain / Math.sqrt(midis.length) * 1.4;
    midis.forEach((m, i) => this.guitar(m, t + i * spread, { dur, gain: per }));
  },

  /** Ear-test audio descriptors. */
  play(a) {
    const c = this.get(); if (!c) return;
    const t = c.currentTime + 0.06;
    if (a.type === 'seq') a.notes.forEach((n, i) => this.guitar(n, t + i * 0.8, { dur: 1.2, gain: 0.6 }));
    else if (a.type === 'interval') { this.guitar(a.notes[0], t, { dur: 1.1, gain: 0.6 }); this.guitar(a.notes[1], t + 0.75, { dur: 1.1, gain: 0.6 }); this.strum(a.notes, t + 1.7, { dur: 1.8, spread: 0 }); }
    else if (a.type === 'chord') { a.notes.forEach((n, i) => this.guitar(n, t + i * 0.32, { dur: 1, gain: 0.5 })); this.strum(a.notes, t + a.notes.length * 0.32 + 0.35, { dur: 2 }); }
  },

  /* ------------------- Audio input (microphone or interface) ------------------- */
  // input prefs: {deviceId, label, channel: 'mix' | 0 | 1, type: 'mic' | 'direct'}
  input: { deviceId: '', label: '', channel: 'mix', type: 'mic' },
  outputId: '',
  mic: null, micSource: null, micOut: null, micUsers: 0, micInfo: null,

  setInputPrefs(prefs) {
    const next = Object.assign({ deviceId: '', label: '', channel: 'mix', type: 'mic' }, prefs || {});
    const changed = next.deviceId !== this.input.deviceId || next.channel !== this.input.channel;
    this.input = next;
    if (changed) this.resetMic();
  },
  isDirect() { return this.input.type === 'direct'; },

  /** Raw-signal constraints for the chosen device (no echo cancellation/noise suppression/AGC). */
  audioConstraints(deviceId = this.input.deviceId) {
    const a = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } };
    if (deviceId) a.deviceId = { exact: deviceId };
    return a;
  },

  /** Open the chosen input (optionally with video). Falls back to a same-named device, then the default. */
  async getInputStream(extra = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Audio input needs a secure (https) page.');
    const tryOpen = id => navigator.mediaDevices.getUserMedia(Object.assign({ audio: this.audioConstraints(id) }, extra));
    try { return { stream: await tryOpen(this.input.deviceId), fellBack: false }; }
    catch (e) {
      if (!this.input.deviceId || !['OverconstrainedError', 'NotFoundError', 'NotReadableError'].includes(e.name)) throw e;
      // The saved deviceId can change between sessions: match by name, else use the default input
      try {
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
        const same = this.input.label && devs.find(d => d.label === this.input.label);
        if (same) { this.input.deviceId = same.deviceId; return { stream: await tryOpen(same.deviceId), fellBack: false, renamed: true }; }
      } catch { /* ignore */ }
      return { stream: await tryOpen(''), fellBack: true };
    }
  },

  /** Pick one channel of a multi-input device (e.g. Scarlett input 1) or downmix to mono. */
  channelNode(source, channels, channel) {
    const c = this.get();
    if (channels >= 2 && (channel === 0 || channel === 1)) {
      const split = c.createChannelSplitter(Math.max(2, channels));
      const g = c.createGain(); g.channelCount = 1; g.channelCountMode = 'explicit';
      source.connect(split); split.connect(g, channel);
      return g;
    }
    const mono = c.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    source.connect(mono);
    return mono;
  },

  /** Shared input node for the tuner, calibration and audio evaluation. */
  async openMic() {
    const c = this.get(); if (!c) throw new Error('Web Audio is not supported in this browser.');
    if (!this.mic) {
      const { stream, fellBack } = await this.getInputStream();
      this.mic = stream;
      this.micSource = c.createMediaStreamSource(stream);
      const tr = stream.getAudioTracks()[0], st = tr && tr.getSettings ? tr.getSettings() : {};
      const channels = st.channelCount || 1;
      this.micInfo = { label: (tr && tr.label) || 'Default input', deviceId: st.deviceId || '', channels, fellBack, latency: st.latency || null, sampleRate: st.sampleRate || c.sampleRate };
      this.micOut = this.channelNode(this.micSource, channels, this.input.channel);
    }
    this.micUsers++;
    return this.micOut;
  },
  closeMic() {
    this.micUsers = Math.max(0, this.micUsers - 1);
    if (!this.micUsers) this.resetMic();
  },
  resetMic() {
    this.micUsers = 0;
    if (this.mic) this.mic.getTracks().forEach(t => t.stop());
    try { this.micSource && this.micSource.disconnect(); this.micOut && this.micOut.disconnect(); } catch { /* ignore */ }
    this.mic = null; this.micSource = null; this.micOut = null;
  },
  /** Human description of the current input. */
  inputLabel() {
    const name = (this.micInfo && this.micInfo.label) || this.input.label || 'Default input';
    const ch = this.input.channel === 0 ? ' · Input 1' : this.input.channel === 1 ? ' · Input 2' : '';
    return name.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '') + ch;
  },

  /** Devices (labels appear once the user has granted microphone access). */
  async listDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return { inputs: [], outputs: [], labeled: false };
    const devs = await navigator.mediaDevices.enumerateDevices();
    const inputs = devs.filter(d => d.kind === 'audioinput'), outputs = devs.filter(d => d.kind === 'audiooutput');
    return { inputs, outputs, labeled: inputs.some(d => d.label) };
  },
  outputSupported() { const AC = window.AudioContext || window.webkitAudioContext; return !!(AC && AC.prototype && 'setSinkId' in AC.prototype); },
  async setOutput(deviceId) {
    this.outputId = deviceId || '';
    const c = this.ctx;
    if (c && c.setSinkId) { try { await c.setSinkId(this.outputId); } catch { /* device gone: stay on current output */ } }
  }
};

/** Interfaces and amp/pedal USB inputs are usually direct (line/instrument) inputs. */
export const DIRECT_INPUT_RE = /focusrite|scarlett|clarett|audient|\bid4\b|\bid14\b|motu|presonus|audiobox|steinberg|\bur\d|universal audio|apollo|\bvolt\b|babyface|\brme\b|line ?6|helix|pod go|boss|katana|\bgt-1|zoom|fractal|axe-fx|kemper|neural|quad cortex|irig|behringer|umc|m-audio|arturia|minifuse|ssl \d|tascam|roland|yamaha|positive grid|spark|usb audio codec|interface/i;

/** Standard chord voicings (MIDI) used for backing loops. */
export const CHORD_MIDI = {
  Am: [45, 52, 57, 60, 64], G: [43, 47, 50, 55, 59, 67], F: [41, 48, 53, 57, 60, 65], C: [48, 52, 55, 60, 64],
  Em: [40, 47, 52, 55, 59, 64], D: [50, 57, 62, 66], E: [40, 47, 52, 56, 59, 64], A: [45, 52, 57, 61, 64],
  Am7: [45, 52, 55, 60, 64], D7: [50, 57, 60, 66], Gmaj7: [43, 47, 50, 54, 59], E7: [40, 47, 50, 56, 59, 64], A7: [45, 52, 55, 61, 64]
};
