import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { AlphaToken, ScanSnapshot } from "@alpha-radar/shared";

const REPO_ROOT =
  process.env.REPO_ROOT || path.resolve(__dirname, "../../..");

const RPC_URL =
  process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

const RULES_PATH =
  process.env.RULES_PATH || path.join(REPO_ROOT, "rules.json");

function loadRules() {
  return JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
}

function pctTwoDecimals(n: bigint, d: bigint) {
  if (d === 0n) return null;
  const v = (n * 10000n) / d;
  return Number(v) / 100;
}

function riskLabel(score: number): "LOW" | "MED" | "HIGH" {
  if (score >= 8) return "HIGH";
  if (score >= 4) return "MED";
  return "LOW";
}

// Optional market data via DexScreener (best-effort)
async function fetchDexScreener(address: string) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const pair = j?.pairs?.[0];
    if (!pair) return null;
    return {
      liquidityUsd: pair.liquidity?.usd ?? null,
      volume24hUsd: pair.volume?.h24 ?? null
    };
  } catch {
    return null;
  }
}

async function analyzeSolana(token: AlphaToken): Promise<Partial<ScanSnapshot>> {
  const connection = new Connection(RPC_URL, "confirmed");
  const mintPub = new PublicKey(token.address);

  const mint = await getMint(connection, mintPub);

  const supplyRaw = BigInt(mint.supply.toString());
  const decimals = mint.decimals;

  const mintAuthority = mint.mintAuthority?.toBase58() ?? "(not set)";
  const freezeAuthority = mint.freezeAuthority?.toBase58() ?? "(not set)";

  const largest = await connection.getTokenLargestAccounts(mintPub);
  const top10 = largest.value.slice(0, 10).map(v => BigInt(v.amount));
  const top10Sum = top10.reduce((a, b) => a + b, 0n);
  const top10Pct = pctTwoDecimals(top10Sum, supplyRaw);

  const market = await fetchDexScreener(token.address);

  return {
    mintAuthority,
    freezeAuthority,
    supplyRaw: supplyRaw.toString(),
    decimals,
    top10Pct,
    liquidityUsd: market?.liquidityUsd ?? null,
    volume24hUsd: market?.volume24hUsd ?? null
  };
}

function scoreSnapshot(base: Partial<ScanSnapshot>, rules: any) {
  let score = 0;
  const flags: string[] = [];

  const mintAuth = base.mintAuthority;
  const freezeAuth = base.freezeAuthority;
  const top10Pct = base.top10Pct ?? null;
  const liquidityUsd = base.liquidityUsd ?? null;

  if (mintAuth && mintAuth !== "(not set)") {
    score += 5;
    flags.push("Mint authority is set (supply can change).");
  } else {
    flags.push("Mint authority not set (fixed supply).");
  }

  if (freezeAuth && freezeAuth !== "(not set)") {
    score += 3;
    flags.push("Freeze authority is set (accounts can be frozen).");
  } else {
    flags.push("Freeze authority not set.");
  }

  if (top10Pct !== null) {
    if (top10Pct >= 60) {
      score += 4;
      flags.push("Top 10 holders >= 60% (very concentrated).");
    } else if (top10Pct >= 40) {
      score += 2;
      flags.push("Top 10 holders >= 40% (concentrated).");
    } else {
      flags.push("Top 10 concentration looks moderate.");
    }
  }

  if (liquidityUsd !== null) {
    const minLiq = rules?.solana?.minLiquidityUsd ?? 0;
    if (liquidityUsd < minLiq) {
      score += 2;
      flags.push(`Liquidity < $${minLiq} (thin).`);
    } else {
      flags.push("Liquidity passes minimum threshold.");
    }
  } else {
    flags.push("Liquidity data unavailable (best-effort).");
  }

  const risk = riskLabel(score);
  return { score, risk, flags };
}

async function main() {
  const tokenJson = process.env.TOKEN_JSON;
  const tokenArg = process.argv[2];

  let token: AlphaToken;

  if (tokenJson) {
    token = JSON.parse(tokenJson);
  } else if (tokenArg) {
    token = { symbol: "UNKNOWN", chain: "solana", address: tokenArg };
  } else {
    console.error("Usage: npm run analyze -- <SOL_MINT> OR set TOKEN_JSON");
    process.exit(1);
  }

  const rules = loadRules();

  let base: Partial<ScanSnapshot> = {};
  if (token.chain === "solana") {
    base = await analyzeSolana(token);
  } else {
    base = await fetchDexScreener(token.address) ?? {};
  }

  const scored = scoreSnapshot(base, rules);

  const snapshot: ScanSnapshot = {
    source: "binance-alpha-manual",
    ts: new Date().toISOString(),
    token,
    ...base,
    riskScore: scored.score,
    risk: scored.risk,
    flags: scored.flags
  };

  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((e) => {
  console.error("Analyze failed:", e?.message ?? e);
  process.exit(1);
});
