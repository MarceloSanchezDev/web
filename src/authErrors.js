const authMessages = {
  INVALID_CREDENTIALS: 'El correo o la contraseña no son correctos. Revisalos e intentá nuevamente.',
  REGISTRATION_UNAVAILABLE: 'No pudimos crear la cuenta con esos datos. Revisá la información o probá iniciar sesión.',
  RATE_LIMITED: 'Hubo demasiados intentos. Esperá unos minutos antes de volver a intentar.',
  VALIDATION_ERROR: 'Algunos datos no son válidos. Revisá todos los campos del formulario.'
};

export function userFacingAuthError(error, mode = 'login') {
  if (error?.code && authMessages[error.code]) return authMessages[error.code];
  if (error?.status >= 500) return 'El servicio no está disponible en este momento. Intentá nuevamente más tarde.';
  if (error?.message === 'No se pudo conectar con la API. Revisá la URL configurada.') {
    return 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá nuevamente.';
  }
  if (error?.message && error.message !== 'Ocurrió un error.') return error.message;
  return mode === 'register'
    ? 'No pudimos crear tu cuenta. Revisá los datos e intentá nuevamente.'
    : 'No pudimos iniciar sesión. Revisá tus datos e intentá nuevamente.';
}
