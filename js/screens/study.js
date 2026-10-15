// The Study page (#/lesson), Guided Path's "lesson reading": read a lesson before you play it.
// Bite-size cards instead of one long scroll — the idea, why it matters, the theory, how to
// practice it, a diagram, the pass criterion and the common mistake — under a thick progress bar
// showing where you are in the list. A sticky bottom bar: back to the previous lesson, the big
// "Practice it" pill (the practice page, tab and player always on screen), and the next lesson.
import { esc } from '../core/util.js';
import { Store } from '../core/store.js';
import { lessonStudy } from '../core/study.js';
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

/** The notes of the tab on a neck diagram, when the lesson has no chord or scale diagram of its own. */
function neckOf(ex) {
  const ns = (ex.tab && ex.tab.notes) || [];
  const seen = new Set(), marks = [];
  for (const n of ns) { if (!(n.s >= 1 && n.s <= 6) || n.f == null || n.f < 0) continue; const k = `${n.s}:${n.f}`; if (seen.has(k)) continue; seen.add(k); marks.push({ s: n.s, f: n.f, label: '' }); }
  if (!marks.length) return '';
  const hi = Math.max(...marks.map(m => m.f)), lo = Math.min(...marks.map(m => m.f));
  return `<div class="fbwrap">${fretboardSVG({ marks, maxFret: Math.max(5, Math.min(22, hi + 1)), highlightFrets: [lo, hi], fw: 40 })}</div>`;
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
  root.addEventListener('click', onClick); window.addEventListener('keydown', onKey);
  document.body.classList.add('studymode');
  render();
  return () => { root.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey); document.body.classList.remove('studymode'); };
}
