// Notifications opt-in (views/notifications.ejs). Ported from the remnants
// site's PushSubscribe.astro. Saves to /push/subscribe (routes/push.js).
const API = '/push/subscribe';
const STORAGE_KEY = 'push-prefs';

const panel = document.getElementById('push-panel');
const vapidKey = panel.dataset.vapidKey;
const $ = (sel) => panel.querySelector(sel);
const boxes = (name) => [...panel.querySelectorAll(`input[name="${name}"]`)];
const subscribeBtn = $('[data-action="subscribe"]');
const unsubscribeBtn = $('[data-action="unsubscribe"]');
const intro = $('[data-role="intro"]');
const status = $('[data-role="status"]');
// /notifications?team=X preselects one team; don't let saved prefs override that.
const teamFromLink = new URLSearchParams(location.search).has('team');

function show(state) {
  panel.querySelectorAll('[data-state]').forEach((el) => (el.hidden = el.dataset.state !== state));
}

function setStatus(msg, error = false) {
  status.textContent = msg;
  status.className = `mt-3 mb-0 ${error ? 'text-danger' : 'text-success'}`;
}

function selected() {
  const checked = (name) => boxes(name).filter((b) => b.checked).map((b) => b.value);
  return { teams: checked('push-team'), types: checked('push-type') };
}

function restorePrefs() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch {}
  if (!saved) return;
  if (saved.teams?.length && !teamFromLink) boxes('push-team').forEach((b) => (b.checked = saved.teams.includes(b.value)));
  if (saved.types?.length) boxes('push-type').forEach((b) => (b.checked = saved.types.includes(b.value)));
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function render(subscribed) {
  intro.textContent = subscribed
    ? 'Notifications are on for this device. Change what you get below.'
    : 'Choose what you want to hear about on this device.';
  subscribeBtn.textContent = subscribed ? 'Save settings' : 'Turn on notifications';
  unsubscribeBtn.hidden = !subscribed;
  show('ready');
}

async function save(sub, prefs) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), ...prefs }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

async function init() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return show(iOS && !standalone ? 'ios-install' : 'unsupported');
  }
  if (Notification.permission === 'denied') return show('denied');

  // The registration script in footer.ejs runs on window 'load'; wait briefly for it.
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  if (!reg) return show(['localhost', '127.0.0.1'].includes(location.hostname) ? 'dev' : 'unsupported');

  restorePrefs();
  render(!!(await reg.pushManager.getSubscription()));

  subscribeBtn.addEventListener('click', async () => {
    const prefs = selected();
    if (boxes('push-team').length && !prefs.teams.length) return setStatus('Pick at least one team.', true);
    if (!prefs.types.length) return setStatus('Pick at least one kind of notification, or use Turn off.', true);
    subscribeBtn.disabled = true;
    try {
      const wasOn = !!(await reg.pushManager.getSubscription());
      if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') {
        return show(Notification.permission === 'denied' ? 'denied' : 'ready');
      }
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }));
      await save(sub, prefs);
      render(true);
      setStatus(wasOn ? 'Settings saved.' : 'Notifications are on.');
    } catch (err) {
      setStatus(`Couldn't save notification settings: ${err.message}`, true);
    } finally {
      subscribeBtn.disabled = false;
    }
  });

  unsubscribeBtn.addEventListener('click', async () => {
    unsubscribeBtn.disabled = true;
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
      render(false);
      setStatus('Notifications are off.');
    } catch (err) {
      setStatus(`Couldn't turn off notifications: ${err.message}`, true);
    } finally {
      unsubscribeBtn.disabled = false;
    }
  });
}

init().catch((err) => { console.warn('push panel', err); show('unsupported'); });
