// Claude API client. Calls the Messages API directly from the browser with the
// user's own key. The key lives only in this browser's localStorage and is never
// written into the exported profile.
import { recordUsage } from './usage.js';
import { cleanKey, storeKey, fingerprint, networkAdvice } from './keys.js';

const KEY_STORE = 'fretworkCoach.anthropicKey';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recommended)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (deepest, slower)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest, cheapest)' }
];
export const QUICK_MODEL = 'claude-haiku-4-5-20251001';

export class ClaudeError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const Claude = {
  model: 'claude-sonnet-5-5',
  // Keys are cleaned on the way in and out, so one saved with a stray space,
  // line break or hidden character (common when pasting on a phone) still works.
  getKey() { try { return cleanKey(localStorage.getItem(KEY_STORE) || '', 'anthropic'); } catch { return ''; } },
  /** Save (or remove, when empty) the key. Returns { ok, reason, key } with the cleaned key. */
  setKey(k) { const key = cleanKey(k, 'anthropic'); return { ...storeKey(KEY_STORE, key), key }; },
  hasKey() { return !!this.getKey(); },

  /**
   * Send a request. `content` may be a string or an array of content blocks.
   * images: [{mediaType, data(base64)}] are prepended to the user turn.
   */
  async message({ system, content, messages, maxTokens = 1500, model, images = [], signal, feature = 'other', withMeta = false } = {}) {
    const key = this.getKey();
    if (!key) throw new ClaudeError('no_key', 'Add your Anthropic API key in Settings to use Claude features.');
    let msgs = messages;
    if (!msgs) {
      const blocks = [];
      for (const img of images) blocks.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.data } });
      blocks.push({ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content) });
      msgs = [{ role: 'user', content: blocks }];
    }
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST', signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: model || this.model, max_tokens: maxTokens, system, messages: msgs })
      });
    } catch (e) {
      if (e.name === 'AbortError') throw new ClaudeError('cancelled', 'Cancelled.');
      throw new ClaudeError('network', networkAdvice('Claude (api.anthropic.com)'));
    }
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.error && j.error.message || ''; } catch { /* ignore */ }
      const map = { 400: 'bad_request', 401: 'bad_key', 403: 'forbidden', 404: 'bad_model', 429: 'rate_limited', 529: 'overloaded' };
      const friendly = {
        401: `Anthropic rejected this key (${fingerprint(key, 'anthropic')}). Compare it with the key that works on your other device, or paste it again in Settings.`,
        403: 'This API key does not have access to that model.',
        404: 'That model is not available on your key. Pick another in Settings.',
        429: 'Rate limited by the API. Wait a moment and try again.',
        529: 'Claude is busy right now. Try again shortly.'
      };
      throw new ClaudeError(map[res.status] || 'http_' + res.status, friendly[res.status] || `Claude error ${res.status}: ${detail}`);
    }
    const data = await res.json();
    // the reply carries the exact tokens it was billed for; keep the spend ledger
    try { recordUsage(data.model || model || this.model, data.usage, feature); } catch { /* never block a reply */ }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    // withMeta: also say whether the reply hit max_tokens (cut off before it finished)
    return withMeta ? { text, stop: data.stop_reason || null } : text;
  },

  /** Ask for JSON and parse the first JSON object/array in the reply. */
  async json(opts) {
    const system = (opts.system ? opts.system + '\n\n' : '') +
      'Respond with valid JSON only: no prose, no markdown fences.';
    const r = await this.message(Object.assign({}, opts, { system, withMeta: true }));
    const text = typeof r === 'string' ? r : r && r.text, stop = r && typeof r === 'object' ? r.stop : null;
    try { return parseJSON(text); }
    catch (e) {
      if (stop === 'max_tokens') throw new ClaudeError('cut_off', 'Claude’s answer was too long and got cut off before it finished.');
      throw e;
    }
  }
};

export function parseJSON(text) {
  const t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.search(/[[{]/);
  if (start < 0) throw new ClaudeError('bad_json', 'Claude returned an unexpected answer.');
  const open = t[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, escNext = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (escNext) escNext = false; else if (c === '\\') escNext = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try { return JSON.parse(t.slice(start, i + 1)); } catch { break; }
    }
  }
  throw new ClaudeError('bad_json', 'Claude returned an unexpected answer.');
}
