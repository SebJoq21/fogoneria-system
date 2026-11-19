import { describe, expect, it } from 'vitest';
import {
  etiquetaAsistencia,
  etiquetaBloque,
  validarMarcacion,
} from '@fogoneria/contracts/rrhh';
import { toAsistencia, toEmpleado, toPozo, toTurno } from './api';

describe('contratos de RRHH', () => {
  it('valida la marcación', () => {
    expect(validarMarcacion({ empleadoId: 'e1', estado: 'PRESENTE' })).toBeNull();
    expect(validarMarcacion({ empleadoId: '', estado: 'PRESENTE' })).toMatch(/empleado/i);
    expect(validarMarcacion({ empleadoId: 'e1', estado: 'VACACIONES' })).toMatch(/estado/i);
  });

  it('etiqueta estados y bloques', () => {
    expect(etiquetaAsistencia('PRESENTE')).toBe('Presente');
    expect(etiquetaAsistencia('TARDANZA')).toBe('Tardanza');
    expect(etiquetaAsistencia('FALTA')).toBe('Falta');
    expect(etiquetaAsistencia('DESCANSO')).toBe('Descanso');
    expect(etiquetaBloque('MANANA')).toBe('Mañana');
    expect(etiquetaBloque('NOCHE')).toBe('Noche');
  });
});

describe('mapeo API → contrato', () => {
  it('normaliza el empleado con su rol', () => {
    expect(
      toEmpleado({
        id: 'e1',
        nombre: 'Ana',
        sucursal_id: 's1',
        activo: true,
        roles_empresa: { nombre: 'Barman' },
      }),
    ).toEqual({ id: 'e1', nombre: 'Ana', sucursalId: 's1', activo: true, rol: 'Barman' });
  });

  it('normaliza la asistencia con el nombre del empleado', () => {
    const asistencia = toAsistencia({
      id: 'a1',
      empleado_id: 'e1',
      fecha: '2026-11-19',
      estado: 'TARDANZA',
      hora_entrada: null,
      hora_salida: null,
      fuente: 'PIN',
      empleados: { id: 'e1', nombre: 'Ana' },
    });

    expect(asistencia).toMatchObject({
      empleadoId: 'e1',
      empleado: 'Ana',
      estado: 'TARDANZA',
      fuente: 'PIN',
    });
  });

  it('normaliza el turno con su empleado', () => {
    const turno = toTurno({
      id: 't1',
      fecha: '2026-11-19',
      bloque: 'TARDE',
      empleados: { id: 'e1', nombre: 'Ana' },
    });

    expect(turno).toMatchObject({ empleadoId: 'e1', empleado: 'Ana', bloque: 'TARDE' });
  });

  it('convierte el total del pozo (Decimal) a número', () => {
    const pozo = toPozo({
      id: 'p1',
      fecha: '2026-11-19',
      total: '105.50',
      nro_beneficiarios: 2,
      estado: 'CALCULADO',
    });

    expect(pozo.total).toBe(105.5);
    expect(pozo.beneficiarios).toBe(2);
  });
});
