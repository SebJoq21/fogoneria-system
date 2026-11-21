// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableAccount } from '@/lib/domain';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { AccountsProvider, useAccounts } from './provider';

const cuenta = (id: string, label: string): TableAccount => ({
  id,
  branchId: 'miraflores',
  tableId: 1,
  tableApiId: null,
  label,
  customer: '',
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
});

function Probe() {
  const { accounts, setAccounts, resetAccounts } = useAccounts();
  return (
    <div>
      <span data-testid="count">{accounts.length}</span>
      <span data-testid="first">{accounts[0]?.label ?? '—'}</span>
      <button type="button" onClick={() => setAccounts((prev) => [cuenta('CT-2', 'Mesa 2'), ...prev])}>
        agregar
      </button>
      <button type="button" onClick={() => setAccounts((prev) => prev.slice(1))}>
        quitar
      </button>
      <button type="button" onClick={resetAccounts}>
        reiniciar
      </button>
    </div>
  );
}

type Posted = { type: 'state' | 'reset'; source: string; value: unknown };

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  readonly name: string;
  onmessage: ((event: MessageEvent<Posted>) => void) | null = null;
  readonly posted: Posted[] = [];

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: Posted): void {
    this.posted.push(data);
  }

  close(): void {}
}

beforeEach(() => {
  localStorage.clear();
  FakeBroadcastChannel.instances = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AccountsProvider', () => {
  it('arranca vacío, acepta actualizaciones funcionales y persiste por tenant', async () => {
    render(
      <AccountsProvider>
        <Probe />
      </AccountsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    act(() => {
      screen.getByText('agregar').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('first').textContent).toBe('Mesa 2');

    act(() => {
      screen.getByText('agregar').click();
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:orders:v1:anon') ?? '[]')).toHaveLength(2);
  });

  it('lee el legacy como fallback aislado sin reescribir el ErpState', async () => {
    localStorage.setItem(
      'fogoneria:erp:v2:anon',
      JSON.stringify({ version: 2, scopes: {}, accounts: [cuenta('CT-9', 'Mesa legacy')] }),
    );

    render(
      <AccountsProvider>
        <Probe />
      </AccountsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('first').textContent).toBe('Mesa legacy');
    await waitFor(() =>
      expect(localStorage.getItem('fogoneria:orders:v1:anon')).toContain('CT-9'),
    );
    expect(JSON.parse(localStorage.getItem('fogoneria:erp:v2:anon') ?? '{}').accounts).toHaveLength(1);
  });

  it('sincroniza entre pestañas sin reemitir el eco', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <AccountsProvider>
        <Probe />
      </AccountsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    const channel = FakeBroadcastChannel.instances.find(
      (item) => item.name === 'fogoneria:orders-sync:anon' && item.onmessage !== null,
    );
    expect(channel).toBeTruthy();

    const postedBefore = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );
    act(() => {
      channel!.onmessage?.({
        data: { type: 'state', source: 'otra-pestana', value: [cuenta('CT-7', 'Mesa remota')] },
      } as MessageEvent<Posted>);
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('first').textContent).toBe('Mesa remota');
    const postedAfter = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );
    expect(postedAfter).toBe(postedBefore);
  });

  it('reinicia las cuentas y emite reset a otras pestañas', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <AccountsProvider>
        <Probe />
      </AccountsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    act(() => {
      screen.getByText('agregar').click();
    });
    act(() => {
      screen.getByText('reiniciar').click();
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    const reset = FakeBroadcastChannel.instances
      .flatMap((item) => item.posted)
      .find((message) => message.type === 'reset');
    expect(reset).toMatchObject({ type: 'reset', value: [] });
  });
});
