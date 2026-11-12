// Turns a before/after pair of data/fixtures.json snapshots into "results"
// notifications. Hyde's version of remnants' diff.mjs; emits the shared shape
// { type, teams, title, body, url, tag }.
const { outcomeFor } = require('../hyde');
const { topicKeysOf } = require('./teams');

const WORD = { win: 'Won', loss: 'Lost', draw: 'Drew' };

/**
 * @param {Array} before  fixtures from the previous snapshot
 * @param {Array} after   fixtures from the new snapshot
 * @param {{ now?: Date, maxAgeDays?: number }} opts
 *   maxAgeDays guards against back-fills: a completed fixture that's new to the
 *   data (no previous id, e.g. first scrape of a season) only notifies if recent.
 */
function resultNotifications(before, after, { now = new Date(), maxAgeDays = 14 } = {}) {
  const prev = new Map(before.map((f) => [f.id, f]));
  const cutoff = now.getTime() - maxAgeDays * 86_400_000;
  const out = [];

  for (const f of after) {
    const outcome = outcomeFor(f);
    if (!outcome) continue;
    const old = prev.get(f.id);
    if (old && outcomeFor(old)) continue; // already reported
    if (!old && new Date(f.date).getTime() < cutoff) continue;

    const teams = topicKeysOf(f);
    if (!teams.length) continue;
    const us = f.homeOrAway === 'home' ? f.homeScore : f.awayScore;
    const them = f.homeOrAway === 'home' ? f.awayScore : f.homeScore;

    out.push({
      type: 'results',
      teams,
      title: `${f.team}: ${WORD[outcome]} ${us}–${them}`,
      body: `vs ${f.opposition} (${f.homeOrAway}) · ${f.league}`,
      url: `/fixtures/${encodeURIComponent(f.team)}`,
      tag: `result-${f.id}`,
    });
  }
  return out;
}

module.exports = { resultNotifications };
