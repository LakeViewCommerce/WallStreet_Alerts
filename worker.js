// Cloudflare Worker — proxy para Finnhub
// Deploy: wrangler deploy
// Secret:  wrangler secret put FINNHUB_API_KEY

const FINNHUB = 'https://finnhub.io/api/v1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const endpoint = url.pathname.replace(/^\//, '');   // "quote" | "candle"
    const params = new URLSearchParams(url.search);

    const allowed = ['quote', 'candle'];
    if (!allowed.includes(endpoint)) {
      return json({ error: 'endpoint not allowed' }, 400);
    }

    params.set('token', env.FINNHUB_API_KEY);
    const finnhubUrl = endpoint === 'quote'
      ? `${FINNHUB}/quote?${params}`
      : `${FINNHUB}/stock/candle?${params}`;

    const res = await fetch(finnhubUrl, {
      headers: { 'User-Agent': 'StockAlertsExtension/1.0' },
    });

    const data = await res.json();
    return json(data, res.status);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
