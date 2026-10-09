// App chrome: bottom tab bar, contextual action bar, running-session pill.
import { $ } from '../core/util.js';

export const Shell = {
  get actionBar() { return $('#actionbar'); },
  actions(html) {
    const bar = this.actionBar;
    bar.innerHTML = html ? `<div class="inner">${html}</div>` : '';
    bar.classList.toggle('show', !!html);
    document.body.classList.toggle('has-actions', !!html);
    window.dispatchEvent(new Event('fc:bars'));
  },
  /** Bottom sheet. Returns {el, close}. Clicking the backdrop closes it. */
  sheet(html, { onClose } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="sheet-x" aria-label="Close">✕</button>${html}</div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 200); onClose && onClose(); };
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.sheet-x')) close(); });
    return { el: wrap.querySelector('.sheet'), close };
  },
  tabs(visible, active) {
    const t = $('#tabbar');
    t.classList.toggle('show', visible);
    document.body.classList.toggle('has-tabs', visible);
    t.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === active));
    window.dispatchEvent(new Event('fc:bars'));
  }
};
