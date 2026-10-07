// Sample-accurate microphone recording on the audio clock (AudioWorklet, with a
// ScriptProcessor fallback). Each chunk carries the context frame it belongs to,
// so recorded audio lines up exactly with what the metronome/tab player scheduled.
import { Audio } from '../core/audio.js';

const WORKLET = `
class FCRecorder extends AudioWorkletProcessor {
  constructor() { super(); this.on = true; this.buf = new Float32Array(4096); this.n = 0; this.start = -1;
    this.port.onmessage = e => { if (e.data === 'stop') { this.flush(); this.on = false; } }; }
  flush() { if (this.n) { this.port.postMessage({ frame: this.start, data: this.buf.slice(0, this.n) }); this.n = 0; this.start = -1; } }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (this.on && ch) {
      for (let i = 0; i < ch.length; i++) {
        if (this.start < 0) this.start = currentFrame + i;
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) this.flush();
      }
    }
    return this.on;
  }
}
registerProcessor('fc-recorder', FCRecorder);`;

let moduleReady = null;

export const Recorder = {
  /** Test hook: replace with a function returning a recorder-like object. */
  factory: null,

  /**
   * Start recording from a source node. Returns {stop(): Promise<take>, level(): number}.
   * take = {samples: Float32Array, sampleRate, startTime (context seconds of samples[0])}
   */
  async start(source) {
    if (this.factory) return this.factory(source);
    const ctx = Audio.get();
    const chunks = []; let firstFrame = null, lastRms = 0;
    const onChunk = (frame, data) => {
      if (firstFrame == null) firstFrame = frame;
      chunks.push({ frame, data });
      let s = 0; for (let i = 0; i < data.length; i += 4) s += data[i] * data[i];
      lastRms = Math.sqrt(s / (data.length / 4));
    };
    const sink = ctx.createGain(); sink.gain.value = 0; sink.connect(ctx.destination);
    let node, stopFn;
    if (ctx.audioWorklet && window.AudioWorkletNode) {
      if (!moduleReady) moduleReady = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
      await moduleReady;
      node = new AudioWorkletNode(ctx, 'fc-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      let resolveStop, stopping = false, stopTimer = null;
      const stopped = new Promise(r => { resolveStop = r; });
      node.port.onmessage = e => { onChunk(e.data.frame, e.data.data); if (stopping) { clearTimeout(stopTimer); stopTimer = setTimeout(resolveStop, 60); } };
      source.connect(node); node.connect(sink);
      stopFn = async () => { stopping = true; node.port.postMessage('stop'); stopTimer = setTimeout(resolveStop, 200); await stopped; };
    } else {
      node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = e => {
        const d = e.inputBuffer.getChannelData(0);
        onChunk(Math.round((e.playbackTime - d.length / ctx.sampleRate) * ctx.sampleRate), new Float32Array(d));
      };
      source.connect(node); node.connect(sink);
      stopFn = async () => {};
    }
    return {
      level: () => lastRms,
      async stop() {
        await stopFn();
        try { source.disconnect(node); } catch { /* ignore */ }
        try { node.disconnect(); sink.disconnect(); } catch { /* ignore */ }
        if (firstFrame == null) return { samples: new Float32Array(0), sampleRate: ctx.sampleRate, startTime: ctx.currentTime };
        const last = chunks[chunks.length - 1];
        const total = last.frame + last.data.length - firstFrame;
        const samples = new Float32Array(Math.max(0, total));
        for (const c of chunks) { const off = c.frame - firstFrame; if (off >= 0 && off + c.data.length <= samples.length) samples.set(c.data, off); }
        return { samples, sampleRate: ctx.sampleRate, startTime: firstFrame / ctx.sampleRate };
      }
    };
  }
};
