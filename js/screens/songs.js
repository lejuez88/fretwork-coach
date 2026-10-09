// Songs: the song list with recommendations, and the song page with a
// one-day lesson builder, tab import, bar selection, looping a section,
// "help me with this part", and checking a section with the evaluator.
import { esc, toast, fmtMinutes, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { GENRES, GENRE_BY_ID } from '../data/catalog.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import {
  STATUSES, findSong, addSong, removeSong, setStatus, enrichSong, recommendSongs, localRecommendations, songTempo, songLevelFor, fitLabel,
  tabParsed, importTab, removeTab, sectionExercise, sectionState, recordSongResult, buildSongLesson, sectionHelp, tabSearchLinks, sectionKey, songImageTitles
} from '../core/songs.js';
import { saveCustom, addToRoutines } from '../core/custom.js';
import { makeAdhocRoutine, BLOCKS } from '../core/routine.js';
import { tempoLadder } from '../core/progression.js';
import { addEvidence, recomputeLevels, describeChanges } from '../core/skills.js';
import { toPlayerExercise } from '../core/coursegen.js';
import { tuningName } from '../core/tabparse.js';
import { mountTabPlayer } from '../tools/tabplayer.js';
import { tempoShort } from '../ui/temporow.js';
import { openEvalSheet } from '../eval/ui.js';
import { exerciseCardHTML } from '../ui/ask.js';
import { timeInputHTML, wireTimeInput, readTime, startRoutine, hasActiveRoutine } from './routine.js';
import { Shell } from '../ui/shell.js';
import { searchSongsterr, findSong as findOnSongsterr, linkInfo, partsSummary, songUrl, trackUrl, bestMatchUrl, siteSearchUrl, searchBlocked } from '../core/songsterr.js';

const STATUS_LABEL = Object.fromEntries(STATUSES);
const statusIcon = { want: '☆', learning: '◐', solid: '●', mastered: '★' };
const diffBadge = d => (d ? `<span class="badge diff d${d <= 3 ? 1 : d <= 6 ? 2 : 3}">Level ${d}</span>` : '<span class="badge">Level ?</span>');

/** Link a song to its Songsterr tab (keeps the part list; fills in the tuning if the song has none). */
function linkSongsterr(song, item) {
  song.songsterr = linkInfo(item);
  const g = song.songsterr.tracks.find(t => t.kind === 'guitar' && t.tuningName);
  song.info = song.info || {};
  if (g && !song.info.tuning && !song.tab) song.info.tuning = g.tuningName;
}
const DIFF_WORD = ['', 'very easy', 'easy', 'below intermediate', 'intermediate', 'upper intermediate', 'advanced', 'very advanced'];

