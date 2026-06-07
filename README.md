# WallStreet Alerts — Chrome Extension

Chrome extension for real-time stock price alerts for NYSE/NASDAQ tickers.

## Features

- **Price alert** — triggers when a stock crosses a defined price threshold
- **Daily change %** — triggers when the day's % change exceeds a limit
- **Unusual volume** — triggers when the last-hour volume is abnormally high
- **RSI** — triggers when RSI signals overbought or oversold conditions
- **MACD** — triggers on bullish or bearish crossovers

## Architecture

```
Chrome Extension → Cloudflare Worker → Finnhub API
```

The Finnhub API key is never stored in the extension. It lives encrypted in Cloudflare Workers as a secret.

## Installation (developer mode)

1. Clone or download this repository
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the project folder

## Cloudflare Worker setup

```bash
# Deploy the worker
wrangler deploy

# Set your Finnhub API key as a secret
wrangler secret put FINNHUB_API_KEY
```

Then paste your worker URL into the extension's Options page.

## Tech stack

- Chrome Extension Manifest V3
- Cloudflare Workers
- [Finnhub API](https://finnhub.io) (free tier)
- Vanilla JavaScript (zero dependencies)

## License

MIT
