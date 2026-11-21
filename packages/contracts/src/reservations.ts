/**
 * Contratos de reservas del salón.
 *
 * La API filtra el día en hora de Lima (`fecha=YYYY-MM-DD`) y devuelve
 * `fecha_hora` con offset `-05:00`; aquí viven los helpers de presentación para
 * que la feature no repita la aritmética de zonas horarias.
 *
 * Estados: `POR_CONFIRMAR` es editable; los terminales (`EJECUTADA`,
 * `CANCELADA`, `NO_SHOW`) no se reabren.
 */

export type EstadoReserva = 'POR_CONFIRMAR' | 'CONFIRMADA' | 'EJECUTADA' | 'CANCELADA' | 'NO_SHOW';

export type Reserva = {
  id: string;
  /** Folio visible (`RSV-20261031-0001`). */
  codigo: string;
  mesaId: string;
  /** Número de mesa si la API lo anida en `mesas`. */
  mesaNumero: string | null;
  clienteNombre: string;
  telefono: string | null;
  comensales: number;
  /** ISO con offset de Lima (`2026-10-29T20:00:00-05:00`). */
  fechaHora: string;
  estado: EstadoReserva;
  canal: string | null;
  notas: string | null;
  sucursalId: string;
};

export type ReservaInput = {
  mesaId: string;
  clienteNombre: string;
  telefono?: string;
  comensales: number;
  fechaHora: string;
  canal?: string;
  notas?: string;
};

export type ReservaUpdate = Partial<ReservaInput>;

export const ESTADOS_RESERVA: readonly EstadoReserva[] = [
  'POR_CONFIRMAR',
  'CONFIRMADA',
  'EJECUTADA',
  'CANCELADA',
  'NO_SHOW',
];

export function isEstadoReserva(value: string): value is EstadoReserva {
  return (ESTADOS_RESERVA as readonly string[]).includes(value);
}

/** Devuelve el mensaje de error o `null` si la reserva es válida. */
export function validarReserva(input: {
  mesaId?: string;
  clienteNombre?: string;
  comensales?: number;
  fechaHora?: string;
}): string | null {
  if (!input.clienteNombre || !input.clienteNombre.trim()) return 'Falta el nombre del cliente';
  if (!input.mesaId || !input.mesaId.trim()) return 'Elige una mesa';
  if (!Number.isFinite(input.comensales) || (input.comensales ?? 0) < 1) {
    return 'La reserva necesita al menos 1 comensal';
  }
  if (!input.fechaHora || Number.isNaN(new Date(input.fechaHora).getTime())) {
    return 'Fecha y hora de la reserva inválidas';
  }
  return null;
}

/** Una reserva viva ocupa la mesa en el mapa. */
export function reservaActiva(estado: EstadoReserva): boolean {
  return estado === 'POR_CONFIRMAR' || estado === 'CONFIRMADA';
}

/** Solo `POR_CONFIRMAR` se puede editar (los terminales no se reabren). */
export function reservaEditable(estado: EstadoReserva): boolean {
  return estado === 'POR_CONFIRMAR';
}

/** Etiqueta para la UI. */
export function etiquetaEstadoReserva(estado: EstadoReserva): string {
  switch (estado) {
    case 'POR_CONFIRMAR':
      return 'Por confirmar';
    case 'EJECUTADA':
      return 'Llegó';
    case 'CANCELADA':
      return 'Cancelada';
    case 'NO_SHOW':
      return 'No-show';
    default:
      return 'Confirmada';
  }
}

/* ------------------------------ día de Lima ------------------------------ */

const OFFSET_LIMA_MS = 5 * 60 * 60 * 1000;

/** `2026-10-29T20:00:00-05:00` → `2026-10-29` (día de Lima, no UTC). */
export function fechaReservaLima(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - OFFSET_LIMA_MS).toISOString().slice(0, 10);
}

/** `2026-10-29T20:00:00-05:00` → `20:00` (24 h, hora de Lima). */
export function horaReservaLima(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - OFFSET_LIMA_MS).toISOString().slice(11, 16);
}

/** `2026-10-29` + `20:00` → ISO con el offset fijo de Lima (UTC-05:00). */
export function reservaFechaHoraIso(dia: string, hora: string): string {
  const [h = '00', m = '00'] = hora.split(':');
  return `${dia}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00-05:00`;
}
