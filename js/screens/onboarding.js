// New-account onboarding: one question per screen, image pickers for genres and
// guitarists, Claude identification of typed-in players, then the assessment.
import { $, esc, toast, getPath, setPath } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRES, GENRE_BY_ID, PLAYERS, PLAYER_BY_ID, playersFor } from '../data/catalog.js';
import { OPT } from '../assessment/engine.js';
import { Shell } from '../ui/shell.js';

const STEPS = [
  { id: 'name', type: 'text', path: 'name', title: "What's your name?", help: 'Your plans and courses are addressed to you.', placeholder: 'Your name', required: true },
  { id: 'experience', type: 'single', path: 'experience', options: OPT.experience, title: 'How long have you been playing?', required: true },
  { id: 'learning', type: 'single', path: 'learning', options: OPT.learning, title: 'How have you learned so far?' },
  { id: 'genres', type: 'genres', title: 'What do you want to play?', help: 'Pick every genre you’re interested in. Your courses and song picks are built around these.', required: true },
  { id: 'players', type: 'players', title: 'Who do you want to sound like?', help: 'Tap the guitarists you love, or type in any player and Claude will identify their style.' },
  { id: 'chords', type: 'multi', path: 'chords', options: OPT.chords, title: 'Which chords do you know?', help: 'Tap everything you can play cleanly without looking it up.' },
  { id: 'techniques', type: 'multi', path: 'techniques', options: OPT.techniques, title: 'Techniques you’re comfortable with', help: 'Comfortable = you could use it in a song today.' },
  { id: 'theory', type: 'ratings', title: 'Rate your theory knowledge', help: 'Be honest; the assessment checks it anyway.' },
  { id: 'struggles', type: 'multi', path: 'struggles', textPath: 'strugglesOther', options: OPT.struggles, title: 'What do you struggle with?', textLabel: 'Anything else? (optional)' },
  { id: 'goals', type: 'multi', path: 'goals', textPath: 'goalsOther', options: OPT.goals, title: 'What are your goals?', textLabel: 'In your own words (optional)' },
  { id: 'practice', type: 'practice', title: 'Typical practice time per day', help: 'A starting point. Every routine asks how much time you have that day.' },
  { id: 'equipment', type: 'equipment', title: 'Your equipment' }
];

