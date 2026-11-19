/**
 * Contratos de RRHH (payroll de operación): personal, turnos, asistencia y
 * propinas. Son la única fuente de tipos para la API y la web del módulo.
 */

export type EstadoAsistencia = 'PRESENTE' | 'TARDANZA' | 'FALTA' | 'DESCANSO';
export type BloqueTurno = 'MANANA' | 'TARDE' | 'NOCHE';
export type EstadoPozo = 'CALCULADO' | 'REPARTIDO';

export type Empleado = {
  id: string;
  nombre: string;
  sucursalId: string;
  activo: boolean;
  rol: string | null;
};

export type Asistencia = {
  id: string;
  empleadoId: string;
  empleado: string;
  fecha: string;
  estado: EstadoAsistencia;
  horaEntrada: string | null;
  horaSalida: string | null;
  fuente: string | null;
};

export type Turno = {
  id: string;
  empleadoId: string;
  empleado: string;
  fecha: string;
  bloque: BloqueTurno;
};

export type PozoPropina = {
  id: string;
  fecha: string;
  total: number;
  beneficiarios: number;
  estado: EstadoPozo;
};

export type MarcacionInput = {
  empleadoId: string;
  estado: EstadoAsistencia;
  fecha?: string;
  horaEntrada?: string;
  horaSalida?: string;
  sucursalId?: string;
};

export type TurnoInput = {
  empleadoId: string;
  fecha: string;
  bloque: BloqueTurno;
  sucursalId?: string;
};

export const ESTADOS_ASISTENCIA: readonly EstadoAsistencia[] = [
  'PRESENTE',
  'TARDANZA',
  'FALTA',
  'DESCANSO',
];

export const BLOQUES_TURNO: readonly BloqueTurno[] = ['MANANA', 'TARDE', 'NOCHE'];

export function isEstadoAsistencia(value: string): value is EstadoAsistencia {
  return (ESTADOS_ASISTENCIA as readonly string[]).includes(value);
}

export function isBloqueTurno(value: string): value is BloqueTurno {
  return (BLOQUES_TURNO as readonly string[]).includes(value);
}

/** Devuelve el mensaje de error o `null` si la marcación es válida. */
export function validarMarcacion(input: {
  empleadoId?: string;
  estado?: string;
}): string | null {
  if (!input.empleadoId || !input.empleadoId.trim()) return 'Falta el empleado';
  if (!input.estado || !isEstadoAsistencia(input.estado)) return 'Estado de asistencia inválido';
  return null;
}

/** Etiqueta para la UI. */
export function etiquetaAsistencia(estado: EstadoAsistencia): string {
  switch (estado) {
    case 'TARDANZA':
      return 'Tardanza';
    case 'FALTA':
      return 'Falta';
    case 'DESCANSO':
      return 'Descanso';
    default:
      return 'Presente';
  }
}

/** Etiqueta del bloque de turno. */
export function etiquetaBloque(bloque: BloqueTurno): string {
  return bloque === 'MANANA' ? 'Mañana' : bloque === 'TARDE' ? 'Tarde' : 'Noche';
}
