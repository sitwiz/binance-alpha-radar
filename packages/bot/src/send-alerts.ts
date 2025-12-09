import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const CHAT_ID = process.env.TG_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Set TG_BOT_TOKEN and TG_CHAT_ID");
  process.exit(1);
}

const ROOT = path.resolve(process.cwd());
const ALERTS_FILE = path.join(ROOT, "data", "alpha-alerts.json");

async function send(text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: CHAT_ID,
    text,
    disable_web_page_preview: true
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Telegram error: ${t}`);
  }
}

function formatAlert(a: any) {
  const t = a.token;
  const lines = [
    `ALPHA ALERT: ${t.symbol} (${t.chain})`,
    `Address: ${t.address}`,
    ...a.alerts.map((x: string) => `- ${x}`),
    `Risk: ${a.snapshot?.risk ?? "?"}`,
    `Top10%: ${a.snapshot?.top10Pct ?? "?"}`,
    `Liquidity$ (best-effort): ${a.snapshot?.liquidityUsd ?? "?"}`,
    `Volume24h$ (best-effort): ${a.snapshot?.volume24hUsd ?? "?"}`
  ];
  return lines.join("\n");
}

async function main() {
  if (!fs.existsSync(ALERTS_FILE)) {
    console.log("No alerts file yet. Run: npm run watch");
    return;
  }

  const j = JSON.parse(fs.readFileSync(ALERTS_FILE, "utf8"));
  const alerts = j.alerts ?? [];

  if (!alerts.length) {
    console.log("No alerts to send.");
    return;
  }

  for (const a of alerts) {
    const msg = formatAlert(a);
    await send(msg);
  }

  console.log(`Sent ${alerts.length} alert(s).`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
