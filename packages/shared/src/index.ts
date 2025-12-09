export type AlphaToken = {
  symbol: string;
  name?: string;
  chain: "solana" | "evm" | "unknown";
  address: string; // mint on Solana, contract on EVM
  tags?: string[];
};

export type ScanSnapshot = {
  source: "binance-alpha-manual";
  ts: string;

  token: AlphaToken;

  // trust
  mintAuthority?: string | "(not set)" | null;
  freezeAuthority?: string | "(not set)" | null;
  supplyRaw?: string | null;
  decimals?: number | null;

  // concentration
  top10Pct?: number | null;

  // market/liquidity (from external aggregators)
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;

  // derived
  riskScore: number;
  risk: "LOW" | "MED" | "HIGH";
  flags: string[];
};
