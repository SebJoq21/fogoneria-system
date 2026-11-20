import { beforeEach, describe, expect, it, vi } from 'vitest';

const cliente = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@fogoneria/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fogoneria/sdk')>();
  return { ...actual, createClient: () => cliente };
});

import { salonApi, toMesa, toReserva } from './api';

const apiMesa = {
  id: 'm-1',
  numero: '12',
  capacidad: 4,
  zona: 'Salón',
  estado: 'OCUPADA',
  forma: 'REDONDA',
  sucursal_id: 's-1',
};

const apiReserva = {
  id: 'r-1',
  codigo: 'RSV-20261120-0001',
  sucursal_id: 's-1',
  mesa_id: 'm-1',
  cliente_nombre: 'Ana',
  telefono: '987654321',
  nro_comensales: 4,
  fecha_hora: '2026-11-20T20:00:00-05:00',
  estado: 'CONFIRMADA',
  canal: 'Teléfono',
  notas: null,
  mesas: { id: 'm-1', numero: '12', zona: 'Salón' },
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('toMesa', () => {
  it('traduce la mesa y su forma', () => {
    expect(toMesa(apiMesa)).toEqual({
      id: 'm-1',
      numero: '12',
      capacidad: 4,
      zona: 'Salón',
      estado: 'OCUPADA',
      forma: 'REDONDA',
      sucursalId: 's-1',
    });
  });

  it('cae a LIBRE/RECTANGULAR ante valores raros', () => {
    const mesa = toMesa({ ...apiMesa, estado: 'OTRO', forma: null });
    expect(mesa.estado).toBe('LIBRE');
    expect(mesa.forma).toBe('RECTANGULAR');
  });
});

describe('toReserva', () => {
  it('traduce la reserva con el número de mesa anidado', () => {
    expect(toReserva(apiReserva)).toMatchObject({
      id: 'r-1',
      codigo: 'RSV-20261120-0001',
      mesaNumero: '12',
      clienteNombre: 'Ana',
      comensales: 4,
      estado: 'CONFIRMADA',
    });
  });

  it('cae a POR_CONFIRMAR y mesaNumero null', () => {
    const reserva = toReserva({ ...apiReserva, estado: 'OTRO', mesas: null });
    expect(reserva.estado).toBe('POR_CONFIRMAR');
    expect(reserva.mesaNumero).toBeNull();
  });
});

describe('salonApi mesas', () => {
  it('lista mesas con filtros', async () => {
    cliente.get.mockResolvedValue([apiMesa]);
    const mesas = await salonApi.listMesas({ estado: 'OCUPADA', zona: 'Salón', sucursalId: 's-1' });
    expect(cliente.get).toHaveBeenCalledWith(
      '/tables?estado=OCUPADA&zona=Sal%C3%B3n&sucursalId=s-1',
      { signal: undefined },
    );
    expect(mesas).toHaveLength(1);
  });

  it('crea una mesa con los opcionales presentes', async () => {
    cliente.post.mockResolvedValue(apiMesa);
    await salonApi.createMesa({
      numero: '12',
      capacidad: 4,
      zona: 'Salón',
      forma: 'REDONDA',
      sucursalId: 's-1',
    });
    expect(cliente.post).toHaveBeenCalledWith('/tables', {
      numero: '12',
      capacidad: 4,
      zona: 'Salón',
      forma: 'REDONDA',
      sucursalId: 's-1',
    });
  });

  it('crea una mesa sin opcionales', async () => {
    cliente.post.mockResolvedValue(apiMesa);
    await salonApi.createMesa({ numero: '1', capacidad: 2 });
    expect(cliente.post).toHaveBeenCalledWith('/tables', { numero: '1', capacidad: 2 });
  });

  it('actualiza solo los campos enviados, aunque sean cero o vacío', async () => {
    cliente.patch.mockResolvedValue(apiMesa);
    await salonApi.updateMesa('m-1', { numero: '13', capacidad: 0, zona: '', forma: 'RECTANGULAR' });
    expect(cliente.patch).toHaveBeenCalledWith('/tables/m-1', {
      numero: '13',
      capacidad: 0,
      zona: '',
      forma: 'RECTANGULAR',
    });
  });

  it('actualiza el estado manual y elimina la mesa', async () => {
    cliente.patch.mockResolvedValue(apiMesa);
    cliente.delete.mockResolvedValue(apiMesa);
    await salonApi.updateMesaEstado('m-1', 'MANTENIMIENTO');
    expect(cliente.patch).toHaveBeenCalledWith('/tables/m-1/status', {
      estado: 'MANTENIMIENTO',
    });
    await salonApi.deleteMesa('m-1');
    expect(cliente.delete).toHaveBeenCalledWith('/tables/m-1');
  });
});

describe('salonApi reservas', () => {
  it('lista reservas con fecha, estado y mesa', async () => {
    cliente.get.mockResolvedValue({ items: [apiReserva], total: 1 });
    const reservas = await salonApi.listReservas({
      fecha: '2026-11-20',
      estado: 'CONFIRMADA',
      mesaId: 'm-1',
    });
    expect(cliente.get).toHaveBeenCalledWith(
      '/reservations?fecha=2026-11-20&estado=CONFIRMADA&mesaId=m-1&limit=100',
      { signal: undefined },
    );
    expect(reservas[0].mesaNumero).toBe('12');
  });

  it('crea la reserva con canal y notas opcionales', async () => {
    cliente.post.mockResolvedValue(apiReserva);
    await salonApi.createReserva({
      mesaId: 'm-1',
      clienteNombre: 'Ana',
      telefono: '987654321',
      comensales: 4,
      fechaHora: '2026-11-20T20:00:00-05:00',
      canal: 'Teléfono',
      notas: 'Junto a la ventana',
    });
    expect(cliente.post).toHaveBeenCalledWith('/reservations', {
      mesaId: 'm-1',
      clienteNombre: 'Ana',
      telefono: '987654321',
      nroComensales: 4,
      fechaHora: '2026-11-20T20:00:00-05:00',
      canal: 'Teléfono',
      notas: 'Junto a la ventana',
    });
  });

  it('crea la reserva sin opcionales', async () => {
    cliente.post.mockResolvedValue(apiReserva);
    await salonApi.createReserva({
      mesaId: 'm-1',
      clienteNombre: 'Ana',
      comensales: 2,
      fechaHora: '2026-11-20T20:00:00-05:00',
    });
    expect(cliente.post).toHaveBeenCalledWith('/reservations', {
      mesaId: 'm-1',
      clienteNombre: 'Ana',
      nroComensales: 2,
      fechaHora: '2026-11-20T20:00:00-05:00',
    });
  });

  it('actualiza solo los campos enviados y permite limpiar teléfono/notas', async () => {
    cliente.patch.mockResolvedValue(apiReserva);
    await salonApi.updateReserva('r-1', {
      comensales: 6,
      telefono: null as unknown as string,
      notas: null as unknown as string,
      canal: '',
    });
    expect(cliente.patch).toHaveBeenCalledWith('/reservations/r-1', {
      nroComensales: 6,
      telefono: null,
      notas: null,
      canal: '',
    });
  });

  it('cambia el estado de la reserva', async () => {
    cliente.patch.mockResolvedValue({ ...apiReserva, estado: 'CANCELADA' });
    const reserva = await salonApi.updateReservaEstado('r-1', 'CANCELADA');
    expect(cliente.patch).toHaveBeenCalledWith('/reservations/r-1/status', {
      estado: 'CANCELADA',
    });
    expect(reserva.estado).toBe('CANCELADA');
  });
});
