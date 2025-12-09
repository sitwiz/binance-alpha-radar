import Database from "better-sqlite3";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || "./alpha-radar.sqlite";

if (!fs.existsSync(DB_PATH)) {
  fs.closeSync(fs.openSync(DB_PATH, "w"));
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    symbol TEXT NOT NULL,
    chain TEXT NOT NULL,
    address TEXT NOT NULL,

    mintAuthority TEXT,
    freezeAuthority TEXT,
    supplyRaw TEXT,
    decimals INTEGER,

    top10Pct REAL,
    liquidityUsd REAL,
    volume24hUsd REAL,

    riskScore INTEGER NOT NULL,
    risk TEXT NOT NULL,
    flags TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_addr_ts
  ON snapshots(address, ts);
`);

console.log("DB ready at:", DB_PATH);
