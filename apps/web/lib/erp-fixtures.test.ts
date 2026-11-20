import { describe, expect, it } from 'vitest';
import {
  MODULE_CATALOG,
  expenseCategories,
  initialAttendance,
  initialCashMovements,
  initialCoupons,
  initialCustomers,
  initialEmployees,
  initialExpenses,
  initialIngredients,
  initialMovements,
  initialOrders,
  initialPromos,
  initialReceipts,
  initialReservations,
  initialRoles,
  initialShifts,
  initialTables,
  weekDays,
} from './erp';
import { demoData } from './demo';
import { dataReservas, dataVisitas, initialPayments, initialTickets, services } from './dashboard';
import { initialAccounts, initialBranches, initialScopes } from './tenancy';

const ids = (rows: { id: unknown }[]) => rows.map((row) => row.id);

describe('maestros demo del ERP', () => {
  it('catálogo de módulos con ids únicos y metadatos completos', () => {
    expect(MODULE_CATALOG.length).toBeGreaterThan(0);
    expect(new Set(ids(MODULE_CATALOG)).size).toBe(MODULE_CATALOG.length);
    for (const modulo of MODULE_CATALOG) {
      expect(modulo.title.length).toBeGreaterThan(0);
      expect(modulo.description.length).toBeGreaterThan(0);
    }
  });

  it('órdenes, mesas y reservas coherentes', () => {
    expect(initialOrders.length).toBeGreaterThan(0);
    expect(initialTables.length).toBeGreaterThan(0);
    expect(initialReservations.length).toBeGreaterThan(0);
    expect(new Set(initialOrders.map((orden) => orden.id)).size).toBe(initialOrders.length);
    for (const orden of initialOrders) {
      expect(orden.amount).toBeGreaterThanOrEqual(0);
      expect(orden.items.length).toBeGreaterThan(0);
    }
    for (const mesa of initialTables) {
      expect(mesa.seats).toBeGreaterThan(0);
      expect(['libre', 'ocupada', 'reservada']).toContain(mesa.status);
    }
    for (const reserva of initialReservations) {
      expect(reserva.guests).toBeGreaterThan(0);
      expect(reserva.date).toMatch(/T/);
    }
  });

  it('cupones, clientes, gastos y comprobantes con importes válidos', () => {
    for (const cupon of initialCoupons) {
      expect(cupon.code.length).toBeGreaterThanOrEqual(3);
      expect(cupon.limit).toBeGreaterThan(0);
      expect(cupon.used).toBeLessThanOrEqual(cupon.limit);
    }
    for (const cliente of initialCustomers) {
      expect(cliente.phone.length).toBeGreaterThan(0);
      expect(cliente.points).toBeGreaterThanOrEqual(0);
    }
    for (const gasto of initialExpenses) {
      expect(gasto.amount).toMatch(/^\$/);
      expect(expenseCategories).toContain(gasto.category);
    }
    for (const recibo of initialReceipts) {
      expect(recibo.total).toBeGreaterThan(0);
      expect(['01', '03', '07']).toContain(recibo.type);
    }
  });

  it('inventario, personal y turnos', () => {
    for (const insumo of initialIngredients) {
      expect(insumo.stock).toBeGreaterThanOrEqual(0);
      expect(['Óptimo', 'Bajo', 'Agotado']).toContain(insumo.state);
    }
    expect(initialMovements.length).toBeGreaterThan(0);
    expect(initialEmployees.length).toBeGreaterThan(0);
    expect(initialShifts.length).toBeGreaterThan(0);
    expect(weekDays).toHaveLength(7);
    expect(initialAttendance.length).toBeGreaterThan(0);
    expect(initialRoles.length).toBeGreaterThan(0);
    expect(initialPromos.length).toBeGreaterThan(0);
    expect(initialCashMovements.length).toBeGreaterThan(0);
  });

  it('la operación demo arranca con sus cuentas y scopes por sucursal', () => {
    expect(initialBranches.length).toBeGreaterThan(0);
    expect(initialAccounts).toHaveLength(0);
    expect(Object.keys(initialScopes).length).toBeGreaterThan(0);
    for (const scope of Object.values(initialScopes)) {
      expect(scope.tables.length).toBeGreaterThan(0);
    }
  });
});

describe('fixtures del dashboard y demos', () => {
  it('tickets y pagos del plan', () => {
    expect(initialTickets.length).toBeGreaterThan(0);
    expect(initialPayments[0].amount).toMatch(/^\$/);
    expect(services.length).toBeGreaterThan(0);
    expect(dataVisitas.length).toBe(dataReservas.length);
  });

  it('cada plantilla demo trae su carta', () => {
    expect(Object.keys(demoData).length).toBeGreaterThan(0);
    for (const demo of Object.values(demoData)) {
      expect(demo.items.length).toBeGreaterThan(0);
      for (const item of demo.items) {
        expect(item.price).toMatch(/\d/);
      }
    }
  });
});
