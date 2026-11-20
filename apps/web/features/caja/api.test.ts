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

import { cajaApi, metodoFromUi, metodoToUi, tipoToUi } from './api';

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

const turnoApi = {
  id: 't-1',
  sucursal_id: 's-1',
  cajero_id: 'u-1',
  apertura_at: '2026-11-20T08:00:00.000Z',
  cierre_at: null,
  fondo_apertura: '200.00',
  ingresos_total: '288.00',
  egresos_total: '0',
  saldo: null,
  efectivo_contado: null,
  diferencia: null,
  observaciones: null,
  estado: 'ABIERTO',
  usuarios: { id: 'u-1', nombre: 'Cajera Uno' },
};

const movimientoApi = {
  id: 'mov-1',
  turno_id: 't-1',
  tipo: 'INGRESO',
  concepto: 'Cobro ORD-1',
  monto: '59.00',
  metodo: 'EFECTIVO',
  orden_id: 'o-1',
  gasto_id: null,
  created_at: '2026-11-20T12:00:00.000Z',
  usuarios: null,
};

describe('cajaApi.getTurnoActual', () => {
  it('traduce el turno abierto con su arqueo', async () => {
    const arqueo = {
      fondo: 200,
      ingresos: 288,
      egresos: 0,
      ingresosEfectivo: 288,
      egresosEfectivo: 0,
      esperadoEfectivo: 488,
      saldoSistema: 488,
      movimientos: 3,
      efectivoContado: null,
      diferencia: null,
    };
    cliente.get.mockResolvedValue({ turno: turnoApi, arqueo });

    const actual = await cajaApi.getTurnoActual();

    expect(cliente.get).toHaveBeenCalledWith('/cash/shifts/current', { signal: undefined });
    expect(actual?.turno).toMatchObject({
      id: 't-1',
      cajero: 'Cajera Uno',
      fondoApertura: 200,
      ingresosTotal: 288,
      estado: 'ABIERTO',
    });
    expect(actual?.arqueo.esperadoEfectivo).toBe(488);
  });

  it('devuelve null cuando la sucursal no tiene caja abierta', async () => {
    cliente.get.mockResolvedValue(null);
    await expect(cajaApi.getTurnoActual()).resolves.toBeNull();
  });
});

describe('cajaApi.abrirTurno y cerrarTurno', () => {
  it('abre con fondo y sucursal opcional', async () => {
    cliente.post.mockResolvedValue({ turno: turnoApi, arqueo: { fondo: 200 } });
    await cajaApi.abrirTurno({ fondoApertura: 200, sucursalId: 's-1' });
    expect(cliente.post).toHaveBeenCalledWith('/cash/shifts', {
      fondoApertura: 200,
      sucursalId: 's-1',
    });
  });

  it('abre sin mandar sucursal si el rol la hereda del token', async () => {
    cliente.post.mockResolvedValue({ turno: turnoApi, arqueo: { fondo: 200 } });
    await cajaApi.abrirTurno({ fondoApertura: 200 });
    expect(cliente.post).toHaveBeenCalledWith('/cash/shifts', { fondoApertura: 200 });
  });

  it('cierra con el conteo y las observaciones solo si existen', async () => {
    cliente.patch.mockResolvedValue({ turno: turnoApi, arqueo: { fondo: 200 } });
    const cerrado = await cajaApi.cerrarTurno('t-1', {
      efectivoContado: 480,
      observaciones: 'Faltó cambio',
    });
    expect(cliente.patch).toHaveBeenCalledWith('/cash/shifts/t-1/close', {
      efectivoContado: 480,
      observaciones: 'Faltó cambio',
    });
    expect(cerrado.turno.id).toBe('t-1');

    await cajaApi.cerrarTurno('t-1', { efectivoContado: 480 });
    expect(cliente.patch).toHaveBeenLastCalledWith('/cash/shifts/t-1/close', {
      efectivoContado: 480,
    });
  });
});

