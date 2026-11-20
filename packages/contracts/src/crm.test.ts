import { describe, expect, it } from 'vitest';
import {
  esSegmentoCliente,
  esTipoMovimientoPuntos,
  etiquetaMovimientoPuntos,
  etiquetaSegmento,
  ultimaVisitaLabel,
  validarAjustePuntos,
} from './crm';

describe('guardas del CRM', () => {
  it('reconoce segmentos y tipos de movimiento', () => {
    expect(esSegmentoCliente('NUEVO')).toBe(true);
    expect(esSegmentoCliente('VIP')).toBe(true);
    expect(esSegmentoCliente('vip')).toBe(false);
    expect(esTipoMovimientoPuntos('GANANCIA')).toBe(true);
    expect(esTipoMovimientoPuntos('CANJE')).toBe(true);
    expect(esTipoMovimientoPuntos('CADUCIDAD')).toBe(true);
    expect(esTipoMovimientoPuntos('AJUSTE')).toBe(false);
  });
});

describe('etiquetas del CRM', () => {
  it('traduce segmentos', () => {
    expect(etiquetaSegmento('VIP')).toBe('VIP');
    expect(etiquetaSegmento('FRECUENTE')).toBe('Frecuente');
    expect(etiquetaSegmento('NUEVO')).toBe('Nuevo');
    expect(etiquetaSegmento('OTRO')).toBe('Nuevo');
  });

  it('traduce movimientos de puntos', () => {
    expect(etiquetaMovimientoPuntos('GANANCIA')).toBe('Ganancia');
    expect(etiquetaMovimientoPuntos('CANJE')).toBe('Canje');
    expect(etiquetaMovimientoPuntos('CADUCIDAD')).toBe('Caducidad');
    expect(etiquetaMovimientoPuntos('OTRO')).toBe('Ganancia');
  });

  it('formatea la última visita y devuelve guion cuando no hay fecha', () => {
    expect(ultimaVisitaLabel('2026-11-20T18:30:00-05:00')).toBe('20/11/2026');
    expect(ultimaVisitaLabel('2026-01-05')).toBe('05/01/2026');
    expect(ultimaVisitaLabel(null)).toBe('—');
    expect(ultimaVisitaLabel(undefined)).toBe('—');
    expect(ultimaVisitaLabel('')).toBe('—');
    expect(ultimaVisitaLabel('2026')).toBe('—');
  });
});

describe('validarAjustePuntos', () => {
  it('acepta ganancias de enteros positivos sin mirar el saldo', () => {
    expect(validarAjustePuntos({ tipo: 'GANANCIA', puntos: 5 })).toBeNull();
    expect(validarAjustePuntos({ tipo: 'GANANCIA', puntos: 100, saldo: 0 })).toBeNull();
  });

  it('rechaza tipo, puntos no enteros o no positivos', () => {
    expect(validarAjustePuntos({})).toBe('Tipo de movimiento inválido');
    expect(validarAjustePuntos({ tipo: 'OTRO', puntos: 1 })).toBe('Tipo de movimiento inválido');
    expect(validarAjustePuntos({ tipo: 'CANJE' })).toBe('Los puntos deben ser un entero mayor a 0');
    expect(validarAjustePuntos({ tipo: 'CANJE', puntos: 0 })).toBe(
      'Los puntos deben ser un entero mayor a 0',
    );
    expect(validarAjustePuntos({ tipo: 'CANJE', puntos: 1.5 })).toBe(
      'Los puntos deben ser un entero mayor a 0',
    );
  });

  it('no deja descontar más puntos de los disponibles', () => {
    expect(validarAjustePuntos({ tipo: 'CANJE', puntos: 3, saldo: 10 })).toBeNull();
    expect(validarAjustePuntos({ tipo: 'CANJE', puntos: 11, saldo: 10 })).toBe(
      'El cliente solo tiene 10 puntos: no se pueden descontar 11',
    );
    expect(validarAjustePuntos({ tipo: 'CADUCIDAD', puntos: 11, saldo: 10 })).toBe(
      'El cliente solo tiene 10 puntos: no se pueden descontar 11',
    );
    expect(validarAjustePuntos({ tipo: 'CANJE', puntos: 11 })).toBeNull();
  });
});
