// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { empresaId: string },
}));

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => sesion,
}));

import { ExpensesProvider, useExpenses } from './provider';
import { initialExpenses } from '@/lib/erp';

function Probe() {
  const { expenses, setExpenses, resetExpenses } = useExpenses();
  return (
    <div>
      <span data-testid="count">{expenses.length}</span>
      <span data-testid="first">{expenses[0]?.amount ?? '—'}</span>
      <button type="button" onClick={() => setExpenses([])}>
        vaciar
      </button>
      <button type="button" onClick={resetExpenses}>
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
  sesion.currentUser = null;
  FakeBroadcastChannel.instances = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ExpensesProvider', () => {
  it('hidrata el demo sin sesión, persiste por tenant y reinicia', async () => {
    render(
      <ExpensesProvider>
        <Probe />
      </ExpensesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialExpenses.length)),
    );
    expect(localStorage.getItem('fogoneria:expenses:v1:anon')).toContain(initialExpenses[0]!.amount);

    fireEvent.click(screen.getByText('vaciar'));
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(JSON.parse(localStorage.getItem('fogoneria:expenses:v1:anon') ?? 'null')).toEqual([]);

    fireEvent.click(screen.getByText('reiniciar'));
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialExpenses.length)),
    );
  });

  it('no escribe el estado del tenant anterior en la clave nueva', async () => {
    const { rerender } = render(
      <ExpensesProvider>
        <Probe />
      </ExpensesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialExpenses.length)),
    );

    sesion.currentUser = { empresaId: 'emp-b' };
    rerender(
      <ExpensesProvider>
        <Probe />
      </ExpensesProvider>,
    );

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:expenses:v1:emp-b') ?? 'null')).toEqual([]),
    );
  });

  it('sincroniza entre pestañas sin reemitir el eco', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <ExpensesProvider>
        <Probe />
      </ExpensesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialExpenses.length)),
    );

    const channel = FakeBroadcastChannel.instances.find(
      (item) => item.name === 'fogoneria:expenses-sync:anon' && item.onmessage !== null,
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
          value: [
            {
              id: 41,
              date: 'Hoy',
              category: 'Insumos',
              supplier: 'Remoto',
              amount: '$41.00',
              status: 'Pagado',
            },
          ],
        },
      } as MessageEvent<Posted>);
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('first').textContent).toBe('$41.00');
    const postedAfter = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );
    expect(postedAfter).toBe(postedBefore);
  });

  it('reinicia y emite reset a otras pestañas', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <ExpensesProvider>
        <Probe />
      </ExpensesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialExpenses.length)),
    );

    act(() => {
      fireEvent.click(screen.getByText('reiniciar'));
    });
    const reset = FakeBroadcastChannel.instances
      .flatMap((item) => item.posted)
      .find((message) => message.type === 'reset');
    expect(reset).toMatchObject({ type: 'reset', value: initialExpenses });
  });
});
