function isHydeTeam(name) {
  return Boolean(name) && name.toLowerCase().includes('hyde');
}

// 'win' | 'loss' | 'draw' from Hyde's side of a scraped fixture, or null if
// it hasn't been played. Used by the fixtures page badges and push results.
function outcomeFor(fixture) {
  if (fixture.status !== 'complete' || fixture.homeScore == null || fixture.awayScore == null) return null;
  const hydeScore = fixture.homeOrAway === 'home' ? fixture.homeScore : fixture.awayScore;
  const oppScore = fixture.homeOrAway === 'home' ? fixture.awayScore : fixture.homeScore;
  if (hydeScore === oppScore) return 'draw';
  return hydeScore > oppScore ? 'win' : 'loss';
}

module.exports = { isHydeTeam, outcomeFor };
