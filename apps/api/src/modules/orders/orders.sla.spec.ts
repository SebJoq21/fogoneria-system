import { describe, expect, it } from 'vitest';
import {
  SLA_MINUTOS,
  cutoffSla,
  inicioVentana,
  minutosEntre,
  promedio,
  slaBase,
  slaInfo,
} from './orders.sla.js';

const INGRESO = new Date('2026-11-06T10:00:00.000Z');

function minutosDespues(minutos: number): Date {
  return new Date(INGRESO.getTime() + minutos * 60_000);
}

describe('SLA del KDS (AYCDS-30)', () => {
  it('usa la confirmación como base del reloj', () => {
    const confirmacion = minutosDespues(3);
    const base = slaBase({
      estado: 'EN_COCINA',
      ingreso_at: INGRESO,
      confirmacion_at: confirmacion,
    });
    expect(base).toBe(confirmacion);
  });

  it('cae al ingreso cuando la cocina todavía no confirmó', () => {
    const base = slaBase({
      estado: 'POR_CONFIRMAR',
      ingreso_at: INGRESO,
      confirmacion_at: null,
    });
    expect(base).toBe(INGRESO);
  });

  it('a los 19 y 20 minutos no alerta; a los 21 sí', () => {
    const orden = {
      estado: 'EN_COCINA' as const,
      ingreso_at: INGRESO,
      confirmacion_at: INGRESO,
    };

    expect(slaInfo(orden, minutosDespues(19)).alertaSla).toBe(false);
    expect(slaInfo(orden, minutosDespues(20)).alertaSla).toBe(false);
    const tarde = slaInfo(orden, minutosDespues(21));
    expect(tarde.alertaSla).toBe(true);
    expect(tarde.minutos).toBe(21);
    expect(tarde.excedidoPor).toBe(1);
  });

  it('cuenta desde la confirmación y no desde el ingreso', () => {
    const orden = {
      estado: 'EN_COCINA' as const,
      ingreso_at: INGRESO,
      confirmacion_at: minutosDespues(15),
    };
    // 30 minutos después del ingreso, pero solo 15 desde que entró a cocina.
    const info = slaInfo(orden, minutosDespues(30));
    expect(info.minutos).toBe(15);
    expect(info.alertaSla).toBe(false);
  });

  it('congela el reloj cuando la comanda ya se entregó', () => {
    const info = slaInfo(
      {
        estado: 'ENTREGADO' as const,
        ingreso_at: INGRESO,
        confirmacion_at: INGRESO,
      },
      minutosDespues(120),
    );
    expect(info).toEqual({ minutos: null, alertaSla: false, excedidoPor: null });
  });

  it('no devuelve minutos negativos si el reloj del servidor va atrás', () => {
    const info = slaInfo(
      {
        estado: 'POR_CONFIRMAR' as const,
        ingreso_at: minutosDespues(5),
        confirmacion_at: null,
      },
      INGRESO,
    );
    expect(info.minutos).toBe(0);
    expect(info.alertaSla).toBe(false);
  });

  it('calcula el corte del SLA y la ventana del tablero', () => {
    expect(SLA_MINUTOS).toBe(20);
    expect(cutoffSla(INGRESO).toISOString()).toBe('2026-11-06T09:40:00.000Z');
    expect(inicioVentana(INGRESO, 7).toISOString()).toBe('2026-10-30T10:00:00.000Z');
  });

  it('ignora fechas incoherentes al medir entre dos instantes', () => {
    expect(minutosEntre(null, INGRESO)).toBeNull();
    expect(minutosEntre(INGRESO, minutosDespues(-5))).toBeNull();
    expect(minutosEntre(INGRESO, minutosDespues(12.34))).toBe(12.3);
  });

  it('promedia solo los valores reales', () => {
    expect(promedio([null, null])).toBeNull();
    expect(promedio([10, null, 20])).toBe(15);
    expect(promedio([1, 2])).toBe(1.5);
  });
});
