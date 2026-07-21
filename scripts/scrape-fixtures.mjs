/**
 * Fetches Hyde's fixture data from the two leagues Hyde plays in and writes a
 * unified fixtures.json. Modelled on the remnants-badminton club site's scraper.
 *
 * Sources:
 *   1. Manchester Badminton League — HTML table scrape (#listfixtures)
 *   2. Tameside Badminton League   — JSON API, already filtered to club Hyde
 *
 * Run: node scripts/scrape-fixtures.mjs
 * Or:  npm run scrape
 */

import { load } from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { computeSeason } from '../lib/season.js';
import { isHydeTeam } from '../lib/hyde.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../data/fixtures.json');

const MANCHESTER_URL = 'https://www.manchesterbadmintonleague.org.uk/fixtures.php';
const TAMESIDE_URL = 'https://tameside-badminton.co.uk/fixtures/club-Hyde';

// Manchester and Tameside are different leagues with their own team naming —
// Manchester enters Hyde's squads as "Hyde 1"/"Hyde O", Tameside as "Hyde
// A"/"Hyde B"/"Hyde C". Kept as distinct teams rather than merged, since a
// visitor picking "Hyde 1" wants Manchester results, not a blend of both.

// ── Manchester (HTML scrape) ─────────────────────────────────────────────────

function parseManchesterDate(raw) {
  // Raw format: "DD/MM/YYYY"
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => parseInt(p, 10));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day, 19, 0, 0).toISOString();
}

async function fetchManchester() {
  console.log('Fetching Manchester fixtures…');
  const res = await fetch(MANCHESTER_URL);
  if (!res.ok) throw new Error(`Manchester page ${res.status}`);
  const html = await res.text();
  const $ = load(html);

  const fixtures = [];

  // Table rows are [Date, Day, Div, "Home v Away", Result]; row 0 is the header.
  $('#listfixtures tr').each((i, row) => {
    if (i === 0) return;
    const cells = $(row)
      .find('td, th')
      .map((_, c) => $(c).text().trim())
      .get();
    const [dateStr, , division, fixtureText, resultText] = cells;
    if (!fixtureText || !fixtureText.includes(' v ')) return;

    const [homeTeam, awayTeam] = fixtureText.split(' v ').map((t) => t.trim());
    if (!isHydeTeam(homeTeam) && !isHydeTeam(awayTeam)) return;

    const isHome = isHydeTeam(homeTeam);
    const team = isHome ? homeTeam : awayTeam;
    const opposition = isHome ? awayTeam : homeTeam;

    const date = parseManchesterDate(dateStr);
    if (!date) return;

    const scoreMatch = resultText && resultText.match(/(\d+)\s*-\s*(\d+)/);
    const played = Boolean(scoreMatch);
    const homeScore = played ? parseInt(scoreMatch[1], 10) : null;
    const awayScore = played ? parseInt(scoreMatch[2], 10) : null;

    fixtures.push({
      id: `manchester-${date}-${homeTeam.replace(/\s+/g, '-')}-${awayTeam.replace(/\s+/g, '-')}`,
      league: 'Manchester',
      date,
      season: computeSeason(date),
      team,
      opposition,
      homeOrAway: isHome ? 'home' : 'away',
      competition: division || 'Manchester League',
      status: played ? 'complete' : 'outstanding',
      homeScore,
      awayScore,
      result: played ? `${homeScore} - ${awayScore}` : '',
    });
  });

  console.log(`  → ${fixtures.length} Manchester fixtures`);
  return fixtures;
}

// ── Tameside (JSON API, club-wide) ───────────────────────────────────────────

async function fetchTameside() {
  console.log('Fetching Tameside fixtures…');
  const res = await fetch(TAMESIDE_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Tameside API ${res.status}`);

  const raw = await res.json();
  const fixtures = [];

  for (const f of raw) {
    const homeTeam = f.homeTeam ?? '';
    const awayTeam = f.awayTeam ?? '';
    const isHome = isHydeTeam(homeTeam);
    const isAway = isHydeTeam(awayTeam);
    if (!isHome && !isAway) continue;

    const team = isHome ? homeTeam : awayTeam;
    const opposition = isHome ? awayTeam : homeTeam;
    const homeScore = f.homeScore ?? null;
    const awayScore = f.awayScore ?? null;
    const status = f.status === 'outstanding' ? 'outstanding' : 'complete';
    const played = status === 'complete' && homeScore !== null && awayScore !== null;

    fixtures.push({
      id: `tameside-${f.id}`,
      league: 'Tameside',
      date: f.date,
      season: computeSeason(f.date),
      team,
      opposition,
      homeOrAway: isHome ? 'home' : 'away',
      competition: 'Tameside',
      status: played ? 'complete' : 'outstanding',
      homeScore,
      awayScore,
      result: played ? `${homeScore} - ${awayScore}` : '',
    });
  }

  console.log(`  → ${fixtures.length} Tameside fixtures`);
  return fixtures;
}

// Preserve past-season fixtures that predate the current live feed, so the site
// accumulates a historical archive instead of only ever showing the live season.
// The league sites drop old seasons once a new one starts; anything older than
// the earliest freshly-scraped fixture is kept from the existing data.
//
// Re-scraped fixtures (same id) are always represented by their fresh version,
// never archived — otherwise a fixture whose date moves (e.g. a placeholder date
// before the real one is published) would leave a stale duplicate behind.
function archiveAndMerge(scraped, existing) {
  if (!scraped.length) return existing;
  const earliest = scraped.reduce((min, f) => (f.date < min ? f.date : min), scraped[0].date);
  const scrapedIds = new Set(scraped.map((f) => f.id));
  const archived = existing.filter((f) => f.date < earliest && !scrapedIds.has(f.id));
  return [...archived, ...scraped];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let existing = { fixtures: [], lastUpdated: null };
  try {
    existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
  } catch {
    // First run
  }

  const existingManchester = existing.fixtures.filter((f) => f.id.startsWith('manchester-'));
  const existingTameside = existing.fixtures.filter((f) => f.id.startsWith('tameside-'));

  let manchesterFixtures = existingManchester;
  let tamesideFixtures = existingTameside;
  let anyError = false;

  try {
    manchesterFixtures = await fetchManchester();
  } catch (err) {
    console.error('Manchester fetch failed:', err.message);
    console.warn('  Keeping existing Manchester data.');
    anyError = true;
  }

  try {
    tamesideFixtures = await fetchTameside();
  } catch (err) {
    console.error('Tameside fetch failed:', err.message);
    console.warn('  Keeping existing Tameside data.');
    anyError = true;
  }

  const manchester = archiveAndMerge(manchesterFixtures, existingManchester);
  const tameside = archiveAndMerge(tamesideFixtures, existingTameside);

  const combined = [...manchester, ...tameside].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const output = {
    fixtures: combined,
    lastUpdated: anyError ? existing.lastUpdated : new Date().toISOString(),
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${combined.length} fixtures to ${OUTPUT}`);
}

main().catch((err) => {
  console.error('Fatal scraper error:', err);
  process.exit(1);
});
