const attendanceDay = value => new Date(value).toISOString().slice(0, 10);

export async function saveAttendance({ api, teamId, sessionId, eventId, date, records }) {
  const body = { records, ...(eventId ? { eventId } : {}) };

  if (sessionId) {
    return {
      attendance: await api(`/attendance/${sessionId}`, { method: 'PUT', body: JSON.stringify(body) }),
      updatedExisting: true
    };
  }

  try {
    return {
      attendance: await api(`/teams/${teamId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ ...body, date })
      }),
      updatedExisting: false
    };
  } catch (error) {
    if (error.code !== 'ATTENDANCE_EXISTS') throw error;

    const queryDate = encodeURIComponent(attendanceDay(date));
    const sessions = await api(`/teams/${teamId}/attendance?from=${queryDate}&to=${queryDate}`);
    const existing = sessions.find(item => attendanceDay(item.date) === attendanceDay(date));
    if (!existing) throw error;

    const conflict = new Error(
      eventId && existing.eventId && existing.eventId !== eventId
        ? 'Ya hay una asistencia vinculada a otra actividad de este equipo en la misma fecha.'
        : 'Este equipo ya tiene una asistencia guardada para esa fecha.'
    );
    conflict.code = 'ATTENDANCE_EXISTS';
    conflict.status = 409;
    conflict.existingAttendance = existing;
    conflict.linkedToAnotherEvent = Boolean(eventId && existing.eventId && existing.eventId !== eventId);
    throw conflict;
  }
}
