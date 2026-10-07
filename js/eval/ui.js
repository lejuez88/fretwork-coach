// Evaluation session component: setup → record (audio or video) → analyze →
// results with coaching and prescriptions. Used by the Evaluate screen and the
// routine runner ("Evaluate this take").
import { esc, toast, uid, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { Audio } from '../core/audio.js';
import { Claude } from '../core/claude.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { calibratedTarget, newExerciseState } from '../core/progression.js';
import { addEvidence, recomputeLevels, describeChanges } from '../core/skills.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { Metronome } from '../tools/metronome.js';
import { Shell } from '../ui/shell.js';
import { Recorder } from './recorder.js';
import { analyzeTab, analyzeGrid, summarize } from './analyze.js';
import { currentLatency, calibrate, saveLatency } from './latency.js';
import { inputSummaryHTML, openAudioSheet } from '../ui/audiosetup.js';
import { localFeedback, claudeFeedback, toPrescriptionExercises } from './coach.js';

const FOCUS = { full: 'Whole guitar + both hands', fretting: 'Fretting-hand close-up', picking: 'Picking-hand close-up' };
const FOCUS_TIP = {
  full: 'Prop the phone 1–2 m away, landscape. Fit the guitar neck, both hands and your shoulders in the frame.',
  fretting: 'Put the camera about 40 cm from the neck, looking at the fretting hand from the front, thumb visible if possible.',
  picking: 'Put the camera about 40 cm from the strings, looking at the picking hand from the front and slightly above.'
};

function levelStats(x) {
  let pk = 0, clip = 0;
  for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > pk) pk = v; if (v >= 0.995) clip++; }
  return { peakDb: Math.round(20 * Math.log10(Math.max(1e-6, pk))), clipped: clip > 10 };
}

/** Convert any exercise shape to tab-player format, or null if it has no tab. */
export function playerFormat(ex, bpm) {
  if (ex.notes && ex.notes.length) return { id: ex.id, name: ex.name, unit: ex.unit, why: ex.why, goalBpm: ex.goalBpm, bpm, notes: ex.notes, swing: !!ex.swing };
  return toPlayerExercise(ex, bpm);
}
function gridSpec(ex) {
  const u = String(ex.unit || '').toLowerCase();
  if (/swing|shuffle/.test(u) || ex.swing) return { subdiv: 2, swing: true };
  if (/16/.test(u)) return { subdiv: 4 };
  if (/trip/.test(u)) return { subdiv: 3 };
  if (/8th|eighth/.test(u)) return { subdiv: 2 };
  if (/quarter|beat|per chord|bar/.test(u)) return { subdiv: 1 };
  return { subdiv: 2 };
}

