const express = require('express');
const { computeSeason, seasonLabel } = require('../lib/season');
const { getFixtures } = require('../lib/fixtures-data');
const { outcomeFor } = require('../lib/hyde');

const router = express.Router();

// Fixtures are scraped out-of-band by scripts/scrape-fixtures.mjs and read
// from data/fixtures.json's raw GitHub URL; see lib/fixtures-data.js.

const dayNames = Array.from({ length: 7 }, (_, i) => new Date(0, 0, i).toLocaleString('en-US', { weekday: 'short' }));

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
