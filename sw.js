// Offline cache for the app shell. Network-first for app files so updates show
// up on the next load; images from Wikipedia are cached as they are viewed.
const CACHE = 'fretwork-v2b-1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.json', 'icon.svg',
  'js/app.js', 'js/core/util.js', 'js/core/store.js', 'js/core/claude.js', 'js/core/wiki.js', 'js/core/audio.js',
  'js/core/courses.js', 'js/core/recommend.js', 'js/data/catalog.js', 'js/assessment/engine.js',
  'js/tools/metronome.js', 'js/tools/pitch.js', 'js/tools/tuner.js', 'js/tools/tabplayer.js', 'js/tools/exercises.js',
  'js/ui/shell.js', 'js/screens/onboarding.js', 'js/screens/assessment.js', 'js/screens/dashboard.js',
  'js/screens/tools.js', 'js/screens/profile.js', 'js/screens/settings.js', 'js/screens/course.js',
  'js/screens/routine.js', 'js/core/routine.js', 'js/core/progression.js', 'js/core/coursegen.js'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname === 'api.anthropic.com') return;
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
  } else if (url.hostname === 'upload.wikimedia.org') {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })));
  }
});
