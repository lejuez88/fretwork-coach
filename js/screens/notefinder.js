// Note finder (Tools → Trainers): learn every note on the neck. Two ways to drill:
//   Find it  the app names a note and a string ("Find C♯ on the A string"); tap the fret.
//   Name it  the app marks a spot on the neck; pick the note's name.
// Choose the strings, the notes (all 12, naturals only, or any set), the fret range, and whether
// prompts come in order or at random. Rounds of 20 (or endless) track accuracy, time and the
// spots you miss most, so later rounds ask those more often.
import { esc, toast } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { Store } from '../core/store.js';
import { STD_LOW, mod12, pcName } from '../core/theory.js';
import { fretboardSVG } from '../ui/fretboard.js';

const KEY = 'fretworkCoach.noteFinder';
const STRING_NAMES = { 1: 'high E', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
export const NF_DEFAULTS = { mode: 'find', strings: [6, 5], notes: NATURALS.slice(), frets: 12, order: 'random', flats: false, round: 20 };
export function loadNoteFinder() {
  try { return Object.assign({}, NF_DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return { ...NF_DEFAULTS }; }
}
const saveSettings = S => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } };
const midiAt = (s, f) => STD_LOW[6 - s] + f;
/** Every fret (0..maxFret) on a string where a pitch class sits. */
export const fretsFor = (s, pc, maxFret) => { const out = []; for (let f = 0; f <= maxFret; f++) if (mod12(midiAt(s, f)) === pc) out.push(f); return out; };

/**
 * The next prompt. In order: strings low to high, notes in order. At random: weighted toward the
 * spots missed most this session, never the same spot twice in a row.
 */
export function nextPrompt(S, state) {
  const strings = S.strings.slice().sort((a, b) => b - a), notes = S.notes.slice().sort((a, b) => a - b);
  if (!strings.length || !notes.length) return null;
  if (S.order === 'order') {
    const i = state.seq++ % (strings.length * notes.length);
    const s = strings[Math.floor(i / notes.length)], pc = notes[i % notes.length];
    return { s, pc, f: fretsFor(s, pc, S.frets)[0] };
  }
  const pool = [];
  for (const s of strings) for (const pc of notes) {
    const frets = fretsFor(s, pc, S.frets); if (!frets.length) continue;
    const miss = (state.misses[`${s}:${pc}`] || 0), w = 1 + miss * 2;
    for (let k = 0; k < w; k++) pool.push({ s, pc, frets });
  }
  if (!pool.length) return null;
  let pick, tries = 0;
  do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (state.last && pick.s === state.last.s && pick.pc === state.last.pc && pool.length > 1 && ++tries < 12);
  return { s: pick.s, pc: pick.pc, f: pick.frets[Math.floor(Math.random() * pick.frets.length)] };
}

