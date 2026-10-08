// Track of the Day card: the day's track in YouTube's standard embed player
// (shown right away, with YouTube's own controls), what to listen for, an ear
// challenge, and quick actions (another track, add to my songs, the tab on
// Songsterr, paste a better video link).
import { esc, toast, today } from '../core/util.js';
import { Store } from '../core/store.js';
import { wikiTile, hydrateImages } from '../core/wiki.js';
import { GENRE_BY_ID } from '../data/catalog.js';
import { chooseTrack, settleTrack, earChallenge, trackImageTitles, linkedSong } from '../core/track.js';
import {
  resolveVideos, mountEmbed, markBad, setVideo, clearVideo, parseVideoId, playerError,
  watchUrl, musicUrl, searchUrl, musicSearchUrl, hasKey
} from '../core/youtube.js';
import { bestMatchUrl } from '../core/songsterr.js';
import { addSong } from '../core/songs.js';

const SRC_LABEL = { wikidata: 'Video found through Wikidata.', youtube: 'Video found with your YouTube key.', you: 'Playing the video you linked.' };

export function mountTrackCard(el) {
  const p = Store.profile;
  if (!p.dashboard.track || p.dashboard.track.date !== today()) { chooseTrack(p); Store.save(); }
  let alive = true, player = null, playing = false, fixOpen = false, embedFor = '';
  let state = { ids: [], src: null, busy: true, error: null, offline: false, note: '' };

  el.innerHTML = '<div class="track-media" data-r="tmedia"></div><div class="track-body" data-r="tbody"></div>';
  const media = el.querySelector('[data-r="tmedia"]'), body = el.querySelector('[data-r="tbody"]');
  const tr = () => p.dashboard.track;

  function drawMedia() {
    const t = tr(), id = state.ids[0];
    if (id) {
      if (player && embedFor === state.ids.join(',')) return; // already showing this track
      stop();
      embedFor = state.ids.join(',');
      player = mountEmbed(media, state.ids.slice(), {
        onBad: vid => markBad(t.key, vid),
        onState: () => { const now = !!(player && player.playing); if (now !== playing) { playing = now; drawBody(); } },
        onFail: async code => {
          stop(); state.note = playerError(code) + ' Looking for another copy…'; state.ids = []; state.busy = true; draw();
          const r = await resolveVideos(t, { refresh: true });
          if (!alive || tr().key !== t.key) return;
          state = { ...state, ids: r.ids, src: r.src, busy: false, error: r.error || null, offline: !!r.offline, note: r.ids.length ? '' : playerError(code) };
          draw();
        }
      });
      return;
    }
    stop();
    media.innerHTML = `<div class="track-poster none">${wikiTile(trackImageTitles(t), t.title, 'poster')}
          <span class="tp-status">${state.busy ? 'Finding the track on YouTube…' : 'No video to play here yet'}</span></div>`;
    hydrateImages(media);
  }

  function statusLine() {
    if (state.busy) return 'Finding the track on YouTube…';
    if (state.note) return esc(state.note);
    if (state.ids.length) return esc(SRC_LABEL[state.src] || '');
    if (state.offline) return 'Couldn’t reach YouTube or Wikidata. Check your connection; the app tries again next time.';
    const err = state.error ? ` (${esc(state.error)})` : '';
    return hasKey()
      ? `No playable video found${err}. Paste a link below, or open it on YouTube.`
      : `No embeddable video is listed for this one${err}. Paste a link below, or add a free YouTube key in <a class="link" href="#/settings">Settings</a> so the app can search YouTube directly.`;
  }

  function drawBody() {
    const t = tr();
    if (state.busy && !t.settled) {
      body.innerHTML = `<div class="label">Track of the day</div><h3 class="skel">Choosing today’s track…</h3><p class="small muted">Picking something that fits what you’re practicing, then finding it on YouTube.</p>`;
      return;
    }
    const id = state.ids[0], song = linkedSong(p, t);
    const genre = t.genres && t.genres[0] && GENRE_BY_ID[t.genres[0]];
    body.innerHTML = `
      <div class="track-top"><div class="label">Track of the day</div>${genre ? `<span class="pill">${esc(genre.name)}</span>` : ''}</div>
      <h3>${esc(t.title)}</h3>
      <div class="muted">${esc(t.artist)}${t.year ? ' · ' + t.year : ''}</div>
      <p class="small listen"><b>Listen for:</b> ${esc(t.listenFor)}</p>
      <p class="small ear"><b>Ear challenge:</b> ${esc(earChallenge(p, t))}</p>
      <p class="small reason">${esc(t.reason || '')}</p>
      <div class="row track-actions">
        ${id ? `<button class="btn sm primary" data-t="play">${playing ? '❚❚ Pause' : '▶ Play'}</button>`
             : `<a class="btn sm primary" href="${searchUrl(t)}" target="_blank" rel="noopener">▶ Find on YouTube ↗</a>`}
        <a class="btn sm" href="${bestMatchUrl(t.title, t.artist)}" target="_blank" rel="noopener" title="The tab in Songsterr’s interactive player">🎸 Tab ↗</a>
        <button class="btn sm" data-t="next" ${state.busy ? 'disabled' : ''}>Another track</button>
        ${song ? `<a class="btn sm" href="#/song/${esc(song.id)}">Open in my songs</a>` : '<button class="btn sm" data-t="add">+ My songs</button>'}
      </div>
      <p class="small muted tstatus" data-r="tstatus">${statusLine()}</p>
      <details class="fixvid" ${fixOpen ? 'open' : ''}>
        <summary>${id ? 'Wrong video?' : 'Found it on YouTube?'} Paste a link</summary>
        <div class="row nowrap"><input type="url" data-r="ytlink" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" spellcheck="false"><button class="btn sm" data-t="uselink">Use</button></div>
        <p class="small muted">The app remembers your link for this track.${state.src === 'you' ? ' <button class="textbtn" data-t="resetlink">Forget my link</button>' : ''}</p>
        <p class="small muted">Open: <a class="link" href="${id ? watchUrl(id) : searchUrl(t)}" target="_blank" rel="noopener">YouTube ↗</a> · <a class="link" href="${id ? musicUrl(id) : musicSearchUrl(t)}" target="_blank" rel="noopener">YouTube Music ↗</a></p>
      </details>`;
  }

  const draw = () => { if (!alive) return; drawMedia(); drawBody(); };

  function stop() {
    if (player) { player.destroy(); player = null; }
    playing = false; embedFor = '';
  }
  /** Play / pause through the embed (YouTube's own controls work too). */
  function togglePlay() {
    if (!player) return;
    if (player.playing) player.pause(); else player.play();
    if (!player.ready) toast('The player is still loading; use its ▶ button.');
  }

  async function settle() {
    state = { ids: [], src: null, busy: true, error: null, offline: false, note: '' };
    draw();
    let r = null;
    try { r = await settleTrack(p); } catch (e) { r = { ids: [], error: e.message }; }
    if (!alive) return;
    Store.save();
    state = { ids: (r && r.ids) || [], src: r && r.src, busy: false, error: (r && r.error) || null, offline: !!(r && r.offline), note: '' };
    draw();
  }

  const onClick = e => {
    const b = e.target.closest('[data-t]'); if (!b || !el.contains(b)) return;
    const t = tr();
    switch (b.dataset.t) {
      case 'play':
        togglePlay();
        break;
      case 'next':
        stop(); fixOpen = false;
        chooseTrack(p, { force: true }); Store.save();
        settle();
        break;
      case 'add': {
        const s = addSong(p, { title: t.title, artist: t.artist, genre: (t.genres || [])[0], source: 'track', status: 'want', wikiTitle: (t.wikiTitles || [])[0] || null, why: t.listenFor });
        if (s) { t.songId = s.id; Store.save(); toast(`Added “${s.title}” to your songs.`); drawBody(); }
        break;
      }
      case 'uselink': {
        const inp = body.querySelector('[data-r="ytlink"]');
        const id = parseVideoId(inp && inp.value);
        if (!id) { toast('That doesn’t look like a YouTube video link.'); break; }
        setVideo(t.key, id); stop(); fixOpen = false;
        state = { ...state, ids: [id], src: 'you', busy: false, error: null, offline: false, note: '' };
        toast('Saved. This track will play your video.'); draw();
        break;
      }
      case 'resetlink':
        clearVideo(t.key); stop();
        state = { ...state, ids: [], busy: true }; draw();
        resolveVideos(t).then(r => { if (!alive) return; state = { ...state, ids: r.ids, src: r.src, busy: false, error: r.error || null, offline: !!r.offline, note: '' }; draw(); });
        break;
    }
  };
  const onToggle = e => { if (e.target.classList && e.target.classList.contains('fixvid')) fixOpen = e.target.open; };
  el.addEventListener('click', onClick);
  el.addEventListener('toggle', onToggle, true);
  settle();
  return () => { alive = false; stop(); el.removeEventListener('click', onClick); el.removeEventListener('toggle', onToggle, true); };
}
