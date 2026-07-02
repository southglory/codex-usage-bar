// codex-usage-bar — pure usage/cost logic (no vscode dependency, unit-testable).
// Reads OpenAI Codex session rollout logs for token usage and estimates cost.
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Expand ~ and env vars (%VAR% / ${env:VAR}) to a real path. */
function expandDir(dir) {
  let d = String(dir || '').trim();
  if (d === '~' || d.startsWith('~/') || d.startsWith('~\\')) d = path.join(os.homedir(), d.slice(1));
  d = d.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '')
       .replace(/\$\{?env:?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_, n) => process.env[n] || '');
  return path.normalize(d);
}

/** Local YYYY-MM-DD for an ISO timestamp. */
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Auto-detect `.codex*` dirs in home that contain a sessions/ folder. */
function discoverAccounts(home) {
  home = home || os.homedir();
  let entries;
  try { entries = fs.readdirSync(home, { withFileTypes: true }); } catch (e) { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith('.codex')) continue;
    if (fs.existsSync(path.join(home, e.name, 'sessions'))) out.push({ label: e.name, dir: path.join(home, e.name) });
  }
  return out;
}

const EMPTY = () => ({ input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 });
function add(a, b) {
  for (const k of Object.keys(EMPTY())) a[k] = (a[k] || 0) + (b[k] || 0);
  return a;
}

/** Recursively list rollout-*.jsonl under <dir>/sessions modified within `withinDays`. */
function _rolloutFiles(root, cutoff) {
  const out = [];
  const walk = (d) => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl') && e.name.startsWith('rollout-')) {
        try { if (fs.statSync(p).mtimeMs >= cutoff) out.push(p); } catch (e) {}
      }
    }
  };
  walk(root);
  return out;
}

/** Scan a Codex account dir's rollout logs. Each session's LAST token_count is its
 *  cumulative usage, attributed to that event's local day. Returns { byDay, total }. */
function scanUsage(dir, withinDays, now) {
  now = now || Date.now();
  const cutoff = now - (withinDays || 30) * 86400000;
  const res = { byDay: {}, total: EMPTY() };
  for (const file of _rolloutFiles(path.join(dir, 'sessions'), cutoff)) {
    let text; try { text = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    let lastUsage = null, lastTs = null;
    for (const line of text.split('\n')) {
      if (!line || line.indexOf('token_count') === -1) continue;
      let o; try { o = JSON.parse(line); } catch (e) { continue; }
      const info = o && o.payload && o.payload.type === 'token_count' && o.payload.info;
      if (info && info.total_token_usage) { lastUsage = info.total_token_usage; lastTs = o.timestamp; }
    }
    if (!lastUsage) continue;
    const key = dayKey(lastTs);
    res.byDay[key] = add(res.byDay[key] || EMPTY(), lastUsage);
    add(res.total, lastUsage);
  }
  return res;
}

/** Estimate USD from a token-usage object and per-million pricing.
 *  cached_input is a subset of input; reasoning is inside output — no double count. */
function cost(usage, pricing) {
  if (!usage) return 0;
  const inp = usage.input_tokens || 0;
  const cached = usage.cached_input_tokens || 0;
  const out = usage.output_tokens || 0;
  const p = pricing || {};
  return ((inp - cached) * (p.input || 0) + cached * (p.cachedInput || 0) + out * (p.output || 0)) / 1e6;
}

module.exports = { expandDir, dayKey, discoverAccounts, scanUsage, cost };