/* ================================ Hub ================================== */
export function mountSongsHub(root, { navigate }) {
  const p = Store.profile;
  let filter = 'all', recGenre = null, recBusy = false, recError = null, alive = true;
  const recKey = () => recGenre || 'all';
  const fresh = r => r && r.key === recKey() && r.date && (Date.parse(today()) - Date.parse(r.date)) / 86400000 < 7;

  function render() {
    const songs = p.songs, counts = Object.fromEntries(STATUSES.map(([k]) => [k, songs.filter(s => s.status === k).length]));
    const shown = songs.filter(s => filter === 'all' || s.status === filter).sort((a, b) => STATUSES.findIndex(x => x[0] === a.status) - STATUSES.findIndex(x => x[0] === b.status) || String(b.lastPracticed || b.addedAt).localeCompare(String(a.lastPracticed || a.addedAt)));
    const myGenres = p.questionnaire.genres.filter(g => GENRE_BY_ID[g]);
    const recs = p.songRecs && p.songRecs.key === recKey() ? p.songRecs : null;
    root.innerHTML = `
      <h1>Songs</h1>
      <section class="card"><div class="label">Add a song</div>
        <div class="addsong"><input type="text" data-r="title" placeholder="Song title" maxlength="120"><input type="text" data-r="artist" placeholder="Artist (optional)" maxlength="80"></div>
        <div class="sst" data-r="sst" aria-live="polite"></div>
        <button class="btn primary block" data-s="add">+ Add song</button>
        <p class="small muted">${Claude.hasKey() ? 'Claude looks up the key, tuning, tempo and what the song asks of your hands.' : 'Songs from the built-in list get their techniques filled in. Add your Claude key to look up any song.'}</p>
      </section>
      <section class="card"><div class="label">My songs · repertoire level ${p.domains.repertoire ? p.domains.repertoire.level : 1}/10</div>
        ${songs.length ? `<div class="chips small">${[['all', 'All', songs.length], ...STATUSES.map(([k, l]) => [k, l, counts[k]])].filter(([k, , n]) => k === 'all' || n).map(([k, l, n]) => `<button class="chip sm ${filter === k ? 'on' : ''}" data-filter="${k}">${l} · ${n}</button>`).join('')}</div>` : ''}
        ${shown.length ? `<div class="songlist">${shown.map(songRow).join('')}</div>` : `<p class="muted small">${songs.length ? 'No songs with this status.' : 'No songs yet. Add one above or pick from the recommendations below.'}</p>`}
      </section>
      <section class="card"><div class="sec-head"><div class="label">Recommended for you</div>${Claude.hasKey() ? `<button class="btn sm ghost" data-s="refresh" ${recBusy ? 'disabled' : ''}>${recBusy ? '<span class="spinner sm"></span>Picking…' : '↻ New picks'}</button>` : ''}</div>
        <div class="chips small">${[[null, 'For you'], ...myGenres.map(g => [g, GENRE_BY_ID[g].name])].map(([g, l]) => `<button class="chip sm ${recGenre === g ? 'on' : ''}" data-rgenre="${g || ''}">${esc(l)}</button>`).join('')}
          <select data-r="moregenre" class="chipselect"><option value="">More genres…</option>${GENRES.filter(g => !myGenres.includes(g.id)).map(g => `<option value="${g.id}" ${recGenre === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></div>
        <p class="small muted">Matched to your song level (${songLevelFor(p)}/10): one comfortable pick, mostly stretch songs, one reach.${recs && recs.source === 'claude' ? ' Picked by Claude.' : ''}</p>
        ${recError ? `<p class="small muted">Claude couldn’t pick songs (${esc(recError)}); showing the built-in list.</p>` : ''}
        <div class="reclist">${(recs ? recs.items : []).map(recCard).join('') || (recBusy ? '' : '<p class="muted small">No more songs in the built-in list for this genre.</p>')}</div>
      </section>`;
    hydrateImages(root);
  }
  function songRow(s) {
    const parsed = s.tab ? `${s.tab.bars} bars of tab` : 'no tab yet';
    const secs = Object.values((s.state && s.state.sections) || {}), done = secs.filter(x => x.mastered).length;
    return `<a class="songrow" href="#/song/${s.id}">${wikiTile(songImageTitles(s), s.title, 'thumb')}
      <div class="sr-main"><b>${esc(s.title)}</b><span class="muted small">${esc(s.artist || '')}</span>
        <span class="small">${statusIcon[s.status]} ${STATUS_LABEL[s.status]} · ${s.difficulty ? 'level ' + s.difficulty : 'level ?'}${s.difficulty ? ' · ' + fitLabel(p, s.difficulty).toLowerCase() : ''} · ${parsed}${secs.length ? ` · ${done}/${secs.length} parts mastered` : ''}</span></div><span class="chev">›</span></a>`;
  }
  function recCard(r, i) {
    const added = p.songs.some(s => s.title.toLowerCase() === r.title.toLowerCase());
    return `<div class="reccard">${wikiTile([r.wikiTitle, `${r.title} (${r.artist} song)`, `${r.title} (song)`, r.artist].filter(Boolean), r.title, 'thumb')}
      <div class="rc-main"><b>${esc(r.title)}</b> <span class="muted small">${esc(r.artist)}</span>
        <div class="small">${diffBadge(r.difficulty)} ${r.fit ? `<span class="badge fit">${esc(r.fit)}</span>` : ''} <span class="muted">${esc(GENRE_BY_ID[r.genre] ? GENRE_BY_ID[r.genre].name : '')}</span></div>
        <p class="small">${esc(r.why)}</p>
        ${r.techniques && r.techniques.length ? `<div class="techs">${r.techniques.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>
      <button class="btn sm ${added ? '' : 'primary'}" data-rec="${i}" ${added ? 'disabled' : ''}>${added ? '✓ Added' : '+ Add'}</button></div>`;
  }

  async function loadRecs(force = false) {
    if (!force && fresh(p.songRecs)) return;
    // Local picks show immediately; Claude's replace them when ready
    if (!p.songRecs || p.songRecs.key !== recKey() || force) { p.songRecs = { key: recKey(), date: today(), items: localRecommendations(p, { genre: recGenre }), source: 'local' }; render(); }
    if (!Claude.hasKey()) { Store.save(); return; }
    recBusy = true; recError = null; render();
    const key = recKey(), r = await recommendSongs(p, { genre: recGenre });
    recBusy = false;
    if (!alive || key !== recKey()) return;
    recError = r.error || null;
    p.songRecs = { key, date: today(), items: r.items, source: r.source };
    Store.save(); render();
  }

  function add(info, sst = null) {
    const s = addSong(p, info);
    if (!s) return toast('Type a song title.');
    if (sst) linkSongsterr(s, sst);
    Store.save(); navigate('#/song/' + s.id);
  }
  // Songsterr matches while you type a title (debounced and cached)
  let sstTimer = null, sstItems = [], sstSeq = 0;
  function drawSst(state) {
    const box = root.querySelector('[data-r="sst"]'); if (!box) return;
    if (state === 'busy') { box.innerHTML = '<p class="small muted"><span class="spinner sm"></span>Looking on Songsterr…</p>'; return; }
    if (state && state.blocked) { const q = `${root.querySelector('[data-r="title"]').value} ${root.querySelector('[data-r="artist"]').value}`.trim(); box.innerHTML = q ? `<p class="small muted">Songsterr’s search isn’t available from this browser. <a class="link small" href="${siteSearchUrl(q)}" target="_blank" rel="noopener">Search on Songsterr ↗</a></p>` : ''; return; }
    box.innerHTML = sstItems.length ? `<div class="label sst-h">On Songsterr</div>${sstItems.slice(0, 5).map((it, i) => `<button class="sst-row" data-sst="${i}">
        <span class="sst-main"><b>${esc(it.title)}</b><span class="small muted">${esc(it.artist)}${partsSummary(it) ? ' · ' + esc(partsSummary(it)) : ''}${it.hasChords ? ' · chords' : ''}</span></span><span class="small sst-add">+ Add</span></button>`).join('')}` : '';
  }
  function queueSst() {
    clearTimeout(sstTimer);
    const t = root.querySelector('[data-r="title"]').value.trim(), a = root.querySelector('[data-r="artist"]').value.trim();
    if (t.length < 3) { sstItems = []; drawSst(); return; }
    sstTimer = setTimeout(async () => {
      const seq = ++sstSeq; drawSst('busy');
      const r = await searchSongsterr(`${a} ${t}`.trim(), { size: 8 });
      if (!alive || seq !== sstSeq) return;
      sstItems = r.items; drawSst(r);
    }, 450);
  }
  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.s === 'add') return add({ title: root.querySelector('[data-r="title"]').value, artist: root.querySelector('[data-r="artist"]').value });
    if (b.dataset.sst != null) { const it = sstItems[+b.dataset.sst]; if (it) add({ title: it.title, artist: it.artist, source: 'songsterr' }, it); return; }
    if (b.dataset.filter) { filter = b.dataset.filter; return render(); }
    if (b.dataset.rgenre != null) { recGenre = b.dataset.rgenre || null; recError = null; render(); return loadRecs(); }
    if (b.dataset.s === 'refresh') return loadRecs(true);
    if (b.dataset.rec != null) { const r = p.songRecs.items[+b.dataset.rec]; if (r) add({ ...r, source: 'recommendation', why: r.why }); }
  };
  const onChange = e => { if (e.target.dataset.r === 'moregenre' && e.target.value) { recGenre = e.target.value; recError = null; render(); loadRecs(); } };
  const onKey = e => { if (e.key === 'Enter' && (e.target.dataset.r === 'title' || e.target.dataset.r === 'artist')) root.querySelector('[data-s="add"]').click(); };
  const onInput = e => { if (e.target.dataset.r === 'title' || e.target.dataset.r === 'artist') queueSst(); };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('keydown', onKey); root.addEventListener('input', onInput);
  render(); loadRecs();
  return () => { alive = false; clearTimeout(sstTimer); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('keydown', onKey); root.removeEventListener('input', onInput); };
}

