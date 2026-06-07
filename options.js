document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  bindEvents();
});

async function loadSettings() {
  const { apiKey, pollInterval, cooldownMinutes } = await chrome.storage.sync.get([
    'apiKey', 'pollInterval', 'cooldownMinutes'
  ]);

  if (apiKey) document.getElementById('inputApiKey').value = apiKey;
  if (pollInterval) document.getElementById('selectInterval').value = pollInterval;
  if (cooldownMinutes) document.getElementById('selectCooldown').value = cooldownMinutes;
}

function bindEvents() {
  document.getElementById('btnToggleVisibility').addEventListener('click', () => {
    const input = document.getElementById('inputApiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btnSaveKey').addEventListener('click', saveApiKey);
  document.getElementById('btnTestKey').addEventListener('click', testApiKey);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnExport').addEventListener('click', exportAlerts);
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', importAlerts);
  document.getElementById('btnClearAll').addEventListener('click', clearAll);
}

async function saveApiKey() {
  const apiKey = document.getElementById('inputApiKey').value.trim();
  if (!apiKey) return showStatus('error', 'Ingresa una API key válida.');
  await chrome.storage.sync.set({ apiKey });
  showStatus('success', '✓ API key guardada correctamente.');
  showToast('API key guardada', 'success');
}

async function testApiKey() {
  const apiKey = document.getElementById('inputApiKey').value.trim();
  if (!apiKey) return showStatus('error', 'Ingresa tu API key primero.');

  showStatus('', 'Verificando...');
  document.getElementById('apiStatus').className = 'status-msg';
  document.getElementById('apiStatus').classList.remove('hidden');

  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`);
    const data = await res.json();

    if (data.c && data.c > 0) {
      showStatus('success', `✓ Conexión exitosa. AAPL: $${data.c.toFixed(2)}`);
    } else if (data.error) {
      showStatus('error', `✗ Error: ${data.error}`);
    } else {
      showStatus('error', '✗ Respuesta inesperada de Finnhub.');
    }
  } catch (e) {
    showStatus('error', `✗ Error de red: ${e.message}`);
  }
}

async function saveSettings() {
  const pollInterval = document.getElementById('selectInterval').value;
  const cooldownMinutes = document.getElementById('selectCooldown').value;
  await chrome.storage.sync.set({ pollInterval, cooldownMinutes });

  // Update alarm interval
  await chrome.alarms.clear('pollAlerts');
  chrome.alarms.create('pollAlerts', { periodInMinutes: parseFloat(pollInterval) });

  showToast('Configuración guardada', 'success');
}

async function exportAlerts() {
  const { alerts } = await chrome.storage.sync.get('alerts');
  const data = JSON.stringify(alerts || [], null, 2);
  const blob = new Blob([data], { type: 'application/json' });
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
  const text = await file.text();
  try {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Formato inválido');
    const { alerts } = await chrome.storage.sync.get('alerts');
    const merged = [...(alerts || []), ...imported];
    await chrome.storage.sync.set({ alerts: merged });
    showToast(`${imported.length} alertas importadas`, 'success');
  } catch {
    showToast('Error al importar el archivo', 'error');
  }
  e.target.value = '';
}

async function clearAll() {
  if (!confirm('¿Borrar todas las alertas y configuraciones? Esta acción no se puede deshacer.')) return;
  await chrome.storage.sync.clear();
  await chrome.storage.local.clear();
  document.getElementById('inputApiKey').value = '';
  showToast('Datos eliminados', 'success');
}

function showStatus(type, msg) {
  const el = document.getElementById('apiStatus');
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.classList.remove('hidden');
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
