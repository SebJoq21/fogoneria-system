import { describe, expect, it } from 'vitest';
import {
  canAnnulAccount,
  canAnularPendiente,
  canChangeTableStatus,
  canCheckout,
  canConfirmRecepcion,
  canCreateOrder,
  canManageReservations,
  canMarkEntregado,
  canMarkListo,
  canOpenAccount,
  canOperateCash,
} from './permissions';

describe('permisos del KDS', () => {
  it('solo cocina confirma y marca listo, y solo en el KDS de cocina', () => {
    expect(canConfirmRecepcion('cocina', 'cocina')).toBe(true);
    expect(canConfirmRecepcion('cocina', 'ordenes')).toBe(false);
    expect(canConfirmRecepcion('admin', 'cocina')).toBe(false);
    expect(canMarkListo('cocina', 'cocina')).toBe(true);
    expect(canMarkListo('mesero', 'cocina')).toBe(false);
  });

  it('solo el mesero anula un pendiente propio', () => {
    expect(canAnularPendiente('mesero', { status: 'pendiente', waiter: 'Luis' }, 'Luis')).toBe(
      true,
    );
    expect(canAnularPendiente('mesero', { status: 'pendiente', waiter: 'Ana' }, 'Luis')).toBe(
      false,
    );
    expect(canAnularPendiente('mesero', { status: 'cocina', waiter: 'Luis' }, 'Luis')).toBe(
      false,
    );
    expect(canAnularPendiente('admin', { status: 'pendiente', waiter: 'Luis' }, 'Luis')).toBe(
      false,
    );
  });
});

describe('permisos del salón y la caja', () => {
  it('solo el mesero crea pedidos y marca entregado', () => {
    expect(canCreateOrder('mesero')).toBe(true);
    expect(canCreateOrder('admin')).toBe(false);
    expect(canMarkEntregado('mesero')).toBe(true);
    expect(canMarkEntregado('cocina')).toBe(false);
  });

  it('abren cuenta mesero y sucursal', () => {
    expect(canOpenAccount('mesero')).toBe(true);
    expect(canOpenAccount('sucursal')).toBe(true);
    expect(canOpenAccount('cajero')).toBe(false);
    expect(canOpenAccount('admin')).toBe(false);
  });

  it('cobran y anulan cuentas los roles de salón', () => {
    for (const rol of ['sucursal', 'cajero', 'mesero', 'admin'] as const) {
      expect(canCheckout(rol)).toBe(true);
    }
    expect(canCheckout('cocina')).toBe(false);
    for (const rol of ['sucursal', 'mesero', 'admin'] as const) {
      expect(canAnnulAccount(rol)).toBe(true);
    }
    expect(canAnnulAccount('cajero')).toBe(false);
  });

  it('reservas y estados de mesa son de sucursal y dueño; el dueño solo mira', () => {
    expect(canManageReservations('sucursal')).toBe(true);
    expect(canManageReservations('admin')).toBe(true);
    expect(canManageReservations('mesero')).toBe(false);
    expect(canChangeTableStatus('sucursal')).toBe(true);
    expect(canChangeTableStatus('admin')).toBe(false);
  });

  it('solo sucursal y cajero operan la caja', () => {
    expect(canOperateCash('sucursal')).toBe(true);
    expect(canOperateCash('cajero')).toBe(true);
    expect(canOperateCash('admin')).toBe(false);
    expect(canOperateCash('mesero')).toBe(false);
    expect(canOperateCash(undefined)).toBe(false);
  });
});
