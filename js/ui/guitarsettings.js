// Settings → Guitar: how many strings (6, 7 or 8) and the tuning, with presets and any string
// settable on its own. Saved in the profile (synced through Google Drive with it). Every tool
// follows it: fretboards, note finder, scales, chords, intervals, tuner, note listener, tab player.
import { esc } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { guitar, setGuitar, STRING_COUNTS, PRESETS, STANDARD, presetIdOf, presetNotes, tuningChoices, noteWithOctave, stringLabels, tuningNotes } from '../core/guitar.js';

const flatsOf = t => t.some(m => [3, 10].includes(((m % 12) + 12) % 12));

export function guitarSettingsHTML() {
  const g = guitar(), n = g.strings, t = g.tuning, id = presetIdOf(n, t), labels = stringLabels(t), flats = flatsOf(t);
  const rows = Array.from({ length: n }, (_, k) => n - k); // lowest string first, like reading the guitar from the floor up
  return `<div class="gt-set" data-r="guitar">
    <div class="field"><label id="gt-count">Strings</label>
      <div class="chips" role="radiogroup" aria-labelledby="gt-count">${STRING_COUNTS.map(k => `<button type="button" class="chip ${k === n ? 'on' : ''}" role="radio" aria-checked="${k === n}" data-gt-strings="${k}">${k}-string</button>`).join('')}</div></div>
    <div class="field"><label for="gt-preset">Tuning</label>
      <select id="gt-preset" data-gt="preset">${PRESETS[n].map(([k, l, notes]) => `<option value="${k}" ${k === id ? 'selected' : ''}>${esc(l)} · ${esc(tuningNotes(notes))}</option>`).join('')}${id === 'custom' ? `<option value="custom" selected>Custom · ${esc(tuningNotes(t))}</option>` : ''}</select></div>
    <div class="gt-strings" role="group" aria-label="Each string">
      ${rows.map(s => `<label class="gt-str"><span class="gt-num">${s}</span><span class="gt-name small muted">${esc(labels[s])}</span>
        <select data-gt-str="${s}" aria-label="String ${s} tuning">${tuningChoices(n, s).map(m => `<option value="${m}" ${m === t[s - 1] ? 'selected' : ''}>${esc(noteWithOctave(m, flats))}${m === STANDARD[n][s - 1] ? ' · std' : ''}</option>`).join('')}</select>
        <button type="button" class="kbtn sm gt-hear" data-gt-hear="${s}" aria-label="Hear string ${s}">♪</button></label>`).join('')}
    </div>
    <div class="row"><button type="button" class="btn sm ghost" data-gt="standard" ${id === 'standard' ? 'disabled' : ''}>Back to standard</button></div>
    <p class="small muted">Strings are numbered like tab: 1 = high e, 6 = low E${n > 6 ? ', 7 = low B' : ''}${n > 7 ? ', 8 = low F♯' : ''}. Note names, fretboard dots, the tuner, the note listener and the sound of the tab player all follow this. Lessons are written in standard tuning; they use strings 7 and 8 only when they’re made for a 7- or 8-string guitar.</p>
  </div>`;
}

/** Wire the section inside `host` (re-renders itself on every change). Returns cleanup. */
export function mountGuitarSettings(host, { onChange = () => {} } = {}) {
  const draw = () => { host.innerHTML = guitarSettingsHTML(); };
  const onClick = e => {
    const b = e.target.closest('button'); if (!b || !host.contains(b)) return;
    if (b.dataset.gtStrings) { setGuitar({ strings: +b.dataset.gtStrings }); draw(); onChange(guitar()); return; }
    if (b.dataset.gt === 'standard') { const g = guitar(); setGuitar({ tuning: STANDARD[g.strings] }); draw(); onChange(guitar()); return; }
    if (b.dataset.gtHear) { const c = Audio.get(); if (c) Audio.guitar(guitar().tuning[+b.dataset.gtHear - 1], c.currentTime + 0.02, { dur: 1.6, gain: 0.6 }); }
  };
  const onSel = e => {
    const el = e.target;
    if (el.dataset.gt === 'preset') { const g = guitar(), t = presetNotes(g.strings, el.value); if (t) setGuitar({ tuning: t }); draw(); onChange(guitar()); return; }
    if (el.dataset.gtStr) { const g = guitar(), t = g.tuning.slice(); t[+el.dataset.gtStr - 1] = +el.value; setGuitar({ tuning: t }); draw(); onChange(guitar()); }
  };
  host.addEventListener('click', onClick); host.addEventListener('change', onSel);
  draw();
  return () => { host.removeEventListener('click', onClick); host.removeEventListener('change', onSel); };
}
