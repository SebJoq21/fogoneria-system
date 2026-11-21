import { describe, expect, it } from 'vitest';
import { diaCorto, diaLima, rangoDiaLima, ultimosDias } from './lima';

describe('lima', () => {
  it('calcula el día de Lima y cruza medianoche UTC', () => {
    expect(diaLima(new Date('2026-11-21T02:00:00.000Z'))).toBe('2026-11-20');
    expect(diaLima(new Date('2026-11-21T05:00:00.000Z'))).toBe('2026-11-21');
    expect(diaLima()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('devuelve rangos inclusivos de días', () => {
    const now = new Date('2026-11-21T15:00:00.000Z');
    expect(ultimosDias(1, now)).toEqual({ desde: '2026-11-21', hasta: '2026-11-21' });
    expect(ultimosDias(7, now)).toEqual({ desde: '2026-11-15', hasta: '2026-11-21' });
  });

  it('etiqueta el día corto y cae a la fecha original si es inválida', () => {
    expect(diaCorto('2026-11-16')).toBe('Lun');
    expect(diaCorto('2026-11-22')).toBe('Dom');
    expect(diaCorto('no-es-fecha')).toBe('no-es-fecha');
  });

  it('arma el rango de un día de Lima con fin exclusivo', () => {
    const { start, end } = rangoDiaLima('2026-11-21');
    expect(start.toISOString()).toBe('2026-11-21T05:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(86_400_000);
  });
});
