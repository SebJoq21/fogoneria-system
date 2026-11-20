import { describe, expect, it } from 'vitest';
import {
  cajaSummary,
  cartaSummary,
  clientesSummary,
  combosSummary,
  comprobantesSummary,
  fmtMoney,
  gastosSummary,
  inventarioSummary,
  kardexSummary,
  mesasSummary,
  ordenesSummary,
  parseMoney,
  personalSummary,
  priceListsSummary,
  promosSummary,
} from './summary-selectors';
import type {
  CashMovement,
  Coupon,
  Customer,
  Expense,
  Ingredient,
  Order,
  Receipt,
  StockMovement,
  Table,
} from '@/lib/erp';
import type { Combo, PriceList, Product, ProductCategory } from '@/lib/erp-catalog';

describe('formatos', () => {
  it('parsea importes con símbolos y separadores', () => {
    expect(parseMoney('$1,234.50')).toBe(1234.5);
    expect(parseMoney('  $ 20 ')).toBe(20);
    expect(parseMoney('no-numero')).toBe(0);
  });

  it('formatea a dos decimales', () => {
    expect(fmtMoney(1234.5)).toBe('$1234.50');
  });
});

describe('mesasSummary', () => {
  const mesas = [
    { status: 'libre', seats: 4 },
    { status: 'libre', seats: 2 },
    { status: 'ocupada', seats: 4 },
    { status: 'reservada', seats: 6 },
  ] as Table[];

  it('cuenta estados, asientos y ocupación', () => {
    const { kpis, donut } = mesasSummary(mesas);
    expect(kpis[0]).toMatchObject({ value: '4', hint: '16 asientos' });
    expect(kpis[1]).toMatchObject({ value: '25%', hint: '1 en servicio' });
    expect(kpis[2].value).toBe('2');
    expect(kpis[3].value).toBe('1');
    expect(donut).toEqual([
      { name: 'Libres', v: 2 },
      { name: 'Ocupadas', v: 1 },
      { name: 'Reservadas', v: 1 },
    ]);
  });

  it('no divide por cero sin mesas', () => {
    expect(mesasSummary([]).kpis[1].value).toBe('0%');
  });
});

describe('ordenesSummary', () => {
  const ordenes = [
    { status: 'pendiente', amount: 30 },
    { status: 'cocina', amount: 20 },
    { status: 'listo', amount: 10 },
    { status: 'entregado', amount: 40 },
    { status: 'anulado', amount: 999 },
  ] as Order[];

  it('ignora anuladas y calcula el ticket promedio', () => {
    const { kpis, bars } = ordenesSummary(ordenes);
    expect(kpis[0]).toMatchObject({ value: '4', hint: '1 por confirmar' });
    expect(kpis[1].value).toBe('1');
    expect(kpis[2].value).toBe('1');
    expect(kpis[3].value).toBe('$25.00');
    expect(bars).toEqual([
      { name: 'Por conf.', v: 1 },
      { name: 'Cocina', v: 1 },
      { name: 'Listo', v: 1 },
      { name: 'Entregado', v: 1 },
    ]);
  });

  it('sin comandas el ticket es cero', () => {
    expect(ordenesSummary([]).kpis[3].value).toBe('$0.00');
  });
});

describe('cajaSummary', () => {
  const movimientos = [
    { kind: 'Ingreso', method: 'Efectivo', amount: 100 },
    { kind: 'Ingreso', method: 'Yape', amount: 50.5 },
    { kind: 'Egreso', method: 'Efectivo', amount: 20 },
  ] as CashMovement[];

  it('suma por tipo y método', () => {
    const resumen = cajaSummary(movimientos);
    expect(resumen.ingresos).toBe(150.5);
    expect(resumen.egresos).toBe(20);
    expect(resumen.kpis).toMatchObject([
      { label: 'Saldo del turno', value: '$130.50' },
      { label: 'Ingresos', value: '$150.50', hint: '2 movimientos' },
      { label: 'Egresos', value: '$20.00', hint: '1 movimientos' },
      { label: 'Movimientos', value: '3' },
    ]);
    expect(resumen.byMethod).toEqual([
      { name: 'Efectivo', v: 100 },
      { name: 'Yape', v: 51 },
    ]);
  });

  it('sin movimientos devuelve ceros', () => {
    expect(cajaSummary([]).kpis[0].value).toBe('$0.00');
  });
});

