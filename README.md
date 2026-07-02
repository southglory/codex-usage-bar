# Codex Multi-Account Usage

> Token usage & estimated cost for **every OpenAI Codex account** — in your VS Code status bar.

Sibling to [Claude Multi-Account Status Bar](https://github.com/southglory/claude-usage-bar):
same idea, for **OpenAI Codex**. It reads each account's session logs locally (no
network calls, no credentials) and shows today's estimated spend per account.

**Today's spend, right in the status bar** (with a breathing 🦘 wallaby):

![Codex account in the status bar](images/statusbar.png)

**Hover for tokens & cost — today / 7 days / all logs:**

![Hover tooltip: window, tokens, estimated cost](images/tooltip.png)

## Features

- **N accounts, side by side** — leave the list empty and it auto-detects `.codex*`
  dirs in your home (each is a `CODEX_HOME`). Labels are the folder name as-is.
- **Token cost** — today / 7-day / all-logs tokens and estimated cost in the hover
  tooltip; today's spend on the status bar.
- **Local & private** — reads only `<CODEX_HOME>/sessions/rollout-*.jsonl` token
  counts. **No API calls, no `auth.json`/credential access.**
- **Breathing wallaby mascot** — a tiny mascot before each account (toggle off if you like).

## Data source

Per account, usage comes from `<CODEX_HOME>/sessions/rollout-*.jsonl`: the `token_count`
events (`total_token_usage`) are summed by day. Cost is computed client-side from
configurable per-million rates.

> **Cost is an estimate**, not your bill — it's the API-equivalent value of your exact
> token counts. Adjust `codexUsage.pricing.*` to match current OpenAI pricing.

## Configure (`settings.json`)

```jsonc
"codexUsage.accounts": [
  { "label": ".codex",      "dir": "~/.codex" },
  { "label": ".codex-work", "dir": "~/.codex-work" }
  // leave empty to auto-detect
],
"codexUsage.refreshIntervalSeconds": 30,
"codexUsage.pricing.inputPerMillion": 1.25,
"codexUsage.pricing.cachedInputPerMillion": 0.125,
"codexUsage.pricing.outputPerMillion": 10
```

`dir` is each account's `CODEX_HOME` (`~`, `%VAR%`, `${env:VAR}` expand). Left-click an
item to refresh.

## Multi-account, the Codex way

Codex reads its config/data from the dir named by **`CODEX_HOME`** (default `~/.codex`) —
just like Claude Code's `CLAUDE_CONFIG_DIR`. Run Codex with different `CODEX_HOME`
values (`~/.codex`, `~/.codex-work`, …) and each gets its own login; this extension
shows them all.

## Not included (yet)

Rate-limit / weekly-quota %, API calls, and a full cost dashboard are out of scope for
now — this is a focused, local, cost-only first version.

## License

[MIT](LICENSE) © southglory. Codex is a product of OpenAI; this is an unofficial,
independent tool.
