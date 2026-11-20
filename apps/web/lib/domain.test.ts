import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IGV_RATE,
  SERIE_LABEL,
  accountTotals,
  deriveTableStatus,
  elapsedLabel,
  expectedCashFor,
  fmtDateTime,
  fmtMoney,
  isValidDni,
  isValidRuc,
  itemLineTotal,
  newId,
  nextReceiptNumber,
  nowIso,
  splitIgv,
} from './domain';
import type { CashShift, TableAccount } from './domain';
import type { CashMovement, Reservation, Table } from './erp';

const item = {
  id: 'it-1',
  productId: 'p-1',
  name: 'Lomo',
  qty: 2,
  unitPrice: 24.9,
  modifiers: [{ optionId: 'o-1', name: 'Extra queso', extra: 2 }],
  notes: '',
  sent: false,
};

const cuenta = (overrides: Partial<TableAccount> = {}): TableAccount => ({
  id: 'a-1',
  branchId: 'b-1',
  tableId: 4,
  label: 'Mesa 4',
  customer: 'Ana',
  waiter: 'Luis',
  openedAt: '2026-11-20T12:00:00.000Z',
  closedAt: null,
  status: 'abierta',
  items: [item],
  payments: [],
  tip: 5,
  discount: 10,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
  ...overrides,
});

const mesa = (overrides: Partial<Table> = {}): Table =>
  ({
    id: 4,
    label: 'Mesa 4',
    capacity: 4,
    status: 'libre',
    shape: 'redonda',
    zone: 'Salón',
    ...overrides,
  }) as Table;

afterEach(() => {
  vi.useRealTimers();
});

describe('formatos de dinero y fecha', () => {
  it('formatea importes con dos decimales', () => {
    expect(fmtMoney(24.9)).toBe('$24.90');
    expect(fmtMoney(0)).toBe('$0.00');
  });

  it('saluda con Hoy/Ayer y cae a fecha corta', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T15:00:00.000Z'));
    expect(fmtDateTime('2026-11-20T12:30:00.000Z')).toMatch(/^Hoy /);
    expect(fmtDateTime('2026-11-19T12:30:00.000Z')).toMatch(/^Ayer /);
    expect(fmtDateTime('2026-11-01T12:30:00.000Z')).not.toMatch(/^(Hoy|Ayer) /);
  });

  it('mide el tiempo transcurrido en minutos y horas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T15:00:00.000Z'));
    expect(elapsedLabel('2026-11-20T15:00:00.000Z')).toBe('ahora mismo');
    expect(elapsedLabel('2026-11-20T14:35:00.000Z')).toBe('hace 25 min');
    expect(elapsedLabel('2026-11-20T13:15:00.000Z')).toBe('hace 1 h 45 min');
    expect(elapsedLabel('2026-11-20T16:00:00.000Z')).toBe('ahora mismo');
    expect(nowIso()).toBe('2026-11-20T15:00:00.000Z');
  });
});

describe('cálculos de la cuenta', () => {
  it('suma extras y cantidad por línea', () => {
    expect(itemLineTotal(item)).toBeCloseTo(53.8);
    expect(itemLineTotal({ ...item, modifiers: [], qty: 1 })).toBe(24.9);
  });

  it('calcula subtotal, descuento topado y total', () => {
    expect(accountTotals(cuenta())).toEqual({
      subtotal: 53.8,
      discount: 10,
      total: 43.8,
      tip: 5,
    });
    expect(accountTotals(cuenta({ discount: -5 })).discount).toBe(0);
    expect(accountTotals(cuenta({ discount: 100 })).discount).toBe(53.8);
  });

  it('desglosa el IGV incluido en el precio', () => {
    expect(IGV_RATE).toBe(0.18);
    expect(splitIgv(118)).toEqual({ subtotal: 100, igv: 18 });
    expect(splitIgv(59)).toEqual({ subtotal: 50, igv: 9 });
  });
});

describe('correlativo de comprobantes', () => {
  it('usa una serie por tipo y suma uno al máximo existente', () => {
    expect(SERIE_LABEL).toEqual({ '01': 'F001', '03': 'B001', '07': 'NC01' });
    expect(nextReceiptNumber([], '03')).toBe('B001-1');
    expect(nextReceiptNumber([{ id: 'B001-1' }, { id: 'B001-7' }], '03')).toBe('B001-8');
    expect(nextReceiptNumber([{ id: 'F001-3' }], '01')).toBe('F001-4');
    expect(nextReceiptNumber([{ id: 'NC01-2' }], '07')).toBe('NC01-3');
    expect(nextReceiptNumber([{ id: 'OTRO-9' }], '07')).toBe('NC01-1');
  });
});

