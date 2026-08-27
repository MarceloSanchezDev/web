const statusMessages = {
  400: 'Revisá los datos ingresados e intentá nuevamente.',
  403: 'No tenés permisos para realizar esta acción.',
  404: 'El elemento ya no existe o no está disponible.',
  409: 'La acción entra en conflicto con información que ya existe.',
  413: 'La información enviada supera el tamaño permitido.',
  429: 'Se realizaron demasiados intentos. Esperá un momento y volvé a probar.',
  500: 'El servidor no pudo completar la acción. Intentá nuevamente.',
  502: 'El servicio no está disponible temporalmente.',
  503: 'El servicio no está disponible temporalmente.'
};

function firstValidationMessage(details) {
  const fieldErrors = details?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    for (const messages of Object.values(fieldErrors)) {
      if (Array.isArray(messages) && messages[0]) return messages[0];
    }
  }
  return Array.isArray(details?.formErrors) ? details.formErrors[0] : null;
}

export function apiErrorMessage(data = {}, status = 0) {
  const validation = firstValidationMessage(data.details);
  if (validation) return validation;
  if (data.message && data.message !== 'Datos inválidos' && data.message !== 'Ocurrió un error inesperado') return data.message;
  return statusMessages[status] || 'No pudimos completar la acción. Revisá tu conexión e intentá nuevamente.';
}
