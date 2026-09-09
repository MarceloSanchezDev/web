const eventType = event => event.type || 'TRAINING';

export function buildDirectorDashboard(data, now = new Date()) {
  const allEvents = data.info
    .flatMap(({ team, events = [] }) => events.map(event => ({ ...event, teamId: team.id, teamName: team.name })))
    .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const actionableEvents = allEvents.filter(event => data.info.find(item => item.team.id === event.teamId)?.team.canWrite === true);
  const pendingAttendance = actionableEvents.filter(event => new Date(event.startsAt) < now && !event.attendanceSession).length;
  const pendingPlans = actionableEvents.filter(event => new Date(event.startsAt) >= now && eventType(event) === 'TRAINING' && !event.trainingPlan).length;
  const incompletePlayers = data.players.filter(player => !player.position || !player.currentClub).length;
  const monthly = new Map();
  let present = 0;
  let totalRecords = 0;

  const teams = data.info.map(({ team, events = [], statistics }) => {
    const summary = statistics?.summary || {};
    present += summary.present || 0;
    totalRecords += summary.totalRecords || 0;
    for (const month of statistics?.monthly || []) {
      const aggregate = monthly.get(month.month) || { month: month.month, present: 0, totalRecords: 0 };
      aggregate.present += month.present || 0;
      aggregate.totalRecords += month.totalRecords || 0;
      monthly.set(month.month, aggregate);
    }
    return {
      id: team.id,
      name: team.name,
      category: team.category?.name || 'Sin categoría',
      players: team._count?.players || 0,
      attendanceRate: summary.totalRecords ? Math.round((summary.present / summary.totalRecords) * 100) : null,
      attendanceRecords: summary.totalRecords || 0,
      nextEvent: events.find(event => new Date(event.startsAt) >= now) || null
    };
  });

  const lowAttendance = teams
    .filter(team => team.attendanceRate !== null && team.attendanceRate < 75)
    .sort((left, right) => left.attendanceRate - right.attendanceRate);
  const alerts = [
    ...lowAttendance.slice(0, 2).map(team => ({
      icon: 'trending_down',
      title: `${team.name} tiene ${team.attendanceRate}% de asistencia`,
      detail: 'Está por debajo del objetivo recomendado del 75%.',
      path: `/equipos/${team.id}/estadisticas`,
      tone: 'warning'
    })),
    ...(pendingAttendance ? [{ icon: 'fact_check', title: `${pendingAttendance} asistencia${pendingAttendance === 1 ? '' : 's'} por completar`, detail: 'Hay actividades anteriores sin registro de asistencia.', path: '/equipos', tone: 'danger' }] : []),
    ...(pendingPlans ? [{ icon: 'event_note', title: `${pendingPlans} planificación${pendingPlans === 1 ? '' : 'es'} pendiente${pendingPlans === 1 ? '' : 's'}`, detail: 'Hay entrenamientos próximos todavía sin planificación.', path: '/equipos', tone: 'warning' }] : []),
    ...(incompletePlayers ? [{ icon: 'person_search', title: `${incompletePlayers} ficha${incompletePlayers === 1 ? '' : 's'} por completar`, detail: 'Falta posición o club actual en estos jugadores.', path: '/jugadores', tone: 'info' }] : []),
    ...((data.invitations?.length || 0) ? [{ icon: 'mail', title: `${data.invitations.length} invitación${data.invitations.length === 1 ? '' : 'es'} pendiente${data.invitations.length === 1 ? '' : 's'}`, detail: 'Todavía no fueron aceptadas por el personal.', path: '/personal', tone: 'info' }] : [])
  ];

  return {
    teams,
    teamCount: teams.length,
    playerCount: data.players.length,
    attendanceRate: totalRecords ? Math.round((present / totalRecords) * 100) : 0,
    activityCount: allEvents.filter(event => new Date(event.startsAt) >= now && new Date(event.startsAt) < weekEnd).length,
    upcoming: allEvents.filter(event => new Date(event.startsAt) >= now).slice(0, 6),
    monthly: [...monthly.values()].sort((left, right) => left.month.localeCompare(right.month)).map(month => ({
      ...month,
      attendanceRate: month.totalRecords ? Math.round((month.present / month.totalRecords) * 100) : 0
    })),
    alerts,
    pendingAttendance,
    pendingPlans
  };
}
