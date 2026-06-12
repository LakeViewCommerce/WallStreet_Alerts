// Service worker: fetches quotes via Cloudflare Worker proxy (API key stored as CF secret)

const POLL_INTERVAL_MINUTES = 0.5;
const DEFAULT_PROXY_URL = 'https://stock-alerts-proxy.lakeviewmiami.workers.dev';

async function getProxyBase() {
  const { proxyUrl } = await chrome.storage.sync.get('proxyUrl');
  return (proxyUrl ? proxyUrl.replace(/\/$/, '') : null) || DEFAULT_PROXY_URL;
}

// ── Alarm setup ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pollAlerts', { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollAlerts') checkAllAlerts();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('pollAlerts', { periodInMinutes: POLL_INTERVAL_MINUTES });
  checkAllAlerts();
});

// ── Main polling loop ─────────────────────────────────────────────────────────

async function checkAllAlerts() {
  const { alerts } = await chrome.storage.sync.get('alerts');
  if (!alerts || alerts.length === 0) return;
  const base = await getProxyBase();
  if (!base) return; // Worker URL not configured yet

  const bySymbol = {};
  for (const alert of alerts) {
    if (!alert.enabled) continue;
    if (!bySymbol[alert.symbol]) bySymbol[alert.symbol] = [];
    bySymbol[alert.symbol].push(alert);
  }

  for (const [symbol, symbolAlerts] of Object.entries(bySymbol)) {
    try {
      const quote = await fetchQuote(base, symbol);
      if (!quote) continue;
      await saveQuoteCache(symbol, quote);
      for (const alert of symbolAlerts) await evaluateAlert(base, alert, quote);
    } catch (e) {
      console.error(`Error processing ${symbol}:`, e);
    }
  }
}

// ── API helpers (sin API key — el Worker la inyecta) ─────────────────────────

async function fetchQuote(base, symbol) {
  const res = await fetch(`${base}/quote?symbol=${symbol}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchCandles(base, symbol, resolution = 'D', count = 50) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - count * 24 * 3600;
  const res = await fetch(`${base}/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.s !== 'ok') return null;
  return data;
}

async function fetchVolume(base, symbol) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 3600;
  const res = await fetch(`${base}/candle?symbol=${symbol}&resolution=1&from=${from}&to=${to}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.s !== 'ok' || !data.v || data.v.length === 0) return null;
  return data.v.reduce((a, b) => a + b, 0);
}

// ── Indicator calculations ────────────────────────────────────────────────────

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + (gains / period) / avgLoss);
}

function calcEMA(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) ema = values[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return null;
  const macdValues = [];
  for (let i = 26; i <= closes.length; i++) {
    const e12 = calcEMA(closes.slice(0, i), 12);
    const e26 = calcEMA(closes.slice(0, i), 26);
    if (e12 !== null && e26 !== null) macdValues.push(e12 - e26);
  }
  const signal = calcEMA(macdValues, 9);
  const macdLine = ema12 - ema26;
  return { macd: macdLine, signal, histogram: signal !== null ? macdLine - signal : null };
}

// ── Alert evaluation ──────────────────────────────────────────────────────────

async function evaluateAlert(base, alert, quote) {
  const { c: price, dp: changePercent } = quote;
  const now = Date.now();
  const cooldownKey = `cooldown_${alert.id}`;
  const stored = await chrome.storage.local.get(cooldownKey);
  if (stored[cooldownKey] && now - stored[cooldownKey] < 5 * 60 * 1000) return;

  let triggered = false, message = '';

  switch (alert.type) {
    case 'price_above':
      if (price >= alert.value) { triggered = true; message = `${alert.symbol} superó $${alert.value} → Precio actual: $${price.toFixed(2)}`; }
      break;
    case 'price_below':
      if (price <= alert.value) { triggered = true; message = `${alert.symbol} bajó de $${alert.value} → Precio actual: $${price.toFixed(2)}`; }
      break;
    case 'change_above':
      if (changePercent >= alert.value) { triggered = true; message = `${alert.symbol} subió +${changePercent.toFixed(2)}% hoy (umbral: +${alert.value}%)`; }
      break;
    case 'change_below':
      if (changePercent <= -Math.abs(alert.value)) { triggered = true; message = `${alert.symbol} cayó ${changePercent.toFixed(2)}% hoy (umbral: -${alert.value}%)`; }
      break;
    case 'volume': {
      const volume = await fetchVolume(base, alert.symbol);
      if (volume !== null && volume >= alert.value) { triggered = true; message = `${alert.symbol} volumen inusual: ${formatVolume(volume)} en la última hora`; }
      break;
    }
    case 'rsi': {
      const candles = await fetchCandles(base, alert.symbol, 'D', 30);
      if (candles) {
        const rsi = calcRSI(candles.c);
        if (rsi !== null) {
          if (alert.rsiCondition === 'overbought' && rsi >= alert.value) { triggered = true; message = `${alert.symbol} RSI sobrecomprado: ${rsi.toFixed(1)} (umbral: ${alert.value})`; }
          else if (alert.rsiCondition === 'oversold' && rsi <= alert.value) { triggered = true; message = `${alert.symbol} RSI sobrevendido: ${rsi.toFixed(1)} (umbral: ${alert.value})`; }
        }
      }
      break;
    }
    case 'macd': {
      const candles = await fetchCandles(base, alert.symbol, 'D', 50);
      if (candles) {
        const result = calcMACD(candles.c);
        if (result && result.histogram !== null) {
          if (alert.macdSignal === 'bullish' && result.macd > result.signal) { triggered = true; message = `${alert.symbol} cruce MACD alcista → MACD: ${result.macd.toFixed(3)}, Señal: ${result.signal.toFixed(3)}`; }
          else if (alert.macdSignal === 'bearish' && result.macd < result.signal) { triggered = true; message = `${alert.symbol} cruce MACD bajista → MACD: ${result.macd.toFixed(3)}, Señal: ${result.signal.toFixed(3)}`; }
        }
      }
      break;
    }
  }

  if (triggered) {
    sendNotification(alert.symbol, message);
    await chrome.storage.local.set({ [cooldownKey]: now });
  }
}

function sendNotification(symbol, message) {
  chrome.notifications.create(`alert_${symbol}_${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.jpg',
    title: `📈 Alerta: ${symbol}`,
    message,
    priority: 2
  });
}

function formatVolume(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}

async function saveQuoteCache(symbol, quote) {
  await chrome.storage.local.set({ [`cache_${symbol}`]: { ...quote, updatedAt: Date.now() } });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'forceCheck') {
    checkAllAlerts().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.action === 'testNotification') {
    sendNotification('TEST', 'Las notificaciones funcionan correctamente.');
    sendResponse({ ok: true });
  }
});
