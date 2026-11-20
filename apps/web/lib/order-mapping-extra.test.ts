import { describe, expect, it } from 'vitest';
import { canSendAccount, notesOfItem, orderFromApi } from './order-mapping';
import type { ApiOrder } from './orders-api';
import type { AccountItem, TableAccount } from './domain';

const base: ApiOrder = {
  id: 'o-1',
  numero_orden: 'ORD-000001',
  estado: 'POR_CONFIRMAR',
  origen: 'MESA',
  empresa_id: 'e-1',
  sucursal_id: 's-1',
  mesa_id: null,
  mesero_id: null,
  subtotal: '24.90',
  descuento_cupon: '0.00',
  total: '24.90',
  created_at: '2026-11-20T12:00:00.000Z',
  confirmacion_at: null,
  listo_at: null,
  entrega_at: null,
  detalles_orden: [],
  mesas: null,
};

describe('orderFromApi: canales sin mesa', () => {
  it('una comanda de barra se pinta como para llevar', () => {
    const orden = orderFromApi({ ...base, origen: 'BARRA' });
    expect(orden.customer).toBe('Para llevar');
    expect(orden.channel).toBe('Llevar');
    expect(orden.tableId).toBeNull();
  });

  it('una comanda web usa el canal web', () => {
    const orden = orderFromApi({ ...base, origen: 'WEB' });
    expect(orden.customer).toBe('Web');
    expect(orden.channel).toBe('Web');
  });

  it('una comanda de mesa usa el número y el mesero', () => {
    const orden = orderFromApi({
      ...base,
      mesas: { id: 'm-1', numero: 'Mesa 12', zona: null },
      usuarios: { id: 'u-1', nombre: 'Ana' },
      mesero_id: 'u-1',
    });
    expect(orden.customer).toBe('Mesa Mesa 12');
    expect(orden.tableId).toBe(12);
    expect(orden).toMatchObject({ waiter: 'Ana', waiterId: 'u-1' });
  });
});

function item(overrides: Partial<AccountItem> = {}): AccountItem {
  return {
    id: 'it-1',
    productId: 'p-1',
    name: 'Lomo',
    qty: 1,
    unitPrice: 24.9,
    modifiers: [],
    notes: '',
    sent: false,
    ...overrides,
  };
}

describe('notesOfItem', () => {
  it('sin modificadores ni nota no manda nada', () => {
    expect(notesOfItem(item())).toBeUndefined();
  });

  it('junta modificadores y nota, y recorta a 500', () => {
    expect(
      notesOfItem(
        item({
          modifiers: [{ optionId: 'o-1', name: 'Sin ají', extra: 0 }],
          notes: 'Cortado fino',
        }),
      ),
    ).toBe('Sin ají · Cortado fino');

    expect(notesOfItem(item({ notes: 'x'.repeat(600) }))?.length).toBe(500);
  });
});

function account(items: AccountItem[]): TableAccount {
  return {
    id: 'a-1',
    branchId: 'b-1',
    tableId: 1,
    label: 'Mesa 1',
    customer: '',
    waiter: '',
    openedAt: '2026-11-20T12:00:00.000Z',
    closedAt: null,
    status: 'abierta',
    items,
    payments: [],
    tip: 0,
    discount: 0,
    discountConcept: '',
    couponCode: null,
    customerId: null,
    motivoAnulacion: null,
  };
}

describe('canSendAccount', () => {
  it('no manda una cuenta vacía ni todo enviado', () => {
    expect(canSendAccount(account([]))).toBe(false);
    expect(canSendAccount(account([item({ sent: true })]))).toBe(false);
  });

  it('manda si hay al menos una línea pendiente', () => {
    expect(canSendAccount(account([item({ sent: true }), item({ id: 'it-2' })]))).toBe(true);
  });
});
