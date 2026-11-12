// Push topics: one per Hyde side, keyed "<league>|<team>" (e.g.
// "Manchester|Hyde 1", "Tameside|Hyde A"). The scraper already gives every
// fixture Hyde's raw team name plus its league, and team names don't change
// on promotion/relegation, so no division stemming is needed (unlike the
// remnants site's teams.mjs).
const { isHydeTeam } = require('../hyde');
const { computeSeason } = require('../season');

function topic(league, team) {
  return { key: `${league}|${team}`, label: `${team} (${league})`, team, league };
}

/** { key, label, team, league } for the fixture's Hyde side, or null. */
function topicOf(f) {
  return f && isHydeTeam(f.team) ? topic(f.league, f.team) : null;
}

/**
 * Topic keys a fixture's notifications go to. Usually one, but a club derby
 * (e.g. Hyde B v Hyde A) is scraped once, under the home side, so the other
 * Hyde side's key is added too.
 */
function topicKeysOf(f) {
  const t = topicOf(f);
  if (!t) return [];
  return isHydeTeam(f.opposition) ? [t.key, topic(f.league, f.opposition).key] : [t.key];
}

/**
 * Topics to offer, sorted by league then team. By default only the current
 * season's sides (falling back to the latest season in the data, e.g. over the
 * summer before fixtures are published); pass { allSeasons: true } for every
 * side ever seen — used to validate subscriptions server-side so a stale page
 * can't make a save fail.
 */
function clubTopics(fixtures, { allSeasons = false, now = new Date() } = {}) {
  let pool = fixtures;
  if (!allSeasons && fixtures.length) {
    const seasons = new Set(fixtures.map((f) => f.season));
    const current = computeSeason(now.toISOString());
    const season = seasons.has(current) ? current : [...seasons].sort().pop();
    pool = fixtures.filter((f) => f.season === season);
  }
  const byKey = new Map();
  for (const f of pool) {
    if (isHydeTeam(f.team)) byKey.set(`${f.league}|${f.team}`, topic(f.league, f.team));
    if (isHydeTeam(f.opposition)) byKey.set(`${f.league}|${f.opposition}`, topic(f.league, f.opposition));
  }
  return [...byKey.values()].sort((a, b) => a.league.localeCompare(b.league) || a.team.localeCompare(b.team));
}

module.exports = { topicOf, topicKeysOf, clubTopics };
