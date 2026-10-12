// Guest mode: small notes shown where the app would otherwise choose lessons for you
// or keep your progress. A guest has everything open; a player profile adds saving
// and lessons chosen for your level.
import { esc } from '../core/util.js';
import { isGuest } from '../core/store.js';

export { isGuest };

/** A card that says what needs a profile, with the way to create one. */
export function guestNoteHTML(text, { cls = '' } = {}) {
  return `<section class="card guest-note ${cls}"><div class="label">Guest mode</div><p class="small">${esc(text)}</p>
    <a class="btn sm" href="#/welcome">Create my player profile</a></section>`;
}

/** One line for places that save progress (logging a tempo, mastering a lesson). */
export const GUEST_SAVE_LINE = 'You’re using the app as a guest, so tempos you log here last only until you close the app.';
