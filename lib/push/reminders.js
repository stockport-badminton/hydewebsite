// Match reminders: one notification per unplayed Hyde fixture, sent twice —
// the evening before ("tomorrow", 18:00 UK) and on match day ("tonight",
// 17:00 UK); see .github/workflows/match-day-reminders.yml.
//
// Neither league gives a usable start time (Tameside dates are midnight UTC,
// Manchester's are stamped 19:00 UTC by the scraper), so fixtures are matched
// on their UK calendar date only.
const { topicKeysOf } = require('./teams');

const TZ = 'Europe/London';
const ukDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDER_KINDS = ['tonight', 'tomorrow'];

/**
 * @param {Array} fixtures
 * @param {{ now?: Date, when?: 'tonight' | 'tomorrow' }} opts
 */
function reminderNotifications(fixtures, { now = new Date(), when = 'tonight' } = {}) {
  if (!REMINDER_KINDS.includes(when)) throw new Error(`unknown reminder kind: ${when}`);
  // +24h lands on the next UK date even across a clock change, as long as
  // `now` isn't within an hour of midnight (sends are at 17:00/18:00 UK).
  const target = ukDate(when === 'tomorrow' ? new Date(now.getTime() + DAY_MS) : now);
  const word = when === 'tomorrow' ? 'Tomorrow' : 'Tonight';
  const out = [];
  for (const f of fixtures) {
    if (f.status === 'complete') continue;
    if (ukDate(new Date(f.date)) !== target) continue;
    const teams = topicKeysOf(f);
    if (!teams.length) continue;
    out.push({
      type: 'reminders',
      teams,
      title: `${word}: ${f.team} v ${f.opposition}`,
      body: `${f.homeOrAway === 'home' ? 'Home' : 'Away'} · ${f.league} ${f.competition === f.league ? 'League' : f.competition}`,
      url: `/fixtures/${encodeURIComponent(f.team)}`,
      // Distinct per kind: a same-tag notification replaces the old one
      // silently, so tonight's wouldn't buzz if it reused tomorrow's tag.
      tag: `reminder-${when}-${f.id}`,
    });
  }
  return out;
}

module.exports = { REMINDER_KINDS, reminderNotifications };
