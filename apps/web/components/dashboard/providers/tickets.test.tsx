// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { TicketsProvider, useTickets } from './tickets';
import { initialTickets } from '@/lib/dashboard';

function Probe() {
  const { tickets, setTickets, resetTickets } = useTickets();
  return (
    <div>
      <span data-testid="count">{tickets.length}</span>
      <button
        type="button"
        onClick={() => setTickets((prev) => [{ id: '#TK-1', subject: 'No imprime', status: 'Enviado', updated: 'Ahora' }, ...prev])}
      >
        agregar
      </button>
      <button type="button" onClick={resetTickets}>
        reiniciar
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('TicketsProvider', () => {
  it('hidrata los tickets demo y persiste por tenant', async () => {
    render(
      <TicketsProvider>
        <Probe />
      </TicketsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialTickets.length)),
    );

    act(() => screen.getByText('agregar').click());
    expect(screen.getByTestId('count').textContent).toBe(String(initialTickets.length + 1));
    expect(localStorage.getItem('fogoneria:tickets:v1:anon')).toContain('#TK-1');
  });

  it('reinicia los tickets demo', async () => {
    render(
      <TicketsProvider>
        <Probe />
      </TicketsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialTickets.length)),
    );

    act(() => screen.getByText('agregar').click());
    act(() => screen.getByText('reiniciar').click());
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialTickets.length)),
    );
  });
});
