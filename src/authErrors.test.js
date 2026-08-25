import test from 'node:test';
import assert from 'node:assert/strict';
import { userFacingAuthError } from './authErrors.js';

test('explains invalid credentials', () => {
  assert.match(userFacingAuthError({ code: 'INVALID_CREDENTIALS' }), /correo o la contraseña/i);
});

test('explains rate limiting and connection failures', () => {
  assert.match(userFacingAuthError({ code: 'RATE_LIMITED' }), /demasiados intentos/i);
  assert.match(userFacingAuthError({ message: 'No se pudo conectar con la API. Revisá la URL configurada.' }), /conectarnos con el servidor/i);
});

test('uses a safe fallback for server failures', () => {
  assert.match(userFacingAuthError({ status: 503 }, 'register'), /no está disponible/i);
});
