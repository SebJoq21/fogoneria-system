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

import {
  horaDeApi,
  promocionesApi,
  toCombo,
  toCupon,
  toReglaHoraria,
} from './api';

const apiCombo = {
  id: 'cb-1',
  nombre: 'Combo parrillero',
  descripcion: 'Para dos',
  precio_fijo: '39.60',
  activo: true,
  combos_platos: [
    { plato_id: 'p-1', cantidad: 1, platos: { id: 'p-1', nombre: 'Lomo' } },
    { plato_id: 'p-2', cantidad: 2, platos: null },
  ],
  precioReferencia: '44.00',
  creado: null,
  created_at: '2026-11-01T10:00:00.000Z',
};

const apiCupon = {
  id: 'cp-1',
  codigo: 'PARRILLA10',
  tipo_descuento: 'PORCENTAJE',
  valor: '10.00',
  limite_usos: 100,
  usos_actuales: 3,
  vencimiento: '2026-11-30T00:00:00.000Z',
  activo: true,
  created_at: '2026-11-01T10:00:00.000Z',
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('toCombo', () => {
  it('traduce platos, precios y ahorro del servidor', () => {
    expect(toCombo(apiCombo)).toMatchObject({
      id: 'cb-1',
      nombre: 'Combo parrillero',
      precioFijo: 39.6,
      precioReferencia: 44,
      ahorro: 4.4,
      platos: [
        { platoId: 'p-1', cantidad: 1, nombre: 'Lomo' },
        { platoId: 'p-2', cantidad: 2 },
      ],
    });
    expect(toCombo(apiCombo).createdAt).toBe('2026-11-01T10:00:00.000Z');
  });

  it('calcula el ahorro si la API no lo manda y lo deja null sin referencia', () => {
    expect(toCombo({ ...apiCombo, ahorro: undefined }).ahorro).toBe(4.4);
    expect(toCombo({ ...apiCombo, ahorro: '1.50' }).ahorro).toBe(1.5);
    const sinReferencia = toCombo({
      ...apiCombo,
      precioReferencia: null,
      ahorro: null,
      combos_platos: undefined,
      created_at: undefined,
    });
    expect(sinReferencia.ahorro).toBeNull();
    expect(sinReferencia.precioReferencia).toBeNull();
    expect(sinReferencia.platos).toEqual([]);
    expect(sinReferencia.createdAt).toBeUndefined();
  });
});

describe('toCupon', () => {
  it('traduce el cupón y deja el día de Lima del vencimiento', () => {
    expect(toCupon(apiCupon)).toEqual({
      id: 'cp-1',
      codigo: 'PARRILLA10',
      tipoDescuento: 'PORCENTAJE',
      valor: 10,
      limiteUsos: 100,
      usosActuales: 3,
      vencimiento: '2026-11-30',
      activo: true,
      createdAt: '2026-11-01T10:00:00.000Z',
    });
  });

  it('cae a PORCENTAJE y cero si el tipo o el valor no son válidos', () => {
    const cupon = toCupon({
      ...apiCupon,
      tipo_descuento: 'REGALO',
      valor: null as unknown as string,
      created_at: undefined,
    });
    expect(cupon.tipoDescuento).toBe('PORCENTAJE');
    expect(cupon.valor).toBe(0);
    expect(cupon.createdAt).toBeUndefined();
  });
});

describe('horaDeApi y reglas horarias', () => {
  it('extrae la hora de pared sin restar la zona', () => {
    expect(horaDeApi('1970-01-01T18:00:00Z')).toBe('18:00');
    expect(horaDeApi('18:30:00')).toBe('18:30:00');
  });

  it('traduce la regla con aplicaAhora por defecto en false', () => {
    const regla = {
      id: 'r-1',
      nombre: 'Happy hour',
      beneficio: '2x1 en cervezas',
      dias_semana: [1, 2, 3],
      hora_inicio: '1970-01-01T18:00:00Z',
      hora_fin: '1970-01-01T20:00:00Z',
      activa: true,
    };
    expect(toReglaHoraria(regla)).toMatchObject({
      horaInicio: '18:00',
      horaFin: '20:00',
      aplicaAhora: false,
    });
    expect(toReglaHoraria({ ...regla, aplicaAhora: true }).aplicaAhora).toBe(true);
  });
});

describe('promocionesApi combos', () => {
  it('lista combos', async () => {
    cliente.get.mockResolvedValue([apiCombo]);
    const combos = await promocionesApi.listarCombos();
    expect(cliente.get).toHaveBeenCalledWith('/promotions/combos', { signal: undefined });
    expect(combos[0].ahorro).toBe(4.4);
  });

  it('crea y actualiza combos con el payload camelCase', async () => {
    cliente.post.mockResolvedValue(apiCombo);
    cliente.patch.mockResolvedValue(apiCombo);
    await promocionesApi.crearCombo({
      nombre: 'Combo parrillero',
      descripcion: 'Para dos',
      precioFijo: 39.6,
      platos: [{ platoId: 'p-1', cantidad: 1 }],
    });
    expect(cliente.post).toHaveBeenCalledWith('/promotions/combos', {
      nombre: 'Combo parrillero',
      descripcion: 'Para dos',
      precioFijo: 39.6,
      platos: [{ platoId: 'p-1', cantidad: 1 }],
    });

    await promocionesApi.actualizarCombo('cb-1', { precioFijo: 35, activo: false, platos: [] });
    expect(cliente.patch).toHaveBeenCalledWith('/promotions/combos/cb-1', {
      precioFijo: 35,
      activo: false,
      platos: [],
    });
  });

  it('actualizar sin campos manda un body vacío y elimina el combo', async () => {
    cliente.patch.mockResolvedValue(apiCombo);
    cliente.delete.mockResolvedValue(undefined);
    await promocionesApi.actualizarCombo('cb-1', {});
    expect(cliente.patch).toHaveBeenCalledWith('/promotions/combos/cb-1', {});
    await promocionesApi.eliminarCombo('cb-1');
    expect(cliente.delete).toHaveBeenCalledWith('/promotions/combos/cb-1');
  });
});

describe('promocionesApi cupones', () => {
  it('lista con filtros de activo y paginación', async () => {
    cliente.get.mockResolvedValue({ items: [apiCupon], total: 1, page: 1, limit: 20 });
    const lista = await promocionesApi.listarCupones({ activo: true, page: 1, limit: 20 });
    expect(cliente.get).toHaveBeenCalledWith(
      '/promotions/coupons?activo=true&page=1&limit=20',
      { signal: undefined },
    );
    expect(lista.total).toBe(1);

    await promocionesApi.listarCupones({ activo: false });
    expect(cliente.get).toHaveBeenLastCalledWith('/promotions/coupons?activo=false', {
      signal: undefined,
    });
    await promocionesApi.listarCupones();
    expect(cliente.get).toHaveBeenLastCalledWith('/promotions/coupons', {
      signal: undefined,
    });
  });

  it('crea y actualiza cupones', async () => {
    cliente.post.mockResolvedValue(apiCupon);
    cliente.patch.mockResolvedValue(apiCupon);
    await promocionesApi.crearCupon({
      codigo: 'PARRILLA10',
      tipoDescuento: 'PORCENTAJE',
      valor: 10,
      limiteUsos: 100,
      vencimiento: '2026-11-30',
    });
    expect(cliente.post).toHaveBeenCalledWith('/promotions/coupons', {
      codigo: 'PARRILLA10',
      tipoDescuento: 'PORCENTAJE',
      valor: 10,
      limiteUsos: 100,
      vencimiento: '2026-11-30',
    });

    await promocionesApi.actualizarCupon('cp-1', { valor: 15, activo: false });
    expect(cliente.patch).toHaveBeenCalledWith('/promotions/coupons/cp-1', {
      valor: 15,
      activo: false,
    });

    cliente.delete.mockResolvedValue(undefined);
    await promocionesApi.eliminarCupon('cp-1');
    expect(cliente.delete).toHaveBeenCalledWith('/promotions/coupons/cp-1');
  });

  it('valida el cupón contra el subtotal y escapa el código', async () => {
    cliente.post.mockResolvedValue({ valido: true, motivo: null, descuento: 4.4 });
    const validacion = await promocionesApi.validarCupon('PARRILLA 10', 44);
    expect(cliente.post).toHaveBeenCalledWith(
      '/promotions/coupons/PARRILLA%2010/validate',
      { subtotal: 44 },
    );
    expect(validacion).toEqual({ valido: true, motivo: null, descuento: 4.4 });
  });

  it('lista las reglas horarias', async () => {
    cliente.get.mockResolvedValue([]);
    await expect(promocionesApi.schedule()).resolves.toEqual([]);
    expect(cliente.get).toHaveBeenCalledWith('/promotions/schedule', { signal: undefined });
  });
});
