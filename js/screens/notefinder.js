// Note finder (Tools → Trainers): learn every note on the neck. Two ways to drill:
//   Find it  the app names a note and a string ("Find C♯ on the A string"); tap the fret, or play
//            it on your guitar (the microphone listens, and the octave has to be on that string).
//   Name it  the app marks a spot on the neck; pick the note's name.
// Four levels (Foundations → Mastery) set the strings, notes, frets and a time limit in one tap,
// with your recommended level marked; Customize keeps every setting for your own mix. Rounds
// track accuracy, time and the spots you miss most, so later rounds ask those more often.
import { esc, toast } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { Store, isGuest } from '../core/store.js';
import { STD_LOW, mod12, pcName } from '../core/theory.js';
import { fretboardSVG } from '../ui/fretboard.js';
import { tierPickerHTML } from '../ui/tierpicker.js';
import { tierIdFor, TIER_BY_ID } from '../core/tiers.js';
import { createNoteListener } from '../tools/notelistener.js';

const KEY = 'fretworkCoach.noteFinder';
const STRING_NAMES = { 1: 'high E', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const ALL12 = Array.from({ length: 12 }, (_, i) => i);
/** The four levels, as settings. */
export const NF_TIERS = {
  foundations: { strings: [6, 5], notes: NATURALS, frets: 12, order: 'random', round: 10, limit: 0, mixNames: false },
  intermediate: { strings: [6, 5, 4, 3, 2, 1], notes: NATURALS, frets: 12, order: 'random', round: 20, limit: 0, mixNames: false },
  advanced: { strings: [6, 5, 4, 3, 2, 1], notes: ALL12, frets: 12, order: 'random', round: 20, limit: 5, mixNames: false },
  mastery: { strings: [6, 5, 4, 3, 2, 1], notes: ALL12, frets: 22, order: 'random', round: 40, limit: 3, mixNames: true }
};
export const NF_DEFAULTS = { mode: 'find', answer: 'tap', tier: null, flats: false, ...NF_TIERS.foundations, strings: [6, 5], notes: NATURALS.slice() };
export function loadNoteFinder() {
  try { return Object.assign({}, NF_DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return { ...NF_DEFAULTS }; }
}
const saveSettings = S => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } };
const midiAt = (s, f) => STD_LOW[6 - s] + f;
/** Every fret (0..maxFret) on a string where a pitch class sits. */
export const fretsFor = (s, pc, maxFret) => { const out = []; for (let f = 0; f <= maxFret; f++) if (mod12(midiAt(s, f)) === pc) out.push(f); return out; };
/** Apply a level's settings (keeps the mode and how you answer). */
export const withTier = (S, tid) => ({ ...S, ...NF_TIERS[tid], strings: NF_TIERS[tid].strings.slice(), notes: NF_TIERS[tid].notes.slice(), tier: tid });

/**
 * The next prompt. In order: strings low to high, notes in order. At random: weighted toward the
 * spots missed most this session, never the same spot twice in a row.
 */
export function nextPrompt(S, state) {
  const strings = S.strings.slice().sort((a, b) => b - a), notes = S.notes.slice().sort((a, b) => a - b);
  if (!strings.length || !notes.length) return null;
  const flat = S.mixNames ? Math.random() < 0.5 : !!S.flats;
  if (S.order === 'order') {
    const i = state.seq++ % (strings.length * notes.length);
    const s = strings[Math.floor(i / notes.length)], pc = notes[i % notes.length];
    return { s, pc, f: fretsFor(s, pc, S.frets)[0], flat };
  }
  const pool = [];
  for (const s of strings) for (const pc of notes) {
    const frets = fretsFor(s, pc, S.frets); if (!frets.length) continue;
    const miss = (state.misses[`${s}:${pc}`] || 0), w = 1 + miss * 2;
    for (let k = 0; k < w; k++) pool.push({ s, pc, frets });
  }
  if (!pool.length) return null;
  // Never the same prompt twice in a row (unless it is the only one).
  const fresh = state.last ? pool.filter(x => !(x.s === state.last.s && x.pc === state.last.pc)) : pool;
  const from = fresh.length ? fresh : pool;
  const pick = from[Math.floor(Math.random() * from.length)];
  return { s: pick.s, pc: pick.pc, f: pick.frets[Math.floor(Math.random() * pick.frets.length)], flat };
}

