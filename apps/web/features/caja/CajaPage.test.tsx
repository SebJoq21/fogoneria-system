import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  cashMovements: [
    { id: 1, at: '2026-11-20T12:00:00.000Z', concept: 'Cobro ORD-1', kind: 'Ingreso', method: 'Efectivo', amount: 59, shiftId: 'shift-1' },
    { id: 2, at: '2026-11-20T13:00:00.000Z', concept: 'Compra hielo', kind: 'Egreso', method: 'Efectivo', amount: 20, shiftId: 'shift-1' },
  ],
  setCashMovements: () => {},
  openCashShift: null,
  cashShifts: [
    {
      id: 'shift-1',
      branchId: 'b-1',
      status: 'cerrado',
      openedBy: 'Cajera',
      openedAt: '2026-11-20T08:00:00.000Z',
      openingFund: 200,
      closedBy: 'Cajera',
      closedAt: '2026-11-20T20:00:00.000Z',
      countedCash: 240,
      expectedCash: 239,
      difference: 1,
      observations: 'Cuadra',
    },
  ],
  startCashShift: () => {},
  closeCashShift: () => {},
  accounts: [],
  refreshOrders: () => {},
  notify: () => {},
  isGeneral: false,
  branchOf: () => ({ name: 'Miraflores' }),
  currentUser: { id: 'u-1', name: 'Cajera', role: 'cajero', empresaId: null, branchId: 's-1' },
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { CajaPage } from './CajaPage';

describe('CajaPage', () => {
  it('sin turno abierto invita a abrir caja', () => {
    const markup = renderToStaticMarkup(<CajaPage />);
    expect(markup).toContain('Caja cerrada');
    expect(markup).toContain('Abrir turno');
  });

  it('pinta el resumen del turno y la tabla de movimientos', () => {
    const markup = renderToStaticMarkup(<CajaPage />);
    expect(markup).toContain('Resumen de caja');
    expect(markup).toContain('Movimientos del turno');
    expect(markup).toContain('Cobro ORD-1');
    expect(markup).toContain('Compra hielo');
    expect(markup).toContain('Sin cuentas abiertas por cobrar.');
  });

  it('el historial muestra el turno cerrado y su descuadre', () => {
    const markup = renderToStaticMarkup(<CajaPage />);
    expect(markup).toContain('Historial de turnos');
    expect(markup).toContain('Cajera');
    expect(markup).toContain('+$1.00');
  });

  it('con turno abierto muestra el fondo, el esperado y las cuentas por cobrar', () => {
    estado.openCashShift = {
      id: 'shift-1',
      openingFund: 200,
      openedBy: 'Cajera',
      openedAt: '2026-11-20T08:00:00.000Z',
    } as never;
    estado.accounts = [
      {
        id: 'acc-1',
        branchId: 'b-1',
        tableId: 1,
        label: 'Mesa 1',
        customer: 'Ana',
        waiter: 'Luis',
        openedAt: '2026-11-20T12:00:00.000Z',
        closedAt: null,
        status: 'abierta',
        items: [],
        payments: [],
        tip: 0,
        discount: 0,
        discountConcept: '',
        couponCode: null,
        customerId: null,
        motivoAnulacion: null,
      },
    ] as never;
    const markup = renderToStaticMarkup(<CajaPage />);
    expect(markup).toContain('Turno abierto');
    expect(markup).toContain('Cerrar turno (arqueo)');
    expect(markup).toContain('Mesa 1');
    estado.openCashShift = null;
    estado.accounts = [];
  });
});
