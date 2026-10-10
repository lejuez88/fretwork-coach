// An artist's most popular YouTube video: YouTube search by views (with a key), the curated video, or a link.
const ok = window.__ok;
(async () => {
  const yt = await import('../js/core/youtube.js');
  ok(yt.fmtViews(1234567890) === '1.2B views' && yt.fmtViews(48200000) === '48.2M views' && yt.fmtViews(731000) === '731K views' && yt.fmtViews(0) === '', 'view counts read naturally');
  ok(/sp=CAM%253D/.test(yt.popularSearchUrl('Paul Gilbert')), 'the fallback link sorts YouTube by views');
  const a = { id: 'paul-gilbert', name: 'Paul Gilbert', bands: ['Mr. Big', 'Racer X'], topVideo: { id: 'AAAAAAAAAAA', title: 'Curated pick' } };
  ok((await yt.artistTopVideo(a)).src === 'curated', 'without a key: the curated video');
  ok(await yt.artistTopVideo({ id: 'x', name: 'X' }) === null, 'without a key or a curated video: nothing (the page shows the link)');
  localStorage.setItem('fretworkCoach.youtubeKey', 'AIza' + 'b'.repeat(35));
  const calls = [];
  window.fetch = async url => {
    calls.push(url);
    const body = /\/search\?/.test(url)
      ? { items: [
          { id: { videoId: 'aaaaaaaaaaa' }, snippet: { title: 'Mr. Big - To Be With You (Official Video)', channelTitle: 'Mr. Big' } },
          { id: { videoId: 'bbbbbbbbbbb' }, snippet: { title: 'Paul Gilbert guitar lesson', channelTitle: 'Some school' } },
          { id: { videoId: 'ccccccccccc' }, snippet: { title: 'Paul Gilbert - Technical Difficulties', channelTitle: 'Paul Gilbert' } },
          { id: { videoId: 'ddddddddddd' }, snippet: { title: 'Unrelated band hit', channelTitle: 'Someone' } }] }
      : { items: [{ id: 'aaaaaaaaaaa', statistics: { viewCount: '412000000' }, snippet: { title: 'Mr. Big - To Be With You (Official Video)', channelTitle: 'Mr. Big' } },
                  { id: 'ccccccccccc', statistics: { viewCount: '3100000' }, snippet: { title: 'Paul Gilbert - Technical Difficulties', channelTitle: 'Paul Gilbert' } }] };
    return { ok: true, status: 200, json: async () => body };
  };
  const v = await yt.artistTopVideo(a, { refresh: true });
  ok(v && v.id === 'aaaaaaaaaaa' && v.views === 412000000 && v.src === 'youtube', 'with a key: the most-viewed video naming the artist or a band: ' + JSON.stringify(v));
  ok(/order=viewCount/.test(calls[0]) && /videoCategoryId=10/.test(calls[0]), 'asks YouTube for music videos by view count');
  ok(!/bbbbbbbbbbb|ddddddddddd/.test(new URL(calls[1]).searchParams.get('id')), 'lessons and unrelated videos are left out: ' + calls[1]);
  const n = calls.length; await yt.artistTopVideo(a);
  ok(calls.length === n, 'the answer is cached');
  window.fetch = async () => { throw new Error('offline'); };
  ok((await yt.artistTopVideo({ ...a, id: 'other' })).src === 'curated', 'network trouble falls back to the curated video');
  window.__finish();
})().catch(e => { console.log('TEST ERROR', e && e.stack || e); window.__finish(); });
