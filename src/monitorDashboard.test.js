import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonitorDashboard } from './monitorDashboard.js';

const data = {
  players: [
    { id: 'p1', teams: [{ teamId: 't1' }] },
    { id: 'p2', teams: [{ teamId: 't2' }] }
  ],
  info: [
    {
      team: { id: 't1', name: 'U17' },
      events: [{ id: 'today', startsAt: '2026-09-09T18:00:00Z', attendanceSession: { id: 'a1' } }],
      statistics: { summary: { present: 8, totalRecords: 10 } }
    },
    { team: { id: 't2', name: 'U21' }, events: [], statistics: null }
  ]
};

test('limits the monitor home to the selected assigned team', () => {
  const dashboard = buildMonitorDashboard(data, 't1', new Date('2026-09-09T12:00:00Z'));
  assert.equal(dashboard.players.length, 1);
  assert.equal(dashboard.highlightedEvent.id, 'today');
  assert.equal(dashboard.attendanceRate, 80);
  assert.equal(dashboard.assignedTeams.length, 2);
});

test('returns a safe empty dashboard for an assigned team without activity', () => {
  const dashboard = buildMonitorDashboard(data, 't2', new Date('2026-09-09T12:00:00Z'));
  assert.equal(dashboard.players.length, 1);
  assert.equal(dashboard.highlightedEvent, null);
  assert.equal(dashboard.attendanceRate, 0);
});