/* ============================== Song page =============================== */
export function mountSongDetail(root, { id, navigate }) {
  const p = Store.profile;
  const song = findSong(p, id);
  if (!song) { root.innerHTML = '<section class="card"><p>Song not found.</p><a class="btn block" href="#/songs">Back to songs</a></section>'; return () => {}; }
  let enriching = false, lesson = null, lessonBusy = false, timeSel = null, sel = null, player = null, playerKey = null, importOpen = !song.tab, alive = true;

  async function enrich() {
    if (enriching || !Claude.hasKey()) return;
    enriching = true; song.enrichTried = true; render();
    try { await enrichSong(p, song); Store.save(); }
    catch (e) { toast('Claude couldn’t look up the song: ' + e.message, 4000); }
    enriching = false; if (alive) render();
  }

  function stopPlayer() { if (player) { player(); player = null; } playerKey = null; }

  function render() {
    stopPlayer();
    const I = song.info || {}, parsed = tabParsed(song);
    root.innerHTML = `
      <a class="link" href="#/songs">← Songs</a>
      <section class="card songhead">
        <div class="songtop">${wikiTile(songImageTitles(song), song.title, 'cover')}
          <div><h1>${esc(song.title)}</h1><div class="muted">${esc(song.artist || 'Unknown artist')}${I.year ? ' · ' + I.year : ''}</div>
            <div class="songfacts">${diffBadge(song.difficulty)}${song.difficulty ? `<span class="badge fit">${fitLabel(p, song.difficulty)}</span>` : ''}
              ${I.key ? `<span class="badge">${esc(I.key)}</span>` : ''}${I.tuning || song.tab ? `<span class="badge">${esc(song.tab ? song.tab.tuningName || tuningName(song.tab.tuning) : I.tuning)} tuning</span>` : ''}
              ${I.capo ? `<span class="badge">Capo ${I.capo}</span>` : ''}<span class="badge">${songTempo(song)} BPM${song.tempo || I.tempo ? '' : '?'}</span>${I.timeSig && I.timeSig !== '4/4' ? `<span class="badge">${esc(I.timeSig)}</span>` : ''}</div></div></div>
        <div class="segtabs four status">${STATUSES.map(([k, l]) => `<a href="javascript:void 0" data-status="${k}" class="${song.status === k ? 'on' : ''}">${statusIcon[k]} ${l}</a>`).join('')}</div>
        ${enriching ? '<p class="small muted"><span class="spinner sm"></span>Claude is looking up this song…</p>' : ''}
        ${I.summary ? `<p>${esc(I.summary)}</p>` : ''}${I.why ? `<p class="coach small">🎯 ${esc(I.why)}</p>` : ''}
        ${I.techniques && I.techniques.length ? `<div class="techs">${I.techniques.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        ${I.prerequisites && I.prerequisites.length ? `<p class="small muted">Have these first: ${I.prerequisites.map(esc).join(' · ')}</p>` : ''}
        ${I.enrichedBy === 'claude-unsure' ? '<p class="small muted">Claude wasn’t sure about this song; details are estimates.</p>' : ''}
        ${!enriching && Claude.hasKey() && (!I.enrichedBy || I.enrichedBy === 'catalog') ? '<button class="btn sm" data-x="enrich">🔎 Look up key, tempo and sections</button>' : ''}
        <div class="field tempofield"><label>Song tempo (your goal)</label><div class="stepper"><button data-tempo="-5">−5</button><button data-tempo="-1">−1</button><input type="number" inputmode="numeric" data-r="tempo" value="${songTempo(song)}"><button data-tempo="1">+1</button><button data-tempo="5">+5</button></div><div class="unit">BPM${I.tempo && song.tempo && song.tempo !== I.tempo ? ` · recording ≈ ${I.tempo}` : I.tempo ? ' · from the recording' : ' · set this to the recording’s tempo'}</div></div>
      </section>

      <section class="card"><div class="label">Today’s lesson</div>
        <p class="small muted">A one-day plan for this song: a warm-up for the technique it needs, the next part of the song at a tempo you can play cleanly with a tempo ladder, theory in context and linking the parts.${song.tab ? '' : ' Import a tab below to practice the actual notes.'}</p>
        <div data-r="time">${timeInputHTML('duration', p.questionnaire.practice[[0, 6].includes(new Date().getDay()) ? 'weekend' : 'weekday'] || 30)}</div>
        <button class="btn primary block" data-x="lesson" ${lessonBusy ? 'disabled' : ''}>${lessonBusy ? '<span class="spinner sm"></span>' + (Claude.hasKey() ? 'Claude is planning your lesson…' : 'Building…') : lesson ? 'Rebuild lesson' : 'Build today’s lesson'}</button>
        <div data-r="lesson">${lesson ? lessonHTML() : ''}</div>
        ${song.lessons && song.lessons.length ? `<p class="small muted">${song.lessons.length} lesson${song.lessons.length > 1 ? 's' : ''} so far · last ${esc(song.lessons[song.lessons.length - 1].date)}</p>` : ''}
      </section>

      <section class="card"><div class="sec-head"><div class="label">Tab</div>${song.tab ? `<button class="btn sm ghost" data-x="toggleImport">${importOpen ? 'Close' : 'Replace tab'}</button>` : ''}</div>
        ${song.tab && parsed ? tabHTML(parsed) : ''}
        ${importOpen ? importHTML() : ''}
      </section>

      <section class="card sstcard" data-r="sstcard">${sstHTML()}</section>

      ${I.sections && I.sections.length ? `<section class="card"><div class="label">How the song is built</div>${I.sections.map(s => `<div class="secrow"><b>${esc(s.name)}</b><span class="small muted">${esc(s.desc)}</span></div>`).join('')}</section>` : ''}
      <button class="btn ghost danger block" data-x="remove">Remove song</button>`;
    hydrateImages(root);
    wireTimeInput(root.querySelector('[data-r="time"]'));
    Shell.actions(lesson && !lessonBusy ? `<button class="btn primary" data-x="start">▶ Start lesson</button>` : '');
  }

  /* ---- Songsterr: the interactive tab for this song ---- */
  let sst = { busy: false, items: [], best: null, blocked: false, error: null, tried: false, choosing: false };
  function sstHTML() {
    const L = song.songsterr;
    const head = '<div class="sec-head"><div class="label">Interactive tab · Songsterr</div>' + (L && !sst.choosing ? '<button class="btn sm ghost" data-x="sstchange">Change</button>' : '') + '</div>';
    if (L && !sst.choosing) {
      const parts = (L.tracks || []).filter(t => t.kind !== 'vocals');
      const main = parts.find(t => t.kind === 'guitar') || parts[0];
      return `${head}<p class="small"><b>${esc(L.title)}</b> <span class="muted">${esc(L.artist)}</span>${L.hasChords ? ' · <span class="muted">chords too</span>' : ''}</p>
        <a class="btn primary block" href="${main ? trackUrl(L, main.index) : songUrl(L)}" target="_blank" rel="noopener"><span>▶ Play the tab on Songsterr ↗</span>${main && main.name ? `<span class="small">${esc(main.name)} part</span>` : ''}</a>
        ${parts.length ? `<div class="sst-parts">${parts.map(t => `<a class="sst-part" href="${trackUrl(L, t.index)}" target="_blank" rel="noopener"><span class="sst-kind k-${t.kind}">${{ guitar: '🎸', bass: '🎸', drums: '🥁' }[t.kind] || '🎵'}</span>
          <span class="sst-main"><b>${esc(t.name || t.instrument || 'Part ' + (t.index + 1))}</b><span class="small muted">${[t.instrument && t.instrument !== t.name ? t.instrument : '', t.tuningName ? t.tuningName + ' tuning' : '', t.difficulty ? DIFF_WORD[t.difficulty] || '' : ''].filter(Boolean).map(esc).join(' · ')}</span></span><span class="small">↗</span></a>`).join('')}</div>` : ''}
        <p class="small muted">Songsterr plays the tab with the real rhythm, a speed control and looping. Practice the hard parts here: paste a section above, or use “Help me with this part”.</p>`;
    }
    if (sst.busy) return `${head}<p class="small muted"><span class="spinner sm"></span>Looking for “${esc(song.title)}” on Songsterr…</p>`;
    const fallback = `<a class="btn block" href="${bestMatchUrl(song.title, song.artist)}" target="_blank" rel="noopener">Find it on Songsterr ↗</a>`;
    if (sst.blocked || (!sst.tried && searchBlocked())) return `${head}<p class="small muted">Songsterr’s search isn’t available from this browser, so the app can’t list the parts. The link opens Songsterr’s best match for this song.</p>${fallback}`;
    if (!sst.tried) return `${head}<p class="small muted">See this song’s tab in Songsterr’s interactive player.</p><button class="btn block" data-x="sstfind">🔎 Find it on Songsterr</button>`;
    if (!sst.items.length) return `${head}<p class="small muted">${sst.error ? `Songsterr couldn’t search (${esc(sst.error)}).` : 'No match on Songsterr.'}</p>${fallback}`;
    const list = sst.best && !sst.choosing ? [sst.best] : sst.items.slice(0, 6);
    return `${head}<p class="small muted">${sst.best && !sst.choosing ? 'Best match:' : 'Pick the right one:'}</p>
      <div class="sst-list">${list.map(it => `<div class="sst-row static"><span class="sst-main"><b>${esc(it.title)}</b><span class="small muted">${esc(it.artist)}${partsSummary(it) ? ' · ' + esc(partsSummary(it)) : ''}</span></span>
        <button class="btn sm primary" data-sstuse="${esc(String(it.songId))}">Use this</button></div>`).join('')}</div>
      ${sst.best && !sst.choosing && sst.items.length > 1 ? '<button class="btn sm ghost" data-x="sstmore">Not it? See other matches</button>' : ''}
      ${sst.choosing && song.songsterr ? '<button class="btn sm ghost" data-x="sstcancel">Keep the current one</button>' : ''}`;
  }
  function drawSst() { const c = root.querySelector('[data-r="sstcard"]'); if (c) c.innerHTML = sstHTML(); }
  async function sstFind() {
    sst = { ...sst, busy: true, tried: true }; drawSst();
    const r = await findOnSongsterr(song.title, song.artist || '');
    if (!alive) return;
    sst = { ...sst, busy: false, items: r.items, best: r.best, blocked: !!r.blocked, error: r.error || null };
    drawSst();
  }
  function importHTML() {
    const links = tabSearchLinks(song);
    return `<div class="tabimport">
      <p class="small">Paste a text tab (the six string lines, e|---…) to get a scrolling tab, loop any bars, ask for help on a part and check your playing.</p>
      <div class="row findtabs"><span class="small muted">Find a tab:</span>${links.map(l => `<a class="btn sm" href="${l.url}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>
      <textarea data-r="tabtext" rows="8" spellcheck="false" placeholder="e|-----0-----|&#10;B|---1---1---|&#10;G|-0-------0-|&#10;D|-----------|&#10;A|-----------|&#10;E|-----------|"></textarea>
      <div class="tabopts"><label class="mini">Beats per bar<select data-r="bpb">${[3, 4, 6].map(v => `<option value="${v}" ${(song.tab && song.tab.beatsPerBar || 4) === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="mini">Rhythm<select data-r="grid">${[['auto', 'Read from spacing'], ['8', '8th notes'], ['16', '16th notes'], ['triplet', 'Triplets']].map(([v, l]) => `<option value="${v}" ${(song.tab && song.tab.grid || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="row"><button class="btn primary" data-x="import">Import tab</button><label class="btn filebtn">Open .txt file<input type="file" accept=".txt,text/plain" data-r="tabfile"></label></div>
      <p class="small muted">ASCII tab doesn’t write rhythm, so it’s read from the spacing; pick the rhythm if it sounds off. The tab stays in this browser.</p>
    </div>`;
  }

  function tabHTML(parsed) {
    const st = (song.state && song.state.sections) || {};
    const barClass = k => {
      const covering = Object.entries(st).filter(([key]) => /^\d+-\d+$/.test(key)).map(([key, v]) => { const [a, b] = key.split('-').map(Number); return { a, b, v }; }).filter(x => k >= x.a && k <= x.b);
      if (covering.some(x => x.v.mastered)) return 'mastered';
      if (covering.some(x => x.v.history.length)) return 'practiced';
      return '';
    };
    const sk = sel ? sectionKey(sel.from, sel.to) : null, ses = sk && st[sk];
    return `<p class="small">${parsed.bars.length} bars · ${parsed.notes.length} notes · ${esc(song.tab.tuningName || tuningName(parsed.tuning))} tuning${parsed.warnings.length ? ` · <span class="muted">${esc(parsed.warnings.join(' '))}</span>` : ''}</p>
      <p class="small muted">${sel ? `Selected bar${sel.from === sel.to ? ` ${sel.from}` : `s ${sel.from}–${sel.to}`}. Tap another bar to change the range.` : 'Tap a bar, then another, to select a part.'}</p>
      <div class="bargrid">${parsed.bars.map(b => `<button class="bar ${barClass(b.index)} ${sel && b.index >= sel.from && b.index <= sel.to ? 'sel' : ''}" data-bar="${b.index}">${b.index}</button>`).join('')}</div>
      ${sel ? `<div class="selbar"><div><b>Bars ${sel.from}${sel.to > sel.from ? '–' + sel.to : ''}</b>${ses ? `<span class="small muted"> · target ${ses.target} · best ${ses.best || '—'} · goal ${songTempo(song)} BPM${ses.mastered ? ' · ★ mastered' : ''}</span>` : ''}</div>
        <div class="row"><button class="btn sm primary" data-x="loop">▶ Loop these bars</button><button class="btn sm" data-x="help">🆘 Help me with this part</button><button class="btn sm" data-x="check">🎤 Check my playing</button><button class="btn sm ghost" data-x="savesec">Save as a part</button></div></div>` : ''}
      <div data-r="player"></div>
      ${song.sections.length ? `<div class="label" style="margin-top:14px">Your parts</div>${song.sections.map((s, i) => { const v = st[sectionKey(s.from, s.to)]; return `<div class="secrow"><button class="linkbtn" data-secpick="${i}"><b>${esc(s.name)}</b> <span class="small muted">bars ${s.from}–${s.to}</span></button><span class="small">${v ? `${v.mastered ? '★ ' : ''}${v.best || v.target}/${songTempo(song)} BPM` : 'not started'}</span><button class="btn sm ghost" data-secdel="${i}" aria-label="Delete part">✕</button></div>`; }).join('')}` : ''}
      <button class="btn ghost sm" data-x="removetab">Remove tab</button>`;
  }

  function lessonHTML() {
    const total = lesson.items.reduce((a, i) => a + i.minutes, 0);
    return `<div class="lessonplan">
      ${lesson.focus ? `<p class="coach">🎯 ${esc(lesson.focus)}</p>` : ''}
      ${lesson.error ? `<p class="small muted">Claude couldn’t plan it (${esc(lesson.error)}), so this is the standard lesson.</p>` : ''}
      ${lesson.items.map(it => `<div class="planrow b-${it.block}"><span class="pblock">${BLOCKS[it.block].label}</span><div class="pname"><b>${esc(it.ex.name)}</b><span class="muted small">${esc(tempoShort(it.ex, it.targetBpm, it.ex.goalBpm))}${it.note ? ' · ' + esc(it.note) : ''}</span></div><span class="pmin">${it.minutes}m</span></div>`).join('')}
      <p class="small muted">${fmtMinutes(total)} · ${lesson.source === 'claude' ? 'planned by Claude' : 'standard song lesson'}</p></div>`;
  }

  async function buildLesson() {
    const t = readTime(root.querySelector('[data-r="time"]')); if (t.error) return toast(t.error);
    timeSel = t; lessonBusy = true; render();
    try { lesson = await buildSongLesson(p, song, t.minutes); }
    catch (e) { toast(e.message); }
    lessonBusy = false; Store.save(); if (!alive) return; render();
    const el = root.querySelector('[data-r="lesson"]'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function sstClick(b) {
    const x = b.dataset.x;
    if (x === 'sstfind') { sstFind(); return true; }
    if (x === 'sstchange') { sst.choosing = true; if (!sst.tried) sstFind(); else drawSst(); return true; }
    if (x === 'sstmore') { sst.choosing = true; drawSst(); return true; }
    if (x === 'sstcancel') { sst.choosing = false; drawSst(); return true; }
    if (b.dataset.sstuse != null) {
      const it = sst.items.find(i => String(i.songId) === b.dataset.sstuse); if (!it) return true;
      linkSongsterr(song, it); sst.choosing = false; Store.save(); toast(`Linked to “${it.title}” on Songsterr.`); drawSst(); return true;
    }
    return false;
  }
  function startLesson() {
    if (!lesson) return;
    if (hasActiveRoutine()) return navigate('#/practice/run');
    const fresh = readTime(root.querySelector('[data-r="time"]'));
    const t = fresh.error ? timeSel : fresh;
    const plan = makeAdhocRoutine({ title: song.title, focus: lesson.focus || `Learning ${song.title}`, genre: song.genre, items: lesson.items, budget: t.minutes, kind: 'song', songId: song.id });
    if (song.status === 'want') setStatus(p, song, 'learning');
    startRoutine(plan, t, navigate);
  }

  function doImport(text) {
    const bpb = +(root.querySelector('[data-r="bpb"]') || {}).value || 4, grid = (root.querySelector('[data-r="grid"]') || {}).value || 'auto';
    const r = importTab(song, text, { beatsPerBar: bpb, grid });
    if (!r.ok) return toast(r.warnings[0] || 'No tab found in that text.', 4500);
    sel = null; importOpen = false; Store.save();
    toast(`Imported ${r.parsed.bars.length} bars${r.warnings.length ? '. ' + r.warnings[0] : '.'}`, 3500);
    render();
  }

  function currentSection() {
    if (!sel) return null;
    const named = song.sections.find(s => s.from === sel.from && s.to === sel.to);
    return sectionExercise(p, song, sel.from, sel.to, { name: named ? named.name : null });
  }

  function loop() {
    const ex = currentSection(); if (!ex) return;
    const es = sectionState(p, song, ex); Store.save();
    const slot = root.querySelector('[data-r="player"]');
    stopPlayer(); playerKey = ex.sectionKey;
    const lad = tempoLadder(es.target, Math.max(ex.goalBpm, es.target));
    player = mountTabPlayer(slot, toPlayerExercise(ex, es.target), {
      settings: p.settings, onSettings: patch => { Object.assign(p.settings, patch); Store.save(); }, startBpm: es.target, compact: false, beatsPerBar: tabParsed(song).beatsPerBar || 4,
      ramp: { enabled: true, step: lad.step, everyLoops: 2, max: lad.max },
      onLog: ({ tempo }) => logResult(ex, tempo), dock: true
    });
    if (slot.scrollIntoView) slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function record(ex, tempo, clean, source = 'song') {
    const res = { tempo, clean, date: today() };
    const d = recordSongResult(p, song.id, ex, res);
    addEvidence(p, { key: `song:${song.id}:${ex.sectionKey}`, domain: ex.domain, label: ex.name, level: ex.level, tempo, goal: ex.goalBpm, clean, source });
    p.exerciseLog.push({ date: today(), at: Date.now(), exerciseId: ex.id, name: ex.name, songId: song.id, tempo, goalBpm: ex.goalBpm, clean, mastered: d && d.decision === 'mastered', source });
    const ch = recomputeLevels(p);
    Store.save();
    toast((d ? d.message : `Logged ${tempo} BPM.`) + (ch.length ? ` Levels: ${describeChanges(ch)}.` : ''), 4500);
  }

  function logResult(ex, tempo) {
    const sheet = Shell.sheet(`<h2>Log ${tempo} BPM</h2><p class="muted small">${esc(ex.name)}. Clean means 4 loops in a row with no flubbed notes at that tempo.</p>
      <div class="rubric"><button data-clean="1"><span class="n">✓</span><span>Clean at this tempo</span></button><button data-clean="0"><span class="n">~</span><span>Not clean yet</span></button></div>`);
    sheet.el.addEventListener('click', e => {
      const b = e.target.closest('[data-clean]'); if (!b) return;
      sheet.close(); record(ex, tempo, b.dataset.clean === '1'); render();
    });
  }

  function check() {
    const ex = currentSection(); if (!ex) return;
    const es = sectionState(p, song, ex);
    stopPlayer();
    openEvalSheet({
      profile: p, exercise: ex, bpm: es.target, context: { level: ex.level, source: 'song', songId: song.id },
      onUse: r => { record(ex, r.tempo, r.clean, 'evaluation'); render(); },
      onClose: () => {}
    });
  }

  function help() {
    if (!sel) return;
    const from = sel.from, to = sel.to;
    const sheet = Shell.sheet(`<h2>Help with bars ${from}${to > from ? '–' + to : ''}</h2>
      <p class="small muted">${Claude.hasKey() ? 'Claude reads these bars of your tab and explains what makes them hard, how to finger and pick them, and writes drills for the hard moves.' : 'The app finds the hardest spot and builds drills from it. Add your Claude key for a teacher’s explanation.'}</p>
      ${Claude.hasKey() ? '<textarea data-r="q" rows="2" placeholder="Optional: what’s going wrong? e.g. “I can’t get the shift in bar 3 clean”"></textarea>' : ''}
      <button class="btn primary block" data-h="go">Help me</button><div data-r="hout"></div>`);
    let res = null;
    const out = sheet.el.querySelector('[data-r="hout"]');
    const show = () => {
      out.innerHTML = `
        <p>${esc(res.summary)}</p>${res.answer ? `<p class="coach">${esc(res.answer)}</p>` : ''}
        ${res.error ? `<p class="small muted">Claude couldn’t answer (${esc(res.error)}); this is the app’s own analysis.</p>` : ''}
        ${res.hardParts.length ? `<div class="fbblock"><div class="label">What makes it hard</div>${res.hardParts.map(h => `<div class="issue medium"><b>${esc(h.where)}</b><div class="small">${esc(h.what)}</div>${h.fix ? `<div class="small fix">→ ${esc(h.fix)}</div>` : ''}</div>`).join('')}</div>` : ''}
        ${res.fingering ? `<div class="fbblock"><div class="label">Fretting hand</div><p class="small">${esc(res.fingering)}</p></div>` : ''}
        ${res.picking ? `<div class="fbblock"><div class="label">Picking hand</div><p class="small">${esc(res.picking)}</p></div>` : ''}
        ${res.tips && res.tips.length ? `<div class="fbblock"><div class="label">Tips</div>${res.tips.map(t => `<div class="fbrow">• ${esc(t)}</div>`).join('')}</div>` : ''}
        ${res.drills.length ? `<div class="fbblock"><div class="label">Drills for this part</div>${res.drills.map((d, i) => exerciseCardHTML(d, { i, target: d.songId ? sectionState(p, song, d).target : null, actions: ['add', 'save'] })).join('')}
          <button class="btn primary block" data-h="practice">▶ Practice these now</button></div>` : ''}`;
    };
    sheet.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-h],[data-ask]'); if (!b) return;
      if (b.dataset.h === 'go') {
        b.disabled = true; b.innerHTML = '<span class="spinner sm"></span>Looking at your tab…';
        const q = (sheet.el.querySelector('[data-r="q"]') || {}).value || '';
        try { res = await sectionHelp(p, song, from, to, q); } catch (err) { toast(err.message); }
        b.disabled = false; b.textContent = 'Ask again';
        if (res) show();
        return;
      }
      if (!res) return;
      if (b.dataset.h === 'practice') {
        const items = res.drills.map(d => {
          if (d.songId) return { block: 'stretch', ex: d, targetBpm: sectionState(p, song, d).target, minutes: d.minutes || 5 };
          const c = saveCustom(p, d, `Help with ${song.title}, bars ${from}–${to}`);
          return { block: 'warmup', ex: c.ex, targetBpm: c.state.target, minutes: c.ex.minutes || 4, extra: { customId: c.id } };
        });
        const sec = sectionExercise(p, song, from, to);
        if (sec && !items.some(i => i.ex.id === sec.id)) items.push({ block: 'music', ex: sec, targetBpm: sectionState(p, song, sec).target, minutes: 5, ramp: false, note: 'Back in context: the whole part.' });
        Store.save(); sheet.close();
        if (hasActiveRoutine()) return navigate('#/practice/run');
        startRoutine(makeAdhocRoutine({ title: `${song.title}: bars ${from}–${to}`, focus: `Fix bars ${from}–${to} of ${song.title}`, genre: song.genre, items, budget: null, kind: 'song', songId: song.id }), undefined, navigate);
        return;
      }
      const i = +b.dataset.i, d = res.drills[i]; if (!d) return;
      if (b.dataset.ask === 'save') { saveCustom(p, d, `Help with ${song.title}, bars ${from}–${to}`); Store.save(); b.disabled = true; b.textContent = '★ Saved'; toast('Saved to Your exercises (Practice tab).'); }
      if (b.dataset.ask === 'add') {
        const rx = addToRoutines(p, d, `Help with ${song.title}, bars ${from}–${to}`); Store.save();
        b.disabled = true; b.textContent = '✓ In your routines'; toast(rx ? 'Added to your routines.' : 'Already in your routines.');
      }
    });
  }

  function saveSection() {
    if (!sel) return;
    const sheet = Shell.sheet(`<h2>Name this part</h2><p class="small muted">Bars ${sel.from}–${sel.to}. Named parts are what song lessons work through, in order.</p>
      <div class="chips">${['Intro', 'Main riff', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Outro'].map(n => `<button class="chip sm" data-nm="${n}">${n}</button>`).join('')}</div>
      <input type="text" data-r="nm" maxlength="40" placeholder="Name" style="margin-top:10px"><button class="btn primary block" data-r="ok">Save part</button>`);
    sheet.el.addEventListener('click', e => {
      const c = e.target.closest('[data-nm]'); if (c) { sheet.el.querySelector('[data-r="nm"]').value = c.dataset.nm; return; }
      if (!e.target.closest('[data-r="ok"]')) return;
      const name = sheet.el.querySelector('[data-r="nm"]').value.trim() || `Bars ${sel.from}–${sel.to}`;
      song.sections = song.sections.filter(s => !(s.from === sel.from && s.to === sel.to));
      song.sections.push({ id: Math.random().toString(36).slice(2, 8), name, from: sel.from, to: sel.to });
      song.sections.sort((a, b) => a.from - b.from);
      Store.save(); sheet.close(); render();
    });
  }

  const onClick = e => {
    const st = e.target.closest('[data-status]');
    if (st) { const ch = setStatus(p, song, st.dataset.status); Store.save(); if (ch) toast(`Repertoire level ${ch.from} → ${ch.to}`); return render(); }
    const b = e.target.closest('button'); if (!b) return;
    const x = b.dataset.x;
    if (sstClick(b)) return;
    if (b.dataset.tempo) { const inp = root.querySelector('[data-r="tempo"]'); song.tempo = Math.max(30, Math.min(260, (+inp.value || songTempo(song)) + Number(b.dataset.tempo))); inp.value = song.tempo; Store.save(); return; }
    if (b.dataset.bar) {
      const k = +b.dataset.bar;
      if (!sel) sel = { from: k, to: k };
      else if (sel.from === sel.to && k !== sel.from) sel = { from: Math.min(k, sel.from), to: Math.max(k, sel.from) };
      else if (sel.from === sel.to && k === sel.from) sel = null;
      else sel = { from: k, to: k };
      return render();
    }
    if (b.dataset.secpick != null) { const s = song.sections[+b.dataset.secpick]; sel = { from: s.from, to: s.to }; render(); return loop(); }
    if (b.dataset.secdel != null) { song.sections.splice(+b.dataset.secdel, 1); Store.save(); return render(); }
    if (x === 'enrich') return enrich();
    if (x === 'lesson') return buildLesson();
    if (x === 'toggleImport') { importOpen = !importOpen; return render(); }
    if (x === 'import') { const t = root.querySelector('[data-r="tabtext"]').value; if (!t.trim()) return toast('Paste the tab first.'); return doImport(t); }
    if (x === 'removetab') { if (confirm('Remove the imported tab? Saved parts are removed too; progress stays.')) { removeTab(song); sel = null; importOpen = true; Store.save(); render(); } return; }
    if (x === 'loop') return loop();
    if (x === 'help') return help();
    if (x === 'check') return check();
    if (x === 'savesec') return saveSection();
    if (x === 'remove') { if (confirm(`Remove “${song.title}” and its progress?`)) { removeSong(p, song.id); Store.save(); navigate('#/songs'); } }
  };
  const barClick = e => { if (e.target.closest('[data-x="start"]')) startLesson(); };
  const onChange = e => {
    if (e.target.dataset.r === 'tabfile' && e.target.files[0]) { const f = e.target.files[0]; if (f.size > 500000) return toast('That file is too big for a tab.'); f.text().then(doImport); }
    if (e.target.dataset.r === 'tempo') { song.tempo = Math.max(30, Math.min(260, Math.round(+e.target.value) || songTempo(song))); e.target.value = song.tempo; Store.save(); }
  };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange); Shell.actionBar.addEventListener('click', barClick);
  render();
  if (Claude.hasKey() && !song.enrichTried && (!song.info.enrichedBy || song.info.enrichedBy === 'catalog')) enrich();
  if (!song.songsterr && !searchBlocked()) sstFind(); // one cached search: find this song's tab on Songsterr
  return () => { alive = false; stopPlayer(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); Shell.actionBar.removeEventListener('click', barClick); Shell.actions(''); };
}
