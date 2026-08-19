/**
 * Storage and configuration for LinkedIn Autonomous 24/7 MyNetwork Auto-Connect
 */
const DEFAULT_CONFIG = {
  isRunning: false,
  cooldownUntil: null,       // Timestamp when 24h limit wait expires
  totalSentCount: 0,
  minDelay: 8,               // 8 - 16 seconds human delay
  maxDelay: 16,
  statusMessage: 'Hazır. Başlatmak için butona basın.',
  logs: []
};

async function getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_CONFIG, (items) => resolve(items));
  });
}

async function updateStorageData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

async function addLog(message, type = 'info') {
  const data = await getStorageData();
  const logs = data.logs || [];
  const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logs.unshift({ time, message, type });
  if (logs.length > 50) logs.pop();
  await updateStorageData({ logs });
}
