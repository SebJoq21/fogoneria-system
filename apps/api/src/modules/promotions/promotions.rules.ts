import type { tipo_descuento_cupon } from '../../generated/prisma/enums.js';

/** Índices ISO: 1 = lunes … 7 = domingo (los que usa `reglas_horarias_promos`). */
export function diaSemanaLima(now: Date = new Date()): number {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const dia = lima.getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** `"HH:MM"` en hora de Lima, comparable con las horas de la regla. */
export function horaLima(now: Date = new Date()): string {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return `${String(lima.getUTCHours()).padStart(2, '0')}:${String(
    lima.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

/** Descuento de un cupón sobre un subtotal, sin pasarse del subtotal. */
export function descuentoDe(
  tipo: tipo_descuento_cupon,
  valor: number,
  subtotal: number,
): number {
  const subtotalSeguro = Math.max(0, subtotal);
  const bruto =
    tipo === 'PORCENTAJE' ? (subtotalSeguro * valor) / 100 : valor;
  return Math.round(Math.min(Math.max(0, bruto), subtotalSeguro) * 100) / 100;
}

export interface CuponParaValidar {
  activo: boolean;
  vencimiento: Date;
  usos_actuales: number;
  limite_usos: number;
}

export interface ValidacionCupon {
  valido: boolean;
  motivo: string | null;
}

/** Reglas de un cupón que no dependen del subtotal. */
export function validarCupon(
  cupon: CuponParaValidar,
  now: Date = new Date(),
): ValidacionCupon {
  if (!cupon.activo) {
    return { valido: false, motivo: 'El cupón está inactivo' };
  }

  // `vencimiento` es una fecha (día completo en Lima): vence al terminar ese día.
  const fin = new Date(`${cupon.vencimiento.toISOString().slice(0, 10)}T23:59:59-05:00`);
  if (now.getTime() > fin.getTime()) {
    return { valido: false, motivo: 'El cupón está vencido' };
  }
  if (cupon.usos_actuales >= cupon.limite_usos) {
    return { valido: false, motivo: 'El cupón agotó sus usos' };
  }
  return { valido: true, motivo: null };
}

export interface ReglaHoraria {
  dias_semana: number[];
  hora_inicio: Date;
  hora_fin: Date;
}

/** `hora_inicio`/`hora_fin` llegan como `Time` de Postgres (`1970-01-01T…Z`). */
export function horaDeTime(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(
    value.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

/** ¿La regla horaria cubre el momento actual (día y hora de Lima)? */
export function reglaAplica(regla: ReglaHoraria, now: Date = new Date()): boolean {
  if (!regla.dias_semana.includes(diaSemanaLima(now))) return false;

  const ahora = horaLima(now);
  const inicio = horaDeTime(regla.hora_inicio);
  const fin = horaDeTime(regla.hora_fin);

  // Ventanas que cruzan medianoche (22:00 → 02:00).
  if (inicio <= fin) return ahora >= inicio && ahora <= fin;
  return ahora >= inicio || ahora <= fin;
}
