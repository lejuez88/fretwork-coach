// Practice history: the stats, the monthly calendar (15-minute days) and logging
// practice done away from the app. Lives on the Profile page; Home shows only the
// "This week" summary (weekStripHTML) and the same "Log practice" sheet.
import { esc, fmtMinutes, today, toast, addDays, parseDay } from '../core/util.js';
import { Store, Practice } from '../core/store.js';
import { Shell } from './shell.js';

/** Seven bars, Monday to Sunday of this week, with today marked. */
export function weekStripHTML(st) {
  const now = today(), d = parseDay(now), dow = (d.getDay() + 6) % 7, start = addDays(now, -dow);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const max = Math.max(30, ...days.map(x => st.byDay[x] || 0));
  return `<div class="wk-bars" aria-label="Minutes practiced each day this week">${days.map((x, i) => {
    const m = st.byDay[x] || 0, h = m ? Math.max(8, Math.round(m / max * 100)) : 0;
    return `<div class="wk-day ${x === now ? 'today' : ''} ${x > now ? 'future' : ''}" title="${x}: ${fmtMinutes(m)}"><div class="wk-col"><i class="${m >= 15 ? 'done' : m ? 'some' : ''}" style="height:${h}%"></i></div><span>${'MTWTFSS'[i]}</span></div>`;
  }).join('')}</div>`;
}

/** The "Log practice" sheet, for practice done away from the app. */
export function openManualLog(p, onDone) {
  const sheet = Shell.sheet(`<h2>Log practice</h2><p class="muted small">For practice you did away from the app. It counts toward your stats, streak and calendar.</p>
    <div class="field"><label>Date</label><input type="date" data-r="date" value="${today()}" max="${today()}"></div>
    <div class="field"><label>Minutes</label><div class="stepper s1"><button data-m="-5">−</button><input type="number" inputmode="numeric" data-r="min" value="30"><button data-m="5">+</button></div></div>
    <button class="btn primary block" data-r="save">Save</button>`);
  sheet.el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const inp = sheet.el.querySelector('[data-r="min"]');
    if (b.dataset.m) { inp.value = Math.max(1, (+inp.value || 0) + Number(b.dataset.m)); }
    if (b.dataset.r === 'save') {
      const date = sheet.el.querySelector('[data-r="date"]').value || today();
      const m = Math.max(1, Math.min(600, +inp.value || 0));
      if (date > today()) return toast('That date is in the future.');
      Practice.addManual(p, date, m); Store.save(); sheet.close(); toast(`Logged ${m} min on ${date}.`);
      if (onDone) onDone();
    }
  });
}

/** The Practice history card (Profile). Returns a cleanup function. */
export function mountPracticeHistory(el, p) {
  let month = today().slice(0, 7);
  const stat = (k, v, cls = '') => `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  function calendar(st) {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7, now = today();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cd empty"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const min = st.byDay[iso] || 0;
      const cls = [min >= 15 ? 'done' : min > 0 ? 'some' : '', iso === now ? 'today' : '', iso > now ? 'future' : ''].join(' ');
      cells += `<span class="cd ${cls}" title="${iso}: ${fmtMinutes(min)}">${d}</span>`;
    }
    return `<div class="sec-head cal-head"><div class="cal-title">${esc(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</div><div class="calnav"><button class="kbtn sm" data-ph="prev" aria-label="Previous month">‹</button><button class="kbtn sm" data-ph="next" aria-label="Next month">›</button></div></div>
      <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="cw">${x}</span>`).join('')}${cells}</div>`;
  }
  function render() {
    const st = Practice.stats(p);
    el.innerHTML = `
      <div class="sec-head"><h3>Practice history</h3><button class="btn sm" data-ph="manual">+ Log practice</button></div>
      <div class="stats">
        ${stat('Total', fmtMinutes(st.total))}
        ${stat('This week', fmtMinutes(st.week))}
        ${stat('Daily average', fmtMinutes(st.avgDaily))}
        ${stat('Best streak', `${st.best} day${st.best === 1 ? '' : 's'}`)}
      </div>
      ${calendar(st)}
      <div class="cal-foot"><span><i class="dot done"></i>15+ min</span><span><i class="dot some"></i>under 15</span><span>A day counts toward your streak at 15 minutes.</span></div>`;
  }
  const onClick = e => {
    const b = e.target.closest('[data-ph]'); if (!b) return;
    if (b.dataset.ph === 'manual') return openManualLog(p, render);
    const [y, m] = month.split('-').map(Number), d = new Date(y, m - 1 + (b.dataset.ph === 'next' ? 1 : -1), 1);
    month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; render();
  };
  el.addEventListener('click', onClick);
  render();
  return () => el.removeEventListener('click', onClick);
}
