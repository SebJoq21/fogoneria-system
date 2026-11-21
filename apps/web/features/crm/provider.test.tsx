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

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CrmProvider', () => {
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

  it('reinicia la lista demo', async () => {
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
  });
});
