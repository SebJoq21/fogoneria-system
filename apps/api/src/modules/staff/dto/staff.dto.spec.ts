import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CalculateTipsDto,
  CreateShiftDto,
  ListDayQueryDto,
  ListEmployeesQueryDto,
  MarkAttendanceDto,
  SucursalQueryDto,
} from './staff.dto.js';

const EMPLEADO = '11111111-1111-4111-8111-111111111111';
const SUCURSAL = '22222222-2222-4222-8222-222222222222';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('SucursalQueryDto y ListEmployeesQueryDto', () => {
  it('aceptan sucursal opcional y el filtro activo', async () => {
    expect(await errores(SucursalQueryDto, { sucursalId: SUCURSAL })).toEqual([]);
    expect(await errores(SucursalQueryDto, {})).toEqual([]);
    expect(await errores(ListEmployeesQueryDto, { activo: true })).toEqual([]);
  });

  it('rechazan uuid inválido y activo no booleano', async () => {
    expect(await errores(SucursalQueryDto, { sucursalId: 'x' })).toContain('sucursalId');
    expect(await errores(ListEmployeesQueryDto, { activo: 'si' })).toContain('activo');
  });
});

describe('ListDayQueryDto', () => {
  it('acepta el día de Lima', async () => {
    expect(await errores(ListDayQueryDto, { fecha: '2026-11-06' })).toEqual([]);
    expect(await errores(ListDayQueryDto, {})).toEqual([]);
  });

  it('rechaza otros formatos', async () => {
    expect(await errores(ListDayQueryDto, { fecha: '06/11/2026' })).toContain('fecha');
  });
});

describe('CreateShiftDto', () => {
  it('acepta empleado, fecha y bloque', async () => {
    expect(
      await errores(CreateShiftDto, {
        empleadoId: EMPLEADO,
        fecha: '2026-11-07',
        bloque: 'TARDE',
        sucursalId: SUCURSAL,
      }),
    ).toEqual([]);
  });

  it('rechaza uuid, fecha y bloque inválidos', async () => {
    expect(
      await errores(CreateShiftDto, {
        empleadoId: 'x',
        fecha: '07-11-2026',
        bloque: 'MADRUGADA',
      }),
    ).toEqual(expect.arrayContaining(['empleadoId', 'fecha', 'bloque']));
  });
});

describe('MarkAttendanceDto', () => {
  it('acepta una marcación completa', async () => {
    expect(
      await errores(MarkAttendanceDto, {
        empleadoId: EMPLEADO,
        fecha: '2026-11-06',
        estado: 'TARDANZA',
        horaEntrada: '2026-11-06T09:15:00.000Z',
        horaSalida: '2026-11-06T22:30:00.000Z',
        fuente: 'PIN',
      }),
    ).toEqual([]);
  });

  it('acepta solo empleado y estado', async () => {
    expect(
      await errores(MarkAttendanceDto, { empleadoId: EMPLEADO, estado: 'PRESENTE' }),
    ).toEqual([]);
  });

  it('rechaza estado, horas y fuente inválidas', async () => {
    expect(
      await errores(MarkAttendanceDto, {
        empleadoId: EMPLEADO,
        estado: 'VACACIONES',
        horaEntrada: 'no-fecha',
        fuente: 'x'.repeat(21),
      }),
    ).toEqual(expect.arrayContaining(['estado', 'horaEntrada', 'fuente']));
  });
});

describe('CalculateTipsDto', () => {
  it('acepta fecha opcional válida y rechaza el formato', async () => {
    expect(await errores(CalculateTipsDto, { fecha: '2026-11-06' })).toEqual([]);
    expect(await errores(CalculateTipsDto, {})).toEqual([]);
    expect(await errores(CalculateTipsDto, { fecha: '20261106' })).toContain('fecha');
  });
});
