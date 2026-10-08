// Claude API spend tracking. Every Messages API reply includes the exact token
// counts it was billed for (input, output, cache writes, cache reads); this
// records them per day, model and feature, and prices them with Anthropic's
// published per-model rates. Anthropic's own cost report (the Admin API) can't
// be called from a browser, so this is the app's own ledger: it covers Claude
// requests made by Fretwork Coach in this browser, not other apps or devices
// that use the same key. Stored only in this browser, never in profile exports.

const STORE = 'fretworkCoach.apiUsage.v1';
const SETTINGS = 'fretworkCoach.billing';

// USD per million tokens: [input, 5-min cache write, 1-hour cache write, cache read, output]
// Source: platform.claude.com/docs/en/about-claude/pricing (October 2026).
export const PRICES_AS_OF = 'October 2026';
const PRICES = [
  [/^claude-sonnet-5-5/, 'Claude Sonnet 5.5', [2, 2.5, 4, 0.10, 10]],
  [/^claude-opus-5-5/, 'Claude Opus 5.5', [4, 5, 8, 0.20, 20]],
  [/^claude-haiku-4-5/, 'Claude Haiku 4.5', [1, 1.25, 2, 0.10, 5]],
  [/^claude-haiku-5-5/, 'Claude Haiku 5.5', [0.10, 0.125, 0.20, 0.01, 0.50], [0.50, 0.625, 1, 0.05, 2.50]], // second set: prompts over 100k tokens
  [/^claude-sonnet-5(?!-5)/, 'Claude Sonnet 5', [2, 2.5, 4, 0.20, 10]],
  [/^claude-opus-5(?!-5)/, 'Claude Opus 5', [5, 6.25, 10, 0.50, 25]],
  [/^claude-(fable|mythos)-5-1/, 'Claude Fable 5.1', [10, 12.5, 20, 0.25, 50]],
  [/^claude-(fable|mythos)-5(?!-1)/, 'Claude Fable 5', [10, 12.5, 20, 1, 50]],
  [/^claude-opus-4/, 'Claude Opus 4.x', [5, 6.25, 10, 0.50, 25]],
  [/^claude-sonnet-4/, 'Claude Sonnet 4.x', [3, 3.75, 6, 0.30, 15]]
];
export const FEATURE_LABEL = {
  'course-plan': 'Course plans', 'master-class': 'Master classes', 'course-name': 'Course names', briefing: 'Routine briefings', request: '“What do you want to work on?”',
  'song-info': 'Song details', 'song-recs': 'Song recommendations', 'song-lesson': 'Song lessons', 'tab-help': 'Tab section help',
  evaluation: 'Playing evaluations', players: 'Guitarist lookup', test: 'Connection tests', other: 'Other'
};

export function priceFor(model) {
  const hit = PRICES.find(([re]) => re.test(String(model || '')));
  return hit ? { name: hit[1], rates: hit[2], long: hit[3] || null, known: true } : { name: String(model || 'Unknown model'), rates: [3, 3.75, 6, 0.30, 15], long: null, known: false };
}

/** Cost in USD of one reply's usage object. */
export function costOf(model, u = {}) {
  const pr = priceFor(model);
  const input = u.input_tokens || 0, out = u.output_tokens || 0, read = u.cache_read_input_tokens || 0;
  const cc = u.cache_creation || {};
  const w1h = cc.ephemeral_1h_input_tokens || 0;
  const w5 = cc.ephemeral_5m_input_tokens != null ? cc.ephemeral_5m_input_tokens : Math.max(0, (u.cache_creation_input_tokens || 0) - w1h);
  const promptTokens = input + read + w5 + w1h;
  const r = pr.long && promptTokens > 100000 ? pr.long : pr.rates;
  let usd = (input * r[0] + w5 * r[1] + w1h * r[2] + read * r[3] + out * r[4]) / 1e6;
  if (u.inference_geo === 'us') usd *= 1.1;
  const st = u.server_tool_use || {};
  usd += (st.web_search_requests || 0) * 0.01;
  return { usd, input, out, read, write: w5 + w1h, known: pr.known };
}

/* ------------------------------- Ledger ------------------------------- */
function load() { try { return JSON.parse(localStorage.getItem(STORE) || 'null') || { v: 1, since: null, days: {} }; } catch { return { v: 1, since: null, days: {} }; } }
function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch { /* full */ } }
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Record one reply. Called by the Claude client after every successful request. */
export function recordUsage(model, usage, feature = 'other') {
  if (!usage) return null;
  const c = costOf(model, usage);
  const d = load();
  if (!d.since) d.since = dayKey();
  const day = d.days[dayKey()] || (d.days[dayKey()] = {});
  const k = `${model}|${feature || 'other'}`;
  const e = day[k] || (day[k] = { n: 0, in: 0, out: 0, read: 0, write: 0, usd: 0 });
  e.n++; e.in += c.input; e.out += c.out; e.read += c.read; e.write += c.write; e.usd = +(e.usd + c.usd).toFixed(6);
  // keep about 14 months of daily rows
  const keys = Object.keys(d.days).sort();
  if (keys.length > 430) keys.slice(0, keys.length - 430).forEach(x => delete d.days[x]);
  save(d);
  return c;
}
export function clearUsage() { try { localStorage.removeItem(STORE); } catch { /* ignore */ } }

/* --------------------------- Billing period --------------------------- */
export function billingDay() { try { const v = +JSON.parse(localStorage.getItem(SETTINGS) || '{}').day; return v >= 1 && v <= 28 ? v : 1; } catch { return 1; } }
export function setBillingDay(day) { try { localStorage.setItem(SETTINGS, JSON.stringify({ day: Math.max(1, Math.min(28, Math.round(+day) || 1)) })); } catch { /* ignore */ } }

/** {start, end} Date objects for the period containing `at` (end exclusive). */
export function periodFor(at = new Date(), day = billingDay()) {
  let start = new Date(at.getFullYear(), at.getMonth(), day);
  if (start > at) start = new Date(at.getFullYear(), at.getMonth() - 1, day);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day);
  return { start, end };
}

/** Totals for a period: overall, by model and by feature. */
export function summarize({ start, end }) {
  const d = load(), s = dayKey(start), e = dayKey(end);
  const total = { n: 0, in: 0, out: 0, read: 0, write: 0, usd: 0 }, byModel = {}, byFeature = {};
  const add = (t, x) => { t.n += x.n; t.in += x.in; t.out += x.out; t.read += x.read; t.write += x.write; t.usd += x.usd; };
  for (const [day, rows] of Object.entries(d.days)) {
    if (day < s || day >= e) continue;
    for (const [k, x] of Object.entries(rows)) {
      const [model, feature] = k.split('|');
      add(total, x);
      add(byModel[model] || (byModel[model] = { n: 0, in: 0, out: 0, read: 0, write: 0, usd: 0 }), x);
      add(byFeature[feature] || (byFeature[feature] = { n: 0, in: 0, out: 0, read: 0, write: 0, usd: 0 }), x);
    }
  }
  return { total, byModel, byFeature, since: d.since };
}
export const fmtUSD = v => (v > 0 && v < 0.01 ? '<$0.01' : '$' + (Math.round(v * 100) / 100).toFixed(2));
export const fmtTokens = n => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(n));
