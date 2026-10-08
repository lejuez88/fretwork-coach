// Interval trainer (Practice → Theory). The screen shows a key and an
// interval; you play that note on the guitar (the microphone listens, any
// octave counts) or tap it on the neck. Key, scale, intervals, reference note,
// string, neck area and label style can each be fixed or randomized. Each
// round is scored (accuracy, time per note, per interval) and saved as
// fretboard and theory evidence.
import { esc, toast, today, uid } from '../core/util.js';
import { Store } from '../core/store.js';
import { Audio } from '../core/audio.js';
import { detectPitch, rms, freqToMidi } from '../tools/pitch.js';
import { fretboardSVG } from '../ui/fretboard.js';
import { Shell } from '../ui/shell.js';
import { CATEGORY_BY_ID } from '../core/library.js';
import { addEvidence, recomputeLevels, describeChanges } from '../core/skills.js';
import { mod12 } from '../core/theory.js';
import {
  INTERVALS, INTERVAL_BY_ID, KEY_NAMES, AREAS, STRING_NAMES, SCALE_CHOICES, DEFAULTS, normalizeSettings, scaleIntervals, scaleName,
  intervalLabel, intervalFamily, newRound, nextPrompt, scoreAnswer, roundDone, summarizeRound, answersPerMinute, settingsLevel,
  positionsOf, pcAt, shapeTip, noteLabel
} from '../core/intervals.js';

const SET_KEY = 'fretworkCoach.intervalTrainer';
export function loadTrainerSettings() {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(SET_KEY) || '{}') || {}); } catch { return normalizeSettings({}); }
}
function saveTrainerSettings(s) { try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch { /* storage off */ } }

/* ------------------------------ Settings form ------------------------------ */
const FIELDS = {
  key: ['Key', () => [...KEY_NAMES.map((n, pc) => [pc, n]), ['random-round', '🎲 Random each round'], ['random-prompt', '🎲 Random every prompt'], ['cycle4', 'Cycle of 4ths']]],
  scale: ['Scale', () => [...SCALE_CHOICES, ['random', '🎲 Random each round']]],
  source: ['Intervals', () => [['scale', 'Scale degrees'], ['custom', 'Pick my own'], ['random-set', '🎲 3–4 random each round']]],
  ext: ['9ths, 11ths, 13ths', () => [[false, 'Off'], [true, 'On'], ['random', '🎲 Random each round']]],
  includeRoot: ['Ask for the root too', () => [[false, 'No'], [true, 'Yes'], ['random', '🎲 Random each round']]],
  from: ['Measure from', () => [['root', 'The root'], ['previous', 'Last note (chain)'], ['random', '🎲 Root or last note']]],
  order: ['Order', () => [['random', '🎲 Random'], ['up', 'Low to high'], ['down', 'High to low']]],
  labels: ['Show the interval as', () => [['deg', 'Number (♭3)'], ['short', 'Short (m3)'], ['long', 'Full (minor 3rd)'], ['random', '🎲 Mixed']]],
  string: ['String', () => [['any', 'Any string'], ...[1, 2, 3, 4, 5, 6].map(s => [s, `String ${s} (${STRING_NAMES[s]})`]), ['random', '🎲 Random each prompt']]],
  area: ['Neck area', () => [...Object.entries(AREAS).map(([k, a]) => [k, a[2]]), ['random', '🎲 Random each round']]],
  showRoots: ['Roots on the neck', () => [[true, 'Show'], [false, 'Hide']]],
  answer: ['Answer by', () => [['mic', '🎤 Play it (mic)'], ['tap', '👆 Tap the neck']]],
  count: ['Prompts per round', () => [[10, '10'], [20, '20'], [30, '30'], [50, '50'], [0, 'Endless']]],
  time: ['Time limit per note', () => [[0, 'None'], [8, '8 seconds'], [5, '5 seconds'], [3, '3 seconds'], [2, '2 seconds']]],
  playRoot: ['Reference tone', () => [[true, 'Root on each new key'], [false, 'Off']]]
};
const RANDOM_ALL = { key: 'random-round', scale: 'random', source: 'random-set', ext: 'random', includeRoot: 'random', from: 'random', order: 'random', labels: 'random', string: 'random', area: 'random' };

