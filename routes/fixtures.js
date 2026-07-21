const express = require('express');
const { computeSeason, seasonLabel } = require('../lib/season');

const router = express.Router();

// Fixtures are scraped out-of-band by scripts/scrape-fixtures.mjs (run on a
// schedule via GitHub Actions) and committed to data/fixtures.json. The app
// just reads that file's raw GitHub URL instead of live-scraping the league
// sites on every request — keeps the request path immune to the leagues'
// sites changing markup or returning something unparseable.
const FIXTURES_JSON_URL = process.env.FIXTURES_JSON_URL || 'https://raw.githubusercontent.com/stockport-badminton/hydewebsite/main/data/fixtures.json';
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = { fixtures: null, fetchedAt: 0 };

async function getFixtures() {
  const isFresh = cache.fixtures && (Date.now() - cache.fetchedAt) < CACHE_TTL_MS;
  if (isFresh) return cache.fixtures;
  const response = await fetch(FIXTURES_JSON_URL);
  if (!response.ok) throw new Error(`Fixtures fetch failed: ${response.status}`);
  const { fixtures } = await response.json();
  cache = { fixtures, fetchedAt: Date.now() };
  return fixtures;
}

const dayNames = Array.from({ length: 7 }, (_, i) => new Date(0, 0, i).toLocaleString('en-US', { weekday: 'short' }));

function outcomeFor(fixture) {
  if (fixture.status !== 'complete') return null;
  const hydeScore = fixture.homeOrAway === 'home' ? fixture.homeScore : fixture.awayScore;
  const oppScore = fixture.homeOrAway === 'home' ? fixture.awayScore : fixture.homeScore;
  if (hydeScore === oppScore) return 'draw';
  return hydeScore > oppScore ? 'win' : 'loss';
}

router.get('/fixtures/:team/:season?', async (req, res, next) => {
  try {
    const fixtures = await getFixtures();
    const teamFixtures = fixtures.filter((f) => f.team === req.params.team);

    const seasons = [...new Set(teamFixtures.map((f) => f.season))].sort().reverse();
    const currentSeason = computeSeason(new Date().toISOString());
    const season = req.params.season || (seasons.includes(currentSeason) ? currentSeason : seasons[0]);

    const result = teamFixtures
      .filter((f) => f.season === season)
      .map((f) => {
        const fixtureDate = new Date(f.date);
        return {
          date: fixtureDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          dotw: dayNames[fixtureDate.getDay()],
          competition: f.competition,
          opposition: f.opposition,
          homeOrAway: f.homeOrAway,
          result: f.result,
          outcome: outcomeFor(f),
        };
      });

    res.render('fixtures', {
      pageHeading: req.params.team + " Fixtures",
      title: req.params.team + " Fixtures",
      result,
      static_path: "/static",
      team: req.params.team,
      season,
      seasons: seasons.map((s) => ({ value: s, label: seasonLabel(s) })),
    });
  } catch (err) {
    console.error('Error loading fixtures:', err);
    res.status(500).render('homepage', {
      pageHeading: req.params.team + " Fixtures",
      title: req.params.team + " Fixtures",
      entry: "<p>Sorry, fixtures are temporarily unavailable.</p>",
      static_path: "/static"
    });
  }
});

module.exports = router;
