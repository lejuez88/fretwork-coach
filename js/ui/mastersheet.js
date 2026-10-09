// The "Build a master class" sheet, opened from the dashboard suggestions,
// any library exercise, the routine runner and the Practice ask box. It shows
// what the class will cover, lets you add specifics and the starting level,
// then builds the course (Claude when connected, else the built-in plan).
import { esc, toast } from '../core/util.js';
import { Store } from '../core/store.js';
import { Claude } from '../core/claude.js';
import { DOMAIN_BY_KEY } from '../assessment/engine.js';
import { tierName } from '../core/courses.js';
import { MASTER_BY_ID, matchTopic, topicFor, topicDomain, masterDifficulty, createMasterClass, buildMasterTree, canBuild, isMaster } from '../core/master.js';
import { Shell } from './shell.js';
import { matchTechniques, TIERS } from '../data/kb.js';
import { knowledgeGap } from '../core/kbrequests.js';
import { gapPromptHTML, onGapClick } from './kbrequest.js';
import { TOPIC_ART, TOPIC_HUE } from './topicart.js';

export const MC_ICON = '🎓';
export const topicArtHTML = (cat, cls = '') => `<span class="topic-img ${cls}" style="--h:${TOPIC_HUE[cat] || 225}">${TOPIC_ART[cat] || TOPIC_ART.theory}</span>`;

/**
 * Open the sheet. topic: {title, text?, topicId?, libId?, domain?, cat?, from?}.
 * navigate: when given, the new course opens once it's built; otherwise a toast says where it is.
 * onBuilt(course) runs after a successful build.
 */
