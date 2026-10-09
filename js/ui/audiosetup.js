// Audio input & output setup: choose the input device (built-in mic, audio
// interface like a Focusrite Scarlett, amp/pedal USB), which of its inputs the
// guitar is on, and where the click plays. Includes a two-channel live meter.
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { Audio, DIRECT_INPUT_RE } from '../core/audio.js';
import { Shell } from './shell.js';

export function savedInput(profile) { return profile.settings.audioInput || { deviceId: '', label: '', channel: 'mix', type: 'mic' }; }

/** Apply saved prefs to the audio engine (call at boot and after changes). */
export function applyAudioPrefs(profile) {
  if (profile.settings.clickSound) Audio.sound = profile.settings.clickSound;
  Audio.setInputPrefs(savedInput(profile));
  const out = profile.settings.audioOutput;
  if (out && out.deviceId) Audio.setOutput(out.deviceId);
}

/** One-line summary with a Change button; opens the full setup in a sheet. */
export function inputSummaryHTML(profile) {
  const inp = savedInput(profile);
  const name = (inp.label || 'Default microphone').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '');
  const ch = inp.channel === 0 ? ' · Input 1' : inp.channel === 1 ? ' · Input 2' : '';
  return `<div class="inputline"><span>🎚 <b>${esc(name)}</b>${ch} <span class="tag">${inp.type === 'direct' ? 'direct input' : 'microphone'}</span></span><button class="btn sm" data-audio="change">Change</button></div>`;
}
export function openAudioSheet(profile, onDone) {
  let cleanup = null;
  const sheet = Shell.sheet('<h2>Audio input & output</h2><div data-r="as"></div><button class="btn primary block" data-r="asdone">Done</button>', { onClose: () => { if (cleanup) cleanup(); if (onDone) onDone(); } });
  cleanup = mountAudioSetup(sheet.el.querySelector('[data-r="as"]'), { profile });
  sheet.el.querySelector('[data-r="asdone"]').addEventListener('click', () => sheet.close());
  return sheet;
}

