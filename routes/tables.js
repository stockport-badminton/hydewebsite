const express = require('express');

const router = express.Router();

// Tables are scraped out-of-band by scripts/scrape-tables.mjs the same way
// fixtures are — see routes/fixtures.js for the rationale.
const TABLES_JSON_URL = process.env.TABLES_JSON_URL || 'https://raw.githubusercontent.com/stockport-badminton/hydewebsite/main/data/tables.json';
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = { divisions: null, fetchedAt: 0 };

async function getTables() {
  const isFresh = cache.divisions && (Date.now() - cache.fetchedAt) < CACHE_TTL_MS;
  if (isFresh) return cache.divisions;
  const response = await fetch(TABLES_JSON_URL);
  if (!response.ok) throw new Error(`Tables fetch failed: ${response.status}`);
  const { divisions } = await response.json();
  cache = { divisions, fetchedAt: Date.now() };
  return divisions;
}

router.get('/tables', async (req, res, next) => {
  try {
    const divisions = await getTables();
    res.render('tables', {
      pageHeading: "League Tables",
      title: "League Tables",
      divisions,
      static_path: "/static"
    });
  } catch (err) {
    console.error('Error loading tables:', err);
    res.status(500).render('homepage', {
      pageHeading: "League Tables",
      title: "League Tables",
      entry: "<p>Sorry, league tables are temporarily unavailable.</p>",
      static_path: "/static"
    });
  }
});

module.exports = router;
