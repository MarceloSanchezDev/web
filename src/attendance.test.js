import test from 'node:test';
import assert from 'node:assert/strict';
import { saveAttendance } from './attendance.js';

const existingError = () => Object.assign(new Error('Ya existe una asistencia para esa fecha'), {
  code: 'ATTENDANCE_EXISTS',
  status: 409
});

test('creates attendance when the date is still available', async () => {
  const calls = [];
  const api = async (path, options) => {
    calls.push([path, options]);
    return { id: 'attendance-1' };
  };

  const result = await saveAttendance({
    api,
    teamId: 'team-1',
    date: '2026-08-27',
    records: [{ playerId: 'player-1', status: 'PRESENT' }]
  });

  assert.equal(result.updatedExisting, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/teams/team-1/attendance');
  assert.equal(calls[0][1].method, 'POST');
});

test('returns the existing day as a warning after ATTENDANCE_EXISTS', async () => {
  const paths = [];
  const api = async (path, options) => {
    paths.push(path);
    if (path === '/teams/team-1/attendance') throw existingError();
    if (path.startsWith('/teams/team-1/attendance?')) return [{ id: 'attendance-1', date: '2026-08-27T00:00:00.000Z', eventId: null }];
    assert.equal(options, undefined);
  };

  await assert.rejects(saveAttendance({
    api, teamId: 'team-1', date: '2026-08-27',
    records: [{ playerId: 'player-1', status: 'ABSENT' }]
  }), error => error.code === 'ATTENDANCE_EXISTS' && error.existingAttendance.id === 'attendance-1');
  assert.deepEqual(paths, [
    '/teams/team-1/attendance',
    '/teams/team-1/attendance?from=2026-08-27&to=2026-08-27'
  ]);
});

test('does not overwrite attendance linked to another event', async () => {
  const api = async path => {
    if (path === '/teams/team-1/attendance') throw existingError();
    return [{ id: 'attendance-1', date: '2026-08-27T00:00:00.000Z', eventId: 'event-other' }];
  };

  await assert.rejects(
    saveAttendance({
      api,
      teamId: 'team-1',
      eventId: 'event-current',
      date: '2026-08-27',
      records: [{ playerId: 'player-1', status: 'PRESENT' }]
    }),
    error => error.code === 'ATTENDANCE_EXISTS' && error.linkedToAnotherEvent === true
  );
});

test('updates a known attendance session directly', async () => {
  const calls = [];
  const api = async (path, options) => {
    calls.push([path, options]);
    return { id: 'attendance-1' };
  };

  const result = await saveAttendance({
    api,
    teamId: 'team-1',
    sessionId: 'attendance-1',
    date: '2026-08-27',
    records: [{ playerId: 'player-1', status: 'EXCUSED' }]
  });

  assert.equal(result.updatedExisting, true);
  assert.equal(calls[0][0], '/attendance/attendance-1');
  assert.equal(calls[0][1].method, 'PUT');
});
