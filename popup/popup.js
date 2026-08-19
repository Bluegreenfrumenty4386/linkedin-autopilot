/**
 * LinkedIn Auto Connect - Pure 24/7 Minimalist Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusBadge = document.getElementById('statusBadge');
  const totalCountEl = document.getElementById('totalCount');
  const modeDescriptionEl = document.getElementById('modeDescription');
  const statusMessageEl = document.getElementById('statusMessage');
  const toggleBtn = document.getElementById('toggleBtn');
  const toggleBtnText = document.getElementById('toggleBtnText');
  const statusMessageBox = document.getElementById('statusMessageBox');
  const openNetworkBtn = document.getElementById('openNetworkBtn');
  const logsContainer = document.getElementById('logsContainer');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  // Initial load
  await renderUI();

  // Storage listener
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      renderUI();
    }
  });

  // Countdown updater
  setInterval(() => {
    updateCooldownDisplay();
  }, 1000);

  async function getStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (data) => resolve(data || {}));
    });
  }

  async function updateCooldownDisplay() {
    const data = await getStorage();
    if (data.isRunning && data.cooldownUntil && Date.now() < data.cooldownUntil) {
      const remainingMs = data.cooldownUntil - Date.now();
      const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
      const minsLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const secsLeft = Math.floor((remainingMs % (1000 * 60)) / 1000);

      statusBadge.textContent = '24 Sa Beklemede';
      statusBadge.className = 'status-badge status-paused';
      statusMessageEl.textContent = `⏳ 24 Saatlik Limit Beklemesi: ${hoursLeft} sa ${minsLeft} dk ${secsLeft} sn`;
      modeDescriptionEl.textContent = `⏳ Haftalık limit uyarısı alındı (Otomatik devam edecek)`;
    }
  }

  async function renderUI() {
    const data = await getStorage();

    const isRunning = !!data.isRunning;
    const totalSent = data.totalSentCount || 0;
    const inCooldown = data.cooldownUntil && Date.now() < data.cooldownUntil;

    // Metric
    totalCountEl.textContent = totalSent;

    // Status Badge & Button
    if (isRunning) {
      if (inCooldown) {
        updateCooldownDisplay();
      } else {
        statusBadge.textContent = '7/24 Çalışıyor';
        statusBadge.className = 'status-badge status-running';
        modeDescriptionEl.textContent = '⚡ 7/24 Kesintisiz Mod (Limit uyarısında 24sa bekler)';
      }

      toggleBtn.className = 'btn btn-danger';
      toggleBtnText.textContent = 'Otomasyonu Durdur';
      statusMessageBox.classList.add('running');
    } else {
      statusBadge.textContent = 'Durduruldu';
      statusBadge.className = 'status-badge status-stopped';
      toggleBtn.className = 'btn btn-primary';
      toggleBtnText.textContent = '⚡ Otomasyonu Başlat';
      statusMessageBox.classList.remove('running');
      modeDescriptionEl.textContent = '⚡ 7/24 Kesintisiz Mod (Limit uyarısında 24sa bekler)';
    }

    if (!inCooldown) {
      statusMessageEl.textContent = data.statusMessage || (isRunning ? '7/24 Çalışıyor...' : 'Hazır. Başlatmak için butona basın.');
    }

    // Render Logs
    renderLogs(data.logs || []);
  }

  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      logsContainer.innerHTML = '<div class="log-empty">Henüz bir işlem kaydedilmedi.</div>';
      return;
    }

    logsContainer.innerHTML = logs
      .map(
        (log) => `
        <div class="log-entry ${log.type || 'info'}">
          <span class="log-time">${log.time || ''}</span>
          <span class="log-msg">${escapeHtml(log.message || '')}</span>
        </div>
      `
      )
      .join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Start / Stop
  toggleBtn.addEventListener('click', async () => {
    const data = await getStorage();
    const newRunningState = !data.isRunning;

    let newStatusMsg = newRunningState ? '7/24 Otomasyon başlatıldı...' : 'Otomasyon durduruldu.';

    await chrome.storage.local.set({
      isRunning: newRunningState,
      statusMessage: newStatusMsg
    });

    if (newRunningState) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes('linkedin.com')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'START_AUTOMATION' });
        }
      });
      chrome.runtime.sendMessage({ action: 'TRIGGER_NOW' });
    } else {
      chrome.tabs.query({ url: '*://*.linkedin.com/*' }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { action: 'STOP_AUTOMATION' });
        });
      });
    }

    chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
    await renderUI();
  });

  // Open Network Tab
  openNetworkBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.linkedin.com/mynetwork/grow/' });
  });

  // Clear Logs & Reset counter
  clearLogsBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ logs: [], totalSentCount: 0 });
    await renderUI();
  });
});
