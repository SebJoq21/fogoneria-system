// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { ReservationsProvider, useReservations } from './provider';
import { initialReservations } from '@/lib/erp';

function Probe() {
  const { reservations, setReservations, resetReservations } = useReservations();
  return (
    <div>
      <span data-testid="count">{reservations.length}</span>
      <span data-testid="first">{reservations[0]?.id ?? '—'}</span>
      <button type="button" onClick={() => setReservations([])}>
        vaciar
      </button>
      <button type="button" onClick={resetReservations}>
        reiniciar
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ReservationsProvider', () => {
  it('hidrata la agenda demo y persiste por tenant', async () => {
    render(
      <ReservationsProvider>
        <Probe />
      </ReservationsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialReservations.length)),
    );
    expect(screen.getByTestId('first').textContent).toBe(initialReservations[0]?.id);

    act(() => screen.getByText('vaciar').click());
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(JSON.parse(localStorage.getItem('fogoneria:reservations:v1:anon') ?? 'null')).toEqual([]);
  });

  it('reinicia la agenda demo', async () => {
    render(
      <ReservationsProvider>
        <Probe />
      </ReservationsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialReservations.length)),
    );

    act(() => screen.getByText('vaciar').click());
    act(() => screen.getByText('reiniciar').click());
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialReservations.length)),
    );
  });
});
