// Validation for incoming push subscriptions. Ported as-is from the
// remnants-badminton site (src/lib/push/subscription.mjs).
const { createHash } = require('node:crypto');

// Only accept endpoints on real browser push services, so the store can't be
// used to make our sender POST to arbitrary URLs.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,                  // Chrome, Edge (Android), Samsung
  /^android\.googleapis\.com$/,
  /(^|\.)push\.apple\.com$/,                 // Safari / iOS
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)notify\.windows\.com$/,             // Edge (Windows)
];

const B64URL = /^[A-Za-z0-9_-]+=*$/;

/** Notification kinds a subscriber can opt in/out of. */
const NOTIFICATION_TYPES = ['results', 'reminders'];

function subscriptionId(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex');
}

/** Returns a clean { endpoint, keys } or throws with a user-safe message. */
function validateSubscription(sub) {
  if (!sub || typeof sub !== 'object') throw new Error('missing subscription');
  const { endpoint, keys } = sub;
  let url;
  try { url = new URL(endpoint); } catch { throw new Error('invalid endpoint'); }
  if (url.protocol !== 'https:' || endpoint.length > 1024) throw new Error('invalid endpoint');
  if (!PUSH_HOSTS.some((re) => re.test(url.hostname))) throw new Error('unsupported push service');
  const { p256dh, auth } = keys ?? {};
  for (const k of [p256dh, auth]) {
    if (typeof k !== 'string' || k.length > 200 || !B64URL.test(k)) throw new Error('invalid keys');
  }
  return { endpoint, keys: { p256dh, auth } };
}

/** Keeps only known types. An empty list means "all types". */
function validateTypes(types) {
  if (types == null) return [];
  if (!Array.isArray(types)) throw new Error('invalid types');
  return [...new Set(types.filter((t) => NOTIFICATION_TYPES.includes(t)))];
}

/** Keeps only known team keys. An empty list means "all teams". */
function validateTeams(teams, allowed) {
  if (teams == null) return [];
  if (!Array.isArray(teams)) throw new Error('invalid teams');
  const ok = new Set(allowed);
  return [...new Set(teams.filter((t) => typeof t === 'string' && ok.has(t)))];
}

module.exports = { NOTIFICATION_TYPES, subscriptionId, validateSubscription, validateTypes, validateTeams };
