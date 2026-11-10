import type { segmento_cliente } from '../../generated/prisma/enums.js';

/** Configuración de lealtad tal como llega de la base. */
export interface ConfigLealtad {
  puntos_por_moneda: number;
  caducidad_meses: number;
  umbral_frecuente: number;
  umbral_vip: number;
}

export const CONFIG_POR_DEFECTO: ConfigLealtad = {
  puntos_por_moneda: 1,
  caducidad_meses: 12,
  umbral_frecuente: 5,
  umbral_vip: 20,
};

/**
 * Segmento por número de visitas.
 *
 * `NUEVO` no es "cero visitas" sino "todavía no llega al umbral de frecuente":
 * un cliente con 3 visitas sigue siendo nuevo hasta la quinta. Los umbrales se
 * leen de `config_lealtad` para que el restaurante los ajuste sin tocar código.
 */
export function segmentoPorVisitas(
  visitas: number,
  config: Pick<ConfigLealtad, 'umbral_frecuente' | 'umbral_vip'>,
): segmento_cliente {
  if (visitas >= Math.max(config.umbral_vip, config.umbral_frecuente)) return 'VIP';
  if (visitas >= config.umbral_frecuente) return 'FRECUENTE';
  return 'NUEVO';
}

/** Puntos que otorga una comanda pagada: total × puntos por sol, redondeado. */
export function puntosPorConsumo(total: number, puntosPorMoneda: number): number {
  const puntos = Math.floor(Math.max(0, total) * Math.max(0, puntosPorMoneda));
  return Number.isFinite(puntos) ? puntos : 0;
}

/** Signo del movimiento según su tipo (el importe se guarda siempre positivo). */
export function deltaPuntos(
  tipo: 'GANANCIA' | 'CANJE' | 'CADUCIDAD',
  puntos: number,
): number {
  return tipo === 'GANANCIA' ? Math.abs(puntos) : -Math.abs(puntos);
}
