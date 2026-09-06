export class AdminError extends Error {
  readonly kind: 'conflict' | 'validation' | 'permission' | 'missing' | 'network';
  constructor(kind: AdminError['kind'], message: string) {
    super(message);
    this.kind = kind;
  }
}
export function databaseError(error: { code?: string } | null): AdminError {
  switch (error?.code) {
    case 'PT409':
    case '40001':
    case 'PGRST116':
      return new AdminError(
        'conflict',
        'Hay una revisión más reciente. Conservamos tus cambios: recarga el registro antes de volver a guardar.',
      );
    case '23505':
      return new AdminError(
        'validation',
        'Ese slug, número o relación ya existe. Elige otro valor.',
      );
    case '23503':
      return new AdminError(
        'validation',
        'Hay una referencia en uso o un recurso que ya no está disponible. Revisa las relaciones.',
      );
    case '23514':
    case '23502':
    case '22023':
    case '22P02':
      return new AdminError(
        'validation',
        'Revisa los campos obligatorios, fechas, estados y referencias.',
      );
    case '42501':
    case 'PGRST301':
      return new AdminError(
        'permission',
        'No se pudo autorizar esta operación. Comprueba tu sesión.',
      );
    default:
      return new AdminError(
        'network',
        'No se pudo guardar. Tus cambios se conservan; comprueba la conexión y reintenta.',
      );
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof AdminError
    ? error.message
    : 'No se pudo completar la operación. Comprueba la conexión y reintenta.';
}
