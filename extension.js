// codex-usage-bar — token usage & estimated cost for every OpenAI Codex account
// in the VS Code status bar. Pure usage/cost logic lives in ./usage.js.
const vscode = require('vscode');
const os = require('os');
const { expandDir, dayKey, discoverAccounts, scanUsage, cost } = require('./usage.js');

const CFG = 'codexUsage';
// Breathing wallaby mascot — two glyphs from the bundled wallaby.ttf icon font.
const FRAMES = ['$(wallaby-0)', '$(wallaby-1)'];

function config() {
  const c = vscode.workspace.getConfiguration(CFG);
  let accounts = c.get('accounts') || [];
  if (!accounts.length) accounts = discoverAccounts(os.homedir());
  return {
    accounts,
    interval: Math.max(5, c.get('refreshIntervalSeconds', 30)) * 1000,
    pricing: {
      input: c.get('pricing.inputPerMillion', 1.25),
      cachedInput: c.get('pricing.cachedInputPerMillion', 0.125),
      output: c.get('pricing.outputPerMillion', 10),
    },
    showChar: c.get('showCharacter', true),
    anim: c.get('enableAnimation', true),
    animMs: Math.max(400, c.get('animationPeriodMs', 2000)),
  };
}

const fmtTok = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n || 0);
const usd = (n) => '$' + (n || 0).toFixed(n < 1 ? 3 : 2);

function sumDays(byDay, days, now) {
  const acc = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  for (let i = 0; i < days; i++) {
    const k = dayKey(new Date(now - i * 86400000).toISOString());
    const u = byDay[k]; if (!u) continue;
    acc.input_tokens += u.input_tokens || 0; acc.cached_input_tokens += u.cached_input_tokens || 0;
    acc.output_tokens += u.output_tokens || 0; acc.total_tokens += u.total_tokens || 0;
  }
  return acc;
}

class Bar {
  constructor() { this.items = []; this.frame = 0; this.timer = null; this.animTimer = null; }

  rebuild(n) {
    this.items.forEach((i) => i.dispose());
    this.items = [];
    for (let i = 0; i < n; i++) {
      const it = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100 - i);
      it.command = 'codexUsage.refresh';
      this.items.push(it);
    }
  }

  refresh() {
    const { accounts, pricing, showChar, anim } = config();
    if (accounts.length !== this.items.length) this.rebuild(accounts.length);
    const deco = (s) => (showChar ? FRAMES[anim ? (this.frame % FRAMES.length) : 0] + ' ' : '') + s;

    if (!accounts.length) {
      if (!this.items.length) this.rebuild(1);
      const it = this.items[0];
      it.text = deco('Codex: no accounts');
      it.tooltip = 'No `.codex*` accounts found. Set codexUsage.accounts or log in with Codex.';
      it.show();
      return;
    }

    const now = Date.now();
    accounts.forEach((acc, idx) => {
      const it = this.items[idx]; if (!it) return;
      const dir = expandDir(acc.dir);
      const label = acc.label || acc.dir;
      let u;
      try { u = scanUsage(dir, 30, now); } catch (e) { u = null; }
      if (!u) { it.text = deco(`${label} —`); it.tooltip = `Could not read ${dir}`; it.show(); return; }
      const today = u.byDay[dayKey(new Date(now).toISOString())] || {};
      const d7 = sumDays(u.byDay, 7, now);
      it.text = deco(`${label}: ${usd(cost(today, pricing))}`);
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**${label}** · OpenAI Codex usage\n\n`);
      md.appendMarkdown(`| window | tokens | est. cost |\n|---|--:|--:|\n`);
      md.appendMarkdown(`| today | ${fmtTok(today.total_tokens)} | ${usd(cost(today, pricing))} |\n`);
      md.appendMarkdown(`| 7 days | ${fmtTok(d7.total_tokens)} | ${usd(cost(d7, pricing))} |\n`);
      md.appendMarkdown(`| all logs | ${fmtTok(u.total.total_tokens)} | ${usd(cost(u.total, pricing))} |\n\n`);
      md.appendMarkdown(`_today: in ${fmtTok((today.input_tokens || 0) - (today.cached_input_tokens || 0))} · cached ${fmtTok(today.cached_input_tokens)} · out ${fmtTok(today.output_tokens)}_\n\n`);
      md.appendMarkdown(`_Cost is an estimate (tokens × configurable pricing), not your bill. Left-click to refresh._`);
      it.tooltip = md;
      it.show();
    });
  }

  tick() { this.frame++; this.refresh(); }

  start() {
    const { interval, anim, animMs } = config();
    this.refresh();
    this.timer = setInterval(() => this.refresh(), interval);
    if (anim) this.animTimer = setInterval(() => this.tick(), Math.max(200, Math.floor(animMs / FRAMES.length)));
  }

  restart() { this.dispose(); this.start(); }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    if (this.animTimer) clearInterval(this.animTimer);
    this.timer = this.animTimer = null;
    this.items.forEach((i) => i.dispose());
    this.items = [];
  }
}

function activate(context) {
  const bar = new Bar();
  bar.start();
  context.subscriptions.push(
    bar,
    vscode.commands.registerCommand('codexUsage.refresh', () => bar.refresh()),
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration(CFG)) bar.restart(); })
  );
}
function deactivate() {}
module.exports = { activate, deactivate };
