export function buildMonitorDashboard(data, selectedTeamId, now = new Date()) {
  const assigned = data.info;
  const selected = assigned.find(({ team }) => team.id === selectedTeamId) || assigned[0] || null;
  const players = selected
    ? data.players.filter(player => player.teams.some(membership => membership.teamId === selected.team.id))
    : [];
  const events = [...(selected?.events || [])].sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  const todayKey = now.toDateString();
  const today = events.filter(event => new Date(event.startsAt).toDateString() === todayKey);
  const upcoming = events.filter(event => new Date(event.startsAt) >= now);
  const highlightedEvent = today[0] || upcoming[0] || null;
  const summary = selected?.statistics?.summary || {};

  return {
    assignedTeams: assigned.map(({ team }) => team),
    selectedTeam: selected?.team || null,
    players,
    today,
    upcoming: upcoming.slice(0, 5),
    highlightedEvent,
    attendanceRate: summary.totalRecords ? Math.round((summary.present / summary.totalRecords) * 100) : 0,
    attendanceRecords: summary.totalRecords || 0
  };
}
