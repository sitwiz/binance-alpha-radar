import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const REPO_ROOT =
  process.env.REPO_ROOT || path.resolve(__dirname, "../../..");

const RULES_PATH = path.join(REPO_ROOT, "rules.json");
const STATE_FILE = path.join(REPO_ROOT, "data", "alpha-state.json");
const ALERTS_FILE = path.join(REPO_ROOT, "data", "alpha-alerts.json");

function loadRules() {
  if (!fs.existsSync(RULES_PATH)) {
    console.error("Missing rules.json at repo root:", RULES_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
}

function loadLatest() {
  const p = path.join(REPO_ROOT, "data", "alpha-latest.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(s: any) {
  fs.mkdirSync(path.join(REPO_ROOT, "data"), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function shouldAlert(prev: any, cur: any, RULES: any) {
  const alerts: string[] = [];
  const a = RULES.alerts ?? {};

  if (prev?.top10Pct != null && cur?.top10Pct != null) {
    const delta = cur.top10Pct - prev.top10Pct;
    if (delta >= (a.top10JumpPct ?? 10)) {
      alerts.push(`Top10 concentration jumped +${delta.toFixed(2)}%`);
    }
  }

  if (prev?.liquidityUsd != null && cur?.liquidityUsd != null) {
    const drop = ((prev.liquidityUsd - cur.liquidityUsd) / prev.liquidityUsd) * 100;
    if (drop >= (a.liquidityDropPct ?? 30)) {
      alerts.push(`Liquidity dropped ~${drop.toFixed(1)}%`);
    }
  }

  if (cur?.risk === "HIGH") {
    alerts.push(`Risk is HIGH`);
  }

  return alerts;
}

function main() {
  const RULES = loadRules();

  // ensure latest scan exists by running scan first
  execSync("npm run scan:alpha", { stdio: "inherit", cwd: REPO_ROOT });

  const latest = loadLatest();
  const state = loadState();

  const alertsOut: any[] = [];

  for (const item of latest?.results ?? []) {
    if (!item?.token?.address) continue;
    const addr = item.token.address;

    const prev = state[addr];
    const cur = item;

    const alerts = shouldAlert(prev, cur, RULES);
    if (alerts.length) {
      alertsOut.push({
        token: item.token,
        alerts,
        snapshot: cur
      });
    }

    state[addr] = cur;
  }

  saveState(state);

  fs.writeFileSync(
    ALERTS_FILE,
    JSON.stringify({ ts: new Date().toISOString(), alerts: alertsOut }, null, 2)
  );

  console.log(`Alerts: ${alertsOut.length}`);
  console.log("Wrote: data/alpha-alerts.json");
}

main();
