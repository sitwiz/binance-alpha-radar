import fs from "fs";
import path from "path";

type AlphaToken = {
  symbol?: string;
  chain: "solana" | "evm";
  address: string;
  notes?: string;
  privateNotes?: string;
  tags?: string[];
  [k: string]: any;
};

type AlphaList = {
  source?: string;
  updatedAt?: string;
  tokens: AlphaToken[];
};

const REPO_ROOT = path.resolve(__dirname, "..");
const LOCAL_PATH = path.join(REPO_ROOT, "alpha-list.local.json");
const PUBLIC_ROOT_PATH = path.join(REPO_ROOT, "alpha-list.json");
const PUBLIC_INGESTOR_PATH = path.join(REPO_ROOT, "packages", "ingestor", "alpha-list.json");

function mustReadLocal(): AlphaList {
  if (!fs.existsSync(LOCAL_PATH)) {
    console.error("Missing alpha-list.local.json:", LOCAL_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8"));
}

function sanitizeToken(t: AlphaToken): AlphaToken {
  const { privateNotes, tags, ...rest } = t;
  return {
    symbol: rest.symbol,
    chain: rest.chain,
    address: rest.address,
    notes: rest.notes
  };
}

function dedupe(tokens: AlphaToken[]) {
  const seen = new Set<string>();
  const out: AlphaToken[] = [];
  for (const t of tokens) {
    const key = `${t.chain}:${t.address}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function writeJson(p: string, obj: any) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function main() {
  const local = mustReadLocal();
  const tokens = dedupe((local.tokens ?? []).map(sanitizeToken));

  const pub: AlphaList = {
    source: "binance-alpha-manual",
    updatedAt: new Date().toISOString(),
    tokens
  };

  writeJson(PUBLIC_ROOT_PATH, pub);

  if (fs.existsSync(path.join(REPO_ROOT, "packages", "ingestor"))) {
    writeJson(PUBLIC_INGESTOR_PATH, pub);
  }

  console.log("Wrote public list:");
  console.log(" -", PUBLIC_ROOT_PATH);
  if (fs.existsSync(path.join(REPO_ROOT, "packages", "ingestor"))) {
    console.log(" -", PUBLIC_INGESTOR_PATH);
  }
  console.log("Tokens published:", tokens.length);
}

main();
