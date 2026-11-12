// Reads data/fixtures.json from its raw GitHub URL (see CLAUDE.md for why the
// app never live-scrapes). Cached in memory for 10 minutes. Shared by the
// fixtures pages and the push routes (which validate team topics against it).
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

module.exports = { getFixtures };
