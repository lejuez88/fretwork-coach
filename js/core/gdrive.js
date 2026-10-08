// Google Drive: save the profile to the signed-in person's own Drive, and load it
// back on another device. Sign-in uses Google Identity Services in the browser;
// the app asks only for the "drive.file" permission, so it can see the files it
// created and nothing else in that Drive. Each Google account gets its own file.

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_STORE = 'fretworkCoach.googleClientId';
const FILE_STORE = 'fretworkCoach.driveFile';
const FILE_NAME = 'Fretwork Coach profile.json';
// The app's OAuth client ID (public by design). Set once the Google Cloud client exists;
// a client ID saved in Settings takes its place.
export const DEFAULT_CLIENT_ID = '827964771236-27h8njnn8b1nv2k3k0obcl6mji9ks155.apps.googleusercontent.com';

export function getClientId() { try { return (localStorage.getItem(CLIENT_STORE) || DEFAULT_CLIENT_ID).trim(); } catch { return DEFAULT_CLIENT_ID; } }
export function setClientId(id) { try { id = String(id || '').trim(); if (id) localStorage.setItem(CLIENT_STORE, id); else localStorage.removeItem(CLIENT_STORE); } catch { /* storage off */ } }
export const driveReady = () => !!getClientId();
export function lastDriveFile() { try { return JSON.parse(localStorage.getItem(FILE_STORE) || 'null'); } catch { return null; } }
function rememberFile(f) { try { localStorage.setItem(FILE_STORE, JSON.stringify(f)); } catch { /* ignore */ } }

let gisPromise = null;
/** Load Google's sign-in script (call early, so a later click can open sign-in right away). */
export function loadGoogle() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (!gisPromise) gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = GIS_SRC; s.async = true;
    s.onload = () => resolve(); s.onerror = () => { gisPromise = null; reject(new Error('Couldn’t load Google sign-in. Check the connection.')); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

let token = null, tokenExp = 0, tokenClient = null, tokenClientId = null;
/** An access token, asking the person to sign in (and choose an account) when needed. Call from a click. */
function getToken({ chooseAccount = false } = {}) {
  if (!chooseAccount && token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
  const id = getClientId();
  if (!id) return Promise.reject(new Error('Google Drive isn’t set up for this app yet (no client ID).'));
  if (!(window.google && window.google.accounts && window.google.accounts.oauth2)) return Promise.reject(new Error('Google sign-in is still loading. Tap again in a moment.'));
  return new Promise((resolve, reject) => {
    if (!tokenClient || tokenClientId !== id) {
      tokenClientId = id;
      tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: id, scope: SCOPE, callback: () => {} });
    }
    tokenClient.callback = r => {
      if (r && r.access_token) { token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000; resolve(token); }
      else reject(new Error(r && r.error === 'access_denied' ? 'Google sign-in was cancelled.' : 'Google sign-in didn’t finish' + (r && r.error ? ` (${r.error}).` : '.')));
    };
    tokenClient.error_callback = e => reject(new Error(e && e.type === 'popup_closed' ? 'Google sign-in was closed before it finished.' : e && e.type === 'popup_failed_to_open' ? 'The Google sign-in window was blocked. Allow pop-ups for this site and try again.' : 'Google sign-in failed.'));
    tokenClient.requestAccessToken({ prompt: chooseAccount ? 'select_account' : '' });
  });
}
export function signOutGoogle() {
  try { if (token && window.google) window.google.accounts.oauth2.revoke(token, () => {}); } catch { /* ignore */ }
  token = null; tokenExp = 0;
}

async function api(path, { method = 'GET', headers = {}, body, raw = false } = {}) {
  const t = await getToken();
  let r;
  try { r = await fetch('https://www.googleapis.com' + path, { method, headers: { Authorization: 'Bearer ' + t, ...headers }, body }); }
  catch { throw new Error('Couldn’t reach Google Drive. Check the connection.'); }
  if (r.status === 401) { token = null; throw new Error('Google sign-in expired. Tap again to sign in.'); }
  if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch { /* ignore */ } throw new Error(`Google Drive said: ${m || 'error ' + r.status}`); }
  return raw ? r : r.json();
}

/** The app's profile file in this Drive (newest), or null. */
async function findFile() {
  const q = encodeURIComponent("appProperties has { key='fretworkCoach' and value='profile' } and trashed=false");
  const j = await api(`/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,modifiedTime,webViewLink,size)`);
  return (j.files || [])[0] || null;
}

/** Save the profile to Drive (one file, updated in place). Returns {id, name, modifiedTime, webViewLink}. */
export async function saveToDrive(profile, { chooseAccount = false } = {}) {
  await getToken({ chooseAccount });
  const body = JSON.stringify(profile, null, 2);
  const existing = await findFile();
  let f;
  if (existing) {
    f = await api(`/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,name,modifiedTime,webViewLink`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  } else {
    const boundary = 'fc' + Math.random().toString(36).slice(2);
    const meta = { name: FILE_NAME, mimeType: 'application/json', appProperties: { fretworkCoach: 'profile' }, description: 'Fretwork Coach player profile. Open the app and use Settings → Load from Google Drive on another device.' };
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    f = await api('/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
  }
  rememberFile({ ...f, savedAt: Date.now() });
  return f;
}

/** Load the profile saved in this Drive. Returns {data, file} or throws when there is none. */
export async function loadFromDrive({ chooseAccount = false } = {}) {
  await getToken({ chooseAccount });
  const f = await findFile();
  if (!f) throw new Error('No Fretwork Coach profile in this Google account’s Drive yet. Save one from your other device first (Settings → Save to Google Drive).');
  const r = await api(`/drive/v3/files/${f.id}?alt=media`, { raw: true });
  const data = await r.json();
  rememberFile({ ...f, loadedAt: Date.now() });
  return { data, file: f };
}