describe('comprobantesSummary', () => {
  const recibos = [
    { status: 'Pagada', total: 59 },
    { status: 'Pagada', total: 41 },
    { status: 'Anulada', total: 10 },
  ] as Receipt[];

  it('suma solo las pagadas y cuenta anuladas', () => {
    const { kpis, donut } = comprobantesSummary(recibos);
    expect(kpis[0].value).toBe('3');
    expect(kpis[1]).toMatchObject({ value: '2', hint: '$100.00' });
    expect(kpis[2].hint).toBe('requieren revisión');
    expect(kpis[3].value).toBe('$100.00');
    expect(donut).toEqual([
      { name: 'Pagadas', v: 2 },
      { name: 'Anuladas', v: 1 },
    ]);
  });

  it('sin anuladas lo indica', () => {
    expect(comprobantesSummary([recibos[0]]).kpis[2].hint).toBe('sin anulaciones');
  });
});

describe('inventarioSummary y kardexSummary', () => {
  const insumos = [
    { state: 'Óptimo' },
    { state: 'Óptimo' },
    { state: 'Bajo' },
    { state: 'Agotado' },
  ] as Ingredient[];

  it('resume el semáforo', () => {
    const { kpis, bars } = inventarioSummary(insumos);
    expect(kpis[0].value).toBe('4');
    expect(kpis[1].value).toBe('2');
    expect(kpis[2].value).toBe('1');
    expect(kpis[3]).toMatchObject({ value: '1', hint: 'acción inmediata' });
    expect(bars).toEqual([
      { name: 'Óptimo', v: 2 },
      { name: 'Bajo', v: 1 },
      { name: 'Agotado', v: 1 },
    ]);
    expect(inventarioSummary([]).kpis[3].hint).toBe('sin quiebres');
  });

  it('resume el kardex por tipo', () => {
    const movs = [
      { type: 'Entrada' },
      { type: 'Salida' },
      { type: 'Salida' },
      { type: 'Ajuste' },
    ] as StockMovement[];
    const { kpis, bars } = kardexSummary(movs);
    expect(kpis.map((k) => k.value)).toEqual(['4', '1', '2', '1']);
    expect(bars).toEqual([
      { name: 'Entradas', v: 1 },
      { name: 'Salidas', v: 2 },
      { name: 'Ajustes', v: 1 },
    ]);
  });
});

describe('combosSummary y promosSummary', () => {
  const combos = [
    { name: 'Dúo Criollo', price: 17, status: 'Activo' },
    { name: 'Almuerzo Ejecutivo', price: 24, status: 'Activo' },
    { name: 'Pausado', price: 10, status: 'Inactivo' },
  ] as Combo[];

  it('promedia solo los activos y corta a 6 barras', () => {
    const { kpis, bars } = combosSummary(combos);
    expect(kpis[0]).toMatchObject({ value: '3', hint: '2 activos' });
    expect(kpis[1].value).toBe('$20.50');
    expect(kpis[3].value).toBe('1');
    expect(bars).toHaveLength(2);
  });

  it('sin combos activos el promedio es cero', () => {
    expect(combosSummary([]).kpis[1].value).toBe('$0.00');
  });

  it('resume cupones y su uso', () => {
    const cupones = [
      { code: 'VERANO20', used: 10, limit: 20 },
      { code: 'MENOS5', used: 5, limit: 10 },
    ] as Coupon[];
    const { kpis, bars } = promosSummary(cupones, 3);
    expect(kpis[0]).toMatchObject({ value: '2', hint: '15/30 usos' });
    expect(kpis[1].value).toBe('15');
    expect(kpis[2].value).toBe('3');
    expect(kpis[3].value).toBe('50%');
    expect(bars).toHaveLength(2);
  });

  it('sin cupo total el uso es un guion', () => {
    expect(promosSummary([{ code: 'X', used: 0, limit: 0 }] as Coupon[], 0).kpis[3].value).toBe('—');
  });
});

