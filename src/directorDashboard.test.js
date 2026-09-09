import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDirectorDashboard } from './directorDashboard.js';

const now = new Date('2026-09-09T12:00:00.000Z');
const data = {
  players: [
    { id: 'p1', position: 'Base', currentClub: 'BasketStaff' },
    { id: 'p2', position: null, currentClub: 'BasketStaff' }
  ],
  invitations: [{ id: 'i1' }],
  info: [
    {
      team: { id: 't1', name: 'U17', canWrite: true, category: { name: 'Formativas' }, _count: { players: 2 } },
      events: [
        { id: 'past', title: 'Entrenamiento anterior', startsAt: '2026-09-08T15:00:00.000Z', type: 'TRAINING' },
        { id: 'next', title: 'Próximo entrenamiento', startsAt: '2026-09-10T15:00:00.000Z', type: 'TRAINING' }
      ],
      statistics: {
        summary: { present: 6, totalRecords: 10 },
        monthly: [{ month: '2026-09', present: 6, totalRecords: 10 }]
      }
    },
    {
      team: { id: 't2', name: 'U21', canWrite: true, category: { name: 'Mayores' }, _count: { players: 4 } },
      events: [],
      statistics: {
        summary: { present: 9, totalRecords: 10 },
        monthly: [{ month: '2026-09', present: 9, totalRecords: 10 }]
      }
    }
  ]
};

test('combines real organization metrics for leadership', () => {
  const dashboard = buildDirectorDashboard(data, now);
  assert.equal(dashboard.teamCount, 2);
  assert.equal(dashboard.playerCount, 2);
  assert.equal(dashboard.attendanceRate, 75);
  assert.equal(dashboard.activityCount, 1);
  assert.equal(dashboard.monthly[0].attendanceRate, 75);
});

test('creates actionable alerts and keeps team attendance independent', () => {
  const dashboard = buildDirectorDashboard(data, now);
  assert.equal(dashboard.teams.find(team => team.id === 't1').attendanceRate, 60);
  assert.equal(dashboard.teams.find(team => team.id === 't2').attendanceRate, 90);
  assert.ok(dashboard.alerts.some(alert => alert.path === '/equipos/t1/estadisticas'));
  assert.ok(dashboard.alerts.some(alert => alert.path === '/personal'));
  assert.equal(dashboard.pendingAttendance, 1);
  assert.equal(dashboard.pendingPlans, 1);
});
