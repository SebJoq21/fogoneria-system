// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { TablesProvider, useTables } from './provider';
import { initialScopes } from '@/lib/tenancy';

function Probe() {
  const { tablesByBranch, setTablesForBranches, patchStatus, ensureDemoTables, resetTables } =
    useTables();
  const mesa = (tablesByBranch.miraflores ?? [])[0];
  return (
    <div>
      <span data-testid="miraflores">{(tablesByBranch.miraflores ?? []).length}</span>
      <span data-testid="surco">{(tablesByBranch.surco ?? []).length}</span>
      <span data-testid="estado">{mesa?.status ?? '—'}</span>
      <button type="button" onClick={() => ensureDemoTables(['miraflores', 'surco'])}>
        asegurar
      </button>
      <button type="button" onClick={() => mesa && patchStatus('miraflores', mesa.id, 'ocupada')}>
        ocupar
      </button>
      <button
        type="button"
        onClick={() =>
          setTablesForBranches(['miraflores', 'surco'], 'miraflores', (current) =>
            current.map((table) => ({ ...table, zone: 'Salón' })),
          )
        }
      >
        zonificar
      </button>
      <button type="button" onClick={resetTables}>
        reiniciar
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('TablesProvider', () => {
  it('hidrata el demo, asegura sucursales y parchea el estado de una mesa', async () => {
    render(
      <TablesProvider>
        <Probe />
      </TablesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('miraflores').textContent).toBe(
        String(initialScopes.miraflores.tables.length),
      ),
    );
    expect(screen.getByTestId('estado').textContent).toBe('libre');

    act(() => screen.getByText('asegurar').click());
    expect(screen.getByTestId('surco').textContent).toBe(
      String(initialScopes.surco.tables.length),
    );

    act(() => screen.getByText('ocupar').click());
    expect(screen.getByTestId('estado').textContent).toBe('ocupada');
    const guardado = JSON.parse(localStorage.getItem('fogoneria:tables-demo:v1:anon') ?? '{}');
    expect(guardado.miraflores[0].status).toBe('ocupada');
  });

  it('aplica la escritura por sucursal y reinicia', async () => {
    render(
      <TablesProvider>
        <Probe />
      </TablesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('miraflores').textContent).toBe(
        String(initialScopes.miraflores.tables.length),
      ),
    );

    act(() => screen.getByText('zonificar').click());
    const guardado = JSON.parse(localStorage.getItem('fogoneria:tables-demo:v1:anon') ?? '{}');
    expect(guardado.miraflores.every((t: { zone: string }) => t.zone === 'Salón')).toBe(true);

    act(() => screen.getByText('reiniciar').click());
    await waitFor(() =>
      expect(screen.getByTestId('miraflores').textContent).toBe(
        String(initialScopes.miraflores.tables.length),
      ),
    );
  });
});