describe('cartaSummary y priceListsSummary', () => {
  const categorias = [
    { id: 'c-1', name: 'Fondos', position: 1 },
    { id: 'c-2', name: 'Bebidas', position: 2 },
  ] as ProductCategory[];
  const productos = [
    { id: 'p-1', name: 'Lomo', categoryId: 'c-1', status: 'Activo' },
    { id: 'p-2', name: 'Chicha', categoryId: 'c-2', status: 'Activo' },
    { id: 'p-3', name: 'Pausado', categoryId: 'c-1', status: 'Inactivo' },
  ] as Product[];
  const lista = {
    id: 'l-1',
    name: 'Carta',
    active: true,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    prices: { 'p-1': 24.9, 'p-2': 15.1, 'p-3': 0 },
  } as PriceList;

  it('resume carta con el precio de la lista activa', () => {
    const priceOf = (id: string) => lista.prices[id] ?? 0;
    const { kpis, bars } = cartaSummary(productos, categorias, priceOf);
    expect(kpis[0]).toMatchObject({ value: '2', hint: 'de 3 en maestro' });
    expect(kpis[1].value).toBe('2');
    expect(kpis[2].value).toBe('$20.00');
    expect(kpis[3].value).toBe('1');
    expect(bars).toEqual([
      { name: 'Fondos', v: 1 },
      { name: 'Bebidas', v: 1 },
    ]);
    expect(cartaSummary([], [], priceOf).kpis[2].value).toBe('$0.00');
  });

  it('resume listas con la activa y la vigencia', () => {
    const { kpis, bars } = priceListsSummary([lista], productos);
    expect(kpis[0]).toMatchObject({ value: '1', hint: 'activa: Carta' });
    expect(kpis[1].value).toBe('$20.00');
    expect(kpis[3]).toMatchObject({ value: '12-31', hint: '2026-01-01' });
    expect(bars[0]).toEqual({ name: 'Carta', v: 20 });
  });

  it('sin lista activa deja guiones', () => {
    const inactiva = { ...lista, active: false } as PriceList;
    const { kpis } = priceListsSummary([inactiva], productos);
    expect(kpis[0].hint).toBe('activa: —');
    expect(kpis[1].value).toBe('—');
    expect(kpis[3].value).toBe('—');
    expect(priceListsSummary([], []).kpis[3].value).toBe('—');
  });
});

describe('clientesSummary y gastosSummary', () => {
  const clientes = [
    { segment: 'VIP', points: 100 },
    { segment: 'Frecuente', points: 50 },
    { segment: 'Nuevo', points: 0 },
  ] as Customer[];

  it('cuenta segmentos y puntos', () => {
    const { kpis, donut } = clientesSummary(clientes);
    expect(kpis[0].value).toBe('3');
    expect(kpis[1].value).toBe('1');
    expect(kpis[2].value).toBe('1');
    expect(kpis[3].value).toBe('150');
    expect(donut).toEqual([
      { name: 'VIP', v: 1 },
      { name: 'Frecuentes', v: 1 },
      { name: 'Nuevos', v: 1 },
    ]);
  });

  it('agrupa gastos por categoría y calcula el pendiente', () => {
    const gastos = [
      { amount: '$120.00', status: 'Pagado', category: 'Insumos' },
      { amount: '$80.00', status: 'Pendiente', category: 'Insumos' },
      { amount: '$30.00', status: 'Pagado', category: 'Servicios' },
    ] as Expense[];
    const { kpis, bars } = gastosSummary(gastos);
    expect(kpis[0]).toMatchObject({ value: '$230.00', hint: '3 registros' });
    expect(kpis[1].value).toBe('$150.00');
    expect(kpis[2].value).toBe('$80.00');
    expect(kpis[3].value).toBe('2');
    expect(bars).toEqual([
      { name: 'Insumos', v: 200 },
      { name: 'Servicios', v: 30 },
    ]);
  });
});

describe('personalSummary', () => {
  it('calcula el equipo en turno y la asistencia', () => {
    const empleados = [{ onShift: true }, { onShift: false }, { onShift: true }];
    const { kpis, bars } = personalSummary(empleados, 9, 10);
    expect(kpis[0]).toMatchObject({ value: '3', hint: '2 en turno' });
    expect(kpis[1].value).toBe('2/3');
    expect(kpis[2].value).toBe('90%');
    expect(kpis[3].value).toBe('1');
    expect(bars).toEqual([
      { name: 'En turno', v: 2 },
      { name: 'Descanso', v: 1 },
    ]);
  });

  it('sin marcaciones la asistencia es cero', () => {
    expect(personalSummary([], 0, 0).kpis[2].value).toBe('0%');
  });
});
