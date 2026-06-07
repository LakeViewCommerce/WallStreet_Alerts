const TYPE_LABELS = {
  price_above: 'Precio ≥ $',
  price_below: 'Precio ≤ $',
  change_above: 'Variación % ≥ ',
  change_below: 'Caída % ≥ ',
  volume:       'Volumen/hora ≥ ',
  rsi:          'RSI ',
  macd:         'MACD '
};

let alerts = [];

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadAlerts();
  await loadPrices();
  checkApiKey();
  bindEvents();
});

async function loadAlerts() {
  const data = await chrome.storage.sync.get('alerts');
  alerts = data.alerts || [];
  renderAlerts();
}

async function loadPrices() {
  const symbols = [...new Set((alerts).map(a => a.symbol))];
  if (symbols.length === 0) return;

  const keys = symbols.map(s => `cache_${s}`);
  const cached = await chrome.storage.local.get(keys);

  const pricesList = document.getElementById('pricesList');
  const items = symbols
    .map(s => cached[`cache_${s}`] ? renderPriceItem(s, cached[`cache_${s}`]) : null)
    .filter(Boolean);

  pricesList.innerHTML = items.length > 0
    ? items.join('')
    : '<div class="empty-state">Sin datos aún.</div>';
}

async function checkApiKey() {
  const { proxyUrl } = await chrome.storage.sync.get('proxyUrl');
  document.getElementById('noProxyUrl').classList.toggle('hidden', !!proxyUrl);
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('selectType').addEventListener('change', onTypeChange);
  document.getElementById('btnAddAlert').addEventListener('click', onAddAlert);
  document.getElementById('btnRefresh').addEventListener('click', onRefresh);
  document.getElementById('btnOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('linkOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('btnTest').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'testNotification' });
  });
}

function onTypeChange() {
  const type = document.getElementById('selectType').value;
  document.getElementById('paramPrice').classList.toggle('hidden', ['rsi', 'macd'].includes(type));
  document.getElementById('paramRsi').classList.toggle('hidden', type !== 'rsi');
  document.getElementById('paramMacd').classList.toggle('hidden', type !== 'macd');
}

async function onAddAlert() {
  const symbol = document.getElementById('inputSymbol').value.trim().toUpperCase();
  const type = document.getElementById('selectType').value;
  const errorEl = document.getElementById('formError');

  errorEl.classList.add('hidden');

  if (!symbol) return showError('Ingresa un símbolo (ej: AAPL).');

  const alert = { id: Date.now().toString(), symbol, type, enabled: true };

  if (!['rsi', 'macd'].includes(type)) {
    const val = parseFloat(document.getElementById('inputValue').value);
    if (isNaN(val) || val < 0) return showError('Ingresa un valor numérico válido.');
    alert.value = val;
  }

  if (type === 'rsi') {
    const val = parseFloat(document.getElementById('inputRsiValue').value);
    if (isNaN(val) || val < 1 || val > 99) return showError('RSI debe estar entre 1 y 99.');
    alert.value = val;
    alert.rsiCondition = document.getElementById('selectRsiCondition').value;
  }

  if (type === 'macd') {
    alert.macdSignal = document.getElementById('selectMacdSignal').value;
  }

  alerts.push(alert);
  await saveAlerts();
  renderAlerts();

  // Reset form
  document.getElementById('inputSymbol').value = '';
  document.getElementById('inputValue').value = '';
}

async function onRefresh() {
  const btn = document.getElementById('btnRefresh');
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';
  await chrome.runtime.sendMessage({ action: 'forceCheck' });
  await new Promise(r => setTimeout(r, 1500));
  await loadPrices();
  btn.style.opacity = '';
  btn.style.pointerEvents = '';
}

function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAlerts() {
  const list = document.getElementById('alertsList');
  document.getElementById('alertCount').textContent = alerts.filter(a => a.enabled).length;

  if (alerts.length === 0) {
    list.innerHTML = '<div class="empty-state">No hay alertas configuradas.</div>';
    return;
  }

  list.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.enabled ? '' : 'disabled'}" data-id="${a.id}">
      <span class="alert-symbol">${a.symbol}</span>
      <span class="alert-desc">${describeAlert(a)}</span>
      <div class="alert-actions">
        <button class="btn-icon" data-action="toggle" data-id="${a.id}" title="${a.enabled ? 'Desactivar' : 'Activar'}">
          ${a.enabled ? '⏸' : '▶️'}
        </button>
        <button class="btn-icon" data-action="delete" data-id="${a.id}" title="Eliminar">🗑️</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const action = e.currentTarget.dataset.action;
      if (action === 'delete') {
        alerts = alerts.filter(a => a.id !== id);
      } else if (action === 'toggle') {
        const a = alerts.find(a => a.id === id);
        if (a) a.enabled = !a.enabled;
      }
      await saveAlerts();
      renderAlerts();
    });
  });
}

function describeAlert(a) {
  switch (a.type) {
    case 'price_above': return `Precio ≥ $${a.value}`;
    case 'price_below': return `Precio ≤ $${a.value}`;
    case 'change_above': return `Variación diaria ≥ +${a.value}%`;
    case 'change_below': return `Caída diaria ≥ ${a.value}%`;
    case 'volume':       return `Volumen/hora ≥ ${a.value.toLocaleString()}`;
    case 'rsi':          return `RSI ${a.rsiCondition === 'overbought' ? '≥' : '≤'} ${a.value}`;
    case 'macd':         return `MACD cruce ${a.macdSignal === 'bullish' ? 'alcista' : 'bajista'}`;
    default:             return a.type;
  }
}

function renderPriceItem(symbol, q) {
  const sign = q.dp >= 0 ? '+' : '';
  const cls = q.dp >= 0 ? 'up' : 'down';
  const age = Math.floor((Date.now() - q.updatedAt) / 60000);
  const timeLabel = age < 1 ? 'ahora' : `hace ${age}m`;
  return `
    <div class="price-item">
      <span class="price-symbol">${symbol}</span>
      <span class="price-current">$${q.c.toFixed(2)}</span>
      <span class="price-change ${cls}">${sign}${q.dp.toFixed(2)}%</span>
      <span class="price-time">${timeLabel}</span>
    </div>
  `;
}

async function saveAlerts() {
  await chrome.storage.sync.set({ alerts });
}
