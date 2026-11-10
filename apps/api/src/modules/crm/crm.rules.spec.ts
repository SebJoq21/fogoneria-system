import { describe, expect, it } from 'vitest';
import {
  CONFIG_POR_DEFECTO,
  deltaPuntos,
  puntosPorConsumo,
  segmentoPorVisitas,
} from './crm.rules.js';

const config = { umbral_frecuente: 5, umbral_vip: 20 };

describe('CRM: reglas de segmento y puntos (AYCDS-31)', () => {
  it('un cliente con pocas visitas es NUEVO', () => {
    expect(segmentoPorVisitas(0, config)).toBe('NUEVO');
    expect(segmentoPorVisitas(4, config)).toBe('NUEVO');
  });

  it('cruza a FRECUENTE en el umbral exacto', () => {
    expect(segmentoPorVisitas(5, config)).toBe('FRECUENTE');
    expect(segmentoPorVisitas(19, config)).toBe('FRECUENTE');
  });

  it('cruza a VIP en su umbral', () => {
    expect(segmentoPorVisitas(20, config)).toBe('VIP');
    expect(segmentoPorVisitas(80, config)).toBe('VIP');
  });

  it('usa el umbral mayor si la configuración viene invertida', () => {
    expect(segmentoPorVisitas(6, { umbral_frecuente: 10, umbral_vip: 5 })).toBe('NUEVO');
  });

  it('otorga un punto por sol redondeando hacia abajo', () => {
    expect(puntosPorConsumo(36, 1)).toBe(36);
    expect(puntosPorConsumo(36.9, 1)).toBe(36);
    expect(puntosPorConsumo(100, 0.5)).toBe(50);
  });

  it('nunca otorga puntos negativos', () => {
    expect(puntosPorConsumo(-10, 1)).toBe(0);
    expect(puntosPorConsumo(10, -1)).toBe(0);
  });

  it('el signo del movimiento lo da el tipo', () => {
    expect(deltaPuntos('GANANCIA', 50)).toBe(50);
    expect(deltaPuntos('CANJE', 20)).toBe(-20);
    expect(deltaPuntos('CADUCIDAD', 5)).toBe(-5);
    expect(deltaPuntos('GANANCIA', -50)).toBe(50);
  });

  it('la configuración por defecto es la del seed', () => {
    expect(CONFIG_POR_DEFECTO).toEqual({
      puntos_por_moneda: 1,
      caducidad_meses: 12,
      umbral_frecuente: 5,
      umbral_vip: 20,
    });
  });
});