/**
 * Judge a note played into the microphone for "find pc on string s": 'ok' when it is that note at a
 * fret of that string (0..maxFret), 'octave' when the note is right but not playable there, else 'wrong'.
 */
export function judgePlayed(midi, s, pc, maxFret) {
  if (fretsFor(s, pc, maxFret).some(f => midiAt(s, f) === midi)) return 'ok';
  return mod12(midi) === pc ? 'octave' : 'wrong';
}

export function mountNoteFinder(el) {
  const p = Store.profile;
  let S = loadNoteFinder();
  const recTier = p && !isGuest(p) && p.domains && p.domains.fretboard ? tierIdFor(p.domains.fretboard.level) : null;
  if (!S.tier && recTier && !localStorage.getItem(KEY)) S = withTier(S, recTier);
  const st = { playing: false, seq: 0, n: 0, ok: 0, times: [], misses: {}, roundMiss: {}, last: null, prompt: null, t0: 0, feedback: null, wrong: null, heard: null, hint: '' };
  let timer = null, clock = null, gone = false;
  const name = (pc, flat = S.flats) => pcName(pc, flat);
  const a4 = () => (p && p.settings && p.settings.referenceA4) || 440;
  const listener = createNoteListener({ a4, onNote: midi => heard(midi), onLevel: lv => { const m = el.querySelector('[data-r="meter"] i'); if (m) m.style.width = `${Math.min(100, Math.round(lv * 900))}%`; } });
  const mic = () => S.mode === 'find' && S.answer === 'mic';

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
  const chips = (list, cur, attr) => `<div class="chips">${list.map(([k, l]) => `<button class="chip ${cur === k ? 'on' : ''}" data-${attr}="${k}">${l}</button>`).join('')}</div>`;
  function drawPlay() {
    const host = el.querySelector('[data-r="play"]'); if (!host) return;
    const acc = st.n ? Math.round(st.ok / st.n * 100) : 0, avg = st.times.length ? (st.times.reduce((a, b) => a + b, 0) / st.times.length / 1000).toFixed(1) : '–';
    const stats = `<div class="nf-stats"><span><b>${st.n}</b>${S.round ? ` / ${S.round}` : ''} asked</span><span><b>${acc}%</b> right</span><span><b>${avg}s</b> average</span></div>`;
    if (!st.playing) {
      const done = st.n > 0;
      const weak = Object.entries(st.roundMiss).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => { const [s, pc] = k.split(':').map(Number); return `${name(pc)} on the ${STRING_NAMES[s]} string`; });
      host.innerHTML = `<div class="label">Note finder</div>
        <h3>${done ? `Round done: ${acc}% right, ${avg}s per note` : 'Learn every note on the neck'}</h3>
        ${done ? `${stats}${weak.length ? `<p class="small">Missed most: ${weak.map(esc).join(', ')}. The next round asks these more often.</p>` : '<p class="small ok">No misses. Try the next level up.</p>'}` : ''}
        ${tierPickerHTML({ current: S.tier, recommended: recTier, attr: 'data-nftier', compact: true })}
        <div class="nf-modes">${chips([['find', 'Find it'], ['name', 'Name it']], S.mode, 'mode')}
          ${S.mode === 'find' ? chips([['tap', '👆 Tap the neck'], ['mic', '🎸 Play it on your guitar']], S.answer, 'answer') : ''}</div>
        <p class="small muted">${S.mode === 'find' ? (S.answer === 'mic' ? 'The app names a note and a string; play it on your guitar. The microphone listens, and the note has to be at a fret of that string.' : 'The app names a note and a string; tap the fret where it is.') : 'The app marks a spot on the neck; pick the note’s name.'} ${describe(S)}</p>
        <button class="btn primary block" data-nf="start" ${S.strings.length && S.notes.length ? '' : 'disabled'}>${done ? '▶ Another round' : '▶ Start'}</button>`;
      return;
    }
    const pr = st.prompt; if (!pr) return;
    const fb = st.feedback;
    const timeBar = S.limit && !fb ? `<div class="nf-time"><i data-r="tbar" style="animation-duration:${S.limit}s"></i></div>` : '';
    if (S.mode === 'find') {
      const marks = [];
      if (fb) {
        fretsFor(pr.s, pr.pc, S.frets).forEach(f => marks.push({ s: pr.s, f, label: name(pr.pc, pr.flat), family: 'root', cls: 'target' }));
        if (st.wrong) marks.push({ s: st.wrong.s, f: st.wrong.f, label: name(mod12(midiAt(st.wrong.s, st.wrong.f)), pr.flat), cls: 'wrong' });
      }
      const where = fretsFor(pr.s, pr.pc, S.frets).join(' and ');
      host.innerHTML = `<div class="nf-q"><span class="nf-note">${esc(name(pr.pc, pr.flat))}</span><span class="nf-on">on the <b>${STRING_NAMES[pr.s]}</b> string</span></div>
        ${stats}${timeBar}${neck(marks, !fb && !mic())}
        ${mic() && !fb ? `<div class="nf-listen"><span class="nf-mic">🎤 Listening…</span><span class="nf-meter" data-r="meter"><i></i></span></div>` : ''}
        <p class="small nf-fb ${fb === 'ok' ? 'ok' : fb === 'bad' ? 'bad' : 'muted'}">${fb === 'ok' ? 'Right.' : fb === 'bad' ? `${st.heard ? `You played ${esc(st.heard)}. ` : st.timeout ? 'Time’s up. ' : 'Not quite: '}${esc(name(pr.pc, pr.flat))} is at fret ${where}.` : st.hint ? esc(st.hint) : mic() ? 'Play it on your guitar.' : `Tap the fret${S.frets > 12 ? ' (frets 0–' + S.frets + ')' : ''}.`}</p>
        <div class="row"><button class="btn" data-nf="stop">Stop</button>${fb === 'bad' ? '<button class="btn primary" data-nf="next">Next ›</button>' : ''}</div>`;
    } else {
      const marks = [{ s: pr.s, f: pr.f, label: fb ? name(pr.pc, pr.flat) : '?', family: 'root', cls: 'target' }];
      const choices = S.notes.length >= 4 ? S.notes : ALL12;
      host.innerHTML = `<div class="nf-q"><span class="nf-on">Which note is this? <span class="muted">(${STRING_NAMES[pr.s]} string, fret ${pr.f})</span></span></div>
        ${stats}${timeBar}${neck(marks, false)}
        <div class="nf-choices">${choices.slice().sort((a, b) => a - b).map(pc => `<button class="chip ${fb && pc === pr.pc ? 'on' : ''} ${fb === 'bad' && st.wrongPc === pc ? 'bad' : ''}" data-pc="${pc}" ${fb ? 'disabled' : ''}>${esc(name(pc, pr.flat))}</button>`).join('')}</div>
        <p class="small nf-fb ${fb === 'ok' ? 'ok' : fb === 'bad' ? 'bad' : 'muted'}">${fb === 'ok' ? 'Right.' : fb === 'bad' ? `${st.timeout ? 'Time’s up. ' : ''}It’s ${esc(name(pr.pc, pr.flat))}.` : ' '}</p>
        <div class="row"><button class="btn" data-nf="stop">Stop</button>${fb === 'bad' ? '<button class="btn primary" data-nf="next">Next ›</button>' : ''}</div>`;
    }
  }
  function describe(x) {
    const strs = x.strings.length === 6 ? 'all strings' : x.strings.slice().sort((a, b) => b - a).map(s => STRING_NAMES[s]).join(' and ') + (x.strings.length === 1 ? ' string' : ' strings');
    const nts = x.notes.length === 12 ? 'all 12 notes' : x.notes.length === 7 && NATURALS.every(n => x.notes.includes(n)) ? 'the natural notes' : `${x.notes.length} notes`;
    return `${strs[0].toUpperCase() + strs.slice(1)}, ${nts}, frets 0–${x.frets}${x.limit ? `, ${x.limit} seconds a note` : ''}.`;
  }
  function drawSettings() {
    const host = el.querySelector('[data-r="set"]'); if (!host) return;
    const dis = st.playing ? 'disabled' : '';
    host.innerHTML = `<details class="nf-custom" ${S.tier ? '' : 'open'}><summary><h3>Customize</h3><span class="small muted">${S.tier ? `Using the ${TIER_BY_ID[S.tier].name} settings` : 'Your own mix'}</span></summary>
      <div class="field"><label>Strings</label><div class="chips">${[6, 5, 4, 3, 2, 1].map(s => `<button class="chip ${S.strings.includes(s) ? 'on' : ''}" data-str="${s}" ${dis}>${STRING_NAMES[s]}</button>`).join('')}<button class="chip ghost" data-str="all" ${dis}>All</button></div></div>
      <div class="field"><label>Notes</label><div class="chips">${ALL12.map(pc => `<button class="chip ${S.notes.includes(pc) ? 'on' : ''}" data-note="${pc}" ${dis}>${esc(name(pc))}</button>`).join('')}</div>
        <div class="chips" style="margin-top:6px"><button class="chip ghost" data-notes="nat" ${dis}>Naturals</button><button class="chip ghost" data-notes="acc" ${dis}>Sharps / flats</button><button class="chip ghost" data-notes="all" ${dis}>All 12</button><button class="chip ghost" data-notes="rand" ${dis}>Random 4</button></div></div>
      <div class="field"><label>Frets</label><div class="chips">${[5, 7, 12, 15, 22].map(f => `<button class="chip ${S.frets === f ? 'on' : ''}" data-frets="${f}" ${dis}>0–${f}</button>`).join('')}</div></div>
      <div class="field"><label>Time a note</label><div class="chips">${[[0, 'No limit'], [8, '8 s'], [5, '5 s'], [3, '3 s']].map(([k, l]) => `<button class="chip ${S.limit === k ? 'on' : ''}" data-limit="${k}" ${dis}>${l}</button>`).join('')}</div></div>
      <div class="field"><label>Order</label><div class="chips">${[['random', 'Random'], ['order', 'In order']].map(([k, l]) => `<button class="chip ${S.order === k ? 'on' : ''}" data-order="${k}" ${dis}>${l}</button>`).join('')}</div></div>
      <div class="field"><label>Round</label><div class="chips">${[[10, '10'], [20, '20'], [40, '40'], [0, 'Endless']].map(([k, l]) => `<button class="chip ${S.round === k ? 'on' : ''}" data-round="${k}" ${dis}>${l}</button>`).join('')}<button class="chip ${S.flats ? 'on' : ''}" data-flats="1" ${dis}>Show flats (♭)</button></div></div>
      <button class="btn ghost sm" data-nf="randomize" ${dis}>🎲 Randomize the settings</button></details>`;
  }

  function ask() {
    clearTimeout(clock);
    st.prompt = nextPrompt(S, st); st.feedback = null; st.wrong = null; st.wrongPc = null; st.heard = null; st.hint = ''; st.timeout = false; st.t0 = performance.now();
    if (!st.prompt) { stop(); toast('Pick at least one string and one note.'); return; }
    if (S.limit) clock = setTimeout(() => { if (st.playing && !st.feedback) { st.timeout = true; answer(false, st.prompt.s, fretsFor(st.prompt.s, st.prompt.pc, S.frets)[0]); } }, S.limit * 1000);
    drawPlay();
  }
  async function start() {
    if (mic()) {
      const r = await listener.start();
      if (gone) return;
      if (r !== true) {
        toast(r && r.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser’s site settings, or answer by tapping the neck.' : `Couldn’t open the microphone${r && r.message ? ` (${r.message})` : ''}. Answer by tapping the neck instead.`, 5000);
        S.answer = 'tap'; saveSettings(S);
      }
    }
    Object.assign(st, { playing: true, seq: 0, n: 0, ok: 0, times: [], last: null, roundMiss: {} });
    drawSettings(); ask();
  }
  function stop() {
    st.playing = false; clearTimeout(timer); clearTimeout(clock); listener.stop();
    if (st.n) {
      const rec = p && (p.trainerStats || (p.trainerStats = {}));
      if (rec) { const list = rec.noteFinder || (rec.noteFinder = []); list.push({ date: new Date().toISOString().slice(0, 10), n: st.n, ok: st.ok, avgMs: st.times.length ? Math.round(st.times.reduce((a, b) => a + b, 0) / st.times.length) : null, mode: S.mode, answer: S.mode === 'find' ? S.answer : 'pick', tier: S.tier || 'custom', strings: S.strings.slice(), notes: S.notes.length }); if (list.length > 60) list.splice(0, list.length - 60); Store.save(); }
    }
    drawPlay(); drawSettings();
  }
  function answer(correct, playS, playF) {
    const pr = st.prompt; clearTimeout(clock);
    st.n++; st.times.push(performance.now() - st.t0); st.last = pr;
    const k = `${pr.s}:${pr.pc}`;
    if (correct) { st.ok++; st.misses[k] = Math.max(0, (st.misses[k] || 0) - 1); st.feedback = 'ok'; }
    else { st.misses[k] = (st.misses[k] || 0) + 1; st.roundMiss[k] = (st.roundMiss[k] || 0) + 1; st.feedback = 'bad'; }
    // play the answer; on the microphone, played-by-you notes are already heard, so only a wrong one plays the right note
    if (!(mic() && correct)) { listener.ignore(1200); try { Audio.guitar(midiAt(playS, playF), null, { dur: 0.9, gain: 0.55 }); } catch { /* no audio */ } }
    drawPlay();
    const finished = S.round && st.n >= S.round;
    if (correct) timer = setTimeout(() => (finished ? stop() : ask()), 650);
    else if (finished) timer = setTimeout(stop, 1800);
  }
  /** A note heard on the microphone (find mode). */
  function heard(midi) {
    if (!st.playing || !mic() || st.feedback || !st.prompt) return;
    const pr = st.prompt, v = judgePlayed(midi, pr.s, pr.pc, S.frets);
    if (v === 'ok') return answer(true, pr.s, midi - STD_LOW[6 - pr.s]);
    if (v === 'octave') { st.hint = `That’s ${name(pr.pc, pr.flat)}, but not on the ${STRING_NAMES[pr.s]} string${S.frets < 22 ? ` (frets 0–${S.frets})` : ''}. Find it there.`; return drawPlay(); }
    st.heard = name(mod12(midi), pr.flat);
    answer(false, pr.s, fretsFor(pr.s, pr.pc, S.frets)[0]);
  }

  el.addEventListener('click', async e => {
    const hit = e.target.closest('.fb-hit');
    if (hit && st.playing && S.mode === 'find' && !mic() && !st.feedback) {
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
    if (st.playing) return;
    let changed = true, custom = true;
    if (b.dataset.nftier) { S = withTier(S, b.dataset.nftier); custom = false; }
    else if (b.dataset.mode) { S.mode = b.dataset.mode; custom = false; }
    else if (b.dataset.answer) { S.answer = b.dataset.answer; custom = false; }
    else if (b.dataset.str) { if (b.dataset.str === 'all') S.strings = [6, 5, 4, 3, 2, 1]; else { const s = +b.dataset.str; S.strings = S.strings.includes(s) ? S.strings.filter(x => x !== s) : [...S.strings, s]; } }
    else if (b.dataset.note != null) { const pc = +b.dataset.note; S.notes = S.notes.includes(pc) ? S.notes.filter(x => x !== pc) : [...S.notes, pc]; }
    else if (b.dataset.notes) S.notes = b.dataset.notes === 'nat' ? NATURALS.slice() : b.dataset.notes === 'acc' ? [1, 3, 6, 8, 10] : b.dataset.notes === 'all' ? ALL12.slice() : shuffle(ALL12).slice(0, 4);
    else if (b.dataset.frets) S.frets = +b.dataset.frets;
    else if (b.dataset.limit != null) S.limit = +b.dataset.limit;
    else if (b.dataset.order) S.order = b.dataset.order;
    else if (b.dataset.round != null) S.round = +b.dataset.round;
    else if (b.dataset.flats) { S.flats = !S.flats; S.mixNames = false; }
    else if (b.dataset.nf === 'randomize') {
      const strs = shuffle([6, 5, 4, 3, 2, 1]).slice(0, 1 + Math.floor(Math.random() * 3));
      S = { ...S, strings: strs, notes: shuffle(ALL12).slice(0, 3 + Math.floor(Math.random() * 6)), frets: [7, 12, 12, 15][Math.floor(Math.random() * 4)], order: 'random', mode: Math.random() < 0.5 ? 'find' : 'name' };
      toast('New mix: ' + describe(S));
    } else changed = false;
    if (changed) { if (custom) S.tier = null; saveSettings(S); drawSettings(); drawPlay(); }
  });
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  render();
  return () => { gone = true; clearTimeout(timer); clearTimeout(clock); listener.stop(); };
}
