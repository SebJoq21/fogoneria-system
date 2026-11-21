// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { CrmProvider, useCrm } from './provider';
import { initialCustomers } from '@/lib/erp';

function Probe() {
  const { customers, addPoints, resetCustomers } = useCrm();
  return (
    <div>
      <span data-testid="count">{customers.length}</span>
      <span data-testid="points">{customers[0]?.points ?? 0}</span>
      <button type="button" onClick={() => addPoints(customers[0]!.id, 10)}>
        sumar
      </button>
      <button type="button" onClick={resetCustomers}>
        reiniciar
      </button>
    </div>
  );
}

type Posted = { type: 'state' | 'reset'; source: string; customers: unknown[] };

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

describe('CrmProvider', () => {
  it('migra customers del ErpState v2 una sola vez y limpia el legacy', async () => {
    const legacyCustomer = {
      id: 99,
      name: 'Cliente legacy',
      phone: '999999999',
      points: 7,
      visits: 2,
      segment: 'Nuevo',
      lastVisit: 'Ayer',
    };
    localStorage.setItem(
      'fogoneria:erp:v2:anon',
      JSON.stringify({ version: 2, scopes: {}, customers: [legacyCustomer] }),
    );

    const { unmount } = render(
      <CrmProvider>
        <Probe />
      </CrmProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );

    const legacy = JSON.parse(localStorage.getItem('fogoneria:erp:v2:anon') ?? '{}');
    expect(legacy.customers).toBeUndefined();

    unmount();
    render(
      <CrmProvider>
        <Probe />
      </CrmProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1);
  });

  it('hidrata el demo, suma puntos y persiste por tenant', async () => {
    render(
      <CrmProvider>
        <Probe />
      </CrmProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe(String(initialCustomers.length)));
    const antes = Number(screen.getByTestId('points').textContent);

    fireEvent.click(screen.getByText('sumar'));
    expect(Number(screen.getByTestId('points').textContent)).toBe(antes + 10);
    expect(localStorage.getItem('fogoneria:crm:v1:anon')).toContain(String(antes + 10));
  });

  it('sincroniza clientes entre pestañas sin reemitir el eco', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <CrmProvider>
        <Probe />
      </CrmProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe(String(initialCustomers.length)));

    const channel = FakeBroadcastChannel.instances.find(
      (item) => item.name === 'fogoneria:crm-sync:anon' && item.onmessage !== null,
    );
    expect(channel).toBeTruthy();

    const postedBefore = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );
    act(() => {
      channel!.onmessage?.({
        data: {
          type: 'state',
          source: 'otra-pestana',
          customers: [
            { id: 7, name: 'Remoto', phone: '900000000', points: 3, visits: 1, segment: 'Nuevo', lastVisit: 'Hoy' },
          ],
        },
      } as MessageEvent<Posted>);
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('points').textContent).toBe('3');
    const postedAfter = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );
    expect(postedAfter).toBe(postedBefore);
  });

  it('reinicia la lista demo y emite reset a otras pestañas', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <CrmProvider>
        <Probe />
      </CrmProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe(String(initialCustomers.length)));

    act(() => {
      fireEvent.click(screen.getByText('reiniciar'));
    });
    expect(screen.getByTestId('count').textContent).toBe(String(initialCustomers.length));
    const reset = FakeBroadcastChannel.instances
      .flatMap((item) => item.posted)
      .find((message) => message.type === 'reset');
    expect(reset).toMatchObject({ type: 'reset' });
  });
});
