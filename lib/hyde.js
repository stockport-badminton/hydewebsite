function isHydeTeam(name) {
  return Boolean(name) && name.toLowerCase().includes('hyde');
}

module.exports = { isHydeTeam };
