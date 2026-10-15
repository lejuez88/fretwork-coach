// The Study page (#/lesson), Guided Path's "lesson reading": read a lesson before you play it.
// Bite-size cards instead of one long scroll — the idea, why it matters, the theory, how to
// practice it, a diagram, the pass criterion and the common mistake — under a thick progress bar
// showing where you are in the list. A sticky bottom bar: back to the previous lesson, the big
// "Practice it" pill (the practice page, tab and player always on screen), and the next lesson.
import { esc } from '../core/util.js';
import { Store } from '../core/store.js';
import { lessonStudy, lessonRootPc } from '../core/study.js';
import { exerciseDiagramsHTML, fretboardSVG } from '../ui/fretboard.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { tierName } from '../core/courses.js';
import { STD_LOW, mod12 } from '../core/theory.js';
import { icon } from '../ui/icons.js';
import { currentPlayCtx, setPlayCtx } from './play.js';

/** The pass criterion: the sentence in the instructions that starts with "Pass" (or "Goal"). */
export function passCriterion(ex) {
  const m = String((ex && ex.instr) || '').match(/(?:^|[.!?]\s+|\n)\s*((?:Pass|Goal)[^.!?\n]*[.!?]?)/i);
  return m ? m[1].trim() : '';
}
/** Instructions without the pass criterion (shown on its own card). */
const howTo = (ex, pass) => String((ex && ex.instr) || '').replace(pass, '').trim();

