import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachDashboard } from './coachDashboard.js';

const team = (id, name, canWrite, events = [], summary = {}) => ({
  team: { id, name, canWrite },
  events,
  statistics: { summary }
});

test('builds coach metrics for the selected assigned team only', () => {
  const data = {
    info: [
      team('assigned', 'U17', true, [
        { id: 'past', title: 'Técnica', type: 'TRAINING', startsAt: '2026-03-10T18:00:00.000Z' },
        { id: 'next', title: 'Táctica', type: 'TRAINING', startsAt: '2026-09-10T18:00:00.000Z' },
        { id: 'match', title: 'Fecha 1', type: 'MATCH', startsAt: '2026-09-11T18:00:00.000Z' }
      ], { present: 15, totalRecords: 20 }),
      team('second', 'U19', true, [
        { id: 'other', title: 'Otro entrenamiento', type: 'TRAINING', startsAt: '2026-09-09T20:00:00.000Z' }
      ], { present: 100, totalRecords: 100 })
    ],
    players: [
      { id: 'one', teams: [{ teamId: 'assigned' }] },
      { id: 'two', teams: [{ teamId: 'assigned' }, { teamId: 'second' }] },
      { id: 'other-player', teams: [{ teamId: 'second' }] }
    ]
  };

  assert.deepEqual(buildCoachDashboard(data, new Date('2026-09-09T12:00:00.000Z'), 'assigned'), {
    assignedTeams: [
      { id: 'assigned', name: 'U17', canWrite: true },
      { id: 'second', name: 'U19', canWrite: true }
    ],
    selectedTeam: { id: 'assigned', name: 'U17', canWrite: true },
    nextTraining: {
      id: 'next', title: 'Táctica', type: 'TRAINING', startsAt: '2026-09-10T18:00:00.000Z',
      teamName: 'U17', teamId: 'assigned'
    },
    activePlayers: 2,
    attendanceRate: 75,
    trainingCount: 2
  });
});

test('returns safe empty values when the coach has no assigned teams', () => {
  assert.deepEqual(buildCoachDashboard({ info: [], players: [] }), {
    assignedTeams: [],
    selectedTeam: null,
    nextTraining: null,
    activePlayers: 0,
    attendanceRate: 0,
    trainingCount: 0
  });
});

test('recalculates the dashboard when another assigned team is selected', () => {
  const data = {
    info: [
      team('u17', 'U17', true, [], { present: 2, totalRecords: 4 }),
      team('u19', 'U19', true, [
        { id: 'u19-next', title: 'Sistemas', type: 'TRAINING', startsAt: '2026-10-01T20:00:00.000Z' }
      ], { present: 9, totalRecords: 10 })
    ],
    players: [
      { id: 'u17-player', teams: [{ teamId: 'u17' }] },
      { id: 'u19-player-1', teams: [{ teamId: 'u19' }] },
      { id: 'u19-player-2', teams: [{ teamId: 'u19' }] }
    ]
  };

  const dashboard = buildCoachDashboard(data, new Date('2026-09-09T12:00:00.000Z'), 'u19');
  assert.equal(dashboard.selectedTeam.id, 'u19');
  assert.equal(dashboard.nextTraining.id, 'u19-next');
  assert.equal(dashboard.activePlayers, 2);
  assert.equal(dashboard.attendanceRate, 90);
  assert.equal(dashboard.trainingCount, 1);
});