describe('efectivo esperado del turno', () => {
  const shift: Pick<CashShift, 'id' | 'openedAt' | 'openingFund'> = {
    id: 't-1',
    openedAt: '2026-11-20T08:00:00.000Z',
    openingFund: 200,
  };
  const movimiento = (overrides: Partial<CashMovement>): CashMovement =>
    ({
      id: 'm',
      at: '2026-11-20T09:00:00.000Z',
      kind: 'Ingreso',
      method: 'Efectivo',
      amount: 0,
      concept: '',
      ...overrides,
    }) as CashMovement;

  it('suma ingresos y resta egresos solo del turno y en efectivo', () => {
    const movimientos = [
      movimiento({ amount: 288, shiftId: 't-1' }),
      movimiento({ amount: 40, shiftId: 't-1' }),
      movimiento({ amount: 30, shiftId: 't-1', kind: 'Egreso' }),
      movimiento({ amount: 500, shiftId: 't-2' }),
      movimiento({ amount: 100, method: 'Tarjeta' }),
      movimiento({ amount: 60, shiftId: undefined, at: '2026-11-20T09:30:00.000Z' }),
      movimiento({ amount: 20, shiftId: undefined, at: '2026-11-20T07:00:00.000Z' }),
    ];
    expect(expectedCashFor(shift, movimientos)).toBe(558);
  });
});

describe('estado derivado de la mesa', () => {
  it('está ocupada si hay una cuenta abierta que coincide por id', () => {
    expect(deriveTableStatus(mesa(), [cuenta()], [])).toBe('ocupada');
  });

  it('coincide por UUID de la API o por etiqueta', () => {
    expect(
      deriveTableStatus(mesa({ apiId: 'uuid-4' }), [cuenta({ tableId: null, tableApiId: 'uuid-4' })], []),
    ).toBe('ocupada');
    expect(
      deriveTableStatus(mesa({ id: 9, label: 'Terraza 2' }), [cuenta({ tableId: null, label: ' terraza  2 ' })], []),
    ).toBe('ocupada');
    expect(
      deriveTableStatus(mesa({ id: 9 }), [cuenta({ tableId: null, label: 'Mesa 9' })], []),
    ).toBe('ocupada');
  });

  it('respeta el estado del servidor aunque no haya cuenta local', () => {
    expect(deriveTableStatus(mesa({ status: 'ocupada' }), [], [])).toBe('ocupada');
    expect(deriveTableStatus(mesa({ status: 'reservada' }), [], [])).toBe('reservada');
  });

  it('marca reservada si hay reserva confirmada de hoy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T15:00:00.000Z'));
    const reserva = {
      id: 'r-1',
      tableId: 4,
      status: 'confirmada',
      date: '2026-11-20T20:00:00.000Z',
    } as Reservation;
    expect(deriveTableStatus(mesa(), [], [reserva])).toBe('reservada');
    expect(deriveTableStatus(mesa(), [], [{ ...reserva, date: '2026-11-21' }])).toBe('libre');
    expect(deriveTableStatus(mesa(), [], [{ ...reserva, status: 'cancelada' }])).toBe('libre');
  });

  it('una cuenta cerrada no ocupa la mesa', () => {
    expect(deriveTableStatus(mesa(), [cuenta({ status: 'cobrada' })], [])).toBe('libre');
  });
});

describe('documentos y números', () => {
  it('valida RUC SUNAT y DNI', () => {
    expect(isValidRuc('20123456786')).toBe(true);
    expect(isValidRuc('20123456789')).toBe(false);
    expect(isValidRuc('123')).toBe(false);
    expect(isValidDni('12345678')).toBe(true);
    expect(isValidDni('1234567')).toBe(false);
  });

  it('genera ids con prefijo y secuencia', () => {
    const a = newId('acc');
    const b = newId('acc');
    expect(a.startsWith('acc-')).toBe(true);
    expect(b.startsWith('acc-')).toBe(true);
    expect(a).not.toBe(b);
  });
});
