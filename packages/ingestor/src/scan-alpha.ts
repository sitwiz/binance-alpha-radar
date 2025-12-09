import fs from "fs";
import path from "path";
import { AlphaToken } from "@alpha-radar/shared";
import { execSync } from "child_process";

// Compute repo root reliably even when run via npm workspaces
const REPO_ROOT =
  process.env.REPO_ROOT || path.resolve(__dirname, "../../..");

const ALPHA_LIST = path.join(REPO_ROOT, "alpha-list.json");
const OUT_DIR = path.join(REPO_ROOT, "data", "latest");

function loadAlphaTokens(): AlphaToken[] {
  const j = JSON.parse(fs.readFileSync(ALPHA_LIST, "utf8"));
  return j.tokens ?? [];
}

function ensureDirs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(REPO_ROOT, "data"), { recursive: true });
}

function runAnalyze(token: AlphaToken) {
  const tokenJson = JSON.stringify(token).replace(/"/g, '\\"');
  const cmd =
    `TOKEN_JSON="${tokenJson}" ` +
    `npm --workspace @alpha-radar/analyzer run analyze`;

  const out = execSync(cmd, { stdio: "pipe", encoding: "utf8" });
  return out;
}

function main() {
  ensureDirs();

  if (!fs.existsSync(ALPHA_LIST)) {
    console.error("Missing alpha-list.json at repo root:", ALPHA_LIST);
    process.exit(1);
  }

  const tokens = loadAlphaTokens();
  const results: any[] = [];

  for (const t of tokens) {
    try {
      const out = runAnalyze(t);
      const snap = JSON.parse(out);
      results.push(snap);

      const fname = `${t.chain}-${t.symbol || "unknown"}-${t.address}.json`
        .replace(/[^\w.-]+/g, "_");

      fs.writeFileSync(
        path.join(OUT_DIR, fname),
        JSON.stringify(snap, null, 2)
      );
    } catch (e: any) {
      results.push({
        ts: new Date().toISOString(),
        token: t,
        error: e?.message ?? String(e)
      });
    }
  }

  fs.writeFileSync(
    path.join(REPO_ROOT, "data", "alpha-latest.json"),
    JSON.stringify({ ts: new Date().toISOString(), results }, null, 2)
  );

  console.log(`Scanned ${tokens.length} Alpha tokens.`);
  console.log(`Wrote: data/alpha-latest.json and per-token snapshots in data/latest/`);
}

main();
