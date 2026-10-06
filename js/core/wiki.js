// Live images from Wikipedia's REST summary API (CORS-enabled, freely licensed
// thumbnails). Results are cached in localStorage; misses fall back to an
// initials / gradient tile so the UI never shows a broken image.
import { $$, hash } from './util.js';

const CACHE_KEY = 'fretworkCoach.wikiCache.v1';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { cache = {}; }
let saveTimer;
const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full */ } }, 400); };

export const Wiki = {
  enabled: true,
  inflight: new Map(),
  queue: [], active: 0, max: 4,

  /** Resolve the first title in `titles` that has a thumbnail. */
  async image(titles) {
    if (!this.enabled) return null;
    for (const t of [].concat(titles).filter(Boolean)) {
      const url = await this.thumb(t);
      if (url) return url;
    }
    return null;
  },
  thumb(title) {
    if (title in cache) return Promise.resolve(cache[title]);
    if (this.inflight.has(title)) return this.inflight.get(title);
    const p = new Promise(resolve => { this.queue.push({ title, resolve }); this.pump(); });
    this.inflight.set(title, p);
    return p;
  },
  pump() {
    while (this.active < this.max && this.queue.length) {
      const { title, resolve } = this.queue.shift();
      this.active++;
      const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'));
      fetch(url, { headers: { accept: 'application/json' } })
        .then(r => (r.ok ? r.json() : null))
        .then(j => {
          const src = j && j.type !== 'disambiguation' && (j.thumbnail && j.thumbnail.source || j.originalimage && j.originalimage.source) || null;
          cache[title] = src; persist(); resolve(src);
        })
        .catch(() => resolve(null)) // network miss: don't cache, try again next load
        .finally(() => { this.active--; this.inflight.delete(title); this.pump(); });
    }
  }
};

/** Markup for an image tile that hydrates later. */
export function wikiTile(titles, label, cls = '') {
  const hue = hash(label) % 360;
  const init = String(label).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return `<div class="wimg ${cls}" data-wiki="${encodeURIComponent(JSON.stringify([].concat(titles)))}" style="--h:${hue}"><span class="wimg-fallback">${init}</span></div>`;
}

/** Find un-hydrated tiles under root and load their images. */
export function hydrateImages(root = document) {
  for (const el of $$('[data-wiki]:not([data-done])', root)) {
    el.dataset.done = '1';
    let titles = [];
    try { titles = JSON.parse(decodeURIComponent(el.dataset.wiki)); } catch { continue; }
    Wiki.image(titles).then(src => {
      if (!src || !el.isConnected) return;
      const img = new Image();
      img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      img.onload = () => el.classList.add('loaded');
      img.src = src;
      el.appendChild(img);
    });
  }
}
