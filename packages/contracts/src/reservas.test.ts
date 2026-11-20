import { describe, expect, it } from 'vitest';
import {
  ESTADOS_RESERVA,
  fechaReservaLima,
  horaReservaLima,
  isEstadoReserva,
  reservaActiva,
  reservaEditable,
  reservaFechaHoraIso,
  etiquetaEstadoReserva,
  validarReserva,
} from './reservas';

describe('guardas de reservas', () => {
  it('reconoce los estados del ciclo', () => {
    for (const estado of ESTADOS_RESERVA) expect(isEstadoReserva(estado)).toBe(true);
    expect(isEstadoReserva('PENDIENTE')).toBe(false);
  });

  it('una reserva viva ocupa la mesa', () => {
    expect(reservaActiva('POR_CONFIRMAR')).toBe(true);
    expect(reservaActiva('CONFIRMADA')).toBe(true);
    expect(reservaActiva('EJECUTADA')).toBe(false);
    expect(reservaActiva('CANCELADA')).toBe(false);
    expect(reservaActiva('NO_SHOW')).toBe(false);
  });

  it('solo POR_CONFIRMAR es editable', () => {
    expect(reservaEditable('POR_CONFIRMAR')).toBe(true);
    for (const estado of ['CONFIRMADA', 'EJECUTADA', 'CANCELADA', 'NO_SHOW'] as const) {
      expect(reservaEditable(estado)).toBe(false);
    }
  });
});

describe('validarReserva', () => {
  const valida = {
    mesaId: 'mesa-1',
    clienteNombre: 'Ana',
    comensales: 4,
    fechaHora: '2026-11-20T20:00:00-05:00',
  };

  it('acepta una reserva completa', () => {
    expect(validarReserva(valida)).toBeNull();
  });

  it('rechaza nombre, mesa, comensales o fecha inválidos', () => {
    expect(validarReserva({ ...valida, clienteNombre: '' })).toBe('Falta el nombre del cliente');
    expect(validarReserva({ ...valida, clienteNombre: '   ' })).toBe(
      'Falta el nombre del cliente',
    );
    expect(validarReserva({ ...valida, mesaId: '' })).toBe('Elige una mesa');
    expect(validarReserva({ ...valida, mesaId: '  ' })).toBe('Elige una mesa');
    expect(validarReserva({ ...valida, comensales: 0 })).toBe(
      'La reserva necesita al menos 1 comensal',
    );
    expect(validarReserva({ ...valida, comensales: Number.NaN })).toBe(
      'La reserva necesita al menos 1 comensal',
    );
    expect(validarReserva({ ...valida, fechaHora: '' })).toBe(
      'Fecha y hora de la reserva inválidas',
    );
    expect(validarReserva({ ...valida, fechaHora: 'no-es-fecha' })).toBe(
      'Fecha y hora de la reserva inválidas',
    );
  });
});

describe('etiquetas de reservas', () => {
  it('traduce todos los estados', () => {
    expect(etiquetaEstadoReserva('POR_CONFIRMAR')).toBe('Por confirmar');
    expect(etiquetaEstadoReserva('CONFIRMADA')).toBe('Confirmada');
    expect(etiquetaEstadoReserva('EJECUTADA')).toBe('Llegó');
    expect(etiquetaEstadoReserva('CANCELADA')).toBe('Cancelada');
    expect(etiquetaEstadoReserva('NO_SHOW')).toBe('No-show');
  });
});

describe('día y hora de Lima', () => {
  it('extrae el día de Lima, no el UTC', () => {
    expect(fechaReservaLima('2026-10-29T20:00:00-05:00')).toBe('2026-10-29');
    expect(fechaReservaLima('2026-10-30T00:30:00-05:00')).toBe('2026-10-30');
    expect(fechaReservaLima('2026-10-30T03:00:00Z')).toBe('2026-10-29');
  });

  it('devuelve vacío para fechas ilegibles', () => {
    expect(fechaReservaLima('no-es-fecha')).toBe('');
    expect(horaReservaLima('no-es-fecha')).toBe('');
  });

  it('extrae la hora de pared de Lima', () => {
    expect(horaReservaLima('2026-10-29T20:05:00-05:00')).toBe('20:05');
    expect(horaReservaLima('2026-10-30T01:05:00Z')).toBe('20:05');
  });

  it('arma el ISO con offset fijo de Lima', () => {
    expect(reservaFechaHoraIso('2026-10-29', '20:00')).toBe('2026-10-29T20:00:00-05:00');
    expect(reservaFechaHoraIso('2026-10-29', '9')).toBe('2026-10-29T09:00:00-05:00');
    expect(reservaFechaHoraIso('2026-10-29', '')).toBe('2026-10-29T00:00:00-05:00');
  });
});