/** Smallest scale at which the neck still reads well (fret cells ~24px, note dots ~14px). */
const MIN_SCALE = 0.62;
const ROOT_NAME = ['C', 'C♯/D♭', 'D', 'E♭', 'E', 'F', 'F♯/G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const NECK_FW = 40, NECK_W = frets => 38 + frets * NECK_FW + 12;

/**
 * The notes of the tab on a neck diagram, when the lesson has no chord or scale diagram of its own.
 * Never scrolls: the SVG scales to the card's width. Two versions are drawn: the neck from the nut to
 * just past the highest note, and a window on the lesson's frets with two frets of margin either side
 * (at least 5 frets). fitNeck() shows the whole neck when it still reads well at the card's width,
 * otherwise the window.
 */
export function neckOf(ex) {
  const ns = (ex.tab && ex.tab.notes) || [];
  const tuning = (ex.tab && ex.tab.tuning) || null, root = lessonRootPc(ex);
  const pcOf = n => mod12((tuning ? tuning[n.s - 1] : STD_LOW[6 - n.s]) + n.f);
  const seen = new Set(), marks = [];
  for (const n of ns) {
    if (!(n.s >= 1 && n.s <= 6) || n.f == null || n.f < 0 || n.x === 'mute') continue;
    const k = `${n.s}:${n.f}`; if (seen.has(k)) continue; seen.add(k);
    const isRoot = root != null && pcOf(n) === root; // the root is always marked
    marks.push({ s: n.s, f: n.f, label: isRoot ? 'R' : '', family: isRoot ? 'root' : 'plain' });
  }
  if (!marks.length) return '';
  const hi = Math.max(...marks.map(m => m.f)), lo = Math.min(...marks.map(m => m.f));
  const full = Math.max(5, Math.min(22, hi + 1));
  let wLo = Math.max(0, lo - 3), wHi = Math.min(22, Math.max(hi + 2, wLo + 5));
  if (wHi - wLo < 5) wLo = Math.max(0, wHi - 5);
  if (wLo <= 1) wLo = 0; // close to the nut: show the nut
  const fullSVG = fretboardSVG({ marks, maxFret: full, highlightFrets: [lo, hi], fw: NECK_FW });
  const win = wLo > 0 || wHi < full;
  const winSVG = win ? fretboardSVG({ marks, minFret: wLo, maxFret: wHi, highlightFrets: [lo, hi], fw: NECK_FW }) : '';
  return `<div class="fbwrap sp-neck" data-full="${NECK_W(full)}">
    <div class="sp-neck-full">${fullSVG}</div>
    ${root != null && marks.some(m => m.family === 'root') ? `<p class="sp-neck-key small muted"><span class="fb-key fam-root">R</span> Root: ${esc(ROOT_NAME[root])}</p>` : ''}
    ${win ? `<div class="sp-neck-win" hidden>${winSVG}<p class="sp-neck-cap small muted">Frets ${wLo === 0 ? 'open' : wLo + 1}–${wHi} · the part of the neck this lesson uses</p></div>` : ''}
  </div>`;
}

/** Show the whole neck if it reads well at this width, otherwise the lesson's window. */
export function fitNeck(root) {
  const box = root.querySelector('.sp-neck'); if (!box) return;
  const win = box.querySelector('.sp-neck-win'), full = box.querySelector('.sp-neck-full');
  if (!win) return;
  const avail = box.clientWidth - 8;
  const useWin = avail > 0 && avail / +box.dataset.full < MIN_SCALE;
  win.hidden = !useWin; full.hidden = useWin;
}

export function mountStudy(root, { navigate }) {
  const p = Store.profile;
  const C = currentPlayCtx();
  if (!C || !C.items || !C.items.length) { navigate('#/practice'); return () => {}; }
  function render() {
    const it = C.items[C.idx], ex = it.ex || {}, s = lessonStudy(it, (p.lessonCache && p.lessonCache.study) || null);
    const dom = DOMAIN_BY_KEY[ex.domain], pass = passCriterion(ex), how = howTo(ex, pass);
    const pct = Math.round((C.idx + 1) / C.items.length * 100);
    const diagram = exerciseDiagramsHTML(ex) || neckOf(ex);
    root.innerHTML = `<div class="study-page">
      <div class="sp-top"><a class="sp-x" href="${esc(C.back || '#/practice')}" aria-label="Close: back to ${esc(C.backLabel || 'the list')}" title="${esc(C.backLabel || 'Back')}">${icon('x')}</a>
        <div class="sp-prog" role="progressbar" aria-valuemin="1" aria-valuemax="${C.items.length}" aria-valuenow="${C.idx + 1}"><i style="width:${pct}%"></i></div><span class="sp-count">${C.idx + 1}/${C.items.length}</span></div>
      <article class="sp-card">
        <div class="label">${esc([it.tier ? (TIER[it.tier] || '') : ex.level ? tierName(ex.level) : '', dom ? dom.short || dom.name : '', ex.minutes ? `${ex.minutes} min` : ''].filter(Boolean).join(' · '))}</div>
        <h1>${esc(ex.name || it.title || 'Lesson')}</h1>
        ${it.skill && it.skill.title && it.skill.title !== ex.name ? `<p class="small muted sp-skill">${esc(C.title || '')}${C.title ? ' · ' : ''}${esc(it.skill.title)}</p>` : ''}
        <div class="sp-grid">
          <div class="sp-read">
            ${s.concept ? `<h4>The idea</h4><p>${esc(s.concept)}</p>` : ''}
            ${s.why ? `<h4>Why it matters</h4><p>${esc(s.why)}</p>` : ''}
            ${s.theory.length ? `<h4>The theory</h4><ul>${s.theory.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
            ${how ? `<h4>How to practice it</h4><p class="sp-how">${esc(how)}</p>` : ''}
          </div>
          <div class="sp-side">
            ${diagram ? `<div class="sp-diagram">${diagram}</div>` : ''}
            ${pass ? `<div class="sp-pass"><div class="label">Pass criterion</div><p>${esc(pass)}</p></div>` : ''}
            ${ex.watch ? `<div class="sp-mistake"><div class="label">Common mistake</div><p>${esc(ex.watch)}</p></div>` : ''}
            ${ex.simplify ? `<p class="small muted">Too hard? ${esc(ex.simplify)}</p>` : ''}
          </div>
        </div>
      </article>
      <div class="sp-bar">
        <button class="sp-circle" data-sp="prev" ${C.idx === 0 ? 'disabled' : ''} aria-label="Previous lesson">${icon('chevron-left')}</button>
        <button class="btn primary gp-pill sp-go" data-sp="play">${icon('play')} Practice it</button>
        <button class="sp-circle" data-sp="next" ${C.idx >= C.items.length - 1 ? 'disabled' : ''} aria-label="Next lesson">${icon('chevron-right')}</button>
      </div></div>`;
    fitNeck(root);
  }
  const TIER = { foundations: 'Foundations', intermediate: 'Intermediate', advanced: 'Advanced', mastery: 'Mastery' };
  const onClick = e => {
    const b = e.target.closest('[data-sp]'); if (!b) return;
    if (b.dataset.sp === 'play') { setPlayCtx(C); navigate('#/play'); return; }
    const d = b.dataset.sp === 'next' ? 1 : -1, n = C.idx + d;
    if (n < 0 || n >= C.items.length) return;
    C.idx = n; setPlayCtx(C); render(); window.scrollTo(0, 0);
  };
  const onKey = e => { if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const b = root.querySelector(`[data-sp="${e.key === 'ArrowRight' ? 'next' : 'prev'}"]`); if (b && !b.disabled) b.click(); } };
  const onResize = () => fitNeck(root);
  root.addEventListener('click', onClick); window.addEventListener('keydown', onKey); window.addEventListener('resize', onResize);
  document.body.classList.add('studymode');
  render();
  return () => { root.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); document.body.classList.remove('studymode'); };
}
