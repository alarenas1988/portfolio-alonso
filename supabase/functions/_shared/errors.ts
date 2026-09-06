export type ErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'too_large'
  | 'rate_limited'
  | 'conflict'
  | 'not_found'
  | 'not_configured'
  | 'temporary_failure';
const messages: Record<ErrorCode, string> = {
  invalid_request: 'Revisa la solicitud.',
  unauthorized: 'La sesión no es válida.',
  forbidden: 'La operación no está permitida.',
  too_large: 'La solicitud supera el tamaño permitido.',
  rate_limited: 'Espera unos minutos antes de volver a intentarlo.',
  conflict: 'La solicitud ya existe con otros datos o estado.',
  not_found: 'No se encontró la solicitud.',
  not_configured: 'El servicio aún no está disponible.',
  temporary_failure: 'No se pudo completar la operación. Inténtalo nuevamente.',
};
export class EdgeError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public retryAfter?: number,
  ) {
    super(messages[code]);
  }
}
export function invalid(): never {
  throw new EdgeError(400, 'invalid_request');
}
