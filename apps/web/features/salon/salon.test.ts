import { describe, expect, it } from 'vitest';
import {
  etiquetaEstadoMesa,
  mesaBloqueada,
  validarMesa,
} from '@fogoneria/contracts/mesas';
import {
  etiquetaEstadoReserva,
  fechaReservaLima,
  horaReservaLima,
  reservaActiva,
  reservaEditable,
  reservaFechaHoraIso,
  validarReserva,
} from '@fogoneria/contracts/reservas';
import { toMesa, toReserva } from './api';

const mesaApi = {
  id: 'mesa-1',
  numero: '12',
  capacidad: 4,
  zona: 'Terraza',
  estado: 'OCUPADA',
  forma: 'REDONDA',
  sucursal_id: 'suc-1',
};

const reservaApi = {
  id: 'res-1',
  codigo: 'RSV-20261031-0001',
  sucursal_id: 'suc-1',
  mesa_id: 'mesa-1',
  cliente_nombre: 'Camila Duarte',
  telefono: '+51 999 999 999',
  nro_comensales: 4,
  fecha_hora: '2026-10-31T20:00:00-05:00',
  estado: 'POR_CONFIRMAR',
  canal: 'WEB',
  notas: 'Cerca a la ventana',
  mesas: { id: 'mesa-1', numero: '12', zona: 'Terraza' },
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

describe('contratos de reservas', () => {
  it('valida cliente, mesa, comensales y fecha', () => {
    expect(
      validarReserva({
        mesaId: 'mesa-1',
        clienteNombre: 'Camila',
        comensales: 4,
        fechaHora: '2026-10-31T20:00:00-05:00',
      }),
    ).toBeNull();
    expect(validarReserva({ mesaId: 'mesa-1', comensales: 4 })).toMatch(/cliente/i);
    expect(validarReserva({ clienteNombre: 'Camila', comensales: 4 })).toMatch(/mesa/i);
    expect(
      validarReserva({ mesaId: 'm', clienteNombre: 'C', comensales: 0, fechaHora: 'x' }),
    ).toMatch(/comensal/i);
    expect(
      validarReserva({
        mesaId: 'm',
        clienteNombre: 'C',
        comensales: 2,
        fechaHora: 'no-es-fecha',
      }),
    ).toMatch(/fecha/i);
  });

  it('etiqueta estados y separa activas de editables', () => {
    expect(etiquetaEstadoReserva('POR_CONFIRMAR')).toBe('Por confirmar');
    expect(etiquetaEstadoReserva('EJECUTADA')).toBe('Llegó');
    expect(etiquetaEstadoReserva('CANCELADA')).toBe('Cancelada');
    expect(etiquetaEstadoReserva('NO_SHOW')).toBe('No-show');
    expect(etiquetaEstadoReserva('CONFIRMADA')).toBe('Confirmada');
    expect(reservaActiva('CONFIRMADA')).toBe(true);
    expect(reservaActiva('CANCELADA')).toBe(false);
    expect(reservaEditable('POR_CONFIRMAR')).toBe(true);
    expect(reservaEditable('CONFIRMADA')).toBe(false);
  });

  it('mide el día y la hora en Lima, no en UTC', () => {
    expect(fechaReservaLima('2026-10-31T20:00:00-05:00')).toBe('2026-10-31');
    expect(fechaReservaLima('2026-11-01T02:00:00.000Z')).toBe('2026-10-31');
    expect(horaReservaLima('2026-10-31T20:00:00-05:00')).toBe('20:00');
    expect(horaReservaLima('no-es-fecha')).toBe('');
    expect(reservaFechaHoraIso('2026-10-31', '20:00')).toBe('2026-10-31T20:00:00-05:00');
    expect(reservaFechaHoraIso('2026-10-31', '9:5')).toBe('2026-10-31T09:05:00-05:00');
  });
});

describe('mapeo API → contrato (salón)', () => {
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

  it('normaliza la reserva con la mesa anidada', () => {
    const reserva = toReserva(reservaApi);
    expect(reserva).toMatchObject({
      id: 'res-1',
      codigo: 'RSV-20261031-0001',
      mesaId: 'mesa-1',
      mesaNumero: '12',
      clienteNombre: 'Camila Duarte',
      comensales: 4,
      estado: 'POR_CONFIRMAR',
      canal: 'WEB',
      sucursalId: 'suc-1',
    });
    expect(reserva.telefono).toBe('+51 999 999 999');
    expect(reserva.notas).toBe('Cerca a la ventana');
  });

  it('una reserva con estado inválido queda por confirmar', () => {
    expect(toReserva({ ...reservaApi, estado: 'PERDIDA' }).estado).toBe('POR_CONFIRMAR');
    expect(toReserva({ ...reservaApi, mesas: null }).mesaNumero).toBeNull();
  });
});
