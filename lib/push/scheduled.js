// Scheduled push sends, triggered by App Engine cron (cron.yaml → the
// /push/cron/* routes in routes/push.js). These used to be GitHub Actions
// schedules, but GitHub was starting them 4–8 hours late: "Tonight" reminders
// arrived after the match, and a run that slipped past midnight looked at the
// wrong day. App Engine cron runs on time and takes a timezone, so cron.yaml
// says 17:00/18:00 Europe/London directly and GMT/BST needs no handling here.
//
// Bookkeeping lives in the same Datastore database as the subscriptions, kind
// "PushState" (override with PUSH_STATE_KIND):
//   reminders-<UK date>-<tonight|tomorrow>  marker, so a repeat run can't send twice
//   results-announced                       JSON array of fixture ids already notified
const { Datastore } = require('@google-cloud/datastore');
const { getFixtures } = require('../fixtures-data');
const { reminderNotifications } = require('./reminders');
const { resultNotifications } = require('./results');
const { outcomeFor } = require('../hyde');
const { sendNotifications } = require('./send');
const push = require('./config');

const MAX_RESULTS_PER_RUN = 10; // more than this is a back-fill/re-import, not news
const ukDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d); // YYYY-MM-DD

let ds;
const datastore = () => (ds ??= new Datastore({
  projectId: process.env.DATASTORE_PROJECT || undefined,
  databaseId: process.env.DATASTORE_DATABASE || undefined,
}));
const stateKey = (name) => datastore().key([process.env.PUSH_STATE_KIND || 'PushState', name]);

/** Ids of fixtures that have a result. */
const scoredIds = (fixtures) => fixtures.filter((f) => outcomeFor(f)).map((f) => f.id);

async function deliver(store, notifications) {
  if (!process.env.VAPID_PRIVATE_KEY) throw new Error('VAPID_PRIVATE_KEY not set');
  return sendNotifications({
    store,
    notifications,
    vapid: { subject: push.vapidSubject, publicKey: push.vapidPublicKey, privateKey: process.env.VAPID_PRIVATE_KEY },
  });
}

/**
 * "Tonight" (17:00 UK) or "Tomorrow" (18:00 UK) reminders for Hyde fixtures.
 * @returns {Promise<object>} summary for the log / response
 */
async function runReminders(store, when, now = new Date()) {
  const notifications = reminderNotifications(await getFixtures({ fresh: true }), { now, when });
  if (!notifications.length) return { when, notifications: 0, note: `no Hyde fixtures ${when === 'tomorrow' ? 'tomorrow' : 'today'}` };

  // insert() fails if the key exists, so the check-and-mark is atomic.
  const name = `reminders-${ukDate(now)}-${when}`;
  try {
    await datastore().insert({ key: stateKey(name), data: { sentAt: now.toISOString() } });
  } catch (err) {
    if (err.code === 6 /* ALREADY_EXISTS */) return { when, notifications: 0, note: `${name} already sent` };
    throw err;
  }

  notifications.forEach((n) => console.log(`push-reminders: ${n.title} — ${n.body}`));
  return { when, titles: notifications.map((n) => n.title), ...(await deliver(store, notifications)) };
}

/**
 * Notifies results not announced before. Runs several times a day because the
 * scrape that adds results is itself on GitHub cron and lands at an
 * unpredictable hour; a missed run is simply caught up by the next one.
 */
async function runResults(store, now = new Date()) {
  const fixtures = await getFixtures({ fresh: true });
  const [entity] = await datastore().get(stateKey('results-announced'));
  // First run (or lost state): the results in the deployed data/fixtures.json
  // were already announced by the old GitHub workflow, so start from those.
  // Deploys skip data-only commits, so if this ever has to fall back again the
  // bundle may be stale — resultNotifications' 14-day cutoff and the cap below
  // keep that from turning into a burst.
  const announced = new Set(entity ? JSON.parse(entity.ids) : scoredIds(require('../../data/fixtures.json').fixtures));

  const notifications = resultNotifications(fixtures.filter((f) => announced.has(f.id)), fixtures, { now });

  // Record before sending, so a failed send isn't repeated next run as a burst.
  const ids = [...new Set([...announced, ...scoredIds(fixtures)])];
  await datastore().save({
    key: stateKey('results-announced'),
    data: { ids: JSON.stringify(ids), updatedAt: now.toISOString() },
    excludeFromIndexes: ['ids'],
  });

  if (!notifications.length) return { notifications: 0, note: 'no new results' };
  if (notifications.length > MAX_RESULTS_PER_RUN) {
    console.warn(`push-results: ${notifications.length} new results looks like a back-fill — not sending.`);
    notifications.forEach((n) => console.warn(`  · ${n.title}`));
    return { notifications: 0, note: `${notifications.length} new results — treated as back-fill, not sent` };
  }
  notifications.forEach((n) => console.log(`push-results: ${n.title} — ${n.body}`));
  return { titles: notifications.map((n) => n.title), ...(await deliver(store, notifications)) };
}

module.exports = { runReminders, runResults };
