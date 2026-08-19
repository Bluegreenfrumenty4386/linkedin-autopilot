/**
 * LinkedIn Auto Connect - Pure 24/7 MyNetwork Engine
 * Clicks "Bağlantı kur" directly on /mynetwork, scrolls infinitely, and sleeps 24h on limit.
 */

(function () {
  if (window.__LINKEDIN_AUTO_CONNECT_LOADED__) return;
  window.__LINKEDIN_AUTO_CONNECT_LOADED__ = true;

  let isExecuting = false;
  let shouldStop = false;
  const clickedButtons = new WeakSet();

  console.log('[LinkedIn Auto Connect 24/7] Servis yüklendi:', window.location.href);

  chrome.runtime.onMessage.addListener((req, sender, res) => {
    if (req.action === 'START_AUTOMATION') {
      shouldStop = false;
      if (!isExecuting) run247Loop();
      res({ status: 'started' });
    } else if (req.action === 'STOP_AUTOMATION') {
      shouldStop = true;
      isExecuting = false;
      res({ status: 'stopped' });
    }
    return true;
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function randDelay(minSec, maxSec) {
    const min = (minSec || 8) * 1000;
    const max = (maxSec || 16) * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLocaleLowerCase('tr-TR')
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function clickDirectly(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof el.focus === 'function') el.focus();

    const mouseEvt = (type) =>
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window
      });

    const pointerEvt = (type) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window
      });

    el.dispatchEvent(pointerEvt('pointerdown'));
    el.dispatchEvent(mouseEvt('mousedown'));
    el.dispatchEvent(pointerEvt('pointerup'));
    el.dispatchEvent(mouseEvt('mouseup'));
    el.dispatchEvent(mouseEvt('click'));
    if (typeof el.click === 'function') el.click();
  }

  function findConnectButtons() {
    const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    const validButtons = [];

    for (const btn of candidates) {
      if (clickedButtons.has(btn)) continue;
      if (btn.disabled) continue;

      if (btn.closest('header, nav, #global-nav, .msg-overlay-container, .msg-overlay-list-bubble')) {
        continue;
      }

      const raw = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '').trim();
      const norm = normalizeText(raw);

      if (
        norm.includes('beklemede') ||
        norm.includes('pending') ||
        norm.includes('mesaj') ||
        norm.includes('takip') ||
        norm.includes('1. derece') ||
        norm.includes('kaldir') ||
        norm.includes('dismiss') ||
        norm.includes('sil')
      ) {
        continue;
      }

      if (
        norm === 'baglanti kur' ||
        norm === 'baglan' ||
        norm === 'connect' ||
        norm.includes('baglanti kur') ||
        (norm.includes('baglan') && !norm.includes('baglantilar')) ||
        (norm.includes('connect') && !norm.includes('connection'))
      ) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          validButtons.push(btn);
        }
      }
    }

    return validButtons;
  }

  function findShowMoreButton() {
    const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
    for (const el of elements) {
      const raw = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
      const norm = normalizeText(raw);

      if (
        norm.includes('daha fazla yukle') ||
        norm.includes('daha fazla goster') ||
        norm.includes('show more') ||
        norm.includes('daha fazla kisi') ||
        norm.includes('tumunu gor') ||
        norm === 'daha fazla'
      ) {
        const target = el.closest('button, a, div[role="button"]') || el;
        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return target;
        }
      }
    }
    return null;
  }

  function isWeeklyLimitReached() {
    const bodyText = normalizeText(document.body.innerText || '');
    const modal = document.querySelector('.artdeco-modal, div[role="dialog"]');
    const modalText = modal ? normalizeText(modal.innerText || modal.textContent || '') : '';

    if (
      bodyText.includes('haftalik davet sinirina ulastiniz') ||
      bodyText.includes('haftalik limit') ||
      bodyText.includes('weekly invitation limit') ||
      bodyText.includes('reached the weekly') ||
      modalText.includes('haftalik davet') ||
      modalText.includes('weekly limit')
    ) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const dismiss = document.querySelector('.artdeco-modal__dismiss, button[aria-label*="kapat" i]');
      if (dismiss) clickDirectly(dismiss);
      return true;
    }

    return false;
  }

  function extractName(btn) {
    let parent = btn;
    for (let i = 0; i < 10; i++) {
      parent = parent?.parentElement;
      if (!parent) break;

      const links = parent.querySelectorAll('a[href*="/in/"]');
      for (const pl of links) {
        const name = (pl.innerText || pl.textContent || '').trim().split('\n')[0].trim();
        if (name && name.length > 1 && name.length < 50 && !name.toLowerCase().includes('bağlantı')) {
          return name;
        }
      }
    }
    return 'Kullanıcı';
  }

  async function notifyLog(message, type = 'info') {
    chrome.runtime.sendMessage({ action: 'ADD_LOG', message, type });
  }

  async function getStorage() {
    return new Promise((r) => chrome.storage.local.get(null, (d) => r(d || {})));
  }

  /**
   * Main 24/7 loop
   */
  async function run247Loop() {
    if (isExecuting) return;
    isExecuting = true;

    try {
      await notifyLog('⚡ 7/24 Kesintisiz Ağım Otomasyonu Başlatıldı...', 'info');

      while (!shouldStop) {
        const storage = await getStorage();
        if (!storage.isRunning) break;

        // Check if 24h limit cooldown is active
        if (storage.cooldownUntil && Date.now() < storage.cooldownUntil) {
          const remainingMs = storage.cooldownUntil - Date.now();
          const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
          const minsLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          await notifyLog(`⏳ 24 saatlik limit beklemesinde. (Kalan: ${hoursLeft} sa ${minsLeft} dk)`, 'warning');
          break;
        }

        // Check if weekly limit reached on page
        if (isWeeklyLimitReached()) {
          await notifyLog('⚠️ LinkedIn haftalık davet sınırına ulaşıldı! 24 saat bekleme moduna geçiliyor...', 'warning');
          chrome.runtime.sendMessage({ action: 'SET_COOLDOWN_24H' });
          break;
        }

        const buttons = findConnectButtons();

        if (buttons.length > 0) {
          console.log(`[LinkedIn 24/7] ${buttons.length} adet "Bağlantı kur" butonu bulundu.`);

          for (const btn of buttons) {
            if (shouldStop) break;

            const cs = await getStorage();
            if (!cs.isRunning) { shouldStop = true; break; }

            const name = extractName(btn);
            clickedButtons.add(btn);

            console.log(`[LinkedIn 24/7] Davet gönderiliyor: ${name}`);
            clickDirectly(btn);
            await sleep(1200);

            // Check if click triggered limit modal
            if (isWeeklyLimitReached()) {
              await notifyLog('⚠️ LinkedIn haftalık davet sınırına ulaştı! Otomasyon 24 saat bekleyecek ve otomatik tekrar deneyecek.', 'warning');
              chrome.runtime.sendMessage({ action: 'SET_COOLDOWN_24H' });
              shouldStop = true;
              break;
            }

            const total = (cs.totalSentCount || 0) + 1;
            await new Promise((r) => chrome.storage.local.set({
              totalSentCount: total,
              lastSentTimestamp: Date.now(),
              statusMessage: `7/24 Çalışıyor (${total} davet gönderildi)`
            }, r));

            await notifyLog(`✅ Davet gönderildi: ${name} (Toplam: ${total})`, 'success');

            // Safe human delay
            const delayMs = randDelay(storage.minDelay, storage.maxDelay);
            const delaySec = Math.round(delayMs / 1000);
            console.log(`[LinkedIn 24/7] ${delaySec} sn bekleniyor...`);
            await sleep(delayMs);
          }
        } else {
          // Load more profiles
          await notifyLog('Yeni kişiler taranıyor ve yükleniyor...', 'info');

          const showMore = findShowMoreButton();
          if (showMore) {
            clickDirectly(showMore);
            await sleep(2500);
          } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await sleep(2500);
          }

          // Small extra scroll to trigger network request
          window.scrollBy({ top: 800, behavior: 'smooth' });
          await sleep(2000);
        }
      }
    } catch (err) {
      console.error('[LinkedIn 24/7] Hata:', err);
      await notifyLog(`Hata: ${err.message}`, 'error');
    } finally {
      isExecuting = false;
    }
  }

  // Auto-start
  chrome.storage.local.get(['isRunning'], (res) => {
    if (res?.isRunning) {
      setTimeout(() => { if (!isExecuting && !shouldStop) run247Loop(); }, 3000);
    }
  });
})();
