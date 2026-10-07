// Playing analysis: compare a recorded take with what the tab says should
// happen, at the tempo it was played. Produces measurable metrics a teacher
// would listen for: missed/extra notes, wrong notes, timing (rushing/dragging,
// consistency, drift), dynamics evenness, weak legato, tuning, and the exact
// spots in the pattern where things go wrong.
import { detectOnsets, pitchAt, presenceAt, harmonicCheck, spectralFlux, guidedOnset } from './dsp.js';

const STD = [64, 59, 55, 50, 45, 40];
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const noteName = m => NAMES[((Math.round(m) % 12) + 12) % 12];
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const std = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const clamp01 = v => Math.max(0, Math.min(1, v));

export function swingBeat(t, swing) {
  if (!swing) return t;
  const f = ((t % 1) + 1) % 1;
  return Math.floor(t) + (Math.abs(f - 0.5) < 1e-6 ? 2 / 3 : f);
}
function beatLabel(t, bpb = 4) {
  const bar = Math.floor(t / bpb) + 1, b = t - (bar - 1) * bpb, whole = Math.floor(b) + 1, frac = b - Math.floor(b);
  const sub = frac < 0.01 ? '' : Math.abs(frac - 0.5) < 0.01 ? '&' : Math.abs(frac - 0.25) < 0.01 ? 'e' : Math.abs(frac - 0.75) < 0.01 ? 'a' : Math.abs(frac - 1 / 3) < 0.02 ? 'trip' : Math.abs(frac - 2 / 3) < 0.02 ? 'let' : '+';
  return `bar ${bar}, beat ${whole}${sub}`;
}

/** Scale a take so its loud notes sit around half scale (quiet interface inputs analyze the same). */
export function normalizeTake(take) {
  const x = take.samples; if (!x || !x.length) return take;
  const step = Math.max(1, Math.floor(x.length / 200000)), vals = [];
  for (let i = 0; i < x.length; i += step) vals.push(Math.abs(x[i]));
  vals.sort((a, b) => a - b);
  const ref = vals[Math.floor(vals.length * 0.999)] || 0;
  if (ref < 1e-4 || (ref > 0.3 && ref < 0.8)) return take;
  const g = 0.5 / ref, y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * g;
  return { ...take, samples: y };
}

/** Expected events (chords grouped) between from..to (audio-context seconds). */
export function buildExpected({ notes, swing, totalBeats, bpm, t0, beatsPerBar = 4 }, { from, to }) {
  const groups = new Map();
  notes.forEach(n => { const k = n.t.toFixed(4); if (!groups.has(k)) groups.set(k, { t: n.t, notes: [] }); groups.get(k).notes.push(n); });
  const arr = [...groups.values()].sort((a, b) => a.t - b.t);
  const pattern = arr.map((g, pos) => {
    const prev = arr[(pos - 1 + arr.length) % arr.length];
    const single = g.notes.length === 1 && !g.notes[0].chord ? g.notes[0] : null;
    const prevSingle = prev.notes.length === 1 ? prev.notes[0] : null;
    return {
      pos, t: g.t, isChord: !single,
      midi: single ? STD[single.s - 1] + single.f : null, s: single ? single.s : null, f: single ? single.f : null,
      tech: single ? single.x || null : null,
      label: single ? `${'eBGDAE'[single.s - 1]} string fret ${single.f}` : `chord (${g.notes.length} notes)`,
      where: beatLabel(g.t, beatsPerBar),
      stringChange: !!(single && prevSingle && prevSingle.s !== single.s),
      shift: !!(single && prevSingle && Math.abs(prevSingle.f - single.f) >= 4)
    };
  });
  const spb = 60 / bpm, loopLen = totalBeats * spb, events = [];
  const loops = Math.max(1, Math.ceil((to - t0) / loopLen) + 1);
  for (let loop = 0; loop < loops; loop++) for (const p of pattern) {
    const beat = loop * totalBeats + swingBeat(p.t, swing), time = t0 + beat * spb;
    if (time >= from && time <= to) events.push({ ...p, loop, beat, time });
  }
  return { events, pattern };
}

/**
 * Greedy nearest-onset alignment with a searched global offset.
 * Returns the best alignment plus alternative offsets with a similar match count
 * (in fast passages a one-note shift can match just as many onsets).
 */
