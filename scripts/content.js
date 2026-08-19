/**
 * LinkedIn Auto Connect - Pure 24/7 MyNetwork Engine
 * Ultra-robust weekly limit detection and strict 24-hour sleep enforcement.
 */

(function () {
  if (window.__LINKEDIN_AUTO_CONNECT_LOADED__) return;
  window.__LINKEDIN_AUTO_CONNECT_LOADED__ = true;

  let isExecuting = false;
  let shouldStop = false;
  let consecutiveFailures = 0;
  const clickedButtons = new WeakSet();

  console.log('[LinkedIn Auto Connect 24/7] Servis aktif:', window.location.href);

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

  /**
   * Comprehensive weekly limit detector
   * On /mynetwork, any popup modal or toast that appears after clicking is a limit/warning.
   */
  function isWeeklyLimitTriggered() {
    // 1. Any open modal on MyNetwork is almost always a limit popup
    const modal = document.querySelector('.artdeco-modal, div[role="dialog"], [data-test-modal]');
    if (modal) {
      const modalText = normalizeText(modal.innerText || modal.textContent || '');
      console.log('[LinkedIn 24/7] Modal algılandı:', modalText.substring(0, 100));

      dismissModal(modal);
      return true;
    }

    // 2. Check full body text for limit keywords
    const bodyText = normalizeText(document.body.innerText || '');
    if (
      bodyText.includes('haftalik davet sinirina ulastiniz') ||
      bodyText.includes('haftalik limit') ||
      bodyText.includes('haftalik davet') ||
      bodyText.includes('weekly invitation limit') ||
      bodyText.includes('weekly limit') ||
      bodyText.includes('reached the weekly') ||
      bodyText.includes('kaliteli baglantilar') ||
      bodyText.includes('daha fazla davet gonderemezsiniz') ||
      bodyText.includes('davet siniri')
    ) {
      return true;
    }

    // 3. Check toast alerts
    const toasts = Array.from(document.querySelectorAll('.artdeco-toast-item, .artdeco-toast, [role="alert"]'));
    for (const t of toasts) {
      const toastText = normalizeText(t.innerText || t.textContent || '');
      if (toastText.includes('sinir') || toastText.includes('limit') || toastText.includes('hata') || toastText.includes('unable')) {
        return true;
      }
    }

    return false;
  }

  function dismissModal(modal) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    const closeBtn = modal?.querySelector('button[aria-label*="kapat" i], button[aria-label*="close" i], button[aria-label*="dismiss" i], .artdeco-modal__dismiss');
    if (closeBtn) clickDirectly(closeBtn);
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

  async function trigger24HourCooldown() {
    const cooldownTimestamp = Date.now() + 24 * 60 * 60 * 1000;
    await new Promise((r) => {
      chrome.storage.local.set({
        cooldownUntil: cooldownTimestamp,
        statusMessage: '⏳ 24 Saatlik Bekleme Modunda (Haftalık limit uyarısı)'
      }, r);
    });
    chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
    await notifyLog('🛑 LinkedIn haftalık sınır uyarısı verdi! 24 saatlik uyku moduna geçildi.', 'error');
  }

  /**
   * Main 24/7 loop
   */
  async function run247Loop() {
    if (isExecuting) return;
    isExecuting = true;

    try {
      // Check 24h limit before doing anything
      const initialStorage = await getStorage();
      if (initialStorage.cooldownUntil && Date.now() < initialStorage.cooldownUntil) {
        const rem = initialStorage.cooldownUntil - Date.now();
        const hrs = Math.floor(rem / (1000 * 60 * 60));
        const mins = Math.floor((rem % (1000 * 60 * 60)) / (1000 * 60));
        await notifyLog(`⏳ 24 saatlik limit beklemesi aktif. (Kalan: ${hrs} sa ${mins} dk)`, 'warning');
        return;
      }

      await notifyLog('⚡ 7/24 Kesintisiz Ağım Otomasyonu Başlatıldı...', 'info');

      while (!shouldStop) {
        const storage = await getStorage();
        if (!storage.isRunning) break;

        // Check if 24h cooldown active
        if (storage.cooldownUntil && Date.now() < storage.cooldownUntil) {
          const remainingMs = storage.cooldownUntil - Date.now();
          const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
          const minsLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          await notifyLog(`⏳ 24 saatlik limit beklemesinde. (Kalan: ${hoursLeft} sa ${minsLeft} dk)`, 'warning');
          break;
        }

        // Check limit warning
        if (isWeeklyLimitTriggered()) {
          await trigger24HourCooldown();
          shouldStop = true;
          break;
        }

        const buttons = findConnectButtons();

        if (buttons.length > 0) {
          console.log(`[LinkedIn 24/7] ${buttons.length} adet "Bağlantı kur" butonu bulundu.`);

          for (const btn of buttons) {
            if (shouldStop) break;

            const cs = await getStorage();
            if (!cs.isRunning || (cs.cooldownUntil && Date.now() < cs.cooldownUntil)) {
              shouldStop = true;
              break;
            }

            const name = extractName(btn);
            clickedButtons.add(btn);

            console.log(`[LinkedIn 24/7] Davet gönderiliyor: ${name}`);
            clickDirectly(btn);
            await sleep(1500);

            // Check if clicking triggered any modal / limit warning
            if (isWeeklyLimitTriggered()) {
              await trigger24HourCooldown();
              shouldStop = true;
              break;
            }

            // Verify if button changed (successful invite check)
            const currentBtnText = normalizeText(btn.innerText || btn.textContent || '');
            const isPending = currentBtnText.includes('beklemede') || currentBtnText.includes('pending');

            if (isPending || !document.body.contains(btn)) {
              // Success!
              consecutiveFailures = 0;
              const total = (cs.totalSentCount || 0) + 1;
              await new Promise((r) => chrome.storage.local.set({
                totalSentCount: total,
                lastSentTimestamp: Date.now(),
                statusMessage: `7/24 Çalışıyor (${total} davet gönderildi)`
              }, r));

              await notifyLog(`✅ Davet gönderildi: ${name} (Toplam: ${total})`, 'success');
            } else {
              // Button did not turn to Pending -> Likely limited!
              consecutiveFailures++;
              console.log(`[LinkedIn 24/7] Buton beklemede olmadı (Başarısızlık: ${consecutiveFailures})`);

              if (consecutiveFailures >= 2) {
                console.log('[LinkedIn 24/7] 2 ardışık başarısızlık -> Haftalık limit tespit edildi.');
                await trigger24HourCooldown();
                shouldStop = true;
                break;
              }
            }

            // Safe human delay
            const delayMs = randDelay(storage.minDelay, storage.maxDelay);
            const delaySec = Math.round(delayMs / 1000);
            console.log(`[LinkedIn 24/7] ${delaySec} sn bekleniyor...`);
            await sleep(delayMs);
          }
        } else {
          // Load more
          await notifyLog('Yeni kişiler taranıyor ve yükleniyor...', 'info');

          const showMore = findShowMoreButton();
          if (showMore) {
            clickDirectly(showMore);
            await sleep(2500);
          } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await sleep(2500);
          }

          window.scrollBy({ top: 800, behavior: 'smooth' });
          await sleep(2000);

          if (isWeeklyLimitTriggered()) {
            await trigger24HourCooldown();
            shouldStop = true;
            break;
          }
        }
      }
    } catch (err) {
      console.error('[LinkedIn 24/7] Hata:', err);
      await notifyLog(`Hata: ${err.message}`, 'error');
    } finally {
      isExecuting = false;
    }
  }

  // Auto-start only if NOT in cooldown
  chrome.storage.local.get(['isRunning', 'cooldownUntil'], (res) => {
    if (res?.isRunning) {
      if (res.cooldownUntil && Date.now() < res.cooldownUntil) {
        console.log('[LinkedIn 24/7] Cooldown aktif, otomatik başlatma ertelendi.');
        return;
      }
      setTimeout(() => { if (!isExecuting && !shouldStop) run247Loop(); }, 3000);
    }
  });
})();
