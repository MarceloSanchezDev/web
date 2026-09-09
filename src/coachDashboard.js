export function buildCoachDashboard(data, now = new Date(), selectedTeamId) {
  const assigned = data.info.filter(({ team }) => team.canWrite === true);
  const selected = assigned.find(({ team }) => team.id === selectedTeamId) || assigned[0] || null;
  const players = selected
    ? data.players.filter(player => player.teams.some(membership => membership.teamId === selected.team.id))
    : [];
  const trainings = (selected?.events || [])
    .filter(event => (event.type || 'TRAINING') === 'TRAINING')
    .map(event => ({ ...event, teamName: selected.team.name, teamId: selected.team.id }))
    .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  const attendance = selected?.statistics?.summary || {};

  return {
    assignedTeams: assigned.map(({ team }) => team),
    selectedTeam: selected?.team || null,
    nextTraining: trainings.find(training => new Date(training.startsAt) >= now) || null,
    activePlayers: players.length,
    attendanceRate: attendance.totalRecords ? Math.round(((attendance.present || 0) / attendance.totalRecords) * 100) : 0,
    trainingCount: trainings.filter(training => new Date(training.startsAt).getFullYear() === now.getFullYear()).length
  };
}
