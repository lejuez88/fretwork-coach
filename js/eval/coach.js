// Turning measurements (and video frames) into teacher feedback and
// prescriptions. Claude interprets when a key is set; local rules always run so
// there is useful feedback offline too.
import { Claude } from '../core/claude.js';
import { suggestPicking } from '../tools/picking.js';
import { normalizeExercise } from '../core/coursegen.js';
import { CHORD_SHAPES } from '../assessment/engine.js';
import { CHORD_MIDI } from '../core/audio.js';

const AREAS = ['timing', 'accuracy', 'dynamics', 'legato', 'tuning', 'fretting-hand', 'picking-hand', 'posture', 'tension'];

/** Compact, Claude-friendly view of the metrics. */
function metricsBrief(m) {
  if (!m || m.error) return null;
  const { points, ...rest } = m;
  return rest;
}

function tabText(ex) {
  const notes = ex.tab && ex.tab.notes ? ex.tab.notes : ex.notes;
  if (!notes || !notes.length) return null;
  return notes.slice(0, 24).map(n => `${'eBGDAE'[n.s - 1]}${n.f}${n.x ? n.x : ''}@${+n.t.toFixed(2)}`).join(' ');
}

/* ------------------------------- Local rules ----------------------------- */
export function localFeedback(m, ex, { level = 4 } = {}) {
  const issues = [], strengths = [], rx = [];
  const t = m.timing || {}, d = m.dynamics || {}, p = m.pitch || {};
  const goal = Math.max(60, Math.round((m.bpm || 80) * 1.1));
  const slow = Math.max(40, Math.round((m.bpm || 80) * 0.8));
  if (m.kind === 'tab') {
    if (m.hitRate >= 0.97) strengths.push(`Every note was there: ${Math.round(m.hitRate * 100)}% of the notes in the tab were played.`);
    else issues.push({ title: 'Dropped notes', area: 'accuracy', severity: m.hitRate < 0.85 ? 'high' : 'medium', detail: `${Math.round((1 - m.hitRate) * 100)}% of the notes weren’t heard.`, evidence: m.problems.filter(x => x.miss > 0.3).map(x => `${x.where} (${x.note})`).join('; '), fix: 'Slow down until every note speaks, then use the tempo ladder.' });
    if (m.extraRate > 0.08) issues.push({ title: 'Extra notes', area: 'accuracy', severity: 'medium', detail: `${m.extraNotes} notes were heard that aren’t in the tab (strings ringing or brushed by accident).`, evidence: 'Onsets that didn’t match any tab note.', fix: 'Mute unused strings with the side of the picking hand and the underside of the fretting fingers.' });
    if (p.accuracy != null) {
      if (p.accuracy >= 0.97) strengths.push('Fretting accuracy: the notes you played were the right ones.');
      else if (p.accuracy < 0.93) issues.push({ title: 'Wrong notes', area: 'accuracy', severity: p.accuracy < 0.85 ? 'high' : 'medium', detail: `${Math.round((1 - p.accuracy) * 100)}% of checked notes were the wrong pitch.`, evidence: (p.wrong || []).slice(0, 3).map(w => `${w.where}: expected ${w.expected}, heard ${w.played}`).join('; '), fix: 'Isolate the bar with the mistake and play it 5 times slowly before putting it back.' });
    }
    if (p.tuningCents != null && Math.abs(p.tuningCents) >= 12) issues.push({ title: 'Guitar out of tune', area: 'tuning', severity: 'medium', detail: `Your notes average ${Math.abs(p.tuningCents)} cents ${p.tuningCents < 0 ? 'flat' : 'sharp'}.`, evidence: 'Measured across the correct notes.', fix: 'Tune with the Tuner before practicing.' });
    if (d.legatoGapDb != null && d.legatoGapDb < -6) {
      issues.push({ title: 'Weak hammer-ons and pull-offs', area: 'legato', severity: 'medium', detail: `Legato notes are ${Math.abs(d.legatoGapDb)} dB quieter than picked notes${d.legatoMissRate ? `, and ${Math.round(d.legatoMissRate * 100)}% were barely heard` : ''}.`, evidence: 'Compared the volume of hammered and picked notes.', fix: 'Hammer from about 1 cm with the fingertip; pull off slightly downward, like a pluck.' });
      rx.push({ name: 'Hammer-on / pull-off trills', domain: 'fretting', unit: '16ths', startBpm: slow, goalBpm: goal, minutes: 4, level, reason: 'Even volume on legato notes', why: 'Trills isolate hammer and pull strength so every legato note speaks.', instr: 'Pick the first note, then hammer and pull between frets 5 and 7 on the G string without picking again. 1 minute per finger pair (1-3, 2-4, 1-4).', watch: 'Notes fading after the first pick.', simplify: '8th notes.', tab: { step: 0.25, notes: [[3, 5], [3, 7, 'h'], [3, 5, 'p'], [3, 7, 'h'], [3, 5, 'p'], [3, 7, 'h'], [3, 5, 'p'], [3, 7, 'h']] } });
    }
    const sc = t.stringChangeDevMs, ss = t.sameStringDevMs;
    if (sc != null && ss != null && sc > ss + 8 && sc > 15) {
      issues.push({ title: 'Timing slips at string changes', area: 'picking-hand', severity: 'medium', detail: `Notes after a string change are ${sc} ms off on average vs ${ss} ms on the same string.`, evidence: m.problems.filter(x => x.stringChange).map(x => x.where).join('; '), fix: 'Keep the pick motion small and practice the crossing alone.' });
      rx.push({ libId: 'string-skip', name: 'String-crossing isolation', startBpm: slow, goalBpm: goal, minutes: 5, level, reason: 'Cleaner string changes', instr: 'Loop the crossing pattern; keep the wrist relaxed and the pick close to the strings.' });
    }
  }
  if (t.sdMs != null) {
    if (t.sdMs <= 12) strengths.push(`Very consistent timing: notes land within about ±${t.sdMs} ms.`);
    else if (t.sdMs > 22) {
      issues.push({ title: 'Uneven timing', area: 'timing', severity: t.sdMs > 35 ? 'high' : 'medium', detail: `Notes vary by about ±${t.sdMs} ms around the beat.`, evidence: `Only ${Math.round((t.within25 || 0) * 100)}% of notes landed within 25 ms of where they belong.`, fix: 'Count subdivisions out loud and drop the tempo 10%.' });
      rx.push({ name: 'Subdivision ladder', domain: 'rhythm', unit: 'quarters→16ths', startBpm: slow, goalBpm: goal, minutes: 4, level, reason: 'Steadier timing', why: 'Switching subdivisions on demand builds the internal grid.', instr: 'Muted strums: 1 bar each of quarters, 8ths, triplets, 16ths, repeat without stopping.', watch: 'Rushing the 16ths.', simplify: 'Quarters ↔ 8ths only.' });
    }
  }
  if (t.calibrated && t.meanMs != null && Math.abs(t.meanMs) >= 18) {
    const rush = t.meanMs < 0;
    issues.push({ title: rush ? 'Rushing ahead of the beat' : 'Dragging behind the beat', area: 'timing', severity: Math.abs(t.meanMs) > 35 ? 'high' : 'medium', detail: `On average you play ${Math.abs(t.meanMs)} ms ${rush ? 'early' : 'late'}.`, evidence: 'Measured against the click, with latency calibrated.', fix: rush ? 'Let the click land first: aim to bury it under your note.' : 'Anticipate slightly: start the motion on the "and" before.' });
    rx.push({ name: rush ? 'Backbeat click (2 & 4)' : 'Downbeat lock', domain: 'rhythm', unit: '8ths', metroMode: rush ? 'backbeat' : 'all', startBpm: slow, goalBpm: goal, minutes: 4, level, reason: rush ? 'Stop rushing' : 'Stop dragging', why: rush ? 'Hearing the click only on 2 and 4 forces you to hold the time yourself.' : 'Accenting each downbeat locks your attack to the click.', instr: rush ? 'Muted 8th-note strums with the click on 2 and 4 only. Feel 1 and 3 yourself.' : 'Muted 8ths, accent beat 1 of every bar exactly with the click.', watch: rush ? 'Flipping the beat so the click feels like 1 and 3.' : 'Accents arriving late.', simplify: 'Quarter notes.' });
  }
  if (t.driftMsPer10s != null && Math.abs(t.driftMsPer10s) >= 15) {
    issues.push({ title: t.driftMsPer10s < 0 ? 'Speeding up over time' : 'Slowing down over time', area: 'timing', severity: 'medium', detail: `Your timing moves about ${Math.abs(t.driftMsPer10s)} ms every 10 seconds.`, evidence: 'Trend of note timing across the take.', fix: 'Practice with gaps in the click so you notice drift yourself.' });
    rx.push({ name: 'Gap click: hold the time', domain: 'rhythm', unit: '8ths', metroMode: 'gap', startBpm: slow, goalBpm: goal, minutes: 4, level, reason: 'Hold tempo without the click', why: 'Bars of silence reveal drift you can’t hear while the click plays.', instr: 'The click plays 2 bars, then 2 silent bars. Keep playing; check beat 1 when it returns.', watch: 'Speeding up in the silence.', simplify: '1-bar gaps.' });
  }
  if (d.sdDb != null) {
    if (d.sdDb <= 3) strengths.push('Even dynamics: note volumes are consistent.');
    else if (d.sdDb > 5.5 && !(d.legatoGapDb != null && d.legatoGapDb < -6)) {
      issues.push({ title: 'Uneven note volume', area: 'dynamics', severity: 'low', detail: `Note volume varies by about ±${d.sdDb} dB.`, evidence: 'Peak level of each note.', fix: 'Practice with a light accent on each beat and equal volume in between.' });
      rx.push({ name: 'Accent control', domain: 'picking', unit: '8ths', startBpm: slow, goalBpm: goal, minutes: 3, level, reason: 'Even picking dynamics', why: 'Controlling accents is how you control evenness.', instr: 'Play the same exercise accenting only beat 1, then only beat 2, etc. Everything else equal and soft.', watch: 'Accents creeping into every note.', simplify: 'Quarter notes.' });
    }
  }
  if (!issues.length) strengths.push('Ready to push: raise the tempo 3–5 BPM.');
  const score = m.score || 0;
  return {
    summary: m.clean ? `Clean take at ${m.bpm} BPM (score ${score}).` : `Score ${score} at ${m.bpm} BPM. ${issues[0] ? issues[0].title + ' is the main thing holding this back.' : ''}`,
    verdict: m.clean ? 'clean' : score >= 80 ? 'almost' : 'not yet',
    strengths: strengths.slice(0, 4), issues: issues.slice(0, 5),
    prescriptions: rx.slice(0, 3), nextStep: m.clean ? `Next session: ${(m.bpm || 80) + 4} BPM.` : `Next session: stay at ${m.bpm} BPM and fix “${issues[0] ? issues[0].title.toLowerCase() : 'the weak spot'}”.`,
    source: 'local'
  };
}

