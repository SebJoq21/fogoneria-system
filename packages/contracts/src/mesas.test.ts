import { describe, expect, it } from 'vitest';
import {
  etiquetaEstadoMesa,
  isEstadoMesa,
  isFormaMesa,
  mesaBloqueada,
  validarMesa,
} from './mesas';

describe('guardas de mesas', () => {
  it('reconoce estados y formas', () => {
    for (const estado of ['LIBRE', 'OCUPADA', 'RESERVADA', 'MANTENIMIENTO']) {
      expect(isEstadoMesa(estado)).toBe(true);
    }
    expect(isEstadoMesa('libre')).toBe(false);
    expect(isFormaMesa('REDONDA')).toBe(true);
    expect(isFormaMesa('RECTANGULAR')).toBe(true);
    expect(isFormaMesa('CUADRADA')).toBe(false);
  });
});

describe('validarMesa', () => {
  it('acepta número y capacidad válidos', () => {
    expect(validarMesa({ numero: '12', capacidad: 4 })).toBeNull();
  });

  it('rechaza número vacío o demasiado largo', () => {
    expect(validarMesa({})).toBe('Falta el número de mesa');
    expect(validarMesa({ numero: '  ' })).toBe('Falta el número de mesa');
    expect(validarMesa({ numero: '12345678901', capacidad: 4 })).toBe(
      'El número de mesa admite hasta 10 caracteres',
    );
  });

  it('exige al menos un comensal', () => {
    expect(validarMesa({ numero: '1' })).toBe('La capacidad debe ser de al menos 1 comensal');
    expect(validarMesa({ numero: '1', capacidad: 0 })).toBe(
      'La capacidad debe ser de al menos 1 comensal',
    );
  });
});

describe('presentación de mesas', () => {
  it('solo MANTENIMIENTO bloquea la mesa', () => {
    expect(mesaBloqueada('MANTENIMIENTO')).toBe(true);
    expect(mesaBloqueada('LIBRE')).toBe(false);
    expect(mesaBloqueada('OCUPADA')).toBe(false);
    expect(mesaBloqueada('RESERVADA')).toBe(false);
  });

  it('etiqueta el estado para el salón', () => {
    expect(etiquetaEstadoMesa('LIBRE')).toBe('Libre');
    expect(etiquetaEstadoMesa('OCUPADA')).toBe('En servicio');
    expect(etiquetaEstadoMesa('RESERVADA')).toBe('Reservada');
    expect(etiquetaEstadoMesa('MANTENIMIENTO')).toBe('Bloqueada');
  });
});
