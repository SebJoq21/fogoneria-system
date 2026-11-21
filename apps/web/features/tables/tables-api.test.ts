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

import { salonApi, toMesa } from './api';

const apiMesa = {
  id: 'm-1',
  numero: '12',
  capacidad: 4,
  zona: 'Salón',
  estado: 'OCUPADA',
  forma: 'REDONDA',
  sucursal_id: 's-1',
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
