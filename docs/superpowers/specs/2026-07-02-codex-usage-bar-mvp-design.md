# codex-usage-bar — MVP design

**Date:** 2026-07-02
**Repo:** codex-usage-bar (new)
**Status:** Approved design

## Goal

A VS Code status-bar extension that shows **token usage and estimated cost for
every OpenAI Codex account** (auto-detected, multi-account), mirroring the
structure of `claude-usage-bar` but for Codex's data model. MVP is **cost only** —
no rate-limit %, no API calls, no credential access.

## Background — Codex data model (verified on a real install, v0.142.5)

- Codex config/data dir defaults to `~/.codex`, relocatable via the **`CODEX_HOME`**
  env var (exactly analogous to Claude's `CLAUDE_CONFIG_DIR`) → enables multi-account.
- Per-account token usage lives in `<CODEX_HOME>/sessions/rollout-*.jsonl`. Each
  line is `{timestamp, type, payload}`; the usage events are
  `type:"event_msg"` with `payload.type:"token_count"` and
  `payload.info.total_token_usage = { input_tokens, cached_input_tokens,
  output_tokens, reasoning_output_tokens, total_tokens }` (cumulative per session),
  plus `last_token_usage` and `model_context_window`.
- Rate-limit / weekly-quota data is **NOT** in the rollout logs (it's fetched live
  from the API and cached in `logs_2.sqlite`). MVP does not use it.
- `auth.json` holds credentials (`auth_mode`, `tokens`/`OPENAI_API_KEY`). **MVP does
  not read it.**

## Decisions

1. **Multi-account, cost only.** Status bar shows each account's estimated spend
   today; token detail in the hover tooltip. No rate-limit, no API, no `auth.json`.
2. **Accounts** = auto-detected `.codex*` dirs in the home folder (when the config
   list is empty), or an explicit configured list `{ label, dir }` with
   `~`/`%VAR%`/`${env:VAR}` expansion. Mirrors claude-usage-bar.
3. **Usage source** = scan `<dir>/sessions/rollout-*.jsonl`, take the **last**
   `token_count` per session as that session's cumulative usage, attribute it to the
   session's local day, and aggregate (today / last 7d / total). Scan only files
   modified within the last 30 days (bound work).
4. **Cost** = configurable OpenAI per-million rates: `input`, `cachedInput`,
   `output`. In Codex's data `total_tokens = input_tokens + output_tokens`, where
   `cached_input_tokens` is a **subset** of `input_tokens` and
   `reasoning_output_tokens` is a **subset** of `output_tokens`. So (no
   double-counting):
   `cost = (input_tokens − cached_input_tokens) × input + cached_input_tokens ×
   cachedInput + output_tokens × output` (all per-million). Defaults follow a
   current Codex model price.
5. **Wallaby mascot** — a fixed 2-frame breathing pixel mascot (its own bundled
   icon font, sibling to claude-usage-bar's quokka). Toggles only: `showCharacter`,
   `enableAnimation`, `animationPeriodMs`. **No** mascot-maker, **no** custom frames.
6. **Fresh minimal `extension.js`** — reuse proven patterns from claude-usage-bar
   (account detect, by-day scan, status-bar items, animation timer) but carry only
   what the MVP needs (no cache file, no API, no dashboard webview).

## Architecture

Single `extension.js` (CommonJS), plus a bundled `wallaby.ttf` icon font.

### Units

- **`expandDir(dir)`** — `~`/`%VAR%`/`${env:VAR}` → absolute (port from claude-usage-bar).
- **`discoverAccounts()`** — list `.codex*` dirs under `os.homedir()` that contain a
  `sessions/` folder. Returns `[{ label: folderName, dir }]`.
- **`scanUsage(dir, withinDays)`** — walk `<dir>/sessions/**/rollout-*.jsonl`
  (mtime within window), read each file's last `token_count` event, bucket
  `total_token_usage` by local day. Returns `{ byDay: {yyyy-mm-dd: usage}, total }`.
- **`cost(usage, pricing)`** — dollars from a `total_token_usage` object.
- **`Bar`** class — one `StatusBarItem` per account; `refresh()` scans + renders
  `«mascot» <label>: $today`; tooltip shows today / 7d / total tokens + cost; a
  `setInterval` refresh (default 30s) and the mascot animation timer.

### Config (`codexUsage.*`)

`accounts` (array of `{label, dir}`, default `[]` = auto-detect) ·
`refreshIntervalSeconds` (30) · `pricing.inputPerMillion` · `pricing.cachedInputPerMillion` ·
`pricing.outputPerMillion` · `showCharacter` (true) · `enableAnimation` (true) ·
`animationPeriodMs` (2000).

### Commands

`codexUsage.refresh` (also the left-click action).

## Data flow

```
refresh (30s / click)
  └─ for each account dir:
       scanUsage(dir) → today's total_token_usage
       cost(today, pricing) → $today
       render  «wallaby»  .codex: $0.42
       tooltip: today 120K · 7d 2.1M · total 9.8M (input/cached/output split)
```

## Error handling

- No `sessions/` or unreadable dir → show `<label> —` (no data), no crash.
- Malformed JSONL line → skip that line.
- No accounts detected → single "No Codex accounts" item with a hint.

## Testing

- **Node unit tests** (`test/scan.test.js`, temp `HOME`/dirs, no VS Code):
  - `scanUsage` sums the last `token_count` per session and buckets by day.
  - `cost` computes input/cached/output correctly: non-cached input at `input`,
    `cached_input_tokens` at `cachedInput`, `output_tokens` at `output` (reasoning
    already inside output — not double-counted).
  - `discoverAccounts` finds `.codex*` dirs with a `sessions/` folder, ignores others.
  - `expandDir` handles `~`/`%VAR%`/`${env:VAR}`.
- **Manual** (F5): status bar shows the real `~/.codex` account's today cost; tooltip
  detail; mascot animates; toggles work.

## Out of scope (YAGNI, later versions)

- Rate-limit % / weekly-quota (needs `logs_2.sqlite` or API via `access_token`).
- Any `auth.json` / credential access or network calls.
- Full dashboard webview, per-project/burn-rate analytics.
- cc-switch Codex integration, mascot-maker / custom frames.

## Identity

Publisher `QG-devramyun`; id `codex-usage-bar`; displayName **"Codex Multi-Account
Usage"**; MIT; sibling project to `claude-usage-bar`.
