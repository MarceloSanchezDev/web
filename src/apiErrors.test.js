import test from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorMessage } from './apiErrors.js';

test('keeps a useful message returned by the API', () => {
  assert.equal(apiErrorMessage({ message: 'Ya existe una asistencia para esa fecha' }, 409), 'Ya existe una asistencia para esa fecha');
});

test('extracts the first validation detail', () => {
  assert.equal(apiErrorMessage({ message: 'Datos inválidos', details: { fieldErrors: { name: ['El nombre es obligatorio'] } } }, 400), 'El nombre es obligatorio');
});

test('provides useful fallbacks by HTTP status', () => {
  assert.match(apiErrorMessage({}, 403), /permisos/);
  assert.match(apiErrorMessage({}, 429), /intentos/);
  assert.match(apiErrorMessage({}, 500), /servidor/);
});