describe('cajaApi.listarTurnos y listarMovimientos', () => {
  it('lista turnos con su ventana y traduce las filas', async () => {
    cliente.get.mockResolvedValue({ items: [turnoApi], total: 1 });
    const lista = await cajaApi.listarTurnos({ desde: '2026-11-01', hasta: '2026-11-20', limit: 5 });
    expect(cliente.get).toHaveBeenCalledWith(
      '/cash/shifts?desde=2026-11-01&hasta=2026-11-20&limit=5',
      { signal: undefined },
    );
    expect(lista).toMatchObject({ total: 1 });
    expect(lista.items[0]).toMatchObject({ id: 't-1', cajero: 'Cajera Uno' });
  });

  it('lista movimientos por turno y tipo', async () => {
    cliente.get.mockResolvedValue({
      items: [movimientoApi],
      total: 1,
      page: 1,
      limit: 20,
      turnoId: 't-1',
    });
    const lista = await cajaApi.listarMovimientos({ turnoId: 't-1', tipo: 'INGRESO' });
    expect(cliente.get).toHaveBeenCalledWith('/cash/movements?turnoId=t-1&tipo=INGRESO', {
      signal: undefined,
    });
    expect(lista).toMatchObject({ total: 1, turnoId: 't-1' });
    expect(lista.items[0]).toMatchObject({ tipo: 'INGRESO', monto: 59, actor: null });
  });

  it('un tipo desconocido cae a INGRESO y método desconocido a EFECTIVO', async () => {
    cliente.get.mockResolvedValue({
      items: [{ ...movimientoApi, tipo: 'OTRO', metodo: 'PLIN' }],
      total: 1,
      page: 1,
      limit: 20,
      turnoId: 't-1',
    });
    const lista = await cajaApi.listarMovimientos();
    expect(lista.items[0]).toMatchObject({ tipo: 'INGRESO', metodo: 'EFECTIVO' });
  });
});

describe('cajaApi.crearMovimiento y cobrar', () => {
  it('crea el movimiento con sucursal opcional', async () => {
    cliente.post.mockResolvedValue(movimientoApi);
    const mov = await cajaApi.crearMovimiento({
      tipo: 'EGRESO',
      concepto: 'Compra',
      monto: 30,
      metodo: 'EFECTIVO',
      sucursalId: 's-1',
    });
    expect(cliente.post).toHaveBeenCalledWith('/cash/movements', {
      tipo: 'EGRESO',
      concepto: 'Compra',
      monto: 30,
      metodo: 'EFECTIVO',
      sucursalId: 's-1',
    });
    expect(mov.monto).toBe(59);
  });

  it('cobra una comanda con pago parcial y propina', async () => {
    cliente.post.mockResolvedValue({
      ordenId: 'o-1',
      numeroOrden: 'ORD-000001',
      turnoId: 't-1',
      cobrado: '40.00',
      propina: '5.00',
      total: '59.00',
      pendiente: '19.00',
      pagada: false,
    });
    const cobro = await cajaApi.cobrar({ ordenId: 'o-1', metodo: 'TARJETA', monto: 40, propina: 5 });
    expect(cliente.post).toHaveBeenCalledWith('/cash/charges', {
      ordenId: 'o-1',
      metodo: 'TARJETA',
      monto: 40,
      propina: 5,
    });
    expect(cobro).toEqual({
      ordenId: 'o-1',
      numeroOrden: 'ORD-000001',
      turnoId: 't-1',
      cobrado: 40,
      propina: 5,
      total: 59,
      pendiente: 19,
      pagada: false,
    });
  });

  it('sin monto ni propina el servidor cobra el saldo', async () => {
    cliente.post.mockResolvedValue({
      ordenId: 'o-1',
      numeroOrden: 'ORD-000001',
      turnoId: 't-1',
      cobrado: 59,
      propina: 0,
      total: 59,
      pendiente: 0,
      pagada: 1,
    });
    await cajaApi.cobrar({ ordenId: 'o-1', metodo: 'EFECTIVO' });
    expect(cliente.post).toHaveBeenCalledWith('/cash/charges', {
      ordenId: 'o-1',
      metodo: 'EFECTIVO',
    });
  });
});

describe('helpers de la feature', () => {
  it('reexporta las etiquetas del contrato', () => {
    expect(metodoToUi('YAPE')).toBe('Yape');
    expect(tipoToUi('EGRESO')).toBe('Egreso');
    expect(metodoFromUi('Tarjeta')).toBe('TARJETA');
  });
});