/* -------------------------------- Claude --------------------------------- */
export async function claudeFeedback({ profile, exercise, metrics, mode = 'audio', frames = [], focus = 'full', context = {} }) {
  const q = profile.questionnaire;
  const student = {
    levels: Object.fromEntries(Object.entries(profile.domains).map(([k, v]) => [k, v.level])),
    goals: q.goals, players: q.players.map(p => p.name), struggles: q.struggles
  };
  const ex = { name: exercise.name, domain: exercise.domain, unit: exercise.unit, goalBpm: exercise.goalBpm, instructions: exercise.instr || exercise.why, tab: tabText(exercise), picking: context.picking || ((profile.settings && profile.settings.pickModes) || {})[exercise.pickKey || exercise.id] || suggestPicking(exercise) };
  const blocks = [];
  frames.forEach((f, i) => {
    blocks.push({ type: 'text', text: `Frame ${i + 1} (t = ${f.t.toFixed(1)} s${f.label ? ', ' + f.label : ''}):` });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
  });
  const text = `Evaluate this guitar student's take like an expert private teacher would.

STUDENT: ${JSON.stringify(student)}
EXERCISE: ${JSON.stringify(ex)}
TAKE: ${mode === 'video' ? `video (${frames.length} frames above, camera framing: ${focus})` : 'audio only'}${metrics && !metrics.error ? ` played at ${metrics.bpm} BPM` : ''}.
MEASUREMENTS (from the app's audio analysis; trust these numbers, don't contradict them):
${metrics && !metrics.error ? JSON.stringify(metricsBrief(metrics)) : 'No usable audio measurements.'}
How to read them: hitRate = share of tab notes heard. pitch.accuracy = share of checked notes that were the right pitch. timing.sdMs = spread of note timing (≤12 excellent, 13–22 good, >22 uneven). timing.meanMs = average early(−)/late(+) vs the click; only meaningful if timing.calibrated is true. driftMsPer10s = speeding up (−) or slowing down (+). dynamics.sdDb = note volume spread (≤3 even). legatoGapDb = hammer/pull volume vs picked (< −6 weak). problems = the spots in the pattern with the most errors.
${mode === 'video' ? `For the frames: judge posture, guitar position, fretting hand (thumb placement, finger curvature, fingertips close behind the frets, wrist angle, finger lift height, visible tension) and picking hand (grip, anchoring, motion source wrist/elbow/fingers, pick angle, and whether the stroke directions follow the exercise's picking approach) — only what is actually visible. Say when something can't be judged from these angles. Refer to frames by number.` : ''}

Write feedback that is specific, honest and encouraging. Every issue must cite evidence (a number above${mode === 'video' ? ' or a frame' : ''}).
Prescribe up to 3 short, measurable exercises that fix the biggest issues (tempo-based, with startBpm a tempo they can play cleanly now and a goalBpm). Tabs: string 1 = high e, 6 = low E; step = beat length of each note. Any chord symbols are allowed for "chords" and "backing"; give exact grips as "voicings": [{"name":"Cmaj7","frets":"x32000"}] (low E → high e, x = muted) when the voicing matters. metroMode may be "all", "backbeat" (click on 2&4) or "gap" (2 bars on, 2 off).

Return JSON:
{"summary": "2 sentences", "verdict": "clean|almost|not yet",
 "strengths": ["..."],
 "issues": [{"title": string, "area": one of ${JSON.stringify(AREAS)}, "severity": "high|medium|low", "detail": string, "evidence": string, "fix": string}],
 ${mode === 'video' ? '"frameNotes": [{"frame": int, "note": string}],' : ''}
 "prescriptions": [{"name": string, "reason": string (which issue it fixes), "domain": "fretting|picking|rhythm|fretboard|theory|ear|improv", "unit": string, "level": int 1-10, "startBpm": int, "goalBpm": int, "minutes": int 3-6, "why": string, "instr": string, "watch": string, "simplify": string, "metroMode": optional, "picking": "alternate|strict|economy|down|fingers|hybrid", "tab": optional {"step": number, "notes": [[string, fret, "h|p|b|/|pm" optional]]}, "voicings": optional [{"name": string, "frets": string}], "chords": optional [names], "backing": optional [names]}],
 "nextStep": "one sentence"}`;
  blocks.push({ type: 'text', text });
  const raw = await Claude.json({
    system: 'You are a world-class guitar teacher. You combine objective measurements with what you can see to give precise, actionable feedback. Never invent observations that the data or frames do not support.',
    messages: [{ role: 'user', content: blocks }], maxTokens: 2500
  });
  return normalizeFeedback(raw);
}

export function normalizeFeedback(raw) {
  const str = (v, n = 300) => String(v || '').slice(0, n);
  return {
    summary: str(raw.summary, 400), verdict: ['clean', 'almost', 'not yet'].includes(raw.verdict) ? raw.verdict : 'almost',
    strengths: (raw.strengths || []).slice(0, 5).map(s => str(s, 200)),
    issues: (raw.issues || []).slice(0, 6).map(i => ({ title: str(i.title, 80), area: AREAS.includes(i.area) ? i.area : 'accuracy', severity: ['high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium', detail: str(i.detail), evidence: str(i.evidence), fix: str(i.fix) })),
    frameNotes: (raw.frameNotes || []).slice(0, 12).map(f => ({ frame: Number(f.frame) || 0, note: str(f.note, 200) })),
    prescriptions: (raw.prescriptions || []).slice(0, 3),
    nextStep: str(raw.nextStep, 200), source: 'claude'
  };
}

/** Normalize prescription specs into exercises the routine can run. */
export function toPrescriptionExercises(list, level) {
  const used = new Set();
  return (list || []).map(r => {
    const ex = normalizeExercise(Object.assign({ level }, r), used);
    if (!ex) return null;
    ex.level = ex.level || level;
    if (['all', 'backbeat', 'gap'].includes(r.metroMode)) ex.metroMode = r.metroMode;
    return { ex, reason: String(r.reason || ex.why || '').slice(0, 160) };
  }).filter(Boolean);
}
