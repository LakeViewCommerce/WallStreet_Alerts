document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  bindEvents();
});

async function loadSettings() {
  const { proxyUrl, pollInterval, cooldownMinutes } = await chrome.storage.sync.get([
    'proxyUrl', 'pollInterval', 'cooldownMinutes'
  ]);
  if (proxyUrl) document.getElementById('inputProxyUrl').value = proxyUrl;
  if (pollInterval) document.getElementById('selectInterval').value = pollInterval;
  if (cooldownMinutes) document.getElementById('selectCooldown').value = cooldownMinutes;
}

function bindEvents() {
  document.getElementById('btnSaveProxy').addEventListener('click', saveProxy);
  document.getElementById('btnTestProxy').addEventListener('click', testProxy);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnExport').addEventListener('click', exportAlerts);
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileImport').click());
  document.getElementById('fileImport').addEventListener('change', importAlerts);
  document.getElementById('btnClearAll').addEventListener('click', clearAll);
}

async function saveProxy() {
  const proxyUrl = document.getElementById('inputProxyUrl').value.trim().replace(/\/$/, '');
  if (!proxyUrl || !proxyUrl.startsWith('https://')) return showStatus('error', 'Ingresa una URL válida (debe empezar con https://).');
  await chrome.storage.sync.set({ proxyUrl });
  // Notify background to use new URL immediately
  chrome.runtime.sendMessage({ action: 'updateProxyUrl', proxyUrl });
  showStatus('success', '✓ URL del proxy guardada.');
  showToast('URL guardada', 'success');
}

async function testProxy() {
  const proxyUrl = document.getElementById('inputProxyUrl').value.trim().replace(/\/$/, '');
  if (!proxyUrl) return showStatus('error', 'Ingresa la URL del Worker primero.');

  const el = document.getElementById('proxyStatus');
  el.textContent = 'Verificando...';
  el.className = 'status-msg';
  el.classList.remove('hidden');

  try {
    const res = await fetch(`${proxyUrl}/quote?symbol=AAPL`);
    const data = await res.json();
    if (data.c && data.c > 0) {
      showStatus('success', `✓ Conexión exitosa. AAPL: $${data.c.toFixed(2)}`);
    } else if (data.error) {
      showStatus('error', `✗ Error del proxy: ${data.error}`);
    } else {
      showStatus('error', '✗ Respuesta inesperada del Worker.');
    }
  } catch (e) {
    showStatus('error', `✗ Error de red: ${e.message}`);
  }
}

async function saveSettings() {
  const pollInterval = document.getElementById('selectInterval').value;
  const cooldownMinutes = document.getElementById('selectCooldown').value;
  await chrome.storage.sync.set({ pollInterval, cooldownMinutes });
  await chrome.alarms.clear('pollAlerts');
  chrome.alarms.create('pollAlerts', { periodInMinutes: parseFloat(pollInterval) });
  showToast('Configuración guardada', 'success');
}

async function exportAlerts() {
  const { alerts } = await chrome.storage.sync.get('alerts');
  const blob = new Blob([JSON.stringify(alerts || [], null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-alerts-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAlerts(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error('invalid');
    const { alerts } = await chrome.storage.sync.get('alerts');
    await chrome.storage.sync.set({ alerts: [...(alerts || []), ...imported] });
    showToast(`${imported.length} alertas importadas`, 'success');
  } catch { showToast('Error al importar el archivo', 'error'); }
  e.target.value = '';
}

async function clearAll() {
  if (!confirm('¿Borrar todas las alertas y configuraciones? Esta acción no se puede deshacer.')) return;
  await chrome.storage.sync.clear();
  await chrome.storage.local.clear();
  document.getElementById('inputProxyUrl').value = '';
  showToast('Datos eliminados', 'success');
}

function showStatus(type, msg) {
  const el = document.getElementById('proxyStatus');
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.classList.remove('hidden');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}