export function mountAudioSetup(el, { profile = Store.profile } = {}) {
  let devices = { inputs: [], outputs: [], labeled: false }, test = null;
  const inp = Object.assign({}, savedInput(profile));
  const out = Object.assign({ deviceId: '', label: '' }, profile.settings.audioOutput || {});

  function save() {
    profile.settings.audioInput = { ...inp };
    profile.settings.audioOutput = { ...out };
    Store.save();
    applyAudioPrefs(profile);
  }

  async function load(unlock = false) {
    try {
      if (unlock) { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); }
      devices = await Audio.listDevices();
    } catch (e) { toast(e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser’s site settings to list your devices.' : (e.message || 'Could not list audio devices.'), 5000); }
    render();
  }

  function render() {
    const name = d => (d.label || 'Unnamed device').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '');
    el.innerHTML = `
      <div class="field"><label>Input device</label>
        ${devices.labeled ? `<select data-r="dev"><option value="">Default (system input)</option>${devices.inputs.filter(d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications').map(d => `<option value="${esc(d.deviceId)}" ${d.deviceId === inp.deviceId ? 'selected' : ''}>${esc(name(d))}</option>`).join('')}</select>`
          : `<button class="btn block" data-r="unlock">Show my audio devices</button><p class="small muted">Your browser hides device names until you allow audio access once.</p>`}
        ${inp.deviceId && devices.labeled && !devices.inputs.some(d => d.deviceId === inp.deviceId) ? `<p class="note warn">“${esc(inp.label)}” isn’t connected right now. Plug it in, or pick another device.</p>` : ''}
      </div>
      <div class="field"><label>What’s connected</label>
        <div class="chips"><button class="chip ${inp.type === 'mic' ? 'on' : ''}" data-type="mic">🎤 Microphone</button><button class="chip ${inp.type === 'direct' ? 'on' : ''}" data-type="direct">🔌 Guitar plugged in (direct input)</button></div>
        <p class="small muted">${inp.type === 'direct' ? 'Direct input (interface, amp or pedal USB): the cleanest signal, no click bleed. Set the guitar gain so the meter peaks in the green–yellow when you dig in.' : 'Microphone: place it 30–60 cm from the guitar or amp in a quiet room.'}</p>
      </div>
      <div class="field"><label>Which input is the guitar on?</label>
        <div class="chips">${[['mix', 'Mix all'], [0, 'Input 1'], [1, 'Input 2']].map(([v, l]) => `<button class="chip ${String(inp.channel) === String(v) ? 'on' : ''}" data-ch="${v}">${l}</button>`).join('')}</div>
        <p class="small muted">On a 2-input interface (e.g. Scarlett 2i2/Solo), pick the jack your guitar is plugged into. Use the test below if you’re not sure.</p>
      </div>
      <div class="field"><label>Test the input</label>
        <div class="dualmeter"><div><span>Input 1</span><div class="meter"><i data-r="m0"></i></div><b data-r="d0">—</b></div><div><span>Input 2</span><div class="meter"><i data-r="m1"></i></div><b data-r="d1">—</b></div></div>
        <p class="small" data-r="hint"></p>
        <button class="btn block" data-r="test">${test ? '■ Stop test' : '▶ Test input: play a few notes'}</button>
      </div>
      ${Audio.outputSupported() && devices.labeled ? `<div class="field"><label>Play the click and tab through</label>
        <select data-r="out"><option value="">Default (system output)</option>${devices.outputs.filter(d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications').map(d => `<option value="${esc(d.deviceId)}" ${d.deviceId === out.deviceId ? 'selected' : ''}>${esc(name(d))}</option>`).join('')}</select>
        <p class="small muted">Choose your interface to hear the click in the same headphones/monitors as your guitar.</p></div>` : ''}`;
  }

  async function startTest() {
    try {
      const c = Audio.get();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: Audio.audioConstraints(inp.deviceId) });
      const src = c.createMediaStreamSource(stream);
      const tr = stream.getAudioTracks()[0], st = tr.getSettings ? tr.getSettings() : {};
      const chans = Math.max(1, st.channelCount || 1);
      const split = c.createChannelSplitter(Math.max(2, chans)); src.connect(split);
      const an = [0, 1].map(i => { const a = c.createAnalyser(); a.fftSize = 2048; if (i < chans) split.connect(a, i); return a; });
      const buf = new Float32Array(2048), peaks = [0, 0], hold = [0, 0];
      let seen = [0, 0], clipped = false;
      test = { stream, src, timer: setInterval(() => {
        an.forEach((a, i) => {
          if (i >= chans) { el.querySelector(`[data-r="d${i}"]`).textContent = 'n/a'; return; }
          a.getFloatTimeDomainData(buf);
          let pk = 0; for (let k = 0; k < buf.length; k++) { const v = Math.abs(buf[k]); if (v > pk) pk = v; }
          peaks[i] = Math.max(pk, peaks[i] * 0.9); hold[i] = Math.max(hold[i], pk);
          if (pk > 0.02) seen[i]++;
          if (pk >= 0.99) clipped = true;
          const db = 20 * Math.log10(Math.max(1e-5, peaks[i]));
          const m = el.querySelector(`[data-r="m${i}"]`); if (m) m.style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + '%';
          const d = el.querySelector(`[data-r="d${i}"]`); if (d) d.textContent = peaks[i] > 1e-4 ? Math.round(db) + ' dB' : '—';
        });
        const hint = el.querySelector('[data-r="hint"]'); if (!hint) return;
        const live = [0, 1].filter(i => seen[i] > 4);
        let msg = `Detected ${chans} input channel${chans > 1 ? 's' : ''} on ${esc((tr.label || 'this device').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, ''))}. `;
        if (clipped) msg += '<span class="bad">Clipping: turn the input gain down a little.</span> ';
        else if (Math.max(...hold) > 0 && Math.max(...hold) < 0.03 && (seen[0] + seen[1]) === 0) msg += 'Very quiet: play a few notes, or turn the gain up. ';
        if (chans >= 2 && live.length === 1) {
          msg += `Your guitar is on <b>Input ${live[0] + 1}</b>. ${inp.channel !== live[0] ? `<button class="btn sm primary" data-ch="${live[0]}">Use Input ${live[0] + 1}</button>` : '✓ Selected.'}`;
        } else if (chans < 2 && inp.channel !== 'mix') msg += 'This device sends one channel, so “Mix all” is used.';
        hint.innerHTML = msg;
      }, 80) };
      render();
    } catch (e) { toast(e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : e.name === 'OverconstrainedError' ? 'That device isn’t available. Is it plugged in?' : (e.message || 'Could not open the input.'), 5000); }
  }
  function stopTest() {
    if (!test) return;
    clearInterval(test.timer); test.stream.getTracks().forEach(t => t.stop()); try { test.src.disconnect(); } catch { /* ignore */ }
    test = null;
  }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
    if (b.dataset.r === 'unlock') return load(true);
    if (b.dataset.r === 'test') { if (test) { stopTest(); render(); } else startTest(); return; }
    if (b.dataset.type) { inp.type = b.dataset.type; save(); return render(); }
    if (b.dataset.ch != null) {
      inp.channel = b.dataset.ch === 'mix' ? 'mix' : Number(b.dataset.ch);
      save(); if (test) { stopTest(); render(); startTest(); } else render();
      toast(`Using ${inp.channel === 'mix' ? 'all inputs mixed' : 'Input ' + (inp.channel + 1)}.`);
    }
  };
  const onChange = e => {
    if (e.target.dataset.r === 'dev') {
      const d = devices.inputs.find(x => x.deviceId === e.target.value);
      inp.deviceId = e.target.value; inp.label = d ? d.label : '';
      inp.type = d && DIRECT_INPUT_RE.test(d.label) ? 'direct' : 'mic';
      if (inp.type === 'mic') inp.channel = 'mix';
      save(); const wasTesting = !!test; stopTest(); render(); if (wasTesting) startTest();
    }
    if (e.target.dataset.r === 'out') {
      const d = devices.outputs.find(x => x.deviceId === e.target.value);
      out.deviceId = e.target.value; out.label = d ? d.label : ''; save();
      Audio.get(); Audio.setOutput(out.deviceId).then(() => { const c = Audio.ctx; if (c) Audio.beep(c.currentTime + 0.05, 1320, 0.15, 0.4); });
    }
  };
  el.addEventListener('click', onClick); el.addEventListener('change', onChange);
  render(); load(false);
  return () => { stopTest(); el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); };
}