export function align(events, onsets, latency = 0, { range = 0.3, pick = null } = {}) {
  let minIOI = 1;
  for (let i = 1; i < events.length; i++) minIOI = Math.min(minIOI, events[i].time - events[i - 1].time || 1);
  const tol = Math.max(0.035, Math.min(0.12, 0.45 * minIOI));
  const run = off => {
    const used = new Uint8Array(onsets.length); let k = 0, n = 0, err = 0;
    const out = events.map(e => {
      const exp = e.time + latency + off;
      while (k < onsets.length && onsets[k].time < exp - tol) k++;
      let best = -1, bd = tol;
      for (let j = k; j < onsets.length && onsets[j].time <= exp + tol; j++) {
        if (used[j]) continue; const d = Math.abs(onsets[j].time - exp); if (d <= bd) { bd = d; best = j; }
      }
      if (best >= 0) { used[best] = 1; n++; err += bd; return { e, j: best }; }
      return { e, j: -1 };
    });
    return { out, n, err, used };
  };
  const runs = [];
  for (let off = -range; off <= range + 1e-9; off += 0.005) runs.push(Object.assign(run(off), { off }));
  const maxN = Math.max(...runs.map(r => r.n));
  // candidate offsets: best run of each cluster with ≥90% of the max matches
  const good = runs.filter(r => r.n >= 0.9 * maxN).sort((a, b) => a.off - b.off);
  const clusters = [];
  for (const r of good) { const c = clusters[clusters.length - 1]; if (c && r.off - c[c.length - 1].off <= 0.0051) c.push(r); else clusters.push([r]); }
  const cands = clusters.map(c => c.reduce((b, r) => (r.n > b.n || (r.n === b.n && r.err < b.err) ? r : b))).sort((a, b) => b.n - a.n || Math.abs(a.off) - Math.abs(b.off));
  const best = pick != null ? cands.reduce((b, r) => (Math.abs(r.off - pick) < Math.abs(b.off - pick) ? r : b)) : cands[0];
  const matches = best.out.map(({ e, j }) => (j >= 0 ? { ...e, onset: onsets[j], dt: onsets[j].time - (e.time + latency) } : { ...e, onset: null, dt: null }));
  const first = events.length ? events[0].time + latency - tol : 0, last = events.length ? events[events.length - 1].time + latency + tol : 0;
  const extras = onsets.filter((o, j) => !best.used[j] && o.time >= first && o.time <= last);
  return { matches, extras, tol, globalOffset: best.off, candidates: cands.slice(0, 4).map(r => r.off) };
}

/**
 * Analyze a take against a tab.
 * take: {samples, sampleRate, startTime}; player: tab-player timing(); opts: {latency (s), calibrated, endTime}
 */
