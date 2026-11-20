import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateReservationDto,
  ListReservationsQueryDto,
  UpdateReservationDto,
  UpdateReservationStatusDto,
} from './reservation.dto.js';

const MESA = '11111111-1111-4111-8111-111111111111';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('CreateReservationDto', () => {
  const valido = {
    mesaId: MESA,
    clienteNombre: 'Familia Rojas',
    telefono: '987654321',
    nroComensales: 4,
    fechaHora: '2026-11-20T20:00:00-05:00',
    canal: 'Presencial',
    notas: 'Junto a la ventana',
  };

  it('acepta una reserva completa', async () => {
    expect(await errores(CreateReservationDto, valido)).toEqual([]);
  });

  it('acepta solo los obligatorios', async () => {
    expect(
      await errores(CreateReservationDto, {
        mesaId: MESA,
        clienteNombre: 'Ana',
        nroComensales: 2,
        fechaHora: '2026-11-20T20:00:00-05:00',
      }),
    ).toEqual([]);
  });

  it('rechaza uuid, nombre, comensales, fecha y longitudes inválidas', async () => {
    const invalido = await errores(CreateReservationDto, {
      mesaId: 'no-uuid',
      clienteNombre: 'A',
      telefono: 'x'.repeat(21),
      nroComensales: 51,
      fechaHora: 'no-es-fecha',
      canal: 'x'.repeat(41),
      notas: 'x'.repeat(501),
    });
    expect(invalido).toEqual(
      expect.arrayContaining([
        'mesaId',
        'clienteNombre',
        'telefono',
        'nroComensales',
        'fechaHora',
        'canal',
        'notas',
      ]),
    );
  });

  it('exige al menos un comensal', async () => {
    expect(
      await errores(CreateReservationDto, {
        mesaId: MESA,
        clienteNombre: 'Ana',
        nroComensales: 0,
        fechaHora: '2026-11-20T20:00:00-05:00',
      }),
    ).toContain('nroComensales');
  });
});

describe('UpdateReservationDto', () => {
  it('acepta un cuerpo vacío y campos válidos', async () => {
    expect(await errores(UpdateReservationDto, {})).toEqual([]);
    expect(
      await errores(UpdateReservationDto, {
        mesaId: MESA,
        clienteNombre: 'Ana',
        nroComensales: 50,
        fechaHora: '2026-11-21T20:00:00-05:00',
      }),
    ).toEqual([]);
  });

  it('rechaza valores fuera de rango', async () => {
    expect(
      await errores(UpdateReservationDto, {
        mesaId: 'x',
        clienteNombre: 'A',
        nroComensales: 0,
        fechaHora: 'x',
      }),
    ).toEqual(expect.arrayContaining(['mesaId', 'clienteNombre', 'nroComensales', 'fechaHora']));
  });
});

describe('UpdateReservationStatusDto', () => {
  it('acepta los estados del enum', async () => {
    for (const estado of ['POR_CONFIRMAR', 'CONFIRMADA', 'EJECUTADA', 'CANCELADA', 'NO_SHOW']) {
      expect(await errores(UpdateReservationStatusDto, { estado })).toEqual([]);
    }
  });

  it('rechaza un estado desconocido', async () => {
    expect(await errores(UpdateReservationStatusDto, { estado: 'PENDIENTE' })).toContain('estado');
  });
});

describe('ListReservationsQueryDto', () => {
  it('acepta el día de Lima, estado y mesa', async () => {
    expect(
      await errores(ListReservationsQueryDto, {
        fecha: '2026-11-20',
        estado: 'CONFIRMADA',
        mesaId: MESA,
        page: 1,
        limit: 20,
      }),
    ).toEqual([]);
  });

  it('rechaza fechas con otro formato', async () => {
    expect(await errores(ListReservationsQueryDto, { fecha: '20/11/2026' })).toContain('fecha');
  });

  it('rechaza estado y uuid inválidos', async () => {
    expect(
      await errores(ListReservationsQueryDto, { estado: 'PENDIENTE', mesaId: 'x' }),
    ).toEqual(expect.arrayContaining(['estado', 'mesaId']));
  });
});
