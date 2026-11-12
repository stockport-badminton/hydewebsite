// Fan-out: deliver notifications to matching subscribers and prune dead ones.
// Ported as-is from remnants-badminton (src/lib/push/send.mjs); takes any store
// with list()/remove().
const { sendNotification } = require('web-push');

const CONCURRENCY = 25;

/**
 * Empty lists mean "everything": a subscriber with no teams gets every team,
 * one with no types gets every type, and a notification with no teams/type
 * goes to everyone (e.g. --test).
 */
function wants(record, notification) {
  if (notification.type && record.types?.length && !record.types.includes(notification.type)) return false;
  if (!notification.teams?.length || !record.teams?.length) return true;
  return notification.teams.some((t) => record.teams.includes(t));
}

/**
 * @param {{ store, notifications: Array<{type?, teams?, title, body, url?, tag?}>,
 *           vapid: { subject, publicKey, privateKey } }} args
 */
async function sendNotifications({ store, notifications, vapid }) {
  const options = {
    vapidDetails: vapid,
    TTL: 24 * 60 * 60, // drop if the device is offline for over a day
    urgency: 'normal',
  };
  const subscribers = await store.list();
  const jobs = [];
  for (const n of notifications) {
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url ?? '/', tag: n.tag });
    for (const s of subscribers) if (wants(s, n)) jobs.push({ s, payload });
  }

  const summary = { subscribers: subscribers.length, notifications: notifications.length, sent: 0, failed: 0, removed: 0 };
  const dead = new Set();

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(
      jobs.slice(i, i + CONCURRENCY).map(async ({ s, payload }) => {
        if (dead.has(s.id)) return;
        try {
          await sendNotification(s.subscription, payload, options);
          summary.sent++;
        } catch (err) {
          // 404/410: the browser unsubscribed or the subscription expired.
          if (err.statusCode === 404 || err.statusCode === 410) dead.add(s.id);
          else {
            summary.failed++;
            console.warn('push failed', err.statusCode, err.body ?? err.message);
          }
        }
      }),
    );
  }

  for (const id of dead) await store.remove(id);
  summary.removed = dead.size;
  return summary;
}

module.exports = { wants, sendNotifications };
