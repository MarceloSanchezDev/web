export const physicalMeasurements = [
  ['heightCm', 'Altura', 'cm'],
  ['weightKg', 'Peso', 'kg'],
  ['speedKmh', 'Velocidad', 'km/h'],
  ['physicalPerformance', 'Desempeño', '/100'],
  ['abalakovJumpCm', 'Abalakov', 'cm'],
  ['squatJumpCm', 'Squat Jump', 'cm'],
  ['countermovementJumpCm', 'Countermovement', 'cm'],
  ['squatResult', 'Sentadilla', ''],
  ['benchPressResult', 'Pecho plano', ''],
  ['latPulldownResult', 'Dorsalera', '']
];

const hasValue = value => value !== null && value !== undefined && value !== '';

export function missingPhysicalMeasurements(player) {
  return physicalMeasurements.filter(([field]) => !hasValue(player[field])).map(([, label]) => label);
}

export function buildPhysicalTrainerDashboard(data, selectedTeamId, metric = 'physicalPerformance', now = new Date()) {
  const assigned = data.info.filter(({ team }) => team.canEditPhysical === true);
  const selected = assigned.find(({ team }) => team.id === selectedTeamId) || assigned[0] || null;
  const players = selected
    ? data.players.filter(player => player.teams.some(membership => membership.teamId === selected.team.id))
    : [];
  const pending = players
    .map(player => ({ player, missing: missingPhysicalMeasurements(player) }))
    .filter(item => item.missing.length)
    .sort((left, right) => right.missing.length - left.missing.length || left.player.name.localeCompare(right.player.name));
  const completed = players.length - pending.length;
  const physicalEvents = (selected?.events || [])
    .filter(event => event.type === 'PHYSICAL_TRAINING')
    .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  const attendanceRecords = (selected?.attendance || []).flatMap(session => session.records || []);
  const present = attendanceRecords.filter(record => record.status === 'PRESENT').length;
  const metricDefinition = physicalMeasurements.find(([field]) => field === metric) || physicalMeasurements[3];
  const metricValues = players
    .filter(player => typeof player[metricDefinition[0]] === 'number')
    .map(player => ({ id: player.id, name: player.name, value: player[metricDefinition[0]] }))
    .sort((left, right) => right.value - left.value);

  return {
    assignedTeams: assigned.map(({ team }) => team),
    selectedTeam: selected?.team || null,
    players,
    pending,
    completed,
    completeness: players.length ? Math.round((completed / players.length) * 100) : 0,
    attendanceRate: attendanceRecords.length ? Math.round((present / attendanceRecords.length) * 100) : 0,
    attendanceRecords: attendanceRecords.length,
    nextPhysicalTraining: physicalEvents.find(event => new Date(event.startsAt) >= now) || null,
    physicalTrainingCount: physicalEvents.length,
    metric: metricDefinition,
    metricValues,
    metricAverage: metricValues.length ? metricValues.reduce((total, item) => total + item.value, 0) / metricValues.length : null
  };
}