export function mountEvalSession(el, { profile = Store.profile, exercise, bpm, mode = 'audio', context = {}, onUse = null, onFinish = null }) {
  const S = {
    phase: 'setup', mode, bpm: Math.round(bpm || exercise.startBpm || 80), loops: 2, seconds: 30, focus: 'full', facing: 'user',
    headphones: !!profile.settings.headphones, take: null, metrics: null, feedback: null, frames: [], videoUrl: null, evalId: null, coachBusy: false
  };
  let px = playerFormat(exercise, S.bpm);
  let tool = null, rec = null, stream = null, mediaRec = null, mediaChunks = [], timer = null, t0 = 0, endTime = 0, fromTime = 0, capCanvas = null, lastCap = 0, cancelled = false;

  /* ------------------------------- Rendering ------------------------------ */
  function render() {
    if (S.phase === 'setup') return renderSetup();
    if (S.phase === 'running') return; // live DOM built in start()
    if (S.phase === 'analyzing') { el.innerHTML = `<div class="center pad"><div class="spinner"></div><h3>Analyzing your take…</h3><p class="muted small">Finding every note, checking pitch and timing.</p></div>`; return; }
    if (S.phase === 'results') return renderResults();
  }

  function latencyLine() {
    const L = currentLatency(profile.settings);
    return L.calibrated
      ? `<span class="ok">✓ Timing calibrated (${Math.round(L.sec * 1000)} ms, ${L.method === 'loopback' ? 'speakers' : 'headphones'})</span>`
      : `<span class="muted">Timing not calibrated: consistency is measured, but early/late can’t be judged exactly.</span>`;
  }

  function renderSetup() {
    const noTab = !px;
    el.innerHTML = `
      <div class="evsetup">
        <div class="label">${S.mode === 'video' ? '🎥 Video form check' : '🎤 Audio check'}</div>
        <h3>${esc(exercise.name)}</h3>
        <p class="small muted">${noTab ? 'No tab for this one, so your rhythm is checked against the click: play it in time and the app measures how tightly you lock to the beat.' : 'Play along with the tab after the count-in. The app compares every note with the tab: right notes, timing, evenness.'}</p>
        <div class="segtabs two">${['audio', 'video'].map(m => `<a href="javascript:void 0" data-ev="mode" data-v="${m}" class="${S.mode === m ? 'on' : ''}">${m === 'audio' ? '🎤 Audio' : '🎥 Video + audio'}</a>`).join('')}</div>
        <div class="field"><label>Tempo</label><div class="stepper"><button data-ev="bpm" data-d="-5">−5</button><button data-ev="bpm" data-d="-1">−1</button><input type="number" inputmode="numeric" data-r="evbpm" value="${S.bpm}"><button data-ev="bpm" data-d="1">+1</button><button data-ev="bpm" data-d="5">+5</button></div><div class="unit">BPM${exercise.goalBpm ? ` · goal ${exercise.goalBpm}` : ''}</div></div>
        <div class="field"><label>${noTab ? 'Length' : 'Loops to record'}</label><div class="chips">${noTab ? [20, 30, 45].map(v => `<button class="chip ${S.seconds === v ? 'on' : ''}" data-ev="secs" data-v="${v}">${v} s</button>`).join('') : [1, 2, 3, 4].map(v => `<button class="chip ${S.loops === v ? 'on' : ''}" data-ev="loops" data-v="${v}">${v}</button>`).join('')}</div></div>
        ${S.mode === 'video' ? `<div class="field"><label>Camera view</label><div class="chips">${Object.entries(FOCUS).map(([k, v]) => `<button class="chip ${S.focus === k ? 'on' : ''}" data-ev="focus" data-v="${k}">${v}</button>`).join('')}</div>
          <p class="small muted">${FOCUS_TIP[S.focus]}</p>
          <div class="chips"><button class="chip ${S.facing === 'user' ? 'on' : ''}" data-ev="facing" data-v="user">Front camera</button><button class="chip ${S.facing === 'environment' ? 'on' : ''}" data-ev="facing" data-v="environment">Back camera</button></div>
          ${Claude.hasKey() ? '' : '<p class="note warn">Video form review needs your Claude API key (Settings). Without it, only the audio is analyzed.</p>'}</div>` : ''}
        <div class="field"><label>Input</label>${inputSummaryHTML(profile)}</div>
        ${Audio.isDirect() ? '' : `<label class="switch"><input type="checkbox" data-r="hp" ${S.headphones ? 'checked' : ''}> I’m using headphones</label>`}
        <p class="small">${latencyLine()} <a href="javascript:void 0" class="link small" data-ev="calib">${currentLatency(profile.settings).calibrated ? 'Recalibrate' : 'Calibrate now'}</a></p>
        <p class="small muted">${Audio.isDirect() ? 'Direct input: the cleanest signal. Turn off amp-sim effects with heavy delay/reverb if you can; a little drive is fine.' : 'Tips: quiet room, guitar 30–60 cm from the mic, amp or unplugged acoustic at normal volume. The click switches to a high “tick” the analyzer ignores.'}</p>
        <button class="btn primary block" data-ev="start">● Start recording</button>
      </div>`;
  }

  /* ------------------------------ Calibration ----------------------------- */
  async function runCalibration() {
    const hp = S.headphones || Audio.isDirect();
    const why = Audio.isDirect() ? 'Your guitar is plugged in directly, so the input can’t hear the speakers. You’ll tap along instead:' : 'With headphones the app can’t hear its own click, so you’ll tap along:';
    const sheet = Shell.sheet(`<h2>Calibrate timing</h2><p class="small muted">For: ${esc(Audio.inputLabel())}</p><p class="muted small">${hp ? why + ' mute the strings with your fretting hand and strike them exactly on each click (4 count-in clicks, then 12).' : 'The app plays 8 ticks through your speakers and listens for them. Stay quiet, volume up, no headphones.'}</p><p data-r="cst" class="small"></p><button class="btn primary block" data-r="cgo">Start</button>`);
    const st = sheet.el.querySelector('[data-r="cst"]');
    sheet.el.querySelector('[data-r="cgo"]').addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        const r = await calibrate(hp ? 'tap' : 'loopback', t => { st.textContent = t; });
        saveLatency(profile.settings, r);
        Store.save(); st.textContent = `✓ Calibrated: ${r.ms} ms (±${r.spreadMs} ms).`; st.className = 'small ok';
        setTimeout(() => { sheet.close(); render(); }, 900);
      } catch (err) { st.textContent = err.message || String(err); st.className = 'small bad'; e.target.disabled = false; e.target.textContent = 'Try again'; Audio.clickStyle = 'normal'; }
    });
  }

  /* -------------------------------- Record -------------------------------- */
  async function start() {
    const inp = el.querySelector('[data-r="evbpm"]'); if (inp) S.bpm = Math.max(30, Math.min(300, +inp.value || S.bpm));
    px = playerFormat(exercise, S.bpm);
    profile.settings.headphones = S.headphones; Store.save();
    cancelled = false;
    let src;
    try {
      Audio.get();
      if (S.mode === 'video') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera access needs a secure (https) page.');
        ({ stream } = await Audio.getInputStream({ video: { facingMode: S.facing, width: { ideal: 1280 }, height: { ideal: 720 } } }));
        const tr = stream.getAudioTracks()[0], st = tr && tr.getSettings ? tr.getSettings() : {};
        src = Audio.channelNode(Audio.ctx.createMediaStreamSource(stream), st.channelCount || 1, Audio.input.channel);
      } else src = await Audio.openMic();
    } catch (e) {
      toast(e.name === 'NotAllowedError' ? `${S.mode === 'video' ? 'Camera/microphone' : 'Microphone'} permission was denied. Allow it in your browser’s site settings.` : (e.message || 'Could not start recording.'), 5000);
      return;
    }
    S.phase = 'running';
    el.innerHTML = `
      <div class="evrun">
        ${S.mode === 'video' ? `<div class="camwrap ${S.focus}"><video data-r="vid" playsinline muted autoplay class="${S.facing === 'user' ? 'mirror' : ''}"></video><div class="camguide"><span>${esc(FOCUS[S.focus])}</span></div></div>` : ''}
        <div class="evstatus"><span class="recdot"></span><b data-r="st">Get ready…</b><span class="muted small" data-r="st2"></span></div>
        <div class="meter"><i data-r="lvl"></i></div>
        <div data-r="tool"></div>
        <button class="btn stop block" data-ev="stop">■ Stop and analyze</button>
        <button class="btn ghost block sm" data-ev="cancel">Cancel</button>
      </div>`;
    if (S.mode === 'video') {
      const v = el.querySelector('[data-r="vid"]'); v.srcObject = stream; try { await v.play(); } catch { /* autoplay may need a gesture; we're in one */ }
      try {
        const mt = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
        mediaRec = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined); mediaChunks = [];
        mediaRec.ondataavailable = e => { if (e.data && e.data.size) mediaChunks.push(e.data); };
        mediaRec.start(1000);
      } catch { mediaRec = null; }
      capCanvas = document.createElement('canvas');
    }
    rec = await Recorder.start(src);
    Audio.clickStyle = 'eval';
    const slot = el.querySelector('[data-r="tool"]');
    if (px) {
      tool = mountTabPlayer(slot, px, { evalMode: true, startBpm: S.bpm, compact: true, settings: profile.settings });
      tool.play();
      const tm = tool.timing();
      t0 = tm.t0; fromTime = t0 - 0.05;
      endTime = t0 + S.loops * tm.totalBeats * 60 / S.bpm + 0.25;
    } else {
      Metronome.configure({ bpm: S.bpm, mode: 'all', backing: null, beatsPerBar: 4, subdiv: 1 });
      Metronome.start();
      t0 = Metronome.startedAt; fromTime = t0 + 8 * 60 / S.bpm; // 2 bars of count-in
      endTime = fromTime + S.seconds;
      slot.innerHTML = `<div class="evclick"><div class="big">♩ = ${S.bpm}</div><div class="small muted">Count 2 bars in, then play “${esc(exercise.name)}” in time.</div></div>`;
    }
    S.frames = []; lastCap = 0;
    timer = setInterval(tick, 100);
  }

  function tick() {
    const now = Audio.ctx.currentTime;
    const lvl = rec ? rec.level() : 0;
    const bar = el.querySelector('[data-r="lvl"]'); if (bar) bar.style.width = Math.min(100, Math.round(Math.sqrt(lvl) * 220)) + '%';
    const st = el.querySelector('[data-r="st"]'), st2 = el.querySelector('[data-r="st2"]');
    if (st) {
      if (now < fromTime) { st.textContent = 'Count-in…'; st2.textContent = `${Math.ceil(fromTime - now)} s`; }
      else { st.textContent = 'Recording'; st2.textContent = `${Math.max(0, Math.ceil(endTime - now))} s left`; }
    }
    if (S.mode === 'video' && now >= fromTime && now - lastCap >= 0.75) { lastCap = now; captureFrame(now - fromTime); }
    if (now >= endTime) stop();
  }

  function captureFrame(t) {
    const v = el.querySelector('[data-r="vid"]'); if (!v || !v.videoWidth) return;
    const w = 640, h = Math.round(v.videoHeight / v.videoWidth * w);
    capCanvas.width = w; capCanvas.height = h;
    const g = capCanvas.getContext('2d'); g.drawImage(v, 0, 0, w, h);
    const data = capCanvas.toDataURL('image/jpeg', 0.72).split(',')[1];
    const tw = 200, th = Math.round(h / w * tw), tc = document.createElement('canvas'); tc.width = tw; tc.height = th; tc.getContext('2d').drawImage(capCanvas, 0, 0, tw, th);
    S.frames.push({ t, data, thumb: tc.toDataURL('image/jpeg', 0.6) });
  }

  async function stop(cancel = false) {
    if (S.phase !== 'running') return;
    clearInterval(timer); timer = null;
    const timing = tool ? tool.timing() : { t0, bpm: S.bpm };
    if (tool) { tool(); tool = null; } else Metronome.stop();
    const take = rec ? await rec.stop() : null; rec = null;
    Audio.clickStyle = 'normal';
    if (stream) { if (mediaRec && mediaRec.state !== 'inactive') { await new Promise(r => { mediaRec.onstop = r; mediaRec.stop(); }); } stream.getTracks().forEach(t => t.stop()); stream = null; }
    else Audio.closeMic();
    if (cancel || cancelled) { S.phase = 'setup'; return render(); }
    if (mediaChunks.length) S.videoUrl = URL.createObjectURL(new Blob(mediaChunks, { type: mediaChunks[0].type || 'video/webm' }));
    S.phase = 'analyzing'; render();
    await new Promise(r => setTimeout(r, 30));
    const L = currentLatency(profile.settings);
    const stopAt = Math.min(endTime, Audio.ctx.currentTime);
    try {
      S.metrics = px
        ? analyzeTab(take, timing, { latency: L.sec, calibrated: L.calibrated, endTime: stopAt })
        : analyzeGrid(take, { t0: fromTime, bpm: S.bpm, ...gridSpec(exercise) }, { latency: L.sec, calibrated: L.calibrated, endTime: stopAt });
    } catch (e) { S.metrics = { error: 'Analysis failed: ' + (e.message || e) }; }
    if (!S.metrics.error && take) S.metrics.input = Object.assign({ source: Audio.inputLabel() }, levelStats(take.samples));
    S.feedback = S.metrics.error ? null : localFeedback(S.metrics, exercise, { level: context.level || exercise.level || 4 });
    S.phase = 'results';
    persist();
    render();
    if (Claude.hasKey() && (!S.metrics.error || S.frames.length)) askClaude();
  }

  /* ------------------------------ Coaching -------------------------------- */
  function pickFrames() {
    const fr = S.frames; if (fr.length <= 10) return fr;
    return Array.from({ length: 10 }, (_, i) => fr[Math.round(i * (fr.length - 1) / 9)]);
  }
  async function askClaude() {
    S.coachBusy = true; renderCoach();
    try {
      const fb = await claudeFeedback({ profile, exercise, metrics: S.metrics, mode: S.mode, frames: S.mode === 'video' ? pickFrames() : [], focus: S.focus, context });
      if (!fb.prescriptions.length && S.feedback) fb.prescriptions = S.feedback.prescriptions;
      S.feedback = fb; persist();
    } catch (e) { if (S.mode === 'video') toast('Claude couldn’t review the video: ' + e.message, 5000); }
    S.coachBusy = false;
    if (S.phase === 'results') renderResults();
  }

  /** Save the evaluation, its evidence and level changes. */
  function persist() {
    const m = S.metrics || {};
    const rec2 = {
      id: S.evalId || (S.evalId = uid()), date: today(), at: Date.now(), type: S.mode, exId: exercise.id, name: exercise.name, courseId: context.courseId || null,
      bpm: S.bpm, score: m.score ?? null, clean: !!m.clean, summary: m.error ? m.error : summarize(m), focus: S.mode === 'video' ? S.focus : null,
      metrics: m.error ? null : (({ points, ...rest }) => rest)(m), points: m.points ? m.points.slice(0, 400) : null,
      feedback: S.feedback, thumbs: S.frames.length ? pickFrames().slice(0, 6).map(f => f.thumb) : []
    };
    const list = profile.evaluations; const i = list.findIndex(x => x.id === rec2.id);
    if (i >= 0) list[i] = rec2; else list.push(rec2);
    if (list.length > 40) list.splice(0, list.length - 40);
    list.forEach((e, k) => { if (k < list.length - 6) e.thumbs = []; if (k < list.length - 12) e.points = null; });
    if (!m.error && i < 0 && exercise.goalBpm && m.kind === 'tab') {
      addEvidence(profile, { key: 'eval:' + exercise.id, domain: exercise.domain, label: exercise.name, level: context.level || exercise.level || 4, tempo: S.bpm, goal: exercise.goalBpm, clean: !!m.clean, source: 'evaluation' });
      const ch = recomputeLevels(profile);
      if (ch.length) setTimeout(() => toast(`Skill levels updated: ${describeChanges(ch)}`, 4500), 400);
    }
    Store.save();
  }

  function addPrescriptions() {
    const picked = [...el.querySelectorAll('[data-rx]:checked')].map(c => +c.dataset.rx);
    const all = toPrescriptionExercises(S.feedback.prescriptions, context.level || exercise.level || 4);
    const chosen = all.filter((_, i) => picked.includes(i));
    if (!chosen.length) return toast('Select at least one exercise.');
    const ids = [];
    chosen.forEach(({ ex, reason }) => {
      const id = uid(); ids.push(id);
      profile.prescriptions.push({ id, ex, reason, source: S.mode === 'video' ? 'video check' : 'audio check', from: S.evalId, courseId: context.courseId || null, addedAt: today(), status: 'active', state: newExerciseState(calibratedTarget(ex, ex.level || 4, profile)) });
    });
    const e = profile.evaluations.find(x => x.id === S.evalId); if (e) e.prescriptionIds = ids;
    Store.save();
    toast(`Added ${chosen.length} exercise${chosen.length > 1 ? 's' : ''} to your routines. They appear first in the stretch block.`, 4000);
    const b = el.querySelector('[data-ev="addrx"]'); if (b) { b.disabled = true; b.textContent = '✓ Added to your routine'; }
  }

  /* -------------------------------- Results ------------------------------- */
  function tile(k, v, cls = '') { return `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`; }

  function timelineSVG(points, bpm) {
    if (!points || !points.length) return '';
    const W = 640, H = 150, pad = 26, maxT = Math.max(...points.map(p => p.t), 1), lim = 80;
    const x = t => pad + (t / maxT) * (W - pad - 8), y = d => H / 2 - Math.max(-lim, Math.min(lim, d)) / lim * (H / 2 - 14);
    let s = `<svg class="timeline" viewBox="0 0 ${W} ${H}" role="img" aria-label="Timing of each note">`;
    s += `<rect x="${pad}" y="${y(25)}" width="${W - pad - 8}" height="${y(-25) - y(25)}" fill="rgba(92,196,107,.08)"/>`;
    [-50, 0, 50].forEach(v => { s += `<line x1="${pad}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v ? 'stroke-dasharray="3 4"' : ''}/><text x="2" y="${y(v) + 4}" font-size="10" fill="var(--muted)">${v > 0 ? '+' + v : v}</text>`; });
    s += `<text x="${pad}" y="11" font-size="10" fill="var(--muted)">late ↑ ms</text><text x="${pad}" y="${H - 3}" font-size="10" fill="var(--muted)">early ↓</text>`;
    (S.metrics && S.metrics.extrasAt || []).forEach(t => { if (t >= 0 && t <= maxT) s += `<line x1="${x(t)}" x2="${x(t)}" y1="${H / 2 - 9}" y2="${H / 2 + 9}" stroke="var(--muted)" stroke-width="2"/>`; });
    points.forEach(p => {
      if (p.miss) s += `<text x="${x(p.t)}" y="${H / 2 + 4}" font-size="11" text-anchor="middle" fill="var(--red)">×</text>`;
      else s += `<circle cx="${x(p.t)}" cy="${y(p.dt)}" r="3.2" fill="${!p.ok ? 'var(--red)' : Math.abs(p.dt) <= 25 ? 'var(--green)' : 'var(--amber)'}"/>`;
    });
    return s + '</svg><div class="legend small muted"><span><i style="background:var(--green)"></i>within ±25 ms</span><span><i style="background:var(--amber)"></i>off the beat</span><span><i style="background:var(--red)"></i>wrong note</span><span class="bad">× missed</span><span>| extra note</span></div>';
  }

  function renderCoach() {
    const box = el.querySelector('[data-r="coach"]'); if (!box) return;
    const fb = S.feedback;
    if (!fb) { box.innerHTML = S.coachBusy ? '<p class="muted small"><span class="spinner sm"></span> Claude is reviewing your take…</p>' : ''; return; }
    const rx = toPrescriptionExercises(fb.prescriptions, context.level || exercise.level || 4);
    const already = (profile.evaluations.find(x => x.id === S.evalId) || {}).prescriptionIds;
    box.innerHTML = `
      <div class="sec-head"><h3>Coach’s feedback</h3><span class="badge ${fb.source === 'claude' ? 'ok' : ''}">${fb.source === 'claude' ? 'Claude' : 'Measured'}</span></div>
      ${S.coachBusy ? '<p class="muted small"><span class="spinner sm"></span> Claude is reviewing your take…</p>' : ''}
      <p>${esc(fb.summary)}</p>
      ${fb.strengths.length ? `<div class="fbblock"><div class="label">Strengths</div>${fb.strengths.map(s => `<div class="fbrow ok">✓ ${esc(s)}</div>`).join('')}</div>` : ''}
      ${fb.issues.length ? `<div class="fbblock"><div class="label">To work on</div>${fb.issues.map(i => `<div class="issue ${i.severity}"><b>${esc(i.title)}</b><span class="tag">${esc(i.area)}</span><div class="small">${esc(i.detail)}</div>${i.evidence ? `<div class="small muted">Evidence: ${esc(i.evidence)}</div>` : ''}${i.fix ? `<div class="small fix">→ ${esc(i.fix)}</div>` : ''}</div>`).join('')}</div>` : ''}
      ${fb.frameNotes && fb.frameNotes.length ? `<div class="fbblock"><div class="label">What the camera shows</div><div class="frames">${pickFrames().map((f, i) => { const n = fb.frameNotes.find(x => x.frame === i + 1); return `<figure><img src="${f.thumb}" alt="Frame ${i + 1}"><figcaption><b>${i + 1}</b> ${n ? esc(n.note) : ''}</figcaption></figure>`; }).join('')}</div></div>` : ''}
      ${rx.length ? `<div class="fbblock"><div class="label">Prescribed exercises</div>${rx.map((r, i) => `<label class="rxrow"><input type="checkbox" data-rx="${i}" checked ${already ? 'disabled' : ''}><span><b>${esc(r.ex.name)}</b><span class="small muted"> · ${r.ex.startBpm}→${r.ex.goalBpm} BPM · ${esc(r.reason)}</span></span></label>`).join('')}
        <button class="btn primary block" data-ev="addrx" ${already ? 'disabled' : ''}>${already ? '✓ Added to your routine' : 'Add to my routine'}</button></div>` : ''}
      ${fb.nextStep ? `<p class="small coach">Next: ${esc(fb.nextStep)}</p>` : ''}`;
  }

  function renderResults() {
    const m = S.metrics;
    if (!m || m.error) {
      el.innerHTML = `<div class="evres"><h3>Couldn’t analyze this take</h3><p class="bad">${esc(m ? m.error : 'Unknown error')}</p>
        ${S.frames.length ? '<div data-r="coach"></div>' : ''}
        <div class="row"><button class="btn primary" data-ev="again">Try again</button>${onFinish ? '<button class="btn" data-ev="done">Done</button>' : ''}</div></div>`;
      renderCoach(); return;
    }
    const t = m.timing;
    const rushTxt = !t.calibrated ? '—' : Math.abs(t.meanMs) < 12 ? 'on the beat' : t.meanMs < 0 ? `${-t.meanMs} ms early` : `${t.meanMs} ms late`;
    el.innerHTML = `
      <div class="evres">
        <div class="scorehead"><div class="ring ${m.clean ? 'ok' : m.score >= 80 ? 'mid' : 'low'}" style="--p:${m.score}"><b>${m.score}</b><span>score</span></div>
          <div><div class="label">${esc(exercise.name)} · ${m.bpm} BPM</div><h3>${m.clean ? '✓ Clean take' : m.score >= 80 ? 'Almost clean' : 'Not clean yet'}</h3><p class="small muted">${esc(summarize(m))}</p></div></div>
        <div class="stats">
          ${m.kind === 'tab' ? tile('Notes played', Math.round(m.hitRate * 100) + '%', m.hitRate >= 0.95 ? 'ok' : '') : tile('Notes heard', m.notesPlayed)}
          ${m.pitch && m.pitch.accuracy != null ? tile('Right notes', Math.round(m.pitch.accuracy * 100) + '%', m.pitch.accuracy >= 0.97 ? 'ok' : '') : ''}
          ${m.kind === 'tab' && m.extraNotes ? tile('Extra notes', m.extraNotes, m.extraRate <= 0.08 ? 'ok' : '') : ''}
          ${tile('Timing spread', '±' + t.sdMs + ' ms', t.sdMs <= 15 ? 'ok' : '')}
          ${tile('Rush / drag', rushTxt)}
          ${tile('Drift', Math.abs(t.driftMsPer10s) < 10 ? 'steady' : (t.driftMsPer10s < 0 ? 'speeding up' : 'slowing down'))}
          ${tile('Evenness', '±' + m.dynamics.sdDb + ' dB', m.dynamics.sdDb <= 3 ? 'ok' : '')}
        </div>
        ${m.input ? `<p class="small muted">Recorded from ${esc(m.input.source || '')} · peak ${m.input.peakDb} dBFS${m.input.clipped ? ' · <span class="bad">clipping: turn the input gain down</span>' : m.input.peakDb < -36 ? ' · <span class="bad">very quiet: turn the gain up</span>' : ''}</p>` : ''}
        ${m.pitch && m.pitch.tuningCents != null && Math.abs(m.pitch.tuningCents) >= 12 ? `<p class="note warn">Your guitar sounds ${Math.abs(m.pitch.tuningCents)} cents ${m.pitch.tuningCents < 0 ? 'flat' : 'sharp'}. <a class="link" href="#/tools/tuner">Tune up</a></p>` : ''}
        ${timelineSVG(m.points, m.bpm)}
        ${m.problems && m.problems.length ? `<div class="fbblock"><div class="label">Trouble spots</div>${m.problems.map(p => `<div class="fbrow">• <b>${esc(p.where)}</b> (${esc(p.note)})${p.miss ? ` · missed ${Math.round(p.miss * 100)}%` : ''}${p.timingMs > 20 ? ` · ±${p.timingMs} ms` : ''}${p.wrongPitch ? ` · wrong pitch ${Math.round(p.wrongPitch * 100)}%` : ''}${p.stringChange ? ' · string change' : ''}${p.shift ? ' · position shift' : ''}</div>`).join('')}</div>` : ''}
        ${S.videoUrl ? `<details class="fbblock"><summary class="label">Watch your take</summary><video src="${S.videoUrl}" controls playsinline class="playback"></video><a class="link small" href="${S.videoUrl}" download="fretwork-take.${S.videoUrl && mediaChunks[0] && /mp4/.test(mediaChunks[0].type) ? 'mp4' : 'webm'}">Save video</a></details>` : ''}
        <div data-r="coach"></div>
        <div class="row">${onUse ? '<button class="btn primary" data-ev="use">Use this result</button>' : ''}<button class="btn" data-ev="again">Record again</button>${onFinish ? '<button class="btn ghost" data-ev="done">Done</button>' : ''}</div>
        ${!currentLatency(profile.settings).calibrated ? '<p class="small muted">Calibrate timing (on the setup screen) to also measure whether you rush or drag.</p>' : ''}
      </div>`;
    renderCoach();
  }

  /* -------------------------------- Events -------------------------------- */
  const onClick = e => {
    if (e.target.closest('[data-audio="change"]')) { openAudioSheet(profile, () => { if (S.phase === 'setup') render(); }); return; }
    const b = e.target.closest('[data-ev]'); if (!b) return;
    const a = b.dataset.ev;
    if (a === 'mode') { S.mode = b.dataset.v; return render(); }
    if (a === 'bpm') { const inp = el.querySelector('[data-r="evbpm"]'); S.bpm = Math.max(30, Math.min(300, (+inp.value || S.bpm) + Number(b.dataset.d))); inp.value = S.bpm; return; }
    if (a === 'loops') { S.loops = +b.dataset.v; return render(); }
    if (a === 'secs') { S.seconds = +b.dataset.v; return render(); }
    if (a === 'focus') { S.focus = b.dataset.v; return render(); }
    if (a === 'facing') { S.facing = b.dataset.v; return render(); }
    if (a === 'calib') return runCalibration();
    if (a === 'start') return start();
    if (a === 'stop') return stop();
    if (a === 'cancel') { cancelled = true; return stop(true); }
    if (a === 'again') { S.phase = 'setup'; S.metrics = null; S.feedback = null; S.evalId = null; S.frames = []; return render(); }
    if (a === 'addrx') return addPrescriptions();
    if (a === 'use' && onUse) { const m = S.metrics; return onUse({ tempo: m.bpm, clean: !!m.clean, summary: summarize(m), evalId: S.evalId }); }
    if (a === 'done' && onFinish) return onFinish();
  };
  const onChange = e => { if (e.target.dataset.r === 'hp') { S.headphones = e.target.checked; render(); } };
  const onInput = e => { if (e.target.dataset.r === 'evbpm' && +e.target.value) S.bpm = Math.max(30, Math.min(300, Math.round(+e.target.value))); };
  el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput);
  render();
  return () => {
    el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); el.removeEventListener('input', onInput);
    if (S.phase === 'running') { cancelled = true; stop(true); }
    clearInterval(timer);
  };
}

/** Open an evaluation in a bottom sheet (used from the routine runner). */
export function openEvalSheet({ profile, exercise, bpm, context, onUse, onClose }) {
  let cleanup = null, used = false;
  const sheet = Shell.sheet('<div data-r="ev"></div>', { onClose: () => { if (cleanup) cleanup(); if (!used && onClose) onClose(); } });
  cleanup = mountEvalSession(sheet.el.querySelector('[data-r="ev"]'), {
    profile, exercise, bpm, mode: 'audio', context,
    onUse: r => { used = true; sheet.close(); onUse(r); },
    onFinish: () => sheet.close()
  });
  return sheet;
}
