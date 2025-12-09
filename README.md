# Alpha Radar

Alpha Radar is a Binance Alpha meme coin scanner that prioritizes trust and structure over hype.
It analyzes mint/freeze authority, holder concentration, and best-effort liquidity signals, then writes snapshot + alert-ready JSON.
Built as a portfolio-grade trading intelligence system — not a pump tool.

## Demo (60 seconds)

This repo supports a privacy-first watchlist workflow.

- Your real list (private):
  - `alpha-list.local.json` (gitignored)
- Public example:
  - `alpha-list.sample.json`

To try the project:

```bash
cp alpha-list.sample.json alpha-list.local.json
npm install
npm run build:alpha-list
npm run scan:alpha
npm run watch

