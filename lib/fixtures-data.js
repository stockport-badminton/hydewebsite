// Reads data/fixtures.json from its raw GitHub URL (see CLAUDE.md for why the
// app never live-scrapes). Cached in memory for 10 minutes. Shared by the
// fixtures pages and the push routes (which validate team topics against it).
const FIXTURES_JSON_URL = process.env.FIXTURES_JSON_URL || 'https://raw.githubusercontent.com/stockport-badminton/hydewebsite/main/data/fixtures.json';
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = { fixtures: null, fetchedAt: 0 };

// { fresh: true } skips the in-memory cache (scheduled push sends want the
// latest scrape, not whatever a page view cached up to 10 minutes ago).
async function getFixtures({ fresh = false } = {}) {
  const isFresh = cache.fixtures && (Date.now() - cache.fetchedAt) < CACHE_TTL_MS;
  if (isFresh && !fresh) return cache.fixtures;
  const response = await fetch(FIXTURES_JSON_URL, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(`Fixtures fetch failed: ${response.status}`);
  const { fixtures } = await response.json();
  cache = { fixtures, fetchedAt: Date.now() };
  return fixtures;
}

module.exports = { getFixtures };
