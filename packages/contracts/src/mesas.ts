/**
 * Contratos de mesas del salón.
 *
 * La API responde snake_case (`sucursal_id`, `capacidad`…); el ERP del web usa
 * un modelo propio (`lib/erp.ts`). El mapeo vive en `apps/web/features/salon/api.ts`.
 *
 * `OCUPADA` y `RESERVADA` los derivan las órdenes y las reservas: el cliente
 * solo puede fijar `LIBRE` y `MANTENIMIENTO` (bloqueo manual).
 */

export type EstadoMesa = 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'MANTENIMIENTO';

export type FormaMesa = 'REDONDA' | 'RECTANGULAR';

export type Mesa = {
  id: string;
  /** Número visible (`12`), no la etiqueta de la UI (`Mesa 12`). */
  numero: string;
  capacidad: number;
  zona: string | null;
  estado: EstadoMesa;
  forma: FormaMesa;
  sucursalId: string;
};

export type MesaInput = {
  numero: string;
  capacidad: number;
  zona?: string;
  forma?: FormaMesa;
  /** Solo `ADMIN_GLOBAL`: los roles con sucursal la heredan del JWT. */
  sucursalId?: string;
};

export type MesaUpdate = {
  numero?: string;
  capacidad?: number;
  zona?: string;
  forma?: FormaMesa;
};

/** Estados que un usuario puede escribir a mano; los demás los derivan. */
export type EstadoMesaManual = Extract<EstadoMesa, 'LIBRE' | 'MANTENIMIENTO'>;

export const ESTADOS_MESA: readonly EstadoMesa[] = [
  'LIBRE',
  'OCUPADA',
  'RESERVADA',
  'MANTENIMIENTO',
];

export function isEstadoMesa(value: string): value is EstadoMesa {
  return (ESTADOS_MESA as readonly string[]).includes(value);
}

export function isFormaMesa(value: string): value is FormaMesa {
  return value === 'REDONDA' || value === 'RECTANGULAR';
}

/** Devuelve el mensaje de error o `null` si la mesa es válida. */
export function validarMesa(input: { numero?: string; capacidad?: number }): string | null {
  if (!input.numero || !input.numero.trim()) return 'Falta el número de mesa';
  if (input.numero.trim().length > 10) return 'El número de mesa admite hasta 10 caracteres';
  if (!Number.isFinite(input.capacidad) || (input.capacidad ?? 0) < 1) {
    return 'La capacidad debe ser de al menos 1 comensal';
  }
  return null;
}

/** Una mesa bloqueada no acepta comensales hasta desbloquearla. */
export function mesaBloqueada(estado: EstadoMesa): boolean {
  return estado === 'MANTENIMIENTO';
}

/** Etiqueta para la UI. */
export function etiquetaEstadoMesa(estado: EstadoMesa): string {
  switch (estado) {
    case 'OCUPADA':
      return 'En servicio';
    case 'RESERVADA':
      return 'Reservada';
    case 'MANTENIMIENTO':
      return 'Bloqueada';
    default:
      return 'Libre';
  }
}