export function mountNoteFinder(el) {
  const p = Store.profile;
  let S = loadNoteFinder();
  const st = { playing: false, seq: 0, n: 0, ok: 0, times: [], misses: {}, roundMiss: {}, last: null, prompt: null, t0: 0, feedback: null, wrong: null };
  let timer = null;
  const name = pc => pcName(pc, S.flats);
  const setOpen = () => !st.playing;

  function render() {
    el.innerHTML = `<div class="nf">
      <section class="card nf-play" data-r="play" aria-live="polite"></section>
      <section class="card nf-set" data-r="set"></section>
    </div>`;
    drawPlay(); drawSettings();
  }
  function neck(marks, interactive) {
    return `<div class="fbwrap nf-neck">${fretboardSVG({ marks, interactive, maxFret: Math.max(12, S.frets), focusString: st.prompt && S.mode === 'find' ? st.prompt.s : null, highlightFrets: [0, S.frets], fw: 44 })}</div>`;
  }
  function drawPlay() {
    const host = el.querySelector('[data-r="play"]'); if (!host) return;
    const acc = st.n ? Math.round(st.ok / st.n * 100) : 0, avg = st.times.length ? (st.times.reduce((a, b) => a + b, 0) / st.times.length / 1000).toFixed(1) : '–';
    const stats = `<div class="nf-stats"><span><b>${st.n}</b>${S.round ? ` / ${S.round}` : ''} asked</span><span><b>${acc}%</b> right</span><span><b>${avg}s</b> average</span></div>`;
    if (!st.playing) {
      const done = st.n > 0;
      const weak = Object.entries(st.roundMiss).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => { const [s, pc] = k.split(':').map(Number); return `${name(pc)} on the ${STRING_NAMES[s]} string`; });
      host.innerHTML = `<div class="label">Note finder</div>
        <h3>${done ? `Round done: ${acc}% right, ${avg}s per note` : 'Learn every note on the neck'}</h3>
        ${done ? `${stats}${weak.length ? `<p class="small">Missed most: ${weak.map(esc).join(', ')}. The next round asks these more often.</p>` : '<p class="small ok">No misses. Add a string or the sharps and flats next.</p>'}` : `<p class="small muted">${S.mode === 'find' ? 'The app names a note and a string; tap the fret where it is.' : 'The app marks a spot on the neck; pick the note’s name.'} ${describe(S)}</p>`}
        ${neck(done ? [] : [], false)}
        <button class="btn primary block" data-nf="start" ${S.strings.length && S.notes.length ? '' : 'disabled'}>${done ? '▶ Another round' : '▶ Start'}</button>`;
      return;
    }
    const pr = st.prompt; if (!pr) return;
    const fb = st.feedback;
    if (S.mode === 'find') {
      const marks = [];
      if (fb) {
        fretsFor(pr.s, pr.pc, S.frets).forEach(f => marks.push({ s: pr.s, f, label: name(pr.pc), family: 'root', cls: 'target' }));
        if (st.wrong) marks.push({ s: st.wrong.s, f: st.wrong.f, label: name(mod12(midiAt(st.wrong.s, st.wrong.f))), cls: 'wrong' });
      }
      host.innerHTML = `<div class="nf-q"><span class="nf-note">${esc(name(pr.pc))}</span><span class="nf-on">on the <b>${STRING_NAMES[pr.s]}</b> string</span></div>
        ${stats}${neck(marks, !fb)}
        <p class="small nf-fb ${fb === 'ok' ? 'ok' : fb === 'bad' ? 'bad' : 'muted'}">${fb === 'ok' ? 'Right.' : fb === 'bad' ? `Not quite: ${esc(name(pr.pc))} is at fret ${fretsFor(pr.s, pr.pc, S.frets).join(' and ')}.` : `Tap the fret${S.frets > 12 ? ' (frets 0–' + S.frets + ')' : ''}.`}</p>
        <div class="row"><button class="btn" data-nf="stop">Stop</button>${fb === 'bad' ? '<button class="btn primary" data-nf="next">Next ›</button>' : ''}</div>`;
    } else {
      const marks = [{ s: pr.s, f: pr.f, label: fb ? name(pr.pc) : '?', family: 'root', cls: 'target' }];
      const choices = S.notes.length >= 4 ? S.notes : Array.from({ length: 12 }, (_, i) => i);
      host.innerHTML = `<div class="nf-q"><span class="nf-on">Which note is this? <span class="muted">(${STRING_NAMES[pr.s]} string, fret ${pr.f})</span></span></div>
        ${stats}${neck(marks, false)}
        <div class="nf-choices">${choices.slice().sort((a, b) => a - b).map(pc => `<button class="chip ${fb && pc === pr.pc ? 'on' : ''} ${fb === 'bad' && st.wrongPc === pc ? 'bad' : ''}" data-pc="${pc}" ${fb ? 'disabled' : ''}>${esc(name(pc))}</button>`).join('')}</div>
        <p class="small nf-fb ${fb === 'ok' ? 'ok' : fb === 'bad' ? 'bad' : 'muted'}">${fb === 'ok' ? 'Right.' : fb === 'bad' ? `It’s ${esc(name(pr.pc))}.` : ' '}</p>
        <div class="row"><button class="btn" data-nf="stop">Stop</button>${fb === 'bad' ? '<button class="btn primary" data-nf="next">Next ›</button>' : ''}</div>`;
    }
  }
  function describe(x) {
    const strs = x.strings.slice().sort((a, b) => b - a).map(s => STRING_NAMES[s]).join(', ');
    const nts = x.notes.length === 12 ? 'all 12 notes' : x.notes.length === 7 && NATURALS.every(n => x.notes.includes(n)) ? 'the natural notes' : `${x.notes.length} notes`;
    return `Strings: ${strs || 'none'}; ${nts}; frets 0–${x.frets}; ${x.order === 'random' ? 'random order' : 'in order'}.`;
  }
  function drawSettings() {
    const host = el.querySelector('[data-r="set"]'); if (!host) return;
    const dis = setOpen() ? '' : 'disabled';
    host.innerHTML = `<h3>Settings</h3>
      <div class="field"><label>Mode</label><div class="chips">${[['find', 'Find it (tap the fret)'], ['name', 'Name it (pick the note)']].map(([k, l]) => `<button class="chip ${S.mode === k ? 'on' : ''}" data-mode="${k}" ${dis}>${l}</button>`).join('')}</div></div>
      <div class="field"><label>Strings</label><div class="chips">${[6, 5, 4, 3, 2, 1].map(s => `<button class="chip ${S.strings.includes(s) ? 'on' : ''}" data-str="${s}" ${dis}>${STRING_NAMES[s]}</button>`).join('')}<button class="chip ghost" data-str="all" ${dis}>All</button></div></div>
      <div class="field"><label>Notes</label><div class="chips">${Array.from({ length: 12 }, (_, pc) => `<button class="chip ${S.notes.includes(pc) ? 'on' : ''}" data-note="${pc}" ${dis}>${esc(name(pc))}</button>`).join('')}</div>
        <div class="chips" style="margin-top:6px"><button class="chip ghost" data-notes="nat" ${dis}>Naturals</button><button class="chip ghost" data-notes="acc" ${dis}>Sharps / flats</button><button class="chip ghost" data-notes="all" ${dis}>All 12</button><button class="chip ghost" data-notes="rand" ${dis}>Random 4</button></div></div>
      <div class="field"><label>Frets</label><div class="chips">${[5, 7, 12, 15, 22].map(f => `<button class="chip ${S.frets === f ? 'on' : ''}" data-frets="${f}" ${dis}>0–${f}</button>`).join('')}</div></div>
      <div class="field"><label>Order</label><div class="chips">${[['random', 'Random'], ['order', 'In order']].map(([k, l]) => `<button class="chip ${S.order === k ? 'on' : ''}" data-order="${k}" ${dis}>${l}</button>`).join('')}</div></div>
      <div class="field"><label>Round</label><div class="chips">${[[10, '10'], [20, '20'], [40, '40'], [0, 'Endless']].map(([k, l]) => `<button class="chip ${S.round === k ? 'on' : ''}" data-round="${k}" ${dis}>${l}</button>`).join('')}<button class="chip ${S.flats ? 'on' : ''}" data-flats="1" ${dis}>Show flats (♭)</button></div></div>
      <button class="btn ghost sm" data-nf="randomize" ${dis}>🎲 Randomize the settings</button>`;
  }

  function ask() {
    st.prompt = nextPrompt(S, st); st.feedback = null; st.wrong = null; st.wrongPc = null; st.t0 = performance.now();
    if (!st.prompt) { stop(); toast('Pick at least one string and one note.'); return; }
    drawPlay();
  }
  function start() {
    Object.assign(st, { playing: true, seq: 0, n: 0, ok: 0, times: [], last: null, roundMiss: {} });
    drawSettings(); ask();
  }
  function stop() {
    st.playing = false; clearTimeout(timer);
    if (st.n) {
      const rec = p && (p.trainerStats || (p.trainerStats = {}));
      if (rec) { const list = rec.noteFinder || (rec.noteFinder = []); list.push({ date: new Date().toISOString().slice(0, 10), n: st.n, ok: st.ok, avgMs: st.times.length ? Math.round(st.times.reduce((a, b) => a + b, 0) / st.times.length) : null, mode: S.mode, strings: S.strings.slice(), notes: S.notes.length }); if (list.length > 60) list.splice(0, list.length - 60); Store.save(); }
    }
    drawPlay(); drawSettings();
  }
  function answer(correct, playS, playF) {
    const pr = st.prompt;
    st.n++; st.times.push(performance.now() - st.t0); st.last = pr;
    const k = `${pr.s}:${pr.pc}`;
    if (correct) { st.ok++; st.misses[k] = Math.max(0, (st.misses[k] || 0) - 1); st.feedback = 'ok'; }
    else { st.misses[k] = (st.misses[k] || 0) + 1; st.roundMiss[k] = (st.roundMiss[k] || 0) + 1; st.feedback = 'bad'; }
    try { Audio.guitar(midiAt(playS, playF), null, { dur: 0.9, gain: 0.55 }); } catch { /* no audio */ }
    drawPlay();
    const finished = S.round && st.n >= S.round;
    if (correct) timer = setTimeout(() => (finished ? stop() : ask()), 650);
    else if (finished) timer = setTimeout(stop, 1800);
  }

  el.addEventListener('click', e => {
    const hit = e.target.closest('.fb-hit');
    if (hit && st.playing && S.mode === 'find' && !st.feedback) {
      const s = +hit.dataset.s, f = +hit.dataset.f, pr = st.prompt;
      if (f > S.frets) return;
      if (s !== pr.s) { toast(`That’s the ${STRING_NAMES[s]} string. Find it on the ${STRING_NAMES[pr.s]} string.`); return; }
      const ok = mod12(midiAt(s, f)) === pr.pc;
      if (!ok) st.wrong = { s, f };
      answer(ok, s, ok ? f : (fretsFor(pr.s, pr.pc, S.frets)[0]));
      return;
    }
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.pc != null && st.playing && S.mode === 'name' && !st.feedback) { const pc = +b.dataset.pc, ok = pc === st.prompt.pc; if (!ok) st.wrongPc = pc; answer(ok, st.prompt.s, st.prompt.f); return; }
    if (b.dataset.nf === 'start') return start();
    if (b.dataset.nf === 'stop') return stop();
    if (b.dataset.nf === 'next') { clearTimeout(timer); return (S.round && st.n >= S.round) ? stop() : ask(); }
    let changed = true;
    if (b.dataset.mode) S.mode = b.dataset.mode;
    else if (b.dataset.str) { if (b.dataset.str === 'all') S.strings = [6, 5, 4, 3, 2, 1]; else { const s = +b.dataset.str; S.strings = S.strings.includes(s) ? S.strings.filter(x => x !== s) : [...S.strings, s]; } }
    else if (b.dataset.note != null) { const pc = +b.dataset.note; S.notes = S.notes.includes(pc) ? S.notes.filter(x => x !== pc) : [...S.notes, pc]; }
    else if (b.dataset.notes) S.notes = b.dataset.notes === 'nat' ? NATURALS.slice() : b.dataset.notes === 'acc' ? [1, 3, 6, 8, 10] : b.dataset.notes === 'all' ? Array.from({ length: 12 }, (_, i) => i) : shuffle12().slice(0, 4);
    else if (b.dataset.frets) S.frets = +b.dataset.frets;
    else if (b.dataset.order) S.order = b.dataset.order;
    else if (b.dataset.round != null) S.round = +b.dataset.round;
    else if (b.dataset.flats) S.flats = !S.flats;
    else if (b.dataset.nf === 'randomize') {
      const strs = shuffle([6, 5, 4, 3, 2, 1]).slice(0, 1 + Math.floor(Math.random() * 3));
      S = { ...S, strings: strs, notes: shuffle12().slice(0, 3 + Math.floor(Math.random() * 6)), frets: [7, 12, 12, 15][Math.floor(Math.random() * 4)], order: 'random', mode: Math.random() < 0.5 ? 'find' : 'name' };
      toast('New mix: ' + describe(S));
    } else changed = false;
    if (changed) { saveSettings(S); drawSettings(); drawPlay(); }
  });
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const shuffle12 = () => shuffle(Array.from({ length: 12 }, (_, i) => i));
  render();
  return () => { clearTimeout(timer); };
}
