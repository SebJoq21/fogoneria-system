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

import { gastosApi, toGasto } from './api';

const apiGasto = {
  id: 'g-1',
  sucursal_id: 's-1',
  concepto: 'Gas',
  monto: '120.00',
  categoria: 'INSUMOS',
  estado_pago: 'PAGADO',
  pagado_en_caja: true,
  turno_id: 't-1',
  proveedor_id: 'p-1',
  vencimiento: '2026-11-30',
  registrado_por: 'u-1',
  created_at: '2026-11-20T10:00:00.000Z',
  proveedores: { id: 'p-1', nombre: 'Gas Perú' },
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('toGasto', () => {
  it('traduce el gasto y el nombre del proveedor', () => {
    expect(toGasto(apiGasto)).toMatchObject({
      id: 'g-1',
      concepto: 'Gas',
      monto: 120,
      categoria: 'INSUMOS',
      estadoPago: 'PAGADO',
      pagadoEnCaja: true,
      proveedor: 'Gas Perú',
    });
  });

  it('cae a OTROS/PENDIENTE y monto cero ante valores raros', () => {
    const gasto = toGasto({
      ...apiGasto,
      categoria: 'OTRA',
      estado_pago: 'ANULADO',
      monto: null as unknown as string,
      proveedores: null,
    });
    expect(gasto.categoria).toBe('OTROS');
    expect(gasto.estadoPago).toBe('PENDIENTE');
    expect(gasto.monto).toBe(0);
    expect(gasto.proveedor).toBeNull();
  });
});

describe('gastosApi.listar', () => {
  it('manda todos los filtros y traduce las filas', async () => {
    cliente.get.mockResolvedValue({ items: [apiGasto], total: 1, page: 1, limit: 10 });
    const lista = await gastosApi.listar({
      estadoPago: 'PAGADO',
      categoria: 'INSUMOS',
      vencidos: true,
      sucursalId: 's-1',
      limit: 10,
    });
    expect(cliente.get).toHaveBeenCalledWith(
      '/expenses?estadoPago=PAGADO&categoria=INSUMOS&vencidos=true&sucursalId=s-1&limit=10',
      { signal: undefined },
    );
    expect(lista.total).toBe(1);
    expect(lista.items[0].proveedor).toBe('Gas Perú');
  });

  it('sin filtros no agrega query y respeta vencidos=false', async () => {
    cliente.get.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    await gastosApi.listar();
    expect(cliente.get).toHaveBeenCalledWith('/expenses', { signal: undefined });

    await gastosApi.listar({ vencidos: false });
    expect(cliente.get).toHaveBeenLastCalledWith('/expenses?vencidos=false', {
      signal: undefined,
    });
  });
});

describe('gastosApi.resumen', () => {
  it('lee el resumen de la sucursal', async () => {
    const resumen = {
      porPagar: 300,
      porPagarCantidad: 2,
      vencido: 120,
      vencidoCantidad: 1,
      pagadoMes: 600,
      pagadoMesCantidad: 3,
    };
    cliente.get.mockResolvedValue(resumen);
    await expect(gastosApi.resumen({ sucursalId: 's-1' })).resolves.toEqual(resumen);
    expect(cliente.get).toHaveBeenCalledWith('/expenses/summary?sucursalId=s-1', {
      signal: undefined,
    });
  });

  it('sin sucursal usa el agregado que permite el token', async () => {
    cliente.get.mockResolvedValue({});
    await gastosApi.resumen();
    expect(cliente.get).toHaveBeenCalledWith('/expenses/summary', { signal: undefined });
  });
});

describe('gastosApi.crear y pagar', () => {
  it('crea el gasto con los opcionales presentes', async () => {
    cliente.post.mockResolvedValue(apiGasto);
    const gasto = await gastosApi.crear({
      concepto: 'Gas',
      monto: 120,
      categoria: 'INSUMOS',
      sucursalId: 's-1',
      proveedorId: 'p-1',
      vencimiento: '2026-11-30',
    });
    expect(cliente.post).toHaveBeenCalledWith('/expenses', {
      concepto: 'Gas',
      monto: 120,
      categoria: 'INSUMOS',
      sucursalId: 's-1',
      proveedorId: 'p-1',
      vencimiento: '2026-11-30',
    });
    expect(gasto.id).toBe('g-1');
  });

  it('crea sin los opcionales vacíos', async () => {
    cliente.post.mockResolvedValue(apiGasto);
    await gastosApi.crear({ concepto: 'Luz', monto: 200, categoria: 'SERVICIOS' });
    expect(cliente.post).toHaveBeenCalledWith('/expenses', {
      concepto: 'Luz',
      monto: 200,
      categoria: 'SERVICIOS',
    });
  });

  it('paga en efectivo por el endpoint que exige turno abierto', async () => {
    cliente.post.mockResolvedValue({ ...apiGasto, pagado_en_caja: true });
    const gasto = await gastosApi.pagar('g-1', { metodo: 'EFECTIVO' });
    expect(cliente.post).toHaveBeenCalledWith('/expenses/g-1/pay', { metodo: 'EFECTIVO' });
    expect(gasto.pagadoEnCaja).toBe(true);
  });
});
