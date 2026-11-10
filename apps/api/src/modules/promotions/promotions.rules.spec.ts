import { describe, expect, it } from 'vitest';
import {
  descuentoDe,
  diaSemanaLima,
  horaLima,
  reglaAplica,
  validarCupon,
} from './promotions.rules.js';

const AHORA = new Date('2026-11-06T15:30:00.000Z'); // viernes 10:30 en Lima

describe('reglas de promociones (AYCDS-19)', () => {
  describe('descuentoDe', () => {
    it('calcula el porcentaje del subtotal', () => {
      expect(descuentoDe('PORCENTAJE', 10, 120)).toBe(12);
      expect(descuentoDe('PORCENTAJE', 15, 36)).toBe(5.4);
    });

    it('aplica el monto fijo sin pasarse del subtotal', () => {
      expect(descuentoDe('MONTO', 20, 120)).toBe(20);
      expect(descuentoDe('MONTO', 50, 30)).toBe(30);
    });

    it('nunca devuelve negativos', () => {
      expect(descuentoDe('PORCENTAJE', 10, -5)).toBe(0);
      expect(descuentoDe('MONTO', -3, 10)).toBe(0);
    });
  });

  describe('validarCupon', () => {
    const base = {
      activo: true,
      vencimiento: new Date('2026-12-31T00:00:00.000Z'),
      usos_actuales: 0,
      limite_usos: 10,
    };

    it('acepta un cupón vigente con usos', () => {
      expect(validarCupon(base, AHORA)).toEqual({ valido: true, motivo: null });
    });

    it('rechaza un cupón inactivo', () => {
      expect(validarCupon({ ...base, activo: false }, AHORA)).toMatchObject({
        valido: false,
        motivo: 'El cupón está inactivo',
      });
    });

    it('rechaza un cupón vencido el día siguiente al vencimiento (hora de Lima)', () => {
      const vencido = { ...base, vencimiento: new Date('2026-11-06T00:00:00.000Z') };
      // 2026-11-06 10:30 Lima: el cupón vence a las 23:59 de ese día, aún vale.
      expect(validarCupon(vencido, AHORA).valido).toBe(true);
      // 2026-11-07 00:30 Lima: ya venció.
      const despues = new Date('2026-11-07T05:30:00.000Z');
      expect(validarCupon(vencido, despues)).toMatchObject({
        valido: false,
        motivo: 'El cupón está vencido',
      });
    });

    it('rechaza un cupón sin usos disponibles', () => {
      expect(
        validarCupon({ ...base, usos_actuales: 10 }, AHORA),
      ).toMatchObject({ valido: false, motivo: 'El cupón agotó sus usos' });
    });
  });

  describe('reglaAplica', () => {
    const regla = {
      dias_semana: [5], // viernes
      hora_inicio: new Date('1970-01-01T10:00:00.000Z'),
      hora_fin: new Date('1970-01-01T12:00:00.000Z'),
    };

    it('aplica un viernes a las 10:30 de Lima', () => {
      expect(reglaAplica(regla, AHORA)).toBe(true);
    });

    it('no aplica fuera del horario', () => {
      expect(reglaAplica(regla, new Date('2026-11-06T19:00:00.000Z'))).toBe(false);
    });

    it('no aplica otro día', () => {
      expect(reglaAplica(regla, new Date('2026-11-07T15:30:00.000Z'))).toBe(false);
    });

    it('soporta ventanas que cruzan medianoche', () => {
      const nocturna = {
        dias_semana: [5],
        hora_inicio: new Date('1970-01-01T22:00:00.000Z'),
        hora_fin: new Date('1970-01-01T02:00:00.000Z'),
      };
      // Viernes 23:00 Lima.
      expect(reglaAplica(nocturna, new Date('2026-11-07T04:00:00.000Z'))).toBe(true);
    });
  });

  it('calcula día y hora de Lima con offset fijo', () => {
    expect(diaSemanaLima(AHORA)).toBe(5);
    expect(horaLima(AHORA)).toBe('10:30');
    // 2026-11-09 03:00 UTC = domingo 22:00 en Lima (ISO: domingo = 7).
    expect(diaSemanaLima(new Date('2026-11-09T03:00:00.000Z'))).toBe(7);
  });
});
