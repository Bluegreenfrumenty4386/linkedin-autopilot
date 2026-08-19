/**
 * LinkedIn Auto Connect - Background Service Worker
 * Pure 24/7 Autonomous Background Loop with 24h limit recovery.
 */

const ALARM_NAME = 'LINKEDIN_247_ALARM';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[LinkedIn Auto Connect 24/7] Servis aktif.');
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: 2
  });
  updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await checkAndExecuteRoutine();
  }
});

async function getStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => resolve(data || {}));
  });
}

async function addLogToStorage(message, type = 'info') {
  const data = await getStorage();
  const logs = data.logs || [];
  const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logs.unshift({ time, message, type });
  if (logs.length > 50) logs.pop();
  await new Promise((resolve) => chrome.storage.local.set({ logs }, resolve));
}

async function updateBadge() {
  const data = await getStorage();
  if (!data.isRunning) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6B7280' });
    return;
  }

  // If in 24h limit cooldown
  if (data.cooldownUntil && Date.now() < data.cooldownUntil) {
    chrome.action.setBadgeText({ text: 'WAIT' });
    chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    return;
  }

  const count = data.totalSentCount || 0;
  chrome.action.setBadgeText({ text: `${count}` });
  chrome.action.setBadgeBackgroundColor({ color: '#0A66C2' });
}

async function checkAndExecuteRoutine() {
  const data = await getStorage();
  await updateBadge();

  if (!data.isRunning) return;

  // Check 24-hour limit cooldown
  if (data.cooldownUntil) {
    const remainingMs = data.cooldownUntil - Date.now();
    if (remainingMs > 0) {
      const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
      const minsLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      chrome.storage.local.set({
        statusMessage: `⏳ 24 Saatlik Limit Beklemesinde (Kalan: ${hoursLeft} sa ${minsLeft} dk)`
      });
      return;
    } else {
      // 24h cooldown finished -> automatically resume!
      await addLogToStorage('⏰ 24 saatlik limit bekleme süresi bitti. Otomasyon otomatik olarak devam ediyor...', 'info');
      await new Promise((resolve) => {
        chrome.storage.local.set({
          cooldownUntil: null,
          statusMessage: '24 saatlik bekleme tamamlandı, davetler devam ediyor...'
        }, resolve);
      });
    }
  }

  // Find or open LinkedIn mynetwork tab
  const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
  const networkTabs = tabs.filter((t) => t.url && t.url.includes('linkedin.com/mynetwork'));

  if (networkTabs.length > 0) {
    const targetTab = networkTabs[0];
    chrome.tabs.sendMessage(targetTab.id, { action: 'START_AUTOMATION' }, (res) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          files: ['scripts/content.js']
        }).then(() => {
          setTimeout(() => {
            chrome.tabs.sendMessage(targetTab.id, { action: 'START_AUTOMATION' });
          }, 1000);
        }).catch(console.error);
      }
    });
  } else if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'START_AUTOMATION' });
  } else {
    // If no LinkedIn tab is open, open mynetwork in background
    console.log('[LinkedIn Auto Connect 24/7] Ağım sayfası açılıyor...');
    chrome.tabs.create({ url: 'https://www.linkedin.com/mynetwork/grow/', active: false });
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ADD_LOG') {
    addLogToStorage(request.message, request.type).then(() => {
      updateBadge();
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (request.action === 'TRIGGER_NOW') {
    checkAndExecuteRoutine().then(() => sendResponse({ status: 'ok' }));
    return true;
  }

  if (request.action === 'SET_COOLDOWN_24H') {
    const cooldownTimestamp = Date.now() + 24 * 60 * 60 * 1000;
    chrome.storage.local.set({
      cooldownUntil: cooldownTimestamp,
      statusMessage: '⏳ 24 Saatlik Bekleme Modunda (Haftalık limit uyarısı)'
    }, () => {
      updateBadge();
      sendResponse({ status: 'ok', cooldownUntil: cooldownTimestamp });
    });
    return true;
  }

  if (request.action === 'UPDATE_BADGE') {
    updateBadge().then(() => sendResponse({ status: 'ok' }));
    return true;
  }
});