export function openMasterSheet(topic = {}, { navigate = null, onBuilt = null } = {}) {
  const p = Store.profile; if (!p) return null;
  let title = String(topic.title || '').trim(), details = topic.text && topic.text !== topic.title ? String(topic.text) : '';
  let level = null, busy = false, error = '', progress = '';
  const sheet = Shell.sheet('<div data-r="mc"></div>', { onClose: () => { closed = true; } });
  let closed = false;
  sheet.el.classList.add('mcsheet');

  const current = () => {
    const cur = (topic.topicId && MASTER_BY_ID[topic.topicId] && MASTER_BY_ID[topic.topicId].title === title ? MASTER_BY_ID[topic.topicId] : null) || topicFor(`${title} ${details}`);
    const t = { title, text: details ? `${title}: ${details}` : title, topicId: cur ? cur.id : null, libId: topic.libId || null, domain: topic.domain || null, cat: topic.cat || (cur ? cur.cat : null), from: topic.from || null };
    return { t, cur };
  };
  function draw() {
    const { t, cur } = current();
    const dom = topicDomain(t), suggested = masterDifficulty(p, t), lv = level || suggested;
    const have = p.courses.filter(c => isMaster(c) && c.status !== 'archived' && c.topic && ((t.topicId && c.topic.topicId === t.topicId) || c.topic.title.toLowerCase() === title.toLowerCase()));
    const buildable = title.length >= 3 && canBuild(t);
    const kbm = matchTechniques(title), kbPath = !(cur && cur.artist) && kbm.length === 1 ? kbm[0] : null;
    const gap = title.length >= 3 ? knowledgeGap(title, t.cat === 'artist' ? 'guitarist' : null) : null;
    sheet.el.querySelector('[data-r="mc"]').innerHTML = `
      <div class="mc-top">${topicArtHTML(t.cat || (cur && cur.cat) || 'theory')}<div><div class="label">${MC_ICON} Master class</div><h2>${esc(title || 'Any topic')}</h2>
        <p class="small muted">${esc(cur ? cur.blurb : 'A whole course on this topic: where to start, how to practice it, and how to use it in music.')}</p></div></div>
      <div class="field"><label>Topic</label><input type="text" data-r="mctitle" maxlength="80" value="${esc(title)}" placeholder="e.g. sight reading, the modes, playing over changes" ${busy ? 'disabled' : ''}></div>
      <div class="field"><label>Anything specific? <span class="muted">(optional)</span></label><textarea data-r="mcdetails" rows="2" maxlength="300" placeholder="e.g. “Dorian for funk solos”, “jazz standards”, “I keep losing time on 16ths”" ${busy ? 'disabled' : ''}>${esc(details)}</textarea></div>
      <div class="field"><label>Starting level: <b>${lv}/10 · ${tierName(lv)}</b></label>
        <input type="range" min="1" max="10" value="${lv}" data-r="mclevel" aria-label="Starting level" ${busy ? 'disabled' : ''}>
        <p class="muted small">Suggested from your ${esc(DOMAIN_BY_KEY[dom] ? DOMAIN_BY_KEY[dom].name : dom)} level: ${suggested}. The course climbs about three levels from here.</p></div>
      ${kbPath ? `<div class="mc-outline"><div class="label">The ${esc(kbPath.title)} path</div><ol>${TIERS.map(x => { const s = kbPath.stages.find(y => y.tier === x.id); return `<li><b>${esc(x.name)}</b> <span class="muted small">${s ? esc(s.goal) : 'coming soon: being researched'}</span></li>`; }).join('')}</ol></div>`
        : cur && cur.artist ? `<div class="mc-outline"><div class="label">What it covers</div><ol>${(cur.techniques || []).map(x => `<li><b>${esc(x)}</b></li>`).join('')}</ol></div>`
        : cur && cur.units && !Claude.hasKey() ? `<div class="mc-outline"><div class="label">What it covers</div><ol>${cur.units.map(u => `<li><b>${esc(u.title)}</b> <span class="muted small">${esc(u.summary)}</span></li>`).join('')}</ol></div>` : ''}
      ${gapPromptHTML(gap)}
      <p class="small ${buildable ? 'muted' : 'bad'}">${cur && cur.artist ? `Built from the Artist Series lessons on ${esc(cur.title.replace(/ style$/, ''))}’s signature techniques, at your level. No API cost.${details ? ' Techniques you name that aren’t in the series are added as extra units.' : ''}`
        : kbPath && kbPath.complete ? `Built from the knowledge base’s full ${esc(kbPath.title.toLowerCase())} path, from the stage at your level to mastery. No API cost.`
        : Claude.hasKey() ? 'Claude designs the course around your levels, genres and what you wrote: an outline first, with every technique you name as its own skill, then the exercises unit by unit (about 1–2 minutes). It’s saved, so asking for the same thing again costs nothing.'
        : buildable ? (cur ? 'Built-in plan. With Claude connected in Settings, the course is designed around you.' : 'A five-step plan from the built-in exercises. With Claude connected in Settings, any topic gets a course designed around you.')
        : title.length < 3 ? 'Name a topic to build a course around.' : 'The built-in plans don’t cover this topic. Connect Claude in Settings and any topic works, or try one of the suggestions on the dashboard.'}</p>
      ${have.length ? `<p class="small">You already have <a class="link" href="#/course/${have[0].id}" data-r="mcopen">${esc(have[0].name)}</a>. Building another gives you a fresh plan alongside it.</p>` : ''}
      ${error ? `<p class="small bad">${esc(error)}</p>` : ''}
      <button class="btn primary block" data-r="mcbuild" ${busy || !buildable ? 'disabled' : ''}>${busy ? `<span class="spinner sm"></span>${esc(progress || (Claude.hasKey() && !(cur && cur.artist) ? 'Claude is designing your master class…' : 'Building your master class…'))}` : `${MC_ICON} Build master class`}</button>`;
  }
  async function build() {
    const { t } = current();
    if (title.length < 3) return;
    busy = true; error = ''; draw();
    const course = createMasterClass(p, { ...t, title, text: t.text, difficulty: level || masterDifficulty(p, t) });
    try {
      const r = await buildMasterTree(p, course, { onProgress: x => {
        progress = x.step === 'outline' ? 'Claude is outlining the course…' : `Claude is writing the exercises: ${x.done} of ${x.total} units done…`;
        const btn = sheet.el.querySelector('[data-r="mcbuild"]'); if (btn && busy) btn.innerHTML = `<span class="spinner sm"></span>${esc(progress)}`;
      } });
      progress = '';
      Store.save();
      busy = false;
      const stillOpen = !closed; // closed while building: don't jump away from what you're doing
      if (stillOpen) sheet.close();
      const go = navigate && stillOpen;
      const where = go ? '' : ': find it under Your courses on the dashboard';
      toast(r.error ? `Claude couldn’t design it (${r.error}), so the built-in lessons for what you named were used.`
        : r.source === 'cache' ? `${MC_ICON} “${course.name}” is ready${where}. Reused the plan Claude designed for this request before (no API cost).`
        : r.source === 'artist' ? `${MC_ICON} “${course.name}” is ready${where}. Built from the Artist Series lessons (no API cost).`
        : r.source === 'path' ? `${MC_ICON} “${course.name}” is ready${where}. Built from the knowledge base’s learning path (no API cost).`
        : `${MC_ICON} “${course.name}” is ready${where}.`, 5200);
      if (onBuilt) onBuilt(course);
      if (go) navigate(`#/course/${course.id}`);
    } catch (e) {
      p.courses = p.courses.filter(c => c.id !== course.id);
      busy = false; progress = ''; error = e.message || 'The course couldn’t be built.';
      if (closed) toast(error, 4200); else draw();
    }
  }
  sheet.el.addEventListener('click', e => {
    if (onGapClick(e)) return;
    if (e.target.closest('[data-r="mcbuild"]') && !busy) build();
    if (e.target.closest('[data-r="mcopen"]')) sheet.close();
  });
  sheet.el.addEventListener('input', e => {
    const r = e.target.dataset.r;
    if (r === 'mclevel') { level = +e.target.value; draw(); }
  });
  sheet.el.addEventListener('change', e => {
    const r = e.target.dataset.r;
    if (r === 'mctitle') { title = e.target.value.trim(); error = ''; draw(); }
    if (r === 'mcdetails') { details = e.target.value.trim(); draw(); }
  });
  // typing: refresh the "can build" state without losing focus
  sheet.el.addEventListener('keyup', e => {
    if (e.target.dataset.r !== 'mctitle') return;
    title = e.target.value.trim();
    const b = sheet.el.querySelector('[data-r="mcbuild"]'); if (b && !busy) b.disabled = title.length < 3 || !canBuild(current().t);
  });
  draw();
  return sheet;
}