export function mountOnboarding(root, { profile, startStep = 0, onComplete, onExit }) {
  const Q = profile.questionnaire;
  let step = startStep;
  let identifying = false, idResults = [];
  const saveDraft = () => Store.draft.set({ profile, phase: 'onboarding', step });

  function render() {
    const s = STEPS[step], pct = Math.round(step / STEPS.length * 100);
    root.innerHTML = `
      <div class="label">${Object.keys(profile.domains).length ? 'Edit setup' : 'New player'} · ${step + 1} of ${STEPS.length}</div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <section class="card"><h2>${esc(s.title)}</h2>${s.help ? `<p class="muted">${esc(s.help)}</p>` : ''}${body(s)}</section>`;
    Shell.actions(`<button class="btn" data-ob="back">← Back</button><button class="btn primary" data-ob="next">${step === STEPS.length - 1 ? (Object.keys(profile.domains).length ? 'Save changes' : 'Start assessment →') : 'Next →'}</button>`);
    hydrateImages(root);
    const first = root.querySelector('input[type=text]'); if (first && s.type === 'text') first.focus();
  }

  function body(s) {
    if (s.type === 'text') return `<input type="text" data-field="${s.path}" value="${esc(getPath(Q, s.path))}" placeholder="${esc(s.placeholder || '')}" autocomplete="given-name">`;
    if (s.type === 'single') return chips(s.options, [getPath(Q, s.path)], 'single', s.path);
    if (s.type === 'multi') return chips(s.options, getPath(Q, s.path), 'multi', s.path) +
      (s.textPath ? `<div class="field"><label>${s.textLabel}</label><textarea data-field="${s.textPath}" placeholder="Optional">${esc(getPath(Q, s.textPath))}</textarea></div>` : '');
    if (s.type === 'genres') return `<div class="tiles">${GENRES.map(g => `
      <button class="tile ${Q.genres.includes(g.id) ? 'on' : ''}" data-genre="${g.id}" aria-pressed="${Q.genres.includes(g.id)}">
        ${wikiTile(g.wiki, g.name)}<span class="tile-name">${esc(g.name)}</span><span class="tile-sub">${esc(g.blurb)}</span><span class="tick">✓</span>
      </button>`).join('')}</div>`;
    if (s.type === 'players') return playersBody();
    if (s.type === 'ratings') return OPT.theoryTopics.map(([id, name, desc]) => `
      <div class="topic"><div class="t">${name}</div><div class="d">${desc}</div>
      <div class="seg">${OPT.theoryScale.map((lbl, i) => `<button class="${(Q.theory[id] || 0) === i ? 'on' : ''}" data-rate="${id}" data-val="${i}">${lbl}</button>`).join('')}</div></div>`).join('');
    if (s.type === 'practice') return ['weekday', 'weekend'].map(w => `
      <div class="field"><label>${w === 'weekday' ? 'Weekdays' : 'Weekends'} (minutes)</label>
      <div class="stepper"><button data-prac="${w}" data-d="-10">−10</button><button data-prac="${w}" data-d="-5">−5</button>
      <input type="number" inputmode="numeric" data-field="practice.${w}" data-num="1" value="${Q.practice[w]}">
      <button data-prac="${w}" data-d="5">+5</button><button data-prac="${w}" data-d="10">+10</button></div>
      <div class="quick">${[15, 20, 30, 45, 60, 90].map(m => `<button class="chip ${Q.practice[w] === m ? 'on' : ''}" data-pracset="${w}" data-val="${m}">${m}</button>`).join('')}</div></div>`).join('');
    if (s.type === 'equipment') return `
      <div class="field"><label>Guitar</label>${chips(OPT.guitar, [Q.equipment.guitar], 'single', 'equipment.guitar')}</div>
      <div class="field"><label>Amp / interface</label>${chips(OPT.gear, Q.equipment.gear, 'multi', 'equipment.gear')}</div>
      <div class="field"><label>Do you use a metronome?</label>${chips(OPT.metronome, [Q.equipment.metronome], 'single', 'equipment.metronome')}</div>
      <div class="field"><label>Looper pedal or app?</label>${chips(OPT.looper, [Q.equipment.looper], 'single', 'equipment.looper')}</div>
      <div class="field"><label>DAW (optional)</label><input type="text" data-field="equipment.daw" value="${esc(Q.equipment.daw)}" placeholder="e.g. GarageBand, Logic, Reaper"></div>`;
    return '';
  }

  function playersBody() {
    const picked = new Set(Q.players.map(p => p.id));
    const list = playersFor(Q.genres, 18);
    const custom = Q.players.filter(p => p.source !== 'catalog');
    return `
      <div class="label">${Q.genres.length ? 'Popular in your genres' : 'Popular players'}</div>
      <div class="tiles players">${list.map(p => `
        <button class="tile ${picked.has(p.id) ? 'on' : ''}" data-player="${p.id}" aria-pressed="${picked.has(p.id)}">
          ${wikiTile(p.wikiTitle, p.name, 'round')}<span class="tile-name">${esc(p.name)}</span>
          <span class="tile-sub">${esc(p.genres.map(g => GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : g).slice(0, 2).join(' · '))}</span><span class="tick">✓</span>
        </button>`).join('')}</div>
      <div class="field"><label>Add players you like</label>
        <div class="row nowrap"><input type="text" data-r="pname" placeholder="e.g. Yvette Young, Guthrie Govan"><button class="btn primary" data-ob="identify" ${identifying ? 'disabled' : ''}>${identifying ? 'Identifying…' : 'Identify'}</button></div>
        <p class="muted small">${Claude.hasKey() ? 'Separate names with commas. Claude identifies each player, their genres and what defines their playing.' : 'Without an API key only built-in players can be matched. <a class="link" href="#/settings">Add your key</a> and Claude will identify anyone.'}</p>
      </div>
      ${idResults.length ? `<div class="idresults">${idResults.map((r, i) => idCard(r, i)).join('')}</div>` : ''}
      ${custom.length ? `<div class="label" style="margin-top:14px">Your added players</div><div class="pcards">${custom.map(p => playerCard(p)).join('')}</div>` : ''}`;
  }
  function idCard(r, i) {
    if (!r.matched) return `<div class="pcard miss"><div><b>${esc(r.input)}</b><div class="muted small">${esc(r.note || 'Couldn’t identify this guitarist.')}</div></div></div>`;
    const added = Q.players.some(p => p.name.toLowerCase() === r.name.toLowerCase());
    return `<div class="pcard">${wikiTile(r.wikiTitle || r.name, r.name, 'round sm')}
      <div class="pbody"><b>${esc(r.name)}</b><div class="muted small">${esc((r.genres || []).map(g => GENRE_BY_ID[g] ? GENRE_BY_ID[g].name : g).join(' · '))}</div>
      <div class="small">${esc(r.style || '')}</div>
      ${(r.qualities || []).length ? `<div class="tags">${r.qualities.map(q => `<span>${esc(q)}</span>`).join('')}</div>` : ''}</div>
      <button class="btn sm ${added ? '' : 'primary'}" data-addid="${i}" ${added ? 'disabled' : ''}>${added ? 'Added' : '+ Add'}</button></div>`;
  }
  function playerCard(p) {
    return `<div class="pcard">${wikiTile(p.wikiTitle || p.name, p.name, 'round sm')}
      <div class="pbody"><b>${esc(p.name)}</b><div class="small">${esc(p.style || '')}</div>
      ${(p.techniques || []).length ? `<div class="tags">${p.techniques.map(q => `<span>${esc(q)}</span>`).join('')}</div>` : ''}</div>
      <button class="btn sm" data-delplayer="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">✕</button></div>`;
  }
  function chips(options, selected, mode, path) {
    return `<div class="chips">${options.map(([id, l]) => `<button class="chip ${selected.includes(id) ? 'on' : ''}" data-${mode}="${path}" data-val="${id}">${esc(l)}</button>`).join('')}</div>`;
  }

  async function identify() {
    const input = $('[data-r="pname"]', root);
    const names = (input.value || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 8);
    if (!names.length) return toast('Type at least one guitarist.');
    // Local matches first
    const local = [], unknown = [];
    for (const n of names) {
      const hit = PLAYERS.find(p => p.name.toLowerCase() === n.toLowerCase());
      hit ? local.push(hit) : unknown.push(n);
    }
    local.forEach(p => { if (!Q.players.some(x => x.id === p.id)) Q.players.push({ ...p }); });
    if (!unknown.length) { input.value = ''; saveDraft(); return render(); }
    if (!Claude.hasKey()) {
      unknown.forEach(n => Q.players.push({ id: 'u-' + n.toLowerCase().replace(/\W+/g, '-'), name: n, wikiTitle: n, genres: [], style: '', qualities: [], techniques: [], source: 'manual' }));
      input.value = ''; saveDraft(); toast('Added. Add an API key in Settings so Claude can profile these players.'); return render();
    }
    identifying = true; render();
    try {
      const res = await Claude.json({
        system: 'You are an expert guitar teacher and music historian. Identify guitarists so a practice app can build a learning roadmap from their style.',
        content: `Identify each of these guitarists: ${JSON.stringify(unknown)}.
Allowed genre ids: ${JSON.stringify(GENRES.map(g => g.id))}.
Return {"players":[{"input":string,"matched":boolean,"name":string (canonical name),"wikiTitle":string (exact English Wikipedia article title, or "" if unsure),"band":string,"genres":[1-3 allowed genre ids],"style":string (one sentence on what defines their guitar playing),"qualities":[3-5 short phrases describing their playing style],"techniques":[3-5 signature techniques a student should practice],"note":string (only when not matched: why, or who they might mean)}]}.
Only mark matched=true when you are confident this is a real guitarist. If a name is ambiguous, pick the most notable guitarist and say so in style.`,
        maxTokens: 1800
      });
      idResults = (res.players || []).map(p => Object.assign({ matched: false }, p));
    } catch (e) { toast(e.message); }
    identifying = false; input.value = ''; render();
  }

  function next() {
    const s = STEPS[step];
    const v = s.path ? getPath(Q, s.path) : null;
    if (s.required && s.type === 'genres' && !Q.genres.length) return toast('Pick at least one genre.');
    if (s.required && s.path && (!v || (typeof v === 'string' && !v.trim()))) return toast('This one’s needed to calibrate your plan.');
    if (step < STEPS.length - 1) { step++; saveDraft(); render(); window.scrollTo(0, 0); return; }
    onComplete();
  }
  function back() { if (step === 0) return onExit(); step--; saveDraft(); render(); window.scrollTo(0, 0); }

  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.ob === 'next') return next();
    if (d.ob === 'back') return back();
    if (d.ob === 'identify') return identify();
    if (d.single) { setPath(Q, d.single, d.val); }
    else if (d.multi) {
      const arr = getPath(Q, d.multi), i = arr.indexOf(d.val);
      if (i >= 0) arr.splice(i, 1); else {
        arr.push(d.val);
        if (d.multi === 'equipment.gear') { if (d.val === 'none') arr.splice(0, arr.length, 'none'); else { const n = arr.indexOf('none'); if (n >= 0) arr.splice(n, 1); } }
      }
    }
    else if (d.genre) { const i = Q.genres.indexOf(d.genre); i >= 0 ? Q.genres.splice(i, 1) : Q.genres.push(d.genre); }
    else if (d.player) {
      const i = Q.players.findIndex(p => p.id === d.player);
      i >= 0 ? Q.players.splice(i, 1) : Q.players.push({ ...PLAYER_BY_ID[d.player] });
    }
    else if (d.addid != null) {
      const r = idResults[+d.addid];
      Q.players.push({ id: 'c-' + r.name.toLowerCase().replace(/\W+/g, '-'), name: r.name, wikiTitle: r.wikiTitle || r.name, genres: r.genres || [], style: r.style || '', qualities: r.qualities || [], techniques: r.techniques || [], band: r.band || '', source: 'claude' });
      // Suggest their genres too
      (r.genres || []).forEach(g => { if (GENRE_BY_ID[g] && !Q.genres.includes(g)) Q.genres.push(g); });
    }
    else if (d.delplayer) { Q.players = Q.players.filter(p => p.id !== d.delplayer); }
    else if (d.rate) { Q.theory[d.rate] = +d.val; }
    else if (d.prac) { Q.practice[d.prac] = Math.max(0, Math.min(480, (+Q.practice[d.prac] || 0) + Number(d.d))); }
    else if (d.pracset) { Q.practice[d.pracset] = +d.val; }
    else return;
    saveDraft();
    const y = window.scrollY; render(); window.scrollTo(0, y);
  };
  const onInput = e => {
    const el = e.target;
    if (el.dataset.field) { setPath(Q, el.dataset.field, el.dataset.num ? (el.value === '' ? 0 : +el.value) : el.value); saveDraft(); }
  };
  const onKey = e => { if (e.key === 'Enter' && e.target.dataset.r === 'pname') { e.preventDefault(); identify(); } };
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('keydown', onKey);
  const actionClick = e => { const b = e.target.closest('[data-ob]'); if (b) onClick(e); };
  Shell.actionBar.addEventListener('click', actionClick);
  render();
  return () => {
    root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('keydown', onKey);
    Shell.actionBar.removeEventListener('click', actionClick); Shell.actions('');
  };
}
