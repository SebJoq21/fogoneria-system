// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { StaffProvider, useStaff } from './provider';
import { initialRoles } from '@/lib/erp';

function Probe() {
  const { roles, setRoles, resetRoles } = useStaff();
  return (
    <div>
      <span data-testid="count">{roles.length}</span>
      <span data-testid="first">{roles[0]?.name ?? '—'}</span>
      <button type="button" onClick={() => setRoles([])}>
        vaciar
      </button>
      <button type="button" onClick={resetRoles}>
        reiniciar
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('StaffProvider', () => {
  it('lee el legacy como fallback aislado y persiste en la clave del módulo', async () => {
    localStorage.setItem(
      'fogoneria:erp:v2:anon',
      JSON.stringify({
        version: 2,
        scopes: {},
        roles: [{ id: 'ROL-9', name: 'Rol legacy', description: 'Demo' }],
      }),
    );

    render(
      <StaffProvider>
        <Probe />
      </StaffProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('first').textContent).toBe('Rol legacy');
    await waitFor(() =>
      expect(localStorage.getItem('fogoneria:staff:v1:anon')).toContain('ROL-9'),
    );
  });

  it('hidrata el demo, vacía y reinicia', async () => {
    render(
      <StaffProvider>
        <Probe />
      </StaffProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialRoles.length)),
    );

    fireEvent.click(screen.getByText('vaciar'));
    expect(screen.getByTestId('count').textContent).toBe('0');

    fireEvent.click(screen.getByText('reiniciar'));
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialRoles.length)),
    );
  });
});
