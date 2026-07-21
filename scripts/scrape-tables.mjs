/**
 * Fetches league standings for whichever divisions Hyde's teams actually play
 * in (rather than every division both leagues run) and writes tables.json.
 *
 * Sources:
 *   1. Manchester Badminton League — HTML table scrape (table.footable)
 *   2. Tameside Badminton League   — HTML table scrape (one <table> per division)
 *
 * Run: node scripts/scrape-tables.mjs
 * Or:  npm run scrape:tables
 */

import { load } from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { isHydeTeam } from '../lib/hyde.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../data/tables.json');

const MANCHESTER_URL = 'https://www.manchesterbadmintonleague.org.uk/tables.php';
const TAMESIDE_URL = 'https://tameside-badminton.co.uk/tables/All';

function slugify(league, name) {
  return `${league}-${name}`.toLowerCase().replace(/\s+/g, '-');
}

// ── Manchester (HTML scrape) ─────────────────────────────────────────────────

// The standings table has two header rows per division ("Division N" then the
// column names) followed by ranked data rows, then a blank row before the next
// division. Manchester publishes far more columns than a visitor needs (aces,
// penalty/conceded points) — only the ones below are kept.
const MANCHESTER_COLUMNS = ['Pos', 'Team', 'Played', 'Won', 'Drawn', 'Lost', 'Games/Match', 'Total Points'];
const MANCHESTER_KEEP_INDEXES = [0, 1, 2, 3, 4, 5, 12, 13];

async function fetchManchesterTables() {
  console.log('Fetching Manchester tables…');
  const res = await fetch(MANCHESTER_URL);
  if (!res.ok) throw new Error(`Manchester tables page ${res.status}`);
  const html = await res.text();
  const $ = load(html);

  const rowsByDivision = new Map();
  let currentDivision = null;

  $('table.footable').eq(0).find('tr').each((_, row) => {
    const cells = $(row).find('td, th').map((_, c) => $(c).text().trim()).get();
    // "Division 1"–"Division 4" and "Open Division A"/"Open Division B" are
    // all distinct groupings, so match on "Division" anywhere, not a prefix.
    if (cells[0] && cells[0].includes('Division')) {
      currentDivision = cells[0];
      return;
    }
    // Data rows start with a numeric rank; header/blank rows don't.
    if (!currentDivision || !/^\d+$/.test(cells[0])) return;
    if (!rowsByDivision.has(currentDivision)) rowsByDivision.set(currentDivision, []);
    rowsByDivision.get(currentDivision).push(cells);
  });

  const divisions = [];
  for (const [name, rows] of rowsByDivision) {
    const hydeTeams = [...new Set(rows.filter((r) => isHydeTeam(r[1])).map((r) => r[1]))];
    if (!hydeTeams.length) continue;

    divisions.push({
      id: slugify('manchester', name),
      league: 'Manchester',
      name,
      hydeTeams,
      columns: MANCHESTER_COLUMNS,
      rows: rows.map((r) => ({
        isHyde: isHydeTeam(r[1]),
        values: MANCHESTER_KEEP_INDEXES.map((i) => r[i]),
      })),
    });
  }

  console.log(`  → ${divisions.length} Manchester division(s) with Hyde teams`);
  return divisions;
}

// ── Tameside (HTML scrape) ───────────────────────────────────────────────────

async function fetchTamesideTables() {
  console.log('Fetching Tameside tables…');
  const res = await fetch(TAMESIDE_URL);
  if (!res.ok) throw new Error(`Tameside tables page ${res.status}`);
  const html = await res.text();
  const $ = load(html);

  const divisions = [];

  $('table').each((_, table) => {
    const rows = [];
    $(table).find('tr').each((_, r) => {
      rows.push($(r).find('td, th').map((_, c) => $(c).text().trim()).get());
    });
    const [header, ...dataRows] = rows;
    if (!header || !header[0] || !header[0].startsWith('Division')) return;

    const name = header[0];
    const columns = ['Team', ...header.slice(1).map((h) => h.charAt(0).toUpperCase() + h.slice(1))];
    const validRows = dataRows.filter((r) => r.length === header.length && r[0]);
    const hydeTeams = [...new Set(validRows.filter((r) => isHydeTeam(r[0])).map((r) => r[0]))];
    if (!hydeTeams.length) return;

    divisions.push({
      id: slugify('tameside', name),
      league: 'Tameside',
      name,
      hydeTeams,
      columns,
      rows: validRows.map((r) => ({ isHyde: isHydeTeam(r[0]), values: r })),
    });
  });

  console.log(`  → ${divisions.length} Tameside division(s) with Hyde teams`);
  return divisions;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let existing = { divisions: [], lastUpdated: null };
  try {
    existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
  } catch {
    // First run
  }
  const existingManchester = existing.divisions.filter((d) => d.league === 'Manchester');
  const existingTameside = existing.divisions.filter((d) => d.league === 'Tameside');

  let anyError = false;
  const manchester = await fetchManchesterTables().catch((err) => {
    console.error('Manchester tables fetch failed:', err.message);
    console.warn('  Keeping existing Manchester data.');
    anyError = true;
    return existingManchester;
  });
  const tameside = await fetchTamesideTables().catch((err) => {
    console.error('Tameside tables fetch failed:', err.message);
    console.warn('  Keeping existing Tameside data.');
    anyError = true;
    return existingTameside;
  });

  const output = {
    divisions: [...manchester, ...tameside],
    lastUpdated: anyError ? existing.lastUpdated : new Date().toISOString(),
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${output.divisions.length} division tables to ${OUTPUT}`);
}

main().catch((err) => {
  console.error('Fatal scraper error:', err);
  process.exit(1);
});
