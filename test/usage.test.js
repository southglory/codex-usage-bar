const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expandDir, discoverAccounts, scanUsage, cost, dayKey } = require('../usage.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-'));
let n = 0; const ok = (c, m) => { console.log((c ? 'ok' : 'NOT OK') + ' - ' + m); if (!c) process.exitCode = 1; n++; };

// --- build a fake ~/.codex account with rollout sessions ---
const home = path.join(tmp, 'home');
const acc = path.join(home, '.codex');
fs.mkdirSync(path.join(acc, 'sessions', '2026'), { recursive: true });
const tc = (ts, inp, cache, out, reas) => JSON.stringify({
  timestamp: ts, type: 'event_msg',
  payload: { type: 'token_count', info: { total_token_usage: {
    input_tokens: inp, cached_input_tokens: cache, output_tokens: out,
    reasoning_output_tokens: reas, total_tokens: inp + out } } }
});
const other = JSON.stringify({ timestamp: '2026-07-02T01:00:00Z', type: 'response_item', payload: {} });
// session A (nested), last token_count = 300/150/30
fs.writeFileSync(path.join(acc, 'sessions', '2026', 'rollout-a.jsonl'),
  [other, tc('2026-07-02T02:00:00Z', 100, 50, 10, 3), tc('2026-07-02T03:00:00Z', 300, 150, 30, 9)].join('\n'));
// session B (another day)
fs.mkdirSync(path.join(acc, 'sessions', 'sub'), { recursive: true });
fs.writeFileSync(path.join(acc, 'sessions', 'sub', 'rollout-b.jsonl'),
  [tc('2026-07-01T10:00:00Z', 200, 0, 20, 0)].join('\n'));
// noise: a .codex dir without sessions, and a .claude dir
fs.mkdirSync(path.join(home, '.codex-empty'), { recursive: true });
fs.mkdirSync(path.join(home, '.claude'), { recursive: true });

// --- discoverAccounts ---
const accts = discoverAccounts(home);
ok(accts.some(a => a.label === '.codex') && !accts.some(a => a.label === '.codex-empty') && !accts.some(a => a.label === '.claude'),
  'discovers .codex with sessions/, ignores dirs without sessions and non-codex');

// --- scanUsage (tz-robust: expected day keys via dayKey) ---
const u = scanUsage(acc, 3650, Date.parse('2026-07-02T12:00:00Z'));
const dA = dayKey('2026-07-02T03:00:00Z'); const dB = dayKey('2026-07-01T10:00:00Z');
ok(u.byDay[dA].input_tokens === 300 && u.byDay[dA].output_tokens === 30, 'session A day = its last token_count (300/30)');
ok(u.byDay[dB].input_tokens === 200, 'session B day = 200');
ok(u.total.input_tokens === 500 && u.total.output_tokens === 50, 'total sums both sessions');

// --- cost: (input-cached)*in + cached*cin + output*out (per million) ---
const c = cost({ input_tokens: 1000000, cached_input_tokens: 400000, output_tokens: 200000 },
  { input: 2, cachedInput: 0.5, output: 8 });
// 0.6*2 + 0.4*0.5 + 0.2*8 = 1.2 + 0.2 + 1.6 = 3.0
ok(Math.abs(c - 3.0) < 1e-9, 'cost = 3.0 (no double-count of cached/reasoning)');

// --- expandDir ---
ok(expandDir('~/x').startsWith(os.homedir()), 'expandDir expands ~');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n} assertions`);
