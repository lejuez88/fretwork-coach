import { spreadVoicing, pentBox } from '../js/data/lib.js';
import { ejRolling5s } from '../js/data/kb/rolling5s.js';
import { ejSixes } from '../js/data/kb/speedPent.js';
import { ejSpreadProgression } from '../js/data/kb/spreadTriads.js';
import { evhTapTriplets } from '../js/data/kb/tapping.js';
import { pgSixNote } from '../js/data/kb/pgSix.js';
import { pgSkipArps } from '../js/data/kb/skipArps.js';
import { hxSharp9 } from '../js/data/kb/sharp9.js';
import { ARTIST_INDEX as ARTISTS, KB_INDEX, matchTechniques, matchArtist, loadEntry } from '../js/data/kb.js';
import { stageLessonList, pathRaw } from '../js/core/master.js';
import { knowledgeGap, addRequest, myRequests, requestsFile } from '../js/core/kbrequests.js';
import { emptyProfile, normalize } from '../js/core/store.js';
import { createMasterClass, buildMasterTree, generateMasterLocal, matchTopic, requestPhrases } from '../js/core/master.js';
import { Claude } from '../js/core/claude.js';
import { normalizeExercise } from '../js/core/coursegen.js';
import { requestWords, getMaster } from '../js/core/lessoncache.js';
import { STD_LOW, mod12 } from '../js/core/theory.js';
const ok = window.__ok;
const pitch = n => STD_LOW[6 - n.s] + n.f;
(async () => {
  // --- generators: musical correctness
  const v = spreadVoicing(9, 'maj', 5, 5); // A on string 5: root, 5th, 10th
  ok(v && pitch({ s: 4, f: v.tones[1][1] }) - pitch({ s: 5, f: v.tones[0][1] }) === 7 && pitch({ s: 2, f: v.tones[2][1] }) - pitch({ s: 5, f: v.tones[0][1] }) === 16, 'spread A on set 5 = R 5 10');
  for (const set of [6, 5, 4]) for (const type of ['maj', 'min']) {
    const x = spreadVoicing(4, type, set, 7); const [r, f5, t10] = x.tones.map(([s, f]) => pitch({ s, f }));
    ok(f5 - r === 7 && t10 - r === (type === 'maj' ? 16 : 15), `spread ${type} set ${set}`);
  }
  const box = pentBox(9, 1); ok(box && box.length === 12 && box.every(n => [0, 3, 5, 7, 10].includes(mod12(pitch(n) - 9))), 'A minor pentatonic box 1');
  for (let b = 1; b <= 5; b++) { const bx = pentBox(4, b); ok(bx && bx.every(n => n.f >= 0 && n.f <= 22 && [0, 3, 5, 7, 10].includes(mod12(pitch(n) - 4))), 'E box ' + b); }
  const c = { key: 9, minor: true, lvl: 6, genre: 'rock', prog: 'minorRock' };
  const r5 = ejRolling5s(c); ok(r5 && r5.tab.notes.length === 41 && r5.unit.includes('groups of 5'), 'rolling 5s: 8 groups + root');
  const inScale = ex => ex.tab.notes.every(n => [0, 3, 5, 7, 10].includes(mod12(pitch(n) - 9)));
  ok(inScale(r5) && inScale(ejRolling5s(c, { dir: 'up', diagonal: true })), 'rolling 5s stay in the scale');
  const six = ejSixes(c); ok(six.tab.notes.length === 48 && Math.abs(six.tab.notes[1].t - 1 / 6) < 1e-3 && inScale(six), 'sixes: sextuplets in scale');
  const sp = ejSpreadProgression(c, { key: 9 }); ok(sp.voicings.length === 4 && sp.chords.join() === 'A,E,F♯m,D', 'spread progression chords ' + sp.chords.join());
  const tap = evhTapTriplets(c); ok(tap && tap.tab.notes.length === 48 && tap.tab.notes.every(n => n.f <= 22) && tap.tab.notes[0].x === 't', 'tap triplets');
  // tapped notes are chord tones
  const amT = tap.tab.notes.slice(0, 3).map(n => mod12(pitch(n))); ok(amT.every(p => [9, 0, 4].includes(p)), 'tap notes outline Am');
  ok(pgSixNote(c).tab.notes.length === 96 && pgSixNote(c, { across: true }), 'six-note lick');
  const sk = pgSkipArps(c); ok(sk && sk.tab.notes.every(n => n.f >= 0), 'string skip arps');
  const hx = hxSharp9(c); const ne = normalizeExercise(hx); ok(ne.voicings && ne.voicings.length === 2 && ne.chords.length === 2, '7#9 voicings and chords survive normalizing: ' + JSON.stringify(ne.chords));
  // every artist lesson builds
  for (const a of ARTISTS) {
    const p = normalize(emptyProfile()); p.domains = { picking: { level: 5 }, fretting: { level: 5 } };
    const course = createMasterClass(p, { title: `${a.name} style` });
    const r = await buildMasterTree(p, course);
    const exs = r.tree.units.flatMap(u => u.skills.flatMap(s => s.exercises));
    ok(r.source === 'artist' && r.tree.units.length >= 5 && exs.length >= 8, `${a.name}: ${r.tree.units.length} units, ${exs.length} exercises`);
    ok(course.name === `${a.name} Master Class`, 'artist course name ' + course.name);
    ok(exs.filter(e => e.tab).every(e => e.tab.notes.every(n => n.f >= 0 && n.f <= 24)), a.name + ' tabs valid');
  }
  // --- the reported request
  const req = 'Eric Johnson style masterclass covering his most commonly used techniques such as speed pentatonics, rolling 5s pentatonic patterns and spread triads';
  ok(matchArtist(req) && matchArtist(req).id === 'eric-johnson', 'artist matched');
  ok(matchTopic(req).id === 'artist-eric-johnson', 'topic = EJ');
  ok(matchTechniques(req).map(x => x.id).join() === 'speedPent,rolling5s,spreadTriads', 'techniques in order: ' + matchTechniques(req).map(x => x.id).join());
  {
    const p = normalize(emptyProfile()); p.domains = { picking: { level: 5 } };
    const course = createMasterClass(p, { title: req.slice(0, 80), text: req });
    let called = 0; const orig = Claude.json; Claude.json = async () => { called++; throw new Error('should not call'); };
    const ks = Claude.hasKey; Claude.hasKey = () => true;
    const r = await buildMasterTree(p, course);
    Claude.json = orig; Claude.hasKey = ks;
    const titles = r.tree.units.flatMap(u => [u.title, ...u.skills.map(s => s.title)]).join(' | ');
    ok(called === 0 && r.source === 'artist', 'EJ class built without API');
    ok(/Rolling 5s/.test(titles) && /Spread triad/.test(titles) && /sixes|Speed pentatonics/i.test(titles), 'EJ class covers the three requested techniques: ' + titles);
    ok(course.name === 'Eric Johnson Master Class', 'renamed from the long request: ' + course.name);
  }
  // techniques without an artist → one unit per technique
  {
    const p = normalize(emptyProfile());
    const course = createMasterClass(p, { title: 'speed pentatonics, rolling 5s and spread triads' });
    const t = await generateMasterLocal(p, course);
    ok(t.kind === 'techniques' && t.units.map(u => u.title).slice(0, 3).join() === 'Speed pentatonics,Rolling 5s,Spread triads', 'technique course: ' + t.units.map(u => u.title).join());
    const c2 = createMasterClass(p, { title: 'pentatonic with rolling 5s' });
    const t2 = await generateMasterLocal(p, c2);
    // rolling 5s is a complete path now: the request gets that path (stage by stage), or a topic course with a rolling 5s unit
    ok((t2.kind === 'path' && t2.units.length >= 2 && t2.units.every(u => /^(Foundations|Intermediate|Advanced|Mastery): /.test(u.title))) || (t2.kind === 'topic' && t2.units.some(u => /^Rolling 5s/.test(u.title))), 'pentatonic with rolling 5s gets rolling 5s units: ' + t2.kind + ' ' + t2.units.map(u => u.title).join());
    const c3 = createMasterClass(p, { title: 'Eric Johnson style plus sweep picking' });
    const t3 = await generateMasterLocal(p, c3);
    ok(t3.kind === 'artist' && t3.units.some(u => u.title === 'Sweep picking'), 'artist + extra topic: ' + t3.units.map(u => u.title).join());
  }
  ok(requestPhrases('covering speed pentatonics, rolling 5s and spread triads').join('|') === 'speed pentatonics|rolling 5s|spread triads', 'phrases');
  // --- teaching method first: master classes never ask Claude to invent a plan
  {
    const p = normalize(emptyProfile()); p.domains = { picking: { level: 5 } };
    let calls = 0; const orig = Claude.json, ks = Claude.hasKey; Claude.hasKey = () => true; Claude.json = async () => { calls++; return {}; };
    const known = createMasterClass(p, { title: 'Yngwie Malmsteen style: sweep arpeggios and harmonic minor runs' });
    let r = null, err = null; try { r = await buildMasterTree(p, known); } catch (e) { err = e; }
    ok(calls === 0 && (r ? r.source !== 'claude' : /research/.test(err.message)), 'a master class is built from researched lessons or not at all, never by Claude: ' + (r ? r.source : err.message));
    const unknown = createMasterClass(p, { title: 'banjo rolls' });
    let e2 = null; try { await buildMasterTree(p, unknown); } catch (e) { e2 = e; }
    ok(calls === 0 && e2 && /research queue/.test(e2.message), 'an unresearched topic: no plan, the research queue instead');
    Claude.json = orig; Claude.hasKey = ks;
  }
  // --- knowledge base: paths, stages, the index
  ok(KB_INDEX.length >= 17 && KB_INDEX.every(e => e.stages.length && e.level[0] <= e.level[1]), 'index has every entry with stages');
  for (const meta of KB_INDEX) {
    const e = await loadEntry(meta.id);
    ok(e.id === meta.id && e.stages.length === meta.stages.length, meta.id + ' loads and matches the index');
    const p0 = normalize(emptyProfile());
    for (const st of e.stages) { const list = await stageLessonList(p0, meta.id, { tier: st.tier, lvl: st.levels[0] }); ok(list.length && list.every(l => l.key && l.key.startsWith('kb:' + meta.id + ':')), `${meta.id}/${st.tier}: ${list.length} lessons with keys`); }
  }
  {
    // a synthetic four-stage path builds a course with one unit per stage from the player's stage up
    const { stage, entry, S } = await import('../js/data/lib.js');
    const { ejRolling5s: g } = await import('../js/data/kb/rolling5s.js');
    const four = entry({ id: 'demo', title: 'Demo', domain: 'picking', re: /demo/, summary: 's', stages: ['foundations', 'intermediate', 'advanced', 'mastery'].map(t => stage(t, t, 'goal ' + t, [S('s-' + t, 'Skill ' + t, 'picking', 'x', [c => g(c)])])) });
    const raw = pathRaw(four, 5, 'rock');
    ok(raw.units.length === 3 && /Intermediate/.test(raw.units[0].title) && /Mastery/.test(raw.units[2].title), 'path from the stage at your level to mastery: ' + raw.units.map(u => u.title).join(' | '));
    ok(raw.units[2].skills[0].exercises[0].level >= 9, 'mastery lessons built at mastery level');
    ok(pathRaw(four, 1, 'rock').units.length === 4 && /scratch/.test(pathRaw(four, 1, 'rock').summary), 'new players start from scratch');
  }
  // --- knowledge-base requests
  {
    const p1 = normalize(emptyProfile());
    ok(knowledgeGap('rolling 5s') === null && knowledgeGap('travis picking') === null, 'known topics have no gap');
    const g1 = knowledgeGap('bossa nova'); ok(g1 && g1.text === 'bossa nova' && g1.kind === 'style', 'unknown style: ' + JSON.stringify(g1));
    const g3 = knowledgeGap('slide guitar'); ok(g3 && g3.kind === 'technique', 'slide guitar is not legato slides: ' + JSON.stringify(g3));
    ok(knowledgeGap('Switching between F and C') === null && knowledgeGap('My bends sound out of tune') === null, 'ordinary practice requests are not gaps');
    // a made-up name no content run will build (real players, like Tosin Abasi, become topics)
    const g2 = knowledgeGap('Corwin Halvorsen style', 'guitarist'); ok(g2 && g2.kind === 'guitarist' && g2.text === 'Corwin Halvorsen', 'unknown guitarist: ' + JSON.stringify(g2));
    ok(knowledgeGap('Eric Johnson style', 'guitarist') === null, 'known guitarist has no gap');
    addRequest(p1, { text: 'Corwin Halvorsen', kind: 'guitarist' }); addRequest(p1, { text: 'corwin halvorsen', kind: 'guitarist' });
    ok(p1.kbRequests.length === 1, 'requests are not duplicated');
    const f = requestsFile(p1); ok(f.requests[0].status === 'queued' && f.requests[0].kind === 'guitarist' && !JSON.stringify(f).includes('sk-ant'), 'requests file');
    addRequest(p1, { text: 'travis picking for beginners', kind: 'technique' });
    ok(myRequests(p1).find(r => /travis/.test(r.text)).status === 'added', 'a request the knowledge base now covers shows as added');
  }
  ok(requestWords('Rolling 5s pentatonics, please').join() === '5,pentatonic,rolling', 'request words: ' + requestWords('Rolling 5s pentatonics, please').join());
  window.__finish();
})().catch(e => { console.log('THROW', e.stack); window.__finish(); });
