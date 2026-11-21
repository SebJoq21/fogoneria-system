import { describe, expect, it } from 'vitest';
import {
  etiquetaEstadoMesa,
  isEstadoMesa,
  isFormaMesa,
  mesaBloqueada,
  validarMesa,
} from '@fogoneria/contracts/tables';
import { toMesa } from './api';

const mesaApi = {
  id: 'mesa-1',
  numero: '12',
  capacidad: 4,
  zona: 'Terraza',
  estado: 'OCUPADA',
  forma: 'REDONDA',
  sucursal_id: 'suc-1',
};

describe('contratos de mesas', () => {
  it('valida número y capacidad', () => {
    expect(validarMesa({ numero: '12', capacidad: 4 })).toBeNull();
    expect(validarMesa({ numero: '  ', capacidad: 4 })).toMatch(/número/i);
    expect(validarMesa({ numero: '12345678901', capacidad: 4 })).toMatch(/10/);
    expect(validarMesa({ numero: '12', capacidad: 0 })).toMatch(/capacidad/i);
  });

  it('etiqueta estados y distingue el bloqueo', () => {
    expect(etiquetaEstadoMesa('LIBRE')).toBe('Libre');
    expect(etiquetaEstadoMesa('OCUPADA')).toBe('En servicio');
    expect(etiquetaEstadoMesa('RESERVADA')).toBe('Reservada');
    expect(etiquetaEstadoMesa('MANTENIMIENTO')).toBe('Bloqueada');
    expect(mesaBloqueada('MANTENIMIENTO')).toBe(true);
    expect(mesaBloqueada('OCUPADA')).toBe(false);
  });
});

describe('mapeo API → contrato (mesas)', () => {
  it('normaliza la mesa con su sucursal y forma', () => {
    expect(toMesa(mesaApi)).toEqual({
      id: 'mesa-1',
      numero: '12',
      capacidad: 4,
      zona: 'Terraza',
      estado: 'OCUPADA',
      forma: 'REDONDA',
      sucursalId: 'suc-1',
    });
  });

  it('cae a LIBRE/RECTANGULAR ante valores desconocidos', () => {
    const mesa = toMesa({ ...mesaApi, estado: 'VOLTEADA', forma: 'OVALADA' });
    expect(mesa.estado).toBe('LIBRE');
    expect(mesa.forma).toBe('RECTANGULAR');
  });

  it('rechaza estados y formas desconocidos', () => {
    expect(isEstadoMesa('VOLTEADA')).toBe(false);
    expect(isEstadoMesa('OCUPADA')).toBe(true);
    expect(isFormaMesa('OVALADA')).toBe(false);
    expect(isFormaMesa('REDONDA')).toBe(true);
  });
});
