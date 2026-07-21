// Shared by app.js (CommonJS) and scripts/scrape-fixtures.mjs (ESM, via Node's
// CJS interop) so both agree on where a season boundary falls.
//
// UK club badminton seasons run roughly August through May, so a fixture's
// season is the year its August–July window started in.
function computeSeason(dateIso) {
  const d = new Date(dateIso);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
}

function seasonLabel(season) {
  return `${season.slice(0, 4)}-${season.slice(4)}`;
}

module.exports = { computeSeason, seasonLabel };
