import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type AlphaToken = {
  symbol: string;
  chain: "solana";
  address: string;
  notes?: string;
};

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, data: any) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function repoRootFromHere() {
  // __dirname = .../packages/ingestor/src
  return path.resolve(__dirname, "../../..");
}

function loadAlphaTokens(listPath: string): AlphaToken[] {
  const obj = readJson<{ tokens: AlphaToken[] }>(listPath);
  if (!obj?.tokens?.length) return [];
  return obj.tokens;
}

function runAnalyzer(repoRoot: string, token: AlphaToken) {
  const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");
  const analyzePath = path.join(repoRoot, "packages", "analyzer", "src", "analyze.ts");

  const env = {
    ...process.env,
    TOKEN_JSON: JSON.stringify(token),
  };

  const out = execFileSync(tsxBin, [analyzePath], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return JSON.parse(out);
}

async function main() {
  const repoRoot = repoRootFromHere();

  const listPath = path.join(repoRoot, "packages", "ingestor", "alpha-list.json");
  const tokens = loadAlphaTokens(listPath);

  const dataDir = path.join(repoRoot, "data");
  const latestDir = path.join(dataDir, "latest");

  fs.mkdirSync(latestDir, { recursive: true });

  const results: any[] = [];

  for (const token of tokens) {
    const entryBase = { ts: new Date().toISOString(), token };

    try {
      const snapshot = runAnalyzer(repoRoot, token);

      // Write per-token latest snapshot
      const perTokenPath = path.join(latestDir, `${token.address}.json`);
      writeJson(perTokenPath, snapshot);

      results.push({ ...entryBase, snapshot });
    } catch (e: any) {
      results.push({
        ...entryBase,
        error: e?.message ?? String(e),
      });
    }
  }

  const latestPath = path.join(dataDir, "alpha-latest.json");
  writeJson(latestPath, { ts: new Date().toISOString(), results });

  console.log(`Scanned ${tokens.length} Alpha tokens.`);
  console.log(`Wrote: data/alpha-latest.json and per-token snapshots in data/latest/`);
}

main().catch((e) => {
  console.error("scan-alpha failed:", e?.message ?? e);
  process.exit(1);
});
