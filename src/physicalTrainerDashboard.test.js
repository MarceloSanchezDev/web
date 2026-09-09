import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhysicalTrainerDashboard, missingPhysicalMeasurements } from './physicalTrainerDashboard.js';

const completePlayer = {
  id: 'p1', name: 'Ana', teams: [{ teamId: 't1' }], heightCm: 175, weightKg: 65, speedKmh: 24,
  physicalPerformance: 90, abalakovJumpCm: 35, squatJumpCm: 30, countermovementJumpCm: 32,
  squatResult: '60 kg', benchPressResult: '35 kg', latPulldownResult: '40 kg'
};
const data = {
  players: [completePlayer, { ...completePlayer, id: 'p2', name: 'Berta', physicalPerformance: null, speedKmh: 20 }],
  info: [{
    team: { id: 't1', name: 'U17', canEditPhysical: true },
    events: [
      { id: 'sport', type: 'TRAINING', startsAt: '2026-09-10T14:00:00Z' },
      { id: 'physical', type: 'PHYSICAL_TRAINING', startsAt: '2026-09-11T14:00:00Z' }
    ],
    attendance: [{ records: [{ status: 'PRESENT' }, { status: 'ABSENT' }] }]
  }]
};

test('builds the selected physical team dashboard from physical sessions only', () => {
  const dashboard = buildPhysicalTrainerDashboard(data, 't1', 'speedKmh', new Date('2026-09-09T12:00:00Z'));
  assert.equal(dashboard.players.length, 2);
  assert.equal(dashboard.pending.length, 1);
  assert.equal(dashboard.completeness, 50);
  assert.equal(dashboard.attendanceRate, 50);
  assert.equal(dashboard.nextPhysicalTraining.id, 'physical');
  assert.equal(dashboard.metricAverage, 22);
});

test('identifies every missing physical measurement', () => {
  const missing = missingPhysicalMeasurements({ ...completePlayer, weightKg: null, benchPressResult: '' });
  assert.deepEqual(missing, ['Peso', 'Pecho plano']);
});