export function analyzeTab(take, player, { latency = 0, calibrated = false, endTime } = {}) {
  take = normalizeTake(take);
  const sr = take.sampleRate, x = take.samples;
  const env = spectralFlux(x, sr);
  const onsets = detectOnsets(x, sr, { env }).map(o => ({ ...o, time: o.time + take.startTime }));
  const end = endTime || take.startTime + x.length / sr;
  const { events, pattern } = buildExpected(player, { from: player.t0 - 0.01, to: end - 0.12 });
  if (!events.length) return { kind: 'tab', error: 'The take was too short to analyze. Play at least one full loop after the count-in.' };
  let { matches, extras, globalOffset, tol, candidates } = align(events, onsets, latency);
  // If several offsets match equally well, pick the one where the notes' pitches agree with the tab
  if (candidates.length > 1 && pattern.some(p => p.midi != null)) {
    const agree = off => {
      const al = align(events, onsets, latency, { pick: off });
      const sample = al.matches.filter(m => m.onset && m.midi != null && !m.tech).slice(0, 16);
      let s = 0;
      for (const m of sample) { const hc = harmonicCheck(x, sr, m.onset.time - take.startTime, m.midi, { maxDur: 0.07 }); if (hc && hc.exp >= 0.6 * hc.best && hc.exp > 0) s++; }
      return { s, al };
    };
    let bestPick = null;
    for (const off of candidates) { const r = agree(off); if (!bestPick || r.s > bestPick.s) bestPick = { ...r, off }; }
    if (bestPick && bestPick.off !== globalOffset) ({ matches, extras, globalOffset, tol } = bestPick.al);
  }
  // Second pass: look for quieter notes exactly where the tab expects them
  {
    const st = matches.filter(m => m.onset).map(m => m.onset.strength).sort((a, b) => a - b);
    const typical = st.length ? st[st.length >> 1] : 0;
    const usedT = new Set(matches.filter(m => m.onset).map(m => m.onset.time));
    if (typical) matches = matches.map(m => {
      if (m.onset) return m;
      const exp = m.time + latency + globalOffset;
      const g = guidedOnset(x, env, exp - take.startTime, Math.min(tol, 0.06), typical);
      if (!g) return m;
      const o = { ...g, time: g.time + take.startTime };
      if ([...usedT].some(u => Math.abs(u - o.time) < 0.03)) return m;
      usedT.add(o.time);
      return { ...m, onset: o, dt: o.time - (m.time + latency) };
    });
  }
  // The player stops a moment before the recording does: drop trailing misses after the last note heard
  let lastHit = -1; matches.forEach((m, i) => { if (m.onset) lastHit = i; });
  if (lastHit >= 0 && lastHit < matches.length - 1) matches = matches.slice(0, lastHit + 1);
  const hit = matches.filter(m => m.onset);
  // Weak sustain bumps aren't extra notes
  const strengths = hit.map(m => m.onset.strength).sort((a, b) => a - b);
  const typical = strengths.length ? strengths[strengths.length >> 1] : 0;
  const lastExp = matches.length ? matches[matches.length - 1].time + latency + globalOffset : 0;
  const hitTimes = hit.map(m => m.onset.time);
  extras = extras.filter(o => o.strength >= 0.5 * typical && o.time <= lastExp - 0.5 * tol && o.time <= end - 0.3
    && !hitTimes.some(h => Math.abs(h - o.time) < 0.06)); // a second peak from the same pluck isn't an extra note
  const dts = hit.map(m => m.dt * 1000);
  const meanOff = mean(dts), sd = std(dts);
  const centered = dts.map(d => d - (calibrated ? 0 : median(dts)));
  const within = centered.filter(d => Math.abs(d) <= 25).length / (centered.length || 1);

  // Pitch on single notes
  let pitched = 0, correct = 0, octave = 0; const cents = [], wrong = [];
  for (const m of hit) {
    if (m.isChord || m.tech === 'b' || m.midi == null) continue;
    const nxt = hit.find(h => h.time > m.time + 1e-4);
    const ioi = nxt ? nxt.onset.time - m.onset.time : 0.2;
    const dur = Math.max(0.035, Math.min(0.12, ioi - 0.03)), tt = m.onset.time - take.startTime;
    const det = pitchAt(x, sr, tt, dur);
    const hc = harmonicCheck(x, sr, tt, m.midi, { maxDur: Math.min(0.09, dur) });
    let diff = det == null ? 99 : det - m.midi;
    if (Math.abs(diff - 12) < Math.abs(diff)) diff -= 12; else if (Math.abs(diff + 12) < Math.abs(diff)) diff += 12;
    m.detMidi = det;
    const yinOk = Math.abs(diff) < 0.5;
    const hcWrong = hc && hc.bestMidi !== m.midi && hc.best > 1.4 * hc.exp && hc.best > 0;
    const hcOk = hc && hc.exp >= 0.6 * hc.best && hc.exp > 0;
    if (yinOk && !hcWrong) { pitched++; correct++; cents.push(diff * 100); m.pitchOk = true; if (det != null && Math.abs(det - m.midi) > 6) octave++; continue; }
    if (hc) {
      if (hcOk) { pitched++; correct++; m.pitchOk = true; continue; }
      if (hcWrong) { pitched++; m.pitchOk = false; wrong.push({ where: m.where, expected: `${noteName(m.midi)} (${m.label})`, played: noteName(hc.bestMidi), pos: m.pos }); continue; }
      continue; // inconclusive
    }
    const pres = presenceAt(x, sr, tt, m.midi, dur);
    if (pres != null && pres < 0.2) { pitched++; correct++; m.pitchOk = true; continue; }
    if (det != null && !yinOk) { pitched++; m.pitchOk = false; wrong.push({ where: m.where, expected: `${noteName(m.midi)} (${m.label})`, played: noteName(det), pos: m.pos }); }
    continue;
  }
  const pitchAcc = pitched ? correct / pitched : null;
  const tuningCents = cents.length >= 4 ? median(cents) : null;

  // Dynamics
  const db = hit.map(m => 20 * Math.log10(Math.max(1e-5, m.onset.peak)));
  const dbStd = std(db);
  const legato = hit.filter(m => m.tech === 'h' || m.tech === 'p'), picked = hit.filter(m => !m.tech && !m.isChord);
  const legatoGap = legato.length >= 3 && picked.length >= 3 ? median(legato.map(m => 20 * Math.log10(m.onset.peak))) - median(picked.map(m => 20 * Math.log10(m.onset.peak))) : null;
  const legatoMiss = (() => { const all = matches.filter(m => m.tech === 'h' || m.tech === 'p'); return all.length ? all.filter(m => !m.onset).length / all.length : null; })();

  // Drift: offset trend over time (ms per 10 s)
  let drift = 0;
  if (hit.length >= 6) {
    const xs = hit.map(m => m.time), ys = dts, mx = mean(xs), my = mean(ys);
    const num = xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0), den = xs.reduce((a, v) => a + (v - mx) ** 2, 0);
    drift = den ? num / den * 10 : 0;
  }

  // Problem spots by pattern position
  const spots = pattern.map(p => {
    const ms = matches.filter(m => m.pos === p.pos); const hs = ms.filter(m => m.onset);
    const miss = ms.length ? 1 - hs.length / ms.length : 0;
    const dev = hs.length ? mean(hs.map(m => Math.abs(m.dt * 1000 - meanOff))) : 0;
    const perr = hs.filter(m => m.pitchOk === false).length / (hs.filter(m => m.pitchOk != null).length || 1);
    return { ...p, n: ms.length, miss, dev, perr, score: miss * 2 + dev / 35 + perr * 1.5 };
  }).filter(s => s.n);
  const problems = [...spots].sort((a, b) => b.score - a.score).filter(s => s.score > 0.6).slice(0, 3)
    .map(s => ({ where: s.where, note: s.label, miss: +s.miss.toFixed(2), timingMs: Math.round(s.dev), wrongPitch: +s.perr.toFixed(2), stringChange: s.stringChange, shift: s.shift, tech: s.tech }));
  const devOf = arr => (arr.length ? mean(arr.map(m => Math.abs(m.dt * 1000 - meanOff))) : null);
  const scDev = devOf(hit.filter(m => m.stringChange)), ssDev = devOf(hit.filter(m => !m.stringChange && !m.isChord));

  const hitRate = hit.length / matches.length, extraRate = extras.length / matches.length;
  const timingScore = clamp01(1 - (sd - 8) / 42), pitchScore = pitchAcc == null ? hitRate : pitchAcc, evenScore = clamp01(1 - (dbStd - 2) / 8);
  const score = Math.round(100 * (0.35 * hitRate * (1 - Math.min(0.5, extraRate)) + 0.3 * timingScore + 0.25 * pitchScore + 0.1 * evenScore));
  const clean = hitRate >= 0.95 && (pitchAcc == null || pitchAcc >= 0.97) && sd <= 25 && extraRate <= 0.08 && (!calibrated || Math.abs(meanOff) <= 35);

  return {
    kind: 'tab', bpm: player.bpm, events: matches.length, notesPlayed: hit.length, loops: Math.max(...matches.map(m => m.loop)) + 1,
    hitRate: +hitRate.toFixed(3), extraRate: +extraRate.toFixed(3), extraNotes: extras.length,
    timing: { meanMs: Math.round(meanOff), sdMs: Math.round(sd), within25: +within.toFixed(2), driftMsPer10s: Math.round(drift), calibrated, globalOffsetMs: Math.round(globalOffset * 1000), stringChangeDevMs: scDev == null ? null : Math.round(scDev), sameStringDevMs: ssDev == null ? null : Math.round(ssDev) },
    pitch: { checked: pitched, accuracy: pitchAcc == null ? null : +pitchAcc.toFixed(3), tuningCents: tuningCents == null ? null : Math.round(tuningCents), octaveSlips: octave, wrong: wrong.slice(0, 6) },
    dynamics: { sdDb: +dbStd.toFixed(1), legatoGapDb: legatoGap == null ? null : +legatoGap.toFixed(1), legatoMissRate: legatoMiss == null ? null : +legatoMiss.toFixed(2) },
    problems, score, clean,
    points: matches.map(m => ({ t: +(m.time - player.t0).toFixed(3), dt: m.dt == null ? null : Math.round(m.dt * 1000), ok: m.pitchOk !== false, miss: !m.onset })),
    extrasAt: extras.map(o => +(o.time - latency - player.t0).toFixed(3))
  };
}