function selectHTML(id, S) {
  const [label, opts] = FIELDS[id], cur = JSON.stringify(S[id]);
  return `<label class="mini param"><span>${esc(label)}</span><select data-set="${id}">${opts().map(([v, t]) => { const j = JSON.stringify(v); return `<option value="${esc(j)}" ${j === cur ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
}

/** One-line description of the settings. */
export function describeSettings(S) {
  const key = typeof S.key === 'number' ? `Key of ${KEY_NAMES[S.key]}` : S.key === 'random-prompt' ? 'Random key every prompt' : S.key === 'cycle4' ? 'Cycle of 4ths' : 'Random key each round';
  const scale = S.scale === 'random' ? 'random scale' : scaleName(S.scale);
  const ints = S.source === 'custom' ? `intervals ${S.custom.map(id => intervalLabel(id)).join(', ')}`
    : S.source === 'random-set' ? '3–4 random intervals' : `every degree (${scaleIntervals(S.scale === 'random' ? 'major' : S.scale).filter(x => x !== '1').map(id => intervalLabel(id)).join(' ')})`;
  const from = S.from === 'root' ? 'from the root' : S.from === 'previous' ? 'from the last note' : 'from the root or the last note';
  const where = [S.string === 'any' ? '' : S.string === 'random' ? 'random string' : `string ${S.string}`, S.area === 'neck' ? '' : S.area === 'random' ? 'random neck area' : AREAS[S.area][2].toLowerCase()].filter(Boolean).join(', ') || 'anywhere on the neck';
  return `${key} · ${scale} · ${ints}${S.ext === true ? ' + 9/11/13' : S.ext === 'random' ? ' (+ maybe 9/11/13)' : ''} · ${from} · ${where}`;
}

/** One step harder or easier, for the coach line after a round. */
function harderStep(S) {
  if (!S.time) return [{ time: 8 }, 'an 8-second limit per note'];
  if (typeof S.key === 'number') return [{ key: 'random-round' }, 'a new random key each round'];
  if (S.time > 3) return [{ time: S.time === 8 ? 5 : 3 }, `${S.time === 8 ? 5 : 3} seconds per note`];
  if (S.from === 'root') return [{ from: 'random' }, 'measuring from the root or the last note'];
  if (S.ext !== true) return [{ ext: true }, '9ths, 11ths and 13ths'];
  if (S.key !== 'random-prompt') return [{ key: 'random-prompt' }, 'a new key every prompt'];
  if (S.showRoots) return [{ showRoots: false }, 'no roots marked on the neck'];
  if (S.time > 2) return [{ time: 2 }, '2 seconds per note'];
  return null;
}
function easierStep(S) {
  if (S.time && S.time < 8) return [{ time: S.time === 2 ? 3 : S.time === 3 ? 5 : 8 }, 'more time per note'];
  if (S.time) return [{ time: 0 }, 'no time limit'];
  if (S.from !== 'root') return [{ from: 'root' }, 'measuring from the root only'];
  if (S.key === 'random-prompt') return [{ key: 'random-round' }, 'one key per round'];
  if (!S.showRoots) return [{ showRoots: true }, 'roots marked on the neck'];
  if (S.ext !== false) return [{ ext: false }, 'no 9ths, 11ths or 13ths'];
  return null;
}

const sec = ms => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`);
const pct = x => `${Math.round(x * 100)}%`;
const refMidi = pc => 48 + mod12(pc); // C3–B3: clear on phone speakers, inside the guitar's range

/* --------------------------------- Screen --------------------------------- */
export function mountIntervalTrainer(root, { navigate, entry }) {
  const p = Store.profile;
  let S = loadTrainerSettings();
  let state = 'idle';            // idle | playing | feedback | done
  let round = null, prompt = null, fb = null, hinted = false, tapMark = null, streak = 0, lastPromptKey = null, sum = null, changes = [];
  let micErr = '', tick = null, nextT = null, dead = false, zoneMsg = '';
  const a4 = () => (p && p.settings && p.settings.referenceA4) || 440;
  const cat = CATEGORY_BY_ID[entry.cat] || { name: 'Theory' };

  root.innerHTML = `
    <a class="link" href="#/practice">← Exercise library</a>
    <div class="label">${esc(cat.name)}</div>
    <h1>${esc(entry.title || 'Interval trainer')}</h1>
    ${entry.ex.why ? `<p class="why">${esc(entry.ex.why)}</p>` : ''}
    <section class="card itplay" data-r="play" aria-live="polite"></section>
    <section class="card itset" data-r="settings"></section>
    <section class="card" data-r="stats"></section>`;
  Shell.actions('');
  const $r = n => root.querySelector(`[data-r="${n}"]`);

  /* ----------------------------- Microphone ----------------------------- */
  // Every 40 ms: level → pitch (YIN). A note counts once it holds the same
  // semitone for 3 frames. A note still ringing from the last answer, or the
  // reference tone, is ignored until you pluck again (a jump in level) or it fades.
  const mic = { on: false, an: null, hp: null, buf: null, timer: null, m: null, n: 0, env: 0, quiet: 0, block: null, ignoreUntil: 0, level: 0, sounding: null };
  async function micStart() {
    if (mic.on) return true;
    try {
      const src = await Audio.openMic();
      if (dead) { Audio.closeMic(); return false; }
      const c = Audio.ctx;
      mic.hp = c.createBiquadFilter(); mic.hp.type = 'highpass'; mic.hp.frequency.value = 60;
      mic.an = c.createAnalyser(); mic.an.fftSize = 2048; mic.an.smoothingTimeConstant = 0;
      src.connect(mic.hp); mic.hp.connect(mic.an);
      mic.buf = new Float32Array(mic.an.fftSize);
      Object.assign(mic, { on: true, m: null, n: 0, env: 0, quiet: 0, block: null, sounding: null });
      mic.timer = setInterval(micFrame, 40);
      return true;
    } catch (e) {
      micErr = e && e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser’s site settings, or answer by tapping the neck.'
        : `Couldn’t open the microphone${e && e.message ? ` (${e.message})` : ''}. You can answer by tapping the neck instead.`;
      return false;
    }
  }
  function micStop() {
    if (!mic.on) return;
    clearInterval(mic.timer);
    try { mic.hp && mic.hp.disconnect(); mic.an && mic.an.disconnect(); } catch { /* ignore */ }
    Audio.closeMic();
    Object.assign(mic, { on: false, an: null, hp: null, timer: null, sounding: null, level: 0 });
  }
  function micFrame() {
    if (!mic.an || !Audio.ctx) return;
    mic.an.getFloatTimeDomainData(mic.buf);
    const lv = rms(mic.buf), prevEnv = mic.env;
    mic.level = lv; mic.env = Math.max(lv, mic.env * 0.88);
    if (lv < 0.006) { if (++mic.quiet >= 3) { mic.block = null; mic.sounding = null; } mic.n = 0; mic.m = null; return; }
    mic.quiet = 0;
    if (Date.now() < mic.ignoreUntil) return;                 // the reference tone is playing
    if (lv > 0.015 && lv > prevEnv * 1.5) { mic.block = null; mic.n = 0; mic.m = null; } // a new pluck
    const pd = detectPitch(mic.buf, Audio.ctx.sampleRate, { minFreq: 70, maxFreq: 1300, threshold: 0.12 });
    if (!pd || pd.clarity < 0.85) { mic.n = 0; return; }
    const m = Math.round(freqToMidi(pd.freq, a4()));
    if (m === mic.m) mic.n++; else { mic.m = m; mic.n = 1; }
    if (mic.n === 3) {
      const pc = mod12(m); mic.sounding = pc;
      if (state === 'playing' && pc !== mic.block) answer(pc);
    }
  }

  /* ------------------------------ The round ------------------------------ */
  let starting = false;
  async function start() {
    if (starting) return;
    clearTimeout(nextT); clearInterval(tick);
    micErr = ''; sum = null; changes = [];
    if (S.answer === 'mic') {
      starting = true; setIdleStatus('Opening the microphone…');
      const ok = await micStart();
      starting = false;
      if (dead) return;
      if (!ok) { state = 'idle'; return drawAll(); }
    } else micStop();
    round = newRound(S, { key: S.lastKey });
    S.lastKey = round.key; saveTrainerSettings(S);
    streak = 0; lastPromptKey = null; state = 'playing';
    drawSettings();
    next();
    tick = setInterval(onTick, 100);
  }
  function next() {
    clearTimeout(nextT);
    if (dead || !round) return;
    if (roundDone(round)) return finish();
    prompt = nextPrompt(round);
    hinted = false; fb = null; tapMark = null; zoneMsg = '';
    const keyChanged = prompt.key !== lastPromptKey; lastPromptKey = prompt.key;
    if (S.playRoot && keyChanged) {
      Audio.guitar(refMidi(prompt.key), null, { dur: 1.1, gain: 0.6 });
      prompt.at = Date.now() + 1100;                          // the clock starts after the reference
      mic.ignoreUntil = Date.now() + 1150; mic.block = prompt.key;
    } else { mic.ignoreUntil = 0; mic.block = mic.sounding; }
    prompt.keyChanged = keyChanged && round.i > 1;
    state = 'playing';
    drawPlay();
  }
  function answer(pc, pos = null) {
    if (state !== 'playing' || !prompt) return;
    const ms = Math.max(0, Date.now() - prompt.at), correct = pc === prompt.targetPc;
    if (pos) tapMark = { ...pos, ok: correct };
    scoreAnswer(round, prompt, { correct, ms, playedPc: pc, hinted });
    const counted = round.results[round.results.length - 1].correct;
    streak = counted ? streak + 1 : 0;
    fb = { kind: correct ? (hinted ? 'shown' : 'ok') : 'bad', ms, pc };
    state = 'feedback'; drawPlay();
    nextT = setTimeout(next, correct ? (hinted ? 900 : 650) : 1900);
  }
  function giveUp(kind) {
    if (state !== 'playing' || !prompt) return;
    scoreAnswer(round, prompt, { correct: false, ms: Math.max(0, Date.now() - prompt.at), [kind === 'time' ? 'timedOut' : 'skipped']: true });
    streak = 0; fb = { kind }; state = 'feedback'; drawPlay();
    nextT = setTimeout(next, 1700);
  }
  function stop() {
    clearTimeout(nextT); clearInterval(tick);
    if (round && round.results.length >= 5) return finish();
    if (round && round.results.length) toast('Round stopped. Fewer than 5 answers, so it wasn’t saved.');
    micStop(); state = 'idle'; round = null; prompt = null; drawAll();
  }
  function finish() {
    clearTimeout(nextT); clearInterval(tick); micStop();
    sum = summarizeRound(round);
    changes = saveRound(round, sum);
    state = 'done'; prompt = null; drawAll();
    if (changes.length) toast(`Level up: ${describeChanges(changes)}.`, 4200);
  }

  /** Stats, evidence (fretboard + theory), practice time. Returns level changes. */
  function saveRound(r, s) {
    if (!p || !r.results.length) return [];
    const st = p.intervalStats && typeof p.intervalStats === 'object' && !Array.isArray(p.intervalStats) ? p.intervalStats : {};
    if (!Array.isArray(st.rounds)) st.rounds = [];
    if (!st.byInterval || typeof st.byInterval !== 'object') st.byInterval = {};
    const set = r.settings, perMin = answersPerMinute(s), level = settingsLevel(set), clean = s.acc >= 0.9;
    st.rounds.push({ date: today(), at: Date.now(), n: s.n, correct: s.correct, avgMs: s.avgMs, perMin, key: set.key === 'random-prompt' ? null : r.key, scale: r.scale, level, answer: set.answer, from: set.from, bestStreak: s.bestStreak, weakest: s.weakest });
    if (st.rounds.length > 50) st.rounds.splice(0, st.rounds.length - 50);
    for (const x of r.results) { const b = st.byInterval[x.id] || (st.byInterval[x.id] = { n: 0, correct: 0, ms: 0 }); b.n++; if (x.correct) { b.correct++; b.ms += x.ms; } }
    p.intervalStats = st;
    if (perMin) {
      const ev = { label: 'Interval trainer', level, tempo: perMin, goal: 30, clean, source: 'library', unit: 'correct notes/min' };
      addEvidence(p, { key: 'interval-trainer', domain: 'fretboard', ...ev });
      addEvidence(p, { key: 'interval-trainer:theory', domain: 'theory', ...ev });
    }
    p.exerciseLog.push({ date: today(), at: Date.now(), exerciseId: 'lib-interval-trainer', name: `Interval trainer (${pct(s.acc)} right, correct notes per minute)`, tempo: perMin, goalBpm: 30, clean, mastered: false, source: 'library' });
    const minutes = Math.round((Date.now() - r.startedAt) / 6000) / 10;
    if (minutes >= 0.5) p.practiceLog.push({ id: uid(), date: today(), start: r.startedAt, minutes, source: 'library', courseId: null, genre: null, note: 'Interval trainer' });
    const ch = recomputeLevels(p);
    if (!Store.save()) toast('Couldn’t save to this browser (storage is full or blocked).', 4200);
    return ch;
  }

  function onTick() {
    if (mic.on) { const m = $r('meter'); if (m) m.style.width = Math.min(100, Math.round(Math.sqrt(mic.level) * 260)) + '%'; }
    if (state !== 'playing' || !prompt) return;
    const st = $r('status'), want = statusInfo();
    if (st && st.textContent !== want.text) { st.textContent = want.text; st.className = `it-status ${want.cls}`; }
    if (!S.time) return;
    const left = S.time * 1000 - (Date.now() - prompt.at);
    const bar = $r('tbar'); if (bar) bar.style.width = Math.max(0, Math.min(100, left / (S.time * 10))) + '%';
    if (left <= 0) giveUp('time');
  }

  /* ------------------------------- Drawing ------------------------------- */
  function statusInfo() {
    if (!prompt) return { text: '', cls: '' };
    const name = noteLabel(prompt.targetName);
    if (state === 'feedback' && fb) {
      if (fb.kind === 'ok') return { text: `✓ ${name} · ${sec(fb.ms)}${streak >= 3 ? ` · ${streak} in a row` : ''}`, cls: 'ok' };
      if (fb.kind === 'shown') return { text: `✓ ${name}. It was shown, so it doesn’t count; you’ll get it next time.`, cls: 'mid' };
      if (fb.kind === 'bad') return { text: `✗ That’s ${KEY_NAMES[fb.pc]}. The ${intervalLabel(prompt.id, 'long')} is ${name}.`, cls: 'bad' };
      if (fb.kind === 'time') return { text: `⏱ Time. It’s ${name}.`, cls: 'bad' };
      return { text: `Skipped. It’s ${name}.`, cls: 'mid' };
    }
    if (zoneMsg) return { text: zoneMsg, cls: 'mid' };
    if (hinted) return { text: `It’s ${name}. Play it to move on.`, cls: 'mid' };
    if (Date.now() < prompt.at) return { text: `♪ Listen: the root, ${prompt.keyName}`, cls: '' };
    return S.answer === 'mic' ? { text: '🎤 Listening… play it (any octave)', cls: '' } : { text: '👆 Tap it on the neck', cls: '' };
  }
  function whereText(pr) {
    const parts = [];
    if (pr.string) parts.push(`on string ${pr.string} (${STRING_NAMES[pr.string]})`);
    if (pr.zone[0] !== 0 || pr.zone[1] !== 15) parts.push(pr.zone[0] === 0 ? `in frets 0–${pr.zone[1]}` : `in frets ${pr.zone[0]}–${pr.zone[1]}`);
    return parts.join(' ');
  }
  function boardHTML() {
    const marks = [];
    let zone = null, focus = null;
    if (prompt) {
      zone = prompt.zone; focus = prompt.string;
      if (S.showRoots) positionsOf(prompt.refPc, zone)
        .forEach(q => marks.push({ ...q, label: prompt.from === 'root' ? 'R' : prompt.refName, family: 'root', ghost: prompt.from !== 'root', cls: 'ref' }));
      if (hinted || state === 'feedback') {
        positionsOf(prompt.targetPc, zone, prompt.string).forEach(q => {
          const i = marks.findIndex(m => m.s === q.s && m.f === q.f); if (i >= 0) marks.splice(i, 1);
          marks.push({ ...q, label: intervalLabel(prompt.id), family: intervalFamily(prompt.id), cls: 'target' });
        });
      }
      if (tapMark && !tapMark.ok) marks.push({ s: tapMark.s, f: tapMark.f, label: '✗', family: 'ext', cls: 'wrong' });
    } else if (state === 'idle' && typeof S.key === 'number' && S.area !== 'random' && S.showRoots) {
      positionsOf(S.key, S.area, typeof S.string === 'number' ? S.string : null).forEach(q => marks.push({ ...q, label: 'R', family: 'root', cls: 'ref' }));
      zone = AREAS[S.area].slice(0, 2); focus = typeof S.string === 'number' ? S.string : null;
    }
    const interactive = S.answer === 'tap' && state === 'playing';
    return `<div class="fbwrap it-board ${interactive ? 'tapping' : ''}" data-r="board">${fretboardSVG({ marks, interactive, highlightFrets: zone && (zone[0] > 0 || zone[1] < 15) ? zone : null, focusString: focus })}</div>`;
  }
  function setIdleStatus(text) { const el = $r('idlestatus'); if (el) el.textContent = text; }

  function idleHTML() {
    return `<div class="label">Interval trainer</div>
      <p class="it-summary">${esc(describeSettings(S))}</p>
      ${boardHTML()}
      ${micErr ? `<div class="note warn">${esc(micErr)} <button class="btn sm" data-it="tapmode">👆 Answer by tapping</button></div>` : ''}
      <button class="btn primary block" data-it="start">▶ Start${S.count ? ` · ${S.count} prompts` : ' · endless'}</button>
      <p class="small muted it-how" data-r="idlestatus">${S.answer === 'mic'
        ? 'Each prompt shows a key and an interval. Play that note on your guitar; the app listens through the microphone and any octave counts. Mute the other strings so one note rings.'
        : 'Each prompt shows a key and an interval. Tap that note on the neck.'}</p>`;
  }
  function playingHTML() {
    const pr = prompt, label = intervalLabel(pr.id, pr.labels), done = round.results.length, right = round.results.filter(x => x.correct).length;
    const keyText = round.settings.source === 'custom' && round.scale === 'chromatic' ? '' : ` <small>${esc(scaleName(round.scale))}</small>`;
    const ref = pr.semis === 0 ? (pr.from === 'root' ? `the root, <b>${esc(pr.refName)}</b>, in another spot` : `the same note as the last one, <b>${esc(pr.refName)}</b>`)
      : pr.from === 'root' ? `above the root, <b>${esc(pr.refName)}</b>` : `above <b>${esc(pr.refName)}</b>, the last note`;
    const where = whereText(pr);
    return `<div class="it-top">
        <span class="it-keychip ${pr.keyChanged ? 'new' : ''}">Key <b>${esc(pr.keyName)}</b>${keyText}</span>
        <span class="small muted">${pr.n}${round.settings.count ? ` / ${round.settings.count}` : ''}</span>
        <span class="small">${done ? `<span class="${right === done ? 'ok' : ''}">${right}/${done} right</span>` : ''}${streak >= 2 ? ` · 🔥 ${streak}` : ''}</span></div>
      <div class="it-prompt"><div class="it-int ${label.length > 4 ? 'long' : ''}" data-r="int">${esc(label)}</div>
        <div class="it-sub">${pr.labels !== 'long' && pr.semis !== 0 ? `${esc(intervalLabel(pr.id, 'long'))} ` : ''}${ref}${where ? ` · ${esc(where)}` : ''}</div></div>
      <div class="it-status ${statusInfo().cls}" data-r="status">${esc(statusInfo().text)}</div>
      ${(hinted || (state === 'feedback' && fb && fb.kind !== 'ok')) ? `<div class="small it-shape">🧭 ${esc(shapeTip(pr.id))}</div>` : ''}
      ${S.time ? `<div class="bar thin it-time"><i data-r="tbar" style="width:${Math.max(0, Math.min(100, (S.time * 1000 - (Date.now() - pr.at)) / (S.time * 10)))}%"></i></div>` : ''}
      ${mic.on ? '<div class="it-meter" title="Input level"><i data-r="meter"></i></div>' : ''}
      ${boardHTML()}
      <div class="row it-btns">
        <button class="btn sm" data-it="ref" title="Hear the reference note">♪ ${esc(pr.refName)}</button>
        <button class="btn sm" data-it="hint" ${hinted || state !== 'playing' ? 'disabled' : ''}>Show me</button>
        <button class="btn sm" data-it="skip" ${state !== 'playing' ? 'disabled' : ''}>Skip</button>
        <button class="btn sm ghost" data-it="stop">■ Stop</button></div>`;
  }
  function resultsHTML() {
    const s = sum, perMin = answersPerMinute(s), acc = s.acc;
    const per = [...s.per].sort((a, b) => INTERVAL_BY_ID[a.id].semis - INTERVAL_BY_ID[b.id].semis);
    const up = harderStep(S), down = easierStep(S);
    const coach = acc > 0.85 && (s.avgMs || 9e9) < 3000
      ? `Above 85%: this is too comfortable to stretch you.${up ? ` Try ${esc(up[1])}.` : ''}`
      : acc < 0.7 ? `Under 70%: shrink it so you can build it back.${s.weakest.length ? ` Drill ${esc(s.weakest.map(id => intervalLabel(id)).join(', '))} on their own` : ''}${down ? `${s.weakest.length ? ', or try' : ' Try'} ${esc(down[1])}` : ''}.`
      : 'Right in the edge zone (70–85%). Keep these settings until you pass 90% in two rounds, then make it harder.';
    return `<div class="label">Round complete</div>
      <div class="it-res"><div class="bigres ${acc >= 0.9 ? 'ok' : acc < 0.7 ? 'bad' : ''}">${pct(acc)}</div>
        <div class="small">${s.correct} of ${s.n} right · ${sec(s.avgMs)} per note · best streak ${s.bestStreak}${perMin ? ` · <b>${perMin}</b> correct notes/min (goal 30)` : ''}</div></div>
      <div class="it-per">${per.map(b => `<div class="it-prow"><b>${esc(intervalLabel(b.id))}</b><span class="bar thin"><i style="width:${Math.round(b.acc * 100)}%"></i></span><span class="small">${b.correct}/${b.n}</span><span class="small muted">${sec(b.avgMs)}</span></div>`).join('')}</div>
      <p class="coach small">${coach}</p>
      ${changes.length ? `<p class="small ok">Level up: ${esc(describeChanges(changes))}</p>` : ''}
      <div class="row">
        <button class="btn primary" data-it="start">▶ Another round</button>
        ${s.weakest.length ? `<button class="btn" data-it="weak">🎯 Drill ${esc(s.weakest.map(id => intervalLabel(id)).join(', '))}</button>` : ''}
        ${acc > 0.85 && up ? '<button class="btn" data-it="harder">⬆ Make it harder</button>' : ''}
        ${acc < 0.7 && down ? '<button class="btn" data-it="easier">⬇ Make it easier</button>' : ''}
      </div>`;
  }
  function drawPlay() {
    const el = $r('play'); if (!el) return;
    el.innerHTML = state === 'done' && sum ? resultsHTML() : prompt && (state === 'playing' || state === 'feedback') ? playingHTML() : idleHTML();
    if (mic.on) onTick();
  }
  function drawSettings() {
    const busy = state === 'playing' || state === 'feedback';
    const chips = S.source === 'custom' ? `<div class="label it-sublabel">Your intervals</div><div class="chips it-custom">${INTERVALS.map(i => `<button class="chip sm ${S.custom.includes(i.id) ? 'on' : ''}" data-ci="${i.id}" title="${esc(i.long)}">${esc(i.deg)}</button>`).join('')}</div>` : '';
    $r('settings').innerHTML = `
      <div class="sec-head"><h3>Settings</h3><div class="it-setbtns"><button class="btn sm" data-it="randall" ${busy ? 'disabled' : ''}>🎲 Randomize all</button><button class="btn sm ghost" data-it="reset" ${busy ? 'disabled' : ''}>Reset</button></div></div>
      ${busy ? '<p class="small muted">Stop the round to change settings.</p>' : '<p class="small muted">Every setting with 🎲 can be randomized.</p>'}
      <fieldset class="it-fields" ${busy ? 'disabled' : ''}>
        <div class="label it-sublabel">What to find</div>
        <div class="params">${['key', 'scale', 'source'].map(id => selectHTML(id, S)).join('')}</div>
        ${chips}
        <div class="params">${['ext', ...(S.source === 'custom' ? [] : ['includeRoot']), 'from', 'order', 'labels'].map(id => selectHTML(id, S)).join('')}</div>
        <div class="label it-sublabel">Where on the neck</div>
        <div class="params">${['string', 'area', 'showRoots'].map(id => selectHTML(id, S)).join('')}</div>
        <div class="label it-sublabel">How</div>
        <div class="params">${['answer', 'count', 'time', 'playRoot'].map(id => selectHTML(id, S)).join('')}</div>
      </fieldset>`;
  }
  function drawStats() {
    const st = (p && p.intervalStats) || {}, by = st.byInterval || {}, rounds = st.rounds || [];
    const have = INTERVALS.filter(i => by[i.id] && by[i.id].n);
    if (!have.length) { $r('stats').innerHTML = '<h3>Your intervals</h3><p class="muted small">Play a round to see which intervals you know cold and which slow you down.</p>'; return; }
    const recent = rounds.slice(-5).reverse();
    $r('stats').innerHTML = `<div class="sec-head"><h3>Your intervals</h3><span class="small muted">${rounds.length} round${rounds.length === 1 ? '' : 's'}</span></div>
      <div class="it-stats">${have.map(i => { const b = by[i.id], a = b.correct / b.n, t = b.correct ? b.ms / b.correct : null;
        const cls = a >= 0.9 && (t || 0) < 3000 ? 'good' : a >= 0.7 ? 'mid' : 'weak';
        return `<span class="istat ${cls}" title="${esc(i.long)}: ${b.correct} of ${b.n} right"><b>${esc(i.deg)}</b><small>${pct(a)} · ${sec(t)}</small></span>`; }).join('')}</div>
      <div class="it-recent">${recent.map(r => `<div class="logrow"><span>${esc(r.date)}</span><span>${r.key == null ? 'mixed keys' : esc(KEY_NAMES[r.key])} ${esc(scaleName(r.scale))}</span><b class="${r.n && r.correct / r.n >= 0.9 ? 'ok' : ''}">${r.n ? pct(r.correct / r.n) : '—'}</b><span class="muted">${sec(r.avgMs)}</span></div>`).join('')}</div>`;
  }
  function drawAll() { drawPlay(); drawSettings(); drawStats(); }

  function setSettings(patch) {
    S = normalizeSettings({ ...S, ...patch });
    saveTrainerSettings(S);
    if (state === 'done') { state = 'idle'; sum = null; }
    drawAll();
  }

  /* ------------------------------- Events ------------------------------- */
  const onClick = e => {
    const hit = e.target.closest('.fb-hit');
    if (hit) {
      if (state !== 'playing' || S.answer !== 'tap' || !prompt) return;
      const s = +hit.dataset.s, f = +hit.dataset.f;
      if (prompt.string && s !== prompt.string) { zoneMsg = `Use string ${prompt.string} (${STRING_NAMES[prompt.string]}).`; return onTick(); }
      if (f < prompt.zone[0] || f > prompt.zone[1]) { zoneMsg = `Stay in frets ${prompt.zone[0]}–${prompt.zone[1]}.`; return onTick(); }
      return answer(pcAt(s, f), { s, f });
    }
    const ci = e.target.closest('[data-ci]');
    if (ci) {
      const id = ci.dataset.ci, has = S.custom.includes(id);
      if (has && S.custom.length === 1) return toast('Keep at least one interval.');
      return setSettings({ custom: has ? S.custom.filter(x => x !== id) : [...S.custom, id] });
    }
    const b = e.target.closest('[data-it]'); if (!b || b.disabled) return;
    const a = b.dataset.it;
    if (a === 'start') return start();
    if (a === 'stop') return stop();
    if (a === 'skip') return giveUp('skip');
    if (a === 'hint') { if (state === 'playing') { hinted = true; drawPlay(); } return; }
    if (a === 'ref' && prompt) { Audio.guitar(refMidi(prompt.refPc), null, { dur: 1.1, gain: 0.6 }); mic.ignoreUntil = Date.now() + 1150; mic.block = prompt.refPc; return; }
    if (a === 'tapmode') { micErr = ''; return setSettings({ answer: 'tap' }); }
    if (a === 'randall') { setSettings(RANDOM_ALL); return toast('Everything that can be random is now random.'); }
    if (a === 'reset') { const lastKey = S.lastKey; S = normalizeSettings({ ...DEFAULTS, lastKey }); saveTrainerSettings(S); state = 'idle'; sum = null; return drawAll(); }
    if (a === 'weak' && sum && sum.weakest.length) { setSettings({ source: 'custom', custom: sum.weakest }); return start(); }
    if (a === 'harder') { const st = harderStep(S); if (st) { setSettings(st[0]); toast(`Harder: ${st[1]}.`); } return; }
    if (a === 'easier') { const st = easierStep(S); if (st) { setSettings(st[0]); toast(`Easier: ${st[1]}.`); } return; }
  };
  const onChange = e => {
    const sel = e.target.closest('[data-set]'); if (!sel) return;
    let v; try { v = JSON.parse(sel.value); } catch { v = sel.value; }
    if (sel.dataset.set === 'answer') micErr = '';
    setSettings({ [sel.dataset.set]: v });
  };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
  drawAll();

  return () => {
    dead = true;
    clearTimeout(nextT); clearInterval(tick);
    // leaving mid-round keeps the answers you gave (5 or more)
    if (round && (state === 'playing' || state === 'feedback') && round.results.length >= 5) { try { saveRound(round, summarizeRound(round)); } catch { /* ignore */ } }
    micStop();
    root.removeEventListener('click', onClick); root.removeEventListener('change', onChange);
    Shell.actions('');
  };
}
