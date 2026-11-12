// PWA + push notifications. Ported from the remnants-badminton site, where the
// same endpoints are Netlify Functions; here they're plain Express routes and
// subscriptions live in Firestore in Datastore mode (lib/push/store-datastore.js).
//
//   GET    /sw.js                 service worker (must be served from the root to control every page)
//   GET    /manifest.webmanifest  web app manifest
//   GET    /offline               fallback page the service worker shows when offline
//   GET    /notifications         opt-in page (pick teams + results/reminders)
//   POST   /push/subscribe        { subscription, teams, types } → save / update
//   DELETE /push/subscribe        { endpoint }                   → remove
//   POST   /push/send             Bearer PUSH_SEND_SECRET; { notifications: [...] } (called by scripts/push-notify.mjs)
const express = require('express');
const path = require('path');
const { timingSafeEqual } = require('node:crypto');
const { getFixtures } = require('../lib/fixtures-data');
const { clubTopics } = require('../lib/push/teams');
const {
  NOTIFICATION_TYPES, subscriptionId, validateSubscription, validateTeams, validateTypes,
} = require('../lib/push/subscription');
const { createDatastoreStore } = require('../lib/push/store-datastore');
const { sendNotifications } = require('../lib/push/send');
const push = require('../lib/push/config');

const router = express.Router();
const store = createDatastoreStore();
const body = express.json({ limit: '4kb' });

router.get('/sw.js', (req, res) => {
  // Never let the browser's HTTP cache hold the worker, or updates stall.
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(__dirname, '../static/sw.js'));
});

router.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json').send({
    id: '/',
    name: 'Hyde Badminton Club',
    short_name: 'Hyde Badminton',
    description: 'Fixtures, results and league tables for Hyde Badminton Club.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf7f4',
    theme_color: '#7a2048',
    icons: [
      { src: '/static/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/static/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/static/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'League tables', short_name: 'Tables', url: '/tables' },
      { name: 'Notifications', url: '/notifications' },
    ],
  });
});

router.get('/offline', (req, res) => {
  res.render('offline', { pageHeading: "You're offline", title: 'Offline' });
});

router.get('/notifications', async (req, res) => {
  let topics = [];
  try {
    topics = clubTopics(await getFixtures());
  } catch (err) {
    console.error('notifications: fixtures unavailable', err);
  }
  res.render('notifications', {
    pageHeading: 'Notifications',
    title: 'Notifications',
    topics,
    preselect: typeof req.query.team === 'string' ? req.query.team : null,
    vapidPublicKey: push.vapidPublicKey,
  });
});

router.post('/push/subscribe', body, async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });
  try {
    // Accept any side seen in the data (not just this season), so a page
    // loaded before a data update can't make a save fail.
    const allowed = clubTopics(await getFixtures(), { allSeasons: true }).map((t) => t.key);
    const subscription = validateSubscription(req.body?.subscription);
    const teams = validateTeams(req.body?.teams, allowed);
    const types = validateTypes(req.body?.types);
    const id = subscriptionId(subscription.endpoint);
    const now = new Date().toISOString();
    const existing = await store.get(id);
    await store.put(id, { subscription, teams, types, createdAt: existing?.createdAt ?? now, updatedAt: now });
    res.json({ ok: true, teams, types });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/push/subscribe', body, async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });
  if (typeof req.body?.endpoint !== 'string') return res.status(400).json({ error: 'missing endpoint' });
  try {
    await store.remove(subscriptionId(req.body.endpoint));
    res.json({ ok: true });
  } catch (err) {
    console.error('push unsubscribe failed', err);
    res.status(500).json({ error: 'could not remove subscription' });
  }
});

router.post('/push/send', express.json({ limit: '64kb' }), async (req, res) => {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });
  if (!process.env.VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'VAPID_PRIVATE_KEY not set' });

  let notifications;
  try {
    notifications = (req.body?.notifications ?? []).slice(0, 50).map(clean);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!notifications.length) return res.json({ sent: 0 });

  try {
    const summary = await sendNotifications({
      store,
      notifications,
      vapid: { subject: push.vapidSubject, publicKey: push.vapidPublicKey, privateKey: process.env.VAPID_PRIVATE_KEY },
    });
    console.log('push-send', JSON.stringify(summary));
    res.json(summary);
  } catch (err) {
    console.error('push-send failed', err);
    res.status(500).json({ error: 'send failed' });
  }
});

// Browsers always send Origin on fetch POST/DELETE; reject other sites' pages.
// Compared by host since App Engine terminates TLS (req.protocol is 'http').
function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === req.get('host'); } catch { return false; }
}

function authorised(req) {
  const secret = process.env.PUSH_SEND_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function clean(n) {
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);
  const title = str(n?.title, 120);
  if (!title) throw new Error('notification missing title');
  const url = str(n.url, 200);
  return {
    title,
    body: str(n.body, 300) ?? '',
    // same-site paths only ('//host' would be protocol-relative)
    url: url?.startsWith('/') && !url.startsWith('//') ? url : '/',
    tag: str(n.tag, 120),
    type: NOTIFICATION_TYPES.includes(n.type) ? n.type : undefined,
    teams: Array.isArray(n.teams) ? n.teams.filter((t) => typeof t === 'string') : [],
  };
}

module.exports = router;