/** Rhythm-only analysis against the metronome grid (chords, strumming, improv). */
export function analyzeGrid(take, { t0, bpm, subdiv = 4, swing = false }, { latency = 0, calibrated = false, endTime } = {}) {
  take = normalizeTake(take);
  const sr = take.sampleRate, x = take.samples, spb = 60 / bpm;
  const end = endTime || take.startTime + x.length / sr;
  let onsets = detectOnsets(x, sr).map(o => ({ ...o, time: o.time + take.startTime })).filter(o => o.time >= t0 - 0.06 && o.time <= end);
  if (onsets.length) { const st = onsets.map(o => o.strength).sort((a, b) => a - b), top = st[Math.floor(st.length * 0.75)]; onsets = onsets.filter(o => o.strength >= 0.3 * top); }
  if (onsets.length < 6) return { kind: 'grid', error: 'Not enough notes were heard. Move closer to the microphone, or play louder.' };
  const pos = onsets.map(o => (o.time - latency - t0) / spb);
  const grid = swing ? [0, 2 / 3] : Array.from({ length: subdiv }, (_, i) => i / subdiv);
  const devs = [], slots = new Array(grid.length).fill(0);
  pos.forEach(b => {
    const base = Math.floor(b); let best = 0, bd = 9;
    [...grid, 1].forEach((g, i) => { const d = b - (base + g); if (Math.abs(d) < Math.abs(bd)) { bd = d; best = i % grid.length; } });
    devs.push(bd * spb * 1000); slots[best]++;
  });
  const m = mean(devs), sd = std(devs);
  const centered = devs.map(d => d - (calibrated ? 0 : median(devs)));
  const within = centered.filter(d => Math.abs(d) <= 25).length / centered.length;
  let drift = 0;
  if (onsets.length >= 6) { const xs = onsets.map(o => o.time), mx = mean(xs), my = mean(devs); const num = xs.reduce((a, v, i) => a + (v - mx) * (devs[i] - my), 0), den = xs.reduce((a, v) => a + (v - mx) ** 2, 0); drift = den ? num / den * 10 : 0; }
  const db = onsets.map(o => 20 * Math.log10(Math.max(1e-5, o.peak))), dbStd = std(db);
  const timingScore = clamp01(1 - (sd - 8) / 42), evenScore = clamp01(1 - (dbStd - 2) / 8);
  const score = Math.round(100 * (0.75 * timingScore + 0.25 * evenScore));
  return {
    kind: 'grid', bpm, notesPlayed: onsets.length,
    timing: { meanMs: Math.round(m), sdMs: Math.round(sd), within25: +within.toFixed(2), driftMsPer10s: Math.round(drift), calibrated },
    dynamics: { sdDb: +dbStd.toFixed(1) },
    subdivisionUse: slots, score, clean: sd <= 28 && Math.abs(drift) < 20,
    points: onsets.map((o, i) => ({ t: +(o.time - t0).toFixed(3), dt: Math.round(devs[i]), ok: true, miss: false }))
  };
}

/** One-line summary for the routine result step. */
export function summarize(r) {
  if (r.error) return r.error;
  const t = r.timing, parts = [];
  if (r.kind === 'tab') parts.push(`${Math.round(r.hitRate * 100)}% of notes`);
  if (r.kind === 'tab' && r.extraRate > 0.08) parts.push(`${r.extraNotes} extra note${r.extraNotes === 1 ? '' : 's'}`);
  if (r.pitch && r.pitch.accuracy != null) parts.push(`${Math.round(r.pitch.accuracy * 100)}% right notes`);
  parts.push(`timing ±${t.sdMs} ms`);
  if (t.calibrated && Math.abs(t.meanMs) >= 12) parts.push(t.meanMs < 0 ? `rushing ${-t.meanMs} ms` : `dragging ${t.meanMs} ms`);
  return `${parts.join(', ')} at ${r.bpm} BPM: ${r.clean ? 'clean' : 'not clean yet'} (score ${r.score})`;
}
